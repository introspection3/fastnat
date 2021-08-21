const express = require('express');
const { RegisterUser, Client, Tunnel } = require('./Db/Models');
const { v4: uuidv4 } = require('uuid');
const logger = require('./Log/logger');
const TcpTunnelServer = require('./TcpTunnel/TcpTunnelServer');
const defaultConfig = require('./Common/DefaultConfig');
const serverConfig = require('./Common/ServerConfig');
const sequelize = require('./Db/Db');
const defaultWebServerConfig = defaultConfig.webserver;
const defaultBridgeConfig = defaultConfig.bridge;
const cluster = require('cluster');
const cpuCount = require('os').cpus().length;
const ClusterData = require('./Common/ClusterData');

if (serverConfig.cluster.enabled) {

  if (cluster.isPrimary || cluster.isMaster) {
    let instanceCount = serverConfig.cluster.count <= 0 ? cpuCount : serverConfig.cluster.count;
    logger.debug(`app starts with cluster mode (cpu count:${instanceCount})`);
    initdbdata();
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



const app = express();
const tcpTunnelServer = new TcpTunnelServer({ port: defaultBridgeConfig.tcp });
tcpTunnelServer.start();

const server = app.listen(defaultWebServerConfig.port, function () {
  logger.debug(`fastnat web start at:${JSON.stringify(server.address())}`)
});

app.use(express.urlencoded({ extended: false }));
app.use('/', express.static('public'));

app.get('/checkServerStatus', function (req, res) {
  res.send({ success: true });
});


app.get('/version', async function (req, res) {
  res.send(defaultConfig.version);
});


app.post('/user/register', async function (req, res) {
  let user = await RegisterUser.create(req.body);
  let client = await Client.create({
    authenKey: uuidv4(),
    registerUserId: user.id
  });
  res.send(client);

});


/**
 * 客户端获取对应的隧道配置
 */
app.get('/client/tunnels/:authenKey', async function (req, res) {

  let client = await Client.findOne({
    where: {
      authenKey: req.params.authenKey
    },
    include: Tunnel
  });

  if (client == null) {
    res.send({
      success: false,
      data: null,
      info: 'this authenKey has no client'
    });
    return;
  }
  res.send({
    success: true,
    data: client.tunnels
  });

});


app.post('/client/startProxy', async function (req, res) {

  let tunnelId = req.body.tunnelId;
  let authenKey = req.body.authenKey;

  let client = await Client.findOne({
    where: {
      authenKey: authenKey,
      isAvailable: true
    },
    include: Tunnel
  });

  if (client == null) {
    res.send({
      success: false,
      data: 'error client authenKey'
    });
    return;
  }

  let tunnel = await Tunnel.findOne({
    where: {
      clientId: client.id,
      id: tunnelId,
      isAvailable: true
    }
  })

  if (tunnel == null) {
    res.send({
      success: false,
      data: 'error tunnel id'
    });
    return;
  }


  setTimeout(() => {
    res.send({
      success: true,
      data: tunnel
    });
  }, 1000);

});





process.on("uncaughtException", function (err) {
  logger.error(err);
});


/**
 * 初始化数据库
 * @returns 
 */
async function initdbdata() {
  await initDb(sequelize);
  if (serverConfig.init.firstInit == false) {
    return;
  }
  let firstUser = 'fastnat';
  let existUser = await RegisterUser.findOne(
    {
      where: {
        username: firstUser
      },

      include: [{
        association: RegisterUser.Clients,
        as: 'clients'
      }
      ]
    }
  );

  if (existUser != null && existUser.username === firstUser) {
    return;
  }

  let authenKey = uuidv4();

  let user = await RegisterUser.create({
    username: firstUser,
    password: firstUser,
    telphone: '010-123456',
    email: 'fastnat@fastnat.com',
    clients: [
      {
        authenKey: authenKey
      }
    ]
  },
    {
      include: [{
        association: RegisterUser.Clients,
        as: 'clients'
      }
      ]
    }
  );

  let clientData = user.clients[0];
  console.log(JSON.stringify(clientData));
  let clientId = clientData.id;

  let tunnel = await Tunnel.create({
    type: 'tcp',
    name: 'mysql',
    localIp: '127.0.0.1',
    localPort: 3306,
    remotePort: 13306,
    clientId: clientId
  });

  logger.debug('first client authenKey:' + clientData.authenKey);

}

/**
 * 初始化
 * @param {Sequelize} sequelize 
 */
async function initDb(sequelize) {
  if (serverConfig.init.firstInit) {
    logger.debug('init.firstInit=true,init all at first....');
    await sequelize.sync({ force: true });
  } else {
    await sequelize.sync({});
  }
}