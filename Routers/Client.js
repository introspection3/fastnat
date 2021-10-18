const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel, Connector } = require('../Db/Models');
const logger = require('../Log/logger');
const { v4: uuidv4 } = require('uuid');
const eventEmitter = require('../Communication/CommunicationEventEmiter').eventEmitter;

router.use(function(req, res, next) {
    next();
});

function int2iP(num) {
    var str;
    var tt = new Array();
    tt[0] = (num >>> 24) >>> 0;
    tt[1] = ((num << 8) >>> 24) >>> 0;
    tt[2] = (num << 16) >>> 24;
    tt[3] = (num << 24) >>> 24;
    str = String(tt[0]) + "." + String(tt[1]) + "." + String(tt[2]) + "." + String(tt[3]);
    return str;
}
async function getVirtualIpAsync(clientId) {
    let num = Number.parseInt(clientId);
    if (num > 184549374) {
        logger.fatal('IP已经被占用完毕,需要重新来过!!!!');
        return '10.255.255.254';
    } else {
        num = 167772161 + num;
        let result = int2iP(num);
        return result;
    }
}

router.post('/delete', async(req, res, next) => {
    let id = Number.parseInt(req.body.id);
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
    let count = await Client.destroy({
        where: {
            id: id,
            registerUserId: req.session.user.id
        }
    });
    if (count > 0) {
        eventEmitter.emit('delete.client', id);
    }
    res.send({
        success: true,
        data: id,
        info: 'success'
    });
});

router.post('/update', async(req, res, next) => {
    let clientName = req.body.clientName;
    let id = req.body.id;
    let count = await Client.update({
        clientName: clientName
    }, {
        where: {
            id: id,
            registerUserId: req.session.user.id
        }
    });
});

router.post('/add', async(req, res, next) => {
    let client = await Client.create({
        authenKey: uuidv4(),
        clientName: req.body.clientName,
        virtualIp: uuidv4(),
        registerUserId: req.session.user.id
    });
    let virtualIp = await getVirtualIpAsync(client.id);
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

router.get(`/getClientP2PInfoByTunnelId`, async(req, res, next) => {

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

router.post(`/startProxy`, async(req, res, next) => {

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
})

router.put('/:authenKey', async function(req, res, next) {
    let result = await Client.update({
        os: req.body.os,
        mac: req.body.mac,
        natType: req.body.natType,
        publicIp: req.ip,
        updatedAt: new Date()
    }, {
        where: {
            authenKey: req.params.authenKey
        }
    });
    console.log(req.params.authenKey)
    let success = result[0] > 0;
    res.send({
        success: success,
        data: req.params.authenKey,
        info: 'update success=' + success
    });
});



router.get('/:authenKey', async function(req, res, next) {
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