const ObjectId = require('mongodb').ObjectID;
const async = require('async');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const url = require("url");
const _ = require("lodash");
const request = require("request");
const cheerio = require('cheerio');
const asyncParallel = require('async/parallel');
const sharp = require('sharp');
const puppeteer = require('puppeteer');
const http = require('http');
const https = require('https');
const moment = require('moment');
const { exec } = require("child_process");
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});


/**
 * Function to retrieve OpenAI response using async/await for faster and cleaner execution.
 * Handles retries with exponential backoff and formats/validates AI responses as needed.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Options object containing system prompt, user prompt
 * @param {Number} retryCount - Current retry attempt
 * @param {Number} maxRetries - Maximum number of retries
 * @returns {Promise<Object>} - Promise resolving with OpenAI response
 */
getOpenAiResponse = async (req, res, options, retryCount = 0, maxRetries = 2) => {
    // Extract system prompt, user prompt, and type from options
    const systemPrompt = options.system_prompt || {};
    const userPrompt = options.user_prompt || {};
    const type = options.type || {};

    // Combine system prompt and user prompt into a single array
    const allChat = [systemPrompt, userPrompt];

    try {
        // Send request to OpenAI's chat completion API
        const result = await openai.createChatCompletion({
            model: "gpt-4o",
            messages: allChat,
            temperature: TEMPERATURE,
            top_p: TOP_P,
            frequency_penalty: FREQUENCY_PENALTY,
            presence_penalty: PRESENCE_PENALTY
        });

        // Extract response from OpenAI
        const response = result.data.choices[0].message.content;
        let AiArrayResponse = response;

        // Try to parse response as JSON
        try {
            let arrayResponseData = JSON.parse(AiArrayResponse);

            // If response is for SEO blog, check and format blog text if needed
            if (type == AI_RESPONSE_TYPE_SEO) {
                let blogText = arrayResponseData[AI_RESPONSE_TYPE_SEO].blog_text;
                if (blogText.indexOf("\n") === -1) {
                    // Format blog text asynchronously
                    let optionDataObj = { text: blogText, type: AI_RESPONSE_TYPE_SEO };
                    let responseNewSeo = await formattingValidData(req, res, optionDataObj);
                    arrayResponseData[AI_RESPONSE_TYPE_SEO].blog_text = responseNewSeo.data;
                }
                return { status: STATUS_SUCCESS, type: AI_RESPONSE_TYPE_SEO, response: arrayResponseData };
            } else {
                return { status: STATUS_SUCCESS, type: type, response: arrayResponseData };
            }
        } catch (e) {
            // If response is not valid JSON, try to generate valid JSON data
            let validData = await validAiResponse(AiArrayResponse);
            let newResponseData = validData.response;

            try {
                let newResponse = JSON.parse(newResponseData);

                if (type == AI_RESPONSE_TYPE_SEO) {
                    let blogText = newResponse[AI_RESPONSE_TYPE_SEO].blog_text;
                    if (blogText.indexOf("\n") === -1) {
                        let optionDataObj = { text: blogText, type: AI_RESPONSE_TYPE_SEO };
                        let responseNewSeo = await formattingValidData(req, res, optionDataObj);
                        newResponse[AI_RESPONSE_TYPE_SEO].blog_text = responseNewSeo.data;
                    }
                    return { status: STATUS_SUCCESS, type: AI_RESPONSE_TYPE_SEO, response: newResponse };
                } else {
                    return { status: STATUS_SUCCESS, type: type, response: newResponse };
                }
            } catch (err) {
                // If still not valid JSON, try one more time
                let validDataAgain = await validAiResponse(AiArrayResponse);
                let newResponseDataGenerate = validDataAgain.response;

                try {
                    let newResponse1 = JSON.parse(newResponseDataGenerate);

                    if (type == AI_RESPONSE_TYPE_SEO) {
                        let blogText = newResponse1[AI_RESPONSE_TYPE_SEO].blog_text;
                        if (blogText.indexOf("\n") === -1) {
                            let optionDataObj = { text: blogText, type: AI_RESPONSE_TYPE_SEO };
                            let responseNewSeo = await formattingValidData(req, res, optionDataObj);
                            newResponse1[AI_RESPONSE_TYPE_SEO].blog_text = responseNewSeo.data;
                        }
                        return { status: STATUS_SUCCESS, type: AI_RESPONSE_TYPE_SEO, response: newResponse1 };
                    } else {
                        return { status: STATUS_SUCCESS, type: type, response: newResponse1 };
                    }
                } catch (error) {
                    // If all attempts fail, retry with exponential backoff or return error
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
                        return await getOpenAiResponse(req, res, options, retryCount + 1, maxRetries);
                    } else {
                        return { status: STATUS_ERROR, type: type, response: error };
                    }
                }
            }
        }
    } catch (aiError) {
        // If OpenAI request fails, retry with exponential backoff or return error
        if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            return await getOpenAiResponse(req, res, options, retryCount + 1, maxRetries);
        } else {
            return { status: STATUS_ERROR, type: type, response: aiError };
        }
    }
};

/**
 * Function to retrieve OpenAI response for email editing using async/await.
 * Handles Gemini and OpenAI queries, with robust error handling and clean formatting.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Options object containing system prompt, user prompt, and previous chat
 * @returns {Promise<Object>} - Promise resolving with OpenAI response
 */
getOpenAiEmailResponse = async (req, res, options) => {
    // Extract prompts and previous chat from options
    const systemPrompt = options.system_prompt || {};
    const userPrompt = options.user_prompt || {};
    const previousChat = options.previous_chat || [];
    const systemPromptWithoutFormat = options.system_prompt_without_format || "";
    const userPromptWithoutFormat = options.user_prompt_without_format || "";

    // Prepare chat history: use previous chat if available, else use system and user prompts
    let allChatHistory = previousChat.length > 0 ? previousChat : [systemPrompt, userPrompt];

    try {
        // If Gemini server is enabled, use Gemini API
        if (GEMINI_SERVER_ENABLE === true) {
            // Prepare chat history for Gemini format
            const chatHistory = allChatHistory
                .filter(item => item.role !== 'system')
                .map(item => ({
                    role: item.role === 'assistant' ? 'model' : item.role,
                    parts: [{ text: item.content }]
                }));

            // Prepare Gemini options
            const geminiOptions = {
                chat_history: chatHistory,
                content: userPromptWithoutFormat,
                format_schema: EMAIL_EDIT_SCHEMA,
                system_instruction: systemPromptWithoutFormat
            };

            // Call Gemini function
            const geminiData = await editSupportingContents(req, res, geminiOptions);
            const newResponse = geminiData?.response || {};

            if (geminiData.status === STATUS_SUCCESS) {
                return { status: STATUS_SUCCESS, response: newResponse };
            } else {
                return { status: STATUS_ERROR, response: {} };
            }
        } else {
            // Use OpenAI API with async/await
            try {
                // Create OpenAI chat completion request
                const result = await openai.createChatCompletion({
                    model: "gpt-4o",
                    messages: allChatHistory,
                    temperature: TEMPERATURE
                });

                // Extract response content from OpenAI result
                let response = result.data.choices[0].message.content;
                let aiArrayResponse = response;

                // Try to parse response as JSON
                try {
                    let arrayResponseData = JSON.parse(aiArrayResponse);
                    return { status: STATUS_SUCCESS, response: arrayResponseData };
                } catch (e) {
                    // If not valid JSON, try to get valid JSON using validAiResponse
                    let validData = await validAiResponse(aiArrayResponse);
                    let newResponseData = validData.response;

                    try {
                        let newResponse = JSON.parse(newResponseData);
                        return { status: STATUS_SUCCESS, response: newResponse };
                    } catch (err) {
                        // Try one more time to get valid JSON
                        let validDataAgain = await validAiResponse(aiArrayResponse);
                        let newResponseDataGenerate = validDataAgain.response;

                        try {
                            let newResponse1 = JSON.parse(newResponseDataGenerate);
                            return { status: STATUS_SUCCESS, response: newResponse1 };
                        } catch (error) {
                            // All attempts failed, return error
                            return { status: STATUS_ERROR, response: error };
                        }
                    }
                }
            } catch (aiError) {
                // OpenAI request failed, return error
                return { status: STATUS_ERROR, response: aiError };
            }
        }
    } catch (error) {
        // Catch any unexpected errors and return error
        return { status: STATUS_ERROR, response: error };
    }
}; // end getOpenAiEmailResponse

/**
 * Formats a string by breaking it into small, logical, and meaningful paragraphs
 * for enhanced reading experience using OpenAI. Uses async/await for faster and cleaner execution.
 * 
 * @param {*} req - Request object
 * @param {*} res - Response object
 * @param {Object} options - Options object containing text and type
 * @return {Promise<Object>} - Promise resolving to a JSON object with formatted data and type
 */
formattingValidData = async (req, res, options) => {
    // Extract text and type from options object, defaulting to empty string if not provided
    const text = options.text ? options.text : "";
    const type = options.type ? options.type : "";

    // Define system content for formatting prompt
    const systemContent = `Your work is to break the user provided paragraph in small, logical and meaningful paragraph for enhancing the reading experience. While doing so separate the paragraph's with new line.`;

    // Create user content by appending text to a prompt
    const userContent = `Please break  this : ${text}`;

    // Create an array of objects representing the conversation
    const allNewData = [
        { role: "system", content: systemContent },
        { role: "user", content: userContent }
    ];

    try {
        // Send data to OpenAI for formatting using async/await
        const newResult = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: allNewData,
        });

        // Extract formatted response from OpenAI result
        const newResponse = newResult.data.choices[0].message.content;

        // Return the formatted data and type
        return { data: newResponse, type: type };
    } catch (error) {
        // Handle any errors and return an error object
        return { data: "", type: type, error: error };
    }
}; // end formattingValidData();

/**
 * Validates a given string data and returns a corrected JSON response using async/await.
 * Ensures clean formatting and faster response times.
 * @param {*} dataOptions - The string data to validate and correct.
 * @returns {Promise<Object>} A Promise that resolves to a JSON object containing the corrected response.
 */
validAiResponse = async (dataOptions) => {
    // Define the input data for the AI model
    const allStringData = [
        {
            role: "system",
            content: `Ensure that - 1. Provide response in valid JSON format. 2.Do not include backticks in the final result of JSON. 3. Do not include semicolon in result JSON.`,
        },
        {
            role: "user",
            content: `Please parse and correct the following JSON string (Return only valid JSON): ${dataOptions}`
        }
    ];

    try {
        // Create a chat completion using the OpenAI API with async/await for faster execution
        const newResult = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: allStringData,
        });

        // Extract the corrected response from the API result
        const newResponse = newResult.data.choices[0].message.content;

        // Return the formatted response object
        return { response: newResponse };
    } catch (error) {
        // Handle any errors and return an error object
        return { response: "", error: error };
    }
}; // end validAiResponse

/**
 * Retrieves an AI-generated social post for an email using async/await for cleaner and faster execution.
 * Handles retries with exponential backoff and ensures valid JSON response.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - Options for the AI model, including system and user prompts.
 * @param {Number} retryCount - Current retry attempt.
 * @param {Number} maxRetries - Maximum number of retries.
 * @returns {Promise<Object>} A promise resolving to a JSON object containing the AI-generated social post.
 */
getOpenAiSocialPostForEmail = async (req, res, options, retryCount = 0, maxRetries = 3) => {
    try {
        // Initialize prompts for the AI model
        const systemPrompt = options.system_prompt ? options.system_prompt : {};
        const userPrompt = options.user_prompt ? options.user_prompt : {};
        const prompt = options.prompt ? options.prompt : "";
        const reachoutDay = options.reachout_day ? options.reachout_day : "";

        // If Gemini is enabled, use the Gemini API to generate the social post
        if (GEMINI_SERVER_ENABLE === true) {
            const geminiResponse = await generateSocialReachoutContentData(req, res, { prompt, social_reachout_day: reachoutDay });
            if (geminiResponse.status === STATUS_SUCCESS) {
                return { status: STATUS_SUCCESS, response: geminiResponse.response };
            } else {
                return { status: STATUS_ERROR, response: {} };
            }
        }

        // Prepare prompts for OpenAI
        const allPrompt = [systemPrompt, userPrompt];

        // Create a chat completion with the OpenAI API using async/await
        const aiResult = await openai.createChatCompletion({
            model: "gpt-4o",
            messages: allPrompt,
            temperature: TEMPERATURE
        });

        // Extract and clean the AI response
        let aiResponse = aiResult.data.choices[0].message.content;
        let arrayResponse = aiResponse.replace(';', '');

        // Try to parse the AI response as JSON
        try {
            const arrayResponseData = JSON.parse(arrayResponse);
            return { status: STATUS_SUCCESS, response: arrayResponseData };
        } catch (e) {
            // If parsing fails, attempt to generate a valid JSON response up to 3 times
            for (let attempt = 0; attempt < 3; attempt++) {
                let validData = await validAiResponse(arrayResponse);
                let newResponseData = validData.response;
                try {
                    const newResponse = JSON.parse(newResponseData);
                    return { status: STATUS_SUCCESS, response: newResponse };
                } catch (err) {
                    // Continue to next attempt
                    arrayResponse = newResponseData;
                }
            }
            // If all attempts fail, retry the function with exponential backoff
            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
                return await getOpenAiSocialPostForEmail(req, res, options, retryCount + 1, maxRetries);
            } else {
                // If all retries fail, return an error response
                return { status: STATUS_ERROR, response: "Failed to parse AI response as valid JSON." };
            }
        }
    } catch (aiError) {
        // If the OpenAI API call fails, retry the function with exponential backoff
        if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
            return await getOpenAiSocialPostForEmail(req, res, options, retryCount + 1, maxRetries);
        } else {
            // If all retries fail, return an error response
            return { status: STATUS_ERROR, response: aiError };
        }
    }
}; // end getOpenAiSocialPostForEmail();

/**
 * Function to get data from a website URL using OpenAI, using async/await for cleaner and faster execution.
 * Handles retries with exponential backoff and ensures valid JSON response.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Options object containing system prompt and user prompt
 * @param {Number} retryCount - Current retry attempt
 * @param {Number} maxRetries - Maximum number of retries
 * @return {Promise<Object>} - Promise resolving to JSON data
 */
getWebsiteDataFromUrl = async (req, res, options, retryCount = 0, maxRetries = 2) => {
    try {
        // Set system prompt and user prompt from options object
        const systemPrompt = options.system_prompt ? options.system_prompt : "";
        const userPrompt = options.user_prompt ? options.user_prompt : "";
        const allNewChat = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ];

        // Create OpenAI chat completion using async/await
        const aiResult = await openai.createChatCompletion({
            model: "gpt-4o",
            messages: allNewChat,
            temperature: TEMPERATURE
        });

        // Get AI response content and clean it
        let aiResponse = aiResult.data.choices[0].message.content;
        let arrayResponse = aiResponse.replace(';', '');

        // Try to parse the AI response as JSON
        try {
            const arrayResponseData = JSON.parse(arrayResponse);
            return { status: STATUS_SUCCESS, response: arrayResponseData };
        } catch (e) {
            // If parsing fails, attempt to generate a valid JSON response up to 2 more times
            for (let attempt = 0; attempt < 2; attempt++) {
                let validData = await validAiResponse(arrayResponse);
                let newResponseData = validData.response;
                try {
                    const newResponse = JSON.parse(newResponseData);
                    return { status: STATUS_SUCCESS, response: newResponse };
                } catch (err) {
                    // Continue to next attempt with the new response data
                    arrayResponse = newResponseData;
                }
            }
            // If all attempts fail, retry the function with exponential backoff
            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
                return await getWebsiteDataFromUrl(req, res, options, retryCount + 1, maxRetries);
            } else {
                // If all retries fail, return an error response
                return { status: STATUS_ERROR, response: "Failed to parse AI response as valid JSON." };
            }
        }
    } catch (aiError) {
        // If the OpenAI API call fails, retry the function with exponential backoff
        if (retryCount < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
            return await getWebsiteDataFromUrl(req, res, options, retryCount + 1, maxRetries);
        } else {
            // If all retries fail, return an error response
            return { status: STATUS_ERROR, response: aiError };
        }
    }
}; // end getWebsiteDataFromUrl();

/**
 * Retrieves specific text from a PDF based on user input using async/await.
 * @param {Object} options - Options containing extracted_text and information_get_from_pdf.
 * @returns {Promise<Object>} A promise resolving to an object with status, extracted text, and the user's requested information.
 */
getSpecificDataWhichUSerWant = async (options) => {
    // Initialize variables with default values
    const extractedText = options.extracted_text || "";
    const informationGetFromPdf = options.information_get_from_pdf || "all details";

    try {
        // Define the prompts for the AI model
        const allPrompt = [
            {
                role: "system",
                content: `Please read the provided PDF data:${extractedText}, and respond according to the user's request. Ensure your response is accurate and concise, without any unnecessary explanation, as soon as the user asks. Make sure If no relevent data found for user's request then only response "no-data-found".`
            },
            {
                role: "user",
                content: `Extract : ${informationGetFromPdf}`
            }
        ];

        // Use the OpenAI API to create a chat completion
        const result = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: allPrompt,
        });

        // Extract the AI response
        const aiResponse = result.data.choices[0].message.content || "";

        // Return success response
        return {
            status: STATUS_SUCCESS,
            extracted_text: extractedText,
            response: aiResponse
        };
    } catch (error) {
        // Return error response if any error occurs
        return {
            status: STATUS_ERROR,
            extracted_text: extractedText || "",
            response: ""
        };
    }
}; // end getSpecificDataWhichUSerWant()

/**
 * Function for social reachout day one using async/await for faster and cleaner execution.
 * @param {*} req 
 * @param {*} res 
 * @param {*} options 
 * @return {Promise<Object>} A promise that resolves with a JSON response
 */
socialReachoutDayOne = async (req, res, options) => {
    // Extract and sanitize input options
    const webAddress = options.web_address || "";
    const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    const zipCode = options.zip_code || "";

    // Create prompt for OpenAI
    const prompt = {
        system_prompt: { role: "system", content: "" },
        user_prompt: {
            role: AI_ROLE_USER,
            content:
                SOCIAL_REACHOUT_DAY1.replace(/{zip_code}/g, zipCode).replace(/{web_address}/g, webAddress) +
                " " +
                SOCIAL_REACHOUT_FORMAT_DAY1.replace(/{zip_code}/g, zipCode)
        },
        prompt: SOCIAL_REACHOUT_DAY1.replace(/{zip_code}/g, zipCode).replace(/{web_address}/g, webAddress),
        reachout_day: REACHOUT_DAY1,
    };

    try {
        // Get OpenAI response asynchronously
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial.response || "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Prepare user prompt and final prompt for logging
            const userPrompt = SOCIAL_REACHOUT_DAY1;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY1.replace(/{zip_code}/g, zipCode).replace(/{web_address}/g, webAddress);

            // Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                reachout_day: REACHOUT_DAY1,
                final_output: finalResponse
            });

            // Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY1
            };
        } else {
            // Return error response
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY1
            };
        }
    } catch (error) {
        // Handle unexpected errors
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY1
        };
    }
}; // end socialReachoutDayOne()


/**
 * Function for social reachout day two 
 * @param {*} req 
 * @param {*} res 
 * @return {Promise<Object>} Resolves with a JSON response
 */
socialReachoutDayTwo = async (req, res, options) => {
    try {
        // Extract and sanitize input options
        const businessIndustry = options.business_industry || "";
        const webAddress = options.web_address || "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const zipCode = options.zip_code || "";

        const campaignLogs = db.collection(TABLE_AI_CAMPAIGN_LOGS);

        // Step 1: Fetch campaign log history for this user and day using async/await
        const campaignLogsData = await campaignLogs.find(
            { user_id: userId, type: SOCIAL_REACHOUT, reachout_day: REACHOUT_DAY2 },
            { projection: { output: 1 } }
        ).toArray();

        // Step 2: Prepare previous account exclusion string if any previous logs exist
        let previousRecord = "";
        if (campaignLogsData.length > 0) {
            // If multiple records, concatenate all outputs for exclusion
            const allOutputs = campaignLogsData.map(record => JSON.stringify(record.output)).join(", ");
            previousRecord = `Exclude these account:${allOutputs}`;
        }
        const previousAccount = previousRecord !== "" ? previousRecord : "";

        // Step 3: Create prompt for OpenAI
        const userPromptContent = SOCIAL_REACHOUT_DAY2
            .replace(/{web_address}/g, webAddress)
            .replace(/{business_industry}/g, businessIndustry)
            .replace(/{previous_accounts}/g, previousAccount)
            .replace(/{zip_code}/g, zipCode);

        const userPromptWithFormat = userPromptContent + " " + SOCIAL_REACHOUT_FORMAT_DAY2.replace(/{zip_code}/g, zipCode);

        const prompt = {
            system_prompt: { role: "system", content: "" },
            user_prompt: { role: AI_ROLE_USER, content: userPromptWithFormat },
            prompt: SOCIAL_REACHOUT_DAY2
                .replace(/{business_industry}/g, businessIndustry)
                .replace(/{zip_code}/g, zipCode)
                .replace(/{web_address}/g, webAddress)
                .replace(/{previous_accounts}/g, previousAccount),
            reachout_day: REACHOUT_DAY2,
        };

        // Step 4: Get OpenAI response asynchronously
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial.response || "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Step 5: Prepare prompts for logging
            const userPrompt = SOCIAL_REACHOUT_DAY2;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY2
                .replace(/{business_industry}/g, businessIndustry)
                .replace(/{zip_code}/g, zipCode)
                .replace(/{web_address}/g, webAddress)
                .replace(/{previous_accounts}/g, previousAccount);

            // Step 6: Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                reachout_day: REACHOUT_DAY2,
                final_output: finalResponse
            });

            // Step 7: Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY2
            };
        } else {
            // Return error response if OpenAI call failed
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY2
            };
        }
    } catch (error) {
        // Handle unexpected errors
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY2
        };
    }
}; // end socialReachoutDayTwo()


/**
 * Function for social reachout day three using async/await for database and OpenAI queries.
 * Handles all queries in parallel where possible for faster response times.
 * @param {*} req 
 * @param {*} res 
 * @return {Promise<Object>} A promise that resolves with a JSON response
 */
socialReachoutDayThree = async (req, res, options) => {
    try {
        // Extract and sanitize input options
        const businessIndustry = options.business_industry || "";
        const webAddress = options.web_address || "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const zipCode = options.zip_code || "";

        // Prepare OpenAI prompt
        const systemPromptContent = "You are an expert social media consultant with a focus on being clever, not too wordy and driving post engagement through, likes comments and shares for your clients. Always mention a specific product versus being generic.";
        const userPromptContent = SOCIAL_REACHOUT_DAY3.replace(/{business_industry}/g, businessIndustry)
            .replace(/{web_address}/g, webAddress) + " " +
            SOCIAL_REACHOUT_FORMAT_DAY3.replace(/{zip_code}/g, zipCode);

        const prompt = {
            system_prompt: { role: "system", content: systemPromptContent },
            user_prompt: { role: AI_ROLE_USER, content: userPromptContent },
            prompt: systemPromptContent + "/n" + SOCIAL_REACHOUT_DAY3.replace(/{business_industry}/g, businessIndustry).replace(/{web_address}/g, webAddress),
            reachout_day: REACHOUT_DAY3,
        };

        // Step 1: Get OpenAI response asynchronously
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial.response || "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Step 2: Prepare prompts for logging
            const userPrompt = SOCIAL_REACHOUT_DAY3;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY3
                .replace(/{business_industry}/g, businessIndustry)
                .replace(/{web_address}/g, webAddress);
            const systemFinalPrompt = systemPromptContent;

            // Step 3: Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                system_final_prompt: systemFinalPrompt,
                reachout_day: REACHOUT_DAY3,
                final_output: finalResponse
            });

            // Step 4: Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY3
            };
        } else {
            // Return error response if OpenAI call failed
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY3
            };
        }
    } catch (error) {
        // Handle unexpected errors
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY3
        };
    }
}; // end socialReachoutDayThree()


// socialReachoutDayThree = (req, res, options) => {
// 	return new Promise(resolve => {
// 		/**send success response */	
// 		let userId = (options.user_id) ? newObjectIdDefault(options.user_id) : "";
// 		const rewards = db.collection(TABLE_REWARDS);
// 		const newesletter = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
// 		async.parallel({
// 			/**get signup email details */
// 			'signup_reward': function (callback) {
// 				rewards.findOne({"user_id":userId,"ai_bot_reward" : true},{ projection: { "_id": 1, 'slug': 1,} }, (err, result) => {
// 					let rewardSlug = (result.slug) ? result.slug : "";
// 					callback(err, rewardSlug)
// 				});
// 			},
// 			/** get first welcome email */
// 			'insider_email': function (callback) {
// 				newesletter.findOne({'user_id': newObjectIdDefault(userId), "template_type" : EMAIL_TEMPLATE_WELCOME_TYPE,'ai_bot':true}, { projection: { "_id": 1, 'action': 1,} }, (errEmail, resultEmail) => {
// 					let emailSlug = (resultEmail.action) ? resultEmail.action : "";
// 					callback(errEmail, emailSlug)
// 				});
// 			},
// 		}, async (err, response) => {
// 			if(!err && response){
// 				let rewardSlugData = (response['signup_reward']) ? response['signup_reward'] : "";
// 				let emailSlugData = (response['insider_email']) ? response['insider_email'] : "";
// 				/**send success response */
// 				return resolve({
// 					"status": STATUS_SUCCESS,
// 					"response": {
// 						'reward_slug': rewardSlugData,
// 						'email_slug': emailSlugData
// 					},
// 					"reachout_day": REACHOUT_DAY3 
// 				});
// 			}else{
// 				/**send error response */
// 				return resolve({
// 					"status": STATUS_ERROR,
// 					"response": {
// 						'reward_slug': "",
// 						'email_slug': ""
// 					},
// 					"reachout_day": REACHOUT_DAY3 
// 				});
// 			}
// 		})
// 	});
// } // end socialReachoutDayThree();

/**
 * Function for social reachout day four
 * Uses async/await for all asynchronous operations for cleaner and faster execution.
 * @param {*} req 
 * @param {*} res 
 * @return json 
 */
