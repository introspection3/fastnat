const checkFileExistsAsync = require('./FsUtil').checkFileExistsAsync;
const path = require('path');

function checkConfigExistAsync(fileName) {
    let fullPath = path.join(process.cwd(), 'config', fileName);
    return checkFileExistsAsync(fullPath);
}
module.exports.checkConfigExistAsync = checkConfigExistAsync;