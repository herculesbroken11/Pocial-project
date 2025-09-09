var modulePath = "/api/";
const geoip = require('geoip-lite');

global.atob = require("atob");
global.btoa = require("btoa");

/** Set current view folder **/
app.use(modulePath, (req, res, next) => {
	req.rendering.views = __dirname + "/views";
	next();
});

// Validation rules for different API endpoints
const { validate, leadValidate, homePageContactUSValidate, getStartedHomePageValidation, newsletterHomePageEmailValidation } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'deafult_api_validator.js');
const { loginValidationRules, resetPasswordValidationRules, forgetPasswordValidationRules, addUserValidationRules, editUserValidationRules, changePasswordValidationRules, socialChangePasswordValidation, verifyOtpValidationRules, publicBussinessInformationValidationRules, socialValidationRules, addUserThirdPartyValidationRules } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'user_api_validator.js');
const { addCreateFormValidationRules, siginFieldsFormValidationRules, updateCreateFormAfterSubscriberUser, scriptCustomizationValidation } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'lead_form_api_validator.js');
const { addRewardValidationRules } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'rewards_validator.js');
const { addEmailTemplateValidationRules, sendTestEmailTemplateValidationRules, smtpVerifyValidationRules } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'email_template_validator.js');
const { getContentLibraryValidationRules, createPostManuallyValidationRules, getFallbackDataValidationRules } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'content_library_api_validator.js');
const { createAudienceValidationRules, editAudienceValidationRules } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'audience_api_validator.js');

/***************************************** START DEFAULT ROUTING API *****************************************/

/** Loads the default API model for default API routes. */
const defaultApi = require(__dirname + "/model/default");
/** Handler for defaultApi methods. */
const defaultApiHandler = method => (req, res, next) => defaultApi[method](req, res, next);

/** Handles retrieval of global settings. */
app.all(modulePath + "get_global_settings", makeRequest, defaultApiHandler("getGlobalSettings"));

/** Handles retrieval of master dropdown values. */
app.all(modulePath + "get_master_value", makeRequest, defaultApiHandler("getMasterValue"));

/** Handles retrieval of CMS page details. */
app.all(modulePath + "get_cms_details", makeRequest, defaultApiHandler("getCmsDetails"));

/** Handles saving of contact form details. */
app.all(modulePath + "save_contact_us", makeRequest, homePageContactUSValidate(), validate, defaultApiHandler("saveContactUs"));

/** Handles retrieval of signup field checkbox options. */
app.all(modulePath + "get_signup_field_checkbox", makeRequest, defaultApiHandler("getSignupFieldCheckbox"));

/** Handles retrieval of home page lead email data. */
app.all(modulePath + "home_page_lead_email", makeRequest, defaultApiHandler("homePageLeadEmail"));

/** Handles retrieval of thank you message. */
app.all(modulePath + "get_thanku_message", makeRequest, defaultApiHandler("getThankuMessage"));

/** Handles retrieval of block data. */
app.all(modulePath + "get_block_data", makeRequest, defaultApiHandler("getBlockData"));

/** Handles retrieval of category listings. */
app.all(modulePath + "get_category_listing", makeRequest, defaultApiHandler("getCategoryListing"));

/** Handles retrieval of lead capture script listings by form ID. */
app.all(modulePath + "get_lead_capture_script_listing/:lead_forms_id", defaultApiHandler("getLeadCaptureScriptListing"));
/** Handles retrieval of lead capture script listings by form and script ID. */
app.all(modulePath + "get_lead_capture_script_listing/:lead_forms_id/:scripted_id", defaultApiHandler("getLeadCaptureScriptListing"));

/** Handles global project search. */
app.all(modulePath + "get_search_over_all", makeRequest, defaultApiHandler("getSearchOverAll"));

/** Handles retrieval of dynamic string constants. */
app.get(modulePath + "get_dynamic_string_constant", defaultApiHandler("getDynamicStringConstant"));

/** Handles retrieval of poll vote list. */
app.all(modulePath + "get_poll_vote_list", makeRequest, defaultApiHandler("getPollVotes"));

/** Handles retrieval of remaining segment count. */
app.all(modulePath + "get_segment_left_count", makeRequest, defaultApiHandler("getSegmentLeftCount"));

/** Handles retrieval of 'Get Started' home page data. */
app.all(modulePath + "get_started_home_page", makeRequest, getStartedHomePageValidation(), validate, defaultApiHandler("getStartedHomePage"));

/** Handles newsletter submission after Excel append. */
app.all(modulePath + "home_page_newsletter_submit_after_excel_append", makeRequest, newsletterHomePageEmailValidation(), validate, defaultApiHandler("homePageNewsletterSubmitAfterExcelSubmit"));

/** Handles user unsubscription from all communications. */
app.all(modulePath + "all_type_unsubscribe_user", makeRequest, defaultApiHandler("allTypeUnsubscribeUser"));

/** Handles retrieval of announcement list. */
app.all(modulePath + "get_announcement_list", makeRequest, defaultApiHandler("getAnnouncementList"));

/** Handles closing of the announcement bar. */
app.all(modulePath + "close_announcement_bar", makeRequest, defaultApiHandler("closeAnnouncementBar"));

/** Handles retrieval of users with the same email. */
app.all(modulePath + "get_users_with_same_email", makeRequest, defaultApiHandler("getUsersWithSameEmail"));

/** Handles retrieval of blog listings. */
app.all(modulePath + "get_blog_listing", makeRequest, defaultApiHandler("getBlogListing"));

/** Handles retrieval of blog details. */
app.all(modulePath + "blogs_details", makeRequest, defaultApiHandler("blogsDetails"));

/***************************************** END DEFAULT ROUTING API *****************************************/


/***************************************** START REGISTRATION ROUTING API *****************************************/
/** Loads the registration API model for authentication routes. */
const registrationApi = require(__dirname + "/model/registration");
/** Handler for registrationApi methods. */
const registrationHandler = method => (req, res, next) => registrationApi[method](req, res, next);

/** Handles user registration. */
app.all(modulePath + "user_registration", makeRequest, addUserValidationRules(), validate, registrationHandler("userRegistration"));

/** Handles user OTP verification. */
app.all(modulePath + "verify_otp", makeRequest, verifyOtpValidationRules(), validate, registrationHandler("verifyOTP"));

/** Handles OTP resend for user. */
app.all(modulePath + "resend_otp", makeRequest, registrationHandler("resendOtp"));

/** Handles forgot password requests. */
app.all(modulePath + "forgot_password", makeRequest, forgetPasswordValidationRules(), validate, (req, res) => registrationApi.forgotPassword(req, res));

/** Handles user password reset. */
app.all(modulePath + "reset_password", makeRequest, resetPasswordValidationRules(), validate, registrationHandler("resetPassword"));

/** Handles user login. */
app.all(modulePath + "login", makeRequest, loginValidationRules(), validate, registrationHandler("login"));

/** Handles sub-user login. */
app.all(modulePath + "sub_user_login", makeRequest, registrationHandler("subUserLogin"));

/** Handles retrieval of user details. */
app.all(modulePath + "get_user_detail", makeRequest, registrationHandler("getUserDetail"));

/** Handles editing of user profile image. */
app.all(modulePath + "edit_user_profile_image", makeRequest, registrationHandler("editUserProfileImage"));

/** Handles editing of user profile details. */
app.all(modulePath + "edit_user_profile", makeRequest, editUserValidationRules(), validate, registrationHandler("editUserManageProfile"));

/** Handles user password change. */
app.all(modulePath + "change_password", makeRequest, changePasswordValidationRules(), validate, registrationHandler("changeUserPassword"));

/** Handles social user password change. */
app.all(modulePath + "change_social_password", makeRequest, socialChangePasswordValidation(), validate, registrationHandler("changeSocialUserPassword"));

/** Handles social user login. */
app.all(modulePath + "social_user_login", makeRequest, socialValidationRules(), validate, registrationHandler("socialUserLogin"));

/** Handles admin login. */
app.all(modulePath + "login_by_admin", makeRequest, registrationHandler("loginByAdmin"));

/** Handles third-party user registration. */
app.all(modulePath + "third_party_user_registration", makeRequest, addUserThirdPartyValidationRules(), validate, registrationHandler("thirdPartyUserRegistration"));

/** Handles Pocial bot user registration. */
app.all(modulePath + "pocial_bot_user_registration", makeRequest, registrationHandler("pocialBotUserRegistration"));

/** Handles user existence check. */
app.all(modulePath + "user_exist_check", makeRequest, registrationHandler("userExistCheck"));

/** Handles forgot password OTP validation. */
app.all(modulePath + "forgot_password_otp_valid_check", makeRequest, registrationHandler("forgotPasswordOtpValidCheck"));

/** Handles sending verification link by URL. */
app.all(modulePath + "verify_link_send_url_according", makeRequest, registrationHandler("verifyLinkSendUrlAccording"));

/** Handles user account verification by URL. */
app.all(modulePath + "verify_user_account_url_according", makeRequest, registrationHandler("verifyUserAccountUrlAccording"));

/** Handles check for already existing user. */
app.all(modulePath + "check_already_user_exists", makeRequest, registrationHandler("checkAlreadyUserExists"));

/** Handles JWT token regeneration. */
app.all(modulePath + "regenerate_jwt", (req, res, next) => {
	req.rendering.views = __dirname + "/views";
	req.rendering.layout = WEBSITE_ADMIN_LAYOUT_PATH + "before_login";
	registrationApi.regenerateJWT(req, res, next);
});
/***************************************** END REGISTRATION ROUTING API *****************************************/


/***************************************** START LEADS FORM ROUTING API *****************************************/

/** Loads the lead form API model for lead form routes. */
const leadsApi = require(__dirname + "/model/lead_form");
/** Handler for leadsApi methods. */
const leadsHandler = method => (req, res, next) => leadsApi[method](req, res, next);

/** Handles creation of lead capture form. */
app.all(modulePath + "create_lead_capture_form", makeRequest, addCreateFormValidationRules(), validate, leadsHandler("createLeadCaptureForm"));

/** Handles editing of lead capture form. */
app.all(modulePath + "edit_lead_capture_form", makeRequest, addCreateFormValidationRules(), validate, leadsHandler("editLeadCaptureForm"));

/** Handles editing of lead capture form after subscriber user. */
app.all(modulePath + "edit_lead_capture_form_after_subscriber_user", makeRequest, updateCreateFormAfterSubscriberUser(), validate, (req, res, next) => { req.body.after_subscriber_user = ACTIVE; leadsApi.editLeadCaptureForm(req, res, next); });

/** Handles retrieval of lead capture form. */
app.all(modulePath + "get_lead_capture_form", makeRequest, leadsHandler("getLeadCaptureForm"));

/** Handles capturing of lead details. */
app.all(modulePath + "capture_lead_details", makeRequest, leadsHandler("captureLeadDetails"));

/** Handles retrieval of subscriber lead capture details. */
app.all(modulePath + "get_subscriber_lead_capture_details", makeRequest, leadsHandler("getSubscriberLeadCaptureDetails"));

/** Handles submission of lead signup fields. */
app.all(modulePath + "submit_leads_sigup_fields", makeRequest, siginFieldsFormValidationRules(), validate, leadsHandler("submitLeadsSigupFields"));

/** Handles submission of lead signup fields for third-party users. */
app.all(modulePath + "submit_leads_sigup_fields_third_user", makeRequestLead, siginFieldsFormValidationRules(), leadValidate, leadsHandler("submitLeadsSigupFields"));

