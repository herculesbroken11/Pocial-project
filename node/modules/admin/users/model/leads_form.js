const async = require("async");
const { response } = require("express");

function LeadsForm() {

	/**
	 * Function to get list of leads form
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.getLeadsFormList = async (req, res) => {
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";

			const collection = db.collection(TABLE_LEAD_FORMS);

			// Set common query conditions
			let commonConditions = {
				is_deleted: NOT_DELETED,
				user_id: newObjectIdDefault(userId)
			};

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Merge datatable conditions with common conditions
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['modified'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// --- Run all queries in parallel using Promise.all ---
				const [
					leadsFormList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get paginated leads form list with user details
					collection.aggregate([
						{ $match: dataTableConfig.conditions },
						{
							$lookup: {
								from: TABLE_USERS,
								let: { userId: "$user_id" },
								pipeline: [
									{
										$match: {
											$expr: {
												$and: [
													{ $eq: ["$_id", "$$userId"] },
												]
											},
										}
									},
									{ "$project": { full_name: 1 } }
								],
								as: "userDetails"
							}
						},
						{
							$addFields: {
								"user_full_name": { $arrayElemAt: ["$userDetails.full_name", 0] }
							}
						},
						{ $sort: dataTableConfig.sort_conditions },
						{ $skip: skip },
						{ $limit: limit },
					]).toArray(),

					// Get total number of records in leads form collection (not filtered)
					collection.countDocuments(commonConditions),

					// Get filtered records count in leads form (with filters)
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// --- Send response with results ---
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: leadsFormList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// Handle errors gracefully
				console.error("Error in getLeadsFormList:", err);
				res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// Render listing page
			req.breadcrumbs(BREADCRUMBS["admin/leads_form/list"]);
			res.render("manage_leads/list", {
				user_type: userType,
				user_id: userId,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userType,
			});
		}
	}; // end getLeadsFormList()

	/**
	 * Function for add leads
	 *
	 * @param req 	As 	Request Data
	 * @param res 	As 	Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.addLeads = async (req, res, next) => {
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// --- Sanitize Data ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			try {
				// --- Extract and prepare form fields ---
				let title = req.body.title || "";
				let description = req.body.description || "";
				let textDisplay = req.body.text_to_display || "";
				let displayUrlDescription = req.body.display_url_description || "";
				let signinOption = req.body.signin_option || SIGNIN_OPTION_NO;
				let kioskOption = req.body.kiosk_option || KIOSK_OPTION_NO;
				let signupFields = req.body.signup_fields ? JSON.parse(req.body.signup_fields) : ["email"];
				let mandatoryOptions = req.body.mandatory_options ? JSON.parse(req.body.mandatory_options) : ["email"];
				let buttonName = req.body.button_name || "";
				let messageBoxTitle = req.body.message_box_title ? JSON.parse(req.body.message_box_title) : [];
				let typeDropdownTitle = req.body.type_dropdown_title ? JSON.parse(req.body.type_dropdown_title) : [];
				let formTitle = req.body.form_title || "";
				let notifyEmail = req.body.notify_email ? req.body.notify_email.split(",") : [];
				let customThankYouTitle = req.body.custom_thank_you_title || "";
				let customThankYouMessage = req.body.custom_thank_you_message || "";
				let assignWelcomeEmailId = req.body.assign_welcome_email ? newObjectIdDefault(req.body.assign_welcome_email) : "";
				let notifyEmailType = req.body.notify_email_type || "";
				let notifyEmailSendType = (notifyEmailType == LEAD_CAMPAIGN_NOTIFY_EMAIL_ALL) ? JSON.parse(req.body.notify_email_send_type) : [];

				// --- Prepare dropdown custom options for frontend display ---
				if (typeDropdownTitle.length > 0) {
					typeDropdownTitle.forEach(item => {
						item.custom_options = item.option_key_value.map(opt => ({
							display: opt.name,
							value: opt.name
						}));
					});
				}

				let imageUrl = req.body.image_url || "";
				let image = (req.files && req.files.image) ? req.files.image : "";

				let imageUrlName = "";
				let imageFlagError = false;
				let errMessageArray = [];
				let notifyEmailArray = [];

				// --- Prepare notify email array for saving ---
				if (notifyEmail.length > 0) {
					notifyEmail.forEach(records => {
						notifyEmailArray.push({
							display: records,
							value: records,
						});
					});
				}

				// --- Validate image and email fields ---
				if (imageUrl !== "" && image !== "") {
					imageFlagError = true;
				}
				if (notifyEmail.length > 0 && checkDuplicate(notifyEmail) === true) {
					errMessageArray.push({ param: 'notify_email', msg: res.__("admin.leads.email_contains_duplicate_elements") });
				}
				if (imageFlagError === true) {
					errMessageArray.push({ param: 'image', msg: res.__("front.leads.please_select_image") });
				}

				// --- Upload image from URL if provided ---
				if (imageUrl !== '') {
					let optionsImage = {
						url: imageUrl,
						dest: LEADS_FORM_FILE_PATH,
					};
					const imageResponse = await downloadImageToUrl(res, req, optionsImage);
					if (imageResponse.status === STATUS_ERROR) {
						errMessageArray.push({ param: 'image_url', msg: imageResponse.message });
					}
					imageUrlName = imageResponse.fileName ? imageResponse.fileName : "";
				}

				// --- Upload user image if provided ---
				let imageName = "";
				if (image) {
					let options = {
						image: image,
						filePath: LEADS_FORM_FILE_PATH,
					};
					const response = await moveUploadedFile(req, res, options);
					if (response.status === STATUS_ERROR) {
						errMessageArray.push({ param: 'image', msg: response.message });
					}
					imageName = response.fileName ? response.fileName : "";
				}

				// --- If any validation or upload errors, send error response ---
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// --- Determine which image to save and its type ---
				let imageSaveName = imageUrlName !== '' ? imageUrlName : imageName;
				let graphicTypeName = imageUrlName !== '' ? URL_IMAGE : (imageName !== "" ? UPLOAD_IMAGE : "");

				if (imageUrlName === '' && imageName === "") {
					imageSaveName = "";
					graphicTypeName = "";
				}

				// --- Prepare lead form data for saving ---
				let optionLeads = {
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
					notify_email: notifyEmailArray,
					notify_email_type: notifyEmailType,
					notify_email_send_type: notifyEmailSendType,
					image: imageSaveName,
					graphic_type: graphicTypeName,
					custom_thank_you_title: customThankYouTitle,
					custom_thank_you_message: customThankYouMessage,
					assign_welcome_email_id: assignWelcomeEmailId,
				};

				// --- Save lead capture form (async) ---
				await saveLeadCaptureForm(req, res, optionLeads);

				// --- Send success response ---
				let messageStr = res.__("front.leads.leads_form_has_been_submitted_successfully");
				req.flash(STATUS_SUCCESS, messageStr);
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId,
					message: messageStr,
				});
			} catch (e) {
				// --- Handle errors gracefully ---
				console.error("Error in addLeads:", e);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		} else {
			// --- Render add leads form page with welcome email dropdown (async) ---
			try {
				req.breadcrumbs(BREADCRUMBS["admin/leads_form/add"]);
				const responseEamilData = await getWelcomeEmailData(userId);
				return res.render("manage_leads/add", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					welcomeEmailDropdownListData: (responseEamilData && responseEamilData.result) ? responseEamilData.result : []
				});
			} catch (e) {
				console.error("Error rendering add leads form:", e);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end addLeads()

	/**
	 * Function for view leads details
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.viewLeads = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId || !leadId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		try {
			// --- Get lead details from database ---
			const collection = db.collection(TABLE_LEAD_FORMS);
			const result = await collection.aggregate([
				{
					$match: {
						_id: leadId
					}
				}
			]).toArray();

			// --- If no result found, handle invalid access ---
			if (!result || result.length === 0) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
				return;
			}

			// --- Set options for appending image full path ---
			let options = {
				"file_url": LEADS_FORM_URL,
				"file_path": LEADS_FORM_FILE_PATH,
				"result": [result[0]],
				"database_field": "image"
			};

			// --- Append image with full path (async) ---
			const fileResponse = await appendFileExistData(options);

			// --- Render view page with lead details ---
			req.breadcrumbs(BREADCRUMBS["admin/leads_form/view"]);
			res.render("manage_leads/view", {
				user_type: userType,
				user_id: userId,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userId,
				result: (fileResponse && fileResponse.result && fileResponse.result[0]) ? fileResponse.result[0] : {},
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in viewLeads:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // End viewLeads()

	/**
	 * Function to edit a lead
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.editLead = async (req, res, next) => {
		let leadId = req.params.id ? newObjectIdDefault(req.params.id) : "";
		let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		let userType = req.params.user_type ? req.params.user_type : "";

		if (!userType || !userId || !leadId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		const collection = db.collection(TABLE_LEAD_FORMS);

		if (isPost(req)) {
			// --- Sanitize Data ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			try {
				// --- Extract and prepare form fields ---
				let title = req.body.title || "";
				let description = req.body.description || "";
				let textDisplay = req.body.text_to_display || "";
				let displayUrlDescription = req.body.display_url_description || "";
				let signinOption = req.body.signin_option || SIGNIN_OPTION_NO;
				let kioskOption = req.body.kiosk_option || KIOSK_OPTION_NO;
				let signupFields = req.body.signup_fields ? JSON.parse(req.body.signup_fields) : ["email"];
				let mandatoryOptions = req.body.mandatory_options ? JSON.parse(req.body.mandatory_options) : ["email"];
				let buttonName = req.body.button_name || "";
				let messageBoxTitle = req.body.message_box_title ? JSON.parse(req.body.message_box_title) : [];
				let typeDropdownTitle = req.body.type_dropdown_title ? JSON.parse(req.body.type_dropdown_title) : [];
				let formTitle = req.body.form_title || "";
				let notifyEmail = req.body.notify_email ? req.body.notify_email.split(",") : [];
				let customThankYouTitle = req.body.custom_thank_you_title || "";
				let customThankYouMessage = req.body.custom_thank_you_message || "";
				let assignWelcomeEmailId = req.body.assign_welcome_email ? newObjectIdDefault(req.body.assign_welcome_email) : "";
				let notifyEmailType = req.body.notify_email_type || "";
				let notifyEmailSendType = (notifyEmailType == LEAD_CAMPAIGN_NOTIFY_EMAIL_ALL) ? JSON.parse(req.body.notify_email_send_type) : [];

				// --- Prepare dropdown custom options for frontend display ---
				if (typeDropdownTitle.length > 0) {
					typeDropdownTitle.forEach(item => {
						item.custom_options = item.option_key_value.map(opt => ({
							display: opt.name,
							value: opt.name
						}));
					});
				}

				let imageUrl = req.body.image_url || "";
				let image = (req.files && req.files.image) ? req.files.image : "";
				let oldimage = req.body.old_image || "";

				let imageUrlName = "";
				let imageFlagError = false;
				let errMessageArray = [];
				let notifyEmailArray = [];

				// --- Prepare notifyEmail array for storage ---
				if (notifyEmail.length > 0) {
					notifyEmail.forEach(records => {
						notifyEmailArray.push({
							display: records,
							value: records,
						});
					});
				}

				// --- Check for both image and image url provided ---
				if (imageUrl !== "" && image) {
					imageFlagError = true;
				}

				// --- Check for duplicate emails ---
				if (notifyEmail.length > 0 && checkDuplicate(notifyEmail) === true) {
					errMessageArray.push({ param: 'notify_email', msg: res.__("admin.leads.email_contains_duplicate_elements") });
				}

				// --- If both image and image url are provided, add error ---
				if (imageFlagError === true) {
					errMessageArray.push({ param: 'image', msg: res.__("front.leads.please_select_image") });
				}

				// --- Handle image upload from URL ---
				if (imageUrl !== '') {
					let optionsImage = {
						url: imageUrl,
						dest: LEADS_FORM_FILE_PATH,
					};
					let imageResponse = await downloadImageToUrl(res, req, optionsImage);
					if (imageResponse.status === STATUS_ERROR) {
						errMessageArray.push({ param: 'image_url', msg: imageResponse.message });
					}
					imageUrlName = imageResponse.fileName ? imageResponse.fileName : "";
				}

				// --- If there are errors, send error response ---
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// --- Handle file upload (if any) ---
				let imageName = "";
				let imageSaveName = "";
				let graphicTypeName = "";

				try {
					let options = {
						image: image,
						filePath: LEADS_FORM_FILE_PATH,
						oldPath: oldimage
					};
					let response = await moveUploadedFile(req, res, options);

					if (response.status === STATUS_ERROR) {
						errMessageArray.push({ param: 'image', msg: response.message });
						return res.send({
							status: STATUS_ERROR,
							message: errMessageArray,
						});
					}

					imageName = response.fileName ? response.fileName : "";
					imageSaveName = (imageUrlName !== '') ? imageUrlName : imageName;
					graphicTypeName = (imageUrlName !== '') ? URL_IMAGE : UPLOAD_IMAGE;

					if (imageUrlName === '' && imageName === "") {
						imageSaveName = "";
						graphicTypeName = "";
					}
				} catch (fileErr) {
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId,
						message: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
					});
				}

				// --- Update lead information in database ---
				try {
					await collection.updateOne(
						{ _id: leadId },
						{
							$set: {
								'title': title,
								'description': description,
								'text_to_display': textDisplay,
								'display_url_description': displayUrlDescription,
								'button_name': buttonName,
								'notify_email': notifyEmailArray,
								'notify_email_type': notifyEmailType,
								'notify_email_send_type': notifyEmailSendType,
								'image': imageSaveName,
								'graphic_type': graphicTypeName,
								'signin_option': signinOption,
								'kiosk_option': kioskOption,
								'signup_fields': signupFields,
								'mandatory_options': mandatoryOptions,
								'message_box_title': messageBoxTitle,
								'type_dropdown_title': typeDropdownTitle,
								'message_field_count': messageBoxTitle.length,
								'dropdown_field_count': typeDropdownTitle.length,
								'form_title': formTitle,
								'custom_thank_you_title': customThankYouTitle,
								'custom_thank_you_message': customThankYouMessage,
								'assign_welcome_email_id': assignWelcomeEmailId,
							}
						}
					);

					// --- Send success response ---
					req.flash(STATUS_SUCCESS, res.__("front.leads.leads_form_has_been_updated_successfully"));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId,
						message: res.__("front.leads.leads_form_has_been_updated_successfully"),
					});
				} catch (err) {
					// --- Handle update error ---
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId,
						message: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
					});
				}
			} catch (e) {
				// --- Handle general error ---
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId,
					message: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		} else {
			// --- Get lead details and welcome email data in parallel ---
			try {
				const [leadResponse, welcomeEmailData] = await Promise.all([
					collection.findOne({ _id: leadId }),
					getWelcomeEmailData(userId)
				]);

				if (!leadResponse) {
					req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
				}

				// --- Convert notifyEmail array to string for display ---
				let notifyEmailArray = [];
				let notifyEmail = leadResponse.notify_email ? leadResponse.notify_email : [];
				if (notifyEmail.length > 0) {
					notifyEmail.forEach(records => {
						notifyEmailArray.push(records.value);
					});
				}

				// --- Render edit page with lead details and welcome email dropdown ---
				req.breadcrumbs(BREADCRUMBS["admin/leads_form/edit"]);
				return res.render("manage_leads/edit", {
					'user_type': userType,
					'user_id': userId,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'result': leadResponse || {},
					'notify_email': (notifyEmail.length > 0) ? notifyEmailArray.toString() : "",
					'welcomeEmailDropdownListData': (welcomeEmailData && welcomeEmailData.result) ? welcomeEmailData.result : []
				});
			} catch (err) {
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
			}
		}
	};

	/**
	 * Function to delete a lead
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.deleteLead = async (req, res, next) => {
		// --- Extract and validate parameters ---
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		if (!userType || !userId || !leadId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		try {
			// --- Delete the lead document (async) ---
			const deleteResult = await leadsForms.deleteOne({
				user_id: newObjectIdDefault(userId),
				_id: leadId,
				is_default: DEFAULT_ZERO,
				is_subscriber: DEFAULT_ZERO
			});

			// --- Check if a document was deleted ---
			if (deleteResult.deletedCount === 0) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
			}

			// --- Send success response ---
			req.flash(STATUS_SUCCESS, res.__("front.leads.leads_has_been_delete_successfully"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in deleteLead:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
		}
	}; // end deleteLead()

	/**
	 * Function to get scripted code for a lead
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.getScriptedCode = async (req, res, next) => {
		try {
			// --- Extract and validate parameters ---
			let leadId = req.params.id ? newObjectIdDefault(req.params.id) : "";
			let userId = req.body.user_id ? newObjectIdDefault(req.body.user_id) : "";

			// --- Prepare options for generating scripted code ---
			let optionsData = { lead_slug: '', lead_id: leadId, user_id: userId };

			// --- Generate scripted code asynchronously ---
			const response = await generateScriptedCode(req, res, optionsData);

			// --- Send response with generated code ---
			res.send({
				status: response.status,
				result: response.result,
				customized_script_id: response.customized_script_id
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in getScriptedCode:", err);
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end getScriptedCode()

	/**
	 * Function for view entire subscriber
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.viewEntireSubscriber = async (req, res) => {
		try {
			// --- Extract and validate parameters ---
			let leadId = req && req.params && req.params.id ? newObjectIdDefault(req.params.id) : "";
			let userId = req && req.params && req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
			let userType = req && req.params && req.params.user_type ? req.params.user_type : "";
			let stageLevel = req && req.params && req.params.stage_level ? req.params.stage_level : "";
			let leadsImportSlug = req && req.params && req.params.leads_import_slug ? req.params.leads_import_slug : "";

			let body = (req && req.body) ? req.body : {};
			let fromDate = body.fromDate ? body.fromDate : "";
			let toDate = body.toDate ? body.toDate : "";
			let searchWinner = body.search_winner ? parseInt(body.search_winner) : "";
			let searchReward = body.search_reward ? parseInt(body.search_reward) : "";

			const leadFormCollection = db.collection(TABLE_LEAD_FORMS);

			if (!userType || !userId || !leadId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			if (isPost(req)) {
				let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
				let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

				const collection = db.collection(TABLE_SIGNUP_LEAD_FORMS);
				const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

				// --- Build common conditions for queries ---
				let commonConditions = { lead_forms_id: leadId };

				// --- Stage level specific conditions ---
				if (stageLevel !== '' && stageLevel !== LEADS_IMPORT_TO_VIEWENTRIES_PAGE) {
					if (stageLevel == LOYALIST_LEVEL) {
						commonConditions = {
							'email_user_id': { $exists: true },
							'creator_id': newObjectIdDefault(userId),
							'stage_level': HOT_LEADS_LEVEL,
						};
					} else {
						commonConditions = {
							'creator_id': newObjectIdDefault(userId),
							'stage_level': stageLevel
						};
					}
				}

				// --- Excel import specific condition ---
				if (leadsImportSlug !== '' && stageLevel == LEADS_IMPORT_TO_VIEWENTRIES_PAGE) {
					let leadFormsSubscriberId = await getUserSubscriberIdsArray(leadsImportSlug);
					commonConditions['_id'] = { $in: leadFormsSubscriberId };
				}

				// --- Get datatable config (async) ---
				const dataTableConfig = await configDatatable(req, res, null);
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// --- Date range filter ---
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['modified'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// --- Winner filter ---
				if (searchWinner !== "" && searchWinner == ACTIVE) {
					dataTableConfig.conditions["is_winner"] = searchWinner;
				} else if (searchWinner !== "" && searchWinner == DEACTIVE) {
					dataTableConfig.conditions["is_winner"] = { $exists: false };
				} else {
					delete dataTableConfig.conditions["is_winner"];
				}

				// --- Reward filter ---
				if (searchReward !== "" && searchReward == ACTIVE) {
					dataTableConfig.conditions["is_rewarded"] = searchReward;
				} else if (searchReward !== "" && searchReward == DEACTIVE) {
					dataTableConfig.conditions["is_rewarded"] = { $exists: false };
				} else {
					delete dataTableConfig.conditions["is_rewarded"];
				}

				// --- Handle loyalist level with parallel queries ---
				if (stageLevel !== '' && stageLevel == LOYALIST_LEVEL) {
					// --- Parallel queries for loyalist level ---
					const [
						loyalistList,
						totalLoyalistCount,
						filteredLoyalistCount
					] = await Promise.all([
						// Get loyalist list with vote details
						collection.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$lookup: {
									from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
									let: { userId: "$email_user_id" },
									pipeline: [
										{
											$match: {
												$expr: {
													$and: [
														{ $eq: ["$user_id", "$$userId"] },
													]
												},
											}
										},
										{ "$project": { _id: 1 } }
									],
									as: "voteDetails"
								}
							},
							{
								$match: {
									voteDetails: { $ne: [] }
								}
							},
							{
								$group: {
									_id: "$email_user_id",
									'first_name': { $last: "$first_name" },
									'last_name': { $last: "$last_name" },
									'full_name': { $last: "$full_name" },
									'slug': { $last: "$slug" },
									'email': { $last: "$email" },
									'creator_name': { $last: "$creator_name" },
									'creator_id': { $last: "$creator_id" },
									'lead_forms_id': { $last: "$lead_forms_id" },
									'lead_forms_slug': { $last: "$lead_forms_slug" },
									'age': { $last: "$age" },
									'gender': { $last: "$gender" },
									'zip': { $last: "$zip" },
									'dob': { $last: "$dob" },
									'mobile': { $last: "$mobile" },
									'email_user_id': { $last: "$email_user_id" },
									'is_winner': { $last: "$is_winner" },
									'is_rewarded': { $last: "$is_rewarded" },
									'stage_level': { $last: "$stage_level" },
									'hybrid': { $last: "$hybrid" },
									'created': { $last: "$created" },
								}
							},
							{ $sort: { "created": SORT_DESC } },
							{ $skip: skip },
							{ $limit: limit },
						]).toArray(),

						// Get total loyalist count
						(async () => {
							const result = await collection.aggregate([
								{ $match: commonConditions },
								{ $group: { _id: "$email_user_id" } }
							]).toArray();
							if (result.length > 0) {
								const userIds = result.map(item => item._id);
								const countResult = await pollVoteParticipants.distinct("user_id", { 'user_id': { $in: userIds } });
								return countResult.length;
							}
							return DEFAULT_ZERO;
						})(),

						// Get filtered loyalist count
						(async () => {
							const result = await collection.aggregate([
								{ $match: dataTableConfig.conditions },
								{ $group: { _id: "$email_user_id" } }
							]).toArray();
							if (result.length > 0) {
								const userIds = result.map(item => item._id);
								const countResult = await pollVoteParticipants.distinct("user_id", { 'user_id': { $in: userIds } });
								return countResult.length;
							}
							return DEFAULT_ZERO;
						})()
					]);
					
					// --- Send response ---
					res.send({
						status: STATUS_SUCCESS,
						draw: dataTableConfig.result_draw,
						data: loyalistList || [],
						recordsFiltered: filteredLoyalistCount || 0,
						recordsTotal: totalLoyalistCount || 0
					});
				} else {
					// --- Parallel queries for normal subscriber list ---
					const [
						subscriberList,
						totalCount,
						filteredCount
					] = await Promise.all([
						// Get leads form subscriber list
						collection.aggregate([
							{ $match: dataTableConfig.conditions },
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
										{ "$project": { profile_image: 1, account_type: 1, email: 1 } }
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
							{ $sort: dataTableConfig.sort_conditions },
							{ $skip: skip },
							{ $limit: limit },
						]).toArray(),

						// Get total number of records in subscriber form collection
						collection.countDocuments(commonConditions),

						// Get filtered records count in subscriber form
						collection.countDocuments(dataTableConfig.conditions)
					]);

					// --- Send response ---
					res.send({
						status: STATUS_SUCCESS,
						draw: dataTableConfig.result_draw,
						data: subscriberList || [],
						recordsFiltered: filteredCount || 0,
						recordsTotal: totalCount || 0
					});
				}
			} else {
				// --- Render listing page ---
				if (stageLevel !== '' && stageLevel !== LEADS_IMPORT_TO_VIEWENTRIES_PAGE) {
					req.breadcrumbs(BREADCRUMBS["admin/leads_form/view_entire_subscriber_dasboard"]);
				} else if (stageLevel !== '' && stageLevel == LEADS_IMPORT_TO_VIEWENTRIES_PAGE) {
					req.breadcrumbs(BREADCRUMBS["admin/leads_form/lead_excel_view_entire_subscriber"]);
				} else {
					req.breadcrumbs(BREADCRUMBS["admin/leads_form/view_entire_subscriber"]);
				}

				const leadImport = db.collection(TABLE_LEADS_IMPORT);
				let renderData = {
					'lead_id': leadId,
					'user_type': userType,
					'user_id': userId,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'lead_dynamic_url_id': leadId,
					'stage_level': stageLevel,
					'leads_import_slug': leadsImportSlug,
					'import_lead_file_name': "",
					'import_lead_title_name': "",
				};

				// --- Get excel file data or lead form data for rendering ---
				if (leadsImportSlug) {
					try {
						const resultImport = await leadImport.findOne(
							{ 'slug': leadsImportSlug },
							{ projection: { 'file_name': 1, 'title': 1 } }
						);
						renderData['import_lead_file_name'] = (resultImport && resultImport['file_name']) ? getExcelFileName(resultImport['file_name']) : "";
						renderData['import_lead_title_name'] = (resultImport && resultImport['title']) ? resultImport['title'] : "";
						res.render("manage_leads/view_entire_subscriber", renderData);
					} catch (errImport) {
						renderData['import_lead_file_name'] = "";
						renderData['import_lead_title_name'] = "";
						res.render("manage_leads/view_entire_subscriber", renderData);
					}
				} else {
					try {
						const resultLead = await leadFormCollection.findOne(
							{ '_id': newObjectIdDefault(leadId) },
							{ projection: { 'message_box_title': 1, 'type_dropdown_title': 1 } }
						);
						renderData['message_box_title'] = (resultLead && resultLead['message_box_title']) ? resultLead['message_box_title'] : [];
						renderData['type_dropdown_title'] = (resultLead && resultLead['type_dropdown_title']) ? resultLead['type_dropdown_title'] : [];
						res.render("manage_leads/view_entire_subscriber", renderData);
					} catch (errLead) {
						renderData['message_box_title'] = [];
						renderData['type_dropdown_title'] = [];
						res.render("manage_leads/view_entire_subscriber", renderData);
					}
				}
			}
		} catch (err) {
			console.error("Error in viewEntireSubscriber:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end viewEntireSubscriber()

	/**
	 * Function to assign a lead to the home page
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.assignHomePage = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId || !leadId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		try {
			// --- Assign lead to home page asynchronously ---
			const responseData = await assignLeadHomePage(leadId);

			if (responseData === STATUS_ERROR) {
				// --- Send error response if assignment failed ---
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
				return;
			}

			// --- Send success response if assignment succeeded ---
			req.flash(STATUS_SUCCESS, res.__("admin.leads.embed_lead_assign_successfully"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
			return;
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in assignHomePage:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
		}
	}; // end assignHomePage()

	/**
	 * Function to generate embedded code for a lead form
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.generateEmbedCode = async (req, res) => {
		try {
			// --- Extract and validate parameters ---
			let leadId = (req.body.embed_lead_id) ? newObjectIdDefault(req.body.embed_lead_id) : "";
			const collection = db.collection(TABLE_LEAD_FORMS);

			// --- Fetch lead form data using async/await ---
			const resultdata = await collection.findOne({ _id: leadId });

			if (!resultdata) {
				return res.send({
					status: STATUS_ERROR,
					message: "",
					result: ""
				});
			}

			// --- Prepare variables for iframe generation ---
			let package_id = (resultdata._id) ? resultdata._id : "";
			let is_data_responsive = (req.body.make_embed_mobile_responsive) ? true : false;
			let is_hide_text = (req.body.embeded_hide_question_text) ? true : false;
			let hidequestionchecked = is_hide_text;
			let button_type_value = (req.body.button_type == BLUE_BUTTON_TYPE) ? "enter_blue" : "enter_grey";
			let iframeheight = (req.body.height) ? req.body.height : 0;
			let iframewidth = (req.body.width) ? req.body.width : 0;
			let textlinked = (req.body.text_to_be_linked) ? req.body.text_to_be_linked : "";
			let customSizeValue = (req.body.embeded_size) ? req.body.embeded_size : "";
			let backgroundColor = (req.body.background_color) ? req.body.background_color : undefined;
			let backgroundImage = (req.files && req.files.background_image) ? req.files.background_image : "";
			let backgroundImageUrl = "";
			let errMessageArray = [];

			iframeheight = isNaN(iframeheight) ? iframeheight : iframeheight + 'px';
			iframewidth = isNaN(iframewidth) ? iframewidth : iframewidth + 'px';

			// --- Handle background image upload if required ---
			if (customSizeValue != EMBED_CODE_INVISEMBED && backgroundImage != '') {
				let options = {
					'image': backgroundImage,
					'filePath': BACKGROUND_IMAGE_FILE_PATH,
					'lead_id': leadId,
					'user_id': ADMIN_ID,
				};
				const uploadImageUrl = await uplaodEmbedBackgroundImage(req, res, options);

				if (uploadImageUrl.status == STATUS_ERROR) {
					errMessageArray.push({ 'param': 'background_image', 'msg': uploadImageUrl.message });
				} else if (uploadImageUrl.status == STATUS_ERROR_INVALID_ACCESS) {
					errMessageArray.push({ 'param': 'background_image', 'msg': uploadImageUrl.message });
				} else if (uploadImageUrl.status == STATUS_SUCCESS) {
					backgroundImageUrl = uploadImageUrl.result;
				}
			}

			// --- Custom size validation ---
			if (customSizeValue == EMBED_CODE_CUSTOM_SIZE) {
				let integerIframeWidth = parseFloat(iframewidth, 10);
				let integerIframeHeight = parseFloat(iframeheight, 10);

				let imageWidthPixels = iframewidth.split(integerIframeWidth);
				let imageHeightPixels = iframeheight.split(integerIframeHeight);
				imageWidthPixels = (imageWidthPixels && imageWidthPixels[1]) ? (imageWidthPixels[1]).toLowerCase() : "px";
				imageHeightPixels = (imageHeightPixels && imageHeightPixels[1]) ? (imageHeightPixels[1]).toLowerCase() : "px";

				// --- Validation for same pixel format ---
				if (imageWidthPixels != imageHeightPixels) {
					errMessageArray.push({ 'param': 'height', 'msg': res.__("admin.leads.please_same_pixcel_value") });
				}

				let widthFormatCheck = (imageWidthPixels == 'px' || imageWidthPixels == '%') ? true : false;
				let heightFormatCheck = (imageHeightPixels == 'px' || imageHeightPixels == '%') ? true : false;

				// --- Validation for pixel format ---
				if (!widthFormatCheck) {
					errMessageArray.push({ 'param': 'width', 'msg': res.__("admin.leads.format_px_percentage") });
				}
				if (!heightFormatCheck) {
					errMessageArray.push({ 'param': 'height', 'msg': res.__("admin.leads.format_px_percentage") });
				}

				// --- Validation for same percentage ---
				if (imageWidthPixels == '%' && imageHeightPixels == '%') {
					if (integerIframeWidth > 100) {
						errMessageArray.push({ 'param': 'width', 'msg': res.__("admin.leads.percentage_value") });
					} else if (integerIframeWidth < 20) {
						errMessageArray.push({ 'param': 'width', 'msg': res.__("admin.leads.percentage_value") });
					}

					if (integerIframeHeight > 100) {
						errMessageArray.push({ 'param': 'height', 'msg': res.__("admin.leads.percentage_value") });
					} else if (integerIframeHeight < 20) {
						errMessageArray.push({ 'param': 'height', 'msg': res.__("admin.leads.percentage_value") });
					}
				} else {
					if (iframewidth == '0px') {
						errMessageArray.push({ 'param': 'width', 'msg': res.__("admin.leads.please_enter_width") });
					} else if (integerIframeWidth < CUSTOM_SIZE_WIDTH || Number.isNaN(integerIframeWidth)) {
						errMessageArray.push({ 'param': 'width', 'msg': res.__("admin.leads.valid_width", CUSTOM_SIZE_WIDTH) });
					}

					if (iframeheight == '0px') {
						errMessageArray.push({ 'param': 'height', 'msg': res.__("admin.leads.please_enter_height") });
					} else if (integerIframeHeight < CUSTOM_SIZE_HEIGHT || Number.isNaN(integerIframeHeight)) {
						errMessageArray.push({ 'param': 'height', 'msg': res.__("admin.leads.valid_height", CUSTOM_SIZE_HEIGHT) });
					}
				}
			}

			// --- Hide question text: blank out background color and button type if checked ---
			if (hidequestionchecked) {
				backgroundColor = "";
				button_type_value = "";
			}

			// --- Send error message if any validation failed ---
			if (errMessageArray.length > 0) {
				return res.send({
					status: STATUS_ERROR,
					result: "",
					message: errMessageArray,
				});
			}

			// --- Calculate width/height for standard embed sizes ---
			if (customSizeValue != EMBED_CODE_CUSTOM_SIZE && customSizeValue != EMBED_CODE_INVISEMBED) {
				if (customSizeValue == EMBED_640_X_360_SIZE) {
					iframewidth = EMBED_CODE_SIZE_WIDTH_640 + 'px';
					iframeheight = EMBED_CODE_SIZE_HEIGHT_360 + 'px';
				}
				if (customSizeValue == EMBED_360_X_360_SIZE) {
					iframewidth = EMBED_CODE_SIZE_WIDTH_360 + 'px';
					iframeheight = EMBED_CODE_SIZE_HEIGHT_360 + 'px';
				}
				if (customSizeValue == EMBED_300_X_250_SIZE) {
					iframewidth = EMBED_CODE_SIZE_WIDTH_300 + 'px';
					iframeheight = EMBED_CODE_SIZE_HEIGHT_250 + 'px';
				}
				if (customSizeValue == EMBED_300_X_600_SIZE) {
					iframewidth = EMBED_CODE_SIZE_WIDTH_300 + 'px';
					iframeheight = EMBED_CODE_SIZE_HEIGHT_600 + 'px';
				}
				if (customSizeValue == EMBED_728_X_90_SIZE) {
					iframewidth = EMBED_CODE_SIZE_WIDTH_728 + 'px';
					iframeheight = EMBED_CODE_SIZE_HEIGHT_90 + 'px';
				}
			}

			// --- Build embed code and script URLs ---
			let jsfileUrl = EMBEDED_IFRAME_JS_URL;
			let jsUrl = "var PH=document.getElementsByTagName('head')[0],PS=document.createElement('script');PS.rel= 'PocialEmbedJs';PS.type= 'text/javascript';PS.src='" + jsfileUrl + "';head.appendChild(PS);";
			let iframetextvalue = '<iframe src="data:text/html;base64,TG9hZGluZy4uLg=="rel="pocialIframeContest" id="pocialIframeContest-' + package_id + '" onload="' + jsUrl + '" frameborder="0" height="' + iframeheight + '" width="' + iframewidth + '" scrolling="no" data-slug="' + package_id + '?sponser_image=&sponser_url=&sponser_image_type=" data-responsive="' + is_data_responsive + '" data-is_hide_text="' + is_hide_text + '" data-is_color_text="' + backgroundColor + '" data-background="' + backgroundImageUrl + '" data-type="' + button_type_value + '" data-isSponseActive="false" data-sponser_image="" data-sponser_url="" allowfullscreen="true"></iframe>';
			let iframeTextToBeLinked = "javascript:;if(typeof pocialLoadCaptureLeadByPackageId != 'function'){var PH = document.getElementsByTagName('head')[0],PS=document.createElement('script'), PCS= document.createElement('script');PS.type= 'text/javascript';PCS.type= 'text/javascript';PS.src='" + jsfileUrl + "';PCS.innerHTML='var pocialCaptureLeadByPackageId =\\'" + package_id + "?sponser_image=&sponser_url=&sponser_image_type=\\';';PH.appendChild(PCS);PH.appendChild(PS);}else{pocialLoadCaptureLeadByPackageId('" + package_id + "?sponser_image=&sponser_url=&sponser_image_type=');};void(0);";

			// --- Handle invisembed and text link validation ---
			if (customSizeValue == EMBED_CODE_INVISEMBED && textlinked == '') {
				errMessageArray.push({ 'param': 'text_to_be_linked', 'msg': res.__("admin.embed.please_enter_text_to_be_linked") });
				return res.send({
					status: STATUS_ERROR,
					result: "",
					message: errMessageArray,
				});
			}

			// --- Return the appropriate embed code based on options ---
			if (customSizeValue == EMBED_CODE_INVISEMBED && textlinked != '') {
				return res.send({
					status: STATUS_SUCCESS,
					message: "",
					result: '<a href ="' + iframeTextToBeLinked + '" style="border-bottom-style:dotted;border-bottom-width:1px;border-bottom-color:#000;">' + textlinked + '</a>'
				});
			}

			if (!hidequestionchecked) {
				if (backgroundColor == HEX_CODE_BLACK) {
					return res.send({
						status: STATUS_SUCCESS,
						message: "",
						result: iframetextvalue.replace('data-is_color_text="undefined"', 'data-is_color_text="' + HEX_CODE_BLACK + '"')
					});
				} else {
					return res.send({
						status: STATUS_SUCCESS,
						message: "",
						result: iframetextvalue.replace('data-is_color_text="undefined"', 'data-is_color_text="' + HEX_CODE_WHITE + '"')
					});
				}
			} else if (hidequestionchecked) {
				if (!backgroundImage) {
					errMessageArray.push({ 'param': 'background_image', 'msg': ALLOWED_IMAGE_ERROR_MESSAGE });
					return res.send({
						status: STATUS_ERROR,
						result: "",
						message: errMessageArray,
					});
				} else {
					return res.send({
						status: STATUS_SUCCESS,
						message: "",
						result: iframetextvalue
					});
				}
			}
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in generateEmbedCode:", err);
			return res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
				result: ""
			});
		}
	}; // end generateEmbedCode()

	/**
	 * Function for overview lead dashboard
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.overviewLeadDashboard = async (req, res) => {
		// --- Extract and validate parameters ---
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		try {
			// --- Get lead dashboard counts asynchronously ---
			// If you have multiple queries to run in parallel, use Promise.all here.
			const responseCount = await overviewLeadCountDashboard(req, res, [userId]);

			// --- Render the overview lead dashboard page with the retrieved data ---
			req.breadcrumbs(BREADCRUMBS["admin/leads_form/overview_lead_dashboard"]);
			res.render("manage_leads/overview_lead_dashboard", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userType,

				'total_leads': responseCount.total_leads,
				'introduction': responseCount.introduction,
				'introduction_month': responseCount.introduction_month,
				'introduction_hybrid': responseCount.introduction_hybrid,

				'growth': responseCount.growth,
				'growth_month': responseCount.growth_month,
				'growth_hybrid': responseCount.growth_hybrid,

				'hot_leads': responseCount.hot_leads,
				'hot_leads_month': responseCount.hot_leads_month,
				'hot_leads_hybrid': responseCount.hot_leads_hybrid,

				'loyalist_count': responseCount.loyalist_count,
				'loyalist_month': responseCount.loyalist_month,
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in overviewLeadDashboard:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end overviewLeadDashboard()

	/** create decrypt*/
	const decrypt = (salt, encoded) => {
		const textToChars = (text) => text.split("").map((c) => c.charCodeAt(0));
		const applySaltToChar = (code) => textToChars(salt).reduce((a, b) => a ^ b, code);
		return encoded
			.match(/.{1,2}/g)
			.map((hex) => parseInt(hex, 16))
			.map(applySaltToChar)
			.map((charCode) => String.fromCharCode(charCode))
			.join("");
	};//end decrypt()

	/**
	 * Function for Script Code Preview
	 *
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next 	As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.getScriptCodePreview = (req, res) => {
		res.render("manage_leads/script_code_preview", {
			result: (req.params.scripted_data) ? decrypt("salt", req.params.scripted_data) : "",
		});
	}//end getScriptCodePreview()

	/**
	 * Function for view script customization
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.viewScriptCustomization = async (req, res) => {
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let stageLevel = (req.params.stage_level) ? req.params.stage_level : "";
		let customizedScriptSlug = (req.params.customized_script_slug) ? req.params.customized_script_slug : "";

		if (!userType || !userId || !leadId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// Get customized script collection
		const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);

		if (isPost(req)) {
			// --- Handle POST: DataTable AJAX for script customizations ---
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;

			try {
				// --- Configure Datatable conditions ---
				const dataTableConfig = await configDatatable(req, res, null);

				// --- Build common conditions for queries ---
				let commonConditions = {
					user_id: newObjectIdDefault(userId),
					lead_forms_id: newObjectIdDefault(leadId)
				};

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// --- Run queries in parallel using Promise.all ---
				const [
					scriptList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get list of last scripted code
					customizedScript
						.find(dataTableConfig.conditions, { projection: { slug: 1, unique_name: 1, created: 1 } })
						.collation(COLLATION_VALUE)
						.sort(dataTableConfig.sort_conditions)
						.limit(limit)
						.skip(skip)
						.toArray(),
					// Get total number of records in collection
					customizedScript.countDocuments(commonConditions),
					// Get filtered records count
					customizedScript.countDocuments(dataTableConfig.conditions)
				]);

				// --- Send response ---
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: scriptList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in viewScriptCustomization (POST):", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// --- Handle GET: Render script customization view page ---
			try {
				// Get full width dropdown fields for scripted code
				let options = {
					lead_forms_id: leadId,
					lead_forms_slug: "",
				};
				const fullWidthDropdownTextboxesResponse = await dropdownFullWidthFields(options);

				// Get details of the selected/customized script
				const resultScript = await customizedScript.findOne({
					slug: customizedScriptSlug,
					user_id: newObjectIdDefault(userId),
					lead_forms_id: newObjectIdDefault(leadId)
				});

				req.breadcrumbs(BREADCRUMBS["admin/leads_form/view_script_customization"]);
				res.render("manage_leads/view_script_customization", {
					"lead_id": leadId,
					"user_type": userType,
					"user_id": userId,
					"dynamic_variable": userBreadcrumbs(userType),
					"dynamic_url": userId,
					"stage_level": stageLevel,
					"script_details": resultScript ? resultScript : {},
					"fullWidthDropdownTextboxes": fullWidthDropdownTextboxesResponse.result,
					"without_scripted_id_generate_code": WITHOUT_SCRIPTED_ID_GENERATE_SCRIPTED_CODE.replace("{LEAD_ID}", leadId),
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in viewScriptCustomization (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end viewScriptCustomization()

	/**
	 * Function to delete script customization
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 *
	 * @return null
	 */
	this.deleteScriptCustomization = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let customizedScriptSlug = (req.params.customized_script_slug) ? req.params.customized_script_slug : "";

		if (!userType || !userId || !leadId || !customizedScriptSlug) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(
				WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/view_script_customization/" + leadId + "/" + userId + "/" + customizedScriptSlug
			);
		}

		try {
			// --- Prepare options for deletion ---
			let options = {
				user_id: userId,
				customized_script_slug: customizedScriptSlug,
			};

			// --- Delete script customization asynchronously ---
			const response = await deleteScriptCustomizationDynamically(options);

			if (response === STATUS_ERROR) {
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			} else {
				req.flash(STATUS_SUCCESS, res.__("admin.leads.customization_has_been_deleted_successfully"));
			}

			// --- Redirect to script customization view page ---
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/view_script_customization/" + leadId + "/" + userId + "/" + customizedScriptSlug);
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in deleteScriptCustomization:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/view_script_customization/" + leadId + "/" + userId + "/" + customizedScriptSlug);
		}
	}; // end deleteScriptCustomization()

	/**
	 * Function to get list of imported users data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.importList = async (req, res) => {
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (isPost(req)) {
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";

			const collection = db.collection(TABLE_LEADS_IMPORT);
			let commonConditions = {
				user_id: userId,
			};

			try {
				// --- Configure Datatable conditions ---
				const dataTableConfig = await configDatatable(req, res, null);
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// --- Apply date range filter if provided ---
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// --- Run queries in parallel using Promise.all ---
				const [importList, totalRecords, filteredRecords] = await Promise.all([
					// Get paginated and filtered import list
					collection.find(dataTableConfig.conditions).collation(COLLATION_VALUE).sort(dataTableConfig.sort_conditions).limit(limit).skip(skip).toArray(),

					// Get total number of records in import file collection (not filtered)
					collection.countDocuments(commonConditions),

					// Get filtered records count in import file collection
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// --- Send response with results ---
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: importList || [],
					recordsTotal: totalRecords || 0,
					recordsFiltered: filteredRecords || 0
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in importList:", err);
				res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// --- Render listing page ---
			req.breadcrumbs(BREADCRUMBS['admin/leads_form/import_list']);
			res.render("manage_leads/import_list", {
				lead_id: leadId,
				user_id: userId,
				user_type: userType,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userId,
			});
		}
	}; // end importList()

	/**
	 * Function to add import users data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.importAdd = async (req, res) => {
		let userType = req.params.user_type ? req.params.user_type : "";
		let leadId = req.params.id ? newObjectIdDefault(req.params.id) : "";
		let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		let title = req.body.title ? req.body.title : "";

		let errMessageArray = [];

		if (isPost(req)) {
			// --- Validate file upload and title ---
			if (
				typeof req.files === "undefined" ||
				typeof req.files.user_import_file === "undefined" ||
				title === ""
			) {
				if (
					typeof req.files === "undefined" ||
					typeof req.files.user_import_file === "undefined"
				) {
					errMessageArray.push({
						param: "user_import_file",
						msg: res.__("admin.user.please_select_file"),
					});
				}
				if (title === "") {
					errMessageArray.push({
						param: "title",
						msg: res.__("admin.leads_file.please_enter_title"),
					});
				}
				return res.send({
					status: STATUS_ERROR,
					message: errMessageArray,
				});
			}

			let extension = req.body.extension ? req.body.extension : "";
			let fileName = req.body.file_name ? req.body.file_name : "";
			let columnName = req.body.column_name ? req.body.column_name : [];
			let sendWelcomeEmail = req.body.send_welcome_email
				? req.body.send_welcome_email
				: IMPORT_LEADS_WELCOME_EMAIL_NO_STATUS;

			let errMessageArray = [];

			// --- If file is uploaded and extension & fileName are present, validate columns and save data ---
			if (extension && fileName) {
				// --- Validate required columns ---
				USER_LEAD_FIXED_COLUMN_NAME.forEach((records, index) => {
					let selectedColumn = req.body["select_column" + index];
					let ignoreColumn = req.body["ignore_column" + index];

					if (
						(selectedColumn === "" || typeof selectedColumn === "undefined") &&
						(ignoreColumn === "" || typeof ignoreColumn === "undefined")
					) {
						errMessageArray.push({
							param: "select_column" + index,
							msg: res.__("admin.leads_file.please_select_column"),
						});
					}
				});

				// --- If validation errors, send error response ---
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// --- Prepare column and ignore arrays ---
				let columnArray = [];
				let checkboxIgnoreColumnArray = [];
				USER_LEAD_FIXED_COLUMN_NAME.forEach((records, index) => {
					let columnIndex = req.body["select_column" + index]
						? Number(req.body["select_column" + index])
						: "";
					let ignoreColumn = req.body["ignore_column" + index];
					ignoreColumn =
						ignoreColumn === "" || typeof ignoreColumn === "undefined"
							? false
							: true;

					columnArray.push(columnIndex);
					checkboxIgnoreColumnArray.push(ignoreColumn);
				});

				// --- Prepare options for DB save ---
				let options = {
					title: title,
					file_name: fileName,
					extension: extension,
					column: columnArray,
					ignore_column: checkboxIgnoreColumnArray,
					column_name: columnName ? columnName.split(",") : [],
					send_welcome_email: sendWelcomeEmail,
					user_id: userId,
					lead_id: leadId,
					upload: UPLOAD_BACKEND_LEAD_EXCEL,
				};

				try {
					// --- Save import file data in DB (async) ---
					const responseFile = await leadImportFileDataSaveInDB(req, res, options);

					if (responseFile.status === STATUS_ERROR) {
						// --- Send error response ---
						req.flash(STATUS_ERROR, responseFile.message);
						return res.send({
							status: STATUS_ERROR,
							excel_status: STATUS_SUCCESS,
							redirect_url:
								WEBSITE_ADMIN_URL +
								"users/" +
								userType +
								"/manage_leads/import_list/" +
								leadId +
								"/" +
								userId,
							message: responseFile.message,
						});
					} else {
						// --- Send success response ---
						req.flash(
							STATUS_SUCCESS,
							res.__("admin.users.ecxel_has_been_added_successfully")
						);
						return res.send({
							status: STATUS_SUCCESS,
							excel_status: STATUS_SUCCESS,
							redirect_url:
								WEBSITE_ADMIN_URL +
								"users/" +
								userType +
								"/manage_leads/import_list/" +
								leadId +
								"/" +
								userId,
							message: responseFile.message,
						});
					}
				} catch (err) {
					// --- Handle errors gracefully ---
					console.error("Error in importAdd (leadImportFileDataSaveInDB):", err);
					req.flash(
						STATUS_ERROR,
						res.__("admin.system.something_going_wrong_please_try_again")
					);
					return res.send({
						status: STATUS_ERROR,
						message: [
							{
								param: ADMIN_GLOBAL_ERROR,
								msg: res.__("admin.system.something_going_wrong_please_try_again"),
							},
						],
					});
				}
			} else {
				// --- Handle file upload and get first column data (async) ---
				try {
					const responseFile = await getExcelFirstColumnData(req, res);
					if (responseFile.status === STATUS_SUCCESS) {
						return res.send({
							status: STATUS_SUCCESS,
							extension: responseFile.extension,
							file_name: responseFile.file_name,
							result: responseFile.result,
						});
					} else {
						return res.send({
							status: STATUS_ERROR,
							extension: responseFile.extension,
							file_name: responseFile.file_name,
							message: [
								{
									param: "user_import_file",
									msg: responseFile.message,
								},
							],
						});
					}
				} catch (err) {
					console.error("Error in importAdd (getExcelFirstColumnData):", err);
					return res.send({
						status: STATUS_ERROR,
						message: [
							{
								param: ADMIN_GLOBAL_ERROR,
								msg: res.__("admin.system.something_going_wrong_please_try_again"),
							},
						],
					});
				}
			}
		} else {
			// --- Get leads instruction block data and render page (async/await) ---
			try {
				const block = db.collection(TABLE_BLOCK);
				const instructionData = await block.findOne({
					block_slug: "add-lead-import-sheet-instruction",
				});

				req.breadcrumbs(BREADCRUMBS["admin/leads_form/import_add"]);
				return res.render("manage_leads/import_add", {
					user_type: userType,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					lead_id: leadId,
					user_id: userId,
					instruction_result:
						instructionData && instructionData.description
							? instructionData.description
							: "",
					lead_dynamic_url_id: leadId,
				});
			} catch (err) {
				console.error("Error in importAdd (render import_add):", err);
				req.flash(
					STATUS_ERROR,
					res.__("admin.system.something_going_wrong_please_try_again")
				);
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end importAdd()

	/**
	 * Function to get logs details of import users data
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.importDetails = async (req, res) => {
		let leadId = req.params.id ? newObjectIdDefault(req.params.id) : "";
		let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		let userType = req.params.user_type ? req.params.user_type : "";
		let csvImportSlug = req.params.csv_import_slug ? req.params.csv_import_slug : "";

		if (isPost(req)) {
			let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

			const collection = db.collection(TABLE_LEADS_IMPORT_LOGS);
			let commonConditions = {
				user_id: userId,
				lead_id: leadId,
				csv_import_slug: csvImportSlug
			};

			try {
				// --- Configure Datatable conditions ---
				const dataTableConfig = await configDatatable(req, res, null);
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// --- Run queries in parallel using Promise.all ---
				const [result, totalRecords, filteredRecords] = await Promise.all([
					// Get paginated and filtered import logs
					collection
						.find(dataTableConfig.conditions)
						.collation(COLLATION_VALUE)
						.sort(dataTableConfig.sort_conditions)
						.limit(limit)
						.skip(skip)
						.toArray(),
					// Get total number of records in import file collection (not filtered)
					collection.countDocuments(commonConditions),
					// Get filtered records count in import file collection
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// --- Send response with results ---
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: result || [],
					recordsTotal: totalRecords || 0,
					recordsFiltered: filteredRecords || 0
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in importDetails (POST):", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsTotal: 0,
					recordsFiltered: 0
				});
			}
		} else {
			// --- Get failed/warning records and render import details page ---
			try {
				const leadsImport = db.collection(TABLE_LEADS_IMPORT);
				const resultImport = await leadsImport.findOne(
					{ slug: csvImportSlug },
					{ projection: { failed_reason: 1, warning_records: 1, failed_records: 1, file_name: 1, title: 1 } }
				);

				req.breadcrumbs(BREADCRUMBS['admin/leads_form/import_details']);
				res.render("manage_leads/import_details", {
					user_type: userType,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					lead_id: leadId,
					user_id: userId,
					lead_dynamic_url_id: leadId,
					csv_import_slug: csvImportSlug,
					failed_records: resultImport ? resultImport.failed_records : 0,
					warning_records: resultImport ? resultImport.warning_records : 0,
					leadsImportFailedReason: resultImport ? resultImport.failed_reason : "",
					import_lead_file_name: (resultImport && resultImport.file_name) ? getExcelFileName(resultImport.file_name) : "",
					import_lead_title_name: (resultImport && resultImport.title) ? resultImport.title : "",
				});
			} catch (err) {
				console.error("Error in importDetails (GET):", err);
				req.flash(
					STATUS_ERROR,
					res.__("admin.system.something_going_wrong_please_try_again")
				);
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end importDetails()

	/**
	 * Function to delete Import File
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.deleteImportFile = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let csvImportSlug = (req.params.csv_import_slug) ? req.params.csv_import_slug : "";

		if (!leadId || !userId || !userType || !csvImportSlug) {
			// --- Send error response for invalid access ---
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// --- Prepare options for deleting import file ---
		let optionsFile = {
			user_id: userId,
			csv_import_slug: csvImportSlug,
		};

		try {
			// --- Attempt to delete the pending import Excel file asynchronously ---
			const deleteResponse = await deletePendingImportExcelFile(req, res, optionsFile);

			if (deleteResponse === STATUS_SUCCESS) {
				// --- Send success response if file deleted ---
				req.flash(STATUS_SUCCESS, res.__("front.leads_file.you_have_successfully_deleted_your_uploaded_file"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/import_list/" + leadId + '/' + userId);
			} else {
				// --- Send error response if file cannot be deleted (e.g., process running) ---
				req.flash(STATUS_ERROR, res.__("front.leads_file.file_process_is_running_sorry_this_file_cant_be_deleted"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/import_list/" + leadId + '/' + userId);
			}
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in deleteImportFile:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/import_list/" + leadId + '/' + userId);
		}
	}; // end deleteImportFile()

	/**
	 * Function for view details of selected columns
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.viewDetailsSelectedColumns = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let csvImportSlug = (req.params.csv_import_slug) ? req.params.csv_import_slug : "";

		const leadsImport = db.collection(TABLE_LEADS_IMPORT);

		try {
			// --- Fetch import details for the given slug using async/await ---
			const resultImport = await leadsImport.findOne(
				{ slug: csvImportSlug },
				{ projection: { 'all_column_value': 1, 'file_name': 1, 'title': 1 } }
			);

			// --- Set breadcrumbs for the view ---
			req.breadcrumbs(BREADCRUMBS['admin/leads_form/import_view_selected_columns']);

			// --- Render the selected columns details page ---
			res.render("manage_leads/import_view_selected_columns", {
				'user_type': userType,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
				'lead_id': leadId,
				'user_id': userId,
				'lead_dynamic_url_id': leadId,
				'csv_import_slug': csvImportSlug,
				'result_import': resultImport ? resultImport : "",
				'import_lead_file_name': (resultImport && resultImport['file_name']) ? getExcelFileName(resultImport['file_name']) : "",
				'import_lead_title_name': (resultImport && resultImport['title']) ? resultImport['title'] : "",
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in viewDetailsSelectedColumns:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end viewDetailsSelectedColumns()

	/**
	 * Function to send import lead welcome mail
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	this.importLeadsAdminSendWelcomeMail = async (req, res) => {
		if (isPost(req)) {
			// --- Sanitize incoming data ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			let leadId = req.params.id ? newObjectIdDefault(req.params.id) : "";
			let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
			let userType = req.params.user_type ? req.params.user_type : "";
			let csvImportSlug = req.params.csv_import_slug ? req.params.csv_import_slug : "";
			let leadsImportLogsArrayIds = req.body.leads_import_logs_ids ? req.body.leads_import_logs_ids : [];

			if (leadsImportLogsArrayIds.length > 0) {
				try {
					// --- Send welcome emails for selected excel lead log ids (async) ---
					await sendWelcomeEmailsSelectedIds(req, res, leadsImportLogsArrayIds);

					req.flash(STATUS_SUCCESS, res.__("front.leads_file.welcome_mail_has_been_send_successfully"));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/import_details/" + leadId + '/' + userId + '/' + csvImportSlug
					});
				} catch (err) {
					// --- Handle errors during email sending ---
					console.error("Error in importLeadsAdminSendWelcomeMail:", err);
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/import_details/" + leadId + '/' + userId + '/' + csvImportSlug
					});
				}
			} else {
				// --- No IDs provided, return error ---
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/import_details/" + leadId + '/' + userId + '/' + csvImportSlug
				});
			}
		}
	}; // end importLeadsAdminSendWelcomeMail()

	/**
	 * Function for pick a winner
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.pickAWinner = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadFormsId = req.params.lead_from_id ? newObjectIdDefault(req.params.lead_from_id) : "";
		let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		let userType = req.params.user_type ? req.params.user_type : "";

		if (!userId || !userType || !leadFormsId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// --- Prepare options for picking a winner ---
		let optionsData = {
			lead_from_id: leadFormsId,
			user_id: userId
		};

		try {
			// --- Call pickWinnerFromList asynchronously ---
			const response = await pickWinnerFromList(req, res, optionsData);

			// --- Send response with winner data ---
			res.send({
				status: response.status,
				result: response.result,
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in pickAWinner:", err);
			res.send({
				status: STATUS_ERROR,
				result: null,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end pickAWinner()

	/**
	 * Function to add selected reward list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.addSelectedRewardList = async (req, res) => {
		// --- Extract and validate parameters ---
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let leadId = (req.params.lead_from_id) ? newObjectIdDefault(req.params.lead_from_id) : "";
		let winnerId = (req.params.winner_id) ? req.params.winner_id : [];
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let winnersArray = winnerId.split(",");

		// --- Convert winner IDs to ObjectId array ---
		let winnerIdsArray = winnersArray.map((ids) => newObjectIdDefault(ids));

		if (!userType || !userId || !winnerId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// --- Handle POST: DataTable AJAX for rewards ---
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";
			const collection = db.collection(TABLE_REWARDS);

			try {
				// --- Configure Datatable conditions ---
				const dataTableConfig = await configDatatable(req, res, null);

				let commonConditions = {
					is_deleted: NOT_DELETED,
					user_id: newObjectIdDefault(userId),
				};

				// --- Add date range filter if provided ---
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions["created"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// --- Run queries in parallel using Promise.all ---
				const [
					rewardList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get list of rewards with lookups and pagination
					collection.aggregate([
						{ $match: dataTableConfig.conditions },
						{
							$lookup: {
								from: TABLE_MASTERS,
								let: { storeTypeId: "$store_type_id" },
								pipeline: [
									{
										$match: {
											$expr: {
												$and: [
													{ $in: ["$_id", "$$storeTypeId"] },
													{ $eq: ["$dropdown_type", MASTER_STORE_TYPE] },
												]
											},
										}
									},
									{ "$project": { name: 1 } }
								],
								as: "storeType"
							}
						},
						{
							$lookup: {
								from: TABLE_EMAIL_NEWSLETTER_TEMPLATE,
								let: { rewardId: "$_id" },
								pipeline: [
									{
										$match: {
											$expr: {
												$and: [
													{ $eq: ["$attach_reward", "$$rewardId"] },
													{ $eq: ["$is_deleted", NOT_DELETED] },
												]
											},
										}
									},
									{ "$project": { question: "$subject" } }
								],
								as: "attachedEmailLeads"
							}
						},
						{
							$lookup: {
								from: TABLE_POLLS,
								localField: '_id',
								foreignField: 'options.assign_reward',
								as: 'pollsAttachmentDetails'
							}
						},
						{
							$addFields: {
								'attachedEmail': { '$concatArrays': ['$attachedEmailLeads', '$pollsAttachmentDetails'] }
							}
						},
						{ $sort: dataTableConfig.sort_conditions },
						{ $skip: skip },
						{ $limit: limit },
					]).toArray(),
					// Get total number of records in collection
					collection.countDocuments(commonConditions),
					// Get filtered records count
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// --- Send response ---
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: rewardList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in addSelectedRewardList (POST):", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// --- Handle GET: Render reward list page with winner emails ---
			const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			try {
				// --- Fetch winner email details ---
				const result = await leadsFormsSubscriber.find(
					{ _id: { $in: winnerIdsArray } },
					{ projection: { _id: 0, email: 1 } }
				).toArray();

				req.breadcrumbs(BREADCRUMBS['admin/leads_form/add_selected_reward']);
				res.render("manage_leads/reward_list", {
					'user_type': userType,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'lead_id': leadId,
					'user_id': userId,
					'lead_dynamic_url_id': leadId,
					'winner_id': winnerId,
					'winner_result': result,
					'winners_total': winnersArray.length,
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in addSelectedRewardList (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // End addSelectedRewardList()

	/**
	 * Function to validate sending rewards to subscribers
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.validateSendReward = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadFormsId = req.params.lead_from_id ? newObjectIdDefault(req.params.lead_from_id) : "";
		let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		let userType = req.params.user_type ? req.params.user_type : "";
		let subscriberEmails = req.body.subscriber_emails ? req.body.subscriber_emails : [];
		let subscriberEmailsArray = subscriberEmails.split(",");

		if (!userId || !userType || !leadFormsId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// --- Prepare options for validation query ---
		let optionsData = {
			lead_from_id: leadFormsId,
			user_id: userId,
			subscriber_emails: subscriberEmailsArray
		};

		try {
			// --- Validate send reward data asynchronously ---
			const response = await validateSendRewardData(req, res, optionsData);

			// --- Send response back to client ---
			res.send({
				status: response.status,
				message: response.message
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in validateSendReward:", err);
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	}; // end validateSendReward()

	/**
	 * Function to send leads rewards
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return json
	 */
	this.sendLeadsRewards = async (req, res) => {
		// --- Extract and validate parameters ---
		let leadFormsId = req.params.lead_from_id ? newObjectIdDefault(req.params.lead_from_id) : "";
		let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		let userType = req.params.user_type ? req.params.user_type : "";
		let rewardId = req.body.reward_id ? newObjectIdDefault(req.body.reward_id) : "";
		let subscriberEmails = req.body.subscriber_emails ? req.body.subscriber_emails : [];
		let excludeRewarded = req.body.exclude_rewarded ? req.body.exclude_rewarded : false;
		let subscriberEmailsArray = subscriberEmails.split(",");

		if (!userId || !userType || !leadFormsId || !rewardId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// --- Prepare options for sending rewards ---
		let optionsData = {
			lead_from_id: leadFormsId,
			user_id: userId,
			reward_id: rewardId,
			subscriber_emails: subscriberEmailsArray
		};

		// --- Handle excludeRewarded flag ---
		if (excludeRewarded === 'true') {
			optionsData.exclude_rewarded = true;
		} else if (excludeRewarded === 'false') {
			optionsData.exclude_rewarded = false;
		}

		try {
			// --- Send lead reward data asynchronously ---
			const response = await sendLeadRewardData(req, res, optionsData);

			// --- Handle response and flash messages ---
			if (response.status === 'error' && response.message === 'No record founds.') {
				req.flash(response.status, res.__("send_reward.excluded_message"));
			} else {
				req.flash(response.status, response.message);
			}

			// --- Send response back to client ---
			res.send({
				status: response.status,
				message: response.message,
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/view_entire_subscriber/" + leadFormsId + '/' + userId
			});
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in sendLeadsRewards:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/manage_leads/view_entire_subscriber/" + leadFormsId + '/' + userId
			});
		}
	}; // end sendLeadsRewards()

	/**
	 * Function to update lead status
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.updateLeadStatus = async (req, res, next) => {
		// --- Extract and validate parameters ---
		let leadFormsId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let status = (req.params.status) ? req.params.status : "";

		if (!userType || !userId || !leadFormsId || !status) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// --- Prepare update options ---
		let updateOption = {
			"lead_forms_id": leadFormsId,
			"user_id": userId,
			"is_active": status,
		};

		try {
			// --- Update lead status asynchronously ---
			const updateResponse = await updateLeadStatus(req, res, updateOption);

			// --- Send success response ---
			req.flash(updateResponse.status, updateResponse.message);
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_leads/' + userId);
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in updateLeadStatus:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end updateLeadStatus()
}
module.exports = new LeadsForm();
