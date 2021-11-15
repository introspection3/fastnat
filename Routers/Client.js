const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel, Connector } = require('../Db/Models');
const logger = require('../Log/logger');
const { v4: uuidv4 } = require('uuid');
const eventEmitter = require('../Communication/CommunicationEventEmiter').eventEmitter;
const ServerConfig = require('../Common/ServerConfig');
const userConfig = ServerConfig.user;
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const commandType = require('../Communication/CommandType').commandType;
const NetUtil = require('../Utils/NetUtil');
const path = require('path');
const parentDir = require('../Common/GlobalData').rootPath;
const configDir = path.join(parentDir, "config");
const defaultConfigPath = path.join(configDir, 'default.json');
const readFile = require('fs').promises.readFile;

router.use(function(req, res, next) {
    if (req.path.startsWith('/api')) {
        next();
    } else {
        if (req.session.user) {
            next();
        } else {
            res.send('no login');
            logger.warn('no login' + req.path);
        }

    }

});



router.post('/delete', async(req, res, next) => {
    let id = Number.parseInt(req.body.id);
    let count = await Client.count({
        where: {
            registerUserId: req.session.user.id,
            id: id
        }
    });
    if (count === 0) {
        let result = {
            success: false,
            data: req.body,
            info: 'client user wrong'
        }
        res.send(result);
        return;
    }

    await Connector.destroy({
        where: {
            clientId: id
        }
    })
    await Tunnel.destroy({
        where: {
            clientId: id
        }
    })
    count = await Client.destroy({
        where: {
            id: id,
            registerUserId: req.session.user.id
        }
    });
    if (count > 0) {
        eventEmitter.emit(commandType.DELETE_CLIENT, id);
    }
    res.send({
        success: true,
        data: id,
        info: 'success'
    });
});

router.post('/update', async(req, res, next) => {
    let clientName = req.body.clientName;
    let id = Number.parseInt(req.body.id);

    let count = await Client.count({
        where: {
            registerUserId: req.session.user.id,
            id: id
        }
    });
    if (count === 0) {
        let result = {
            success: false,
            data: req.body,
            info: 'client user wrong'
        }
        res.send(result);
        return;
    }

    count = await Client.count({
        where: {
            registerUserId: req.session.user.id,
            clientName: clientName,
            id: {
                [Op.ne]: id
            }
        }
    });
    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '此设备名已被您使用，请重换一个设备名'
        }
        res.send(result);
        return;
    }


    count = await Client.update({
        clientName: clientName
    }, {
        where: {
            id: id,
            registerUserId: req.session.user.id
        }
    });

    let result = {
        success: true,
        data: null,
        info: 'success'
    }
    res.send(result);
});

router.post('/add', async(req, res, next) => {
    let count = await Client.count({
        where: {
            registerUserId: req.session.user.id
        }
    });

    if (count >= userConfig[req.session.user.userType].client.count) {
        let result = {
            success: false,
            data: null,
            info: '您的设备数已达最大值，您可以通过捐助获取VIP权限'
        }
        res.send(result);
        return;
    }
    count = await Client.count({
        where: {
            registerUserId: req.session.user.id,
            clientName: req.body.clientName
        }
    });
    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '此设备名已被您使用，请重换一个设备名'
        }
        res.send(result);
        return;
    }
    let client = await Client.create({
        authenKey: uuidv4(),
        clientName: req.body.clientName,
        virtualIp: uuidv4(),
        registerUserId: req.session.user.id
    });
    let virtualIp = NetUtil.getVirtualIp(client.id);
    await Client.update({
        virtualIp: virtualIp
    }, {
        where: {
            id: client.id
        }
    });
    client.virtualIp = virtualIp;
    let result = {
        success: true,
        data: client,
        info: 'success'
    }
    res.send(result);
});

router.get(`/getTunnelsByClientId`, async(req, res, next) => {
    let id = req.query.id;
    if (!id) {
        let result = {
            "total": 0,
            "rows": []
        }
        res.send(result);
        return;
    }
    let client = await Client.findOne({
        where: {
            id: id,
            isAvailable: true
        },
        include: [{
                model: Tunnel,
                required: false,
                where: {
                    isAvailable: 1
                }
            },
            {
                model: RegisterUser,
                required: true,
                where: {
                    isAvailable: 1,
                    id: req.session.user.id
                }
            }
        ]
    });
    let result = {
        "total": client.tunnels.length,
        "rows": client.tunnels
    }
    res.send(result);
});

router.get(`/tunnels/:authenKey`, async(req, res, next) => {
    let client = await Client.findOne({
        where: {
            authenKey: req.params.authenKey,
            isAvailable: true
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

router.get(`/connectors/:authenKey`, async(req, res, next) => {
    let client = await Client.findOne({
        where: {
            authenKey: req.params.authenKey,
            isAvailable: true
        },
        include: Connector
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
        data: client.connectors
    });
});

router.get(`/api/getClientP2PInfoByTunnelId`, async(req, res, next) => {

    let tunnelId = req.query.tunnelId;
    let authenKey = req.query.authenKey;

    let client = await Client.findOne({
        where: {
            isAvailable: true
        },
        include: [{
            model: Tunnel,
            required: true,
            where: {
                isAvailable: 1,
                id: tunnelId
            }
        }]
    });

    if (client == null) {
        res.send({
            success: false,
            info: 'error client authenKey',
            data: null
        });
        return;
    }


    let reuslt = {
        publicIp: client.publicIp,
        clientId: client.id,
        remotePort: client.tunnels[0].remotePort, // for tcp fallover
        natType: client.natType
    }


    res.send({
        success: true,
        info: 'sucess',
        data: reuslt
    });
});


router.put('/api/:authenKey', async function(req, res, next) {
    let result = await Client.update({
        os: req.body.os,
        mac: req.body.mac,
        natType: req.body.natType,
        publicIp: req.ip,
        updatedAt: new Date(),
        hostName: req.body.hostName || '',
        arch: req.body.arch || '',
        platform: req.body.platform || '',
        version: req.body.version || '',
        osReleaseVersion: req.body.osReleaseVersion || ''
    }, {
        where: {
            authenKey: req.params.authenKey
        }
    });

    let success = result[0] > 0;
    res.send({
        success: success,
        data: req.params.authenKey,
        info: 'update success=' + success
    });
});

router.get('/api/getDefaultConfig/:authenKey', async function(req, res, next) {
    let content = await readFile(defaultConfigPath);
    var data = JSON.parse(content);
    res.send({
        success: false,
        data: data,
        info: ''
    });
});

router.get('/api/:authenKey', async function(req, res, next) {
    let client = await Client.findOne({
        where: {
            authenKey: req.params.authenKey,
            isAvailable: true
        },
        include: [{
                model: Tunnel,
                required: false,
                where: {
                    isAvailable: 1
                }
            },
            {
                model: Connector,
                required: false,
                where: {
                    isAvailable: 1
                }
            }
        ]
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
        data: client
    });
});


module.exports = router