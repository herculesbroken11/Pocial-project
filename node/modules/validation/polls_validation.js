const { body } = require('express-validator');

/**
 * Function create polls options and question
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const createPollsOptionsValidation = (req, res) => {
	return [
		body('question').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_question', { value, location, path });
		}).isLength({ max: POLLS_QUESTION_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.question_length_should_maximum_digits', POLLS_QUESTION_LIMIT, { value, location, path });
		}),

		body('options_type').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_select_options_type', { value, location, path });
		}),

		body('is_question_updatte').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_select_is_question_updatte', { value, location, path });
		}),

		body('options_title').if((value, { req }) => (req.body.is_question_updatte == false || req.body.is_question_updatte == 'false')).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads.please_enter_poll_options_title', { value, location, path });
		}).isLength({ max: POLLS_OPTIONS_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.options_length_should_maximum_digits', POLLS_OPTIONS_LIMIT, { value, location, path });
		}).custom((value, { req, location, path }) => {
			/** condition already use data */
			let optionsConditions = {
				'user_id': (req.user_data && req.user_data._id) ? req.user_data._id : "",
				'poll_slug': (req.body.poll_slug) ? req.body.poll_slug : '',
				'options_title': (req.body.options_title) ? req.body.options_title : "",
			}
			return samePollsOptionsCheck(req, res, optionsConditions).then(user => {
				if (user.status == STATUS_SUCCESS) {
					return Promise.reject(req.__('admin.polls.your_options_is_already_exist', { value, location, path }));
				}
			});
		}),
	]
}


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
		body('question').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_question', { value, location, path });
		}).isLength({ max: POLLS_QUESTION_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.question_length_should_maximum_digits', POLLS_QUESTION_LIMIT, { value, location, path });
		}),

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
				slug: (req.body.poll_slug) ? req.body.poll_slug : '',
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
		body('sponsored_link').if((value, { req }) => (req.body.sponsored_link)).isURL().withMessage((value, { req, location, path }) => {
			return req.__('admin.system.you_are_using_invalid_url', { value, location, path });
		}),
		body('sponsored_text').if((value, { req }) => (req.body.sponsored_text)).isLength({ max: SPONSORED_TEXT_LIMIT }).withMessage((value, { req, location, path }) => {
			return req.__('front.polls.sponsored_text_length_should_maximum_digits', SPONSORED_TEXT_LIMIT, { value, location, path });
		}),
		body('schedule_end_date').if((value, { req }) => req.body.schedule_end_date_type == SCHEDULE_END_DATE_ON).notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.polls.please_select_end_date', { value, location, path });
		}),
	]
}

/**
 * Function for use to send comment poll
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const sendCommentPollsValidation = () => {
	/** Check validation **/
	return [
		body('poll_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_id', { value, location, path });
		}),
		body('poll_slug').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_slug', { value, location, path });
		}),
		body('make_poll_user_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_make_poll_user_id', { value, location, path });
		}),
		body('comment').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_comments', { value, location, path });
		}),
	]
}

/**
 * Function for use vote Participants Validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const voteParticipantsValidation = () => {
	/** Check validation **/
	return [
		body('poll_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_id', { value, location, path });
		}),
		body('unique_browser_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_unique_browser_id', { value, location, path });
		}),
		body('poll_slug').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_slug', { value, location, path });
		}),
		body('option_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_option_id', { value, location, path });
		}),
		body('custom_url').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_custom_url', { value, location, path });
		}),
	]
}

/**
 * Function for use report Abuse Validation
 * 
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const reportAbuseValidation = () => {
	/** Check validation **/
	return [
		body('poll_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_id', { value, location, path });
		}),
		body('make_poll_user_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_make_poll_user_id', { value, location, path });
		}),
		body('poll_slug').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_slug', { value, location, path });
		}),
		body('report_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_report_id', { value, location, path });
		}),
	]
}

/**
 * Function for use report Abuse poll abuse commnet Validation
 * 
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const reportAbusePollCommentValidation = () => {
	/** Check validation **/
	return [
		body('poll_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_id', { value, location, path });
		}),
		body('make_poll_user_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_make_poll_user_id', { value, location, path });
		}),
		body('poll_slug').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_poll_slug', { value, location, path });
		}),
		body('report_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_report_id', { value, location, path });
		}),
		body('comment_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.polls.please_enter_comment_id', { value, location, path });
		}),
	]
}


/**
 * Function for use to same option check in polls
 *
 * @param value As email value
 * @param req As Request Data
 *
 * @return json
 */
sameNewPollsOptionsCheck = (req, res, options) => {
	let userId = (options.user_id) ? ObjectId(options.user_id) : "";
	let optionsTitle = (options.options_title) ? options.options_title : "";
	let pollSlug = (options.poll_slug) ? options.poll_slug : "";

	return new Promise(resolve => {
		db.collection(TABLE_POLL_NEW).findOne({
			'user_id': userId,
			'slug': pollSlug,
			'options': { $elemMatch: { title: { $regex: "^" + optionsTitle + "$", $options: "i" } } }
		}, { projection: { _id: 1 } }, (err, optionData) => {
			optionData = optionData ? optionData : {};

			/** Send response **/
			if (!err && Object.keys(optionData).length > 0) {
				response = {
					status: STATUS_SUCCESS,
					result: optionData,
				};
				return resolve(response);
			} else {
				response = {
					status: STATUS_ERROR,
					result: optionData,
				};
				return resolve(response);
			}
		})
	});
}
module.exports = {
	createPollsOptionsValidation,
	createPollsValidation,
	sendCommentPollsValidation,
	voteParticipantsValidation,
	reportAbuseValidation,
	reportAbusePollCommentValidation
}
