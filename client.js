const defaultConfig = require('./Common/DefaultConfig');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const HttpTunnelClient=require('./HttpTunnel/HttpTunnelClient');
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

    let firstTunnel = tunnelsResult.data[0];
    let tcpTunnelClient = new TcpTunnelClient(
        authenKey,
        {
            host: defaultBridgeConfig.host,
            port: defaultBridgeConfig.port
        },
        {
            host: firstTunnel.localIp,
            port: firstTunnel.localPort
        }
    );
    await tcpTunnelClient.startTunnel(firstTunnel.id);
    tcpTunnelClient.tcpClient.eventEmitter.on('error', (err) => {
        isWorkingFine = false;
        logger.error('Tcp tunnel server has stoped:' + err);
    });
    tcpTunnelClient.tcpClient.eventEmitter.on('quitClient', (data) => {
        isWorkingFine = true;
        logger.error('process will quit for : ' + data.info);
        process.exit(1);
    });
//     let httpTunnelClient=new HttpTunnelClient(authenKey,firstTunnel.id,{
//         host: defaultBridgeConfig.host,
//         port: defaultBridgeConfig.port
//     },
//     {
//         host: firstTunnel.localIp,
//         port: firstTunnel.localPort
//     });
//    await httpTunnelClient.start();
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
        logger.info('server status:' + serverOk);
        if (serverOk) {
            isWorkingFine = true;
            main();
        }
    }
}, 30 * 1000);

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

