'use strict';

const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');
const TcpServer = require('../Tcp/TcpServer');
const {RpcClientProtocal,RpcServerProtocal}=require('./RpcProtocal');

/**
 * Tcp隧道服务端程序
 */
class RpcTcpServer {

    /**
     * 
     * @param {TcpServer} tcpServer 
     */
    constructor(tcpServer) {
        this.tcpServer = tcpServer;
    }


    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        this.tcpServer.start();
        this.tcpServer.eventEmitter.on('onMessage', (dataBuffer, socket) => {


        });

        this.tcpServer.eventEmitter.on('onCodecMessage', (data, socket) => {
            let result = this[data.method](...data.args);
            let response=new RpcServerProtocal({});
            response.result=result;
            response.uuid=data.uuid;
            this.tcpServer.sendCodecData2OneClient(response,socket);
        });
        

    }


    add(a, b) {
        return a + b;
    }



}

module.exports = RpcTcpServer;