'use strict'

const dgram = require('dgram');
const { Server } = require('net');
const util = require('util');
const logger = require('../Log/logger');
const sleep = require('es7-sleep');

function freeUdpPort(cb) {
    let socket = dgram.createSocket('udp4')
    socket.bind(function(err) {
        if (err) {
            return cb(err)
        }

        let address = socket.address()
        socket.close()
        setImmediate(cb, null, address.port)
    })
}




function freeTcpPort(callback) {
    const server = new Server()
    server.once('listening', () => {
        const { port } = server.address()
        server.close(() => {
            server.removeAllListeners()
            if (callback) callback(null, port)
        })
    })
    server.once('error', (error) => {
        server.removeAllListeners()
        if (callback) callback(error)
    })
    server.listen(0);
}

async function isTcpPortUnusedAsync(port) {
    port = Number.parseInt(port);
    const tcpPortUsed = require('tcp-port-used');
    try {
        let isUsing = await tcpPortUsed.check(port, '0.0.0.0');
        return !isUsing;
    } catch (e) {
        logger.error(e);
        return false;
    }
}

function isUdpPortUnusedAsync(port) {
    port = Number.parseInt(port);
    logger.trace('isUdpPortUnusedAsync 1');
    let p = new Promise((resolve, reject) => {
        const server = dgram.createSocket('udp4');
        server.on('error', (err) => {
            logger.trace('isUdpPortUnusedAsync err' + err);
            server.close();
            resolve(false);
        });

        server.on('listening', () => {
            logger.trace('isUdpPortUnusedAsync listening 1');
            setTimeout(() => {
                logger.trace('isUdpPortUnusedAsync listening 2');
                server.close(() => {
                    logger.trace('isUdpPortUnusedAsync server.closed');
                });
                resolve(true);
            }, 500);
        });
        logger.trace('isUdpPortUnusedAsync 2');
        server.bind(port);
        logger.trace('isUdpPortUnusedAsync 3');
    });
    return p;
}

async function isPortUnusedAsync(type, port) {
    if (type === 'tcp') {
        return await isTcpPortUnusedAsync(port);
    } else {
        let result = await isUdpPortUnusedAsync(port);
        sleep(1000);
        return result;
    }
}

function int2iP(num) {
    var str;
    var tt = new Array();
    tt[0] = (num >>> 24) >>> 0;
    tt[1] = ((num << 8) >>> 24) >>> 0;
    tt[2] = (num << 16) >>> 24;
    tt[3] = (num << 24) >>> 24;
    str = String(tt[0]) + "." + String(tt[1]) + "." + String(tt[2]) + "." + String(tt[3]);
    return str;
}

function getVirtualIp(clientId) {
    let num = Number.parseInt(clientId);
    if (num > 184549374) {
        logger.fatal('IP?????????????????????,??????????????????!!!!');
        return '10.255.255.254';
    } else {
        num = 167772161 + num;
        let result = int2iP(num);
        return result;
    }
}

module.exports = {
    getVirtualIp,
    freeTcpPort,
    freeUdpPort,
    isUdpPortUnusedAsync,
    isTcpPortUnusedAsync,
    isPortUnusedAsync,
    freeUdpPortAsync: util.promisify(freeUdpPort),
    freeTcpPortAsync: util.promisify(freeTcpPort)
}