const { body, validationResult } = require('express-validator');

/**
 * Function for login validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const loginValidationRules = () => {
	/** Check validation **/
	return [
		body('username').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}),

		body('password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		})
	]
}//end loginValidationRules

/**
 * Function for edit profile validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const editUserProfileValidationRules = () => {
	/** Check validation **/
	return [
		body('full_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_full_name', { value, location, path });
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
	]
}//end editUserProfileValidationRules

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

		body('old_email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}),

		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}).custom((value, { req, location, path }) => {
			let optionsConditions = {
				email: value,
				user_id: (req.params.id) ? req.params.id : "",
			}
			return findUserByEmail(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_email_id_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('mobile').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_phone_number', { value, location, path });
		}).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_phone_number', { value, location, path });
		}).isLength({ min: MOBILE_NUMBER_MIN_DASH_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use data */
			let optionsConditions = {
				mobile_number: value,
				user_id: (req.params.id) ? req.params.id : "",
			}
			return findUserByMobile(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_mobile_number_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('gender').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_gender', { value, location, path });
		}),

		body('account_type').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_account_type', { value, location, path });
		}),

		/** START BUSSINESS DETAILS VALIDATION */
		body('name_of_the_business').if((value, { req }) => req.body.name_of_the_business && req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_name_of_the_business', { value, location, path });
		}).isLength({ max: BUSINESS_NAME_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.business_name_length_should_maximum_digits', BUSINESS_NAME_LIMIT, { value, location, path });
		}),

		body('redemption_code').if((value, { req }) => req.body.redemption_code && req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_redemption_code', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isLength({ min: REDEMPTION_CODE_MAX_LENGTH, max: REDEMPTION_CODE_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.redemption_code_length_should_maximum_digits', REDEMPTION_CODE_MAX_LENGTH, { value, location, path });
		}),

		body('marketing_headline').if((value, { req }) => req.body.marketing_headline && req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_marketing_headline', { value, location, path });
		}),

		body('business_banner').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE && req.files && req.files.business_banner).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.business_banner && req.files.business_banner.mimetype) ? req.files.business_banner.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

		body('business_banner_temp').if((value, { req }) => req.files && req.files.business_banner_temp).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.business_banner_temp && req.files.business_banner_temp.mimetype) ? req.files.business_banner_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
		/** END BUSSINESS DETAILS VALIDATION */


		body('user_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_username', { value, location, path });
		}).custom(value => !/\s/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.no_spaces_are_allowed_in_the_username', { value, location, path });
		}).custom(value => !/\@/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.special_character_@_is_allowed_in_the_username', { value, location, path });
		}).custom((value, { req, location, path }) => {
			let optionsConditions = {
				user_name: value,
				email: (req.body.old_email) ? req.body.old_email : "",
				user_id: (req.params.id) ? req.params.id : "",
			}
			return findUserSlug(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_username_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('dd').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_date', { value, location, path });
		}),
		body('mm').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_month', { value, location, path });
		}),
		body('yy').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_year', { value, location, path });
		}),

		body('zip').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_zip_code', { value, location, path });
			// }).isLength({ min: ZIP_CODE_MINIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			// return req.__('admin.user.zip_code_should_be_minimum_length', ZIP_CODE_MINIMUM_LIMIT, { value, location, path });
			// }).isNumeric().withMessage((value, { req, location, path }) => {
			// return req.__('admin.user.invalid_zip_code', { value, location, path });
		}),

		body('password').if((value, { req }) => req.body.password).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('confirm_password').if((value, { req }) => req.body.password).notEmpty().withMessage((value, { req, location, path }) => {
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
		body('profile_image_temp').if((value, { req }) => req.files && req.files.profile_image_temp).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.profile_image_temp && req.files.profile_image_temp.mimetype) ? req.files.profile_image_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
		body('business_banner_temp').if((value, { req }) => req.files && req.files.business_banner_temp).custom((value, { req }) => {
			let mimiType = (req.files && req.files.business_banner_temp && req.files.business_banner_temp.mimetype) ? req.files.business_banner_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

	]
}//end editUserValidationRules

/**
 * Function for add user validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addUserValidationRules = (req, res) => {
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

		body('mobile').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_phone_number', { value, location, path });
		}).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_phone_number', { value, location, path });
		}).isLength({ min: MOBILE_NUMBER_MIN_DASH_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use data */
			let optionsConditions = {
				mobile_number: value,
				user_id: "",
			}
			return findUserByMobile(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.user.your_mobile_number_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('gender').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_gender', { value, location, path });
		}),

		body('account_type').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_account_type', { value, location, path });
		}),

		/** START BUSSINESS DETAILS VALIDATION */
		body('name_of_the_business').if((value, { req }) => req.body.name_of_the_business && req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_name_of_the_business', { value, location, path });
		}).isLength({ max: BUSINESS_NAME_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.business_name_length_should_maximum_digits', BUSINESS_NAME_LIMIT, { value, location, path });
		}),

		body('redemption_code').if((value, { req }) => req.body.redemption_code && req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_redemption_code', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isLength({ min: REDEMPTION_CODE_MAX_LENGTH, max: REDEMPTION_CODE_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.redemption_code_length_should_maximum_digits', REDEMPTION_CODE_MAX_LENGTH, { value, location, path });
		}),

		body('marketing_headline').if((value, { req }) => req.body.marketing_headline && req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_marketing_headline', { value, location, path });
		}),

		body('business_banner').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE && req.files && req.files.business_banner).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.business_banner && req.files.business_banner.mimetype) ? req.files.business_banner.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

		body('business_banner_temp').if((value, { req }) => req.body.account_type == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE && req.files && req.files.business_banner_temp).custom((value, { req }) => {
			let mimiType = (req.files && req.files.business_banner_temp && req.files.business_banner_temp.mimetype) ? req.files.business_banner_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
		/** END BUSSINESS DETAILS VALIDATION */

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

		body('dd').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_date', { value, location, path });
		}),
		body('mm').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_month', { value, location, path });
		}),
		body('yy').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_year', { value, location, path });
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
		body('profile_image_temp').if((value, { req }) => req.files && req.files.profile_image_temp).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.profile_image_temp && req.files.profile_image_temp.mimetype) ? req.files.profile_image_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
		body('business_banner_temp').if((value, { req }) => req.files && req.files.business_banner_temp).custom((value, { req }) => {
			let mimiType = (req.files && req.files.business_banner_temp && req.files.business_banner_temp.mimetype) ? req.files.business_banner_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
	]
}//end addUserValidationRules

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
}//end forgetPasswordValidationRules

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
}//end resetPasswordValidationRules


