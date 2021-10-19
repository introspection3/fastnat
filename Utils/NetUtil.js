'use strict'

const dgram = require('dgram');
const { Server } = require('net');
const util = require('util');
const logger = require('../Log/logger');

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
        console.log(isUsing, port)
        return !isUsing;
    } catch (e) {
        logger.error(e);
        return false;
    }
}

function isUdpPortUnusedAsync(port) {
    port = Number.parseInt(port);
    let p = new Promise((resolve, reject) => {
        let socket = dgram.createSocket('udp4');
        socket.bind(port, '0.0.0.0', function(err) {
            if (err) {
                resolve(false);
            }
            socket.close()
            resolve(true);
        });
    });
    return p;
}

async function isPortUnusedAsync(type, port) {
    if (type === 'tcp') {
        return await isTcpPortUnusedAsync(port);
    } else {
        return await isUdpPortUnusedAsync(port);
    }
}
module.exports = {
    freeTcpPort,
    freeUdpPort,
    isUdpPortUnusedAsync,
    isTcpPortUnusedAsync,
    isPortUnusedAsync,
    freeUdpPortAsync: util.promisify(freeUdpPort),
    freeTcpPortAsync: util.promisify(freeTcpPort)
}