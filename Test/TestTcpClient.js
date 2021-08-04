const TcpClient=require('../Tcp/TcpClient');
const stringRandom = require('string-random');
let client=new TcpClient({host:'0.0.0.0',port:3927});
client.start();

const str=stringRandom(1024*100);

client.eventEmitter.addListener('connect',()=>{
   setInterval(() => {
    client.sendUtf8Json( new Date()+str);
   }, 1000);
});

client.eventEmitter.addListener('onMessage',(dataBuffer,socket)=>{
    
    let str=dataBuffer.toString();
    console.log(str);
     
 })