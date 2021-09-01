const defaultConfig = require('./Common/DefaultConfig');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const GlobalData = require('./Common/GlobalData');
const HttpTunnelClient = require('./HttpTunnel/HttpTunnelClient');
const getNatType = require("nat-type-identifier");
const clientConfig = require('./Common/ClientConfig');
const os = require('os');
const getMAC = require('getmac').default;
const notifier = require('node-notifier');
const io = require('socket.io-client').io;
const SYMMETRIC_NAT = "Symmetric NAT";
const P2pConnector2 = require('./P2P/P2pConnector2');
const { program } = require('commander');
const startConnect2SocketIO = require('./Communication/Soldier');
const P2PClient2 = require('./P2P/P2PClient2');

program.version('0.0.1');
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

async function registerSocketIOEvent(socketIOSocket, ownClientId) {
    socketIOSocket.on('p2p.request.open', async (data, fn) => {
        let key = data.clientId + ":" + data.targetTunnelId;
        for (let item of P2PClientSet) {
            if (item.connectorClientId == data.id && item.localTunnelId == data.targetTunnelId) {
                item.stop();
                P2PClientSet.delete(item);
                logger.debug('close old p2p client,and reopen another P2PClient,key=' + key);
            }
        }
        let p2pClient = new P2PClient2(defaultConfig.p2p.host, defaultConfig.p2p.trackerPort, data.targetTunnelId, authenKey, data.clientId, ownClientId, socketIOSocket);
        p2pClient.start(data.connectorHost, data.connectorPort, fn);
        P2PClientSet.add(p2pClient);
    });

    socketIOSocket.on('client.disconnect', async (data) => {
        for (let item of P2PClientSet) {
            console.log(item.ownClientId, item.connectorClientId);
            if (item.connectorClientId == data.clientId || item.ownClientId == data.clientId) {
                item.stop();
                P2PClientSet.delete(item);
                logger.debug('client.disconnect,delete P2PClient,clientId=' + data.clientId);
            }
        }

        for (let item of ConnectorSet) {
            console.log(item.targetClientId, item.connectorClientId);
            if (item.connectorClientId == data.clientId || item.targetClientId == data.clientId) {
                item.stop();
                ConnectorSet.delete(item);
                logger.debug('client.disconnect,delete Connector,clientId=' + data.clientId);
            }
        }

    });

    socketIOSocket.on('errorToken', async (data) => {
        socketIOSocket.disconnect(true);
        logger.error('error token:' + data.token);
    });

    socketIOSocket.on('disconnecting', (reason) => {
        logger.debug(`socket.io-client disconnecting  reason:` + reason);
        for (let item of P2PClientSet) {
            item.stop();
        }
        P2PClientSet.clear();

        for (let item of ConnectorSet) {
            item.stop();
        }
        ConnectorSet.clear();
    });

}

async function main(params) {

    let clientResult = null;
    try {
        clientResult = await getClient(authenKey);
    } catch (error) {
        console.error('connect to server failed,waiting...'+error);
        isWorkingFine = false;
        return;
    }

    if (!clientResult.success) {
        logger.error(clientResult.info);
        return;
    }

    let socketIOSocket = await startConnect2SocketIO(authenKey, clientResult.data.id);
    registerSocketIOEvent(socketIOSocket, clientResult.data.id);
    console.log(1111111111);
    //----------
    const natType = await getNatType({ logsEnabled: true, sampleCount: 5, stunHost: clientConfig.stunHost });
    await updateClientSystemInfo(natType);
    let tunnels = clientResult.data.tunnels;
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
        p2pStart(connectorItem.p2pTunnelId, connectorItem.p2pPassword, socketIOSocket, clientResult.data.id);
    }
}


/**
 * 
 * @param {number} targetTunnelId 
 * @param {string} targetP2PPassword 
 * @param {Socket} socketIOSocket 
 */
async function p2pStart(targetTunnelId, targetP2PPassword, socketIOSocket, clientId) {
    let result = await getClientP2PInfoByTunnelId(authenKey, targetTunnelId);
    let targetClientId = result.data.clientId;
    let connector = new P2pConnector2(defaultConfig.p2p.host, defaultConfig.p2p.trackerPort, targetClientId, targetTunnelId, targetP2PPassword, authenKey, clientId, socketIOSocket);
    connector.start();
    ConnectorSet.add(connector);
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