const serverConfig = require('../Common/ServerConfig');
const logger = require('../Log/logger');
const redisConfig = serverConfig.redis;
console.log(JSON.stringify(redisConfig))
const redisHost = redisConfig.host;
const redisPort = redisConfig.port;
const redisPassword = redisConfig.password;
const redisUserName = redisConfig.username || '';
const Redis = require("ioredis");
const redisClient = new Redis({
    port: redisPort, // Redis port
    host: redisHost, // Redis host
    family: 4, // 4 (IPv4) or 6 (IPv6)
    password: redisPassword,
    db: 0,
});

let _isConnected = false;

// init();
module.exports = {
    redisClient,
    connectAsync: async() => {
        if (_isConnected === false) {
            await redisClient.connect();
        }
    }
}