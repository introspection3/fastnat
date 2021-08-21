
const path = require('path');
const parentDir = path.resolve(__dirname, '..');
const configDir = path.join(parentDir, "config");
const clientConfig = path.join(configDir, 'client.json');
let result = require(clientConfig);
module.exports = result;