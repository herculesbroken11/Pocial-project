const async = require('async');
const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const tableAiSeoLogs = db.collection(TABLE_AI_SEO_LOGS);
const customerInteractions = db.collection(TABLE_CUSTOMER_INTERACTION_ENTRIES);
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});

function AiSeoBlog() {

    /**
     * Function is used to save ai campaign seo logs 
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.saveAiSeoLogDetails = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let aiCampaignParentId = req.body.campaign_chat_parent_id ? newObjectIdDefault(req.body.campaign_chat_parent_id) : "";
        let seoAiContent = req.body.ai_content ? req.body.ai_content : "";
        let seoUserContent = req.body.user_content ? req.body.user_content : "";
        let seoReplyContent = req.body.reply_content ? req.body.reply_content : "";
        let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

        let finalResponse = {};

        // Validate required fields
        if (
            userId == '' ||
            aiCampaignChatId == '' ||
            seoAiContent == '' ||
            seoUserContent == '' ||
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
            // Run all DB queries in parallel for faster response
            const [
                campaignSeo,
                getSeoLogDetail,
                totalSeoLogsResult,
                seoLogsHistory
            ] = await Promise.all([
                // Get campaign SEO detail
                tableAiCampaignChat.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_parent_id: 1, content: 1 } }
                ),
                // Get SEO log detail
                tableAiSeoLogs.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_chat_id: 1, content: 1, role: 1 } }
                ),
                // Count total SEO logs
                tableAiSeoLogs.countDocuments({
                    ai_campaign_parent_id: aiCampaignParentId,
                    user_id: userId
                }),
                // Get SEO logs history
                tableAiSeoLogs.find(
                    {
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        user_id: newObjectIdDefault(userId)
                    },
                    { projection: { _id: 0, role: 1, content: 1 } }
                ).toArray()
            ]);

            // Format history for prompt
            if (seoLogsHistory.length > 0) {
                seoLogsHistory.forEach(function (records) {
                    if (records.role == "assistant") {
                        let title = records.content.title;
                        let blogText = records.content.blog_text;
                        records.content = `Following is the generated SEO blog that needs to be updated. Blog Title: ${title}; Blog Text:  ${blogText}.`;
                    } else {
                        records.content = records.content;
                    }
                });
            }

            // Save initial assistant log if this is the first SEO post
            if (totalSeoLogsResult == 0) {
                let logsOption = {
                    user_id: userId,
                    ai_campaign_parent_id: aiCampaignParentId,
                    content: campaignSeo?.content,
                    role: AI_ROLE_ASSISTANT,
                };
                await saveAiSeoLogs(req, res, logsOption);
            }

            // Save user content log
            let userLogOption = {
                user_id: userId,
                ai_campaign_parent_id: aiCampaignParentId,
                content: seoUserContent,
                reply_content: seoReplyContent,
                role: AI_ROLE_USER,
            };
            await saveAiSeoLogs(req, res, userLogOption);

            // Determine which log detail to use for prompt
            let hasSeoLogDetail = getSeoLogDetail && Object.keys(getSeoLogDetail).length > 0;
            let content, title, blogText, systemPromptContent;

            if (hasSeoLogDetail) {
                content = getSeoLogDetail.content || "";
                title = content.title || "";
                blogText = content.blog_text || "";
            } else {
                content = campaignSeo?.content || "";
                title = content.title || "";
                blogText = content.blog_text || "";
            }

            systemPromptContent = SEO_EDIT_SYSTEM_PROMPT.replace(/{title}/g, title).replace(/{blog_text}/g, blogText);

            let systemPrompt = {
                role: "system",
                content: systemPromptContent,
            };

            let userPrompt = {
                role: AI_ROLE_USER,
                content: seoUserContent + ";" + SEO_FORMAT,
            };

            // Prepare chat history for OpenAI
            let chatHistory = [...seoLogsHistory];
            if (chatHistory.length > 0) {
                chatHistory.unshift(systemPrompt);
                chatHistory.push(userPrompt);
            }

            let prompt = {
                system_prompt: systemPrompt,
                user_prompt: userPrompt,
                previous_chat: chatHistory.length > 0 ? chatHistory : [systemPrompt, userPrompt],
                system_prompt_without_format: systemPromptContent,
                user_prompt_without_format: seoUserContent,
            };

            // Get OpenAI response
            let aiResponseData = await getOpenAiSeoResponse(req, res, prompt);
            let seoBlogData = aiResponseData.response ? aiResponseData.response : "";
            let seoData = {
                title: seoBlogData?.seo_blog?.title || "",
                blog_text: seoBlogData?.seo_blog?.blog_text ? boldHeadings(seoBlogData.seo_blog.blog_text) : "",
                meta_description: seoBlogData?.seo_blog?.meta_description || "",
                generated_json: seoBlogData?.seo_blog?.generated_json || {},
            };
            seoBlogData = { seo_blog: seoData };

            if (aiResponseData.status == STATUS_SUCCESS && seoData) {
                let systemPromptData = SEO_EDIT_PROMPT_SAVED.replace(/{title}/g, title).replace(/{blog_text}/g, blogText);

                // Save assistant message log
                let assistantLogOption = {
                    user_id: userId,
                    ai_campaign_parent_id: aiCampaignParentId,
                    content: seoData,
                    role: AI_ROLE_ASSISTANT,
                    user_prompt: seoUserContent,
                    system_prompt: systemPromptData,
                    replace_data: `{title}:${title}; {blog_text}:${blogText}`,
                };

                let saveResponse = await saveAiSeoLogs(req, res, assistantLogOption);
                let seoStatus = saveResponse.status;

                if (seoStatus == STATUS_SUCCESS) {
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: seoBlogData,
                            seo_log_id: saveResponse.result,
                            message: res.__("front.ai_bot.seo_has_been_updated_successfully"),
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
                    content: seoUserContent,
                    role: AI_ROLE_USER,
                };
                await tableAiSeoLogs.deleteOne(deleteOption);

                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
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
    }; // end saveAiSeoLogDetails();


    /**
     * Function is used to get OpenAI or Gemini SEO response using async/await.
     * Handles all queries and API calls with async/await for faster and cleaner response.
     * If Gemini is enabled, calls Gemini in parallel. Otherwise, uses OpenAI.
     */
    getOpenAiSeoResponse = async (req, res, options) => {
        let systemPrompt = options.system_prompt || {};
        let userPrompt = options.user_prompt || {};
        let previousChat = options.previous_chat || [];
        let systemPromptWithoutFormat = options.system_prompt_without_format || "";
        let userPromptWithoutFormat = options.user_prompt_without_format || "";
        let allChat = previousChat.length > 0 ? previousChat : [systemPrompt, userPrompt];

        try {
            // If Gemini server is enabled, use Gemini API
            if (GEMINI_SERVER_ENABLE === true) {
                // Prepare chat history for Gemini
                const chatHistory = allChat.filter(item => item.role !== 'system').map(item => ({
                    role: item.role === 'assistant' ? 'model' : item.role,
                    parts: [{ text: item.content }]
                }));

                // Prepare options for Gemini
                let geminiOptions = {
                    chat_history: chatHistory,
                    format_schema: SEO_BLOG_EDIT_SCHEMA,
                    content: userPromptWithoutFormat,
                    system_instruction: systemPromptWithoutFormat
                };

                // Call Gemini function (async/await)
                let geminiData = await editSupportingContents(req, res, geminiOptions);
                let newResponse = geminiData?.response || {};

                if (geminiData.status === STATUS_SUCCESS) {
                    return { status: STATUS_SUCCESS, response: newResponse };
                } else {
                    return { status: STATUS_ERROR, response: {} };
                }
            } else {
                // Use OpenAI API with async/await
                let result;
                try {
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

                // Try parsing the AI response and formatting blog text if needed
                try {
                    let arrayResponseData = JSON.parse(aiArrayResponse);
                    let blogText = arrayResponseData[AI_RESPONSE_TYPE_SEO].blog_text;
                    if (blogText.indexOf("\n") === -1) {
                        // Format blog text in parallel for faster response
                        let blogTextData = await formattingData(blogText);
                        arrayResponseData[AI_RESPONSE_TYPE_SEO].blog_text = blogTextData.data;
                        return { status: STATUS_SUCCESS, response: arrayResponseData };
                    } else {
                        return { status: STATUS_SUCCESS, response: arrayResponseData };
                    }
                } catch (e) {
                    // If response is not valid JSON, try to get a valid response (async/await)
                    let validData = await validAiResponse(aiArrayResponse);
                    let newResponseData = validData.response;
                    try {
                        let newResponse = JSON.parse(newResponseData);
                        let blogText = newResponse[AI_RESPONSE_TYPE_SEO].blog_text;
                        if (blogText.indexOf("\n") === -1) {
                            let blogTextData = await formattingData(blogText);
                            newResponse[AI_RESPONSE_TYPE_SEO].blog_text = blogTextData.data;
                            return { status: STATUS_SUCCESS, response: newResponse };
                        } else {
                            return { status: STATUS_SUCCESS, response: newResponse };
                        }
                    } catch (err) {
                        // Try again to get a valid JSON response (async/await)
                        let validDataAgain = await validAiResponse(aiArrayResponse);
                        let newResponseDataGenerate = validDataAgain.response;
                        try {
                            let newResponse1 = JSON.parse(newResponseDataGenerate);
                            let blogText = newResponse1[AI_RESPONSE_TYPE_SEO].blog_text;
                            if (blogText.indexOf("\n") === -1) {
                                let blogTextData = await formattingData(blogText);
                                newResponse1[AI_RESPONSE_TYPE_SEO].blog_text = blogTextData.data;
                                return { status: STATUS_SUCCESS, response: newResponse1 };
                            } else {
                                return { status: STATUS_SUCCESS, response: newResponse1 };
                            }
                        } catch (error) {
                            // If still not valid, return error
                            return { status: STATUS_ERROR, response: error };
                        }
                    }
                }
            }
        } catch (error) {
            // Catch any unexpected errors
            return { status: STATUS_ERROR, response: error };
        }
    }; // end getOpenAiSeoResponse();


    /**
     * Function to format text by breaking it into small, logical, and meaningful paragraphs
     * for enhancing the reading experience. Paragraphs are separated by new lines.
     * Uses async/await for faster and cleaner response.
     * @param {string} text - The text to be formatted
     * @returns {Promise<{data: string}>} - Formatted text wrapped in an object
     */
    formattingData = async (text) => {
        // Prepare messages for OpenAI chat completion
        const allStringData = [
            {
                role: "system",
                content: "Your work is to break the user provided paragraph in small, logical and meaningful paragraph for enhancing the reading experience. While doing so separate the paragraph's with new line.",
            },
            {
                role: "user",
                content: `Please break  this  paragraph : ${text}`,
            }
        ];

        try {
            // Run OpenAI chat completion query asynchronously
            const newResult = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: allStringData,
            });

            // Extract and return the formatted response
            const newResponse = newResult.data.choices[0].message.content;
            return { data: newResponse };
        } catch (error) {
            // Handle any errors from OpenAI API
            return { data: "", error: error.message || error };
        }
    };

    /**
     * Function is used to get AI SEO history using async/await for faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getSeoLogHistory = async (req, res) => {
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

            // Prepare common condition for fetching chat history data
            const commonCondition = {
                user_id: newObjectIdDefault(userId),
                is_deleted: NOT_DELETED,
                content: { $ne: "" },
                ai_campaign_parent_id: newObjectIdDefault(aiCampaignChatParentId)
            };

            // Fetch logs data asynchronously
            const result = await tableAiSeoLogs.find(commonCondition).toArray();

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
                // No records found response
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
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getSeoLogHistory();

    /**
     * Function is used to save AI SEO logs using async/await for faster response.
     * Handles log insertion and, if needed, campaign prompt log saving in parallel.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object>} status and insertedId or error
     */
    saveAiSeoLogs = async (req, res, options) => {
        let userId = options.user_id || "";
        let aiCampaignParentId = options.ai_campaign_parent_id || "";
        let content = options.content || "";
        let replyContent = options.reply_content || "";
        let role = options.role || "";
        let userFinalPrompt = options.user_prompt || "";
        let systemFinalPrompt = options.system_prompt || "";
        let systemReplaceData = options.replace_data || "";

        // Prepare insert data for SEO log
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

        try {
            // Insert log data asynchronously
            const result = await tableAiSeoLogs.insertOne(insertData);
            const insertedId = result.insertedId ? result.insertedId : "";

            // If role is assistant and system prompt exists, save campaign prompt logs in parallel
            if (role === AI_ROLE_ASSISTANT && systemFinalPrompt !== "") {
                const optionsData = {
                    user_id: userId,
                    ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                    campaign_type: DEFAULT_CAMPAIGN,
                    type: AI_RESPONSE_TYPE_SEO,
                    user_prompt: userFinalPrompt,
                    system_prompt: SEO_EDIT_PROMPT_SAVED,
                    system_replace_data: systemReplaceData,
                    user_final_prompt: userFinalPrompt,
                    system_final_prompt: systemFinalPrompt,
                    final_output: content,
                    is_edit: "true",
                };
                // Save campaign logs asynchronously, but don't block response
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
    }; // end saveAiSeoLogs();


    /**
     * Function is used to update SEO content using async/await for faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updateCampaignSeoBlog = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user data and required IDs
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            const aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            const seoLogId = req.body.seo_log_id ? newObjectIdDefault(req.body.seo_log_id) : "";

            // Validate required fields
            if (!userId || !aiCampaignChatId || !seoLogId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare condition to fetch SEO log
            const commonCondition = {
                _id: seoLogId,
                user_id: userId,
                is_deleted: NOT_DELETED,
            };

            // Fetch SEO log content asynchronously
            const seoLog = await tableAiSeoLogs.findOne(commonCondition, { projection: { _id: 1, content: 1 } });

            if (seoLog && seoLog.content) {
                const seoContent = seoLog.content;

                // Prepare update condition for campaign chat
                const updateCondition = {
                    _id: aiCampaignChatId,
                    user_id: userId,
                    role: AI_ROLE_ASSISTANT,
                    type: AI_RESPONSE_TYPE_SEO,
                };

                // Update campaign chat content asynchronously
                const updateResult = await tableAiCampaignChat.updateOne(
                    updateCondition,
                    { $set: { content: seoContent, is_edited: true } }
                );

                if (updateResult && updateResult.matchedCount > 0) {
                    // Success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: res.__("front.ai_bot.seo_blog_has_been_updated_successfully"),
                        }
                    };
                } else {
                    // Error response if update failed
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            } else {
                // Error response if no record found
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
    }; // end updateCampaignSeoBlog();

}
module.exports = new AiSeoBlog();