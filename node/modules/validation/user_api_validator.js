const { body, validationResult } = require('express-validator');


/**
 * Function for add user validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addUserValidationRules = (req, res) => {
	console.log("addUserValidationRules");
	/** Check validation **/
	return [
		body('first_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_first_name', { value, location, path });
		}).isLength({ max: NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_should_be_minimum_length', NAME_MAXIMUM_LIMIT, { value, location, path });
		}),

		body('last_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_last_name', { value, location, path });
		}).isLength({ max: NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_should_be_minimum_length', NAME_MAXIMUM_LIMIT, { value, location, path });
		}),

		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}).custom((value, { req, location, path }) => {
			let accountType = (req.body.account_type) ? req.body.account_type : "";

			/** condition already use data */
			let optionsConditions = {
				email: value,
				user_id: "",
			}
			return findUserByEmail(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS && accountType !== PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
					return Promise.reject(req.__('admin.user.your_email_id_is_already_exist', { value, location, path }));
				}
			});
		}),
		body('zip').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_zip_code', { value, location, path });
		}),


		body('password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('user_name').if((value, { req }) => req.body.user_name).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_username', { value, location, path });
		}).custom(value => !/\s/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.no_spaces_are_allowed_in_the_username', { value, location, path });
		}).custom(value => !/\@/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.special_character_@_is_allowed_in_the_username', { value, location, path });
		}).custom((value, { req, location, path }) => {
			let optionsConditions = {
				user_name: value,
				email: (req.body.email) ? req.body.email : "",
			}
			return findUserSlug(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_username_is_already_exist', { value, location, path }));
				}
			});
		}),
	]
}



/**
 * Function for login validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const verifyOtpValidationRules = () => {
	/** Check validation **/
	return [
		body('otp').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.user.please_enter_otp', { value, location, path });
		})
	]
}

/**
 * Function for forget password  validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const forgetPasswordValidationRules = () => {
	/** Check validation **/
	return [
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		})
	]
}

/**
 * Function for Reset password  validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const resetPasswordValidationRules = () => {
	/** Check validation **/
	return [
		body('password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('confirm_password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_confirm_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}).custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error();
			}
			return true;
		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.confirm_password_should_be_same_as_password', { value, location, path });
		}),
	]
}

/**
 * Function for login validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const loginValidationRules = () => {
	return [
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}),

		body('password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		})
	]
}

/**
 * Function for edit user validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const editUserValidationRules = (req, res) => {
	return [
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use email data */
			let loginUserData = (req.user_data) ? req.user_data : "";

			let optionsConditions = {
				'email': value,
				'user_id': (loginUserData._id) ? loginUserData._id : "",
			}
			return findUserByEmail(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_email_id_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('first_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_first_name', { value, location, path });
		}).isLength({ max: NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_should_be_minimum_length', NAME_MAXIMUM_LIMIT, { value, location, path });
		}),

		body('last_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_last_name', { value, location, path });
		}).isLength({ max: NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_should_be_minimum_length', NAME_MAXIMUM_LIMIT, { value, location, path });
		}),

		// body('mobile').notEmpty().withMessage((value, { req, location, path }) => {
		// 	return req.__('admin.user.please_enter_phone_number', { value, location, path });
		// }).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
		// 	return req.__('admin.user.invalid_phone_number', { value, location, path });
		// }).isLength({ min: MOBILE_NUMBER_MIN_DASH_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
		// 	return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		// }).custom((value, { req, location, path }) => {
		// 	/** condition already use data */
		// 	let loginUserData = (req.user_data) ? req.user_data : "";
		// 	let optionsConditions = {
		// 		mobile_number: value,
		// 		user_id: (loginUserData._id) ? loginUserData._id : "",
		// 	}
		// 	return findUserByMobile(req, res, optionsConditions).then(user => {
		// 		if (user.status == STATUS_SUCCESS) {
		// 			return Promise.reject(req.__('admin.user.your_mobile_number_is_already_exist', { value, location, path }));
		// 		}
		// 	});
		// }),

		body('gender').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_gender', { value, location, path });
		}),

		body('dob').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_dob', { value, location, path });
		}).matches(DOB_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_date_format', { value, location, path });
		}),

		body('zip').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_zip_code', { value, location, path });
		}),

		body('old_password').if((value, { req }) => req.body.old_password).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_your_old_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('password').custom((value, { req, location, path }) => {
			if (req.body.old_password != "" && req.body.password == "") {
				throw new Error();
			}
			return true;
		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).if((value, { req }) => req.body.password).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('confirm_password').custom((value, { req, location, path }) => {
			if (req.body.old_password != "" && req.body.confirm_password == "") {
				throw new Error();
			}
			return true;

		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_confirm_password', { value, location, path });
		}).if((value, { req }) => req.body.confirm_password).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_confirm_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}).custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error();
			}
			return true;
		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.confirm_password_should_be_same_as_password', { value, location, path });
		}),

		body('user_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_username', { value, location, path });
		}).custom(value => !/\s/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.no_spaces_are_allowed_in_the_username', { value, location, path });
		}).custom(value => !/\@/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.special_character_@_is_allowed_in_the_username', { value, location, path });
		}).custom((value, { req, location, path }) => {
			let optionsConditions = {
				'user_name': value,
				'user_id': (req.user_data && req.user_data._id) ? req.user_data._id : "",
				'email': (req.user_data && req.user_data.email) ? req.user_data.email : "",
			}
			return findUserSlug(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_username_is_already_exist', { value, location, path }));
				}
			});
		}),

		/** START BUSSINESS DETAILS VALIDATION */
		body('name_of_the_business').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_name_of_the_business', { value, location, path });
		}).isLength({ max: BUSINESS_NAME_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.business_name_length_should_maximum_digits', BUSINESS_NAME_LIMIT, { value, location, path });
		}),

		// body('primary_address').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
		// 	return req.__('admin.user.please_enter_primary_address', { value, location, path });
		// }),
		body('business_industry').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_business_industry', { value, location, path });
		}),

		body('redemption_code').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_redemption_code', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isLength({ min: REDEMPTION_CODE_MAX_LENGTH, max: REDEMPTION_CODE_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.redemption_code_length_should_maximum_digits', REDEMPTION_CODE_MAX_LENGTH, { value, location, path });
		}),
	]
}


