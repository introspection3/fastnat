const path = require('path');
let rootPath = process.argv0;
if (rootPath.endsWith('node.exe') || rootPath.endsWith('node')) {
    rootPath = process.cwd();
} else {
    rootPath = path.dirname(rootPath);
}
module.exports = {
    rootPath: rootPath,
    configPath: path.join(rootPath, 'config'),
    version: '1.0.1'
};