const fs = require('fs');
const async = require('async');
const shell = require('shelljs');
const axios = require('axios');
const momentTimezone = require('moment-timezone');
const path = require('path');
const schedule = require('node-schedule'); // Include node-schedule
const sharp = require('sharp');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const request = require('request');


/**Instagram */
const instagramMaxRetries = INSTAGRAM_MAX_RETRIES; // Set max retries as needed
const instagramDelay = INSTAGRAM_DELAY; // 3 seconds instagramDelay between retries

/**
 * Retrieves a list of AI campaign chat IDs that have a scheduled date in the past.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {String} userId - The ID of the user for whom to retrieve scheduled posts.
 * @returns {Promise<Array>} A promise that resolves with an array of AI campaign chat IDs.
 */
schedulePassedIds = async (req, res, userId) => {
    try {
        const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

        // Fetch distinct AI campaign chat IDs with a schedule date in the past
        const passedSchedulePostIds = await calendarSchedulePost.distinct(
            "ai_campaign_chat_id",
            { user_id: userId, schedule_date: { $lt: new Date() } }
        );

        return passedSchedulePostIds;
    } catch (error) {
        // Log error and return empty array on failure
        console.error("Error in schedulePassedIds:", error);
        return [];
    }
}; // End schedulePassedIds()

/**
 * Retrieves a list of AI campaign chat IDs that have a scheduled date in the future or are scheduled for today.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {String} userId - The ID of the user for whom to retrieve scheduled posts.
 * @returns {Promise<Array>} A promise that resolves with an array of AI campaign chat IDs.
 */
scheduleNotPassedIds = async (req, res, userId) => {
    try {
        const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

        // Fetch distinct AI campaign chat IDs with a schedule date in the future or today
        const notPassedSchedulePostIds = await calendarSchedulePost.distinct(
            "ai_campaign_chat_id",
            { user_id: userId, schedule_date: { $gte: new Date() } }
        );

        return notPassedSchedulePostIds;
    } catch (error) {
        // Log error and return empty array on failure
        console.error("Error in scheduleNotPassedIds:", error);
        return [];
    }
}; // End scheduleNotPassedIds()

/**
 * Inserts a new log entry into the Instagram logs collection using async/await for faster response times.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Object} insertObject - The log entry to be inserted.
 * @returns {Promise<void>} A promise that resolves when the log entry has been inserted.
 */
insertInstagramLogs = async (req, res, insertObject) => {
    try {
        const instagramlogs = db.collection(TABLE_INSTAGRAM_LOGS);
        insertObject['created'] = getUtcDate();

        // Insert the log entry asynchronously
        await instagramlogs.insertOne(insertObject);

        // Successfully inserted, resolve the promise
        return;
    } catch (error) {
        // Log error for debugging
        console.error("Error in insertInstagramLogs:", error);
        // Still resolve to avoid unhandled promise rejection
        return;
    }
}; // End insertInstagramLogs()

/** 
 * Function to schedule an Instagram (and optionally Facebook) post using async/await for all DB queries.
 * All queries are run in parallel where possible for faster response times.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Object} scheduleOptions - Options for scheduling the post.
 * @returns {Promise<void>} A promise that resolves when the post has been scheduled.
 */
