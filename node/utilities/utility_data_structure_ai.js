const ObjectId = require('mongodb').ObjectID;
const momentTimezone = require("moment-timezone");


/**
 * Function to arrange and save data for bucket AI data structure.
 * Uses async/await and parallelizes user fetch and delete operations for efficiency.
 */
saveCustomerBucketItems = async (options) => {
    const customerBucketItems = db.collection(TABLE_CUSTOMER_BUCKET_ITEMS);
    const users = db.collection(TABLE_USERS);

    // Extract and sanitize input options
    const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    const data = options.data || {};
    const userBucketName = options.bucket_name || "";
    const parentBucket = options.parent_bucket ? parseInt(options.parent_bucket) : "";
    let childBucket = options.child_bucket ? parseInt(options.child_bucket) : 1;

    // Run user fetch and previous bucket items delete in parallel for faster response
    const [userDetails, _] = await Promise.all([
        users.findOne(
            { '_id': userId },
            { projection: { 'user_unique_id': 1, 'fname': 1 } }
        ),
        customerBucketItems.deleteMany({
            'user_id': userId,
            'parent_bucket_name': userBucketName,
            'parent_bucket_id': parentBucket
        })
    ]);

    const userName = userDetails?.fname || "";
    const customerId = userDetails?.user_unique_id || "";

    // Prepare new bucket items to insert
    const result = [];
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            result.push({
                'user_id': userId,
                'user_name': userName,
                'customer_id': customerId,
                'parent_bucket_id': parentBucket,
                'parent_bucket_name': userBucketName,
                'bucket_id': Number(`${parentBucket}.${childBucket++}`),
                'bucket_name': formatKey(key),
                'data_key': key,
                'data': data[key],
                'is_deleted': NOT_DELETED,
                'created': getUtcDate(),
            });
        }
    }

    // Insert all new bucket items if any exist
    if (result.length > 0) {
        await customerBucketItems.insertMany(result);
    }
};

