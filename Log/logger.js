'use strict';
const log4js = require('log4js');
const path=require('path');
const parentDir=path.resolve(__dirname, '..');
const logPath=path.join(parentDir,"logs/fastnat.log");

log4js.configure({
    appenders: {
        out: { type: 'console' },
        app: { type: 'file', filename: logPath }
    },
    categories: {
        default: { appenders: ['out', 'app'], level: 'info' }
    }
});
module.exports = log4js.getLogger();