const { exec } = require('child_process');
const shell = require('shelljs');
const path = require('path');
const os = require('os');
const iconvLite = require('iconv-lite');
const rootPath = require('../Common/GlobalData').rootPath;

/**
 * 
 * @param {String}} cmd  必须把路径引起来
 * @param {String} cwd 
 * @returns 
 */
async function execute(cmd, cwd = null, timeout = 5000) {
    //let array = cmd.split(' ');
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject(`execute ${cmd} timeout:` + timeout);
        }, timeout);
        if (cwd == null) {
            cwd = rootPath;
        }
        exec(cmd, { cwd: cwd }, (error, stdout, stderr) => {
            clearTimeout(t);
            if (error) {
                reject(`exec error: ${getGoodString(error.message)}`);
                return;
            }
            resolve(getGoodString(stdout));
        });

    });
    return p;
}

function getGoodString(text) {
    if (os.platform() !== 'win32') {
        return text;
    }
    let data = Buffer.from(text, 'ascii');
    let result = iconvLite.decode(data, 'cp936');
    return result;
}
module.exports = {
    execute: execute
}