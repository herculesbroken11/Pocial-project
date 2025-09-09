const { body, validationResult } = require('express-validator');

/**
 * Function add pollsets form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addPollSetValidationRules = () => {
	/** Check validation **/
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_title', { value, location, path });
		}),
		body('category').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_select_category', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_description', { value, location, path });
		}),
		body('reward_description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_reward_description', { value, location, path });
		})
	]
}//end addPollSetValidationRules

/**
 * Function edit pollsets form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const editPollSetValidationRules = () => {
	/** Check validation **/
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_title', { value, location, path });
		}),
		body('category').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_select_category', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_description', { value, location, path });
		}),
		body('reward_description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_reward_description', { value, location, path });
		})
	]
}//end editPollSetValidationRules

/**
 * Function add pollsegment form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addPollSegmentValidationRules = () => {
	/** Check validation **/
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_title', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.users.pollsets.please_enter_description', { value, location, path });
		})
	]
}


/**
 * Function add pollsegment form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addAssumptionValidationRules = () => {
	/** Check validation **/
	return [
		body('report_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('performance.error_report_name_is_required', { value, location, path });
		}),
		body('description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('performance.error_report_desc_required', { value, location, path });
		})
	]
}//end addPollSegmentValidationRules

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
	addPollSetValidationRules,
	editPollSetValidationRules,
	addPollSegmentValidationRules,
	addAssumptionValidationRules,
	validate,
}
