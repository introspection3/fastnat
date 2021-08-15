 
const path=require('path');
const parentDir=path.resolve(__dirname, '..');
const configDir=path.join(parentDir,"config");
const defaultConfig=path.join(configDir,'default.json');
const result=require(defaultConfig);
 
module.exports=result;