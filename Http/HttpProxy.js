'use strict';
const net = require('net');
const logger = require('../Log/logger');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const url = require('url');
const defaultConfig = require('../config/default.json');
const serverConfig = require('../config/server.json');
const serverHttpConfig = serverConfig.http;
const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');
const fs = require('fs');

function createProxy() {

    let proxy = httpProxy.createProxy({});
    proxy.on('error', function (e) {
        logger.error(e);
    });

    let httpModule = http;
    let serverOptions = {};
    if (serverHttpConfig.isHttps === true) {
        httpModule = https;
        const sslFile = serverHttpConfig.http.sslFile;
        let configDir = path.join(rootPath, 'config');
        if (sslFile.type == 'pem') {
            serverOptions = {
                key: fs.readFileSync(path.join(configDir, sslFile.pemKeyName)),
                cert: fs.readFileSync(path.join(configDir, sslFile.pemCertName)),
            };
        }
        if (serverHttpConfig.http.sslFile.type == 'pfx') {
            serverOptions = {
                pfx: fs.readFileSync(path.join(configDir, sslFile.pfxName)),
                passphrase: sslFile.pfxPassword
            };
        }
    }

    let server = httpModule.createServer(serverOptions, function (req, res) {

        let targetUrl = req.url;
        let finalAgent = null;
        let parsedUrl = url.parse(targetUrl);
        if (parsedUrl.protocol === 'https:') {
            finalAgent = https.globalAgent;
        } else {
            finalAgent = http.globalAgent;
        }

        proxy.web(req, res, {
            target: targetUrl,
            agent: finalAgent,
            headers: { host: parsedUrl.hostname },
            prependPath: false,
            xfwd: true,
            hostRewrite: targetUrl.host,
            protocolRewrite: parsedUrl.protocol
        });
    });

    server.listen(serverHttpConfig.port, () => {
        logger.info('Server http proxy start:' + JSON.stringify(server.address()))
    });
    return server;
}

module.exports = createProxy;
