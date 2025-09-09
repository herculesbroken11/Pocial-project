const async = require('async');

const paymentTransactionCollection = db.collection(TABLE_PAYMENT_TRANSACTION);
const planCollection = db.collection(TABLE_PLANS);
const customerAndSubscriptionLogs = db.collection(TABLE_CUSTOMER_AND_SUBSCRIPTION_LOGS);

function paymentGateway() {

    /**
     * Function to list home page plans using async/await for faster response.
     *
     * @return json 
     **/
    this.getHomePagePlansList = async (req, res) => {
        let finalResponse = {};

        // Get payment type symbol from settings
        let paymentTypeSymbal = res.locals.settings["Payment.payment_type_symbal"];

        try {
            // Prepare queries for monthly and yearly plans
            const monthlyPlanQuery = planCollection.find({
                "is_deleted": NOT_DELETED,
                "plan_type": { $in: [FREE_PLAN, MONTHLY_PLAN] },
                "status": ACTIVE
            }).sort({ "amount": SORT_ASC }).toArray();

            const yearlyPlanQuery = planCollection.find({
                "is_deleted": NOT_DELETED,
                "plan_type": { $in: [FREE_PLAN, YEARLY_PLAN] },
                "status": ACTIVE
            }).sort({ "amount": SORT_ASC }).toArray();

            // Run both queries in parallel for better performance
            const [monthlyPlan, yearlyPlan] = await Promise.all([monthlyPlanQuery, yearlyPlanQuery]);

            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'payment_type_symbal': paymentTypeSymbal,
                    'monthly_plan': monthlyPlan || [],
                    'yearly_plan': yearlyPlan || [],
                    'message': "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (err) {
            // Handle errors gracefully
            finalResponse = {
                'data': {
                    'status': STATUS_SUCCESS,
                    'payment_type_symbal': paymentTypeSymbal,
                    'monthly_plan': [],
                    'yearly_plan': [],
                    'message': res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getHomePagePlansList();

    /**
     * Function to get plans listing data using async/await for faster response.
     *
     * @return json 
     **/
    this.getPlansList = async (req, res) => {
        let finalResponse = {};

        // Get user id and settings
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const paymentPublishableKey = res.locals.settings["Payment.payment_publishable_key"];
        const paymentTypeSymbal = res.locals.settings["Payment.payment_type_symbal"];
        const contactSalesCustomQuotes = res.locals.settings["Payment.contact_sales_for_custom_quotes"];
        const monthYearToggle = req.body.month_year_toggle === true;
        const togglePlanLookupKey = monthYearToggle ? YEARLY_PLAN_PRODUCT_LOOKUP_KEY_ARRAY : PLAN_PRODUCT_LOOKUP_KEY_ARRAY;

        try {
            // Initialize Stripe with secret key
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);

            // Fetch Stripe prices with expanded product data
            const pricesPromise = stripe.prices.list({
                lookup_keys: togglePlanLookupKey,
                expand: ['data.product']
            });

            // Prepare DB query for current active plan in parallel
            const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);
            const userPlanPromise = planUserPurchaseCollection.findOne({
                user_id: userId,
                subscription_status: SUBSCRIPTION_ACTIVE_STATUS,
                plan_status: PAYMENT_PLAN_ACTIVE
            });

            // Run both queries in parallel for better performance
            const [prices, userPurchaseCurrentPlanDetails] = await Promise.all([pricesPromise, userPlanPromise]);

            // Sort prices by amount (ascending)
            let pricesData = Array.isArray(prices.data) ? prices.data : [];
            pricesData.sort((a, b) => a.unit_amount - b.unit_amount);

            // Add Free plan at the beginning
            pricesData.unshift({
                id: PLAN_PRODUCT_PRICE_FREE_ID,
                object: "price",
                active: true,
                billing_scheme: "per_unit",
                created: 1734598002,
                currency: "usd",
                custom_unit_amount: null,
                livemode: false,
                lookup_key: "free",
                metadata: {},
                nickname: "",
                product: {
                    description: PLAN_PRODUCT_PRICE_FREE_DESCRIPTION,
                    name: PLAN_PRODUCT_PRICE_FREE_NAME,
                    object: "product",
                },
                recurring: {},
                tax_behavior: "unspecified",
                tiers_mode: null,
                transform_quantity: null,
                type: "recurring",
                unit_amount: 0,
                unit_amount_decimal: "0"
            });

            // Set lookup keys for plan limits based on toggle
            let premiumLookupKey = monthYearToggle ? PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY : PLAN_PRODUCT_199_PREMIUM_LOOKUP_KEY;
            let premiumPlusLookupKey = monthYearToggle ? PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY : PLAN_PRODUCT_249_PREMIUM_PLUS_LOOKUP_KEY;
            let socialOnlyLookupKey = monthYearToggle ? SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY : SOCIAL_ONLY_59_PER_MONTH_LOOKUP_KEY;
            let socialPlusLookupKey = monthYearToggle ? SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY : SOCIAL_PLUS_99_PER_MONTH_LOOKUP_KEY;

            // Get current active plan id if exists
            let currentActivePlanId = "";
            if (userPurchaseCurrentPlanDetails && userPurchaseCurrentPlanDetails.plan_price_id) {
                currentActivePlanId = userPurchaseCurrentPlanDetails.plan_price_id;
            }

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    current_active_plan_id: currentActivePlanId,
                    payment_type_symbal: paymentTypeSymbal,
                    payment_publishable_key: paymentPublishableKey,
                    contact_sales_for_custom_email: contactSalesCustomQuotes,
                    plan_limit: {
                        free: LIMITS_BY_PLAN['free'],
                        [socialOnlyLookupKey]: LIMITS_BY_PLAN['social_only'],
                        [socialPlusLookupKey]: LIMITS_BY_PLAN['social_plus'],
                        [premiumLookupKey]: LIMITS_BY_PLAN['premium'],
                        [premiumPlusLookupKey]: LIMITS_BY_PLAN['premium_plus'],
                    },
                    result: pricesData,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors gracefully
            console.log(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getPlansList();

    /**
     * Function to select the free plan for a user.
     * Uses async/await for all database and update operations for faster response.
     *
     * @return json
     **/
    this.freePlanSelect = async (req, res) => {
        let finalResponse = {};

        // Extract user data and plan price id from request
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const email = loginUserData.email ? loginUserData.email : "";
        const alreadySubscriptionId = loginUserData.subscription_id ? loginUserData.subscription_id : "";
        const planPriceId = req.body.plan_price_id ? req.body.plan_price_id : "";

        // Validate required fields
        if (!userId || !planPriceId) {
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
            // If user has an active subscription, cancel it before activating free plan
            if (alreadySubscriptionId) {
                await cancelSubscription(req, res, alreadySubscriptionId);
            }

            // Prepare user update options for free plan
            const optionsData = {
                plan_price_id: planPriceId,
                free_plan: true,
                subscription_id: "",
                subscription_item_id: "",
                client_secret: "",
                free_plan_date: getUtcDate(),
                plan_purchase_date: getUtcDate(),
            };

            // Update user record for free plan selection
            await updateUserRecordsIdAccording(userId, optionsData);

            // Prepare plan purchase data for free plan
            const planPurchaseData = {
                user_id: userId,
                plan: PLAN_PRODUCT_PRICE_FREE_NAME,
                amount: DEACTIVE,
                plan_price_id: planPriceId,
                plan_lookup_key: PLAN_PRODUCT_PRICE_FREE_NAME,
                payment_method: PLAN_PRODUCT_PRICE_FREE_NAME,
                payment_status: PAYMENT_STATUS_SUCCEEDED,
                subscription_status: SUBSCRIPTION_ACTIVE_STATUS,
                plan_status: PAYMENT_PLAN_ACTIVE,
                currency: CURRENCY_USD,
                plan_type: PLAN_FOR_FREE
            };

            // Insert user plan purchase data (async/await for DB operation)
            await userPlanPurchase(req, res, planPurchaseData);

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.payment.your_free_plan_has_been_successfully_activated"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end freePlanSelect();

    /**
     * Function to handle plan selection after customer subscription creation.
     * Uses async/await for all DB and Stripe queries for faster response.
     *
     * @return json 
     **/
    this.planSelectAfterCustomerSubscriptionCreate = async (req, res) => {
        let finalResponse = {};

        // Extract user and plan details from request
        const loginUserData = req.user_data || {};
        const userId = loginUserData._id || "";
        const email = loginUserData.email || "";
        const fullName = loginUserData.full_name || "";
        let customerId = loginUserData.customer_id || "";

        const planPriceId = req.body.plan_price_id || "";
        const planObject = req.body.plan_object || {};
        const promoCode = req.body.promo_code || "";
        const planLookupKey = planObject.lookup_key || "";

        const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
        const stripe = require('stripe')(paymentSecretKey);

        if (!userId || !planPriceId) {
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
            // Step 1: Create Stripe customer if not already present
            if (!customerId) {
                const customer = await stripe.customers.create({
                    email: email,
                    name: fullName,
                });
                customerId = customer.id;

                // Update user record with new customer ID
                const optionsData = { customer_id: customerId };
                await updateUserRecordsIdAccording(userId, optionsData);
            }

            // Step 2: Handle promo code validation (if provided)
            let couponId = null;
            let couponUniqueApiId = null;
            if (promoCode) {
                // Find promo code in Stripe
                const promoList = await stripe.promotionCodes.list({
                    code: promoCode,
                    active: true,
                });

                if (!promoList.data.length) {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: res.__("front.promp_code.invalid_or_expired_promo_code"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }

                couponId = promoList.data[0].coupon.id;
                couponUniqueApiId = promoList.data[0].id;

                // Validate if promo code is applicable to the selected plan
                const metadata = promoList.data[0].coupon.metadata || {};
                if (!metadata.hasOwnProperty(planPriceId)) {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            message: res.__("front.promp_code.promo_code_is_not_valid_for_this_plan"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            }

            let subscriptionId = "";
            let clientSecret = "";
            let subscription = "";
            let isSetupIntent = false;

            // Step 3: Create subscription if not a free plan
            if (planPriceId !== PLAN_PRODUCT_PRICE_FREE_ID) {
                // Create subscription in Stripe
                subscription = await stripe.subscriptions.create({
                    customer: customerId,
                    items: [{ price: planPriceId }],
                    coupon: couponId || undefined,
                    payment_behavior: 'default_incomplete',
                    expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
                    payment_settings: {
                        save_default_payment_method: 'on_subscription'
                    }
                });

                // If payment intent exists, get client secret; otherwise, create setup intent for 100% off
                if (subscription.latest_invoice && subscription.latest_invoice.payment_intent) {
                    clientSecret = subscription.latest_invoice.payment_intent.client_secret;
                } else {
                    const setupIntent = await stripe.setupIntents.create({
                        customer: customerId,
                        usage: 'off_session'
                    });
                    clientSecret = setupIntent.client_secret;
                    isSetupIntent = true;
                }
                subscriptionId = subscription.id;
            }

            // Step 4: Insert or update customer and subscription logs using async/await
            await customerAndSubscriptionLogs.findOneAndUpdate(
                {
                    customer_id: customerId,
                    subscription_id: subscriptionId,
                },
                {
                    $set: {
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        user_id: userId,
                        customer_id: customerId,
                        subscription_id: subscriptionId,
                        client_secret: clientSecret,
                        plan_price_id: planPriceId,
                        plan_lookup_key: planLookupKey,
                        subscription: subscription,
                        plan: planObject,
                        created: getUtcDate(),
                    }
                },
                { upsert: true }
            );

            // Step 5: Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    client_secret: clientSecret,
                    is_setup_intent: isSetupIntent,
                    promo_code: promoCode,
                    coupon_id: couponId,
                    coupon_unique_api_id: couponUniqueApiId,
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            console.log(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

    /** Cancel subscription Data */
    const cancelSubscription = async (req, res, subscriptionId) => {
        try {
            let paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);
            await stripe.subscriptions.cancel(subscriptionId);
            return true;
        } catch (error) {
            return true;
        }
    };// end cancelSubscription();


    /** cancel old subscription  */
    const cancelOldSubscriptions = async (req, res, customerId, skipSubscriptionId) => {
        try {
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);

            // Step 1: Get all active subscriptions of the customer
            const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 100, // adjust if needed
            });

            if (!subscriptions.data.length) {
                // console.log('No active subscriptions found.');
                return true;
            }

            // Step 2: Sort by created date (latest first)
            const sortedSubs = subscriptions.data.sort((a, b) => b.created - a.created);

            // Step 3: Skip the given subscription and cancel the rest
            for (let i = 0; i < sortedSubs.length; i++) {
                const subscription = sortedSubs[i];
                // If the subscription ID is not the one we want to skip, cancel it
                if (subscription.id !== skipSubscriptionId) {
                    await stripe.subscriptions.cancel(subscription.id);
                    // console.log(`Cancelled subscription: ${subscription.id}`);
                } else {
                    // console.log(`Skipping cancellation for subscription: ${subscription.id}`);
                }
            }

            // console.log('Old subscriptions cancelled successfully, skipped the specified one');
            return true;
        } catch (error) {
            // console.error("Error cancelling old subscriptions:", error);
            // console.log('Failed to cancel subscriptions.');
            return false;
        }
    };


    /**
     * Function to verify payment after frontend payment.
     * Uses async/await for all DB and Stripe queries for faster response.
     * Runs independent queries in parallel where possible.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     */
    this.verifyPayment = async (req, res) => {
        req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
        let finalResponse = {};

        // Extract user and payment details from request
        const loginUserData = req.user_data || {};
        const userId = loginUserData._id || "";
        const email = loginUserData.email || "";
        const fullName = loginUserData.full_name || "";
        let customerId = loginUserData.customer_id || "";
        const alreadySubscriptionId = loginUserData.subscription_id || "";

        const paymentIntentId = req.body.payment_intent_id || "";
        const billingDetails = req.body.billing_details || {};
        const isSetupIntent = req.body.is_setup_intent ? JSON.parse(req.body.is_setup_intent) : false;
        const promoCode = req.body.promo_code || "";
        const couponId = req.body.coupon_id || "";
        const couponUniqueApiId = req.body.coupon_unique_api_id || "";

        if (!userId || !paymentIntentId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        // Prepare logs options for payment transaction
        let logsOptions = {
            user_id: userId,
            payment_status: "",
            plan_price_id: "",
            client_secret: "",
            subscription_id: "",
            customer_id: customerId,
            payment_intent_id: paymentIntentId,
            plan_lookup_key: "",
            payment_response: "",
            billing_details: billingDetails,
            promo_code: promoCode,
            coupon_id: couponId,
            coupon_unique_api_id: couponUniqueApiId,
        };

        try {
            // Get Stripe secret key and initialize Stripe
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);

            // Retrieve payment intent or setup intent from Stripe
            let paymentIntent;
            if (isSetupIntent) {
                paymentIntent = await stripe.setupIntents.retrieve(paymentIntentId);
            } else {
                paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            }

            // Only handle plan purchase locally if not on live server or if setup intent
            if (!LIVE_SERVER_UPLOAD || isSetupIntent) {
                // Get plan details by payment intent
                const paymentIntentOptions = {
                    payment_intent: paymentIntent,
                    is_setup_intent: isSetupIntent
                };
                const paymentDetails = await getPlanDetailsByPaymentIntent(req, res, paymentIntentOptions);
                const paymentPurchaseResult = paymentDetails.payment_details || {};

                // Prepare plan purchase data
                let planPurchaseData = {
                    user_id: userId,
                    payment_id: paymentPurchaseResult.payment_id || "",
                    amount: paymentPurchaseResult.amount || "",
                    currency: paymentPurchaseResult.currency || "",
                    customer_id: paymentPurchaseResult.customer_id || "",
                    customer_email: email || "",
                    customer_name: fullName || "",
                    invoice_id: paymentPurchaseResult.invoice_id || "",
                    payment_method: PAYMENT_TYPE_CARD,
                    payment_status: paymentPurchaseResult.payment_status || "",
                    subscription_id: paymentPurchaseResult.subscription_id || "",
                    plan_price_id: paymentPurchaseResult.plan_price_id || "",
                    plan: paymentPurchaseResult.plan_name || "",
                    plan_lookup_key: paymentPurchaseResult.plan_lookup_key || "",
                    subscription_status: paymentPurchaseResult.subscription_status || "",
                    plan_end_date: paymentPurchaseResult.plan_end_date || "",
                    plan_status: PAYMENT_PLAN_ACTIVE,
                    billing_details: billingDetails,
                    is_setup_intent: isSetupIntent,
                    promo_code: promoCode,
                    coupon_id: couponId,
                    coupon_unique_api_id: couponUniqueApiId,
                    other_details: paymentPurchaseResult.other_details || ""
                };

                // Set plan type based on lookup key
                if (paymentPurchaseResult.plan_lookup_key === PLAN_PRODUCT_199_PREMIUM_LOOKUP_KEY || paymentPurchaseResult.plan_lookup_key === PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY) {
                    planPurchaseData.plan_type = PLAN_FOR_199_PREMIUM;
                }
                if (paymentPurchaseResult.plan_lookup_key === PLAN_PRODUCT_249_PREMIUM_PLUS_LOOKUP_KEY || paymentPurchaseResult.plan_lookup_key === PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY) {
                    planPurchaseData.plan_type = PLAN_FOR_249_PREMIUM_PLUS;
                }
                if (paymentPurchaseResult.plan_lookup_key === SOCIAL_ONLY_59_PER_MONTH_LOOKUP_KEY || paymentPurchaseResult.plan_lookup_key === SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY) {
                    planPurchaseData.plan_type = PLAN_FOR_SOCIAL_ONLY;
                }
                if (paymentPurchaseResult.plan_lookup_key === SOCIAL_PLUS_99_PER_MONTH_LOOKUP_KEY || paymentPurchaseResult.plan_lookup_key === SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY) {
                    planPurchaseData.plan_type = PLAN_FOR_SOCIAL_PLUS;
                }

                // Insert user plan purchase data (await DB operation)
                await userPlanPurchase(req, res, planPurchaseData);
            }

            // Update customer's default payment method in Stripe
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentIntent.payment_method,
                },
                metadata: {
                    billing_email: (billingDetails && billingDetails.email) ? billingDetails.email : email,
                }
            });

            // Cancel previous subscription if exists (await Stripe operation)
            if (alreadySubscriptionId) {
                await cancelSubscription(req, res, alreadySubscriptionId);
            }

            // Get latest subscription log for the user (await DB query)
            // This is a single query, but could be run in parallel with other independent queries if needed
            let latestSubscriptionArr = await customerAndSubscriptionLogs
                .find({ user_id: newObjectIdDefault(userId) })
                .sort({ created: SORT_DESC })
                .toArray();

            if (latestSubscriptionArr.length > 0) {
                const latestSubscription = latestSubscriptionArr[0];

                const subscriptionId = latestSubscription.subscription_id || "";
                const subscriptionItemId = (latestSubscription.subscription && latestSubscription.subscription.items) ? latestSubscription.subscription.items.data[0].id : "";
                const clientSecret = latestSubscription.client_secret || "";
                const planLookupKey = (latestSubscription.plan && latestSubscription.plan.lookup_key) ? latestSubscription.plan.lookup_key : "";
                const planPriceId = latestSubscription.plan_price_id || "";

                // Save payment transaction logs (await DB operation)
                logsOptions.payment_status = paymentIntent.status;
                logsOptions.payment_response = paymentIntent;
                logsOptions.plan_price_id = planPriceId;
                logsOptions.client_secret = clientSecret;
                logsOptions.subscription_id = subscriptionId;
                logsOptions.plan_lookup_key = planLookupKey;
                await savePaymentTransactionLogs(req, res, logsOptions);

                // Update user table for latest plan (await DB operation)
                const optionsUserData = {
                    plan_purchase_date: getUtcDate(),
                    customer_id: customerId,
                    subscription_id: subscriptionId,
                    subscription_item_id: subscriptionItemId,
                    client_secret: clientSecret,
                    plan_lookup_key: planLookupKey,
                    plan_price_id: planPriceId
                };
                await updateUserRecordsIdAccording(userId, optionsUserData);

                // Cancel all old subscriptions except the latest one (await Stripe operation)
                await cancelOldSubscriptions(req, res, customerId, subscriptionId);
            }

            // Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    message: res.__("front.payment.this_plan_has_beed_purchased"),
                    result: paymentIntent,
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            console.log(error);

            // Save failed payment transaction logs (await DB operation)
            logsOptions.payment_status = PAYMENT_STRIPE_NOT_SUCCEEDED_STATUS;
            logsOptions.payment_response = error;
            await savePaymentTransactionLogs(req, res, logsOptions);

            // Send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end verifyPayment();

    /**
     * Async function to save Payment Transaction logs.
     * Uses async/await for DB operations for faster response.
     * @param {*} req 
     * @param {*} res 
     * @param {*} responseData 
     * @returns {Promise<void>}
     */
    const savePaymentTransactionLogs = async (req, res, responseData) => {
        // Prepare all fields for the transaction log
        const userId = responseData.user_id ? newObjectIdDefault(responseData.user_id) : "";
        const paymentStatus = responseData.payment_status || "";
        const planPriceId = responseData.plan_price_id || "";
        const clientSecret = responseData.client_secret || "";
        const subscriptionId = responseData.subscription_id || "";
        const customerId = responseData.customer_id || "";
        const paymentIntentId = responseData.payment_intent_id || "";
        const paymentResponse = responseData.payment_response || "";
        const planLookupKey = responseData.plan_lookup_key || "";
        const billingDetails = responseData.billing_details || {};

        // Upsert (insert or update) the payment transaction log
        await paymentTransactionCollection.updateOne(
            { 'payment_intent_id': paymentIntentId },
            {
                $set: {
                    'modified': getUtcDate()
                },
                $setOnInsert: {
                    'user_id': userId,
                    'status': paymentStatus,
                    'plan_price_id': planPriceId,
                    'client_secret': clientSecret,
                    'subscription_id': subscriptionId,
                    'customer_id': customerId,
                    'payment_intent_id': paymentIntentId,
                    'plan_lookup_key': planLookupKey,
                    'payment_response': paymentResponse,
                    'billing_details': billingDetails,
                    'created': getUtcDate(),
                }
            },
            { upsert: true }
        );
    }; // end savePaymentTransactionLogs();

    /**
     * Async function to check subscription plan status for a user.
     * Uses async/await for all DB and Stripe queries for faster response.
     * Handles all queries in parallel where possible.
     * @param {*} req 
     * @param {*} res 
     * @returns {Promise<void>}
     */
    this.checkSubscriptionsPlan = async (req, res) => {
        let finalResponse = {};

        // Extract user data
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const allowsAccessPlatformAdmin = loginUserData.allows_access_platform_in_admin || PAYMENT_SUPER_ADMIN_UNPAID;
        const userCreated = loginUserData.created || "";
        const masterTurnOnDate = loginUserData.master_turn_on_date || "";
        const subscriptionId = loginUserData.subscription_id || "";
        const freePlan = loginUserData.free_plan || false;

        const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];

        if (!userId) {
            // User not allowed, send error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    paid: PAYMENT_STRIPE_NOT_SUCCEEDED_STATUS,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Check if user is within free plan period or has free plan
            const userCreatedDaysPromise = Promise.resolve(checkWithinGivenDays(userCreated, FREE_PLAN_DAY));
            const isSuperAdminPaid = allowsAccessPlatformAdmin === PAYMENT_SUPER_ADMIN_PAID;
            let superAdminDateCheckPromise = Promise.resolve(false);

            // If super admin, check master turn on date in parallel
            if (isSuperAdminPaid) {
                superAdminDateCheckPromise = Promise.resolve(new Date(masterTurnOnDate) >= new Date());
            }

            // Run both checks in parallel
            const [userCreatedDays, isSuperAdminDateValid] = await Promise.all([
                userCreatedDaysPromise,
                superAdminDateCheckPromise
            ]);

            if (userCreatedDays || freePlan) {
                // User is within free plan period or has free plan
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        paid: PAYMENT_STRIPE_SUCCEEDED_STATUS,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            if (isSuperAdminPaid && isSuperAdminDateValid) {
                // Super admin with valid master turn on date
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        paid: PAYMENT_STRIPE_SUCCEEDED_STATUS,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            if (subscriptionId) {
                // Check subscription status with Stripe
                // This is a single awaited query
                const subscriptionStatus = await checkSubscriptionPlanStatus(paymentSecretKey, subscriptionId);

                if (subscriptionStatus.status === STATUS_SUCCESS) {
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            paid: PAYMENT_STRIPE_SUCCEEDED_STATUS,
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } else {
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            paid: PAYMENT_STRIPE_NOT_SUCCEEDED_STATUS,
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                // No subscription, send error response
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        paid: PAYMENT_STRIPE_NOT_SUCCEEDED_STATUS,
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    paid: PAYMENT_STRIPE_NOT_SUCCEEDED_STATUS,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end checkSubscriptionsPlan();

    /**
     * Function to cancel a user's subscription plan.
     * Uses async/await for all DB and Stripe queries for faster response.
     * Runs independent queries in parallel where possible.
     */
    this.cancelUserSubscriptionsPlan = async (req, res) => {
        let finalResponse = {};

        // Extract user and request details
        const loginUserData = req.user_data || {};
        const userId = loginUserData._id || "";
        const email = loginUserData.email || "";
        const subscriptionId = req.body.subscription_id || "";
        const cancelReason = req.body.cancel_reason || "";
        const planTransactionId = req.body.plan_transaction_id || "";

        const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);

        // Validate required fields
        if (!userId || !cancelReason || !planTransactionId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: "",
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Get plan purchase details (await DB query)
            const planPurchaseDetails = await planUserPurchaseCollection.findOne({ "_id": newObjectIdDefault(planTransactionId) });
            const planEndDate = (planPurchaseDetails && planPurchaseDetails.plan_end_date) ? planPurchaseDetails.plan_end_date : "";
            const currentDate = new Date();

            // If no Stripe subscription, handle local cancellation only
            if (!subscriptionId) {
                // Cancel customer plan in user table (await DB operation)
                const cancelOptions = {
                    user_id: userId,
                    cancellation_reason: cancelReason
                };
                await userCancelSubscriptionsPlan(cancelOptions);

                // If plan expiry date is in the future, update plan status (await DB operation)
                if (new Date(planEndDate) > currentDate) {
                    await planUserPurchaseCollection.updateOne(
                        {
                            user_id: newObjectIdDefault(userId),
                            _id: newObjectIdDefault(planTransactionId),
                        },
                        {
                            $set: {
                                subscription_status: SUBSCRIPTION_ACTIVE_STATUS,
                                plan_status: PAYMENT_PLAN_ACTIVE,
                                cancellation_date: getUtcDate(),
                                cancellation_reason: cancelReason,
                            }
                        }
                    );
                }

                // Send success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        message: res.__("front.payment_gateway.subscription_canceled_at_the_end_of_the_current_billing_period"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Stripe subscription cancellation flow
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);

            // Step 1: Retrieve the subscription from Stripe (await Stripe API)
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);

            // Step 2: Check if the subscription is already canceled or pending cancellation
            if (subscription.cancel_at_period_end) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: subscription,
                        message: res.__("front.payment_gateway.subscription_already_pending_cancellation"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            if (subscription.status === 'canceled') {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: subscription,
                        message: res.__("front.payment_gateway.subscription_already_canceled"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Step 3: Cancel the subscription at the end of the current billing period
            if (subscription.status === 'active') {
                try {
                    // Update metadata with cancellation reason
                    const updatedMetadata = {
                        ...subscription.metadata,
                        cancellation_reason: cancelReason,
                    };

                    // Cancel the subscription at period end (await Stripe API)
                    const canceledSubscription = await stripe.subscriptions.update(subscriptionId, {
                        cancel_at_period_end: true,
                        metadata: updatedMetadata,
                    });

                    // Prepare parallel DB updates
                    const userUpdatePromise = updateUserRecordsIdAccording(userId, {
                        cancellation_date: getUtcDate(),
                    });

                    const cancelOptions = {
                        user_id: userId,
                        cancellation_reason: cancelReason,
                        canceled_subscription: canceledSubscription
                    };
                    const userCancelPromise = userCancelSubscriptionsPlan(cancelOptions);

                    // If plan expiry date is in the future, update plan status (await DB operation)
                    let planStatusPromise = Promise.resolve();
                    if (new Date(planEndDate) > currentDate) {
                        planStatusPromise = planUserPurchaseCollection.updateOne(
                            {
                                user_id: newObjectIdDefault(userId),
                                _id: newObjectIdDefault(planTransactionId),
                            },
                            {
                                $set: {
                                    subscription_status: SUBSCRIPTION_ACTIVE_STATUS,
                                    plan_status: PAYMENT_PLAN_ACTIVE,
                                    cancellation_date: getUtcDate(),
                                    cancellation_reason: cancelReason,
                                }
                            }
                        );
                    }

                    // Run all DB updates in parallel for faster response
                    await Promise.all([userUpdatePromise, userCancelPromise, planStatusPromise]);

                    // Send success response
                    finalResponse = {
                        data: {
                            status: STATUS_SUCCESS,
                            result: canceledSubscription,
                            message: res.__("front.payment_gateway.subscription_canceled_at_the_end_of_the_current_billing_period"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                } catch (error) {
                    console.log(error);
                    finalResponse = {
                        data: {
                            status: STATUS_ERROR,
                            result: "",
                            message: res.__("front.system.something_going_wrong_please_try_again"),
                        }
                    };
                    return returnApiResult(req, res, finalResponse);
                }
            } else {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: "",
                        message: res.__("front.payment_gateway.this_plan_already_cancelled"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            console.log(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.payment_gateway.subscription_not_available"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end cancelUserSubscriptionsPlan();

    /**
     * Function to get Payment Intents customer transaction list with subscription details.
     * Uses async/await for all Stripe queries for faster response.
     * Runs independent queries in parallel where possible.
     */
    this.paymentIntentsCustomerTransaction = async (req, res) => {
        let finalResponse = {};

        // Extract user and customer IDs
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";
        const customerId = loginUserData.customer_id ? loginUserData.customer_id : "";
        const limit = API_DEFAULT_LIMIT;
        const previousPageLastPaymentintentId = req.body.previous_page_last_paymentintent_id ? req.body.previous_page_last_paymentintent_id : "";

        // Get plan-based access limits
        const postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_REWARD_CREATE_TYPE);

        // If user or customer ID is missing, handle accordingly
        if (!userId || !customerId) {
            if (!customerId) {
                // If customerId is missing, return empty paymentIntents with success
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        default_timezone: req.body.default_timezone,
                        current_plan: postLimitData,
                        paymentIntents: [],
                        message: ""
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // If userId is missing, return error
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: "",
                        message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        }

        try {
            // Get Stripe secret key and initialize Stripe
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);

            // Step 1: List all Payment Intents for the customer
            const paymentIntents = await stripe.paymentIntents.list({
                customer: customerId,
                limit: limit,
                ...(previousPageLastPaymentintentId && { starting_after: previousPageLastPaymentintentId }),
            });

            // Step 2: Fetch and append subscription details for each payment intent in parallel
            const paymentIntentsWithSubscriptions = await Promise.all(
                paymentIntents.data.map(async (paymentIntent) => {
                    // If payment intent has an invoice, fetch invoice and subscription details
                    if (paymentIntent.invoice) {
                        // Fetch invoice (await Stripe query)
                        const invoice = await stripe.invoices.retrieve(paymentIntent.invoice);

                        // If invoice has a subscription, fetch subscription details (await Stripe query)
                        if (invoice.subscription) {
                            const subscription = await stripe.subscriptions.retrieve(invoice.subscription);

                            // Return payment intent with subscription details
                            return {
                                ...paymentIntent,
                                subscription: {
                                    id: subscription.id,
                                    plan: subscription.plan.nickname || subscription.plan.id,
                                    status: subscription.status,
                                    start_date: new Date(subscription.start_date * 1000),
                                    current_period_end: new Date(subscription.current_period_end * 1000),
                                    cancel_at_period_end: subscription.cancel_at_period_end,
                                    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : '',
                                    cancellation_reason: subscription.metadata.cancellation_reason || '',
                                }
                            };
                        }
                    }
                    // If no subscription, return payment intent as is
                    return paymentIntent;
                })
            );

            // Send success response with payment intents and subscription details
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    default_timezone: req.body.default_timezone,
                    current_plan: postLimitData,
                    has_more: paymentIntents.has_more ? paymentIntents.has_more : false,
                    url: paymentIntents.url ? paymentIntents.url : "",
                    object: paymentIntents.object ? paymentIntents.object : "",
                    paymentIntents: paymentIntentsWithSubscriptions,
                    message: ""
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors gracefully
            console.log(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    default_timezone: req.body.default_timezone,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end paymentIntentsCustomerTransaction();

    /**
     * Function to get the user's payment intents customer transaction list (new version).
     * Uses async/await for all DB queries for faster response.
     * Runs independent queries in parallel using Promise.all.
     */
    this.paymentIntentsCustomerTransactionNew = async (req, res) => {
        let finalResponse = {};

        // Get user data and userId
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? loginUserData._id : "";

        // Pagination parameters
        const page = req.body.page ? parseInt(req.body.page) : 1;
        const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
        const skip = (limit * page) - limit;

        // Get current plan access limits
        const postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_REWARD_CREATE_TYPE);
        const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);

        // If user is not authenticated, return error
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

        // Build query condition
        const condition = {
            user_id: newObjectIdDefault(userId)
        };

        try {
            // Run both queries in parallel for better performance
            const [purchasePlanList, totalRecords] = await Promise.all([
                // Get paginated purchase plan list (excluding 'other_details')
                planUserPurchaseCollection
                    .find(condition, { projection: { other_details: 0 } })
                    .sort({ created: SORT_DESC })
                    .limit(limit)
                    .skip(skip)
                    .toArray(),
                // Count total purchase plans
                planUserPurchaseCollection.countDocuments(condition)
            ]);

            // Success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    result: purchasePlanList,
                    recordsTotal: totalRecords,
                    current_plan: postLimitData,
                    limit: limit,
                    page: page,
                    total_page: Math.ceil(totalRecords / limit),
                    default_timezone: req.body.default_timezone,
                    message: "",
                }
            };
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Error response
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: [],
                    recordsTotal: 0,
                    current_plan: postLimitData,
                    limit: 0,
                    page: 0,
                    total_page: 0,
                    default_timezone: req.body.default_timezone,
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end paymentIntentsCustomerTransactionNew();

    /**
     * Async function to get available plans details for the user.
     * Uses async/await for all DB and service queries for faster response.
     * Handles all queries in parallel where possible.
     */
    this.getAvailablePlanDetails = async (req, res) => {
        let finalResponse = {};
        // Extract login user data
        const loginUserData = req.user_data ? req.user_data : "";

        if (!loginUserData) {
            // Send error response if user is not logged in
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
            // Prepare options for available plan details query
            const optionsData = {
                user_details: loginUserData
            };

            // Await the available plan details for user (single awaited query)
            const responseAvailablePlan = await availablePlanDetailsForUser(req, res, optionsData);

            if (responseAvailablePlan.status === STATUS_SUCCESS) {
                // Success response
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        result: responseAvailablePlan.result,
                        message: "",
                    }
                };
            } else {
                // Error response if no records found
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: {},
                        message: res.__("front.global.no_record_found"),
                    }
                };
            }
            return returnApiResult(req, res, finalResponse);
        } catch (error) {
            // Handle errors gracefully
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    result: {},
                    message: res.__("front.global.no_record_found"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end getAvailablePlanDetails();

    /**
     * Async function to generate a direct Payment Client Secret Key.
     * Uses async/await for all Stripe queries for faster response.
     * All queries are awaited in sequence as they depend on each other.
     * @param {*} req 
     * @param {*} res 
     * @returns {Promise<void>}
     */
    this.directPaymentClientSecretKey = async (req, res) => {
        let finalResponse = {};

        // Extract plan price ID from request body
        const planPriceId = req.body.plan_price_id ? req.body.plan_price_id : "";
        const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
        const stripe = require('stripe')(paymentSecretKey);

        // Validate required field
        if (!planPriceId) {
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
            // Step 1: Retrieve price details from Stripe (awaited query)
            const price = await stripe.prices.retrieve(planPriceId);

            // Step 2: Create PaymentIntent using price details (awaited query)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price.unit_amount, // Use amount from price object
                currency: price.currency,  // Use currency from price object
                automatic_payment_methods: { enabled: true },
            });

            // Step 3: Send success response with client secret
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    client_secret: paymentIntent.client_secret
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            // Log and handle errors gracefully
            console.log(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    }; // end directPaymentClientSecretKey();

    /**
     * Async function to get plan details by paymentIntent or SetupIntent.
     * Uses async/await for all Stripe queries for faster response.
     * Runs independent queries in parallel where possible.
     *
     * @returns {Promise<object>} JSON with status and payment_details
     */
    getPlanDetailsByPaymentIntent = async (req, res, options) => {
        let paymentIntent = options.payment_intent || "";
        let isSetupIntent = options.is_setup_intent || false;

        let paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
        const stripe = require('stripe')(paymentSecretKey);

        try {
            // If this is a PaymentIntent flow with an invoice
            if (paymentIntent && paymentIntent.invoice) {
                // Retrieve invoice and subscription in parallel
                const invoice = await stripe.invoices.retrieve(paymentIntent.invoice);

                if (invoice.subscription) {
                    // Retrieve subscription and product in parallel for faster response
                    const subscriptionPromise = stripe.subscriptions.retrieve(invoice.subscription);
                    // We'll need the subscription to get the product id
                    const subscription = await subscriptionPromise;

                    // Get the product id from the first subscription item
                    const productId = subscription.items.data[0]?.price.product;
                    // Retrieve product in parallel with no other dependent queries
                    const productPromise = stripe.products.retrieve(productId);

                    // Await product retrieval
                    const product = await productPromise;

                    // Build the paymentIntentWithSubscription object
                    const paymentIntentWithSubscription = {
                        ...paymentIntent,
                        subscription: {
                            id: subscription.id,
                            plan_price_id: subscription.plan.id,
                            plan_name: product.name || '',
                            lookup_key: subscription.items.data[0]?.price.lookup_key || '',
                            status: subscription.status,
                            current_period_end: new Date(subscription.current_period_end * 1000),
                            canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : '',
                            cancellation_reason: subscription.metadata?.cancellation_reason || '',
                        }
                    };
                    let subscriptionDetails = paymentIntentWithSubscription.subscription || {};

                    return {
                        status: STATUS_SUCCESS,
                        payment_details: {
                            payment_id: paymentIntentWithSubscription.id,
                            amount: paymentIntentWithSubscription.amount,
                            canceled_at: paymentIntentWithSubscription.canceled_at,
                            cancellation_reason: paymentIntentWithSubscription.cancellation_reason,
                            currency: paymentIntentWithSubscription.currency,
                            customer_id: paymentIntentWithSubscription.customer,
                            invoice_id: paymentIntentWithSubscription.invoice,
                            payment_status: paymentIntentWithSubscription.status,
                            subscription_id: subscriptionDetails.id || "",
                            plan_price_id: subscriptionDetails.plan_price_id || "",
                            plan_name: subscriptionDetails.plan_name || "",
                            plan_lookup_key: subscriptionDetails.lookup_key || "",
                            subscription_status: subscriptionDetails.status || "",
                            plan_end_date: subscriptionDetails.current_period_end || "",
                            other_details: paymentIntentWithSubscription
                        }
                    };
                }
            }

            // If this is a SetupIntent flow
            if (isSetupIntent && paymentIntent) {
                // Retrieve setupIntent and get customerId
                const setupIntent = await stripe.setupIntents.retrieve(paymentIntent.id);
                const customerId = setupIntent.customer;

                // Retrieve active subscriptions for the customer (limit 1)
                const subscriptions = await stripe.subscriptions.list({
                    customer: customerId,
                    status: 'active',
                    limit: 1,
                });

                if (subscriptions.data.length > 0) {
                    const sub = subscriptions.data[0];
                    // Retrieve product in parallel
                    const productId = sub.items.data[0]?.price.product;
                    const product = await stripe.products.retrieve(productId);

                    return {
                        status: STATUS_SUCCESS,
                        payment_details: {
                            payment_id: setupIntent.id,
                            amount: 0, // 100% free
                            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : '',
                            cancellation_reason: sub.metadata?.cancellation_reason || '',
                            currency: sub.currency,
                            customer_id: customerId,
                            invoice_id: '', // N/A
                            payment_status: setupIntent.status,
                            subscription_id: sub.id,
                            plan_price_id: sub.plan.id || '',
                            plan_name: product.name || '',
                            plan_lookup_key: sub.items.data[0]?.price.lookup_key || '',
                            subscription_status: sub.status || '',
                            plan_end_date: new Date(sub.current_period_end * 1000),
                            other_details: setupIntent
                        }
                    };
                }
            }

            // If no valid details found, return error object
            return {
                status: STATUS_ERROR,
                payment_details: {
                    payment_id: "",
                    amount: "",
                    canceled_at: "",
                    cancellation_reason: "",
                    currency: "",
                    customer_id: "",
                    invoice_id: "",
                    payment_method: "",
                    payment_status: "",
                    subscription_id: "",
                    plan_price_id: "",
                    subscription_status: "",
                    plan_start_date: "",
                    plan_end_date: "",
                    other_details: ""
                }
            };
        } catch (err) {
            console.error('Stripe Error:', err.message);
            return {
                status: STATUS_ERROR,
                message: err.message,
                payment_details: {}
            };
        }
    };

    /**
     * Stripe webhook handler for payment events.
     * Uses async/await for all Stripe and DB queries for faster response.
     * Handles parallel queries where possible.
     */
    this.stripePaymentWebhook = async (req, res) => {
        try {
            // Retrieve Stripe secret key and initialize Stripe
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);
            const sig = req.headers['stripe-signature'];
            let event;

            // Reference to the users collection
            const users = db.collection(TABLE_USERS);

            // Verify the webhook signature
            try {
                const jsonBody = req.body;
                event = stripe.webhooks.constructEvent(jsonBody, sig, STRIPE_WEBHOOK_SECRET);
            } catch (err) {
                console.error(`Webhook signature verification failed: ${err.message}`);
                return res.status(400).send(`Webhook Error: ${err.message}`);
            }

            // Extract payment details from event
            const paymentObject = event.data.object || {};
            const invoiceId = paymentObject?.id || "";
            const subscriptionId = paymentObject?.subscription || "";
            const paymentIntentId = paymentObject?.payment_intent || "";
            const customerId = paymentObject?.customer || "";
            const amount = paymentObject?.amount_paid || "";
            const currency = paymentObject?.currency || "";
            const customerEmail = paymentObject?.customer_email || "";
            const customerName = paymentObject?.customer_name || "";

            let planEndDate = null;
            let subscriptionDetails = {};
            let planPurchaseData = {};
            let subscriptionPlanId = "";

            let promoCode = "";
            let couponId = "";
            let couponUniqueApiId = "";

            // Prepare parallel queries for discount and subscription details
            let discount = paymentObject?.discount || null;
            let promoListPromise = null;
            let subscriptionDetailsPromise = null;

            if (discount && discount.coupon) {
                promoCode = discount.coupon.name || "";
                // Query promotion codes in parallel
                promoListPromise = stripe.promotionCodes.list({
                    code: promoCode,
                    active: true,
                });
            }

            if (subscriptionId) {
                // Query subscription details in parallel
                subscriptionDetailsPromise = stripe.subscriptions.retrieve(subscriptionId);
            }

            // Fetch user details in parallel
            const userDetailsPromise = users.findOne(
                { "customer_id": customerId },
                { projection: { _id: 1 } }
            );

            // Await all parallel queries
            let promoList = null;
            if (promoListPromise) {
                try {
                    promoList = await promoListPromise;
                    if (promoList && promoList.data && promoList.data.length > 0) {
                        const couponData = promoList.data[0].coupon || {};
                        couponId = couponData.id;
                        couponUniqueApiId = promoList.data[0].id;
                    }
                } catch (err) {
                    console.error(`Error fetching promotion codes: ${err.message}`);
                }
            }

            if (subscriptionDetailsPromise) {
                try {
                    subscriptionDetails = await subscriptionDetailsPromise;
                    planEndDate = subscriptionDetails?.current_period_end
                        ? new Date(subscriptionDetails.current_period_end * 1000)
                        : null;
                    subscriptionPlanId = subscriptionDetails.plan?.id || "";
                } catch (error) {
                    console.error(`Error fetching subscription details: ${error.message}`);
                }
            }

            let userDetails = null;
            try {
                userDetails = await userDetailsPromise;
            } catch (err) {
                console.error(`Error fetching user details: ${err.message}`);
            }
            const userId = userDetails?._id || "";

            // Only proceed if invoice, customer, and payment intent are present
            if (invoiceId && customerId && paymentIntentId) {
                // Prepare plan purchase data
                planPurchaseData = {
                    user_id: userId,
                    payment_id: paymentIntentId,
                    amount: amount || "",
                    currency: currency || "",
                    customer_id: customerId || "",
                    customer_email: customerEmail || "",
                    customer_name: customerName || "",
                    invoice_id: invoiceId,
                    payment_method: PAYMENT_TYPE_CARD,
                    subscription_id: subscriptionId,
                    payment_status: PAYMENT_STATUS_SUCCEEDED,
                    subscription_status: SUBSCRIPTION_ACTIVE_STATUS,
                    plan_status: PAYMENT_PLAN_ACTIVE,
                    plan_end_date: planEndDate,
                    promo_code: promoCode,
                    coupon_id: couponId,
                    coupon_unique_api_id: couponUniqueApiId,
                };

                // Set plan type and lookup key based on subscription plan id or amount
                if (subscriptionPlanId == PLAN_PRODUCT_PRICE_199_PREMIUM_ID || amount == 19900) {
                    planPurchaseData.plan_type = PLAN_FOR_199_PREMIUM;
                    planPurchaseData.plan_price_id = PLAN_PRODUCT_PRICE_199_PREMIUM_ID;
                    planPurchaseData.plan = PLAN_PRODUCT_PRICE_PREMIUM;
                    planPurchaseData.plan_lookup_key = PLAN_PRODUCT_199_PREMIUM_LOOKUP_KEY;

                } else if (subscriptionPlanId == PLAN_PRODUCT_PRICE_249_PREMIUM_ID || amount == 24900) {
                    planPurchaseData.plan_type = PLAN_FOR_249_PREMIUM_PLUS;
                    planPurchaseData.plan_price_id = PLAN_PRODUCT_PRICE_249_PREMIUM_ID;
                    planPurchaseData.plan = PLAN_PRODUCT_PRICE_PREMIUM_PLUS;
                    planPurchaseData.plan_lookup_key = PLAN_PRODUCT_249_PREMIUM_PLUS_LOOKUP_KEY;
                }

                // Yearly plans
                if (subscriptionPlanId == PRICE_2149_PREMIUM_YEARLY_ID) {
                    planPurchaseData.plan_type = PLAN_FOR_199_PREMIUM;
                    planPurchaseData.plan_price_id = PRICE_2149_PREMIUM_YEARLY_ID;
                    planPurchaseData.plan = PLAN_PRODUCT_PRICE_PREMIUM;
                    planPurchaseData.plan_lookup_key = PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY;
                }
                if (subscriptionPlanId == PRICE_2689_PREMIUM_PLUS_YEARLY_ID) {
                    planPurchaseData.plan_type = PLAN_FOR_249_PREMIUM_PLUS;
                    planPurchaseData.plan_price_id = PRICE_2689_PREMIUM_PLUS_YEARLY_ID;
                    planPurchaseData.plan = PLAN_PRODUCT_PRICE_PREMIUM;
                    planPurchaseData.plan_lookup_key = PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY;
                }

                // Social only monthly/yearly
                if (subscriptionPlanId == SOCIAL_ONLY_59_PER_MONTH_ID || subscriptionPlanId == SOCIAL_ONLY_649_PER_ANNUALLY_ID) {
                    planPurchaseData.plan_type = PLAN_FOR_SOCIAL_ONLY;
                    planPurchaseData.plan = PLAN_FOR_SOCIAL_ONLY_NAME;
                    if (subscriptionPlanId == SOCIAL_ONLY_59_PER_MONTH_ID) {
                        planPurchaseData.plan_price_id = SOCIAL_ONLY_59_PER_MONTH_ID;
                        planPurchaseData.plan_lookup_key = SOCIAL_ONLY_59_PER_MONTH_LOOKUP_KEY;
                    }
                    if (subscriptionPlanId == SOCIAL_ONLY_649_PER_ANNUALLY_ID) {
                        planPurchaseData.plan_price_id = SOCIAL_ONLY_649_PER_ANNUALLY_ID;
                        planPurchaseData.plan_lookup_key = SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY;
                    }
                }

                // Social PLUS monthly/yearly
                if (subscriptionPlanId == SOCIAL_PLUS_99_PER_MONTH_ID || subscriptionPlanId == SOCIAL_PLUS_1089_PER_ANNUALLY_ID) {
                    planPurchaseData.plan_type = PLAN_FOR_SOCIAL_PLUS;
                    planPurchaseData.plan = PLAN_FOR_SOCIAL_PLUS_NAME;
                    if (subscriptionPlanId == SOCIAL_PLUS_99_PER_MONTH_ID) {
                        planPurchaseData.plan_price_id = SOCIAL_PLUS_99_PER_MONTH_ID;
                        planPurchaseData.plan_lookup_key = SOCIAL_PLUS_99_PER_MONTH_LOOKUP_KEY;
                    }
                    if (subscriptionPlanId == SOCIAL_PLUS_1089_PER_ANNUALLY_ID) {
                        planPurchaseData.plan_price_id = SOCIAL_PLUS_1089_PER_ANNUALLY_ID;
                        planPurchaseData.plan_lookup_key = SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY;
                    }
                }

                // Handle Stripe event types
                switch (event.type) {
                    case 'invoice.payment_succeeded':
                        try {
                            // Insert user plan purchase record (await DB operation)
                            await userPlanPurchase(req, res, planPurchaseData);
                        } catch (error) {
                            console.error(`Error processing successful payment: ${error.message}`);
                        }
                        break;

                    case 'invoice.payment_failed':
                        try {
                            const failureMessage =
                                paymentObject?.failure_message || "Payment failed due to unknown error";
                            planPurchaseData.payment_status = PAYMENT_STATUS_FAILED;
                            planPurchaseData.subscription_status = SUBSCRIPTION_DEACTIVE_STATUS;
                            planPurchaseData.other_details = failureMessage;
                            // Insert failed user plan purchase record (await DB operation)
                            await userPlanPurchase(req, res, planPurchaseData);
                        } catch (error) {
                            console.error(`Error processing failed payment: ${error.message}`);
                        }
                        break;

                    default:
                        console.log(`Unhandled event type ${event.type}`);
                }
            }

            // Send response to Stripe
            res.json({ received: true });
        } catch (err) {
            console.error(`Webhook processing error: ${err.message}`);
        }
    }; // end stripePaymentWebhook();


    /**
     * Function used to change month/year toggle
     *
     * @return json
     **/
    this.changeMonthYearToggle = async (req, res) => {
        let finalResponse = {};

        // Extract user and plan info
        const loginUserData = req.user_data || "";
        const userId = loginUserData._id || "";
        const alreadyCustomerId = loginUserData.customer_id || "";
        const planProductId = req.body.plan_product_id || "";
        const monthYearToggle = req.body.month_year_toggle === 'year'; // true for yearly, false for monthly

        const paymentTypeSymbal = res.locals.settings["Payment.payment_type_symbal"];
        const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
        const stripe = require('stripe')(paymentSecretKey);

        if (!userId || !planProductId) {
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
            // 1. Get Stripe prices for the product
            const prices = await stripe.prices.list({
                product: planProductId,
                expand: ['data.product']
            });

            // 2. Find the correct plan object and price id based on toggle
            let planObject = {};
            let planPriceId = "";
            let planLookupKey = "";

            if (monthYearToggle) {
                // Yearly plan
                planObject = prices.data.find(price => price.recurring && price.recurring.interval === 'year');
            } else {
                // Monthly plan
                planObject = prices.data.find(price => price.recurring && price.recurring.interval === 'month');
            }

            if (!planObject) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        result: [],
                        message: res.__("front.system.something_going_wrong_please_try_again"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            planPriceId = planObject.id;
            planLookupKey = planObject.lookup_key;

            const customerId = alreadyCustomerId;
            let subscriptionId = "";
            let clientSecret = "";
            let subscription = "";

            // 3. Create subscription if not free plan
            if (planPriceId !== PLAN_PRODUCT_PRICE_FREE_ID) {
                subscription = await stripe.subscriptions.create({
                    customer: customerId,
                    items: [{ price: planPriceId }],
                    payment_behavior: 'default_incomplete',
                    expand: ['latest_invoice.payment_intent'],
                });
                subscriptionId = subscription.id;
                clientSecret = subscription.latest_invoice.payment_intent.client_secret;
            }

            // 4. Insert or update customer and subscription logs using async/await
            // Use upsert to insert if not exists, or update if exists
            await customerAndSubscriptionLogs.findOneAndUpdate(
                {
                    customer_id: customerId,
                    subscription_id: subscriptionId,
                },
                {
                    $set: {
                        modified: getUtcDate()
                    },
                    $setOnInsert: {
                        user_id: userId,
                        customer_id: customerId,
                        subscription_id: subscriptionId,
                        client_secret: clientSecret,
                        plan_price_id: planPriceId,
                        plan_lookup_key: planLookupKey,
                        subscription: subscription,
                        plan: planObject,
                        created: getUtcDate(),
                    }
                },
                { upsert: true }
            );

            // 5. Add payment type symbol to plan object
            planObject['payment_type_symbal'] = paymentTypeSymbal;

            // 6. Send success response
            finalResponse = {
                data: {
                    status: STATUS_SUCCESS,
                    plan_object: planObject,
                    client_secret: clientSecret,
                }
            };
            return returnApiResult(req, res, finalResponse);

        } catch (error) {
            console.error(error);
            // Handle errors here
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };


    /**
     * Function to check if a promo code is valid for a user and plan.
     * Uses async/await for all DB and Stripe queries for faster response.
     * Runs independent queries in parallel where possible.
     * @param {*} req 
     * @param {*} res 
     * @returns json response
     **/
    this.checkPromoCodeIsValid = async (req, res) => {
        let finalResponse = {};

        // Extract user and request details
        const loginUserData = req.user_data ? req.user_data : "";
        const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
        const promoCode = req.body.promo_code ? req.body.promo_code : "";
        const planPriceId = req.body.plan_price_id ? req.body.plan_price_id : "";

        const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);

        // Validate required fields
        if (!userId || !promoCode || !planPriceId) {
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }

        try {
            // Get Stripe secret key and initialize Stripe
            const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
            const stripe = require('stripe')(paymentSecretKey);

            // Run Stripe promo code lookup and price retrieval in parallel
            const [promoList, priceDetails] = await Promise.all([
                stripe.promotionCodes.list({
                    code: promoCode,
                    active: true,
                }),
                stripe.prices.retrieve(planPriceId)
            ]);

            const planPrice = priceDetails.unit_amount;

            // If no promo code found, return error
            if (!promoList.data.length) {
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        promo_code: "",
                        message: res.__("front.promp_code.invalid_or_expired_promo_code"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Extract coupon and promo details
            const promo = promoList.data[0];
            const couponData = promo.coupon || {};
            const couponId = couponData.id || "";
            const redeemBy = couponData.redeem_by || "";
            const couponUniqueApiId = promo.id || "";
            let nextRedeemBy = "30 days";
            let durationMultiple = false;

            // Format redeem by date if available
            if (couponData && redeemBy !== "") {
                const date = new Date(redeemBy * 1000);
                const options = { month: 'short', day: '2-digit', year: 'numeric' };
                nextRedeemBy = date.toLocaleDateString('en-US', options).replace(',', '');
                durationMultiple = true;
            }

            // Check if user has already used this promo code for this plan
            const existingPromo = await planUserPurchaseCollection.findOne({
                user_id: userId,
                promo_code: { $regex: "^" + promoCode + "$", $options: "i" },
                coupon_id: { $regex: "^" + couponId + "$", $options: "i" },
                coupon_unique_api_id: { $regex: "^" + couponUniqueApiId + "$", $options: "i" },
            });

            if (existingPromo) {
                // Promo code already used by user
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        promo_code: "",
                        message: res.__("front.promp_code.promo_code_already_used_by_user"),
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }

            // Calculate discount
            let discountAmount = 0;
            if (couponData && couponData.percent_off) {
                discountAmount = Math.round((planPrice * couponData.percent_off) / 100);
            } else if (couponData && couponData.amount_off) {
                discountAmount = couponData.amount_off;
            }
            const discountedPrice = planPrice - discountAmount;

            // Check if coupon metadata allows this plan
            const metadata = couponData.metadata || {};
            if (metadata.hasOwnProperty(planPriceId)) {
                // Promo code is valid for this plan
                finalResponse = {
                    data: {
                        status: STATUS_SUCCESS,
                        promo_code: promoCode,
                        redeem_by: nextRedeemBy,
                        duration_multiple: durationMultiple,
                        discounted_price: discountedPrice,
                        original_price: planPrice,
                        message: res.__("front.promp_code.promo_code_applied")
                    }
                };
                return returnApiResult(req, res, finalResponse);
            } else {
                // Promo code is not valid for this plan
                finalResponse = {
                    data: {
                        status: STATUS_ERROR,
                        promo_code: promoCode,
                        redeem_by: nextRedeemBy,
                        discounted_price: discountedPrice,
                        original_price: planPrice,
                        message: res.__("front.promp_code.promo_code_is_not_valid_for_this_plan")
                    }
                };
                return returnApiResult(req, res, finalResponse);
            }
        } catch (error) {
            console.error(error);
            finalResponse = {
                data: {
                    status: STATUS_ERROR,
                    error: error,
                    message: res.__("front.system.something_going_wrong_please_try_again"),
                }
            };
            return returnApiResult(req, res, finalResponse);
        }
    };

}
module.exports = new paymentGateway();