var async = require('async');
const asyncParallel = require('async/parallel');
var fs = require("fs");
const { google } = require('googleapis');

function Default() {

	/**
	 * Function to get settings list using async/await for faster and cleaner response.
	 * @return json
	 */
	this.getGlobalSettings = async function (req, res) {
		try {
			const settings = db.collection(TABLE_SETTINGS);

			// Fetch settings matching the condition using async/await
			const result = await settings.find({ "type": { $in: CONDITION_SETTING } }, { projection: { key_value: 1, value: 1 } }).toArray();

			let finalResponse = {};

			if (result && result.length > 0) {
				// Build key-value object from result
				const dataJson = {};
				for (let i = 0; i < result.length; i++) {
					dataJson[result[i]['key_value']] = result[i]['value'];
				}

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'creator_pocial_id': POCIAL_ID,
						'home_page_consultation_lead_form_id': HOME_PAGE_CONSULTATION_LEAD_FORM_POCIAL_ID,
						'home_page_bi_weekly_bulletin_lead_form_id': HOME_PAGE_BI_WEEKLY_BULLETIN_LEAD_FORM_POCIAL_ID,
						'result': dataJson,
						'message': "",
					}
				};
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'creator_pocial_id': POCIAL_ID,
						'home_page_consultation_lead_form_id': HOME_PAGE_CONSULTATION_LEAD_FORM_POCIAL_ID,
						'home_page_bi_weekly_bulletin_lead_form_id': HOME_PAGE_BI_WEEKLY_BULLETIN_LEAD_FORM_POCIAL_ID,
						'result': [],
						'message': res.__("api.global.no_record_found")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any unexpected errors
			const finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'creator_pocial_id': POCIAL_ID,
					'home_page_consultation_lead_form_id': HOME_PAGE_CONSULTATION_LEAD_FORM_POCIAL_ID,
					'home_page_bi_weekly_bulletin_lead_form_id': HOME_PAGE_BI_WEEKLY_BULLETIN_LEAD_FORM_POCIAL_ID,
					'result': [],
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getGlobalSettings();

	/**
	 * Function to get master dropdown value list using async/await for faster and cleaner response.
	 * Handles DB query with async/await and ensures clean formatting.
	 * @returns json response
	 */
	this.getMasterValue = async function (req, res) {
		let masterListArr = [];
		let finalResponse = {};
		let master_type = req.body.type ? req.body.type : '';
		const master = db.collection(TABLE_MASTERS);

		try {
			// Query master dropdown values with projection and sorting
			const result = await master.find(
				{
					'dropdown_type': master_type,
					'status': ACTIVE,
				},
				{
					projection: {
						'_id': 0,
						'id': "$_id",
						'text': "$name",
						'checked': { $literal: false }
					}
				}).sort({ name: SORT_ASC }).toArray();

			if (result && result.length > 0) {
				// Add default option based on master type
				if (master_type == MASTER_STORE_TYPE) {
					masterListArr.push({ "id": "", "text": "All", "checked": false });
				} else {
					masterListArr.push({ "id": "", "text": res.__("front.master.please_select_name"), "checked": false });
				}

				// Append result to masterListArr
				masterListArr.push(...result);

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': masterListArr,
						'message': ""
					}
				};
			} else {
				// No records found, return default option
				masterListArr.push({ "id": "", "text": res.__("front.master.please_select_name") });
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': masterListArr,
						'message': res.__("front.global.no_record_found")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle any unexpected errors
			masterListArr.push({ "id": "", "text": res.__("front.master.please_select_name") });
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': masterListArr,
					'err': err,
					'message': res.__("front.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getMasterValue();

	/**
	* Function to get CMS Details using async/await for faster and cleaner response.
	* Handles DB query with async/await and returns formatted JSON response.
	* @returns json response
	*/
	this.getCmsDetails = async function (req, res) {
		let slug = req.body.page_slug ? req.body.page_slug : "";
		let finalResponse = {};

		// Slug validation
		if (!slug || slug === "") {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: res.__("api.global.parameter_missing")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			const cms = db.collection(TABLE_PAGES);

			// Query CMS details with projection for required fields
			const result = await cms.findOne(
				{
					'slug': slug,
					'status': ACTIVE,
					'is_deleted': NOT_DELETED,
				},
				{
					projection: {
						name: 1,
						body: 1,
						meta_title: 1,
						meta_description: 1,
						meta_keyword: 1
					}
				}
			);

			if (!result) {
				// No CMS found for the given slug
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.cms.cms_invalid_url")
					}
				};
			} else {
				// CMS found, return success response
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: result,
						message: "",
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					err: err,
					message: res.__("front.cms.cms_invalid_url")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getCmsDetails();

	/**
	* Function to save contact us data using async/await for faster and cleaner response.
	* @return json 
	**/
	this.saveContactUs = async function (req, res) {
		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const name = req.body.name ? req.body.name : "";
			const email = req.body.email ? req.body.email.toLowerCase() : "";
			const phoneNumber = req.body.phone_number ? req.body.phone_number : "";
			const message = req.body.message ? req.body.message : "";
			const pageType = req.body.page_type ? req.body.page_type : "";
			const zipCode = req.body.zip_code ? req.body.zip_code : "";

			const contactCollection = db.collection(TABLE_CONTACT_US);

			// Prepare contact data
			const contactData = {
				'name': name,
				'email': email,
				'phone': phoneNumber,
				'message': message,
				'api_type': req.body.api_type,
				'page_type': pageType,
				'zip_code': zipCode,
				'modified': getUtcDate(),
				'created': getUtcDate(),
			};

			// Insert contact data into the collection
			const insertResult = await contactCollection.insertOne(contactData);

			// Send email notification in parallel (non-blocking)
			const emailOptions = {
				to: res.locals.settings["Site.admin_email"],
				bcc: res.locals.settings["Site.admin_email_contact_us"],
				action: "contact_us",
				rep_array: [DEAR_HI_CONSTANT, name, email, phoneNumber, message]
			};
			sendMail(req, res, emailOptions);

			// Prepare and send success response
			const finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: [],
					message: res.__("front.contact.contact_has_been_send_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any errors and send error response
			const finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end saveContactUs();

	/** 
	 * Function to get signup field check box data using async/await for cleaner and faster response.
	 * @return json 
	 **/
	this.getSignupFieldCheckbox = async (req, res) => {
		try {
			// Prepare the response data
			const finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: SIGNUP_FIELD_CHECKBOX_DATA,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any unexpected errors
			const finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getSignupFieldCheckbox();

	/**
	 * Function to get home page lead email using async/await and Promise.all for parallel queries.
	 * @return json 
	 */
	this.homePageLeadEmail = async function (req, res) {
		let finalResponse = {};
		let resultData = {};

		const leadsForms = db.collection(TABLE_LEAD_FORMS);
		const users = db.collection(TABLE_USERS);

		try {
			// Run admin business check and business user activity in parallel for faster response
			const [adminBusinessCheck, businessUserActivity] = await Promise.all([
				// Check if admin business details exist
				users.countDocuments({
					"_id": newObjectIdDefault(POCIAL_ID),
					"account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
					"public_business_informaton": { $exists: true },
				}),
				// Get business user activity
				getBusinessUserAllActivityUse(POCIAL_ID).then(unlessFormBusinessUser => unlessFormBusinessUser.business_lead_activity)
			]);

			const businessUserActivityValue = businessUserActivity ? businessUserActivity : DEFAULT_ZERO;
			const adminBusinessCheckValue = adminBusinessCheck ? adminBusinessCheck : DEFAULT_ZERO;

			if (businessUserActivityValue > 0 && adminBusinessCheckValue > 0) {
				// Get active lead form for home page
				const result = await leadsForms.findOne(
					{
						'is_home_page': DEFAULT_ONE,
						'is_deleted': NOT_DELETED,
					},
					{ projection: { _id: 1, user_id: 1, button_name: 1 } }
				);

				if (!result) {
					finalResponse = {
						'data': {
							status: STATUS_ERROR,
							result: [],
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					resultData['lead_forms_id'] = result._id;
					resultData['creator_id'] = result.user_id;
					resultData['button_name'] = result.button_name;
					finalResponse = {
						'data': {
							status: STATUS_SUCCESS,
							result: resultData,
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end homePageLeadEmail();

	/**
	 * Function to get thank you message for home page lead form using async/await.
	 * @return json
	 */
	this.getThankuMessage = async function (req, res) {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			let leadFormsSlug = req.body.lead_forms_slug ? req.body.lead_forms_slug : "";

			// Slug validation
			if (!leadFormsSlug || leadFormsSlug === '') {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("api.global.parameter_missing")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const leadsForms = db.collection(TABLE_LEAD_FORMS);

			// Fetch lead form details using async/await
			const result = await leadsForms.findOne(
				{ slug: leadFormsSlug },
				{
					projection: {
						_id: 1,
						image: 1,
						text_to_display: 1,
						display_url_description: 1,
						custom_thank_you_title: 1,
						slug: 1,
						kiosk_option: 1,
						custom_thank_you_message: 1
					}
				}
			);

			if (!result) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Set default thank you title and message if not present
			result['custom_thank_you_title'] = result.custom_thank_you_title ? result.custom_thank_you_title : res.__("front.leads.custom_thank_you_title");
			result['custom_thank_you_message'] = result.custom_thank_you_message ? result.custom_thank_you_message : res.__("front.leads.custom_thank_you_message");

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					image_url: LEADS_FORM_URL,
					result: result,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getThankuMessage();

	/**
	 * Function to get block data using async/await for faster and cleaner response.
	 * @return json
	 */
	this.getBlockData = async function (req, res) {
		try {
			const blockSlug = req.body.block_slug ? req.body.block_slug : '';
			const block = db.collection(TABLE_BLOCK);

			// Fetch block data by slug with projection
			const blockResult = await block.findOne(
				{ block_slug: blockSlug },
				{
					projection: {
						_id: 1,
						page_name: 1,
						block_name: 1,
						description: 1
					}
				}
			);

			const finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: blockResult ? blockResult : [],
					message: ''
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			const finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getBlockData();

	/**
	 * Function to get category listing using async/await for faster and cleaner response.
	 * @return json
	 */
	this.getCategoryListing = async function (req, res) {
		try {
			// Fetch category records asynchronously
			const responseCategory = await getCategoriesData();

			const finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: (responseCategory && responseCategory.result) ? responseCategory.result : [],
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			const finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getCategoryListing();

	/**
	* Function to get lead capture script listing using async/await for faster and cleaner response.
	* Handles all DB queries with async/await and runs parallel queries with Promise.all for efficiency.
	* @return json 
	**/
	this.getLeadCaptureScriptListing = async function (req, res) {
		try {
			const leadsForms = db.collection(TABLE_LEAD_FORMS);
			const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);

			// Prepare ObjectIds for queries
			const leadFormId = req.params.lead_forms_id ? newObjectIdDefault(req.params.lead_forms_id) : newObjectIdDefault();
			const scriptId = req.params.scripted_id ? newObjectIdDefault(req.params.scripted_id) : newObjectIdDefault();

			// Run both queries in parallel for efficiency
			const [leadFormResult, scriptResult] = await Promise.all([
				leadsForms.findOne({ _id: leadFormId }),
				customizedScript.findOne({ _id: scriptId })
			]);

			// Attach script result to lead form result if lead form exists
			if (leadFormResult) {
				leadFormResult['result_script'] = scriptResult;
			}

			return res.send({
				status: STATUS_SUCCESS,
				result: leadFormResult
			});
		} catch (err) {
			return res.send({
				status: STATUS_ERROR,
				result: null
			});
		}
	}; // end getLeadCaptureScriptListing();

	/*** Function for use to sort total count in collection */
	function compareTotalCount(a, b) {
		return a.count - b.count;
	}// end compareTotalCount();

	/**
	 * Function to search overall data using async/await for faster and cleaner response.
	 * Handles all DB queries with async/await and runs parallel queries with Promise.all for efficiency.
	 * @return json 
	 **/
	this.getSearchOverAll = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Get user data and search parameters
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const searchKeyword = req.body.search_keyword ? req.body.search_keyword : "";
			let typeFilter = req.body.type_filter ? req.body.type_filter : [];
			typeFilter = (typeFilter.length > 0) ? typeFilter : [EMAIL_SEARCH, LEADS_SEARCH, REWARD_SEARCH];

			// Validate user and search keyword
			if (!userId || !searchKeyword) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Pagination setup
			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			// Prepare collections
			const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const rewards = db.collection(TABLE_REWARDS);
			const leadsForms = db.collection(TABLE_LEAD_FORMS);

			// Prepare search options for each collection
			const optionsEmailData = {
				'user_id': userId,
				'is_deleted': NOT_DELETED,
				'template_title': { $regex: new RegExp(searchKeyword, "i") },
			};
			const optionsRewardData = {
				'user_id': userId,
				'is_deleted': NOT_DELETED,
				'reward_text': { $regex: new RegExp(searchKeyword, "i") },
			};
			const optionsLeadsData = {
				'user_id': userId,
				'is_deleted': NOT_DELETED,
				'title': { $regex: new RegExp(searchKeyword, "i") },
			};

			// Run count queries in parallel for efficiency
			const [emailCount, rewardCount, leadsCount] = await Promise.all([
				emailTemplate.countDocuments(optionsEmailData),
				rewards.countDocuments(optionsRewardData),
				leadsForms.countDocuments(optionsLeadsData)
			]);

			// Calculate total records based on typeFilter
			let totalRecord = 0;
			if (typeFilter.includes(EMAIL_SEARCH)) totalRecord += emailCount;
			if (typeFilter.includes(REWARD_SEARCH)) totalRecord += rewardCount;
			if (typeFilter.includes(LEADS_SEARCH)) totalRecord += leadsCount;

			// Prepare array for sorting by count
			let allCountArray = [
				{
					'count': emailCount,
					'collection': TABLE_EMAIL_NEWSLETTER_TEMPLATE,
					'search_keyword': optionsEmailData,
					'project_key_search': { 'template_title': 1, 'description': 1, 'type_filter': EMAIL_SEARCH, 'action': 1 },
				},
				{
					'count': rewardCount,
					'collection': TABLE_REWARDS,
					'search_keyword': optionsRewardData,
					'project_key_search': { 'reward_text': 1, 'reward_sub_heading': 1, 'type_filter': REWARD_SEARCH, 'slug': 1 },
				},
				{
					'count': leadsCount,
					'collection': TABLE_LEAD_FORMS,
					'search_keyword': optionsLeadsData,
					'project_key_search': { 'title': 1, 'description': 1, 'type_filter': LEADS_SEARCH, 'slug': 1 },
				}
			];

			// Sort collections by count (ascending)
			let sortedResult = allCountArray.sort(compareTotalCount);
			let firstMaximum = sortedResult[2];
			let secondMaximum = sortedResult[1];
			let thirdMaximum = sortedResult[0];

			// Build aggregation pipeline for union search across collections
			const pipeline = [
				{ $match: firstMaximum['search_keyword'] },
				{
					$unionWith: {
						coll: secondMaximum['collection'],
						pipeline: [
							{ $match: secondMaximum['search_keyword'] },
							{ $project: secondMaximum['project_key_search'] }
						]
					}
				},
				{
					$unionWith: {
						coll: thirdMaximum['collection'],
						pipeline: [
							{ $match: thirdMaximum['search_keyword'] },
							{ $project: thirdMaximum['project_key_search'] }
						]
					}
				},
				{
					$project: {
						'type_filter': { $cond: ["$type_filter", "$type_filter", firstMaximum['project_key_search']['type_filter']] },
						'reward_text': 1,
						'reward_sub_heading': 1,
						'slug': 1,
						"random_color": { $round: [{ $multiply: [{ $rand: {} }, 2] }, 0] },
						'template_title': 1,
						'description': 1,
						'action': 1,
						'title': 1,
						'slug': 1,
						'description': 1,
					}
				},
				{
					$match: {
						'type_filter': { $in: typeFilter }
					}
				},
				{ $skip: skip },
				{ $limit: limit },
			];

			// Run the aggregation query using async/await
			const resultAllData = await db.collection(firstMaximum['collection']).aggregate(pipeline).toArray();

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					recordsTotal: totalRecord,
					page: page,
					total_page: Math.ceil(totalRecord / limit),
					result: resultAllData ? resultAllData : [],
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					recordsTotal: 0,
					page: 0,
					total_page: 0,
					result: [],
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getSearchOverAll();

	/**
	 * Function to get dynamic string constants.
	 * Uses async/await for file reading to ensure faster and cleaner response.
	 * @returns JSON
	 */
	this.getDynamicStringConstant = async (req, res) => {
		try {
			// Read the en.json file asynchronously using promises
			const data = await fs.promises.readFile(WEBSITE_ROOT_PATH + "locales/en.json", "utf8");
			return res.send({
				status: STATUS_SUCCESS,
				result: data
			});
		} catch (err) {
			// Handle file read errors
			return res.send({
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.system.something_went_wrong")
			});
		}
	}; // end getDynamicStringConstant();

	/**
	 * Function to get poll vote list using async/await for faster and cleaner response.
	 * All DB queries are handled with async/await.
	 */
	this.getPollVotes = async (req, res) => {
		let finalResponse = {};

		// Get user id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

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

		try {
			const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

			// Aggregate poll vote list for the user
			const pollsResult = await pollVoteParticipants.aggregate([
				{ $match: { 'user_id': { $nin: [null, ""] } } },
				{
					$group: {
						_id: {
							"poll_id": "$poll_id",
							"user_id": "$user_id",
						},
						"vote_id": { $last: "$_id" },
						"created": { $last: "$created" },
						"poll_id": { $last: "$poll_id" },
						"user_id": { $last: "$user_id" },
						"poll_question": { $last: "$poll_question" },
					}
				},
				{
					$project: {
						'_id': 1,
						'vote_id': 1,
						'poll_id': 1,
						'user_id': 1,
						'created': 1,
						'poll_question': 1,
					}
				},
				{ $sort: { 'created': SORT_DESC } },
			]).toArray();

			if (pollsResult && pollsResult.length > 0) {
				// Extract vote ids
				const arrayVoteId = pollsResult.map(record => record.vote_id);

				// Update all latest votes in parallel (single updateMany call)
				await pollVoteParticipants.updateMany(
					{ _id: { $in: arrayVoteId } },
					{ $set: { 'latest_vote': DEFAULT_ONE } }
				);

				// Success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result1: arrayVoteId.length,
						result2: pollsResult.length,
						result: arrayVoteId,
						message: "",
					}
				};
			} else {
				// No records found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getPollVotes();

	/**
	 * Function to get segment left count using async/await for faster and cleaner response.
	 * All DB queries are run in parallel using Promise.all.
	 * @returns json response
	 */
	this.getSegmentLeftCount = async (req, res) => {
		let finalResponse = {};
		// Get user id from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		if (!userId) {
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
			// Define collections
			const segmentCollection = db.collection(TABLE_POLL_SEGMENT);
			const newsletterTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const campaignCollection = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER);

			// Prepare queries to run in parallel
			const totalSegmentsPromise = segmentCollection.countDocuments({
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED
			});

			const totalNewslettersPromise = newsletterTemplate.countDocuments({
				user_id: newObjectIdDefault(userId),
				is_deleted: NOT_DELETED,
				template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE
			});

			const totalCampaignsPromise = campaignCollection.countDocuments({
				user_id: newObjectIdDefault(userId)
			});

			// Run all queries in parallel
			const [total_segments, total_newsletters, total_campaigns] = await Promise.all([
				totalSegmentsPromise,
				totalNewslettersPromise,
				totalCampaignsPromise
			]);

			// Build response object
			const result = {
				total_segments,
				total_newsletters,
				total_campaigns
			};

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result,
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Send error response on failure
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getSegmentLeftCount();


	/**
	 * Function to handle "Get Started" home page details and send to administrator.
	 * Uses async/await for any asynchronous operations for cleaner and faster response.
	 * @returns JSON response
	 */
	this.getStartedHomePage = async (req, res) => {
		try {
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const firstName = req.body.first_name ? req.body.first_name : "";
			const lastName = req.body.last_name ? req.body.last_name : "";
			const mobile = req.body.mobile ? req.body.mobile : "";
			const email = req.body.email ? req.body.email : "";
			const companyWebsite = req.body.company_website ? req.body.company_website : "N/A";
			const message = req.body.message ? req.body.message : "N/A";

			// Validate required fields
			if (!firstName || !lastName || !email || !mobile) {
				const finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const userName = `${firstName} ${lastName}`;
			const userMobile = mobile ? mobile : "N/A";

			// Prepare email options
			const emailOptions = {
				to: res.locals.settings["Site.home_page_email_id"],
				action: "get_started_home_page",
				rep_array: [DEAR_HI_CONSTANT, userName, userMobile, email, companyWebsite, message]
			};

			// Send email asynchronously and wait for completion
			await sendMail(req, res, emailOptions);

			const finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.home.thank_you_for_submitting_information"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			const finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getStartedHomePage();

	/**
	 * Function to add home page newsletter submit (Excel append) using async/await.
	 * Handles Google Sheets append and MongoDB logging with proper error handling.
	 * All DB and external queries are handled with async/await for faster and cleaner response.
	 * @returns JSON response
	 */
	this.homePageNewsletterSubmitAfterExcelSubmit = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const email = req.body.email ? req.body.email : "";
		let finalResponse = {};

		// Validate email
		if (!email) {
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
			// Set credentials for Google Sheets
			const { client_email, private_key } = GOOGLE_SHEET_CREDENTIALS;

			// Initialize Google JWT for appending data
			const auth = new google.auth.JWT({
				email: client_email,
				key: private_key,
				scopes: ['https://www.googleapis.com/auth/spreadsheets']
			});

			const sheets = google.sheets({ version: 'v4', auth });

			const spreadsheetId = GOOGLE_SHEET_SPREADSHEET_ID;
			const range = 'Sheet1!A:A'; // Assuming emails are in column A
			const valueInputOption = 'RAW';
			const insertDataOption = 'INSERT_ROWS';

			const resource = {
				values: [[email]]
			};

			// Append email to Google Sheet using async/await
			const response = await sheets.spreadsheets.values.append({
				spreadsheetId,
				range,
				valueInputOption,
				insertDataOption,
				resource
			});

			// Log the newsletter submission in MongoDB using async/await
			const homePageEmailNewsletter = db.collection(TABLE_HOME_PAGE_EMAIL_NEWSLETTER);
			await homePageEmailNewsletter.insertOne({
				email: email,
				response: response,
				created: getUtcDate(),
			});

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.homepage_newsletter.email_has_been_send_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			console.error('Error appending email:', err);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.default.an_error_occurred_while_appending_email"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end homePageNewsletterSubmitAfterExcelSubmit();

	/**
	 * Function to handle all types of unsubscribe requests using async/await.
	 * Handles welcome email, insider poll welcome email, and social reachout unsubscribe types.
	 * All DB queries use async/await for faster and cleaner response.
	 * @returns JSON response
	 */
	this.allTypeUnsubscribeUser = async (req, res) => {
		let finalResponse = {};

		const unsubscribedType = req.body.unsubscribed_type || "";
		const validateString = req.body.validate_string || "";
		const confirmationFlag = req.body.confirmation_flag || false;

		if (!validateString || !unsubscribedType) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let optionCondition = {};
		let updateData = {};
		let mainUnsubscribedCollection = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		// Set query and update data based on unsubscribe type
		if (unsubscribedType === UNSUBSCRIBED_TYPE_FOR_INSIDER_WELCOME_EMAIL) {
			optionCondition = {
				"welcome_email_unsubscribe_validate_string": validateString
			};
			updateData = {
				'welcome_email_unsubscribe_validate_string': "",
				'welcome_email_unsubscribed': true
			};
			mainUnsubscribedCollection = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		} else if (unsubscribedType === UNSUBSCRIBED_TYPE_FOR_INSIDER_POll_WELCOME_EMAIL) {
			optionCondition = {
				"insider_poll_welcome_email_unsubscribe_validate_string": validateString
			};
			updateData = {
				'insider_poll_welcome_email_unsubscribe_validate_string': "",
				'insider_poll_welcome_email_unsubscribed': true
			};
			mainUnsubscribedCollection = db.collection(TABLE_USERS);
		} else if (unsubscribedType === UNSUBSCRIBED_TYPE_FOR_SOCIAL_REACHOUT) {
			optionCondition = {
				"social_unsubscribe_validate_string": validateString
			};
			updateData = {
				'social_unsubscribe_validate_string': "",
				'social_unsubscribed': true
			};
			mainUnsubscribedCollection = db.collection(TABLE_USERS);
		}

		try {
			// Find the user/document matching the unsubscribe validation string
			const userResult = await mainUnsubscribedCollection.findOne(optionCondition, { projection: { '_id': 1 } });

			if (userResult) {
				if (confirmationFlag === true) {
					const unsubscribeMainId = userResult._id ? userResult._id : "";

					// Prepare parallel update promises if needed
					const updatePromises = [];

					// If welcome email unsubscribe, also update again sent welcome email subscriber user collection
					if (unsubscribedType === UNSUBSCRIBED_TYPE_FOR_INSIDER_WELCOME_EMAIL) {
						const againSentWlcWmailSubscriberUser = db.collection(TABLE_AGAIN_SENT_WLC_EMAIL_SUBSCRIBER_USER);
						updatePromises.push(
							againSentWlcWmailSubscriberUser.updateMany(
								{ "lead_forms_subscriber_id": newObjectIdDefault(unsubscribeMainId) },
								{ $set: updateData }
							)
						);
					}

					// Update the main unsubscribed collection
					updatePromises.push(
						mainUnsubscribedCollection.updateOne(
							{ "_id": newObjectIdDefault(unsubscribeMainId) },
							{ $set: updateData }
						)
					);

					// Run all updates in parallel
					await Promise.all(updatePromises);

					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							message: res.__("front.campaign.email_has_been_unsubscribed_successfully"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					// If confirmation flag is not true, return not subscribed message
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							message: res.__("front.campaign.email_has_been_not_subscribed_successfully")
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// No user/document found for the given validation string
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.campaign.this_url_is_not_validate"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			console.error("Error in allTypeUnsubscribeUser:", err);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.campaign.this_url_is_not_validate"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end allTypeUnsubscribeUser();


	/**
	 * Function to get the announcement list using async/await.
	 * All DB queries are handled with async/await for clean and fast response.
	 * @returns JSON response with announcement list or error message.
	 */
	this.getAnnouncementList = async (req, res) => {
		try {
			const announcementCollection = db.collection(TABLE_ANNOUNCEMENTS);

			// Fetch announcements that are not deleted and active
			const records = await announcementCollection.find(
				{ is_deleted: NOT_DELETED, status: ACTIVE },
				{ projection: { _id: 1, title: 1, announcement_text: 1 } }
			).toArray();

			// Prepare response based on records found
			const finalResponse = {
				data: {
					status: records.length > 0 ? STATUS_SUCCESS : STATUS_ERROR,
					result: records.length > 0 ? records : [],
					message: records.length > 0 ? "" : res.__("api.global.no_record_found"),
				}
			};

			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			console.error("Announcement List Error:", error);

			// Send error response if any exception occurs
			const finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	};

	/**
	 * Function to close the announcement bar for the logged-in user.
	 * Uses async/await for all DB operations for clean and fast response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns JSON response
	 */
	this.closeAnnouncementBar = async (req, res) => {
		try {
			const loginUserData = req.user_data;

			// Validate user session and user ID
			if (!loginUserData || !loginUserData._id) {
				const finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const userId = newObjectIdDefault(loginUserData._id);
			const usersCollection = db.collection(TABLE_USERS);

			// Update the user's document to set close_announcement to true
			const updateResult = await usersCollection.updateOne(
				{ _id: userId },
				{ $set: { close_announcement: true } }
			);

			// Check if the update was successful
			if (updateResult.modifiedCount === 0) {
				const finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.unable_to_update_announcement_status"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Send success response
			const finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.system.announcement_bar_closed_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			console.error("Error in closeAnnouncementBar:", err);
			const finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End closeAnnouncementBar


	/**
	 * Function to fetch all user accounts that share the same email as the currently logged-in user.
	 * Uses async/await for all database operations for cleaner and faster response.
	 * @param {*} req - Express request object
	 * @param {*} res - Express response object
	 * @returns JSON response with matching user records
	 */
	this.getUsersWithSameEmail = async (req, res) => {
		try {
			const loginUserData = req.user_data;
			const loginUserId = loginUserData && loginUserData._id ? loginUserData._id : "";
			const loginUserEmail = loginUserData && loginUserData.email ? loginUserData.email : "";

			// Validate login session and email
			if (!loginUserData || !loginUserEmail) {
				return returnApiResult(req, res, {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				});
			}

			const usersCollection = db.collection(TABLE_USERS);

			// Prepare the query and projection for fetching users with the same email (case-insensitive)
			const query = {
				'_id': { $ne: loginUserId },
				'email': { $regex: `^${loginUserEmail}$`, $options: 'i' }
			};
			const projection = {
				'full_name': 1,
				'slug': 1,
				'email': 1,
				'public_business_informaton.name_of_the_business': 1
			};

			// Fetch all users matching the email in parallel (if more queries are added, use Promise.all)
			const matchedUsers = await usersCollection.find(query, { projection }).toArray();

			// Return success response with matched users
			return returnApiResult(req, res, {
				data: {
					status: STATUS_SUCCESS,
					result: matchedUsers,
				}
			});

		} catch (err) {
			console.error("Error in getUsersWithSameEmail:", err);
			// Return error response
			return returnApiResult(req, res, {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.something_went_wrong"),
				}
			});
		}
	};


	/**
	 * Function to get blog listing using async/await for faster and cleaner response.
	 * All DB queries are handled with async/await, and any parallel queries are run with Promise.all for efficiency.
	 * @return json 
	 **/
	this.getBlogListing = async (req, res) => {
		try {
			const blogs = db.collection(TABLE_BLOGS);

			// Pagination setup
			const page = req.body.page ? parseInt(req.body.page) : 1;
			const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			const skip = (limit * page) - limit;

			// Query conditions for blogs
			const conditions = {
				'is_draft': NOT_DRAFT_STATUS,
				'status': ACTIVE,
				'is_deleted': NOT_DELETED,
			};

			// Run blog listing and total count queries in parallel for efficiency
			const [listing, totalRecord] = await Promise.all([
				// Fetch paginated blog list, sorted by created date (descending)
				blogs.find(conditions)
					.sort({ 'created': -1 })
					.skip(skip)
					.limit(limit)
					.toArray(),
				// Fetch total number of records matching the conditions
				blogs.countDocuments(conditions)
			]);

			// Map blog list to add plainTextDescription field
			const resultData = (listing || []).map(blog => ({
				...blog,
				plainTextDescription: stripHtmlTags(blog.description || '')
			}));

			// Send success response
			const finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: BLOGS_IMAGE_URL,
					result: resultData,
					recordsTotal: totalRecord,
					limit: limit,
					page: page,
					message: resultData.length > 0 ? "" : res.__("front.global.no_record_found"),
					total_page: Math.ceil(totalRecord / limit)
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// On error, send empty result with error message
			const finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: BLOGS_IMAGE_URL,
					result: [],
					recordsTotal: 0,
					limit: req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT,
					page: req.body.page ? parseInt(req.body.page) : 1,
					message: res.__("front.global.no_record_found"),
					total_page: 0
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getBlogListing();


	/**
	 * Function to get blog details using async/await for faster and cleaner response.
	 * Fetches the main blog and related posts in parallel.
	 * @return json
	 */
	this.blogsDetails = async function (req, res) {
		const slug = req.body.blog_slug?.trim() || "";
		let finalResponse = {};

		// Validate slug
		if (!slug) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("api.global.parameter_missing")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			const blogs = db.collection(TABLE_BLOGS);

			// Prepare main blog queries
			const mainBlogQuery = blogs.findOne({ 'slug': slug, 'is_draft': NOT_DRAFT_STATUS, 'status': ACTIVE, 'is_deleted': NOT_DELETED });

			// Prepare related blog queries
			const relatedBlogsQuery = blogs.find({
				'slug': { $ne: slug },
				'is_draft': NOT_DRAFT_STATUS,
				'status': ACTIVE,
				'is_deleted': NOT_DELETED
			}).sort({ 'created': SORT_DESC }).limit(3).toArray();

			// Run both queries in parallel for efficiency
			const [result, relatedResult] = await Promise.all([mainBlogQuery, relatedBlogsQuery]);

			if (!result) {
				// No main blog found
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						image_url: BLOGS_IMAGE_URL,
						result: {},
						related_post: [],
						message: res.__("api.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Convert related posts' descriptions to plain text
			const modifiedrelatedResult = (relatedResult || []).map(blog => ({
				...blog,
				plainTextDescription: stripHtmlTags(blog.description || '')
			}));

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: BLOGS_IMAGE_URL,
					result: result,
					related_post: modifiedrelatedResult.length > 0 ? modifiedrelatedResult : [],
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// On error, send empty result with error message
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					image_url: BLOGS_IMAGE_URL,
					result: {},
					related_post: [],
					message: res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end blogsDetails();

}
module.exports = new Default();