instagramScheduleForSocialPost = async (req, res, scheduleOptions) => {
    return new Promise(async (resolve) => {
        const defaultTimezone = req.body.default_timezone || DEFAULT_TIME_ZONE;
        const userId = scheduleOptions.user_id ? newObjectIdDefault(scheduleOptions.user_id) : "";
        const aiCampaignChatId = scheduleOptions.ai_campaign_chat_id ? newObjectIdDefault(scheduleOptions.ai_campaign_chat_id) : "";
        const dateTimeString = scheduleOptions.schedule_date || "";
        const scheduleInsertedId = scheduleOptions.schedule_inserted_id || "";

        const instagramEnable = scheduleOptions.instagram_enable ? JSON.parse(scheduleOptions.instagram_enable) : false;
        const facebookEnable = scheduleOptions.facebook_enable ? JSON.parse(scheduleOptions.facebook_enable) : false;

        try {
            // Convert date for moment js for timezone
            const scheduleDate = momentTimezone.tz(dateTimeString, defaultTimezone).toDate();

            // Schedule the post
            schedule.scheduleJob(scheduleDate, async function () {
                try {
                    // Get collections
                    const users = db.collection(TABLE_USERS);
                    const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
                    const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

                    // Fetch user schedule and user details in parallel
                    const [userSchedule, usersToData] = await Promise.all([
                        calendarSchedulePost.findOne({ '_id': scheduleInsertedId }),
                        users.findOne({ '_id': userId })
                    ]);

                    if (!userSchedule || !usersToData) {
                        return resolve();
                    }

                    const longLivedAccessToken = usersToData.long_lived_access_token || "";
                    const facebookPageId = usersToData.facebook_page_id || "";
                    const facebookPageAccessToken = usersToData.facebook_page_access_token || "";

                    if (!(longLivedAccessToken || facebookPageId)) {
                        return resolve();
                    }

                    // Fetch campaign chat details
                    const campaignChatDetails = await tableAiCampaignChat.findOne({ '_id': aiCampaignChatId, 'user_id': userId });
                    if (!campaignChatDetails) {
                        return resolve();
                    }

                    // Extract content data
                    const contentData = campaignChatDetails.content || {};
                    const uniqueKey = campaignChatDetails.unique_key || "";
                    const aiCampaignParentId = campaignChatDetails.ai_campaign_parent_id || "";
                    const allImagesVideoArray = contentData.image || [];
                    const allFacebookImagesVideoArray = contentData.facebook_image || [];
                    const caption = contentData.captions || "";
                    const title = contentData.title || "";
                    const instagramHandle = contentData.instagram_handle || "";

                    if (!(caption && (allImagesVideoArray.length > 0 || allFacebookImagesVideoArray.length > 0))) {
                        return resolve();
                    }

                    // Prepare promises for Instagram and Facebook publishing
                    const publishPromises = [];

                    // Instagram publishing
                    if (
                        allImagesVideoArray.length > 0 &&
                        longLivedAccessToken &&
                        instagramEnable
                    ) {
                        publishPromises.push((async () => {
                            let instagramCaption = caption;
                            if (instagramHandle) {
                                instagramCaption += PHOTO_CREDIT_CONSTANT + instagramHandle;
                            }

                            let insertLogs = {
                                'user_id': userId,
                                'ai_campaign_parent_id': aiCampaignParentId,
                                'image_url': allImagesVideoArray,
                                'title': title,
                                'caption': instagramCaption,
                                'unique_key': uniqueKey,
                                'ai_campaign_chat_id': aiCampaignChatId,
                                'long_lived_access_token': longLivedAccessToken,
                                'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            };

                            try {
                                let mediaContainerId = "";
                                // Single image/video upload
                                if (allImagesVideoArray.length === 1) {
                                    const mediaUrl = allImagesVideoArray[0]['name'] ? AI_SOCIAL_IMAGES_URL + allImagesVideoArray[0]['name'] : "";
                                    const createMediaResponse = await createSingelInstagramMedia(longLivedAccessToken, mediaUrl, instagramCaption);
                                    mediaContainerId = createMediaResponse.id;
                                } else {
                                    // Multiple image/video upload
                                    const mediaCarouselItems = allImagesVideoArray.map((records, index) => ({
                                        'url': AI_SOCIAL_IMAGES_URL + records['name'],
                                        'caption': 'Image/video ' + index
                                    }));
                                    mediaContainerId = await createInstagramMediaCarousel(longLivedAccessToken, mediaCarouselItems, instagramCaption);
                                }

                                // Publish media to Instagram
                                const publishMediaResponse = await publishInstagramMedia(longLivedAccessToken, mediaContainerId);

                                // Insert logs for table
                                insertLogs['status'] = STATUS_SUCCESS;
                                insertLogs['media_container_id'] = mediaContainerId;
                                insertLogs['publish_media_id'] = (publishMediaResponse && publishMediaResponse.id) ? publishMediaResponse.id : "";
                                insertLogs['publish_media_response'] = publishMediaResponse;
                                await insertInstagramLogs(req, res, insertLogs);

                                // Update schedule and sent flags in parallel
                                await Promise.all([
                                    calendarSchedulePost.updateOne(
                                        { "ai_campaign_chat_id": aiCampaignChatId, "ai_campaign_parent_id": aiCampaignParentId },
                                        { $set: { "instagram_schedule": true, "instagram_schedule_created": getUtcDate() } }
                                    ),
                                    tableAiCampaignChat.updateOne(
                                        { "_id": aiCampaignChatId },
                                        { $set: { "sent_ig": true, "sent_created": getUtcDate(), "sent_ig_created": getUtcDate() } }
                                    )
                                ]);
                            } catch (errorInside) {
                                // Insert error logs
                                insertLogs['status'] = STATUS_ERROR;
                                insertLogs['error'] = errorInside.response ? errorInside.response.data : errorInside.message;
                                await insertInstagramLogs(req, res, insertLogs);
                                console.error('Error getting access IG token:', errorInside.response ? errorInside.response.data : errorInside.message);
                            }
                        })());
                    }

                    // Facebook publishing
                    if (allFacebookImagesVideoArray.length > 0 && facebookPageId && facebookEnable) {
                        publishPromises.push((async () => {
                            let facebookLogsOptions = {
                                'user_id': userId,
                                'ai_campaign_parent_id': aiCampaignParentId,
                                'image_url': allFacebookImagesVideoArray,
                                'title': title,
                                'caption': caption,
                                'facebook_page_id': facebookPageId,
                                'facebook_page_access_token': facebookPageAccessToken,
                                'unique_key': uniqueKey,
                                'ai_campaign_chat_id': aiCampaignChatId,
                                'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            };

                            try {
                                // Publish media to Facebook
                                const postFacebookResponse = await postMediaToFacebook(
                                    facebookPageId,
                                    facebookPageAccessToken,
                                    allFacebookImagesVideoArray,
                                    caption
                                );

                                if (postFacebookResponse.success) {
                                    facebookLogsOptions['status'] = STATUS_SUCCESS;
                                    facebookLogsOptions['post_facebook_response'] = postFacebookResponse;
                                    facebookLogsOptions['facebook_published_id'] = postFacebookResponse.data.id;

                                    // Insert facebook logs and update schedule/sent flags in parallel
                                    await Promise.all([
                                        saveFacebookLogs(req, res, facebookLogsOptions),
                                        calendarSchedulePost.updateOne(
                                            { "ai_campaign_chat_id": aiCampaignChatId, "ai_campaign_parent_id": aiCampaignParentId },
                                            { $set: { "facebook_schedule": true, "facebook_schedule_created": getUtcDate() } }
                                        ),
                                        tableAiCampaignChat.updateOne(
                                            { "_id": aiCampaignChatId },
                                            { $set: { "sent_fb": true, "sent_created": getUtcDate(), "sent_fb_created": getUtcDate() } }
                                        )
                                    ]);
                                } else {
                                    facebookLogsOptions['status'] = STATUS_ERROR;
                                    facebookLogsOptions['post_facebook_response'] = postFacebookResponse;
                                    facebookLogsOptions['facebook_published_id'] = "";
                                    facebookLogsOptions['error'] = postFacebookResponse;
                                    await saveFacebookLogs(req, res, facebookLogsOptions);
                                }
                            } catch (error) {
                                facebookLogsOptions['status'] = STATUS_ERROR;
                                facebookLogsOptions['post_facebook_response'] = {};
                                facebookLogsOptions['facebook_published_id'] = "";
                                facebookLogsOptions['error'] = error;
                                await saveFacebookLogs(req, res, facebookLogsOptions);
                                console.error('Error facebook:', error);
                            }
                        })());
                    }

                    // Wait for all publishing (Instagram/Facebook) to complete
                    await Promise.all(publishPromises);

                    return resolve();
                } catch (err) {
                    // Log and resolve on any error
                    console.error("Error in scheduled job for instagramScheduleForSocialPost:", err);
                    return resolve();
                }
            });
        } catch (error) {
            // Log and resolve on any error
            console.error("Error in instagramScheduleForSocialPost:", error);
            return resolve();
        }
    });
}; // End instagramScheduleForSocialPost()


/**
 * Schedules an Instagram (and optionally Facebook) story post using async/await for all DB queries.
 * All queries are run in parallel where possible for faster response times and clean formatting.
 */
instagramScheduleForSocialStories = async (req, res, scheduleOptions) => {
    return new Promise(async (resolve) => {
        const defaultTimezone = req.body.default_timezone || DEFAULT_TIME_ZONE;
        const userId = scheduleOptions.user_id ? newObjectIdDefault(scheduleOptions.user_id) : "";
        const aiCampaignChatId = scheduleOptions.ai_campaign_chat_id ? newObjectIdDefault(scheduleOptions.ai_campaign_chat_id) : "";
        const dateTimeString = scheduleOptions.schedule_date || "";
        const scheduleInsertedId = scheduleOptions.schedule_inserted_id || "";

        const instagramEnable = scheduleOptions.instagram_enable ? JSON.parse(scheduleOptions.instagram_enable) : false;
        const facebookEnable = scheduleOptions.facebook_enable ? JSON.parse(scheduleOptions.facebook_enable) : false;

        try {
            // Convert date for moment js for timezone
            const scheduleDate = momentTimezone.tz(dateTimeString, defaultTimezone).toDate();

            schedule.scheduleJob(scheduleDate, async function () {
                try {
                    // Get collections
                    const users = db.collection(TABLE_USERS);
                    const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
                    const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

                    // Fetch user schedule and user details in parallel
                    const [userSchedule, usersToData] = await Promise.all([
                        calendarSchedulePost.findOne({ '_id': scheduleInsertedId }),
                        users.findOne({ '_id': userId, 'long_lived_access_token': { $exists: true } })
                    ]);

                    if (!userSchedule || !usersToData) {
                        return resolve();
                    }

                    const longLivedAccessToken = usersToData.long_lived_access_token || "";
                    const facebookPageId = usersToData.facebook_page_id || "";
                    const facebookPageAccessToken = usersToData.facebook_page_access_token || "";

                    if (!(longLivedAccessToken || facebookPageId)) {
                        return resolve();
                    }

                    // Fetch campaign chat details
                    const campaignChatDetails = await tableAiCampaignChat.findOne({ '_id': aiCampaignChatId, 'user_id': userId });
                    if (!campaignChatDetails) {
                        return resolve();
                    }

                    // Extract content data
                    const contentData = campaignChatDetails.content || {};
                    const uniqueKey = campaignChatDetails.unique_key || "";
                    const aiCampaignParentId = campaignChatDetails.ai_campaign_parent_id || "";
                    const allImagesVideoArray = contentData.image || [];
                    const caption = contentData.captions || "";
                    const title = contentData.title || "";

                    if (allImagesVideoArray.length === 0) {
                        return resolve();
                    }

                    // Prepare logs object for Instagram
                    let insertLogs = {
                        'user_id': userId,
                        'ai_campaign_parent_id': aiCampaignParentId,
                        'image_url': allImagesVideoArray,
                        'caption': caption,
                        'unique_key': uniqueKey,
                        'ai_campaign_chat_id': aiCampaignChatId,
                        'long_lived_access_token': longLivedAccessToken,
                        'type': AI_RESPONSE_TYPE_SOCIAL_STORY,
                    };

                    // Prepare promises for Instagram and Facebook publishing
                    const publishPromises = [];

                    // Instagram Story publishing
                    if (longLivedAccessToken && instagramEnable) {
                        // Publish each image/video in series for Instagram Stories
                        for (const imagesVideoRecords of allImagesVideoArray) {
                            try {
                                const mediaUrl = imagesVideoRecords['name'] ? AI_SOCIAL_IMAGES_URL + imagesVideoRecords['name'] : "";

                                // Step 1: Create a media container
                                const createMediaResponse = await createSingelInstagramStoriesMedia(longLivedAccessToken, mediaUrl, caption);
                                const mediaContainerId = createMediaResponse.id;

                                // Step 2: Publish media to Instagram Story
                                const publishMediaResponse = await publishInstagramMedia(longLivedAccessToken, mediaContainerId);

                                // Step 3: Insert logs for table
                                insertLogs['media_container_id'] = mediaContainerId;
                                insertLogs['publish_media_id'] = (publishMediaResponse && publishMediaResponse.id) ? publishMediaResponse.id : "";
                                insertLogs['publish_media_response'] = publishMediaResponse;
                                await insertInstagramLogs(req, res, insertLogs);
                            } catch (err) {
                                console.error('Error publishing Instagram Story:', err?.response?.data || err?.message || err);
                            }
                        }

                        // Update schedule and sent flags for Instagram
                        publishPromises.push(
                            calendarSchedulePost.updateOne(
                                { "ai_campaign_chat_id": aiCampaignChatId, "ai_campaign_parent_id": aiCampaignParentId },
                                { $set: { "instagram_schedule": true, "instagram_schedule_created": getUtcDate() } }
                            ),
                            tableAiCampaignChat.updateOne(
                                { "_id": aiCampaignChatId },
                                { $set: { "sent_ig": true, "sent_created": getUtcDate(), "sent_ig_created": getUtcDate() } }
                            )
                        );
                    }

                    // Facebook Story publishing
                    if (facebookPageId && facebookEnable) {
                        const facebookStoryOptions = {
                            'user_id': userId,
                            'unique_key': uniqueKey,
                            'facebook_page_id': facebookPageId,
                            'facebook_page_access_token': facebookPageAccessToken,
                            'media_files': allImagesVideoArray,
                            'caption': title,
                            'ai_campaign_parent_id': aiCampaignParentId,
                            'ai_campaign_chat_id': aiCampaignChatId,
                        };
                        try {
                            const resposeFbStories = await postMediaToFacebookStory(req, res, facebookStoryOptions);
                            if (resposeFbStories.status === STATUS_SUCCESS) {
                                // Update schedule and sent flags for Facebook
                                publishPromises.push(
                                    calendarSchedulePost.updateOne(
                                        { "ai_campaign_chat_id": aiCampaignChatId, "ai_campaign_parent_id": aiCampaignParentId },
                                        { $set: { "facebook_schedule": true, "facebook_schedule_created": getUtcDate() } }
                                    ),
                                    tableAiCampaignChat.updateOne(
                                        { "_id": aiCampaignChatId },
                                        { $set: { "sent_fb": true, "sent_created": getUtcDate(), "sent_fb_created": getUtcDate() } }
                                    )
                                );
                            }
                        } catch (err) {
                            console.error('Error publishing Facebook Story:', err?.response?.data || err?.message || err);
                        }
                    }

                    // Wait for all update queries to complete in parallel
                    if (publishPromises.length > 0) {
                        await Promise.all(publishPromises);
                    }

                    return resolve();
                } catch (errorInside) {
                    console.error('Error in scheduled job for instagramScheduleForSocialStories:', errorInside?.response?.data || errorInside?.message || errorInside);
                    return resolve();
                }
            });
        } catch (error) {
            console.error('Error in instagramScheduleForSocialStories:', error?.response?.data || error?.message || error);
            return resolve();
        }
    });
}; // End instagramScheduleForSocialStories()

/**
 * Function to reschedule social posts that missed their schedule or on server start.
 * Uses async/await for all DB queries and processes each schedule in series for reliability.
 */
instagramReScheduleForSocialPost = async (req, res) => {
    return new Promise(async (resolve) => {
        try {
            const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

            // Find all scheduled posts that are due in the future and not yet scheduled for Instagram
            const resultScheduleData = await calendarSchedulePost.find({
                'schedule_date': { $gte: new Date() },
                "type": AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                // 'instagram_schedule': { $exists: false }
            }).toArray();

            if (resultScheduleData && resultScheduleData.length > 0) {
                // Process each scheduled post in series using for...of and await
                for (const record of resultScheduleData) {
                    try {
                        // Extract schedule details
                        const scheduleInsertedId = record?._id || "";
                        const aiCampaignChatId = record?.ai_campaign_chat_id || "";
                        const scheduleDate = record?.schedule_date || "";
                        const userId = record?.user_id || "";
                        const instagramEnable = record?.instagram_enable || false;
                        const facebookEnable = record?.facebook_enable || false;
                        const currentTimeZone = record?.current_time_zone || "";

                        // Set timezone in request body for downstream functions
                        req.body.default_timezone = currentTimeZone;

                        // Prepare options for scheduling
                        const scheduleOptions = {
                            'user_id': userId,
                            'ai_campaign_chat_id': aiCampaignChatId,
                            'schedule_date': scheduleDate,
                            'instagram_enable': instagramEnable,
                            'facebook_enable': facebookEnable,
                            'schedule_inserted_id': scheduleInsertedId,
                        };

                        // Await the scheduling function for each record (series)
                        await instagramScheduleForSocialPost(req, res, scheduleOptions);
                    } catch (err) {
                        // Log error but continue with next record
                        console.error('Error in instagramReScheduleForSocialPost (record):', err?.response?.data || err?.message || err);
                    }
                }
            }
            // Resolve after all records processed or if none found
            return resolve();
        } catch (error) {
            // Log error and resolve to prevent hanging
            console.error('Error in instagramReScheduleForSocialPost:', error?.response?.data || error?.message || error);
            return resolve();
        }
    });
}; // End instagramReScheduleForSocialPost()

/**
 * Inserts a new scheduled post into the calendar with UTC date and triggers the appropriate scheduling function.
 * Schedule date format: 2024-11-30 02:15
 * Uses async/await for all DB queries for faster response times and clean formatting.
 */
schedulePostInsertData = async (req, res, allOptionData) => {
    return new Promise(async (resolve) => {
        try {
            // Extract and prepare all required fields from allOptionData
            const titleName = allOptionData?.title_name || "";
            const scheduleDate = allOptionData?.schedule_date || "";
            const userId = allOptionData?.user_id ? newObjectIdDefault(allOptionData.user_id) : "";
            const type = allOptionData?.type || "";
            const uniqueKey = allOptionData?.unique_key || "";
            const aiCampaignParentId = allOptionData?.ai_campaign_parent_id ? newObjectIdDefault(allOptionData.ai_campaign_parent_id) : "";
            const aiCampaignChatId = allOptionData?.ai_campaign_chat_id ? newObjectIdDefault(allOptionData.ai_campaign_chat_id) : "";
            const currentTimezone = req.body.default_timezone || "";

            // Email template fields (if present)
            const emailTemplateId = allOptionData?.email_template_id ? newObjectIdDefault(allOptionData.email_template_id) : "";
            const emailTemplateAction = allOptionData?.email_template_action || "";

            // Instagram/Facebook enable flags
            const instagramEnable = allOptionData?.instagram_enable ? JSON.parse(allOptionData.instagram_enable) : false;
            const facebookEnable = allOptionData?.facebook_enable ? JSON.parse(allOptionData.facebook_enable) : false;

            // Facebook page info
            const facebookPageId = allOptionData?.facebook_page_id || "";
            const facebookPageAccessToken = allOptionData?.facebook_page_access_token || "";

            // Generate slug for the post (async)
            const slugOptions = {
                title: titleName,
                table_name: TABLE_CALENDAR_SCHEDULE_POST,
                slug_field: "slug",
            };
            const slugResponse = await getDatabaseSlug(slugOptions);

            // Prepare schedule data for insertion
            const scheduleData = {
                'title_name': titleName,
                'schedule_date': getUtcDateTimezone(scheduleDate, currentTimezone),
                'user_id': userId,
                'unique_key': uniqueKey,
                'slug': slugResponse?.title || "",
                'ai_campaign_parent_id': aiCampaignParentId,
                'ai_campaign_chat_id': aiCampaignChatId,
                'type': type,
                'email_template_id': emailTemplateId,
                'email_template_action': emailTemplateAction,
                'current_time_zone': currentTimezone,
                'instagram_enable': instagramEnable,
                'facebook_enable': facebookEnable,
                'facebook_page_id': facebookPageId,
                'facebook_page_access_token': facebookPageAccessToken,
                'created': getUtcDate(),
                'modified': getUtcDate(),
            };

            // Insert the schedule data into the calendar collection (async/await)
            const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);
            const insertResult = await calendarSchedulePost.insertOne(scheduleData);
            const scheduleInsertedId = insertResult?.insertedId || "";

            // Prepare options for scheduling function
            const scheduleOptions = {
                'user_id': userId,
                'ai_campaign_chat_id': aiCampaignChatId,
                'schedule_date': getUtcDateTimezone(scheduleDate, currentTimezone),
                'instagram_enable': instagramEnable,
                'facebook_enable': facebookEnable,
                'schedule_inserted_id': scheduleInsertedId,
            };

            // Call the appropriate scheduling function based on type
            if (type === AI_RESPONSE_TYPE_SOCIAL_STORY) {
                // Schedule Instagram/Facebook Story post
                await instagramScheduleForSocialStories(req, res, scheduleOptions);
            } else {
                // Schedule Instagram/Facebook regular post
                await instagramScheduleForSocialPost(req, res, scheduleOptions);
            }

            return resolve();
        } catch (error) {
            // Log error and resolve to avoid unhandled promise rejection
            console.error('Error in schedulePostInsertData:', error?.response?.data || error?.message || error);
            return resolve();
        }
    });
}; // End schedulePostInsertData()

/** Function to get the current date and increment it by the specified number of days */
getDateWithSchedule = (daysToAdd, time) => {
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + daysToAdd);
    const formattedDate = `${currentDate.toISOString().split('T')[0]} ${time}`;
    return formattedDate;
} //End getDateWithSchedule();

