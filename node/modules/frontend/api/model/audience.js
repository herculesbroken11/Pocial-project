const async = require('async');

/** Define collection */
const audienceTable = db.collection(TABLE_AUDIENCES);

function Audience() {

	/**
	 * Function to get audience list using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.getAudienceList = async (req, res) => {
		let finalResponse = {};
		// Get user
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
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

		let page = req.body.page ? parseInt(req.body.page) : 1;
		let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		let skip = (limit * page) - limit;
		let conditions = {
			user_id: newObjectIdDefault(userId)
		};

		try {
			// Run both queries in parallel for better performance
			const [audienceList, totalRecord] = await Promise.all([
				// Get audience listing
				audienceTable.find(conditions).collation(COLLATION_VALUE).sort({ created: SORT_DESC }).skip(skip).limit(limit).toArray(),
				// Get audience count
				audienceTable.countDocuments(conditions)
			]);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: audienceList || [],
					recordsTotal: totalRecord || 0,
					limit: limit,
					page: page,
					message: audienceList && audienceList.length > 0 ? "" : res.__("front.global.no_record_found"),
					total_page: Math.ceil((totalRecord || 0) / limit)
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					recordsTotal: 0,
					limit: limit,
					page: page,
					message: res.__("front.global.no_record_found"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAudienceList();

	/**
	 * Function to choose from audiences using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.chooseFromAudiences = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let excelLeadFormsId = loginUserData.excel_lead_forms_id ? loginUserData.excel_lead_forms_id : "";
		let excelLeadFormsSlug = loginUserData.excel_lead_forms_slug ? loginUserData.excel_lead_forms_slug : "";
		let audienceIds = req.body.audience_ids ? req.body.audience_ids : [];
		let audienceTitle = req.body.title ? req.body.title : "";
		let audienceDescription = req.body.description ? req.body.description : "";

		if (!userId || audienceIds.length === 0) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Convert checked user ids to ObjectId
		let audienceIdsArray = [];
		if (audienceIds.length > 0) {
			audienceIds.forEach((ids) => {
				if (ids !== '') {
					audienceIdsArray.push(newObjectIdDefault(ids));
				}
			});
		}

		try {
			// Get all subscriber ids and audience emails for the selected audiences
			let conditionsAudience = {
				'_id': { $in: audienceIdsArray }
			};

			const assignLeadSubscriberUsers = await withoutDistinctLeadFormsSubscriberIds(conditionsAudience);
			let allSubscriberIds = assignLeadSubscriberUsers.all_subscriber_ids ? assignLeadSubscriberUsers.all_subscriber_ids : [];
			let allAudienceEmails = assignLeadSubscriberUsers.all_audience_emails ? assignLeadSubscriberUsers.all_audience_emails : [];

			if (allAudienceEmails.length > 0) {
				// Generate slug for the new audience
				let slugOptions = {
					title: audienceTitle,
					table_name: TABLE_AUDIENCES,
					slug_field: "slug"
				};
				const slugResponse = await getDatabaseSlug(slugOptions);

				// Insert new audience data
				await audienceTable.insertOne({
					'user_id': userId,
					'lead_forms_id': excelLeadFormsId,
					'lead_forms_slug': excelLeadFormsSlug,
					'lead_import_id': "",
					'lead_forms_subscriber_ids': allSubscriberIds,
					'audience_emails': allAudienceEmails,
					'total_users': allAudienceEmails.length,
					'title': audienceTitle,
					'description': audienceDescription,
					'audience_type': AUDIENCE_TYPE_MANUALLY_CREATE,
					'choose_audience_ids': audienceIdsArray,
					'excel_file_name': "",
					'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
					'modified': getUtcDate(),
					'created': getUtcDate(),
				});

				// Update all entry subscriber data (if needed)
				await allSubmitToForAudienceCount(userId);

				// Send success message
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.audience.assign_audience_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// No audience emails found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end chooseFromAudiences();

	/**
	 * Function to create an audience using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.createAudience = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let audienceTitle = req.body.title ? req.body.title : "";
		let audienceDescription = req.body.description ? req.body.description : "";
		let audienceEmails = req.body.audience_emails ? req.body.audience_emails : [];

		// Validate user and audience emails
		if (!userId || audienceEmails.length === 0) {
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
			// Generate slug for the audience
			let slugOptions = {
				title: audienceTitle,
				table_name: TABLE_AUDIENCES,
				slug_field: "slug"
			};
			const slugResponse = await getDatabaseSlug(slugOptions);

			// Convert all emails to lowercase
			let lowerCaseEmails = audienceEmails.map(email => email.toLowerCase());

			// Insert new audience document
			await audienceTable.insertOne({
				user_id: userId,
				lead_forms_id: "",
				lead_forms_slug: "",
				lead_import_id: "",
				lead_forms_subscriber_ids: [],
				total_users: audienceEmails.length,
				title: audienceTitle,
				description: audienceDescription,
				audience_type: AUDIENCE_TYPE_COPY_PASTE,
				excel_file_name: "",
				slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
				audience_emails: lowerCaseEmails,
				modified: getUtcDate(),
				created: getUtcDate(),
			});

			// Update all entry subscriber data (if needed)
			await allSubmitToForAudienceCount(userId);

			// Send success message
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.audience.assign_has_been_created_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Send error message
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end createAudience();

	/**
	 * Function to edit audience using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.editAudience = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		let audienceTitle = req.body.title ? req.body.title : "";
		let audienceDescription = req.body.description ? req.body.description : "";
		let audienceSlug = req.body.audience_slug ? req.body.audience_slug : "";

		if (!userId || !audienceSlug) {
			// Send error response if user or slug is missing
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
			// Update audience data using async/await
			const updateResult = await audienceTable.updateOne(
				{ slug: audienceSlug, user_id: userId },
				{ $set: { title: audienceTitle, description: audienceDescription, modified: getUtcDate() } }
			);

			if (updateResult && updateResult.modifiedCount > 0) {
				// Send success message if update was successful
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.audience.audience_has_been_updated_successfully"),
					}
				};
			} else {
				// Send error if no document was updated
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end editAudience();

	/**
	 * Function to get audience details using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.getAudienceDetails = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		let audienceSlug = req.body.audience_slug ? req.body.audience_slug : "";

		if (!userId || !audienceSlug) {
			// Send error response if user or slug is missing
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
			// Query to find audience details
			const audienceResult = await audienceTable.findOne(
				{ slug: audienceSlug, user_id: userId },
				{ projection: { title: 1, description: 1, audience_emails: 1, total_users: 1 } }
			);

			if (audienceResult) {
				// Send success response with audience details
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: audienceResult,
						message: "",
					}
				};
			} else {
				// Send error if no audience found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAudienceDetails();

	/**
	 * Function to view audience details with pagination and user info.
	 * Uses async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.viewAudience = async (req, res) => {
		let finalResponse = {};
		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		let audienceSlug = req.body.audience_slug ? req.body.audience_slug : "";

		if (!userId || !audienceSlug) {
			// Send error response if user or slug is missing
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

		try {
			// Build aggregation pipeline for audience details with user info
			const pipeline = [
				{ $match: { slug: audienceSlug, user_id: userId } },
				{ $unwind: "$audience_emails" },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { userEmail: "$audience_emails" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email", "$$userEmail"] },
										]
									}
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"audience_type": 1,
						"audience_email": "$audience_emails",
						"lead_forms_slug": 1,
						"description": 1,
						"title": 1,
						"total_users": 1,
						"account_type": {
							$ifNull: [{ $arrayElemAt: ["$userDetails.account_type", 0] }, ""]
						},
						"first_name": { $cond: [{ $arrayElemAt: ["$userDetails.fname", 0] }, { $arrayElemAt: ["$userDetails.fname", 0] }, ""] },
						"last_name": { $cond: [{ $arrayElemAt: ["$userDetails.lname", 0] }, { $arrayElemAt: ["$userDetails.lname", 0] }, ""] },
						"full_name": { $cond: [{ $arrayElemAt: ["$userDetails.full_name", 0] }, { $arrayElemAt: ["$userDetails.full_name", 0] }, ""] },
						"dob": { $cond: [{ $arrayElemAt: ["$userDetails.dob", 0] }, { $arrayElemAt: ["$userDetails.dob", 0] }, ""] },
						"gender": { $cond: [{ $arrayElemAt: ["$userDetails.gender", 0] }, { $arrayElemAt: ["$userDetails.gender", 0] }, ""] },
						"zip": { $cond: [{ $arrayElemAt: ["$userDetails.zip", 0] }, { $arrayElemAt: ["$userDetails.zip", 0] }, ""] },
						"mobile": { $cond: [{ $arrayElemAt: ["$userDetails.mobile", 0] }, { $arrayElemAt: ["$userDetails.mobile", 0] }, ""] },
						"created": 1,
					}
				},
				{ $skip: skip },
				{ $limit: limit }
			];

			// Run aggregation and count queries in parallel for better performance
			const [audienceResult, totalRecordObj] = await Promise.all([
				audienceTable.aggregate(pipeline).toArray(),
				audienceTable.findOne(
					{ slug: audienceSlug, user_id: userId },
					{ projection: { total_users: 1 } }
				)
			]);

			const totalRecord = totalRecordObj && totalRecordObj.total_users ? totalRecordObj.total_users : 0;

			if (audienceResult && audienceResult.length > 0) {
				// Send success response with audience details
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: audienceResult,
						recordsTotal: totalRecord,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				// No records found
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
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
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					recordsTotal: 0,
					limit: limit,
					page: page,
					message: res.__("front.global.no_record_found"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end viewAudience();

	/**
	 * Function to refresh audience using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.refreshAudience = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		let chooseAudienceIds = req.body.choose_audience_ids ? req.body.choose_audience_ids : [];
		let audienceId = req.body.audience_id ? newObjectIdDefault(req.body.audience_id) : "";

		if (!userId || chooseAudienceIds.length === 0 || !audienceId) {
			// Send error response if required data is missing
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Convert checked user ids to ObjectId
		let chooseAudienceIdsArray = [];
		if (chooseAudienceIds.length > 0) {
			chooseAudienceIds.forEach((ids) => {
				if (ids !== '') {
					chooseAudienceIdsArray.push(newObjectIdDefault(ids));
				}
			});
		}

		// Prepare conditions for fetching audience users
		let conditionsAudience = {
			'_id': { $in: chooseAudienceIdsArray }
		};

		try {
			// Get all subscriber ids and audience emails for the selected audiences
			const assignLeadSubscriberUsers = await withoutDistinctLeadFormsSubscriberIds(conditionsAudience);
			let allSubscriberIds = assignLeadSubscriberUsers.all_subscriber_ids ? assignLeadSubscriberUsers.all_subscriber_ids : [];
			let allAudienceEmails = assignLeadSubscriberUsers.all_audience_emails ? assignLeadSubscriberUsers.all_audience_emails : [];

			if (allAudienceEmails.length > 0) {
				// Update audience data with refreshed emails and subscriber ids
				const updateResult = await audienceTable.updateOne(
					{
						'_id': audienceId,
						"user_id": userId
					},
					{
						$set: {
							'lead_forms_subscriber_ids': allSubscriberIds,
							'audience_emails': allAudienceEmails,
							'total_users': allAudienceEmails.length,
							'modified': getUtcDate()
						}
					}
				);

				if (updateResult && updateResult.modifiedCount > 0) {
					// Send success message
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							result: {},
							message: res.__("front.audience.audience_has_been_refreshed_successfully"),
						}
					};
				} else {
					// Send error message if update failed
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("admin.system.something_going_wrong_please_try_again"),
						}
					};
				}
				return returnApiResult(req, res, finalResponse);
			} else {
				// No audience emails found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end refreshAudience();

	/**
	 * Function to get selected audience details using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.getSelectedAudienceDetails = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		let audienceIds = req.body.audience_ids ? req.body.audience_ids : [];

		// Validate user and audience IDs
		if (!userId || audienceIds.length === 0) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Convert audience IDs to ObjectId
		let audienceIdsArray = [];
		if (audienceIds.length > 0) {
			audienceIds.forEach((id) => {
				if (id !== '') {
					audienceIdsArray.push(newObjectIdDefault(id));
				}
			});
		}

		// Build query condition
		let conditionsAudience = {
			'_id': { $in: audienceIdsArray }
		};

		try {
			// Query audience details using async/await
			const audienceResult = await audienceTable.find(
				conditionsAudience,
				{ projection: { title: 1, description: 1, audience_emails: 1, total_users: 1 } }
			).toArray();

			if (audienceResult && audienceResult.length > 0) {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: audienceResult,
						message: "",
					}
				};
			} else {
				// Send error if no records found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getSelectedAudienceDetails();

	/**
	 * Function to add more audience data using async/await for faster and cleaner response.
	 *
	 * @return json 
	 **/
	this.addMoreAudience = async (req, res) => {
		let finalResponse = {};

		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		let audienceTitle = req.body.title ? req.body.title : "";
		let audienceDescription = req.body.description ? req.body.description : "";
		let audienceSlug = req.body.audience_slug ? req.body.audience_slug : "";
		let audienceType = req.body.audience_type ? req.body.audience_type : "";

		// Choose case data
		let audienceIds = req.body.audience_ids ? req.body.audience_ids : [];

		// Copy-paste emails
		let copyPasteAudienceEmails = req.body.audience_emails ? req.body.audience_emails : [];

		if (!userId || !audienceSlug || !audienceType) {
			// Send error response if required data is missing
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let audienceCondition = {
			slug: audienceSlug,
			user_id: userId
		};

		try {
			// Find the audience document
			const audienceResult = await audienceTable.findOne(
				audienceCondition,
				{ projection: { choose_audience_ids: 1, audience_emails: 1, lead_forms_id: 1, lead_import_id: 1 } }
			);

			if (!audienceResult) {
				// No audience found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle MANUALLY_CREATE type
			if (audienceType == AUDIENCE_TYPE_MANUALLY_CREATE) {
				let audienceIdsArray = audienceResult.choose_audience_ids ? audienceResult.choose_audience_ids : [];

				// Convert ids to ObjectId and merge with new ids
				if (audienceIds.length > 0) {
					audienceIds.forEach((id) => {
						if (id !== '') {
							audienceIdsArray.push(newObjectIdDefault(id));
						}
					});
				}

				// Build query condition for selected audiences
				let conditionsAudience = {
					'_id': { $in: audienceIdsArray }
				};

				// Get all subscriber ids and audience emails for the selected audiences
				const assignLeadSubscriberUsers = await withoutDistinctLeadFormsSubscriberIds(conditionsAudience);
				let allSubscriberIds = assignLeadSubscriberUsers.all_subscriber_ids ? assignLeadSubscriberUsers.all_subscriber_ids : [];
				let allAudienceEmails = assignLeadSubscriberUsers.all_audience_emails ? assignLeadSubscriberUsers.all_audience_emails : [];

				if (allAudienceEmails.length > 0) {
					// Update the audience document with new data
					await audienceTable.updateOne(
						audienceCondition,
						{
							$set: {
								lead_forms_subscriber_ids: allSubscriberIds,
								audience_emails: allAudienceEmails,
								total_users: allAudienceEmails.length,
								title: audienceTitle,
								description: audienceDescription,
								choose_audience_ids: audienceIdsArray,
								modified: getUtcDate()
							}
						}
					);

					// Update all entry subscriber data (if needed)
					await allSubmitToForAudienceCount(userId);

					// Send success message
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							result: {},
							message: res.__("front.audience.assign_audience_update_successfully"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					// No audience emails found
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.global.no_record_found"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			// Handle COPY_PASTE type
			if (audienceType == AUDIENCE_TYPE_COPY_PASTE) {
				let alreadyAssignAudienceEmails = audienceResult.audience_emails ? audienceResult.audience_emails : [];
				let combinedAudienceArray = [...copyPasteAudienceEmails, ...alreadyAssignAudienceEmails];

				// Convert all emails to lowercase
				let lowerCaseEmails = combinedAudienceArray.map(email => email.toLowerCase());

				// Update the audience document with new emails and info
				await audienceTable.updateOne(
					audienceCondition,
					{
						$set: {
							total_users: lowerCaseEmails.length,
							title: audienceTitle,
							description: audienceDescription,
							audience_emails: lowerCaseEmails,
							modified: getUtcDate()
						}
					}
				);

				// Update all entry subscriber data (if needed)
				await allSubmitToForAudienceCount(userId);

				// Send success message
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.audience.assign_audience_update_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// If audienceType is not recognized
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end addMoreAudience();

}
module.exports = new Audience();
