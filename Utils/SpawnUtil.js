const { spawn } = require('child_process');
const shell = require('shelljs');
const path = require('path');
const os = require('os');
const iconvLite = require('iconv-lite');

async function execute(cmd, args = [], noResult = false, newEnv = {}, timeout = 5000) {
    let exeName = path.basename(cmd);
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
    }
    let env = {...process.env };
    Object.assign(env, newEnv);
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('execute N2nKeygen  timeout:' + timeout);
        }, timeout);

        let targetProcess = spawn(cmd, args, { windowsHide: true, env: env, killSignal: 'SIGINT', detached: true });
        targetProcess.stdout.on('data', (data) => {
            clearTimeout(t);
            let result = null;
            if (os.platform() !== 'win32') {
                result = data.toString('utf8');
            } else {
                result = iconvLite.decode(data, 'cp936');
            }
            resolve(result.trim());
        });

        targetProcess.stderr.on('data', (data) => {
            clearTimeout(t);
            let result = '';
            if (os.platform() !== 'win32') {
                result = data.toString('utf8');
            } else {
                result = iconvLite.decode(data, 'cp936');
            }
            reject(result);
        });

        targetProcess.on('close', (code, signal) => {
            console.log(`${exeName} quit as code: ${code},signal:${signal}`);
            if (noResult) {
                clearTimeout(t);
                resolve(code);
            }
        });
    });
    return p;
}

module.exports = {
    execute: execute
}