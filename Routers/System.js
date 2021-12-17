const express = require(`express`);
const path = require(`path`);
const router = express.Router();
const readFile = require('fs').promises.readFile;
const logger = require('../Log/logger');
const compareVersions = require('compare-versions');
const parentDir = require('../Common/GlobalData').rootPath;
const configDir = path.join(parentDir, "config");
const serverConfigPath = path.join(configDir, 'server.json');
const defaultConfig = require('../Common/DefaultConfig');
const ServerConfig = require('../Common/ServerConfig');
const { RegisterUser, Client, Tunnel, Connector } = require('../Db/Models');

router.use(function(req, res, next) {
    if (req.path.startsWith('/api')) {
        next();
    } else {
        if (req.session.user) {
            next();
        } else {
            res.send('no login');
            logger.warn('no login' + req.path);
        }
    }
});

router.get('/api/info', async function(req, res, next) {
    let result = `
    var systemInfo = {
        http: {
            domain: "${ServerConfig.http.domain}",
            port: ${ServerConfig.http.port},
            sslPort: ${ServerConfig.http.ssl.port}
        }
    };
    `;
    res.send(result);

});

router.get('/api/filebrowser', async function(req, res, next) {
    let authenKey = req.query.authenKey;
    let client = await Client.findOne({
        where: {
            authenKey: authenKey,
            isAvailable: true
        }

    });
    if (client == null) {
        res.send({
            success: false,
            data: null,
            info: 'this authenKey has no client'
        });
        return;
    }

    let tunnel = await Tunnel.findOne({
        where: {
            localPort: 7777,
            clientId: client.id
        }
    });

    if (tunnel == null) {
        res.send("亲，请在设备管理界面,创建此设备下方对应的映射列表中添加【本地文件管理】");
        return;
    }
    let url = `http://${tunnel.uniqueName}.${ServerConfig.http.domain}:${ServerConfig.http.port}`;
    res.redirect(url);
});

module.exports = router