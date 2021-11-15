const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const serverConfig = require('../Common/ServerConfig');
const defaultConfig = require('../Common/DefaultConfig');
const fs = require('fs').promises;
const rootPath = require('../Common/GlobalData').rootPath;
const logger = require('../Log/logger');
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const compareVersions = require('compare-versions');

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

router.get('/api/check', async function(req, res, next) {

    //linux_arm64_2.2.2.zip
    let version = req.query.version;
    let platform = req.query.platform;
    let arch = req.query.arch;


    let newVersion = '11.1.1';
    let url = `${platform}_${arch}_${newVersion}.zip`;
    let canUpdate = compareVersions(newVersion, version);

    let data = {
        canUpdate: canUpdate,
        when: 'restart',
        version: newVersion,
        url: '',
        des: '最新版本'
    }
    let result = {
        success: true,
        data: data,
        info: ''
    }
    res.send(result);
});


module.exports = router