/**
 * Function for forget password  validation 
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addMasterTurnOnDateValidationRules = () => {
	/** Check validation **/
	return [
		body('master_turn_on_date').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_date', { value, location, path });
		})
	]
}//end addMasterTurnOnDateValidationRules

/**
 * Function for update plan limit
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const updateLimitValidationRules = () => {
	/** Check validation **/
	return [
		body('exceed_limit').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_exceed_limit', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		})
	]
}//end updateLimitValidationRules

/**
 * Function for update plan limit
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const acceptPaymentValidationRules = () => {
	/** Check validation **/
	return [
		body('plan').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_plan', { value, location, path });
		}),
		body('payment_type').custom((value, { req }) => {
			if (req.body.plan.toLowerCase() === PLAN_FOR_FREE) {
				return true;
			}

			if (!value) {
				throw new Error(req.__('admin.user.please_select_payment_type'));
			}
			return true;
		}),
	]
}//end acceptPaymentValidationRules


/**
 * Function for update plan limit
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const uploadEnterpriseValidationRules = () => {
	/** Check validation **/
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_title', { value, location, path });
		}),
		body('upload_enterprise_file').custom((value, { req }) => {

			if (!req.file && (!req.files || req.files.length === 0)) {
				throw new Error(req.__('admin.user.please_upload_enterprise_file'));
			}

			let fileName = (req.files && req.files.upload_enterprise_file && req.files.upload_enterprise_file.name) ? req.files.upload_enterprise_file.name : "";

			let fileExtension = fileName.split('.').pop().toLowerCase();

			if (ALLOWED_EXCEL_EXTENSIONS.includes(fileExtension)) {
				return true;
			} else {
				let message = ALLOWED_EXCEL_ERROR_MESSAGE;
				throw new Error(message);
			}

		})
	]
}//end updateLimitValidationRules

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
		let formErrors = parseValidation(allErrors.errors);
		return res.send({
			status: STATUS_ERROR,
			message: formErrors
		});
	} else {
		return next()
	}
}

module.exports = {
	loginValidationRules,
	addUserValidationRules,
	editUserValidationRules,
	forgetPasswordValidationRules,
	resetPasswordValidationRules,
	editUserProfileValidationRules,
	addMasterTurnOnDateValidationRules,
	updateLimitValidationRules,
	acceptPaymentValidationRules,
	uploadEnterpriseValidationRules,
	validate,
}
