const { body, validationResult } = require('express-validator');

/**
 * Function for lead for create form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addLeadCreateFormValidationRules = () => {
	/** Check validation **/
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_title', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_description', { value, location, path });
		}),
		body('assign_welcome_email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_select_assign_welcome_email', { value, location, path });
		}),
		/** body('text_to_display').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_text_to_display', { value, location, path });
		}),
		body('display_url_description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_display_url_description', { value, location, path });
		}),*/
		body('button_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.please_enter_button_name', { value, location, path });
		}).isLength({ min: 0, max: BUTTON_NAME_LENGTH }).withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.button_name_should_be_maximum_limit', BUTTON_NAME_LENGTH, { value, location, path });
		}),
		body('notify_email').if((value, { req }) => req.body.notify_email).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).custom((value, { req, location, path }) => {
			return validateEmailCommaSeprate(value).then(response => {
				if (response == false) {
					return Promise.reject(req.__('admin.user.please_enter_valid_email_address', { value, location, path }));
				}
			});
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
		body('image_temp').if((value, { req }) => req.files && req.files.image_temp).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.image_temp && req.files.image_temp.mimetype) ? req.files.image_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

		body('notify_email_send_type').if((value, { req }) => req.body.notify_email_type == LEAD_CAMPAIGN_NOTIFY_EMAIL_ALL).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads.atleast_one_checked', { value, location, path });
		}),
	]
}//end addLeadCreateFormValidationRules

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
				lead_forms_slug: "",
				lead_forms_id: (req.body.lead_id) ? req.body.lead_id : "",
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
}//end scriptCustomizationValidation

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
}//end validate

module.exports = {
	addLeadCreateFormValidationRules,
	scriptCustomizationValidation,
	validate,
}
