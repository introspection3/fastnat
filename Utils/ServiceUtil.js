const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('nssm', 'client');
const nssmPath = path.join(basePath, `nssm.exe`);
const SpawnUtil = require('./SpawnUtil');
const os = require('os');
const logger = require('../Log/logger');

async function installService(servicename, applicationPath) {
    await removeService(servicename);
    let dirPath = process.cwd();
    let newArr = JSON.parse(JSON.stringify(process.argv));
    if (os.platform() === 'win32') {
        applicationPath = newArr.shift();
        await SpawnUtil.execute(nssmPath, [`install`, `${servicename}`, `${applicationPath}`, `${newArr.join(' ')}`], true);
        await SpawnUtil.execute(nssmPath, ['set', `${servicename}`, `AppDirectory`, `${dirPath }`], true);
        try {
            await SpawnUtil.execute(nssmPath, ['start', `${servicename}`], true);
        } catch (error) {
            logger.warn(error);
        }
    }
}
async function existService(servicename) {
    let result = {
        exist: false,
        status: 'STOPPED'
    }
    if (os.platform() === 'win32') {
        let content = await SpawnUtil.execute('sc', ['queryex', `${servicename}`]);
        console.log(content);

        if (content.indexOf('1060') > -1) {
            result.exist = false;
        } else {
            result.exist = true;
        }
        if (content.indexOf('RUNNING') > -1) {
            result.status = 'RUNNING';
        }
    }
    return result;
}

async function removeService(servicename) {
    if (os.platform() === 'win32') {
        let result = await existService(servicename);
        if (result.exist && result.status === 'RUNNING') {
            await SpawnUtil.execute(nssmPath, ['stop', `${servicename}`, `confirm`]);
        }
        if (result.exist) {
            await SpawnUtil.execute(nssmPath, ['remove', `${servicename}`, `confirm`])
        }
    }
}


module.exports = {
    installService,
    removeService
}