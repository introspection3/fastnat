
const defaultConfig = require('../Common/DefaultConfig');
const trackerPort = defaultConfig.p2p.trackerPort;
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');

udpSocket.on('error', err => {
    logger.error(err);
});


udpSocket.on('message', async (msg, rinfo) => {

    const text = msg.toString();
    let message;
    try {
        message = JSON.parse(text);
    } catch (error) {
        return;
    }

    console.log(`p2p tracker got: ${text} from ${rinfo.address}:${rinfo.port}`);

    if (message.command === 'client_report_tunnel_info') {
        let result = await Tunnel.update(
            {
                p2pRemotePort: rinfo.port,
                p2pRemotePortUpdatedAt: new Date(),
                updatedAt: new Date()
            },
            {
                where: {
                    id: message.localTunnelId,
                    isAvailable: true
                }
            }
        );
        let success = result[0] > 0;
        if (success == false) {
            logger.warn('p2p tracker,a client with a wrong authenKey:' + message.authenKey);
            return;
        }
        udpSocket.send(JSON.stringify({ host: rinfo.address, port: rinfo.port }), rinfo.port, rinfo.address);
    }

    if (message.command === 'connector_report_tunnel_info') {

        udpSocket.send(JSON.stringify({ host: rinfo.address, port: rinfo.port }), rinfo.port, rinfo.address);
    }

});


udpSocket.on('listening', () => {
    const address = udpSocket.address();
    console.log(`p2p tracker listening ${address.address}:${address.port}`);
});
console.log('trackerPort', trackerPort)
udpSocket.bind({ port: trackerPort, exclusive: true });

module.exports = udpSocket;