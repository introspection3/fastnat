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
     * @param {Object} tcpClientConfig 
     * @param {number} defaultTimeout
     */
    constructor(tcpClientConfig,defaultTimeout=5000) {
        this.started = false;
        this.tcpClient = new TcpClient(tcpClientConfig);
        this.defaultTimeout=defaultTimeout;
        this.defaultTimeout=defaultTimeout;
    }

    /**
     * 
     * @returns {Promise}
     */
    start() {

        if (this.started) {
            logger.debug("RcpTcpClient has already started.");
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
                reject('tcp client connect to server timeout:'+this.defaultTimeout)
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
     * @param {string} serverSignature which server service etc.
     * @param {string} method 
     * @param {Array} args 
     * @param {Number} timeout 
     * @return {Promise}
     */
    invoke(serverSignature,method, args,timeout=5000) {

        let data = new RpcClientProtocal({});
        data.serverSignature=serverSignature;
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