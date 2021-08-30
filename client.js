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
const P2PClient = require('./P2P/P2PClient');
const P2pConnector = require('./P2P/P2pConnector');

if (defaultWebSeverConfig.https == true) {
    axios.defaults.baseURL = `https://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
} else {
    axios.defaults.baseURL = `http://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
}


const authenKey = clientConfig.authenKey;

let isWorkingFine = true;

async function main(params) {
    // Object
    notifier.notify({
        title: '通知',
        message: '欢迎使用fastnat',
        sound: true,
        timeout: 3
    });

    let tunnelsResult = null;
    let socketIOSocket = await useSocketIO(authenKey);

    try {
        tunnelsResult = await getTunnels(authenKey);
    } catch (error) {
        console.error('connect to server failed,waiting...');
        isWorkingFine = false;
        return;
    }

    if (!tunnelsResult.success) {
        logger.error(tunnelsResult.info);
        return;
    }
    const natType = await getNatType({ logsEnabled: true, sampleCount: 5, stunHost: stunHost });
    await updateClientSystemInfo(natType);
    let tunnels = tunnelsResult.data;
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
}


async function getTunnels(authenKey) {
    let ret = await axios.get('/client/tunnels/' + authenKey);
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
    // Symmetric NAT
    let stunHost = clientConfig.stunHost;
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

/**
 * 
 * @param {number} targetTunnelId 
 * @param {string} targetP2PPassword 
 * @param {Socket} socketIOSocket 
 */
function p2pStart(targetTunnelId, targetP2PPassword, socketIOSocket) {
    let connector = new P2pConnector(defaultConfig.host, defaultConfig.p2p.trackerPort, targetTunnelId, targetP2PPassword, authenKey, socketIOSocket);
    connector.start();
}

/**
 * 
 * @param {string} authenKey 
 * @returns {Promise<io.Socket >}
 */
function useSocketIO(authenKey) {

    let ioUrl = `http${defaultWebSeverConfig.https ? 's' : ''}://${defaultConfig.host}:${defaultWebSeverConfig.socketioPort}`;

    logger.debug('ioUrl:' + ioUrl);

    const socket = io(ioUrl, {
        auth: {
            token: authenKey
        },
        transports: ["websocket"]
    });

    socket.on('p2p.request.open', async (data, fn) => {
        let p2pClient = new P2PClient(defaultConfig.host, defaultConfig.p2p.trackerPort, data.targetTunnelId, authenKey, socket);
        p2pClient.start(data.connectorHost, data.connectorPort, fn);
    });

    socket.on('p2p.request.openConnector', async (data) => {

    });
    socket.on('errorToken', async (data) => {
        socket.disconnect(true);
        logger.error('error token:' + data.token);
    });

    socket.on('disconnecting', (reason) => {
        console.log(reason);
    });

    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('socket.io client  to server timeout,please check the server status')
        }, 2000);

        socket.on('connect', function () {
            clearTimeout(t);
            logger.debug('socket.io client has connected to server,socket.id=' + socket.id);
            resolve(socket);
        });
    });
    return p;
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