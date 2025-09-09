function EmbededIframe() {

	/** 
	 * Function to get lead embedded data using async/await for faster response.
	 **/
	this.getCompletePackageData = async (req, res) => {
		let finalResponse = {};
		try {
			// Get lead package ID from request params
			const leadPackageId = (req.params.lead_package_id) ? newObjectIdDefault(req.params.lead_package_id) : "";
			const leadCollection = db.collection(TABLE_LEAD_FORMS);

			// Validate leadPackageId
			if (!leadPackageId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						image_url: LEADS_FORM_URL,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch lead package data from DB
			const result = await leadCollection.findOne({ _id: leadPackageId });

			if (result) {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						result: result,
						message: ""
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						image_url: LEADS_FORM_URL,
						result: {},
						message: res.__("front.embeded.invalid_package_try_another_package"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					image_url: LEADS_FORM_URL,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getCompletePackageData();

	/**
	 * Function to upload background image using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.uploadBackgroundImage = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and image details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadId = req.body.lead_forms_id ? req.body.lead_forms_id : "";
			const image = (req.files && req.files.background_image) ? req.files.background_image : "";

			// Validate required fields
			if (!userId || !leadId || !image) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let errMessageArray = [];
			const options = {
				'image': image,
				'filePath': BACKGROUND_IMAGE_FILE_PATH,
				'lead_id': leadId,
				'user_id': userId,
			};

			// Upload background image using async/await
			const uploadImageUrl = await uplaodEmbedBackgroundImage(req, res, options);

			// Handle upload errors
			if (uploadImageUrl.status === STATUS_ERROR) {
				errMessageArray.push({ 'param': 'background_image', 'message': uploadImageUrl.message });
			}
			if (uploadImageUrl.status === STATUS_ERROR_INVALID_ACCESS) {
				errMessageArray.push({ 'param': 'background_image', 'message': uploadImageUrl.message });
			}

			if (errMessageArray.length > 0) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: parseValidationFrontApi(errMessageArray, req),
						message: "Errors",
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: uploadImageUrl.result,
						message: ""
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end uploadBackgroundImage();

}
module.exports = new EmbededIframe();
