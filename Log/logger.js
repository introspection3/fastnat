'use strict';
const log4js = require('log4js');
log4js.configure({
    appenders: {
        out: { type: 'console' },
        app: { type: 'file', filename: './logs/fastnat.log' }
    },
    categories: {
        default: { appenders: ['out', 'app'], level: 'info' }
    }
});
const logger = log4js.getLogger();
module.exports={logger}