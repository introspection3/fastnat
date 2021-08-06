const TcpServer = require('../Tcp/TcpServer');
const RpcTcpServer = require('../Rpc/RpcTcpServer');
let server = new TcpServer({ host: '0.0.0.0', port: 3927 });
let rpcServer=new RpcTcpServer(server);
rpcServer.start();
