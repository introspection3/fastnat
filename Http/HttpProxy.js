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
const sslFile = serverHttpConfig.sslFile;
const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');
const fs = require('fs');
const configDir = path.join(rootPath, 'config');
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const DomainMap=new Map();

async function getPortBySecondDomainName(secondDomainName) {
    if(DomainMap.has(secondDomainName)){
        return DomainMap.get(secondDomainName);
    }
    let result = await Tunnel.findOne({
        where: {
            uniqueName: secondDomainName,
            isAvailable: 1
        },
        attributes: ['remotePort']
    });
    DomainMap.set(secondDomainName,result.remotePort);
    console.log(result.remotePort);
    return result;
}

function createProxy() {

    setInterval(() => {
        DomainMap.clear();
    }, 5*60*1000);

    let proxy = httpProxy.createProxy({});
    proxy.on('error', function (e) {
        logger.error(e);
    });

    let httpModule = http;
    let serverOptions = {};
    if (serverHttpConfig.isHttps === true) {
        httpModule = https;
        if (sslFile.type == 'pem') {
            serverOptions = {
                key: fs.readFileSync(path.join(configDir, sslFile.pemKeyName)),
                cert: fs.readFileSync(path.join(configDir, sslFile.pemCertName)),
            };
        }
        if (sslFile.type == 'pfx') {
            serverOptions = {
                pfx: fs.readFileSync(path.join(configDir, sslFile.pfxName)),
                passphrase: sslFile.pfxPassword
            };
        }
    }

    let server = httpModule.createServer(serverOptions, async function (req, res) {
        //获取二级域名的名字,然后从数据里找到对应的端口
        let hostname = req.headers['host'];
        let secondDomainName = hostname.split('.')[0];
        let targetUrl = `http://127.0.0.1:`;
        if (secondDomainName === 'www') {
            return;//暂时不处理
        } else {
            console.log('secondDomainName', secondDomainName)
            let port =await getPortBySecondDomainName(secondDomainName);
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
            protocolRewrite: serverHttpConfig.isHttps ? 'https' : 'http'
        });

    });

    server.listen(serverHttpConfig.port, () => {
        logger.info('Server http proxy start:' + JSON.stringify(server.address()))
    });


    return server;
}

module.exports = createProxy;
