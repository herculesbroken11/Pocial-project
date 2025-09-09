const async = require('async');

const tableInsiderAiCampaignChat = db.collection(TABLE_INSIDER_AI_CAMPAIGN_CHAT);
const tableInsiderAiEmailLogs = db.collection(TABLE_INSIDER_AI_EMAIL_TEMPLATE_LOGS);
const polls = db.collection(TABLE_POLLS);
const rewards = db.collection(TABLE_REWARDS);

function insiderAiEmailLogsTemplate() {

    /**
     * Function is used to save insider ai email template
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.saveInsiderAiEmailTemplate = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

        let loginUserData = (req.user_data) ? req.user_data : "";
        let userId = (loginUserData._id) ? loginUserData._id : "";
        let aiCampaignChatId = (req.body.campaign_chat_id) ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let aiCampaignParentId = (req.body.campaign_chat_parent_id) ? newObjectIdDefault(req.body.campaign_chat_parent_id) : "";
        let pollOptionId = (req.body.poll_option_id) ? newObjectIdDefault(req.body.poll_option_id) : "";
        let emailAiContent = (req.body.ai_content) ? req.body.ai_content : "";
        let emailUserContent = (req.body.user_content) ? req.body.user_content : "";
        let emailReplyContent = (req.body.reply_content) ? req.body.reply_content : "";

        let publicBusinessInformation = (loginUserData) ? loginUserData.public_business_informaton : {};
        let businessName = (publicBusinessInformation.name_of_the_business) ? publicBusinessInformation.name_of_the_business : "";

        let finalResponse = {};

        if (userId == '' || aiCampaignChatId == '' || emailAiContent == '' || emailUserContent == '' || aiCampaignParentId == '' || pollOptionId == "") {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "result": [],
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Run all DB queries in parallel using Promise.all for faster response
            const [
                insiderCampaignEmail,
                insiderEmailTemplate,
                getInsiderEmailLogsResult,
                insiderEmailLogsHistory
            ] = await Promise.all([
                // Get campaign email
                tableInsiderAiCampaignChat.findOne(
                    { "_id": aiCampaignChatId, "option_id": pollOptionId },
                    { projection: { _id: 1, ai_campaign_parent_id: 1, content: 1 } }
                ),
                // Get insider ai log email
                tableInsiderAiEmailLogs.findOne(
                    { "_id": aiCampaignChatId, "poll_option_id": pollOptionId },
                    { projection: { _id: 1, ai_campaign_parent_id: 1, content: 1, role: 1 } }
                ),
                // Count insider ai log email
                tableInsiderAiEmailLogs.countDocuments({
                    "ai_campaign_parent_id": aiCampaignParentId,
                    "poll_option_id": pollOptionId,
                    'user_id': userId
                }),
                // Get insider ai log history (skipping the first)
                tableInsiderAiEmailLogs.find({
                    'ai_campaign_parent_id': newObjectIdDefault(aiCampaignParentId),
                    "poll_option_id": pollOptionId,
                    'user_id': newObjectIdDefault(userId)
                }, { projection: { _id: 0, role: 1, content: 1 } }).skip(1).toArray()
            ]);

            let userBusinessName = "<br>" + businessName;

            // Format previous assistant messages for prompt history
            if (insiderEmailLogsHistory && insiderEmailLogsHistory.length > 0) {
                insiderEmailLogsHistory.forEach(function (records) {
                    if (records.role == AI_ROLE_ASSISTANT) {
                        let emailHeading = (records.content.email_heading) ? records.content.email_heading : "";
                        let subject = (records.content.subject) ? records.content.subject : "";
                        let body = (records.content.body) ? records.content.body : "";
                        let bulletPoints = (records.content.bullet_points) ? records.content.bullet_points : [];
                        let bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
                        let bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
                        let bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
                        let bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
                        let bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
                        let bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
                        let emailClosingText = (records.content.email_closing_paragraph) ? records.content.email_closing_paragraph : "";
                        let emailSignature = (records.content.email_ending_signature) ? records.content.email_ending_signature : "";
                        let ctaText = records.content.cta_text;
                        records['content'] = `Following is the generated email. Email Heading - ${emailHeading}; Subject-${subject}; Body-${body}; Bullet Points- [{"heading1" : ${bulletHeading1},"paragraph1" : ${bulletPoint1},"image1" : "",}, {"heading2" : ${bulletHeading2},"paragraph2" : ${bulletPoint2},"image2" : ""},{"heading3" : ${bulletHeading3},"paragraph3" : ${bulletPoint3},"image3" : ""}]; Email closing text-${emailClosingText}; Email Signature-${emailSignature}; Cta Text- ${ctaText}.`;
                    } else {
                        records['content'] = records.content;
                    }
                });
            }

            // Save the first assistant message if no logs exist yet
            if (getInsiderEmailLogsResult == 0) {
                let logsOption = {
                    'user_id': userId,
                    'ai_campaign_parent_id': aiCampaignParentId,
                    'poll_option_id': pollOptionId,
                    'content': insiderCampaignEmail ? insiderCampaignEmail.content : "",
                    'role': AI_ROLE_ASSISTANT,
                }
                await saveInsiderAiEmailLogs(req, res, logsOption);
            }

            // Save the user message
            let userLogsOption = {
                'user_id': userId,
                'ai_campaign_parent_id': aiCampaignParentId,
                'poll_option_id': pollOptionId,
                'content': emailUserContent,
                'reply_content': emailReplyContent,
                'role': AI_ROLE_USER,
            }
            await saveInsiderAiEmailLogs(req, res, userLogsOption);

            let emailLogsDetail = !insiderEmailTemplate || (Object.keys(insiderEmailTemplate).length === 0 && insiderEmailTemplate.constructor === Object);

            // Prepare data for OpenAI prompt
            let content, emailHeading, emailSubject, emailBody, ctaText, bulletPoints, emailClosingParagraph, emailEndingSignature;
            if (insiderEmailTemplate && !emailLogsDetail) {
                content = insiderEmailTemplate.content || "";
            } else {
                content = insiderCampaignEmail ? insiderCampaignEmail.content : "";
            }
            emailHeading = (content && content.email_heading) ? content.email_heading : "";
            emailSubject = (content && content.subject) ? content.subject : "";
            emailBody = (content && content.body) ? content.body : "";
            ctaText = (content && content.cta_text) ? content.cta_text : "";
            bulletPoints = (content && content.bullet_points) ? content.bullet_points : [];
            emailClosingParagraph = (content && content.email_closing_paragraph) ? content.email_closing_paragraph : "";
            emailEndingSignature = (content && content.email_ending_signature) ? content.email_ending_signature : "";

            // Build the data to update string for the system prompt
            let dataToUpdate = "";
            if (emailHeading != "") dataToUpdate += `Email Heading - ${emailHeading}; `;
            if (emailSubject != "") dataToUpdate += `Subject - ${emailSubject}; `;
            if (emailBody != "") dataToUpdate += `Body - ${emailBody}; `;
            if (bulletPoints.length > 0) {
                dataToUpdate += `Bullet point(s) heading(s) and paragraph(s) :- `;
                bulletPoints.forEach(item => {
                    let keys = Object.keys(item).slice(0, 2);
                    dataToUpdate += keys.map(key => `${key} : "${item[key]}"`).join(', ');
                });
                dataToUpdate += '; ';
            }
            if (emailClosingParagraph != "") dataToUpdate += `Email Closing Paragraph - ${emailClosingParagraph}; `;
            if (emailEndingSignature != "") dataToUpdate += `Email Ending Signature - ${emailEndingSignature}; `;
            if (ctaText != "") dataToUpdate += `Cta Text - ${ctaText}; `;

            let systemContent = EMAIL_EDIT_SYSTEM_PROMPT.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate);

            let systemPrompt = {
                "role": "system",
                "content": systemContent,
            };

            let userPrompt = {
                "role": AI_ROLE_USER,
                "content": emailUserContent + "; " + EDIT_EMAIL_FORMATE,
            };

            let previousChat = insiderEmailLogsHistory ? [...insiderEmailLogsHistory] : [];
            if (previousChat.length > 0) {
                previousChat.unshift(systemPrompt);
                previousChat.push(userPrompt);
            }

            let prompt = {
                "system_prompt": systemPrompt,
                "user_prompt": userPrompt,
                "previous_chat": previousChat,
            };

            // Get OpenAI response for the email edit
            let aiResponseData = await getOpenAiEmailResponse(req, res, prompt);
            let emailData = aiResponseData.response;
            let generatedEmail = (emailData) ? emailData.email : "";
            let emailBodyData = (generatedEmail && generatedEmail.body) ? generatedEmail.body : "";
            let emailEndingSignatureGen = (generatedEmail && generatedEmail.email_ending_signature) ? generatedEmail.email_ending_signature : "";

            // Format body and signature for HTML
            if (emailBodyData && emailBodyData.includes('\n')) {
                emailBodyData = emailBodyData.replace(/\n/g, '<br>');
            }
            if (emailEndingSignatureGen && emailEndingSignatureGen.includes('\n')) {
                if (emailEndingSignatureGen.includes(',')) {
                    let signaturePart = emailEndingSignatureGen.split(',');
                    emailEndingSignatureGen = signaturePart[0] + ',' + userBusinessName;
                }
            }
            if (emailBodyData && !emailBodyData.includes('<br>')) {
                if (emailBodyData.includes(',')) {
                    emailBodyData = emailBodyData.replace(/,/, ',<br><br>');
                } else {
                    let signIndex = emailBodyData.indexOf('!');
                    if (signIndex !== -1) {
                        emailBodyData = emailBodyData.slice(0, signIndex + 1) + '<br><br>' + emailBodyData.slice(signIndex + 1);
                    }
                }
            }
            if (emailEndingSignatureGen && !emailEndingSignatureGen.includes('<br>')) {
                if (emailEndingSignatureGen.includes(',')) {
                    let signaturePart = emailEndingSignatureGen.split(',');
                    emailEndingSignatureGen = signaturePart[0] + ',' + userBusinessName;
                }
            } else if (emailEndingSignatureGen && emailEndingSignatureGen.includes(',')) {
                let signaturePart = emailEndingSignatureGen.split(',');
                emailEndingSignatureGen = signaturePart[0] + ',' + userBusinessName;
            }

            if (generatedEmail) {
                generatedEmail['email_ending_signature'] = emailEndingSignatureGen;
            }
            if (emailData && emailData.email) {
                emailData['email']['email_ending_signature'] = emailEndingSignatureGen;
                emailData['email']['body'] = emailBodyData;
            }

            if (aiResponseData.status == STATUS_SUCCESS && generatedEmail) {
                // Save assistant message
                let logsOption = {
                    'user_id': userId,
                    'ai_campaign_parent_id': aiCampaignParentId,
                    'poll_option_id': pollOptionId,
                    'content': generatedEmail,
                    'role': AI_ROLE_ASSISTANT,
                    'user_prompt': emailUserContent,
                    'system_prompt': EMAIL_EDIT_PROMPT_SAVED.replace(/{DATA_NEED_TO_UPDATE}/g, dataToUpdate),
                    'replace_data': dataToUpdate,
                };
                let saveEmailLog = await saveInsiderAiEmailLogs(req, res, logsOption);

                if (saveEmailLog.status == STATUS_SUCCESS) {
                    let lastInsertedId = saveEmailLog.result || "";
                    let addPollToggle = saveEmailLog.add_poll_toggle || "";
                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": emailData,
                            "add_poll_toggle": addPollToggle,
                            "email_log_id": lastInsertedId,
                            "message": res.__("front.ai_bot.campaign_email_has_been_updated_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    finalResponse = {
                        'data': {
                            'status': STATUS_ERROR,
                            'result': {},
                            'message': res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Delete user log if OpenAI did not generate a valid email
                let deleteOption = {
                    'user_id': userId,
                    'ai_campaign_parent_id': aiCampaignParentId,
                    'poll_option_id': pollOptionId,
                    'content': emailUserContent,
                    'role': AI_ROLE_USER,
                };
                await tableInsiderAiEmailLogs.deleteOne(deleteOption);
                finalResponse = {
                    'data': {
                        'status': STATUS_ERROR,
                        'result': {},
                        'message': res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle any unexpected errors
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'result': {},
                    'message': res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }

    /**
     * Function is used to get insider ai email history
     * Uses async/await for DB operations for cleaner and faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getInsiderEmailTemplateHistory = async (req, res) => {
        let finalResponse = {};

        // Extract user and request data
        let loginUserData = (req.user_data) ? req.user_data : "";
        let userId = (loginUserData._id) ? loginUserData._id : "";
        let aiCampaignChatParentId = (req.body.campaign_chat_parent_id) ? newObjectIdDefault(req.body.campaign_chat_parent_id) : "";
        let pollOptionId = (req.body.poll_option_id) ? newObjectIdDefault(req.body.poll_option_id) : "";

        // Validate required fields
        if (!userId || !aiCampaignChatParentId || !pollOptionId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare query condition for chat history
        let commonCondition = {
            user_id: newObjectIdDefault(userId),
            is_deleted: NOT_DELETED,
            content: { $ne: "" },
            poll_option_id: pollOptionId,
            ai_campaign_parent_id: aiCampaignChatParentId
        };

        try {
            // Fetch chat history using async/await
            const result = await tableInsiderAiEmailLogs.find(commonCondition).toArray();

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
            // Handle any unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: 0,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // end getInsiderEmailTemplateHistory()

    /**
     * Function is used to save insider email logs
     * Uses async/await and Promise.all for parallel DB queries for faster response.
     */
    saveInsiderAiEmailLogs = async (req, res, options) => {
        let finalResponse = {};
        try {
            // Prepare data for insertion
            let userId = options.user_id ? options.user_id : "";
            let aiCampaignParentId = options.ai_campaign_parent_id ? newObjectIdDefault(options.ai_campaign_parent_id) : "";
            let pollOptionId = options.poll_option_id ? newObjectIdDefault(options.poll_option_id) : "";
            let content = options.content ? options.content : "";
            let replyContent = options.reply_content ? options.reply_content : "";
            let role = options.role ? options.role : "";
            let userFinalPrompt = options.user_prompt ? options.user_prompt : "";
            let systemFinalPrompt = options.system_prompt ? options.system_prompt : "";
            let systemReplaceData = options.replace_data ? options.replace_data : "";

            let insertData = {
                'user_id': newObjectIdDefault(userId),
                'ai_campaign_parent_id': aiCampaignParentId,
                'poll_option_id': pollOptionId,
                'role': role,
                'content': content,
                'is_deleted': NOT_DELETED,
                'created': getUtcDate(),
            };

            if (role == AI_ROLE_USER) {
                insertData['reply_content'] = replyContent;
            }

            // Run toggle flag and poll custom url queries in parallel
            const [
                getToggleFlagResult,
                getPollCustomUrlResult
            ] = await Promise.all([
                // Get toggle flag
                tableInsiderAiCampaignChat.findOne(
                    {
                        "user_id": newObjectIdDefault(userId),
                        "option_id": pollOptionId,
                        "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                        "type": AI_RESPONSE_TYPE_EMAIL
                    },
                    { projection: { _id: 1, add_poll_toggle: 1 } }
                ),
                // Get poll custom url
                polls.findOne(
                    {
                        "user_id": newObjectIdDefault(userId),
                        "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                        "type": POLL_AI_TYPE,
                        "campaign_type": INSIDER_POLL_CAMPAIGN,
                    },
                    { projection: { 'custom_url': 1 } }
                )
            ]);

            // Extract toggle flag and custom url
            let getToggleFlag = getToggleFlagResult && getToggleFlagResult.add_poll_toggle ? getToggleFlagResult.add_poll_toggle : "";
            let getPollCustomUrl = getPollCustomUrlResult && getPollCustomUrlResult.custom_url ? getPollCustomUrlResult.custom_url : "";

            // If assistant, add poll custom url and toggle info
            if (role == AI_ROLE_ASSISTANT) {
                insertData['content']["custom_url"] = (getPollCustomUrl !== "") ? POLL_VIEW_PAGE_URL + getPollCustomUrl : "";
                insertData["add_poll_toggle"] = (getPollCustomUrl !== "") ? TOGGLE_POLL_ON : TOGGLE_POLL_OFF;
            }

            // Insert the log entry
            const insertResult = await tableInsiderAiEmailLogs.insertOne(insertData);
            let insertedId = insertResult && insertResult.insertedId ? insertResult.insertedId : "";

            // If assistant and system prompt provided, save campaign logs
            if (role == AI_ROLE_ASSISTANT && systemFinalPrompt !== "") {
                // Remove custom_url from content before saving campaign logs
                if (content && content.custom_url) {
                    delete content.custom_url;
                }
                let optionsData = {
                    'user_id': userId,
                    'ai_campaign_parent_id': newObjectIdDefault(aiCampaignParentId),
                    'campaign_type': INSIDER_POLL_CAMPAIGN,
                    'type': "email",
                    'user_prompt': userFinalPrompt,
                    'system_prompt': EMAIL_EDIT_PROMPT_SAVED,
                    'system_replace_data': `{DATA_NEED_TO_UPDATE}: ${systemReplaceData}`,
                    'user_final_prompt': userFinalPrompt,
                    'system_final_prompt': systemFinalPrompt,
                    'final_output': content,
                    "option_id": pollOptionId,
                    'is_edit': "true",
                };
                await saveAllCampaignLogs(optionsData);
            }

            // Success response
            finalResponse = {
                "status": STATUS_SUCCESS,
                "result": insertedId,
                "add_poll_toggle": getToggleFlag,
            };
            return finalResponse;

        } catch (err) {
            // Error response
            finalResponse = {
                "status": STATUS_ERROR,
                "result": "",
                "add_poll_toggle": "",
            };
            return finalResponse;
        }
    } // end saveInsiderAiEmailLogs()

    /**
     * Function is used to update insider ai campaign email
     * Uses async/await and Promise.all for parallel DB queries for faster and cleaner response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updateInsiderCampaignEmail = async (req, res) => {
        let finalResponse = {};
        try {
            // Extract user and request data
            let loginUserData = (req.user_data) ? req.user_data : "";
            let userId = (loginUserData._id) ? newObjectIdDefault(loginUserData._id) : "";
            let insiderAiCampaignChatId = (req.body.campaign_chat_id) ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            let insiderEmailLogId = (req.body.email_log_id) ? newObjectIdDefault(req.body.email_log_id) : "";

            // Validate required fields
            if (!userId || !insiderAiCampaignChatId || !insiderEmailLogId) {
                finalResponse = {
                    'data': {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Common condition to get chat history data
            let commonCondition = {
                "_id": insiderEmailLogId,
                "user_id": userId,
                "role": AI_ROLE_ASSISTANT,
                'is_deleted': NOT_DELETED,
            };

            // Find log details
            const logResult = await tableInsiderAiEmailLogs.findOne(
                commonCondition,
                { projection: { _id: 1, content: 1, ai_campaign_parent_id: 1, poll_option_id: 1 } }
            );

            if (!logResult) {
                // Error response if no record found
                finalResponse = {
                    'data': {
                        'status': STATUS_ERROR,
                        'message': res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let emailContent = logResult.content || {};
            let aiCampaignParentId = logResult.ai_campaign_parent_id || "";
            let pollOptionId = logResult.poll_option_id ? newObjectIdDefault(logResult.poll_option_id) : "";

            // Run DB queries in parallel for reward, poll custom url, and campaign email content
            const [
                rewardData,
                pollCustomUrlData,
                insiderCampaignEmailData
            ] = await Promise.all([
                // Get reward id
                rewards.findOne({
                    "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                    "ai_campaign_chat_id": newObjectIdDefault(insiderAiCampaignChatId),
                    'user_id': newObjectIdDefault(userId),
                    "type": REWARDS_AI_USER_ADD,
                    "campaign_type": INSIDER_POLL_CAMPAIGN
                }, { projection: { '_id': 1 } }),
                // Get poll custom url
                polls.findOne({
                    "user_id": newObjectIdDefault(userId),
                    "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                    "ai_campaign_chat_id": newObjectIdDefault(insiderAiCampaignChatId),
                    "type": POLL_AI_TYPE,
                    "campaign_type": INSIDER_POLL_CAMPAIGN
                }, { projection: { 'custom_url': 1 } }),
                // Get insider campaign email content
                tableInsiderAiCampaignChat.findOne({
                    "_id": newObjectIdDefault(insiderAiCampaignChatId),
                    "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                    "option_id": pollOptionId,
                    "user_id": newObjectIdDefault(userId),
                    "role": AI_ROLE_ASSISTANT,
                    "type": AI_RESPONSE_TYPE_EMAIL,
                }, { projection: { 'content': 1 } })
            ]);

            // Extract data from parallel queries
            let getRewardId = (rewardData && rewardData._id) ? newObjectIdDefault(rewardData._id) : "";
            let getPollCustomUrl = (pollCustomUrlData && pollCustomUrlData.custom_url) ? pollCustomUrlData.custom_url : "";
            let getInsiderCampaignEmailContent = (insiderCampaignEmailData && insiderCampaignEmailData.content) ? insiderCampaignEmailData.content : {};

            // Extract and update images and bullet points
            let campaignBannerImage = (getInsiderCampaignEmailContent && getInsiderCampaignEmailContent['banner_image']) ? getInsiderCampaignEmailContent['banner_image'] : "";
            let campaignBulletPoints = (getInsiderCampaignEmailContent && getInsiderCampaignEmailContent['bullet_points']) ? getInsiderCampaignEmailContent['bullet_points'] : [];
            let bulletImage1 = (campaignBulletPoints.length > 0 && campaignBulletPoints[0]['image1']) ? campaignBulletPoints[0]['image1'] : "";
            let bulletImage2 = (campaignBulletPoints.length > 1 && campaignBulletPoints[1]['image2']) ? campaignBulletPoints[1]['image2'] : "";
            let bulletImage3 = (campaignBulletPoints.length > 2 && campaignBulletPoints[2]['image3']) ? campaignBulletPoints[2]['image3'] : "";

            emailContent['banner_image'] = campaignBannerImage;
            if (emailContent['bullet_points'] && Array.isArray(emailContent['bullet_points'])) {
                if (emailContent['bullet_points'][0]) emailContent['bullet_points'][0]['image1'] = bulletImage1;
                if (emailContent['bullet_points'][1]) emailContent['bullet_points'][1]['image2'] = bulletImage2;
                if (emailContent['bullet_points'][2]) emailContent['bullet_points'][2]['image3'] = bulletImage3;
            }

            // Prepare update condition
            let updateCondition = {
                "_id": newObjectIdDefault(insiderAiCampaignChatId),
                "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                "option_id": pollOptionId,
                "user_id": newObjectIdDefault(userId),
                "role": AI_ROLE_ASSISTANT,
                "type": AI_RESPONSE_TYPE_EMAIL,
            };

            // Add custom_url and reward_id to content
            emailContent["custom_url"] = POLL_VIEW_PAGE_URL + getPollCustomUrl;
            emailContent["reward_id"] = getRewardId;

            // Update insider campaign chat with new content
            await tableInsiderAiCampaignChat.updateOne(updateCondition, { $set: { "content": emailContent } });

            // Success response
            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'message': res.__("front.insider_email.insider_email_updated_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Error response
            finalResponse = {
                "status": STATUS_ERROR,
                'message': res.__("front.system.something_going_wrong_please_try_again"),
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // end updateInsiderCampaignEmail()

}
module.exports = new insiderAiEmailLogsTemplate();

