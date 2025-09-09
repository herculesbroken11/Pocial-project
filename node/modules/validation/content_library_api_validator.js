const { body } = require('express-validator');

/**
 * Function get content library validation rule
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const getContentLibraryValidationRules = (req, res) => {
	/** Check validation **/
	return [
		body('unique_ai_browser_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.content_library.please_enter_unique_ai_browser_id', { value, location, path });
		}),
		body('website_url').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.content_library.please_enter_website_url', { value, location, path });
		}).custom((value) => {
			const urlRegex = /^(https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(:[0-9]{1,5})?(\/[^\s]*)?$/;
			if (!urlRegex.test(value)) {
				// Throw an error if the value does not match the regex
				throw new Error('The website URL is not valid.');
			}
			return true;
		}).withMessage((value, { req, location, path }) => {
			return req.__('admin.content_library.please_enter_a_valid_website_url', { value, location, path });
		})
	]
}



/**
 * Function get content library validation rule
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const getFallbackDataValidationRules = (req, res) => {
	/** Check validation **/
	return [
		body('unique_ai_browser_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.content_library.please_enter_unique_ai_browser_id', { value, location, path });
		}),
		body('website_email').if((value, { req }) => req.body && req.body.website_email != "").notEmpty().withMessage((value, { req, location, path }) => {
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
		body('business_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.content_library.please_enter_business_name', { value, location, path });
		}),
		body('ai_business_industry_names').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.content_library.please_enter_business_industry', { value, location, path });
		}),
	]
}


/**
 * Function create social post manually validations rules
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const createPostManuallyValidationRules = () => {
	/** Check validation **/
	return [
		body('title').if((value, { req }) => !req.body.group_id).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.content_library.please_enter_social_post_title', { value, location, path });
		}),

		body('caption').if((value, { req }) => !req.body.group_id && req.body?.type !== AI_RESPONSE_TYPE_SOCIAL_STORY).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.content_library.please_enter_social_post_caption', { value, location, path });
		}),
	]
}

module.exports = {
	getContentLibraryValidationRules,
	createPostManuallyValidationRules,
	getFallbackDataValidationRules
}
