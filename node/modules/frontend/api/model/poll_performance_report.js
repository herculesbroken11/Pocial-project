const async = require('async');
function PollPerformanceReport() {

	/**
	 * Function to get poll interaction overview using async/await.
	 * Handles validation, builds query options, and fetches poll engagement view reports.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollInteractionOverview = async (req, res) => {
		let finalResponse = {};

		// Extract user and date info from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Build common condition for owner poll
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range to condition if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Prepare options for poll performance query
		const options = {
			"user_id": newObjectIdDefault(userId),
			"from_date": fromDate,
			"to_date": toDate,
		};

		try {
			// Fetch poll engagement view reports asynchronously
			const responseViewLogs = await pollPerformanceInteractionCount(req, res, options);

			finalResponse = {
				data: {
					status: responseViewLogs.status,
					result: (responseViewLogs && responseViewLogs.poll_logs) ? responseViewLogs.poll_logs : {},
					message: responseViewLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollInteractionOverview()


	/**
	 * Function is used to show interaction poll listing tabbing wise
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.interactionPollListing = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract and validate request parameters
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id || "";
			const pollPerformanceTab = req.body.performance_tab || "";
			const fromDate = req.body.from_date || "";
			const toDate = req.body.to_date || "";
			const searchPollTitle = req.body.search_poll_title || "";

			let page = req.body.page ? parseInt(req.body.page) : 1;
			let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			let dateWiseFilter = "";
			let dbCollection = '';
			let commonCondition = {};

			if (!userId || !fromDate || !toDate || !pollPerformanceTab) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Set dbCollection and commonCondition based on tab
			if (pollPerformanceTab == PERFORMANCE_PARTICIPANTS_TAB) {
				dbCollection = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
				commonCondition["make_poll_user_id"] = newObjectIdDefault(userId);
				commonCondition["user_id"] = { $nin: ['', null] };
			} else {
				dbCollection = db.collection(pollPerformanceTab);
				commonCondition["make_poll_user_id"] = newObjectIdDefault(userId);
			}

			// Date filter
			if (fromDate !== "" && toDate !== "") {
				dateWiseFilter = {
					$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
				commonCondition["created"] = {
					$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			}

			// Polls base conditions
			let conditions = {
				"user_id": newObjectIdDefault(userId),
				"is_published": POLL_PUBLISHED,
				"is_draft": POLL_NOT_DRAFTS,
			};

			// Search by poll title
			if (searchPollTitle !== "") {
				conditions['question'] = { $regex: new RegExp(searchPollTitle, "i") };
				commonCondition['poll_question'] = { $regex: new RegExp(searchPollTitle, "i") };
			}

			// Define aggregation lookups for each tab
			const pollParticipants = {
				$lookup: {
					from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
					let: { pollSlug: "$slug" },
					pipeline: [
						{
							$match: {
								'user_id': { $nin: [null, ""] },
								'make_poll_user_id': newObjectIdDefault(userId),
								'created': dateWiseFilter,
								$expr: { $and: [{ $eq: ["$poll_slug", "$$pollSlug"] }] },
							}
						},
						{ $project: { _id: 1 } },
						{ $count: "total_participants" }
					],
					as: "poll_participants"
				}
			};

			const pollVotes = {
				$lookup: {
					from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
					let: { pollSlug: "$slug" },
					pipeline: [
						{
							$match: {
								'created': dateWiseFilter,
								'make_poll_user_id': newObjectIdDefault(userId),
								$expr: { $and: [{ $eq: ["$poll_slug", "$$pollSlug"] }] },
							}
						},
						{ $project: { _id: 1 } },
						{ $count: "total_vote" }
					],
					as: "poll_vote_participants"
				}
			};

			const pollComments = {
				$lookup: {
					from: TABLE_POLLS_COMMENTS,
					let: { pollSlug: "$slug" },
					pipeline: [
						{
							$match: {
								'created': dateWiseFilter,
								'make_poll_user_id': newObjectIdDefault(userId),
								$expr: { $and: [{ $eq: ["$poll_slug", "$$pollSlug"] }] },
							}
						},
						{ $project: { _id: 1 } },
						{ $count: "total_comments" }
					],
					as: "poll_comments"
				}
			};

			const pollShares = {
				$lookup: {
					from: TABLE_SHARE_ICON_LOGS,
					let: { pollSlug: "$slug" },
					pipeline: [
						{
							$match: {
								'created': dateWiseFilter,
								'make_poll_user_id': newObjectIdDefault(userId),
								$expr: { $and: [{ $eq: ["$poll_slug", "$$pollSlug"] }] },
							}
						},
						{ $project: { _id: 1 } },
						{ $count: "total_shares" }
					],
					as: "poll_shares"
				}
			};

			const pollSpentTimes = {
				$lookup: {
					from: TABLE_POLL_TIME_SPENT_LOGS,
					let: { pollSlug: "$slug" },
					pipeline: [
						{
							$match: {
								'created': dateWiseFilter,
								'make_poll_user_id': newObjectIdDefault(userId),
								$expr: { $and: [{ $eq: ["$poll_slug", "$$pollSlug"] }] },
							}
						},
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
			};

			// Select lookups and sort key based on tab
			let finalTableData = [];
			let sortVaribleKey = "total_vote";
			if (pollPerformanceTab == PERFORMANCE_INTERACTIONS_TAB) {
				finalTableData = [pollVotes, pollComments, pollShares];
				sortVaribleKey = "total_interactions";
			} else if (pollPerformanceTab == PERFORMANCE_VOTES_TAB) {
				finalTableData = [pollVotes];
				sortVaribleKey = "total_vote";
			} else if (pollPerformanceTab == PERFORMANCE_SHARE_TAB) {
				finalTableData = [pollShares];
				sortVaribleKey = "total_shares";
			} else if (pollPerformanceTab == PERFORMANCE_COMMENTS_TAB) {
				finalTableData = [pollComments];
				sortVaribleKey = "total_comments";
			} else if (pollPerformanceTab == PERFORMANCE_PARTICIPANTS_TAB) {
				finalTableData = [pollParticipants];
				sortVaribleKey = "total_participants";
			} else if (pollPerformanceTab == PERFORMANCE_DWELL_TIME_TAB) {
				finalTableData = [pollSpentTimes];
				sortVaribleKey = "total_spent_time";
			}

			// Dynamic sorting
			let sortBy = req.body.sort_by ? req.body.sort_by : { [sortVaribleKey]: SORT_DESC };
			if (!(sortBy['created'] === SORT_DESC || sortBy['created'] === SORT_ASC)) {
				sortBy["created"] = SORT_DESC;
			}

			const polls = db.collection(TABLE_POLLS);

			// Prepare all queries as promises for parallel execution
			const pollPerformanceViewDetailPromise = (async () => {
				const agg = [
					{ $match: conditions },
					...finalTableData,
					{
						$project: {
							"_id": 1,
							"user_id": 1,
							"question": 1,
							"question_sort": { $toLower: "$question" },
							"slug": 1,
							"created": 1,
							"poll_vote_participants": 1,
							'total_vote': { $cond: [{ $arrayElemAt: ["$poll_vote_participants.total_vote", 0] }, { $arrayElemAt: ["$poll_vote_participants.total_vote", 0] }, 0] },
							'total_comments': { $cond: [{ $arrayElemAt: ["$poll_comments.total_comments", 0] }, { $arrayElemAt: ["$poll_comments.total_comments", 0] }, 0] },
							'total_shares': { $cond: [{ $arrayElemAt: ["$poll_shares.total_shares", 0] }, { $arrayElemAt: ["$poll_shares.total_shares", 0] }, 0] },
							'total_spent_time': { $cond: [{ $arrayElemAt: ["$spent_time.spent_time_count", 0] }, { $arrayElemAt: ["$spent_time.spent_time_count", 0] }, 0] },
							'total_participants': { $cond: [{ $arrayElemAt: ["$poll_participants.total_participants", 0] }, { $arrayElemAt: ["$poll_participants.total_participants", 0] }, 0] },
							'total_interactions': { $sum: [{ $arrayElemAt: ["$poll_vote_participants.total_vote", 0] }, { $arrayElemAt: ["$poll_comments.total_comments", 0] }, { $arrayElemAt: ["$poll_shares.total_shares", 0] }] },
						}
					},
					{ "$sort": sortBy },
					{ "$skip": skip },
					{ "$limit": limit },
				];
				let pollPerformanceViewResult = await polls.aggregate(agg).toArray();

				// Format dwell time if needed
				if (pollPerformanceTab == PERFORMANCE_DWELL_TIME_TAB) {
					pollPerformanceViewResult.forEach((recordsDwellTime) => {
						recordsDwellTime['total_spent_time'] = fancyTimeFormat(recordsDwellTime.total_spent_time);
					});
				}
				return pollPerformanceViewResult;
			})();

			const bracketInteractionCountPromise = (async () => {
				const agg = [
					{ $match: conditions },
					...finalTableData,
					{
						$project: {
							"_id": 0,
							'total_interactions': { $sum: [{ $arrayElemAt: ["$poll_vote_participants.total_vote", 0] }, { $arrayElemAt: ["$poll_comments.total_comments", 0] }, { $arrayElemAt: ["$poll_shares.total_shares", 0] }] }
						}
					},
				];
				const countResult = await polls.aggregate(agg).toArray();
				let totalinteractions = 0;
				countResult.forEach(function (recordsData) {
					let total = recordsData.total_interactions;
					totalinteractions += total;
				});
				return totalinteractions;
			})();

			const totalPollsPromise = polls.countDocuments(conditions);

			const totalCountPromise = (async () => {
				// Dwell time tab: sum spent_time, otherwise count by poll_slug
				if (pollPerformanceTab == PERFORMANCE_DWELL_TIME_TAB) {
					const agg = [
						{ $match: commonCondition },
						{
							$group: {
								'_id': null,
								'spent_time_count': { $sum: "$spent_time" },
							}
						},
						{
							$project: {
								"_id": 0,
								"spent_time_count": 1
							}
						}
					];
					const spentTimeSumResult = await dbCollection.aggregate(agg).toArray();
					let dwellTimeCount = (spentTimeSumResult.length > 0) ? spentTimeSumResult[0].spent_time_count : 0;
					let totalSpentTime = fancyTimeFormat(dwellTimeCount);
					return totalSpentTime;
				} else {
					const agg = [
						{ $match: commonCondition },
						{
							$group: {
								_id: { "poll_slug": "$poll_slug" },
								"total_poll": { $sum: 1 }
							}
						},
						{
							$project: {
								'_id': 0,
								'total_poll': 1,
							}
						},
					];
					const totalPollResult = await dbCollection.aggregate(agg).toArray();
					let totalPolls = 0;
					totalPollResult.forEach(function (recordsData) {
						let total = recordsData.total_poll;
						totalPolls += total;
					});
					return totalPolls;
				}
			})();

			// Run all queries in parallel
			const [
				pollPerformanceDetails,
				bracketInteractionCount,
				totalRecords,
				totalCount
			] = await Promise.all([
				pollPerformanceViewDetailPromise,
				bracketInteractionCountPromise,
				totalPollsPromise,
				totalCountPromise
			]);

			// Success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': pollPerformanceDetails || [],
					'recordsTotal': totalRecords || 0, // count total polls
					'total_count': (pollPerformanceTab == PERFORMANCE_INTERACTIONS_TAB) ? bracketInteractionCount : totalCount, // count total value tabbing wise
					'limit': limit,
					'page': page,
					'total_page': Math.ceil((totalRecords || 0) / limit),
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': 0,
					'recordsTotal': 0,
					'total_count': 0,
					'limit': 0,
					'page': 0,
					'total_page': 0,
					'message': res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end interactionPollListing()

	/**
	 * Function to get poll performance lead generation details using async/await.
	 * Handles validation, builds query options, and fetches lead generation details.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollPerformanceLeadGenerationDetails = async (req, res) => {
		let finalResponse = {};

		// Extract user and filter info from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const gender = req.body.gender ? parseInt(req.body.gender) : "";
		const zipCode = req.body.zip_code ? req.body.zip_code : "";
		const zipSearchKeyword = isNaN(zipCode) ? zipCode : Number(zipCode);
		const ageFilter = req.body.user_age ? req.body.user_age : "";

		// Validate required fields
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

		// Prepare options for lead generation query
		const options = {
			"user_id": newObjectIdDefault(userId),
			"gender": gender,
			"zip_code": zipSearchKeyword,
			"age": ageFilter
		};

		try {
			// Fetch poll performance lead generation details asynchronously
			const responseView = await pollPerformanceLeadGeneration(req, res, options);

			finalResponse = {
				data: {
					status: responseView.status,
					result: (responseView && responseView.result) ? responseView.result : {},
					message: responseView.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollPerformanceLeadGenerationDetails()


	/**
	 * Function for viewing interaction poll details using async/await.
	 * Handles validation, builds query options, and fetches poll details.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.interactionPollDetails = async (req, res) => {
		let finalResponse = {};

		// Extract user and poll info from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";

		// Validate required fields
		if (!userId || !pollId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for poll details query
		const options = {
			"user_id": newObjectIdDefault(userId),
			"poll_id": pollId,
			"from_date": fromDate,
			"to_date": toDate
		};

		try {
			// Fetch poll interaction details asynchronously
			const responseViewDetails = await viewInteractionPollDetails(req, res, options);

			finalResponse = {
				data: {
					status: responseViewDetails.status,
					poll_result: (responseViewDetails && responseViewDetails.poll_result) ? responseViewDetails.poll_result : {},
					result: responseViewDetails.result,
					message: responseViewDetails.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end interactionPollDetails()

	/**
	 * Function for viewing interaction poll options details using async/await.
	 * Handles validation, builds query options, and fetches poll performance option vote graph reports.
	 * @param {*} req
	 * @param {*} res
	 * @returns json response
	 */
	this.interactionPollOptionsDetails = async (req, res) => {
		let finalResponse = {};

		// Extract user and request data
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";
		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const pollOptionId = req.body.poll_option_id ? newObjectIdDefault(req.body.poll_option_id) : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate || !pollId || !pollOptionId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for poll option details query
		const options = {
			"user_id": newObjectIdDefault(userId),
			"from_date": fromDate,
			"to_date": toDate,
			"unregistered_participants": true,
			"view_type_filter": "",
			"poll_id": pollId,
			"poll_option_id": pollOptionId,
		};

		try {
			// Fetch poll performance option vote graph reports asynchronously
			const responseGraphData = await pollVoteGraphReports(req, res, options);

			finalResponse = {
				data: {
					status: responseGraphData.status,
					result: (responseGraphData && responseGraphData.poll_logs) ? responseGraphData.poll_logs : {},
					message: responseGraphData.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end interactionPollOptionsDetails()

	/**
	 * Function to add assumption reports using async/await.
	 * Handles validation, builds options, and saves the assumption report.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.addAsumptionReports = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and report details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const pollIds = req.body.poll_ids ? req.body.poll_ids : [];
			const reportName = req.body.report_name ? req.body.report_name : "";
			const reportDescription = req.body.report_description ? req.body.report_description : "";
			const fromDate = req.body.from_date ? req.body.from_date : "";
			const toDate = req.body.to_date ? req.body.to_date : "";

			// Validate required fields
			if (!userId || !reportName || !reportDescription || !fromDate || !toDate) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						assumption_report_slug: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if at least one poll is selected
			if (!Array.isArray(pollIds) || pollIds.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						assumption_report_slug: '',
						message: res.__("front.polls.please_select_atleast_one_poll"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for saving the assumption report
			const options = {
				user_id: userId,
				poll_ids: pollIds,
				report_name: reportName,
				report_description: reportDescription,
				from_date: fromDate,
				to_date: toDate
			};

			// Save the assumption report asynchronously
			const saveResponse = await saveAssumptionReport(req, res, options);

			finalResponse = {
				data: {
					status: saveResponse.status,
					assumption_report_slug: saveResponse.assumption_report_slug,
					message: saveResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					assumption_report_slug: '',
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end addAsumptionReports()

	/**
	 * Function to get assumption report list using async/await.
	 * Handles validation, builds query options, and fetches report list and count in parallel.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.assumptionReportList = async (req, res) => {
		let finalResponse = {};

		// Extract user id from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		// Pagination and sorting
		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const sortBy = req.body.sort_by ? req.body.sort_by : { "created": SORT_DESC };
		const skip = (limit * page) - limit;

		// Validate user id
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

		// Build query conditions
		const conditions = {
			"is_deleted": NOT_DELETED,
			"user_id": newObjectIdDefault(userId),
		};

		const assumptionReport = db.collection(TABLE_ASSUMPTION_REPORTS);

		try {
			// Prepare aggregation pipeline for report list
			const reportListPipeline = [
				{ $match: conditions },
				{
					$project: {
						"_id": 1,
						"slug": 1,
						"report_name": 1,
						"report_name_sort": { $toLower: "$report_name" },
						"report_description": 1,
						"is_deleted": 1,
						"created": 1,
						"from_date": 1,
						"to_date": 1
					}
				},
				{ $sort: sortBy },
				{ $skip: skip },
				{ $limit: limit },
			];

			// Run both queries in parallel
			const [assumptionList, totalRecords] = await Promise.all([
				assumptionReport.aggregate(reportListPipeline).toArray(),
				assumptionReport.countDocuments(conditions)
			]);

			// Success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: assumptionList || [],
					recordsTotal: totalRecords || 0,
					limit: limit,
					page: page,
					total_page: Math.ceil((totalRecords || 0) / limit),
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Error response
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: 0,
					recordsTotal: 0,
					limit: 0,
					page: 0,
					total_page: 0,
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end assumptionReportList()

	/**
	 * Function to get assumption details using async/await.
	 * Handles validation, builds query, and fetches assumption report details.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAssumptionDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and assumption slug from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const assumptionSlug = req.body.assumption_slug ? req.body.assumption_slug : "";

			// Validate required fields
			if (!userId || !assumptionSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get the assumption report collection
			const assumptionReport = db.collection(TABLE_ASSUMPTION_REPORTS);

			// Build query condition
			const query = {
				"user_id": newObjectIdDefault(userId),
				"slug": assumptionSlug,
				"is_deleted": NOT_DELETED
			};

			// Fetch assumption details asynchronously
			const detailResult = await assumptionReport.findOne(query);

			if (detailResult) {
				// Success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: detailResult,
						message: "",
					}
				};
			} else {
				// Error response: No record found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Error response: Exception occurred
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAssumptionDetails()

	/**
	 * Function to get Age and Gender dropdowns
	 * Uses async/await for future extensibility and clean formatting.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAgeDropdown = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user data from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";

			// Validate user ID
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

			// In future, if dropdowns are fetched from DB, use async/await here
			// For now, use static values
			const ageDropdown = typeof AGES_DROPDOWN !== "undefined" ? AGES_DROPDOWN : [];
			const genderDropdown = typeof GENDER_TYPE_DROP_DOWN !== "undefined" ? GENDER_TYPE_DROP_DOWN : [];

			if (ageDropdown.length > 0) {
				// Success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: ageDropdown,
						gender: genderDropdown,
						message: "",
					}
				};
			} else {
				// Error response: No records found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: ageDropdown,
						gender: genderDropdown,
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAgeDropdown()

	/**
	 * Function to delete an assumption report using async/await.
	 * Handles validation, builds query options, and deletes the assumption report.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deleteAssumptionReport = async (req, res) => {
		let finalResponse = {};
		try {
			// Extract user and assumption ID from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const assumptionId = req.body.assumption_id ? req.body.assumption_id : "";

			// Validate required fields
			if (!userId || !assumptionId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build options for deletion
			const deleteOptions = {
				"user_id": newObjectIdDefault(userId),
				"assumption_id": newObjectIdDefault(assumptionId),
			};

			// Delete the assumption report asynchronously
			const deleteResponse = await deletePerformanceAssumptionReport(req, res, deleteOptions);

			finalResponse = {
				data: {
					status: deleteResponse.status,
					result: deleteResponse.result,
					message: deleteResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end deleteAssumptionReport()

	/**
	 * Function is used to view assumption performance first report 
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.viewAssumptionPerformanceFirstSection = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract and validate user and request parameters
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const fromDate = req.body.from_date ? req.body.from_date : "";
			const toDate = req.body.to_date ? req.body.to_date : "";
			const pollSlugs = req.body.poll_slugs ? req.body.poll_slugs : [];

			// Validate required fields
			if (!userId || pollSlugs.length === 0 || !fromDate || !toDate) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for the report query
			const options = {
				"user_id": newObjectIdDefault(userId),
				"poll_slug": pollSlugs,
				"from_date": fromDate,
				"to_date": toDate,
			};

			// Fetch the assumption report for the first section asynchronously
			const viewResponse = await assumptionReportViewFirstSection(req, res, options);

			finalResponse = {
				data: {
					status: viewResponse.status,
					poll_result: (viewResponse && viewResponse.poll_result) ? viewResponse.poll_result : {},
					result: viewResponse.result,
					color_code: PERFORMANCE_COLOR_CODE,
					message: viewResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end viewAssumptionPerformanceFirstSection()

	/**
	 * Function to get poll performance view assumption report gender breakdown
	 * Uses async/await for cleaner asynchronous handling.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.viewAssumptionPerformanceGenderBreakdown = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request parameters
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const fromDate = req.body.from_date ? req.body.from_date : "";
			const toDate = req.body.to_date ? req.body.to_date : "";
			const pollSlugs = req.body.poll_slugs ? req.body.poll_slugs : [];

			// Validate required fields
			if (!userId || pollSlugs.length === 0 || !fromDate || !toDate) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for the gender breakdown query
			const options = {
				"user_id": newObjectIdDefault(userId),
				"from_date": fromDate,
				"to_date": toDate,
				"poll_slug": pollSlugs,
				"unregistered_participants": true,
			};

			// Fetch gender-wise vote details asynchronously
			const responsePollVoteUser = await pollEngagementGenderTotalVoteCount(req, res, options);

			finalResponse = {
				data: {
					status: responsePollVoteUser.status,
					result: (responsePollVoteUser && responsePollVoteUser.vote_polls) ? responsePollVoteUser.vote_polls : {},
					message: responsePollVoteUser.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end viewAssumptionPerformanceGenderBreakdown()

	/**
	 * Function to get poll performance view report campaign breakdown using async/await.
	 * Handles validation, builds query options, and fetches poll breakdown data in parallel per poll.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.viewAssumptionPerformanceCampaignBreakdown = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and date info from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const fromDate = req.body.from_date ? req.body.from_date : "";
			const toDate = req.body.to_date ? req.body.to_date : "";
			const pollIdsArray = req.body.poll_ids ? req.body.poll_ids : "";

			// Validate required fields
			if (!userId || !Array.isArray(pollIdsArray) || pollIdsArray.length === 0 || !fromDate || !toDate) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let allSelectedPollsDetailsArray = [];

			// Loop through each poll and fetch breakdown data in series (await per poll)
			for (const item of pollIdsArray) {
				const pollId = item ? newObjectIdDefault(item) : "";

				if (!pollId) {
					// If pollId is invalid, push default error structure
					allSelectedPollsDetailsArray.push({
						'average_percentage': 0,
						'difference_from_average_height': 0,
						'difference_from_average_lowest': 0,
						'poll_result': {},
						'options_name': [],
						'options_color_code': [],
						'options': [],
						'male_options': [],
						'female_options': [],
						'age_range_array_vote': [],
					});
					continue;
				}

				// Prepare common query options
				const commonConditionOptions = {
					"user_id": newObjectIdDefault(userId),
					"poll_id": newObjectIdDefault(pollId),
					"from_date": fromDate,
					"to_date": toDate
				};

				const maleGenderCondition = { ...commonConditionOptions, gender_type: MALE };
				const femaleGenderCondition = { ...commonConditionOptions, gender_type: FEMALE };
				const otherGenderCondition = { ...commonConditionOptions, gender_type: OTHER };

				// Prepare age option data
				const ageOptionData = {
					'user_id': newObjectIdDefault(userId),
					'poll_id': newObjectIdDefault(pollId),
					"from_date": fromDate,
					"to_date": toDate,
				};

				// Run all poll breakdown queries in parallel for this poll
				const [
					allOptionsData,
					maleOptionsData,
					femaleOptionsData,
					otherOptionsData,
					ageRangeOptionsData
				] = await Promise.all([
					// Option wise vote percentage
					viewInteractionPollDetails(req, res, commonConditionOptions),
					// Male gender option wise vote percentage
					viewInteractionPollDetails(req, res, maleGenderCondition),
					// Female gender option wise vote percentage
					viewInteractionPollDetails(req, res, femaleGenderCondition),
					// Other gender option wise vote percentage
					viewInteractionPollDetails(req, res, otherGenderCondition),
					// Age range wise options vote
					ageRangeWiseOptionVoteCount(req, res, ageOptionData)
				]);

				const pollResult = (allOptionsData && allOptionsData['poll_result']) ? allOptionsData['poll_result'] : {};
				const allOptionPercentageResult = (allOptionsData && allOptionsData['result']) ? allOptionsData['result'] : [];
				const maleOptionPercentageResult = (maleOptionsData && maleOptionsData['result']) ? maleOptionsData['result'] : [];
				const femaleOptionPercentageResult = (femaleOptionsData && femaleOptionsData['result']) ? femaleOptionsData['result'] : [];
				const otherOptionPercentageResult = (otherOptionsData && otherOptionsData['result']) ? otherOptionsData['result'] : [];
				const ageRangeOptions = Array.isArray(ageRangeOptionsData) ? ageRangeOptionsData : [];

				// Assign color codes and build male/female/other count arrays
				let colorCodeOptionGet = {};
				let optionNameBlankArray = [];

				if (maleOptionPercentageResult.length > 0) {
					maleOptionPercentageResult.forEach((records, index) => {
						optionNameBlankArray.push([]);
						colorCodeOptionGet[records['_id']] = records.color_code;
						maleOptionPercentageResult[index]['count_array_male_female'] = [
							femaleOptionPercentageResult[index]?.option_vote_count || 0,
							records.option_vote_count,
							otherOptionPercentageResult[index]?.option_vote_count || 0
						];
						femaleOptionPercentageResult[index]['count_array_male_female'] = [
							femaleOptionPercentageResult[index]?.option_vote_count || 0,
							records.option_vote_count,
							otherOptionPercentageResult[index]?.option_vote_count || 0
						];
					});
				}

				// Prepare arrays for option titles, color codes, vote counts, and percentage text
				let optionTitleNameArray = [];
				let optionColorCodeArray = [];
				let optionAllVoteArrayConcat = [];
				let higherPercentageTextData = [];
				let LowerPercentageTextData = [];

				// Calculate average and difference for age graph text
				const overallTotalVote = (pollResult && pollResult.total_count) ? pollResult.total_count : 0;
				const totalAgeGroup = AGE_COMBINE_ARRAY.length;
				const averagePercentage = round(overallTotalVote / totalAgeGroup);
				const differenceAverageGreaterValue = Number(res.locals.settings["Site.difference_from_this_average_is_greater_than"]);
				const differenceFromAverageHigher = averagePercentage + differenceAverageGreaterValue;
				const differenceFromAverageLower = differenceAverageGreaterValue - averagePercentage;

				// Assign color code, calculate percentage, and build text data for age range options
				if (ageRangeOptions.length > 0) {
					ageRangeOptions.forEach((recordsAge, recordsAgeIndex) => {
						const ageGroupName = recordsAge.age ? recordsAge.age : "";
						const totalSumVote = recordsAge.total_sum_vote ? recordsAge.total_sum_vote : 0;

						if (recordsAge && Array.isArray(recordsAge['result']) && recordsAge['result'].length > 0) {
							recordsAge['result'].forEach((recordsOption, recordsOptionIndex) => {
								recordsOption['color_code'] = colorCodeOptionGet[recordsOption._id];

								// Concat option title wise data
								const totalVote = recordsOption.total_vote ? recordsOption.total_vote : 0;
								optionAllVoteArrayConcat.push(totalVote);

								// Calculate percentage
								const optionPercentage = calculatePercentage(totalVote, totalSumVote);
								recordsOption['percentage'] = optionPercentage;

								// Push option name and color code
								if (recordsAgeIndex === 0) {
									optionTitleNameArray.push(recordsOption.option_title);
									optionColorCodeArray.push(recordsOption.color_code);
								}

								// Calculate higher/lower percentage age graph text
								if (ageGroupName !== NO_AGE_CONSTANT && totalVote !== 0 && differenceFromAverageHigher < optionPercentage) {
									higherPercentageTextData.push({ "age": ageGroupName, "title": recordsOption.option_title });
								}
								if (ageGroupName !== NO_AGE_CONSTANT && totalVote !== 0 && differenceFromAverageLower > optionPercentage) {
									LowerPercentageTextData.push({ "age": ageGroupName, "title": recordsOption.option_title });
								}
							});
						}
					});
				}

				// Adjust matrix array for age range wise vote
				if (optionAllVoteArrayConcat.length > 0) {
					for (let i = 0; i < optionAllVoteArrayConcat.length; i++) {
						for (let j = 0; j < optionNameBlankArray.length; j++) {
							optionNameBlankArray[j].push(optionAllVoteArrayConcat[i]);
							if (j < (optionNameBlankArray.length - 1)) {
								i++;
							}
						}
					}
				}

				// Build poll breakdown result for this poll
				const sendOptins = {
					'higher_text': (higherPercentageTextData.length > 0) ? merageHeigherLowerArray(higherPercentageTextData) : [],
					'lower_text': (LowerPercentageTextData.length > 0) ? merageHeigherLowerArray(LowerPercentageTextData) : [],
					'average_percentage': averagePercentage,
					'difference_from_average_height': differenceFromAverageHigher,
					'difference_from_average_lowest': differenceFromAverageLower,
					'poll_result': pollResult,
					'options_name': optionTitleNameArray,
					'options_color_code': optionColorCodeArray,
					'options': allOptionPercentageResult,
					'male_options': maleOptionPercentageResult,
					'female_options': femaleOptionPercentageResult,
					'age_range_options': ageRangeOptions,
					'age_range_array_vote': optionNameBlankArray,
				};
				allSelectedPollsDetailsArray.push(sendOptins);
			}

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					age_combine_array: AGE_COMBINE_ARRAY,
					result: allSelectedPollsDetailsArray,
					message: ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end viewAssumptionPerformanceCampaignBreakdown()

	/**Merge array same age group higher lower */
	function merageHeigherLowerArray(arrays) {
		const map = new Map(arrays.map(({ title, age }) => [title, { title, age: [] }]));
		for (let { title, age } of arrays) map.get(title).age.push(...[age].flat());
		return [...map.values()];
	}// end merageHeigherLowerArray()

	/**
	 * Function to get poll performance view report General Revelations using async/await.
	 * Handles validation, builds query options, and fetches male/female general revelations in parallel.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.viewAssumptionPerformanceGeneralRevelation = async (req, res) => {
		let finalResponse = {};

		// Extract user and request data
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";
		const pollSlugs = req.body.poll_slugs ? req.body.poll_slugs : "";

		// Validate required fields
		if (!userId || !pollSlugs || pollSlugs.length === 0 || !fromDate || !toDate) {
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
			// Prepare base options for both male and female queries
			const baseAgeOptionData = {
				'user_id': newObjectIdDefault(userId),
				'poll_slugs': pollSlugs,
				'from_date': fromDate,
				'to_date': toDate
			};

			// Run male and female general revelations queries in parallel using Promise.all
			const [maleGeneralRevelations, femaleGeneralRevelations] = await Promise.all([
				// Male general revelations
				(async () => {
					const ageOptionData = { ...baseAgeOptionData, gender_type: MALE };
					return await ageRangeWisePollAndOptionVoteCount(req, res, ageOptionData);
				})(),
				// Female general revelations
				(async () => {
					const ageOptionData = { ...baseAgeOptionData, gender_type: FEMALE };
					return await ageRangeWisePollAndOptionVoteCount(req, res, ageOptionData);
				})()
			]);

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					male: maleGeneralRevelations || [],
					female: femaleGeneralRevelations || [],
					message: '',
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end viewAssumptionPerformanceGeneralRevelation()
}
module.exports = new PollPerformanceReport();