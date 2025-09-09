/**  including .env file */
var mongoUrl = process.env.MONGO_URL;
var MongoClient = require('mongodb').MongoClient;
var _db;
var dbName = process.env.DATABASE;
module.exports = {
	connectToServer: function (callback) {
		MongoClient.connect(mongoUrl, { useNewUrlParser: true }, function (err, client) {
			const db = client.db(dbName);
			_db = db;
			return callback(err);
		});
	},
	getDb: function () {
		return _db;
	}
};
