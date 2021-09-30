const path = require('path');
const os = require('os');

function getPluginPath(name, type = 'server') {
    // let usePkg = false;
    // if (os.platform() === 'win32') {
    //     if (__dirname.startsWith('C:\\snapshot\\')) {
    //         usePkg = true;
    //     }
    // } else {
    //     if (__dirname.startsWith('/snapshot/')) {
    //         usePkg = true;
    //     }
    // }
    // let rootPath = '';
    // if (usePkg === false) {
    //     rootPath = require('../Common/GlobalData').rootPath;
    // } else {
    //     rootPath = path.dirname(__dirname);
    // }
    let rootPath = require('../Common/GlobalData').rootPath;

    let result = path.join(rootPath, 'config', 'plugins', type + '-plugins', os.platform(), os.arch(), name);
    return result;
}

module.exports.getPluginPath = getPluginPath;