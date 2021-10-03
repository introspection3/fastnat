const os = require('os');

function processExit(code = 0) {
    const N2NClient = require('../N2N/N2NClient');
    N2NClient.stopEdge();
    setTimeout(() => {
        process.exit(code);
    }, 1000);
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
getIPAdress();
module.exports.processExit = processExit;
module.exports.getIPAdress = getIPAdress;
module.exports.cpus = cpus;