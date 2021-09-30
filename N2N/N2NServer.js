const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('n2n', 'server');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const checkFileExists = require('../Utils/FsUtil').checkFileExists;
const iconvLite = require('iconv-lite');
let _supernodePs = null;
let _managementPort = 5645;
let _ManagementUdpSocket = null;
const logger = require('../Log/logger');
const dgram = require('dgram');
const shell = require('shelljs');

function start(communityListPath, port = 7654, managementPort = 5645) {

    if (_supernodePs) {
        logger.warn('supernode has already started,you should top it first');
        return;
    }
    _managementPort = managementPort;
    let cmd = getPath();
    let args = [`-p${port}`, `-t${managementPort}`, ``];

    if (communityListPath) {
        args.push(`-c${communityListPath}`);
    }
    args.push(`-f`);
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
    }
    let env = {...process.env };
    _supernodePs = spawn(cmd, args, { windowsHide: true, env: env });
    _supernodePs.stdout.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }

        logger.trace(result);
    });

    _supernodePs.stderr.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }
        logger.error(result);
    });

    _supernodePs.on('close', (code) => {
        if (code !== 0) {
            console.log(`supernode quit as code: ${code}`);
        }
    });
}

/**
 * 
 * @param {Number} managementPort 
 * @returns {dgram.Socket}
 */
async function createManagementUdpSocket(managementPort) {
    let prefix = 'supernode udp:';
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
            resolve(udpClient);
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

async function reload_communities() {
    return executeManangementCommand('reload_communities');
}

/**
 * 
 * @param {String} communityName 
 * @param {String} username 
 * @param {String} password 
 */
async function createUser(communityListPath, username, password) {

    let exit = await existUserInCommmunityList(communityListPath, username, password);
    let result = false;
    if (exit == false) {
        appendUser2CommunityList(communityListPath, username, password);
        await reload_communities();
        result = true;
    }
    return result;
}

async function deleteUser(communityListPath, username, password) {
    let exit = await existUserInCommmunityList(communityListPath, username, password);
    let result = false;
    if (exit == false) {
        deleteUserInCommunityList(communityListPath, username, password);
        await reload_communities();
        result = true;
    }
    return result;
}
/**
 * 
 * @param {string} cmd 
 * @returns  {Promise<string>} 返回的内容
 */
async function executeManangementCommand(cmd) {
    if (_supernodePs == null) {
        return 'suppernode not started,you cant not execute command';
    }
    let command = cmd + '\n';
    let udpClient = getManagementUdpSocket(_managementPort);
    udpClient.send(command, _managementPort, '127.0.0.1');
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('executeManangementCommand timeout:');
        }, 3000);

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

function stop() {
    if (_supernodePs != null) {
        _supernodePs.kill();
        _supernodePs = null;
    }
    if (_ManagementUdpSocket) {
        _ManagementUdpSocket.close();
        _ManagementUdpSocket = null;
    }
}

function getPath() {
    let ext = os.platform() === 'win32' ? '.exe' : '';
    return path.join(basePath, 'supernode' + ext);
}

function getn2nKeygenPath() {
    let ext = os.platform() === 'win32' ? '.exe' : '';
    return path.join(basePath, 'n2n-keygen' + ext);
}

async function exeN2nKeygen(username, password) {
    let cmd = getn2nKeygenPath();
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
    }
    let args = [username, password];
    let p = new Promise((resolve, reject) => {
        let t = setTimeout(() => {
            reject('execute N2nKeygen  timeout:');
        }, 5000);

        let n2nKeygenProcess = spawn(cmd, args, { windowsHide: true, killSignal: 'SIGINT' });
        n2nKeygenProcess.stdout.on('data', (data) => {
            clearTimeout(t);
            let result = null;
            if (os.platform() !== 'win32') {
                result = data.toString('utf8');
            } else {
                result = iconvLite.decode(data, 'cp936');
            }
            resolve(result.trim());
        });

        n2nKeygenProcess.stderr.on('data', (data) => {
            clearTimeout(t);
            let result = '';
            if (os.platform() !== 'win32') {
                result = data.toString('utf8');
            } else {
                result = iconvLite.decode(data, 'cp936');
            }
            reject(result);
        });

        n2nKeygenProcess.on('close', (code, signal) => {
            console.log(`N2nKeygen quit as code: ${code},signal:${signal}`);
        });
    });
    return p;
}

async function existUserInCommmunityList(communityListPath, username, password) {
    let content = (await fs.readFile(communityListPath)).toString();
    let encryptStr = await exeN2nKeygen(username, password);
    return content.indexOf(encryptStr) > -1;
}

async function appendUser2CommunityList(communityListPath, username, password) {
    let encryptStr = await exeN2nKeygen(username, password);
    await fs.appendFile(communityListPath, encryptStr + '\n');
}

async function deleteUserInCommunityList(communityListPath, username, password) {
    let content = (await fs.readFile(communityListPath)).toString();
    let encryptStr = await exeN2nKeygen(username, password);
    let newContent = content.replace(encryptStr, '');
    await fs.writeFile(communityListPath, newContent);
}


module.exports = {
    startSuperNode: start,
    stopSuperNode: stop,
    executeManangementCommand: executeManangementCommand,
    reload_communities: reload_communities,
    createUser,
    deleteUser
}