socialReachoutDayFour = async (req, res, options) => {
    try {
        // Extract parameters from options
        const zipCode = options.zip_code || "";
        const webAddress = options.web_address || "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";

        // Create prompt for OpenAI
        const prompt = {
            system_prompt: { role: "system", content: "" },
            user_prompt: {
                role: AI_ROLE_USER,
                content:
                    SOCIAL_REACHOUT_DAY4.replace(/{zip_code}/g, zipCode).replace(/{web_address}/g, webAddress) +
                    " " +
                    SOCIAL_REACHOUT_FORMAT_DAY4.replace(/{zip_code}/g, zipCode)
            },
            prompt: SOCIAL_REACHOUT_NEW_DAY4.replace(/{zip_code}/g, zipCode).replace(/{web_address}/g, webAddress),
            reachout_day: REACHOUT_DAY4,
        };

        // Get OpenAI response using async/await
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial.response || "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Prepare prompts for logging
            const userPrompt = SOCIAL_REACHOUT_DAY4;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY4.replace(/{zip_code}/g, zipCode).replace(/{web_address}/g, webAddress);

            // Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                reachout_day: REACHOUT_DAY4,
                final_output: finalResponse
            });

            // Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY4
            };
        } else {
            // Return error response
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY4
            };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY4
        };
    }
}; // end socialReachoutDayFour()

/**
 * Function for social reachout day five using async/await for faster and cleaner execution.
 * Handles OpenAI prompt and campaign log saving with proper error handling.
 * @param {*} req 
 * @param {*} res 
 * @param {*} options 
 * @return {Promise<Object>} JSON response object
 */
socialReachoutDayFive = async (req, res, options) => {
    try {
        // Extract and format input parameters
        let businessIndustry = options.business_industry || "";
        let webAddress = options.web_address || "";
        let userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        let zipCode = options.zip_code || "";

        // Create prompt for OpenAI
        let prompt = {
            system_prompt: { role: "system", content: "" },
            user_prompt: {
                role: AI_ROLE_USER,
                content:
                    SOCIAL_REACHOUT_DAY5.replace(/{web_address}/g, webAddress).replace(/{zip_code}/g, zipCode) +
                    " " +
                    SOCIAL_REACHOUT_FORMAT_DAY1.replace(/{zip_code}/g, zipCode)
            },
            prompt: SOCIAL_REACHOUT_DAY5.replace(/{web_address}/g, webAddress).replace(/{zip_code}/g, zipCode),
            reachout_day: REACHOUT_DAY5,
        };

        // Get OpenAI response using async/await
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial.response || "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Prepare prompts for logging
            const userPrompt = SOCIAL_REACHOUT_DAY5;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY5.replace(/{web_address}/g, webAddress).replace(/{zip_code}/g, zipCode);

            // Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                reachout_day: REACHOUT_DAY5,
                final_output: finalResponse
            });

            // Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY5
            };
        } else {
            // Return error response
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY5
            };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY5
        };
    }
}; // end socialReachoutDayFive()


/**
 * Function for social reschout day five
 * @param {*} req 
 * @param {*} res 
 * @return json 
 */
// socialReachoutDayFive = (req, res, options) => {
// 	return new Promise(resolve => {
// 		let userId = (options.user_id) ? newObjectIdDefault(options.user_id) : "";
// 		const polls = db.collection(TABLE_POLLS);
// 		polls.findOne({"user_id":userId, "first_ai_poll_generated" : true, "type" : POLL_AI_TYPE},(err,result)=>{
// 			if(!err && result){
// 				let pollSlug = (result && result.slug ) ? result.slug : ""
// 				/**send success response */
// 				return resolve({ 
// 					"status": STATUS_SUCCESS,
// 					"response": {
// 						"poll_slug":pollSlug
// 					}, 
// 					'reachout_day': REACHOUT_DAY5 
// 				});
// 			}else{
// 				/**send error response */
// 				return resolve({
// 					"status": STATUS_ERROR,
// 					"response": {
// 						"poll_slug":""
// 					},
// 					'reachout_day': REACHOUT_DAY5 
// 				});
// 			}
// 		});
// 	});
// } // end socialReachoutDayFive();


/**
 * Function for social reachout day six using async/await for faster and cleaner execution.
 * @param {*} req 
 * @param {*} res 
 * @return {Promise<Object>} JSON response
 */
socialReachoutDaySix = async (req, res, options) => {
    try {
        // Extract and sanitize input parameters
        const webAddress = options.web_address ? options.web_address : "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const zipCode = options.zip_code ? options.zip_code : "";

        // Create prompt for OpenAI
        const prompt = {
            system_prompt: { role: "system", content: "" },
            user_prompt: {
                role: AI_ROLE_USER,
                content:
                    SOCIAL_REACHOUT_DAY6.replace(/{zip_code}/g, zipCode)
                        .replace(/{web_address}/g, webAddress) +
                    " " +
                    SOCIAL_REACHOUT_FORMAT_DAY6.replace(/{zip_code}/g, zipCode)
            },
            prompt: SOCIAL_REACHOUT_DAY6.replace(/{web_address}/g, webAddress).replace(/{zip_code}/g, zipCode),
            reachout_day: REACHOUT_DAY6,
        };

        // Get OpenAI response asynchronously
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial && responseSocial.response ? responseSocial.response : "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Prepare prompts for logging
            const userPrompt = SOCIAL_REACHOUT_DAY6;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY6
                .replace(/{web_address}/g, webAddress)
                .replace(/{zip_code}/g, zipCode);

            // Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                reachout_day: REACHOUT_DAY6,
                final_output: finalResponse
            });

            // Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY6
            };
        } else {
            // Return error response
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY6
            };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY6
        };
    }
}; // end socialReachoutDaySix()

/**
 * Function for social reachout day seven
 * Uses async/await for all asynchronous operations for cleaner and faster execution.
 * @param {*} req 
 * @param {*} res 
 * @param {*} options 
 * @return {Promise<Object>} JSON response object
 */
socialReachoutDaySeven = async (req, res, options) => {
    try {
        // Extract and format input parameters
        const webAddress = options.web_address || "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";

        // Create prompt for OpenAI
        const prompt = {
            system_prompt: { role: "system", content: "" },
            user_prompt: {
                role: AI_ROLE_USER,
                content: SOCIAL_REACHOUT_DAY7.replace(/{web_address}/g, webAddress) + " " + SOCIAL_REACHOUT_FORMAT_DAY7
            },
            prompt: SOCIAL_REACHOUT_DAY7.replace(/{web_address}/g, webAddress),
            reachout_day: REACHOUT_DAY7,
        };

        // Get OpenAI response using async/await
        const responseSocial = await getOpenAiSocialPostForEmail(req, res, prompt);
        const finalResponse = responseSocial && responseSocial.response ? responseSocial.response : "";

        if (responseSocial.status === STATUS_SUCCESS) {
            // Prepare prompts for logging
            const userPrompt = SOCIAL_REACHOUT_DAY7;
            const userFinalPrompt = SOCIAL_REACHOUT_DAY7.replace(/{web_address}/g, webAddress);

            // Save campaign logs asynchronously
            await saveAllCampaignLogs({
                user_id: userId,
                type: SOCIAL_REACHOUT,
                user_prompt: userPrompt,
                user_final_prompt: userFinalPrompt,
                reachout_day: REACHOUT_DAY7,
                final_output: finalResponse
            });

            // Return success response
            return {
                status: STATUS_SUCCESS,
                response: finalResponse,
                reachout_day: REACHOUT_DAY7
            };
        } else {
            // Return error response
            return {
                status: STATUS_ERROR,
                response: "",
                reachout_day: REACHOUT_DAY7
            };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            response: "",
            reachout_day: REACHOUT_DAY7
        };
    }
}; // end socialReachoutDaySeven()

/**
 * Function to retrieve information from AI and update relevant collections.
 * Uses async/await for all asynchronous operations for cleaner and faster execution.
 * 
 * @param {Object} options 
 * @returns {Promise<Object>} JSON response object
 */
retrieveInformation = async (options) => {
    const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
    const web_links = db.collection(TABLE_WEB_LINKS);

    try {
        // Extract and format input parameters
        const webId = options.web_id ? newObjectIdDefault(options.web_id) : "";
        const userDomain = options.email || "";
        const dataContext = (options.data && options.data.length > 0) ? options.data : [];
        const paragraphs = dataContext.join("\n\n");
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const websiteUrl = options.website_url || "";
        const businessName = options.business_name || "";
        const industryName = options.business_industry ? options.business_industry : "";
        const uniqueBrowserId = options.unique_browser_id || "";

        // If Gemini server is enabled, use Gemini for AI response
        if (GEMINI_SERVER_ENABLE === true) {
            // Generate Gemini response data
            const geminiData = await generateDataVaultDetails(null, null, { type: "website_url", paragraph: paragraphs });
            const responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
            const responseOtherData = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.other_data : {};

            const instagramUrl = responseDataVault?.socialLinks?.instagram || "";

            // Delete previous web info data for this user, if userId is provided
            if (userId) {
                await web_ai_info.deleteOne({ user_id: userId });
            }

            // Prepare web info data to insert
            const webInfoData = {
                web_id: webId,
                unique_browser_id: uniqueBrowserId,
                website_url: websiteUrl,
                instagram_url: instagramUrl,
                user_id: userId,
                email: userDomain,
                data: responseDataVault,
                apify_data: {},
                all_instagram_posts_from_apify: [],
            };

            // Insert new web info data
            const webInfoId = await insertWebInfoData(webInfoData);

            // Update web link to mark AI info as captured
            await web_links.updateOne({ _id: webId }, { $set: { ai_info_captured: ACTIVE } });

            // Remove sensitive contact info before returning
            delete responseDataVault.contactInfo;

            // Merge data for final response
            const data = { ...responseDataVault, ...responseOtherData };

            // Return success response
            return { status: STATUS_SUCCESS, result: data, web_info_id: webInfoId, instagram_url: instagramUrl };
        } else {
            // Use OpenAI for AI response
            const system = CRAWLING_DATA_SYSTEM_PROMPT;
            const user = CRAWLING_DATA_USER_PROMPT.replace(/{paragraphs}/g, paragraphs);

            try {
                // Await OpenAI chat completion
                const result = await callOpenAIChat({ system, user, res_json: ACTIVE });
                const response = result.response ? result.response : {};
                let data = response;

                // Add business info if provided
                if (businessName && industryName) {
                    if (!data.businessInfo) data.businessInfo = {};
                    data.businessInfo.name = businessName;
                    data.businessCategories = industryName.includes(",") ? industryName.split(",") : [industryName];
                }

                const instagramUrl = data?.socialLinks?.instagram || "";

                // Delete previous web info data for this user, if userId is provided
                if (userId) {
                    await web_ai_info.deleteOne({ user_id: userId });
                }

                // Prepare web info data to insert
                const webInfoData = {
                    web_id: webId,
                    unique_browser_id: uniqueBrowserId,
                    website_url: websiteUrl,
                    instagram_url: instagramUrl,
                    user_id: userId,
                    email: userDomain,
                    data: data,
                    apify_data: {},
                    all_instagram_posts_from_apify: [],
                };

                // Insert new web info data
                const webInfoId = await insertWebInfoData(webInfoData);

                // Update web link to mark AI info as captured
                await web_links.updateOne({ _id: webId }, { $set: { ai_info_captured: ACTIVE } });

                // Return success response
                return { status: STATUS_SUCCESS, result: data, web_info_id: webInfoId, instagram_url: instagramUrl };
            } catch (e) {
                // Log error and return error response
                console.log(e);
                return { status: STATUS_ERROR };
            }
        }
    } catch (error) {
        // Log error and return error response
        // console.log(error);
        return { status: STATUS_ERROR };
    }
};

/**
 * Calls the OpenAI API to retrieve chat completion data using async/await.
 * Handles JSON parsing and retries validation if needed.
 * @param {*} options - Options for the OpenAI API call.
 * @returns {Promise<Object>} Resolves with the API response data.
 */
callOpenAIChat = async (options) => {
    let systemPrompt = options?.system || "";
    let userPrompt = options?.user || "";
    let model = options?.model || "gpt-4o";
    let isJson = !!options?.res_json;

    // Create the prompt for the OpenAI API
    let messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ];

    try {
        // Call the OpenAI API using async/await
        const aiResult = await openai.createChatCompletion({
            model: model,
            messages: messages,
            temperature: TEMPERATURE
        });

        // Get the response from the API
        let aiResponse = aiResult.data.choices[0].message.content;
        let arrayResponse = aiResponse;

        // If the response should be in JSON format, attempt to parse and validate
        if (isJson) {
            try {
                // Try parsing JSON directly
                let arrayResponseData = JSON.parse(arrayResponse);
                return { status: STATUS_SUCCESS, response: arrayResponseData };
            } catch (e) {
                // If parsing fails, try to validate and parse again (first attempt)
                let validDataAgain = await validAiResponse(arrayResponse);
                let responseDataAgain = validDataAgain.response;
                try {
                    let againResponse = JSON.parse(responseDataAgain);
                    return { status: STATUS_SUCCESS, response: againResponse };
                } catch (error) {
                    // If still fails, try to validate and parse one more time (second attempt)
                    let validDataSecondTime = await validAiResponse(arrayResponse);
                    let responseDataSecondTime = validDataSecondTime.response;
                    try {
                        let finalResponse = JSON.parse(responseDataSecondTime);
                        return { status: STATUS_SUCCESS, response: finalResponse };
                    } catch (err) {
                        // If parsing fails again, throw error
                        throw err;
                    }
                }
            }
        } else {
            // If the response should not be in JSON format, return as string
            return { status: STATUS_SUCCESS, message: aiResponse };
        }
    } catch (error) {
        // If the API call fails, retry once recursively
        try {
            return await callOpenAIChat(options);
        } catch (retryError) {
            // If retry also fails, return error
            return { status: STATUS_ERROR, error: retryError?.message || "OpenAI API call failed" };
        }
    }
}; // end callOpenAIChat()


/**
 * Function to generate the first social post with image.
 * Uses async/await for all database and IO operations.
 * Downloads images for Instagram and Facebook in parallel for faster response.
 * @param {*} req 
 * @param {*} res 
 * @param {*} userData 
 * @return {Promise<Object>} JSON response
 */
generateFirstSocialPostWithImage = async (req, res, userData) => {
    try {
        // Extract and sanitize input parameters
        let businessInformationData = userData.business_information || "";
        let websiteUrl = userData.website_url || "";
        let uniqueBrowserId = userData.unique_browser_id || "";
        let instagramUrl = userData.instagram_url || "";

        const ugcGallery = db.collection(TABLE_UGC_GALLERY);

        // Fetch up to 10 UGC gallery images for the given browser ID (async/await)
        let ugcGalleryImages = await ugcGallery.find(
            { user_id: "", unique_browser_id: uniqueBrowserId, extension: { $ne: "" } },
            { projection: { _id: 0, upload_file: 1 } }
        ).limit(10).toArray();

        let dataImages = [];
        let dataVideos = [];
        let mergedMedia = [];

        // Separate images and videos, then merge (images first, then videos)
        if (ugcGalleryImages.length > 0 && LIVE_SERVER_UPLOAD === true) {
            for (const item of ugcGalleryImages) {
                const lower = item.upload_file?.toLowerCase() || "";
                const fullUrl = `${UGC_GALLERY_FILE_URL}${item.upload_file}`;
                if (['.jpg', '.jpeg', '.png', '.webp'].some(ext => lower.endsWith(ext))) {
                    dataImages.push(fullUrl);
                } else if (['.mp4', '.mov', '.mkv'].some(ext => lower.endsWith(ext))) {
                    dataVideos.push(fullUrl);
                }
            }
            mergedMedia = [...dataImages, ...dataVideos];
        }

        // Remove unnecessary fields from topPosts if present
        if (businessInformationData.topPosts && Array.isArray(businessInformationData.topPosts)) {
            businessInformationData.topPosts = businessInformationData.topPosts.map(post => {
                const { id, media_type, media_url, permalink, timestamp, ...rest } = post;
                return rest;
            });
        }

        // Convert business information to markdown
        businessInformationData = objectToMarkdown(businessInformationData);

        // Prepare the prompt for the AI model
        let promptData = "";
        if (instagramUrl) {
            promptData = FIRST_POST_AFTER_INSTAGRAM_SCRAP
                .replace(/{UPLOADED_IMAGES}/g, mergedMedia)
                .replace(/{DATA_VAULT}/g, businessInformationData);
        } else if (websiteUrl) {
            promptData = FIRST_POST_AFTER_WEBSITE_SCRAP
                .replace(/{UPLOADED_IMAGES}/g, mergedMedia)
                .replace(/{DATA_VAULT}/g, businessInformationData);
        }

        // Get the AI-generated caption and image selection
        let optionsData = { prompt: promptData, image_urls: [], video_urls: dataVideos };
        let getData = await getFirstOnboardingCaption(req, res, optionsData);

        let finalResponse = getData?.response || {};
        let selectedImageRaw = finalResponse?.selected_image || "";
        let selectedImageUrl = (selectedImageRaw && selectedImageRaw !== 'N/A') ? selectedImageRaw : "";

        // If no image selected by AI, randomly select one from available images
        const shouldSelectRandomImage =
            !selectedImageUrl &&
            LIVE_SERVER_UPLOAD === true &&
            selectedImageRaw === 'N/A' &&
            dataImages.length > 0;

        if (shouldSelectRandomImage) {
            selectedImageUrl = dataImages[Math.floor(Math.random() * dataImages.length)];
        }

        let uploadSocialImages = [];
        let uploadFacebookImages = [];

        // Download and process selected image for Instagram and Facebook in parallel
        if (selectedImageUrl && LIVE_SERVER_UPLOAD === true) {
            try {
                if (typeof selectedImageUrl === 'string' && selectedImageUrl.startsWith('http')) {
                    const urlPath = new URL(selectedImageUrl).pathname;
                    const imageExtension = urlPath.split('.').pop().toLowerCase();

                    if (imageExtension && !['mp4', 'mov'].includes(imageExtension)) {
                        // Prepare download options for both platforms
                        let optionsImage = {
                            url: selectedImageUrl,
                            dest: AI_SOCIAL_IMAGES_FILE_PATH,
                            instagram_image_size: true
                        };
                        let optionsFacebookImage = {
                            url: selectedImageUrl,
                            dest: AI_SOCIAL_IMAGES_FILE_PATH,
                            facebook_image_size: true
                        };

                        // Download images for Instagram and Facebook in parallel
                        let [facebookImageResponse, imageResponse] = await Promise.all([
                            downloadImageToUrl(res, req, optionsFacebookImage),
                            downloadImageToUrl(res, req, optionsImage)
                        ]);

                        // Handle Facebook image result
                        let facebookImageUrlName = (facebookImageResponse.status === STATUS_SUCCESS && facebookImageResponse.fileName) ? facebookImageResponse.fileName : "";
                        let facebookImageExtension = (facebookImageResponse.status === STATUS_SUCCESS && facebookImageResponse.imageExtension) ? facebookImageResponse.imageExtension : "";

                        if (facebookImageUrlName) {
                            uploadFacebookImages.push({
                                _id: newObjectIdDefault(),
                                name: facebookImageUrlName,
                                extension: facebookImageExtension,
                                post_on_facebook: true
                            });
                        }

                        // Handle Instagram image result
                        let imageUrlName = (imageResponse.status === STATUS_SUCCESS && imageResponse.fileName) ? imageResponse.fileName : "";
                        let instaimageExtension = (imageResponse.status === STATUS_SUCCESS && imageResponse.imageExtension) ? imageResponse.imageExtension : "";

                        if (imageUrlName) {
                            uploadSocialImages.push({
                                _id: newObjectIdDefault(),
                                name: imageUrlName,
                                extension: instaimageExtension,
                                post_on_instagram: true
                            });
                        }
                    }
                }
            } catch (err) {
                console.log("Invalid selectedImageUrl:", selectedImageUrl, err.message);
            }
        }

        // Build the social media post object
        let socialMediaPost = {
            title: finalResponse?.title || '',
            captions: (finalResponse?.caption || '') + (finalResponse?.hashtags ? ("\n" + finalResponse.hashtags) : ''),
            hashtags: finalResponse?.hashtags || '',
            image: uploadSocialImages,
            facebook_image: uploadFacebookImages,
        };

        // Return success response
        return {
            status: STATUS_SUCCESS,
            result: socialMediaPost,
            website_image_crawl: !!selectedImageUrl,
            message: ""
        };
    } catch (error) {
        // Log and return error response
        console.log(error);
        return {
            status: STATUS_ERROR,
            result: "",
            website_image_crawl: false,
            message: ""
        };
    }
}; // end generateFirstSocialPostWithImage()

/**
 * Function is used to extract all links from home page.
 * Uses async/await for all asynchronous operations for cleaner and faster execution.
 * @param {Array} linksArray - Array of URLs to process.
 * @return {Promise<Object>} JSON response object.
 */
