'use strict';

const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');


/**
 * Tcp隧道服务端程序
 */
class TcpServer {

    host = '0.0.0.0';

    port = 3927;

    /** socket server */
    server = null;

    /**是否已经启动 */
    started = false;

    /**socket的超时时间 */
    socketTime=10*60000;

    props={};
    
    constructor(props) {
        this.props=props;
        this.host = props.host || this.host;
        this.port = props.port || this.port;
        this.socketTime=props.socketTime||this.socketTime;
        this.started = false;
        this.server = null;
        this.eventEmitter = new events.EventEmitter();
    }

    toString() {
        return `TcpServer:${JSON.stringify(this.props)}`;
    }

    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        if (this.started) {
            logger.warn(this + " has already started.");
            return;
        }
        this.started = true;

        this.server = net.createServer((socket) => {

            let commingInfo = `new tcp  client comming:${socket.remoteAddress}:${socket.remotePort},local=${socket.localAddress}:${socket.localPort}`;

            let lastTempBuffer = null;
            logger.info(commingInfo);
           
            socket.setTimeout(this.socketTime);
            //socket.setEncoding('utf8');
            let instance = this;
            /**
             * 通知有完整的数据来了
             * @param {Buffer} dataBuffer 
             */
            function notify(dataBuffer) {
                instance.eventEmitter.emit('onMessage', dataBuffer,socket);
                
            }

            0            /**
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
                        notify(pack);
                        let leftBuffer = dataBuffer.slice(headBytesCount + bodyLength);
                        processCommingBuffer(leftBuffer);
                        return;
                    } else if (bodyLength == dataLength) {
                        let pack = dataBuffer.slice(headBytesCount, bodyLength + headBytesCount);
                        notify(pack);
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

            socket.on('data', (dataBuffer) => {
                processCommingBuffer(dataBuffer);
            });

            socket.on('end', () => {
                lastTempBuffer = null;
                logger.warn('Tcp  server on socket end ' + err);
                socket.end();
                socket.destroy();
            });
            socket.on('error', (err) => {
                lastTempBuffer = null;
                logger.warn('Tcp  server on socket error ' + err);
                socket.end();
                socket.destroy();
            });
            socket.on('timeout', () => {
                lastTempBuffer = null;
                logger.warn('Tcp  server on socket timeout,socketTime='+this.socketTime);
                socket.end();
                socket.destroy();
            });

        });

        this.server.listen({ host: this.host, port: this.port }, () => {
            logger.info("Tcp  server started:" + this);
        });
        return this.server;
    }

}

module.exports = TcpServer;