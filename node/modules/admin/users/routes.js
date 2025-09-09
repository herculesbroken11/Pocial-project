/** Model file path for current plugin **/
var modelPath = __dirname + "/model/user";
var modulePath = "/" + ADMIN_NAME + "/users/:user_type/";
const { loginValidationRules, addUserValidationRules, editUserValidationRules, forgetPasswordValidationRules, editUserProfileValidationRules, resetPasswordValidationRules, addMasterTurnOnDateValidationRules, updateLimitValidationRules, acceptPaymentValidationRules, uploadEnterpriseValidationRules, validate } = require(__dirname + "/user_validation/validator.js")

/** Before login routings **/

/** Routing is used to render html and submit login form **/
app.all(["/" + ADMIN_NAME + "/login", "/" + ADMIN_NAME], isLoggedIn, loginValidationRules(), validate, (req, res, next) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";

    /** Set layout  **/
    req.rendering.layout = WEBSITE_ADMIN_LAYOUT_PATH + "before_login";

    var adminUser = require(modelPath);
    adminUser.login(req, res, next);
});

/** Routing is used to render html and submit forgot password form **/
app.all("/" + ADMIN_NAME + "/forgot-password", forgetPasswordValidationRules(), validate, (req, res) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";

    /** Set layout  **/
    req.rendering.layout = WEBSITE_ADMIN_LAYOUT_PATH + "before_login";

    var adminUser = require(modelPath);
    adminUser.forgotPassword(req, res);
});

/** Routing is used to render html and submit reset password form **/
app.all("/" + ADMIN_NAME + "/reset-password", resetPasswordValidationRules(), validate, (req, res) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";

    /** Set layout  **/
    req.rendering.layout = WEBSITE_ADMIN_LAYOUT_PATH + "before_login";

    var adminUser = require(modelPath);
    adminUser.resetPassword(req, res);
});



/** Routing is used to render dashboard html with only from_date */
app.get("/" + ADMIN_NAME + "/dashboard/:from_date", checkLoggedInAdmin, (req, res, next) => {

    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";

    var adminUser = require(modelPath);
    adminUser.dashboard(req, res, next);
});

/** Routing is used to render dashboard html with no dates */
app.get("/" + ADMIN_NAME + "/dashboard", checkLoggedInAdmin, (req, res, next) => {

    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";

    var adminUser = require(modelPath);
    adminUser.dashboard(req, res, next);
});

/** Routing is used to list lead subscribers html */
app.all("/" + ADMIN_NAME + "/view_leads_subscribers/:stage_level", checkLoggedInAdmin, (req, res, next) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";
    var adminUser = require(modelPath);
    adminUser.viewDashboardLeadsSubscriber(req, res, next);
});

/** Routing is used to list lead subscribers html without stage_level */
app.all("/" + ADMIN_NAME + "/view_leads_subscribers", checkLoggedInAdmin, (req, res, next) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";
    var adminUser = require(modelPath);
    adminUser.viewDashboardLeadsSubscriber(req, res, next);
});

/** Routing is used to view lead subscribers html */
app.all("/" + ADMIN_NAME + "/view_leads_subscribers/view/:id", checkLoggedInAdmin, (req, res, next) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";
    var adminUser = require(modelPath);
    adminUser.viewLeadsSubscriberDetails(req, res, next);
});

/** Routing is used to send_to_admin_approve **/
app.all("/" + ADMIN_NAME + "/send_to_admin_approve/:id", (req, res, next) => {
    /** Set current view folder **/
    var adminUser = require(modelPath);
    adminUser.requestSendToAdminApprove(req, res, next);
});

/** Routing is used to render subadmin layout html */
app.all("/" + ADMIN_NAME + "/login_user/:validate_string", (req, res, next) => {
    /** Set current view folder **/
    req.rendering.views = __dirname + "/views";

    var adminUser = require(modelPath);
    adminUser.loginSubAdmin(req, res, next);
});

/** Set current view folder **/
app.use(modulePath, (req, res, next) => {
    req.rendering.views = __dirname + "/views";
    next();
});

/** Routing is used to edit user **/
app.all("/" + ADMIN_NAME + "/edit_profile", checkLoggedInAdmin, editUserProfileValidationRules(), validate, (req, res, next) => {
    req.rendering.views = __dirname + "/views";
    var adminUser = require(modelPath);
    adminUser.editProfile(req, res, next);
});

/** Routing is used to add user **/
app.all(modulePath + "add", checkLoggedInAdmin, addUserValidationRules(), validate, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.addUser(req, res, next);
});

