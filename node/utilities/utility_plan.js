const async = require('async');

/**
 * Function to limit access for social post based on user's plan and activity type.
 * Uses async/await for all database queries for better performance and clarity.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @returns {Promise} A promise that resolves with an object containing the status of the request and other relevant data.
 */
planAccourdingLimitAccessMiddleware = async (req, res, loginUserData, activityType) => {
    try {
        const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);

        if (!loginUserData || !activityType) {
            // Return error case for missing parameters
            return {
                'status': NOT_ALLOW_CREATE_DATA,
                'current_plan_interval': '',
                'plan_type_name': "",
                'count': 0,
                'post_limit': 0,
                'activity_type': activityType,
                'current_limit_available': 0
            };
        }

        let userId = loginUserData._id;
        let freePlan = loginUserData.free_plan || false;
        let userCreated = loginUserData.created || "";
        let subscriptionId = loginUserData.subscription_id || "";
        let allowsAccessPlatformAdmin = loginUserData.allows_access_platform_in_admin ? loginUserData.allows_access_platform_in_admin : PAYMENT_SUPER_ADMIN_UNPAID;
        let masterTurnOnDate = loginUserData.master_turn_on_date ? loginUserData.master_turn_on_date : "";
        let allowsAccessPlatformInCreatedDate = loginUserData.allows_access_platform_in_created_date ? loginUserData.allows_access_platform_in_created_date : "";
        let freePlanPurchaseDate = loginUserData.free_plan_date ? loginUserData.free_plan_date : "";

        // Super admin limit exceed
        let adminExceedLimit = loginUserData.exceed_limit ? loginUserData.exceed_limit : {};
        let adminActivityTypeAccourdingExceedLimit = Number(adminExceedLimit[activityType]) || 0;

        // Initialize post limit and plan info
        let postLimit = 0;
        let planTypeName = "";
        let planStartDate = "";
        let planEndDate = "";
        let currentDate = new Date();
        let currentPlanInterval = PLAN_MONTH_INTERVAL;

        // Get user's active subscription plan
        let alreadyPurchaseOptions = {
            "user_id": newObjectIdDefault(userId),
            "subscription_status": SUBSCRIPTION_ACTIVE_STATUS,
            'plan_status': PAYMENT_PLAN_ACTIVE,
            'plan_type': { $ne: PLAN_FOR_ALLOWS_ACCESS_PLATFORM_ADMIN }
        };

        let purchaseSubscription = await planUserPurchaseCollection.findOne(alreadyPurchaseOptions);

        if (purchaseSubscription) {
            planStartDate = new Date(purchaseSubscription.plan_start_date);
            planEndDate = new Date(purchaseSubscription.plan_end_date);

            // Set plan interval to yearly if needed
            if (
                purchaseSubscription.plan_lookup_key == PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY ||
                purchaseSubscription.plan_lookup_key == PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY ||
                purchaseSubscription.plan_lookup_key == SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY ||
                purchaseSubscription.plan_lookup_key == SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY
            ) {
                currentPlanInterval = PLAN_YEAR_INTERVAL;
            }

            // Check if plan is expired
            if (currentDate > planEndDate) {
                planTypeName = PLAN_FOR_FREE;
                postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.free || 0;
            } else {
                // Calculate monthly reset date based on plan start date
                let nextResetDate = new Date(planStartDate);
                while (nextResetDate <= currentDate) {
                    nextResetDate.setMonth(nextResetDate.getMonth() + 1);
                }
                let previousResetDate = new Date(nextResetDate);
                previousResetDate.setMonth(previousResetDate.getMonth() - 1);

                // Set start date and end date for the current plan interval
                planStartDate = previousResetDate;
                planEndDate = nextResetDate;

                // Set plan type and post limit based on plan price id
                if (
                    purchaseSubscription.plan_price_id == SOCIAL_ONLY_59_PER_MONTH_ID ||
                    purchaseSubscription.plan_price_id == SOCIAL_ONLY_649_PER_ANNUALLY_ID
                ) {
                    planTypeName = PLAN_FOR_SOCIAL_ONLY;
                    postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.social_only || 0;
                }
                if (
                    purchaseSubscription.plan_price_id == SOCIAL_PLUS_99_PER_MONTH_ID ||
                    purchaseSubscription.plan_price_id == SOCIAL_PLUS_1089_PER_ANNUALLY_ID
                ) {
                    planTypeName = PLAN_FOR_SOCIAL_PLUS;
                    postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.social_plus || 0;
                }
                if (
                    purchaseSubscription.plan_price_id == PLAN_PRODUCT_PRICE_199_PREMIUM_ID ||
                    purchaseSubscription.plan_price_id == PRICE_2149_PREMIUM_YEARLY_ID
                ) {
                    planTypeName = PLAN_FOR_199_PREMIUM;
                    postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.premium || 0;
                }
                if (
                    purchaseSubscription.plan_price_id == PLAN_PRODUCT_PRICE_249_PREMIUM_ID ||
                    purchaseSubscription.plan_price_id == PRICE_2689_PREMIUM_PLUS_YEARLY_ID
                ) {
                    planTypeName = PLAN_FOR_249_PREMIUM_PLUS;
                    postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.premium_plus || 0;
                }
                if (purchaseSubscription.plan_price_id == PLAN_PRODUCT_PRICE_FREE_ID) {
                    planTypeName = PLAN_FOR_FREE;
                    postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.free || 0;
                }
            }
        } else {
            // Super admin allows access
            if (allowsAccessPlatformAdmin === PAYMENT_SUPER_ADMIN_PAID) {
                const givenDate = new Date(masterTurnOnDate);
                if (givenDate >= currentDate) {
                    planStartDate = new Date(allowsAccessPlatformInCreatedDate);
                    planEndDate = new Date(masterTurnOnDate);
                    planTypeName = PLAN_FOR_ALLOWS_ACCESS_PLATFORM_ADMIN;
                    postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.free || 0;
                }
            } else {
                planTypeName = PLAN_FOR_FREE;
                postLimit = LIMITS_PAYMNET_GATEWAY_CONFIG[activityType]?.free || 0;
            }
        }

        // Set up query conditions and collection based on activity type
        let commanConditions = { 'user_id': userId };
        let collectionTable = null;

        switch (activityType) {
            case ACTIVITY_SOCIAL_TYPE:
                commanConditions = {
                    'user_id': userId,
                    'is_manually': { $ne: true },
                    'signup_flag': { $ne: true },
                    'system_generate': { $ne: true },
                    'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA
                };
                collectionTable = db.collection(TABLE_AI_CAMPAIGN_CHAT);
                break;
            case ACTIVITY_EMAIL_CREATE_TYPE:
                commanConditions = {
                    'user_id': userId,
                    'ai_bot': true,
                    'system_generate': { $ne: true }
                };
                collectionTable = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
                break;
            case ACTIVITY_EMAIL_SEND_TYPE:
                commanConditions = {
                    'user_id': userId,
                    'is_sent': { $ne: NOT_SENT },
                    'system_generate': { $ne: true }
                };
                collectionTable = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
                break;
            case ACTIVITY_SEO_BLOG_TYPE:
                commanConditions = {
                    'user_id': userId,
                    'signup_flag': { $ne: true },
                    'type': AI_RESPONSE_TYPE_SEO,
                    'system_generate': { $ne: true }
                };
                collectionTable = db.collection(TABLE_AI_CAMPAIGN_CHAT);
                break;
            case ACTIVITY_POLL_CREATE_TYPE:
                commanConditions = {
                    'user_id': userId,
                    'type': POLL_AI_TYPE,
                    'system_generate': { $ne: true }
                };
                collectionTable = db.collection(TABLE_POLLS);
                break;
            case ACTIVITY_REWARD_CREATE_TYPE:
                commanConditions = {
                    'user_id': userId,
                    'type': REWARDS_AI_USER_ADD,
                    'system_generate': { $ne: true }
                };
                collectionTable = db.collection(TABLE_REWARDS);
                break;
            case ACTIVITY_CAMPAIGN_REACHOUT_TYPE:
                commanConditions = {
                    'user_id': userId,
                    "reachout_day": { $in: [REACHOUT_DAY1, REACHOUT_DAY2, REACHOUT_DAY3, REACHOUT_DAY4, REACHOUT_DAY5, REACHOUT_DAY6, REACHOUT_DAY7] }
                };
                collectionTable = db.collection(TABLE_AI_CAMPAIGN_LOGS);
                break;
            default:
                // fallback
                collectionTable = null;
        }

        // Add plan date range to query if available
        if (planStartDate && planEndDate) {
            commanConditions['created'] = {
                $gte: planStartDate,
                $lte: planEndDate
            };
        } else if (planStartDate) {
            commanConditions['created'] = { $gte: planStartDate };
        } else {
            delete commanConditions['created'];
        }

        // Add exclude trigger condition
        commanConditions['social_role_type'] = { $nin: EXCLUDE_LIMIT_TRIGGER };

        // Calculate final post limit including admin exceed
        let paidLimit = postLimit;
        postLimit = Number(postLimit + adminActivityTypeAccourdingExceedLimit);

        // Count user's existing items for the given conditions using async/await
        let socialPostCount = 0;
        if (collectionTable) {
            try {
                socialPostCount = await collectionTable.countDocuments(commanConditions);
            } catch (err) {
                // If error in count, treat as 0
                socialPostCount = 0;
            }
        }

        // Prepare and return the result
        if (socialPostCount < postLimit) {
            // Allow creation
            return {
                'status': ALLOW_CREATE_DATA,
                'plan_type_name': planTypeName,
                'current_plan_interval': currentPlanInterval,
                'paid_limit': paidLimit, // paid limit means system limit
                'admin_exceed_limit': adminActivityTypeAccourdingExceedLimit, // admin exceed limit
                'post_limit': postLimit, // total limit key
                'count': socialPostCount, // used limit key
                'current_limit_available': Number(postLimit - socialPostCount), // available limit
                'activity_type': activityType,
            };
        } else {
            // Not allowed to create more
            return {
                'status': NOT_ALLOW_CREATE_DATA,
                'current_plan_interval': currentPlanInterval,
                'plan_type_name': planTypeName,
                'paid_limit': paidLimit, // paid limit means system limit
                'admin_exceed_limit': adminActivityTypeAccourdingExceedLimit, // admin exceed limit
                'post_limit': postLimit, // total limit key
                'count': socialPostCount, // used limit key
                'current_limit_available': Number(postLimit - socialPostCount), // available limit
                'activity_type': activityType,
            };
        }
    } catch (error) {
        // Catch-all for unexpected errors
        return {
            'status': NOT_ALLOW_CREATE_DATA,
            'current_plan_interval': '',
            'plan_type_name': "",
            'count': 0,
            'post_limit': 0,
            'activity_type': activityType,
            'current_limit_available': 0
        };
    }
}; // End planAccourdingLimitAccessMiddleware();

