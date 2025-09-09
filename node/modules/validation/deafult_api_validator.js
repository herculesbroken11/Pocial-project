const { body, validationResult } = require('express-validator');


/**
 * Function for validate error and return
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const validate = (req, res, next) => {
	if (isPost(req)) {
		const allErrors = validationResult(req)
		if (allErrors.isEmpty()) {
			return next()
		}
		let formErrors = "";
		let apiType = (req.body.api_type) ? req.body.api_type : ADMIN_API_TYPE;

		if ((apiType) == MOBILE_API_TYPE || (apiType) == WEP_API_TYPE) {

			if (apiType == MOBILE_API_TYPE) {
				formErrors = stringValidationFromMobile(allErrors.errors);
			} else {
				formErrors = parseValidationFrontApi(allErrors.errors);
			}
			
			let finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: formErrors,
					message: formErrors,
				}
			};
			returnApiResult(req, res, finalResponse);
		} else {
			formErrors = parseValidation(allErrors.errors);

			return res.send({
				status: STATUS_ERROR,
				message: formErrors,
				lead_message: stringValidationFromMobile(allErrors.errors)
			});
		}
	} else {
		return next()
	}
}


/**
 * Function for use to authentication access
*/
authenticateAccess = (req, res) => {

	/** JWT Authentication **/
	let jwtOption = {
		'token': (req.headers.authorization) ? req.headers.authorization : "",
		'secretKey': JWT_CONFIG.secret,
		'slug': (req.body.slug) ? req.body.slug : "",
	}

	JWTAuthentication(req, res, jwtOption).then(responseData => {
		if (responseData.status == STATUS_ERROR) {
			return res.send({
				status: STATUS_ERROR,
				message: {}
			});
		} else {
			return res.send({
				status: STATUS_SUCCESS,
				message: {}
			});
		}
	});
}


/**
 * Function for add user validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const homePageContactUSValidate = () => {
	/** Check validation **/
	return [
		body('name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_name', { value, location, path });
		}),

		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_valid_email_address', { value, location, path });
		}),

		body('phone_number').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_phone_number', { value, location, path });
		}).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_phone_number', { value, location, path });
		}).isLength({ min: MOBILE_NUMBER_MIN_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		}),

		body('message').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_message', { value, location, path });
		}),
	]
}


/**
 * Function for get started home page validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const getStartedHomePageValidation = () => {
	/** Check validation **/
	return [
		body('first_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_first_name', { value, location, path });
		}),
		body('last_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_last_name', { value, location, path });
		}),
		body('mobile').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_phone_number', { value, location, path });
		}).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_phone_number', { value, location, path });
		}).isLength({ min: MOBILE_NUMBER_MIN_DASH_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		}),
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_valid_email_address', { value, location, path });
		}),
	]
}


/**
 * Function for Home page email validation for newsletter 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const newsletterHomePageEmailValidation = () => {
	/** Check validation **/
	return [
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('front.home.please_enter_valid_email_address', { value, location, path });
		}),
	]
}



/**
 * Lead validated data send error
 */
const leadValidate = (req, res, next) => {
	if (isPost(req)) {
		const allErrors = validationResult(req)
		if (allErrors.isEmpty()) {
			return next()
		}
		
		let errorData = stringValidationFromMobile(allErrors.errors);
		let replacedString = errorData.replace(/,/g, "<br>");

		return res.send({
			message: replacedString
		});
	} else {
		return next()
	}
}


module.exports = {
	validate,
	leadValidate,
	authenticateAccess,
	homePageContactUSValidate,
	getStartedHomePageValidation,
	newsletterHomePageEmailValidation
}
