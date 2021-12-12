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


module.exports = router