/** Handles retrieval of user leads count for charting. */
app.all(modulePath + "chart_count_user_leads", makeRequest, leadsHandler("chartCountUserLeads"));

/** Handles retrieval of lead signup fields list. */
app.all(modulePath + "get_list_leads_sigup_fields", makeRequest, leadsHandler("getListLeadsSigupFields"));

/** Handles retrieval of third-party user leads list. */
app.all(modulePath + "get_third_user_leads_list", makeRequest, leadsHandler("getThirdUserLeadsDetails"));

/** Handles deletion of a lead. */
app.all(modulePath + "delete_lead", makeRequest, leadsHandler("deleteLead"));

/** Handles import of lead data. */
app.all(modulePath + "import_leads_data", makeRequest, leadsHandler("importLeadsData"));

/** Handles assignment of home page lead. */
app.all(modulePath + "assign_home_page_lead", makeRequest, leadsHandler("assignHomePageLead"));

/** Handles picking of a lead winner. */
app.all(modulePath + "pick_a_winner", makeRequest, leadsHandler("pickAWinner"));

/** Handles retrieval of lead winners. */
app.all(modulePath + "get_lead_winners", makeRequest, leadsHandler("getLeadWinners"));

/** Handles validation for sending rewards. */
app.all(modulePath + "validate_send_rewards", makeRequest, leadsHandler("validateSendRewards"));

/** Handles sending of segment lead rewards. */
app.all(modulePath + "send_segment_leads_rewards", makeRequest, leadsHandler("sendSegmentLeadsRewards"));

/** Handles retrieval of loyal users list. */
app.all(modulePath + "get_loyalist_list", makeRequest, leadsHandler("getLoyalist"));

/** Handles retrieval of signup lead forms data for user editing. */
app.all(modulePath + "get_signup_lead_forms_data_according_edit_user", makeRequest, leadsHandler("getSignupLeadFormsDataAccordingEditUser"));

/** Handles retrieval of welcome email dropdown list. */
app.all(modulePath + "welcome_email_dropdown_list", makeRequest, leadsHandler("welcomeEmailDropdownList"));

/** Handles assignment of welcome email in lead capture. */
app.all(modulePath + "assign_welcome_email_in_lead_capture", makeRequest, leadsHandler("assignWelcomeEmailInLeadCapture"));

/** Handles updating of lead status. */
app.all(modulePath + "update_lead_status", makeRequest, leadsHandler("updateLeadStatus"));

/** Handles validation for sending welcome email. */
app.all(modulePath + "validate_send_welcome_email", makeRequest, leadsHandler("validateSendWelcomeEmail"));

/** Handles resending of welcome email to lead subscriber user. */
app.all(modulePath + "again_lead_subscriber_user_welcome_email_send", makeRequest, leadsHandler("againLeadSubscriberUserWelcomeEmailSend"));

/** Handles assignment of email and reward according to lead. */
app.all(modulePath + "lead_according_assign_email_and_reward", makeRequest, leadsHandler("leadAccordingAssignEmailAndReward"));

/***************************************** END LEADS FORM ROUTING API *****************************************/


/***************************************** START REWARDS ROUTING API *****************************************/

/** Loads the rewards API model for rewards routes. */
const rewardsApi = require(__dirname + "/model/rewards");
/** Handler for rewardsApi methods. */
const rewardsHandler = method => (req, res, next) => rewardsApi[method](req, res, next);

/** Handles addition of a new reward. */
app.all(modulePath + "add_rewards", makeRequest, addRewardValidationRules(), validate, rewardsHandler("addRewards"));

/** Handles editing of an existing reward. */
app.all(modulePath + "edit_rewards", makeRequest, addRewardValidationRules(), validate, rewardsHandler("editRewards"));

/** Handles retrieval of created rewards list. */
app.all(modulePath + "get_create_rewards_list", makeRequest, rewardsHandler("getCreateRewardsList"));

/** Handles retrieval of reward details. */
app.all(modulePath + "rewards_details", makeRequest, rewardsHandler("rewardsDetails"));

/** Handles changing of reward status. */
app.all(modulePath + "reward_status_change", makeRequest, rewardsHandler("rewardStatusChange"));

/** Handles deletion of a reward. */
app.all(modulePath + "delete_reward", makeRequest, rewardsHandler("deleteReward"));

/** Handles retrieval of redemptions list. */
app.all(modulePath + "get_redemptions_list", makeRequest, rewardsHandler("getRedemptionsList"));

/** Handles retrieval of users who have earned rewards. */
app.all(modulePath + "get_earn_rewards_list", makeRequest, rewardsHandler("getEarnRewardsList"));

/** Handles retrieval of earned rewards details for a user. */
app.all(modulePath + "earn_rewards_details", makeRequest, rewardsHandler("earnRewardsDetails"));

/** Handles retrieval of attached email templates for rewards. */
app.all(modulePath + "get_attached_email_template", makeRequest, rewardsHandler("getAttachedEmailTemplate"));

/** Handles deletion of a reward image. */
app.all(modulePath + "reward_image_delete", makeRequest, rewardsHandler("rewardImageDelete"));

/***************************************** END REWARDS ROUTING API *****************************************/


/***************************************** START EMBEDED IFRMAE ROUTING API *****************************************/

/** Loads the embedded iframe API model for iframe routes. */
const embededIframeApi = require(__dirname + "/model/embeded_iframe");
/** Handler for embededIframeApi methods. */
const embededIframeHandler = method => (req, res, next) => embededIframeApi[method](req, res, next);

/** Handles retrieval of complete package data for embedded leads. */
app.all(modulePath + "captureleads_loadembed/:lead_package_id", makeRequest, embededIframeHandler("getCompletePackageData"));

/** Handles uploading of background image for embedded iframe. */
app.all(modulePath + "upload_background_image", makeRequest, embededIframeHandler("uploadBackgroundImage"));

/***************************************** END EMBEDED IFRMAE ROUTING API *****************************************/

/***************************************** START EMAIL TEMPLATE ROUTING API *****************************************/
/** Loads the email templates API model for email template routes. */
const emailTemplateApi = require(__dirname + "/model/email_templates");
/** Handler for emailTemplateApi methods. */
const emailTemplateHandler = method => (req, res, next) => emailTemplateApi[method](req, res, next);

/** Handles retrieval of rewards dropdown list. */
app.all(modulePath + "get_dropdown_rewards_list", makeRequest, emailTemplateHandler("getDropdownRewardsList"));

/** Handles retrieval of email template dropdown list. */
app.all(modulePath + "get_dropdown_email_template_list", makeRequest, emailTemplateHandler("getDropdownEmailTemplateList"));

/** Handles addition of a new email template. */
app.all(modulePath + "add_template", makeRequest, addEmailTemplateValidationRules(), validate, emailTemplateHandler("addTemplate"));

/** Handles editing of an existing email template. */
app.all(modulePath + "edit_template", makeRequest, addEmailTemplateValidationRules(), validate, emailTemplateHandler("editTemplate"));

/** Handles updating of email template body. */
app.all(modulePath + "edit_template_body", makeRequest, emailTemplateHandler("editTemplateBody"));

/** Handles retrieval of email template list. */
app.all(modulePath + "get_email_template_list", makeRequest, emailTemplateHandler("getEmailTemplateList"));

/** Handles retrieval of email template details. */
app.all(modulePath + "email_template_details", makeRequest, emailTemplateHandler("emailTemplateDetails"));

/** Handles changing of email template status. */
app.all(modulePath + "email_template_change_status", makeRequest, emailTemplateHandler("emailTemplateStatusChange"));

/** Handles sending of test email using a template. */
app.all(modulePath + "send_test_email", makeRequest, sendTestEmailTemplateValidationRules(), validate, emailTemplateHandler("sendTestEmail"));

/** Handles updating of attached reward for email template. */
app.all(modulePath + "update_template_attach_reward", makeRequest, emailTemplateHandler("updateTemplateAttachReward"));

/** Handles verification of SMTP connection for email templates. */
app.all(modulePath + "verify_smtp_connection", makeRequest, smtpVerifyValidationRules(), validate, emailTemplateHandler("verifySmtpConnection"));

/** Handles retrieval of complete template list. */
app.all(modulePath + "get_complete_templete_list", makeRequest, emailTemplateHandler("getCompleteTempleteList"));

/** Handles assignment of reward to complete template. */
app.all(modulePath + "complete_templete_assign_reward", makeRequest, emailTemplateHandler("completeTempleteAssignReward"));

/** Handles retrieval of active welcome template list. */
app.all(modulePath + "get_active_welcome_template_list", makeRequest, emailTemplateHandler("getActiveWelcomeTemplateList"));

/** Handles addition of draft email template. */
app.all(modulePath + "add_template_draft", makeRequest, emailTemplateHandler("addTemplateDraft"));

/** Handles deletion of draft email template. */
app.all(modulePath + "delete_template_draft", makeRequest, emailTemplateHandler("deleteTemplateDraft"));

/** Handles tracking of sent emails for a template. */
app.all(modulePath + "track_send_email", makeRequest, emailTemplateHandler("trackSendEmail"));

/** Handles retrieval of AI bot welcome email template details. */
app.all(modulePath + "ai_bot_welcome_email_template_details", makeRequest, emailTemplateHandler("aiBotWelcomeEmailTemplateDetails"));

/** Handles retrieval of assigned audience details for a template. */
app.all(modulePath + "get_assign_audience", makeRequest, emailTemplateHandler("getAssignAudience"));

/** Handles assignment of audience to an email template. */
app.all(modulePath + "assign_audience_for_email", makeRequest, emailTemplateHandler("assignAudienceForEmail"));
/***************************************** END EMAIL TEMPLATE ROUTING API *****************************************/



/***************************************** START USERS ROUTING API *****************************************/

/** Loads the users API model for user routes. */
const usersApi = require(__dirname + "/model/users");
/** Handler for usersApi methods. */
const userHandler = (method) => (req, res, next) => usersApi[method](req, res, next);

/** Handles toggling of user dark mode. */
app.all(modulePath + "user_dark_toggle_change", makeRequest, userHandler("userDarkToggleChange"));

/** Handles editing of public business information. */
app.all(modulePath + "edit_public_bussiness_information", makeRequest, publicBussinessInformationValidationRules(), validate, userHandler("editPublicBusinessInformation"));

/** Handles retrieval of business details. */
app.all(modulePath + "get_business_details", makeRequest, userHandler("getBusinessDetails"));

/** Handles searching of sub-users list. */
app.all(modulePath + "search_sub_users_list", makeRequest, userHandler("searchSubUsersList"));

/** Handles retrieval of selected sub-users. */
app.all(modulePath + "get_seleted_sub_users", makeRequest, userHandler("getSeletedSubUsers"));

/** Handles retrieval of sub-users list. */
app.all(modulePath + "get_sub_users_list", makeRequest, userHandler("getSubUserlist"));

/** Handles addition of a sub-user. */
app.all(modulePath + "add_sub_user", makeRequest, userHandler("addSubUser"));

/** Handles deletion of user image. */
app.all(modulePath + "delete_user_image", makeRequest, userHandler("deleteUserImage"));

/** Handles updating of user profile image. */
app.all(modulePath + "update_user_profile_image", makeRequest, userHandler("updateUserProfileImage"));

