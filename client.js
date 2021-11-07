const defaultConfig = require('./Common/DefaultConfig');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const HttpTunnelClient = require('./HttpTunnel/HttpTunnelClient');
const UdpTunnelClient = require('./UdpTunnel/UdpTunnelClient');
const UpnpUtil = require('./Utils/UpnpUtil');
const NetUtil = require('./Utils/NetUtil');
const os = require('os');
const getMAC = require('getmac').default;
const { program } = require('commander');
const startConnect2SocketIO = require('./Communication/Soldier');
const net = require('net');
const Socket = require('socket.io-client').Socket;
const sleep = require('es7-sleep');
const { checkType, isNumber, isEmpty, isString, isBoolean } = require('./Utils/TypeCheckUtil');
const N2NClient = require('./N2N/N2NClient');
const AesUtil = require('./Utils/AesUtil');
const PlatfromUtil = require('./Utils/PlatfromUtil');
const ServiceUtil = require('./Utils/ServiceUtil');
const ConfigCheckUtil = require('./Utils/ConfigCheckUtil');
const path = require('path');
const commandType = require('./Communication/CommandType').commandType;
const rootPath = require('./Common/GlobalData').rootPath;
const SysTray = require('./SysTray/SysTray');
const getPluginPath = require('./Utils/PluginUtil').getPluginPath;
const prompt = require('prompt');
const fs = require('fs').promises;
const promptGetAsync = require('util').promisify(prompt.get);
const WindowsUtil = require('./Utils/WindowsUtil');
const Tap9Util = require('./Utils/Tap9Util');
const readline = require('readline');
//---------------p2p config -----s-----
const getNatType = require("nat-type-identifier");
const SYMMETRIC_NAT = "Symmetric NAT";
const Node = require('utp-punch');
const stun = require('stun');
const p2pHost = defaultConfig.p2p.host;
checkType(isString, p2pHost, 'p2pHost');

const trackerPort = defaultConfig.p2p.trackerPort;
checkType(isNumber, trackerPort, 'trackerPort');

const isStun = defaultConfig.p2p.isStun;
checkType(isBoolean, isStun, 'isStun');

const sampleCount = defaultConfig.p2p.sampleCount;
checkType(isNumber, sampleCount, 'sampleCount');

const p2pmtu = defaultConfig.p2p.mtu;
checkType(isNumber, p2pmtu, 'p2pmtu');
//---------------p2p config -----e-----

const P2PConnectorResouce = require('./P2P/P2PConnectorResouce');

const Sock5TunnelClient = require('./Socks5Tunnel/Sock5TunnelClient');
program.version('1.0.0');
program
    .option('-t, --test', 'is test')
    .option('-s, --sleep', 'only tell application ,this process will sleep then go on')
    .parse(process.argv);
const options = program.opts();

function setAxiosDefaultConfig(isHttps, host, port, authenKey) {
    axios.defaults.timeout = 5000;
    axios.defaults.baseURL = `http${isHttps?'s':''}://${host}:${port}`;
    logger.info('defaults.baseURL=' + axios.defaults.baseURL);
    axios.defaults.headers['authenKey'] = authenKey;
}


if (defaultConfig.monitor.enabled) {
    // const easyMonitor = require('easy-monitor');
    // easyMonitor('client');
}

let isWorkingFine = true;
let currentClientNatType = null;
const currentClientTunnelsMap = new Map();

/**UTP服务端所创建的UTP Node Server资源 */
const SocketIOCreateUtpServerMap = new Map();

/**本地P2P连接创建时所创建的资源 */
const SocketIOCreateUtpClientMap = new Map();

/**所有创建的Tunnel通讯实例 */
const ALL_TUNNEL_MAP = new Map();

/**所有创建的Connector通讯实例 */
const ALL_CONNECTOR_MAP = new Map();

/**
 * 
 * @param {Socket} socketIOSocket 
 * @param {Number} ownClientId 
 */
