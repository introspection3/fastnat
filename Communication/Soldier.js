const defaultConfig = require('../Common/DefaultConfig');
const logger = require('../Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const io = require('socket.io-client').io;
const P2PClient = require('../P2P/P2PClient');

const P2PClientMap = new Map();

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
        let key = data.authenKey + ":" + data.targetTunnelId;
        if (P2PClientMap.has(key)) {
            let oldClient = P2PClientMap[key];
            oldClient.stop();
            P2PClientMap.delete(oldClient);
            logger.debug('close old p2p client,and reopen another P2PClient');
        }
        let p2pClient = new P2PClient(defaultConfig.p2p.host, defaultConfig.p2p.trackerPort, data.targetTunnelId, authenKey, socket);
        p2pClient.start(data.connectorHost, data.connectorPort, fn);
        P2PClientMap.set(key,p2pClient);
    });

    socket.on('errorToken', async (data) => {
        socket.disconnect(true);
        logger.error('error token:' + data.token);
    });

    socket.on('disconnecting', (reason) => {
        console.log(reason);
        P2PClientMap.clear();
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

module.exports = useSocketIO;