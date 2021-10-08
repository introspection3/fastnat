const SocketIO = require('socket.io');
const logger = require('../Log/logger');
const { DefaultEventsMap, DefaultEventsMap, DefaultEventsMap } = require('socket.io/dist/typed-events');

/**
 * socket.io server execute Command Async
 * @param {SocketIO.Namespace} defaultNS 
 * @param {string} command 
 * @param {Object} parameters 
 */
async function executeCommandAsync(defaultNS, command, parameters) {

}

module.exports.executeCommandAsync = executeCommandAsync;