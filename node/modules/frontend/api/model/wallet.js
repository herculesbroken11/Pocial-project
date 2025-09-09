const async = require('async');

function Wallet() {

	/**
	 * Function used to get business industry reward count.
	 * Handles all DB queries using async/await for clean and modern code.
	 * Runs aggregation and count queries in parallel using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.getBusinessIndustryRewardCount = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// --- Validate userId ---
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

			// --- Set collections ---
			const masterCollection = db.collection(TABLE_MASTERS);
			const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// --- Prepare date and query conditions ---
			const startime = newDate(newDate());
			const condition = {
				user_id: newObjectIdDefault(userId),
				is_redemed: NOT_REDEMED,
				is_deleted: NOT_DELETED,
				$or: [
					{ expiry_date: { $eq: "" } },
					{ expiry_date: { $gte: startime } }
				]
			};

			// --- Prepare aggregation pipeline for business industry reward counts ---
			const aggregationPipeline = [
				{
					$match: {
						dropdown_type: MASTER_BUSINESS_INDUSTRY,
					}
				},
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { businessIndustryId: "$_id" },
						pipeline: [
							{
								$match: {
									$or: [
										{ expiry_date: { $eq: "" } },
										{ expiry_date: { $gte: startime } }
									],
									$expr: {
										$and: [
											{ $eq: ["$user_id", newObjectIdDefault(userId)] },
											{ $eq: ["$is_redemed", NOT_REDEMED] },
											{ $eq: ["$is_deleted", NOT_DELETED] },
											{ $eq: ["$business_industry_id", "$$businessIndustryId"] },
										]
									},
								}
							},
							{ $group: { _id: null, count: { $sum: 1 } } }
						],
						as: "businessIndustry"
					}
				},
				{
					$project: {
						_id: 1,
						name: 1,
						checked: { $cond: ["$checked", "$checked", false] },
						count: {
							$cond: [
								{ $arrayElemAt: ["$businessIndustry.count", 0] },
								{ $arrayElemAt: ["$businessIndustry.count", 0] },
								0
							]
						},
					}
				},
				{ $sort: { count: SORT_DESC } },
			];

			// --- Run aggregation and count queries in parallel ---
			const [industryResults, allCount] = await Promise.all([
				masterCollection.aggregate(aggregationPipeline).toArray(),
				earnRewards.countDocuments(condition)
			]);

			// --- Add "All" option at the beginning of the result ---
			const resultWithAll = [
				{ _id: "", name: "All", count: allCount, checked: false },
				...(industryResults || [])
			];

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: resultWithAll,
					message: "",
					err: null
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					err: err
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getBusinessIndustryRewardCount();

	/**
	 * Function used to get wallet listing.
	 * Uses async/await for all database operations.
	 * Runs queries in parallel using Promise.all for efficiency.
	 * @returns json response
	 **/
	this.getWalletListing = async (req, res, next) => {
		let finalResponse = {};

		try {
			// --- Extract and validate user id ---
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

			// --- Pagination setup ---
			let page = req.body.page ? parseInt(req.body.page) : 1;
			let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			let skip = (limit * page) - limit;

			// --- Date setup for filtering ---
			const currentDate = newDate('', 'yyyy-mm-dd');
			const endtime = getUtcDate(currentDate + " 23:59:59");
			const startime = newDate(newDate());

			// --- Main condition for wallet listing ---
			let condition = {
				user_id: newObjectIdDefault(userId),
				is_redemed: NOT_REDEMED,
				is_deleted: NOT_DELETED,
				$or: [
					{ expiry_date: { $eq: "" } },
					{ expiry_date: { $gte: startime } }
				]
			};

			// --- Tab count conditions ---
			const tabWiseCountNewRewardCondition = {
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED,
				is_redemed: NOT_REDEMED,
				$or: [
					{ expiry_date: { $eq: "" } },
					{ expiry_date: { $gte: startime } }
				]
			};

			const tabWiseCountRedeemedCondition = {
				user_id: newObjectIdDefault(userId),
				is_redemed: REDEMED,
				is_deleted: NOT_DELETED
			};

			const tabWiseCountExpiredCondition = {
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED,
				is_redemed: NOT_REDEMED,
				toogle_expiry_date: true,
				expiry_date: { $lte: endtime }
			};

			// --- Filter by Business Industry ---
			const businessIndustryId = (req.body.business_industry_id && req.body.business_industry_id.length > 0) ? req.body.business_industry_id : [];
			if (businessIndustryId.length > 0) {
				const businessIndustryIdsArray = businessIndustryId
					.filter(id => id !== '')
					.map(id => newObjectIdDefault(id));
				condition['business_industry_id'] = { $in: businessIndustryIdsArray };
			}

			// --- Filter by Store Type ---
			const storeTypeId = (req.body.store_type_id && req.body.store_type_id.length > 0) ? req.body.store_type_id : [];
			if (storeTypeId.length > 0) {
				const storeTypeIdIdsArray = storeTypeId
					.filter(id => id !== '')
					.map(id => newObjectIdDefault(id));
				condition['store_type_id'] = { $in: storeTypeIdIdsArray };
			}

			// --- New recent rewards details ---
			const newRecentRewards = req.body.new_recent_rewards ? ACTIVE : DEACTIVE;
			if (newRecentRewards === ACTIVE) {
				limit = WALLET_NEW_REWARD_LIMIT;
			}

			// --- Redeemed rewards filter ---
			const redeemed = req.body.is_redemed ? ACTIVE : DEACTIVE;
			if (redeemed === ACTIVE) {
				delete condition['$or'];
				condition['is_redemed'] = REDEMED;
			}

			// --- Expired rewards filter ---
			const expired = req.body.is_expired ? ACTIVE : DEACTIVE;
			if (expired === ACTIVE) {
				delete condition['$or'];
				condition['toogle_expiry_date'] = true;
				condition['expiry_date'] = { $lte: endtime };
			}

			const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// --- Prepare aggregation pipeline for wallet listing ---
			const walletListPipeline = [
				{ $match: condition },
				{
					$lookup: {
						from: TABLE_MASTERS,
						let: { businessIndustryId: "$business_industry_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$businessIndustryId"] },
											{ $eq: ["$dropdown_type", MASTER_BUSINESS_INDUSTRY] },
										]
									}
								}
							},
							{ $project: { name: 1 } }
						],
						as: "businessIndustry"
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { sendByUserId: "$send_by" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$sendByUserId"] },
										]
									}
								}
							},
							{ $project: { full_name: 1, profile_image: 1, reward_image: 1, account_type: 1, slug: 1 } }
						],
						as: "sentUserDetails"
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
				{
					$project: {
						"_id": 1,
						"user_id": 1,
						"reward_id": 1,
						"title": 1,
						"sub_title": 1,
						"image": 1,
						"send_by": 1,
						"is_redemed": 1,
						"slug": 1,
						"is_viewed": 1,
						"expiry_date": 1,
						"toogle_expiry_date": 1,
						"business_industry_name": { $arrayElemAt: ["$businessIndustry.name", 0] },
						"sent_full_name": { $arrayElemAt: ["$sentUserDetails.full_name", 0] },
						"sent_profile_image": { $arrayElemAt: ["$sentUserDetails.profile_image", 0] },
						"sent_reward_image": { $arrayElemAt: ["$sentUserDetails.reward_image", 0] },
						"account_type": { $arrayElemAt: ["$sentUserDetails.account_type", 0] },
						"sent_user_slug": { $arrayElemAt: ["$sentUserDetails.slug", 0] },
						"random_color": { $round: [{ $multiply: [{ $rand: {} }, 2] }, 0] },
					}
				}
			];

			// --- Run all queries in parallel using Promise.all ---
			const [
				walletList,
				totalRecords,
				recordsSkipTotal,
				newRewardCount,
				redeemedCount,
				expiredCount
			] = await Promise.all([
				// Wallet listing aggregation
				(async () => {
					const result = await earnRewards.aggregate(walletListPipeline).toArray();
					return result.map((v, index) => Object.assign(v, { serial_number: index + 1 }));
				})(),

				// Total number of records in wallet rewards form
				earnRewards.countDocuments(condition),

				// Total number of records in wallet form collection with skip
				earnRewards.find(condition).skip(skip).count(),

				// Total number of new rewards count tabbing
				(async () => {
					let count = await earnRewards.countDocuments(tabWiseCountNewRewardCondition);
					return (count >= WALLET_NEW_REWARD_LIMIT) ? WALLET_NEW_REWARD_LIMIT : count;
				})(),

				// Total number of Redeemed count tabbing
				earnRewards.countDocuments(tabWiseCountRedeemedCondition),

				// Total number of Expired count tabbing
				earnRewards.countDocuments(tabWiseCountExpiredCondition)
			]);

			let result = walletList || [];
			let totalRecord = totalRecords || 0;
			let skipTotal = recordsSkipTotal || 0;

			// --- Adjust total count for new recent rewards ---
			if (newRecentRewards === ACTIVE) {
				totalRecord = result.length;
				skipTotal = result.length;
			}

			// --- Prepare and send response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: LEADS_FORM_URL,
					user_image_url: USERS_URL,
					result: result,
					recordsTotal: totalRecord,
					recordsSkipTotal: skipTotal,
					reward_count: newRewardCount || 0,
					redeemed_count: redeemedCount || 0,
					expired_count: expiredCount || 0,
					limit: limit,
					page: page,
					message: result.length > 0 ? "" : res.__("front.global.no_record_found"),
					total_page: Math.ceil(totalRecord / limit)
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					image_url: LEADS_FORM_URL,
					user_image_url: USERS_URL,
					recordsTotal: 0,
					recordsSkipTotal: 0,
					reward_count: 0,
					redeemed_count: 0,
					expired_count: 0,
					limit: req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT,
					page: req.body.page ? parseInt(req.body.page) : 1,
					message: res.__("front.system.something_going_wrong_please_try_again"),
					total_page: 0,
					err: err
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getWalletListing();

	/**
	 * Function used to get wallet rewards details.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.walletRewardsDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const rewardsSlug = req.body.rewards_slug ? req.body.rewards_slug : "";
			const rewardsId = req.body.reward_id ? newObjectIdDefault(req.body.reward_id) : "";

			// --- Validate userId and at least one identifier (slug or id) ---
			if (!userId || (!rewardsSlug && !rewardsId)) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare query options ---
			let optionsData = {};
			if (rewardsId) {
				optionsData = {
					user_id: userId,
					reward_id: rewardsId
				};
			} else {
				optionsData = {
					user_id: userId,
					slug: rewardsSlug
				};
			}

			const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// --- Prepare aggregation pipeline for reward details ---
			const aggregationPipeline = [
				{ $match: optionsData },
				{
					$lookup: {
						from: TABLE_MASTERS,
						let: { businessIndustryId: "$business_industry_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$businessIndustryId"] },
											{ $eq: ["$dropdown_type", MASTER_BUSINESS_INDUSTRY] },
										]
									},
								}
							},
							{ $project: { name: 1 } }
						],
						as: "businessIndustry"
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
							{ $project: { name: 1 } }
						],
						as: "storeType"
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { sendByUserId: "$send_by" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$sendByUserId"] },
										]
									},
								}
							},
							{ $project: { full_name: 1, profile_image: 1, account_type: 1, slug: 1, reward_image: 1 } }
						],
						as: "sentUserDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"user_id": 1,
						"reward_id": 1,
						"lead_forms_id": 1,
						"title": 1,
						"sub_title": 1,
						"url_desc": 1,
						"image": 1,
						"slug": 1,
						"poll_id": 1,
						"poll_slug": 1,
						"is_redemed": 1,
						"is_viewed": 1,
						"expiry_date": 1,
						"business_industry_id": 1,
						"store_type_name": "$storeType",
						"business_industry_name": { $arrayElemAt: ["$businessIndustry.name", 0] },
						"sent_full_name": { $arrayElemAt: ["$sentUserDetails.full_name", 0] },
						"sent_profile_image": { $arrayElemAt: ["$sentUserDetails.profile_image", 0] },
						"sent_reward_image": { $arrayElemAt: ["$sentUserDetails.reward_image", 0] },
						"account_type": { $arrayElemAt: ["$sentUserDetails.account_type", 0] },
						"sent_user_slug": { $arrayElemAt: ["$sentUserDetails.slug", 0] },
					}
				}
			];

			// --- Run aggregation query to get reward details ---
			const result = await earnRewards.aggregate(aggregationPipeline).toArray();

			if (result && result.length > 0) {
				// --- Update is_viewed status asynchronously (do not block response) ---
				earnRewards.updateOne(optionsData, { $set: { is_viewed: VIEWED } }).catch(() => { });

				// --- Replace href with target='_blank' href in url_desc for safe links ---
				let urlDesc = result[0]['url_desc'] ? result[0]['url_desc'] : "";
				urlDesc = urlDesc ? urlDesc.replace(/href/g, " target='_blank' href") : "";
				result[0]['url_desc'] = urlDesc;

				// --- Send success response with reward details ---
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						user_image_url: USERS_URL,
						result: result[0],
						message: ""
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// --- No record found response ---
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						image_url: LEADS_FORM_URL,
						user_image_url: USERS_URL,
						result: [],
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					image_url: LEADS_FORM_URL,
					user_image_url: USERS_URL,
					result: [],
					message: res.__("front.system.something_going_wrong_please_try_again"),
					err: err
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End walletRewardsDetails();

	/**
	 * Function used to redeem a reward.
	 * Uses async/await for all database operations.
	 * Handles errors gracefully and sends appropriate JSON responses.
	 * @returns json
	 **/
	this.userRedeemedReward = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract and validate user and request data ---
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const rewardsSlug = req.body.rewards_slug ? req.body.rewards_slug : "";
			const redemptionCode = req.body.redemption_code ? req.body.redemption_code : "";

			if (!userId || !rewardsSlug || !redemptionCode) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare wallet redemption condition ---
			const optionWallets = {
				user_id: newObjectIdDefault(userId),
				slug: rewardsSlug,
				redemption_code: redemptionCode
			};

			// --- Redeem reward using async/await ---
			const response = await redeemRewardGlobally(req, res, optionWallets);

			if (response.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: response.message
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: response.message
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
					err: err
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End userRedeemedReward();

}
module.exports = new Wallet();