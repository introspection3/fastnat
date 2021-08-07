 
const RpcTcpServer = require('../Rpc/RpcTcpServer');
let rpcServer=new RpcTcpServer({host: '0.0.0.0', port: 3927 });
rpcServer.start();