async function registerSocketIOEvent(socketIOSocket, ownClientId, authenKey) {

    socketIOSocket.on(commandType.P2P_REQUEST_OPEN, async(data, fn) => {
        if (currentClientTunnelsMap.has(data.targetTunnelId)) {
            let tunnel = currentClientTunnelsMap.get(data.targetTunnelId);
            if (data.targetTunnelId != tunnel.id || data.targetP2PPassword != tunnel.p2pPassword) {
                fn({ success: false, data: null, info: 'targetTunnelId or p2pPassword is not right' });
                return;
            } else {
                if (currentClientNatType === SYMMETRIC_NAT) {
                    fn({ success: false, data: null, info: 'target client is  SYMMETRIC_NAT' });
                    return;
                }
                logger.info(currentClientNatType);
            }
        } else {
            fn({ success: false, data: null, info: 'targetTunnelId not exist' });
            return;
        }
        let connectorHost = data.connectorHost;
        let connectorPort = data.connectorPort;
        let tunnel = currentClientTunnelsMap.get(data.targetTunnelId);
        let server = new Node({ mtu: p2pmtu }, utpSocket => {
            logger.info('utpSocket client is comming');
            //-----------tcpClient-----
            let address = { host: tunnel.localIp, port: tunnel.localPort };
            let tcpClient = net.createConnection(address, () => {
                logger.trace('p2p tcp client has created to ' + JSON.stringify(address));
            });
            //-----------------记录此UtpServer所用tcpclient-----------
            server.TcpClient = tcpClient;
            tcpClient.on('connect', () => {
                logger.trace('p2p tcp client has connected to ' + JSON.stringify(address));

            });
            tcpClient.pipe(utpSocket); //--
            tcpClient.on('close', (hadError) => {
                tempTcpClient = null;
                logger.trace('p2p tcp Client Closed:' + JSON.stringify(address));
                server.close();
            });
            tcpClient.on('error', (err) => {
                tempTcpClient = null;
                logger.warn('p2p tcp Client error: ' + err + " ," + JSON.stringify(address));
                server.close();
            });
            //---------------

            let utpSocketaddress = utpSocket.address();
            utpSocket.pipe(tcpClient); //--
            utpSocket.on('end', () => {
                logger.debug(`p2p client utpserver: remote disconnected  ${utpSocketaddress.address}:${utpSocketaddress.port}`);
                server.close();
                tcpClient.end();
                tcpClient.destroy();
            });

        });

        //-----------------
        if (SocketIOCreateUtpServerMap.has(data.connectorclientId) == false) {
            SocketIOCreateUtpServerMap.set(data.connectorclientId, []);
        }
        SocketIOCreateUtpServerMap.get(data.connectorclientId).push(server);
        //-----------------
        let freeUdpPort = await NetUtil.freeUdpPortAsync();
        server.bind(freeUdpPort);
        await UpnpUtil.addMap(freeUdpPort, freeUdpPort);
        server.listen(async() => {
            let udpSocket = server.getUdpSocket();
            logger.debug('p2p client utpServer is ready,bindPort=' + udpSocket.address().port);

            let msg = JSON.stringify({ authenKey: authenKey, command: 'client_report_tunnel_info' });
            let timer = null;
            let timeout = null;

            let onMessage = (msg, rinfo) => {

                if (rinfo.port === trackerPort) {
                    udpSocket.removeListener('message', onMessage);
                    let message = {};
                    if (isStun == false) {
                        if (timer != null)
                            clearInterval(timer);
                        if (timeout != null)
                            clearTimeout(timeout);
                        const text = msg.toString();
                        message = JSON.parse(text);
                    } else {
                        const res = stun.decode(msg).getXorAddress();
                        message.host = res.address;
                        message.port = res.port;
                    }
                    logger.info(`p2p info:` + JSON.stringify(message))
                    fn({ success: true, data: message, info: 'target client is ready.nat type=' + currentClientNatType });

                    //------------tryConnect2Public---
                    let publicInfo = {
                        address: connectorHost,
                        port: connectorPort
                    }
                    logger.trace(`p2p client utpServer: begin punching a hole to ${publicInfo.address}:${publicInfo.port}...`);

                    server.punch(10, publicInfo.port, publicInfo.address, success => {

                        logger.debug(`p2p client utpServer: punching result: ${success ? 'success' : 'failure'}`);

                        if (!success) {
                            logger.warn(`p2p client punch failed`);
                            server.close();
                            return;
                        }


                        server.on('timeout', () => {
                            logger.warn('p2p client utpServer: connect timeout');
                            server.close();
                        });

                        logger.debug('p2p client utpServer: waiting for the client to connect...');

                    });

                    //
                }
            };

            //---------来至tracker的回应------------------
            udpSocket.on('message', onMessage);

            if (isStun) {
                stun.request(`${p2pHost}:${trackerPort}`, { socket: udpSocket }, (err, res) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        const { address, port } = res.getXorAddress();
                        logger.trace(`your public address ${address}:${port}`);
                    }
                });
            } else {
                timer = setInterval(() => {
                    udpSocket.send(
                        msg,
                        trackerPort,
                        defaultConfig.host,
                        (err) => { logger.warn(`p2p client utpServer  notify to   tracker error: ` + err) }
                    );
                    logger.trace(`p2p client utpServer  notify to   tracker`);
                }, 500);

                timeout = setTimeout(() => {
                    clearInterval(timer);
                    logger.warn('report to tracker timeout,utp failed');
                    server.close();
                    return;
                }, 5 * 1000);
            }
        });

    });

    socketIOSocket.on('client.disconnect', async(data) => {
        logger.debug('client.disconnect=>' + data.clientId);
        logger.debug('SocketIOCreateUtpServerMap.size', SocketIOCreateUtpServerMap.size)
        if (SocketIOCreateUtpServerMap.has(data.clientId)) {
            logger.debug('SocketIOCreateUtpServerMap.delete=>' + data.clientId);
            let array = SocketIOCreateUtpServerMap.get(data.clientId);
            for (let index in array) {
                let item = array[index];
                if (item.TcpClient) {
                    item.TcpClient.end();
                    item.TcpClient.destroy();
                    item.TcpClient = null;
                }
                item.close();
            }
            SocketIOCreateUtpServerMap.delete(data.clientId);
        }

        logger.debug('SocketIOCreateUtpClientMap.size', SocketIOCreateUtpClientMap.size)
        if (SocketIOCreateUtpClientMap.has(data.clientId)) {
            logger.debug('SocketIOCreateUtpClientMap.delete=>' + data.clientId);
            let array = SocketIOCreateUtpClientMap.get(data.clientId);
            for (let index in array) {
                let item = array[index];
                item.TcpSocket.end();
                item.TcpSocket.destroy();
                logger.trace('item.TcpSocket.destroy();')
                item.UtpClient.close();
            }
            SocketIOCreateUtpClientMap.delete(data.clientId);
        }

    });

    socketIOSocket.on('errorToken', async(data) => {
        socketIOSocket.disconnect(true);
        logger.error('error token:' + data.token);
    });

    socketIOSocket.on('disconnecting', (reason) => {
        logger.warn(`socket.io-client disconnecting  reason:` + reason);
        SocketIOCreateUtpServerMap.clear();
        SocketIOCreateUtpClientMap.clear();
        isWorkingFine = false;
    });

    socketIOSocket.on(commandType.DELETE_CLIENT, async(clientId) => {
        logger.trace('delete.client' + clientId);
        PlatfromUtil.processExit();
    });

    socketIOSocket.on(commandType.STOP_TUNNEL, async(data) => {

    });

    socketIOSocket.on(commandType.CLIENT_REPEAT_LOGIN, async(clientId) => {
        logger.trace(commandType.CLIENT_REPEAT_LOGIN + clientId);
        PlatfromUtil.processExit();
    });

    socketIOSocket.on(commandType.DELETE_TUNNEL, async(id) => {
        id = Number.parseInt(id);
        logger.trace(commandType.DELETE_TUNNEL + id);
        let tun = ALL_TUNNEL_MAP.get(id);
        if (tun) {
            tun.stop();
            ALL_TUNNEL_MAP.delete(id);
        } else {
            logger.warn('id=' + id + ",type=" + typeof id);
        }
        currentClientTunnelsMap.delete(id);
    });

    socketIOSocket.on(commandType.START_TUNNEL, async(data) => {
        logger.trace(commandType.START_TUNNEL + data.id);
        //await createTunnel(authenKey, defaultConfig.host, defaultBridgeConfig.port, data, socketIOSocket);
    });

    socketIOSocket.on(commandType.ADD_TUNNEL, async(data) => {
        await createTunnel(authenKey, defaultConfig.host, defaultBridgeConfig.port, data, socketIOSocket);
        currentClientTunnelsMap.set(data.id, data);
    });

    socketIOSocket.on(commandType.DELETE_CONNECTOR, async(id) => {
        let cc = ALL_CONNECTOR_MAP.get(id);
        if (cc) {
            cc.stop();
            ALL_CONNECTOR_MAP.delete(id);
        }
    });
    //   await createConnector(connectorItem, authenKey, socketIOSocket, ownClientId);

    socketIOSocket.on(commandType.ADD_CONNECTOR, async(data) => {
        logger.trace(commandType.ADD_CONNECTOR + JSON.stringify(data));
        await createConnector(data, authenKey, socketIOSocket, ownClientId);
    });

}