/** Handles updating of AI page destroy flag for user. */
app.all(modulePath + "ai_page_after_destroy", makeRequest, userHandler("aiPageAfterDestroy"));

/** Handles validation for insider poll email user send. */
app.all(modulePath + "validate_insider_poll_email_user_send", makeRequest, userHandler("validateInsiderPollEmailUserSend"));

/** Handles sending of insider poll votes email. */
app.all(modulePath + "send_email_insider_poll_votes", makeRequest, userHandler("sendEmailInsiderPollVotes"));

/** Handles updating of user time zone. */
app.all(modulePath + "update_user_time_zone", makeRequest, userHandler("updateUserTimeZone"));

/** Handles toggling of user auto-schedule. */
app.all(modulePath + "auto_schedule_on_off", makeRequest, userHandler("autoScheduleOnOff"));
/***************************************** END USERS ROUTING API *****************************************/


/***************************************** START NOTIFICATION ROUTING API *****************************************/

/** Loads the notification API model for notification routes. */
const notificationApi = require(__dirname + "/model/notification");
/** Handler for notificationApi methods. */
const notificationHandler = method => (req, res, next) => notificationApi[method](req, res, next);

/** Handles retrieval of notifications. */
app.all(modulePath + "get_notifications", makeRequest, notificationHandler("getNotifications"));

/** Handles retrieval of unread notification count. */
app.all(modulePath + "getUnreadNotificationCount", makeRequest, notificationHandler("getUnreadNotificationCount"));

/** Handles marking of a notification as read. */
app.all(modulePath + "markAsReadNotification", makeRequest, notificationHandler("markAsReadNotification"));

/** Handles marking of all notifications as read. */
app.all(modulePath + "mark_as_read_all_notification", makeRequest, notificationHandler("markAsReadAllNotification"));

/** Handles retrieval of notification settings list. */
app.all(modulePath + "get_notification_settings_list", makeRequest, notificationHandler("getNotificationSettingsList"));

/** Handles enabling or disabling user notification settings. */
app.all(modulePath + "user_on_off_notifications", makeRequest, notificationHandler("userOnOffNotifications"));

/** Handles deletion of notifications. */
app.all(modulePath + "delete_notifications", makeRequest, notificationHandler("deleteNotifications"));


/***************************************** END NOTIFICATION ROUTING API *****************************************/


/***************************************** START WALLET ROUTING API *****************************************/

/** Loads the wallet API model for wallet routes. */
const walletApi = require(__dirname + "/model/wallet");
/** Handler for walletApi methods. */
const walletHandler = method => (req, res, next) => walletApi[method](req, res, next);

/** Handles retrieval of business industry reward count. */
app.all(modulePath + "get_business_industry_reward_count", makeRequest, walletHandler("getBusinessIndustryRewardCount"));
/** Handles retrieval of wallet listing. */
app.all(modulePath + "get_wallet_listing", makeRequest, walletHandler("getWalletListing"));
/** Handles retrieval of wallet rewards details. */
app.all(modulePath + "wallet_rewards_details", makeRequest, walletHandler("walletRewardsDetails"));
/** Handles retrieval of user redeemed reward. */
app.all(modulePath + "user_redeemed_reward", makeRequest, walletHandler("userRedeemedReward"));

/***************************************** START WALLET ROUTING API *****************************************/



/***************************************** START FOLLOWER FOLLOWING ROUTING API *****************************************/
/** Loads the follower_following API model for follow routes. */
const userFollow = require(__dirname + "/model/follower_following");

/** Handler for userFollow methods. */
const userFollowHandler = method => (req, res, next) => userFollow[method](req, res, next);

/** Handles following or unfollowing a user. */
app.all(modulePath + "follow_unfollow_user", makeRequest, validate, userFollowHandler("followUnfollowUser"));

/** Handles retrieval of follow request list. */
app.all(modulePath + "follow_request_list", makeRequest, validate, userFollowHandler("followRequestList"));

/** Handles acceptance or rejection of follow request. */
app.all(modulePath + "accept_reject_follow_request", makeRequest, validate, userFollowHandler("acceptRejectFollowRequest"));

/** Handles retrieval of followers list. */
app.all(modulePath + "followers_list", makeRequest, validate, userFollowHandler("followersList"));

/** Handles retrieval of following list. */
app.all(modulePath + "following_list", makeRequest, validate, userFollowHandler("followingList"));

/** Handles removal of followers from the list. */
app.all(modulePath + "remove_followers", makeRequest, validate, userFollowHandler("removeFollowers"));


/***************************************** START FOLLOWER FOLLOWING ROUTING API *****************************************/


/***************************************** START NEWSLETTER SUBSCRIBERS API *****************************************/

/** Import the newsletter subscription API module. */
const newsletter = require(__dirname + "/model/newsletter_subscribe");
/** Handler for newsletter subscription API methods. */
const newsletterHandler = method => (req, res, next) => newsletter[method](req, res, next);

/** Handle newsletter subscription for a user by slug. */
app.all(modulePath + "newsletter_subscribers/:subscribed_user_slug", makeRequest, validate, newsletterHandler("isNewsletterSubscribe"));

/***************************************** END NEWSLETTER SUBSCRIBERS API *****************************************/


/***************************************** START SCRIPTED CODE API *****************************************/

/** Import the scripted code API module. */
const scriptCode = require(__dirname + "/model/scripted_code");
/** Handler for scripted code API methods. */
const scriptCodeHandler = method => (req, res, next) => scriptCode[method](req, res, next);

/** Retrieve scripted code. */
app.all(modulePath + "get_scripted_code", makeRequest, scriptCustomizationValidation(), validate, scriptCodeHandler("getScriptedCode"));

/** Retrieve the list of last customized scripted codes. */
app.all(modulePath + "last_customization_scripted_code_list", makeRequest, validate, scriptCodeHandler("lastCustomizationScriptedCodeList"));

/** Retrieve details of customized scripted code. */
app.all(modulePath + "customization_scripted_code_details", makeRequest, validate, scriptCodeHandler("customizationScriptedCodeDetails"));

/** Delete customized scripted code. */
app.all(modulePath + "delete_customization_scripted_code", makeRequest, validate, scriptCodeHandler("deleteCustomizationScriptedCode"));

/** Retrieve capture lead form fields. */
app.all(modulePath + "get_capture_lead_form_fields", makeRequest, validate, scriptCodeHandler("getCaptureLeadFormFields"));


/***************************************** END SCRIPTED API *****************************************/


/***************************************** START POLL API *****************************************/

/** Import the polls model and validation middleware. */
const polls = require(__dirname + "/model/polls");
const { createPollsOptionsValidation, createPollsValidation, sendCommentPollsValidation, voteParticipantsValidation, reportAbuseValidation, reportAbusePollCommentValidation, } = require(WEBSITE_VALIDATION_FOLDER_PATH + "polls_validation.js");

/** Handler for polls model methods. */
const pollsHandler = method => (req, res, next) => polls[method](req, res, next);

/** Get poll details. */
app.all(modulePath + "poll_details", makeRequest, validate, pollsHandler("pollDetails"));

/** Get the list of polls. */
app.all(modulePath + "get_polls_listing", makeRequest, validate, pollsHandler("getPollsListing"));

/** Add a question and options to a poll. */
app.all(modulePath + "add_question_and_options", makeRequest, createPollsOptionsValidation(), validate, pollsHandler("addQuestionAndOptions"));

/** Create a poll. */
app.all(modulePath + "create_polls", makeRequest, createPollsValidation(), validate, pollsHandler("createPolls"));

/** Save single media option data. */
app.all(modulePath + "single_options_data_save", makeRequest, (req, res, next) => polls.singleOptionsDataSave(req, res, next));

/** Delete a poll question and its options. */
app.all(modulePath + "delete_polls_question_and_options", makeRequest, (req, res, next) => polls.deletePollsQuestionAndOptions(req, res, next));

/** Delete all poll options. */
app.all(modulePath + "delete_all_polls_options", makeRequest, (req, res, next) => polls.deleteAllPollsOptions(req, res, next));

/** Publish or delete a poll. */
app.all(modulePath + "poll_published_and_deleted", makeRequest, (req, res, next) => polls.pollPublishedAndDeleted(req, res, next));

/** View public poll details. */
app.all(modulePath + "view_public_page_poll_details", makeRequest, (req, res, next) => polls.viewPublicPagePollDetails(req, res, next));

/** Get today's and yesterday's poll details. */
app.all(modulePath + "today_yesterday_polls_details", makeRequest, (req, res, next) => polls.todayYesterdayPollsDetails(req, res, next));

/** Submit a poll comment. */
app.all(modulePath + "send_poll_comments", makeRequest, sendCommentPollsValidation(), validate, pollsHandler("sendPollComments"));

/** Get the list of poll comments. */
app.all(modulePath + "get_poll_comments_list", makeRequest, (req, res, next) => polls.getPollCommentsList(req, res, next));

/** Like or dislike a poll comment. */
app.all(modulePath + "comments_like_dislike", makeRequest, (req, res, next) => polls.commentsLikeDislike(req, res, next));

/** Delete a poll comment. */
app.all(modulePath + "delete_poll_comment", makeRequest, (req, res, next) => polls.deletePollComment(req, res, next));

/** Check if a user has already voted. */
app.all(modulePath + "already_vote_check", makeRequest, (req, res, next) => polls.alreadyVoteCheck(req, res, next));

/** Submit a user's vote for a poll. */
app.all(modulePath + "poll_user_vote_participants", makeRequest, voteParticipantsValidation(), validate, pollsHandler("pollUserVoteParticipants"));

/** Get the list of poll participants. */
app.all(modulePath + "get_participants_list", makeRequest, (req, res, next) => polls.getParticipantsList(req, res, next));

/** Report abuse in a poll. */
app.all(modulePath + "save_poll_report_abuse", makeRequest, reportAbuseValidation(), validate, pollsHandler("savePollReportAbuse"));

/** Get the list of poll abuse reports. */
app.all(modulePath + "get_poll_abuse_reports_list", makeRequest, (req, res, next) => polls.getPollAbuseReportsList(req, res, next));

/** Get the list of users who commented and reported abuse in a poll. */
app.all(modulePath + "get_who_commented_user_poll_abuse_list", makeRequest, (req, res, next) => polls.getWhoCommentedUserPollAbuseList(req, res, next));

/** Report abuse in a poll comment. */
app.all(modulePath + "save_poll_commnet_report_abuse", makeRequest, reportAbusePollCommentValidation(), validate, pollsHandler("savePollCommnetReportAbuse"));

/** Get the list of poll comment abuse reports. */
app.all(modulePath + "get_poll_comment_abuse_reports_list", makeRequest, (req, res, next) => polls.getPollCommentAbuseReportsList(req, res, next));

/** Get details of poll comment abuse reports. */
app.all(modulePath + "poll_comment_abuse_reports_details", makeRequest, (req, res, next) => polls.pollCommentAbuseReportsDetails(req, res, next));

/** Assign session rewards after user login. */
app.all(modulePath + "assign_session_rewards_after_login", makeRequest, (req, res, next) => polls.assignSessionRewardAfterLogin(req, res, next));

/** Add multiple rewards to a poll. */
app.all(modulePath + "add_multiple_rewards", makeRequest, (req, res, next) => polls.addMultipleRewards(req, res, next));

/** Edit a poll option title. */
app.all(modulePath + "edit_poll_option_title", makeRequest, (req, res, next) => polls.editPollOptionTitle(req, res, next));

