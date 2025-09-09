const async = require('async');
const heartChampions = db.collection(TABLE_HEART_CHAMPIONS);

function HeartOfChampion() {

    /**
     * Function to create heart of champions
     * Uses async/await for all DB/file operations for faster and cleaner response.
     * @param {*} req 
     * @param {*} res 
     * @return json 
     **/
    this.createHeartChampion = async (req, res) => {
        let finalResponse = {};

        // Extract request data
        let uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
        let ipAddr = req.body.ip ? req.body.ip : "";
        let tags = req.body.tags ? req.body.tags : "";
        let description = req.body.description ? req.body.description : "";
        let image = (req.files && req.files.image) ? req.files.image : "";

        // Validate required fields
        if (!uniqueBrowserId || !ipAddr) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        let imageArray = [];
        let imageUrl = "";
        let videoUrl = "";

        // Prepare options for file upload
        let optionsAiSocial = {
            image: image,
            ai_social_image_submit: true,
            filePath: AI_SOCIAL_IMAGES_FILE_PATH,
            allowedExtensions: ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
            allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
            allowedMimeTypes: ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
            allowedMimeError: ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
            allowedSizeErrorMessage: ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
            size: MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
        };

        try {
            // Handle file upload and processing
            let responseAiSocial = await moveUploadedFile(req, res, optionsAiSocial);

            if (responseAiSocial && responseAiSocial.status === STATUS_SUCCESS) {
                let imageName = responseAiSocial.fileName || "";
                let imageExtension = responseAiSocial.image_extension || "";

                if (imageName && imageExtension) {
                    // If video, convert for Instagram and update file path
                    if (imageExtension === 'mp4' || imageExtension === 'mov') {
                        const randomNumber = Math.floor(10 + Math.random() * 90); // 2-digit random number
                        let updatedFilePath = "";

                        if (imageExtension === 'mp4') {
                            updatedFilePath = imageName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
                        } else if (imageExtension === 'mov') {
                            updatedFilePath = imageName.replace(/\.mov$/, `-${randomNumber}.mov`);
                        }

                        await convertVideoToFFmpegForInstagram({
                            videoURL: UPLOAD_TO_S3 ? AI_SOCIAL_IMAGES_URL + imageName : AI_SOCIAL_IMAGES_FILE_PATH + imageName,
                            outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
                            targetFolder: 'ai_social_images/' + updatedFilePath
                        });

                        videoUrl = AI_SOCIAL_IMAGES_URL + imageName;
                        imageArray.push({
                            _id: newObjectIdDefault(),
                            name: updatedFilePath,
                            extension: imageExtension,
                            post_on_instagram: postOnInstagram
                        });
                    } else {
                        // If image, resize for Instagram post
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

                        imageUrl = AI_SOCIAL_IMAGES_URL + imageName;
                    }
                }
            }

            // Compose the AI prompt for caption generation
            const promptDescription = "Optional light context goes here"; // replace with your actual description
            const userFinalPrompt = `
            You're a social media storyteller. Analyze the uploaded image or video and create a short, powerful Instagram caption that draws purely from the visual content.
            - The caption must reflect resilience, strength, or courage.
            - It should be clever, emotionally engaging, and concise.
            - Do not include hashtags, emojis, or fictional elements.
            - Use the following description only as light context — do not expand beyond what is visually shown.
                        
            Description (for reference only): ${promptDescription}

            Your task: Let the image speak. Let the caption echo its strength.
            `;

            console.log(userFinalPrompt);

            // Prepare options for AI caption generation
            let optionsData = {
                prompt: userFinalPrompt,
                video_urls: [], // (videoUrl && LIVE_SERVER_UPLOAD === true) ? [videoUrl] : [],
                image_urls: [
                    'https://d5cvgp25mt3yl.cloudfront.net/uploads/ugc_gallery/JUL2025/11/17522344781647-need-social-post-image.png'
                    // (imageUrl && LIVE_SERVER_UPLOAD === true) ? [imageUrl] : [],
                ],
                temperature: 0.7
            };

            // Generate caption using AI
            let generatedCaption = await getCaptionWithOrWithoutMedia(req, res, optionsData);
            let responseData = (generatedCaption.status === STATUS_SUCCESS) ? generatedCaption.response : "";

            // Save data to DB
            await heartChampions.insertOne({
                unique_ai_browser_id: uniqueBrowserId,
                ip_addr: ipAddr,
                content: responseData,
                is_deleted: NOT_DELETED,
                created: getUtcDate(),
            });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: responseData,
                    message: res.__("front.heart_champion.social_post_created_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            console.log(error);
            // Send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: "",
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end createHeartChampion();

    /**
     * Function to get heart champion details
     * Uses async/await for DB operations for cleaner and faster response.
     * @param {*} req 
     * @param {*} res 
     */
    this.getHeartChampionDetails = async (req, res) => {
        let finalResponse = {};

        // Extract unique browser ID and IP address from request body
        let uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
        let ipAddr = req.body.ip ? req.body.ip : "";

        // Validate required fields
        if (!ipAddr || !uniqueBrowserId) {
            // Send error response if required fields are missing
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
            // Query the heartChampions collection for the given browser ID and IP address
            const heartChampionsData = await heartChampions.findOne({
                unique_ai_browser_id: uniqueBrowserId,
                ip_addr: ipAddr
            });

            if (!heartChampionsData) {
                // Send error response if no record is found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.global.no_record_found"),
                    }
                };
            } else {
                // Send success response with the found data
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: heartChampionsData,
                        message: "",
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle unexpected errors and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

}
module.exports = new HeartOfChampion();