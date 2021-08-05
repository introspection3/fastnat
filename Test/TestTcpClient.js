const TcpClient=require('../Tcp/TcpClient');
const stringRandom = require('string-random');
let client=new TcpClient({host:'0.0.0.0',port:3927});
client.start();

const str=stringRandom(102);

client.eventEmitter.on('connect',()=>{
   setInterval(() => {
    let data={
        time:new Date(),
        str:str,
        type:'message'
    }
    client.sendCodecData(data);
   }, 10);
});
 
client.eventEmitter.on('onCodecMessage',(data,socket)=>{   
      console.log(data);     
 })