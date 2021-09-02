var dgram = require('dgram');
var udp_client = dgram.createSocket('udp4'); 
const stun = require('stun');

udp_client.on('close',function(){
    console.log('udp client closed.')
})

//错误处理
udp_client.on('error', function () {
    console.log('some error on udp client.')
})

// 接收消息
udp_client.on('message', function (message,rinfo) {
    console.log(`receive message from ${rinfo.address}:${rinfo.port}`);
    const res = stun.decode(message);
    console.log('your ip', res.getXorAddress().address);
})

async function test(params) {
    const res = await stun.request('stun.l.google.com:19302',{socket:udp_client});
    //console.log('your ip', res.getXorAddress());
}
test();