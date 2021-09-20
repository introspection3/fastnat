const defaultConfig = require('../Common/DefaultConfig');
const { checkType, isNumber } = require('../Utils/TypeCheckUtil');
const trackerPort = defaultConfig.p2p.trackerPort;
checkType(isNumber, trackerPort, 'trackerPort');
const dgram = require('dgram');
const logger = require('../Log/logger');
let udpSocket = null;

function start() {
    if (udpSocket != null) {
        logger.warn('tracker has already started')
        return;
    }
    udpSocket = dgram.createSocket('udp4');
    udpSocket.on('error', (err) => {
        logger.error(err);
    });
    udpSocket.on('message', async(msg, rinfo) => {
        const text = msg.toString();
        let message;
        try {
            message = JSON.parse(text);
        } catch (error) {
            return;
        }
        logger.trace(`p2p tracker got: ${text} from ${rinfo.address}:${rinfo.port}`);
        if (message.command === 'client_report_tunnel_info' || message.command === 'connector_report_tunnel_info') {
            udpSocket.send(JSON.stringify({ host: rinfo.address, port: rinfo.port }), rinfo.port, rinfo.address);
        }

    });

    udpSocket.on('listening', () => {
        const address = udpSocket.address();
        logger.debug(`p2p tracker is listening on ${address.address}:${address.port}`);
    });
    //默认就是false,可以用于集群模式,但windows udp目前不支持,所以放到cluster里
    udpSocket.bind({ port: trackerPort, exclusive: false });
    return udpSocket;
}

function stop() {
    if (udpSocket != null)
        udpSocket.close();
}
module.exports = {
    start: start,
    stop: stop
};