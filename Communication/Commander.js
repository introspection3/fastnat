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
    let clientId = socket.handshake.auth.clientId;
    socket.on('disconnect', function () {
        let clientId = socket.handshake.auth.clientId;
        logger.debug(`clientId=${clientId} disconnect,socket.id=${socket.id}`);
        io.emit('client.disconnect', { clientId: clientId, socketIOSocketId:socket.id });
    });
    logger.debug('socket.io new connection,socket.id=' + socket.id);

    //-----------判断是否登录到系统了----------
    let currentSockets = await defaultNS.fetchSockets();
    let existSockets = currentSockets.filter((value, index, array) => {
        value.handshake.auth.clientId === clientId;
    });

    if (existSockets && existSockets.length > 1) {
        //已有连接了
        socket.disconnect(true);
        logger.error('client is already  online,clientId=' + clientId);
        return;
    }
    //-------------------------------------------------

    socket.on('p2p.request.open', async (data, fn) => {

        let targetClientId = data.targetClientId;
        let result = false;
        let info = '';
        let allSockets = await defaultNS.fetchSockets();
        let targetSocket = allSockets.find((value, index, array) => {
            return value.handshake.auth.clientId === targetClientId;
        });
        if (targetSocket != null) {
            result = true;
            targetSocket.emit('p2p.request.open', data, (ret) => {
                fn(ret);
            });
        }
        else {
            info = `targetTunnelId's client is not online:targetClientId=` + targetClientId;
            fn({ success: result, data: data, info: info });
        }

    });
});



if (serverConfig.cluster.enabled) {

    // defaultNS = defaultNS.adapter;
}

module.exports = io;
