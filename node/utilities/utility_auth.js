const crypto = require('crypto');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const moment = require('moment');
const geoip = require('geoip-lite');
const momentTimezone = require('moment-timezone');

/** 
 * Function for parse validation
 *
 * @param validationErrors As validationErrors Array
 * @param req As Request Data 
 * @return array
 */
parseValidation = (validationErrors) => {
    let usedFields = [];
    let newValidations = [];
    if (Array.isArray(validationErrors)) {
        validationErrors.map((item) => {
            if (usedFields.indexOf(item.path) == -1) {
                usedFields.push(item.path);
                newValidations.push(item);
            }
        });
        return newValidations;
    } else {
        return false;
    }
}//End parseValidation();

/**
 * Function to parse validation front api
 * 
 * @param {Array} validationErrors - An array of validation error objects
 * @returns {Object|Boolean} An object with validation messages grouped by parameter, or false if input is not an array
 */
parseValidationFrontApi = (validationErrors) => {
    var usedFields = [];
    var newValidations = [];
    if (Array.isArray(validationErrors)) {
        validationErrors.forEach(function (item) {
            if (usedFields.indexOf(item.path) == -1) {
                usedFields.push(item.path);
                newValidations[item.path] = [];
                newValidations[item.path].push(item.msg);
            }
        });
        let obj = {};
        for (var key in newValidations) {
            obj[key] = newValidations[key]
        }
        return obj;
    } else {
        return false;
    }
} //end parseValidationFrontApi();

/**
 * Function to convert array of validation errors into a string for mobile API
 * 
 * @param {Array} validationErrors - An array of validation error objects
 * @returns {String|Boolean} A string containing all validation error messages separated by newline characters, or false if input is not an array
 */
stringValidationFromMobile = (validationErrors) => {
    let usedFields = [];
    let newValidations = [];
    if (Array.isArray(validationErrors)) {
        validationErrors.map((item) => {
            if (usedFields.indexOf(item.path) == -1) {
                usedFields.push(item.path);
                newValidations.push(item);
            }
        });
        let newStringValidation = [];
        newValidations.map(records => {
            newStringValidation.push(records.msg + '\n');
        });
        return newStringValidation.toString();

    } else {
        return false;
    }
}//End stringValidationFromMobile();


/**
 * Function to send validation errors as a response
 * 
 * @param {Array} validationErrors - An array of validation error objects
 * @returns {Promise} A Promise that resolves with a response object containing the validation errors
 */
sendErrors = (validationErrors) => {
    let response = {};
    return new Promise(resolve => {
        response = {
            'data': {
                status: STATUS_ERROR,
                errors: validationErrors,
                message: "",
            }
        };
        return resolve(response);
    });
} //End sendErrors();

/**
 * Function for socket request from any where
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param options	As options
 *
 * @return null
 */
socketRequest = (req, res, options) => {
    if (typeof options.room_id !== typeof undefined && typeof options.emit_function !== typeof undefined) {
        const clientSideSocket = require('socket.io-client')(WEBSITE_SOCKET_URL);
        clientSideSocket.emit('socketRequest', options);
    } else {
        consoleLog(req)
        return res.__("system.missing_parameters");
    }
}//end socketRequest()

/**
 * Function for sanitize form data
 *
 * @param data				As Request Body
 * @param notAllowedTags	As Array of not allowed tags
 *
 * @return json
 */
sanitizeData = (data, notAllowedTags) => {
    let sanitized = arrayStripTags(data, notAllowedTags);
    return sanitized;
}//End sanitizeData()

/**
 * Function to strip not allowed tags from array
 *
 * @param array				As Data Array
 * @param notAllowedTags	As Tags to be removed
 *
 * @return array
 */
arrayStripTags = (array, notAllowedTags) => {
    if (array === undefined || array === null) {
        return array;
    }
    let result;
    if (typeof array === 'object' && !Array.isArray(array)) {
        result = {};
    } else if (Array.isArray(array)) {
        result = [];
    } else {
        // Not an object or array, just return as is
        return array;
    }
    for (let key in array) {
        if (!Object.prototype.hasOwnProperty.call(array, key)) continue;
        let value = (array[key] != null) ? array[key] : '';
        if (typeof value === 'object' && value !== null) {
            result[key] = arrayStripTags(value, notAllowedTags);
        } else {
            result[key] = stripHtml(value.toString().trim(), notAllowedTags);
        }
    }
    return result;
}//End arrayStripTags()

/**
 * Function to Remove Unwanted tags from html
 *
 * @param html				As Html Code
 * @param notAllowedTags	As Tags to be removed
 *
 * @return html
 */
stripHtml = (html, notAllowedTags) => {
    let unwantedTags = notAllowedTags;
    for (let j = 0; j < unwantedTags.length; j++) {
        html = html.replace(unwantedTags[j], '');
    }
    return html;
}//end stripHtml();

/**
 * Function to Check request is called from mobile of web
 *
 * @param req	As Request Data
 * @param res	As Response Data
 *
 * @return boolean
 */
isMobileApi = (req, res) => {
    if (typeof req.headers !== typeof undefined && typeof req.headers.authkey !== undefined && req.headers.authkey == WEBSITE_HEADER_AUTH_KEY && typeof req.route !== typeof undefined && typeof req.route.path !== typeof undefined && req.route.path == '/mobile_api') {
        return true;
    } else {
        consoleLog(res)
        return false;
    }
}//End isMobileApi()


/**
 * Function to JWT authentication (middleware) using async/await.
 *
 * @param req        As Request Data
 * @param res        As Response Data
 * @param jwtOption  As requested Data
 *
 * @return json
 */
