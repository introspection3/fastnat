const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');

router.get('/getP2PInfo', async function (req, res, next) {
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
            data:null
        });
        return;
    }

    
    let reuslt={
        publicIp:client.publicIp,
        remotePort:client.tunnels[0].remotePort,
        natType:client.natType
    }
    res.send(reuslt);
});


module.exports = router

