'use strict';

const logger = require('../Log/logger');
const net = require('net');
const TcpClient = require('../Tcp/TcpClient');
const TcpTunnelProtocal = require('../TcpTunnel/TcpTunnelProtocal');
/**
 * Tcp隧道服务端程序
 */
class TcpTunnelClient {

    /**
     * 
     * @param {Object} serverAddress 
     * @param {Object} localAddress 
     * @param {TcpClient} tcpClient 
     */
    constructor(authenKey,serverAddress, localAddress,tcpClient) {
        this.authenKey=authenKey
        this.serverAddress = serverAddress;
        this.localAddress = localAddress;
        this.started = false;
        this.tcpClient=tcpClient;
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
        
        this.tcpClient.start();
        this.tcpClient.eventEmitter.on('connect',()=>{
            
            let protocal=new  TcpTunnelProtocal({});
            protocal.command='authen';
            protocal.authKey=this.authenKey;
            protocal.data={};            
            this.tcpClient.sendCodecData(protocal);

        });

        this.tcpClient.eventEmitter.on('onCodecMessage',(data,socket)=>{   
            this[data.command](data,socket);
       });
       
    }

    
    closeClient(data,socket){
        logger.warn('recevie command (closeClient)'+data.info);
        this.tcpClient.client.end();
    }
    
    clientInfo(data,socket){
        logger.info(data);
         
    }

}

module.exports = TcpTunnelClient;