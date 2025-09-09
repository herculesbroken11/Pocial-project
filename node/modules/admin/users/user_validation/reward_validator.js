const { body, validationResult } = require('express-validator');

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
}//end addRewardValidationRules


/**
 * Function edit rewards form validation
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
const editRewardValidationRules = () => {
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
		body('image_temp').if((value, { req }) => (req.files && req.files.image_temp)).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.image_temp && req.files.image_temp.mimetype) ? req.files.image_temp.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
		body('image').if((value, { req }) => (req.files && req.files.image)).custom((value, { req }) => {
			let mimiType1 = (req.files && req.files.image && req.files.image.mimetype) ? req.files.image.mimetype : "";
			if (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(mimiType1) !== -1) {
				return true; // return "non-falsy" value to indicate valid data"
			} else {
				return false; // return "falsy" value to indicate invalid data
			}
		}).withMessage(ALLOWED_IMAGE_ERROR_MESSAGE),
	]
}//end editRewardValidationRules

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
	addRewardValidationRules,
	editRewardValidationRules,
	validate,
}