/**
 * Function for used to single image/video media create
 * @param {*} accessToken 
 * @param {*} mediaUrl 
 * @param {*} caption 
 * @returns 
 */
createSingelInstagramMedia = async (accessToken, mediaUrl, caption) => {
    const isVideo = mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov');
    const mediaType = isVideo ? 'video_url' : 'image_url';

    try {
        const payload = {
            [mediaType]: mediaUrl,
            caption,
            access_token: accessToken,
            media_type: isVideo ? 'REELS' : 'IMAGE',
        };

        const response = await axios.post(
            'https://graph.instagram.com/me/media',
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error creating media container for ${mediaUrl}: ${error.response?.data?.error?.message || error.message}`);
        throw error;
    }
} //End createSingelInstagramMedia();

/**
 * Funciton for used to create Instagram Media Carousel
 * @param {*} accessToken 
 * @param {*} mediaItems 
 * @returns 
 */
createInstagramMediaCarousel = async (accessToken, mediaItems, caption) => {
    try {
        const childMediaIds = [];

        for (const item of mediaItems) {
            const isVideo = item.url.endsWith('.mp4') || item.url.endsWith('.mov');
            const mediaType = isVideo ? 'video_url' : 'image_url';

            const payload = {
                [mediaType]: item.url,
                is_carousel_item: true,
                access_token: accessToken,
                media_type: isVideo ? 'REELS' : 'IMAGE',
            }

            const response = await axios.post(
                'https://graph.instagram.com/me/media',
                payload,
                { headers: { 'Content-Type': 'application/json' } }
            );

            const mediaId = response.data.id;

            if (isVideo) {
                const isProcessed = await waitForVideoProcessing(accessToken, mediaId);
                if (!isProcessed) {
                    throw new Error(`Video processing failed for media Id: ${mediaId}`);
                }
            }
            childMediaIds.push(mediaId);
        }

        const carouselPayload = {
            media_type: 'CAROUSEL',
            children: childMediaIds,
            caption: caption,
            access_token: accessToken,
        };

        const carouselResponse = await axios.post(
            'https://graph.instagram.com/me/media',
            carouselPayload,
            { headers: { 'Content-Type': 'application/json' } }
        );

        return carouselResponse.data.id

    } catch (error) {
        console.error('Error creating carousel media: ', error.response?.data?.error?.message || error.message);
        throw error;
    }
} //End createInstagramMediaCarousel();

/**
 * Function for use to publish media for instagram
 * @param {*} accessToken 
 * @param {*} mediaId 
 * @returns 
 */
publishInstagramMedia = async (accessToken, mediaId) => {
    let attempt = 0;
    while (true) {
        try {
            await new Promise(resolve => setTimeout(resolve, instagramDelay));

            const response = await axios.post(
                'https://graph.instagram.com/me/media_publish',
                {
                    creation_id: mediaId,
                    access_token: accessToken,
                },
                { headers: { 'Content-Type': 'application/json' } }
            );
            return response.data;
        } catch (error) {
            if (error.response?.data?.error?.code === 9007) {
                attempt++;
                if (attempt >= instagramMaxRetries) {
                    throw new Error(`Media not published in max limit retires attempts ${instagramMaxRetries}.`)
                }
            } else {
                console.error('Error publishing Instagram media:', error.response?.data || error.message);
                throw error;
            }
        }
    }
} //End publishInstagramMedia();

/**
 * Function for used to ony by one stories upload
 * @param {*} accessToken 
 * @param {*} mediaUrl 
 * @param {*} caption 
 * @returns 
 */
createSingelInstagramStoriesMedia = async (accessToken, mediaUrl, caption) => {
    const isVideo = mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.mov');
    const mediaType = isVideo ? 'video_url' : 'image_url';
    try {
        const payload = {
            [mediaType]: mediaUrl,
            caption,
            access_token: accessToken,
            media_type: 'STORIES',
        };

        const response = await axios.post(
            'https://graph.instagram.com/me/media',
            payload,
            { headers: { 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        console.error(`Error creating media container for ${mediaUrl}: ${error.response?.data?.error?.message || error.message}`);
        return error.response?.data?.error?.message || error.message;
        // throw error;
    }
} //End createSingelInstagramStoriesMedia();

/**
 * Fetch media Insights for analytics 
 * @param {*} mediaId 
 * @param {*} accessToken 
 * @returns 
 */
fetchSocialMediaInsights = async (mediaId, accessToken) => {
    try {
        const metrics = 'impressions,reach,likes,comments,saved,shares,total_interactions,profile_visits,follows';

        const response = await axios.get(
            `https://graph.instagram.com/${mediaId}/insights`,
            {
                params: {
                    metric: metrics,
                    access_token: accessToken,
                },
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching media insights:', error.response?.data || error.message);
        throw error;
    }
} //End fetchSocialMediaInsights();

/**
 * Inserts a new log entry into the Facebook logs collection using async/await for faster response times.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Object} insertObject - The log entry to be inserted.
 * @returns {Promise<void>} A promise that resolves when the log entry has been inserted.
 */
saveFacebookLogs = async (req, res, insertObject) => {
    try {
        const facebooklogs = db.collection(TABLE_FACEBOOK_LOGS);
        insertObject['created'] = getUtcDate();

        // Insert the log entry asynchronously
        await facebooklogs.insertOne(insertObject);

        // Successfully inserted, resolve the promise
        return;
    } catch (error) {
        // Log error for debugging
        console.error("Error in saveFacebookLogs:", error);
        // Still resolve to avoid unhandled promise rejection
        return;
    }
}; // End saveFacebookLogs()

/**
* Function for used to post media to facebook upload
*/
postMediaToFacebook = async (pageId, pageAccessToken, mediaFiles, caption) => {
    let mediaIds = [];

    for (const { name, extension } of mediaFiles) {

        /**Dynamic */
        const fileUrl = AI_SOCIAL_IMAGES_URL + name;

        try {
            let response;

            if (mediaFiles.length == 1 && (extension === "mp4" || extension === "mov")) {
                /**Step 1: Upload Video */
                response = await axios.post(`https://graph.facebook.com/v22.0/${pageId}/videos`, {
                    file_url: fileUrl,
                    published: true,
                    access_token: pageAccessToken,
                    caption: caption,
                });
                const mediaId = response.data.id;

                /**Step 2: Fetch post_id using mediaId */
                const postResponse = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}?fields=post_id&access_token=${pageAccessToken}`);
                let postId = postResponse.data.post_id || null;

                /** Step 3: Generate Correct Publish ID */
                let publishId = postId ? `${pageId}_${postId}` : mediaId;

                /**Return success message */
                return {
                    'success': true,
                    'data': {
                        "id": publishId,
                        "post_supports_client_mutation_id": true
                    },
                    'media_ids': mediaId
                };
            } else if (mediaFiles.length > 1 && (extension === "mp4" || extension === "mov")) {
                response = response;
            } else {
                response = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
                    url: fileUrl,
                    published: false,
                    access_token: pageAccessToken,
                });
            }

            if (response && response.data && response.data.id) {
                mediaIds.push({ media_fbid: response.data.id });
            }

        } catch (error) {
            console.error("Error uploading media:", error.response?.data || error.message);
            return {
                'success': false,
                'error': error.response?.data || error.message
            };
        }
    }

    if (mediaIds.length > 0) {
        try {
            /**Function for used to facebook upload media */
            const postResponse = await axios.post(`https://graph.facebook.com/v22.0/${pageId}/feed`, {
                attached_media: mediaIds,
                message: caption,
                access_token: pageAccessToken,
            });

            /**Return success message */
            return {
                'success': true,
                'data': postResponse.data,
                'media_ids': mediaIds
            };
        } catch (error) {
            /**Return error message */
            console.error("Error creating album post:", error.response?.data || error.message);
            return {
                'success': false,
                'media_ids': [],
                'error': error.response?.data || error.message
            };
        }
    }
} //End postMediaToFacebook();

