const defaultConfig = require('./Common/DefaultConfig');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const GlobalData = require('./Common/GlobalData');
const HttpTunnelClient = require('./HttpTunnel/HttpTunnelClient');

if (defaultWebSeverConfig.https == true) {
    axios.defaults.baseURL = `https://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
} else {
    axios.defaults.baseURL = `http://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
}

const clientConfig = require('./Common/ClientConfig');
const authenKey = clientConfig.authenKey;

let isWorkingFine = true;

async function main(params) {

    let tunnelsResult = null;

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
        if (tunnelItem.type === 'tcp') {
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
}, 30 * 1000);
trayIcon();
main();

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

async function trayIcon(params) {
    const SysTray = require('systray').default;
    const open = require('open');
    const fs = require('fs');
    const readFile = require('util').promisify(fs.readFile);
    let ext = '.png'
    if (require('os').platform() == 'win32') {
        ext = '.ico';
    }
    let bitmap = await readFile('./config/tray' + ext);
    let base64str = Buffer.from(bitmap, 'binary').toString('base64'); // base64编码
    const systray = new SysTray({
        menu: {
            // you should using .png icon in macOS/Linux, but .ico format in windows
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
                tooltip: "bb",
                checked: false,
                enabled: true
            }, {
                title: "退出",
                tooltip: "exit",
                checked: false,
                enabled: true
            }]
        },
        debug: false,
        copyDir: true, // copy go tray binary to outside directory, useful for packing tool like pkg.
    })

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
    })
}


