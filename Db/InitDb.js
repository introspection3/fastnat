const defaultConfig = require('../Common/DefaultConfig');
const serverConfig = require('../Common/ServerConfig');
const sequelize = require('./Db');
const { RegisterUser, Client, Tunnel } = require('./Models');
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
        await sequelize.sync({  });
    }
}
module.exports=initdbdata;