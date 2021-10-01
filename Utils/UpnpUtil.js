const SpawnUtil = require('./SpawnUtil');
const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const PlatfromUtil = require('./PlatfromUtil');
const path = require('path');
const basePath = getPluginPath('upnp', 'client');
let upnpcPath = path.join(basePath, `upnpc`);
const os = require('os')
if (os.platform() === 'win32') {
    upnpcPath += '.exe';
}
async function addMap(localPort, externalPort, protocol = 'udp', localIp = 'default', duration = -1) {
    if (localIp === 'default') {
        localIp = PlatfromUtil.getIPAdress();
    }
    console.log(localIp);
    let args = ['-r', localPort, externalPort, protocol];
    if (duration > 0) {
        args.push(duration);
    }
    let result = await SpawnUtil.execute(upnpcPath, args);
    console.log(result);
    return result;
}
async function removeMap(externalPort, protocol = 'udp') {
    let args = ['-d', externalPort, protocol];
    if (duration > 0) {
        args.push(duration);
    }
    let result = await SpawnUtil.execute(upnpcPath, args);
    console.log(result);
    return result;
}


module.exports = {
    addMap: addMap,
    removeMap: removeMap
}