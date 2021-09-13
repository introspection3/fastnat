const defaultConfig = require('./Common/DefaultConfig');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const HttpTunnelClient = require('./HttpTunnel/HttpTunnelClient');
const UdpTunnelClient = require('./UdpTunnel/UdpTunnelClient');
const clientConfig = require('./Common/ClientConfig');
const os = require('os');
const getMAC = require('getmac').default;
const { program } = require('commander');
const startConnect2SocketIO = require('./Communication/Soldier');
const net = require('net');
const Socket = require('socket.io-client').Socket;
const sleep = require('es7-sleep');
//---------------p2p config -----s-----
const getNatType = require("nat-type-identifier");
const SYMMETRIC_NAT = "Symmetric NAT";
const Node = require('utp-punch');
const stun = require('stun');
const p2pHost = defaultConfig.p2p.host;
const trackerPort = defaultConfig.p2p.trackerPort;
const isStunTracker = defaultConfig.p2p.isStun;
const sampleCount = defaultConfig.p2p.sampleCount;
const p2pmtu = defaultConfig.p2p.mtu;
//---------------p2p config -----e-----
const Sock5TunnelClient=require('./Socks5Tunnel/Sock5TunnelClient');
program.version('1.0.0');
program
    .option('-t, --test', 'is test')
    .option('-r, --restart', 'restart')
    .parse(process.argv);
const options = program.opts();
axios.defaults.timeout = 5000;
if (defaultWebSeverConfig.https == true) {
    axios.defaults.baseURL = `https://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
} else {
    axios.defaults.baseURL = `http://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
}
console.log(axios.defaults.baseURL)

let authenKey = clientConfig.authenKey;
if (options.test) {
    authenKey = '742af98b-e977-48a8-b1c8-1a2a091b93a2';
}

