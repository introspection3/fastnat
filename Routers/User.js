const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const N2NServer = require('../N2N/N2NServer');
const configPath = require('../Common/GlobalData.js').configPath;
const communityListPath = require('path').join(configPath, 'community.list');

router.post('/register', async function(req, res, next) {
    let user = await RegisterUser.create(req.body);
    let client1 = await Client.create({
        authenKey: uuidv4(),
        registerUserId: user.id
    });
    let client2 = await Client.create({
        authenKey: uuidv4(),
        registerUserId: user.id
    });
    N2NServer.createUser(communityListPath, client1.id, client1.authenKey);
    N2NServer.createUser(communityListPath, client2.id, client2.authenKey);
    res.send(client);
});

module.exports = router