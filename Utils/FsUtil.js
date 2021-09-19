const fs = require('fs');

function checkFileExists(file) {
    return fs.promises.access(file, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false);
}
module.exports.checkFileExists = checkFileExists;