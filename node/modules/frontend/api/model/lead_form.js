const async = require('async');
const { renderFile } = require('ejs');
const moment = require('moment');

function LeadForm() {

	/**
	 * Function to create lead capture form
	 *
	 * @return json 
	 **/
	this.createLeadCaptureForm = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;

			// Permission check
			if (!userId || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract form fields
			const title = req.body.title ? req.body.title : "";
			const description = req.body.description ? req.body.description : "";
			const textDisplay = req.body.text_to_display ? req.body.text_to_display : "";
			const displayUrlDescription = req.body.display_url_description ? req.body.display_url_description : "";
			const signinOption = req.body.signin_option ? req.body.signin_option : SIGNIN_OPTION_NO;
			const kioskOption = req.body.kiosk_option ? req.body.kiosk_option : KIOSK_OPTION_NO;
			const signupFields = req.body.signup_fields ? req.body.signup_fields : [];
			const mandatoryOptions = req.body.mandatory_options ? req.body.mandatory_options : [];
			const buttonName = req.body.button_name ? req.body.button_name : "";
			const messageBoxTitle = req.body.message_box_title ? req.body.message_box_title : [];
			const typeDropdownTitle = req.body.type_dropdown_title ? req.body.type_dropdown_title : [];
			const formTitle = req.body.form_title ? req.body.form_title : "";
			const notifyEmail = req.body.notify_email ? req.body.notify_email : [];
			const customThankYouTitle = req.body.custom_thank_you_title ? req.body.custom_thank_you_title : "";
			const customThankYouMessage = req.body.custom_thank_you_message ? req.body.custom_thank_you_message : "";
			const assignWelcomeEmailId = req.body.assign_welcome_email_id ? newObjectIdDefault(req.body.assign_welcome_email_id) : "";
			const notifyEmailType = req.body.notify_email_type ? req.body.notify_email_type : "";
			const notifyEmailSendType = (notifyEmailType == LEAD_CAMPAIGN_NOTIFY_EMAIL_ALL) ? req.body.notify_email_send_type : [];
			const pageType = req.body.page_type ? req.body.page_type : "";

			const imageUrl = req.body.image_url ? req.body.image_url : "";
			const image = (req.files && req.files.image) ? req.files.image : "";

			let imageUrlName = "";
			let errMessageArray = [];

			// Validate: both image and image url cannot be provided
			if (imageUrl !== "" && image) {
				errMessageArray.push({ param: 'image', msg: res.__("front.leads.please_select_image") });
				finalResponse = {
					data: {
						status: STATUS_ERROR_FORM_VALIDATION,
						errors: errMessageArray,
						message: errMessageArray,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare image upload promises
			let imageUploadPromise = null;
			let imageUrlUploadPromise = null;

			// If imageUrl is provided, upload image from URL
			if (imageUrl !== "") {
				const optionsImage = {
					url: imageUrl,
					dest: LEADS_FORM_FILE_PATH,
				};
				imageUrlUploadPromise = downloadImageToUrl(res, req, optionsImage);
			}

			// If image file is provided, upload the file
			if (image) {
				const options = {
					image: image,
					filePath: LEADS_FORM_FILE_PATH,
				};
				imageUploadPromise = moveUploadedFile(req, res, options);
			}

			// Run image uploads in parallel if both are present (should not happen due to validation)
			let imageUrlResponse = null;
			let imageFileResponse = null;

			if (imageUrlUploadPromise && imageUploadPromise) {
				// Should not happen, but handle gracefully
				[imageUrlResponse, imageFileResponse] = await Promise.all([imageUrlUploadPromise, imageUploadPromise]);
			} else if (imageUrlUploadPromise) {
				imageUrlResponse = await imageUrlUploadPromise;
			} else if (imageUploadPromise) {
				imageFileResponse = await imageUploadPromise;
			}

			// Handle image URL upload error
			if (imageUrlResponse && imageUrlResponse.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: {},
						message: imageUrlResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle image file upload error
			if (imageFileResponse && imageFileResponse.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: {},
						message: imageFileResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Determine image name and type
			const imageName = imageFileResponse && imageFileResponse.fileName ? imageFileResponse.fileName : "";
			imageUrlName = imageUrlResponse && imageUrlResponse.fileName ? imageUrlResponse.fileName : "";

			let imageSaveName = imageUrlName !== "" ? imageUrlName : imageName;
			let graphicTypeName = imageUrlName !== "" ? URL_IMAGE : (imageName !== "" ? UPLOAD_IMAGE : "");

			if (imageUrlName === "" && imageName === "") {
				imageSaveName = "";
				graphicTypeName = "";
			}

			// Prepare lead form data
			const optionLeads = {
				user_id: newObjectIdDefault(userId),
				title: title,
				description: description,
				text_to_display: textDisplay,
				display_url_description: displayUrlDescription,
				signin_option: signinOption,
				kiosk_option: kioskOption,
				signup_fields: signupFields,
				button_name: buttonName,
				mandatory_options: mandatoryOptions,
				message_box_title: messageBoxTitle,
				type_dropdown_title: typeDropdownTitle,
				message_field_count: messageBoxTitle.length,
				dropdown_field_count: typeDropdownTitle.length,
				form_title: formTitle,
				notify_email: notifyEmail,
				notify_email_type: notifyEmailType,
				notify_email_send_type: notifyEmailSendType,
				image: imageSaveName,
				graphic_type: graphicTypeName,
				custom_thank_you_title: customThankYouTitle,
				custom_thank_you_message: customThankYouMessage,
				assign_welcome_email_id: assignWelcomeEmailId,
				page_type: pageType
			};

			// Save lead form (single async DB query)
			const saveLeadResponseId = await saveLeadCaptureForm(req, res, optionLeads);

			// Send success response
			const insertedId = saveLeadResponseId ? saveLeadResponseId : "";
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					insertedId: insertedId,
					message: (pageType == CONTEST_PAGE_TYPE)
						? res.__("front.leads.contest_form_has_been_submitted_successfully")
						: res.__("front.leads.leads_form_has_been_submitted_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End createLeadCaptureForm()

	/**
	 * Function to edit lead capture form (async/await version)
	 *
	 * @return json 
	 **/
	this.editLeadCaptureForm = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			const leadId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
			const afterSubscriberUser = req.body.after_subscriber_user ? ACTIVE : DEACTIVE;
			const assignWelcomeEmailId = req.body.assign_welcome_email_id ? newObjectIdDefault(req.body.assign_welcome_email_id) : "";

			// Permission check
			if (!userId || !leadId || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract form fields
			const title = req.body.title ? req.body.title : "";
			const description = req.body.description ? req.body.description : "";
			const textDisplay = req.body.text_to_display ? req.body.text_to_display : "";
			const displayUrlDescription = req.body.display_url_description ? req.body.display_url_description : "";
			const signinOption = req.body.signin_option ? req.body.signin_option : SIGNIN_OPTION_NO;
			const kioskOption = req.body.kiosk_option ? req.body.kiosk_option : KIOSK_OPTION_NO;
			const signupFields = req.body.signup_fields ? req.body.signup_fields : [];
			const mandatoryOptions = req.body.mandatory_options ? req.body.mandatory_options : [];
			const buttonName = req.body.button_name ? req.body.button_name : "";
			const messageBoxTitle = req.body.message_box_title ? req.body.message_box_title : [];
			const typeDropdownTitle = req.body.type_dropdown_title ? req.body.type_dropdown_title : [];
			const formTitle = req.body.form_title ? req.body.form_title : "";
			const notifyEmail = req.body.notify_email ? req.body.notify_email : [];
			const customThankYouTitle = req.body.custom_thank_you_title ? req.body.custom_thank_you_title : "";
			const customThankYouMessage = req.body.custom_thank_you_message ? req.body.custom_thank_you_message : "";
			const notifyEmailType = req.body.notify_email_type ? req.body.notify_email_type : "";
			const notifyEmailSendType = (notifyEmailType == LEAD_CAMPAIGN_NOTIFY_EMAIL_ALL) ? req.body.notify_email_send_type : [];
			const pageType = req.body.page_type ? req.body.page_type : "";

			const imageUrl = req.body.image_url ? req.body.image_url : "";
			const image = (req.files && req.files.image) ? req.files.image : "";
			const oldimage = req.body.old_image ? req.body.old_image : "";

			let imageUrlName = "";
			let imageFlagError = false;
			let errMessageArray = [];

			// Validate: both image and image url cannot be provided (unless old image exists)
			if (!oldimage && imageUrl !== "" && image) {
				imageFlagError = true;
			}

			if (imageFlagError) {
				errMessageArray.push({ param: 'image', msg: res.__("front.leads.please_select_image") });
				finalResponse = {
					data: {
						status: STATUS_ERROR_FORM_VALIDATION,
						errors: errMessageArray,
						message: errMessageArray,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle image upload by URL if provided and no old image
			if (oldimage === "" && imageUrl !== "") {
				const optionsImage = {
					url: imageUrl,
					dest: LEADS_FORM_FILE_PATH,
				};
				const imageResponse = await downloadImageToUrl(res, req, optionsImage);
				if (imageResponse.status === STATUS_ERROR) {
					finalResponse = {
						data: {
							status: STATUS_ERROR_INVALID_ACCESS,
							result: {},
							message: imageResponse.message,
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
				imageUrlName = imageResponse.fileName ? imageResponse.fileName : "";
			}

			// Handle image upload from file (async/await)
			const options = {
				image: image,
				filePath: LEADS_FORM_FILE_PATH,
				oldPath: oldimage
			};

			let imageName = "";
			try {
				// Await file move/upload
				const response = await moveUploadedFile(req, res, options);
				if (response.status === STATUS_ERROR) {
					finalResponse = {
						data: {
							status: STATUS_ERROR_INVALID_ACCESS,
							result: {},
							message: response.message,
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
				imageName = response.fileName ? response.fileName : "";
			} catch (err) {
				return next(err);
			}

			const leadsForms = db.collection(TABLE_LEAD_FORMS);
			let imageSaveName = imageUrlName !== '' ? imageUrlName : imageName;
			let graphicTypeName = imageUrlName !== '' ? URL_IMAGE : UPLOAD_IMAGE;

			if (imageUrlName === '' && imageName === "") {
				imageSaveName = "";
				graphicTypeName = "";
			}

			// Prepare update data
			let updateData = {
				user_id: newObjectIdDefault(userId),
				title: title,
				description: description,
				text_to_display: textDisplay,
				display_url_description: displayUrlDescription,
				signin_option: signinOption,
				kiosk_option: kioskOption,
				signup_fields: signupFields,
				button_name: buttonName,
				mandatory_options: mandatoryOptions,
				message_box_title: messageBoxTitle,
				type_dropdown_title: typeDropdownTitle,
				message_field_count: messageBoxTitle.length,
				dropdown_field_count: typeDropdownTitle.length,
				form_title: formTitle,
				notify_email: notifyEmail,
				notify_email_type: notifyEmailType,
				notify_email_send_type: notifyEmailSendType,
				image: imageSaveName,
				graphic_type: graphicTypeName,
				custom_thank_you_title: customThankYouTitle,
				custom_thank_you_message: customThankYouMessage,
				assign_welcome_email_id: assignWelcomeEmailId,
			};

			// If after subscriber user, restrict update fields
			if (afterSubscriberUser === ACTIVE) {
				updateData = {
					title: title,
					description: description,
					button_name: buttonName,
					form_title: formTitle,
					notify_email: notifyEmail,
					custom_thank_you_title: customThankYouTitle,
					custom_thank_you_message: customThankYouMessage,
					assign_welcome_email_id: assignWelcomeEmailId,
				};
			}

			// Update lead form in DB (single async query)
			const updateResult = await leadsForms.updateOne(
				{ _id: leadId },
				{ $set: updateData }
			);

			if (!updateResult || updateResult.modifiedCount === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: (pageType == CONTEST_PAGE_TYPE)
						? res.__("front.leads.contest_form_has_been_updated_successfully")
						: res.__("front.leads.leads_form_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editLeadCaptureForm()

	/**
	 * Function to get lead capture form list
	 *
	 * @return json 
	 **/
	this.getLeadCaptureForm = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Get user data and permissions
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			let businessLeadActivity = loginUserData.business_lead_activity ? loginUserData.business_lead_activity : DEFAULT_ZERO;

			// leads sub user ids
			let frontSubUsersIds = loginUserData.front_sub_user_ids ? loginUserData.front_sub_user_ids : [];
			frontSubUsersIds.push(userId);

			if (!userId || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
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
			let sortBy = req.body.sort_by ? req.body.sort_by : { "created": SORT_DESC };
			let pageType = req.body.page_type ? req.body.page_type : "";

			let skip = (limit * page) - limit;

			const leadsForms = db.collection(TABLE_LEAD_FORMS);

			// Build query conditions
			let conditions = {
				user_id: newObjectIdDefault(userId)
			};

			// Add page_type condition
			if (pageType !== '') {
				conditions['page_type'] = pageType;
			} else {
				conditions['$or'] = [
					{ 'page_type': { $eq: '' } },
					{ 'page_type': { $exists: false } }
				];
			}

			// Prepare projection for the find query
			const projection = {
				'title': 1,
				'user_id': 1,
				'description': 1,
				'slug': 1,
				'button_name': 1,
				'mandatory_options': 1,
				'signup_fields': 1,
				'message_box_title': 1,
				'type_dropdown_title': 1,
				'is_subscriber': 1,
				'is_excel_default': 1,
				'is_default': 1,
				'is_active': 1,
				'is_home_page': 1,
				'is_pocial_ai_bot_default': 1,
				'ai_bot': 1,
				'custom_thank_you_title': 1,
				'custom_thank_you_message': 1,
				'created': 1,
				'assign_welcome_email_id': {
					$cond: [
						{
							$or: [
								{ $eq: ["$assign_welcome_email_id", ""] }, // Check if field is blank
								{ $eq: ["$assign_welcome_email_id", null] } // Check if field is null
							]
						},
						null,
						"$assign_welcome_email_id"
					]
				},
			};

			// Run queries in parallel using Promise.all for better performance
			const [formList, totalCount] = await Promise.all([
				// Get leads form list
				leadsForms.find(conditions, { projection })
					.collation(COLLATION_VALUE)
					.sort(sortBy)
					.skip(skip)
					.limit(limit)
					.toArray(),
				// Get total number of records in leads form
				leadsForms.countDocuments(conditions)
			]);

			// Prepare and send response
			if (formList && formList.length > 0) {
				const totalRecord = totalCount || 0;
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						business_lead_activity: businessLeadActivity,
						image_url: LEADS_FORM_URL,
						result: formList,
						recordsTotal: totalCount,
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
						image_url: LEADS_FORM_URL,
						business_lead_activity: businessLeadActivity,
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

		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getLeadCaptureForm()

	/**
	 * Function to capture lead details
	 *
	 * @return json 
	 **/
	this.captureLeadDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id || "";
			const accountType = loginUserData.account_type || NORMAL_USER_ACCOUNT_TYPE;
			const leadFormsSlug = req.body.lead_forms_slug || "";
			const businessLeadActivity = loginUserData.business_lead_activity || DEFAULT_ZERO;

			// Prepare sub user ids (if needed for future logic)
			let frontSubUsersIds = loginUserData.front_sub_user_ids ? [...loginUserData.front_sub_user_ids] : [];
			frontSubUsersIds.push(userId);

			// Permission and input validation
			if (!userId || !leadFormsSlug || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const leadsForms = db.collection(TABLE_LEAD_FORMS);

			// Query the lead form details using async/await
			const leadResult = await leadsForms.findOne({
				slug: leadFormsSlug,
				user_id: newObjectIdDefault(userId)
			});

			// Prepare and send response based on query result
			if (leadResult && Object.keys(leadResult).length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						business_lead_activity: businessLeadActivity,
						image_url: LEADS_FORM_URL,
						result: leadResult,
						message: ''
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						business_lead_activity: businessLeadActivity,
						image_url: LEADS_FORM_URL,
						result: [],
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					business_lead_activity: (req.user_data && req.user_data.business_lead_activity) ? req.user_data.business_lead_activity : DEFAULT_ZERO,
					image_url: LEADS_FORM_URL,
					result: [],
					message: res.__("system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End captureLeadDetails()

	/**
	 * Function to get subscriber lead capture details
	 *
	 * @return json 
	 **/
	this.getSubscriberLeadCaptureDetails = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Get user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			const leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";
			const leadsImportSlug = req.body.leads_import_slug ? req.body.leads_import_slug : "";
			const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";
			const zipSearchKeyword = isNaN(searchKeyword) ? searchKeyword : Number(searchKeyword);
			const allLeads = req.body.all_leads ? true : false;

			// Permission check
			if (!userId || (allLeads === false && !leadFormsSlug) || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare sub user ids
			let frontSubUsersIds = loginUserData.front_sub_user_ids ? loginUserData.front_sub_user_ids : [];
			frontSubUsersIds.push(userId);

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			const leadsForms = db.collection(TABLE_LEAD_FORMS);
			const leadImport = db.collection(TABLE_LEADS_IMPORT);

			// Build query conditions
			let conditions = {
				creator_id: newObjectIdDefault(userId),
				lead_forms_slug: leadFormsSlug
			};

			// Remove lead slug condition for all leads search
			if (allLeads === true) {
				delete conditions.lead_forms_slug;
			}

			// If searching by imported leads, get the relevant IDs
			if (leadsImportSlug !== "") {
				const leadFormsSubscriberId = await getUserSubscriberIdsArray(leadsImportSlug);
				conditions['_id'] = { $in: leadFormsSubscriberId };
			}

			// Add search keyword conditions
			if (searchKeyword) {
				conditions['$or'] = [
					{ 'first_name': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'last_name': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'full_name': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'email': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'mobile': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'zip': zipSearchKeyword },
				];
			}

			// Run queries in parallel for performance
			const [
				subscriberList,
				totalRecords,
				importFileInfo
			] = await Promise.all([
				// Get leads form subscriber list with user details
				leadsFormsSubscriber.aggregate([
					{ $match: conditions },
					{
						$lookup: {
							from: TABLE_USERS,
							let: { userEmail: "$email" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$email", "$$userEmail"] },
											]
										},
									}
								},
								{ $project: { profile_image: 1, account_type: 1 } }
							],
							as: "userDetails"
						}
					},
					{
						$addFields: {
							"userDetails": 0,
							"profile_image": { $arrayElemAt: ["$userDetails.profile_image", 0] },
							"account_type": { $arrayElemAt: ["$userDetails.account_type", 0] },
						}
					},
					{ $sort: { created: SORT_DESC } },
					{ $skip: skip },
					{ $limit: limit },
				]).toArray(),

				// Get total number of records in leads form subscriber
				leadsFormsSubscriber.countDocuments(conditions),

				// Get file name and title for imported leads, if applicable
				leadsImportSlug !== ""
					? leadImport.findOne(
						{ slug: leadsImportSlug },
						{ projection: { file_name: 1, title: 1 } }
					)
					: Promise.resolve("")
			]);

			const importLeadTitleName = (importFileInfo && importFileInfo.title) ? importFileInfo.title : "";

			// Get lead form details (title, description, etc.)
			const leadResult = await leadsForms.findOne(
				{
					slug: leadFormsSlug,
					user_id: { $in: frontSubUsersIds }
				},
				{
					projection: {
						title: 1,
						description: 1,
						signup_fields: 1,
						message_box_title: 1,
						type_dropdown_title: 1
					}
				}
			);

			// Add upload_flag if applicable
			if (leadResult && leadResult.signup_fields) {
				leadResult.upload_flag = leadResult.signup_fields.includes(SIGNUP_FIELD_IMAGE_NAME);
			}

			// Prepare and send response
			if (subscriberList && subscriberList.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						lead_url: LEADS_FORM_URL,
						lead_result: leadResult,
						result: subscriberList,
						recordsTotal: totalRecords,
						limit: limit,
						page: page,
						message: "",
						import_lead_file_name: importLeadTitleName,
						total_page: Math.ceil(totalRecords / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						lead_url: LEADS_FORM_URL,
						lead_result: leadResult,
						result: [],
						recordsTotal: 0,
						limit: limit,
						page: page,
						import_lead_file_name: importLeadTitleName,
						message: res.__("front.global.no_record_found"),
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					user_url: USERS_URL,
					lead_url: LEADS_FORM_URL,
					lead_result: null,
					result: [],
					recordsTotal: 0,
					limit: req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT,
					page: req.body.page ? parseInt(req.body.page) : 1,
					import_lead_file_name: "",
					message: res.__("system.something_going_wrong_please_try_again"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSubscriberLeadCaptureDetails()

	/**
	 * Function to submit leads signup form using async/await and parallel queries for optimal performance.
	 *
	 * @return json 
	 **/
	this.submitLeadsSigupFields = async (req, res, next) => {
		let finalResponse = {};
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const creatorId = req.body.creator_id ? newObjectIdDefault(req.body.creator_id) : "";
		const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
		const submitFromUserService = req.body.submit_from_user_service ? req.body.submit_from_user_service : false;

		if (!creatorId || !leadFormsId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let firstName = req.body.first_name || "";
		let lastName = req.body.last_name || "";
		let userName = req.body.user_name || "";
		let fullName = firstName ? (firstName + " " + lastName) : "";
		let email = req.body.email ? req.body.email.toLowerCase() : "";
		let password = req.body.password || "";
		let gender = req.body.gender ? Number(req.body.gender) : "";
		let mobile = req.body.mobile || "";
		let dob = req.body.dob || "";
		let zipCode = req.body.zip || "";
		let submitType = req.body.submit_type || "";
		let thirdPartySiteUrl = req.body.third_party_site_url || "";

		const messageBoxData = req.body.message_box_data || [];
		const dropdownTitleData = req.body.dropdown_title_data || [];
		const messageBoxDataLength = messageBoxData.length;
		const dropDownTitleDataLength = dropdownTitleData.length;
		let messageBox = {};
		let dropDownTitle = {};

		// Prepare message box and dropdown title objects
		for (let i = 0; i < messageBoxDataLength; i++) {
			messageBox['message_box_title' + i] = req.body['message_box_title' + i];
		}
		for (let i = 0; i < dropDownTitleDataLength; i++) {
			dropDownTitle['type_dropdown_title' + i] = req.body['type_dropdown_title' + i];
		}

		// Prepare image upload options
		const leadImage = (req.files && req.files.image_name) ? req.files.image_name : "";
		const oldLeadImage = (req.files && req.files.old_lead_image_name) ? req.files.old_lead_image_name : "";

		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const leadsForms = db.collection(TABLE_LEAD_FORMS);
		const users = db.collection(TABLE_USERS);

		try {
			// Run independent queries in parallel for performance
			const [
				businessUserActivity, // 1. Check business user activity
				getYourselfLead,      // 2. Check if user is submitting to their own lead
				hybridResult,         // 3. Check for hybrid user
				emailWiseAllLeadSubscriber // 4. Get all lead subscriber data by email
			] = await Promise.all([
				// 1. Get business user activity
				(async () => {
					const result = await getBusinessUserAllActivityUse(creatorId);
					return result.business_lead_activity;
				})(),
				// 2. Check if the user is submitting to their own lead
				(async () => {
					const subscriberId = await getEmailWiseUserIdGet(req, res, email);
					const getYourselfLeadIds = await leadsForms.distinct('_id', { user_id: subscriberId });
					return getYourselfLeadIds.some(friend => friend.equals(leadFormsId));
				})(),
				// 3. Find hybrid user by email
				users.findOne(
					{ email: { $regex: '^' + email + '$', $options: 'i' }, is_deleted: NOT_DELETED }
				),
				// 4. Aggregate all lead subscriber data by email
				(async () => {
					const allSubscriberResult = await signupLeadForms.aggregate([
						{ $match: { email: { $regex: '^' + email + '$', $options: 'i' } } },
						{
							$group: {
								_id: null,
								first_name: { $addToSet: '$first_name' },
								last_name: { $addToSet: '$last_name' },
								dob: { $addToSet: '$dob' },
								gender: { $addToSet: '$gender' },
								zip: { $addToSet: '$zip' },
								mobile: { $addToSet: '$mobile' },
								slug: { $addToSet: '$slug' },
								image_name: { $addToSet: '$image_name' },
							}
						}
					]).toArray();

					if (allSubscriberResult && allSubscriberResult.length > 0) {
						const result = allSubscriberResult[0];
						// Remove blank values from arrays
						const firstNameArray = result.first_name.filter(i => i);
						const lastNameArray = result.last_name.filter(i => i);
						const dobArray = result.dob.filter(i => i);
						const genderArray = result.gender.filter(i => i);
						const zipArray = result.zip.filter(i => i);
						const mobileArray = result.mobile.filter(i => i);
						const slugArray = result.slug.filter(i => i);
						const imageNameArray = result.image_name.filter(i => i);

						return {
							first_name: firstNameArray.length > 0 ? firstNameArray[0] : "",
							last_name: lastNameArray.length > 0 ? lastNameArray[0] : "",
							dob: dobArray.length > 0 ? dobArray[0] : "",
							gender: genderArray.length > 0 ? genderArray[0] : "",
							zip: zipArray.length > 0 ? zipArray[0] : "",
							mobile: mobileArray.length > 0 ? mobileArray[0] : "",
							slug: slugArray.length > 0 ? slugArray[0] : "",
							image_name: imageNameArray.length > 0 ? imageNameArray[0] : "",
						};
					}
					return {};
				})()
			]);

			const hybridLead = (hybridResult && Object.keys(hybridResult).length > 0) ? HYBRID : NOT_HYBRID;

			// Extract hybrid user data if present
			const hybridFirstName = (hybridResult && hybridResult.fname) ? hybridResult.fname : "";
			const hybridLastName = (hybridResult && hybridResult.lname) ? hybridResult.lname : "";
			const hybridUserName = (hybridResult && hybridResult.slug) ? hybridResult.slug : "";
			const hybridGender = (hybridResult && hybridResult.gender) ? hybridResult.gender : "";
			const hybridZipCode = (hybridResult && hybridResult.zip) ? hybridResult.zip : "";
			const hybridMobile = (hybridResult && hybridResult.mobile) ? hybridResult.mobile : "";
			const hybridDob = (hybridResult && hybridResult.dob) ? moment(hybridResult.dob).format(DATE_FORMAT_SAVE) : "";

			// If hybrid, override with hybrid data
			if (hybridLead === HYBRID) {
				firstName = hybridFirstName;
				lastName = hybridLastName;
				fullName = hybridFirstName + " " + hybridLastName;
				dob = hybridDob;
				mobile = hybridMobile;
				zipCode = hybridZipCode;
				userName = hybridUserName;
				gender = hybridGender;
			}

			// Prepare already existing subscriber data
			const alreadyFirstName = emailWiseAllLeadSubscriber.first_name || "";
			const alreadyLastName = emailWiseAllLeadSubscriber.last_name || "";
			const alreadyFullName = (alreadyFirstName && alreadyLastName) ? alreadyFirstName + " " + alreadyLastName : "";
			const alreadyZip = emailWiseAllLeadSubscriber.zip || "";
			const alreadyGender = emailWiseAllLeadSubscriber.gender || "";
			const alreadyMobile = emailWiseAllLeadSubscriber.mobile || "";
			const alreadyImageName = emailWiseAllLeadSubscriber.image_name || "";
			const alreadyUsedDob = emailWiseAllLeadSubscriber.dob ? moment(emailWiseAllLeadSubscriber.dob) : "";
			const alreadyUserNameSlug = emailWiseAllLeadSubscriber.slug || "";
			let alreadyDobDate = "";
			if (alreadyUsedDob) {
				alreadyDobDate = alreadyUsedDob.format(DATE_FORMAT_SAVE);
			}

			// Business user activity check
			if (businessUserActivity === DEFAULT_ZERO) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.leads.you_cant_access_embedded_or_scripted_code"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
			// Prevent user from assigning lead to themselves
			if (getYourselfLead === true) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.leads.lead_will_be_assigned_to_other_users_only"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch creator user details
			const userCreatedResult = await users.findOne(
				{ _id: creatorId },
				{ projection: { '_id': 1, 'full_name': 1, 'email': 1, 'slug': 1, 'complete_profile_reward': 1, 'signature_image': 1, 'public_business_informaton': 1 } }
			) || {};

			if (Object.keys(userCreatedResult).length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.leads.this_user_not_here"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch lead form details
			const leadsFormsResult = await leadsForms.findOne(
				{ _id: leadFormsId, user_id: creatorId },
				{ projection: { 'slug': 1, 'title': 1, 'notify_email': 1, 'page_type': 1, 'custom_thank_you_title': 1, 'custom_thank_you_message': 1 } }
			) || {};

			if (Object.keys(leadsFormsResult).length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.leads.this_leads_not_here"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const creatorFullName = userCreatedResult.full_name || "";
			const leadName = leadsFormsResult.title || "";
			const pageType = leadsFormsResult.page_type || "";
			const notifyEmail = leadsFormsResult.notify_email || [];
			const customThankyouTitle = leadsFormsResult.custom_thank_you_title || "";
			const customThankyouMessage = leadsFormsResult.custom_thank_you_message || "";
			const successMessageSend = customThankyouTitle ? customThankyouTitle : res.__("front.leads.leads_signup_form_has_been_submitted_successfully");

			// Handle image upload
			const options = {
				image: leadImage,
				filePath: LEADS_FORM_FILE_PATH,
				oldPath: oldLeadImage
			};
			const moveFileResponse = await moveUploadedFile(req, res, options);
			if (moveFileResponse.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: moveFileResponse.message
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
			let imageName = moveFileResponse.fileName || "";

			// Generate bcrypt password
			let bcryptPassword = await bcryptPasswordGenerate(password);

			// Check if widget data already exists for this user/lead/email
			const widgetData = await signupLeadForms.findOne({
				email: { $regex: "^" + email + "$", $options: "i" },
				creator_id: creatorId,
				lead_forms_id: leadFormsId,
			}) || {};

			if (Object.keys(widgetData).length > 0) {
				// Update existing widget data
				let updateData = {
					messageBoxValue: messageBox,
					message_field_count: messageBoxDataLength,
					message_box_title: messageBoxData,
					dropDownTitleValue: dropDownTitle,
					dropdown_field_count: dropDownTitleDataLength,
					type_dropdown_title: dropdownTitleData,
					hybrid: hybridLead,
					modified: getUtcDate(),
				};

				if (fullName) {
					updateData.first_name = firstName || alreadyFirstName;
					updateData.last_name = lastName || alreadyLastName;
					updateData.full_name = fullName || alreadyFullName;
				}
				if (password) {
					updateData.password = bcryptPassword;
				}
				gender = gender || alreadyGender;
				if (gender) {
					updateData.gender = gender;
				}
				mobile = mobile || alreadyMobile;
				if (mobile) {
					updateData.mobile = mobile;
				}
				dob = dob || alreadyDobDate;
				if (dob) {
					updateData.dob = ageUtcDate(dob);
					updateData.age = calculateAge(dob);
				}
				zipCode = zipCode || alreadyZip;
				if (zipCode) {
					updateData.zip = zipCode;
				}
				userName = userName || alreadyUserNameSlug;
				if (userName) {
					updateData.slug = userName;
				}
				leadImage = leadImage || alreadyImageName;
				imageName = imageName || alreadyImageName;
				if (leadImage) {
					updateData.image_name = imageName;
				}

				await signupLeadForms.updateOne(
					{
						email: { $regex: "^" + email + "$", $options: "i" },
						creator_id: creatorId,
						lead_forms_id: leadFormsId,
					},
					{ $set: updateData }
				);

				// Update lead stage and all subscribers in parallel
				const stageOptions = {
					email,
					creator_id: creatorId,
					lead_forms_id: leadFormsId,
					creator_full_name: creatorFullName,
					notify_email: notifyEmail,
					lead_name: leadName,
					user_created_result: userCreatedResult,
					update_data: updateData,
					hybrid_lead: hybridLead,
					lead_forms_subscriber_id: widgetData._id,
				};
				await Promise.all([
					leadsStagesLevel(req, res, stageOptions),
					updateAllLeadsSubscriber(stageOptions)
				]);

				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: successMessageSend,
					}
				};
				if (submitFromUserService) {
					return;
				} else {
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// Prepare data for new insert, using hybrid or already existing data as fallback
				firstName = firstName || (hybridResult && hybridResult.fname) || alreadyFirstName;
				lastName = lastName || (hybridResult && hybridResult.lname) || alreadyLastName;
				fullName = fullName || (hybridResult && hybridResult.full_name) || alreadyFullName;
				userName = userName || (hybridResult && hybridResult.slug) || alreadyUserNameSlug;
				gender = gender || (hybridResult && hybridResult.gender) || alreadyGender;
				zipCode = zipCode || (hybridResult && hybridResult.zip) || alreadyZip;
				mobile = mobile || (hybridResult && hybridResult.mobile) || alreadyMobile;
				bcryptPassword = bcryptPassword || (hybridResult && hybridResult.password) || "";

				let alreadyDob = (hybridResult && hybridResult.dob) ? moment(hybridResult.dob) : alreadyUsedDob;
				let dobDate = "";
				if (alreadyDob) {
					dobDate = alreadyDob.format(DATE_FORMAT_SAVE);
				}
				dob = dob || dobDate;

				// Insert new lead signup form
				const signupLeadFormsResult = await signupLeadForms.insertOne({
					first_name: firstName,
					last_name: lastName,
					full_name: fullName,
					slug: userName,
					email: email,
					creator_name: userCreatedResult.full_name,
					creator_email: userCreatedResult.email,
					creator_id: creatorId,
					lead_forms_id: leadFormsId,
					lead_forms_slug: leadsFormsResult.slug,
					password: bcryptPassword,
					is_deleted: NOT_DELETED,
					dob: dob ? ageUtcDate(dob) : "",
					age: dob ? calculateAge(dob) : 0,
					gender: gender,
					zip: zipCode,
					mobile: mobile,
					custom_thank_you_title: customThankyouTitle,
					custom_thank_you_message: customThankyouMessage,
					image_name: imageName,
					hybrid: hybridLead,
					message_box_title: messageBoxData,
					message_field_count: messageBoxDataLength,
					messageBoxValue: messageBox,
					type_dropdown_title: dropdownTitleData,
					dropdown_field_count: dropDownTitleDataLength,
					dropDownTitleValue: dropDownTitle,
					submit_type: submitType,
					page_type: pageType,
					third_party_site_url: thirdPartySiteUrl,
					created: getUtcDate(),
					modified: getUtcDate()
				});

				const signupLeadFormsId = (signupLeadFormsResult && signupLeadFormsResult.insertedId) ? signupLeadFormsResult.insertedId : "";

				// Prepare update data for all subscribers
				let updateData = {};
				if (fullName) {
					updateData.first_name = firstName;
					updateData.last_name = lastName;
					updateData.full_name = fullName;
				}
				if (gender) {
					updateData.gender = gender;
				}
				if (mobile) {
					updateData.mobile = mobile;
				}
				if (dob) {
					updateData.dob = ageUtcDate(dob);
					updateData.age = calculateAge(dob);
				}
				if (zipCode) {
					updateData.zip = zipCode;
				}
				if (userName) {
					updateData.slug = userName;
				}
				if (imageName) {
					updateData.image_name = imageName;
				}

				// Mark lead form as having a subscriber
				await leadsForms.updateOne({ _id: leadFormsId }, { $set: { is_subscriber: DEFAULT_ONE } });

				// Update lead stage and all subscribers in parallel
				const stageOptions = {
					email,
					creator_id: creatorId,
					lead_forms_id: leadFormsId,
					creator_full_name: creatorFullName,
					notify_email: notifyEmail,
					lead_name: leadName,
					user_created_result: userCreatedResult,
					update_data: updateData,
					hybrid_lead: hybridLead,
					lead_forms_subscriber_id: signupLeadFormsId,
				};
				await Promise.all([
					leadsStagesLevel(req, res, stageOptions),
					updateAllLeadsSubscriber(stageOptions)
				]);

				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: successMessageSend
					}
				};
				if (submitFromUserService) {
					return;
				} else {
					return returnApiResult(req, res, finalResponse);
				}
			}
		} catch (error) {
			return next(error);
		}
	};

	/**
	 * Function to get chart count user wise data
	 *
	 * @return json 
	 **/
	this.chartCountUserLeads = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user data and validate permissions
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;

			// Prepare sub user ids
			let frontSubUsersIds = loginUserData.front_sub_user_ids ? loginUserData.front_sub_user_ids : [];
			frontSubUsersIds.push(userId);

			// Permission check
			if (!userId || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch lead count data asynchronously
			const responseCount = await overviewLeadCountDashboard(req, res, frontSubUsersIds);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {
						total_leads: responseCount.total_leads,
						leads_month_up_down_arrow_number: LEADS_MONTH_UP_DOWN_ARROW_NUMBER,
						introduction: responseCount.introduction,
						introduction_month: responseCount.introduction_month,
						introduction_hybrid: responseCount.introduction_hybrid,

						growth: responseCount.growth,
						growth_month: responseCount.growth_month,
						growth_hybrid: responseCount.growth_hybrid,

						hot_leads: responseCount.hot_leads,
						hot_leads_month: responseCount.hot_leads_month,
						hot_leads_hybrid: responseCount.hot_leads_hybrid,

						loyalist_count: responseCount.loyalist_count,
						loyalist_month: responseCount.loyalist_month,
					},
					message: ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End chartCountUserLeads()

	/**
	 * Function to get list sign form widget list (user wise leads stage level list)
	 *
	 * @return json 
	 **/
	this.getListLeadsSigupFields = async (req, res) => {
		let finalResponse = {};
		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
			const stageLevel = req.body.stage_level ? req.body.stage_level.toString() : "";
			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			const isHybrid = req.body.is_hybrid ? ACTIVE : DEACTIVE;
			const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";
			const zipSearchKeyword = isNaN(searchKeyword) ? searchKeyword : Number(searchKeyword);

			// Prepare sub user ids
			let frontSubUsersIds = loginUserData.front_sub_user_ids ? [...loginUserData.front_sub_user_ids] : [];
			frontSubUsersIds.push(userId);

			const skip = (limit * page) - limit;
			const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			// Permission check
			if (!userId || !stageLevel || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query conditions
			let conditions = {
				creator_id: { $in: frontSubUsersIds },
				stage_level: stageLevel,
				$or: [
					{ first_name: { $regex: new RegExp(searchKeyword, "i") } },
					{ last_name: { $regex: new RegExp(searchKeyword, "i") } },
					{ full_name: { $regex: new RegExp(searchKeyword, "i") } },
					{ email: { $regex: new RegExp(searchKeyword, "i") } },
					{ mobile: { $regex: new RegExp(searchKeyword, "i") } },
					{ zip: zipSearchKeyword },
				]
			};

			// Clone for all-leads count (without hybrid filter)
			let withoutHybridCondition = { ...conditions };

			// Add hybrid filter if requested
			if (isHybrid) {
				conditions.hybrid = HYBRID;
			}

			// Exclude loyalist users for HOT_LEADS_LEVEL
			if (stageLevel == HOT_LEADS_LEVEL) {
				const totalCountCondition = {
					user_id: { $nin: [null, ""] },
					make_poll_user_id: userId
				};
				const loyalListUserIds = await getLoyalistUserIds(totalCountCondition);
				conditions.email_user_id = { $nin: loyalListUserIds.user_ids };
				withoutHybridCondition.email_user_id = { $nin: loyalListUserIds.user_ids };
			}

			// Prepare aggregation pipeline for main and export queries
			const userLookup = {
				from: TABLE_USERS,
				let: { userEmail: "$email" },
				pipeline: [
					{
						$match: {
							$expr: {
								$and: [
									{ $eq: ["$email", "$$userEmail"] },
								]
							},
						}
					},
					{ $project: { profile_image: 1, account_type: 1, email: 1, public_business_informaton: 1, full_name: 1 } }
				],
				as: "userDetails"
			};

			const addFields = {
				userDetails: 0,
				name_of_the_business: {
					$cond: [
						{ $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
						{ $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
						""
					]
				},
				user_full_name: {
					$cond: [
						{ $arrayElemAt: ["$userDetails.full_name", 0] },
						{ $arrayElemAt: ["$userDetails.full_name", 0] },
						""
					]
				},
				profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
				account_type: { $arrayElemAt: ["$userDetails.account_type", 0] },
			};

			// Run all queries in parallel using Promise.all for better performance
			const [
				leadList, // Paginated result
				recordsTotal, // Paginated count
				totalAllLeadsCount, // All-leads count (without hybrid)
				exportToExcelRecords // All records for export
			] = await Promise.all([
				// 1. Get paginated leads with user details
				signupLeadForms.aggregate([
					{ $match: conditions },
					{ $lookup: userLookup },
					{ $addFields: addFields },
					{ $sort: { created: SORT_DESC } },
					{ $skip: skip },
					{ $limit: limit },
				]).toArray(),

				// 2. Get total number of records for pagination
				signupLeadForms.countDocuments(conditions),

				// 3. Get total count of all leads (without hybrid filter)
				signupLeadForms.countDocuments(withoutHybridCondition),

				// 4. Get all records for export to Excel
				signupLeadForms.aggregate([
					{ $match: conditions },
					{ $lookup: userLookup },
					{ $addFields: addFields },
					{ $sort: { created: SORT_DESC } },
				]).toArray()
			]);

			// Get total hybrid count (async, not in Promise.all as it may depend on external logic)
			const totalHybridCount = await hybridCountStageLevelWise(conditions);

			// Prepare and send response
			if (leadList && leadList.length > 0) {
				const totalPage = Math.ceil((recordsTotal || 0) / limit);
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: leadList,
						recordsTotal: recordsTotal || 0,
						total_all_leads_count: totalAllLeadsCount || 0,
						export_to_excel_records: exportToExcelRecords || [],
						total_hybrid_count: totalHybridCount || 0,
						limit: limit,
						page: page,
						message: "",
						total_page: totalPage
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: [],
						recordsTotal: 0,
						total_hybrid_count: 0,
						total_all_leads_count: totalAllLeadsCount || 0,
						export_to_excel_records: [],
						limit: limit,
						page: page,
						message: res.__("front.global.no_record_found"),
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getListLeadsSigupFields()

	/**
	 * Function to get third party user data using async/await for optimal performance.
	 *
	 * @param req
	 * @param res
	 */
	this.getThirdUserLeadsDetails = async (req, res) => {
		let finalResponse = {};
		try {
			const validateString = req.body.validate_string ? req.body.validate_string : '';
			if (!validateString) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			const users = db.collection(TABLE_USERS);
			const emailCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Find the subscriber user by validate_string
			const subscriberUserResult = await signupLeadForms.findOne({ validate_string: validateString });

			if (!subscriberUserResult) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						already_user_login_string: "",
						already_user: false,
						lead_image_url: LEADS_FORM_URL,
						user_image_url: USERS_URL,
						result: [],
						message: res.__("front.leads.this_profile_link_not_valid")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const email = subscriberUserResult.email;
			const creatorId = subscriberUserResult.creator_id ? newObjectIdDefault(subscriberUserResult.creator_id) : "";

			// Run all queries in parallel for better performance
			const [
				mainUserResult,
				attachTemplateResult,
				ownerUserResult
			] = await Promise.all([
				// Get user by email
				users.findOne(
					{ email: { $regex: '^' + email + '$', $options: 'i' } },
					{ projection: { fname: 1, lname: 1, slug: 1, dob: 1, zip: 1, mobile: 1, gender: 1, profile_image: 1, UUID: 1 } }
				),
				// Get welcome reward template
				emailCollection.findOne(
					{ user_id: creatorId, template_type: EMAIL_TEMPLATE_WELCOME_TYPE, is_active: ACTIVE },
					{ projection: { attach_reward: 1 } }
				),
				// Get owner user result
				users.findOne(
					{ _id: creatorId },
					{ projection: { public_business_informaton: 1, account_type: 1, reward_image: 1, profile_image: 1 } }
				)
			]);

			// Get welcome reward details if attach_reward exists
			let attachWelcomeReward = {};
			if (attachTemplateResult && attachTemplateResult.attach_reward) {
				const attachRewardId = newObjectIdDefault(attachTemplateResult.attach_reward);
				attachWelcomeReward = await getRewardDetails(attachRewardId) || {};
			}

			// Assign Welcome reward user data from ownerUserResult
			attachWelcomeReward.business_industry_name =
				(ownerUserResult && ownerUserResult.public_business_informaton && ownerUserResult.public_business_informaton.business_industry_name)
					? ownerUserResult.public_business_informaton.business_industry_name : "";
			attachWelcomeReward.sent_profile_image = (ownerUserResult && ownerUserResult.profile_image) ? ownerUserResult.profile_image : "";
			attachWelcomeReward.sent_reward_image = (ownerUserResult && ownerUserResult.reward_image) ? ownerUserResult.reward_image : "";
			attachWelcomeReward.account_type = (ownerUserResult && ownerUserResult.account_type) ? ownerUserResult.account_type : "";

			// Merge user data for response
			const fname = (mainUserResult && mainUserResult.fname) ? mainUserResult.fname : "";
			const lname = (mainUserResult && mainUserResult.lname) ? mainUserResult.lname : "";
			const profileImage = (mainUserResult && mainUserResult.profile_image) ? mainUserResult.profile_image : "";
			const slug = (mainUserResult && mainUserResult.slug) ? mainUserResult.slug : "";
			const dob = (mainUserResult && mainUserResult.dob) ? mainUserResult.dob : "";
			const zip = (mainUserResult && mainUserResult.zip) ? mainUserResult.zip : "";
			const mobile = (mainUserResult && mainUserResult.mobile) ? mainUserResult.mobile : "";
			const gender = (mainUserResult && mainUserResult.gender) ? mainUserResult.gender : "";
			const uuid = (mainUserResult && mainUserResult.UUID) ? mainUserResult.UUID : "";

			// Merge subscriberUserResult with fallback to mainUserResult
			subscriberUserResult.first_name = (subscriberUserResult.first_name && subscriberUserResult.first_name !== '') ? subscriberUserResult.first_name : fname;
			subscriberUserResult.last_name = (subscriberUserResult.last_name && subscriberUserResult.last_name !== '') ? subscriberUserResult.last_name : lname;
			subscriberUserResult.slug = (subscriberUserResult.slug && subscriberUserResult.slug !== '') ? subscriberUserResult.slug : slug;
			subscriberUserResult.dob = (subscriberUserResult.dob && subscriberUserResult.dob !== '') ? subscriberUserResult.dob : dob;
			subscriberUserResult.zip = (subscriberUserResult.zip && subscriberUserResult.zip !== '') ? subscriberUserResult.zip : zip;
			subscriberUserResult.mobile = (subscriberUserResult.mobile && subscriberUserResult.mobile !== '') ? subscriberUserResult.mobile : mobile;
			subscriberUserResult.gender = (subscriberUserResult.gender && subscriberUserResult.gender !== '') ? subscriberUserResult.gender : gender;
			subscriberUserResult.profile_image = profileImage;

			// Generate username/slug if not present
			const emailArrayName = email ? email.split("@") : "";
			const nameEmail = emailArrayName ? emailArrayName[0] : "";
			const currentDataTimeStamp = (currentTimeStamp()).toString();
			const newUserName = nameEmail + "" + currentDataTimeStamp;
			const generateUserSlug = (subscriberUserResult.slug) ? subscriberUserResult.slug : newUserName;
			subscriberUserResult.slug = generateUserSlug;

			// Convert Mongo date to dd-mm-yy
			const dobConvert = mongoDatetoSimpleDateConvert(subscriberUserResult.dob);
			subscriberUserResult.dd = dobConvert.dd;
			subscriberUserResult.mm = dobConvert.mm;
			subscriberUserResult.yy = dobConvert.yy;

			// Generate alreadyUserLoginString if user exists
			let alreadyUserLoginString = "";
			if (mainUserResult) {
				const concateData = uuid.concat('#@!', email);
				const loginUrl = concateData.concat('#@!', slug);
				alreadyUserLoginString = btoa(loginUrl);
			}

			// Send Success message
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					already_user_login_string: alreadyUserLoginString,
					already_user: !!mainUserResult,
					lead_image_url: LEADS_FORM_URL,
					user_image_url: USERS_URL,
					blocked_wallet: [attachWelcomeReward],
					result: subscriberUserResult ? subscriberUserResult : [],
					message: ''
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					already_user_login_string: "",
					already_user: "",
					lead_image_url: LEADS_FORM_URL,
					user_image_url: USERS_URL,
					blocked_wallet: [],
					result: [],
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getThirdUserLeadsDetails()

	/**
	 * Function for delete lead
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.deleteLead = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user data and request parameters
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			const leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";
			const pageType = req.body.page_type ? req.body.page_type : "";

			// Permission check
			if (!userId || !leadFormsSlug || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const leadsForms = db.collection(TABLE_LEAD_FORMS);

			// Delete the lead form asynchronously
			const deleteResult = await leadsForms.deleteOne({
				user_id: newObjectIdDefault(userId),
				slug: leadFormsSlug,
				is_default: DEFAULT_ZERO,
				is_subscriber: DEFAULT_ZERO
			});

			// Check if a document was deleted
			if (deleteResult && deleteResult.deletedCount > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: (pageType == CONTEST_PAGE_TYPE)
							? res.__("front.leads.contest_has_been_delete_successfully")
							: res.__("front.leads.leads_has_been_delete_successfully")
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.leads.lead_not_found_or_cannot_delete")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteLead()

	/** 
	 * Function to assign a lead form to the home page using async/await for optimal performance.
	 **/
	this.assignHomePageLead = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and lead form IDs
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";

			// Permission check
			if (!userId || !leadFormsId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Assign the lead form to the home page asynchronously
			const responseData = await assignLeadHomePage(leadFormsId);

			if (responseData === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
			} else {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("admin.leads.embed_lead_assign_successfully"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End assignHomePageLead()

	/** 
	 * Function for use to pick a winner
	 * Uses async/await for database and business logic queries.
	 **/
	this.pickAWinner = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user data and lead form ID
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";

			// Permission check
			if (!userId || !leadFormsId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						user_url: USERS_URL,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for picking a winner
			const optionsData = {
				lead_from_id: leadFormsId,
				user_id: userId
			};

			// Call pickWinnerFromList asynchronously
			// If pickWinnerFromList can be parallelized with other queries, use Promise.all here
			const response = await pickWinnerFromList(req, res, optionsData);

			// Send response
			finalResponse = {
				data: {
					status: response.status,
					result: response.result,
					user_url: USERS_URL,
					message: response.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					user_url: USERS_URL,
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pickAWinner()

	/**
	 * Function to get lead winners
	 *
	 * @return json 
	 **/
	this.getLeadWinners = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
			const filterdBy = req.body.filterd_by ? req.body.filterd_by : LEAD_WINNERS_FILTERD;

			if (!userId || !leadFormsId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			// Build query conditions
			let conditions = {
				creator_id: newObjectIdDefault(userId),
				lead_forms_id: leadFormsId,
				is_deleted: NOT_DELETED
			};

			// Filter by winners
			if (filterdBy == LEAD_WINNERS_FILTERD) {
				conditions.is_winner = ACTIVE;
			}

			// Filter by rewards
			if (filterdBy == LEAD_REWARDS_FILTERD) {
				conditions.is_rewarded = ACTIVE;
			}

			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			// Prepare aggregation pipeline for winners/rewards list
			const aggregatePipeline = [
				{ $match: conditions },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { userEmail: "$email" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email", "$$userEmail"] },
										]
									},
								}
							},
							{ $project: { profile_image: 1, account_type: 1, public_business_informaton: 1 } }
						],
						as: "userDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { userEmail: "$email" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email", "$$userEmail"] },
											{ $eq: ["$lead_forms_id", leadFormsId] },
											{ $eq: ["$template_type", LEADS_SEGMENT_REWARD_TYPE] },
										]
									},
								}
							},
							{ $project: { reward_id: 1, title: 1, sub_title: 1, image: 1 } }
						],
						as: "rewardEarnDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_SEGMENT_LEAD_REWARD_LOGS,
						let: { userEmail: "$email" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$user_email", "$$userEmail"] },
											{ $eq: ["$lead_forms_id", leadFormsId] },
											{ $eq: ["$template_type", LEADS_SEGMENT_REWARD_TYPE] },
										]
									},
								}
							},
							{ $project: { reward_id: 1, title: 1, sub_title: 1, image: 1 } }
						],
						as: "rewardDetailsFromLogs"
					}
				},
				{
					$addFields: {
						userDetails: 0,
						profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
						account_type: { $arrayElemAt: ["$userDetails.account_type", 0] },
						public_business_informaton: { $arrayElemAt: ["$userDetails.public_business_informaton", 0] },
						user_url: USERS_URL
					}
				},
				{
					$project: {
						_id: 1,
						full_name: {
							$cond: [
								"$public_business_informaton.name_of_the_business",
								"$public_business_informaton.name_of_the_business",
								"$full_name"
							]
						},
						email: 1,
						creator_id: 1,
						lead_forms_id: 1,
						gender: 1,
						zip: 1,
						mobile: 1,
						user_url: 1,
						is_deleted: 1,
						profile_image: { $cond: ["$profile_image", "$profile_image", ""] },
						account_type: { $cond: ["$account_type", "$account_type", ""] },
						is_winner: 1,
						winner_created: 1,
						rewardDetails: {
							$concatArrays: [
								"$rewardEarnDetails", "$rewardDetailsFromLogs"
							]
						},
						created: 1
					}
				},
				{ $sort: { winner_created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			];

			// Run both queries in parallel for optimal performance
			const [result, totalCount] = await Promise.all([
				leadsFormsSubscriber.aggregate(aggregatePipeline).toArray(),
				leadsFormsSubscriber.countDocuments(conditions)
			]);

			if (result && result.length > 0) {
				const totalPage = Math.ceil((totalCount || 0) / limit);
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						result: result,
						recordsTotal: totalCount || 0,
						limit: limit,
						page: page,
						message: "",
						total_page: totalPage
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
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

		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					user_url: USERS_URL,
					result: [],
					recordsTotal: 0,
					limit: req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT,
					page: req.body.page ? parseInt(req.body.page) : 1,
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getLeadWinners()

	/**
	 * Function to validate send rewards
	 *
	 * @return json 
	 **/
	this.validateSendRewards = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
			const subscriberEmails = req.body.subscriber_emails ? req.body.subscriber_emails : [];

			if (!userId || !leadFormsId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare query conditions
			const earnSendRewardConditions = {
				lead_forms_id: leadFormsId,
				is_deleted: NOT_DELETED,
				template_type: LEADS_SEGMENT_REWARD_TYPE
			};
			if (subscriberEmails.length > 0) {
				earnSendRewardConditions.email = { $in: subscriberEmails };
			}

			const pendingRewardsConditions = {
				lead_forms_id: leadFormsId
			};
			if (subscriberEmails.length > 0) {
				pendingRewardsConditions.user_email = { $in: subscriberEmails };
			}

			const leadCondition = {
				creator_id: newObjectIdDefault(userId),
				lead_forms_id: leadFormsId,
				is_deleted: NOT_DELETED
			};
			if (subscriberEmails.length > 0) {
				leadCondition.email = { $in: subscriberEmails };
			}

			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			const segmentLeadRewardLogs = db.collection(TABLE_SEGMENT_LEAD_REWARD_LOGS);
			const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// Run all queries in parallel for better performance
			const [
				earnSendRewardResult,
				segmentLogsRewardResult,
				totalSubscribers
			] = await Promise.all([
				// Get reward count for lead form
				earnSentRewards.aggregate([
					{ $match: earnSendRewardConditions },
					{ $group: { _id: "$email" } },
					{ $count: "total_earn_send_reward" }
				]).toArray(),
				// Get reward count from logs for lead form
				segmentLeadRewardLogs.aggregate([
					{ $match: pendingRewardsConditions },
					{ $group: { _id: "$user_email" } },
					{ $count: "total_segment_logs_reward" }
				]).toArray(),
				// Get total number of subscribers in lead
				leadsFormsSubscriber.countDocuments(leadCondition)
			]);

			const earnRewardCount = (earnSendRewardResult && earnSendRewardResult.length > 0) ? earnSendRewardResult[0].total_earn_send_reward : 0;
			const pendingRewardsCount = (segmentLogsRewardResult && segmentLogsRewardResult.length > 0) ? segmentLogsRewardResult[0].total_segment_logs_reward : 0;
			const totalRewardsCount = earnRewardCount + pendingRewardsCount;

			// Handle reward validation logic
			if (totalRewardsCount > 0) {
				if (totalSubscribers == 1) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.reward_is_already_sent_to_this_user")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else if (totalSubscribers > 1 && totalSubscribers == totalRewardsCount) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.reward_is_already_sent_to_all_users")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.reward_is_already_sent_to_the_users_out_of_total_users", totalRewardsCount, totalSubscribers)
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// Send success if no reward is sent to the users
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End validateSendRewards()

	/**
	 * Function to send segment leads rewards
	 *
	 * @return json 
	 **/
	this.sendSegmentLeadsRewards = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Get user and request data
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
			const rewardId = req.body.reward_id ? newObjectIdDefault(req.body.reward_id) : "";
			const subscriberEmails = req.body.subscriber_emails ? req.body.subscriber_emails : [];
			const excludeRewarded = req.body.exclude_rewarded ? true : false;

			if (!userId || !leadFormsId || !rewardId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const rewards = db.collection(TABLE_REWARDS);

			// Fetch reward details
			const resultRewards = await rewards.findOne({ _id: newObjectIdDefault(rewardId) });
			if (!resultRewards) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const rewardTitle = resultRewards.reward_text || "";
			const rewardSubTitle = resultRewards.reward_sub_heading || "";
			const rewardImage = resultRewards.graphic_image || "";

			// Build query conditions for subscribers
			let conditions = {
				creator_id: newObjectIdDefault(userId),
				lead_forms_id: leadFormsId,
				is_deleted: NOT_DELETED
			};

			if (subscriberEmails.length > 0) {
				conditions.email = { $in: subscriberEmails };
			}

			if (excludeRewarded === true) {
				conditions.is_rewarded = { $ne: ACTIVE };
			}

			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			// Aggregate to get subscribers and their user details
			const subscribersList = await leadsFormsSubscriber.aggregate([
				{ $match: conditions },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { userEmail: "$email" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email", "$$userEmail"] },
										]
									},
								}
							},
							{ $project: { _id: 1, full_name: 1, email: 1, gender: 1, dob: 1, zip: 1, account_type: 1 } }
						],
						as: "userDetails"
					}
				},
				{
					$addFields: {
						user_details: { $arrayElemAt: ["$userDetails", 0] },
					}
				},
				{
					$project: {
						_id: 1,
						full_name: 1,
						email: 1,
						creator_id: 1,
						lead_forms_id: 1,
						gender: 1,
						zip: 1,
						mobile: 1,
						validate_string: 1,
						is_deleted: 1,
						is_winner: 1,
						is_rewarded: 1,
						winner_created: 1,
						rewardDetails: 1,
						user_details: 1,
						created: 1
					}
				},
			]).toArray();

			if (!subscribersList || subscribersList.length === 0) {
				// No subscribers found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare parallel reward operations for all subscribers
			const segmentLeadRewardLogs = db.collection(TABLE_SEGMENT_LEAD_REWARD_LOGS);

			// Use Promise.all to process all subscribers in parallel for faster response
			await Promise.all(subscribersList.map(async (record) => {
				const userEmail = record.email || "";
				const userFullName = record.full_name || "";
				const validateString = record.validate_string || "";
				const userExistsDetails = record.user_details || {};
				const userExistsId = userExistsDetails._id ? userExistsDetails._id : "";

				if (userExistsId) {
					// If user exists, assign reward directly
					const addEarnRewardsOptions = {
						assign_reward: rewardId,
						reward_send_user_id: userExistsId,
						login_user_email: userExistsDetails.email,
						login_user_full_name: userExistsDetails.full_name,
						template_type: LEADS_SEGMENT_REWARD_TYPE,
						lead_forms_id: leadFormsId,
						login_user_data: userExistsDetails,
						image: rewardImage,
					};
					await addUserEarnRewards(req, res, addEarnRewardsOptions);
				} else {
					// If user does not exist, log reward and send email
					const insertData = {
						reward_id: newObjectIdDefault(rewardId),
						send_by: newObjectIdDefault(userId),
						title: rewardTitle,
						sub_title: rewardSubTitle,
						image: rewardImage,
						user_email: userEmail,
						template_type: LEADS_SEGMENT_REWARD_TYPE,
						lead_forms_id: leadFormsId,
						validate_string: validateString,
						created: getUtcDate()
					};
					await segmentLeadRewardLogs.insertOne(insertData);

					const linkCompleteProfile = FRONT_URL + "complete-profile/create/" + validateString;
					const fullName = userFullName !== "" ? userFullName : userEmail;

					// Prepare reward image card for email
					let rewardImageSrc = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD;
					if (rewardId !== '') {
						const randomWalletRewardIndex = Math.floor(Math.random() * WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR.length);
						const randomRewardWalletColor = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR[randomWalletRewardIndex];
						rewardImageSrc = rewardImageSrc.replace(RegExp('{WALLET_RANDOM_COLOR_GRADIANT}', 'g'), randomRewardWalletColor);

						const publicBusinessInformaton = loginUserData.public_business_informaton || "";
						const businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
						const businessIndustryName = (publicBusinessInformaton && publicBusinessInformaton.business_industry_name) ? publicBusinessInformaton.business_industry_name : "";
						let profileImageUrl = FRONT_NO_IMAGE_USER_PROFILE_URL;
						if (businessLogo !== '') {
							profileImageUrl = USERS_URL + businessLogo;
						}
						rewardImageSrc = rewardImageSrc.replace(RegExp('{BUSINESS_INDUSTRY}', 'g'), businessIndustryName);
						rewardImageSrc = rewardImageSrc.replace(RegExp('{REWARD_HEADING}', 'g'), rewardTitle);
						rewardImageSrc = rewardImageSrc.replace(RegExp('{REWARD_SUBHEADING}', 'g'), rewardSubTitle);
						rewardImageSrc = rewardImageSrc.replace(RegExp('{USER_PROFILE_IMAGE}', 'g'), profileImageUrl);
					} else {
						rewardImageSrc = "";
					}

					// Set options for sending email
					const emailOptions = {
						to: userEmail,
						action: "complete_profile_segment_lead_reward",
						rep_array: [DEAR_HI_CONSTANT, fullName, linkCompleteProfile, rewardImageSrc]
					};
					await sendMail(req, res, emailOptions);
				}
			}));

			// Mark all processed leads as rewarded
			await leadsFormsSubscriber.updateMany(conditions, {
				$set: {
					is_rewarded: ACTIVE
				},
			});

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.leads.reward_is_sent_successfully")
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End sendSegmentLeadsRewards()

	/**
	 * Function to get loyalist users using async/await and Promise.all for parallel queries.
	 *
	 * @return json 
	 **/
	this.getLoyalist = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";
			const zipSearchKeyword = isNaN(searchKeyword) ? searchKeyword : Number(searchKeyword);
			const skip = (limit * page) - limit;

			const collection = db.collection(TABLE_USERS);

			// Permission check
			if (!userId || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare condition to get loyalist user ids
			const totalCountCondition = {
				user_id: { $nin: [null, ""] },
				make_poll_user_id: userId
			};

			// Get loyalist user ids
			const distincUsers = await getLoyalistUserIds(totalCountCondition);
			const userIds = distincUsers?.user_ids || [];

			// Prepare user query conditions
			const userConditions = {
				_id: { $in: userIds },
				$or: [
					{ first_name: { $regex: new RegExp(searchKeyword, "i") } },
					{ last_name: { $regex: new RegExp(searchKeyword, "i") } },
					{ full_name: { $regex: new RegExp(searchKeyword, "i") } },
					{ email: { $regex: new RegExp(searchKeyword, "i") } },
					{ mobile: { $regex: new RegExp(searchKeyword, "i") } },
					{ zip: zipSearchKeyword },
				]
			};

			// Run all queries in parallel for better performance
			const [
				loyalistUsers,
				loyalistCountResponse,
				exportToExcelRecords
			] = await Promise.all([
				// Get paginated loyalist users
				collection.find(userConditions, {
					projection: {
						_id: 1,
						first_name: "$fname",
						last_name: "$lname",
						slug: 1,
						mobile: 1,
						zip: 1,
						gender: 1,
						age: 1,
						dob: 1,
						created: 1,
						email: 1,
						full_name: 1,
						user_full_name: "$full_name",
						name_of_the_business: { $cond: ["$public_business_informaton.name_of_the_business", "$public_business_informaton.name_of_the_business", ""] },
					}
				})
					.sort({ created: SORT_DESC })
					.skip(skip)
					.limit(limit)
					.toArray(),

				// Get total count of loyalist users
				(async () => {
					const loyalistResponse = await getLoyalistUserIds(totalCountCondition);
					return loyalistResponse.total_user || 0;
				})(),

				// Get all loyalist users for export to excel
				collection.find(
					{ _id: { $in: userIds } },
					{
						projection: {
							_id: 1,
							first_name: "$fname",
							last_name: "$lname",
							slug: 1,
							mobile: 1,
							zip: 1,
							gender: 1,
							age: 1,
							dob: 1,
							created: 1,
							email: 1,
							full_name: 1,
							user_full_name: "$full_name",
							name_of_the_business: { $cond: ["$public_business_informaton.name_of_the_business", "$public_business_informaton.name_of_the_business", ""] },
						}
					}
				)
					.sort({ created: SORT_DESC })
					.toArray()
			]);

			// Prepare and return response
			if (loyalistUsers && loyalistUsers.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: loyalistUsers,
						recordsTotal: loyalistCountResponse,
						total_all_leads_count: loyalistCountResponse,
						export_to_excel_records: exportToExcelRecords,
						total_hybrid_count: 0,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(loyalistCountResponse / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: [],
						total_all_leads_count: 0,
						recordsTotal: 0,
						total_hybrid_count: 0,
						export_to_excel_records: [],
						limit: limit,
						page: page,
						message: res.__("front.global.no_record_found"),
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getLoyalist()

	/**
	 * Function to edit user profile after getting creator id and lead id.
	 * Uses async/await for optimal performance.
	 *
	 * @return json 
	 **/
	this.getSignupLeadFormsDataAccordingEditUser = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user id from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			// Permission check
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

			// Query signup lead form data using async/await
			const resultData = await signupLeadForms.findOne(
				{
					email_user_id: newObjectIdDefault(userId),
					stage_level: { $ne: HOT_LEADS_LEVEL }
				},
				{
					projection: {
						_id: 1,
						creator_id: 1,
						lead_forms_id: 1,
						validate_string: 1
					}
				}
			);

			// Prepare and return response
			if (resultData) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: resultData,
						message: ""
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: "",
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: "",
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSignupLeadFormsDataAccordingEditUser()

	/**
	 * Function to get welcome list dropdown data using async/await for optimal performance.
	 *
	 * @return json 
	 **/
	this.welcomeEmailDropdownList = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user id from request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// Permission check
			if (!userId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: [],
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch welcome email list data asynchronously
			const responseEmailData = await getWelcomeEmailData(userId);

			finalResponse = {
				data: {
					status: responseEmailData.status,
					result: responseEmailData.result,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End welcomeEmailDropdownList()


	/**
	 * Function to assign a welcome email for lead capture data using async/await.
	 *
	 * @return json 
	 **/
	this.assignWelcomeEmailInLeadCapture = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
			const leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
			const assignWelcomeEmailId = req.body.assign_welcome_email_id ? newObjectIdDefault(req.body.assign_welcome_email_id) : "";

			// Permission check
			if (!userId || !leadFormsId || !assignWelcomeEmailId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for assigning welcome email
			const optionsData = {
				lead_forms_id: leadFormsId,
				assign_welcome_email_id: assignWelcomeEmailId
			};

			// Assign welcome email asynchronously
			const assignRewardResponse = await leadCaptureForAssignWelcomeEmail(req, res, optionsData);

			// Send response
			finalResponse = {
				data: {
					status: assignRewardResponse.status,
					message: assignRewardResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End assignWelcomeEmailInLeadCapture()


	/**
	 * Function to update lead status using async/await for optimal performance.
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.updateLeadStatus = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const leadFormsId = req.body.lead_forms_id ? req.body.lead_forms_id : "";
			const status = req.body.status ? req.body.status : "";
			const pageType = req.body.page_type ? req.body.page_type : "";

			// Permission check
			if (!userId || !leadFormsId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare update options
			const updateOption = {
				lead_forms_id: leadFormsId,
				user_id: userId,
				is_active: status,
			};

			// Update lead status asynchronously
			const updateResponse = await updateLeadStatus(req, res, updateOption);

			// Send response
			finalResponse = {
				data: {
					status: updateResponse.status,
					message: (pageType == CONTEST_PAGE_TYPE)
						? res.__("front.leads.contest_status_has_been_updated_successfully")
						: res.__("front.leads.status_has_been_updated_successfully."),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End updateLeadStatus()

	/**
	 * Function to validate if a welcome email has already been sent to selected subscribers.
	 *
	 * Uses async/await and Promise.all for parallel queries for optimal performance.
	 *
	 * @return json 
	 **/
	this.validateSendWelcomeEmail = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const selectedWelcomeEmail = req.body.selected_welcome_email ? newObjectIdDefault(req.body.selected_welcome_email) : "";
			const subscriberEmailsData = req.body.subscriber_emails ? req.body.subscriber_emails : [];
			const stageLevel = req.body.stage_level ? req.body.stage_level : "";

			// Set collection tables
			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			const againSentWlcWmailSubscriberUser = db.collection(TABLE_AGAIN_SENT_WLC_EMAIL_SUBSCRIBER_USER);

			// Permission check
			if (!userId || !stageLevel || !selectedWelcomeEmail || subscriberEmailsData.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query conditions
			let commonCondition = {
				creator_id: userId,
				is_deleted: NOT_DELETED
			};
			let commonSentCondition = {
				user_id: userId,
				selected_welcome_email_id: selectedWelcomeEmail,
			};

			if (subscriberEmailsData.length > 0) {
				commonCondition.email = { $in: subscriberEmailsData };
				commonSentCondition.email = { $in: subscriberEmailsData };
			}
			if (stageLevel) {
				commonCondition.stage_level = stageLevel;
				commonSentCondition.stage_level = stageLevel;
			}

			// Run both queries in parallel for better performance
			const [
				totalSubscriberUser,
				totalSendWelcomeSubscriberUser
			] = await Promise.all([
				leadsFormsSubscriber.countDocuments(commonCondition),
				againSentWlcWmailSubscriberUser.countDocuments(commonSentCondition)
			]);

			// Business logic for validation
			if (totalSendWelcomeSubscriberUser > 0) {
				if (totalSubscriberUser === 1 && totalSubscriberUser === totalSendWelcomeSubscriberUser) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.welcome_email_is_already_sent_to_this_user")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else if (totalSubscriberUser > 1 && totalSubscriberUser === totalSendWelcomeSubscriberUser) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.welcome_email_is_already_sent_to_all_users")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.welcome_email_is_already_sent_to_the_users_out_of_total_users", totalSendWelcomeSubscriberUser, totalSubscriberUser)
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// No welcome email sent yet to these users
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End validateSendWelcomeEmail()

	/**
	 * Function to send welcome email again to lead subscriber users.
	 * Uses async/await and Promise.all for optimal performance.
	 *
	 * @return json 
	 **/
	this.againLeadSubscriberUserWelcomeEmailSend = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const selectedWelcomeEmail = req.body.selected_welcome_email ? newObjectIdDefault(req.body.selected_welcome_email) : "";
			const subscriberEmailsData = req.body.subscriber_emails ? req.body.subscriber_emails : [];
			const stageLevel = req.body.stage_level ? req.body.stage_level : "";
			const excludeRewarded = req.body.exclude_rewarded ? true : false;

			// Set collection tables
			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			const againSentWlcWmailSubscriberUser = db.collection(TABLE_AGAIN_SENT_WLC_EMAIL_SUBSCRIBER_USER);

			// Permission check
			if (!userId || !selectedWelcomeEmail || subscriberEmailsData.length === 0 || !stageLevel) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query conditions
			let conditionData = {
				creator_id: userId,
				is_deleted: NOT_DELETED
			};
			let commonSentCondition = {
				user_id: userId,
				selected_welcome_email_id: selectedWelcomeEmail
			};

			if (subscriberEmailsData.length > 0) {
				conditionData.email = { $in: subscriberEmailsData };
				commonSentCondition.email = { $in: subscriberEmailsData };
			}
			if (stageLevel) {
				conditionData.stage_level = stageLevel;
				commonSentCondition.stage_level = stageLevel;
			}

			// Get already sent welcome email subscriber IDs
			const alreadySentIds = await againSentWlcWmailSubscriberUser.distinct("lead_forms_subscriber_id", commonSentCondition);

			// If excludeRewarded is true, exclude already sent users
			if (excludeRewarded === true && alreadySentIds && alreadySentIds.length > 0) {
				conditionData._id = { $nin: alreadySentIds };
			}

			// Get subscriber list data
			const resultSubscriber = await leadsFormsSubscriber.find(conditionData).toArray();

			if (resultSubscriber && resultSubscriber.length > 0) {
				// Prepare insert operations for all subscribers in parallel
				const insertOps = resultSubscriber.map(recordLeadsSubscriber => {
					const welcomeEmailUnsubscribed = recordLeadsSubscriber.welcome_email_unsubscribed ? recordLeadsSubscriber.welcome_email_unsubscribed : false;
					return {
						user_id: userId,
						lead_forms_id: recordLeadsSubscriber.lead_forms_id ? recordLeadsSubscriber.lead_forms_id : "",
						lead_forms_subscriber_id: recordLeadsSubscriber._id ? recordLeadsSubscriber._id : "",
						lead_forms_slug: recordLeadsSubscriber.lead_forms_slug ? recordLeadsSubscriber.lead_forms_slug : "",
						stage_level: recordLeadsSubscriber.stage_level ? recordLeadsSubscriber.stage_level : "",
						email: recordLeadsSubscriber.email ? recordLeadsSubscriber.email : "",
						selected_welcome_email_id: selectedWelcomeEmail,
						welcome_email_unsubscribed: welcomeEmailUnsubscribed,
						is_sent: IS_WELCOME_EMAIL_PROCESSING_STATUS,
						created: getUtcDate(),
						modified: getUtcDate()
					};
				});

				// Insert all records in parallel for better performance
				await Promise.all(
					insertOps.map(doc => againSentWlcWmailSubscriberUser.insertOne(doc))
				);

				// Send success message
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: res.__("front.leads.lead_subscriber_again_email_has_been_successfully")
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// No users found to send email
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.leads.there_are_no_users_no_email_has_been_sent_for_this")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End againLeadSubscriberUserWelcomeEmailSend()

	/**
	 * Function to fetch assigned welcome email and reward data for a lead.
	 * Uses async/await for efficient query handling.
	 *
	 * @return json
	 **/
	this.leadAccordingAssignEmailAndReward = async (req, res, next) => {
		let finalResponse = {};

		// Extract user and lead form slug from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";

		// Permission check
		if (!userId || !leadFormsSlug) {
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
			const leadsForms = db.collection(TABLE_LEAD_FORMS);

			// Aggregate to fetch lead form with assigned welcome email and reward details
			const [leadData] = await leadsForms.aggregate([
				{
					$match: {
						user_id: newObjectIdDefault(userId),
						slug: leadFormsSlug
					}
				},
				{
					$lookup: {
						from: TABLE_EMAIL_NEWSLETTER_TEMPLATE,
						localField: 'assign_welcome_email_id',
						foreignField: '_id',
						as: 'emailTemplateDetail'
					}
				},
				{
					$project: {
						assign_welcome_email_id: 1,
						emailTemplateDetail: { $arrayElemAt: ['$emailTemplateDetail', 0] }
					}
				}
			]).toArray();

			// If no record found, return error
			if (!leadData) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const assignWelcomeEmailId = leadData.assign_welcome_email_id || "";
			const attachReward = leadData.emailTemplateDetail?.attach_reward || "";

			// Return success if both assignWelcomeEmailId and attachReward exist
			if (assignWelcomeEmailId && attachReward) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {
							assign_welcome_email_id: assignWelcomeEmailId,
							attach_reward_id: attachReward
						},
						message: "",
					}
				};
			} else {
				// If either is missing, return error with empty result
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {
							assign_welcome_email_id: "",
							attach_reward_id: ""
						},
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End leadAccordingAssignEmailAndReward()


}
module.exports = new LeadForm();
