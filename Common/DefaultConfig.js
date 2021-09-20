 const path = require('path');
 const parentDir = require('./GlobalData').rootPath;
 const configDir = path.join(parentDir, "config");
 const defaultConfig = path.join(configDir, 'default.json');
 //  const result = require(defaultConfig);
 //  module.exports = result;

 const fs = require('fs');
 module.exports = JSON.parse(fs.readFileSync(defaultConfig));