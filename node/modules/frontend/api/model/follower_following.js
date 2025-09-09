function FollowerFollowing() {

	FollowerFollowing = this;

	/**
	 * Function to follow or unfollow a user.
	 * Uses async/await for all DB operations for faster and cleaner response.
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @return json
	 */
	this.followUnfollowUser = async (req, res, next) => {
		let loginUserData = req.user_data ? req.user_data : "";
		let followedBy = loginUserData._id ? loginUserData._id : "";
		let fullName = loginUserData.full_name ? loginUserData.full_name : "";
		let otherUserSlug = req.body.other_user_slug ? req.body.other_user_slug : "";

		let finalResponse = {};

		if (!followedBy) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("front.follow.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		let otherUserCondition = { 'slug': otherUserSlug };
		let otherUserOptions = { conditions: otherUserCondition };

		try {
			// Get other user detail using async/await
			const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

			// If user does not exist, return error
			if (userResponse.status === STATUS_ERROR) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'errors': {},
						'message': res.__("front.following_followers.this_user_does_not_exist")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let requestToUserId = userResponse.result._id ? userResponse.result._id : "";

			// Check if the follow relationship already exists
			const findResult = await usersFollower.findOne({
				'user_id': newObjectIdDefault(requestToUserId),
				'followed_by': newObjectIdDefault(followedBy),
				'action_type': FOLLOW_ACTION_TYPE,
			});

			if (findResult && Object.keys(findResult).length > 0) {
				// If exists, unfollow (delete the relationship)
				await usersFollower.deleteOne({
					'user_id': newObjectIdDefault(requestToUserId),
					'followed_by': newObjectIdDefault(followedBy),
				});

				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: {
							follow_status: DEACTIVE
						},
						message: res.__("front.following_followers.unfollow_successfully")
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// If not exists, follow (insert the relationship)
				await usersFollower.insertOne({
					'user_id': newObjectIdDefault(requestToUserId),
					'followed_by': newObjectIdDefault(followedBy),
					'is_approved': DEACTIVE,
					'action_type': FOLLOW_ACTION_TYPE,
					'status': ACTIVE,
					'modified': getUtcDate(),
					'created': getUtcDate(),
				});

				// Prepare notification options
				let notificationMessageParams = [fullName];
				let notificationOptions = {
					'notification_data': {
						'notification_type': NOTIFICATION_FOLLOW_REQUEST,
						'message_params': notificationMessageParams,
						'parent_table_id': requestToUserId,
						'user_id': requestToUserId,
						'user_ids': [requestToUserId],
						'user_role_id': FRONT_ADMIN_ROLE_ID,
						'role_id': FRONT_ADMIN_ROLE_ID,
						'extra_parameters': {
							'user_id': newObjectIdDefault(requestToUserId),
							'created_by': newObjectIdDefault(followedBy),
							'request_status': DEACTIVE,
						}
					}
				};

				// Insert notification using async/await
				await insertNotifications(req, res, notificationOptions);

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': {
							'follow_status': FOLLOW_REQUEST_PENDING
						},
						'message': res.__("users.following_followers.user_follow_request_added_successfully")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle unexpected errors
			console.error("Error in followUnfollowUser:", error);
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("front.system.something_going_wrong_please_try_again"),
					'error': error.message || error
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end followUnfollowUser();

	/**
	 * Function to get follow request list
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @return json
	 **/
	this.followRequestList = async (req, res, next) => {
		try {
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// Extract business details for the logged-in user
			const publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
			const nameOfTheBusiness = publicBusinessInformaton && publicBusinessInformaton.name_of_the_business ? publicBusinessInformaton.name_of_the_business : "";
			const businessLogo = publicBusinessInformaton && publicBusinessInformaton.business_logo ? publicBusinessInformaton.business_logo : "";
			const accountType = loginUserData.account_type ? loginUserData.account_type : "";

			const businessDetails = {
				'name_of_the_business': nameOfTheBusiness,
				'business_logo': businessLogo,
				'account_type': accountType,
			};

			let finalResponse = {};
			if (userId == '') {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			const condition = {
				'user_id': newObjectIdDefault(userId),
				'is_approved': DEACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
			};

			let searchCondition = {};
			const userName = req.body.search_user_name ? req.body.search_user_name : "";
			if (userName !== "") {
				searchCondition['user_full_name'] = { $regex: new RegExp(userName, "i") };
			}

			// Prepare all queries to run in parallel using Promise.all
			const requestListPromise = usersFollower.aggregate([
				{ $match: condition },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { followedBy: "$followed_by" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$followedBy"] },
										]
									},
								}
							},
							{ $project: { "_id": 1, "full_name": 1, "public_business_informaton": 1, "profile_image": 1, "slug": 1, "account_type": 1, "email": 1 } }
						],
						as: "user_details"
					}
				},
				{
					$project: {
						_id: 1,
						user_id: 1,
						followed_by: 1,
						created: 1,
						user_full_name: {
							$cond: [
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.full_name", 0] }
							]
						},
						user_profile_image: { $arrayElemAt: ["$user_details.profile_image", 0] },
						user_email: { $arrayElemAt: ["$user_details.email", 0] },
						user_slug: { $arrayElemAt: ["$user_details.slug", 0] },
						account_type: { $arrayElemAt: ["$user_details.account_type", 0] },
					}
				},
				{ $match: searchCondition },
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			]).toArray();

			const requestCountSearchWisePromise = usersFollower.aggregate([
				{ $match: condition },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { followedBy: "$followed_by" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$followedBy"] },
										]
									},
								}
							},
							{ $project: { "_id": 1, "full_name": 1, "public_business_informaton": 1 } }
						],
						as: "user_details"
					}
				},
				{
					$project: {
						_id: 1,
						user_full_name: {
							$cond: [
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.full_name", 0] }
							]
						},
					}
				},
				{ $match: searchCondition },
			]).toArray();

			const requestCountPromise = usersFollower.countDocuments(condition);

			const followersAndFollowingCountPromise = getFollowingAndFollowersCount(userId);

			// Await all queries in parallel
			const [
				requestList,
				requestCountSearchWiseArr,
				requestCount,
				followersAndFollowingCount
			] = await Promise.all([
				requestListPromise,
				requestCountSearchWisePromise,
				requestCountPromise,
				followersAndFollowingCountPromise
			]);

			const requestCountSearchWise = requestCountSearchWiseArr ? requestCountSearchWiseArr.length : 0;
			const followersCount = followersAndFollowingCount && followersAndFollowingCount['followers_count'] ? followersAndFollowingCount['followers_count'] : 0;
			const followingCount = followersAndFollowingCount && followersAndFollowingCount['following_count'] ? followersAndFollowingCount['following_count'] : 0;

			finalResponse = {
				'data': {
					'recordsTotal': requestCountSearchWise,
					'status': STATUS_SUCCESS,
					'followers_count': followersCount,
					'following_count': followingCount,
					'follow_request_count': requestCount,
					'login_user_id': userId,
					'business_details': businessDetails,
					'request_list': requestList ? requestList : [],
					'limit': limit,
					'page': page,
					'total_page': Math.ceil(requestCountSearchWise / limit),
					'user_image_url': USERS_URL,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			console.error("Error in followRequestList:", error);
			const finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("front.system.something_going_wrong_please_try_again"),
					'error': error.message || error
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end followRequestList();

	/**
	 * Function for accepting and rejecting follow requests.
	 * Uses async/await for all DB operations for faster and cleaner response.
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @return json
	 **/
	this.acceptRejectFollowRequest = async (req, res) => {
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let fullName = loginUserData.full_name ? loginUserData.full_name : "";
		let slug = loginUserData.slug ? loginUserData.slug : "";

		let actionType = req.body.action_type ? req.body.action_type : "";
		let otherUserSlug = req.body.other_user_slug ? req.body.other_user_slug : "";

		let finalResponse = {};

		if (userId === '' || actionType === "") {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		let otherUserCondition = { slug: otherUserSlug };
		let otherUserOptions = {
			conditions: otherUserCondition,
			fields: { facebook_id: 0 }
		};

		try {
			// Get other user detail using async/await
			const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

			// If user does not exist, return error
			if (userResponse.status === STATUS_ERROR) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'errors': {},
						'message': res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let followedByUserId = userResponse.result._id ? userResponse.result._id : "";

			if (actionType === FOLLOW_REQUEST_ACCEPT) {
				// Accept follow request: update the follower record
				await usersFollower.updateOne(
					{
						'user_id': newObjectIdDefault(userId),
						'followed_by': newObjectIdDefault(followedByUserId),
						'action_type': FOLLOW_ACTION_TYPE,
					},
					{
						$set: { 'is_approved': ACTIVE }
					}
				);

				// Prepare notification options
				let notificationMessageParams = [fullName];
				let notificationOptions = {
					notification_data: {
						'notification_type': NOTIFICATION_FOLLOW_REQUEST_ACCEPT,
						'message_params': notificationMessageParams,
						'parent_table_id': followedByUserId,
						'user_id': followedByUserId,
						'user_ids': [followedByUserId],
						'user_role_id': FRONT_ADMIN_ROLE_ID,
						'role_id': FRONT_ADMIN_ROLE_ID,
						'extra_parameters': {
							'slug': slug,
							'created_by': followedByUserId,
						}
					}
				};

				// Insert notification using async/await
				await insertNotifications(req, res, notificationOptions);

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'errors': {},
						'request_status': ACTIVE,
						'message': res.__("front.following_followers.request_has_been_accpeted")
					}
				};
				return returnApiResult(req, res, finalResponse);

			} else if (actionType === FOLLOW_REQUEST_REJECT) {
				// Reject follow request: delete the follower record
				await usersFollower.findOneAndDelete({
					"user_id": newObjectIdDefault(userId),
					"followed_by": newObjectIdDefault(followedByUserId)
				});

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'errors': {},
						'request_status': ACTIVE,
						'message': res.__("front.following_followers.request_has_been_rejectd")
					}
				};
				return returnApiResult(req, res, finalResponse);

			} else {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'errors': {},
						'message': res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			console.error("Error in acceptRejectFollowRequest:", error);
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'errors': {},
					'message': res.__("front.system.something_going_wrong_please_try_again"),
					'error': error.message || error
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end acceptRejectFollowRequest();

	/**
	 * Function to get followers list using async/await and Promise.all for parallel queries.
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @return json
	 **/
	this.followersList = async (req, res) => {
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : newObjectIdDefault();
		let otherUserSlug = req.body.other_user_slug ? req.body.other_user_slug : "";

		let finalResponse = {};

		if (userId == '') {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		let page = req.body.page ? parseInt(req.body.page) : 1;
		let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		let skip = (limit * page) - limit;

		let otherUserCondition = { slug: otherUserSlug };
		let otherUserOptions = {
			conditions: otherUserCondition,
			fields: { facebook_id: 0 }
		};

		try {
			// Get other user detail
			const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

			if (userResponse.status == STATUS_ERROR) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'errors': {},
						'message': res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let followerForUserId = userResponse.result._id ? userResponse.result._id : "";

			// Extract business details for the other user
			let publicBusinessInformaton = userResponse.result.public_business_informaton || "";
			let nameOfTheBusiness = publicBusinessInformaton.name_of_the_business || "";
			let businessLogo = publicBusinessInformaton.business_logo || "";
			let accountType = userResponse.result.account_type || "";
			let otherUserFullName = userResponse.result.full_name || "";

			let businessDetails = {
				'name_of_the_business': nameOfTheBusiness,
				'business_logo': businessLogo,
				'account_type': accountType,
				'other_user_full_name': otherUserFullName,
			};

			// Set up query conditions
			let condition = {
				'user_id': newObjectIdDefault(followerForUserId),
				'is_approved': ACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
			};
			let searchCondition = {};
			let userName = req.body.search_user_name ? req.body.search_user_name : "";
			if (userName !== "") {
				searchCondition['user_full_name'] = { $regex: new RegExp(userName, "i") };
			}

			// Prepare all queries to run in parallel using Promise.all
			const followersListPromise = usersFollower.aggregate([
				{ $match: condition },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { followedBy: "$followed_by" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$followedBy"] },
										]
									},
								}
							},
							{ $project: { "_id": 1, "public_business_informaton": 1, "full_name": 1, "profile_image": 1, "email": 1, "account_type": 1, "slug": 1 } }
						],
						as: "user_details"
					}
				},
				{
					$project: {
						_id: 1,
						user_id: 1,
						followed_by: 1,
						is_approved: 1,
						is_close_friend: 1,
						created: 1,
						user_full_name: {
							$cond: [
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.full_name", 0] }
							]
						},
						user_profile_image: { $arrayElemAt: ["$user_details.profile_image", 0] },
						user_email: { $arrayElemAt: ["$user_details.email", 0] },
						user_slug: { $arrayElemAt: ["$user_details.slug", 0] },
						account_type: { $arrayElemAt: ["$user_details.account_type", 0] },
					}
				},
				{ $match: searchCondition },
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			]).toArray();

			const followersCountSearchWisePromise = usersFollower.aggregate([
				{ $match: condition },
				{
					$lookup: {
						from: TABLE_USERS,
						let: { followedBy: "$followed_by" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$followedBy"] },
										]
									},
								}
							},
							{ $project: { "_id": 1, "full_name": 1, "public_business_informaton": 1 } }
						],
						as: "user_details"
					}
				},
				{
					$project: {
						'_id': 1,
						'user_full_name': {
							$cond: [
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.full_name", 0] }
							]
						},
					}
				},
				{ $match: searchCondition },
			]).toArray();

			const followersAndFollowingCountPromise = getFollowingAndFollowersCount(followerForUserId);

			const getLoginUserFollowingUserPromise = usersFollower.distinct('user_id', {
				'followed_by': newObjectIdDefault(userId),
				'is_approved': ACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
			});

			const getLoginUserUnApproveFollowingUserPromise = usersFollower.distinct('user_id', {
				'followed_by': newObjectIdDefault(userId),
				'is_approved': DEACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
			});

			const followRequestCountPromise = usersFollower.countDocuments({
				'user_id': newObjectIdDefault(followerForUserId),
				'is_approved': DEACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
			});

			// Run all queries in parallel
			const [
				followersList,
				followersCountSearchWiseArr,
				followersAndFollowingCount,
				loginUserFollowingUser,
				loginUserUnApproveFollowingUser,
				followRequestCount
			] = await Promise.all([
				followersListPromise,
				followersCountSearchWisePromise,
				followersAndFollowingCountPromise,
				getLoginUserFollowingUserPromise,
				getLoginUserUnApproveFollowingUserPromise,
				followRequestCountPromise
			]);

			const followersCountSerachWise = followersCountSearchWiseArr ? followersCountSearchWiseArr.length : 0;
			const totalRecord = followersAndFollowingCount && followersAndFollowingCount['followers_count'] ? followersAndFollowingCount['followers_count'] : 0;
			const followingCount = followersAndFollowingCount && followersAndFollowingCount['following_count'] ? followersAndFollowingCount['following_count'] : 0;

			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'login_user_id': userId,
					'other_slug_user_id': followerForUserId,
					'recordsTotal': followersCountSerachWise,
					'followers_count': totalRecord,
					'following_count': followingCount,
					'follow_request_count': followRequestCount,
					'business_details': businessDetails,
					'login_user_following_array': loginUserFollowingUser || [],
					'login_user_unapprove_following_array': loginUserUnApproveFollowingUser || [],
					'followers_list': followersList || [],
					'limit': limit,
					'page': page,
					'total_page': Math.ceil(followersCountSerachWise / limit),
					'user_image_url': USERS_URL,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'errors': {},
					'message': res.__("front.system.something_going_wrong_please_try_again"),
					'error': err && err.message ? err.message : err
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end followersList();

	/**
	 * Function to get following list using async/await and Promise.all for parallel queries.
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @return json
	 **/
	this.followingList = async (req, res) => {
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : newObjectIdDefault();
		let otherUserSlug = req.body.other_user_slug ? req.body.other_user_slug : "";

		let finalResponse = {};

		if (userId == '') {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		let page = req.body.page ? parseInt(req.body.page) : 1;
		let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		let skip = (limit * page) - limit;

		let otherUserCondition = { slug: otherUserSlug };
		let otherUserOptions = {
			conditions: otherUserCondition,
			fields: { facebook_id: 0 }
		};

		try {
			// Get other user detail using async/await
			const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

			// If user does not exist, return error
			if (userResponse.status == STATUS_ERROR) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'errors': {},
						'message': res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let followedByUserId = userResponse.result._id ? userResponse.result._id : "";

			// Extract business details for the other user
			let publicBusinessInformaton = userResponse.result.public_business_informaton || "";
			let nameOfTheBusiness = publicBusinessInformaton.name_of_the_business || "";
			let businessLogo = publicBusinessInformaton.business_logo || "";
			let accountType = userResponse.result.account_type || "";
			let otherUserFullName = userResponse.result.full_name || "";
			let businessDetails = {
				'name_of_the_business': nameOfTheBusiness,
				'business_logo': businessLogo,
				'account_type': accountType,
				'other_user_full_name': otherUserFullName,
			};

			// Set following condition
			let condition = {
				'followed_by': newObjectIdDefault(followedByUserId),
				'is_approved': ACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
			};

			let searchCondition = {};
			let userName = req.body.search_user_name ? req.body.search_user_name : "";
			if (userName != "") {
				searchCondition['user_full_name'] = { $regex: new RegExp(userName, "i") };
			}

			// Prepare all queries to run in parallel
			const followingListPromise = usersFollower.aggregate([
				{ $match: condition },
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
							{ $project: { "_id": 1, "full_name": 1, "public_business_informaton": 1, "profile_image": 1, "email": 1, "account_type": 1, "slug": 1 } }
						],
						as: "user_details"
					}
				},
				{
					$project: {
						_id: 1,
						user_id: 1,
						followed_by: 1,
						created: 1,
						is_approved: 1,
						is_close_friend: 1,
						user_full_name: {
							$cond: [
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$user_details.full_name", 0] }
							]
						},
						user_profile_image: { $arrayElemAt: ["$user_details.profile_image", 0] },
						user_email: { $arrayElemAt: ["$user_details.email", 0] },
						user_slug: { $arrayElemAt: ["$user_details.slug", 0] },
						account_type: { $arrayElemAt: ["$user_details.account_type", 0] },
					}
				},
				{ $match: searchCondition },
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			]).toArray();

			const followingCountSearchWisePromise = usersFollower.aggregate([
				{ $match: condition },
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
							{ $project: { "_id": 1, "full_name": 1 } }
						],
						as: "user_details"
					}
				},
				{
					$project: {
						_id: 1,
						user_full_name: { $arrayElemAt: ["$user_details.full_name", 0] },
					}
				},
				{ $match: searchCondition },
			]).toArray();

			const followersAndFollowingCountPromise = getFollowingAndFollowersCount(followedByUserId);

			const getLoginUserFollowingUserPromise = usersFollower.distinct('user_id', {
				followed_by: newObjectIdDefault(userId),
				is_approved: ACTIVE,
				action_type: FOLLOW_ACTION_TYPE,
			});

			const getLoginUserUnApproveFollowingUserPromise = usersFollower.distinct('user_id', {
				followed_by: newObjectIdDefault(userId),
				is_approved: DEACTIVE,
				action_type: FOLLOW_ACTION_TYPE,
			});

			const followRequestCountPromise = usersFollower.countDocuments({
				user_id: newObjectIdDefault(userId),
				is_approved: DEACTIVE,
				action_type: FOLLOW_ACTION_TYPE,
			});

			// Await all queries in parallel
			const [
				followingList,
				followingCountSearchWiseArr,
				followersAndFollowingCount,
				loginUserFollowingUser,
				loginUserUnApproveFollowingUser,
				followRequestCount
			] = await Promise.all([
				followingListPromise,
				followingCountSearchWisePromise,
				followersAndFollowingCountPromise,
				getLoginUserFollowingUserPromise,
				getLoginUserUnApproveFollowingUserPromise,
				followRequestCountPromise
			]);

			const followingCountSerachWise = followingCountSearchWiseArr ? followingCountSearchWiseArr.length : 0;
			const totalRecord = followersAndFollowingCount && followersAndFollowingCount['following_count'] ? followersAndFollowingCount['following_count'] : 0;
			const followersCount = followersAndFollowingCount && followersAndFollowingCount['followers_count'] ? followersAndFollowingCount['followers_count'] : 0;

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					login_user_id: userId,
					other_slug_user_id: followedByUserId,
					recordsTotal: followingCountSerachWise,
					following_count: totalRecord,
					followers_count: followersCount,
					follow_request_count: followRequestCount,
					business_details: businessDetails,
					login_user_following_array: loginUserFollowingUser || [],
					login_user_unapprove_following_array: loginUserUnApproveFollowingUser || [],
					following_list: followingList || [],
					limit: limit,
					page: page,
					total_page: Math.ceil(followingCountSerachWise / limit),
					user_image_url: USERS_URL,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
					error: err && err.message ? err.message : err
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end followingList();

	/**
	 * Function to remove a follower user using async/await for all DB operations.
	 * @param req 	As Request Data
	 * @param res 	As Response Data
	 * @param next	As Callback argument to the middleware function
	 * @return json
	 **/
	this.removeFollowers = async (req, res) => {
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let otherUserSlug = req.body.other_user_slug ? req.body.other_user_slug : "";
		let finalResponse = {};

		if (userId == '') {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		let otherUserCondition = { 'slug': otherUserSlug };
		let otherUserOptions = {
			conditions: otherUserCondition,
			fields: { facebook_id: 0 }
		};

		try {
			// Get other user detail using async/await
			const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

			// If user does not exist, return error
			if (userResponse.status == STATUS_ERROR) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'errors': {},
						'message': res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let followedBy = userResponse.result._id ? userResponse.result._id : "";

			// Set condition for finding the follower record
			let condition = {
				'user_id': newObjectIdDefault(userId),
				'followed_by': newObjectIdDefault(followedBy),
				'action_type': FOLLOW_ACTION_TYPE,
			};

			// Find the follower record
			const findResult = await usersFollower.findOne(condition);

			if (findResult && Object.keys(findResult).length > 0) {
				// Delete the follower record
				await usersFollower.deleteOne(condition);

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': {
							'follow_status': DEACTIVE
						},
						'message': res.__("front.following_followers.this_user_remove_from_followers_successfully")
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			console.error("Error in removeFollowers:", error);
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'errors': {},
					'message': res.__("front.system.something_going_wrong_please_try_again"),
					'error': error && error.message ? error.message : error
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end removeFollowers();
}
module.exports = new FollowerFollowing();