extractDomainLinks = async (linksArray) => {
    try {
        // Remove duplicate URLs for efficiency
        const uniqueLinksUrls = [...new Set(linksArray)];

        if (uniqueLinksUrls.length === 0) {
            // No links to process
            return { status: STATUS_ERROR, data: [] };
        }

        // If Gemini server is enabled, use Gemini for AI response
        if (GEMINI_SERVER_ENABLE === true) {
            const prompt = OTHER_PAGE_PROMPT.replace(/{urls}/g, JSON.stringify(uniqueLinksUrls));
            // Await Gemini response
            const geminiResponse = await commonForGeminiWithoutGrounding(
                null,
                null,
                { prompt, format_schema: OTHER_LINKS_EXTRACTION_SCHEMA }
            );

            if (geminiResponse.status === STATUS_SUCCESS) {
                const response = geminiResponse.response || [];
                return { status: STATUS_SUCCESS, data: response };
            } else {
                return { status: STATUS_SUCCESS, data: [] };
            }
        } else {
            // Prepare OpenAI prompt
            const messages = [
                { role: "system", content: "" },
                {
                    role: "user",
                    content: `From the given list of URLs, extract the URLs that relate to About, Services, Products, Menu, Events, Testimonials, Reviews, FAQs. Only extract URLs that:
- Provide relevant and useful information about the business
- Are not links to downloadable files (e.g., .pdf, .doc, .zip, etc.)
- Are the **most suitable and relevant** URL for each page type
- Are **unique per page_type** — do not include multiple URLs for the same page type

Form the following array : ${JSON.stringify(uniqueLinksUrls)}
Use the following format:{"urls":[{"page_type":<page_type>,"link":<link>}]}}; Remember to return the output strictly in JSON array. Don't return json with backtics nor in start and nighter in end of your response.`
                }
            ];

            try {
                // Await OpenAI response
                const aiResult = await openai.createChatCompletion({
                    model: "gpt-4o",
                    messages: messages,
                    temperature: TEMPERATURE
                });

                let aiResponse = aiResult.data.choices[0].message.content;
                let arrayResponse = aiResponse;

                try {
                    // Try parsing JSON directly
                    let arrayResponseData = JSON.parse(arrayResponse);
                    return { status: STATUS_SUCCESS, data: arrayResponseData };
                } catch (e) {
                    // If parsing fails, validate and parse again
                    let validDataAgain = await validAiResponse(arrayResponse);
                    let responseDataAgain = validDataAgain.response;
                    try {
                        let againResponse = JSON.parse(responseDataAgain);
                        return { status: STATUS_SUCCESS, data: againResponse };
                    } catch (err) {
                        console.log(err);
                        return { status: STATUS_ERROR, data: [] };
                    }
                }
            } catch (error) {
                // Handle OpenAI API errors
                console.log(error);
                return { status: STATUS_ERROR, data: [] };
            }
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        console.log(error);
        return { status: STATUS_ERROR, data: [] };
    }
}; // end extractDomainLinks()


/**
 * Function is used as a fallback process when website data cannot be crawled.
 * Uses async/await for all database and IO operations.
 * Handles parallel queries using Promise.all for faster response times.
 * @param {*} req 
 * @param {*} res 
 * @return {Promise<Object>} JSON response
 */
fallbackProcessForCrawlData = async (req, res, options) => {
    const tableLibraryLogs = db.collection(TABLE_CONTENT_LIBRARY_LOGS);

    const websiteUrl = options.website_url || "";
    const userDomain = options.user_domain || "";
    const businessNameNew = options.business_name_new || "";
    const zipCodeNew = options.zip_code_new || "";
    const industryName = options.industry_name || "";
    const initialWebLinkId = options.initial_web_link_id || "";
    const uniqueBrowserId = options.unique_browser_id || "";
    const maxRetries = options.max_tries || 1;
    const websiteCrawlable = options.is_domain_crawl || false;
    const ipAddr = options.ip_addr || "";

    try {
        if (GEMINI_SERVER_ENABLE === true) {
            // Prepare options for Gemini fallback process
            const geminiOptions = {
                website_url: websiteUrl,
                business_name: businessNameNew,
                industry: industryName,
                zipcode: zipCodeNew,
            };

            // Get Gemini AI response
            const geminiData = await generateDataVaultFallbackProcess(req, res, geminiOptions);

            const responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
            const responseOtherData = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.other_data : {};
            const instagramUrl = responseDataVault?.socialLinks?.instagram || "";

            // Overwrite business name and industry if provided
            if (businessNameNew && responseDataVault?.businessInfo?.name) {
                responseDataVault.businessInfo.name = businessNameNew;
            }
            if (industryName && responseDataVault?.businessCategories) {
                responseDataVault.businessCategories = [industryName];
            }

            // Insert web link and web info in parallel for faster response
            await Promise.all([
                insertWebLinkData({
                    _id: initialWebLinkId,
                    unique_browser_id: uniqueBrowserId,
                    user_id: "",
                    website_url: websiteUrl,
                    email: userDomain
                }),
                insertWebInfoData({
                    web_id: newObjectIdDefault(initialWebLinkId),
                    unique_browser_id: uniqueBrowserId,
                    instagram_url: instagramUrl,
                    website_url: websiteUrl,
                    email: userDomain,
                    data: responseDataVault
                })
            ]);

            // Remove sensitive contact info
            delete responseDataVault.contactInfo;

            // Merge all business data
            let businessData = { ...responseDataVault, ...responseOtherData };

            // Remove empty keys from business data
            removeEmptyKeys(businessData);

            // Generate first social post with image
            const aiSocialPostContent = await generateFirstSocialPostWithImage(req, res, {
                business_information: responseDataVault,
                email: userDomain,
                unique_browser_id: uniqueBrowserId,
                website_url: websiteUrl
            });
            const socialPostResponse = (aiSocialPostContent.status === STATUS_SUCCESS) ? aiSocialPostContent.result : "";

            if (aiSocialPostContent.status === STATUS_SUCCESS && socialPostResponse !== "") {
                const aiContentData = socialPostResponse ? [{ social_media: socialPostResponse }] : [];
                businessData.website_url = websiteUrl;
                businessData.email = userDomain || "";
                businessData.web_id = initialWebLinkId;
                businessData.website_crawlable = websiteCrawlable;
                businessData.website_image_crawlable = false;
                let zipCode = businessData.zipCode || DEFAULT_USER_ZIP;
                if (zipCodeNew) businessData.zipCode = zipCodeNew;

                // Save content library logs using async/await
                await tableLibraryLogs.findOneAndUpdate(
                    { unique_ai_browser_id: uniqueBrowserId },
                    {
                        $set: {
                            email: userDomain || "",
                            zip_code: zipCode,
                            modified: getUtcDate(),
                            ai_content: aiContentData,
                            website_data: businessData
                        },
                        $setOnInsert: {
                            ip_addr: ipAddr,
                            unique_ai_browser_id: uniqueBrowserId,
                            created: getUtcDate()
                        }
                    },
                    { upsert: true }
                );

                // Return success response
                return {
                    status: STATUS_SUCCESS,
                    result: [{ social_media: { content: socialPostResponse } }],
                    message: ""
                };
            }
        } else {
            // Prepare prompt for OpenAI fallback
            let promptData = "";
            if (websiteUrl) {
                promptData = GET_WEBSITE_ADDRESS_PROMPT.replace(/{web_address}/g, websiteUrl).replace(/{zip_code}/g, "") +
                    " " +
                    GET_DATA_FROM_URL_FORMAT.replace(/{web_address}/g, websiteUrl);
            } else {
                const information = `Business Name:-${businessNameNew}; Industry:-${industryName}`;
                promptData = GET_WEBSITE_INFORMATION_PROMPT.replace(/{information}/g, information)
                    .replace(/{business_name}/g, businessNameNew)
                    .replace(/{zip_code}/g, zipCodeNew)
                    .replace(/{industry}/g, industryName)
                    + " " +
                    GET_DATA_FROM_INFORMATION_FORMAT.replace(/{business_name}/g, businessNameNew)
                        .replace(/{zip_code}/g, zipCodeNew)
                        .replace(/{industry}/g, industryName)
                        .replace(/{information}/g, information);
            }

            // Recursive function for fetching data with retry logic
            const fetchWebsiteData = async (retryCount = 0) => {
                try {
                    const urlData = await getWebsiteDataFromUrl(req, res, {
                        system_prompt: "",
                        user_prompt: promptData
                    });
                    const finalData = urlData.response || "";
                    // Check if finalData is valid
                    if (urlData.status === STATUS_SUCCESS && typeof finalData === "object") {
                        if (!("message" in finalData) && !("error" in finalData) && !("response" in finalData)) {
                            return finalData;
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
            const finalData = await fetchWebsiteData();

            if (finalData) {
                // Overwrite business name and industry if provided
                if (businessNameNew && finalData?.businessInfo?.name) {
                    finalData.businessInfo.name = businessNameNew;
                }
                const instagramUrl = finalData?.socialLinks?.instagram || "";

                // Insert web link and web info in parallel for faster response
                await Promise.all([
                    insertWebLinkData({
                        _id: initialWebLinkId,
                        unique_browser_id: uniqueBrowserId,
                        user_id: "",
                        website_url: websiteUrl,
                        email: userDomain
                    }),
                    insertWebInfoData({
                        web_id: newObjectIdDefault(initialWebLinkId),
                        unique_browser_id: uniqueBrowserId,
                        instagram_url: instagramUrl,
                        website_url: websiteUrl,
                        email: userDomain,
                        data: finalData
                    })
                ]);

                // Remove sensitive contact info
                delete finalData.contactInfo;

                let businessData = finalData;
                // Remove empty keys from business data
                removeEmptyKeys(businessData);

                // Generate first social post with image
                const aiSocialPostContent = await generateFirstSocialPostWithImage(req, res, {
                    business_information: businessData,
                    email: userDomain,
                    unique_browser_id: uniqueBrowserId,
                    website_url: websiteUrl
                });
                const socialPostResponse = (aiSocialPostContent.status === STATUS_SUCCESS) ? aiSocialPostContent.result : "";

                if (aiSocialPostContent.status === STATUS_SUCCESS && socialPostResponse !== "") {
                    const aiContentData = socialPostResponse ? [{ social_media: socialPostResponse }] : [];
                    finalData.website_url = websiteUrl;
                    finalData.email = userDomain || "";
                    finalData.web_id = initialWebLinkId;
                    finalData.website_crawlable = websiteCrawlable;
                    finalData.website_image_crawlable = false;
                    let zipCode = finalData.zipCode || DEFAULT_USER_ZIP;
                    if (zipCodeNew) finalData.zipCode = zipCodeNew;
                    if (businessNameNew) finalData.businessInfo.name = businessNameNew;
                    if (industryName) finalData.businessCategories = [industryName];

                    // Save content library logs using async/await
                    await tableLibraryLogs.findOneAndUpdate(
                        { unique_ai_browser_id: uniqueBrowserId },
                        {
                            $set: {
                                email: userDomain || "",
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

                    // Return success response
                    return {
                        status: STATUS_SUCCESS,
                        result: [{ social_media: { content: socialPostResponse } }],
                        message: ""
                    };
                }
            } else {
                // Return error if no data found after retries
                return {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.content_library.website_details_not_found"),
                };
            }
        }
    } catch (err) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            result: [],
            message: res.__("front.content_library.website_details_not_found"),
        };
    }
}; // end fallbackProcessForCrawlData()


/**
 * Function to generate the first social post for fallback process using async/await.
 * All database operations are handled with async/await for cleaner and faster execution.
 * Parallel queries are handled using Promise.all for efficiency.
 * @param {*} req 
 * @param {*} res 
 * @return {Promise<Object>} JSON response
 */
generateFirstSocialPostWithBusinessName = async (req, res, options) => {
    try {
        const userEmail = options.user_domain || "";
        const businessName = options.business_name_new || "";
        const zipCode = options.zip_code_new || "";
        const industryName = options.industry_name || "";
        const webLinkId = options.initial_web_link_id || "";
        const uniqueBrowserId = options.unique_browser_id || "";
        const ipAddr = options.ip_addr || "";

        const tableLibraryLogs = db.collection(TABLE_CONTENT_LIBRARY_LOGS);

        // Prepare business information data for AI
        const businessInformationData = `Business Name:-${businessName}; Business Industry:-${industryName};`;

        // Generate the first social post with image using async/await
        const aiSocialPostContent = await generateFirstSocialPostWithImage(
            req,
            res,
            {
                business_information: businessInformationData,
                email: userEmail,
                unique_browser_id: uniqueBrowserId,
                website_url: "website"
            }
        );

        const socialPostResponse = (aiSocialPostContent.status === STATUS_SUCCESS) ? aiSocialPostContent.result : "";

        // Check if OpenAI social post was generated successfully
        if (aiSocialPostContent.status === STATUS_SUCCESS && socialPostResponse !== "") {
            const aiContentData = socialPostResponse ? [{ social_media: socialPostResponse }] : [];

            // Prepare website data object
            const websiteData = {
                businessInfo: {
                    name: businessName,
                    location: "",
                    description: ""
                },
                businessCategories: [industryName],
                zipCode: zipCode,
                website_crawlable: false,
                website_image_crawlable: false,
            };

            // Save content library logs using async/await
            await tableLibraryLogs.findOneAndUpdate(
                { unique_ai_browser_id: uniqueBrowserId },
                {
                    $set: {
                        email: userEmail,
                        zip_code: zipCode,
                        modified: getUtcDate(),
                        ai_content: aiContentData,
                        website_data: websiteData
                    },
                    $setOnInsert: {
                        ip_addr: ipAddr,
                        unique_ai_browser_id: uniqueBrowserId,
                        created: getUtcDate()
                    }
                },
                { upsert: true }
            );

            // Insert generated URLs and web info in parallel for faster response
            await Promise.all([
                insertWebLinkData({
                    _id: webLinkId,
                    user_id: "",
                    email: userEmail,
                    unique_browser_id: uniqueBrowserId
                }),
                insertWebInfoData({
                    web_id: newObjectIdDefault(webLinkId),
                    email: userEmail,
                    data: websiteData,
                    unique_browser_id: uniqueBrowserId
                })
            ]);

            // Prepare AI social content data for response
            const aiSocialContentData = socialPostResponse ? [{ social_media: { content: socialPostResponse } }] : [];

            // Return success response
            return {
                status: STATUS_SUCCESS,
                result: aiSocialContentData,
                message: ""
            };
        } else {
            // Return error response if AI social post generation failed
            return {
                status: STATUS_ERROR,
                result: [],
                message: ""
            };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            result: [],
            message: ""
        };
    }
}; // end generateFirstSocialPostWithBusinessName()


/**
 * Function to crawl all page data using async/await for all queries.
 * Handles all DB operations and AI calls with async/await for faster and cleaner execution.
 * @param {*} options  
 * @return {Promise<Object>} JSON response
 */
crawlAllPage = async (options) => {
    const crawlUrl = options.url || "";
    const pageType = options.page_type || "";
    const webId = options.web_id || "";
    const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

    try {
        // Get website text data asynchronously
        const crawlWebsiteData = await getWebsiteTextData({ website_url: crawlUrl });

        if (crawlWebsiteData.status === STATUS_SUCCESS) {
            const crawlResponse = crawlWebsiteData.result || "";
            const data = crawlResponse.data || [];
            const socialMediaLinks = crawlResponse.socialMediaLinks || [];
            const emailAddresses = crawlResponse.emailAddresses || [];
            const contactNumbers = crawlResponse.contactNumbers || [];

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

            // Helper to fix sentence spacing
            function fixSentenceSpacing(text) {
                return text.split(' ').filter(word => word !== '').join(' ');
            }

            // Apply sentence spacing fix
            const fixedParagraphs = filteredParagraphs.map(fixSentenceSpacing);
            if (socialMediaLinks.length > 0) fixedParagraphs.push(`Social media links : ${socialMediaLinks.join(', ')}`);
            if (emailAddresses.length > 0) fixedParagraphs.push(`Contact Emails : ${emailAddresses.join(', ')}`);
            if (contactNumbers.length > 0) fixedParagraphs.push(`Available contact numbers data : ${contactNumbers.join(', ')}`);
            const crawlData = fixedParagraphs;

            if (crawlData.length > 0) {
                const paragraphs = crawlData.join("\n\n");

                // If Gemini server is enabled, use Gemini for AI response
                if (GEMINI_SERVER_ENABLE === true) {
                    const prompt = OTHER_PAGE_CRAWL_PROMPT.replace(/{paragraphs}/g, paragraphs).replace(/{page_type}/g, pageType);
                    const format = SINGLE_PAGE_EXTRACTION_SCHEMA_TEMPLATE(pageType);

                    // Call Gemini AI asynchronously
                    const geminiResponse = await commonForGeminiWithoutGrounding(null, null, { prompt, format_schema: format });

                    if (geminiResponse.status === STATUS_SUCCESS) {
                        const data = geminiResponse.response || {};
                        const sanitizedData = replaceDotsInKeys(data);
                        const datakey = Object.keys(sanitizedData)[0];

                        // Fetch previous data for this web_id
                        const record = await web_ai_info.findOne({ web_id: newObjectIdDefault(webId) });
                        const previousData = record?.data || {};

                        // Update or merge the new data
                        if (previousData.hasOwnProperty(datakey)) {
                            let value = previousData[datakey];
                            previousData[datakey] = (Array.isArray(value)) ? [...value] : [value];
                            previousData[datakey].push(sanitizedData[datakey]);
                            // Update data in DB
                            await web_ai_info.updateOne(
                                { web_id: newObjectIdDefault(webId) },
                                [{ $set: { data: previousData } }]
                            );
                        } else {
                            // Merge new data with existing data
                            await web_ai_info.updateOne(
                                { web_id: newObjectIdDefault(webId) },
                                [{ $set: { data: { $mergeObjects: ["$data", sanitizedData] } } }]
                            );
                        }

                        // Return success response
                        return { status: STATUS_SUCCESS, data: { page_type: pageType, crawl_data: data } };
                    } else {
                        // Gemini AI error
                        return { status: STATUS_ERROR, data: {} };
                    }
                } else {
                    // Prepare OpenAI prompt
                    const system = `You are a data extraction assistant. Your task is to extract key business details from the provided textual data of user asked. Your work is to troughly analyse data of page and return in a valid JSON format. Make sure to return JSON with no backtics in start or end.
Return all extracted information in the following JSON format:
json
{
"${pageType}": <plain_and_explain_text>,
}
Ensure that plain_and_explain_text return in only textual data. if there are listing point then list them in bullet point format as textual content.`;
                    const user = CRAWLING_ALL_APGE_USER_PROMPT.replace(/{paragraphs}/g, paragraphs).replace(/{pageType}/g, pageType);

                    const optionsData = {
                        system: system,
                        user: user,
                        res_json: ACTIVE
                    };

                    try {
                        // Call OpenAI asynchronously
                        const result = await callOpenAIChat(optionsData);
                        const response = result.response;
                        const data = response;
                        const sanitizedData = replaceDotsInKeys(data);
                        const datakey = Object.keys(sanitizedData)[0];

                        // Fetch previous data for this web_id
                        const record = await web_ai_info.findOne({ web_id: newObjectIdDefault(webId) });
                        const previousData = record?.data || {};

                        // Update or merge the new data
                        if (previousData.hasOwnProperty(datakey)) {
                            let value = previousData[datakey];
                            previousData[datakey] = (Array.isArray(value)) ? [...value] : [value];
                            previousData[datakey].push(sanitizedData[datakey]);
                            // Update data in DB
                            await web_ai_info.updateOne(
                                { web_id: newObjectIdDefault(webId) },
                                [{ $set: { data: previousData } }]
                            );
                        } else {
                            // Merge new data with existing data
                            await web_ai_info.updateOne(
                                { web_id: newObjectIdDefault(webId) },
                                [{ $set: { data: { $mergeObjects: ["$data", sanitizedData] } } }]
                            );
                        }

                        // Return success response
                        return { status: STATUS_SUCCESS, data: { page_type: pageType, crawl_data: data } };
                    } catch (e) {
                        // Handle OpenAI error
                        console.log(e);
                        return { status: STATUS_ERROR, data: {} };
                    }
                }
            } else {
                // No crawl data found
                return { status: STATUS_ERROR, data: { page_type: pageType, crawl_data: "" } };
            }
        } else {
            // Website crawl failed
            return { status: STATUS_ERROR, data: { page_type: pageType, crawl_data: "" } };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        console.log(error);
        return {
            status: STATUS_ERROR,
            message: `Failed to crawl and save data from "${crawlUrl}": ${error.message}`
        };
    }
}; // end crawlAllPage()

/**
 * Main function to crawl all pages one by one using async/await.
 * Handles all DB queries and page crawls in parallel for faster response times.
 * @param {*} options  
 * @return {Promise<void>}
 */
crawlAllPagesSequentially = async (options) => {
    try {
        const web_links = db.collection(TABLE_WEB_LINKS);
        const webId = options.web_id || "";

        if (!webId) {
            // No webId provided, nothing to process
            return;
        }

        // Fetch child links for the given webId
        const childLinksDoc = await web_links.findOne(
            { _id: newObjectIdDefault(webId) },
            { projection: { child_links: 1 } }
        );

        const links = (childLinksDoc && childLinksDoc.child_links) ? childLinksDoc.child_links : [];

        if (links.length > 0) {
            // Crawl all child links in parallel using Promise.all for efficiency
            await Promise.all(
                links.map(({ link: crawlUrl, page_type }) =>
                    crawlAllPage({ url: crawlUrl, page_type, web_id: webId })
                )
            );
        }
        // All done
        return;
    } catch (error) {
        // Handle unexpected errors gracefully
        console.log("Error in crawlAllPagesSequentially:", error);
        return;
    }
}; // end crawlAllPagesSequentially()

/**
 * Function to crawl one page from child links randomly using async/await.
 * Handles the crawl and save operation with clean formatting for faster response times.
 * @param {*} options  
 * @return {Promise<Object>} JSON response
 */
crawlOneAnotherPageRandomaly = async (options) => {
    try {
        const links = options.links || [];
        if (links.length > 0) {
            // Pick one random link from the array
            const randomIndex = Math.floor(Math.random() * links.length);
            const crawlUrl = links[randomIndex];

            // Process only the randomly selected link using async/await
            const result = await crawlAndSave(null, null, { url: crawlUrl });
            const crawlData = result && result.data ? result.data : [];

            // Return the crawled data
            return { data: crawlData };
        }
        // No links provided, return empty data
        return { data: "" };
    } catch (error) {
        // Handle unexpected errors gracefully
        console.log("Error in crawlOneAnotherPageRandomaly:", error);
        return { data: "" };
    }
}; // end crawlOneAnotherPageRandomaly()

/**
 * Async function to change page type of pages.
 * Filters out unwanted page types and formats the page_type string.
 * Uses async/await for future extensibility and clean formatting.
 * @param {Array} pages - Array of page objects to process.
 * @return {Promise<Array>} - Promise resolving to filtered and formatted pages.
 */
changePageType = async (pages) => {
    try {
        const unwantedPageTypes = ['Home', 'Homepage', 'home', 'homepage'];

        // Filter out unwanted page types
        const filteredPages = pages.filter(page => !unwantedPageTypes.includes(page.page_type));

        // Format page_type by removing underscores or dashes, in parallel for efficiency
        const formattedPages = await Promise.all(
            filteredPages.map(async ({ page_type, link }) => ({
                page_type: page_type.replace(/[_-]/g, ' '),
                link
            }))
        );

        return formattedPages;
    } catch (error) {
        // Handle unexpected errors gracefully
        console.log("Error in changePageType:", error);
        return [];
    }
}; // end changePageType()


/**
 * Function is used to replace dot with underscores 
 * @param {*} params  
 * @return obj 
 */
replaceDotsInKeys = (obj) => {
    const newObj = {};
    for (const key in obj) {
        const newKey = key.replace(/\./g, '_');
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            newObj[newKey] = replaceDotsInKeys(obj[key]);
        } else {
            newObj[newKey] = obj[key];
        }
    }
    return newObj;
} //end replaceDotsInKeys();


/**
 * Function is used to bold headings of seo blog text
 * @param {*} params  
 * @return text 
 */
boldHeadings = (text) => {
    /** Split the text into lines*/
    let lines = text.split('\n');

    /**Iterate through each line*/
    let boldedLines = lines.map(line => {
        /**Remove asterisks from the line*/
        let cleanedLine = line.replace(/[\*#]/g, '');

        /**Check if the line is a heading (e.g., ends with a colon or is short and descriptive)*/
        if ((line.includes('*') && (line.length < 80 && line.trim().length > 0)) || (line.includes('#') && (line.length < 80 && line.trim().length > 0)) || (line.length < 80 && line.trim().length > 0)) {
            return `<strong>${cleanedLine}</strong>`;
        }
        return cleanedLine;
    });

    /**Join the lines back together*/
    return boldedLines.join('\n');
} //end boldHeadings();

/**
 * Function is used to remove blank keys
 * @param {*} obj  
 * @return obj 
 */
removeEmptyKeys = (obj) => {
    for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            /**Recursively clean nested objects*/
            removeEmptyKeys(obj[key]);
            /**Remove the object if it is empty after cleanup*/
            if (Object.keys(obj[key]).length === 0) {
                delete obj[key];
            }
        } else if (obj[key] === '' || (Array.isArray(obj[key]) && obj[key].length === 0)) {
            delete obj[key];
        }
    }
} //end removeEmptyKeys();


/**function for get url from email */
emailToDomainUrl = (email) => {
    if (email.includes('@')) {
        const parts = email.split('@');
        const domain = parts[1];
        return "http://" + domain;
    } else {
        return null;
    }
} //end emailToDomainUrl();


/**
 * Function is used to fetch html from url
 * @param {*} url  
 * @return text 
 */
fetchHTML = async (url) => {
    try {
        /**Use GET instead of HEAD to avoid 405 errors and check for redirects manually*/
        const response = await axios.get(url, { maxRedirects: 0 });
        const contentType = response.headers['content-type'];

        if (contentType.includes('text/html')) {
            return response.data;
        } else {
            throw new Error(`Not an html page`);
        }

    } catch (error) {
        if (error.response && [301, 302, 303, 307, 308].includes(error.response.status)) {
            /**Handle redirects by getting the new location*/
            const redirectUrl = error.response.headers.location;
            /** Fetch HTML from the new location*/
            return await fetchHTML(redirectUrl);
        } else {
            /**Throw an error for non-redirect-related issues*/
            throw new Error(`Failed to fetch HTML from "${url}": ${error.message}`);
        }
    }
}; //end fetchHTML();


/**
 * Function is used to Check if JavaScript is blocking content 
 * @param {*} url  
 * @return  
 */
isJavaScriptBlocking = async (url) => {
    const rawHTML = await fetchHTML(url);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const renderedHTML = await page.content();

        if (rawHTML.length < renderedHTML.length) {
            return true;
        }
        return false;
    } catch (error) {
        throw error;
    } finally {
        await browser.close();
    }
}; //end isJavaScriptBlocking();

/**
 * Function is used to Fetch rendered HTML using Puppeteer 
 * @param {*} url  
 * @return  
 */
fetchRenderedHTML = async (url) => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const renderedHTML = await page.content();
        return renderedHTML;
    } catch (error) {
        console.error(`Error fetching rendered HTML for "${url}":`, error);
        throw error;
    } finally {
        await browser.close();
    }
}; //end fetchRenderedHTML();

/**
 * Function is used to enhanced method for fetching HTML
 * @param {*} url  
 * @return  
 */
enhancedFetchHTML = async (url) => {
    try {
        const rawHTML = await fetchHTML(url);
        try {
            const isBlocked = await isJavaScriptBlocking(url);

            if (isBlocked) {
                return await fetchRenderedHTML(url);
            }
            return rawHTML;
        } catch (err) {
            return rawHTML;
        }
    } catch (error) {
        throw error;
    }
}; //end enhancedFetchHTML();

/**
 * Function is used to extract html 
 * @param {*} url  
 * @return  
 */
extractHTMLData = async (html, baseUrl, getSiteLinks = false) => {
    let $ = cheerio.load(html);
    let data = [];
    let socialMediaLinks = [];
    let emailAddresses = [];
    let contactNumbers = [];
    let imageUrlData = [];

    /**Regex patterns*/
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(?:(?:\+|00)\d{1,3})?[\s.-]?\(?\d{1,4}?\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g;

    /**Remove iframes*/
    $('iframe').remove();

    /** Extract all text data */
    $('body').find('*').not('script, style, iframe').each((index, element) => {
        let itemText = $(element).clone().children().remove().end().text().trim();

        if (itemText && !itemText.includes('<img')) {
            data.push(itemText);

            /** Extract email addresses */
            let emails = itemText.match(emailRegex);
            if (emails) {
                emailAddresses.push(...emails);
            }

            /** Extract contact numbers */
            let numbers = itemText.match(phoneRegex);
            if (numbers) {
                contactNumbers.push(...numbers);
            }
        }
    });

    /**Extract social media links*/
    $('a[href]').each((index, element) => {
        let href = $(element).attr('href');
        if (href.includes('facebook.com') || href.includes('twitter.com') ||
            href.includes('linkedin.com') || href.includes('instagram.com') ||
            href.includes('youtube.com')) {
            /**Convert to absolute URL if needed*/
            socialMediaLinks.push(new URL(href, baseUrl).href);
        }
    });

    let linksArray = [];
    let visitedLinks = new Set();

    if (getSiteLinks) {
        const baseDomain = new URL(baseUrl).hostname;
        $("a").each(function (i, elem) {
            let link = $(this).attr('href');
            if (link) {
                /** Use the full baseUrl, not baseDomain*/
                const absoluteLink = new URL(link, baseUrl).href;
                /**Skip unwanted links: JS, CSS, and image links*/
                const isAnchorLink = link.startsWith("#");
                const isJavascriptLink = link.startsWith("javascript:");
                const isCSSLink = link.endsWith(".css");
                const isJSLink = link.endsWith(".js");
                const isImageLink = /\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(link);

                if (absoluteLink != baseUrl && absoluteLink.includes(baseDomain) && !isAnchorLink && !isJavascriptLink && !isCSSLink && !isJSLink && !isImageLink && !visitedLinks.has(absoluteLink)) {
                    let cleanedUrl = absoluteLink.replace(/\/$/, '');
                    linksArray.push(cleanedUrl);
                    visitedLinks.add(cleanedUrl);
                }
            }
        });
    }


    /** Handle image URLs */
    let imageUrlPromises = [];
    $('img[src]').each(async (index, element) => {
        let src = $(element).attr('src');

        /**Skip data URLs*/
        if (src.startsWith('data:')) {
            return;
        }

        if (!src.startsWith('https')) {
            src = 'https:' + src
        }

        /**Ensure URL is absolute*/
        let imageUrl;
        try {
            imageUrl = new URL(src, baseUrl).href;
        } catch (error) {
            console.error("Invalid image URL:", src);
            return;
        }

        /**Get the pathname to check the file extension*/
        let pathname = new URL(imageUrl).pathname;

        /**Skip .svg, .gif images*/
        if (pathname.endsWith('.svg') || pathname.endsWith('.gif')) {
            return;
        }

        /**Check if it has more than one 'https' Count occurrences of 'http' or 'https' in the URL*/
        const protocolCount = (imageUrl.match(/https?:\/\//g) || []).length;
        if (protocolCount > 1) {

        } else {
            /** Push a promise to the array */
            imageUrlPromises.push(getBaseImageUrl(imageUrl).then(imageFinalUrl => {
                if (imageFinalUrl) {
                    imageUrlData.push(imageFinalUrl);
                }
            }));
        }
    });

    /** Wait for all image URL promises to resolve */
    await Promise.all(imageUrlPromises);

    /**Remove duplicate URLs*/
    const uniqueImageUrls = [...new Set(imageUrlData)];
    //const uniqueImageUrls = [];

    return { data, socialMediaLinks, emailAddresses, contactNumbers, uniqueImageUrls, linksArray };
}; //end extractHTMLData();

/**
 * Function is used to crawl data from url and save in logs
 * @param {*} req  
 * @param {*} res 
 * @return  
 */
/**
 * Function to crawl data from a URL and save in logs.
 * Uses async/await for all DB and IO operations.
 * Downloads images in parallel for faster response.
 * @param {*} req  
 * @param {*} res 
 * @param {*} options
 * @return {Promise<Object>} JSON response
 */
crawlAndSave = async (req, res, options) => {
    const web_links = db.collection(TABLE_WEB_LINKS);
    const crawlUrl = options.url || "";
    let userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    let uniqueBrowserId = options.unique_browser_id || "";
    const initialWebLinkId = newObjectIdDefault(options.web_id) || "";

    try {
        // Get website text data asynchronously
        const crawlWebsiteData = await getWebsiteTextData({ website_url: crawlUrl });

        if (crawlWebsiteData.status === STATUS_SUCCESS) {
            const crawlResponse = crawlWebsiteData.result || "";
            const data = crawlResponse.data || [];
            const socialMediaLinks = crawlResponse.socialMediaLinks || [];
            const emailAddresses = crawlResponse.emailAddresses || [];
            const contactNumbers = crawlResponse.contactNumbers || [];
            const uniqueImageUrls = crawlResponse.uniqueImageUrls || [];
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

            // Helper to fix sentence spacing
            function fixSentenceSpacing(text) {
                return text.split(' ').filter(word => word !== '').join(' ');
            }

            // Apply sentence spacing fix
            const fixedParagraphs = filteredParagraphs.map(fixSentenceSpacing);
            if (socialMediaLinks.length > 0) fixedParagraphs.push(`Social media links : ${socialMediaLinks.join(', ')}`);
            if (emailAddresses.length > 0) fixedParagraphs.push(`Contact Emails : ${emailAddresses.join(', ')}`);
            if (contactNumbers.length > 0) fixedParagraphs.push(`Available contact numbers data : ${contactNumbers.join(', ')}`);
            const crawlData = fixedParagraphs || [];

            // Download and save images in parallel for efficiency
            if (uniqueImageUrls && uniqueImageUrls.length > 0) {
                const ugcGallery = db.collection(TABLE_UGC_GALLERY);

                // Prepare all image download and DB insert promises
                const imagePromises = uniqueImageUrls.map(async (imageUrl) => {
                    try {
                        // Download image and check dimensions
                        let imageBuffer, metadata;
                        try {
                            const { data: buffer } = await axios.get(imageUrl, { maxRedirects: 0, responseType: 'arraybuffer' });
                            imageBuffer = buffer;
                            metadata = await sharp(imageBuffer).metadata();

                            // Skip if dimensions are too small
                            if (!(metadata.width >= UGC_GALLERY_IMAGE_MINIMUM_SIZE && metadata.height >= UGC_GALLERY_IMAGE_MINIMUM_SIZE)) {
                                return;
                            }
                        } catch (error) {
                            // Handle redirects and check dimensions if redirected
                            if (error.response && [301, 302, 303, 307, 308].includes(error.response.status)) {
                                const redirectUrl = error.response.headers.location;
                                const checkDimension = await isImageWithinDimensions(imageUrl);
                                if (checkDimension) {
                                    imageUrl = redirectUrl;
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                        }

                        // Generate slug for image
                        const slugOptions = {
                            title: uniqueBrowserId || "",
                            table_name: TABLE_UGC_GALLERY,
                            slug_field: "slug"
                        };
                        const slugResponse = await getDatabaseSlug(slugOptions);

                        // Download image to server
                        const imageResponse = await downloadImageToUrl(res, req, { url: imageUrl, dest: UGC_GALLERY_FILE_PATH });

                        if (imageResponse.status === STATUS_SUCCESS) {
                            const imageUrlName = imageResponse.fileName || "";
                            const imageExtension = imageResponse.imageExtension || "";

                            // Insert image metadata into UGC gallery
                            await ugcGallery.insertOne({
                                user_id: userId,
                                website_url: crawlUrl,
                                unique_browser_id: uniqueBrowserId,
                                description: "",
                                upload_file: imageUrlName,
                                extension: imageExtension,
                                instagram_id_link: "",
                                slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
                                created: getUtcDate()
                            });
                        }
                    } catch (err) {
                        // Ignore errors for individual images
                    }
                });

                // Wait for all image downloads and DB inserts to complete
                await Promise.all(imagePromises);
            }

            // Update web_links with crawl status and links, then return success
            if (crawlData.length > 0) {
                await web_links.updateOne(
                    { _id: initialWebLinkId },
                    { $set: { is_crawl: CRAWLED, modified: getUtcDate(), other_pages_links: linksArray } },
                    { upsert: true }
                );
                return { status: STATUS_SUCCESS, data: crawlData, site_links: linksArray };
            } else {
                return { status: STATUS_ERROR };
            }
        } else {
            return { status: STATUS_ERROR };
        }
    } catch (error) {
        // Handle unexpected errors gracefully
        return {
            status: STATUS_ERROR,
            message: `Failed to crawl and save data from "${crawlUrl}": ${error.message}`
        };
    }
}; // end crawlAndSave()


/** Function to check the final URL with proper HTTPS and www handling */
checkProtocol = async (websiteUrl) => {
    let hostname;

    try {
        /**Normalize input to get proper hostname*/
        hostname = new URL(websiteUrl).hostname;
    } catch (err) {
        /**If input is just a domain (no protocol), fall back*/
        hostname = websiteUrl.split('/')[0];
    }

    const protocols = ['https://', 'http://'];

    /**Check if it's already a subdomain (3+ parts like hotels.example.com)*/
    const parts = hostname.split('.');
    const hasSubdomain = parts.length > 2;

    const wwwPrefixes = hasSubdomain ? [''] : ['www.', ''];

    for (const protocol of protocols) {
        for (const wwwPrefix of wwwPrefixes) {
            const fullURL = `${protocol}${wwwPrefix}${hostname}`;
            try {
                const result = await getFinalURL(fullURL);
                if (result) return result;
            } catch (err) {
                /**Try next combination*/
            }
        }
    }

    return null;
};

/**
 * Helper function to follow redirects and get the final URL using async/await.
 * Handles up to maxRedirects and returns the final resolved URL.
 * Uses native http/https modules for low-level control.
 * @param {string} domainUrl - The URL to resolve.
 * @param {number} redirectCount - Current redirect count.
 * @returns {Promise<string>} - The final resolved URL.
 */
getFinalURL = async (domainUrl, redirectCount = 0) => {
    const maxRedirects = 5;
    const timeoutDuration = 1000; // 1 second

    // Wrap the request in a Promise for async/await usage
    return await new Promise((resolve, reject) => {
        const client = domainUrl.startsWith('https') ? https : http;
        const request = client.get(
            domainUrl,
            {
                timeout: timeoutDuration,
                headers: {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Connection": "keep-alive",
                    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:136.0) Gecko/20100101 Firefox/136.0"
                }
            },
            async (res) => {
                // Handle HTTP redirects (3xx)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirectCount >= maxRedirects) {
                        // Too many redirects, reject the promise
                        return reject('Too many redirects');
                    }
                    // Resolve the next redirect URL relative to the current one
                    const redirectURL = new URL(res.headers.location, domainUrl).href;
                    try {
                        // Recursively follow the redirect using async/await
                        const finalUrl = await getFinalURL(redirectURL, redirectCount + 1);
                        resolve(finalUrl);
                    } catch (err) {
                        reject(err);
                    }
                } else if (res.statusCode === 200) {
                    // Success, return the final URL
                    resolve(domainUrl);
                } else {
                    // Other status codes, reject with status
                    reject(`Status code: ${res.statusCode}`);
                }
            }
        );

        // Handle request timeout
        request.on('timeout', () => {
            request.destroy();
            reject('Timeout');
        });

        // Handle request errors
        request.on('error', (err) => {
            reject(err);
        });
    });
};

/**
 * Extracts the base URL from a given URL by removing resizing and version parameters if a version identifier is present.
 * 
 * @param {string} url - The URL of the image.
 * @returns {string} - The base URL.
 */
getBaseImageUrl = async (url) => {
    try {
        url = url.trim();

        /**Extract the domain*/
        const domain = url.split('//')[1].split('/')[0];
        let protocolSite = await checkProtocol(url);

        /**Ensure the URL uses HTTPS instead of HTTP*/
        if (url.startsWith('http://')) {
            url = protocolSite;
        }

        /**Match URLs with version identifiers (e.g., `/v1/` or `/v123/`) and extract the base URL*/
        const versionRegex = /(.+?\.(jpg|jpeg|png|webp|gif))(?:\/v[0-9]+[/?].*)?$/i;

        /**Match the URL with the version regex*/
        const match = url.match(versionRegex);

        /**If the version identifier exists, return the base URL*/
        if (match) {
            return match[1];
        }

        /**Return the updated URL*/
        return url;
    } catch (error) {
        return;
    }
}; //end getBaseImageUrl();


/**function for check url data html */
isHTMLPage = async (url) => {
    try {
        /**Use GET instead of HEAD to avoid 405 errors*/
        const response = await axios.get(url, { maxRedirects: 0, timeout: 30000 }); // Prevent automatic redirects
        const contentType = response.headers['content-type'];
        websiteUrl = url;
        return contentType && contentType.includes('text/html');
    } catch (error) {
        if (error.response && [301, 302, 303, 307, 308].includes(error.response.status)) {
            /**Handle redirects by getting the new location*/
            const redirectUrl = error.response.headers.location;
            /**Recursively check if the redirected URL is an HTML page*/
            return await isHTMLPage(redirectUrl);
        } else {
            /**Return false for other errors*/
            return false;
        }

    }
}; //end isHTMLPage();

/**
 * The function `fetchEntireSiteRoutes` crawls a website starting from a given URL, collects relevant data.
 * Uses async/await for all asynchronous operations and handles parallel queries with Promise.all for efficiency.
 * 
 * @param {*} options
 * @returns {Promise<Array>} - Array of unique crawled URLs up to the specified limit.
 */
fetchEntireSiteRoutes = async (options) => {
    let firstLink = options?.url || "";
    let linkData = url.parse(firstLink);
    let base = linkData.hostname;
    let crawled = options?.alreadyCrawled || [];
    let inboundLinks = [];
    let visitedLinks = (crawled.length > 0) ? new Set(crawled) : new Set();
    let limit = options?.limit || 30;

    /**
     * Fetches and parses a single page, extracting all valid internal links.
     * @param {string} crawlUrl 
     * @returns {Promise<Object>} - Page object with title, url, and links.
     */
    async function fetchPageLinks(crawlUrl) {
        // Skip if already visited
        if (visitedLinks.has(crawlUrl)) {
            return { url: crawlUrl, links: [] };
        }

        // Check if the URL is an HTML page
        let isHtm = await isHTMLPage(crawlUrl);
        if (!isHtm) {
            return { url: crawlUrl, links: [] };
        }

        visitedLinks.add(crawlUrl);

        // Fetch the page HTML using axios for async/await support
        let response;
        try {
            response = await axios.get(crawlUrl, { timeout: 30000 });
        } catch (err) {
            // If request fails, return empty links
            return { url: crawlUrl, links: [] };
        }

        let $ = cheerio.load(response.data);
        let pageObject = {
            title: $("title").text(),
            url: crawlUrl,
            links: []
        };

        // Extract all valid internal links
        $("a").each(function (i, elem) {
            let link = elem.attribs.href;
            if (link) {
                try {
                    const absoluteLink = new URL(link, firstLink).href;
                    if (
                        absoluteLink.startsWith(firstLink) &&
                        !link.startsWith("#") &&
                        !link.startsWith("javascript:void(0)") &&
                        !visitedLinks.has(absoluteLink)
                    ) {
                        pageObject.links.push({ linkUrl: absoluteLink });
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
            }
        });

        return pageObject;
    }

    /**
     * Recursively crawls links up to the specified limit.
     * Uses async/await and Promise.all for parallel link processing.
     * @param {string} link 
     */
    async function crawlLoop(link) {
        if (inboundLinks.length >= limit) {
            // Limit reached, return unique links
            return _.uniq(inboundLinks.slice(0, limit));
        }

        // Fetch and parse the current page
        const pageObject = await fetchPageLinks(link);
        crawled.push(pageObject.url);

        // Filter and collect valid internal links
        let newLinks = [];
        for (const item of pageObject.links) {
            let parsedUrl = url.parse(item.linkUrl);
            if (parsedUrl.hostname == base) {
                inboundLinks.push(item.linkUrl);
                newLinks.push(item.linkUrl);
            }
        }

        // Find next links to crawl (not already crawled or visited)
        let nextLinks = _.difference(_.uniq(inboundLinks), crawled);

        // If there are more links and limit not reached, crawl them in parallel
        if (nextLinks.length > 0 && inboundLinks.length < limit) {
            // Limit the number of parallel crawls to avoid overloading
            const parallelLimit = 3;
            const linksToCrawl = nextLinks.slice(0, parallelLimit);

            // Run crawls in parallel for efficiency
            await Promise.all(linksToCrawl.map(l => crawlLoop(l)));
        }

        // Return unique links up to the limit
        return _.uniq(inboundLinks).slice(0, limit);
    }

    // Start crawling from the first link
    const startTime = Date.now();
    const uniqueUrls = await crawlLoop(firstLink);
    const endTime = Date.now();
    // Optionally, you can log the crawl duration:
    // console.log(`Crawl completed in ${(endTime - startTime) / 1000}s`);

    return uniqueUrls;
}; //end fetchEntireSiteRoutes();


/**convert json to base64 */
jsonToBase64 = (jsonData) => {
    try {
        const jsonString = JSON.stringify(jsonData);
        return Buffer.from(jsonString).toString('base64');
    } catch (error) {
        console.error('Error converting JSON to Base64:', error);
        return null;
    }
} //end jsonToBase64();

/**convert base64 to json */
base64ToJson = (base64String) => {
    try {
        const jsonString = Buffer.from(base64String, 'base64').toString('utf-8');
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error decoding Base64:', error);
        return null;
    }
} //end base64ToJson();

/**count home page crawl content words */
countWords = (arr) => {
    let total = 0;
    for (let sentence of arr) {
        total += sentence.split(/\s+/).filter(word => word.length > 0).length;
    }
    return total;
}; //end countWords();

/** 
 * Function to save website crawl logs using async/await for faster response.
 * @param {Object} options - Log details
 * @returns {Promise<void>}
 */
saveCrawlableLogs = async (options) => {
    try {
        // Extract and normalize input parameters
        const websiteUrl = options.website_url || "";
        const uniqueId = options.unique_id || "";
        const isCrawlable = options.is_crawlable || false;
        const webInfoId = options.web_info_id || "";
        const crawlingTimeHomePage = options.crawling_time_home_page || 0;
        const crawlingTimeAllPage = options.crawling_time_all_page || 0;
        const totalCrawlingTime = options.total_crawling_time || 0;
        const firstPostCreate = options.first_post_create || 0;
        const maxTries = options.max_tries || 0;

        const webCrawlLogs = db.collection(TABLE_WEBSITE_CRAWL_LOGS);

        // Insert website crawl logs asynchronously
        await webCrawlLogs.insertOne({
            website_url: websiteUrl,
            unique_id: uniqueId,
            is_crawlable: isCrawlable,
            web_info_id: webInfoId,
            crawling_time_home_page: crawlingTimeHomePage,
            crawling_time_all_page: crawlingTimeAllPage,
            total_crawling_time: totalCrawlingTime,
            first_post_create: firstPostCreate,
            max_tries: maxTries,
            created: getUtcDate()
        });
        // No return value needed; resolves when done
    } catch (error) {
        // Optionally log error for debugging
        console.error("Error saving crawlable logs:", error);
    }
}; // end saveCrawlableLogs()

/** function is used to generate social media presence data */
generateSocialMediaPresence = (req, res, options) => {
    return new Promise(async resolve => {
        let instagramDetails = (options.instagram_details) ? JSON.stringify(options.instagram_details) : "";
        let userPrompt = (options.user_prompt) ? options.user_prompt : "";
        let systemPrompt = (options.system_prompt) ? options.system_prompt : "";

        try {
            let messages = [{ role: "system", content: systemPrompt }, {
                role: "user", content: userPrompt.replace(/{paragraphs}/g, instagramDetails)
            },]

            /**create social post using openAi */
            let aiResult = await openai.createChatCompletion({
                model: "gpt-4o",
                messages: messages,
                max_tokens: MAX_TOKEN,
                temperature: TEMPERATURE,
                top_p: TOP_P,
                frequency_penalty: FREQUENCY_PENALTY,
                presence_penalty: PRESENCE_PENALTY
            });

            let response = aiResult.data.choices[0].message.content;
            var aiResponse = response;

            try {
                let responseData = JSON.parse(aiResponse);
                return resolve({ 'status': STATUS_SUCCESS, 'response': responseData });

            } catch (e) {
                /**send prompt for generate valid json data */
                let validData = await validAiResponse(aiResponse);
                let newResponseData = validData.response;
                try {
                    let newResponse = JSON.parse(newResponseData);
                    return resolve({ 'status': STATUS_SUCCESS, 'response': newResponse });
                } catch (err) {
                    /**send prompt for generate valid json data */
                    let validNewData = await validAiResponse(aiResponse);
                    let againNewResponseData = validNewData.response;
                    try {
                        let againNewResponse = JSON.parse(againNewResponseData);
                        return resolve({ 'status': STATUS_SUCCESS, 'response': againNewResponse });

                    } catch (err) {
                        return resolve({ 'status': STATUS_ERROR, 'response': "" });
                    }
                }
            }
        } catch (err) {
            //console.log(err)
            return resolve({ 'status': STATUS_ERROR, 'response': "" });
        }
    });
} //end generateSocialMediaPresence();

/**
 * Function for inserts or updates web link data in the database.
 * @param {*} obj
 * @returns {Promise<Boolean>} - Resolves to true if the operation is successful, false otherwise.
 */
insertWebLinkData = (options) => {
    return new Promise(async resolve => {
        let webId = (options._id) ? newObjectIdDefault(options._id) : "";
        let email = options.email || "";
        let userId = (options.user_id) ? newObjectIdDefault(options.user_id) : "";
        let websiteUrl = options.website_url || "";
        let childLinks = options.child_links || [];
        let isCrawl = options.is_crawl || NOT_CRAWL;
        let uniqueBrowserId = options.unique_browser_id || "";
        let isInstagramCrawled = options.is_instagram_crawled || false;
        let instagramCode = options.instagram_code || "";

        const web_links = db.collection(TABLE_WEB_LINKS);
        /**insert web links data */
        try {
            await web_links.updateOne({ '_id': webId }, { $set: { 'unique_browser_id': uniqueBrowserId, 'link': websiteUrl, 'child_links': childLinks, 'user_email': email, 'user_id': userId, 'is_crawl': isCrawl, 'is_instagram_crawled': isInstagramCrawled, 'instagram_code': instagramCode, 'is_deleted': NOT_DELETED, 'ai_info_captured': DEACTIVE, 'created': getUtcDate(), 'modified': getUtcDate() } }, { upsert: true });
            return resolve(true);
        } catch (error) {
            return resolve(false);
        }
    });
} //end insertWebLinkData();

/**
 * Function to insert web info data into the database using async/await.
 * @param {*} options - Data to insert.
 * @returns {Promise<ObjectId|string>} - Resolves to inserted id if successful, empty string otherwise.
 */
insertWebInfoData = async (options) => {
    try {
        // Extract and format input parameters
        let webId = options.web_id ? newObjectIdDefault(options.web_id) : "";
        let email = options.email || "";
        let websiteUrl = options.website_url || "";
        let finalData = options.data || {};
        let userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        let uniqueBrowserId = options.unique_browser_id || "";
        let apifyInstagramData = options.apify_data || {};
        let allInstagramPostsFromApify = options.all_instagram_posts_from_apify || [];
        let instagramUrl = options.instagram_url || "";

        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

        // Insert web info data asynchronously
        const result = await web_ai_info.insertOne({
            web_id: webId,
            unique_browser_id: uniqueBrowserId,
            instagram_url: instagramUrl,
            website_url: websiteUrl,
            user_email: email,
            user_id: userId,
            data: finalData,
            apify_instagram_data: apifyInstagramData,
            all_instagram_posts_from_apify: allInstagramPostsFromApify,
            created: getUtcDate(),
            modified: getUtcDate()
        });

        // Return the insertedId if successful, otherwise empty string
        return (result && result.insertedId) ? result.insertedId : "";
    } catch (error) {
        // Handle errors gracefully and return empty string
        return "";
    }
}; // end insertWebInfoData()

/**
 * Generates a system prompt based on user data.
 * @param {Object} req - The request object containing user data.
 * @param {Object} res - The response object.
 * @returns {Promise<string>} A promise resolving to the generated system prompt.
 */
systemPromptData = (req, res) => {
    return new Promise(async resolve => {
        let loginUserData = (req.user_data) ? req.user_data : "";
        let userId = (loginUserData._id) ? loginUserData._id : "";
        if (userId != "") {
            let publicBusinessInformation = (loginUserData) ? loginUserData.public_business_informaton : {};
            let BusinessName = (publicBusinessInformation.name_of_the_business) ? publicBusinessInformation.name_of_the_business : "";
            let PhoneNumber = (publicBusinessInformation.primary_phone) ? publicBusinessInformation.primary_phone : "";
            let Website = (publicBusinessInformation.website_url) ? publicBusinessInformation.website_url : "";
            let Discount = (publicBusinessInformation.preferred_offering_or_discount) ? publicBusinessInformation.preferred_offering_or_discount : "";
            let SpecificProduct = (publicBusinessInformation.specific_product_or_service) ? publicBusinessInformation.specific_product_or_service : "";
            let benefitsProductService = (publicBusinessInformation.benefits_product_or_service) ? publicBusinessInformation.benefits_product_or_service : "";
            let aiIndustryNames = (publicBusinessInformation.ai_business_industry_names) ? publicBusinessInformation.ai_business_industry_names : [];

            if (aiIndustryNames.length > 1) {
                let lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
                aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
                aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
                aiIndustryNames.push(lastConcat);
            }

            let aiBusinessIndustry = aiIndustryNames.join(', ');

            var systemData = `I want you to act as my personal assistant who can {showData} for my business in the ${aiBusinessIndustry} industry. You will use the following data as input: Business name: ${BusinessName}; Business Phone Number: ${PhoneNumber}; Business Website: ${Website}; Preferred offering or discount to capture new clients or customers: ${Discount}; Specific product or service : ${SpecificProduct}; Benefits of product or service : ${benefitsProductService} `;
            return resolve(systemData);
        } else {
            let newData = 'I want you to act as my personal assistant who can {showData} for my business.';
            return resolve(newData);
        }
    });
} //end systemPromptData();

/**
 * Function to remove unused campaign data using async/await for faster response.
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Options containing inserted_id and user_id
 * @returns {Promise<Object>} - Promise resolving with a response object
 */
removeCampaignData = async (req, res, options) => {
    let insertedId = options.inserted_id ? options.inserted_id : "";
    let userId = options.user_id ? options.user_id : "";
    const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
    const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
    const campaignAccordingUserDetails = db.collection(TABLE_CAMPAIGN_ACCORDING_USER_DETAILS);

    try {
        // Delete the campaign name by its ObjectId
        const deleteResult = await tableAiCampaignName.deleteOne({ "_id": newObjectIdDefault(insertedId) });

        if (deleteResult && deleteResult.deletedCount > 0) {
            // Run the following two deletions in parallel for efficiency
            await Promise.all([
                // Delete campaign details according to user
                campaignAccordingUserDetails.deleteOne({
                    "campaign_name_id": newObjectIdDefault(insertedId),
                    "type": DEFAULT_CAMPAIGN
                }),
                // Delete campaign invalid chat
                tableAiCampaignChat.deleteMany({
                    "user_id": newObjectIdDefault(userId),
                    "ai_campaign_parent_id": newObjectIdDefault(insertedId)
                })
            ]);

            // Send error response (as per original logic)
            return {
                "status": STATUS_ERROR,
                "inserted_id": insertedId,
                "result": [],
                "is_poll_generated": false,
                "user_conversation_failed": true,
                "message": res.__("front.pocial_ai.unusual_title"),
            };
        } else {
            // If campaign name was not deleted, send error response
            return {
                "status": STATUS_ERROR,
                "inserted_id": insertedId,
                "result": [],
                "is_poll_generated": false,
                "user_conversation_failed": true,
                "message": res.__("front.system.something_going_wrong_please_try_again")
            };
        }
    } catch (error) {
        // Handle any errors gracefully and return error response
        return {
            "status": STATUS_ERROR,
            "inserted_id": insertedId,
            "result": [],
            "is_poll_generated": false,
            "user_conversation_failed": true,
            "message": res.__("front.system.something_going_wrong_please_try_again")
        };
    }
}; // end removeCampaignData()

/**
 * Function to update user data in web crawl data using async/await.
 * Updates both web_links and web_ai_info collections in parallel for faster response.
 * 
 * @param {Object} options - Options object containing user_id and unique_browser_id
 * @returns {Promise<void>} - Resolves when the update is complete
 */
updateUserInWebCrawlData = async (options) => {
    let userId = newObjectIdDefault(options.user_id) || "";
    let uniqueBrowserId = options.unique_browser_id || "";
    const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
    const web_links = db.collection(TABLE_WEB_LINKS);
    const users = db.collection(TABLE_USERS);

    // Fetch user data (email and public business information)
    let userData = await users.findOne(
        { "_id": userId },
        { projection: { "email": 1, "public_business_informaton": 1 } }
    );

    let email = userData?.email || "";
    let publicBusinessInformaton = userData?.public_business_informaton || "";
    let websiteUrl = (publicBusinessInformaton && publicBusinessInformaton.website_url) ? publicBusinessInformaton.website_url : "";

    // Prepare update objects
    let updateWebLinkData = { 'user_id': userId };
    let updateWebInfoData = { 'user_id': userId };

    if (email) {
        updateWebLinkData["user_email"] = email;
        updateWebInfoData["user_email"] = email;
    }
    if (websiteUrl) {
        updateWebLinkData["link"] = websiteUrl;
        updateWebInfoData["website_url"] = websiteUrl;
    }

    // Run both updates in parallel for efficiency
    await Promise.all([
        // Update web_links collection
        web_links.updateOne(
            { "user_id": "", 'unique_browser_id': uniqueBrowserId },
            { $set: updateWebLinkData }
        ),
        // Update web_ai_info collection
        web_ai_info.updateOne(
            { "user_id": "", 'unique_browser_id': uniqueBrowserId },
            { $set: updateWebInfoData }
        )
    ]);
}; // end updateUserInWebCrawlData()

/**
 * Function to extract text from a PDF file without uploading it
 * 
 * @param {Object} options - Options object containing the file name
 * @returns {Promise} - Promise resolving with the extracted text and status
 */
extractTextFromPdfWithoutFileUpload = (options) => {
    return new Promise(async (resolve) => {
        let fileName = options.file_name || "";

        try {
            const pdfData = await pdfParse(fileName);

            let extractedText = pdfData?.text || "";

            /**Check if any text was extracted*/
            if (!extractedText.trim()) {
                return resolve({
                    status: STATUS_ERROR,
                    extracted_text: "",
                    response: "No text found in document",
                });
            } else {
                extractedText = extractedText.replace(/\s+/g, ' ').trim();

                return resolve({
                    status: STATUS_SUCCESS,
                    extracted_text: extractedText,
                    response: "",
                });

            }
        } catch (err) {
            return resolve({
                status: STATUS_ERROR,
                extracted_text: "",
                response: "",
            });
        }
    });
}; //end extractTextFromPdfWithoutFileUpload();

/**
 * Function to extract text from a document using a URL
 * 
 * @param {Object} options - Options object containing the file name
 * @returns {Promise} - Promise resolving with the extracted text and status
 */
extractTextFromDocumentWithUrl = (options) => {
    return new Promise(async (resolve) => {
        let fileName = options.file_name || "";
        let fileUrl = (fileName) ? AI_ABOUT_USER_FILE_URL + fileName : "";
        const WordExtractor = require("word-extractor");
        const extractor = new WordExtractor();

        try {
            /** Fetch the document from the remote URL*/
            let response = await axios.get(fileUrl, { responseType: "arraybuffer" });
            /** Convert the response data to a buffer*/
            let documentBuffer = Buffer.from(response.data);

            /**Extract data from the document buffer*/
            let document = await extractor.extract(documentBuffer);
            let extractedText = document.getBody();

            /**Output the extracted text*/
            if (!extractedText.trim()) {
                return resolve({
                    status: STATUS_ERROR,
                    extracted_text: "",
                    response: "No text found in document",
                });
            } else {
                extractedText = extractedText.replace(/\s+/g, ' ').trim();
                return resolve({
                    status: STATUS_SUCCESS,
                    extracted_text: extractedText,
                    response: "",
                });

            }
        } catch (error) {
            return resolve({
                status: STATUS_ERROR,
                extracted_text: "",
                response: "",
            });
        }
    });
}; //end extractTextFromDocumentWithUrl();

/**
 * Function to update the AI campaign activation flags for a user using async/await.
 * All DB queries are handled with async/await for faster response and clean formatting.
 * 
 * @param {Object} userResultData - User data object
 * @returns {Promise<void>} - Resolves when the update is complete
 */
aiCampaignAllThreeStepFlagUpdate = async (userResultData) => {
    if (!userResultData) return;

    const users = db.collection(TABLE_USERS);
    const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

    let loginUserResult = userResultData;
    let userId = loginUserResult._id ? loginUserResult._id : "";
    let accountType = loginUserResult.account_type ? loginUserResult.account_type : "";
    let publicBusinessInformaton = loginUserResult.public_business_informaton ? loginUserResult.public_business_informaton : "";

    let campaignDetailTabFilled = publicBusinessInformaton?.campaign_detail_tab_filled || false;
    let campaignOverviewTabFilled = publicBusinessInformaton?.campaign_overview_tab_filled || false;
    let coreInformationTabFilled = publicBusinessInformaton?.core_information_tab_filled || false;

    let aiBusinessIndustryNames = publicBusinessInformaton?.ai_business_industry_names || [];
    let nameOfTheBusiness = publicBusinessInformaton?.name_of_the_business || "";
    let preferredOfferingDiscount = publicBusinessInformaton?.preferred_offering_or_discount || "";
    let primaryPhone = publicBusinessInformaton?.primary_phone || "";
    let callToAction = publicBusinessInformaton?.call_to_action || "";
    let mainGoalYourEmailCampaignName = publicBusinessInformaton?.main_goal_of_your_email_campaign_name || "";
    let populateKeyPhraseFirst = publicBusinessInformaton?.populate_key_phrase_first || "";
    let populateKeyPhraseSecond = publicBusinessInformaton?.populate_key_phrase_second || "";
    let targetAudience = publicBusinessInformaton?.target_audience || "";
    let toneStyleEmailName = publicBusinessInformaton?.tone_or_style_email_name || "";
    let benefitsProductOrService = publicBusinessInformaton?.benefits_product_or_service || "";
    let specificProductOrService = publicBusinessInformaton?.specific_product_or_service || "";
    let uniqueSellingProposition = publicBusinessInformaton?.unique_selling_proposition || "";

    if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
        // Update insider flag if applicable
        try {
            const insiderData = await emailTemplate.findOne({ user_id: newObjectIdDefault(userId), ai_bot: true });
            if (insiderData) {
                await users.updateOne(
                    { _id: newObjectIdDefault(userId) },
                    { $set: { insider_email_action: insiderData.action } }
                );
            }
        } catch (err) {
            // Optionally log error
        }

        // If all campaign tabs are already filled, nothing to do
        if (campaignDetailTabFilled && campaignOverviewTabFilled && coreInformationTabFilled) {
            return;
        }

        // Check if all required fields are filled to update flags
        const allFieldsFilled =
            aiBusinessIndustryNames.length > 0 &&
            nameOfTheBusiness !== '' &&
            preferredOfferingDiscount !== '' &&
            primaryPhone !== '' &&
            callToAction !== '' &&
            mainGoalYourEmailCampaignName !== '' &&
            populateKeyPhraseFirst !== '' &&
            populateKeyPhraseSecond !== '' &&
            targetAudience !== '' &&
            toneStyleEmailName !== '' &&
            benefitsProductOrService !== '' &&
            specificProductOrService !== '' &&
            uniqueSellingProposition !== '';

        if (allFieldsFilled) {
            // Update all three campaign flags in parallel for efficiency
            try {
                await users.updateOne(
                    { _id: newObjectIdDefault(userId) },
                    {
                        $set: {
                            'public_business_informaton.campaign_detail_tab_filled': true,
                            'public_business_informaton.campaign_overview_tab_filled': true,
                            'public_business_informaton.core_information_tab_filled': true,
                        }
                    }
                );
            } catch (err) {
                // Optionally log error
            }
        }
        // If not all fields are filled, do nothing
        return;
    }
    // If not a public business user, do nothing
    return;
}; // end aiCampaignAllThreeStepFlagUpdate

/**
 * Function to update the previous campaign using async/await for faster response.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String} userId - User ID
 * @returns {Promise} - Promise resolving when the update is complete
 */
updatePreviuosCampaign = async (req, res, userId) => {
    try {
        const polls = db.collection(TABLE_POLLS);
        const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

        // Check if the first AI poll is already generated for this user
        const pollData = await polls.findOne({
            "user_id": newObjectIdDefault(userId),
            "first_ai_poll_generated": true,
            "type": POLL_AI_TYPE
        });

        if (pollData && userId) {
            // Already updated, nothing to do
            return;
        }

        // Aggregate to get poll and campaign details
        const pollsDetailsArr = await polls.aggregate([
            {
                $match: {
                    'type': POLL_AI_TYPE,
                    'user_id': newObjectIdDefault(userId)
                }
            },
            {
                $lookup: {
                    from: TABLE_AI_CAMPAIGN_CHAT,
                    let: { ai_campaign_chat_id: "$ai_campaign_chat_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$_id", "$$ai_campaign_chat_id"] }
                                    ]
                                }
                            }
                        },
                        { $project: { ai_campaign_parent_id: 1 } }
                    ],
                    as: "aiCampaignChat"
                }
            },
            {
                $project: {
                    "_id": 0,
                    "ai_campaign_chat_id": 1,
                    "poll_id": "$_id",
                    "ai_campaign_parent_id": { $arrayElemAt: ["$aiCampaignChat.ai_campaign_parent_id", 0] }
                }
            },
            { $limit: 1 }
        ]).toArray();

        if (!pollsDetailsArr || pollsDetailsArr.length === 0) {
            // No poll details found, nothing to update
            return;
        }

        const pollsDetails = pollsDetailsArr[0];
        const pollId = pollsDetails.poll_id;
        const aiCampaignChatId = pollsDetails.ai_campaign_chat_id;
        const aiCampaignParentId = pollsDetails.ai_campaign_parent_id;

        // Prepare update promises for campaign name and chat
        const updateCampaignNamePromise = tableAiCampaignName.updateOne(
            { "_id": newObjectIdDefault(aiCampaignParentId), "user_id": newObjectIdDefault(userId) },
            { $set: { "first_ai_poll_generated": true } }
        );

        const updateCampaignChatPromise = tableAiCampaignChat.updateOne(
            {
                "_id": newObjectIdDefault(aiCampaignChatId),
                "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId),
                "user_id": newObjectIdDefault(userId)
            },
            { $set: { "first_ai_poll_generated": true } }
        );

        // Run both updates in parallel for efficiency
        await Promise.all([updateCampaignNamePromise, updateCampaignChatPromise]);

        // Prepare poll update data
        let pollsUpdateData = {
            "first_ai_poll_generated": true,
            "ai_campaign_parent_id": newObjectIdDefault(aiCampaignParentId)
        };

        // Generate poll image and update if successful
        const optionsImage = {
            url: SIGNUP_POLL_BANNER_IMAGE_URL,
            dest: POLLS_FILE_PATH
        };

        const imageResponse = await downloadImageToUrl(res, req, optionsImage);

        if (imageResponse.status === STATUS_SUCCESS) {
            pollsUpdateData["question_media"] = imageResponse.fileName || "";
            pollsUpdateData["question_extension"] = imageResponse.imageExtension || "";
        }

        // Update the poll with new data
        await polls.updateOne(
            {
                "_id": newObjectIdDefault(pollId),
                "ai_campaign_chat_id": newObjectIdDefault(aiCampaignChatId),
                "user_id": newObjectIdDefault(userId)
            },
            { $set: pollsUpdateData }
        );

        return;
    } catch (error) {
        // Optionally log error for debugging
        // console.error("Error in updatePreviuosCampaign:", error);
        return;
    }
}; // end updatePreviuosCampaign