/**
 * set current TunnelMap(id,Tunnel)
 * @param {Array<Tunnel>} currentClientTunnels 
 */
function setCurrentClientTunnelsMap(currentClientTunnels) {
    currentClientTunnelsMap.clear();
    for (let item of currentClientTunnels) {
        currentClientTunnelsMap.set(item.id, item);
    }
}

/**
 * check current nat type
 */
async function checkNatType(clientConfig) {
    currentClientNatType = await require('./Utils/StunUtil')({ sampleCount: sampleCount, stunHost: clientConfig.stunHost })
    await updateClientSystemInfo(currentClientNatType, clientConfig.authenKey);
    return currentClientNatType;
}

async function rewriteClientConfig(clientConfig) {
    let rootPath = require('./Common/GlobalData').rootPath;
    const filepath = path.join(rootPath, "config", 'client.json');
    await fs.writeFile(filepath, JSON.stringify(clientConfig));
}

async function main() {

    if (os.platform() === 'win32') {
        let allTaps = await Tap9Util.getAllTap9AdaptersAsync();
        if (allTaps.length == 0) {
            logger.warn('尚未安装网卡驱动,请允许安装');
        }
    }

    trayIcon();
    WindowsUtil.topMost();
    WindowsUtil.disableConsoleInsertEdit();
    let existClientConfig = await ConfigCheckUtil.checkConfigExistAsync('client.json');
    if (existClientConfig === false) {
        logger.error('the client.json file in config directory is not existed');
        return;
    }
    const clientConfig = require('./Common/ClientConfig');
    let authenKey = clientConfig.authenKey;
    if (options.test) {
        authenKey = '742af98b-e977-48a8-b1c8-1a2a091b93a2';
        clientConfig.authenKey = authenKey;
    }
    let firstUse = false;

    if (authenKey === '') {
        let isAdmin = WindowsUtil.isRunAsAdmin();
        logger.log('current app is running as admin:' + isAdmin);
        if (isAdmin == false) {
            await restartApplicationAsAdmin();
            return;
        }
        firstUse = true;
        let url = `http${defaultWebSeverConfig.https?'s':''}://${defaultConfig.host}:${defaultWebSeverConfig.port}/reg.html`;
        let tip = `\n提示：下面将进行设备初始化,如您尚无设备KEY(有了设备KEY您就能使用此系统了),\n请到${url}注册,已为您尝试打开了浏览器\n`;
        console.warn(tip);
        await sleep(1000);
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
        let question = require('util').promisify(rl.question).bind(rl);;
        PlatfromUtil.openDefaultBrowser(url);
        try {
            authenKey = await question('KEY:');
        } catch (err) {
            console.error('录入有误,请重启重试', err);
            return;
        }
        let pattern = /^[a-zA-Z0-9_-]{4,36}$/;
        if (!pattern.test(authenKey)) {
            console.warn('KEY格式有误,请重启重试');
            return;
        }
        authenKey = authenKey.trim();
        clientConfig.authenKey = authenKey;
    }

    WindowsUtil.disableCloseButton();
    setAxiosDefaultConfig(defaultWebSeverConfig.https, defaultConfig.host, defaultWebSeverConfig.port, authenKey);

    if (options.sleep) {
        logger.debug('sleep 1s,then go  on,new pid=' + process.pid);
        await sleep(1000);
    }

    let clientResult = null;
    try {
        clientResult = await getClient(authenKey);
    } catch (error) {
        logger.error('connect to server failed,please waiting,' + error);
        isWorkingFine = false;
        timerCheckServerStatus();
        return;
    }

    if (!clientResult.success) {
        logger.error(clientResult.info);
        PlatfromUtil.processExit();
        return;
    }

    if (firstUse) {
        console.log('下面将安装驱动和防火墙例外,请允许通过');
        await sleep(1000);
        await rewriteClientConfig(clientConfig);
        if (os.platform() === 'win32') {
            //------是否已经有存在的tap
            let allTap9 = await Tap9Util.getAllTap9AdaptersAsync();
            let targetName = 'tap-' + clientResult.data.id;
            let targetAdapter = allTap9.find(function(item) {
                return item.FriendlyName == targetName;
            });

            if (targetAdapter == null || targetAdapter == undefined) {
                await N2NClient.installWinTapAsync();
                await sleep(3000);
                allTap9 = await Tap9Util.getAllTap9AdaptersAsync();
                let changeTap = allTap9.find(function(item) {
                    return item.FriendlyName.startsWith('tap-') === false;
                });
                let oldName = changeTap.FriendlyName;
                await Tap9Util.renameAdapterAsync(oldName, targetName);
            }
            let ok = await require('./Utils/FireWallUtil').addCurrentProgramExceptionAsync('fastnat');
            if (ok === false) {
                logger.warn('添加防火墙fastnat超时，请自行添加');
            }
            let edgePath = N2NClient.getPath();
            ok = await require('./Utils/FireWallUtil').addProgramExceptionAsync('p2p', edgePath);
            if (ok === false) {
                logger.warn('添加防火墙p2p超时，请自行添加');
            }
            ok = await require('./Utils/FireWallUtil').allowIcmpAsync();
            if (ok === false) {
                logger.warn('添加防火墙icmp超时，请自行添加');
            }
            await WindowsUtil.openMstscAsync();
            await WindowsUtil.enableAutoStartAsync();
        }
    }


    checkNatType(clientConfig);
    let currentClientTunnels = clientResult.data.tunnels;
    setCurrentClientTunnelsMap(currentClientTunnels)
    let socketIOSocket = await startConnect2SocketIO(authenKey, clientResult.data.id);
    registerSocketIOEvent(socketIOSocket, clientResult.data.id, authenKey);

    const ownClientId = clientResult.data.id;
    for (const tunnelItem of currentClientTunnels) {
        await createTunnel(authenKey, defaultConfig.host, defaultBridgeConfig.port, tunnelItem, socketIOSocket);
    }
    let connectors = clientResult.data.connectors;
    for (const connectorItem of connectors) {
        await createConnector(connectorItem, authenKey, socketIOSocket, ownClientId);
    }
    await sleep(1000);
    await startEdgeProcessAsync(authenKey);
    timerCheckServerStatus();
}

