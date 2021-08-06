const { error } = require('../Log/logger');
const RpcProtocal = require('../Rpc/RpcProtocal');
let rpc=new RpcProtocal({});
rpc.args=[1,2,34,{data:"test"}];
rpc.method='add';
rpc.callback=(result)=>{
    console.log(result);
}
var str=JSON.stringify(rpc);
console.log(str);
