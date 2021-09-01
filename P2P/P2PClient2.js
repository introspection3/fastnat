
const Node = require('utp-punch');
const defaultConfig = require('../Common/DefaultConfig');
const trackerPort = defaultConfig.port;
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');
const Interface = require('../Common/Interface');
const P2PRest = require('./P2PRest');
const Connection = require('utp-punch/connection').Connection;
const net = require('net');

class P2PClient2 {

    /**
     * 
     * @param {string} trackerIP 
     * @param {Number} trackerPort 
     * @param {Number} localTunnelId 
     * @param {string} authenKey 
     * @param {Number} connectorClientId 
     * @param {Number} ownClientId 
     * @param {Socket} socketIOSocket 
     * @param {Number} notifyTrackerInterval 
     * @param {Number} bindPort 
     */
    constructor(trackerIP, trackerPort,
        localTunnelId, authenKey, connectorClientId,
        ownClientId,
        socketIOSocket,
        notifyTrackerInterval = 1000,
        bindPort = 0) {
        this.trackerIP = trackerIP;
        this.trackerPort = trackerPort;
        this.localTunnelId = localTunnelId;
        this.authenKey = authenKey;
        this.connectorClientId = connectorClientId,
            this.ownClientId = ownClientId;

        this.socketIOSocket = socketIOSocket;
        this.notifyTrackerInterval = notifyTrackerInterval;
        this.bindPort = bindPort;
        this.started = false;

    }

    stop() {
        this.server.close();
        logger.debug('client close=>' + this.connectorClientId + ":" + this.localTunnelId);
    }

    start(connectorHost, connectorPort, fn) {

        if (this.started) {
            logger.warn('already started')
            return;
        }

        this.connectorHost = connectorHost;
        this.connectorPort = connectorPort;
        this.started = true;

        this.server = new Node(utpSocket => {
            logger.info('p2p client : UTP client comming');
            let tcpClient = this.#connect2LocalTcp('127.0.0.1', 3306, utpSocket);
            const address = utpSocket.address();
            let onData = data => {
                const text = data.toString();
                console.log(
                    `p2p client: received '${text}' from ${address.address}:${address.port}`
                );
                
                tcpClient.write(data);
            };

            utpSocket.on('data', onData);
            utpSocket.on('end', () => {
                logger.debug('p2p client: remote disconnected');
                this.server.close();
            });

        });

        this.server.bind(this.bindPort);
        this.server.listen(() => {
            this.udpSocket = this.server.getUdpSocket();
            logger.debug('p2p client is ready,bindPort=' + this.udpSocket.address().port);
            this.bindPort = this.udpSocket.address().port;

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
        let publicInfo = {
            address: host,
            port: port
        }
        logger.debug(`p2p client: begin punching a hole to ${publicInfo.address}:${publicInfo.port}...`);

        this.server.punch(10, publicInfo.port, publicInfo.address, success => {

            logger.debug(`p2p client: punching result: ${success ? 'success' : 'failure'}`);

            if (!success) {
                logger.warn(`p2p client punch failed`);
                this.stop();
                return;
            }


            this.server.on('timeout', () => {
                logger.warn('p2p client: connect timeout');
                this.stop();
            });
            logger.debug('p2p client: waiting for the client to connect...');

        });
    }



    #connect2LocalTcp(localIp, localPort, utpSocket) {
        let address = { host: localIp, port: localPort }
        let tcpClient = net.createConnection(address, () => {
            logger.trace('p2p tcp client has created for ' + JSON.stringify(utpSocket));
        });

        tcpClient.on('connect', () => {
            logger.trace('p2p tcp client has connected to ' + JSON.stringify(utpSocket));

        });

        tcpClient.on('data', (dataBuffer) => {
            utpSocket.write(dataBuffer);
        });

        tcpClient.on('close', (hadError) => {
            logger.trace('p2p tcp Client Closed:' + JSON.stringify(utpSocket))
        });

        tcpClient.on('error', (err) => {

            logger.warn('p2p tcp Client error: ' + err + " ," + JSON.stringify(utpSocket));
        });
        return tcpClient;
    }

}

module.exports = P2PClient2;