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
const { isTcpPortAvailable } = require('./Utils/PortUtil');
const { checkType, isNumber, isEmpty, isString, isBoolean } = require('./Utils/TypeCheckUtil');
const defaultBridgeConfigPort = defaultBridgeConfig.port;
checkType(isNumber, defaultBridgeConfigPort, 'defaultBridgeConfigPort');
const defaultWebServerConfigPort = defaultWebServerConfig.port;
checkType(isNumber, defaultWebServerConfigPort, 'defaultWebServerConfigPort');
const P2PTracker = require('./P2P/P2PTracker');

if (serverConfig.cluster.enabled) {
    const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
    if (cluster.isPrimary || cluster.isMaster) {
        P2PTracker.start();
        let instanceCount = serverConfig.cluster.count <= 0 ? cpuCount : serverConfig.cluster.count;
        logger.debug(`server starts with cluster mode, instance's count=${instanceCount}`);
        initdbdata();
        setupPrimary();
        for (let i = 0; i < instanceCount; i++) {
            cluster.fork();
        }
        cluster.on('online', function(worker) {
            //logger.debug(`worker (pid:${worker.process.pid}) online`);
        });

        cluster.on('listening', function(worker, address) {
            logger.debug(`worker (pid:${worker.process.pid}) connected to ${JSON.stringify(address)}`);
        });

        cluster.on('exit', function(worker, code, signal) {
            logger.debug(`worker ${worker.process.pid} died with code (${code}),signal(${signal})`);
            logger.debug('starting a new worker');
            cluster.fork();
        });

        ClusterData.register2Cluster();
        return;
    }
    ClusterData.register2Worker();
} else {
    initdbdata();
    P2PTracker.start();
}


createProxy();

//-----------------------socket.io-----------------
const { io, defaultNS } = require('./Communication/Commander');

//----------------express------------------
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false })); //这里一定有问题,需要优化
app.use(express.urlencoded({ extended: true }));
app.use('/user', require('./Routers/User'));
app.use('/client', require('./Routers/Client'));
app.use('/tunnel', require('./Routers/Tunnel'));
app.use('/', express.static('public'));

app.get('/checkServerStatus', function(req, res) {
    res.send({ success: true });
});
app.get('/version', async function(req, res) {
    res.send(defaultConfig.version);
});

const server = app.listen(defaultWebServerConfigPort, function() {
    logger.debug(`fastnat web start at:${JSON.stringify(server.address())}`)
});


const tcpTunnelServer = new TcpTunnelServer({ port: defaultBridgeConfigPort });
tcpTunnelServer.start();

//------------------------------------------------
process.on("uncaughtException", function(err) {
    logger.error(err);
});