/** Routing is used to edit user **/
app.all(modulePath + "edit/:id/:view_page", checkLoggedInAdmin, editUserValidationRules(), validate, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.editUser(req, res, next);
});

/** Routing is used to edit user without view_page **/
app.all(modulePath + "edit/:id", checkLoggedInAdmin, editUserValidationRules(), validate, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.editUser(req, res, next);
});

/** Routing is used to view user details **/
app.get(modulePath + "view/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.viewUserDetails(req, res, next);
});

/** Routing is used to view plan details **/
app.get(modulePath + "view_plan/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.viewPlanDetails(req, res, next);
});

/** Routing is used to manage link details **/
app.get(modulePath + "manage_link/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.manageLink(req, res, next);
});

/** Routing is used to update user status **/
app.all(modulePath + "update_user_status/:id/:status/:status_type/:view_page", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updateUserStatus(req, res, next);
});

/** Routing is used to update user status without view_page **/
app.all(modulePath + "update_user_status/:id/:status/:status_type", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updateUserStatus(req, res, next);
});

/** Routing is used to convert public business account user **/
app.all(modulePath + "convert_business_account/:id/:view_page", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.convertBusinessAccount(req, res, next);
});

/** Routing is used to convert public business account user without view_page **/
app.all(modulePath + "convert_business_account/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.convertBusinessAccount(req, res, next);
});

/** Routing is used to get master account listing user **/
app.all(modulePath + "get_master_account/:id/:view_page", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.getMasterAccount(req, res, next);
});

/** Routing is used to get master account listing user without view_page **/
app.all(modulePath + "get_master_account/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.getMasterAccount(req, res, next);
});

/** Routing is used to add sub user **/
app.all(modulePath + "add_sub_users", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.addSubUsers(req, res, next);
});

/** Routing is used to varify email and mobile **/
app.all(modulePath + "verify_email_or_mobile_status/:id/:verify_type/:view_page", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.verifyEmailOrMobile(req, res, next);
});

/** Routing is used to varify email and mobile without view_page **/
app.all(modulePath + "verify_email_or_mobile_status/:id/:verify_type", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.verifyEmailOrMobile(req, res, next);
});

/** Routing is used to view redemptions listing rewards **/
app.all(modulePath + "view_redemptions/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.viewRedemptions(req, res, next);
});

/** Routing is used to my wallet rewards **/
app.all(modulePath + "my_wallet_rewards/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.myWalletRewards(req, res, next);
});

/** Routing is used to my wallet redeem rewards **/
app.all(modulePath + "wallet_redeem_rewards/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.walletRedeemRewards(req, res, next);
});

/** Routing is used to followers & following users **/
app.all(modulePath + "followers_following_users/:follow_type_page/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.followersFollowingUsersList(req, res, next);
});

/** Routing is used to get user list modal open **/
app.all(modulePath + "get_user_list_modal_open/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.getUserListModalOpen(req, res, next);
});

/** Routing is used to delete Image **/
app.all(modulePath + "user_delete_image/:user_id/:image_type", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.userDeleteImage(req, res, next);
});

/** Routing is used to view earn sent rewards **/
app.all(modulePath + "view_earn_sent_reward/:slug/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.viewEarnSentReward(req, res, next);
});

/** Routing is used to update segment status **/
app.all(modulePath + "update_segment_status/:id/:status_type", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updateUserSegmentStatus(req, res, next);
});

/** Routing is used to update allow access platform status **/
app.all(modulePath + "update_allow_access_platform/:user_id/:status_type", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updateAllowAccessPlatform(req, res, next);
});

/** Routing is used to update allow access platform status **/
app.all(modulePath + "add_master_turn_on_date", checkLoggedInAdmin, addMasterTurnOnDateValidationRules(), validate, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.addMasterTurnOnDate(req, res, next);
});

/** Routing is used to update auto pay status **/
app.all(modulePath + "update_auto_pay_status/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updateAutoPayStatus(req, res, next);
});

/** Routing is used to cancel user subscription **/
app.all(modulePath + "cancel_user_subscription/:user_id/:subscription_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.cancelUserSubscriptions(req, res, next);
});

/** Routing is used to update limit**/
app.all(modulePath + "update_limit", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updatePlanData(req, res, next);
});

/** Routing is used to update plan limit days month**/
app.all(modulePath + "plan_limit_days_month", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updatePlanLimitDaysMonth(req, res, next);
});

