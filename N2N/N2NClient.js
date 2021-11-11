const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('p2p', 'client');
const os = require('os');
const { spawn, exec } = require('child_process');
const shell = require('shelljs');
const tapName = 'tap0901'
const fs = require('fs');
const checkFileExists = require('../Utils/FsUtil').checkFileExists;
const iconvLite = require('iconv-lite');
const logger = require('../Log/logger');
let _edgePs = null;
let _managementPort = 5644;
let _ManagementUdpSocket = null;
const dgram = require('dgram');
const util = require('util');
const ExecUtil = require('../Utils/ExecUtil');

function start(clientId, communityName, communityPassword, virtualIp = '', serverAddress, username = '', password = '') {
    if (_edgePs != null) {
        logger.warn('edge has already started,you can top it at first');
        return;
    }

    let cmd = getPath();
    let args = [`-l${serverAddress}`];
    if (virtualIp != '') {
        args.push(`-a${virtualIp}`);
    }
    if (username && username !== '') {
        args.push(`-I${username}`);
        args.push(`-A4`);

    }
    if (password && password !== '') {
        args.push(`-J${password}`);
    }

    args.push(`-c${communityName}`);
    let tapName = 'tap-' + clientId;
    args.push(`-d${tapName}`);
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
        args.push('-f'); //目前2.9windows不支持
    }
    let env = Object.create(process.env);
    env['N2N_COMMUNITY'] = communityName;
    env['N2N_CMTY'] = communityName;
    if (communityPassword && communityPassword !== '') {
        args.push(`-k${communityPassword}`);
        env['N2N_KEY'] = communityPassword;
    }
    _edgePs = spawn(cmd, args, { windowsHide: true, env: env, killSignal: 'SIGINT' });
    _edgePs.stdout.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }
        logger.trace('\n' + result);
    });

    _edgePs.stderr.on('data', (data) => {
        let result = '';
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }
        result.replaceAll('fastnat', '');
        logger.error(result);
    });

    _edgePs.on('close', (code, signal) => {
        console.log(`edge quit as code: ${code},signal:${signal}`);
    });

}

async function stop() {
    if (_edgePs) {
        if (os.platform() === 'win32') {
            let baseLocation = getPluginPath('windows-kill', 'client');
            let cmd = path.join(baseLocation, `windows-kill.exe`);
            let kill = spawn(cmd, ['-SIGINT', _edgePs.pid], { windowsHide: true });
            //    let kill2 = spawn(cmd, ['-SIGINT', _edgePs.pid], { windowsHide: true });
            kill.stdout.on('data', (data) => {
                let result = null;
                result = iconvLite.decode(data, 'cp936');
                logger.trace(result);
            });

            return;
        } else {
            _edgePs.kill('SIGINT');
        }

        _edgePs = null;
    }
}

/**
 * 
 * @param {string} cmd 
 * @returns  {Promise<string>} 返回的内容
 */
async function executeManangementCommand(cmd) {
    if (_edgePs == null) {
        return 'edgePs not started,you cant not execute command';
    }
    let command = cmd + '\n';

    let udpClient = await getManagementUdpSocket(_managementPort);
    udpClient.send(command, _managementPort, '127.0.0.1');
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('execute edge Manangement Command timeout:' + command);
        }, 5000);

        udpClient.once('message', (message, rInfo) => {
            clearTimeout(t);
            let result = null;
            if (os.platform() !== 'win32') {
                result = message.toString('utf8');
            } else {
                result = iconvLite.decode(message, 'cp936');
            }
            resolve(result);
        });
    });
    return p;
}

/**
 * 
 * @param {Number} managementPort 
 * @returns {dgram.Socket}
 */
async function getManagementUdpSocket(managementPort) {
    if (_ManagementUdpSocket == null) {
        _ManagementUdpSocket = await createManagementUdpSocket(managementPort);
    }
    return _ManagementUdpSocket;
}

/**
 * 
 * @param {Number} managementPort 
 * @returns {dgram.Socket}
 */
async function createManagementUdpSocket(managementPort) {
    let prefix = 'edge udp:';
    let udpClient = dgram.createSocket('udp4');
    udpClient.on('close', () => {
        logger.debug(prefix + 'close');
    });

    //错误处理
    udpClient.on('error', (err) => {
        logger.warn(prefix + error);
    })

    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('create edge upd client timeout');
        }, 1000);

        udpClient.connect(managementPort, '127.0.0.1', () => {
            clearTimeout(t);
            resolve(udpClient);
        });
    });
    return p;
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
async function installWinTapAsync() {
    // const elevate = require('node-windows').elevate;
    // let wintap = getWinTapPath();
    // let cmd = wintap + ` install OemVista.inf  ${tapName}`;
    // let p = new Promise((resolve, reject) => {
    //     let t = setTimeout(() => {
    //         resolve(false);
    //     }, 10000);
    //     elevate(cmd, { cwd: basePath }, () => {
    //         clearTimeout(t);
    //         resolve(true);
    //     });
    // });
    // return p;


    let wintap = getWinTapPath();
    const cwd = basePath;
    let cmd = `"${wintap}" install OemVista.inf  ${tapName}`;

    return await ExecUtil.execute(cmd, cwd, -1);

}

/**卸载wintap,仅在windows下使用 */
async function unInstallWinTapAsync() {
    // const elevate = require('node-windows').elevate;
    let wintap = getWinTapPath();
    let cmd = `"${wintap}" remove   ${tapName}`;

    return await ExecUtil.execute(cmd);
    // let p = new Promise((resolve, reject) => {
    //     let t = setTimeout(() => {
    //         resolve(false);
    //     }, 10000);
    //     elevate(cmd, { cwd: basePath }, () => {
    //         clearTimeout(t);
    //         resolve(true);
    //     });
    // });
    // return p;
}

async function checkFileExist(name) {
    let fullPath = path.join(basePath, name);
    return await checkFileExists(fullPath);
}


module.exports = {
    getPath,
    startEdge: start,
    stopEdge: stop,
    installWinTapAsync: installWinTapAsync,
    unInstallWinTapAsync: unInstallWinTapAsync,
    executeManangementCommand: executeManangementCommand
}