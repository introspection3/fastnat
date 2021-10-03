'use strict'

const dgram = require('dgram');
const { Server } = require('net');
const util = require('util');

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


module.exports = {
    freeTcpPort,
    freeUdpPort,
    freeUdpPortAsync: util.promisify(freeUdpPort),
    freeTcpPortAsync: util.promisify(freeTcpPort)
}