/** Routing is used to accept payment offline **/
app.all(modulePath + "offline_payment/:id/:price_toggle", checkLoggedInAdmin, acceptPaymentValidationRules(), validate, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.acceptPaymentOffline(req, res, next);
});

/** Routing is used to enterprise upload sheets list**/
app.all(modulePath + "enterprise_upload_list/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.getEnterpriseUploadList(req, res, next);
});

/** Routing is used to upload enterprise sheets**/
app.all(modulePath + "upload_enterprise/:user_id", checkLoggedInAdmin, uploadEnterpriseValidationRules(), validate, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.uploadEnterpriseSheet(req, res, next);
});

/** Routing is used to update enetrprise status **/
app.all(modulePath + "update_enetrprise_status/:user_id/:status_type", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.updateEnterpriseStatus(req, res, next);
});

/** Routing is used to delete enetrprise **/
app.all(modulePath + "enterprise_upload_list/delete_enterprise/:user_id/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.deleteEnterprise(req, res, next);
});

/** Routing is used to enterprise upload sheets list**/
app.all(modulePath + "enterprise_import_details/:id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminUser = require(modelPath);
    adminUser.enterPriseImportDetails(req, res, next);
});
/******************************************************************** START MANAGE REWARDS ********************************************************************/
const { addRewardValidationRules, editRewardValidationRules } = require(__dirname + "/user_validation/reward_validator.js")
var modelRewardPath = __dirname + "/model/rewards";

/** Routing is used to manage rewards **/
app.all(modulePath + "manage_rewards/:id", checkLoggedInAdmin, (req, res, next) => {
    var adminReward = require(modelRewardPath);
    adminReward.getRewardsList(req, res, next);
});

/** Routing is used to add manage rewards **/
app.all(modulePath + "manage_rewards/add/:id", checkLoggedInAdmin, addRewardValidationRules(), validate, (req, res, next) => {
    var adminReward = require(modelRewardPath);
    adminReward.addRewards(req, res, next);
});

/** Routing is used to edit manage rewards **/
app.all(modulePath + "manage_rewards/edit/:id/:user_id", checkLoggedInAdmin, editRewardValidationRules(), validate, (req, res, next) => {
    var adminReward = require(modelRewardPath);
    adminReward.editReward(req, res, next);
});

/** Routing is used to delete reward image **/
app.all(modulePath + "delete_reward_image/:id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminReward = require(modelRewardPath);
    adminReward.deleteRewardImage(req, res, next);
});

/** Routing is used to delete and status rewards **/
app.all(modulePath + "manage_rewards_delete_and_status/:id/:status/:status_type/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminReward = require(modelRewardPath);
    adminReward.rewardDeleteAndStatus(req, res, next);
});

/******************************************************************** END MANAGE REWARDS ********************************************************************/


/******************************************************************** START MANAGE EMAILS ********************************************************************/

const { addEmailTemplateValidation, sendTestEmailTemplateValidation } = require(__dirname + "/user_validation/manage_email_validator.js")
var modelEmailPath = __dirname + "/model/emails";

/** Routing is used to get emails list**/
app.all(modulePath + "manage_emails/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.getManageEmailList(req, res, next);
});

/** Routing is used to add complete email routes  **/
app.all(modulePath + "manage_emails/add/:user_id", checkLoggedInAdmin, addEmailTemplateValidation(), validate, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.addTemplate(req, res, next);
});

/** Routing is used to add drafts email routes  **/
app.all(modulePath + "manage_emails/add_drafts/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.addTemplateDrafts(req, res, next);
});

/** Routing is used to delete drafts email routes  **/
app.all(modulePath + "manage_emails/delete_template_draft/:template_id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.deleteTemplateDraft(req, res, next);
});

/** Routing is used to edit complete email routes  **/
app.all(modulePath + "manage_emails/edit/:template_id/:template_url_type/:user_id", checkLoggedInAdmin, addEmailTemplateValidation(), validate, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.editWelcomeEmailTemplate(req, res, next);
});

/** Routing is used to view details complete email template  **/
app.all(modulePath + "manage_emails/view/:id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.viewTemplateDetials(req, res, next);
});

/** Routing is used to template update status **/
app.all(modulePath + "manage_emails_template_status_change/:id/:status/:status_type/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.templateStatusChange(req, res, next);
});

/** Routing is used to get rewards dropdown list  **/
app.all(modulePath + "get_rewards_dropdown_list/:template_id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.getRewardsDropdownList(req, res, next);
});

/** Routing is used to attach reward  **/
app.all(modulePath + "attach_reward_in_template", checkLoggedInAdmin, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.attachRewardEmailTemplate(req, res, next);
});

