const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');

router.post('/register', async function (req, res, next) {
    let user = await RegisterUser.create(req.body);
    let client = await Client.create({
        authenKey: uuidv4(),
        registerUserId: user.id
    });
    res.send(client);
});


module.exports = router

