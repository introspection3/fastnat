
const path = require('path');
const parentDir = path.resolve(__dirname, '..');
const configDir = path.join(parentDir, "config");
const serverConfig = path.join(configDir, 'server.json');
let result = require(serverConfig);
module.exports = result;