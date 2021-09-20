const path = require('path');
const parentDir = require('./GlobalData').rootPath;
const configDir = path.join(parentDir, "config");
const serverConfig = path.join(configDir, 'server.json');
// let result = require(serverConfig);
// module.exports = result;

const fs = require('fs');
module.exports = JSON.parse(fs.readFileSync(serverConfig));