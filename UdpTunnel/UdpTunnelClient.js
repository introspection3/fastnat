const dgram = require('dgram');
const logger = require('../Log/logger');
const Socket = require('socket.io-client').Socket;
const commandType = require('../Communication/CommandType').commandType;

class UdpTunnelClient {

    outTime = new Date('2000/03/28 10:17:22');

    /**
     * 
     * @param {Socket} socketIOSocket 
     * @param {Tunnel} udpTunnelItemOption 
     */
    constructor(socketIOSocket, udpTunnelItemOption, udpClientTtl = 5000) {
        this.udpTunnelItemOption = udpTunnelItemOption;
        this.socketIOSocket = socketIOSocket;
        this.eventName = 'server.send.udp:' + this.udpTunnelItemOption.id;
        this.backEventName = 'client.back.udp:' + this.udpTunnelItemOption.id;
        this.socketIOSocket.on(this.eventName, this.onMessage);

        this.udpClientMap = new Map();
        this._checkUdpClientTimer = this._checkUdpClientInterval(udpClientTtl);
    }

    onMessage = (data) => {
        let msg = data.msg;
        let rInfo = data.rInfo;
        let udpTunnelItemOption = this.udpTunnelItemOption;
        let udpClient = this._getUdpClient(udpTunnelItemOption.localIp, udpTunnelItemOption.localPort, udpTunnelItemOption.id, rInfo);
        //转发udp包
        udpClient.send(msg, udpTunnelItemOption.localPort, udpTunnelItemOption.localIp);
    };

    start() {
        this.socketIOSocket.emit(commandType.CLIENT_CREATE_UDP_TUNNEL_SERVER, this.udpTunnelItemOption, (backData) => {
            if (backData.success === false) {
                logger.error(backData.info);
                this.stop();
            }
        });
    }

    stop() {
        this.destoryAllUdpClient();
        clearInterval(this._checkUdpClientTimer);
        this.socketIOSocket.emit(commandType.CLIENT_STOP_UDP_TUNNEL_SERVER, this.udpTunnelItemOption, (backData) => {
            logger.trace('client recevie client.stopUpdTunnelServer,tunnel.id=' + this.udpTunnelItemOption.id);
        });
        this.socketIOSocket.off(this.eventName);
    }

    destoryAllUdpClient() {
        for (let [key, udpClient] of this.udpClientMap) {
            udpClient.removeAllListeners()
            udpClient.close();
        }
        this.udpClientMap.clear();
    }

    _checkUdpClientInterval(udpClientTtl) {
        let timer = setInterval(() => {
            for (let [key, udpClient] of this.udpClientMap) {
                let time = parseInt(new Date() - udpClient.lastMessageTime);
                if (time > udpClientTtl) {
                    udpClient.close();
                    this.udpClientMap.delete(key);
                }
            }
        }, udpClientTtl);
        return timer;
    }

    /**
     * 
     * @param {string} localIp 
     * @param {Number} localPort 
     * @param {Number} tunnelId 
     * @param {Object} rInfo 
     * @returns {dgram.Socket}
     */
    _getUdpClient(localIp, localPort, tunnelId, rInfo) {
        let clientName = `udpClient-${tunnelId}-(${rInfo.address}:${rInfo.port})`;
        if (this.udpClientMap.has(clientName)) {
            return this.udpClientMap.get(clientName);
        } else {
            let udpClient = this._createUdpClient(localIp, localPort, tunnelId, rInfo);

            this.udpClientMap.set(clientName, udpClient);
            return udpClient;
        }
    }

    _createUdpClient(localIp, localPort, tunnelId, vistorRemoteInfo) {
        let clientName = `udpClient-${tunnelId}-(${vistorRemoteInfo.address}:${vistorRemoteInfo.port})`;
        let udpClient = dgram.createSocket('udp4');
        udpClient.lastMessageTime = new Date();
        udpClient.on('close', () => {
            logger.debug(clientName + ' close');
        });

        //错误处理
        udpClient.on('error', (err) => {
            udpClient.lastMessageTime = this.outTime;
            logger.warn(clientName + ' err:' + err)
        })

        // 接收消息
        udpClient.on('message', (msg, rinfo) => {
            udpClient.lastMessageTime = new Date();
            this.socketIOSocket.emit(this.backEventName, msg, vistorRemoteInfo); //必须告诉服务器访问者的端口地址信息,好发回去
        });

        udpClient.connect(localPort, localIp, () => {
            udpClient.lastMessageTime = this.outTime;
        });
        return udpClient;
        ``
    }

}
module.exports = UdpTunnelClient;