/**
 * Refreshes the Instagram long-lived access token and updates the user record.
 * Uses async/await for all DB queries for faster response times and clean formatting.
 * 
 * @param {string} currentToken - The current long-lived access token.
 * @param {string} userId - The user ID whose token is to be refreshed.
 * @returns {Promise<string|undefined>} The new access token if refreshed, otherwise undefined.
 */
refreshLongLivedToken = async (currentToken, userId) => {
    try {
        if (!currentToken || !userId) {
            // Invalid input, return early
            return;
        }

        // API endpoint for refreshing the token
        const url = "https://graph.instagram.com/refresh_access_token";

        // Instagram API call to refresh the token
        const response = await axios.get(url, {
            params: {
                grant_type: "ig_refresh_token",
                access_token: currentToken,
            },
        });

        if (response && response.data && response.data.access_token) {
            // Update the user's long-lived access token in the database using async/await
            const users = db.collection(TABLE_USERS);
            await users.updateOne(
                { '_id': newObjectIdDefault(userId) },
                {
                    $set: {
                        'long_lived_access_token': response.data.access_token,
                        'instagram_modified': getUtcDate()
                    }
                }
            );
            // Return the new access token
            return response.data.access_token;
        }
        // If no response data, return undefined
        return;
    } catch (error) {
        // Log error for debugging
        console.error("Error refreshing token:", error.response?.data || error.message);
        return;
    }
}; // End refreshLongLivedToken()

