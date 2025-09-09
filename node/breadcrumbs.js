BREADCRUMBS = {
	/** DASHBOARD SECTION */
	'admin/dashboard': [{ name: 'Dashboard', url: '', icon: 'dashboard' }],
	'admin/dashboard_leads_subscriber': [{ name: 'Leads Subscribers', url: '', icon: 'track_changes' }],
	'admin/dashboard_view_leads_subscriber': [{ name: 'Leads Subscribers', url: WEBSITE_ADMIN_URL + 'view_leads_subscribers', icon: 'track_changes' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** EDIT PROFILE SECTION */
	'admin/user_profile/edit': [{ name: 'Edit Profile', url: '', icon: 'mode_edit' }],

	/** USER MANAGEMENT SECTION */
	'admin/users/list': [{ name: 'dynamic_variable Users Management', url: '', icon: 'person' }],
	'admin/users/edit': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/users/add': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/users/view': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'View', url: '', icon: 'find_in_page' }],
	'admin/users/manage_links': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Manage Content', url: '', icon: 'link' }],
	'admin/users/view_redemptions': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'View Redemptions', url: '', icon: 'redeem' }],
	'admin/users/my_wallet_rewards': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'My Wallet', url: '', icon: 'redeem' }],
	'admin/users/followers': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Followers Users', url: '', icon: 'sentiment_neutral' }],
	'admin/users/following': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Following Users', url: '', icon: 'sentiment_neutral' }],
	'admin/users/view_earn_sent_reward': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'View Redemptions', url: WEBSITE_ADMIN_URL + 'users/{user_type}/view_redemptions/{dynamic_variable}', icon: 'redeem' }, { name: 'View', url: '', icon: 'find_in_page' }],
	'admin/users/view_plan': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'View Plan', url: '', icon: 'payment' }],
	'admin/users/offline_payment': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Offline Payment', url: '', icon: 'add' }],
	'admin/users/enterprise_upload_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Enterprise Upload List', url: '', icon: 'business_center' }],
	'admin/users/upload_enterprise': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Enterprise Upload List', url: WEBSITE_ADMIN_URL + 'users/{user_type}/enterprise_upload_list/{dynamic_variable}', icon: 'business_center' },{ name: 'Upload Enterprise', url: '', icon: 'add' }],
	'admin/users/enterprise_import_details': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Enterprise Upload List', url: WEBSITE_ADMIN_URL + 'users/{user_type}/enterprise_upload_list/{dynamic_variable}', icon: 'business_center' },{ name: 'View', url: '', icon: 'find_in_page' }],

	/** POLLS MANAGEMENT SECTION */
	'admin/polls/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Polls', url: '', icon: 'poll' }],
	'admin/polls/add': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Polls', url: WEBSITE_ADMIN_URL + 'users/{user_type}/polls/{dynamic_variable}', icon: 'poll' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/polls/edit': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Polls', url: WEBSITE_ADMIN_URL + 'users/{user_type}/polls/{dynamic_variable}', icon: 'poll' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/polls/comment_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Polls', url: WEBSITE_ADMIN_URL + 'users/{user_type}/polls/{dynamic_variable}', icon: 'poll' }, { name: 'Comments', url: '', icon: 'comment' }],
	'admin/polls/participants': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Polls', url: WEBSITE_ADMIN_URL + 'users/{user_type}/polls/{dynamic_variable}', icon: 'poll' }, { name: 'Participants', url: '', icon: 'comment' }],
	'admin/polls/embed_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Polls', url: WEBSITE_ADMIN_URL + 'users/{user_type}/polls/{dynamic_variable}', icon: 'poll' }, { name: 'Embed List', url: '', icon: 'code' }],

	/** POLL SETS MANAGEMENT SECTION */
	'admin/pollsets/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Poll Sets', url: '', icon: 'poll' }],
	'admin/pollsets/poll_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Sets', url: WEBSITE_ADMIN_URL + 'users/{user_type}/pollsets/{dynamic_variable}', icon: 'poll' }, { name: 'Polls', url: '', icon: 'poll' }],
	'admin/pollsets/add_pollset': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Sets', url: WEBSITE_ADMIN_URL + 'users/{user_type}/pollsets/{dynamic_variable}', icon: 'poll' }, { name: 'Polls', url: WEBSITE_ADMIN_URL + 'users/{user_type}/pollsets/add_selected_poll_listing/{dynamic_variable}', icon: 'poll' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/pollsets/edit_pollset': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Sets', url: WEBSITE_ADMIN_URL + 'users/{user_type}/pollsets/{dynamic_variable}', icon: 'poll' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/pollsets/view': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Sets', url: WEBSITE_ADMIN_URL + 'users/{user_type}/pollsets/{dynamic_variable}', icon: 'poll' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** POLL ANALYTICS SECTION */
	'admin/poll_analytics_report/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: '', icon: 'poll' }],
	'admin/poll_analytics_report/comment_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_analytics_report/list/{dynamic_variable}', icon: 'poll' }, { name: 'Comments', url: '', icon: 'comment' }],
	'admin/poll_analytics_report/share_icon_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_analytics_report/list/{dynamic_variable}', icon: 'poll' }, { name: 'Shares', url: '', icon: 'share' }],
	'admin/poll_analytics_report/view_opt_in': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_analytics_report/list/{dynamic_variable}', icon: 'poll' }, { name: 'Opt-In', url: '', icon: 'verified_user' }],
	'admin/poll_analytics_report/view_ribbon_click': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_analytics_report/list/{dynamic_variable}', icon: 'poll' }, { name: 'Ribbon Clicks', url: '', icon: 'bookmark_border' }],
	'admin/poll_analytics_report/view_link_click': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_analytics_report/list/{dynamic_variable}', icon: 'poll' }, { name: 'Link Clicks', url: '', icon: 'link' }],
	'admin/poll_analytics_report/view_open_reward': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Engagement', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_analytics_report/list/{dynamic_variable}', icon: 'poll' }, { name: 'Opened Reward', url: '', icon: 'card_giftcard' }],

	/** POLL PERFORMANCE SECTION */
	'admin/poll_performance/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: '', icon: 'poll' }],
	'admin/poll_performance/poll_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: '', icon: 'poll' }],
	'admin/poll_performance/interaction_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: '', icon: 'poll' }],
	'admin/poll_performance/poll_spent_time': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: '', icon: 'poll' }],
	'admin/poll_performance/lead_generation_details': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: '', icon: 'poll' }],
	'admin/poll_performance/assumption_report_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_performance/poll_list/{dynamic_variable}', icon: 'poll' }, { name: 'Assumption Report', url: '', icon: 'list' }],
	'admin/poll_performance/add_assumption': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_performance/poll_list/{dynamic_variable}', icon: 'poll' }, { name: 'Add Assumption Report', url: '', icon: 'add' }],
	'admin/poll_performance/view_poll_details': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_performance/poll_list/{dynamic_variable}', icon: 'poll' }, { name: 'View Poll Details', url: '', icon: 'find_in_page' }],
	'admin/poll_performance/view_report': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Poll Performance', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_performance/list/{dynamic_variable}', icon: 'poll' }, { name: 'Assumption Report', url: WEBSITE_ADMIN_URL + 'users/{user_type}/poll_performance/assumption_report_list/{dynamic_variable}', icon: 'list' }, { name: 'View Report', url: '', icon: 'find_in_page' }],

	/** MANAGE REWARDS SECTION */
	'admin/rewards/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Manage Rewards', url: '', icon: 'redeem' }],
	'admin/rewards/add': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Manage Rewards', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_rewards/{dynamic_variable}', icon: 'redeem' }, { name: 'Add', url: '', icon: 'redeem' }],
	'admin/rewards/edit': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Manage Rewards', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_rewards/{dynamic_variable}', icon: 'redeem' }, { name: 'Edit', url: '', icon: 'mode_edit' }],

	/** POCIAL EMAIL TEMPLATES SECTION */
	'admin/pocial_email/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Welcome Templates', url: '', icon: 'email' }],
	'admin/pocial_email/add': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Welcome Templates', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_emails', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/pocial_email/edit': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Welcome Templates', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_emails/{dynamic_variable}', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/pocial_email/duplicate': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Welcome Templates', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_emails/{dynamic_variable}', icon: 'email' }, { name: 'Duplicate', url: '', icon: 'control_point_duplicate' }],
	'admin/pocial_email/view': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Welcome Templates', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_emails/{dynamic_variable}', icon: 'email' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** LEAD GEN. FORM SECTION */
	'admin/leads_form/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Lead Capture Form', url: '', icon: 'new_releases' }],
	'admin/leads_form/add': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/leads_form/edit': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/leads_form/view': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'View', url: '', icon: 'find_in_page' }],
	'admin/leads_form/view_entire_subscriber': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'View Entires', url: '', icon: 'track_changes' }],
	'admin/leads_form/view_script_customization': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Get Script Code', url: '', icon: 'code' }],
	'admin/leads_form/view_entire_subscriber_dasboard': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Overview Lead Dashboard', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/overview_lead_dashboard/{dynamic_variable}', icon: 'dashboard' }, { name: 'View Entires', url: '', icon: 'track_changes' }],
	'admin/leads_form/lead_excel_view_entire_subscriber': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Imported Files', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/import_list/{lead_dynamic_url_id}/{dynamic_variable}', icon: 'import_export' }, { name: 'View Entires', url: '', icon: 'track_changes' }],
	'admin/leads_form/overview_lead_dashboard': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Overview Lead Dashboard', url: '', icon: 'dashboard' }],
	'admin/leads_form/import_list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Imported Files', url: '', icon: 'import_export' }],
	'admin/leads_form/import_add': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Imported Files', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/import_list/{lead_dynamic_url_id}/{dynamic_variable}', icon: 'import_export' }, { name: 'Add Sheet', url: '', icon: 'add' }],
	'admin/leads_form/import_details': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Imported Files', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/import_list/{lead_dynamic_url_id}/{dynamic_variable}', icon: 'import_export' }, { name: 'View Logs', url: '', icon: 'find_in_page' }],
	'admin/leads_form/import_view_selected_columns': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'Imported Files', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/import_list/{lead_dynamic_url_id}/{dynamic_variable}', icon: 'import_export' }, { name: 'View Selected Column', url: '', icon: 'tab_unselected' }],
	'admin/leads_form/add_selected_reward': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{user_type}', icon: 'person' }, { name: 'Lead Capture Form', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/{dynamic_variable}', icon: 'new_releases' }, { name: 'View Entires', url: WEBSITE_ADMIN_URL + 'users/{user_type}/manage_leads/view_entire_subscriber/{lead_dynamic_url_id}/{dynamic_variable}', icon: 'track_changes' }, { name: 'Rewards', url: '', icon: 'redeem' }],

	/** SUB USERS MANAGEMENT SECTION */
	'admin/sub_users/list': [{ name: 'dynamic_variable Users Management', url: WEBSITE_ADMIN_URL + 'users/{dynamic_variable}', icon: 'person' }, { name: 'Sub Users', url: '', icon: 'account_circle' }],

	/** CMS SECTION */
	'admin/cms/list': [{ name: 'CMS Management', url: '', icon: 'picture_in_picture' }],
	'admin/cms/edit': [{ name: 'CMS Management', url: WEBSITE_ADMIN_URL + 'cms', icon: 'picture_in_picture' }, { name: 'Edit CMS', url: '', icon: 'mode_edit' }],
	'admin/cms/add': [{ name: 'CMS Management', url: WEBSITE_ADMIN_URL + 'cms', icon: 'picture_in_picture' }, { name: 'Add CMS', url: '', icon: 'add' }],

	/** BLOCK SECTION */
	'admin/block/list': [{ name: 'Block Management', url: '', icon: 'chrome_reader_mode' }],
	'admin/block/edit': [{ name: 'Block Management', url: WEBSITE_ADMIN_URL + 'block', icon: 'chrome_reader_mode' }, { name: 'Edit block', url: '', icon: 'mode_edit' }],
	'admin/block/add': [{ name: 'Block Management', url: WEBSITE_ADMIN_URL + 'block', icon: 'chrome_reader_mode' }, { name: 'Add block', url: '', icon: 'add' }],

	/** TEXT SETTING SECTION */
	'admin/text_setting/list': [{ name: 'dynamic_variable', url: '', icon: 'text_format' }],
	'admin/text_setting/edit': [{ name: 'dynamic_variable', url: WEBSITE_ADMIN_URL + 'text-setting/{dynamic_variable}', icon: 'text_format' }, { name: 'Edit Text Setting', url: '', icon: 'mode_edit' }],
	'admin/text_setting/add': [{ name: 'dynamic_variable', url: WEBSITE_ADMIN_URL + 'text-setting/{dynamic_variable}', icon: 'text_format' }, { name: 'Add Text Setting', url: '', icon: 'add' }],

	/** EMAIL MANAGEMENT SECTION */
	'admin/email_template/list': [{ name: 'Email Templates', url: '', icon: 'contact_mail' }],
	'admin/email_template/edit': [{ name: 'Email Templates', url: WEBSITE_ADMIN_URL + 'email_template', icon: 'contact_mail' }, { name: 'Edit email template', url: '', icon: 'mode_edit' }],

	/** SETTING MANAGEMENT SECTION */
	'admin/setting/list': [{ name: 'Settings', url: '', icon: 'settings' }],
	'admin/setting/add': [{ name: 'Settings', url: WEBSITE_ADMIN_URL + 'settings', icon: 'settings' }, { name: 'Add Setting', url: '', icon: 'add' }],
	'admin/setting/edit': [{ name: 'Settings', url: WEBSITE_ADMIN_URL + 'settings', icon: 'settings' }, { name: 'Edit Setting', url: '', icon: 'mode_edit' }],
	'admin/setting/prefix': [{ name: 'dynamic_variable', url: '', icon: 'settings' }],

	/** MASTER MANAGEMENT SECTION */
	'admin/master/list': [{ name: 'dynamic_variable', url: '', icon: 'subject' }],
	'admin/master/add': [{ name: 'dynamic_variable', url: WEBSITE_ADMIN_URL + 'master/{dynamic_variable}', icon: 'subject' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/master/edit': [{ name: 'dynamic_variable', url: WEBSITE_ADMIN_URL + 'master/{dynamic_variable}', icon: 'subject' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/master/view': [{ name: 'dynamic_variable', url: WEBSITE_ADMIN_URL + 'master/{dynamic_variable}', icon: 'subject' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** ADMIN ROLE SECTION */
	'admin/admin_role/list': [{ name: 'Manage Roles', url: '', icon: 'security' }],
	'admin/admin_role/add': [{ name: 'Manage Roles', url: WEBSITE_ADMIN_URL + 'admin_role', icon: 'security' }, { name: 'Add Role', url: '', icon: 'add' }],
	'admin/admin_role/edit': [{ name: 'Manage Roles', url: WEBSITE_ADMIN_URL + 'admin_role', icon: 'security' }, { name: 'Edit Role', url: '', icon: 'edit' }],

	/** ADMIN PERMISSIONS SECTION */
	'admin/admin_permissions/list': [{ name: 'Sub-admin', url: '', icon: 'perm_data_setting' }],
	'admin/admin_permissions/add': [{ name: 'Sub-admin', url: WEBSITE_ADMIN_URL + 'admin_permissions', icon: 'perm_data_setting' }, { name: 'Add Sub-admin ', url: '', icon: 'add' }],
	'admin/admin_permissions/edit': [{ name: 'Sub-admin', url: WEBSITE_ADMIN_URL + 'admin_permissions', icon: 'perm_data_setting' }, { name: 'Edit Sub-admin ', url: '', icon: 'edit' }],
	'admin/admin_permissions/view': [{ name: 'Sub-admin', url: WEBSITE_ADMIN_URL + 'admin_permissions', icon: 'perm_data_setting' }, { name: 'View Sub-admin ', url: '', icon: 'find_in_page' }],

	/** ADMIN MODULES SECTION */
	'admin/admin_modules/list': [{ name: 'Admin Modules', url: '', icon: 'pages' }],
	'admin/admin_modules/add': [{ name: 'Admin Modules', url: WEBSITE_ADMIN_URL + 'admin_modules', icon: 'pages' }, { name: 'Add Admin Modules', url: '', icon: 'add' }],
	'admin/admin_modules/edit': [{ name: 'Admin Modules', url: WEBSITE_ADMIN_URL + 'admin_modules', icon: 'pages' }, { name: 'Edit Admin Modules', url: '', icon: 'edit' }],

	/** PN LOGS SECTION */
	'admin/sms_logs/list': [{ name: 'Sms Logs', url: '', icon: 'textsms' }],
	'admin/sms_logs/view': [{ name: 'Sms Logs', url: WEBSITE_ADMIN_URL + 'sms_logs', icon: 'textsms' }, { name: 'Sms Log Details', url: '', icon: 'find_in_page' }],

	/** EMAIL LOGS SECTION */
	'admin/email_logs/list': [{ name: 'Email Logs', url: '', icon: 'mail_outline' }],
	'admin/email_logs/view': [{ name: 'Email Logs', url: WEBSITE_ADMIN_URL + 'email_logs', icon: 'mail_outline' }, { name: 'Email Logs Details', url: '', icon: 'find_in_page' }],

	/** EMAIL ACTIONS SECTION */
	'admin/email_actions/list': [{ name: 'Email Actions', url: '', icon: 'dvr' }],
	'admin/email_actions/add': [{ name: 'Email Actions', url: WEBSITE_ADMIN_URL + 'email_actions', icon: 'dvr' }, { name: 'Add Email Actions', url: '', icon: 'add' }],
	'admin/email_actions/edit': [{ name: 'Email Actions', url: WEBSITE_ADMIN_URL + 'email_actions', icon: 'dvr' }, { name: 'Edit Email Actions', url: '', icon: 'edit' }],

	/** NOTIFICATION SECTION */
	'admin/notification/list': [{ name: 'Notification Management', url: '', icon: 'notifications' }],

	/** BANNER SECTION */
	'admin/banner/list': [{ name: 'Banner', url: '', icon: 'picture_in_picture' }],
	'admin/banner/add': [{ name: 'Banner', url: WEBSITE_ADMIN_URL + 'banner', icon: 'picture_in_picture' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/banner/edit': [{ name: 'Banner', url: WEBSITE_ADMIN_URL + 'banner', icon: 'picture_in_picture' }, { name: 'Edit', url: '', icon: 'mode_edit' }],

	/** CONTACT SECTION */
	'admin/contact/list': [{ name: 'Contact Management', url: '', icon: 'contact_mail' }],
	'admin/contact/view': [{ name: 'Contact Management', url: WEBSITE_ADMIN_URL + 'contact', icon: 'contact_mail' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** BANNER SECTION */
	'admin/splash_screens/list': [{ name: 'Splash Screens', url: '', icon: 'fullscreen' }],
	'admin/splash_screens/add': [{ name: 'Splash Screens', url: WEBSITE_ADMIN_URL + 'splash_screens', icon: 'fullscreen' }, { name: 'Add Screen', url: '', icon: 'add' }],
	'admin/splash_screens/edit': [{ name: 'Splash Screens', url: WEBSITE_ADMIN_URL + 'splash_screens', icon: 'fullscreen' }, { name: 'Edit Screen', url: '', icon: 'mode_edit' }],
	'admin/splash_screens/view': [{ name: 'Splash Screens', url: WEBSITE_ADMIN_URL + 'splash_screens', icon: 'fullscreen' }, { name: 'View Screen', url: '', icon: 'find_in_page' }],

	/** NOTIFICATION MANAGEMENT SECTION */
	'admin/notification_templates/list': [{ name: 'Notification Templates', url: '', icon: 'contact_mail' }],
	'admin/notification_templates/edit': [{ name: 'Notification Templates', url: WEBSITE_ADMIN_URL + 'notification_templates', icon: 'contact_mail' }, { name: 'Edit Notification Template', url: '', icon: 'mode_edit' }],

	/** PUSH EMAIL BROADCAST SECTION */
	'admin/email_broadcast/list_new_template': [{ name: 'Email Newsletter Templates', url: '', icon: 'email' }],
	'admin/email_broadcast/add_new_template': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/email_broadcast/edit_new_template': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/email_broadcast/send_message': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Send', url: '', icon: 'send' }],
	'admin/email_broadcast/un_subscribed_users_list': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Unsubscribed Users', url: '', icon: 'perm_identity' }],
	'admin/email_broadcast/schedule_newsletters_list': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Schedule Newsletters', url: '', icon: 'view_list' }],
	'admin/email_broadcast/schedule_newsletters_view': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Schedule Newsletters', url: WEBSITE_ADMIN_URL + 'email_broadcast/schedule_newsletters_list', icon: 'view_list' }, { name: 'View', url: '', icon: 'find_in_page' }],
	'admin/email_broadcast/edit': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/email_broadcast/duplicate': [{ name: 'Email Newsletter Templates', url: WEBSITE_ADMIN_URL + 'email_broadcast', icon: 'email' }, { name: 'Duplicate', url: '', icon: 'control_point_duplicate' }],

	/** CATEGORY SECTION */
	'admin/category/list': [{ name: 'Category Management', url: '', icon: 'chrome_reader_mode' }],
	'admin/category/edit': [{ name: 'Category Management', url: WEBSITE_ADMIN_URL + 'category', icon: 'chrome_reader_mode' }, { name: 'Edit Category', url: '', icon: 'mode_edit' }],
	'admin/category/add': [{ name: 'Category Management', url: WEBSITE_ADMIN_URL + 'category', icon: 'chrome_reader_mode' }, { name: 'Add Category', url: '', icon: 'add' }],

	/** NOTIFICATION BROADCAST SECTION */
	'admin/notifications_broadcast/list_new_template': [{ name: 'Notification Broadcasts', url: '', icon: 'notifications' }],
	'admin/notifications_broadcast/add_new_template': [{ name: 'Notification Broadcasts', url: WEBSITE_ADMIN_URL + 'notifications_broadcast', icon: 'notifications' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/notifications_broadcast/edit_new_template': [{ name: 'Notification Broadcasts', url: WEBSITE_ADMIN_URL + 'notifications_broadcast', icon: 'notifications' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/notifications_broadcast/send_message': [{ name: 'Notification Broadcasts', url: WEBSITE_ADMIN_URL + 'notifications_broadcast', icon: 'notifications' }, { name: 'Send', url: '', icon: 'send' }],
	'admin/notifications_broadcast/schedule_newsletters_list': [{ name: 'Notification Broadcasts', url: WEBSITE_ADMIN_URL + 'notifications_broadcast', icon: 'notifications' }, { name: 'Schedule Notifications', url: '', icon: 'view_list' }],
	'admin/notifications_broadcast/schedule_newsletters_view': [{ name: 'Notification Broadcasts', url: WEBSITE_ADMIN_URL + 'notifications_broadcast', icon: 'notifications' }, { name: 'Schedule Notifications', url: WEBSITE_ADMIN_URL + 'notifications_broadcast/schedule_newsletters_list', icon: 'view_list' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** LEAD FORMS SUBSCRIBER SECTION */
	'admin/lead_forms_subscriber/list': [{ name: 'Lead Subscribers', url: '', icon: 'new_releases' }],
	'admin/lead_forms_subscriber/view': [{ name: 'Lead Subscribers', url: WEBSITE_ADMIN_URL + 'lead_forms_subscriber', icon: 'new_releases' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** COMPLETE EMAIL TEMPLATE SECTION */
	'admin/complete_email/list': [{ name: 'Thank You for Completing Your Profile', url: '', icon: 'email' }],
	'admin/complete_email/add': [{ name: 'Thank You for Completing Your Profile', url: WEBSITE_ADMIN_URL + 'complete_email', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/complete_email/edit': [{ name: 'Thank You for Completing Your Profile', url: WEBSITE_ADMIN_URL + 'complete_email', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/complete_email/duplicate': [{ name: 'Thank You for Completing Your Profile', url: WEBSITE_ADMIN_URL + 'complete_email', icon: 'email' }, { name: 'Duplicate', url: '', icon: 'control_point_duplicate' }],
	'admin/complete_email/view': [{ name: 'Thank You for Completing Your Profile', url: WEBSITE_ADMIN_URL + 'complete_email', icon: 'email' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** WELCOME EMAIL TEMPLATES SECTION */
	'admin/welcome_email/list': [{ name: 'Welcome Email Templates', url: '', icon: 'email' }],
	'admin/welcome_email/add': [{ name: 'Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'welcome_email', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/welcome_email/edit': [{ name: 'Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'welcome_email', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/welcome_email/duplicate': [{ name: 'Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'welcome_email', icon: 'email' }, { name: 'Duplicate', url: '', icon: 'control_point_duplicate' }],
	'admin/welcome_email/view': [{ name: 'Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'welcome_email', icon: 'email' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** AI BOT WELCOME EMAIL TEMPLATES SECTION */
	'admin/ai_bot_wlc_email/list': [{ name: 'AI BOT Welcome Email Templates', url: '', icon: 'email' }],
	'admin/ai_bot_wlc_email/add': [{ name: 'AI BOT Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'ai_bot_wlc_email', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/ai_bot_wlc_email/edit': [{ name: 'AI BOT Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'ai_bot_wlc_email', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/ai_bot_wlc_email/duplicate': [{ name: 'AI BOT Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'ai_bot_wlc_email', icon: 'email' }, { name: 'Duplicate', url: '', icon: 'control_point_duplicate' }],
	'admin/ai_bot_wlc_email/view': [{ name: 'AI BOT Welcome Email Templates', url: WEBSITE_ADMIN_URL + 'ai_bot_wlc_email', icon: 'email' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** CAMPAIGN NEWSLETTER TEMPLATE SECTION */
	'admin/campaign_newsletter/list': [{ name: 'Campaign Newsletter Templates', url: '', icon: 'email' }],
	'admin/campaign_newsletter/add': [{ name: 'Campaign Newsletter Templates', url: WEBSITE_ADMIN_URL + 'campaign_newsletter', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/campaign_newsletter/edit': [{ name: 'Campaign Newsletter Templates', url: WEBSITE_ADMIN_URL + 'campaign_newsletter', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/campaign_newsletter/duplicate': [{ name: 'Campaign Newsletter Templates', url: WEBSITE_ADMIN_URL + 'campaign_newsletter', icon: 'email' }, { name: 'Duplicate', url: '', icon: 'control_point_duplicate' }],
	'admin/campaign_newsletter/view': [{ name: 'Campaign Newsletter Templates', url: WEBSITE_ADMIN_URL + 'campaign_newsletter', icon: 'email' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** REPORT ABUSE IN POLL SECTION */
	'admin/poll_abuse_reports/list': [{ name: 'Polls', url: '', icon: 'bug_report' }],
	'admin/poll_abuse_reports/view': [{ name: 'Polls', url: WEBSITE_ADMIN_URL + 'poll_abuse_reports', icon: 'bug_report' }, { name: 'View', url: '', icon: 'find_in_page' }],
	'admin/poll_comments_abuse_reports/list': [{ name: 'Poll Comments', url: '', icon: 'bug_report' }],
	'admin/poll_comments_abuse_reports/view': [{ name: 'Poll Comments', url: WEBSITE_ADMIN_URL + 'poll_comments_abuse_reports', icon: 'bug_report' }, { name: 'View', url: '', icon: 'find_in_page' }],

	/** CAMPAIGN UNSUBSCRIBE EMAILS SECTION */
	'admin/segment_campaign_unsubscribe_emails/list': [{ name: 'Campaign Unsubscribe Email', url: '', icon: 'email' }],

	/** AI STEPS */
	'admin/ai_steps': [{ name: 'AI Steps', url: '', icon: 'spellcheck' }],

	/** WELCOME_AI_COMMUNICATION */
	'admin/welcome_ai_communication': [{ name: 'Welcome AI Communication', url: '', icon: 'spellcheck' }],

	/** PLAN SECTION */
	'admin/plan/list': [{ name: 'Plan Management', url: '', icon: 'attach_money' }],
	'admin/plan/edit': [{ name: 'Plan Management', url: WEBSITE_ADMIN_URL + 'plan', icon: 'attach_money' }, { name: 'Edit Plan', url: '', icon: 'mode_edit' }],
	'admin/plan/add': [{ name: 'Plan Management', url: WEBSITE_ADMIN_URL + 'plan', icon: 'attach_money' }, { name: 'Add Plan', url: '', icon: 'add' }],

	/** AI BOT WELCOME EMAIL TEMPLATES SECTION */
	'admin/get_started_home_page_template/list': [{ name: 'Get Started Home Page Email Templates', url: '', icon: 'email' }],
	'admin/get_started_home_page_template/add': [{ name: 'Get Started Home Page Email Templates', url: WEBSITE_ADMIN_URL + 'get_started_home_page_template', icon: 'email' }, { name: 'Add', url: '', icon: 'add' }],
	'admin/get_started_home_page_template/edit': [{ name: 'Get Started Home Page Email Templates', url: WEBSITE_ADMIN_URL + 'get_started_home_page_template', icon: 'email' }, { name: 'Edit', url: '', icon: 'mode_edit' }],


	/** SOCIAL REACHOUT SECTION*/
	'admin/social_reachout': [{ name: 'Social Reachout Management', url: '', icon: 'markunread_mailbox' }],

	/** WELCOME AI COMMUNICATION */
	'admin/website_crawl_lists': [{ name: 'Website Crawl Lists', url: '', icon: 'spellcheck' }],

	/**BULK EMAIL UPLOAD SECTION */
	'admin/bulk_email_upload/list': [{ name: 'Bulk Email Upload Management', url: '', icon: 'new_releases' }],
	'admin/bulk_email_upload/add': [{ name: 'Bulk Email Upload Management', url: WEBSITE_ADMIN_URL + 'bulk_email_upload', icon: 'new_releases' }, { name: 'Add', url: '', icon: 'add' }],


	/** ANNOUNCEMENT SECTION */
	'admin/announcement/list': [{ name: 'Announcement Management', url: '', icon: 'chrome_reader_mode' }],
	'admin/announcement/edit': [{ name: 'Announcement Management', url: WEBSITE_ADMIN_URL + 'announcement', icon: 'chrome_reader_mode' }, { name: 'Edit Announcement', url: '', icon: 'mode_edit' }],
	'admin/announcement/add': [{ name: 'Announcement Management', url: WEBSITE_ADMIN_URL + 'announcement', icon: 'chrome_reader_mode' }, { name: 'Add Announcement', url: '', icon: 'add' }],

	/** BLOG'S SECTION */
	'admin/blogs/list': [{ name: 'Blogs Management', url: '', icon: 'book' }],
	'admin/blogs/edit': [{ name: 'Blogs Management', url: WEBSITE_ADMIN_URL + 'blogs', icon: 'book' }, { name: 'Edit', url: '', icon: 'mode_edit' }],
	'admin/blogs/add': [{ name: 'Blogs Management', url: WEBSITE_ADMIN_URL + 'blogs', icon: 'book' }, { name: 'Add', url: '', icon: 'add' }],

};