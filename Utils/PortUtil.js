const getPort = require('get-port');


/**is Tcp Port Available Aysnc
 * 
 * @param {Number} port 
 * @returns {Boolean} is port available
 */
async function isTcpPortAvailableAysnc(port) {
    let result = await isTcpPortAvailable({ port: port });
    return result === port;
}

/**is Tcp Port Available
 * 
 * @param {Number} testPort 
 * @returns 
 */
function isTcpPortAvailable(testPort) {
    return getPort({ port: testPort }).then((value) => {
        return Promise.resolve(testPort == value);
    }, (reaon) => {
        return Promise.resolve(false);
    });
}

module.exports.isTcpPortAvailable = isTcpPortAvailable;
module.exports.isTcpPortAvailableAysnc = isTcpPortAvailableAysnc;