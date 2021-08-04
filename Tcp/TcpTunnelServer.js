'use strict';

const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');
const TcpServer = require('./TcpServer');

/**
 * Tcp隧道服务端程序
 */
class TcpTunnelServer {

    /**
     * 
     * @param {TcpServer} tcpServer 
     */
    constructor(tcpServer) {
        this.tcpServer = tcpServer;
    }



    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        this.tcpServer.start();
        
        this.tcpServer.eventEmitter.on('onMessage', (dataBuffer, socket) => {

             
        });

        this.tcpServer.eventEmitter.on('onCodecMessage', (data, socket) => {
            
        });

    }

}

module.exports = TcpTunnelServer;