const express = require(`express`);
const router = express.Router();
const { RegisterUser, Client, Tunnel } = require('../Db/Models');
const serverConfig = require('../Common/ServerConfig');
const netbuilding = serverConfig.netbuilding;
const netbuildingHost = netbuilding.host;
const netbuildingPort = netbuilding.port;
const netbuildingVersion = netbuilding.version;
const fs = require('fs').promises;
const AesUtil = require('../Utils/AesUtil');
const communityListPath = require('path').join(process.cwd(), 'config', 'community.list');
const logger = require('../Log/logger');

router.get('/:authenKey', async function(req, res, next) {
    let client = await Client.findOne({
        where: {
            authenKey: req.params.authenKey,
            isAvailable: true
        }
    });

    if (client == null) {
        res.send({
            success: false,
            data: null,
            info: 'this authenKey has no client'
        });
        return;
    }
    let data = await getN2NAsync(client.id);
    res.send({
        success: true,
        data: data,
        info: 'success'
    });
});

async function getN2NAsync(clientId) {
    let virtualIp = await getVirtualIpAsync(clientId);
    let community = await getFirstCommunityAsync();
    let result = {
        host: netbuildingHost,
        port: netbuildingPort,
        version: netbuildingVersion,
        community: community,
        communityKey: '',
        username: '',
        password: '',
        virtualIp: virtualIp,
        mode: 'M1'
    }
    return result;
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

async function getFirstCommunityAsync() {
    let content = await fs.readFile(communityListPath, 'utf-8');
    let result = content.split('\n')[0].trim();
    return AesUtil.encrypt(result);
}
module.exports = router