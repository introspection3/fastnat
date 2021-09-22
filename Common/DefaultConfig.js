 const path = require('path');
 const parentDir = require('./GlobalData').rootPath;
 const configDir = path.join(parentDir, "config");
 const defaultConfig = path.join(configDir, 'default.json');
 //  const result = require(defaultConfig);
 //  module.exports = result;
 console.warn('locad default config');
 const fs = require('fs');
 module.exports = JSON.parse(fs.readFileSync(defaultConfig));