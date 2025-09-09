const async = require('async');
const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const tableAiSocialPostLogs = db.collection(TABLE_AI_SOCIAL_POST_LOGS);
const customerInteractions = db.collection(TABLE_CUSTOMER_INTERACTION_ENTRIES);
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});

function AiSocialPost() {

    /**
     * Function is used to save AI campaign SEO logs 
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.saveAiSocialPostDetails = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let aiCampaignParentId = req.body.campaign_chat_parent_id ? newObjectIdDefault(req.body.campaign_chat_parent_id) : "";
        let postAiContent = req.body.ai_content ? req.body.ai_content : "";
        let postUserContent = req.body.user_content ? req.body.user_content : "";
        let postReplyContent = req.body.reply_content ? req.body.reply_content : "";
        let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

        let finalResponse = {};

        // Validate required fields
        if (
            userId == '' ||
            aiCampaignChatId == '' ||
            postAiContent == '' ||
            postUserContent == '' ||
            aiCampaignParentId == ''
        ) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Run all DB queries in parallel using Promise.all for faster response
            const [
                campaignSocialPost,
                getSocialLogDetail,
                totalSocialLogsResult,
                socialLogsHistory
            ] = await Promise.all([
                // Get campaign social post detail
                tableAiCampaignChat.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_parent_id: 1, content: 1, first_content_campaign: 1 } }
                ),
                // Get social post log detail
                tableAiSocialPostLogs.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_chat_id: 1, content: 1, role: 1, first_content_campaign: 1 } }
                ),
                // Count total social post logs
                tableAiSocialPostLogs.countDocuments({
                    ai_campaign_parent_id: aiCampaignParentId,
                    user_id: userId
                }),
                // Get social logs history
                tableAiSocialPostLogs.find(
                    {
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        user_id: newObjectIdDefault(userId)
                    },
                    { projection: { _id: 0, role: 1, content: 1 } }
                ).toArray()
            ]);

            // Format social logs history for assistant role
            if (Array.isArray(socialLogsHistory) && socialLogsHistory.length > 0) {
                socialLogsHistory.forEach(function (newRecords) {
                    if (newRecords.role == "assistant") {
                        let newCaptions = (newRecords.content && newRecords.content.captions) ? newRecords.content.captions : "";
                        let newSongs = (newRecords.content && newRecords.content.song) ? newRecords.content.song : "";
                        let newTitles = (newRecords.content && newRecords.content.title) ? newRecords.content.title : "";
                        let songData = (newSongs != "") ? `; "song":` + newSongs + `;` : "";
                        let titleData = (newTitles != "") ? `"title":` + newTitles + `,` : "";
                        newRecords['content'] = `{${titleData} "captions":${newCaptions},${songData}}`;
                    } else {
                        newRecords['content'] = newRecords.content;
                    }
                });
            }

            let firstCampaignContent = (campaignSocialPost && campaignSocialPost.first_content_campaign) ? campaignSocialPost.first_content_campaign : false;

            // First time SEO log entry when log count is 0
            if (totalSocialLogsResult == 0) {
                let logsOption = {
                    user_id: userId,
                    ai_campaign_parent_id: aiCampaignParentId,
                    content: (campaignSocialPost && campaignSocialPost.content) ? campaignSocialPost.content : "",
                    first_content_campaign: firstCampaignContent,
                    role: AI_ROLE_ASSISTANT,
                };
                await saveAiSocialPostLogs(req, res, logsOption);
            }

            // Save user content
            let userLogsOption = {
                user_id: userId,
                ai_campaign_parent_id: aiCampaignParentId,
                content: postUserContent,
                first_content_campaign: firstCampaignContent,
                reply_content: postReplyContent,
                role: AI_ROLE_USER,
            };
            await saveAiSocialPostLogs(req, res, userLogsOption);

            // Check if social log detail exists
            let socialPostLogsDetail = Object.keys(getSocialLogDetail || {}).length === 0 && getSocialLogDetail && getSocialLogDetail.constructor === Object;

            // If social log detail exists
            if (getSocialLogDetail && socialPostLogsDetail == false) {
                let content = getSocialLogDetail ? getSocialLogDetail.content : "";
                let caption = (content && content.captions) ? content.captions : "";
                let title = (content && content.title) ? `Title :-` + content.title + `;` : "";
                let song = (content && content.song) ? `Song :-` + content.song + `;` : "";
                let firstCampaignContent = (getSocialLogDetail && getSocialLogDetail.first_content_campaign) ? getSocialLogDetail.first_content_campaign : false;
                let socialPostFormat = (firstCampaignContent == true) ? SOCIAL_MEDIA_EDIT_FORMAT_WITH_SONG : SOCIAL_MEDIA_EDIT_FORMAT_WITHOUT_SONG;
                let systemContent = SOCIAL_EDIT_SYSTEM_PROMPT.replace(/{title}/g, title).replace(/{caption}/g, caption).replace(/{song}/g, song);
                let systemPrompt = {
                    role: "system",
                    content: systemContent + ";" + socialPostFormat,
                };
                let userPrompt = {
                    role: AI_ROLE_USER,
                    content: postUserContent + `; ` + socialPostFormat,
                };
                let chatHistory = Array.isArray(socialLogsHistory) ? [...socialLogsHistory] : [];
                if (chatHistory.length > 0) {
                    chatHistory.unshift(systemPrompt);
                    chatHistory.push(userPrompt);
                }
                let prompt = {
                    system_prompt_without_format: systemContent,
                    user_prompt_without_format: postUserContent,
                    system_prompt: systemPrompt,
                    user_prompt: userPrompt,
                    previous_chat: chatHistory,
                };

                // Get OpenAI social post data
                let aiResponseData = await getOpenAiSocialPostResponse(req, res, prompt);
                if (aiResponseData.status == STATUS_SUCCESS) {
                    let socialPost = aiResponseData.response;
                    let systemPromptData = SOCIAL_EDIT_SYSTEM_PROMPT.replace(/{title}/g, title).replace(/{caption}/g, caption).replace(/{song}/g, song);
                    // Save assistant message
                    let logsOption = {
                        user_id: userId,
                        ai_campaign_parent_id: aiCampaignParentId,
                        content: socialPost,
                        role: AI_ROLE_ASSISTANT,
                        user_prompt: postUserContent,
                        system_prompt: systemPromptData,
                        first_content_campaign: "",
                        replace_data: `{caption}:${caption};`
                    };
                    let saveResponse = await saveAiSocialPostLogs(req, res, logsOption);
                    let socialStatus = saveResponse.status;
                    if (socialStatus == STATUS_SUCCESS) {
                        // Send success response
                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                result: { content: socialPost },
                                social_log_id: saveResponse.result,
                                message: res.__("front.ai_bot.social_has_been_updated_successfully"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    } else {
                        // Send error response
                        finalResponse = {
                            data: {
                                status: STATUS_ERROR,
                                result: {},
                                message: res.__("front.system.something_going_wrong_please_try_again"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    }
                } else {
                    // Delete user log if AI response failed
                    let deleteOption = {
                        user_id: userId,
                        ai_campaign_parent_id: aiCampaignParentId,
                        content: postUserContent,
                        role: AI_ROLE_USER,
                    };
                    await tableAiSocialPostLogs.deleteOne(deleteOption);
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // If no social log detail, use campaignSocialPost
                let content = campaignSocialPost ? campaignSocialPost.content : "";
                let caption = (content && content.captions) ? content.captions : "";
                let title = (content && content.title) ? `Title :-` + content.title + `;` : "";
                let song = (content && content.song) ? `Song :-` + content.song + `;` : "";
                let firstCampaignContent = (campaignSocialPost && campaignSocialPost.first_content_campaign) ? campaignSocialPost.first_content_campaign : false;
                let socialPostFormat = (firstCampaignContent == true) ? SOCIAL_MEDIA_EDIT_FORMAT_WITH_SONG : SOCIAL_MEDIA_EDIT_FORMAT_WITHOUT_SONG;
                let systemContent = SOCIAL_EDIT_SYSTEM_PROMPT.replace(/{title}/g, title).replace(/{caption}/g, caption).replace(/{song}/g, song) + " " + socialPostFormat;
                let systemPrompt = {
                    role: "system",
                    content: systemContent
                };
                let userPrompt = {
                    role: AI_ROLE_USER,
                    content: postUserContent + `; ` + socialPostFormat,
                };
                let chatHistory = Array.isArray(socialLogsHistory) ? [...socialLogsHistory] : [];
                if (chatHistory.length > 0) {
                    chatHistory.unshift(systemPrompt);
                    chatHistory.push(userPrompt);
                }
                let prompt = {
                    system_prompt_without_format: systemContent,
                    user_prompt_without_format: postUserContent,
                    system_prompt: systemPrompt,
                    user_prompt: userPrompt,
                    previous_chat: chatHistory,
                };

                // Get OpenAI social post data
                let aiResponseData = await getOpenAiSocialPostResponse(req, res, prompt);
                if (aiResponseData.status == STATUS_SUCCESS) {
                    let socialPost = aiResponseData.response;
                    let systemPromptData = SOCIAL_EDIT_SYSTEM_PROMPT.replace(/{title}/g, title).replace(/{caption}/g, caption).replace(/{song}/g, song);
                    // Save assistant message
                    let logsOption = {
                        user_id: userId,
                        ai_campaign_parent_id: aiCampaignParentId,
                        content: socialPost,
                        role: AI_ROLE_ASSISTANT,
                        user_prompt: postUserContent,
                        system_prompt: systemPromptData,
                        first_content_campaign: firstCampaignContent,
                        replace_data: `{caption}:${caption};`,
                    };
                    let saveResponse = await saveAiSocialPostLogs(req, res, logsOption);
                    let socialStatus = saveResponse.status;
                    if (socialStatus == STATUS_SUCCESS) {
                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                result: { content: socialPost },
                                social_log_id: saveResponse.result,
                                message: res.__("front.ai_bot.social_has_been_updated_successfully"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    } else {
                        finalResponse = {
                            data: {
                                status: STATUS_ERROR,
                                result: {},
                                message: res.__("front.system.something_going_wrong_please_try_again"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    }
                } else {
                    // Delete user log if AI response failed
                    let deleteOption = {
                        user_id: userId,
                        ai_campaign_parent_id: aiCampaignParentId,
                        content: postUserContent,
                        role: AI_ROLE_USER,
                    };
                    await tableAiSocialPostLogs.deleteOne(deleteOption);
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
        } catch (err) {
            // Handle any unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveAiSocialPostDetails();

    /**
     * Function to get OpenAI or Gemini response for social post editing.
     * Uses async/await for all API calls and handles retries with exponential backoff.
     * If Gemini is enabled, calls Gemini API; otherwise, uses OpenAI.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @param {number} retryCount 
     * @param {number} maxRetries 
     * @returns {Promise<{status: string, response: any}>}
     */
    getOpenAiSocialPostResponse = async (req, res, options, retryCount = 0, maxRetries = 3) => {
        let systemPromptWithoutFormat = options.system_prompt_without_format || "";
        let userPromptWithoutFormat = options.user_prompt_without_format || "";
        let systemPrompt = options.system_prompt || {};
        let userPrompt = options.user_prompt || {};
        let previousChat = options.previous_chat || [];
        let allChat = previousChat.length > 0 ? previousChat : [systemPrompt, userPrompt];

        try {
            // If Gemini server is enabled, use Gemini API
            if (GEMINI_SERVER_ENABLE === true) {
                // Prepare chat history for Gemini API
                const chatHistory = allChat
                    .filter(item => item.role !== 'system')
                    .map(item => ({
                        role: item.role === 'assistant' ? 'model' : item.role,
                        parts: [{ text: item.content }]
                    }));

                // Prepare options for Gemini API
                let geminiOptions = {
                    chat_history: chatHistory,
                    content: userPromptWithoutFormat,
                    format_schema: SOCIAL_POST_EDIT_SCHEMA,
                    system_instruction: systemPromptWithoutFormat
                };

                // Call Gemini API (editSupportingContents)
                let geminiData = await editSupportingContents(req, res, geminiOptions);
                let newResponse = geminiData?.response || {};

                if (geminiData.status === STATUS_SUCCESS) {
                    return { status: STATUS_SUCCESS, response: newResponse };
                } else {
                    return { status: STATUS_ERROR, response: {} };
                }
            } else {
                // Otherwise, use OpenAI API with async/await
                let result;
                try {
                    // Call OpenAI API for chat completion
                    result = await openai.createChatCompletion({
                        model: "gpt-4o",
                        messages: allChat,
                        temperature: TEMPERATURE
                    });
                } catch (aiError) {
                    // Handle OpenAI API error
                    return { status: STATUS_ERROR, response: aiError };
                }

                let response = result.data.choices[0].message.content;
                let aiArrayResponse = response;

                // Try to parse the AI response as JSON
                try {
                    let arrayResponseData = JSON.parse(aiArrayResponse);
                    return { status: STATUS_SUCCESS, response: arrayResponseData };
                } catch (e) {
                    // If parsing fails, try to get a valid JSON response using validAiResponse
                    try {
                        let validData = await validAiResponse(aiArrayResponse);
                        let newResponseData = validData.response;
                        let newResponse = JSON.parse(newResponseData);
                        return { status: STATUS_SUCCESS, response: newResponse };
                    } catch (err) {
                        // Try again to get a valid JSON response
                        try {
                            let validDataAgain = await validAiResponse(aiArrayResponse);
                            let newResponseDataGenerate = validDataAgain.response;
                            let newResponse1 = JSON.parse(newResponseDataGenerate);
                            return { status: STATUS_SUCCESS, response: newResponse1 };
                        } catch (error) {
                            // If still fails, retry with exponential backoff if retries remain
                            if (retryCount < maxRetries) {
                                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                                return await getOpenAiSocialPostResponse(req, res, options, retryCount + 1, maxRetries);
                            } else {
                                return { status: STATUS_ERROR, response: error };
                            }
                        }
                    }
                }
            }
        } catch (err) {
            // Catch any unexpected errors
            return { status: STATUS_ERROR, response: err };
        }
    };

    /**
     * Function is used to save AI social media post logs using async/await for faster and cleaner response.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object>} result object with status and insertedId or error
     */
    saveAiSocialPostLogs = async (req, res, options) => {
        try {
            // Extract and sanitize input data
            const userId = options.user_id ? options.user_id : "";
            const aiCampaignParentId = options.ai_campaign_parent_id ? options.ai_campaign_parent_id : "";
            const content = options.content ? options.content : "";
            const replyContent = options.reply_content ? options.reply_content : "";
            const role = options.role ? options.role : "";
            const userFinalPrompt = options.user_prompt ? options.user_prompt : "";
            const systemFinalPrompt = options.system_prompt ? options.system_prompt : "";
            const systemReplaceData = options.replace_data ? options.replace_data : "";
            const secondPhase = options.second_phase ? options.second_phase : "";
            const firstContentCampaign = options.first_content_campaign ? options.first_content_campaign : false;

            // Prepare insert data
            let insertData = {
                user_id: newObjectIdDefault(userId),
                ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                role: role,
                content: content,
                first_content_campaign: firstContentCampaign,
                is_deleted: NOT_DELETED,
                created: getUtcDate(),
            };
            if (role === AI_ROLE_USER) {
                insertData.reply_content = replyContent;
            }

            // Insert the social post log
            const result = await tableAiSocialPostLogs.insertOne(insertData);

            if (result && result.insertedId) {
                // If the role is assistant and systemFinalPrompt is present, save campaign logs in parallel
                if (role === AI_ROLE_ASSISTANT && systemFinalPrompt !== "") {
                    const optionsData = {
                        user_id: userId,
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        campaign_type: DEFAULT_CAMPAIGN,
                        type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                        user_prompt: userFinalPrompt,
                        system_prompt: SOCIAL_EDIT_SYSTEM_PROMPT,
                        system_replace_data: systemReplaceData,
                        user_final_prompt: userFinalPrompt,
                        system_final_prompt: systemFinalPrompt,
                        second_phase: secondPhase,
                        final_output: content,
                        is_edit: "true",
                    };
                    // Run saveAllCampaignLogs asynchronously, but don't block the response
                    saveAllCampaignLogs(optionsData).catch(() => { });
                }

                // Success response
                return {
                    status: STATUS_SUCCESS,
                    result: result.insertedId,
                };
            } else {
                // Error response if insert failed
                return {
                    status: STATUS_ERROR,
                    result: "",
                };
            }
        } catch (error) {
            // Handle any unexpected errors
            return {
                status: STATUS_ERROR,
                result: "",
            };
        }
    };

    /**
     * Function to get AI social media post history using async/await.
     * Runs DB query with async/await for cleaner and faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getSocialPostLogHistory = async (req, res) => {
        let finalResponse = {};
        // Extract user and request data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatParentId = req.body.campaign_chat_parent_id ? req.body.campaign_chat_parent_id : "";

        // Validate required fields
        if (!userId || !aiCampaignChatParentId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Build query condition for chat history
        let commonCondition = {
            user_id: newObjectIdDefault(userId),
            is_deleted: NOT_DELETED,
            content: { $ne: "" },
            ai_campaign_parent_id: newObjectIdDefault(aiCampaignChatParentId)
        };

        try {
            // Fetch social post logs using async/await
            const result = await tableAiSocialPostLogs.find(commonCondition).toArray();

            if (result && result.length > 0) {
                // Success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: result,
                        message: "",
                    }
                };
            } else {
                // No records found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: 0,
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
                    result: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getSocialPostLogHistory();

    /**
     * Function is used to update social media post using async/await for all DB queries.
     * Ensures clean formatting and faster response times.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updateCampaignSocialPost = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user and request data
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            const aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            const socialLogId = req.body.social_log_id ? newObjectIdDefault(req.body.social_log_id) : "";

            // Validate required fields
            if (!userId || !aiCampaignChatId || !socialLogId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Build query condition for fetching social post log detail
            const commonCondition = {
                _id: socialLogId,
                user_id: userId,
                is_deleted: NOT_DELETED,
            };

            // Fetch social post log detail using async/await
            const result = await tableAiSocialPostLogs.findOne(commonCondition, { projection: { _id: 1, content: 1 } });

            if (result) {
                // Extract content fields
                const socialContent = result.content || {};
                const title = socialContent.title || "";
                const captions = socialContent.captions || "";
                const song = socialContent.song || "";

                // Build update condition for campaign social post
                const updateCondition = {
                    _id: newObjectIdDefault(aiCampaignChatId),
                    user_id: newObjectIdDefault(userId),
                    role: AI_ROLE_ASSISTANT,
                    type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                };

                // Update campaign social post detail using async/await
                const updateResult = await tableAiCampaignChat.updateOne(
                    updateCondition,
                    { $set: { "content.title": title, "content.captions": captions, "content.song": song, is_edited: true } }
                );

                if (updateResult && updateResult.modifiedCount > 0) {
                    // Success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: res.__("front.ai_bot.social_media_post_has_been_updated_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    // If update fails, refresh social post summary and save to customer bucket
                    // These can run in parallel for efficiency
                    const [socialPosts] = await Promise.all([
                        fetchUserSocialPostSummary(req, res, userId)
                    ]);
                    await saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_SOCIAL_POSTS,
                        parent_bucket: PARENT_BUCKET_SOCIAL_POSTS,
                        data: socialPosts
                    });

                    // Error response
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // No record found error response
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end updateCampaignSocialPost();

}
module.exports = new AiSocialPost();