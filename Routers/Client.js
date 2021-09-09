const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel, Connector } = require('../Db/Models');
const logger = require('../Log/logger');

router.get(`/tunnels/:authenKey`, async (req, res, next) => {
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

router.get(`/connectors/:authenKey`, async (req, res, next) => {
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

router.get(`/getClientP2PInfoByTunnelId`, async (req, res, next) => {
 
    let tunnelId = req.query.tunnelId;
    let authenKey = req.query.authenKey;
   
    let client = await Client.findOne({
        where: {
            isAvailable: true
        },
        include: [
            {
                model: Tunnel,
                required: true,
                where: {
                    isAvailable: 1,
                    id:tunnelId
                }
            } 
        ]
    });

    if (client == null) {
        res.send({
            success: false,
            info: 'error client authenKey',
            data:null
        });
        return;
    }

     
    let reuslt={
        publicIp:client.publicIp,
        clientId:client.id,
        remotePort:client.tunnels[0].remotePort,// for tcp fallover
        natType:client.natType
    }

    
    res.send({
        success: true,
        info: 'sucess',
        data:reuslt
    });
});

router.post(`/startProxy`, async (req, res, next) => {

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

router.put('/:authenKey', async function (req, res, next) {
    let result = await Client.update(
        {
            os: req.body.os,
            mac: req.body.mac,
            natType: req.body.natType,
            publicIp: req.ip
        },
        {
            where: {
                authenKey: req.params.authenKey
            }
        }
    );

    let success = result[0] > 0;
    res.send({
        success: success,
        data: req.params.authenKey,
        info: 'update success=' + success
    });
});



router.get('/:authenKey', async function (req, res, next) {
    let client = await Client.findOne({
        where: {
            authenKey: req.params.authenKey,
            isAvailable: true
        },
        include: [
            {
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