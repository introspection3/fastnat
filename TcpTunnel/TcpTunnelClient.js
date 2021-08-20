'use strict';

const logger = require('../Log/logger');
const net = require('net');
const TcpClient = require('../Tcp/TcpClient');
const TcpTunnelProtocal = require('../TcpTunnel/TcpTunnelProtocal');
const { Socket } = require('dgram');
const genericPool = require("generic-pool");
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
        this.tcpClient = new TcpClient(this.tcpTunnelServerAddress);

         
    }

    async stopTunnel(tunnelId) {

        this.tcpClient.sendCodecData({ command: 'stopTunnel', authenKey: this.authenKey, tunnelId: tunnelId });

    }

    /*启动Tcp隧道客户端程序,只会调用一次
    * 连接到服务端
     */
    async startTunnel(tunnelId) {

        if (this.started) {
            logger.debug("Tcp TunnelClient has already started.");
            return;

        }
        this.started = true;



        this.tcpClient.start();

        this.tcpClient.eventEmitter.on('connect', () => {
            this.tcpClient.sendCodecData({ command: 'authen', authenKey: this.authenKey, tunnelId: tunnelId });
        });

        this.tcpClient.eventEmitter.on('onCodecMessage', data => {

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

                });



                //local service server's end
                localSocket.on('end', (hadError) => {
                    logger.trace('localSocket end:' + JSON.stringify(this.localAddress) + ',proxy client:' + JSON.stringify(data.middlePort));
                    if (localSocket.middleSocket != null) {
                        localSocket.middleSocket.end();
                        localSocket.middleSocket.destroy();
                        localSocket.middleSocket = null;
                    }
                });

            }
           else if(data.command=='quitClient'){
                logger.debug('recevie command (quitClient)=>' + data.info);
                this.tcpClient.eventEmitter.emit('quitClient',data);
                this.tcpClient.client.end();
            }
        });

    }

}

module.exports = TcpTunnelClient;