/**
 * Function for change password validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const changePasswordValidationRules = () => {
	/** Check validation **/
	return [
		body('old_password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_your_old_password', { value, location, path });
		}),

		body('password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('confirm_password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_confirm_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}).custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error();
			}
			return true;
		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.confirm_password_should_be_same_as_password', { value, location, path });
		}),
	]
}



/**
 * Function for change social password validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const socialChangePasswordValidation = () => {
	/** Check validation **/
	return [
		body('password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('confirm_password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_confirm_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}).custom((value, { req }) => {
			if (value !== req.body.password) {
				throw new Error();
			}
			return true;
		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.confirm_password_should_be_same_as_password', { value, location, path });
		}),
	]
}



/**
 * Function edit public bussiness information validation rules
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const publicBussinessInformationValidationRules = (req, res) => {
	/** Check validation **/
	return [
		body('business_email').if((value, { req }) => req.body.business_email).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use email data */
			let loginUserData = (req.user_data) ? req.user_data : "";
			let optionsConditions = {
				'email': value,
				'user_id': (loginUserData._id) ? loginUserData._id : "",
			}
			return findUserByEmail(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_email_id_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('name_of_the_business').if((value, { req }) => req.body.name_of_the_business).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_name_of_the_business', { value, location, path });
		}).isLength({ max: BUSINESS_NAME_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.business_name_length_should_maximum_digits', BUSINESS_NAME_LIMIT, { value, location, path });
		}),

		body('primary_phone').if((value, { req }) => req.body.primary_phone).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_phone_number', { value, location, path });
		}).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_phone_number', { value, location, path });
		}).isLength({ min: MOBILE_NUMBER_MIN_DASH_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		}),

		body('marketing_sub_headline').if((value, { req }) => req.body.marketing_sub_headline).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_marketing_sub_headline', { value, location, path });
		}),

		body('marketing_headline').if((value, { req }) => req.body.marketing_headline).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_marketing_headline', { value, location, path });
		}),

		body('primary_address').if((value, { req }) => req.body.primary_address).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_primary_address', { value, location, path });
		}),

		body('business_industry').if((value, { req }) => req.body.business_industry).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_business_industry', { value, location, path });
		}),

		body('redemption_code').if((value, { req }) => req.body.redemption_code).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_redemption_code', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isLength({ min: REDEMPTION_CODE_MAX_LENGTH, max: REDEMPTION_CODE_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.redemption_code_length_should_maximum_digits', REDEMPTION_CODE_MAX_LENGTH, { value, location, path });
		}),

		body('business_logo').if((value, { req }) => req.files && req.files.business_logo).custom((value, { req }) => {
			let mimiType = (req.files && req.files.business_logo && req.files.business_logo.mimetype) ? req.files.business_logo.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

		body('business_banner').if((value, { req }) => req.files && req.files.business_banner).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.business_banner && req.files.business_banner.mimetype) ? req.files.business_banner.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

		body('standout_business_competition').if((value, { req }) => req.body && req.body.standout_business_competition && (req.body.standout_business_competition).length > 0).custom((value, { req, location, path }) => {
			let standardBusinessCompetition = (req.body.standout_business_competition) ? req.body.standout_business_competition : "";
			if (checkConsecutiveTwice(standardBusinessCompetition)) {
				return true;
			} else {
				return Promise.reject(req.__('front.user.all_values_should_not_be_same', { value, location, path }));
			}
		}),

		body('standout_business_competition_percentage').if((value, { req }) => req.body && req.body.standout_business_competition_percentage && (req.body.standout_business_competition_percentage).length > 0).custom((value, { req, location, path }) => {
			let standardBusinessCompetitionPercentage = (req.body.standout_business_competition_percentage) ? req.body.standout_business_competition_percentage : "";
			/** check if condition use to numeric array */
			if (onlyNumbers(standardBusinessCompetitionPercentage)) {
				/** check if condition use to array count in hundred */
				if (countAndCheckHundredPercentage(standardBusinessCompetitionPercentage)) {
					/** Total percentage 100 check validation */
					const totalStandardOutValue = standardBusinessCompetitionPercentage.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
					if (totalStandardOutValue == 100) {
						return true;
					} else {
						return Promise.reject(req.__('front.user.number_all_100_percentage', { value, location, path }));
					}
				} else {
					return Promise.reject(req.__('front.user.total_percentage_count_must_be_equal_to_hundred', { value, location, path }));
				}
			} else {
				return Promise.reject(req.__('front.user.please_enter_numeric_value', { value, location, path }));
			}
		}),

		body('business_grow_focus').if((value, { req }) => req.body && req.body.business_grow_focus && (req.body.business_grow_focus).length > 0).custom((value, { req, location, path }) => {
			let businessGrowFocus = (req.body.business_grow_focus) ? req.body.business_grow_focus : "";
			if (checkConsecutiveTwice(businessGrowFocus)) {
				return true;
			} else {
				return Promise.reject(req.__('front.user.all_values_should_not_be_same', { value, location, path }));
			}
		}),

		body('business_grow_focus_percentage').if((value, { req }) => req.body && req.body.business_grow_focus_percentage && (req.body.business_grow_focus_percentage).length > 0).custom((value, { req, location, path }) => {
			let businessGrowPercentage = (req.body.business_grow_focus_percentage) ? req.body.business_grow_focus_percentage : "";

			/** check if condition use to numeric array */
			if (onlyNumbers(businessGrowPercentage)) {
				/** check if condition use to array count in hundred */
				if (countAndCheckHundredPercentage(businessGrowPercentage)) {
					/** Total percentage 100 check validation */
					const totalBusinessGrow = businessGrowPercentage.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
					if (totalBusinessGrow == 100) {
						return true;
					} else {
						return Promise.reject(req.__('front.user.number_all_100_percentage', { value, location, path }));
					}
				} else {
					return Promise.reject(req.__('front.user.all_field_are_hundred_percentage', { value, location, path }));
				}
			} else {
				return Promise.reject(req.__('front.user.please_enter_numeric_value', { value, location, path }));
			}
		}),
	]
}


