const { body, validationResult } = require('express-validator');

/**
 * Function for add email template
 * @param req As Request Data
 * @param res As Response Data
 * @return json
 */
const addEmailTemplateValidation = () => {
	return [
		body('from_email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.email_template.please_enter_from_email', { value, location, path });
		}),

		body('host').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_host', { value, location, path });
		}),

		body('port').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_port', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}),

		body('email_password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_email_password', { value, location, path });
		}),

		body('template_title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.complete_email.please_enter_template_title', { value, location, path });
		}),
		body('subject').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.complete_email.please_enter_subject', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.complete_email.please_enter_description', { value, location, path });
		}),
		body('design_json').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.complete_email.design_json', { value, location, path });
		}),
		body('page_body').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.complete_email.body', { value, location, path });
		}),
		body('attach_reward').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.rewards.please_select_reward', { value, location, path });
		}),
		body('from').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_from', { value, location, path });
		}).matches(ALPHABETIC_REGULAR_EXPRESSION).withMessage((value, { req, location, path }) => {
			return req.__('admin.user.name_must_be_alphabetic', { value, location, path });
		})
	]
}//end addEmailTemplateValidation

/**
 * Function for send test email template
 * @param req As Request Data
 * @param res As Response Data
 * @return json
 */
const sendTestEmailTemplateValidation = () => {
	return [
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_enter_valid_email_address', { value, location, path });
		}),
	]
}//end sendTestEmailTemplateValidation

/**
 * Function for validate error and return
 * @param req As Request Data
 * @param res As Response Data
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
	addEmailTemplateValidation,
	sendTestEmailTemplateValidation,
	validate,
}
