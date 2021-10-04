const checkFileExistsAsync = require('./FsUtil').checkFileExistsAsync;
const path = require('path');
const rootPath = require('../Common/GlobalData.js').rootPath;

function checkConfigExistAsync(fileName) {
    let fullPath = path.join(rootPath, 'config', fileName);
    console.log(fullPath);
    return checkFileExistsAsync(fullPath);
}
module.exports.checkConfigExistAsync = checkConfigExistAsync;