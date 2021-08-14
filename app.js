const express = require('express');
const { RegisterUser, Client, Tunnel } = require('./Db/Models');
const app = express();
const bodyParser = require("body-parser");
app.use('/public', express.static('public'));
const { v4: uuidv4 } = require('uuid');
const logger = require('./Log/logger');
const TcpTunnelServer = require('./TcpTunnel/TcpTunnelServer');
app.use(bodyParser.json());
const defaultConfig = require('./Common/Config');
const serverConfig = require('./Common/ServerConfig');
const sequelize = require('./Db/Db');
const defaultServerConfig = defaultConfig.server;
logger.log(defaultServerConfig);

app.get('/checkServerStatus', function (req, res) {
  res.send({ success: true });
});

app.get('/', async function (req, res) {
  let user = await RegisterUser.create(data);
  let client = await Client.create({
    authenKey: uuidv4(),
    registerUserId: user.id
  });
  res.send(client);
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
      data: null
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

let tcpTunnelServer = new TcpTunnelServer({ host: '0.0.0.0', port: defaultServerConfig.tcpTunnelServerPort });
tcpTunnelServer.start();

let server = app.listen(8081, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("fastnat web start at: http://%s:%s", host, port);
  init();
});


process.on("uncaughtException", function (err) {
  logger.error(err);
});


/**
 * 初始化数据库
 * @returns 
 */
async function init() {

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

  let authenKey=uuidv4();

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

  logger.warn('first client authenKey:' + clientData.authenKey);
}

/**
 * 初始化
 * @param {Sequelize} sequelize 
 */
async function initDb(sequelize) {
  if (serverConfig.init.firstInit) {
    logger.warn('init.firstInit=true,init all at first....');
    await sequelize.sync({ force: true });
  } else {
    await sequelize.sync({});
  }
}