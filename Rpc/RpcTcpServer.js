'use strict';

const logger = require('../Log/logger');
const net = require('net');
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const {RpcClientProtocal,RpcServerProtocal}=require('./RpcProtocal');
const path = require('path');

/**
 * Tcp隧道服务端程序
 */
class RpcTcpServer {

    /**
     * 
     * @param {Object} tcpServer' config
     */
    constructor(tcpServerConfig,dirPath=null) {
        this.setServicesDirLocation(dirPath);
        this.tcpServer = new TcpServer(tcpServerConfig);
    }

    /**
     * set services js directory path
     * @param {string} dirPath 
     */
    setServicesDirLocation(dirPath){
        if(dirPath===null||dirPath===''){
            dirPath='./services'
        }
        dirPath=path.join(process.cwd(),dirPath);
        console.log(dirPath);
        this.path=dirPath;
    }

    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        this.tcpServer.start();

        this.tcpServer.eventEmitter.on('onMessage', (dataBuffer, socket) => {

        });

        this.tcpServer.eventEmitter.on('onCodecMessage', (data, socket) => {
            let serverSignaturePath=path.join(this.path,data.serverSignature);
            let targetObj=require(serverSignaturePath);
            let result = targetObj[data.method](...data.args);
            let response=new RpcServerProtocal({});
            response.result=result;
            response.uuid=data.uuid;
            this.tcpServer.sendCodecData2OneClient(response,socket);
        });

    }
}

module.exports = RpcTcpServer;