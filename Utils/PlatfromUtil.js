function processExit(code = 0) {
    const N2NClient = require('../N2N/N2NClient');
    N2NClient.stopEdge();
    setTimeout(() => {
        process.exit(code);
    }, 2000);
}

function cpus() {

}

module.exports.processExit = processExit;