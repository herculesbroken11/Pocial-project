const async = require("async");
const { ObjectId } = require("mongodb");

function pocialEmailTemplates() {

	/**
	 * Function to get list of email templates
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.getManageEmailList = async (req, res) => {
		// --- Extract and validate parameters ---
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// --- Extract pagination and filter parameters ---
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";

			const collection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			try {
				// --- Configure datatable and build conditions ---
				const dataTableConfig = await configDatatable(req, res, null);

				// --- Set common query conditions ---
				let commonConditions = {
					"is_deleted": NOT_DELETED,
					"template_type": EMAIL_TEMPLATE_WELCOME_TYPE,
					"user_id": newObjectIdDefault(userId)
				};

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// --- Apply date range filter if provided ---
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['modified'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// --- Run queries in parallel using Promise.all ---
				const [templateList, totalRecords, filteredRecords] = await Promise.all([
					// Get list of email templates
					collection
						.find(
							dataTableConfig.conditions,
							{
								projection: {
									_id: 1,
									user_id: 1,
									template_title: 1,
									subject: 1,
									attach_reward_name: 1,
									status: 1,
									is_active: 1,
									modified: 1
								}
							}
						)
						.collation(COLLATION_VALUE)
						.sort(dataTableConfig.sort_conditions)
						.limit(limit)
						.skip(skip)
						.toArray(),

					// Get total number of records in email_templates collection (not filtered)
					collection.countDocuments(commonConditions),

					// Get filtered records count in email_templates collection
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// --- Send response with results ---
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: templateList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in getManageEmailList:", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// --- Render listing page ---
			req.breadcrumbs(BREADCRUMBS["admin/pocial_email/list"]);
			res.render("manage_emails/list", {
				user_type: userType,
				user_id: userId,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userType,
			});
		}
	}; // End getManageEmailList()

	/**
	 * Function to get rewards template list for dropdown (async/await version)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	this.getRewardsDropdownList = async (req, res) => {
		try {
			// --- Extract and validate parameters ---
			let templateId = req.params.template_id ? newObjectIdDefault(req.params.template_id) : "";
			let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
			const collection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// --- Fetch the template to get attached reward ---
			const resultdata = await collection.findOne(
				{ _id: templateId },
				{ projection: { attach_reward: 1, created: 1 } }
			);

			if (resultdata) {
				let attachRewardId = resultdata.attach_reward ? resultdata.attach_reward : "";

				// --- Prepare dropdown options for rewards ---
				let options = {
					collections: [
						{
							collection: TABLE_REWARDS,
							columns: ["_id", "reward_text"],
							sort_conditions: { created: SORT_DESC },
							selected: [attachRewardId],
							conditions: {
								user_id: newObjectIdDefault(userId),
								is_deleted: NOT_DELETED,
								is_active: ACTIVE
							}
						},
					]
				};

				// --- Get dropdown list using helper (async) ---
				const response = await getDropdownList(req, res, options);

				res.send({
					status: STATUS_SUCCESS,
					result: (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
				});
			} else {
				res.send({
					status: STATUS_ERROR,
					result: ""
				});
			}
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in getRewardsDropdownList:", err);
			res.send({
				status: STATUS_ERROR,
				result: ""
			});
		}
	}; // end getRewardsDropdownList()

	/**
	 * Function to attach a reward to an email template
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Callback argument to the middleware function
	 *
	 * @return null
	 */
	this.attachRewardEmailTemplate = async (req, res, next) => {
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (isPost(req)) {
			// --- Sanitize incoming data ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			let templateId = (req.body.tempalte_id) ? req.body.tempalte_id : '';
			let attachReward = (req.body.attach_reward) ? req.body.attach_reward : '';
			let userId = (req.body.user_id) ? req.body.user_id : '';

			let errMessageArray = [];

			// --- Validate required fields ---
			if (templateId === '') {
				errMessageArray.push({ 'param': 'tempalte_id', 'msg': res.__("please enter template id.") });
			}
			if (attachReward === '') {
				errMessageArray.push({ 'param': 'attach_reward', 'msg': res.__("admin.rewards.please_select_reward") });
			}
			if (userId === '') {
				errMessageArray.push({ 'param': 'user_id', 'msg': res.__("admin.rewards.please_enter_user_id") });
			}

			// --- Send error message if validation fails ---
			if (errMessageArray.length > 0) {
				return res.send({
					status: STATUS_ERROR,
					message: errMessageArray,
				});
			}

			try {
				const collection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

				// --- Update the email template to attach the selected reward (async/await) ---
				await collection.updateOne(
					{
						'_id': newObjectIdDefault(templateId),
						'user_id': newObjectIdDefault(userId)
					},
					{
						$set: {
							'attach_reward': newObjectIdDefault(attachReward),
						}
					}
				);

				// --- Update the reward name for the template (if needed) ---
				await templateWiseRewardNameUpdate(attachReward, templateId);

				// --- Send success response ---
				req.flash("success", res.__("front.email_template.reward_has_been_assign_successfully"));
				res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
					message: res.__("front.email_template.reward_has_been_assign_successfully"),
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in attachRewardEmailTemplate:", err);
				return next(err);
			}
		}
	}; // end attachRewardEmailTemplate()

	/**
	 * Function to update status or delete reward for an email template
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.templateStatusChange = async (req, res) => {
		// --- Extract and validate parameters ---
		let templateId = (req.params.id) ? newObjectIdDefault(req.params.id) : '';
		let userId = (req.params.user_id) ? req.params.user_id : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let isActiveStatus = (req.params.status) ? req.params.status : DEACTIVE;

		if (!templateId || !userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
			return;
		}

		try {
			// --- Prepare mail options for status change ---
			let mailOptions = {
				'user_id': userId,
				'template_id': templateId,
				'is_active': isActiveStatus,
			};

			// --- Update template status asynchronously ---
			const responseTest = await activeDeactiveWelcomeEmail(req, res, mailOptions);

			// --- Send response and redirect ---
			req.flash(responseTest.status, responseTest.message);
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in templateStatusChange:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
		}
	}; // end templateStatusChange()

	/**
	 * Function to add a welcome email template
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.addTemplate = async (req, res) => {
		let userId = (req.params.user_id) ? req.params.user_id : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			try {
				// --- Sanitize input data ---
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

				let templateTitle = req.body.template_title || "";
				let pageBody = req.body.page_body || "";
				let description = req.body.description || "";
				let subject = req.body.subject || "";
				let designJson = req.body.design_json || "";
				let attachReward = req.body.attach_reward ? newObjectIdDefault(req.body.attach_reward) : "";
				let from = req.body.from || "";
				let fromEmail = req.body.from_email || "";
				let host = req.body.host || "";
				let emailPassword = req.body.email_password || "";
				let port = req.body.port || "";

				// --- Prepare SMTP options ---
				let smtpOptions = {
					'from_email': fromEmail,
					'host': host,
					'password': emailPassword,
					'port': port
				};

				let errMessage = [];

				// --- Check SMTP connection asynchronously ---
				const smtpResponse = await smtpConnectionCheck(req, res, smtpOptions);

				if (smtpResponse.status == STATUS_ERROR) {
					errMessage.push({ 'param': 'smtp', 'msg': res.__("front.email_template.connection_connected_not_successfully") });
					return res.send({
						status: STATUS_ERROR,
						message: errMessage,
					});
				}

				// --- Insert email template asynchronously ---
				const responseEmail = await addEmailTemplateNewsletter({
					'template_title': templateTitle,
					'subject': subject,
					'body': pageBody,
					'description': description,
					'user_id': userId,
					'attach_reward': attachReward,
					'from': from,
					'from_email': fromEmail,
					'host': host,
					'port': port,
					'email_password': emailPassword,
					'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
					'design_json': JSON.parse(designJson),
					'email_descriptions': {
						[DEFAULT_LANGUAGE_MONGO_ID]: {
							"language_id": DEFAULT_LANGUAGE_MONGO_ID,
							"subject": subject,
							"body": pageBody,
						}
					},
				});

				let templateId = responseEmail.email_inserted_id ? responseEmail.email_inserted_id : "";

				// --- Generate image from HTML content asynchronously ---
				await htmltoImageConvert(req, res, templateId);

				// --- Send success response ---
				req.flash("success", res.__("admin.complete_email.template_has_been_added_successfully"));
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
					message: res.__("admin.complete_email.template_has_been_added_successfully"),
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in addTemplate (POST):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			try {
				// --- Prepare user condition and options ---
				let otherUserCondition = {
					_id: newObjectIdDefault(userId)
				};
				let otherUserOptions = {
					conditions: otherUserCondition,
				};

				// --- Fetch user details asynchronously ---
				const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

				// --- Prepare dropdown options for rewards ---
				let options = {
					collections: [
						{
							collection: TABLE_REWARDS,
							columns: ["_id", "reward_text"],
							sort_conditions: { created: SORT_DESC },
							conditions: {
								'user_id': newObjectIdDefault(userId),
								'is_deleted': NOT_DELETED,
								'is_active': ACTIVE
							}
						},
					]
				};

				// --- Fetch rewards dropdown and active template in parallel ---
				const [dropdownResponse, activeTemplateResponse] = await Promise.all([
					getDropdownList(req, res, options),
					getActiveWelcomeTemplate(userId)
				]);

				// --- Render add template page with all required data ---
				req.breadcrumbs(BREADCRUMBS["admin/pocial_email/add"]);
				res.render("manage_emails/add", {
					'user_type': userType,
					'user_id': userId,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'user_response': userResponse,
					'default_template': (activeTemplateResponse.result) ? activeTemplateResponse.result : {},
					'isDraft': (activeTemplateResponse.is_draft) ? true : false,
					'rewards_dropdown': (dropdownResponse && dropdownResponse.final_html_data && dropdownResponse.final_html_data["0"]) ? dropdownResponse.final_html_data["0"] : "",
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in addTemplate (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end addTemplate()

	/**
	 * Function to send a test email using async/await
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.sendTestEmail = async (req, res, next) => {
		if (isPost(req)) {
			// --- Extract and validate input parameters ---
			let email = req.body.email ? req.body.email : "";
			let pageBody = req.body.page_body ? req.body.page_body : "";

			if (!email || !pageBody) {
				// --- Send error response if required fields are missing ---
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "complete_email/add",
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}

			try {
				// --- Prepare mail options and send test email asynchronously ---
				let testMailOptions = { email: email, page_body: pageBody };
				const responseTest = await sendTestEmailTemplate(req, res, testMailOptions);

				if (responseTest) {
					// --- Send success response if email sent successfully ---
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "pocial_email/add",
						message: res.__("front.email_template.email_send_has_been_successfully"),
					});
				} else {
					// --- Send error response if email sending failed ---
					req.flash(STATUS_ERROR, res.__("front.email_template.email_has_been_not_sent_successfully"));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "pocial_email/add",
						message: res.__("front.email_template.email_has_been_not_sent_successfully"),
					});
				}
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in sendTestEmail:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "pocial_email/add",
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// --- Render add test email page ---
			req.breadcrumbs(BREADCRUMBS["admin/pocial_email/add"]);
			res.render("add");
		}
	}; // end sendTestEmail()

	/**
	 * Function to edit welcome template (add/update/duplicate)
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.editWelcomeEmailTemplate = async (req, res) => {
		let tempalteUrlType = req.params.template_url_type ? req.params.template_url_type : "";
		let tempalteId = req.params.template_id ? newObjectIdDefault(req.params.template_id) : "";
		let userId = req.params.user_id ? req.params.user_id : "";
		let userType = req.params.user_type ? req.params.user_type : "";

		// --- Validate required parameters ---
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		let tempalteUrlArray = [UPDATE_TEMPLATE_URL_TYPE, DUPLICATE_TEMPLATE_URL_TYPE];

		if (!tempalteUrlType || !tempalteId || !userId || !tempalteUrlArray.includes(tempalteUrlType)) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
			return;
		}

		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		// Safely access req.body and its properties to avoid "Cannot read properties of undefined"
		const body = (req && req.body) ? req.body : {};

		let templateTitle = body.template_title ? body.template_title : "";
		let pageBody = body.page_body ? body.page_body : "";
		let description = body.description ? body.description : "";
		let subject = body.subject ? body.subject : "";
		let designJson = body.design_json ? body.design_json : "";
		let from = body.from ? body.from : "";
		let attachReward = body.attach_reward ? newObjectIdDefault(body.attach_reward) : "";
		let fromEmail = body.from_email ? body.from_email : "";
		let host = body.host ? body.host : "";
		let emailPassword = body.email_password ? body.email_password : "";
		let port = body.port ? body.port : "";

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		if (isPost(req)) {
			// --- Prepare SMTP options for connection check ---
			let smtpOptions = {
				from_email: fromEmail,
				host: host,
				password: emailPassword,
				port: port
			};
			let errMessage = [];

			try {
				// --- Check SMTP connection asynchronously ---
				const smtpResponse = await smtpConnectionCheck(req, res, smtpOptions);

				if (smtpResponse.status == STATUS_ERROR) {
					errMessage.push({ 'param': 'smtp', 'msg': res.__("front.email_template.connection_connected_not_successfully") });
					return res.send({
						status: STATUS_ERROR,
						message: errMessage,
					});
				}

				if (tempalteUrlType == DUPLICATE_TEMPLATE_URL_TYPE) {
					// --- Insert new email template for duplicate ---
					const responseEmail = await addEmailTemplateNewsletter({
						template_title: templateTitle,
						subject: subject,
						body: pageBody,
						description: description,
						user_id: userId,
						attach_reward: attachReward,
						from: from,
						from_email: fromEmail,
						host: host,
						port: port,
						email_password: emailPassword,
						template_type: EMAIL_TEMPLATE_WELCOME_TYPE,
						design_json: JSON.parse(designJson),
						email_descriptions: {
							[DEFAULT_LANGUAGE_MONGO_ID]: {
								"language_id": DEFAULT_LANGUAGE_MONGO_ID,
								"subject": subject,
								"body": pageBody,
							}
						},
					});

					let newTemplateId = responseEmail.email_inserted_id ? responseEmail.email_inserted_id : "";

					// --- Generate image from HTML content asynchronously ---
					await htmltoImageConvert(req, res, newTemplateId);

					// --- Send success response ---
					req.flash("success", res.__("admin.complete_email.template_has_been_added_successfully"));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
						message: res.__("admin.complete_email.template_has_been_added_successfully"),
					});
				} else {
					// --- Prepare update data for template ---
					let updateData = {
						template_title: templateTitle,
						subject: subject,
						body: pageBody,
						description: description,
						design_json: JSON.parse(designJson),
						attach_reward: attachReward,
						from: from,
						from_email: fromEmail,
						host: host,
						port: port,
						email_password: emailPassword,
						modified: getUtcDate(),
						email_descriptions: {
							[DEFAULT_LANGUAGE_MONGO_ID]: {
								"language_id": DEFAULT_LANGUAGE_MONGO_ID,
								"subject": subject,
								"body": pageBody,
							}
						},
					};

					// --- Update email template asynchronously ---
					const updateResult = await emailTemplate.updateOne(
						{
							_id: newObjectIdDefault(tempalteId),
							user_id: newObjectIdDefault(userId)
						},
						{ $set: updateData }
					);

					if (!updateResult || updateResult.modifiedCount === 0) {
						req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
						return res.send({
							status: STATUS_SUCCESS,
							redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
							message: res.__("admin.system.something_going_wrong_please_try_again"),
						});
					}

					// --- Generate image from HTML content and update reward name in parallel ---
					await Promise.all([
						htmltoImageConvert(req, res, tempalteId),
						templateWiseRewardNameUpdate(attachReward, tempalteId)
					]);

					// --- Send success response ---
					req.flash(STATUS_SUCCESS, res.__("front.email_template.template_has_been_updated_successfully"));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
						message: res.__("front.email_template.template_has_been_updated_successfully"),
					});
				}
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in editWelcomeEmailTemplate (POST):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// --- Handle GET: Render edit template page with dropdowns ---
			try {
				req.breadcrumbs(BREADCRUMBS["admin/pocial_email/" + tempalteUrlType]);
				// --- Fetch template details asynchronously ---
				const result = await emailTemplate.findOne({ _id: newObjectIdDefault(tempalteId) });

				if (result) {
					// --- Prepare dropdown options for rewards ---
					let options = {
						collections: [
							{
								collection: TABLE_REWARDS,
								columns: ["_id", "reward_text"],
								sort_conditions: { created: SORT_DESC },
								selected: [result.attach_reward],
								conditions: {
									user_id: newObjectIdDefault(userId),
									is_deleted: NOT_DELETED,
									is_active: ACTIVE
								}
							},
						]
					};
					// --- Fetch dropdown list asynchronously ---
					const response = await getDropdownList(req, res, options);

					return res.render("manage_emails/edit", {
						'rewards_dropdown': (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
						'tempalte_url_type': tempalteUrlType,
						'tempalte_id': tempalteId,
						'user_type': userType,
						'user_id': userId,
						'dynamic_variable': userBreadcrumbs(userType),
						'dynamic_url': userId,
						'result': result
					});
				} else {
					req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
					res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
					return;
				}
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in editWelcomeEmailTemplate (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
				return;
			}
		}
	}; // end editWelcomeEmailTemplate()

	/**
	 * Function to view email template details (async/await version)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render
	 */
	this.viewTemplateDetials = async (req, res) => {
		// --- Extract and validate parameters ---
		let emailLogId = req.params.id ? req.params.id : "";
		let userId = req.params.user_id ? req.params.user_id : "";
		let userType = req.params.user_type ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (!emailLogId) {
			// --- Send error response if emailLogId is missing ---
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
			return;
		}

		try {
			// --- Get email template details asynchronously ---
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const response = await emailTemplate.findOne({ _id: newObjectIdDefault(emailLogId) });

			if (response) {
				// --- Set breadcrumbs and render view page with result ---
				req.breadcrumbs(BREADCRUMBS['admin/pocial_email/view']);
				return res.render('manage_emails/view', {
					result: response,
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
				});
			} else {
				// --- Send error response if no record found ---
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
			}
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in viewTemplateDetials:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
		}
	}; // End viewTemplateDetials()

	/**
	 * Function to add a draft email template using async/await
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.addTemplateDrafts = async (req, res) => {
		let userId = req.params.user_id ? req.params.user_id : "";
		let userType = req.params.user_type ? req.params.user_type : "";

		// --- Validate required parameters ---
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// --- Sanitize and extract input data ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			let templateTitle = req.body.template_title ? req.body.template_title : "";
			let pageBody = req.body.page_body ? req.body.page_body : "";
			let designJson = req.body.design_json ? JSON.parse(req.body.design_json) : "";
			let description = req.body.description ? req.body.description : "";
			let subject = req.body.subject ? req.body.subject : "";

			try {
				// --- Insert draft email template asynchronously ---
				await saveEmailTemplateDraftSave({
					'template_title': templateTitle,
					'body': pageBody,
					'user_id': userId,
					'design_json': designJson,
					'description': description,
					'subject': subject,
					'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
				});

				// --- Send success response ---
				req.flash("success", res.__("front.email_template.draft_has_been_added_successfully"));
				res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
					message: res.__("front.email_template.draft_has_been_added_successfully"),
				});
			} catch (err) {
				// --- Handle errors gracefully ---
				console.error("Error in addTemplateDrafts:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		}
	}; // end addTemplateDrafts()

	/**
	 * Function to delete (discard) a draft email template using async/await
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 *
	 * @return redirect/json
	 */
	this.deleteTemplateDraft = async (req, res) => {
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let templateId = (req.params.template_id) ? newObjectIdDefault(req.params.template_id) : "";

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		try {
			// --- Mark the draft template as deleted and update modified date (async/await) ---
			await emailTemplate.updateOne(
				{
					'_id': templateId,
					'user_id': userId
				},
				{
					$set: {
						'is_deleted': DELETED,
						'modified': getUtcDate(),
					}
				}
			);

			// --- Send success response and redirect ---
			req.flash(STATUS_SUCCESS, res.__("front.email_template.draft_delete_has_been_successfully"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
		} catch (err) {
			// --- Handle errors gracefully ---
			console.error("Error in deleteTemplateDraft:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_emails/' + userId);
		}
	}; // end deleteTemplateDraft()

}
module.exports = new pocialEmailTemplates();
