
const Node = require('utp-punch');
const defaultConfig = require('./Common/DefaultConfig');
const trackerPort = defaultConfig.port;
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');
const Interface = require('../Common/Interface');
const P2PRest = require('./P2PRest');

class P2PClient {

    /**
     * 
     * @param {string} trackerIP 
     * @param {Number} trackerPort 
     * @param {Number} localTunnelId 
     * @param {string} authenKey 
     * @param {Number} notifyTrackerInterval 
     * @param {Number} bindPort 
     */
    constructor(trackerIP, trackerPort,
        localTunnelId, authenKey,
        notifyTrackerInterval = 2000,
        bindPort = 0) {
        this.trackerIP = trackerIP;
        this.trackerPort = trackerPort;
        this.localTunnelId = localTunnelId;
        this.authenKey = authenKey;
        this.notifyTrackerInterval = notifyTrackerInterval;
        this.bindPort = bindPort;
        this.started = false;
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
            logger.debug('p2p client is ready,bindPort=' + this.udpSocket.address().port);
            this.bindPort = this.udpSocket.address().port;
            this.udpSocket.on('message', this.#onMessage);
            let msg = JSON.stringify({ authenKey: authenKey, localTunnelId: this.localTunnelId, command: 'client_report_tunnel_info' });
            this.timer = setInterval(() => {
                this.udpSocket.send(
                    msg,
                    this.trackerPort,
                    this.trackerIP,
                    (err) => { logger.warn(`p2p client tunnel.id=${this.localTunnelId}  notify to   tracker error: ` + err) }
                );
                logger.trace(`p2p client tunnel.id=${this.localTunnelId}  notify to   tracker`);
            }, this.notifyTrackerInterval);
        });
    }

    async tryConnect2Public(host, port) {
        let server = {
            address: host,
            port: port
        }
        console.log(
            `p2p client: punching a hole to ${server.address}:${server.port}...`
        );
        this.client.punch(10, server.port, server.address, success => {
            console.log(
                `p2p client: punching result: ${success ? 'success' : 'failure'}`
            );
            if (!success)
                process.exit(1);

            this.client.on('timeout', () => {
                console.log('p2p client: connect timeout');
                process.exit(1);
            });
            this.client.connect(server.port, server.address, this.#onConnected);
        });
    }

    /**
     * 
     * @param {connection.Connection} socket 
     */
    #onConnected(socket) {
        console.log('p2p client: UTP socket has connected to the public');
        const address = socket.address();
        socket.on('data', data => {
            const text = data.toString();
            console.log(
                `p2p client: received '${text}' from ${address.address}:${address.port}`
            );
        });
        socket.on('end', () => {
            console.log('p2p client: socket disconnected');
        });
    }

    /**
     * 
     * @param {Buffer} msg 
     * @param {dgram.RemoteInfo} rinfo 
     */
    #onMessage(msg, rinfo) {
        const text = msg.toString();
        if (rinfo.address === this.trackerIP && rinfo.port === this.trackerPort) {
            this.udpSocket.removeListener('message', this.#onMessage);
            clearInterval(this.timer);
            //通知对应的客户端进行同时打洞操作

        }
    }



}

module.exports=P2PClient;