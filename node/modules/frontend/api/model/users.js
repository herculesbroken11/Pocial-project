var async = require('async');

function Users() {


	/**
	 * Function used to set dark or white theme.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.userDarkToggleChange = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let statusData = (req.body.status === true || req.body.status === "true") ? ACTIVE : DEACTIVE;

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

			// --- Update user's dark/light theme preference ---
			const users = db.collection(TABLE_USERS);
			const updateResult = await users.updateOne({ _id: newObjectIdDefault(userId) }, { $set: { dark_light_theme: statusData } });

			// --- Check if update was successful ---
			if (updateResult && updateResult.modifiedCount > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: statusData
							? res.__("front.user.dark_mode_has_been_activated")
							: res.__("front.user.dark_mode_has_been_deactivated"),
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End userDarkToggleChange();

	/**
	 * Function used to edit public business information.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.editPublicBusinessInformation = async (req, res) => {
		// --- Sanitize request body ---
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// --- Extract user and request data ---
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		let email = loginUserData.email ? loginUserData.email : "";
		let businessEditPageFlag = req.body.business_edit_page_flag ? true : false;

		let finalResponse = {};

		// --- Validate userId and account type ---
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

		try {
			// --- Set email in request body for saving business details ---
			req.body.email = email;

			// --- Save business details using async/await ---
			const businessResponse = await savePublicBussinessUserDetails(req, res, userId);

			if (businessResponse.status == STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: "",
						image_url: USERS_URL,
						message: businessResponse.message
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare options for fetching updated user details ---
			let userOptions = {
				conditions: {
					slug: loginUserData.slug
				},
			};

			// --- Fetch updated user details using async/await ---
			const response = await getUserDetailBySlug(req, res, userOptions);

			// --- Add image_url to result for response ---
			if (response && response.result) {
				response.result.image_url = USERS_URL;
			}

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: response.result,
					image_url: USERS_URL,
					message: businessEditPageFlag
						? res.__("front.users.profile_image_has_been_updated_successfully")
						: res.__("front.users.details_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: "",
					image_url: USERS_URL,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editPublicBusinessInformation();

	/**
	 * Function used to get business details.
	 * Uses async/await for all DB queries and runs queries in parallel using Promise.all.
	 * Clean formatting and clear function comments.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getBusinessDetails = async (req, res) => {
		let finalResponse = {};
		try {
			// --- Sanitize request body ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// --- Extract user and request parameters ---
			let userSlug = req.body.user_slug ? req.body.user_slug : "";
			let isPublicProfilePage = req.body.is_profile_page ? req.body.is_profile_page : false;

			// --- Get login user data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let loginUserId = loginUserData._id ? loginUserData._id : "";
			let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : newObjectIdDefault();

			// --- Check for missing userSlug ---
			if (!userSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Get user details using aggregation ---
			const users = db.collection(TABLE_USERS);
			const userAggregatePipeline = [
				{
					$match: {
						slug: new RegExp(["^", userSlug, "$"].join(""), "i"),
						is_deleted: NOT_DELETED,
						is_active: UN_SUSPEND
					}
				},
				{
					$lookup: {
						from: TABLE_USERS_FOLLOWER_LIST,
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$followed_by", userId] },
										]
									},
								}
							},
							{
								$group: {
									_id: null,
									following_user_id: { $addToSet: '$user_id' },
								}
							}
						],
						as: "loginUserFollowingList"
					}
				},
				{
					$lookup: {
						from: TABLE_LEAD_FORMS,
						let: { leadId: "$lead_forms_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$leadId"] },
										]
									},
								}
							},
							{ $project: { "form_title": 1, "button_name": 1 } }
						],
						as: "leadDetails"
					}
				},
				{
					$project: {
						'_id': 1,
						'fname': 1,
						'lname': 1,
						'email': 1,
						'full_name': 1,
						'profile_image': 1,
						'last_login': 1,
						'age': 1,
						'dob': 1,
						'gender': 1,
						'is_email_verified': 1,
						'created': 1,
						'slug': 1,
						'your_bio': 1,
						'account_type': 1,
						'lead_forms_id': 1,
						'creator_id': "$_id",
						'public_business_informaton': 1,
						'leadDetails': 1,
						'ai_bot_forms_id': 1,
						'qr_code_image': 1,
						'ugc_qr_code_image': 1,
						'insider_toggle': 1,
						'login_user_following_array': { $cond: [{ $arrayElemAt: ["$loginUserFollowingList.following_user_id", 0] }, { $arrayElemAt: ["$loginUserFollowingList.following_user_id", 0] }, []] },
					}
				}
			];

			const userResultArr = await users.aggregate(userAggregatePipeline).toArray();

			// --- If no user found, send error response ---
			if (!userResultArr || userResultArr.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						image_url: USERS_URL,
						qr_code_image_url: QR_CODES_URL,
						ugc_qr_code_image_url: UGC_QR_CODES_URL,
						result: {},
						submit_opt_flag: SUBMIT_OPT_NOT_SUBMIT,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let result = userResultArr[0];
			let foundUserId = result && result._id ? result._id : "";
			let leadFormsId = result && result.lead_forms_id ? result.lead_forms_id : "";

			// --- Check OTP verification and trial period logic ---
			let nextDataAfterOtPVerification = result.created ? new Date(result.created) : "";
			let skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

			if (
				isPublicProfilePage == false &&
				skipWithoutValidatopn == false &&
				result['is_email_verified'] == NOT_VERIFIED
			) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						image_url: USERS_URL,
						qr_code_image_url: QR_CODES_URL,
						ugc_qr_code_image_url: UGC_QR_CODES_URL,
						result: {},
						submit_opt_flag: SUBMIT_OPT_NOT_SUBMIT,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Get followers and following count in parallel with submit opt form check ---
			const [
				followersAndFollowingCount,
				submitOptResult
			] = await Promise.all([
				getFollowingAndFollowersCount(foundUserId),
				db.collection(TABLE_SIGNUP_LEAD_FORMS).findOne(
					{ creator_id: loginUserId },
					{ projection: { _id: 1 } }
				)
			]);

			// --- Add followers/following count to result ---
			result['followers_count'] = followersAndFollowingCount && followersAndFollowingCount['followers_count'] ? followersAndFollowingCount['followers_count'] : 0;
			result['following_count'] = followersAndFollowingCount && followersAndFollowingCount['following_count'] ? followersAndFollowingCount['following_count'] : 0;

			// --- Add lead details to result ---
			result['lead_details'] = {
				submit_button_title: (result.leadDetails && result.leadDetails.length > 0 && result.leadDetails[0]['button_name'])
					? result.leadDetails[0]['button_name']
					: res.locals.settings["Lead.submit_button_title"],
				form_title: (result.leadDetails && result.leadDetails.length > 0 && result.leadDetails[0]['form_title'])
					? result.leadDetails[0]['form_title']
					: res.locals.settings["Lead.form_title"],
				creator_id: foundUserId,
				lead_forms_id: leadFormsId,
			};
			delete result.leadDetails;

			// --- Determine submit_opt_flag ---
			const submitOptFlag = (submitOptResult && loginUserData) ? SUBMIT_OPT_SUBMIT : SUBMIT_OPT_NOT_SUBMIT;

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: USERS_URL,
					qr_code_image_url: QR_CODES_URL,
					ugc_qr_code_image_url: UGC_QR_CODES_URL,
					result: result,
					submit_opt_flag: submitOptFlag,
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					image_url: USERS_URL,
					qr_code_image_url: QR_CODES_URL,
					ugc_qr_code_image_url: UGC_QR_CODES_URL,
					result: {},
					submit_opt_flag: SUBMIT_OPT_NOT_SUBMIT,
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getBusinessDetails();

	/**
	 * Function used to get already selected sub users list.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getSeletedSubUsers = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			let selectedUserIds = req.body.selected_user_ids ? req.body.selected_user_ids : [];
			let userIdsArray = [];

			// --- Convert selected user IDs to ObjectId array ---
			if (selectedUserIds.length > 0) {
				userIdsArray = selectedUserIds.map(id => newObjectIdDefault(id));
			}

			// --- Validate userId and account type ---
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

			// --- Query users collection for selected sub users using async/await ---
			const users = db.collection(TABLE_USERS);
			const result = await users.find({ _id: { $in: userIdsArray } }, { projection: { _id: 1, full_name: 1, email: 1, profile_image: 1 } }).toArray();

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: USERS_URL,
					result: result,
					message: ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					image_url: USERS_URL,
					result: [],
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSeletedSubUsers();

	/**
	 * Function used to search sub users list.
	 * Handles all DB queries using async/await for clean and modern code.
	 * Runs user and sub-user queries in parallel using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.searchSubUsersList = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			let userName = req.body.user_name ? req.body.user_name : "";
			let email = req.body.email ? req.body.email.toLowerCase() : "";
			let zipCode = req.body.zip_code ? req.body.zip_code : "";
			let checkUserIds = req.body.checked_userid ? req.body.checked_userid : [];

			// --- Validate userId and account type ---
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

			// --- If all search fields are blank, return empty result ---
			if (userName === '' && email === '' && zipCode === '' && checkUserIds.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: [],
						image_url: USERS_URL,
						selected_user: [],
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare userIds array from checked_userid ---
			let userIdsArray = [];
			if (checkUserIds.length > 0) {
				userIdsArray = checkUserIds.map(id => newObjectIdDefault(id));
			}

			// --- Build query conditions ---
			let commonConditions = {
				_id: { $ne: userId },
				is_email_verified: VERIFIED,
				account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
				is_deleted: NOT_DELETED,
				user_role_id: FRONT_ADMIN_ROLE_ID
			};

			let optionsArray = [];

			// --- Add email condition if provided ---
			if (email !== "") {
				optionsArray.push({ email: email });
			}

			// --- Add zip code condition if provided ---
			if (zipCode !== "") {
				optionsArray.push({ zip: Number(zipCode) });
			}

			// --- Add name condition if provided ---
			if (userName !== "") {
				optionsArray.push({ full_name: { $regex: new RegExp(userName, "i") } });
			}

			// --- Combine conditions for query ---
			if (optionsArray.length > 0 && userIdsArray.length > 0) {
				commonConditions['$or'] = [
					{ $and: optionsArray },
					{ _id: { $in: userIdsArray } }
				];
			} else if (optionsArray.length > 0) {
				commonConditions['$and'] = optionsArray;
			} else if (userIdsArray.length > 0) {
				commonConditions['$or'] = [
					{ _id: { $in: userIdsArray } }
				];
			}

			// --- Set collections ---
			const collection = db.collection(TABLE_USERS);
			const subUsers = db.collection(TABLE_SUB_USERS);

			// --- Run user and sub-user queries in parallel using Promise.all ---
			const [usersResult, subUsersResult] = await Promise.all([
				// Get list of users matching the search criteria
				collection.find(commonConditions, { projection: { _id: 1, full_name: 1, email: 1, profile_image: 1 } })
					.collation(COLLATION_VALUE)
					.toArray(),
				// Get selected sub users for the current user
				subUsers.findOne(
					{ user_id: newObjectIdDefault(userId) },
					{ projection: { _id: 1, selected_user: 1 } }
				)
			]);

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: USERS_URL,
					result: usersResult || [],
					selected_user: (subUsersResult && subUsersResult.selected_user) ? subUsersResult.selected_user : [],
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					image_url: USERS_URL,
					selected_user: [],
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End searchSubUsersList();

	/**
	 * Function used to get sub users list.
	 * Handles all DB queries using async/await for clean and modern code.
	 * Runs user list and count queries in parallel using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next
	 * @returns json response
	 */
	this.getSubUserlist = async (req, res, next) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let loginUserEmail = loginUserData.email ? loginUserData.email : "";
			let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
			let adminSubUserIds = loginUserData.admin_sub_user_ids ? loginUserData.admin_sub_user_ids : [];
			let frontSubUserIds = loginUserData.front_sub_user_ids ? loginUserData.front_sub_user_ids : [];

			let fullName = req.body.name ? req.body.name : "";
			let email = req.body.email ? req.body.email.toLowerCase() : "";
			let zipCode = req.body.zip_code ? req.body.zip_code : "";
			let multipleUser = req.body.multi_user ? req.body.multi_user : false;

			// --- Validate userId and account type ---
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
			let skip = (limit * page) - limit;

			const collection = db.collection(TABLE_USERS);

			// --- Set query conditions ---
			let conditions = {
				_id: { $in: adminSubUserIds },
				is_deleted: NOT_DELETED
			};

			// --- Handle multiple user selection ---
			if (multipleUser && multipleUser == true) {
				conditions = {
					is_deleted: NOT_DELETED,
					account_type: { $in: [NORMAL_USER_ACCOUNT_TYPE, BUSSINESS_USER_ACCOUNT_TYPE, PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] }
				};

				// --- Prevent assigning the same user by email ---
				if (loginUserEmail == email) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							image_url: USERS_URL,
							result: [],
							message: res.__("front.users.same_user_can_not_assign"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			// --- Add email filter if provided ---
			if (email !== "") {
				conditions['email'] = { $regex: "^" + email + "$", $options: "i" };
			}

			// --- Add zip code filter if provided ---
			if (zipCode !== "") {
				conditions['zip'] = Number(zipCode);
			}

			// --- Add name filter if provided ---
			if (fullName !== "") {
				conditions['full_name'] = { $regex: new RegExp(fullName, "i") };
			}

			// --- Run user list and count queries in parallel using Promise.all ---
			const [usersList, totalRecords] = await Promise.all([
				// Get list of users matching the conditions
				collection.find(conditions, { "_id": 1, "slug": 1, "full_name": 1, "email": 1, "profile_image": 1 }).skip(skip).limit(limit).toArray(),

				// Count total number of users matching the conditions
				collection.countDocuments(conditions)
			]);

			// --- If users found, send success response ---
			if (usersList && usersList.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						image_url: USERS_URL,
						front_sub_user_ids: frontSubUserIds,
						result: usersList,
						recordsTotal: totalRecords,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(totalRecords / limit)
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// --- No users found, send empty result ---
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						image_url: USERS_URL,
						front_sub_user_ids: frontSubUserIds,
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
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					image_url: USERS_URL,
					front_sub_user_ids: [],
					result: [],
					recordsTotal: 0,
					limit: req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT,
					page: req.body.page ? parseInt(req.body.page) : 1,
					message: res.__("front.system.something_going_wrong_please_try_again"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSubUserlist();

	/**
	 * Function used to add sub user.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.addSubUser = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;

			// --- Validate userId and account type ---
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

			// --- Extract checked user IDs from request body ---
			let checkUserIds = req.body.checked_user_ids
				? req.body.checked_user_ids.toString().split(',')
				: "";

			// --- Prepare options data for adding sub users ---
			let optionsData = {
				user_id: userId,
				add_submit_type: FRONT_SUB_USERS_ADD,
				front_checked_user_ids: checkUserIds
			};

			// --- Add sub users data using async/await ---
			const response = await addSubUsersGlobally(req, res, optionsData);

			if (response.status == STATUS_ERROR) {
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

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End addSubUser();

	/**
	 * Function used to delete user image.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deleteUserImage = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Sanitize request body ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let imageName = req.body.image_name ? req.body.image_name : "";
			let imageType = req.body.image_type ? req.body.image_type : "";

			// --- Validate required fields ---
			if (!userId || !imageName || !imageType) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare options for dynamic image deletion ---
			let optionsImage = {
				user_id: userId,
				image_name: imageName,
				image_type: imageType,
			};

			// --- Call dynamic image deletion function using async/await ---
			const deleteImageResponse = await deleteImageDynamicFunction(req, res, optionsImage);

			if (deleteImageResponse.status == STATUS_SUCCESS) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: deleteImageResponse.message
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: deleteImageResponse.message
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteUserImage();

	/**
	 * Function used to update user profile image.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.updateUserProfileImage = async (req, res) => {
		// --- Sanitize request body ---
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// --- Extract user and request data ---
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let accountType = loginUserData.account_type ? loginUserData.account_type : "";

		let finalResponse = {};

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

		// --- Extract image data from request ---
		let oldImage = req.body.old_image ? req.body.old_image : "";
		let profileImage = (req.files && req.files.profile_image) ? req.files.profile_image : "";

		let options = {
			image: profileImage,
			filePath: USERS_FILE_PATH,
			oldPath: oldImage
		};

		try {
			// --- Upload user image using async/await ---
			const imageResponse = await moveUploadedFile(req, res, options);

			if (imageResponse.status == STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: [],
						message: imageResponse.message
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare update data for user profile image ---
			let updateData = {
				profile_image: imageResponse.fileName ? imageResponse.fileName : "",
				modified: getUtcDate()
			};

			// --- If account type is public business, update business logo as well ---
			if (accountType == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				updateData = {
					profile_image: imageResponse.fileName ? imageResponse.fileName : "",
					'public_business_informaton.business_logo': imageResponse.fileName ? imageResponse.fileName : "",
					modified: getUtcDate()
				};
			}

			// --- Update user data in the database using async/await ---
			const users = db.collection(TABLE_USERS);
			const updateResult = await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			if (!updateResult || updateResult.modifiedCount === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare options for fetching updated user details ---
			let userOptions = {
				conditions: {
					slug: loginUserData.slug
				},
			};

			// --- Fetch updated user details using async/await ---
			const response = await getUserDetailBySlug(req, res, userOptions);

			// --- Add image_url to result for response ---
			if (response && response.result) {
				response.result.image_url = USERS_URL;
			}

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: response.result,
					image_url: USERS_URL,
					message: res.__("front.users.profile_image_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End updateUserProfileImage();

	/**
	 * Function used to destroy AI page.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.aiPageAfterDestroy = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user data from request ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";

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

			// --- Update user's ai_page_destory flag using async/await ---
			const users = db.collection(TABLE_USERS);
			const updateResult = await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: { ai_page_destory: true } }
			);

			// --- Check if update was successful ---
			if (!updateResult || updateResult.modifiedCount === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.users.ai_page_destroyed_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End aiPageAfterDestroy();

	/**
	 * Function used to send email insider poll votes.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.sendEmailInsiderPollVotes = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data || "";
			let userId = loginUserData._id || "";
			let aiCampaignNameId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
			let excludeUsers = req.body.exclude_users ? true : false;
			let pollOptionId = req.body.poll_option_id ? newObjectIdDefault(req.body.poll_option_id) : "";

			// --- Validate userId and aiCampaignNameId ---
			if (!userId || !aiCampaignNameId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Set collection tables ---
			const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
			const insiderSendEmailPollUserLogs = db.collection(TABLE_INSIDER_SEND_EMAIL_POLL_USER_LOGS);

			// --- Set option conditions for aggregation ---
			let optionsConditions = {
				"option_datas.type": "email"
			};
			if (pollOptionId) {
				optionsConditions["option_datas.option_id"] = pollOptionId;
			}

			// --- Get already sent email user IDs using async/await ---
			let alreadySentUserIds = [];
			try {
				alreadySentUserIds = await insiderSendEmailPollUserLogs.distinct("sent_to_email_user_id", {
					"owner_user_id": userId,
					"ai_campaign_parent_id": aiCampaignNameId,
				});
			} catch (err) {
				// If error in fetching, treat as empty
				alreadySentUserIds = [];
			}

			// --- Prepare excluded user condition ---
			let excludedData = { $nin: ["", null] };
			if (excludeUsers === true && Array.isArray(alreadySentUserIds) && alreadySentUserIds.length > 0) {
				excludedData = { $nin: ["", null, ...alreadySentUserIds] };
			}

			// --- Aggregate to get poll vote user details ---
			const resultData = await tableAiCampaignName.aggregate([
				{
					$match: {
						"_id": aiCampaignNameId,
						"user_id": userId,
						"type": INSIDER_POLL_CAMPAIGN
					}
				},
				{ $unwind: "$option_datas" },
				{
					$match: optionsConditions
				},
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { optionsId: "$option_datas.option_id", pollId: "$poll_id" },
						pipeline: [
							{
								$match: {
									"user_id": excludedData,
									$expr: {
										$and: [
											{ $eq: ["$poll_id", "$$pollId"] },
											{ $eq: ["$option_id", "$$optionsId"] }
										]
									}
								}
							},
							{ $project: { 'user_id': 1 } }
						],
						as: "voteUserDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"poll_id": "$poll_id",
						"generated_insider_poll_id": "$generated_insider_poll_id",
						"generated_insider_reward_id": "$generated_insider_reward_id",
						"option_id": "$option_datas.option_id",
						"insider_ai_campaign_chat_id": "$option_datas._id",
						"voteUserDetails": "$voteUserDetails",
					}
				},
			]).toArray();

			// --- Prepare bulk operations for user logs ---
			const bulkOps = [];
			if (resultData && resultData.length > 0) {
				resultData.forEach(data => {
					if (data.voteUserDetails && data.voteUserDetails.length > 0) {
						data.voteUserDetails.forEach(user => {
							bulkOps.push({
								insertOne: {
									document: {
										"owner_user_id": userId,
										"ai_campaign_parent_id": aiCampaignNameId,
										"poll_id": data.poll_id,
										"option_id": data.option_id,
										"generated_insider_poll_id": data.generated_insider_poll_id ? data.generated_insider_poll_id : "",
										"generated_insider_reward_id": data.generated_insider_reward_id ? data.generated_insider_reward_id : "",
										"insider_ai_campaign_chat_id": data.insider_ai_campaign_chat_id,
										"sent_to_email_user_id": user.user_id,
										"is_sent": IS_INSIDERS_POLL_USER_VOTTED_PENDING_STATUS,
										"created": getUtcDate()
									}
								}
							});
						});
					}
				});
			}

			// --- Insert logs and send response ---
			if (bulkOps.length > 0) {
				await insiderSendEmailPollUserLogs.bulkWrite(bulkOps);
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: res.__("front.insiders.your_email_has_been_successfully_scheduled_and_will_be_sent_shortly"),
					}
				};
			} else if (resultData && resultData.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.insiders.no_users_to_send_email"),
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.insiders.insider_poll_not_found"),
					}
				};
			}

			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			console.error(error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End sendEmailInsiderPollVotes();

	/**
	 * Function used to validate insider poll email user send.
	 * Uses async/await for all database operations.
	 * Runs aggregation queries in parallel using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.validateInsiderPollEmailUserSend = async (req, res, next) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const aiCampaignNameId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
			const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
			const pollOptionId = req.body.poll_option_id ? newObjectIdDefault(req.body.poll_option_id) : "";

			// --- Set collections ---
			const insiderSendEmailPollUserLogs = db.collection(TABLE_INSIDER_SEND_EMAIL_POLL_USER_LOGS);
			const pollUserVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

			// --- Validate required fields ---
			if (!userId || !aiCampaignNameId || !pollId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare aggregation options for both queries ---
			let logsOptions = {
				owner_user_id: userId,
				ai_campaign_parent_id: aiCampaignNameId,
				poll_id: pollId
			};
			if (pollOptionId) {
				logsOptions['option_id'] = pollOptionId;
			}

			let optionsPoll = {
				poll_id: pollId,
				make_poll_user_id: userId,
				user_id: { $nin: ['', null] }
			};
			if (pollOptionId) {
				optionsPoll['option_id'] = pollOptionId;
			}

			// --- Run both aggregation queries in parallel using Promise.all ---
			const [
				alreadySentEmailToUserResult,
				totalVoteUserResult
			] = await Promise.all([
				// Aggregate already sent email count
				insiderSendEmailPollUserLogs.aggregate([
					{ $match: logsOptions },
					{
						$group: {
							_id: {
								sent_to_email_user_id: "$sent_to_email_user_id",
								ai_campaign_parent_id: "$ai_campaign_parent_id"
							},
							count: { $sum: 1 }
						}
					}
				]).toArray(),
				// Aggregate total vote user count
				pollUserVoteParticipants.aggregate([
					{ $match: optionsPoll },
					{
						$group: {
							_id: {
								user_id: "$user_id",
								option_id: "$option_id"
							},
							count: { $sum: 1 }
						}
					}
				]).toArray()
			]);

			const alreadySentEmailToUserCount = alreadySentEmailToUserResult ? alreadySentEmailToUserResult.length : 0;
			const totalVoteUserCount = totalVoteUserResult ? totalVoteUserResult.length : 0;

			// --- Determine response based on counts ---
			if (alreadySentEmailToUserCount > 0) {
				if (totalVoteUserCount === 1 && totalVoteUserCount === alreadySentEmailToUserCount) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.insider_poll_sent_email.reward_is_already_sent_to_this_user")
						}
					};
				} else if (totalVoteUserCount > 1 && totalVoteUserCount === alreadySentEmailToUserCount) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.insider_poll_sent_email.email_is_already_sent_to_all_users")
						}
					};
				} else {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.insider_poll_sent_email.email_is_already_sent_to_the_users_out_of_total_users", alreadySentEmailToUserCount, totalVoteUserCount)
						}
					};
				}
			} else {
				// --- No users have been sent emails yet, success ---
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.global.no_record_found")
					}
				};
			}

			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End validateInsiderPollEmailUserSend();

	/**
	 * Function used to update user time zone.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.updateUserTimeZone = async (req, res) => {
		try {
			// --- Sanitize and validate input ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const loginUserData = req.user_data || {};
			const userId = loginUserData._id ? loginUserData._id : "";
			const userSelectedTimeZone = req.body.current_timezone ? req.body.current_timezone : "";

			// --- Basic validation for userId and timezone ---
			if (!userId || !userSelectedTimeZone) {
				return returnApiResult(req, res, {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				});
			}

			// --- Update user's timezone using async/await ---
			const usersCollection = db.collection(TABLE_USERS);
			const updateResult = await usersCollection.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: { current_timezone: userSelectedTimeZone } }
			);

			// --- Check if update was successful ---
			if (updateResult && updateResult.modifiedCount > 0) {
				return returnApiResult(req, res, {
					data: {
						status: STATUS_SUCCESS,
						message: res.__("front.user.time_zone_updated_successfully"),
					}
				});
			} else {
				return returnApiResult(req, res, {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				});
			}
		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			console.error("Error updating timezone:", error);
			return returnApiResult(req, res, {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			});
		}
	};


	/**
	 * Function used to auto Schedule On/Off
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.autoScheduleOnOff = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const instagramUrl = loginUserData.instagram_url ? loginUserData.instagram_url : "";
			const longLivedAccessToken = loginUserData.long_lived_access_token ? loginUserData.long_lived_access_token : "";
			const statusData = (req.body.status === true || req.body.status === "true") ? true : false;

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

			// --- Check if Instagram is connected ---
			if (instagramUrl !== '' || longLivedAccessToken !== '') {
				const users = db.collection(TABLE_USERS);

				// --- Update user's auto_schedule status using async/await ---
				const updateResult = await users.updateOne(
					{ _id: newObjectIdDefault(userId) },
					{ $set: { auto_schedule: statusData } }
				);

				// --- Check if update was successful ---
				if (updateResult && updateResult.modifiedCount > 0) {
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							message: statusData
								? res.__("front.user.auto_schedule_activated")
								: res.__("front.user.auto_schedule_deactivated"),
						}
					};
				} else {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							message: res.__("front.system.something_going_wrong_please_try_again"),
						}
					};
				}
				return returnApiResult(req, res, finalResponse);
			} else {
				// --- Instagram not connected, send error response ---
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.user.please_connect_your_instagram_account_before_enabling_auto_scheduling")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// --- Handle errors gracefully and send error response ---
			console.error("Error in autoScheduleOnOff:", error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	};



}
module.exports = new Users();
