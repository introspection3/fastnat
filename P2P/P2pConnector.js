
const Node = require('utp-punch');
const defaultConfig = require('../Common/DefaultConfig');
const trackerPort = defaultConfig.port;
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');
const Interface = require('../Common/Interface');
const P2PRest = require('./P2PRest');
const Socket = require('socket.io-client').Socket;

class P2pConnector {

    /**
     * 
     * @param {string} trackerIP 
     * @param {Number} trackerPort 
     * @param {Number} targetTunnelId 
     * @param {string} authenKey 
     * @param {Socket} socketIOSocket 
     * @param {Number} notifyTrackerInterval 
     * @param {Number} bindPort 
     */
    constructor(trackerIP, trackerPort,
        targetTunnelId, targetP2PPassword, authenKey,
        socketIOSocket,
        notifyTrackerInterval = 2000, bindPort = 0) {

        this.trackerIP = trackerIP;
        this.trackerPort = trackerPort;
        this.targetTunnelId = targetTunnelId;
        this.authenKey = authenKey;
        this.socketIOSocket = socketIOSocket;
        this.notifyTrackerInterval = notifyTrackerInterval;
        this.bindPort = bindPort;
        this.started = false;
        this.targetP2PPassword = targetP2PPassword;
    }

    start() {

        if (this.started) {
            logger.warn('already started')
            return;
        }
        this.started = true;

        this.server = new Node(socket => {
            console.log('p2p connector : UTP client is connected');
            socket.write(`I'm conncetor ,hi...`);
            const address = socket.address();
            socket.on('data', data => {
                const text = data.toString();
                console.log(
                    `p2p connector: received '${text}' from ${address.address}:${address.port}`
                );
            });
            socket.on('end', () => {
                console.log('p2p connector: remote disconnected');
                process.exit(1);
            });
        });

        this.server.bind(this.bindPort, () => {
            this.udpSocket = this.server.getUdpSocket();
            logger.debug('p2p connector is ready,bindPort=' + this.udpSocket.address().port);
            this.bindPort = this.udpSocket.address().port;

            let msg = JSON.stringify({ authenKey: authenKey, targetTunnelId: this.targetTunnelId, command: 'connector_report_tunnel_info' });
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
                let message = JSON.parse(text);
                if (rinfo.address === this.trackerIP && rinfo.port === this.trackerPort) {
                    this.udpSocket.removeListener('message', onMessage);
                    clearInterval(this.timer);
                    //通知对应的客户端进行同时打洞操作
                    this.socketIOSocket.emit('p2p.request.open', {
                        targetTunnelId: this.targetTunnelId,
                        targetP2PPassword: this.targetP2PPassword,
                        authenKey: this.authenKey,
                        connectorHost: message.host,
                        connectorPort: message.host,
                    }, (backData) => {
                        //处理逻辑没有
                        this.tryConnect2Public(backData.data.host, backData.data.port);
                    });
                }
            };

            this.udpSocket.on('message', onMessage);


        });
    }

    async tryConnect2Public(clientHost, clientPort) {

        let publicInfo = {
            address: clientHost,
            port: clientPort
        }
        console.log(`p2p connector: begin punching a hole to ${publicInfo.address}:${publicInfo.port}...`);

        this.server.punch(10, publicInfo.port, publicInfo.address, success => {

            console.log(`p2p connector: punching result: ${success ? 'success' : 'failure'}`);

            if (!success)
                process.exit(1);

            this.server.on('timeout', () => {
                console.log('p2p connector: connect timeout');
                process.exit(1);
            });
            console.log('p2p connector: waiting for the client to connect...');

        });
    }
}

module.exports = P2pConnector;