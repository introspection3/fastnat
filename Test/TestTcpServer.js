const TcpServer = require('../Tcp/TcpServer');
const TcpPackUtil = require('../Tcp/TcpPackUtil');
let server = new TcpServer({ host: '0.0.0.0', port: 3927 });
server.start();
server.eventEmitter.on('onMessage', (dataBuffer, socket) => {    
    socket.write(TcpPackUtil.packData(dataBuffer));
});

server.eventEmitter.on('onCodecMessage', (data, socket) => {
    console.log(data);
});