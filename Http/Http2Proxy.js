const http2 = require('http2');
const fs = require('fs');
const logger=require('../Log/logger');


const httpProxyServer = http2.createSecureServer({
  key: fs.readFileSync('im.key'),
  cert: fs.readFileSync('im.pem')
});

 
httpProxyServer.on('error', (err) => console.error(err));
httpProxyServer.on('stream', (stream, headers) => {
 console.log(stream.session.socket.remoteAddress.toString())
  // 流是一个双工流。
  stream.respond({
    'content-type': 'text/html; charset=utf-8',
    ':status': 200
  });
  stream.end('<h1>你好世界</h1>');
});

httpProxyServer.listen(443);


// var http = require('http');
// http.createServer(function(req, res){
//  res.writeHead(200, {'Content-type' : 'text/html'});
//  res.write('<h1>Node.js</h1>');
//  res.end('<p>Hello World</p>');
// }).listen(3000);