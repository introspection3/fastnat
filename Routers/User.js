const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const N2NServer = require('../N2N/N2NServer');
const configPath = require('../Common/GlobalData').configPath;
const path = require('path');
const svgCaptcha = require('svg-captcha');
const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const sequelize = require('../Db/Db');
const { v4: uuidv4 } = require('uuid');
const md5 = require('md5');
const NetUtil = require('../Utils/NetUtil');
const svgFontPath = path.join(configPath, 'fonts', 'Comismsh.ttf');
const EmailUtil = require('../Utils/EmailUtil');

router.post('/register', async function(req, res, next) {
    let info = req.body;
    let result = {
        success: false,
        data: null,
        info: ''
    };
    if (req.session.captcha !== info.vcode.toLowerCase()) {
        result = {
            success: false,
            data: 'vcode',
            info: '验证码错误'
        };
        res.send(result);
        return;
    }
    if (req.session.emailCode !== info.emailCode.toUpperCase()) {
        result = {
            success: false,
            data: 'vcode',
            info: '邮箱验证码错误'
        };
        res.send(result);
        return;
    }
    let count = await RegisterUser.count({
        where: {
            username: info.username
        }
    });
    if (count >= 1) {
        result.success = false;
        result.info = '用户名已存在';
        res.send(result);
        return;
    }
    info.telphone = 'NO_' + uuidv4();
    count = await RegisterUser.count({
        where: {
            email: info.email
        }
    });
    if (count >= 1) {
        result.success = false;
        result.info = '此邮箱已被使用';
        res.send(result);
        return;
    }
    let transaction = await sequelize.transaction();
    try {
        let user = await RegisterUser.create({
            username: info.username,
            password: md5(info.password),
            telphone: info.telphone,
            email: info.email
        }, { t: transaction });

        let client1 = await Client.create({
            authenKey: uuidv4(),
            registerUserId: user.id,
            clientName: '设备1',
            virtualIp: uuidv4()
        }, { t: transaction });

        let virtualIp = NetUtil.getVirtualIp(client1.id);
        await Client.update({
            virtualIp: virtualIp
        }, {
            where: {
                id: client1.id
            }
        }, { t: transaction });

        let client2 = await Client.create({
            authenKey: uuidv4(),
            registerUserId: user.id,
            clientName: '设备2',
            virtualIp: uuidv4()
        }, { t: transaction });

        virtualIp = NetUtil.getVirtualIp(client2.id);
        await Client.update({
            virtualIp: virtualIp
        }, {
            where: {
                id: client2.id
            }
        }, { t: transaction });

        await transaction.commit();
        result.success = true;
        req.session.user = user;
        req.session.role = 'user';
    } catch (error) {
        await transaction.rollback();
        result.success = false;
        result.info = error;
    }

    //N2NServer.createUser(communityListPath, client1.id, client1.authenKey);
    res.send(result);

});

router.get('/quit', async function(req, res, next) {
    req.session.captcha = null;
    req.session.user = null;
    res.redirect('/login.html');
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
    svgCaptcha.loadFont(svgFontPath);
    const captcha = svgCaptcha.create(codeConfig);
    req.session.captcha = captcha.text.toLowerCase();
    res.type('image/svg+xml');
    res.send(captcha.data);
});


router.post('/sendEmailCode', async function(req, res, next) {
    let result = {
        success: false,
        data: null,
        info: ''
    }
    let email = req.body.email;
    let myReg = /^[a-zA-Z0-9_-]+@([a-zA-Z0-9]+\.)+(com|cn|net|org)$/;　　
    if (!myReg.test(email)) {　　　
        result.info = '邮箱格式有误';
        res.send(result);
    } else {

        let count = await RegisterUser.count({
            where: {
                email: email
            }
        });

        if (count >= 1) {
            result.success = false;
            result.info = '此邮箱已被其他人使用';
            res.send(result);
            return;
        }

        let code = Math.random().toString(36).substr(2, 4).toUpperCase();
        req.session.emailCode = code;
        let info = await EmailUtil.sendMailAsync(email, 'fastnat邮箱验证码', `欢迎使用注册fastnat,您的邮箱验证码是:<b>${code}</b>,<br/>请勿回复`);
        result.info = '邮箱验证码已发送,请查收';
        result.success = true;
        res.send(result);
    }

});

router.post('/doLogin', async function(req, res, next) {
    let result = {
        success: false,
        data: null,
        info: ''
    }
    let info = req.body;
    let password = info.password;
    let username = info.username + '';
    if (username.endsWith('___')) {
        username = username.substring(0, username.length - 3);
    } else {
        password = md5(info.password);
    }
    let user = await RegisterUser.findOne({
        where: {
            username: username,
            password: password,
            isAvailable: true
        }
    });
    if (req.session.captcha !== info.vcode.toLowerCase()) {
        result = {
            success: false,
            data: 'vcode',
            info: '验证码错误'
        };
        res.send(result);
        return;
    }
    let existUser = user != null;

    result.success = existUser;
    if (result.success === false) {
        result.info = '用户名或者密码错误';
    } else {
        result.info = '登录成功';
        req.session.user = user;
        req.session.role = 'user';
    }
    res.send(result);

});

router.get('/isOnline', async function(req, res, next) {

    let result = {
        success: req.session.user != null,
        data: req.session.user,
        info: md5('fastnat')
    }

    res.send(result);

});


router.get('/clients', async function(req, res, next) {
    if (!req.session.user) {
        req.redirect('/login.html');
        return;
    }
    let username = req.session.user.username;
    // let request = JSON.parse(req.query.request);
    // console.log(req.query.request);
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
        "total": user.clients.length,
        "rows": user.clients
    }

    // let result = {
    //     "status": "success",
    //     "total": user.clients.length,
    //     "records": user.clients
    // }
    res.send(result);

});




module.exports = router