'use strict';

const logger = require('../Log/logger');
const net = require('net');
const TcpClient = require('../Tcp/TcpClient');
const TcpTunnelProtocal = require('../TcpTunnel/TcpTunnelProtocal');
const { Socket } = require('dgram');

/**
 * Tcp隧道服务端程序
 */
class TcpTunnelClient {

    /**
     * 
     * @param {Object} tcpTunnelServerAddress 
     * @param {Object} localAddress 
     */
    constructor(authenKey, tcpTunnelServerAddress, localAddress) {
        this.authenKey = authenKey
        this.tcpTunnelServerAddress = tcpTunnelServerAddress;
        this.localAddress = localAddress;
        this.started = false;
        this.defaultTimeout = 5000;
    }


    /*启动Tcp隧道客户端程序,只会调用一次
    * 连接到服务端
     */
    async start(tunnelId) {

        if (this.started) {
            logger.warn("Tcp TunnelClient has already started.");
            return;
            
        }
        this.started = true;

        let tcpClient = new TcpClient(this.tcpTunnelServerAddress);

        tcpClient.start();

        tcpClient.eventEmitter.on('connect', () => {
            tcpClient.sendCodecData({ command: 'authen', authenKey: this.authenKey, tunnelId: tunnelId });
        });

        tcpClient.eventEmitter.on('onCodecMessage', data => {

            if (data.command == 'newClientComming') {

                let localSocket = net.createConnection(this.localAddress, () => {

                });

                localSocket.on('connect', () => {

                    let middleSocket = net.createConnection(data.middlePort, this.tcpTunnelServerAddress.host, () => {

                    });

                    localSocket.middleSocket = middleSocket;
                    localSocket.pipe(middleSocket);

                    middleSocket.on('connect', () => {
                        middleSocket.pipe(localSocket);
                    });

                    middleSocket.on('end', () => {
                        middleSocket.end();
                        middleSocket.destroy();
                    });

                    middleSocket.on('close', () => {
                        middleSocket.end();
                        middleSocket.destroy();
                    });

                });


                localSocket.on('close', (hadError) => {

                    logger.info('localSocket Closed:' + JSON.stringify(this.localAddress));
                    if (localSocket.middleSocket != null) {
                        localSocket.middleSocket.end();
                        localSocket.middleSocket.destroy();
                    }

                });

                localSocket.on('end', (hadError) => {
                    logger.info('localSocket end:' + JSON.stringify(this.localAddress));
                    if (localSocket.middleSocket != null) {
                        localSocket.middleSocket.end();
                        localSocket.middleSocket.destroy();
                    }

                });

            }
        });

    }


    closeClient(data, socket) {

        logger.warn('recevie command (closeClient)' + data.info);
        this.tcpClient.client.end();

    }

    clientInfo(data, socket) {

        logger.info(data);

    }

}

module.exports = TcpTunnelClient;