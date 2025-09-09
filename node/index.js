/** Node express */
var express = require('express');
var app = express();

/** Required for session */
var cookieSession = require('cookie-session');
app.use(cookieSession({
	name: 'session',
	keys: ['NodeJs9799530SecretKey515'],
	maxAge: 365 * 24 * 60 * 60 * 1000 // 1 Year
}));

/**Set for middleware for webhook */
app.use('/api/stripe_payment_webhook', express.raw({ type: 'application/json' }));

/** Configure i18n options, this module is used for multi language site */
var i18n = require("i18n");
i18n.configure({
	locales: ['en'],
	defaultLocale: 'en',
	directory: __dirname + '/locales',
	directoryPermissions: '755',
	autoReload: true,
	updateFiles: false
});
app.use(i18n.init);

/** Set Breadcrumbs home information */
var breadcrumbs = require('express-breadcrumbs');
app.use(breadcrumbs.init());
app.use(breadcrumbs.setHome());

/** Mount the breadcrumbs at `/admin` */
app.use('/admin', breadcrumbs.setHome({
	name: 'Home',
	url: '/admin'
}));

// Increase limit for JSON data
app.use(express.json({ limit: '5mb' })); // Set the limit as per your needs

/** bodyParser for node js */
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
	extended: true,
	limit: '50mb',
	parameterLimit: 1000000
}));
app.use(bodyParser.json());
 
/** read cookies (needed for auth) */
var cookieParser = require('cookie-parser');
app.use(cookieParser());

/** Initialize Ejs Layout  */
var ejsLayouts = require("express-ejs-layouts");
app.use(ejsLayouts);
app.set('view engine', 'html');
app.engine('html', require('ejs').renderFile);

/** Used for create thumbs of images */
var qt = require('quickthumb');
app.use('/public/', qt.static(__dirname + '/public', { type: 'resize' }));

/** Set publically accessable folder */
app.use(express.static(__dirname + '/public'));

/** Use to upload files */
var fileUpload = require('express-fileupload');
app.use(fileUpload());

/** This module is used for flash messages in the system */
var flash = require('express-flash');
app.use(flash());

/** including .env file */
require('dotenv').config();

/** including render file */
var renderHtml = require('./render');
app.use(renderHtml);

var server = app.listen(process.env.PORT, () => {
	server.timeout = parseInt(process.env.MAX_EXECUTION_TIME);
	console.log('Server listening on port ' + process.env.PORT);
});

const io = require('socket.io')(server, {
	allowEIO3: true,
	cors: {
		origin: '*',
	}
});

/** Including mongo connection file */
var mongo = require("./config/connection");
mongo.connectToServer(() => {
	// /** get request time **/
	// var responseTime = require('response-time');
	// app.use(responseTime((req, res, time) => {
	// 	/** Including mongo connection file **/
	// 	let db = mongo.getDb();
	// 	const response_time = db.collection("response_time");
	// 	let timeResponse = (time < 1000) ? time.toFixed(2) + " Ms" : (time / 1000).toFixed(2) + " Sec";
	// 	if (req.url == "/api/front_bases_api_response") {
	// 		let insertData = {
	// 			url: req.url,
	// 			request_type: req.method,
	// 			request_method: (req.body.method_name) ? req.body.method_name : "",
	// 			api_type: (req.body.api_type) ? req.body.api_type : "",
	// 			response_time: timeResponse,
	// 			response_time_ms: time,
	// 			created: new Date(),
	// 		};
	// 		response_time.insertOne(insertData, () => {

	// 		});
	// 	}
	// }));
	var routes = require('./routes/web');
	routes.configure(app, io, mongo);
});
