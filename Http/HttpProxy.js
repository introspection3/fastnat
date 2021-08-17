'use strict';
const net = require('net');
const logger = require('../Log/logger');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const url = require('url');
const defaultConfig = require('../config/default.json');
const serverConfig = require('../config/server.json');
const defaultHttpConfig = defaultConfig.http;
const serverHttpConfig = serverConfig.http;
const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');

function createProxy(targetUrl) {

    let proxy = httpProxy.createProxy({});

    proxy.on('error', function (e) {

    });
    let finalAgent = null;
    let parsedUrl = url.parse(targetUrl);

    if (parsedUrl.protocol === 'https:') {
        finalAgent = https.globalAgent;

    } else {
        finalAgent = http.globalAgent;
    }

    let httpModule = http;
    let serverOptions = {};
    if (defaultHttpConfig.ssl === true) {
        httpModule = https;
        const fs = require('fs');
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

    server.listen(defaultHttpConfig.port);

    server.on('connection', (socket) => {
        console.log('----------------');
        socket.on('close', () => {
            console.log('close')
        });
    });

    server.on('connect', (req, clientSocket, head) => {

    });
    return server;
}

module.exports.createProxy = createProxy;
