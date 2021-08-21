var dgram = require('dgram');

function createUpdServer(port, serverName) {
    //创建 udp server
    let udp_server = dgram.createSocket('udp4');
    udp_server.bind(port); // 绑定端口
    // 监听端口
    udp_server.on('listening', function () {
        const address = server.address();
        console.log(`${serverName} listening ${address.address}:${address.port}`);
    });
    //接收消息
    udp_server.on('message', function (msg, rinfo) {
        strmsg = msg.toString();
        udp_server.send(strmsg, 0, strmsg.length, rinfo.port, rinfo.address); //将接收到的消息返回给客户端
        console.log(`udp ${serverName} received data: ${strmsg} from ${rinfo.address}:${rinfo.port}`)
    });

    //错误处理
    udp_server.on('error', function (err) {
        console.log(`some error on udp ${serverName} server.==>`+err)
        udp_server.close();
    });

    return udp_server;
}

const udpPort = 5678;
let server = createUpdServer(udpPort, 'mainServer');

//--------------------------------------
var dgram = require('dgram');
var udp_client = dgram.createSocket('udp4');
var udp_client2=dgram.createSocket('udp4');

udp_client.on('close', function () {
    console.log('udp client closed.')
})

//错误处理
udp_client.on('error', function () {
    console.log('some error on udp client.')
})

// 接收消息
udp_client.on('message', function (msg, rinfo) {
    console.log(`receive message from ${rinfo.address}:${rinfo.port}：${msg}`);
});

udp_client.connect(udpPort, '192.168.1.3', (err) => {
    const message = Buffer.from('Some bytes');
    //定时向服务器发送消息
    setInterval(function () {
        udp_client.send(message, (err) => {

        });
    }, 3000);


  //  createUpdServer(udp_client.address().port, 'server2')
});


udp_client2.connect(udpPort, '192.168.1.3', (err) => {
    const message = Buffer.from('Some bytes22');
    //定时向服务器发送消息
    setInterval(function () {
        udp_client2.send(message, (err) => {

        });
    }, 3000);


  //  createUpdServer(udp_client.address().port, 'server2')
});

