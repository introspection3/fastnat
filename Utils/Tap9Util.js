const PluginUtil = require('./PluginUtil');
const SpawnUtil = require('./SpawnUtil');
const ExecUtil = require('./ExecUtil');
const basePath = PluginUtil.getPluginPath('adapter', 'client');
const path = require('path');
const os = require('os');
const logger = require('../Log/logger');

/**
 * 获取所有的网卡
 * @returns {Array}
 */
async function getAllAdaptersAsync() {
    if (os.platform() === "win32") {
        const exePath = path.join(basePath, 'adapter.exe');
        let result = await SpawnUtil.execute(exePath);
        let all = JSON.parse(result);
        let newArr = all.filter(function(value, index, array) {
            return value.FriendlyName.startsWith('qvq') === false;
        });
        return newArr;


    } else {
        return [];
    }
}

async function getAllTap9AdaptersAsync() {
    if (os.platform() === "win32") {
        let all = await getAllAdaptersAsync();
        let newArr = all.filter(function(value, index, array) {
            return value.Description.startsWith('TAP-W');
        });
        return newArr;
    } else {
        return [];
    }
}


async function renameAdapterAsync(oldName, newName) {
    let renameCmd = `netsh interface set interface name="${oldName}" newname="${newName}"`;
    try {
        return await ExecUtil.execute(renameCmd);
    } catch (error) {
        logger.error(error);
    }

}

module.exports = {
    renameAdapterAsync,
    getAllAdaptersAsync,
    getAllTap9AdaptersAsync
}