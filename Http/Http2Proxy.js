const http2 = require('http2');
const fs = require('fs');
const logger=require('../Log/logger').logger;

const server = http2.createSecureServer({
  key: fs.readFileSync('im.key'),
  cert: fs.readFileSync('im.pem')
});

server.on('error', (err) => console.error(err));
server.on('stream', (stream, headers) => {
  
  // 流是一个双工流。
  stream.respond({
    'content-type': 'text/html; charset=utf-8',
    ':status': 200
  });
  stream.end('<h1>你好世界</h1>');
});

server.listen(8443);