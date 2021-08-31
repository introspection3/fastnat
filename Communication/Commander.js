const SocketIO = require('socket.io');
const { createClient } = require('redis');
const redisAdapter = require('@socket.io/redis-adapter');
const logger = require('../Log/logger');
const defaultConfig = require('../Common/DefaultConfig');
const serverConfig = require('../Common/ServerConfig');
const defaultWebServerConfig = defaultConfig.webserver;
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const io = new SocketIO.Server(defaultWebServerConfig.socketioPort);

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
    socket.join('default');
    let token = socket.handshake.auth.token;
    socket.on('disconnect', function () {
        console.log(`client authenKey=${token} disconnect`);
    });
    logger.debug('socket.io new connection,socket.id=' + socket.id);

    //-----------判断是否已经连了这个authenKey----------
    let currentSockets = await defaultNS.in('default').fetchSockets();
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
        let clientInfo = await getClientByTunnelId(data.targetTunnelId);
        let result = false;
        let info = '';
        if (clientInfo == null) {
            info = `targetTunnelId's client not exist`;
        }
        else {
            let allSockets = await defaultNS.in('default').fetchSockets();
            let targetSocket = allSockets.find((value, index, array) => {
                value.handshake.auth.token === clientInfo.authenKey;
            });

            if (targetSocket != null) {
                let objectKey = data.targetTunnelId + '';
                if (targetSocket.data[objectKey] != null) {
                    info = 'targetTunnelId is p2ped by ' + targetSocket.data[objectKey];
                    fn({ success: result, data: data, info: info });
                } else {
                    targetSocket.data[objectKey] = data.authenKey;
                    result = true;
                    targetSocket.emit('p2p.request.open', data, (ret) => {
                        fn(ret);
                    });
                }
            }
            else {
                info = `targetTunnelId's client is not online`;
                fn({ success: result, data: data, info: info });
            }
        }
    });
});



if (serverConfig.cluster.enabled) {

    const pubClient = createClient(serverConfig.redis.port, serverConfig.redis.host,
        {
            auth_pass: serverConfig.redis.password,

            retry_strategy: function (options) {
                if (options.error && options.error.code === "ECONNREFUSED") {
                    // End reconnecting on a specific error and flush all commands with
                    // a individual error
                    return new Error("The server refused the connection");
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    // End reconnecting after a specific timeout and flush all commands
                    // with a individual error
                    return new Error("Retry time exhausted");
                }
                if (options.attempt > 10) {
                    // End reconnecting with built in error
                    return undefined;
                }
                // reconnect after
                return Math.min(options.attempt * 100, 3000);
            }
        });

    const subClient = pubClient.duplicate();
    pubClient.on('error', function (err) {
        logger.error(err)
    });
    subClient.on('error', function (err) {
        logger.error(err)
    });
    io.adapter(redisAdapter(pubClient, subClient));
    defaultNS = defaultNS.adapter;
}

module.exports = io;
