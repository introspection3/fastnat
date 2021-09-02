const defaultConfig = require('./Common/DefaultConfig');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const HttpTunnelClient = require('./HttpTunnel/HttpTunnelClient');
const getNatType = require("nat-type-identifier");
const clientConfig = require('./Common/ClientConfig');
const os = require('os');
const getMAC = require('getmac').default;
const notifier = require('node-notifier');
const SYMMETRIC_NAT = "Symmetric NAT";
const { program } = require('commander');
const startConnect2SocketIO = require('./Communication/Soldier');
const net = require('net');
const Node = require('utp-punch');
const dgram = require('dgram');
const stun = require('stun');

program.version('1.0.0');
program
    .option('-t, --test', 'is test')
    .parse(process.argv);
const options = program.opts();

if (defaultWebSeverConfig.https == true) {
    axios.defaults.baseURL = `https://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
} else {
    axios.defaults.baseURL = `http://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
}
const ConnectorSet = new Set();
const P2PClientSet = new Set();

let authenKey = clientConfig.authenKey;
if (options.test) {
    authenKey = '2';
}
let isWorkingFine = true;
const trackerIP = defaultConfig.p2p.host;
const trackerPort = defaultConfig.p2p.trackerPort;



async function registerSocketIOEvent(socketIOSocket, ownClientId) {
    socketIOSocket.on('p2p.request.open', async (data, fn) => {

        let connectorHost = data.connectorHost;
        let connectorPort = data.connectorPort;

        let server = new Node(utpSocket => {
            logger.info('p2p client : UTP client comming');

            //-----------tcpClient-----
            // let address = { host: '127.0.0.1', port: 3306 };
            let address = { host: '192.168.1.1', port: 80 };
            let tcpClient = net.createConnection(address, () => {
                logger.trace('p2p tcp client has created ');
            });

            tcpClient.on('connect', () => {
                logger.trace('p2p tcp client has connected to ' + JSON.stringify(address));

            });

            tcpClient.on('data', (dataBuffer) => {

                utpSocket.write(dataBuffer);
            });

            tcpClient.on('close', (hadError) => {
                logger.trace('p2p tcp Client Closed:' + JSON.stringify(address));
                server.close();
            });

            tcpClient.on('error', (err) => {
                logger.warn('p2p tcp Client error: ' + err + " ," + JSON.stringify(address));
                server.close();
            });
            //---------------

            let utpSocketaddress = utpSocket.address();
            let onData = data => {
                console.log(
                    `p2p client utpserver: received '${data.length}' bytes data from ${utpSocketaddress.address}:${utpSocketaddress.port}`
                );

                tcpClient.write(data);
            };

            utpSocket.on('data', onData);
            utpSocket.on('end', () => {
                logger.debug(`p2p client utpserver: remote disconnected  ${utpSocketaddress.address}:${utpSocketaddress.port}`);
                server.close();
                tcpClient.end();
            });

        });

        server.bind(0);

        server.listen(() => {
            let udpSocket = server.getUdpSocket();
            logger.debug('p2p client utpServer is ready,bindPort=' + udpSocket.address().port);
            let msg = JSON.stringify({ authenKey: authenKey, command: 'client_report_tunnel_info' });
            let timer = null;
            let timeout = null;
            if (defaultConfig.p2p.isStun == false) {
                timer = setInterval(() => {
                    udpSocket.send(
                        msg,
                        trackerPort,
                        trackerIP,
                        (err) => { logger.warn(`p2p client utpServer  notify to   tracker error: ` + err) }
                    );
                    logger.trace(`p2p client utpServer  notify to   tracker`);
                }, 500);

                timeout = setTimeout(() => {
                    clearInterval(timer);
                    logger.warn('report to tracker timeout,utp failed');
                    server.close();
                    // tcpSocket.end();
                    return;
                }, 5 * 1000);
            }
            let onMessage = (msg, rinfo) => {

                if (rinfo.port === trackerPort) {
                    udpSocket.removeListener('message', onMessage);
                    let message = {};
                    if (defaultConfig.p2p.isStun == false) {
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
                    fn({ success: true, data: message, info: 'client public info' });

                    //------------tryConnect2Public---
                    let publicInfo = {
                        address: connectorHost,
                        port: connectorPort
                    }
                    logger.debug(`p2p client utpServer: begin punching a hole to ${publicInfo.address}:${publicInfo.port}...`);

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
            if (defaultConfig.p2p.isStun) {              
                stun.request('stun.l.google.com:19302', { socket: udpSocket }, (err, res) => {
                    if (err) {
                        logger.error(err);
                    } else {
                        const { address } = res.getXorAddress();
                        logger.log('your public:', address,port);
                    }
                });
            }
        });

    });

    socketIOSocket.on('client.disconnect', async (data) => {

    });

    socketIOSocket.on('errorToken', async (data) => {
        socketIOSocket.disconnect(true);
        logger.error('error token:' + data.token);
    });

    socketIOSocket.on('disconnecting', (reason) => {
        logger.debug(`socket.io-client disconnecting  reason:` + reason);
        for (let item of P2PClientSet) {
            //   item.stop();
        }
        P2PClientSet.clear();

        for (let item of ConnectorSet) {
            //  item.stop();
        }
        ConnectorSet.clear();
    });

}

async function main(params) {

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

    let socketIOSocket = await startConnect2SocketIO(authenKey, clientResult.data.id);
    registerSocketIOEvent(socketIOSocket, clientResult.data.id);

    //----------
    const natType = await getNatType({ logsEnabled: true, sampleCount: 5, stunHost: clientConfig.stunHost });
    await updateClientSystemInfo(natType);
    let tunnels = clientResult.data.tunnels;
    const ownClientId = clientResult.data.id;
    for (const tunnelItem of tunnels) {
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
                isWorkingFine = true;
                logger.error('process will quit for : ' + data.info);
                process.exit(1);
            });
            continue;
        }
    }
    let connectors = clientResult.data.connectors;
    for (const connectorItem of connectors) {
        let result = await getClientP2PInfoByTunnelId(authenKey, connectorItem.p2pTunnelId);
        let targetClientId = result.data.clientId;
        beginP2P(connectorItem, socketIOSocket, ownClientId, targetClientId);
    }
}




