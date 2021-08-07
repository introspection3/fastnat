'use strict';

const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const TcpTunnelProtocal = require('./TcpTunnelProtocal');
const { Client, Tunnel } = require('../Db/Models')

/**
 * Tcp隧道服务端程序
 */
class TcpTunnelServer {

    /**
     * 
     * @param {Object} tcpServerConfig 
     */
    constructor(tcpServerConfig) {
        this.tcpServer = new TcpServer(tcpServerConfig);
    }



    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        this.tcpServer.start();
        this.tcpServer.eventEmitter.on('onCodecMessage', (data, socket) => {
            authen(data, socket);
        });

    }

    createProxyServer(who, config) {
        
        let server = net.createServer((socket) => {
            let commingInfo = `new tcp  client comming:${socket.remoteAddress}:${socket.remotePort},local=${socket.localAddress}:${socket.localPort}`;
            logger.info(commingInfo);
            socket.pipe(who);
        });

        server.listen(config, () => {
            logger.info("Tcp  server started success:" + this);
        });

        return server;
    }

    /**
     * 处理来之客户端的授权信息
     * @param {TcpTunnelProtocal} data 
     * @param {net.Socket} socket 
     */
    async authen(data, socket) {

        let clients = await Client.findAll({
            where: {
                authen: data.authKey,
                isAvailable: true
            }
        });

        if (clients == null || clients.length == 0) {
            this.#notifyCloseClient(socket, 'error authen key');
            setTimeout(() => {
                socket.end();
                socket.destroy();
            }, 1000);
            return;
        }

        socket.stopNotify = true;

        let clientInfo = clients[0];
        let data = { command: 'clientInfo', info: 'answer authen request', data: clientInfo };
        this.tcpServer.sendCodecData2OneClient(data, socket);
        this.createProxyServer(socket,{})

    }

    #notifyCloseClient(socket, info) {
        let data = { command: 'closeClient', info: info };
        this.tcpServer.sendCodecData2OneClient(data, socket);
        this.tcpServer.clients.delete(socket);
    }


}

module.exports = TcpTunnelServer;