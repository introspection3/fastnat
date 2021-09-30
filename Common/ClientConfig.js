const path = require('path');
const parentDir = require('./GlobalData').rootPath;
const configDir = path.join(parentDir, "config");
const clientConfig = path.join(configDir, 'client.json');

// let result = require(clientConfig);
// module.exports = result;

const fs = require('fs');

module.exports = JSON.parse(fs.readFileSync(clientConfig));