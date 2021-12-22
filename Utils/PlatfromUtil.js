const os = require('os');
const logger = require('../Log/logger');

function processExit(code = 0) {
    console.log('app ready to exit');
    const N2NClient = require('../N2N/N2NClient');
    N2NClient.stopEdge();
    require('./FileBrowserUtil').stop();
    setTimeout(() => {
        console.log('app has exited');
        process.exit(code);
    }, 1700);
}

function cpus() {

}

function getIPAdress() {
    let interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        let iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

const openDefaultBrowser = function(url) {
    if (process.platform === 'linux') {
        console.log('请自己打开浏览器' + url);
        return;
    }
    let exec = require('child_process').exec;
    switch (process.platform) {
        case "darwin":
            exec('open ' + url);
            break;
        case "win32":
            exec('start ' + url);
            break;
        default:
            exec('xdg-open', [url]);
    }
}

module.exports = {
    processExit,
    getIPAdress,
    cpus,
    openDefaultBrowser
}