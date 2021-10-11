const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const N2NServer = require('../N2N/N2NServer');
const configPath = require('../Common/GlobalData.js').configPath;
const communityListPath = require('path').join(configPath, 'community.list');
const svgCaptcha = require('svg-captcha');
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db/Db');
const { v4: uuidv4 } = require('uuid');

router.post('/register', async function(req, res, next) {
    let info = JSON.parse(req.body.request).record;
    let result = {
        success: false,
        data: null,
        info: ''
    };

    let existUser = await RegisterUser.count({
        where: {
            username: info.username
        }
    });
    if (existUser >= 1) {
        result.success = false;
        result.info = '用户名已存在';
        res.send(result);
        return;
    }
    existUser = await RegisterUser.count({
        where: {
            telphone: info.telphone
        }
    });
    if (existUser >= 1) {
        result.success = false;
        result.info = '此的电话已被使用';
        res.send(result);
        return;
    }
    existUser = await RegisterUser.count({
        where: {
            telphone: info.email
        }
    });
    if (existUser >= 1) {
        result.success = false;
        result.info = '此邮箱已被使用';
        res.send(result);
        return;
    }
    let transaction = await sequelize.transaction();
    try {
        let user = await RegisterUser.create({
            username: info.username,
            password: info.password,
            telphone: info.telphone,
            email: info.email
        }, { t: transaction });
        let client1 = await Client.create({
            authenKey: uuidv4(),
            registerUserId: user.id,
            clientName: '设备1'
        }, { t: transaction });
        let client2 = await Client.create({
            authenKey: uuidv4(),
            registerUserId: user.id,
            clientName: '设备2'
        }, { t: transaction });
        await transaction.commit();
        result.success = true;
    } catch (error) {
        await transaction.rollback();
        result.success = false;
        result.info = error;
    }

    //N2NServer.createUser(communityListPath, client1.id, client1.authenKey);
    res.send(result);

});

router.get('/vcode', async function(req, res, next) {
    const codeConfig = {
        size: 4, // 验证码长度
        ignoreChars: '0oO1ilI', // 验证码字符中排除 0oO1ilI
        noise: 2, // 干扰线条的数量
        width: 160,
        height: 50,
        fontSize: 50,
        color: true, // 验证码的字符是否有颜色，默认没有，如果设定了背景，则默认有
        background: '#eee',
    };
    const captcha = svgCaptcha.create(codeConfig);
    req.session.captcha = captcha.text;
    res.type('image/svg+xml');
    res.send(captcha.data);
});
router.get('/clients', async function(req, res, next) {
    let username = 'fastnat';
    let request = JSON.parse(req.query.request);
    console.log(req.query.request);
    let user = await RegisterUser.findOne({
        where: {
            username: username,
            isAvailable: true
        },
        include: Client
    });

    if (user == null) {
        res.send({
            "status": "error",
            "message": "user not exist"
        });
        return;
    }

    let result = {
        "status": "success",
        "total": user.clients.length,
        "records": user.clients
    }
    res.send(result);

});




module.exports = router