/**
 * Function to retrieve the first insider poll details using async/await for faster response.
 * 
 * @param {String} userId - User ID
 * @param {Array} optionIdsArry - Array of option IDs
 * @returns {Promise<Object>} - Promise resolving with the poll details and status
 */
firstInsidersPollDetails = async (userId, optionIdsArry) => {
    try {
        if (!userId) {
            // Return error if userId is not provided
            return {
                status: STATUS_ERROR,
                result: {}
            };
        }

        // Build the match condition for the poll
        const condition = {
            user_id: newObjectIdDefault(userId),
            type: POLL_AI_TYPE,
            is_deleted: NOT_DELETED,
            first_ai_poll_generated: true
        };

        // Build the aggregation pipeline
        let pipeline = [
            { $match: condition },
            { $unwind: "$options" }
        ];

        // If optionIdsArry is provided, filter by option IDs
        if (optionIdsArry && optionIdsArry.length > 0) {
            pipeline.push({
                $match: { "options._id": { $in: optionIdsArry } }
            });
        }

        // Add lookup to get vote counts for each option
        pipeline.push(
            {
                $lookup: {
                    from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
                    let: { optionId: "$options._id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$option_id", "$$optionId"] },
                                make_poll_user_id: newObjectIdDefault(userId),
                                user_id: { $nin: ['', null] }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    user_id: "$user_id",
                                    option_id: "$option_id"
                                },
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    as: "voteCounts"
                }
            },
            // Add total_count field to each option
            {
                $addFields: {
                    "options.total_count": {
                        $cond: {
                            if: { $gt: [{ $size: "$voteCounts" }, 0] },
                            then: { $size: "$voteCounts" },
                            else: 0
                        }
                    }
                }
            },
            // Group back to poll level
            {
                $group: {
                    _id: "$_id",
                    slug: { $first: "$slug" },
                    question: { $first: "$question" },
                    user_id: { $first: "$user_id" },
                    ai_campaign_chat_id: { $first: "$ai_campaign_chat_id" },
                    ai_campaign_parent_id: { $first: "$ai_campaign_parent_id" },
                    custom_url: { $first: "$custom_url" },
                    options: { $push: "$options" },
                    question_media: { $first: "$question_media" },
                    question_extension: { $first: "$question_extension" },
                    total_count: { $first: "$total_count" },
                    type: { $first: "$type" },
                    first_ai_poll_generated: { $first: "$first_ai_poll_generated" },
                    created: { $first: "$created" },
                    totalGenerateCount: { $sum: "$options.total_count" }
                }
            },
            // Project the final fields
            {
                $project: {
                    _id: 1,
                    slug: 1,
                    question: 1,
                    user_id: 1,
                    ai_campaign_chat_id: 1,
                    ai_campaign_parent_id: 1,
                    custom_url: 1,
                    options: 1,
                    question_media: 1,
                    question_extension: 1,
                    type: 1,
                    first_ai_poll_generated: 1,
                    total_count: "$totalGenerateCount",
                    created: 1
                }
            }
        );

        const polls = db.collection(TABLE_POLLS);

        // Run the aggregation query asynchronously
        const resultInsiderPolls = await polls.aggregate(pipeline).toArray();

        if (resultInsiderPolls && resultInsiderPolls.length > 0) {
            // Return the first poll result with success status
            return {
                status: STATUS_SUCCESS,
                result: resultInsiderPolls[0]
            };
        } else {
            // No poll found, return error status
            return {
                status: STATUS_ERROR,
                result: {}
            };
        }
    } catch (error) {
        // Log error for debugging if needed
        // console.error("Error in firstInsidersPollDetails:", error);
        return {
            status: STATUS_ERROR,
            result: {}
        };
    }
}; // end firstInsidersPollDetails

