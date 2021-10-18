const SocketIO = require('socket.io');
const logger = require('../Log/logger');
const defaultConfig = require('../Common/DefaultConfig');
const serverConfig = require('../Common/ServerConfig');
const defaultWebServerConfig = defaultConfig.webserver;
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const { checkType, isNumber, isEmpty, isString, isBoolean } = require('../Utils/TypeCheckUtil');
checkType(isNumber, defaultWebServerConfig.socketioPort, 'defaultWebServerConfig.socketioPort');
const io = new SocketIO.Server(defaultWebServerConfig.socketioPort);
if (serverConfig.cluster.enabled) {
    const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
    io.adapter(createAdapter());
}
const UpdTunnelServer = require('../UdpTunnel/UpdTunnelServer');
const ClusterData = require('../Common/ClusterData');
const DefaultConfig = require('../Common/DefaultConfig');
const eventEmitter = require('./CommunicationEventEmiter').eventEmitter;
const commandType = require('./CommandType').commandType;

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
/**
 * 设置客户端在线状态
 * @param {Number} clientId 
 * @param {Number} status 
 * @returns 
 */
async function updateClientStatus(clientId, status) {
    let count = await Client.update({
        status: status,
        updatedAt: new Date()
    }, {
        where: {
            id: clientId
        }
    });
    return count;
}


//--------------------------授权验证-------------------------
io.use(async(socket, next) => {
    let isValid = await isValidToken(socket.handshake.auth);
    if (isValid) {
        return next();
    }
    logger.error('error token:' + socket.handshake.auth.token);
    socket.emit('errorToken', { token: socket.handshake.auth.token });
    socket.disconnect(true);
    return next(new Error('socket.io authen error'));
});

let defaultNS = io.of('/');

io.on('connection', async(socket) => {

    let currentConnectSocketIoClientId = socket.handshake.auth.clientId;

    socket.on('disconnect', function() {
        let clientId = socket.handshake.auth.clientId;
        updateClientStatus(clientId, 0);
        logger.debug(`clientId=${clientId} disconnect,socket.id=${socket.id}`);
        io.emit('client.disconnect', { clientId: clientId, socketIOSocketId: socket.id });
    });

    logger.debug('socket.io new connection,socket.id=' + socket.id);

    //-----------判断是否登录到系统了----------
    let currentOnlineSockets = await defaultNS.fetchSockets();
    let existSockets = currentOnlineSockets.filter((value, index, array) => {
        value.handshake.auth.clientId === currentConnectSocketIoClientId;
    });

    if (existSockets && existSockets.length > 1) {
        //已有连接了
        socket.disconnect(true);
        logger.error('client is already  online,clientId=' + currentConnectSocketIoClientId);
        return;
    }

    //------------------------------------------
    updateClientStatus(currentConnectSocketIoClientId, 1);
    //------------------------------------------
    socket.on('p2p.request.open', async(data, fn) => {

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
        } else {
            info = `targetTunnelId's client is not online:targetClientId=` + targetClientId;
            fn({ success: result, data: data, info: info });
        }

    });

    socket.on('client.createUpdTunnelServer', async(udpTunnelItemOption, fn) => {

        let tunnelId = udpTunnelItemOption.id;
        let authenKey = socket.handshake.auth.token;

        let client = await Client.findOne({
            where: {
                isAvailable: true,
                authenKey: authenKey
            },
            include: [{
                model: Tunnel,
                required: true,
                where: {
                    isAvailable: 1,
                    id: tunnelId
                }
            }]
        });

        if (client == null) {
            fn({
                success: false,
                info: 'error client authenKey',
                data: null
            });
            return;
        }

        //----------------内部自动维护其生命周期-------------------------------
        let udpTunnelServer = new UpdTunnelServer(udpTunnelItemOption, socket);
        udpTunnelServer.start();
        logger.debug('udpTunnelServer started');
        fn({
            success: true,
            info: 'start sucess',
            data: udpTunnelItemOption
        });
    });
});



if (serverConfig.cluster.enabled) {
    // defaultNS = defaultNS.adapter;
}

eventEmitter.on(commandType.DELETE_CLIENT, async function(clientId) {
    notify2Client(commandType.DELETE_CLIENT, clientId, clientId);
});

eventEmitter.on(commandType.DELETE_TUNNEL, async function(clientId, data) {
    notify2Client(commandType.DELETE_TUNNEL, clientId, data);
});

async function notify2Client(theCommandType, clientId, data) {
    logger.trace(theCommandTypeL + clientId);
    let allSockets = await defaultNS.fetchSockets();
    let targetSocket = allSockets.find((value, index, array) => {
        return value.handshake.auth.clientId === clientId;
    });
    let result = false;
    if (targetSocket != null) {
        result = targetSocket.emit(theCommandType, data);
    }
}

module.exports = {
    io: io,
    defaultNS: defaultNS
}