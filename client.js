global.programType = 'client';

const clientJsonfilepath = require('path').join(require('./Common/GlobalData').rootPath, "config", 'client.json');

if (require('fs').existsSync(clientJsonfilepath) === false) {
    console.log('the client.json file in config directory is not exist,we will use default config');
    let clientConfig = {
        authenKey: "",
        upnpEnabled: false,
        serverUrl: "https://fastnat.club:1443",
        log: { level: "trace", enableCallStack: false, http: false }
    }
    require('fs').writeFileSync(clientJsonfilepath, JSON.stringify(clientConfig));
}

const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
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
const GlobalData = require('./Common/GlobalData');
const version = GlobalData.version;
const rootPath = GlobalData.rootPath;
const SysTray = require('./SysTray/SysTray');
const getPluginPath = require('./Utils/PluginUtil').getPluginPath;
const fs = require('fs').promises;
const WindowsUtil = require('./Utils/WindowsUtil');
const Tap9Util = require('./Utils/Tap9Util');
const readline = require('readline');
const { v4: uuidv4 } = require('uuid');
const UpdateUtil = require('./Utils/UpdateUtil');
//---------------p2p config -----s-----
const getNatType = require("nat-type-identifier");
const SYMMETRIC_NAT = "Symmetric NAT";
const Node = require('utp-punch');
const stun = require('stun');
const FileBrowserUtil = require('./Utils/FileBrowserUtil');
const pkill = require('pkill');
//---------------p2p config -----e-----

const P2PConnectorResouce = require('./P2P/P2PConnectorResouce');

const Sock5TunnelClient = require('./Socks5Tunnel/Sock5TunnelClient');
// const rcpClient = new RpCTcpClient({ host: defaultConfig.host, port: defaultBridgeConfigRpcPort });

program.version(GlobalData.version);
program
    .option('-t, --test', 'is test')
    .option('-k, --kill', 'stop self')
    .option('-s, --sleep', 'only tell application ,this process will sleep and then go on')
    .parse(process.argv);
const options = program.opts();

function setAxiosDefaultConfig(serverUrl, authenKey) {
    axios.defaults.timeout = 5000;
    axios.defaults.baseURL = serverUrl;
    logger.info('defaults.baseURL=' + axios.defaults.baseURL);
    axios.defaults.headers['authenKey'] = authenKey;
}



let isWorkingFine = true;
let currentClientNatType = null;
const currentClientTunnelsMap = new Map();

/**UTP?????????????????????UTP Node Server?????? */
const SocketIOCreateUtpServerMap = new Map();

/**??????P2P????????????????????????????????? */
const SocketIOCreateUtpClientMap = new Map();

/**???????????????Tunnel???????????? */
const ALL_TUNNEL_MAP = new Map();

/**???????????????Connector???????????? */
const ALL_CONNECTOR_MAP = new Map();


/**
 * 
 * @param {*} returnData 
 * @param {Socket} socketIOSocket 
 * @param {*} fromSocketIoClientSocketId 
 */
function p2pOpenReturn(returnData, socketIOSocket, data) {
    socketIOSocket.emit(commandType.P2P_REQUEST_OPEN_RETURN, returnData, data.uuid, data.serverPid);
}

/**
 * 
 * @param {Socket} socketIOSocket 
 * @param {Number} ownClientId 
 */