JWTAuthentication = async (req, res, jwtOption) => {
    let token = (jwtOption && jwtOption.token) ? jwtOption.token : '';
    let secretKey = (jwtOption && jwtOption.secretKey) ? jwtOption.secretKey : '';
    let slug = (jwtOption && jwtOption.slug) ? jwtOption.slug : '';

    // If slug is required, validate it
    if (slug !== "") {
        try {
            const jwt = require('jsonwebtoken');
            if (!token) {
                // Token missing
                return {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("admin.system.something_going_wrong_please_try_again")
                };
            }

            // Decrypt the JWT token
            token = decryptJwtToken(token);

            // Decode JWT payload to check slug
            let tknData = token.split('.')[1];
            let decodedtknData = atob(tknData);
            decodedtknData = JSON.parse(decodedtknData);

            // Check if slug matches
            if (decodedtknData['slug'] !== slug) {
                return {
                    status: STATUS_ERROR,
                    req: req,
                    result: {},
                    message: res.__("admin.system.invalid_signature")
                };
            }

            // Verify JWT token asynchronously
            try {
                // jwt.verify can be promisified for async/await
                const decoded = await new Promise((resolve, reject) => {
                    jwt.verify(token, secretKey, (err, decoded) => {
                        if (err) return reject(err);
                        resolve(decoded);
                    });
                });

                // Success response
                return {
                    status: STATUS_SUCCESS,
                    result: decoded,
                    message: 'hello'
                };
            } catch (err) {
                // Invalid signature or token expired
                return {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("admin.system.invalid_signature")
                };
            }
        } catch (e) {
            console.log("Error in JWTAuthentication at utility_auth.js catch:", e);
            // General error
            return {
                status: STATUS_ERROR,
                result: {},
                message: res.__("admin.system.something_going_wrong_please_try_again")
            };
        }
    } else {
        // Slug not required, return success
        return {
            status: STATUS_SUCCESS,
            result: {},
            message: 'slug not required'
        };
    }
}; // end JWTAuthentication()

/**
 * Function used to return api result 
 *
 * @param response	As data in Object
 *
 * @return json
 */
returnApiResult = (req, res, response) => {
    var result = JSON.stringify(response.data);
    var utf8 = require('utf8');
    var myJSON = utf8.encode(result);
    let debugJsonView = (req.body.debugJsonView) ? req.body.debugJsonView : DEACTIVE;
    let apiType = (req.body.api_type) ? req.body.api_type : "";
    let isCrypto = (req.body.is_crypto) ? req.body.is_crypto : "";

	 // User tracking function call
    (async () => {
        try {
            // Track if slug is present OR if the API endpoint is /api/login or /api/user_registration
            let shouldTrack = false;
            if (req.body && req.body.slug) {
                shouldTrack = true;
            }
            // Check for /api/login or /api/user_registration in the URL (case-insensitive, ignore query params)
            let cleanUrl = (req.originalUrl || req.url || "").split('?')[0].toLowerCase();
            if (cleanUrl === "/api/login" || cleanUrl === "/api/user_registration") {
                shouldTrack = true;
            }

            if (shouldTrack) {
                let loginUserData = req.user_data ? req.user_data : "";
                let userId = loginUserData._id ? loginUserData._id : "";

                // Deep clone req.body and sanitize keys to remove dots ('.') from keys
                // Also, convert any MongoDB ObjectId to string to avoid BSON serialization errors
                function sanitizeKeysAndObjectIds(obj) {
                    if (Array.isArray(obj)) {
                        return obj.map(sanitizeKeysAndObjectIds);
                    } else if (obj && typeof obj === 'object') {
                        // Handle MongoDB ObjectId
                        if (
                            (typeof obj === 'object') &&
                            obj !== null &&
                            (
                                (typeof obj.toHexString === 'function' && obj._bsontype === 'ObjectID') ||
                                (typeof obj.toString === 'function' && obj._bsontype === 'ObjectID')
                            )
                        ) {
                            // Convert ObjectId to string
                            return obj.toString();
                        }
                        let newObj = {};
                        for (let key in obj) {
                            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                            // Replace all dots in key with underscores
                            let safeKey = key.replace(/\./g, '_');
                            newObj[safeKey] = sanitizeKeysAndObjectIds(obj[key]);
                        }
                        return newObj;
                    }
                    return obj;
                }

                // Prepare tracking data
                let responseData = sanitizeKeysAndObjectIds(response.data);
                let trackingData = {
                    url: req.originalUrl || req.url || "",
                    user_id: userId,
                    slug: req.body && req.body.slug ? req.body.slug : "",
                    request: sanitizeKeysAndObjectIds(req.body),
                    response: responseData,
                    created: getUtcDate()
                };

                if (cleanUrl === "/api/login" || cleanUrl === "/api/user_registration") {
                    if (responseData.result && responseData.result._id) {
                        trackingData['user_id'] = responseData.result._id;
                    }
                    if (responseData.result && responseData.result.slug) {
                        trackingData['slug'] = responseData.result.slug;
                    }
                }

                // Insert into user_tracking collection
                if (typeof db !== "undefined" && db.collection) {
                    let userTrackingCollection = db.collection(TABLE_USER_TRACKING);
                    await userTrackingCollection.insertOne(trackingData);
                }
            }
        } catch (err) {
            // If error is due to MongoDB key containing '.', log a more specific message
            if (err && err.message && err.message.includes("must not contain '.'")) {
                console.error("returnApiResult: MongoDB key error: ", err.message);
            } else if (
                err && err.message && (
                    err.message.includes("is not a valid ObjectId") ||
                    err.message.includes("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters")
                )
            ) {
                console.error("returnApiResult: MongoDB ObjectId serialization error: ", err.message);
            } else {
                console.error("returnApiResult: An error occurred: ", err);
            }
            // Silently fail tracking, do not block API response
        }
    })();
	
    if (debugJsonView == 0) {
        if (apiType == MOBILE_API_TYPE) {
            let convertBtoA = btoa(myJSON);
            let convertEncrypt = encryptCryptoMobile(convertBtoA);
            return res.send({
                response: (isCrypto == ACTIVE) ? convertEncrypt : convertBtoA
            });
        } else {
            let convertBtoA = btoa(myJSON);
            let convertEncrypt = encryptCrypto(convertBtoA);
            return res.send({
                response: (isCrypto == ACTIVE) ? convertEncrypt : convertBtoA
            });
        }
    } else {
        let message = JSON.parse(myJSON);
        if (req['body']['leadSubmitThirdParty'] == 1) {
            return res.send(message);
        } else {
            return res.send({
                response: JSON.parse(myJSON)
            });
        }
    }
} //End returnApiResult();

/**
 * Function to encrypt a string using AES-128-CBC algorithm
 * 
 * @param {String} encryptData - The string to be encrypted
 * @returns {String} The encrypted string in hexadecimal format
 */
