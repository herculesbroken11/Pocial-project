const { body } = require('express-validator');

/**
 * Function add rewards form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addRewardValidationRules = () => {
	/** Check validation **/
	return [
		body('heading').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.rewards.please_enter_heading', { value, location, path });
		}),
		body('sub_heading').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_enter_sub_heading', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_enter_description', { value, location, path });
		}),
		body('store_type_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_select_store_type', { value, location, path });
		}),
		body('expiry_date').if((value, { req }) => req.body.toogle_expiry_date).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_select_expiry_date', { value, location, path });
		}),
	]
}

module.exports = {
	addRewardValidationRules,
}
