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
const logger = require('../Log/logger');
let _edgePs = null;


function start(communityName, communityPassword, virtualIp, serverAddress) {
    if (_edgePs != null) {
        logger.warn('edge has already started,you can top it first');
        return;
    }
    let cmd = getPath();
    let args = [`-c${communityName}`, `-l${serverAddress}`];
    if (virtualIp) {
        args.push(`-a${virtualIp}`);
    }
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
        args.push('-f'); //目前2.9windows不支持
    }
    let env = {...process.env };
    if (communityPassword != null && communityPassword !== '') {
        env['N2N_KEY'] = communityPassword;
    }
    _edgePs = spawn(cmd, args, { windowsHide: true, env: env });
    _edgePs.stdout.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }

        logger.trace(result);
    });

    _edgePs.stderr.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }
        logger.error(result);
    });

    _edgePs.on('close', (code) => {
        if (code !== 0) {
            console.log(`edge quit as code: ${code}`);
        }
    });
}

function stop() {
    if (_edgePs) {
        _edgePs.kill();
        _edgePs = null;
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
        logger.trace('uninstall ok')
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