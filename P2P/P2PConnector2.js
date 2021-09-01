const Node = require('utp-punch');
const defaultConfig = require('../Common/DefaultConfig');
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');
const Socket = require('socket.io-client').Socket;
const net = require('net');
const { Database } = require('sqlite3');

class P2pConnector2 {

    /**
     * 
     * @param {string} trackerIP 
     * @param {Number} trackerPort 
     * @param {Number} targetClientId 
     * @param {Number} targetTunnelId 
     * @param {string} authenKey 
     * @param {Number} connectorClientId 
     * @param {Socket} socketIOSocket 
     * @param {Number} notifyTrackerInterval 
     * @param {Number} bindPort 
     */
    constructor(trackerIP, trackerPort, targetClientId,
        targetTunnelId, targetP2PPassword, authenKey,
        connectorClientId,
        socketIOSocket,
        notifyTrackerInterval = 1000, bindPort = 0) {

        this.trackerIP = trackerIP;
        this.trackerPort = trackerPort;
        this.targetClientId = targetClientId;
        this.targetTunnelId = targetTunnelId;
        this.authenKey = authenKey;
        this.connectorClientId = connectorClientId;
        this.socketIOSocket = socketIOSocket;
        this.notifyTrackerInterval = notifyTrackerInterval;
        this.bindPort = bindPort;
        this.started = false;
        this.targetP2PPassword = targetP2PPassword;

    }

    stop() {
        this.client.close();
        logger.debug('P2pConnector close,connectorClientId=' + this.connectorClientId);
    }



    start() {

        if (this.started) {
            logger.warn('already started')
            return;
        }
        this.started = true;
        this.client = new Node();

        this.client.bind(this.bindPort, () => {
            this.udpSocket = this.client.getUdpSocket();
            logger.debug('p2p connector2 is ready,bindPort=' + this.udpSocket.address().port);
            this.bindPort = this.udpSocket.address().port;

            //--------向tracker汇报--------------------------

            let msg = JSON.stringify({ authenKey: this.authenKey, targetTunnelId: this.targetTunnelId, command: 'connector_report_tunnel_info' });

            this.timer = setInterval(() => {
                this.udpSocket.send(
                    msg,
                    this.trackerPort,
                    this.trackerIP,
                    (err) => { logger.debug('p2p connector  notify to   tracker error: ' + err) }
                );
            }, this.notifyTrackerInterval);

            let onMessage = (msg, rinfo) => {
                const text = msg.toString();
                console.log('tracker message:', text);
                let message = JSON.parse(text);
                if (rinfo.address === this.trackerIP && rinfo.port === this.trackerPort) {

                    this.udpSocket.removeListener('message', onMessage);
                    clearInterval(this.timer);
                    //通知对应的客户端进行同时打洞操作
                    this.socketIOSocket.emit('p2p.request.open', {
                        targetTunnelId: this.targetTunnelId,
                        targetP2PPassword: this.targetP2PPassword,
                        // authenKey: this.authenKey,
                        clientId: this.connectorClientId,
                        connectorHost: message.host,
                        connectorPort: message.port,
                    }, (backData) => {
                        logger.info('backData:' + JSON.stringify(backData));
                        if (backData.success == false) {
                            logger.warn(`can't connect to p2p client for:` + backData.info);
                            this.stop();
                            return;
                        }
                        this.tryConnect2Public(backData.data.host, backData.data.port);
                    });
                }
            };

            //---------来至tracker的回应------------------
            this.udpSocket.on('message', onMessage);

        });


    }

    async tryConnect2Public(clientHost, clientPort) {

        let server = {
            address: clientHost,
            port: clientPort
        }
        logger.debug(`p2p connector: begin punching a hole to ${server.address}:${server.port}...`);

        this.client.punch(10, server.port, server.address, success => {
            logger.debug(
                `p2p connector: punching result: ${success ? 'success' : 'failure'}`
            );
            if (!success) {
                this.stop();
            }
            this.client.on('timeout', () => {
                console.log('p2p connector: connect timeout');
                this.stop();
            });
            this.client.connect(server.port, server.address, this.#onConnected);
        });
    }



    #onConnected(utpSocket) {

        logger.debug('p2p connector:  has connected to the p2p client');

        const address = utpSocket.address();
        //
        let server = net.createServer((socket) => {

            utpSocket.on('data', data => {
                const text = data.toString();
                logger.debug(
                    `p2p connector utpSocket: received '${text}' from ${address.address}:${address.port}`
                );
                socket.write(data);
            });

            socket.on('data', (dataBuffer) => {
                console.log(dataBuffer.toString())
                utpSocket.write(dataBuffer);
            });

            socket.on('end', () => {

                logger.debug(`Tcp  server on socket end,remoteAddress=${socket.remoteAddress}:${socket.remotePort}, localAddress=${socket.localAddress}:${socket.localPort}`);

                socket.end();
                socket.destroy();
            });

            socket.on('error', (err) => {

                logger.debug('Tcp  server on socket error ' + err);

                socket.end();
                socket.destroy();
            });

            socket.on('timeout', () => {

                logger.debug('Tcp  server on socket timeout,socketTime=');
                socket.end();
                socket.destroy();
            });

        });

        server.listen(9999, () => {
            //在大多数操作系统中，监听未指定的 IPv6 地址 (::) 可能会导致 net.Server 也监听未指定的 IPv4 地址 (0.0.0.0)
            logger.trace("Tcp  server started success=>9999");
        });

        //

        utpSocket.on('end', () => {
            logger.debug('p2p connector: socket end');

        });

    }
}
module.exports = P2pConnector2;