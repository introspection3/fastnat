const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel, Connector } = require('../Db/Models');
const serverConfig = require('../Common/ServerConfig');
const netbuilding = serverConfig.netbuilding;
const netbuildingHost = netbuilding.host;
const netbuildingPort = netbuilding.port;
const netbuildingCommunityKey = netbuilding.communityKey;
const netbuildingVersion = netbuilding.version;
const fs = require('fs').promises;
const AesUtil = require('../Utils/AesUtil');
const rootPath = require('../Common/GlobalData').rootPath;
const communityListPath = require('path').join(rootPath, 'config', 'community.list');
const logger = require('../Log/logger');
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const { commandType } = require('../Communication/CommandType');
const eventEmitter = require('../Communication/CommunicationEventEmiter').eventEmitter;

router.get('/getByClientId', async function(req, res, next) {
    let clientId = req.query.id;
    let count = await Client.count({
        where: {
            id: clientId,
            isAvailable: true
        },
        include: [{
            model: RegisterUser,
            required: true,
            where: {
                isAvailable: true,
                id: req.session.user.id
            }
        }]
    });

    if (count == 0) {
        let result = {
            "total": 0,
            "rows": []
        }
        res.send(result);
        return;
    }

    if (!clientId) {
        let result = {
            "total": 0,
            "rows": []
        }
        res.send(result);
        return;
    }


    let all = await Connector.findAll({
        where: {
            clientId: clientId
        }
    });
    let result = {
        "total": all.length,
        "rows": all
    }

    res.send(result);
});


router.post('/delete', async(req, res, next) => {
    let id = Number.parseInt(req.body.id);
    let clientId = Number.parseInt(req.body.clientId);

    let count = await Client.count({
        where: {
            id: clientId
        },
        include: [{
                model: RegisterUser,
                required: true,
                where: {
                    id: req.session.user.id
                }
            },
            {
                model: Connector,
                required: true,
                where: {
                    id: id
                }
            }

        ]
    });

    if (count === 0) {
        let result = {
            success: false,
            data: req.body,
            info: 'client &id & user wrong'
        }
        res.send(result);
        return;
    }

    count = await Connector.destroy({
        where: {
            id: id
        }
    })
    if (count > 0) {
        eventEmitter.emit(commandType.DELETE_CONNECTOR, clientId, id);
    }
    res.send({
        success: true,
        data: id,
        info: 'success'
    });
});

router.post('/update', async(req, res, next) => {
    let id = Number.parseInt(req.body.id);
    let clientId = Number.parseInt(req.body.clientId);

    let count = await Client.count({
        where: {
            id: clientId
        },
        include: [{
                model: RegisterUser,
                required: true,
                where: {
                    id: req.session.user.id
                }
            },
            {
                model: Connector,
                required: true,
                where: {
                    id: id
                }
            }

        ]
    });

    if (count === 0) {
        let result = {
            success: false,
            data: req.body,
            info: 'client &id & user wrong'
        }
        res.send(result);
        return;
    }


    count = await Connector.count({
        where: {
            clientId: clientId,
            name: req.body.name,
            id: {
                [Op.ne]: id
            }
        }
    });

    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '???????????????????????????????????????????????????????????????'
        }
        res.send(result);
        return;
    }

    count = await Connector.count({
        where: {
            p2pTunnelId: req.body.p2pTunnelId * 1,
            clientId: req.body.clientId * 1,
            id: {
                [Op.ne]: id
            }
        }
    });

    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '??????????????????????????????Id????????????'
        }
        res.send(result);
        return;
    }
    let oldData = await Connector.findOne({
        where: {
            id: id
        }
    });
    let newData = {
        name: req.body.name,
        p2pTunnelId: req.body.p2pTunnelId * 1,
        p2pPassword: req.body.p2pPassword,
        clientId: req.body.clientId * 1,
        localPort: req.body.localPort,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    newData.id = id;
    await Connector.update(newData, {
        where: {
            id: id
        }
    });

    if (!(oldData.localPort == newData.localPort && oldData.p2pTunnelId == newData.p2pTunnelId && oldData.p2pPassword == newData.p2pPassword)) {
        eventEmitter.emit(commandType.DELETE_CONNECTOR, clientId, id);
        setTimeout(() => {
            eventEmitter.emit(commandType.ADD_CONNECTOR, clientId, newData);
        }, 1000);
    }

    let result = {
        success: true,
        data: newData,
        info: 'success'
    }
    res.send(result);

});

router.post('/add', async(req, res, next) => {
    let clientId = Number.parseInt(req.body.clientId);
    let count = await Client.count({
        where: {
            id: clientId
        },
        include: [{
            model: RegisterUser,
            required: true,
            where: {
                id: req.session.user.id
            }
        }]
    });

    if (count === 0) {
        let result = {
            success: false,
            data: req.body,
            info: 'client &id & user wrong'
        }
        res.send(result);
        return;
    }


    count = await Connector.count({
        where: {
            clientId: req.body.clientId,
            name: req.body.name
        }
    });
    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '???????????????????????????????????????????????????????????????'
        }
        res.send(result);
        return;
    }

    count = await Connector.count({
        where: {
            p2pTunnelId: req.body.p2pTunnelId,
            clientId: req.body.clientId
        }
    });
    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '??????????????????????????????Id????????????'
        }
        res.send(result);
        return;
    }
    count = await Tunnel.count({
        where: {
            id: req.body.p2pTunnelId * 1,
            p2pPassword: req.body.p2pPassword
        }
    });
    if (count === 0) {
        let result = {
            success: false,
            data: null,
            info: '???????????????????????????????????????Id??????p2p????????????'
        }
        res.send(result);
        return;
    }
    let cc = await Connector.create({
        name: req.body.name,
        p2pTunnelId: req.body.p2pTunnelId * 1,
        p2pPassword: req.body.p2pPassword,
        localPort: req.body.localPort,
        createdAt: new Date(),
        updatedAt: new Date(),
        isAvailable: 1,
        clientId: req.body.clientId * 1
    });
    eventEmitter.emit(commandType.ADD_CONNECTOR, cc.clientId, cc);
    res.send({
        success: true,
        data: cc,
        info: 'success'
    });
});


module.exports = router