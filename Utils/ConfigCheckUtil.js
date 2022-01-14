const checkFileExistsAsync = require('./FsUtil').checkFileExistsAsync;
const path = require('path');
const rootPath = require('../Common/GlobalData').rootPath;

function checkConfigExistAsync(fileName) {
    let fullPath = path.join(rootPath, 'config', fileName);
    return checkFileExistsAsync(fullPath);
}

function checkConfigExist(fileName) {
    return require('fs').existsSync(fileName);

}
module.exports = {
    checkConfigExistAsync,
    checkConfigExist
}