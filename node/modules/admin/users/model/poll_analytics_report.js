const async = require("async");
const { ObjectId } = require("mongodb");

function pollAnalyticsReport() {

    /**
     * Function to get view poll analytics reports
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.pollEngagementViewReport = async (req, res) => {
        // Extract and validate parameters
        let userType = (req.params.user_type) ? req.params.user_type : "";
        let userId = (req.params.user_id) ? req.params.user_id : "";
        let fromDate = (req.params.from_date) ? req.params.from_date : "";
        let toDate = (req.params.to_date) ? req.params.to_date : "";
        let unregisteredParticipants = (req.params.unregister == "true") ? true : false;
        let viewTypeFilter = (req.params.view_type) ? req.params.view_type : "";

        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        // Prepare options for all queries
        let options = {
            "user_id": newObjectIdDefault(userId),
            "from_date": fromDate,
            "to_date": toDate,
            "unregistered_participants": unregisteredParticipants,
            "view_type_filter": viewTypeFilter,
        };

        try {
            // Run all report queries in parallel using Promise.all
            // Each function returns a promise
            const [
                pollViewReport,
                pollViewGraph,
                pollShareIcon,
                pollVoteReport,
                pollVoteUserReport,
                pollVoteGraph,
                pollViewOptInGraph,
                avgSessionDurationGraph
            ] = await Promise.all([
                // Poll view reports
                pollViewReports(req, res, options),
                // Poll view graph reports
                pollViewGraphData(req, res, options),
                // Poll share icon reports
                pollShareIconResult(req, res, options),
                // Poll vote reports
                pollVoteReports(req, res, options),
                // Poll user vote reports (gender breakdown)
                pollEngagementGenderTotalVoteCount(req, res, options),
                // Poll vote graph reports
                pollVoteGraphReports(req, res, options),
                // Poll view opt-in graph
                pollViewOptInGraphData(req, res, options),
                // Average session duration view
                pollViewAverageSessionDurationGraphData(req, res, options)
            ]);

            // Set breadcrumbs and render the analytics report page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/list"]);
            res.render("poll_analytics_report/list", {
                'user_type': userType,
                'user_id': userId,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId,
                'from_date': fromDate,
                'to_date': toDate,
                'poll_view_report': pollViewReport?.poll_logs,
                'poll_view_graph_report': pollViewGraph?.result,
                'share_type': pollShareIcon?.poll_logs,
                'poll_vote_report': pollVoteReport?.poll_logs,
                'poll_vote_user': pollVoteUserReport?.vote_polls,
                'vote_graph_report': pollVoteGraph?.poll_logs,
                'poll_view_opt_in_graph': pollViewOptInGraph?.result,
                'avg_session_duration_graph': avgSessionDurationGraph?.result,
                'unregisteredParticipants': unregisteredParticipants,
                'view_type': viewTypeFilter,
            });
        } catch (err) {
            // Handle errors gracefully
            console.error("Error in pollEngagementViewReport:", err);
            req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
        }
    }; // end pollEngagementViewReport()

    /**
     * Function for poll comments list details
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.listPollCommentDetails = async (req, res) => {
        // Extract and validate parameters
        let userType = (req.params.user_type) ? req.params.user_type : "";
        let userId = (req.params.user_id) ? req.params.user_id : "";
        let fromDate = (req.params.from_date) ? req.params.from_date : "";
        let toDate = (req.params.to_date) ? req.params.to_date : "";

        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        if (isPost(req)) {
            try {
                // Pagination parameters
                let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
                let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;

                const pollComments = db.collection(TABLE_POLLS_COMMENTS);

                // Get datatable config (sorting, filtering, etc.)
                const dataTableConfig = await configDatatable(req, res, null);

                // Set common query conditions
                let commonCondition = {
                    'make_poll_user_id': newObjectIdDefault(userId),
                    'user_id': { $nin: ['', null] },
                    'created': {
                        $gte: getUtcDate(fromDate + START_DATE),
                        $lte: getUtcDate(toDate + END_DATE),
                    }
                };

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonCondition);

                // Prepare aggregation pipelines
                const pollListDetailsPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $group: {
                            _id: "$poll_slug",
                            poll_question: { $first: "$poll_question" },
                            comment: { $first: "$comment" },
                            total_comment: { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            poll_question: 1,
                            comment: 1,
                            total_comment: 1
                        }
                    },
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit }
                ];

                const totalPollsViewPipeline = [
                    { $match: commonCondition },
                    {
                        $group: {
                            _id: "$poll_slug",
                            question: { $first: "$poll_question" },
                            comment: { $first: "$comment" },
                            total_comment: { $sum: 1 }
                        }
                    }
                ];

                const filterViewPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $group: {
                            _id: "$poll_slug",
                            question: { $first: "$poll_question" },
                            comment: { $first: "$comment" },
                            total_comment: { $sum: 1 }
                        }
                    }
                ];

                // Run all queries in parallel using Promise.all
                const [
                    pollListDetails,
                    totalPollsView,
                    filterView
                ] = await Promise.all([
                    // Get paginated poll comment details
                    pollComments.aggregate(pollListDetailsPipeline).toArray(),
                    // Get total number of records in poll analytics view
                    pollComments.aggregate(totalPollsViewPipeline).toArray(),
                    // Get filtered records counting in poll analytics
                    pollComments.aggregate(filterViewPipeline).toArray()
                ]);

                // Send response
                res.send({
                    status: STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: pollListDetails || [],
                    recordsFiltered: filterView ? filterView.length : 0,
                    recordsTotal: totalPollsView ? totalPollsView.length : 0
                });
            } catch (err) {
                // Handle errors gracefully
                console.error("Error in listPollCommentDetails:", err);
                res.send({
                    status: STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again"),
                });
            }
        } else {
            // Set breadcrumbs and render the listing page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/comment_list"]);
            res.render("poll_analytics_report/comment_list", {
                'user_type': userType,
                'user_id': userId,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId + '/' + fromDate + '/' + toDate,
                'from_date': fromDate,
                'to_date': toDate,
            });
        }
    }; // end listPollCommentDetails()

    /**
     * Function for poll share icons list details
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.pollShareIconsDetails = async (req, res) => {
        // Extract parameters from request
        let userType = req.params.user_type ? req.params.user_type : "";
        let userId = req.params.user_id ? req.params.user_id : "";
        let shareType = req.params.share_type ? req.params.share_type : "";
        let fromDate = req.params.from_date ? req.params.from_date : "";
        let toDate = req.params.to_date ? req.params.to_date : "";

        // Validate required parameters
        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        if (isPost(req)) {
            // Set pagination variables
            let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
            let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

            const pollshareIconLogs = db.collection(TABLE_SHARE_ICON_LOGS);

            try {
                // Get datatable config (async)
                const dataTableConfig = await configDatatable(req, res, null);

                // Set common query conditions
                let commonConditions = {
                    'make_poll_user_id': newObjectIdDefault(userId),
                    'share_type': shareType,
                    'created': {
                        $gte: getUtcDate(fromDate + START_DATE),
                        $lte: getUtcDate(toDate + END_DATE),
                    }
                };

                // Merge datatable conditions with common conditions
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

                // Build aggregation pipelines
                const pollShareIconDetailsPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $group: {
                            _id: "$poll_slug",
                            poll_question: { $first: "$poll_question" },
                            total_shares: { $sum: 1 }
                        }
                    },
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit }
                ];

                const totalShareViewPipeline = [
                    { $match: commonConditions },
                    {
                        $group: {
                            _id: "$poll_slug",
                            total_shares: { $sum: 1 }
                        }
                    }
                ];

                const filterViewPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $group: {
                            _id: "$poll_slug",
                            total_shares: { $sum: 1 }
                        }
                    }
                ];

                // Run all queries in parallel using Promise.all
                const [
                    pollShareIconDetails,
                    totalShareView,
                    filterView
                ] = await Promise.all([
                    // Get paginated poll share icon details
                    pollshareIconLogs.aggregate(pollShareIconDetailsPipeline).toArray(),
                    // Get total number of records in poll analytics view
                    pollshareIconLogs.aggregate(totalShareViewPipeline).toArray(),
                    // Get filtered records counting in poll analytics
                    pollshareIconLogs.aggregate(filterViewPipeline).toArray()
                ]);

                // Send response with results
                res.send({
                    status: STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: pollShareIconDetails || [],
                    recordsFiltered: filterView ? filterView.length : 0,
                    recordsTotal: totalShareView ? totalShareView.length : 0
                });
            } catch (err) {
                // Handle errors gracefully
                console.error("Error in pollShareIconsDetails:", err);
                res.send({
                    status: STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again"),
                });
            }
        } else {
            // Set breadcrumbs and render the listing page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/share_icon_list"]);
            res.render("poll_analytics_report/share_icon_list", {
                'user_type': userType,
                'user_id': userId,
                'share_type': shareType,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId + '/' + fromDate + '/' + toDate,
                'from_date': fromDate,
                'to_date': toDate
            });
        }
    }; // end pollShareIconsDetails()

    /**
     * Function for poll view opt in list details
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.pollEngagementOptinViewDetail = async (req, res) => {
        // Extract and validate parameters
        let userType = (req.params.user_type) ? req.params.user_type : "";
        let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
        let fromDate = (req.params.from_date) ? req.params.from_date : "";
        let toDate = (req.params.to_date) ? req.params.to_date : "";

        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        if (isPost(req)) {
            let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
            let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;

            const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

            try {
                // Get datatable config (sorting, filtering, etc.)
                const dataTableConfig = await configDatatable(req, res, null);

                // Prepare common query conditions
                let commonCondition = {
                    "make_poll_user_id": userId,
                    'user_id': { $nin: ['', null] },
                    'created': {
                        $gte: getUtcDate(fromDate + START_DATE),
                        $lte: getUtcDate(toDate + END_DATE),
                    }
                };

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonCondition);

                // Prepare aggregation pipelines
                const pollEngagementOptInDetailPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $addFields: {
                            created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                        }
                    },
                    {
                        $group: {
                            _id: {
                                "poll_slug": "$poll_slug",
                            },
                            "poll_question": { $first: "$poll_question" },
                            "user_id": { $addToSet: { user_id: "$user_id" } },
                        }
                    },
                    {
                        $project: {
                            "_id": 0,
                            "poll_question": 1,
                            'total_vote': { $size: "$user_id" },
                        }
                    },
                    { $sort: dataTableConfig.sort_conditions },
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
                            _id: {
                                "poll_slug": "$poll_slug",
                            },
                        }
                    },
                    { $count: 'total_count' }
                ];

                const filterViewPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $addFields: {
                            created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                        }
                    },
                    {
                        $group: {
                            _id: { "poll_slug": "$poll_slug" },
                        }
                    }
                ];

                // Run all queries in parallel using Promise.all
                const [
                    pollEngagementOptInDetail,
                    totalRecords,
                    filterView
                ] = await Promise.all([
                    pollVoteParticipants.aggregate(pollEngagementOptInDetailPipeline).toArray(),
                    pollVoteParticipants.aggregate(totalRecordsPipeline).toArray(),
                    pollVoteParticipants.aggregate(filterViewPipeline).toArray()
                ]);

                // Send response with results
                res.send({
                    status: STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: pollEngagementOptInDetail || [],
                    recordsFiltered: filterView ? filterView.length : 0,
                    recordsTotal: (totalRecords && totalRecords[0] && totalRecords[0]['total_count']) ? totalRecords[0]['total_count'] : 0,
                });
            } catch (err) {
                // Handle errors gracefully
                console.error("Error in pollEngagementOptinViewDetail:", err);
                res.send({
                    status: STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again"),
                });
            }
        } else {
            // Render listing page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/view_opt_in"]);
            res.render("poll_analytics_report/view_opt_in", {
                'user_type': userType,
                'user_id': userId,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId + '/' + fromDate + '/' + toDate,
                'from_date': fromDate,
                'to_date': toDate
            });
        }
    }; // end pollEngagementOptinViewDetail()

    /**
     * Function for poll view ribbon clicks list details
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.pollEngagementRibbonClickDetail = async (req, res) => {
        // Extract and validate parameters
        let userType = req.params.user_type ? req.params.user_type : "";
        let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
        let fromDate = req.params.from_date ? req.params.from_date : "";
        let toDate = req.params.to_date ? req.params.to_date : "";

        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        if (isPost(req)) {
            // Set pagination variables
            let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
            let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

            const pollRibbon = db.collection(TABLE_RIBBON_CLICKS);

            try {
                // Get datatable config (async)
                const dataTableConfig = await configDatatable(req, res, null);

                // Set common query conditions
                let commonCondition = {
                    "make_poll_user_id": userId,
                    'created': {
                        $gte: getUtcDate(fromDate + START_DATE),
                        $lte: getUtcDate(toDate + END_DATE),
                    }
                };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonCondition);

                // --- Build aggregation pipelines for all queries ---

                // Pipeline for main ribbon click details (paginated)
                const ribbonClicksDetailPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $addFields: {
                            created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                        }
                    },
                    {
                        $group: {
                            _id: { "poll_slug": "$poll_slug" },
                            "poll_question": { $first: "$poll_question" },
                            "total_click": { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            "_id": 0,
                            "poll_question": 1,
                            "total_click": 1
                        }
                    },
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit },
                ];

                // Pipeline for total records (unfiltered)
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

                // Pipeline for filtered records count
                const filterViewPipeline = [
                    { $match: dataTableConfig.conditions },
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
                ];

                // --- Run all queries in parallel using Promise.all ---
                const [
                    pollEngagementRibbonClicksDetail,
                    totalRecords,
                    filterView
                ] = await Promise.all([
                    // Get paginated ribbon click details
                    pollRibbon.aggregate(ribbonClicksDetailPipeline).toArray(),
                    // Get total number of records
                    pollRibbon.aggregate(totalRecordsPipeline).toArray(),
                    // Get filtered records (for count)
                    pollRibbon.aggregate(filterViewPipeline).toArray()
                ]);

                // --- Send response with results ---
                res.send({
                    status: STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: pollEngagementRibbonClicksDetail || [],
                    recordsFiltered: filterView ? filterView.length : 0,
                    recordsTotal: (totalRecords && totalRecords[0] && totalRecords[0]['total_count']) ? totalRecords[0]['total_count'] : 0,
                });
            } catch (err) {
                // Handle errors gracefully
                console.error("Error in pollEngagementRibbonClickDetail:", err);
                res.send({
                    status: STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again"),
                });
            }
        } else {
            // Render listing page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/view_ribbon_click"]);
            res.render("poll_analytics_report/view_ribbon_click", {
                'user_type': userType,
                'user_id': userId,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId + '/' + fromDate + '/' + toDate,
                'from_date': fromDate,
                'to_date': toDate
            });
        }
    }; // end pollEngagementRibbonClickDetail()

    /**
     * Function for poll view link clicks list details
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.pollEngagementLinkClickDetail = async (req, res) => {
        // Extract and validate parameters
        let userType = (req.params.user_type) ? req.params.user_type : "";
        let userId = (req.params.user_id) ? newObjectIdDefault(req.params.user_id) : "";
        let fromDate = (req.params.from_date) ? req.params.from_date : "";
        let toDate = (req.params.to_date) ? req.params.to_date : "";

        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        if (isPost(req)) {
            // Pagination parameters
            let limit = (req.body.length) ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
            let skip = (req.body.start) ? parseInt(req.body.start) : DEFAULT_SKIP;

            const linkClicksCollection = db.collection(TABLE_POLL_LINK_CLICKS);

            try {
                // Get datatable config (sorting, filtering, etc.)
                const dataTableConfig = await configDatatable(req, res, null);

                // Prepare common query conditions
                let commonCondition = {
                    "make_poll_user_id": userId,
                    'created': {
                        $gte: getUtcDate(fromDate + START_DATE),
                        $lte: getUtcDate(toDate + END_DATE),
                    }
                };

                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonCondition);

                // --- Build aggregation pipelines for all queries ---

                // Pipeline for paginated link click details
                const pollEngagementLinkClicksDetailPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $addFields: {
                            created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                        }
                    },
                    {
                        $group: {
                            _id: { "poll_slug": "$poll_slug" },
                            "poll_question": { $first: "$poll_question" },
                            "link_click": { $sum: 1 }
                        }
                    },
                    {
                        $project: {
                            "_id": 0,
                            "poll_question": 1,
                            "link_click": 1
                        }
                    },
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit },
                ];

                // Pipeline for total records count
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

                // Pipeline for filtered records count
                const filterViewPipeline = [
                    { $match: dataTableConfig.conditions },
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
                ];

                // --- Run all queries in parallel using Promise.all ---
                const [
                    pollEngagementLinkClicksDetail,
                    totalRecords,
                    filterView
                ] = await Promise.all([
                    // Get paginated link click details
                    linkClicksCollection.aggregate(pollEngagementLinkClicksDetailPipeline).toArray(),
                    // Get total number of records
                    linkClicksCollection.aggregate(totalRecordsPipeline).toArray(),
                    // Get filtered records (for count)
                    linkClicksCollection.aggregate(filterViewPipeline).toArray()
                ]);

                // --- Send response with results ---
                res.send({
                    status: STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: pollEngagementLinkClicksDetail || [],
                    recordsFiltered: filterView ? filterView.length : 0,
                    recordsTotal: (totalRecords && totalRecords[0] && totalRecords[0]['total_count']) ? totalRecords[0]['total_count'] : 0,
                });
            } catch (err) {
                // Handle errors gracefully
                console.error("Error in pollEngagementLinkClickDetail:", err);
                res.send({
                    status: STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again"),
                });
            }
        } else {
            // Render listing page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/view_link_click"]);
            res.render("poll_analytics_report/view_link_click", {
                'user_type': userType,
                'user_id': userId,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId + '/' + fromDate + '/' + toDate,
                'from_date': fromDate,
                'to_date': toDate
            });
        }
    }; // end pollEngagementLinkClickDetail()

    /**
     * Function to get opened reward list details (poll engagement open rewards)
     *
     * @param req As Request Data
     * @param res As Response Data
     *
     * @return render/json
     */
    this.pollEngagementOpenRewardDetail = async (req, res) => {
        // Extract and validate parameters
        let userType = req.params.user_type ? req.params.user_type : "";
        let userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
        let fromDate = req.params.from_date ? req.params.from_date : "";
        let toDate = req.params.to_date ? req.params.to_date : "";

        if (!userType || !userId || !fromDate || !toDate) {
            req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
            res.redirect(WEBSITE_ADMIN_URL + "dashboard");
            return;
        }

        if (isPost(req)) {
            // Set pagination variables
            let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
            let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

            const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

            try {
                // Get datatable config (async)
                const dataTableConfig = await configDatatable(req, res, null);

                // Set common query conditions
                let commonCondition = {
                    "make_poll_user_id": userId,
                    'is_redemed': REDEMED,
                    'template_type': POLL_SEND_REWARDS_TYPE,
                    'redemed_date': {
                        $gte: getUtcDate(fromDate + START_DATE),
                        $lte: getUtcDate(toDate + END_DATE),
                    }
                };
                dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonCondition);

                // --- Build aggregation pipelines for all queries ---

                // Pipeline for main open rewards detail (paginated)
                const pollEngagementOpenRewardsDetailPipeline = [
                    { $match: dataTableConfig.conditions },
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
                                    $project: { "question": 1 }
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
                    { $sort: dataTableConfig.sort_conditions },
                    { $skip: skip },
                    { $limit: limit },
                ];

                // Pipeline for total unique poll records
                const totalRecordsPipeline = [
                    { $match: commonCondition },
                    {
                        $addFields: {
                            redemed_date: { $dateToString: { format: "%Y-%m-%d", date: "$redemed_date", timezone: DEFAULT_TIME_ZONE } },
                        }
                    },
                    { $group: { _id: "$poll_id" } },
                    { $count: "total_count" },
                ];

                // Pipeline for filtered records (unique poll count)
                const filterViewPipeline = [
                    { $match: dataTableConfig.conditions },
                    {
                        $addFields: {
                            created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } },
                        }
                    },
                    { $group: { _id: "$poll_id" } },
                ];

                // --- Run all queries in parallel using Promise.all ---
                const [
                    pollEngagementOpenRewardsDetail,
                    totalRecords,
                    filterView
                ] = await Promise.all([
                    earnSentRewards.aggregate(pollEngagementOpenRewardsDetailPipeline).toArray(),
                    earnSentRewards.aggregate(totalRecordsPipeline).toArray(),
                    earnSentRewards.aggregate(filterViewPipeline).toArray()
                ]);

                // --- Send response with results ---
                res.send({
                    status: STATUS_SUCCESS,
                    draw: dataTableConfig.result_draw,
                    data: pollEngagementOpenRewardsDetail || [],
                    recordsFiltered: filterView ? filterView.length : 0,
                    recordsTotal: (totalRecords && totalRecords[0] && totalRecords[0]['total_count']) ? totalRecords[0]['total_count'] : 0,
                });
            } catch (err) {
                // Handle errors gracefully
                console.error("Error in pollEngagementOpenRewardDetail:", err);
                res.send({
                    status: STATUS_ERROR,
                    message: res.__("admin.system.something_going_wrong_please_try_again"),
                });
            }
        } else {
            // Render listing page
            req.breadcrumbs(BREADCRUMBS["admin/poll_analytics_report/view_open_reward"]);
            res.render("poll_analytics_report/view_open_reward", {
                'user_type': userType,
                'user_id': userId,
                'dynamic_variable': userBreadcrumbs(userType),
                'dynamic_url': userId + '/' + fromDate + '/' + toDate,
                'from_date': fromDate,
                'to_date': toDate
            });
        }
    }; // end pollEngagementOpenRewardDetail()
}

module.exports = new pollAnalyticsReport();

