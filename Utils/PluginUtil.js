const path = require('path');
const os = require('os');

function getPluginPath(name, type = 'server') {
    let rootPath = require('../Common/GlobalData').rootPath;
    let result = path.join(rootPath, 'config', 'plugins', type + '-plugins', os.platform(), os.arch(), name);
    return result;
}

module.exports.getPluginPath = getPluginPath;