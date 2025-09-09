const async = require('async');
const polls = db.collection(TABLE_POLLS);
const rewards = db.collection(TABLE_REWARDS);
const campaignAccordingUserDetails = db.collection(TABLE_CAMPAIGN_ACCORDING_USER_DETAILS);
const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);
const tableInsiderAiCampaignChat = db.collection(TABLE_INSIDER_AI_CAMPAIGN_CHAT);
const OpenAI = require("openai");
const openai = new OpenAI({
	apiKey: process.env.OPEN_AI // apna key yaha rakho
});

function insiderPollEmailGenerate() {

	/**
	 * Function is used to get AI first poll detail
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAiFirstPollDetail = async (req, res) => {
		try {
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			let loginUserData = (req.user_data) ? req.user_data : "";
			let userId = (loginUserData._id) ? loginUserData._id : "";
			let aiCampaignParentId = (req.body.ai_campaign_parent_id) ? req.body.ai_campaign_parent_id : "";
			let customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

			let finalResponse = {};
			let optionArrayData = [];

			if (userId == '') {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get poll option IDs if campaign parent ID is provided
			if (aiCampaignParentId != "") {
				// Find poll options in campaign name collection using aggregation
				const pollOptionsData = await tableAiCampaignName.aggregate([
					{ $match: { "_id": newObjectIdDefault(aiCampaignParentId) } },
					{ $unwind: "$option_datas" },
					{ $match: { "option_datas.option_id": { $ne: "", $exists: true } } },
					{ $group: { _id: null, option_ids: { $addToSet: "$option_datas.option_id" } } },
					{ $project: { _id: 0, option_ids: 1 } }
				]).toArray();

				// Get option IDs array
				let optionIdsArray = (pollOptionsData[0] && pollOptionsData[0]['option_ids']) ? pollOptionsData[0]['option_ids'] : [];

				// Push ObjectId in array of options
				if (optionIdsArray.length > 0) {
					optionArrayData = optionIdsArray.map(recordsIds => newObjectIdDefault(recordsIds));
				}
			}

			// Get first insider campaign poll detail (await the promise)
			const insiderPollResponse = await firstInsidersPollDetails(userId, optionArrayData);

			if (insiderPollResponse.status == STATUS_SUCCESS) {
				// Get latest campaign id using async/await
				const latestCampaigns = await tableAiCampaignName.find({
					"user_id": newObjectIdDefault(userId),
					'is_deleted': NOT_DELETED,
					'type': INSIDER_POLL_CAMPAIGN
				}, { projection: { _id: 1 } })
					.sort({ created: -1 })
					.limit(1)
					.toArray();

				let campaignId = (latestCampaigns && latestCampaigns.length > 0) ? latestCampaigns[0]._id : "";

				// Send success response
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						poll_url: POLLS_URL,
						result: insiderPollResponse.result,
						campaign_id: campaignId,
						message: ""
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error response
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						user_url: USERS_URL,
						poll_url: POLLS_URL,
						result: {},
						campaign_id: "",
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle unexpected errors
			let finalResponse = {
				'data': {
					status: STATUS_ERROR,
					user_url: USERS_URL,
					poll_url: POLLS_URL,
					result: {},
					campaign_id: "",
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	} // end getAiFirstPollDetail()

	/**
	 * Function is used to save campaign according to user details
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.saveCampaignAccordingDetails = async (req, res) => {
		try {
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
			const aiCampaignName = req.body.ai_campaign_name || "";
			const pollId = req.body.poll_id ? newObjectIdDefault(req.body.poll_id) : "";
			const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";

			let finalResponse = {};

			if (!userId || !aiCampaignName || !pollId) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get user business information
			const publicBusinessInformation = loginUserData.public_business_informaton || {};
			const businessName = publicBusinessInformation.name_of_the_business || "";
			const offeringDiscount = publicBusinessInformation.preferred_offering_or_discount || "";
			const uniqueSaleProposition = publicBusinessInformation.unique_selling_proposition || "";
			const targetAudience = publicBusinessInformation.target_audience || "";
			let aiIndustryNames = publicBusinessInformation.ai_business_industry_names || [];
			const campaignMainGoal = publicBusinessInformation.main_goal_of_your_email_campaign_name || "";
			const toneEmail = publicBusinessInformation.tone_or_style_email_name || "";
			const specificProductService = publicBusinessInformation.specific_product_or_service || "";
			const benefitService = publicBusinessInformation.benefits_product_or_service || "";
			const callAction = publicBusinessInformation.call_to_action || "";

			// Get req body data
			const preferredOfferingOrDiscount = req.body.hasOwnProperty('preferred_offering_or_discount') ? req.body.preferred_offering_or_discount : offeringDiscount;
			const mainGoalYourEmailCampaignName = req.body.main_goal_of_your_email_campaign_name || campaignMainGoal;
			const toneOrStyleEmailName = req.body.tone_or_style_email_name || toneEmail;
			const specificProductOrService = req.body.specific_product_or_service || specificProductService;
			const benefitsProductOrService = req.body.benefits_product_or_service || benefitService;
			const callToAction = req.body.call_to_action || callAction;
			const additionalInformation = req.body.additional_information || "";
			const informationGetFromPdf = req.body.information_get_from_pdf || "";
			const attachRewardInEmail = req.body.attach_reward_in_email || "";
			const getPollOpinions = req.body.get_poll_opinions || "";
			const uploadedAiPdfDoc = (req.files && req.files.uploaded_ai_pdf_doc) ? req.files.uploaded_ai_pdf_doc : "";

			// Format industry names for display
			if (aiIndustryNames.length > 1) {
				const lastConcat = aiIndustryNames[aiIndustryNames.length - 2] + ' and ' + aiIndustryNames[aiIndustryNames.length - 1];
				aiIndustryNames.splice(aiIndustryNames.length - 2, 1);
				aiIndustryNames.splice(aiIndustryNames.length - 1, 1);
				aiIndustryNames.push(lastConcat);
			}
			const aiBusinessIndustry = aiIndustryNames.join(', ');

			// Access post limit data for the activity type
			const postLimitData = await planAccourdingLimitAccessMiddleware(req, res, loginUserData, ACTIVITY_EMAIL_CREATE_TYPE);

			if (postLimitData.status == NOT_ALLOW_CREATE_DATA) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"message": res.__("front.social_post_limnt.post_limit_reached_upgrade_your_plan_to_post_more"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Generate slug for ai insider campaign chat
			const slugOptions = {
				title: aiCampaignName,
				table_name: TABLE_AI_CAMPAIGN_NAME,
				slug_field: "slug"
			};
			const slugResponse = await getDatabaseSlug(slugOptions);

			// Insert ai campaign name
			const insertResult = await tableAiCampaignName.insertOne({
				'user_id': userId,
				'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
				'ai_campaign_name': aiCampaignName,
				'ai_campaign_created_name': "",
				'type': INSIDER_POLL_CAMPAIGN,
				'poll_id': newObjectIdDefault(pollId),
				'is_deleted': NOT_DELETED,
				'created': getUtcDate(),
			});
			if (!insertResult || !insertResult.insertedId) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"inserted_id": "",
						"created_date": getUtcDate(),
						"result": [],
						"is_poll_generated": false,
						"user_conversation_failed": true,
						"message": res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
			const insertedId = insertResult.insertedId;

			// Prepare data for saving user details according to campaign
			const insertData = {
				'user_id': userId,
				'main_goal_of_your_email_campaign_name': mainGoalYourEmailCampaignName,
				'preferred_offering_or_discount': preferredOfferingOrDiscount,
				'tone_or_style_email_name': toneOrStyleEmailName,
				'specific_product_or_service': specificProductOrService,
				'benefits_product_or_service': benefitsProductOrService,
				'call_to_action': callToAction,
				'additional_information': additionalInformation,
				'information_get_from_pdf': informationGetFromPdf,
				'attach_reward_in_email': attachRewardInEmail,
				'get_poll_opinions': getPollOpinions,
				'pdf_file': (uploadedAiPdfDoc != "") ? uploadedAiPdfDoc.data : "",
				'ai_campaign_name': aiCampaignName,
				'campaign_name_id': newObjectIdDefault(insertedId),
				'type': INSIDER_POLL_CAMPAIGN,
			};

			// Save user details according to campaign
			const insiderUserDetailsSave = await saveUserDetailsAccordingCampaign(req, res, insertData);
			const finalDataInsiderUserText = insiderUserDetailsSave ? insiderUserDetailsSave.final_text : "";
			const insiderCampainAccUserDetailId = insiderUserDetailsSave ? newObjectIdDefault(insiderUserDetailsSave.inserted_id) : "";

			// Get information for poll and reward generate
			const getInsiderPdfInformation = (finalDataInsiderUserText && !finalDataInsiderUserText.includes("no-data-found"))
				? `Make sure to utilize the provided context information ${finalDataInsiderUserText} and use it the response at relevant places. Here is context : about ${informationGetFromPdf}.`
				: "";

			// Get information for email generate
			const getInsiderPdfInformationForEmail = (finalDataInsiderUserText && !finalDataInsiderUserText.includes("no-data-found"))
				? `Make sure to utilize the provided context information ${finalDataInsiderUserText} and use it in 6 to 8 bullet points to sell the purpose of the email body at relevant places. Here is context : about ${informationGetFromPdf}.`
				: "";

			// Prepare option condition for poll query
			let optionCondition = {};
			if (optionId) {
				optionCondition['$eq'] = ["$$option._id", newObjectIdDefault(optionId)];
			}

			// Query for getting poll details
			const pollAgg = [
				{
					$match: {
						"_id": newObjectIdDefault(pollId),
						"user_id": newObjectIdDefault(userId)
					}
				},
				{
					$project: {
						"_id": 1,
						"slug": 1,
						"question": 1,
						"options": {
							$filter: {
								input: "$options",
								as: "option",
								cond: optionCondition
							}
						}
					}
				}
			];
			const resultPolls = await polls.aggregate(pollAgg).toArray();

			if (!resultPolls || resultPolls.length === 0) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"inserted_id": "",
						"result": [],
						"is_poll_generated": false,
						"user_conversation_failed": true,
						"message": res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const pollQuestion = resultPolls[0].question || "";
			const pollOptions = resultPolls[0].options || [];
			let optionsArray = [];

			// Prepare poll and reward prompts
			const pollUserContent = CAMPAIGN_USER_POLL_PROMPT.replace(/{business_name}/g, businessName).replace(/{industry}/g, aiBusinessIndustry).replace(/{offer_discount}/g, preferredOfferingOrDiscount);
			const userRewardContentData = CAMPAIGN_USER_REWARD_PROMPT.replace(/{business_name}/g, businessName).replace(/{industry}/g, aiBusinessIndustry).replace(/{offer_discount}/g, preferredOfferingOrDiscount).replace(/{specific_service}/g, specificProductOrService);

			if (getPollOpinions == INSIDER_GENERATE_YES) {
				const systemPromptPoll = NEW_SYSTEM_PROMPT[AI_RESPONSE_TYPE_POLL].replace(/{campaign_title}/g, aiCampaignName).replace(/{pdf_information}/g, getInsiderPdfInformation);
				optionsArray.push({
					system_prompt: { role: "system", content: systemPromptPoll },
					user_prompt: { role: AI_ROLE_USER, content: pollUserContent + POLL_FORMAT },
					type: AI_RESPONSE_TYPE_POLL,
				});
			}

			if (attachRewardInEmail == INSIDER_GENERATE_YES) {
				const systemPromptReward = NEW_SYSTEM_PROMPT[AI_RESPONSE_TYPE_REWARD].replace(/{campaign_title}/g, aiCampaignName).replace(/{pdf_information}/g, getInsiderPdfInformation);
				optionsArray.push({
					system_prompt: { role: "system", content: systemPromptReward },
					user_prompt: { role: AI_ROLE_USER, content: userRewardContentData + REWARD_FORMAT },
					type: AI_RESPONSE_TYPE_REWARD,
				});
			}

			const optionsKeys = pollOptions.map(record => ({
				id: record._id,
				title: record.title
			}));

			// Generate email prompts for each poll option
			optionsKeys.forEach(({ id, title }) => {
				const systemContent = MARKETING_EMAIL_SYSTEM
					.replace(/{business_name}/g, businessName)
					.replace(/{industry_name}/g, aiBusinessIndustry)
					.replace(/{target_audiance}/g, targetAudience)
					.replace(/{unique_sale}/g, uniqueSaleProposition)
					.replace(/{specific_product}/g, specificProductOrService)
					.replace(/{key_features}/g, benefitsProductOrService)
					.replace(/{call_to_action}/g, callToAction)
					.replace(/{poll_question}/g, pollQuestion)
					.replace(/{option_name}/g, title)
					.replace(/{campaign_title}/g, aiCampaignName)
					.replace(/{pdf_information}/g, getInsiderPdfInformationForEmail);

				const systemPrompt = { role: "system", content: systemContent + " " + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, callToAction) };
				const userPrompt = { role: AI_ROLE_USER, content: aiCampaignName + "; " + NEW_DESIGN_EMAIL_FORMAT.replace(/{business_name}/g, businessName).replace(/{cta_text}/g, callToAction) };
				optionsArray.push({
					system_prompt: systemPrompt,
					user_prompt: userPrompt,
					type: AI_RESPONSE_TYPE_EMAIL,
					option_name: title,
					option_id: id,
				});
			});

			// Run all OpenAI requests in parallel
			const openAiResponseEmailData = await Promise.all(optionsArray.map(prompt => getOpenAiPollEmailResponse(req, res, prompt)));

			// Check for any error in OpenAI responses
			const hasError = openAiResponseEmailData.some(records => records.status === STATUS_ERROR);
			if (hasError) {
				const deleteOptions = {
					"inserted_id": insertedId,
					"user_id": userId,
				};
				const deleteResponse = await removeInsiderCampaign(req, res, deleteOptions);
				finalResponse = { 'data': deleteResponse };
				return returnApiResult(req, res, finalResponse);
			}

			// Save AI campaign logs in parallel
			await Promise.all(openAiResponseEmailData.map(async ({ response, option_name, option_id, type }) => {
				let systemPrompt = "";
				let userPrompt = "";
				let systemFinalPrompt = "";
				let userFinalPrompt = "";
				let secondPhase = "";
				let outputData = "";

				if (type == AI_RESPONSE_TYPE_POLL) {
					systemPrompt = NEW_SYSTEM_PROMPT[AI_RESPONSE_TYPE_POLL];
					userPrompt = CAMPAIGN_USER_POLL_PROMPT;
					systemFinalPrompt = NEW_SYSTEM_PROMPT[AI_RESPONSE_TYPE_POLL].replace(/{campaign_title}/g, aiCampaignName).replace(/{pdf_information}/g, getInsiderPdfInformation);
					userFinalPrompt = CAMPAIGN_USER_POLL_PROMPT.replace(/{business_name}/g, businessName).replace(/{industry}/g, aiBusinessIndustry).replace(/{offer_discount}/g, preferredOfferingOrDiscount);
					outputData = response[AI_RESPONSE_TYPE_POLL];
				} else if (type == AI_RESPONSE_TYPE_REWARD) {
					systemPrompt = NEW_SYSTEM_PROMPT[AI_RESPONSE_TYPE_REWARD];
					userPrompt = CAMPAIGN_USER_REWARD_PROMPT;
					systemFinalPrompt = NEW_SYSTEM_PROMPT[AI_RESPONSE_TYPE_REWARD].replace(/{campaign_title}/g, aiCampaignName).replace(/{pdf_information}/g, getInsiderPdfInformation);
					userFinalPrompt = CAMPAIGN_USER_REWARD_PROMPT.replace(/{business_name}/g, businessName).replace(/{industry}/g, aiBusinessIndustry).replace(/{offer_discount}/g, preferredOfferingOrDiscount).replace(/{specific_service}/g, specificProductOrService);
					outputData = response[AI_RESPONSE_TYPE_REWARD];
				} else if (type == AI_RESPONSE_TYPE_EMAIL) {
					systemPrompt = MARKETING_EMAIL_SYSTEM;
					userPrompt = "Create an email.";
					systemFinalPrompt = MARKETING_EMAIL_SYSTEM
						.replace(/{business_name}/g, businessName)
						.replace(/{industry_name}/g, aiBusinessIndustry)
						.replace(/{target_audiance}/g, targetAudience)
						.replace(/{unique_sale}/g, uniqueSaleProposition)
						.replace(/{specific_product}/g, specificProductOrService)
						.replace(/{key_features}/g, benefitsProductOrService)
						.replace(/{call_to_action}/g, callToAction)
						.replace(/{poll_question}/g, pollQuestion)
						.replace(/{option_name}/g, option_name)
						.replace(/{campaign_title}/g, aiCampaignName)
						.replace(/{pdf_information}/g, getInsiderPdfInformationForEmail);
					userFinalPrompt = "Create an email.";
					outputData = response[AI_RESPONSE_TYPE_EMAIL];
				}

				const optionsData = {
					'user_id': userId,
					'ai_campaign_parent_id': newObjectIdDefault(insertedId),
					'ai_campaign_name': aiCampaignName,
					'campaign_type': INSIDER_POLL_CAMPAIGN,
					'type': type,
					'user_prompt': userPrompt,
					'system_prompt': systemPrompt,
					'user_final_prompt': userFinalPrompt,
					'system_final_prompt': systemFinalPrompt,
					'final_output': outputData,
					'second_phase': secondPhase,
					'option_name': option_name,
					"option_id": (option_id != "") ? newObjectIdDefault(option_id) : "",
					'signup_flag': "",
				};
				await saveAllCampaignLogs(optionsData);
			}));

			// Prepare data for saving generated AI insider campaign chat
			const newEmailData = openAiResponseEmailData.map(({ response, option_name, option_id, type }) => {
				let finalContentData = (response[type]) ? response[type] : {};
				if (type == AI_RESPONSE_TYPE_REWARD) {
					finalContentData = {
						"heading": finalContentData['heading'] || "",
						"subheading": finalContentData['subheading'] || "",
						"description": finalContentData['description'] || ""
					};
				}
				const savedCampaignData = {
					"user_id": userId,
					"role": AI_ROLE_ASSISTANT,
					"content": finalContentData || [],
					"type": type || [],
					"poll_id": pollId ? newObjectIdDefault(pollId) : "",
					"poll_question": pollQuestion || "",
					"ai_campaign_parent_id": insertedId ? newObjectIdDefault(insertedId) : "",
					"campaign_according_user_detail_id": insiderCampainAccUserDetailId,
					"option_name": option_name || "",
					"option_id": (option_id != "") ? newObjectIdDefault(option_id) : "",
					"is_deleted": NOT_DELETED,
					"created": getUtcDate(),
				};
				if (type == AI_RESPONSE_TYPE_EMAIL) {
					savedCampaignData["add_poll_toggle"] = TOGGLE_POLL_ON;
				}
				return savedCampaignData;
			});

			// Save generated AI insider campaign chat
			const saveResult = await tableInsiderAiCampaignChat.insertMany(newEmailData, { forceServerObjectId: true });
			if (!saveResult) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"inserted_id": "",
						"created_date": getUtcDate(),
						"result": [],
						"is_poll_generated": false,
						"user_conversation_failed": true,
						"message": res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Get inserted insider campaign chat logs
			const getInsiderChatLogs = await tableInsiderAiCampaignChat.find(
				{ "user_id": newObjectIdDefault(userId), "ai_campaign_parent_id": newObjectIdDefault(insertedId) },
				{ projection: { "_id": 1, "type": 1, "option_id": 1, "option_name": 1, "content": 1 } }
			).toArray();

			if (getInsiderChatLogs && getInsiderChatLogs.length > 0) {
				const newArray = getInsiderChatLogs.map(obj => {
					const newObj = { ...obj };
					delete newObj.content;
					return newObj;
				});
				if (newArray.length > 0) {
					await tableAiCampaignName.updateOne(
						{ "_id": newObjectIdDefault(insertedId), "user_id": newObjectIdDefault(userId) },
						{ $set: { "option_datas": newArray } }
					);
				}
			}

			// Extract poll and reward data from chat logs
			let pollCampaignChatId = "";
			const pollCampaignParentId = insertedId;
			let pollString = "";
			let rewardStringFirst = {};
			let rewardCampaignChatId = "";
			const rewardCampaignParentId = insertedId;

			getInsiderChatLogs.forEach(chatData => {
				if (chatData.type == AI_RESPONSE_TYPE_POLL) {
					pollCampaignChatId = chatData._id || "";
					pollString = chatData.content || "";
				}
				if (chatData.type == AI_RESPONSE_TYPE_REWARD) {
					rewardCampaignChatId = chatData._id || "";
					const rewardString = chatData.content || {};
					rewardStringFirst['heading'] = rewardString['heading'] || "";
					rewardStringFirst['subheading'] = rewardString['subheading'] || "";
					rewardStringFirst['description'] = rewardString['description'] || "";
				}
			});

			// Prepare poll and reward options for saving
			const options = {
				"user_id": userId,
				"ai_data": pollString,
				"ai_campaign_chat_id": pollCampaignChatId,
				"ai_campaign_parent_id": pollCampaignParentId,
				"campaign_type": INSIDER_POLL_CAMPAIGN,
				"customer_id": customerId
			};
			const rewardOptions = {
				"user_id": userId,
				"ai_data": rewardStringFirst,
				"ai_campaign_chat_id": rewardCampaignChatId,
				"ai_campaign_parent_id": rewardCampaignParentId,
				"campaign_type": INSIDER_POLL_CAMPAIGN,
			};

			// Save poll and reward data if required
			if (getPollOpinions == INSIDER_GENERATE_YES) {
				await addAiPollData(req, res, options);
			}
			if (attachRewardInEmail == INSIDER_GENERATE_YES) {
				await addRewardAiData(req, res, rewardOptions);
			}

			// Run poll and reward fetch queries in parallel for faster response
			const [generatedPollData, generatedRewardData] = await Promise.all([
				polls.findOne(
					{ 'ai_campaign_parent_id': newObjectIdDefault(insertedId), 'user_id': newObjectIdDefault(userId), 'campaign_type': INSIDER_POLL_CAMPAIGN },
					{ projection: { "_id": 1, 'options': 1, 'custom_url': 1 } }
				),
				rewards.findOne(
					{ 'ai_campaign_parent_id': newObjectIdDefault(insertedId), 'user_id': newObjectIdDefault(userId), 'campaign_type': INSIDER_POLL_CAMPAIGN },
					{ projection: { "_id": 1 } }
				)
			]);

			// Update campaign and chat with poll/reward info if available
			if (generatedPollData) {
				const generatedInsiderPollId = generatedPollData._id ? newObjectIdDefault(generatedPollData._id) : "";
				const customUrl = generatedPollData.custom_url || "";

				await tableAiCampaignName.updateOne(
					{ "user_id": newObjectIdDefault(userId), "_id": newObjectIdDefault(insertedId), "type": INSIDER_POLL_CAMPAIGN },
					{ $set: { "generated_insider_poll_id": generatedInsiderPollId } }
				);

				await tableInsiderAiCampaignChat.updateMany(
					{ "user_id": newObjectIdDefault(userId), "ai_campaign_parent_id": newObjectIdDefault(insertedId), "type": AI_RESPONSE_TYPE_EMAIL },
					{ $set: { "content.custom_url": customUrl } }
				);

				if (generatedRewardData) {
					const rewardId = generatedRewardData._id ? newObjectIdDefault(generatedRewardData._id) : "";
					await polls.updateOne(
						{
							'ai_campaign_parent_id': newObjectIdDefault(insertedId),
							'user_id': newObjectIdDefault(userId),
							'campaign_type': INSIDER_POLL_CAMPAIGN
						},
						{
							$set: { 'options.$[].assign_reward': rewardId, 'options.$[].enticement_headline': POLL_ENTICEMENT_HEADLINE }
						}
					);

					await tableAiCampaignName.updateOne(
						{ "user_id": newObjectIdDefault(userId), "_id": newObjectIdDefault(insertedId), "type": INSIDER_POLL_CAMPAIGN },
						{ $set: { "generated_insider_reward_id": rewardId } }
					);

					await tableInsiderAiCampaignChat.updateMany(
						{ "user_id": newObjectIdDefault(userId), "ai_campaign_parent_id": newObjectIdDefault(insertedId), "type": AI_RESPONSE_TYPE_EMAIL },
						{ $set: { "content.reward_id": rewardId } }
					);
				}
			}

			// If only reward is generated
			if (!generatedPollData && generatedRewardData) {
				const insiderRewardId = generatedRewardData._id ? newObjectIdDefault(generatedRewardData._id) : "";
				await tableAiCampaignName.updateOne(
					{ "user_id": newObjectIdDefault(userId), "_id": newObjectIdDefault(insertedId), "type": INSIDER_POLL_CAMPAIGN },
					{ $set: { "generated_insider_reward_id": insiderRewardId } }
				);

				await tableInsiderAiCampaignChat.updateMany(
					{ "user_id": newObjectIdDefault(userId), "ai_campaign_parent_id": newObjectIdDefault(insertedId), "type": AI_RESPONSE_TYPE_EMAIL },
					{ $set: { "content.reward_id": insiderRewardId } }
				);
			}

			// Send success response
			finalResponse = {
				'data': {
					"status": STATUS_SUCCESS,
					"inserted_id": insertedId,
					"created_date": getUtcDate(),
					"result": [],
					"is_poll_generated": true,
					"user_conversation_failed": false,
					"message": res.__("front.ai_steps.chat_has_been_added_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			let finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"inserted_id": "",
					"created_date": getUtcDate(),
					"result": [],
					"is_poll_generated": false,
					"user_conversation_failed": true,
					"message": res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end saveCampaignAccordingDetails()

	/**
	 * Function is used to generate AI campaign chat according to type using async/await.
	 * Handles retries and ensures valid JSON response from OpenAI.
	 */
	getOpenAiPollEmailResponse = async (req, res, options, retryCount = 0, maxRetries = 3) => {
		let systemPrompt = options.system_prompt || {};
		let userPrompt = options.user_prompt || {};
		let optionName = options.option_name || "";
		let optionId = options.option_id || "";
		let type = options.type || "";
		let allChat = [systemPrompt, userPrompt];

		try {
			// Await OpenAI chat completion
			const result = await openai.createChatCompletion({
				model: "gpt-3.5-turbo",
				messages: allChat,
			});

			let response = result.data.choices[0].message.content;
			let AiArrayEmailResponse = response;

			try {
				// Try parsing the response as JSON
				let arrayResponseEmail = JSON.parse(AiArrayEmailResponse);
				return { status: STATUS_SUCCESS, type, option_name: optionName, option_id: optionId, response: arrayResponseEmail };
			} catch (e) {
				// If not valid JSON, try to fix it using validAiResponse
				let validData = await validAiResponse(AiArrayEmailResponse);
				let newResponseData = validData.response;

				try {
					let newResponse = JSON.parse(newResponseData);
					return { status: STATUS_SUCCESS, type, option_name: optionName, option_id: optionId, response: newResponse };
				} catch (err) {
					// Try one more time to fix the response
					let validDataAgain = await validAiResponse(AiArrayEmailResponse);
					let newResponseDataGenerate = validDataAgain.response;

					try {
						let finalResponse = JSON.parse(newResponseDataGenerate);
						return { status: STATUS_SUCCESS, type, option_name: optionName, option_id: optionId, response: finalResponse };
					} catch (error) {
						// If still not valid, retry with exponential backoff if retries remain
						if (retryCount < maxRetries) {
							await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
							return await getOpenAiPollEmailResponse(req, res, options, retryCount + 1, maxRetries);
						} else {
							// Return error after max retries
							return { status: STATUS_ERROR, type, option_name: optionName, option_id: optionId, response: error };
						}
					}
				}
			}
		} catch (error) {
			// Handle OpenAI API errors
			if (retryCount < maxRetries) {
				await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount))); // Exponential backoff
				return await getOpenAiPollEmailResponse(req, res, options, retryCount + 1, maxRetries);
			} else {
				return { status: STATUS_ERROR, type, option_name: optionName, option_id: optionId, response: error };
			}
		}
	};

	/**
	 * Function is used to remove campaign name and related data using async/await.
	 * All DB operations are performed in parallel for faster response.
	 */
	removeInsiderCampaign = async (req, res, options) => {
		let insertedId = options.inserted_id ? options.inserted_id : "";
		let userId = options.user_id ? options.user_id : "";

		try {
			// Prepare all delete operations
			const deleteCampaignNamePromise = tableAiCampaignName.deleteOne({
				"_id": newObjectIdDefault(insertedId),
				"type": INSIDER_POLL_CAMPAIGN
			});

			const deleteCampaignDetailsPromise = campaignAccordingUserDetails.deleteOne({
				"campaign_name_id": newObjectIdDefault(insertedId),
				"type": INSIDER_POLL_CAMPAIGN
			});

			const deleteInvalidChatsPromise = tableInsiderAiCampaignChat.deleteMany({
				"user_id": newObjectIdDefault(userId),
				"ai_campaign_parent_id": newObjectIdDefault(insertedId)
			});

			// Run all delete operations in parallel
			const [deleteCampaignNameResult] = await Promise.all([
				deleteCampaignNamePromise,
				deleteCampaignDetailsPromise,
				deleteInvalidChatsPromise
			]);

			// Check if campaign name was deleted successfully
			if (deleteCampaignNameResult && deleteCampaignNameResult.deletedCount > 0) {
				// Send error response as per original logic
				return {
					"status": STATUS_ERROR,
					"inserted_id": insertedId,
					"result": [],
					"is_poll_generated": false,
					"user_conversation_failed": true,
					"message": res.__("front.pocial_ai.unusual_title"),
				};
			} else {
				// Send error response if campaign name was not deleted
				return {
					"status": STATUS_ERROR,
					"inserted_id": insertedId,
					"result": [],
					"is_poll_generated": false,
					"user_conversation_failed": true,
					"message": res.__("front.system.something_going_wrong_please_try_again")
				};
			}
		} catch (error) {
			// Handle unexpected errors
			return {
				"status": STATUS_ERROR,
				"inserted_id": insertedId,
				"result": [],
				"is_poll_generated": false,
				"user_conversation_failed": true,
				"message": res.__("front.system.something_going_wrong_please_try_again")
			};
		}
	}; // end removeInsiderCampaign()

	/**
	 * Function is used to get insider campaign details
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getInsiderCampaignDetails = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and campaign info
			const loginUserData = req.user_data || "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const aiCampaignNameId = req.body.ai_campaign_parent_id ? req.body.ai_campaign_parent_id : "";
			const serviceType = req.body.type ? req.body.type : "";
			const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : "";

			// Extract business information
			const businessInformation = loginUserData.public_business_informaton || "";
			const businessIndustryName = businessInformation.business_industry_name || "";
			const BusinessUserName = loginUserData.full_name || "";
			const userProfileImage = loginUserData.profile_image || "";
			const userSlug = loginUserData.slug || "";

			const profileImage = userProfileImage;
			const publicBusinessInformaton = businessInformation;
			const businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
			const rewardImage = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";

			// Validate required fields
			if (!userId || !serviceType || !aiCampaignNameId) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"result": {},
						"business_information": {},
						"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query condition
			let condition = {
				"user_id": newObjectIdDefault(userId),
				"ai_campaign_parent_id": newObjectIdDefault(aiCampaignNameId),
				"type": serviceType
			};
			if (optionId) {
				condition["option_id"] = optionId;
			}

			// Handle reward type: fetch all reward chats for this campaign
			if (serviceType == AI_RESPONSE_TYPE_REWARD) {
				const rewardQuery = {
					"user_id": newObjectIdDefault(userId),
					"ai_campaign_parent_id": newObjectIdDefault(aiCampaignNameId),
					"type": AI_RESPONSE_TYPE_REWARD,
					"is_deleted": NOT_DELETED
				};
				const rewardProjection = {
					projection: {
						"_id": 1,
						"ai_campaign_parent_id": 1,
						"user_id": 1,
						"content": 1,
						"type": 1,
						"reward_slug": 1,
						"add_poll_toggle": 1,
						"ai_reward_draft_flag": 1,
						"created": 1,
					}
				};

				// Query reward chats
				const result = await tableInsiderAiCampaignChat.find(rewardQuery, rewardProjection).toArray();

				if (result && result.length > 0) {
					finalResponse = {
						'data': {
							"status": STATUS_SUCCESS,
							"result": result,
							'reward_user_image': businessLogo ? businessLogo : profileImage,
							'email_template_image_url': AI_EMAIL_IMAGES_URL,
							'reward_image': rewardImage,
							"business_information": {
								'users_url': USERS_URL,
								'polls_url': POLLS_URL,
								'user_name': BusinessUserName,
								'user_profile_image': userProfileImage,
								'user_slug': userSlug,
								'business_industry_name': businessIndustryName
							},
							"message": "",
						}
					};
				} else {
					finalResponse = {
						'data': {
							'status': STATUS_ERROR,
							'email_template_image_url': AI_EMAIL_IMAGES_URL,
							'reward_user_image': businessLogo ? businessLogo : profileImage,
							'reward_image': rewardImage,
							'result': [],
							"business_information": {},
							'message': res.__("front.global.no_record_found"),
						}
					};
				}
				return returnApiResult(req, res, finalResponse);
			}

			// Handle poll/email type: fetch single chat detail
			const chatProjection = {
				projection: {
					"_id": 1,
					"ai_campaign_parent_id": 1,
					"user_id": 1,
					"content": 1,
					"type": 1,
					"reward_slug": 1,
					"add_poll_toggle": 1,
					"ai_reward_draft_flag": 1,
					"created": 1,
				}
			};
			const result = await tableInsiderAiCampaignChat.findOne(condition, chatProjection);

			if (!result) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'email_template_image_url': AI_EMAIL_IMAGES_URL,
						'reward_user_image': businessLogo ? businessLogo : profileImage,
						'reward_image': rewardImage,
						'result': {},
						"business_information": {},
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let aiInsiderCampaignChatId = result._id ? result._id : "";

			// If serviceType is poll, fetch poll details in parallel with category lookup
			if (serviceType == AI_RESPONSE_TYPE_POLL) {
				const pollPipeline = [
					{
						$match: {
							"user_id": newObjectIdDefault(userId),
							"ai_campaign_chat_id": newObjectIdDefault(aiInsiderCampaignChatId),
							"ai_campaign_parent_id": newObjectIdDefault(aiCampaignNameId),
							"campaign_type": INSIDER_POLL_CAMPAIGN,
							"type": POLL_AI_TYPE
						}
					},
					{
						$lookup: {
							from: TABLE_CATEGORIES,
							let: { categoryId: "$category_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$_id", "$$categoryId"] },
											]
										},
									}
								},
								{ "$project": { name: 1 } }
							],
							as: "catDetails"
						}
					},
					{
						$project: {
							"slug": 1,
							"is_published": 1,
							"question_media": 1,
							"question_video_name": 1,
							"options": 1,
							"question": 1,
							"custom_url": 1,
							"total_count": { $cond: ["$total_count", "$total_count", 0] },
							"question_extension": 1,
							"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
						}
					},
				];

				const pollResultArr = await polls.aggregate(pollPipeline).toArray();

				if (pollResultArr && pollResultArr.length > 0) {
					const pollAiResult = pollResultArr[0] || {};
					result["poll_slug"] = pollAiResult.slug || "";
					result["custom_url"] = pollAiResult.custom_url || "";
					result["options"] = pollAiResult.options || [];
					result["question"] = pollAiResult.question || "";
					result["is_published"] = pollAiResult.is_published || "";
					result["category_name"] = pollAiResult.category_name || "";
					result["question_media"] = pollAiResult.question_media || "";
					result["question_video_name"] = pollAiResult.question_video_name || "";
					result["question_extension"] = pollAiResult.question_extension || "";
					result["total_count"] = pollAiResult.total_count || 0;

					finalResponse = {
						'data': {
							"status": STATUS_SUCCESS,
							"result": result,
							'email_template_image_url': AI_EMAIL_IMAGES_URL,
							'reward_user_image': businessLogo ? businessLogo : profileImage,
							'reward_image': rewardImage,
							"business_information": {
								'users_url': USERS_URL,
								'polls_url': POLLS_URL,
								'user_name': BusinessUserName,
								'user_profile_image': userProfileImage,
								'user_slug': userSlug,
								'business_industry_name': businessIndustryName
							},
							"message": "",
						}
					};
				} else {
					finalResponse = {
						'data': {
							'status': STATUS_ERROR,
							'email_template_image_url': AI_EMAIL_IMAGES_URL,
							'reward_user_image': businessLogo ? businessLogo : profileImage,
							'reward_image': rewardImage,
							'result': {},
							"business_information": {},
							'message': res.__("front.system.something_going_wrong_please_try_again"),
						}
					};
				}
				return returnApiResult(req, res, finalResponse);
			}

			// If serviceType is email, fetch poll custom_url in parallel
			if (serviceType == AI_RESPONSE_TYPE_EMAIL) {
				const pollQuery = {
					"user_id": newObjectIdDefault(userId),
					"ai_campaign_parent_id": newObjectIdDefault(aiCampaignNameId),
					"type": POLL_AI_TYPE,
				};
				const pollProjection = { projection: { 'custom_url': 1 } };

				const pollData = await polls.findOne(pollQuery, pollProjection);

				const customUrl = pollData && pollData.custom_url ? pollData.custom_url : "";
				if (result.content && typeof result.content === "object") {
					result.content.custom_url = customUrl ? POLL_VIEW_PAGE_URL + customUrl : "";
				}

				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						"result": result,
						'email_template_image_url': AI_EMAIL_IMAGES_URL,
						'reward_user_image': businessLogo ? businessLogo : profileImage,
						'reward_image': rewardImage,
						"business_information": {
							'users_url': USERS_URL,
							'polls_url': POLLS_URL,
							'user_name': BusinessUserName,
							'user_profile_image': userProfileImage,
							'user_slug': userSlug,
							'business_industry_name': businessIndustryName
						},
						"message": "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// If not handled above, return generic error
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'email_template_image_url': AI_EMAIL_IMAGES_URL,
					'reward_user_image': businessLogo ? businessLogo : profileImage,
					'reward_image': rewardImage,
					'result': {},
					"business_information": {},
					'message': res.__("front.global.no_record_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'email_template_image_url': AI_EMAIL_IMAGES_URL,
					'reward_user_image': "",
					'reward_image': "",
					'result': {},
					"business_information": {},
					'message': res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getInsiderCampaignDetails()

}
module.exports = new insiderPollEmailGenerate();