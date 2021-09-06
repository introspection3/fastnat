
const TcpTunnelClient = require('../TcpTunnel/TcpTunnelClient');
const logger = require('../Log/logger');
const rootPath = require('../Common/GlobalData').rootPath;
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

    async start() {
        if (this.started) {
            logger.trace('Sock5TunnelClient has started already');
            return;
        }
        let socks5Server = null;
        if (this.socks5Config.authenEnabled) {
            const options = {
                authenticate: function (username, password, socket, callback) {
                    if (username === this.socks5Config.username && password === this.socks5Config.password) {
                        return setImmediate(callback);
                    }
                    return setImmediate(callback, new Error('incorrect username and password'));
                }
            };
            socks5Server = socks5.createServer(options);
        } else {
            socks5Server = socks5.createServer();
        }
        socks5Server.on('authenticate', function (username) {
            logger.debug('user %s successfully authenticated!', username);
        });
        socks5Server.on('authenticateError', function (username, err) {
            logger.error('user %s failed to authenticate...', username, err);
        });
        socks5Server.on('handshake', function (socket) {
            logger.trace('new socks5 client from %s:%d', socket.remoteAddress, socket.remotePort);
        });

        socks5Server.listen(this.tunnel.localPort, '0.0.0.0', function () {
            logger.debug('SOCKS5 proxy server started on 0.0.0.0' + this.tunnel.localPort);
            let tcpTunnelClient = new TcpTunnelClient(this.authenKey, this.tcpTunnelServerAddress, { port: this.socks5Config.port, host: '0.0.0.0' });
            await tcpTunnelClient.startTunnel(this.tunnel.id);
        });
    }
}

module.exports = Sock5TunnelClient;