'use strict';
const log4js = require('log4js');
const path = require('path');
const { checkType, isBoolean, isString } = require('../Utils/TypeCheckUtil');
const parentDir = path.resolve(__dirname, '..');
const logPath = path.join(parentDir, "logs/fastnat.log");
const defaultConfig = require('../Common/DefaultConfig');
const enableCallStack = defaultConfig.log.enableCallStack;
checkType(isBoolean, enableCallStack, 'enableCallStack');
const logLevel = defaultConfig.log.level;
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
                pattern: '%d %p %c %z %f:%l==> %m',

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

module.exports = log4js.getLogger();