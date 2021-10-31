const path = require('path');
const TcpTunnelClient = require('../TcpTunnel/TcpTunnelClient');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const url = require('url');
const logger = require('../Log/logger');
const fs = require('fs');
const rootPath = require('../Common/GlobalData').rootPath;


class HttpTunnelClient {



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
        // this.localAddress = { host: tunnel.localIp, port: tunnel.localPort };
        this.started = false;

        let targetUrl = `${tunnel.type}://${tunnel.localIp}:${tunnel.localPort}`;
        if (tunnel.localPort == 80 || tunnel.localPort == 443) {
            targetUrl = `${tunnel.type}://${tunnel.localIp}`;
        }

        let finalAgent = null;
        if (tunnel.type === 'https') {
            finalAgent = https.globalAgent;

        } else {
            finalAgent = http.globalAgent;
        }

        let parsedUrl = url.parse(targetUrl);
        const proxy = httpProxy.createProxy({
            target: targetUrl,
            agent: finalAgent,
            headers: { host: parsedUrl.hostname },
            prependPath: false,
            xfwd: true,
            hostRewrite: targetUrl.host,
            protocolRewrite: parsedUrl.protocol,
            ws: true
        });

        proxy.on('error', function(err, req, res) {
            logger.error(err);
            if (res) {
                res.writeHead(500, {
                    'Content-Type': 'text/plain'
                });
                res.end('Something went wrong. And we are reporting a custom error message.');
            }

        });

        let httpModule = http;
        let serverOptions = {};

        this.httpProxyServer = httpModule.createServer(serverOptions, function(req, res) {
            logReq(req)
            proxy.web(req, res);
        });

        /**
         * 
         * @param {http.IncomingMessage} req 
         */
        function logReq(req) {
            console.log(req.method, req.url, req.headers);
            let body = '';
            req.on('data', (chunk) => {
                body += chunk;
            });
            req.on('end', () => {
                console.log(body);
            });
        }
        this.httpProxyServer.on('upgrade', function(req, socket, head) {
            proxy.ws(req, socket, head);
        });
    }

    async start() {
        if (this.started) {
            logger.trace(' httpProxyServer has started already');
            return;
        }
        this.httpProxyServer.listen({ port: 0 }, async() => {
            let port = this.httpProxyServer.address().port;
            logger.trace(`httpProxyServer started at:${port}`);
            this.tcpTunnelClient = new TcpTunnelClient(this.authenKey, this.tcpTunnelServerAddress, { port: port, host: '0.0.0.0' });
            await this.tcpTunnelClient.startTunnel(this.tunnel.id);
        });
    }

    stop() {
        if (this.tcpTunnelClient) {
            this.tcpTunnelClient.stop();
        }
        this.httpProxyServer.close();
    }

}

module.exports = HttpTunnelClient;