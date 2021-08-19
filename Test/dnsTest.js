const dns = require('dns');
 

dns.resolve4('www.baidu.com',(err,addresses)=>{
    console.log(err);
    console.log(JSON.stringify(addresses))
});