async function createConnector(connectorItem, authenKey, socketIOSocket, ownClientId) {
    let result = await getClientP2PInfoByTunnelId(authenKey, connectorItem.p2pTunnelId);
    if (result.success) {
        let targetClientId = result.data.clientId;
        let remotePort = result.data.remotePort;
        await startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort, authenKey);
    } else {
        logger.error(result.info);
    }
}
/**
 * create tunnel
 * @param {String} authenKey 
 * @param {Number} defaultConfigHost 
 * @param {Number} defaultBridgeConfigPort 
 * @param {Tunnel} tunnelItem 
 * @param {*} socketIOSocket 
 * @returns 
 */
async function createTunnel(authenKey, defaultConfigHost, defaultBridgeConfigPort, tunnelItem, socketIOSocket) {
    logger.trace(`create tunnel,tunnel.id=${tunnelItem.id},remotePort=${tunnelItem.remotePort},type=${tunnelItem.type}`)
    if (tunnelItem.type === 'http' || tunnelItem.type === 'https') {
        let httpTunnelClient = new HttpTunnelClient(authenKey, tunnelItem, {
            host: defaultConfigHost,
            port: defaultBridgeConfigPort
        });
        await httpTunnelClient.start();
        ALL_TUNNEL_MAP.set(tunnelItem.id, httpTunnelClient);
        return;
    }

    if (tunnelItem.type === 'tcp' || tunnelItem.type === 'p2p') {
        let tcpTunnelClient = new TcpTunnelClient(
            authenKey, {
                host: defaultConfigHost,
                port: defaultBridgeConfigPort
            }, {
                host: tunnelItem.localIp,
                port: tunnelItem.localPort
            }
        );
        await tcpTunnelClient.startTunnel(tunnelItem.id);
        tcpTunnelClient.tcpClient.eventEmitter.on('error', (err) => {
            logger.error('Tcp tunnel server has stoped:' + err);
        });
        tcpTunnelClient.tcpClient.eventEmitter.on('quitClient', (data) => {
            logger.error('process will quit for : ' + data.info);
            PlatfromUtil.processExit();
        });
        ALL_TUNNEL_MAP.set(tunnelItem.id, tcpTunnelClient);
        return;
    }

    if (tunnelItem.type === 'socks5') {
        let sock5TunnelClient = new Sock5TunnelClient(authenKey, tunnelItem, {
            host: defaultConfigHost,
            port: defaultBridgeConfigPort
        });
        await sock5TunnelClient.start();
        ALL_TUNNEL_MAP.set(tunnelItem.id, sock5TunnelClient);
        return;
    }

    if (tunnelItem.type === 'udp') {
        let udpTunnelClient = new UdpTunnelClient(socketIOSocket, tunnelItem);
        udpTunnelClient.start();
        ALL_TUNNEL_MAP.set(tunnelItem.id, udpTunnelClient);
        return;
    }
}

