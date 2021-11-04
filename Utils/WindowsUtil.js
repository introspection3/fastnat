const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');
const os = require('os');
const nodeNative = path.join(rootPath, 'config', 'native', os.platform(), os.arch(), 'node-hide-console-window', 'node-hide-console-window.node');


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
    disableCloseButton: function() {
        if (os.platform() === "win32") {
            require(nodeNative).disableCloseButton();
            setTimeout(() => {
                console.log('--------------------------------------');
                console.log('1.使用ctrl+c退出,或者右下角图标右键退出');
                console.log('2.可通过右下角右键图标[管理]管理你的设备');
                console.log();
            }, 10000);

        }
    }
}