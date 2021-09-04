var stun = require('vs-stun');

var socket, server = { host: 'stun.l.google.com', port: 19302 }

var callback = function callback ( error, value ) {
  if ( !error ) {
    socket = value;

    console.log(socket.stun);

    socket.close();
  }
  else console.log('Something went wrong: ' + error);
}

stun.connect(server, callback);