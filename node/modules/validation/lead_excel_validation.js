const { body } = require('express-validator');


/**
 * Function for save import excel file validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const saveImportFileValidation = () => {
	return [
		body('title').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('admin.leads_file.please_enter_title', { value, location, path });
		}),
		body('file_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads_file.please_enter_file_name', { value, location, path });
		}),
		body('extension').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads_file.please_enter_extension', { value, location, path });
		}),
		body('column_name').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads_file.please_select_column_name', { value, location, path });
		}),
		body('send_welcome_email').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads_file.please_select_send_welcome_email', { value, location, path });
		}),
		body('column').custom((value, { req, location, path }) => {
			let columnLength = (req.body.column) ? (req.body.column).length : [];
			if (columnLength == USER_LEAD_FIXED_COLUMN_LENGTH || columnLength == USER_LEAD_FIXED_COLUMN_ONLY_NAME_LENGTH) {
				return true;
			} else {
				return Promise.reject(req.__('front.leads_file.please_select_all_column', { value, location, path }));
				// return true;
			}
		}),
		body('lead_id').notEmpty().withMessage((value, { req, location, path }) => {
			return req.__('front.leads_file.please_enter_lead_id', { value, location, path });
		}),
	]
}


module.exports = {
	saveImportFileValidation,
}