/** Log share icon actions for polls. */
app.all(modulePath + "share_icon_logs", makeRequest, (req, res, next) => polls.shareIconLogs(req, res, next));

/** Log poll ribbon click actions. */
app.all(modulePath + "poll_ribbon_click_logs", makeRequest, (req, res, next) => polls.pollRibbonClicksLogs(req, res, next));

/** Log time spent on polls. */
app.all(modulePath + "poll_time_spent_logs", makeRequest, (req, res, next) => polls.pollTimeSpentLogs(req, res, next));

/** Log poll link click actions. */
app.all(modulePath + "poll_link_click_logs", makeRequest, (req, res, next) => polls.pollLinkClickLogs(req, res, next));

/** Get poll attached reward redemption details. */
app.all(modulePath + "poll_attachedreward_redemptions_details", makeRequest, (req, res, next) => polls.pollAttachedRewardRedemptionsDetails(req, res, next));

/** Edit the end voting period of a poll. */
app.all(modulePath + "end_poll_voting_period", makeRequest, (req, res, next) => polls.editEndPollVotingPeriod(req, res, next));

/** Update an individual poll option. */
app.all(modulePath + "update_individual_options", makeRequest, (req, res, next) => polls.updateIndividualOptions(req, res, next));

/** Generate an embedded poll option for articles. */
app.all(modulePath + "article_embed_poll_generate", makeRequest, (req, res, next) => polls.articleEmbedPollGenerate(req, res, next));

/** Upload an individual image or video for a poll. */
app.all(modulePath + "upload_individually_image_video", makeRequest, (req, res, next) => polls.uploadIndividuallyImageVideo(req, res, next));
/***************************************** END POLL API *****************************************/


/***************************************** START POLL ANALYTICS REPORT API *****************************************/
/** Import the poll analytics report API. */
const pollAnalyticsReport = require(__dirname + "/model/poll_analytics_report");

/** Handler for poll analytics report methods. */
const pollAnalyticsHandler = method => (req, res, next) => pollAnalyticsReport[method](req, res, next);

/** Get poll engagement view report. */
app.all(modulePath + "poll_engagement_view_report", makeRequest, pollAnalyticsHandler("pollEngagementViewReport"));

/** Get poll engagement vote report. */
app.all(modulePath + "poll_engagement_vote_report", makeRequest, pollAnalyticsHandler("pollEngagementVoteReport"));

/** Get poll engagement graph vote report. */
app.all(modulePath + "poll_engagement_graph_vote_report", makeRequest, pollAnalyticsHandler("pollEngagementGraphVoteReport"));

/** Get poll share icon report. */
app.all(modulePath + "poll_share_icon_report", makeRequest, pollAnalyticsHandler("pollShareIconReport"));

/** Get poll engagement view graph report. */
app.all(modulePath + "poll_engagement_view_graph_report", makeRequest, pollAnalyticsHandler("pollEngagementViewGraphReport"));

/** Get poll average session duration graph. */
app.all(modulePath + "poll_engagement_average_session_duration_graph", makeRequest, pollAnalyticsHandler("pollEngagementAverageSessionDurationGraph"));

/** Get poll opt-in graph. */
app.all(modulePath + "poll_engagement_opt_in_graph", makeRequest, pollAnalyticsHandler("pollEngagementOptInGraph"));


/***************************************** END POLL ANALYTICS REPORT API *****************************************/


/***************************************** START POLL EMBED API *****************************************/
/** Import the poll embed API. */
const pollEmbed = require(__dirname + "/model/poll_embed");

/** Handler for poll embed API methods. */
const pollEmbedHandler = method => (req, res, next) => pollEmbed[method](req, res, next);

/** Generate and save a poll embed. */
app.all(modulePath + "poll_embed_generate", makeRequest, pollEmbedHandler("pollEmbedGenerate"));

/** List poll embeds. */
app.all(modulePath + "poll_embed_list", makeRequest, pollEmbedHandler("pollEmbedList"));

/** Get poll embed generation details. */
app.all(modulePath + "poll_embed_generate_details", makeRequest, pollEmbedHandler("pollEmbedGenerateDetails"));

/** Activate or deactivate a poll embed. */
app.all(modulePath + "active_deactive_poll_embed", makeRequest, pollEmbedHandler("activeDeactivePollEmbed"));

/** Delete a poll embed. */
app.all(modulePath + "delete_poll_embed", makeRequest, pollEmbedHandler("deletePollEmbed"));

/***************************************** END POLL EMBED API *****************************************/


/***************************************** START POLL PERFORMANCE REPORT API *****************************************/

const { addAssumptionReportValidation } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'assumption_report_validation.js');

/** Import the poll performance report module. */
const pollPerformanceReport = require(__dirname + "/model/poll_performance_report");

/** Handler for poll performance report methods. */
const pollPerformanceHandler = method => (req, res, next) => pollPerformanceReport[method](req, res, next);

/** Get poll interaction overview report. */
app.all(modulePath + "poll_interaction_overview", makeRequest, pollPerformanceHandler("pollInteractionOverview"));

/** Get poll interaction listing report. */
app.all(modulePath + "interaction_poll_listing", makeRequest, pollPerformanceHandler("interactionPollListing"));

/** Get poll interaction details report. */
app.all(modulePath + "interaction_poll_details", makeRequest, pollPerformanceHandler("interactionPollDetails"));

/** Get poll interaction option details report. */
app.all(modulePath + "interaction_poll_option_details", makeRequest, pollPerformanceHandler("interactionPollOptionsDetails"));

/** Get poll lead generation details report. */
app.all(modulePath + "poll_performance_lead_generation_details", makeRequest, pollPerformanceHandler("pollPerformanceLeadGenerationDetails"));

/** Add poll assumption reports. */
app.all(modulePath + "add_assumption_reports", makeRequest, addAssumptionReportValidation(), validate, pollPerformanceHandler("addAsumptionReports"));

/** Get poll assumption reports list. */
app.all(modulePath + "assumption_reports_list", makeRequest, pollPerformanceHandler("assumptionReportList"));

/** Get poll assumption report details. */
app.all(modulePath + "assumption_report_details", makeRequest, pollPerformanceHandler("getAssumptionDetails"));

/** View the first section of poll assumption performance report. */
app.all(modulePath + "view_assumption_performance_first_section", makeRequest, pollPerformanceHandler("viewAssumptionPerformanceFirstSection"));

/** View general revelations in poll assumption performance report. */
app.all(modulePath + "view_assumption_performance_general_revelations", makeRequest, pollPerformanceHandler("viewAssumptionPerformanceGeneralRevelation"));

/** View gender breakdown in poll assumption performance report. */
app.all(modulePath + "view_assumption_performance_gender_breakdown", makeRequest, pollPerformanceHandler("viewAssumptionPerformanceGenderBreakdown"));

/** View campaign breakdown in poll assumption performance report. */
app.all(modulePath + "view_assumption_performance_campaign_breakdown", makeRequest, pollPerformanceHandler("viewAssumptionPerformanceCampaignBreakdown"));

/** Get age dropdown report. */
app.all(modulePath + "age_dropdown", makeRequest, pollPerformanceHandler("getAgeDropdown"));

/** Delete poll assumption report. */
app.all(modulePath + "delete_assumption_report", makeRequest, pollPerformanceHandler("deleteAssumptionReport"));

/***************************************** END POLL PERFORMANCE REPORT API *****************************************/


/***************************************** START POLL SEGMENT API *****************************************/
const { cratePollSegmentValidation } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'polls_segment_validation.js');

const pollSegment = require(__dirname + "/model/poll_segment");
const pollSegmentHandler = method => (req, res, next) => pollSegment[method](req, res, next);

/** Get the segment poll list with total vote count. */
app.all(modulePath + "get_segment_poll_list", makeRequest, pollSegmentHandler("getSegmentPollList"));

/** Add a common poll segment. */
app.all(modulePath + "add_poll_common_segment", makeRequest, cratePollSegmentValidation(), validate, pollSegmentHandler("addPollCommonSegment"));

/** Edit a common poll segment. */
app.all(modulePath + "edit_poll_common_segment", makeRequest, cratePollSegmentValidation(), validate, pollSegmentHandler("editPollCommonSegment"));

/** Get the unique vote options count. */
app.all(modulePath + "get_unique_vote_options_count", makeRequest, pollSegmentHandler("getUniqueVoteOptionsCount"));

/** Add a segment voter response. */
app.all(modulePath + "add_segment_voter_response", makeRequest, pollSegmentHandler("addSegmentVoterResponse"));

/** Get selected poll-wise listing (option selected). */
app.all(modulePath + "selected_poll_wise_listing", makeRequest, pollSegmentHandler("selectedPollWiseListing"));

/** Add segment demographics. */
app.all(modulePath + "add_segment_demographics", makeRequest, pollSegmentHandler("addSegmentDemographics"));

/** Get the segment user voted list. */
app.all(modulePath + "get_segment_user_voted_list", makeRequest, pollSegmentHandler("getSegmentUserVotedList"));

/** Get the segment list. */
app.all(modulePath + "get_segment_list", makeRequest, pollSegmentHandler("getSegmentList"));

/** Delete a poll segment. */
app.all(modulePath + "delete_poll_segment", makeRequest, pollSegmentHandler("deletePollSegment"));

/** Get segment details. */
app.all(modulePath + "segment_details", makeRequest, pollSegmentHandler("segmentDetails"));

/** Edit a poll segment. */
app.all(modulePath + "edit_poll_segment", makeRequest, pollSegmentHandler("editPollSegment"));

/** Pick a segment winner. */
app.all(modulePath + "pick_a_segment_winner", makeRequest, pollSegmentHandler("segmentPickAWinner"));

/** Get segment winners. */
app.all(modulePath + "get_segment_winners", makeRequest, pollSegmentHandler("getSegmentWinners"));

/** Validate segment send rewards. */
app.all(modulePath + "validate_segment_send_rewards", makeRequest, pollSegmentHandler("validateSegmentSendRewards"));

/** Send segment rewards. */
app.all(modulePath + "send_segment_rewards", makeRequest, pollSegmentHandler("sendSegmentRewards"));

/** Get segment demographics filters for poll opt-in graph. */
app.all(modulePath + "segment_demographics_filters", makeRequest, pollSegmentHandler("segmentDemographicsFilters"));

/** Validate AI-generated email marketing for user voted. */
app.all(modulePath + "validate_ai_generate_email_marketing_user_votted", makeRequest, pollSegmentHandler("validateAiGenerateEmailMarketingUserVotted"));


/***************************************** END POLL SEGMENT API *****************************************/


/***************************************** START POLL ANALYTICS VIEW REPORT API *****************************************/
const pollAnalyticsViewReport = require(__dirname + "/model/poll_analytics_view_report");
/** Handler for poll analytics view report methods. */
const pollAnalyticsViewReportHandler = method => (req, res, next) => pollAnalyticsViewReport[method](req, res, next);

/** Get poll engagement opt-in view details. */
app.all(modulePath + "poll_engagement_opt_in_view_detail", makeRequest, pollAnalyticsViewReportHandler("pollEngagementOptinViewDetail"));

/** Get poll engagement ribbon clicks details. */
app.all(modulePath + "poll_engagement_ribbon_clicks_detail", makeRequest, pollAnalyticsViewReportHandler("pollEngagementRibbonClickDetail"));

