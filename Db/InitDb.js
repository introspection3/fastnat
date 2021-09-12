const defaultConfig = require('../Common/DefaultConfig');
const serverConfig = require('../Common/ServerConfig');
const sequelize = require('./Db');
const { RegisterUser, Client, Tunnel, Connector } = require('./Models');
const { v4: uuidv4 } = require('uuid');
const logger = require('../Log/logger');


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
                authenKey: '742af98b-e977-48a8-b1c8-1a2a091b93a7'
            },
            {
                authenKey: '742af98b-e977-48a8-b1c8-1a2a091b93a2'
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

    let tunnel1 = await Tunnel.create({
        type: 'tcp',
        name: 'mysql',
        localIp: '127.0.0.1',
        localPort: 3306,
        remotePort: 13306,
        clientId: 2,
        uniqueName:'uniqueName1',
        lowProtocol:'tcp'
    });

    let tunnel2 = await Tunnel.create({
        type: 'p2p',
        name: 'p2ptest',
        localIp: '192.168.1.3',
        localPort: 22,
        remotePort: 2222,
        clientId: 1,
        uniqueName:'uniqueName2',
        lowProtocol:'tcp'
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
        uniqueName:'uniqueName3',
        lowProtocol:'tcp'
    });

   

    logger.debug(`db install ok`);

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
module.exports = initdbdata;