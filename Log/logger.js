'use strict';
const log4js = require('log4js');
const path = require('path');
const { checkType, isBoolean, isString } = require('../Utils/TypeCheckUtil');
const parentDir = require('../Common/GlobalData').rootPath;
const logPath = path.join(parentDir, "logs/fastnat.log");

let log = {};
log.enableCallStack = false;
log.level = 'trace';

if (global.programType === 'server') {
    log = require('../Common/ServerConfig').log;
} else {
    log = require('../Common/ClientConfig').log;
}

const enableCallStack = log.enableCallStack;
checkType(isBoolean, enableCallStack, 'enableCallStack');
const logLevel = log.level;
checkType(isString, logLevel, 'logLevel');

log4js.configure({
    appenders: {
        out: {
            type: 'console',
            layout: {
                type: 'pattern',
                pattern: '%d %p %c %z %f:%l==>%m',
            },

        },
        app: {
            type: 'dateFile',
            layout: {
                type: 'pattern',
                pattern: '%d %p %c %z %f:%l==>%m',
            },
            compress: true,
            daysToKeep: 2,
            filename: logPath
        }
    },
    categories: {
        default: { appenders: ['out', 'app'], level: logLevel, enableCallStack: enableCallStack }
    }
});
console.log('use logger............');
module.exports = log4js.getLogger();