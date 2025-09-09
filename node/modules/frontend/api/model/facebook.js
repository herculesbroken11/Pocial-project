const async = require('async');
const axios = require('axios');

function FacebookData() {

	/** Facebook app id, Client Secret */
	let facebookAppID = FACEBOOK_APP_ID;
	let facebookClientSecretId = FACEBOOK_CLIENT_SECRET_ID;
	let redirectUrlAfterLoginFacebook = REDIRECT_URL_AFTER_LOGIN_FACEBOOK;
	let directFbPublishedOptions = { "direct_facebook_published": true, 'is_draft': CAMPAIGN_NOT_DRAFT, "sent_fb": true, "sent_created": getUtcDate(), "sent_fb_created": getUtcDate() };

	/**
	 * Function to facebook short access token
	 * @param {*} code 
	 * @returns 
	 */
	async function getFacebookShortLivedToken(authCode) {
		const appId = facebookAppID;
		const appSecret = facebookClientSecretId;
		const redirectUri = redirectUrlAfterLoginFacebook;
		const url = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${redirectUri}&client_secret=${appSecret}&code=${authCode}`;
		try {
			const response = await axios.get(url);
			return response.data.access_token; // Short-lived token
		} catch (error) {
			console.error("Error getting short-lived token:", error.response.data);
			return null;
		}
	}// end getFacebookShortLivedToken();

	/**
	 * Function to facebook long lived access token
	 * @param {*} code 
	 * @returns 
	 */
	async function getFacebookLongLivedToken(shortLivedToken) {
		const appId = facebookAppID;
		const appSecret = facebookClientSecretId;

		const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

		try {
			const response = await axios.get(url);
			return response.data.access_token; // Long-lived token (valid for 60 days)
		} catch (error) {
			console.error("Error getting long-lived token:", error.response.data);
			return null;
		}
	}// end getFacebookLongLivedToken();

	/**
	 * Function to generate Facebook long-lived token using async/await for faster response.
	 */
	this.generateFacebookLongLivedToken = async (req, res) => {
		let finalResponse = {};

		// Sanitize request body to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and code from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let code = req.body.code ? req.body.code : "";

		// If ai_campaign_chat_user_id is provided, override userId
		let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
		if (aiCampaignChatUserId != '') {
			userId = aiCampaignChatUserId;
		}

		// Validate required fields
		if (userId == '' || code == '') {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Step 1: Get the short-lived access token using the code
			const facebookShortLivedToken = await getFacebookShortLivedToken(code);

			// Step 2: Convert to long-lived access token
			const facebookLongLivedToken = await getFacebookLongLivedToken(facebookShortLivedToken);

			// Step 3: Get User Info (id, name, email) in parallel with DB update for better performance if needed in future
			const userInfoResponse = await axios.get("https://graph.facebook.com/v18.0/me", {
				params: {
					fields: "id, name, email",
					access_token: facebookLongLivedToken,
				},
			});

			// Step 4: Update user document with new Facebook token and user info
			const users = db.collection(TABLE_USERS);
			await users.updateOne(
				{ '_id': userId },
				{
					$set: {
						'facebook_long_lived_access_token': facebookLongLivedToken,
						'facebook_modified': getUtcDate(),
						'facebook_created': getUtcDate(),
						'facebook_user_details': userInfoResponse && userInfoResponse.data ? userInfoResponse.data : ""
					}
				}
			);

			// Send success response
			finalResponse = {
				'data': {
					"status": STATUS_SUCCESS,
					"message": res.__("front.facebook.token_has_been_generate_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			console.error(error);

			// Send error response with details
			let errorMessage = error.response ? error.response.data : error.message;
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": (errorMessage && errorMessage.error_message) ? errorMessage.error_message : "",
					"error": error.response ? error.response.data : error.message
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end generateFacebookLongLivedToken();

	/**
	 * Function to get Facebook page list using async/await for faster and cleaner response.
	 */
	this.facebookPageList = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user data and Facebook long-lived access token
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const longLivedAccessToken = loginUserData.facebook_long_lived_access_token ? loginUserData.facebook_long_lived_access_token : "";

			// Validate required fields
			if (!userId || !longLivedAccessToken) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Build Facebook Graph API URL for page listing
			const url = `https://graph.facebook.com/v18.0/me/accounts?access_token=${longLivedAccessToken}`;

			// Fetch Facebook pages using async/await
			const response = await axios.get(url);

			// Send success response with page list
			finalResponse = {
				'data': {
					"status": STATUS_SUCCESS,
					"result": response.data.data,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Log error for debugging
			console.error("Error fetching Facebook pages:", error && error.response && error.response.data ? error.response.data : error);

			// Send error response with details
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"error": (error && error.response) ? error.response.data : error.message,
					"message": (error && error.response && error.response.data && error.response.data.error && error.response.data.error.message) ? error.response.data.error.message : res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end facebookPageList();

	/**
	 * Function for used to direct publish to Facebook
	 */
	this.directPublishedFacebook = async (req, res) => {
		let finalResponse = {};

		// Sanitize request body
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and post details
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let currentTimezone = loginUserData.current_timezone ? loginUserData.current_timezone : "";
		let facebookPageId = req.body.facebook_page_id ? req.body.facebook_page_id : "";
		let aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";
		let facebookPageAccessToken = req.body.facebook_page_access_token ? req.body.facebook_page_access_token : "";

		// If ai_campaign_chat_user_id is provided, override userId
		let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
		if (aiCampaignChatUserId != '') {
			userId = aiCampaignChatUserId;
		}

		// Validate required fields
		if (userId == '' || aiCampaignChatId == '') {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		if (facebookPageId == '' || facebookPageAccessToken == '') {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.facebook.facebook_not_connected"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Get campaign chat details using async/await
			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

			/** 
			 * Find campaign chat details for the given aiCampaignChatId and userId
			 */
			const campaignChatDetails = await tableAiCampaignChat.findOne({
				'_id': aiCampaignChatId,
				'user_id': newObjectIdDefault(userId)
			});

			if (!campaignChatDetails) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract content and metadata
			let contentData = campaignChatDetails.content ? campaignChatDetails.content : {};
			let uniqueKey = campaignChatDetails.unique_key ? campaignChatDetails.unique_key : "";
			let aiCampaignParentId = campaignChatDetails.ai_campaign_parent_id ? campaignChatDetails.ai_campaign_parent_id : "";
			let allImagesVideoArray = contentData.facebook_image ? contentData.facebook_image : [];
			let title = contentData.title ? contentData.title : "";
			let caption = contentData.captions ? contentData.captions : "";

			// Prepare facebook logs options
			let facebookLogsOptions = {
				'user_id': userId,
				'ai_campaign_parent_id': aiCampaignParentId,
				'image_url': allImagesVideoArray,
				'title': title,
				'caption': caption,
				'facebook_page_id': facebookPageId,
				'facebook_page_access_token': facebookPageAccessToken,
				'unique_key': uniqueKey,
				'ai_campaign_chat_id': aiCampaignChatId,
				'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
				'direct_published': true,
				'current_timezone': currentTimezone,
			};

			if (allImagesVideoArray.length > 0) {
				try {
					/**
					 * Publish media to Facebook using async/await
					 */
					let postFacebookResponse = await postMediaToFacebook(facebookPageId, facebookPageAccessToken, allImagesVideoArray, caption);

					if (postFacebookResponse.success) {
						/**
						 * Update direct published flag in campaign chat
						 */
						await tableAiCampaignChat.updateOne(
							{ '_id': aiCampaignChatId },
							{ $set: directFbPublishedOptions }
						);

						/**
						 * Log successful Facebook post
						 */
						facebookLogsOptions['status'] = STATUS_SUCCESS;
						facebookLogsOptions['post_facebook_response'] = postFacebookResponse;
						facebookLogsOptions['facebook_published_id'] = postFacebookResponse.data.id;

						await saveFacebookLogs(req, res, facebookLogsOptions);

						finalResponse = {
							'data': {
								"status": STATUS_SUCCESS,
								"message": res.__("front.facebook.post_has_been_published_successfully"),
							}
						};
						return returnApiResult(req, res, finalResponse);
					} else {
						/**
						 * Log failed Facebook post
						 */
						facebookLogsOptions['status'] = STATUS_ERROR;
						facebookLogsOptions['post_facebook_response'] = postFacebookResponse;
						facebookLogsOptions['facebook_published_id'] = "";
						facebookLogsOptions['error'] = postFacebookResponse;

						await saveFacebookLogs(req, res, facebookLogsOptions);

						finalResponse = {
							'data': {
								"status": STATUS_ERROR,
								"message": res.__("front.facebook.post_has_been_not_published_successfully") + ((postFacebookResponse && postFacebookResponse.error && postFacebookResponse.error.error && postFacebookResponse.error.error.message) ? " (" + postFacebookResponse.error.error.message + ")" : (postFacebookResponse && postFacebookResponse.error && postFacebookResponse.error.message ? " (" + postFacebookResponse.error.message + ")" : "")),
								"error_details": postFacebookResponse.error,
							}
						};
						return returnApiResult(req, res, finalResponse);
					}
				} catch (error) {
					// Log error and save to Facebook logs
					console.error(error);

					facebookLogsOptions['status'] = STATUS_ERROR;
					facebookLogsOptions['post_facebook_response'] = {};
					facebookLogsOptions['facebook_published_id'] = "";
					facebookLogsOptions['error'] = error;

					await saveFacebookLogs(req, res, facebookLogsOptions);

					finalResponse = {
						'data': {
							"status": STATUS_ERROR,
							"message": res.__("front.facebook.post_has_been_not_published_successfully") + (error && error.error && error.error.message ? " (" + error.error.message + ")" : ""),
							"error_details": error.message,
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// No images/videos to post
				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						"result": {},
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			console.error("Error in directPublishedFacebook:", error);
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"error": error,
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end directPublishedFacebook();

	/**
	 * Function to select and save Facebook page for the user.
	 * Uses async/await for faster and cleaner response.
	 */
	this.selectFacebookPage = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and Facebook page details from request
			const loginUserData = req.user_data ? req.user_data : "";
			const userId = loginUserData._id ? loginUserData._id : "";
			const facebookPageId = req.body.facebook_page_id ? req.body.facebook_page_id : "";
			const facebookPageAccessToken = req.body.facebook_page_access_token ? req.body.facebook_page_access_token : "";
			const facebookPageName = req.body.facebook_page_name ? req.body.facebook_page_name : "";

			// Validate required fields
			if (!userId || !facebookPageId || !facebookPageName || !facebookPageAccessToken) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update Facebook Page Id, Name, and Access Token for the user using async/await
			const users = db.collection(TABLE_USERS);
			await users.updateOne(
				{ '_id': userId },
				{
					$set: {
						'facebook_page_id': facebookPageId,
						'facebook_page_name': facebookPageName,
						'facebook_page_access_token': facebookPageAccessToken
					}
				}
			);

			// Send success message
			finalResponse = {
				'data': {
					"status": STATUS_SUCCESS,
					"message": res.__("front.facebook.page_has_been_saved_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			console.error("Error in selectFacebookPage:", error);
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.something_going_wrong_please_try_again"),
					"error": error.message || error
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end selectFacebookPage();


	/**
	 * Function to directly publish a story for Facebook.
	 * Uses async/await for all DB and network operations for faster and cleaner response.
	 */
	this.directPublishedStoryForFacebook = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and post details from request
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let facebookPageId = loginUserData.facebook_page_id ? loginUserData.facebook_page_id : "";
			let facebookPageAccessToken = loginUserData.facebook_page_access_token ? loginUserData.facebook_page_access_token : "";
			let currentTimezone = loginUserData.current_timezone ? loginUserData.current_timezone : "";
			let aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";

			// If ai_campaign_chat_user_id is provided, override userId and fetch user data
			let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
			if (aiCampaignChatUserId != '') {
				const users = db.collection(TABLE_USERS);
				userId = aiCampaignChatUserId;
				loginUserData = await users.findOne({ _id: newObjectIdDefault(userId) });
				facebookPageId = loginUserData.facebook_page_id ? loginUserData.facebook_page_id : "";
				facebookPageAccessToken = loginUserData.facebook_page_access_token ? loginUserData.facebook_page_access_token : "";
			}

			// Validate required fields
			if (!userId || !facebookPageId || !facebookPageAccessToken || !aiCampaignChatId) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fetch campaign chat details using async/await
			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
			const campaignChatDetails = await tableAiCampaignChat.findOne({
				'_id': aiCampaignChatId,
				'user_id': newObjectIdDefault(userId)
			});

			if (!campaignChatDetails) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract content and post details
			let contentData = campaignChatDetails.content ? campaignChatDetails.content : {};
			let uniqueKey = campaignChatDetails.unique_key ? campaignChatDetails.unique_key : "";
			let aiCampaignParentId = campaignChatDetails.ai_campaign_parent_id ? campaignChatDetails.ai_campaign_parent_id : "";
			let allImagesVideoArray = contentData.image ? contentData.image : [];
			let caption = contentData.title ? contentData.title : "";

			if (allImagesVideoArray.length > 0) {
				try {
					// Prepare options for posting to Facebook Story
					let facebookStoryOptions = {
						'user_id': userId,
						'unique_key': uniqueKey,
						'facebook_page_id': facebookPageId,
						'facebook_page_access_token': facebookPageAccessToken,
						'media_files': allImagesVideoArray,
						'caption': caption,
						'ai_campaign_parent_id': aiCampaignParentId,
						'ai_campaign_chat_id': aiCampaignChatId,
						'current_timezone': currentTimezone,
					};

					// Publish story to Facebook using async/await
					let postFacebookResponse = await postMediaToFacebookStory(req, res, facebookStoryOptions);

					if (postFacebookResponse) {
						// Update campaign chat to flag as sent (async, but not awaited for speed)
						await tableAiCampaignChat.updateOne(
							{ "_id": aiCampaignChatId },
							{ $set: directFbPublishedOptions }
						);

						// Send success message
						finalResponse = {
							'data': {
								"status": STATUS_SUCCESS,
								"message": postFacebookResponse.message,
							}
						};
						return returnApiResult(req, res, finalResponse);
					} else {
						// Send error message if post failed
						finalResponse = {
							'data': {
								"status": STATUS_ERROR,
								"message": postFacebookResponse && postFacebookResponse.message
									? postFacebookResponse.message
									: res.__("front.facebook.post_has_been_not_published_successfully"),
							}
						};
						return returnApiResult(req, res, finalResponse);
					}
				} catch (error) {
					// Handle errors during Facebook story publishing
					console.error("Error publishing Facebook story:", error);
					finalResponse = {
						'data': {
							"status": STATUS_ERROR,
							"message": res.__("front.facebook.post_has_been_not_published_successfully"),
							"error_details": error.message,
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// No images/videos to post, return no record found
				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						"result": {},
						'message': res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle unexpected errors
			console.error("Error in directPublishedStoryForFacebook:", error);
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"error": error,
					"message": res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end directPublishedStoryForFacebook();

}
module.exports = new FacebookData();