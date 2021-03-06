 const serverConfig = require('../Common/ServerConfig');
 const sequelize = require('./Db');
 const { RegisterUser, Client, Tunnel, Connector } = require('./Models');
 const { v4: uuidv4 } = require('uuid');
 const logger = require('../Log/logger');
 const N2NServer = require('../N2N/N2NServer');
 const rootPath = require('../Common/GlobalData').rootPath;
 const md5 = require('md5');
 const communityListPath = require('path').join(rootPath, 'config', 'community.list');
 const userType = require('./Enums').userType;
 const mysql2 = require('mysql2');
 const createPool = mysql2.createPool;
 const mysql = require('mysql2/promise');
 const dbConfig = serverConfig.db;
 /**
  * 初始化数据库
  * @returns 
  */
 async function initdbdata() {
     await initDb(sequelize);
     if (serverConfig.init.firstInit == false) {
         return;
     }
     logger.debug('start init db data...');
     let firstUser = 'fastnat';
     let existUser = await RegisterUser.findOne({
         where: {
             username: firstUser
         },

         include: [{
             association: RegisterUser.Clients,
             as: 'clients'
         }]
     });

     if (existUser != null && existUser.username === firstUser) {
         return;
     }

     let authenKey = uuidv4();

     let user = await RegisterUser.create({
         username: firstUser,
         userType: userType.normal,
         password: md5(firstUser + ".."),
         telphone: '010-123456',
         email: 'fastnat@fastnat.com',
         clients: [{
                 authenKey: '742af98b-e977-48a8-b1c8-1a2a091b93a7',
                 clientName: '设备1',
                 virtualIp: '10.0.0.2',
                 status: 0
             },
             {
                 authenKey: '742af98b-e977-48a8-b1c8-1a2a091b93a2',
                 clientName: '设备2',
                 virtualIp: '10.0.0.3',
                 status: 0
             }
         ]
     }, {
         include: [{
             association: RegisterUser.Clients,
             as: 'clients'
         }]
     });
     await N2NServer.createUser(communityListPath, 1, '742af98b-e977-48a8-b1c8-1a2a091b93a7');
     await N2NServer.createUser(communityListPath, 2, '742af98b-e977-48a8-b1c8-1a2a091b93a2');
     let clientData = user.clients[0];
     let clientId = clientData.id;
     let tunnel1 = await Tunnel.create({
         type: 'tcp',
         name: 'http代理',
         localIp: '127.0.0.1',
         localPort: 9910,
         remotePort: 19910,
         clientId: 2,
         uniqueName: 'uniqueName1',
         lowProtocol: 'tcp'
     });

     let tunnel2 = await Tunnel.create({
         type: 'p2p',
         name: 'p2ptest',
         localIp: '127.0.0.1',
         localPort: 3306,
         remotePort: 13306,
         clientId: 1,
         uniqueName: 'uniqueName2',
         p2pPassword: 'fastnat',
         lowProtocol: 'tcp'
     });

     let connector1 = await Connector.create({
         name: 'p2ptest',
         p2pTunnelId: tunnel2.id,
         localPort: 9999,
         p2pPassword: 'fastnat',
         clientId: 2
     });

     let tunnel3 = await Tunnel.create({
         type: 'http',
         name: 'http',
         localIp: '192.168.1.1',
         localPort: 80,
         remotePort: 8000,
         clientId: 2,
         uniqueName: 'test',
         lowProtocol: 'tcp'
     });

     let tunnel4 = await Tunnel.create({
         type: 'udp',
         name: 'udp',
         localIp: '8.8.8.8',
         localPort: 53,
         remotePort: 153,
         clientId: 2,
         uniqueName: 'udptest',
         lowProtocol: 'udp'
     });


     let tunnel5 = await Tunnel.create({
         type: 'socks5',
         name: 'socks5',
         localIp: '0.0.0.0',
         localPort: 1080,
         remotePort: 10800,
         clientId: 2,
         uniqueName: 'socks5test',
         lowProtocol: 'tcp',
         other: `{"authenEnabled":true,"username":"fastnat","password":"fastnat"}`
     });

     logger.debug(`db install ok`);

 }

 /**
  * 初始化
  * @param {Sequelize} sequelize 
  */
 async function initDb() {
     if (serverConfig.init.firstInit) {
         logger.debug('init.firstInit=true,init all at first....');
         if (dbConfig.dbType === 'mysql') {
             console.log(JSON.stringify(dbConfig))
             const connection = await mysql.createConnection({ host: dbConfig.host, port: dbConfig.port, user: dbConfig.username, password: dbConfig.password });
             await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
             connection.destroy();
         }
         await sequelize.sync({ force: true });

     } else {
         await sequelize.sync({});
     }

     await stopSever();
 }
 async function stopSever() {
     await Client.update({
         status: 0
     }, {
         where: {
             isAvailable: 1
         }
     });
 }
 module.exports = {
     initdbdata
 };