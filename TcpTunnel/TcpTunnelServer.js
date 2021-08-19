const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const TcpTunnelProtocal = require('./TcpTunnelProtocal');
const { Client, Tunnel } = require('../Db/Models');
const getPort = require('get-port');

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
        this.tunnelProxyServers = new Map();
    }



    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        this.tcpServer.start();

        this.tcpServer.eventEmitter.on('onCodecMessage', (data, socket) => {
            if (data.command == 'authen') {
                this.authen(data, socket);
            } else if (data.command == 'stopTunnel') {
                this.stopTunnel(data, socket);
            }
        });

        this.tcpServer.eventEmitter.on('socketError', (socket, err) => {
            if (socket.proxyServer != null) {
                socket.proxyServer.close();
                logger.warn('auto confirm close proxy server by socket\'error:' + err);
            }
        });
        this.tcpServer.eventEmitter.on('socketLost', (socket) => {
            if(socket.authenKeyAndTunnelId!=null){
                this.authenMap.delete(socket.authenKeyAndTunnelId);
            }
        });
        this.authenMap = new Map();
    }

    /**
     * 
     * @param {Socket} fromSocket from local socket
     * @param {Object} config proxy config
     * @returns 
     */
    createProxyServer(fromSocket, config) {

        let proxyServer = net.createServer(async (proxySocket) => {
            let info = `remote{${proxySocket.remoteAddress}:${proxySocket.remotePort}}->local:{${proxySocket.localAddress}:${proxySocket.localPort}}`;
            let commingInfo = `proxyServer new tcp  client ` + info;
            logger.info(commingInfo);

            //let middlePort = await getPort();
            let middlePort = 0;

            let middleServer = net.createServer((middleSocket) => {
                middleSocket.pipe(proxySocket);
                proxySocket.pipe(middleSocket);
                middleSocket.on('error', (error) => {
                    logger.error('middleSocket socket error' + error);
                });
            });

            middleServer.maxConnections = 1;
            middleServer.listen({ port: 0 }, () => {
                let port = middleServer.address().port;
                middlePort = port;
                this.tcpServer.sendCodecData2OneClient({ command: 'newClientComming', middlePort: port }, fromSocket);
                logger.info(`proxyServer's middleServer started at:${port}`);
            });

            middleServer.on('close', () => {
                console.log(`middleserver closed:` + middlePort);
            });

            middleServer.on('error', (err) => {
                logger.error(`middleserver error:${middlePort} ` + +err);
                
            });

            proxySocket.on('end', () => {

                logger.warn(`proxyServer socket end--` + info);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });


            proxySocket.on('timeout', () => {
                logger.warn('proxyServer socket timeout,socketTime=' + this.socketTime);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });

            proxySocket.on('error', (error) => {
                logger.error('proxyServer socket error=>' + error);
            });

        });

        proxyServer.on('error', (err) => {
            logger.error(`proxyServer error ${proxyServer.address()} ` + +err);
            
        });

        proxyServer.listen(config, () => {
            logger.info("Tcp  server started success:" + JSON.stringify(proxyServer.address()));
        });

        return proxyServer;
    }

    async stopTunnel(data, socket) {

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

        logger.info('client told server stop proxy server:' + tunnel.remotePort);

        let server = this.tunnelProxyServers.get(data.tunnelId);

        if (server != null) {

            this.tunnelProxyServers.delete(data.tunnelId);
            server.close();
            logger.info('proxy server closed:' + tunnel.remotePort);

        }
    }

    /**
     * 通知客户端退出
     * @param {net.Socket}} socket 
     * @param {string} info 
     */
    notifyCloseClient(socket, info) {
        this.tcpServer.sendCodecData2OneClient({ command: 'quitClient', info: info }, socket);
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
            logger.warn('error authen key:' + data.authenKey);
            this.notifyCloseClient(socket, 'error authen key');
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

        let authenKeyAndTunnelId=data.authenKey+":"+data.tunnelId;

        if (this.authenMap.has(authenKeyAndTunnelId)) {
            this.notifyCloseClient(socket, 'this authenKey&tunnelId  is already online');
            return;
        }
        
        this.authenMap.set(authenKeyAndTunnelId, { enterTime: new Date() });
        socket.authenKeyAndTunnelId=authenKeyAndTunnelId;
        logger.info('start creating tcp proxy server:' + tunnel.remotePort);
        let server = this.createProxyServer(socket, { host: '0.0.0.0', port: tunnel.remotePort });
        this.tunnelProxyServers.set(data.tunnelId, server);
        socket.proxyServer = server;
    }


}

module.exports = TcpTunnelServer;