const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');

router.get('/getP2PInfo', async function(req, res, next) {
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


router.post('/update', async(req, res, next) => {

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
            info: 'client user wrong'
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
    await Tunnel.update(data, {
        where: {
            id: data.id,
            isAvailable: 1
        }
    });

    let result = {
        success: true,
        data: req.body,
        info: 'success'
    }
    res.send(result);
});



router.post('/delete', async(req, res, next) => {
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


    await Tunnel.destroy({
        where: {
            id: tunnelId,
            clientId: req.body.clientId
        }
    });

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
            id: req.body.clientId,
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
    let client = await Tunnel.create(data);

    let result = {
        success: true,
        data: client,
        info: 'success'
    }
    res.send(result);
});


module.exports = router