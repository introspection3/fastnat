const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('nssm', 'client');
const nssmPath = path.join(basePath, `nssm.exe`);
const SpawnUtil = require('./SpawnUtil');
const os = require('os');
const logger = require('../Log/logger')
async function installService(servicename, applicationPath) {
    let dirPath = path.dirname(applicationPath);
    let newArr = JSON.parse(JSON.stringify(process.argv));
    if (os.platform() === 'win32') {
        newArr.shift();
        await SpawnUtil.execute(nssmPath, ['set', `${servicename}`, `Application`, `${applicationPath }`], true);
        await SpawnUtil.execute(nssmPath, ['set', `${servicename}`, `AppDirectory `, `${dirPath }`], true);
        if (newArr && newArr.length > 0) {
            await SpawnUtil.execute(nssmPath, ['set', `${servicename}`, `AppParameters `, `${newArr.join(' ')}`], true);
        }
    }
}

async function removeService(servicename, applicationPath) {
    if (os.platform() === 'win32') {
        await SpawnUtil.execute(nssmPath, ['remove', `${servicename}`, `confirm`])
    }
}


module.exports = {
    installService,
    removeService
}