const async = require('async');
const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const tableAiPollLogs = db.collection(TABLE_AI_POLL_LOGS);
const polls = db.collection(TABLE_POLLS);
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});

function AiPolls() {
    /**
     * Function is used to save AI campaign poll logs 
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.saveAiPollLogDetails = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let aiCampaignParentId = req.body.campaign_chat_parent_id ? newObjectIdDefault(req.body.campaign_chat_parent_id) : "";
        let pollAiContent = req.body.ai_content ? req.body.ai_content : "";
        let pollUserContent = req.body.user_content ? req.body.user_content : "";
        let pollReplyContent = req.body.reply_content ? req.body.reply_content : "";
        let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

        let finalResponse = {};

        if (userId === '' || aiCampaignChatId === '' || pollAiContent === '' || pollUserContent === '' || aiCampaignParentId === '') {
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
            // Run all DB queries in parallel for faster response
            const [
                campaignPoll,
                getPollLogDetail,
                totalPollLogsResult,
                pollLogsHistory
            ] = await Promise.all([
                // Get campaign poll detail
                tableAiCampaignChat.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_parent_id: 1, content: 1 } }
                ),
                // Get poll logs detail
                tableAiPollLogs.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_chat_id: 1, content: 1, role: 1 } }
                ),
                // Count total poll logs
                tableAiPollLogs.countDocuments({
                    ai_campaign_parent_id: aiCampaignParentId,
                    user_id: userId
                }),
                // Get poll logs history
                tableAiPollLogs.find(
                    {
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        user_id: newObjectIdDefault(userId)
                    },
                    { projection: { _id: 0, role: 1, content: 1 } }
                ).toArray()
            ]);

            // Format poll logs history for assistant role
            if (pollLogsHistory.length > 0) {
                pollLogsHistory.forEach(function (records) {
                    if (records.role === "assistant") {
                        let question = records.content.question;
                        let options = records.content.options;
                        let hashtags = records.content.hashtags;
                        records.content = `Following is the generated Poll data that needs to be updated. question: ${question}; options:  ${options}; hashtags: ${hashtags}.`;
                    } else {
                        records.content = records.content;
                    }
                });
            }

            // First time poll post save in logs
            if (totalPollLogsResult === 0) {
                let logsOption = {
                    user_id: userId,
                    ai_campaign_parent_id: aiCampaignParentId,
                    content: campaignPoll ? campaignPoll.content : "",
                    role: AI_ROLE_ASSISTANT,
                };
                await saveAiPollLogs(req, res, logsOption);
            }

            // Save user content
            let logsOption = {
                user_id: userId,
                ai_campaign_parent_id: aiCampaignParentId,
                content: pollUserContent,
                reply_content: pollReplyContent,
                role: AI_ROLE_USER,
            };
            await saveAiPollLogs(req, res, logsOption);

            let pollLogsDetailIsEmpty = Object.keys(getPollLogDetail || {}).length === 0 && (getPollLogDetail || {}).constructor === Object;

            // If poll log detail exists, use it for prompt
            let content, question, options, hashtags, systemPromptContent;
            if (getPollLogDetail && !pollLogsDetailIsEmpty) {
                content = getPollLogDetail.content || "";
                question = content.question || "";
                options = content.options || "";
                hashtags = content.hashtags || "";
                systemPromptContent = POLL_EDIT_PROMPT_SAVED
                    .replace(/{question}/g, question)
                    .replace(/{options}/g, options)
                    .replace(/{hashtags}/g, hashtags);
            } else {
                content = campaignPoll ? campaignPoll.content : "";
                question = content ? content.question : "";
                options = content ? content.options : "";
                hashtags = content ? content.hashtags : "";
                systemPromptContent = POLL_EDIT_PROMPT_SAVED
                    .replace(/{question}/g, question)
                    .replace(/{options}/g, options)
                    .replace(/{hashtags}/g, hashtags);
            }

            // Prepare prompts
            let systemPrompt = {
                role: "system",
                content: systemPromptContent,
            };
            let userPrompt = {
                role: AI_ROLE_USER,
                content: pollUserContent + "; " + POLL_EDIT_FORMAT,
            };

            let pollLogsHistoryForPrompt = pollLogsHistory ? [...pollLogsHistory] : [];
            if (pollLogsHistoryForPrompt.length > 0) {
                pollLogsHistoryForPrompt.unshift(systemPrompt);
                pollLogsHistoryForPrompt.push(userPrompt);
            }

            let prompt = {
                system_prompt: systemPrompt,
                user_prompt: userPrompt,
                previous_chat: pollLogsHistoryForPrompt.length > 0 ? pollLogsHistoryForPrompt : [systemPrompt, userPrompt],
                system_prompt_without_format: systemPromptContent,
                user_prompt_without_format: pollUserContent,
            };

            // Get OpenAI (or Gemini) response
            let aiResponseData = await getOpenAiPollResponse(req, res, prompt);
            let pollData = aiResponseData.response;

            if (aiResponseData.status === STATUS_SUCCESS && pollData && pollData.poll) {
                let logsOption = {
                    user_id: userId,
                    ai_campaign_parent_id: aiCampaignParentId,
                    content: pollData.poll,
                    role: AI_ROLE_ASSISTANT,
                    user_prompt: pollUserContent,
                    system_prompt: systemPromptContent,
                    replace_data: `{question}:${question}; {options}:${options}; {hashtags}:${hashtags}`,
                };
                // Save assistant message
                let saveResponse = await saveAiPollLogs(req, res, logsOption);
                let pollStatus = saveResponse.status;
                if (pollStatus === STATUS_SUCCESS) {
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: pollData,
                            poll_log_id: saveResponse.result,
                            message: res.__("front.ai_bot.poll_has_been_updated_successfully"),
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
                    content: pollUserContent,
                    role: AI_ROLE_USER,
                };
                let deleteResult = await tableAiPollLogs.deleteOne(deleteOption);
                if (deleteResult && deleteResult.deletedCount > 0) {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    // Even if delete fails, return error
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
            console.error('Error in saveAiPollLogDetails:', err);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveAiPollLogDetails();

    /**
     * Function to get OpenAI or Gemini poll response using async/await.
     * Handles both Gemini and OpenAI responses, with all queries and API calls using async/await for cleaner, faster execution.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<{status: string, response: any}>}
     */
    const getOpenAiPollResponse = async (req, res, options) => {
        try {
            // Prepare prompts and chat history
            const systemPrompt = options.system_prompt || {};
            const userPrompt = options.user_prompt || {};
            const previousChat = options.previous_chat || [];
            const systemPromptWithoutFormat = options.system_prompt_without_format || "";
            const userPromptWithoutFormat = options.user_prompt_without_format || "";

            let allChat = [];
            if (previousChat.length > 0) {
                allChat = previousChat;
            } else {
                allChat = [systemPrompt, userPrompt];
            }

            // If Gemini server is enabled, use Gemini API
            if (GEMINI_SERVER_ENABLE === true) {
                // Prepare chat history for Gemini
                const chatHistory = allChat
                    .filter(item => item.role !== 'system')
                    .map(item => ({
                        role: item.role === 'assistant' ? 'model' : item.role,
                        parts: [{ text: item.content }]
                    }));

                // Prepare Gemini options
                const geminiOptions = {
                    chat_history: chatHistory,
                    format_schema: POLLS_EDIT_SCHEMA,
                    content: userPromptWithoutFormat,
                    system_instruction: systemPromptWithoutFormat
                };

                // Call Gemini function using async/await
                const geminiData = await editSupportingContents(req, res, geminiOptions);
                const newResponse = geminiData?.response || {};

                if (geminiData.status === STATUS_SUCCESS) {
                    return { status: STATUS_SUCCESS, response: newResponse };
                } else {
                    return { status: STATUS_ERROR, response: {} };
                }
            } else {
                // Use OpenAI API with async/await
                try {
                    const result = await openai.createChatCompletion({
                        model: "gpt-4o",
                        messages: allChat,
                        temperature: TEMPERATURE
                    });

                    let aiArrayResponse = result.data.choices[0].message.content;

                    // Try to parse the AI response as JSON
                    try {
                        let arrayResponseData = JSON.parse(aiArrayResponse);
                        return { status: STATUS_SUCCESS, response: arrayResponseData };
                    } catch (e) {
                        // If parsing fails, try to get a valid JSON response using validAiResponse
                        let validData = await validAiResponse(aiArrayResponse);
                        let newResponseData = validData.response;

                        try {
                            let newResponse = JSON.parse(newResponseData);
                            return { status: STATUS_SUCCESS, response: newResponse };
                        } catch (err) {
                            // Try one more time to get a valid JSON response
                            let validDataAgain = await validAiResponse(aiArrayResponse);
                            let newResponseDataGenerate = validDataAgain.response;

                            try {
                                let newResponse1 = JSON.parse(newResponseDataGenerate);
                                return { status: STATUS_SUCCESS, response: newResponse1 };
                            } catch (error) {
                                return { status: STATUS_ERROR, response: error };
                            }
                        }
                    }
                } catch (aiError) {
                    return { status: STATUS_ERROR, response: aiError };
                }
            }
        } catch (error) {
            // Handle any unexpected errors
            return { status: STATUS_ERROR, response: error };
        }
    };


    /**
     * Function is used to get AI poll history using async/await for faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getPollLogsHistory = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user data
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const aiCampaignChatParentId = req.body.campaign_chat_parent_id ? req.body.campaign_chat_parent_id : "";

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

            // Build common condition for fetching chat history
            const commonCondition = {
                user_id: newObjectIdDefault(userId),
                is_deleted: NOT_DELETED,
                content: { $ne: "" },
                ai_campaign_parent_id: newObjectIdDefault(aiCampaignChatParentId)
            };

            // Fetch poll log history using async/await
            const result = await tableAiPollLogs.find(commonCondition).toArray();

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
                        result: [],
                        message: res.__("front.global.no_record_found"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle any unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getPollLogsHistory();

    /**
     * Function is used for get open ai response
     */
    /**
     * Save AI Poll Logs using async/await for faster and cleaner response.
     * Handles both user and assistant roles, and saves campaign logs in parallel if needed.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object>} status and insertedId or error
     */
    saveAiPollLogs = async (req, res, options) => {
        try {
            // Prepare insert data
            const userId = options.user_id ? options.user_id : "";
            const aiCampaignParentId = options.ai_campaign_parent_id ? options.ai_campaign_parent_id : "";
            const content = options.content ? options.content : "";
            const replyContent = options.reply_content ? options.reply_content : "";
            const role = options.role ? options.role : "";
            const userFinalPrompt = options.user_prompt ? options.user_prompt : "";
            const systemFinalPrompt = options.system_prompt ? options.system_prompt : "";
            const systemReplaceData = options.replace_data ? options.replace_data : "";

            let insertData = {
                user_id: newObjectIdDefault(userId),
                ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                role: role,
                content: content,
                is_deleted: NOT_DELETED,
                created: getUtcDate(),
            };

            if (role === AI_ROLE_USER) {
                insertData.reply_content = replyContent;
            }

            // Insert poll log
            const result = await tableAiPollLogs.insertOne(insertData);
            const insertedId = result && result.insertedId ? result.insertedId : "";

            // If role is assistant and system prompt is provided, save campaign logs in parallel
            if (role === AI_ROLE_ASSISTANT && systemFinalPrompt !== "") {
                const optionsData = {
                    user_id: userId,
                    ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                    campaign_type: DEFAULT_CAMPAIGN,
                    type: AI_RESPONSE_TYPE_POLL,
                    user_prompt: userFinalPrompt,
                    system_prompt: POLL_EDIT_PROMPT_SAVED,
                    system_replace_data: systemReplaceData,
                    user_final_prompt: userFinalPrompt,
                    system_final_prompt: systemFinalPrompt,
                    final_output: content,
                    is_edit: "true",
                };
                // Run saveAllCampaignLogs in parallel, but don't block response
                saveAllCampaignLogs(optionsData).catch(() => { });
            }

            // Success response
            return {
                status: STATUS_SUCCESS,
                result: insertedId,
            };
        } catch (error) {
            // Error response
            return {
                status: STATUS_ERROR,
                result: "",
            };
        }
    }; // end saveAiPollLogs();


    /**
     * Function is used to update poll content
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updatecampaignPoll = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user and request data
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            let aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            let pollLogId = req.body.poll_log_id ? newObjectIdDefault(req.body.poll_log_id) : "";
            let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

            // Validate required fields
            if (!userId || !aiCampaignChatId || !pollLogId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare common condition for fetching poll log
            let commonCondition = {
                _id: pollLogId,
                user_id: userId,
                is_deleted: NOT_DELETED,
            };

            // Fetch poll log details
            const pollLog = await tableAiPollLogs.findOne(
                commonCondition,
                { projection: { _id: 1, content: 1, ai_campaign_parent_id: 1 } }
            );

            if (!pollLog) {
                // No record found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let pollContent = pollLog.content || {};
            let aiCampaignParentId = pollLog.ai_campaign_parent_id || "";

            // Prepare update condition for campaign chat
            let updateCondition = {
                _id: newObjectIdDefault(aiCampaignChatId),
                user_id: newObjectIdDefault(userId),
                role: AI_ROLE_ASSISTANT,
                type: AI_RESPONSE_TYPE_POLL,
            };

            // Update campaign chat content with new poll content
            await tableAiCampaignChat.updateOne(
                updateCondition,
                { $set: { content: pollContent, is_edited: true } }
            );

            // Prepare poll question, options, and hashtags
            let pollQuestion = pollContent ? pollContent.question : "";
            let pollOptions = pollContent ? pollContent.options : [];
            let hashtagsData = pollContent ? pollContent.hashtags : pollOptions;
            let hasTagDataArr = [];

            // Format hashtags
            if (Array.isArray(hashtagsData) && hashtagsData.length > 0) {
                let newHasTagArr = (hashtagsData.length > 3) ? hashtagsData.slice(0, -1) : hashtagsData;
                if (typeof newHasTagArr === 'object') {
                    newHasTagArr.forEach(function (hasTagdata) {
                        let dataHastag = (hasTagdata.replace(/\s+/g, '-')).toLowerCase();
                        let hagTagTitle = makeHashtag(dataHastag);
                        hasTagDataArr.push(hagTagTitle);
                    });
                }
            }

            let hasTagValue = (hasTagDataArr.length > 0) ? hasTagDataArr.join(" ") : "";

            // Prepare update fields for polls collection
            let updateFields = {
                question: pollQuestion,
                hashtag: hasTagValue,
                is_edited: true,
            };

            if (Array.isArray(pollOptions) && pollOptions.length > 0) {
                pollOptions.forEach((title, index) => {
                    updateFields[`options.${index}.title`] = title; // Dynamic update for each option
                });
            }

            // Update polls collection with new poll data
            await polls.updateOne(
                {
                    ai_campaign_chat_id: newObjectIdDefault(aiCampaignChatId),
                    ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                    user_id: newObjectIdDefault(userId)
                },
                { $set: updateFields }
            );

            // Fetch updated poll summary and save to customer bucket in parallel
            const pollData = await fetchUserPollSummary(req, res, userId);
            await saveCustomerBucketItems({
                user_id: userId,
                bucket_name: DATA_BUCKET_POLL,
                parent_bucket: PARENT_BUCKET_POLL,
                data: pollData
            });

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.ai_bot.poll_has_been_updated_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end updatecampaignPoll();

    /**
     * Function is used to edit poll manually using async/await for faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.editManuallyPoll = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user data
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            const campaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            const pollQuestion = req.body.question ? req.body.question : "";
            const pollOptions = req.body.options ? req.body.options : [];

            // Validate required fields
            if (!userId || !campaignChatId || !pollQuestion || pollOptions.length === 0) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare update data for campaign chat
            const updateData = {
                "content.question": pollQuestion,
                "content.options": pollOptions,
                is_edited_manually: true,
                updated: getUtcDate()
            };

            // Update campaign chat content using async/await
            const campaignChatUpdateResult = await tableAiCampaignChat.updateOne(
                { _id: campaignChatId, user_id: userId, type: AI_RESPONSE_TYPE_POLL },
                { $set: updateData }
            );

            if (!campaignChatUpdateResult || campaignChatUpdateResult.matchedCount === 0) {
                // If update failed, send error response
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare update fields for polls collection
            let updateFields = {
                question: pollQuestion,
                is_edited_manually: true
            };

            // Dynamically update poll options
            if (Array.isArray(pollOptions) && pollOptions.length > 0) {
                pollOptions.forEach((title, index) => {
                    updateFields[`options.${index}.title`] = title;
                });
            }

            // Update polls collection using async/await
            const pollsUpdateResult = await polls.updateOne(
                { ai_campaign_chat_id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                { $set: updateFields }
            );

            // Fetch updated poll summary and save to customer bucket in parallel
            const pollDataPromise = fetchUserPollSummary(req, res, userId);
            const saveBucketPromise = pollDataPromise.then(pollData =>
                saveCustomerBucketItems({
                    user_id: userId,
                    bucket_name: DATA_BUCKET_POLL,
                    parent_bucket: PARENT_BUCKET_POLL,
                    data: pollData
                })
            );
            await Promise.all([pollDataPromise, saveBucketPromise]);

            // Check if polls update failed
            if (!pollsUpdateResult || pollsUpdateResult.matchedCount === 0) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.ai_bot.poll_has_been_updated_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle any unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end editManuallyPoll();


}
module.exports = new AiPolls();