/**
 * Converts a video for Instagram using FFmpeg and optionally uploads to S3.
 * Uses async/await for all file and S3 operations for faster response times and clean formatting.
 * 
 * @param {Object} options - Options for conversion.
 * @param {string} options.videoURL - The input video file path or URL.
 * @param {string} options.outputPath - The output file path for the converted video.
 * @param {string} options.targetFolder - The S3 target folder/key for upload.
 * @returns {Promise<void>} Resolves when processing (and upload, if enabled) is complete.
 */
convertVideoToFFmpegForInstagram = async (options) => {
    const { videoURL, outputPath, targetFolder } = options;
    const fileExtension = path.extname(targetFolder).toLowerCase();

    // Ensure the target folder exists
    const directory = path.dirname(outputPath);
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    // Properly formatted FFmpeg command for Instagram Story
    const ffmpegCommand = `ffmpeg -i "${videoURL}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset slow -crf 23 -r 30 -maxrate 3500k -bufsize 7000k -c:a aac -b:a 128k -ac 2 -ar 44100 -movflags +faststart "${outputPath}"`;

    // Execute FFmpeg command (sync, but wrapped in async function for consistency)
    const execResult = shell.exec(ffmpegCommand, { silent: true });

    // Error handling for FFmpeg process
    if (execResult.code !== 0) {
        console.error("FFmpeg Error:", execResult.stderr);
        return;
    }

    // If S3 upload is enabled, upload the file asynchronously
    if (UPLOAD_TO_S3) {
        try {
            // Read the output file as a stream
            const fileStream = fs.createReadStream(outputPath);

            // S3 Upload Parameters
            const uploadParams = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: S3_BUCKET_UPLOAD_PATH + targetFolder,
                Body: fileStream,
                ContentType: (fileExtension === '.mov') ? 'video/quicktime' : 'video/mp4'
            };

            // Upload to S3 using async/await
            await s3.upload(uploadParams).promise();

            // Remove the local file after successful upload
            fs.unlinkSync(outputPath);
        } catch (err) {
            console.error("S3 Upload Error:", err);
        }
    }
    // If not uploading to S3, simply resolve after FFmpeg processing
    return;
}; // End convertVideoToFFmpegForInstagram()

/**
 * Function used for video upload processing after some waiting
 * @param {*} accessToken 
 * @param {*} mediaId 
 * @returns 
 */
waitForVideoProcessing = async (accessToken, mediaId) => {
    for (let attempt = 1; attempt <= instagramMaxRetries; attempt++) {
        try {
            const response = await axios.get(
                `https://graph.instagram.com/${mediaId}`,
                { params: { fields: 'status_code', access_token: accessToken } }
            );

            const { status_code } = response.data;

            if (status_code === 'FINISHED') {
                return true;
            } else if (status_code === 'ERROR') {
                console.error(`Video processing failed for media ID: ${mediaId}`);
                return false;
            }
        } catch (error) {
            console.error(`Error checking video status for media ID ${mediaId}:`, error.message);
        }

        await new Promise(resolve => setTimeout(resolve, instagramDelay));
    }
    console.error(`Video processing timed out for media ID: ${mediaId}`);
    return false;
} //End waitForVideoProcessing();


/**
 * Resizes an image for social post upload, saves locally, and optionally uploads to S3.
 * Uses async/await for all file and S3 operations for faster response times and clean formatting.
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} optiondata 
 * @returns {Promise<void>}
 */
