const { body } = require('express-validator');

/**
 * Function create poll segment validation
 * 
 * @return json
 */
const addAssumptionReportValidation = () => {
	/** Check validation **/
	return [
		body('report_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.poll_performance.please_enter_report_name', { value, location, path });
		}),
		
		body('report_description').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.poll_performance.please_enter_report_description', { value, location, path });
		}),
	]
}


module.exports = {
	addAssumptionReportValidation,	
}
