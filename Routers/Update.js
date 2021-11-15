const express = require(`express`);
const router = express.Router();

const readFile = require('fs').promises.readFile;

const logger = require('../Log/logger');

const compareVersions = require('compare-versions');

const parentDir = require('../Common/GlobalData').rootPath;
const configDir = path.join(parentDir, "config");
const serverConfigPath = path.join(configDir, 'server.json');

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
    var update = JSON.parse(content);


    //linux_arm64_2.2.2.zip
    let version = req.query.version;
    let platform = req.query.platform;
    let arch = req.query.arch;


    let newVersion = update.version;
    let url = `${platform}_${arch}_${newVersion}.zip`;
    if (update.baseUrl.startsWith('http') === false) {
        url = 'http://sds/pkg/' + url;
    }
    let canUpdate = compareVersions(newVersion, version);

    let data = {
        canUpdate: canUpdate,
        when: 'restart',
        version: newVersion,
        url: url,
        des: update.des
    }
    let result = {
        success: true,
        data: data,
        info: ''
    }
    res.send(result);
});


module.exports = router