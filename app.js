const express = require('express');
const { RegisterUser, Client, Tunnel } = require('./Db/Models');
const app = express();
const bodyParser = require("body-parser");
app.use('/public', express.static('public'));
const { v4: uuidv4 } = require('uuid');
const logger = require('./Log/logger');
const TcpTunnelServer = require('./TcpTunnel/TcpTunnelServer');
app.use(bodyParser.json());
const config = require('./Common/Config');
const serverConfig = config.get('server');
logger.log(serverConfig);

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

app.get('/user/init', async function (req, res) {

  let existUser = await RegisterUser.findOne(
    {
      where: {
        username: 'user1'
      },

      include: [{
        association: RegisterUser.Clients,
        as: 'clients'
      }
      ]

    }
  );

  if (existUser != null && existUser.username === 'user1') {
    res.send(existUser);
    return;
  }
  let user = await RegisterUser.create({
    username: 'user1',
    password: 'user1',
    telphone: '123456',
    email: 'user1@g.com',
    clients: [
      {
        authenKey: uuidv4(),
        tunnels: [{
          type: 'tcp',
          name: 'mysql',
          localIp: '127.0.0.1',
          localPort: 3306,
          remotePort: 13306
        }]
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

  let clientId = user.clients[0].id;

  let tunnel = await Tunnel.create({

    type: 'tcp',
    name: 'mysql',
    localIp: '127.0.0.1',
    localPort: 3306,
    remotePort: 13306,
    clientId: clientId

  });

  res.send(user);
});

app.get('/client/tunnels/:authenKey', function (req, res) {
  Client.findOne({
    where: {
      authenKey: req.params.authenKey
    },
    include: Tunnel
  }).then(client => {

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

let tcpTunnelServer = new TcpTunnelServer({ host: '0.0.0.0', port: serverConfig.tcpTunnelServerPort });
tcpTunnelServer.start();

let server = app.listen(8081, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("fastnat web start at: http://%s:%s", host, port);
});


process.on("uncaughtException", function (err) {
  logger.error(err);
});