/**function for format key */
formatKey = (key) => {
    if (!key) return '';
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

/**Function is used to fetch social posts data */
fetchUserSocialPostSummary = (req, res, userId) => {
    return new Promise(async resolve => {
        try {
            const tableAiSocialPostLogs = db.collection(TABLE_AI_SOCIAL_POST_LOGS);
            const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
            let currentTimezone = (req.body.default_timezone) ? req.body.default_timezone : "";

            let usedIds = await usedRecordsIds(req, res, userId, AI_RESPONSE_TYPE_SOCIAL_MEDIA);

            let commonCondition = {
                '_id': { $in: usedIds },
                "is_manually": { $ne: true }
            }

            /**Prepare all queries in parallel*/
            const [scheduledPostsRaw, manualPostsRaw, deletedPostsRaw, editedPostsRaw, editManualyPostRaw] = await Promise.all([
                /**Scheduled Posts (with upcoming schedule_date)*/
                tableAiCampaignChat.aggregate([
                    { $match: commonCondition },
                    {
                        $lookup: {
                            from: TABLE_CALENDAR_SCHEDULE_POST,
                            let: { campaignId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$ai_campaign_chat_id", "$$campaignId"] },
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "scheduleDetails"
                        }
                    },
                    {
                        $match: {
                            scheduleDetails: { $ne: [] }
                        }
                    },
                    {
                        "$addFields": {
                            "schedule_date": { $cond: [{ $arrayElemAt: ["$scheduleDetails.schedule_date", 0] }, { $arrayElemAt: ["$scheduleDetails.schedule_date", 0] }, ""] },
                        }
                    },
                    { $sort: { 'created': SORT_DESC } },
                    { $limit: 10 }
                ]).toArray(),

                /**Manually Created Posts*/
                tableAiCampaignChat.find(
                    { 'user_id': userId, 'is_manually': true, 'is_deleted': NOT_DELETED, 'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA },
                    { projection: { 'content': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Deleted Posts*/
                tableAiCampaignChat.find(
                    { 'user_id': userId, 'is_deleted': DELETED, 'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA },
                    { projection: { 'content': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Edited Posts from logs*/
                tableAiSocialPostLogs.find(
                    { 'user_id': userId, 'is_deleted': NOT_DELETED },
                    { projection: { 'content': 1, role: 1 } }
                ).sort({ 'created': SORT_DESC }).limit(14).toArray(),

                /**Manually Edited Posts*/
                tableAiCampaignChat.find(
                    { 'user_id': userId, 'is_edited_manually': true, 'is_deleted': NOT_DELETED, 'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA },
                    { projection: { 'content': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(5).toArray(),
            ]);

            // Format schedule_date to timezone (e.g., PST)
            await Promise.all(scheduledPostsRaw.map(async (record, index) => {
                const utcDate = record.schedule_date;
                const formattedDate = utcDate ? newDateTimeZone(utcDate, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone) : "";
                scheduledPostsRaw[index].schedule_date = formattedDate;
            }));

            /** Helper: extract title, caption, created, and optional schedule_date */
            const extractContent = (records, type = null, includeScheduleDate = false) => {
                return records.map(record => {
                    const content = record.content || {};
                    const base = {
                        'title': content.title || "",
                        'caption': content.captions || "",
                        'post_created': record.created || ""
                    };

                    if (includeScheduleDate) {
                        base.schedule_date = record.schedule_date || "";
                    }

                    return type ? { ...base, type } : base;
                });
            };

            /** scheduled social posts */
            const scheduledContents = extractContent(scheduledPostsRaw, null, true);

            /**manual created social posts*/
            const manualContents = manualPostsRaw.map(record => {
                const content = record.content || {};
                return {
                    'title': content.title || "",
                    'caption': content.captions || ""
                };
            });

            /**deleted social posts*/
            const deletedContents = deletedPostsRaw.map(record => {
                const content = record.content || {};
                return {
                    'title': content.title || "",
                    'caption': content.captions || ""
                };
            });


            /**edited social posts*/
            const editedPosts = [];

            for (let i = 0; i < editedPostsRaw.length; i++) {
                const current = editedPostsRaw[i];
                if (current.role === AI_ROLE_ASSISTANT) {
                    editedPosts.push({
                        type: AI_ROLE_ASSISTANT,
                        title: current.content?.title || "",
                        caption: current.content?.captions || "",
                    });
                } else if (current.role === AI_ROLE_USER) {
                    editedPosts.push({
                        type: AI_ROLE_USER,
                        user_text: current.content || ""
                    });
                }
            }

            editedPosts.reverse();

            /**edited manualy social posts*/
            const editManualyPosts = editManualyPostRaw.map(record => {
                const content = record.content || {};
                return {
                    'type': EDIT_TYPE_MANUAL,
                    'title': content.title || "",
                    'caption': content.captions || ""
                };
            });

            const finalEditedPosts = [...editedPosts, ...editManualyPosts];

            /**get_caption_summary*/
            const captionSummary = await Promise.all(
                scheduledPostsRaw.map(async record => {
                    const content = record.content || {};

                    let captionSummaryData = await generateCaptionSummaryForBucket({ 'caption': content.captions, 'title': content.title });

                    return {
                        'title': content.title || "",
                        'caption': content.captions || "",
                        'caption_summary': captionSummaryData || {},
                    };
                })
            );

            /**Final response*/
            return resolve({
                "scheduled_posts": scheduledContents,
                "edited_posts": finalEditedPosts,
                "deleted_posts": deletedContents,
                "manual_posts": manualContents,
                "caption_summary": captionSummary
            });

        } catch (error) {
            console.error("Error in fetchUserSocialPostSummary:", error);
            return resolve({
                "scheduled_posts": [],
                "edited_posts": [],
                "deleted_posts": [],
                "manual_posts": []
            });
        }
    });
}

/**Function is used to fetch email data */
fetchUserEmailSummary = (req, res, userId) => {
    return new Promise(async resolve => {
        try {
            const emailNewsletterTemplates = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
            const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
            const tableAiEmailLogs = db.collection(TABLE_AI_EMAIL_TEMPLATE_LOGS);

            /**Prepare all queries in parallel*/
            const [sentEmailsRaw, manualEmailsRaw, deletedEmailsRaw, editedEmailsRaw, editedManualRaw] = await Promise.all([
                /**sent ai generated emails*/
                tableAiCampaignChat.aggregate([
                    { $match: { 'user_id': userId, 'type': AI_RESPONSE_TYPE_EMAIL, 'is_deleted': NOT_DELETED } },
                    {
                        $lookup: {
                            from: TABLE_EMAIL_NEWSLETTER_TEMPLATE,
                            let: { campaignId: "$_id", campaignNameId: "$ai_campaign_parent_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$ai_campaign_chat_id", "$$campaignId"] },
                                                { $eq: ["$ai_campaign_name_id", "$$campaignNameId"] },
                                                { $ne: ["$is_sent", DEACTIVE] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "sent_emails"
                        }
                    },
                    { $match: { "sent_emails.0": { $exists: true } } },
                    { $project: { '_id': 0, 'content': 1, } },
                    { $sort: { 'created': SORT_DESC } },
                    { $limit: 10 }
                ]).toArray(),

                /**manual emails*/
                emailNewsletterTemplates.find(
                    {
                        "user_id": userId,
                        $or: [
                            { "ai_campaign_chat_id": { $exists: false } },
                            { "ai_campaign_chat_id": "" }
                        ]
                    },
                    { projection: { '_id': 0, 'body': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Deleted emails*/
                tableAiCampaignChat.find(
                    { 'user_id': userId, 'is_deleted': DELETED, 'type': AI_RESPONSE_TYPE_EMAIL },
                    { projection: { '_id': 0, 'content': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Edited emails from logs*/
                tableAiEmailLogs.find(
                    { 'user_id': userId, 'is_deleted': NOT_DELETED },
                    { projection: { 'content': 1, 'role': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(14).toArray(),

                /**Manually Edited emails*/
                emailNewsletterTemplates.find(
                    { "user_id": userId, 'is_edited_manually': true },
                    { projection: { '_id': 0, 'body': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(5).toArray(),
            ]);

            /**sent emails */
            const sentEmails = sentEmailsRaw.map(item => item.content);
            /**deleted emails */
            const deletedEmails = deletedEmailsRaw.map(item => item.content);

            /**edited Ai emails*/
            const editedEmails = [];
            for (let i = 0; i < editedEmailsRaw.length; i++) {
                const current = editedEmailsRaw[i];
                if (current.role === AI_ROLE_ASSISTANT) {
                    editedEmails.push({
                        type: AI_ROLE_ASSISTANT,
                        email: current.content || "",
                    });
                } else if (current.role === AI_ROLE_USER) {
                    editedEmails.push({
                        type: AI_ROLE_USER,
                        user_text: current.content || ""
                    });
                }
            }

            const editedManual = editedManualRaw.map(item => ({
                type: EDIT_TYPE_MANUAL,
                email: {
                    "body": item.body
                }
            }));

            editedEmails.reverse();

            const finalEditedEmails = [...editedEmails, ...editedManual];

            /**Final response*/
            return resolve({
                "sent_emails": sentEmails,
                "edited_emails": finalEditedEmails,
                "deleted_emails": deletedEmails,
                "manual_emails": manualEmailsRaw,
            })

        } catch (error) {
            console.error("Error in fetch User Email Summary:", error);
            return resolve({
                "sent_emails": [],
                "edited_emails": [],
                "deleted_emails": [],
                "manual_emails": [],
            });
        }
    });
}

/**Function is used to fetch poll data */
fetchUserPollSummary = (req, res, userId) => {
    return new Promise(async resolve => {
        try {
            const polls = db.collection(TABLE_POLLS);
            const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
            const tableAiPollLogs = db.collection(TABLE_AI_POLL_LOGS);

            /**Prepare all queries in parallel*/
            const [aiGeneratedPollsRaw, manualPollsRaw, deletedPollsRaw, editedPollsRaw, manualEditedPollsRaw] = await Promise.all([
                /**ai generated poll and vote*/
                polls.aggregate([
                    { $match: { 'user_id': userId, 'type': POLL_AI_TYPE, 'is_deleted': NOT_DELETED } },
                    {
                        $lookup: {
                            from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
                            let: { pollId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        user_id: { $nin: ["", null] },
                                        $expr: {
                                            $eq: ["$poll_id", "$$pollId"]
                                        }
                                    }
                                },
                                { $project: { _id: 1 } },
                                { $count: "total_vote" }
                            ],
                            as: "poll_vote"
                        }
                    },
                    {
                        $project: {
                            'question': 1,
                            'options': 1,
                            'hashtag': 1,
                            'slug': 1,
                            'created': 1,
                            'total_vote': {
                                $cond: [
                                    { $gt: [{ $size: "$poll_vote" }, 0] },
                                    { $arrayElemAt: ["$poll_vote.total_vote", 0] },
                                    0
                                ]
                            }
                        }
                    },
                    { $match: { 'total_vote': { $gt: 0 } } },
                    { $sort: { 'created': SORT_DESC } },
                    { $limit: 10 }
                ]).toArray(),

                /**manuall poll created*/
                polls.find(
                    { "user_id": userId, "type": { $ne: POLL_AI_TYPE }, 'is_deleted': NOT_DELETED, },
                    { projection: { '_id': 0, 'question': 1, 'options': 1, 'hashtag': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Deleted polls*/
                polls.find(
                    { "user_id": userId, 'is_deleted': DELETED, },
                    { projection: { '_id': 0, 'question': 1, 'options': 1, 'hashtag': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Edited polls from logs*/
                tableAiPollLogs.find(
                    { 'user_id': userId, 'is_deleted': NOT_DELETED },
                    { projection: { 'content': 1, 'role': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(14).toArray(),

                /**manuall poll edited*/
                polls.find(
                    { "user_id": userId, 'is_edited_manually': true, 'is_deleted': NOT_DELETED, },
                    { projection: { '_id': 0, 'question': 1, 'options': 1, 'hashtag': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(5).toArray(),

            ]);

            /**created by ai polls */
            const aiGeneratedPolls = aiGeneratedPollsRaw.map(poll => ({
                'question': poll.question,
                'options': poll.options.map(option => option.title),
                'hashtags': poll.hashtag ? poll.hashtag.split(' ') : []
            }));

            /**manual polls */
            const manualPolls = manualPollsRaw.map(poll => ({
                'question': poll.question,
                'options': poll.options.map(option => option.title),
                'hashtags': poll.hashtag ? poll.hashtag.split(' ') : []

            }));

            /**deleted polls */
            const deletedPolls = deletedPollsRaw.map(poll => ({
                'question': poll.question,
                'options': poll.options.map(option => option.title),
                'hashtags': poll.hashtag ? poll.hashtag.split(' ') : [],
            }));

            /**edited Ai polls*/
            const editedPolls = [];
            for (let i = 0; i < editedPollsRaw.length; i++) {
                const current = editedPollsRaw[i];
                if (current.role === AI_ROLE_ASSISTANT) {
                    editedPolls.push({
                        type: AI_ROLE_ASSISTANT,
                        poll: current.content || "",
                    });
                } else if (current.role === AI_ROLE_USER) {
                    editedPolls.push({
                        type: AI_ROLE_USER,
                        user_text: current.content || ""
                    });
                }
            }

            /**manual polls */
            const manualEditsPolls = manualEditedPollsRaw.map(poll => ({
                'type': EDIT_TYPE_MANUAL,
                'poll': {
                    'question': poll.question,
                    'options': poll.options.map(option => option.title),
                    'hashtags': poll.hashtag ? poll.hashtag.split(' ') : [],
                }
            }));

            editedPolls.reverse();

            const finalEditedPolls = [...editedPolls, ...manualEditsPolls];

            /**Final response*/
            return resolve({
                "sent_polls": aiGeneratedPolls,
                "edited_polls": finalEditedPolls,
                "deleted_polls": deletedPolls,
                "manual_polls": manualPolls,
            })

        } catch (error) {
            console.error("Error in fetch User Poll Summary:", error);
            return resolve({
                "sent_polls": [],
                "edited_polls": [],
                "deleted_polls": [],
                "manual_polls": [],
            });
        }
    });
}

/**Function is used to fetch reward data */
fetchUserRewardSummary = (req, res, userId) => {
    return new Promise(async resolve => {
        try {
            const rewards = db.collection(TABLE_REWARDS);

            /**Prepare all queries in parallel*/
            const [sendRewardsRaw, editRewarRaw, manualRewardRaw, deletedRewardssRaw] = await Promise.all([
                /**sent ai created rewards*/
                rewards.aggregate([
                    { $match: { 'user_id': userId, 'is_deleted': NOT_DELETED, 'type': REWARDS_AI_USER_ADD } },
                    {
                        $lookup: {
                            from: TABLE_EARN_SENT_REWARDS,
                            let: { rewardId: "$_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$reward_id", "$$rewardId"] },
                                                { $eq: ["$is_deleted", NOT_DELETED] }
                                            ]
                                        }
                                    }
                                }
                            ],
                            as: "sent_rewards"
                        }
                    },
                    {
                        $addFields: { 'sent_count': { $size: "$sent_rewards" } }
                    },
                    { $match: { 'sent_count': { $gt: 0 } } },
                    { $project: { '_id': 0, 'reward_text': 1, 'reward_sub_heading': 1, 'url_desc': 1, } },
                    { $sort: { 'created': SORT_DESC } },
                    { $limit: 10 }
                ]).toArray(),

                /**Edited rewards*/
                rewards.find(
                    { "user_id": userId, 'is_edited': true, 'is_deleted': NOT_DELETED },
                    { projection: { '_id': 0, 'reward_text': 1, 'reward_sub_heading': 1, 'url_desc': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**manuall rewards created*/
                rewards.find(
                    { "user_id": userId, 'is_deleted': NOT_DELETED, "type": { $ne: REWARDS_AI_USER_ADD } },
                    { projection: { '_id': 0, 'reward_text': 1, 'reward_sub_heading': 1, 'url_desc': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),

                /**Deleted rewards*/
                rewards.find(
                    { 'user_id': userId, 'is_deleted': DELETED },
                    { projection: { '_id': 0, 'reward_text': 1, 'reward_sub_heading': 1, 'url_desc': 1 } }
                ).sort({ 'created': SORT_DESC }).limit(10).toArray(),
            ]);

            /**Final response*/
            return resolve({
                "sent_rewards": sendRewardsRaw,
                "edited_rewards": editRewarRaw,
                "deleted_rewards": deletedRewardssRaw,
                "manual_rewards": manualRewardRaw,
            })
        } catch (error) {
            console.error("Error in fetch User Rewards Summary:", error);
            return resolve({
                "sent_rewards": [],
                "edited_rewards": [],
                "deleted_rewards": [],
                "manual_rewards": [],
            });
        }
    });
}

/**function to convert date string to date object*/
convertTo24HourFormat = (times = []) => {
    return times.map(timeStr => {
        if (!timeStr || typeof timeStr !== "string") return "00:00:00";

        /**Keep only up to first AM/PM or numeric part*/
        const ampmMatch = timeStr.match(/^(.*?\b(?:AM|PM)\b)/i);
        if (ampmMatch) {
            timeStr = ampmMatch[1];
        } else {
            /**Otherwise remove any non-time garbage after number*/
            timeStr = timeStr.replace(/[^0-9:]/g, " ").split(" ").filter(Boolean).join(" ");
        }

        /**Clean: remove unwanted characters, trim, fix spaces*/
        timeStr = timeStr.replace(/[^0-9:APMapm\s]/g, "").replace(/\s+/g, " ").trim().toUpperCase();

        /**Case 1: Already 24-hour format like "14:30" or "15:02:05"*/
        if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
            const parts = timeStr.split(":");
            const hour = parseInt(parts[0], 10).toString().padStart(2, '0');
            const minute = parseInt(parts[1], 10).toString().padStart(2, '0');
            const second = parts[2] ? parseInt(parts[2], 10).toString().padStart(2, '0') : "00";
            return `${hour}:${minute}:${second}`;
        }

        /**Case 2: AM/PM like "12:05 PM", "8 AM", "9:4am"*/
        const match = timeStr.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)$/i);
        if (match) {
            let hour = parseInt(match[1], 10);
            let minute = parseInt(match[2] || "0", 10);
            const period = match[3].toUpperCase();

            if (period === "PM" && hour !== 12) hour += 12;
            if (period === "AM" && hour === 12) hour = 0;

            const formattedHour = hour.toString().padStart(2, '0');
            const formattedMinute = minute.toString().padStart(2, '0');
            return `${formattedHour}:${formattedMinute}:00`;
        }

        /** Case 3: Only hour like "9"*/
        const hourOnly = timeStr.match(/^(\d{1,2})$/);
        if (hourOnly) {
            const hour = parseInt(hourOnly[1], 10).toString().padStart(2, '0');
            return `${hour}:00:00`;
        }

        /**Fallback*/
        return "00:00:00";
    });
};
/** Function for auto schedule post */
autoSchedulePosts = async (req, res, options) => {
    try {
        const customerBucketItems = db.collection(TABLE_CUSTOMER_BUCKET_ITEMS);
        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
        const calenderSchedulePosts = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

        let loginUserData = (options.login_user_data) ? options.login_user_data : "";
        let userId = (loginUserData._id) ? newObjectIdDefault(loginUserData._id) : "";
        let facebookPageId = (loginUserData.facebook_page_id) ? loginUserData.facebook_page_id : "";
        let facebookPageAccessToken = (loginUserData.facebook_page_access_token) ? loginUserData.facebook_page_access_token : "";
        let currentTimezone = (loginUserData.current_timezone) ? loginUserData.current_timezone : "";
        let instagramAccessToken = (loginUserData.long_lived_access_token) ? loginUserData.long_lived_access_token : "";

        let aiCampaignChatId = (options.ai_campaign_chat_id) ? newObjectIdDefault(options.ai_campaign_chat_id) : "";

        if (!userId || !aiCampaignChatId) {
            console.error("Invalid userId or aiCampaignChatId");
            return;
        }

        let parentBucketId = (instagramAccessToken) ? PARENT_BUCKET_SOCIAL_PRESENCE : PARENT_BUCKET_APIFY_DATA;
        let bucketId = (instagramAccessToken) ? 2.3 : 7.3;

        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);

        const [postingHabbits, postData, schedulePosts] = await Promise.all([
            customerBucketItems.findOne({
                'user_id': userId,
                'parent_bucket_id': parentBucketId,
                'bucket_id': bucketId
            }),
            tableAiCampaignChat.findOne({
                '_id': aiCampaignChatId,
                'user_id': userId,
                // 'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA
            }),
            calenderSchedulePosts.find({
                'user_id': userId,
                'schedule_date': { $gte: todayMidnight },
                // 'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA
            }, { projection: { '_id': 0, 'schedule_date': 1 } }).toArray(),
        ]);

        /**posting habbits */
        let postingHabbitData = postingHabbits?.data || {};
        let bestDays = postingHabbitData.bestDays || [];
        let bestTimes = postingHabbitData.bestTimes || [];
        let timeForSchedule = convertTo24HourFormat(bestTimes);

        if (bestDays.length == 0) {
            return;
        }

        /**let post details */
        let postTitle = postData?.content?.title || "";
        let postType = postData?.type || "";
        let uniqueKey = postData?.unique_key || "";
        let aiCampaignNameId = postData?.ai_campaign_parent_id || "";

        let availableDates = getAvailableDatesThisMonth(bestDays, timeForSchedule, schedulePosts, currentTimezone);
        let scheduleDate = (availableDates.length > 0) ? availableDates[0]?.date : "";
        let scheduleTime = (availableDates.length > 0) ? availableDates[0]?.time : "";
        let scheduleDateWithTime = scheduleDate + ' ' + scheduleTime;

        /**final schedule date with time for scheduling post */
        let finalSecheduleDateTime = newDateTimeZone(scheduleDateWithTime, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone);
        let scheduleInsertOptions = {
            'title_name': postTitle,
            'schedule_date': finalSecheduleDateTime,
            'user_id': userId,
            'unique_key': uniqueKey,
            'ai_campaign_parent_id': aiCampaignNameId,
            'ai_campaign_chat_id': aiCampaignChatId,
            'type': postType, //AI_RESPONSE_TYPE_SOCIAL_MEDIA,
            'instagram_enable': true,
            'facebook_enable': true,
            'facebook_page_id': facebookPageId,
            'facebook_page_access_token': facebookPageAccessToken,
        };
        await schedulePostInsertData(req, res, scheduleInsertOptions);

        /** Update sinup lead stage */
        await tableAiCampaignChat.updateOne({
            'user_id': userId,
            '_id': newObjectIdDefault(aiCampaignChatId),
        }, {
            $set: {
                'is_scheduled': true,
                'is_draft': CAMPAIGN_NOT_DRAFT,
            }
        });
        return;
    } catch (error) {
        console.error("Error in autoSchedulePosts:", error);
        return;
    }
};


/** Funciton for used to get Available Dates This Month */
getAvailableDatesThisMonth = (bestDays, bestTime, schedulePosts = [], currentTimezone) => {
    const dayNameToIndex = {
        "Sunday": 0,
        "Monday": 1,
        "Tuesday": 2,
        "Wednesday": 3,
        "Thursday": 4,
        "Friday": 5,
        "Saturday": 6
    };

    const indexToDayName = Object.fromEntries(
        Object.entries(dayNameToIndex).map(([k, v]) => [v, k])
    );

    const targetDayIndexes = bestDays.map(day => dayNameToIndex[day]);

    const results = [];
    const today = momentTimezone().tz(currentTimezone).startOf('day');
    const endOfMonth = today.clone().endOf('month');

    for (let m = 0; m < 12; m++) {
        const firstDate = today.clone().add(m, 'months').startOf('month');
        const lastDate = firstDate.clone().endOf('month');

        for (let date = firstDate.clone(); date.isSameOrBefore(lastDate); date.add(1, 'day')) {
            const dayIndex = date.day();

            if (!targetDayIndexes.includes(dayIndex)) continue;
            if (date.isSameOrBefore(today)) continue;

            const dayName = indexToDayName[dayIndex];

            for (let i = 0; i < bestDays.length; i++) {
                if (bestDays[i] === dayName) {
                    const scheduleTime = bestTime[i] || "00:00";

                    const fullDateTime = momentTimezone.tz(`${date.format('YYYY-MM-DD')} ${scheduleTime}`, 'YYYY-MM-DD HH:mm', currentTimezone);

                    // Create 2-hour before and after window
                    const windowStart = fullDateTime.clone().subtract(2, 'hours');
                    const windowEnd = fullDateTime.clone().add(2, 'hours');

                    // Check overlap
                    const isOverlapping = schedulePosts.some(p => {
                        const postTime = momentTimezone(p.schedule_date).tz(currentTimezone);
                        return postTime.isBetween(windowStart, windowEnd, null, '[]');
                    });

                    if (!isOverlapping) {
                        results.push({
                            dayName,
                            date: date.format('YYYY-MM-DD'),
                            time: scheduleTime
                        });
                        return results; // Return first available date/time
                    }
                }
            }
        }
    }
    return results;
};


/**generate caption summary for bucket*/
generateCaptionSummaryForBucket = async (options) => {
    if (options) {
        const { caption, title } = options;

        let userPrompt = `Caption :${caption}; Title: ${title}`;

        let prompt = `Your task is to analyse the ${userPrompt} and return the most sutable response`;
        let format = CAPTION_SUMMARY_SCHEMA;

        try {
            let geminiResponse = await commonForGeminiWithoutGrounding(null, null, { 'prompt': prompt, 'format_schema': format });

            let response = geminiResponse.response || '';

            return response;

        } catch (err) {

            return;
        }

    }
}

