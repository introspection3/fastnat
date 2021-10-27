const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const TcpTunnelProtocal = require('./TcpTunnelProtocal');
const { Client, Tunnel } = require('../Db/Models');
const getPort = require('get-port');
const ClusterData = require('../Common/ClusterData');
const GlobalData = require('../Common/GlobalData');
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
            if (data.command == 'authen') {
                this.authen(data, socket);
            } else if (data.command == 'stopTunnel') {
                this.stopTunnel(data, socket);
            }
        });

        this.tcpServer.eventEmitter.on('socketError', (socket, err) => {

        });

        this.tcpServer.eventEmitter.on('socketLost', (socket) => {
            if (socket.proxyServer != null) {
                socket.proxyServer.close();
                logger.debug('auto  close proxy server as tunnel client socketLost');
            }
            if (socket.authenKeyAndTunnelId != null) {
                logger.trace('ClusterData.deleteAsync(socket.authenKeyAndTunnelId)' + socket.authenKeyAndTunnelId);
                ClusterData.deleteAsync(socket.authenKeyAndTunnelId);
            } else {
                logger.error('socket.authenKeyAndTunnelId==null');
            }
        });

    }

    /**
     * 
     * @param {Socket} fromSocket from local socket
     * @param {Object} config proxy config
     * @returns 
     */
    createProxyServer(fromSocket, config) {

        let proxyServer = net.createServer(async(proxySocket) => {

            let info = `remote{${proxySocket.remoteAddress}:${proxySocket.remotePort}}->local:{${proxySocket.localAddress}:${proxySocket.localPort}}`;
            let commingInfo = `proxyServer new tcp  client ` + info;
            logger.trace(commingInfo);

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
                logger.trace(`proxyServer's middleServer started at:${port}`);
            });

            middleServer.on('close', () => {
                console.log(`middleserver closed:` + middlePort);
            });

            middleServer.on('error', (err) => {
                logger.error(`middleserver error:${middlePort} ` + +err);

            });

            proxySocket.on('close', (hadError) => {
                logger.debug(`proxyServer socket close hadError=` + hadError);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });

            proxySocket.on('end', () => {
                logger.debug(`proxyServer socket end--` + info);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });


            proxySocket.on('timeout', () => {
                logger.debug('proxyServer socket timeout,socketTime=' + this.socketTime);
                proxySocket.end();
                proxySocket.destroy();
                middleServer.close();
            });

            proxySocket.on('error', (error) => {
                logger.error('proxyServer socket error=>' + error);
            });

        });

        proxyServer.on('error', (err) => {
            logger.error(`proxyServer error ${proxyServer.address()} ` + err);
        });

        proxyServer.listen(config, () => {
            logger.trace("tcp  proxyServer started success:" + JSON.stringify(proxyServer.address()));
        });

        return proxyServer;
    }

    async stopTunnel(data, socket) {

        let tunnel = await this._getTunnel(data.authenKey, data.tunnelId);
        if (!tunnel) {
            logger.debug('error authen key:' + data.authenKey);
            setTimeout(() => {
                socket.end();
                socket.destroy();
            }, 1000);
            return;
        }

        logger.trace('client told server stop proxy server:' + tunnel.remotePort);
        await this.stopTunnelProxyServer(data, socket);
    }

    async stopTunnelProxyServer(data, socket) {
        let tunnelId = data.tunnelId;
        let authenKeyAndTunnelId = data.authenKey + ":" + data.tunnelId;
        await ClusterData.deleteAsync(authenKeyAndTunnelId);
        let server = socket.proxyServer;
        if (server != null) {
            server.close();
            logger.trace('stopTunnelProxyServer:tunnelId=' + tunnelId);
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

    async _getTunnel(authenKey, tunnelId) {
        let data = {
            authenKey: authenKey,
            tunnelId: tunnelId
        };

        let tunnel = await Tunnel.findOne({
            where: {
                isAvailable: true,
                id: tunnelId
            },
            include: [{
                model: Client,
                required: true,
                where: {
                    authenKey: data.authenKey,
                    isAvailable: true
                }
            }]
        });
        return tunnel;
    }

    /**
     * 处理来之客户端的授权信息
     * @param {TcpTunnelProtocal} data 
     * @param {net.Socket} socket 
     */
    async authen(data, socket) {
        let tunnel = await this._getTunnel(data.authenKey, data.tunnelId);
        if (!tunnel) {
            logger.debug('error authen key:' + data.authenKey);
            this.notifyCloseClient(socket, 'error authen key');
            setTimeout(() => {
                socket.end();
                socket.destroy();
            }, 1000);
            return;
        }

        let authenKeyAndTunnelId = data.authenKey + ":" + data.tunnelId;
        let exist = await ClusterData.existAsync(authenKeyAndTunnelId);
        if (exist) {
            let msg = `this authenKey&tunnelId (${authenKeyAndTunnelId}) is already online`;
            logger.debug(msg);
            this.notifyCloseClient(socket, msg);
            return;
        }

        await ClusterData.setAsync(authenKeyAndTunnelId, { enterTime: new Date() });
        socket.authenKeyAndTunnelId = authenKeyAndTunnelId;
        logger.trace('start creating tcp proxy server:' + tunnel.remotePort);
        let server = this.createProxyServer(socket, { host: '0.0.0.0', port: tunnel.remotePort });
        socket.proxyServer = server;
    }


}

module.exports = TcpTunnelServer;