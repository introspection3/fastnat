
const Node = require('utp-punch');
const defaultConfig = require('../Common/DefaultConfig');
const trackerPort = defaultConfig.port;
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');
const Interface = require('../Common/Interface');
const P2PRest = require('./P2PRest');
const Connection=require('utp-punch/connection').Connection;
class P2PClient {

    /**
     * 
     * @param {string} trackerIP 
     * @param {Number} trackerPort 
     * @param {Number} localTunnelId 
     * @param {string} authenKey 
     * @param {Socket} socketIOSocket 
     * @param {Number} notifyTrackerInterval 
     * @param {Number} bindPort 
     */
    constructor(trackerIP, trackerPort,
        localTunnelId, authenKey,
        socketIOSocket,
        notifyTrackerInterval = 1000,
        bindPort = 0) {
        this.trackerIP = trackerIP;
        this.trackerPort = trackerPort;
        this.localTunnelId = localTunnelId;
        this.authenKey = authenKey;
        this.socketIOSocket = socketIOSocket;
        this.notifyTrackerInterval = notifyTrackerInterval;
        this.bindPort = bindPort;
        this.started = false;
    }
    stop() {
        this.client.close();
    }
    start(connectorHost, connectorPort, fn) {

        if (this.started) {
            logger.warn('already started')
            return;
        }

        this.connectorHost = connectorHost;
        this.connectorPort = connectorPort;
        this.started = true;
        this.client = new Node();

        this.client.bind(this.bindPort, () => {
            this.udpSocket = this.client.getUdpSocket();
            logger.debug('p2p client is ready,bindPort=' + this.udpSocket.address().port);
            this.bindPort = this.udpSocket.address().port;

            //--------向tracker汇报--------------------------

            let msg = JSON.stringify({ authenKey: this.authenKey, localTunnelId: this.localTunnelId, command: 'client_report_tunnel_info' });
            this.timer = setInterval(() => {
                this.udpSocket.send(
                    msg,
                    this.trackerPort,
                    this.trackerIP,
                    (err) => { logger.warn(`p2p client tunnel.id=${this.localTunnelId}  notify to   tracker error: ` + err) }
                );
                logger.trace(`p2p client tunnel.id=${this.localTunnelId}  notify to   tracker`);
            }, this.notifyTrackerInterval);

            let onMessage = (msg, rinfo) => {
                const text = msg.toString();
                let message = JSON.parse(text);
                if (rinfo.address === this.trackerIP && rinfo.port === this.trackerPort) {
                    this.udpSocket.removeListener('message', onMessage);
                    clearInterval(this.timer);
                    fn({ success: true, data: message, info: 'client public info' });
                    this.tryConnect2Public(this.connectorHost, this.connectorPort);
                }
            };

            //---------来至tracker的回应------------------
            this.udpSocket.on('message', onMessage);

        });

    }

    async tryConnect2Public(host, port) {

        let server = {
            address: host,
            port: port
        }
        logger.debug(
            `p2p client: punching a hole to ${server.address}:${server.port}...`
        );
        this.client.punch(10, server.port, server.address, success => {
            logger.debug(
                `p2p client: punching result: ${success ? 'success' : 'failure'}`
            );
            if (!success) {
                this.stop();
            }
            this.client.on('timeout', () => {
                console.log('p2p client: connect timeout');
                this.stop();
            });
            this.client.connect(server.port, server.address, this.#onConnected);
        });
    }

    /**
     * 
     * @param {Connection} socket 
     */
    #onConnected(socket) {
       
        logger.debug('p2p client: UTP socket has connected to the connector');
        socket.write(`I'm client ,hi...`);
        const address = socket.address();
        socket.on('data', data => {
            const text = data.toString();
            logger.debug(
                `p2p client: received '${text}' from ${address.address}:${address.port}`
            );
        });
        socket.on('end', () => {
            logger.debug('p2p client: socket disconnected');
            this.stop();
        });

    }

}

module.exports = P2PClient;