var redis = require("redis");
const redisClient = redis.createClient(
	{
		socket: {
			host: process.env.REDIS_HOST || '127.0.0.1',
			port: process.env.REDIS_PORT || 6379
		},
		password: process.env.REDIS_PASS
	}
)
redisClient.on("error", (error) => console.error(`Error : ${error}`));
// redisClient.on("connect", ()=>console.log("Redis connection established"));
redisClient.connect();
module.exports = redisClient;