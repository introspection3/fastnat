 const logger = require('../Log/logger');
 const io = require('socket.io-client').io;
 const Socket = require('socket.io-client').Socket;

 /**
  * 
  * @param {string} authenKey 
  * @param {Number} clientId 
  * @returns {Socket}
  */
 function startConnect2SocketIO(authenKey, clientId, ioUrl) {

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
         }, 30000);

         socketIOSocket.on('connect', function() {
             clearTimeout(t);
             logger.debug('socket.io client has connected to server,socket.id=' + socketIOSocket.id);
             resolve(socketIOSocket);
         });
     });
     logger.trace('socket.io ready');
     return p;
 }

 module.exports = startConnect2SocketIO;