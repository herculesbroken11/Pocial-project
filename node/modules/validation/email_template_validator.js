const { body } = require('express-validator');


/**
 * Function add email tempalte validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addEmailTemplateValidationRules = () => {
	/** Check validation **/
	return [
		body('template_title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_template_title', { value, location, path });
		}),
		body('page_body').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_page_body', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_description', { value, location, path });
		}),
		body('subject').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_subject', { value, location, path });
		}),
		body('from').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_from', { value, location, path });
		}),
		body('from_email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.email_template.please_enter_from_email', { value, location, path });
		}),
		body('attach_reward').if((value, { req }) => req.body.template_type != EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_select_attach_reward', { value, location, path });
		}),
		body('template_type').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_template_type', { value, location, path });
		}),
		body('design_json').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_design_json', { value, location, path });
		}),
		body('port').if((value, { req }) => req.body.host).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_port', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}),
		body('host').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_host', { value, location, path });
		}),
		body('email_password').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_email_password', { value, location, path });
		}),
	]
}

/**
 * Function send email tempalte validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const sendTestEmailTemplateValidationRules = () => {
	return [
		body('page_body').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_page_body', { value, location, path });
		}),
		body('email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.email_template.please_enter_from_email', { value, location, path });
		}).isEmail().withMessage((value, { req, location, path }) => {
			return req.__('admin.email_template.please_enter_valid_email_address', { value, location, path });
		}),
	]
}

/**
 * Function check validaion smtp email smtp verify
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const smtpVerifyValidationRules = () => {
	/** Check validation **/
	return [
		body('from_email').if((value, { req }) => !req.body.skip_smtp).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.email_template.please_enter_from_email', { value, location, path });
		}),

		body('port').if((value, { req }) => !req.body.skip_smtp).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_port', { value, location, path });
		}).isNumeric().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}).isInt().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.invalid_number', { value, location, path });
		}),

		body('host').if((value, { req }) => !req.body.skip_smtp).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_host', { value, location, path });
		}),

		body('email_password').if((value, { req }) => !req.body.skip_smtp).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.email_template.please_enter_email_password', { value, location, path });
		}),
	]
}

module.exports = {
	addEmailTemplateValidationRules,
	sendTestEmailTemplateValidationRules,
	smtpVerifyValidationRules,
}
