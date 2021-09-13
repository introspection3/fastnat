
const defaultConfig = require('../Common/DefaultConfig');
const trackerPort = defaultConfig.p2p.trackerPort;
const dgram = require('dgram');
const udpSocket = dgram.createSocket('udp4');
const logger = require('../Log/logger');

udpSocket.on('error', (err) => {
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

    logger.debug(`p2p tracker got: ${text} from ${rinfo.address}:${rinfo.port}`);

    if (message.command === 'client_report_tunnel_info' || message.command === 'connector_report_tunnel_info') {
        udpSocket.send(JSON.stringify({ host: rinfo.address, port: rinfo.port }), rinfo.port, rinfo.address);
    }

});


udpSocket.on('listening', () => {
    const address = udpSocket.address();
    logger.debug(`p2p tracker listening ${address.address}:${address.port}`);
});

udpSocket.bind({ port: trackerPort, exclusive: false });//默认就是false,可以用于集群模式,但windows udp目前不支持,所以放到cluster里
module.exports = udpSocket;