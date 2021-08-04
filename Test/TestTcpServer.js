const TcpServer = require('../Tcp/TcpServer');
const TcpPackUtil=require('../Tcp/TcpPackUtil');
let server=new TcpServer({host:'0.0.0.0',port:3927});
server.start();

server.eventEmitter.addListener('onMessage',(dataBuffer,socket)=>{
   let str=dataBuffer.toString('utf8');
   console.log(str);
   socket.write(TcpPackUtil.packData(dataBuffer));
})