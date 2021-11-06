const defaultConfig = require('../Common/DefaultConfig');
const logger = require('../Log/logger');
const defaultWebSeverConfig = defaultConfig.webserver;
const io = require('socket.io-client').io;
const Socket = require('socket.io-client').Socket;

/**
 * 
 * @param {string} authenKey 
 * @param {Number} clientId 
 * @returns {Socket}
 */
function startConnect2SocketIO(authenKey, clientId) {
    let ioUrl = `http${defaultWebSeverConfig.https ? 's' : ''}://${defaultConfig.host}:${defaultWebSeverConfig.socketioPort}`;
    logger.trace('socket.io url:' + ioUrl);
    const socketIOSocket = io(ioUrl, {
        auth: {
            token: authenKey,
            clientId: clientId
        },
        transports: ["websocket"]
    });

    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('socket.io client  to server timeout,please check the server status')
        }, 300000);

        socketIOSocket.on('connect', function() {
            clearTimeout(t);
            logger.debug('socket.io client has connected to server,socket.id=' + socketIOSocket.id);
            resolve(socketIOSocket);
        });
    });
    return p;
}

module.exports = startConnect2SocketIO;