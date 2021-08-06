const TcpClient = require('../Tcp/TcpClient');
const RpCTcpClient = require('../Rpc/RpcTcpClient');
let client = new TcpClient({ host: '0.0.0.0', port: 3927 });
let rcpClient = new RpCTcpClient(client,11111);
async function test(params) {
    try {
        await rcpClient.start();
    } catch (error) {
        console.warn(error);
    }
  
    setInterval(async () => {
        let a=Math.ceil(Math.random()*100);   
        let b=Math.ceil(Math.random()*100);   
        let result = await rcpClient.invoke('add', [a, b]);
        console.log(`${a}+${b}=${result}`);
    }, 11);
   
}

test();

