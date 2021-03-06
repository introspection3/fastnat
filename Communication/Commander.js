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
const redisUtil = require('../Utils/RedisUtil');
const redisClient = redisUtil.redisClient;

const UpdTunnelServer = require('../UdpTunnel/UpdTunnelServer');
const ClusterData = require('../Common/ClusterData');

const eventEmitter = require('./CommunicationEventEmiter').eventEmitter;
const commandType = require('./CommandType').commandType;
const sleep = require('es7-sleep');


const UpdTunnelServerMap = new Map();
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
        socket.removeAllListeners();
    });

    logger.debug('socket.io new connection,currentConnectSocketIoClientId=' + currentConnectSocketIoClientId);

    //-----------判断是否登录到系统了----------
    let currentOnlineSockets = await defaultNS.fetchSockets();
    logger.trace('currentOnlineSockets.length=' + currentOnlineSockets.length);
    let existSockets = currentOnlineSockets.filter((value, index, array) => {
        return value.handshake.auth.clientId === currentConnectSocketIoClientId;
    });
    logger.trace('existSockets.length=' + existSockets.length);
    if (existSockets && existSockets.length > 1) {
        //已有连接了
        socket.emit(commandType.CLIENT_REPEAT_LOGIN, currentConnectSocketIoClientId);
        logger.error('client is already  online,clientId=' + currentConnectSocketIoClientId);
        setTimeout(() => {
            socket.disconnect(true);
        }, 100);
        return;
    }

    //------------------------------------------
    updateClientStatus(currentConnectSocketIoClientId, 1);

    //------------------------------------------

    socket.on(commandType.P2P_REQUEST_OPEN_RETURN, async(data, uuid, serverPid) => {
        let eventName = serverPid + ':' + uuid;
        let str = JSON.stringify(data);
        console.log('eventName:' + eventName + ",message:" + str)
        await redisClient.set(eventName, str, "EX", 5);
    });

    socket.on(commandType.P2P_REQUEST_OPEN, async(data, fn) => {
        let targetClientId = data.targetClientId;
        let result = false;
        let info = '';
        let allSockets = await defaultNS.fetchSockets();
        let targetSocket = allSockets.find((value, index, array) => {
            return value.handshake.auth.clientId === targetClientId;
        });

        if (targetSocket != null) {
            result = true;
            logger.trace('start to notify targe socket to open p2p');
            data.serverPid = process.pid;
            let eventName = data.serverPid + ':' + data.uuid;
            targetSocket.emit(commandType.P2P_REQUEST_OPEN, data);
            let count = 1;
            await sleep(50);
            let resultData = await redisClient.get(eventName);
            if (resultData != null && resultData != '') {
                let ret = JSON.parse(resultData);
                fn(ret);
            } else {
                while (resultData == null) {
                    await sleep(10);
                    resultData = await redisClient.get(eventName);
                    if (resultData != null && resultData != '') {
                        ret = JSON.parse(resultData);
                        fn(ret);
                        console.log('count,' + (count++));
                    }
                }
            }

        } else {
            info = `targetTunnelId's client is not online:targetClientId=` + targetClientId;
            fn({ success: result, data: data, info: info });
        }
    });

    socket.on(commandType.CLIENT_CREATE_UDP_TUNNEL_SERVER, async(udpTunnelItemOption, fn) => {

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
        UpdTunnelServerMap.set(udpTunnelItemOption.id, udpTunnelServer);
        logger.debug('udpTunnelServer started');
        fn({
            success: true,
            info: 'start sucess',
            data: udpTunnelItemOption
        });

    });


    socket.on(commandType.CLIENT_STOP_UDP_TUNNEL_SERVER, async(udpTunnelItemOption, fn) => {

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
        let udpServer = UpdTunnelServerMap.get(udpTunnelItemOption.id);
        if (udpServer) {
            udpServer.stop();
        }
        logger.debug('udpTunnelServer stopped');
        fn({
            success: true,
            info: 'stop sucess',
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
eventEmitter.on(commandType.ADD_TUNNEL, async function(clientId, data) {
    notify2Client(commandType.ADD_TUNNEL, clientId, data);
});
eventEmitter.on(commandType.DELETE_CONNECTOR, async function(clientId, data) {
    notify2Client(commandType.DELETE_CONNECTOR, clientId, data);
});
eventEmitter.on(commandType.ADD_CONNECTOR, async function(clientId, data) {
    notify2Client(commandType.ADD_CONNECTOR, clientId, data);
});





async function notify2Client(theCommandType, clientId, data) {
    logger.trace(theCommandType)
    clientId = Number.parseInt(clientId);
    let allSockets = await defaultNS.fetchSockets();
    let targetSocket = allSockets.find((value, index, array) => {
        return value.handshake.auth.clientId === clientId;
    });
    // targetSocket = defaultNS.to(targetSocket.id); //---new
    let result = false;
    if (targetSocket != null) {
        logger.trace(theCommandType + " " + clientId + "  " + JSON.stringify(data));
        result = targetSocket.emit(theCommandType, data);
    }
}

module.exports = {
    io: io,
    defaultNS: defaultNS
}