/**
 * Function to add AI poll data using async/await for all DB operations.
 * Handles all queries asynchronously for faster response times.
 * @param {*} req 
 * @param {*} res 
 * @param {*} options
 * @returns response
 */
addAiPollData = async (req, res, options) => {
    try {
        // Extract and prepare all required variables
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const customerId = options.customer_id ? options.customer_id : "";
        const aiData = options.ai_data ? options.ai_data : {};
        const signupFlag = options.signup_flag ? options.signup_flag : "";
        const campaignType = options.campaign_type ? options.campaign_type : "";
        const aiCampaignChatId = options.ai_campaign_chat_id ? newObjectIdDefault(options.ai_campaign_chat_id) : "";
        const aiCampaignParentId = options.ai_campaign_parent_id ? newObjectIdDefault(options.ai_campaign_parent_id) : "";
        const pollCategory = "general";
        const pollQuestion = aiData.question ? aiData.question : "";
        const optionsData = aiData.options ? aiData.options : [];
        const hashtagsData = aiData.hashtags ? aiData.hashtags : optionsData;

        const polls = db.collection(TABLE_POLLS);
        const categories = db.collection(TABLE_CATEGORIES);

        // Validate aiData
        if (isBlankObject(aiData)) {
            return {
                status: STATUS_ERROR,
                message: res.__("front.system.something_going_wrong_please_try_again"),
            };
        }

        // Prepare hashtags
        let hasTagDataArr = [];
        if (hashtagsData.length > 0) {
            let newHasTagArr = (hashtagsData.length > 3) ? hashtagsData.slice(0, -1) : hashtagsData;
            if (typeof newHasTagArr === 'object') {
                newHasTagArr.forEach(hasTagdata => {
                    let dataHastag = (hasTagdata.replace(/\s+/g, '-')).toLowerCase();
                    let hagTagTitle = makeHashtag(dataHastag);
                    hasTagDataArr.push(hagTagTitle);
                });
            }
        }
        const hasTagValue = hasTagDataArr.length > 0 ? hasTagDataArr.join(" ") : "";

        // Prepare poll options
        let optionsValue = optionsData.map(data => ({
            _id: newObjectIdDefault(),
            title: data,
            image: "",
            video: "",
            extension: "",
            cta_title: "",
            cta_url: "",
            assign_reward: "",
            enticement_headline: "",
            total_count: 0,
            percentage: 0,
            type: POLL_DECIDED_OPTIONS,
            created: getUtcDate(),
        }));

        // Generate slug for poll
        const slugOptions = {
            title: pollQuestion,
            table_name: TABLE_POLLS,
            slug_field: "slug"
        };
        let slugResponse;
        try {
            slugResponse = await getDatabaseSlug(slugOptions);
        } catch (err) {
            return {
                status: STATUS_ERROR,
                message: res.__("front.system.something_going_wrong_please_try_again"),
            };
        }
        const pollSlug = (slugResponse && slugResponse.title) ? slugResponse.title : "";

        // Get category id by slug
        let categoryResult;
        try {
            categoryResult = await categories.findOne(
                { slug: pollCategory },
                { projection: { _id: 1 } }
            );
        } catch (err) {
            return {
                status: STATUS_ERROR,
                message: res.__("front.system.something_going_wrong_please_try_again"),
            };
        }
        const categoryId = (categoryResult && categoryResult._id) ? categoryResult._id : "";

        // Prepare poll data object
        let pollsData = {
            slug: pollSlug,
            question: pollQuestion,
            user_id: newObjectIdDefault(userId),
            ai_campaign_chat_id: aiCampaignChatId,
            ai_campaign_parent_id: aiCampaignParentId,
            custom_url: (slugResponse && slugResponse.title) ? slugResponse.title : "",
            hashtag: hasTagValue,
            is_deleted: NOT_DELETED,
            is_draft: POLL_NOT_DRAFTS,
            is_published: POLL_PUBLISHED,
            options: optionsValue,
            options_type: "text",
            question_media: "",
            question_extension: "",
            single_option_submitted_type: "",
            real_time: true,
            end_voting_period: false,
            total_count: DEFAULT_ZERO,
            type: POLL_AI_TYPE,
            add_context: "",
            category_id: newObjectIdDefault(categoryId),
            real_time_result: "",
            schedule_end_date: "",
            schedule_end_date_type: "",
            schedule_start_date: "",
            sponsored_link: "",
            sponsored_logo: "",
            sponsored_text: "",
            sponsored_type: "",
            first_ai_poll_generated: (signupFlag !== "") ? true : false,
            campaign_type: campaignType,
            system_generate: (signupFlag !== "") ? true : false,
            created: getUtcDate(),
        };

        // If signupFlag is 'true', download poll banner image and update poll data
        if (signupFlag === 'true') {
            const optionsImage = {
                url: SIGNUP_POLL_BANNER_IMAGE_URL,
                dest: POLLS_FILE_PATH,
            };
            try {
                const imageResponse = await downloadImageToUrl(res, req, optionsImage);
                if (imageResponse.status === STATUS_SUCCESS) {
                    pollsData.question_media = imageResponse.fileName || "";
                    pollsData.question_extension = imageResponse.imageExtension || "";
                }
            } catch (err) {
                // If image download fails, continue without image
            }
        }

        // Insert poll data into database
        try {
            await polls.insertOne(pollsData);
        } catch (saveErr) {
            return {
                status: STATUS_ERROR,
                message: res.__("front.system.something_going_wrong_please_try_again"),
            };
        }

        // Fetch poll summary and save to customer bucket in parallel
        try {
            const pollData = await fetchUserPollSummary(req, res, userId);
            await saveCustomerBucketItems({
                user_id: userId,
                bucket_name: DATA_BUCKET_POLL,
                parent_bucket: PARENT_BUCKET_POLL,
                data: pollData
            });
        } catch (err) {
            // If saving to bucket fails, still return success for poll creation
        }

        // Return success response
        return {
            status: STATUS_SUCCESS,
            message: res.__("front.poll_segment.draft_has_been_added_successfully"),
        };

    } catch (error) {
        // Catch-all error handler
        return {
            status: STATUS_ERROR,
            message: res.__("front.system.something_going_wrong_please_try_again"),
        };
    }
}; // end addAiPollData

/**
 * Function is use to make hastags
 * @param {*} req 
 * @param {*} res 
 * @returns response
 */
