'use strict';
const log4js = require('log4js');
const path = require('path');
const parentDir = path.resolve(__dirname, '..');
const logPath = path.join(parentDir, "logs/fastnat.log");
const defaultConfig = require('../Common/DefaultConfig');
log4js.configure({
    appenders: {
        out: {
            type: 'console',
            layout: {
                type: 'pattern',
                pattern: '%d %p %c %z %f:%l==>%m'
            },
        },
        app: {
            type: 'dateFile',
            layout: {
                type: 'pattern',
                pattern: '%d %p %c %z %f:%l==> %m'
            },
            compress: true,
            daysToKeep: 2,
            filename: logPath
        }
    },
    categories: {
        default: { appenders: ['out', 'app'], level: defaultConfig.log.level, enableCallStack: defaultConfig.log.enableCallStack }
    }
});
module.exports = log4js.getLogger();