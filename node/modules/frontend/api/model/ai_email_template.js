const async = require('async');
const wkhtmltoimage = require('wkhtmltoimage');
const fs = require('fs');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const tableAiEmailLogs = db.collection(TABLE_AI_EMAIL_TEMPLATE_LOGS);
const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
const polls = db.collection(TABLE_POLLS);
const campaignNewsletterCollection = db.collection(TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES);
const emailNewsletterTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
const customerInteractions = db.collection(TABLE_CUSTOMER_INTERACTION_ENTRIES);

function AiEmailLogsTemplate() {

    /**
     * Function is used to save AI campaign email template
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.saveAiEmailTemplate = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let aiCampaignParentId = req.body.campaign_chat_parent_id ? newObjectIdDefault(req.body.campaign_chat_parent_id) : "";
        let emailAiContent = req.body.ai_content ? req.body.ai_content : "";
        let emailUserContent = req.body.user_content ? req.body.user_content : "";
        let emailReplyContent = req.body.reply_content ? req.body.reply_content : "";
        let signupEmailEdit = req.body.is_insider_edit ? req.body.is_insider_edit : "";
        let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

        let publicBusinessInformation = loginUserData ? loginUserData.public_business_informaton : {};
        let businessName = publicBusinessInformation.name_of_the_business ? publicBusinessInformation.name_of_the_business : "";

        let finalResponse = {};

        if (userId == '' || aiCampaignChatId == '' || emailAiContent == '' || emailUserContent == '' || aiCampaignParentId == '') {
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
                campaignEmail,
                emailTemplate,
                getEmailLogsResult,
                emailLogsHistory
                // getCustomerInteraction // Uncomment if needed
            ] = await Promise.all([
                // Get campaign email
                tableAiCampaignChat.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_parent_id: 1, content: 1 } }
                ),
                // Get template email log
                tableAiEmailLogs.findOne(
                    { _id: aiCampaignChatId },
                    { projection: { _id: 1, ai_campaign_chat_id: 1, content: 1, role: 1 } }
                ),
                // Count email logs
                tableAiEmailLogs.countDocuments({
                    ai_campaign_parent_id: aiCampaignParentId,
                    user_id: userId
                }),
                // Get email logs history (skip first)
                tableAiEmailLogs.find(
                    {
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        user_id: newObjectIdDefault(userId)
                    },
                    { projection: { _id: 0, role: 1, content: 1 } }
                ).skip(1).toArray()
                // Uncomment if customer interaction needed
                // customerInteractions.findOne(
                //     {
                //         user_id: userId,
                //         ai_campaign_name_id: newObjectIdDefault(aiCampaignParentId),
                //         type: CONVERSATION_TYPE_EMAIL
                //     },
                //     { projection: { _id: 1, ai_campaign_chat_id: 1, conversation_id: 1 } }
                // )
            ]);

            let userBusinessName = "<br>" + businessName;

            // Format email logs history for prompt context
            if (emailLogsHistory.length > 0) {
                emailLogsHistory.forEach(function (records) {
                    if (records.role == "assistant") {
                        let emailHeading = records.content.email_heading ? records.content.email_heading : "";
                        let subject = records.content.subject ? records.content.subject : "";
                        let body = records.content.body ? records.content.body : "";
                        let bulletPoints = records.content.bullet_points ? records.content.bullet_points : [];
                        let bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
                        let bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
                        let bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
                        let bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
                        let bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
                        let bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
                        let emailClosingText = records.content.email_closing_paragraph ? records.content.email_closing_paragraph : "";
                        let emailSignature = records.content.email_ending_signature ? records.content.email_ending_signature : "";
                        let ctaText = records.content.cta_text;

                        records['content'] = (signupEmailEdit != "")
                            ? `Following is the generated email. Email Heading - ${emailHeading}; Subject-${subject}; Body-${body}; Bullet Points- ${bulletPoints}; Email closing text-${emailClosingText}; Cta Text- ${ctaText}.`
                            : `Following is the generated emai. Email Heading - ${emailHeading}; Subject-${subject}; Body-${body}; Bullet Points- [{"heading1" : ${bulletHeading1},"paragraph1" : ${bulletPoint1},"image1" : "",}, {"heading2" : ${bulletHeading2},"paragraph2" : ${bulletPoint2},"image2" : ""},{"heading3" : ${bulletHeading3},"paragraph3" : ${bulletPoint3},"image3" : ""}]; Email closing text-${emailClosingText}; Email Signature-${emailSignature}; Cta Text- ${ctaText}.`;
                    } else {
                        records['content'] = records.content;
                    }
                });
            }

            // Save first email log if not exists
            if (getEmailLogsResult == 0) {
                let logsOption = {
                    user_id: userId,
                    ai_campaign_parent_id: aiCampaignParentId,
                    content: campaignEmail ? campaignEmail.content : "",
                    signup_email_flag: signupEmailEdit,
                    role: AI_ROLE_ASSISTANT,
                };
                await saveAiEmailLogs(req, res, logsOption);
            }

            // Save user message log
            let logsOption = {
                user_id: userId,
                ai_campaign_parent_id: aiCampaignParentId,
                content: emailUserContent,
                reply_content: emailReplyContent,
                signup_email_flag: signupEmailEdit,
                role: AI_ROLE_USER,
            };
            await saveAiEmailLogs(req, res, logsOption);

            let emailLogsDetail = Object.keys(emailTemplate).length === 0 && emailTemplate.constructor === Object;

            // If template log exists, use it for prompt context
            if (emailTemplate && emailLogsDetail == false) {
                let content = campaignEmail ? campaignEmail.content : "";
                let emailHeading = content && content.email_heading ? content.email_heading : "";
                let emailSubject = content && content.subject ? content.subject : "";
                let emailBody = content && content.body ? content.body : "";
                let ctaText = content && content.cta_text ? content.cta_text : "";
                let bulletPoints = content && content.bullet_points ? content.bullet_points : [];
                let emailClosingParagraph = content && content.email_closing_paragraph ? content.email_closing_paragraph : "";
                let emailEndingSignature = content && content.email_ending_signature ? content.email_ending_signature : "";

                // Build data to update for prompt
                let dataToUpdate = "";
                if (emailHeading != "") dataToUpdate += `Email Heading - ${emailHeading}; `;
                if (emailSubject != "") dataToUpdate += `Subject - ${emailSubject}; `;
                if (emailBody != "") dataToUpdate += `Body - ${emailBody}; `;
                if (bulletPoints.length > 0) {
                    if (signupEmailEdit != "") {
                        dataToUpdate += `Bullet point(s) :- `;
                        bulletPoints.forEach(item => {
                            dataToUpdate += item + ",";
                        });
                    } else {
                        dataToUpdate += `Bullet point(s) heading(s) and paragraph(s) :- `;
                        bulletPoints.forEach(item => {
                            let keys = Object.keys(item).slice(0, 2);
                            dataToUpdate += keys.map(key => `${key} : "${item[key]}"`).join(', ');
                        });
                    }
                }
                if (emailClosingParagraph != "") dataToUpdate += `Email Closing Paragraph - ${emailClosingParagraph}; `;
                if (emailEndingSignature != "") dataToUpdate += `Email Ending Signature - ${emailEndingSignature}; `;
                if (ctaText != "") dataToUpdate += `Cta Text - ${ctaText}; `;

                let systemContent = (signupEmailEdit != "") ? INSIDER_EMAIL_EDIT_SYSTEM_PROMPT.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate) : EMAIL_EDIT_SYSTEM_PROMPT.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate);

                let userEmailFormat = (signupEmailEdit != "") ? INSIDER_USER_EMAIL_FORMAT : EDIT_EMAIL_FORMATE;

                let systemPrompt = {
                    role: "system",
                    content: systemContent,
                };
                let userPrompt = {
                    role: AI_ROLE_USER,
                    content: emailUserContent + "; " + userEmailFormat,
                };

                if (emailLogsHistory.length > 0) {
                    emailLogsHistory.unshift(systemPrompt);
                    emailLogsHistory.push(userPrompt);
                }

                let prompt = {
                    system_prompt: systemPrompt,
                    user_prompt: userPrompt,
                    previous_chat: emailLogsHistory,
                    system_prompt_without_format: systemContent,
                    user_prompt_without_format: emailUserContent,
                };

                // Get OpenAI response and handle result
                try {
                    let aiResponseData = await getOpenAiEmailResponse(req, res, prompt);
                    let emailData = aiResponseData.response;
                    let generatedEmail = emailData ? emailData.email : "";
                    let emailBodyData = (generatedEmail && generatedEmail.body) ? generatedEmail.body : "";
                    let emailEndingSignature = (generatedEmail && generatedEmail.email_ending_signature) ? generatedEmail.email_ending_signature : "";

                    // Format body and signature
                    emailBodyData = (emailBodyData.includes('\n')) ? emailBodyData.replace(/\n/g, '<br>') : emailBodyData;

                    if (emailEndingSignature != "" && emailEndingSignature.includes('\n')) {
                        if (emailEndingSignature.includes(',')) {
                            let signaturePart = emailEndingSignature.split(',');
                            emailEndingSignature = signaturePart[0] + ',' + userBusinessName;
                        }
                    }
                    if (!emailBodyData.includes('<br>')) {
                        if (emailBodyData.includes(',')) {
                            emailBodyData = emailBodyData.replace(/,/, ',<br><br>');
                        } else {
                            let signIndex = emailBodyData.indexOf('!');
                            if (signIndex !== -1) {
                                emailBodyData = emailBodyData.slice(0, signIndex + 1) + '<br><br>' + emailBodyData.slice(signIndex + 1);
                            }
                        }
                    }
                    if (emailEndingSignature != "" && !emailEndingSignature.includes('<br>')) {
                        if (emailEndingSignature.includes(',')) {
                            let signaturePart = emailEndingSignature.split(',');
                            emailEndingSignature = signaturePart[0] + ',' + userBusinessName;
                        }
                    } else {
                        if (emailEndingSignature.includes(',')) {
                            let signaturePart = emailEndingSignature.split(',');
                            emailEndingSignature = signaturePart[0] + ',' + userBusinessName;
                        }
                    }

                    // Handle signup email edit
                    if (signupEmailEdit != "") {
                        generatedEmail['email_ending_signature'] = "";
                        emailData['email']['email_ending_signature'] = "";
                    } else {
                        generatedEmail['email_ending_signature'] = emailEndingSignature;
                        emailData['email']['email_ending_signature'] = emailEndingSignature;
                    }
                    emailData['email']['body'] = emailBodyData;

                    if (aiResponseData.status == STATUS_SUCCESS && generatedEmail) {
                        // Save assistant message
                        let logsOption = {
                            user_id: userId,
                            ai_campaign_parent_id: aiCampaignParentId,
                            content: generatedEmail,
                            user_prompt: emailUserContent,
                            system_prompt: EMAIL_EDIT_PROMPT_SAVED.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate),
                            replace_data: dataToUpdate,
                            signup_email_flag: signupEmailEdit,
                            role: AI_ROLE_ASSISTANT,
                        };
                        let saveEmailLog = await saveAiEmailLogs(req, res, logsOption);

                        if (saveEmailLog.status == STATUS_SUCCESS) {
                            let lastInsertedId = saveEmailLog.result || "";
                            let addPollToggle = saveEmailLog.add_poll_toggle || "";

                            finalResponse = {
                                data: {
                                    status: STATUS_SUCCESS,
                                    result: emailData,
                                    add_poll_toggle: addPollToggle,
                                    email_log_id: lastInsertedId,
                                    message: res.__("front.ai_bot.email_has_been_updated_successfully"),
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
                        // Delete user log if OpenAI failed
                        let deleteOption = {
                            user_id: userId,
                            ai_campaign_parent_id: aiCampaignParentId,
                            content: emailUserContent,
                            role: AI_ROLE_USER,
                        };
                        await tableAiEmailLogs.deleteOne(deleteOption);
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
                    // Handle OpenAI or DB error
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
                // If no template log, use campaign email for prompt context
                let content = campaignEmail ? campaignEmail.content : "";
                let emailHeading = content && content.email_heading ? content.email_heading : "";
                let emailSubject = content && content.subject ? content.subject : "";
                let emailBody = content && content.body ? content.body : "";
                let ctaText = content && content.cta_text ? content.cta_text : "";
                let bulletPoints = content && content.bullet_points ? content.bullet_points : [];
                let emailClosingParagraph = content && content.email_closing_paragraph ? content.email_closing_paragraph : "";
                let emailEndingSignature = content && content.email_ending_signature ? content.email_ending_signature : "";

                let dataToUpdate = "";
                if (emailHeading != "") dataToUpdate += `Email Heading - ${emailHeading}; `;
                if (emailSubject != "") dataToUpdate += `Subject - ${emailSubject}; `;
                if (emailBody != "") dataToUpdate += `Body - ${emailBody}; `;
                if (bulletPoints.length > 0) {
                    if (signupEmailEdit != "") {
                        dataToUpdate += `Bullet point(s) :- `;
                        bulletPoints.forEach(item => {
                            dataToUpdate += item + ",";
                        });
                    } else {
                        dataToUpdate += `Bullet point(s) heading(s) and paragraph(s) :- `;
                        bulletPoints.forEach(item => {
                            let keys = Object.keys(item).slice(0, 2);
                            dataToUpdate += keys.map(key => `${key} : "${item[key]}"`).join(', ');
                        });
                    }
                }
                if (emailClosingParagraph != "") dataToUpdate += `Email Closing Paragraph - ${emailClosingParagraph}; `;
                if (emailEndingSignature != "") dataToUpdate += `Email Ending Signature - ${emailEndingSignature}; `;
                if (ctaText != "") dataToUpdate += `Cta Text - ${ctaText}; `;

                let systemContent = (signupEmailEdit != "")
                    ? INSIDER_EMAIL_EDIT_SYSTEM_PROMPT.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate)
                    : EMAIL_EDIT_SYSTEM_PROMPT.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate);
                let userEmailFormat = (signupEmailEdit != "") ? INSIDER_USER_EMAIL_FORMAT : EDIT_EMAIL_FORMATE;

                let systemPrompt = {
                    role: "system",
                    content: systemContent,
                };
                let userPrompt = {
                    role: AI_ROLE_USER,
                    content: emailUserContent + "; " + userEmailFormat,
                };

                if (emailLogsHistory.length > 0) {
                    emailLogsHistory.unshift(systemPrompt);
                    emailLogsHistory.push(userPrompt);
                }

                let prompt = {
                    system_prompt: systemPrompt,
                    user_prompt: userPrompt,
                    previous_chat: emailLogsHistory,
                    system_prompt_without_format: systemContent,
                    user_prompt_without_format: emailUserContent,
                };

                // Get OpenAI response and handle result
                try {
                    let aiResponseData = await getOpenAiEmailResponse(req, res, prompt);
                    let emailData = aiResponseData.response;
                    let generatedEmail = emailData ? emailData.email : "";
                    let emailBodyData = (generatedEmail && generatedEmail.body) ? generatedEmail.body : "";
                    let emailEndingSignature = (generatedEmail && generatedEmail.email_ending_signature) ? generatedEmail.email_ending_signature : "";

                    emailBodyData = (emailBodyData.includes('\n')) ? emailBodyData.replace(/\n/g, '<br>') : emailBodyData;

                    if (emailEndingSignature != "" && emailEndingSignature.includes('\n')) {
                        if (emailEndingSignature.includes(',')) {
                            let signaturePart = emailEndingSignature.split(',');
                            emailEndingSignature = signaturePart[0] + ',' + userBusinessName;
                        }
                    }
                    if (!emailBodyData.includes('<br>')) {
                        if (emailBodyData.includes(',')) {
                            emailBodyData = emailBodyData.replace(/,/, ',<br><br>');
                        } else {
                            let signIndex = emailBodyData.indexOf('!');
                            if (signIndex !== -1) {
                                emailBodyData = emailBodyData.slice(0, signIndex + 1) + '<br><br>' + emailBodyData.slice(signIndex + 1);
                            }
                        }
                    }
                    if (emailEndingSignature != "" && !emailEndingSignature.includes('<br>')) {
                        if (emailEndingSignature.includes(',')) {
                            let signaturePart = emailEndingSignature.split(',');
                            emailEndingSignature = signaturePart[0] + ',' + userBusinessName;
                        }
                    } else {
                        if (emailEndingSignature.includes(',')) {
                            let signaturePart = emailEndingSignature.split(',');
                            emailEndingSignature = signaturePart[0] + ',' + userBusinessName;
                        }
                    }

                    if (signupEmailEdit != "") {
                        generatedEmail['email_ending_signature'] = "";
                        emailData['email']['email_ending_signature'] = "";
                    } else {
                        generatedEmail['email_ending_signature'] = emailEndingSignature;
                        emailData['email']['email_ending_signature'] = emailEndingSignature;
                    }
                    emailData['email']['body'] = emailBodyData;

                    if (aiResponseData.status == STATUS_SUCCESS && generatedEmail) {
                        let logsOption = {
                            user_id: userId,
                            ai_campaign_parent_id: aiCampaignParentId,
                            content: generatedEmail,
                            signup_email_flag: signupEmailEdit,
                            user_prompt: emailUserContent,
                            system_prompt: EMAIL_EDIT_PROMPT_SAVED.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate),
                            replace_data: dataToUpdate,
                            role: AI_ROLE_ASSISTANT,
                        };
                        let saveEmailLog = await saveAiEmailLogs(req, res, logsOption);

                        if (saveEmailLog.status == STATUS_SUCCESS) {
                            let lastInsertedId = saveEmailLog.result || "";
                            let addPollToggle = saveEmailLog.add_poll_toggle || "";

                            finalResponse = {
                                data: {
                                    status: STATUS_SUCCESS,
                                    result: emailData,
                                    add_poll_toggle: addPollToggle,
                                    email_log_id: lastInsertedId,
                                    message: res.__("front.ai_bot.email_has_been_updated_successfully"),
                                }
                            };
                            return returnApiResult(req, res, finalResponse);
                        } else {
                            finalResponse = {
                                data: {
                                    status: STATUS_ERROR,
                                    result: {},
                                    email_log_id: "",
                                    message: res.__("front.system.something_going_wrong_please_try_again"),
                                }
                            };
                            return returnApiResult(req, res, finalResponse);
                        }
                    } else {
                        // Delete user log if OpenAI failed
                        let deleteOption = {
                            user_id: userId,
                            ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                            content: emailUserContent,
                            role: AI_ROLE_USER,
                        };
                        await tableAiEmailLogs.deleteOne(deleteOption);
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
            // Handle DB error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveAiEmailTemplate();

    /**
     * Function is used to get AI email history
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getEmailTemplateHistory = async (req, res) => {
        let finalResponse = {};
        // Get user data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatParentId = req.body.campaign_chat_parent_id ? req.body.campaign_chat_parent_id : "";

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

        // Build query condition for fetching chat history
        let commonCondition = {
            user_id: newObjectIdDefault(userId),
            is_deleted: NOT_DELETED,
            content: { $ne: "" },
            ai_campaign_parent_id: newObjectIdDefault(aiCampaignChatParentId)
        };

        try {
            // Fetch email logs history using async/await for faster response
            const result = await tableAiEmailLogs.find(commonCondition).toArray();

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
        } catch (err) {
            // Handle DB error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getEmailTemplateHistory();

    /**
     * Function is used to save AI email logs with async/await and parallel queries for faster response.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object>} result object
     */
    const saveAiEmailLogs = async (req, res, options) => {
        let userId = options.user_id ? options.user_id : "";
        let aiCampaignParentId = options.ai_campaign_parent_id ? options.ai_campaign_parent_id : "";
        let content = options.content ? options.content : "";
        let replyContent = options.reply_content ? options.reply_content : "";
        let role = options.role ? options.role : "";
        let signupEmailFlag = options.signup_email_flag ? options.signup_email_flag : "";
        let userFinalPrompt = options.user_prompt ? options.user_prompt : "";
        let systemFinalPrompt = options.system_prompt ? options.system_prompt : "";
        let systemReplaceData = options.replace_data ? options.replace_data : "";

        let insertData = {
            user_id: newObjectIdDefault(userId),
            ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
            role: role,
            content: content,
            signup_email: (signupEmailFlag != "") ? true : false,
            is_deleted: NOT_DELETED,
            created: getUtcDate(),
        };

        try {
            // Run both queries in parallel for performance
            const [toggleFlagResult, pollCustomUrlResult] = await Promise.all([
                // Get toggle flag for poll engagement
                tableAiCampaignChat.findOne(
                    {
                        user_id: newObjectIdDefault(userId),
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        type: AI_RESPONSE_TYPE_EMAIL
                    },
                    { projection: { _id: 1, add_poll_toggle: 1 } }
                ),
                // Get poll custom URL
                polls.findOne(
                    {
                        user_id: newObjectIdDefault(userId),
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        type: POLL_AI_TYPE
                    },
                    { projection: { custom_url: 1 } }
                )
            ]);

            // Extract values from query results
            let getToggleFlag = toggleFlagResult && toggleFlagResult.add_poll_toggle ? toggleFlagResult.add_poll_toggle : "";
            let getPollCustomUrl = pollCustomUrlResult && pollCustomUrlResult.custom_url ? pollCustomUrlResult.custom_url : "";

            // If assistant, add poll custom URL and toggle flag
            if (role === AI_ROLE_ASSISTANT) {
                if (insertData.content && typeof insertData.content === "object") {
                    insertData.content["custom_url"] = POLL_VIEW_PAGE_URL + getPollCustomUrl;
                }
                insertData["add_poll_toggle"] = getToggleFlag;
            }

            // If user, add reply content
            if (role === AI_ROLE_USER) {
                insertData["reply_content"] = replyContent;
            }

            // Insert the log entry
            const insertResult = await tableAiEmailLogs.insertOne(insertData);

            let insertedId = insertResult && insertResult.insertedId ? insertResult.insertedId : "";

            // If assistant and system prompt provided, save campaign logs as well
            if (role === AI_ROLE_ASSISTANT && systemFinalPrompt !== "") {
                // Remove custom_url from content before saving campaign logs
                if (content && typeof content === "object" && content.custom_url) {
                    delete content.custom_url;
                }
                let optionsData = {
                    user_id: userId,
                    ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                    campaign_type: DEFAULT_CAMPAIGN,
                    type: "email",
                    user_prompt: userFinalPrompt,
                    system_prompt: EMAIL_EDIT_PROMPT_SAVED,
                    system_replace_data: `{DATA_NEED_TO_UPDATE}: ${systemReplaceData}`,
                    user_final_prompt: userFinalPrompt,
                    system_final_prompt: systemFinalPrompt,
                    final_output: content,
                    is_edit: true,
                };
                await saveAllCampaignLogs(optionsData);
            }

            // Success response
            return {
                status: STATUS_SUCCESS,
                result: insertedId,
                add_poll_toggle: getToggleFlag,
            };
        } catch (err) {
            // Error response
            return {
                status: STATUS_ERROR,
                result: "",
                add_poll_toggle: "",
            };
        }
    }; // end saveAiEmailLogs();


    /**
     * Function is used to update campaign email with async/await and parallel queries.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updateCampaignEmail = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user and request data
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            const aiCampaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            const emailLogId = req.body.email_log_id ? newObjectIdDefault(req.body.email_log_id) : "";
            const customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

            // Validate required fields
            if (!userId || !aiCampaignChatId || !emailLogId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare common condition for fetching email log
            const commonCondition = {
                _id: emailLogId,
                user_id: userId,
                role: AI_ROLE_ASSISTANT,
                is_deleted: NOT_DELETED,
            };

            // Fetch email log details
            const result = await tableAiEmailLogs.findOne(
                commonCondition,
                { projection: { _id: 1, content: 1, add_poll_toggle: 1, ai_campaign_parent_id: 1, signup_email: 1 } }
            );

            if (!result) {
                // No record found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let emailContent = result.content ? result.content : {};
            let addPollToggle = result.add_poll_toggle ? result.add_poll_toggle : TOGGLE_POLL_ON;
            let aiCampaignParentId = result.ai_campaign_parent_id ? result.ai_campaign_parent_id : "";
            let signupEmailEdit = result.signup_email ? result.signup_email : "";

            // Prepare campaign chat condition
            const campaignChatCondition = {
                _id: newObjectIdDefault(aiCampaignChatId),
                user_id: newObjectIdDefault(userId),
                role: AI_ROLE_ASSISTANT,
                type: AI_RESPONSE_TYPE_EMAIL,
            };

            // If not a signup email edit, update images from campaign chat
            if (signupEmailEdit === "" || signupEmailEdit === false) {
                // Fetch campaign chat for images
                const editedEmailCampaign = await tableAiCampaignChat.findOne(
                    campaignChatCondition,
                    { projection: { _id: 1, content: 1 } }
                );

                const campaignBannerImage = (editedEmailCampaign && editedEmailCampaign.content && editedEmailCampaign.content['banner_image']) ? editedEmailCampaign.content['banner_image'] : "";
                const campaignBulletPoints = (editedEmailCampaign && editedEmailCampaign.content && editedEmailCampaign.content['bullet_points']) ? editedEmailCampaign.content['bullet_points'] : [];
                const bulletImage1 = (campaignBulletPoints.length > 0 && campaignBulletPoints[0]['image1']) ? campaignBulletPoints[0]['image1'] : "";
                const bulletImage2 = (campaignBulletPoints.length > 0 && campaignBulletPoints[1]['image2']) ? campaignBulletPoints[1]['image2'] : "";
                const bulletImage3 = (campaignBulletPoints.length > 0 && campaignBulletPoints[2]['image3']) ? campaignBulletPoints[2]['image3'] : "";

                emailContent['banner_image'] = campaignBannerImage;
                if (emailContent['bullet_points'] && Array.isArray(emailContent['bullet_points'])) {
                    if (emailContent['bullet_points'][0]) emailContent['bullet_points'][0]['image1'] = bulletImage1;
                    if (emailContent['bullet_points'][1]) emailContent['bullet_points'][1]['image2'] = bulletImage2;
                    if (emailContent['bullet_points'][2]) emailContent['bullet_points'][2]['image3'] = bulletImage3;
                }
            }

            // Update campaign chat email details
            const updateResult = await tableAiCampaignChat.updateOne(
                campaignChatCondition,
                { $set: { content: emailContent, add_poll_toggle: addPollToggle, is_edited: true } }
            );

            if (!updateResult || updateResult.modifiedCount === 0) {
                // Error updating campaign chat
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Run queries in parallel for poll and newsletter template
            const [
                lastGeneratedPoll,
                campaignNewsletterTemplate
            ] = await Promise.all([
                polls.findOne(
                    {
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                        user_id: newObjectIdDefault(userId),
                        type: POLL_AI_TYPE
                    },
                    { projection: { custom_url: 1 } }
                ),
                campaignNewsletterCollection.findOne({
                    _id: newObjectIdDefault(CAMPAIGN_NEWSLETTER_TEMPLATE_ID)
                })
            ]);

            // Prepare poll custom URL
            const pollCustomUrl = (lastGeneratedPoll && lastGeneratedPoll.custom_url) ? POLL_VIEW_PAGE_URL + lastGeneratedPoll.custom_url : "";

            // Prepare email and business details
            const userEmail = res.locals.settings["Email.user_email"];
            const emailHost = res.locals.settings["Email.host"];
            const emailPassword = res.locals.settings["Email.password"];
            const emailPort = res.locals.settings["Email.port"];

            const emailHeading = emailContent.email_heading ? emailContent.email_heading : "";
            const subject = emailContent.subject ? emailContent.subject : "";

            const bulletPoints = emailContent.bullet_points ? emailContent.bullet_points : [];
            const bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
            const bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
            const bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
            const bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
            const bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
            const bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
            const emailClosingText = emailContent.email_closing_paragraph ? emailContent.email_closing_paragraph : "";
            const emailSignature = emailContent.email_ending_signature ? emailContent.email_ending_signature : "";
            const ctaText = emailContent.cta_text ? emailContent.cta_text : "";
            const ctaTextNew = res.__("insiders.quick_question");
            const emailBody = emailContent.body;
            let stringNewEmailBody = JSON.stringify(emailBody);
            stringNewEmailBody = stringNewEmailBody.replace(/"/g, ' ').replace(/\\n/g, '<br>');

            // Business details for sender
            const publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
            const nameOfTheBusiness = (publicBusinessInformaton && publicBusinessInformaton.name_of_the_business) ? publicBusinessInformaton.name_of_the_business : "";

            // If newsletter template exists and not a signup email edit, generate and save newsletter
            if (campaignNewsletterTemplate && (signupEmailEdit === "" || signupEmailEdit === false)) {
                let newsletterPageBody = campaignNewsletterTemplate.body ? campaignNewsletterTemplate.body : "";
                let newsletterDesignJson = campaignNewsletterTemplate.design_json ? campaignNewsletterTemplate.design_json : "";

                // Replace placeholders in newsletter body and design JSON
                newsletterDesignJson = JSON.stringify(newsletterDesignJson);
                newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_EMAIL_HEADING}', 'g'), emailHeading)
                    .replace(RegExp('{AI_GENERATE_EMAIL_SUBJECT}', 'g'), subject)
                    .replace(RegExp('{AI_GENERATE_EMAIL_DESCRIPTION}', 'g'), stringNewEmailBody)
                    .replace(RegExp('{BULLET_POINT1}', 'g'), bulletPoint1)
                    .replace(RegExp('{BULLET_POINT2}', 'g'), bulletPoint2)
                    .replace(RegExp('{BULLET_POINT3}', 'g'), bulletPoint3)
                    .replace(RegExp('{BULLET_HEADING1}', 'g'), bulletHeading1)
                    .replace(RegExp('{BULLET_HEADING2}', 'g'), bulletHeading2)
                    .replace(RegExp('{BULLET_HEADING3}', 'g'), bulletHeading3)
                    .replace(RegExp('{AI_GENERATE_EMAIL_ENDING_TEXT}', 'g'), emailClosingText)
                    .replace(RegExp('{EMAIL_ENDING_SIGNATURE}', 'g'), emailSignature)
                    .replace(RegExp('{AI_GENERATE_CTA_LINK}', 'g'), ctaText)
                    .replace(RegExp('{OTHER_CTA_TEXT}', 'g'), ctaTextNew)
                    .replace(RegExp('{AI_GENERATE_POLL_LINK}', 'g'), pollCustomUrl);

                newsletterDesignJson = newsletterDesignJson.replace(RegExp('{AI_GENERATE_EMAIL_HEADING}', 'g'), emailHeading)
                    .replace(RegExp('{AI_GENERATE_EMAIL_SUBJECT}', 'g'), subject)
                    .replace(RegExp('{AI_GENERATE_EMAIL_DESCRIPTION}', 'g'), stringNewEmailBody)
                    .replace(RegExp('{BULLET_POINT1}', 'g'), bulletPoint1)
                    .replace(RegExp('{BULLET_POINT2}', 'g'), bulletPoint2)
                    .replace(RegExp('{BULLET_POINT3}', 'g'), bulletPoint3)
                    .replace(RegExp('{BULLET_HEADING1}', 'g'), bulletHeading1)
                    .replace(RegExp('{BULLET_HEADING2}', 'g'), bulletHeading2)
                    .replace(RegExp('{BULLET_HEADING3}', 'g'), bulletHeading3)
                    .replace(RegExp('{AI_GENERATE_EMAIL_ENDING_TEXT}', 'g'), emailClosingText)
                    .replace(RegExp('{EMAIL_ENDING_SIGNATURE}', 'g'), emailSignature)
                    .replace(RegExp('{OTHER_CTA_TEXT}', 'g'), ctaTextNew)
                    .replace(RegExp('{AI_GENERATE_POLL_LINK}', 'g'), pollCustomUrl);

                newsletterDesignJson = JSON.parse(newsletterDesignJson);

                // Save the generated newsletter template
                const emailCampaignTemplateResponse = await addEmailTemplateNewsletter({
                    template_title: emailHeading,
                    subject: subject,
                    body: newsletterPageBody,
                    description: emailHeading,
                    user_id: userId,
                    customer_id: customerId,
                    from: nameOfTheBusiness ? removeSpecialCharacters(nameOfTheBusiness) : "",
                    from_email: userEmail,
                    attach_reward: "",
                    host: emailHost,
                    port: emailPort,
                    email_password: emailPassword,
                    template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
                    design_json: newsletterDesignJson,
                    ai_bot: true,
                    skip_smtp: true,
                    ai_campaign_name_id: newObjectIdDefault(aiCampaignParentId),
                    ai_campaign_chat_id: newObjectIdDefault(aiCampaignChatId),
                    email_descriptions: {
                        [DEFAULT_LANGUAGE_MONGO_ID]: {
                            language_id: DEFAULT_LANGUAGE_MONGO_ID,
                            subject: subject,
                            body: newsletterPageBody
                        }
                    },
                });

                const editEmailCampaignTemplateId = emailCampaignTemplateResponse.email_inserted_id ? emailCampaignTemplateResponse.email_inserted_id : "";

                // Convert HTML to image and update campaign chat with newsletter email id
                if (editEmailCampaignTemplateId) {
                    await htmltoImageConvert(req, res, editEmailCampaignTemplateId);
                    await tableAiCampaignChat.updateOne(
                        {
                            _id: newObjectIdDefault(aiCampaignChatId),
                            ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                            user_id: newObjectIdDefault(userId),
                            type: AI_RESPONSE_TYPE_EMAIL
                        },
                        {
                            $set: { newsletter_email_id: newObjectIdDefault(editEmailCampaignTemplateId) }
                        }
                    );
                }
            }

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.ai_bot.campaign_email_has_been_updated_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end updateCampaignEmail();


    /**
     * Function is used to edit campaign history
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.editCampaignHistory = async (req, res) => {
        let finalResponse = {};

        // Get user data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let aiCampaignNameId = req.body.ai_campaign_name_id ? newObjectIdDefault(req.body.ai_campaign_name_id) : "";
        let aiCampaignCreatedName = req.body.ai_campaign_created_name ? req.body.ai_campaign_created_name : "";

        // Validate required fields
        if (!userId || !aiCampaignNameId || !aiCampaignCreatedName) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Build query condition
        let commonCondition = {
            _id: aiCampaignNameId,
            user_id: userId,
        };

        try {
            // Update campaign name using async/await for faster response
            const updateResult = await tableAiCampaignName.updateOne(
                commonCondition,
                { $set: { ai_campaign_created_name: aiCampaignCreatedName } }
            );

            // Check if update was successful
            if (updateResult && updateResult.modifiedCount > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        ai_campaign_created_name: aiCampaignCreatedName,
                        message: res.__("front.ai.ai_campaign_name_updated_successfully"),
                    }
                };
            } else {
                // No document was updated (possibly not found)
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        ai_campaign_created_name: aiCampaignCreatedName,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle DB error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    ai_campaign_created_name: aiCampaignCreatedName,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end editCampaignHistory();


    /**
     * Function to upload image for AI generated email template using async/await for faster response.
     *
     * @return json 
     **/
    this.aiEmailUploadImage = async (req, res) => {
        let finalResponse = {};

        // Get user and request data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let imageType = req.body.image_type ? req.body.image_type : "";
        let AiEmailImage = (req.files && req.files.ai_email_image) ? req.files.ai_email_image : "";
        let aiCampaignParentId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
        let aiCampaignOptionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";
        let campaignType = req.body.campaign_type ? req.body.campaign_type : "";
        let generatedHtml = req.body.generated_html ? req.body.generated_html : "";
        let emailEditManually = req.body.email_edit_manually ? req.body.email_edit_manually : "";
        let dynamicTableName = (campaignType == INSIDER_POLL_CAMPAIGN) ? TABLE_INSIDER_AI_CAMPAIGN_CHAT : TABLE_AI_CAMPAIGN_CHAT;

        const collectionAccourdingTableName = db.collection(dynamicTableName);

        // Validate required fields
        if (!userId || !aiCampaignParentId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Build query condition for campaign chat
        let optionsDataforParent = {
            type: "email",
            user_id: userId,
            ai_campaign_parent_id: aiCampaignParentId
        };

        // Add option_id for insider poll campaign
        if (campaignType == INSIDER_POLL_CAMPAIGN) {
            optionsDataforParent['option_id'] = aiCampaignOptionId;
        }

        try {
            // Find campaign chat using async/await
            const chatResult = await collectionAccourdingTableName.findOne(optionsDataforParent);

            if (!chatResult) {
                // No campaign found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare upload options
            let options = {
                image: AiEmailImage,
                filePath: AI_EMAIL_IMAGES_FILE_PATH,
                oldPath: ""
            };

            // Upload email template image (await Promise)
            let response = await moveUploadedFile(req, res, options);

            if (response.status == STATUS_ERROR) {
                // Send error response
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        image_name: "",
                        full_image_url: "",
                        message: response.message
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let imageName = response.fileName ? response.fileName : "";

            // Prepare update object for image and manual edits
            let saveImageOption = {
                modified: getUtcDate(),
                'content.generated_html': generatedHtml
            };

            // Set image fields based on imageType
            if (imageType == AI_EMAIL_BULLET_IMAGE_BANNER) {
                saveImageOption['content.banner_image'] = imageName;
            }
            if (imageType == AI_EMAIL_BULLET_IMAGE_1) {
                saveImageOption['content.bullet_points.0.image1'] = imageName;
            }
            if (imageType == AI_EMAIL_BULLET_IMAGE_2) {
                saveImageOption['content.bullet_points.1.image2'] = imageName;
            }
            if (imageType == AI_EMAIL_BULLET_IMAGE_3) {
                saveImageOption['content.bullet_points.2.image3'] = imageName;
            }

            // Handle manual content edits
            let editManuallyEmailHeading = emailEditManually.email_heading ? emailEditManually.email_heading : "";
            let editManuallySubject = emailEditManually.subject ? emailEditManually.subject : "";
            let editManuallyBody = emailEditManually.body ? (emailEditManually.body).replace(/\n/g, "<br>") : "";
            let editManuallyEmailClosingParagraph = emailEditManually.email_closing_paragraph ? (emailEditManually.email_closing_paragraph).replace(/\n/g, "<br>") : "";
            let editManuallyGeneratedHtml = emailEditManually.generated_html ? (emailEditManually.generated_html).replace(/\n/g, "<br>") : "";
            let editManuallyEmailEndingSignature = emailEditManually.email_ending_signature ? (emailEditManually.email_ending_signature).replace(/\n/g, "<br>") : "";
            let editManuallyBulletPoints = emailEditManually.bullet_points ? emailEditManually.bullet_points : [];

            if (editManuallyEmailHeading && editManuallyEmailHeading !== '') {
                saveImageOption['content.email_heading'] = editManuallyEmailHeading;
            }
            if (editManuallySubject && editManuallySubject !== '') {
                saveImageOption['content.subject'] = editManuallySubject;
            }
            if (editManuallyBody && editManuallyBody !== '') {
                saveImageOption['content.body'] = editManuallyBody;
            }
            if (editManuallyEmailClosingParagraph && editManuallyEmailClosingParagraph !== '') {
                saveImageOption['content.email_closing_paragraph'] = editManuallyEmailClosingParagraph;
            }
            if (editManuallyGeneratedHtml && editManuallyGeneratedHtml !== '') {
                saveImageOption['content.generated_html'] = editManuallyGeneratedHtml;
            }
            if (editManuallyEmailEndingSignature && editManuallyEmailEndingSignature !== '') {
                saveImageOption['content.email_ending_signature'] = editManuallyEmailEndingSignature;
            }
            if (editManuallyBulletPoints.length > 0) {
                if (editManuallyBulletPoints[0]) {
                    saveImageOption['content.bullet_points.0.heading1'] = editManuallyBulletPoints[0]['heading1'];
                    saveImageOption['content.bullet_points.0.paragraph1'] = editManuallyBulletPoints[0]['paragraph1'];
                }
                if (editManuallyBulletPoints[1]) {
                    saveImageOption['content.bullet_points.1.heading2'] = editManuallyBulletPoints[1]['heading2'];
                    saveImageOption['content.bullet_points.1.paragraph2'] = editManuallyBulletPoints[1]['paragraph2'];
                }
                if (editManuallyBulletPoints[2]) {
                    saveImageOption['content.bullet_points.2.heading3'] = editManuallyBulletPoints[2]['heading3'];
                    saveImageOption['content.bullet_points.2.paragraph3'] = editManuallyBulletPoints[2]['paragraph3'];
                }
            }

            // Update campaign chat with new image and manual edits
            await collectionAccourdingTableName.updateOne(optionsDataforParent, { $set: saveImageOption });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    image_name: imageName,
                    full_image_url: AI_EMAIL_IMAGES_URL + imageName,
                    message: res.__("front.default.ai_email_generate_image_saved_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end aiEmailUploadImage();


    /**
     * Function to delete an image for an AI email template using async/await for faster response.
     *
     * @return json 
     **/
    this.deleteImageForAiEmailTemplate = async (req, res) => {
        let finalResponse = {};

        // Get user and request data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let imageType = req.body.image_type ? req.body.image_type : "";
        let imageName = req.body.image_name ? req.body.image_name : "";
        let aiCampaignParentId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
        let aiCampaignOptionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";
        let campaignType = req.body.campaign_type ? req.body.campaign_type : "";
        let dynamicTableName = (campaignType == INSIDER_POLL_CAMPAIGN) ? TABLE_INSIDER_AI_CAMPAIGN_CHAT : TABLE_AI_CAMPAIGN_CHAT;
        let generatedHtml = req.body.generated_html ? req.body.generated_html : "";

        const collectionAccourdingTableName = db.collection(dynamicTableName);

        // Validate required fields
        if (!userId || !imageType || !aiCampaignParentId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Build query condition for campaign chat
        let optionsDataforParent = {
            type: "email",
            user_id: userId,
            ai_campaign_parent_id: aiCampaignParentId
        };

        // Add option_id for insider poll campaign
        if (campaignType == INSIDER_POLL_CAMPAIGN) {
            optionsDataforParent['option_id'] = aiCampaignOptionId;
        }

        try {
            // Find campaign chat using async/await
            const chatResult = await collectionAccourdingTableName.findOne(optionsDataforParent);

            if (!chatResult) {
                // No campaign found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Remove the image file asynchronously
            let imagesData = {
                file_path: AI_EMAIL_IMAGES_FILE_PATH + imageName
            };

            await removeFile(imagesData);

            // Prepare update object for removing image references and updating HTML
            let saveImageOption = {
                modified: getUtcDate(),
                'content.generated_html': generatedHtml
            };

            // Remove image fields based on imageType
            if (imageType == AI_EMAIL_BULLET_IMAGE_BANNER) {
                saveImageOption['content.banner_image'] = "";
            }
            if (imageType == AI_EMAIL_BULLET_IMAGE_1) {
                saveImageOption['content.bullet_points.0.image1'] = "";
            }
            if (imageType == AI_EMAIL_BULLET_IMAGE_2) {
                saveImageOption['content.bullet_points.1.image2'] = "";
            }
            if (imageType == AI_EMAIL_BULLET_IMAGE_3) {
                saveImageOption['content.bullet_points.2.image3'] = "";
            }

            // Remove container fields based on imageType
            if (imageType == AI_EMAIL_REMOVE_BULLET_BANNER_CONTAINER) {
                saveImageOption['content.remove_bullet_banner_container'] = true;
            }
            if (imageType == AI_EMAIL_REMOVE_BULLET_CONTAINER_1) {
                saveImageOption['content.bullet_points.0.remove_bullet_container_1'] = true;
            }
            if (imageType == AI_EMAIL_REMOVE_BULLET_CONTAINER_2) {
                saveImageOption['content.bullet_points.1.remove_bullet_container_2'] = true;
            }
            if (imageType == AI_EMAIL_REMOVE_BULLET_CONTAINER_3) {
                saveImageOption['content.bullet_points.2.remove_bullet_container_3'] = true;
            }

            // Update campaign chat with removed image and/or container using async/await
            await collectionAccourdingTableName.updateOne(optionsDataforParent, { $set: saveImageOption });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.ai_email_image.image_delete_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end deleteImageForAiEmailTemplate();


    /**
    * Function to generate welcome/newsletter email template after image upload
    * Uses async/await and Promise.all for parallel DB queries for faster response.
    * @return json 
    **/
    this.afterImageUploadGenerateWelcomeAndNewsletterEmail = async (req, res) => {
        let finalResponse = {};

        // Get user and campaign info
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignParentId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
        let optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";

        // Set collection for default or insider campaign
        let tableAiCampaignChatConditionAccourding = db.collection(TABLE_AI_CAMPAIGN_CHAT);
        let optionsCamptionchat = {
            "type": "email",
            "user_id": userId,
            "ai_campaign_parent_id": aiCampaignParentId
        };

        if (optionId != '') {
            optionsCamptionchat = {
                "type": "email",
                "user_id": userId,
                "option_id": optionId,
                "ai_campaign_parent_id": aiCampaignParentId
            };
            tableAiCampaignChatConditionAccourding = db.collection(TABLE_INSIDER_AI_CAMPAIGN_CHAT);
        }

        const campaignNewsletterCollection = db.collection(TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES);
        const welcomeEmailTemplate = db.collection(TABLE_WELCOME_EMAIL_TEMPLATES);

        if (!userId || !aiCampaignParentId) {
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Run all DB queries in parallel for performance
            const [
                campaignDetails,
                campaignNewsletterTemplate,
                welcomeEmailTemplateDetails
            ] = await Promise.all([
                tableAiCampaignChatConditionAccourding.findOne(optionsCamptionchat),
                campaignNewsletterCollection.findOne({ "_id": newObjectIdDefault(AFTER_CAMPAIGN_NEWSLETTER_TEMPLATE_ID) }),
                welcomeEmailTemplate.findOne({ "_id": newObjectIdDefault(AFTER_WELCOME_EMAIL_TEMPLATE_ID) })
            ]);

            // Validate all required data is present
            if (!campaignDetails || !campaignNewsletterTemplate || !welcomeEmailTemplateDetails) {
                finalResponse = {
                    'data': {
                        'status': STATUS_ERROR,
                        'message': res.__("front.ai_email_image.missing_segment_campaign_and_welcome_email"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Extract campaign details
            let aiCampaignChatId = campaignDetails['_id'] ? campaignDetails['_id'] : "";
            let welcomeEmailId = campaignDetails['welcome_email_id'] ? newObjectIdDefault(campaignDetails['welcome_email_id']) : "";
            let newsletterSegmentEmailId = campaignDetails['newsletter_email_id'] ? newObjectIdDefault(campaignDetails['newsletter_email_id']) : "";
            let campaignContentDetails = campaignDetails['content'] ? campaignDetails['content'] : {};
            let campaignEmailHeading = campaignContentDetails['email_heading'] || "";
            let campaignSubject = campaignContentDetails['subject'] || "";
            let campaignBody = campaignContentDetails['body'] || "";
            let campaignBannerImage = campaignContentDetails['banner_image'] ? AI_EMAIL_IMAGES_URL + campaignContentDetails['banner_image'] : "";
            let campaignRemoveBulletBannerContainer = campaignContentDetails['remove_bullet_banner_container'] || false;
            let campaignCustomUrl = campaignContentDetails['custom_url'] || "";
            let campaignEmailClosingParagraph = campaignContentDetails['email_closing_paragraph'] || "";
            let campaignEmailEndingSignature = campaignContentDetails['email_ending_signature'] ? campaignContentDetails['email_ending_signature'].toString() : "";
            campaignEmailEndingSignature = campaignEmailEndingSignature.replace(/\n/g, '<br>');
            let campaignCtaText = campaignContentDetails['cta_text'] || "";
            let campaignCtaTextLinkUrl = campaignContentDetails['cta_text_url'] || "";
            let campaignCtaTextNew = POLL_BUTTON_TEXT_NAME_FOR_AI;
            let campaignRewardId = campaignContentDetails['reward_id'] || "";
            let campaignBulletPoints = campaignContentDetails['bullet_points'] || [];

            // Bullet points
            let bulletPointsHeading1 = (campaignBulletPoints[0] && campaignBulletPoints[0]['heading1']) ? campaignBulletPoints[0]['heading1'] : "";
            let bulletPointsParagraph1 = (campaignBulletPoints[0] && campaignBulletPoints[0]['paragraph1']) ? campaignBulletPoints[0]['paragraph1'] : "";
            let bulletPointsImage1 = (campaignBulletPoints[0] && campaignBulletPoints[0]['image1']) ? AI_EMAIL_IMAGES_URL + campaignBulletPoints[0]['image1'] : "";
            let bulletPointsRemoveBulletBannerContainer1 = (campaignBulletPoints[0] && campaignBulletPoints[0]['remove_bullet_container_1']) ? campaignBulletPoints[0]['remove_bullet_container_1'] : false;

            let bulletPointsHeading2 = (campaignBulletPoints[1] && campaignBulletPoints[1]['heading2']) ? campaignBulletPoints[1]['heading2'] : "";
            let bulletPointsParagraph2 = (campaignBulletPoints[1] && campaignBulletPoints[1]['paragraph2']) ? campaignBulletPoints[1]['paragraph2'] : "";
            let bulletPointsImage2 = (campaignBulletPoints[1] && campaignBulletPoints[1]['image2']) ? AI_EMAIL_IMAGES_URL + campaignBulletPoints[1]['image2'] : "";
            let bulletPointsRemoveBulletBannerContainer2 = (campaignBulletPoints[1] && campaignBulletPoints[1]['remove_bullet_container_2']) ? campaignBulletPoints[1]['remove_bullet_container_2'] : false;

            let bulletPointsHeading3 = (campaignBulletPoints[2] && campaignBulletPoints[2]['heading3']) ? campaignBulletPoints[2]['heading3'] : "";
            let bulletPointsParagraph3 = (campaignBulletPoints[2] && campaignBulletPoints[2]['paragraph3']) ? campaignBulletPoints[2]['paragraph3'] : "";
            let bulletPointsImage3 = (campaignBulletPoints[2] && campaignBulletPoints[2]['image3']) ? AI_EMAIL_IMAGES_URL + campaignBulletPoints[2]['image3'] : "";
            let bulletPointsRemoveBulletBannerContainer3 = (campaignBulletPoints[2] && campaignBulletPoints[2]['remove_bullet_container_3']) ? campaignBulletPoints[2]['remove_bullet_container_3'] : false;

            // --- Welcome Email Template Generation ---
            if (welcomeEmailTemplateDetails) {
                let wlcPageBody = welcomeEmailTemplateDetails.body || "";
                let wlcDesignJson = welcomeEmailTemplateDetails.design_json || "";

                // Replace placeholders in body
                wlcPageBody = wlcPageBody.replace(/{CONTENT_BULLET_BANNER_IMAGE}/g, campaignBannerImage)
                    .replace(/{AI_GENERATE_EMAIL_HEADING}/g, campaignEmailHeading)
                    .replace(/{AI_GENERATE_CTA_TEXT}/g, campaignCtaText)
                    .replace(/{AI_GENERATE_CTA_LINK}/g, campaignCtaTextLinkUrl)
                    .replace(/{AI_GENERATE_EMAIL_DESCRIPTION}/g, campaignBody)
                    .replace(/{OTHER_CTA_TEXT}/g, campaignCtaTextNew)
                    .replace(/{AI_GENERATE_POLL_LINK}/g, campaignCustomUrl)
                    .replace(/{AI_GENERATE_EMAIL_ENDING_TEXT}/g, campaignEmailClosingParagraph)
                    .replace(/{EMAIL_ENDING_SIGNATURE}/g, campaignEmailEndingSignature);

                // Remove banner image height if not present
                if (campaignBannerImage == '') {
                    wlcPageBody = wlcPageBody.replace(/height: 285px;/g, 'height: 0px;')
                        .replace(/padding: 90px 0 10px;/g, 'padding: 0px 0 10px;');
                }

                // Bullet points in body
                wlcPageBody = wlcPageBody.replace(/{BULLET_POINT1_IMAGE}/g, bulletPointsImage1)
                    .replace(/{BULLET_HEADING1}/g, bulletPointsHeading1)
                    .replace(/{BULLET_POINT1}/g, bulletPointsParagraph1)
                    .replace(/{DISPLAY_NONE_BULLET_1};/g, (bulletPointsRemoveBulletBannerContainer1 || bulletPointsImage1 == '') ? "display: none;" : "");

                wlcPageBody = wlcPageBody.replace(/{BULLET_POINT2_IMAGE}/g, bulletPointsImage2)
                    .replace(/{BULLET_HEADING2}/g, bulletPointsHeading2)
                    .replace(/{BULLET_POINT2}/g, bulletPointsParagraph2)
                    .replace(/{DISPLAY_NONE_BULLET_2};/g, (bulletPointsRemoveBulletBannerContainer2 || bulletPointsImage2 == '') ? "display: none;" : "");

                wlcPageBody = wlcPageBody.replace(/{BULLET_POINT3_IMAGE}/g, bulletPointsImage3)
                    .replace(/{BULLET_HEADING3}/g, bulletPointsHeading3)
                    .replace(/{BULLET_POINT3}/g, bulletPointsParagraph3)
                    .replace(/{DISPLAY_NONE_BULLET_3};/g, (bulletPointsRemoveBulletBannerContainer3 || bulletPointsImage3 == '') ? "display: none;" : "");

                // Design JSON replacements
                let wlcDesignJsonStr = JSON.stringify(wlcDesignJson)
                    .replace(/{CONTENT_BULLET_BANNER_IMAGE}/g, campaignBannerImage)
                    .replace(/{AI_GENERATE_EMAIL_HEADING}/g, campaignEmailHeading)
                    .replace(/{AI_GENERATE_CTA_TEXT}/g, campaignCtaText)
                    .replace(/{AI_GENERATE_CTA_LINK}/g, campaignCtaTextLinkUrl)
                    .replace(/{AI_GENERATE_EMAIL_DESCRIPTION}/g, campaignBody)
                    .replace(/{OTHER_CTA_TEXT}/g, campaignCtaTextNew)
                    .replace(/{AI_GENERATE_POLL_LINK}/g, campaignCustomUrl)
                    .replace(/{AI_GENERATE_EMAIL_ENDING_TEXT}/g, campaignEmailClosingParagraph)
                    .replace(/{EMAIL_ENDING_SIGNATURE}/g, campaignEmailEndingSignature);

                if (campaignBannerImage == '') {
                    wlcDesignJsonStr = wlcDesignJsonStr.replace(/height: 285px;/g, 'height: 0px;')
                        .replace(/padding: 90px 0 10px;/g, 'padding: 0px 0 10px;');
                }

                wlcDesignJsonStr = wlcDesignJsonStr
                    .replace(/{BULLET_POINT1_IMAGE}/g, bulletPointsImage1)
                    .replace(/{BULLET_HEADING1}/g, bulletPointsHeading1)
                    .replace(/{BULLET_POINT1}/g, bulletPointsParagraph1)
                    .replace(/{DISPLAY_NONE_BULLET_1};/g, (bulletPointsRemoveBulletBannerContainer1 || bulletPointsImage1 == '') ? "display: none;" : "")
                    .replace(/{BULLET_POINT2_IMAGE}/g, bulletPointsImage2)
                    .replace(/{BULLET_HEADING2}/g, bulletPointsHeading2)
                    .replace(/{BULLET_POINT2}/g, bulletPointsParagraph2)
                    .replace(/{DISPLAY_NONE_BULLET_2};/g, (bulletPointsRemoveBulletBannerContainer2 || bulletPointsImage2 == '') ? "display: none;" : "")
                    .replace(/{BULLET_POINT3_IMAGE}/g, bulletPointsImage3)
                    .replace(/{BULLET_HEADING3}/g, bulletPointsHeading3)
                    .replace(/{BULLET_POINT3}/g, bulletPointsParagraph3)
                    .replace(/{DISPLAY_NONE_BULLET_3};/g, (bulletPointsRemoveBulletBannerContainer3 || bulletPointsImage3 == '') ? "display: none;" : "");

                let wlcDesignJsonParsed = {};
                try {
                    wlcDesignJsonParsed = JSON.parse(wlcDesignJsonStr);
                } catch (e) {
                    wlcDesignJsonParsed = wlcDesignJsonStr;
                }

                // Update welcome email template if id present
                if (welcomeEmailId != '') {
                    await emailNewsletterTemplate.updateOne(
                        {
                            '_id': newObjectIdDefault(welcomeEmailId),
                            'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
                        },
                        {
                            $set: {
                                "design_json": wlcDesignJsonParsed,
                                'body': wlcPageBody,
                            },
                        }
                    );
                    // Optionally convert HTML to image
                    htmltoImageConvert(req, res, welcomeEmailId).then(() => { });
                }

                // Update latest design for campaign chat data
                await tableAiCampaignChatConditionAccourding.updateOne(
                    { '_id': newObjectIdDefault(aiCampaignChatId) },
                    { $set: { "backend_generated_html": wlcPageBody } }
                );
            }

            // --- Campaign Newsletter Template Generation (only for default campaign) ---
            if (campaignNewsletterTemplate && optionId == '') {
                let segmentNewsletterPageBody = campaignNewsletterTemplate.body || "";
                let segmentNewsletterDesignJson = campaignNewsletterTemplate.design_json || "";

                // Replace placeholders in body
                segmentNewsletterPageBody = segmentNewsletterPageBody.replace(/{CONTENT_BULLET_BANNER_IMAGE}/g, campaignBannerImage)
                    .replace(/{AI_GENERATE_EMAIL_HEADING}/g, campaignEmailHeading)
                    .replace(/{AI_GENERATE_CTA_TEXT}/g, campaignCtaText)
                    .replace(/{AI_GENERATE_CTA_LINK}/g, campaignCtaTextLinkUrl)
                    .replace(/{AI_GENERATE_EMAIL_DESCRIPTION}/g, campaignBody)
                    .replace(/{OTHER_CTA_TEXT}/g, campaignCtaTextNew)
                    .replace(/{AI_GENERATE_POLL_LINK}/g, campaignCustomUrl)
                    .replace(/{AI_GENERATE_EMAIL_ENDING_TEXT}/g, campaignEmailClosingParagraph)
                    .replace(/{EMAIL_ENDING_SIGNATURE}/g, campaignEmailEndingSignature);

                if (campaignBannerImage == '') {
                    segmentNewsletterPageBody = segmentNewsletterPageBody.replace(/height: 285px;/g, 'height: 0px;')
                        .replace(/padding: 90px 0 10px;/g, 'padding: 0px 0 10px;');
                }

                segmentNewsletterPageBody = segmentNewsletterPageBody.replace(/{BULLET_POINT1_IMAGE}/g, bulletPointsImage1)
                    .replace(/{BULLET_HEADING1}/g, bulletPointsHeading1)
                    .replace(/{BULLET_POINT1}/g, bulletPointsParagraph1)
                    .replace(/{DISPLAY_NONE_BULLET_1};/g, (bulletPointsRemoveBulletBannerContainer1 || bulletPointsImage1 == '') ? "display: none;" : "")
                    .replace(/{BULLET_POINT2_IMAGE}/g, bulletPointsImage2)
                    .replace(/{BULLET_HEADING2}/g, bulletPointsHeading2)
                    .replace(/{BULLET_POINT2}/g, bulletPointsParagraph2)
                    .replace(/{DISPLAY_NONE_BULLET_2};/g, (bulletPointsRemoveBulletBannerContainer2 || bulletPointsImage2 == '') ? "display: none;" : "")
                    .replace(/{BULLET_POINT3_IMAGE}/g, bulletPointsImage3)
                    .replace(/{BULLET_HEADING3}/g, bulletPointsHeading3)
                    .replace(/{BULLET_POINT3}/g, bulletPointsParagraph3)
                    .replace(/{DISPLAY_NONE_BULLET_3};/g, (bulletPointsRemoveBulletBannerContainer3 || bulletPointsImage3 == '') ? "display: none;" : "");

                // Design JSON replacements
                let segmentNewsletterDesignJsonStr = JSON.stringify(segmentNewsletterDesignJson)
                    .replace(/{CONTENT_BULLET_BANNER_IMAGE}/g, campaignBannerImage)
                    .replace(/{AI_GENERATE_EMAIL_HEADING}/g, campaignEmailHeading)
                    .replace(/{AI_GENERATE_CTA_TEXT}/g, campaignCtaText)
                    .replace(/{AI_GENERATE_CTA_LINK}/g, campaignCtaTextLinkUrl)
                    .replace(/{AI_GENERATE_EMAIL_DESCRIPTION}/g, campaignBody)
                    .replace(/{OTHER_CTA_TEXT}/g, campaignCtaTextNew)
                    .replace(/{AI_GENERATE_POLL_LINK}/g, campaignCustomUrl)
                    .replace(/{AI_GENERATE_EMAIL_ENDING_TEXT}/g, campaignEmailClosingParagraph)
                    .replace(/{EMAIL_ENDING_SIGNATURE}/g, campaignEmailEndingSignature);

                if (campaignBannerImage == '') {
                    segmentNewsletterDesignJsonStr = segmentNewsletterDesignJsonStr.replace(/height: 285px;/g, 'height: 0px;')
                        .replace(/padding: 90px 0 10px;/g, 'padding: 0px 0 10px;');
                }

                segmentNewsletterDesignJsonStr = segmentNewsletterDesignJsonStr
                    .replace(/{BULLET_POINT1_IMAGE}/g, bulletPointsImage1)
                    .replace(/{BULLET_HEADING1}/g, bulletPointsHeading1)
                    .replace(/{BULLET_POINT1}/g, bulletPointsParagraph1)
                    .replace(/{DISPLAY_NONE_BULLET_1};/g, (bulletPointsRemoveBulletBannerContainer1 || bulletPointsImage1 == '') ? "display: none;" : "")
                    .replace(/{BULLET_POINT2_IMAGE}/g, bulletPointsImage2)
                    .replace(/{BULLET_HEADING2}/g, bulletPointsHeading2)
                    .replace(/{BULLET_POINT2}/g, bulletPointsParagraph2)
                    .replace(/{DISPLAY_NONE_BULLET_2};/g, (bulletPointsRemoveBulletBannerContainer2 || bulletPointsImage2 == '') ? "display: none;" : "")
                    .replace(/{BULLET_POINT3_IMAGE}/g, bulletPointsImage3)
                    .replace(/{BULLET_HEADING3}/g, bulletPointsHeading3)
                    .replace(/{BULLET_POINT3}/g, bulletPointsParagraph3)
                    .replace(/{DISPLAY_NONE_BULLET_3};/g, (bulletPointsRemoveBulletBannerContainer3 || bulletPointsImage3 == '') ? "display: none;" : "");

                let segmentNewsletterDesignJsonParsed = {};
                try {
                    segmentNewsletterDesignJsonParsed = JSON.parse(segmentNewsletterDesignJsonStr);
                } catch (e) {
                    segmentNewsletterDesignJsonParsed = segmentNewsletterDesignJsonStr;
                }

                // Update newsletter email after new generate
                if (newsletterSegmentEmailId) {
                    await emailNewsletterTemplate.updateOne(
                        {
                            '_id': newObjectIdDefault(newsletterSegmentEmailId),
                            'template_type': EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
                        },
                        {
                            $set: {
                                "design_json": segmentNewsletterDesignJsonParsed,
                                'body': segmentNewsletterPageBody,
                            },
                        }
                    );
                    // Optionally convert HTML to image
                    htmltoImageConvert(req, res, newsletterSegmentEmailId).then(() => { });
                }
            }

            // Send Success message
            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'message': res.__("front.ai_email_image.template_has_been_created_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle the error
            console.error('An error occurred:', error);
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'message': res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end afterImageUploadGenerateWelcomeAndNewsletterEmail();

    /**
     * Function is used to add CTA text URL using async/await for faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.addCtaUrlEmailMarketing = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignParentId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
        let aiCampaignOptionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";

        let url = req.body.url ? ensureHttpPrefix(req.body.url) : '';
        let campaignType = req.body.campaign_type ? req.body.campaign_type : "";
        let generatedHtml = req.body.generated_html ? req.body.generated_html : "";

        let dynamicTableName = (campaignType == INSIDER_POLL_CAMPAIGN) ? TABLE_INSIDER_AI_CAMPAIGN_CHAT : TABLE_AI_CAMPAIGN_CHAT;
        let collectionAccourdingTableName = db.collection(dynamicTableName);

        // Validate required fields
        if (!userId || !url || !aiCampaignParentId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Build query condition for updating CTA link
        let optionsDataforCtaLink = {
            user_id: newObjectIdDefault(userId),
            ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
            type: AI_RESPONSE_TYPE_EMAIL
        };

        // Add option_id for insider poll campaign
        if (campaignType == INSIDER_POLL_CAMPAIGN) {
            optionsDataforCtaLink['option_id'] = aiCampaignOptionId;
        }

        try {
            // Update CTA link and generated HTML using async/await
            const updateResult = await collectionAccourdingTableName.findOneAndUpdate(
                optionsDataforCtaLink,
                {
                    $set: {
                        "content.cta_text_url": url,
                        "content.generated_html": generatedHtml
                    }
                }
            );

            if (!updateResult || !updateResult.value) {
                // No document was updated (possibly not found)
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            } else {
                // Success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.ai_email_image.cta_url_added_successfully"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle DB error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end addCtaUrlEmailMarketing();


    /**
    * Function to generate welcome email PDF or image.
    * Uses async/await for all DB and file operations for better performance and cleaner code.
    * @param {*} req 
    * @param {*} res 
    */
    this.generateWelcomeEmailPdf = async (req, res) => {
        let finalResponse = {};

        try {
            // Sanitize input data
            req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

            // Get user and request data
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const userName = loginUserData.slug ? loginUserData.slug : "";
            const welcomeEmailId = req.body.welcome_email_id ? req.body.welcome_email_id : "";
            const insidersTemplateHtml = req.body.insiders_template_html ? req.body.insiders_template_html : "";
            const aiCampaignParentId = req.body.ai_campaign_parent_id ? newObjectIdDefault(req.body.ai_campaign_parent_id) : "";
            const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";
            const defaultDownloadType = "pdf";
            const downloadType = req.body.download_type ? req.body.download_type : defaultDownloadType;

            // Set collection and query options based on campaign type
            let tableAiCampaignChatConditionAccourding = db.collection(TABLE_AI_CAMPAIGN_CHAT);
            let optionsCamptionchat = {
                "type": "email",
                "user_id": userId,
                "is_deleted": NOT_DELETED,
                "ai_campaign_parent_id": aiCampaignParentId
            };
            if (optionId != '') {
                optionsCamptionchat = {
                    "type": "email",
                    "user_id": userId,
                    "option_id": optionId,
                    "is_deleted": NOT_DELETED,
                    "ai_campaign_parent_id": aiCampaignParentId
                };
                tableAiCampaignChatConditionAccourding = db.collection(TABLE_INSIDER_AI_CAMPAIGN_CHAT);
            }

            // Get business details for the logged-in user
            const publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
            const nameOfTheBusiness = publicBusinessInformaton && publicBusinessInformaton.name_of_the_business ? publicBusinessInformaton.name_of_the_business : "";
            const businessLogo = publicBusinessInformaton && publicBusinessInformaton.business_logo ? publicBusinessInformaton.business_logo : "";
            const businessRewardLogo = publicBusinessInformaton && publicBusinessInformaton.reward_image ? publicBusinessInformaton.reward_image : "";
            const businessIndustryName = publicBusinessInformaton && publicBusinessInformaton.business_industry_name ? publicBusinessInformaton.business_industry_name : "";
            const primaryAddress = publicBusinessInformaton && publicBusinessInformaton.primary_address ? publicBusinessInformaton.primary_address : "";
            let profileImageUrl = "";

            // Validate required fields
            if (!userId || !aiCampaignParentId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Fetch email template data using async/await
            // (No parallel queries needed here, but if you add more, use Promise.all)
            const result = await tableAiCampaignChatConditionAccourding.findOne(optionsCamptionchat);

            if (!result) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare HTML content
            let newsletterEmailActionBody = result.newsletter_email_action_body ? result.newsletter_email_action_body : "";
            let bodyHtml = result.backend_generated_html ? result.backend_generated_html : insidersTemplateHtml;

            // Remove all <p> tags using cheerio for a cleaner PDF/image
            const $ = cheerio.load(bodyHtml);
            $('p').remove();
            bodyHtml = $.html();

            // Set profile image URL (reward image preferred, fallback to business logo)
            if (businessRewardLogo) {
                profileImageUrl = USERS_URL + businessRewardLogo;
            } else if (businessLogo) {
                profileImageUrl = USERS_URL + businessLogo;
            }

            // Replace placeholders in HTML
            if (profileImageUrl) {
                const imgSrc = `<img src="${profileImageUrl}" style="max-height:100px;" >`;
                bodyHtml = bodyHtml.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), imgSrc);
            } else {
                bodyHtml = bodyHtml.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), '');
            }
            bodyHtml = bodyHtml.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);
            bodyHtml = bodyHtml.replace(RegExp('{BUSINESS_ADDRESS}', 'g'), primaryAddress);
            bodyHtml = bodyHtml.replace(RegExp('{CURRENT_YEAR}', 'g'), new Date().getFullYear());
            bodyHtml = bodyHtml.replace(RegExp('{EMAIL_ENDING_SIGNATURE}', 'g'), "Best Regards,</br> " + nameOfTheBusiness);
            bodyHtml = bodyHtml.replace(RegExp('line-height: 55px', 'g'), "line-height: 57px");

            // If supporting content is present, use it as the body
            if (newsletterEmailActionBody) {
                bodyHtml = newsletterEmailActionBody;
            }

            // Prepare file/folder names
            const fileUploadName = (downloadType === defaultDownloadType) ? `${userName}-email.pdf` : `${userName}-email.jpg`;
            const today = new Date();
            const newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
            createFolder(AI_EMAIL_GENERATE_PDF_FILE_PATH + newFolder);

            const filePath = AI_EMAIL_GENERATE_PDF_FILE_PATH;
            const newFileName = newFolder + Date.now() + '-' + changeFileName(fileUploadName);
            const uploadedFile = filePath + newFileName;
            const pdfImageUrl = AI_EMAIL_GENERATE_PDF_URL + newFileName;

            // Generate PDF or image using async/await
            if (downloadType === defaultDownloadType) {
                // PDF generation using puppeteer
                try {
                    const browser = await puppeteer.launch();
                    const page = await browser.newPage();
                    await page.setContent(bodyHtml);
                    await page.pdf({
                        path: uploadedFile,
                        format: 'A2',
                        printBackground: true,
                    });
                    await browser.close();

                    // Upload to S3 if enabled
                    if (UPLOAD_TO_S3) {
                        try {
                            const data = await fs.promises.readFile(uploadedFile);
                            const targetFolder = "ai_email_generate_pdf/" + newFileName;
                            const params = {
                                Bucket: process.env.AWS_BUCKET_NAME,
                                Key: S3_BUCKET_UPLOAD_PATH + targetFolder,
                                Body: data
                            };
                            // Upload file to S3 using promise
                            await new Promise((resolve, reject) => {
                                s3.upload(params, (uploadErr, uploadData) => {
                                    if (uploadErr) return reject(uploadErr);
                                    resolve(uploadData);
                                });
                            });
                            // Remove local file after upload
                            await removeFileOnlyLocalFolder({ file_path: uploadedFile });
                        } catch (err) {
                            console.error('Error uploading PDF to S3:', err);
                            finalResponse = {
                                data: {
                                    status: STATUS_ERROR,
                                    message: res.__("front.system.something_going_wrong_please_try_again"),
                                }
                            };
                            return returnApiResult(req, res, finalResponse);
                        }
                    }
                    // Success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            file_path: pdfImageUrl,
                            message: "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } catch (error) {
                    console.error('Error generating PDF:', error);
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            file_path: "",
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Image generation using wkhtmltoimage (callback-based, wrap in Promise for async/await)
                try {
                    await new Promise((resolve, reject) => {
                        wkhtmltoimage.generate(bodyHtml, { output: uploadedFile, width: WELCOME_EMAIL_GENERATE_HEIGHT }, (err) => {
                            if (err) return reject(err);
                            resolve();
                        });
                    });

                    // Upload to S3 if enabled
                    if (UPLOAD_TO_S3) {
                        try {
                            const data = await fs.promises.readFile(uploadedFile);
                            const targetFolder = "ai_email_generate_pdf/" + newFileName;
                            const params = {
                                Bucket: process.env.AWS_BUCKET_NAME,
                                Key: S3_BUCKET_UPLOAD_PATH + targetFolder,
                                Body: data
                            };
                            // Upload file to S3 using promise
                            await new Promise((resolve, reject) => {
                                s3.upload(params, (uploadErr, uploadData) => {
                                    if (uploadErr) return reject(uploadErr);
                                    resolve(uploadData);
                                });
                            });
                            // Remove local file after upload
                            await removeFileOnlyLocalFolder({ file_path: uploadedFile });
                        } catch (err) {
                            console.error('Error uploading image to S3:', err);
                            finalResponse = {
                                data: {
                                    status: STATUS_ERROR,
                                    message: res.__("front.system.something_going_wrong_please_try_again"),
                                }
                            };
                            return returnApiResult(req, res, finalResponse);
                        }
                    }
                    // Success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            file_path: pdfImageUrl,
                            message: "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } catch (error) {
                    console.error('Error generating image:', error);
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            file_path: "",
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }
        } catch (error) {
            // Handle any unexpected errors
            console.error('An error occurred:', error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end generateWelcomeEmailPdf();


}
module.exports = new AiEmailLogsTemplate();