makeHashtag = (str) => {
    let wordArray = str.split(' ').filter(char => char !== "");
    let result = "";

    if (wordArray.length === 0) {
        return "";
    };

    result = result + wordArray.map(word => {
        if (word != "#") {
            word = word.replace(/#/g, '');

            let capitalizedWord = (word.includes("#")) ? word : "#" + word;
            return (capitalizedWord) ? capitalizedWord.replace("#", " #") : capitalizedWord;
        }
    }).join('');

    if (result.length > 140) {
        return "";
    } else {
        return (result).trim();
    };
}; //end makeHashtag();

/**
 * Function to add AI rewards data using async/await for faster and cleaner execution.
 * Handles all DB operations asynchronously and returns a clean response.
 * 
 * @param {*} req - Request object
 * @param {*} res - Response object
 * @param {*} rewardOptions - Reward options object
 * @returns {Promise<Object>} - Promise resolving with the result of the operation
 */
addRewardAiData = async (req, res, rewardOptions) => {
    try {
        // Extract and prepare all required variables
        const userId = rewardOptions.user_id ? newObjectIdDefault(rewardOptions.user_id) : "";
        const rewardData = rewardOptions.ai_data ? rewardOptions.ai_data : {};
        const signupFlag = rewardOptions.signup_flag ? rewardOptions.signup_flag : "";
        const campaignType = rewardOptions.campaign_type ? rewardOptions.campaign_type : "";
        const aiCampaignRewardChatId = rewardOptions.ai_campaign_chat_id ? newObjectIdDefault(rewardOptions.ai_campaign_chat_id) : "";
        const aiCampaignRewardParentId = rewardOptions.ai_campaign_parent_id ? newObjectIdDefault(rewardOptions.ai_campaign_parent_id) : "";
        const storeTypeId = newObjectIdDefault(REWARD_IN_STORE_ID);

        // Validate rewardData
        if (isBlankObject(rewardData)) {
            return {
                status: STATUS_ERROR,
                message: res.__("front.system.something_going_wrong_please_try_again"),
            };
        }

        // Prepare reward fields
        const heading = rewardData.heading ? rewardData.heading : "";
        const subHeading = rewardData.subheading ? rewardData.subheading : "";
        const description = rewardData.description ? rewardData.description : "";
        const dates = getDateAfterNintyDays();
        const expiryDateNew = dates.after90Days;

        // Prepare reward data object
        const packageRewardData = {
            user_id: userId,
            ai_campaign_chat_id: aiCampaignRewardChatId,
            ai_campaign_parent_id: aiCampaignRewardParentId,
            lead_forms_id: "",
            reward_text: heading,
            reward_sub_heading: subHeading,
            graphic_image: "",
            graphic_type: "",
            url_attach: "",
            url_title: "",
            url_desc: description,
            result_no: DEFAULT_ZERO,
            is_active: ACTIVE,
            store_type_id: [storeTypeId],
            type: REWARDS_AI_USER_ADD,
            expiry_date: expiryDateNew,
            first_ai_reward_generated: signupFlag !== "" ? true : false,
            campaign_type: campaignType,
            toogle_expiry_date: true,
            system_generate: signupFlag !== "" ? true : false,
        };

        // Add reward to the database asynchronously
        await addPackageReward(packageRewardData);

        // Return success response
        return {
            status: STATUS_SUCCESS,
            message: res.__("front.rewards.rewards_has_been_added_successfully"),
        };
    } catch (error) {
        // Catch-all error handler
        return {
            status: STATUS_ERROR,
            message: res.__("front.system.something_going_wrong_please_try_again"),
        };
    }
}; // end addRewardAiData

/**
 * Function to save campaign details according to user details using async/await.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String} userId - User ID
 * @returns {Promise<Object>} - Promise resolving with the campaign details and status
 */
saveCampaignAccordingUserDetails = async (req, res, userId) => {
    const campaignUserDetailsCollection = db.collection(TABLE_CAMPAIGN_ACCORDING_USER_DETAILS);

    // Validate userId
    if (!userId) {
        return {
            status: STATUS_ERROR,
            message: res.__("front.system.something_going_wrong_please_try_again"),
        };
    }

    // Extract all fields from request
    const alreadySaveCampaignId = req.body.saved_id || "";
    const preferredOfferingOrDiscount = req.body.preferred_offering_or_discount || "";
    const mainGoalYourEmailCampaign = req.body.main_goal_of_your_email_campaign ? newObjectIdDefault(req.body.main_goal_of_your_email_campaign) : "";
    const mainGoalYourEmailCampaignName = req.body.main_goal_of_your_email_campaign_name || "";
    const toneOrStyleEmail = req.body.tone_or_style_email ? newObjectIdDefault(req.body.tone_or_style_email) : "";
    const toneOrStyleEmailName = req.body.tone_or_style_email_name || "";
    const specificProductOrService = req.body.specific_product_or_service || "";
    const benefitsProductOrService = req.body.benefits_product_or_service || "";
    const callToAction = req.body.call_to_action || "";
    const additionalInformation = req.body.additional_information || "";
    const emailDetailPdf = (req.files && req.files.email_detail) ? req.files.email_detail : "";
    const informationGetFromPdf = req.body.information_get_from_pdf || "";
    const attachRewardInEmail = req.body.attach_reward_in_email || "";
    const attachPollInEmail = req.body.attach_poll_in_email || "";

    try {
        if (alreadySaveCampaignId) {
            // Prepare update data
            const updatedData = {
                'main_goal_of_your_email_campaign': mainGoalYourEmailCampaign,
                'main_goal_of_your_email_campaign_name': mainGoalYourEmailCampaignName,
                'preferred_offering_or_discount': preferredOfferingOrDiscount,
                'tone_or_style_email': toneOrStyleEmail,
                'tone_or_style_email_name': toneOrStyleEmailName,
                'specific_product_or_service': specificProductOrService,
                'benefits_product_or_service': benefitsProductOrService,
                'call_to_action': callToAction,
                'additional_information': additionalInformation,
                'email_detail_pdf': emailDetailPdf,
                'information_get_from_pdf': informationGetFromPdf,
                'attach_reward_in_email': attachRewardInEmail,
                'attach_poll_in_email': attachPollInEmail,
                'modified': getUtcDate()
            };

            // Update the campaign details asynchronously
            const result = await campaignUserDetailsCollection.updateOne(
                { "_id": newObjectIdDefault(alreadySaveCampaignId), "user_id": newObjectIdDefault(userId) },
                { $set: updatedData }
            );

            if (result && result.modifiedCount > 0) {
                // Success response
                return {
                    status: STATUS_SUCCESS,
                    result: alreadySaveCampaignId,
                    message: "",
                };
            } else {
                // Error response
                return {
                    status: STATUS_ERROR,
                    result: "",
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                };
            }
        } else {
            // Prepare insert data
            const insertedData = {
                'user_id': newObjectIdDefault(userId),
                'main_goal_of_your_email_campaign': mainGoalYourEmailCampaign,
                'main_goal_of_your_email_campaign_name': mainGoalYourEmailCampaignName,
                'preferred_offering_or_discount': preferredOfferingOrDiscount,
                'tone_or_style_email': toneOrStyleEmail,
                'tone_or_style_email_name': toneOrStyleEmailName,
                'specific_product_or_service': specificProductOrService,
                'benefits_product_or_service': benefitsProductOrService,
                'call_to_action': callToAction,
                'additional_information': additionalInformation,
                'email_detail_pdf': emailDetailPdf,
                'information_get_from_pdf': informationGetFromPdf,
                'attach_reward_in_email': attachRewardInEmail,
                'attach_poll_in_email': attachPollInEmail,
                'created': getUtcDate()
            };

            // Insert the campaign details asynchronously
            const result = await campaignUserDetailsCollection.insertOne(insertedData);

            if (result && result.insertedId) {
                // Success response
                return {
                    status: STATUS_SUCCESS,
                    result: result.insertedId,
                    message: "",
                };
            } else {
                // Error response
                return {
                    status: STATUS_ERROR,
                    result: "",
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                };
            }
        }
    } catch (error) {
        // Catch-all error handler
        return {
            status: STATUS_ERROR,
            result: "",
            message: res.__("front.system.something_going_wrong_please_try_again"),
        };
    }
}; // end saveCampaignAccordingUserDetails

/**
 * Function to save media URLs in UGC gallery using async/await.
 * Handles all DB operations asynchronously and runs media processing in parallel for faster response times.
 * 
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Options containing media URLs and user info
 * @returns {Promise<Object>} - Promise resolving with status object
 */
instagramImageUploadOnUgcGallery = async (req, res, options) => {
    const uniqueBrowserId = options.unique_browser_id || "";
    const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    const websiteUrl = options.website_url || "";
    const mediaUrls = Array.isArray(options.media_urls) ? options.media_urls : [];
    const ugcGallery = db.collection(TABLE_UGC_GALLERY);

    try {
        // If no media URLs provided, return error status
        if (!mediaUrls.length) {
            return { status: STATUS_ERROR };
        }

        // Process all media URLs in parallel
        await Promise.all(
            mediaUrls.map(async (mediaUrl) => {
                if (!mediaUrl) return;

                try {
                    // Check media URL headers to determine content type
                    let response;
                    try {
                        response = await axios.head(mediaUrl, { timeout: 5000 });
                    } catch (err) {
                        // If HEAD request fails, skip this media
                        return;
                    }
                    const contentType = response?.headers?.['content-type'] || "";
                    if (!contentType) return;

                    // Generate slug for this entry
                    const slugOptions = {
                        title: uniqueBrowserId || "",
                        table_name: TABLE_UGC_GALLERY,
                        slug_field: "slug"
                    };
                    const slugResponse = await getDatabaseSlug(slugOptions);

                    // Handle image uploads
                    if (contentType.startsWith('image')) {
                        const optionsImage = {
                            url: mediaUrl,
                            dest: UGC_GALLERY_FILE_PATH,
                        };
                        const imageResponse = await downloadImageToUrl(res, req, optionsImage);
                        if (imageResponse.status === STATUS_SUCCESS) {
                            // Insert image record into UGC gallery
                            await ugcGallery.insertOne({
                                user_id: userId,
                                website_url: websiteUrl,
                                unique_browser_id: uniqueBrowserId,
                                description: "",
                                upload_file: imageResponse.fileName || "",
                                extension: imageResponse.imageExtension || "",
                                instagram_id_link: "",
                                slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
                                created: getUtcDate()
                            });
                        }
                    }

                    // Handle video uploads (only mp4 supported)
                    if (contentType === "video/mp4") {
                        const optionsVideo = {
                            url: mediaUrl,
                            dest: UGC_GALLERY_FILE_PATH,
                        };
                        const videoResponse = await downloadVideoToUrl(res, req, optionsVideo);
                        if (videoResponse.status === STATUS_SUCCESS) {
                            // Insert video record into UGC gallery
                            await ugcGallery.insertOne({
                                user_id: userId,
                                website_url: "",
                                unique_browser_id: uniqueBrowserId,
                                description: "",
                                upload_file: videoResponse.fileName || "",
                                extension: videoResponse.imageExtension || "",
                                instagram_id_link: "",
                                slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
                                created: getUtcDate()
                            });
                        }
                    }
                } catch (err) {
                    // Log error for debugging, but continue processing other media
                    console.error("Error processing media:", err);
                }
            })
        );

        // All media processed successfully
        return { status: STATUS_SUCCESS };
    } catch (error) {
        // Catch-all error handler
        return { status: STATUS_ERROR };
    }
}; //end instagramImageUploadOnUgcGallery();

/**
 * Function to update social media presence document using async/await.
 * All DB operations are handled asynchronously for faster and cleaner execution.
 * Parallelizes independent DB updates and UGC upload for efficiency.
 */
updateSocialMediaPresence = async (req, res, userOptions) => {
    let userId = userOptions.user_id ? newObjectIdDefault(userOptions.user_id) : "";
    let instagramUserId = userOptions.instagram_user_id ? userOptions.instagram_user_id : "";
    let longLivedAccessToken = userOptions.long_lived_access_token ? userOptions.long_lived_access_token : "";
    let ugcGalleryUploaded = userOptions.ugc_gallery_uploaded ? userOptions.ugc_gallery_uploaded : "";

    const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
    const web_links = db.collection(TABLE_WEB_LINKS);

    // Validate required fields
    if (!userId || !instagramUserId || !longLivedAccessToken) {
        return;
    }

    try {
        // 1. Get business info from web_ai_info
        let webInfoData = await web_ai_info.findOne({ "user_id": userId });
        let businessData = "";
        if (webInfoData?.data) {
            businessData = webInfoData.data.businessInfo || {};
        } else if (webInfoData?.apify_instagram_data) {
            businessData = webInfoData.apify_instagram_data.businessInfo || {};
        }

        // 2. Fetch Instagram user data and media
        const userResponse = await axios.get(`https://graph.instagram.com/${instagramUserId}`, {
            params: {
                fields: 'id,username,biography,followers_count,follows_count,profile_picture_url,media{id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count}',
                access_token: longLivedAccessToken
            }
        });

        let userResponseData = userResponse?.data || {};
        let userMediaRes = userResponseData?.media?.data || [];
        delete userResponseData.media;

        if (userMediaRes.length === 0) {
            // No media found, nothing to update
            return;
        }

        // 3. Extract top 3 posts by engagement
        let top3Posts = userMediaRes
            .map(({ caption, timestamp, media_type, media_url, like_count, comments_count }) => ({
                caption,
                timestamp,
                mediaType: media_type,
                mediaUrl: media_url,
                likeCount: like_count,
                commentCount: comments_count,
                totalEngagement: (like_count || 0) + (comments_count || 0),
            }))
            .sort((a, b) => b.totalEngagement - a.totalEngagement)
            .slice(0, 3);

        let mediaUrls = userMediaRes.map(record => record.media_url);

        // 4. Generate social media analysis (AI or Gemini)
        let socialMediaAnalysis = "";
        if (GEMINI_SERVER_ENABLE === true) {
            let instagramData = {
                "user_details": userResponseData,
                "posts": userMediaRes,
            };
            instagramData = objectToMarkdown(instagramData);
            let geminiData = await generateDataVaultDetails(null, null, { 'type': "instagram_url", 'instagram_data': instagramData });
            let responseDataVault = (geminiData.status == STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
            socialMediaAnalysis = responseDataVault;
        } else {
            let instagramOpions = {
                'instagram_details': {
                    "posts": userMediaRes,
                    "user_details": userResponseData
                },
                "user_prompt": CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
                "system_prompt": INSTAGRAM_AFTER_LOGIN_CRAWL_SYSTEM_PROMPT
            };
            let aiData = await generateSocialMediaPresence(req, res, instagramOpions);
            let finalResponseData = aiData.response ? aiData.response : "";
            socialMediaAnalysis = finalResponseData?.socialMediaAnalysis || {};
        }

        // 5. Add top posts and business info to analysis
        if (top3Posts.length > 0) {
            socialMediaAnalysis['topPosts'] = top3Posts;
        }
        if (Object.keys(businessData).length > 0) {
            socialMediaAnalysis['businessInfo'] = businessData;
        }

        let uniqueBrowserId = generateRandomID(10);

        // 6. Prepare parallel DB operations
        let parallelOps = [];

        // Upload UGC gallery images if required
        if (ugcGalleryUploaded) {
            parallelOps.push(
                instagramImageUploadOnUgcGallery(req, res, {
                    'unique_browser_id': uniqueBrowserId,
                    'user_id': userId,
                    'media_urls': mediaUrls
                })
            );
        }

        // Update web_links to mark Instagram as crawled
        parallelOps.push(
            web_links.updateOne(
                { "user_id": userId },
                { $set: { 'is_instagram_crawled': true } }
            )
        );

        // Update web_ai_info with social media presence and all posts
        parallelOps.push(
            web_ai_info.updateOne(
                { "user_id": userId },
                { $set: { 'social_media_presence': socialMediaAnalysis, "all_instagram_posts": userMediaRes } }
            )
        );

        // Run all independent DB operations in parallel
        await Promise.all(parallelOps);

        // 7. Save AI data structure Social Media Presence if available
        if (Object.keys(socialMediaAnalysis).length > 0) {
            let completeSocialData = {
                "business_info": socialMediaAnalysis?.businessInfo || {},
                "audience_engagement": socialMediaAnalysis?.audienceEngagement || {},
                "posting_habits": socialMediaAnalysis?.postingHabits || {},
                "writing_style": socialMediaAnalysis?.writingStyle || {},
                "visual_content": socialMediaAnalysis?.visualContent || {},
                "recommendations": socialMediaAnalysis?.recommendations || {},
                "top_posts": socialMediaAnalysis?.topPosts || [],
                "all_posts": userMediaRes.length > 0 ? userMediaRes : []
            };
            await saveCustomerBucketItems({
                'user_id': userId,
                'bucket_name': DATA_BUCKET_SOCIAL_PRESENCE,
                'parent_bucket': PARENT_BUCKET_SOCIAL_PRESENCE,
                'data': completeSocialData
            });
        }

        // All done
        return;
    } catch (error) {
        // Log error for debugging if needed
        // console.error(error);
        return;
    }
}; // End updateSocialMediaPresence


/**
 * Function to generate social media presence for rediscover.
 * Uses async/await for all DB and API operations.
 * Runs independent DB updates and bucket saves in parallel for faster response times.
 */
generateSocialMediaPresenceForRediscover = async (req, res, userOptions) => {
    // Extract and validate user identifiers
    const userId = userOptions.user_id ? newObjectIdDefault(userOptions.user_id) : "";
    const instagramUserId = userOptions.instagram_user_id ? userOptions.instagram_user_id : "";
    const longLivedAccessToken = userOptions.long_lived_access_token ? userOptions.long_lived_access_token : "";
    const customerId = userOptions.customer_id ? userOptions.customer_id : "";

    const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
    const web_links = db.collection(TABLE_WEB_LINKS);

    if (!userId || !instagramUserId || !longLivedAccessToken) {
        // Required fields missing, return error
        return;
    }

    try {
        // 1. Fetch Instagram user profile and media
        const userResponse = await axios.get(`https://graph.instagram.com/${instagramUserId}`, {
            params: {
                fields: 'id,username,biography,followers_count,follows_count,profile_picture_url,media{id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count}',
                access_token: longLivedAccessToken
            }
        });

        const userResponseData = userResponse?.data || {};
        const userMediaRes = userResponseData?.media?.data || [];
        delete userResponseData.media;

        if (!userMediaRes.length) {
            // No posts found on Instagram account
            return {
                status: STATUS_ERROR,
                business_data: {},
                message: res.__("front.instagram.no_posts_on_instagram_account")
            };
        }

        // 2. Extract top 3 posts by engagement
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
        let businessProfileData = {};
        let webSiteScrapData = {};
        let businessData = {};
        let childLinks = [];

        // 3. Generate social media analysis using Gemini or fallback AI
        if (GEMINI_SERVER_ENABLE === true) {
            let instagramData = {
                user_details: userResponseData,
                posts: userMediaRes,
            };
            instagramData = objectToMarkdown(instagramData);

            // Generate Gemini response data
            const geminiData = await generateDataVaultDetails(
                null,
                null,
                { type: "instagram_url", instagram_data: instagramData }
            );
            const responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
            socialMediaAnalysis = responseDataVault || {};
        } else {
            // Use fallback AI to generate social media presence
            const instagramOptions = {
                instagram_details: {
                    posts: userMediaRes,
                    user_details: userResponseData
                },
                user_prompt: CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
                system_prompt: INSTAGRAM_CRAWL_SYSTEM_PROMPT
            };

            const aiData = await generateSocialMediaPresence(req, res, instagramOptions);
            const finalResponseData = aiData?.response || {};

            socialMediaAnalysis = finalResponseData?.socialMediaAnalysis || {};
            businessProfileData = finalResponseData?.businessProfileData || {};

            businessData = businessProfileData.businessInfo || {};
            const websiteUrl = businessProfileData.websiteUrl || "";

            // 4. If website URL found, crawl it for additional business info
            if (websiteUrl) {
                const { status, web_info_data } = await crawlWebsiteUrlWhileInstagramLogin(req, res, { website_url: websiteUrl, businessInfo: businessData }) || {};
                if (status === STATUS_SUCCESS && web_info_data) {
                    webSiteScrapData = web_info_data;
                    webSiteScrapData['website_url'] = websiteUrl;
                    const childLinksArray = web_info_data.child_links || [];
                    if (childLinksArray.length) childLinks.push(childLinksArray);
                }
            }
        }

        // 5. Add top posts and business info to social media analysis
        if (top3Posts.length > 0) {
            socialMediaAnalysis['topPosts'] = top3Posts;
        }
        if (Object.keys(businessData).length > 0) {
            socialMediaAnalysis['businessInfo'] = businessData;
        }

        // 6. Prepare update data for DB
        let updateData = {};
        let businessInfoData = Object.keys(webSiteScrapData).length ? webSiteScrapData : businessProfileData;

        if (Object.keys(webSiteScrapData).length) {
            updateData['data'] = { ...webSiteScrapData };
            updateData['social_media_presence'] = { ...socialMediaAnalysis };
            updateData['all_instagram_posts'] = userMediaRes;
        } else {
            updateData['social_media_presence'] = { ...socialMediaAnalysis };
            updateData['all_instagram_posts'] = userMediaRes;
        }

        // 7. Update DB entries in parallel for faster response
        await Promise.all([
            web_links.updateOne(
                { user_id: userId },
                { $set: { is_instagram_crawled: true } }
            ),
            web_ai_info.updateOne(
                { user_id: userId },
                { $set: updateData }
            )
        ]);

        // 8. Save bucket data in parallel if available
        const saveTasks = [];

        if (Object.keys(webSiteScrapData).length) {
            const bucketData = {
                business_info: webSiteScrapData.businessInfo || {},
                business_categories: webSiteScrapData.businessCategories || [],
                key_products: webSiteScrapData.keyProducts || [],
                home_services: webSiteScrapData.services || [],
                social_links: webSiteScrapData.socialLinks || {},
                contact_info: webSiteScrapData.contactInfo || {},
                menu: webSiteScrapData.Menu || "",
                about: webSiteScrapData.About || ""
            };
            saveTasks.push(
                saveCustomerBucketItems({
                    user_id: userId,
                    bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                    parent_bucket: PARENT_BUCKET_ABOUT_BUSINESS,
                    data: bucketData
                })
            );
        }

        if (Object.keys(socialMediaAnalysis).length) {
            const completeSocialData = {
                business_info: socialMediaAnalysis.businessInfo || {},
                audience_engagement: socialMediaAnalysis.audienceEngagement || {},
                posting_habits: socialMediaAnalysis.postingHabits || {},
                writing_style: socialMediaAnalysis.writingStyle || {},
                visual_content: socialMediaAnalysis.visualContent || {},
                recommendations: socialMediaAnalysis.recommendations || {},
                top_posts: socialMediaAnalysis.topPosts || [],
                all_posts: userMediaRes
            };
            saveTasks.push(
                saveCustomerBucketItems({
                    user_id: userId,
                    bucket_name: DATA_BUCKET_SOCIAL_PRESENCE,
                    parent_bucket: PARENT_BUCKET_SOCIAL_PRESENCE,
                    data: completeSocialData
                })
            );
        }

        // Run all bucket saves in parallel
        if (saveTasks.length) {
            await Promise.all(saveTasks);
        }

        // 9. Return success response
        return {
            status: STATUS_SUCCESS,
            business_data: businessInfoData,
            message: res.__("front.instagram.social_media_presence_rediscover_successfully")
        };

    } catch (error) {
        // Catch-all error handler
        return {
            status: STATUS_ERROR,
            business_data: {},
            social_media_presence: {},
            all_instagram_posts: [],
            message: res.__("front.system.something_going_wrong_please_try_again")
        };
    }
}; // End generateSocialMediaPresenceForRediscover

/**
 * Function is used to crawl data from url and save in logs
 * Uses async/await for all queries and runs independent queries in parallel for faster response times.
 * @param {*} req  
 * @param {*} res 
 * @param {*} options
 * @return {Promise<Object>}
 */
crawlWebsiteUrlWhileInstagramLogin = async (req, res, options) => {
    let websiteUrl = options.website_url || "";
    let uniqueAiBrowserId = options.unique_ai_browser_id || "";
    let userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    let businessData = options.businessInfo || {};

    try {
        // Extract hostname and domain
        const hostname = websiteUrl.split('//')[1].split('/')[0];
        const parts = hostname.split('.');
        const domain = parts.length > 2 ? parts.slice(-2).join('.') : hostname;

        // Ensure protocol is present
        let protocolSite = await checkProtocol(websiteUrl);
        websiteUrl = protocolSite ? protocolSite : websiteUrl;

        // Get not allowed domains from settings
        let urlDomainsNotAllowed = domain ? JSON.parse(JSON.stringify(res.locals.settings["Site.Not_crawl_domain"])) : [];
        if (urlDomainsNotAllowed.includes(domain)) {
            return { status: STATUS_ERROR };
        }

        // Crawl website data
        let crawlWebsiteData = await getWebsiteTextData({ website_url: websiteUrl });
        if (crawlWebsiteData.status === STATUS_SUCCESS) {
            let crawlResponse = crawlWebsiteData.result || {};
            let data = crawlResponse.data || [];
            let socialMediaLinks = crawlResponse.socialMediaLinks || [];
            let emailAddresses = crawlResponse.emailAddresses || [];
            let contactNumbers = crawlResponse.contactNumbers || [];
            let linksArray = crawlResponse.linksArray || [];
            let uniqueImageUrls = crawlResponse.uniqueImageUrls || [];

            // Filter and process paragraphs
            const maxTokenLimit = 1000;
            const minWordCount = 2;
            const processedTexts = new Set();
            const filteredParagraphs = [];
            for (const paragraph of data) {
                if (!processedTexts.has(paragraph) && paragraph.split(' ').length >= minWordCount) {
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

            // Fix sentence spacing
            function fixSentenceSpacing(text) {
                return text.split(' ').filter(word => word !== '').join(' ');
            }
            const fixedParagraphs = filteredParagraphs.map(fixSentenceSpacing);

            // Append social/contact info
            if (socialMediaLinks.length > 0) fixedParagraphs.push(`Social media links : ${socialMediaLinks.join(', ')}`);
            if (emailAddresses.length > 0) fixedParagraphs.push(`Contact Emails : ${emailAddresses.join(', ')}`);
            if (contactNumbers.length > 0) fixedParagraphs.push(`Available contact numbers data : ${contactNumbers.join(', ')}`);
            let crawlData = fixedParagraphs;

            // Handle image uploads in parallel if any
            if (uniqueAiBrowserId && uniqueImageUrls && uniqueImageUrls.length > 0) {
                const ugcGallery = db.collection(TABLE_UGC_GALLERY);
                // Prepare all image upload tasks
                const imageUploadTasks = uniqueImageUrls.map(async (imageUrl) => {
                    try {
                        // Download image and check dimensions
                        let imageBuffer, metadata;
                        try {
                            const { data: buffer } = await axios.get(imageUrl, { maxRedirects: 0, responseType: 'arraybuffer' });
                            imageBuffer = buffer;
                            metadata = await sharp(imageBuffer).metadata();
                            if (!(metadata.width >= UGC_GALLERY_IMAGE_MINIMUM_SIZE && metadata.height >= UGC_GALLERY_IMAGE_MINIMUM_SIZE)) {
                                return;
                            }
                        } catch (error) {
                            // Handle redirects and check dimensions
                            if (error.response && [301, 302, 303, 307, 308].includes(error.response.status)) {
                                const redirectUrl = error.response.headers.location;
                                let checkDimension = await isImageWithinDimensions(imageUrl);
                                if (checkDimension) {
                                    imageUrl = redirectUrl;
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                        }

                        // Generate slug for image
                        let slugOptions = {
                            title: uniqueAiBrowserId || "",
                            table_name: TABLE_UGC_GALLERY,
                            slug_field: "slug"
                        };
                        let slugResponse = await getDatabaseSlug(slugOptions);

                        // Download image to server
                        let imageResponse = await downloadImageToUrl(res, req, { url: imageUrl, dest: UGC_GALLERY_FILE_PATH });
                        if (imageResponse.status === STATUS_SUCCESS) {
                            let imageUrlName = imageResponse.fileName || "";
                            let imageExtension = imageResponse.imageExtension || "";

                            // Insert image record into UGC gallery
                            await ugcGallery.insertOne({
                                user_id: userId,
                                website_url: websiteUrl,
                                unique_browser_id: uniqueAiBrowserId,
                                description: "",
                                upload_file: imageUrlName,
                                extension: imageExtension,
                                instagram_id_link: "",
                                slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
                                created: getUtcDate()
                            });
                        }
                    } catch (err) {
                        // Ignore errors for individual images
                        return;
                    }
                });
                // Run all image upload tasks in parallel
                await Promise.all(imageUploadTasks);
            }

            // If crawl data exists, process further
            if (crawlData.length > 0) {
                // Extract and process child links
                let otherPgesLinksArray = await extractDomainLinks(linksArray);
                let childLinks = Array.isArray(otherPgesLinksArray.data.urls) ? changePageType(otherPgesLinksArray.data.urls) : [];
                let paragraphs = crawlData.join("\n\n");

                // Use Gemini or OpenAI for further processing
                if (GEMINI_SERVER_ENABLE === true) {
                    try {
                        let geminiData = await generateDataVaultDetails(null, null, { type: "website_url", paragraph: paragraphs });
                        let responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};

                        // Assign business info if available
                        if (Object.keys(businessData).length > 0) {
                            responseDataVault['businessInfo'] = businessData;
                        }

                        return { status: STATUS_SUCCESS, web_info_data: responseDataVault, child_links: childLinks };
                    } catch (err) {
                        return { status: STATUS_ERROR, web_info_data: "", child_links: [] };
                    }
                } else {
                    // Use OpenAI for response
                    let system = CRAWLING_DATA_SYSTEM_PROMPT;
                    let user = CRAWLING_DATA_USER_PROMPT.replace(/{paragraphs}/g, paragraphs);
                    try {
                        let result = await callOpenAIChat({ system, user, res_json: ACTIVE });
                        let response = result.response ? result.response : {};
                        removeEmptyKeys(response);
                        let webInfoData = response;

                        // Assign business info if available
                        if (Object.keys(businessData).length > 0) {
                            webInfoData['businessInfo'] = businessData;
                        }

                        return { status: STATUS_SUCCESS, web_info_data: webInfoData, child_links: childLinks };
                    } catch (e) {
                        return { status: STATUS_ERROR, web_info_data: "", child_links: [] };
                    }
                }
            } else {
                // No crawl data found
                return { status: STATUS_ERROR, web_info_data: "", child_links: [] };
            }
        } else {
            // Fallback if crawling failed
            if (GEMINI_SERVER_ENABLE === true) {
                try {
                    let geminiData = await generateDataVaultFallbackProcess(req, res, { website_url: websiteUrl || "" });
                    let responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};

                    // Assign business info if available
                    if (Object.keys(businessData).length > 0) {
                        responseDataVault['businessInfo'] = businessData;
                    }

                    return { status: STATUS_SUCCESS, web_info_data: responseDataVault, child_links: [] };
                } catch (err) {
                    return { status: STATUS_ERROR, web_info_data: "", child_links: [] };
                }
            } else {
                // OpenAI fallback with retry logic
                let maxRetries = 1;
                const fetchWebsiteData = async (retryCount = 0) => {
                    let promptData = GET_WEBSITE_ADDRESS_PROMPT.replace(/{web_address}/g, websiteUrl).replace(/{zip_code}/g, "") + " " + GET_DATA_FROM_URL_FORMAT.replace(/{web_address}/g, websiteUrl);
                    try {
                        let urlData = await getWebsiteDataFromUrl(req, res, { system_prompt: ``, user_prompt: promptData });
                        let finalData = urlData.response || "";
                        if (urlData.status === STATUS_SUCCESS && typeof finalData === 'object') {
                            if (!('message' in finalData) && !('error' in finalData) && !('response' in finalData)) {
                                return finalData;
                            } else if ('error' in finalData) {
                                return null;
                            }
                        }
                        if (retryCount < maxRetries) {
                            return await fetchWebsiteData(retryCount + 1);
                        } else {
                            return null;
                        }
                    } catch (error) {
                        if (retryCount < maxRetries) {
                            return await fetchWebsiteData(retryCount + 1);
                        } else {
                            return null;
                        }
                    }
                };

                let finalData = await fetchWebsiteData();
                if (finalData) {
                    if (Object.keys(businessData).length > 0) {
                        finalData['businessInfo'] = businessData;
                    }
                    return { status: STATUS_SUCCESS, web_info_data: finalData, child_links: [] };
                } else {
                    return { status: STATUS_ERROR, web_info_data: "", child_links: [] };
                }
            }
        }
    } catch (error) {
        // Catch-all error handler
        return {
            status: STATUS_ERROR,
            web_info_data: "",
            child_links: [],
            message: `Failed to crawl and save data from "${websiteUrl}": ${error.message}`
        };
    }
}; // end crawlWebsiteUrlWhileInstagramLogin


/**
 * Converts a JavaScript object to a markdown-style plain text representation.
 * Handles nested objects and arrays recursively.
 * All synchronous, no DB queries here, but formatted for clarity and future async expansion if needed.
 * @param {Object} obj - The object to convert.
 * @param {number} indentLevel - The current indentation level.
 * @returns {string} - The markdown-formatted string.
 */
objectToMarkdown = (obj, indentLevel = 0) => {
    const indent = '  '.repeat(indentLevel);
    let markdown = '';

    // Helper to capitalize and space camelCase / PascalCase keys
    const capitalizeKey = (key) => {
        return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, str => str.toUpperCase());
    };

    // Iterate over object keys
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key];
            const capitalKey = capitalizeKey(key);

            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recursively process nested objects
                markdown += `${indent}${capitalKey}:\n`;
                markdown += objectToMarkdown(value, indentLevel + 1);
            } else if (Array.isArray(value)) {
                // Process arrays in parallel if needed (currently synchronous)
                markdown += `${indent}${capitalKey}:\n`;
                // If you ever need to process array items asynchronously, use Promise.all here
                value.forEach((item, i) => {
                    if (typeof item === 'object' && item !== null) {
                        markdown += `${indent}  ${i + 1}). `;
                        markdown += objectToMarkdown(item, indentLevel + 2);
                    } else {
                        markdown += `${indent}    ${item}\n`;
                    }
                });
            } else {
                // Primitive values
                markdown += `${indent}${capitalKey}: ${value}\n`;
            }
        }
    }
    return markdown;
};