let _timerCheckServerStatusStarted = false;
async function timerCheckServerStatus(seconds = 20) {
    if (_timerCheckServerStatusStarted) {
        return;
    }
    _timerCheckServerStatusStarted = true;
    let timer = setInterval(async() => {
        let serverOk = await checkServerStatus();
        if (serverOk && isWorkingFine == false) {
            isWorkingFine = true;
            clearInterval(timer);
            restartApplication();
        }
    }, seconds * 1000);
    return timer;
}

async function startEdgeProcessAsync(authenKey) {
    let ret = await axios.get('/n2n/api/' + authenKey);
    let result = await ret.data;
    if (result.success) {
        let n2nInfo = result.data;
        N2NClient.startEdge(n2nInfo.clientId, AesUtil.decrypt(n2nInfo.community), n2nInfo.communityKey, n2nInfo.virtualIp, `${n2nInfo.host}:${n2nInfo.port}`, n2nInfo.username, n2nInfo.password);
        logger.trace('start edge success');
    } else {
        logger.warn(result.info);
    }

    //ServiceUtil.installService('fastnat');
}


/**
 * 
 * @param {Connector} connectorItem 
 * @param {Socket} socketIOSocket 
 * @param {Number} ownClientId 
 * @param {Number} targetClientId 
 * @param {Number} remotePort remote tcp port
 * @param {string} authenKey current authenKey
 */
