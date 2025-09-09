const async = require("async");
const axios = require('axios');
const { resolve } = require("path");
const path = require('path');
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});

/** Define collection*/
const tableLibraryLogs = db.collection(TABLE_CONTENT_LIBRARY_LOGS);
const campaignNewsletterCollection = db.collection(TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES);
const polls = db.collection(TABLE_POLLS);
const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const users = db.collection(TABLE_USERS);
const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);
const web_links = db.collection(TABLE_WEB_LINKS);
const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
const multipleUserGroup = db.collection(TABLE_MULTIPLE_USER_GROUPS);

function ContentLibrary() {

    /**
    * Function to get content library data using async/await for faster and cleaner response.
    * Handles all DB and external queries with async/await and runs parallel queries with Promise.all.
    * @returns json response
    */
    this.getContentLibrary = async (req, res) => {
        let finalResponse = {};

        // Get user and request data
        let uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
        let ipAddr = req.body.ip ? req.body.ip : "";
        let websiteUrl = req.body.website_url ? ensureHttpPrefix(req.body.website_url) : "";

        // Check for required fields
        if (!uniqueBrowserId || !websiteUrl) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Extract hostname and domain
        const hostname = websiteUrl.split('//')[1].split('/')[0];
        const parts = hostname.split('.');
        const domain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;

        // Ensure protocol is correct
        let protocolSite = await checkProtocol(websiteUrl);
        websiteUrl = protocolSite ? protocolSite : websiteUrl;

        // Get not allowed domains from settings
        let urlDomainsNotAllowed = domain ? JSON.parse(JSON.stringify(res.locals.settings["Site.Not_crawl_domain"])) : [];
        if (urlDomainsNotAllowed.includes(domain)) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.content_library.unable_to_crawl_the_website"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            let websiteCrawlable = true;
            const initialWebLinkId = newObjectIdDefault();
            let childLinks = [];

            // Run insert and crawl in parallel for better performance
            const [insertResult, firstResponse] = await Promise.all([
                insertWebLinkData({
                    _id: initialWebLinkId,
                    user_id: "",
                    website_url: websiteUrl,
                    child_links: childLinks,
                    unique_browser_id: uniqueBrowserId
                }),
                crawlAndSave(req, res, {
                    url: websiteUrl,
                    web_id: initialWebLinkId,
                    unique_browser_id: uniqueBrowserId
                })
            ]);

            // If crawling failed, delete web link and try fallback
            if (firstResponse.status === STATUS_ERROR) {
                await web_links.deleteOne({ _id: initialWebLinkId });
                websiteCrawlable = false;

                let fallBackResponse = await fallbackProcessForCrawlData(req, res, {
                    website_url: websiteUrl,
                    initial_web_link_id: initialWebLinkId,
                    unique_browser_id: uniqueBrowserId,
                    max_tries: 3,
                    is_domain_crawl: websiteCrawlable,
                    ip_addr: ipAddr
                });

                if (fallBackResponse.status === STATUS_SUCCESS) {
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: fallBackResponse.result,
                            message: fallBackResponse.message,
                        }
                    };
                } else {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: [],
                            message: res.__("front.content_library.website_details_not_found"),
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            }

            // Process crawl data
            let crawlData = firstResponse.data ? firstResponse.data : [];
            let siteLinks = Array.isArray(firstResponse.site_links) ? firstResponse.site_links : [];
            let totalWordCount = countWords(crawlData);

            // If not enough words, crawl another random page
            if (totalWordCount < 100) {
                let randomPageData = await crawlOneAnotherPageRandomaly({ links: siteLinks });
                let randomPageResponse = randomPageData.data ? randomPageData.data : "";
                crawlData = [...crawlData, ...randomPageResponse];
            }

            // Retrieve information from web info db
            let response = await retrieveInformation({
                web_id: initialWebLinkId,
                data: crawlData,
                website_url: websiteUrl,
                unique_browser_id: uniqueBrowserId
            });

            if (response.status === STATUS_ERROR) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let instagramUrl = response.instagram_url ? response.instagram_url : "";
            let finalData = response.result ? response.result : {};
            let businessInformationData = Object.keys(finalData).length > 0 ? finalData : "";

            if (response.status === STATUS_SUCCESS && Object.keys(finalData).length > 0) {
                // Generate first social post with image using AI
                let aiSocialPostContent = await generateFirstSocialPostWithImage(req, res, {
                    business_information: businessInformationData,
                    website_url: websiteUrl,
                    unique_browser_id: uniqueBrowserId
                });
                let socialPostResponse = aiSocialPostContent.status === STATUS_SUCCESS ? aiSocialPostContent.result : "";

                if (aiSocialPostContent.status === STATUS_SUCCESS && socialPostResponse !== "") {
                    let aiContentData = socialPostResponse ? [{ social_media: socialPostResponse }] : [];
                    finalData.website_url = websiteUrl;
                    finalData.instagram_url = instagramUrl;
                    finalData.web_id = initialWebLinkId;
                    finalData.website_crawlable = websiteCrawlable;
                    finalData.website_image_crawlable = aiSocialPostContent.website_image_crawl;
                    let zipCode = finalData.zipCode?.trim() || DEFAULT_USER_ZIP;

                    // Save content library logs (async/await for DB)
                    await tableLibraryLogs.findOneAndUpdate(
                        { unique_ai_browser_id: uniqueBrowserId },
                        {
                            $set: {
                                zip_code: zipCode,
                                modified: getUtcDate(),
                                ai_content: aiContentData,
                                website_data: finalData
                            },
                            $setOnInsert: {
                                ip_addr: ipAddr,
                                unique_ai_browser_id: uniqueBrowserId,
                                created: getUtcDate()
                            }
                        },
                        { upsert: true }
                    );

                    let aiContentSocialData = socialPostResponse ? [{ social_media: { content: socialPostResponse } }] : [];
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: aiContentSocialData,
                            web_id: initialWebLinkId,
                            message: "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: [],
                            web_id: "",
                            message: res.__("front.content_library.website_details_not_found"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Clean up if crawling or info retrieval failed
                await web_links.deleteOne({ _id: initialWebLinkId });
                await web_ai_info.deleteOne({ web_id: initialWebLinkId });
                websiteCrawlable = false;

                let fallBackResponse = await fallbackProcessForCrawlData(req, res, {
                    website_url: websiteUrl,
                    initial_web_link_id: initialWebLinkId,
                    unique_browser_id: uniqueBrowserId,
                    max_tries: 3,
                    is_domain_crawl: websiteCrawlable,
                    ip_addr: ipAddr
                });

                if (fallBackResponse.status === STATUS_SUCCESS) {
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: fallBackResponse.result,
                            message: fallBackResponse.message,
                        }
                    };
                } else {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: [],
                            message: res.__("front.content_library.website_details_not_found"),
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: error,
                    web_id: "",
                    message: res.__("front.content_library.website_details_not_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getContentLibrary();

    /**
     * Function to crawl home page URLs using async/await for faster and cleaner response.
     * Handles all DB and extraction queries with async/await.
     * @returns json response
     */
    this.crawlHomePageUrls = async (req, res) => {
        let finalResponse = {};
        let webId = req.body.web_id ? req.body.web_id : "";
        let websiteUrl = req.body.website_url ? ensureHttpPrefix(req.body.website_url) : "";

        try {
            // Extract the actual redirected URL
            let protocolSite = await checkProtocol(websiteUrl);
            websiteUrl = protocolSite ? protocolSite : websiteUrl;

            if (!webId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Fetch other page links for the given webId
            const otherPages = await web_links.findOne(
                { _id: newObjectIdDefault(webId) },
                { projection: { other_pages_links: 1, _id: 0 } }
            );
            const otherPagesLinks = otherPages?.other_pages_links || [];

            // Extract domain links from the other pages
            const linksArray = await extractDomainLinks(otherPagesLinks);

            // Change page type for the extracted URLs
            const childLinks = Array.isArray(linksArray.data.urls) ? changePageType(linksArray.data.urls) : [];

            // Update the web link document with the new child links and remove other_pages_links
            await web_links.updateOne(
                { _id: newObjectIdDefault(webId) },
                { $set: { child_links: childLinks }, $unset: { other_pages_links: 1 } }
            );

            // Crawl all pages sequentially for the given webId
            await crawlAllPagesSequentially({ web_id: newObjectIdDefault(webId) });

            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.content_library.website_details_not_found"),
                    error: error
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end crawlHomePageUrls();

    /**
     * Function to get content social post data using async/await for faster and cleaner response.
     * Handles all DB queries with async/await and runs parallel queries with Promise.all where possible.
     * @returns json response
     */
    this.getContentSocialPost = async (req, res) => {
        let finalResponse = {};
        const loginUserData = req.user_data || {};
        const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        const loginUserSlug = loginUserData.slug || "";
        const uniqueBrowserId = req.body.unique_ai_browser_id || "";
        const fromCampaignLibraryEditManually = req.body.from_campaign_library_edit_manually || false;
        const currentTimezone = req.body.default_timezone || "";

        // If neither user nor browser id is present, deny access
        if (!uniqueBrowserId && !userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // If user is logged in
        if (userId) {
            const publicBusinessInformaton = loginUserData.public_business_informaton || "";
            const websiteUrl = (publicBusinessInformaton && publicBusinessInformaton.website_url) ? publicBusinessInformaton.website_url : "";
            const instagramUserDetails = loginUserData.instagram_user_details || "";
            const instagramUrl = loginUserData.instagram_url || "";

            // Prepare query options
            let optionsData = {
                user_id: newObjectIdDefault(userId),
                signup_flag: false,
                first_content_campaign: true,
                popup_close: { $ne: true },
                type: AI_RESPONSE_TYPE_SOCIAL_MEDIA
            };

            // Remove popup_close if editing manually
            if (fromCampaignLibraryEditManually) {
                delete optionsData.popup_close;
            }

            // Only allow if slug matches browser id
            if (loginUserSlug === uniqueBrowserId) {
                try {
                    // Run count and findOne in parallel for performance
                    const [totalSocialPost, postResult] = await Promise.all([
                        tableAiCampaignChat.countDocuments({
                            user_id: newObjectIdDefault(userId),
                            signup_flag: false,
                            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA
                        }),
                        tableAiCampaignChat.findOne(optionsData, { projection: { content: 1, unique_key: 1 } })
                    ]);

                    if (postResult) {
                        const socialMediaDataRaw = postResult.content || {};
                        const campaignId = postResult._id || "";
                        const uniqueKey = postResult.unique_key || "";

                        // Fetch schedule data for the campaign
                        const scheduleResult = await calendarSchedulePost.findOne({
                            ai_campaign_chat_id: newObjectIdDefault(campaignId),
                            user_id: newObjectIdDefault(userId)
                        });

                        const calenderScheduleId = (scheduleResult && scheduleResult._id) ? scheduleResult._id : "";
                        const scheduleDate = (scheduleResult && scheduleResult.schedule_date)
                            ? newDateTimeZone(scheduleResult.schedule_date, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone)
                            : "";

                        // Compose response data
                        const socialMediaData = {
                            unique_key: uniqueKey,
                            social_media: { content: { ...socialMediaDataRaw, _id: campaignId } },
                            campaign_id: campaignId,
                            calendar_schedule_id: calenderScheduleId,
                            schedule_date: scheduleDate,
                        };

                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                result: socialMediaData,
                                email: "",
                                website_url: websiteUrl,
                                instagram_url: instagramUrl,
                                instagram_user_details: instagramUserDetails,
                                full_image_url: AI_SOCIAL_IMAGES_URL,
                                total_social_post: totalSocialPost,
                                message: "",
                            }
                        };
                    } else {
                        // No post found for user
                        finalResponse = {
                            data: {
                                status: STATUS_ERROR,
                                result: {},
                                email: "",
                                website_url: websiteUrl,
                                instagram_url: instagramUrl,
                                instagram_user_details: instagramUserDetails,
                                total_social_post: totalSocialPost,
                                message: res.__("front.global.no_record_found"),
                            }
                        };
                    }
                    return returnApiResult(req, res, finalResponse);
                } catch (err) {
                    // Handle unexpected errors
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            email: "",
                            website_url: websiteUrl,
                            instagram_url: instagramUrl,
                            instagram_user_details: instagramUserDetails,
                            total_social_post: 0,
                            message: res.__("front.global.no_record_found"),
                            error: err
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Slug and browser id do not match
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        email: "",
                        total_social_post: DEACTIVE,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } else {
            // Not logged in, fetch from logs
            try {
                // Find log entry for the browser id
                const result = await tableLibraryLogs.findOne(
                    { unique_ai_browser_id: uniqueBrowserId },
                    { projection: { email: 1, zip_code: 1, ai_content: 1, website_data: 1, black_popup: 1 } }
                );

                if (result) {
                    const aiData = result.ai_content || [];
                    const email = result.email || "";
                    const zipCode = result.zip_code || DEFAULT_USER_ZIP;
                    const websiteData = result.website_data || {};
                    const businessName = websiteData.business_name || "";
                    const websiteUrl = websiteData.website_url || "";
                    const instagramUserDetails = websiteData.instagram_user_details || "";
                    const instagramUrl = websiteData.instagram_url || "";
                    const blackPopup = !!result.black_popup;

                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: {
                                social_media: {
                                    content: (aiData[0] && aiData[0]['social_media']) ? aiData[0]['social_media'] : [],
                                }
                            },
                            email: email,
                            business_name: businessName,
                            zip_code: zipCode,
                            website_url: websiteUrl,
                            instagram_url: instagramUrl,
                            instagram_user_details: instagramUserDetails,
                            full_image_url: AI_SOCIAL_IMAGES_URL,
                            black_popup: blackPopup,
                            message: "",
                        }
                    };
                } else {
                    // No log found
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            email: "",
                            business_name: "",
                            zip_code: "",
                            website_url: "",
                            instagram_url: "",
                            message: res.__("front.global.no_record_found"),
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            } catch (err) {
                // Handle unexpected errors
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        email: "",
                        business_name: "",
                        zip_code: "",
                        website_url: "",
                        instagram_url: "",
                        message: res.__("front.global.no_record_found"),
                        error: err
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        }
    }; // end getContentSocialPost();

    /**
     * Function to update the social popup close flag for the user.
     * Uses async/await for all DB operations and runs updates in parallel using Promise.all for faster response.
     * @returns {json} API response
     */
    this.socialPopupCloseFlag = async (req, res) => {
        let finalResponse = {};
        const loginUserData = req.user_data || {};
        const userId = loginUserData._id;

        // Parse and prepare scheduling flags from request
        const yesAutomaticSchedule = JSON.parse(req.body.yes_automatic_schedule || "false");
        const automaticSchedule = req.body.yes_automatic_schedule ? "yes" : "no";

        // Check for valid user
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                },
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare update conditions and data
        const optionsChatDetails = {
            user_id: newObjectIdDefault(userId),
            first_content_campaign: true,
            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
        };

        try {
            // Run both updates in parallel for efficiency
            await Promise.all([
                // Update popup_close flag in campaign chat
                tableAiCampaignChat.updateOne(
                    optionsChatDetails,
                    { $set: { popup_close: true } }
                ),
                // Update user flags for popup and scheduling
                users.updateOne(
                    { _id: newObjectIdDefault(userId) },
                    {
                        $set: {
                            view_your_week_of_social_post_popup: true,
                            auto_generate_social_post_after_yes_click: false,
                            yes_automatic_schedule: yesAutomaticSchedule,
                            automatic_schedule: automaticSchedule
                        }
                    }
                )
            ]);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors and send error response
            console.error("Error in socialPopupCloseFlag:", error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                },
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end socialPopupCloseFlag();

    /**
     * Function is used to save first campaign content    
     * @returns json response
     */
    this.saveFirstCampaignContent = async (req, res) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id : "";
        let campaignName = req.body.ai_campaign_name ? req.body.ai_campaign_name : "content library first";
        let enterpriseFirstSocialPost = req.body.enterprise_first_social_post ? req.body.enterprise_first_social_post : false;

        if (!userId || !uniqueBrowserId || !campaignName) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // If this is an enterprise first social post, just delete the logs and return success
            if (enterpriseFirstSocialPost && enterpriseFirstSocialPost === true) {
                await tableLibraryLogs.deleteOne({ unique_ai_browser_id: uniqueBrowserId });
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.first_campaign_saved_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Find website details and first campaign details
            const result = await tableLibraryLogs.findOne({ unique_ai_browser_id: uniqueBrowserId });

            if (!result) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
            let websiteUrl = publicBusinessInformaton.website_url ? publicBusinessInformaton.website_url : "";
            let email = loginUserData && loginUserData.email ? loginUserData.email : "";
            let customerId = loginUserData && loginUserData.user_unique_id ? loginUserData.user_unique_id : "";

            let allContentData = result && result.ai_content ? result.ai_content : [];
            let websiteAllData = result && result.website_data ? result.website_data : "";
            let businessName = websiteAllData.business_name ? websiteAllData.business_name : "";
            let businessIndustry = websiteAllData.business_industry ? websiteAllData.business_industry : "";
            let zipCode = websiteAllData.zip_code ? websiteAllData.zip_code : "";
            let websiteData = websiteUrl == "" ? emailToDomainUrl(email) : websiteUrl;

            let slugOptions = {
                title: campaignName,
                table_name: TABLE_AI_CAMPAIGN_NAME,
                slug_field: "slug"
            };

            // Generate database slug
            let slugResponse = await getDatabaseSlug(slugOptions);

            // Insert campaign name
            let campaignNameInsert = await tableAiCampaignName.insertOne({
                user_id: userId,
                slug: slugResponse?.title || "",
                ai_campaign_name: campaignName,
                ai_campaign_created_name: "",
                type: DEFAULT_CAMPAIGN,
                is_deleted: NOT_DELETED,
                signup_flag: false,
                first_content_campaign: true,
                created: getUtcDate(),
            });

            if (!campaignNameInsert || !campaignNameInsert.insertedId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let campaignNameId = newObjectIdDefault(campaignNameInsert.insertedId);
            let socialPostData = (allContentData && allContentData[0]) ? allContentData[0][AI_RESPONSE_TYPE_SOCIAL_MEDIA] : "";

            let insertData = {
                user_id: userId,
                ai_campaign_parent_id: campaignNameId,
                role: AI_ROLE_ASSISTANT,
                content: socialPostData,
                type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                is_viewed: false,
                signup_flag: false,
                unique_key: generateRandomID(8),
                first_ai_poll_generated: false,
                first_content_campaign: true,
                system_generate: true,
                is_draft: CAMPAIGN_NOT_DRAFT,
                is_deleted: NOT_DELETED,
                created: getUtcDate()
            };

            // Insert campaign chat data
            let campaignChatInsert = await tableAiCampaignChat.insertOne(insertData);

            if (!campaignChatInsert || !campaignChatInsert.insertedId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Delete content library logs after successful insertions
            await tableLibraryLogs.deleteOne({ unique_ai_browser_id: uniqueBrowserId });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.content_library.first_campaign_saved_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors and send error response
            console.error("Error in saveFirstCampaignContent:", error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveFirstCampaignContent();

    /**
     * Function to get campaign name suggestions using async/await for faster and cleaner response.
     * Handles all DB queries with async/await and runs parallel queries with Promise.all where possible.
     * @returns json response
     */
    this.getSuggetionCampaignName = async (req, res) => {
        let finalResponse = {};

        // Get user data and userId
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

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

        try {
            // Get user public business information
            const publicBusinessInformaton = loginUserData.public_business_informaton || {};
            const businessName = publicBusinessInformaton.name_of_the_business || "";
            const specificProductService = publicBusinessInformaton.specific_product_or_service || "";
            const benefitService = publicBusinessInformaton.benefits_product_or_service || "";
            const targetAudienceData = publicBusinessInformaton.target_audience || "";
            let aiIndustryNames = publicBusinessInformaton.ai_business_industry_names || [];

            // Format industry names for better readability
            if (aiIndustryNames.length > 1) {
                const lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
                aiIndustryNames.splice(aiIndustryNames.length - 2, 2, lastConcat);
            }
            const aiBusinessIndustry = aiIndustryNames.join(', ');

            const businessData = {
                business_name: businessName,
                key_products: specificProductService,
                services: benefitService,
                brand_voice: targetAudienceData,
                business_industry: aiBusinessIndustry
            };

            // Run DB queries in parallel for faster response
            const [webInfoData, previousTopicsArr] = await Promise.all([
                // Get web AI info for the user
                web_ai_info.findOne(
                    { user_id: userId },
                    { projection: { _id: 0, data: 1 } }
                ),
                // Get previous campaign topics for the user
                tableAiCampaignChat.find(
                    { user_id: userId, type: AI_RESPONSE_TYPE_SOCIAL_MEDIA, topic: { $exists: true } },
                    { projection: { _id: 0, topic: 1 } }
                )
                    .sort({ created: SORT_DESC })
                    .limit(10)
                    .toArray()
            ]);

            // Format previous topics
            const previousTopics = (previousTopicsArr && previousTopicsArr.length > 0)
                ? previousTopicsArr.map((item, index) => `${index + 1}. ${item.topic}`).join('\n')
                : "";

            // Use web info data if available, otherwise fallback to businessData
            let businessInformationData = (webInfoData && webInfoData.data) ? webInfoData.data : businessData;

            // Remove empty keys and convert to markdown
            removeEmptyKeys(businessInformationData);
            businessInformationData = objectToMarkdown(businessInformationData);

            // Prepare prompt options
            const userPrompt = SUGGESTION_CAMPAIGN_PROMPT
                .replace(/{BUSINESS_DATA}/g, businessInformationData)
                .replace(/{PREVIOUS_TOPICS}/g, previousTopics);

            let urlData = "";

            // Get suggestion from Gemini or fallback to website data
            if (GEMINI_SERVER_ENABLE === true) {
                urlData = await commonForGeminiWithGrounding(req, res, {
                    prompt: userPrompt,
                    format: SUGGETION_CAMPAIGN_FORMAT
                });
            } else {
                urlData = await getWebsiteDataFromUrl(req, res, {
                    system_prompt: "",
                    user_prompt: userPrompt + " " + SUGGETION_FORMAT
                });
            }

            const finalData = urlData.response ? urlData.response : "";

            if (urlData.status === STATUS_SUCCESS) {
                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: finalData,
                        message: "",
                    }
                };
            } else {
                // Send error response
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: (finalData && finalData.message)
                            ? finalData.message + "."
                            : res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getSuggetionCampaignName();

    /**
     * Function to upload image for AI-generated social post image
     * Uses async/await for all DB and file operations for better performance and clarity.
     */
    this.aiSocialUploadImage = async (req, res) => {
        let finalResponse = {};

        try {
            // Get user and request data
            let loginUserData = req.user_data || "";
            let userId = loginUserData._id || "";
            let campaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            let aiSocialImage = (req.files && req.files.ai_social_image) ? req.files.ai_social_image : "";
            let aiSocialImageFacebook = (req.files && req.files.ai_social_image_facebook) ? req.files.ai_social_image_facebook : "";

            let videoFileName = req.body.video_file_name || "";
            let videoFileNameFacebook = req.body.video_file_name_facebook || "";

            let socialType = req.body.type || AI_RESPONSE_TYPE_SOCIAL_MEDIA;

            // Parse post_on_instagram and post_on_facebook flags
            let postOnInstagram = req.body.post_on_instagram ? JSON.parse(req.body.post_on_instagram) : false;
            let postOnFacebook = req.body.post_on_facebook ? JSON.parse(req.body.post_on_facebook) : false;

            // If ai_campaign_chat_user_id is provided, override userId and get user data
            let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
            if (aiCampaignChatUserId != '') {
                const users = db.collection(TABLE_USERS);
                userId = aiCampaignChatUserId;
                loginUserData = await users.findOne({ _id: newObjectIdDefault(userId) });
                postOnInstagram = loginUserData.post_on_instagram || false;
                postOnFacebook = loginUserData.post_on_facebook || false;
            }

            // Validate required fields
            if (!userId || !campaignChatId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare MongoDB query condition
            let condition = {
                "_id": campaignChatId,
                "user_id": userId,
            };

            // Find campaign chat document using async/await
            const chatResult = await tableAiCampaignChat.findOne(condition);

            if (!chatResult) {
                // No record found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Extract content and image arrays
            let socialContent = chatResult.content || {};
            let socialTitle = socialContent.title || "";
            let imageArray = socialContent.image || [];
            let imageArrayFacebook = socialContent.facebook_image || [];

            // Handle video uploads (UGC Gallery)
            if (videoFileName !== '' || videoFileNameFacebook !== '') {
                // Process Instagram video
                if (videoFileName !== '') {
                    const randomNumber = Math.floor(10 + Math.random() * 90);
                    let fileExtension = path.extname(videoFileName).toLowerCase();
                    let updatedFilePath = "";

                    if (fileExtension === '.mp4') {
                        updatedFilePath = videoFileName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                    } else {
                        updatedFilePath = videoFileName.replace(/\.mov$/, `-${randomNumber}.mov`);
                    }

                    // Convert video for Instagram (async, but not awaited as original)
                    convertVideoToFFmpegForInstagram({
                        videoURL: UPLOAD_TO_S3 ? UGC_GALLERY_FILE_URL + videoFileName : UGC_GALLERY_FILE_PATH + videoFileName,
                        outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                        targetFolder: 'ai_social_images/' + updatedFilePath
                    });

                    fileExtension = fileExtension.replace(".", "");
                    imageArray.push({
                        _id: newObjectIdDefault(),
                        name: updatedFilePath,
                        extension: fileExtension,
                        post_on_instagram: postOnInstagram
                    });
                }

                // Process Facebook video
                if (videoFileNameFacebook !== "") {
                    const randomNumber = Math.floor(10 + Math.random() * 90);
                    let facebookFileExtension = path.extname(videoFileNameFacebook).toLowerCase();
                    let updatedFacebookFilePath = "";

                    if (facebookFileExtension === '.mp4') {
                        updatedFacebookFilePath = videoFileNameFacebook.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                    } else if (facebookFileExtension === '.mov') {
                        updatedFacebookFilePath = videoFileNameFacebook.replace(/\.mov$/, `-${randomNumber}.mov`);
                    }

                    // Convert video for Facebook (async, but not awaited as original)
                    convertVideoToFFmpegForFacebook({
                        videoURL: UPLOAD_TO_S3 ? UGC_GALLERY_FILE_URL + videoFileNameFacebook : UGC_GALLERY_FILE_PATH + videoFileNameFacebook,
                        outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFacebookFilePath,
                        targetFolder: 'ai_social_images/' + updatedFacebookFilePath
                    });

                    facebookFileExtension = facebookFileExtension.replace(".", "");
                    imageArrayFacebook.push({
                        _id: newObjectIdDefault(),
                        name: updatedFacebookFilePath,
                        extension: facebookFileExtension,
                        post_on_facebook: postOnFacebook
                    });
                }

                // Save updated image arrays to DB
                let saveImageOption = {
                    modified: getUtcDate(),
                    'content.image': imageArray,
                    'content.facebook_image': imageArrayFacebook
                };

                await tableAiCampaignChat.updateOne(condition, { $set: saveImageOption });

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        image_name: videoFileName,
                        full_image_url: AI_SOCIAL_IMAGES_URL + videoFileName,
                        message: res.__("front.content_library.ai_social_image_saved_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare upload options for Instagram and Facebook images
            let optionsAiSocial = {
                image: aiSocialImage,
                manually_mention_image_name: socialTitle,
                filePath: AI_SOCIAL_IMAGES_FILE_PATH,
                ai_social_image_submit: true,
                allowedExtensions: ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
                allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
                allowedMimeTypes: ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
                allowedMimeError: ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
                allowedSizeErrorMessage: ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
                size: MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
            };
            let optionsAiSocialFacebook = {
                image: aiSocialImageFacebook,
                ai_social_image_submit: true,
                filePath: AI_SOCIAL_IMAGES_FILE_PATH,
                allowedExtensions: ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
                allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
                allowedMimeTypes: ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
                allowedMimeError: ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
                allowedSizeErrorMessage: ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
                size: MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
            };

            // Upload both Instagram and Facebook images in parallel
            const [responseAiSocial, responseAiSocialFacebook] = await Promise.all([
                moveUploadedFile(req, res, optionsAiSocial),
                moveUploadedFile(req, res, optionsAiSocialFacebook),
            ]);

            let imageName = "";
            // Handle Instagram image upload response
            if (responseAiSocial && responseAiSocial.status === STATUS_SUCCESS) {
                imageName = responseAiSocial.fileName || "";
                let imageExtension = responseAiSocial.image_extension || "";

                if (imageName && imageExtension) {
                    if (imageExtension === 'mp4' || imageExtension === 'mov') {
                        // Convert video for Instagram
                        const randomNumber = Math.floor(10 + Math.random() * 90);
                        let updatedFilePath = "";

                        if (imageExtension === 'mp4') {
                            updatedFilePath = imageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                        } else if (imageExtension === 'mov') {
                            updatedFilePath = imageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                        }

                        convertVideoToFFmpegForInstagram({
                            videoURL: UPLOAD_TO_S3 ? AI_SOCIAL_IMAGES_URL + imageName : AI_SOCIAL_IMAGES_FILE_PATH + imageName,
                            outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                            targetFolder: 'ai_social_images/' + updatedFilePath
                        });

                        imageArray.push({
                            _id: newObjectIdDefault(),
                            name: updatedFilePath,
                            extension: imageExtension,
                            post_on_instagram: postOnInstagram
                        });
                    } else {
                        // Resize Instagram post image
                        let optiondata = {
                            image: aiSocialImage,
                            image_name: imageName,
                            type: socialType
                        };
                        await resizeImageForSocialPostImage(req, res, optiondata);
                        imageArray.push({
                            _id: newObjectIdDefault(),
                            name: imageName,
                            extension: imageExtension,
                            post_on_instagram: postOnInstagram
                        });
                    }
                }
            }

            // Handle Facebook image upload response
            if (responseAiSocialFacebook && responseAiSocialFacebook.status === STATUS_SUCCESS) {
                let facebookImageName = responseAiSocialFacebook.fileName || "";
                let facebookImageExtension = responseAiSocialFacebook.image_extension || "";

                if (facebookImageName && facebookImageExtension) {
                    if (facebookImageExtension === 'mp4' || facebookImageExtension === 'mov') {
                        // Convert video for Facebook
                        const randomNumber = Math.floor(10 + Math.random() * 90);
                        let updatedFacebookFilePath = "";

                        if (facebookImageExtension === 'mp4') {
                            updatedFacebookFilePath = facebookImageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                        } else if (facebookImageExtension === 'mov') {
                            updatedFacebookFilePath = facebookImageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                        }

                        await convertVideoToFFmpegForFacebook({
                            videoURL: UPLOAD_TO_S3 ? AI_SOCIAL_IMAGES_URL + facebookImageName : AI_SOCIAL_IMAGES_FILE_PATH + facebookImageName,
                            outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFacebookFilePath,
                            targetFolder: 'ai_social_images/' + updatedFacebookFilePath
                        });

                        imageArrayFacebook.push({
                            _id: newObjectIdDefault(),
                            name: updatedFacebookFilePath,
                            extension: facebookImageExtension,
                            post_on_facebook: postOnFacebook
                        });
                    } else {
                        // Resize Facebook post image
                        let optionFacebookdata = {
                            image: aiSocialImageFacebook,
                            image_name: facebookImageName,
                        };
                        await resizeImageForFacebookPostImage(req, res, optionFacebookdata);
                        imageArrayFacebook.push({
                            _id: newObjectIdDefault(),
                            name: facebookImageName,
                            extension: facebookImageExtension,
                            post_on_facebook: postOnFacebook
                        });
                    }
                }
            }

            // Save updated image arrays to DB
            let saveImageOption = {
                modified: getUtcDate(),
                'content.image': imageArray,
                'content.facebook_image': imageArrayFacebook,
            };

            await tableAiCampaignChat.updateOne(condition, { $set: saveImageOption });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    image_name: imageName,
                    full_image_url: AI_SOCIAL_IMAGES_URL + imageName,
                    message: res.__("front.content_library.ai_social_image_saved_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle unexpected errors
            console.error('Error processing image:', error.message);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.error_in_image_processing"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end aiSocialUploadImage();


    /**
     * Async function to check 'instagram_handle' presence in image array
     * and update 'content.instagram_handle' field accordingly.
     *
     * @param {Object} condition - MongoDB find condition (e.g., { _id: newObjectIdDefault(...) })
     */
    updateInstagramHandleBasedOnImages = async (condition) => {
        try {
            // Find the campaign chat document using async/await for faster and cleaner response
            const chatResult = await tableAiCampaignChat.findOne(condition);

            if (!chatResult) {
                console.error("Document not found for condition:", condition);
                return;
            }

            // Extract content and image array safely
            const socialContent = chatResult.content || {};
            const imageArray = socialContent.image || [];

            // Check if any image has instagram_handle === true
            const hasInstagramHandle = imageArray.some(img => img.instagram_handle === true);

            // If no such image exists and field is not already empty, then update it to blank
            if (!hasInstagramHandle && socialContent.instagram_handle) {
                // Update the document using async/await
                await tableAiCampaignChat.updateOne(
                    { _id: chatResult._id },
                    { $set: { "content.instagram_handle": "" } }
                );
                // console.log("Updated: instagram_handle field cleared successfully.");
            } else {
                // No update needed. instagram_handle already valid or images present.
                // console.log("No update needed for instagram_handle.");
            }
        } catch (error) {
            console.error("Error in updateInstagramHandleBasedOnImages:", error);
        }
    }

    /**
     * Function to delete banner image(s) for a campaign chat.
     * Uses async/await for all DB and file operations for better performance and clarity.
     * Handles parallel file deletions using Promise.all for faster response.
     * @returns json response
     */
    this.deleteSocialBannerImage = async (req, res) => {
        let finalResponse = {};

        // Extract user and request data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let campaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let imageId = req.body.image_id ? newObjectIdDefault(req.body.image_id) : "";
        let allImageDelete = req.body.all_image_delete ? req.body.all_image_delete : false;
        let type = req.body.type ? req.body.type : AI_RESPONSE_TYPE_SOCIAL_MEDIA;
        let igFbType = req.body.ig_fb_type ? req.body.ig_fb_type : FACEBOOK_TYPE;

        // Handle group user override
        let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
        if (aiCampaignChatUserId != '') {
            userId = aiCampaignChatUserId;
        }

        // Validate required fields
        if (!userId || !campaignChatId || (!allImageDelete && !imageId)) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare MongoDB query condition
        let condition = {
            _id: campaignChatId,
            user_id: userId,
            type: type,
        };

        try {
            // Find campaign chat document using async/await for faster response
            const chatResult = await tableAiCampaignChat.findOne(condition);

            if (!chatResult) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Extract content and image arrays safely
            let socialContent = chatResult.content || {};
            let image = Array.isArray(socialContent.image) ? socialContent.image : [];
            let instagramHandle = socialContent.instagram_handle || "";
            let facebookImage = Array.isArray(socialContent.facebook_image) ? socialContent.facebook_image : [];

            // Determine which image array to update
            let updateKeyData = 'content.image';
            let imagesToDelete = image;
            if (igFbType == FACEBOOK_TYPE) {
                updateKeyData = 'content.facebook_image';
                imagesToDelete = facebookImage;
            }

            if (allImageDelete) {
                // Delete all images in parallel using Promise.all for faster response
                if (imagesToDelete.length > 0) {
                    await Promise.all(
                        imagesToDelete.map(async ({ name }) => {
                            if (name) {
                                await removeFile({ file_path: AI_SOCIAL_IMAGES_FILE_PATH + name });
                            }
                        })
                    );
                }

                // Update the campaign chat document to clear the image array using async/await
                await tableAiCampaignChat.updateOne(condition, { $set: { [updateKeyData]: [] } });

                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.image_delete_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Delete a single image by imageId
                let deletedDetails = {};
                let updatedImages = imagesToDelete;

                if (imagesToDelete.length > 0) {
                    deletedDetails = imagesToDelete.find(item => JSON.stringify(item._id) === JSON.stringify(imageId)) || {};
                    updatedImages = imagesToDelete.filter(item => JSON.stringify(item._id) !== JSON.stringify(imageId));
                }

                // Remove the file if it exists (async/await)
                if (deletedDetails && deletedDetails.name) {
                    await removeFile({ file_path: AI_SOCIAL_IMAGES_FILE_PATH + deletedDetails.name });
                }

                // Update the campaign chat document with the new image array using async/await
                await tableAiCampaignChat.updateOne(condition, { $set: { [updateKeyData]: updatedImages } });

                // If instagram_handle is set, check if it needs to be cleared (background, non-blocking)
                if (instagramHandle != '') {
                    // Run in background, non-blocking, using async/await
                    setImmediate(async () => {
                        try {
                            await updateInstagramHandleBasedOnImages(condition);
                        } catch (err) {
                            console.error("Error updating instagram_handle after image delete:", err);
                        }
                    });
                }

                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.image_delete_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle unexpected errors and send error response
            console.error("Error in deleteSocialBannerImage:", error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end deleteSocialBannerImage();

    /**
     * Function to edit campaign manually using async/await for faster and cleaner response.
     * All DB operations use async/await. Any parallel updates are handled with Promise.all.
     * @returns json response
     */
    this.editMannualyCampaign = async (req, res) => {
        let finalResponse = {};

        try {
            // Get user and request data
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
            let type = req.body.type ? req.body.type : "";
            let campaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
            let content = req.body.content ? req.body.content : "";

            // If ai_campaign_chat_user_id is provided, override userId
            let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
            if (aiCampaignChatUserId != '') {
                userId = aiCampaignChatUserId;
            }

            // Validate required fields
            if (!userId || !campaignChatId || !type || !content) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare update condition for AI campaign chat
            let conditionSocial = {
                _id: campaignChatId,
                user_id: userId,
                type: type
            };

            // Update campaign chat content using async/await
            const updateResult = await tableAiCampaignChat.updateOne(
                conditionSocial,
                { $set: { content: content, is_edited_manually: true, updated: getUtcDate() } }
            );

            if (updateResult && updateResult.modifiedCount > 0) {
                // If type is social media, update scheduled post titles in parallel
                if (type == AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                    // Run update in background, non-blocking
                    setImmediate(async () => {
                        try {
                            await calendarSchedulePost.updateMany(
                                { ai_campaign_chat_id: campaignChatId, user_id: userId },
                                { $set: { title_name: content.title } }
                            );
                        } catch (err) {
                            console.error("Error updating scheduled post titles after manual edit:", err);
                        }
                    });
                }

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.content_has_been_updated_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Send error response if update failed
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle unexpected errors
            console.error("Error in editMannualyCampaign:", error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end editMannualyCampaign();

    /**
     * Function to get generated campaign list using async/await for faster and cleaner response.
     * Runs DB queries in parallel using Promise.all for efficiency.
     * @returns json response
     */
    this.getGeneratedCampaignList = async (req, res) => {
        let finalResponse = {};

        // Get user data and userId
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        const type = req.body.type ? req.body.type : "";

        // Pagination setup
        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = 4;
        const skip = (limit * page) - limit;

        // Validate required fields
        if (!userId || !type) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare MongoDB query condition
        const condition = {
            user_id: userId,
            type: type,
            is_deleted: NOT_DELETED
        };

        try {
            // Run both queries in parallel for efficiency
            const [campaignChatList, totalRecords] = await Promise.all([
                // Get campaign chat list with pagination and projection
                tableAiCampaignChat.find(
                    condition,
                    { projection: { _id: 1, content: 1, type: 1, created: 1 } }
                ).skip(skip).limit(limit).toArray(),
                // Count total records
                tableAiCampaignChat.countDocuments(condition)
            ]);

            // Prepare and send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: campaignChatList || [],
                    recordsTotal: totalRecords || 0,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil((totalRecords || 0) / limit),
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors and send error response
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
    }; // end getGeneratedCampaignList();

    /**
     * Function to allow users to toggle public access for their calendar.
     * Uses async/await for database operations for cleaner and faster response.
     */
    this.publicAccessCalendarToggle = async (req, res) => {
        let finalResponse = {};
        // Get user data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let statusData = req.body.toggle_status ? req.body.toggle_status : PUBLICALLY_ACCESS_CALENDAR_OFF;

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

        try {
            // Update user's calendar access status using async/await
            await users.updateOne(
                { _id: newObjectIdDefault(userId) },
                { $set: { calendar_access: statusData } }
            );

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: (statusData == PUBLICALLY_ACCESS_CALENDAR_OFF)
                        ? res.__("front.content_library.calendar_publically_access_denied")
                        : res.__("front.content_library.calendar_publically_access_successfully"),
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
    }; // end publicAccessCalendarToggle();

    /**
     * Function to update social post draft status.
     * Uses async/await for database operations for cleaner and faster response.
     */
    this.saveSocialPost = async (req, res) => {
        let finalResponse = {};

        // Get user data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";
        let createPostGroupKey = req.body.create_post_group_key ? req.body.create_post_group_key : "";
        let campaignType = req.body.campaign_type ? req.body.campaign_type : AI_RESPONSE_TYPE_SOCIAL_MEDIA;

        let isDraft = req.body.is_draft ? req.body.is_draft : "";
        isDraft = (isDraft == CAMPAIGN_DRAFT) ? CAMPAIGN_NOT_DRAFT : CAMPAIGN_DRAFT;

        // Validate required fields
        if (!userId || !isDraft) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare update filter
        let saveOptions = {
            user_id: newObjectIdDefault(userId),
            type: campaignType
        };
        if (aiCampaignChatId) {
            saveOptions['_id'] = aiCampaignChatId;
        }
        if (createPostGroupKey) {
            saveOptions['create_post_group_key'] = createPostGroupKey;
        }

        try {
            // Update AI Campaign social post chat using async/await
            await tableAiCampaignChat.updateMany(saveOptions, { $set: { is_draft: isDraft } });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: aiCampaignChatId ? res.__("front.content_library.social_post_saved_successfully") : res.__("front.content_library.all_social_post_saved_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveSocialPost();

    /**
     * Function to schedule a calendar post in the content library.
     * Uses async/await for all DB operations and runs parallel queries with Promise.all where possible for faster response.
     */
    this.saveCalendarSchedulePost = async (req, res) => {
        let finalResponse = {};

        // Sanitize request body to prevent XSS
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

        // Extract user and request data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";

        let scheduleDate = req.body.schedule_date ? req.body.schedule_date : "";
        let uniqueKey = req.body.unique_key ? req.body.unique_key : "";
        let campaignType = req.body.campaign_type ? req.body.campaign_type : { $nin: ['', null] };
        let currentTimezone = req.body.default_timezone ? req.body.default_timezone : "";

        let facebookPageAccessToken = loginUserData.facebook_page_access_token ? loginUserData.facebook_page_access_token : "";
        let facebookPageId = loginUserData.facebook_page_id ? loginUserData.facebook_page_id : "";

        // Instagram/Facebook enable flags
        let instagramEnable = req.body.instagram_enable ? JSON.parse(req.body.instagram_enable) : false;
        let facebookEnable = req.body.facebook_enable ? JSON.parse(req.body.facebook_enable) : false;

        // Handle group user override
        let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
        if (aiCampaignChatUserId != '') {
            userId = aiCampaignChatUserId;
            facebookPageAccessToken = req.body.facebook_page_access_token ? req.body.facebook_page_access_token : "";
            facebookPageId = req.body.facebook_page_id ? req.body.facebook_page_id : "";
        }

        // Validate required fields
        if (!userId || !scheduleDate || !uniqueKey) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page")
                },
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Convert schedule and current date to timezone-aware format
            let scheduleDateTime = scheduleDate ? newDateTimeZone(scheduleDate, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone) : "";
            let currentDateTime = newDateTimeZone(new Date(), NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone);

            // Check if schedule date is in the past
            if (currentDateTime > scheduleDateTime) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.calender_schedule.schedule_date_must_greater_then_current_date")
                    },
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Find the campaign chat document for this schedule
            const resultChatData = await tableAiCampaignChat.findOne({
                user_id: userId,
                unique_key: uniqueKey,
                type: campaignType,
            });

            if (!resultChatData) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("api.global.no_record_found")
                    },
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare data for scheduling
            const contentData = resultChatData.content || "";
            const aiCampaignChatId = resultChatData._id ? newObjectIdDefault(resultChatData._id) : "";
            const aiCampaignParentId = resultChatData.ai_campaign_parent_id ? newObjectIdDefault(resultChatData.ai_campaign_parent_id) : "";
            const type = resultChatData.type || "";

            const emailHeading = contentData.email_heading || "";
            const seoTitle = contentData.title || "";
            const socialMediaTitle = (contentData.captions && contentData.captions.title) ? contentData.captions.title : "testing";
            const titleName = emailHeading || seoTitle || socialMediaTitle;

            // Prepare schedule insert options
            let scheduleInsertOptions = {
                title_name: titleName,
                schedule_date: scheduleDate,
                user_id: newObjectIdDefault(userId),
                unique_key: uniqueKey,
                ai_campaign_parent_id: aiCampaignParentId,
                ai_campaign_chat_id: aiCampaignChatId,
                type: type,
                instagram_enable: instagramEnable,
                facebook_enable: facebookEnable,
                facebook_page_access_token: facebookPageAccessToken,
                facebook_page_id: facebookPageId,
            };

            // Run DB updates in parallel for better performance
            await Promise.all([
                // Delete any previous schedules for this post (reschedule)
                calendarSchedulePost.deleteMany({
                    ai_campaign_chat_id: aiCampaignChatId,
                    ai_campaign_parent_id: aiCampaignParentId
                }),
                // Update campaign chat flags to mark as scheduled and not draft
                tableAiCampaignChat.updateOne(
                    { _id: newObjectIdDefault(aiCampaignChatId) },
                    { $set: { is_draft: CAMPAIGN_NOT_DRAFT, is_scheduled: true } }
                )
            ]);

            // Insert the new schedule record
            await schedulePostInsertData(req, res, scheduleInsertOptions);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: {},
                    message: res.__("front.content_library.schedule_has_been_saved_successfully")
                },
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("api.global.error_occurred")
                },
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveCalendarSchedulePost();

    /**
     * Function to get schedule list for user according to the given parameters.
     * Uses async/await for all DB operations and runs queries in parallel where possible for faster response.
     * @returns Json
     */
    this.getCalendarSchedulePostListing = async (req, res) => {
        let userSlug = req.body.user_slug || "";
        let scheduleDate = req.body.schedule_date || "";
        let currentTimezone = req.body.default_timezone || "";
        let uniqueKey = req.body.unique_key || "";
        let currentTimezoneAbbreviation = req.body.default_timezone_abbreviation || "";
        let campaignType = req.body.campaign_type || AI_RESPONSE_TYPE_SOCIAL_MEDIA;
        let socialTitle = "";

        let fromDate = scheduleDate + '-01T00:00:00Z';
        let toDate = scheduleDate + '-31T23:59:59Z';

        // Get login user data
        let loginUserData = req.user_data || "";
        let loginUserSlug = loginUserData.slug || "";

        let finalResponse = {};

        if (userSlug === '' || scheduleDate === '') {
            // Send error message if required fields are missing
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    current_timezone: currentTimezone,
                    current_timezone_abbreviation: currentTimezoneAbbreviation,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Prepare user detail query
            let otherUserCondition = { slug: userSlug };
            let otherUserOptions = { conditions: otherUserCondition };

            // Get public user detail using async/await
            const userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

            if (userResponse.status === STATUS_ERROR) {
                // Send error response if user not found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        current_timezone: currentTimezone,
                        current_timezone_abbreviation: currentTimezoneAbbreviation,
                        user_id: "",
                        calender_page_access: true,
                        errors: {},
                        message: res.__("api.global.no_record_found")
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Extract user data
            let userResultData = (userResponse && userResponse.result) ? userResponse.result : {};
            let userId = userResultData._id || "";
            let calenderToggleStatus = userResultData.calendar_access || PUBLICALLY_ACCESS_CALENDAR_OFF;
            let nameOfTheBusiness = (userResultData.public_business_informaton && userResultData.public_business_informaton.name_of_the_business) ? userResultData.public_business_informaton.name_of_the_business : "";
            let selectedDate = "";
            let instagramEnable = false;
            let facebookEnable = false;

            // If uniqueKey is provided, fetch social details and schedule details in parallel
            let socialDetailsforUniqueKey = null;
            let scheduleDetails = null;
            if (uniqueKey !== '') {
                // Run both queries in parallel for efficiency
                [socialDetailsforUniqueKey, scheduleDetails] = await Promise.all([
                    tableAiCampaignChat.findOne({
                        user_id: newObjectIdDefault(userId),
                        type: campaignType,
                        unique_key: uniqueKey
                    }),
                    calendarSchedulePost.findOne({
                        schedule_date: { $gte: new Date() },
                        type: campaignType,
                        user_id: newObjectIdDefault(userId),
                        unique_key: uniqueKey
                    })
                ]);

                // Set socialTitle based on campaign type
                if (campaignType === AI_RESPONSE_TYPE_SOCIAL_MEDIA || campaignType === AI_RESPONSE_TYPE_SOCIAL_STORY) {
                    socialTitle = (socialDetailsforUniqueKey && socialDetailsforUniqueKey.content && socialDetailsforUniqueKey.content.title) ? socialDetailsforUniqueKey.content.title : "";
                }
                if (campaignType === AI_RESPONSE_TYPE_EMAIL) {
                    socialTitle = (socialDetailsforUniqueKey && socialDetailsforUniqueKey.content && socialDetailsforUniqueKey.content.email_heading) ? socialDetailsforUniqueKey.content.email_heading : "";
                }

                // Set selectedDate and enable flags if scheduleDetails found
                if (scheduleDetails != null) {
                    let utcScheduleDate = scheduleDetails.schedule_date;
                    instagramEnable = scheduleDetails.instagram_enable;
                    facebookEnable = scheduleDetails.facebook_enable;
                    selectedDate = newDateTimeZone(utcScheduleDate, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone);
                }
            }

            // Determine calendar page access
            let calenderPageAccess = (calenderToggleStatus === PUBLICALLY_ACCESS_CALENDAR_ON) ? true : false;
            if (loginUserSlug === userSlug) {
                calenderPageAccess = true;
            }

            // Find schedule data for the user for the given date range
            const scheduleDataList = await calendarSchedulePost.find({
                schedule_date: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate)
                },
                user_id: userId,
                delayed_post: { $exists: false }
            }).sort({ schedule_date: SORT_ASC }).toArray();

            if (scheduleDataList && scheduleDataList.length > 0) {
                // Prepare to fetch all chat details in parallel for each schedule record
                const chatDetailsPromises = scheduleDataList.map(record =>
                    tableAiCampaignChat.findOne({
                        user_id: newObjectIdDefault(userId),
                        _id: record.ai_campaign_chat_id
                    })
                );
                // Run all chat detail queries in parallel
                const chatDetailsArr = await Promise.all(chatDetailsPromises);

                const groupedScheduleData = {};
                const currentDate = new Date(); // Current Date & Time

                for (let index = 0; index < scheduleDataList.length; index++) {
                    const record = scheduleDataList[index];
                    const chatdetails = chatDetailsArr[index];

                    let scheduleTitle = record.title_name || "";

                    // Set is_image and title_name based on chatdetails
                    scheduleDataList[index]['is_image'] = (chatdetails && chatdetails.content && chatdetails.content.image && chatdetails.content.image.length > 0) ? true : false;
                    scheduleDataList[index]['title_name'] = (chatdetails && chatdetails.content && chatdetails.content.title) ? chatdetails.content.title : scheduleTitle;

                    let utcDate = record.schedule_date;
                    let PSTScheduledTime = newDateTimeZone(utcDate, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone);

                    scheduleDataList[index]['expired'] = (currentDate > utcDate) ? true : false;
                    scheduleDataList[index]['schedule_date'] = PSTScheduledTime;

                    // Group by formatted date for mobile
                    const formattedDate = newDateTimeZone(utcDate, 'dddd D, MMMM YYYY', currentTimezone);
                    if (!groupedScheduleData[formattedDate]) {
                        groupedScheduleData[formattedDate] = {
                            title: formattedDate,
                            value: []
                        };
                    }
                    groupedScheduleData[formattedDate].value.push({
                        title: scheduleDataList[index]['title_name'],
                        start: scheduleDataList[index]['schedule_date'],
                        is_image: scheduleDataList[index]['is_image'],
                        instagram_enable: scheduleDataList[index]['instagram_enable'] || false,
                        facebook_enable: scheduleDataList[index]['facebook_enable'] || false,
                        ai_campaign_parent_id: record['ai_campaign_parent_id'],
                        ai_campaign_chat_id: record['ai_campaign_chat_id'],
                        schedule_id: record['_id'],
                        type: record['type'],
                        expired: (currentDate > utcDate) ? true : false,
                        color: getColorBasedOnType(record['type']),
                    });
                }
                // Convert the grouped object to an array
                const groupedScheduleArray = Object.values(groupedScheduleData);

                // Get timezone info using moment-timezone
                const momentTimeZone = require('moment-timezone');
                const utcTime = momentTimeZone.utc(); // current time in UTC
                const timezoneAccordingConsole = utcTime.tz(currentTimezone).format('YYYY-MM-DD HH:mm:ss');

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        user_id: userId,
                        social_title: socialTitle,
                        selected_schedule_Date: selectedDate,
                        instagram_enable: instagramEnable,
                        facebook_enable: facebookEnable,
                        current_timezone: currentTimezone,
                        current_timezone_abbreviation: currentTimezoneAbbreviation,
                        timezoneAccordingConsole: timezoneAccordingConsole,
                        business_name: nameOfTheBusiness,
                        calender_page_access: calenderPageAccess, // this page flag
                        calendar_access: calenderToggleStatus, // only for toggle 
                        same_user_access_page: (loginUserSlug === userSlug), // login user or url user same page hit
                        result: scheduleDataList,
                        result_mobile: groupedScheduleArray,
                        message: ""
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Send error message if no records found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        user_id: userId,
                        social_title: socialTitle,
                        selected_schedule_Date: selectedDate,
                        instagram_enable: instagramEnable,
                        facebook_enable: facebookEnable,
                        current_timezone: currentTimezone,
                        current_timezone_abbreviation: currentTimezoneAbbreviation,
                        business_name: nameOfTheBusiness,
                        calender_page_access: calenderPageAccess, // this page flag
                        calendar_access: calenderToggleStatus, // only for toggle
                        same_user_access_page: (loginUserSlug === userSlug), // login user or url user same page hit
                        result: [],
                        message: res.__("api.global.no_record_found")
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("api.global.error_occurred")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getCalendarSchedulePostListing();

    /**
     * Function for used to group count 0 after no record so this funciton for used to 0 return for blank case
     * Ensure that all counts are returned, even if they are 0
     */
    getScheduledCounts = (scheduledResponseCount) => {
        return {
            'reward': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].reward : 0,
            'poll': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].poll : 0,
            'seo_blog': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].seo_blog : 0,
            'social_media': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].social_media : 0,
            'social_story': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].social_story : 0,
            'email': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].email : 0,
            'total_count': scheduledResponseCount.length > 0 ? scheduledResponseCount[0].total_count : 0
        };
    }// end getScheduledCounts();

    /**
     * Function to get content calendar count using async/await and Promise.all for parallel queries.
     * @returns 
     */
    this.contentCalendarDropdownCount = async (req, res) => {
        let userSlug = req.body.user_slug ? req.body.user_slug : "";
        let finalResponse = {};

        if (userSlug === '') {
            // Send error message if user_slug is missing
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
            // Get user details by slug
            let otherUserOptions = { conditions: { slug: userSlug } };
            let userResponse = await getUserDetailBySlug(req, res, otherUserOptions);

            if (userResponse.status === STATUS_ERROR) {
                // Send error response if user not found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        errors: {},
                        message: res.__("front.system.something_going_wrong_please_try_again")
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let userId = userResponse.result._id ? userResponse.result._id : "";

            // Prepare query options for each content type (show all content)
            let optionsContentCreated = {
                user_id: userId,
                is_deleted: NOT_DELETED,
                is_draft: CAMPAIGN_NOT_DRAFT,
                type: { $nin: ['', null, AI_RESPONSE_TYPE_REWARD] },
                signup_flag: { $ne: true },
                delayed_post: { $exists: false }
            };

            // Get scheduled (not passed) campaign IDs (content applied to the calendar but the date has not passed)
            let notPassedCampaignChatId = await scheduleNotPassedIds(req, res, userId);
            let optionsContentScheduled = {
                user_id: userId,
                is_deleted: NOT_DELETED,
                is_draft: CAMPAIGN_NOT_DRAFT,
                type: { $nin: ['', null, AI_RESPONSE_TYPE_REWARD] },
                _id: { $in: notPassedCampaignChatId },
                is_scheduled: true,
                signup_flag: { $ne: true },
                delayed_post: { $exists: false }
            };

            // Get used campaign IDs (content that has been downloaded or scheduled or direct published to post and the scheduled date has passed)
            let typeDate = { $nin: ['', null, AI_RESPONSE_TYPE_REWARD] };
            let usedIds = await usedRecordsIds(req, res, userId, typeDate);
            let optionsUsedCreated = {
                _id: { $in: usedIds }
            };

            // Prepare available content options (content created but not downloaded or scheduled)
            let optionsAvailableCreated = {
                $and: [
                    { _id: { $nin: usedIds } },
                    { user_id: userId },
                    { type: { $nin: ['', null, AI_RESPONSE_TYPE_REWARD] } },
                    { is_deleted: NOT_DELETED },
                    { is_draft: CAMPAIGN_NOT_DRAFT },
                    { signup_flag: { $ne: true } },
                    { delayed_post: { $exists: false } }
                ]
            };

            // Prepare draft content options
            let optionsDraftCreated = {
                user_id: userId,
                is_deleted: NOT_DELETED,
                type: { $nin: ['', null] },
                is_draft: CAMPAIGN_DRAFT,
                signup_flag: { $ne: true }
            };

            // Helper function to build aggregation pipeline
            const buildAggregatePipeline = (matchOptions) => [
                { $match: matchOptions },
                {
                    $group: {
                        _id: null,
                        total_count: {
                            $sum: {
                                $cond: [{ $and: [] }, 1, 0]
                            }
                        },
                        reward: {
                            $sum: {
                                $cond: [{ $and: [{ $eq: ["$type", AI_RESPONSE_TYPE_REWARD] }] }, 1, 0]
                            }
                        },
                        poll: {
                            $sum: {
                                $cond: [{ $and: [{ $eq: ["$type", AI_RESPONSE_TYPE_POLL] }] }, 1, 0]
                            }
                        },
                        seo_blog: {
                            $sum: {
                                $cond: [{ $and: [{ $eq: ["$type", AI_RESPONSE_TYPE_SEO] }] }, 1, 0]
                            }
                        },
                        social_media: {
                            $sum: {
                                $cond: [{ $and: [{ $eq: ["$type", AI_RESPONSE_TYPE_SOCIAL_MEDIA] }] }, 1, 0]
                            }
                        },
                        email: {
                            $sum: {
                                $cond: [{ $and: [{ $eq: ["$type", AI_RESPONSE_TYPE_EMAIL] }] }, 1, 0]
                            }
                        },
                        social_story: {
                            $sum: {
                                $cond: [{ $and: [{ $eq: ["$type", AI_RESPONSE_TYPE_SOCIAL_STORY] }] }, 1, 0]
                            }
                        }
                    }
                }
            ];

            // Run all aggregation queries in parallel using Promise.all
            const [
                contentCreatedCountRaw,
                contentScheduledCountRaw,
                contentUsedCountRaw,
                contentAvailableCountRaw,
                contentDraftCountRaw
            ] = await Promise.all([
                tableAiCampaignChat.aggregate(buildAggregatePipeline(optionsContentCreated)).toArray(),
                tableAiCampaignChat.aggregate(buildAggregatePipeline(optionsContentScheduled)).toArray(),
                tableAiCampaignChat.aggregate(buildAggregatePipeline(optionsUsedCreated)).toArray(),
                tableAiCampaignChat.aggregate(buildAggregatePipeline(optionsAvailableCreated)).toArray(),
                tableAiCampaignChat.aggregate(buildAggregatePipeline(optionsDraftCreated)).toArray()
            ]);

            // Ensure all counts are returned, even if they are 0
            const contentCreatedCount = getScheduledCounts(contentCreatedCountRaw);
            const contentScheduledCount = getScheduledCounts(contentScheduledCountRaw);
            const contentUsedCount = getScheduledCounts(contentUsedCountRaw);
            const contentAvailableCount = getScheduledCounts(contentAvailableCountRaw);
            const contentDraftCount = getScheduledCounts(contentDraftCountRaw);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    content_created_result: contentCreatedCount,
                    content_scheduled_count: contentScheduledCount,
                    content_used_count: contentUsedCount,
                    content_available_count: contentAvailableCount,
                    content_draft_count: contentDraftCount,
                    message: ""
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end contentCalendarDropdownCount();

    /**
     * Function to fetch slider data content for various conditions (Supporting content)
     * Uses async/await and Promise.all for parallel queries.
     */
    this.getSliderCampaignContentData = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request parameters
            const loginUserData = req.user_data || "";
            const userId = loginUserData._id || "";
            const uniqueKey = req.body.unique_key || "";
            const filterType = req.body.filter_type || "";
            const campaignType = req.body.campaign_type || "";
            const createPostGroupKey = req.body.create_post_group_key || "";
            const currentTimezone = req.body.default_timezone || "";
            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT + 2;
            const customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";
            const skip = (limit * page) - limit;

            const campaignLibrary = "campaign_library";
            const contentLibrary = "content_library";
            const socialBeforeSavedLogs = "social_logs";

            if (!userId || !filterType) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare campaign parent id if uniqueKey is provided
            let campaignParentId = "";
            if (uniqueKey !== '') {
                const chatdetails = await tableAiCampaignChat.findOne({
                    user_id: newObjectIdDefault(userId),
                    unique_key: uniqueKey
                });
                campaignParentId = (chatdetails && chatdetails.ai_campaign_parent_id)
                    ? newObjectIdDefault(chatdetails.ai_campaign_parent_id)
                    : "";
            }

            // Build the common query condition based on filterType
            let commonCondition = {
                ai_campaign_parent_id: campaignParentId,
                is_deleted: NOT_DELETED,
                user_id: newObjectIdDefault(userId),
                type: { $nin: ["", null] },
                signup_flag: { $ne: true }
            };

            if (filterType === campaignLibrary) {
                // No change needed
            }

            if (filterType === contentLibrary) {
                delete commonCondition['ai_campaign_parent_id'];
                commonCondition.type = campaignType;
                commonCondition.is_draft = CAMPAIGN_NOT_DRAFT;
            }

            if (filterType === socialBeforeSavedLogs) {
                delete commonCondition['ai_campaign_parent_id'];
                commonCondition.is_draft = CAMPAIGN_DRAFT;
                commonCondition.type = AI_RESPONSE_TYPE_SOCIAL_MEDIA;
                commonCondition.create_post_group_key = createPostGroupKey;
            }

            if (filterType === CALENDAR_CONTENT_CREATED) {
                commonCondition = {
                    user_id: userId,
                    type: campaignType,
                    is_deleted: NOT_DELETED,
                    is_draft: CAMPAIGN_NOT_DRAFT,
                    signup_flag: { $ne: true }
                };
            }

            if (filterType === CALENDAR_CONTENT_SCHEDULED) {
                const notPassedCampaignChatId = await scheduleNotPassedIds(req, res, userId);
                commonCondition = {
                    user_id: userId,
                    is_deleted: NOT_DELETED,
                    type: campaignType,
                    is_draft: CAMPAIGN_NOT_DRAFT,
                    _id: { $in: notPassedCampaignChatId },
                    is_scheduled: true,
                    signup_flag: { $ne: true }
                };
            }

            if (filterType === CALENDAR_CONTENT_USED) {
                const usedIds = await usedRecordsIds(req, res, userId, campaignType);
                commonCondition = {
                    _id: { $in: usedIds }
                };
            }

            if (filterType === CALENDAR_CONTENT_AVAILABLE) {
                const usedIds = await usedRecordsIds(req, res, userId, campaignType);
                commonCondition = {
                    $and: [
                        { _id: { $nin: usedIds } },
                        { user_id: userId },
                        { is_deleted: NOT_DELETED },
                        { is_draft: CAMPAIGN_NOT_DRAFT },
                        { type: campaignType },
                        { signup_flag: { $ne: true } }
                    ]
                };
            }

            if (filterType === CALENDAR_CONTENT_DRAFT) {
                commonCondition = {
                    user_id: userId,
                    is_deleted: NOT_DELETED,
                    type: campaignType,
                    is_draft: CAMPAIGN_DRAFT,
                    signup_flag: { $ne: true }
                };
            }

            // Exclude delayed posts
            commonCondition.delayed_post = { $exists: false };

            // Prepare aggregation pipeline for listing
            const listingPipeline = [
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
                                            { $gte: ["$schedule_date", new Date()] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "scheduleDetails"
                    }
                },
                {
                    $addFields: {
                        schedule_date: {
                            $cond: [
                                { $arrayElemAt: ["$scheduleDetails.schedule_date", 0] },
                                { $arrayElemAt: ["$scheduleDetails.schedule_date", 0] },
                                ""
                            ]
                        },
                        schedule_id: {
                            $cond: [
                                { $arrayElemAt: ["$scheduleDetails._id", 0] },
                                { $arrayElemAt: ["$scheduleDetails._id", 0] },
                                ""
                            ]
                        },
                        scheduleDetails: 0,
                        view_supporting_count: {
                            $sum: [
                                { $cond: [{ $eq: ["$is_email_create", true] }, 1, 0] },
                                { $cond: [{ $eq: ["$is_poll_create", true] }, 1, 0] },
                                { $cond: [{ $eq: ["$is_seo_blog_create", true] }, 1, 0] }
                            ]
                        }
                    }
                },
                { $sort: { created: SORT_DESC } },
                { $skip: skip },
                { $limit: limit }
            ];

            // Prepare projection for campaign name
            const campaignNameProjection = {
                _id: 1,
                created: 1,
                ai_campaign_name: { $cond: ["$ai_campaign_created_name", "$ai_campaign_created_name", ""] }
            };

            // Run all queries in parallel for faster response
            const [listingData, totalRecords, campaignDetails] = await Promise.all([
                // Listing aggregation
                (async () => {
                    const result = await tableAiCampaignChat.aggregate(listingPipeline).toArray();
                    // Convert schedule_date to user's timezone
                    await Promise.all(result.map(async (record, index) => {
                        const utcDate = record.schedule_date;
                        const PSTScheduledTime = utcDate
                            ? newDateTimeZone(utcDate, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone)
                            : "";
                        result[index].schedule_date = PSTScheduledTime;
                    }));
                    return result;
                })(),
                // Total records count
                tableAiCampaignChat.countDocuments(commonCondition),
                // Parent campaign details
                campaignParentId
                    ? tableAiCampaignName.findOne(
                        { _id: campaignParentId, user_id: newObjectIdDefault(userId) },
                        { projection: campaignNameProjection }
                    )
                    : {}
            ]);

            // Background processing - non-blocking, does not affect response time
            setImmediate(async () => {
                try {
                    if (campaignType === AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                        const socialPosts = await fetchUserSocialPostSummary(req, res, userId);
                        await saveCustomerBucketItems({
                            user_id: userId,
                            bucket_name: DATA_BUCKET_SOCIAL_POSTS,
                            parent_bucket: PARENT_BUCKET_SOCIAL_POSTS,
                            data: socialPosts
                        });
                    }
                    if (campaignType === AI_RESPONSE_TYPE_POLL) {
                        const pollData = await fetchUserPollSummary(req, res, userId);
                        await saveCustomerBucketItems({
                            user_id: userId,
                            bucket_name: DATA_BUCKET_POLL,
                            parent_bucket: PARENT_BUCKET_POLL,
                            data: pollData
                        });
                    }
                    if (campaignType === AI_RESPONSE_TYPE_EMAIL) {
                        const emailData = await fetchUserEmailSummary(req, res, userId);
                        await saveCustomerBucketItems({
                            user_id: userId,
                            bucket_name: DATA_BUCKET_EMAIL,
                            parent_bucket: PARENT_BUCKET_EMAIL,
                            data: emailData
                        });
                    }
                } catch (e) {
                    console.error("Background processing error:", e);
                }
            });

            // Send response
            if (listingData && listingData.length > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        user_image: USERS_URL,
                        template_image_url: EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                        ai_social_image: AI_SOCIAL_IMAGES_URL,
                        ai_email_image: AI_EMAIL_IMAGES_URL,
                        campaign_details: campaignDetails || {},
                        result: listingData,
                        recordsTotal: totalRecords,
                        limit: limit,
                        page: page,
                        total_page: Math.ceil(totalRecords / limit),
                        message: ""
                    }
                };
            } else {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        user_image: USERS_URL,
                        template_image_url: EMAIL_NEWSLETTER_TEMPLATE_FILE_URL,
                        ai_social_image: AI_SOCIAL_IMAGES_URL,
                        ai_email_image: AI_EMAIL_IMAGES_URL,
                        campaign_details: campaignDetails || {},
                        result: [],
                        recordsTotal: 0,
                        limit: 0,
                        page: 0,
                        total_page: 0,
                        message: res.__("front.global.no_record_found")
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getSliderCampaignContentData();

    /**
     * Function to get campaign chat details for a unique key.
     * Uses async/await for faster and cleaner response.
     */
    this.campaignChatDetailsForUniqueKeyAccording = async (req, res) => {
        let finalResponse = {};

        // Extract user and unique key from request
        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const uniqueKey = req.body.unique_key || "";

        // Validate required parameters
        if (!userId || !uniqueKey) {
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
            // Aggregate campaign chat details with parent campaign info
            const result = await tableAiCampaignChat.aggregate([
                {
                    $match: {
                        user_id: userId,
                        unique_key: uniqueKey
                    }
                },
                {
                    $lookup: {
                        from: TABLE_AI_CAMPAIGN_NAME,
                        let: { aiCampaignParentId: "$ai_campaign_parent_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$_id", "$$aiCampaignParentId"] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "parentDataDetails"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        type: 1,
                        content: 1,
                        campaign_chat_parent_id: { $arrayElemAt: ["$parentDataDetails._id", 0] },
                        parent_campaign_created: { $arrayElemAt: ["$parentDataDetails.created", 0] },
                        parent_campaign_name: {
                            $cond: [
                                { $arrayElemAt: ["$parentDataDetails.ai_campaign_created_name", 0] },
                                { $arrayElemAt: ["$parentDataDetails.ai_campaign_created_name", 0] },
                                { $arrayElemAt: ["$parentDataDetails.ai_campaign_name", 0] }
                            ]
                        }
                    }
                }
            ]).toArray();

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: (result.length > 0) ? result[0] : [],
                    message: (result.length === 0) ? res.__("front.global.no_record_found") : "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end campaignChatDetailsForUniqueKeyAccording();

    /**
     * Function to update the download flag of a campaign.
     * Uses async/await for database operations for better performance and cleaner code.
     */
    this.updateDownloadFlag = async (req, res) => {
        let finalResponse = {};
        try {
            // Extract user and campaign chat IDs
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const campaignChatId = req.body.campaign_chat_id ? req.body.campaign_chat_id : "";

            // Validate required parameters
            if (!userId || !campaignChatId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Update the is_download flag for the specified campaign chat
            await tableAiCampaignChat.updateOne(
                {
                    _id: newObjectIdDefault(campaignChatId),
                    user_id: newObjectIdDefault(userId),
                },
                {
                    $set: { is_download: true }
                }
            );

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end updateDownloadFlag();

    /**
     * Function to get AI campaign chat details using async/await.
     * All DB queries are run sequentially for clarity, but can be parallelized if needed.
     */
    this.getAiCampaignChatDetails = async (req, res) => {
        let finalResponse = {};
        try {
            // Sanitize request body to prevent XSS
            req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

            // Extract user and campaign chat IDs
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? loginUserData._id : "";
            let aiCampaignChatId = req.body.ai_campaign_chat_id ? req.body.ai_campaign_chat_id : "";
            let currentTimezone = req.body.default_timezone ? req.body.default_timezone : "";
            let withoutLoginUserSlug = req.body.user_slug ? req.body.user_slug : "";

            // If user_slug is provided, fetch the userId for that slug
            if (withoutLoginUserSlug !== '') {
                let otherUserOptions = {
                    conditions: { slug: withoutLoginUserSlug }
                };
                let withoutLoginUserData = await getUserDetailBySlug(req, res, otherUserOptions);
                userId = (withoutLoginUserData.result && withoutLoginUserData.result._id) ? withoutLoginUserData.result._id : "";
            }

            // If ai_campaign_chat_user_id is provided, override userId
            let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
            if (aiCampaignChatUserId !== '') {
                userId = aiCampaignChatUserId;
            }

            // Validate required parameters
            if (!userId || !aiCampaignChatId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare projection for campaign chat details
            const projection = {
                _id: 1,
                ai_campaign_parent_id: 1,
                user_id: 1,
                content: 1,
                type: 1,
                signup_flag: 1,
                unique_key: 1,
                create_post_group_key: 1,
                is_email_create: { $cond: ["$is_email_create", "$is_email_create", ""] },
                is_poll_create: { $cond: ["$is_poll_create", "$is_poll_create", ""] },
                is_seo_blog_create: { $cond: ["$is_seo_blog_create", "$is_seo_blog_create", ""] },
                auto_generate_number: { $cond: ["$auto_generate_number", "$auto_generate_number", ""] },
                created: 1,
            };

            // Fetch campaign chat details
            const campaignChatDetails = await tableAiCampaignChat.findOne(
                {
                    _id: newObjectIdDefault(aiCampaignChatId),
                    user_id: newObjectIdDefault(userId),
                },
                { projection }
            );

            if (!campaignChatDetails) {
                // No record found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        image_url: AI_SOCIAL_IMAGES_URL,
                        result: {},
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Fetch the latest schedule data for this campaign chat (if any)
            const scheduleResult = await calendarSchedulePost.findOne({
                ai_campaign_chat_id: newObjectIdDefault(aiCampaignChatId),
                user_id: newObjectIdDefault(userId),
                schedule_date: { $gte: new Date() },
            });

            // Attach schedule info to the result
            campaignChatDetails['calendar_schedule_id'] = (scheduleResult && scheduleResult._id) ? scheduleResult._id : "";
            campaignChatDetails['schedule_date'] = (scheduleResult && scheduleResult.schedule_date) ? newDateTimeZone(scheduleResult.schedule_date, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, currentTimezone) : "";
            campaignChatDetails['instagram_enable'] = (scheduleResult && scheduleResult.instagram_enable) ? scheduleResult.instagram_enable : false;
            campaignChatDetails['facebook_enable'] = (scheduleResult && scheduleResult.facebook_enable) ? scheduleResult.facebook_enable : false;

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    image_url: AI_SOCIAL_IMAGES_URL,
                    result: campaignChatDetails,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    image_url: AI_SOCIAL_IMAGES_URL,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getAiCampaignChatDetails();

    /**
     * Function to delete AI campaign chat.
     * Uses async/await for all DB operations and runs queries in parallel where possible for faster response.
     */
    this.deleteAiCampaignChat = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user id and campaign chat id from request
            const loginUserData = req.user_data || "";
            let userId = loginUserData._id || "";
            const aiCampaignChatId = req.body.ai_campaign_chat_id || "";
            const type = req.body.type || AI_RESPONSE_TYPE_SOCIAL_MEDIA;

            // If provided, override userId with ai_campaign_chat_user_id
            const aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
            if (aiCampaignChatUserId) {
                userId = aiCampaignChatUserId;
            }

            // Validate required fields
            if (!userId || !aiCampaignChatId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Find campaign details
            const campaignDetails = await tableAiCampaignChat.findOne(
                { _id: newObjectIdDefault(aiCampaignChatId), user_id: newObjectIdDefault(userId) },
                { projection: { _id: 1, type: 1, ai_campaign_parent_id: 1 } }
            );
            const serviceType = campaignDetails && campaignDetails.type ? campaignDetails.type : "";
            const aiCampaignParentId = campaignDetails && campaignDetails.ai_campaign_parent_id
                ? newObjectIdDefault(campaignDetails.ai_campaign_parent_id)
                : "";

            // Handle Poll deletion
            if (serviceType === AI_RESPONSE_TYPE_POLL) {
                // Run update and delete in parallel
                await Promise.all([
                    // Unset poll create flag on parent
                    tableAiCampaignChat.updateOne(
                        {
                            ai_campaign_parent_id: aiCampaignParentId,
                            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            user_id: newObjectIdDefault(userId)
                        },
                        { $unset: { is_poll_create: 1 } }
                    ),
                    // Mark poll as deleted
                    tableAiCampaignChat.updateOne(
                        {
                            _id: newObjectIdDefault(aiCampaignChatId),
                            user_id: newObjectIdDefault(userId),
                            type: AI_RESPONSE_TYPE_POLL
                        },
                        { $set: { is_deleted: DELETED } }
                    )
                ]);
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.content_has_been_deleted_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Handle SEO deletion
            if (serviceType === AI_RESPONSE_TYPE_SEO) {
                // Run update and delete in parallel
                await Promise.all([
                    // Unset SEO blog create flag on parent
                    tableAiCampaignChat.updateOne(
                        {
                            ai_campaign_parent_id: aiCampaignParentId,
                            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            user_id: newObjectIdDefault(userId)
                        },
                        { $unset: { is_seo_blog_create: 1 } }
                    ),
                    // Mark SEO as deleted
                    tableAiCampaignChat.updateOne(
                        {
                            _id: newObjectIdDefault(aiCampaignChatId),
                            user_id: newObjectIdDefault(userId),
                            type: AI_RESPONSE_TYPE_SEO
                        },
                        { $set: { is_deleted: DELETED } }
                    )
                ]);
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.content_has_been_deleted_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Handle Email deletion
            if (serviceType === AI_RESPONSE_TYPE_EMAIL) {
                // Run update and delete in parallel
                await Promise.all([
                    // Unset email create flag on parent
                    tableAiCampaignChat.updateOne(
                        {
                            ai_campaign_parent_id: aiCampaignParentId,
                            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            user_id: newObjectIdDefault(userId)
                        },
                        { $unset: { is_email_create: 1 } }
                    ),
                    // Mark email as deleted
                    tableAiCampaignChat.updateOne(
                        {
                            _id: newObjectIdDefault(aiCampaignChatId),
                            user_id: newObjectIdDefault(userId),
                            type: AI_RESPONSE_TYPE_EMAIL
                        },
                        { $set: { is_deleted: DELETED } }
                    )
                ]);
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.content_has_been_deleted_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Handle Social Media or Social Story deletion
            if (serviceType === AI_RESPONSE_TYPE_SOCIAL_MEDIA || serviceType === AI_RESPONSE_TYPE_SOCIAL_STORY) {
                // Mark the campaign chat as deleted
                await tableAiCampaignChat.updateOne(
                    {
                        _id: newObjectIdDefault(aiCampaignChatId),
                        user_id: newObjectIdDefault(userId)
                    },
                    { $set: { is_deleted: DELETED } }
                );

                // Delete all related scheduled posts in parallel
                await calendarSchedulePost.deleteMany({
                    ai_campaign_chat_id: newObjectIdDefault(aiCampaignChatId),
                    ai_campaign_parent_id: aiCampaignParentId,
                    user_id: newObjectIdDefault(userId),
                    type: type
                });

                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.post_has_been_deleted_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // If no valid serviceType matched, return error
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);

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
    }; // end deleteAiCampaignChat();

    /**
     * Function to delete a scheduled post.
     * Uses async/await for database operations for cleaner and faster response.
     */
    this.deleteScheduledPost = async (req, res) => {
        let finalResponse = {};

        // Extract user and post ID from request
        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const calendarSchedulePostId = req.body.calendar_schedule_post_id ? newObjectIdDefault(req.body.calendar_schedule_post_id) : "";

        // Validate required parameters
        if (!userId || !calendarSchedulePostId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Delete the scheduled post using async/await
            const deleteResult = await calendarSchedulePost.deleteOne({
                _id: calendarSchedulePostId,
                user_id: newObjectIdDefault(userId),
            });

            if (deleteResult && deleteResult.deletedCount > 0) {
                // Success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.schedule_post_has_been_deleted_successfully"),
                    }
                };
            } else {
                // Not found or already deleted
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
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
    }; // end deleteScheduledPost();

    /**
    * Function is use to generate supporting content
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.generateSupportingContent = async (req, res) => {
        let finalResponse = {};

        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let campaignChatId = req.body.campaign_chat_id ? req.body.campaign_chat_id : "";
        let supportingServices = req.body.supporting_services ? req.body.supporting_services : [];

        // Validate required parameters
        if (!userId || !campaignChatId || supportingServices.length === 0) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        let supportingData = supportingServices;
        // Check plan limits for requested supporting services
        let planSupport = await processSupportingServices(req, res, { supporting_services: supportingServices, login_user_data: loginUserData });
        let planSupportResult = planSupport.results || [];

        // Filter services with status 'allow'
        let allowedServices = (planSupport.status === STATUS_SUCCESS) ? planSupportResult.filter(result => result.status === ALLOW_CREATE_DATA).map(result => result.service) : [];
        supportingServices = allowedServices;

        if (supportingServices.length === 0) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    created_date: getUtcDate(),
                    unique_key: "",
                    message: res.__("front.social_post_limnt.post_limit_reached_upgrade_your_plan_to_post_more"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        let customerId = loginUserData && loginUserData.user_unique_id ? loginUserData.user_unique_id : "";
        let publicBusinessInformation = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
        let ctaName = publicBusinessInformation && publicBusinessInformation.call_to_action ? publicBusinessInformation.call_to_action : "";
        let businessName = publicBusinessInformation && publicBusinessInformation.name_of_the_business ? publicBusinessInformation.name_of_the_business : "";
        let aiIndustryNames = publicBusinessInformation && publicBusinessInformation.ai_business_industry_names ? publicBusinessInformation.ai_business_industry_names : [];
        let seoKeyWordFirst = publicBusinessInformation && publicBusinessInformation.populate_key_phrase_first ? publicBusinessInformation.populate_key_phrase_first : null;
        let seoKeywordSecond = publicBusinessInformation && publicBusinessInformation.populate_key_phrase_second ? publicBusinessInformation.populate_key_phrase_second : null;
        let websiteUrl = publicBusinessInformation && publicBusinessInformation.website_url ? publicBusinessInformation.website_url : "";
        let email = loginUserData && loginUserData.email ? loginUserData.email : "";
        let zipCode = loginUserData ? loginUserData.zip : "";
        let specificProductService = publicBusinessInformation && publicBusinessInformation.specific_product_or_service ? publicBusinessInformation.specific_product_or_service : "";
        let benefitService = publicBusinessInformation && publicBusinessInformation.benefits_product_or_service ? publicBusinessInformation.benefits_product_or_service : "";
        let targetAudienceData = publicBusinessInformation && publicBusinessInformation.target_audience ? publicBusinessInformation.target_audience : "";

        // Format industry names for display
        if (aiIndustryNames.length > 1) {
            let lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
            aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
            aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
            aiIndustryNames.push(lastConcat);
        }
        let aiBusinessIndustry = aiIndustryNames.join(', ');
        let seoKeywords = [seoKeyWordFirst, seoKeywordSecond].join(" and ");

        let businessData = {
            business_name: businessName,
            key_products: specificProductService,
            services: benefitService,
            brand_voice: targetAudienceData,
            business_industry: aiBusinessIndustry
        };

        // Fetch business information from DB
        let businessInformation = await web_ai_info.findOne(
            { user_id: userId },
            { projection: { _id: 0, data: 1, other_data: 1, social_media_presence: 1, apify_instagram_data: 1 } }
        );
        let aiInformationData = (businessInformation && businessInformation.data) ? businessInformation.data : businessData;
        let aiInformationOtherPagesData = businessInformation?.other_data || {};

        // Merge other pages data if present
        if (aiInformationOtherPagesData && Object.keys(aiInformationOtherPagesData).length > 0) {
            aiInformationData = { ...aiInformationData, ...aiInformationOtherPagesData };
        }

        // Remove unwanted keys
        ['contactInfo', 'socialLinks', 'seoKeywords', 'ctaText', 'toneOfSite', 'zipCode', 'uniqueSellingProposition'].forEach(key => delete aiInformationData[key]);

        let businessInformationData = (Object.keys(aiInformationData).length > 0) ? aiInformationData : "";
        removeEmptyKeys(businessInformationData);
        businessInformationData = objectToMarkdown(businessInformationData);

        // Fetch social post details using async/await
        let socialPostResult = await tableAiCampaignChat.findOne({ _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) }, { projection: { content: 1, ai_campaign_parent_id: 1, unique_key: 1, is_email_create: 1, is_poll_create: 1, is_seo_blog_create: 1 } });

        if (!socialPostResult) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    created_date: getUtcDate(),
                    unique_key: "",
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        let emailCreated = socialPostResult.is_email_create || "";
        let pollCreated = socialPostResult.is_poll_create || "";
        let seoCreated = socialPostResult.is_seo_blog_create || "";
        let uniqueKey = socialPostResult.unique_key || "";

        let socialPostContent = socialPostResult.content || "";
        let title = socialPostContent ? socialPostContent.title : "";
        let captions = socialPostContent ? socialPostContent.captions : "";
        let aiCampaignparentId = socialPostResult.ai_campaign_parent_id || "";
        let getPdfInformation = "";

        let socialPostCaptions = captions.replace(/#[^\s#]+/g, '').trim();
        let postTopic = title + "\n" + socialPostCaptions;

        // Filter out already created supporting services
        supportingServices = supportingServices.filter(service =>
            !(emailCreated && service === AI_RESPONSE_TYPE_EMAIL) &&
            !(pollCreated && service === AI_RESPONSE_TYPE_POLL) &&
            !(seoCreated && service === AI_RESPONSE_TYPE_SEO)
        );

        if (supportingServices.length === 0) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    created_date: getUtcDate(),
                    unique_key: uniqueKey,
                    message: res.__("front.content_library.already_supporting_content_generated"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // If Gemini server is enabled, use Gemini for content generation
        if (GEMINI_SERVER_ENABLE === true) {
            let optionsData = {
                data_vault: businessInformationData,
                business_name: businessName,
                services: supportingServices,
                seo_keywords: seoKeywords,
                industry: aiBusinessIndustry,
                zipcode: zipCode,
                topic: postTopic
            };

            // Generate supporting content using Gemini
            let geminiData = await generateSupportingContentData(req, res, optionsData);
            let openAiResponseData = geminiData?.response || [];

            // Prepare campaign chat records in parallel
            let newData = await Promise.all(
                (openAiResponseData.length > 0) ? openAiResponseData.map(async (value) => {
                    const campaignId = newObjectIdDefault();
                    let finalContentData = (value.response[value.type]) ? value.response[value.type] : {};

                    if (value.type === AI_RESPONSE_TYPE_SEO) {
                        let blogText = finalContentData.blog_body ? finalContentData.blog_body : "";
                        finalContentData['blog_text'] = boldHeadings(blogText);
                        delete finalContentData['blog_body'];
                    }

                    let campaignChatData = {
                        _id: campaignId,
                        user_id: userId,
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                        role: AI_ROLE_ASSISTANT,
                        content: finalContentData,
                        type: value.type || "",
                        is_viewed: false,
                        signup_flag: false,
                        unique_key: generateRandomID(8),
                        is_draft: CAMPAIGN_NOT_DRAFT,
                        is_deleted: NOT_DELETED,
                        created: getUtcDate(),
                    };

                    if (value.type === AI_RESPONSE_TYPE_EMAIL) {
                        campaignChatData["add_poll_toggle"] = TOGGLE_POLL_ON;
                    }

                    return campaignChatData;
                }) : []
            );

            // Insert generated records into campaign chat
            await tableAiCampaignChat.insertMany(newData);

            // Update flags for created services in parallel
            let updatePromises = [];
            if (supportingServices.includes(AI_RESPONSE_TYPE_SEO)) {
                updatePromises.push(
                    tableAiCampaignChat.updateOne(
                        { _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                        { $set: { is_seo_blog_create: true } }
                    )
                );
            }
            if (supportingServices.includes(AI_RESPONSE_TYPE_POLL)) {
                updatePromises.push(
                    tableAiCampaignChat.updateOne(
                        { _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                        { $set: { is_poll_create: true } }
                    )
                );
            }
            if (supportingServices.includes(AI_RESPONSE_TYPE_EMAIL)) {
                updatePromises.push(
                    tableAiCampaignChat.updateOne(
                        { _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                        { $set: { is_email_create: true } }
                    )
                );
            }
            await Promise.all(updatePromises);

            // Handle poll creation if needed
            if (supportingServices.includes(AI_RESPONSE_TYPE_POLL)) {
                let pollData = await tableAiCampaignChat.findOne({
                    user_id: userId,
                    ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                    type: AI_RESPONSE_TYPE_POLL,
                    is_deleted: NOT_DELETED
                });
                let pollContent = pollData && pollData.content ? pollData.content : "";
                let pollCampaignChatId = pollData && pollData._id ? pollData._id : "";

                let options = {
                    user_id: userId,
                    ai_data: pollContent,
                    ai_campaign_chat_id: pollCampaignChatId,
                    ai_campaign_parent_id: aiCampaignparentId,
                    campaign_type: DEFAULT_CAMPAIGN,
                    customer_id: customerId
                };
                await addAiPollData(req, res, options);
            }

            // Handle email creation if needed
            if (supportingServices.includes(AI_RESPONSE_TYPE_EMAIL)) {
                // Run all required queries in parallel for email template
                let [
                    lastGeneratedEmail,
                    campaignNewsletterTemplate,
                    pollSupportingResult
                ] = await Promise.all([
                    // get campaign detials
                    tableAiCampaignChat.findOne({
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                        user_id: newObjectIdDefault(userId),
                        is_deleted: NOT_DELETED,
                        type: AI_RESPONSE_TYPE_EMAIL
                    }, { projection: { _id: 1, type: 1, content: 1, add_poll_toggle: 1 } }),

                    // get campaign Newsletter
                    campaignNewsletterCollection.findOne({
                        _id: newObjectIdDefault(CAMPAIGN_NEWSLETTER_TEMPLATE_ID)
                    }),

                    // get poll details
                    polls.findOne({
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                        user_id: newObjectIdDefault(userId),
                        type: POLL_AI_TYPE
                    }, { projection: { _id: 1, options: 1, custom_url: 1 } })
                ]);

                let pollId = pollSupportingResult && pollSupportingResult._id ? newObjectIdDefault(pollSupportingResult._id) : "";
                let pollCustomUrl = pollSupportingResult && pollSupportingResult.custom_url ? POLL_VIEW_PAGE_URL + pollSupportingResult.custom_url : "";

                let userEmail = res.locals.settings["Email.user_email"];
                let emailHost = res.locals.settings["Email.host"];
                let emailPassword = res.locals.settings["Email.password"];
                let emailPort = res.locals.settings["Email.port"];

                let lastGeneratedEmailId = lastGeneratedEmail && lastGeneratedEmail._id ? lastGeneratedEmail._id : "";
                let lastEmailContent = lastGeneratedEmail && lastGeneratedEmail.content ? lastGeneratedEmail.content : {};
                let emailHeading = lastEmailContent.email_heading || "";
                let subject = lastEmailContent.subject || "";
                let bulletPoints = lastEmailContent.bullet_points || [];
                let bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
                let bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
                let bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
                let bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
                let bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
                let bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
                let emailClosingText = lastEmailContent.email_closing_paragraph || "";
                let emailSignature = lastEmailContent.email_ending_signature || "";
                let ctaText = lastEmailContent.cta_text || "";
                let ctaTextNew = res.__("insiders.quick_question");
                let emailBody = lastEmailContent.body;
                let stringNewEmailBody = JSON.stringify(emailBody).replace(/"/g, ' ').replace(/\\n/g, '<br>');

                let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
                let nameOfTheBusiness = publicBusinessInformaton && publicBusinessInformaton.name_of_the_business ? publicBusinessInformaton.name_of_the_business : "";

                if (campaignNewsletterTemplate) {
                    let newsletterPageBody = campaignNewsletterTemplate.body || "";
                    let newsletterDesignJson = campaignNewsletterTemplate.design_json || "";
                    newsletterDesignJson = JSON.stringify(newsletterDesignJson);

                    // Replace placeholders in template
                    [
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
                    ].forEach(([key, value]) => {
                        newsletterPageBody = newsletterPageBody.replace(new RegExp(key, 'g'), value);
                        newsletterDesignJson = newsletterDesignJson.replace(new RegExp(key, 'g'), value);
                    });

                    newsletterDesignJson = JSON.parse(newsletterDesignJson);

                    // Create email template
                    let campaignTemplateResponse = await addEmailTemplateNewsletter({
                        template_title: emailHeading,
                        subject: subject,
                        body: newsletterPageBody,
                        description: emailHeading,
                        user_id: userId,
                        customer_id: customerId,
                        from: nameOfTheBusiness ? removeSpecialCharacters(nameOfTheBusiness) : "",
                        from_email: userEmail,
                        attach_reward: "",
                        attach_poll: pollId,
                        host: emailHost,
                        port: emailPort,
                        email_password: emailPassword,
                        template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
                        design_json: newsletterDesignJson,
                        ai_bot: true,
                        skip_smtp: true,
                        ai_campaign_name_id: newObjectIdDefault(aiCampaignparentId),
                        ai_campaign_chat_id: newObjectIdDefault(lastGeneratedEmailId),
                        email_descriptions: {
                            [DEFAULT_LANGUAGE_MONGO_ID]: {
                                language_id: DEFAULT_LANGUAGE_MONGO_ID,
                                subject: subject,
                                body: newsletterPageBody
                            }
                        },
                    });

                    let campaignTemplateId = campaignTemplateResponse.email_inserted_id || "";
                    let campaignTemplateAction = campaignTemplateResponse.action || "";

                    // Convert HTML to image and update campaign chat
                    await htmltoImageConvert(req, res, campaignTemplateId);
                    await tableAiCampaignChat.updateOne(
                        {
                            _id: newObjectIdDefault(lastGeneratedEmailId),
                            ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                            user_id: newObjectIdDefault(userId),
                            type: AI_RESPONSE_TYPE_EMAIL
                        },
                        {
                            $set: {
                                newsletter_email_id: newObjectIdDefault(campaignTemplateId),
                                newsletter_email_action: campaignTemplateAction
                            }
                        }
                    );
                }
            }

            // Format both arrays for response
            let formattedSupportingData = supportingServices.map(formatString);
            let generatedContnt = formattedSupportingData.join(', ');

            let formattedAllowedServices = allowedServices.length > 0 ? allowedServices.map(formatString) : [];
            let allServicess = supportingData.map(formatString);
            let notGeneratedContntJoined = allServicess.filter(item => !formattedAllowedServices.includes(formatString(item))).join(', ');

            // Set dynamic message for generated content
            let dynamicMessage = notGeneratedContntJoined ? `But ${notGeneratedContntJoined} could not be generated due to your plan's limit being reached. Please upgrade your plan.` : "";
            let successMessage = res.__("front.content_library.supporting_content_generated_successfully", generatedContnt).replace(/{NOT_GENERATED}/g, dynamicMessage);

            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    created_date: getUtcDate(),
                    unique_key: uniqueKey,
                    message: successMessage,
                }
            };
            return returnApiResult(req, res, finalResponse);
        } else {
            // OpenAI fallback: generate prompts and run all queries in parallel
            let newServicesArray = [];
            let serviceKeys = [AI_RESPONSE_TYPE_POLL, AI_RESPONSE_TYPE_EMAIL, AI_RESPONSE_TYPE_SEO];

            // Build prompts for each supporting service
            for (let newServiceName of supportingServices) {
                if (serviceKeys.includes(newServiceName)) {
                    let systemPrompt = {};
                    let userPrompt = {};

                    if (newServiceName === AI_RESPONSE_TYPE_POLL) {
                        systemPrompt = { role: "system", content: "" };
                        userPrompt = {
                            role: AI_ROLE_USER,
                            content: CAMPAIGN_POLL_USER_PROMPT.replace(/{topic}/g, socialPostCaptions)
                                .replace(/{web_address}/g, businessInformationData)
                                .replace(/{industry}/g, aiBusinessIndustry)
                                .replace(/{zip_code}/g, zipCode) + " " + POLL_FORMAT,
                        };
                    } else if (newServiceName === AI_RESPONSE_TYPE_EMAIL) {
                        systemPrompt = {
                            role: "system",
                            content: CAMPAIGN_SYSTEM_PROMPT[AI_RESPONSE_TYPE_EMAIL]
                                .replace(/{topic}/g, socialPostCaptions)
                                .replace(/{business_name}/g, businessName)
                                .replace(/{zip_code}/g, zipCode)
                                .replace(/{web_address}/g, businessInformationData)
                                .replace(/{pdf_information}/g, getPdfInformation)
                                + " " + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName)
                        };
                        userPrompt = {
                            role: AI_ROLE_USER,
                            content: NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, ctaName),
                        };
                    } else if (newServiceName === AI_RESPONSE_TYPE_SEO) {
                        systemPrompt = {
                            role: "system",
                            content: "Ensure that - 1. Provide response in valid JSON format. 2. Do not include hashtags (#) in blog_text headings. 3. Do not include backticks in the final result of JSON. 4. Do not include semicolon in result JSON."
                        };
                        userPrompt = {
                            role: AI_ROLE_USER,
                            content: CAMPAIGN_SEO_USER_PROMPT.replace(/{keywords}/g, seoKeywords)
                                .replace(/{topic}/g, socialPostCaptions)
                                .replace(/{web_address}/g, businessInformationData)
                                .replace(/{industry}/g, aiBusinessIndustry)
                                .replace(/{zip_code}/g, zipCode) + " " + SEO_FORMAT,
                        };
                    }
                    newServicesArray.push({
                        system_prompt: systemPrompt,
                        user_prompt: userPrompt,
                        type: newServiceName,
                    });
                }
            }

            // Generate AI content for all prompts in parallel
            let openAiResponseData = await Promise.all(
                newServicesArray.map(prompt => getOpenAiResponse(req, res, prompt))
            );

            // Check for any error in OpenAI responses
            let flag = "";
            openAiResponseData.forEach(records => {
                if (records.status === STATUS_ERROR) {
                    flag = STATUS_ERROR;
                }
            });

            if (flag === STATUS_ERROR) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        created_date: getUtcDate(),
                        unique_key: uniqueKey,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Prepare campaign chat records in parallel
            let newData = await Promise.all(
                openAiResponseData.map(async (value) => {
                    const campaignId = newObjectIdDefault();
                    let finalContentData = (value.response[value.type]) ? value.response[value.type] : {};

                    if (value.type === AI_RESPONSE_TYPE_SEO) {
                        let blogText = finalContentData.blog_text ? finalContentData.blog_text : "";
                        finalContentData['blog_text'] = boldHeadings(blogText);
                    }

                    let campaignChatData = {
                        _id: campaignId,
                        user_id: userId,
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                        role: AI_ROLE_ASSISTANT,
                        content: finalContentData,
                        type: value.type || "",
                        is_viewed: false,
                        signup_flag: false,
                        unique_key: generateRandomID(8),
                        is_draft: CAMPAIGN_NOT_DRAFT,
                        is_deleted: NOT_DELETED,
                        created: getUtcDate(),
                    };

                    if (value.type === AI_RESPONSE_TYPE_EMAIL) {
                        campaignChatData["add_poll_toggle"] = TOGGLE_POLL_ON;
                    }

                    return campaignChatData;
                })
            );

            // Insert generated records into campaign chat
            await tableAiCampaignChat.insertMany(newData);

            // Update flags for created services in parallel
            let updatePromises = [];
            if (supportingServices.includes(AI_RESPONSE_TYPE_SEO)) {
                updatePromises.push(
                    tableAiCampaignChat.updateOne(
                        { _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                        { $set: { is_seo_blog_create: true } }
                    )
                );
            }
            if (supportingServices.includes(AI_RESPONSE_TYPE_POLL)) {
                updatePromises.push(
                    tableAiCampaignChat.updateOne(
                        { _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                        { $set: { is_poll_create: true } }
                    )
                );
            }
            if (supportingServices.includes(AI_RESPONSE_TYPE_EMAIL)) {
                updatePromises.push(
                    tableAiCampaignChat.updateOne(
                        { _id: newObjectIdDefault(campaignChatId), user_id: newObjectIdDefault(userId) },
                        { $set: { is_email_create: true } }
                    )
                );
            }
            await Promise.all(updatePromises);

            // Handle poll creation if needed
            if (supportingServices.includes(AI_RESPONSE_TYPE_POLL)) {
                let pollData = await tableAiCampaignChat.findOne({
                    user_id: userId,
                    ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                    type: AI_RESPONSE_TYPE_POLL,
                    is_deleted: NOT_DELETED
                });
                let pollContent = pollData && pollData.content ? pollData.content : "";
                let pollCampaignChatId = pollData && pollData._id ? pollData._id : "";

                let options = {
                    user_id: userId,
                    ai_data: pollContent,
                    ai_campaign_chat_id: pollCampaignChatId,
                    ai_campaign_parent_id: aiCampaignparentId,
                    campaign_type: DEFAULT_CAMPAIGN,
                    customer_id: customerId
                };
                await addAiPollData(req, res, options);
            }

            // Handle email creation if needed
            if (supportingServices.includes(AI_RESPONSE_TYPE_EMAIL)) {
                // Run all required queries in parallel for email template
                let [
                    lastGeneratedEmail,
                    campaignNewsletterTemplate,
                    pollSupportingResult
                ] = await Promise.all([
                    tableAiCampaignChat.findOne({
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                        user_id: newObjectIdDefault(userId),
                        is_deleted: NOT_DELETED,
                        type: AI_RESPONSE_TYPE_EMAIL
                    }, { projection: { _id: 1, type: 1, content: 1, add_poll_toggle: 1 } }),
                    campaignNewsletterCollection.findOne({
                        _id: newObjectIdDefault(CAMPAIGN_NEWSLETTER_TEMPLATE_ID)
                    }),
                    polls.findOne({
                        ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                        user_id: newObjectIdDefault(userId),
                        type: POLL_AI_TYPE
                    }, { projection: { _id: 1, options: 1, custom_url: 1 } })
                ]);

                let pollId = pollSupportingResult && pollSupportingResult._id ? newObjectIdDefault(pollSupportingResult._id) : "";
                let pollCustomUrl = pollSupportingResult && pollSupportingResult.custom_url ? POLL_VIEW_PAGE_URL + pollSupportingResult.custom_url : "";

                let userEmail = res.locals.settings["Email.user_email"];
                let emailHost = res.locals.settings["Email.host"];
                let emailPassword = res.locals.settings["Email.password"];
                let emailPort = res.locals.settings["Email.port"];

                let lastGeneratedEmailId = lastGeneratedEmail && lastGeneratedEmail._id ? lastGeneratedEmail._id : "";
                let lastEmailContent = lastGeneratedEmail && lastGeneratedEmail.content ? lastGeneratedEmail.content : {};
                let emailHeading = lastEmailContent.email_heading || "";
                let subject = lastEmailContent.subject || "";
                let bulletPoints = lastEmailContent.bullet_points || [];
                let bulletPoint1 = (bulletPoints[0] && bulletPoints[0].paragraph1) ? bulletPoints[0].paragraph1 : bulletPoints[0];
                let bulletPoint2 = (bulletPoints[1] && bulletPoints[1].paragraph2) ? bulletPoints[1].paragraph2 : bulletPoints[1];
                let bulletPoint3 = (bulletPoints[2] && bulletPoints[2].paragraph3) ? bulletPoints[2].paragraph3 : bulletPoints[2];
                let bulletHeading1 = (bulletPoints[0] && bulletPoints[0].heading1) ? bulletPoints[0].heading1 : "";
                let bulletHeading2 = (bulletPoints[1] && bulletPoints[1].heading2) ? bulletPoints[1].heading2 : "";
                let bulletHeading3 = (bulletPoints[2] && bulletPoints[2].heading3) ? bulletPoints[2].heading3 : "";
                let emailClosingText = lastEmailContent.email_closing_paragraph || "";
                let emailSignature = lastEmailContent.email_ending_signature || "";
                let ctaText = lastEmailContent.cta_text || "";
                let ctaTextNew = res.__("insiders.quick_question");
                let emailBody = lastEmailContent.body;
                let stringNewEmailBody = JSON.stringify(emailBody).replace(/"/g, ' ').replace(/\\n/g, '<br>');

                let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
                let nameOfTheBusiness = publicBusinessInformaton && publicBusinessInformaton.name_of_the_business ? publicBusinessInformaton.name_of_the_business : "";

                if (campaignNewsletterTemplate) {
                    let newsletterPageBody = campaignNewsletterTemplate.body || "";
                    let newsletterDesignJson = campaignNewsletterTemplate.design_json || "";
                    newsletterDesignJson = JSON.stringify(newsletterDesignJson);

                    // Replace placeholders in template
                    [
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
                    ].forEach(([key, value]) => {
                        newsletterPageBody = newsletterPageBody.replace(new RegExp(key, 'g'), value);
                        newsletterDesignJson = newsletterDesignJson.replace(new RegExp(key, 'g'), value);
                    });

                    newsletterDesignJson = JSON.parse(newsletterDesignJson);

                    // Create email template
                    let campaignTemplateResponse = await addEmailTemplateNewsletter({
                        template_title: emailHeading,
                        subject: subject,
                        body: newsletterPageBody,
                        description: emailHeading,
                        user_id: userId,
                        customer_id: customerId,
                        from: nameOfTheBusiness ? removeSpecialCharacters(nameOfTheBusiness) : "",
                        from_email: userEmail,
                        attach_reward: "",
                        attach_poll: pollId,
                        host: emailHost,
                        port: emailPort,
                        email_password: emailPassword,
                        template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
                        design_json: newsletterDesignJson,
                        ai_bot: true,
                        skip_smtp: true,
                        ai_campaign_name_id: newObjectIdDefault(aiCampaignparentId),
                        ai_campaign_chat_id: newObjectIdDefault(lastGeneratedEmailId),
                        email_descriptions: {
                            [DEFAULT_LANGUAGE_MONGO_ID]: {
                                language_id: DEFAULT_LANGUAGE_MONGO_ID,
                                subject: subject,
                                body: newsletterPageBody
                            }
                        },
                    });

                    let campaignTemplateId = campaignTemplateResponse.email_inserted_id || "";
                    let campaignTemplateAction = campaignTemplateResponse.action || "";

                    // Convert HTML to image and update campaign chat
                    await htmltoImageConvert(req, res, campaignTemplateId);
                    await tableAiCampaignChat.updateOne(
                        {
                            _id: newObjectIdDefault(lastGeneratedEmailId),
                            ai_campaign_parent_id: newObjectIdDefault(aiCampaignparentId),
                            user_id: newObjectIdDefault(userId),
                            type: AI_RESPONSE_TYPE_EMAIL
                        },
                        {
                            $set: {
                                newsletter_email_id: newObjectIdDefault(campaignTemplateId),
                                newsletter_email_action: campaignTemplateAction
                            }
                        }
                    );
                }
            }

            // Format both arrays for response
            let formattedSupportingData = supportingServices.map(formatString);
            let generatedContnt = formattedSupportingData.join(', ');

            let formattedAllowedServices = allowedServices.length > 0 ? allowedServices.map(formatString) : [];
            let allServicess = supportingData.map(formatString);
            let notGeneratedContntJoined = allServicess.filter(item => !formattedAllowedServices.includes(formatString(item))).join(', ');

            // Set dynamic message for generated content
            let dynamicMessage = notGeneratedContntJoined
                ? `But ${notGeneratedContntJoined} could not be generated due to your plan's limit being reached. Please upgrade your plan.`
                : "";
            let successMessage = res.__("front.content_library.supporting_content_generated_successfully", generatedContnt)
                .replace(/{NOT_GENERATED}/g, dynamicMessage);

            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    created_date: getUtcDate(),
                    unique_key: uniqueKey,
                    message: successMessage,
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

    /**Function to remove underscores and capitalize the first letter*/
    formatString = (str) => {
        return str.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
    };

    /**
     * Function to check service plan for supporting services.
     * Uses async/await and runs all plan limit queries in parallel for faster response.
     * @param {*} req 
     * @param {*} res 
     * @param {*} optionsData 
     * @returns {Promise<{status: string, results: Array}>}
     */
    processSupportingServices = async (req, res, optionsData) => {
        const supportingServices = optionsData.supporting_services || [];
        const loginUserData = optionsData.login_user_data || [];
        const results = [];

        // Map each service type to its corresponding activity type
        const getActivityType = (type) => {
            switch (type) {
                case AI_RESPONSE_TYPE_POLL:
                    return ACTIVITY_POLL_CREATE_TYPE;
                case AI_RESPONSE_TYPE_EMAIL:
                    return ACTIVITY_EMAIL_CREATE_TYPE;
                case AI_RESPONSE_TYPE_SEO:
                    return ACTIVITY_SEO_BLOG_TYPE;
                default:
                    return null;
            }
        };

        // Prepare all queries in parallel for supported types
        const planLimitPromises = supportingServices.map(async (type) => {
            const activityType = getActivityType(type);
            if (!activityType) {
                // Skip unsupported types, but return a result for consistency
                return {
                    status: STATUS_ERROR,
                    service: type
                };
            }
            try {
                // Access post limit data for the activity type
                const postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, activityType);
                if (postLimitData.status === NOT_ALLOW_CREATE_DATA) {
                    // Not allowed to create data for this service
                    return {
                        status: NOT_ALLOW_CREATE_DATA,
                        service: type
                    };
                } else {
                    // Allowed to create data for this service
                    return {
                        status: ALLOW_CREATE_DATA,
                        service: type
                    };
                }
            } catch (error) {
                // Handle error for this service
                console.error("Error processing service:", type, error);
                return {
                    status: STATUS_ERROR,
                    service: type
                };
            }
        });

        // Await all plan limit checks in parallel
        const planResults = await Promise.all(planLimitPromises);

        // Accumulate results
        for (const result of planResults) {
            results.push(result);
        }

        // Return the final result
        return {
            status: STATUS_SUCCESS,
            results: results
        };
    }; // end processSupportingServices();

    /**
    * Function to generate the first social post in the fallback process.
    * Uses async/await for all queries and ensures fast response with clean formatting.
    * @returns json response
    */
    this.generateFirstSocialPostInFallbackProcess = async (req, res) => {
        let finalResponse = {};

        // Extract required fields from request body
        const userEmail = req.body.website_email || "";
        const uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
        const ipAddr = req.body.ip || "";
        const businessName = req.body.business_name || "";
        const zipCode = req.body.zip_code || "";
        const industryName = req.body.ai_business_industry_names || "";

        // Validate required parameter
        if (!uniqueBrowserId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Generate a new web link ID
        const webLinkId = newObjectIdDefault();

        try {
            // Run fallback process for crawl data
            const fallBackResponse = await fallbackProcessForCrawlData(req, res, {
                user_domain: userEmail,
                business_name_new: businessName,
                zip_code_new: zipCode,
                industry_name: industryName,
                initial_web_link_id: webLinkId,
                unique_browser_id: uniqueBrowserId,
                max_tries: 1,
                ip_addr: ipAddr,
                is_domain_crawl: false,
            });

            if (fallBackResponse.status === STATUS_SUCCESS) {
                // Update user log in parallel with response preparation
                await Promise.all([
                    tableLibraryLogs.updateOne(
                        { unique_ai_browser_id: uniqueBrowserId },
                        { $set: { black_popup: true } }
                    )
                ]);
                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: fallBackResponse.result,
                        message: fallBackResponse.message,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // If fallback failed, try generating social post with business name
                const socialPostResponse = await generateFirstSocialPostWithBusinessName(req, res, {
                    user_domain: userEmail,
                    business_name_new: businessName,
                    zip_code_new: zipCode,
                    industry_name: industryName,
                    initial_web_link_id: webLinkId,
                    unique_browser_id: uniqueBrowserId,
                    max_tries: 1,
                    ip_addr: ipAddr
                });

                // Update user log in parallel with response preparation
                await Promise.all([
                    tableLibraryLogs.updateOne(
                        { unique_ai_browser_id: uniqueBrowserId },
                        { $set: { black_popup: true } }
                    )
                ]);

                finalResponse = {
                    data: {
                        status: socialPostResponse.status,
                        result: socialPostResponse.result,
                        message: socialPostResponse.message,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end generateFirstSocialPostInFallbackProcess();


    /**
     * Function to change the order of the images in the carousel.
     * Uses async/await for database operations for faster and cleaner response.
     * @return json 
     **/
    this.changeSocialCarouselOrder = async (req, res) => {
        let finalResponse = {};

        // Get user data and required parameters
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let campaignChatId = req.body.campaign_chat_id ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let contentImage = req.body.content_image ? req.body.content_image : "";
        let sortImageType = req.body.sort_image_type ? req.body.sort_image_type : INSTAGRAM_TYPE;

        // Prepare update data based on image type
        let updateData = {
            "content.image": contentImage
        };
        if (sortImageType == FACEBOOK_TYPE) {
            updateData = {
                "content.facebook_image": contentImage
            };
        }

        // If group post, override userId
        let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
        if (aiCampaignChatUserId != '') {
            userId = aiCampaignChatUserId;
        }

        // Validate required parameters
        if (!userId || !campaignChatId || !contentImage) {
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
            // Update AI Campaign social post chat using async/await
            await tableAiCampaignChat.updateOne(
                {
                    "_id": campaignChatId,
                    "user_id": userId,
                    "type": AI_RESPONSE_TYPE_SOCIAL_MEDIA
                },
                { $set: updateData }
            );

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.content_library.ai_social_image_saved_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end changeSocialCarouselOrder();

    /**
    * Function to check if a website is crawlable.
    * Uses async/await for all queries and ensures fast response with clean formatting.
    * @returns json response
    */
    this.checkWebsiteIsCrawlable = async (req, res) => {
        let finalResponse = {};

        // Extract unique browser ID and website URL from request
        const uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
        let websiteUrl = req.body.website_url ? ensureHttpPrefix(req.body.website_url) : "";

        // Validate required parameters
        if (!uniqueBrowserId || !websiteUrl) {
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
            // Extract hostname from URL
            const hostname = websiteUrl.split('//')[1].split('/')[0];

            // Get the domain (TLD + domain)
            const parts = hostname.split('.');
            const domain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;

            // Check and update protocol if needed (async)
            const protocolSite = await checkProtocol(websiteUrl);
            websiteUrl = protocolSite ? protocolSite : websiteUrl;

            // Get list of domains not allowed for crawling
            const urlDomainsNotAllowed = domain ? JSON.parse(JSON.stringify(res.locals.settings["Site.Not_crawl_domain"])) : [];

            // If domain is not allowed, return error
            if (urlDomainsNotAllowed.includes(domain)) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.content_library.unable_to_crawl_the_website"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Check if the website is crawlable (async)
            let websiteCrawlable = false;
            try {
                websiteCrawlable = await isHTMLPage(websiteUrl);
            } catch (error) {
                // Log error and default to not crawlable
                console.error("Error checking if URL is crawlable:", error);
                websiteCrawlable = false;
            }

            // Respond based on crawlability
            if (!websiteCrawlable) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.content_library.this_website_not_crawlable"),
                    }
                };
            } else {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.this_website_crawlable"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: error,
                    message: res.__("front.content_library.website_details_not_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end checkWebsiteIsCrawlable();


    /**
     * Function to unschedule all social media posts for the current user.
     * Uses async/await and runs update and delete queries in parallel for faster response.
     * @returns {Promise<void>} JSON response
     */
    this.unscheduleAllSocialPost = async (req, res) => {
        let finalResponse = {};
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

        // Check for blank user id
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

        try {
            // Run update and delete queries in parallel for better performance
            await Promise.all([
                // Unset 'is_scheduled' for all AI campaign chats of type SOCIAL_MEDIA for this user
                tableAiCampaignChat.updateMany(
                    {
                        user_id: newObjectIdDefault(userId),
                        is_scheduled: true,
                        type: AI_RESPONSE_TYPE_SOCIAL_MEDIA
                    },
                    { $unset: { is_scheduled: 1 } }
                ),
                // Delete all scheduled posts of type SOCIAL_MEDIA for this user
                calendarSchedulePost.deleteMany(
                    {
                        user_id: newObjectIdDefault(userId),
                        type: AI_RESPONSE_TYPE_SOCIAL_MEDIA
                    }
                )
            ]);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.calendar_schedule.unschedule_all_socail_post_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle unexpected errors and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end unscheduleAllSocialPost();


    /**
     * Function is used to save multiple campaigns
     * @returns json response
     */
    this.saveMultipleCampaignNew = async (req, res) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let campaignTitleArray = req.body.campaign_data ? req.body.campaign_data : [];
        const aiAboutDocument = db.collection(TABLE_AI_ABOUT_DOCUMENT);

        let lastUsedPrompt = (loginUserData && loginUserData.last_used_prompt) ? loginUserData.last_used_prompt : LEFT_HEMISPHERE_PROMPT;

        // For auto schedule post
        let instagramLongLivedAccessToken = loginUserData.long_lived_access_token || "";
        let instagramUrl = loginUserData.instagram_url || "";
        let autoSchedule = loginUserData.auto_schedule || "";

        let groupId = (req.body && req.body.group_id) ? newObjectIdDefault(req.body.group_id) : "";
        let groupUserSlug = "";
        let groupRefKey = "";
        let uniqueKey = "";

        if (!userId || campaignTitleArray.length === 0) {
            // Send error response if user or campaign data is missing
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Check post limit for the user
        let postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_SOCIAL_TYPE);
        let currentLimitAvailable = postLimitData.current_limit_available;

        if (postLimitData.status === ALLOW_CREATE_DATA && currentLimitAvailable >= campaignTitleArray.length) {
            try {
                let uniqueKeyForAll = generateRandomID(8);

                // Get previous generated captions (last 10)
                let previousCaptions = await tableAiCampaignChat.find(
                    { user_id: userId, type: AI_RESPONSE_TYPE_SOCIAL_MEDIA, signup_flag: false },
                    { projection: { '_id': 0, 'content.captions': 1, 'content.title': 1 } }
                ).sort({ created: SORT_DESC }).limit(10).toArray();

                let previousCaptionsAndTitles = (previousCaptions.length > 0)
                    ? previousCaptions.map((item, index) => {
                        let title = item.content.title;
                        let caption = item.content.captions;
                        return `${index + 1}. title: ${title}\ncaption: ${caption}`;
                    }).join('\n\n')
                    : '';

                // Get business information from web_ai_info collection
                let businessInformation = await web_ai_info.findOne({ user_id: userId }, { projection: { _id: 0, data: 1, other_data: 1, social_media_presence: 1, apify_instagram_data: 1 } });

                let aiInformationData = businessInformation?.data || {};
                let aiInformationOtherPagesData = businessInformation?.other_data || {};
                let socialMediaPresence = businessInformation?.social_media_presence || {};
                let apifyInstagramData = businessInformation?.apify_instagram_data || {};

                // Merge additional business info
                if (aiInformationOtherPagesData && Object.keys(aiInformationOtherPagesData).length > 0) {
                    aiInformationData = { ...aiInformationData, ...aiInformationOtherPagesData };
                }
                if (socialMediaPresence && Object.keys(socialMediaPresence).length > 0) {
                    delete socialMediaPresence.topPosts;
                    aiInformationData = { ...aiInformationData, ...socialMediaPresence };
                }
                if (apifyInstagramData && Object.keys(apifyInstagramData).length > 0) {
                    delete apifyInstagramData.topPosts;
                    aiInformationData = { ...aiInformationData, ...apifyInstagramData };
                }

                // Remove empty keys and unwanted fields
                removeEmptyKeys(aiInformationData);
                ['contactInfo', 'socialLinks', 'seoKeywords', 'ctaText', 'toneOfSite', 'zipCode', 'uniqueSellingProposition', 'primaryGoal', 'targetAudience', 'offerDiscounts'].forEach(key => delete aiInformationData[key]);

                let businessInformationData = (Object.keys(aiInformationData).length > 0) ? objectToMarkdown(aiInformationData) : "";

                let allDataResponses = [];
                let generateAllDataPromises = [];

                // If groupId is present, get group slug and ref key
                if (groupId != '') {
                    groupRefKey = generateRandomID(8);
                    let groupDetailsUser = await multipleUserGroup.findOne(
                        { _id: newObjectIdDefault(groupId) },
                        { projection: { 'slug': 1 } }
                    );
                    groupUserSlug = groupDetailsUser?.slug || "";
                }

                // Prepare all campaign creation promises for parallel execution
                for (let i = 0; i < campaignTitleArray.length; i++) {
                    generateAllDataPromises.push((async () => {
                        let fileName = ("file_" + i).toString();
                        let pdfFile = (req.files && req.files[fileName]) ? req.files[fileName] : "";
                        let extension = pdfFile?.name?.split('.').pop()?.toLowerCase() || "";

                        let campaignName = campaignTitleArray[i].topic || "";
                        let topicName = campaignTitleArray[i].topic || "";
                        let pasteContent = campaignTitleArray[i].title || "";
                        let documentId = campaignTitleArray[i].document_id || "";
                        let socialPostImageSave = JSON.parse(campaignTitleArray[i].social_post_image_save) || false;

                        let finalWordDocument = "";
                        let uploadImage = [];
                        let facebookImage = [];
                        let fullImageUrl = "";
                        let pdfUrl = "";

                        try {
                            // If documentId is present, fetch document and extract text or set PDF URL
                            if (documentId && typeof documentId === 'string') {
                                let getDocument = await aiAboutDocument.findOne(
                                    { _id: newObjectIdDefault(documentId), user_id: userId },
                                    { projection: { _id: 0, upload_file: 1, file_extension: 1 } }
                                );
                                let uploadDocName = getDocument ? getDocument.upload_file : "";
                                let fileExtension = getDocument ? getDocument.file_extension : "";
                                let uploadedFileExtension = fileExtension ? fileExtension : uploadDocName.split('.').pop();

                                if (uploadedFileExtension === "pdf") {
                                    pdfUrl = AI_ABOUT_USER_FILE_URL + uploadDocName;
                                } else {
                                    let pdfExtractedData = await extractTextFromDocumentWithUrl({ file_name: uploadDocName });
                                    let wordExtractedText = pdfExtractedData ? pdfExtractedData.extracted_text : "";
                                    finalWordDocument = wordExtractedText;
                                }
                            }

                            // If image file is present, upload and resize for both Instagram and Facebook in parallel
                            if (pdfFile && ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
                                // Upload image for both Instagram and Facebook in parallel
                                let [instaUploadResp, fbUploadResp] = await Promise.all([
                                    moveUploadedFile(req, res, {
                                        image: pdfFile,
                                        ai_social_image_submit: true,
                                        filePath: AI_SOCIAL_IMAGES_FILE_PATH
                                    }),
                                    moveUploadedFile(req, res, {
                                        image: pdfFile,
                                        ai_social_image_submit: true,
                                        filePath: AI_SOCIAL_IMAGES_FILE_PATH
                                    })
                                ]);

                                let imageName = (instaUploadResp.status === STATUS_SUCCESS && instaUploadResp.fileName) || "";
                                let imageExtension = (instaUploadResp.status === STATUS_SUCCESS && instaUploadResp.image_extension) || "";

                                let facebookImageName = (fbUploadResp.status === STATUS_SUCCESS && fbUploadResp.fileName) || "";
                                let facebookImageExtension = (fbUploadResp.status === STATUS_SUCCESS && fbUploadResp.image_extension) || "";

                                // Resize images for both platforms in parallel
                                await Promise.all([
                                    resizeImageForSocialPostImage(req, res, {
                                        image: pdfFile,
                                        image_name: imageName,
                                        type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                                        without_crop: true
                                    }),
                                    resizeImageForFacebookPostImage(req, res, {
                                        image: pdfFile,
                                        image_name: facebookImageName
                                    })
                                ]);

                                // Assign outputs
                                uploadImage = [{
                                    _id: newObjectIdDefault(),
                                    name: imageName,
                                    extension: imageExtension,
                                    post_on_instagram: true
                                }];
                                facebookImage = [{
                                    _id: newObjectIdDefault(),
                                    name: facebookImageName,
                                    extension: facebookImageExtension,
                                    post_on_facebook: true
                                }];
                                fullImageUrl = imageName ? AI_SOCIAL_IMAGES_URL + imageName : "";
                            }

                            // Append pasted content and document data to campaignName
                            if (pasteContent) {
                                campaignName += `\n\nSuggested Content:\n${pasteContent}\n `;
                            }
                            if (finalWordDocument) {
                                campaignName += `\nDocument data:\n${finalWordDocument}\n`;
                            }

                            // If groupId is present, handle group user post
                            if (groupId != '') {
                                let optionsData = {
                                    group_id: groupId,
                                    image_urls: [fullImageUrl],
                                    video_urls: [],
                                    pdf_url: pdfUrl,
                                    topic: topicName,
                                    group_ref_key: groupRefKey,
                                    social_post_images: socialPostImageSave ? uploadImage : [],
                                    social_post_facebook_images: socialPostImageSave ? facebookImage : [],
                                };
                                await generateGroupUserSocialPost(req, res, optionsData);

                                // Get campaign chat details for group
                                let groupDetails = await getGroupDetailsByRefKey({ group_ref_key: groupRefKey });
                                uniqueKey = groupDetails?.unique_key || '';
                                allDataResponses.push(groupId);
                                return;
                            }

                            // If not group, handle campaign creation
                            // Generate slug for campaign name
                            let slugOptions = {
                                title: topicName,
                                table_name: TABLE_AI_CAMPAIGN_NAME,
                                slug_field: "slug"
                            };
                            let slugResponse = await getDatabaseSlug(slugOptions);

                            // Insert campaign name
                            let campaignNameData = {
                                user_id: userId,
                                slug: slugResponse?.title || "",
                                ai_campaign_name: topicName,
                                ai_campaign_created_name: "",
                                type: DEFAULT_CAMPAIGN,
                                is_deleted: NOT_DELETED,
                                first_ai_poll_generated: false,
                                created: getUtcDate(),
                            };
                            let campaignNameInsertResult = await tableAiCampaignName.insertOne(campaignNameData);
                            let insertedId = campaignNameInsertResult.insertedId || "";

                            // Prepare prompt and temperature
                            let userPrompt = "";
                            let temperature = "";
                            const isLive = LIVE_SERVER_UPLOAD === true;
                            const hasMedia = (isLive && fullImageUrl);

                            if (lastUsedPrompt === LEFT_HEMISPHERE_PROMPT) {
                                userPrompt = hasMedia ? RIGHT_BRAIN_WITH_MEDIA : RIGHT_BRAIN_NO_MEDIA;
                                temperature = hasMedia ? 0.7 : 0.7;
                            } else if (lastUsedPrompt === RIGHT_HEMISPHERE_PROMPT) {
                                userPrompt = hasMedia ? LEFT_BRAIN_WITH_MEDIA : LEFT_BRAIN_NO_MEDIA;
                                temperature = hasMedia ? 0.7 : 0.2;
                            }

                            let mediaAttach = [pdfUrl, fullImageUrl].filter(Boolean);

                            userPrompt = userPrompt
                                .replace(/{DATA_VAULT}/g, businessInformationData)
                                .replace(/{TOPIC}/g, campaignName)
                                .replace(/{LAST_10_CAPTIONS}/g, previousCaptionsAndTitles)
                                .replace(/{MEDIA}/g, mediaAttach);

                            let optionsData = {
                                prompt: userPrompt,
                                image_urls: [fullImageUrl],
                                pdf_url: pdfUrl,
                                file_name: fileName,
                                extension: extension,
                                temperature: temperature
                            };

                            // Generate response from Gemini
                            let captionContentData = await getCaptionWithOrWithoutMedia(req, res, optionsData);
                            let responseData = (captionContentData.status === STATUS_SUCCESS) ? captionContentData.response : "";

                            if (responseData.title && responseData.caption) {
                                uniqueKey = generateRandomID(8);

                                let campaignChatData = {
                                    user_id: userId,
                                    ai_campaign_parent_id: insertedId,
                                    role: AI_ROLE_ASSISTANT,
                                    topic: topicName,
                                    content: {
                                        title: responseData.title,
                                        captions: responseData.caption + (responseData?.hashtags ? ("\n" + responseData.hashtags) : ""),
                                        hashtags: responseData.hashtags,
                                        image: socialPostImageSave ? uploadImage : [],
                                        facebook_image: socialPostImageSave ? facebookImage : [],
                                    },
                                    type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                                    is_viewed: false,
                                    signup_flag: false,
                                    first_content_campaign: false,
                                    unique_key: uniqueKey,
                                    create_post_group_key: uniqueKeyForAll,
                                    is_draft: CAMPAIGN_DRAFT,
                                    is_deleted: NOT_DELETED,
                                    created: getUtcDate(),
                                };

                                // Insert campaign chat
                                let campaignChatInsertResult = await tableAiCampaignChat.insertOne(campaignChatData);
                                let campaignChatId = campaignChatInsertResult.insertedId || "";

                                // Auto schedule campaign if enabled
                                if (autoSchedule && (instagramUrl || instagramLongLivedAccessToken)) {
                                    setImmediate(async () => {
                                        let optionsData = {
                                            login_user_data: loginUserData,
                                            ai_campaign_chat_id: campaignChatId,
                                        };
                                        await autoSchedulePosts(req, res, optionsData);
                                    });
                                }

                                allDataResponses.push(responseData);
                            }
                        } catch (err) {
                            // Swallow error for this campaign, continue with others
                        }
                    })());
                }

                // Wait for all campaign creations to finish in parallel
                await Promise.all(generateAllDataPromises);

                // If all campaigns created successfully
                if (allDataResponses.length > 0 && allDataResponses.length === campaignTitleArray.length) {
                    if (groupId == '') {
                        // Update last used prompt for user
                        let updateLastUsedPrompt = (lastUsedPrompt === LEFT_HEMISPHERE_PROMPT)
                            ? RIGHT_HEMISPHERE_PROMPT
                            : LEFT_HEMISPHERE_PROMPT;
                        await users.updateOne(
                            { _id: newObjectIdDefault(userId) },
                            { $set: { last_used_prompt: updateLastUsedPrompt } }
                        );
                    }
                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            create_post_group_key: uniqueKeyForAll,
                            group_ref_key: groupRefKey,
                            unique_key: uniqueKey,
                            group_slug: groupUserSlug,
                            message: res.__("front.content_library.social_post_generated_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    // Send error response if not all campaigns created
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            create_post_group_key: "",
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } catch (error) {
                // Send error response on exception
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        create_post_group_key: "",
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } else {
            // Send error response if post limit exceeded
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    create_post_group_key: "",
                    message: res.__("front.content_library.please_decrease_your_post_limit", currentLimitAvailable),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end saveMultipleCampaignNew();

}
module.exports = new ContentLibrary();