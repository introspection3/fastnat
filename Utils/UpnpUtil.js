const SpawnUtil = require('./SpawnUtil');
const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const logger = require('../Log/logger');
const path = require('path');
const basePath = getPluginPath('upnp', 'client');
let upnpcPath = path.join(basePath, `upnpc`);
const os = require('os');
const clientConfig = require('../Common/ClientConfig');
const upnpEnabled = clientConfig.upnpEnabled;
if (os.platform() === 'win32') {
    upnpcPath += '.exe';
}

async function addMap(localPort, externalPort, protocol = 'udp') {
    if (upnpEnabled === false) {
        return 'clientConfig.upnpEnabled === false';
    }
    if (os.platform() === 'darwin') {
        return 'not support darwin';
    }
    let args = ['-r', localPort, externalPort, protocol];
    try {
        let result = await SpawnUtil.execute(upnpcPath, args, false, {}, 2000);
        return result;
    } catch (error) {
        logger.error(error);
        return 'error';
    }
}

async function removeMap(externalPort, protocol = 'udp') {
    if (upnpEnabled === false) {
        return 'clientConfig.upnpEnabled === false';
    }
    if (os.platform() === 'darwin') {
        return 'not support darwin';
    }
    let args = ['-d', externalPort, protocol];
    try {
        let result = await SpawnUtil.execute(upnpcPath, args, false, {}, 2000);
        return result;
    } catch (error) {
        logger.error(error);
        return 'error';
    }
}


module.exports = {
    addMap: addMap,
    removeMap: removeMap
}