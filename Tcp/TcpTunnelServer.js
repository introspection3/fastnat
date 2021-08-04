'use strict';

const logger = require('../Log/logger');
const net = require('net');
const headBytesCount = 4;
const events = require('events');

/**
 * Tcp隧道服务端程序
 */
class TcpTunnelServer {

    host = '0.0.0.0';
    port = 3927;
    /**tunnel socket server */
    #tunnelServer = null;
    /**是否已经启动 */
    started = false;
    constructor(props) {
        this.host = props || props.host || '0.0.0.0';
        this.port = props || props.port || 3927;
        this.started = false;
        this.#tunnelServer = null;
        this.eventEmitter = new events.EventEmitter();
    }

    toString() {

        return 'host:port->(' + this.host + ', ' + this.port + ')';
    }

    /*启动Tcp隧道服务端程序,只会调用一次
     */
    start() {

        if (this.started) {
            logger.warn(this + " has started.");
            return;
        }
        this.started = true;

        this.#tunnelServer = net.createServer((socket) => {
            
            let commingInfo = `new tcp tunnel client comming:${socket.remoteAddress}:${socket.remotePort},local=${socket.localAddress}:${socket.localPort}`;
            let lastTempBuffer = null;
            logger.info(commingInfo);
            socket.setTimeout(500);
            //socket.setEncoding('utf8');
            let instance=this;
            /**
             * 通知有完整的数据来了
             * @param {Buffer} dataBuffer 
             */
            function notify(dataBuffer) {
                instance.eventEmitter.emit('onMessage',dataBuffer,socket);
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
                        notify(pack);
                        let leftBuffer = dataBuffer.slice(headBytesCount + bodyLength);
                        processCommingBuffer(leftBuffer);
                        return;
                    } else if (bodyLength == dataLength) {
                        notify(pack);
                        lastTempBuffer = null;
                        return;
                    } else {
                        lastTempBuffer = dataBuffer.slice(headBytesCount, bodyLength);
                        return;
                    }
                    return;
                }

                let newBuffer = Buffer.concat(lastTempBuffer, dataBuffer);
                lastTempBuffer = null;
                processCommingBuffer(newBuffer);

            }

            socket.on('data',  (dataBuffer)=> {                
                processCommingBuffer(dataBuffer);
            });

            socket.on('end',  ()=> {
                lastTempBuffer = null;
                logger.warn('Tcp Tunnel server on socket end' + err);
                socket.end();
                socket.destroy();
            });
            socket.on('error',  (err)=> {
                lastTempBuffer = null;
                logger.warn('Tcp Tunnel server on socket error' + err);
            });
            socket.on('timeout',  ()=>{
                lastTempBuffer = null;
                logger.warn('Tcp Tunnel server on socket timeout');
                socket.end();
                socket.destroy();
            });

        });

        tunnelServer.listen({ host: this.host, port: this.port }, () => {
            logger.info("tcp tunnel server started:" + this);
        });
        return tunnelServer;
    }

}

module.exports = TcpTunnelServer;