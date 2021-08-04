
const config = require("config");
const path=require('path');
const parentDir=path.resolve(__dirname, '..');
const configDir=path.join(parentDir,"config");
console.log(configDir);
process.env["NODE_CONFIG_DIR"] =configDir;

module.exports=config;