/** Get poll engagement link clicks details. */
app.all(modulePath + "poll_engagement_link_clicks_detail", makeRequest, pollAnalyticsViewReportHandler("pollEngagementLinkClickDetail"));

/** Get poll engagement open rewards details. */
app.all(modulePath + "poll_engagement_open_rewards_detail", makeRequest, pollAnalyticsViewReportHandler("pollEngagementOpenRewardDetail"));

/** Get poll engagement comment view details. */
app.all(modulePath + "poll_engagement_comment_view_detail", makeRequest, pollAnalyticsViewReportHandler("pollEngagementCommentViewDetail"));

/** Get poll engagement share icon view details. */
app.all(modulePath + "poll_engagement_share_icon_view_detail", makeRequest, pollAnalyticsViewReportHandler("pollEngagementShareIconViewDetail"));

/** Get poll engagement opt-in percentage. */
app.all(modulePath + "poll_engagement_opt_in_percentage", makeRequest, pollAnalyticsViewReportHandler("pollEngagementOptInCount"));

/***************************************** START POLL ANALYTICS VIEW REPORT API *****************************************/


/***************************************** START LEAD EXCEL/CSV IMPORT FILE API *****************************************/
const { saveImportFileValidation } = require(WEBSITE_VALIDATION_FOLDER_PATH + 'lead_excel_validation.js');

/** Import the leadExcel model for lead Excel/CSV import file API. */
const leadExcel = require(__dirname + "/model/lead_excel");

/** Handler for leadExcel methods. */
const leadExcelHandler = method => (req, res, next) => leadExcel[method](req, res, next);

/** Get column names from the import file. */
app.all(modulePath + "get_column_name", makeRequest, leadExcelHandler("getColumnName"));

/** Save the imported file to the database. */
app.all(modulePath + "save_import_file", makeRequest, saveImportFileValidation(), validate, leadExcelHandler("saveImportFile"));

/** Get the list of imported files. */
app.all(modulePath + "get_import_file_list", makeRequest, leadExcelHandler("getImportFileList"));

/** Get import file logs details. */
app.all(modulePath + "import_file_logs_details", makeRequest, leadExcelHandler("importFileLogsDetails"));

/** Delete an uploaded import file. */
app.all(modulePath + "delete_upload_import_file", makeRequest, leadExcelHandler("deleteUploadImportFile"));

/** Get leads import file details. */
app.all(modulePath + "leads_import_details", makeRequest, leadExcelHandler("leadsImportDetails"));

/** Send welcome email to imported leads. */
app.all(modulePath + "import_leads_send_welcome_mail", makeRequest, leadExcelHandler("importLeadsSendWelcomeMail"));

/** Get welcome email ID attached to a lead slug. */
app.all(modulePath + "lead_slug_accourding_attach_welcome_email", makeRequest, leadExcelHandler("leadSlugAccourdingAttachWelcomeEmail"));


/***************************************** END LEAD EXCEL/CSV IMPORT FILE API *****************************************/


/***************************************** START POLL CAMPAIGNS API *****************************************/
/** Import the pollCampaigns model for poll campaigns API. */
const pollCampaigns = require(__dirname + "/model/poll_campaigns");

/** Handler for pollCampaigns methods. */
const pollCampaignsHandler = method => (req, res, next) => pollCampaigns[method](req, res, next);

/** Get selected segment details. */
app.all(modulePath + "get_selected_segment_details", makeRequest, pollCampaignsHandler("getSelectedSegmentDetails"));

/** Send campaign newsletter. */
app.all(modulePath + "send_campaign_newsletter", makeRequest, pollCampaignsHandler("sendCampaignNewsletter"));

/** Get active campaign template details. */
app.all(modulePath + "get_active_campaign_template_details", makeRequest, pollCampaignsHandler("getActiveCampaignTemplateDetails"));

/** Get campaign SMTP settings details. */
app.all(modulePath + "campaign_setting_SMTP_details", makeRequest, pollCampaignsHandler("campaignSettingSMTPDetails"));

/** Save campaign SMTP settings. */
app.all(modulePath + "save_campaign_setting_smtp", makeRequest, pollCampaignsHandler("saveCampaignSettingSMTP"));

/** Update campaign newsletter status. */
app.all(modulePath + "campaign_newsletter_status_change", makeRequest, pollCampaignsHandler("campaignNewsletterStatusChange"));

/** Get campaign newsletter list. */
app.all(modulePath + "get_campaign_send_newsletter_list", makeRequest, pollCampaignsHandler("getCampaignSendNewsletterList"));

/** Get campaign newsletter details. */
app.all(modulePath + "campaign_send_newsletter_detail", makeRequest, pollCampaignsHandler("campaignSendNewsletterDetail"));

/** Unsubscribe a campaign user. */
app.post(modulePath + "campaign_unsubscribe_user", makeRequest, pollCampaignsHandler("campaignUnsubscribeUser"));

/** Unsubscribe a social user. */
app.post(modulePath + "social_unsubscribe_user", makeRequest, pollCampaignsHandler("socialUnsubscribeUser"));
/***************************************** END POLL CAMPAIGNS API *****************************************/

/***************************************** START AI STEPS API *****************************************/
/** Import the aiSteps model for AI steps API. */
const aiSteps = require(__dirname + "/model/ai_steps");

/** Handler for aiSteps API methods. */
const aiStepsHandler = method => (req, res, next) => aiSteps[method](req, res, next);

/** Get the list of AI steps. */
app.all(modulePath + "get_ai_steps_list", makeRequest, aiStepsHandler("getAiStepList"));

/** Get AI reward details. */
app.all(modulePath + "get_ai_reward_details", makeRequest, aiStepsHandler("getAiRewardDetails"));

/** Edit AI reward. */
app.all(modulePath + "edit_ai_reward", makeRequest, addRewardValidationRules(), validate, aiStepsHandler("editReward"));

/** Get AI poll details. */
app.all(modulePath + "get_ai_poll_detail", makeRequest, aiStepsHandler("getAiPollDetail"));

/** Generate display ads using poll. */
app.all(modulePath + "generate_display_ads", makeRequest, aiStepsHandler("generateDisplayAdsUsingPoll"));

/***************************************** END AI STEPS API *****************************************/

/***************************************** START AI CAMPAIGN CHAT API *****************************************/
/** Import AI campaign chat, email template, SEO blog, social post, insider poll email, insider AI email template, and AI polls modules. */
const aiCampaignChat = require(__dirname + "/model/ai_campaign_chat");
const aiEmailTemplate = require(__dirname + "/model/ai_email_template");
const aiSeoBlog = require(__dirname + "/model/ai_seo_blog");
const aiSocialPost = require(__dirname + "/model/ai_social_post");
const insiderPollEmailGenerate = require(__dirname + "/model/insider_poll_email_generate");
const insiderAiEmailTemplate = require(__dirname + "/model/insider_ai_email_template");
const aiPolls = require(__dirname + "/model/ai_poll");

/** Handler for AI campaign chat methods. */
const aiCampaignChatHandler = method => (req, res, next) => aiCampaignChat[method](req, res, next);
/** Handler for AI email template methods. */
const aiEmailTemplateHandler = method => (req, res, next) => aiEmailTemplate[method](req, res, next);
/** Handler for AI SEO blog methods. */
const aiSeoBlogHandler = method => (req, res, next) => aiSeoBlog[method](req, res, next);
/** Handler for AI social post methods. */
const aiSocialPostHandler = method => (req, res, next) => aiSocialPost[method](req, res, next);
/** Handler for insider poll email generate methods. */
const insiderPollEmailGenerateHandler = method => (req, res, next) => insiderPollEmailGenerate[method](req, res, next);
/** Handler for insider AI email template methods. */
const insiderAiEmailTemplateHandler = method => (req, res, next) => insiderAiEmailTemplate[method](req, res, next);
/** Handler for AI polls methods. */
const aiPollsHandler = method => (req, res, next) => aiPolls[method](req, res, next);

/** Retrieve AI campaign details with prompt. */
app.all(modulePath + "get_campaign_detail_with_prompt", makeRequest, aiCampaignChatHandler("getCampaignDetailWithPrompt"));

/** Save AI campaign name. */
app.all(modulePath + "save_ai_campaign_name", makeRequest, aiCampaignChatHandler("saveCampaignName"));

/** Save new AI campaign name. */
app.all(modulePath + "save_ai_campaign_name_new", makeRequest, aiCampaignChatHandler("saveCampaignNameNew"));

/** Retrieve AI chat history. */
app.all(modulePath + "get_chat_history", makeRequest, aiCampaignChatHandler("getAiChatHistory"));

/** Retrieve AI chat history details. */
app.all(modulePath + "get_chat_history_detail", makeRequest, aiCampaignChatHandler("getAiChatHistoryDetails"));

/** Generate AI reward and template. */
app.all(modulePath + "ai_reward_and_template_generate", makeRequest, aiCampaignChatHandler("aiRewardTemplateGenerate"));

/** Save AI email template log. */
app.all(modulePath + "save_ai_email_log", makeRequest, aiEmailTemplateHandler("saveAiEmailTemplate"));

/** Retrieve AI email template log history. */
app.all(modulePath + "get_email_log_history", makeRequest, aiEmailTemplateHandler("getEmailTemplateHistory"));

/** Update campaign email. */
app.all(modulePath + "update_campaign_email", makeRequest, aiEmailTemplateHandler("updateCampaignEmail"));

/** Edit campaign history. */
app.all(modulePath + "edit_campaign_history", makeRequest, aiEmailTemplateHandler("editCampaignHistory"));

/** Upload image for AI-generated email template. */
app.all(modulePath + "ai_email_upload_image", makeRequest, aiEmailTemplateHandler("aiEmailUploadImage"));

/** Delete image for AI email template. */
app.all(modulePath + "delete_image_for_ai_email_template", makeRequest, aiEmailTemplateHandler("deleteImageForAiEmailTemplate"));

/** Generate welcome or newsletter email template after image upload. */
app.all(modulePath + "after_image_upload_generate_welcome_and_newsletter_email", makeRequest, aiEmailTemplateHandler("afterImageUploadGenerateWelcomeAndNewsletterEmail"));

/** Add CTA URL in email marketing. */
app.all(modulePath + "add_cta_url_in_email_marketing", makeRequest, aiEmailTemplateHandler("addCtaUrlEmailMarketing"));

/** Generate welcome email PDF. */
app.all(modulePath + "generate_welcome_email_pdf", makeRequest, aiEmailTemplateHandler("generateWelcomeEmailPdf"));

/** Save AI SEO blog log details. */
app.all(modulePath + "save_ai_seo_log", makeRequest, aiSeoBlogHandler("saveAiSeoLogDetails"));

/** Retrieve AI SEO blog log history. */
app.all(modulePath + "get_seo_log_history", makeRequest, aiSeoBlogHandler("getSeoLogHistory"));

/** Update campaign SEO blog. */
app.all(modulePath + "update_campaign_seo_blog", makeRequest, aiSeoBlogHandler("updateCampaignSeoBlog"));

/** Save AI social post log details. */
app.all(modulePath + "save_ai_social_post_log", makeRequest, aiSocialPostHandler("saveAiSocialPostDetails"));

/** Retrieve AI social post log history. */
app.all(modulePath + "get_social_post_log_history", makeRequest, aiSocialPostHandler("getSocialPostLogHistory"));

