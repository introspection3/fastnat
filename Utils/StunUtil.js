const stun = require('vs-stun');
const defaultConfig = require('../Common/DefaultConfig');
const p2pHost = defaultConfig.p2p.host;
const p2pPort = defaultConfig.p2p.port;

function requestNatInfo() {
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('requestNatInfo timeout:');
        }, 2000);
        stun.connect({ host: p2pHost, port: p2pPort }, (error, socket) => {
            clearTimeout(t);
            if (!error) {
                socket.close();
                console.log(socket.stun);
                resolve(socket.stun);
            }
            reject(error);
        });

    });
    return p;
}

async function getNatType() {
    let info = await requestNatInfo();
    return info.type;
}

module.exports.requestNatInfo = requestNatInfo;
module.exports.getNatType = getNatType;