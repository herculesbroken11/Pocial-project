const async = require('async');
const campaignLogs = db.collection(TABLE_AI_CAMPAIGN_LOGS);
const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);

function AiCampaignLogs() {

    /**
     * Function is used to get AI campaign logs using async/await for faster and cleaner response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getAiCampaignlogs = async (req, res) => {
        let finalResponse = {};

        try {
            // Extract user and request data
            let loginUserData = req.user_data ? req.user_data : "";
            let userId = loginUserData._id ? loginUserData._id : "";
            let campaignParentId = req.body.ai_campaign_parent_id ? req.body.ai_campaign_parent_id : "";
            let type = req.body.type ? req.body.type : "";
            let campaignType = req.body.campaign_type ? req.body.campaign_type : "";
            let optionId = req.body.option_id ? req.body.option_id : "";

            // Validate required fields
            if (!userId || !type) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Build query condition
            let condition = {
                user_id: newObjectIdDefault(userId),
                type: type
            };

            if (campaignParentId !== "") {
                condition["ai_campaign_parent_id"] = newObjectIdDefault(campaignParentId);
            }
            if (campaignType !== "") {
                condition["campaign_type"] = campaignType;
            }
            if (optionId !== "") {
                condition["option_id"] = newObjectIdDefault(optionId);
            }

            // Query campaign logs using async/await
            const result = await campaignLogs.find(condition).toArray();

            if (result && result.length > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: result,
                        message: "",
                    }
                };
            } else {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.global.no_record_found"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Catch-all error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getAiCampaignlogs();

    /**
     * Function is used to get AI campaign list
     * Uses async/await for all DB operations and runs queries in parallel for faster response.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.getAiCampaignList = async (req, res) => {
        let finalResponse = {};

        // Extract user and request data
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let type = req.body.type ? req.body.type : "";

        let page = req.body.page ? parseInt(req.body.page) : 1;
        let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT + 2;
        let skip = (limit * page) - limit;

        // Validate required fields
        if (!userId || !type) {
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
            // Prepare query conditions
            const query = { user_id: newObjectIdDefault(userId), type: type };
            const projection = { projection: { _id: 1, ai_campaign_name: 1, type: 1, created: 1 } };

            // Run campaign list and total count queries in parallel
            const [historyDetails, totalRecords] = await Promise.all([
                tableAiCampaignName
                    .find(query, projection)
                    .sort({ created: SORT_DESC })
                    .skip(skip)
                    .limit(limit)
                    .toArray(),
                tableAiCampaignName.countDocuments(query)
            ]);

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: historyDetails || [],
                    recordsTotal: totalRecords || 0,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil((totalRecords || 0) / limit),
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Error response
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
    }; // end getAiCampaignList();
}
module.exports = new AiCampaignLogs();