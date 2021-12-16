const SpawnUtil = require('./SpawnUtil');
const iconvLite = require('iconv-lite');
const getPluginPath = require('./PluginUtil').getPluginPath;
const logger = require('../Log/logger');
const path = require('path');
const basePath = getPluginPath('filebrowser', 'client');
logger.trace('basePath:' + basePath);
let exePath = path.join(basePath, `filebrowser`);
const os = require('os');
let _ps = null;
const shell = require('shelljs');
const FsUtil = require('./FsUtil');
const mkdir = require('fs').promises.mkdir;
const { spawn } = require('child_process');

function getExePath() {
    let exePath = path.join(basePath, `filebrowser`);
    if (os.platform() === 'win32') {
        exePath += '.exe';
        logger.trace('exepath:', exePath);
    }
    return exePath;
}

async function setListenAsync(address = '0.0.0.0', port = 7777) {
    if (os.platform() != 'win32') {
        shell.chmod('+x', exePath);
    }
    let result = await SpawnUtil.execute(exePath, ['config', 'set', `-a${address}`]);
    logger.trace(result);
    if (port != 8080) {
        result = await SpawnUtil.execute(exePath, ['config', 'set', `-p${port}`]);
        logger.trace(result);
    }
}

async function setAdminPasswordAsync(password, adminName = 'admin') {
    if (os.platform() != 'win32') {
        shell.chmod('+x', exePath);
    }
    try {
        let result = await SpawnUtil.execute(exePath, ['users', 'add', `${adminName}`, `${password}`]);
        logger.trace(result);
    } catch (error) {
        logger.warn(error);
    }
    let result = await SpawnUtil.execute(exePath, ['users', 'update', `${adminName}`, `--locale=zh-cn`]);
    logger.trace(result);
}

async function initAsync(password, port = 7777) {
    let exist = await FsUtil.checkFileExistsAsync(path.join(basePath, 'filebrowser.db'));
    if (exist == false) {
        if (os.platform() != 'win32') {
            shell.chmod('+x', exePath);
        }
        let result = await SpawnUtil.execute(exePath, ['config', 'init']);
        logger.trace(result);
    }
    await setListenAsync('0.0.0.0', port);
    await setAdminPasswordAsync(password);

}

async function startAsync(authenKey, dirPath = 'default') {
    if (dirPath == 'default') {
        dirPath = path.join(basePath, './dir');
    }
    let exsit = await FsUtil.checkFileExistsAsync(dirPath);
    if (exsit == false) {
        await mkdir(dirPath, { recursive: true });
    }

    let args = [`-r${dirPath}`];
    if (os.platform() != 'win32') {
        shell.chmod('+x', exePath);
    }
    logger.trace('exepath:', exePath);
    await initAsync(authenKey);
    _ps = spawn(exePath, args, { cwd: basePath, windowsHide: true, killSignal: 'SIGINT' });
    _ps.stdout.on('data', (data) => {
        let result = null;
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }
        logger.trace('\n' + result);
    });

    _ps.stderr.on('data', (data) => {
        let result = '';
        if (os.platform() !== 'win32') {
            result = data.toString('utf8');
        } else {
            result = iconvLite.decode(data, 'cp936');
        }

        logger.error(result);
    });

    _ps.on('close', (code, signal) => {
        console.log(`edge quit as code: ${code},signal:${signal}`);
    });

}

function stop() {
    if (_ps) {
        _ps.kill('SIGINT');
        _ps = null;
    }
}

module.exports = {
    initAsync: initAsync,
    startAsync: startAsync,
    stop: stop
}