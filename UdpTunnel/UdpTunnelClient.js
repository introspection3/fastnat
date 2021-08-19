const dgram = require('dgram');
const logger = require('../Log/logger');
const RpCTcpClient = require('../Rpc/RpcTcpClient');

class UdpTunnelClient{

    /**
     * 
     * @param {string} authenKey 
     * @param {Object} rpcServerAddress 
     * @param {Object} localAddress 
     */
    constructor(authenKey, rpcServerAddress, localAddress) {
        this.authenKey=authenKey;
        this.udpTunnelServerAddress=rpcServerAddress;
        this.localAddress=localAddress;
        this.rcpClient = new RpCTcpClient(rpcServerAddress);
    }

    async start(){

        await this.rcpClient.start();
    
        let udpClient = dgram.createSocket('udp4');

        udpClient.on('close', function () {
            console.log('udp client closed.')
        });
        
        //错误处理
        udpClient.on('error', function () {
            console.log('some error on udp client.')
        })
        
        // 接收消息
        udpClient.on('message', function (msg, rinfo) {
            console.log(`receive message from ${rinfo.address}:${rinfo.port}：${msg}`);
        });
        const message = Buffer.from('Some bytes');
        udpClient.connect(udpPort, '192.168.1.3', (err) => {
            udpClient.send(message, (err) => {
        
            });
        });
        
    }

}