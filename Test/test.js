const createTcpProxy = require('../Tcp/TcpProxy').createTcpProxy;
let p1 = createTcpProxy({ host: '0.0.0.0', port: 2222 }, { host: '192.168.1.1', port: 80 });