/** Update campaign social media post. */
app.all(modulePath + "update_campaign_social_media_post", makeRequest, aiSocialPostHandler("updateCampaignSocialPost"));

/** Retrieve campaign progress bar. */
app.all(modulePath + "get_campaign_progress_bar", makeRequest, aiCampaignChatHandler("getCampaignProgressBar"));

/** Update poll AI toggle. */
app.all(modulePath + "update_poll_ai_toggle", makeRequest, aiCampaignChatHandler("updatePollAiToggle"));

/** Retrieve first AI poll detail. */
app.all(modulePath + "get_ai_first_poll_detail", makeRequest, insiderPollEmailGenerateHandler("getAiFirstPollDetail"));

/** Save campaign according to user details. */
app.all(modulePath + "save_campaign_according_user_details", makeRequest, insiderPollEmailGenerateHandler("saveCampaignAccordingDetails"));

/** Retrieve AI insider campaign details. */
app.all(modulePath + "get_ai_insider_campaign_details", makeRequest, insiderPollEmailGenerateHandler("getInsiderCampaignDetails"));

/** Save insider AI email template log. */
app.all(modulePath + "save_insider_ai_email_logs", makeRequest, insiderAiEmailTemplateHandler("saveInsiderAiEmailTemplate"));

/** Retrieve insider AI email template history. */
app.all(modulePath + "get_insider_ai_email_template_history", makeRequest, insiderAiEmailTemplateHandler("getInsiderEmailTemplateHistory"));

/** Update insider campaign email. */
app.all(modulePath + "update_insider_campaign_email", makeRequest, insiderAiEmailTemplateHandler("updateInsiderCampaignEmail"));

/** Save AI poll log details. */
app.all(modulePath + "save_ai_poll_log", makeRequest, aiPollsHandler("saveAiPollLogDetails"));

/** Retrieve AI poll log history. */
app.all(modulePath + "get_poll_log_history", makeRequest, aiPollsHandler("getPollLogsHistory"));

/** Update campaign poll. */
app.all(modulePath + "update_campaign_poll", makeRequest, aiPollsHandler("updatecampaignPoll"));

/** Update manually created poll. */
app.all(modulePath + "edit_manually_poll", makeRequest, aiPollsHandler("editManuallyPoll"));

/***************************************** END AI CAMPAIGN CHAT API *****************************************/

/******************************************START WELCOME POCIAL AI API *************************************/
/** Import the welcomePocialAi module. */
const welcomePocialAi = require(__dirname + "/model/welcome_pocial_ai");

/** Handler for welcomePocialAi methods. */
const welcomePocialAiHandler = method => (req, res, next) => welcomePocialAi[method](req, res, next);

/** Get welcome Pocial AI data. */
app.all(modulePath + "welcome_pocial_ai", makeRequest, welcomePocialAiHandler("getWelcomePocialAiData"));

/******************************************END WELCOME POCIAL AI API *************************************/

/******************************************START PAYMENT GATEWAY API *************************************/
/** Import the payment gateway model. */
const paymentGateway = require(__dirname + "/model/payment_gateway");

/** Handler for payment gateway methods. */
const paymentGatewayHandler = method => (req, res, next) => paymentGateway[method](req, res, next);

/** Retrieve the list of home page plans. */
app.all(modulePath + "get_home_page_plans_list", makeRequest, paymentGatewayHandler("getHomePagePlansList"));

/** Retrieve the list of available plans. */
app.all(modulePath + "get_plans_list", makeRequest, paymentGatewayHandler("getPlansList"));

/** Select a free plan. */
app.all(modulePath + "free_plan_select", makeRequest, paymentGatewayHandler("freePlanSelect"));

/** Select a plan after customer and subscription creation. */
app.all(modulePath + "plan_select_after_customer_and_subscription_create", makeRequest, paymentGatewayHandler("planSelectAfterCustomerSubscriptionCreate"));

/** Verify payment after transaction. */
app.all(modulePath + "verify_payment", makeRequest, paymentGatewayHandler("verifyPayment"));

/** Check the user's subscription plan. */
app.all(modulePath + "check_subscriptions_plan", makeRequest, paymentGatewayHandler("checkSubscriptionsPlan"));

/** Cancel a user's subscription plan. */
app.all(modulePath + "cancel_user_subscriptions_plan", makeRequest, paymentGatewayHandler("cancelUserSubscriptionsPlan"));

/** Handle payment intents for customer transactions. */
app.all(modulePath + "payment_intents_customer_transaction", makeRequest, paymentGatewayHandler("paymentIntentsCustomerTransaction"));

/** Retrieve available plan details. */
app.all(modulePath + "get_available_plan_details", makeRequest, paymentGatewayHandler("getAvailablePlanDetails"));

/** Handle direct payment for client secret key. */
app.all(modulePath + "direct_payment_for_client_secret_key", makeRequest, paymentGatewayHandler("directPaymentClientSecretKey"));

/** Handle new payment intents for customer transactions. */
app.all(modulePath + "payment_intents_customer_transaction_new", makeRequest, paymentGatewayHandler("paymentIntentsCustomerTransactionNew"));

/** Change the month/year toggle for plans. */
app.all(modulePath + "change_month_year_toggle", makeRequest, paymentGatewayHandler("changeMonthYearToggle"));

/** Check if a promo code is valid for user purchase. */
app.all(modulePath + "check_promo_code_is_valid", makeRequest, paymentGatewayHandler("checkPromoCodeIsValid"));

/** Import express for Stripe webhook handling. */
const expressStripe = require('express');

/** Handle Stripe payment webhooks. */
app.post('/api/stripe_payment_webhook', expressStripe.raw({ type: 'application/json' }), (req, res) => {
	paymentGateway.stripePaymentWebhook(req, res);
});

/******************************************END PAYMENT GATEWAY API *************************************/


/***************************************** START AI NEW SOCIAL POST API *****************************************/
/** Import the content library model. */
const contentLibrary = require(__dirname + "/model/content_library");

/** Handler for contentLibrary methods. */
const contentLibraryHandler = method => (req, res, next) => contentLibrary[method](req, res, next);

/** Retrieve the content library. */
app.all(modulePath + "get_content_library", makeRequest, getContentLibraryValidationRules(), validate, contentLibraryHandler("getContentLibrary"));

/** Crawl home page URLs. */
app.all(modulePath + "crawl_home_page_urls", makeRequest, contentLibraryHandler("crawlHomePageUrls"));

/** Retrieve content social post. */
app.all(modulePath + "get_content_social_post", makeRequest, contentLibraryHandler("getContentSocialPost"));

/** Save the first campaign content. */
app.all(modulePath + "save_first_campaign_content", makeRequest, contentLibraryHandler("saveFirstCampaignContent"));

/** Retrieve suggested campaign name. */
app.all(modulePath + "get_suggetion_campaign_name", makeRequest, contentLibraryHandler("getSuggetionCampaignName"));

/** Edit content campaign chat. */
app.all(modulePath + "edit_content_campaign_chat", makeRequest, contentLibraryHandler("editMannualyCampaign"));

/** Upload AI-generated social post image. */
app.all(modulePath + "ai_social_upload_image", makeRequest, contentLibraryHandler("aiSocialUploadImage"));

/** Retrieve generated campaign list. */
app.all(modulePath + "get_generated_campaign_list", makeRequest, contentLibraryHandler("getGeneratedCampaignList"));

/** Delete banner image. */
app.all(modulePath + "delete_social_banner_image", makeRequest, contentLibraryHandler("deleteSocialBannerImage"));

/** Update social popup close flag. */
app.all(modulePath + "update_social_popup_close_flag", makeRequest, contentLibraryHandler("socialPopupCloseFlag"));

/** Toggle public access calendar. */
app.all(modulePath + "public_access_calendar_toggle", makeRequest, contentLibraryHandler("publicAccessCalendarToggle"));

/** Save a social post. */
app.all(modulePath + "save_social_post", makeRequest, contentLibraryHandler("saveSocialPost"));

/** Schedule a calendar post. */
app.all(modulePath + "save_calendar_schedule_post", makeRequest, contentLibraryHandler("saveCalendarSchedulePost"));

/** Retrieve scheduled post listing for user. */
app.all(modulePath + "get_calendar_schedule_post_listing", makeRequest, contentLibraryHandler("getCalendarSchedulePostListing"));

/** Retrieve content calendar dropdown count. */
app.all(modulePath + "content_calendar_dropdown_count", makeRequest, contentLibraryHandler("contentCalendarDropdownCount"));

/** Retrieve slider campaign content data. */
app.all(modulePath + "get_slider_campaign_content_data", makeRequest, contentLibraryHandler("getSliderCampaignContentData"));

/** Retrieve campaign chat details by unique key. */
app.all(modulePath + "campaign_chat_details_for_unique_key_according", makeRequest, contentLibraryHandler("campaignChatDetailsForUniqueKeyAccording"));

/** Update download flag. */
app.all(modulePath + "update_download_flag", makeRequest, contentLibraryHandler("updateDownloadFlag"));

/** Retrieve AI campaign chat details. */
app.all(modulePath + "get_ai_campaign_chat_details", makeRequest, contentLibraryHandler("getAiCampaignChatDetails"));

/** Delete AI campaign chat. */
app.all(modulePath + "delete_ai_campaign_chat", makeRequest, contentLibraryHandler("deleteAiCampaignChat"));

/** Delete scheduled post. */
app.all(modulePath + "delete_scheduled_post", makeRequest, contentLibraryHandler("deleteScheduledPost"));

/** Generate supporting content. */
app.all(modulePath + "generate_supporting_content", makeRequest, contentLibraryHandler("generateSupportingContent"));

/** Save multiple campaign data. */
app.all(modulePath + "save_multiple_campaign_new", makeRequest, contentLibraryHandler("saveMultipleCampaignNew"));

/** Generate the first social post in fallback process. */
app.all(modulePath + "generate_first_social_post_in_fallback_process", makeRequest, getFallbackDataValidationRules(), validate, contentLibraryHandler("generateFirstSocialPostInFallbackProcess"));

/** Change social carousel order. */
app.all(modulePath + "change_social_carousel_order", makeRequest, contentLibraryHandler("changeSocialCarouselOrder"));

/** Check if website is crawlable. */
app.all(modulePath + "check_website_is_crawlable", makeRequest, getContentLibraryValidationRules(), validate, contentLibraryHandler("checkWebsiteIsCrawlable"));

/** Unschedule all social posts. */
app.all(modulePath + "unschedule_all_social_post", makeRequest, contentLibraryHandler("unscheduleAllSocialPost"));

/***************************************** END AI NEW SOCIAL POST API *****************************************/


/***************************************** START SOCIAL CONTENT LIBRARY API *****************************************/
/** Import the social content library model. */
const socialContentLibrary = require(__dirname + "/model/social_content_library");

/** Handler for social content library methods. */
const socialContentLibraryHandler = method => (req, res, next) => socialContentLibrary[method](req, res, next);

/** Manually create a social post. */
app.all(modulePath + "create_social_post_manually", makeRequest, createPostManuallyValidationRules(), validate, socialContentLibraryHandler("createSocialPostManually"));

/** Update the tooltip educator. */
app.all(modulePath + "update_tooltip_educator", makeRequest, socialContentLibraryHandler("UpdateToolTipEducatorUpdate"));

/** Retrieve Pexels photos. */
app.all(modulePath + "get_pexels_photos", makeRequest, socialContentLibraryHandler("getPexelsPhotos"));

