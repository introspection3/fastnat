'use strict';
const net = require('net');
const logger = require('../Log/logger');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const url = require('url');


/**
 * 创建一个Http代理
 * @param {*} localAddress {host:'10.255.23.2',port:22}
 * @param {*} targetAddress {host:'10.255.23.2',port:22}
 * @returns 
 */
function createProxy(localAddress, targetAddress) {
    let connectInfo = ` ${JSON.stringify(localAddress)}-->${JSON.stringify(targetAddress)}`;

}

module.exports.createTcpProxy = createProxy;