/**
 * Function is used to save customers interactions logs using async/await.
 * All DB operations are handled asynchronously for faster and cleaner execution.
 * @param {Object} options
 * @returns {Promise<string|undefined>} Inserted document ID or undefined on error
 */
saveCustomerInteractions = async (options) => {
    try {
        // Prepare all required fields
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const customerId = options.customer_id ? options.customer_id : "";
        const interactionType = options.interaction_type ? options.interaction_type : "";
        const interactionData = options.interaction_data ? options.interaction_data : "";
        const subType = options.sub_type ? options.sub_type : "";
        const createSource = options.create_source ? options.create_source : "";
        const aiCampaignNameId = options.ai_campaign_name_id ? newObjectIdDefault(options.ai_campaign_name_id) : "";
        const aiCampaignChatId = options.ai_campaign_chat_id ? newObjectIdDefault(options.ai_campaign_chat_id) : "";

        const customerInteractions = db.collection(TABLE_CUSTOMER_INTERACTION_ENTRIES);

        // Get unique conversation id (async)
        const conversationId = await getUniqueConversationId({ type: interactionType, sub_type: subType });

        // Prepare document to insert
        const insertedData = {
            user_id: userId,
            ai_campaign_name_id: aiCampaignNameId,
            ai_campaign_chat_id: aiCampaignChatId,
            customer_id: customerId,
            conversation_id: conversationId,
            type: interactionType,
            sub_type: subType,
            data: interactionData,
            is_deleted: NOT_DELETED,
            create_source: createSource,
            created: getUtcDate(),
            modified: getUtcDate()
        };

        // Insert document asynchronously
        const result = await customerInteractions.insertOne(insertedData);

        // Return insertedId if successful
        if (result && result.insertedId) {
            return result.insertedId;
        } else {
            // Return undefined on error
            return;
        }
    } catch (error) {
        // Log error if needed
        // console.error("Error saving customer interaction:", error);
        return;
    }
};

/**
 * Function is used to save customers interactions edit logs
 * Uses async/await for all DB operations for cleaner and faster execution.
 * @param {*} options
 * @return {Promise<ObjectId|undefined>} Inserted document ID or undefined on error
 */
saveCustomerInteractionEditLogs = async (options) => {
    try {
        // Prepare all required fields
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const customerId = options.customer_id ? options.customer_id : "";
        const conversationId = options.conversation_id ? options.conversation_id : "";
        const interactionType = options.interaction_type ? options.interaction_type : "";
        const editConversation = options.edit_conversation ? options.edit_conversation : [];
        const subType = options.sub_type ? options.sub_type : "";
        const aiCampaignChatId = options.ai_campaign_chat_id ? newObjectIdDefault(options.ai_campaign_chat_id) : "";
        const aiCampaignNameId = options.ai_campaign_name_id ? newObjectIdDefault(options.ai_campaign_name_id) : "";

        const customerConversationEntries = db.collection(TABLE_CUSTOMER_CONVERSATION_ENTRIES);

        // Get unique edit conversation id (async)
        const conversationEditId = await getUniqueConversationId({ slug: EDIT_CONVERSATION });

        // Prepare document to insert
        const insertedData = {
            edit_id: conversationEditId,
            user_id: userId,
            ai_campaign_chat_id: aiCampaignChatId,
            ai_campaign_name_id: aiCampaignNameId,
            customer_id: customerId,
            conversation_id: conversationId,
            type: interactionType,
            sub_type: subType,
            edit_conversations: editConversation,
            is_deleted: NOT_DELETED,
            created: getUtcDate(),
            modified: getUtcDate()
        };

        // Insert document asynchronously
        const result = await customerConversationEntries.insertOne(insertedData);

        // Return insertedId if successful
        if (result && result.insertedId) {
            return result.insertedId;
        } else {
            // Return undefined on error
            return;
        }
    } catch (error) {
        // Log error if needed
        // console.error("Error saving customer interaction edit log:", error);
        return;
    }
};

/**
 * Function to get a unique conversation ID for customer interactions.
 * Uses async/await for DB operations for cleaner and faster execution.
 * @param {Object} options
 * @returns {Promise<string|Object>} Returns the unique conversation ID or empty object if insufficient data.
 */
getUniqueConversationId = async (options) => {
    try {
        // Extract type, sub_type, and slug from options
        const type = options.type || '';
        const sub_type = options.sub_type || '';
        let slugData = options.slug || '';

        // If all identifiers are missing, return empty object
        if (!type && !sub_type && !slugData) {
            return {};
        }

        // Define the collection for incrementals
        const incrementals = db.collection(TABLE_INCREMENTALS);

        // If slug is not provided, generate it from type and sub_type
        if (!slugData && type) {
            slugData = [type, sub_type, 'conversation'].filter(Boolean).join('-');
        }

        // Atomically increment the number for the given slug and fetch the updated record
        const incrementalRecord = await incrementals.findOneAndUpdate(
            { slug: slugData },
            { $inc: { number: 1 } },
            { returnDocument: 'after', upsert: true }
        );

        const response = incrementalRecord && incrementalRecord.value ? incrementalRecord.value : {};
        const prefix = response.prefix || '';
        const number = response.number || 0;

        // Pad the number to always be 4 digits
        const paddedNumber = number.toString().padStart(4, '0');
        const conversationId = prefix + paddedNumber;

        return conversationId;
    } catch (error) {
        // Log error if needed
        // console.error("Error generating unique conversation ID:", error);
        return {};
    }
};

/**
 * Function to generate onboarding social posts and schedule them.
 * Uses async/await for all DB operations and runs independent queries in parallel for faster response times.
 * @param {*} req
 * @param {*} res
 * @param {*} userData
 * @returns {Promise<Object>} JSON response with status and message
 */
generateOnboardingSocialPostAndSchedule = async (req, res, userData) => {
    const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
    const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
    const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

    let userId = userData._id ? newObjectIdDefault(userData._id) : "";
    let zipCode = userData ? userData.zip : "";
    let publicBusinessInformation = userData.public_business_informaton ? userData.public_business_informaton : {};
    let businessName = publicBusinessInformation?.name_of_the_business || "";
    let aiIndustryNames = publicBusinessInformation?.ai_business_industry_names || [];
    let facebookPageId = userData.facebook_page_id || "";
    let facebookPageAccessToken = userData.facebook_page_access_token || "";
    let websiteUrl = publicBusinessInformation.website_url || "";
    let scrapeWithInstagram = userData.scrape_with_instagram || "";

    // Format industry names for better readability
    if (aiIndustryNames.length > 1) {
        let lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
        aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
        aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
        aiIndustryNames.push(lastConcat);
    }
    let aiBusinessIndustry = aiIndustryNames.join(', ');

    try {
        // Fetch business information and last captions in parallel
        const [businessInformation, lastCaptionArr] = await Promise.all([
            web_ai_info.findOne(
                { user_id: userId },
                { projection: { _id: 0, data: 1, social_media_presence: 1, apify_instagram_data: 1 } }
            ),
            tableAiCampaignChat.find(
                { "user_id": userId, "type": AI_RESPONSE_TYPE_SOCIAL_MEDIA, "signup_flag": false },
                { projection: { '_id': 0, 'content.captions': 1, 'content.title': 1 } }
            ).sort({ "created": SORT_DESC }).limit(10).toArray()
        ]);

        // Format last captions and titles
        let captionsAndTitles = (lastCaptionArr.length > 0)
            ? lastCaptionArr.map((item, index) => {
                let title = item.content.title;
                let caption = item.content.captions;
                return `${index + 1}. title: ${title}\ncaption: ${caption}`;
            }).join('\n\n')
            : '';

        let aiInformationData = businessInformation?.data || {};
        let apifyInstagramData = businessInformation?.apify_instagram_data || {};

        // Prepare top post data from Instagram
        let topPostData = [];
        if (apifyInstagramData && Object.keys(apifyInstagramData).length > 0) {
            if (Array.isArray(apifyInstagramData.topPosts)) {
                topPostData = apifyInstagramData.topPosts.map(post => {
                    const fullUrl = `${UGC_GALLERY_FILE_URL}${post.media_url}`;
                    return {
                        "media_url": fullUrl,
                        "caption": post.caption,
                        "like_count": post.like_count,
                        "comments_count": post.comments_count
                    };
                });
                delete apifyInstagramData.topPosts;
            }
            aiInformationData = { ...aiInformationData, ...apifyInstagramData };
        }

        // Remove unnecessary keys and empty values
        let keysToRemove = [
            'socialLinks', 'seoKeywords', 'ctaText', 'toneOfSite', 'zipCode',
            'uniqueSellingProposition', 'primaryGoal', 'targetAudience', 'offerDiscounts'
        ];
        keysToRemove.forEach(key => delete aiInformationData[key]);
        removeEmptyKeys(aiInformationData);

        // Convert objects to markdown for AI prompt
        aiInformationData = objectToMarkdown(aiInformationData);
        topPostData = objectToMarkdown(topPostData);

        // Prepare options for onboarding post data
        let optionsData = {
            'industry': aiBusinessIndustry,
            'location': zipCode,
            'data_vault': aiInformationData,
            'top_posts': topPostData,
            'instagram_user': scrapeWithInstagram ? INSTAGRAM_URL : "",
            'last_captions': captionsAndTitles || "",
        };

        // Get onboarding post data from AI
        let onboardCaptions = await getOnboardingPostDataFromGimini(optionsData);

        let weekOfOPosts = (onboardCaptions.status === STATUS_SUCCESS && onboardCaptions.result)
            ? onboardCaptions.result
            : [];
        weekOfOPosts = (weekOfOPosts.length > 0) ? weekOfOPosts.slice().reverse() : [];

        if (onboardCaptions.status === STATUS_SUCCESS && weekOfOPosts.length > 0) {
            // Define schedule map for posts
            let scheduleMap = {
                1: [[3, "12:00:00"]],
                2: [[5, "06:00:00"], [3, "12:00:00"]],
                3: [[7, "12:00:00"], [5, "06:00:00"], [3, "12:00:00"]],
                // 4: [[9, "09:00:00"], [7, "12:00:00"], [5, "06:00:00"], [3, "12:00:00"]],
                // 5: [[11, "19:00:00"], [9, "09:00:00"], [7, "12:00:00"], [5, "06:00:00"], [3, "12:00:00"]],
                // 6: [[13, "09:00:00"], [11, "19:00:00"], [9, "09:00:00"], [7, "12:00:00"], [5, "06:00:00"], [3, "12:00:00"]],
                // 7: [[15, "19:00:00"], [13, "09:00:00"], [11, "19:00:00"], [9, "09:00:00"], [7, "12:00:00"], [5, "06:00:00"], [3, "12:00:00"]]
            };

            let allDataResponses = [];
            let postInsertTasks = [];

            // Prepare all post insertions in parallel
            for (let i = 0; i < weekOfOPosts.length; i++) {
                postInsertTasks.push((async () => {
                    let campaignName = "week of posts" + (i + 1);
                    let post = weekOfOPosts[i];
                    let postTitle = post.result.title;
                    let postCaption = post.result.caption;
                    let hashtags = post.result.hashtags;
                    postCaption = postCaption
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/[\[\(\{][^\]\)\}]*[\]\)\}]|\*/g, '')
                        .replace(/(?!\\n)[^\S\r\n]+/g, ' ')
                        .trim();

                    // Get the slug for the campaign name
                    let slugOptions = {
                        'title': campaignName,
                        'table_name': TABLE_AI_CAMPAIGN_NAME,
                        'slug_field': "slug"
                    };
                    let slugResponse = await getDatabaseSlug(slugOptions);

                    // Insert the campaign name into the table
                    let result = await tableAiCampaignName.insertOne({
                        'user_id': userId,
                        'slug': slugResponse?.title || "",
                        'ai_campaign_name': campaignName,
                        'ai_campaign_created_name': "",
                        'type': DEFAULT_CAMPAIGN,
                        'is_deleted': NOT_DELETED,
                        'first_ai_poll_generated': false,
                        'created': getUtcDate(),
                    });
                    let aiCampaignNameId = result.insertedId || "";
                    let uniqueKey = generateRandomID(8);

                    try {
                        let postContentData = {
                            'title': postTitle,
                            'captions': postCaption + "\n" + hashtags,
                        };
                        let autoGenerateNumber = Number(i + 1);

                        // Insert the campaign chat data
                        let campaignChatData = {
                            'user_id': userId,
                            'ai_campaign_parent_id': aiCampaignNameId,
                            'role': AI_ROLE_ASSISTANT,
                            'content': postContentData,
                            'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            'is_viewed': false,
                            "signup_flag": false,
                            'unique_key': uniqueKey,
                            'is_draft': CAMPAIGN_NOT_DRAFT,
                            'is_deleted': NOT_DELETED,
                            'is_scheduled': true,
                            'system_generate': true,
                            'auto_generate': true,
                            'auto_generate_number': autoGenerateNumber,
                            'created': getUtcDate(),
                        };

                        let resultChat = await tableAiCampaignChat.insertOne(campaignChatData);
                        let aiCampaignChatId = resultChat.insertedId || "";

                        // Schedule the post with a date based on the index
                        let scheduleTemplate = scheduleMap[weekOfOPosts.length] || scheduleMap[3];
                        let scheduleDate = "";
                        if (scheduleTemplate[i]) {
                            const [dayOffset, time] = scheduleTemplate[i];
                            scheduleDate = getDateWithSchedule(dayOffset, time);
                        }

                        // Insert the schedule data for the post
                        let scheduleInsertOptions = {
                            'title_name': postTitle,
                            'schedule_date': scheduleDate,
                            'user_id': userId,
                            'unique_key': uniqueKey,
                            'ai_campaign_parent_id': aiCampaignNameId,
                            'ai_campaign_chat_id': aiCampaignChatId,
                            'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            'instagram_enable': true,
                            'facebook_enable': true,
                            'facebook_page_id': facebookPageId,
                            'facebook_page_access_token': facebookPageAccessToken,
                        };

                        await schedulePostInsertData(req, res, scheduleInsertOptions);

                        allDataResponses.push(postContentData);
                    } catch (error) {
                        // If AI response failed, delete the inserted campaign
                        await tableAiCampaignName.deleteOne({
                            "_id": newObjectIdDefault(aiCampaignNameId),
                            "user_id": newObjectIdDefault(userId)
                        });
                    }
                })());
            }

            // Wait for all post insertions to complete in parallel
            await Promise.all(postInsertTasks);

            // After all posts are processed, send the response
            if (allDataResponses.length > 0 && allDataResponses.length === weekOfOPosts.length) {
                return {
                    "status": STATUS_SUCCESS,
                    "total_posts": weekOfOPosts.length,
                    'message': res.__("front.content_library.social_post_generated_successfully"),
                };
            } else {
                return {
                    'status': STATUS_ERROR,
                    "total_posts": weekOfOPosts.length,
                    'message': res.__("front.system.something_going_wrong_please_try_again"),
                };
            }
        } else {
            return {
                'status': STATUS_ERROR,
                "total_posts": weekOfOPosts.length,
                'message': res.__("front.system.something_going_wrong_please_try_again"),
            };
        }
    } catch (error) {
        // Catch-all error handler
        return {
            'status': STATUS_ERROR,
            "total_posts": 0,
            'message': res.__("front.system.something_going_wrong_please_try_again"),
        };
    }
}; // end generateOnboardingSocialPostAndSchedule

/**
 * Function to update default user flag for multiple accounts.
 * Uses async/await for all DB queries and ensures clean, fast execution.
 * @param {string} userEmail
 * @returns {Promise<boolean>}
 */
updateDefaultUserFlagForMultipleAccount = async (userEmail) => {
    if (!userEmail) return true;

    const users = db.collection(TABLE_USERS);
    const email = userEmail.toLowerCase();

    // Build condition for users with the same email and account type
    const condition = {
        email: { $regex: "^" + email + "$", $options: "i" },
        account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE
    };

    try {
        // Count users with the same email and account type
        const userCount = await users.countDocuments(condition);

        // If more than one user found, update tooltips flags for all in parallel
        if (userCount > 1) {
            await users.updateMany(condition, {
                $set: {
                    tools_tips_educator_after_login: true,
                    tools_tips_educator_terms_and_conditions_fb: true,
                    tool_tips_educator_data_vault: true,
                    tooltips_video: true,
                }
            });
        }

        return true;
    } catch (error) {
        // Log error for debugging if needed
        // console.error("Error updating default user flags:", error);
        return false;
    }
};

/**
 * Function to increase signup attempts for a user.
 * Uses async/await for all DB queries and ensures clean, fast execution.
 * All queries are run sequentially as only one user is updated.
 * @param {string} email - The email address to check for existing accounts.
 * @param {string} userId - The user ID to update.
 * @returns {Promise<void>}
 */
increaseSignupAttempts = async (email, userId) => {
    try {
        const users = db.collection(TABLE_USERS);

        // Step 1: Count how many accounts exist with this email (case-insensitive)
        const countPromise = users.countDocuments({
            email: { $regex: "^" + email + "$", $options: "i" }
        });

        // Step 2: Prepare update for the specific user
        const updatePromise = countPromise.then(count =>
            users.updateOne(
                { _id: newObjectIdDefault(userId) },
                { $set: { signup_attempts: count } }
            )
        );

        // Run both steps in sequence for data consistency
        await updatePromise;

        return;
    } catch (error) {
        // Log error for debugging if needed
        // console.error("Error updating signup attempts:", error);
        return;
    }
};


/** remove query param url */
const removeQueryParams = (url) => url.split('?')[0];

/***format instagram url */
formatInstagramUrl = (instagramUrl) => {

    instagramUrl = removeQueryParams(instagramUrl);

    if (!instagramUrl) return ""; // Empty check

    /**Trim whitespace and leading @ or trailing**/
    instagramUrl = instagramUrl.trim().replace(/^@/, "").replace(/\/$/, "");

    /**If it's already a full URL with http or https, return as is*/
    if (instagramUrl.startsWith("http://") || instagramUrl.startsWith("https://")) {
        return instagramUrl;
    }

    /**If it starts with instagram.com, just prepend https://*/
    if (instagramUrl.startsWith("instagram.com")) {
        return `https://www.${instagramUrl}`;
    }

    /**Otherwise, assume it's a username*/
    return `https://www.instagram.com/${instagramUrl}`;
}


