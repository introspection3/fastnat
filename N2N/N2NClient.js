const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('n2n', 'client');
const os = require('os');
const { spawn } = require('child_process');
const shell = require('shelljs');
const tapName = 'tap0901'
const fs = require('fs');
const checkFileExists = require('../Utils/FsUtil').checkFileExists;
const iconvLite = require('iconv-lite');

let edgePs = null;


function start(communityName, communityPassword, virtualIp, serverAddress) {
    let cmd = getPath();
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
    }
    let args = [`-c${communityName}`, `-k${communityPassword}`, `-a${virtualIp}`, `-l${serverAddress}`];
    if (communityPassword == null || communityPassword === '') {
        args = [`-c${communityName}`, `-a${virtualIp}`, `-l${serverAddress}`];
    }
    edgePs = spawn(cmd, args, { windowsHide: true });
    edgePs.stdout.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }

        console.log(result);
    });

    edgePs.stderr.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }
        console.error(result);
    });

    edgePs.on('close', (code) => {
        if (code !== 0) {
            console.log(`edge quit as code: ${code}`);
        }
    });
}

function stop() {
    if (edgePs) {
        edgePs.kill();
    }
}

function prepareAndCheck(params) {
    if (os.platform() === 'win32') {
        //是否安装wintap,若没有直接走安装程序,安装了就检测必要的程序是否存在
    }
}

function getPath() {
    let ext = os.platform() === 'win32' ? '.exe' : '';
    return path.join(basePath, 'edge' + ext);
}

/**仅在windows下使用 */
function getWinTapPath() {
    return path.join(basePath, 'tapinstall.exe');
}

/**安装wintap,仅在windows下使用 */
function installWinTap() {
    const elevate = require('node-windows').elevate;
    let wintap = getWinTapPath();
    let cmd = wintap + ` install OemVista.inf  ${tapName}`;
    elevate(cmd, { cwd: basePath }, () => {
        console.log('install ok');

    });
}

/**卸载wintap,仅在windows下使用 */
function unInstallWinTap() {
    const elevate = require('node-windows').elevate;
    let wintap = getWinTapPath();
    let cmd = wintap + ` remove   ${tapName}`;
    elevate(cmd, { cwd: basePath }, () => {
        console.log('uninstall ok')
    });
}

async function checkFileExist(name) {
    let fullPath = path.join(basePath, name);
    return await checkFileExists(fullPath);
}


module.exports = {
    startEdge: start,
    stopEdge: stop
}