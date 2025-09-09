const async = require('async');

function ScriptedCode() {

	/**
	 * Function used to get scripted code
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getScriptedCode = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";

			// Validate required fields
			if (!userId || !leadFormsSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for generating scripted code
			let optionsData = { 'lead_id': '', 'lead_slug': leadFormsSlug, 'user_id': userId };

			// Generate scripted code using async/await
			const response = await generateScriptedCode(req, res, optionsData);

			finalResponse = {
				'data': {
					status: response.status,
					result: response.result,
					customized_script_id: response.customized_script_id,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getScriptedCode();

	/**
	 * Function used to get last customization scripted code list
	 * Uses async/await for all database queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.lastCustomizationScriptedCodeList = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id and input data from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";
			const uniqueNameSearch = req.body.unique_name_search ? req.body.unique_name_search : "";
			const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);

			// Validate required fields
			if (!userId || !leadFormsSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query condition for customized scripts
			let conditionMatch = {
				user_id: newObjectIdDefault(userId),
				lead_forms_slug: leadFormsSlug
			};
			if (uniqueNameSearch !== '') {
				conditionMatch['unique_name'] = { $regex: new RegExp(uniqueNameSearch, "i") };
			}

			const leadCollection = db.collection(TABLE_LEAD_FORMS);

			// Get lead form data for the given slug and user
			const resultLeadData = await leadCollection.findOne(
				{ slug: leadFormsSlug, user_id: userId },
				{ projection: { _id: 1 } }
			);

			if (!resultLeadData) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Pagination setup
			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			// Run queries in parallel: get list and count
			const [scriptList, totalCount] = await Promise.all([
				// Get customized scripted list
				customizedScript
					.find(conditionMatch, { projection: { slug: 1, lead_forms_id: 1, unique_name: 1 } })
					.sort({ created: SORT_DESC })
					.skip(skip)
					.limit(limit)
					.toArray(),
				// Get total number of records in leads form
				customizedScript.countDocuments(conditionMatch)
			]);

			// Prepare response
			if (scriptList && scriptList.length > 0) {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: scriptList,
						recordsTotal: totalCount,
						limit: limit,
						page: page,
						without_scripted_id_generate_code: WITHOUT_SCRIPTED_ID_GENERATE_SCRIPTED_CODE.replace("{LEAD_ID}", resultLeadData['_id']),
						message: "",
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: [],
						recordsTotal: 0,
						limit: limit,
						page: page,
						without_scripted_id_generate_code: WITHOUT_SCRIPTED_ID_GENERATE_SCRIPTED_CODE.replace("{LEAD_ID}", resultLeadData['_id']),
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End lastCustomizationScriptedCodeList();

	/**
	 * Function used to get customization scripted code details
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.customizationScriptedCodeDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let customizedScriptSlug = req.body.customized_script_slug ? req.body.customized_script_slug : "";

			// Validate required fields
			if (!userId || !customizedScriptSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get the customized script details from the database using async/await
			const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);
			const resultScript = await customizedScript.findOne({
				'user_id': newObjectIdDefault(userId),
				'slug': customizedScriptSlug
			});

			if (resultScript) {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': resultScript,
						'message': "",
					}
				};
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End customizationScriptedCodeDetails();

	/**
	 * Function used to delete customization scripted code
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deleteCustomizationScriptedCode = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const customizedScriptSlug = req.body.customized_script_slug ? req.body.customized_script_slug : "";

			// Validate required fields
			if (!userId || !customizedScriptSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for deleting the script customization
			const options = {
				user_id: userId,
				customized_script_slug: customizedScriptSlug,
			};

			// Delete the script customization using async/await
			const response = await deleteScriptCustomizationDynamically(options);

			if (response === STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						message: res.__("admin.leads.customization_has_been_deleted_successfully"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteCustomizationScriptedCode();

	/**
	 * Function used to get capture lead form fields
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getCaptureLeadFormFields = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id and lead form slug from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";

			// Validate required fields
			if (!userId || !leadFormsSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for dropdown full width fields query
			const options = {
				lead_forms_id: "",
				lead_forms_slug: leadFormsSlug
			};

			// Get full width dropdown fields using async/await
			const fullWidthDropdownTextboxesResponse = await dropdownFullWidthFields(options);

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: fullWidthDropdownTextboxesResponse.result,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getCaptureLeadFormFields();

}
module.exports = new ScriptedCode();
