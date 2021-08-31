const Node = require('utp-punch');
const defaultConfig = require('../Common/DefaultConfig');
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');
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
        notifyTrackerInterval = 1000, bindPort = 0) {

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

    stop() {
        this.server.close();
        console.log('server close');
    }
    start() {

        if (this.started) {
            logger.warn('already started')
            return;
        }
        this.started = true;

        this.server = new Node(socket => {
            logger.info('p2p connector : UTP client comming');
            socket.write(`I'm conncetor ,hi...`);
            const address = socket.address();
            socket.on('data', data => {
                const text = data.toString();
                console.log(
                    `p2p connector: received '${text}' from ${address.address}:${address.port}`
                );
            });
            socket.on('end', () => {
                logger.debug('p2p connector: remote disconnected');
                this.server.close();
            });
        });

        this.server.bind(this.bindPort);
        this.server.listen(() => {
            this.udpSocket = this.server.getUdpSocket();
            logger.debug('p2p connector is ready,bindPort=' + this.udpSocket.address().port);
            this.bindPort = this.udpSocket.address().port;

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
                        authenKey: this.authenKey,
                        connectorHost: message.host,
                        connectorPort: message.port,
                    }, (backData) => {
                        logger.info('backData:' + JSON.stringify(backData));
                        if(backData.success==false){
                            logger.warn(`can't connect to p2p client for:`+backData.info);
                            this.stop();
                            return;
                        }
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
        logger.debug(`p2p connector: begin punching a hole to ${publicInfo.address}:${publicInfo.port}...`);

        this.server.punch(10, publicInfo.port, publicInfo.address, success => {

            logger.debug(`p2p connector: punching result: ${success ? 'success' : 'failure'}`);

            if (!success) {
                logger.warn(`p2p connector punch failed`);
                this.stop();
                return;
            }

            this.server.on('timeout', () => {
                logger.warn('p2p connector: connect timeout');
                this.stop();
            });
            logger.debug('p2p connector: waiting for the client to connect...');

        });
    }
}

module.exports = P2pConnector;