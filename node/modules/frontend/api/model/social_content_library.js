const { createClient } = require('pexels');
const asyncParallel = require('async/parallel');
const async = require('async');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { Console } = require('console');
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});

const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
const multipleUserGroup = db.collection(TABLE_MULTIPLE_USER_GROUPS);
const users = db.collection(TABLE_USERS);

function SocialContentLibrary() {

    /**
     * Function used to create social post manually
     * Handles all DB queries using async/await and Promise for parallel operations.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.createSocialPostManually = async (req, res) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let socialPostTitle = req.body.title || "";
        let socialPostCaption = req.body.caption || "";
        let videoFileName = req.body?.video_file_name || "";
        let videoFileNameFacebook = req.body?.video_file_name_facebook || "";
        let groupId = req.body?.group_id ? newObjectIdDefault(req.body.group_id) : "";
        let groupUserSlug = "";
        let groupRefKey = "";

        let socialType = req.body.type || AI_RESPONSE_TYPE_SOCIAL_MEDIA;
        let isManually = req.body.is_manual ? JSON.parse(req.body.is_manual) : false;
        let campaignName = (socialType == AI_RESPONSE_TYPE_SOCIAL_MEDIA) ? "Social Post" : "Social Story";

        let aiSocialImage = req.files?.ai_social_image || "";
        let aiSocialImageFacebook = req.files?.ai_social_image_facebook || "";

        // Post on facebook or instagram keys
        let postOnInstagram = req.body.post_on_instagram ? JSON.parse(req.body.post_on_instagram) : false;
        let postOnFacebook = req.body.post_on_facebook ? JSON.parse(req.body.post_on_facebook) : false;

        // Used for auto schedule post
        let instagramLongLivedAccessToken = loginUserData.long_lived_access_token || "";
        let instagramUrl = loginUserData.instagram_url || "";
        let autoSchedule = loginUserData.auto_schedule || "";

        // Check for missing parameters
        if (!userId) {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Check plan limits for social post creation
        let postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_SOCIAL_TYPE);
        if (socialType == AI_RESPONSE_TYPE_SOCIAL_MEDIA && isManually == false && postLimitData.status == NOT_ALLOW_CREATE_DATA) {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.social_post_limnt.post_limit_reached_upgrade_your_plan_to_post_more"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        let uniqueKey = generateRandomID(8);
        let imageArray = [];
        let facebookImageArray = [];

        // Prepare options for image upload
        let optionsAiSocial = {
            'image': aiSocialImage,
            'manually_mention_image_name': socialPostTitle,
            'ai_social_image_submit': true,
            'filePath': AI_SOCIAL_IMAGES_FILE_PATH,
            'allowedExtensions': ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
            'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
            'allowedMimeTypes': ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
            'allowedMimeError': ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
            'allowedSizeErrorMessage': ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
            'size': MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
        };
        let optionsAiSocialFacebook = {
            'image': aiSocialImageFacebook,
            'ai_social_image_submit': true,
            'filePath': AI_SOCIAL_IMAGES_FILE_PATH,
            'allowedExtensions': ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
            'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
            'allowedMimeTypes': ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
            'allowedMimeError': ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
            'allowedSizeErrorMessage': ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
            'size': MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
        };

        // Upload both facebook and instagram images in parallel
        let [responseAiSocial, responseAiSocialFacebook] = await Promise.all([
            moveUploadedFile(req, res, optionsAiSocial),
            moveUploadedFile(req, res, optionsAiSocialFacebook),
        ]);

        // Handle Instagram image/video upload result
        if (responseAiSocial && responseAiSocial.status == STATUS_SUCCESS) {
            let imageName = responseAiSocial.fileName || "";
            let imageExtension = responseAiSocial.image_extension || "";

            if (imageName && imageExtension) {
                if (imageExtension == 'mp4' || imageExtension == 'mov') {
                    // Convert video for Instagram
                    const randomNumber = Math.floor(10 + Math.random() * 90);
                    let updatedFilePath = "";
                    if (imageExtension == 'mp4') {
                        updatedFilePath = imageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                    }
                    if (imageExtension == 'mov') {
                        updatedFilePath = imageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                    }
                    await convertVideoToFFmpegForInstagram({
                        'videoURL': (UPLOAD_TO_S3) ? AI_SOCIAL_IMAGES_URL + imageName : AI_SOCIAL_IMAGES_FILE_PATH + imageName,
                        'outputPath': AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                        'targetFolder': 'ai_social_images/' + updatedFilePath
                    });
                    imageArray.push({ "_id": newObjectIdDefault(), "name": updatedFilePath, "extension": imageExtension, 'post_on_instagram': postOnInstagram });
                } else {
                    // Resize Instagram post image
                    let optiondata = {
                        'image': aiSocialImage,
                        'image_name': imageName,
                        'type': socialType
                    }
                    await resizeImageForSocialPostImage(req, res, optiondata);
                    imageArray.push({ "_id": newObjectIdDefault(), "name": imageName, "extension": imageExtension, 'post_on_instagram': postOnInstagram });
                }
            }
        }

        // Handle Facebook image/video upload result
        if (responseAiSocialFacebook && responseAiSocialFacebook.status == STATUS_SUCCESS) {
            let facebookImageName = responseAiSocialFacebook.fileName || "";
            let facebookImageExtension = responseAiSocialFacebook.image_extension || "";

            if (facebookImageName && facebookImageExtension) {
                if (facebookImageExtension == 'mp4' || facebookImageExtension == 'mov') {
                    // Convert video for Facebook
                    const randomNumber = Math.floor(10 + Math.random() * 90);
                    let updatedFacebookFilePath = "";
                    if (facebookImageExtension == 'mp4') {
                        updatedFacebookFilePath = facebookImageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                    }
                    if (facebookImageExtension == 'mov') {
                        updatedFacebookFilePath = facebookImageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                    }
                    await convertVideoToFFmpegForFacebook({
                        'videoURL': (UPLOAD_TO_S3) ? AI_SOCIAL_IMAGES_URL + facebookImageName : AI_SOCIAL_IMAGES_FILE_PATH + facebookImageName,
                        'outputPath': AI_SOCIAL_IMAGES_FILE_PATH + updatedFacebookFilePath,
                        'targetFolder': 'ai_social_images/' + updatedFacebookFilePath
                    });
                    facebookImageArray.push({ "_id": newObjectIdDefault(), "name": updatedFacebookFilePath, "extension": facebookImageExtension, 'post_on_facebook': postOnFacebook });
                } else {
                    // Resize Facebook post image
                    let optionFacebookdata = {
                        'image': aiSocialImageFacebook,
                        'image_name': facebookImageName,
                    }
                    await resizeImageForFacebookPostImage(req, res, optionFacebookdata);
                    facebookImageArray.push({ "_id": newObjectIdDefault(), "name": facebookImageName, "extension": facebookImageExtension, 'post_on_facebook': postOnFacebook });
                }
            }
        }

        // Handle uploading videos directly from UGC Gallery for Instagram
        if (videoFileName != "") {
            let randomNumber = Math.floor(10 + Math.random() * 90);
            let fileExtension = path.extname(videoFileName).toLowerCase();
            let updatedFilePath = "";

            if (fileExtension == '.mp4') {
                updatedFilePath = videoFileName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
            }
            if (fileExtension == '.mov') {
                updatedFilePath = videoFileName.replace(/\.mov$/, `-${randomNumber}.mov`);
            }

            await convertVideoToFFmpegForInstagram({
                'videoURL': (UPLOAD_TO_S3) ? UGC_GALLERY_FILE_URL + videoFileName : UGC_GALLERY_FILE_PATH + videoFileName,
                'outputPath': AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                'targetFolder': 'ai_social_images/' + updatedFilePath
            });
            fileExtension = fileExtension.replace(".", "");
            imageArray.push({ "_id": newObjectIdDefault(), "name": updatedFilePath, "extension": fileExtension, 'post_on_instagram': postOnInstagram });
        }

        // Handle uploading videos directly from UGC Gallery for Facebook
        if (videoFileNameFacebook != "") {
            let facebookRandomNumber = Math.floor(10 + Math.random() * 90);
            let facebookFileExtension = path.extname(videoFileNameFacebook).toLowerCase();
            let updatedFacebookFilePath = "";

            if (facebookFileExtension == '.mp4') {
                updatedFacebookFilePath = videoFileNameFacebook.replace(/\.mp4$/, `-${facebookRandomNumber}.mp4`);
            }
            if (facebookFileExtension == '.mov') {
                updatedFacebookFilePath = videoFileNameFacebook.replace(/\.mov$/, `-${facebookRandomNumber}.mov`);
            }

            await convertVideoToFFmpegForFacebook({
                'videoURL': (UPLOAD_TO_S3) ? UGC_GALLERY_FILE_URL + videoFileNameFacebook : UGC_GALLERY_FILE_PATH + videoFileNameFacebook,
                'outputPath': AI_SOCIAL_IMAGES_FILE_PATH + updatedFacebookFilePath,
                'targetFolder': 'ai_social_images/' + updatedFacebookFilePath
            });
            facebookFileExtension = facebookFileExtension.replace(".", "");
            facebookImageArray.push({ "_id": newObjectIdDefault(), "name": updatedFacebookFilePath, "extension": facebookFileExtension, 'post_on_facebook': postOnFacebook });
        }

        // If groupId is present, handle group post creation and response
        if (groupId != '') {
            groupRefKey = generateRandomID(8);

            // Fetch group slug using async/await
            let groupDetailsUser = await multipleUserGroup.findOne(
                { _id: newObjectIdDefault(groupId) },
                { projection: { 'slug': 1 } }
            );
            groupUserSlug = groupDetailsUser?.slug || "";

            // Save manual group user post if required
            if (isManually === true || socialType === AI_RESPONSE_TYPE_SOCIAL_STORY) {
                let optionsData = {
                    'group_id': groupId,
                    'title': socialPostTitle,
                    'caption': socialPostCaption,
                    'type': socialType,
                    'is_manually': isManually,
                    'image': aiSocialImage,
                    'group_ref_key': groupRefKey,
                    'social_post_images': imageArray,
                    'facebook_images': facebookImageArray,
                }
                await generateGroupUserSocialStory(req, res, optionsData);
            }

            // Save AI generated group user post if required
            if (isManually === false && socialType === AI_RESPONSE_TYPE_SOCIAL_MEDIA) {
                let optionsData = {
                    'group_id': groupId,
                    'image_urls': [],
                    'video_urls': [],
                    'pdf_url': "",
                    'topic': "",
                    'group_ref_key': groupRefKey,
                    'social_post_images': imageArray,
                    'social_post_facebook_images': facebookImageArray,
                }
                await generateGroupUserSocialPost(req, res, optionsData);
            }

            // Fetch campaign chat details by group_ref_key
            let groupDetails = await getGroupDetailsByRefKey({ 'group_ref_key': groupRefKey });

            // Send success response
            finalResponse = {
                'data': {
                    "status": STATUS_SUCCESS,
                    'unique_key': groupDetails?.unique_key || '',
                    "group_ref_key": groupRefKey,
                    "group_slug": groupUserSlug,
                    "message": (socialType == AI_RESPONSE_TYPE_SOCIAL_MEDIA)
                        ? res.__("front.content_library.social_post_created_successfully")
                        : res.__("front.content_library.social_story_created_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Generate database slug using async/await
        let slugOptions = {
            'title': campaignName,
            'table_name': TABLE_AI_CAMPAIGN_NAME,
            'slug_field': "slug"
        };

        let slugResponse;
        try {
            slugResponse = await getDatabaseSlug(slugOptions);
        } catch (err) {
            console.log("Error in getDatabaseSlug:", err);
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare campaign name insert options
        let insertOptionAiCampaignName = {
            'user_id': userId,
            'slug': slugResponse?.title || "",
            'ai_campaign_name': campaignName,
            'ai_campaign_created_name': "",
            'type': DEFAULT_CAMPAIGN,
            'is_manually': isManually,
            'is_deleted': NOT_DELETED,
            'signup_flag': false,
            'first_content_campaign': false,
            'create_based_type': socialType,
            'created': getUtcDate(),
        };

        // Add group info if present
        if (groupId != '') {
            insertOptionAiCampaignName['social_role_type'] = SOCIAL_POST_GENERATE_TYPE;
            insertOptionAiCampaignName['group_id'] = groupId;
            insertOptionAiCampaignName['group_slug'] = groupUserSlug;
            insertOptionAiCampaignName['group_ref_key'] = groupRefKey;
        }

        // Insert campaign name using async/await
        let nameResult;
        try {
            nameResult = await tableAiCampaignName.insertOne(insertOptionAiCampaignName);
        } catch (nameErr) {
            console.log("Error in insertOne:", nameErr);
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        if (nameResult && nameResult.insertedId) {
            let insertedId = newObjectIdDefault(nameResult.insertedId);

            // Prepare chat data for insertion
            let insertChatData = {
                'user_id': userId,
                'ai_campaign_parent_id': insertedId,
                'role': AI_ROLE_ASSISTANT,
                'content': {
                    "captions": socialPostCaption,
                    "title": socialPostTitle,
                    "image": imageArray,
                    "facebook_image": facebookImageArray
                },
                'type': socialType,
                'is_viewed': false,
                'signup_flag': false,
                'unique_key': uniqueKey,
                'first_ai_poll_generated': false,
                'first_content_campaign': false,
                'is_draft': CAMPAIGN_NOT_DRAFT,
                'is_manually': isManually,
                'is_deleted': NOT_DELETED,
                'created': getUtcDate()
            };

            // Add group info if present
            if (groupId != '') {
                insertChatData['social_role_type'] = SOCIAL_POST_GENERATE_TYPE;
                insertChatData['group_id'] = groupId;
                insertChatData['group_slug'] = groupUserSlug;
                insertChatData['group_ref_key'] = groupRefKey;
            }

            // Insert chat data using async/await
            let chatResult;
            try {
                chatResult = await tableAiCampaignChat.insertOne(insertChatData);
            } catch (chatErr) {
                console.log("Error in chatErr:", chatErr);
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        'unique_key': uniqueKey,
                        "message": res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let insertedChatId = chatResult?.insertedId ? newObjectIdDefault(chatResult.insertedId) : "";

            // Auto schedule campaign if required
            if (autoSchedule && (instagramUrl || instagramLongLivedAccessToken)) {
                let optionsData = {
                    'login_user_data': loginUserData,
                    "ai_campaign_chat_id": insertedChatId,
                }
                await autoSchedulePosts(req, res, optionsData);
            }

            // Send success response
            finalResponse = {
                'data': {
                    "status": STATUS_SUCCESS,
                    'unique_key': uniqueKey,
                    "group_ref_key": groupRefKey,
                    "group_slug": groupUserSlug,
                    "message": (socialType == AI_RESPONSE_TYPE_SOCIAL_MEDIA)
                        ? res.__("front.content_library.social_post_created_successfully")
                        : res.__("front.content_library.social_story_created_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        } else {
            // Fallback error response
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    'unique_key': uniqueKey,
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }

    /**
     * Function used to update tooltip educator
     * Handles all DB queries using async/await and provides clean formatting and comments.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.UpdateToolTipEducatorUpdate = async (req, res) => {
        let finalResponse = {};

        // Extract user data and check login
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

        // Extract tooltip fields from request body
        let toolsTipsEducatorWeekOfPost = req.body.tools_tips_educator_week_of_post || "";
        let toolTipScreenCalendar = req.body.tools_tips_educator_calendar || "";
        let toolsTipsEducatorUgcMediaGallery = req.body.tools_tips_educator_ugc_media_gallery || "";
        let toolsTipsEducatorUgcGenerateSocialPost = req.body.tools_tips_educator_ugc_generate_social_post || "";
        let toolsTipsEducatorTermsAndConditionsFb = req.body.tools_tips_educator_terms_and_conditions_fb || "";
        let toolsTipsEducatorAfterLogin = req.body.tools_tips_educator_after_login || "";
        let toolTipsEducatorBrandAudit = req.body.tool_tips_educator_brand_audit || "";
        let toolTipsEducatorDataVault = req.body.tool_tips_educator_data_vault || "";
        let toolTipsEducatorOnboarding = req.body.tool_tips_educator_onboarding || "";
        let onboardingChecked = req.body.onboarding_checked || "";
        let tooltipsVideo = req.body.tooltips_video || "";
        let tooltipPostGenerated = req.body.tooltip_post_generated || "";

        // Check for user login
        if (!userId) {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare update data object based on provided fields
        let updateData = {};

        // Set fields to true if present in request
        if (toolsTipsEducatorWeekOfPost !== "") {
            updateData['tools_tips_educator_week_of_post'] = true;
        }
        if (toolTipScreenCalendar !== "") {
            updateData['tools_tips_educator_calendar'] = true;
        }
        if (toolsTipsEducatorUgcMediaGallery !== "") {
            updateData['tools_tips_educator_ugc_media_gallery'] = true;
        }
        if (toolsTipsEducatorUgcGenerateSocialPost !== "") {
            updateData['tools_tips_educator_ugc_generate_social_post'] = true;
        }
        if (toolsTipsEducatorTermsAndConditionsFb !== "") {
            updateData['tools_tips_educator_terms_and_conditions_fb'] = true;
        }
        if (toolsTipsEducatorAfterLogin !== "") {
            updateData['tools_tips_educator_after_login'] = true;
        }
        if (toolTipsEducatorBrandAudit !== "") {
            updateData['tool_tips_educator_brand_audit'] = true;
        }
        if (toolTipsEducatorDataVault !== "") {
            updateData['tool_tips_educator_data_vault'] = true;
        }
        if (toolTipsEducatorOnboarding !== "") {
            updateData['tool_tips_educator_onboarding'] = true;
        }
        if (onboardingChecked !== "") {
            updateData['onboarding_checked'] = true;
        }
        if (tooltipsVideo !== "") {
            updateData['tooltips_video'] = true;
        }
        if (tooltipPostGenerated !== "") {
            updateData['tooltip_post_generated'] = true;
        }

        // If no fields to update, return success (nothing to update)
        if (Object.keys(updateData).length === 0) {
            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'message': "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Update user document with tooltip educator fields using async/await
            await users.updateOne(
                { _id: newObjectIdDefault(userId) },
                { $set: updateData }
            );

            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'message': "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle any errors during update
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'message': res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End UpdateToolTipEducatorUpdate();

    /**
    * Function used to get Pexels Photos using async/await
    * Handles all API queries using async/await for clean and modern code.
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.getPexelsPhotos = async (req, res) => {
        let finalResponse = {};

        // Extract user and request parameters
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let searchImageName = req.body.search_image_name ? req.body.search_image_name : "";
        let page = req.body.page ? Number(req.body.page) : 1;
        let limit = 6;

        // Check for required parameters
        if (userId === "" || searchImageName === "") {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Initialize Pexels client (replace with your actual API key)
        const client = createClient('0aozIlJh6vITv1GZX1embVzLtU90w5LANBXOXKqYiujQ425EvYusYwe4');

        try {
            // Fetch photos from Pexels API using async/await
            const photos = await client.photos.search({
                query: searchImageName,
                per_page: limit,
                page: page
            });

            // Calculate total pages
            photos['total_page'] = (photos && photos.total_results) ? Math.ceil(photos.total_results / limit) : 0;

            // Send success response
            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'result': photos,
                    'message': "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle any errors during the API call
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'result': [],
                    'message': error && error.message ? error.message : error,
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End getPexelsPhotos();

    /**
    * Function used to get AI generated captions
    * Handles all DB queries using async/await and Promise for parallel operations.
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.getAIMadeCaption = async (req, res, next) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let campaignChatId = (req.body.campaign_chat_id) ? newObjectIdDefault(req.body.campaign_chat_id) : "";
        let mannuallyImageUrl = (req.body.image_urls) ? req.body.image_urls : [];
        let lastUsedPrompt = (loginUserData && loginUserData.last_used_prompt) ? loginUserData.last_used_prompt : LEFT_HEMISPHERE_PROMPT;

        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

        // Check for missing parameters
        if (!userId || (!campaignChatId && mannuallyImageUrl.length == 0)) {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Check plan limits for social post creation
        let postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_SOCIAL_TYPE);
        if (postLimitData.status == NOT_ALLOW_CREATE_DATA) {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.social_post_limnt.post_limit_reached_upgrade_your_plan_to_post_more"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Separate image and video URLs
        let imageUrls = [];
        let videoUrls = [];
        if (mannuallyImageUrl.length > 0) {
            mannuallyImageUrl.forEach(url => {
                if (/\.(jpg|jpeg|png)$/i.test(url)) {
                    imageUrls.push(url);
                } else if (/\.(mp4|mov)$/i.test(url)) {
                    videoUrls.push(url);
                }
            });
        }

        let uploadSocialImages = [];
        let uploadFacebookImages = [];

        // Helper function to process and upload images/videos for Instagram
        const processSocialPostImages = async () => {
            for (const imageUrl of mannuallyImageUrl) {
                if (!imageUrl) continue;
                let imageExtension = imageUrl.split('.').pop();
                let nameAfterFolder = imageUrl.split("ugc_gallery/")[1];
                if (imageExtension === 'mp4' || imageExtension === 'mov') {
                    // Convert video for Instagram
                    const randomNumber = Math.floor(10 + Math.random() * 90);
                    let updatedFilePath = "";
                    if (imageExtension === 'mp4') {
                        updatedFilePath = nameAfterFolder.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                    }
                    if (imageExtension === 'mov') {
                        updatedFilePath = nameAfterFolder.replace(/\.mov$/, `-${randomNumber}.mov`);
                    }
                    await convertVideoToFFmpegForInstagram({
                        'videoURL': imageUrl,
                        'outputPath': AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                        'targetFolder': 'ai_social_images/' + updatedFilePath
                    });
                    uploadSocialImages.push({ "_id": newObjectIdDefault(), "name": updatedFilePath, "extension": imageExtension, 'post_on_instagram': true });
                } else {
                    // Download and resize image for Instagram
                    let optionsImage = {
                        'url': imageUrl,
                        'dest': AI_SOCIAL_IMAGES_FILE_PATH,
                        'instagram_image_size': true
                    };
                    try {
                        let imageResponse = await downloadImageToUrl(res, req, optionsImage);
                        let imageUrlName = (imageResponse.fileName) ? imageResponse.fileName : "";
                        let imageExtension = (imageResponse.imageExtension) ? imageResponse.imageExtension : "";
                        uploadSocialImages.push({ "_id": newObjectIdDefault(), "name": imageUrlName, "extension": imageExtension, 'post_on_instagram': true });
                    } catch (err) {
                        // Ignore failed downloads for now
                    }
                }
            }
        };

        // Helper function to process and upload images/videos for Facebook
        const processFacebookPostImages = async () => {
            for (const imageUrl of mannuallyImageUrl) {
                if (!imageUrl) continue;
                let imageExtension = imageUrl.split('.').pop();
                let nameAfterFolder = imageUrl.split("ugc_gallery/")[1];
                if (imageExtension === 'mp4' || imageExtension === 'mov') {
                    // Convert video for Facebook
                    const randomNumber = Math.floor(10 + Math.random() * 90);
                    let updatedFilePath = "";
                    if (imageExtension === 'mp4') {
                        updatedFilePath = nameAfterFolder.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                    }
                    if (imageExtension === 'mov') {
                        updatedFilePath = nameAfterFolder.replace(/\.mov$/, `-${randomNumber}.mov`);
                    }
                    await convertVideoToFFmpegForFacebook({
                        'videoURL': imageUrl,
                        'outputPath': AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                        'targetFolder': 'ai_social_images/' + updatedFilePath
                    });
                    uploadFacebookImages.push({ "_id": newObjectIdDefault(), "name": updatedFilePath, "extension": imageExtension, 'post_on_facebook': true });
                } else {
                    // Download and resize image for Facebook
                    let optionsImage = {
                        'url': imageUrl,
                        'dest': AI_SOCIAL_IMAGES_FILE_PATH,
                        'facebook_image_size': true
                    };
                    try {
                        let imageResponse = await downloadImageToUrl(res, req, optionsImage);
                        let imageUrlName = (imageResponse.fileName) ? imageResponse.fileName : "";
                        let imageExtension = (imageResponse.imageExtension) ? imageResponse.imageExtension : "";
                        uploadFacebookImages.push({ "_id": newObjectIdDefault(), "name": imageUrlName, "extension": imageExtension, 'post_on_facebook': true });
                    } catch (err) {
                        // Ignore failed downloads for now
                    }
                }
            }
        };

        // Helper function to get previous captions and titles
        const getPreviousCaptions = async () => {
            let result = await tableAiCampaignChat.find(
                { "user_id": userId, "type": AI_RESPONSE_TYPE_SOCIAL_MEDIA, "signup_flag": false },
                { projection: { '_id': 0, 'content.captions': 1, 'content.title': 1 } }
            ).sort({ "created": SORT_DESC }).limit(10).toArray();

            let captionsAndTitles = (result.length > 0) ? result.map((item, index) => {
                let title = item.content.title;
                let caption = item.content.captions;
                return `${index + 1}. title: ${title}\ncaption: ${caption}`;
            }).join('\n\n') : '';
            return captionsAndTitles;
        };

        try {
            // Run DB queries and uploads in parallel
            const [
                dataVaultResult,
                _socialImages,
                _facebookImages,
                previousCaptions
            ] = await Promise.all([
                // Get data vault info
                web_ai_info.findOne(
                    { "user_id": userId },
                    { projection: { _id: 0, data: 1, social_media_presence: 1, apify_instagram_data: 1 } }
                ),
                // Process and upload images/videos for Instagram
                processSocialPostImages(),
                // Process and upload images/videos for Facebook
                processFacebookPostImages(),
                // Get previous captions
                getPreviousCaptions()
            ]);

            // Prepare business information data
            let aiInformationData = dataVaultResult?.data || "";
            let socialMediaPresence = dataVaultResult?.social_media_presence || {};
            let apifyInstagramData = dataVaultResult?.apify_instagram_data || {};

            // Merge social media presence and apify instagram data
            if (socialMediaPresence && Object.keys(socialMediaPresence).length > 0) {
                delete socialMediaPresence.topPosts;
                aiInformationData = { ...aiInformationData, ...socialMediaPresence };
            }
            if (apifyInstagramData && Object.keys(apifyInstagramData).length > 0) {
                delete apifyInstagramData.topPosts;
                aiInformationData = { ...aiInformationData, ...apifyInstagramData };
            }

            // Remove unwanted keys
            [
                'contactInfo', 'socialLinks', 'seoKeywords', 'ctaText', 'toneOfSite', 'zipCode',
                'uniqueSellingProposition', 'primaryGoal', 'targetAudience', 'offerDiscounts'
            ].forEach(key => delete aiInformationData[key]);

            // Remove empty keys
            removeEmptyKeys(aiInformationData);

            let businessInformationData = (Object.keys(aiInformationData).length > 0) ? aiInformationData : "";
            businessInformationData = objectToMarkdown(businessInformationData);

            // Prepare prompt and options for AI caption generation
            let mediaAttach = [...imageUrls, ...videoUrls];
            let updateLastUsedPrompt = (lastUsedPrompt === LEFT_HEMISPHERE_PROMPT) ? RIGHT_HEMISPHERE_PROMPT : LEFT_HEMISPHERE_PROMPT;
            let userPrompt = (lastUsedPrompt === LEFT_HEMISPHERE_PROMPT) ? RIGHT_BRAIN_WITH_MEDIA : LEFT_BRAIN_WITH_MEDIA;
            let userFinalPrompt = userPrompt
                .replace(/{DATA_VAULT}/g, businessInformationData)
                .replace(/{TOPIC}/g, "")
                .replace(/{LAST_10_CAPTIONS}/g, previousCaptions)
                .replace(/{MEDIA}/g, mediaAttach);

            let optionsData = {
                "prompt": userFinalPrompt,
                "video_urls": (videoUrls.length > 0 && LIVE_SERVER_UPLOAD === true) ? videoUrls : [],
                "image_urls": (imageUrls.length > 0 && LIVE_SERVER_UPLOAD === true) ? imageUrls : [],
                'temperature': 0.7
            };

            // Generate caption using AI
            let generatedCaption = await getCaptionWithOrWithoutMedia(req, res, optionsData);
            let responseData = (generatedCaption.status == STATUS_SUCCESS) ? generatedCaption.response : "";

            if (responseData.title && responseData.caption) {
                // Save social post campaign
                await saveCaptionGeneratedByImage({
                    "user_id": userId,
                    "campaign_chat_id": campaignChatId,
                    "social_post_content": responseData,
                    "social_post_images": uploadSocialImages,
                    "social_post_facebook_images": uploadFacebookImages,
                    "ugc_upload_social_post": true
                });

                // Update last used prompt for user
                await users.updateOne(
                    { _id: newObjectIdDefault(userId) },
                    { $set: { 'last_used_prompt': updateLastUsedPrompt } }
                );

                // Send success response
                finalResponse = {
                    'data': {
                        "status": STATUS_SUCCESS,
                        "message": res.__("front.content_library.social_post_created_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Send error response if caption generation failed
                finalResponse = {
                    'data': {
                        "status": STATUS_ERROR,
                        "message": res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle any errors during the process
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End getAIMadeCaption();

    /**
     * Function used to get campaign library list
     * Handles all DB queries using async/await and provides clean formatting and comments.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getCampaignLibraryList = async (req, res) => {
        let finalResponse = {};

        // Extract user data and check login
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";

        const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);

        // Check for user login
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

        // Prepare common condition for campaign name data
        let commonCondition = {
            "user_id": newObjectIdDefault(userId),
            'is_deleted': NOT_DELETED,
            'type': DEFAULT_CAMPAIGN
        };

        try {
            // Aggregate campaign library list with lookup and projection using async/await
            const campaignResult = await tableAiCampaignName.aggregate([
                { $match: commonCondition },
                {
                    $lookup: {
                        from: TABLE_AI_CAMPAIGN_CHAT,
                        let: { campaignNameId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_parent_id", "$$campaignNameId"] },
                                            { $eq: ["$type", AI_RESPONSE_TYPE_SOCIAL_MEDIA] },
                                            { $eq: ["$is_deleted", NOT_DELETED] },
                                            { $ne: ["$signup_flag", true] },
                                        ]
                                    }
                                }
                            },
                            {
                                $project: {
                                    'unique_key': 1,
                                    'is_email_create': 1,
                                    'is_poll_create': 1,
                                    'is_seo_blog_create': 1
                                }
                            }
                        ],
                        as: "campaignChatDetails"
                    }
                },
                {
                    $project: {
                        "_id": 1,
                        "ai_campaign_name": 1,
                        "ai_campaign_created_name": 1,
                        "unique_key": { $arrayElemAt: ["$campaignChatDetails.unique_key", 0] },
                        "is_email_create": {
                            $cond: [
                                { $arrayElemAt: ["$campaignChatDetails.is_email_create", 0] },
                                { $arrayElemAt: ["$campaignChatDetails.is_email_create", 0] },
                                false
                            ]
                        },
                        "is_poll_create": {
                            $cond: [
                                { $arrayElemAt: ["$campaignChatDetails.is_poll_create", 0] },
                                { $arrayElemAt: ["$campaignChatDetails.is_poll_create", 0] },
                                false
                            ]
                        },
                        "is_seo_blog_create": {
                            $cond: [
                                { $arrayElemAt: ["$campaignChatDetails.is_seo_blog_create", 0] },
                                { $arrayElemAt: ["$campaignChatDetails.is_seo_blog_create", 0] },
                                false
                            ]
                        },
                        "created": 1,
                    }
                },
                {
                    $match: {
                        'unique_key': { $exists: true, $ne: null },
                        $or: [
                            { is_email_create: true },
                            { is_poll_create: true },
                            { is_seo_blog_create: true }
                        ]
                    }
                },
                { $sort: { 'created': SORT_DESC } },
            ]).toArray();

            // Send success response if records found
            if (campaignResult && campaignResult.length > 0) {
                finalResponse = {
                    'data': {
                        'status': STATUS_SUCCESS,
                        'result': campaignResult,
                        'message': "",
                    }
                };
            } else {
                // Send error response if no records found
                finalResponse = {
                    'data': {
                        'status': STATUS_ERROR,
                        'result': [],
                        'message': res.__("front.global.no_record_found"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle any errors during the DB query
            finalResponse = {
                'data': {
                    'status': STATUS_ERROR,
                    'result': [],
                    'message': err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End getCampaignLibraryList();

    /**
     * Function to generate caption and title using image or video.
     * Handles all DB queries using async/await and Promise for parallel operations.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.generateTitleAndCaptionFromImage = async (req, res, next) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let videoUrls = Array.isArray(req.body.video_urls) ? req.body.video_urls : [];
        let imageUrls = Array.isArray(req.body.image_urls) ? req.body.image_urls : [];

        let imagesLength = req.body.images_length ? req.body.images_length : 0;
        let videoLength = req.body.video_length ? req.body.video_length : 0;

        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

        // Check for missing parameters
        if (!userId) {
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Get last used prompt or default
            let lastUsedPrompt = (loginUserData && loginUserData.last_used_prompt) ? loginUserData.last_used_prompt : LEFT_HEMISPHERE_PROMPT;

            // Run DB queries in parallel using Promise.all
            const [
                dataVaultResult,
                previousCaptionsResult
            ] = await Promise.all([
                // Get data vault information
                web_ai_info.findOne(
                    { "user_id": userId },
                    { projection: { _id: 0, data: 1, social_media_presence: 1, apify_instagram_data: 1 } }
                ),
                // Get previous captions and titles
                tableAiCampaignChat.find(
                    { "user_id": userId, "type": AI_RESPONSE_TYPE_SOCIAL_MEDIA, "signup_flag": false },
                    { projection: { '_id': 0, 'content.captions': 1, 'content.title': 1 } }
                ).sort({ "created": SORT_DESC }).limit(10).toArray()
            ]);

            // Format previous captions and titles
            let previousCaptions = (previousCaptionsResult && previousCaptionsResult.length > 0)
                ? previousCaptionsResult.map((item, index) => {
                    let title = item.content.title;
                    let caption = item.content.captions;
                    return `${index + 1}. title: ${title}\ncaption: ${caption}`;
                }).join('\n\n')
                : '';

            // Prepare business information data
            let aiInformationData = dataVaultResult?.data || {};
            let socialMediaPresence = dataVaultResult?.social_media_presence || {};
            let apifyInstagramData = dataVaultResult?.apify_instagram_data || {};

            // Merge social media presence and apify instagram data
            if (socialMediaPresence && Object.keys(socialMediaPresence).length > 0) {
                delete socialMediaPresence.topPosts;
                aiInformationData = { ...aiInformationData, ...socialMediaPresence };
            }
            if (apifyInstagramData && Object.keys(apifyInstagramData).length > 0) {
                delete apifyInstagramData.topPosts;
                aiInformationData = { ...aiInformationData, ...apifyInstagramData };
            }

            // Remove unwanted keys
            ['contactInfo', 'socialLinks', 'seoKeywords', 'ctaText', 'toneOfSite', 'zipCode', 'uniqueSellingProposition', 'primaryGoal', 'targetAudience', 'offerDiscounts'].forEach(key => delete aiInformationData[key]);

            // Remove empty keys from object
            removeEmptyKeys(aiInformationData);

            let businessInformationData = (Object.keys(aiInformationData).length > 0) ? aiInformationData : "";
            businessInformationData = objectToMarkdown(businessInformationData);

            // Prepare media attachments
            let mediaAttach = [];
            if (imageUrls.length > 0 || videoUrls.length > 0) {
                mediaAttach = [...imageUrls, ...videoUrls];
            }

            // Prepare user prompt
            let userPrompt = (lastUsedPrompt === LEFT_HEMISPHERE_PROMPT) ? RIGHT_BRAIN_WITH_MEDIA : LEFT_BRAIN_WITH_MEDIA;
            let userFinalPrompt = userPrompt
                .replace(/{DATA_VAULT}/g, businessInformationData)
                .replace(/{TOPIC}/g, "")
                .replace(/{LAST_10_CAPTIONS}/g, previousCaptions)
                .replace(/{MEDIA}/g, mediaAttach);

            // If files are uploaded (by length), use GIMINI AI for caption generation
            if (videoLength > 0 || imagesLength > 0) {
                let vedioData = {
                    "prompt": userFinalPrompt
                };
                // Get response from GIMINI AI
                let getCapionData = await getVideoCaption(req, res, vedioData);

                if (getCapionData.status == STATUS_SUCCESS) {
                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": getCapionData.response,
                            "message": res.__("front.content_library.caption_and_title_generated_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    finalResponse = {
                        'data': {
                            "status": STATUS_ERROR,
                            "result": {},
                            "message": res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }
            // If URLs are provided, use GIMINI AI for caption generation
            else if ((videoUrls.length > 0) || (imageUrls.length > 0)) {
                let vedioData = {
                    "video_urls": videoUrls,
                    "image_urls": imageUrls,
                    "prompt": userFinalPrompt
                };
                // Get response from GIMINI AI
                let getCapionData = await getVideoCaption(req, res, vedioData);

                if (getCapionData.status == STATUS_SUCCESS) {
                    finalResponse = {
                        'data': {
                            "status": STATUS_SUCCESS,
                            "result": getCapionData.response,
                            "message": res.__("front.content_library.caption_and_title_generated_successfully"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    finalResponse = {
                        'data': {
                            "status": STATUS_ERROR,
                            "result": {},
                            "message": res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }
            // If images are uploaded as files, use OpenAI for caption generation
            else {
                let imageFiles = Array.from({ length: imagesLength }, (_, i) => req.files?.[`ai_social_image_${i}`]).filter(Boolean);

                // Convert each image to the desired format for OpenAI
                let imageDataArray = imageFiles.map(image => {
                    let imageBuffer = image?.data || null;
                    let base64Image = imageBuffer ? imageBuffer.toString("base64") : "";
                    return {
                        type: "image_url",
                        image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                    };
                });

                try {
                    let messages = [
                        { role: "system", content: CAPTION_FROM_IMAGE_SYSTEM_PROMPT },
                        {
                            role: "user",
                            content: [
                                { type: "text", text: userFinalPrompt },
                                ...(imageFiles.length > 0 ? imageDataArray : [])
                            ]
                        }
                    ];

                    // Create social post using OpenAI
                    let aiResult = await openai.createChatCompletion({ model: "gpt-4o", messages: messages });
                    let aiResponse = aiResult.data.choices[0].message.content;

                    try {
                        let responseData = JSON.parse(aiResponse);

                        if (responseData.title && responseData.caption) {
                            let socialPost = {
                                "title": responseData.title,
                                "captions": responseData.caption + (responseData?.hashtags ? ("\n" + responseData.hashtags) : "")
                            };
                            finalResponse = {
                                'data': {
                                    "status": STATUS_SUCCESS,
                                    "result": socialPost,
                                    "message": res.__("front.content_library.caption_and_title_generated_successfully"),
                                }
                            };
                            return returnApiResult(req, res, finalResponse);
                        }
                    } catch (e) {
                        // If response is not valid JSON, try to fix and parse again
                        let validData = await validAiResponse(aiResponse);
                        let newResponseData = validData.response;

                        try {
                            let newResponse = JSON.parse(newResponseData);
                            if (newResponse.title && newResponse.caption) {
                                let socialPost = {
                                    "title": newResponse.title,
                                    "captions": newResponse.caption + (newResponse?.hashtags ? ("\n" + newResponse.hashtags) : "")
                                };
                                finalResponse = {
                                    'data': {
                                        "status": STATUS_SUCCESS,
                                        "result": socialPost,
                                        "message": res.__("front.content_library.caption_and_title_generated_successfully"),
                                    }
                                };
                                return returnApiResult(req, res, finalResponse);
                            }
                        } catch (err) {
                            finalResponse = {
                                'data': {
                                    "status": STATUS_ERROR,
                                    "result": {},
                                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                                }
                            };
                            return returnApiResult(req, res, finalResponse);
                        }
                    }
                } catch (err) {
                    finalResponse = {
                        'data': {
                            "status": STATUS_ERROR,
                            "result": {},
                            "message": res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }
        } catch (err) {
            // Handle any errors during the DB query or AI call
            finalResponse = {
                'data': {
                    "status": STATUS_ERROR,
                    "result": {},
                    "message": res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End generateTitleAndCaptionFromImage();

    /**
    * Function used to generate social post using UGC upload image
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.generateSocialPostFromUgcUploadImages = async (req, res, next) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let description = req.body.description || "";
        let ugcGalleryImages = req.files || {};
        let instagramIdLink = req.body.instagram_id_link || "";
        let groupId = (req.body && req.body.group_id) ? newObjectIdDefault(req.body.group_id) : "";

        // Post on facebook or instagram keys
        let postOnInstagram = req.body.post_on_instagram ? JSON.parse(req.body.post_on_instagram) : false;
        let postOnFacebook = req.body.post_on_facebook ? JSON.parse(req.body.post_on_facebook) : false;

        let facebookImageVideoUrls = req.body.facebook_image_video_urls || [];
        let instagramImageVideoUrls = req.body.image_video_urls || [];

        // Used for auto schedule post
        let instagramLongLivedAccessToken = loginUserData.long_lived_access_token || "";
        let instagramUrl = loginUserData.instagram_url || "";
        let autoSchedule = loginUserData.auto_schedule || "";

        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
        const ugcGallery = db.collection(TABLE_UGC_GALLERY);
        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

        // Check for missing parameters
        if (!userId || !description || (Object.keys(ugcGalleryImages).length === 0 && instagramImageVideoUrls.length === 0 && facebookImageVideoUrls.length === 0)) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                },
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            let lastUsedPrompt = loginUserData.last_used_prompt || LEFT_HEMISPHERE_PROMPT;
            let createSocialPostFromMedia = loginUserData.create_social_post_from_media || false;

            // Check plan limits
            let postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_SOCIAL_TYPE);
            if (postLimitData.status == NOT_ALLOW_CREATE_DATA) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.social_post_limnt.post_limit_reached_upgrade_your_plan_to_post_more"),
                    },
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Separate images by type
            let instagramImages = [];
            let facebookImages = [];
            let ugcOriginalImages = [];
            for (let [key, value] of Object.entries(ugcGalleryImages)) {
                if (key.startsWith("ugc_images_facebook")) {
                    facebookImages.push(value);
                } else if (key.startsWith("ugc_images")) {
                    instagramImages.push(value);
                } else if (key.startsWith("original_browse_image")) {
                    ugcOriginalImages.push(value);
                }
            }

            let uploadUgcImages = [];
            let facebookImageArray = [];

            // --- Parallel processing of all upload/query tasks ---
            // Each function returns a Promise, so we can use Promise.all for parallel execution

            // 1. Get data vault info
            const getDataVault = async () => {
                // Query user data vault info
                return await web_ai_info.findOne(
                    { user_id: userId },
                    {
                        projection: {
                            _id: 0,
                            data: 1,
                            other_data: 1,
                            social_media_presence: 1,
                            apify_instagram_data: 1,
                        },
                    }
                );
            };

            // 2. Upload UGC gallery images
            const uploadUgcGalleryImages = async () => {
                if (ugcOriginalImages.length === 0) return;
                for (const recordData of ugcOriginalImages) {
                    let mimeType = recordData.mimetype || "";
                    let options = {
                        image: recordData,
                        ai_social_image_submit: true,
                        filePath: UGC_GALLERY_FILE_PATH,
                        allowedExtensions: ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
                        allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
                        allowedMimeTypes: ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
                        allowedMimeError: ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
                        allowedSizeErrorMessage: ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
                        size: MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
                    };
                    // Upload image in UGC gallery
                    let galleryResponse = await moveUploadedFile(req, res, options);
                    if (galleryResponse.status == STATUS_ERROR) {
                        throw new Error(galleryResponse.message || "Failed to upload image");
                    }
                    let imageName = galleryResponse.fileName || "";
                    let imageExtension = galleryResponse.image_extension || "";
                    // Generate slug
                    let slugResponse = await getDatabaseSlug({
                        title: description,
                        table_name: TABLE_UGC_GALLERY,
                        slug_field: "slug",
                    });
                    // Insert UGC gallery data
                    await ugcGallery.insertOne({
                        user_id: userId,
                        description: description,
                        upload_file: imageName,
                        mime_type: mimeType,
                        extension: imageExtension,
                        instagram_id_link: instagramIdLink,
                        slug: slugResponse && slugResponse.title ? slugResponse.title : "",
                        created: getUtcDate(),
                    });
                }
            };

            // 3. Upload Instagram images for social post
            const uploadInstagramImages = async () => {
                if (instagramImages.length === 0) return;
                for (const recordData of instagramImages) {
                    let options = {
                        image: recordData,
                        ai_social_image_submit: true,
                        filePath: AI_SOCIAL_IMAGES_FILE_PATH,
                        allowedExtensions: ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
                        allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
                        allowedMimeTypes: ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
                        allowedMimeError: ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
                        allowedSizeErrorMessage: ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
                        size: MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
                    };
                    // Upload Instagram image in social post
                    let galleryResponse = await moveUploadedFile(req, res, options);
                    if (galleryResponse.status == STATUS_ERROR) {
                        throw new Error(galleryResponse.message || "Failed to upload image");
                    }
                    let imageName = galleryResponse.fileName || "";
                    let imageExtension = galleryResponse.image_extension || "";
                    if (imageName && imageExtension) {
                        // If video, convert for Instagram
                        if (imageExtension == "mp4" || imageExtension == "mov") {
                            const randomNumber = Math.floor(10 + Math.random() * 90);
                            let updatedFilePath = "";
                            if (imageExtension == "mp4") {
                                updatedFilePath = imageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                            }
                            if (imageExtension == "mov") {
                                updatedFilePath = imageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                            }
                            await convertVideoToFFmpegForInstagram({
                                videoURL: UPLOAD_TO_S3
                                    ? AI_SOCIAL_IMAGES_URL + imageName
                                    : AI_SOCIAL_IMAGES_FILE_PATH + imageName,
                                outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                                targetFolder: "ai_social_images/" + updatedFilePath,
                            });
                            uploadUgcImages.push({
                                _id: newObjectIdDefault(),
                                name: updatedFilePath,
                                extension: imageExtension,
                                post_on_instagram: postOnInstagram,
                            });
                        } else {
                            // Resize image for Instagram
                            let optiondata = {
                                image: recordData,
                                image_name: imageName,
                                type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                                without_crop: true,
                            };
                            await resizeImageForSocialPostImage(req, res, optiondata);
                            uploadUgcImages.push({
                                _id: newObjectIdDefault(),
                                name: imageName,
                                extension: imageExtension,
                                post_on_instagram: postOnInstagram,
                            });
                        }
                        // Set Instagram handle if present
                        if (instagramIdLink) {
                            uploadUgcImages[uploadUgcImages.length - 1]["instagram_handle"] = true;
                        }
                    }
                }
            };

            // 4. Upload Instagram video URLs
            const uploadInstagramVideoUrls = async () => {
                if (instagramImageVideoUrls.length === 0) return;
                await Promise.all(
                    instagramImageVideoUrls.map(async (videoFileName) => {
                        if (videoFileName) {
                            let fullPath = UGC_GALLERY_FILE_URL;
                            videoFileName = videoFileName.replace(fullPath, "");
                            let randomNumber = Math.floor(10 + Math.random() * 90);
                            let fileExtension = path.extname(videoFileName).toLowerCase();
                            let updatedFilePath = "";
                            if (fileExtension == ".mp4") {
                                updatedFilePath = videoFileName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                            }
                            if (fileExtension == ".mov") {
                                updatedFilePath = videoFileName.replace(/\.mov$/, `-${randomNumber}.mov`);
                            }
                            await convertVideoToFFmpegForInstagram({
                                videoURL: UPLOAD_TO_S3
                                    ? UGC_GALLERY_FILE_URL + videoFileName
                                    : UGC_GALLERY_FILE_PATH + videoFileName,
                                outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                                targetFolder: "ai_social_images/" + updatedFilePath,
                            });
                            let ext = fileExtension.replace(".", "");
                            uploadUgcImages.push({
                                _id: newObjectIdDefault(),
                                name: updatedFilePath,
                                extension: ext,
                                post_on_instagram: postOnInstagram,
                            });
                        }
                    })
                );
            };

            // 5. Upload Facebook images for social post
            const uploadFacebookImages = async () => {
                if (facebookImages.length === 0) return;
                for (const aiSocialImageFacebook of facebookImages) {
                    let options = {
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
                    // Upload Facebook image in social post
                    let galleryResponse = await moveUploadedFile(req, res, options);
                    if (galleryResponse.status == STATUS_ERROR) {
                        throw new Error(galleryResponse.message || "Failed to upload image");
                    }
                    let facebookImageName = galleryResponse.fileName || "";
                    let facebookImageExtension = galleryResponse.image_extension || "";
                    if (facebookImageName && facebookImageExtension) {
                        if (facebookImageExtension == "mp4" || facebookImageExtension == "mov") {
                            const randomNumber = Math.floor(10 + Math.random() * 90);
                            let updatedFilePath = "";
                            if (facebookImageExtension == "mp4") {
                                updatedFilePath = facebookImageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                            }
                            if (facebookImageExtension == "mov") {
                                updatedFilePath = facebookImageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                            }
                            await convertVideoToFFmpegForFacebook({
                                videoURL: UPLOAD_TO_S3
                                    ? AI_SOCIAL_IMAGES_URL + facebookImageName
                                    : AI_SOCIAL_IMAGES_FILE_PATH + facebookImageName,
                                outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                                targetFolder: "ai_social_images/" + updatedFilePath,
                            });
                            facebookImageArray.push({
                                _id: newObjectIdDefault(),
                                name: updatedFilePath,
                                extension: facebookImageExtension,
                                post_on_facebook: postOnFacebook,
                            });
                        } else {
                            // Resize Facebook post image
                            let optionFacebookdata = {
                                image: aiSocialImageFacebook,
                                image_name: facebookImageName,
                            };
                            await resizeImageForFacebookPostImage(req, res, optionFacebookdata);
                            facebookImageArray.push({
                                _id: newObjectIdDefault(),
                                name: facebookImageName,
                                extension: facebookImageExtension,
                                post_on_facebook: postOnFacebook,
                            });
                        }
                    }
                }
            };

            // 6. Upload Facebook video URLs
            const uploadFacebookVideoUrls = async () => {
                if (facebookImageVideoUrls.length === 0) return;
                await Promise.all(
                    facebookImageVideoUrls.map(async (videoFileNameFacebook) => {
                        if (videoFileNameFacebook) {
                            let fullPath = UGC_GALLERY_FILE_URL;
                            videoFileNameFacebook = videoFileNameFacebook.replace(fullPath, "");
                            let randomNumber = Math.floor(10 + Math.random() * 90);
                            let facebookFileExtension = path.extname(videoFileNameFacebook).toLowerCase();
                            let updatedFacebookFilePath = "";
                            if (facebookFileExtension == ".mp4") {
                                updatedFacebookFilePath = videoFileNameFacebook.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                            }
                            if (facebookFileExtension == ".mov") {
                                updatedFacebookFilePath = videoFileNameFacebook.replace(/\.mov$/, `-${randomNumber}.mov`);
                            }
                            await convertVideoToFFmpegForFacebook({
                                videoURL: UPLOAD_TO_S3
                                    ? UGC_GALLERY_FILE_URL + videoFileNameFacebook
                                    : UGC_GALLERY_FILE_PATH + videoFileNameFacebook,
                                outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFacebookFilePath,
                                targetFolder: "ai_social_images/" + updatedFacebookFilePath,
                            });
                            let ext = facebookFileExtension.replace(".", "");
                            facebookImageArray.push({
                                _id: newObjectIdDefault(),
                                name: updatedFacebookFilePath,
                                extension: ext,
                                post_on_facebook: postOnFacebook,
                            });
                        }
                    })
                );
            };

            // 7. Get previous captions from social media post
            const getPreviousCaptions = async () => {
                let result = await tableAiCampaignChat
                    .find(
                        {
                            user_id: userId,
                            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            signup_flag: false,
                        },
                        {
                            projection: {
                                _id: 0,
                                "content.captions": 1,
                                "content.title": 1,
                            },
                        }
                    )
                    .sort({ created: SORT_DESC })
                    .limit(10)
                    .toArray();
                let captionsAndTitles =
                    result.length > 0
                        ? result
                            .map((item, index) => {
                                let title = item.content.title;
                                let caption = item.content.captions;
                                return `${index + 1}. title: ${title}\ncaption: ${caption}`;
                            })
                            .join("\n\n")
                        : "";
                return captionsAndTitles;
            };

            // Run all upload/query functions in parallel
            let [
                dataVaultResult,
                _ugcGalleryUpload,
                _instagramUpload,
                _instagramVideoUpload,
                _facebookUpload,
                _facebookVideoUpload,
                previousCaptions,
            ] = await Promise.all([
                getDataVault(),
                uploadUgcGalleryImages(),
                uploadInstagramImages(),
                uploadInstagramVideoUrls(),
                uploadFacebookImages(),
                uploadFacebookVideoUrls(),
                getPreviousCaptions(),
            ]);

            // --- Post-processing and AI prompt construction ---

            let businessInformationData = dataVaultResult?.data || "";
            let aiInformationOtherPagesData = dataVaultResult?.other_data || {};
            let socialMediaPresence = dataVaultResult?.social_media_presence || {};
            let apifyInstagramData = dataVaultResult?.apify_instagram_data || {};
            let groupRefKey = generateRandomID(8);

            // Merge additional business info
            if (aiInformationOtherPagesData && Object.keys(aiInformationOtherPagesData).length > 0) {
                businessInformationData = { ...businessInformationData, ...aiInformationOtherPagesData };
            }
            if (socialMediaPresence && Object.keys(socialMediaPresence).length > 0) {
                delete socialMediaPresence.topPosts;
                businessInformationData = { ...businessInformationData, ...socialMediaPresence };
            }
            if (apifyInstagramData && Object.keys(apifyInstagramData).length > 0) {
                delete apifyInstagramData.topPosts;
                businessInformationData = { ...businessInformationData, ...apifyInstagramData };
            }
            ["contactInfo", "socialLinks", "seoKeywords", "ctaText", "toneOfSite", "zipCode", "uniqueSellingProposition", "primaryGoal", "targetAudience", "offerDiscounts",].forEach((key) => delete businessInformationData[key]);
            removeEmptyKeys(businessInformationData);

            businessInformationData = objectToMarkdown(businessInformationData);

            let combinedMedia = [...uploadUgcImages, ...facebookImageArray];
            let uploadedImageUrls =
                combinedMedia.length > 0 && LIVE_SERVER_UPLOAD === true
                    ? combinedMedia
                        .filter((item) => ["jpg", "jpeg", "png"].includes(item.extension))
                        .map((item) => AI_SOCIAL_IMAGES_URL + item.name)
                    : [];
            let uploadedVideosUrls =
                combinedMedia.length > 0 && LIVE_SERVER_UPLOAD === true
                    ? combinedMedia
                        .filter((item) => ["mp4", "mov"].includes(item.extension))
                        .map((item) => AI_SOCIAL_IMAGES_URL + item.name)
                    : [];

            let mediaAttach = [...uploadedImageUrls, ...uploadedVideosUrls];
            let updateLastUsedPrompt =
                lastUsedPrompt === LEFT_HEMISPHERE_PROMPT
                    ? RIGHT_HEMISPHERE_PROMPT
                    : LEFT_HEMISPHERE_PROMPT;
            let userPrompt =
                lastUsedPrompt === LEFT_HEMISPHERE_PROMPT
                    ? RIGHT_BRAIN_WITH_MEDIA
                    : LEFT_BRAIN_WITH_MEDIA;
            let userFinalPrompt = userPrompt
                .replace(/{DATA_VAULT}/g, businessInformationData)
                .replace(/{TOPIC}/g, description)
                .replace(/{LAST_10_CAPTIONS}/g, previousCaptions)
                .replace(/{MEDIA}/g, mediaAttach);

            // If either gallery is empty, combine both
            let combinedMediaFromGallery =
                instagramImageVideoUrls.length === 0 || facebookImageVideoUrls.length === 0
                    ? [...facebookImageVideoUrls, ...instagramImageVideoUrls]
                    : [];

            // --- Save group user post or generate AI caption and save campaign ---
            if (groupId != "") {
                // Save group user post
                let optionsData = {
                    group_id: groupId,
                    image_urls: uploadedImageUrls,
                    video_urls:
                        combinedMediaFromGallery.length > 0
                            ? combinedMediaFromGallery
                            : uploadedVideosUrls,
                    pdf_url: "",
                    topic: description,
                    social_post_images: uploadUgcImages,
                    group_ref_key: groupRefKey,
                    social_post_facebook_images: facebookImageArray,
                };
                await generateGroupUserSocialPost(req, res, optionsData);

                // Get campaign chat details
                let groupDetailsUser = await getGroupDetailsByRefKey({
                    group_ref_key: groupRefKey,
                });

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        group_ref_key: groupRefKey,
                        unique_key: groupDetailsUser?.unique_key || "",
                        group_slug: groupDetailsUser?.group_slug || "",
                        result: {
                            ai_campaign_chat_id: groupDetailsUser?._id || "",
                            type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                        },
                        message: res.__("front.content_library.social_post_created_successfully"),
                    },
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Generate caption from AI
                let optionsData = {
                    prompt: userFinalPrompt,
                    image_urls: uploadedImageUrls,
                    video_urls:
                        combinedMediaFromGallery.length > 0
                            ? combinedMediaFromGallery
                            : uploadedVideosUrls,
                    temperature: 0.7,
                };
                let generatedCaption = await getCaptionWithOrWithoutMedia(req, res, optionsData);
                let generatedResponse =
                    generatedCaption.status == STATUS_SUCCESS ? generatedCaption.response : "";

                if (generatedResponse) {
                    // Save social post campaign
                    let campaignData = await saveCaptionGeneratedByImage({
                        user_id: userId,
                        campaign_chat_id: "",
                        social_post_content: generatedResponse,
                        social_post_images: uploadUgcImages,
                        social_post_facebook_images: facebookImageArray,
                        is_draft: CAMPAIGN_DRAFT,
                        instagram_handle: instagramIdLink,
                        topic: description,
                        // group_id: groupId,
                        // group_ref_key: groupRefKey
                    });

                    let campaignChatId = campaignData.ai_campaign_chat_id
                        ? newObjectIdDefault(campaignData.ai_campaign_chat_id)
                        : "";
                    let uniqueKey = campaignData.unique_key ? campaignData.unique_key : "";
                    let groupSlug = campaignData.group_slug ? campaignData.group_slug : "";

                    // Auto schedule campaign if enabled
                    if (autoSchedule && (instagramUrl || instagramLongLivedAccessToken)) {
                        let optionsData = {
                            login_user_data: loginUserData,
                            ai_campaign_chat_id: campaignChatId,
                        };
                        await autoSchedulePosts(req, res, optionsData);
                    }

                    // Update user flags
                    if (createSocialPostFromMedia !== true) {
                        await users.updateOne(
                            { _id: newObjectIdDefault(userId) },
                            { $set: { create_social_post_from_media: true } }
                        );
                    }
                    await users.updateOne(
                        { _id: newObjectIdDefault(userId) },
                        { $set: { last_used_prompt: updateLastUsedPrompt } }
                    );

                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            group_ref_key: groupRefKey,
                            unique_key: uniqueKey,
                            group_slug: groupSlug,
                            result: {
                                ai_campaign_chat_id: campaignChatId,
                                type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            },
                            message: res.__("front.content_library.social_post_created_successfully"),
                        },
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    // Send error message
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        },
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }
        } catch (err) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: err.message || res.__("front.system.something_going_wrong_please_try_again"),
                },
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

    /**
     * Function used to save caption generated by image.
     * Handles all DB queries using async/await and Promise for parallel operations.
     * @param {*} options
     * @returns {Promise<Object>} - Returns a promise that resolves with campaign and chat IDs, unique key, and group slug.
     */
    saveCaptionGeneratedByImage = async (options) => {
        try {
            // Extract and prepare all required fields from options
            const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
            const campaignChatId = options.campaign_chat_id ? newObjectIdDefault(options.campaign_chat_id) : "";
            const socialPostContent = options.social_post_content || {};
            const campaignName = "Social Post by Image";
            const socialPostTitle = socialPostContent.title || "";
            const socialPostCaption = socialPostContent.caption || "";
            const socialPostHashtags = socialPostContent.hashtags || "";
            const SocialPostImagesArray = options.social_post_images || [];
            const ugcUploadGallerySocialPost = options.ugc_upload_social_post || false;
            const socialPostDraft = options.is_draft || CAMPAIGN_DRAFT;
            const SocialPostFacebookImagesArray = options.social_post_facebook_images || [];
            const instagramHandle = options.instagram_handle ? extractUniqueInstagramHandle(options.instagram_handle) : "";
            const groupId = options.group_id ? newObjectIdDefault(options.group_id) : "";
            const groupRefKey = options.group_ref_key || "";
            const topicName = options.topic || "";

            let groupUserSlug = "";

            // --- Query group slug if groupId is provided ---
            if (groupId) {
                // Get group slug from multipleUserGroup collection
                const groupDetailsUser = await multipleUserGroup.findOne(
                    { _id: newObjectIdDefault(groupId) },
                    { projection: { slug: 1 } }
                );
                groupUserSlug = groupDetailsUser?.slug || "";
            }

            // --- Prepare slug options for campaign name ---
            const slugOptions = {
                title: campaignName,
                table_name: TABLE_AI_CAMPAIGN_NAME,
                slug_field: "slug"
            };

            // --- Generate database slug ---
            const slugResponse = await getDatabaseSlug(slugOptions);

            // --- Prepare campaign name insert object ---
            let insertOptionAiCampaignName = {
                user_id: userId,
                slug: slugResponse?.title || "",
                ai_campaign_name: campaignName,
                ai_campaign_created_name: "",
                type: DEFAULT_CAMPAIGN,
                is_deleted: NOT_DELETED,
                signup_flag: false,
                first_content_campaign: false,
                created: getUtcDate(),
            };

            // Add group-related fields if groupId is present
            if (groupId) {
                insertOptionAiCampaignName.social_role_type = SOCIAL_POST_GENERATE_TYPE;
                insertOptionAiCampaignName.group_id = groupId;
                insertOptionAiCampaignName.group_slug = groupUserSlug;
                insertOptionAiCampaignName.group_ref_key = groupRefKey;
            }

            // --- Insert campaign name into tableAiCampaignName ---
            const nameResult = await tableAiCampaignName.insertOne(insertOptionAiCampaignName);

            if (!nameResult || !nameResult.insertedId) {
                throw new Error("Failed to insert campaign name");
            }

            const insertedId = newObjectIdDefault(nameResult.insertedId);
            const uniqueKey = generateRandomID(8);
            const fullCaption = socialPostCaption + "\n" + socialPostHashtags;

            // --- Prepare chat data for campaign chat ---
            let insertChatData = {
                user_id: userId,
                ai_campaign_parent_id: insertedId,
                role: AI_ROLE_ASSISTANT,
                topic: topicName,
                content: {
                    captions: fullCaption,
                    title: socialPostTitle,
                    hashtags: socialPostHashtags,
                    image: SocialPostImagesArray,
                    facebook_image: SocialPostFacebookImagesArray,
                    instagram_handle: instagramHandle,
                },
                type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                is_viewed: false,
                signup_flag: false,
                unique_key: uniqueKey,
                first_ai_poll_generated: false,
                first_content_campaign: false,
                is_draft: socialPostDraft,
                campaign_chat_reference_id: campaignChatId,
                is_deleted: NOT_DELETED,
                created: getUtcDate()
            };

            // Add UGC upload flag if applicable
            if (ugcUploadGallerySocialPost) {
                insertChatData.ugc_upload_social_post_created = true;
            }

            // Add group-related fields if groupId is present
            if (groupId) {
                insertChatData.social_role_type = SOCIAL_POST_GENERATE_TYPE;
                insertChatData.group_id = groupId;
                insertChatData.group_slug = groupUserSlug;
                insertChatData.group_ref_key = groupRefKey;
            }

            // --- Insert chat data into tableAiCampaignChat ---
            const chatResult = await tableAiCampaignChat.insertOne(insertChatData);

            const newCampaignChatId = chatResult && chatResult.insertedId ? newObjectIdDefault(chatResult.insertedId) : "";

            // --- Return result object ---
            return {
                ai_campaign_parent_id: insertedId,
                ai_campaign_chat_id: newCampaignChatId,
                unique_key: uniqueKey,
                group_slug: groupUserSlug
            };
        } catch (err) {
            // Handle errors gracefully
            return {
                error: true,
                message: err.message || "An error occurred while saving the caption generated by image."
            };
        }
    }; // End saveCaptionGeneratedByImage();


    /**
     * Schedule the first post and generate a week of posts for the user.
     * Handles all DB queries using async/await and runs parallel queries with Promise.all.
     * @param {*} req 
     * @param {*} res 
     * @param {*} next 
     * @returns json response
     */
    this.generateWeekOfPostAndSchedule = async (req, res, next) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

        // Facebook page details
        let facebookPageId = loginUserData.facebook_page_id || "";
        let facebookPageAccessToken = loginUserData.facebook_page_access_token || "";

        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
        const aiWebInfo = db.collection(TABLE_WEB_AI_INFO);

        let totalAutomaticPostGenerated = 1;

        // Check for missing parameters
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Run count and user info queries in parallel
            const [existingCount, webInfoResult] = await Promise.all([
                // Count auto-generated social media campaigns for this user
                tableAiCampaignChat.countDocuments({
                    auto_generate: true,
                    type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                    user_id: userId
                }),
                // Fetch user's web info and social presence data
                aiWebInfo.findOne({ user_id: userId })
            ]);

            // Extract and prepare data from webInfoResult
            let webInfoData = webInfoResult?.data || {};
            let socialMediaPresence = webInfoResult?.social_media_presence || {};
            let allInstagramPosts = webInfoResult?.all_instagram_posts || [];
            let apifyInstagramData = webInfoResult?.apify_instagram_data || {};
            let allInstagramPostsFromApify = webInfoResult?.all_instagram_posts_from_apify || [];

            let bucketSaveTasks = [];

            // Prepare and save About Business bucket if data exists
            if (Object.keys(webInfoData).length > 0) {
                let bucketData = {
                    business_info: webInfoData.businessInfo || {},
                    business_categories: webInfoData.businessCategories || [],
                    key_products: webInfoData.keyProducts || [],
                    home_services: webInfoData.services || [],
                    social_links: webInfoData.socialLinks || {},
                    contact_info: webInfoData.contactInfo || {},
                    menu: webInfoData.Menu || "",
                    about: webInfoData.About || "",
                };

                bucketSaveTasks.push(
                    saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                        parent_bucket: PARENT_BUCKET_ABOUT_BUSINESS,
                        data: bucketData
                    })
                );
            }

            // Prepare and save Social Media Presence bucket if data exists
            if (Object.keys(socialMediaPresence).length > 0) {
                let completeSocialData = {
                    business_info: socialMediaPresence.businessInfo || {},
                    audience_engagement: socialMediaPresence.audienceEngagement || {},
                    posting_habits: socialMediaPresence.postingHabits || {},
                    writing_style: socialMediaPresence.writingStyle || {},
                    visual_content: socialMediaPresence.visualContent || {},
                    recommendations: socialMediaPresence.recommendations || {},
                    top_posts: socialMediaPresence.topPosts || [],
                    all_posts: allInstagramPosts.length > 0 ? allInstagramPosts : []
                };

                bucketSaveTasks.push(
                    saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_SOCIAL_PRESENCE,
                        parent_bucket: PARENT_BUCKET_SOCIAL_PRESENCE,
                        data: completeSocialData
                    })
                );
            }

            // Prepare and save Apify Data bucket if data exists
            if (Object.keys(apifyInstagramData).length > 0) {
                let completeApifyData = {
                    business_info: apifyInstagramData.businessInfo || {},
                    audience_engagement: apifyInstagramData.audienceEngagement || {},
                    posting_habits: apifyInstagramData.postingHabits || {},
                    writing_style: apifyInstagramData.writingStyle || {},
                    visual_content: apifyInstagramData.visualContent || {},
                    recommendations: apifyInstagramData.recommendations || {},
                    top_posts: apifyInstagramData.topPosts || [],
                    all_posts: allInstagramPostsFromApify.length > 0 ? allInstagramPostsFromApify : []
                };

                bucketSaveTasks.push(
                    saveCustomerBucketItems({
                        user_id: userId,
                        bucket_name: DATA_BUCKET_APIFY_DATA,
                        parent_bucket: PARENT_BUCKET_APIFY_DATA,
                        data: completeApifyData
                    })
                );
            }

            // Save all customer bucket items in parallel
            if (bucketSaveTasks.length > 0) {
                await Promise.all(bucketSaveTasks);
            }

            // If no auto-generated campaigns exist, generate onboarding posts and schedule the first one
            if (existingCount === 0) {
                let optionsChatDetails = {
                    user_id: newObjectIdDefault(userId),
                    first_content_campaign: true,
                    type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                };

                // Generate 7 onboarding social posts and schedule them
                let totalPosts = await generateOnboardingSocialPostAndSchedule(req, res, loginUserData);
                let totalSchedulePosts = (totalPosts.status === STATUS_SUCCESS) ? totalPosts.total_posts : 0;

                totalAutomaticPostGenerated += totalSchedulePosts;

                // Fetch the first campaign chat details
                let aiCampaignChatDetails = await tableAiCampaignChat.findOne(optionsChatDetails);

                // If the campaign is not already scheduled, schedule it and update user/campaign info in parallel
                if (aiCampaignChatDetails && aiCampaignChatDetails.is_scheduled !== true) {
                    let scheduleFirstCampaign = {
                        title_name: aiCampaignChatDetails.content.title,
                        schedule_date: getDateWithSchedule(1, "06:00:00"),
                        user_id: userId,
                        unique_key: aiCampaignChatDetails.unique_key,
                        ai_campaign_parent_id: aiCampaignChatDetails.ai_campaign_parent_id,
                        ai_campaign_chat_id: aiCampaignChatDetails._id,
                        type: AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                        instagram_enable: true,
                        facebook_enable: true,
                        facebook_page_id: facebookPageId,
                        facebook_page_access_token: facebookPageAccessToken,
                    };

                    // Schedule the post and update campaign/user info in parallel
                    await Promise.all([
                        schedulePostInsertData(req, res, scheduleFirstCampaign),
                        tableAiCampaignChat.updateOne(
                            optionsChatDetails,
                            { $set: { is_scheduled: true, system_generate: true, created: getUtcDate() } }
                        ),
                        users.updateOne(
                            { _id: newObjectIdDefault(userId) },
                            {
                                $set: {
                                    auto_generate_social_post_after_yes_click: true,
                                    yes_automatic_schedule: false,
                                    total_automatic_post_generated: totalAutomaticPostGenerated,
                                    onboarding_post_created: true
                                }
                            }
                        ),
                    ]);
                }

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.week_of_post_created_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // If already scheduled, send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.content_library.week_of_post_created_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle errors gracefully and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.content_library.already_schedule_post"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // End generateWeekOfPostAndSchedule

    /**
     * Function to update user social preferences for Instagram or Facebook post.
     * Handles all DB queries using async/await for clean and modern code.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updateUserSocialPreferencesForImage = async (req, res) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

        // Extract post_on_instagram and post_on_facebook from request body
        let postOnInstagram = (typeof req.body.post_on_instagram !== 'undefined') ? req.body.post_on_instagram : undefined;
        let postOnFacebook = (typeof req.body.post_on_facebook !== 'undefined') ? req.body.post_on_facebook : undefined;

        // If ai_campaign_chat_user_id is provided, override userId
        let aiCampaignChatUserId = (req.body.ai_campaign_chat_user_id) ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
        if (aiCampaignChatUserId !== '') {
            userId = aiCampaignChatUserId;
        }

        // Check for missing userId
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            const users = db.collection(TABLE_USERS);
            let updateData = {};

            // Prepare update data for social preferences
            if (typeof postOnInstagram !== 'undefined') {
                updateData['post_on_instagram'] = postOnInstagram;
            }
            if (typeof postOnFacebook !== 'undefined') {
                updateData['post_on_facebook'] = postOnFacebook;
            }

            // Update user document in database
            await users.updateOne(
                { _id: newObjectIdDefault(userId) },
                { $set: updateData }
            );

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.user.user_has_been_updated_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // End updateUserSocialPreferencesForImage();

    /**
     * Function used to update user onboarding data for navigation.
     * Handles all DB queries using async/await for clean and modern code.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.updateUserOnboardingDataForNavigation = async (req, res) => {
        let finalResponse = {};
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

        // Extract onboarding navigation fields from request body
        let visiteBrandIdentity = req.body.visite_brand_identity ? req.body.visite_brand_identity : "";
        let visiteHowToVideo = req.body.visite_how_to_video ? req.body.visite_how_to_video : "";
        // let visiteQrCodeSignups = req.body.visite_qr_code_signups ? req.body.visite_qr_code_signups : "";
        // let visiteInsidersPortals = req.body.visite_insiders_portals ? req.body.visite_insiders_portals : "";
        // let visiteInsidersFeedbacks = req.body.visite_insiders_feedbacks ? req.body.visite_insiders_feedbacks : "";
        let visiteContentCreationSection = req.body.visite_content_creation_section ? req.body.visite_content_creation_section : "";
        let visiteCollaborationPortals = req.body.visite_collaboration_portals ? req.body.visite_collaboration_portals : "";
        let viewMyProfile = req.body.view_my_profile ? req.body.view_my_profile : "";

        // Check for missing userId
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare update data object
        let updateData = {};

        // Set onboarding navigation flags if present in request
        if (visiteBrandIdentity) {
            updateData['visite_brand_identity'] = true;
        }
        // if (visiteQrCodeSignups) {
        //     updateData['visite_qr_code_signups'] = true;
        // }
        // if (visiteInsidersPortals) {
        //     updateData['visite_insiders_portals'] = true;
        // }
        // if (visiteInsidersFeedbacks) {
        //     updateData['visite_insiders_feedbacks'] = true;
        // }
        if (visiteHowToVideo) {
            updateData['visite_how_to_video'] = true;
        }
        if (visiteCollaborationPortals) {
            updateData['visite_collaboration_portals'] = true;
        }
        if (visiteContentCreationSection) {
            updateData['visite_content_creation_section'] = true;
        }
        if (viewMyProfile) {
            updateData['view_my_profile'] = true;
        }

        try {
            // Get users collection
            const users = db.collection(TABLE_USERS);

            // Update user document in database using async/await
            await users.updateOne({ _id: newObjectIdDefault(userId) }, { $set: updateData });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.user.user_has_been_updated_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // End updateUserOnboardingDataForNavigation();

}
module.exports = new SocialContentLibrary();