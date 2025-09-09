const asyncParallel = require('async/parallel');

function growthAutomation() {

    /**
     * Function used to get insider email, reward, and poll listing
     * Uses async/await for all DB operations for faster and cleaner response.
     * Runs all queries in parallel using Promise.all.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getInsiderEmailPollAndReward = async (req, res) => {
        let finalResponse = {};
        // Get user id from request
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";

        // If user is not logged in, return error
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

        // Get DB collections
        const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
        const polls = db.collection(TABLE_POLLS);
        const rewards = db.collection(TABLE_REWARDS);
        const leadForms = db.collection(TABLE_LEAD_FORMS);

        let aiBotFormsId = loginUserData.ai_bot_forms_id ? newObjectIdDefault(loginUserData.ai_bot_forms_id) : "";

        try {
            // Run all queries in parallel for better performance
            const [
                emailList,
                pollList,
                rewardList,
                leadFormData
            ] = await Promise.all([
                // Get email list
                emailTemplate.find(
                    { user_id: userId, status: NOT_DRAFT_STATUS, is_deleted: NOT_DELETED },
                    { projection: { _id: 1, action: 1, template_type: 1, template_title: 1, attach_reward: 1, attach_poll: 1 } }
                ).sort({ is_active: SORT_DESC }).toArray(),

                // Get poll list
                polls.find(
                    { is_deleted: NOT_DELETED, user_id: newObjectIdDefault(userId), is_published: POLL_PUBLISHED, is_draft: POLL_NOT_DRAFTS },
                    { projection: { _id: 1, slug: 1, question: 1 } }
                ).sort({ created: SORT_DESC }).toArray(),

                // Get reward list
                rewards.find(
                    { is_deleted: NOT_DELETED, user_id: newObjectIdDefault(userId) },
                    { projection: { _id: 1, slug: 1, reward_text: 1, reward_sub_heading: 1 } }
                ).sort({ created: SORT_DESC }).toArray(),

                // Get lead form data
                aiBotFormsId
                    ? leadForms.findOne(
                        { _id: newObjectIdDefault(aiBotFormsId), user_id: newObjectIdDefault(userId) },
                        { projection: { _id: 1, assign_welcome_email_id: 1 } }
                    )
                    : null
            ]);

            // Find the email details that match the assigned welcome email ID
            let assignWelcomeEmailId = leadFormData && leadFormData.assign_welcome_email_id ? newObjectIdDefault(leadFormData.assign_welcome_email_id) : "";

            let emailDetails = Array.isArray(emailList) ? emailList.find(email => email._id.toString() === assignWelcomeEmailId.toString()) : null;

            let attachRewardSlug = "";
            let attachPollSlug = "";
            let selectedEmailAction = "";

            if (emailDetails) {
                let { action, attach_reward, attach_poll } = emailDetails;
                selectedEmailAction = action || "";

                // Run reward and poll slug queries in parallel if needed
                const [rewardDetail, pollDetail] = await Promise.all([
                    attach_reward
                        ? rewards.findOne(
                            { _id: newObjectIdDefault(attach_reward), user_id: newObjectIdDefault(userId) },
                            { projection: { slug: 1 } }
                        )
                        : null,
                    attach_poll
                        ? polls.findOne(
                            { _id: newObjectIdDefault(attach_poll), user_id: newObjectIdDefault(userId) },
                            { projection: { slug: 1 } }
                        )
                        : null
                ]);

                attachRewardSlug = rewardDetail && rewardDetail.slug ? rewardDetail.slug : "";
                attachPollSlug = pollDetail && pollDetail.slug ? pollDetail.slug : "";
            }

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: {
                        email_list: emailList || [],
                        poll_list: pollList || [],
                        reward_list: rewardList || [],
                        selected_email_action: selectedEmailAction,
                        attach_reward_slug: attachRewardSlug,
                        attach_poll_slug: attachPollSlug
                    },
                    message: ""
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Send error response if any query fails
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {
                        email_list: [],
                        poll_list: [],
                        reward_list: [],
                        selected_email_action: "",
                        attach_reward_slug: "",
                        attach_poll_slug: ""
                    },
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getInsiderEmailPollAndReward()

    /**
     * Function used to get selected reward from email and Poll
     * Uses async/await for all DB operations for faster and cleaner response.
     * If both emailAction and pollSlug are provided, queries are run in parallel.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getSelectedRewardFromEmailOrPoll = async (req, res) => {
        let finalResponse = {};
        // Get user id
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let emailAction = req.body.email_action ? req.body.email_action : "";
        let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";

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

        const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
        const polls = db.collection(TABLE_POLLS);
        const rewards = db.collection(TABLE_REWARDS);

        try {
            let attachRewardSlug = "";

            // Prepare queries for parallel execution if both are present
            let emailPromise = null;
            let pollPromise = null;

            if (emailAction) {
                // Query for email template
                emailPromise = (async () => {
                    // Find the email template by action and user
                    const emailResult = await emailTemplate.findOne(
                        { action: emailAction, user_id: userId },
                        { projection: { _id: 1, attach_reward: 1 } }
                    );
                    if (emailResult && emailResult.attach_reward) {
                        // Find the reward slug if attach_reward exists
                        const rewardDetails = await rewards.findOne(
                            { _id: newObjectIdDefault(emailResult.attach_reward), user_id: newObjectIdDefault(userId) },
                            { projection: { slug: 1 } }
                        );
                        return rewardDetails?.slug || "";
                    }
                    return "";
                })();
            }

            if (pollSlug) {
                // Query for poll
                pollPromise = (async () => {
                    // Find the poll by slug and user
                    const pollResult = await polls.findOne(
                        { slug: pollSlug, user_id: userId },
                        { projection: { _id: 1, "options.assign_reward": 1 } }
                    );
                    if (pollResult && pollResult.options && pollResult.options[0]?.assign_reward) {
                        // Find the reward slug if assign_reward exists in poll options
                        const rewardDetails = await rewards.findOne(
                            { _id: newObjectIdDefault(pollResult.options[0].assign_reward), user_id: newObjectIdDefault(userId) },
                            { projection: { slug: 1 } }
                        );
                        return rewardDetails?.slug || "";
                    }
                    return "";
                })();
            }

            // If both queries are present, run them in parallel
            if (emailPromise && pollPromise) {
                const [emailRewardSlug, pollRewardSlug] = await Promise.all([emailPromise, pollPromise]);
                // Prefer pollRewardSlug if pollSlug is provided, else emailRewardSlug
                attachRewardSlug = pollRewardSlug || emailRewardSlug || "";
            } else if (emailPromise) {
                attachRewardSlug = await emailPromise;
            } else if (pollPromise) {
                attachRewardSlug = await pollPromise;
            }

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: {
                        attach_reward_slug: attachRewardSlug
                    },
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {
                        attach_reward_slug: ""
                    },
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // End getSelectedRewardFromEmailOrPoll();


    /**
     * Function used to assign insider email, reward and Poll
     * Uses async/await for all DB operations for faster and cleaner response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.assignInsiderEmailRewadAndPoll = async (req, res) => {
        let finalResponse = {};
        try {
            // Get user id and request data
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? loginUserData._id : "";
            let emailAction = req.body.email_action ? req.body.email_action : "";
            let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
            let rewardSlug = req.body.reward_slug ? req.body.reward_slug : "";

            let isEmailSelect = req.body.is_email ? JSON.parse(req.body.is_email) : false;
            let isPollSelect = req.body.is_poll ? JSON.parse(req.body.is_poll) : false;
            let isRewardSelect = req.body.is_reward ? JSON.parse(req.body.is_reward) : false;

            const leadForms = db.collection(TABLE_LEAD_FORMS);
            const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
            const polls = db.collection(TABLE_POLLS);
            const rewards = db.collection(TABLE_REWARDS);

            // Check if the user ID is valid
            if (!userId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            let aiBotFormsId = loginUserData.ai_bot_forms_id ? newObjectIdDefault(loginUserData.ai_bot_forms_id) : "";

            // If no emailAction, remove the welcome email assignment from the lead form
            if (!emailAction) {
                await leadForms.updateOne(
                    { _id: newObjectIdDefault(aiBotFormsId), user_id: newObjectIdDefault(userId) },
                    { $set: { assign_welcome_email_id: "" } }
                );
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.growth_automation.email_has_been_removed_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Fetch email template data
            const emailTemplateData = await emailTemplate.findOne(
                { action: emailAction, user_id: userId },
                { projection: { _id: 1, body: 1, design_json: 1, attach_poll: 1 } }
            );
            let emailTemplateDataPageBody = emailTemplateData && emailTemplateData.body ? emailTemplateData.body : "";
            let emailTemplateDataDesignJson = emailTemplateData && emailTemplateData.design_json ? emailTemplateData.design_json : "";
            let alreadyAttachPoll = emailTemplateData && emailTemplateData.attach_poll ? emailTemplateData.attach_poll : "";
            let emailId = emailTemplateData && emailTemplateData._id ? emailTemplateData._id : "";

            let pollCustomUrl = '{AI_GENERATE_POLL_LINK}';

            // If an existing poll is attached, get its custom URL
            if (alreadyAttachPoll) {
                const pollData = await polls.findOne(
                    { _id: newObjectIdDefault(alreadyAttachPoll), user_id: userId },
                    { projection: { custom_url: 1 } }
                );
                pollCustomUrl = pollData && pollData.custom_url ? POLL_VIEW_PAGE_URL + pollData.custom_url : "";
            }

            let pollNewCustomUrl = "";

            // Find the lead form for this user and aiBotFormsId
            const leadResult = await leadForms.findOne(
                { _id: newObjectIdDefault(aiBotFormsId), user_id: newObjectIdDefault(userId) },
                { projection: { _id: 1, assign_welcome_email_id: 1 } }
            );

            if (!leadResult) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Get the assigned welcome email ID from the lead form
            let assignWelcomeEmailId = leadResult.assign_welcome_email_id ? newObjectIdDefault(leadResult.assign_welcome_email_id) : "";

            // Prepare update data for email template
            let updateData = {
                modified: getUtcDate(),
            };

            // If reward is selected, fetch reward and set attach_reward
            if (isRewardSelect) {
                if (rewardSlug) {
                    const rewardData = await rewards.findOne(
                        { slug: rewardSlug, user_id: userId },
                        { projection: { _id: 1 } }
                    );
                    let rewardId = rewardData && rewardData._id ? newObjectIdDefault(rewardData._id) : "";
                    updateData.attach_reward = rewardId;
                } else {
                    updateData.attach_reward = "";
                }
            }

            // If poll is selected, fetch poll and update poll-related fields
            if (isPollSelect) {
                if (pollSlug) {
                    const pollNewData = await polls.findOne(
                        { slug: pollSlug, user_id: userId },
                        { projection: { _id: 1, custom_url: 1 } }
                    );
                    let pollId = pollNewData && pollNewData._id ? newObjectIdDefault(pollNewData._id) : "";
                    pollNewCustomUrl = pollNewData && pollNewData.custom_url ? POLL_VIEW_PAGE_URL + pollNewData.custom_url : "";

                    // Replace poll link in body and design_json
                    emailTemplateDataDesignJson = JSON.stringify(emailTemplateDataDesignJson);
                    emailTemplateDataPageBody = emailTemplateDataPageBody.replace(RegExp(pollCustomUrl, 'g'), pollNewCustomUrl);
                    emailTemplateDataDesignJson = emailTemplateDataDesignJson.replace(RegExp(pollCustomUrl, 'g'), pollNewCustomUrl);
                    emailTemplateDataDesignJson = JSON.parse(emailTemplateDataDesignJson);

                    updateData.attach_poll = pollId;
                    updateData.design_json = emailTemplateDataDesignJson;
                    updateData.body = emailTemplateDataPageBody;
                } else {
                    // If poll is not selected, reset poll link in body and design_json
                    let pollCustomUrlBlank = '{AI_GENERATE_POLL_LINK}';
                    emailTemplateDataDesignJson = JSON.stringify(emailTemplateDataDesignJson);
                    emailTemplateDataPageBody = emailTemplateDataPageBody.replace(RegExp(pollCustomUrl, 'g'), pollCustomUrlBlank);
                    emailTemplateDataDesignJson = emailTemplateDataDesignJson.replace(RegExp(pollCustomUrl, 'g'), pollCustomUrlBlank);
                    emailTemplateDataDesignJson = JSON.parse(emailTemplateDataDesignJson);

                    updateData.attach_poll = "";
                    updateData.design_json = emailTemplateDataDesignJson;
                    updateData.body = emailTemplateDataPageBody;
                }
            }

            // If the assigned welcome email ID matches the email ID, update the email template directly
            if (assignWelcomeEmailId && assignWelcomeEmailId.toString() === emailId.toString()) {
                await emailTemplate.updateOne(
                    { _id: emailId, user_id: userId },
                    { $set: updateData }
                );
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.growth_automation.email_attached_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Otherwise, update the lead form with the new email ID, then update the email template
                await leadForms.updateOne({ _id: newObjectIdDefault(aiBotFormsId), user_id: newObjectIdDefault(userId) }, { $set: { assign_welcome_email_id: emailId } });

                await emailTemplate.updateOne({ _id: emailId, user_id: userId }, { $set: updateData });

                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.growth_automation.email_attached_successfully"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle errors and send error response
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
     * Function used to update reward image
     * Uses async/await for all DB/file operations for faster and cleaner response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.uploadRewardImages = async (req, res) => {
        let finalResponse = {};
        // Get user id from request
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";

        // Check if the user ID is valid
        if (!userId) {
            // Send error response if user is not allowed
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Upload reward image asynchronously
            const rewardImage = await uploadUserRewardImage(req, res, userId);

            if (rewardImage.status === STATUS_SUCCESS) {
                // Send success response if image upload succeeded
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.growth_automation.your_logo_has_been_saved_successfully"),
                    }
                };
            } else {
                // Send error response if image upload failed
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle unexpected errors and send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // End uploadRewardImages()


    /**
    * Function used to update user insider toggle
    * Uses async/await for DB operations for cleaner and faster response.
    * @param {*} req 
    * @param {*} res 
    * @returns json response
    */
    this.updateUserInsiderToggle = async (req, res) => {
        let finalResponse = {};
        // Get user id and insider toggle value from request
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let insiderToggle = req.body.insider_toggle ? req.body.insider_toggle : "";
        const users = db.collection(TABLE_USERS);

        // Check if userId or insiderToggle is missing
        if (!userId || !insiderToggle) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Update user insider toggle asynchronously
            await users.updateOne(
                { _id: newObjectIdDefault(userId) },
                { $set: { insider_toggle: insiderToggle } }
            );

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: (insiderToggle == INSIDER_TOGGLE_ON)
                        ? res.__("front.user.insider_toggle_has_been_on_successfully")
                        : res.__("front.user.insider_toggle_has_been_off_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Send error response if update fails
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    } // End updateUserInsiderToggle();

}

module.exports = new growthAutomation();