async function startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort, authenKey) {
    let p2pConnectorResouce = new P2PConnectorResouce(connectorItem.id);
    ALL_CONNECTOR_MAP.set(p2pConnectorResouce.ConnectorId, p2pConnectorResouce);
    let server = net.createServer(async(tcpSocket) => {
        let socketAddressInfo = `p2p tcp socket from remoteAddress=${tcpSocket.remoteAddress}:${tcpSocket.remotePort},localAddress=${tcpSocket.localAddress}:${tcpSocket.localPort}`;
        let utpclient = new Node({ mtu: p2pmtu });
        let res = { UtpClient: utpclient, TcpSocket: tcpSocket };
        p2pConnectorResouce.ResSet.add(res);
        tcpSocket.on('close', (hadError) => {
            logger.debug('connector tcpSocket on socket close,hadError=' + hadError);
            utpclient.close();
            tcpSocket.end();
            tcpSocket.destroy();
            p2pConnectorResouce.deleteRes(res);
        });

        tcpSocket.on('end', () => {
            logger.debug(`connector tcpSocket on socket end,` + socketAddressInfo);
            utpclient.close();
            tcpSocket.destroy();
            p2pConnectorResouce.deleteRes(res);
        });

        tcpSocket.on('error', (err) => {
            logger.debug('connector tcpSocket on socket error ' + err);
            utpclient.close();
            tcpSocket.end();
            tcpSocket.destroy();
            p2pConnectorResouce.deleteRes(res);
        });

        tcpSocket.on('timeout', () => {
            logger.debug('connector tcpSocket on socket timeout');
            utpclient.close();
            tcpSocket.end();
            tcpSocket.destroy();
            p2pConnectorResouce.deleteRes(res);
        });



        if (SocketIOCreateUtpClientMap.has(targetClientId) === false) {
            SocketIOCreateUtpClientMap.set(targetClientId, []);
        }

        SocketIOCreateUtpClientMap.get(targetClientId).push(res);

        let freeUdpPort = await NetUtil.freeUdpPortAsync();
        await UpnpUtil.addMap(freeUdpPort, freeUdpPort);

        utpclient.bind(freeUdpPort, async() => {

            let udpSocket = utpclient.getUdpSocket();
            logger.trace('p2p connector utpclient bindPort=' + udpSocket.address().port);

            //--------向tracker汇报--------------------------

            let timer = null;
            let timeout = null;

            let onMessage = (msg, rinfo) => {

                if (rinfo.port === trackerPort) {

                    udpSocket.removeListener('message', onMessage);

                    let message = {};
                    if (isStun == false) {
                        if (timer != null)
                            clearInterval(timer);
                        if (timeout != null)
                            clearTimeout(timeout);
                        const text = msg.toString();
                        message = JSON.parse(text);
                    } else {
                        const res = stun.decode(msg).getXorAddress();
                        message.host = res.address;
                        message.port = res.port;
                    }
                    logger.info(`p2p client remote address info:` + JSON.stringify(message));
                    //通知对应的客户端进行同时打洞操作
                    socketIOSocket.emit(commandType.P2P_REQUEST_OPEN, {
                        targetTunnelId: connectorItem.p2pTunnelId,
                        targetP2PPassword: connectorItem.p2pPassword,
                        connectorclientId: ownClientId,
                        targetClientId: targetClientId,
                        connectorHost: message.host,
                        connectorPort: message.port,
                        socketIOSocketId: socketIOSocket.id
                    }, (backData) => {
                        logger.trace('backData:' + JSON.stringify(backData));
                        if (backData.success == false) { //因对方不支持而不能创建P2P
                            logger.warn(`can't connect to p2p client for:` + backData.info);
                            utpclient.close();
                            logger.warn('start failover to tcp tunnel');
                            let tcpClient = failoverTcp(remotePort, tcpSocket);
                            return;
                        }
                        //---------tryConnect2Public------
                        let server = { address: backData.data.host, port: backData.data.port };
                        logger.debug(`p2p connector: begin punching a hole to ${server.address}:${server.port}...`);
                        utpclient.punch(10, server.port, server.address, success => {

                            logger.debug(`p2p connector: punching result: ${success ? 'success' : 'failure'}`);

                            if (!success) {
                                utpclient.close();
                                let tcpClient = failoverTcp(remotePort, tcpSocket);
                                return;
                            }

                            utpclient.on('timeout', () => {
                                logger.trace('p2p connector: connect timeout');
                                utpclient.close();
                                tcpSocket.end();
                                tcpSocket.destroy();
                            });

                            utpclient.connect(server.port, server.address, (utpSocket) => {
                                logger.debug('p2p connector:  has connected to the p2p client');
                                //let address = utpSocket.address();
                                utpSocket.pipe(tcpSocket);
                                utpSocket.on('end', () => {
                                    logger.debug('p2p connector: utpSocket end');
                                    utpclient.close();
                                    tcpSocket.end();
                                    tcpSocket.destroy();
                                    return;
                                });
                                //------------------这个时候的tcpsocket才能正式使用---------------
                                tcpSocket.pipe(utpSocket); //--

                            });
                        });
                        //------------------
                    });
                }
            };
            //---------来至tracker的回应------------------
            udpSocket.on('message', onMessage);

            if (isStun) {
                stun.request(`${p2pHost}:${trackerPort}`, { socket: udpSocket }, (err, res) => {
                    if (err) {
                        logger.error(`stun.request error,` + err);
                    } else {
                        const { address, port } = res.getXorAddress();
                        logger.trace(`local public address is ${address}:${port}`);
                    }
                });
            } else {
                let msg = JSON.stringify({ authenKey: authenKey, command: 'connector_report_tunnel_info' });
                timer = setInterval(() => {
                    udpSocket.send(
                        msg,
                        trackerPort,
                        defaultConfig.host,
                        (err) => { logger.debug('p2p connector  notify to   tracker error: ' + err) }
                    );
                }, 500);

                timeout = setTimeout(() => {
                    clearInterval(timer);
                    logger.warn('report to tracker timeout,utp failed');
                    utpclient.close();
                    tcpSocket.end();
                    return;
                }, 5 * 1000);
            }

        });

    });
    server.on('close', () => {
        logger.debug("p2p local tcp  server closed, port=" + connectorItem.localPort);
    });
    server.listen(connectorItem.localPort, () => {
        logger.debug("p2p local tcp  server started at port=" + connectorItem.localPort);
    });
    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            logger.error('p2p local tcp  server address in use,connectorItem.localPort=' + connectorItem.localPort);
        } else {
            logger.error(e);
        }
        server.close();
    });

    p2pConnectorResouce.TcpServer = server;
}