/**
 * Check if an Array contains only Numbers
 * @param {Numeric array }
 * @returns 
 */
onlyNumbers = (array) => {
	return array.every(element => {
		return typeof element === 'number';
	});
}

/**
 * If you want to check if an array contains the same value at least twice after every non-equal value
 */
function checkConsecutiveTwice(arry) {
	const toFindDuplicates = arry => arry.filter((item, index) => arry.indexOf(item) !== index);
	const duplicateElements = toFindDuplicates(arry);
	if (duplicateElements.length > 0) {
		return false;	//same value
	} else {
		return true; // no dupicate value
	}
}


/**
 * Check validate that the sum of elements in a numeric array in JavaScript is equal to 100
 * 
 * example [10,30,60]
 */
countAndCheckHundredPercentage = (array) => {
	if (!Array.isArray(array)) {
		return false;
	}
	const sum = array.reduce((acc, value) => acc + value, 0);
	return sum === 100;
}


/**
 * Function for social user validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const socialValidationRules = () => {
	/** Check validation **/
	return [
		body('first_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_first_name', { value, location, path });
		}),

		body('last_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_last_name', { value, location, path });
		}),

		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		})
	]
}



/**
 * Function for add user third party validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addUserThirdPartyValidationRules = (req, res) => {
	/** Check validation **/
	return [
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use data */
			let optionsConditions = {
				email: value,
				user_id: "",
			}
			return findUserByEmail(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_email_id_is_already_exist', { value, location, path }));
				}
			});
		}),
	]
}

module.exports = {
	loginValidationRules,
	addUserValidationRules,
	editUserValidationRules,
	changePasswordValidationRules,
	socialChangePasswordValidation,
	forgetPasswordValidationRules,
	resetPasswordValidationRules,
	verifyOtpValidationRules,
	publicBussinessInformationValidationRules,
	socialValidationRules,
	addUserThirdPartyValidationRules,
}