/**function is used to conver doc to pdf */
convertDocToPDF = async (inputPath, outputDir) => {
    return new Promise((resolve, reject) => {
        const command = `libreoffice --headless --convert-to pdf "${inputPath}" --outdir "${outputDir}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) return reject(`Conversion failed: ${stderr}`);
            const pdfFileName = path.basename(inputPath).replace(/\.[^/.]+$/, ".pdf");
            resolve(path.join(outputDir, pdfFileName));
        });
    });
};

/**
 * Extract unique Instagram usernames(handle) from comma-separated input.
 * Ensures only one '@' is prefixed and duplicates are removed.
 *
 * @param {string} input - Comma-separated input string with URLs or usernames
 * @returns {string} - Comma-separated string of unique @usernames
 */
extractUniqueInstagramHandle = (input) => {
    if (!input) return "";
    const rawItems = input.split(',');
    const usernamesSet = new Set();

    rawItems.forEach(item => {
        let cleaned = item.trim();
        // Get last part after last slash
        const parts = cleaned.split('/');
        const filtered = parts.filter(p => p.trim() !== '');
        let username = filtered[filtered.length - 1] || "";
        // Remove ALL leading @ symbols (e.g., @@@test2 => test2)
        username = username.replace(/^@+/, '').trim();
        if (username) {
            usernamesSet.add(`@${username}`); // Always add single @
        }
    });
    return Array.from(usernamesSet).join(', ');
}

/**
 * Function to generate Instagram data using Apify and process posts.
 * Uses async/await for all API and DB operations.
 * Handles parallel media downloads for faster response times.
 */
scrapApifyData = async (req, res, userOptions) => {
    let uniqueBrowserId = userOptions.unique_browser_id || "";
    let instagramUrl = userOptions.instagram_url || "";
    let websiteUrl = userOptions.website_url || "";
    let userId = userOptions.user_id ? newObjectIdDefault(userOptions.user_id) : "";
    const apifyToken = APIFY_TOKEN;
    let businessData = userOptions.businessInfo || {};

    // Extract username from Instagram URL
    const username = instagramUrl.replace("https://www.instagram.com/", "").replace("/", "");

    if (!instagramUrl) {
        return {
            status: STATUS_ERROR,
            apify_instagram_data: {},
            all_instagram_posts_from_apify: [],
        };
    }

    try {
        // 1. Get user Instagram biography/profile from Apify
        const profileOptions = {
            method: 'POST',
            url: `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username] })
        };

        let profile = await makeInstagramRequest(profileOptions);
        let instagramProfileDetails = profile[0] || "";

        if (instagramProfileDetails && instagramProfileDetails.error) {
            // Return error if Apify returned an error
            return {
                status: STATUS_ERROR,
                apify_instagram_data: {},
                all_instagram_posts_from_apify: [],
            };
        }

        let formattedPosts = [];
        let top3Posts = [];
        let mediaUrls = [];

        // 2. Process posts if available
        if (Array.isArray(instagramProfileDetails.latestPosts) && instagramProfileDetails.latestPosts.length > 0) {
            // Filter only images and videos
            const filteredPosts = instagramProfileDetails.latestPosts.filter(
                post => post.type === "Image" || post.type === "Video"
            );

            // Collect all media URLs for later upload
            mediaUrls = filteredPosts.map(record => record.videoUrl || record.displayUrl || "");

            // Download all media in parallel and format posts
            formattedPosts = await Promise.all(filteredPosts.map(async (post) => {
                let mediaUrl = "";

                if (post.type === "Image") {
                    let optionsImage = {
                        url: post.displayUrl,
                        dest: INSTAGRAM_CRAWL_IMAGES_FILE_PATH,
                    };
                    // Download image and get file name
                    let imageResponse = await downloadImageToUrl(res, req, optionsImage);
                    mediaUrl = (imageResponse.status === STATUS_SUCCESS && imageResponse.fileName) ? imageResponse.fileName : "";
                }

                if (post.type === "Video") {
                    let optionsVideo = {
                        url: post.videoUrl,
                        dest: INSTAGRAM_CRAWL_IMAGES_FILE_PATH,
                    };
                    // Download video and get file name
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

            // 3. Get top 3 posts by engagement
            top3Posts = [...formattedPosts]
                .sort((a, b) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count))
                .slice(0, 3);
        }

        // 4. Prepare user details object
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

        let socialMediaAnalysis = {};

        // 5. Generate social media analysis using Gemini or fallback AI
        if (GEMINI_SERVER_ENABLE === true) {
            let instagramData = {
                user_details: userDetails,
                posts: formattedPosts,
            };
            instagramData = objectToMarkdown(instagramData);

            // Generate Gemini response data
            let geminiData = await generateDataVaultDetails(
                null,
                null,
                { type: "instagram_url", instagram_data: instagramData }
            );
            let responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
            socialMediaAnalysis = responseDataVault || {};
        } else {
            let instagramOptions = {
                instagram_details: {
                    posts: formattedPosts,
                    user_details: userDetails
                },
                user_prompt: CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
                system_prompt: AFTER_LOGIN_CRAWL_INSTAGRAM_SYSTEM_PROMPT
            };

            // Generate social media presence data using fallback AI
            let aiData = await generateSocialMediaPresence(req, res, instagramOptions);
            let finalResponseData = aiData?.response || {};
            socialMediaAnalysis = finalResponseData?.socialMediaAnalysis || {};
        }

        // 6. Add top posts and business info to social media analysis
        if (top3Posts.length > 0) {
            socialMediaAnalysis['topPosts'] = top3Posts;
        }
        if (Object.keys(businessData).length > 0) {
            socialMediaAnalysis['businessInfo'] = businessData;
        }

        // 7. If analysis is available, upload media in background and return result
        if (Object.keys(socialMediaAnalysis).length > 0) {
            // Upload media in background (non-blocking)
            setImmediate(async () => {
                await instagramImageUploadOnUgcGallery(req, res, {
                    user_id: userId,
                    website_url: websiteUrl,
                    unique_browser_id: uniqueBrowserId,
                    media_urls: mediaUrls
                });
            });

            return {
                status: STATUS_SUCCESS,
                apify_instagram_data: socialMediaAnalysis,
                all_instagram_posts_from_apify: formattedPosts,
            };
        } else {
            return {
                status: STATUS_ERROR,
                apify_instagram_data: {},
                all_instagram_posts_from_apify: [],
            };
        }
    } catch (error) {
        console.log(error);
        return {
            status: STATUS_ERROR,
            apify_instagram_data: {},
            all_instagram_posts_from_apify: [],
        };
    }
}; // End scrapApifyData


/**
 * Function is used to update data vault details.
 * Uses async/await for all DB queries and runs independent queries in parallel for faster response times.
 */
updateDataVault = async (req, res, options) => {
    try {
        const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
        const web_links = db.collection(TABLE_WEB_LINKS);
        const users = db.collection(TABLE_USERS);

        const uniqueBrowserId = options.unique_browser_id || "";
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";

        // 1. Find Data Vault for the user
        const dataVault = await web_ai_info.findOne(
            { user_id: userId },
            { projection: { _id: 1, web_id: 1, website_url: 1, instagram_url: 1, data: 1, apify_instagram_data: 1 } }
        );

        const websiteUrl = dataVault?.website_url || "";
        const webId = dataVault?.web_id ? newObjectIdDefault(dataVault.web_id) : "";
        const instagramUrl = dataVault?.instagram_url || "";
        const dataVaultData = dataVault?.data || {};
        const apifyData = dataVault?.apify_instagram_data || {};

        let updateData = {};
        let userOptions = {};

        // 2. Crawl website if website URL exists and data vault is empty
        if (websiteUrl && !Object.keys(dataVaultData).length) {
            const businessInfo = apifyData?.businessInfo || {};
            const webInfoData = await crawlWebsiteUrlWhileInstagramLogin(req, res, {
                unique_ai_browser_id: uniqueBrowserId,
                website_url: websiteUrl,
                businessInfo: businessInfo
            });

            if (webInfoData.status === STATUS_SUCCESS && webInfoData.web_info_data) {
                const webSiteScrapData = webInfoData.web_info_data;
                updateData['data'] = webSiteScrapData;
                userOptions['public_business_informaton.website_url'] = websiteUrl;
                const childLinksArray = webInfoData.child_links || [];

                // Update web_links with child links if available
                if (childLinksArray.length > 0) {
                    await web_links.updateOne(
                        { _id: webId, user_id: userId },
                        { $set: { link: websiteUrl, child_links: childLinksArray } }
                    );
                }

                // Prepare bucket data and save in background (non-blocking)
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
                // Save data to bucket asynchronously
                saveCustomerBucketItems({
                    user_id: userId,
                    bucket_name: DATA_BUCKET_ABOUT_BUSINESS,
                    parent_bucket: PARENT_BUCKET_ABOUT_BUSINESS,
                    data: bucketData
                });
            }
        }

        // 3. Crawl Instagram details if Instagram URL exists and apify data is empty
        if (instagramUrl && !Object.keys(apifyData).length) {
            const businessInfo = dataVaultData?.businessInfo || {};
            const apifyResponseData = await scrapApifyData(
                null,
                null,
                {
                    user_id: userId,
                    website_url: websiteUrl,
                    unique_browser_id: uniqueBrowserId,
                    instagram_url: instagramUrl,
                    businessInfo: businessInfo
                }
            );

            if (apifyResponseData?.status === STATUS_SUCCESS && apifyResponseData?.apify_instagram_data) {
                const apifyInstagramData = apifyResponseData.apify_instagram_data || {};
                const allInstagramPostsFromApify = apifyResponseData.all_instagram_posts_from_apify || [];
                updateData['apify_instagram_data'] = apifyInstagramData;
                updateData['all_instagram_posts_from_apify'] = allInstagramPostsFromApify;
                userOptions['instagram_url'] = instagramUrl;

                // Prepare complete Apify data and save in background (non-blocking)
                const completeApifyData = {
                    business_info: apifyInstagramData?.businessInfo || {},
                    audience_engagement: apifyInstagramData?.audienceEngagement || {},
                    posting_habits: apifyInstagramData?.postingHabits || {},
                    writing_style: apifyInstagramData?.writingStyle || {},
                    visual_content: apifyInstagramData?.visualContent || {},
                    recommendations: apifyInstagramData?.recommendations || {},
                    top_posts: apifyInstagramData?.topPosts || [],
                    all_posts: allInstagramPostsFromApify.length > 0 ? allInstagramPostsFromApify : []
                };
                // Save data to bucket asynchronously
                saveCustomerBucketItems({
                    user_id: userId,
                    bucket_name: DATA_BUCKET_APIFY_DATA,
                    parent_bucket: PARENT_BUCKET_APIFY_DATA,
                    data: completeApifyData
                });
            }
        }

        // 4. Update main data vault and user profile in parallel if there is something to update
        const updateTasks = [];

        if (Object.keys(updateData).length > 0) {
            // Update main data vault
            updateTasks.push(
                web_ai_info.updateOne({ user_id: userId }, { $set: updateData })
            );
        }

        if (Object.keys(userOptions).length > 0) {
            // Update user profile info
            updateTasks.push(
                users.updateOne({ _id: userId }, { $set: userOptions })
            );
        }

        // Run DB updates in parallel for faster response times
        if (updateTasks.length > 0) {
            await Promise.all(updateTasks);
        }

        // 5. If website data was updated, crawl all pages in background (non-blocking)
        if (updateData.data) {
            crawlAllPagesSequentially({ web_id: webId });
        }

    } catch (error) {
        // Log error for debugging if needed
        // console.log(error);
    }
}

/** Funtion for used to Generate group user social post */
generateGroupUserSocialPost = async (req, res, options) => {
    try {
        let imageUrls = options.image_urls || [];
        let pdfUrl = options.pdf_url || [];
        let videoUrls = options.video_urls || [];
        let multipleUserGroupId = options.group_id || "";
        let topic = options.topic || "";
        let uploadSocialImages = options.social_post_images || [];
        let uploadFacebookImages = options.social_post_facebook_images || [];
        let groupRefKey = options.group_ref_key || "";

        let campaignName = "Default Campaign";

        const webAiInfo = db.collection(TABLE_WEB_AI_INFO);
        const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
        const multipleUserGroup = db.collection(TABLE_MULTIPLE_USER_GROUPS);
        const users = db.collection(TABLE_USERS);

        if (!multipleUserGroupId) {
            return false;
        }

        let multipleUserIds = await multipleUserGroup.findOne({ _id: newObjectIdDefault(multipleUserGroupId) }, { projection: { 'slug': 1, 'user_id': 1, 'group_user_ids': 1 } });

        const groupUserIds = multipleUserIds?.group_user_ids || [];
        const groupUserSlug = multipleUserIds?.slug || "";
        const ownerGroupUserId = multipleUserIds?.user_id || "";

        await Promise.allSettled(
            groupUserIds.map(async (userIdStr) => {
                try {
                    const [instagramImageArray, facebookImageArray] = await Promise.all([
                        downloadAndFlatten(req, res, uploadSocialImages, 'instagram', AI_RESPONSE_TYPE_SOCIAL_MEDIA, null),
                        downloadAndFlatten(req, res, uploadFacebookImages, 'facebook', AI_RESPONSE_TYPE_SOCIAL_MEDIA, null)
                    ]);

                    const userId = newObjectIdDefault(userIdStr);
                    /**Fetch data in parallel*/
                    const [previousResult, businessInfo, userData] = await Promise.all([
                        /**get previous posts */
                        tableAiCampaignChat.find({
                            'user_id': userId,
                            'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                            'signup_flag': false
                        }, {
                            projection: { '_id': 0, 'content.title': 1, 'content.captions': 1 }
                        }).sort({ 'created': SORT_DESC }).limit(10).toArray(),
                        /**find data vault */
                        webAiInfo.findOne({ 'user_id': userId }, {
                            projection: { 'data': 1, 'apify_instagram_data': 1 }
                        }),
                        /**find user details */
                        users.findOne({ '_id': userId })
                    ]);

                    /**keys for auto schedule posts */
                    let instagramLongLivedAccessToken = userData?.long_lived_access_token || "";
                    let instagramUrl = userData?.instagram_url || "";
                    let autoSchedule = userData.auto_schedule || "";

                    /**Format previous captions*/
                    const captionsAndTitles = previousResult.map((item, i) =>
                        `${i + 1}. title: ${item.content.title}\ncaption: ${item.content.captions}`
                    ).join('\n\n');

                    /**Merge apify data*/
                    let aiInfo = businessInfo?.data || {};
                    const apifyData = businessInfo?.apify_instagram_data || {};
                    if (Object.keys(apifyData).length > 0) {
                        delete apifyData.topPosts;
                        aiInfo = { ...aiInfo, ...apifyData };
                    }

                    /**Fallback business info*/
                    if (!Object.keys(aiInfo).length && userData?.public_business_informaton) {
                        const pbi = userData.public_business_informaton;
                        aiInfo = {
                            businessName: pbi.name_of_the_business || "",
                            keyProducts: pbi.specific_product_or_service || ""
                        };
                    }

                    /**Convert info to markdown*/
                    const businessMarkdown = objectToMarkdown(aiInfo);
                    const lastUsedPrompt = userData?.last_used_prompt || LEFT_HEMISPHERE_PROMPT;

                    const hasMedia = (imageUrls.length > 0 || videoUrls.length > 0 || pdfUrl);

                    let userPrompt = "";
                    let temperature = "";
                    if (lastUsedPrompt == LEFT_HEMISPHERE_PROMPT) {
                        userPrompt = (hasMedia) ? RIGHT_BRAIN_WITH_MEDIA : RIGHT_BRAIN_NO_MEDIA;
                        temperature = (hasMedia) ? 0.7 : 0.7;
                    } else if (lastUsedPrompt == RIGHT_HEMISPHERE_PROMPT) {
                        userPrompt = (hasMedia) ? LEFT_BRAIN_WITH_MEDIA : LEFT_BRAIN_NO_MEDIA;
                        temperature = (hasMedia) ? 0.7 : 0.2;
                    }

                    const finalPrompt = userPrompt.replace(/{DATA_VAULT}/g, businessMarkdown).replace(/{TOPIC}/g, topic).replace(/{LAST_10_CAPTIONS}/g, captionsAndTitles);

                    /**Build AI generation options*/
                    let aiOptions = {
                        "prompt": finalPrompt,
                        'image_urls': (imageUrls.length > 0 && LIVE_SERVER_UPLOAD === true) ? imageUrls : [],
                        'video_urls': (videoUrls.length > 0 && LIVE_SERVER_UPLOAD === true) ? videoUrls : [],
                        'pdf_url': (pdfUrl && LIVE_SERVER_UPLOAD === true) ? pdfUrl : "",
                        'temperature': temperature
                    }

                    const generatedCaption = await getCaptionWithOrWithoutMedia(req, res, aiOptions);
                    const response = generatedCaption?.status === STATUS_SUCCESS ? generatedCaption.response : null;

                    if (!response?.title || !response?.caption) return;

                    /**Get slug for this user*/
                    const slugResponse = await getDatabaseSlug({
                        'title': campaignName,
                        'table_name': TABLE_AI_CAMPAIGN_NAME,
                        'slug_field': "slug"
                    });

                    /**Insert campaign*/
                    const campaignInsert = await tableAiCampaignName.insertOne({
                        'user_id': userId,
                        'slug': slugResponse?.title || "",
                        'ai_campaign_name': campaignName,
                        'ai_campaign_created_name': "",
                        'type': DEFAULT_CAMPAIGN,
                        'is_deleted': NOT_DELETED,
                        'signup_flag': false,
                        'first_content_campaign': false,
                        'social_role_type': SOCIAL_POST_GENERATE_TYPE,
                        'group_id': newObjectIdDefault(multipleUserGroupId),
                        'group_slug': groupUserSlug,
                        'owner_group_user_id': ownerGroupUserId,
                        'group_ref_key': groupRefKey,
                        'created': getUtcDate()
                    });

                    /** Insert AI response*/
                    let campaignChat = await tableAiCampaignChat.insertOne({
                        'user_id': userId,
                        'ai_campaign_parent_id': campaignInsert.insertedId,
                        'role': AI_ROLE_ASSISTANT,
                        'topic': topic,
                        'content': {
                            'title': response.title,
                            'captions': response.caption + "\n" + (response.hashtags || ""),
                            'hashtags': response.hashtags || "",
                            'image': instagramImageArray || [],
                            'facebook_image': facebookImageArray || [],
                        },
                        'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
                        'is_viewed': false,
                        'signup_flag': false,
                        'unique_key': generateRandomID(8),
                        'first_ai_poll_generated': false,
                        'first_content_campaign': false,
                        'is_draft': CAMPAIGN_DRAFT,
                        'is_deleted': NOT_DELETED,
                        'social_role_type': SOCIAL_POST_GENERATE_TYPE,
                        'group_id': newObjectIdDefault(multipleUserGroupId),
                        'group_slug': groupUserSlug,
                        'group_ref_key': groupRefKey,
                        'owner_group_user_id': ownerGroupUserId,
                        'created': getUtcDate()
                    });


                    /**update user last prompt used */
                    let updateLastUsedPrompt = (lastUsedPrompt === LEFT_HEMISPHERE_PROMPT) ? RIGHT_HEMISPHERE_PROMPT : LEFT_HEMISPHERE_PROMPT;
                    await users.updateOne({ _id: newObjectIdDefault(userId) }, { $set: { 'last_used_prompt': updateLastUsedPrompt } });

                    /**condition for auto schedule campaign */
                    if (autoSchedule && (instagramUrl || instagramLongLivedAccessToken)) {
                        let optionsData = {
                            'login_user_data': userData,
                            "ai_campaign_chat_id": campaignChat.insertedId,
                        }
                        await autoSchedulePosts(req, res, optionsData);
                    }
                } catch (err) {
                    console.error("Error for user:", userIdStr, err);
                }
            })
        );
    } catch (error) {
        //console.log("Error in generateGroupUserSocialPost:", error);
        return false;
    }
};


/** Funtion for used to Generate group user social post */
generateGroupUserSocialStory = async (req, res, options) => {
    try {
        let multipleUserGroupId = options.group_id || "";
        let title = options.title || "";
        let caption = options.caption || "";
        let uploadSocialImages = options.social_post_images || [];
        let uploadFacebookImages = options.facebook_images || [];
        let groupRefKey = options.group_ref_key || "";
        let socialType = (options.type) ? options.type : AI_RESPONSE_TYPE_SOCIAL_MEDIA;
        let isManually = (options.is_manually) ? options.is_manually : false;
        let aiSocialImage = (options.image) ? options.image : "";

        let campaignName = (socialType == AI_RESPONSE_TYPE_SOCIAL_MEDIA) ? "Social Post" : "Social Story";

        const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
        const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
        const multipleUserGroup = db.collection(TABLE_MULTIPLE_USER_GROUPS);
        const users = db.collection(TABLE_USERS);

        if (!multipleUserGroupId) {
            return false;
        }

        let multipleUserIds = await multipleUserGroup.findOne({ _id: newObjectIdDefault(multipleUserGroupId) }, { projection: { 'slug': 1, 'user_id': 1, 'group_user_ids': 1 } });

        const groupUserIds = multipleUserIds?.group_user_ids || [];
        const groupUserSlug = multipleUserIds?.slug || "";
        const ownerGroupUserId = multipleUserIds?.user_id || "";

        await Promise.allSettled(
            groupUserIds.map(async (userIdStr) => {
                try {

                    const [instagramImageArray, facebookImageArray] = await Promise.all([
                        downloadAndFlatten(req, res, uploadSocialImages, 'instagram', socialType, aiSocialImage),
                        (socialType === AI_RESPONSE_TYPE_SOCIAL_MEDIA) ? downloadAndFlatten(req, res, uploadFacebookImages, 'facebook', socialType, aiSocialImage) : []
                    ]);

                    const userId = newObjectIdDefault(userIdStr);

                    /**find user details */
                    let userData = await users.findOne({ '_id': userId });

                    /**keys for auto schedule posts */
                    let instagramLongLivedAccessToken = userData?.long_lived_access_token || "";
                    let instagramUrl = userData?.instagram_url || "";
                    let autoSchedule = userData.auto_schedule || "";

                    /**Get slug for this user*/
                    const slugResponse = await getDatabaseSlug({
                        'title': campaignName,
                        'table_name': TABLE_AI_CAMPAIGN_NAME,
                        'slug_field': "slug"
                    });

                    /**Insert campaign*/
                    const campaignInsert = await tableAiCampaignName.insertOne({
                        'user_id': userId,
                        'slug': slugResponse?.title || "",
                        'ai_campaign_name': campaignName,
                        'ai_campaign_created_name': "",
                        'type': DEFAULT_CAMPAIGN,
                        'is_deleted': NOT_DELETED,
                        'signup_flag': false,
                        'is_manually': isManually,
                        'first_content_campaign': false,
                        'create_based_type': socialType,
                        'social_role_type': SOCIAL_POST_GENERATE_TYPE,
                        'group_id': newObjectIdDefault(multipleUserGroupId),
                        'group_slug': groupUserSlug,
                        'owner_group_user_id': ownerGroupUserId,
                        'group_ref_key': groupRefKey,
                        'created': getUtcDate()
                    });

                    /** Insert AI response*/
                    let campaignChat = await tableAiCampaignChat.insertOne({
                        'user_id': userId,
                        'ai_campaign_parent_id': campaignInsert.insertedId,
                        'role': AI_ROLE_ASSISTANT,
                        'content': {
                            'title': title,
                            'captions': caption,
                            'hashtags': "",
                            'image': instagramImageArray || [],
                            'facebook_image': facebookImageArray || [],
                        },
                        'type': socialType,
                        'is_viewed': false,
                        'signup_flag': false,
                        'unique_key': generateRandomID(8),
                        'first_ai_poll_generated': false,
                        'first_content_campaign': false,
                        'is_draft': CAMPAIGN_DRAFT,
                        'is_deleted': NOT_DELETED,
                        'social_role_type': SOCIAL_POST_GENERATE_TYPE,
                        'group_id': newObjectIdDefault(multipleUserGroupId),
                        'group_slug': groupUserSlug,
                        'group_ref_key': groupRefKey,
                        'owner_group_user_id': ownerGroupUserId,
                        'created': getUtcDate()
                    });


                    /**condition for auto schedule campaign */
                    if (autoSchedule && (instagramUrl || instagramLongLivedAccessToken)) {

                        let optionsData = {
                            'login_user_data': userData,
                            "ai_campaign_chat_id": campaignChat.insertedId,
                        }
                        await autoSchedulePosts(req, res, optionsData);
                    }
                } catch (err) {
                    console.log("Error for user:", userIdStr, err);
                }
            })
        );
    } catch (error) {
        console.log("error", error)
        return false;
    }
};


/**
 * Downloads and processes media uploads for a platform (Instagram/Facebook),
 * runs all in parallel, and flattens the results.
 */
downloadAndFlatten = async (req, res, uploads, platform, socialType, aiSocialImage) => {
    if (!uploads?.length || LIVE_SERVER_UPLOAD !== true) return [];

    /**Filter out invalid entries and prepare download promises*/
    const downloads = uploads.filter(img => img?.name && img?.extension).map(img => processInstagramDownload(res, req, img.name, img.extension, platform, socialType, aiSocialImage));

    /**Wait for all downloads and flatten the results into a single array*/
    return (await Promise.all(downloads)).flat();
};

/**
 * Process Instagram or Facebook media download and conversion.
 * Handles both video and image files, using async/await for all async operations.
 * Ensures all DB or file operations are awaited for clean, fast execution.
 */
processInstagramDownload = async (res, req, inputImageName, fileExtension, platform, socialType, aiSocialImage) => {
    // Compose the full image URL
    const instagramImageUrl = AI_SOCIAL_IMAGES_URL + inputImageName;

    // Determine platform flags for DB record
    const isInstagram = platform === 'instagram';
    const platformKeyFlag = isInstagram ? { post_on_instagram: true } : { post_on_facebook: true };
    const imageSizeKey = isInstagram ? 'instagram_image_size' : 'facebook_image_size';

    // Array to store processed image/video details
    let uploadUgcImages = [];

    // Check if the file is a supported video type
    if (ALLOWED_VIDEO_EXTENSIONS.includes(fileExtension) && inputImageName) {
        let videoFileName = inputImageName;

        // Generate a random number for filename uniqueness
        const randomNumber = Math.floor(10 + Math.random() * 90);
        let updatedFilePath = "";

        // Append random number before extension to avoid conflicts
        if (fileExtension === 'mp4') {
            updatedFilePath = videoFileName.replace(/\.mp4$/, `-${randomNumber}.mp4`);
        } else if (fileExtension === 'mov') {
            updatedFilePath = videoFileName.replace(/\.mov$/, `-${randomNumber}.mov`);
        }

        // Convert video for Instagram using ffmpeg (async, but not awaited here for speed)
        // If you want to ensure conversion is complete before proceeding, add await
        await convertVideoToFFmpegForInstagram({
            videoURL: UPLOAD_TO_S3 ? AI_SOCIAL_IMAGES_URL + videoFileName : AI_SOCIAL_IMAGES_FILE_PATH + videoFileName,
            outputPath: AI_SOCIAL_IMAGES_FILE_PATH + updatedFilePath,
            targetFolder: 'ai_social_images/' + updatedFilePath
        });

        // Add processed video to upload list if conversion succeeded
        if (updatedFilePath && fileExtension) {
            uploadUgcImages.push({
                _id: newObjectIdDefault(),
                name: updatedFilePath,
                extension: fileExtension,
                ...platformKeyFlag
            });
        }
    } else {
        // For image files (not video)
        const optionsInstagram = {
            url: instagramImageUrl,
            dest: AI_SOCIAL_IMAGES_FILE_PATH,
            ...(socialType === AI_RESPONSE_TYPE_SOCIAL_MEDIA && (platform === 'instagram' || platform === 'facebook') ? { [imageSizeKey]: true } : {})
        };

        // Download and store image from URL (awaited for sequential consistency)
        const imageResponse = await downloadImageToUrl(res, req, optionsInstagram);
        const imageUrlName = imageResponse?.fileName || "";
        const imageExtension = imageResponse?.imageExtension || "";

        if (imageUrlName && imageExtension) {
            // If this is a social story, resize the image (awaited for sequential consistency)
            if (socialType === AI_RESPONSE_TYPE_SOCIAL_STORY && aiSocialImage) {
                const optiondata = {
                    image: aiSocialImage,
                    image_name: imageUrlName,
                    type: AI_RESPONSE_TYPE_SOCIAL_STORY
                };
                await resizeImageForSocialPostImage(req, res, optiondata);
            }

            // Add processed image to upload list
            uploadUgcImages.push({
                _id: newObjectIdDefault(),
                name: imageUrlName,
                extension: imageExtension,
                ...platformKeyFlag
            });
        }
    }

    // Return the array of uploaded items
    return uploadUgcImages;
};

/**
 * Function to add a sub-user for an enterprise user.
 * Handles both cases:
 *   1. If the email already exists as a registered user → assign as sub-user.
 *   2. If the email does not exist → send signup invitation.
 * All DB queries use async/await for clean, fast execution.
 */
addEnterpriseMultipleAddUser = async (req, res, options) => {
    try {
        // Extract and format input parameters
        const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
        const email = options.email ? options.email : "";

        const users = db.collection(TABLE_USERS);

        // Check if required fields are missing
        if (!userId || !email) {
            return false;
        }

        // Check if the email already belongs to an existing registered user (awaited for sequential consistency)
        const userDetails = await users.findOne({
            email: { $regex: '^' + email + '$', $options: 'i' }
        });

        if (userDetails) {
            // If user exists, prepare details for assignment and assign as sub-user
            const assignedUserId = userDetails._id ? userDetails._id : "";

            // Insert a record in multipleUserAssign for the sub-user relationship (awaited for sequential consistency)
            await dynamicAssignMultipleAccount(req, res, userId, assignedUserId);
        } else {
            // If user does not exist, send signup invitation email (non-blocking for faster response)
            const signupUrl = FRONT_URL + "pocial/signup";
            const emailOptions = {
                to: email,
                action: "signup_enterprise_basic_user",
                rep_array: [DEAR_HI_CONSTANT, signupUrl, email]
            };
            // Send email in background for non-blocking execution
            setImmediate(() => {
                sendMail(req, res, emailOptions);
            });
        }

        return true;
    } catch (err) {
        // Handle any unexpected errors gracefully
        // Optionally log error: console.error("Error in addEnterpriseMultipleAddUser:", err);
        return false;
    }
};

/**
 * Upload a single UGC (User Generated Content) image, validate it, move it to gallery, generate a slug, and insert record in UGC gallery collection.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response objectId with the image
 * @returns {Object} - Status object with success or error message
 */
uploadSingleUGCImage = async (req, res, imageData, userId, description, instagramIdLink) => {
    try {
        /**Extract mime type (example: "image/png" or "image/jpeg")*/
        let mimeType = (imageData.mimetype) ? imageData.mimetype : "";
        const ugcGallery = db.collection(TABLE_UGC_GALLERY);

        /**Upload options for file validation and processing*/
        let options = {
            'image': imageData,
            'ai_social_image_submit': true,
            'filePath': UGC_GALLERY_FILE_PATH,
            'allowedExtensions': ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
            'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
            'allowedMimeTypes': ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
            'allowedMimeError': ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
            'allowedSizeErrorMessage': ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
            'size': MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
        };

        /** Step 1: Upload image in UGC gallery (move file to destination) */
        let galleryResponse = await moveUploadedFile(req, res, options);

        /**If upload fails, throw error and stop execution*/
        if (galleryResponse.status == STATUS_ERROR) {
            throw new Error(galleryResponse.message || "Failed to upload image");
        }

        /**Uploaded image name and extension*/
        let imageName = galleryResponse.fileName || "";
        let imageExtension = galleryResponse.image_extension || "";

        /** Step 2: Generate unique slug based on description */
        let slugResponse = await getDatabaseSlug({
            "title": description,
            "table_name": TABLE_UGC_GALLERY,
            "slug_field": "slug"
        });

        /** Step 3: Insert new UGC gallery record into MongoDB */
        await ugcGallery.insertOne({
            'user_id': userId,
            'description': description || "",
            'upload_file': imageName,
            'mime_type': mimeType,
            'extension': imageExtension,
            'instagram_id_link': instagramIdLink || "",
            'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
            'created': getUtcDate()
        });
    } catch (error) {
        /**Error response if anything goes wrong*/
        return false;
    }
}