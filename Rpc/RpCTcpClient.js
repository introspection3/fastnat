'use strict';

const logger = require('../Log/logger');
const net = require('net');
const TcpClient = require('../Tcp/TcpClient');
const { RpcClientProtocal, RpcServerProtocal } = require('./RpcProtocal');
const { v4: uuidv4 } = require('uuid');
/**
 * Tcp隧道服务端程序
 */
class RpcTcpClient {

    /**
     * 
     * @param {TcpClient} tcpClient 
     * @param {number} defaultTimeout
     */
    constructor(tcpClient,defaultTimeout) {
        this.started = false;
        this.tcpClient = tcpClient;
        if(typeof defaultTimeout==undefined){
            this.defaultTimeout=10*1000;
        }
        this.defaultTimeout=defaultTimeout;
    }

    /**
     * 
     * @returns {Promise}
     */
    start() {

        if (this.started) {
            logger.warn("RcpTcpClient has already started.");
            return;
        }

        this.started = true;
        this.tcpClient.start();
        this.tcpClient.eventEmitter.on('connect', () => {
            this.tcpClient.eventEmitter.emit('started',true);
        });

        this.tcpClient.eventEmitter.on('onCodecMessage', (data, socket) => {
            this.tcpClient.eventEmitter.emit(data.uuid, data.result);
        });

        let p = new Promise((resolve, reject) => {
            let t=setTimeout(() => {
                reject('timeout:'+this.defaultTimeout)
            }, this.defaultTimeout);

            this.tcpClient.eventEmitter.once('started', (result) => {
                clearTimeout(t);
                resolve(result);
            });
        });
        return p;

    }

    /**
     * 调用远程服务器指定的方法
     * @param {string} method 
     * @param {Array} args 
     * @return {Promise}
     */
    invoke(method, args) {

        let data = new RpcClientProtocal({});
        data.method = method;
        data.args = args;
        data.uuid = uuidv4();
        this.tcpClient.sendCodecData(data);

        let p = new Promise((resolve, reject) => {
            let t=setTimeout(() => {
                reject('timeout:'+this.defaultTimeout)
            }, this.defaultTimeout);

            this.tcpClient.eventEmitter.once(data.uuid, (result) => {
                clearTimeout(t);
                resolve(result);
            });

        });
        return p;
    }
}

module.exports = RpcTcpClient;