/** Routing is used to send test email routes  **/
app.all(modulePath + "send_test_email", checkLoggedInAdmin, sendTestEmailTemplateValidation(), validate, (req, res, next) => {
    var adminEmails = require(modelEmailPath);
    adminEmails.sendTestEmail(req, res, next);
});


/******************************************************************** END MANAGE EMAILS ********************************************************************/


/******************************************************************** START LEADS FORM ROUTES ********************************************************************/
const { addLeadCreateFormValidationRules, scriptCustomizationValidation } = require(__dirname + "/user_validation/lead_validator.js")
var modelLeadPath = __dirname + "/model/leads_form";

/** Routing is used to manage leads data  **/
app.all(modulePath + "manage_leads/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.getLeadsFormList(req, res, next);
});

/** Routing is used to overview lead dashboard  **/
app.all(modulePath + "manage_leads/overview_lead_dashboard/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.overviewLeadDashboard(req, res, next);
});

/** Routing is used add leads data **/
app.all(modulePath + "manage_leads/add/:user_id", checkLoggedInAdmin, addLeadCreateFormValidationRules(), validate, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.addLeads(req, res, next);
});

/** Routing is used edit leads data **/
app.all(modulePath + "manage_leads/edit/:id/:user_id", checkLoggedInAdmin, addLeadCreateFormValidationRules(), validate, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.editLead(req, res, next);
});

/** Routing is used to view leads details **/
app.all(modulePath + "manage_leads/view/:id/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewLeads(req, res);
});

/** Routing is used delete leads data **/
app.all(modulePath + "manage_leads/delete/:id/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.deleteLead(req, res);
});

/** Routing is used to get scripted code **/
app.all(modulePath + "manage_leads/get_scripted_code/:id", checkLoggedInAdmin, scriptCustomizationValidation(), validate, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.getScriptedCode(req, res);
});

/** Routing is used to generate embeded code **/
app.all(modulePath + "manage_leads/generate_embed_code/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.generateEmbedCode(req, res);
});

/** Routing is used to assign home page **/
app.all(modulePath + "manage_leads/assign_home_page/:id/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.assignHomePage(req, res);
});

/** Routing is used to get script code preview **/
app.all(modulePath + "manage_leads/get_script_code_preview/:id/:scripted_data", (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.getScriptCodePreview(req, res);
});

/** Routing is used to view entire subscriber **/
app.all(modulePath + "manage_leads/view_entire_subscriber/:id/:user_id/:stage_level/:leads_import_slug", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewEntireSubscriber(req, res);
});

/** Routing is used to view entire subscriber with stage_level only **/
app.all(modulePath + "manage_leads/view_entire_subscriber/:id/:user_id/:stage_level", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewEntireSubscriber(req, res);
});

/** Routing is used to view entire subscriber with no optional params **/
app.all(modulePath + "manage_leads/view_entire_subscriber/:id/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewEntireSubscriber(req, res);
});

/** Routing is used to view script customization **/
app.all(modulePath + "manage_leads/view_script_customization/:id/:user_id/:customized_script_slug", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewScriptCustomization(req, res);
});

/** Routing is used to view script customization without customized_script_slug **/
app.all(modulePath + "manage_leads/view_script_customization/:id/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewScriptCustomization(req, res);
});

/** Routing is used to delete script customization **/
app.all(modulePath + "manage_leads/delete_script_customization/:id/:user_id/:customized_script_slug", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.deleteScriptCustomization(req, res);
});

/** Routing is used to get import excel list**/
app.all(modulePath + "manage_leads/import_list/:id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.importList(req, res, next);
});

/** Routing is used to add import excel**/
app.all(modulePath + "manage_leads/import_add/:id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.importAdd(req, res, next);
});

/** Routing is used to view import logs**/
app.all(modulePath + "manage_leads/import_details/:id/:user_id/:csv_import_slug", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.importDetails(req, res, next);
});

/** Routing is used to delete import excel**/
app.all(modulePath + "manage_leads/delete_import_file/:id/:user_id/:csv_import_slug", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.deleteImportFile(req, res, next);
});

/** Routing is used to view details of selected columns **/
app.all(modulePath + "manage_leads/view_details_selected_columns/:id/:user_id/:csv_import_slug", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.viewDetailsSelectedColumns(req, res, next);
});

/** Routing is used to send import lead welcome mail **/
app.all(modulePath + "manage_leads/import_leads_send_welcome_mail/:id/:user_id/:csv_import_slug", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.importLeadsAdminSendWelcomeMail(req, res, next);
});

