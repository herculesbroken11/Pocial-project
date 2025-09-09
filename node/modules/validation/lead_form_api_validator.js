const { body } = require('express-validator');
const LeadForm = this;

/**
 * Function for lead for create form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addCreateFormValidationRules = () => {
	/** Check validation **/
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_title', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_description', { value, location, path });
		}),
		body('assign_welcome_email_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_select_assign_welcome_email', { value, location, path });
		}),
		body('signin_option').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_select_signin_option', { value, location, path });
		}),
		body('signup_fields').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_select_signup_fields', { value, location, path });
		}),
		body('button_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_button_name', { value, location, path });
		}),
		body('mandatory_options').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_select_atleast_mendatory_options', { value, location, path });
		}),
		body('message_box_title.*.label').if((value, { req }) => (req.body.message_box_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_message_label', { value, location, path });
		}),
		body('message_box_title.*.mandatory').if((value, { req }) => (req.body.message_box_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_mandatory_options', { value, location, path });
		}),
		body('type_dropdown_title.*.label').if((value, { req }) => (req.body.type_dropdown_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_dropdown_label', { value, location, path });
		}),
		body('type_dropdown_title.*.mandatory').if((value, { req }) => (req.body.type_dropdown_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_mandatory_options', { value, location, path });
		}),
		body('type_dropdown_title.*.options').if((value, { req }) => (req.body.type_dropdown_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_select_options', { value, location, path });
		}),
		body('type_dropdown_title.*.options_comma_wise').if((value, { req }) => (req.body.type_dropdown_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_select_options', { value, location, path });
		}),
		body('type_dropdown_title.*.option_key_value').if((value, { req }) => (req.body.type_dropdown_title).length > 0).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_select_options', { value, location, path });
		}),
	]
}


/**
 * Function for edit lead capture form after subscriber user
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const updateCreateFormAfterSubscriberUser = () => {
	/** Check validation **/
	return [
		body('button_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_button_name', { value, location, path });
		}),
	]
}


/**
 * Function for submit leads sigin fields
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const siginFieldsFormValidationRules = (req, res) => {
	return [
		body('first_name').if((value, { req }) => req.body.first_name).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_first_name', { value, location, path });
		}).isLength({ max: NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_should_be_minimum_length', NAME_MAXIMUM_LIMIT, { value, location, path });
		}),
		body('last_name').if((value, { req }) => req.body.last_name).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_last_name', { value, location, path });
		}).isLength({ max: NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_should_be_minimum_length', NAME_MAXIMUM_LIMIT, { value, location, path });
		}),

		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}),

		body('mobile').if((value, { req }) => req.body.mobile).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_phone_number', { value, location, path });
		}).matches(MOBILE_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_phone_number', { value, location, path });
		}).isLength({ min: MOBILE_NUMBER_MIN_LENGTH, max: MOBILE_NUMBER_MAX_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.phone_number_should_be_minimum_length', MOBILE_NUMBER_MIN_LENGTH, { value, location, path });
		}),

		body('gender').if((value, { req }) => req.body.gender).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_gender', { value, location, path });
		}),

		body('dob').if((value, { req }) => req.body.dob).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_dob', { value, location, path });
		}).matches(DOB_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.invalid_date_format', { value, location, path });
		}),

		body('zip').if((value, { req }) => req.body.zip).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_zip_code', { value, location, path });
		}),

		body('password').if((value, { req }) => req.body.password).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_password', { value, location, path });
		}).isLength({ min: PASSWORD_MIN_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_length_should_be_minimum_6_character', { value, location, path });
		}).matches(PASSWORD_VALIDATION_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.password_must_be_alphanumeric', { value, location, path });
		}),

		body('confirm_password').if((value, { req }) => req.body.confirm_password).notEmpty().withMessage((value, { req, location, path }) => {
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

		body('image_name').if((value, { req }) => req.files && req.files.image_name).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.image_name && req.files.image_name.mimetype) ? req.files.image_name.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
	]
}


/**
 * Function for find user by mobile number lead wise (Check mobile number in all except this email id)
 *
 * @param value As mobile number
 * @param req As Request Data
 * 
 * @return json
 */
LeadForm.findUserByMobileLeadAccourding = (async (req, res, optionsConditions) => {
	let email = (optionsConditions.email) ? optionsConditions.email : "";
	let mobileNumber = (optionsConditions.mobile_number) ? optionsConditions.mobile_number : "";
	let emailUserId = await getEmailWiseUserIdGet(req, res, email);

	return new Promise(resolve => {
		let conditions = {
			"is_deleted": NOT_DELETED,
			"_id": { $ne: ObjectId(emailUserId) },
			"mobile": mobileNumber,
		};

		const user = db.collection(TABLE_USERS);
		let response = {};

		user.findOne(conditions, { projection: { _id: 1 } }, (err, mobileData) => {
			mobileData = mobileData ? mobileData : {};
			/** Send response **/
			if (Object.keys(mobileData).length > 0) {
				response = {
					status: STATUS_SUCCESS,
					result: mobileData,
				};
				resolve(response);
			} else {
				response = {
					status: STATUS_ERROR,
					err: err,
					result: {},
				};
				resolve(response);
			}
		})
	});
});


/**
 * Function for use to get script code customization validation
 */
const scriptCustomizationValidation = () => {
	/** Check validation **/
	return [
		body('unique_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_unique_name', { value, location, path });
		}).isLength({ max: SCRIPT_CUSTOMIZATION_UNIQUE_NAME_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.unique_name_should_be_minimum_length', SCRIPT_CUSTOMIZATION_UNIQUE_NAME_LIMIT, { value, location, path });
		}).custom((value, { req, location, path }) => {
			let optionsConditions = {
				lead_forms_id: "",
				lead_forms_slug: (req.body.lead_forms_slug) ? req.body.lead_forms_slug : "",
				unique_name: (req.body.unique_name) ? req.body.unique_name : "",
				customized_script_id: (req.body.customized_script_id) ? req.body.customized_script_id : "",
			}
			return duplicateGenerateScriptCheck(optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.lead.your_unique_name_is_already_exist', { value, location, path }));
				}
			});
		}),
	]
}


module.exports = {
	addCreateFormValidationRules,
	updateCreateFormAfterSubscriberUser,
	siginFieldsFormValidationRules,
	scriptCustomizationValidation,
}