/** Retrieve AI-generated captions. */
app.all(modulePath + "get_ai_made_caption", makeRequest, socialContentLibraryHandler("getAIMadeCaption"));

/** Retrieve the campaign library list. */
app.all(modulePath + "get_campaign_library_list", makeRequest, socialContentLibraryHandler("getCampaignLibraryList"));

/** Generate a title and caption from an image. */
app.all(modulePath + "generate_title_and_caption_from_image", makeRequest, socialContentLibraryHandler("generateTitleAndCaptionFromImage"));

/** Generate a social post from a UGC uploaded image. */
app.all(modulePath + "generate_social_post_from_ugc_upload_image", makeRequest, socialContentLibraryHandler("generateSocialPostFromUgcUploadImages"));

/** Generate and schedule a week of posts. */
app.all(modulePath + "generate_week_of_post_and_schedule", makeRequest, socialContentLibraryHandler("generateWeekOfPostAndSchedule"));

/** Update user social preferences for an image. */
app.all(modulePath + "update_user_social_preferences_for_image", makeRequest, socialContentLibraryHandler("updateUserSocialPreferencesForImage"));

/** Update user onboarding data for navigation. */
app.all(modulePath + "update_user_onboarding_data_for_navigation", makeRequest, socialContentLibraryHandler("updateUserOnboardingDataForNavigation"));
/***************************************** END SOCIAL CONTENT LIBRARY API *****************************************/


/***************************************** START AI CAMPAIGN LOGS API *****************************************/
/** Import the AI campaign logs model. */
const campaignLogs = require(__dirname + "/model/ai_campaign_logs");
/** Handler for AI campaign logs methods. */
const campaignLogsHandler = method => (req, res, next) => campaignLogs[method](req, res, next);

/** Retrieve AI campaign logs. */
app.all(modulePath + "get_ai_campaign_logs", makeRequest, campaignLogsHandler("getAiCampaignlogs"));
/** Retrieve the AI campaign list. */
app.all(modulePath + "get_ai_campaign_list", makeRequest, campaignLogsHandler("getAiCampaignList"));

/***************************************** END AI AI CAMPAIGN LOGS API *****************************************/


/***************************************** START INSTAGRAM POST API *****************************************/
/** Import the Instagram module. */
const instagramModule = require(__dirname + "/model/instagram");
/** Handler for Instagram API methods. */
const instagramHandler = method => (req, res, next) => instagramModule[method](req, res, next);

/** Generate a long-lived Instagram token. */
app.all(modulePath + "generate_long_lived_token", makeRequest, instagramHandler("generateLongLivedToken"));

/** Upload a single image to Instagram. */
app.all(modulePath + "single_image_upload_for_instagram", makeRequest, instagramHandler("singleImageUploadForInstagram"));

/** Reschedule an Instagram post. */
app.all(modulePath + "re_scheduled_instagram_post", makeRequest, instagramHandler("reScheduledInstagramPost"));

/** Log out from Instagram. */
app.all(modulePath + "logout_instagram", makeRequest, instagramHandler("logoutInstagram"));

/** Upload a story to Instagram. */
app.all(modulePath + "story_upload_for_instagram", makeRequest, instagramHandler("storyUploadForInstagram"));

/** Publish a story using a popup image URL on Instagram. */
app.all(modulePath + "publish_as_story_on_popup_image_url", makeRequest, instagramHandler("publishAsStoryOnPopupImageUrl"));

/** Crawl Instagram login user data. */
app.all(modulePath + "crawl_to_instagram_login_user_data", makeRequest, instagramHandler("crawlToInstagramLoginUserData"));

/** Routing is used to check access token valid/invalid */
app.all(modulePath + "social_token_valid_check", makeRequest, instagramHandler("socialTokenValidCheck"));

/***************************************** END INSTAGRAM POST API *****************************************/


/***************************************** START FACEBOOK API *****************************************/
/** Import the Facebook module and define a handler for Facebook API methods. */
const facebookModule = require(__dirname + "/model/facebook");
const facebookHandler = method => (req, res, next) => facebookModule[method](req, res, next);

/** Generate a Facebook long-lived token. */
app.all(modulePath + "generate_facebook_long_lived_token", makeRequest, facebookHandler("generateFacebookLongLivedToken"));

/** Get the Facebook page list. */
app.all(modulePath + "facebook_page_list", makeRequest, facebookHandler("facebookPageList"));

/** Directly publish to Facebook. */
app.all(modulePath + "direct_published_facebook", makeRequest, facebookHandler("directPublishedFacebook"));

/** Directly publish a story to Facebook. */
app.all(modulePath + "direct_published_story_for_facebook", makeRequest, facebookHandler("directPublishedStoryForFacebook"));

/** Select a Facebook page. */
app.all(modulePath + "select_facebook_page", makeRequest, facebookHandler("selectFacebookPage"));

/***************************************** END FACEBOOK POST API *****************************************/


/***************************************** START ABOUT MY BUSINESS API *****************************************/
/** Import the About My Business module and define a handler for its methods. */
const aboutMyBusiness = require(__dirname + "/model/about_my_business");
const aboutMyBusinessHandler = method => (req, res, next) => aboutMyBusiness[method](req, res, next);

/** Get website crawler details using the new process. */
app.all(modulePath + "website_crawler_details_new_process", makeRequest, aboutMyBusinessHandler("websiteCrawlerDetailsNewProcess"));

/** Get website crawler details. */
app.all(modulePath + "website_crawler_details", makeRequest, aboutMyBusinessHandler("websiteCrawlerDetails"));

/** Get social media presence details. */
app.all(modulePath + "social_media_presence_details", makeRequest, aboutMyBusinessHandler("socialMediaPresenceDetails"));

/** Upload a document to the data vault. */
app.all(modulePath + "data_vault_upload_document", makeRequest, aboutMyBusinessHandler("dataVaultUploadDocument"));

/** Get the list of about documents. */
app.all(modulePath + "get_about_document_list", makeRequest, aboutMyBusinessHandler("getAboutDocumentList"));

/** Delete an about document. */
app.all(modulePath + "delete_about_document", makeRequest, aboutMyBusinessHandler("deleteAboutDocument"));

/** Update the data vault. */
app.all(modulePath + "update_data_vault", makeRequest, aboutMyBusinessHandler("updateDataVault"));

/** Save the AI database structure. */
app.all(modulePath + "save_ai_data_base_structure", makeRequest, aboutMyBusinessHandler("aiDatabaseStructure"));

/** Get Apify Instagram details. */
app.all(modulePath + "get_apify_instagram_details", makeRequest, aboutMyBusinessHandler("getApifyDetails"));
/***************************************** END ABOUT MY BUSINESS API *****************************************/



/***************************************** START UGC MY UGC GALLERY API *****************************************/
/** Import the UGC Gallery module and define a handler for its methods. */
const ugcGallery = require(__dirname + "/model/ugc_gallery");
const ugcGalleryHandler = method => (req, res, next) => ugcGallery[method](req, res, next);

/** Upload a UGC gallery image. */
app.all(modulePath + "upload_ugc_gallery", makeRequest, ugcGalleryHandler("uploadUgcGallery"));

/** Get the UGC gallery list. */
app.all(modulePath + "ugc_gallery_list", makeRequest, ugcGalleryHandler("ugcGalleryList"));

/** Delete a UGC gallery image. */
app.all(modulePath + "delete_ugc_gallery_image", makeRequest, ugcGalleryHandler("deleteUgcGalleryImages"));

/***************************************** END UGC MY UGC GALLERY API *****************************************/

/***************************************** START MULTIPLE ACCOUNT API *****************************************/
/** Import the multiple account module and define a handler for its methods. */
const multipleAccount = require(__dirname + "/model/multiple_account");
const multipleAccountHandler = method => (req, res, next) => multipleAccount[method](req, res, next);

/** Assign a user account. */
app.all(modulePath + "assign_user_account", makeRequest, multipleAccountHandler("assignMultipleAccount"));

/** Retrieve the list of assigned users. */
app.all(modulePath + "get_assign_users_list", makeRequest, multipleAccountHandler("getAssignUsersList"));

/** Delete an assigned user. */
app.all(modulePath + "delete_assign_user", makeRequest, multipleAccountHandler("deleteAssignUser"));

/** Retrieve the assigned user list after login. */
app.all(modulePath + "after_login_user_assign_list", makeRequest, multipleAccountHandler("afterLoginUserAssignList"));

/** Create a user group. */
app.all(modulePath + "create_user_group", makeRequest, multipleAccountHandler("createUserGroup"));

/** Retrieve the list of user groups. */
app.all(modulePath + "get_group_list", makeRequest, multipleAccountHandler("getGroupList"));

/** Retrieve the user group list for dropdown. */
app.all(modulePath + "group_list_dropdown", makeRequest, multipleAccountHandler("groupListDropdown"));

/** Update a user group. */
app.all(modulePath + "update_user_group", makeRequest, multipleAccountHandler("updateUserGroup"));

/** Retrieve user group details. */
app.all(modulePath + "get_user_group_details", makeRequest, multipleAccountHandler("getUserGroupDetails"));

/** Delete a user group. */
app.all(modulePath + "delete_user_group", makeRequest, multipleAccountHandler("deleteUserGroup"));

/** Retrieve the owner's group social post listing. */
app.all(modulePath + "owner_group_social_post_listing", makeRequest, multipleAccountHandler("ownerGroupSocialPostListing"));

/** Retrieve the group user review list. */
app.all(modulePath + "review_group_user_list", makeRequest, multipleAccountHandler("reviewGroupUserList"));

/***************************************** END MULTIPLE ACCOUNT API *****************************************/

/***************************************** START WEB CRAWL DATA API *****************************************/
/** Import the web crawl module and define a handler for its methods. */
const webCrawl = require(__dirname + "/model/web_crawl");
const webCrawlHandler = method => (req, res, next) => webCrawl[method](req, res, next);

/** Crawl website data. */
app.all(modulePath + "crawl_website_data", makeRequest, webCrawlHandler("crawlWebsiteData"));

/** Rediscover social media presence. */
app.all(modulePath + "rediscover_social_media_presence", makeRequest, webCrawlHandler("rediscoverSocialMediaPresence"));

/** Rediscover Apify Instagram data. */
app.all(modulePath + "rediscover_apify_data", makeRequest, webCrawlHandler("rediscoverApifyInstagramData"));

/***************************************** END WEB CRAWL DATA API *****************************************/

/***************************************** START INSTAGRAM CRAWL DATA API *****************************************/
/** Import the Instagram crawl module and define a handler for its methods. */
const instagramCrawl = require(__dirname + "/model/instagram_crawl");
const instagramCrawlHandler = method => (req, res, next) => instagramCrawl[method](req, res, next);

/** Crawl Instagram data. */
app.all(modulePath + "crawl_instagram_data", makeRequest, instagramCrawlHandler("crawlInstagramData"));

/** Crawl basic Instagram data. */
app.all(modulePath + "crawl_instagram_data_basic", makeRequest, instagramCrawlHandler("crawlInstagramDataBasic"));

/** Crawl Instagram data for onboarding. */
app.all(modulePath + "crawl_instagram_data_for_onboarding", makeRequest, instagramCrawlHandler("crawlInstagramDataForOnboarding"));


/***************************************** END INSTAGRAM CRAWL DATA API *****************************************/

/***************************************** START USERS ROUTING API *****************************************/