/**
 * Check the status of a subscription plan and return the result.
 * 
 * @param {String} paymentSecretKey - The secret key for the payment gateway.
 * @param {String} subscriptionId - The ID of the subscription to check.
 * @returns {Object} An object containing the status of the request and the subscription details.
 */
checkSubscriptionPlanStatus = async (paymentSecretKey, subscriptionId) => {
    try {
        const stripe = require('stripe')(paymentSecretKey);
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.status === PAYMENT_PLAN_RETRIEVE_ACTIVE) {
            return { 'status': STATUS_SUCCESS, 'subscription_details': subscription };
        } else {
            return { 'status': STATUS_ERROR, 'subscription_details': subscription };
        }
    } catch (error) {
        return { 'status': STATUS_ERROR, 'subscription_details': {} };
    }
}; //End checkSubscriptionPlanStatus();



/**
 * Function to retrieve the available plan details for a user using async/await and Promise.all for parallel queries.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Object} optionsData - Object containing user details.
 * @returns {Promise} A promise that resolves with an object containing the status of the request and the plan details.
 */
availablePlanDetailsForUser = async (req, res, optionsData) => {
    try {
        const loginUserData = optionsData.user_details || "";

        if (!loginUserData) {
            // User details missing, return error
            return {
                'status': STATUS_ERROR,
                'result': {},
            };
        }

        // Prepare all plan queries in parallel for faster response
        const [
            socialPostLimit,
            pollLimit,
            emailCreateLimit,
            seoBlogLimit,
            rewardLimit,
            emailSendLimit,
            campaignReachoutSendLimit
        ] = await Promise.all([
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_SOCIAL_TYPE),
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_POLL_CREATE_TYPE),
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_EMAIL_CREATE_TYPE),
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_SEO_BLOG_TYPE),
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_REWARD_CREATE_TYPE),
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_EMAIL_SEND_TYPE),
            planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_CAMPAIGN_REACHOUT_TYPE)
        ]);

        // Build the final response object
        let finalLimitResponse = {
            'social_post': socialPostLimit || {},
            'poll': pollLimit || {},
            'email_create': emailCreateLimit || {},
            'seo_blog': seoBlogLimit || {},
            // 'reward': rewardLimit, // Uncomment if needed
            'email_send': emailSendLimit || {},
            'campaign_reachout': campaignReachoutSendLimit || {}
        };

        // If user is on free plan, remove email_send from response
        if (socialPostLimit && socialPostLimit.plan_type_name === PLAN_FOR_FREE) {
            delete finalLimitResponse.email_send;
        }

        // Return success response
        return {
            'status': STATUS_SUCCESS,
            'result': finalLimitResponse,
        };

    } catch (error) {
        // Catch-all for unexpected errors
        return {
            'status': STATUS_ERROR,
            'result': {},
        };
    }
}; // End availablePlanDetailsForUser


