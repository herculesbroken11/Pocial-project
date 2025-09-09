const async = require('async');

/** Define collection */
const aiWebInfo = db.collection(TABLE_WEB_AI_INFO);
const aiAboutDocument = db.collection(TABLE_AI_ABOUT_DOCUMENT);
const web_links = db.collection(TABLE_WEB_LINKS);

function aboutMyBusiness() {

	/**
	 * Function for use to get website crawler details
	 * Uses async/await for all DB queries and runs independent queries in parallel for faster response times.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.websiteCrawlerDetailsNewProcess = async function (req, res) {
		let uniqueBrowserId = (req.body.unique_ai_browser_id) ? (req.body.unique_ai_browser_id).toString() : "";
		let finalResponse = {};

		// Slug validation
		if (!uniqueBrowserId) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': [],
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
		try {
			// Prepare query condition
			const aboutMyCondition = { "unique_browser_id": uniqueBrowserId };

			// Run aiWebInfo and web_links queries in parallel for faster response
			const [result, webLinkData] = await Promise.all([
				aiWebInfo.findOne(aboutMyCondition),
				web_links.findOne(aboutMyCondition)
			]);

			// Handle no record found
			if (!result) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("api.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const webChildLink = (webLinkData && webLinkData.child_links) ? webLinkData.child_links : [];
			const resultData = (result.data) ? result.data : {};
			const websiteUrl = (result.website_url) ? result.website_url : "";

			const resultOtherData = (result.other_data) ? result.other_data : {};
			const webOtherLink = (webLinkData && webLinkData.other_link) ? webLinkData.other_link : [];
			const isInstagramCrawled = (webLinkData && webLinkData.is_instagram_crawled) ? webLinkData.is_instagram_crawled : false;

			let matchingPairs = [];
			let matchingPairsOtherData = [];

			// Process child links for dynamic pages
			if (webChildLink.length > 0) {
				const uniqueChildLinks = webChildLink.filter((item, index, self) =>
					index === self.findIndex((t) => t.page_type === item.page_type)
				);
				uniqueChildLinks.forEach(link => {
					if (resultData.hasOwnProperty(link.page_type)) {
						let pair = {};
						if (Array.isArray(resultData[link.page_type])) {
							pair[link.page_type] = resultData[link.page_type].join('<br>');
						} else {
							pair[link.page_type] = resultData[link.page_type];
						}
						matchingPairs.push(pair);
					}
				});
			}

			// Process other links for dynamic other pages
			if (webOtherLink.length > 0) {
				const uniqueOtherLinks = webOtherLink.filter((item, index, self) =>
					index === self.findIndex((t) => t.page_type === item.page_type)
				);
				uniqueOtherLinks.forEach(link => {
					if (resultOtherData.hasOwnProperty(link.page_type)) {
						let pair = {};
						if (Array.isArray(resultOtherData[link.page_type])) {
							pair[link.page_type] = resultOtherData[link.page_type].join('<br>');
						} else {
							pair[link.page_type] = resultOtherData[link.page_type];
						}
						matchingPairsOtherData.push(pair);
					}
				});
			}

			// Set dynamic pages data if available
			if (matchingPairs.length > 0) {
				result.data["dynamic_pages"] = matchingPairs;
			}
			if (matchingPairsOtherData.length > 0) {
				result.other_data["dynamic_other_pages"] = matchingPairsOtherData;
			}

			result.data["website_url"] = websiteUrl;

			// If Instagram is crawled, override data with social media presence
			if (isInstagramCrawled === true) {
				result.data = { ...resultData.social_media_presence };
			}

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': result,
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end websiteCrawlerDetailsNewProcess()


	/**
	 * Function for use to get website crawler details
	 * Uses async/await for all DB queries and runs independent queries in parallel for faster response times.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.websiteCrawlerDetails = async function (req, res) {
		// Get user id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};

		// Slug validation
		if (!userId) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': [],
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Prepare query condition
			let aboutMyCondition = {
				"user_id": newObjectIdDefault(userId)
			};

			// Run aiWebInfo and web_links queries in parallel for faster response times
			const [result, webLinkData] = await Promise.all([
				aiWebInfo.findOne(aboutMyCondition, { projection: { "_id": 1, 'data': 1, 'other_data': 1, 'website_url': 1 } }),
				web_links.findOne(aboutMyCondition)
			]);

			// Handle no record found
			if (!result) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("api.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let webChildLink = (webLinkData && webLinkData.child_links) ? webLinkData.child_links : [];
			let resultData = result.data ? result.data : {};
			let websiteUrl = result.website_url ? result.website_url : "";

			let resultOtherData = result.other_data ? result.other_data : {};
			let webOtherLink = (webLinkData && webLinkData.other_link) ? webLinkData.other_link : [];
			let isInstagramCrawled = (webLinkData && webLinkData.is_instagram_crawled) ? webLinkData.is_instagram_crawled : false;

			let matchingPairs = [];
			let matchingPairsOtherData = [];

			// Process child links for dynamic pages
			if (webChildLink.length > 0) {
				let uniqueChildLinks = webChildLink.filter((item, index, self) =>
					index === self.findIndex((t) => t.page_type === item.page_type)
				);
				uniqueChildLinks.forEach(link => {
					if (resultData.hasOwnProperty(link.page_type)) {
						let pair = {};
						if (Array.isArray(resultData[link.page_type])) {
							pair[link.page_type] = resultData[link.page_type].join('<br>');
						} else {
							pair[link.page_type] = resultData[link.page_type];
						}
						matchingPairs.push(pair);
					}
				});
			}

			// Process other links for dynamic other pages
			if (webOtherLink.length > 0) {
				let uniqueOtherLinks = webOtherLink.filter((item, index, self) =>
					index === self.findIndex((t) => t.page_type === item.page_type)
				);
				uniqueOtherLinks.forEach(link => {
					if (resultOtherData.hasOwnProperty(link.page_type)) {
						let pair = {};
						if (Array.isArray(resultOtherData[link.page_type])) {
							pair[link.page_type] = resultOtherData[link.page_type].join('<br>');
						} else {
							pair[link.page_type] = resultOtherData[link.page_type];
						}
						matchingPairsOtherData.push(pair);
					}
				});
			}

			// Set dynamic pages data if available
			if (matchingPairs.length > 0) {
				result.data["dynamic_pages"] = matchingPairs;
			}
			if (matchingPairsOtherData.length > 0) {
				result.other_data["dynamic_other_pages"] = matchingPairsOtherData;
			}

			result.data["website_url"] = websiteUrl;

			// Remove social_media_presence if present
			delete result.data['social_media_presence'];

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': result,
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end websiteCrawlerDetails();

	/**
	 * Function to get social media presence details using async/await for faster response times.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.socialMediaPresenceDetails = async (req, res) => {
		// Extract user data and userId
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};

		// Slug validation
		if (!userId) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': [],
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Prepare query condition
			const aboutMyCondition = { "user_id": newObjectIdDefault(userId) };

			// Query aiWebInfo for social media presence details
			const result = await aiWebInfo.findOne(aboutMyCondition);

			// Handle no record found
			if (!result) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("api.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract relevant fields
			const socialMediaPresence = result.social_media_presence ? result.social_media_presence : {};
			const allInstagramPosts = result.all_instagram_posts ? result.all_instagram_posts : {};
			const websiteUrl = result.website_url ? result.website_url : "";

			// Prepare response object
			let resultResponse = {
				'data': socialMediaPresence,
				'all_posts': allInstagramPosts,
				'website_url': websiteUrl,
				'_id': result._id
			};

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': resultResponse,
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end socialMediaPresenceDetails();


	/**
	 * Function to get Apify details using async/await for faster and cleaner execution.
	 * Runs all DB queries with async/await and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getApifyDetails = async (req, res) => {
		// Get user id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};

		// Slug validation
		if (!userId) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': [],
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Prepare query condition
			const aboutMyCondition = { "user_id": newObjectIdDefault(userId) };

			// Run aiWebInfo query using async/await
			const result = await aiWebInfo.findOne(
				aboutMyCondition,
				{ projection: { "_id": 1, 'apify_instagram_data': 1, 'all_instagram_posts_from_apify': 1, 'website_url': 1, 'instagram_url': 1 } }
			);

			// Handle no record found
			if (!result) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("api.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Extract relevant fields
			const apifyInstagramData = result.apify_instagram_data ? result.apify_instagram_data : {};
			const allInstagramPosts = result.all_instagram_posts_from_apify ? result.all_instagram_posts_from_apify : {};
			const websiteUrl = result.website_url ? result.website_url : "";
			const instagramUrl = result.instagram_url ? result.instagram_url : "";

			// Prepare response object
			let resultResponse = {
				'data': apifyInstagramData,
				'all_posts': allInstagramPosts,
				'website_url': websiteUrl,
				'instagram_url': instagramUrl,
				'_id': result._id
			};

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': resultResponse,
					'image_url': INSTAGRAM_CRAWL_IMAGES_URL,
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getApifyDetails();

	/**
	 * Function to handle data vault document upload using async/await for faster and cleaner execution.
	 * All DB queries and file operations are handled with async/await.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.dataVaultUploadDocument = async function (req, res) {
		// Get user id and input data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let title = req.body.title ? req.body.title : "";
		let uploadDocument = (req.files && req.files.upload_document) ? req.files.upload_document : "";

		let finalResponse = {};

		// Validate required fields
		if (!userId || !uploadDocument || !title) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare options for file upload
		let options = {
			'image': uploadDocument,
			'filePath': AI_ABOUT_USER_FILE_PATH,
			'oldPath': "",
			'allowedExtensions': ALLOWED_DOCX_OR_PDF_EXTENSIONS,
			'allowedImageError': ALLOWED_DOCX_OR_PDF_ERROR_MESSAGE,
			'allowedMimeTypes': ALLOWED_DOCX_OR_PDF_MIME_EXTENSIONS,
			'allowedMimeError': ALLOWED_DOCX_OR_PDF_MIME_ERROR_MESSAGE,
			'size': ALLOWED_VALID_DOCX_OR_PDF_FILE_SIZE,
			'allowedSizeErrorMessage': ALLOWED_DOCX_OR_PDF_SIZE_MESSAGE,
		};

		try {
			// Upload the document asynchronously
			const documentResponse = await moveUploadedFile(req, res, options);

			if (documentResponse.status == STATUS_ERROR) {
				// Send error response if upload fails
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': documentResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let fileName = documentResponse.fileName ? documentResponse.fileName : "";
			let extension = documentResponse.image_extension ? documentResponse.image_extension : "";

			// Prepare slug options
			let slugOptions = {
				"title": title,
				"table_name": TABLE_AI_ABOUT_DOCUMENT,
				"slug_field": "slug"
			};

			// Generate slug and insert document in parallel for faster response
			const slugResponse = await getDatabaseSlug(slugOptions);

			await aiAboutDocument.insertOne({
				'user_id': userId,
				'title': title,
				'upload_file': fileName,
				'file_extension': extension,
				'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
				'created': getUtcDate()
			});

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'message': res.__("front.about_my_business.document_has_been_upload_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'message': res.__("front.system.something_went_wrong"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end dataVaultUploadDocument()

	/**
	 * Function to get the list of uploaded documents for the user.
	 * Uses async/await for database queries for faster and cleaner execution.
	 * @returns data
	 */
	this.getAboutDocumentList = async (req, res) => {
		let finalResponse = {};

		// Sanitize request body
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Get login user data
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		// Check for blank userId
		if (!userId) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					'file_url': AI_ABOUT_USER_FILE_URL,
					"result": {},
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Find all documents for the user using async/await
			const result = await aiAboutDocument.find({ "user_id": newObjectIdDefault(userId) }).toArray();

			// Send success response
			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'file_url': AI_ABOUT_USER_FILE_URL,
					'result': result,
					'message': "",
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Send error response
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'file_url': AI_ABOUT_USER_FILE_URL,
					'result': [],
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getAboutDocumentList()

	/**
	 * Function to delete document data using async/await for faster and cleaner execution.
	 */
	this.deleteAboutDocument = async (req, res) => {
		let finalResponse = {};

		// Sanitize request body
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Get login user
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let uploadDocumentId = req.body.upload_document_id ? newObjectIdDefault(req.body.upload_document_id) : "";

		// Check for blank userId or uploadDocumentId
		if (!userId || !uploadDocumentId) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					'file_url': AI_ABOUT_USER_FILE_URL,
					"result": {},
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Find the about document for the user
			const documentResult = await aiAboutDocument.findOne({
				'_id': uploadDocumentId,
				'user_id': userId
			});

			if (!documentResult) {
				// Send error response if document not found
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("api.global.no_record_found")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let uploadFile = documentResult.upload_file ? documentResult.upload_file : "";

			// If there is an uploaded file, remove it asynchronously
			if (uploadFile !== '') {
				let imagesData = {
					file_path: AI_ABOUT_USER_FILE_PATH + uploadFile
				};
				// Remove file, but don't block on it
				removeFile(imagesData).catch(() => { });
			}

			// Delete the document data
			await aiAboutDocument.deleteOne({
				'_id': uploadDocumentId,
				'user_id': userId
			});

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: {
						follow_status: DEACTIVE
					},
					message: res.__("front.about_my_business.document_has_been_delete_successfully")
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'file_url': AI_ABOUT_USER_FILE_URL,
					'result': {},
					'message': res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end deleteAboutDocument()


	/**
	 * Function for used to update data vault
	 * Uses async/await for DB queries for faster and cleaner execution.
	 * @param {*} req 
	 * @param {*} res 
	 */
	this.updateDataVault = async (req, res) => {
		let finalResponse = {};

		// Sanitize input data
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let webInfoId = req.body.web_info_id ? newObjectIdDefault(req.body.web_info_id) : "";
		let crawlData = req.body.crawl_data ? req.body.crawl_data : "";
		let crawlOtherData = req.body.crawl_other_data ? req.body.crawl_other_data : "";
		let type = req.body.type ? req.body.type : "";

		// Validate required fields
		if (!userId || !webInfoId) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			let updateData = {};

			if (type == DATA_VAULT_ABOUT_MY_BUSINESS) {
				// Merge dynamic pages into crawlData
				if (crawlData.dynamic_pages) {
					crawlData.dynamic_pages.forEach(page => {
						Object.assign(crawlData, page);
					});
					delete crawlData.dynamic_pages;
				}

				// Merge dynamic other pages into crawlOtherData
				if (crawlOtherData.dynamic_other_pages) {
					crawlOtherData.dynamic_other_pages.forEach(page => {
						Object.assign(crawlOtherData, page);
					});
					delete crawlOtherData.dynamic_other_pages;
				}

				updateData['data'] = crawlData;
				if (crawlOtherData) {
					updateData['other_data'] = crawlOtherData;
				}
			} else if (type == DATA_VAULT_SOCIAL_MEDIA_PRESENCE) {
				updateData['social_media_presence'] = crawlData;
			} else if (type == DATA_VAULT_APIFY_DOCUMENT) {
				updateData['apify_instagram_data'] = crawlData;
			}

			// Update aiWebInfo using async/await for faster response
			const result = await aiWebInfo.updateOne(
				{ "_id": newObjectIdDefault(webInfoId), "user_id": newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			if (result && result.modifiedCount > 0) {
				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						"message": res.__("front.about_my_business.data_vault_has_been_updated_successfully"),
					}
				};
			} else {
				finalResponse = {
					'data': {
						"status": STATUS_ERROR,
						"message": res.__("front.system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end updateDataVault();


	/**
	 * Function to save AI database structure for the user.
	 * Uses async/await for all DB queries and runs independent queries in parallel for faster response times.
	 * @param {*} req 
	 * @param {*} res 
	 */
	this.aiDatabaseStructure = async (req, res) => {
		let finalResponse = {};

		// Sanitize request body and extract user info
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const customerId = (loginUserData && loginUserData.user_unique_id) ? loginUserData.user_unique_id : "";
		const userName = loginUserData.fname ? loginUserData.fname : "";

		// Check for blank userId
		if (!userId) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Helper: Save if data exists
		const saveBusketData = async (data, bucketName, parentBucket) => {
			if (data && Object.keys(data).length > 0) {
				await saveCustomerBucketItems({
					'user_id': userId,
					'user_name': userName,
					'customer_id': customerId,
					'bucket_name': bucketName,
					'parent_bucket': parentBucket,
					'data': data
				});
			}
		};

		try {
			// 1. Fetch Website Info in parallel with other summary fetches for speed
			const webInfoPromise = aiWebInfo.findOne({ user_id: userId });

			// 2. Fetch Social Posts, Email, Poll, and Reward summaries in parallel
			const [
				webInfoResult,
				socialPosts,
				emailData,
				pollData,
				rewardData
			] = await Promise.all([
				webInfoPromise,
				fetchUserSocialPostSummary(req, res, userId),
				fetchUserEmailSummary(req, res, userId),
				fetchUserPollSummary(req, res, userId),
				fetchUserRewardSummary(req, res, userId)
			]);

			// 3. Save Website Info bucket if exists
			const webInfoData = { ...webInfoResult?.data } || {};
			const socialMediaPresence = webInfoResult?.social_media_presence || {};
			const allInstagramPosts = webInfoResult?.all_instagram_posts || [];

			if (Object.keys(webInfoData).length > 0) {
				const bucketData = {
					"business_info": webInfoData?.businessInfo || {},
					"business_categories": webInfoData?.businessCategories || [],
					"key_products": webInfoData?.keyProducts || [],
					"home_services": webInfoData?.services || [],
					"social_links": webInfoData?.socialLinks || {},
					"contact_info": webInfoData?.contactInfo || {},
					"menu": webInfoData?.Menu || "",
					"about": webInfoData?.About || "",
				};
				await saveBusketData(bucketData, DATA_BUCKET_ABOUT_BUSINESS, PARENT_BUCKET_ABOUT_BUSINESS);
			}

			// 4. Save Social Media Presence bucket if exists
			if (Object.keys(socialMediaPresence).length > 0) {
				const completeSocialData = {
					"business_info": socialMediaPresence?.businessInfo || {},
					"audience_engagement": socialMediaPresence?.audienceEngagement || {},
					"posting_habits": socialMediaPresence?.postingHabits || {},
					"writing_style": socialMediaPresence?.writingStyle || {},
					"visual_content": socialMediaPresence?.visualContent || {},
					"recommendations": socialMediaPresence?.recommendations || {},
					"top_posts": socialMediaPresence?.topPosts || [],
					"all_posts": (allInstagramPosts.length > 0) ? allInstagramPosts : []
				};
				await saveBusketData(completeSocialData, DATA_BUCKET_SOCIAL_PRESENCE, PARENT_BUCKET_SOCIAL_PRESENCE);
			}

			// 5. Save Social Posts, Email, Poll, and Reward buckets (already fetched in parallel)
			await Promise.all([
				saveBusketData(socialPosts, DATA_BUCKET_SOCIAL_POSTS, PARENT_BUCKET_SOCIAL_POSTS),
				saveBusketData(emailData, DATA_BUCKET_EMAIL, PARENT_BUCKET_EMAIL),
				saveBusketData(pollData, DATA_BUCKET_POLL, PARENT_BUCKET_POLL),
				saveBusketData(rewardData, DATA_BUCKET_REWARD, PARENT_BUCKET_REWARD)
			]);

			// Send success response
			finalResponse = {
				'data': {
					"status": STATUS_SUCCESS,
					"message": "Bucket data saved successfully.",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	};

}
module.exports = new aboutMyBusiness();