/** Import the audience API module and define a handler for its methods. */
const audienceApi = require(__dirname + "/model/audience");
const audienceHandler = method => (req, res, next) => audienceApi[method](req, res, next);

/** Get the audience list. */
app.all(modulePath + "get_audience_list", makeRequest, audienceHandler("getAudienceList"));

/** Choose from audiences. */
app.all(modulePath + "choose_from_audiences", makeRequest, audienceHandler("chooseFromAudiences"));

/** Create an audience. */
app.all(modulePath + "create_audience", makeRequest, createAudienceValidationRules(), validate, audienceHandler("createAudience"));

/** Edit an audience. */
app.all(modulePath + "edit_audience", makeRequest, editAudienceValidationRules(), validate, audienceHandler("editAudience"));

/** Get audience details. */
app.all(modulePath + "get_audience_details", makeRequest, audienceHandler("getAudienceDetails"));

/** View an audience. */
app.all(modulePath + "view_audience", makeRequest, audienceHandler("viewAudience"));

/** Refresh an audience. */
app.all(modulePath + "refresh_audience", makeRequest, audienceHandler("refreshAudience"));

/** Get selected audience details. */
app.all(modulePath + "get_selected_audiences_details", makeRequest, audienceHandler("getSelectedAudienceDetails"));

/** Add more audience data. */
app.all(modulePath + "add_more_audience", makeRequest, audienceHandler("addMoreAudience"));

/***************************************** START GROWTH AUTOMATION API *****************************************/
/** Import the growth automation module and define a handler for its methods. */
const growthAutomation = require(__dirname + "/model/growth_automation");
const growthAutomationHandler = method => (req, res, next) => growthAutomation[method](req, res, next);

/** Get the QR code signup list. */
app.all(modulePath + "get_insider_email_poll_and_reward", makeRequest, growthAutomationHandler("getInsiderEmailPollAndReward"));

/** Assign insider email, reward, and poll. */
app.all(modulePath + "assign_insider_email_rewad_and_poll", makeRequest, growthAutomationHandler("assignInsiderEmailRewadAndPoll"));

/** Upload reward images. */
app.all(modulePath + "upload_reward_image", makeRequest, growthAutomationHandler("uploadRewardImages"));

/** Update the user insider toggle. */
app.all(modulePath + "update_user_insider_toggle", makeRequest, growthAutomationHandler("updateUserInsiderToggle"));

/** Get the selected reward from email or poll. */
app.all(modulePath + "get_selected_reward_from_email_or_poll", makeRequest, growthAutomationHandler("getSelectedRewardFromEmailOrPoll"));


/******************************************START LINKEDIN API ****************************************/
/** Import the LinkedIn API module and define a handler for its methods. */
const linkedin = require(__dirname + "/model/linkedin");
const linkedinHandler = method => (req, res, next) => linkedin[method](req, res, next);

/** Generate a LinkedIn long-lived token. */
app.all(modulePath + "generate_linkedin_long_lived_token", makeRequest, linkedinHandler("generateLinkedinLongLivedToken"));

/** Post on LinkedIn. */
app.all(modulePath + "post_on_linkedin", makeRequest, linkedinHandler("postOnLinkedin"));

/******************************************END LINKEDIN API ****************************************/

/******************************************START HEART CHAMPION API ****************************************/
/** Import the Heart Champion module and define a handler for its methods. */
const heartOfChampion = require(__dirname + "/model/heart_champion");
const heartChampionHandler = method => (req, res, next) => heartOfChampion[method](req, res, next);

/** Create a Heart Champion. */
app.all(modulePath + "create_heart_of_champion", makeRequest, heartChampionHandler("createHeartChampion"));

/** Get Heart Champion details. */
app.all(modulePath + "get_heart_champion_details", makeRequest, heartChampionHandler("getHeartChampionDetails"));

/******************************************END HEART CHAMPION API ****************************************/



/***************************************** Common Routing API *****************************************/

/**
 * Middleware to process third-party lead submissions.
 * Parses 'other_data' from the request body, sets debug flags, and marks as third-party lead.
 * Uses async/await for future extensibility and to support async operations if needed.
 */
async function makeRequestLead(req, res, next) {
	try {
		// Parse 'other_data' if present, otherwise set to empty object
		req.body = (req.body && req.body.other_data) ? JSON.parse(req.body.other_data) : {};

		// Set debug flags and third-party lead indicator
		req.body.debug_json_view = 1;
		req.body.debugJsonView = 1;
		req.body.leadSubmitThirdParty = 1;

		// Proceed to next middleware
		return next();
	} catch (error) {
		// Handle JSON parsing errors or any unexpected errors
		console.error('Error in makeRequestLead middleware:', error);
		return res.status(400).json({ error: 'Invalid request data.' });
	}
}

/**
 * Function to make request for API
 * Uses async/await for all asynchronous operations and provides clear comments for each step.
 */
async function makeRequest(req, res, next) {
	try {
		// Get domain URL and client IP address
		const domain = req.protocol + '://' + req.get('host');
		let ip =
			(req.headers['x-forwarded-for'] || '').split(',').pop() ||
			req.connection.remoteAddress ||
			req.socket.remoteAddress ||
			(req.connection.socket ? req.connection.socket.remoteAddress : undefined);

		// Special handling for pocial.com API domain
		if (domain === 'http://api.pocial.com' || domain === 'https://api.pocial.com') {
			ip =
				(req.headers['x-forwarded-for'] || '').split(',').shift() ||
				req.connection.remoteAddress ||
				req.socket.remoteAddress ||
				(req.connection.socket ? req.connection.socket.remoteAddress : undefined);
		}

		// Remove IPv6 prefix if present
		if (ip && ip.substr(0, 7) === "::ffff:") {
			ip = ip.substr(7);
		}

		// Set default timezone and abbreviation
		let defaultTimeZone = USER_REGISTRATION_DEFAULT_TIMEZONE;
		let timeZoneAbbreviation = USER_REGISTRATION_DEFAULT_DEFAULT_ABBREVIATION;

		// Lookup geo information for timezone
		const geo = geoip.lookup(ip);
		if (geo && geo.timezone) {
			defaultTimeZone = geo.timezone;
			timeZoneAbbreviation = getTimezoneAbbreviation(defaultTimeZone);
		}

		// Extract and decode input data
		const inputData = req.body.req ? req.body.req : "";
		const debugJsonView = req.body.debug_json_view ? req.body.debug_json_view : 0;
		const isCrypto = req.body.is_crypto ? Number(req.body.is_crypto) : DEACTIVE;
		const apiType = req.body.api_type ? req.body.api_type : WEP_API_TYPE;
		const isViewType = req.body.is_view_type ? req.body.is_view_type : POLL_DESKTOP_VIEW;

		if (inputData !== '') {
			let decodedData = "";

			// If debugJsonView is set and inputData is a JSON string, use as is
			if (debugJsonView && inputData.indexOf("{") === 0) {
				decodedData = inputData;
			} else {
				// Decrypt if crypto is active, otherwise decode from base64
				if (isCrypto === ACTIVE && apiType === WEP_API_TYPE) {
					decodedData = decryptCrypto(inputData);
				} else {
					decodedData = b64DecodeUnicode(inputData);
				}
			}

			let APIData;
			try {
				APIData = JSON.parse(decodedData);
			} catch (err) {
				console.log("Error in makeRequest middleware:", err);
				return res.status(400).json({
					message: res.__("admin.system.invalid_access"),
					status: STATUS_ERROR,
				});
			}

			const methodName = APIData.method_name ? APIData.method_name : '';
			const device_type = APIData.device_type ? APIData.device_type : "";
			const device_id = APIData.device_id ? APIData.device_id : "";
			const device_token = APIData.device_token ? APIData.device_token : "";
			const embedType = APIData.embed_type ? APIData.embed_type : "";

			// Set request body and defaults
			req.body = APIData.data ? APIData.data : {};
			req.body.limit = res.locals.settings["Site.record_per_page"] ? res.locals.settings["Site.record_per_page"] : API_DEFAULT_LIMIT;

			req.body.ip = ip;
			req.body.default_timezone = defaultTimeZone;
			req.body.default_timezone_abbreviation = timeZoneAbbreviation;
			req.body.embed_type = embedType;

			// Trim all string fields in the request body
			const bodyData = req.body;
			Object.keys(bodyData).forEach(
				k => (bodyData[k] = typeof bodyData[k] === 'string' ? bodyData[k].trim() : bodyData[k])
			);

			// Prepare for user slug lookup if present
			const slug = req.body.slug ? req.body.slug : "";
			let conditionOptions = {};
			if (slug !== "") {
				conditionOptions = {
					conditions: { slug: slug },
				};
			}

			// Prepare JWT authentication options
			const jwtOption = {
				token: req.headers.authorization ? req.headers.authorization : "",
				secretKey: JWT_CONFIG.secret,
				slug: req.body.slug ? req.body.slug : "",
			};

			// JWT Authentication (async/await)
			let responseData;
			try {
				responseData = await JWTAuthentication(req, res, jwtOption);
			} catch (err) {
				console.log("Error in JWTAuthentication:", err);
				return res.status(401).json({
					message: res.__("admin.system.invalid_access"),
					status: STATUS_ERROR,
				});
			}

			req.body['debugJsonView'] = debugJsonView;

			if (responseData.status !== STATUS_SUCCESS) {
				console.log("Error in responseData:", responseData);
				const returnResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("admin.system.invalid_access"),
					},
				};
				return returnApiResult(req, res, returnResponse);
			}

			// Fetch user details by slug if present (async/await)
			let userDetailResponse = { status: STATUS_ERROR };
			if (slug !== "") {
				try {
					userDetailResponse = await getUserDetailBySlug(req, res, conditionOptions);
				} catch (err) {
					userDetailResponse = { status: STATUS_ERROR };
				}
			}

			// If user details found, update user_data and timezone
			if (slug !== "" && userDetailResponse.status === STATUS_SUCCESS) {
				req.user_data = userDetailResponse.result ? userDetailResponse.result : {};
				defaultTimeZone =
					userDetailResponse.result && userDetailResponse.result.current_timezone
						? userDetailResponse.result.current_timezone
						: defaultTimeZone;
			}

			// Set common request keys
			req.body['request_from'] = REQUEST_FROM_API;
			req.body['is_mobile_verified'] = NOT_VERIFIED;
			req.body['is_email_verified'] = NOT_VERIFIED;
			req.body['api_type'] = apiType;
			req.body['is_crypto'] = isCrypto;
			req.body['device_type'] = device_type;
			req.body['device_id'] = device_id;
			req.body['device_token'] = device_token;
			req.body['method_name'] = methodName;
			req.body['is_view_type'] = isViewType;
			req.body['default_timezone'] = defaultTimeZone;

			// Proceed to next middleware
			return next();
		} else {
			// If inputData is blank, send error response
			return res.send({
				message: res.__("admin.system.invalid_access"),
				status: STATUS_ERROR,
			});
		}
	} catch (error) {
		// Handle unexpected errors
		console.error('Error in makeRequest middleware:', error);
		return res.status(500).json({
			message: res.__("admin.system.invalid_access"),
			status: STATUS_ERROR,
		});
	}
}

/** Going backwards: from bytestream, to percent-encoding, to original string.*/
b64DecodeUnicode = (str) => {
	return decodeURIComponent(atob(str).split("").map(function (c) {
		return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
	}).join(""));
};