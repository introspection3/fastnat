 
const path=require('path');
const parentDir=path.resolve(__dirname, '..');
const configDir=path.join(parentDir,"config");
const defaultConfig=path.join(configDir,'default.json');
// const serverConfig=path.join(configDir,'server.json');
// const clientConfig=path.join(configDir,'client.json');
let result=require(defaultConfig);
 
module.exports=result;