async function registerSocketIOEvent(socketIOSocket, ownClientId, authenKey, defaultConfig) {
    let defaultBridgeConfig = defaultConfig.bridge;

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

    socketIOSocket.on(commandType.P2P_REQUEST_OPEN, async(data) => { //fn
        if (currentClientTunnelsMap.has(data.targetTunnelId)) {
            let tunnel = currentClientTunnelsMap.get(data.targetTunnelId);
            if (data.targetTunnelId != tunnel.id || data.targetP2PPassword != tunnel.p2pPassword) {
                p2pOpenReturn({ success: false, data: null, info: 'targetTunnelId or p2pPassword is not right' }, socketIOSocket, data);
                return;
            } else {
                if (currentClientNatType === SYMMETRIC_NAT) {
                    p2pOpenReturn({ success: false, data: null, info: 'target client is  SYMMETRIC_NAT' }, socketIOSocket, data);
                    return;
                }
                logger.info(currentClientNatType);
            }
        } else {
            p2pOpenReturn({ success: false, data: null, info: 'targetTunnelId not exist' }, socketIOSocket, data);
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
            //-----------------?????????UtpServer??????tcpclient-----------
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
                    logger.info(`p2p info:` + JSON.stringify(message));
                    //  fn({ success: true, data: message, info: 'target client is ready.nat type=' + currentClientNatType });
                    p2pOpenReturn({ success: true, data: message, info: 'target client is ready.nat type=' + currentClientNatType }, socketIOSocket, data);
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

            //---------??????tracker?????????------------------
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
async function checkNatType(clientConfig, defaultConfig) {
    const sampleCount = defaultConfig.p2p.sampleCount;
    currentClientNatType = await require('./Utils/StunUtil')({ sampleCount: sampleCount, p2pHost: defaultConfig.p2p.host })
    await updateClientSystemInfo(currentClientNatType, clientConfig.authenKey);
    return currentClientNatType;
}

async function rewriteClientConfig(clientConfig) {
    let rootPath = require('./Common/GlobalData').rootPath;
    const filepath = path.join(rootPath, "config", 'client.json');
    await fs.writeFile(filepath, JSON.stringify(clientConfig));
}
/**
 * 
 * @param {string} authenKey 
 * @returns 
 */
function getScretAuthenKey(authenKey) {
    if (authenKey && authenKey.length > 8) {
        let first5 = authenKey.substring(0, 8);
        return authenKey.replace(first5, '*****');
    }
    return authenKey;
}

function readLineData(questionTip = '????????????????????????,?????????????????????Key:') {
    let p = new Promise((resolve, reject) => {
        let rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })

        rl.question(questionTip, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
    return p;
}
async function main() {
    if (options.kill) {
        if (os.platform() === 'win32') {
            return;
        }
        pkill('edge', function(err, validPid) {
            if (err) {
                console.log(err);
                return;
            }
            console.log('edge killed,pid=' + validPid);
        });
        pkill('filebrowser', function(err, validPid) {
            if (err) {
                console.log(err);
                return;
            }
            console.log('filebrowser killed,pid=' + validPid);
        });
        pkill('fastnat', function(err, validPid) {
            if (err) {
                console.log(err);
                return;
            }
            console.log('fastnat killed,pid=' + validPid);
        });
    }


    if (os.platform() === 'win32') {
        WindowsUtil.hideConsole();
        let allTaps = await Tap9Util.getAllTap9AdaptersAsync();
        if (allTaps.length == 0) {
            logger.warn('????????????????????????,???????????????');
        }
    }
    UpdateUtil.downUpdatePackageIfExist();

    WindowsUtil.setConsoleTitle('fastnat');

    WindowsUtil.disableConsoleInsertEdit();

    const clientConfig = require('./Common/ClientConfig');
    let authenKey = clientConfig.authenKey;
    if (options.test) {
        authenKey = '5cee9c48-c6d7-4eec-806d-206956699be4';
        clientConfig.authenKey = authenKey;
    }
    let firstUse = authenKey === '';
    await trayIcon(firstUse, authenKey);
    if (firstUse) {
        WindowsUtil.showConsole();
        let isAdmin = WindowsUtil.isRunAsAdmin();
        logger.log('current app is running as admin:' + isAdmin);
        if (isAdmin == false) {
            await restartApplicationAsAdmin();
            return;
        }

        let url = `${clientConfig.serverUrl}/reg.html`;
        let tip = `\n???????????????????????????????????????,??????????????????KEY(????????????KEY???????????????????????????),\n??????${url}??????,?????????????????????????????????\n`;
        console.warn(tip);
        await sleep(1000);


        PlatfromUtil.openDefaultBrowser(url);
        WindowsUtil.topMost();
        authenKey = await readLineData();
        WindowsUtil.noTopMost();
        let pattern = /^[a-zA-Z0-9_-]{4,36}$/;
        if (!pattern.test(authenKey)) {
            console.warn('KEY????????????,???????????????');
            return;
        }
        authenKey = authenKey.trim();
        clientConfig.authenKey = authenKey;
    }

    WindowsUtil.disableCloseButton();
    setAxiosDefaultConfig(clientConfig.serverUrl, authenKey);

    if (options.sleep) {
        logger.debug('sleep 3s,then go  on,new pid=' + process.pid);
        await sleep(3000);
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
    let theKey = getScretAuthenKey(authenKey);
    WindowsUtil.setConsoleTitle(`fastnat(${theKey})`);
    let defaultConfig = await getDefaultConfig(authenKey);

    let defaultBridgeConfig = defaultConfig.bridge;
    let defaultWebSeverConfig = defaultConfig.webserver;

    let ioUrl = `http${defaultWebSeverConfig.https ? 's' : ''}://${defaultConfig.host}:${defaultWebSeverConfig.socketioPort}`;

    if (firstUse) {
        await FileBrowserUtil.initAsync(authenKey);
        console.warn('????????????????????????????????????????????????,???????????????,???????????????0????????????,????????????');
        await sleep(1000);
        await rewriteClientConfig(clientConfig);
        if (os.platform() === 'win32') {
            //------????????????????????????tap
            let allTap9 = await Tap9Util.getAllTap9AdaptersAsync();
            let targetName = 'tap-' + clientResult.data.id;
            let targetAdapter = allTap9.find(function(item) {
                return item.FriendlyName == targetName;
            });

            if (targetAdapter == null || targetAdapter == undefined) {
                console.log('start to install driver');
                N2NClient.installWinTap();
                WindowsUtil.noTopMost();
                await sleep(1500);
                WindowsUtil.autoClickConfirmButton();
                console.log('install driver success');
                await sleep(2000);
                allTap9 = await Tap9Util.getAllTap9AdaptersAsync();
                let changeTap = allTap9.find(function(item) {
                    return item.FriendlyName.startsWith('tap-') === false;
                });
                if (changeTap == null || changeTap == undefined) {
                    await sleep(2000);
                    changeTap = allTap9.find(function(item) {
                        return item.FriendlyName.startsWith('tap-') === false;
                    });
                }
                let oldName = changeTap.FriendlyName;
                await Tap9Util.renameAdapterAsync(oldName, targetName);
            }
            const FireWallUtil = require('./Utils/FireWallUtil');
            let ok = await FireWallUtil.addCurrentProgramExceptionAsync('fastnat');
            if (ok === false) {
                logger.warn('???????????????fastnat????????????????????????');
            }
            let edgePath = N2NClient.getPath();
            ok == await FireWallUtil.addProgramExceptionAsync('p2p', edgePath);
            if (ok === false) {
                logger.warn('???????????????p2p????????????????????????');
            }
            ok == await FireWallUtil.allowIcmpAsync();
            if (ok === false) {
                logger.warn('???????????????icmp????????????????????????');
            }
            await WindowsUtil.openMstscAsync();
            await WindowsUtil.enableAutoStartAsync();
            await FireWallUtil.addPortAsync('remote', 'tcp', 3389);
            await FireWallUtil.addPortAsync('remote', 'tcp', 7777);
            await FireWallUtil.addPortAsync('remote', 'tcp', 8050);


        }
    } else {
        if (os.platform() === 'win32') {
            //------????????????????????????tap
            let allTap9 = await Tap9Util.getAllTap9AdaptersAsync();
            let targetName = 'tap-' + clientResult.data.id;
            let targetAdapter = allTap9.find(function(item) {
                return item.FriendlyName == targetName;
            });
            if (targetAdapter == null || targetAdapter == undefined) {
                logger.warn(`?????????tap??????????????????,targetName=` + targetName);
                clientConfig.authenKey = '';
                await rewriteClientConfig(clientConfig);
                await restartApplicationAsAdmin();
                return;
            }
        }
    }
    WindowsUtil.topMost();
    checkNatType(clientConfig, defaultConfig);
    let currentClientTunnels = clientResult.data.tunnels;
    setCurrentClientTunnelsMap(currentClientTunnels)

    let socketIOSocket = await startConnect2SocketIO(authenKey, clientResult.data.id, ioUrl);
    registerSocketIOEvent(socketIOSocket, clientResult.data.id, authenKey, defaultConfig);

    const ownClientId = clientResult.data.id;

    for (const tunnelItem of currentClientTunnels) {
        await createTunnel(authenKey, defaultConfig.host, defaultBridgeConfig.port, tunnelItem, socketIOSocket);
    }
    let connectors = clientResult.data.connectors;
    for (const connectorItem of connectors) {
        await createConnector(connectorItem, authenKey, socketIOSocket, ownClientId, defaultConfig);
    }
    await sleep(1000);
    await startEdgeProcessAsync(authenKey);

    FileBrowserUtil.startAsync(authenKey, clientResult.userType);
    timerCheckServerStatus();
}

async function createConnector(connectorItem, authenKey, socketIOSocket, ownClientId, defaultConfig) {
    let result = await getClientP2PInfoByTunnelId(authenKey, connectorItem.p2pTunnelId);
    if (result.success) {
        let targetClientId = result.data.clientId;
        let remotePort = result.data.remotePort;
        await startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort, authenKey, defaultConfig);
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
        let status = await checkServerStatus();
        if (status && isWorkingFine == false) {
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
}

async function processBackData(backData, tcpSocket, utpclient, remotePort, defaultConfig) {
    logger.trace('backData:' + JSON.stringify(backData));
    if (backData.success == false) { //?????????????????????????????????P2P
        logger.warn(`can't connect to p2p client for:` + backData.info);
        utpclient.close();
        logger.warn('start failover to tcp tunnel');
        let tcpClient = failoverTcp(remotePort, tcpSocket, defaultConfig);
        return;
    }
    //---------tryConnect2Public------
    let server = { address: backData.data.host, port: backData.data.port };
    logger.debug(`p2p connector: begin punching a hole to ${server.address}:${server.port}...`);
    utpclient.punch(10, server.port, server.address, success => {

        logger.debug(`p2p connector: punching result: ${success ? 'success' : 'failure'}`);

        if (!success) {
            utpclient.close();
            let tcpClient = failoverTcp(remotePort, tcpSocket, defaultConfig);
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
            //------------------???????????????tcpsocket??????????????????---------------
            tcpSocket.pipe(utpSocket); //--
        });
    });
    //------------------
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
async function startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort, authenKey, defaultConfig) {
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

            //--------???tracker??????--------------------------

            let timer = null;
            let timeout = null;

            let onMessage = async(msg, rinfo) => {
                if (rinfo.port === trackerPort) {
                    logger.trace('remove onMessage');
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
                    //????????????????????????????????????????????????
                    let reqData = {
                        targetTunnelId: connectorItem.p2pTunnelId,
                        targetP2PPassword: connectorItem.p2pPassword,
                        connectorclientId: ownClientId,
                        targetClientId: targetClientId,
                        connectorHost: message.host,
                        connectorPort: message.port,
                        socketIOSocketId: socketIOSocket.id,
                        uuid: uuidv4()
                    };
                    socketIOSocket.emit(commandType.P2P_REQUEST_OPEN, reqData, (backData) => {
                        processBackData(backData, tcpSocket, utpclient, remotePort, defaultConfig);
                    });

                    // let backData = await rcpClient.invoke('RpcTcpServer', 'p2pOpenRequest', [reqData]);
                    // processBackData(backData, tcpSocket, utpclient, remotePort);
                } else {
                    logger.trace('rinfo.port !== trackerPort');
                }
            };
            //---------??????tracker?????????------------------
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

let _defaultConfig = null;
async function getDefaultConfig(authenKey) {
    if (_defaultConfig) {
        return _defaultConfig;
    }
    let ret = await axios.get('/client/api/getDefaultConfig/' + authenKey);
    let result = await ret.data;
    _defaultConfig = result.data;
    return _defaultConfig;
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



async function checkServer() {
    try {
        let ret = await axios.get('/checkServerStatus');
        return true;
    } catch (error) {
        logger.trace('checkServer function error:' + error);
        isWorkingFine = false;
        return false;
    }
}
async function checkServerStatus() {
    let ok = await checkServer();
    if (ok == false) {
        ok = await checkServer();
        return ok;
    }
    return ok;
}

main();

function failoverTcp(remotePort, tcpSocket, defaultConfig) {

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


async function trayIcon(isConsoleDisplay = false, authenKey) {

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
    let base64str = Buffer.from(bitmap, 'binary').toString('base64'); // base64??????
    const menu = {
        // using .png icon in macOS/Linux, but .ico format in windows
        icon: base64str,
        title: "fastnat",
        tooltip: "fastnat",
        items: [{
                title: "????????????",
                tooltip: "manage",
                checked: false,
                enabled: true
            }, {
                title: "????????????",
                tooltip: "display",
                // checked is implement by plain text in linux
                checked: isConsoleDisplay,
                enabled: true
            },
            {
                title: "????????????????????????",
                tooltip: "display",
                enabled: true
            }, {
                title: "????????????",
                tooltip: "quit",
                checked: false,
                enabled: true
            }
        ]
    };
    const systray = new SysTray({
        menu: menu,
        binPath: trayPath
    });
    const lastId = menu.items.length - 1;
    systray.onClick(action => {

        if (action.item.title === '????????????') {
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
        } else if (action.item.title === '????????????') {
            // opens the url in the default browser 
            PlatfromUtil.openDefaultBrowser(axios.defaults.baseURL);

        } else if (action.item.title === '????????????????????????') {
            // opens the url in the default browser 
            if (authenKey != null && authenKey != '') {
                let url = `${axios.defaults.baseURL}/system/api/filebrowser?authenKey=${authenKey}`;
                PlatfromUtil.openDefaultBrowser(url);
            }
        } else if (action.seq_id === lastId) {
            PlatfromUtil.processExit(1700);
        }
    });
    return systray;
}

const dealMem = (mem) => {
    let G = 0,
        M = 0,
        KB = 0;
    (mem > (1 << 30)) && (G = (mem / (1 << 30)).toFixed(2));
    (mem > (1 << 20)) && (mem < (1 << 30)) && (M = (mem / (1 << 20)).toFixed(2));
    (mem > (1 << 10)) && (mem > (1 << 20)) && (KB = (mem / (1 << 10)).toFixed(2));
    return G > 0 ? G + 'G' : M > 0 ? M + 'M' : KB > 0 ? KB + 'KB' : mem + 'B';
};


async function updateClientSystemInfo(natType, authenKey) {

    let osInfo = {
        cpuCount: os.cpus().length,
        osType: os.type(),
        totalmem: dealMem(os.totalmem())
    };

    let data = {
        os: JSON.stringify(osInfo),
        natType: natType,
        mac: getMAC(),
        arch: os.arch(),
        platform: os.platform(),
        osReleaseVersion: os.release(),
        version: version,
        hostName: os.hostname()
    }
    let result = await (await axios.put('/client/api/' + authenKey, data)).data;
    return result;
}

function restartApplication(waitTime = 1700) {
    let exe = process.argv.shift();
    let args = [];

    for (const item of process.argv) {
        args.push(item);
    }

    if (!args.includes('-s')) {
        args.push('-s')
    }

    logger.debug("app will restart ,old pid= " + process.pid);
    logger.debug("args:" + args.toString());
    logger.debug('app exe:' + exe);

    let notWindows = os.platform() != 'win32';

    const subprocess = require("child_process").spawn(exe, args, {
        cwd: rootPath,
        detached: true,
        shell: notWindows,
        windowsHide: notWindows,
        stdio: 'ignore'
    });

    subprocess.unref();
    PlatfromUtil.processExit(waitTime);
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

async function restartApplicationAsAdmin(waitTime = 0) {
    if (os.platform() === 'win32') {
        //  const elevate = require('node-windows').elevate;
        let cmd = `${getJSNameFromProcess()} -s`;
        WindowsUtil.runCurrentAppAsAdmin(cmd);
        PlatfromUtil.processExit(waitTime);
    } else {
        logger.error('not implement for this platform');
        restartApplication(waitTime);
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