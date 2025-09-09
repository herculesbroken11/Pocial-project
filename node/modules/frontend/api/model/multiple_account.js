const async = require('async');
const { response } = require('express');

/** Define collection */
const users = db.collection(TABLE_USERS);
const multipleUserAssign = db.collection(TABLE_MULTIPLE_USERS_ASSIGN);
const multipleUserGroup = db.collection(TABLE_MULTIPLE_USER_GROUPS);
const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

function multipleUserAccount() {

    /**
     * Assigns a user account to another user.
     * Uses async/await for efficient query handling.
     * @param {*} req 
     * @param {*} res 
     */
    this.assignMultipleAccount = async (req, res) => {
        let finalResponse = {};

        // Extract user IDs from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const assignedUserId = req.body.assign_user_id ? req.body.assign_user_id : "";

        // Permission check
        if (!userId || !assignedUserId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Call function to assign user for multiple accounts
            const response = await dynamicAssignMultipleAccount(req, res, userId, assignedUserId);

            // Send response message
            finalResponse = {
                data: {
                    status: response.status,
                    message: response.message
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end assignMultipleAccount();

    /**
     * Get the list of assigned users for the current user.
     * Uses async/await and Promise.all for parallel query execution.
     * @param {*} req 
     * @param {*} res 
     */
    this.getAssignUsersList = async (req, res, next) => {
        let finalResponse = {};

        // Extract user data and check permission
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Pagination and filter parameters
        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        const userEmail = req.body.email ? req.body.email : "";
        const skip = (limit * page) - limit;

        // Build query conditions
        let conditions = {
            user_id: newObjectIdDefault(userId)
        };
        if (userEmail !== "") {
            conditions['assigned_user_email'] = { $regex: "^" + userEmail + "$", $options: "i" };
        }

        try {
            // Prepare aggregation pipeline for assigned user list
            const aggregatePipeline = [
                { $match: conditions },
                {
                    $lookup: {
                        from: TABLE_USERS,
                        let: { assignedUserId: "$assigned_user_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$_id", "$$assignedUserId"] },
                                        ]
                                    },
                                }
                            },
                            { $project: { full_name: 1, slug: 1, profile_image: 1, UUID: 1, email: 1, account_type: 1 } }
                        ],
                        as: "assignUserDetails"
                    }
                },
                {
                    $project: {
                        _id: 1,
                        user_id: 1,
                        assigned_user_id: 1,
                        assigned_user_slug: 1,
                        assigned_user_email: 1,
                        created: 1,
                        email: { $arrayElemAt: ["$assignUserDetails.email", 0] },
                        uuid: { $arrayElemAt: ["$assignUserDetails.UUID", 0] },
                        slug: { $arrayElemAt: ["$assignUserDetails.slug", 0] },
                        full_name: { $arrayElemAt: ["$assignUserDetails.full_name", 0] },
                        account_type: { $arrayElemAt: ["$assignUserDetails.account_type", 0] },
                        profile_image: { $arrayElemAt: ["$assignUserDetails.profile_image", 0] },
                    }
                },
                { $sort: { created: SORT_DESC } },
                { $skip: skip },
                { $limit: limit },
            ];

            // Run both queries in parallel for better performance
            const [multipleAccountList, totalRecord] = await Promise.all([
                multipleUserAssign.aggregate(aggregatePipeline).toArray(),
                multipleUserAssign.countDocuments(conditions)
            ]);

            // Prepare and send response
            if (multipleAccountList && multipleAccountList.length > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        image_url: USERS_URL,
                        result: multipleAccountList,
                        recordsTotal: totalRecord,
                        limit: limit,
                        page: page,
                        message: "",
                        total_page: Math.ceil(totalRecord / limit)
                    }
                };
            } else {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        image_url: USERS_URL,
                        result: [],
                        recordsTotal: 0,
                        limit: limit,
                        page: page,
                        message: res.__("front.global.no_record_found"),
                        total_page: 0
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle errors gracefully
            return next(err);
        }
    }; // end getAssignUsersList();

    /**
     * Deletes an assigned user from the multiple user assignment collection.
     * Uses async/await for efficient query handling.
     * @param {*} req 
     * @param {*} res 
     */
    this.deleteAssignUser = async (req, res) => {
        let finalResponse = {};
        // Extract user and assigned user IDs from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const assignedId = req.body.assign_id ? req.body.assign_id : "";

        // Permission check
        if (!userId || !assignedId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Attempt to delete the assigned user document
            const result = await multipleUserAssign.deleteOne({ "_id": newObjectIdDefault(assignedId) });

            if (result && result.deletedCount > 0) {
                // Success response if a document was deleted
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.user.assigned_user_has_been_removed_successfully"),
                    }
                };
            } else {
                // Error response if no document was deleted
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again")
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end deleteAssignUser();

    /**
     * Function to get the list of users assigned to the logged-in user (old version).
     * Uses async/await and Promise.all for parallel query execution.
     * @param {*} req 
     * @param {*} res 
     */
    this.afterLoginUserAssignListOld = async (req, res, next) => {
        let finalResponse = {};

        // Extract user data
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const loginUserEmail = loginUserData.email ? loginUserData.email : "";

        // Permission check
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Pagination and filter parameters
        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        const userEmail = req.body.email ? req.body.email : "";
        const skip = (limit * page) - limit;

        // Build query conditions
        let conditions = {
            assigned_user_id: newObjectIdDefault(userId),
        };
        if (userEmail !== "") {
            conditions['assigned_user_email'] = { $regex: "^" + userEmail + "$", $options: "i" };
        }

        try {
            // Run all queries in parallel using Promise.all for better performance
            const [
                multipleAccountList, // Paginated result
                totalRecord,         // Total count
                sameEmailAccountsDetails // Same email accounts
            ] = await Promise.all([
                // Get multiple assigned user list
                multipleUserAssign.aggregate([
                    { $match: conditions },
                    {
                        $lookup: {
                            from: TABLE_USERS,
                            let: { assignedUserId: "$user_id" },
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $and: [
                                                { $eq: ["$_id", "$$assignedUserId"] },
                                            ]
                                        },
                                    }
                                },
                                { $project: { full_name: 1, slug: 1, profile_image: 1, UUID: 1, email: 1, account_type: 1 } }
                            ],
                            as: "assignUserDetails"
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            user_id: 1,
                            assigned_user_id: 1,
                            assigned_user_slug: 1,
                            assigned_user_email: 1,
                            created: 1,
                            email: { $arrayElemAt: ["$assignUserDetails.email", 0] },
                            uuid: { $arrayElemAt: ["$assignUserDetails.UUID", 0] },
                            slug: { $arrayElemAt: ["$assignUserDetails.slug", 0] },
                            full_name: { $arrayElemAt: ["$assignUserDetails.full_name", 0] },
                            account_type: { $arrayElemAt: ["$assignUserDetails.account_type", 0] },
                            profile_image: { $arrayElemAt: ["$assignUserDetails.profile_image", 0] },
                        }
                    },
                    { $sort: { created: SORT_DESC } },
                    { $skip: skip },
                    { $limit: limit },
                ]).toArray(),

                // Get total number of records
                multipleUserAssign.countDocuments(conditions),

                // Get same email records data
                users.find(
                    { email: { $regex: "^" + loginUserEmail + "$", $options: "i" }, is_deleted: NOT_DELETED },
                    { projection: { _id: 1, email: 1, uuid: 1, slug: 1 } }
                ).toArray()
            ]);

            // Add login string for user
            if (multipleAccountList && multipleAccountList.length > 0) {
                multipleAccountList.forEach((record, index) => {
                    const assignEmail = record.email || "";
                    const assignSlug = record.slug || "";
                    const assignUuid = record.uuid || "";
                    const encodeLoginUrl = generateLoginUrl(assignUuid, assignEmail, assignSlug);
                    multipleAccountList[index]['login_encode_url'] = encodeLoginUrl;
                });
            }

            // Add login string for same email accounts details
            if (sameEmailAccountsDetails && sameEmailAccountsDetails.length > 0) {
                sameEmailAccountsDetails.forEach((record, index) => {
                    const assignEmail = record.email || "";
                    const assignSlug = record.slug || "";
                    const assignUuid = record.uuid || "";
                    const encodeLoginUrl = generateLoginUrl(assignUuid, assignEmail, assignSlug);
                    sameEmailAccountsDetails[index]['login_encode_url'] = encodeLoginUrl;
                });
            }

            // Send success response
            if ((multipleAccountList && multipleAccountList.length > 0) || (sameEmailAccountsDetails && sameEmailAccountsDetails.length > 0)) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        image_url: USERS_URL,
                        result: multipleAccountList || [],
                        same_email_accounts_details: sameEmailAccountsDetails || [],
                        recordsTotal: totalRecord || 0,
                        limit: limit,
                        page: page,
                        message: "",
                        total_page: Math.ceil((totalRecord || 0) / limit)
                    }
                };
            } else {
                // No records found
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        image_url: USERS_URL,
                        result: [],
                        recordsTotal: 0,
                        limit: limit,
                        page: page,
                        message: res.__("front.global.no_record_found"),
                        total_page: 0
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully
            return next(err);
        }
    }; // end afterLoginUserAssignListOld();

    /**
     * Function to list users with the same email or assigned accounts.
     * Uses async/await and Promise.all for parallel query execution.
     * @param {*} req 
     * @param {*} res 
     */
    this.afterLoginUserAssignList = async (req, res, next) => {
        let finalResponse = {};

        // Extract user data and request parameters
        let loginUserData = req.user_data ? req.user_data : "";
        let userId = loginUserData._id ? loginUserData._id : "";
        let userEmail = loginUserData.email ? loginUserData.email : "";
        let userSlug = loginUserData.slug ? loginUserData.slug : "";
        let enterprise = loginUserData.enterprise ? loginUserData.enterprise : "";
        let mainUserLoginData = req.body.main_user_login_data ? req.body.main_user_login_data : "";
        let manageAccountPage = req.body.manage_account_page ? req.body.manage_account_page : false; // flag for business user group selection

        if (!userId) {
            // Send error response if user is not authenticated
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        let page = req.body.page ? parseInt(req.body.page) : 1;
        let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        let skip = (limit * page) - limit;

        // If main user login data is provided, decode and use that user context
        if (mainUserLoginData) {
            let loginData = atob(mainUserLoginData);
            const myArray = loginData.split("#@!");
            let mainSlug = myArray[2] ? myArray[2] : "";
            let mainUserDetails = await users.findOne({ slug: mainSlug });
            userId = mainUserDetails._id;
            userEmail = mainUserDetails.email;
        }

        // Get all user IDs assigned to this email
        let multipleAddUserIds = await multipleUserAssign.distinct(
            "user_id",
            { "assigned_user_email": { $regex: '^' + userEmail + '$', $options: 'i' } }
        );

        // Build query conditions for user listing
        let conditionData = {
            $or: [
                { _id: { $in: multipleAddUserIds } },
                { email: new RegExp("^" + userEmail + "$", "i") },
            ],
            is_deleted: NOT_DELETED
        };

        // If manageAccountPage flag is set, filter for business users only
        if (manageAccountPage && manageAccountPage === true) {
            conditionData['account_type'] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
        }

        try {
            // Run user listing and total count queries in parallel
            const [userList, totalRecord] = await Promise.all([
                (async () => {
                    // Find users matching the condition
                    let usersArr = await users.find(
                        conditionData,
                        {
                            projection: {
                                'full_name': 1,
                                'slug': 1,
                                'profile_image': 1,
                                'UUID': 1,
                                'email': 1,
                                'account_type': 1,
                                'name_of_the_business': '$public_business_informaton.name_of_the_business'
                            }
                        }
                    ).sort({ 'created': SORT_ASC, 'signup_attempts': SORT_ASC }).limit(limit).skip(skip).toArray();

                    // If enterprise, fetch group details for each user
                    if (enterprise == ALLOW_ENTERPRISE && usersArr.length > 0) {
                        await Promise.all(usersArr.map(async (user) => {
                            const groups = await multipleUserGroup.find(
                                {
                                    'user_id': userId,
                                    'group_user_ids': user._id,
                                    'is_deleted': NOT_DELETED
                                },
                                { projection: { group_name: 1, slug: 1 } }
                            ).toArray();
                            user.group_datas = groups;
                        }));
                    }
                    return usersArr;
                })(),
                users.countDocuments(conditionData)
            ]);

            // Add login string for each user
            userList.forEach((record, index) => {
                let assignEmail = record.email ? record.email : "";
                let assignSlug = record.slug ? record.slug : "";
                let assignUuid = record.UUID ? record.UUID : "";
                const encodeLoginUrl = generateLoginUrl(assignUuid, assignEmail, assignSlug);
                userList[index]['login_encode_url'] = encodeLoginUrl;
            });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    image_url: USERS_URL,
                    result: userList,
                    recordsTotal: totalRecord,
                    limit: limit,
                    page: page,
                    message: "",
                    total_page: Math.ceil(totalRecord / limit)
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    image_url: USERS_URL,
                    result: [],
                    recordsTotal: 0,
                    limit: limit,
                    page: page,
                    message: res.__("front.global.no_record_found"),
                    total_page: 0
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end afterLoginUserAssignList();

    /**
     * Creates a user group with the specified group name and user IDs.
     * Uses async/await for efficient query handling.
     * @param {*} req 
     * @param {*} res 
     */
    this.createUserGroup = async (req, res, next) => {
        let finalResponse = {};

        // Extract user and group details from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const groupName = req.body.group_name ? req.body.group_name : "";
        const groupUserIds = Array.isArray(req.body.group_user_ids) ? req.body.group_user_ids : [];

        // Permission and input validation
        if (!userId || !groupName || groupUserIds.length === 0) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Convert user IDs to ObjectId
            const groupUserIdsArray = groupUserIds.map(id => newObjectIdDefault(id));

            // Generate a unique slug for the group
            const slugOptions = {
                title: groupName,
                table_name: TABLE_MULTIPLE_USER_GROUPS,
                slug_field: "slug"
            };
            const slugResponse = await getDatabaseSlug(slugOptions);
            const groupSlug = slugResponse?.title || "";

            // Insert the new group into the database
            await multipleUserGroup.insertOne({
                slug: groupSlug,
                group_name: groupName,
                user_id: userId,
                group_user_ids: groupUserIdsArray,
                is_deleted: NOT_DELETED,
                created: getUtcDate(),
            });

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.multiple_user_group.user_group_has_been_created_successfully"),
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: error && error.message ? error.message : res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end createUserGroup();

    /**
     * Function to get group listing using async/await and Promise.all for parallel queries.
     * @param {*} req 
     * @param {*} res 
     */
    this.getGroupList = async (req, res, next) => {
        let finalResponse = {};

        // Extract user data and check permission
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        if (!userId) {
            // Send error response if user is not authenticated
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Pagination parameters
        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        const skip = (limit * page) - limit;

        // Query condition
        const conditionData = {
            user_id: userId,
            is_deleted: NOT_DELETED
        };

        try {
            // Run both queries in parallel for better performance
            const [groupList, totalRecord] = await Promise.all([
                multipleUserGroup.find(conditionData)
                    .sort({ created: SORT_DESC })
                    .limit(limit)
                    .skip(skip)
                    .toArray(),
                multipleUserGroup.countDocuments(conditionData)
            ]);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: groupList || [],
                    recordsTotal: totalRecord || 0,
                    limit: limit,
                    page: page,
                    message: "",
                    total_page: Math.ceil((totalRecord || 0) / limit)
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: [],
                    recordsTotal: 0,
                    limit: limit,
                    page: page,
                    message: res.__("front.global.no_record_found"),
                    total_page: 0
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getGroupList();

    /**
     * Function to get group dropdown listing using async/await for faster response.
     * @param {*} req 
     * @param {*} res 
     */
    this.groupListDropdown = async (req, res, next) => {
        let finalResponse = {};

        // Extract user id from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        // Permission check
        if (!userId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Build query condition
        const conditionData = {
            user_id: userId,
            is_deleted: NOT_DELETED
        };

        try {
            // Query group list with projection for group_name, sorted by created date descending
            const results = await multipleUserGroup
                .find(conditionData, { projection: { group_name: 1 } })
                .sort({ created: SORT_DESC })
                .toArray();

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: results || [],
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: [],
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end groupListDropdown();


    /**
     * Updates a user group with new group name and user IDs.
     * Uses async/await for efficient query handling.
     * @param {*} req 
     * @param {*} res 
     */
    this.updateUserGroup = async (req, res, next) => {
        let finalResponse = {};

        // Extract user and group data from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const groupSlug = req.body.group_slug ? req.body.group_slug : "";
        const groupName = req.body.group_name ? req.body.group_name : "";
        const groupUserIds = req.body.group_user_ids ? req.body.group_user_ids : [];

        // Validate required fields
        if (!userId || !groupSlug || !groupName || !Array.isArray(groupUserIds) || groupUserIds.length === 0) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Find the group to update
            const group = await multipleUserGroup.findOne({
                slug: groupSlug,
                user_id: newObjectIdDefault(userId)
            });

            if (!group) {
                // Group not found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.global.no_record_found"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Convert user IDs to ObjectId
            const groupUserIdsArray = groupUserIds.map(id => newObjectIdDefault(id));

            // Update the group with new name and user IDs
            const updateResult = await multipleUserGroup.updateOne(
                {
                    slug: groupSlug,
                    user_id: newObjectIdDefault(userId)
                },
                {
                    $set: {
                        group_name: groupName,
                        group_user_ids: groupUserIdsArray,
                        modified: getUtcDate(),
                    }
                }
            );

            if (updateResult && updateResult.modifiedCount > 0) {
                // Success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.multiple_user_group.user_group_has_been_updated_successfully"),
                    }
                };
            } else {
                // Update failed
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end updateUserGroup();


    /**
     * Function to get group user details using async/await for better performance.
     * @param {*} req 
     * @param {*} res 
     */
    this.getUserGroupDetails = async (req, res, next) => {
        let finalResponse = {};

        // Extract user id and group slug from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const groupSlug = req.body.group_slug ? req.body.group_slug : "";

        // Permission check
        if (!userId || !groupSlug) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Fetch group details for the given user and group slug
            const groupResult = await multipleUserGroup.findOne({
                slug: groupSlug,
                user_id: newObjectIdDefault(userId)
            });

            if (groupResult) {
                // Get user IDs from the group
                const groupUserIds = groupResult.group_user_ids || [];

                // Fetch user details for all users in the group in parallel
                const userListData = await users.find(
                    { _id: { $in: groupUserIds } },
                    {
                        projection: {
                            'full_name': 1,
                            'slug': 1,
                            'profile_image': 1,
                            'UUID': 1,
                            'email': 1,
                            'account_type': 1,
                            'name_of_the_business': '$public_business_informaton.name_of_the_business'
                        }
                    }
                ).toArray();

                // Attach user list data to the group result
                groupResult['user_list_data'] = userListData;

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        image_url: USERS_URL,
                        result: groupResult,
                        message: "",
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Group not found, send error response
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        image_url: USERS_URL,
                        result: {},
                        message: res.__("front.system.something_going_wrong_please_try_again")
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    image_url: USERS_URL,
                    result: {},
                    message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again")
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getUserGroupDetails();


    /**
     * Deletes a user group for the logged-in user.
     * Uses async/await for efficient query handling.
     * @param {*} req 
     * @param {*} res 
     */
    this.deleteUserGroup = async (req, res, next) => {
        let finalResponse = {};

        // Extract user and group slug from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const groupSlug = req.body.group_slug ? req.body.group_slug : "";

        // Permission check
        if (!userId || !groupSlug) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Update the group to mark as deleted
            const result = await multipleUserGroup.updateOne(
                {
                    slug: groupSlug,
                    user_id: newObjectIdDefault(userId)
                },
                {
                    $set: {
                        is_deleted: DELETED,
                        modified: getUtcDate(),
                    }
                }
            );

            // Check if the group was found and updated
            if (result && result.modifiedCount > 0) {
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.multiple_user_group.user_group_has_been_deleted_successfully"),
                    }
                };
            } else {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: err && err.message ? err.message : res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end deleteUserGroup();


    /**
     * Function for owner group social post listing
     * Uses async/await and Promise.all for parallel query execution.
     * @param {*} req 
     * @param {*} res 
     */
    this.ownerGroupSocialPostListing = async (req, res, next) => {
        let finalResponse = {};

        // Extract user id from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        if (!userId) {
            // Send error response if user is not authenticated
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Pagination parameters
        const page = req.body.page ? parseInt(req.body.page) : 1;
        let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        const skip = (limit * page) - limit;

        // Common query condition for aggregation
        const commonCondition = {
            owner_group_user_id: userId,
            social_role_type: SOCIAL_POST_GENERATE_TYPE,
            is_deleted: NOT_DELETED
        };

        try {
            // Prepare aggregation pipeline for group listing
            const listingPipeline = [
                { $match: commonCondition },
                {
                    $addFields: {
                        priority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$is_draft", "draft"] }, then: 1 },
                                    { case: { $eq: ["$is_scheduled", true] }, then: 2 },
                                    {
                                        case: {
                                            $or: [
                                                { $eq: ["$direct_instagram_published", true] },
                                                { $eq: ["$direct_facebook_published", true] },
                                                { $eq: ["$sent_ig", true] },
                                                { $eq: ["$sent_fb", true] }
                                            ]
                                        },
                                        then: 3
                                    }
                                ],
                                default: 4
                            }
                        }
                    }
                },
                // Sort by group_ref_key, then priority ASC, created DESC
                {
                    $sort: {
                        group_ref_key: 1,
                        priority: 1,
                        created: -1
                    }
                },
                // Group and pick first document per group_ref_key
                {
                    $group: {
                        _id: "$group_ref_key",
                        doc: { $first: "$$ROOT" }
                    }
                },
                // Replace root with selected document
                {
                    $replaceRoot: { newRoot: "$doc" }
                },
                // Lookup group details
                {
                    $lookup: {
                        from: TABLE_MULTIPLE_USER_GROUPS,
                        let: { groupId: "$group_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$_id", "$$groupId"] }
                                        ]
                                    }
                                }
                            },
                            { $project: { slug: 1, group_name: 1 } }
                        ],
                        as: "groupDetails"
                    }
                },
                // Lookup schedule details
                {
                    $lookup: {
                        from: TABLE_CALENDAR_SCHEDULE_POST,
                        let: { campaignId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_chat_id", "$$campaignId"] },
                                            { $gte: ["$schedule_date", new Date()] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "scheduleDetails"
                    }
                },
                // Project required fields
                {
                    $project: {
                        _id: 1,
                        title: "$content.title",
                        unique_key: 1,
                        group_ref_key: 1,
                        sent_created: { $cond: ["$sent_created", "$sent_created", ""] },
                        group_slug: { $cond: [{ $arrayElemAt: ["$groupDetails.slug", 0] }, { $arrayElemAt: ["$groupDetails.slug", 0] }, ""] },
                        group_name: { $cond: [{ $arrayElemAt: ["$groupDetails.group_name", 0] }, { $arrayElemAt: ["$groupDetails.group_name", 0] }, ""] },
                        created: 1,
                        schedule_date: { $cond: [{ $arrayElemAt: ["$scheduleDetails.schedule_date", 0] }, { $arrayElemAt: ["$scheduleDetails.schedule_date", 0] }, ""] },
                        status: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$is_draft", DRAFT_STATUS] }, then: "Draft" },
                                    { case: { $eq: ["$is_scheduled", true] }, then: "Scheduled" },
                                    {
                                        case: {
                                            $or: [
                                                { $eq: ["$direct_instagram_published", true] },
                                                { $eq: ["$direct_facebook_published", true] },
                                                { $eq: ["$sent_ig", true] },
                                                { $eq: ["$sent_fb", true] }
                                            ]
                                        },
                                        then: "Sent"
                                    }
                                ],
                                default: ""
                            }
                        }
                    }
                },
                // Pagination
                { $sort: { created: SORT_DESC } },
                { $skip: skip },
                { $limit: limit }
            ];

            // Run both queries in parallel for better performance
            const [listing, totalRecordsArr] = await Promise.all([
                // Get paginated group listing
                tableAiCampaignChat.aggregate(listingPipeline).toArray(),
                // Get total unique group_ref_key count
                tableAiCampaignChat.distinct("group_ref_key", commonCondition)
            ]);

            const totalRecord = totalRecordsArr ? totalRecordsArr.length : 0;

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: listing || [],
                    recordsTotal: totalRecord,
                    limit: limit,
                    page: page,
                    message: "",
                    total_page: Math.ceil(totalRecord / limit)
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: [],
                    recordsTotal: 0,
                    limit: limit,
                    page: page,
                    message: res.__("front.global.no_record_found"),
                    total_page: 0
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end ownerGroupSocialPostListing();


    /**
     * Function for review group post user listing review
     * Uses async/await and Promise.all for parallel query execution.
     * @param {*} req 
     * @param {*} res 
     */
    this.reviewGroupUserList = async (req, res, next) => {
        let finalResponse = {};

        // Extract user and request parameters
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const groupSlug = req.body.group_slug || "";
        const uniqueKey = req.body.unique_key || "";
        const groupRefKey = req.body.group_ref_key || "";

        // Permission check
        if (!userId || !groupSlug || !uniqueKey || !groupRefKey) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        const skip = (limit * page) - limit;

        // Common query condition for all queries
        const commonCondition = {
            owner_group_user_id: userId,
            group_slug: groupSlug,
            social_role_type: SOCIAL_POST_GENERATE_TYPE,
            group_ref_key: groupRefKey,
            is_deleted: NOT_DELETED
        };

        try {
            // Prepare aggregation pipeline for listing
            const listingPipeline = [
                { $match: commonCondition },
                {
                    $lookup: {
                        from: TABLE_USERS,
                        let: { userId: "$user_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$_id", "$$userId"] },
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "userDetails"
                    }
                },
                {
                    $lookup: {
                        from: TABLE_CALENDAR_SCHEDULE_POST,
                        let: { campaignId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$ai_campaign_chat_id", "$$campaignId"] },
                                            { $gte: ["$schedule_date", new Date()] },
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "scheduleDetails"
                    }
                },
                {
                    $project: {
                        "_id": 1,
                        "ai_campaign_chat_user_id": "$user_id",
                        "profile_image": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.profile_image", 0] },
                                { $arrayElemAt: ["$userDetails.profile_image", 0] },
                                ""
                            ]
                        },
                        "full_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
                                { $arrayElemAt: ["$userDetails.public_business_informaton.name_of_the_business", 0] },
                                { $arrayElemAt: ["$userDetails.full_name", 0] }
                            ]
                        },
                        "user_name": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.slug", 0] },
                                { $arrayElemAt: ["$userDetails.slug", 0] },
                                ""
                            ]
                        },
                        "facebook_page_id": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.facebook_page_id", 0] },
                                { $arrayElemAt: ["$userDetails.facebook_page_id", 0] },
                                ""
                            ]
                        },
                        "facebook_user_details": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.facebook_user_details", 0] },
                                { $arrayElemAt: ["$userDetails.facebook_user_details", 0] },
                                ""
                            ]
                        },
                        "instagram_user_details": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.instagram_user_details", 0] },
                                { $arrayElemAt: ["$userDetails.instagram_user_details", 0] },
                                ""
                            ]
                        },
                        "facebook_page_access_token": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.facebook_page_access_token", 0] },
                                { $arrayElemAt: ["$userDetails.facebook_page_access_token", 0] },
                                ""
                            ]
                        },
                        "post_on_facebook": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.post_on_facebook", 0] },
                                { $arrayElemAt: ["$userDetails.post_on_facebook", 0] },
                                false
                            ]
                        },
                        "post_on_instagram": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.post_on_instagram", 0] },
                                { $arrayElemAt: ["$userDetails.post_on_instagram", 0] },
                                false
                            ]
                        },
                        "current_timezone": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.current_timezone", 0] },
                                { $arrayElemAt: ["$userDetails.current_timezone", 0] },
                                false
                            ]
                        },
                        "long_lived_access_token": {
                            $cond: [
                                { $arrayElemAt: ["$userDetails.long_lived_access_token", 0] },
                                { $arrayElemAt: ["$userDetails.long_lived_access_token", 0] },
                                ""
                            ]
                        },
                        "schedule_date": {
                            $cond: [
                                { $arrayElemAt: ["$scheduleDetails.schedule_date", 0] },
                                { $arrayElemAt: ["$scheduleDetails.schedule_date", 0] },
                                ""
                            ]
                        },
                        "type": 1,
                        "created": 1,
                        "is_draft": 1,
                        "sent_created": { $cond: ["$sent_created", "$sent_created", ""] },
                        // NEW STATUS LOGIC
                        "status": {
                            $switch: {
                                branches: [
                                    {
                                        case: { $eq: ["$is_draft", DRAFT_STATUS] },
                                        then: "Draft"
                                    },
                                    {
                                        case: { $eq: ["$is_scheduled", true] },
                                        then: "Scheduled"
                                    },
                                    {
                                        case: {
                                            $or: [
                                                { $eq: ["$direct_instagram_published", true] },
                                                { $eq: ["$direct_facebook_published", true] },
                                                { $eq: ["$sent_ig", true] },
                                                { $eq: ["$sent_fb", true] }
                                            ]
                                        },
                                        then: "Sent"
                                    }
                                ],
                                default: ""
                            }
                        }
                    }
                },
                { $sort: { 'created': SORT_DESC } },
                { $skip: skip },
                { $limit: limit }
            ];

            // Run all queries in parallel for better performance
            const [listing, totalRecord, groupSocialPostDetails] = await Promise.all([
                // Get paginated group listing
                tableAiCampaignChat.aggregate(listingPipeline).toArray(),
                // Get total record count
                tableAiCampaignChat.countDocuments(commonCondition),
                // Get group social post details
                tableAiCampaignChat.findOne({
                    unique_key: uniqueKey,
                    group_slug: groupSlug,
                    owner_group_user_id: userId
                })
            ]);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    title_heading_name: groupSocialPostDetails?.content?.title || '',
                    image_url: USERS_URL,
                    result: listing || [],
                    recordsTotal: totalRecord || 0,
                    limit: limit,
                    page: page,
                    message: "",
                    total_page: Math.ceil((totalRecord || 0) / limit)
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    title_heading_name: '',
                    image_url: USERS_URL,
                    result: [],
                    recordsTotal: 0,
                    limit: limit,
                    page: page,
                    message: res.__("front.global.no_record_found"),
                    total_page: 0
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end reviewGroupUserList();

}
module.exports = new multipleUserAccount();