resizeImageForSocialPostImage = async (req, res, optiondata) => {
    try {
        // Extract image and options
        const imageBufferReqfiles = optiondata.image;
        const imageBufferData = imageBufferReqfiles.data;
        const outTrimMimetype = imageBufferReqfiles.mimetype || "";
        const imageName = optiondata.image_name;
        const socialType = optiondata.type || "";
        const fullUploadPath = AI_SOCIAL_IMAGES_FILE_PATH + imageName;
        const withoutCrop = optiondata.without_crop || false;

        // Ensure the directory exists
        const directoryPath = path.dirname(fullUploadPath);
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        // Set default resize dimensions
        let minimumWidth = DEFAULT_INSTAGRAM_WIDTH;
        let maximumHeight = DEFAULT_INSTAGRAM_HEIGHT;
        if (socialType === AI_RESPONSE_TYPE_SOCIAL_STORY) {
            maximumHeight = 1920;
        }

        // Get image metadata
        const metadata = await sharp(imageBufferData).metadata();

        // Adjust dimensions based on image size
        if (metadata.width >= minimumWidth && metadata.height >= maximumHeight) {
            minimumWidth = metadata.width;
            maximumHeight = metadata.height;
        }

        // If withoutCrop is true, use default dimensions
        if (withoutCrop === true) {
            minimumWidth = DEFAULT_INSTAGRAM_WIDTH;
            maximumHeight = DEFAULT_INSTAGRAM_HEIGHT;
        }

        // Resize and save the image locally using async/await
        await sharp(imageBufferData).resize(minimumWidth, maximumHeight, {
            fit: sharp.fit.cover,
            withoutEnlargement: false
        }).withMetadata().toFile(fullUploadPath);

        // If UPLOAD_TO_S3 is enabled, upload the image to S3
        if (UPLOAD_TO_S3) {
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: S3_BUCKET_UPLOAD_PATH + 'ai_social_images/' + imageName,
                Body: fs.createReadStream(fullUploadPath),
                ContentType: outTrimMimetype,
            };

            // Upload to S3 using async/await
            await s3.upload(params).promise();

            // Remove the local file after successful upload
            await removeFileOnlyLocalFolder({ file_path: fullUploadPath });
        }

        // All done
        return;
    } catch (err) {
        // Log error for debugging
        console.error("Error in resizeImageForSocialPostImage:", err);
        return;
    }
}; // End resizeImageForSocialPostImage()


/**
 * Posts media to Facebook Story using async/await for all API and DB queries.
 * All uploads are run in parallel for faster response times.
 * 
 * @param {*} req - Request object
 * @param {*} res - Response object
 * @param {*} optionsFacebookStory - Options for Facebook Story post
 * @returns {Promise<Object>} Result object with status and message
 */
postMediaToFacebookStory = async (req, res, optionsFacebookStory) => {
    // Extract and validate required parameters
    const pageId = optionsFacebookStory.facebook_page_id || "";
    const pageAccessToken = optionsFacebookStory.facebook_page_access_token || "";
    const mediaFiles = optionsFacebookStory.media_files || [];
    const caption = optionsFacebookStory.caption || "";
    const uniqueKey = optionsFacebookStory.unique_key || "";
    const userId = optionsFacebookStory.user_id ? newObjectIdDefault(optionsFacebookStory.user_id) : "";
    const aiCampaignParentId = optionsFacebookStory.ai_campaign_parent_id ? newObjectIdDefault(optionsFacebookStory.ai_campaign_parent_id) : "";
    const aiCampaignChatId = optionsFacebookStory.ai_campaign_chat_id ? newObjectIdDefault(optionsFacebookStory.ai_campaign_chat_id) : "";

    // Validate all required parameters before proceeding
    if (!(pageId && pageAccessToken && mediaFiles.length > 0 && caption && userId && aiCampaignParentId && aiCampaignChatId)) {
        return { status: "error", message: "Parameter not founds." };
    }

    // Prepare base log options for Facebook logs
    const facebookLogsOptionsBase = {
        user_id: userId,
        ai_campaign_parent_id: aiCampaignParentId,
        image_url: mediaFiles,
        caption: caption,
        facebook_page_id: pageId,
        facebook_page_access_token: pageAccessToken,
        unique_key: uniqueKey,
        ai_campaign_chat_id: aiCampaignChatId,
        type: AI_RESPONSE_TYPE_SOCIAL_STORY,
    };

    // Helper function to handle a single media file upload and story post
    const handleSingleMedia = async (mediaFile) => {
        const { name, extension } = mediaFile;
        const fileUrl = AI_SOCIAL_IMAGES_URL + name;
        let facebookLogsOptions = { ...facebookLogsOptionsBase };
        try {
            // Handle single video file (mp4/mov)
            if (mediaFiles.length === 1 && (extension === "mp4" || extension === "mov")) {
                // Step 1: Start upload session
                const { video_id } = await startUploadSession(pageId, pageAccessToken);

                // Step 2: Upload video from URL
                await uploadVideoFromUrl(pageId, video_id, fileUrl, pageAccessToken);

                // Step 3: Finish upload and publish story
                const result = await finishUpload(pageId, video_id, pageAccessToken);
                const publishId = result.post_id;

                // Insert Facebook logs (success)
                facebookLogsOptions.status = STATUS_SUCCESS;
                facebookLogsOptions.post_facebook_response = {
                    data: {
                        id: publishId,
                        post_supports_client_mutation_id: true
                    },
                    media_ids: video_id
                };
                facebookLogsOptions.facebook_published_id = publishId;

                // Save logs asynchronously
                await saveFacebookLogs(req, res, facebookLogsOptions);

                return { status: STATUS_SUCCESS, video_id, publishId };
            }
            // Handle multiple videos (not supported)
            else if (mediaFiles.length > 1 && (extension === "mp4" || extension === "mov")) {
                // No API call, just return message
                return { status: STATUS_SUCCESS, message: "Multiple videos are not supported." };
            }
            // Handle image file
            else {
                // Step 1: Upload image to Facebook (unpublished)
                const uploadUrl = `https://graph.facebook.com/v22.0/${pageId}/photos`;
                const uploadResponse = await axios.post(uploadUrl, {
                    url: fileUrl,
                    caption: caption,
                    published: false,
                    access_token: pageAccessToken,
                });
                const photoId = uploadResponse.data.id;

                // Step 2: Post the Story using the uploaded photo
                const storyUrl = `https://graph.facebook.com/v22.0/${pageId}/photo_stories`;
                const storyResponse = await axios.post(storyUrl, {
                    photo_id: photoId,
                    access_token: pageAccessToken,
                });
                const publishId = storyResponse.data.post_id;

                // Insert Facebook logs (success)
                facebookLogsOptions.status = STATUS_SUCCESS;
                facebookLogsOptions.post_facebook_response = {
                    data: {
                        id: publishId,
                        post_supports_client_mutation_id: true
                    },
                    media_ids: photoId
                };
                facebookLogsOptions.facebook_published_id = publishId;

                // Save logs asynchronously
                await saveFacebookLogs(req, res, facebookLogsOptions);

                return { status: STATUS_SUCCESS, photoId, publishId };
            }
        } catch (error) {
            // Log error for debugging
            console.error("Error uploading media:", error.response?.data || error.message);

            // Insert Facebook logs (error)
            facebookLogsOptions.status = STATUS_ERROR;
            facebookLogsOptions.post_facebook_response = {};
            facebookLogsOptions.facebook_published_id = "";
            facebookLogsOptions.error = error.response?.data || error.message;

            // Save logs asynchronously
            await saveFacebookLogs(req, res, facebookLogsOptions);

            return { status: STATUS_ERROR, error: error.response?.data || error.message };
        }
    };

    // Run all media uploads in parallel for faster response times
    const results = await Promise.all(mediaFiles.map(handleSingleMedia));

    // Count successes and errors
    const successCount = results.filter(r => r.status === STATUS_SUCCESS).length;
    const errorCount = results.filter(r => r.status === STATUS_ERROR).length;

    // Return summary result
    if (errorCount > 0) {
        return {
            status: STATUS_ERROR,
            message: `${errorCount} stories failed, ${successCount} stories posted successfully.`
        };
    } else {
        return {
            status: STATUS_SUCCESS,
            message: res.__("front.facebook.stories_has_been_published_successfully")
        };
    }
}; // End postMediaToFacebookStory()