async function getClient(authenKey) {
    let ret = await axios.get('/client/api/' + authenKey);
    let result = await ret.data;
    return result;
}


async function getClientP2PInfoByTunnelId(authenKey, tunnelId) {
    let ret = await axios.get('/client/api/getClientP2PInfoByTunnelId', {
        params: {
            authenKey: authenKey,
            tunnelId: tunnelId,
        }
    });
    let result = await ret.data;
    return result;
}



async function checkServer(params) {
    try {
        let ret = await axios.get('/checkServerStatus');
        let result = await ret.data;
        return result.success;
    } catch (error) {
        logger.trace('checkServerStatus error' + error);
        isWorkingFine = false;
        return false;
    }
}
async function checkServerStatus() {
    let errorCount = 0;
    while (errorCount < 3) {
        let ok = await checkServer();
        if (ok == false) {
            errorCount = errorCount + 1;
        } {
            return true;
        }
    }
    return false;
}

main();

function failoverTcp(remotePort, tcpSocket) {
    let address = { host: defaultConfig.host, port: remotePort };
    let addressStr = JSON.stringify(address);
    let tcpClient = net.createConnection(address, () => {
        logger.trace('p2p tcp client has created to ' + addressStr);

    });
    tcpClient.on('connect', () => {
        tcpClient.pipe(tcpSocket);
        tcpSocket.pipe(tcpClient);
    });

    tcpClient.on('close', (hadError) => {
        logger.trace('Tcp Client Closed:' + addressStr + `,hadError=${hadError}`);
        tcpSocket.end();
        tcpSocket.destroy();
    });

    tcpClient.on('error', (err) => {
        tcpSocket.end();
        tcpSocket.destroy();
        logger.trace('Tcp Client error: ' + err + " ," + addressStr);
    });

    tcpSocket.on('close', (hadError) => {
        tcpClient.end();
        tcpClient.destroy();
    });

    tcpSocket.on('error', (err) => {
        logger.warn('failoverTcp.tcpSocket.error' + err);
        tcpClient.end();
        tcpClient.destroy();
    });
}


