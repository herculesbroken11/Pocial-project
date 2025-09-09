const async = require('async');

function PollSegment() {

	/**
	 * Function to show poll listing with total votes using async/await.
	 * Handles validation, builds query options, and fetches poll list and total count in parallel.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getSegmentPollList = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request data
			let loginUserData = (req.user_data) ? req.user_data : "";
			let userId = (loginUserData._id) ? loginUserData._id : "";
			let fromDate = (req.body.from_date) ? req.body.from_date : "";
			let toDate = (req.body.to_date) ? req.body.to_date : "";
			let searchPollTitle = (req.body.search_poll_title) ? req.body.search_poll_title : "";
			let pollIds = (req.body.poll_ids) ? req.body.poll_ids : [];

			let page = (req.body.page) ? parseInt(req.body.page) : 1;
			let limit = (req.body.limit) ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;

			let skip = (limit * page) - limit;

			const polls = db.collection(TABLE_POLLS);

			// Validate required fields
			if (!userId || !fromDate || !toDate) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build lookup condition for poll votes
			let lookupCondition = {
				'user_id': { $nin: [null, ""] },
				$expr: {
					$and: [
						{ $eq: ["$poll_id", "$$pollId"] },
					]
				},
			};

			// Add date filter to lookup condition
			if (fromDate !== '' && toDate !== '') {
				if (fromDate == ALL_DATE_FILTER) {
					lookupCondition["created"] = {
						$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
					};
				} else {
					lookupCondition["created"] = {
						$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
						$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
					};
				}
			}

			// Build poll query condition
			let pollCondition = {
				"user_id": newObjectIdDefault(userId),
				"is_deleted": NOT_DELETED,
				"is_published": POLL_PUBLISHED,
			};

			// Filter by poll question title if provided
			if (searchPollTitle !== "") {
				pollCondition['question'] = { $regex: new RegExp(searchPollTitle, "i") };
			}

			// Filter by poll IDs if provided
			let pollIdsArray = [];
			if (pollIds.length > 0) {
				pollIdsArray = pollIds.map((pollId) => newObjectIdDefault(pollId));
			}
			if (pollIdsArray.length > 0) {
				pollCondition['_id'] = { $in: pollIdsArray };
			}

			// Prepare aggregation pipeline for poll list
			const pollListPipeline = [
				{ $match: pollCondition },
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
						let: { pollId: "$_id" },
						pipeline: [
							{ $match: lookupCondition },
							{ $project: { _id: 1 } },
							{ $count: "total_vote" }
						],
						as: "poll_vote"
					}
				},
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
							{ "$project": { full_name: 1, slug: 1, profile_image: 1 } }
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						"question": 1,
						"slug": 1,
						"created": 1,
						"options_type": 1,
						"question_media": 1,
						"question_extension": 1,
						"question_video_name": 1,
						"total_count": { $cond: ["$total_count", "$total_count", 0] },
						"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
						"total_vote": {
							$cond: [
								{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
								{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
								0
							]
						},
						"user_name": { $arrayElemAt: ["$userDetails.full_name", 0] },
						"user_profile_image": { $arrayElemAt: ["$userDetails.profile_image", 0] },
						"user_slug": { $arrayElemAt: ["$userDetails.slug", 0] },
					}
				},
				{ "$sort": { "total_vote": SORT_DESC, "total_count": SORT_DESC } },
				{ "$skip": skip },
				{ "$limit": limit },
			];

			// Run poll list and total count queries in parallel using Promise.all
			const [pollDetails, totalRecords] = await Promise.all([
				// Get poll list with aggregation
				polls.aggregate(pollListPipeline).toArray(),
				// Get total count of polls
				polls.countDocuments(pollCondition)
			]);

			// Success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'users_url': USERS_URL,
					'polls_url': POLLS_URL,
					'result': pollDetails || [],
					'recordsTotal': totalRecords || 0,
					'draft_segment_name': "Draft-" + new Date().getTime(),
					'limit': limit,
					'page': page,
					'total_page': Math.ceil((totalRecords || 0) / limit),
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'users_url': USERS_URL,
					'polls_url': POLLS_URL,
					'draft_segment_name': "Draft-" + new Date().getTime(),
					'result': 0,
					'recordsTotal': 0,
					'limit': 0,
					'page': 0,
					'total_page': 0,
					'message': error.message || res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSegmentPollList()

	/**
	 * Function to create a poll common segment using async/await.
	 * Handles validation, builds options, and saves poll segment.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.addPollCommonSegment = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const pollIds = req.body.poll_ids ? req.body.poll_ids : [];
			const segmentName = req.body.segment_name ? req.body.segment_name : "";
			const segmentDescription = req.body.segment_description ? req.body.segment_description : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : ""; // for edit, remove draft
			const isDraft = req.body.is_draft ? req.body.is_draft : SEGMENT_NOT_DRAFTS;
			const fromDate = req.body.from_date ? req.body.from_date : "";
			const toDate = req.body.to_date ? req.body.to_date : "";

			// Validate required fields
			if (!userId || !segmentName || !fromDate || !toDate || !segmentDescription) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if at least one poll is selected
			if (pollIds.length > 0) {
				// Build options for saving poll segment
				const options = {
					user_id: userId,
					poll_ids: pollIds,
					segment_type: COMMON_POLLS,
					segment_name: segmentName,
					from_date: fromDate,
					to_date: toDate,
					segment_description: segmentDescription,
					is_draft: isDraft,
					segment_slug: segmentSlug,
				};

				// Save poll segment using async/await
				const saveResponse = await savePollSegment(req, res, options);

				finalResponse = {
					data: {
						status: saveResponse.status,
						segment_slug: saveResponse.segment_slug,
						result: {},
						message: saveResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error message if no poll is selected
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						segment_slug: "",
						result: {},
						message: res.__("front.polls.please_select_atleast_one_poll"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					segment_slug: "",
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End addPollCommonSegment()

	/**
	 * Function to edit poll common segment using async/await.
	 * Handles validation, builds query options, and updates the poll segment.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.editPollCommonSegment = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const pollIds = req.body.poll_ids ? req.body.poll_ids : [];
			const segmentName = req.body.segment_name ? req.body.segment_name : "";
			const segmentDescription = req.body.segment_description ? req.body.segment_description : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : ""; // for edit, remove draft
			const isDraft = req.body.is_draft ? req.body.is_draft : SEGMENT_NOT_DRAFTS;
			const fromDate = req.body.from_date ? req.body.from_date : "";
			const toDate = req.body.to_date ? req.body.to_date : "";

			// Validate required fields
			if (!userId || !segmentSlug || !segmentName || !fromDate || !toDate || !segmentDescription) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if at least one poll is selected
			if (pollIds.length > 0) {
				// Build options for editing the poll segment
				const options = {
					user_id: userId,
					poll_ids: pollIds,
					segment_type: COMMON_POLLS,
					segment_name: segmentName,
					from_date: fromDate,
					to_date: toDate,
					segment_description: segmentDescription,
					is_draft: isDraft,
					segment_slug: segmentSlug,
				};

				// Update poll segment using async/await
				const saveResponse = await editPollCommonSegment(req, res, options);

				finalResponse = {
					data: {
						status: saveResponse.status,
						segment_slug: saveResponse.segment_slug,
						result: {},
						message: saveResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error message if no poll is selected
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						segment_slug: "",
						result: {},
						message: res.__("front.polls.please_select_atleast_one_poll"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					segment_slug: "",
					result: {},
					message: error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editPollCommonSegment()

	/**
	 * Function to get unique vote options count using async/await.
	 * Handles validation, builds query options, and fetches unique vote options count.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.getUniqueVoteOptionsCount = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			let loginUserData = (req.user_data) ? req.user_data : "";
			let userId = (loginUserData._id) ? loginUserData._id : "";
			let pollId = (req.body.poll_id) ? newObjectIdDefault(req.body.poll_id) : "";
			let fromDate = (req.body.from_date) ? req.body.from_date : "";
			let toDate = (req.body.to_date) ? req.body.to_date : "";

			// Validate required fields
			if (!userId || !pollId) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'poll_url': POLLS_URL,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build options for unique vote options count
			let uniqueVoteOptions = {
				'user_id': userId,
				'poll_id': pollId,
				'from_date': fromDate,
				'to_date': toDate,
			};

			// Fetch unique vote options count using async/await
			const saveResponse = await uniqueVoteOptionsCountSegment(req, res, uniqueVoteOptions);

			finalResponse = {
				'data': {
					'status': saveResponse.status,
					'poll_url': saveResponse.poll_url,
					'result': saveResponse.result,
					'message': saveResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'poll_url': POLLS_URL,
					'result': {},
					'message': error.message || res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getUniqueVoteOptionsCount()

	/**
	 * Function to add segment voter response data using async/await.
	 * Handles validation, builds options, and saves poll voter response segment data.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.addSegmentVoterResponse = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const voterResponseData = req.body.voter_response_data ? req.body.voter_response_data : [];
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if at least one poll is selected
			if (voterResponseData.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.polls.please_select_atleast_one_poll"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build options for saving poll voter response segment data
			const optionsVoterResponse = {
				user_id: userId,
				voter_response_data: voterResponseData,
				segment_slug: segmentSlug
			};

			// Save poll voter response segment data using async/await
			const saveResponse = await savePollVoterResponseSegment(req, res, optionsVoterResponse);

			finalResponse = {
				data: {
					status: saveResponse.status,
					result: {},
					message: saveResponse.message
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
	}; // End addSegmentVoterResponse()


	/**
	 * Function to get selected poll-wise listing using async/await.
	 * Handles validation, builds query options, and fetches selected options data.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.selectedPollWiseListing = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
			const listingType = req.body.listing_type ? req.body.listing_type : "";

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						poll_url: POLLS_URL,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build options for fetching selected options data
			const optionsData = {
				user_id: userId,
				segment_slug: segmentSlug,
				listing_type: listingType,
			};

			// Fetch selected options data using async/await
			const responseData = await getSelectedOptionsData(req, res, optionsData);

			finalResponse = {
				data: {
					status: responseData.status,
					users_url: responseData.users_url,
					polls_url: responseData.polls_url,
					segment_name: responseData.segment_name,
					is_draft: responseData.is_draft,
					segment_description: responseData.segment_description,
					result: responseData.result,
					from_date: responseData.from_date,
					to_date: responseData.to_date,
					message: responseData.message
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
	}; // End selectedPollWiseListing();


	/**
	 * Function for user to add segment Demographics using async/await.
	 * Handles validation, sanitization, and saves demographics data.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.addSegmentDemographics = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const demographicsData = req.body.demographics_data ? req.body.demographics_data : {};
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if demographics data is provided
			if (Object.keys(demographicsData).length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.polls.please_select_atleast_one_age_select"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for saving demographics
			const optionsVoterResponse = {
				user_id: userId,
				demographics_data: demographicsData,
				segment_slug: segmentSlug
			};

			// Save poll voter response segment data using async/await
			const saveResponse = await saveSegmentDemographics(req, res, optionsVoterResponse);

			finalResponse = {
				data: {
					status: saveResponse.status,
					result: {},
					message: saveResponse.message
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
	}; // End addSegmentDemographics();

	/**
	 * Function for get segment user voted list
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getSegmentUserVotedList = async (req, res) => {
		let finalResponse = {};

		// Get user id and segment slug from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";

		let page = req.body.page ? parseInt(req.body.page) : 1;
		let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		let sortBy = req.body.sort_by ? req.body.sort_by : { "created": SORT_DESC };

		let skip = (limit * page) - limit;

		if (!userId || !segmentSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Set collections
		const polls = db.collection(TABLE_POLLS);
		const pollSegment = db.collection(TABLE_POLL_SEGMENT);
		const pollsParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		try {
			// Find the segment for the user and slug
			const segmentResult = await pollSegment.findOne({
				user_id: userId,
				slug: segmentSlug
			});

			if (!segmentResult) {
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

			let segmentId = segmentResult._id ? newObjectIdDefault(segmentResult._id) : "";
			let segmentType = segmentResult.segment_type ? segmentResult.segment_type : "";
			let voterResponsePollIds = segmentResult.voter_response_poll_ids ? segmentResult.voter_response_poll_ids : [];
			let commonPollIds = segmentResult.poll_ids ? segmentResult.poll_ids : [];
			let voterResponseOptionIds = segmentResult.voter_response_option_ids ? segmentResult.voter_response_option_ids : [];
			let voterResponse = segmentResult.voter_response ? segmentResult.voter_response : [];
			let demographicsData = segmentResult.demographics ? segmentResult.demographics : {};
			let fromDate = segmentResult.simple_from_date ? segmentResult.simple_from_date : "";
			let toDate = segmentResult.simple_to_date ? segmentResult.simple_to_date : "";
			let selectedPollIds = (segmentType == COMMON_POLLS) ? commonPollIds : voterResponsePollIds;

			let maleDemographicsData = (demographicsData && demographicsData.male) ? demographicsData.male : [];
			let femaleDemographicsData = (demographicsData && demographicsData.female) ? demographicsData.female : [];
			let otherDemographicsData = (demographicsData && demographicsData.other) ? demographicsData.other : [];
			let businessDemographicsData = (demographicsData && demographicsData.business) ? demographicsData.business : [];

			// If segment type is COMMON_POLLS, prepare voterResponse accordingly
			if (segmentType == COMMON_POLLS) {
				let commonVoterData = [];
				commonPollIds.forEach(records => {
					commonVoterData.push({
						"poll_id": records
					});
				});
				voterResponse = commonVoterData;
			}

			// Build query conditions
			let conditions = {
				'make_poll_user_id': newObjectIdDefault(userId),
				"poll_id": { $in: selectedPollIds },
				'user_id': { $nin: ['', null] },
			};

			// Date filter
			if (fromDate !== '' && toDate !== '') {
				if (fromDate == ALL_DATE_FILTER) {
					conditions["created"] = {
						$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
					};
				} else {
					conditions["created"] = {
						$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
						$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
					};
				}
			}

			let conditionAge = [];

			// Demographics filter
			if (segmentType == DEMOGRAPHICS) {
				conditions['option_id'] = { $in: voterResponseOptionIds };

				// Male demographics
				if (maleDemographicsData.length > 0) {
					maleDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": MALE, "age": { "$gte": 0, "$lt": AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": MALE, "age": { "$gt": AGE_OVER_70 } });
						} else {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": MALE, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": { $ne: MALE } });
				}

				// Female demographics
				if (femaleDemographicsData.length > 0) {
					femaleDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": FEMALE, "age": { "$gte": 0, "$lt": AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": FEMALE, "age": { "$gt": AGE_OVER_70 } });
						} else {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": FEMALE, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": { $ne: FEMALE } });
				}

				// Other demographics
				if (otherDemographicsData.length > 0) {
					otherDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": OTHER, "age": { "$gte": 0, "$lt": AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": OTHER, "age": { "$gt": AGE_OVER_70 } });
						} else {
							conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": OTHER, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": { $ne: OTHER } });
				}

				// Business demographics
				if (businessDemographicsData.length > 0) {
					businessDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, "age": { "$gte": 0, "$lt": AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, "age": { "$gt": AGE_OVER_70 } });
						} else {
							conditionAge.push({ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE } });
				}

				// Add age/gender conditions to main query
				if (conditionAge.length > 0) {
					conditions['$or'] = conditionAge;
				}
			}

			// Prepare parallel queries using Promise.all
			const getPollNamePromise = polls.find(
				{ '_id': { $in: selectedPollIds } },
				{ projection: { "question": 1 } }
			).sort({ '_id': SORT_ASC }).toArray();

			const getVotedUserListPromise = (async () => {
				let segmentListResult = await pollsParticipants.aggregate([
					{ $match: conditions },
					{
						$group: {
							"_id": "$user_id",
							"age": { "$last": "$age" },
							"zip": { "$last": "$zip" },
							"gender": { "$last": "$gender" },
							"created": { "$last": '$created' },
							"account_type": { "$last": '$account_type' },
						}
					},
					{
						$lookup: {
							from: TABLE_USERS,
							let: { userId: "$_id" },
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
								{ "$project": { 'slug': 1, 'email': 1, 'show_segment': 1 } }
							],
							as: "userDetails"
						}
					},
					{
						$lookup: {
							from: TABLE_POLL_SEGMENT_WINNER_REWARD_LOGS,
							let: { userId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$segment_id", segmentId] },
												{ $eq: ["$user_id", "$$userId"] },
											]
										},
									}
								},
								{ "$project": { 'is_rewarded': 1, 'is_winner': 1 } }
							],
							as: "WinnerRewardDetails"
						}
					},
					{
						"$addFields": {
							"email": { $arrayElemAt: ["$userDetails.email", 0] },
							"user_name": { $arrayElemAt: ["$userDetails.slug", 0] },
							"show_segment": { $arrayElemAt: ["$userDetails.show_segment", 0] },
							"is_rewarded": { $cond: [{ $arrayElemAt: ["$WinnerRewardDetails.is_rewarded", 0] }, 1, 0] },
							"is_winner": { $cond: [{ $arrayElemAt: ["$WinnerRewardDetails.is_winner", 0] }, 1, 0] },
						}
					},
					{
						$project: {
							"_id": "$_id",
							"user": { $cond: { if: { $eq: ["$show_segment", true] }, then: "$email", else: "$user_name" } },
							"user_sort": { $toLower: { $cond: { if: { $eq: ["$show_segment", true] }, then: "$email", else: "$user_name" } } },
							"gender": "$gender",
							"account_type": "$account_type",
							"age": "$age",
							"zip": "$zip",
							"is_rewarded": "$is_rewarded",
							"is_winner": "$is_winner",
							"created": "$created",
						}
					},
					{ $sort: sortBy },
					{ $skip: skip },
					{ $limit: limit },
				]).toArray();

				// For each user, get compatibility/options if needed
				if (segmentListResult.length > 0 && voterResponse.length > 0) {
					for (let recordsItemSegment of segmentListResult) {
						let optionsdata = {
							'login_user_id': userId,
							'voter_response': voterResponse,
							'voted_user_id': recordsItemSegment._id ? newObjectIdDefault(recordsItemSegment._id) : "",
							'voted_account_type': recordsItemSegment.account_type ? recordsItemSegment.account_type : "",
							'voter_response_option_ids': voterResponseOptionIds,
							'segment_type': segmentType,
							'demographics_data': demographicsData,
							'from_date': fromDate,
							'to_date': toDate,
						};
						let optionsArrayData = await voteListOptionAndPollWise(req, res, optionsdata);

						recordsItemSegment['options'] = optionsArrayData['option_push_data'];
						recordsItemSegment['compatibility'] = optionsArrayData['compatibility'];
						recordsItemSegment['user'] = recordsItemSegment['user'] ? recordsItemSegment['user'] : "Anonymous";
					}
				}
				return segmentListResult;
			})();

			const getTotalRecordPromise = (async () => {
				let result = await pollsParticipants.aggregate([
					{ $match: conditions },
					{
						$group: {
							"_id": "$user_id",
						},
					},
					{ $count: 'total_count' },
				]).toArray();
				return (result.length > 0) ? result[0]['total_count'] : 0;
			})();

			// Run all queries in parallel
			const [pollNames, getVottedUserList, totalRecords] = await Promise.all([
				getPollNamePromise,
				getVotedUserListPromise,
				getTotalRecordPromise
			]);

			// Success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					segment_id: segmentId,
					segment_type: segmentType,
					poll_names: pollNames || [],
					result: getVottedUserList || [],
					recordsTotal: totalRecords || 0,
					limit: limit,
					page: page,
					total_page: Math.ceil((totalRecords || 0) / limit),
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Error response
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					segment_id: "",
					segment_type: "",
					poll_names: [],
					result: "",
					recordsTotal: 0,
					limit: 0,
					page: 0,
					total_page: 0,
					message: res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSegmentUserVotedList();

	/**
	 * Function to get segment list using async/await.
	 * Handles validation, builds query options, and fetches segment list and counts in parallel.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getSegmentList = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and request data
			let loginUserData = (req.user_data) ? req.user_data : "";
			let userId = (loginUserData._id) ? loginUserData._id : "";

			let page = (req.body.page) ? parseInt(req.body.page) : 1;
			let limit = (req.body.limit) ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			let sortBy = (req.body.sort_by) ? req.body.sort_by : { "created": SORT_DESC };
			let appliedSegmentFilter = (req.body.applied_segment_filter) ? req.body.applied_segment_filter : ALL_SEGMENT_FILTER;
			let segmentDrafts = (req.body.is_draft) ? req.body.is_draft : SEGMENT_NOT_DRAFTS;

			let skip = (limit * page) - limit;

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

			// Build query conditions
			let conditions = {
				"is_deleted": NOT_DELETED,
				"user_id": newObjectIdDefault(userId),
				"is_draft": segmentDrafts,
				"segment_type": { $in: appliedSegmentFilter }
			};
			let draftConditions = {
				"is_deleted": NOT_DELETED,
				"user_id": newObjectIdDefault(userId),
				"is_draft": SEGMENT_DRAFT,
				"segment_type": { $in: appliedSegmentFilter }
			};
			let notDraftConditions = {
				"is_deleted": NOT_DELETED,
				"user_id": newObjectIdDefault(userId),
				"is_draft": SEGMENT_NOT_DRAFTS,
				"segment_type": { $in: appliedSegmentFilter }
			};

			const pollSegment = db.collection(TABLE_POLL_SEGMENT);

			// Prepare all queries to run in parallel
			const getSegmentListPromise = pollSegment.aggregate([
				{ $match: conditions },
				{
					$project: {
						"_id": 1,
						"slug": 1,
						"segment_type": 1,
						"segment_name": 1,
						"segment_name_sort": { $toLower: "$segment_name" },
						"segment_description": 1,
						"is_deleted": 1,
						"created": 1
					}
				},
				{ $sort: sortBy },
				{ $skip: skip },
				{ $limit: limit },
			]).toArray();

			const totalRecordPromise = pollSegment.countDocuments(conditions);
			const totalDraftRecordPromise = pollSegment.countDocuments(draftConditions);
			const totalNotDraftRecordPromise = pollSegment.countDocuments(notDraftConditions);

			// Run all queries in parallel
			const [
				segmentList,
				totalRecords,
				draftRecords,
				notDraftRecords
			] = await Promise.all([
				getSegmentListPromise,
				totalRecordPromise,
				totalDraftRecordPromise,
				totalNotDraftRecordPromise
			]);

			// Success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': segmentList || [],
					'recordsTotal': totalRecords || 0,
					'total_draft_record': draftRecords || 0,
					'total_not_draft_record': notDraftRecords || 0,
					'limit': limit,
					'page': page,
					'total_page': Math.ceil((totalRecords || 0) / limit),
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': 0,
					'recordsTotal': 0,
					'total_draft_record': 0,
					'total_not_draft_record': 0,
					'limit': 0,
					'page': 0,
					'total_page': 0,
					'message': res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSegmentList();

	/**
	 * Function to delete a poll segment using async/await.
	 * Handles validation, builds query options, and deletes the poll segment.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deletePollSegment = async (req, res) => {
		let finalResponse = {};
		try {
			// Extract user and segment data from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build delete options
			const deleteOptions = {
				user_id: newObjectIdDefault(userId),
				segment_slug: segmentSlug,
			};

			// Call async function to delete poll segment report
			const deleteResponse = await deletePollSegmentReport(req, res, deleteOptions);

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
	}; // End deletePollSegment();

	/**
	 * Function to get details of a poll segment using async/await.
	 * Handles validation, sanitization, and fetches segment details.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.segmentDetails = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and segment data from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get poll segment collection
			const pollSegment = db.collection(TABLE_POLL_SEGMENT);

			// Fetch segment details asynchronously
			const segmentResult = await pollSegment.findOne(
				{
					user_id: userId,
					slug: segmentSlug
				},
				{
					projection: {
						segment_name: 1,
						slug: 1,
						segment_description: 1,
						voter_response: 1
					}
				}
			);

			// Return response based on query result
			if (segmentResult) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: segmentResult,
						message: ""
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
			}
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
	}; // End segmentDetails();

	/**
	 * Function to edit a poll segment using async/await.
	 * Handles validation, builds update options, and calls the editPollSegmentReport function.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.editPollSegment = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
			const segmentName = req.body.segment_name ? req.body.segment_name : "";

			// Validate required fields
			if (!userId || !segmentSlug || !segmentName) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build options for editing the poll segment
			const editOptions = {
				user_id: newObjectIdDefault(userId),
				segment_slug: segmentSlug,
				segment_name: segmentName
			};

			// Call the editPollSegmentReport function asynchronously
			const editResponse = await editPollSegmentReport(req, res, editOptions);

			finalResponse = {
				data: {
					status: editResponse.status,
					result: editResponse.result,
					message: editResponse.message,
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
	}; // End editPollSegment();

	/**
	 * Function for picking a segment winner using async/await
	 * @param {*} req 
	 * @param {*} res 
	 * @returns response
	 */
	this.segmentPickAWinner = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract user and segment information from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const pollSegment = db.collection(TABLE_POLL_SEGMENT);

			// Get segment data
			const resultSegment = await pollSegment.findOne({
				user_id: newObjectIdDefault(userId),
				slug: segmentSlug,
			});

			if (!resultSegment) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						user_url: USERS_URL,
						result: {},
						message: res.__("front.segments.no_segment_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare variables from segment data
			const segmentType = resultSegment.segment_type || "";
			const voterResponsePollIds = resultSegment.voter_response_poll_ids || [];
			const commonPollIds = resultSegment.poll_ids || [];
			const selectedPollIds = (segmentType == COMMON_POLLS) ? commonPollIds : voterResponsePollIds;
			const segmentId = resultSegment._id ? newObjectIdDefault(resultSegment._id) : "";
			const fromDate = resultSegment.simple_from_date || "";
			const toDate = resultSegment.simple_to_date || "";
			const winnerUserIds = resultSegment.winner_user_ids || [];
			const notInUser = winnerUserIds.concat(['', null]);
			const voterResponseOptionIds = resultSegment.voter_response_option_ids || [];

			const demographicsData = resultSegment.demographics || {};
			const maleDemographicsData = demographicsData.male || [];
			const femaleDemographicsData = demographicsData.female || [];
			const otherDemographicsData = demographicsData.other || [];
			const businessDemographicsData = demographicsData.business || [];

			// Build vote condition for aggregation
			let voteCondition = {
				user_id: { $nin: notInUser },
				poll_id: { $in: selectedPollIds },
			};

			if (fromDate == ALL_DATE_FILTER) {
				voteCondition["created"] = {
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			} else {
				voteCondition["created"] = {
					$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			}

			// Demographics-wise filter
			let conditionAge = [];
			if (segmentType == DEMOGRAPHICS) {
				// Option-wise data filter
				voteCondition['option_id'] = { $in: voterResponseOptionIds };

				// Male demographics
				if (maleDemographicsData.length > 0) {
					maleDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: MALE, age: { $gte: 0, $lt: AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: MALE, age: { $gt: AGE_OVER_70 } });
						} else {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: MALE, age: { $gte: Number(dataGender[0]), $lte: Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: { $ne: MALE } });
				}

				// Female demographics
				if (femaleDemographicsData.length > 0) {
					femaleDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: FEMALE, age: { $gte: 0, $lt: AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: FEMALE, age: { $gt: AGE_OVER_70 } });
						} else {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: FEMALE, age: { $gte: Number(dataGender[0]), $lte: Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: { $ne: FEMALE } });
				}

				// Other demographics
				if (otherDemographicsData.length > 0) {
					otherDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: OTHER, age: { $gte: 0, $lt: AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: OTHER, age: { $gt: AGE_OVER_70 } });
						} else {
							conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: OTHER, age: { $gte: Number(dataGender[0]), $lte: Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, gender: { $ne: OTHER } });
				}

				// Business demographics
				if (businessDemographicsData.length > 0) {
					businessDemographicsData.forEach(records => {
						let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
						if (records == UNDER_18) {
							conditionAge.push({ account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, age: { $gte: 0, $lt: AGE_18 } });
						} else if (records == AGE_OVER_CONSTANT) {
							conditionAge.push({ account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, age: { $gt: AGE_OVER_70 } });
						} else {
							conditionAge.push({ account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, age: { $gte: Number(dataGender[0]), $lte: Number(dataGender[1]) } });
						}
					});
				} else {
					conditionAge.push({ account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE } });
				}

				// Append demographics filter if any
				if (conditionAge.length > 0) {
					voteCondition['$or'] = conditionAge;
				}
			}

			const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

			// Aggregate to find a random vote participant matching the conditions
			const voteResult = await pollVoteParticipants.aggregate([
				{ $match: voteCondition },
				{ $sample: { size: 1 } },
				{
					$group: {
						_id: { user_id: "$user_id" },
						user_id: { $last: "$user_id" },
						poll_vote_participants_id: { $last: "$_id" },
						poll_id: { $last: "$poll_id" },
						poll_slug: { $last: "$poll_slug" },
						account_type: { $last: "$account_type" },
					}
				},
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
							{
								$project: {
									public_business_informaton: 1,
									full_name: 1,
									slug: 1,
									gender: 1,
									zip: 1,
									mobile: 1,
									email: 1,
									profile_image: 1,
									show_segment: 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$addFields: {
						gender: { $arrayElemAt: ["$userDetails.gender", 0] },
						full_name: {
							$cond: [
								{ $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$userDetails.full_name", 0] }
							]
						},
						profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
						user_name: { $arrayElemAt: ["$userDetails.slug", 0] },
						email: { $arrayElemAt: ["$userDetails.email", 0] },
						mobile: { $arrayElemAt: ["$userDetails.mobile", 0] },
						zip: { $arrayElemAt: ["$userDetails.zip", 0] },
						show_segment: { $arrayElemAt: ["$userDetails.show_segment", 0] },
					}
				},
				{
					$project: {
						_id: 0,
						user_id: 1,
						poll_vote_participants_id: 1,
						poll_id: 1,
						poll_slug: 1,
						account_type: 1,
						profile_image: 1,
						full_name: 1,
						gender: 1,
						zip: 1,
						mobile: 1,
						user: {
							$cond: {
								if: { $eq: ["$show_segment", true] },
								then: "$email",
								else: "$user_name"
							}
						},
					}
				}
			]).toArray();

			if (!voteResult || voteResult.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						user_url: USERS_URL,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const userVoteResult = voteResult[0];
			const winnerId = userVoteResult.user_id ? userVoteResult.user_id : [];

			// Add winner to the segment's winner_user_ids
			winnerUserIds.push(winnerId);

			// Update the segment with the new winner
			const updateSegmentPromise = pollSegment.updateOne(
				{ slug: segmentSlug },
				{
					$set: {
						winner_user_ids: winnerUserIds,
						modified: getUtcDate()
					}
				}
			);

			// Insert or update winner log in parallel
			const pollSegmentWinnerReward = db.collection(TABLE_POLL_SEGMENT_WINNER_REWARD_LOGS);
			const updateWinnerLogPromise = pollSegmentWinnerReward.updateOne(
				{
					user_id: winnerId,
					segment_slug: segmentSlug,
				},
				{
					$set: {
						is_winner: DEFAULT_ONE,
						winner_created: getUtcDate(),
					},
					$setOnInsert: {
						user_id: winnerId,
						poll_vote_participants_id: userVoteResult.poll_vote_participants_id,
						poll_id: userVoteResult.poll_id,
						poll_slug: userVoteResult.poll_slug,
						segment_slug: segmentSlug,
						segment_id: segmentId,
						send_by: userId,
						created: getUtcDate(),
					}
				},
				{ upsert: true }
			);

			// Wait for both update operations to complete in parallel
			await Promise.all([updateSegmentPromise, updateWinnerLogPromise]);

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					user_url: USERS_URL,
					result: userVoteResult,
					message: ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					user_url: USERS_URL,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End segmentPickAWinner();

	/**
	 * Function to get segment winners or rewarded users using async/await.
	 * Handles validation, builds query options, and fetches winner/reward list and total count in parallel.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.getSegmentWinners = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
			const filterdBy = req.body.filterd_by ? req.body.filterd_by : SEGMENT_WINNERS_FILTERD;

			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
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

			const pollSegmentWinnerReward = db.collection(TABLE_POLL_SEGMENT_WINNER_REWARD_LOGS);

			// Build query conditions
			let conditions = {
				segment_slug: segmentSlug,
				send_by: userId,
			};

			// Filter by winners
			if (filterdBy == SEGMENT_WINNERS_FILTERD) {
				conditions.is_winner = ACTIVE;
			}

			// Filter by rewards
			if (filterdBy == SEGMENT_REWARDS_FILTERD) {
				conditions.is_rewarded = ACTIVE;
			}

			// Prepare aggregation pipeline for user list
			const userListPipeline = [
				{ $match: conditions },
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
							{
								$project: {
									full_name: 1,
									public_business_informaton: 1,
									slug: 1,
									gender: 1,
									zip: 1,
									mobile: 1,
									email: 1,
									profile_image: 1,
									account_type: 1,
									show_segment: 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_EARN_SENT_REWARDS,
						let: { userId: "$user_id", segmentId: "$segment_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$user_id", "$$userId"] },
											{ $eq: ["$segment_id", "$$segmentId"] },
											{ $eq: ["$template_type", SEGMENT_REWARD_TYPE] },
										]
									},
								}
							},
							{ $project: { reward_id: 1, title: 1, sub_title: 1, image: 1 } }
						],
						as: "rewardEarnDetails"
					}
				},
				{
					$addFields: {
						gender: { $arrayElemAt: ["$userDetails.gender", 0] },
						full_name: {
							$cond: [
								{ $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
								{ $arrayElemAt: ["$userDetails.full_name", 0] }
							]
						},
						profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
						user_name: { $arrayElemAt: ["$userDetails.slug", 0] },
						email: { $arrayElemAt: ["$userDetails.email", 0] },
						mobile: { $arrayElemAt: ["$userDetails.mobile", 0] },
						zip: { $arrayElemAt: ["$userDetails.zip", 0] },
						account_type: { $arrayElemAt: ["$userDetails.account_type", 0] },
						show_segment: { $arrayElemAt: ["$userDetails.show_segment", 0] },
					}
				},
				{
					$project: {
						_id: 1,
						user_id: 1,
						full_name: 1,
						email: 1,
						segment_id: 1,
						gender: 1,
						zip: 1,
						mobile: 1,
						user_url: 1,
						is_deleted: 1,
						profile_image: { $cond: ["$profile_image", "$profile_image", ""] },
						account_type: { $cond: ["$account_type", "$account_type", ""] },
						user: {
							$cond: {
								if: { $eq: ["$show_segment", true] },
								then: "$email",
								else: "$user_name"
							}
						},
						is_rewarded: 1,
						is_winner: 1,
						winner_created: 1,
						rewardDetails: "$rewardEarnDetails",
					}
				},
				{ $sort: { winner_created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			];

			// Run both queries in parallel using Promise.all
			const [userList, totalRecord] = await Promise.all([
				// Get the list of winners/rewarded users
				pollSegmentWinnerReward.aggregate(userListPipeline).toArray(),
				// Get the total count for pagination
				pollSegmentWinnerReward.countDocuments(conditions)
			]);

			// Build and send the response
			if (userList && userList.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						result: userList,
						recordsTotal: totalRecord,
						limit: limit,
						page: page,
						message: "",
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
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
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					user_url: USERS_URL,
					result: [],
					recordsTotal: 0,
					limit: 0,
					page: 0,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getSegmentWinners();

	/**
	 * Function to validate send rewards using async/await and Promise.all for parallel queries.
	 * @param {*} req 
	 * @param {*} res
	 * @return json 
	 **/
	this.validateSegmentSendRewards = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
			const selectedUsersIds = req.body.selected_users_ids ? req.body.selected_users_ids : [];

			// Validate required fields
			if (!userId || !segmentSlug) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query conditions for earn sent rewards
			let conditions = {
				segment_slug: segmentSlug,
				is_deleted: NOT_DELETED,
				template_type: SEGMENT_REWARD_TYPE
			};

			// Prepare userIdsArray if selectedUsersIds are provided
			let userIdsArray = [];
			if (selectedUsersIds.length > 0) {
				userIdsArray = selectedUsersIds.map(id => newObjectIdDefault(id));
				conditions["user_id"] = { $in: userIdsArray };
			}

			const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// Prepare parallel queries using Promise.all
			const getTotalEarnSendRewardPromise = (async () => {
				// Aggregate to count unique emails for sent rewards
				const result = await earnSentRewards.aggregate([
					{ $match: conditions },
					{ $group: { _id: "$email" } },
					{ $count: "total_earn_send_reward" }
				]).toArray();
				return (result.length > 0) ? result[0]["total_earn_send_reward"] : 0;
			})();

			const getTotalUserCountPromise = (async () => {
				// Get total user count for the segment and selected users
				const optionData = {
					user_id: userId,
					segment_slug: segmentSlug,
					selected_users_ids: userIdsArray,
				};
				const responseData = await segmentWiseTotalUserCount(req, res, optionData);
				return responseData["total_user"];
			})();

			// Run both queries in parallel
			const [totalRewardsCount, totalUserCount] = await Promise.all([
				getTotalEarnSendRewardPromise,
				getTotalUserCountPromise
			]);

			// Build and send the response based on the results
			if (totalRewardsCount > 0) {
				if (totalUserCount == 1) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.reward_is_already_sent_to_this_user")
						}
					};
				} else if (totalUserCount > 1 && totalUserCount == totalRewardsCount) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.reward_is_already_sent_to_all_users")
						}
					};
				} else {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.leads.reward_is_already_sent_to_the_users_out_of_total_users", totalRewardsCount, totalUserCount)
						}
					};
				}
			} else {
				// Success if no reward is sent to the users
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
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End validateSegmentSendRewards();

	/**
	 * Function to send segment rewards using async/await and Promise.all for parallel queries.
	 * @param {*} req 
	 * @param {*} res
	 * @return json 
	 **/
	this.sendSegmentRewards = async (req, res, next) => {
		let finalResponse = {};

		// Extract and validate required fields from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
		const segmentId = req.body.segment_id ? newObjectIdDefault(req.body.segment_id) : "";
		const rewardId = req.body.reward_id ? newObjectIdDefault(req.body.reward_id) : "";
		const selectedUsersIds = req.body.selected_users_ids ? req.body.selected_users_ids : [];
		const excludeRewarded = req.body.exclude_rewarded ? true : false;

		if (!userId || !segmentSlug || !segmentId || !rewardId) {
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
			// Prepare parallel queries
			const rewards = db.collection(TABLE_REWARDS);
			const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// 1. Get reward details
			const rewardDetailsPromise = rewards.findOne({
				'_id': newObjectIdDefault(rewardId),
				'user_id': newObjectIdDefault(userId),
			});

			// 2. Get user list for the segment
			const optionData = {
				'user_id': userId,
				'segment_slug': segmentSlug,
				'selected_users_ids': selectedUsersIds,
			};
			const getUserListPromise = segmentWiseTotalUserCount(req, res, optionData);

			// 3. Get already rewarded user ids for this segment
			const alreadyUserRewardGoesPromise = earnSentRewards.distinct(
				"user_id",
				{ 'template_type': SEGMENT_REWARD_TYPE, "segment_slug": segmentSlug }
			);

			// Run all queries in parallel
			const [rewardDetails, getUserData, alreadyUserRewardGoes] = await Promise.all([
				rewardDetailsPromise,
				getUserListPromise,
				alreadyUserRewardGoesPromise
			]);

			const rewardImage = rewardDetails && rewardDetails['graphic_image'] ? rewardDetails['graphic_image'] : "";
			const getUserEmailList = getUserData && getUserData['all_users'] ? getUserData['all_users'] : [];
			const getUserCount = getUserData && getUserData['total_user'] ? getUserData['total_user'] : 0;

			if (rewardDetails && getUserEmailList.length > 0) {
				let allExcludedReward = 0;

				// Iterate over users and send rewards sequentially
				for (const userRecordList of getUserEmailList) {
					const userExistsId = userRecordList && userRecordList.user_id ? userRecordList.user_id : "";
					const userEmail = userRecordList && userRecordList.email ? userRecordList.email : "";
					const userFullName = userRecordList && userRecordList.full_name ? userRecordList.full_name : "";
					const pollVoteParticipantsId = userRecordList && userRecordList.poll_vote_participants_id ? newObjectIdDefault(userRecordList.poll_vote_participants_id) : "";
					const pollVotePollId = userRecordList && userRecordList.poll_id ? newObjectIdDefault(userRecordList.poll_id) : "";
					const pollVotePollSlug = userRecordList && userRecordList.poll_slug ? userRecordList.poll_slug : "";

					// Check if user has already been rewarded
					const sendRewardUser = alreadyUserRewardGoes.some(friend => friend.equals(userExistsId));

					// If excludeRewarded is true and user already rewarded, skip
					if (sendRewardUser && excludeRewarded) {
						allExcludedReward++;
						continue;
					}

					// Insert/update reward log for this user
					const pollSegmentWinnerReward = db.collection(TABLE_POLL_SEGMENT_WINNER_REWARD_LOGS);
					await pollSegmentWinnerReward.updateOne(
						{
							'user_id': userExistsId,
							'segment_slug': segmentSlug,
						},
						{
							$set: {
								'is_rewarded': DEFAULT_ONE,
							},
							$setOnInsert: {
								'user_id': userExistsId,
								'poll_vote_participants_id': pollVoteParticipantsId,
								'poll_id': pollVotePollId,
								'poll_slug': pollVotePollSlug,
								'segment_slug': segmentSlug,
								'segment_id': segmentId,
								'send_by': userId,
								'created': getUtcDate(),
							}
						},
						{ upsert: true }
					);

					// Prepare options for adding earn rewards
					const addEarnRewardsOptions = {
						'assign_reward': rewardId,
						'reward_send_user_id': userExistsId,
						'login_user_email': userEmail,
						'login_user_full_name': userFullName,
						'template_type': SEGMENT_REWARD_TYPE,
						"segment_id": segmentId,
						"segment_slug": segmentSlug,
						"login_user_data": userRecordList,
						'image': rewardImage,
						'poll_id': pollVotePollId,
						'poll_slug': pollVotePollSlug,
					};

					// Assign earn rewards to user
					await addUserEarnRewards(req, res, addEarnRewardsOptions);
				}

				// Send response based on excluded count
				finalResponse = {
					data: {
						status: (getUserCount === allExcludedReward) ? STATUS_ERROR : STATUS_SUCCESS,
						result: {},
						message: (getUserCount === allExcludedReward)
							? res.__("front.send_reward.excluded_message")
							: res.__("front.leads.reward_is_sent_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);

			} else {
				// No users to reward or reward details not found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: err.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End sendSegmentRewards();


	/**
	 * Function for use to segment Demographics Filters
	 * @param {*} req 
	 * @param {*} res
	 * @return json 
	 */
	this.segmentDemographicsFilters = async (req, res) => {
		let finalResponse = {};

		try {
			// Extract and validate input
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id || "";
			const fromDate = req.body.from_date || "";
			const toDate = req.body.to_date || "";
			const segmentSlug = req.body.segment_slug || "";
			const filterdByAge = req.body.filterd_by_age || {};
			const maleFilterdByAge = (filterdByAge && filterdByAge.male) ? filterdByAge.male : [];
			const femaleFilterdByAge = (filterdByAge && filterdByAge.female) ? filterdByAge.female : [];
			const businessFilterdByAge = (filterdByAge && filterdByAge.business) ? filterdByAge.business : [];
			const otherFilterdByAge = (filterdByAge && filterdByAge.other) ? filterdByAge.other : [];

			let maleAllAgeTotalVotes = 0;
			let femaleAllAgeTotalVotes = 0;
			let otherAllAgeTotalVotes = 0;
			let businessAllAgeTotalVotes = 0;
			let maleFemaleBusinessAllAge = {};

			if (!userId || !fromDate || !toDate || !segmentSlug) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const conditionAge = [
				{ "$gte": 0, "$lt": AGE_18 },
				{ "$gte": AGE_18, "$lte": AGE_24 },
				{ "$gte": AGE_25, "$lte": AGE_34 },
				{ "$gte": AGE_35, "$lte": AGE_44 },
				{ "$gte": AGE_45, "$lte": AGE_54 },
				{ "$gte": AGE_55, "$lte": AGE_70 },
				{ "$gt": AGE_OVER_70 },
			];

			// Get DB collections
			const pollSegment = db.collection(TABLE_POLL_SEGMENT);
			const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

			// Find the segment for the user
			const segmentResult = await pollSegment.findOne({
				'user_id': userId,
				'slug': segmentSlug
			});

			if (!segmentResult) {
				// Segment not found
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {
							'total_votes': 0,
							'male_votes': 0,
							'female_votes': 0,
							'business_votes': 0,
							'male_votes_percentage': 0,
							'female_votes_percentage': 0,
							'business_votes_percentage': 0,
							'graph_data': {
								'male_votes': 0,
								'female_votes': 0,
								'business_votes': 0,
							},
						},
						'message': res.__("front.global.no_record_found"),
					},
				};
				return returnApiResult(req, res, finalResponse);
			}

			const voterResponsePollIds = segmentResult.voter_response_poll_ids || [];
			const voterResponseOptionIds = segmentResult.voter_response_option_ids || [];

			// Prepare base conditions for each group
			const baseCondition = {
				"make_poll_user_id": userId,
				'option_id': { $in: voterResponseOptionIds },
				'user_id': { $nin: ['', null] },
				'poll_id': { $in: voterResponsePollIds }
			};

			// Add date conditions
			const getDateCondition = () => {
				if (fromDate !== "" && toDate !== "") {
					if (fromDate == ALL_DATE_FILTER) {
						return { $lte: getUtcDateSearchTimeZone(req, toDate + END_DATE) };
					} else {
						return {
							$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
							$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
						};
					}
				}
				return undefined;
			};
			const dateCondition = getDateCondition();

			// Helper to get votes for a gender/account type group, age-wise
			const getVotesByAge = async (gender, accountType, filterdByAgeArr) => {
				let totalVotes = 0;
				let votesByAge = [];

				for (let i = 0; i < conditionAge.length; i++) {
					const ageCond = conditionAge[i];
					const ageName = AGE_COMBINE_ARRAY[i];

					let matchCond = {
						...baseCondition,
						'age': ageCond,
					};

					if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
						matchCond['account_type'] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
					} else {
						matchCond['account_type'] = { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE };
					}

					if (gender) {
						matchCond['gender'] = gender;
					}

					if (dateCondition) {
						matchCond['created'] = dateCondition;
					}

					// Aggregate query to get unique user_id+poll_id per age group
					const agg = [
						{ "$match": matchCond },
						{
							"$group": {
								_id: {
									"user_id": "$user_id",
									"poll_id": "$poll_id",
								},
								"total_votes": { "$sum": 1 }
							}
						}
					];

					const voteResults = await pollVoteParticipants.aggregate(agg).toArray();

					const ageWiseVotes = (filterdByAgeArr.includes(ageName)) ? 0 : voteResults.length;

					votesByAge.push({
						'age': ageName,
						'votes': ageWiseVotes,
					});
					totalVotes += ageWiseVotes;
				}

				return { totalVotes, votesByAge };
			};

			// Run all group queries in parallel
			const [
				maleResult,
				femaleResult,
				otherResult,
				businessResult
			] = await Promise.all([
				getVotesByAge(MALE, undefined, maleFilterdByAge),
				getVotesByAge(FEMALE, undefined, femaleFilterdByAge),
				getVotesByAge(OTHER, undefined, otherFilterdByAge),
				getVotesByAge(undefined, PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, businessFilterdByAge)
			]);

			maleAllAgeTotalVotes = maleResult.totalVotes;
			femaleAllAgeTotalVotes = femaleResult.totalVotes;
			otherAllAgeTotalVotes = otherResult.totalVotes;
			businessAllAgeTotalVotes = businessResult.totalVotes;

			maleFemaleBusinessAllAge['male'] = maleAllAgeTotalVotes;
			maleFemaleBusinessAllAge['female'] = femaleAllAgeTotalVotes;
			maleFemaleBusinessAllAge['other'] = otherAllAgeTotalVotes;
			maleFemaleBusinessAllAge['business'] = businessAllAgeTotalVotes;

			// Calculate totals and percentages
			const totalMaleVote = maleAllAgeTotalVotes;
			const totalFemaleVote = femaleAllAgeTotalVotes;
			const totalOtherVote = otherAllAgeTotalVotes;
			const totalBusinessVote = businessAllAgeTotalVotes;
			const allTotalVotes = Number(totalMaleVote + totalFemaleVote + totalOtherVote + totalBusinessVote);

			const maleVotesPercentage = calculatePercentage(totalMaleVote, allTotalVotes);
			const femaleVotesPercentage = calculatePercentage(totalFemaleVote, allTotalVotes);
			const businessVotesPercentage = calculatePercentage(totalBusinessVote, allTotalVotes);
			const otherVotesPercentage = calculatePercentage(totalOtherVote, allTotalVotes);

			// Success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': {
						'total_votes': allTotalVotes,
						'male_votes': totalMaleVote,
						'female_votes': totalFemaleVote,
						'other_votes': totalOtherVote,
						'business_votes': totalBusinessVote,
						'male_votes_percentage': maleVotesPercentage,
						'female_votes_percentage': femaleVotesPercentage,
						'other_votes_percentage': otherVotesPercentage,
						'business_votes_percentage': businessVotesPercentage,
						'graph_data': {
							'male_votes': maleResult.votesByAge,
							'female_votes': femaleResult.votesByAge,
							'other_votes': otherResult.votesByAge,
							'business_votes': businessResult.votesByAge,
						}
					},
					'message': "",
				},
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {
						'total_votes': 0,
						'male_votes': 0,
						'female_votes': 0,
						'business_votes': 0,
						'male_votes_percentage': 0,
						'female_votes_percentage': 0,
						'business_votes_percentage': 0,
						'graph_data': {
							'male_votes': 0,
							'female_votes': 0,
							'business_votes': 0,
						},
					},
					'message': res.__("front.global.no_record_found"),
				},
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End segmentDemographicsFilters();

	/**
	 * Function to validate if AI-generated email marketing has already been sent to a user for a segment.
	 * Uses async/await for database queries.
	 * @param {*} req 
	 * @param {*} res
	 * @return json 
	 **/
	this.validateAiGenerateEmailMarketingUserVotted = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Extract user and request data
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
			const aiGenerateEmailMarketingId = req.body.ai_generate_email_marketing_id ? newObjectIdDefault(req.body.ai_generate_email_marketing_id) : "";
			const newsletterEmailId = req.body.newsletter_email_id ? newObjectIdDefault(req.body.newsletter_email_id) : "";
			const pollCampaignSendNewsLetter = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER);

			// Validate required fields
			if (!userId || !segmentSlug || !aiGenerateEmailMarketingId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query to check if email has already been sent
			const query = {
				user_id: userId,
				newsletter_template_id: newsletterEmailId,
				"segment_details.segment_slug": segmentSlug,
				ai_generate_email_marketing_id: aiGenerateEmailMarketingId
			};

			// Check if the email has already been sent to the user for this segment and campaign
			const alreadySentCount = await pollCampaignSendNewsLetter.countDocuments(query);

			if (alreadySentCount > 0) {
				// Email has already been sent to all users
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.segment.email_has_been_sent_to_all_users")
					}
				};
			} else {
				// No record found, email can be sent
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
			// Handle any errors during async operation
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End validateAiGenerateEmailMarketingUserVotted();

}
module.exports = new PollSegment();