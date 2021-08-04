'use strict';

const logger = require('../Log/logger');
const net = require('net');
/**
 * Tcp隧道服务端程序
 */
class TcpTunnelClient {

    constructor(serverAddress, localAddress) {
        this.serverAddress = serverAddress;
        this.localAddress = localAddress;
        this.started = false;
    }

    /*启动Tcp隧道客户端程序,只会调用一次
    * 连接到服务端
     */
    start() {

        if (this.started) {
            logger.warn("TcpTunnelClient has already started.");
            return;
        }
        this.started = true;
        // 创建用于连接校验服务端的 客户端连接
        let link2ServerClient = net.createConnection(this.serverAddress, () => {

        });

        link2ServerClient.setTimeout(60000 * 10);
        link2ServerClient.on('data', (data) => {
            //服务端来数据了....  
            //把服务端的数据,请求到自己的本地目标
            

        });
    }


}

module.exports = TcpTunnelClient;