async function trayIcon(params) {
    if (os.arch().indexOf('arm') > -1 || os.arch().indexOf('mip') > -1) {
        return;
    }

    const fs = require('fs');
    const readFile = require('util').promisify(fs.readFile);
    let ext = '.png'
    if (os.platform() == 'win32') {
        ext = '.ico';
    }
    let imgPath = path.join(rootPath, 'config', 'img', 'tray');

    let bitmap = await readFile(imgPath + ext);
    const basePath = getPluginPath('tray', 'client');
    let trayPath = path.join(basePath, `tray`);
    if (os.platform() === 'win32') {
        trayPath += '.exe';
    }
    let base64str = Buffer.from(bitmap, 'binary').toString('base64'); // base64编码

    const systray = new SysTray({
        menu: {
            // using .png icon in macOS/Linux, but .ico format in windows
            icon: base64str,
            title: "fastnat",
            tooltip: "fastnat",
            items: [{
                title: "系统管理",
                tooltip: "manage",
                checked: false,
                enabled: true
            }, {
                title: "显示日志",
                tooltip: "display",
                // checked is implement by plain text in linux
                checked: true,
                enabled: true
            }, {
                title: "退出系统",
                tooltip: "quit",
                checked: false,
                enabled: true
            }]
        },
        binPath: trayPath
    });

    systray.onClick(action => {
        if (action.seq_id === 1) {

            if (action.item.checked) {
                require('./Utils/WindowsUtil').hideConsole();
            } else {
                require('./Utils/WindowsUtil').showConsole();
            }

            systray.sendAction({
                type: 'update-item',
                item: {
                    ...action.item,
                    checked: !action.item.checked,
                },
                seq_id: action.seq_id,
            });

        } else if (action.seq_id === 0) {
            // opens the url in the default browser 
            PlatfromUtil.openDefaultBrowser(axios.defaults.baseURL);

        } else if (action.seq_id === 2) {
            PlatfromUtil.processExit(0);
        }
    });
}


async function updateClientSystemInfo(natType, authenKey) {
    let osInfo = {
        cpuCount: os.cpus().length,
        arch: os.arch(),
        platform: os.platform()
    };
    let data = {
        os: JSON.stringify(osInfo),
        natType: natType,
        mac: getMAC()
    }
    let result = await (await axios.put('/client/api/' + authenKey, data)).data;
    return result;
}

function restartApplication() {
    let exe = process.argv.shift();
    let args = [];

    for (const item of process.argv) {
        args.push(item);
    }

    if (!args.includes('-s')) {
        args.push('-s')
    }
    logger.debug("will restart ,current pid= " + process.pid);
    logger.debug(args.toString());
    logger.debug('exe:' + exe);

    setTimeout(function() {
        require("child_process").spawn(exe, args, {
            cwd: rootPath,
            detached: true,
            stdio: "inherit"
        });
        PlatfromUtil.processExit();
    }, 500);
}

function getJSNameFromProcess() {
    for (const item of process.argv) {
        if (item.endsWith(".js")) {
            console.log(item);
            return item;
        }
    }
    return "client.js";
}

async function restartApplicationAsAdmin(params) {
    if (os.platform() === 'win32') {
        //  const elevate = require('node-windows').elevate;
        let cmd = `${getJSNameFromProcess()} -s`;
        WindowsUtil.runCurrentAppAsAdmin(cmd);
        PlatfromUtil.processExit();
    } else {
        logger.error('尚未实现')
        restartApplication();
    }
}

process.on("exit", function(code) {

});


let _SIGINT_Started = false;
process.on('SIGINT', function() {
    if (_SIGINT_Started === false) {
        _SIGINT_Started = true;
        logger.warn('process exit by SIGINT');
        PlatfromUtil.processExit();
    } else {
        logger.trace('process is closing,please waiting...');
    }
});

process.on("uncaughtException", function(err) {
    console.error(err.stack);
    logger.error(err);
});