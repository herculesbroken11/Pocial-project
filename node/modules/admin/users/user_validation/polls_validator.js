const { body, validationResult } = require('express-validator');

/**
 * Function create polls options and question
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const createPollsOptionsValidation = (req, res) => {
	/** Check validation **/
	return [
		body('question').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_question', { value, location, path });
		}).isLength({ max: POLLS_QUESTION_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.question_length_should_maximum_digits', POLLS_QUESTION_LIMIT, { value, location, path });
		}),

		body('is_question_updatte').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_select_is_question_updatte', { value, location, path });
		}),

		body('options_type').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_select_options_type', { value, location, path });
		}),

		body('options_title').if((value, { req }) => req.body.is_question_updatte == 'false').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_enter_poll_options_title', { value, location, path });
		}).isLength({ max: POLLS_OPTIONS_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.options_length_should_maximum_digits', POLLS_OPTIONS_LIMIT, { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use data */
			let optionsConditions = {
				user_id: (req.params.user_id) ? req.params.user_id : "",
				poll_slug: (req.params.slug) ? req.params.slug : "",
				options_title: (req.body.options_title) ? req.body.options_title : "",
			}
			return samePollsOptionsCheck(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.polls.your_options_is_already_exist', { value, location, path }));
				}
			});
		})
	]
}//end createPollsOptionsValidation

/**
 * Function create polls validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const createPollsValidation = (req, res) => {
	/** Check validation **/
	return [
		body('category_id').if((value, { req }) => (req.body.is_draft != POLL_DRAFT)).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_select_choose_category', { value, location, path });
		}),

		body('is_draft').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_is_draft', { value, location, path });
		}),

		body('is_published').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_is_published', { value, location, path });
		}),

		body('custom_url').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_custom_url', { value, location, path });
		}).isLength({ max: POLLS_CUSTOM_URL_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.custom_url_length_should_maximum_digits', POLLS_CUSTOM_URL_LIMIT, { value, location, path });
		}).custom(value => !/\s/.test(value)).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.no_spaces_are_allowed_in_the_url', { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use data */
			let optionsConditions = {
				custom_url: value,
				slug: (req.params.slug) ? req.params.slug : '',
			}
			return uniqueCustomUrlCheck(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('front.polls.your_url_is_already_exist', { value, location, path }));
				}
			});
		}),

		body('real_time_result').if((value, { req }) => (req.body.real_time == 'false' || req.body.real_time == false || req.body.real_time == undefined)).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_real_time_result', { value, location, path });
		}),

		body('sponsored_temp').if((value, { req }) => req.files && req.files.sponsored_temp).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.sponsored_temp && req.files.sponsored_temp.mimetype) ? req.files.sponsored_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),

		body('sponsored_link').if((value, { req }) => (req.body.sponsored_link)).isURL().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.you_are_using_invalid_url', { value, location, path });
		}),

		body('sponsored_text').if((value, { req }) => (req.body.sponsored_text)).isLength({ max: SPONSORED_TEXT_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.sponsored_text_length_should_maximum_digits', SPONSORED_TEXT_LIMIT, { value, location, path });
		}),

		body('schedule_end_date').if((value, { req }) => req.body.schedule_end_date_type == SCHEDULE_END_DATE_ON).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.polls.please_select_end_date', { value, location, path });
		}),
		body('schedule_start_date').if((value, { req }) => req.body.schedule_end_date_type == SCHEDULE_END_DATE_ON).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.polls.please_select_start_date', { value, location, path });
		}),
	]
}//end createPollsValidation

/**
 * Function embed generate validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addEmbedValidationRules = () => {
	/** Check validation **/
	return [
		body('embed_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_embed_name', { value, location, path });
		}).isLength({ max: EMBED_NAME_MAXIMUM_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.embed_length_should_maximum_digits', EMBED_NAME_MAXIMUM_LIMIT, { value, location, path });
		}),
	]
}//end addEmbedValidationRules

/**
 * Function add rewards form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const addRewardValidation = () => {
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
		body('dd').if((value, { req }) => req.body.toogle_expiry_date).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_date', { value, location, path });
		}),
		body('mm').if((value, { req }) => req.body.toogle_expiry_date).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_month', { value, location, path });
		}),
		body('yy').if((value, { req }) => req.body.toogle_expiry_date).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.user.please_select_year', { value, location, path });
		}),
		body('store_type_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_select_store_type', { value, location, path });
		}),
		body('image').if((value, { req }) => req.files && req.files.image).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.image && req.files.image.mimetype) ? req.files.image.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
		body('image_temp').if((value, { req }) => (req.files && req.files.image_temp)).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.image_temp && req.files.image_temp.mimetype) ? req.files.image_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
	]
}//end addRewardValidation


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
	createPollsOptionsValidation,
	createPollsValidation,
	addEmbedValidationRules,
	addRewardValidation,
	validate,
}
