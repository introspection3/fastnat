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

async function getPortBySecondDomainName(secondDomainName) {
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
    DomainMap.set(secondDomainName, { remotePort: result.remotePort, time: new Date() });
    return result.remotePort;
}

function createProxy() {
    let fiveMinutes = 5 * 60 * 1000;
    setInterval(() => {
        for (const [key, item] of DomainMap) {
            let passTime = new Date() - item.time;
            if (passTime > fiveMinutes) {
                DomainMap.delete(key);
            }
        }
    }, 15 * 1000);

    let proxy = httpProxy.createProxy({});
    proxy.on('error', function(e) {
        logger.error(e);
    });

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
            //获取二级域名的名字,然后从数据里找到对应的端口
            let hostname = req.headers['host'];
            console.log(hostname)
            if (net.isIPv4(hostname)) {
                res.end('you should config domain');
                logger.warn(`bad hostname:${hostname}`)
                return;
            }
            let array = hostname.split('.');
            if (array.length == 1) {
                res.end('domain error');
                return;
            }
            let secondDomainName = array[0];
            console.log(secondDomainName)
            if (secondDomainName == null || secondDomainName == '') {
                res.end('secondDomainName not exist');
                return;
            }
            let targetUrl = `http://127.0.0.1:`;
            if (secondDomainName === 'www') {
                logger.error('www is not your domain now');
                return; //暂时不处理
            } else {
                let port = await getPortBySecondDomainName(secondDomainName);
                targetUrl += port;
            }
            //对于外界而言必然都是http
            let finalAgent = http.globalAgent;
            proxy.web(req, res, {
                target: targetUrl,
                agent: finalAgent,
                headers: { host: hostname },
                prependPath: false,
                xfwd: true,
                hostRewrite: hostname,
                protocolRewrite: 'https'
            });
        });

        server.listen(sslConfig.port, () => {
            logger.info('server https proxy start:' + JSON.stringify(server.address()))
        });

    }

    let server = http.createServer({}, async function(req, res) {
        //获取二级域名的名字,然后从数据里找到对应的端口
        let hostname = req.headers['host'];
        if (net.isIPv4(hostname)) {
            res.end('you should config domain');
            logger.warn(`bad hostname:${hostname}`)
            return;
        }
        let array = hostname.split('.');
        if (array.length == 1) {
            res.end('domain error');
            return;
        }
        let secondDomainName = array[0];
        console.log(secondDomainName)
        if (secondDomainName == null || secondDomainName == '') {
            res.end('secondDomainName not exist');
            return;
        }
        let targetUrl = `http://127.0.0.1:`;
        if (secondDomainName === 'www') {
            logger.error('www is not your domain now');
            return; //暂时不处理
        } else {
            let port = await getPortBySecondDomainName(secondDomainName);
            targetUrl += port;
        }
        //对于外界而言必然都是http
        let finalAgent = http.globalAgent;
        proxy.web(req, res, {
            target: targetUrl,
            agent: finalAgent,
            headers: { host: hostname },
            prependPath: false,
            xfwd: true,
            hostRewrite: hostname,
            protocolRewrite: 'http'
        });
    });
    server.listen(serverHttpConfig.port, () => {
        logger.info('server http proxy start:' + JSON.stringify(server.address()))
    });

}

module.exports = createProxy;