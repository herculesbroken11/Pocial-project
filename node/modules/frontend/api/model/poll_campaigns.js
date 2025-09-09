const async = require('async');

function pollCampaigns() {

    const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
    const pollCampaignSendNewsLetter = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER);
    const campaignEmailLogs = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER_LOGS);
    const users = db.collection(TABLE_USERS);

    /**
     * Function to get selected segment details using async/await for better performance.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getSelectedSegmentDetails = async (req, res) => {
        let finalResponse = {};

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

        // Prepare options for segment query
        const optionData = {
            user_id: userId,
            segment_slug: segmentSlug,
            selected_users_ids: [],
        };

        try {
            // Fetch segment details asynchronously
            const responseData = await segmentWiseTotalUserCount(req, res, optionData);

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    segment_name: responseData.segment_result.segment_name,
                    segment_slug: responseData.segment_result.slug,
                    segment_description: responseData.segment_result.segment_description,
                    total_users: responseData.total_user,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getSelectedSegmentDetails()

    /**
     * Function to send campaign newsletters.
     * Uses async/await and Promise.all for parallel queries and clean formatting.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.sendCampaignNewsletter = async (req, res) => {
        let finalResponse = {};

        // Extract user and request parameters
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const segmentSlug = req.body.segment_slug ? req.body.segment_slug : "";
        const newsLetterId = req.body.newsletter_id ? newObjectIdDefault(req.body.newsletter_id) : "";
        const selectedUsersIds = req.body.selected_users_ids ? req.body.selected_users_ids : [];
        const aiGenerateEmailMarketingId = req.body.ai_generate_email_marketing_id ? newObjectIdDefault(req.body.ai_generate_email_marketing_id) : "";

        // Validate required fields
        if (!userId || !segmentSlug || !newsLetterId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare options for segment query
        const optionData = {
            user_id: newObjectIdDefault(userId),
            segment_slug: segmentSlug,
            selected_users_ids: selectedUsersIds,
        };

        try {
            // Run newsletter and segment queries in parallel for better performance
            const [newsLetterData, segmentUsersResponse] = await Promise.all([
                emailTemplate.findOne(
                    {
                        _id: newObjectIdDefault(newsLetterId),
                        template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE
                    },
                    {
                        projection: {
                            _id: 1,
                            template_title: 1,
                            action: 1,
                            user_id: 1,
                            description: 1,
                            subject: 1,
                            body: 1,
                            from: 1,
                            from_email: 1,
                            host: 1,
                            port: 1,
                            email_password: 1,
                            attach_reward: 1
                        }
                    }
                ),
                segmentWiseTotalUserCount(req, res, optionData)
            ]);

            // Check if newsletter exists
            if (!newsLetterData) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.newsletter.newsletter_not_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Extract segment details
            const segmentUsersData = segmentUsersResponse && segmentUsersResponse.all_users ? segmentUsersResponse.all_users : [];
            const totalSegmentUser = segmentUsersResponse && segmentUsersResponse.total_user ? segmentUsersResponse.total_user : 0;
            const segmentData = segmentUsersResponse && segmentUsersResponse.segment_result ? segmentUsersResponse.segment_result : {};
            const segmentId = segmentData && segmentData._id ? segmentData._id : "";
            const segmentSlugValue = segmentData && segmentData.slug ? segmentData.slug : "";
            const segmentName = segmentData && segmentData.segment_name ? segmentData.segment_name : "";
            const segmentDescription = segmentData && segmentData.segment_description ? segmentData.segment_description : "";

            // If no users in segment, return error
            if (totalSegmentUser === 0) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("campaign.newsletter_should_not_be_send_to_zero_recipients"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare user details for campaign
            const userDetails = {
                public_business_informaton: loginUserData.public_business_informaton || "",
                first_name: loginUserData.fname || "",
                last_name: loginUserData.lname || "",
                full_name: loginUserData.full_name || "",
                slug: loginUserData.slug || "",
                email: loginUserData.email || "",
                account_type: loginUserData.account_type || "",
                gender: loginUserData.gender || "",
                dob: loginUserData.dob || "",
                age: loginUserData.age || "",
                zip: loginUserData.zip || "",
                mobile: loginUserData.mobile || "",
            };

            // Generate a random slug for the campaign
            const optionRandomData = { srting_length: 5 };
            const randomString = await getRandomString(req, res, optionRandomData);
            let randomSlug = randomString && randomString.result ? randomString.result + "-" + currentTimeStamp() : "";
            randomSlug = randomSlug ? randomSlug.toLowerCase() : "";

            // Insert campaign newsletter record
            const campaignInsertResult = await pollCampaignSendNewsLetter.insertOne({
                slug: randomSlug,
                user_id: newObjectIdDefault(userId),
                segment_details: {
                    segment_id: newObjectIdDefault(segmentId),
                    segment_slug: segmentSlugValue,
                    segment_name: segmentName,
                    segment_description: segmentDescription,
                    total_user: totalSegmentUser
                },
                newsletter_template_id: newObjectIdDefault(newsLetterId),
                attach_reward: newsLetterData.attach_reward || "",
                newsletter_details: newsLetterData,
                status: CAMPAIGN_PENDING_PROCESS,
                result_users: userDetails,
                segment_count: totalSegmentUser,
                ai_generate_email_marketing_id: aiGenerateEmailMarketingId,
                created: getUtcDate()
            });

            // Get inserted campaign id
            const insertedId = campaignInsertResult && campaignInsertResult.insertedId ? campaignInsertResult.insertedId : "";

            // Prepare logs for each user in the segment
            const newsLetterAction = newsLetterData.action || "";
            const attachReward = newsLetterData.attach_reward || "";

            // Insert campaign email logs for each user sequentially (to preserve order, but could be parallelized if needed)
            for (const userRecordList of segmentUsersData) {
                const segmentUserId = userRecordList && userRecordList.user_id ? userRecordList.user_id : "";
                let segmentCampaignUnsubscribed = userRecordList && userRecordList.segment_campaign_unsubscribed ? userRecordList.segment_campaign_unsubscribed : false;
                segmentCampaignUnsubscribed = segmentCampaignUnsubscribed === true;
                const userEmail = userRecordList && userRecordList.email ? userRecordList.email : "";
                const userFullName = userRecordList && userRecordList.full_name ? userRecordList.full_name : "";

                try {
                    await campaignEmailLogs.insertOne({
                        campaign_send_newsletter_id: newObjectIdDefault(insertedId),
                        campaign_send_newsletter_slug: randomSlug,
                        newsletter_template_id: newObjectIdDefault(newsLetterId),
                        newsletter_template_action: newsLetterAction,
                        attach_reward: attachReward,
                        all_process_flag: false,
                        is_send: false,
                        user_id: newObjectIdDefault(segmentUserId),
                        user_unsubscribed_flag: segmentCampaignUnsubscribed,
                        owner_user_id: newObjectIdDefault(userId),
                        user_email: userEmail,
                        user_name: userFullName,
                        is_opened: DEFAULT_ZERO,
                        unsubscribed: DEFAULT_ZERO,
                        ai_generate_email_marketing_id: aiGenerateEmailMarketingId,
                        created: getUtcDate()
                    });
                } catch (err) {
                    // If any log insert fails, return error immediately
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }

            // All inserts successful, return success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: {},
                    message: res.__("front.campaign.newsletter_is_sent_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Catch any error and return error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end sendCampaignNewsletter()

    /**
     * Function to get active campaign email template list
     * Uses async/await for better performance and clean formatting.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     **/
    this.getActiveCampaignTemplateDetails = async (req, res) => {
        let finalResponse = {};
        // Extract user id from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

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

        try {
            // Fetch active campaign newsletter templates asynchronously
            const responseData = await getActiveCampaignNewsletterTemplate(userId);

            finalResponse = {
                data: {
                    status: responseData.status ? responseData.status : "",
                    is_draft: responseData.is_draft ? responseData.is_draft : "",
                    result: responseData.result ? responseData.result : {}
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle any errors during the query
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getActiveCampaignTemplateDetails()

    /**
     * Function to get campaign setting SMTP details.
     * Uses async/await for clean formatting and better error handling.
     * If user has saved SMTP details, returns them; otherwise, fetches default SMTP from active welcome template.
     *
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     **/
    this.campaignSettingSMTPDetails = async (req, res) => {
        let finalResponse = {};

        // Extract user data and SMTP details from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const campaignSMTPDetails = loginUserData.campaign_smtp_details ? loginUserData.campaign_smtp_details : "";

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

        try {
            // If user already has campaign SMTP details, return them
            if (campaignSMTPDetails) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: campaignSMTPDetails,
                        old_smtp_flag: false, // old smtp flag true after verify smtp
                        message: ""
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Otherwise, fetch default SMTP details from active welcome email template
                const resultTemplate = await db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE).findOne(
                    {
                        template_type: EMAIL_TEMPLATE_WELCOME_TYPE,
                        is_active: ACTIVE,
                        user_id: userId,
                        skip_smtp: { $ne: true },
                        ai_bot: { $ne: true },
                    },
                    {
                        projection: {
                            from_email: 1,
                            from: 1,
                            host: 1,
                            port: 1,
                            email_password: 1,
                        }
                    }
                );

                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        old_smtp_flag: true, // Old smtp flag true after verify smtp
                        result: resultTemplate ? resultTemplate : {},
                        message: ""
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle any errors during the query
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    old_smtp_flag: "",
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end campaignSettingSMTPDetails()

    /**
     * Function to save campaign SMTP settings.
     * Uses async/await for all asynchronous operations.
     * @return json
     **/
    this.saveCampaignSettingSMTP = async (req, res) => {
        let finalResponse = {};

        // Extract user and SMTP details from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const fromEmail = req.body.from_email ? req.body.from_email : "";
        const emailHost = req.body.host ? req.body.host : "";
        const emailPort = req.body.port ? req.body.port : "";
        const fromName = req.body.from ? req.body.from : "";
        const emailPassword = req.body.email_password ? req.body.email_password : "";

        // Validate required fields
        if (!userId || !fromEmail || !emailHost || !emailPort || !emailPassword || !fromName) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare SMTP options for connection check
        const smtpOptions = {
            from_email: fromEmail,
            host: emailHost,
            password: emailPassword,
            port: emailPort,
        };

        try {
            // Check SMTP connection (await the result)
            const smtpResponse = await smtpConnectionCheck(req, res, smtpOptions);

            if (smtpResponse.status === STATUS_ERROR) {
                // If SMTP check fails, return error response
                finalResponse = {
                    data: {
                        status: smtpResponse.status,
                        result: smtpResponse.result,
                        error: smtpResponse.error,
                        message: smtpResponse.message,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // If SMTP check passes, update user SMTP details in DB
            const updateResult = await users.updateOne(
                { _id: newObjectIdDefault(userId) },
                {
                    $set: {
                        campaign_smtp_details: {
                            from_email: fromEmail,
                            from: fromName,
                            host: emailHost,
                            email_password: emailPassword,
                            port: emailPort,
                        }
                    }
                }
            );

            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: updateResult,
                    message: res.__("front.campaign.smtp_details_has_been_save_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle any errors during SMTP check or DB update
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveCampaignSettingSMTP()

    /**
     * Function is used to change status of campaign newsletter
     * Uses async/await for DB operations.
     * @return json
     */
    this.campaignNewsletterStatusChange = async (req, res) => {
        let finalResponse = {};

        // Extract user and newsletter IDs
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const newsletterId = req.body.newsletter_id ? req.body.newsletter_id : "";
        const campaignStatus = (req.body.status === true || req.body.status === "true") ? ACTIVE : DEACTIVE;

        // Validate required fields
        if (!userId || !newsletterId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Update the status of the campaign newsletter template
            const updateResult = await emailTemplate.updateOne(
                {
                    _id: newObjectIdDefault(newsletterId),
                    user_id: newObjectIdDefault(userId),
                    template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE
                },
                {
                    $set: {
                        is_active: campaignStatus,
                        modified: getUtcDate(),
                    }
                }
            );

            // Check if the update was successful
            if (updateResult && updateResult.modifiedCount > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: (campaignStatus === ACTIVE)
                            ? res.__("front.campaign.campaign_newsletter_has_been_activeted_successfully")
                            : res.__("front.campaign.campaign_newsletter_has_been_deactivated_successfully"),
                    }
                };
            } else {
                // No document was modified (possibly not found)
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle any errors during the update
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end campaignNewsletterStatusChange()

    /**
     * Function to get campaign send newsletter list.
     * Uses async/await and runs DB queries in parallel using Promise.all.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getCampaignSendNewsletterList = async (req, res) => {
        let finalResponse = {};

        // Extract user data
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        // Pagination parameters
        const page = req.body.page ? parseInt(req.body.page) : 1;
        let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT + 2;
        const skip = (limit * page) - limit;

        // Check for valid user
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

        // Build query condition
        const commonCondition = {
            user_id: newObjectIdDefault(userId)
        };

        try {
            // Run both queries in parallel
            const [
                campaignListResultData,
                totalrecords
            ] = await Promise.all([
                // Aggregate campaign send newsletter list with lookup and stats
                pollCampaignSendNewsLetter.aggregate([
                    { $match: commonCondition },
                    {
                        $lookup: {
                            from: TABLE_CAMPAIGN_SEND_NEWSLETTER_LOGS,
                            let: { campaignSendNewsletterId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$campaign_send_newsletter_id", "$$campaignSendNewsletterId"] },
                                            ]
                                        },
                                    }
                                },
                                {
                                    $group: {
                                        _id: "$campaign_send_newsletter_id",
                                        is_send: { $sum: { $cond: [{ $eq: ["$is_send", true] }, 1, 0] } },
                                        is_opened: { $sum: { $cond: [{ $eq: ["$is_opened", DEFAULT_ONE] }, 1, 0] } },
                                        unsubscribed: { $sum: { $cond: [{ $eq: ["$unsubscribed", DEFAULT_ONE] }, 1, 0] } },
                                    }
                                },
                            ],
                            as: "campaignSendNewsletterDetails"
                        }
                    },
                    {
                        $project: {
                            "_id": 1,
                            "segment_name": "$segment_details.segment_name",
                            "segment_description": "$segment_details.segment_description",
                            "newsletter_title": "$newsletter_details.template_title",
                            "newsletter_description": "$newsletter_details.description",
                            "newsletter_template_action": "$newsletter_details.action",
                            "status": 1,
                            "slug": 1,
                            "segment_count": 1,
                            "created": 1,
                            "is_sent_count": {
                                $cond: [
                                    { $arrayElemAt: ["$campaignSendNewsletterDetails.is_send", 0] },
                                    { $arrayElemAt: ["$campaignSendNewsletterDetails.is_send", 0] },
                                    0
                                ]
                            },
                            "is_opened_count": {
                                $cond: [
                                    { $arrayElemAt: ["$campaignSendNewsletterDetails.is_opened", 0] },
                                    { $arrayElemAt: ["$campaignSendNewsletterDetails.is_opened", 0] },
                                    0
                                ]
                            },
                            "unsubscribed_count": {
                                $cond: [
                                    { $arrayElemAt: ["$campaignSendNewsletterDetails.unsubscribed", 0] },
                                    { $arrayElemAt: ["$campaignSendNewsletterDetails.unsubscribed", 0] },
                                    0
                                ]
                            },
                        }
                    },
                    { $sort: { 'created': SORT_DESC } },
                    { $skip: skip },
                    { $limit: limit },
                ]).toArray(),
                // Count total records
                pollCampaignSendNewsLetter.countDocuments(commonCondition)
            ]);

            // Calculate percentages for each record
            if (Array.isArray(campaignListResultData)) {
                campaignListResultData.forEach((recordsData) => {
                    const totalSent = recordsData && recordsData.is_sent_count ? recordsData.is_sent_count : 0;
                    const isOpenCount = recordsData && recordsData.is_opened_count ? recordsData.is_opened_count : 0;
                    const unsubscribedCount = recordsData && recordsData.unsubscribed_count ? recordsData.unsubscribed_count : 0;
                    const segmentCount = recordsData && recordsData.segment_count ? recordsData.segment_count : 0;

                    recordsData["is_opened_percentage"] = calculatePercentage(isOpenCount, totalSent);
                    recordsData["unsubscribed_percentage"] = calculatePercentage(unsubscribedCount, segmentCount);
                });
            }

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: campaignListResultData,
                    recordsTotal: totalrecords,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalrecords / limit),
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    recordsTotal: 0,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getCampaignSendNewsletterList()

    /**
     * Function to get campaign send newsletter detail.
     * Uses async/await and Promise.all for parallel queries.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.campaignSendNewsletterDetail = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user id and request params
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            const newsletterTemplateAction = req.body.email_action ? req.body.email_action : "";
            const campaignSendNewsletterSlug = req.body.campaign_send_newsletter_slug ? req.body.campaign_send_newsletter_slug : "";
            const emailType = req.body.email_type ? req.body.email_type : CAMPAIGN_ALL;

            const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";
            const zipSearchKeyword = isNaN(searchKeyword) ? searchKeyword : Number(searchKeyword);

            const page = req.body.page ? parseInt(req.body.page) : 1;
            let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const skip = (limit * page) - limit;

            // Validate required params
            if (!userId || !newsletterTemplateAction) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Build campaign options for query
            let campaignOptions = {
                owner_user_id: newObjectIdDefault(userId),
                newsletter_template_action: newsletterTemplateAction,
                is_send: true
            };

            if (campaignSendNewsletterSlug !== "") {
                campaignOptions['campaign_send_newsletter_slug'] = campaignSendNewsletterSlug;
            }

            // Remove is_send for certain email types
            if (
                emailType === CAMPAIGN_ALL ||
                emailType === CAMPAIGN_IS_OPENED ||
                emailType === CAMPAIGN_UNSUBSCRIBED
            ) {
                delete campaignOptions['is_send'];
            }

            // Set email type specific conditions
            if (emailType !== "") {
                switch (emailType) {
                    case CAMPAIGN_IS_SENT:
                        campaignOptions["is_send"] = true;
                        break;
                    case CAMPAIGN_IS_OPENED:
                        campaignOptions["is_opened"] = DEFAULT_ONE;
                        break;
                    case CAMPAIGN_UNSUBSCRIBED:
                        campaignOptions["unsubscribed"] = DEFAULT_ONE;
                        break;
                }
            }

            // Build search condition
            let searchCondition = {};
            if (searchKeyword) {
                const genderSearchKeyword = searchKeyword.toLowerCase();
                if (GLOBAL_TEXT_BOX_GENDER_SEARCH.includes(genderSearchKeyword)) {
                    // Gender-based search
                    if (genderSearchKeyword === GLOBAL_TEXT_BOX_MALE_USER) {
                        searchCondition["gender"] = MALE;
                        searchCondition["account_type"] = { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE };
                    }
                    if (genderSearchKeyword === GLOBAL_TEXT_BOX_FEMALE_USER) {
                        searchCondition["gender"] = FEMALE;
                        searchCondition["account_type"] = { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE };
                    }
                    if (genderSearchKeyword === GLOBAL_TEXT_BOX_OTHER_USER) {
                        searchCondition["gender"] = OTHER;
                        searchCondition["account_type"] = { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE };
                    }
                    if (genderSearchKeyword === GLOBAL_TEXT_BOX_BUSINESS_USER) {
                        searchCondition["account_type"] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
                    }
                } else {
                    // General search
                    searchCondition['$or'] = [
                        { 'first_name': { $regex: new RegExp(searchKeyword, "i") } },
                        { 'last_name': { $regex: new RegExp(searchKeyword, "i") } },
                        { 'full_name': { $regex: new RegExp(searchKeyword, "i") } },
                        { 'email': { $regex: new RegExp(searchKeyword, "i") } },
                        { 'mobile': { $regex: new RegExp(searchKeyword, "i") } },
                        { 'zip': zipSearchKeyword },
                    ];
                }
            }

            // Define aggregation pipeline for details
            const detailsPipeline = [
                { $match: campaignOptions },
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
                                    "_id": 0,
                                    "email": 1,
                                    "full_name": 1,
                                    "fname": 1,
                                    "lname": 1,
                                    "gender": 1,
                                    "dob": 1,
                                    "zip": 1,
                                    "mobile": 1,
                                    "account_type": 1
                                }
                            }
                        ],
                        as: "userDetails"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_EARN_SENT_REWARDS,
                        let: {
                            campaignSendNewsletterLogId: "$_id",
                            campaignSendNewsletterId: "$campaign_send_newsletter_id"
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$campaign_send_newsletter_id", "$$campaignSendNewsletterId"] },
                                            { $eq: ["$campaign_send_newsletter_logs_id", "$$campaignSendNewsletterLogId"] },
                                            { $eq: ["$template_type", EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE] },
                                            { $eq: ["$send_by", userId] },
                                        ]
                                    },
                                }
                            },
                            { $project: { "_id": 0, "is_redemed": 1, "is_viewed": 1 } }
                        ],
                        as: "rewardDetails"
                    }
                },
                {
                    $project: {
                        "_id": 1,
                        "attach_reward": 1,
                        "created": 1,
                        "is_redemed": {
                            $cond: [
                                { $arrayElemAt: ["$rewardDetails.is_redemed", 0] },
                                { $arrayElemAt: ["$rewardDetails.is_redemed", 0] },
                                0
                            ]
                        },
                        "is_viewed": {
                            $cond: [
                                { $arrayElemAt: ["$rewardDetails.is_viewed", 0] },
                                { $arrayElemAt: ["$rewardDetails.is_viewed", 0] },
                                0
                            ]
                        },
                        "full_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.full_name", 0] },
                                { $arrayElemAt: ["$userDetails.full_name", 0] },
                                ""
                            ]
                        },
                        "first_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.fname", 0] },
                                { $arrayElemAt: ["$userDetails.fname", 0] },
                                ""
                            ]
                        },
                        "last_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.lname", 0] },
                                { $arrayElemAt: ["$userDetails.lname", 0] },
                                ""
                            ]
                        },
                        "gender": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.gender", 0] },
                                { $arrayElemAt: ["$userDetails.gender", 0] },
                                ""
                            ]
                        },
                        "zip": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.zip", 0] },
                                { $arrayElemAt: ["$userDetails.zip", 0] },
                                ""
                            ]
                        },
                        "mobile": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.mobile", 0] },
                                { $arrayElemAt: ["$userDetails.mobile", 0] },
                                ""
                            ]
                        },
                        "dob": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.dob", 0] },
                                { $arrayElemAt: ["$userDetails.dob", 0] },
                                ""
                            ]
                        },
                        "email": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.email", 0] },
                                { $arrayElemAt: ["$userDetails.email", 0] },
                                ""
                            ]
                        },
                        "account_type": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.account_type", 0] },
                                { $arrayElemAt: ["$userDetails.account_type", 0] },
                                ""
                            ]
                        }
                    }
                },
                { $match: searchCondition },
                { $sort: { 'created': SORT_DESC } },
                { $skip: skip },
                { $limit: limit }
            ];

            // Define aggregation pipeline for total count
            const countPipeline = [
                { $match: campaignOptions },
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
                                    "_id": 0,
                                    "email": 1,
                                    "full_name": 1,
                                    "fname": 1,
                                    "lname": 1,
                                    "gender": 1,
                                    "dob": 1,
                                    "zip": 1,
                                    "mobile": 1,
                                    "account_type": 1
                                }
                            }
                        ],
                        as: "userDetails"
                    }
                },
                {
                    $project: {
                        "_id": 1,
                        "attach_reward": 1,
                        "created": 1,
                        "email": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.email", 0] },
                                { $arrayElemAt: ["$userDetails.email", 0] },
                                ""
                            ]
                        },
                        "full_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.full_name", 0] },
                                { $arrayElemAt: ["$userDetails.full_name", 0] },
                                ""
                            ]
                        },
                        "first_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.fname", 0] },
                                { $arrayElemAt: ["$userDetails.fname", 0] },
                                ""
                            ]
                        },
                        "last_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.lname", 0] },
                                { $arrayElemAt: ["$userDetails.lname", 0] },
                                ""
                            ]
                        },
                        "gender": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.gender", 0] },
                                { $arrayElemAt: ["$userDetails.gender", 0] },
                                ""
                            ]
                        },
                        "zip": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.zip", 0] },
                                { $arrayElemAt: ["$userDetails.zip", 0] },
                                ""
                            ]
                        },
                        "mobile": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.mobile", 0] },
                                { $arrayElemAt: ["$userDetails.mobile", 0] },
                                ""
                            ]
                        },
                        "dob": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.dob", 0] },
                                { $arrayElemAt: ["$userDetails.dob", 0] },
                                ""
                            ]
                        },
                        "account_type": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.account_type", 0] },
                                { $arrayElemAt: ["$userDetails.account_type", 0] },
                                ""
                            ]
                        }
                    }
                },
                { $match: searchCondition }
            ];

            // Run both queries in parallel using Promise.all
            const [campaignSendNewsletterDetails, totalCampaignSendNewsletterLogs] = await Promise.all([
                // Get paginated campaign send newsletter details
                campaignEmailLogs.aggregate(detailsPipeline).toArray(),
                // Get total count of campaign send newsletter logs
                (async () => {
                    const countResult = await campaignEmailLogs.aggregate(countPipeline).toArray();
                    return countResult.length;
                })()
            ]);

            // Prepare and send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: campaignSendNewsletterDetails || [],
                    recordsTotal: totalCampaignSendNewsletterLogs || 0,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil((totalCampaignSendNewsletterLogs || 0) / limit),
                    message: ""
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle error response
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
    }; // end campaignSendNewsletterDetail()

    /**
    * Function to unsubscribe user from campaign.
    * Uses async/await for all DB operations.
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.campaignUnsubscribeUser = async (req, res) => {
        let finalResponse = {};

        const validateString = req.body.validate_string ? req.body.validate_string : "";
        const confirmationFlag = req.body.confirmation_flag ? req.body.confirmation_flag : false;

        if (!validateString) {
            // Validation failed: missing validate string
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Find user by campaign unsubscribe validate string
            const userResult = await users.findOne(
                { campaign_unsubscribe_validate_string: validateString },
                { projection: { _id: 1, email: 1, campaign_unscribed_validate_string: 1 } }
            );

            if (!userResult) {
                // User not found or invalid validate string
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.campaign.this_url_is_not_validate"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            if (confirmationFlag === true) {
                // User confirmed unsubscribe action

                const userId = userResult._id ? userResult._id : "";
                const userEmail = userResult.email ? userResult.email : "";

                // Update user to clear validate string and mark as unsubscribed
                await users.updateOne(
                    { _id: newObjectIdDefault(userId) },
                    { $set: { campaign_unsubscribe_validate_string: "", segment_campaign_unsubscribed: true } }
                );

                // Prepare unsubscribe log data
                const subscribeData = {
                    user_id: newObjectIdDefault(userId),
                    user_email: userEmail,
                    subscribed: "false",
                    unsubscribed: "true",
                    campaign_unsubscribe_validate_string: validateString,
                };

                // Save subscribe/unsubscribe logs and update campaign email logs in parallel
                const [saveResponse] = await Promise.all([
                    saveCampaignSubscribedAndUnsubscribedLogs(req, res, subscribeData),
                    campaignEmailLogs.updateMany(
                        { campaign_unsubscribe_validate_string: validateString },
                        { $set: { unsubscribed: DEFAULT_ONE } }
                    )
                ]);

                // Send success response
                finalResponse = {
                    data: {
                        status: saveResponse.status,
                        message: saveResponse.message,
                    }
                };
                return returnApiResult(req, res, finalResponse);

            } else {
                // Ask user to confirm unsubscribe
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.campaign.please_confirm_the_unsubscribe"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.campaign.this_url_is_not_validate"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end campaignUnsubscribeUser()

    /**
    * Function to handle social unsubscribe using async/await.
    * @param {*} req 
    * @param {*} res
    * @returns json response
    */
    this.socialUnsubscribeUser = async (req, res) => {
        let finalResponse = {};

        // Extract and validate input parameters
        const validateString = req.body.validate_string ? req.body.validate_string : "";
        const confirmationFlag = req.body.confirmation_flag ? req.body.confirmation_flag : false;

        if (!validateString) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Find user by social_unsubscribe_validate_string
            const userResult = await users.findOne(
                { social_unsubscribe_validate_string: validateString },
                { projection: { _id: 1, email: 1, campaign_unscribed_validate_string: 1 } }
            );

            if (userResult) {
                // If confirmationFlag is true, update the user's unsubscribe status
                if (confirmationFlag === true) {
                    const userId = userResult._id ? userResult._id : "";

                    // Update user social unsubscribe validating string and set unsubscribed
                    await users.updateOne(
                        { _id: newObjectIdDefault(userId) },
                        { $set: { social_unsubscribe_validate_string: "", social_unsubscribed: true } }
                    );

                    // Send success response for unsubscribe
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: res.__("front.campaign.email_has_been_unsubscribed_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    // Send success response for subscribe (confirmation not given yet)
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: res.__("front.campaign.email_has_been_subscribed_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // User not found or invalid validate string
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.campaign.this_url_is_not_validate"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.campaign.this_url_is_not_validate"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end socialUnsubscribeUser()

}
module.exports = new pollCampaigns();