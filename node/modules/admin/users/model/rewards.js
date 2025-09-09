function Rewards() {

	/**
	 * Function to get rewards list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.getRewardsList = async (req, res) => {
		try {
			// Get userId and userType from request parameters
			let userId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";

			// Validate userType and userId
			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			// If POST request, handle datatable AJAX
			if (isPost(req)) {
				let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
				let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
				let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
				let toDate = (req.body.toDate) ? req.body.toDate : "";
				const collection = db.collection(TABLE_REWARDS);

				// Configure datatable conditions
				let dataTableConfig = await configDatatable(req, res, null);

				let commonConditions = {
					is_deleted: NOT_DELETED,
					user_id: newObjectIdDefault(userId),
				};

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions["created"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Prepare aggregation pipeline for rewards list
				const rewardsListPipeline = [
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
				];

				// Run DB queries in parallel using Promise.all
				const [
					rewardsList,
					recordsTotal,
					recordsFiltered
				] = await Promise.all([
					// Get list of rewards with aggregation
					collection.aggregate(rewardsListPipeline).toArray(),
					// Get total number of records (without filters)
					collection.countDocuments(commonConditions),
					// Get filtered records count (with filters)
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: rewardsList || [],
					recordsFiltered: recordsFiltered || 0,
					recordsTotal: recordsTotal || 0
				});
			} else {
				// If GET request, render the rewards list page

				// Get user complete email template details using async/await
				const users = db.collection(TABLE_USERS);
				const userResult = await users.findOne(
					{ "_id": newObjectIdDefault(userId) },
					{ projection: { complete_profile_reward: 1 } }
				);

				// Prepare dropdown options for store types
				let options = {
					collections: [
						{
							collection: TABLE_MASTERS,
							columns: ["_id", "name"],
							conditions: { status: ACTIVE, dropdown_type: MASTER_STORE_TYPE },
						}
					]
				};

				// Get dropdown list using async/await
				const response = await getDropdownList(req, res, options);

				// Render listing page
				req.breadcrumbs(BREADCRUMBS['admin/rewards/list']);
				res.render("manage_rewards/list", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					completeReward: (userResult && userResult.complete_profile_reward) ? userResult.complete_profile_reward : {},
					store_type_name: (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
				});
			}
		} catch (err) {
			// Handle errors and send error response
			console.error("Error in getRewardsList:", err);
			if (isPost(req)) {
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			} else {
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	};

	/**
	 * Function for add rewards
	 *
	 * @param req 	As	Request Data
	 * @param res 	As	Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.addRewards = async (req, res) => {
		try {
			let userId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";

			// Validate userType and userId
			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			if (isPost(req)) {
				// Sanitize Data
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
				let heading = (req.body.heading) ? req.body.heading : "";
				let subHeading = (req.body.sub_heading) ? req.body.sub_heading : "";
				let description = (req.body.description) ? req.body.description : "";
				let toogleExpiryDate = (req.body.toogle_expiry_date) ? true : false;
				let image = (req.files && req.files.image) ? req.files.image : "";
				let expiryDate = formatNumber(req.body.dd) + "-" + formatNumber(req.body.mm) + "-" + (req.body.yy);
				let storeTypeIds = (req.body.store_type_id) ? JSON.parse(req.body.store_type_id) : [];

				let storeTypeIdsArray = [];
				if (storeTypeIds.length > 0) {
					storeTypeIds.forEach(recordsIds => {
						storeTypeIdsArray.push(newObjectIdDefault(recordsIds));
					});
				}

				let errMessageArray = [];

				// Upload image using async/await
				let options = {
					'image': image,
					'filePath': LEADS_FORM_FILE_PATH,
				};

				let response = await moveUploadedFile(req, res, options);

				// Handle image upload error
				if (response.status == STATUS_ERROR) {
					errMessageArray.push({ 'param': 'image', 'msg': response.message });
				}
				let imageName = (response.fileName) ? response.fileName : "";

				// Send error message if any
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Prepare reward data for insertion
				let packageRewardData = {
					'user_id': newObjectIdDefault(userId),
					'lead_forms_id': "",
					'reward_text': heading,
					'reward_sub_heading': subHeading,
					'graphic_image': imageName,
					'graphic_type': UPLOAD_IMAGE,
					'url_attach': "",
					'url_title': "",
					'url_desc': description,
					'result_no': DEFAULT_ZERO,
					'is_active': ACTIVE,
					'type': REWARDS_ADMIN_ADD,
					'store_type_id': storeTypeIdsArray,
					'expiry_date': (toogleExpiryDate) ? ageUtcDate(expiryDate) : "",
					'toogle_expiry_date': toogleExpiryDate
				};

				// Insert reward using async/await
				await addPackageReward(packageRewardData);

				// Send success response
				req.flash(STATUS_SUCCESS, res.__("front.rewards.rewards_has_been_added_successfully"));
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/' + userId,
					message: res.__("front.rewards.rewards_has_been_added_successfully")
				});
			} else {
				// Get store type data using async/await
				const storeTypeData = await db.collection(TABLE_MASTERS)
					.find({ status: ACTIVE, dropdown_type: MASTER_STORE_TYPE }, { projection: { _id: 1, name: 1 } })
					.toArray();

				// Render add page
				req.breadcrumbs(BREADCRUMBS['admin/rewards/add']);
				return res.render("manage_rewards/add", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					storeTypeData: storeTypeData
				});
			}
		} catch (err) {
			// Handle errors and send error response
			console.error("Error in addRewards:", err);
			if (isPost(req)) {
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: "system", msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			} else {
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	};

	/**
	 * Function for edit rewards
	 *
	 * @param req 	As	Request Data
	 * @param res 	As	Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.editReward = async (req, res) => {
		let rewardId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		if (!userType || !userId || !rewardId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			try {
				// Sanitize Data
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
				let heading = (req.body.heading) ? req.body.heading : "";
				let subHeading = (req.body.sub_heading) ? req.body.sub_heading : "";
				let description = (req.body.description) ? req.body.description : "";
				let toogleExpiryDate = (req.body.toogle_expiry_date) ? true : false;
				let oldimage = (req.body.old_image) ? req.body.old_image : "";
				let image = (req.files && req.files.image) ? req.files.image : "";
				let expiryDate = formatNumber(req.body.dd) + "-" + formatNumber(req.body.mm) + "-" + (req.body.yy);
				let storeTypeIds = (req.body.store_type_id) ? JSON.parse(req.body.store_type_id) : [];

				let storeTypeIdsArray = [];
				if (storeTypeIds.length > 0) {
					storeTypeIds.map(recordsIds => {
						storeTypeIdsArray.push(newObjectIdDefault(recordsIds));
					});
				}

				let errMessageArray = [];

				// Upload image using async/await
				let options = {
					'image': image,
					'filePath': LEADS_FORM_FILE_PATH,
					'oldPath': oldimage
				};
				const response = await moveUploadedFile(req, res, options);

				// Handle image upload error
				if (response.status == STATUS_ERROR) {
					errMessageArray.push({ 'param': 'image', 'msg': response.message });
				}
				let imageName = (response.fileName) ? response.fileName : "";

				// Send error message if any
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Prepare reward data for update
				let packageRewardData = {
					'reward_text': heading,
					'reward_sub_heading': subHeading,
					'graphic_image': imageName,
					'url_desc': description,
					'store_type_id': storeTypeIdsArray,
					'expiry_date': (toogleExpiryDate) ? ageUtcDate(expiryDate) : "",
					'toogle_expiry_date': toogleExpiryDate
				};

				// Update reward using async/await
				await db.collection(TABLE_REWARDS).updateOne(
					{ _id: newObjectIdDefault(rewardId) },
					{ $set: packageRewardData }
				);

				// Update related user reward data after reward update
				let editedOptionRewards = {
					'user_id': userId,
					'reward_id': rewardId,
					'reward_slug': "",
				};
				await earnSentRewardUpdate(editedOptionRewards);

				// Send success response
				req.flash(STATUS_SUCCESS, res.__("front.rewards.rewards_has_been_updated_successfully"));
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/' + userId,
					message: res.__("front.rewards.rewards_has_been_updated_successfully")
				});
			} catch (err) {
				// Handle errors and send error response
				console.error("Error in editReward (POST):", err);
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: "system", msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		} else {
			try {
				// Get store type data and reward details in parallel
				const [storeTypeData, rewardResult] = await Promise.all([
					db.collection(TABLE_MASTERS)
						.find({ status: ACTIVE, dropdown_type: MASTER_STORE_TYPE }, { projection: { _id: 1, name: 1 } })
						.toArray(),
					db.collection(TABLE_REWARDS)
						.findOne({ _id: rewardId })
				]);

				// Convert mongo date to simple date if expiry is toggled
				if (rewardResult && rewardResult.toogle_expiry_date === true && rewardResult.expiry_date != '') {
					let expiryDateConvert = mongoDatetoSimpleDateConvert(rewardResult.expiry_date);
					rewardResult['dd'] = expiryDateConvert.dd;
					rewardResult['mm'] = expiryDateConvert.mm;
					rewardResult['yy'] = expiryDateConvert.yy;
				}

				// Render edit page
				req.breadcrumbs(BREADCRUMBS['admin/rewards/edit']);
				return res.render("manage_rewards/edit", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					rewardResult: rewardResult ? rewardResult : {},
					storeTypeData: storeTypeData
				});
			} catch (err) {
				// Handle errors and send error response
				console.error("Error in editReward (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // End editReward()

	/**
	 * Function for updating status or deleting a reward
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Next Middleware Function
	 *
	 * @return render/json
	 */
	this.rewardDeleteAndStatus = async (req, res, next) => {
		// Extract parameters from request
		const rewardsId = req.params.id ? req.params.id : '';
		const recordStatus = req.params.status ? req.params.status : '';
		const statusType = req.params.status_type ? req.params.status_type : '';

		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";

		let updateData = {};

		// Validate required parameters
		if (rewardsId && statusType && recordStatus) {
			try {
				// Check if reward is already assigned before delete/update
				const response = await assignRewardsAfterDeleteCheck(req, res, userId, rewardsId);

				if (response.status == STATUS_ERROR) {
					req.flash(STATUS_ERROR, response.message);
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/' + userId);
				}

				// Prepare update data based on status type
				if (statusType == ACTIVE_INACTIVE_STATUS) {
					updateData['is_active'] = (recordStatus == ACTIVE) ? DEACTIVE : ACTIVE;
					updateData['modified'] = getUtcDate();
				}

				if (statusType == DELETE_STATUS) {
					updateData['is_deleted'] = DELETED;
					updateData['modified'] = getUtcDate();
				}

				// Update reward status in the database
				const collection = db.collection(TABLE_REWARDS);
				await collection.updateOne(
					{ _id: newObjectIdDefault(rewardsId) },
					{ $set: updateData }
				);

				// Send success response
				if (statusType == ACTIVE_INACTIVE_STATUS) {
					const messageStatus = (recordStatus == DEACTIVE)
						? res.__("front.reward.reward_has_been_activeted_successfully")
						: res.__("front.reward.reward_has_been_deactivated_successfully");
					req.flash(STATUS_SUCCESS, messageStatus);
				}

				if (statusType == DELETE_STATUS) {
					req.flash(STATUS_SUCCESS, res.__("front.reward.reward_has_been_deleted_successfully"));
				}

				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/' + userId);

			} catch (err) {
				// Handle errors and pass to next middleware
				console.error("Error in rewardDeleteAndStatus:", err);
				return next(err);
			}
		} else {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/' + userId);
		}
	}; // end rewardDeleteAndStatus()

	/**
	 * Function for user delete reward image
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.deleteRewardImage = async (req, res) => {
		try {
			// Extract and validate parameters
			let rewardId = (req.params.id) ? newObjectIdDefault(req.params.id) : "";
			let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";

			// Send error response if any required parameter is missing
			if (!userType || !userId || !rewardId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(
					WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/edit/' + rewardId + "/" + userId
				);
			}

			// Fetch reward data using async/await
			const rewardResult = await db.collection(TABLE_REWARDS).findOne(
				{ _id: rewardId },
				{ projection: { graphic_image: 1 } }
			);

			if (rewardResult) {
				// Get the reward image name if exists
				let rewardImageName = rewardResult.graphic_image ? rewardResult.graphic_image : "";

				// Prepare options for deleting the image
				let optionImage = {
					'reward_id': rewardId,
					'user_id': userId,
					'image_name': rewardImageName,
				};

				// Delete image using async/await
				const response = await deleteImageForReward(req, res, optionImage);

				if (response.status == STATUS_SUCCESS) {
					// Send success response
					req.flash(STATUS_SUCCESS, response.message);
				} else {
					// Send error response
					req.flash(STATUS_ERROR, response.message);
				}
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/edit/' + rewardId + "/" + userId);
			} else {
				// Send error response if reward not found
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(
					WEBSITE_ADMIN_URL + "users/" + userType + '/manage_rewards/edit/' + rewardId + "/" + userId
				);
			}
		} catch (err) {
			// Handle errors and send error response
			console.error("Error in deleteRewardImage:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + (req.params.user_type || "") + '/manage_rewards/edit/' + (req.params.id || "") + "/" + (req.params.user_id || ""));
		}
	}; // end deleteRewardImage()
}
module.exports = new Rewards();
