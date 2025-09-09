const async = require("async");

function pollPerformanceReport() {

	/**
	 * Function to get view poll performance reports
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.pollPerformanceOverView = async (req, res) => {
		try {
			// Extract and validate parameters
			let userType = (req.params.user_type) ? req.params.user_type : "";
			let userId = (req.params.user_id) ? req.params.user_id : "";
			let fromDate = (req.params.from_date) ? req.params.from_date : "";
			let toDate = (req.params.to_date) ? req.params.to_date : "";

			// Check for valid access
			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			// Prepare options for poll performance query
			let options = {
				"user_id": newObjectIdDefault(userId),
				"from_date": fromDate,
				"to_date": toDate,
			};

			// Get poll engagement view reports using async/await
			// If you need to run multiple queries in parallel, use Promise.all here
			const responseViewLogs = await pollPerformanceInteractionCount(req, res, options);

			// Set breadcrumbs and render the performance report page
			req.breadcrumbs(BREADCRUMBS["admin/poll_performance/list"]);
			res.render("poll_performance/list", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
				'result': responseViewLogs,
				'from_date': fromDate,
				'to_date': toDate
			});
		} catch (err) {
			console.error("Error in pollPerformanceOverView:", err);
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end pollPerformanceOverView()

	/**
	 * Function for interaction poll listing
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.interactionPollListing = async (req, res) => {
		try {
			// Extract and validate parameters
			let userType = (req.params.user_type) ? req.params.user_type : "";
			let userId = (req.params.user_id) ? req.params.user_id : "";
			let pollIds = (req.params.poll_ids) ? req.params.poll_ids : "";
			let participantstab = (req.params.participants_tab) ? req.params.participants_tab : "";

			// Check for valid access
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
				const collection = db.collection(TABLE_POLLS);

				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Prepare date filter for votes/interactions
				let dateWiseFilter = "";
				if (fromDate !== '' && toDate !== '') {
					dateWiseFilter = {
						$gte: getUtcDate(fromDate + START_DATE),
						$lte: getUtcDate(toDate + END_DATE),
					};
				}

				// Prepare lookup table and condition based on tab
				let lookupTable = "";
				let lookupCondition = {
					'user_id': { $nin: [null, ""] },
					'created': dateWiseFilter,
					$expr: {
						$and: [
							{ $eq: ["$poll_slug", "$$pollSlug"] },
						]
					},
				};

				if (fromDate === "" && toDate === "") {
					delete lookupCondition['created'];
				}

				if (participantstab === PERFORMANCE_VOTES_TAB) {
					lookupTable = PERFORMANCE_VOTES_TAB;
					delete lookupCondition['user_id'];
				} else if (participantstab === PERFORMANCE_COMMENTS_TAB) {
					lookupTable = PERFORMANCE_COMMENTS_TAB;
					delete lookupCondition['user_id'];
				} else if (participantstab === PERFORMANCE_SHARE_TAB) {
					lookupTable = PERFORMANCE_SHARE_TAB;
					delete lookupCondition['user_id'];
				} else if (participantstab === PERFORMANCE_PARTICIPANTS_TAB) {
					lookupTable = PERFORMANCE_VOTES_TAB;
				}

				// Set common query conditions for polls
				let commonConditions = {
					"user_id": newObjectIdDefault(userId),
					"is_published": { $in: [POLL_PUBLISHED, POLL_NOT_PUBLISHED] },
					"is_draft": { $in: [POLL_DRAFT, POLL_NOT_DRAFTS] },
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Run queries in parallel using Promise.all
				const [
					pollList,
					totalRecords,
					filteredRecords,
					totalVoteCount
				] = await Promise.all([
					// Get list of polls with interaction counts
					collection.aggregate([
						{ $match: dataTableConfig.conditions },
						{
							$lookup: {
								from: lookupTable,
								let: { pollSlug: "$slug" },
								pipeline: [
									{ $match: lookupCondition },
									{ $project: { _id: 1 } },
									{ $count: "total_vote" }
								],
								as: "poll_vote"
							}
						},
						{
							$project: {
								"id": 1,
								"question": 1,
								"slug": 1,
								"created": 1,
								"total_vote": {
									$cond: [
										{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
										{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
										0
									]
								}
							}
						},
						{ $sort: dataTableConfig.sort_conditions },
						{ $skip: skip },
						{ $limit: limit }
					]).toArray(),

					// Get total number of records in poll collection
					collection.countDocuments(commonConditions),

					// Get filtered records count in poll collection
					collection.countDocuments(dataTableConfig.conditions),

					// Get total vote count in poll collection
					(async () => {
						const countResult = await collection.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$lookup: {
									from: lookupTable,
									let: { pollSlug: "$slug" },
									pipeline: [
										{ $match: lookupCondition },
										{ $project: { _id: 1 } },
										{ $count: "total_vote" }
									],
									as: "poll_vote"
								}
							},
							{
								$project: {
									"_id": 0,
									"total_vote": {
										$cond: [
											{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
											{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
											0
										]
									}
								}
							}
						]).toArray();

						// Sum up total_vote from all records
						let totalCount = 0;
						countResult.forEach(function (recordsData) {
							let total = recordsData.total_vote;
							totalCount += total;
						});
						return totalCount;
					})()
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: pollList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0,
					totalVote: totalVoteCount || 0
				});
			} else {
				// Render listing page
				req.breadcrumbs(BREADCRUMBS["admin/poll_performance/poll_list"]);
				res.render("poll_performance/poll_list", {
					'user_type': userType,
					'user_id': userId,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'participants_tab': participantstab,
					'poll_ids': pollIds
				});
			}
		} catch (err) {
			console.error("Error in interactionPollListing:", err);
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end interactionPollListing()

	/**
	 * Function for interaction list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.interactionList = async (req, res) => {
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let userId = (req.params.user_id) ? req.params.user_id : "";
		let participantstab = (req.params.participants_tab) ? req.params.participants_tab : "";

		// Validate user type and user id
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
			const collection = db.collection(TABLE_POLLS);

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Prepare date filter for votes/interactions
				let dateWiseFilter = "";
				if (fromDate !== '' && toDate !== '') {
					dateWiseFilter = {
						$gte: getUtcDate(fromDate + START_DATE),
						$lte: getUtcDate(toDate + END_DATE),
					};
				}

				// Prepare lookup condition for aggregation
				let lookupCondition = {
					'created': dateWiseFilter,
					$expr: {
						$and: [
							{ $eq: ["$poll_slug", "$$pollSlug"] },
						]
					},
				};
				if (fromDate === "" && toDate === "") {
					delete lookupCondition['created'];
				}

				// Common conditions for poll listing
				let commonConditions = {
					"user_id": newObjectIdDefault(userId),
					"is_published": { $in: [POLL_PUBLISHED, POLL_NOT_PUBLISHED] },
					"is_draft": { $in: [POLL_DRAFT, POLL_NOT_DRAFTS] },
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Run queries in parallel using Promise.all
				const [
					pollList,
					totalRecords,
					filteredRecords,
					totalInteractions
				] = await Promise.all([
					// Get list of polls with interaction counts
					collection.aggregate([
						{ $match: dataTableConfig.conditions },
						{
							$lookup: {
								from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
								let: { pollSlug: "$slug" },
								pipeline: [
									{ $match: lookupCondition },
									{ $project: { _id: 1 } },
									{ $count: "total_vote" }
								],
								as: "poll_vote_participants"
							}
						},
						{
							$lookup: {
								from: TABLE_POLLS_COMMENTS,
								let: { pollSlug: "$slug" },
								pipeline: [
									{ $match: lookupCondition },
									{ $project: { _id: 1 } },
									{ $count: "total_comments" }
								],
								as: "poll_comments"
							}
						},
						{
							$lookup: {
								from: TABLE_SHARE_ICON_LOGS,
								let: { pollSlug: "$slug" },
								pipeline: [
									{ $match: lookupCondition },
									{ $project: { _id: 1 } },
									{ $count: "total_shares" }
								],
								as: "poll_shares"
							}
						},
						{
							$project: {
								"id": 1,
								"question": 1,
								"slug": 1,
								"created": 1,
								"total_interactions": {
									$sum: [
										{ $ifNull: [{ $arrayElemAt: ["$poll_vote_participants.total_vote", 0] }, 0] },
										{ $ifNull: [{ $arrayElemAt: ["$poll_comments.total_comments", 0] }, 0] },
										{ $ifNull: [{ $arrayElemAt: ["$poll_shares.total_shares", 0] }, 0] }
									]
								}
							}
						},
						{ $sort: dataTableConfig.sort_conditions },
						{ $skip: skip },
						{ $limit: limit }
					]).toArray(),

					// Get total number of records in poll collection
					collection.countDocuments(commonConditions),

					// Get filtered records count in poll collection
					collection.countDocuments(dataTableConfig.conditions),

					// Get total interactions count across all filtered polls
					(async () => {
						const countResult = await collection.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$lookup: {
									from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
									let: { pollSlug: "$slug" },
									pipeline: [
										{ $match: lookupCondition },
										{ $project: { _id: 1 } },
										{ $count: "total_vote" }
									],
									as: "poll_vote_participants"
								}
							},
							{
								$lookup: {
									from: TABLE_POLLS_COMMENTS,
									let: { pollSlug: "$slug" },
									pipeline: [
										{ $match: lookupCondition },
										{ $project: { _id: 1 } },
										{ $count: "total_comments" }
									],
									as: "poll_comments"
								}
							},
							{
								$lookup: {
									from: TABLE_SHARE_ICON_LOGS,
									let: { pollSlug: "$slug" },
									pipeline: [
										{ $match: lookupCondition },
										{ $project: { _id: 1 } },
										{ $count: "total_shares" }
									],
									as: "poll_shares"
								}
							},
							{
								$project: {
									"total_interactions": {
										$sum: [
											{ $ifNull: [{ $arrayElemAt: ["$poll_vote_participants.total_vote", 0] }, 0] },
											{ $ifNull: [{ $arrayElemAt: ["$poll_comments.total_comments", 0] }, 0] },
											{ $ifNull: [{ $arrayElemAt: ["$poll_shares.total_shares", 0] }, 0] }
										]
									}
								}
							}
						]).toArray();

						// Sum up total_interactions from all records
						let total = 0;
						countResult.forEach(function (record) {
							total += record.total_interactions || 0;
						});
						return total;
					})()
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: pollList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0,
					totalVote: totalInteractions || 0
				});
			} catch (err) {
				console.error("Error in interactionList:", err);
				res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// Render listing page
			req.breadcrumbs(BREADCRUMBS["admin/poll_performance/interaction_list"]);
			res.render("poll_performance/interaction_list", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
				'participants_tab': participantstab
			});
		}
	}; // end interactionList()

	/**
	 * Function for poll spent time list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.pollSpentTimeList = async (req, res) => {
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let userId = (req.params.user_id) ? req.params.user_id : "";
		let participantstab = (req.params.participants_tab) ? req.params.participants_tab : "";

		// Validate user type and user id
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
			const collection = db.collection(TABLE_POLLS);

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Prepare date filter for time spent logs
				let dateWiseFilter = "";
				if (fromDate !== '' && toDate !== '') {
					dateWiseFilter = {
						$gte: getUtcDate(fromDate + START_DATE),
						$lte: getUtcDate(toDate + END_DATE),
					};
				}

				// Prepare lookup condition for aggregation
				let lookupCondition = {
					'created': dateWiseFilter,
					$expr: {
						$and: [
							{ $eq: ["$poll_slug", "$$pollSlug"] },
						]
					},
				};
				if (fromDate === "" && toDate === "") {
					delete lookupCondition['created'];
				}

				// Prepare common conditions for poll query
				let commonConditions = {
					"user_id": newObjectIdDefault(userId),
					"is_published": { $in: [POLL_PUBLISHED, POLL_NOT_PUBLISHED] },
					"is_draft": { $in: [POLL_DRAFT, POLL_NOT_DRAFTS] },
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Run queries in parallel using Promise.all
				const [
					pollList,
					totalRecords,
					filteredRecords,
					totalTimeCount
				] = await Promise.all([
					// Get list of polls with spent time
					(async () => {
						const result = await collection.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$lookup: {
									from: TABLE_POLL_TIME_SPENT_LOGS,
									let: { pollSlug: "$slug" },
									pipeline: [
										{ $match: lookupCondition },
										{
											$group: {
												'_id': null,
												'spent_time_count': { $sum: "$spent_time" },
											}
										},
										{ $project: { "_id": 1, "spent_time_count": 1 } }
									],
									as: "spent_time"
								}
							},
							{
								$project: {
									"id": 1,
									"question": 1,
									"slug": 1,
									"created": 1,
									'total_spent_time': {
										$cond: [
											{ $arrayElemAt: ["$spent_time.spent_time_count", 0] },
											{ $arrayElemAt: ["$spent_time.spent_time_count", 0] },
											0
										]
									},
								}
							},
							{ $sort: dataTableConfig.sort_conditions },
							{ $skip: skip },
							{ $limit: limit },
						]).toArray();

						// Format total_spent_time as fancy time if required
						if (participantstab == PERFORMANCE_DWELL_TIME_TAB) {
							result.forEach((record) => {
								record['total_spent_time'] = fancyTimeFormat(record.total_spent_time);
							});
						}
						return result;
					})(),
					// Get total number of records in poll collection
					collection.countDocuments(commonConditions),
					// Get filtered records count in poll collection
					collection.countDocuments(dataTableConfig.conditions),
					// Get total time duration count (sum of all spent_time)
					(async () => {
						const countResult = await collection.aggregate([
							{ $match: dataTableConfig.conditions },
							{
								$lookup: {
									from: TABLE_POLL_TIME_SPENT_LOGS,
									let: { pollSlug: "$slug" },
									pipeline: [
										{ $match: lookupCondition },
										{
											$group: {
												'_id': null,
												'spent_time_count': { $sum: "$spent_time" },
											}
										},
										{ $project: { "_id": 1, "spent_time_count": 1 } }
									],
									as: "spent_time"
								}
							},
							{
								$project: {
									"_id": 0,
									'total_spent_time': {
										$cond: [
											{ $arrayElemAt: ["$spent_time.spent_time_count", 0] },
											{ $arrayElemAt: ["$spent_time.spent_time_count", 0] },
											0
										]
									},
								}
							},
						]).toArray();

						// Sum up total_spent_time from all records
						let totalCount = 0;
						countResult.forEach(function (record) {
							totalCount += record.total_spent_time || 0;
						});
						// Format as fancy time
						return fancyTimeFormat(totalCount);
					})()
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: pollList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0,
					totalTime: totalTimeCount || 0
				});
			} catch (err) {
				console.error("Error in pollSpentTimeList:", err);
				res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} else {
			// Render listing page
			req.breadcrumbs(BREADCRUMBS["admin/poll_performance/poll_spent_time"]);
			res.render("poll_performance/poll_spent_time", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
				'participants_tab': participantstab
			});
		}
	}; // end pollSpentTimeList()

	/**
	 * Function to add an assumption report
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.addAssumptionReport = async (req, res) => {
		try {
			// Extract and validate parameters
			let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";
			let pollIdsArray = (req.params.poll_ids) ? req.params.poll_ids : "";
			let fromDate = (req.params.from_date) ? req.params.from_date : "";
			let toDate = (req.params.to_date) ? req.params.to_date : "";
			let pollIds = pollIdsArray.split(",");

			let fromDateMongo = fromDate.substring(0, 10);
			let toDateMongo = toDate.substring(0, 10);

			// Check for valid access
			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			if (isPost(req)) {
				// Sanitize input data
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
				let title = (req.body.title) ? req.body.title : "";
				let description = (req.body.description) ? req.body.description : "";

				// Prepare options for saving assumption report
				let options = {
					"user_id": userId,
					"poll_ids": pollIds,
					"report_name": title,
					"report_description": description,
					"from_date": fromDateMongo,
					"to_date": toDateMongo
				};

				// Save assumption report using async/await
				const saveResponse = await saveAssumptionReport(req, res, options);

				// Send success response
				req.flash(saveResponse.status, saveResponse.message);
				res.send({
					status: STATUS_SUCCESS,
					redirect_url: (saveResponse.status == STATUS_SUCCESS)
						? WEBSITE_ADMIN_URL + "users/" + userType + '/poll_performance/assumption_report_list/' + userId
						: WEBSITE_ADMIN_URL + "users/" + userType + '/poll_performance/poll_list/' + userId + '/' + PERFORMANCE_VOTES_TAB + '/' + fromDate + '/' + toDate,
					message: saveResponse.message
				});
			} else {
				// Prepare pollIds as ObjectId array
				let pollIdsData = pollIds.map((ids) => newObjectIdDefault(ids));

				// Find polls matching the given poll IDs using async/await
				const pollsCollection = db.collection(TABLE_POLLS);
				let resultPolls = [];
				try {
					resultPolls = await pollsCollection.find(
						{ _id: { $in: pollIdsData } },
						{ projection: { _id: 1, question: 1, slug: 1 } }
					).toArray();
				} catch (err) {
					console.error("Error fetching polls for addAssumptionReport:", err);
					resultPolls = [];
				}

				// Render the add assumption report page
				req.breadcrumbs(BREADCRUMBS["admin/poll_performance/add_assumption"]);
				res.render("poll_performance/add_assumption", {
					'user_type': userType,
					'user_id': userId,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId + '/' + PERFORMANCE_VOTES_TAB,
					'poll_ids': pollIds,
					'resultPollslug': resultPolls,
					'from_date': fromDate,
					'to_date': toDate
				});
			}
		} catch (err) {
			console.error("Error in addAssumptionReport:", err);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end addAssumptionReport()

	/**
	 * Function to get poll assumption list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.getPollAssumptionList = async (req, res) => {
		// Extract userId and userType from request parameters
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

		// Validate userType and userId
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		if (isPost(req)) {
			let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;

			const assumptionReport = db.collection(TABLE_ASSUMPTION_REPORTS);

			try {
				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common conditions for queries
				let commonConditions = {
					"is_deleted": NOT_DELETED,
					"user_id": newObjectIdDefault(userId)
				};

				// Merge datatable conditions with common conditions
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Run queries in parallel using Promise.all
				const [
					assumptionList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get list of poll assumption reports
					assumptionReport.aggregate([
						{ $match: dataTableConfig.conditions },
						{
							$project: {
								"_id": 1,
								"slug": 1,
								"poll_slugs": 1,
								"report_name": 1,
								"report_description": 1,
								"is_deleted": 1,
								"created": 1,
								"from_date_simple": 1,
								"to_date_simple": 1
							}
						},
						{ $sort: dataTableConfig.sort_conditions },
						{ $skip: skip },
						{ $limit: limit },
					]).toArray(),
					// Get total number of records (without filters except user and not deleted)
					assumptionReport.countDocuments(commonConditions),
					// Get filtered records count (with all filters)
					assumptionReport.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: assumptionList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				console.error("Error in getPollAssumptionList:", err);
				res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render listing page
			req.breadcrumbs(BREADCRUMBS["admin/poll_performance/assumption_report_list"]);
			res.render("poll_performance/assumption_report_list", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId + '/' + PERFORMANCE_VOTES_TAB,
			});
		}
	}; // end getPollAssumptionList()

	/**
	 * Function to get poll performance lead generation details
	 *
	 * @param req Request Data
	 * @param res Response Data
	 *
	 * @return null
	 */
	this.pollPerformanceLeadGenerationDetails = async (req, res) => {
		let userType = req.params.user_type ? req.params.user_type : "";
		let userId = req.params.user_id ? req.params.user_id : "";

		if (isPost(req)) {
			let gender = req.body.gender ? parseInt(req.body.gender) : "";
			let zipCode = req.body.zip_code ? req.body.zip_code : "";
			let zipSearchKeyword = isNaN(zipCode) ? zipCode : Number(zipCode);
			let ageFilter = req.body.user_age ? req.body.user_age : "";

			// Validate required parameters
			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			// Prepare options for query
			let options = {
				"user_id": newObjectIdDefault(userId),
				"gender": gender,
				"zip_code": zipSearchKeyword,
				"age": ageFilter
			};

			try {
				// Fetch poll lead generation details using async/await
				const responseView = await pollPerformanceLeadGeneration(req, res, options);

				return res.send({
					'user_type': userType,
					'user_id': userId,
					'result': responseView.result,
					"gender": gender,
					"age": ageFilter
				});
			} catch (error) {
				console.error("Error in pollPerformanceLeadGenerationDetails:", error);
				return res.send({
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
					result: [],
					gender: gender,
					age: ageFilter
				});
			}
		} else {
			// Render the lead generation details page
			req.breadcrumbs(BREADCRUMBS["admin/poll_performance/lead_generation_details"]);
			res.render("poll_performance/lead_generation_details", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
			});
		}
	}; // end pollPerformanceLeadGenerationDetails()

	/**
	 * Function to delete an assumption report
	 * Handles validation, prepares options, and deletes the report using async/await.
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 * @returns {void}
	 */
	this.deleteAssumptionReport = async (req, res) => {
		// Extract parameters from request
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let userId = (req.params.user_id) ? req.params.user_id : "";
		let assumptionId = (req.params.assumption_id) ? req.params.assumption_id : "";

		// Validate required parameters
		if (!userType || !userId || !assumptionId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// Prepare options for deletion
		let deleteOptions = {
			"user_id": newObjectIdDefault(userId),
			"assumption_id": newObjectIdDefault(assumptionId),
		};

		try {
			// Call the delete function using async/await
			const deleteResponse = await deletePerformanceAssumptionReport(req, res, deleteOptions);

			if (deleteResponse.status === STATUS_SUCCESS) {
				// Send success response
				req.flash(STATUS_SUCCESS, deleteResponse.message);
			} else {
				// Send error response
				req.flash(STATUS_ERROR, deleteResponse.message);
			}
			res.redirect(
				WEBSITE_ADMIN_URL +
				"users/" +
				userType +
				"/poll_performance/assumption_report_list/" +
				userId
			);
		} catch (error) {
			// Handle unexpected errors
			console.error("Error in deleteAssumptionReport:", error);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(
				WEBSITE_ADMIN_URL +
				"users/" +
				userType +
				"/poll_performance/assumption_report_list/" +
				userId
			);
		}
	}; // end deleteAssumptionReport()

	/**
	 * Function used for poll interaction details
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.interactionPollDetails = async (req, res) => {
		// Extract parameters from request
		let userType = (req.params.user_type) ? req.params.user_type : "";
		let userId = (req.params.user_id) ? req.params.user_id : "";
		let pollId = (req.params.poll_id) ? req.params.poll_id : "";
		let fromDate = (req.params.from_date) ? req.params.from_date : "";
		let toDate = (req.params.to_date) ? req.params.to_date : "";

		// Validate required parameters
		if (!userType || !userId || !pollId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		try {
			if (isPost(req)) {
				// Extract poll option id if provided
				let pollOptionId = (req.body.poll_option_id) ? newObjectIdDefault(req.body.poll_option_id) : "";

				// Prepare options data for poll option details
				let optionsData = {
					"user_id": newObjectIdDefault(userId),
					"from_date": fromDate,
					"to_date": toDate,
					"unregistered_participants": true,
					"view_type_filter": "",
					"poll_id": pollId,
					"poll_option_id": pollOptionId,
				};

				// Get poll performance option vote graph reports using async/await
				const responseGraphData = await pollVoteGraphReports(req, res, optionsData);

				return res.send({
					'result': (responseGraphData && responseGraphData.poll_logs) ? responseGraphData.poll_logs : {},
				});
			} else {
				// Prepare options data for poll engagement view reports
				let options = {
					"user_id": newObjectIdDefault(userId),
					"poll_id": newObjectIdDefault(pollId),
					"from_date": fromDate,
					"to_date": toDate
				};

				// Get poll engagement view reports using async/await
				const responseViewDetails = await viewInteractionPollDetails(req, res, options);

				req.breadcrumbs(BREADCRUMBS["admin/poll_performance/view_poll_details"]);
				res.render("poll_performance/view_poll_details", {
					'user_type': userType,
					'user_id': userId,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId + '/' + PERFORMANCE_VOTES_TAB,
					'poll_result': (responseViewDetails && responseViewDetails.poll_result) ? responseViewDetails.poll_result : {},
					'result': responseViewDetails.result,
					'poll_id': pollId,
					'from_date': fromDate,
					'to_date': toDate,
				});
			}
		} catch (error) {
			// Handle unexpected errors
			console.error("Error in interactionPollDetails:", error);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end interactionPollDetails()

	/**
	 * Function used to view assumption report
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.viewAssumptionReport = async (req, res) => {
		try {
			// Extract and validate parameters
			let userType = (req.params.user_type) ? req.params.user_type : "";
			let userId = (req.params.user_id) ? req.params.user_id : "";
			let reportId = (req.params.report_id) ? req.params.report_id : "";

			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			// Get the assumption report document
			const assumptionReport = db.collection(TABLE_ASSUMPTION_REPORTS);

			// Fetch the report details using async/await
			const resultPolls = await assumptionReport.find(
				{ '_id': newObjectIdDefault(reportId) },
				{
					projection: {
						_id: 1,
						poll_slugs: 1,
						poll_ids: 1,
						report_name: 1,
						from_date_simple: 1,
						to_date_simple: 1,
						week_count: 1
					}
				}
			).toArray();

			if (!resultPolls || !resultPolls.length) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			// Extract report data
			let pollSlugs = (resultPolls[0].poll_slugs) ? resultPolls[0].poll_slugs : [];
			let pollIds = (resultPolls[0].poll_ids) ? resultPolls[0].poll_ids : [];
			let fromDate = (resultPolls[0].from_date_simple) ? resultPolls[0].from_date_simple : "";
			let toDate = (resultPolls[0].to_date_simple) ? resultPolls[0].to_date_simple : "";

			// Prepare options for various queries
			let options = {
				"user_id": newObjectIdDefault(userId),
				"poll_slug": pollSlugs,
				"from_date": fromDate,
				"to_date": toDate,
				"unregistered_participants": true,
			};

			let ageOptionData = {
				'user_id': newObjectIdDefault(userId),
				'poll_slugs': pollSlugs,
				"from_date": fromDate,
				"to_date": toDate
			};

			let campaignOptionData = {
				'user_id': newObjectIdDefault(userId),
				'poll_ids': pollIds,
				"from_date": fromDate,
				"to_date": toDate
			};

			// Run all report queries in parallel using Promise.all
			const [
				pollViewFirstSectionReport,
				maleGeneralRevelations,
				femaleGeneralRevelations,
				pollViewGenderBreakdown,
				pollViewCampaignBreakdown
			] = await Promise.all([
				// Poll view reports (first section)
				(async () => {
					// Remove unregistered_participants for this call
					let opts = { ...options };
					delete opts['unregistered_participants'];
					return await assumptionReportViewFirstSection(req, res, opts);
				})(),
				// Male general revelations
				(async () => {
					let opts = { ...ageOptionData, gender_type: MALE };
					return await ageRangeWisePollAndOptionVoteCount(req, res, opts);
				})(),
				// Female general revelations
				(async () => {
					let opts = { ...ageOptionData, gender_type: FEMALE };
					return await ageRangeWisePollAndOptionVoteCount(req, res, opts);
				})(),
				// Gender breakdown
				(async () => {
					return await pollEngagementGenderTotalVoteCount(req, res, options);
				})(),
				// Campaign breakdown
				(async () => {
					return await pollPerformanceCampaignBreakdown(req, res, campaignOptionData);
				})()
			]);

			// Render the report view with all gathered data
			req.breadcrumbs(BREADCRUMBS["admin/poll_performance/view_report"]);
			res.render("poll_performance/view_report", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
				'assumption_result': resultPolls,
				'report_id': reportId,
				'first_section': (pollViewFirstSectionReport && pollViewFirstSectionReport.result) ? pollViewFirstSectionReport.result : 0,
				'second_section': (pollViewFirstSectionReport && pollViewFirstSectionReport.poll_result) ? pollViewFirstSectionReport.poll_result : 0,
				'gender_breakdown': (pollViewGenderBreakdown && pollViewGenderBreakdown.vote_polls) ? pollViewGenderBreakdown.vote_polls : 0,
				'male_general_revelution': (maleGeneralRevelations) ? maleGeneralRevelations : 0,
				'female_general_revelution': (femaleGeneralRevelations) ? femaleGeneralRevelations : 0,
				'campaign_breakdown': (pollViewCampaignBreakdown && pollViewCampaignBreakdown.result) ? pollViewCampaignBreakdown.result : 0,
			});
		} catch (error) {
			console.error("Error in viewAssumptionReport:", error);
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}
	}; // end viewAssumptionReport()
}

module.exports = new pollPerformanceReport();
