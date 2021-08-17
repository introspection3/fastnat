const path = require('path');
const TcpTunnelClient = require('../TcpTunnel/TcpTunnelClient');
const http = require('http');
const https = require('https');
const http2Proxy = require('http2-proxy');
const url = require('url');
const logger = require('../Log/logger');
const http2 = require('http2');
const fs = require('fs');
const rootPath = require('../Common/GlobalData').rootPath;
const finalhandler = require('finalhandler');

const defaultWebHandler = (err, req, res) => {
    if (err) {
        console.error('proxy error', err)
        finalhandler(req, res)(err)
    }
}

const defaultWSHandler = (err, req, socket, head) => {
    if (err) {
        console.error('proxy error', err)
        socket.destroy()
    }
}


class HttpTunnelClient {

    tcpTunnelClient = new TcpTunnelClient();
    /**
     * 
     * @param {TcpTunnelClient} tcpTunnelClient 
     */
    constructor(authenKey, tunnelId, tcpTunnelServerAddress, localAddress) {
        this.authenKey = authenKey;
        this.tunnelId = tunnelId;
        this.tcpTunnelServerAddress = tcpTunnelServerAddress;
        this.localAddress = localAddress;
        this.started = false;
        let configDir = path.join(rootPath, 'config');
        let serverOptions = {
            key: fs.readFileSync(path.join(configDir, 'ker.pem')),
            cert: fs.readFileSync(path.join(configDir, 'cert.pem')),
            allowHTTP1: true
        };
        this.httpProxyServer = http2.createSecureServer(serverOptions
        );
        this.httpProxyServer.on('request', (req, res) => {
            http2Proxy.web(req, res, {
                hostname: localAddress.host,
                port: localAddress.port,
                onReq: (req, options) => {
                    let headers = options.headers;
                    headers['X-Forwarded-For'] = req.socket.remoteAddress,
                        headers['X-Real-IP'] = req.socket.remoteAddress
                    headers['X-Forwarded-Proto'] = req.socket.encrypted ? 'https' : 'http';
                    headers['host'] = `${localAddress.host}:${localAddress.port}`;
                    // redirectHttp.request(options);
                },
                onRes: (req, res, proxyRes) => {
                    res.setHeader('x-powered-by', 'fastnat');
                    proxyRes.pipe(res)
                }
            }, defaultWebHandler);

        })
    }

    async start() {
        if (this.started) {
            logger.info('start httpProxyServer already');
            return;
        }
        this.httpProxyServer.listen({ port: 0 }, async () => {
            let port = this.httpProxyServer.address().port;
            logger.info(`httpProxyServer started at:${port}`);
            this.tcpTunnelClient = new TcpTunnelClient(this.authenKey, this.tcpTunnelServerAddress, { port: port, host: '0.0.0.0' });
            await this.tcpTunnelClient.startTunnel(this.tunnelId);
        });
    }
}

module.exports = HttpTunnelClient;