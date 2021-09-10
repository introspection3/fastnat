const SocketIO = require('socket.io');
const logger = require('../Log/logger');
const defaultConfig = require('../Common/DefaultConfig');
const serverConfig = require('../Common/ServerConfig');
const defaultWebServerConfig = defaultConfig.webserver;
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
const io = new SocketIO.Server(defaultWebServerConfig.socketioPort);
io.adapter(createAdapter());
const UpdTunnelServer = require('../UdpTunnel/UpdTunnelServer');
const ClusterData = require('../Common/ClusterData');

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

    let currentConnectSocketIoClientId = socket.handshake.auth.clientId;
    socket.on('disconnect', function () {
        let clientId = socket.handshake.auth.clientId;
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

    socket.on('client.createUpdTunnelServer', async (udpTunnelItemOption, fn) => {
        //--------------
        let tunnelId = udpTunnelItemOption.id;
        let authenKey = socket.handshake.auth.token;

        let client = await Client.findOne({
            where: {
                isAvailable: true,
                authenKey: authenKey
            },
            include: [
                {
                    model: Tunnel,
                    required: true,
                    where: {
                        isAvailable: 1,
                        id: tunnelId
                    }
                }
            ]
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

module.exports = {
    io: io,
    defaultNS: defaultNS
}
