const async = require('async');
const axios = require('axios');

/** define collection */
const users = db.collection(TABLE_USERS);
const web_links = db.collection(TABLE_WEB_LINKS);
const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
const aiAboutDocument = db.collection(TABLE_AI_ABOUT_DOCUMENT);

function webCrawl() {

    /**
     * Function used to crawl website data
     * @param {*} req 
     * @param {*} res 
     */
    this.crawlWebsiteData = async (req, res) => {
        let finalResponse = {};

        // Get user data and validate user
        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const customerId = loginUserData.user_unique_id || "";

        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Extract business and user info
        const zipCode = loginUserData.zip || "";
        const publicBusinessInformaton = loginUserData.public_business_informaton || "";
        let websiteUrl = (publicBusinessInformaton && publicBusinessInformaton.website_url) ? publicBusinessInformaton.website_url : "";
        const userEmail = loginUserData.email || "";
        const businessName = publicBusinessInformaton.name_of_the_business || "";
        let aiIndustryNames = publicBusinessInformaton.ai_business_industry_names || [];

        // Format industry names for display
        if (aiIndustryNames.length > 1) {
            const lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
            aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
            aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
            aiIndustryNames.push(lastConcat);
        }
        const aiBusinessIndustry = aiIndustryNames.join(', ');

        // Query: Get web info and uploaded documents in parallel
        // Proper use of async/await and Promise.all for parallel queries
        let [webInfoData, getDocument] = await Promise.all([
            web_ai_info.findOne({ user_id: newObjectIdDefault(userId) }),
            aiAboutDocument.find(
                { user_id: userId },
                { projection: { _id: 0, upload_file: 1, file_extension: 1 } }
            ).toArray()
        ]);

        // If web info exists for user
        if (webInfoData && Object.keys(webInfoData).length > 0) {
            const webId = webInfoData.web_id ? newObjectIdDefault(webInfoData.web_id) : "";
            const webInfoId = webInfoData._id ? newObjectIdDefault(webInfoData._id) : "";
            const uniqueAibrowserId = webInfoData?.unique_browser_id || "";

            if (websiteUrl) {
                // Extract domain and check if crawl is allowed
                const hostname = websiteUrl.split('//')[1].split('/')[0];
                const parts = hostname.split('.');
                const domain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;
                const protocolSite = await checkProtocol(websiteUrl);
                websiteUrl = protocolSite || websiteUrl;

                // Get not allowed domains from settings
                const urlDomainsNotAllowed = domain ? JSON.parse(JSON.stringify(res.locals.settings["Site.Not_crawl_domain"])) : [];
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

                    // Query: Crawl and save rediscover data
                    const crawlAndSaveRediscoverData = await crawlAndSaveRediscover(req, res, {
                        url: websiteUrl,
                        user_id: userId,
                        web_id: webId
                    });

                    if (crawlAndSaveRediscoverData.status === STATUS_ERROR) {
                        websiteCrawlable = false;

                        // Fallback process if crawl fails
                        const optionData = {
                            website_url: websiteUrl,
                            user_email: userEmail,
                            user_id: userId,
                            customer_id: customerId,
                        };
                        const fallBackResponse = await fallbackProcessForRediscoverCrawlData(req, res, optionData);

                        finalResponse = {
                            data: {
                                status: fallBackResponse.status,
                                result: fallBackResponse.result,
                                message: fallBackResponse.message,
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    } else {
                        // Query: Retrieve information after crawl
                        const crawlData = crawlAndSaveRediscoverData.data || [];
                        const response = await retrieveInformationRediscover({
                            data: crawlData,
                            user_id: userId,
                            web_info_id: webInfoId,
                            website_url: websiteUrl
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

                        let finalData = response.result || {};
                        finalData['website_crawlable'] = websiteCrawlable;

                        // Update public business info and crawl all pages sequentially
                        await updatePublicInformationAccordingToWebsite(req, res, {
                            user_id: userId,
                            website_data: finalData
                        });
                        await crawlAllPagesSequentially({ web_id: webId });

                        // Save AI data structure logs
                        if (Object.keys(finalData).length > 0) {
                            const bucketData = {
                                business_info: finalData?.businessInfo || {},
                                business_categories: finalData?.businessCategories || [],
                                key_products: finalData?.keyProducts || [],
                                home_services: finalData?.services || [],
                                social_links: finalData?.socialLinks || {},
                                contact_info: finalData?.contactInfo || {},
                                menu: finalData?.Menu || "",
                                about: finalData?.About || "",
                            };
                            await saveCustomerBucketItems({
                                user_id: userId,
                                bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                                parent_bucket: PARENT_BUCKET_ABOUT_BUSINESS,
                                data: bucketData
                            });
                        }

                        // Update data vault details asynchronously
                        setImmediate(async () => {
                            await updateDataVault(req, res, {
                                unique_browser_id: uniqueAibrowserId,
                                user_id: userId
                            });
                        });

                        // Send success response
                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                message: res.__("front.website_crawler.your_website_has_been_crawled_successfully"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    }
                } catch (err) {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: [],
                            message: res.__("front.content_library.unable_to_crawl_the_website"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // Fallback: No website URL, try crawling by document
                const optionData = {
                    business_industry: aiBusinessIndustry,
                    business_name: businessName,
                    user_id: userId,
                    zip_code: zipCode,
                    website_url: websiteUrl,
                    user_email: userEmail,
                    customer_id: customerId
                };
                const fallBackResponse = await crawlDataByDocForRediscover(req, res, optionData);
                finalResponse = {
                    data: {
                        status: fallBackResponse.status,
                        result: fallBackResponse.result,
                        message: fallBackResponse.message,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } else {
            // No web info found for user
            if (websiteUrl) {
                // Extract domain and check if crawl is allowed
                const hostname = websiteUrl.split('//')[1].split('/')[0];
                const parts = hostname.split('.');
                const domain = (parts.length > 2) ? parts.slice(-2).join('.') : hostname;
                const protocolSite = await checkProtocol(websiteUrl);
                websiteUrl = protocolSite || websiteUrl;

                const urlDomainsNotAllowed = domain ? JSON.parse(JSON.stringify(res.locals.settings["Site.Not_crawl_domain"])) : [];
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
                    // Prepare for parallel queries: insert web link and crawl
                    const initialWebLinkId = newObjectIdDefault();
                    const uniqueBrowserId = generateRandomID(10);
                    let websiteCrawlable = true;
                    const childLinks = [];

                    // Run insert and crawl in parallel
                    const [insertResult, crawlAndSaveRediscoverData] = await Promise.all([
                        insertWebLinkData({
                            _id: initialWebLinkId,
                            user_id: userId,
                            website_url: websiteUrl,
                            child_links: childLinks,
                            unique_browser_id: uniqueBrowserId
                        }),
                        crawlAndSaveRediscover(req, res, {
                            user_id: userId,
                            url: websiteUrl,
                            web_id: initialWebLinkId,
                            unique_browser_id: uniqueBrowserId
                        })
                    ]);

                    if (crawlAndSaveRediscoverData.status === STATUS_ERROR) {
                        websiteCrawlable = false;

                        // Fallback process if crawl fails
                        const optionData = {
                            website_url: websiteUrl,
                            user_email: userEmail,
                            user_id: userId,
                            customer_id: customerId,
                            initial_web_link_id: initialWebLinkId,
                            unique_browser_id: uniqueBrowserId
                        };
                        const fallBackResponse = await fallbackProcessForRediscoverCrawlData(req, res, optionData);

                        finalResponse = {
                            data: {
                                status: fallBackResponse.status,
                                result: fallBackResponse.result,
                                message: fallBackResponse.message,
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    } else {
                        // Query: Insert web info and retrieve information after crawl
                        const crawlData = crawlAndSaveRediscoverData.data || [];
                        const webInfoId = await insertWebInfoData({
                            web_id: initialWebLinkId,
                            unique_browser_id: uniqueBrowserId,
                            website_url: websiteUrl,
                            user_id: userId,
                            email: userEmail
                        });

                        const response = await retrieveInformationRediscover({
                            data: crawlData,
                            web_info_id: webInfoId,
                            user_id: userId,
                            website_url: websiteUrl
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

                        let finalData = response.result || {};
                        finalData['website_crawlable'] = websiteCrawlable;

                        // Update public business info and crawl all pages sequentially
                        await updatePublicInformationAccordingToWebsite(req, res, {
                            user_id: userId,
                            website_data: finalData
                        });
                        await crawlAllPagesSequentially({ web_id: initialWebLinkId });

                        // Save AI data structure logs
                        if (Object.keys(finalData).length > 0) {
                            const bucketData = {
                                business_info: finalData?.businessInfo || {},
                                business_categories: finalData?.businessCategories || [],
                                key_products: finalData?.keyProducts || [],
                                home_services: finalData?.services || [],
                                social_links: finalData?.socialLinks || {},
                                contact_info: finalData?.contactInfo || {},
                                menu: finalData?.Menu || "",
                                about: finalData?.About || "",
                            };
                            await saveCustomerBucketItems({
                                user_id: userId,
                                bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                                parent_bucket: PARENT_BUCKET_ABOUT_BUSINESS,
                                data: bucketData
                            });
                        }

                        // Update data vault details asynchronously
                        setImmediate(async () => {
                            await updateDataVault(req, res, {
                                unique_browser_id: uniqueBrowserId,
                                user_id: userId
                            });
                        });

                        // Send success response
                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                message: res.__("front.website_crawler.your_website_has_been_crawled_successfully"),
                            }
                        };
                        return returnApiResult(req, res, finalResponse);
                    }
                } catch (err) {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: [],
                            message: res.__("front.content_library.unable_to_crawl_the_website"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else if (getDocument.length > 0) {
                // Fallback: No website, but documents exist
                const webLinkId = newObjectIdDefault();
                const uniqueBrowserId = generateRandomID(10);

                const optionData = {
                    business_industry: aiBusinessIndustry,
                    business_name: businessName,
                    user_id: userId,
                    zip_code: zipCode,
                    website_url: websiteUrl,
                    user_email: userEmail,
                    initial_web_link_id: webLinkId,
                    unique_browser_id: uniqueBrowserId,
                    customer_id: customerId
                };
                const fallBackResponse = await crawlDataByDocForRediscover(req, res, optionData);
                finalResponse = {
                    data: {
                        status: fallBackResponse.status,
                        result: fallBackResponse.result,
                        message: fallBackResponse.message,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // No website and no documents
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.content_library.update_website_url_or_upload_document_for_rediscover"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        }
    }

    /**
     * Function used to rediscover the social media presence data
     * Handles all DB queries with async/await and proper comments.
     * @param {*} req 
     * @param {*} res 
     */
    this.rediscoverSocialMediaPresence = async (req, res) => {
        let finalResponse = {};

        // Extract user data and validate
        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const customerId = loginUserData.user_unique_id || "";

        // Extract Instagram details
        const instagramUserDetails = loginUserData.instagram_user_details || {};
        const instagramUserId = instagramUserDetails.id || "";
        const longLivedAccessToken = loginUserData.long_lived_access_token || "";

        // Check for valid user
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Check for valid Instagram connection
        if (!instagramUserId || !longLivedAccessToken) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.instagram.please_connect_your_instagram_account"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Extract additional user info
        const userEmail = loginUserData.email || "";
        const publicBusinessInformation = loginUserData.public_business_informaton || {};
        const userWebsiteUrl = publicBusinessInformation.website_url || "";

        // Query: Get web info for user
        let webInfoData = null;
        try {
            webInfoData = await web_ai_info.findOne({ user_id: newObjectIdDefault(userId) });
        } catch (err) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        if (webInfoData && Object.keys(webInfoData).length > 0) {
            // If web info exists, update social media presence data
            try {
                const rediscoverData = await generateSocialMediaPresenceForRediscover(req, res, {
                    user_id: userId,
                    customer_id: customerId,
                    instagram_user_id: instagramUserId,
                    long_lived_access_token: longLivedAccessToken
                });

                if (rediscoverData.status === STATUS_SUCCESS) {
                    const businessInfoData = rediscoverData.business_data || {};
                    const websiteUrl = businessInfoData.websiteUrl || "";
                    if (websiteUrl) {
                        businessInfoData.website_crawlable = true;
                        // Update public business information
                        await updatePublicInformationAccordingToWebsite(req, res, {
                            user_id: userId,
                            website_data: businessInfoData
                        });
                    }
                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: rediscoverData.message,
                        }
                    };
                } else {
                    // Send error response
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: rediscoverData.message,
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            } catch (err) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } else {
            // If no web info exists, create new records
            const initialWebLinkId = newObjectIdDefault();
            const uniqueBrowserId = Date.now();

            try {
                // Update social media presence data
                const rediscoverInstagramData = await updateSocialMediaPresenceRediscover(req, res, {
                    user_id: userId,
                    instagram_user_id: instagramUserId,
                    long_lived_access_token: longLivedAccessToken
                });

                if (rediscoverInstagramData.status === STATUS_SUCCESS) {
                    const socialMediaAnalysis = rediscoverInstagramData.social_media_presence || {};
                    const allPosts = rediscoverInstagramData.all_instagram_posts || [];

                    // Insert web link data into database
                    await insertWebLinkData({
                        _id: initialWebLinkId,
                        user_id: newObjectIdDefault(userId),
                        email: userEmail,
                        unique_browser_id: uniqueBrowserId,
                        child_links: [],
                        is_instagram_crawled: true
                    });

                    // Insert web info AI response data into database
                    const insertWebinfo = {
                        web_id: initialWebLinkId,
                        unique_browser_id: uniqueBrowserId,
                        website_url: userWebsiteUrl,
                        user_email: userEmail,
                        user_id: newObjectIdDefault(userId),
                        data: {},
                        social_media_presence: socialMediaAnalysis,
                        all_instagram_posts: allPosts,
                        created: getUtcDate(),
                        modified: getUtcDate()
                    };

                    await web_ai_info.insertOne(insertWebinfo);

                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: rediscoverInstagramData.message,
                        }
                    };
                } else {
                    // Send error response
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: rediscoverInstagramData.message,
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            } catch (err) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        }
    }

    /**
     * Function used to rediscover the Apify Instagram data.
     * Handles all DB queries with async/await and proper comments.
     * @param {*} req 
     * @param {*} res 
     */
    this.rediscoverApifyInstagramData = async (req, res) => {
        let finalResponse = {};

        // Extract user data and validate
        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const requestInstagramUrl = req.body.instagram_url || "";
        let instagramUrl = loginUserData.instagram_url || requestInstagramUrl;

        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Format and validate Instagram URL
        instagramUrl = formatInstagramUrl(instagramUrl);
        if (!instagramUrl.includes("instagram.com")) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.instagram.invalid_instagram_url"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Extract additional user info
        const userEmail = loginUserData.email || "";
        const publicBusinessInformation = loginUserData.public_business_informaton || {};
        const userWebsiteUrl = (publicBusinessInformation && publicBusinessInformation.website_url) ? publicBusinessInformation.website_url : "";

        try {
            // Query: Get web info for user
            const webInfoData = await web_ai_info.findOne({ user_id: newObjectIdDefault(userId) });

            if (webInfoData && Object.keys(webInfoData).length > 0) {
                // If web info exists, clean up old Apify Instagram images in parallel
                const allInstagramPostsFromApify = webInfoData.all_instagram_posts_from_apify || [];
                const uniqueBrowserId = webInfoData.unique_browser_id || "";

                // Delete old Instagram crawl images in parallel
                const fileDeletePromises = allInstagramPostsFromApify
                    .filter(doc => doc.media_url)
                    .map(doc => {
                        const filePath = INSTAGRAM_CRAWL_IMAGES_FILE_PATH + doc.media_url;
                        return removeFile({ file_path: filePath }).catch(err => console.error(`Failed to delete file: ${filePath}`, err));
                    });
                await Promise.all(fileDeletePromises);

                // Generate new Apify Instagram data
                const rediscoverData = await generateApifyDataForRediscover(req, res, { user_id: userId, instagram_url: instagramUrl });

                if (rediscoverData.status === STATUS_SUCCESS) {
                    const apifyInstagramData = rediscoverData.apify_instagram_data || {};
                    const allInstagramPostsFromApifyNew = rediscoverData.all_instagram_posts_from_apify || [];
                    const websiteUrl = rediscoverData.website_url || "";

                    // Update web info with new Apify Instagram data
                    await web_ai_info.updateOne(
                        { user_id: newObjectIdDefault(userId) },
                        {
                            $set: {
                                website_url: websiteUrl,
                                instagram_url: instagramUrl,
                                apify_instagram_data: apifyInstagramData,
                                all_instagram_posts_from_apify: allInstagramPostsFromApifyNew
                            }
                        }
                    );

                    // Update data vault asynchronously
                    setImmediate(async () => {
                        updateDataVault(req, res, { unique_browser_id: uniqueBrowserId, user_id: userId });
                    });

                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: rediscoverData.message,
                        }
                    };
                } else {
                    // Send error response
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: rediscoverData.message,
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            } else {
                // No web info exists, insert new records

                const initialWebLinkId = newObjectIdDefault();
                const uniqueBrowserId = new Date().getTime();

                // Generate Apify Instagram data
                const rediscoverData = await generateApifyDataForRediscover(req, res, { user_id: userId, instagram_url: instagramUrl });

                if (rediscoverData.status === STATUS_SUCCESS) {
                    const apifyInstagramData = rediscoverData.apify_instagram_data || {};
                    const allInstagramPostsFromApify = rediscoverData.all_instagram_posts_from_apify || [];
                    const websiteUrl = rediscoverData.website_url || "";

                    // Insert web link data
                    await insertWebLinkData({
                        _id: initialWebLinkId,
                        user_id: newObjectIdDefault(userId),
                        email: userEmail,
                        unique_browser_id: uniqueBrowserId,
                        is_instagram_crawled: true
                    });

                    // Insert web info AI response data
                    const insertWebinfo = {
                        web_id: initialWebLinkId,
                        unique_browser_id: uniqueBrowserId,
                        instagram_url: instagramUrl,
                        website_url: websiteUrl,
                        user_email: userEmail,
                        user_id: newObjectIdDefault(userId),
                        data: {},
                        social_media_presence: {},
                        all_instagram_posts: [],
                        apify_instagram_data: apifyInstagramData,
                        all_instagram_posts_from_apify: allInstagramPostsFromApify,
                        created: getUtcDate(),
                        modified: getUtcDate()
                    };

                    await web_ai_info.insertOne(insertWebinfo);

                    // Update data vault asynchronously
                    setImmediate(async () => {
                        updateDataVault(req, res, { unique_browser_id: uniqueBrowserId, user_id: userId });
                    });

                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            message: rediscoverData.message,
                        }
                    };
                } else {
                    // Send error response
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: rediscoverData.message,
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle unexpected errors
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }

    /**
     * Function is used to generate social media presence for rediscover.
     * Uses async/await for all queries and handles parallel operations with Promise.all.
     * @param {*} req 
     * @param {*} res 
     * @param {*} userOptions 
     * @returns {Promise<Object>} Result object with status, website_url, apify_instagram_data, etc.
     */
    generateApifyDataForRediscover = async (req, res, userOptions) => {
        let userId = userOptions.user_id ? newObjectIdDefault(userOptions.user_id) : "";
        let instagramUrl = userOptions.instagram_url ? userOptions.instagram_url : "";
        const apifyToken = APIFY_TOKEN;

        // Extract Instagram username from URL
        const username = instagramUrl.replace("https://www.instagram.com/", "").replace("/", "");

        if (!userId || !instagramUrl) {
            // Return early if required parameters are missing
            return;
        }

        try {
            // Query: Get user Instagram biography/profile from Apify
            const profileOptions = {
                method: 'POST',
                url: `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [username] })
            };

            let profile = await makeInstagramRequest(profileOptions);
            let instagramProfileDetails = profile[0] || "";

            if (instagramProfileDetails && instagramProfileDetails.error) {
                // Handle error from Apify response
                return {
                    status: STATUS_ERROR,
                    website_url: "",
                    apify_instagram_data: {},
                    all_instagram_posts_from_apify: [],
                    message: res.__("front.global.no_record_found")
                };
            }

            // Extract and format website URL from Instagram profile
            let websiteUrl = instagramProfileDetails.externalUrl || "";
            let domain = websiteUrl ? new URL(websiteUrl).hostname.replace(/^www\./, '') : "";
            let websiteDomain = domain ? ensureHttpPrefix(domain) : "";
            let protocolSite = websiteDomain ? await checkProtocol(websiteDomain) : "";
            websiteUrl = protocolSite ? protocolSite : websiteDomain;

            let formattedPosts = [];
            let top3Posts = [];

            // If posts exist, process them in parallel using Promise.all
            if (Array.isArray(instagramProfileDetails.latestPosts) && instagramProfileDetails.latestPosts.length > 0) {
                const filteredPosts = instagramProfileDetails.latestPosts.filter(
                    post => post.type === "Image" || post.type === "Video"
                );

                // Download images/videos in parallel
                formattedPosts = await Promise.all(filteredPosts.map(async (post) => {
                    let mediaUrl = "";

                    if (post.type === "Image") {
                        let optionsImage = {
                            url: post.displayUrl,
                            dest: INSTAGRAM_CRAWL_IMAGES_FILE_PATH,
                        };
                        let imageResponse = await downloadImageToUrl(res, req, optionsImage);
                        mediaUrl = (imageResponse.status === STATUS_SUCCESS && imageResponse.fileName) ? imageResponse.fileName : "";
                    }

                    if (post.type === "Video") {
                        let optionsVideo = {
                            url: post.videoUrl,
                            dest: INSTAGRAM_CRAWL_IMAGES_FILE_PATH,
                        };
                        let videoResponse = await downloadVideoToUrl(res, req, optionsVideo);
                        mediaUrl = (videoResponse.status === STATUS_SUCCESS && videoResponse.fileName) ? videoResponse.fileName : "";
                    }

                    return {
                        id: post.id,
                        caption: post.caption || "",
                        media_type: post.type || "",
                        media_url: mediaUrl,
                        permalink: post.url || "",
                        timestamp: post.timestamp || "",
                        like_count: post.likesCount || 0,
                        comments_count: post.commentsCount || 0
                    };
                }));

                // Get top 3 posts by engagement
                top3Posts = [...formattedPosts]
                    .sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count))
                    .slice(0, 3);
            }

            // Prepare user details object
            let userDetails = {
                id: instagramProfileDetails.id,
                username: instagramProfileDetails.username,
                fullName: instagramProfileDetails.fullName,
                biography: instagramProfileDetails.biography,
                followersCount: instagramProfileDetails.followersCount,
                followsCount: instagramProfileDetails.followsCount,
                highlightReelCount: instagramProfileDetails.highlightReelCount,
                businessCategoryName: instagramProfileDetails.businessCategoryName,
            };

            let aiResponseData = "";
            let socialMediaAnalysis = "";
            let businessProfileData = "";
            let businessData = "";

            // Generate AI response data using Gemini or fallback
            if (GEMINI_SERVER_ENABLE === true) {
                let instagramData = {
                    user_details: userDetails,
                    posts: formattedPosts,
                };
                instagramData = objectToMarkdown(instagramData);

                // Query: Generate Gemini data vault details
                let geminiData = await generateDataVaultDetails(
                    null,
                    null,
                    { type: "instagram_url", instagram_data: instagramData }
                );
                let responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
                aiResponseData = responseDataVault;
            } else {
                let instagramOptions = {
                    instagram_details: {
                        posts: formattedPosts,
                        user_details: userDetails
                    },
                    user_prompt: CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
                    system_prompt: INSTAGRAM_CRAWL_SYSTEM_PROMPT
                };

                // Query: Generate social media presence data
                let aiData = await generateSocialMediaPresence(req, res, instagramOptions);
                let finalResponseData = aiData?.response || {};
                socialMediaAnalysis = finalResponseData?.socialMediaAnalysis || {};
                businessProfileData = finalResponseData?.businessProfileData || {};
                businessData = businessProfileData.businessInfo || "";
                aiResponseData = { businessInfo: businessData, ...socialMediaAnalysis };
            }

            // Attach top 3 posts if available
            if (top3Posts.length > 0) {
                aiResponseData['topPosts'] = top3Posts;
            }

            if (aiResponseData) {
                // Prepare complete Apify data for saving
                let completeApifyData = {
                    business_info: aiResponseData?.businessInfo || {},
                    audience_engagement: aiResponseData?.audienceEngagement || {},
                    posting_habits: aiResponseData?.postingHabits || {},
                    writing_style: aiResponseData?.writingStyle || {},
                    visual_content: aiResponseData?.visualContent || {},
                    recommendations: aiResponseData?.recommendations || {},
                    top_posts: (top3Posts.length > 0) ? top3Posts : [],
                    all_posts: (formattedPosts.length > 0) ? formattedPosts : []
                };

                // Query: Save bucket data and update user Instagram URL in parallel
                await Promise.all([
                    saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_APIFY_DATA,
                        parent_bucket: PARENT_BUCKET_APIFY_DATA,
                        data: completeApifyData
                    }),
                    users.updateOne(
                        { _id: newObjectIdDefault(userId) },
                        { $set: { instagram_url: instagramUrl, instagram_url_created: getUtcDate() } }
                    )
                ]);

                // Return success response
                return {
                    status: STATUS_SUCCESS,
                    website_url: websiteUrl,
                    apify_instagram_data: aiResponseData,
                    all_instagram_posts_from_apify: formattedPosts,
                    message: res.__("front.instagram.instagram_data_rediscover_successfully")
                };
            } else {
                // Return error if no AI data generated
                return {
                    status: STATUS_ERROR,
                    website_url: websiteUrl,
                    apify_instagram_data: {},
                    all_instagram_posts_from_apify: [],
                    message: res.__("front.global.no_record_found")
                };
            }
        } catch (error) {
            // Handle unexpected errors
            console.log(error);
            return {
                status: STATUS_ERROR,
                website_url: "",
                apify_instagram_data: {},
                all_instagram_posts_from_apify: [],
                message: res.__("front.system.something_going_wrong_please_try_again")
            };
        }
    };

    /**
     * Function used to crawl data from a URL and save in logs.
     * Handles all DB and async queries with async/await for cleaner and faster response.
     * @param {*} req  
     * @param {*} res 
     * @param {*} options
     * @returns {Promise<Object>} Result object with status and data/message.
     */
    crawlAndSaveRediscover = async (req, res, options) => {
        // Define collections
        const web_links = db.collection(TABLE_WEB_LINKS);

        // Extract and format input parameters
        const crawlUrl = options.url || "";
        const webId = options.web_id ? newObjectIdDefault(options.web_id) : "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";

        try {
            // Query: Get website text data (async/await)
            const crawlWebsiteData = await getWebsiteTextData({ website_url: crawlUrl });

            if (crawlWebsiteData.status === STATUS_SUCCESS) {
                // Extract crawl response data
                const crawlResponse = crawlWebsiteData.result || {};
                const data = crawlResponse.data || [];
                const socialMediaLinks = crawlResponse.socialMediaLinks || [];
                const emailAddresses = crawlResponse.emailAddresses || [];
                const contactNumbers = crawlResponse.contactNumbers || [];
                const linksArray = crawlResponse.linksArray || [];

                // Filter and process paragraphs
                const maxTokenLimit = 1000;
                const minWordCount = 2;
                const processedTexts = new Set();
                const filteredParagraphs = [];

                for (const paragraph of data) {
                    if (!processedTexts.has(paragraph) && paragraph.split(' ').length >= minWordCount) {
                        // If tokens exceed the maximum limit, split into sentences
                        if (paragraph.split(' ').length > maxTokenLimit) {
                            const sentences = paragraph.split('.');
                            for (const sentence of sentences) {
                                if (sentence.split(' ').length >= minWordCount && !sentence.startsWith('<iframe')) {
                                    filteredParagraphs.push(sentence);
                                }
                            }
                        } else {
                            if (!paragraph.startsWith('<iframe')) {
                                filteredParagraphs.push(paragraph);
                            }
                        }
                        processedTexts.add(paragraph);
                    }
                }

                // Helper: Fix sentence spacing
                function fixSentenceSpacing(text) {
                    // Replace multiple spaces with a single space
                    return text.split(' ').filter(word => word !== '').join(' ');
                }

                // Apply fixSentenceSpacing to filtered paragraphs
                const fixedParagraphs = filteredParagraphs.map(fixSentenceSpacing);

                // Append social/contact info if available
                if (socialMediaLinks.length > 0) fixedParagraphs.push(`Social media links : ${socialMediaLinks.join(', ')}`);
                if (emailAddresses.length > 0) fixedParagraphs.push(`Contact Emails : ${emailAddresses.join(', ')}`);
                if (contactNumbers.length > 0) fixedParagraphs.push(`Available contact numbers data : ${contactNumbers.join(', ')}`);

                const crawlData = fixedParagraphs;

                if (crawlData.length > 0) {
                    // Query: Extract domain links (async/await)
                    const otherPagesLinksArray = await extractDomainLinks(linksArray);

                    // Process child links
                    const childLinks = Array.isArray(otherPagesLinksArray.data?.urls)
                        ? changePageType(otherPagesLinksArray.data.urls)
                        : [];

                    // Query: Update child_links in web_links (async/await)
                    await web_links.updateOne(
                        { _id: webId, user_id: userId },
                        { $set: { child_links: childLinks } }
                    );

                    // Return success response
                    return { status: STATUS_SUCCESS, data: crawlData };
                } else {
                    // Return error if no crawl data found
                    return { status: STATUS_ERROR };
                }
            } else {
                // Return error if crawlWebsiteData failed
                return { status: STATUS_ERROR };
            }
        } catch (error) {
            // Handle unexpected errors
            return {
                status: STATUS_ERROR,
                message: `Failed to crawl and save data from "${crawlUrl}": ${error.message}`
            };
        }
    };

    /**
     * Function used to retrieve information from AI for rediscover.
     * Handles all DB queries with async/await and proper comments.
     * If any queries can be run in parallel, use Promise.
     * @param {Object} options 
     * @returns {Promise<Object>} JSON result
     */
    retrieveInformationRediscover = async (options) => {
        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

        try {
            // Prepare data context and parameters
            const dataContext = (options.data && options.data.length > 0) ? options.data : [];
            const paragraphs = dataContext.join("\n\n");
            const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
            const webInfoId = options.web_info_id ? newObjectIdDefault(options.web_info_id) : "";
            const websiteUrl = options.website_url || "";
            const businessName = options.business_name || "";
            const industryName = options.business_industry ? options.business_industry : "";
            const socialMediaPresence = options.social_media_presence ? options.social_media_presence : "";

            // If Gemini server is enabled, use Gemini for AI response
            if (GEMINI_SERVER_ENABLE === true) {
                // Generate Gemini response data (awaited)
                const geminiData = await generateDataVaultDetails(
                    null,
                    null,
                    { type: "website_url", paragraph: paragraphs }
                );
                const responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
                const responseOtherData = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.other_data : {};

                const instagramUrl = responseDataVault?.socialLinks?.instagram || "";

                // Update web_ai_info with new data (awaited)
                await web_ai_info.updateOne(
                    { _id: webInfoId, user_id: userId },
                    { $set: { website_url: websiteUrl, instagram_url: instagramUrl, data: responseDataVault } }
                );

                // Merge data for final response
                const data = { ...responseDataVault, ...responseOtherData };

                // Return success response
                return { status: STATUS_SUCCESS, result: data };
            } else {
                // Prepare system and user prompts for OpenAI
                const system = CRAWLING_DATA_SYSTEM_PROMPT;
                const user = CRAWLING_DATA_USER_PROMPT.replace(/{paragraphs}/g, paragraphs);

                try {
                    // Call OpenAI chat and await response
                    const result = await callOpenAIChat({ system, user, res_json: ACTIVE });
                    const response = result.response ? result.response : {};
                    let data = response;

                    // Add business info if available
                    if (businessName !== "" && industryName !== "") {
                        if (!data.businessInfo) data.businessInfo = {};
                        data.businessInfo.name = businessName;
                        data.businessCategories = industryName.includes(",")
                            ? industryName.split(",")
                            : [industryName];
                    }

                    const instagramUrl = data?.socialLinks?.instagram || "";

                    // Prepare web info data, optionally merging social media presence
                    let webInfoData = data;
                    if (socialMediaPresence) {
                        webInfoData = { ...data, social_media_presence: socialMediaPresence };
                    }

                    // Update web_ai_info with new data (awaited)
                    await web_ai_info.updateOne(
                        { _id: webInfoId, user_id: userId },
                        { $set: { website_url: websiteUrl, instagram_url: instagramUrl, data: webInfoData } }
                    );

                    // Return success response
                    return { status: STATUS_SUCCESS, result: data };
                } catch (e) {
                    // Handle OpenAI call error
                    return { status: STATUS_ERROR };
                }
            }
        } catch (error) {
            // Handle unexpected errors
            return { status: STATUS_ERROR };
        }
    }

    /**
     * Function used to check fallback process for rediscover crawl data.
     * All DB and async queries are awaited. If any queries can be run in parallel, use Promise.
     * Clean formatting and proper function comments.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object>} Result object with status and message.
     */
    fallbackProcessForRediscoverCrawlData = async (req, res, options) => {
        // Define collections
        const web_links = db.collection(TABLE_WEB_LINKS);
        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

        // Extract and format input parameters
        const websiteUrl = options.website_url || "";
        const userEmail = options.user_email || "";
        const userId = options.user_id || "";
        const customerId = options.customer_id || "";
        const initialWebLinkId = options.initial_web_link_id || "";
        const uniqueBrowserId = options.unique_browser_id || "";

        /**
         * Recursive function to attempt crawling the website.
         * Handles all DB and async queries with async/await.
         */
        const attemptCrawl = async () => {
            let finalData = {};
            let businessData = {};
            let urlData = {};

            // Step 1: Try to crawl website using Gemini server or fallback prompt
            if (GEMINI_SERVER_ENABLE === true) {
                // Await Gemini server fallback process
                urlData = await generateDataVaultFallbackProcess(req, res, { website_url: websiteUrl });
                const responseDataVault = (urlData.status === STATUS_SUCCESS) ? urlData?.response?.data_vault : {};
                const responseOtherData = (urlData.status === STATUS_SUCCESS) ? urlData?.response?.other_data : {};
                finalData = responseDataVault;
                businessData = { ...responseDataVault, ...responseOtherData };
            } else {
                // Await fallback prompt crawl
                const promptData = `${GET_WEBSITE_ADDRESS_PROMPT.replace(/{web_address}/g, websiteUrl).replace(/{zip_code}/g, "").replace(/{ai_card_details}/g, "")} ${GET_DATA_FROM_URL_FORMAT.replace(/{web_address}/g, websiteUrl)}`;
                urlData = await getWebsiteDataFromUrl(req, res, { system_prompt: ``, user_prompt: promptData });
                finalData = urlData.response || {};
                businessData = urlData.response || {};
            }

            // Step 2: If crawl is successful and data is valid, update DB
            if (urlData.status === STATUS_SUCCESS && typeof finalData === "object" && !("message" in finalData) && Object.keys(finalData).length > 0) {
                const webInfoData = finalData;
                const instagramUrl = webInfoData?.socialLinks?.instagram || "";

                // Prepare DB update queries
                let dbQueries = [];

                if (initialWebLinkId && uniqueBrowserId) {
                    // Insert web link and web info in parallel
                    dbQueries = [
                        insertWebLinkData({
                            _id: initialWebLinkId,
                            unique_browser_id: uniqueBrowserId,
                            user_id: newObjectIdDefault(userId),
                            website_url: websiteUrl,
                            email: userEmail
                        }),
                        insertWebInfoData({
                            web_id: initialWebLinkId,
                            instagram_url: instagramUrl,
                            unique_browser_id: uniqueBrowserId,
                            website_url: websiteUrl,
                            email: userEmail,
                            user_id: newObjectIdDefault(userId),
                            data: finalData
                        })
                    ];
                } else {
                    // Update web_links and web_ai_info in parallel
                    dbQueries = [
                        web_links.updateOne(
                            { user_id: userId },
                            { $set: { link: websiteUrl, user_email: userEmail } }
                        ),
                        web_ai_info.updateOne(
                            { user_id: userId },
                            { $set: { website_url: websiteUrl, instagram_url: instagramUrl, user_email: userEmail, data: webInfoData } }
                        )
                    ];
                }

                // Await all DB queries in parallel
                await Promise.all(dbQueries);

                // Step 3: Save AI data structure logs if available
                if (Object.keys(webInfoData).length > 0) {
                    const bucketData = {
                        business_info: webInfoData?.businessInfo || {},
                        business_categories: webInfoData?.businessCategories || [],
                        key_products: webInfoData?.keyProducts || [],
                        home_services: webInfoData?.services || [],
                        social_links: webInfoData?.socialLinks || {},
                        contact_info: webInfoData?.contactInfo || {},
                        menu: webInfoData?.Menu || "",
                        about: webInfoData?.About || "",
                    };
                    await saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                        parent_bucket: DATA_BUCKET_ABOUT_BUSINESS,
                        data: bucketData
                    });
                }

                // Step 4: Update public business information if businessData exists
                if (businessData && Object.keys(businessData).length > 0) {
                    await updatePublicInformationAccordingToWebsite(req, res, {
                        user_id: userId,
                        website_data: businessData
                    });
                }

                // Step 5: Update data vault asynchronously (non-blocking)
                setImmediate(async () => {
                    await updateDataVault(req, res, {
                        unique_browser_id: uniqueBrowserId,
                        user_id: userId
                    });
                });

                // Return success response
                return {
                    status: STATUS_SUCCESS,
                    message: res.__("front.website_crawler.your_website_has_been_crawled_successfully")
                };
            }

            // Step 6: If crawl failed with 'message', retry recursively
            if ("message" in finalData) {
                return attemptCrawl();
            }

            // Step 7: Failure case, crawling failed
            return {
                status: STATUS_ERROR,
                message: res.__("front.website_crawler.given_url_not_crawlable")
            };
        };

        // Start the initial crawl attempt and return the result
        return await attemptCrawl();
    };

    /**
     * Function is used to update social media presence data for rediscover.
     * Uses async/await for all database and API operations.
     * Handles all queries in sequence for clarity and reliability.
     * @param {*} req 
     * @param {*} res 
     * @param {*} userOptions 
     * @returns {Promise<Object>} Result object with status, social_media_presence, all_instagram_posts, and message.
     */
    updateSocialMediaPresenceRediscover = async (req, res, userOptions) => {
        let userId = userOptions.user_id ? newObjectIdDefault(userOptions.user_id) : "";
        let instagramUserId = userOptions.instagram_user_id ? userOptions.instagram_user_id : "";
        let longLivedAccessToken = userOptions.long_lived_access_token ? userOptions.long_lived_access_token : "";

        // --- Validate required parameters ---
        if (!userId || !instagramUserId || !longLivedAccessToken) {
            return;
        }

        try {
            // --- Fetch business info from web_ai_info collection ---
            const webInfoData = await web_ai_info.findOne({ user_id: userId });
            let businessData = {};
            if (webInfoData?.data) {
                businessData = webInfoData.data.businessInfo || {};
            } else if (webInfoData?.apify_instagram_data) {
                businessData = webInfoData.apify_instagram_data.businessInfo || {};
            }

            // --- Fetch Instagram user profile and media using Instagram Graph API ---
            const userResponse = await axios.get(`https://graph.instagram.com/${instagramUserId}`, {
                params: {
                    fields: 'id,username,biography,followers_count,follows_count,profile_picture_url,media{id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count}',
                    access_token: longLivedAccessToken
                }
            });

            const userResponseData = userResponse?.data || {};
            let userMediaRes = userResponseData?.media?.data || [];
            delete userResponseData.media;

            // --- If user has Instagram posts, process them ---
            if (userMediaRes.length > 0) {
                // --- Calculate top 3 posts by engagement ---
                const top3Posts = userMediaRes.map(({ caption, timestamp, media_type, media_url, like_count, comments_count }) => ({
                    caption,
                    timestamp,
                    mediaType: media_type,
                    mediaUrl: media_url,
                    likeCount: like_count,
                    commentCount: comments_count,
                    totalEngagement: (like_count || 0) + (comments_count || 0),
                })).sort((a, b) => b.totalEngagement - a.totalEngagement).slice(0, 3);

                let socialMediaAnalysis = {};

                // --- Generate social media analysis using Gemini or fallback AI ---
                if (GEMINI_SERVER_ENABLE === true) {
                    // --- Prepare data for Gemini server ---
                    let instagramData = {
                        user_details: userResponseData,
                        posts: userMediaRes,
                    };
                    instagramData = objectToMarkdown(instagramData);

                    // --- Generate Gemini response data ---
                    const geminiData = await generateDataVaultDetails(null, null, { type: "instagram_url", instagram_data: instagramData });

                    socialMediaAnalysis = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault || {} : {};

                } else {
                    // --- Prepare options for fallback AI ---
                    const instagramOptions = {
                        instagram_details: {
                            posts: userMediaRes,
                            user_details: userResponseData
                        },
                        user_prompt: CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
                        system_prompt: INSTAGRAM_AFTER_LOGIN_CRAWL_SYSTEM_PROMPT
                    };

                    // --- Generate social media presence data using fallback AI ---
                    const aiData = await generateSocialMediaPresence(req, res, instagramOptions);
                    const finalResponseData = aiData?.response || {};
                    socialMediaAnalysis = finalResponseData?.socialMediaAnalysis || {};
                }

                // --- Attach top 3 posts and business info if available ---
                if (top3Posts.length > 0) {
                    socialMediaAnalysis.topPosts = top3Posts;
                }
                if (Object.keys(businessData).length > 0) {
                    socialMediaAnalysis.businessInfo = businessData;
                }

                // --- Save AI data structure for Social Media Presence ---
                if (Object.keys(socialMediaAnalysis).length > 0) {
                    const completeSocialData = {
                        business_info: socialMediaAnalysis?.businessInfo || {},
                        audience_engagement: socialMediaAnalysis?.audienceEngagement || {},
                        posting_habits: socialMediaAnalysis?.postingHabits || {},
                        writing_style: socialMediaAnalysis?.writingStyle || {},
                        visual_content: socialMediaAnalysis?.visualContent || {},
                        recommendations: socialMediaAnalysis?.recommendations || {},
                        top_posts: socialMediaAnalysis?.topPosts || [],
                        all_posts: userMediaRes
                    };
                    await saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_SOCIAL_PRESENCE,
                        parent_bucket: PARENT_BUCKET_SOCIAL_PRESENCE,
                        data: completeSocialData
                    });
                }

                // --- Return success response ---
                return {
                    status: STATUS_SUCCESS,
                    social_media_presence: socialMediaAnalysis,
                    all_instagram_posts: userMediaRes,
                    message: res.__("front.instagram.social_media_presence_rediscover_successfully")
                };
            } else {
                // --- No posts found on Instagram account ---
                return {
                    status: STATUS_ERROR,
                    social_media_presence: {},
                    all_instagram_posts: [],
                    message: res.__("front.instagram.no_posts_on_instagram_account")
                };
            }
        } catch (error) {
            // --- Handle unexpected errors ---
            console.log(error);
            return {
                status: STATUS_ERROR,
                social_media_presence: {},
                all_instagram_posts: [],
                message: res.__("front.system.something_going_wrong_please_try_again")
            };
        }
    };

    /**
     * Function used to crawl data by document for rediscover.
     * Handles all DB and async queries using async/await for clean and modern code.
     * If any queries can be run in parallel, uses Promise.all for efficiency.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object>} Result object with status and message.
     */
    crawlDataByDocForRediscover = async (req, res, options) => {
        // Extract and format input parameters
        const businessName = options.business_name || "";
        const industryName = options.business_industry || "";
        const zipCode = options.zip_code || "";
        const websiteUrl = options.website_url || "";
        const userEmail = options.user_email || "";
        const userId = options.user_id || "";
        const customerId = options.customer_id || "";
        const initialWebLinkId = options.initial_web_link_id || "";
        const uniqueBrowserId = options.unique_browser_id || "";

        try {
            // Query: Get all uploaded documents for the user (async/await)
            const getDocument = await aiAboutDocument.find(
                { user_id: userId },
                { projection: { _id: 0, upload_file: 1, file_extension: 1 } }
            ).toArray();

            if (getDocument.length === 0) {
                // No document found, return error response
                return {
                    status: STATUS_ERROR,
                    message: res.__("front.website_crawler.document_not_found_please_upload_document_first_for_rediscover_details")
                };
            }

            // Extract text from all valid documents in series (could be parallel if needed)
            let docData = "";
            for (const recordData of getDocument) {
                const uploadDocName = recordData.upload_file || "";
                const fileExtension = recordData.file_extension || "";
                if (uploadDocName && fileExtension) {
                    try {
                        // Query: Extract text from document (async/await)
                        const extractedData = await extractTextFromDocumentWithUrl({ file_name: uploadDocName });
                        const wordExtractedText = extractedData?.extracted_text || "";
                        docData += wordExtractedText;
                    } catch (err) {
                        // Log error but continue processing other documents
                        console.error("Error in extractTextFromDocumentWithUrl:", err);
                    }
                }
            }

            // Prepare information strings for prompt
            const information = `Business Name:-${businessName}; Industry:-${industryName}; Additional Information:-${docData}`;
            const informationFormat = `Business Name:-${businessName}; Industry:-${industryName};`;

            /**
             * Recursive function to fetch website data with retry logic.
             * Handles all DB and async queries with async/await.
             */
            const fetchWebsiteData = async (retryCount = 0) => {
                try {
                    let finalData = {};
                    let businessData = {};
                    let urlData = {};

                    if (GEMINI_SERVER_ENABLE === true) {
                        // Query: Call Gemini server fallback process (async/await)
                        const geminiOptions = {
                            website_url: websiteUrl,
                            business_name: businessName,
                            industry: industryName,
                            zipcode: zipCode,
                            information: docData
                        };
                        urlData = await generateDataVaultFallbackProcess(req, res, geminiOptions);
                        const responseDataVault = (urlData.status === STATUS_SUCCESS) ? urlData?.response?.data_vault : {};
                        const responseOtherData = (urlData.status === STATUS_SUCCESS) ? urlData?.response?.other_data : {};
                        finalData = responseDataVault;
                        businessData = { ...responseDataVault, ...responseOtherData };
                    } else {
                        // Query: Call fallback prompt crawl (async/await)
                        const promptData =
                            GET_WEBSITE_INFORMATION_PROMPT.replace(/{information}/g, information)
                                .replace(/{business_name}/g, businessName)
                                .replace(/{zip_code}/g, zipCode)
                                .replace(/{industry}/g, industryName)
                            + " " +
                            GET_DATA_FROM_INFORMATION_FORMAT.replace(/{business_name}/g, businessName)
                                .replace(/{zip_code}/g, zipCode)
                                .replace(/{industry}/g, industryName)
                                .replace(/{information}/g, informationFormat);

                        urlData = await getWebsiteDataFromUrl(req, res, { system_prompt: "", user_prompt: promptData });
                        finalData = urlData.response || {};
                        businessData = urlData.response || {};
                    }

                    // Check if finalData is valid
                    if (urlData.status === STATUS_SUCCESS && typeof finalData === "object") {
                        if (!("message" in finalData) && !("error" in finalData) && !("response" in finalData)) {
                            return { finalData, businessData };
                        } else if ("error" in finalData) {
                            return null;
                        }
                    }

                    // Retry if under maxRetries
                    if (retryCount < maxRetries) {
                        return await fetchWebsiteData(retryCount + 1);
                    } else {
                        return null;
                    }
                } catch (error) {
                    // Retry on unexpected errors
                    if (retryCount < maxRetries) {
                        return await fetchWebsiteData(retryCount + 1);
                    } else {
                        return null;
                    }
                }
            };

            // Get the final data with retry mechanism
            const fetchResult = await fetchWebsiteData();
            const finalData = fetchResult?.finalData || null;
            const businessData = fetchResult?.businessData || null;

            if (finalData) {
                // Prepare DB update queries
                let dbQueries = [];

                if (initialWebLinkId && uniqueBrowserId) {
                    // Insert generated URLs in collections (run in parallel)
                    dbQueries = [
                        insertWebLinkData({
                            _id: initialWebLinkId,
                            unique_browser_id: uniqueBrowserId,
                            user_id: newObjectIdDefault(userId),
                            website_url: websiteUrl,
                            email: userEmail
                        }),
                        insertWebInfoData({
                            web_id: initialWebLinkId,
                            unique_browser_id: uniqueBrowserId,
                            website_url: websiteUrl,
                            email: userEmail,
                            user_id: newObjectIdDefault(userId),
                            data: finalData
                        })
                    ];
                } else {
                    // Update web_links and web_ai_info collections (run in parallel)
                    dbQueries = [
                        web_links.updateOne(
                            { user_id: userId },
                            { $set: { link: websiteUrl, user_email: userEmail } }
                        ),
                        web_ai_info.updateOne(
                            { user_id: userId },
                            { $set: { website_url: websiteUrl, user_email: userEmail, data: finalData } }
                        )
                    ];
                }

                // Run DB queries in parallel
                await Promise.all(dbQueries);

                // Mark website as not crawlable
                finalData["website_crawlable"] = false;

                // Update public information according to website if businessData exists
                if (businessData) {
                    await updatePublicInformationAccordingToWebsite(req, res, {
                        user_id: userId,
                        website_data: businessData
                    });
                }

                // Save AI data structure in collection if data exists
                if (Object.keys(finalData).length > 0) {
                    const bucketData = {
                        business_info: finalData?.businessInfo || {},
                        business_categories: finalData?.businessCategories || [],
                        key_products: finalData?.keyProducts || [],
                        home_services: finalData?.services || [],
                        social_links: finalData?.socialLinks || {},
                        contact_info: finalData?.contactInfo || {},
                        menu: finalData?.Menu || "",
                        about: finalData?.About || "",
                    };
                    await saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                        parent_bucket: DATA_BUCKET_ABOUT_BUSINESS,
                        data: bucketData
                    });
                }

                // Return success response
                return {
                    status: STATUS_SUCCESS,
                    message: res.__("front.website_crawler.your_website_has_been_crawled_successfully")
                };
            } else {
                // Return error if crawl failed
                return {
                    status: STATUS_ERROR,
                    message: res.__("front.website_crawler.given_url_not_crawlable")
                };
            }
        } catch (error) {
            // Handle unexpected errors
            return {
                status: STATUS_ERROR,
                message: res.__("front.website_crawler.given_url_not_crawlable")
            };
        }
    };

    /**
     * Function used to update user public business information according to their website.
     * Uses async/await for all database and API operations.
     * @param {*} req 
     * @param {*} res 
     * @param {*} options 
     * @returns {Promise<Object|void>} Returns error object if userId is missing, otherwise resolves after saving.
     */
    updatePublicInformationAccordingToWebsite = async (req, res, options) => {
        // Extract userId and website data from options
        const userId = options.user_id ? options.user_id : "";
        const websiteAllData = options.website_data ? options.website_data : "";

        // Validate required parameter
        if (!userId) {
            // Return error response if userId is missing
            return {
                status: STATUS_ERROR,
                message: res.__("front.system.something_going_wrong_please_try_again"),
            };
        }

        // Extract and format all relevant fields from website data
        const websiteUrl = websiteAllData.website_url || "";
        const businessInfo = websiteAllData.businessInfo || {};
        const contactInfo = websiteAllData.contactInfo || {};
        const phoneNumberStr = (contactInfo.phoneNumbers && contactInfo.phoneNumbers.length > 0) ? contactInfo.phoneNumbers[0] : "";
        const businessName = businessInfo.name || "";
        const businessLocation = businessInfo.location || "";
        const description = businessInfo.description || "";
        const address = (contactInfo.addresses && contactInfo.addresses.length > 0) ? contactInfo.addresses[0] : businessLocation;
        const preferredOffering = websiteAllData.offerDiscounts || "";
        const ctaText = websiteAllData.ctaText || "";
        const targetAudience = websiteAllData.targetAudience || "";
        const uniqueSelling = websiteAllData.uniqueSellingProposition || "";
        const specificProduct = (websiteAllData.keyProducts && websiteAllData.keyProducts.length > 0) ? websiteAllData.keyProducts.join(", ") : "";
        const keyFeatures = (websiteAllData.services && websiteAllData.services.length > 0) ? websiteAllData.services.join(", ") : "";
        const zipCode = websiteAllData.zipCode || "";
        const firstKeyword = (websiteAllData.seoKeywords && websiteAllData.seoKeywords.length > 0) ? websiteAllData.seoKeywords[0] : "";
        const secondKeyword = (websiteAllData.seoKeywords && websiteAllData.seoKeywords.length > 1) ? websiteAllData.seoKeywords[1] : "";
        const aiBusinessIndustry = (websiteAllData.businessCategories && websiteAllData.businessCategories.length) ? websiteAllData.businessCategories.toString() : [];
        const primaryGoal = websiteAllData.primaryGoal || "";
        const websiteTone = websiteAllData.toneOfSite || "";
        const phoneNumberData = (phoneNumberStr.length > 4) ? extractNumbers(phoneNumberStr) : "";
        const formattedPhoneNumberValue = phoneNumberData ? phoneNumberData.replace(/(\d{3})(\d{1,3})(\d{1,4})/, '$1-$2-$3') : "";
        const websiteCrawlable = websiteAllData.website_crawlable || false;

        // Prepare request body for saving public business user details
        req.body.zip = zipCode;
        req.body.mobile = formattedPhoneNumberValue;
        req.body.name_of_the_business = businessName;
        req.body.preferred_offering_or_discount = preferredOffering;
        req.body.target_audience = targetAudience;
        req.body.unique_selling_proposition = uniqueSelling;
        req.body.specific_product_or_service = specificProduct;
        req.body.benefits_product_or_service = keyFeatures;
        req.body.call_to_action = ctaText;
        req.body.populate_key_phrase_first = firstKeyword;
        req.body.populate_key_phrase_second = secondKeyword;
        req.body.core_information_tab_filled = true;
        req.body.campaign_overview_tab_filled = true;
        req.body.campaign_detail_tab_filled = true;
        req.body.ai_business_industry_names = aiBusinessIndustry;
        req.body.main_goal_of_your_email_campaign_name = primaryGoal;
        req.body.tone_or_style_email_name = websiteTone;
        req.body.from_homepage_ai_user = true;
        req.body.primary_address = address;
        req.body.description = description;
        req.body.additional_information = "";
        req.body.website_crawlable = websiteCrawlable;

        if (websiteUrl) {
            req.body.website_url = websiteUrl;
        }

        // Save public business user details using async/await
        // This is a single async operation, not run in parallel
        await savePublicBussinessUserDetails(req, res, userId);

        // No explicit return needed for success, function completes after save
    }; // End updatePublicInformationAccordingToWebsite

}
module.exports = new webCrawl();