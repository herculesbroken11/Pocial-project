const async = require("async");

function PollSets() {

	/**
	 * Function to get list of pollsets using async/await and Promise.all for parallel queries
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.getPollSetsList = async (req, res) => {
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
			let showtoSearch = (req.body.search_by_show_to) ? req.body.search_by_show_to : "";
			let allowretakingSearch = (req.body.search_by_allowretaking) ? req.body.search_by_allowretaking : "";
			let ssoSearch = (req.body.search_by_sso) ? req.body.search_by_sso : "";

			const collection = db.collection(TABLE_POLL_SETS);

			try {
				// Get datatable config
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common conditions
				let commonConditions = {
					"is_deleted": NOT_DELETED,
					"user_id": newObjectIdDefault(userId)
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Date range filter
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Show to filter
				if (showtoSearch !== "") {
					switch (showtoSearch) {
						case SHOW_TO_PUBLIC:
							dataTableConfig.conditions["show_to"] = SHOW_TO_PUBLIC;
							break;
						case SHOW_TO_MY_PAGE_ONLY:
							dataTableConfig.conditions["show_to"] = SHOW_TO_MY_PAGE_ONLY;
							break;
					}
				}

				// Allow retaking filter
				if (allowretakingSearch !== "") {
					switch (allowretakingSearch) {
						case ALLOW_RETAKING_YES:
							dataTableConfig.conditions["allow_retaking"] = ALLOW_RETAKING_YES;
							break;
						case ALLOW_RETAKING_NO:
							dataTableConfig.conditions["allow_retaking"] = ALLOW_RETAKING_NO;
							break;
					}
				}

				// SSO filter
				if (ssoSearch !== "") {
					switch (ssoSearch) {
						case SSO_YES:
							dataTableConfig.conditions["sso"] = SSO_YES;
							break;
						case SSO_NO:
							dataTableConfig.conditions["sso"] = SSO_NO;
							break;
					}
				}

				// Prepare aggregation pipeline for pollsets list
				const pollsetsPipeline = [
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
							"poll_slug": 1,
							"title": 1,
							"category_id": 1,
							"show_to": 1,
							"allow_retaking": 1,
							"sso": 1,
							"sponsoring_logo": 1,
							"slug": 1,
							"is_published": 1,
							"created": 1,
							"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Run queries in parallel using Promise.all
				const [pollsetsList, totalRecords, filteredRecords] = await Promise.all([
					// Get pollsets list
					collection.aggregate(pollsetsPipeline).toArray(),
					// Get total number of records
					collection.countDocuments(commonConditions),
					// Get filtered records count
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: pollsetsList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// Handle errors and send error response
				console.error("Error in getPollSetsList:", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render pollsets listing page with dropdowns
			try {
				req.breadcrumbs(BREADCRUMBS["admin/pollsets/list"]);
				let options = {
					collections: [
						{
							collection: TABLE_CATEGORIES,
							columns: ["_id", "name"],
							conditions: { status: ACTIVE, is_deleted: NOT_DELETED },
						}
					]
				};
				getDropdownList(req, res, options).then(response => {
					res.render("pollsets/list", {
						user_type: userType,
						user_id: userId,
						dynamic_variable: userBreadcrumbs(userType),
						dynamic_url: userType,
						categoryList: (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
					});
				});
			} catch (err) {
				console.error("Error rendering pollsets list page:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end getPollSetsList()

	/**
	 * Function for select listing poll checkbox
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.addSelectedPollListing = async (req, res) => {
		// Extract and validate parameters
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let pollSetSlug = (req.params.slug) ? req.params.slug : "";
		let pollSlugsArray = (req.params.poll_slugs) ? req.params.poll_slugs : "";
		let pollSlugs = pollSlugsArray.split(",");

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
					"is_published": POLL_PUBLISHED,
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

				// Prepare queries to run in parallel
				const pollListQuery = collection.aggregate([
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
							"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				]).toArray();

				const totalRecordsQuery = collection.countDocuments(commonConditions);
				const filteredRecordsQuery = collection.countDocuments(dataTableConfig.conditions);

				// Run all queries in parallel
				const [pollList, totalRecords, filteredRecords] = await Promise.all([
					pollListQuery,
					totalRecordsQuery,
					filteredRecordsQuery
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
				console.error("Error in addSelectedPollListing:", err);
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render pollsets listing page with dropdowns
			try {
				req.breadcrumbs(BREADCRUMBS["admin/pollsets/poll_list"]);

				// Prepare dropdown options for categories
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

				// Render the poll list page
				res.render("pollsets/poll_list", {
					'user_type': userType,
					'user_id': userId,
					'slug': pollSetSlug,
					'poll_slug': pollSlugs,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'categoryList': (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
				});
			} catch (err) {
				console.error("Error rendering pollsets poll_list page:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end addSelectedPollListing()

	/**
	 * Function to delete pollsets
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.deletePollset = async (req, res) => {
		// Extract parameters from request
		const pollSetSlug = req.params.slug ? req.params.slug : '';
		const statusType = req.params.status_type ? req.params.status_type : '';
		const recordStatus = req.params.status ? req.params.status : '';
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : '';
		const userType = req.params.user_type ? req.params.user_type : '';

		// Validate required parameters
		if (pollSetSlug && statusType && recordStatus && userId) {
			// Prepare data for deletion
			const sendData = {
				record_status: recordStatus,
				status_type: statusType,
				slug: pollSetSlug
			};

			try {
				// Call deletePollSets using async/await
				const deleteResponse = await deletePollSets(req, res, sendData);

				if (deleteResponse.status === STATUS_SUCCESS) {
					// Send success response
					req.flash(STATUS_SUCCESS, deleteResponse.message);
					res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/pollsets/${userId}`);
				} else {
					// Send error response
					req.flash(STATUS_ERROR, deleteResponse.message);
					res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/pollsets/${userId}`);
				}
			} catch (err) {
				// Handle unexpected errors
				console.error("Error in deletePollset:", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/pollsets/${userId}`);
			}
		} else {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/pollsets/${userId}`);
		}
	}; // end deletePollset()

	/**
	 * Function to add pollsets
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.addPollSet = async (req, res) => {
		// Extract and validate parameters
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const pollSlugsArray = req.params.poll_slugs ? req.params.poll_slugs : "";
		const pollSlugs = pollSlugsArray.split(",");

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const title = req.body.title ? req.body.title : "";
			const categoryId = req.body.category ? newObjectIdDefault(req.body.category) : "";
			const description = req.body.description ? req.body.description : "";
			const rewardDescription = req.body.reward_description ? req.body.reward_description : "";
			const showTo = req.body.show_to ? req.body.show_to : "";
			const allowRetaking = req.body.allow_retaking ? req.body.allow_retaking : "";
			const sso = req.body.sso ? req.body.sso : "";
			const sponsoringLogo = (req.files && req.files.sponsoring_logo) ? req.files.sponsoring_logo : "";

			let errMessageArray = [];

			// Prepare options for file upload
			const uploadOptions = {
				'image': sponsoringLogo,
				'filePath': POLLSET_FILE_PATH,
			};

			try {
				// Upload image using async/await
				const uploadResponse = await moveUploadedFile(req, res, uploadOptions);

				if (uploadResponse.status === STATUS_ERROR) {
					errMessageArray.push({ 'param': 'sponsoring_logo', 'msg': uploadResponse.message });
				}
				const imageName = uploadResponse.fileName ? uploadResponse.fileName : "";

				// If there are errors, send error response
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Prepare pollset options for saving
				const pollsetsOptions = {
					'user_id': userId,
					'poll_slug': pollSlugs,
					'title': title,
					'category_id': categoryId,
					'description': description,
					'reward_description': rewardDescription,
					'show_to': showTo,
					'allow_retaking': allowRetaking,
					'sso': sso,
					'sponsoring_logo': imageName,
				};

				// Save pollset data using async/await
				const saveResponse = await savePollsetData(req, res, pollsetsOptions);

				// Send success response
				req.flash(saveResponse.status, saveResponse.message);
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: (saveResponse.status === STATUS_SUCCESS)
						? `${WEBSITE_ADMIN_URL}users/${userType}/pollsets/${userId}`
						: `${WEBSITE_ADMIN_URL}users/${userType}/pollsets/add_pollset/${userId}`,
					message: saveResponse.message
				});
			} catch (err) {
				// Handle unexpected errors
				console.error("Error in addPollSet (POST):", err);
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: 'server', msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		} else {
			try {
				// Set breadcrumbs for add pollset page
				req.breadcrumbs(BREADCRUMBS["admin/pollsets/add_pollset"]);

				// Prepare dropdown list options
				const dropdownOptions = {
					collections: [
						{
							collection: TABLE_CATEGORIES,
							columns: ["_id", "name"],
							conditions: { status: ACTIVE, is_deleted: NOT_DELETED },
						}
					]
				};

				// Fetch dropdown data and poll data in parallel
				const [dropdownResponse, resultPolls] = await Promise.all([
					getDropdownList(req, res, dropdownOptions),
					(async () => {
						const pollsCollection = db.collection(TABLE_POLLS);
						return await pollsCollection.find(
							{ slug: { $in: pollSlugs } },
							{ projection: { _id: 1, question: 1, slug: 1 } }
						).toArray();
					})()
				]);

				// Render add pollset page with fetched data
				return res.render("pollsets/add_pollset", {
					user_type: userType,
					user_id: userId,
					poll_slug: pollSlugs,
					resultPollslug: resultPolls || [],
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					categoryList: (dropdownResponse && dropdownResponse.final_html_data && dropdownResponse.final_html_data["0"])
						? dropdownResponse.final_html_data["0"]
						: "",
				});
			} catch (err) {
				console.error("Error in addPollSet (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end addPollSet()

	/**
	 * Function for edit pollsets
	 *
	 * @param req 	As	Request Data
	 * @param res 	As	Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.editPollSet = async (req, res) => {
		// Extract and validate parameters
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let pollSetSlug = (req.params.slug) ? req.params.slug : "";
		let pollSlugsArray = (req.params.poll_slugs) ? req.params.poll_slugs : "";
		let pollSlugs = pollSlugsArray.split(",");

		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			// Handle POST: Update pollset
			try {
				// Sanitize input data
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
				let title = (req.body.title) ? req.body.title : "";
				let categoryId = (req.body.category) ? newObjectIdDefault(req.body.category) : "";
				let description = (req.body.description) ? req.body.description : "";
				let rewardDescription = (req.body.reward_description) ? req.body.reward_description : "";
				let showTo = (req.body.show_to) ? req.body.show_to : "";
				let allowRetaking = (req.body.allow_retaking) ? req.body.allow_retaking : "";
				let sso = (req.body.sso) ? req.body.sso : "";
				let sponsoringLogo = (req.files && req.files.sponsoring_logo) ? req.files.sponsoring_logo : "";

				let errMessageArray = [];

				// Prepare options for file upload
				let options = {
					'image': sponsoringLogo,
					'filePath': POLLSET_FILE_PATH,
				};

				// Upload image (if any)
				const response = await moveUploadedFile(req, res, options);

				if (response.status == STATUS_ERROR) {
					errMessageArray.push({ 'param': 'sponsoring_logo', 'msg': response.message });
				}
				let imageName = (response.fileName) ? response.fileName : "";

				// If there are errors, send error response
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				}

				// Prepare pollset update options
				let pollsetsOptions = {
					'slug': pollSetSlug,
					'user_id': userId,
					'poll_slug': pollSlugs,
					'title': title,
					'category_id': categoryId,
					'description': description,
					'reward_description': rewardDescription,
					'show_to': showTo,
					'allow_retaking': allowRetaking,
					'sso': sso,
					'sponsoring_logo': imageName,
				};

				// Update pollset data
				const updateResponse = await updatePollsetData(req, res, pollsetsOptions);

				if (updateResponse.status == STATUS_SUCCESS) {
					// On success, send success response
					req.flash(STATUS_SUCCESS, updateResponse.message);
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/pollsets/' + userId,
						message: updateResponse.message
					});
				} else {
					// On error, redirect back to edit page
					req.flash(STATUS_ERROR, updateResponse.message);
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + '/pollsets/edit_pollset/' + pollSetSlug + '/' + userId + '/' + pollSlugs);
				}
			} catch (err) {
				console.error("Error in editPollSet (POST):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		} else {
			// Handle GET: Render edit pollset page
			try {
				req.breadcrumbs(BREADCRUMBS["admin/pollsets/edit_pollset"]);
				const pollsets = db.collection(TABLE_POLL_SETS);

				// Fetch pollset details
				const pollsetResult = await pollsets.findOne({ slug: pollSetSlug });

				// Prepare dropdown list options
				let dropdownOptions = {
					collections: [
						{
							collection: TABLE_CATEGORIES,
							columns: ["_id", "name"],
							selected: [pollsetResult ? pollsetResult.category_id : ""],
							conditions: { status: ACTIVE, is_deleted: NOT_DELETED },
						}
					]
				};

				// Fetch dropdown data and poll data in parallel
				const [dropdownResponse, resultPolls] = await Promise.all([
					getDropdownList(req, res, dropdownOptions),
					(async () => {
						const pollsCollection = db.collection(TABLE_POLLS);
						return await pollsCollection.find(
							{ slug: { $in: pollSlugs } },
							{ projection: { _id: 1, question: 1, slug: 1 } }
						).toArray();
					})()
				]);

				// Render edit pollset page with fetched data
				return res.render("pollsets/edit_pollset", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userId,
					poll_slug: pollSlugs,
					resultPollslug: resultPolls || [],
					pollsetResult: pollsetResult || {},
					categoryList: (dropdownResponse && dropdownResponse.final_html_data && dropdownResponse.final_html_data["0"])
						? dropdownResponse.final_html_data["0"]
						: "",
				});
			} catch (err) {
				console.error("Error in editPollSet (GET):", err);
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	}; // end editPollSet()

	/**
	 * Function to view pollset's detail
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render
	 */
	this.viewPollSet = async (req, res, next) => {
		// Extract and validate parameters
		const pollsetSlug = req.params.slug ? req.params.slug : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";

		if (!userType || !userId || !pollsetSlug) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		try {
			// Get pollsets collection
			const pollsets = db.collection(TABLE_POLL_SETS);

			// Prepare aggregation pipeline for pollset details, polls, and category
			const pipeline = [
				{ $match: { slug: pollsetSlug } },
				{
					$lookup: {
						from: TABLE_POLLS,
						let: { pollIds: "$poll_ids" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $in: ['$_id', '$$pollIds'] },
										]
									},
								}
							},
							{ $project: { question: 1 } }
						],
						as: "polls_details"
					}
				},
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
							{ $project: { name: 1 } }
						],
						as: "catDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"question": 1,
						"polls_details": 1,
						"title": 1,
						"description": 1,
						"reward_description": 1,
						"category_id": 1,
						"show_to": 1,
						"allow_retaking": 1,
						"sso": 1,
						"sponsoring_logo": 1,
						"slug": 1,
						"is_published": 1,
						"created": 1,
						"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
					}
				}
			];

			// Run aggregation query using async/await
			const result = await pollsets.aggregate(pipeline).toArray();

			// Set breadcrumbs for view page
			req.breadcrumbs(BREADCRUMBS["admin/pollsets/view"]);

			// Render the pollset view page with fetched data
			return res.render("pollsets/view", {
				user_type: userType,
				user_id: userId,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userId,
				result: (result && result[0]) ? result[0] : {},
			});
		} catch (err) {
			// Handle errors and pass to next middleware
			console.error("Error in viewPollSet:", err);
			return next(err);
		}
	}; // end viewPollSet()
}
module.exports = new PollSets();
