
const apifyToken = APIFY_TOKEN;
function InstagramCrawl() {

    /**
     * Function used to crawl basic Instagram profile data using async/await.
     * Ensures fast response and clean error handling.
     * @param {*} req 
     * @param {*} res 
     */
    this.crawlInstagramDataBasic = async (req, res) => {
        let finalResponse = {};
        let instagramUrl = req.body.instagram_url || "";

        // Validate Instagram URL
        if (!instagramUrl) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Extract username from Instagram URL
        const username = instagramUrl.replace("https://www.instagram.com/", "").replace("/", "");

        // Prepare request options for Apify Instagram profile scraper
        const profileOptions = {
            method: 'POST',
            url: `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username] })
        };

        try {
            // Run the Instagram profile request using async/await
            const profile = await makeInstagramRequest(profileOptions);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    profile: profile,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Log and handle errors gracefully
            console.log(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    profile: [],
                    message: res.__("front.instagram.failed_to_fetch_instagram_data"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

    /**
     * Function used to crawl Instagram data.
     * Fetches both profile and latest posts in parallel using async/await and Promise.all for faster response.
     * @param {*} req 
     * @param {*} res 
     */
    this.crawlInstagramData = async (req, res) => {
        let finalResponse = {};
        let instagramUrl = req.body.instagram_url || "";

        // Validate Instagram URL
        if (!instagramUrl) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Extract username from Instagram URL
        const username = instagramUrl.replace("https://www.instagram.com/", "").replace("/", "");

        // Prepare request options for Apify Instagram profile and post scrapers
        const profileOptions = {
            method: 'POST',
            url: `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username] })
        };

        const postOptions = {
            method: 'POST',
            url: `https://api.apify.com/v2/acts/apify~instagram-post-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: [username],
                resultsLimit: 10
            })
        };

        try {
            // Run both profile and post requests in parallel for efficiency
            const [profileRes, postRes] = await Promise.all([
                makeInstagramRequest(profileOptions),
                makeInstagramRequest(postOptions)
            ]);

            // Remove latestPosts from the first profile item if present
            if (profileRes && profileRes.length > 0) {
                delete profileRes[0].latestPosts;
            }

            // Send success response with both profile and latest posts
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    profile: profileRes,
                    latest_posts: postRes,
                    message: "",
                }
            };
        } catch (err) {
            // Log and handle errors gracefully
            console.log(err);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    profile: [],
                    latest_posts: [],
                    message: res.__("front.instagram.failed_to_fetch_instagram_data"),
                }
            };
        }

        return returnApiResult(req, res, finalResponse);
    };

    /**
     * Function used to crawl Instagram data for onboarding.
     * Handles all DB and image upload operations using async/await and runs parallel queries for efficiency.
     * @param {*} req 
     * @param {*} res 
     */
    this.crawlInstagramDataForOnboarding = async (req, res) => {
        let finalResponse = {};
        let instagramUrl = req.body.instagram_url || "";
        let uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
        let ipAddr = req.body.ip ? req.body.ip : "";

        const tableLibraryLogs = db.collection(TABLE_CONTENT_LIBRARY_LOGS);
        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

        instagramUrl = formatInstagramUrl(instagramUrl);

        // Validate required fields
        if (!instagramUrl || !uniqueBrowserId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Validate Instagram URL format
        if (!instagramUrl.includes("instagram.com")) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.instagram.invalid_instagram_url"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        const username = instagramUrl.replace("https://www.instagram.com/", "").replace("/", "");

        const profileOptions = {
            method: 'POST',
            url: `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username] })
        };

        try {
            // Fetch Instagram profile data
            const profile = await makeInstagramRequest(profileOptions);

            const instagramProfileDetails = profile[0] || "";
            let websiteUrl = instagramProfileDetails.externalUrl || "";
            let domain = websiteUrl ? new URL(websiteUrl).hostname.replace(/^www\./, '') : "";
            let websiteDomain = domain ? ensureHttpPrefix(domain) : "";
            let protocolSite = websiteDomain ? await checkProtocol(websiteDomain) : "";
            websiteUrl = protocolSite ? protocolSite : websiteDomain;

            if (instagramProfileDetails && instagramProfileDetails.error) {
                // Handle error in Instagram profile details
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.instagram.failed_to_fetch_instagram_data"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let formattedPosts = [];
            let top3Posts = [];
            let mediaUrls = [];

            // Process latest posts if available
            if (Array.isArray(instagramProfileDetails.latestPosts) && instagramProfileDetails.latestPosts.length > 0) {
                const filteredPosts = instagramProfileDetails.latestPosts.filter(
                    post => post.type === "Image" || post.type === "Video"
                );

                mediaUrls = filteredPosts.map(record => record.videoUrl || record.displayUrl || "");

                // Download images/videos in parallel and format posts
                formattedPosts = await Promise.all(filteredPosts.map(async (post) => {
                    let mediaUrl = "";

                    if (post.type === "Image") {
                        const optionsImage = {
                            url: post.displayUrl,
                            dest: INSTAGRAM_CRAWL_IMAGES_FILE_PATH,
                        };
                        const imageResponse = await downloadImageToUrl(res, req, optionsImage);
                        mediaUrl = (imageResponse.status === STATUS_SUCCESS && imageResponse.fileName) ? imageResponse.fileName : "";
                    }

                    if (post.type === "Video") {
                        const optionsVideo = {
                            url: post.videoUrl,
                            dest: INSTAGRAM_CRAWL_IMAGES_FILE_PATH,
                        };
                        const videoResponse = await downloadVideoToUrl(res, req, optionsVideo);
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

            // Prepare Instagram user details
            const userDetails = {
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
            let businessInfoData = "";

            // Generate AI analysis using Gemini or fallback
            if (GEMINI_SERVER_ENABLE === true) {
                let instagramData = {
                    user_details: userDetails,
                    posts: formattedPosts,
                };

                instagramData = objectToMarkdown(instagramData);

                // Generate Gemini response data
                const geminiData = await generateDataVaultDetails(null, null, {
                    type: "instagram_url",
                    instagram_data: instagramData
                });

                const responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
                const responseOtherData = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.other_data : {};

                aiResponseData = responseDataVault;

                if (top3Posts.length > 0) {
                    aiResponseData['topPosts'] = top3Posts;
                }

                const businessData = responseDataVault?.businessInfo || "";
                businessInfoData = { businessInfo: businessData, ...responseOtherData };
            } else {
                const instagramOptions = {
                    instagram_details: {
                        posts: formattedPosts,
                        user_details: userDetails
                    },
                    user_prompt: CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
                    system_prompt: INSTAGRAM_CRAWL_SYSTEM_PROMPT
                };

                // Generate AI data for Instagram using fallback
                const aiData = await generateSocialMediaPresence(req, res, instagramOptions);
                const finalResponseData = aiData?.response || {};

                socialMediaAnalysis = finalResponseData.socialMediaAnalysis;
                businessProfileData = finalResponseData.businessProfileData;

                if (top3Posts.length > 0) {
                    socialMediaAnalysis['topPosts'] = top3Posts;
                }

                const businessData = businessProfileData.businessInfo || "";
                aiResponseData = { businessInfo: businessData, ...socialMediaAnalysis };
                businessInfoData = { ...businessProfileData };
            }

            const initialWebLinkId = newObjectIdDefault();

            // Prepare web info object for DB insert
            const insertWebinfo = {
                web_id: initialWebLinkId,
                unique_browser_id: uniqueBrowserId,
                website_url: websiteUrl,
                instagram_url: instagramUrl,
                user_email: "",
                user_id: "",
                data: {},
                social_media_presence: {},
                apify_instagram_data: aiResponseData,
                all_instagram_posts_from_apify: formattedPosts,
                all_instagram_posts: [],
                created: getUtcDate(),
                modified: getUtcDate()
            };

            // Run DB insert, image upload, and web link update in parallel for faster response
            await Promise.all([
                insertWebLinkData({ _id: initialWebLinkId, unique_browser_id: uniqueBrowserId, is_instagram_crawled: true }),
                instagramImageUploadOnUgcGallery(req, res, { unique_browser_id: uniqueBrowserId, media_urls: mediaUrls }),
                web_ai_info.insertOne(insertWebinfo)
            ]);

            try {
                // Generate social post content using AI
                const aiSocialPostContent = await generateFirstSocialPostWithImage(req, res, {
                    business_information: aiResponseData,
                    unique_browser_id: uniqueBrowserId,
                    instagram_url: instagramUrl,
                });
                const socialPostResponse = (aiSocialPostContent.status === STATUS_SUCCESS) ? aiSocialPostContent.result : "";

                if (aiSocialPostContent.status === STATUS_SUCCESS && socialPostResponse !== "") {
                    const aiContentData = [{ social_media: socialPostResponse }];

                    businessInfoData = {
                        ...businessInfoData,
                        website_url: websiteUrl,
                        instagram_url: instagramUrl,
                        web_id: initialWebLinkId,
                        website_crawlable: aiSocialPostContent.website_image_crawl,
                        website_image_crawlable: aiSocialPostContent.website_image_crawl,
                        long_lived_access_token: "",
                        instagram_user_details: userDetails,
                        scrape_with_instagram: true
                    };

                    // Upsert log data in DB (async/await for query)
                    await tableLibraryLogs.findOneAndUpdate(
                        { unique_ai_browser_id: uniqueBrowserId },
                        {
                            $set: {
                                zip_code: DEFAULT_USER_ZIP,
                                modified: getUtcDate(),
                                ai_content: aiContentData,
                                website_data: businessInfoData
                            },
                            $setOnInsert: {
                                ip_addr: ipAddr,
                                unique_ai_browser_id: uniqueBrowserId,
                                created: getUtcDate()
                            }
                        },
                        { upsert: true }
                    );

                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: [{ social_media: { content: socialPostResponse } }],
                            message: "",
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    // Handle AI content generation error
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: [],
                            message: res.__("front.system.something_going_wrong_please_try_again")
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } catch (error) {
                // Handle error in AI content generation or DB update
                console.log(error);
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.instagram.failed_to_fetch_instagram_data"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle any unexpected errors in the main flow
            console.log(err);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.instagram.failed_to_fetch_instagram_data"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

}
module.exports = new InstagramCrawl();