/** Routing is used to pick a winner  **/
app.all(modulePath + "manage_leads/pick_a_winner/:lead_from_id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.pickAWinner(req, res, next);
});

/** Routing is used to add selected reward list  **/
app.all(modulePath + "manage_leads/add_selected_reward/:lead_from_id/:user_id/:winner_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.addSelectedRewardList(req, res, next);
});

/** Routing is used to validate send reward  **/
app.all(modulePath + "manage_leads/validate_send_reward/:lead_from_id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.validateSendReward(req, res, next);
});

/** Routing is used to send reward  **/
app.all(modulePath + "manage_leads/send_reward/:lead_from_id/:user_id", checkLoggedInAdmin, (req, res, next) => {
    var adminLead = require(modelLeadPath);
    adminLead.sendLeadsRewards(req, res, next);
});

/** Routing is used update leads status data **/
app.all(modulePath + "manage_leads/update_lead_status/:status/:id/:user_id", checkLoggedInAdmin, (req, res) => {
    var adminLead = require(modelLeadPath);
    adminLead.updateLeadStatus(req, res);
});

/******************************************************************** END LEADS FORM ROUTES ********************************************************************/


/******************************************************************** START POLLS FORM ROUTES ********************************************************************/

const { createPollsOptionsValidation, createPollsValidation, addEmbedValidationRules, addRewardValidation } = require(__dirname + "/user_validation/polls_validator.js")

var modelPollsPath = __dirname + "/model/polls";
var adminPolls = require(modelPollsPath);

/** Routing is used to get polls list**/
app.all(modulePath + "polls/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.getPollList(req, res, next);
});

/** Routing is used to add polls**/
app.all(modulePath + "polls/add/:user_id/:slug/:edit_slug/:schedule_flag", checkLoggedInAdmin, createPollsOptionsValidation(), validate, (req, res, next) => {
    adminPolls.addPollsQuestionAndOptions(req, res, next);
});

/** Routing is used to add polls with slug and edit_slug**/
app.all(modulePath + "polls/add/:user_id/:slug/:edit_slug", checkLoggedInAdmin, createPollsOptionsValidation(), validate, (req, res, next) => {
    adminPolls.addPollsQuestionAndOptions(req, res, next);
});

/** Routing is used to add polls with slug only**/
app.all(modulePath + "polls/add/:user_id/:slug", checkLoggedInAdmin, createPollsOptionsValidation(), validate, (req, res, next) => {
    adminPolls.addPollsQuestionAndOptions(req, res, next);
});

/** Routing is used to add polls with no optional params**/
app.all(modulePath + "polls/add/:user_id", checkLoggedInAdmin, createPollsOptionsValidation(), validate, (req, res, next) => {
    adminPolls.addPollsQuestionAndOptions(req, res, next);
});


/** Routing is used to create polls**/
app.post(modulePath + "polls/create_polls/:user_id/:slug/:edit_slug/:schedule_flag", checkLoggedInAdmin, createPollsValidation(), validate, (req, res, next) => {
    adminPolls.createPolls(req, res, next);
});

/** Routing is used to create polls with edit_slug only**/
app.post(modulePath + "polls/create_polls/:user_id/:slug/:edit_slug", checkLoggedInAdmin, createPollsValidation(), validate, (req, res, next) => {
    adminPolls.createPolls(req, res, next);
});

/** Routing is used to create polls with no optional params**/
app.post(modulePath + "polls/create_polls/:user_id/:slug", checkLoggedInAdmin, createPollsValidation(), validate, (req, res, next) => {
    adminPolls.createPolls(req, res, next);
});

/** Routing is used to delete media polls**/
app.all(modulePath + "polls/delete_polls_media/:user_id/:draft_id/:delete_type/:draft_options_id/:edit_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.deletePollsMedia(req, res, next);
});

/** Routing is used to delete media polls with draft_options_id only**/
app.all(modulePath + "polls/delete_polls_media/:user_id/:draft_id/:delete_type/:draft_options_id", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.deletePollsMedia(req, res, next);
});

/** Routing is used to delete media polls with no optional params**/
app.all(modulePath + "polls/delete_polls_media/:user_id/:draft_id/:delete_type", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.deletePollsMedia(req, res, next);
});

/** Routing is used to delete all polls options**/
app.all(modulePath + "polls/delete_all_options/:user_id/:draft_id", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.deleteAllPollsOptions(req, res, next);
});