/**
 * Function to handle user plan purchases using async/await for all DB operations.
 * All queries are run in parallel where possible for faster response times.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {Object} options - Options object containing user plan purchase data.
 * 
 * @returns {Promise} A promise that resolves with an object containing the status of the request and a message.
 */
userPlanPurchase = async (req, res, options) => {
    // Extract and sanitize input options
    const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    let amount = options.amount ? Number(options.amount) : 0;
    const plan = options.plan || "";
    const planType = options.plan_type || "";
    const upiId = options.upi_id || "";
    const planPriceId = options.plan_price_id || "";
    const expiryDate = options.expiry_date || "";
    const chequeNumber = options.cheque_number || "";
    const paymentId = options.payment_id || "";
    const paymentMethod = options.payment_method || "";
    const planLookupKey = options.plan_lookup_key || "";
    let planEndDate = options.plan_end_date || "";
    const canceledAt = options.canceled_at || "";
    const cancellationReason = options.cancellation_reason || "";
    const customerId = options.customer_id || "";
    const customerEmail = options.customer_email || "";
    const customerName = options.customer_name || "";
    let invoiceId = options.invoice_id || "";
    const paymentStatus = options.payment_status || "";
    const subscriptionId = options.subscription_id || "";
    const subscriptionStatus = options.subscription_status || "";
    const planStatus = options.plan_status || PAYMENT_PLAN_ACTIVE;
    const otherDetails = options.other_details || {};
    const currency = options.currency || "";
    const billingDetails = options.billing_details || {};
    const isSetupIntent = options.is_setup_intent ? options.is_setup_intent : false;
    const promoCode = options.promo_code || "";
    const couponId = options.coupon_id || "";
    const couponUniqueApiId = options.coupon_unique_api_id || "";

    const billingEmail = (billingDetails && billingDetails.email) ? billingDetails.email : customerEmail;
    let currentPlanInterval = PLAN_MONTH_INTERVAL;

    const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);
    const usersCollection = db.collection(TABLE_USERS);

    const planStartDate = getUtcDate();

    // Calculate plan end date based on plan type
    if (!planEndDate) {
        const currentUTCDate = new Date(Date.now());
        if (planLookupKey === PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY || planLookupKey === PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY || planLookupKey === SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY || planLookupKey === SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY) {
            planEndDate = new Date(currentUTCDate);
            planEndDate.setUTCFullYear(currentUTCDate.getUTCFullYear() + 1);
        } else {
            planEndDate = new Date(currentUTCDate);
            planEndDate.setUTCMonth(currentUTCDate.getUTCMonth() + 1);
        }
    }

    // Set plan interval for yearly plans
    if (planLookupKey === PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY || planLookupKey === PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY || planLookupKey === SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY || planLookupKey === SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY) {
        currentPlanInterval = PLAN_YEAR_INTERVAL;
    }

    if (!userId) {
        // User ID not provided, return error
        return {
            status: STATUS_ERROR,
            message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
        };
    }

    try {
        // Prepare plan purchase data
        const planPurchesData = {
            user_id: userId,
            payment_id: paymentId,
            amount: amount,
            canceled_at: canceledAt,
            cancellation_reason: cancellationReason,
            currency: currency,
            customer: customerId,
            customer_email: customerEmail,
            customer_name: customerName,
            invoice: invoiceId,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            plan_lookup_key: planLookupKey,
            plan_name: plan,
            plan_type: planType,
            plan_price_id: planPriceId,
            subscription_id: subscriptionId,
            subscription_status: subscriptionStatus,
            upi_id: upiId,
            cheque_number: chequeNumber,
            super_admin_offline_expiry_date: expiryDate,
            plan_start_date: planStartDate,
            plan_end_date: planEndDate,
            plan_status: planStatus,
            current_plan_interval: currentPlanInterval,
            billing_details: billingDetails,
            is_setup_intent: JSON.parse(isSetupIntent),
            promo_code: promoCode,
            coupon_id: couponId,
            coupon_unique_api_id: couponUniqueApiId,
            other_details: otherDetails,
            created: getUtcDate(),
        };

        // Insert user plan purchase
        const insertResult = await planUserPurchaseCollection.insertOne(planPurchesData);

        if (insertResult && insertResult.insertedId) {
            const planPurchaseId = newObjectIdDefault(insertResult.insertedId);

            // Prepare update queries to run in parallel for better performance
            const updateOtherPlansPromise = planUserPurchaseCollection.updateMany(
                { _id: { $ne: planPurchaseId }, user_id: userId },
                { $set: { subscription_status: SUBSCRIPTION_DEACTIVE_STATUS, plan_status: PAYMENT_PLAN_DEACTIVE } }
            );

            const resetExceedLimitPromise = usersCollection.updateOne(
                { _id: userId },
                { $unset: { exceed_limit: 1 } }
            );

            // Only reset allow access limit if not admin plan
            let resetAllowAccessPromise = Promise.resolve();
            if (planLookupKey !== PLAN_FOR_ALLOWS_ACCESS_PLATFORM_ADMIN) {
                resetAllowAccessPromise = usersCollection.updateOne(
                    { _id: userId },
                    { $unset: { master_turn_on_date: 1, allows_access_platform_in_admin: 1, allows_access_platform_in_created_date: 1 } }
                );
            }

            // Run all update queries in parallel
            await Promise.all([
                updateOtherPlansPromise,
                resetExceedLimitPromise,
                resetAllowAccessPromise
            ]);

            invoiceId = invoiceId ? invoiceId : "N/A";
            amount = amount ? '$' + amount / 100 + ' USD' : amount;

            // // Optionally send email for plan purchase (uncomment if needed)
            // // let emailOptions = {
            // //     to: billingEmail,
            // //     action: "user_purchase_plan",
            // //     rep_array: [DEAR_HI_CONSTANT, customerName, invoiceId, plan, amount]
            // // };
            // // sendMail(req, res, emailOptions);

            // Return success response
            return {
                status: STATUS_SUCCESS,
                message: res.__("admin.user.offline_payment_has_been_added_successfully"),
            };
        } else {
            // Insert failed, send error response
            return {
                status: STATUS_ERROR,
                message: res.__("admin.system.something_going_wrong_please_try_again"),
            };
        }
    } catch (error) {
        // Catch and send error response
        return {
            status: STATUS_ERROR,
            message: res.__("admin.system.something_going_wrong_please_try_again"),
        };
    }
}; // End userPlanPurchase()



