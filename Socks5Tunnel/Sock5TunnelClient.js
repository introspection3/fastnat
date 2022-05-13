const TcpTunnelClient = require('../TcpTunnel/TcpTunnelClient');
const logger = require('../Log/logger');
const socks5 = require('simple-socks');

class Sock5TunnelClient {

    /**
     * 
     * @param {string} authenKey 
     * @param {Tunnel} tunnel 
     * @param {object} tcpTunnelServerAddress 
     */
    constructor(authenKey, tunnel, tcpTunnelServerAddress) {
        this.authenKey = authenKey;
        this.tunnel = tunnel;
        this.tcpTunnelServerAddress = tcpTunnelServerAddress;
        //  this.localAddress = { host: tunnel.localIp, port: tunnel.localPort };
        this.started = false;
        let otherConfig = (tunnel.other + '').trim();
        if (otherConfig === '') {
            this.socks5Config = {};
            this.socks5Config.authenEnabled = false;
        } else {
            this.socks5Config = JSON.parse(otherConfig);
        }

    }
    stop() {
        this.socks5Server.close();
        if (this.tcpTunnelClient) {
            this.tcpTunnelClient.stop();
        }
    }
    async start() {
        if (this.started) {
            logger.trace('Sock5TunnelClient has started already');
            return;
        }
        this.socks5Server = null;
        if (this.socks5Config.authenEnabled) {
            const options = {
                authenticate: (username, password, socket, callback) => {
                    if (username === this.socks5Config.username && password === this.socks5Config.password) {
                        return setImmediate(callback);
                    }
                    return setImmediate(callback, new Error('incorrect username and password'));
                },
                connectionFilter: function(destination, origin, callback) {
                    console.log(destination.address);

                    return setImmediate(callback);
                }
            };
            this.socks5Server = socks5.createServer(options);
        } else {
            this.socks5Server = socks5.createServer();

        }
        this.socks5Server.on('authenticate', (username) => {
            logger.debug('user ' + username + ' successfully authenticated!');
        });
        this.socks5Server.on('authenticateError', (username, err) => {
            logger.error('user ' + username + ' failed to authenticate...' + err);
        });
        this.socks5Server.on('handshake', (socket) => {
            logger.trace('new socks5 client from ' + socket.remoteAddress + ':' + socket.remotePort);
        });
        this.socks5Server.on('proxyError', (err) => {
            logger.error('unable to connect to remote server');
            logger.error(err);
        });
        this.socks5Server.on('proxyDisconnect', (originInfo, destinationInfo, hadError) => {
            logger.debug(
                `client ${originInfo.address}:${originInfo.port} request has disconnected from remote server at${destinationInfo.address}:${destinationInfo.port} with err ${hadError ? '' : 'no '}`);
        });

        this.socks5Server.listen(this.tunnel.localPort, '0.0.0.0', async() => {
            logger.debug('SOCKS5 proxy server started on 0.0.0.0:' + this.tunnel.localPort);
            this.tcpTunnelClient = new TcpTunnelClient(this.authenKey, this.tcpTunnelServerAddress, { port: this.tunnel.localPort, host: '0.0.0.0' });
            await this.tcpTunnelClient.startTunnel(this.tunnel.id);
        });
    }

}

module.exports = Sock5TunnelClient;