/** Routing is used to delete and status polls **/
app.all(modulePath + "polls/polls_delete_and_status/:id/:status/:status_type/:user_id", checkLoggedInAdmin, (req, res) => {
    adminPolls.deletePoll(req, res);
});

/** Routing is used to comment on polls **/
app.all(modulePath + "polls/comment_poll_details/:user_id/:slug/:comment_id", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.commentPollDetails(req, res, next);
});

/** Routing is used to comment on polls without comment_id **/
app.all(modulePath + "polls/comment_poll_details/:user_id/:slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.commentPollDetails(req, res, next);
});

/** Routing is used to comment delete **/
app.all(modulePath + "polls/comment_delete/:user_id/:poll_slug/:comment_id/:page_type", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.commentDelete(req, res, next);
});

/** Routing is used to comment delete without page_type **/
app.all(modulePath + "polls/comment_delete/:user_id/:poll_slug/:comment_id", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.commentDelete(req, res, next);
});

/** Routing is used to participants list in poll **/
app.all(modulePath + "polls/participants_list/:user_id/:poll_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.participantsList(req, res, next);
});

/** Routing is used to add save single option functionlity **/
app.all(modulePath + "polls/single_poll_next/:user_id/:poll_slug/:edit_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.singlePollNext(req, res, next);
});

/** Routing is used to add save single option functionlity without edit_slug **/
app.all(modulePath + "polls/single_poll_next/:user_id/:poll_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.singlePollNext(req, res, next);
});



/** Routing is used to edit option text functionlity **/
app.all(modulePath + "polls/edit_option_text/:user_id/:poll_slug/:edit_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.editOptionText(req, res, next);
});

/** Routing is used to edit option text functionlity without edit_slug **/
app.all(modulePath + "polls/edit_option_text/:user_id/:poll_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.editOptionText(req, res, next);
});

/** Routing is used to generate embeded code **/
app.all(modulePath + "polls/generate_embed_code/:user_id", checkLoggedInAdmin, addEmbedValidationRules(), validate, (req, res) => {
    adminPolls.generatePollEmbedCode(req, res);
});

/** Routing is used to embed list **/
app.all(modulePath + "polls/embed_list/:user_id/:poll_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.pollEmbedList(req, res, next);
});

/** Routing is used to embed list **/
app.all(modulePath + "polls/edit_end_poll_voting_period/:poll_id/:user_id/:end_voting_period", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.editEndPollVotingPeriod(req, res, next);
});

/** Routing is used to add reward **/
app.post(modulePath + "polls/add_reward/:user_id", checkLoggedInAdmin, addRewardValidation(), validate, (req, res, next) => {
    adminPolls.addRewardData(req, res, next);
});

/** Routing is used to change loop image option **/
app.all(modulePath + "polls/upload_loop_image/:user_id/:poll_slug/:edit_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.editLoopOptionImage(req, res, next);
});

/** Routing is used to change loop image option without edit_slug **/
app.all(modulePath + "polls/upload_loop_image/:user_id/:poll_slug", checkLoggedInAdmin, (req, res, next) => {
    adminPolls.editLoopOptionImage(req, res, next);
});

/******************************************************************** END POLLS FORM ROUTES ********************************************************************/

/******************************************************************** START POLL SETS FORM ROUTES ********************************************************************/

const { addPollSetValidationRules, editPollSetValidationRules } = require(__dirname + "/user_validation/pollsets_validator.js")
var modelPollSetsPath = __dirname + "/model/pollsets";
var adminPollSets = require(modelPollSetsPath);

/** Routing is used to get pollsets list **/
app.all(modulePath + "pollsets/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSets.getPollSetsList(req, res, next);
});

/** Routing is used to all selected pollsets listing **/
app.all(modulePath + "pollsets/add_selected_poll_listing/:user_id/:poll_slugs/:slug", checkLoggedInAdmin, (req, res, next) => {
    adminPollSets.addSelectedPollListing(req, res, next);
});

/** Routing is used to all selected pollsets listing with poll_slugs only **/
app.all(modulePath + "pollsets/add_selected_poll_listing/:user_id/:poll_slugs", checkLoggedInAdmin, (req, res, next) => {
    adminPollSets.addSelectedPollListing(req, res, next);
});

/** Routing is used to all selected pollsets listing with no optional params **/
app.all(modulePath + "pollsets/add_selected_poll_listing/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSets.addSelectedPollListing(req, res, next);
});

