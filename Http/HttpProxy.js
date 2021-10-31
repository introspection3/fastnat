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
const sslConfig = serverHttpConfig.ssl;
const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');
const fs = require('fs');
const configDir = path.join(rootPath, 'config');
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const DomainMap = new Map();
const currentDomainName = serverHttpConfig.domain;
const currentDomainPort = serverHttpConfig.port;
const currentDomainSslPort = serverHttpConfig.ssl.port;
const fineEndArray = [currentDomainName, currentDomainName + ':' + currentDomainPort, currentDomainName + ':' + currentDomainSslPort];

async function getPort(secondDomainName) {
    if (DomainMap.has(secondDomainName)) {
        let data = DomainMap.get(secondDomainName);
        return data.remotePort;
    }
    let result = await Tunnel.findOne({
        where: {
            uniqueName: secondDomainName,
            isAvailable: 1
        },
        attributes: ['remotePort']
    });
    if (result == null) {
        logger.error(`${secondDomainName}'s tunnel is not exist'`);
        return -1;
    }
    DomainMap.set(secondDomainName, { remotePort: result.remotePort, time: new Date() });
    return result.remotePort;
}

/**
 * 根据req获取对应二级域名
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res
 */
function getSecondDomainNameFromReq(req, res = null) {
    let existHost = req.headers.hasOwnProperty('host');
    let address = { localAddress: req.socket.localAddress, localPort: req.socket.localPort };
    if (!existHost) {
        logger.error(`bad req,no host from ${JSON.stringify(address)}`);
        return null;
    }

    let hostname = req.headers['host'];
    if (hostname === 'www.liuchang88888.ltd') {
        if (res) {
            logger.warn(`bad host www.liuchang88888.ltd from ${JSON.stringify(address)}`);
            req.statusCode = 403;
            req.statusMessage = '.';
            res.end('.');
        }
        return null;
    }
    if (!(hostname.endsWith(fineEndArray[0]) || hostname.endsWith(fineEndArray[1]) || hostname.endsWith(fineEndArray[2]))) {
        logger.info(`bad request,from ${JSON.stringify(address)} ` + JSON.stringify(req.headers));
        if (res) {
            res.end('Illegal domain name,please close it');

        }
        return null;
    }

    if (net.isIPv4(hostname)) {
        if (res) {
            res.end('you should config domain,do not use ip');
        }
        logger.warn(`bad hostname:${hostname}`)
        return null;
    }

    let array = hostname.split('.');
    if (array.length == 1) {
        if (res) {
            res.end('domain error');
        }
        return null;
    }
    let secondDomainName = array[0];
    if (secondDomainName == null || secondDomainName == '') {
        if (res) {
            res.end('secondDomainName null or  empty');
        }
        return null;
    }
    return secondDomainName;
}

const HttpProxyCacheMap = new Map();
/**
 * 根据req获取proxy
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res
 */
async function getProxy(req, res = null) {
    let secondDomainName = getSecondDomainNameFromReq(req, res);
    if (secondDomainName === null || secondDomainName === '') {
        if (req) {
            req.statusCode = 403;
            req.statusMessage = 'Not found';
            res.end('');
        }
        return null;
    }

    if (secondDomainName === 'www') {
        logger.trace(`www request,from ${JSON.stringify(req.socket.address())} ` + JSON.stringify(req.headers));
    }
    let port = await getPort(secondDomainName);
    if (HttpProxyCacheMap.has(port)) {
        let result = HttpProxyCacheMap.get(port);
        result.time = new Date();
    }
    let targetUrl = `http://127.0.0.1:` + port;
    let hostname = req.headers['host'];
    let proxy = httpProxy.createProxy({
        target: targetUrl,
        agent: http.globalAgent,
        prependPath: false,
        xfwd: true,
        hostRewrite: hostname,
        protocolRewrite: 'https',
        ws: true
    });

    // Listen for the `error` event on `proxy`.
    proxy.on('error', function(err, req, res) {

        logger.error('httpProxy' + err);
    });
    proxy.time = new Date();
    HttpProxyCacheMap.set(port, proxy);
    return proxy;
}

function createHttpProxy() {
    let fiveMinutes = 5 * 60 * 1000;
    setInterval(() => {
        for (const [key, item] of DomainMap) {
            let passTime = new Date() - item.time;
            if (passTime > fiveMinutes) {
                DomainMap.delete(key);
            }
        }

        for (const [key, item] of HttpProxyCacheMap) {
            let passTime = new Date() - item.time;
            if (passTime > fiveMinutes) {
                item.close();
                HttpProxyCacheMap.delete(key);
            }
        }

    }, 15 * 1000);

    if (sslConfig.enabled === true) {

        let serverOptions = {};
        if (sslConfig.type == 'pem') {
            serverOptions = {
                key: fs.readFileSync(path.join(configDir, 'ssl', sslConfig.pemKeyName)),
                cert: fs.readFileSync(path.join(configDir, 'ssl', sslConfig.pemCertName)),
            };
        }

        if (sslConfig.type == 'pfx') {
            serverOptions = {
                pfx: fs.readFileSync(path.join(configDir, 'ssl', sslConfig.pfxName)),
                passphrase: sslConfig.pfxPassword
            };
        }


        let server = https.createServer(serverOptions, async function(req, res) {
            let proxy = await getProxy(req, res);
            if (proxy)
                proxy.web(req, res);
        });

        server.on('upgrade', async function(req, socket, head) {
            let proxy = await getProxy(req);
            if (proxy)
                proxy.ws(req, socket, head);
        });

        server.listen(sslConfig.port, () => {
            logger.debug('server https proxy start:' + JSON.stringify(server.address()))
        });

    }
    let server = http.createServer({}, async function(req, res) {
        let proxy = await getProxy(req, res);
        if (proxy)
            proxy.web(req, res);
    });

    server.on('upgrade', async function(req, socket, head) {
        let proxy = await getProxy(req);
        if (proxy)
            proxy.ws(req, socket, head);
    });

    server.listen(serverHttpConfig.port, () => {
        logger.debug('server http proxy start:' + JSON.stringify(server.address()))
    });

}

module.exports = createHttpProxy;