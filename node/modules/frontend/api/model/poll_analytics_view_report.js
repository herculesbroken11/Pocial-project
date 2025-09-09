const async = require('async');

function PollAnalyticViewDetail() {

    /**
     * function for poll engagement Opt-in view details 
     * Updated to use async/await and Promise.all for parallel queries.
     */
    this.pollEngagementOptinViewDetail = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const fromDate = req.body.from_date ? req.body.from_date : "";
            const toDate = req.body.to_date ? req.body.to_date : "";

            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const sortBy = req.body.sort_by ? parseInt(req.body.sort_by) : SORT_DESC;

            const skip = (limit * page) - limit;

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

            const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

            // Build common query condition
            let commonCondition = {
                make_poll_user_id: userId,
                user_id: { $nin: ['', null] },
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["created"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Define all queries as promises for parallel execution
            const pollEngagementOptInDetailPromise = pollVoteParticipants.aggregate([
                { $match: commonCondition },
                {
                    $addFields: {
                        sort_created: "$created",
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { poll_slug: "$poll_slug" },
                        poll_question: { $first: "$poll_question" },
                        sort_created: { $first: "$sort_created" },
                        user_id: { $addToSet: { user_id: "$user_id" } },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        poll_question: 1,
                        sort_created: 1,
                        poll_question_sort: { $toLower: "$poll_question" },
                        opt_in: { $size: "$user_id" },
                    }
                },
                { $sort: { poll_question_sort: sortBy } },
                { $skip: skip },
                { $limit: limit },
            ]).toArray();

            const totalRecordsPromise = pollVoteParticipants.aggregate([
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { poll_slug: "$poll_slug" },
                    }
                },
                { $count: 'total_count' },
            ]).toArray();

            const pollsDetailsPromise = pollVoteParticipants.aggregate([
                { $match: commonCondition },
                {
                    $group: {
                        _id: {
                            poll_slug: "$poll_slug",
                            user_id: "$user_id"
                        },
                        myCount: { $sum: 1 }
                    }
                },
            ]).toArray();

            // Run all queries in parallel
            const [
                pollEngagementOptInDetail,
                totalRecordsResult,
                pollsDetailsResult
            ] = await Promise.all([
                pollEngagementOptInDetailPromise,
                totalRecordsPromise,
                pollsDetailsPromise
            ]);

            // Parse results
            const pollOptInDetail = pollEngagementOptInDetail || [];
            const totalRecords = (totalRecordsResult && totalRecordsResult[0] && totalRecordsResult[0].total_count) ? totalRecordsResult[0].total_count : 0;
            const totalOptIn = pollsDetailsResult ? pollsDetailsResult.length : 0;

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: pollOptInDetail,
                    recordsTotal: totalRecords,
                    total_opt_in: totalOptIn,
                    total_polls: totalRecords,
                    message: "",
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalRecords / limit)
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
                    total_polls: 0,
                    total_opt_in: 0,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEngagementOptinViewDetail();

    /**
     * function for poll engagement ribbon click details
     * Updated to use async/await and Promise.all for parallel queries.
     **/
    this.pollEngagementRibbonClickDetail = async (req, res) => {
        let finalResponse = {};
        try {
            // Extract user and request parameters
            const loginUserData = req.user_data || "";
            const userId = loginUserData._id || "";
            const fromDate = req.body.from_date || "";
            const toDate = req.body.to_date || "";

            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const sortBy = req.body.sort_by ? parseInt(req.body.sort_by) : SORT_DESC;

            const skip = (limit * page) - limit;

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

            const pollRibbon = db.collection(TABLE_RIBBON_CLICKS);

            // Build common condition for queries
            let commonCondition = {
                "make_poll_user_id": userId,
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["created"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Prepare aggregation pipelines
            const pollEngagementRibbonClicksDetailPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { "poll_slug": "$poll_slug" },
                        "poll_question": { $first: "$poll_question" },
                        "ribbon_click": { $sum: 1 }
                    }
                },
                {
                    $project: {
                        "_id": 0,
                        "poll_question": 1,
                        "poll_question_sort": { $toLower: "$poll_question" },
                        "ribbon_click": 1
                    }
                },
                { $sort: { 'poll_question_sort': sortBy } },
                { $skip: skip },
                { $limit: limit },
            ];

            const totalRecordsPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { "poll_slug": "$poll_slug" },
                    }
                },
                { $count: 'total_count' },
            ];

            // Run all queries in parallel for better performance
            const [
                pollRibbonClickDetail,
                totalRecordsResult,
                totalPollRibbons
            ] = await Promise.all([
                pollRibbon.aggregate(pollEngagementRibbonClicksDetailPipeline).toArray(),
                pollRibbon.aggregate(totalRecordsPipeline).toArray(),
                pollRibbon.countDocuments(commonCondition)
            ]);

            // Parse results
            const pollRibbonClickDetailArr = pollRibbonClickDetail || [];
            const totalCount = (totalRecordsResult && totalRecordsResult[0] && totalRecordsResult[0]['total_count']) ? totalRecordsResult[0]['total_count'] : 0;
            const totalPollRibbonsCount = totalPollRibbons || 0;

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: pollRibbonClickDetailArr,
                    recordsTotal: totalCount,
                    total_polls: totalCount,
                    total_poll_ribbons: totalPollRibbonsCount,
                    message: "",
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalCount / limit)
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
                    total_polls: 0,
                    total_poll_ribbons: 0,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEngagementRibbonClickDetail();

    /**
     * function for poll engagement link clicks detail 
     * Updated to use async/await and Promise.all for parallel queries.
     */
    this.pollEngagementLinkClickDetail = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const fromDate = req.body.from_date ? req.body.from_date : "";
            const toDate = req.body.to_date ? req.body.to_date : "";

            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const sortBy = req.body.sort_by ? parseInt(req.body.sort_by) : SORT_DESC;

            const skip = (limit * page) - limit;

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

            const linkClicksCollection = db.collection(TABLE_POLL_LINK_CLICKS);

            // Build common query condition
            let commonCondition = {
                make_poll_user_id: userId,
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["created"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Define aggregation pipelines
            const pollEngagementLinkClicksDetailPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { poll_slug: "$poll_slug" },
                        poll_question: { $first: "$poll_question" },
                        link_click: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        poll_question: 1,
                        poll_question_sort: { $toLower: "$poll_question" },
                        link_click: 1
                    }
                },
                { $sort: { poll_question_sort: sortBy } },
                { $skip: skip },
                { $limit: limit },
            ];

            const totalRecordsPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { poll_slug: "$poll_slug" },
                    }
                },
                { $count: 'total' },
            ];

            // Run all queries in parallel for better performance
            const [
                pollLinkClickDetail,
                totalRecordsResult,
                totalLinkClicks
            ] = await Promise.all([
                linkClicksCollection.aggregate(pollEngagementLinkClicksDetailPipeline).toArray(),
                linkClicksCollection.aggregate(totalRecordsPipeline).toArray(),
                linkClicksCollection.countDocuments(commonCondition)
            ]);

            // Parse results
            const pollLinkClickDetailArr = pollLinkClickDetail || [];
            const totalRecord = (totalRecordsResult && totalRecordsResult[0] && totalRecordsResult[0]['total']) ? totalRecordsResult[0]['total'] : 0;
            const totalLinkClicksCount = totalLinkClicks || 0;

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: pollLinkClickDetailArr,
                    recordsTotal: totalRecord,
                    total_polls: totalRecord,
                    total_link_clicks: totalLinkClicksCount,
                    message: "",
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalRecord / limit)
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
                    total_polls: 0,
                    total_link_clicks: 0,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEngagementLinkClickDetail();

    /**
     * function for poll engagement open reward details
     * Updated to use async/await and Promise.all for parallel queries.
     */
    this.pollEngagementOpenRewardDetail = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const fromDate = req.body.from_date ? req.body.from_date : "";
            const toDate = req.body.to_date ? req.body.to_date : "";

            const page = req.body.page ? parseInt(req.body.page) : 1;
            let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const sortBy = req.body.sort_by ? parseInt(req.body.sort_by) : SORT_DESC;

            const skip = (limit * page) - limit;

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

            const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

            // Build common query condition
            let commonCondition = {
                make_poll_user_id: userId,
                is_redemed: REDEMED,
                template_type: POLL_SEND_REWARDS_TYPE,
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["redemed_date"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Prepare aggregation pipelines
            const pollEngagementOpenRewardsDetailPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        redemed_date: { $dateToString: { format: "%Y-%m-%d", date: "$redemed_date", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
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
                                $project: { question: 1 }
                            }
                        ],
                        as: "pollDetails"
                    }
                },
                {
                    $group: {
                        _id: "$poll_id",
                        poll_question: { $first: { $arrayElemAt: ["$pollDetails.question", 0] } },
                        count_open_reward: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        poll_question: 1,
                        count_open_reward: 1
                    }
                },
                { $sort: { poll_question: sortBy } },
                { $skip: skip },
                { $limit: limit },
            ];

            const totalRecordsPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        redemed_date: { $dateToString: { format: "%Y-%m-%d", date: "$redemed_date", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                { $group: { _id: "$poll_id" } },
                { $count: "count" },
            ];

            // Run all queries in parallel using Promise.all for better performance
            const [
                pollOpenRewardDetails,
                totalRecordsResult,
                totalOpenRewards
            ] = await Promise.all([
                earnSentRewards.aggregate(pollEngagementOpenRewardsDetailPipeline).toArray(),
                earnSentRewards.aggregate(totalRecordsPipeline).toArray(),
                earnSentRewards.countDocuments(commonCondition)
            ]);

            // Parse results
            const pollOpenRewardDetailsArr = pollOpenRewardDetails || [];
            const totalRecords = (totalRecordsResult && totalRecordsResult[0] && totalRecordsResult[0].count) ? totalRecordsResult[0].count : 0;
            const totalOpenRewardsCount = totalOpenRewards || 0;

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: pollOpenRewardDetailsArr,
                    recordsTotal: totalRecords,
                    total_polls: totalRecords,
                    total_open_rewards: totalOpenRewardsCount,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalRecords / limit),
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
                    total_polls: 0,
                    total_open_rewards: 0,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEngagementOpenRewardDetail();

    /**
     * function for poll engagement comment view details
     * Updated to use async/await and Promise.all for parallel queries.
     */
    this.pollEngagementCommentViewDetail = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const fromDate = req.body.from_date ? req.body.from_date : "";
            const toDate = req.body.to_date ? req.body.to_date : "";

            const page = req.body.page ? parseInt(req.body.page) : 1;
            let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const sortBy = req.body.sort_by ? parseInt(req.body.sort_by) : SORT_DESC;

            const skip = (limit * page) - limit;

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

            const pollComments = db.collection(TABLE_POLLS_COMMENTS);

            // Build common condition for queries
            let commonCondition = {
                "make_poll_user_id": userId,
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["created"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Prepare aggregation pipelines
            const pollEngagementCommentViewDetailPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { "poll_slug": "$poll_slug" },
                        "poll_question": { $first: "$poll_question" },
                        "total_comment": { $sum: 1 }
                    }
                },
                {
                    $project: {
                        '_id': 0,
                        'poll_question_sort': { $toLower: "$poll_question" },
                        'poll_question': 1,
                        'total_comment': 1
                    }
                },
                { $sort: { 'poll_question_sort': sortBy } },
                { $skip: skip },
                { $limit: limit },
            ];

            const totalRecordsPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { "poll_slug": "$poll_slug" },
                    }
                },
                { $count: 'count' },
            ];

            // Run all queries in parallel for better performance
            const [
                pollCommentDetails,
                totalRecordsResult,
                totalAllPollComment
            ] = await Promise.all([
                pollComments.aggregate(pollEngagementCommentViewDetailPipeline).toArray(),
                pollComments.aggregate(totalRecordsPipeline).toArray(),
                pollComments.countDocuments(commonCondition)
            ]);

            // Parse results
            const pollCommentDetailsArr = pollCommentDetails || [];
            const totalRecords = (totalRecordsResult && totalRecordsResult[0] && totalRecordsResult[0]['count']) ? totalRecordsResult[0]['count'] : 0;
            const totalAllPollCommentCount = totalAllPollComment || 0;
            // Calculate average comments per poll
            const totalPollCommentAverage = totalRecords ? totalAllPollCommentCount / totalRecords : 0;

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: pollCommentDetailsArr,
                    total_comment: totalAllPollCommentCount,
                    total_poll_comment_average: totalPollCommentAverage ? round(totalPollCommentAverage) : 0,
                    recordsTotal: totalRecords,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalRecords / limit),
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
                    total_comment: 0,
                    total_poll_comment_average: 0,
                    recordsTotal: 0,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEngagementCommentViewDetail();

    /**
     * function for poll engagement share icon view details
     * Updated to use async/await and Promise.all for parallel queries.
     */
    this.pollEngagementShareIconViewDetail = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const shareType = req.body.share_type ? req.body.share_type : "";
            const fromDate = req.body.from_date ? req.body.from_date : "";
            const toDate = req.body.to_date ? req.body.to_date : "";

            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const sortBy = req.body.sort_by ? parseInt(req.body.sort_by) : SORT_DESC;

            const skip = (limit * page) - limit;

            // Validate required fields
            if (!userId || !fromDate || !toDate || !shareType) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            const pollShareIcons = db.collection(TABLE_SHARE_ICON_LOGS);

            // Build common query condition
            let commonCondition = {
                make_poll_user_id: userId,
                share_type: shareType,
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["created"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Define aggregation pipelines
            const pollEngagementShareViewDetailPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { poll_slug: "$poll_slug" },
                        poll_question: { $first: "$poll_question" },
                        total_share: { $sum: 1 }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        poll_question: 1,
                        poll_question_sort: { $toLower: "$poll_question" },
                        total_share: 1
                    }
                },
                { $sort: { poll_question_sort: sortBy } },
                { $skip: skip },
                { $limit: limit },
            ];

            const totalShareIconsPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: { poll_slug: "$poll_slug" },
                    }
                },
                { $count: 'total_records' },
            ];

            // Run both queries in parallel for better performance
            const [
                pollEngagementShareViewDetail,
                totalShareIconsResult
            ] = await Promise.all([
                pollShareIcons.aggregate(pollEngagementShareViewDetailPipeline).toArray(),
                pollShareIcons.aggregate(totalShareIconsPipeline).toArray()
            ]);

            // Parse results
            const shareDetails = pollEngagementShareViewDetail || [];
            const totalShareIcons = (totalShareIconsResult && totalShareIconsResult[0]) ? totalShareIconsResult[0] : {};
            const totalRecords = totalShareIcons && totalShareIcons['total_records'] ? totalShareIcons['total_records'] : 0;

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: shareDetails,
                    recordsTotal: totalRecords,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalRecords / limit),
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
    }; // end pollEngagementShareIconViewDetail();

    /**
     * Function for opt-in count with day, month, year wise filter.
     * Updated to use async/await and Promise.all for parallel queries and faster response.
     */
    this.pollEngagementOptInCount = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
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

            const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

            // Build common condition for owner poll wise
            let commonCondition = {
                make_poll_user_id: userId,
                user_id: { $nin: ['', null] }
            };

            // Add date range to condition if provided
            if (fromDate !== "" && toDate !== "") {
                commonCondition["created"] = {
                    $gte: getUtcDate(fromDate + START_DATE),
                    $lte: getUtcDate(toDate + END_DATE),
                };
            }

            // Set group conditions for aggregation
            let groupConditions = {
                year: { $substr: ["$created", 0, 4] },
                month: { $substr: ["$created", 5, 2] },
            };

            // If the date range is within LIMITED_DAYS_DASHBOARD, add day-wise grouping
            if (fromDate !== "" && toDate !== "") {
                let diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
                if (diffDate <= LIMITED_DAYS_DASHBOARD) {
                    groupConditions = {
                        year: { $substr: ["$created", 0, 4] },
                        month: { $substr: ["$created", 5, 2] },
                        date: { $substr: ["$created", 8, 2] },
                    };
                }
            }

            // Prepare aggregation pipeline
            const pollEngagementOptInCountPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                    }
                },
                {
                    $group: {
                        _id: {
                            ...groupConditions,
                            poll_slug: "$poll_slug",
                            user_id: "$user_id"
                        },
                        total_count: { $sum: 1 },
                        poll_question: { $first: "$poll_question" },
                        user_id_opt_in: { $addToSet: { user_id: "$user_id" } },
                    }
                }
            ];

            // Run aggregation query
            const [optGraphResult] = await Promise.all([
                pollVoteParticipants.aggregate(pollEngagementOptInCountPipeline).toArray()
            ]);

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: { opt_graph: optGraphResult },
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
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEngagementOptInCount();
}
module.exports = new PollAnalyticViewDetail();