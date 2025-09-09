const ObjectId = require('mongodb').ObjectID;
const async = require('async');
const axios = require('axios');
const FormData = require('form-data');
const request = require('request');
const fs = require('fs');
/**
 * Retrieves text data from a specified website URL using the Gemini API.
 * 
 * @param {Object} options - Options object containing the website URL.
 * @param {string} options.website_url - The URL of the website to retrieve text data from.
 * 
 * @returns {Promise<Object>} A promise resolving to an object containing the status, response, and message.
 */
getWebsiteTextData = (options) => {
    /**Return a new promise that resolves with the result of the asynchronous operation */
    return new Promise(async resolve => {

        let websiteUrl = (options.website_url) ? options.website_url : "";

        let url = GEMINI_API_URL + '/api/get_url_data_axios';

        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        /**Create an object to store the data options */
        let dataOptions = { data: { 'url': websiteUrl } }

        let reqData = jsonToBase64(dataOptions);
        formData.append('req', reqData);

        try {
            /**Send a POST request to the API with the form data. */
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            /**Convert the response data from base64 to JSON */
            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                /**Extract the final response from the response data. */
                let finalResponse = responseData.result || "";

                return resolve({ status: STATUS_SUCCESS, result: finalResponse, message: "" });

            } else {

                return resolve({ status: STATUS_ERROR, result: {}, message: "" });
            }
        } catch (error) {

            return resolve({ status: STATUS_ERROR, result: {}, message: error.message || "An error occurred" });
        }
    });
}; //End getWebsiteTextData();

