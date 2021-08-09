const config = require('./Common/Config');
const axios = require('axios').default;
const TcpTunnelClient = require('./TcpTunnel/TcpTunnelClient');
const logger = require('./Log/logger');

async function main(params) {

    let serverConfig = config.get("server");
    
    if (serverConfig.get("https") == true) {
        axios.defaults.baseURL = `https://${serverConfig.host}:${serverConfig.port}`
    } else {
        axios.defaults.baseURL = `http://${serverConfig.host}:${serverConfig.port}`
    }

    let clientConfig = config.get('client');
    let authenKey = clientConfig.authenKey;

    let tunnelsResult = (await getTunnels(authenKey));
    if (!tunnelsResult.success) {
        console.log(tunnelsResult.data);
        return;
    }

    let firstTunnel = tunnelsResult.data[0];

    //通知服务端开始某个代理
    //await startProxy(authenKey, firstTunnel.id);

    let tcpTunnelClient = new TcpTunnelClient(
        authenKey,
        {
            host: serverConfig.host,
            port: serverConfig.tcpTunnelServerPort
        },
        {
            host: firstTunnel.localIp,
            port: firstTunnel.localPort
        }
    );

    await tcpTunnelClient.start(firstTunnel.id);
   


}
main();

async function getTunnels(authenKey) {
    let result = await (await axios.get('/client/tunnels/' + authenKey)).data;
    return result;
}

async function startProxy(authenKey, tunnelId) {
    let result = await (await axios.post('/client/startProxy', { tunnelId: tunnelId, authenKey: authenKey })).data;
    return result;
}
process.on("uncaughtException", function (err) {
    logger.error(err);
  });
  

