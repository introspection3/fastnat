const ClusterData = require('../Common/ClusterData');
const cluster = require('cluster');
const http = require('http');
const os = require('os');


const numCPUs = os.cpus().length;

if (cluster.isPrimary) {

    console.log(`Primary ${process.pid} is running`);

    // 衍生工作进程。
    for (let i = 0; i < 2; i++) {
        cluster.fork();
    }

    cluster.on('fork', (worker) => {
        console.log('worker is dead:', worker.isDead());
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log('worker is dead:', worker.isDead());
    });
    ClusterData.setAsync('abc', 1);
    ClusterData.register2Cluster();
}
else {
    ClusterData.register2Worker();
    ClusterData.setAsync('abc',11);
    // 工作进程可以共享任何 TCP 连接。在此示例中，它是 HTTP 服务器。
    http.createServer((req, res) => {
        res.writeHead(200);
        res.end(`Current process\n ${process.pid}`);

        process.kill(process.pid);
    }).listen(8000);
}