var mongoUrl = process.env.MONGO_URL;
var MongoClient = require('mongodb').MongoClient;
var _db;
var dbName = process.env.DATABASE;
const client = new MongoClient(mongoUrl);
module.exports = {
	connectToServer: async function (callback) {
		try {
			await client.connect();
			const db = client.db(dbName);
			/**Validate if the database exists*/
			const adminDb = client.db().admin();
			const databases = await adminDb.listDatabases();

			const dbExists = databases.databases.some(dbInfo => dbInfo.name === dbName);
			if (!dbExists) {
				return callback(new Error(`Database "${dbName}" does not exist.`));
			}
			_db = db;
			return callback(null);
		} catch (error) {
			return callback(error);
		}
	},
	getDb: function () {
		return _db;
	}
}
