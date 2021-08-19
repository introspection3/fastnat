
const dgram = require('dgram');
const logger = require('../Log/logger');
const RpcTcpServer = require('../Rpc/RpcTcpServer');

class UdpTunnelServer {

    /**
     * 
     * @param {string} authenKey 
     * @param {Object} udpTunnelServerAddress 
     * @param {Object} localAddress 
     */
    constructor(rpcServerAddress) {
        this.rpcTcpServer = new RpcTcpServer(rpcServerAddress);

    }

    #createUpdServer(port, serverName = 'udpServer') {

        //创建 udp server
        let udpServer = dgram.createSocket('udp4');

        udpServer.bind(port); // 绑定端口

        // 监听端口
        udpServer.on('listening', function () {
            const address = server.address();
            console.log(`${serverName} listening ${address.address}:${address.port}`);
        });

        //接收消息
        udpServer.on('message', function (msg, rinfo) {
            strmsg = msg.toString();
            udpServer.send(strmsg, 0, strmsg.length, rinfo.port, rinfo.address); //将接收到的消息返回给客户端
            console.log(`udp ${serverName} received data: ${strmsg} from ${rinfo.address}:${rinfo.port}`)
        });

        //错误处理
        udpServer.on('error', function (err) {
            console.log(`some error on udp ${serverName} server.==>` + err)
            udpServer.close();
        });

        return udpServer;
    }
    
    start() {
        this.rpcTcpServer.start();
    }

}