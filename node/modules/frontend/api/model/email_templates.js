const async = require('async');

function EmailTemplates() {

	/**
	 * Function to get rewards dropdown list using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.getDropdownRewardsList = async (req, res) => {
		let finalResponse = {};
		// Get user id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		// Check if user is authenticated
		if (!userId) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			const rewards = db.collection(TABLE_REWARDS);

			// Build aggregation pipeline for rewards dropdown
			const pipeline = [
				{
					$match: {
						'user_id': newObjectIdDefault(userId),
						'is_deleted': NOT_DELETED,
						'is_active': ACTIVE
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
							{ "$group": { _id: null, count: { $sum: 1 } } }
						],
						as: "rewardsCount"
					}
				},
				{
					$lookup: {
						from: TABLE_POLLS,
						localField: '_id',
						foreignField: 'options.assign_reward',
						as: 'pollsAttachmentCount'
					}
				},
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
					$addFields: {
						"poll_attached_count": { $size: "$pollsAttachmentCount" },
						"email_template_attached_count": {
							$cond: [
								{ $arrayElemAt: ["$rewardsCount.count", 0] },
								{ $arrayElemAt: ["$rewardsCount.count", 0] },
								0
							]
						},
					}
				},
				{ $sort: { created: SORT_DESC } },
				{
					$project: {
						"_id": 1,
						"reward_text": 1,
						"reward_sub_heading": 1,
						"graphic_image": 1,
						"url_desc": 1,
						"is_active": 1,
						"slug": 1,
						"created": 1,
						"expiry_date": 1,
						"store_type_name": "$storeType",
						'attached_email': { '$add': ['$poll_attached_count', '$email_template_attached_count'] },
					}
				}
			];

			// Run aggregation query using async/await
			let result = await rewards.aggregate(pipeline).toArray();

			// Add default option at the top of the dropdown
			result.unshift({ "_id": "", "reward_text": res.__("front.rewards.please_select_rewards") });

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					image_url: LEADS_FORM_URL,
					result: result,
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getDropdownRewardsList();

	/**
	 * Function to get dropdown email template list using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.getDropdownEmailTemplateList = async (req, res) => {
		let finalResponse = {};
		// Get user data and userId
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";

		// Check for valid user
		if (!userId) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Set query conditions
		let conditionsTemplate = {
			'user_id': userId,
			'is_deleted': NOT_DELETED
		};

		// Add search keyword filter if provided
		if (searchKeyword) {
			conditionsTemplate['template_title'] = { $regex: new RegExp(searchKeyword, "i") };
		}

		try {
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Fetch email templates using async/await
			const result = await emailTemplate.find(conditionsTemplate, { projection: { '_id': 1, 'action': 1, 'template_type': 1, 'template_title': 1 } }).sort({ is_active: SORT_DESC }).toArray();

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					welcome_count: result.length,
					default_action: (result.length > 0) ? result[0]['action'] : "",
					result: result,
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					welcome_count: 0,
					default_action: "",
					result: [],
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getDropdownEmailTemplateList();

	/**
	 * Function to add template using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.addTemplate = async (req, res) => {
		let finalResponse = {};
		// Get user id and customer id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

		// Check if user is authenticated
		if (!userId) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Extract template fields from request body
		let templateTitle = req.body.template_title || "";
		let pageBody = req.body.page_body || "";
		let description = req.body.description || "";
		let subject = req.body.subject || "";
		let from = req.body.from || "";
		let fromEmail = req.body.from_email || "";
		let templateType = req.body.template_type || "";
		let attachReward = req.body.attach_reward ? newObjectIdDefault(req.body.attach_reward) : "";
		let designJson = req.body.design_json || "";
		let host = req.body.host || "";
		let port = req.body.port || "";
		let emailPassword = req.body.email_password || "";
		let aiBot = req.body.ai_bot || false;
		let skipSmtp = req.body.skip_smtp || false;
		let completeOnBoarding = req.body.complete_on_boarding || false;

		// Use default SMTP settings if skipSmtp is true
		if (skipSmtp) {
			fromEmail = res.locals.settings["Email.user_email"];
			host = res.locals.settings["Email.host"];
			emailPassword = res.locals.settings["Email.password"];
			port = res.locals.settings["Email.port"];
		}

		// Prepare SMTP options
		let smtpOptions = {
			'from_email': fromEmail,
			'host': host,
			'password': emailPassword,
			'port': port,
		};

		try {
			// Check SMTP connection using async/await
			const smtpResponse = await smtpConnectionCheck(req, res, smtpOptions);

			// If SMTP details are invalid, return error response
			if (smtpResponse.status == STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: smtpResponse.status,
						result: smtpResponse.result,
						message: smtpResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Insert email template using async/await
			const responseEmail = await addEmailTemplateNewsletter({
				'template_title': templateTitle,
				'subject': subject,
				'body': pageBody,
				'description': description,
				'user_id': userId,
				'customer_id': customerId,
				'from': from,
				'from_email': fromEmail,
				'attach_reward': attachReward,
				'host': host,
				'port': port,
				'email_password': emailPassword,
				'template_type': templateType,
				'design_json': designJson,
				'ai_bot': aiBot,
				'skip_smtp': skipSmtp,
				'email_descriptions': {
					[DEFAULT_LANGUAGE_MONGO_ID]: {
						"language_id": DEFAULT_LANGUAGE_MONGO_ID,
						"subject": subject,
						"body": pageBody
					}
				},
			});

			let tempalteId = responseEmail.email_inserted_id ? responseEmail.email_inserted_id : "";

			// Generate image from HTML content and update onboarding if needed, in parallel
			const htmlToImagePromise = htmltoImageConvert(req, res, tempalteId);

			// If onboarding is to be completed, update welcome email id
			let onboardingPromise = null;
			if (completeOnBoarding) {
				onboardingPromise = updateAssignDefaultWelcomeEmailId(userId);
			}

			// Wait for all parallel operations to complete
			await Promise.all([
				htmlToImagePromise,
				onboardingPromise
			]);

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'email_output': {
						"_id": tempalteId,
						'template_title': templateTitle,
						'user_id': userId,
						"subject": subject,
						'body': pageBody
					},
					'result': {},
					'message': res.__("front.email_template.template_has_been_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end addTemplate();

	/**
	 * Function used to edit template using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.editTemplate = async (req, res) => {
		let finalResponse = {};

		// Get user id and template id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let tempalteId = req.body.template_id ? req.body.template_id : "";

		// Check for valid user and template id
		if (!userId || !tempalteId) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Extract template fields from request
		let templateTitle = req.body.template_title ? req.body.template_title : "";
		let pageBody = req.body.page_body ? req.body.page_body : "";
		let description = req.body.description ? req.body.description : "";
		let subject = req.body.subject ? req.body.subject : "";
		let from = req.body.from ? req.body.from : "";
		let fromEmail = req.body.from_email ? req.body.from_email : "";
		let attachReward = req.body.attach_reward ? newObjectIdDefault(req.body.attach_reward) : "";
		let designJson = req.body.design_json ? req.body.design_json : "";
		let host = req.body.host ? req.body.host : "";
		let port = req.body.port ? req.body.port : "";
		let emailPassword = req.body.email_password ? req.body.email_password : "";
		let skipSmtp = req.body.skip_smtp ? req.body.skip_smtp : false;

		// Use default SMTP settings if skipSmtp is true
		if (skipSmtp) {
			fromEmail = res.locals.settings["Email.user_email"];
			host = res.locals.settings["Email.host"];
			emailPassword = res.locals.settings["Email.password"];
			port = res.locals.settings["Email.port"];
		}

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		let optionsConditons = {
			'_id': newObjectIdDefault(tempalteId),
			'user_id': newObjectIdDefault(userId)
		};

		try {
			// Find the template to ensure it exists
			const tempalteResult = await emailTemplate.findOne(optionsConditons);

			if (!tempalteResult) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update the template with new values
			await emailTemplate.updateOne(optionsConditons, {
				$set: {
					'template_title': templateTitle,
					'subject': subject,
					'body': pageBody,
					'description': description,
					'from': from,
					'from_email': fromEmail,
					'host': host,
					'port': port,
					'email_password': emailPassword,
					'attach_reward': attachReward,
					'modified': getUtcDate(),
					'design_json': designJson,
					'skip_smtp': skipSmtp,
					'status': NOT_DRAFT_STATUS,
					'email_descriptions': {
						[DEFAULT_LANGUAGE_MONGO_ID]: {
							"language_id": DEFAULT_LANGUAGE_MONGO_ID,
							"subject": subject,
							"body": pageBody,
						}
					},
				}
			});

			// Run htmltoImageConvert and templateWiseRewardNameUpdate in parallel for efficiency
			await Promise.all([
				htmltoImageConvert(req, res, tempalteId),
				templateWiseRewardNameUpdate(attachReward, tempalteId)
			]);

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'email_output': {
						"_id": tempalteId,
						'template_title': templateTitle,
						'user_id': userId,
						"subject": subject,
						'body': pageBody,
						'assign_audience': (tempalteResult && tempalteResult.assign_audience) ? tempalteResult.assign_audience : {}
					},
					'result': {},
					'message': res.__("front.email_template.template_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end editTemplate();

	/**
	 * Function to edit template body only (direct update) using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.editTemplateBody = async (req, res) => {
		let finalResponse = {};

		// Get user and template details from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let tempalteId = req.body.template_id ? req.body.template_id : "";
		let templateTitle = req.body.template_title ? req.body.template_title : "";
		let pageBody = req.body.page_body ? req.body.page_body : "";
		let designJson = req.body.design_json ? req.body.design_json : "";

		// Validate required fields
		if (!userId || !tempalteId || !templateTitle || !pageBody || !designJson) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Update the email template document
			const updateResult = await emailTemplate.updateOne(
				{
					'_id': newObjectIdDefault(tempalteId),
					'user_id': newObjectIdDefault(userId)
				},
				{
					$set: {
						'template_title': templateTitle,
						'body': pageBody,
						'is_edited_manually': true,
						'modified': getUtcDate(),
						'design_json': designJson,
					}
				}
			);

			// If update failed, send error response
			if (!updateResult || updateResult.matchedCount === 0) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': updateResult,
						'message': res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Run htmltoImageConvert in parallel (if more parallel tasks, add to array)
			await Promise.all([
				htmltoImageConvert(req, res, tempalteId)
			]);

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': {},
					'message': res.__("front.email_template.template_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end editTemplateBody();

	/**
	 * Function to get Email template list
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.getEmailTemplateList = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Extract user and filter parameters from request
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id || "";
			const searchKeyword = req.body.search_keyword || "";
			const templateType = req.body.template_type || "";
			const isEmailTemplateFromLead = req.body.is_email_template_from_lead || "";
			const notSent = req.body.not_sent || false;
			const retargeting = req.body.retargeting || false;

			if (!userId || !templateType) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let page = req.body.page ? parseInt(req.body.page) : 1;
			let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			let skip = (limit * page) - limit;

			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const campaignNewsletterTemplate = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER);

			// Build query options
			let optionsData = {
				'user_id': userId,
				'template_type': templateType,
				'is_deleted': NOT_DELETED
			};

			// If template type is welcome, include campaign newsletter type as well
			if (templateType == EMAIL_TEMPLATE_WELCOME_TYPE) {
				optionsData['template_type'] = { $in: [EMAIL_TEMPLATE_WELCOME_TYPE, EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE] };
			}

			// If from lead, only active templates
			if (isEmailTemplateFromLead) {
				optionsData['is_active'] = ACTIVE;
			}

			// Filter for not sent emails
			if (notSent === true) {
				optionsData['status'] = { $ne: DRAFT_STATUS };
				optionsData['is_sent'] = DEFAULT_ZERO;
			}

			// Filter for retargeting emails
			if (retargeting === true) {
				const retargetingEmailsids = await campaignNewsletterTemplate.distinct("newsletter_template_id", { "user_id": userId });
				optionsData = {
					'_id': { $in: retargetingEmailsids },
					'is_deleted': NOT_DELETED
				};
			}

			// Search by keyword in template title
			if (searchKeyword) {
				optionsData['template_title'] = { $regex: new RegExp(searchKeyword, "i") };
			}

			// Prepare aggregation pipeline for fetching email templates
			const aggregatePipeline = [
				{ $match: optionsData },
				{
					$lookup: {
						from: TABLE_CAMPAIGN_SEND_NEWSLETTER,
						let: { templateId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$newsletter_template_id", "$$templateId"] },
										]
									},
								}
							},
							{ $project: { "_id": 0, "segment_details": 1 } }
						],
						as: "newsletterSegmentDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_LEAD_FORMS,
						let: { templateId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$assign_welcome_email_id", "$$templateId"] },
										]
									},
								}
							},
							{ $project: { "_id": 0, "title": 1 } }
						],
						as: "leadCampaignDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_SIGNUP_LEAD_FORMS,
						let: { leadForms: "$leadCampaignDetails._id" },
						pipeline: [
							{
								$match: {
									$expr: { $in: ["$lead_forms_id", "$$leadForms"] }
								}
							},
							{
								$group: {
									_id: "$lead_forms_id",
									count: { $sum: 1 }
								}
							}
						],
						as: "subscriberCounts"
					}
				},
				{
					$addFields: {
						leadCampaignDetails: {
							$map: {
								input: "$leadCampaignDetails",
								as: "lead",
								in: {
									$mergeObjects: [
										"$$lead",
										{
											'subscriber_user_count': {
												$let: {
													vars: {
														matchingSubscriber: {
															$arrayElemAt: [
																{
																	$filter: {
																		input: "$subscriberCounts",
																		as: "count",
																		cond: { $eq: ["$$count._id", "$$lead._id"] }
																	}
																},
																0
															]
														}
													},
													in: { $ifNull: ["$$matchingSubscriber.count", 0] }
												}
											}
										}
									]
								}
							}
						}
					}
				},
				{
					$addFields: {
						'body': {
							$replaceAll: {
								input: "$body",
								find: 'style="font-size: 12px; color: #169179; line-height: 140%; text-align: left; word-wrap: break-word;',
								replacement: 'style="display: none;"'
							}
						},
					}
				},
				{
					$project: {
						'action': 1,
						'template_title': 1,
						'user_id': 1,
						'body': {
							$replaceAll: {
								input: "$body",
								find: 'style="font-size: 14px; color: #3ca092; line-height: 130%; text-align: center; word-wrap: break-word;"',
								replacement: 'style="display: none;"'
							}
						},
						'status': 1,
						'attach_reward': 1,
						'template_type': 1,
						'is_active': 1,
						'created': 1,
						'subject': 1,
						'from': 1,
						'from_email': 1,
						'email_template_image': 1,
						'assign_audience': { $cond: ["$assign_audience", "$assign_audience", []] },
						'lead_campaign_details': { $cond: ["$leadCampaignDetails", "$leadCampaignDetails", []] },
						'segment_campaign_details': { $cond: ["$newsletterSegmentDetails", "$newsletterSegmentDetails", []] },
						'is_sent': { $cond: ["$is_sent", "$is_sent", 0] },
						'is_opened': { $cond: ["$is_opened", "$is_opened", 0] },
						'is_opened_percentage': { $cond: ["$is_sent", { $multiply: [{ $divide: ["$is_opened", "$is_sent"] }, 100] }, 0] },
						'auto_retargeting_emails': {
							$cond: [
								{
									$gt: [{ $size: { $ifNull: ["$leadCampaignDetails", []] } }, 0]
								},
								true,
								false
							]
						},
						'retargeting_emails': {
							$cond: [
								{
									$gt: [{ $size: { $ifNull: ["$newsletterSegmentDetails", []] } }, 0]
								},
								true,
								false
							]
						},
						'regular_email': {
							$cond: [
								{
									$or: [
										{ $gt: [{ $size: { $ifNull: ["$leadCampaignDetails", []] } }, 0] },
										{ $gt: [{ $size: { $ifNull: ["$newsletterSegmentDetails", []] } }, 0] }
									]
								},
								false,
								true
							]
						},
						'modified': 1
					}
				},
				{ $sort: { 'created': SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			];

			// Run queries in parallel for better performance
			const [templateList, totalCount] = await Promise.all([
				// Fetch paginated email templates with aggregation
				emailTemplate.aggregate(aggregatePipeline).toArray(),
				// Fetch total count for pagination
				emailTemplate.countDocuments(optionsData)
			]);

			// Save AI data structure (not blocking response)
			fetchUserEmailSummary(req, res, userId)
				.then(emailData => saveCustomerBucketItems({
					'user_id': userId,
					'bucket_name': DATA_BUCKET_EMAIL,
					'parent_bucket': PARENT_BUCKET_EMAIL,
					'data': emailData
				}))
				.catch(() => { /* ignore errors for background save */ });

			// Prepare and send response
			if (templateList && templateList.length > 0) {
				const totalRecord = totalCount || 0;
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
						'result': templateList,
						'recordsTotal': totalCount,
						'limit': limit,
						'page': page,
						'message': "",
						'total_page': Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
						'result': [],
						'recordsTotal': 0,
						'limit': limit,
						'page': page,
						'message': res.__("front.global.no_record_found"),
						'total_page': 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getEmailTemplateList();

	/**
	 * Function to get email template details using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.emailTemplateDetails = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and template details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const templateAction = req.body.template_action ? req.body.template_action : "";
			const templateId = req.body.template_id ? newObjectIdDefault(req.body.template_id) : "";
			const signatureImage = loginUserData.signature_image ? loginUserData.signature_image : "";

			// Validate required fields
			if (!userId || (!templateAction && !templateId)) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Build aggregation pipeline for fetching template details
			const aggregatePipeline = [
				{
					$match: {
						'$or': [
							{ 'action': templateAction },
							{ '_id': templateId }
						],
						'user_id': userId,
						'is_deleted': NOT_DELETED
					}
				},
				{
					$lookup: {
						"from": TABLE_REWARDS,
						"localField": "attach_reward",
						"foreignField": "_id",
						"as": "attachRewardDetails"
					}
				},
				{
					$addFields: {
						'body': {
							$replaceAll: {
								input: "$body",
								find: 'style="font-size: 12px; color: #169179; line-height: 140%; text-align: left; word-wrap: break-word;',
								replacement: 'style="display: none;"'
							}
						},
					}
				},
				{
					$project: {
						_id: 1,
						template_title: 1,
						action: 1,
						user_id: 1,
						description: 1,
						subject: 1,
						'body': {
							$replaceAll: {
								input: "$body",
								find: 'style="font-size: 14px; color: #3ca092; line-height: 130%; text-align: center; word-wrap: break-word;"',
								replacement: 'style="display: none;"'
							}
						},
						design_json: 1,
						from: 1,
						from_email: 1,
						attach_reward: 1,
						template_type: 1,
						is_active: 1,
						is_deleted: 1,
						host: 1,
						status: 1,
						port: 1,
						email_password: 1,
						email_template_image: 1,
						skip_smtp: 1,
						is_sent: { $cond: ["$is_sent", "$is_sent", 0] },
						is_opened: { $cond: ["$is_opened", "$is_opened", 0] },
						is_opened_percentage: { $cond: ["$is_sent", { $multiply: [{ $divide: ["$is_opened", "$is_sent"] }, 100] }, 0] },
						unsubscribed: { $cond: ["$unsubscribed", "$unsubscribed", 0] },
						created: 1,
						modified: 1,
						reward_text: { $arrayElemAt: ["$attachRewardDetails.reward_text", 0] },
						signature_url: SIGNATURE_URL,
						business_image_url: USERS_URL
					}
				},
			];

			// Run aggregation query
			const result = await emailTemplate.aggregate(aggregatePipeline).toArray();

			if (!result || result.length === 0) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': [],
						'message': res.__("front.email_template.email_template_not_valid"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let resultEmailData = result[0];

			// Replace {SIGNATURE} constant with signature image if available
			if (signatureImage) {
				const imgSignatureSrc = `<img src="${SIGNATURE_URL + signatureImage}" style="max-height:60px;">`;
				resultEmailData.body = resultEmailData.body.replace(/{SIGNATURE}/g, imgSignatureSrc);
				resultEmailData.design_json = JSON.parse(
					JSON.stringify(
						resultEmailData.design_json,
						(key, value) => {
							if (typeof value === 'string') {
								return value.replace(/{SIGNATURE}/g, imgSignatureSrc);
							}
							return value;
						}
					)
				);
			} else {
				resultEmailData.body = resultEmailData.body.replace(/{SIGNATURE}/g, "");
			}

			// Replace {BUSINESS_IMAGE_URL} constant with business/reward logo if available
			const publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
			const businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
			const businessRewardLogo = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";
			let profileImageUrl = "";

			if (businessRewardLogo !== '') {
				profileImageUrl = USERS_URL + businessRewardLogo;
			} else if (businessLogo !== '') {
				profileImageUrl = USERS_URL + businessLogo;
			}

			let imgProfileImageSrc = '';
			if (profileImageUrl !== '') {
				imgProfileImageSrc = `<img src="${profileImageUrl}" style="max-height:100px;">`;
			}

			resultEmailData.body = resultEmailData.body.replace(/{BUSINESS_IMAGE_URL}/g, imgProfileImageSrc);
			resultEmailData.design_json = JSON.parse(
				JSON.stringify(
					resultEmailData.design_json,
					(key, value) => {
						if (typeof value === 'string') {
							return value.replace(/{BUSINESS_IMAGE_URL}/g, imgProfileImageSrc);
						}
						return value;
					}
				)
			);

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': resultEmailData,
					'message': ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end emailTemplateDetails();

	/**
	 * Function to change email template status using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.emailTemplateStatusChange = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and template details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const templateId = req.body.template_id ? newObjectIdDefault(req.body.template_id) : "";
			const isActiveStatus = req.body.is_active ? req.body.is_active : DEACTIVE;

			// Validate required fields
			if (!userId || !templateId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare mail options for status change
			const mailOptions = {
				'user_id': userId,
				'template_id': templateId,
				'is_active': isActiveStatus,
			};

			// Call the function to activate/deactivate template using async/await
			const responseTest = await activeDeactiveWelcomeEmail(req, res, mailOptions);

			// Send response based on the result
			finalResponse = {
				'data': {
					'status': responseTest.status,
					'message': responseTest.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end emailTemplateStatusChange();

	/**
	 * Function to send a test email using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.sendTestEmail = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and email details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const pageBody = req.body.page_body ? req.body.page_body : "";
			const email = req.body.email ? req.body.email : "";
			const attachRewardId = req.body.attach_reward ? newObjectIdDefault(req.body.attach_reward) : "";

			// Validate required fields
			if (!userId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare mail options for sending test email
			const testMailOptions = {
				'email': email,
				'page_body': pageBody,
				'attach_reward': attachRewardId
			};

			// Send test email using async/await
			const responseTest = await sendTestEmailTemplate(req, res, testMailOptions);

			// Send response based on the result
			if (responseTest) {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						error: {},
						message: res.__("front.email_template.email_has_been_sent_successfully")
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						error: {},
						message: res.__("front.email_template.email_has_been_not_sent_successfully")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					error: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end sendTestEmail();

	/**
	 * Function to update template attach reward using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.updateTemplateAttachReward = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and template information from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const tempalteId = req.body.template_id ? newObjectIdDefault(req.body.template_id) : "";
			const attachReward = req.body.attach_reward ? newObjectIdDefault(req.body.attach_reward) : "";

			// Validate required fields
			if (!userId || !tempalteId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			if (!attachReward) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.rewards.please_select_at_least_one_reward_select"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update email template with new reward using async/await
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const updateResult = await emailTemplate.updateOne(
				{
					_id: newObjectIdDefault(tempalteId),
					user_id: newObjectIdDefault(userId)
				},
				{
					$set: {
						attach_reward: attachReward,
						modified: getUtcDate(),
					}
				}
			);

			// If update failed, send error response
			if (!updateResult || updateResult.matchedCount === 0) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update template reward name in parallel (if needed, can add more parallel tasks)
			await Promise.all([
				templateWiseRewardNameUpdate(attachReward, tempalteId)
			]);

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					message: res.__("front.email_template.reward_has_been_assign_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end updateTemplateAttachReward();

	/**
	 * Function to Verify SMTP connection configuration using async/await for faster and cleaner response.
	 *
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.verifySmtpConnection = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and SMTP details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			let userEmail = req.body.from_email ? req.body.from_email : "";
			let emailHost = req.body.host ? req.body.host : "";
			let emailPassword = req.body.email_password ? req.body.email_password : "";
			let emailPort = req.body.port ? Number(req.body.port) : "";
			const skipSmtp = req.body.skip_smtp ? req.body.skip_smtp : false;

			// If skipSmtp is true, use default SMTP settings from config
			if (skipSmtp === true) {
				userEmail = res.locals.settings["Email.user_email"];
				emailHost = res.locals.settings["Email.host"];
				emailPassword = res.locals.settings["Email.password"];
				emailPort = res.locals.settings["Email.port"];
			}

			// Validate required fields
			if (!userId || !userEmail || !emailHost || !emailPassword || !emailPort) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'skip_smtp': skipSmtp,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare SMTP options
			const smtpOptions = {
				'from_email': userEmail,
				'host': emailHost,
				'password': emailPassword,
				'port': emailPort,
			};

			// Check SMTP connection asynchronously
			const smtpResponse = await smtpConnectionCheck(req, res, smtpOptions);

			finalResponse = {
				'data': {
					'status': smtpResponse.status,
					'skip_smtp': skipSmtp,
					'result': smtpResponse.result,
					'error': smtpResponse.error,
					'message': smtpResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'skip_smtp': req.body && req.body.skip_smtp ? req.body.skip_smtp : false,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end verifySmtpConnection();

	/**
	 * Function to get the complete template list using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.getCompleteTempleteList = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user data and complete profile reward details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const completeProfileDetails = loginUserData.complete_profile_reward ? loginUserData.complete_profile_reward : {};
			const attachReward = completeProfileDetails.attach_reward ? completeProfileDetails.attach_reward : "";
			const attachRewardName = completeProfileDetails.attach_reward_name ? completeProfileDetails.attach_reward_name : "";
			const completeTempalteId = completeProfileDetails.tempalte_id ? completeProfileDetails.tempalte_id : "";
			const completeTempalteAction = completeProfileDetails.tempalte_action ? completeProfileDetails.tempalte_action : "";

			// Validate user ID
			if (!userId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get super admin complete template from DB using async/await
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const templateQuery = {
				'template_type': EMAIL_TEMPLATE_COMPLETE_TYPE,
				'user_id': newObjectIdDefault(ADMIN_ID),
				'is_active': ACTIVE,
				'is_deleted': NOT_DELETED
			};
			const templateProjection = {
				projection: {
					'_id': 1,
					'template_title': 1,
					'description': 1,
					'subject': 1,
					'created': 1,
					'body': 1,
				}
			};

			const tempalteResult = await emailTemplate.findOne(templateQuery, templateProjection);

			if (tempalteResult) {
				// Assign complete profile reward details to the template result
				tempalteResult['complete_attach_reward'] = attachReward;
				tempalteResult['complete_attach_reward_name'] = attachRewardName;
				tempalteResult['complete_tempalte_id'] = completeTempalteId;
				tempalteResult['complete_tempalte_action'] = completeTempalteAction;
				tempalteResult['body'] = tempalteResult.body.replace(/{CURRENT_YEAR}/g, new Date().getFullYear());

				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: tempalteResult,
						message: ""
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.email_template.email_template_not_valid"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getCompleteTempleteList();

	/**
	 * Function to assign a reward to a complete template using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.completeTempleteAssignReward = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and template details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
			const tempalteId = req.body.template_id ? newObjectIdDefault(req.body.template_id) : "";
			const attachReward = req.body.attach_reward ? newObjectIdDefault(req.body.attach_reward) : "";

			// Validate required fields
			if (!userId || !tempalteId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for reward assignment
			const optionsData = {
				'attach_reward': attachReward
			};

			// Assign reward to the complete template using async/await
			const assignRewardResponse = await completeEmailTemplateRewardAssign(req, res, optionsData);

			// Send response after reward assignment
			finalResponse = {
				'data': {
					'status': assignRewardResponse.status,
					'message': assignRewardResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end completeTempleteAssignReward();

	/**
	 * Function to get active welcome email template list using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.getActiveWelcomeTemplateList = async (req, res) => {
		let finalResponse = {};
		try {
			// Extract user id from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// Validate user id
			if (!userId) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch active welcome templates using async/await
			const responseData = await getActiveWelcomeTemplate(userId);

			// Prepare and send response
			finalResponse = {
				'data': {
					'status': responseData.status ? responseData.status : "",
					'is_draft': responseData.is_draft ? responseData.is_draft : "",
					'result': responseData.result ? responseData.result : {},
					'already_smtp': responseData.already_smtp ? responseData.already_smtp : ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getActiveWelcomeTemplateList();

	/**
	 * Function to save email template draft using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.addTemplateDraft = async (req, res) => {
		let finalResponse = {};
		try {
			// Extract user id from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// Validate user id
			if (!userId) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract template draft details from request body
			const templateTitle = req.body.template_title ? req.body.template_title : "";
			const pageBody = req.body.page_body ? req.body.page_body : "";
			const designJson = req.body.design_json ? req.body.design_json : "";
			const templateType = req.body.template_type ? req.body.template_type : "";
			const templateId = req.body.template_id ? req.body.template_id : "";
			const description = req.body.description ? req.body.description : "";
			const subject = req.body.subject ? req.body.subject : "";

			// Insert draft email template using async/await
			await saveEmailTemplateDraftSave({
				'template_title': templateTitle,
				'body': pageBody,
				'user_id': userId,
				'design_json': designJson,
				'template_type': templateType,
				'template_id': templateId,
				'description': description,
				'subject': subject,
			});

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': {},
					'message': res.__("front.email_template.draft_has_been_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end addTemplateDraft();

	/**
	 * Function to delete an email template draft using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.deleteTemplateDraft = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and template details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const templateId = req.body.template_id ? newObjectIdDefault(req.body.template_id) : "";

			// Validate required fields
			if (!userId || !templateId) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Discard template draft using async/await
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

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': {},
					'message': res.__("front.email_template.draft_delete_has_been_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end deleteTemplateDraft();

	/**
	 * Function to send user email tracking
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json
	 */
	this.trackSendEmail = async (req, res) => {
		let finalResponse = {};
		try {
			// Get user id and email action
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id || "";
			const sentRewardEmailAction = req.body.email_action || "";

			const searchKeyword = req.body.search_keyword || "";
			const zipSearchKeyword = isNaN(searchKeyword) ? searchKeyword : Number(searchKeyword);

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			const sendLogsTable = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE_SEND_LOGS);

			if (!userId || !sentRewardEmailAction) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Common filter condition
			const rewardCondition = {
				"email_template_action": sentRewardEmailAction
			};

			// Search condition
			let searchCondition = {};
			if (searchKeyword) {
				searchCondition['$or'] = [
					{ 'first_name': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'last_name': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'full_name': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'email': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'mobile': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'zip': zipSearchKeyword },
				];
			}

			// Aggregation pipeline for fetching paginated results
			const earnSentRewardPipeline = [
				{ $match: rewardCondition },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { email: "$to_email" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email", "$$email"] },
										]
									},
								}
							},
							{ $project: { "_id": 0, "email": 1, "full_name": 1, "fname": 1, "lname": 1, "gender": 1, "dob": 1, "zip": 1, "mobile": 1 } }
						],
						as: "userDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_EMAIL_TRACK_OPEN,
						let: { tamplateId: "$email_template_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email_template_id", "$$tamplateId"] },
										]
									},
								}
							},
							{ $project: { "is_opened": 1 } }
						],
						as: "TrackEmailOpen"
					}
				},
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { earnSentRewardId: "$earn_sent_reward_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$earnSentRewardId"] },
										]
									},
								}
							},
							{ $project: { "sub_title": 1, "title": 1, "is_redemed": 1, "is_viewed": 1 } }
						],
						as: "earnSentRewardDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"template_type": 1,
						"attach_reward": "$earn_sent_reward_id",
						"email": "$to_email",
						"created": 1,
						"earn_sent_reward_id": 1,
						"sub_title": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.sub_title", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.sub_title", 0] }, 0] },
						"title": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.title", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.title", 0] }, 0] },
						"is_redemed": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.is_redemed", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.is_redemed", 0] }, 0] },
						"is_viewed": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.is_viewed", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.is_viewed", 0] }, 0] },
						"is_opened": { $cond: [{ $arrayElemAt: ["$TrackEmailOpen.is_opened", 0] }, { $arrayElemAt: ["$TrackEmailOpen.is_opened", 0] }, 0] },
						"full_name": { $cond: [{ $arrayElemAt: ["$userDetails.full_name", 0] }, { $arrayElemAt: ["$userDetails.full_name", 0] }, ""] },
						"first_name": { $cond: [{ $arrayElemAt: ["$userDetails.fname", 0] }, { $arrayElemAt: ["$userDetails.fname", 0] }, ""] },
						"last_name": { $cond: [{ $arrayElemAt: ["$userDetails.lname", 0] }, { $arrayElemAt: ["$userDetails.lname", 0] }, ""] },
						"gender": { $cond: [{ $arrayElemAt: ["$userDetails.gender", 0] }, { $arrayElemAt: ["$userDetails.gender", 0] }, ""] },
						"zip": { $cond: [{ $arrayElemAt: ["$userDetails.zip", 0] }, { $arrayElemAt: ["$userDetails.zip", 0] }, ""] },
						"mobile": { $cond: [{ $arrayElemAt: ["$userDetails.mobile", 0] }, { $arrayElemAt: ["$userDetails.mobile", 0] }, ""] },
						"dob": { $cond: [{ $arrayElemAt: ["$userDetails.dob", 0] }, { $arrayElemAt: ["$userDetails.dob", 0] }, ""] },
					}
				},
				{ $match: searchCondition },
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			];

			// Aggregation pipeline for counting total records
			const totalEarnSentRewardPipeline = [
				{ $match: rewardCondition },
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
							{ $project: { "_id": 0, "email": 1, "full_name": 1, "fname": 1, "lname": 1, "gender": 1, "dob": 1, "zip": 1, "mobile": 1 } }
						],
						as: "userDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_EMAIL_TRACK_OPEN,
						let: { tamplateId: "$email_template_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email_template_id", "$$tamplateId"] },
										]
									},
								}
							},
							{ $project: { "is_opened": 1 } }
						],
						as: "TrackEmailOpen"
					}
				},
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { earnSentRewardId: "$earn_sent_reward_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$earnSentRewardId"] },
										]
									},
								}
							},
							{ $project: { "sub_title": 1, "title": 1, "is_redemed": 1, "is_viewed": 1 } }
						],
						as: "earnSentRewardDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"template_type": 1,
						"email": "$to_email",
						"created": 1,
						"earn_sent_reward_id": 1,
						"sub_title": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.sub_title", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.sub_title", 0] }, 0] },
						"title": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.title", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.title", 0] }, 0] },
						"is_redemed": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.is_redemed", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.is_redemed", 0] }, 0] },
						"is_viewed": { $cond: [{ $arrayElemAt: ["$earnSentRewardDetails.is_viewed", 0] }, { $arrayElemAt: ["$earnSentRewardDetails.is_viewed", 0] }, 0] },
						"is_opened": { $cond: [{ $arrayElemAt: ["$TrackEmailOpen.is_opened", 0] }, { $arrayElemAt: ["$TrackEmailOpen.is_opened", 0] }, 0] },
						"full_name": { $cond: [{ $arrayElemAt: ["$userDetails.full_name", 0] }, { $arrayElemAt: ["$userDetails.full_name", 0] }, ""] },
						"first_name": { $cond: [{ $arrayElemAt: ["$userDetails.fname", 0] }, { $arrayElemAt: ["$userDetails.fname", 0] }, ""] },
						"last_name": { $cond: [{ $arrayElemAt: ["$userDetails.lname", 0] }, { $arrayElemAt: ["$userDetails.lname", 0] }, ""] },
						"gender": { $cond: [{ $arrayElemAt: ["$userDetails.gender", 0] }, { $arrayElemAt: ["$userDetails.gender", 0] }, ""] },
						"zip": { $cond: [{ $arrayElemAt: ["$userDetails.zip", 0] }, { $arrayElemAt: ["$userDetails.zip", 0] }, ""] },
						"mobile": { $cond: [{ $arrayElemAt: ["$userDetails.mobile", 0] }, { $arrayElemAt: ["$userDetails.mobile", 0] }, ""] },
						"dob": { $cond: [{ $arrayElemAt: ["$userDetails.dob", 0] }, { $arrayElemAt: ["$userDetails.dob", 0] }, ""] },
					}
				},
				{ $match: searchCondition },
			];

			// Run both queries in parallel using Promise.all for faster response
			const [earnSentDetails, totalEarnSentRewardArr] = await Promise.all([
				sendLogsTable.aggregate(earnSentRewardPipeline).toArray(),
				sendLogsTable.aggregate(totalEarnSentRewardPipeline).toArray()
			]);

			const totalRecords = totalEarnSentRewardArr.length;

			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': earnSentDetails,
					'recordsTotal': totalRecords,
					'limit': limit,
					'page': page,
					'total_page': Math.ceil(totalRecords / limit),
					'message': ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': 0,
					'recordsTotal': 0,
					'limit': 0,
					'page': 0,
					'total_page': 0,
					'message': err && err.message ? err.message : res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end trackSendEmail();

	/**
	 * Function to get AI BOT welcome email details using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.aiBotWelcomeEmailTemplateDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and userId from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// Validate userId
			if (!userId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Build aggregation pipeline for fetching AI BOT welcome email template
			const aggregatePipeline = [
				{
					$match: {
						'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
						'user_id': newObjectIdDefault(userId),
						'is_active': ACTIVE,
						'is_deleted': NOT_DELETED,
						'ai_bot': true
					}
				},
				{
					$lookup: {
						"from": TABLE_REWARDS,
						"localField": "attach_reward",
						"foreignField": "_id",
						"as": "attachRewardDetails"
					}
				},
				{
					$project: {
						'_id': 1,
						'description': 1,
						'action': 1,
						'subject': 1,
						'created': 1,
						'body': 1,
						'design_json': 1,
						'template_title': 1,
						'skip_smtp': 1,
						'reward_text': { $arrayElemAt: ["$attachRewardDetails.reward_text", 0] },
						'reward_sub_heading': { $arrayElemAt: ["$attachRewardDetails.reward_sub_heading", 0] },
					}
				},
			];

			// Run aggregation query using async/await
			const templateResultArr = await emailTemplate.aggregate(aggregatePipeline).toArray();

			if (templateResultArr && templateResultArr.length > 0) {
				let templateResult = templateResultArr[0];

				// Get business details from logged in user
				const publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
				const nameOfTheBusiness = (publicBusinessInformaton && publicBusinessInformaton.name_of_the_business) ? publicBusinessInformaton.name_of_the_business : "";

				// Replace placeholders in template body
				if (templateResult.body) {
					templateResult.body = templateResult.body.replace(/{BUSINESS_NAME}/g, nameOfTheBusiness);
					templateResult.body = templateResult.body.replace(/{CURRENT_YEAR}/g, new Date().getFullYear());
					templateResult.body = templateResult.body.replace(/{LINK}/g, "javascript:void(0)");
				}

				// Send success response
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: templateResult,
						message: ""
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// No template found, send error response
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.email_template.email_template_not_valid"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end aiBotWelcomeEmailTemplateDetails();

	/**
	 * Function to get assigned audience (segments and lead forms) with async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAssignAudience = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and pagination details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			if (!userId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build aggregation pipeline to merge poll segments and lead forms
			const pipeline = [
				// Step 1: Get poll segments
				{
					$match: {
						"is_deleted": NOT_DELETED,
						"user_id": newObjectIdDefault(userId),
						"is_draft": SEGMENT_NOT_DRAFTS,
						"segment_type": { $in: ALL_SEGMENT_FILTER }
					}
				},
				{
					$project: {
						'assign_id': "$_id",
						'title_name': "$segment_name",
						'assign_title_name': "$segment_name",
						'created': 1,
						'lead_segment_slug': "$slug",
						'assign_type': { $literal: "poll_segment" }
					}
				},
				// Step 2: Union with lead forms (audiences)
				{
					$unionWith: {
						coll: TABLE_AUDIENCES,
						pipeline: [
							{
								$match: {
									"user_id": newObjectIdDefault(userId)
								}
							},
							{
								$project: {
									'assign_id': "$_id",
									'assign_title_name': "$title",
									'title_name': "$title",
									'created': 1,
									'assign_total_user': "$total_users",
									'lead_segment_slug': "$lead_forms_slug",
									'assign_type': { $literal: "lead_form" }
								}
							}
						]
					}
				},
				// Step 3: Facet for total records and paginated data
				{
					$facet: {
						metadata: [{ $count: "totalRecords" }],
						data: [
							{ $sort: { created: -1 } },
							{ $skip: skip },
							{ $limit: limit }
						]
					}
				},
				// Step 4: Format the result
				{
					$project: {
						totalRecords: { $arrayElemAt: ["$metadata.totalRecords", 0] },
						data: 1
					}
				}
			];

			const collection = db.collection(TABLE_POLL_SEGMENT);

			// Run aggregation query using async/await
			const results = await collection.aggregate(pipeline).toArray();

			if (results && results.length > 0) {
				const responseData = results[0];
				const totalRecords = responseData.totalRecords || 0;
				const paginatedData = responseData.data || [];

				// For poll_segment, fetch total user count in parallel
				const promises = paginatedData.map(async (record, index) => {
					if (record.assign_type === 'poll_segment') {
						const optionSegmetData = {
							'user_id': userId,
							'segment_slug': record.lead_segment_slug,
							'selected_users_ids': [],
						};
						// Get segment details (total user count)
						const segmetResponse = await segmentWiseTotalUserCount(req, res, optionSegmetData);
						paginatedData[index]['assign_total_user'] = segmetResponse['total_user'];
					}
				});
				await Promise.all(promises);

				// Send success response
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': paginatedData,
						'recordsTotal': totalRecords,
						'limit': limit,
						'page': page,
						'total_page': Math.ceil(totalRecords / limit),
						'message': "",
					}
				};
			} else {
				// No records found
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': [],
						'recordsTotal': 0,
						'limit': 0,
						'page': 0,
						'total_page': 0,
						'message': res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': [],
					'recordsTotal': 0,
					'limit': 0,
					'page': 0,
					'total_page': 0,
					'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAssignAudience();

	/**
	 * Function to assign audience for email using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.assignAudienceForEmail = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request details
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const emailTemplateId = req.body.email_newsletter_template_id ? newObjectIdDefault(req.body.email_newsletter_template_id) : "";
			const assignId = req.body.assign_id ? newObjectIdDefault(req.body.assign_id) : "";
			const leadSegmentSlug = req.body.lead_segment_slug ? req.body.lead_segment_slug : "";
			const assignTitleName = req.body.assign_title_name ? req.body.assign_title_name : "";
			const assignTotalUser = req.body.assign_total_user ? req.body.assign_total_user : 0;
			const assignType = req.body.assign_type ? req.body.assign_type : "";
			const currentTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE;
			const scheduleDate = req.body.schedule_date ? req.body.schedule_date : "";

			let mailSendScheduleDate = "";
			if (scheduleDate !== '') {
				mailSendScheduleDate = getUtcDateTimezone(scheduleDate, currentTimezone);
			}

			// Validate required fields
			if (!userId || !emailTemplateId || !assignType || !assignTitleName) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check plan limit for reward purchase
			const postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_EMAIL_SEND_TYPE);

			if (postLimitData.status === NOT_ALLOW_CREATE_DATA) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"result": {},
						"message": res.__("front.social_post_limnt.post_limit_reached_upgrade_your_plan_to_post_more"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get DB collections
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const audienceTable = db.collection(TABLE_AUDIENCES);
			const leadAndSegmentEmailTable = db.collection(TABLE_LEAD_AND_SEGMENT_EMAIL_SEND_LOGS);
			const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

			const emailConditions = {
				'_id': newObjectIdDefault(emailTemplateId),
				'user_id': newObjectIdDefault(userId)
			};

			// Fetch email template data
			const tempalteResult = await emailTemplate.findOne(
				emailConditions,
				{ projection: { '_id': 1, 'attach_reward': 1, 'action': 1, 'template_title': 1 } }
			);

			if (!tempalteResult) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("front.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare template details
			const templateId = tempalteResult._id ? tempalteResult._id : "";
			const attachReward = tempalteResult.attach_reward ? tempalteResult.attach_reward : "";
			const templateTitle = tempalteResult.template_title ? tempalteResult.template_title : "";
			const templateAction = tempalteResult.action ? tempalteResult.action : "";

			// Update email template with assigned audience
			await emailTemplate.updateOne(emailConditions, {
				$set: {
					'assign_audience_created': getUtcDate(),
					'assign_audience_schedule_date': mailSendScheduleDate,
					'assign_audience': [
						{
							'assign_id': assignId,
							'assign_title_name': assignTitleName,
							'lead_segment_slug': leadSegmentSlug,
							'assign_type': assignType,
							'assign_total_user': assignTotalUser,
							'schedule_date': mailSendScheduleDate,
						}
					]
				}
			});

			// Fetch audience data and segment details in parallel
			const [audienceData, segmetResponse] = await Promise.all([
				audienceTable.findOne(
					{ "_id": assignId },
					{ projection: { '_id': 1, 'lead_forms_id': 1, 'lead_import_id': 1, 'audience_type': 1, 'description': 1, 'lead_forms_slug': 1, 'lead_forms_subscriber_ids': 1, 'audience_emails': 1 } }
				),
				segmentWiseTotalUserCount(req, res, {
					'user_id': userId,
					'segment_slug': leadSegmentSlug,
					'selected_users_ids': [],
				})
			]);

			let sendEmailUserArray = [];

			// Prepare user array for sending emails based on assign type
			if (assignType === 'lead_form') {
				const audienceEmailUserArray = (audienceData && audienceData.audience_emails) ? audienceData.audience_emails : [];
				sendEmailUserArray = audienceEmailUserArray.map(email => ({ email }));
			} else if (assignType === 'poll_segment') {
				sendEmailUserArray = (segmetResponse && segmetResponse.all_users) ? segmetResponse.all_users : [];
			}

			// Insert email send logs if there are users to send to
			if (sendEmailUserArray.length > 0) {
				// Delete previous logs for this template and user
				await leadAndSegmentEmailTable.deleteMany({
					'from_user_id': newObjectIdDefault(userId),
					'email_newsletter_template_id': newObjectIdDefault(emailTemplateId)
				});

				// Prepare log insertions in parallel
				const logInsertPromises = sendEmailUserArray.map(records => {
					return leadAndSegmentEmailTable.insertOne({
						'email_newsletter_template_id': newObjectIdDefault(emailTemplateId),
						'attach_reward': attachReward,
						'from_user_id': newObjectIdDefault(userId),
						'email_send_status': CAMPAIGN_PENDING_PROCESS,
						'assign_id': assignId,
						'assign_title_name': assignTitleName,
						'lead_segment_slug': leadSegmentSlug,
						'assign_type': assignType,
						'assign_total_user': assignTotalUser,
						'schedule_date': mailSendScheduleDate,
						'to_email': (records.email) ? records.email : "",
						'audience_data': (audienceData) ? audienceData : {},
						'segment_data': (segmetResponse) ? segmetResponse : {},
						'is_sent': DEFAULT_ZERO,
						'created': getUtcDate()
					});
				});
				await Promise.all(logInsertPromises);
			}

			// If scheduled, handle calendar scheduling
			if (mailSendScheduleDate !== '') {
				// Remove any previous schedule for this template/action
				await calendarSchedulePost.deleteMany({ 'unique_key': templateAction, "type": AI_RESPONSE_TYPE_EMAIL });

				// Insert new schedule
				const scheduleInsertOptions = {
					'title_name': templateTitle,
					'schedule_date': mailSendScheduleDate,
					'user_id': newObjectIdDefault(userId),
					'unique_key': templateAction,
					'email_template_id': templateId,
					'email_template_action': templateAction,
					'ai_campaign_parent_id': "",
					'ai_campaign_chat_id': "",
					'type': AI_RESPONSE_TYPE_EMAIL,
				};
				await schedulePostInsertData(req, res, scheduleInsertOptions);
			}

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.email_template.assign_audience_saved_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors and send error response
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end assignAudienceForEmail();

}
module.exports = new EmailTemplates();