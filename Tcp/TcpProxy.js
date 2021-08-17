'use strict';
const net = require('net');
const logger=require('../Log/logger');

/**
 * 创建一个TCP代理
 * @param {*} localAddress {host:'10.255.23.2',port:22}
 * @param {*} targetAddress {host:'10.255.23.2',port:22}
 * @returns net.Server
 */
function createTcpProxy(localAddress, targetAddress) {
    let connectInfo=` ${JSON.stringify(localAddress)}-->${JSON.stringify(targetAddress)}`;
    let proxyTcpServer = net.createServer((socket) => {   
            
        logger.info(`new socket :`+connectInfo);
        //socket will close after 10m inactive
        socket.setTimeout(60000*10);
        socket.on('timeout', () => {
          logger.error('socket will close after 10m inactive '+connectInfo);
          socket.end();
        });
        let client = net.connect({ port: targetAddress.port, host: targetAddress.host }, () => {
            socket.pipe(client);
        });
        client.pipe(socket);
        client.on('error', (err) => {
            let clientErrorInfo=`proxy client error ${connectInfo},err:${err}`;
            logger.error(clientErrorInfo);
            socket.destroy();
        });
        socket.on('error', (err) => {
            let clientErrorInfo=`proxy  socket  error ${connectInfo},err:${err}`;
            logger.error(clientErrorInfo);
            client.destroy();
        });

        socket.on('end', () => {
                
            logger.warn(` socket end--`+connectInfo);
            
        });

    });

    proxyTcpServer.on('error',err=>{
        logger.error('proxyTcpServer on error:'+err);
    });

    proxyTcpServer.on('close',err=>{
        logger.error('proxyTcpServer close:'+err);
    });
    
    proxyTcpServer.listen({ host: localAddress.host, port: localAddress.port}, () => {
        logger.info(`new proxyTcpServer start ${localAddress.host}:${localAddress.port}`);
    });
    return proxyTcpServer;
}

module.exports.createTcpProxy=createTcpProxy;
