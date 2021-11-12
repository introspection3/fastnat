const serverConfig = require('../Common/ServerConfig');
const logger = require('../Log/logger');
const redisConfig = serverConfig.redis;
console.log(JSON.stringify(redisConfig))
const redisHost = redisConfig.host;
const redisPort = redisConfig.port;
const redisPassword = redisConfig.password;
const redisUserName = redisConfig.username || '';
const Redis = require("ioredis");
const Redlock = require('redlock');

const redisClient = new Redis({
    port: redisPort, // Redis port
    host: redisHost, // Redis host
    family: 4, // 4 (IPv4) or 6 (IPv6)
    password: redisPassword,
    db: 0,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 40
});


const redisClient2 = new Redis({
    port: redisPort, // Redis port
    host: redisHost, // Redis host
    family: 4, // 4 (IPv4) or 6 (IPv6)
    password: redisPassword,
    db: 0,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 40
});

let redlock = new Redlock(
    // you should have one client for each independent redis node
    // or cluster
    [redisClient2], {
        // the expected clock drift; for more details
        // see http://redis.io/topics/distlock
        driftFactor: 0.01, // multiplied by lock ttl to determine drift time

        // the max number of times Redlock will attempt
        // to lock a resource before erroring
        retryCount: 10,

        // the time in ms between attempts
        retryDelay: 200, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        // see https://www.awsarchitectureblog.com/2015/03/backoff.html
        retryJitter: 200 // time in ms
    }
);
let _isConnected = false;

// init();
module.exports = {
    redisClient,
    redisClient2,
    redlock,
    connectAsync: async() => {
        if (_isConnected === false) {
            await redisClient.connect();
        }
    }
}