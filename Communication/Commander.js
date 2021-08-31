const SocketIO = require('socket.io');
const { createClient } = require('redis');
const redisAdapter = require('@socket.io/redis-adapter');
const logger = require('../Log/logger');
const defaultConfig = require('../Common/DefaultConfig');
const serverConfig = require('../Common/ServerConfig');
const defaultWebServerConfig = defaultConfig.webserver;
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const io = new SocketIO.Server(defaultWebServerConfig.socketioPort);
io.adapter(createAdapter());

/**
 * is valid token
 * @param {auth} auth 
 * @returns 
 */
async function isValidToken(auth) {
    if (auth == null | auth.token == null) {
        return false;
    }
    let token = auth.token;
    let client = await Client.findOne({
        where: {
            authenKey: token,
            isAvailable: true
        }
    });
    let existClient = client != null;
    return existClient;
}

async function getClientByTunnelId(targetTunnelId, targetP2PPassword) {
    let tunnel = await Tunnel.findOne({
        where: {
            id: targetTunnelId,
            p2pPassword: targetP2PPassword,
            isAvailable: true
        },
        include: Client
    });
    return tunnel;
}

io.use(async (socket, next) => {
    let isValid = await isValidToken(socket.handshake.auth);
    if (isValid) {
        return next();
    }
    logger.error('error token:' + socket.handshake.auth.token);
    socket.emit('errorToken', { token: socket.handshake.auth.token });
    socket.disconnect(true);
    return next(new Error('socketio authen error'));
});

let defaultNS = io.of('/');

io.on('connection', async (socket) => {
    // socket.join('default');
    let token = socket.handshake.auth.token;
    socket.on('disconnect', function () {
        console.log(`client authenKey=${token} disconnect`);
    });
    logger.debug('socket.io new connection,socket.id=' + socket.id);

    //-----------判断是否已经连了这个authenKey----------
    let currentSockets = await defaultNS.fetchSockets();
    let existSockets = currentSockets.filter((value, index, array) => {
        value.handshake.auth.token === token;
    });

    if (existSockets && existSockets.length > 1) {
        //已有连接了
        socket.disconnect(true);
        logger.error('exist authenKey online,authenKey=' + token);
        return;
    }
    //-------------------------------------------------

    socket.on('p2p.request.open', async (data, fn) => {
        let clientInfo = await getClientByTunnelId(data.targetTunnelId, data.targetP2PPassword);
        let targetClientAuthenKey = clientInfo.client.authenKey;
        let result = false;
        let info = '';
        if (clientInfo == null) {
            info = `targetTunnelId's client not exist`;
        }
        else {
            let allSockets = await defaultNS.fetchSockets();
            logger.warn('allSockets:' + JSON.stringify(allSockets.length))
            let targetSocket = allSockets.find((value, index, array) => {
                return value.handshake.auth.token === targetClientAuthenKey;
            });

            if (targetSocket != null) {
                let objectKey = data.targetTunnelId + '';
                let connectorAuthenKey=data.authenKey;
                let tunnelIdP2PByAuthenKey=targetSocket.data[objectKey];

                if (tunnelIdP2PByAuthenKey != null && tunnelIdP2PByAuthenKey != connectorAuthenKey) {
                    info = 'targetTunnelId is p2ped by ' + tunnelIdP2PByAuthenKey;
                    fn({ success: result, data: data, info: info });
                } else {

                    if (tunnelIdP2PByAuthenKey != null && tunnelIdP2PByAuthenKey == connectorAuthenKey) {
                       logger.info('reopen p2p by'+connectorAuthenKey);
                    }

                    targetSocket.data[objectKey] = connectorAuthenKey;
                    result = true;
                    targetSocket.emit('p2p.request.open', data, (ret) => {
                        fn(ret);
                    });
                }
            }
            else {
                info = `targetTunnelId's client is not online:targetClientAuthenKey=` + targetClientAuthenKey;
                fn({ success: result, data: data, info: info });
            }
        }
    });
});



if (serverConfig.cluster.enabled) {

    // defaultNS = defaultNS.adapter;
}

module.exports = io;
