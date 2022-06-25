global.programType = 'server';
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
const createHttpProxy = require('./Http/HttpProxy');
const InitDb = require('./Db/InitDb');
const initdbdata = InitDb.initdbdata;
const { checkType, isNumber, isEmpty, isString, isBoolean } = require('./Utils/TypeCheckUtil');
const defaultBridgeConfigPort = defaultBridgeConfig.port;
const defaultBridgeConfigRpcPort = defaultBridgeConfig.rpcPort;
checkType(isNumber, defaultBridgeConfigPort, 'defaultBridgeConfigPort');
const defaultWebServerConfigPort = defaultWebServerConfig.port;
checkType(isNumber, defaultWebServerConfigPort, 'defaultWebServerConfigPort');
const defaultWebServerConfigVisitHttpsPort = defaultWebServerConfig.visitHttpsPort;
checkType(isNumber, defaultWebServerConfigPort, 'defaultWebServerConfigisitHttpsPort');
const clusterEnabled = serverConfig.cluster.enabled;
checkType(isBoolean, clusterEnabled, 'serverConfig.cluster.enabled');
const instanceCount = serverConfig.cluster.count;
checkType(isNumber, instanceCount, 'serverConfig.cluster.count');
const P2PTracker = require('./P2P/P2PTracker');
const N2NServer = require('./N2N/N2NServer');
const rootPath = require('./Common/GlobalData').rootPath;
const communityListPath = require('path').join(rootPath, 'config', 'community.list');
const eventEmitter = require('./Communication/CommunicationEventEmiter').eventEmitter;
//------------------netbuilding---s-------
const netbuilding = serverConfig.netbuilding;
const netbuildingHost = netbuilding.host;
const netbuildingPort = netbuilding.port;
//------------------netbuilding---e-------

//--------------------visit site https------------
const https = require('https');
const fs = require('fs');
const path = require('path');
const configDir = path.join(rootPath, 'config');
const serverHttpConfig = serverConfig.http;
const sslConfig = serverHttpConfig.ssl;
//--------------------visit site https------------

if (clusterEnabled) {
    const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
    if (cluster.isPrimary || cluster.isMaster) {

        logger.warn(`Master ${process.pid} is running`);

        P2PTracker.start();
        N2NServer.startSuperNode(communityListPath, netbuildingPort);
        logger.debug(`server starts with cluster mode, instance's count=${instanceCount}`);
        initdbdata();


        setupPrimary({
            serialization: "advanced",
        });

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
    N2NServer.startSuperNode(communityListPath, netbuildingPort);
}


//------------------------httpProxy----------------
createHttpProxy();

//-----------------------socket.io-----------------
const { io, defaultNS } = require('./Communication/Commander');


// const RpcTcpServer = require('./Rpc/RpcTcpServer');
// const rpcServer = new RpcTcpServer({ host: '0.0.0.0', port: defaultBridgeConfigRpcPort }, defaultNS, 'RpcTcpServer');
// rpcServer.start();


//------------------------express------------------
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redisUtil = require('./Utils/RedisUtil');
const redisClient2 = redisUtil.redisClient2;
const redisStoreInstance = new RedisStore({ client: redisClient2 });
const app = express();
app.use(
    session({
        store: redisStoreInstance,
        saveUninitialized: false,
        secret: 'fcookie',
        resave: false,
        cookie: { maxAge: 60000 * 24 * 10 },
    })
);
app.set('x-powered-by', false);
//const bodyParser = require('body-parser');
const GlobalData = require('./Common/GlobalData');
const { requireAuthenKey: requireRole, allRequest } = require('./ExpressMiddleWare/authenMiddleWare');
const { setgroups } = require('process');
app.use(allRequest);
app.use('/', express.static('public'));

//app.use(bodyParser.json());
app.use(express.json());
//app.use(bodyParser.urlencoded({ extended: false })); //这里一定有问题,需要优化
app.use(express.urlencoded({ extended: false }));
app.use('/system', require('./Routers/System'));
app.use('/user', require('./Routers/User'));
app.use('/update', require('./Routers/Update'));
app.use('/client', require('./Routers/Client'));
app.use('/tunnel', require('./Routers/Tunnel'));
app.use('/n2n', require('./Routers/N2N'));
app.use('/connector', require('./Routers/Connector'));
app.get('/checkServerStatus', function(req, res) {
    res.send({ success: true });
});

app.post('/sendSocketIoCmd/:command', function(req, res) {
    let authenKey = req.headers.authenKey;
    let command = req.params.command;
    let parameters = req.body;
    res.send({ success: true });

})
app.get('/version', async function(req, res) {
    res.send(defaultConfig.version);
});

const server = app.listen(defaultWebServerConfigPort, function() {
    logger.debug(`fastnat web start at:${JSON.stringify(server.address())}`)
});

//----------添加https支持,仅用于浏览器强制ssl的麻烦情况



let serverOptions = {};
if (sslConfig.type == 'pem') {
    serverOptions = {
        key: fs.readFileSync(path.join(configDir, 'ssl', sslConfig.pemKeyName)),
        cert: fs.readFileSync(path.join(configDir, 'ssl', sslConfig.pemCertName)),
    };
}

if (sslConfig.type == 'pfx') {
    serverOptions = {
        pfx: fs.readFileSync(path.join(configDir, 'ssl', sslConfig.pfxName)),
        passphrase: sslConfig.pfxPassword
    };
}

const httpsServer = https.createServer(serverOptions, app);

httpsServer.listen(defaultWebServerConfigVisitHttpsPort, () => {
    logger.debug('site VisitHttps Server running on port ' + defaultWebServerConfigVisitHttpsPort);
});
//---------------------------------------------------

const tcpTunnelServer = new TcpTunnelServer({ port: defaultBridgeConfigPort });
tcpTunnelServer.start();

//------------------------------------------------
process.on("uncaughtException", function(err) {
    logger.error(err.stack);
    logger.error(err);
});

let _SIGINT_Started = false;
process.on('SIGINT', function() {
    if (_SIGINT_Started === false) {
        _SIGINT_Started = true;
        logger.warn('process exit by SIGINT');
        serverExit();
    } else {
        logger.trace('process is closing,please waiting...');
    }
});


function serverExit(params) {
    N2NServer.stopSuperNode();

    setTimeout(() => {
        logger.log('server has been stopped')
        process.exit(0);
    }, 2000);
}