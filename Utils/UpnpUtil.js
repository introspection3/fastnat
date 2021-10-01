const SpawnUtil = require('./SpawnUtil');
const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const logger = require('../Log/logger');
const path = require('path');
const basePath = getPluginPath('upnp', 'client');
let upnpcPath = path.join(basePath, `upnpc`);
const os = require('os')
if (os.platform() === 'win32') {
    upnpcPath += '.exe';
}
async function addMap(localPort, externalPort, protocol = 'udp') {
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