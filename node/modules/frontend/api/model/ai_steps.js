const tableAiSteps = db.collection(TABLE_AI_STEPS);
const polls = db.collection(TABLE_POLLS);
const rewards = db.collection(TABLE_REWARDS);
const OpenAI = require("openai");
const openai = new OpenAI({
	apiKey: process.env.OPEN_AI // apna key yaha rakho
});

function AiSteps() {

	/**
	 * Function to get AI steps list using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAiStepList = async (req, res) => {
		let finalResponse = {};
		// Get user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					welcome_message: {},
					general_question: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Fetch the first two poll steps, sorted by step, using async/await
			const steps = await tableAiSteps.find(
				{ type: "poll" },
				{
					projection: {
						_id: 1,
						question: 1,
						step: 1
					}
				}
			).sort({ step: 1 }).limit(2).toArray();

			if (steps && steps.length >= 2) {
				const firstStepQuestions = steps[0].question;
				const secondStepQuestions = steps[1].question;

				// Get random question for each step
				let randomMessageFirstStep = getRandomItem(firstStepQuestions);
				randomMessageFirstStep["step"] = steps[0].step;

				let randomMessageSecondStep = getRandomItem(secondStepQuestions);
				randomMessageSecondStep["step"] = steps[1].step;

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: randomMessageSecondStep,
						welcome_message: randomMessageFirstStep,
						combine_result: [randomMessageFirstStep],
						message: "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error response if no records found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						welcome_message: {},
						combine_result: [],
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					welcome_message: {},
					combine_result: [],
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAiStepList();

	/**
	 * function to get a random item from an array
	 */
	getRandomItem = (arr) => {
		/** get random index value*/
		const randomIndex = Math.floor(Math.random() * arr.length);
		/** get random item */
		const item = arr[randomIndex];
		return item;
	}//end getRandomItem();

	/**
	 * Function is used to get AI reward detail using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAiRewardDetails = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let aiCampaignChatId = req.body.ai_campaign_chat_id ? req.body.ai_campaign_chat_id : "";
			let rewardName = req.body.reward_name ? req.body.reward_name : "";

			// Get business details for logged-in user
			let profileImage = loginUserData.profile_image ? loginUserData.profile_image : "";
			let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
			let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
			let rewardImage = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";

			// Validate required fields
			if (!userId || !aiCampaignChatId || !rewardName) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build query for reward details
			let rewardData = {
				"reward_text": { $regex: new RegExp(rewardName, "i") },
				"ai_campaign_chat_id": ObjectId(aiCampaignChatId),
				"user_id": ObjectId(userId),
				"type": REWARDS_AI_USER_ADD,
			};

			// Fetch reward details using async/await
			const result = await rewards.findOne(rewardData);

			if (result) {
				// Convert Mongo date to simple dd-mm-yy format if expiry date is toggled
				if (result.toogle_expiry_date === true && result.expiry_date != '') {
					let expiryDateConvert = mongoDatetoSimpleDateConvert(result.expiry_date);
					result['dd'] = expiryDateConvert.dd;
					result['mm'] = expiryDateConvert.mm;
					result['yy'] = expiryDateConvert.yy;
				}

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						reward_user_image: businessLogo ? businessLogo : profileImage,
						reward_image: rewardImage,
						result: result,
						message: "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error response if no reward found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						reward_user_image: businessLogo ? businessLogo : profileImage,
						reward_image: rewardImage,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					reward_user_image: "",
					reward_image: "",
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAiRewardDetails();

	/**
	 * Function to edit reward using async/await for faster and cleaner response.
	 * Handles file upload and reward update in sequence.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.editReward = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const aiCampaignChatId = req.body.ai_campaign_chat_id ? req.body.ai_campaign_chat_id : "";
			const rewardsSlug = req.body.reward_slug ? req.body.reward_slug : "";
			const heading = req.body.heading ? req.body.heading : "";
			const subHeading = req.body.sub_heading ? req.body.sub_heading : "";
			const description = req.body.description ? req.body.description : "";
			const expiryDate = req.body.expiry_date ? req.body.expiry_date : "";
			const storeTypeIds = req.body.store_type_id ? req.body.store_type_id : [];
			const image = (req.files && req.files.image) ? req.files.image : "";
			const statusType = req.body.status ? ACTIVE : DEACTIVE;

			let toogleExpiryDate = req.body.toogle_expiry_date ? Number(req.body.toogle_expiry_date) : 0;
			toogleExpiryDate = (toogleExpiryDate === 0) ? false : true;

			// Validate required fields
			if (!userId || !aiCampaignChatId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Convert store type IDs to ObjectId array
			let storeTypeIdsArray = [];
			if (Array.isArray(storeTypeIds) && storeTypeIds.length > 0) {
				storeTypeIdsArray = storeTypeIds.map(recordsIds => ObjectId(recordsIds));
			}

			// Upload image using async/await
			const options = {
				image: image,
				filePath: LEADS_FORM_FILE_PATH,
			};
			const response = await moveUploadedFile(req, res, options);

			// Handle file upload error
			if (response.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						message: response.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const imageName = response.fileName ? response.fileName : "";

			// Prepare reward data for update
			const packageRewardData = {
				ai_campaign_chat_id: aiCampaignChatId,
				user_id: userId,
				slug: rewardsSlug,
				reward_text: heading,
				reward_sub_heading: subHeading,
				status: statusType,
				graphic_image: imageName,
				graphic_type: UPLOAD_IMAGE,
				url_desc: description,
				store_type_id: storeTypeIdsArray,
				expiry_date: toogleExpiryDate ? ageUtcDate(expiryDate) : "",
				toogle_expiry_date: toogleExpiryDate,
			};

			// Edit AI generated reward using async/await
			const rewardResponse = await editReward(req, res, packageRewardData);

			// Send success response
			finalResponse = {
				data: {
					status: rewardResponse.status,
					message: rewardResponse.message,
				}
			};
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
	}; // end editReward();

	/**
	 * Function to get AI poll detail using async/await for faster and cleaner response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getAiPollDetail = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const aiCampaignChatId = req.body.ai_campaign_chat_id ? req.body.ai_campaign_chat_id : "";

		let finalResponse = {};

		// Validate required fields
		if (userId === '' || aiCampaignChatId === "") {
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
			// Fetch poll draft details using async/await for faster response
			const pollDraft = await polls.findOne(
				{
					user_id: ObjectId(userId),
					ai_campaign_chat_id: ObjectId(aiCampaignChatId),
					type: POLL_AI_TYPE,
					is_deleted: NOT_DELETED
				},
				{
					projection: {
						_id: 1,
						slug: 1,
						question: 1,
						options: 1,
						category_id: 1
					}
				}
			);

			if (pollDraft) {
				// Add user details to poll draft result
				pollDraft.user_name = loginUserData.full_name ? loginUserData.full_name : "";
				pollDraft.user_profile_image = loginUserData.profile_image ? loginUserData.profile_image : "";
				pollDraft.user_slug = loginUserData.slug ? loginUserData.slug : "";

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						user_url: USERS_URL,
						poll_url: POLLS_URL,
						result: pollDraft,
						message: ""
					}
				};
			} else {
				// Send error response if no record found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						user_url: USERS_URL,
						poll_url: POLLS_URL,
						result: {},
						message: res.__("front.global.no_record_found"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					user_url: USERS_URL,
					poll_url: POLLS_URL,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAiPollDetail();


	/**
	 * Function to generate display ads using poll.
	 * Uses async/await for all DB/API calls and runs queries in parallel where possible for faster response.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.generateDisplayAdsUsingPoll = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Get user and poll IDs
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const pollId = req.body.poll_id ? req.body.poll_id : "";

			// Validate required fields
			if (!userId || !pollId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch poll details using async/await
			const pollDetails = await polls.findOne(
				{ user_id: ObjectId(userId), _id: ObjectId(pollId) },
				{ projection: { _id: 0, question: 1, "options.title": 1, hashtag: 1 } }
			);

			const pollQuestion = pollDetails?.question || "";
			const hashtag = pollDetails?.hashtag || "";
			const options = pollDetails?.options || [];
			const option1 = options[0]?.title || "";
			const option2 = options[1]?.title || "";
			const option3 = options[2]?.title || "";
			const option4 = options[3]?.title || "";

			// Prepare prompts for OpenAI
			const systemPrompt = `You are an expert digital advertiser helping businesses convert simple polls into catchy, scroll-stopping ad creatives.`;
			const userPrompt = `Use the following poll data to generate a display ad-style poll with exactly 2 options. The final ad must look engaging and suitable for ad platforms like Instagram, Facebook, and web banners.
				---  
				**Poll Title:** ${pollQuestion}  
				**Poll Options:**  
				1. ${option1}  
				2. ${option2} 
				3. ${option3} 
				4. ${option4}
				---

				### Your task:  
				- Reimagine the poll title into an engaging, ad-style question (max 15 words).  
				- No need for a separate description — infer tone and context from title and options.  
				- Use informal, relatable tone.  
				- Keep both options short, fun, and ad-friendly.  
				- Add emojis if suitable for the context.  

				### Output Format:
				{
				"ad_poll_title": "<rephrased poll question for ad>",
				"ad_option_1": "<short option 1>",
				"ad_option_2": "<short option 2>"
				}`;

			// Prepare messages for OpenAI API
			const messages = [
				{ role: "system", content: systemPrompt },
				{
					role: "user",
					content: [
						{
							type: "text",
							text: userPrompt
						}
					]
				}
			];

			// Call OpenAI API for ad creative generation
			const aiResult = await openai.createChatCompletion({
				model: "gpt-4o",
				messages: messages
			});
			const aiResponse = aiResult.data.choices[0].message.content;

			// Try to extract JSON from AI response
			const match = aiResponse.match(/```json\n([\s\S]*?)\n```/);
			if (match && match[1]) {
				try {
					const parsedJSON = JSON.parse(match[1]);
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							result: parsedJSON,
							message: "",
						}
					};
					return returnApiResult(req, res, finalResponse);
				} catch (e) {
					console.log(e);
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							message: res.__("front.system.something_going_wrong_please_try_again"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
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
	};


}
module.exports = new AiSteps();