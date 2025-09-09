const async = require("async");


function PollSegment() {

	/**
	 * Function for select listing poll checkbox
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.addSelectedPollListing = async (req, res) => {
		try {
			// Extract and validate parameters
			let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";
			let pollSegmentSlug = (req.params.slug) ? req.params.slug : "";
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

				// Get datatable config (sorting, filtering, etc.)
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common query conditions
				let commonConditions = {
					"is_published": POLL_PUBLISHED,
					"is_deleted": NOT_DELETED,
					"user_id": newObjectIdDefault(userId)
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Prepare date-wise filter for votes if provided
				let dateWiseFilter = "";
				if (fromDate !== "" && toDate !== "") {
					dateWiseFilter = {
						$gte: getUtcDate(fromDate + START_DATE),
						$lte: getUtcDate(toDate + END_DATE),
					};
				}

				// Prepare lookup condition for poll votes
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

				// Run queries in parallel using Promise.all
				const [
					pollList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get list of polls with aggregation
					collection.aggregate([
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
							$lookup: {
								from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
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
								"question": 1,
								"is_deleted": 1,
								"is_draft": 1,
								"custom_url": 1,
								"is_published": 1,
								"slug": 1,
								"created": 1,
								"total_count": 1,
								"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
								"total_vote": {
									$cond: [
										{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
										{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
										0
									]
								},
							}
						},
						{ $sort: dataTableConfig.sort_conditions },
						{ $skip: skip },
						{ $limit: limit },
					]).toArray(),

					// Get total number of records in poll collection
					collection.countDocuments(commonConditions),

					// Get filtered records count in poll collection
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
			} else {
				// Get dropdown list for categories and render listing page
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

				res.render("poll_segment/poll_list", {
					'user_type': userType,
					'user_id': userId,
					'slug': pollSegmentSlug,
					'poll_slug': pollSlugs,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userId,
					'categoryList': (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
				});
			}
		} catch (err) {
			console.error("Error in addSelectedPollListing:", err);
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end addSelectedPollListing()

	/**
	 * Function to add a poll segment
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return null
	 */
	this.addPollSegment = async (req, res) => {
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

				// Prepare options for saving poll segment
				let options = {
					"user_id": userId,
					"poll_ids": pollIds,
					"segment_name": title,
					"segment_description": description,
					"segment_type": '',
					"from_date": fromDateMongo,
					"to_date": toDateMongo
				};

				// Save poll segment using async/await
				try {
					const saveResponse = await savePollSegment(req, res, options);
					req.flash(saveResponse.status, saveResponse.message);
					res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + '/poll_segment/' + userId,
						message: saveResponse.message
					});
				} catch (saveErr) {
					console.error("Error saving poll segment:", saveErr);
					res.send({
						status: STATUS_ERROR,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					});
				}
			} else {
				// Prepare poll IDs as ObjectId array
				let pollIdsData = pollIds.map(id => newObjectIdDefault(id));

				// Get polls matching the provided IDs using async/await
				try {
					const pollsCollection = db.collection(TABLE_POLLS);
					const resultPolls = await pollsCollection
						.find(
							{ _id: { $in: pollIdsData } },
							{ projection: { _id: 1, question: 1, slug: 1 } }
						)
						.toArray();

					// Render the add poll segment page with fetched polls
					res.render("poll_segment/add", {
						user_type: userType,
						user_id: userId,
						poll_ids: pollIdsArray,
						resultPollslug: resultPolls || [],
					});
				} catch (err) {
					console.error("Error fetching polls for addPollSegment:", err);
					res.render("poll_segment/add", {
						user_type: userType,
						user_id: userId,
						poll_ids: pollIdsArray,
						resultPollslug: [],
					});
				}
			}
		} catch (err) {
			console.error("Error in addPollSegment:", err);
			res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // end addPollSegment()

	/**
	 * Function to get poll segment list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.getPollSegmentList = async (req, res) => {
		let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
		let userType = (req.params.user_type) ? req.params.user_type : "";

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
			const pollsegments = db.collection(TABLE_POLL_SEGMENT);

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

				// Prepare aggregation pipeline for poll segment list
				const pollSegmentListPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$project: {
							"poll_slug": 1,
							"segment_name": 1,
							"segment_description": 1,
							"slug": 1,
							"created": 1,
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Run queries in parallel using Promise.all
				const [
					pollSegmentList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get list of poll segments
					pollsegments.aggregate(pollSegmentListPipeline).toArray(),
					// Get total number of records (without filters except user and not deleted)
					pollsegments.countDocuments(commonConditions),
					// Get filtered records count (with all filters)
					pollsegments.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: pollSegmentList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				console.error("Error in getPollSegmentList:", err);
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
			res.render("poll_segment/list", {
				user_type: userType,
				user_id: userId,
			});
		}
	}; // end getPollSegmentList()

	/**
	 * Function to get segment vote user list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Next Middleware Function
	 *
	 * @return render
	 */
	this.getPollSegmentVoteUserList = async (req, res, next) => {
		try {
			// Extract and validate parameters
			let userId = (req.params.user_id) ? req.params.user_id : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";
			let slug = (req.params.slug) ? req.params.slug : "";
			const pollSegment = db.collection(TABLE_POLL_SEGMENT);

			let commonConditions = {
				"slug": slug,
				"is_deleted": NOT_DELETED,
			};

			// Build aggregation pipeline for fetching vote user list
			const pipeline = [
				{ $match: commonConditions },
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { pollSlugs: "$poll_slug" },
						pipeline: [
							{
								$match: {
									'user_id': { $nin: [null, ""] },
									$expr: {
										$and: [
											{ $in: ['$poll_slug', '$$pollSlugs'] },
										]
									},
								}
							},
							{
								$group: {
									_id: {
										"poll_slug": "$poll_slug",
									},
									"user_id": { $first: "$user_id" },
									"poll_question": { $first: "$poll_question" },
									"options": { $first: "$options.title" },
									"age": { $first: "$age" },
									"gender": { $first: "$gender" },
								}
							},
							{ "$project": { _id: 0, poll_question: 1, user_id: 1, options: 1, age: 1, gender: 1 } },
						],
						as: "vote_details"
					}
				},
				{
					$unwind: {
						path: "$vote_details",
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { userId: "$vote_details.user_id" },
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
							{ $project: { "_id": 0, "email": 1 } }
						],
						as: "vote_details.user"
					}
				},
				{
					$project: {
						"_id": 1,
						"vote_details": 1,
					}
				},
			];

			// Execute aggregation pipeline using async/await
			const result = await pollSegment.aggregate(pipeline).toArray();

			// Render the user list page with the result
			res.render("poll_segment/user_list", {
				"user_type": userType,
				"user_id": userId,
				"result": result
			});
		} catch (err) {
			console.error("Error in getPollSegmentVoteUserList:", err);
			return next(err);
		}
	}; // end getPollSegmentVoteUserList()

	/**
	 * Function to get refined voter list
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Next Middleware Function
	 *
	 * @return render
	 */
	this.getUserRefineVoteList = async (req, res, next) => {
		try {
			// Extract userId and userType from request parameters
			let userId = (req.params.user_id) ? req.params.user_id : "";
			let userType = (req.params.user_type) ? req.params.user_type : "";

			// Validate userType and userId
			if (!userType || !userId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				res.redirect(WEBSITE_ADMIN_URL + "dashboard");
				return;
			}

			const collection = db.collection(TABLE_POLLS);

			// Set common query conditions
			let commonConditions = {
				"is_deleted": NOT_DELETED,
			};

			// Prepare aggregation pipeline to get total unique voters
			const pipeline = [
				{ $match: commonConditions },
				{ $group: { _id: { "user_id": "$user_id" } } },
				{ $count: 'total' },
			];

			// Execute aggregation pipeline using async/await
			await collection.aggregate(pipeline).toArray();

			// Render the refine voter list page
			res.render("poll_segment/refine_voter_list", {
				"user_type": userType,
				"user_id": userId,
			});
		} catch (err) {
			console.error("Error in getUserRefineVoteList:", err);
			return next(err);
		}
	}; // end getUserRefineVoteList()
}
module.exports = new PollSegment();