/**
 * Function used to start upload session 
 * @param {*} res 
 * @param {*} req 
 *  @param {*} optionsFacebookStory 
 * @returns result
 */
async function startUploadSession(pageId, accessToken) {
    const url = `https://graph.facebook.com/v22.0/${pageId}/video_stories`;
    try {
        const response = await axios.post(url, {
            upload_phase: 'start',
            access_token: accessToken
        });
        return response.data;  // { video_id, upload_url }
    } catch (error) {
        console.error('Error starting upload session:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Function used to upload video from url
 * @param {*} pageId 
 * @param {*} videoId 
 *  @param {*} videoUrl 
 *  @param {*} accessToken 
 * @returns result
 */
async function uploadVideoFromUrl(pageId, videoId, videoUrl, accessToken) {
    const uploadUrl = `https://rupload.facebook.com/video-upload/v22.0/${videoId}`;

    try {
        const response = await axios.post(uploadUrl, null, {
            headers: {
                'Authorization': `OAuth ${accessToken}`,
                'file_url': videoUrl
            }
        });
        return response.data;  // Success response
    } catch (error) {
        console.error('Error uploading video:', error.response?.data || error.message);
        throw error;
    }
}
/**
 * Function used to check uploaded status
 * @param {*} videoId 
 * @param {*} accessToken 
 * @returns result
 */
async function checkUploadStatus(videoId, accessToken) {
    const response = await axios.get(`https://graph.facebook.com/v22.0/${videoId}`, {
        params: {
            fields: 'status',
            access_token: accessToken
        }
    });
    return response.data.status.video_status;
}

/**
 * Function used to wait  for video uploading processing to complete
 * @param {*} videoId 
 * @param {*} accessToken 
 * @returns result
 */
async function waitForProcessing(videoId, accessToken) {
    let status = await checkUploadStatus(videoId, accessToken);
    while (status !== 'finished') {
        //if video upload is complete then wait for a few seconds & check again
        if (status === 'upload_complete') {
            await new Promise(resolve => setTimeout(resolve, 3000));  /** wait for 3 seconds */
        } else {
            await new Promise(resolve => setTimeout(resolve, 5000));  /** wait for 5 seconds */
        }
        status = await checkUploadStatus(videoId, accessToken);
    }
}

/**
 * Function used to finish uploading process
 * @param {*} pageId 
 * @param {*} videoId 
 *  @param {*} accessToken 
 * @returns result
 */
async function finishUpload(pageId, videoId, accessToken) {
    const url = `https://graph.facebook.com/v22.0/${pageId}/video_stories`;
    try {
        const response = await axios.post(url, {
            upload_phase: 'finish',
            video_id: videoId,
            access_token: accessToken
        });
        return response.data;  // { success: true, post_id: "..." }
    } catch (error) {
        console.error('Error finishing upload:', error.response?.data || error.message);
        throw error;
    }
}

/**
 * Function used to refresh facebook token
 * @param {*} pageId 
 * @param {*} userId 
 *  @param {*} facebookLongLivedAccessToken 
 * @returns result
 */
refreshFacebookTokens = async (facebookLongLivedAccessToken, pageId, userId) => {
    try {
        if (!facebookLongLivedAccessToken || !pageId || !userId) {
            console.error("Missing parameters for token refresh.");
            return;
        }
        /** Step 1: Refresh the Facebook long-lived access token */
        let fbUserTokenUrl = "https://graph.facebook.com/v18.0/oauth/access_token";
        let userTokenResponse = await axios.get(fbUserTokenUrl, {
            params: {
                grant_type: "fb_exchange_token",
                client_id: FACEBOOK_APP_ID,
                client_secret: FACEBOOK_CLIENT_SECRET_ID,
                fb_exchange_token: facebookLongLivedAccessToken,
            },
        });

        if (!userTokenResponse.data || !userTokenResponse.data.access_token) {
            console.error("Failed to refresh user token:", userTokenResponse.data);
            return;
        }
        let newLongLivedUserToken = userTokenResponse.data.access_token;

        /** Step 2: Get a new page access token */
        let pageTokenUrl = `https://graph.facebook.com/v18.0/${pageId}`;
        let pageTokenResponse = await axios.get(pageTokenUrl, {
            params: {
                fields: "access_token",
                access_token: newLongLivedUserToken,
            },
        });

        if (!pageTokenResponse.data || !pageTokenResponse.data.access_token) {
            console.error("Failed to retrieve page access token:", pageTokenResponse.data);
            return;
        }
        let newPageAccessToken = pageTokenResponse.data.access_token;

        /** Step 3: Store the updated tokens in the database */
        const users = db.collection("users");
        await users.updateOne({ '_id': newObjectIdDefault(userId) }, {
            $set: {
                'facebook_long_lived_access_token': newLongLivedUserToken,
                'facebook_page_access_token': newPageAccessToken,
                'facebook_modified': getUtcDate()
            }
        });
        return;
    } catch (error) {
        console.error("Error refreshing Facebook tokens:", error.response?.data || error.message);
        return;
    }
}; //end refreshFacebookTokens()

/**
 * Fetches the IDs of used AI campaign chat records for a user and campaign type.
 * Uses async/await for faster response times and clean formatting.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {String} userId - The ID of the user for whom to retrieve scheduled posts.
 * @param {String} campaignType - The campaign type to filter.
 * @returns {Promise<Array>} A promise that resolves with an array of used AI campaign chat IDs.
 */
usedRecordsIds = async (req, res, userId, campaignType) => {
    try {
        // Fetch campaign chat IDs with a schedule date in the past
        const passedCampaignChatId = await schedulePassedIds(req, res, userId);

        // Build the query condition for used records
        const usedCondition = {
            'user_id': userId,
            'is_deleted': NOT_DELETED,
            'is_draft': CAMPAIGN_NOT_DRAFT,
            'type': campaignType,
            'signup_flag': { $ne: true },
            '$or': [
                { 'is_download': true },
                { 'direct_instagram_published': true },
                { 'direct_facebook_published': true },
                {
                    '$and': [
                        { '_id': { $in: passedCampaignChatId } },
                        { 'is_scheduled': true },
                    ]
                }
            ]
        };

        // Get the collection
        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

        // Fetch distinct used record IDs asynchronously
        const usedIds = await tableAiCampaignChat.distinct("_id", usedCondition);

        return usedIds;
    } catch (error) {
        // Log error and return empty array on failure
        console.error("Error in usedRecordsIds:", error);
        return [];
    }
}; // End usedRecordsIds()

/**
 * Function is used to resize Facebook image dimensions.
 * Uses async/await for all file and S3 operations for faster response times and clean formatting.
 * If S3 upload is enabled, local file is uploaded and then removed in parallel.
 */
resizeImageForFacebookPostImage = async (req, res, optiondata) => {
    try {
        // Extract image buffer and metadata
        const imageBufferReqfiles = optiondata.image;
        const imageBufferData = imageBufferReqfiles.data;
        const outTrimMimetype = imageBufferReqfiles.mimetype ? imageBufferReqfiles.mimetype : "";
        const imageName = optiondata.image_name;
        const fullUploadPath = AI_SOCIAL_IMAGES_FILE_PATH + imageName;
        const withoutCrop = optiondata.without_crop ? optiondata.without_crop : false;
        const socialType = optiondata.type ? optiondata.type : "";

        // Get the directory part of the path (excluding the file name)
        const directoryPath = path.dirname(fullUploadPath);

        // Check if the directory exists, and create it if it doesn't
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        // Set default resize dimensions
        let minimumWidth = DEFAULT_FACEBOOK_WIDTH;
        let maximumHeight = DEFAULT_FACEBOOK_HEIGHT;

        // Adjust for Facebook story type
        if (socialType === AI_RESPONSE_TYPE_SOCIAL_STORY) {
            minimumWidth = DEFAULT_FACEBOOK_STORY_AND_VIDEO_WIDTH;
            maximumHeight = DEFAULT_FACEBOOK_STORY_AND_VIDEO_HEIGHT;
        }

        // Get metadata of the image
        const metadata = await sharp(imageBufferData).metadata();

        // Adjust dimensions based on image size
        if (metadata.width >= minimumWidth && metadata.height >= maximumHeight) {
            minimumWidth = metadata.width;
            maximumHeight = metadata.height;
        }

        // Direct select upload without cropping
        if (withoutCrop === true) {
            minimumWidth = DEFAULT_FACEBOOK_WIDTH;
            maximumHeight = DEFAULT_FACEBOOK_HEIGHT;
        }

        // Resize the image and save to local file system
        await sharp(imageBufferData)
            .resize(minimumWidth, maximumHeight, {
                fit: sharp.fit.cover,
                withoutEnlargement: false
            })
            .withMetadata()
            .toFile(fullUploadPath);

        // If S3 upload is enabled, upload the file and remove local copy in parallel
        if (UPLOAD_TO_S3) {
            // Prepare S3 upload parameters
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: S3_BUCKET_UPLOAD_PATH + 'ai_social_images/' + imageName,
                Body: fs.createReadStream(fullUploadPath),
                ContentType: outTrimMimetype,
            };

            // Upload to S3 and remove local file in parallel
            await new Promise((resolve) => {
                s3.upload(params, async (uploadErr, uploadData) => {
                    if (uploadErr) {
                        // Log error and resolve
                        console.error("S3 Upload Error:", uploadErr);
                        return resolve();
                    }
                    // Remove local file after upload
                    try {
                        await removeFileOnlyLocalFolder({ file_path: fullUploadPath });
                    } catch (removeErr) {
                        console.error("Error removing local file after S3 upload:", removeErr);
                    }
                    return resolve();
                });
            });
        }
        // All done
        return;
    } catch (err) {
        // Log error and resolve
        console.error("Error in resizeImageForFacebookPostImage:", err);
        return;
    }
}; // End resizeImageForFacebookPostImage


/***
 * Function for used to Video convert to FFmpeg Process regarding for facebook
 */
convertVideoToFFmpegForFacebook = (options) => {
    return new Promise(async resolve => {
        const { videoURL, outputPath, targetFolder } = options;

        const fileExtension = path.extname(targetFolder).toLowerCase();

        /**Ensure the target folder exists*/
        const directory = path.dirname(outputPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        /** Properly formatted FFmpeg command Story*/
        const ffmpegCommand = `ffmpeg -i "${videoURL}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1" -c:v libx264 -preset slow -crf 23 -r 30 -maxrate 3500k -bufsize 7000k -c:a aac -b:a 128k -ac 2 -ar 44100 -movflags +faststart "${outputPath}"`;

        /**Execute FFmpeg command*/
        const execResult = shell.exec(ffmpegCommand, { silent: true });

        /** Error Handling*/
        if (execResult.code !== 0) {
            console.error("FFmpeg Error:", execResult.stderr);
            return resolve()
        } else {

            /**
             * function for use to S3 aws upload file
             * */
            if (UPLOAD_TO_S3) {
                /**Read the output file */
                const fileStream = fs.createReadStream(outputPath);

                /** S3 Upload Parameters */
                const uploadParams = {
                    'Bucket': process.env.AWS_BUCKET_NAME,
                    'Key': S3_BUCKET_UPLOAD_PATH + targetFolder,
                    'Body': fileStream,
                    'ContentType': (fileExtension == '.mov') ? 'video/quicktime' : 'video/mp4'
                };

                /** Upload to S3 */
                s3.upload(uploadParams, (err, data) => {
                    if (err) {
                        console.error("S3 Upload Error:", err);
                    } else {
                        fs.unlinkSync(outputPath);
                    }
                    return resolve()
                });
            } else {
                return resolve()
            }
        }
    });
} //End convertVideoToFFmpegForFacebook();

/**helper function to promisify request*/
makeInstagramRequest = (options) => {
    return new Promise((resolve, reject) => {
        request(options, (error, response) => {
            if (error) return reject(error);
            try {
                const result = JSON.parse(response.body);
                resolve(result);
            } catch (e) {
                reject(new Error("Invalid JSON response"));
            }
        });
    });
}


/**
 * Function is used to track social login
 * Uses async/await for database operations.
 * @param {*} req - Express request object
 * @param {*} res - Express response object
 * @param {*} options - Options containing social login data
 * @returns {Promise<Object>} - Result of the insert operation
 */
socialLoginTracking = async (req, res, options) => {
    // Prepare data for insertion
    const userId = options.user_id ? ObjectId(options.user_id) : "";
    const socialLoginType = options.social_login_type || "";
    const socialLoginToken = options.social_login_token || "";
    const socialLoginRefreshToken = options.social_login_refresh_token || "";
    const updateData = options.update_data || "";
    const error = options.error || "";
    const refreshToken = options.refresh_token || false;
    const pageUpdateOptions = options.page_update_options || "";
    const requestBody = req && req.body ? req.body : "";

    // Get the collection reference
    const socialLoginTrackingCollection = db.collection(TABLE_SOCIAL_LOGIN_TRACKING);

    // Prepare the document to insert
    const document = {
        user_id: userId,
        social_login_type: socialLoginType,
        social_login_token: socialLoginToken,
        social_login_refresh_token: socialLoginRefreshToken,
        update_data: updateData,
        error: error,
        refresh_token: refreshToken,
        page_update_options: pageUpdateOptions,
        request: requestBody,
        created: getUtcDate()
    };

    try {
        // Insert the document asynchronously
        const result = await socialLoginTrackingCollection.insertOne(document);
        return result;
    } catch (err) {
        // Log error and return error object
        console.error("Error inserting social login tracking:", err);
        return { error: err };
    }
}; // End socialLoginTracking()

/**
 * Function is used to track social refresh
 * Uses async/await for database operations.
 * @param {*} req - Express request object
 * @param {*} res - Express response object
 * @param {*} options - Options containing social login data
 * @returns {Promise<Object>} - Result of the insert operation
 */
socialRefreshTracking = async (options) => {
    try {
        // Prepare data for insertion
        const userId = options.user_id ? ObjectId(options.user_id) : "";
        const socialLoginType = options.social_login_type || "";
        const oldToken = options.old_token || "";
        const newToken = options.new_token || "";
        const error = options.error || "";
        const pageId = options.page_id || "";

        const requestBody = "";

        // Get the collection reference
        const socialRefreshTrackingCollection = db.collection(TABLE_SOCIAL_REFRESH_TRACKING);

        // Prepare the document to insert
        const insertDocument = {
            user_id: userId,
            old_token: oldToken,
            new_token: newToken,
            page_id: pageId,
            social_login_type: socialLoginType,
            error: error,
            request: requestBody,
            created: getUtcDate()
        };


        if (newToken != "") {
            /** Track social login */
            let trackSocialLoginOptions = {
                'user_id': userId,
                'social_login_type': socialLoginType,
                'social_login_token': newToken,
                'social_login_refresh_token': "",
                'update_data': "",
                'refresh_token': true,
                'error': "",
            }
            await socialLoginTracking(null, null, trackSocialLoginOptions);
        }

        // Insert the document asynchronously
        const result = await socialRefreshTrackingCollection.insertOne(insertDocument);
        return result;
    } catch (err) {
        // Log error and return error object
        console.error("Error inserting social login tracking:", err);
        return { error: err };
    }
}; // End socialRefreshTracking()