const Node = require('utp-punch');

let server = new Node(socket => {
    console.log('server: socket connected', socket.host, socket.port);
    socket.on('data', data => {
        console.log(`server: received '${data.toString()}'`);
        socket.write('world');
        socket.end();
    });
    socket.on('end', () => {
        console.log('server: socket disconnected');
        server.close(); // this is how you terminate node
    });
});

server.bind(20000, '127.0.0.1'); // bind to port 20000
server.listen( // run
    () => console.log('server: ready')
);

let client = new Node();
client.bind(); // bind to any port
client.connect(20000, '127.0.0.1', socket => {
    console.log('client: socket connected', socket.host, socket.port);
    socket.on('data', data => console.log(`client: received '${data.toString()}'`));
    socket.on('end', () => {
        console.log('client: socket disconnected');
        client.close(); // this is how you terminate node
    });
    socket.write('hello');
});