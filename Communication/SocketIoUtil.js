const SocketIO = require('socket.io');
const logger = require('../Log/logger');
const { DefaultEventsMap, DefaultEventsMap, DefaultEventsMap } = require('socket.io/dist/typed-events');
const commandType = require('./CommandType').commandType;

/**
 * socket.io server execute Command Async
 * @param {SocketIO.Namespace} defaultNS 
 * @param {string} command 
 * @param {Object} parameters 
 */
async function executeCommandAsync(defaultNS, command, parameters) {
    if (command === commandType.ADD_TUNNEL) {
        let allSockets = await defaultNS.fetchSockets();
        let targetClientId = parameters.targetClientId;
        let targetSocket = allSockets.find((value, index, array) => {
            return value.handshake.auth.clientId === targetClientId;
        });
        let result = false;
        if (targetSocket != null) {
            result = true;
            targetSocket.emit(commandType.ADD_TUNNEL, data, (ret) => {
                fn(ret);
            });
        } else {
            info = `targetTunnelId's client is not online:targetClientId=` + targetClientId;
            return { success: result, data: data, info: info };
        }
    }
}

module.exports.executeCommandAsync = executeCommandAsync;