/** Routing is used to add pollsets **/
app.all(modulePath + "pollsets/add_pollset/:user_id/:poll_slugs", checkLoggedInAdmin, addPollSetValidationRules(), validate, (req, res, next) => {
    adminPollSets.addPollSet(req, res, next);
});
/** Routing is used to edit pollsets **/
app.all(modulePath + "pollsets/edit_pollset/:slug/:user_id/:poll_slugs", checkLoggedInAdmin, editPollSetValidationRules(), validate, (req, res, next) => {
    adminPollSets.editPollSet(req, res, next);
});

/** Routing is used to view pollsets **/
app.all(modulePath + "pollsets/view/:slug/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSets.viewPollSet(req, res, next);
});

/** Routing is used to delete pollsets **/
app.all(modulePath + "pollsets/pollset_delete_and_status/:slug/:status/:status_type/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSets.deletePollset(req, res, next);
});

/******************************************************************** END POLL SETS FORM ROUTES ********************************************************************/


/******************************************************************** START POLL SEGMENT ROUTES ********************************************************************/
const { addPollSegmentValidationRules } = require(__dirname + "/user_validation/pollsets_validator.js")

var modelPollSegmentsPath = __dirname + "/model/poll_segment";
var adminPollSegments = require(modelPollSegmentsPath);

/** Routing is used to all selected poll segment listing **/
app.all(modulePath + "poll_segment/add_selected_poll_listing/:user_id/:poll_slugs/:slug", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.addSelectedPollListing(req, res, next);
});

/** Routing is used to all selected poll segment listing with poll_slugs only **/
app.all(modulePath + "poll_segment/add_selected_poll_listing/:user_id/:poll_slugs", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.addSelectedPollListing(req, res, next);
});

/** Routing is used to all selected poll segment listing with no optional params **/
app.all(modulePath + "poll_segment/add_selected_poll_listing/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.addSelectedPollListing(req, res, next);
});

/** Routing is used to add poll_segment **/
app.all(modulePath + "poll_segment/add/:user_id/:poll_ids/:from_date/:to_date", checkLoggedInAdmin, addPollSegmentValidationRules(), validate, (req, res, next) => {
    adminPollSegments.addPollSegment(req, res, next);
});

/** Routing is used to get poll segment list **/
app.all(modulePath + "poll_segment/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.getPollSegmentList(req, res, next);
});

/** Routing is used to get poll segment user list **/
app.all(modulePath + "poll_segment/user_list/:user_id/:slug", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.getPollSegmentVoteUserList(req, res, next);
});

/** Routing is used to get poll segment user list **/
app.all(modulePath + "poll_segment/refine_voter_list/:user_id/:poll_slugs", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.getUserRefineVoteList(req, res, next);
});

/** Routing is used to get poll segment user list without poll_slugs **/
app.all(modulePath + "poll_segment/refine_voter_list/:user_id", checkLoggedInAdmin, (req, res, next) => {
    adminPollSegments.getUserRefineVoteList(req, res, next);
});


/******************************************************************** END POLL SEGMENT ROUTES ********************************************************************/


/******************************************************************** START POLL ANALYTICS REPORT ROUTES ********************************************************************/
var modelPollAnalyticsPath = __dirname + "/model/poll_analytics_report";
var pollAnalyticsReport = require(modelPollAnalyticsPath);


/** Routing is used to get poll analytics report **/
app.all(modulePath + "poll_analytics_report/list/:user_id/:from_date/:to_date/:unregister/:view_type", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementViewReport(req, res, next);
});

/** Routing is used to get poll analytics report with from_date, to_date, unregister **/
app.all(modulePath + "poll_analytics_report/list/:user_id/:from_date/:to_date/:unregister", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementViewReport(req, res, next);
});

/** Routing is used to get poll analytics report with from_date, to_date **/
app.all(modulePath + "poll_analytics_report/list/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementViewReport(req, res, next);
});

/** Routing is used to get poll analytics report with from_date only **/
app.all(modulePath + "poll_analytics_report/list/:user_id/:from_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementViewReport(req, res, next);
});

/** Routing is used to get poll analytics report with no optional params **/
app.all(modulePath + "poll_analytics_report/list/:user_id", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementViewReport(req, res, next);
});

/** Routing is used to get poll analytics comment list details **/
app.all(modulePath + "poll_analytics_report/comment_list/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.listPollCommentDetails(req, res, next);
});

/** Routing is used to share icon list details **/
app.all(modulePath + "poll_analytics_report/share_icon_list/:user_id/:share_type/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollShareIconsDetails(req, res, next);
});

/** Routing is used to get opt in view details **/
app.all(modulePath + "poll_analytics_report/view_opt_in/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementOptinViewDetail(req, res, next);
});

