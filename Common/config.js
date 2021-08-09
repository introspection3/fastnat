 
const config = require("config");
const path=require('path');
const parentDir=path.resolve(__dirname, '..');
console.log(parentDir);
const configDir=path.join(parentDir,"config");
process.env["NODE_CONFIG_DIR"] =configDir;
module.exports=config;