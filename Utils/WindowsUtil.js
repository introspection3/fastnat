const rootPath = require('../Common/GlobalData').rootPath;
const path = require('path');
const os = require('os');
const nodeNative = path.join(rootPath, 'config', 'native', os.platform(), os.arch(), 'node-hide-console-window', 'node-hide-console-window.node');


module.exports = {
    showConsole: function() {
        if (os.platform() === "win32") {
            require(nodeNative).showConsole();
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
            console.log('disableCloseButton!')
        }
    }
}