/**
 * Function to cancel a user's subscription plan using async/await for faster response times.
 * 
 * @param {Object} options - Options object containing user ID, cancellation reason, and canceled subscription details.
 * @returns {Promise} A promise that resolves when the cancellation is complete.
 */
userCancelSubscriptionsPlan = async (options) => {
    const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);

    let userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
    let cancelReason = options.cancellation_reason || "";
    let canceledSubscription = options.canceled_subscription || "";

    if (userId) {
        // Update the user's subscription plan to mark it as cancelled
        await planUserPurchaseCollection.updateOne(
            {
                'user_id': userId,
                'subscription_status': SUBSCRIPTION_ACTIVE_STATUS,
                'plan_status': PAYMENT_PLAN_ACTIVE,
            },
            {
                $set: {
                    'subscription_status': SUBSCRIPTION_DEACTIVE_STATUS,
                    'plan_status': PAYMENT_PLAN_DEACTIVE,
                    'cancellation_date': getUtcDate(),
                    'canceled_at': getUtcDate(),
                    'cancellation_reason': cancelReason,
                    'canceled_subscription': canceledSubscription,
                }
            }
        );
    }
    // Always resolve (no return value needed)
    return;
}; // End userCancelSubscriptionsPlan()


/**
 * Function to cancel a Stripe subscription plan using async/await for faster response times.
 * 
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {String} userId - User ID.
 * @param {String} subscriptionId - Subscription ID.
 * 
 * @returns {Promise} A promise that resolves with an object containing the status of the request and a message.
 */
