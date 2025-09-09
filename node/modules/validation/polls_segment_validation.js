const { body } = require('express-validator');

/**
 * Function create poll segment validation
 * 
 * @return json
 */
const cratePollSegmentValidation = () => {
	return [
		body('segment_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.poll_segment.please_enter_segment_name', { value, location, path });
		}),

		body('segment_description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.poll_segment.please_enter_segment_description', { value, location, path });
		}),
	]
}

module.exports = {
	cratePollSegmentValidation,
}
