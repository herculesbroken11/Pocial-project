const async = require('async');

function Rewards() {

	/**
	 * Function used to add rewards
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.addRewards = async (req, res) => {
		let finalResponse = {};

		try {
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

			// Extract and sanitize input fields
			let heading = req.body.heading ? req.body.heading : "";
			let subHeading = req.body.sub_heading ? req.body.sub_heading : "";
			let description = req.body.description ? req.body.description : "";
			let expiryDate = req.body.expiry_date ? req.body.expiry_date : "";
			let storeTypeIds = req.body.store_type_id ? req.body.store_type_id : [];
			let statusType = req.body.status ? ACTIVE : DEACTIVE;
			let image = (req.files && req.files.image) ? req.files.image : "";
			let toogleExpiryDate = req.body.toogle_expiry_date ? true : false;
			let aiBotReward = req.body.ai_bot_reward ? true : false;

			// Convert storeTypeIds to ObjectId array
			let storeTypeIdsArray = [];
			if (Array.isArray(storeTypeIds) && storeTypeIds.length > 0) {
				storeTypeIdsArray = storeTypeIds.map(id => newObjectIdDefault(id));
			}

			// Upload image using async/await
			let options = {
				'image': image,
				'filePath': LEADS_FORM_FILE_PATH,
			};

			// Await image upload
			const uploadResponse = await moveUploadedFile(req, res, options);

			// Handle image upload error
			if (uploadResponse.status === STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: {},
						message: uploadResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let imageName = uploadResponse.fileName ? uploadResponse.fileName : "";

			// Prepare reward data for insertion
			let packageRewardData = {
				'user_id': userId,
				'lead_forms_id': "",
				'reward_text': heading,
				'reward_sub_heading': subHeading,
				'graphic_image': imageName,
				'graphic_type': UPLOAD_IMAGE,
				'url_attach': "",
				'url_title': "",
				'url_desc': description,
				'result_no': DEFAULT_ZERO,
				'is_active': statusType,
				'store_type_id': storeTypeIdsArray,
				'type': REWARDS_USER_ADD,
				'expiry_date': toogleExpiryDate ? ageUtcDate(expiryDate) : "",
				'toogle_expiry_date': toogleExpiryDate,
				'ai_bot_reward': aiBotReward,
			};

			// Add reward to database using async/await
			await addPackageReward(packageRewardData);

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.rewards.rewards_has_been_added_successfully"),
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
	}; // End addRewards();

	/**
	 * Function used to get create rewards list
	 * Uses async/await for all database queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next
	 * @returns json response
	 */
	this.getCreateRewardsList = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Get user id and business details
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";

			let profileImage = loginUserData.profile_image ? loginUserData.profile_image : "";
			let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
			let businessIndustryName = (publicBusinessInformaton && publicBusinessInformaton.business_industry_name) ? publicBusinessInformaton.business_industry_name : "";
			let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
			let rewardImage = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";

			let searchRewardName = req.body.search_reward_name ? req.body.search_reward_name : "";
			let leadFormsId = req.body.lead_forms_id ? newObjectIdDefault(req.body.lead_forms_id) : "";
			let searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";
			let segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
			let selectedUsersIds = req.body.selected_users_ids ? req.body.selected_users_ids : [];

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

			let page = req.body.page ? parseInt(req.body.page) : 1;
			let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			let skip = (limit * page) - limit;

			let condition = {
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED
			};

			if (searchRewardName !== "") {
				condition['reward_text'] = { "$regex": new RegExp(searchRewardName, "i") };
			}

			// Search by keyword in reward_text or reward_sub_heading
			if (searchKeyword) {
				condition['$or'] = [
					{ 'reward_text': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'reward_sub_heading': { $regex: new RegExp(searchKeyword, "i") } },
				];
			}

			const leadFormsSubscribers = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			const rewards = db.collection(TABLE_REWARDS);

			// Prepare queries for parallel execution
			let rewardsListPromise;
			if (leadFormsId !== "" || segmentSlug !== '') {
				// Get rewards form list (simple aggregate)
				rewardsListPromise = rewards.aggregate([
					{ $match: condition },
					{ $addFields: { "random_color": { $round: [{ $multiply: [{ $rand: {} }, 2] }, 0] } } },
					{ $sort: { created: SORT_DESC } },
					{ $skip: skip },
					{ $limit: limit },
				]).toArray();
			} else {
				// Get rewards form list with lookups for email templates and polls
				rewardsListPromise = rewards.aggregate([
					{ $match: condition },
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
						$addFields: {
							"attached_email_popup_show": false,
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
					{ $skip: skip },
					{ $limit: limit },
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
							"attached_email_popup_show": 1,
							'attached_email': { '$add': ['$poll_attached_count', '$email_template_attached_count'] },
							"random_color": { $round: [{ $multiply: [{ $rand: {} }, 2] }, 0] },
						}
					}
				]).toArray();
			}

			// Get total number of records in rewards form
			let rewardsCountPromise = rewards.countDocuments(condition);

			// Get total number of records in lead form subscriber or segment-wise user count
			let leadOrSegmentCountPromise;
			if (leadFormsId !== "") {
				let leadCondition = {
					lead_forms_id: leadFormsId,
					is_deleted: NOT_DELETED
				};
				leadOrSegmentCountPromise = leadFormsSubscribers.countDocuments(leadCondition);
			} else if (segmentSlug !== "") {
				let optionData = {
					'user_id': userId,
					'segment_slug': segmentSlug,
					'selected_users_ids': selectedUsersIds,
				};
				leadOrSegmentCountPromise = segmentWiseTotalUserCount(req, res, optionData).then(responseData => responseData['total_user']);
			} else {
				leadOrSegmentCountPromise = Promise.resolve(0);
			}

			// Run all queries in parallel
			const [rewardsList, rewardsCount, leadOrSegmentCount] = await Promise.all([
				rewardsListPromise,
				rewardsCountPromise,
				leadOrSegmentCountPromise
			]);

			// Save AI database structure (fire and forget, but await for consistency)
			let rewardData = await fetchUserRewardSummary(req, res, userId);
			await saveCustomerBucketItems({
				'user_id': userId,
				'bucket_name': DATA_BUCKET_REWARD,
				'parent_bucket': PARENT_BUCKET_REWARD,
				'data': rewardData
			});

			// Prepare and send response
			let totalRecord = rewardsCount ? rewardsCount : 0;
			if (rewardsList && rewardsList.length > 0) {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'image_url': LEADS_FORM_URL,
						'user_url': USERS_URL,
						'reward_user_image': businessLogo ? businessLogo : profileImage,
						'reward_image': rewardImage,
						'result': rewardsList,
						'recordsTotal': totalRecord,
						'lead_subscriber_count': leadOrSegmentCount ? leadOrSegmentCount : 0,
						'business_industry_name': businessIndustryName,
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
						'image_url': LEADS_FORM_URL,
						'user_url': USERS_URL,
						'reward_user_image': businessLogo ? businessLogo : profileImage,
						'reward_image': rewardImage,
						'result': [],
						'recordsTotal': 0,
						'lead_subscriber_count': leadOrSegmentCount ? leadOrSegmentCount : 0,
						'business_industry_name': businessIndustryName,
						'limit': limit,
						'page': page,
						'message': res.__("front.global.no_record_found"),
						'total_page': 0
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
	}; // End getCreateRewardsList();

	/**
	 * Function used to get reward details
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.rewardsDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let rewardsSlug = req.body.rewards_slug ? req.body.rewards_slug : "";
			let rewardsId = req.body.rewards_id ? newObjectIdDefault(req.body.rewards_id) : "";
			let aiBotReward = req.body.ai_bot_reward ? true : false;

			// Get business details for logged in user
			let profileImage = loginUserData.profile_image ? loginUserData.profile_image : "";
			let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
			let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
			let rewardImage = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";
			let businessIndustryName = (publicBusinessInformaton && publicBusinessInformaton.business_industry_name) ? publicBusinessInformaton.business_industry_name : "";

			// Validate required fields
			if (!aiBotReward) {
				if (!userId || (!rewardsSlug && !rewardsId)) {
					finalResponse = {
						'data': {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			const rewards = db.collection(TABLE_REWARDS);

			// Build query condition based on input
			let conditionRewards = {
				'slug': rewardsSlug,
				'user_id': userId,
				'is_deleted': NOT_DELETED
			};

			// If rewardsId is provided, use it for the query
			if (rewardsId && rewardsId != '') {
				conditionRewards = {
					'_id': rewardsId,
					'user_id': userId,
					'is_deleted': NOT_DELETED
				};
			}

			// If aiBotReward is true, override condition
			if (aiBotReward) {
				conditionRewards = {
					'ai_bot_reward': true,
					'user_id': userId,
					'is_deleted': NOT_DELETED
				};
			}

			// Build aggregation pipeline for reward details
			const aggregationPipeline = [
				{
					$match: conditionRewards
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
						"email_template_attached_count": { $cond: [{ $arrayElemAt: ["$rewardsCount.count", 0] }, { $arrayElemAt: ["$rewardsCount.count", 0] }, 0] },
					}
				},
				{
					$project: {
						"_id": 1,
						"reward_text": 1,
						"reward_sub_heading": 1,
						"graphic_image": 1,
						"url_desc": 1,
						"is_active": 1,
						"slug": 1,
						"toogle_expiry_date": 1,
						"expiry_date": 1,
						"created": 1,
						"is_deleted": 1,
						"store_type_id": 1,
						"store_type_name": "$storeType",
						'attached_email': { '$add': ['$poll_attached_count', '$email_template_attached_count'] },
					}
				}
			];

			// Execute aggregation query using async/await
			const result = await rewards.aggregate(aggregationPipeline).toArray();

			if (result && result.length > 0) {
				let rewardResult = result[0];

				// Convert Mongo date to dd-mm-yy if expiry date is toggled
				if (rewardResult.toogle_expiry_date === true && rewardResult.expiry_date !== '') {
					let expiryDateConvert = mongoDatetoSimpleDateConvert(rewardResult.expiry_date);
					rewardResult['dd'] = expiryDateConvert.dd;
					rewardResult['mm'] = expiryDateConvert.mm;
					rewardResult['yy'] = expiryDateConvert.yy;
				}

				// Replace href with target='_blank' href in url_desc
				let urlDesc = rewardResult['url_desc'] ? rewardResult['url_desc'] : "";
				urlDesc = urlDesc ? urlDesc.replace(/href/g, " target='_blank' href") : "";
				rewardResult['url_desc'] = urlDesc;

				// Send success response
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'image_url': LEADS_FORM_URL,
						'reward_user_image': businessLogo ? businessLogo : profileImage,
						'reward_image': rewardImage,
						'business_industry_name': businessIndustryName,
						'result': rewardResult,
						'message': ""
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// No record found
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'image_url': LEADS_FORM_URL,
						'reward_user_image': businessLogo ? businessLogo : profileImage,
						'reward_image': rewardImage,
						'business_industry_name': businessIndustryName,
						'result': [],
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End rewardsDetails();

	/**
	 * Function used to change reward status
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.rewardStatusChange = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id and validate input
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let statusData = (req.body.status === true || req.body.status === "true") ? ACTIVE : DEACTIVE;
			let rewardsId = req.body.rewards_id ? newObjectIdDefault(req.body.rewards_id) : "";

			if (!userId || !rewardsId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if reward is already assigned and cannot be changed
			const assignCheckResponse = await assignRewardsAfterDeleteCheck(req, res, userId, rewardsId);

			if (assignCheckResponse.status === STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: assignCheckResponse.message
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update reward status in the database
			const rewards = db.collection(TABLE_REWARDS);
			const updateResult = await rewards.updateOne(
				{
					user_id: newObjectIdDefault(userId),
					_id: rewardsId
				},
				{
					$set: {
						is_active: statusData
					}
				}
			);

			if (updateResult.modifiedCount === 0) {
				// No document was updated
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					message: (statusData === ACTIVE)
						? res.__("front.reward.reward_has_been_activeted_successfully")
						: res.__("front.reward.reward_has_been_deactivated_successfully"),
				}
			};
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
	}; // End rewardStatusChange();

	/**
	 * Function used to delete reward
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deleteReward = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id and reward id from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let rewardsId = req.body.rewards_id ? newObjectIdDefault(req.body.rewards_id) : "";
			let aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";

			const rewards = db.collection(TABLE_REWARDS);
			const aiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

			// Validate required fields
			if (!userId || !rewardsId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if reward is already assigned before deleting
			const assignCheckResponse = await assignRewardsAfterDeleteCheck(req, res, userId, rewardsId);

			if (assignCheckResponse.status === STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: assignCheckResponse.message
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare update operations
			const rewardUpdatePromise = rewards.updateOne(
				{
					'user_id': newObjectIdDefault(userId),
					'_id': rewardsId
				},
				{
					$set: {
						'is_deleted': DELETED
					}
				}
			);

			let aiCampaignChatUpdatePromise = null;
			if (aiCampaignChatId) {
				aiCampaignChatUpdatePromise = aiCampaignChat.updateOne(
					{ '_id': newObjectIdDefault(aiCampaignChatId) },
					{ $set: { 'is_deleted': DELETED } }
				);
			}

			// Run update operations in parallel if needed
			if (aiCampaignChatUpdatePromise) {
				await Promise.all([rewardUpdatePromise, aiCampaignChatUpdatePromise]);
			} else {
				await rewardUpdatePromise;
			}

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					message: res.__("front.reward.reward_has_been_deleted_successfully")
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteReward();

	/**
	 * Function used to get redemptions list
	 * Uses async/await for all database queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.getRedemptionsList = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Get user id and search keyword from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";

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

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			// Build query condition
			let condition = {
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED
			};

			// Add search keyword filter if provided
			if (searchKeyword) {
				condition['$or'] = [
					{ 'reward_text': { $regex: new RegExp(searchKeyword, "i") } },
					{ 'reward_sub_heading': { $regex: new RegExp(searchKeyword, "i") } },
				];
			}

			const rewards = db.collection(TABLE_REWARDS);
			const polls = db.collection(TABLE_POLLS);

			// Prepare aggregation pipeline for rewards list
			const rewardsListPipeline = [
				{ $match: condition },
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
							{ "$project": { subject: 1 } }
						],
						as: "attachment_details"
					}
				},
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { rewardId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$reward_id", "$$rewardId"] },
										]
									},
								}
							},
							{
								"$group": {
									"_id": null,
									"reward_send_count": { $sum: 1 },
									"redemption_count": { $sum: { $cond: [{ $and: [{ $eq: ["$is_redemed", REDEMED] }] }, 1, 0] } },
									"reward_in_wallet": { $sum: { $cond: [{ $and: [{ $eq: ["$is_redemed", NOT_REDEMED] }] }, 1, 0] } },
									"viewed_count": { $sum: { $cond: [{ $and: [{ $eq: ["$is_viewed", VIEWED] }] }, 1, 0] } },
									"not_viewed_count": { $sum: { $cond: [{ $and: [{ $eq: ["$is_viewed", NOT_VIEWED] }] }, 1, 0] } },
								}
							}
						],
						as: "rewardDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_SEGMENT_LEAD_REWARD_LOGS,
						let: { rewardId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$reward_id", "$$rewardId"] },
										]
									},
								}
							},
							{ "$group": { "_id": null, "reward_send_count": { $sum: 1 } } }
						],
						as: "rewardLeadSegmentLogsDetails"
					}
				},
				{
					$addFields: {
						"reward_send_leads_count": { $cond: [{ $arrayElemAt: ["$rewardLeadSegmentLogsDetails.reward_send_count", 0] }, { $arrayElemAt: ["$rewardLeadSegmentLogsDetails.reward_send_count", 0] }, 0] },
						"reward_earn_send_count": { $cond: [{ $arrayElemAt: ["$rewardDetails.reward_send_count", 0] }, { $arrayElemAt: ["$rewardDetails.reward_send_count", 0] }, 0] },
						"redemption_count": { $cond: [{ $arrayElemAt: ["$rewardDetails.redemption_count", 0] }, { $arrayElemAt: ["$rewardDetails.redemption_count", 0] }, 0] },
						"viewed_count": { $cond: [{ $arrayElemAt: ["$rewardDetails.viewed_count", 0] }, { $arrayElemAt: ["$rewardDetails.viewed_count", 0] }, 0] },
						"not_viewed_count": { $cond: [{ $arrayElemAt: ["$rewardDetails.not_viewed_count", 0] }, { $arrayElemAt: ["$rewardDetails.not_viewed_count", 0] }, 0] },
						"reward_in_wallet": { $cond: [{ $arrayElemAt: ["$rewardDetails.reward_in_wallet", 0] }, { $arrayElemAt: ["$rewardDetails.reward_in_wallet", 0] }, 0] },
					}
				},
				{
					$addFields: {
						'reward_send_count': { '$add': ['$reward_earn_send_count', '$reward_send_leads_count'] },
					}
				},
				{
					$match: {
						"reward_send_count": { $gt: DEFAULT_ZERO }
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
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
						"attachment_details": 1,
						"reward_send_count": 1,
						"reward_in_wallet": 1,
						"redemption_count": 1,
						"viewed_count": 1,
						"not_viewed_count": 1,
						"redemption_percentage": { $cond: ["$reward_send_count", { $multiply: [{ $divide: ["$redemption_count", "$reward_send_count"] }, 100] }, 0] },
						"viewed_percentage": { $cond: ["$reward_send_count", { $multiply: [{ $divide: ["$viewed_count", "$reward_send_count"] }, 100] }, 0] },
						"not_viewed_percentage": { $cond: ["$reward_send_count", { $multiply: [{ $divide: ["$not_viewed_count", "$reward_send_count"] }, 100] }, 0] },
					}
				},
			];

			// Prepare aggregation pipeline for total count
			const rewardsCountPipeline = [
				{ $match: condition },
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { rewardId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$reward_id", "$$rewardId"] },
										]
									},
								}
							},
							{ "$group": { "_id": null, "count": { $sum: 1 } } }
						],
						as: "rewardSentCount"
					}
				},
				{
					$lookup: {
						from: TABLE_SEGMENT_LEAD_REWARD_LOGS,
						let: { rewardId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$reward_id", "$$rewardId"] },
										]
									},
								}
							},
							{ "$group": { "_id": null, "reward_send_count": { $sum: 1 } } }
						],
						as: "rewardLeadSegmentLogsDetails"
					}
				},
				{
					$addFields: {
						"reward_send_leads_count": { $cond: [{ $arrayElemAt: ["$rewardLeadSegmentLogsDetails.reward_send_count", 0] }, { $arrayElemAt: ["$rewardLeadSegmentLogsDetails.reward_send_count", 0] }, 0] },
						"reward_earn_send_count": { $cond: [{ $arrayElemAt: ["$rewardSentCount.count", 0] }, { $arrayElemAt: ["$rewardSentCount.count", 0] }, 0] },
					}
				},
				{
					$addFields: {
						'reward_send_count': { '$add': ['$reward_earn_send_count', '$reward_send_leads_count'] },
					}
				},
				{
					$match: {
						reward_send_count: { $gt: DEFAULT_ZERO }
					}
				},
				{ $project: { "_id": 1 } },
			];

			// Run both queries in parallel using Promise.all
			const [redemptionsResult, countResult] = await Promise.all([
				rewards.aggregate(rewardsListPipeline).toArray(),
				rewards.aggregate(rewardsCountPipeline).toArray()
			]);

			const totalRecord = countResult ? countResult.length : 0;

			if (redemptionsResult && redemptionsResult.length > 0) {
				// For each reward, append poll attachments to attachment_details
				for (let i = 0; i < redemptionsResult.length; i++) {
					const reward = redemptionsResult[i];
					const pollsAttachment = await polls.find(
						{ "options.assign_reward": reward._id },
						{ projection: { '_id': 1, 'type': 'poll', 'subject': '$question' } }
					).toArray();

					// Merge poll attachments into attachment_details
					if (Array.isArray(reward.attachment_details)) {
						Array.prototype.push.apply(reward.attachment_details, pollsAttachment);
					} else {
						reward.attachment_details = pollsAttachment;
					}
				}

				// Send success response with data
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						result: redemptionsResult,
						recordsTotal: totalRecord,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(totalRecord / limit)
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// No records found
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
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
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
					limit: 0,
					page: 0,
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getRedemptionsList();

	/**
	 * Function used to get earn rewards list
	 * Uses async/await for all database queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.getEarnRewardsList = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Get user id from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

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

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// Prepare queries to run in parallel
			const [rewardsList, totalRecord] = await Promise.all([
				// Get paginated earn rewards list for the user
				earnRewards.find({ user_id: newObjectIdDefault(userId) })
					.sort({ created: SORT_DESC })
					.skip(skip)
					.limit(limit)
					.toArray(),
				// Get total number of earn rewards for the user
				earnRewards.countDocuments({ user_id: newObjectIdDefault(userId) })
			]);

			// Prepare and send response
			if (rewardsList && rewardsList.length > 0) {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						result: rewardsList,
						recordsTotal: totalRecord,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
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
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
					limit: 0,
					page: 0,
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getEarnRewardsList();

	/**
	 * Function used to get earn rewards details
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.earnRewardsDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user id and reward slug from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const rewardsSlug = req.body.rewards_slug ? req.body.rewards_slug : "";

			// Validate required fields
			if (!userId || !rewardsSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// Aggregate to get reward details and sender's name
			const aggregationPipeline = [
				{
					$match: {
						slug: rewardsSlug
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						localField: "send_by",
						foreignField: "_id",
						as: "sendByDetailsUser"
					}
				},
				{
					$project: {
						_id: 1,
						title: 1,
						url_desc: 1,
						slug: 1,
						sent_user_name: { $arrayElemAt: ["$sendByDetailsUser.full_name", 0] },
					}
				}
			];

			// Run aggregation query
			const result = await earnRewards.aggregate(aggregationPipeline).toArray();

			// Prepare and send response
			if (result && result.length > 0) {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						result: result[0],
						message: ""
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						result: [],
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
					result: [],
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End earnRewardsDetails();

	/**
	 * Function used to get attached email template
	 * Uses async/await for all database queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @return json response
	 */
	this.getAttachedEmailTemplate = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Get user id and reward id from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const rewardId = req.body.reward_id ? newObjectIdDefault(req.body.reward_id) : "";

			const completeAttachRewardId = (loginUserData && loginUserData.complete_profile_reward && loginUserData.complete_profile_reward.attach_reward) ? loginUserData.complete_profile_reward.attach_reward : "";
			const completeTemplateSubjectName = (loginUserData && loginUserData.complete_profile_reward && loginUserData.complete_profile_reward.template_subject) ? loginUserData.complete_profile_reward.template_subject : "";
			const completeTemplateTempalteId = (loginUserData && loginUserData.complete_profile_reward && loginUserData.complete_profile_reward.tempalte_id) ? loginUserData.complete_profile_reward.tempalte_id : "";

			if (!userId || !rewardId) {
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
			const polls = db.collection(TABLE_POLLS);

			// Prepare queries for email templates and polls
			const emailTemplateQuery = emailTemplate.find(
				{
					"user_id": newObjectIdDefault(userId),
					"attach_reward": newObjectIdDefault(rewardId)
				},
				{ projection: { subject: 1 } }
			).toArray();

			const pollsQuery = polls.find(
				{
					"options.assign_reward": newObjectIdDefault(rewardId)
				},
				{ projection: { '_id': 1, 'type': 'poll', 'subject': '$question' } }
			).toArray();

			// Run both queries in parallel
			const [emailTemplates, pollResults] = await Promise.all([emailTemplateQuery, pollsQuery]);

			let result = emailTemplates;

			// If the complete profile reward is attached, prepend it to the result
			if (
				completeAttachRewardId &&
				typeof completeAttachRewardId.equals === "function" &&
				completeAttachRewardId.equals(rewardId)
			) {
				result = [
					{ '_id': completeTemplateTempalteId, 'subject': completeTemplateSubjectName },
					...result
				];
			}

			// Append poll results to the result array
			Array.prototype.push.apply(result, pollResults);

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: result,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getAttachedEmailTemplate();

	/**
	 * Function used to edit rewards
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json response
	 */
	this.editRewards = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize input data to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Get user id from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";

			let rewardSlug = req.body.reward_slug ? req.body.reward_slug : "";
			let heading = req.body.heading ? req.body.heading : "";
			let subHeading = req.body.sub_heading ? req.body.sub_heading : "";
			let description = req.body.description ? req.body.description : "";
			let expiryDate = req.body.expiry_date ? req.body.expiry_date : "";
			let storeTypeIds = req.body.store_type_id ? req.body.store_type_id : [];
			let image = (req.files && req.files.image) ? req.files.image : "";
			let oldimage = req.body.old_image ? req.body.old_image : "";
			let toogleExpiryDate = req.body.toogle_expiry_date ? Number(req.body.toogle_expiry_date) : 0;
			toogleExpiryDate = (toogleExpiryDate === 0) ? false : true;

			// Validate required fields
			if (!userId || !rewardSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Convert storeTypeIds to ObjectId array
			let storeTypeIdsArray = [];
			if (Array.isArray(storeTypeIds) && storeTypeIds.length > 0) {
				storeTypeIdsArray = storeTypeIds.map(recordsIds => newObjectIdDefault(recordsIds));
			}

			// Upload image (async)
			let options = {
				'image': image,
				'oldPath': oldimage,
				'filePath': LEADS_FORM_FILE_PATH,
			};

			const response = await moveUploadedFile(req, res, options);

			// Handle image upload error
			if (response.status == STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: {},
						message: response.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let imageName = response.fileName ? response.fileName : "";

			// Prepare reward update data
			let packageRewardData = {
				'reward_text': heading,
				'reward_sub_heading': subHeading,
				'graphic_image': imageName,
				'url_desc': description,
				'store_type_id': storeTypeIdsArray,
				'expiry_date': (toogleExpiryDate) ? ageUtcDate(expiryDate) : "",
				'toogle_expiry_date': toogleExpiryDate,
				'is_edited': true
			};

			// Update reward in the database (async)
			await db.collection(TABLE_REWARDS).updateOne(
				{
					'user_id': userId,
					'slug': rewardSlug
				},
				{ $set: packageRewardData }
			);

			// Update related earned/sent rewards (async)
			let editedOptionRewards = {
				'user_id': userId,
				'reward_id': "",
				'reward_slug': rewardSlug,
			};
			await earnSentRewardUpdate(editedOptionRewards);

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.rewards.rewards_has_been_updated_successfully"),
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
	}; // End editRewards();

	/**
	 * Function used to delete reward image
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.rewardImageDelete = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize input data to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Get user id from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";

			let rewardId = req.body.reward_id ? req.body.reward_id : "";
			let rewardImageName = req.body.reward_image_name ? req.body.reward_image_name : "";

			// Validate required fields
			if (!rewardImageName || !userId || !rewardId) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for deleting the image
			let optionImage = {
				'reward_id': rewardId,
				'user_id': userId,
				'image_name': rewardImageName,
			};

			// Call deleteImageForReward using async/await
			const response = await deleteImageForReward(req, res, optionImage);

			if (response.status === STATUS_SUCCESS) {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'message': response.message,
					}
				};
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': response.message,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'message': error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End rewardImageDelete();

}
module.exports = new Rewards();