/*
* Function  used to generate caption from video using GEMINI Ai
* @param {*} req 
* @param {*} res 
*  @param {*} options 
* @returns json response
*/
getVideoCaption = (req, res, options) => {
    return new Promise(async resolve => {
        let imagesLength = (req.body.images_length) ? req.body.images_length : 0;
        let videoLength = (req.body.video_length) ? req.body.video_length : 0;

        let videoUrls = (options.video_urls) ? options.video_urls : [];
        let imageUrls = (options.image_urls) ? options.image_urls : [];

        let businessName = (options.business_name) ? options.business_name : "";
        let description = (options.description) ? options.description : "";
        let finalPrompt = (options.prompt) ? options.prompt : "";


        let imageFiles = Array.from({ length: imagesLength }, (_, i) => req.files?.[`ai_social_image_${i}`]);
        let videoFiles = Array.from({ length: videoLength }, (_, i) => req.files?.[`video_file_name_${i}`]);

        let url = GEMINI_API_URL + '/api/get_video_caption';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        /**Append video files as an array*/
        if (videoFiles.length > 0) {
            videoFiles.forEach((videoFile) => {
                try {
                    if (videoFile.data instanceof Buffer) {
                        formData.append('video_files', videoFile.data, videoFile.name);
                    } else if (videoFile.tempFilePath || videoFile.path) {
                        formData.append('video_files', fs.createReadStream(videoFile.tempFilePath || videoFile.path), videoFile.name);
                    } else {
                        throw new Error("Invalid video file data.");
                    }
                } catch (fsError) {

                    return resolve({
                        status: STATUS_ERROR,
                        response: {},
                        message: "Error processing video file.",
                    });
                }
            });
        }

        /**Append image files as an array*/
        if (imageFiles.length > 0) {
            imageFiles.forEach((imageFile) => {
                try {
                    if (imageFile.data instanceof Buffer) {
                        formData.append('image_files', imageFile.data, imageFile.name);
                    } else if (imageFile.tempFilePath || imageFile.path) {
                        formData.append('image_files', fs.createReadStream(imageFile.tempFilePath || imageFile.path), imageFile.name);
                    } else {
                        throw new Error("Invalid image file data.");
                    }
                } catch (fsError) {

                    return resolve({
                        status: STATUS_ERROR,
                        response: {},
                        message: "Error processing image file.",
                    });
                }
            });
        }

        let dataOptions = {
            data: {
                video_urls: videoUrls,
                image_urls: imageUrls,
                prompt_data: {
                    'business_name': businessName,
                    'description': description,
                    'prompt': finalPrompt,
                }
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {

                let finalResponse = responseData.result || "";
                let hashTags = finalResponse?.hashtags || '';
                let postCaption = finalResponse?.caption || "";

                let socialPost = {
                    "title": finalResponse?.title,
                    "captions": postCaption + "\n" + hashTags,
                    "hashtags": hashTags,
                }

                return resolve({
                    status: STATUS_SUCCESS,
                    response: socialPost,
                    message: ""
                });
            } else {
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}; //End getVideoCaption();


/**
 *  Function for generate onboarding post data from gimini
 * @param {*} obj
 * @returns json
 */
const MAX_RETRIES = 2;
getOnboardingPostDataFromGimini = (options, attempt = 1) => {
    return new Promise(async resolve => {
        try {
            let businessIndustry = options.industry || "";
            let location = options.location || "";
            let dataVault = options.data_vault || "";
            let topPosts = options.top_posts || "";
            let lastCaptions = options.last_captions || "";
            let instagramUser = options.instagram_user || "";

            let url = (instagramUser) ? GEMINI_API_URL + '/api/generate_three_schedule_post_from_instagram_crawl' : GEMINI_API_URL + '/api/generate_three_schedule_post_from_website_crawl';
            let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;
            let formData = new FormData();

            let dataOptions = {
                data: {
                    'prompt_data': {
                        'business_industry': businessIndustry,
                        'top_posts': topPosts,
                        'business_location': location,
                        'all_supporting_data': dataVault,
                        'last_captions': lastCaptions
                    }
                }
            };

            let reqData = jsonToBase64(dataOptions);
            formData.append('req', reqData);

            /**Make POST request*/
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let body = captionResponse.data;

            if (!body) {
                if (attempt < MAX_RETRIES) {
                    const retryResult = await getOnboardingPostDataFromGimini(options, attempt + 1);
                    return resolve(retryResult);
                } else {
                    return resolve({
                        status: STATUS_ERROR,
                        result: [],
                        message: "Empty response from Gemini"
                    });
                }
            }

            let responseData = base64ToJson(body);

            if (responseData.status === STATUS_SUCCESS) {
                return resolve({
                    status: STATUS_SUCCESS,
                    result: responseData.result || [],
                    message: ""
                });
            }
        } catch (err) {
            if (attempt < MAX_RETRIES) {
                const retryResult = await getOnboardingPostDataFromGimini(options, attempt + 1);
                return resolve(retryResult);
            } else {
                return resolve({
                    status: STATUS_ERROR,
                    result: [],
                    message: err.message || "Unknown error"
                });
            }
        }
    });
};
//End getOnboardingPostDataFromGimini();

/**
 *  Function for generate first onboarding post data from gimini
 * @param {*} obj
 * @returns json
 */
getFirstOnboardingCaption = (req, res, options) => {
    return new Promise(async resolve => {

        let videoUrls = (options.video_urls) ? options.video_urls : [];
        let imageUrls = (options.image_urls) ? options.image_urls : [];
        let finalPrompt = (options.prompt) ? options.prompt : "";

        let url = GEMINI_API_URL + '/api/get_first_onboarding_caption';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'video_urls': videoUrls,
                'image_urls': imageUrls,
                'prompt': finalPrompt
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {

                let finalResponse = responseData.result || "";

                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}; //End getFirstOnboardingCaption();


/*
* Function  used to generate caption with or without media
* @param {*} req 
* @param {*} res 
*  @param {*} options 
* @returns json response
*/
getCaptionWithOrWithoutMedia = (req, res, options) => {
    return new Promise(async resolve => {
        let imageUrls = options.image_urls || [];
        let videoUrls = options.video_urls || [];
        let pdfUrl = options.pdf_url || "";
        let description = options.description || "";
        let finalPrompt = options.prompt || "";
        let fileName = options.file_name || "";
        let extension = options.extension || "";
        let temperature = options.temperature || "";
        let pdfFile = req.files || "";

        let url = GEMINI_API_URL + '/api/generate_caption_with_or_without_media';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        /**Append pdf files*/
        if (pdfFile && extension == "pdf") {
            let uploadedFile = (req.files && req.files[fileName]) ? req.files[fileName] : "";

            if (uploadedFile.data instanceof Buffer) {
                formData.append('pdf_file', uploadedFile.data, uploadedFile.name);
            } else {
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: "Invalid PDF file data."
                });
            }
        }

        let dataOptions = {
            data: {
                image_urls: imageUrls,
                video_urls: videoUrls,
                pdf_url: pdfUrl,
                prompt_data: {
                    'description': description,
                    'prompt': finalPrompt,
                    'temperature': temperature
                }
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {

                let finalResponse = responseData.result || "";
                let hashTags = finalResponse?.hashtags || '';
                let postCaption = finalResponse?.caption || "";

                let socialPost = {
                    "title": finalResponse?.title,
                    "caption": postCaption,
                    "hashtags": hashTags,
                }

                return resolve({
                    status: STATUS_SUCCESS,
                    response: socialPost,
                    message: ""
                });
            } else {
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}; //End getCaptionWithOrWithoutMedia();


/**
 *  Function for generate first onboarding post data from gimini
 * @param {*} obj
 * @returns json
 */
getEmailDripData = (req, res, options) => {
    return new Promise(async resolve => {

        let url = GEMINI_API_URL + '/api/get_email_drip_data';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'prompt_data': finalPrompt
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
};

/**
 *  Function for generate data vault details from gimini
 * @param {*} obj
 * @returns json
 */
generateDataVaultDetails = (req, res, options) => {
    return new Promise(async resolve => {
        let type = (options.type) ? options.type : "";
        let paragraph = (options.paragraph) ? options.paragraph : "";
        let instagramData = (options.instagram_data) ? options.instagram_data : "";

        let url = GEMINI_API_URL + '/api/get_data_vault_details';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'type': type,
                'paragraph': paragraph,
                'instagram_data': instagramData,
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function for generate data vault details from gimini
 * @param {*} obj
 * @returns json
 */
generateDataVaultFallbackProcess = (req, res, options) => {
    return new Promise(async resolve => {

        let websiteUrl = (options.website_url) ? options.website_url : "";
        let businessName = (options.business_name) ? options.business_name : "";
        let industry = (options.industry) ? options.industry : "";
        let zipcode = (options.zipcode) ? options.zipcode : "";
        let information = (options.information) ? options.information : "";

        let url = GEMINI_API_URL + '/api/search_website_data_for_fallback_process';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'website_url': websiteUrl,
                'business_name': businessName,
                'industry': industry,
                'zipcode': zipcode,
                'information': information
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function for generate insiders
 * @param {*} obj
 * @returns json
 */
generateInsiders = (req, res, options) => {
    return new Promise(async resolve => {
        let businessInfo = (options.businessInfo) ? options.businessInfo : "";
        let campaignName = (options.campaign_name) ? options.campaign_name : "";
        let services = (options.services) ? options.services : "";
        let insiderCampaign = (options.insider_campaign) ? options.insider_campaign : "";
        let firstCampaign = (options.first_campaign) ? options.first_campaign : "";

        let url = GEMINI_API_URL + '/api/generate_insiders_data';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'businessInfo': businessInfo,
                'campaign_name': campaignName,
                'services': services,
                'insider_campaign': insiderCampaign,
                'first_campaign': firstCampaign
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function for generate data vault details from gimini
 * @param {*} obj
 * @returns json
 */
generateRewardData = (req, res, options) => {
    return new Promise(async resolve => {
        let prompt = (options.prompt) ? options.prompt : "";

        let url = GEMINI_API_URL + '/api/generate_reward_template';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'prompt': prompt,
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function common for gemini without grounding
 * @param {*} obj
 * @returns json
 */
commonForGeminiWithoutGrounding = (req, res, options) => {
    return new Promise(async resolve => {
        let prompt = (options.prompt) ? options.prompt : "";
        let formatSchema = (options.format_schema) ? options.format_schema : {};

        let url = GEMINI_API_URL + '/api/generate_common_data_without_grounding';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'prompt': prompt,
                'format_schema': formatSchema
            }
        }

        let reqData = jsonToBase64(dataOptions);
        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function common for gemini with grounding
 * @param {*} obj
 * @returns json
 */
commonForGeminiWithGrounding = (req, res, options) => {
    return new Promise(async resolve => {
        let prompt = (options.prompt) ? options.prompt : "";
        let format = (options.format) ? options.format : "";

        let url = GEMINI_API_URL + '/api/generate_common_data_with_grounding';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'prompt': prompt,
                'format': format
            }
        }

        let reqData = jsonToBase64(dataOptions);
        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);
            
            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function for generate supporting content data
 * @param {*} obj
 * @returns json
 */
generateSupportingContentData = (req, res, options) => {
    return new Promise(async resolve => {
        let businessInfo = (options.data_vault) ? options.data_vault : "";
        let businessName = (options.business_name) ? options.business_name : "";
        let services = (options.services) ? options.services : "";
        let seoKeywords = (options.seo_keywords) ? options.seo_keywords : "";
        let industry = (options.industry) ? options.industry : "";
        let zipCode = (options.zipcode) ? options.zipcode : "";
        let topic = (options.topic) ? options.topic : "";

        let url = GEMINI_API_URL + '/api/generate_supporting_content_data';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'data_vault': businessInfo,
                'business_name': businessName,
                'services': services,
                'seo_keywords': seoKeywords,
                'industry': industry,
                'zipcode': zipCode,
                'topic': topic
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function common edit supporting contents
 * @param {*} obj
 * @returns json
 */
editSupportingContents = (req, res, options) => {
    return new Promise(async resolve => {
        let chatHistory = (options.chat_history) ? options.chat_history : [];
        let content = (options.content) ? options.content : "";
        let formatSchema = (options.format_schema) ? options.format_schema : {};
        let systemInstruction = (options.system_instruction) ? options.system_instruction : "";

        let url = GEMINI_API_URL + '/api/edit_supporting_contents';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'chat_history': chatHistory,
                'content': content,
                'format_schema': formatSchema,
                'system_instruction': systemInstruction
            }
        }

        let reqData = jsonToBase64(dataOptions);
        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}


/**
 *  Function for generate social reachout content data
 * @param {*} obj
 * @returns json
 */
generateSocialReachoutContentData = (req, res, options) => {
    return new Promise(async resolve => {
        let prompt = (options.prompt) ? options.prompt : "";
        let socialReachoutDay = (options.social_reachout_day) ? options.social_reachout_day : "";


        let url = GEMINI_API_URL + '/api/generate_social_reachout_content_data';
        let authorization = process.env.GEMINI_API_HEADER_AUTH_KEY;

        let formData = new FormData();

        let dataOptions = {
            data: {
                'prompt': prompt,
                'social_reachout_day': socialReachoutDay
            }
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'Authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let responseData = base64ToJson(captionResponse.data);

            if (responseData.status == STATUS_SUCCESS) {
                let finalResponse = responseData.result || "";
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: finalResponse,
                    message: ""
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message[0]['msg']
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}

/**
 *  Function for generate social reachout content data
 * @param {*} obj
 * @returns json
 */
generateCroneData = (req, res, options) => {
    return new Promise(async resolve => {

        let reqBodyData = (options.req_data) ? options.req_data : {};
        let methodName = (options.method_name) ? options.method_name : "";
        let authorization = (options.auth_token) ? options.auth_token : process.env.API_HEADER_AUTH_KEY;


        // let url = FRONT_URL + 'api/' + methodName;
        let url = "https://api-uat2.pocial.com/api/" + methodName;

        let formData = new FormData();

        let dataOptions = {
            data: reqBodyData
        }

        let reqData = jsonToBase64(dataOptions);

        formData.append('req', reqData);

        try {
            let captionResponse = await axios.post(url, formData, {
                headers: {
                    'authorization': authorization,
                    ...formData.getHeaders()
                }
            });

            let apiRawData = captionResponse.data;


            // Step 1: Base64 decode
            let decodedString = Buffer.from(apiRawData.response, 'base64').toString('utf8');

            // Step 2: JSON parse
            let responseData = JSON.parse(decodedString);
            if (responseData.status == STATUS_SUCCESS) {
                /**send success response **/
                return resolve({
                    status: STATUS_SUCCESS,
                    response: responseData,
                    message: responseData.message
                });
            } else {
                /**send error response */
                return resolve({
                    status: STATUS_ERROR,
                    response: {},
                    message: responseData.message
                });
            }
        } catch (error) {
            console.log(error)
            /**send error response */
            return resolve({
                status: STATUS_ERROR,
                response: {},
                message: error.message || "An error occurred"
            });
        }
    });
}
