const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel, Connector } = require('../Db/Models');
const commandType = require('../Communication/CommandType').commandType;
const eventEmitter = require('../Communication/CommunicationEventEmiter').eventEmitter;
const redlock = require('../Utils/RedisUtil').redlock;
const NetUtil = require('../Utils/NetUtil');
const logger = require('../Log/logger');
const ServerConfig = require('../Common/ServerConfig');
const userConfig = ServerConfig.user;
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
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

router.get('/api/getP2PInfo', async function(req, res, next) {
    let authenKey = req.params.authenKey;
    let tunnelId = req.params.tunnelId;
    let password = req.params.password;

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
            info: 'error client authenKey',
            data: null
        });
        return;
    }


    let reuslt = {
        publicIp: client.publicIp,
        remotePort: client.tunnels[0].remotePort,
        natType: client.natType
    }
    res.send(reuslt);
});

function getUniqueNameMinLength(userType) {
    if (userType === 'normal') {
        return 6;
    } else if (userType === 'vip') {
        return 4;
    } else if (userType === 'admin') {
        return 1;
    } else {
        return 5;
    }
}

router.post('/update', async(req, res, next) => {

    let clientId = req.body.clientId;
    let tunnelId = req.body.id;

    let count = await Client.count({
        where: {
            id: req.body.clientId,
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

    if (count === 0) {
        let result = {
            success: false,
            data: req.body,
            info: 'client\' user wrong'
        }
        res.send(result);
        return;
    }
    let minLength = getUniqueNameMinLength(req.session.user.userType);
    if (req.body.uniqueName.length < minLength) {
        let result = {
            success: false,
            data: req.body,
            info: '??????????????????????????????????????????:' + minLength
        }
        res.send(result);
        return;
    }

    count = await Tunnel.count({
        where: {
            uniqueName: req.body.uniqueName,
            id: {
                [Op.ne]: req.body.id
            }
        }
    });


    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '???????????????????????????????????????????????????'
        }
        res.send(result);
        return;
    }

    let data = {...req.body,
        isAvailable: 1,
        created: new Date(),
        updatedAt: new Date()
    };

    if (data.type === 'udp') {
        data.lowProtocol = 'udp';
    } else {
        data.lowProtocol = 'tcp';
    }

    let oldData = await Tunnel.findOne({
        where: {
            id: data.id
        }
    });

    //------------------
    let resource = `locks:${data.lowProtocol}:${data.remotePort}`;
    // the maximum amount of time you want the resource locked in milliseconds,
    // keeping in mind that you can extend the lock up until
    // the point when it expires
    var ttl = 1000;

    redlock.lock(resource, ttl, async function(err, lock) {
        // we failed to lock the resource
        if (err) {
            let result = {
                success: false,
                data: t,
                info: '????????????????????????????????????????????????????????????!'
            }
            res.send(result);
            return;
        }
        if (oldData.remotePort != data.remotePort) {
            let isPortUnused = await NetUtil.isPortUnusedAsync(data.lowProtocol, data.remotePort);
            logger.trace('isPortUnused=' + isPortUnused);
            if (!isPortUnused) {
                let result = {
                    success: false,
                    data: data,
                    info: '??????????????????,????????????????????????!'
                }
                res.send(result);
                return;
            }
        }
        let existTunnel = await Tunnel.findOne({
            where: {
                remotePort: data.remotePort,
                lowProtocol: data.lowProtocol
            }
        });

        if (existTunnel && existTunnel.id != tunnelId) {
            let result = {
                success: false,
                data: data,
                info: '????????????????????????,?????????????????????'
            }
            res.send(result);
            return;
        }
        existTunnel = await Tunnel.findOne({
            where: {
                localIp: data.localIp,
                localPort: data.localPort,
                clientId: data.clientId,
                lowProtocol: data.lowProtocol
            }
        });

        if (existTunnel && existTunnel.id != tunnelId) {
            let result = {
                success: false,
                data: data,
                info: '??????????????????????????????????????????,id=' + existTunnel.id
            }
            res.send(result);
            return;
        }

        try {
            await Tunnel.update(data, {
                where: {
                    id: data.id
                }
            });

            let newData = await Tunnel.findOne({
                where: {
                    id: data.id
                }
            });

            if (!(oldData.remotePort == newData.remotePort &&
                    oldData.localPort == newData.localPort &&
                    oldData.type == newData.type &&
                    oldData.localIp == newData.localIp)) {
                eventEmitter.emit(commandType.DELETE_TUNNEL, clientId, tunnelId);
                //?????????????????????????????????
                setTimeout(() => {
                    eventEmitter.emit(commandType.ADD_TUNNEL, clientId, newData);
                }, 1000);
            }
            let result = {
                success: true,
                data: req.body,
                info: 'success'
            }
            res.send(result);
        } catch (error) {
            logger.error(error);
        }

        // unlock your resource when you are done
        lock.unlock(function(err) {
            // we weren't able to reach redis; your lock will eventually
            // expire, but you probably want to log this error
            if (err)
                logger.error(err);
        });
    });


});



router.post('/delete', async(req, res, next) => {
    let tunnelId = req.body.id;
    let clientId = req.body.clientId;
    let count = await Client.count({
        where: {
            id: req.body.clientId * 1,
            isAvailable: true
        },
        include: [{
                model: RegisterUser,
                required: true,
                where: {
                    isAvailable: 1,
                    id: req.session.user.id
                }
            }

        ]
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

    let allConnectors = await Connector.findAll({
        where: {
            p2pTunnelId: tunnelId
        }
    });
    for (const c of allConnectors) {
        eventEmitter.emit(commandType.DELETE_CONNECTOR, c.clientId, c.id);
    }

    count = await Connector.destroy({
        where: {
            p2pTunnelId: tunnelId
        }
    });

    count = await Tunnel.destroy({
        where: {
            id: tunnelId,
            clientId: clientId
        }
    });

    if (count > 0) {
        eventEmitter.emit(commandType.DELETE_TUNNEL, clientId, tunnelId);
    }


    let result = {
        success: true,
        data: tunnelId,
        info: 'success'
    }
    res.send(result);
});

router.post('/add', async(req, res, next) => {

    let count = await Client.count({
        where: {
            id: req.body.clientId * 1
        },
        include: [{
                model: RegisterUser,
                required: true,
                where: {
                    id: req.session.user.id
                }
            }

        ]
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

    let minLength = getUniqueNameMinLength(req.session.user.userType);
    if (req.body.uniqueName.length < minLength) {
        let result = {
            success: false,
            data: req.body,
            info: '??????????????????????????????????????????:' + minLength
        }
        res.send(result);
        return;
    }

    count = await Tunnel.count({
        where: {
            uniqueName: req.body.uniqueName
        }
    });

    if (count > 0) {
        let result = {
            success: false,
            data: null,
            info: '???????????????????????????????????????????????????'
        }
        res.send(result);
        return;
    }

    count = await Tunnel.count({
        where: {
            clientId: req.body.clientId * 1
        }
    });

    if (count >= userConfig[req.session.user.userType].tunnel.count) {
        let result = {
            success: false,
            data: null,
            info: '??????????????????????????????????????????????????????????????????VIP??????'
        }
        res.send(result);
        return;
    }

    let data = {...req.body,
        isAvailable: 1,
        created: new Date(),
        updatedAt: new Date()
    };
    delete data.id;
    if (data.type === 'udp') {
        data.lowProtocol = 'udp';
    } else {
        data.lowProtocol = 'tcp';
    }

    // the string identifier for the resource you want to lock

    let resource = `locks:${data.lowProtocol}:${data.remotePort}`;
    // the maximum amount of time you want the resource locked in milliseconds,
    // keeping in mind that you can extend the lock up until
    // the point when it expires
    var ttl = 1000;

    redlock.lock(resource, ttl, async function(err, lock) {
        // we failed to lock the resource
        if (err) {
            let result = {
                success: false,
                data: t,
                info: '????????????????????????????????????????????????????????????!'
            }
            res.send(result);
            return;
        }
        // we have the lock
        let isPortUnused = await NetUtil.isPortUnusedAsync(data.lowProtocol, data.remotePort);
        logger.trace('isPortUnused+' + isPortUnused);
        if (!isPortUnused) {
            let result = {
                success: false,
                data: data,
                info: '??????????????????,????????????????????????!'
            }
            res.send(result);
            return;
        }
        try {

            let count = await Tunnel.count({
                where: {
                    remotePort: data.remotePort,
                    lowProtocol: data.lowProtocol
                }
            });
            if (count > 0) {
                let result = {
                    success: false,
                    data: data,
                    info: '???????????????????????????,?????????????????????'
                }
                res.send(result);
                return;
            }
            count = await Tunnel.count({
                where: {
                    localIp: data.localIp,
                    localPort: data.localPort * 1,
                    clientId: data.clientId,
                    lowProtocol: data.lowProtocol
                }
            });
            if (count > 0) {
                let result = {
                    success: false,
                    data: data,
                    info: '??????????????????????????????????????????'
                }
                res.send(result);
                return;
            }
            let t = await Tunnel.create(data);
            if (t) {
                eventEmitter.emit(commandType.ADD_TUNNEL, req.body.clientId * 1, t);
            }
            let result = {
                success: true,
                data: t,
                info: 'success'
            }
            res.send(result);
        } catch (error) {
            logger.error(error);
        }

        // unlock your resource when you are done
        lock.unlock(function(err) {
            // we weren't able to reach redis; your lock will eventually
            // expire, but you probably want to log this error
            if (err)
                logger.error(err);
        });
    });


});


module.exports = router