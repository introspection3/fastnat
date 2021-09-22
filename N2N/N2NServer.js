const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('n2n', 'server');
const os = require('os');
const { spawn } = require('child_process');
const fs = require('fs');
const checkFileExists = require('../Utils/FsUtil').checkFileExists;
const iconvLite = require('iconv-lite');
let _supernodePs = null;
let _managementPort = 5645;
let _ManagementUdpSocket = null;
const logger = require('../Log/logger');
const dgram = require('dgram');

function start(communityListPath, port = 7654, managementPort = 5645) {

    if (_supernodePs) {
        logger.warn('supernode has already started,,you can top it first');
        return;
    }
    _managementPort = managementPort;
    let cmd = getPath();
    let args = [`-p${port}`, `-t${managementPort}`];

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
function createManagementUdpSocket(managementPort) {
    let prefix = 'supernode udp:';
    let udpClient = dgram.createSocket('udp4');
    udpClient.on('close', () => {
        logger.debug(prefix + 'close');
    });

    //错误处理
    udpClient.on('error', (err) => {
        logger.warn(prefix + error);
    })

    udpClient.connect('127.0.0.1', managementPort, () => {

    });
    return udpClient;
}

/**
 * 
 * @param {Number} managementPort 
 * @returns {dgram.Socket}
 */
function getManagementUdpSocket(managementPort) {
    if (_ManagementUdpSocket == null) {
        _ManagementUdpSocket = createManagementUdpSocket(managementPort);
    }
    return _ManagementUdpSocket;
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
    let p = new Promise((resolve, reject) => {
        udpClient.send(cmd);
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

module.exports = {
    startSuperNode: start,
    stopSuperNode: stop,
    executeManangementCommand: executeManangementCommand
}