const async = require('async');

function LeadExcel() {

	/** 
	 * Function to get column names from uploaded Excel file.
	 * Uses async/await for clean, fast response and error handling.
	 **/
	this.getColumnName = async (req, res) => {
		let finalResponse = {};

		// Extract user/session details
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const userImportFile = (req.files && req.files.user_import_file) ? req.files.user_import_file : "";
		const title = req.body.title ? req.body.title : "";

		// Validate required fields
		if (!userId || !userImportFile || !title) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Await the Excel column extraction (single async query)
			const responseFile = await getExcelFirstColumnData(req, res);

			if (responseFile.status === STATUS_SUCCESS) {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						email_column_index: USER_LEAD_FIXED_EMAIL_COLUMN_INDEX,
						ignore_column: USER_LEAD_FIXED_IGNORE_CHECKBOX_VALUE,
						extension: responseFile.extension,
						file_name: responseFile.file_name,
						fixed_column: USER_LEAD_FIXED_COLUMN_NAME,
						result: responseFile.result,
						excel_lead_forms_id: loginUserData.excel_lead_forms_id ? loginUserData.excel_lead_forms_id : "",
						message: responseFile.message
					}
				};
			} else {
				// Send error response
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						email_column_index: USER_LEAD_FIXED_EMAIL_COLUMN_INDEX,
						ignore_column: USER_LEAD_FIXED_IGNORE_CHECKBOX_VALUE,
						extension: responseFile.extension,
						file_name: responseFile.file_name,
						fixed_column: USER_LEAD_FIXED_COLUMN_NAME,
						excel_lead_forms_id: loginUserData.excel_lead_forms_id ? loginUserData.excel_lead_forms_id : "",
						result: {},
						message: responseFile.message
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getColumnName();

	/**
	 * Function to save imported file data in the database.
	 * Uses async/await for clean, fast response and error handling.
	 */
	this.saveImportFile = async (req, res) => {
		let finalResponse = {};

		// Extract user data and validate userId
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Extract request body parameters
		const title = req.body.title || "";
		const extension = req.body.extension || "";
		const fileName = req.body.file_name || "";
		const columnArray = req.body.column || [];
		const leadId = req.body.lead_id || "";
		const columnName = req.body.column_name || [];
		const sendWelcomeEmail = req.body.send_welcome_email || IMPORT_LEADS_WELCOME_EMAIL_NO_STATUS;
		const checkboxIgnoreColumnArray = req.body.ignore_column || [];
		const combineFirstNameToggle = req.body.combine_first_name_toggle || false;

		// Prepare options for DB save
		const options = {
			title: title,
			file_name: fileName,
			extension: extension,
			column: columnArray,
			column_name: columnName,
			ignore_column: checkboxIgnoreColumnArray,
			send_welcome_email: sendWelcomeEmail,
			user_id: userId,
			lead_id: leadId,
			combine_first_name_toggle: combineFirstNameToggle,
			upload: UPLOAD_FRONTEND_LEAD_EXCEL,
		};

		try {
			// Await the DB save operation (single async query)
			const responseFile = await leadImportFileDataSaveInDB(req, res, options);

			if (responseFile.status === STATUS_SUCCESS) {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: responseFile.message
					}
				};
			} else {
				// Send error response
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: responseFile.message
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end saveImportFile();

	/**
	 * Function to get lead excel upload data
	 *
	 * @return json 
	 **/
	this.getImportFileList = async (req, res) => {
		let finalResponse = {};

		// Extract user id from session
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Pagination and filter parameters
		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const isProcess = req.body.is_process ? req.body.is_process : "";
		const title = req.body.title ? req.body.title : "";

		const skip = (limit * page) - limit;

		const leadExcel = db.collection(TABLE_LEADS_IMPORT);
		let conditions = {
			user_id: newObjectIdDefault(userId),
		};

		// Add search filters if provided
		if (isProcess) {
			conditions['is_process'] = isProcess;
		}
		if (title) {
			conditions['title'] = { $regex: new RegExp(title, "i") };
		}

		try {
			// Run both queries in parallel for faster response
			const [result, totalRecord] = await Promise.all([
				// Get paginated list of import lead excel forms
				leadExcel
					.find(conditions)
					.collation(COLLATION_VALUE)
					.sort({ "created": SORT_DESC })
					.limit(limit)
					.skip(skip)
					.toArray(),
				// Get total number of records matching the conditions
				leadExcel.countDocuments(conditions)
			]);

			if (result && result.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						import_url: LEADS_EXCEL_URL,
						result: result,
						recordsTotal: totalRecord,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						import_url: LEADS_EXCEL_URL,
						result: [],
						recordsTotal: 0,
						limit: limit,
						page: page,
						message: res.__("front.global.no_record_found"),
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("admin.system.something_going_wrong_please_try_again"),
					limit: limit,
					page: page,
					import_url: LEADS_EXCEL_URL,
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getImportFileList();

	/**
	 * Function to import file logs details
	 *
	 * @return json 
	 **/
	this.importFileLogsDetails = async (req, res) => {
		let finalResponse = {};

		// Get user/session details
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let importSlug = req.body.import_slug ? req.body.import_slug : "";
		let email = req.body.email ? req.body.email : "";
		let emailStatusSearch = req.body.email_status_search ? req.body.email_status_search : "";

		// Validate required fields
		if (!userId || !importSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let page = req.body.page ? parseInt(req.body.page) : 1;
		let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		let skip = (limit * page) - limit;

		const leadsImport = db.collection(TABLE_LEADS_IMPORT);
		const leadExcelLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);

		let conditions = {
			user_id: newObjectIdDefault(userId),
			csv_import_slug: importSlug
		};

		// Add search filters if provided
		if (email) {
			conditions['email'] = { $regex: new RegExp(email, "i") };
		}
		if (emailStatusSearch) {
			conditions['send_welcome_email'] = emailStatusSearch;
		}

		try {
			// Run all DB queries in parallel for faster response
			const [
				logsResult, // List of import lead excel logs
				totalCount, // Total number of records
				importDetails // Import file details (failed reason, etc.)
			] = await Promise.all([
				// Get import lead excel logs form list
				leadExcelLogs.find(conditions)
					.collation(COLLATION_VALUE)
					.sort({ "created": SORT_DESC })
					.limit(limit)
					.skip(skip)
					.toArray(),
				// Get total number of records in import lead excel form
				leadExcelLogs.countDocuments(conditions),
				// Get import file failed reason and details
				leadsImport.findOne(
					{ slug: importSlug },
					{ projection: { failed_reason: 1, file_name: 1, warning_records: 1, title: 1, failed_records: 1 } }
				)
			]);

			const leadsImportDetails = importDetails ? importDetails : {};
			const leadsImportFailedReasonData = leadsImportDetails && leadsImportDetails.failed_reason ? leadsImportDetails.failed_reason : "";
			const failedReasonColumnShowData = leadsImportDetails && leadsImportDetails.warning_records == 0 && leadsImportDetails.failed_records == 0 ? false : true;
			const importLeadTitleName = leadsImportDetails && leadsImportDetails.title ? leadsImportDetails.title : "";

			if (logsResult && logsResult.length > 0) {
				const totalRecord = totalCount ? totalCount : 0;
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						import_url: LEADS_EXCEL_URL,
						result: logsResult,
						recordsTotal: totalCount,
						limit: limit,
						page: page,
						message: "",
						leadsImportFailedReason: "",
						failedReasonColumnShow: failedReasonColumnShowData,
						import_lead_file_name: importLeadTitleName,
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						import_url: LEADS_EXCEL_URL,
						result: [],
						recordsTotal: 0,
						limit: limit,
						page: page,
						leadsImportFailedReason: leadsImportFailedReasonData,
						failedReasonColumnShow: failedReasonColumnShowData,
						import_lead_file_name: importLeadTitleName,
						message: res.__("front.global.no_record_found"),
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("admin.system.something_going_wrong_please_try_again"),
					limit: limit,
					page: page,
					import_url: LEADS_EXCEL_URL,
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end importFileLogsDetails();

	/** 
	 * Function to delete uploaded import lead file.
	 * Uses async/await for clean, fast response and error handling.
	 **/
	this.deleteUploadImportFile = async (req, res) => {
		let finalResponse = {};

		// Extract user/session details
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const csvImportSlug = req.body.csv_import_slug ? req.body.csv_import_slug : "";

		// Validate required fields
		if (!userId || !csvImportSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for deletion
		const optionsFile = {
			user_id: userId,
			csv_import_slug: csvImportSlug,
		};

		try {
			// Await the delete operation (single async query)
			const deleteResponse = await deletePendingImportExcelFile(req, res, optionsFile);

			if (deleteResponse === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.leads_file.file_process_is_running_sorry_this_file_cant_be_deleted")
					}
				};
			} else {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: res.__("front.leads_file.you_have_successfully_deleted_your_uploaded_file"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end deleteUploadImportFile();

	/**
	 * Function to get lead import data by slug.
	 * Uses async/await for clean, fast response and error handling.
	 *
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 */
	this.leadsImportDetails = async (req, res) => {
		let finalResponse = {};

		// Extract user/session details
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const csvImportSlug = req.body.csv_import_slug ? req.body.csv_import_slug : "";

		// Validate required fields
		if (!userId || !csvImportSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const leadImport = db.collection(TABLE_LEADS_IMPORT);

		try {
			// Await the DB query for the import details (single async query)
			const result = await leadImport.findOne(
				{ slug: csvImportSlug },
				{ projection: { all_column_value: 1, file_name: 1, title: 1 } }
			);

			if (!result) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: [],
						import_lead_file_name: "",
						message: res.__("front.global.no_record_found"),
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						import_lead_file_name: result.title ? result.title : "",
						result: result,
						message: "",
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					import_lead_file_name: "",
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end leadsImportDetails();

	/**
	 * Function to send import lead welcome mail using async/await.
	 * Ensures clean, fast response and error handling.
	 *
	 * @return json 
	 **/
	this.importLeadsSendWelcomeMail = async (req, res) => {
		let finalResponse = {};

		// Extract user/session details
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const leadsImportLogsArrayIds = req.body.leads_import_logs_ids ? req.body.leads_import_logs_ids : [];

		// Validate required fields
		if (!userId || leadsImportLogsArrayIds.length === 0) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Await sending welcome emails for selected excel lead logs ids
			await sendWelcomeEmailsSelectedIds(req, res, leadsImportLogsArrayIds);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.leads_file.welcome_mail_has_been_send_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end importLeadsSendWelcomeMail();

	/**
	 * Function to get the welcome email id assigned to a lead form by slug.
	 * Uses async/await for clean, fast response and error handling.
	 *
	 * @param req
	 * @param res
	 * @return json
	 */
	this.leadSlugAccourdingAttachWelcomeEmail = async (req, res) => {
		let leadSlug = req.body.lead_slug ? req.body.lead_slug : '';
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		let finalResponse = {};

		// Validate required field
		if (!leadSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Await the DB query to fetch the welcome email id for the given slug
			const welcomeResult = await leadsForms.findOne(
				{ slug: leadSlug },
				{ projection: { assign_welcome_email_id: 1 } }
			);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					assign_welcome_email_id: (welcomeResult && welcomeResult.assign_welcome_email_id) ? welcomeResult.assign_welcome_email_id : "",
					message: ''
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					assign_welcome_email_id: "",
					message: res.__("system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end leadSlugAccourdingAttachWelcomeEmail();

}
module.exports = new LeadExcel();