encryptJwtToken = (encryptData) => {
    // Use crypto.createCipheriv instead of deprecated createCipher
    const algorithm = 'aes-128-cbc';
    // JWT_ENCRYPT_DECRYPT_API_KEY should be 16 bytes for aes-128-cbc
    let key = JWT_ENCRYPT_DECRYPT_API_KEY;
    if (typeof key === 'string') {
        key = Buffer.from(key, 'utf8');
    }
    if (key.length !== 16) {
        // Pad or slice the key to 16 bytes
        if (key.length > 16) {
            key = key.slice(0, 16);
        } else {
            const padded = Buffer.alloc(16);
            key.copy(padded);
            key = padded;
        }
    }
    // For demonstration, using a fixed IV of 16 zero bytes (not secure for production)
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(encryptData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
} //End encryptJwtToken();

/**
 * Function to decrypt an encrypted string using AES-128-CBC algorithm
 * 
 * @param {String} decryptData - The encrypted string to be decrypted
 * @returns {String} The decrypted string in UTF-8 format
 */
decryptJwtToken = (decryptData) => {
    const algorithm = 'aes-128-cbc';
    let key = JWT_ENCRYPT_DECRYPT_API_KEY;
    if (typeof key === 'string') {
        key = Buffer.from(key, 'utf8');
    }
    if (key.length !== 16) {
        // Pad or slice the key to 16 bytes
        if (key.length > 16) {
            key = key.slice(0, 16);
        } else {
            const padded = Buffer.alloc(16);
            key.copy(padded);
            key = padded;
        }
    }
    // Use the same IV as in encryptJwtToken (16 zero bytes)
    const iv = Buffer.alloc(16, 0);
    try {
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        let decrypted = decipher.update(decryptData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        // Log the error for debugging
        console.error("Error in JWTAuthentication at utility_auth.js decryptJwtToken catch:", err);
        // Optionally, you can throw or return a specific value
        throw new Error("JWT decryption failed: " + err.message);
    }
} //End decryptJwtToken();


/**
 * Function to generate a JSON Web Token (JWT) and a refresh token for a given user
 * 
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {Object} jwtUser  - The user object to be used for generating the JWT
 * @returns {Promise} A promise that resolves with an object containing the encrypted tokens and other relevant information
 */
jwtTokenGenerate = (req, res, jwtUser) => {
    return new Promise(resolve => {
        const token = jwt.sign(jwtUser, JWT_CONFIG.secret, { expiresIn: JWT_CONFIG.tokenLife });
        const refreshToken = jwt.sign(jwtUser, JWT_CONFIG.refreshTokenSecret, { expiresIn: JWT_CONFIG.refreshTokenLife });
        return resolve({
            token: encryptJwtToken(token),
            refresh_token: encryptJwtToken(refreshToken),
            token_life: JWT_CONFIG.tokenLife,
            req: req,
            res: res,
        });
    });
} //end jwtTokenGenerate();

/**
 * Function used to generate bcrypt password. 
 *
 * @param options	As data in Object
 *
 * @return json
 */
bcryptPasswordGenerate = (passwordString) => {
    return new Promise(resolve => {
        const saltRounds = 10;
        if (passwordString != "") {
            const isHashed = passwordString.startsWith('$2a$') || passwordString.startsWith('$2b$') || passwordString.startsWith('$2y$');
            if (isHashed && passwordString.length === 60) {
                return resolve(passwordString); // Already hashed, return as it is
            } else {
                bcrypt.hash(passwordString, saltRounds).then(function (bcryptPassword) {
                    return resolve(bcryptPassword);
                });
            }
        } else {
            return resolve('');
        }
    });
} //End bcryptPasswordGenerate();

/**
 * Function used to compare bcrypt password. 
 *
 * @param options	As data in Object
 *
 * @return json
 */
bcryptCheckPasswordCompare = (userEnterPassword, DbPassword) => {
    return new Promise(resolve => {
        if (userEnterPassword != "" && DbPassword != "") {
            bcrypt.compare(userEnterPassword, DbPassword).then(function (passwordMatched) {
                if (!passwordMatched) {
                    return resolve(false);
                } else {
                    return resolve(true);
                }
            });
        } else {
            return resolve(false);
        }
    });
} //End bcryptCheckPasswordCompare();

/**
 * Function to encrypt a string using AES-256-CTR algorithm
 * 
 * @param {String} textString - The string to be encrypted
 * @returns {String} The encrypted string in hexadecimal format
 */
encryptCrypto = (textString) => {
    try {
        const cipher = crypto.createCipheriv("aes-256-ctr", CRYPTO_ENCRYPT_DECRYPT_API_KEY, CRYPTO_ENCRYPT_DECRYPT_API_IV);
        let crypted = cipher.update(textString, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    } catch (error) {
        console.error("encryptUsingNodeCrypto: An error occurred: ", error);
        throw error;
    }
} //End encryptCrypto();

/**
 * Function to decrypt an encrypted string using AES-256-CTR algorithm
 * 
 * @param {String} textString - The encrypted string to be decrypted
 * @returns {String} The decrypted string in UTF-8 format
 */
decryptCrypto = (textString) => {
    try {
        const decipher = crypto.createDecipheriv("aes-256-ctr", CRYPTO_ENCRYPT_DECRYPT_API_KEY, CRYPTO_ENCRYPT_DECRYPT_API_IV);
        let deciphed = decipher.update(textString, 'hex', 'utf8');
        deciphed += decipher.final('utf8');
        return deciphed;
    } catch (error) {
        console.error("decryptUsingNodeCrypto: An error occurred: ", error);
        throw error;
    }
} //End decryptCrypto();

/**
 * Function to encrypt a string using AES-256-CBC algorithm
 * 
 * @param {String} textString - The string to be encrypted
 * @returns {String} The encrypted string in hexadecimal format
 */
encryptCryptoMobile = (textString) => {
    try {
        const cipher = crypto.createCipheriv("aes-256-cbc", CRYPTO_ENCRYPT_DECRYPT_API_KEY, CRYPTO_ENCRYPT_DECRYPT_API_IV);
        let crypted = cipher.update(textString, 'utf8', 'hex');
        crypted += cipher.final('hex');
        return crypted;
    } catch (error) {
        console.error("encryptUsingNodeCrypto: An error occurred: ", error);
        throw error;
    }
} //End encryptCryptoMobile();

/**
 * Function to decrypt a string using AES-256-CBC algorithm
 * 
 * @param {String} textString - The string to be decrypted
 * @returns {String} The decrypted string in hexadecimal format
 */
decryptCryptoMobile = (textString) => {
    try {
        const decipher = crypto.createDecipheriv("aes-256-cbc", CRYPTO_ENCRYPT_DECRYPT_API_KEY, CRYPTO_ENCRYPT_DECRYPT_API_IV);
        let deciphed = decipher.update(textString, 'hex', 'utf8');
        deciphed += decipher.final('utf8');
        return deciphed;
    } catch (error) {
        console.error("decryptUsingNodeCrypto: An error occurred: ", error);
        throw error;
    }
} //End decryptCryptoMobile();

/**
 * Function to check the SMTP email connection
 * 
 * @param {Object} req - The HTTP request object
 * @param {Object} res - The HTTP response object
 * @param {Object} smtpOptions - An object containing the SMTP options
 * @returns {Promise} A promise that resolves with the result of the SMTP connection check
 */
smtpConnectionCheck = (req, res, smtpOptions) => {
    return new Promise(resolve => {
        let userEmail = (smtpOptions.from_email) ? smtpOptions.from_email : "";
        let emailHost = (smtpOptions.host) ? smtpOptions.host : "";
        let emailPassword = (smtpOptions.password) ? smtpOptions.password : "";
        let emailPort = (smtpOptions.port) ? Number(smtpOptions.port) : "";

        if (emailPort != SMTP_SECURE_PORT) {
            finalResponse = {
                'status': STATUS_ERROR,
                'result': {
                    'from_email': userEmail,
                    'host': emailHost,
                    'email_password': emailPassword,
                    'port': emailPort,
                },
                'error': res.__("front.email_template.port_not_valid"),
                'message': res.__("front.email_template.connection_connected_not_successfully"),
            };
            return resolve(finalResponse);
        } else {
            const nodemailer = require("nodemailer");
            const transporter = nodemailer.createTransport({
                'host': emailHost,
                'port': emailPort,
                'secure': (emailPort == SMTP_SECURE_PORT) ? true : false,
                'auth': {
                    'user': userEmail,
                    'pass': emailPassword
                },
                'tls': {
                    rejectUnauthorized: true
                },
            });

            /** verify connection configuration*/
            transporter.verify(function (error) {
                if (error) {
                    finalResponse = {
                        'status': STATUS_ERROR,
                        'result': {
                            'from_email': userEmail,
                            'host': emailHost,
                            'email_password': emailPassword,
                            'port': emailPort,
                        },
                        'error': error,
                        'message': res.__("front.email_template.connection_connected_not_successfully"),
                    };
                    return resolve(finalResponse);
                } else {
                    finalResponse = {
                        'status': STATUS_SUCCESS,
                        'result': {
                            'from_email': userEmail,
                            'host': emailHost,
                            'email_password': emailPassword,
                            'port': emailPort,
                        },
                        'error': error,
                        'message': res.__("front.email_template.connection_connected_successfully"),
                    };
                    return resolve(finalResponse);
                }
            });
        }
    });
} //End smtpConnectionCheck();

/**
 * Function for use to JS Regex url validation
 * @returns 
 */
checkValidURL = (url) => {
    if (url !== "") {
        if (url.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g) !== null) {
            return true;
        } else {
            return false;
        }
    }
} //End checkValidURL();

/**
 * Function for used to seconds to minutes and seconds
 * ~~ is a shorthand for Math.floor,
 */
fancyTimeFormat = (duration) => {
    if (duration) {
        /* Hours, minutes and seconds*/
        var hrs = ~~(duration / 3600);
        var mins = ~~((duration % 3600) / 60);
        var secs = ~~duration % 60;
        var ret = "";

        ret += "" + hrs + ":" + (mins < 10 ? "0" : "");
        ret += "" + mins + ":" + (secs < 10 ? "0" : "");
        ret += "" + secs;

        return ret;
    } else {
        return "00:00:00";
    }
} //End fancyTimeFormat();

/**
 * Function to generate a list of months based on the provided date range or the current date
 * 
 * @param {Boolean} dayWiseFilter - A boolean indicating whether to generate a list of days or months
 * @param {String} fromDate - The start date of the range (in the format "yyyy-mm-dd")
 * @param {String} toDate - The end date of the range (in the format "yyyy-mm-dd")
 * @returns {Array} An array of objects containing the month and year in different formats
 */
getPreviousMonths = (dayWiseFilter, fromDate, toDate) => {
    if (dayWiseFilter) {
        var monthList = new Array();
        var monthReverseList = new Array();

        fromDate = fromDate.substring(0, 10);
        toDate = toDate.substring(0, 10);
        var start = new Date(fromDate); //yyyy-mm-dd
        var end = new Date(toDate); //yyyy-mm-dd

        let j = 0;
        while (start <= end) {
            var mm = ((start.getMonth() + 1) >= 10) ? (start.getMonth() + 1) : '0' + (start.getMonth() + 1);
            var dd = ((start.getDate()) >= 10) ? (start.getDate()) : '0' + (start.getDate());
            var yyyy = start.getFullYear();
            var date = dd + "-" + mm + "-" + yyyy; //dd-mm-yyyy
            var dateFormatShow = mm + "/" + dd + "/" + yyyy; //mm-dd-yyyy
            var yearMonthData = yyyy + "-" + mm + "-" + dd; //mm-dd-yyyy

            monthList[j] = {};
            monthList[j]['month_year'] = date;
            monthList[j]['name'] = dateFormatShow;
            monthList[j]['mongo_date'] = yearMonthData;

            j++;
            start = new Date(start.setDate(start.getDate() + 1)); //date increase by 1
        }
        let daylength = monthList.length;
        for (let m = daylength - 1; m >= 0; m--) {
            monthReverseList.push(monthList[m]);
        }
        return monthList;
    } else {
        var theMonths = new Array("01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12");
        var theMonthNames = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
        var today = new Date();

        var aMonth = today.getMonth();
        var aYear = today.getFullYear();

        var i;
        var monthList = new Array();

        for (i = 0; i < 12; i++) {
            monthList[i] = {};
            monthList[i]['month_year'] = theMonths[aMonth] + '-' + aYear;
            monthList[i]['name'] = theMonthNames[aMonth] + ' ' + aYear;
            aMonth--;
            if (aMonth < 0) {
                aMonth = 11;
                aYear--;
            }
        }
        return monthList;
    }
} //End getPreviousMonths();

/**
 * Get the week number of the month, from "First" to "Last"
 * @param {Date} date 
 * @returns {string}
 */
weekOfTheMonth = (date) => {
    const weekDay = date.getDay()
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    /** Check the next day of the week and if it' on the same month, if not, respond with "Last"*/
    const nextWeekDay = new Date(date.getTime() + (1000 * 60 * 60 * 24 * 7))
    if (nextWeekDay.getMonth() !== date.getMonth()) {
        week = 5
    }

    return `${weekDays[weekDay]}` //Sunday , Monday, Monday
} //End weekOfTheMonth();

/**
 * Calculates the number of weeks between two dates.
 * 
 * @param {Date} d1 The first date.
 * @param {Date} d2 The second date.
 * @returns {number} The number of weeks between the two dates, rounded to the nearest whole number.
 */
weeksBetween = (d1, d2) => {
    return Math.round((d2 - d1) / (7 * 24 * 60 * 60 * 1000));
} //End weeksBetween();

/**
 * Calculates the difference between two dates in years, months, weeks, and days.
 * 
 * @param {Date} dt1 The first date.
 * @param {Date} dt2 The second date.
 * @returns {Object} An object containing the differences in years, months, weeks, and days.
 */
diffYearMonthWeekDay = (dt1, dt2) => {
    var time = (dt2.getTime() - dt1.getTime()) / 1000;
    var year = Math.abs(Math.round((time / (60 * 60 * 24)) / 365.25));
    var month = Math.abs(Math.round(time / (60 * 60 * 24 * 7 * 4)));
    var week = Math.abs(Math.round(time / (60 * 60 * 24 * 7)));
    var days = Math.abs(Math.round(time / (3600 * 24)));

    return ({
        "years": year,
        "months": month,
        "weeks": week,
        "week_after_day": (week > 0 && days > 0) ? days - (week * 7) : 0,
        "days": days
    });
} //End diffYearMonthWeekDay();

/**
 * Generates a strong password of a specified length, ensuring it contains at least one character from each of the following categories:
 * - Uppercase letters
 * - Lowercase letters
 * - Numbers
 * - Special characters
 * 
 * The password is then shuffled to randomize the order of the characters.
 * 
 * @returns {string} A strong password of the specified length.
 */
generatePassword = () => {
    const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
    const numericChars = "0123456789";
    const specialChars = "!@#$&";
    const length = AUTO_PASSWORD_GENERATE_LENGTH;
    const allChars = uppercaseChars + lowercaseChars + numericChars + specialChars;

    let password = "";

    /** Ensure at least one character from each category*/
    password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
    password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
    password += numericChars[Math.floor(Math.random() * numericChars.length)];
    password += specialChars[Math.floor(Math.random() * specialChars.length)];

    /** Fill the rest of the password with random characters */
    for (let i = 4; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    /** Shuffle the password to make the order random */
    password = password.split("").sort(function () {
        return 0.5 - Math.random();
    }).join("");

    return password;
} //End generatePassword();

/**
 * Function is used to convert Object id strings array to ObjectId array
 *
 * @param classes as a array
 *
 * @return class name
 */
arrayToObjectId = (arr) => {
    if (!arr || arr.constructor !== Array || arr.length == 0) return [];
    return arr.map((arrayElem) => {
        return newObjectIdDefault(arrayElem);
    });
}//End arrayToObject();


/**
 * Extracts all numeric characters from a given string.
 * 
 * This function uses a regular expression to match all non-numeric characters and replaces them with an empty string, effectively removing them.
 * 
 * @param {string} str The input string to extract numbers from.
 * @returns {string} A string containing only the numeric characters from the input string.
 */
extractNumbers = (str) => {
    return str.replace(/\D/g, '');
} //End extractNumbers();

/**
 * Generates a random alphanumeric ID of a specified length.
 * 
 * This function uses a character set of uppercase and lowercase letters, as well as numbers, to generate a random ID.
 * 
 * @param {number} length The length of the ID to generate.
 * @returns {string} A random alphanumeric ID of the specified length.
 */
let uniqueCounter = 0;
generateRandomID = (length) => {
    const timestamp = Date.now().toString(36);
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let randomPart = '';
    for (let i = 0; i < length; i++) {
        randomPart += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    uniqueCounter = (uniqueCounter + 1) % 10000;
    const counter = uniqueCounter.toString(36).padStart(2, '0');
    return `${timestamp}${randomPart}${counter}`;
};

/**
 * Function is used to get date after 90 days
 * @returns after 90 days retrun date
 */
getDateAfterNintyDays = () => {
    var today = new Date();
    var after90Days = new Date(today.getTime() + (90 * 24 * 60 * 60 * 1000));

    /**Formatting the dates in "year-month-date" format (YYYY-MM-DD)*/
    var formattedAfter90Days = formatDate(after90Days);

    return {
        after90Days: getUtcDate(formattedAfter90Days + " 23:59:59")
    };
} //End getDateAfterNintyDays();

/**
 * Funciotn for used to format date
 * @param {*} date 
 * @returns  yy-mm-dd date
 */
formatDate = (date) => {
    var year = date.getFullYear();
    var month = (date.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are zero-based
    var day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
} //End formatDate();

/**
 * Checks if an object is blank (i.e., has no properties).
 * @param {Object} obj The object to check.
 * @returns {boolean} True if the object is blank, false otherwise.
 */
isBlankObject = (obj) => {
    return Object.keys(obj).length === 0;
} //End isBlankObject();

/**
 * Generates a validation string for email verification.
 * @param {string} email The user's email address.
 * @returns {string} A validation string that can be used to verify the user's email address.
 */
verifyEmailUserValidateString = (email) => {
    let currentTimeStamp = new Date().getTime();
    let encId = crypto.createHash('md5').update(currentTimeStamp + email).digest("hex");
    return encId;
} //End verifyEmailUserValidateString();

/**
 * Checks if a given date is within the last 72 hours.
 * @param {string} createdDate The date string to check.
 * @returns {boolean} True if the date is within the last 72 hours, false otherwise.
 */
checkWithin72Hours = (createdDate) => {
    /**Convert the created date string to a Date object*/
    const created = new Date(createdDate);
    /**Get the current date and time*/
    const now = new Date();

    /**Calculate the difference in milliseconds between the current date and the created date*/
    const differenceMs = now - created;

    /**Calculate the difference in hours*/
    const differenceHours = differenceMs / (1000 * 60 * 60);

    /**Check if the difference is less than or equal to 72 hours*/
    return differenceHours <= 72;
} //End checkWithin72Hours();

/**
 * Checks if a given date is within a specified number of days.
 * @param {string} createdDate The date string to check.
 * @param {number} day The number of days to check against.
 * @returns {boolean} True if the date is within the specified number of days, false otherwise.
 */
checkWithinGivenDays = (createdDate, day) => {
    /** Convert the created date string to a Date object */
    const created = new Date(createdDate);
    /** Get the current date and time */
    const now = new Date();

    /** Calculate the difference in milliseconds between the current date and the created date */
    const differenceMs = now - created;

    /** Calculate the difference in days */
    const differenceDays = differenceMs / (1000 * 60 * 60 * 24);

    /** Check if the difference is less than or equal to 7 days */
    return differenceDays <= day;
} //End checkWithinGivenDays();

/**
 * Removes special characters from a string, while keeping spaces intact.
 * 
 * @param {string} inputString The string to remove special characters from.
 * @returns {string} The cleaned string with special characters removed.
 */
removeSpecialCharacters = (inputString) => {
    /** Use a regular expression to match any character that is not a letter, a number, or a space */
    const regex = /[^a-zA-Z0-9\s]/g;

    /** Use the replace method with the regex to remove special characters*/
    const cleanString = inputString.replace(regex, '');

    return cleanString;
} //End removeSpecialCharacters();

/**
 * Generates a random variable based on the current timestamp.
 * @returns {number} A random variable based on the current timestamp.
 */
randomVariablesGenerate = () => {
    const d = new Date();
    let time = d.getTime();
    return time;
} //End randomVariablesGenerate();

/**
 * function for use to calculate percentage
 * @param { total options } part 
 * @param { overll count poll } whole 
 * @returns percentage value
 */
calculatePercentage = (part, whole) => {
    if (!whole)
        return 0.00;

    const valueStr = parseFloat((100 * part / whole)).toString();
    const dot = valueStr.indexOf('.');

    if (dot !== -1) {
        return round(valueStr);
    } else {
        return Number(valueStr);
    }

} //End calculatePercentage();

/**
 * Get time difference in midnight to 12 clock
 * @returns total, days, hours, minutes, seconds
 */
getTimeRemaining = () => {
    let currentDate = newDate('', 'yyyy-mm-dd');
    let endtime = getUtcDate(currentDate + " 23:59:59");
    let startime = getUtcDate(getUtcDate());

    const total = Date.parse(endtime) - Date.parse(startime);
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const poll_vote_current_time_in_seconds = hours * 60 * 60 + minutes * 60 + seconds;

    return { total, days, hours, minutes, seconds, endtime, startime, poll_vote_current_time_in_seconds };
} //End getTimeRemaining();

/**
 * function for used to JavaScript function to validate an email address using regular expressions
 * @param {user email} email 
 * @returns 
 */
validateEmailCheck = (email) => {
    /**Regular expression pattern for email validation*/
    var pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    /** Use the test() method to check if the email matches the pattern*/
    return pattern.test(email);
} //End validateEmailCheck();

/**
* Function for Find duplicate or repeat elements in js array
*/
checkDuplicate = (arr) => {
    let result = false;
    /**create a Set with array elements*/
    const s = new Set(arr);
    /**compare the size of array and Set*/
    if (arr.length !== s.size) {
        result = true;
    }
    if (result) {
        return true;
    } else {
        return false;
    }
} //End checkDuplicate();


/**
 * Validates a comma-separated list of email addresses.
 * 
 * @param {string} raw The comma-separated list of email addresses to validate.
 * @returns {Promise<boolean>} A promise that resolves to true if all email addresses are valid, false otherwise.
 */
validateEmailCommaSeprate = (raw) => {
    return new Promise(resolve => {
        var emails = raw.split(',')
        var valid = true;
        var regex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        for (var i = 0; i < emails.length; i++) {
            if (emails[i] === "" || !regex.test(emails[i].replace(/\s/g, ""))) {
                valid = false;
                return resolve(valid);
            }
        }
        return resolve(valid);
    })
} //End validateEmailCommaSeprate();

/**
 * If the URL already has "https://" or "http://" as the prefix, it should return the input URL as is. Otherwise, it should add "http://" to the beginning.
 * @param {} url 
 * @returns 
 */
ensureHttpPrefix = (url) => {
    /** Check if the URL starts with "https://" or "http://"*/
    if (url.startsWith('https://') || url.startsWith('http://')) {
        return url; // Return the URL as is
    } else {
        /** If the URL doesn't have a prefix, add "http://"*/
        return 'https://' + url;
    }
} //End ensureHttpPrefix();

/** If the number is higher than 9, convert the number to a string (consistency). Otherwise, add a zero. */
formatNumber = (n) => {
    return n > 9 ? "" + n : "0" + n;
} //End formatNumber();

/***date after utc date convert*/
dateAfterUTCDate = (dayLimit) => {
    if (dayLimit) {
        const date = new Date();
        return addDays(date, dayLimit);
    } else {
        return "";
    }
} //End dateAfterUTCDate();

/***month after utc date convert*/
monthAfterUTCDate = (monthLimit) => {
    if (monthLimit) {
        return addMonths(new Date(), monthLimit);
    } else {
        return "";
    }
} //End monthAfterUTCDate();

/***month after utc date convert*/
yearAfterUTCDate = (yearLimit) => {
    if (yearLimit) {
        const now = getUtcDate();
        let date = now.getDate();
        let month = now.getMonth() + 1;
        let year = now.getFullYear() + yearLimit;
        return getUtcDate(year + "-" + month + "-" + date + " 23:59:59");
    } else {
        return "";
    }
} //End yearAfterUTCDate();

/** Function is used to add day */
addDays = (date, days) => {
    const copy = new Date(Number(date))
    copy.setDate(date.getDate() + days)
    return copy
} //End addDays();

/** Function is used to add month */
addMonths = (date, months) => {
    var d = date.getDate();
    date.setMonth(date.getMonth() + +months);
    if (date.getDate() != d) {
        date.setDate(0);
    }
    return date;
} //End addMonths();

/** Function to program to generate random strings
*
* declare all characters
*/
const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
generateString = (length) => {
    let result = ' ';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return (result).toLowerCase();
} //End generateString();

/** get url extension */
getUrlExtension = (url) => {
    return url.split(/[#?]/)[0].split('.').pop().trim();
} //End getUrlExtension();

/**
 * Function to get current timestamp
 *
 * @param null
 *
 * @return timestamp
 */
currentTimeStamp = () => {
    return new Date().getTime();
};//end currentTimeStamp();

/**
 * To check request method is post or get
 *
 * @param req	As Request Data
 * @param res	As Response Data
 *
 * @return boolean
 */
isPost = (req) => {
    if (typeof req.body !== typeof undefined && Object.keys(req.body).length != 0) {
        return true;
    } else {
        return false;
    }
}//End isPost()

/**
 * Function to genrate random otp
 *
 * @param null
 *
 * @return OTP
 */
getRandomOTP = () => {
    return new Promise(resolve => {
        resolve(Math.floor(1000 + Math.random() * 9000));
    });
}//end getRandomOTP();


/**
 * Function for make string to title case
 *
 * @param str AS String
 *
 * @return string
 */
toTitleCase = (str) => {
    return str.replace(/\w\S*/g, (txt) => { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}//end toTitleCase();

/**
 * Function to get date in any format with utc format
 *
 * @param date 		as	Date object
 * @param format 	as 	Date format
 *
 * @reference Site : https://www.npmjs.com/package/dateformat
 *
 * @return date string
 */
getDateMoment = () => {
    return moment();
}//end getUtcDate();


/**
 *  Function to convert numeric value in number format (like 3000 => 3,000)
 *
 * @param value as a numeric value
 *
 * @return numeric value after convert format
 */
numberFormat = (value) => {
    if (!value || isNaN(value)) {
        return value;
    }

    let input = value;
    let suffixes = ['k', 'M', 'G', 'T', 'P', 'E'];

    if (Number.isNaN(input)) {
        return null;
    }

    if (input < 1000) {
        return input;
    }

    let exp = Math.floor(Math.log(input) / Math.log(1000));
    let lenFromString = 1;

    return (input / Math.pow(1000, exp)).toFixed(lenFromString) + suffixes[exp - 1];

}// end numberFormat()

/**
 * Function to add days in given date
 *
 * @param addDay AS Number Of Hours to be added
 *
 * @return date string
 */
addDate = (hours) => {
    var addDayTimestamp = hours * 60 * 60 * 1000;
    now = new Date(Date.now() + addDayTimestamp);
    return now;
}//end addDate();

/**
 * Function to subtract days in given date
 *
 * @param Hours AS Number Of Days to be subtracted
 *
 * @return date string
 */
subtractDate = (Hours) => {
    var subtractHoursTimestamp = Hours * 60 * 60 * 1000;
    now = new Date(Date.now() - subtractHoursTimestamp);
    return now;
}//end subtractDate();

/**
 * Function to subtract minute in current date time
 *
 * @param minute AS minute to be subtracted
 *
 * @return date string
 */
subtractMinute = (minute) => {
    var subtractMinuteTimestamp = minute * 60 * 1000;
    now = new Date(Date.now() - subtractMinuteTimestamp);
    return now;
}//end subtractMinute();

/**
 * Function to get date in any format
 *
 * @param date 		as	Date object
 * @param format 	as 	Date format
 *
 * @return date string
 */
newDate = (date, format) => {
    let now;
    if (date) {
        now = new Date(date);
    } else {
        now = new Date();
    }
    if (format) {
        // For dateformat@5.x, the default export is an object with a default property
        let dateFormat = require('dateformat');
        let formatFn = dateFormat.default ? dateFormat.default : dateFormat;
        return formatFn(now, format);
    } else {
        return now;
    }
}//end newDate();

/**
 * Function to get date in any format with utc format
 *
 * @param date 		as	Date object
 * @param format 	as 	Date format
 *
 * @reference Site : https://www.npmjs.com/package/dateformat
 *
 * @return date string
 */
getUtcDate = (date, format) => {
    if (date) {
        var now = moment(date, moment.defaultFormat).toDate();
    } else {
        var now = moment().toDate();
    }
    if (format) {
        let dateFormat = require('dateformat');
        let formatFn = dateFormat.default ? dateFormat.default : dateFormat;
        return formatFn(now, format);
        // return dateFormat(now, format);
    } else {
        return now;
    }
}//end getUtcDate(); GMT 0 ka timezone*/


/**
 * Returns a date in the specified format, with the UTC time zone and 5 hours and 30 minutes added.
 * 
 * @param {string} [dateString] The date string to parse. If not provided, the current date and time are used.
 * @param {string} [format] The format to use when returning the date. If not provided, the date is returned as a Date object.
 * @returns {string|Date} The date in the specified format, or a Date object if no format is provided.
 */
getUtcSubtractDate = (dateString, format) => {
    let now;
    if (dateString) {
        now = moment(dateString, 'YYYY-MM-DD HH:mm:ss').toDate();
    } else {
        now = moment().toDate();
    }

    /**Subtract 5 hours and 30 minutes*/
    now = moment(now).add(5, 'hours').add(30, 'minutes').toDate();

    if (format) {
        return dateFormat(now, format);
    } else {
        return now;
    }
}; //End getUtcSubtractDate();

/*** Search accourding wise time zone set ip wise */
getUtcDateSearchTimeZone = (req, date) => {
    let defaultTimeZone = DEFAULT_TIME_ZONE; // Default timezone

    /**Detecting user's timezone based on IP address*/
    let ip = req.ip;

    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
    }

    let geo = geoip.lookup(ip);
    if (geo && geo.timezone) {
        defaultTimeZone = geo.timezone;
    }

    /** User's timezone (from search)*/
    let userTimezone = defaultTimeZone;

    /** Custom date and time in the user's timezone*/
    let userDateTime = momentTimezone.tz(date, 'YYYY-MM-DD HH:mm:ss', userTimezone);

    /** Convert the user's date and time to UTC */
    let userDateTimeUTC = momentTimezone.utc(userDateTime);
    let userDateTimeUTCDirect = userDateTimeUTC.format('YYYY-MM-DD HH:mm:ss');

    if (date) {
        return getUtcSubtractDate(userDateTimeUTCDirect);
    } else {
        return momentTimezone().toDate();
    }
} //End getUtcDateSearchTimeZone();


/**
 *  Function to Round the number
 *
 * @param value		As Number To be round
 * @param precision As Precision
 *
 * @return number
 */
round = (value, precision) => {
    try {
        if (!value || isNaN(value)) {
            return value;
        } else {
            precision = (typeof precision != typeof undefined && precision) ? precision : ROUND_PRECISION;
            var multiplier = Math.pow(10, precision || 0);
            return Math.round(value * multiplier) / multiplier;
        }
    } catch (e) {
        return value;
    }
}// end round()

/**
 *  Function to Round the number
 *
 * @param value		As Number To be round
 * @param precision As Precision
 *
 * @return number
 */
customRound = (value, precision) => {
    try {
        if (!value || isNaN(value)) {
            return value;
        } else {
            precision = (typeof precision != typeof undefined && precision) ? precision : ROUND_PRECISION;
            var multiplier = Math.pow(10, precision || 0);
            return Math.round(value * multiplier) / multiplier;
        }
    } catch (e) {
        return value;
    }
}// end customRound()

/**
 *  Function to generate a random sting
 *
 * @param req 		As Request Data
 * @param res 		As Response Data
 * @param options	As options
 *
 * @return string
 */
getRandomString = (req, res, options) => {
    return new Promise(resolve => {
        let srtingLength = (options && options.srting_length) ? parseInt(options.srting_length) : 8;
        /**Generate random string **/
        var randomstring = require("randomstring");
        let unique = randomstring.generate({
            length: srtingLength,
            charset: 'alphanumeric',
            capitalization: 'uppercase'
        });
        return resolve({
            status: STATUS_SUCCESS,
            result: unique,
            options: options,
            message: res.__("success")
        });
    });
}//End getRandomString()

/**
 * function is used to clear regular expression string
 *
 * @param regex	As Regular expression
 *
 * @return regular expression
 */
cleanRegex = (regex) => {
    if (NOT_ALLOWED_CHARACTERS_FOR_REGEX && NOT_ALLOWED_CHARACTERS_FOR_REGEX.length > 0) {
        for (let i in NOT_ALLOWED_CHARACTERS_FOR_REGEX) {
            regex = regex.split(NOT_ALLOWED_CHARACTERS_FOR_REGEX[i]).join('\\' + NOT_ALLOWED_CHARACTERS_FOR_REGEX[i]);
        }
        return regex;
    } else {
        return regex;
    }
}//end cleanRegex

/**
 * Function to Remove html tags from string
 *
 * @param string As text string
 *
 * @return html
 */
stripTag = (string) => {
    return string.replace(/(<([^>]+)>)/ig, " ");
}//end stripTag();

/**
 * Function Replace end of HTML text with a few dots
 *
 * @param str AS String
 *
 * @return string
 */
replaceStringFewStar = (stringData, lengthData) => {
    return (stringData.length > lengthData) ? (stringData.substring(0, lengthData) + '...') : stringData;
}//end replaceStringFewStar();

/**
 * Function to get date in any format
 *
 * @param date 		as	Date object
 * @param format 	as 	Date format
 *
 * @return date string
 */
ageUtcDate = (dateofbirth) => {
    if (dateofbirth) {
        var array = new Array();
        array = dateofbirth.split('-');

        let day = array[0];
        let month = array[1];
        let year = array[2];
        return getUtcDate(year + "-" + month + "-" + day + " 23:59:59");
    } else {
        return "";
    }
}//end newDate();


/** Get Last week date range from sunday to saturday moment js */
getLastWeekDate = () => {
    let startOfWeek = moment().subtract(1, 'weeks').startOf('week').format('YYYY-MM-DD');
    let endOfWeek = moment().subtract(1, 'weeks').endOf('week').format('YYYY-MM-DD');
    return { "start_date": startOfWeek, "end_date": endOfWeek };
}//end getLastWeekDate();

/** Get Start Date and End Date in Last month */
getStartDateAndEndDateLastMonth = () => {
    var date = new Date();
    var firstDay = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    var lastDay = new Date(date.getFullYear(), date.getMonth(), 0);
    return { "start_date": firstDay, "end_date": lastDay };
}

/**function for get url from email */
processEmail = (email) => {
    if (email.includes('@')) {
        const parts = email.split('@');
        const domain = parts[1];
        return domain;
    } else {
        return null;
    }
}

/**
 * Assuming geo.timezone is the timezone like 'Asia/Kolkata' and timeZoneAbbreviation is the abbreviation like 'IST'
 */
formatDateTime = (date, timeZone, abbreviation) => {
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: timeZone,
    };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const formattedDate = formatter.format(date);
    return `${formattedDate} ${abbreviation}`;
} //End formatDateTime();

/**
 *  Funciton for used to date save for timezone accourding 
 * @param {date for given date} date 
 * @param {*} format "hh:mm:ss"
 * @param {*} timezone (Asia/Kolkata,America/Los_Angeles etc.....)
 */
getUtcDateTimezone = (date, timezone) => {
    let now;
    if (timezone) {
        if (date) {
            /** Convert the provided date from the specified timezone to UTC */
            return now = momentTimezone.tz(date, 'YYYY-MM-DD HH:mm:ss', timezone).utc().toDate();
        } else {
            /** Use the current time in the specified timezone and convert it to UTC */
            return now = momentTimezone.tz(moment(), timezone).utc().toDate();
        }
    } else {
        if (date) {
            /** If no timezone is provided, assume UTC */
            return now = moment(date, moment.defaultFormat).utc().toDate();
        } else {
            /** Default to the current UTC time */
            return now = moment().utc().toDate();
        }
    }
}; // end getUtcDateTimezone

/**
 * Function for used to filter accourding timezone
 */
newDateTimeZone = (date, format, timezone) => {
    if (date) {
        var now = new Date(date);
    } else {
        var now = new Date();
    }
    if (format) {
        timezone = (timezone) ? timezone : DEFAULT_TIME_ZONE
        momentTimezone.tz.setDefault(timezone);
        var formatDate = momentTimezone(date, momentTimezone.defaultFormat).format(format);
        return formatDate;
    } else {
        return now;
    }
}//end newDate();


/**
 * to replace /n with <br> tag
 *
 * @param html	As Html
 *
 * @return html
 */
nl2br = (html) => {
    if (html) {
        return html.replace(/\n/g, "<br />");
    } else {
        return html;
    }
}//end nl2br

/**
 * Function to write Redis setting details and update settings file.
 * Uses async/await for all database and cache operations for better performance.
 * All parallelizable operations are handled using Promise.all.
 */
writeRedisSettingDetails = async (req, res) => {
    try {
        const settings = db.collection(TABLE_SETTINGS);

        // Fetch all settings from the database asynchronously
        const result = await settings.find({}, { projection: { _id: 1, key_value: 1, value: 1 } }).toArray();

        // Build the settings object with sanitized keys and values
        let settingsObj = {};
        result.forEach(record => {
            let settingKey = record.key_value ? record.key_value : "";
            let settingValue = record.value ? record.value : "";

            settingKey = settingKey.replace(/"/g, '\\"').replace(/'/g, "\\'");
            settingValue = settingValue.replace(/"/g, '\\"').replace(/'/g, "\\'");

            settingsObj[settingKey] = settingValue;
        });

        // Prepare Redis and file write operations to run in parallel
        const redisOps = [
            // Remove old Redis cache
            redisConnection.del(REDIS_SITE_SETTING),
            // Set new Redis cache with expiration and NX flag
            redisConnection.set(
                REDIS_SITE_SETTING,
                JSON.stringify(settingsObj),
                { EX: REDIS_EXPIRE_TIME, NX: true }
            )
        ];

        // Write settings file asynchronously
        const fs = require("fs").promises;
        const fileWriteOp = fs.writeFile(
            WEBSITE_ROOT_PATH + "config/settings.json",
            JSON.stringify(settingsObj),
            "utf8"
        );

        // Run Redis and file write operations in parallel
        await Promise.all([...redisOps, fileWriteOp]);

        // Remove settings data from in-memory cache after a short delay
        setTimeout(() => {
            myCache.del("settings");
        }, 1000);

        // Send success response
        return { status: STATUS_SUCCESS };
    } catch (error) {
        // Log error for debugging
        console.error("Error in writeRedisSettingDetails:", error);
        // Still return success to maintain legacy behavior, but you may want to handle this differently
        return { status: STATUS_SUCCESS };
    }
}; // End writeRedisSettingDetails