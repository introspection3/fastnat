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
        this.udpServer = this._createUdpServer(udpTunnelItemOption.remotePort, udpTunnelItemOption.id);
        this.socketIOSocket = socketIOSocket;
        this.tunnelId = udpTunnelItemOption.id;
        this.eventName = 'client.back.udp:' + this.tunnelId;
        this.stopEventName = 'server.send.udpserverClosed:' + this.tunnelId;
        this._started = false;

        //---------
        socketIOSocket.once('disconnect', () => {
            let clientId = socketIOSocket.handshake.auth.clientId;
            this.stop();
        });
    }

    start() {
        if (this._started) {
            logger.warn('UdpTunnelServer has already started');
            return;
        }
        this._started = true;
        this.socketIOSocket.on(this.eventName, (msg, rinfo) => {
            this.udpServer.send(msg, rinfo.port, rinfo.address);
        })
    }

    _createUdpServer(port, tunnelId) {

        let serverName = 'udpServer:' + tunnelId;
        //创建 udp server
        let udpServer = dgram.createSocket('udp4');

        udpServer.bind(port); // 绑定端口

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
        this.socketIOSocket.emit(this.stopEventName, this.tunnelId);
        this.udpServer.close();
        this.udpServer = null;
    }

}

module.exports = UdpTunnelServer;