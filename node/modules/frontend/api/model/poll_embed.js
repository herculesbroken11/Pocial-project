const async = require('async');

function PollEmbed() {

    /**
     * Function to generate and save poll embed code using async/await.
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     * @returns {Promise<void>}
     */
    this.pollEmbedGenerate = async (req, res) => {
        try {
            // Sanitize request body to prevent XSS
            req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

            // Extract user data and poll embed parameters
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
            const gender = loginUserData.gender ? loginUserData.gender : "";

            const uniqueBrowserId = req.body.unique_browser_id ? req.body.unique_browser_id : "";
            const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
            const isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;
            const embedName = req.body.embed_name ? req.body.embed_name : "";

            // Prepare options for saving poll embed code
            const embedOptions = {
                poll_slug: pollSlug,
                user_id: userId,
                embed_name: embedName,
                account_type: accountType,
                gender: gender,
                unique_browser_id: uniqueBrowserId,
                is_view_type: isViewType,
            };

            // Save poll embed code asynchronously
            const embedResponse = await savePollEmbedCode(req, res, embedOptions);

            // Prepare and send response
            const finalResponse = {
                data: {
                    status: embedResponse.status,
                    message: embedResponse.message,
                    result: embedResponse.result,
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle unexpected errors
            const finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.global.something_went_wrong"),
                    result: {},
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEmbedGenerate()

    /**
     * Function to get poll embed list using async/await.
     * Queries poll embed list and total count in parallel.
     */
    this.pollEmbedList = async (req, res) => {
        let finalResponse = {};
        try {
            // Extract user and poll information from request
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";

            // Validate required parameters
            if (!userId || !pollSlug) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Pagination parameters
            const page = req.body.page ? parseInt(req.body.page) : 1;
            const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
            const skip = (limit * page) - limit;

            // Build query conditions
            const conditions = {
                make_poll_user_id: newObjectIdDefault(userId),
                user_id: { $nin: [null, ""] },
                poll_slug: pollSlug,
                is_deleted: NOT_DELETED,
            };

            const pollEmbedTable = db.collection(TABLE_POLL_EMBED_GENERATE);

            // Run both queries in parallel using Promise.all
            const [embedList, totalRecords] = await Promise.all([
                // Get paginated poll embed list
                pollEmbedTable.aggregate([
                    { $match: conditions },
                    {
                        $project: {
                            _id: 1,
                            slug: 1,
                            embed_name: 1,
                            iframe: 1,
                            is_deleted: 1,
                            is_active: 1,
                            created: 1,
                        }
                    },
                    { $sort: { created: SORT_DESC } },
                    { $skip: skip },
                    { $limit: limit },
                ]).toArray(),
                // Get total count of poll embeds
                pollEmbedTable.countDocuments(conditions)
            ]);

            // Prepare and send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: embedList || [],
                    recordsTotal: totalRecords || 0,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil((totalRecords || 0) / limit),
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle error response
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
    }; // end pollEmbedList()

    /**
     * Function to get embed generate details using async/await.
     * Handles both article embed poll id and embed generate slug.
     */
    this.pollEmbedGenerateDetails = async (req, res) => {
        let finalResponse = {};
        const embedGenerateSlug = req.body.embed_generate_slug ? req.body.embed_generate_slug : "";
        const articleEmbedPollId = req.body.article_embed_poll_id ? newObjectIdDefault(req.body.article_embed_poll_id) : "";

        // Validate input parameters
        if (embedGenerateSlug === '' && articleEmbedPollId === '') {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        const generateCollection = db.collection(TABLE_POLL_EMBED_GENERATE);
        const polls = db.collection(TABLE_POLLS);

        try {
            if (articleEmbedPollId !== '') {
                // Fetch poll details by poll id
                const resultPollData = await polls.findOne(
                    { _id: articleEmbedPollId },
                    { projection: { custom_url: 1, is_active: 1, is_deleted: 1 } }
                );

                if (resultPollData) {
                    // Success: Return poll details
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: {
                                embed_name: "",
                                custom_url: resultPollData.custom_url,
                                poll_id: resultPollData._id,
                            },
                            message: res.__("front.global.no_record_found"),
                        }
                    };
                } else {
                    // Error: Poll not found
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            message: res.__("front.global.no_record_found"),
                        }
                    };
                }
                return returnApiResult(req, res, finalResponse);
            } else {
                // Fetch embed generate details by slug
                const detailsEmbedGenerate = await generateCollection.findOne(
                    { slug: embedGenerateSlug },
                    { projection: { poll_slug: 1, poll_id: 1, embed_name: 1, is_active: 1, is_deleted: 1 } }
                );

                if (detailsEmbedGenerate) {
                    // Fetch poll details by poll slug
                    const resultPollData = await polls.findOne(
                        { slug: detailsEmbedGenerate.poll_slug },
                        { projection: { custom_url: 1 } }
                    );

                    if (resultPollData) {
                        // Success: Return embed and poll details
                        finalResponse = {
                            data: {
                                status: STATUS_SUCCESS,
                                result: {
                                    embed_name: detailsEmbedGenerate.embed_name,
                                    embed_active: detailsEmbedGenerate.is_active || 0,
                                    embed_delete: detailsEmbedGenerate.is_deleted || 0,
                                    custom_url: resultPollData.custom_url,
                                    poll_id: resultPollData._id,
                                },
                                message: res.__("front.global.no_record_found"),
                            }
                        };
                    } else {
                        // Error: Poll not found for the given slug
                        finalResponse = {
                            data: {
                                status: STATUS_ERROR,
                                result: {},
                                message: res.__("front.global.no_record_found"),
                            }
                        };
                    }
                } else {
                    // Error: Embed generate not found
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: {},
                            message: res.__("front.global.no_record_found"),
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
                    result: {},
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end pollEmbedGenerateDetails()

    /**
     * Function to activate/deactivate poll embed using async/await.
     * Updates the is_active status of a poll embed for the current user.
     * @param {object} req - Express request object
     * @param {object} res - Express response object
     * @returns {Promise<void>}
     */
    this.activeDeactivePollEmbed = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and embed information from request
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const embedId = req.body.embed_id ? newObjectIdDefault(req.body.embed_id) : "";
            const status = req.body.status ? parseInt(req.body.status) : DEACTIVE;
            const statusData = (status === DEACTIVE) ? ACTIVE : DEACTIVE;

            // Validate required parameters
            if (!userId || !embedId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            const pollEmbedTable = db.collection(TABLE_POLL_EMBED_GENERATE);

            // Update the is_active status of the poll embed
            const updateResult = await pollEmbedTable.updateOne(
                {
                    user_id: newObjectIdDefault(userId),
                    _id: embedId
                },
                { $set: { is_active: statusData } }
            );

            // Check if the update was successful
            if (updateResult && updateResult.modifiedCount > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: (status === DEACTIVE)
                            ? res.__("front.poll_embed.poll_embed_has_been_updated_successfully")
                            : res.__("front.poll_embed.poll_embed_has_been_deactivated_successfully"),
                    }
                };
            } else {
                // No document was updated (possibly not found)
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
    }; // end activeDeactivePollEmbed()

    /**
     * Function to delete Poll Embed using async/await.
     * Marks the poll embed as deleted for the given user and embed ID.
     */
    this.deletePollEmbed = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user data and embed ID from request
            const loginUserData = req.user_data ? req.user_data : "";
            const userId = loginUserData._id ? loginUserData._id : "";
            const embedId = req.body.embed_id ? newObjectIdDefault(req.body.embed_id) : "";

            // Validate required parameters
            if (!userId || !embedId) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            const pollEmbedTable = db.collection(TABLE_POLL_EMBED_GENERATE);

            // Update the is_deleted status of the poll embed asynchronously
            const updateResult = await pollEmbedTable.updateOne(
                {
                    user_id: newObjectIdDefault(userId),
                    _id: embedId
                },
                { $set: { is_deleted: DELETED } }
            );

            // Check if the update was successful
            if (updateResult && updateResult.modifiedCount > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: {},
                        message: res.__("front.poll_embed.poll_embed_has_been_delete_successfully")
                    }
                };
            } else {
                // No document was updated (possibly not found)
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
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
                    result: {},
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end deletePollEmbed()

}
module.exports = new PollEmbed();