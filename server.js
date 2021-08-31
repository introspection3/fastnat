const express = require('express');
const logger = require('./Log/logger');
const TcpTunnelServer = require('./TcpTunnel/TcpTunnelServer');
const defaultConfig = require('./Common/DefaultConfig');
const serverConfig = require('./Common/ServerConfig');
const defaultWebServerConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const cluster = require('cluster');
const cpuCount = require('os').cpus().length;
const ClusterData = require('./Common/ClusterData');
const createProxy = require('./Http/HttpProxy');
const initdbdata = require('./Db/InitDb');
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");

if (serverConfig.cluster.enabled) {
  if (cluster.isPrimary || cluster.isMaster) {
    let instanceCount = serverConfig.cluster.count <= 0 ? cpuCount : serverConfig.cluster.count;
    logger.debug(`app starts with cluster mode instanceCount=${instanceCount}`);
    initdbdata();
    setupPrimary();
    for (let i = 0; i < instanceCount; i++) {
      cluster.fork();
    }
    cluster.on('online', function (worker) {
      logger.debug(`worker (pid:${worker.process.pid}) online`);
    });

    cluster.on('listening', function (worker, address) {
      logger.debug(`worker (pid:${worker.process.pid}) connected to ${JSON.stringify(address)}`);
    });

    cluster.on('exit', function (worker, code, signal) {
      logger.debug(`worker ${worker.process.pid} died with code (${code}),signal(${signal})`);
      logger.debug('starting a new worker');
      cluster.fork();
    });

    ClusterData.register2Cluster();
    return;
  }
  ClusterData.register2Worker();
}


createProxy();

//----------------express------------------
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/user', require('./Routers/User'));
app.use('/client', require('./Routers/Client'));
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static('public'));
app.get('/checkServerStatus', function (req, res) {
  res.send({ success: true });
});
app.get('/version', async function (req, res) {
  res.send(defaultConfig.version);
});

const server = app.listen(defaultWebServerConfig.port, function () {
  logger.debug(`fastnat web start at:${JSON.stringify(server.address())}`)
});

//----------------tcp tunnel server---------------
const tcpTunnelServer = new TcpTunnelServer({ port: defaultBridgeConfig.tcp });
tcpTunnelServer.start();

//-----------------------socket.io-----------------
require('./P2P/P2PTracker');
require('./Communication/Commander');
//-------------------------------------------------
process.on("uncaughtException", function (err) {
  logger.error(err);
});
