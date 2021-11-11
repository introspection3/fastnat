const RpCTcpClient = require('../Rpc/RpcTcpClient');

let rcpClient = new RpCTcpClient({ host: '0.0.0.0', port: 3927 });

async function test(params) {

    try {
        await rcpClient.start();
    } catch (error) {
        console.warn(error);
        return;

    }

    setInterval(async() => {
        let a = Math.ceil(Math.random() * 100);
        let b = Math.ceil(Math.random() * 100);
        let result = await rcpClient.invoke('test', 'add', [a, b]);
        console.log(`${a}+${b}=${result}`);
    }, 20000);

}

test();

process.on("uncaughtException", function(err) {
    console.warn('uncaughtException');
    console.error(err);
});