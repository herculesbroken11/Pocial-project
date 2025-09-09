const async = require('async');
const axios = require('axios');

function InstagramData() {

	/** Pocial account for New live server (Pocial-IG) client account (Live public access)*/
	let instagramAppID = INSTAGRAM_APP_ID;
	let instagramClientSecretId = INSTAGRAM_CLIENT_SECRET_ID;
	let redirectUrlAfterLoginInstagram = REDIRECT_URL_AFTER_LOGIN_INSTAGRAM;
	let directIgPublishedOptions = { 'direct_instagram_published': true, 'is_draft': CAMPAIGN_NOT_DRAFT, "sent_ig": true, "sent_created": getUtcDate(), "sent_ig_created": getUtcDate() };


	/**
	 * Function to exchange authorization code for an access token
	 * @param {*} code 
	 * @returns 
	 */
	const getAccessToken = async (code) => {
		const data = {
			client_id: instagramAppID, // Your Instagram App Client ID
			client_secret: instagramClientSecretId, // Your Instagram App Client Secret
			grant_type: "authorization_code",
			redirect_uri: redirectUrlAfterLoginInstagram, // Must match exactly what you set in the OAuth URL
			code: code, // Authorization code received from the Instagram OAuth process
		};
		try {
			const response = await axios.post('https://api.instagram.com/oauth/access_token', new URLSearchParams(data).toString(), {
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			});
			const accessToken = response.data.access_token;
			return accessToken;
		} catch (error) {
			console.error('Error getting access token:', error.response ? error.response.data : error.message);
			throw error;
		}
	};// end getAccessToken();

	/**
	 * Function to generate a long-lived Instagram token for a user.
	 * Uses async/await for all DB and network operations for faster response and clean error handling.
	 */
	this.generateLongLivedToken = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and request details
			const loginUserData = req.user_data || "";
			let userId = loginUserData._id || "";
			const code = req.body.code || "";
			const customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";

			// Allow override of userId for grouped social post details
			const aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
			if (aiCampaignChatUserId) {
				userId = aiCampaignChatUserId;
			}

			// Validate required fields
			if (!userId || !code) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Step 1: Exchange code for short-lived access token
			const shortLivedAccessToken = await getAccessToken(code);

			// Step 2: Exchange short-lived token for long-lived token
			const longLivedTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
				params: {
					grant_type: 'ig_exchange_token',
					client_secret: instagramClientSecretId,
					access_token: shortLivedAccessToken,
				}
			});
			const longLivedAccessToken = longLivedTokenResponse.data.access_token;

			// Step 3: Fetch user info from Instagram
			const userInfoResponse = await axios.get('https://graph.instagram.com/me', {
				params: {
					fields: 'id,username',
					access_token: longLivedAccessToken,
				}
			});

			// Step 4: Update user record in DB with new token and Instagram info
			const users = db.collection(TABLE_USERS);
			await users.updateOne(
				{ _id: userId },
				{
					$set: {
						long_lived_access_token: longLivedAccessToken,
						instagram_modified: getUtcDate(),
						instagram_created: getUtcDate(),
						instagram_user_details: (userInfoResponse && userInfoResponse.data) ? userInfoResponse.data : ""
					}
				}
			);

			// Step 5: Update social media presence details in parallel if needed
			const userOptions = {
				instagram_user_id: (userInfoResponse && userInfoResponse.data && userInfoResponse.data.id) ? userInfoResponse.data.id : "",
				user_id: userId,
				long_lived_access_token: longLivedAccessToken,
				ugc_gallery_uploaded: true,
				customer_id: customerId
			};

			// If updateSocialMediaPresence is async, await it for clean flow
			await updateSocialMediaPresence(req, res, userOptions);

			// Step 6: Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.instagram.token_has_been_generate_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle and log errors gracefully
			const errorMessage = error.response ? error.response.data : error.message;
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: (errorMessage && errorMessage.error_message) ? errorMessage.error_message : "",
					error: errorMessage
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	};

	/**
	 * Function for single image upload for Instagram
	 */
	this.singleImageUploadForInstagram = async (req, res) => {
		let finalResponse = {};

		// Sanitize request body
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract user and token details
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let longLivedAccessToken = loginUserData.long_lived_access_token ? loginUserData.long_lived_access_token : "";
		let currentTimezone = loginUserData.current_timezone ? loginUserData.current_timezone : "";
		let aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";

		// If ai_campaign_chat_user_id is provided, override userId and token
		let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
		if (aiCampaignChatUserId != '') {
			userId = aiCampaignChatUserId;
			longLivedAccessToken = req.body.long_lived_access_token ? req.body.long_lived_access_token : "";
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

		if (longLivedAccessToken == '') {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.instagram.instagram_not_connected"),
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

			// Extract content and meta
			let contentData = campaignChatDetails.content ? campaignChatDetails.content : {};
			let uniqueKey = campaignChatDetails.unique_key ? campaignChatDetails.unique_key : "";
			let aiCampaignParentId = campaignChatDetails.ai_campaign_parent_id ? campaignChatDetails.ai_campaign_parent_id : "";
			let allImagesVideoArray = contentData.image ? contentData.image : [];
			let title = contentData.title ? contentData.title : "";
			let caption = contentData.captions ? contentData.captions : "";
			let instagramHandle = contentData.instagram_handle ? contentData.instagram_handle : "";
			let publishMediaResponse = {};
			let mediaContainerId = "";

			if (allImagesVideoArray.length === 0) {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						'message': res.__("admin.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Add Instagram handle to caption if present
			if (instagramHandle) {
				caption = caption + PHOTO_CREDIT_CONSTANT + instagramHandle;
			}

			// Prepare log object
			let insertLogs = {
				'user_id': userId,
				'ai_campaign_parent_id': aiCampaignParentId,
				'image_url': allImagesVideoArray,
				'title': title,
				'caption': caption,
				'code': longLivedAccessToken,
				'unique_key': uniqueKey,
				'ai_campaign_chat_id': aiCampaignChatId,
				'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
				'direct_published': true,
				'current_timezone': currentTimezone,
			};

			try {
				// Single image/video upload
				if (allImagesVideoArray.length === 1) {
					let mediaUrl = allImagesVideoArray[0]['name'] ? AI_SOCIAL_IMAGES_URL + allImagesVideoArray[0]['name'] : "";

					// Step 1: Create a media container
					const createMediaResponse = await createSingelInstagramMedia(longLivedAccessToken, mediaUrl, caption);
					mediaContainerId = createMediaResponse.id;
				} else {
					// Multiple image/video upload (carousel)
					let mediaCarouselItems = allImagesVideoArray.map((records, index) => ({
						'url': AI_SOCIAL_IMAGES_URL + records['name'],
						'caption': 'Image/video ' + index
					}));

					// Step 1: Create carousel media container
					mediaContainerId = await createInstagramMediaCarousel(longLivedAccessToken, mediaCarouselItems, caption);
				}

				// Step 2: Publish media to Instagram
				publishMediaResponse = await publishInstagramMedia(longLivedAccessToken, mediaContainerId);

				// Update log object with publish results
				insertLogs['status'] = STATUS_SUCCESS;
				insertLogs['media_container_id'] = mediaContainerId;
				insertLogs['publish_media_id'] = (publishMediaResponse && publishMediaResponse.id) ? publishMediaResponse.id : "";
				insertLogs['publish_media_response'] = publishMediaResponse;
				insertLogs['long_lived_access_token'] = longLivedAccessToken;

				// Update campaign chat as direct published
				await tableAiCampaignChat.updateOne(
					{ '_id': aiCampaignChatId },
					{ $set: directIgPublishedOptions }
				);

				// Insert logs for table
				await insertInstagramLogs(req, res, insertLogs);

				// Send success message
				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						'unique_key': uniqueKey,
						"message": res.__("front.instagram.post_has_been_published_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);

			} catch (error) {
				console.log(error);

				insertLogs['error'] = (error.response) ? error.response.data : error.message;
				insertLogs['status'] = STATUS_ERROR;

				// Insert error logs for table
				await insertInstagramLogs(req, res, insertLogs);

				// Send error message
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						'unique_key': uniqueKey,
						"message": res.__("front.instagram.post_has_been_not_published_successfully") + ((error && error.message) ? (" (" + error.message + ")") : (" " + res.__("front.social.failed_post"))),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// General error handler
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": (err && err.message) ? err.message : res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end singleImageUploadForInstagram();

	/**
	 * Function to re-schedule an Instagram Post.
	 * Uses async/await for clean, fast response and error handling.
	 */
	this.reScheduledInstagramPost = async (req, res) => {
		let finalResponse = {};
		try {
			// Await the re-schedule operation
			await instagramReScheduleForSocialPost(req, res);

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle and log errors gracefully
			console.error('Error in reScheduledInstagramPost:', error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.message || res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end reScheduledInstagramPost();

	/**
	 * Function to logout Instagram or Facebook by unsetting relevant user fields.
	 * Uses async/await for DB operations for faster and cleaner response.
	 */
	this.logoutInstagram = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user and logout type
			const loginUserData = req.user_data || "";
			const socialLogoutType = req.body.social_media_logout_type || "";
			const userId = loginUserData._id || "";

			// Validate userId
			if (!userId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare unset data for Instagram or Facebook logout
			let updateUnsetData = {
				long_lived_access_token: 1,
				instagram_user_details: 1,
				instagram_created: 1,
				instagram_modified: 1,
				auto_schedule: 1,
			};

			if (socialLogoutType === 'facebook') {
				updateUnsetData = {
					facebook_long_lived_access_token: 1,
					facebook_user_details: 1,
					facebook_created: 1,
					facebook_modified: 1,
					facebook_page_id: 1,
					facebook_page_access_token: 1,
					facebook_page_name: 1
				};
			}

			// Perform the update using async/await for faster response
			const users = db.collection(TABLE_USERS);
			await users.updateOne(
				{ _id: userId },
				{ $unset: updateUnsetData }
			);

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: (socialLogoutType === 'facebook')
						? res.__("front.facebook.facebook_logout_successfully")
						: res.__("front.instagram.instagram_logout_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle and log errors gracefully
			console.error('Error in logoutInstagram:', error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end logoutInstagram();

	/**
	 * Function to upload Instagram stories using async/await for all DB and API operations.
	 * Ensures fast response and clean error handling.
	 */
	this.storyUploadForInstagram = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract user/session details
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let longLivedAccessToken = loginUserData.long_lived_access_token ? loginUserData.long_lived_access_token : "";
			let currentTimezone = loginUserData.current_timezone ? loginUserData.current_timezone : "";
			let aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";

			// Allow override of userId/token for grouped social post details
			let aiCampaignChatUserId = req.body.ai_campaign_chat_user_id ? newObjectIdDefault(req.body.ai_campaign_chat_user_id) : "";
			if (aiCampaignChatUserId !== '') {
				const users = db.collection(TABLE_USERS);
				userId = aiCampaignChatUserId;
				loginUserData = await users.findOne({ _id: newObjectIdDefault(userId) });
				longLivedAccessToken = loginUserData.long_lived_access_token ? loginUserData.long_lived_access_token : "";
			}

			// Validate required fields
			if (!userId || !longLivedAccessToken || !aiCampaignChatId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Find campaign chat details using async/await
			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
			const campaignChatDetails = await tableAiCampaignChat.findOne({
				'_id': aiCampaignChatId,
				'user_id': newObjectIdDefault(userId)
			});

			if (!campaignChatDetails) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract content and prepare for upload
			let contentData = campaignChatDetails.content ? campaignChatDetails.content : {};
			let uniqueKey = campaignChatDetails.unique_key ? campaignChatDetails.unique_key : "";
			let aiCampaignParentId = campaignChatDetails.ai_campaign_parent_id ? campaignChatDetails.ai_campaign_parent_id : "";
			let allImagesVideoArray = contentData.image ? contentData.image : [];
			let caption = contentData.captions ? contentData.captions : "";

			if (allImagesVideoArray.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare logs for each story upload
			let insertLogsBase = {
				user_id: userId,
				ai_campaign_parent_id: aiCampaignParentId,
				image_url: allImagesVideoArray,
				caption: caption,
				unique_key: uniqueKey,
				ai_campaign_chat_id: aiCampaignChatId,
				long_lived_access_token: longLivedAccessToken,
				type: AI_RESPONSE_TYPE_SOCIAL_STORY,
				current_timezone: currentTimezone,
			};

			// Upload all images/videos as stories in parallel using Promise.all
			const uploadPromises = allImagesVideoArray.map(async (imagesVideoRecords) => {
				try {
					let mediaUrl = imagesVideoRecords['name'] ? AI_SOCIAL_IMAGES_URL + imagesVideoRecords['name'] : "";

					// Step 1: Create a media container
					const createMediaResponse = await createSingelInstagramStoriesMedia(longLivedAccessToken, mediaUrl, caption);
					let mediaContainerId = createMediaResponse.id;

					// Step 2: Publish the story to Instagram
					const publishMediaResponse = await publishInstagramMedia(longLivedAccessToken, mediaContainerId);

					// Step 3: Insert logs for this upload
					let insertLogs = {
						...insertLogsBase,
						media_container_id: mediaContainerId,
						publish_media_id: publishMediaResponse && publishMediaResponse.id ? publishMediaResponse.id : "",
						publish_media_response: publishMediaResponse
					};
					await insertInstagramLogs(req, res, insertLogs);

					return { success: true };
				} catch (error) {
					// Log error for this particular upload
					console.error("Error uploading Instagram story:", error);
					return { success: false, error: error };
				}
			});

			// Wait for all uploads to complete
			const uploadResults = await Promise.all(uploadPromises);

			// Update campaign chat as published if at least one upload succeeded
			const anySuccess = uploadResults.some(result => result.success);
			if (anySuccess) {
				await tableAiCampaignChat.updateOne(
					{ '_id': aiCampaignChatId },
					{ $set: directIgPublishedOptions }
				);

				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: res.__("front.instagram.stories_has_been_published_successfully"),
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			console.error("Error in storyUploadForInstagram:", error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.response ? error.response.data : error.message
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end storyUploadForInstagram();

	/**
	 * Function to publish a single image as an Instagram Story from the media popup.
	 * Uses async/await for all DB/API operations for clean, fast response.
	 */
	this.publishAsStoryOnPopupImageUrl = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize input and extract user/session details
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const loginUserData = req.user_data || {};
			const userId = loginUserData._id || "";
			const longLivedAccessToken = loginUserData.long_lived_access_token || "";
			const mediaUrl = req.body.media_url || "";
			const aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";
			const caption = "Story";

			// Validate required fields
			if (!userId || !longLivedAccessToken || !mediaUrl) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare log object for insertion
			let insertLogs = {
				user_id: userId,
				ai_campaign_parent_id: "",
				image_url: mediaUrl,
				caption: caption,
				unique_key: "",
				ai_campaign_chat_id: aiCampaignChatId,
				long_lived_access_token: longLivedAccessToken,
				type: AI_RESPONSE_TYPE_SOCIAL_STORY,
			};

			// Step 1: Create a media container for the story (async/await)
			const createMediaResponse = await createSingelInstagramStoriesMedia(longLivedAccessToken, mediaUrl, caption);
			const mediaContainerId = createMediaResponse.id;

			// Step 2: Publish the media as a story (async/await)
			const publishMediaResponse = await publishInstagramMedia(longLivedAccessToken, mediaContainerId);

			// Step 3: Insert logs into the database (async/await)
			insertLogs.media_container_id = mediaContainerId;
			insertLogs.publish_media_id = (publishMediaResponse && publishMediaResponse.id) ? publishMediaResponse.id : "";
			insertLogs.publish_media_response = publishMediaResponse;
			await insertInstagramLogs(req, res, insertLogs);

			// Step 4: Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.instagram.stories_has_been_published_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			console.error("Error in publishAsStoryOnPopupImageUrl:", error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: error.response ? error.response.data : error.message
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end publishAsStoryOnPopupImageUrl();

	/**
	 * Function to fetch media insights for a single post.
	 * Uses async/await for all DB and API operations for clean, fast response.
	 * If multiple queries are needed, they are run in parallel using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns 
	 */
	this.viewSinglePostFetchMediaInsights = async (req, res) => {
		let finalResponse = {};

		try {
			// Sanitize input data to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const loginUserData = req.user_data || {};
			const userId = loginUserData._id || "";
			const longLivedAccessToken = loginUserData.long_lived_access_token || "";
			const aiCampaignChatId = req.body.ai_campaign_chat_id ? newObjectIdDefault(req.body.ai_campaign_chat_id) : "";

			// Validate required fields
			if (!userId || !longLivedAccessToken || !aiCampaignChatId) {
				return returnApiResult(req, res, {
					data: {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					},
				});
			}

			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
			const instagramlogs = db.collection(TABLE_INSTAGRAM_LOGS);

			// Fetch all post details (only _id field)
			const resultSocialPost = await tableAiCampaignChat
				.find({ _id: aiCampaignChatId }, { projection: { _id: 1 } })
				.toArray();

			if (!resultSocialPost || resultSocialPost.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: [],
						message: ""
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// For each post, fetch the corresponding Instagram log and then fetch insights
			// Run all DB/API queries in parallel for faster response
			const insightsPromises = resultSocialPost.map(async (record) => {
				try {
					// Fetch the Instagram log for this post
					const instagramLog = await instagramlogs.findOne(
						{ _id: record._id },
						{ projection: { publish_media_id: 1 } }
					);
					const publishMediaId = instagramLog?.publish_media_id || "";

					if (!publishMediaId) {
						return null; // Skip if no media ID
					}

					// Fetch insights for this media ID
					const insights = await fetchMediaInsights(publishMediaId, longLivedAccessToken);
					return { recordId: record._id, insights };
				} catch (error) {
					console.error(`Error fetching insights for recordId ${record._id}:`, error.message);
					return { recordId: record._id, error: error.message };
				}
			});

			// Wait for all parallel queries to complete
			const allViewData = await Promise.all(insightsPromises);

			// Send success response with all insights (filter out nulls)
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: allViewData.filter((data) => data),
					message: ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors gracefully
			console.error("Unexpected error in viewSinglePostFetchMediaInsights:", error.message);

			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end viewSinglePostFetchMediaInsights();

	/**
	 * Function to crawl Instagram login user data using async/await.
	 * All DB and API queries are handled with async/await for clean, fast response.
	 * Parallelizes independent queries where possible for performance.
	 */
	this.crawlToInstagramLoginUserData = async (req, res) => {
		let finalResponse = {};

		// Sanitize input
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const code = req.body.code || "";
		const uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
		const ipAddr = req.body.ip || "";

		const tableLibraryLogs = db.collection(TABLE_CONTENT_LIBRARY_LOGS);
		const web_ai_info = db.collection(TABLE_WEB_AI_INFO);

		// Validate required fields
		if (!code || !uniqueBrowserId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Step 1: Get the short-lived access token using the code
			const shortLivedAccessToken = await getAccessToken(code);

			// Step 2: Exchange for a long-lived access token
			const longLivedTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
				params: {
					grant_type: 'ig_exchange_token',
					client_secret: instagramClientSecretId,
					access_token: shortLivedAccessToken,
				}
			});
			const longLivedAccessToken = longLivedTokenResponse.data.access_token;

			// Step 3: Get user info (id, username)
			const userInfoResponse = await axios.get('https://graph.instagram.com/me', {
				params: {
					fields: 'id,username',
					access_token: longLivedAccessToken,
				}
			});
			const userInstaResponseData = userInfoResponse?.data || {};
			const userId = userInstaResponseData.id;

			// Step 4: Get user profile and media data
			const userResponse = await axios.get(`https://graph.instagram.com/${userId}`, {
				params: {
					fields: 'id,username,biography,followers_count,follows_count,profile_picture_url,media{id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count}',
					access_token: longLivedAccessToken
				}
			});
			const userResponseData = userResponse?.data || {};
			const userInfoResponseData = {
				id: userResponseData?.id || "",
				username: userResponseData?.username || ""
			};
			const userMediaRes = userResponseData?.media?.data || [];
			delete userResponseData.media;

			if (userMediaRes.length === 0) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.instagram.no_posts_on_instagram_account")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Step 5: Prepare top 3 posts by engagement
			const top3Posts = userMediaRes.map(({ caption, timestamp, media_type, media_url, like_count, comments_count }) => ({
				caption,
				timestamp,
				mediaType: media_type,
				mediaUrl: media_url,
				likeCount: like_count,
				commentCount: comments_count,
				totalEngagement: (like_count || 0) + (comments_count || 0),
			})).sort((a, b) => b.totalEngagement - a.totalEngagement).slice(0, 3);

			const mediaUrls = userMediaRes.map(record => record.media_url);

			let socialMediaAnalysis = "";
			let businessData = "";
			let websiteUrl = "";
			let businessProfileData = {};

			// Step 6: Generate social media analysis (AI or Gemini)
			if (GEMINI_SERVER_ENABLE === true) {
				let instagramData = {
					user_details: userResponseData,
					posts: userMediaRes,
				};
				instagramData = objectToMarkdown(instagramData);

				// Gemini AI call
				const geminiData = await generateDataVaultDetails(null, null, {
					type: "instagram_url",
					instagram_data: instagramData
				});
				const responseDataVault = (geminiData.status === STATUS_SUCCESS) ? geminiData?.response?.data_vault : {};
				socialMediaAnalysis = responseDataVault;
			} else {
				const instagramOptions = {
					instagram_details: {
						posts: userMediaRes,
						user_details: userResponseData
					},
					user_prompt: CRAWLING_INSTAGRAM_DATA_USER_PROMPT,
					system_prompt: INSTAGRAM_CRAWL_SYSTEM_PROMPT
				};
				const aiData = await generateSocialMediaPresence(req, res, instagramOptions);
				const finalResponseData = aiData?.response || {};

				socialMediaAnalysis = finalResponseData.socialMediaAnalysis || {};
				businessProfileData = finalResponseData.businessProfileData || {};
				businessData = businessProfileData.businessInfo || "";
				websiteUrl = businessProfileData.websiteUrl || "";
			}

			// Add top posts to analysis
			if (top3Posts.length > 0) {
				socialMediaAnalysis['topPosts'] = top3Posts;
			}

			// Step 7: Crawl website if available
			let webSiteScrapData = "";
			let childLinks = [];
			if (websiteUrl) {
				const { status, web_info_data } = await crawlWebsiteUrlWhileInstagramLogin(req, res, websiteUrl) || {};
				if (status === STATUS_SUCCESS && web_info_data) {
					webSiteScrapData = web_info_data;
					const childLinksArray = web_info_data.child_links || [];
					if (childLinksArray.length) childLinks.push(childLinksArray);
				}
			}

			// Step 8: Prepare AI response and business info
			let aiResponseData = {};
			let businessInfoData = "";
			if (webSiteScrapData) {
				businessInfoData = { ...webSiteScrapData };
				aiResponseData = { ...webSiteScrapData, social_media_presence: { ...socialMediaAnalysis } };
			} else {
				businessInfoData = { ...businessProfileData };
				aiResponseData['social_media_presence'] = { businessInfo: businessData, ...socialMediaAnalysis };
			}
			const isCrawl = !!webSiteScrapData;

			// Step 9: Insert web link data and upload images in parallel
			const initialWebLinkId = newObjectIdDefault();
			await Promise.all([
				insertWebLinkData({
					_id: initialWebLinkId,
					unique_browser_id: uniqueBrowserId,
					child_links: childLinks,
					is_crawl: isCrawl,
					is_instagram_crawled: true,
					instagram_code: code
				}),
				instagramImageUploadOnUgcGallery(req, res, {
					unique_browser_id: uniqueBrowserId,
					media_urls: mediaUrls
				})
			]);

			// Step 10: Insert web info AI response data
			let insertWebinfo = {
				web_id: initialWebLinkId,
				unique_browser_id: uniqueBrowserId,
				website_url: websiteUrl,
				user_email: "",
				user_id: "",
				all_instagram_posts: userMediaRes,
				created: getUtcDate(),
				modified: getUtcDate()
			};
			if (websiteUrl && webSiteScrapData) {
				insertWebinfo['data'] = { ...webSiteScrapData };
				insertWebinfo['social_media_presence'] = { ...socialMediaAnalysis };
			} else {
				insertWebinfo['data'] = {};
				insertWebinfo['social_media_presence'] = { businessInfo: businessData, ...socialMediaAnalysis };
			}
			await web_ai_info.insertOne(insertWebinfo);

			const businessInformationData = (Object.keys(aiResponseData).length > 0) ? aiResponseData : "";

			// Step 11: Generate first social post with image
			const aiSocialPostContent = await generateFirstSocialPostWithImage(req, res, {
				business_information: businessInformationData,
				unique_browser_id: uniqueBrowserId,
				instagram_url: "instagramUrl"
			});
			const socialPostResponse = (aiSocialPostContent.status === STATUS_SUCCESS) ? aiSocialPostContent.result : "";

			if (aiSocialPostContent.status === STATUS_SUCCESS && socialPostResponse) {
				const aiContentData = [{ social_media: socialPostResponse }];
				businessInfoData['website_url'] = websiteUrl;
				businessInfoData['web_id'] = initialWebLinkId;
				businessInfoData['website_crawlable'] = aiSocialPostContent.website_image_crawl;
				businessInfoData['website_image_crawlable'] = aiSocialPostContent.website_image_crawl;
				businessInfoData['long_lived_access_token'] = longLivedAccessToken;
				businessInfoData['instagram_user_details'] = userInfoResponseData || "";
				businessInfoData['scrape_with_instagram'] = true;

				// Step 12: Upsert logs response data into database (async/await)
				await tableLibraryLogs.findOneAndUpdate(
					{ unique_ai_browser_id: uniqueBrowserId },
					{
						$set: {
							zip_code: DEFAULT_USER_ZIP,
							modified: getUtcDate(),
							ai_content: aiContentData,
							website_data: businessInfoData
						},
						$setOnInsert: {
							ip_addr: ipAddr,
							unique_ai_browser_id: uniqueBrowserId,
							created: getUtcDate()
						}
					},
					{ upsert: true }
				);

				const aiContentSocialData = [{ social_media: { content: socialPostResponse } }];

				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: aiContentSocialData,
						message: "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			console.log(error);
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end crawlToInstagramLoginUserData();


	/**
	 * Function to fetch all media of an Instagram user using async/await.
	 * Handles pagination and accumulates all media items.
	 * @param {string} userId - Instagram user ID
	 * @param {string} accessToken - Instagram access token
	 * @returns {Promise<Array>} - Array of all media objects
	 */
	getAllMedia = async (userId, accessToken) => {
		let allMedia = [];
		let nextUrl = `https://graph.instagram.com/${userId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${accessToken}`;
		try {
			// Loop through all pages using async/await for each API call
			while (nextUrl) {
				const response = await axios.get(nextUrl);
				const data = response.data;
				if (data && data.data && Array.isArray(data.data)) {
					allMedia.push(...data.data);
				}
				// Set nextUrl for pagination, or null to exit loop
				nextUrl = (data.paging && data.paging.next) ? data.paging.next : null;
			}
			return allMedia;
		} catch (error) {
			console.error('Error fetching all media:', error.response?.data || error.message);
			throw error;
		}
	}; // end getAllMedia();

	/**
	 * Function used for get fetch Media Insights data
	 * @param {*} mediaId 
	 * @param {*} accessToken 
	 * @returns 
	 */
	async function fetchMediaInsights(mediaId, accessToken) {
		try {
			const metrics = 'impressions,reach,likes,comments,saved,shares,total_interactions,profile_visits,follows';
			const response = await axios.get(
				`https://graph.instagram.com/${mediaId}/insights`,
				{
					params: {
						metric: metrics,
						access_token: accessToken,
					},
				}
			);
			return response.data;
		} catch (error) {
			console.error('Error fetching media insights:', error.response?.data || error.message);
			throw error;
		}
	}// end fetchMediaInsights();

	
	/**
	 * Function to check validity of IG & FB long-lived tokens
	 * Uses async/await and runs both token checks in parallel using Promise.all.
	 */
	this.socialTokenValidCheck = async (req, res) => {
		let finalResponse = {};
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let loginUserData = req.user_data ? req.user_data : "";
		let facebookLongLivedTokenResponse = loginUserData.facebook_long_lived_access_token || "";
		let igLongLivedAccessToken = loginUserData.long_lived_access_token || "";
		// let igLongLivedAccessToken = "IGQWRPZAlVTZA0oxQi1fSGpBM0Qxcmwyd1R3ZAmVwdUd6eFM4Y28tOVc1RDJHSUFKWXBXTlVXU3l6YkdmZADZAXS2lqb3FYWW0xRVJubm52aGFLY3FyZAThJMXVLZAXpiSXV2eDZAvcC02LTZAtY3ZA5QQZDZD";
		// let facebookLongLivedTokenResponse = "IGQWRPZAlVTZA0oxQi1fSGpBM0Qxcmwyd1R3ZAmVwdUd6eFM4Y28tOVc1RDJHSUFKWXBXTlVXU3l6YkdmZADZAXS2lqb3FYWW0xRVJubm52aGFLY3FyZAThJMXVLZAXpiSXV2eDZAvcC02LTZAtY3ZA5QQZDZD";

		// If both tokens are missing, return error
		if (!facebookLongLivedTokenResponse && !igLongLivedAccessToken) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Helper function to validate Instagram token
		const validateInstagramToken = async (token) => {
			if (!token) return null;
			try {
				const igResp = await axios.get("https://graph.instagram.com/me", {
					params: {
						fields: "id,username",
						access_token: token,
					}
				});
				return igResp.data;
			} catch (err) {
				throw new Error(res.__("front.instagram.instagram_token_invalid_or_expired"));
			}
		};

		// Helper function to validate Facebook token
		const validateFacebookToken = async (token) => {
			if (!token) return null;
			try {
				const fbResp = await axios.get("https://graph.facebook.com/v18.0/me", {
					params: {
						fields: "id,name,email",
						access_token: token,
					}
				});
				return fbResp.data;
			} catch (err) {
				throw new Error(res.__("front.facebook.facebook_token_invalid_or_expired"));
			}
		};

		let igUserDetails = null;
		let fbUserDetails = null;
		let errors = [];

		// Run both token checks in parallel using Promise.allSettled
		const promises = [
			validateInstagramToken(igLongLivedAccessToken),
			validateFacebookToken(facebookLongLivedTokenResponse)
		];

		const [igResult, fbResult] = await Promise.allSettled(promises);

		// Handle Instagram result
		if (igResult.status === "fulfilled" && igResult.value) {
			igUserDetails = igResult.value;
		} else if (igLongLivedAccessToken) {
			errors.push(res.__("front.instagram.instagram_token_invalid_or_expired"));
		}

		// Handle Facebook result
		if (fbResult.status === "fulfilled" && fbResult.value) {
			fbUserDetails = fbResult.value;
		} else if (facebookLongLivedTokenResponse) {
			errors.push(res.__("front.facebook.facebook_token_invalid_or_expired"));
		}

		// Prepare final response
		if (errors.length > 0) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: (errors.length !== 2) ? errors[0] : res.__("front.igfb.token_invalid_or_expired"),
					// igUserDetails,
					// fbUserDetails
				}
			};
		} else {
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					// igUserDetails,
					// fbUserDetails
				}
			};
		}
		return returnApiResult(req, res, finalResponse);
	};

}
module.exports = new InstagramData();