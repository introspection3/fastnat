const getPluginPath = require('../Utils/PluginUtil').getPluginPath;
const path = require('path');
const basePath = getPluginPath('n2n', 'server');
const os = require('os');
const { spawn } = require('child_process');
const elevate = require('node-windows').elevate;
const tapName = 'tap0901'
const fs = require('fs');
const checkFileExists = require('../Utils/FsUtil').checkFileExists;
const iconvLite = require('iconv-lite');
const wincmd = require('node-windows');
let supernodePs = null;

function start(port, config) {
    let cmd = getPath();
    let args = [`-c${communityName}`, `-k${communityPassword}`, `-a${virtualIp}`, `-l${serverAddress}`];
    if (communityPassword == null || communityPassword === '') {
        args = [`-c${communityName}`, `-a${virtualIp}`, `-l${serverAddress}`];
    }
}

function stop() {

}

function getPath() {
    let ext = os.platform() === 'win32' ? '.exe' : '';
    return path.join(basePath, 'supernode' + ext);
}