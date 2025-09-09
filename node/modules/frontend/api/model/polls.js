const async = require('async');

function Polls() {

	/**
	 * Function used to get poll details
	 * Uses async/await for database query.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollDetails = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";

		let finalResponse = {};

		// Validate user
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

		try {
			// Fetch poll draft details for the user and poll slug
			const resultPollsDraft = await db.collection(TABLE_POLLS).findOne({
				user_id: userId,
				slug: pollSlug,
				is_deleted: NOT_DELETED
			});

			if (resultPollsDraft) {
				// Convert Mongo date to simple dd-mm-yy format if schedule_poll exists
				if (resultPollsDraft.schedule_poll) {
					const dobConvert = mongoDatetoSimpleDateConvert(resultPollsDraft.schedule_poll);
					resultPollsDraft['schedule_date'] = dobConvert.dd;
					resultPollsDraft['schedule_month'] = dobConvert.mm;
					resultPollsDraft['schedule_year'] = dobConvert.yy;
				}

				// Attach user info to poll details
				resultPollsDraft["user_name"] = loginUserData.full_name ? loginUserData.full_name : "";
				resultPollsDraft["user_profile_image"] = loginUserData.profile_image ? loginUserData.profile_image : "";
				resultPollsDraft["user_slug"] = loginUserData.slug ? loginUserData.slug : "";

				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						poll_url: POLLS_URL,
						result: resultPollsDraft,
						message: ""
					}
				};
			} else {
				// No poll found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						user_url: USERS_URL,
						poll_url: POLLS_URL,
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
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollDetails();

	/**
	 * Function used to add question and options
	 * Handles validation, attaches user_id, and calls the poll creation logic.
	 * Uses async/await for clean asynchronous flow.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.addQuestionAndOptions = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};

		// Validate user authentication
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

		try {
			// Attach user_id to request body
			req.body.user_id = userId;

			// Call the poll creation logic (async)
			const response = await createPollsQuestionAndOptions(req, res);

			// Handle form validation errors
			if (response.front_status === STATUS_ERROR_FORM_VALIDATION) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						errors: parseValidationFrontApi(response.message, req),
						message: parseValidationFrontApi(response.message, req),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle other errors
			if (response.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						poll_slug: "",
						message: response.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					poll_slug: response.slug,
					result: {},
					message: response.message,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End addQuestionAndOptions();


	/**
	 * Function used to delete polls questions and options
	 * Uses async/await for database operations.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deletePollsQuestionAndOptions = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const deleteType = req.body.delete_type ? req.body.delete_type : "";
		const draftOptionsId = req.body.poll_options_id ? req.body.poll_options_id : "";

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollId || !deleteType || (deleteType == OPTIONS_POLLS_DELETE && !draftOptionsId)) {
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
			// Prepare options for deletion
			const optionsImage = {
				user_id: userId,
				draft_id: pollId,
				delete_type: deleteType,
				draft_options_id: draftOptionsId,
			};

			// Await the deletion operation
			const deleteResponse = await deletePollsMedia(req, res, optionsImage);

			if (deleteResponse.status === STATUS_SUCCESS) {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: deleteResponse.message,
					}
				};
			} else {
				// Send error response
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: deleteResponse.message,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deletePollsQuestionAndOptions();

	/**
	 * Function used to delete all polls and options
	 * Uses async/await for database query.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deleteAllPollsOptions = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const optionsType = req.body.options_type ? req.body.options_type : "";

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollId || !optionsType) {
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
			// Await the deletion of all poll options
			const deleteAllResponse = await deleteAllPollsOptions(req, res, pollId);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: deleteAllResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteAllPollsOptions();

	/**
	 * Function used to create polls
	 * Uses async/await for database queries and file operations.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.createPolls = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const oldSponsoredLogo = req.body.old_sponsored_logo ? req.body.old_sponsored_logo : "";
		const sponsoredLogo = (req.files && req.files.sponsored_logo) ? req.files.sponsored_logo : "";

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for file upload
		const options = {
			image: sponsoredLogo,
			filePath: POLLS_FILE_PATH,
			oldPath: oldSponsoredLogo
		};

		let errMessageArray = [];

		try {
			// Upload sponsored logo if provided
			const uploadResponse = await moveUploadedFile(req, res, options);

			if (uploadResponse.status === STATUS_ERROR) {
				// Handle file upload error
				errMessageArray.push({ param: 'sponsered_logo', msg: uploadResponse.message });
				finalResponse = {
					data: {
						status: STATUS_ERROR_FORM_VALIDATION,
						errors: errMessageArray,
						message: "Errors",
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Set uploaded file name in request body if available
			req.body.sponsored_logo = uploadResponse.fileName ? uploadResponse.fileName : "";
			req.body.user_id = userId;

			// Create poll data in database
			const createPollResponse = await createPollsAllData(req, res);

			if (createPollResponse.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: createPollResponse.message,
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: createPollResponse.message,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End createPolls();

	/**
	 * Function used to save single options data
	 * Uses async/await for cleaner asynchronous handling.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.singleOptionsDataSave = async (req, res) => {
		let finalResponse = {};

		// Get user data and poll slug from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : '';

		// Validate user and poll slug
		if (!userId || !pollSlug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare option data for saving
		const optionData = {
			poll_slug: pollSlug,
			user_id: userId,
		};

		try {
			// Save single poll option data using async/await
			const response = await singlePollSaveNextFunctionalitySave(req, res, optionData);

			if (response.status === STATUS_SUCCESS) {
				// Return success message
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: response.message
					}
				};
			} else {
				// Return error message
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: response.message
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End singleOptionsDataSave();

	/**
	 * Function used to get polls listing
	 * Uses async/await and Promise.all for parallel queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.getPollsListing = async (req, res) => {
		let finalResponse = {};

		try {
			// Get user data and determine userId
			const loginUserData = req.user_data ? req.user_data : "";
			const publicUserId = req.body.public_user_id ? newObjectIdDefault(req.body.public_user_id) : "";
			const isPublicPage = req.body.is_public_page ? req.body.is_public_page : "";
			const loginUserId = loginUserData._id ? loginUserData._id : "";
			const userId = publicUserId ? publicUserId : loginUserId;
			const customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

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

			// Prepare query parameters
			const isPublished = req.body.is_published ? [req.body.is_published] : [POLL_PUBLISHED];
			const isDraft = req.body.is_draft ? [req.body.is_draft] : [POLL_NOT_DRAFTS];
			const page = req.body.page ? parseInt(req.body.page) : 1;
			let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT + 2;
			const skip = (limit * page) - limit;

			// Main conditions for poll listing
			let conditions = {
				is_deleted: NOT_DELETED,
				user_id: newObjectIdDefault(userId),
				is_published: { $in: isPublished },
				is_draft: { $in: isDraft },
			};

			// Condition for published poll count
			const pollCondition = {
				is_deleted: NOT_DELETED,
				user_id: newObjectIdDefault(userId),
				is_published: POLL_PUBLISHED,
				is_draft: POLL_NOT_DRAFTS,
			};

			// Condition for draft poll count
			const pollDraftCondition = {
				is_deleted: NOT_DELETED,
				user_id: newObjectIdDefault(userId),
				is_published: POLL_NOT_PUBLISHED,
				is_draft: POLL_DRAFT,
			};

			// If public profile, adjust conditions for schedule_poll
			if (isPublicPage === 'public_profile') {
				conditions["$or"] = [
					{ schedule_poll: { $in: [null, ""] } },
					{ schedule_poll: { $lte: new Date(new Date().setHours(23, 59, 59)) } }
				];
			}

			const polls = db.collection(TABLE_POLLS);

			// Prepare all queries to run in parallel
			const pollsListPromise = polls.aggregate([
				{ $match: conditions },
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { pollId: "$_id" },
						pipeline: [
							{
								$match: {
									user_id: { $nin: [null, ""] },
									$expr: { $and: [{ $eq: ["$poll_id", "$$pollId"] }] }
								}
							},
							{
								$group: {
									_id: "$user_id",
									user_wise_count: { $sum: 1 }
								}
							}
						],
						as: "pollParticipantsTotalCount"
					}
				},
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { pollId: "$_id" },
						pipeline: [
							{
								$match: {
									user_id: { $nin: [null, ""] },
									$expr: { $and: [{ $eq: ["$poll_id", "$$pollId"] }] }
								}
							},
							{
								$lookup: {
									from: TABLE_USERS,
									let: { userId: "$user_id" },
									pipeline: [
										{
											$match: {
												$expr: { $and: [{ $eq: ["$_id", "$$userId"] }] }
											}
										},
										{
											$project: {
												full_name: 1,
												slug: 1,
												profile_image: 1,
												account_type: 1
											}
										}
									],
									as: "userDetails"
								}
							},
							{
								$group: {
									_id: "$user_id",
									created: { $first: "$created" },
									user_profile_image: { $first: { $arrayElemAt: ["$userDetails.profile_image", 0] } },
									user_slug: { $first: { $arrayElemAt: ["$userDetails.slug", 0] } },
									account_type: { $first: { $arrayElemAt: ["$userDetails.account_type", 0] } }
								}
							},
							{ $sort: { created: SORT_DESC } },
							{ $limit: PARTICIPANTS_LISTING_LIMIT }
						],
						as: "poll_vote_participants"
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { userId: "$user_id" },
						pipeline: [
							{
								$match: {
									$expr: { $and: [{ $eq: ["$_id", "$$userId"] }] }
								}
							},
							{
								$project: {
									full_name: 1,
									slug: 1,
									profile_image: 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						question: 1,
						user_id: 1,
						options: 1,
						options_type: 1,
						is_deleted: 1,
						is_draft: 1,
						custom_url: 1,
						is_published: 1,
						slug: 1,
						created: 1,
						question_media: 1,
						question_extension: 1,
						question_video_name: 1,
						total_count: 1,
						hashtag: 1,
						poll_vote_participants: 1,
						category_id: 1,
						end_voting_period: 1,
						user_name: { $arrayElemAt: ["$userDetails.full_name", 0] },
						user_profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
						user_slug: { $arrayElemAt: ["$userDetails.slug", 0] },
						participants_count: {
							$cond: {
								if: { $isArray: "$pollParticipantsTotalCount" },
								then: { $size: "$pollParticipantsTotalCount" },
								else: 0
							}
						}
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			]).toArray();

			const totalRecordsPromise = polls.countDocuments(conditions);
			const totalPublishedPromise = polls.countDocuments(pollCondition);
			const totalDraftsPromise = polls.countDocuments(pollDraftCondition);

			// Run all queries in parallel
			const [pollsList, totalRecords, totalPublished, totalDrafts] = await Promise.all([
				pollsListPromise,
				totalRecordsPromise,
				totalPublishedPromise,
				totalDraftsPromise
			]);

			// Save poll data bucket (side effect, not blocking response)
			const pollData = await fetchUserPollSummary(req, res, userId);
			await saveCustomerBucketItems({
				user_id: userId,
				customer_id: customerId,
				bucket_name: DATA_BUCKET_POLL,
				parent_bucket: 5,
				data: pollData
			});

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					users_url: USERS_URL,
					polls_url: POLLS_URL,
					result: pollsList || [],
					recordsTotal: totalRecords || 0,
					total_publish_polls: totalPublished || 0,
					total_draft_polls: totalDrafts || 0,
					limit: limit,
					page: page,
					message: "",
					total_page: Math.ceil((totalRecords || 0) / limit)
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					users_url: USERS_URL,
					polls_url: POLLS_URL,
					result: [],
					recordsTotal: 0,
					total_publish_polls: 0,
					total_draft_polls: 0,
					limit: req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT + 2,
					page: req.body.page ? parseInt(req.body.page) : 1,
					message: error.message || res.__("front.global.no_record_found"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getPollsListing();

	/**
	 * Function used to delete published and deleted polls
	 * Uses async/await for database query.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.pollPublishedAndDeleted = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollId = req.body.poll_id ? req.body.poll_id : '';
		const recordStatus = req.body.record_status ? req.body.record_status : '';
		const statusType = req.body.status_type ? req.body.status_type : '';

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollId || !statusType) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for delete/status update
		const sendDataOptions = {
			poll_id: pollId,
			status_type: statusType,
			user_id: userId,
			record_status: recordStatus
		};

		try {
			// Await the delete and status update operation
			const deleteAllResponse = await deleteAndStatusUpdate(req, res, sendDataOptions);

			if (deleteAllResponse.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: deleteAllResponse.message,
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: deleteAllResponse.message,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollPublishedAndDeleted();


	/**
	 * Function used to view public page polls details
	 * Uses async/await for database queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response 
	 **/
	this.viewPublicPagePollDetails = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let finalResponse = {};

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const customUrl = req.body.custom_url ? req.body.custom_url : "";
		const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		const gender = loginUserData.gender ? loginUserData.gender : "";
		const dob = loginUserData.dob ? loginUserData.dob : "";
		const zip = loginUserData.zip ? loginUserData.zip : "";
		const pollType = req.body.poll_type ? req.body.poll_type : SINGLE_POLL_TYPE;
		const randomViewsString = req.body.random_views_string ? req.body.random_views_string : "";

		// Embed data
		const articleEmbedPollId = req.body.article_embed_poll_id ? newObjectIdDefault(req.body.article_embed_poll_id) : "";
		const articleEmbedPollOptionId = req.body.article_embed_poll_option_id ? newObjectIdDefault(req.body.article_embed_poll_option_id) : "";

		if (!customUrl) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let conditionDetails = {
			is_deleted: NOT_DELETED,
			is_published: POLL_PUBLISHED,
			is_draft: POLL_NOT_DRAFTS,
			custom_url: customUrl,
		};

		// New article embed data condition
		if (articleEmbedPollId !== '' && articleEmbedPollOptionId !== '') {
			conditionDetails = {
				is_deleted: NOT_DELETED,
				is_published: POLL_PUBLISHED,
				is_draft: POLL_NOT_DRAFTS,
				_id: articleEmbedPollId,
			};
		}

		const polls = db.collection(TABLE_POLLS);

		try {
			// Count documents matching the condition
			const pollCountResult = await polls.countDocuments(conditionDetails);

			if (pollCountResult === 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						polls_url: POLLS_URL,
						result: {},
						end_voting: "", // schedule date flag not end voting period
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get schedule_start_date for schedule date functionality
			const resultSchedulePolls = await polls.findOne(
				conditionDetails,
				{ projection: { schedule_start_date: 1 } }
			);

			const scheduleStartDate = (resultSchedulePolls && resultSchedulePolls['schedule_start_date']) ? resultSchedulePolls['schedule_start_date'] : "";
			const pollStartDateSchduleTime = getPollStartDateSchduleTimeRemaining(scheduleStartDate);
			const startDateAvailableFlag = !!pollStartDateSchduleTime.start_date_available_flag;

			// If schedule start date is not available for the current date, adjust condition for schedule date
			if (!startDateAvailableFlag) {
				conditionDetails['$or'] = [
					{
						$and: [
							{ schedule_start_date: { $in: [null, ""] } },
							{ schedule_end_date: { $in: [null, ""] } }
						]
					},
					{
						$and: [
							{ schedule_start_date: { $lte: getUtcDate() } },
							{ schedule_end_date: { $in: [null, ""] } }
						]
					},
					{
						$and: [
							{ schedule_start_date: { $lte: getUtcDate() } },
							{ schedule_end_date: { $gte: getUtcDate() } }
						]
					},
				];
			}

			// Prepare aggregation pipeline for poll details
			const aggregationPipeline = [
				{ $match: conditionDetails },
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
									_id: 1,
									full_name: 1,
									slug: 1,
									lead_forms_id: 1,
									profile_image: 1,
									public_business_informaton: 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						question: 1,
						options_type: 1,
						is_deleted: 1,
						is_draft: 1,
						custom_url: 1,
						is_published: 1,
						slug: 1,
						created: 1,
						question_media: 1,
						question_extension: 1,
						question_video_name: 1,
						category_id: 1,
						hashtag: 1,
						real_time: 1,
						real_time_result: 1,
						add_context: 1,
						enticement_headline: 1,
						schedule_end_date_type: 1,
						schedule_start_date: 1,
						schedule_end_date: 1,
						user_id: 1,
						options: {
							$cond: {
								if: { $ne: [articleEmbedPollOptionId, ""] },
								then: {
									$filter: {
										input: "$options",
										as: "item",
										cond: {
											$and: [
												{ $eq: ["$$item._id", articleEmbedPollOptionId] },
												{ $ne: ["$$item.type", POLL_UNDECIDED_OPTIONS] }
											]
										}
									}
								},
								else: {
									$filter: {
										input: "$options",
										as: "item",
										cond: { $ne: ["$$item.type", POLL_UNDECIDED_OPTIONS] }
									}
								}
							}
						},
						total_count: 1,
						sponsored_text: 1,
						sponsored_logo: 1,
						sponsored_type: 1,
						sponsored_link: 1,
						end_voting_period: 1,
						single_option_submitted_type: 1,
						without_undecided_options: {
							$filter: {
								input: "$options",
								as: "item",
								cond: { $ne: ["$$item.type", POLL_UNDECIDED_OPTIONS] }
							}
						},
						owner_poll_user_id: { $arrayElemAt: ["$userDetails._id", 0] },
						registration_lead_forms_id: { $arrayElemAt: ["$userDetails.lead_forms_id", 0] },
						user_name: { $arrayElemAt: ["$userDetails.full_name", 0] },
						user_profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
						user_slug: { $arrayElemAt: ["$userDetails.slug", 0] },
						name_of_the_business: { $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
					}
				}
			];

			// Get poll details using aggregation
			const resultPolls = await polls.aggregate(aggregationPipeline).toArray();

			if (resultPolls && resultPolls.length > 0) {
				let pollDetails = resultPolls[0] ? resultPolls[0] : {};

				// If start date available after end voting because schedule date not time according
				if (startDateAvailableFlag === true) {
					pollDetails['end_voting_period'] = true;
				}

				// If poll not show on schedule time after no views count data
				if (startDateAvailableFlag === true) {
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							poll_start_date_schdule_remaining: pollStartDateSchduleTime,
							user_url: USERS_URL,
							polls_url: POLLS_URL,
							result: pollDetails,
							end_voting: "",
							message: "",
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					// Start poll view logs save
					const viewLogsOptions = {
						ip: req.body.ip,
						user_id: userId,
						custom_url: customUrl,
						poll_question: pollDetails['question'],
						make_poll_user_id: pollDetails['user_id'],
						poll_id: pollDetails['_id'],
						poll_slug: pollDetails['slug'],
						poll_type: pollType,
						poll_set_id: "",
						account_type: userId ? accountType : "",
						gender: userId ? gender : "",
						dob: userId ? dob : "",
						zip: userId ? zip : "",
						unique_browser_id: uniqueBrowserId,
						random_views_string: randomViewsString,
						poll_created: pollDetails['created'],
					};

					// Await poll analytics view logs
					await pollAnalyticsViewLogs(req, res, viewLogsOptions);

					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							poll_start_date_schdule_remaining: pollStartDateSchduleTime,
							user_url: USERS_URL,
							polls_url: POLLS_URL,
							result: pollDetails,
							end_voting: "",
							message: "",
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						poll_start_date_schdule_remaining: pollStartDateSchduleTime,
						user_url: USERS_URL,
						polls_url: POLLS_URL,
						result: {},
						end_voting: true,
						message: res.__("front.polls.end_voting"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End viewPublicPagePollDetails();

	/**
	 * Function  used to get previous day
	 * @param {*} date 
	 * @return previous 
	 **/
	getPreviousDay = (date = new Date()) => {
		const previous = new Date(date.getTime());
		previous.setDate(date.getDate() - 1);
		return previous;
	} //End getPreviousDay();

	/**
	 * Function  used to get  total count in poll
	 * @param {*} date 
	 * @return previous 
	 **/
	getSum = (array, column) => {
		let values = array.map((item) => parseInt(item[column]) || 0)
		return values.reduce((a, b) => a + b)
	} //End getSum();

	/**
	 * Function used to view today/yesterday polls details
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.todayYesterdayPollsDetails = async (req, res) => {
		let finalResponse = {};

		try {
			const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
			const filterTo = req.body.filter_to ? req.body.filter_to : "";

			if (!pollSlug || !filterTo) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare date filter for today or yesterday
			let dateWiseFilter = "";
			if (filterTo === TODAY_POLLS_FILTER) {
				dateWiseFilter = {
					$gte: new Date(new Date().setHours(0, 0, 0, 0)),
					$lte: new Date(new Date().setHours(23, 59, 59, 999))
				};
			} else if (filterTo === YESTERDAY_POLLS_FILTER) {
				const prevDay = getPreviousDay();
				dateWiseFilter = {
					$gte: new Date(prevDay.setHours(0, 0, 0, 0)),
					$lte: new Date(prevDay.setHours(23, 59, 59, 999))
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.polls.please_enter_the_right_filter_data"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const polls = db.collection(TABLE_POLLS);

			// Aggregate poll options and their vote counts for the given date filter
			const aggregationPipeline = [
				{ $match: { "slug": pollSlug } },
				{ $project: { 'options': 1 } },
				{ $unwind: "$options" },
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { optionsId: "$options._id" },
						pipeline: [
							{
								$match: {
									"poll_slug": pollSlug,
									"created": dateWiseFilter,
									$expr: {
										$and: [
											{ $eq: ["$option_id", "$$optionsId"] },
										]
									},
								}
							},
							{
								$group: {
									_id: "$option_id",
									count: { $sum: 1 }
								}
							}
						],
						as: "voteDetails"
					}
				},
				{
					$project: {
						_id: 0,
						"_id": "$options._id",
						"title": "$options.title",
						"image": "$options.image",
						"video": "$options.video",
						"extension": "$options.extension",
						"cta_title": "$options.cta_title",
						"cta_url": "$options.cta_url",
						"assign_reward": "$options.assign_reward",
						"created": "$options.created",
						"type": "$options.type",
						"total_count": {
							$cond: [
								{ $arrayElemAt: ["$voteDetails.count", 0] },
								{ $arrayElemAt: ["$voteDetails.count", 0] },
								0
							]
						},
					}
				}
			];

			// Run aggregation query asynchronously
			const resultPollsFilter = await polls.aggregate(aggregationPipeline).toArray();

			if (resultPollsFilter && resultPollsFilter.length > 0) {
				const totalCount = getSum(resultPollsFilter, 'total_count');

				// Calculate percentage for each option
				const resultData = resultPollsFilter.map((records) => {
					records["percentage"] = calculatePercentage(records.total_count, totalCount);
					return records;
				});

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						total_count: totalCount,
						polls_url: POLLS_URL,
						result: resultData,
						message: "",
					}
				};
			} else {
				// Send no record found response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						total_count: 0,
						polls_url: POLLS_URL,
						result: [],
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
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End todayYesterdayPollsDetails();

	/**
	 * Function used to send poll comments
	 * Uses async/await for database queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.sendPollComments = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const loginUserName = loginUserData.full_name ? loginUserData.full_name : "";
		const pollId = req.body.poll_id ? req.body.poll_id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const parentId = req.body.parent_id ? req.body.parent_id : 0;
		const makePollUserId = req.body.make_poll_user_id ? req.body.make_poll_user_id : "";
		const comment = req.body.comment ? req.body.comment : 0;

		const isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;
		const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		const gender = loginUserData.gender ? loginUserData.gender : "";
		const dob = loginUserData.dob ? loginUserData.dob : "";
		const zip = loginUserData.zip ? loginUserData.zip : "";

		let age = DEACTIVE;
		if (dob !== "") {
			const dobConvert = mongoDatetoSimpleDateConvert(dob);
			age = calculateAge(`${dobConvert.dd}-${dobConvert.mm}-${dobConvert.yy}`);
		}

		let finalResponse = {};

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

		const polls = db.collection(TABLE_POLLS);
		const pollComment = db.collection(TABLE_POLLS_COMMENTS);

		try {
			// Fetch poll details for the given pollId and pollSlug
			const pollResult = await polls.findOne(
				{
					'_id': newObjectIdDefault(pollId),
					'slug': pollSlug
				},
				{
					projection: {
						'_id': 1,
						'question': 1,
						'user_id': 1,
						'created': 1,
						'custom_url': 1
					}
				}
			);

			if (!pollResult) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const pollCreateUserId = pollResult.user_id;
			const pollQuestion = pollResult.question;
			const pollCustomUrl = pollResult.custom_url;
			const pollCreated = pollResult.created;

			// Generate slug for the comment
			const slugOptions = {
				title: pollSlug,
				table_name: TABLE_POLLS_COMMENTS,
				slug_field: "slug"
			};
			const slugResponse = await getDatabaseSlug(slugOptions);

			// Get followers/following status in parallel
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Prepare comment document
			const commentDoc = {
				comment: comment,
				poll_question: pollQuestion,
				poll_id: newObjectIdDefault(pollId),
				make_poll_user_id: newObjectIdDefault(makePollUserId),
				poll_slug: pollSlug,
				poll_created: pollCreated,
				parent_id: (parentId != 0) ? newObjectIdDefault(parentId) : Number(0),
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED,
				is_active: ACTIVE,
				is_like: DEFAULT_ZERO,
				is_dislike: DEFAULT_ZERO,
				slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
				unique_browser_id: uniqueBrowserId,
				account_type: userId ? accountType : "",
				gender: userId ? gender : "",
				dob: userId ? dob : "",
				age: userId ? age : "",
				zip: userId ? zip : "",
				view_type: isViewType,
				is_followers: followResponse.is_followers ? followResponse.is_followers : 0,
				is_followers_requested_received: followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
				is_following: followResponse.is_following ? followResponse.is_following : 0,
				is_following_requested_send: followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
				created: getUtcDate(),
				modified: getUtcDate(),
			};

			// Insert the comment into the collection
			const insertResult = await pollComment.insertOne(commentDoc);

			if (!insertResult || !insertResult.insertedId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Send poll comment notification if commenter is not the poll creator
			if (String(userId) !== String(pollCreateUserId)) {
				const notificationMessageParams = [loginUserName, pollQuestion, comment];
				const notificationOptions = {
					notification_data: {
						notification_type: NOTIFICATION_SEND_POLLS_COMMENTS,
						message_params: notificationMessageParams,
						parent_table_id: pollCreateUserId,
						user_id: pollCreateUserId,
						user_ids: [pollCreateUserId],
						user_role_id: FRONT_ADMIN_ROLE_ID,
						role_id: FRONT_ADMIN_ROLE_ID,
						extra_parameters: {
							'user_id': newObjectIdDefault(pollCreateUserId),
							'poll_slug': pollSlug,
							'custom_url': pollCustomUrl,
							'send_comment_user_id': newObjectIdDefault(userId),
						}
					}
				};
				// Fire and forget notification (no await)
				insertNotifications(req, res, notificationOptions);
			}

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.polls.comment_send_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End sendPollComments();

	/**
	 * Function used to get poll comments list
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.getPollCommentsList = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const loginUserId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const commentSlug = req.body.comment_slug ? req.body.comment_slug : "";
		const commentScreenType = req.body.comment_screen_type ? req.body.comment_screen_type : "";

		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;

		let skip = (limit * page) - limit;
		let skipChild = 0;
		let limitChild = limit;

		const pollComment = db.collection(TABLE_POLLS_COMMENTS);

		let finalResponse = {};

		if (pollSlug === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Set up query conditions
		let conditions = {
			parent_id: DEFAULT_ZERO,
			is_deleted: NOT_DELETED,
			poll_slug: pollSlug,
		};
		let conditionsCount = { ...conditions };

		// If fetching child comments for a specific comment
		if (commentSlug !== '') {
			skipChild = skip;
			skip = DEFAULT_ZERO;
			delete conditions.parent_id;
			conditions['slug'] = commentSlug;
		}

		try {
			// If mobile screen type, only return total comment count
			if (commentScreenType === MOBILE_COMMNET_TYPE) {
				delete conditionsCount.parent_id;
				const countMobileScreen = await pollComment.countDocuments(conditionsCount);
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						total_comment: countMobileScreen,
						message: "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Otherwise, fetch comments, parent count, and total count in parallel
			const aggregatePipeline = [
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
									}
								}
							},
							{
								$project: {
									full_name: {
										$cond: [
											"$public_business_informaton.name_of_the_business",
											"$public_business_informaton.name_of_the_business",
											"$full_name"
										]
									},
									slug: 1,
									profile_image: 1,
									account_type: 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$lookup: {
						from: POLL_COMMENTS_USER_LIKE_DISLIKE,
						let: { commentId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$comment_id", "$$commentId"] },
											{ $eq: ["$user_id", loginUserId] },
										]
									}
								}
							},
							{ $project: { is_like: 1 } }
						],
						as: "userLikeDislikeDetails"
					}
				},
				{
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
									}
								}
							},
							{
								$group: {
									_id: null,
									count: { $sum: 1 }
								}
							}
						],
						as: "childCommnetTotalCount"
					}
				},
				{
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
									}
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
												}
											}
										},
										{
											$project: {
												full_name: {
													$cond: [
														"$public_business_informaton.name_of_the_business",
														"$public_business_informaton.name_of_the_business",
														"$full_name"
													]
												},
												slug: 1,
												profile_image: 1,
												account_type: 1
											}
										}
									],
									as: "userDetails"
								}
							},
							{
								$lookup: {
									from: POLL_COMMENTS_USER_LIKE_DISLIKE,
									let: { commentId: "$_id" },
									pipeline: [
										{
											$match: {
												$expr: {
													$and: [
														{ $eq: ["$comment_id", "$$commentId"] },
														{ $eq: ["$user_id", loginUserId] },
													]
												}
											}
										},
										{ $project: { is_like: 1 } }
									],
									as: "userLikeDislikeDetails"
								}
							},
							{
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
												}
											}
										},
										{
											$group: {
												_id: null,
												count: { $sum: 1 }
											}
										}
									],
									as: "childCommnetTotalCount"
								}
							},
							{
								$project: {
									comment: 1,
									poll_id: 1,
									poll_slug: 1,
									parent_id: 1,
									user_id: 1,
									is_like: 1,
									is_dislike: 1,
									created: 1,
									make_poll_user_id: 1,
									slug: 1,
									user_profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
									user_full_name: { $arrayElemAt: ["$userDetails.full_name", 0] },
									user_slug: { $arrayElemAt: ["$userDetails.slug", 0] },
									account_type: { $arrayElemAt: ["$userDetails.account_type", 0] },
									user_liked_dislike: {
										$cond: [
											{ $arrayElemAt: ["$userLikeDislikeDetails.is_like", 0] },
											{ $arrayElemAt: ["$userLikeDislikeDetails.is_like", 0] }, 0
										]
									},
									child_comment_count: {
										$cond: [
											{ $arrayElemAt: ["$childCommnetTotalCount.count", 0] },
											{ $arrayElemAt: ["$childCommnetTotalCount.count", 0] }, 0
										]
									},
									year: { $year: "$created" }
								}
							},
							{ $sort: { created: SORT_DESC } },
							{ $skip: skipChild },
							{ $limit: limitChild }
						],
						as: "child_comments"
					}
				},
				{
					$project: {
						comment: 1,
						poll_id: 1,
						poll_slug: 1,
						parent_id: 1,
						user_id: 1,
						created: 1,
						is_like: 1,
						is_dislike: 1,
						make_poll_user_id: 1,
						slug: 1,
						user_profile_image: { $arrayElemAt: ["$userDetails.profile_image", 0] },
						user_full_name: { $arrayElemAt: ["$userDetails.full_name", 0] },
						user_slug: { $arrayElemAt: ["$userDetails.slug", 0] },
						account_type: { $arrayElemAt: ["$userDetails.account_type", 0] },
						user_liked_dislike: {
							$cond: [
								{ $arrayElemAt: ["$userLikeDislikeDetails.is_like", 0] },
								{ $arrayElemAt: ["$userLikeDislikeDetails.is_like", 0] }, 0
							]
						},
						child_comment_count: {
							$cond: [
								{ $arrayElemAt: ["$childCommnetTotalCount.count", 0] },
								{ $arrayElemAt: ["$childCommnetTotalCount.count", 0] }, 0
							]
						},
						child_comments: 1,
						year: { $year: "$created" }
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			];

			// Prepare promises for parallel execution
			const promises = [
				// Get poll comments list
				pollComment.aggregate(aggregatePipeline).toArray(),
				// Get total record count (parent comments)
				pollComment.countDocuments(conditions),
				// Get total record count (all comments)
				(async () => {
					let countCond = { ...conditionsCount };
					delete countCond.parent_id;
					return pollComment.countDocuments(countCond);
				})()
			];

			const [commentsResult, totalRecordResult, totalCommentResult] = await Promise.all(promises);

			let totalRecord = totalRecordResult || 0;
			let totalComment = totalCommentResult || 0;

			// If fetching child comments for a specific comment, adjust totalRecord
			if (commentSlug !== '') {
				totalRecord = (commentsResult && commentsResult[0] && commentsResult[0]['child_comment_count']) ? commentsResult[0]['child_comment_count'] : 0;
			}

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					users_url: USERS_URL,
					comment_slug: commentSlug,
					result: commentsResult || [],
					recordsTotal: totalRecord,
					total_comment: totalComment,
					message: "",
					limit: limit,
					page: page,
					total_page: Math.ceil(totalRecord / limit)
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					users_url: USERS_URL,
					comment_slug: commentSlug,
					result: [],
					recordsTotal: 0,
					total_comment: 0,
					message: res.__("front.global.no_record_found"),
					limit: limit,
					page: page,
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getPollCommentsList();

	/**
	 * Function used to like or dislike comments
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 **/
	this.commentsLikeDislike = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const commentId = req.body.comment_id ? newObjectIdDefault(req.body.comment_id) : "";
		const likeFlag = req.body.is_like ? Number(req.body.is_like) : 0;
		const makePollUserId = req.body.make_poll_user_id ? req.body.make_poll_user_id : "";

		let finalResponse = {};

		// Validate required fields and likeFlag
		if (
			userId === '' ||
			pollId === '' ||
			commentId === '' ||
			pollSlug === '' ||
			makePollUserId === '' ||
			POLL_COMMENT_LIKE_DISLIKE.includes(likeFlag) === false
		) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const pollCommentLike = db.collection(POLL_COMMENTS_USER_LIKE_DISLIKE);

		try {
			// Find and update (or insert) the like/dislike record for this user/comment
			const resultLike = await pollCommentLike.findOneAndUpdate(
				{
					user_id: userId,
					poll_id: pollId,
					make_poll_user_id: newObjectIdDefault(makePollUserId),
					poll_slug: pollSlug,
					comment_id: commentId,
				},
				{
					$set: { is_like: Number(likeFlag), modified: getUtcDate() },
					$setOnInsert: {
						user_id: userId,
						poll_id: pollId,
						make_poll_user_id: newObjectIdDefault(makePollUserId),
						poll_slug: pollSlug,
						comment_id: commentId,
						created: getUtcDate(),
					},
				},
				{ upsert: true, returnDocument: 'before' }
			);

			// If the document existed before, handle like/dislike toggling or removal
			if (resultLike && resultLike.lastErrorObject && resultLike.lastErrorObject.updatedExisting) {
				const valueResult = resultLike.value ? resultLike.value : {};
				const isLikeLastValue = valueResult.is_like ? Number(valueResult.is_like) : 0;

				// If the like/dislike value is changing
				if (likeFlag !== isLikeLastValue) {
					const updatePromises = [];

					if (likeFlag === USER_LIKED_COMMENT) {
						// User is liking the comment
						updatePromises.push(userPollCommentLike(commentId));
						updatePromises.push(userDecreasePollCommentDislike(commentId));
						// Send notification (fire and forget)
						sendLikeNotifications(req, res, loginUserData, commentId);
					}
					if (likeFlag === USER_DISLIKED_COMMENT) {
						// User is disliking the comment
						updatePromises.push(userPollCommentDislike(commentId));
						updatePromises.push(userDecreasePollCommentLike(commentId));
					}

					// Wait for all update operations to complete
					await Promise.all(updatePromises);

					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							result: {},
							message: (likeFlag === USER_LIKED_COMMENT)
								? res.__("front.polls.user_like_successfully")
								: res.__("front.polls.user_dislike_successfully"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					// User is removing their like/dislike (toggle off)
					await pollCommentLike.deleteOne({ _id: valueResult._id });

					const updateRemovePromises = [];
					if (isLikeLastValue === USER_LIKED_COMMENT) {
						updateRemovePromises.push(userDecreasePollCommentLike(commentId));
					}
					if (isLikeLastValue === USER_DISLIKED_COMMENT) {
						updateRemovePromises.push(userDecreasePollCommentDislike(commentId));
					}
					await Promise.all(updateRemovePromises);

					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							result: {},
							message: (isLikeLastValue === USER_LIKED_COMMENT)
								? res.__("front.polls.user_like_remove_successfully")
								: res.__("front.polls.user_dislike_remove_successfully"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// New like/dislike record was inserted
				const updateInsertPromises = [];
				if (likeFlag === USER_LIKED_COMMENT) {
					updateInsertPromises.push(userPollCommentLike(commentId));
					// Send notification (fire and forget)
					sendLikeNotifications(req, res, loginUserData, commentId);
				}
				if (likeFlag === USER_DISLIKED_COMMENT) {
					updateInsertPromises.push(userPollCommentDislike(commentId));
				}
				await Promise.all(updateInsertPromises);

				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: {},
						message: (likeFlag === USER_LIKED_COMMENT)
							? res.__("front.polls.user_like_successfully")
							: res.__("front.polls.user_dislike_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End commentsLikeDislike();


	/**
	 * Function used to delete poll comments
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deletePollComment = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and comment information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const commentId = req.body.comment_id ? newObjectIdDefault(req.body.comment_id) : "";

		let finalResponse = {};

		// Validate required fields
		if (!userId || !commentId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for comment deletion
		const sendDeleteOptions = {
			comment_id: commentId,
			make_poll_user_id: userId
		};

		try {
			// Call the async function to delete the comment
			const deleteResponse = await userCommentDelete(req, res, sendDeleteOptions);

			if (deleteResponse.status === STATUS_SUCCESS) {
				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: deleteResponse.message,
					}
				};
			} else {
				// Send error response
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: deleteResponse.message,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deletePollComment();

	/**
	 * Function used to check if user already voted
	 * Uses async/await for database queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.alreadyVoteCheck = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and request data
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const customUrl = req.body.custom_url ? req.body.custom_url : "";
		const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";

		let finalResponse = {};

		// Validate required fields
		if (customUrl === '' || uniqueBrowserId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// Calculate time remaining until midnight
		const resultTimerHours = getTimeRemaining();

		// Prepare query conditions for checking if user already voted
		const alreadyVoteConditions = {
			custom_url: customUrl,
			next_date_vote: {
				$gte: newDate(newDate().setHours(0, 0, 0)),
				$lte: newDate(newDate().setHours(23, 59, 59))
			}
		};

		// Add user identifier to query conditions
		if (userId !== '') {
			alreadyVoteConditions['user_id'] = userId;
		} else {
			alreadyVoteConditions['unique_browser_id'] = uniqueBrowserId;
		}

		try {
			// Query the database to check if the user has already voted
			const resultAlreadyVote = await pollVoteParticipants.find(alreadyVoteConditions, {
				projection: {
					'_id': 1,
					'created': 1,
					'custom_url': 1,
					'option_id': 1,
					'unique_browser_id': 1,
					'next_date_vote': 1
				}
			}).toArray();

			if (resultAlreadyVote && resultAlreadyVote.length > 0) {
				// User has already voted
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						time_remaining: resultTimerHours,
						voted_option_id: (resultAlreadyVote[0] && resultAlreadyVote[0]['option_id']) ? resultAlreadyVote[0]['option_id'] : "",
						result: true,
					}
				};
			} else {
				// User has not voted yet
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						resultAlreadyVote: resultAlreadyVote,
						time_remaining: "",
						voted_option_id: "",
						result: false,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End alreadyVoteCheck();

	/**
	 * Function used to check vote participants of poll
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollUserVoteParticipants = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let loginUserName = loginUserData.full_name ? loginUserData.full_name : "";
		let pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		let optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";
		let uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		let customUrl = req.body.custom_url ? req.body.custom_url : "";
		let pollType = req.body.poll_type ? req.body.poll_type : SINGLE_POLL_TYPE;

		let isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;
		let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		let gender = loginUserData.gender ? loginUserData.gender : "";
		let dob = loginUserData.dob ? loginUserData.dob : "";
		let zip = loginUserData.zip ? loginUserData.zip : "";
		let thirdPartySiteUrl = req.body.third_party_site_url ? req.body.third_party_site_url : "";

		/** Today night 12'o clock Time */
		let currentDate = newDate('', 'yyyy-mm-dd');
		let midleNightDate = getUtcDate(currentDate + " 23:59:59");

		/** Time difference after two date mid night (time remaining) */
		let resultTimerHours = getTimeRemaining();

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const polls = db.collection(TABLE_POLLS);

		let finalResponse = {};

		try {
			// Run queries in parallel using Promise.all
			const [
				pollData,
				lastVoteDetails,
				checkUserAlreadyVoted
			] = await Promise.all([
				// Fetch poll data
				polls.findOne({
					'_id': pollId,
					'slug': pollSlug,
					'custom_url': customUrl,
					'is_published': POLL_PUBLISHED,
					'options': { $elemMatch: { '_id': optionId } },
				}, {
					projection: {
						'_id': 1,
						'question': 1,
						'options': 1,
						'reward_id': 1,
						'user_id': 1,
						'total_count': 1,
						'created': 1
					}
				}),
				// Get last vote details for this user and poll
				pollVoteParticipants.find({
					'poll_id': pollId,
					'next_date_vote': { $gte: getUtcDate() },
					'unique_browser_id': uniqueBrowserId,
					'user_id': userId,
				}, {
					projection: {
						'_id': 1,
						'created': 1,
						'unique_browser_id': 1
					}
				}).toArray(),
				// Check if user has already voted (first time vote check)
				alreadyUserPollVoteCheck(userId, pollId)
			]);

			// If poll not found
			if (!pollData || Object.keys(pollData).length === 0) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'check_user_already_voted': 0,
						'assign_reward': "",
						'result': {},
						'time_remaining': resultTimerHours,
						'message': res.__("front.polls.poll_not_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// If user has already voted within 24 hours
			if (lastVoteDetails && lastVoteDetails.length > 0) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'check_user_already_voted': 0,
						'assign_reward': "",
						'result': {},
						'time_remaining': resultTimerHours,
						'message': res.__("front.polls.you_have_already_submitted_your_vote"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare poll and user data for vote insertion
			let optionsData = pollData.options ? pollData.options : [];
			let makePollUserId = pollData.user_id ? newObjectIdDefault(pollData.user_id) : "";
			let pollQuestion = pollData.question ? pollData.question : "";
			let pollCreated = pollData.created ? pollData.created : "";
			let foundOptionsValue = optionsData.filter(obj => (obj._id).toString() === (optionId).toString());
			let assignReward = (foundOptionsValue.length > 0) ? foundOptionsValue[0]['assign_reward'] : "";
			let allOptionsValue = (foundOptionsValue.length > 0) ? foundOptionsValue[0] : {};

			let age = DEACTIVE;
			if (dob !== "") {
				let dobConvert = mongoDatetoSimpleDateConvert(dob);
				age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
			}

			// Get followers/following status
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Insert poll vote participant
			const insertData = {
				"ip": req.body.ip,
				"user_id": userId,
				"assign_reward": assignReward,
				"make_poll_user_id": makePollUserId,
				"option_id": optionId,
				"poll_id": pollId,
				"poll_slug": pollSlug,
				"poll_question": pollQuestion,
				"poll_created": pollCreated,
				"custom_url": customUrl,
				"unique_browser_id": uniqueBrowserId,
				"options": allOptionsValue,
				"next_date_vote": midleNightDate,
				"view_type": isViewType,
				"poll_type": pollType,
				"latest_vote": userId ? DEFAULT_ONE : DEFAULT_ZERO,
				"account_type": userId ? accountType : "",
				"gender": userId ? gender : "",
				"dob": userId ? dob : "",
				"age": userId ? age : "",
				"zip": userId ? zip : "",
				"is_followers": followResponse.is_followers ? followResponse.is_followers : 0,
				"is_followers_requested_received": followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
				"is_following": followResponse.is_following ? followResponse.is_following : 0,
				"is_following_requested_send": followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
				"third_party_site_url": thirdPartySiteUrl,
				"created": getUtcDate(),
				"modified": getUtcDate(),
			};

			let resultParticipants;
			try {
				resultParticipants = await pollVoteParticipants.insertOne(insertData);
			} catch (errParticipants) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'time_remaining': resultTimerHours,
						'message': res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update total count for poll vote
			let optionsCountData = {
				'poll_id': pollId,
				'option_id': optionId
			};
			await totalCountPollVote(optionsCountData);

			// If user is logged in, update latest_vote flag for previous votes
			if (userId) {
				let lastInsertedVoteId = resultParticipants.insertedId ? resultParticipants.insertedId : "";
				let updateLastVoteFlag = {
					'_id': { $ne: lastInsertedVoteId },
					'user_id': userId,
					'poll_id': pollId,
				};
				await pollVoteParticipants.updateMany(updateLastVoteFlag, { $set: { 'latest_vote': DEFAULT_ZERO } });

				// Send notification to poll owner
				let notificationMessageParams = [loginUserName, pollQuestion];
				let notificationOptions = {
					notification_data: {
						notification_type: NOTIFICATION_SEND_VOTE_POLLS,
						message_params: notificationMessageParams,
						parent_table_id: makePollUserId,
						user_id: makePollUserId,
						user_ids: [makePollUserId],
						user_role_id: FRONT_ADMIN_ROLE_ID,
						role_id: FRONT_ADMIN_ROLE_ID,
						extra_parameters: {
							'user_id': newObjectIdDefault(makePollUserId),
							'poll_slug': pollSlug,
							'custom_url': customUrl,
							'send_vote_user_id': newObjectIdDefault(userId),
						}
					}
				};
				// Fire and forget notification
				insertNotifications(req, res, notificationOptions);

				// Send mail to the owner of the lead form after vote
				mailSentToLoyalistUserAfterVote(req, res, { 'vote_user_id': userId });
			}

			// Assign reward if user is logged in and hasn't already voted
			if (userId && assignReward && checkUserAlreadyVoted == 0) {
				let addEarnRewardsOptions = {
					'assign_reward': assignReward,
					'reward_send_user_id': userId,
					'login_user_email': loginUserData.email,
					'login_user_full_name': loginUserData.full_name,
					'template_type': POLL_SEND_REWARDS_TYPE,
					"poll_id": pollId,
					"poll_slug": pollSlug,
					"make_poll_user_id": makePollUserId,
					"login_user_data": loginUserData,
					"poll_created": pollCreated,
				};

				// Assign earn rewards to user
				await addUserEarnRewards(req, res, addEarnRewardsOptions);

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'assign_reward': assignReward,
						'check_user_already_voted': 0,
						'result': {},
						'time_remaining': resultTimerHours,
						'message': res.__("front.polls.vote_has_been_applied"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'check_user_already_voted': checkUserAlreadyVoted,
						'assign_reward': assignReward,
						'result': {},
						'time_remaining': resultTimerHours,
						'message': res.__("front.polls.vote_has_been_applied"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'time_remaining': resultTimerHours,
					'message': error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollUserVoteParticipants();

	/**
	 * Function used to get participants list
	 * @param {*} req 	As Request Data
	 * @param {*} res 	As Response Data
	 * @param {*} next	As Callback argument to the middleware function
	 * @return json
	 **/
	this.getParticipantsList = async (req, res) => {
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		let filterTo = req.body.filter_to ? req.body.filter_to : "";

		let finalResponse = {};

		// Validate pollSlug
		if (pollSlug === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		let page = req.body.page ? parseInt(req.body.page) : 1;
		let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		let skip = (limit * page) - limit;

		let condition = {
			user_id: { $nin: [null, ""] },
			poll_slug: pollSlug
		};

		// Filter according to today's date
		if (filterTo === TODAY_POLLS_FILTER) {
			condition['created'] = {
				$gte: new Date(new Date().setHours(0, 0, 0)),
				$lte: new Date(new Date().setHours(23, 59, 59))
			};
		}

		// Filter according to previous date
		if (filterTo === YESTERDAY_POLLS_FILTER) {
			condition['created'] = {
				$gte: new Date(getPreviousDay().setHours(0, 0, 0)),
				$lte: new Date(getPreviousDay().setHours(23, 59, 59))
			};
		}

		let searchCondition = {};
		let userName = req.body.search_user_name ? req.body.search_user_name : "";
		if (userName !== "") {
			searchCondition['user_full_name'] = { $regex: new RegExp(userName, "i") };
		}

		try {
			// Prepare all queries to run in parallel using Promise.all

			// 1. Get participants list with user details and search
			const participantsListPromise = pollVoteParticipants.aggregate([
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
									}
								}
							},
							{
								$project: {
									"_id": 1,
									"full_name": { $cond: ["$public_business_informaton.name_of_the_business", "$public_business_informaton.name_of_the_business", "$full_name"] },
									"profile_image": 1,
									"slug": 1,
									"account_type": 1,
									"email": 1
								}
							}
						],
						as: "user_details"
					}
				},
				{
					$group: {
						_id: "$user_id",
						user_id: { $first: "$user_id" },
						followed_by: { $first: "$user_id" },
						poll_slug: { $first: "$poll_slug" },
						make_poll_user_id: { $first: "$make_poll_user_id" },
						created: { $first: "$created" },
						user_full_name: { $first: { $arrayElemAt: ["$user_details.full_name", 0] } },
						user_profile_image: { $first: { $arrayElemAt: ["$user_details.profile_image", 0] } },
						user_email: { $first: { $arrayElemAt: ["$user_details.email", 0] } },
						user_slug: { $first: { $arrayElemAt: ["$user_details.slug", 0] } },
						account_type: { $first: { $arrayElemAt: ["$user_details.account_type", 0] } },
					}
				},
				{ $match: searchCondition },
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			]).toArray();

			// 2. Get total record count with search
			const totalRecordPromise = pollVoteParticipants.aggregate([
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
									}
								}
							},
							{
								$project: {
									"_id": 1,
									"full_name": { $cond: ["$public_business_informaton.name_of_the_business", "$public_business_informaton.name_of_the_business", "$full_name"] },
									"profile_image": 1,
									"slug": 1,
									"account_type": 1,
									"email": 1
								}
							}
						],
						as: "user_details"
					}
				},
				{
					$group: {
						_id: "$user_id",
						user_id: { $first: "$user_id" },
						poll_slug: { $first: "$poll_slug" },
						make_poll_user_id: { $first: "$make_poll_user_id" },
						created: { $first: "$created" },
						user_full_name: { $first: { $arrayElemAt: ["$user_details.full_name", 0] } },
						user_profile_image: { $first: { $arrayElemAt: ["$user_details.profile_image", 0] } },
						user_email: { $first: { $arrayElemAt: ["$user_details.email", 0] } },
						user_slug: { $first: { $arrayElemAt: ["$user_details.slug", 0] } },
						account_type: { $first: { $arrayElemAt: ["$user_details.account_type", 0] } },
					}
				},
				{ $match: searchCondition }
			]).toArray();

			// 3. Get participants count (without search)
			const participantsCountPromise = pollVoteParticipants.aggregate([
				{ $match: condition },
				{ $group: { _id: "$user_id" } }
			]).toArray();

			// 4. Get logged in user following user ids (approved)
			const followingCondition = {
				followed_by: userId,
				is_approved: ACTIVE,
				action_type: FOLLOW_ACTION_TYPE,
			};
			const loginUserFollowingUserPromise = usersFollower.distinct('user_id', followingCondition);

			// 5. Get logged in user following user ids (unapproved)
			const unApproveFollowingCondition = {
				followed_by: userId,
				is_approved: DEACTIVE,
				action_type: FOLLOW_ACTION_TYPE,
			};
			const loginUserUnApproveFollowingUserPromise = usersFollower.distinct('user_id', unApproveFollowingCondition);

			// Await all promises in parallel
			const [
				participantsList,
				totalRecordArr,
				participantsCountArr,
				loginUserFollowingUser,
				loginUserUnApproveFollowingUser
			] = await Promise.all([
				participantsListPromise,
				totalRecordPromise,
				participantsCountPromise,
				loginUserFollowingUserPromise,
				loginUserUnApproveFollowingUserPromise
			]);

			const totalRecord = totalRecordArr ? totalRecordArr.length : 0;
			const participantsCount = participantsCountArr ? participantsCountArr.length : 0;

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					participants_count: participantsCount,
					recordsTotal: totalRecord,
					result: participantsList || [],
					login_user_following_array: loginUserFollowingUser || [],
					login_user_unapprove_following_array: loginUserUnApproveFollowingUser || [],
					limit: limit,
					page: page,
					total_page: Math.ceil(totalRecord / limit),
					user_image_url: USERS_URL,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getParticipantsList();

	/**
	 * Function used to save poll report abuse data
	 * Uses async/await for database queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.savePollReportAbuse = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const makePollUserId = req.body.make_poll_user_id ? newObjectIdDefault(req.body.make_poll_user_id) : "";
		const reportId = req.body.report_id ? newObjectIdDefault(req.body.report_id) : "";
		const reportComment = req.body.report_comment ? req.body.report_comment : "";

		let finalResponse = {};

		// Validate user authentication
		if (userId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const polls = db.collection(TABLE_POLLS);
		const abuseReport = db.collection(TABLE_POLL_REPORT_ABUSE);

		try {
			// Check if the poll exists with the given details
			const poll = await polls.findOne(
				{
					"_id": pollId,
					"slug": pollSlug,
					"user_id": makePollUserId,
				},
				{
					projection: {
						"_id": 1,
						"slug": 1,
					}
				}
			);

			if (!poll) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Insert the abuse report for the poll
			await abuseReport.insertOne({
				report_id: reportId,
				report_comment: reportComment,
				poll_id: pollId,
				make_poll_user_id: makePollUserId,
				poll_slug: pollSlug,
				user_id: userId,
				is_deleted: NOT_DELETED,
				created: getUtcDate(),
				modified: getUtcDate(),
			});

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.polls.report_has_beed_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End savePollReportAbuse();

	/**
	 * Function used to get poll abuse reports list
	 * Uses async/await and runs queries in parallel with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getPollAbuseReportsList = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const skip = (limit * page) - limit;

		const collection = db.collection(TABLE_POLL_REPORT_ABUSE);

		let finalResponse = {};

		// Validate user
		if (userId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const commonConditions = {
			make_poll_user_id: userId
		};

		try {
			// Prepare aggregation pipeline for listing
			const listingPipeline = [
				{ $match: commonConditions },
				{
					$lookup: {
						from: TABLE_POLLS,
						let: { pollId: "$poll_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$pollId"] },
										]
									}
								}
							},
							{
								$project: {
									"_id": 1,
									"question": 1
								}
							}
						],
						as: "pollDetails"
					}
				},
				{
					$group: {
						_id: "$poll_id",
						poll_slug: { $first: "$poll_slug" },
						user_id: { $first: "$user_id" },
						is_deleted: { $first: "$is_deleted" },
						created: { $first: "$created" },
						question: { $first: { $arrayElemAt: ["$pollDetails.question", 0] } },
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			];

			// Prepare aggregation pipeline for total record count
			const countPipeline = [
				{ $match: commonConditions },
				{ $group: { _id: "$poll_id" } },
			];

			// Run both queries in parallel
			const [listing, totalRecordArr] = await Promise.all([
				collection.aggregate(listingPipeline).toArray(),
				collection.aggregate(countPipeline).toArray()
			]);

			const totalRecord = totalRecordArr ? totalRecordArr.length : 0;

			// Send response
			if (totalRecord > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: listing || [],
						recordsTotal: totalRecord,
						message: "",
						limit: limit,
						page: page,
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						users_url: USERS_URL,
						result: [],
						recordsTotal: 0,
						message: res.__("front.global.no_record_found"),
						limit: limit,
						page: page,
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getPollAbuseReportsList();

	/**
	 * Function used to get users who commented on poll abusive content list
	 * Uses async/await and runs queries in parallel with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getWhoCommentedUserPollAbuseList = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";

		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const skip = (limit * page) - limit;

		const collection = db.collection(TABLE_POLL_REPORT_ABUSE);

		let finalResponse = {};

		// Validate required fields
		if (userId === '' || pollSlug === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Common query conditions
		const commonConditions = {
			make_poll_user_id: userId,
			poll_slug: pollSlug
		};

		try {
			// Prepare aggregation pipeline for listing
			const listingPipeline = [
				{ $match: commonConditions },
				{
					$lookup: {
						from: TABLE_MASTERS,
						localField: "report_id",
						foreignField: "_id",
						as: "masterDetails"
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
											{ $eq: ["$_id", "$$userId"] }
										]
									}
								}
							},
							{
								$project: {
									"_id": 1,
									"full_name": 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						'_id': 1,
						'poll_id': 1,
						'poll_slug': 1,
						'created': 1,
						'report_id': 1,
						'report_comment': 1,
						'is_deleted': 1,
						'full_name': { $arrayElemAt: ["$userDetails.full_name", 0] },
						'report_name': { $arrayElemAt: ["$masterDetails.name", 0] },
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			];

			// Run listing and count queries in parallel
			const [listing, totalRecord] = await Promise.all([
				collection.aggregate(listingPipeline).toArray(),
				collection.countDocuments(commonConditions)
			]);

			// Send response
			if (totalRecord > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: listing || [],
						recordsTotal: totalRecord,
						message: "",
						limit: limit,
						page: page,
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						users_url: USERS_URL,
						result: [],
						recordsTotal: 0,
						message: res.__("front.global.no_record_found"),
						limit: limit,
						page: page,
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getWhoCommentedUserPollAbuseList();

	/**
	 * Function used to save poll comment report abuse
	 * Uses async/await for database queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.savePollCommnetReportAbuse = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const makePollUserId = req.body.make_poll_user_id ? newObjectIdDefault(req.body.make_poll_user_id) : "";
		const reportId = req.body.report_id ? newObjectIdDefault(req.body.report_id) : "";
		const commentId = req.body.comment_id ? newObjectIdDefault(req.body.comment_id) : "";
		const reportComment = req.body.report_comment ? req.body.report_comment : "";

		let finalResponse = {};

		// Validate user authentication
		if (userId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const polls = db.collection(TABLE_POLLS);
		const abuseCommentReport = db.collection(TABLE_POLL_COMMENT_REPORT_ABUSE);

		try {
			// Check if the poll exists with the given details
			const poll = await polls.findOne(
				{
					"_id": pollId,
					"slug": pollSlug,
					"user_id": makePollUserId,
				},
				{
					projection: {
						"_id": 1,
						"slug": 1,
					}
				}
			);

			if (!poll) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Insert the abuse report for the poll comment
			await abuseCommentReport.insertOne({
				report_id: reportId,
				report_comment: reportComment,
				poll_id: pollId,
				make_poll_user_id: makePollUserId,
				poll_slug: pollSlug,
				user_id: userId,
				comment_id: commentId,
				is_deleted: NOT_DELETED,
				created: getUtcDate(),
				modified: getUtcDate(),
			});

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.polls.report_has_beed_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End savePollCommnetReportAbuse();

	/**
	 * Function used to get report list of all abusive comments on poll
	 * Uses async/await and runs queries in parallel with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getPollCommentAbuseReportsList = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const skip = (limit * page) - limit;

		const collection = db.collection(TABLE_POLL_COMMENT_REPORT_ABUSE);

		let finalResponse = {};

		// Validate user authentication
		if (userId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const commonConditions = {
			make_poll_user_id: userId
		};

		try {
			// Prepare aggregation pipeline for listing
			const listingPipeline = [
				{ $match: commonConditions },
				{
					$lookup: {
						from: TABLE_POLLS,
						let: { pollId: "$poll_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$pollId"] },
										]
									}
								}
							},
							{
								$project: {
									"_id": 1,
									"question": 1
								}
							}
						],
						as: "pollDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_POLLS_COMMENTS,
						localField: "comment_id",
						foreignField: "_id",
						as: "commentDetails"
					}
				},
				{
					$group: {
						_id: "$comment_id",
						poll_slug: { $first: "$poll_slug" },
						user_id: { $first: "$user_id" },
						is_deleted: { $first: "$is_deleted" },
						created: { $first: "$created" },
						question: { $first: { $arrayElemAt: ["$pollDetails.question", 0] } },
						comment: { $first: { $arrayElemAt: ["$commentDetails.comment", 0] } },
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
			];

			// Prepare aggregation pipeline for total record count
			const totalRecordPipeline = [
				{ $match: commonConditions },
				{ $group: { _id: "$poll_id" } },
			];

			// Run both queries in parallel
			const [listing, totalRecordArr] = await Promise.all([
				collection.aggregate(listingPipeline).toArray(),
				collection.aggregate(totalRecordPipeline).toArray()
			]);

			const totalRecord = totalRecordArr ? totalRecordArr.length : 0;

			// Send response
			if (totalRecord > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: listing || [],
						recordsTotal: totalRecord,
						message: "",
						limit: limit,
						page: page,
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						users_url: USERS_URL,
						result: [],
						recordsTotal: 0,
						message: res.__("front.global.no_record_found"),
						limit: limit,
						page: page,
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getPollCommentAbuseReportsList();

	/**
	 * Function used to get poll abusive comments report details
	 * Uses async/await and runs queries in parallel with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollCommentAbuseReportsDetails = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and comment information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const commentId = req.body.comment_id ? newObjectIdDefault(req.body.comment_id) : "";

		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const skip = (limit * page) - limit;

		const collection = db.collection(TABLE_POLL_COMMENT_REPORT_ABUSE);

		let finalResponse = {};

		// Validate required fields
		if (userId === '' || commentId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare common query conditions
		const commonConditions = {
			make_poll_user_id: userId,
			comment_id: commentId
		};

		try {
			// Prepare aggregation pipeline for listing
			const listingPipeline = [
				{ $match: commonConditions },
				{
					$lookup: {
						from: TABLE_MASTERS,
						localField: "report_id",
						foreignField: "_id",
						as: "masterDetails"
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
											{ $eq: ["$_id", "$$userId"] }
										]
									}
								}
							},
							{
								$project: {
									"_id": 1,
									"full_name": 1
								}
							}
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						'_id': 1,
						'poll_id': 1,
						'poll_slug': 1,
						'created': 1,
						'report_id': 1,
						'report_comment': 1,
						'comment_id': 1,
						'is_deleted': 1,
						'full_name': { $arrayElemAt: ["$userDetails.full_name", 0] },
						'report_name': { $arrayElemAt: ["$masterDetails.name", 0] },
					}
				},
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit }
			];

			// Run queries in parallel using Promise.all
			const [listing, totalRecord] = await Promise.all([
				collection.aggregate(listingPipeline).toArray(),
				collection.countDocuments(commonConditions)
			]);

			// Send response
			if (totalRecord > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: listing || [],
						recordsTotal: totalRecord,
						message: "",
						limit: limit,
						page: page,
						total_page: Math.ceil(totalRecord / limit)
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						users_url: USERS_URL,
						result: [],
						recordsTotal: 0,
						message: res.__("front.global.no_record_found"),
						limit: limit,
						page: page,
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollCommentAbuseReportsDetails();

	/**
	 * Function used to assign session reward after login
	 * Uses async/await for all database queries and parallel operations.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.assignSessionRewardAfterLogin = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let loginUserData = req.user_data ? req.user_data : "";
		let loginUserName = loginUserData.full_name ? loginUserData.full_name : "";
		let userEmail = loginUserData.email ? loginUserData.email : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		let gender = loginUserData.gender ? loginUserData.gender : "";
		let dob = loginUserData.dob ? loginUserData.dob : "";
		let zip = loginUserData.zip ? loginUserData.zip : "";
		let age = DEACTIVE;
		if (dob !== "") {
			let dobConvert = mongoDatetoSimpleDateConvert(dob);
			age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
		}
		let embedType = req.body.embed_type ? req.body.embed_type : "";

		let finalResponse = {};

		// Validate user authentication
		if (userId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare query condition for poll vote participant
		let conditionData = {
			"unique_browser_id": uniqueBrowserId,
			"user_id": { $in: [null, ''] },
			"created": {
				$gte: newDate(newDate().setHours(0, 0, 0)),
				$lte: newDate(newDate().setHours(23, 59, 59))
			}
		};

		// If embed type is set, add poll_slug to condition
		if (embedType === true || embedType === 'true') {
			conditionData['poll_slug'] = req.body.poll_slug ? req.body.poll_slug : "";
		}

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		try {
			// Find poll vote participant for this session
			const resultVoteParticipants = await pollVoteParticipants.findOne(conditionData, {
				projection: {
					'assign_reward': 1,
					'make_poll_user_id': 1,
					'poll_id': 1,
					'poll_question': 1,
					'poll_slug': 1,
					'custom_url': 1,
					'poll_created': 1,
				}
			});

			if (!resultVoteParticipants) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						check_user_already_voted: 0,
						result: {},
						message: res.__("front.polls.no_poll_vote_participants"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract relevant fields
			let pollVoteParticipantId = resultVoteParticipants._id ? newObjectIdDefault(resultVoteParticipants._id) : "";
			let pollId = resultVoteParticipants.poll_id ? resultVoteParticipants.poll_id : "";
			let assignReward = resultVoteParticipants.assign_reward ? resultVoteParticipants.assign_reward : "";
			let makePollUserId = resultVoteParticipants.make_poll_user_id ? resultVoteParticipants.make_poll_user_id : "";
			let pollQuestion = resultVoteParticipants.poll_question ? resultVoteParticipants.poll_question : "";
			let pollSlug = resultVoteParticipants.poll_slug ? resultVoteParticipants.poll_slug : "";
			let customUrl = resultVoteParticipants.custom_url ? resultVoteParticipants.custom_url : "";
			let pollCreated = resultVoteParticipants.poll_created ? resultVoteParticipants.poll_created : "";

			// Send notification to poll owner if userId exists
			if (userId) {
				let notificationMessageParams = [loginUserName, pollQuestion];
				let notificationOptions = {
					notification_data: {
						notification_type: NOTIFICATION_SEND_VOTE_POLLS,
						message_params: notificationMessageParams,
						parent_table_id: makePollUserId,
						user_id: makePollUserId,
						user_ids: [makePollUserId],
						user_role_id: FRONT_ADMIN_ROLE_ID,
						role_id: FRONT_ADMIN_ROLE_ID,
						extra_parameters: {
							'user_id': newObjectIdDefault(makePollUserId),
							'poll_slug': pollSlug,
							'custom_url': customUrl,
							'send_vote_user_id': newObjectIdDefault(userId),
						}
					}
				};
				// Fire and forget notification
				insertNotifications(req, res, notificationOptions);

				// Update latest_vote flag for this and other votes
				let updateLastVoteFlag = {
					'_id': { $ne: pollVoteParticipantId },
					'user_id': userId,
					'poll_id': pollId,
				};
				await Promise.all([
					pollVoteParticipants.updateOne({ '_id': pollVoteParticipantId }, { $set: { 'latest_vote': DEFAULT_ONE } }),
					pollVoteParticipants.updateMany(updateLastVoteFlag, { $set: { 'latest_vote': DEFAULT_ZERO } })
				]);
			}

			// Check if user already voted and if user can vote today (run in parallel)
			const [checkUserAlreadyVoted, saneDateVoteCheckCount] = await Promise.all([
				alreadyUserPollVoteCheck(userId, pollId),
				userCheckOneDayOnetimeVoteCheck(userId, pollId)
			]);

			if (saneDateVoteCheckCount === 0) {
				// User can vote today

				if (userId && assignReward) {
					// Assign reward if not already voted
					if (checkUserAlreadyVoted === 0) {
						let addEarnRewardsOptions = {
							'assign_reward': assignReward,
							'reward_send_user_id': userId,
							'login_user_email': loginUserData.email,
							'login_user_full_name': loginUserData.full_name,
							'template_type': POLL_SEND_REWARDS_TYPE,
							"poll_id": pollId,
							"poll_slug": pollSlug,
							"make_poll_user_id": makePollUserId,
							"login_user_data": loginUserData,
							"poll_created": pollCreated,
						};
						// Assign earn rewards to user (fire and forget)
						addUserEarnRewards(req, res, addEarnRewardsOptions);
					}

					// Get followers/following info and update participant document
					const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);
					await pollVoteParticipants.updateOne(
						{ _id: newObjectIdDefault(pollVoteParticipantId) },
						{
							$set: {
								'user_id': userId,
								"account_type": userId ? accountType : "",
								"gender": userId ? gender : "",
								"dob": userId ? dob : "",
								"age": userId ? age : "",
								"zip": userId ? zip : "",
								"is_followers": followResponse.is_followers ? followResponse.is_followers : 0,
								"is_followers_requested_received": followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
								"is_following": followResponse.is_following ? followResponse.is_following : 0,
								"is_following_requested_send": followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
								"session_login": true,
							}
						}
					);

					// Send success message
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							check_user_already_voted: checkUserAlreadyVoted,
							result: resultVoteParticipants,
							message: res.__("front.polls.send_reward"),
						}
					};
					return returnApiResult(req, res, finalResponse);

				} else {
					// No reward to assign, just update participant info
					const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);
					await pollVoteParticipants.updateOne(
						{ _id: newObjectIdDefault(pollVoteParticipantId) },
						{
							$set: {
								'user_id': userId,
								"account_type": userId ? accountType : "",
								"gender": userId ? gender : "",
								"dob": userId ? dob : "",
								"age": userId ? age : "",
								"zip": userId ? zip : "",
								"is_followers": followResponse.is_followers ? followResponse.is_followers : 0,
								"is_followers_requested_received": followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
								"is_following": followResponse.is_following ? followResponse.is_following : 0,
								"is_following_requested_send": followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
								"session_login": true,
							}
						}
					);

					finalResponse = {
						data: {
							status: STATUS_ERROR,
							check_user_already_voted: 0,
							result: resultVoteParticipants,
							message: res.__("front.polls.not_send_reward"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// User already voted today
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						check_user_already_voted: checkUserAlreadyVoted,
						result: resultVoteParticipants,
						message: res.__("front.polls.this_user_already_voted_current_day"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					check_user_already_voted: 0,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End assignSessionRewardAfterLogin();

	/**
	 * Function used to add multiple rewards
	 * Uses async/await for all database queries and file operations.
	 * Handles all reward assignments in series for each reward form entry.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.addMultipleRewards = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		let addRewardFormArray = req.body.add_reward_form ? req.body.add_reward_form : [];
		let singleOptionSubmittedType = req.body.single_option_submitted_type ? req.body.single_option_submitted_type : "";

		let finalResponse = {};
		const polls = db.collection(TABLE_POLLS);

		// Validate required fields
		if (userId === '' || addRewardFormArray.length === 0 || pollSlug === "") {
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
			// Process each reward form entry in series
			for (let index = 0; index < addRewardFormArray.length; index++) {
				const recordRewards = addRewardFormArray[index];

				let rewardId = recordRewards.rewards_id ? newObjectIdDefault(recordRewards.rewards_id) : "";
				let optionId = recordRewards.option_id ? newObjectIdDefault(recordRewards.option_id) : "";
				let enticementHeadline = recordRewards.enticement_headline ? (recordRewards.enticement_headline).trim() : "";

				let heading = recordRewards.heading ? recordRewards.heading : "";
				let subHeading = recordRewards.sub_heading ? recordRewards.sub_heading : "";
				let description = recordRewards.description ? recordRewards.description : "";
				let expiryDate = recordRewards.expiry_date ? recordRewards.expiry_date : "";
				let storeTypeIds = recordRewards.store_type_id ? recordRewards.store_type_id : [];
				let image = (req.files && req['files']['add_multiple_images' + index]) ? req['files']['add_multiple_images' + index] : "";
				let toogleExpiryDate = (recordRewards.toogle_expiry_date == 1 || recordRewards.toogle_expiry_date == '1') ? true : false;

				// Convert store type IDs to ObjectId array
				let storeTypeIdsArray = [];
				if (Array.isArray(storeTypeIds) && storeTypeIds.length > 0) {
					storeTypeIdsArray = storeTypeIds.map(recordsIds => newObjectIdDefault(recordsIds));
				}

				let conditionData = {
					'user_id': userId,
					'slug': pollSlug,
					"options._id": optionId
				};

				// If single option submitted type and first index, clear reward and enticement headline
				if (singleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE && index == 0) {
					rewardId = "";
					heading = "";
					enticementHeadline = "";
				}

				// Case 1: Assign existing reward and enticement headline
				if (rewardId !== "" && enticementHeadline !== "") {
					// Update poll option with reward and enticement headline
					await polls.updateOne(
						conditionData,
						{ $set: { 'options.$.assign_reward': rewardId, 'options.$.enticement_headline': enticementHeadline } }
					);
				}

				// Case 2: Create new reward and assign to poll option
				else if (
					rewardId === "" &&
					heading !== '' &&
					subHeading !== '' &&
					description !== '' &&
					storeTypeIdsArray.length > 0 &&
					enticementHeadline !== ''
				) {
					// Upload image if provided
					let imageName = "";
					if (image) {
						const options = {
							'image': image,
							'filePath': LEADS_FORM_FILE_PATH,
						};
						const uploadResponse = await moveUploadedFile(req, res, options);
						if (uploadResponse.status !== STATUS_ERROR) {
							imageName = uploadResponse.fileName ? uploadResponse.fileName : "";
						}
					}

					// Prepare new reward data
					let packageRewardData = {
						'user_id': userId,
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
						'store_type_id': storeTypeIdsArray,
						'type': REWARDS_USER_ADD,
						'expiry_date': (toogleExpiryDate) ? ageUtcDate(expiryDate) : "",
						'toogle_expiry_date': toogleExpiryDate,
					};

					// Add new reward and assign to poll option
					const responseRewardId = await addPackageReward(packageRewardData);
					await polls.updateOne(
						conditionData,
						{ $set: { 'options.$.assign_reward': responseRewardId, 'options.$.enticement_headline': enticementHeadline } }
					);
				}

				// Case 3: Remove reward and enticement headline if both are blank
				else if (rewardId === "" && enticementHeadline === "") {
					await polls.updateOne(
						conditionData,
						{ $set: { 'options.$.assign_reward': "", 'options.$.enticement_headline': "" } }
					);
				}
				// All other cases are ignored
			}

			// All rewards processed successfully
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.polls.reward_has_been_submitted_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any error during the process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End addMultipleRewards();

	/**
	 * Function used to edit option title or poll question
	 * Uses async/await for all database queries.
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @returns json response
	 */
	this.editPollOptionTitle = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and option information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const optionId = req.body.option_id ? req.body.option_id : "";
		const optionTitle = req.body.title ? req.body.title : "";

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollSlug || !optionId || !optionTitle) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare data for editing poll option title
		const editOptions = {
			poll_slug: pollSlug,
			user_id: userId,
			option_id: optionId,
			title: optionTitle
		};

		try {
			// Call function to edit poll option title using async/await
			const editResponse = await pollOptionTitle(req, res, editOptions);

			// Send response
			finalResponse = {
				data: {
					status: editResponse.status,
					message: editResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any error during the process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editPollOptionTitle();

	/**
	 * Function used to share icon logs
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.shareIconLogs = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and request information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		const gender = loginUserData.gender ? loginUserData.gender : "";
		const dob = loginUserData.dob ? loginUserData.dob : "";
		const zip = loginUserData.zip ? loginUserData.zip : "";

		const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const shareType = req.body.share_type ? req.body.share_type : "";
		const platform = req.body.platform ? req.body.platform : "";
		const isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;

		let age = DEACTIVE;
		if (dob !== "") {
			const dobConvert = mongoDatetoSimpleDateConvert(dob);
			age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
		}

		let finalResponse = {};

		// Validate required fields
		if (!pollSlug || !shareType) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Fetch poll details by slug
			const resultPolls = await db.collection(TABLE_POLLS).findOne({ slug: pollSlug });

			if (!resultPolls) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const makePollUserId = resultPolls.user_id ? resultPolls.user_id : "";

			// Get poll followers/non-followers info in parallel if needed
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Prepare log data for insertion
			const logData = {
				ip: req.body.ip,
				user_id: userId,
				custom_url: resultPolls.custom_url ? resultPolls.custom_url : "",
				make_poll_user_id: makePollUserId,
				poll_id: resultPolls._id ? newObjectIdDefault(resultPolls._id) : "",
				poll_question: resultPolls.question ? resultPolls.question : "",
				poll_slug: pollSlug,
				unique_browser_id: uniqueBrowserId,
				account_type: userId ? accountType : "",
				gender: userId ? gender : "",
				dob: userId ? dob : "",
				age: userId ? age : "",
				zip: userId ? zip : "",
				share_type: shareType, // facebook, twitter, etc.
				platform: platform, // poll, pollset, etc.
				view_type: isViewType, // desktop, ios, mobile
				poll_created: resultPolls.created ? resultPolls.created : "",
				is_followers: followResponse.is_followers ? followResponse.is_followers : 0,
				is_followers_requested_received: followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
				is_following: followResponse.is_following ? followResponse.is_following : 0,
				is_following_requested_send: followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
				created: getUtcDate()
			};

			// Insert share icon log
			await db.collection(TABLE_SHARE_ICON_LOGS).insertOne(logData);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.polls.share_logs_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End shareIconLogs();

	/**
	 * Function used to manage poll ribbon clicks logs
	 * Uses async/await for all database queries and handles parallel operations with Promise.all if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollRibbonClicksLogs = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		let gender = loginUserData.gender ? loginUserData.gender : "";
		let dob = loginUserData.dob ? loginUserData.dob : "";
		let zip = loginUserData.zip ? loginUserData.zip : "";

		let uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		let isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;
		let optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";
		let age = DEACTIVE;

		if (dob !== "") {
			let dobConvert = mongoDatetoSimpleDateConvert(dob);
			age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
		}

		let finalResponse = {};

		// Validate required fields
		if (pollSlug === '' || !optionId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Fetch poll details
			const resultPolls = await db.collection(TABLE_POLLS).findOne({ slug: pollSlug });

			if (!resultPolls) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let makePollUserId = resultPolls.user_id ? resultPolls.user_id : "";

			// Get poll followers/non-followers info (async)
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Prepare log data for insertion
			const logData = {
				ip: req.body.ip,
				user_id: userId,
				custom_url: resultPolls.custom_url ? resultPolls.custom_url : "",
				make_poll_user_id: makePollUserId,
				poll_id: resultPolls._id ? newObjectIdDefault(resultPolls._id) : "",
				poll_question: resultPolls.question ? resultPolls.question : "",
				poll_slug: pollSlug,
				option_id: optionId,
				unique_browser_id: uniqueBrowserId,
				account_type: userId ? accountType : "",
				gender: userId ? gender : "",
				zip: userId ? zip : "",
				dob: userId ? dob : "",
				age: userId ? age : "",
				view_type: isViewType, // desktop, ios, mobile
				poll_created: resultPolls.created ? resultPolls.created : "",
				is_followers: followResponse.is_followers ? followResponse.is_followers : 0,
				is_followers_requested_received: followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
				is_following: followResponse.is_following ? followResponse.is_following : 0,
				is_following_requested_send: followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
				created: getUtcDate()
			};

			// Insert ribbon click log
			await db.collection(TABLE_RIBBON_CLICKS).insertOne(logData);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.polls.ribbon_click_logs_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollRibbonClicksLogs();

	/**
	 * Function used to check poll time spent logs
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollTimeSpentLogs = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and request information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		const gender = loginUserData.gender ? loginUserData.gender : "";
		const dob = loginUserData.dob ? loginUserData.dob : "";
		const zip = loginUserData.zip ? loginUserData.zip : "";

		const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;
		const startTime = req.body.start_time ? req.body.start_time : "";
		const endTime = req.body.end_time ? req.body.end_time : "";
		const spentTime = req.body.spent_time ? req.body.spent_time : "";

		let age = DEACTIVE;
		if (dob !== "") {
			const dobConvert = mongoDatetoSimpleDateConvert(dob);
			age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
		}

		let finalResponse = {};

		// Validate required fields
		if (!pollSlug || !startTime || !endTime || !spentTime) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Fetch poll details by slug
			const resultPolls = await db.collection(TABLE_POLLS).findOne({ slug: pollSlug });

			if (!resultPolls) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const makePollUserId = resultPolls.user_id ? resultPolls.user_id : "";

			// Get poll followers/non-followers info (async)
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Prepare log data for insertion
			const logData = {
				ip: req.body.ip,
				user_id: userId,
				custom_url: resultPolls.custom_url ? resultPolls.custom_url : "",
				make_poll_user_id: makePollUserId,
				poll_id: resultPolls._id ? newObjectIdDefault(resultPolls._id) : "",
				poll_question: resultPolls.question ? resultPolls.question : "",
				poll_slug: pollSlug,
				unique_browser_id: uniqueBrowserId,
				account_type: userId ? accountType : "",
				gender: userId ? gender : "",
				dob: userId ? dob : "",
				age: userId ? age : "",
				zip: userId ? zip : "",
				view_type: isViewType, // desktop, ios, mobile
				poll_created: resultPolls.created ? resultPolls.created : "",
				start_time: startTime,
				end_time: endTime,
				spent_time: Number(spentTime),
				is_followers: followResponse.is_followers ? followResponse.is_followers : 0,
				is_followers_requested_received: followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
				is_following: followResponse.is_following ? followResponse.is_following : 0,
				is_following_requested_send: followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
				created: getUtcDate()
			};

			// Insert time spent log
			await db.collection(TABLE_POLL_TIME_SPENT_LOGS).insertOne(logData);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.polls.timespent_click_logs_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollTimeSpentLogs();

	/**
	 * Function used to get poll link click logs
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollLinkClickLogs = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and request information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
		const gender = loginUserData.gender ? loginUserData.gender : "";
		const dob = loginUserData.dob ? loginUserData.dob : "";
		const zip = loginUserData.zip ? loginUserData.zip : "";

		const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;
		const anchorLink = req.body.anchor_link ? req.body.anchor_link : "";

		let age = DEACTIVE;
		if (dob !== "") {
			const dobConvert = mongoDatetoSimpleDateConvert(dob);
			age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
		}

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollSlug || !anchorLink) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Fetch poll details by slug
			const resultPolls = await db.collection(TABLE_POLLS).findOne({ slug: pollSlug });

			if (!resultPolls) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const makePollUserId = resultPolls.user_id ? resultPolls.user_id : "";

			// Get poll followers/non-followers info
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Prepare data for upsert
			const linkClicks = db.collection(TABLE_POLL_LINK_CLICKS);
			await linkClicks.updateOne(
				{
					user_id: userId,
					poll_slug: pollSlug,
					anchor_link: anchorLink,
				},
				{
					$set: {
						modified: getUtcDate()
					},
					$setOnInsert: {
						ip: req.body.ip,
						user_id: userId,
						custom_url: resultPolls.custom_url ? resultPolls.custom_url : "",
						make_poll_user_id: makePollUserId,
						poll_id: resultPolls._id ? newObjectIdDefault(resultPolls._id) : "",
						poll_question: resultPolls.question ? resultPolls.question : "",
						poll_slug: pollSlug,
						unique_browser_id: uniqueBrowserId,
						account_type: userId ? accountType : "",
						gender: userId ? gender : "",
						dob: userId ? dob : "",
						age: userId ? age : "",
						zip: userId ? zip : "",
						view_type: isViewType, // desktop, ios, mobile
						poll_created: resultPolls.created ? resultPolls.created : "",
						anchor_link: anchorLink,
						is_followers: followResponse.is_followers ? followResponse.is_followers : 0,
						is_followers_requested_received: followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
						is_following: followResponse.is_following ? followResponse.is_following : 0,
						is_following_requested_send: followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
						created: getUtcDate()
					}
				},
				{ upsert: true }
			);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.polls.link_click_logs_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollLinkClickLogs();

	/**
	 * Function used to get poll attached reward redemption details
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.pollAttachedRewardRedemptionsDetails = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and reward information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollRewardId = req.body.reward_id ? newObjectIdDefault(req.body.reward_id) : "";

		let finalResponse = {};

		// Validate required fields
		if (userId === '' || pollRewardId === '') {
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
			// Query polls collection to find polls with the attached reward
			const polls = db.collection(TABLE_POLLS);
			const result = await polls.aggregate([
				{
					$match: {
						"options.assign_reward": pollRewardId
					}
				},
				{
					$project: {
						'_id': 1,
						'question': 1
					}
				}
			]).toArray();

			// Send response based on query result
			if (result && result.length > 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: result,
						message: ""
					}
				};
			} else {
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
			// Handle any error during the process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pollAttachedRewardRedemptionsDetails();

	/**
	 * Function used to edit end poll voting period
	 * Uses async/await for database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.editEndPollVotingPeriod = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and poll information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";

		// Determine the new end voting period value
		const endVotingPeriod = (req.body.end_voting_period === true || req.body.end_voting_period === 'true') ? false : true; // true means vote end

		let finalResponse = {};

		// Validate required fields
		if (userId === '' || pollId === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: "",
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const polls = db.collection(TABLE_POLLS);

		// Prepare condition and update data for poll edit
		const editCondition = {
			"_id": pollId,
			"user_id": newObjectIdDefault(userId),
		};

		const updateData = {
			end_voting_period: endVotingPeriod,
			modified: getUtcDate()
		};

		try {
			// Update poll's end voting period using async/await
			const updateResult = await polls.updateOne(editCondition, { $set: updateData });

			// Check if the update was successful
			if (updateResult && updateResult.modifiedCount > 0) {
				// Set message based on flag
				let textMessage = "";
				if (endVotingPeriod === true) {
					textMessage = res.__("front.polls.polls_end_voting_period_updated_successfully");
				} else {
					textMessage = res.__("front.polls.polls_start_voting_period_updated_successfully");
				}

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: "",
						message: textMessage,
					}
				};
			} else {
				// If no document was modified, send error response
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: "",
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any error during the process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: "",
					message: error.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editEndPollVotingPeriod();

	/**
	 * Function used to update individual option data
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.updateIndividualOptions = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and request information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		const pollSlug = req.body.poll_slug ? req.body.poll_slug : '';
		const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : '';

		let finalResponse = {};

		// Validate required fields
		if (userId === '' || pollSlug === '' || optionId === '') {
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
			// Set user_id in request body for further processing
			req.body.user_id = userId;

			// Call uploadPollMediaImageVideType and wait for its response
			const response = await uploadPollMediaImageVideType(req, res);

			finalResponse = {
				data: {
					status: response.status,
					front_status: response.front_status ? response.front_status : "",
					message: response.message
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any error during the process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End updateIndividualOptions();

	/**
	 * Function used to generate article embed poll
	 * Uses async/await for database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.articleEmbedPollGenerate = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const pollSlug = req.body.poll_slug ? req.body.poll_slug : '';
		let finalResponse = {};

		// Validate required fields
		if (pollSlug === '') {
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
			// Fetch poll details by slug with projection for question and options
			const polls = db.collection(TABLE_POLLS);
			const pollData = await polls.findOne(
				{ slug: pollSlug },
				{ projection: { question: 1, "options._id": 1, "options.title": 1 } }
			);

			if (pollData) {
				const pollId = pollData._id ? pollData._id : "";
				const pollOptions = pollData.options ? pollData.options : [];

				// Add embed code to each option
				if (pollOptions.length > 0) {
					pollOptions.forEach(function (optionsData) {
						optionsData["embed_code"] =
							'<div id="pocialEmbedPollContainer" class="articleEmbedPollOption pocialEmbedPollContainer" data-article_embed_poll_id="' +
							pollId +
							'" data-article_embed_poll_option_id="' +
							optionsData["_id"] +
							'" ></div><script> (function (window, document) {var loader = function () {var script = document.createElement("script"), tag = document.getElementsByTagName("script")[0];script.src = "' +
							ARTICLE_EMBED_POLL_OPTION_SCRIPT_URL +
							'"+Math.random();tag.parentNode.insertBefore(script, tag);};window.addEventListener ? window.addEventListener("load", loader, false) : window.attachEvent("onload", loader);})(window, document);</script>';
					});
				}

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: pollData,
						message: "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error response if no poll found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any error during the process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End articleEmbedPollGenerate();


	/**
	 * Function used to upload individual image or video for a poll option.
	 * Uses async/await for all asynchronous operations and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response 
	 */
	this.uploadIndividuallyImageVideo = async (req, res) => {
		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and poll information
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : '';
		const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : '';

		let finalResponse = {};

		// Validate required fields
		if (!userId || !pollSlug || !optionId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Call the function to upload image or video for the poll option
			// Await the result as this is an asynchronous operation
			const uploadResponse = await uploadManuallyImageAndVide(req, res, userId);

			finalResponse = {
				data: {
					status: uploadResponse.status,
					message: uploadResponse.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any error during the upload process
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End uploadIndividuallyImageVideo();

}
module.exports = new Polls();