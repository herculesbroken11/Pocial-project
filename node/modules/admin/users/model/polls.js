const async = require("async");

function Polls() {

	/**
	 * Function to get list of polls
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.getPollList = async (req, res) => {
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		// Validate user type and user id
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Handle AJAX/datatable request for poll listing
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";

			const collection = db.collection(TABLE_POLLS);

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common query conditions
				let commonConditions = {
					"is_deleted": NOT_DELETED,
					"user_id": newObjectIdDefault(userId)
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Prepare aggregation pipeline for poll list
				const pollListPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$lookup: {
							from: TABLE_CATEGORIES,
							let: { categoryId: "$category_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$_id", "$$categoryId"] },
											]
										},
									}
								},
								{ "$project": { name: 1 } }
							],
							as: "catDetails"
						}
					},
					{
						$project: {
							"question": 1,
							"options_type": 1,
							"is_deleted": 1,
							"is_draft": 1,
							"custom_url": 1,
							"is_published": 1,
							"slug": 1,
							"created": 1,
							"total_count": 1,
							"category_id": 1,
							"end_voting_period": 1,
							"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Run queries in parallel using Promise.all
				const [pollList, totalRecords, filteredRecords] = await Promise.all([
					collection.aggregate(pollListPipeline).toArray(),
					collection.countDocuments(commonConditions),
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: pollList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// Handle errors and send error response
				console.error("Error in getPollList:", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render poll listing page with dropdowns
			try {
				req.breadcrumbs(BREADCRUMBS["admin/polls/list"]);
				let options = {
					collections: [
						{
							collection: TABLE_CATEGORIES,
							columns: ["_id", "name"],
							conditions: { status: ACTIVE, is_deleted: NOT_DELETED },
						}
					]
				};
				const response = await getDropdownList(req, res, options);
				res.render("polls/list", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					categoryList: (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
				});
			} catch (err) {
				console.error("Error rendering poll listing page:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end getPollList()

	/**
	 * Function used to add poll questions and options
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.addPollsQuestionAndOptions = async (req, res) => {
		// Extract and validate parameters
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const pollsSlug = req.params.slug ? req.params.slug : "";
		const editSlug = req.params.edit_slug ? req.params.edit_slug : "";
		let scheduleFlag = req.params.schedule_flag ? req.params.schedule_flag : "";
		scheduleFlag = !!scheduleFlag;

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Attach user and poll slug to request body
			req.body.user_id = userId;
			req.body.poll_slug = pollsSlug;

			try {
				// Create poll question and options using async/await
				const response = await createPollsQuestionAndOptions(req, res);

				if (response.status === STATUS_ERROR) {
					return res.send({
						status: STATUS_ERROR,
						redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${response.slug}/${editSlug}`,
						message: response.message,
					});
				} else {
					req.flash(STATUS_SUCCESS, response.message);
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${response.slug}/${editSlug}`,
						message: response.message,
					});
				}
			} catch (err) {
				console.error("Error in addPollsQuestionAndOptions (POST):", err);
				return res.send({
					status: STATUS_ERROR,
					redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollsSlug}/${editSlug}`,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// Render add/edit poll question and options page
			const bredcrumbSlug = editSlug ? "edit" : "add";
			req.breadcrumbs(BREADCRUMBS["admin/polls/" + bredcrumbSlug]);

			try {
				// Fetch poll draft details
				const resultPolls = await db.collection(TABLE_POLLS).findOne({ user_id: userId, slug: pollsSlug });

				// If poll draft not found, show error and redirect
				if (!resultPolls) {
					req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
					return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				}

				// Convert schedule_poll date if present
				if (resultPolls.schedule_poll) {
					const dobConvert = mongoDatetoSimpleDateConvert(resultPolls.schedule_poll);
					resultPolls.schedule_date = dobConvert.dd;
					resultPolls.schedule_month = dobConvert.mm;
					resultPolls.schedule_year = dobConvert.yy;
				}

				// Prepare options array if present
				if (resultPolls.options && resultPolls.options.length > 0) {
					resultPolls.options_array = resultPolls.options.map(({ title }) => title.toUpperCase());
				}

				// Fetch category list, reward list, and store type data in parallel
				const [categoryArray, resultReward, storeTypeData] = await Promise.all([
					// Get category array list
					db.collection(TABLE_CATEGORIES)
						.find({ is_deleted: NOT_DELETED }, { projection: { _id: 1, name: 1 } })
						.toArray(),
					// Get reward dropdown list
					db.collection(TABLE_REWARDS)
						.find({ user_id: userId, is_deleted: NOT_DELETED }, { projection: { _id: 1, reward_text: 1 } })
						.sort({ created: SORT_DESC })
						.toArray(),
					// Get store type data
					db.collection(TABLE_MASTERS)
						.find({ status: ACTIVE, dropdown_type: MASTER_STORE_TYPE }, { projection: { _id: 1, name: 1 } })
						.toArray()
				]);

				// Render the add/edit poll page with fetched data
				return res.render("polls/add", {
					user_type: userType,
					user_id: userId,
					slug: pollsSlug,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					resultReward: resultReward || [],
					categoryArray: categoryArray || [],
					result_polls_draft: resultPolls || {},
					editSlug: editSlug || "",
					scheduleFlag: scheduleFlag,
					storeTypeData: storeTypeData || []
				});
			} catch (err) {
				console.error("Error in addPollsQuestionAndOptions (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end addPollsQuestionAndOptions()

	/**
	 * Function to create polls
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.createPolls = async (req, res) => {
		// Extract and validate parameters
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let pollsSlug = (req.params.slug) ? req.params.slug : "";
		let editSlug = (req.params.edit_slug) ? req.params.edit_slug : "";
		let scheduleFlag = (req.params.schedule_flag) ? req.params.schedule_flag : "";
		scheduleFlag = (scheduleFlag) ? true : false;

		if (!userType || !userId || !pollsSlug) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			let oldSponsoredLogo = (req.body.old_sponsored_logo) ? req.body.old_sponsored_logo : "";
			let sponsoredLogo = (req.files && req.files.sponsored_logo) ? req.files.sponsored_logo : "";

			let errMessageArray = [];
			let options = {
				'image': sponsoredLogo,
				'filePath': POLLS_FILE_PATH,
				'oldPath': oldSponsoredLogo
			};

			try {
				// Handle file upload using async/await
				const uploadResponse = await moveUploadedFile(req, res, options);

				if (uploadResponse.status == STATUS_ERROR) {
					// Send error response for file upload
					errMessageArray.push({ 'param': 'sponsoring_logo', 'msg': uploadResponse.message });
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Parse and validate poll options and related fields
				let pollsOptionsLength = (req.body.polls_options_length) ? Number(req.body.polls_options_length) : 0;

				let ctaTitle = (req.body.cta_title) ? req.body.cta_title : "";
				ctaTitle = (ctaTitle && typeof (ctaTitle) == 'string') ? JSON.parse(ctaTitle) : ctaTitle;

				let ctaUrl = (req.body.cta_url) ? req.body.cta_url : "";
				ctaUrl = (ctaUrl && typeof (ctaUrl) == 'string') ? JSON.parse(ctaUrl) : ctaUrl;

				let assignReward = (req.body.assign_reward) ? req.body.assign_reward : "";
				assignReward = (assignReward && typeof (assignReward) == 'string') ? JSON.parse(assignReward) : assignReward;

				let enticementHeadline = (req.body.enticement_headline) ? req.body.enticement_headline : "";
				enticementHeadline = (enticementHeadline && typeof (enticementHeadline) == 'string') ? JSON.parse(enticementHeadline) : enticementHeadline;

				// Validate CTA link and CTA title
				if (pollsOptionsLength > 0 && ctaTitle.length > 0 && ctaUrl.length > 0) {
					for (let i = 0; i < pollsOptionsLength; i++) {
						if (ctaTitle[i] != '' || ctaUrl[i] != '') {
							// CTA title validation
							if (ctaTitle[i] == null || ctaTitle[i] == '') {
								errMessageArray.push({ 'param': 'cta_title' + i, 'msg': res.__("admin.polls.please_enter_cta_title") });
							}
							// CTA URL validation
							if (ctaUrl[i] == null || ctaUrl[i] == '') {
								errMessageArray.push({ 'param': 'cta_url' + i, 'msg': res.__("admin.polls.please_enter_cta_url") });
							}
							// CTA URL regex validation
							if (ctaUrl[i] != '' && !checkValidURL(ctaUrl[i])) {
								errMessageArray.push({ 'param': 'cta_url' + i, 'msg': res.__("admin.polls.invalid_url") });
							}
						}
					}
				}

				// Validate assign reward and enticement headline
				if (pollsOptionsLength > 0 && assignReward.length > 0 && enticementHeadline.length > 0) {
					for (let i = 0; i < pollsOptionsLength; i++) {
						if (assignReward[i] != '' || enticementHeadline[i] != '') {
							// Reward assign validation
							if (assignReward[i] == null || assignReward[i] == '') {
								errMessageArray.push({ 'param': 'assign_reward' + i, 'msg': res.__("admin.polls.please_select_reward") });
							}
							// Enticement headline validation
							if (enticementHeadline[i] == null || enticementHeadline[i] == '') {
								errMessageArray.push({ 'param': 'enticement_headline' + i, 'msg': res.__("admin.polls.please_enticement_headline") });
							}
							// Enticement headline length validation
							if (enticementHeadline[i] != '' && enticementHeadline[i].length >= ENHANCEMENTS_HEADLINE_LIMIT) {
								errMessageArray.push({ 'param': 'enticement_headline' + i, 'msg': res.__("admin.polls.enticement_headline_should_be_maximum_limit", ENHANCEMENTS_HEADLINE_LIMIT) });
							}
						}
					}
				}

				// Send error data if any validation failed
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Prepare data for poll creation
				req.body.sponsored_logo = (uploadResponse.fileName) ? uploadResponse.fileName : "";
				req.body.user_id = userId;
				req.body.poll_slug = pollsSlug;

				let redirectUrl = WEBSITE_ADMIN_URL + "users/" + userType + "/polls/add/" + userId + "/" + pollsSlug + "/" + editSlug;
				if (scheduleFlag) {
					redirectUrl = WEBSITE_ADMIN_URL + "users/" + userType + "/polls/add/" + userId + "/" + pollsSlug + "/" + editSlug + '/' + scheduleFlag;
				}

				// Create poll data using async/await
				const createResponse = await createPollsAllData(req, res);

				if (createResponse.status == STATUS_ERROR) {
					return res.send({
						status: STATUS_ERROR,
						redirect_url: redirectUrl,
						message: createResponse.message,
					});
				} else {
					req.flash(STATUS_SUCCESS, createResponse.message);
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: redirectUrl,
						message: createResponse.message,
					});
				}
			} catch (err) {
				console.error("Error in createPolls:", err);
				return res.send({
					status: STATUS_ERROR,
					message: [{ msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		}
	}; // end createPolls()

	/**
	 * Function to delete Polls Media using async/await
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.deletePollsMedia = async (req, res) => {
		// Extract and validate parameters
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const draftId = req.params.draft_id ? newObjectIdDefault(req.params.draft_id) : "";
		const deleteType = req.params.delete_type ? req.params.delete_type : "";
		const draftOptionsId = req.params.draft_options_id ? req.params.draft_options_id : "";
		const editSlug = req.params.edit_slug ? req.params.edit_slug : "";

		// Validate required parameters
		if (!userType || !userId || !draftId || !deleteType) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}`);
		}

		// Prepare options for deletePollsMedia
		const optionsImage = {
			user_id: userId,
			draft_id: draftId,
			delete_type: deleteType,
			draft_options_id: draftOptionsId,
		};

		try {
			// Call deletePollsMedia using async/await
			const deleteResponse = await deletePollsMedia(req, res, optionsImage);

			if (deleteResponse.status === STATUS_SUCCESS) {
				// Send success response and redirect to add poll page
				req.flash(STATUS_SUCCESS, deleteResponse.message);
				return res.redirect(
					`${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${deleteResponse.poll_slug}/${editSlug}`
				);
			} else {
				// Send error response and redirect to polls list
				req.flash(STATUS_ERROR, deleteResponse.message);
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/${userId}`);
			}
		} catch (err) {
			// Handle unexpected errors
			console.error("Error in deletePollsMedia:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/${userId}`);
		}
	}; // end deletePollsMedia()

	/**
	 * Function to delete all Polls options using async/await
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.deleteAllPollsOptions = async (req, res) => {
		// Extract and validate parameters
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const draftId = req.params.draft_id ? newObjectIdDefault(req.params.draft_id) : "";
		const editSlug = req.body.edit_slug ? req.body.edit_slug : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";

		// Validate required parameters
		if (!userId || !draftId) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.send({
				status: STATUS_ERROR,
				redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
				message: res.__("admin.system.invalid_access")
			});
		}

		try {
			// Call deleteAllPollsOptions using async/await
			const deleteAllResponse = await deleteAllPollsOptions(req, res, draftId);

			// Set flash message based on response status
			req.flash(deleteAllResponse.status, deleteAllResponse.message);

			// Send success response with redirect URL
			return res.send({
				status: STATUS_SUCCESS,
				redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
				message: deleteAllResponse.message
			});
		} catch (err) {
			// Handle unexpected errors
			console.error("Error in deleteAllPollsOptions:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.send({
				status: STATUS_ERROR,
				redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	}; // end deleteAllPollsOptions()

	/**
	 * Function to delete a poll (with async/await)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.deletePoll = async (req, res) => {
		// Extract and validate parameters
		const pollId = req.params.id ? req.params.id : '';
		const recordStatus = req.params.status ? req.params.status : '';
		const statusType = req.params.status_type ? req.params.status_type : '';
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";

		// Check for required parameters
		if (pollId && statusType && recordStatus) {
			// Prepare options for delete/status update
			const sendDataOptions = {
				poll_id: pollId,
				status_type: statusType,
				user_id: userId,
				record_status: recordStatus
			};

			try {
				// Call deleteAndStatusUpdate using async/await
				const deleteAllResponse = await deleteAndStatusUpdate(req, res, sendDataOptions);

				// Handle redirect and flash messages based on delete type and response
				if (recordStatus == REPORT_WISE_DELETE_POLL) {
					// Redirect to poll abuse reports if deleted via report
					req.flash(STATUS_SUCCESS, deleteAllResponse.message);
					return res.redirect(WEBSITE_ADMIN_URL + "poll_abuse_reports");
				} else {
					if (deleteAllResponse.status == STATUS_SUCCESS) {
						// Success: redirect to poll list
						req.flash(STATUS_SUCCESS, deleteAllResponse.message);
						return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/${userId}`);
					} else {
						// Error: redirect to poll list with error message
						req.flash(STATUS_ERROR, deleteAllResponse.message);
						return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/${userId}`);
					}
				}
			} catch (err) {
				// Handle unexpected errors
				console.error("Error in deletePoll:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/${userId}`);
			}
		} else {
			// Missing required parameters: send error response
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/polls/${userId}`);
		}
	}; // end deletePoll()

	/**
	 * Function to get poll comments details (parent and child comments)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.commentPollDetails = async (req, res) => {
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : '';
		const pollSlug = req.params.slug ? req.params.slug : '';
		const userType = req.params.user_type ? req.params.user_type : "";
		const commentId = req.params.comment_id ? newObjectIdDefault(req.params.comment_id) : "";
		const pollComment = db.collection(TABLE_POLLS_COMMENTS);

		if (isPost(req)) {
			// Handle AJAX/datatable request for poll comments listing
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;
			const fromDate = req.body.fromDate ? req.body.fromDate : "";
			const toDate = req.body.toDate ? req.body.toDate : "";

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Set base query conditions
				let conditions = {
					parent_id: DEFAULT_ZERO,
					is_deleted: NOT_DELETED,
					poll_slug: pollSlug,
				};

				// If commentId is provided, fetch replies for that comment
				if (commentId) {
					conditions['parent_id'] = commentId;
				}

				// Merge with datatable conditions
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, conditions);

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Prepare aggregation pipeline for comments list
				const commentsPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						// Lookup user details for each comment
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
								{ $project: { full_name: 1, slug: 1, profile_image: 1 } }
							],
							as: "userDetails"
						}
					},
					{
						// Lookup child comment count for each comment
						$lookup: {
							from: TABLE_POLLS_COMMENTS,
							let: { parentId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$parent_id", "$$parentId"] },
												{ $eq: ["$is_deleted", NOT_DELETED] },
											]
										},
									}
								},
								{ $group: { _id: null, count: { $sum: 1 } } }
							],
							as: "childCommnetTotalCount"
						}
					},
					{
						// Project required fields and flatten user/child comment info
						$project: {
							comment: 1,
							poll_id: 1,
							poll_slug: 1,
							parent_id: 1,
							user_id: 1,
							created: 1,
							is_like: 1,
							is_dislike: 1,
							slug: 1,
							user_profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
							user_full_name: { $arrayElemAt: ["$userDetails.full_name", 0] },
							user_slug: { $arrayElemAt: ["$userDetails.slug", 0] },
							child_comment_count: {
								$cond: [
									{ $arrayElemAt: ["$childCommnetTotalCount.count", 0] },
									{ $arrayElemAt: ["$childCommnetTotalCount.count", 0] },
									0
								]
							},
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Run queries in parallel using Promise.all
				const [commentsList, totalRecords, filteredRecords] = await Promise.all([
					pollComment.aggregate(commentsPipeline).toArray(),
					pollComment.countDocuments(conditions),
					pollComment.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: commentsList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				console.error("Error in commentPollDetails (POST):", err);
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render comments list page with total comment count (parent and child)
			const conditionsCount = {
				is_deleted: NOT_DELETED,
				poll_slug: pollSlug,
			};

			try {
				const countResult = await pollComment.countDocuments(conditionsCount);

				req.breadcrumbs(BREADCRUMBS["admin/polls/comment_list"]);
				return res.render("polls/comments_list", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					poll_slug: pollSlug,
					comment_id: commentId,
					total_records: countResult
				});
			} catch (err) {
				console.error("Error rendering comments_list page:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end commentPollDetails()

	/**
	 * Function to delete a comment
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.commentDelete = async (req, res) => {
		// Extract and validate parameters
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const commentId = req.params.comment_id ? newObjectIdDefault(req.params.comment_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const pollSlug = req.params.poll_slug ? req.params.poll_slug : "";
		const pageType = req.params.page_type ? req.params.page_type : "";

		// Check for required parameters
		if (userId && commentId && userType && pollSlug) {
			// Prepare options for comment deletion
			const sendDeleteOptions = {
				comment_id: commentId
			};

			try {
				// Call the function to delete the comment using async/await
				const deleteResponse = await userCommentDelete(req, res, sendDeleteOptions);

				if (deleteResponse.status === STATUS_SUCCESS) {
					// Send success response and redirect accordingly
					req.flash(STATUS_SUCCESS, deleteResponse.message);
					if (pageType === REPORT_WISE_DELETE_POLL_COMMENTS) {
						return res.redirect(WEBSITE_ADMIN_URL + "poll_comments_abuse_reports");
					} else {
						return res.redirect(
							WEBSITE_ADMIN_URL + "users/" + userType + "/polls/comment_poll_details/" + userId + "/" + pollSlug
						);
					}
				} else {
					// Send error response and redirect accordingly
					req.flash(STATUS_ERROR, deleteResponse.message);
					if (pageType === REPORT_WISE_DELETE_POLL_COMMENTS) {
						return res.redirect(WEBSITE_ADMIN_URL + "poll_comments_abuse_reports");
					} else {
						return res.redirect(
							WEBSITE_ADMIN_URL + "users/" + userType + "/polls/comment_poll_details/" + userId + "/" + pollSlug
						);
					}
				}
			} catch (err) {
				// Handle unexpected errors
				console.error("Error in commentDelete:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				if (pageType === REPORT_WISE_DELETE_POLL_COMMENTS) {
					return res.redirect(WEBSITE_ADMIN_URL + "poll_comments_abuse_reports");
				} else {
					return res.redirect(
						WEBSITE_ADMIN_URL + "users/" + userType + "/polls/comment_poll_details/" + userId + "/" + pollSlug
					);
				}
			}
		} else {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			if (pageType === REPORT_WISE_DELETE_POLL_COMMENTS) {
				return res.redirect(WEBSITE_ADMIN_URL + "poll_comments_abuse_reports");
			} else {
				return res.redirect(
					WEBSITE_ADMIN_URL + "users/" + userType + "/polls/comment_poll_details/" + userId + "/" + pollSlug
				);
			}
		}
	}; // end commentDelete()

	/**
	 * Function to get participants list for a poll
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.participantsList = async (req, res) => {
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let pollSlug = (req.params.poll_slug) ? req.params.poll_slug : "";

		if (!userType || !userId || !pollSlug) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = (req.body.fromDate) ? req.body.fromDate : "";
			let toDate = (req.body.toDate) ? req.body.toDate : "";

			const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

			try {
				// Get datatable config
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common conditions for all queries
				let commonConditions = {
					'make_poll_user_id': newObjectIdDefault(userId),
					'user_id': { $nin: [null, ""] },
					'poll_slug': pollSlug
				};

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Handle account type mapping for search
				if (dataTableConfig.conditions.account_type != "") {
					if (dataTableConfig['conditions']['account_type'] == BASIC_USERS) {
						dataTableConfig['conditions']['account_type'] = NORMAL_USER_ACCOUNT_TYPE;
					}
					if (dataTableConfig['conditions']['account_type'] == BUSSINESS_USERS) {
						dataTableConfig['conditions']['account_type'] = BUSSINESS_USER_ACCOUNT_TYPE;
					}
					if (dataTableConfig['conditions']['account_type'] == PUBLIC_BUSSINESS_USERS) {
						dataTableConfig['conditions']['account_type'] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
					}
				}

				// Add date range filter if provided
				if (fromDate != "" && toDate != "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Prepare aggregation pipeline for participants list
				const participantsPipeline = [
					{ $match: commonConditions },
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
								{ $project: { "_id": 1, "full_name": 1, "profile_image": 1, "slug": 1, "account_type": 1, "email": 1 } }
							],
							as: "user_details"
						}
					},
					{
						$group: {
							_id: "$user_id",
							'user_id': { $first: "$user_id" },
							'poll_slug': { $first: "$poll_slug" },
							'make_poll_user_id': { $first: "$make_poll_user_id" },
							'created': { $first: "$created" },
							'user_full_name': { $first: { $arrayElemAt: ["$user_details.full_name", 0] } },
							'user_profile_image': { $first: { $arrayElemAt: ["$user_details.profile_image", 0] } },
							'user_email': { $first: { $arrayElemAt: ["$user_details.email", 0] } },
							'user_slug': { $first: { $arrayElemAt: ["$user_details.slug", 0] } },
							'account_type': { $first: { $arrayElemAt: ["$user_details.account_type", 0] } },
						}
					},
					{ $match: dataTableConfig.conditions },
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit }
				];

				// Prepare aggregation pipeline for total records
				const totalRecordsPipeline = [
					{ $match: commonConditions },
					{
						$group: {
							_id: "$user_id"
						}
					}
				];

				// Prepare aggregation pipeline for filtered records
				const filteredRecordsPipeline = [
					{ $match: commonConditions },
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
								{ $project: { "_id": 1, "full_name": 1, "profile_image": 1, "slug": 1, "account_type": 1, "email": 1 } }
							],
							as: "user_details"
						}
					},
					{
						$group: {
							_id: "$user_id",
							'user_id': { $first: "$user_id" },
							'poll_slug': { $first: "$poll_slug" },
							'make_poll_user_id': { $first: "$make_poll_user_id" },
							'created': { $first: "$created" },
							'user_full_name': { $first: { $arrayElemAt: ["$user_details.full_name", 0] } },
							'user_profile_image': { $first: { $arrayElemAt: ["$user_details.profile_image", 0] } },
							'user_email': { $first: { $arrayElemAt: ["$user_details.email", 0] } },
							'user_slug': { $first: { $arrayElemAt: ["$user_details.slug", 0] } },
							'account_type': { $first: { $arrayElemAt: ["$user_details.account_type", 0] } },
						}
					},
					{ $match: dataTableConfig.conditions }
				];

				// Run all queries in parallel using Promise.all
				const [
					participantsList,
					totalRecordsArr,
					filteredRecordsArr
				] = await Promise.all([
					// Get participants list with pagination and filters
					pollVoteParticipants.aggregate(participantsPipeline).toArray(),
					// Get total number of unique participants
					pollVoteParticipants.aggregate(totalRecordsPipeline).toArray(),
					// Get filtered number of unique participants
					pollVoteParticipants.aggregate(filteredRecordsPipeline).toArray()
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: participantsList || [],
					recordsFiltered: filteredRecordsArr ? filteredRecordsArr.length : 0,
					recordsTotal: totalRecordsArr ? totalRecordsArr.length : 0
				});
			} catch (err) {
				console.error("Error in participantsList:", err);
				res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render participants listing page
			req.breadcrumbs(BREADCRUMBS["admin/polls/participants"]);
			res.render("polls/participants", {
				'user_type': userType,
				'user_id': userId,
				'poll_slug': pollSlug,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
			});
		}
	}; // end participantsList()

	/**
	 * Function to save a single poll option (async/await version)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.singlePollNext = async (req, res) => {
		// Extract and validate parameters
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const pollSlug = req.params.poll_slug ? req.params.poll_slug : "";
		const editSlug = req.params.edit_slug ? req.params.edit_slug : "";

		if (!userType || !userId || !pollSlug) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// Prepare option data for saving
		const optionData = {
			poll_slug: pollSlug,
			user_id: userId,
		};

		try {
			// Save single poll option using async/await
			const response = await singlePollSaveNextFunctionalitySave(req, res, optionData);

			if (response.status === STATUS_SUCCESS) {
				// Send success response
				req.flash(STATUS_SUCCESS, response.message);
				return res.send({
					status: STATUS_SUCCESS,
					message: response.message,
					redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
				});
			} else {
				// Send error response
				req.flash(STATUS_ERROR, response.message);
				return res.send({
					status: STATUS_ERROR,
					message: response.message,
					redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
				});
			}
		} catch (err) {
			// Handle unexpected errors
			console.error("Error in singlePollNext:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
				redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
			});
		}
	}; // end singlePollNext()

	/**
	 * Function to edit poll option text using async/await
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.editOptionText = async (req, res) => {
		// Extract and validate parameters
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const pollSlug = req.params.poll_slug ? req.params.poll_slug : "";
		const editSlug = req.params.edit_slug ? req.params.edit_slug : "";
		const optionId = req.body.option_id ? req.body.option_id : "";
		const optionTitle = req.body.option_title ? req.body.option_title : "";

		if (!userType || !userId || !pollSlug) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// Prepare data for editing poll option
		const editOptions = {
			poll_slug: pollSlug,
			user_id: userId,
			option_id: optionId,
			title: optionTitle
		};

		try {
			// Call function to edit poll option title using async/await
			const editResponse = await pollOptionTitle(req, res, editOptions);

			req.flash(editResponse.status, editResponse.message);
			return res.send({
				status: editResponse.status,
				message: editResponse.message,
				redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
			});
		} catch (err) {
			// Handle unexpected errors
			console.error("Error in editOptionText:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
				redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`,
			});
		}
	}; // end editOptionText()

	/**
	 * Function to generate poll embed code
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	this.generatePollEmbedCode = async (req, res) => {
		// Extract and validate parameters
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";

		const users = db.collection(TABLE_USERS);

		if (!userType || !userId) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
			const embedName = req.body.embed_name ? req.body.embed_name : "";

			try {
				// Find user details using userId
				const userResult = await users.findOne(
					{ "_id": userId },
					{ projection: { '_id': 1, 'gender': 1, 'account_type': 1 } }
				);

				if (!userResult) {
					// User not found, send error response
					return res.send({
						status: STATUS_ERROR,
						message: res.__("admin.system.invalid_access"),
						result: null,
					});
				}

				// Prepare embed options
				const embedOptions = {
					"poll_slug": pollSlug,
					"user_id": userId,
					"embed_name": embedName,
					"account_type": userResult.account_type ? userResult.account_type : "",
					"gender": userResult.gender ? userResult.gender : "",
					"unique_browser_id": "",
					"is_view_type": "",
				};

				// Save poll embed code using async/await
				const embedResponse = await savePollEmbedCode(req, res, embedOptions);

				// Send response
				return res.send({
					status: embedResponse.status,
					message: embedResponse.message,
					result: embedResponse.result,
				});
			} catch (err) {
				// Handle unexpected errors
				console.error("Error in generatePollEmbedCode:", err);
				return res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
					result: null,
				});
			}
		}
	}; // end generatePollEmbedCode()

	/**
	 * Function to get embed list for a poll
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.pollEmbedList = async (req, res) => {
		// Extract and validate parameters
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const pollSlug = req.params.poll_slug ? req.params.poll_slug : "";

		if (!userType || !userId || !pollSlug) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Parse pagination and filter parameters
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;
			const fromDate = req.body.fromDate ? req.body.fromDate : "";
			const toDate = req.body.toDate ? req.body.toDate : "";

			const pollEmbed = db.collection(TABLE_POLL_EMBED_GENERATE);

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common query conditions
				const commonConditions = {
					'make_poll_user_id': userId,
					'user_id': { $nin: [null, ""] },
					'poll_slug': pollSlug
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Prepare queries to run in parallel
				const embedListPromise = pollEmbed.aggregate([
					{ $match: dataTableConfig.conditions },
					{
						$project: {
							"_id": 1,
							"embed_name": 1,
							"iframe": 1,
							"created": 1
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				]).toArray();

				const totalRecordsPromise = pollEmbed.countDocuments(commonConditions);
				const filteredRecordsPromise = pollEmbed.countDocuments(dataTableConfig.conditions);

				// Run all queries in parallel
				const [embedList, totalRecords, filteredRecords] = await Promise.all([
					embedListPromise,
					totalRecordsPromise,
					filteredRecordsPromise
				]);

				// Send response
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: embedList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// Handle errors and send error response
				console.error("Error in pollEmbedList:", err);
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render embed listing page
			try {
				req.breadcrumbs(BREADCRUMBS["admin/polls/embed_list"]);
				return res.render("polls/embed_list", {
					'user_type': userType,
					'user_id': userId,
					'poll_slug': pollSlug,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
				});
			} catch (err) {
				console.error("Error rendering embed listing page:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end pollEmbedList()

	/**
	 * Function to edit poll end voting period
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * 
	 * @return render/json
	 */
	this.editEndPollVotingPeriod = async (req, res) => {
		// Extract and validate parameters
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const pollId = req.params.poll_id ? newObjectIdDefault(req.params.poll_id) : "";
		// If end_voting_period param is true, we set to false (reopen voting), else set to true (end voting)
		const endVotingPeriod = (req.params.end_voting_period == true || req.params.end_voting_period == 'true') ? false : true;

		if (pollId && userId) {
			// Prepare condition for poll update
			const editCondition = {
				"_id": pollId,
				"user_id": newObjectIdDefault(userId),
			};

			// Prepare update data
			const updateData = {
				'end_voting_period': endVotingPeriod,
				'modified': getUtcDate()
			};

			const polls = db.collection(TABLE_POLLS);

			try {
				// Update poll's end voting period using async/await
				const updateResult = await polls.updateOne(editCondition, { $set: updateData });

				// Check if update was successful
				if (updateResult && updateResult.modifiedCount > 0) {
					// Send success response
					if (endVotingPeriod === true) {
						req.flash(STATUS_SUCCESS, res.__("admin.polls.polls_end_voting_period_updated_successfully"));
					} else {
						req.flash(STATUS_SUCCESS, res.__("admin.polls.polls_start_voting_period_updated_successfully"));
					}
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/polls/' + userId);
				} else {
					// Send error response if no document was modified
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/polls/' + userId);
				}
			} catch (err) {
				// Handle errors and send error response
				console.error("Error in editEndPollVotingPeriod:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/polls/' + userId);
			}
		} else {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/polls/' + userId);
		}
	}; // end editEndPollVotingPeriod()

	/**
	 * Function to add rewards (async/await version)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return json
	 */
	this.addRewardData = async (req, res) => {
		// Extract and validate parameters
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const heading = req.body.heading ? req.body.heading : "";
			const subHeading = req.body.sub_heading ? req.body.sub_heading : "";
			const description = req.body.description ? req.body.description : "";
			const toogleExpiryDate = req.body.toogle_expiry_date ? true : false;
			const image = (req.files && req.files.image) ? req.files.image : "";
			const expiryDate = formatNumber(req.body.dd) + "-" + formatNumber(req.body.mm) + "-" + (req.body.yy);
			const storeTypeIds = req.body.store_type_id ? JSON.parse(req.body.store_type_id) : [];

			// Convert storeTypeIds to ObjectId array
			const storeTypeIdsArray = Array.isArray(storeTypeIds)
				? storeTypeIds.map(recordsIds => newObjectIdDefault(recordsIds))
				: [];

			let errMessageArray = [];

			// Prepare options for image upload
			const options = {
				'image': image,
				'filePath': LEADS_FORM_FILE_PATH,
			};

			try {
				// Upload image using async/await
				const uploadResponse = await moveUploadedFile(req, res, options);

				if (uploadResponse.status === STATUS_ERROR) {
					errMessageArray.push({ 'param': 'image', 'msg': uploadResponse.message });
				}
				const imageName = uploadResponse.fileName ? uploadResponse.fileName : "";

				// If there are errors, send error response
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Prepare reward data for insertion
				const packageRewardData = {
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
					'expiry_date': toogleExpiryDate ? ageUtcDate(expiryDate) : "",
					'toogle_expiry_date': toogleExpiryDate
				};

				// Add reward and fetch the inserted reward document in parallel
				const responseId = await addPackageReward(packageRewardData);

				// Fetch the newly created reward document
				const rewardResult = await db.collection(TABLE_REWARDS).findOne({ _id: newObjectIdDefault(responseId) });

				if (!rewardResult) {
					return res.send({
						status: STATUS_ERROR,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					});
				}

				const rewardData = {
					"_id": rewardResult._id,
					"reward_text": rewardResult.reward_text
				};

				// Send success response
				return res.send({
					status: STATUS_SUCCESS,
					reward_id: rewardData,
					message: res.__("front.rewards.rewards_has_been_added_successfully")
				});
			} catch (err) {
				// Handle unexpected errors
				console.error("Error in addRewardData:", err);
				return res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		}
	}; // end addRewardData()

	/**
	 * Function to edit poll option image or video using async/await
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.editLoopOptionImage = async (req, res) => {
		// Extract and validate parameters
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const pollSlug = req.params.poll_slug ? req.params.poll_slug : "";
		const editSlug = req.params.edit_slug ? req.params.edit_slug : "";

		// Optionally extract files (not used directly here, but could be for validation/logging)
		const pollOptionsImage = (req.files && req.files.options_image) ? req.files.options_image : "";
		const pollOptionsVideo = (req.files && req.files.options_video) ? req.files.options_video : "";

		// Validate required parameters
		if (!userType || !userId || !pollSlug) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Prepare redirect URL for response
		const redirectUrl = `${WEBSITE_ADMIN_URL}users/${userType}/polls/add/${userId}/${pollSlug}/${editSlug}`;

		try {
			// Upload poll media image/video using async/await
			const response = await uploadPollMediaImageVideType(req, res);

			if (response.status === STATUS_ERROR) {
				// Send error response if upload failed
				return res.send({
					status: STATUS_ERROR,
					redirect_url: redirectUrl,
					message: response.message,
				});
			} else {
				// Send success response if upload succeeded
				req.flash(STATUS_SUCCESS, response.message);
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: redirectUrl,
					message: response.message,
				});
			}
		} catch (err) {
			// Handle unexpected errors
			console.error("Error in editLoopOptionImage:", err);
			return res.send({
				status: STATUS_ERROR,
				redirect_url: redirectUrl,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end editLoopOptionImage()
}
module.exports = new Polls();
