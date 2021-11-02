const os = require('os');


function addProgramException(ruleName, processPath) {
    const elevate = require('node-windows').elevate;
    let cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=in action=allow program="${processPath}" enable=yes`;
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            resolve(false);
        }, 10000);
        elevate(cmd, { cwd: process.cwd() }, () => {
            clearTimeout(t);
            resolve(true);
        });
    });
    return p;
}

function addCurrentProgramException(ruleName) {
    let processPath = process.argv0;
    console.log(processPath);
    addProgramException(ruleName, processPath);
}

module.exports = {
    addProgramException,
    addCurrentProgramException
}