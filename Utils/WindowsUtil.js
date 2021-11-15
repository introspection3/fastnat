const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');
const os = require('os');
const nodeNative = path.join(rootPath, 'config', 'native', os.platform(), os.arch(), 'node-hide-console-window', 'node-hide-console-window.node');
const ExecUtil = require('./ExecUtil');
const logger = require('../Log/logger');

function success() {
    console.log('');
    console.log('--------------------fastnat启动成功------------------');
    console.log('1.可在电脑右下角右键图标[系统管理]管理所有设备');
    console.log('2.可在电脑右下角图标右键退出系统');
    console.log('----------------------------------------------------');
    console.log('');
}
module.exports = {
    runCurrentAppAsAdmin: function(args) {
        if (os.platform() === "win32") {
            return require(nodeNative).runCurrentAppAsAdmin(args);
        }
    },
    isRunAsAdmin: function() {
        if (os.platform() === "win32") {
            return require(nodeNative).isRunAsAdmin();
        }
    },
    showConsole: function() {
        if (os.platform() === "win32") {
            require(nodeNative).showConsole();
        }
    },
    topMost: function() {
        if (os.platform() === "win32") {
            require(nodeNative).topMost();
        }
    },
    notTopMost: function() {
        if (os.platform() === "win32") {
            require(nodeNative).notTopMost();
        }
    },
    hideConsole: function() {
        if (os.platform() === "win32") {
            require(nodeNative).hideConsole();
        }
    },
    disableConsoleInsertEdit: function() {
        if (os.platform() === "win32") {
            require(nodeNative).disableConsoleInsertEdit();
        }
    },
    setCwdWithAppStartPath: function() {
        if (os.platform() === "win32") {
            require(nodeNative).setCwdWithAppStartPath();
        }
    },
    disableCloseButton: function() {
        if (os.platform() === "win32") {

            setTimeout(() => {
                success();
            }, 10000);

            require(nodeNative).disableCloseButton();
        }
    },
    openMstscAsync: async function() {
        if (os.platform() === "win32") {
            let reg1 = `reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 0 /f`;
            let reg2 = `reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fAllowToGetHelp /t REG_DWORD /d 1 /f`;
            try {
                await ExecUtil.execute(reg1);
                await ExecUtil.execute(reg2);
            } catch (error) {
                logger.error(error);
            }
        }
    },

    closeMstscAsync: async function() {
        if (os.platform() === "win32") {
            let reg1 = `reg add "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server" /v fDenyTSConnections /t REG_DWORD /d 1 /f`;
            try {
                return await ExecUtil.execute(reg1);
            } catch (error) {
                logger.error(error);
            }
        }
    },

    enableAutoStartAsync: async function(appName = null, appPath = null) {
        if (appPath == null) {
            appPath = process.argv0;
        }
        if (appName == null) {
            appName = path.basename(appPath);
        }
        if (os.platform() === "win32") {
            let reg1 = `reg add "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "${appPath}" /f`;
            try {
                return await ExecUtil.execute(reg1);
            } catch (error) {
                logger.error(error);
            }
        }
    },

    disableAutoStartAsync: async function(appName = null) {
        if (appName == null) {
            let appPath = process.argv0;
            appName = path.basename(appPath);
        }
        if (os.platform() === "win32") {
            let reg1 = `reg delete  "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}"`;
            try {
                return await ExecUtil.execute(reg1);
            } catch (error) {
                logger.error(error);
            }
        }
    }



}