/** Routing is used to get ribbon click list details **/
app.all(modulePath + "poll_analytics_report/view_ribbon_click/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementRibbonClickDetail(req, res, next);
});

/** Routing is used to get link click list details **/
app.all(modulePath + "poll_analytics_report/view_link_click/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementLinkClickDetail(req, res, next);
});

/** Routing is used to get poll engagement open reward details **/
app.all(modulePath + "poll_analytics_report/view_open_reward/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollAnalyticsReport.pollEngagementOpenRewardDetail(req, res, next);
});

/******************************************************************** END POLL ANALYTICS REPORT ROUTES ********************************************************************/


/******************************************************************** START POLL PERFORMANCE REPORT ROUTES ****************************************************************/
const { addAssumptionValidationRules } = require(__dirname + "/user_validation/pollsets_validator.js")

var modelPollPerformancePath = __dirname + "/model/poll_performance";
var pollPerformanceReport = require(modelPollPerformancePath);


/** Routing is used to get view poll performance report **/
app.all(modulePath + "poll_performance/list/:user_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.pollPerformanceOverView(req, res, next);
});

/** Routing is used to get view poll performance report with from_date only **/
app.all(modulePath + "poll_performance/list/:user_id/:from_date", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.pollPerformanceOverView(req, res, next);
});

/** Routing is used to get view poll performance report with no optional params **/
app.all(modulePath + "poll_performance/list/:user_id", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.pollPerformanceOverView(req, res, next);
});

/** Routing is used to get interaction poll listing report **/
app.all(modulePath + "poll_performance/poll_list/:user_id/:participants_tab/:poll_ids", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.interactionPollListing(req, res, next);
});

/** Routing is used to get interaction poll listing report without poll_ids **/
app.all(modulePath + "poll_performance/poll_list/:user_id/:participants_tab", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.interactionPollListing(req, res, next);
});

/** Routing is used to get interaction list report **/
app.all(modulePath + "poll_performance/interaction_list/:user_id/:participants_tab", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.interactionList(req, res, next);
});

/** Routing is used to get poll spent time report **/
app.all(modulePath + "poll_performance/poll_spent_time/:user_id/:participants_tab", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.pollSpentTimeList(req, res, next);
});

/** Routing is used to add assumption report **/
app.all(modulePath + "poll_performance/add_assumption/:user_id/:poll_ids/:from_date/:to_date", checkLoggedInAdmin, addAssumptionValidationRules(), validate, (req, res, next) => {
    pollPerformanceReport.addAssumptionReport(req, res, next);
});

/** Routing is used to assumption report list **/
app.all(modulePath + "poll_performance/assumption_report_list/:user_id", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.getPollAssumptionList(req, res, next);
});

/** Routing is used to assumption report list **/
app.all(modulePath + "poll_performance/lead_generation_details/:user_id", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.pollPerformanceLeadGenerationDetails(req, res, next);
});

/** Routing is used to delete assumption report list **/
app.all(modulePath + "poll_performance/assumption_report_list/:user_id/:assumption_id", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.deleteAssumptionReport(req, res, next);
});

/** Routing is used to view interaction poll details **/
app.all(modulePath + "poll_performance/view_poll_details/:user_id/:poll_id/:from_date/:to_date", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.interactionPollDetails(req, res, next);
});

/** Routing is used to view interaction poll details **/
app.all(modulePath + "poll_performance/view_report/:user_id/:report_id", checkLoggedInAdmin, (req, res, next) => {
    pollPerformanceReport.viewAssumptionReport(req, res, next);
});


/******************************************************************** END POLL PERFORMANCE REPORT ROUTES ******************************************************************/


/** Routing is used to get user list **/
app.all(modulePath + ":type", checkLoggedInAdmin, (req, res) => {
    var adminUser = require(modelPath);
    adminUser.getUserList(req, res);
});

/** Routing is used to get user list without type **/
app.all(modulePath, checkLoggedInAdmin, (req, res) => {
    var adminUser = require(modelPath);
    adminUser.getUserList(req, res);
});

/** Routing is used for admin logout */
app.get("/" + ADMIN_NAME + "/logout", (req, res) => {
    res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");

    /** Delete user Modules list Flag **/
    let userId = (req.session && req.session.user && req.session.user._id) ? req.session.user._id : "";
    userModuleFlagAction(userId, "", "delete");

    req.session = null;
    res.clearCookie("adminLoggedIn");
    res.redirect(WEBSITE_ADMIN_URL + "login");
});




