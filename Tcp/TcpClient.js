'use strict';

const logger = require('../Log/logger');
const net = require('net');
const TcpPackUtil = require('./TcpPackUtil');
const headBytesCount = 4;
const events = require('events');
const ClassUtil = require('../Utils/ClassUtil');

/**
 * Tcp隧道服务端程序
 */
class TcpClient {

    constructor(serverAddress) {
        this.serverAddress = serverAddress;
        this.started = false;
        this.eventEmitter = new events.EventEmitter();
        this.client = null;
        this.codec = 'utf8';
    }

    /**
     * 设置编解码器
     * @param {Object} codec 实现了implement enode,decode function的编解码器
     */
    setCodec(codec) {
        if (codec !== 'utf8') {
            let ok = ClassUtil.hasMethods(codec, 'encode', 'decode');
            if (!ok) {
                throw new Error('codec not implement enode,decode function');
            }
        }
        this.codec = codec;
    }
    toString() {
        return JSON.stringify(this.serverAddress);
    }
    /*启动Tcp隧道客户端程序,只会调用一次
    * 连接到服务端
     */
    start() {
        let instance = this;
        if (this.started) {
            logger.warn("Tcp client has already started.");
            return;
        }

        this.started = true;

        let lastTempBuffer = null;
        /**
      * 通知有完整的数据来了
      * @param {Buffer} dataBuffer 
      * @param {Socket} targetSocket 对应的socket
      */
        function notify(dataBuffer, targetSocket) {
            instance.eventEmitter.emit('onMessage', dataBuffer, targetSocket);
            if (instance.codec === 'utf8') {
                let str = dataBuffer.toString('utf8');
                let data = JSON.parse(str)
                instance.eventEmitter.emit('onCodecMessage', data, targetSocket);
            } else {
                let data = instance.codec.decode(dataBuffer);
                instance.eventEmitter.emit('onCodecMessage', data, targetSocket);
            }
        }


        /**
        * 处理socket数据
        * @param {Buffer} dataBuffer 
        */
        function processCommingBuffer(dataBuffer) {
            //没有历史存留的不完整数据
            if (lastTempBuffer == null) {
                let dataLength = dataBuffer.length - headBytesCount;
                let head = dataBuffer.slice(0, headBytesCount);
                let bodyLength = head.readUInt32BE();
                //传来的数据比数据包要长
                if (bodyLength < dataLength) {
                    let pack = dataBuffer.slice(headBytesCount, bodyLength + headBytesCount);
                    notify(pack,instance.client);
                    let leftBuffer = dataBuffer.slice(headBytesCount + bodyLength);
                    processCommingBuffer(leftBuffer);
                    return;
                } else if (bodyLength == dataLength) {
                    let pack = dataBuffer.slice(headBytesCount, bodyLength + headBytesCount);
                    notify(pack,instance.client);
                    lastTempBuffer = null;
                    return;
                } else {
                    lastTempBuffer = dataBuffer.slice(headBytesCount, bodyLength);
                    return;
                }
                return;
            }

            let newBuffer = Buffer.concat([lastTempBuffer, dataBuffer]);
            lastTempBuffer = null;
            processCommingBuffer(newBuffer);

        }

        // 创建用于连接校验服务端的 客户端连接
        let client = net.createConnection(this.serverAddress, () => {
            logger.info('Tcp client has created');
        });

        client.on('connect', () => {
            logger.info('Tcp client has connected to ' + this.toString());
            this.client = client;
            this.eventEmitter.emit('connect');
        });

        client.on('data', (dataBuffer) => {

            processCommingBuffer(dataBuffer);
        });

        client.on('close', (data) => {
            this.eventEmitter.emit('close');
            logger.info('Tcp Client Closed:' + this.toString())
        });

    }

    /**
     * 发送
     * @param {Buffer} dataBuffer 二进制数据
     */
    send(dataBuffer) {
        let pack = TcpPackUtil.packData(dataBuffer);
        if (this.client == null) {
            throw new Error('this.client is not ready,please use  this.eventEmitter.addListener on connect event');
        }
        this.client.write(pack);
    }

    /**
     * 通过编解码器发送数据
     * @param {Object} data 
     */
    sendCodecData(data) {
        if (this.codec === 'utf8') {
            let jsonStr = JSON.stringify(data);
            let body = Buffer.from(jsonStr);
            this.send(body);
        } else {
            let body = this.codec.encode(data);
            this.send(body);
        }

    }


}

module.exports = TcpClient;