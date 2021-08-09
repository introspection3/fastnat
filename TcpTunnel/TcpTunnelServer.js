const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const TcpTunnelProtocal = require('./TcpTunnelProtocal');
const { Client, Tunnel } = require('../Db/Models');

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
            this.authen(data, socket);
        });

    }

    /**
     * 
     * @param {Socket} fromSocket from local socket
     * @param {Object} config proxy config
     * @returns 
     */
    createProxyServer(fromSocket, config) {

        let proxyServer = net.createServer((proxySocket) => {

            let commingInfo = `proxyServer new tcp  client comming:${proxySocket.remoteAddress}:${proxySocket.remotePort},local=${proxySocket.localAddress}:${proxySocket.localPort}`;

            logger.info(commingInfo);

            let middlePort = 1111;

            let middleServer = net.createServer((middleSocket) => {
                middleSocket.pipe(proxySocket);
                proxySocket.pipe(middleSocket);
            });

            middleServer.maxConnections = 1;

            middleServer.listen({ host: '0.0.0.0', port: middlePort }, () => {
                logger.info(`proxyServer's middleServer started at:${middlePort}` );
            });

            proxySocket.on('end', () => {
                logger.warn(`proxyServer on socket end,remoteAddress=${proxySocket.remoteAddress}:${proxySocket.remotePort}, localAddress=${proxySocket.localAddress}:${proxySocket.localPort}`);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });


            proxySocket.on('timeout', () => {
                logger.warn('proxyServer on socket timeout,socketTime=' + this.socketTime);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });
            
            this.tcpServer.sendCodecData2OneClient({ command: 'newClientComming', middlePort: middlePort }, fromSocket);

        });

        proxyServer.listen(config, () => {
            logger.info("Tcp  server started success:" + JSON.stringify(config));
        });

        return proxyServer;
    }

    /**
     * 处理来之客户端的授权信息
     * @param {TcpTunnelProtocal} data 
     * @param {net.Socket} socket 
     */
    async authen(data, socket) {

        let clientInfo = await Client.findOne({
            where: {
                authenKey: data.authenKey,
                isAvailable: true
            }
        });

        if (clientInfo == null) {
            //  this.#notifyCloseClient(socket, 'error authen key');
            logger.warn('error authen key:' + data.authKey);
            setTimeout(() => {
                socket.end();
                socket.destroy();
            }, 1000);
            return;
        }



        let tunnel = await Tunnel.findOne({
            where: {
                id: data.tunnelId,
                clientId: clientInfo.id,
                isAvailable: true
            }
        })


        if (tunnel == null || tunnel.length == 0) {
            logger.warn('error tunnel id:' + data.tunnelId);
            setTimeout(() => {
                socket.end();
                socket.destroy();
            }, 1000);
            return;
        }

        logger.info('start create proxy server:' + tunnel.remotePort);
        this.createProxyServer(socket, { host: '0.0.0.0', port: tunnel.remotePort });


    }


}

module.exports = TcpTunnelServer;