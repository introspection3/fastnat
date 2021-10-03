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
const Piscina = require('piscina');
const path = require('path');
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

//------------------netbuilding---e-------
const Sock5TunnelClient = require('./Socks5Tunnel/Sock5TunnelClient');
program.version('1.0.0');
program
    .option('-t, --test', 'is test')
    .option('-r, --restart', 'only tell application ,this is a restart process')
    .parse(process.argv);
const options = program.opts();

function setAxiosDefaultConfig(isHttps, host, port, authenKey) {
    axios.defaults.timeout = 5000;
    axios.defaults.baseURL = `http${isHttps?'s':''}://${host}:${port}`;
    logger.info('axios.defaults.baseURL=' + axios.defaults.baseURL);
    axios.defaults.headers['authenKey'] = authenKey;
}


if (defaultConfig.monitor.enabled) {
    // const easyMonitor = require('easy-monitor');
    // easyMonitor('client');
}

let isWorkingFine = true;
let currentClientNatType = null;
const currentClientTunnelsMap = new Map();
const SocketIOCreateUtpServerMap = new Map();
const SocketIOCreateUtpClientMap = new Map();


/**
 * 
 * @param {Socket} socketIOSocket 
 * @param {Number} ownClientId 
 */
async function registerSocketIOEvent(socketIOSocket, ownClientId, authenKey) {

    socketIOSocket.on('p2p.request.open', async(data, fn) => {
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
                console.log('item.TcpSocket.destroy();')
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

    socketIOSocket.on('stop.tunnel', async(data, fn) => {

    });

    socketIOSocket.on('delete.tunnel', async(data, fn) => {

    });

    socketIOSocket.on('start.tunnel', async(data, fn) => {

    });

    socketIOSocket.on('add.tunnel', async(data, fn) => {

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
    const piscina = new Piscina({
        filename: path.join(process.cwd(), 'Utils', 'StunUtil.js')
    });
    currentClientNatType = await piscina.run({ sampleCount: sampleCount, stunHost: clientConfig.stunHost })
    logger.info('current nat\'s type:', currentClientNatType);
    await updateClientSystemInfo(currentClientNatType, clientConfig.authenKey);
    return currentClientNatType;
}

async function main() {
    trayIcon();
    let existClientConfig = await ConfigCheckUtil.checkConfigExistAsync('client.json');
    if (existClientConfig === false) {
        logger.error('the client.json file in config directory not exist');
        return;
    }
    const clientConfig = require('./Common/ClientConfig');
    let authenKey = clientConfig.authenKey;
    if (options.test) {
        authenKey = '742af98b-e977-48a8-b1c8-1a2a091b93a2';
    }

    setAxiosDefaultConfig(defaultWebSeverConfig.https, defaultConfig.host, defaultWebSeverConfig.port, authenKey);

    if (options.restart) {
        logger.debug('sleep 1s,then restart,new pid=' + process.pid);
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
    checkNatType(clientConfig);
    if (!clientResult.success) {
        logger.error(clientResult.info);
        return;
    }

    let currentClientTunnels = clientResult.data.tunnels;
    setCurrentClientTunnelsMap(currentClientTunnels)
    let socketIOSocket = await startConnect2SocketIO(authenKey, clientResult.data.id);
    registerSocketIOEvent(socketIOSocket, clientResult.data.id, authenKey);

    const ownClientId = clientResult.data.id;
    for (const tunnelItem of currentClientTunnels) {

        if (tunnelItem.type === 'http' || tunnelItem.type === 'https') {
            let httpTunnelClient = new HttpTunnelClient(authenKey, tunnelItem, {
                host: defaultConfig.host,
                port: defaultBridgeConfig.port
            });
            await httpTunnelClient.start();
            continue;
        }

        if (tunnelItem.type === 'tcp' || tunnelItem.type === 'p2p') {
            let tcpTunnelClient = new TcpTunnelClient(
                authenKey, {
                    host: defaultConfig.host,
                    port: defaultBridgeConfig.port
                }, {
                    host: tunnelItem.localIp,
                    port: tunnelItem.localPort
                }
            );
            await tcpTunnelClient.startTunnel(tunnelItem.id);
            tcpTunnelClient.tcpClient.eventEmitter.on('error', (err) => {
                isWorkingFine = false;
                logger.error('Tcp tunnel server has stoped:' + err);
            });
            tcpTunnelClient.tcpClient.eventEmitter.on('quitClient', (data) => {
                isWorkingFine = false;
                logger.error('process will quit for : ' + data.info);
                PlatfromUtil.processExit();
            });
            continue;
        }

        if (tunnelItem.type === 'socks5') {
            let sock5TunnelClient = new Sock5TunnelClient(authenKey, tunnelItem, {
                host: defaultConfig.host,
                port: defaultBridgeConfig.port
            });
            await sock5TunnelClient.start();
            continue;
        }

        if (tunnelItem.type === 'udp') {
            let udpTunnelClient = new UdpTunnelClient(socketIOSocket, tunnelItem);
            udpTunnelClient.start();
            continue;
        }

    }
    let connectors = clientResult.data.connectors;
    for (const connectorItem of connectors) {
        let result = await getClientP2PInfoByTunnelId(authenKey, connectorItem.p2pTunnelId);
        if (result.success) {
            let targetClientId = result.data.clientId;
            let remotePort = result.data.remotePort;
            startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort, authenKey);
        } else {
            logger.error(result.info);
        }
    }


    startEdgeProcessAsync(authenKey)
    timerCheckServerStatus();
}

let _timerCheckServerStatusStarted = false;
async function timerCheckServerStatus(seconds = 10) {
    if (_timerCheckServerStatusStarted) {
        return;
    }
    _timerCheckServerStatusStarted = true;
    let timer = setInterval(async() => {
        let serverOk = await checkServerStatus();
        if (serverOk && isWorkingFine == false) {
            isWorkingFine = true;
            restartApplication();
        }
    }, seconds * 1000);
    return timer;
}

async function startEdgeProcessAsync(authenKey) {
    let ret = await axios.get('/n2n/' + authenKey);
    let result = await ret.data;
    if (result.success) {
        let n2nInfo = result.data;
        console.log(JSON.stringify(n2nInfo))
        N2NClient.startEdge(AesUtil.decrypt(n2nInfo.community), n2nInfo.communityKey, n2nInfo.virtualIp, `${n2nInfo.host}:${n2nInfo.port}`, n2nInfo.username, n2nInfo.password);
    } else {
        logger.warn(result.info);
    }

    // ServiceUtil.installService('fastnat', process.execPath);
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

    let server = net.createServer(async(tcpSocket) => {
        let socketAddressInfo = `remoteAddress=${tcpSocket.remoteAddress}:${tcpSocket.remotePort},localAddress=${tcpSocket.localAddress}:${tcpSocket.localPort}`;
        //-----------utpclient----------
        let utpclient = new Node({ mtu: p2pmtu });
        if (SocketIOCreateUtpClientMap.has(targetClientId) === false) {
            SocketIOCreateUtpClientMap.set(targetClientId, []);
        }
        logger.warn('targetClientId', targetClientId);
        SocketIOCreateUtpClientMap.get(targetClientId).push({ UtpClient: utpclient, TcpSocket: tcpSocket });

        let freeUdpPort = await NetUtil.freeUdpPortAsync();
        await UpnpUtil.addMap(freeUdpPort, freeUdpPort);
        utpclient.bind(freeUdpPort, async() => {

            let udpSocket = utpclient.getUdpSocket();
            logger.debug('p2p connector utpclient bindPort=' + udpSocket.address().port);

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
                    socketIOSocket.emit('p2p.request.open', {
                        targetTunnelId: connectorItem.p2pTunnelId,
                        targetP2PPassword: connectorItem.p2pPassword,
                        connectorclientId: ownClientId,
                        targetClientId: targetClientId,
                        connectorHost: message.host,
                        connectorPort: message.port,
                        socketIOSocketId: socketIOSocket.id
                    }, (backData) => {
                        logger.trace('backData:' + JSON.stringify(backData));
                        if (backData.success == false) {
                            logger.warn(`can't connect to p2p client for:` + backData.info);
                            utpclient.close();
                            logger.warn('start failover to tcp tunnel');
                            // tcpSocket.end();//------failover
                            //----fallover connect to tcp server---s-
                            let tcpClient = failoverTcp(remotePort, tcpSocket);
                            //----fallover connect to tcp server---e
                            return;
                        }
                        //---------tryConnect2Public------
                        let server = { address: backData.data.host, port: backData.data.port };
                        logger.debug(`p2p connector: begin punching a hole to ${server.address}:${server.port}...`);
                        utpclient.punch(10, server.port, server.address, success => {

                            logger.debug(`p2p connector: punching result: ${success ? 'success' : 'failure'}`);

                            if (!success) {
                                utpclient.close();
                                // tcpSocket.end(); //注意观察
                                //----fallover connect to tcp server---s-
                                let tcpClient = failoverTcp(remotePort, tcpSocket);
                                //----fallover connect to tcp server---e
                                return;
                            }

                            utpclient.on('timeout', () => {
                                console.log('p2p connector: connect timeout');
                                utpclient.close();
                                tcpSocket.end();
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
                                tcpSocket.on('end', () => {
                                    logger.debug(`connector tcp  server on socket end,` + socketAddressInfo);
                                    utpclient.close();
                                    tcpSocket.end();
                                    tcpSocket.destroy();
                                });

                                tcpSocket.on('error', (err) => {
                                    logger.debug('connector tcp  server on socket error ' + err);
                                    utpclient.close();
                                    tcpSocket.end();
                                    tcpSocket.destroy();
                                });

                                tcpSocket.on('timeout', () => {
                                    logger.debug('connector tcp  server on socket timeout');
                                    utpclient.close();
                                    tcpSocket.end();
                                    tcpSocket.destroy();
                                });
                                //-------------------------------------------------e----------------
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
                        console.error(err);
                    } else {
                        const { address, port } = res.getXorAddress();
                        console.log('your ip', address, port);
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

    server.listen(connectorItem.localPort, () => {
        logger.debug("p2p local tcp  server started at port=" + connectorItem.localPort);
    });

}


async function getClient(authenKey) {
    let ret = await axios.get('/client/' + authenKey);
    let result = await ret.data;
    return result;
}


async function getClientP2PInfoByTunnelId(authenKey, tunnelId) {
    let ret = await axios.get('/client/getClientP2PInfoByTunnelId', {
        params: {
            authenKey: authenKey,
            tunnelId: tunnelId,
        }
    });
    let result = await ret.data;
    return result;
}

async function startProxy(authenKey, tunnelId) {
    let result = await (await axios.post('/client/startProxy', { tunnelId: tunnelId, authenKey: authenKey })).data;
    return result;
}

async function checkServerStatus() {

    try {
        let ret = await axios.get('/checkServerStatus');
        let result = await ret.data;
        return result.success;
    } catch (error) {
        logger.trace('checkServerStatus error');
        isWorkingFine == false;
        return false;
    }

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
}


async function trayIcon(params) {
    let archFine = os.arch() === "x32" || os.arch() === "x64";
    let platformFine = os.platform() === 'win32' || os.platform() === 'linux';
    if (!(archFine && platformFine)) {
        return;
    }

    const fs = require('fs');
    const readFile = require('util').promisify(fs.readFile);
    let ext = '.png'
    if (os.platform() == 'win32') {
        ext = '.ico';
    }
    // let bitmap = await readFile('./config/img/tray' + ext);
    let Tray = require("ctray");

    let tray = new Tray('./config/img/tray' + ext, [{
            text: "show",
            callback: _ => {
                console.log('show')
            }
        },
        {
            text: "exit",
            callback: _ => {
                tray.stop();
                PlatfromUtil.processExit();
            }
        }
    ])

    tray.start().then(() => console.log("app closed"));
    return;

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
    let result = await (await axios.put('/client/' + authenKey, data)).data;
    return result;
}

function restartApplication() {
    logger.debug("restart now,new pid= " + process.pid);
    let exe = process.argv.shift();
    if (!process.argv.includes('-r')) {
        process.argv.push('-r')
    }
    setTimeout(function() {
        require("child_process").spawn(exe, process.argv, {
            cwd: process.cwd(),
            detached: true,
            stdio: "inherit"
        });
        PlatfromUtil.processExit();
    }, 500);
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