async function beginP2P(connectorItem, socketIOSocket, ownClientId, targetClientId) {

    let server = net.createServer((tcpSocket) => {
        let socketAddressInfo = `remoteAddress=${tcpSocket.remoteAddress}:${tcpSocket.remotePort},localAddress=${tcpSocket.localAddress}:${tcpSocket.localPort}`;
        //-----------utpclient----------
        let utpclient = new Node();
        utpclient.bind(0, () => {

            let udpSocket = utpclient.getUdpSocket();
            logger.debug('p2p connector utpclient bindPort=' + udpSocket.address().port);
            //--------向tracker汇报--------------------------
            let msg = JSON.stringify({ authenKey: authenKey, command: 'connector_report_tunnel_info' });
            let timer = null;
            let timeout = null;
            if (defaultConfig.p2p.isStun == false) {
                timer = setInterval(() => {
                    udpSocket.send(
                        msg,
                        trackerPort,
                        trackerIP,
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



            let onMessage = (msg, rinfo) => {

                if ( rinfo.port === trackerPort) {

                    udpSocket.removeListener('message', onMessage);

                    let message = {};
                    if (defaultConfig.p2p.isStun == false) {
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
                    //通知对应的客户端进行同时打洞操作
                    socketIOSocket.emit('p2p.request.open', {
                        targetTunnelId: connectorItem.p2pTunnelId,
                        targetP2PPassword: connectorItem.p2pPassword,
                        connectorclientId: ownClientId,
                        targetClientId: targetClientId,
                        connectorHost: message.host,
                        connectorPort: message.port,
                    }, (backData) => {
                        logger.info('backData:' + JSON.stringify(backData));
                        if (backData.success == false) {
                            logger.warn(`can't connect to p2p client for:` + backData.info);
                            utpclient.close();
                            tcpSocket.end();
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
                                let address = utpSocket.address();
                                utpSocket.on('data', data => {
                                    logger.debug(`p2p connector utpSocket: received '${data.length}' bytes data from ${address.address}:${address.port}`);
                                    tcpSocket.write(data);
                                });
                                utpSocket.on('end', () => {
                                    logger.debug('p2p connector: utpSocket end');
                                    utpclient.close();
                                    tcpSocket.end();
                                    return;
                                });
                                //------------------这个时候的tcpsocket才能正式使用了a---------------
                                tcpSocket.on('data', (dataBuffer) => {
                                    utpSocket.write(dataBuffer);
                                });

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

            if (defaultConfig.p2p.isStun) {
                console.log('send..a...');
                stun.request('stun.l.google.com:19302', { socket: udpSocket }, (err, res) => {
                    if (err) {
                        console.error(err);
                    } else {
                        const { address } = res.getXorAddress();
                        console.log('your ip', address);
                    }
                });
            }
        });



    });

    server.listen(connectorItem.localPort, () => {
        logger.trace("connector tcp  server started success,port=" + connectorItem.localPort);
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
        return false;
    }

}

setInterval(async () => {
    if (isWorkingFine == false) {
        let serverOk = await checkServerStatus();
        logger.trace('server status:' + serverOk);
        if (serverOk) {
            isWorkingFine = true;
            main();
        }
    }
}, 10 * 1000);

trayIcon();
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