cancelStripeSubscriptionPlan = async (req, res, userId, subscriptionId) => {
    const cancelCollection = db.collection(TABLE_CANCEL_SUBSCRIPTION);
    const planPurchesCollection = db.collection(TABLE_USER_PLAN_PURCHASE);
    const users = db.collection(TABLE_USERS);

    // Early return if subscriptionId is empty
    if (!subscriptionId) {
        return {
            status: STATUS_ERROR,
            message: res.__("system.something_going_wrong_please_try_again"),
            result: ""
        };
    }

    try {
        // Run plan purchase and user details queries in parallel for faster response
        const [planPurches, userDetails] = await Promise.all([
            planPurchesCollection.findOne({
                subscription_id: subscriptionId,
                user_id: newObjectIdDefault(userId),
                plan_status: PAYMENT_PLAN_ACTIVE
            }),
            users.findOne(
                { _id: newObjectIdDefault(userId) },
                { projection: { _id: 1, full_name: 1, email: 1 } }
            )
        ]);

        // Check if plan purchase exists
        if (planPurches && Object.keys(planPurches).length > 0) {
            // Log the cancellation in the cancel subscription collection
            await cancelCollection.insertOne({
                user_id: userId,
                created: getUtcDate(),
            });

            // Update user to turn off auto pay
            await users.updateOne(
                { _id: newObjectIdDefault(userId) },
                { $set: { auto_pay: PAYMENT_SUPER_ADMIN_AUTO_PAY_OFF, auto_pay_created: getUtcDate() } }
            );

            // Prepare and send cancellation email
            const userEmail = userDetails ? userDetails.email : "";
            const userName = userDetails ? userDetails.full_name : "";
            const emailOptions = {
                to: userEmail,
                action: "cancel_subscription",
                rep_array: [DEAR_HI_CONSTANT, userName]
            };
            sendMail(req, res, emailOptions);

            // Prepare and insert notification for cancellation
            const notificationMessageParams = [userName];
            const notificationOptions = {
                notification_data: {
                    notification_type: NOTIFICATION_SEND_CANCE_SUBSCRIPTION,
                    message_params: notificationMessageParams,
                    parent_table_id: userId,
                    user_id: userId,
                    user_ids: [userId],
                    user_role_id: FRONT_ADMIN_ROLE_ID,
                    role_id: FRONT_ADMIN_ROLE_ID,
                    extra_parameters: {
                        user_id: newObjectIdDefault(userId),
                        subscription_id: subscriptionId,
                    }
                }
            };
            insertNotifications(req, res, notificationOptions);

            // Return success response
            return {
                status: STATUS_SUCCESS,
                message: res.__("front.payment_gateway.subscription_has_been_cancelled_successfully"),
            };
        } else {
            // Plan does not exist
            return {
                status: STATUS_ERROR,
                message: res.__("front.payment_gateway.plan_does_not_exist"),
                result: ""
            };
        }
    } catch (error) {
        // Log the cancellation attempt even on error
        await cancelCollection.insertOne({
            user_id: userId,
            created: getUtcDate(),
        });

        // Return error response
        return {
            status: STATUS_ERROR,
            message: res.__("system.something_going_wrong_please_try_again"),
            result: ""
        };
    }
}; // End cancelStripeSubscriptionPlan();