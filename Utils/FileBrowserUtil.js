const SpawnUtil = require('./SpawnUtil');
const iconvLite = require('iconv-lite');
const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const logger = require('../Log/logger');
const path = require('path');
const basePath = getPluginPath('filebrowser', 'client');
let exePath = path.join(basePath, `filebrowser`);
const os = require('os');
const clientConfig = require('../Common/ClientConfig');
let _ps = null;
const shell = require('shelljs');
const FsUtil = require('./FsUtil');
const mkdir = require('fs').promises.mkdir;
const { spawn } = require('child_process');

if (os.platform() === 'win32') {
    exePath += '.exe';
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
    let result = await SpawnUtil.execute(exePath, ['users', 'add', `${adminName}`, `${password}`]);
    logger.trace(result);
    result = await SpawnUtil.execute(exePath, ['users', 'update', `${adminName}`, `--locale=zh-cn`]);
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

async function startAsync(dirPath = 'default') {

    if (dirPath == 'default')
        dirPath = path.join(basePath, './dir');

    let exsit = await FsUtil.checkFileExistsAsync(dirPath);
    if (exsit == false) {
        await mkdir(dirPath, { recursive: true });
    }

    let cmd = exePath;
    let args = [`-r${dirPath}`];
    if (os.platform() != 'win32') {
        shell.chmod('+x', cmd);
        args.push('-f'); //目前2.9windows不支持
    }

    _ps = spawn(cmd, args, { cwd: basePath, windowsHide: true, killSignal: 'SIGINT' });
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
        result.replaceAll('fastnat', '');
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