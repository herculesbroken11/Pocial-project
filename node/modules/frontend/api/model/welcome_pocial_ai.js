const async = require('async');
const OpenAI = require("openai");
const openai = new OpenAI({
    apiKey: process.env.OPEN_AI // apna key yaha rakho
});
const welcomeAiCollection = db.collection(TABLE_WELCOME_AI_COMMUNICATION_LOGS);


function WelcomePocialAi() {


    /**
     * Function used to get welcome pocial ai data using async/await for faster and cleaner response.
     * All DB and async queries are awaited. If any queries can be run in parallel, use Promise.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getWelcomePocialAiData = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let loginUserData = req.user_data ? req.user_data : "";

        let userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        let userName = loginUserData.slug ? loginUserData.slug : "";
        let userEmail = loginUserData.email ? loginUserData.email : "";
        let fullName = loginUserData.full_name ? loginUserData.full_name : "";
        let ipAddr = req.body.ip ? req.body.ip : "";
        let userContent = req.body.user_content ? req.body.user_content : "";
        let uniqueSessionId = req.body.unique_session_id ? req.body.unique_session_id : "";
        let previousChat = req.body.previous_chat ? req.body.previous_chat : [];
        let finalResponse = {};

        if (userContent === '') {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.please_enter_user_content"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Prepare system and user prompts
            const systemPromptContent = res.locals.settings["Prompt.New_master_prompt_for_welcome_to_ai_screen"];
            const systemPrompt = {
                role: "system",
                content: systemPromptContent
            };
            const userPrompt = {
                role: AI_ROLE_USER,
                content: userContent,
            };

            let allChat = [];

            // Clean up previous chat and prepare chat history
            if (previousChat && previousChat.length > 1) {
                previousChat = previousChat.map(obj => {
                    const { isBlinking, ...rest } = obj;
                    return rest;
                });

                for (let i = 0; i < previousChat.length; i++) {
                    if (previousChat[i].role === 'assistant' && previousChat[i].content.includes('<a target="_blank" href="https://app.pocial.com/pocial/signup?state=from-welcome-to-ai-signup">Click Here</a>')) {
                        // Replace the HTML link with plain text "click here"
                        previousChat[i].content = previousChat[i].content.replace(
                            '<a target="_blank" href="https://app.pocial.com/pocial/signup?state=from-welcome-to-ai-signup">Click Here</a>',
                            'click here'
                        );
                        break;
                    }
                }

                previousChat.unshift(systemPrompt);
                allChat = previousChat;
            } else {
                allChat = [systemPrompt, userPrompt];
            }

            // Call OpenAI API (awaited)
            const result = await openai.createChatCompletion({
                model: "gpt-3.5-turbo",
                messages: allChat,
            });

            let response = result.data.choices[0].message.content;
            let arrayResponse = response;

            // Post-process the AI response
            const regex = /\bclick(?:ing)?(?:\s+here)?\b/gi;
            arrayResponse = arrayResponse.replace(/\[.*?\]/g, '');
            arrayResponse = arrayResponse.replace(/\(|\)/g, '');
            arrayResponse = arrayResponse.replace(regex, '<a target="_blank" href="https://app.pocial.com/pocial/signup?state=from-welcome-to-ai-signup">Click Here</a>');
            arrayResponse = removeUrlWithoutAnchor(arrayResponse);
            arrayResponse = removeDuplicateAnchors(arrayResponse);

            // Prepare slug options for DB
            let slugOptions = {
                title: userContent,
                table_name: TABLE_WELCOME_AI_COMMUNICATION_LOGS,
                slug_field: "slug"
            };

            // Run slug generation and DB insert in sequence (could be parallel if needed)
            const slugResponse = await getDatabaseSlug(slugOptions);

            let saveWelcomeData = {
                user_id: userId,
                slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
                user_email: userEmail,
                user_name: userName,
                full_name: fullName,
                user_question: userContent,
                ai_answer: arrayResponse,
                ip_addr: ipAddr,
                unique_session_id: uniqueSessionId,
                created: getUtcDate(),
            };

            // Insert communication log into DB (awaited)
            await welcomeAiCollection.insertOne(saveWelcomeData);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: arrayResponse,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End getWelcomePocialAiData();

    /**
     * Async function to remove duplicate anchor tags from a paragraph.
     * Uses async/await for future extensibility (e.g., if DB or external queries are needed).
     * All regex and processing is synchronous, but wrapped in async for consistency and future-proofing.
     * @param {string} paragraph - The HTML paragraph to process.
     * @returns {Promise<string>} - The processed paragraph with duplicate anchors removed.
     */
    removeDuplicateAnchors = async (paragraph) => {
        // Regular expression to find all occurrences of anchor tags
        const regex = /<a\b[^>]*>(.*?)<\/a>/g;

        // Object to track unique hrefs
        const uniqueLinks = {};

        // Replace duplicate anchor tags with empty string
        const replacedParagraph = paragraph.replace(regex, (match) => {
            const hrefMatch = match.match(/href="([^"]*)"/);
            if (hrefMatch && !uniqueLinks[hrefMatch[1]]) {
                uniqueLinks[hrefMatch[1]] = true;
                return match;
            } else {
                return "";
            }
        });

        // Return the processed paragraph
        return replacedParagraph;
    } // End removeDuplicateAnchors();

    /**
     * Async function to remove a specific URL from text if it is not inside an anchor tag.
     * Uses async/await for future extensibility (e.g., if DB or external queries are needed).
     * All processing is synchronous, but wrapped in async for consistency and future-proofing.
     * @param {string} text - The text to process.
     * @returns {Promise<string>} - The processed text with the URL removed if not inside an anchor tag.
     */
    removeUrlWithoutAnchor = async (text) => {
        // Define the URL to remove
        const urlToRemove = "https://app.pocial.com/pocial/signup?state=from-welcome-to-ai-signup";

        // Split the text by the URL
        const parts = text.split(urlToRemove);

        let result = parts[0];

        // Iterate through each part after the first
        for (let i = 1; i < parts.length; i++) {
            // Check if the part before the URL is inside an anchor tag
            const before = parts[i - 1];
            const isInAnchorTag = before.includes('<a ') && !before.includes('</a>');

            // If inside an anchor tag, keep the URL; otherwise, remove it
            if (isInAnchorTag) {
                result += urlToRemove;
            }

            // Add the part after the URL
            result += parts[i];
        }
        // Return the processed result
        return result;
    } // End removeUrlWithoutAnchor();

}
module.exports = new WelcomePocialAi();