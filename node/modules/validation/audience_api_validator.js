const { body } = require('express-validator');

/**
 * Function create audience validation rule
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const createAudienceValidationRules = (req, res) => {
	/** Check validation **/
	return [
        body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.audience.please_enter_title', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.audience.please_enter_description', { value, location, path });
		}),
		body('audience_emails').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.audience.please_enter_audience_emails', { value, location, path });
		})
	]
}


/**
 * Function create audience validation rule
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const editAudienceValidationRules = (req, res) => {
	/** Check validation **/
	return [
        body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.audience.please_enter_title', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.audience.please_enter_description', { value, location, path });
		})
	]
}



module.exports = {
	createAudienceValidationRules,
	editAudienceValidationRules
}
