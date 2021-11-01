const dgram = require('dgram');
const logger = require('../Log/logger');
const Socket = require('socket.io-client').Socket;

class UdpTunnelServer {

    /**
     * 
     * @param {string} authenKey 
     * @param {Socket} socketIOSocket 
     */
    constructor(udpTunnelItemOption, socketIOSocket) {

        this.serverName = 'udpServer:' + udpTunnelItemOption.id;
        this.udpServer = this._createUdpServer(udpTunnelItemOption.remotePort, udpTunnelItemOption.id);
        this.socketIOSocket = socketIOSocket;
        this.tunnelId = udpTunnelItemOption.id;
        this.eventName = 'client.back.udp:' + this.tunnelId;
        this.stopEventName = 'server.send.udpserverClosed:' + this.tunnelId;
        this._started = false;

        //----------------------------------------------------
        socketIOSocket.once('disconnect', () => {
            let clientId = socketIOSocket.handshake.auth.clientId;
            this.stop();
        });
    }

    onMessage = (msg, rinfo) => {
        this.udpServer.send(msg, rinfo.port, rinfo.address);
    };

    start() {
        if (this._started) {
            logger.warn('UdpTunnelServer has already started');
            return;
        }
        logger.trace('udp tunnel server start,tunnel.id=' + this.tunnelId);
        this._started = true;
        this.socketIOSocket.on(this.eventName, this.onMessage);
    }

    _createUdpServer(port, tunnelId) {

        let serverName = this.serverName;
        //创建 udp server
        let udpServer = dgram.createSocket('udp4');
        logger.trace('_createUdpServer:' + port);
        udpServer.bind(port); // 绑定端口
        logger.trace('_createUdpServer2:' + port);
        // 监听端口
        udpServer.on('listening', () => {
            const address = udpServer.address();
            logger.debug(`${serverName}, listening ${address.address}:${address.port}`);
        });

        //接收消息
        udpServer.on('message', (msg, rInfo) => {
            this.socketIOSocket.emit('server.send.udp:' + tunnelId, { msg: msg, rInfo: { address: rInfo.address, port: rInfo.port } });
        });

        //错误处理
        udpServer.on('error', (err) => {
            logger.warn(`some error on  ${serverName} ` + err)
        });

        return udpServer;
    }



    stop() {
        logger.trace('udp tunnel server stop,tunnel.id=' + this.tunnelId);
        this.socketIOSocket.off(this.eventName, this.onMessage);
        this.socketIOSocket.emit(this.stopEventName, this.tunnelId);
        if (this.udpServer) {
            this.udpServer.removeAllListeners();
            this.udpServer.close();
            this.udpServer = null;
        }

    }

}

module.exports = UdpTunnelServer;