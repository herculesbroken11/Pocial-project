const async = require('async');
const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const polls = db.collection(TABLE_POLLS);
const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
const rewards = db.collection(TABLE_REWARDS);
const mastercollection = db.collection(TABLE_MASTERS);
const aiBotEmailcollection = db.collection(TABLE_AI_BOT_WELCOME_EMAIL_TEMPLATES);
const campaignNewsletterCollection = db.collection(TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES);
const usercollection = db.collection(TABLE_USERS);
const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});


function AiCampaignChat() {

    /**
     * Function to save AI campaign name using async/await for all DB queries.
     * Runs independent queries in parallel for faster response times.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.saveCampaignNameNew = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const aiCampaignName = req.body.ai_campaign_name || "";
        const signupCampaign = req.body.signup_flag || "";
        const customerId = loginUserData.user_unique_id || "";

        // Get user public business information
        const publicBusinessInformaton = loginUserData.public_business_informaton || {};
        const preferredOfferingDiscount = publicBusinessInformaton.preferred_offering_or_discount || "";
        const campaignMainGoal = publicBusinessInformaton.main_goal_of_your_email_campaign_name || "";
        const toneEmail = publicBusinessInformaton.tone_or_style_email_name || "";
        const specificProductService = publicBusinessInformaton.specific_product_or_service || "";
        const benefitService = publicBusinessInformaton.benefits_product_or_service || "";
        const callToAction = publicBusinessInformaton.call_to_action || "";
        const additionalInformationData = publicBusinessInformaton.additional_information || "";

        // Get req body data, fallback to public info if not present
        const offerDiscount = req.body.hasOwnProperty('preferred_offering_or_discount') ? req.body.preferred_offering_or_discount : preferredOfferingDiscount;
        const emailCampaignGoal = req.body.main_goal_of_your_email_campaign_name || campaignMainGoal;
        const emailTone = req.body.tone_or_style_email_name || toneEmail;
        const specificService = req.body.specific_product_or_service || specificProductService;
        const benefitProduct = req.body.benefits_product_or_service || benefitService;
        const ctaName = req.body.call_to_action || callToAction;
        const additionalInformation = req.body.additional_information || additionalInformationData;
        const informationGetFromPdf = req.body.information_get_from_pdf || "";
        const attachRewardInEmail = req.body.attach_reward_in_email || "";
        const getPollOpinions = req.body.get_poll_opinions || "";
        const uploadedAiPdfDoc = (req.files && req.files.uploaded_ai_pdf_doc) ? req.files.uploaded_ai_pdf_doc : "";

        // Fetch business information in parallel (projection for only needed fields)
        let businessInformation = await web_ai_info.findOne(
            { "user_id": userId },
            { projection: { _id: 0, data: 1, social_media_presence: 1, apify_instagram_data: 1 } }
        );
        let aiInformationData = (businessInformation && businessInformation.data) ? businessInformation.data : {};
        let socialMediaPresence = businessInformation?.social_media_presence || {};
        let apifyInstagramData = businessInformation?.apify_instagram_data || {};

        // Merge social media presence and apify instagram data into aiInformationData
        if (socialMediaPresence && Object.keys(socialMediaPresence).length > 0) {
            delete socialMediaPresence.topPosts;
            aiInformationData = { ...aiInformationData, ...socialMediaPresence };
        }
        if (apifyInstagramData && Object.keys(apifyInstagramData).length > 0) {
            delete apifyInstagramData.topPosts;
            aiInformationData = { ...aiInformationData, ...apifyInstagramData };
        }
        delete aiInformationData.contactInfo;

        const businessInformationData = (Object.keys(aiInformationData).length > 0) ? JSON.stringify(aiInformationData) : "";

        let finalResponse = {};
        if (!userId || !aiCampaignName) {
            // Send error response if required fields are missing
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "inserted_id": "",
                    "result": [],
                    "is_poll_generated": false,
                    "user_conversation_failed": false,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Count created campaigns for the user
            const countCamapign = await getUserCampaignCount(userId);

            // Generate slug for the campaign name
            const slugOptions = {
                title: aiCampaignName,
                table_name: TABLE_AI_CAMPAIGN_NAME,
                slug_field: "slug"
            };
            const slugResponse = await getDatabaseSlug(slugOptions);

            // Insert AI campaign name
            const insertResult = await tableAiCampaignName.insertOne({
                'user_id': userId,
                'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
                'ai_campaign_name': aiCampaignName,
                'ai_campaign_created_name': "",
                'type': DEFAULT_CAMPAIGN,
                'is_deleted': NOT_DELETED,
                'first_ai_poll_generated': (signupCampaign != "") ? true : false,
                'first_content_campaign': (countCamapign == 1) ? true : false,
                'created': getUtcDate(),
            });

            if (!insertResult || !insertResult.insertedId) {
                // If insert failed, remove unused campaign and return error
                await removeCampaignData(req, res, { "inserted_id": "", "user_id": userId });
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        "inserted_id": "",
                        "result": [],
                        "is_poll_generated": false,
                        "user_conversation_failed": true,
                        "message": res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            const insertedId = insertResult.insertedId;

            // Prepare details to save for the campaign
            const insertNewDetails = {
                'user_id': userId,
                'main_goal_of_your_email_campaign_name': emailCampaignGoal,
                'preferred_offering_or_discount': offerDiscount,
                'tone_or_style_email_name': emailTone,
                'specific_product_or_service': specificService,
                'benefits_product_or_service': benefitProduct,
                'call_to_action': ctaName,
                'additional_information': additionalInformation,
                'information_get_from_pdf': informationGetFromPdf,
                'attach_reward_in_email': attachRewardInEmail,
                'get_poll_opinions': getPollOpinions,
                'pdf_file': (uploadedAiPdfDoc != "") ? uploadedAiPdfDoc.data : "",
                'ai_campaign_name': aiCampaignName,
                'type': DEFAULT_CAMPAIGN,
            };

            // Save user details according to campaign
            const userDetailsSave = await saveUserDetailsAccordingCampaign(req, res, insertNewDetails);
            const finalDataUserText = (userDetailsSave) ? userDetailsSave.final_text : "";
            const campainAccUserDetailId = (userDetailsSave) ? newObjectIdDefault(userDetailsSave.inserted_id) : "";

            // Prepare PDF information string if available
            const getPdfInformation = (finalDataUserText && !finalDataUserText.includes("no-data-found")) ?
                `and the information provided in ${finalDataUserText}. if they added one ` : "";

            // Extract more business info for prompt generation
            const publicBusinessInformation = loginUserData.public_business_informaton || {};
            let businessName = publicBusinessInformation.name_of_the_business || "";
            let phoneNumber = publicBusinessInformation.primary_phone || "";
            let websiteUrl = publicBusinessInformation.website_url || "";
            let targetAudienceData = publicBusinessInformation.target_audience || "";
            let preferredOfferingDiscount2 = publicBusinessInformation.preferred_offering_or_discount || "";
            let uniqueSellingData = publicBusinessInformation.unique_selling_proposition || "";
            let specificProductService2 = publicBusinessInformation.specific_product_or_service || "";
            let benefitProductService = publicBusinessInformation.benefits_product_or_service || "";
            let aiIndustryNames = publicBusinessInformation.ai_business_industry_names || [];
            let seoKeyWordFirst = publicBusinessInformation.populate_key_phrase_first || null;
            let seoKeywordSecond = publicBusinessInformation.populate_key_phrase_second || null;
            let primaryGoal = publicBusinessInformation.main_goal_of_your_email_campaign_name || "";
            let toneStyleEmailName = publicBusinessInformation.tone_or_style_email_name || "";
            let callToAction2 = publicBusinessInformation.call_to_action || "";

            let zipCode = loginUserData.zip || "";
            let email = loginUserData.email || "";

            // Format industry names for prompt
            if (aiIndustryNames.length > 1) {
                let lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
                aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
                aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
                aiIndustryNames.push(lastConcat);
            }
            let aiBusinessIndustry = aiIndustryNames.join(', ');
            let seoKeywords = [seoKeyWordFirst, seoKeywordSecond].join(" and ");
            let websiteData = (websiteUrl == "") ? emailToDomainUrl(email) : websiteUrl;
            let aiCardData = `Who their target audience :${targetAudienceData}; A unique selling proposition : ${uniqueSellingData}; A key feature or benefit : ${specificProductService2}`;

            // Prepare user prompt data for each service
            let userEmailContentData = "";
            let userPollContentData = "";
            let seoUserData = "";
            let socialUserData = "";

            if (signupCampaign != "") {
                userEmailContentData = SIGNUP_USER_EMAIL_PROMPT.replace(/{business_name}/g, businessName)
                    .replace(/{phone_number}/g, phoneNumber)
                    .replace(/{website_url}/g, websiteUrl)
                    .replace(/{industry}/g, aiBusinessIndustry)
                    .replace(/{offer_discount}/g, offerDiscount)
                    .replace(/{target_audience}/g, targetAudienceData)
                    .replace(/{email_campaign_goal}/g, emailCampaignGoal)
                    .replace(/{unique_selling}/g, uniqueSellingData)
                    .replace(/{email_tone}/g, emailTone)
                    .replace(/{specific_service}/g, specificService)
                    .replace(/{benefit_product}/g, benefitProduct)
                    .replace(/{cta_text}/g, ctaName)
                    + "" + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName);

                userPollContentData = SIGNUP_USER_POLL_PROMPT.replace(/{business_name}/g, businessName)
                    .replace(/{industry}/g, aiBusinessIndustry)
                    .replace(/{offer_discount}/g, offerDiscount)
                    .replace(/{target_audience}/g, targetAudienceData)
                    .replace(/{unique_selling}/g, uniqueSellingData)
                    .replace(/{specific_service}/g, specificService)
                    .replace(/{benefit_product}/g, benefitProduct);

                socialUserData = INSIDER_SOCIAL_FORMAT.replace(/{zip_code}/g, zipCode);

            } else if (countCamapign == 1) {
                userPollContentData = FIRST_CONTENT_LIBRARY_POLL_PROMPT.replace(/{web_address}/g, businessInformationData)
                    .replace(/{business_industry}/g, aiBusinessIndustry)
                    .replace(/{zip_code}/g, zipCode);

                userEmailContentData = FIRST_CONTENT_LIBRARY_EMAIL_PROMPT.replace(/{web_address}/g, businessInformationData)
                    .replace(/{business_industry}/g, aiBusinessIndustry)
                    .replace(/{zip_code}/g, zipCode)
                    + " " + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName);

                seoUserData = FIRST_CONTENT_LIBRARY_SEO_PROMPT.replace(/{web_address}/g, businessInformationData)
                    .replace(/{business_industry}/g, aiBusinessIndustry)
                    .replace(/{zip_code}/g, zipCode)
                    + " " + SEO_FORMAT;

                socialUserData = FIRST_CONTENT_LIBRARY_SOCIAL_PROMPT.replace(/{web_address}/g, businessInformationData)
                    .replace(/{business_industry}/g, aiBusinessIndustry)
                    .replace(/{zip_code}/g, zipCode)
                    + " " + FIRST_SOCIAL_FORMAT.replace(/{zip_code}/g, zipCode);

            } else {
                userEmailContentData = NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName);
                userPollContentData = CAMPAIGN_POLL_USER_PROMPT.replace(/{topic}/g, aiCampaignName)
                    .replace(/{web_address}/g, businessInformationData)
                    .replace(/{industry}/g, aiBusinessIndustry)
                    .replace(/{zip_code}/g, zipCode);

                seoUserData = CAMPAIGN_SEO_USER_PROMPT.replace(/{keywords}/g, seoKeywords)
                    .replace(/{web_address}/g, businessInformationData)
                    .replace(/{industry}/g, aiBusinessIndustry)
                    .replace(/{zip_code}/g, zipCode)
                    + " " + SEO_FORMAT;

                socialUserData = INSIDER_SOCIAL_FORMAT.replace(/{zip_code}/g, zipCode);
            }

            const userEmailData = userEmailContentData;
            const userPollData = userPollContentData + ' ' + POLL_FORMAT;

            // Prepare included services
            let includedServices = INCLUDED_SERVICES;
            const serviceKeys = [AI_RESPONSE_TYPE_POLL, AI_RESPONSE_TYPE_EMAIL, AI_RESPONSE_TYPE_SEO, AI_RESPONSE_TYPE_SOCIAL_MEDIA];

            // Remove SEO service for insider campaign, otherwise only Social Media
            if (signupCampaign != "" && signupCampaign == 'true') {
                includedServices = includedServices.filter(service => service.value !== "seo_blog");
            } else {
                includedServices = [{
                    "text": "Social Media",
                    "value": "social_media",
                    "checked": "true"
                }];
            }

            // Build prompts for each included service
            let servicesArray = [];
            for (const record of includedServices) {
                const serviceName = record.value;
                if (!serviceKeys.includes(serviceName)) continue;

                let systemData = "";
                if (signupCampaign != "") {
                    if (serviceName == AI_RESPONSE_TYPE_EMAIL) {
                        systemData = INITIAL_SYSTEM_PROMPT[serviceName]
                            .replace(/{business_name}/g, businessName)
                            .replace(/{business_industry}/g, aiBusinessIndustry)
                            .replace(/{zip_code}/g, zipCode)
                            + ' ' + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName);
                    } else {
                        systemData = INITIAL_SYSTEM_PROMPT[serviceName]
                            .replace(/{business_name}/g, businessName)
                            .replace(/{business_industry}/g, aiBusinessIndustry)
                            .replace(/{zip_code}/g, zipCode);
                    }
                } else if (countCamapign == 1) {
                    systemData = "";
                } else {
                    if (serviceName == AI_RESPONSE_TYPE_EMAIL) {
                        systemData = CAMPAIGN_SYSTEM_PROMPT[serviceName]
                            .replace(/{topic}/g, aiCampaignName)
                            .replace(/{business_name}/g, businessName)
                            .replace(/{zip_code}/g, zipCode)
                            .replace(/{web_address}/g, businessInformationData)
                            .replace(/{pdf_information}/g, getPdfInformation)
                            + " " + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName);
                    } else if (serviceName == AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                        systemData = CAMPAIGN_SYSTEM_PROMPT[serviceName]
                            .replace(/{topic}/g, aiCampaignName)
                            .replace(/{business_name}/g, businessName)
                            .replace(/{zip_code}/g, zipCode)
                            .replace(/{pdf_information}/g, getPdfInformation)
                            .replace(/{pocial_ai_cards}/g, aiCardData);
                    } else {
                        systemData = CAMPAIGN_SYSTEM_PROMPT[serviceName]
                            .replace(/{topic}/g, aiCampaignName)
                            .replace(/{business_name}/g, businessName)
                            .replace(/{zip_code}/g, zipCode)
                            .replace(/{pdf_information}/g, getPdfInformation);
                    }
                }

                let systemPrompt, userPrompt;
                if (serviceName == AI_RESPONSE_TYPE_POLL) {
                    systemPrompt = {
                        "role": "system",
                        "content": (systemData != "") ? systemData + " " + POLL_FORMAT : ""
                    };
                    userPrompt = {
                        "role": AI_ROLE_USER,
                        "content": userPollData,
                    };
                } else if (serviceName == AI_RESPONSE_TYPE_EMAIL) {
                    systemPrompt = {
                        "role": "system",
                        "content": systemData
                    };
                    userPrompt = {
                        "role": AI_ROLE_USER,
                        "content": userEmailData,
                    };
                } else if (serviceName == AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                    systemPrompt = {
                        "role": "system",
                        "content": systemData
                    };
                    userPrompt = {
                        "role": AI_ROLE_USER,
                        "content": socialUserData,
                    };
                } else {
                    continue;
                }

                servicesArray.push({
                    "system_prompt": systemPrompt,
                    "user_prompt": userPrompt,
                    "type": serviceName,
                    "business_name": businessName
                });
            }

            // Run all OpenAI requests in parallel for all services
            const openAiResponseData = await Promise.all(
                servicesArray.map(prompt => getOpenAiResponse(req, res, prompt))
            );

            // Check for any error in OpenAI responses
            let flag = "";
            for (const records of openAiResponseData) {
                if (records.status === STATUS_ERROR) {
                    flag = STATUS_ERROR;
                    break;
                }
            }

            if (flag === STATUS_ERROR) {
                // Remove unused campaign if any OpenAI response failed
                const deleteOptions = {
                    "inserted_id": insertedId,
                    "user_id": userId,
                };
                const deleteResponse = await removeCampaignData(req, res, deleteOptions);
                finalResponse = { 'data': deleteResponse };
                return returnApiResult(req, res, finalResponse);
            }

            // Generate campaign chat data and save customer interactions for each AI response
            const newData = await Promise.all(openAiResponseData.map(async (value) => {
                const finalContentData = (value.response[value.type]) ? value.response[value.type] : {};
                const campaignId = newObjectIdDefault();
                let campaignChatData = {
                    "_id": campaignId,
                    'user_id': userId,
                    'ai_campaign_parent_id': insertedId,
                    "campaign_according_user_detail_id": campainAccUserDetailId,
                    'role': AI_ROLE_ASSISTANT,
                    'content': finalContentData,
                    'type': value.type || "",
                    'is_viewed': false,
                    'signup_flag': (signupCampaign != "") ? true : false,
                    'first_ai_poll_generated': (signupCampaign != "") ? true : false,
                    'first_content_campaign': (countCamapign == 1) ? true : false,
                    'system_generate': (signupCampaign != "" || countCamapign == 1) ? true : false,
                    'unique_key': generateRandomID(8),
                    'is_draft': (signupCampaign != "" || countCamapign == 1) ? CAMPAIGN_NOT_DRAFT : CAMPAIGN_DRAFT,
                    'is_deleted': NOT_DELETED,
                    'created': getUtcDate(),
                };
                if (signupCampaign != "" && value.type == AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                    campaignChatData["is_email_create"] = true;
                    campaignChatData["is_poll_create"] = true;
                }
                if (value.type == AI_RESPONSE_TYPE_EMAIL) {
                    campaignChatData["add_poll_toggle"] = TOGGLE_POLL_ON;
                }
                return campaignChatData;
            }));

            // Insert all campaign chat data at once
            const saveResult = await tableAiCampaignChat.insertMany(newData);

            if (!saveResult) {
                // If insert failed, return error
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        "created_date": getUtcDate(),
                        "inserted_id": "",
                        "result": [],
                        "is_poll_generated": false,
                        "user_conversation_failed": true,
                        "message": res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // If this is an insider campaign, handle poll and newsletter generation
            if (signupCampaign != "" && signupCampaign == 'true') {
                // Find generated campaign chat data for poll and reward
                const chatResult = await tableAiCampaignChat.find({
                    'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                    'user_id': newObjectIdDefault(userId),
                    "type": { $in: [AI_RESPONSE_TYPE_POLL, AI_RESPONSE_TYPE_REWARD] }
                }).toArray();

                let pollCampaignChatId = "";
                let pollString = "";
                chatResult.forEach(chatData => {
                    if (chatData.type == AI_RESPONSE_TYPE_POLL) {
                        pollCampaignChatId = chatData._id || "";
                        pollString = chatData.content || "";
                    }
                });

                // Save poll data
                const pollOptions = {
                    "user_id": userId,
                    "ai_data": pollString,
                    "ai_campaign_chat_id": pollCampaignChatId,
                    "ai_campaign_parent_id": insertedId,
                    "signup_flag": signupCampaign,
                    "campaign_type": DEFAULT_CAMPAIGN,
                    "customer_id": customerId
                };
                await addAiPollData(req, res, pollOptions);

                // Find poll for custom URL and reward
                const pollResult = await polls.findOne({
                    'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                    'user_id': newObjectIdDefault(userId),
                    "type": POLL_AI_TYPE
                }, { projection: { 'options': 1, 'custom_url': 1 } }) || {};

                if (Object.keys(pollResult).length > 0) {
                    const pollCustomUrl = pollResult.custom_url ? POLL_VIEW_PAGE_URL + pollResult.custom_url : "";
                    const pollId = pollResult._id ? newObjectIdDefault(pollResult._id) : "";
                    const rewardId = "";

                    // Update custom url and reward id in campaign email
                    await tableAiCampaignChat.updateOne(
                        { 'ai_campaign_parent_id': newObjectIdDefault(insertedId), 'user_id': newObjectIdDefault(userId), "type": AI_RESPONSE_TYPE_EMAIL },
                        { $set: { 'content.custom_url': pollCustomUrl, 'content.reward_id': rewardId } }
                    );

                    // Fetch last generated email and campaign newsletter template in parallel
                    const [lastGeneratedEmail, campaignNewsletterTemplate] = await Promise.all([
                        tableAiCampaignChat.findOne({
                            'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                            'user_id': newObjectIdDefault(userId),
                            'type': AI_RESPONSE_TYPE_EMAIL
                        }, { projection: { "_id": 1, 'type': 1, "content": 1, "add_poll_toggle": 1 } }),
                        campaignNewsletterCollection.findOne({ "_id": newObjectIdDefault(CAMPAIGN_NEWSLETTER_TEMPLATE_ID) })
                    ]);

                    if (campaignNewsletterTemplate && lastGeneratedEmail) {
                        // Prepare newsletter email content
                        const lastGeneratedEmailId = lastGeneratedEmail._id || "";
                        const lastEmailContent = lastGeneratedEmail.content || {};
                        const emailHeading = lastEmailContent.email_heading || "";
                        const subject = lastEmailContent.subject || "";
                        const bulletPoints = lastEmailContent.bullet_points || [];
                        const bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
                        const bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
                        const bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
                        const bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
                        const bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
                        const bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
                        const emailClosingText = lastEmailContent.email_closing_paragraph || "";
                        const emailSignature = lastEmailContent.email_ending_signature || "";
                        const ctaText = lastEmailContent.cta_text || "";
                        const ctaTextNew = res.__("insiders.quick_question");
                        const emailBody = lastEmailContent.body;
                        let stringNewEmailBody = JSON.stringify(emailBody);
                        stringNewEmailBody = stringNewEmailBody.replace(/"/g, ' ').replace(/\\n/g, '<br>');

                        // Get business name for "from" field
                        const nameOfTheBusiness = publicBusinessInformaton.name_of_the_business || "";

                        // Prepare newsletter page body and design JSON
                        let newsletterPageBody = campaignNewsletterTemplate.body || "";
                        let newsletterDesignJson = campaignNewsletterTemplate.design_json || "";
                        newsletterDesignJson = JSON.stringify(newsletterDesignJson);

                        // Replace placeholders in newsletter body and design JSON
                        const replacements = [
                            ['{AI_GENERATE_EMAIL_HEADING}', emailHeading],
                            ['{AI_GENERATE_EMAIL_SUBJECT}', subject],
                            ['{AI_GENERATE_EMAIL_DESCRIPTION}', stringNewEmailBody],
                            ['{BULLET_POINT1}', bulletPoint1],
                            ['{BULLET_POINT2}', bulletPoint2],
                            ['{BULLET_POINT3}', bulletPoint3],
                            ['{BULLET_HEADING1}', bulletHeading1],
                            ['{BULLET_HEADING2}', bulletHeading2],
                            ['{BULLET_HEADING3}', bulletHeading3],
                            ['{AI_GENERATE_EMAIL_ENDING_TEXT}', emailClosingText],
                            ['{EMAIL_ENDING_SIGNATURE}', emailSignature],
                            ['{AI_GENERATE_CTA_LINK}', ctaText],
                            ['{OTHER_CTA_TEXT}', ctaTextNew],
                            ['{AI_GENERATE_POLL_LINK}', pollCustomUrl]
                        ];
                        for (const [key, value] of replacements) {
                            newsletterPageBody = newsletterPageBody.replace(RegExp(key, 'g'), value);
                            newsletterDesignJson = newsletterDesignJson.replace(RegExp(key, 'g'), value);
                        }
                        newsletterDesignJson = JSON.parse(newsletterDesignJson);

                        // Prepare email settings
                        const userEmail = res.locals.settings["Email.user_email"];
                        const emailHost = res.locals.settings["Email.host"];
                        const emailPassword = res.locals.settings["Email.password"];
                        const emailPort = res.locals.settings["Email.port"];

                        // Save newsletter template
                        const responseEmail = await addEmailTemplateNewsletter({
                            'template_title': emailHeading,
                            'subject': subject,
                            'body': newsletterPageBody,
                            'description': emailHeading,
                            'user_id': userId,
                            'customer_id': customerId,
                            'from': (nameOfTheBusiness) ? removeSpecialCharacters(nameOfTheBusiness) : "",
                            'from_email': userEmail,
                            'attach_reward': rewardId,
                            'attach_poll': pollId,
                            'host': emailHost,
                            'port': emailPort,
                            'email_password': emailPassword,
                            'template_type': EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
                            'design_json': newsletterDesignJson,
                            'ai_bot': true,
                            'skip_smtp': true,
                            'status': DRAFT_STATUS,
                            'ai_campaign_name_id': newObjectIdDefault(insertedId),
                            'ai_campaign_chat_id': newObjectIdDefault(lastGeneratedEmailId),
                            'email_descriptions': {
                                [DEFAULT_LANGUAGE_MONGO_ID]: {
                                    "language_id": DEFAULT_LANGUAGE_MONGO_ID,
                                    "subject": subject,
                                    "body": newsletterPageBody
                                }
                            },
                            'system_generate': (signupCampaign != "" || countCamapign == 1) ? true : false,
                        });

                        // Convert HTML to image and update campaign chat with newsletter email id
                        const campaignTemplateId = responseEmail.email_inserted_id || "";
                        await htmltoImageConvert(req, res, campaignTemplateId);
                        await tableAiCampaignChat.updateOne({
                            '_id': newObjectIdDefault(lastGeneratedEmailId),
                            'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                            'user_id': newObjectIdDefault(userId),
                            'type': AI_RESPONSE_TYPE_EMAIL
                        }, {
                            $set: { "newsletter_email_id": newObjectIdDefault(campaignTemplateId) }
                        });
                    }
                }
            }

            // Send success response
            finalResponse = {
                'data': {
                    "status": STATUS_SUCCESS,
                    "created_date": getUtcDate(),
                    "inserted_id": insertedId,
                    "result": [],
                    "is_poll_generated": true,
                    "user_conversation_failed": false,
                    "message": res.__("front.ai_steps.chat_has_been_added_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // On error, remove unused campaign and return error response
            await removeCampaignData(req, res, { "inserted_id": "", "user_id": userId });
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "inserted_id": "",
                    "result": [],
                    "is_poll_generated": false,
                    "user_conversation_failed": true,
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // end saveCampaignNameNew();

    /**
    * Function is used to save AI campaign name
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.saveCampaignName = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const aiCampaignName = req.body.ai_campaign_name || "";
        const signupCampaign = req.body.signup_flag || "";

        // Get user public business information
        const customerId = loginUserData.user_unique_id || "";
        const zipCode = loginUserData.zip || "";
        const email = loginUserData.email || "";
        const publicBusinessInformaton = loginUserData.public_business_informaton || "";
        const businessName = publicBusinessInformaton.name_of_the_business || "";
        const preferredOfferingDiscount = publicBusinessInformaton.preferred_offering_or_discount || "";
        const specificProductService = publicBusinessInformaton.specific_product_or_service || "";
        const benefitService = publicBusinessInformaton.benefits_product_or_service || "";
        const callToAction = publicBusinessInformaton.call_to_action || "";
        const seoKeyWordFirst = publicBusinessInformaton.populate_key_phrase_first || null;
        const seoKeywordSecond = publicBusinessInformaton.populate_key_phrase_second || null;
        const websiteUrl = publicBusinessInformaton.website_url || "";
        const targetAudienceData = publicBusinessInformaton.target_audience || "";
        let aiIndustryNames = publicBusinessInformaton.ai_business_industry_names || [];
        const uniqueSellingData = publicBusinessInformaton.unique_selling_proposition || "";

        if (aiIndustryNames.length > 1) {
            const lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
            aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
            aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
            aiIndustryNames.push(lastConcat);
        }

        const aiBusinessIndustry = aiIndustryNames.join(', ');
        const seoKeywords = [seoKeyWordFirst, seoKeywordSecond].join(" and ");
        const websiteData = (websiteUrl === "") ? emailToDomainUrl(email) : websiteUrl;

        let finalResponse = {};

        if (userId === '' || aiCampaignName === '') {
            // Send error response if user or campaign name is missing
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "inserted_id": "",
                    "result": [],
                    "is_poll_generated": false,
                    "user_conversation_failed": false,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Count created campaigns for the user
            const countCamapign = await getUserCampaignCount(userId);

            // Generate slug for the campaign name
            const slugOptions = {
                title: aiCampaignName,
                table_name: TABLE_AI_CAMPAIGN_NAME,
                slug_field: "slug"
            };
            const slugResponse = await getDatabaseSlug(slugOptions);

            // Insert AI campaign name
            const insertResult = await tableAiCampaignName.insertOne({
                'user_id': userId,
                'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
                'ai_campaign_name': aiCampaignName,
                'ai_campaign_created_name': "",
                'type': DEFAULT_CAMPAIGN,
                'is_deleted': NOT_DELETED,
                'first_ai_poll_generated': (signupCampaign !== "") ? true : false,
                'first_content_campaign': (countCamapign == 1) ? true : false,
                'created': getUtcDate(),
            });

            if (!insertResult || !insertResult.insertedId) {
                // Remove unused campaign and send error response
                await removeCampaignData(req, res, { "inserted_id": "", "user_id": userId });
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        "inserted_id": "",
                        "result": [],
                        "is_poll_generated": false,
                        "user_conversation_failed": true,
                        "message": res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            const insertedId = insertResult.insertedId;

            // Prepare included services
            let includedServices = INCLUDED_SERVICES;
            if (signupCampaign !== "" && signupCampaign === 'true') {
                includedServices = includedServices.filter(service => service.value !== "seo_blog");
            } else {
                includedServices = [{
                    "text": "Social Media",
                    "value": "social_media",
                    "checked": "true"
                }];
            }

            // Prepare business info and options for Gemini service
            const businessInfo = {
                "website_url": websiteData,
                "business_name": businessName,
                "industry": aiBusinessIndustry,
                "zipcode": zipCode,
                "target_audience": targetAudienceData,
                "preferred_offering_or_discount": preferredOfferingDiscount,
                "unique_selling_proposition": uniqueSellingData,
                "specific_product_or_service": specificProductService,
                "benefits_product_or_service": benefitService,
                "call_to_action": callToAction,
                "seo_keywords": seoKeywords,
            };

            const options = {
                "businessInfo": businessInfo,
                "campaign_name": aiCampaignName,
                "services": includedServices,
                "insider_campaign": signupCampaign,
                "first_campaign": countCamapign,
            };

            // Call Gemini service to create campaign
            const geminiResponse = await generateInsiders(req, res, options);

            if (geminiResponse.status === STATUS_ERROR) {
                // Remove unused campaign and send error response
                const deleteOptions = {
                    "inserted_id": insertedId,
                    "user_id": userId,
                };
                const deleteResponse = await removeCampaignData(req, res, deleteOptions);
                finalResponse = { 'data': deleteResponse };
                return returnApiResult(req, res, finalResponse);
            }

            const openAiResponseData = geminiResponse?.response || [];

            // Prepare campaign chat data
            const newData = (openAiResponseData.length > 0) ? openAiResponseData.map((value) => {
                const finalContentData = (value.response[value.type]) ? value.response[value.type] : {};
                const campaignId = newObjectIdDefault();

                let campaignChatData = {
                    "_id": campaignId,
                    'user_id': userId,
                    'ai_campaign_parent_id': insertedId,
                    'role': AI_ROLE_ASSISTANT,
                    'content': finalContentData,
                    'type': value.type || "",
                    'is_viewed': false,
                    'signup_flag': (signupCampaign !== "") ? true : false,
                    'first_ai_poll_generated': (signupCampaign !== "") ? true : false,
                    'first_content_campaign': (countCamapign == 1) ? true : false,
                    'system_generate': (signupCampaign !== "" || countCamapign == 1) ? true : false,
                    'unique_key': generateRandomID(8),
                    'is_draft': (signupCampaign !== "" || countCamapign == 1) ? CAMPAIGN_NOT_DRAFT : CAMPAIGN_DRAFT,
                    'is_deleted': NOT_DELETED,
                    'created': getUtcDate(),
                };

                // Supporting content flag
                if (signupCampaign !== "" && value.type === AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                    campaignChatData["is_email_create"] = true;
                    campaignChatData["is_poll_create"] = true;
                }
                // Email toggle flag
                if (value.type === AI_RESPONSE_TYPE_EMAIL) {
                    campaignChatData["add_poll_toggle"] = TOGGLE_POLL_ON;
                }

                return campaignChatData;
            }) : [];

            // Insert assistant data
            const saveResult = await tableAiCampaignChat.insertMany(newData);

            if (!saveResult) {
                // Send error response if insert failed
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        "created_date": getUtcDate(),
                        "inserted_id": "",
                        "result": [],
                        "is_poll_generated": false,
                        "user_conversation_failed": true,
                        "message": res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // If insider campaign, handle poll and newsletter logic
            if (signupCampaign !== "" && signupCampaign === 'true') {
                // Find generated campaign chat data for poll and reward
                const chatResult = await tableAiCampaignChat.find({
                    'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                    'user_id': newObjectIdDefault(userId),
                    "type": { $in: [AI_RESPONSE_TYPE_POLL, AI_RESPONSE_TYPE_REWARD] }
                }).toArray();

                let pollCampaignChatId = "";
                let pollCampaignParentId = insertedId;
                let pollString = "";

                chatResult.forEach(chatData => {
                    if (chatData.type === AI_RESPONSE_TYPE_POLL) {
                        pollCampaignChatId = chatData._id || "";
                        pollString = chatData.content || "";
                    }
                });

                // Save poll data
                const pollOptions = {
                    "user_id": userId,
                    "ai_data": pollString,
                    "ai_campaign_chat_id": pollCampaignChatId,
                    "ai_campaign_parent_id": pollCampaignParentId,
                    "signup_flag": signupCampaign,
                    "campaign_type": DEFAULT_CAMPAIGN,
                    "customer_id": customerId
                };

                await addAiPollData(req, res, pollOptions);

                // Find poll document and campaign newsletter template in parallel
                const [pollResult, campaignNewsletterTemplate] = await Promise.all([
                    polls.findOne({
                        'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                        'user_id': newObjectIdDefault(userId),
                        "type": POLL_AI_TYPE
                    }, { projection: { 'options': 1, 'custom_url': 1 } }),
                    campaignNewsletterCollection.findOne({
                        "_id": newObjectIdDefault(CAMPAIGN_NEWSLETTER_TEMPLATE_ID)
                    })
                ]);

                if (pollResult && campaignNewsletterTemplate) {
                    const pollCustomUrl = pollResult.custom_url ? POLL_VIEW_PAGE_URL + pollResult.custom_url : "";
                    const pollId = pollResult._id ? newObjectIdDefault(pollResult._id) : "";

                    // Update custom url and reward id in campaign email
                    await tableAiCampaignChat.updateOne(
                        { 'ai_campaign_parent_id': newObjectIdDefault(insertedId), 'user_id': newObjectIdDefault(userId), "type": AI_RESPONSE_TYPE_EMAIL },
                        { $set: { 'content.custom_url': pollCustomUrl, 'content.reward_id': "" } }
                    );

                    // Get last generated email
                    const lastGeneratedEmail = await tableAiCampaignChat.findOne({
                        'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                        'user_id': newObjectIdDefault(userId),
                        'type': AI_RESPONSE_TYPE_EMAIL
                    }, { projection: { "_id": 1, 'type': 1, "content": 1, "add_poll_toggle": 1 } });

                    // Prepare email content
                    const userEmail = res.locals.settings["Email.user_email"];
                    const emailHost = res.locals.settings["Email.host"];
                    const emailPassword = res.locals.settings["Email.password"];
                    const emailPort = res.locals.settings["Email.port"];

                    const lastGeneratedEmailId = lastGeneratedEmail?._id || "";
                    const lastEmailContent = lastGeneratedEmail?.content || {};

                    const emailHeading = lastEmailContent.email_heading || "";
                    const subject = lastEmailContent.subject || "";

                    const bulletPoints = lastEmailContent.bullet_points || [];
                    const bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
                    const bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
                    const bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
                    const bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
                    const bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
                    const bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
                    const emailClosingText = lastEmailContent.email_closing_paragraph || "";
                    const emailSignature = lastEmailContent.email_ending_signature || "";
                    const ctaText = lastEmailContent.cta_text || "";

                    const ctaTextNew = res.__("insiders.quick_question");
                    const emailBody = lastEmailContent.body;
                    let stringNewEmailBody = JSON.stringify(emailBody);
                    stringNewEmailBody = stringNewEmailBody.replace(/"/g, ' ').replace(/\\n/g, '<br>');

                    // Business details for login user
                    const nameOfTheBusiness = businessName;

                    // Prepare newsletter template body and design JSON
                    let newsletterPageBody = campaignNewsletterTemplate.body || "";
                    let newsletterDesignJson = campaignNewsletterTemplate.design_json || "";

                    newsletterDesignJson = JSON.stringify(newsletterDesignJson);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_EMAIL_HEADING}', 'g'), emailHeading);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_EMAIL_SUBJECT}', 'g'), subject);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_EMAIL_DESCRIPTION}', 'g'), stringNewEmailBody);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{BULLET_POINT1}', 'g'), bulletPoint1);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{BULLET_POINT2}', 'g'), bulletPoint2);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{BULLET_POINT3}', 'g'), bulletPoint3);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{BULLET_HEADING1}', 'g'), bulletHeading1);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{BULLET_HEADING2}', 'g'), bulletHeading2);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{BULLET_HEADING3}', 'g'), bulletHeading3);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_EMAIL_ENDING_TEXT}', 'g'), emailClosingText);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{EMAIL_ENDING_SIGNATURE}', 'g'), emailSignature);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_CTA_LINK}', 'g'), ctaText);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{OTHER_CTA_TEXT}', 'g'), ctaTextNew);
                    newsletterPageBody = newsletterPageBody.replace(RegExp('{AI_GENERATE_POLL_LINK}', 'g'), pollCustomUrl);

                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{AI_GENERATE_EMAIL_HEADING}', 'g'), emailHeading);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{AI_GENERATE_EMAIL_SUBJECT}', 'g'), subject);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{AI_GENERATE_EMAIL_DESCRIPTION}', 'g'), stringNewEmailBody);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{BULLET_POINT1}', 'g'), bulletPoint1);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{BULLET_POINT2}', 'g'), bulletPoint2);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{BULLET_POINT3}', 'g'), bulletPoint3);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{BULLET_HEADING1}', 'g'), bulletHeading1);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{BULLET_HEADING2}', 'g'), bulletHeading2);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{BULLET_HEADING3}', 'g'), bulletHeading3);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{AI_GENERATE_EMAIL_ENDING_TEXT}', 'g'), emailClosingText);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{EMAIL_ENDING_SIGNATURE}', 'g'), emailSignature);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{OTHER_CTA_TEXT}', 'g'), ctaTextNew);
                    newsletterDesignJson = newsletterDesignJson.replace(RegExp('{AI_GENERATE_POLL_LINK}', 'g'), pollCustomUrl);

                    newsletterDesignJson = JSON.parse(newsletterDesignJson);

                    // Add email template newsletter
                    const responseEmail = await addEmailTemplateNewsletter({
                        'template_title': emailHeading,
                        'subject': subject,
                        'body': newsletterPageBody,
                        'description': emailHeading,
                        'user_id': userId,
                        'customer_id': customerId,
                        'from': (nameOfTheBusiness) ? removeSpecialCharacters(nameOfTheBusiness) : "",
                        'from_email': userEmail,
                        'attach_reward': "",
                        'attach_poll': pollId,
                        'host': emailHost,
                        'port': emailPort,
                        'email_password': emailPassword,
                        'template_type': EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
                        'design_json': newsletterDesignJson,
                        'ai_bot': true,
                        'skip_smtp': true,
                        'status': DRAFT_STATUS,
                        'ai_campaign_name_id': newObjectIdDefault(insertedId),
                        'ai_campaign_chat_id': newObjectIdDefault(lastGeneratedEmailId),
                        'email_descriptions': {
                            [DEFAULT_LANGUAGE_MONGO_ID]: {
                                "language_id": DEFAULT_LANGUAGE_MONGO_ID,
                                "subject": subject,
                                "body": newsletterPageBody
                            }
                        },
                        'system_generate': (signupCampaign !== "" || countCamapign == 1) ? true : false,
                    });

                    const campaignTemplateId = responseEmail.email_inserted_id || "";
                    await htmltoImageConvert(req, res, campaignTemplateId);
                    await tableAiCampaignChat.updateOne({
                        '_id': newObjectIdDefault(lastGeneratedEmailId),
                        'ai_campaign_parent_id': newObjectIdDefault(insertedId),
                        'user_id': newObjectIdDefault(userId),
                        'type': AI_RESPONSE_TYPE_EMAIL
                    }, {
                        $set: { "newsletter_email_id": newObjectIdDefault(campaignTemplateId) }
                    });
                }

                // Send success response for poll and options generation
                finalResponse = {
                    'data': {
                        "status": STATUS_SUCCESS,
                        "created_date": getUtcDate(),
                        "inserted_id": insertedId,
                        "result": [],
                        "is_poll_generated": true,
                        "user_conversation_failed": false,
                        "message": res.__("front.ai_steps.chat_has_been_added_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Send success response for non-insider campaign
            finalResponse = {
                'data': {
                    "status": STATUS_SUCCESS,
                    "created_date": getUtcDate(),
                    "inserted_id": insertedId,
                    "result": [],
                    "is_poll_generated": true,
                    "user_conversation_failed": false,
                    "message": res.__("front.ai_steps.chat_has_been_added_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // On error, remove unused campaign and return error response
            await removeCampaignData(req, res, { "inserted_id": "", "user_id": userId });
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "inserted_id": "",
                    "result": [],
                    "is_poll_generated": false,
                    "user_conversation_failed": true,
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveCampaignName();

    /**
     * Function to get AI chat history using async/await for all DB queries.
     * Runs independent queries in parallel for faster response times.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getAiChatHistory = async (req, res) => {
        let finalResponse = {};

        // Get user data
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        // Pagination and timezone
        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT + 2;
        const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE;
        const skip = (limit * page) - limit;

        if (!userId) {
            finalResponse = {
                'data': {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Common condition for chat history
        const commonCondition = {
            "user_id": newObjectIdDefault(userId),
            'is_deleted': NOT_DELETED,
        };

        try {
            // Prepare aggregation pipelines
            const campaignListPipeline = [
                { $match: commonCondition },
                { $sort: { "created": SORT_DESC } },
                {
                    $group: {
                        _id: {
                            "created": { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
                        },
                        all_data: {
                            $push: {
                                _id: "$_id",
                                campaign_name: "$ai_campaign_name",
                                type: "$type",
                                first_ai_poll_generated: "$first_ai_poll_generated",
                                option_datas: {
                                    $filter: {
                                        input: "$option_datas",
                                        as: "option",
                                        cond: { $not: { $in: ["$$option.type", [AI_RESPONSE_TYPE_REWARD, AI_RESPONSE_TYPE_POLL]] } }
                                    }
                                },
                                created: "$created",
                                ai_campaign_created_name: { $cond: ["$ai_campaign_created_name", "$ai_campaign_created_name", ""] }
                            }
                        },
                    }
                },
                {
                    $project: {
                        "_id": 0,
                        "created": "$_id.created",
                        "all_data": 1,
                    }
                },
                { $sort: { "created": SORT_DESC } },
                { $skip: skip },
                { $limit: limit },
            ];

            const totalRecordsPipeline = [
                { $match: commonCondition },
                {
                    $group: {
                        _id: {
                            "created": { $dateToString: { format: "%Y-%m-%d", date: "$created" } },
                        },
                    }
                },
            ];

            // Run both queries in parallel for better performance
            const [historyDetails, totalRecordsArr] = await Promise.all([
                tableAiCampaignName.aggregate(campaignListPipeline).toArray(),
                tableAiCampaignName.aggregate(totalRecordsPipeline).toArray()
            ]);

            const totalRecords = totalRecordsArr ? totalRecordsArr.length : 0;

            // Success response
            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'result': historyDetails || [],
                    'recordsTotal': totalRecords,
                    'limit': limit,
                    'page': page,
                    'total_page': Math.ceil(totalRecords / limit),
                    'message': "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Error response
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'result': 0,
                    'recordsTotal': 0,
                    'limit': 0,
                    'page': 0,
                    'total_page': 0,
                    'message': res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getAiChatHistory();


    /**
     * Function is used to get campaign wise chat details
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getAiChatHistoryDetails = async (req, res) => {
        let finalResponse = {};

        try {
            // Sanitize request body
            req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

            // Extract user and campaign info
            let loginUserData = req.user_data || "";
            let userId = loginUserData._id || "";
            let aiCampaignParentId = req.body.ai_campaign_parent_id || "";
            let serviceType = req.body.type || "";

            // Extract business information
            let businessInformation = loginUserData.public_business_informaton || "";
            let businessIndustryName = businessInformation.business_industry_name || "";
            let BusinessUserName = loginUserData.full_name || "";
            let userProfileImage = loginUserData.profile_image || "";
            let userSlug = loginUserData.slug || "";

            let seokeywordfirst = businessInformation.populate_key_phrase_first || "";
            let seokeywordSecond = businessInformation.populate_key_phrase_second || "";

            let profileImage = userProfileImage;
            let publicBusinessInformaton = businessInformation;
            let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
            let rewardImage = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";

            // Handle case for user_slug (without login)
            let withoutLoginUserSlug = req.body.user_slug || "";
            if (withoutLoginUserSlug !== '') {
                let otherUserCondition = { slug: withoutLoginUserSlug };
                let otherUserOptions = { conditions: otherUserCondition };
                // Get public user detail
                let withoutLoginUserData = await getUserDetailBySlug(req, res, otherUserOptions);
                userId = (withoutLoginUserData.result && withoutLoginUserData.result._id) ? withoutLoginUserData.result._id : "";
            }

            // Validate required fields
            if (!userId || !serviceType || !aiCampaignParentId) {
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        "result": {},
                        "business_information": {},
                        "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Handle reward type
            if (serviceType == AI_RESPONSE_TYPE_REWARD) {
                // Find reward details from campaign chat collection
                let rewardQuery = {
                    "user_id": newObjectIdDefault(userId),
                    "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                    "type": AI_RESPONSE_TYPE_REWARD,
                    "is_deleted": NOT_DELETED
                };
                let rewardProjection = {
                    projection: {
                        "_id": 1,
                        "ai_campaign_parent_id": 1,
                        "user_id": 1,
                        "content": 1,
                        "type": 1,
                        "signup_flag": 1,
                        "ai_reward_draft_flag": 1,
                        "reward_slug": 1,
                        "unique_key": 1,
                        "created": 1,
                        "add_poll_toggle": 1,
                        "welcome_email_id": 1,
                        "newsletter_email_id": 1,
                        "backend_generated_html": 1
                    }
                };

                // Query reward details and update is_viewed in parallel
                let [rewardResult] = await Promise.all([
                    tableAiCampaignChat.find(rewardQuery, rewardProjection).toArray(),
                    tableAiCampaignChat.updateMany(rewardQuery, { $set: { "is_viewed": true } })
                ]);

                if (rewardResult && rewardResult.length > 0) {
                    // Success response
                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": rewardResult,
                            'email_template_image_url': AI_EMAIL_IMAGES_URL,
                            'reward_user_image': businessLogo ? businessLogo : profileImage,
                            'reward_image': rewardImage,
                            "business_information": {
                                'users_url': USERS_URL,
                                'polls_url': POLLS_URL,
                                'social_media_url': AI_SOCIAL_IMAGES_URL,
                                'user_name': BusinessUserName,
                                'user_profile_image': userProfileImage,
                                'user_slug': userSlug,
                                'business_industry_name': businessIndustryName
                            },
                            "message": "",
                        }
                    };
                } else {
                    // Error response
                    finalResponse = {
                        'data': {
                            'status': STATUS_ERROR,
                            'email_template_image_url': AI_EMAIL_IMAGES_URL,
                            'reward_user_image': businessLogo ? businessLogo : profileImage,
                            'reward_image': rewardImage,
                            'result': {},
                            "business_information": {},
                            'message': res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            }

            // Handle other service types
            // Find chat detail from campaign chat collection
            let chatQuery = {
                "user_id": newObjectIdDefault(userId),
                "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                "type": serviceType,
                "is_deleted": NOT_DELETED
            };
            let chatProjection = {
                projection: {
                    "_id": 1,
                    "ai_campaign_parent_id": 1,
                    "user_id": 1,
                    "content": 1,
                    "type": 1,
                    "signup_flag": 1,
                    "ai_reward_draft_flag": 1,
                    "reward_slug": 1,
                    "unique_key": 1,
                    "created": 1,
                    "add_poll_toggle": 1,
                    "welcome_email_id": 1,
                    "newsletter_email_id": 1,
                    "backend_generated_html": 1,
                    "newsletter_email_action_body": 1,
                    "newsletter_email_action_image": 1,
                    "newsletter_email_action": 1,
                }
            };

            // Query chat details and update is_viewed in parallel
            let [result] = await Promise.all([
                tableAiCampaignChat.findOne(chatQuery, chatProjection),
                tableAiCampaignChat.updateOne(chatQuery, { $set: { "is_viewed": true } })
            ]);

            if (result) {
                let aiCampaignChatId = result._id || "";
                let addPollToggle = result.add_poll_toggle || "";

                if (addPollToggle === "") {
                    result['add_poll_toggle'] = TOGGLE_POLL_OFF;
                }

                // Handle poll type
                if (serviceType == AI_RESPONSE_TYPE_POLL) {
                    // Aggregate poll data
                    let pollPipeline = [
                        {
                            $match: {
                                "user_id": newObjectIdDefault(userId),
                                "ai_campaign_chat_id": newObjectIdDefault(aiCampaignChatId),
                                "type": POLL_AI_TYPE
                            }
                        },
                        {
                            $lookup: {
                                from: TABLE_CATEGORIES,
                                let: { categoryId: "$category_id" },
                                pipeline: [
                                    {
                                        $match: {
                                            $expr: {
                                                $and: [
                                                    { $eq: ["$_id", "$$categoryId"] },
                                                ]
                                            },
                                        }
                                    },
                                    { "$project": { name: 1 } }
                                ],
                                as: "catDetails"
                            }
                        },
                        {
                            $project: {
                                "slug": 1,
                                "is_published": 1,
                                "question_media": 1,
                                "question_video_name": 1,
                                "question": 1,
                                "options": 1,
                                "custom_url": 1,
                                "total_count": { $cond: ["$total_count", "$total_count", 0] },
                                "question_extension": 1,
                                "category_name": { $arrayElemAt: ["$catDetails.name", 0] },
                            }
                        },
                    ];

                    let pollResultArr = await polls.aggregate(pollPipeline).toArray();
                    if (pollResultArr && pollResultArr.length > 0) {
                        let pollAiResult = pollResultArr[0] || {};
                        result["poll_slug"] = pollAiResult.slug || "";
                        result["custom_url"] = pollAiResult.custom_url || "";
                        result["question"] = pollAiResult.question || [];
                        result["options"] = pollAiResult.options || [];
                        result["is_published"] = pollAiResult.is_published || "";
                        result["category_name"] = pollAiResult.category_name || "";
                        result["question_media"] = pollAiResult.question_media || "";
                        result["question_video_name"] = pollAiResult.question_video_name || "";
                        result["question_extension"] = pollAiResult.question_extension || "";
                        result["total_count"] = pollAiResult.total_count || 0;

                        finalResponse = {
                            'data': {
                                "status": STATUS_SUCCESS,
                                "result": result,
                                'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                                'email_template_image_url': AI_EMAIL_IMAGES_URL,
                                'reward_user_image': businessLogo ? businessLogo : profileImage,
                                'reward_image': rewardImage,
                                "business_information": {
                                    'users_url': USERS_URL,
                                    'polls_url': POLLS_URL,
                                    'social_media_url': AI_SOCIAL_IMAGES_URL,
                                    'user_name': BusinessUserName,
                                    'user_profile_image': userProfileImage,
                                    'user_slug': userSlug,
                                    'business_industry_name': businessIndustryName
                                },
                                "message": "",
                            }
                        };
                    } else {
                        finalResponse = {
                            'data': {
                                'status': STATUS_ERROR,
                                'reward_user_image': businessLogo ? businessLogo : profileImage,
                                'reward_image': rewardImage,
                                'result': {},
                                'email_template_image_url': AI_EMAIL_IMAGES_URL,
                                "business_information": {},
                                'message': res.__("front.system.something_going_wrong_please_try_again"),
                            }
                        };
                    }
                    return returnApiResult(req, res, finalResponse);
                }
                // Handle SEO type
                else if (serviceType == AI_RESPONSE_TYPE_SEO) {
                    if (result.content) {
                        result.content["seo_keyword_first"] = seokeywordfirst;
                        result.content["seo_keyword_second"] = seokeywordSecond;
                    }
                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": result,
                            'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                            'email_template_image_url': AI_EMAIL_IMAGES_URL,
                            'reward_user_image': businessLogo ? businessLogo : profileImage,
                            'reward_image': rewardImage,
                            "business_information": {
                                'users_url': USERS_URL,
                                'polls_url': POLLS_URL,
                                'social_media_url': AI_SOCIAL_IMAGES_URL,
                                'user_name': BusinessUserName,
                                'user_profile_image': userProfileImage,
                                'user_slug': userSlug,
                                'business_industry_name': businessIndustryName
                            },
                            "message": "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
                // Handle EMAIL type
                else if (serviceType == AI_RESPONSE_TYPE_EMAIL) {
                    // Find poll custom_url for this campaign
                    let pollData = await polls.findOne({
                        "user_id": newObjectIdDefault(userId),
                        "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                        "type": POLL_AI_TYPE,
                    }, { projection: { 'custom_url': 1 } });

                    let customUrl = (pollData && pollData.custom_url) ? pollData.custom_url : "";
                    if (result.content) {
                        result.content["custom_url"] = customUrl ? POLL_VIEW_PAGE_URL + customUrl : "";
                    }

                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": result,
                            'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                            'email_template_image_url': AI_EMAIL_IMAGES_URL,
                            'reward_user_image': businessLogo ? businessLogo : profileImage,
                            'reward_image': rewardImage,
                            "business_information": {
                                'users_url': USERS_URL,
                                'polls_url': POLLS_URL,
                                'social_media_url': AI_SOCIAL_IMAGES_URL,
                                'user_name': BusinessUserName,
                                'user_profile_image': userProfileImage,
                                'user_slug': userSlug,
                                'business_industry_name': businessIndustryName
                            },
                            "message": "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
                // Handle all other types
                else {
                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": result,
                            'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                            'email_template_image_url': AI_EMAIL_IMAGES_URL,
                            'reward_user_image': businessLogo ? businessLogo : profileImage,
                            'reward_image': rewardImage,
                            "business_information": {
                                'users_url': USERS_URL,
                                'polls_url': POLLS_URL,
                                'social_media_url': AI_SOCIAL_IMAGES_URL,
                                'user_name': BusinessUserName,
                                'user_profile_image': userProfileImage,
                                'user_slug': userSlug,
                                'business_industry_name': businessIndustryName
                            },
                            "message": "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Error response if no chat found
                finalResponse = {
                    'data': {
                        'status': STATUS_ERROR,
                        'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                        'email_template_image_url': AI_EMAIL_IMAGES_URL,
                        'social_media_url': AI_SOCIAL_IMAGES_URL,
                        'reward_user_image': businessLogo ? businessLogo : profileImage,
                        'reward_image': rewardImage,
                        'result': {},
                        "business_information": {},
                        'message': res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Catch-all error response
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'template_image_url': EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                    'email_template_image_url': AI_EMAIL_IMAGES_URL,
                    'social_media_url': AI_SOCIAL_IMAGES_URL,
                    'reward_user_image': "",
                    'reward_image': "",
                    'result': {},
                    "business_information": {},
                    'message': res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getAiChatHistoryDetails();

    /**
     * Function is use AI wise reward and template generate
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.aiRewardTemplateGenerate = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let finalResponse = {};

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
            let customerId = loginUserData.user_unique_id || "";
            let signatureImage = loginUserData.signature_image || "";
            let publicBusinessInformation = loginUserData.public_business_informaton || "";
            let businessName = publicBusinessInformation.name_of_the_business || "";
            let aiIndustryNames = publicBusinessInformation.ai_business_industry_names || [];
            let zipCode = loginUserData.zip || "";

            // Format industry names for display
            if (aiIndustryNames.length > 1) {
                let lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
                aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
                aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
                aiIndustryNames.push(lastConcat);
            }
            let aiBusinessIndustry = aiIndustryNames.join(', ');
            let signatureFullImage = signatureImage ? SIGNATURE_URL + signatureImage : "";

            // Run queries in parallel using Promise.all for faster response
            const [
                alreadyCreateAiReward,
                alreadyCreateAiTemplate,
                dataVaultResult
            ] = await Promise.all([
                // Check if AI reward already created
                rewards.countDocuments({
                    ai_bot_reward: true,
                    user_id: userId,
                    is_deleted: NOT_DELETED
                }),
                // Check if AI template already created
                emailTemplate.countDocuments({
                    template_type: EMAIL_TEMPLATE_WELCOME_TYPE,
                    user_id: newObjectIdDefault(userId),
                    is_deleted: NOT_DELETED,
                    ai_bot: true
                }),
                // Get data vault info
                web_ai_info.findOne(
                    { user_id: newObjectIdDefault(userId) },
                    { projection: { _id: 0, data: 1, social_media_presence: 1 } }
                )
            ]);

            let businessInformationData = dataVaultResult?.data || "";
            let socialMediaPresence = dataVaultResult?.social_media_presence || {};

            // Merge social media presence into business info, remove topPosts
            if (socialMediaPresence && Object.keys(socialMediaPresence).length > 0) {
                delete socialMediaPresence.topPosts;
                businessInformationData = { ...businessInformationData, ...socialMediaPresence };
            }

            // Remove empty keys and stringify for prompt
            removeEmptyKeys(businessInformationData);
            businessInformationData = JSON.stringify(businessInformationData);

            // Only allow creation if reward or template not already created
            if (alreadyCreateAiReward === 0 || alreadyCreateAiTemplate === 0) {
                // Run reward generation, store types, and template fetch in parallel
                const [
                    aiGenerateReward,
                    rewardStoreTypes,
                    aiBotActiveWelcomeEmail
                ] = await Promise.all([
                    // Generate reward using Gemini or OpenAI
                    (async () => {
                        if (GEMINI_SERVER_ENABLE === true) {
                            let prompt = SIGNUP_USER_REWARD_PROMPT.replace(/{business_name}/g, businessName).replace(/{data_vault}/g, businessInformationData);
                            let rewardResponse = await generateRewardData(req, res, { prompt });
                            return rewardResponse?.response?.reward || {};
                        } else {
                            let userRewardContentData = SIGNUP_USER_REWARD_PROMPT.replace(/{business_name}/g, businessName).replace(/{data_vault}/g, businessInformationData) + " " + REWARD_FORMAT;
                            let rewardArray = [
                                { role: "system", content: REWARD_FORMAT },
                                { role: AI_ROLE_USER, content: userRewardContentData }
                            ];
                            let result = await openai.createChatCompletion({
                                model: "gpt-4o",
                                messages: rewardArray,
                                temperature: TEMPERATURE,
                                top_p: TOP_P,
                                frequency_penalty: FREQUENCY_PENALTY,
                                presence_penalty: PRESENCE_PENALTY
                            });
                            let aiResponse = result.data.choices[0].message.content;
                            let arrayResponseData;
                            try {
                                arrayResponseData = JSON.parse(aiResponse);
                                if (!arrayResponseData.hasOwnProperty("reward")) {
                                    // Retry if reward key missing
                                    let reSendPrompt = await openai.createChatCompletion({
                                        model: "gpt-4o",
                                        messages: rewardArray,
                                        temperature: TEMPERATURE,
                                        top_p: TOP_P,
                                        frequency_penalty: FREQUENCY_PENALTY,
                                        presence_penalty: PRESENCE_PENALTY
                                    });
                                    let new_aimessage = reSendPrompt.data.choices[0].message.content;
                                    arrayResponseData = JSON.parse(new_aimessage);
                                }
                                return arrayResponseData.reward || {};
                            } catch (error) {
                                return error;
                            }
                        }
                    })(),
                    // Get store types for reward
                    mastercollection.distinct("_id", {
                        dropdown_type: MASTER_STORE_TYPE,
                        status: ACTIVE
                    }),
                    // Get active AI bot welcome email template
                    aiBotEmailcollection.findOne({ is_active: ACTIVE })
                ]);

                // Validate all required data is present
                if (aiGenerateReward && rewardStoreTypes && aiBotActiveWelcomeEmail) {
                    // Prepare reward data for insertion
                    let packageRewardData = {
                        user_id: userId,
                        lead_forms_id: "",
                        reward_text: aiGenerateReward.heading,
                        reward_sub_heading: aiGenerateReward.subheading,
                        graphic_image: "",
                        graphic_type: UPLOAD_IMAGE,
                        url_attach: "",
                        url_title: "",
                        url_desc: aiGenerateReward.description,
                        result_no: DEFAULT_ZERO,
                        is_active: ACTIVE,
                        store_type_id: rewardStoreTypes,
                        type: REWARDS_AI_USER_ADD,
                        expiry_date: "",
                        toogle_expiry_date: 0,
                        ai_bot_reward: true,
                    };

                    // Insert reward and then template, then update related records
                    try {
                        let insertedRewardId = await addPackageReward(packageRewardData);

                        let userEmail = res.locals.settings["Email.user_email"];
                        let emailHost = res.locals.settings["Email.host"];
                        let emailPassword = res.locals.settings["Email.password"];
                        let emailPort = res.locals.settings["Email.port"];

                        let publicBusinessInformaton = loginUserData.public_business_informaton || "";
                        let nameOfTheBusiness = publicBusinessInformaton.name_of_the_business || "";

                        let pageBody = aiBotActiveWelcomeEmail.body || "";
                        let designJson = aiBotActiveWelcomeEmail.design_json || "";
                        let subjectAIAdmin = aiBotActiveWelcomeEmail.subject || "";
                        let emailTemplateTitle = aiBotActiveWelcomeEmail.template_title || "";
                        subjectAIAdmin = subjectAIAdmin.replace(RegExp('{BUSINESS_NAME}', 'g'), businessName);

                        // Add welcome email template
                        let responseEmail = await addEmailTemplateNewsletter({
                            template_title: emailTemplateTitle,
                            subject: subjectAIAdmin,
                            body: pageBody,
                            description: "",
                            user_id: userId,
                            customer_id: customerId,
                            from: nameOfTheBusiness ? removeSpecialCharacters(nameOfTheBusiness) : "",
                            from_email: userEmail,
                            attach_reward: insertedRewardId,
                            host: emailHost,
                            port: emailPort,
                            email_password: emailPassword,
                            template_type: EMAIL_TEMPLATE_WELCOME_TYPE,
                            design_json: designJson,
                            ai_bot: true,
                            system_generate: true,
                            skip_smtp: true,
                            email_descriptions: {
                                [DEFAULT_LANGUAGE_MONGO_ID]: {
                                    language_id: DEFAULT_LANGUAGE_MONGO_ID,
                                    subject: subjectAIAdmin,
                                    body: pageBody
                                }
                            },
                        });

                        let tempalteId = responseEmail.email_inserted_id || "";

                        // Update all other rewards for this user to ai_bot_reward: false
                        await rewards.updateMany(
                            { _id: { $ne: insertedRewardId }, user_id: newObjectIdDefault(userId) },
                            { $set: { ai_bot_reward: false } }
                        );

                        // Update all other email templates for this user to ai_bot: false
                        await emailTemplate.updateMany(
                            { _id: { $ne: tempalteId }, user_id: newObjectIdDefault(userId), template_type: EMAIL_TEMPLATE_WELCOME_TYPE },
                            { $set: { ai_bot: false } }
                        );

                        // Assign reward to complete templates
                        let optionsEmailTemplateData = { attach_reward: "" };
                        await completeEmailTemplateRewardAssign(req, res, optionsEmailTemplateData);

                        // Generate image from HTML content
                        await htmltoImageConvert(req, res, tempalteId);

                        // Update default welcome email id
                        await updateAssignDefaultWelcomeEmailId(userId);

                        // Success response
                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                aiGenerateReward: aiGenerateReward,
                                message: res.__("front.ai_bot.reward_and_wlc_email_template_has_been_created_successfully"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);

                    } catch (err) {
                        // Error in reward/template creation
                        finalResponse = {
                            data: {
                                status: STATUS_ERROR,
                                message: res.__("front.system.something_going_wrong_please_try_again"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    }
                } else {
                    // Required data missing
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Already created
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.ai_bot.already_reward_template_created"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Catch-all error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end aiRewardTemplateGenerate();

    /**
     * Function is used to get campaign detail with prompt using async/await.
     * All DB queries are run in a single aggregation pipeline for optimal performance.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getCampaignDetailWithPrompt = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user data
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? loginUserData._id : "";

            // Check for valid user
            if (!userId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Common condition for chat history data
            let commonCondition = {
                user_id: newObjectIdDefault(userId),
                is_deleted: NOT_DELETED,
            };

            // Build aggregation pipeline
            const pipeline = [
                { $match: commonCondition },
                {
                    $lookup: {
                        from: TABLE_AI_CAMPAIGN_CHAT,
                        let: { aiCampaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$aiCampaignNameId"] },
                                            { $eq: ["$is_deleted", NOT_DELETED] },
                                            { $ne: ["$type", ""] },
                                            { $ne: ["$content", ""] },
                                        ]
                                    }
                                }
                            },
                            { $project: { type: 1, content: 1, second_phase: 1, user_prompt: 1, system_prompt: 1 } }
                        ],
                        as: "campaign_details"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_INSIDER_AI_CAMPAIGN_CHAT,
                        let: { aiCampaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$aiCampaignNameId"] },
                                            { $eq: ["$is_deleted", NOT_DELETED] },
                                            { $ne: ["$type", ""] },
                                            { $ne: ["$content", ""] },
                                        ]
                                    }
                                }
                            },
                            { $project: { type: 1, content: 1, user_prompt: 1, system_prompt: 1 } }
                        ],
                        as: "insider_campaign_details"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_INSIDER_AI_EMAIL_TEMPLATE_LOGS,
                        let: { aiCampaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$aiCampaignNameId"] },
                                            { $eq: ["$role", AI_ROLE_ASSISTANT] },
                                            { $ne: ["$content", ""] },
                                        ]
                                    }
                                }
                            },
                            { $project: { content: 1, user_prompt: 1, system_prompt: 1 } }
                        ],
                        as: "insider_poll_edit_email_logs_details"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_AI_EMAIL_TEMPLATE_LOGS,
                        let: { aiCampaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$aiCampaignNameId"] },
                                            { $eq: ["$role", AI_ROLE_ASSISTANT] },
                                            { $ne: ["$content", ""] },
                                        ]
                                    }
                                }
                            },
                            { $project: { content: 1, user_prompt: 1, system_prompt: 1 } }
                        ],
                        as: "edit_email_logs_details"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_AI_SEO_LOGS,
                        let: { aiCampaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$aiCampaignNameId"] },
                                            { $eq: ["$role", AI_ROLE_ASSISTANT] },
                                            { $ne: ["$content", ""] },
                                        ]
                                    }
                                }
                            },
                            { $project: { content: 1, user_prompt: 1, system_prompt: 1 } }
                        ],
                        as: "edit_seo_logs_details"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_AI_SOCIAL_POST_LOGS,
                        let: { aiCampaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$aiCampaignNameId"] },
                                            { $eq: ["$role", AI_ROLE_ASSISTANT] },
                                            { $ne: ["$content", ""] },
                                        ]
                                    }
                                }
                            },
                            { $project: { content: 1, second_phase: 1, user_prompt: 1, system_prompt: 1 } }
                        ],
                        as: "edit_social_post_logs_details"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        ai_campaign_name: 1,
                        ai_campaign_created_name: 1,
                        created: 1,
                        campaign_details: 1,
                        insider_campaign_details: 1,
                        insider_poll_edit_email_logs_details: 1,
                        edit_email_logs_details: 1,
                        edit_seo_logs_details: 1,
                        edit_social_post_logs_details: 1,
                    }
                },
                { $sort: { created: SORT_DESC } }
            ];

            // Run aggregation query using async/await
            const result = await tableAiCampaignName.aggregate(pipeline).toArray();

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: result || [],
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
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getCampaignDetailWithPrompt();

    /**
     * Function is used to get campaign progress bar
     * Uses async/await for all DB operations and runs queries in parallel where possible.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getCampaignProgressBar = async (req, res) => {
        let finalResponse = {};

        try {
            // Sanitize request body
            req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

            // Extract user and campaign info
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? loginUserData._id : "";
            let aiBotEmbedViewed = loginUserData.ai_bot_embed_viewed ? loginUserData.ai_bot_embed_viewed : "";
            let aiCampaignParentId = req.body.ai_campaign_parent_id ? req.body.ai_campaign_parent_id : "";

            // Prepare embed log data
            let pushDataFlag = false;
            let embedTypeShow = req.body.embed_type_show ? req.body.embed_type_show : "";
            let embedPushdata = { "_id": userId, "type": "embed", "is_viewed": true };

            // If embed type is shown, update user collection in parallel
            let updateEmbedPromise = null;
            if (embedTypeShow !== '') {
                updateEmbedPromise = usercollection.updateOne(
                    { "_id": newObjectIdDefault(userId) },
                    { $set: { "ai_bot_embed_viewed": true } }
                );
                pushDataFlag = true;
            }
            if (aiBotEmbedViewed !== '') {
                pushDataFlag = true;
            }

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

            // Prepare chat query
            const chatQuery = {
                user_id: newObjectIdDefault(userId),
                ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                type: { $nin: ['', null] }
            };
            const chatProjection = { projection: { "_id": 1, "type": 1, "is_viewed": 1 } };

            // Run chat query and embed update in parallel for faster response
            let [chatResult] = await Promise.all([
                tableAiCampaignChat.find(chatQuery, chatProjection).toArray(),
                updateEmbedPromise
            ]);

            // If pushDataFlag is set, push embed log to result
            if (pushDataFlag) {
                chatResult.push(embedPushdata);
            }

            // Count viewed items
            let viewCount = 0;
            if (chatResult && chatResult.length > 0) {
                for (let record of chatResult) {
                    if (record.is_viewed === true) {
                        viewCount++;
                    }
                }
            }

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: chatResult,
                    view_count: viewCount,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    view_count: 0,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getCampaignProgressBar();

    /**
     * Function is used to update add poll toggle in email
     * Uses async/await for database operations for cleaner and faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updatePollAiToggle = async (req, res) => {
        let finalResponse = {};

        try {
            // Sanitize request body
            req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

            // Extract user and request data
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? loginUserData._id : "";
            let addPollToggle = req.body.add_poll_toggle ? req.body.add_poll_toggle : "";
            let aiCampaignParentId = req.body.ai_campaign_parent_id ? req.body.ai_campaign_parent_id : "";

            // Validate required fields
            if (!userId || !addPollToggle || !aiCampaignParentId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Update add_poll_toggle in the campaign chat document
            const updateQuery = {
                user_id: newObjectIdDefault(userId),
                ai_campaign_parent_id: newObjectIdDefault(aiCampaignParentId),
                type: AI_RESPONSE_TYPE_EMAIL
            };
            const updateData = { $set: { add_poll_toggle: addPollToggle } };

            // Run the update operation
            const result = await tableAiCampaignChat.updateOne(updateQuery, updateData);

            if (result && result.modifiedCount > 0) {
                // Success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.ai_bot.add_poll_toggle_update_successfully"),
                    }
                };
            } else {
                // No document updated or error
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Catch-all error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end updatePollAiToggle();

}
module.exports = new AiCampaignChat();