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

    let content = await readFile(serverConfigPath);
    let updateConfig = JSON.parse(content).update;

    //linux_arm64_2.2.2.zip
    let version = req.query.version;
    let platform = req.query.platform;
    let arch = req.query.arch;
    let newVersion = updateConfig.version;
    let baseUrl = updateConfig.baseUrl + '';

    let pkgFileName = `${platform}_${arch}_${newVersion}.zip`;

    let canUpdate = compareVersions(newVersion, version) > 0;

    if (baseUrl.startsWith('http') === false) {
        let defaultWebSeverConfig = defaultConfig.webserver;
        let serverPath = `http${defaultWebSeverConfig.https ? 's' : ''}://${defaultConfig.host}:${defaultWebSeverConfig.port}`;
        baseUrl = `${serverPath+baseUrl}` + pkgFileName;
    }

    let data = {
        canUpdate: canUpdate,
        when: 'restart',
        version: newVersion,
        url: baseUrl,
        des: updateConfig.des
    };
    logger.trace(data);
    let result = {
        success: true,
        data: data,
        info: ''
    }
    res.send(result);
});


module.exports = router