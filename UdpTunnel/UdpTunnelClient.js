const dgram = require('dgram');
const logger = require('../Log/logger');
const Socket = require('socket.io-client').Socket;

class UdpTunnelClient {

    outTime = new Date('2000/03/28 10:17:22');

    /**
     * 
     * @param {Socket} socketIOSocket 
     * @param {Tunnel} udpTunnelItemOption 
     */
    constructor(socketIOSocket, udpTunnelItemOption,clientTimeout=5000) {
        this.udpTunnelItemOption = udpTunnelItemOption;
        this.socketIOSocket = socketIOSocket;
        this.eventName = 'server.send.udp:' + this.udpTunnelItemOption.id;
        this.backEventName = 'client.back.udp:' + this.udpTunnelItemOption.id;
        this.socketIOSocket.on(this.eventName, (msg, rInfo) => {
            let udpClient = this.#getUdpClient(udpTunnelItemOption.localIp, udpTunnelItemOption.localPort, udpTunnelItemOption.id, rInfo);
            //转发udp包
            udpClient.send(msg);
        });

        this.udpClientMap = new Map();
        this._checkUdpClientTimer = this.#checkUdpClient(clientTimeout);
    }

    start(){
        this.socketIOSocket.emit('client.createUpdTunnelServer',this.udpTunnelItemOption,(backData) => {

        });
    }

    stop() {
        this.socketIOSocket.off(this.eventName);
        this.destoryAllUdpClient();
        clearInterval(this._checkUdpClientTimer);
    }

    destoryAllUdpClient() {
        for (let [key, udpClient] of this.udpClientMap) {
            udpClient.close();
        }
        this.udpClientMap.clear();
    }

    #checkUdpClient(ms) {
        let timer = setInterval(() => {
            for (let [key, udpClient] of this.udpClientMap) {
                let time = parseInt(new Date() - udpClient.lastMessageTime);
                if (ms >= time) {
                    udpClient.close();
                    this.udpClientMap.delete(key);
                }
            }
        }, ms);
        return timer;
    }

    #getUdpClient(localIp, localPort, tunnelId, rInfo) {
        let clientName = `udpClient-${tunnelId}-(${rInfo.address}:${rInfo.port})`;
        if (this.udpClientMap.has(clientName)) {
            return this.udpClientMap.get(clientName);
        } else {
            let udpClient = this.#createUdpClient(udpTunnelItemOption);
            this.udpClientMap.set(clientName, udpClient);
            return udpClient;
        }
    }

    #createUdpClient(localIp, localPort, tunnelId, vistorRemoteInfo) {
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
            this.socketIOSocket.emit(this.backEventName, msg, vistorRemoteInfo); //必须告诉服务器访问者的端口地址信息
        });

        udpClient.connect(localPort, localIp, (err) => {
            udpClient.lastMessageTime = this.outTime;
            logger.warn(err);
        });
        return udpClient;
    }

}
module.exports=UdpTunnelClient;