if (defaultConfig.monitor.enabled) {
    const easyMonitor = require('easy-monitor');
    easyMonitor('client');
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
async function registerSocketIOEvent(socketIOSocket, ownClientId) {

    socketIOSocket.on('p2p.request.open', async (data, fn) => {
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
            // let address = { host: '127.0.0.1', port: 3306 };
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
            utpSocket.pipe(tcpClient);  //--
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
        server.bind(0);

        server.listen(() => {
            let udpSocket = server.getUdpSocket();
            logger.debug('p2p client utpServer is ready,bindPort=' + udpSocket.address().port);
            let msg = JSON.stringify({ authenKey: authenKey, command: 'client_report_tunnel_info' });
            let timer = null;
            let timeout = null;

            let onMessage = (msg, rinfo) => {

                if (rinfo.port === trackerPort) {
                    udpSocket.removeListener('message', onMessage);
                    let message = {};
                    if (isStunTracker == false) {
                        if (timer != null)
                            clearInterval(timer);
                        if (timeout != null)
                            clearTimeout(timeout);
                        const text = msg.toString();
                        message = JSON.parse(text);
                    }
                    else {
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

            if (isStunTracker) {
                stun.request(`${p2pHost}:${trackerPort}`, { socket: udpSocket }, (err, res) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        const { address, port } = res.getXorAddress();
                        logger.log('your public:', address, port);
                    }
                });
            }
            else {
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

    socketIOSocket.on('client.disconnect', async (data) => {
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

    socketIOSocket.on('errorToken', async (data) => {
        socketIOSocket.disconnect(true);
        logger.error('error token:' + data.token);
    });

    socketIOSocket.on('disconnecting', (reason) => {
        logger.warn(`socket.io-client disconnecting  reason:` + reason);
        SocketIOCreateUtpServerMap.clear();
        SocketIOCreateUtpClientMap.clear();
        isWorkingFine=false;
    });

}

function setCurrentClientTunnelsMap(currentClientTunnels) {
    currentClientTunnelsMap.clear();
    for (let item of currentClientTunnels) {
        currentClientTunnelsMap.set(item.id, item);
    }
}

async function main(params) {
    if (options.restart) {
        logger.debug('sleep 1s,restarted,new pid='+process.pid);
        await sleep(1000);
    }
    let clientResult = null;
    try {
        clientResult = await getClient(authenKey);
    } catch (error) {
        console.error('connect to server failed,waiting...' + error);
        isWorkingFine = false;
        return;
    }

    if (!clientResult.success) {
        logger.error(clientResult.info);
        return;
    }
    let currentClientTunnels = clientResult.data.tunnels;
    setCurrentClientTunnelsMap(currentClientTunnels)
    let socketIOSocket = await startConnect2SocketIO(authenKey, clientResult.data.id);
    registerSocketIOEvent(socketIOSocket, clientResult.data.id);

    //----------
    try {
        currentClientNatType = await getNatType({ logsEnabled: true, sampleCount: sampleCount, stunHost: clientConfig.stunHost });
    } catch (error) {
        logger.warn(error);
        currentClientNatType = 'Error';
    }

    logger.info('client nat\'s type:', currentClientNatType);
    await updateClientSystemInfo(currentClientNatType);

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
                authenKey,
                {
                    host: defaultConfig.host,
                    port: defaultBridgeConfig.port
                },
                {
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
                process.exit(1);
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
            startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort);
        } else {
            logger.error(result.info);
        }
    }
}



/**
 * 
 * @param {Connector} connectorItem 
 * @param {Socket} socketIOSocket 
 * @param {Number} ownClientId 
 * @param {Number} targetClientId 
 */
async function startCreateP2PTunnel(connectorItem, socketIOSocket, ownClientId, targetClientId, remotePort) {

    let server = net.createServer((tcpSocket) => {
        let socketAddressInfo = `remoteAddress=${tcpSocket.remoteAddress}:${tcpSocket.remotePort},localAddress=${tcpSocket.localAddress}:${tcpSocket.localPort}`;
        //-----------utpclient----------
        let utpclient = new Node({ mtu: p2pmtu });
        if (SocketIOCreateUtpClientMap.has(targetClientId) === false) {
            SocketIOCreateUtpClientMap.set(targetClientId, []);
        }
        logger.warn('targetClientId', targetClientId);
        SocketIOCreateUtpClientMap.get(targetClientId).push({ UtpClient: utpclient, TcpSocket: tcpSocket });

        utpclient.bind(0, () => {

            let udpSocket = utpclient.getUdpSocket();
            logger.debug('p2p connector utpclient bindPort=' + udpSocket.address().port);
            //--------向tracker汇报--------------------------

            let timer = null;
            let timeout = null;

            let onMessage = (msg, rinfo) => {

                if (rinfo.port === trackerPort) {

                    udpSocket.removeListener('message', onMessage);

                    let message = {};
                    if (isStunTracker == false) {
                        if (timer != null)
                            clearInterval(timer);
                        if (timeout != null)
                            clearTimeout(timeout);
                        const text = msg.toString();
                        message = JSON.parse(text);
                    }
                    else {
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
                            let address = { host: defaultConfig.host, port: remotePort };
                            let tcpClient = net.createConnection(address, () => {
                                logger.trace('p2p tcp client has created to ' + JSON.stringify(address));

                            });
                            tcpClient.on('connect', () => {
                                tcpClient.pipe(tcpSocket);
                                tcpSocket.pipe(tcpClient);
                            });

                            tcpClient.on('close', (hadError) => {
                                logger.trace('Tcp Client Closed:' + this.toString());
                                tcpSocket.end();
                                tcpSocket.destroy();
                            });

                            tcpClient.on('error', (err) => {
                                tcpSocket.end();
                                tcpSocket.destroy();
                                logger.trace('Tcp Client error: ' + err + " ," + this.toString());
                            });
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
                                tcpSocket.end();
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
                                //-------------------------------------------------a----------------
                            });
                        });
                        //------------------
                    });
                }
            };
            //---------来至tracker的回应------------------
            udpSocket.on('message', onMessage);

            if (isStunTracker) {
                stun.request(`${p2pHost}:${trackerPort}`, { socket: udpSocket }, (err, res) => {
                    if (err) {
                        console.error(err);
                    } else {
                        const { address, port } = res.getXorAddress();
                        console.log('your ip', address, port);
                    }
                });
            }
            else {
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

setInterval(async () => {
    let serverOk = await checkServerStatus();
    if (serverOk && isWorkingFine == false) {
        isWorkingFine = true;
        restartApplication();
    }
}, 10 * 1000);

if (require('os').arch() != 'arm64') {
    trayIcon();
}

main();




async function trayIcon(params) {
    const SysTray = require('systray').default;
    const open = require('open');
    const fs = require('fs');
    const readFile = require('util').promisify(fs.readFile);
    let ext = '.png'
    if (os.platform() == 'win32') {
        ext = '.ico';
    }
    let bitmap = await readFile('./config/tray' + ext);
    let base64str = Buffer.from(bitmap, 'binary').toString('base64'); // base64编码
    const systray = new SysTray({
        menu: {
            // using .png icon in macOS/Linux, but .ico format in windows
            icon: base64str,
            title: "fastnat",
            tooltip: "fastnat",
            items: [{
                title: "显示",
                tooltip: "display",
                // checked is implement by plain text in linux
                checked: true,
                enabled: true
            }, {
                title: "管理",
                tooltip: "manage",
                checked: false,
                enabled: true
            }, {
                title: "退出",
                tooltip: "quit",
                checked: false,
                enabled: true
            }]
        },
        debug: false,
        copyDir: true, // copy go tray binary to outside directory, useful for packing tool like pkg.
    });

    systray.onClick(action => {
        if (action.seq_id === 0) {
            systray.sendAction({
                type: 'update-item',
                item: {
                    ...action.item,
                    checked: !action.item.checked,
                },
                seq_id: action.seq_id,
            })
        } else if (action.seq_id === 1) {
            // opens the url in the default browser 
            open(axios.defaults.baseURL);
            // console.log('open the url', action)
        } else if (action.seq_id === 2) {
            systray.kill()
        }
    });
}

async function updateClientSystemInfo(natType) {
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
    logger.debug("restart now,current pid= " + process.pid);
    let exe = process.argv.shift();
    if (!process.argv.includes('-r')) {
        process.argv.push('-r')
    }
    setTimeout(function () {
        require("child_process").spawn(exe, process.argv, {
            cwd: __dirname,
            detached: true,
            stdio: "inherit"
        });
        process.exit();
    }, 500);
}

process.on("exit", function (code) {

});

process.on('SIGINT', function () {
    console.log('Exit now!');
    process.exit();
});

process.on("uncaughtException", function (err) {
    console.error(err.stack)
    logger.error(err);
});