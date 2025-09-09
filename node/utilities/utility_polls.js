const async = require('async');

/**
 * Function is used to create a new poll question and options.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
createPollsQuestionAndOptions = async (req, res) => {
	let userId = req.body.user_id || '';
	let pollSlug = req.body.poll_slug || '';
	let question = req.body.question || '';
	let questionMedia = (req.files && req.files.question_media) ? req.files.question_media : "";
	let questionVideo = (req.files && req.files.question_video) ? req.files.question_video : "";
	let thumbnailBannerVideoImage = (req.files && req.files.thumbnail_banner_video_image) ? req.files.thumbnail_banner_video_image : "";
	let oldQuestionMedia = req.body.old_question_media || '';
	let oldQuestionVideo = req.body.old_question_video || '';

	let optionsType = req.body.options_type || '';
	let pollOptionsImage = (req.files && req.files.options_image) ? req.files.options_image : "";
	let pollOptionsVideo = (req.files && req.files.options_video) ? req.files.options_video : "";
	let thumbnailOptionVideoImage = (req.files && req.files.thumbnail_option_video_image) ? req.files.thumbnail_option_video_image : "";
	let pollOptionsTitle = req.body.options_title || '';
	let isQuestionUpdatte = req.body.is_question_updatte ? JSON.parse(req.body.is_question_updatte) : false;
	let singleOptionSubmittedType = req.body.single_option_submitted_type || "";
	let allOptionTitleArray = req.body.all_option_title || [];

	let videoActive = !!questionVideo;
	let videoOptionsActive = !!pollOptionsVideo;
	let videThumbnailImageName = "";
	let optionsVideThumbnailImageName = "";
	let errMessage = [];

	// Validate video mimetype for question
	if (videoActive) {
		videoActive = (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(questionVideo.mimetype) == -1) ? true : false;
	}
	// Validate video mimetype for options
	if (videoOptionsActive) {
		videoOptionsActive = (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(pollOptionsVideo.mimetype) == -1) ? true : false;
	}

	// Validate options media
	if (
		singleOptionSubmittedType != SINGLE_OPTION_SUBMITTED_TYPE &&
		isQuestionUpdatte == false &&
		optionsType == MEDIA_POLL &&
		(pollOptionsVideo == '' && pollOptionsImage == '')
	) {
		errMessage.push({ 'param': 'options_image', 'msg': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE });
		return {
			status: STATUS_ERROR,
			front_status: STATUS_ERROR_FORM_VALIDATION,
			message: errMessage
		};
	}

	// Prepare upload options for question and options
	let optionsQuestion = {
		'image': (videoActive) ? questionVideo : questionMedia,
		'filePath': POLLS_FILE_PATH,
		'oldPath': oldQuestionMedia,
		'oldVideoPath': oldQuestionVideo,
		'allowedExtensions': (videoActive) ? ALLOWED_VIDEO_EXTENSIONS : "",
		'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
		'allowedMimeTypes': (videoActive) ? ALLOWED_VIDEO_MIME_EXTENSIONS : "",
		'allowedMimeError': (videoActive) ? ALLOWED_VIDEO_MIME_ERROR_MESSAGE : "",
		'allowedSizeErrorMessage': (videoActive) ? ALLOWED_VIDEO_SIZE_MESSAGE : "",
		'size': (videoActive) ? ALLOWED_VIDEO_SIZE : "",
	};

	let options = {
		'image': (videoOptionsActive) ? pollOptionsVideo : pollOptionsImage,
		'filePath': POLLS_FILE_PATH,
		'allowedExtensions': (videoOptionsActive) ? ALLOWED_VIDEO_EXTENSIONS : "",
		'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
		'allowedMimeTypes': (videoOptionsActive) ? ALLOWED_VIDEO_MIME_EXTENSIONS : "",
		'allowedMimeError': (videoOptionsActive) ? ALLOWED_VIDEO_MIME_ERROR_MESSAGE : "",
		'allowedSizeErrorMessage': (videoOptionsActive) ? ALLOWED_VIDEO_SIZE_MESSAGE : "",
		'size': (videoOptionsActive) ? ALLOWED_VIDEO_SIZE : "",
	};

	try {
		// Upload question media
		const imageQuestionResponse = await moveUploadedFile(req, res, optionsQuestion);
		if (imageQuestionResponse.status == STATUS_ERROR) {
			errMessage.push({ 'param': 'question_media', 'msg': imageQuestionResponse.message });
			return {
				status: STATUS_ERROR,
				front_status: STATUS_ERROR_FORM_VALIDATION,
				message: errMessage
			};
		}

		// Upload options media
		const imageOptionsResponse = await moveUploadedFile(req, res, options);
		if (imageOptionsResponse.status == STATUS_ERROR) {
			errMessage.push({ 'param': 'options_image', 'msg': imageOptionsResponse.message });
			return {
				status: STATUS_ERROR,
				front_status: STATUS_ERROR_FORM_VALIDATION,
				message: errMessage
			};
		}

		// Prepare filenames and extensions
		let questionMediaName = imageQuestionResponse.fileName || "";
		let optionsFileName = imageOptionsResponse.fileName || "";
		let questionMediaExtension = questionMediaName ? questionMediaName.slice((questionMediaName.lastIndexOf('.')) + 1) : "";

		// If video, upload thumbnail for question
		if (videoActive) {
			let thumbnailBannerImage = {
				'image': thumbnailBannerVideoImage,
				'filePath': POLLS_FILE_PATH,
			};
			const thumbnailBannerResponse = await moveUploadedFile(req, res, thumbnailBannerImage);
			videThumbnailImageName = (thumbnailBannerResponse.fileName) ? thumbnailBannerResponse.fileName : "";
		}

		// Prepare update data for poll
		let updateData = {
			'question_media': (videoActive) ? videThumbnailImageName : questionMediaName,
		};

		if (question) updateData['question'] = question;
		if (optionsType) updateData['options_type'] = optionsType;
		if (videoActive) updateData['question_video_name'] = questionMediaName;
		if (questionMedia && ALLOWED_IMAGE_EXTENSIONS.indexOf(questionMediaExtension) !== -1) {
			updateData['question_video_name'] = "";
		}
		if (questionMedia || questionVideo) {
			updateData['question_extension'] = questionMediaExtension;
		}

		// If video, upload thumbnail for options
		let optionsMediaExtension = optionsFileName ? optionsFileName.slice((optionsFileName.lastIndexOf('.')) + 1) : "";
		if (videoOptionsActive) {
			let thumbnailOptionsImage = {
				'image': thumbnailOptionVideoImage,
				'filePath': POLLS_FILE_PATH,
			};
			const thumbnailOptionsResponse = await moveUploadedFile(req, res, thumbnailOptionsImage);
			optionsVideThumbnailImageName = (thumbnailOptionsResponse.fileName) ? thumbnailOptionsResponse.fileName : "";
		}

		const polls = db.collection(TABLE_POLLS);

		// If only updating question media
		if (isQuestionUpdatte) {
			// Update poll with new question media
			await polls.updateOne(
				{ 'slug': pollSlug, 'user_id': userId },
				{ $set: updateData },
				{ upsert: true }
			);
			return {
				status: STATUS_SUCCESS,
				slug: pollSlug,
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		}

		// Otherwise, create or update poll with options
		let slugOptions = {
			title: question,
			table_name: TABLE_POLLS,
			slug_field: "slug"
		};

		// Generate slug for poll
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Find poll to get current options and hashtag
		const resultPollData = await polls.findOne(
			{ 'slug': pollSlug, 'user_id': userId },
			{ projection: { 'options': 1, "hashtag": 1, "single_option_submitted_type": 1 } }
		);

		let oldOptionData = (resultPollData && resultPollData.options) ? resultPollData.options : [];
		let alreadyHashtag = (resultPollData && resultPollData.hashtag) ? resultPollData.hashtag : "";
		let dbSingleOptionSubmittedType = (resultPollData && resultPollData.single_option_submitted_type) ? resultPollData.single_option_submitted_type : "";
		let hashtag = alreadyHashtag + " #" + (pollOptionsTitle.replace(/\s+/g, '-')).toLowerCase();

		// Prepare new option data
		let newOptionsData = {
			"_id": newObjectIdDefault(),
			"title": pollOptionsTitle,
			'image': (videoOptionsActive) ? optionsVideThumbnailImageName : optionsFileName,
			'video': (videoOptionsActive) ? optionsFileName : "",
			'extension': optionsMediaExtension,
			'cta_title': "",
			'cta_url': "",
			'assign_reward': "",
			'enticement_headline': "",
			'total_count': 0,
			'percentage': 0,
			'type': POLL_DECIDED_OPTIONS,
			'created': getUtcDate(),
		};

		// If single option submitted type
		if (dbSingleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE) {
			let undecidedOptions = oldOptionData.find(o => o.type === POLL_UNDECIDED_OPTIONS);
			let singleOptionsUpdateData = [];
			if (undecidedOptions && Object.keys(undecidedOptions).length > 0) {
				// Remove undecided from end, push new, then undecided
				oldOptionData.length = oldOptionData.length - 1;
				oldOptionData.push(newOptionsData);
				oldOptionData.push(undecidedOptions);
				singleOptionsUpdateData = oldOptionData;
			} else {
				oldOptionData.push(newOptionsData);
				singleOptionsUpdateData = oldOptionData;
			}

			if (hashtag) updateData['hashtag'] = hashtag.trim();

			let updateOneOptionsData = {
				'options': singleOptionsUpdateData
			};
			if (hashtag) updateOneOptionsData['hashtag'] = hashtag.trim();

			// Update poll with new options (single option mode)
			await polls.updateOne(
				{ 'slug': pollSlug, 'user_id': userId },
				{ $set: updateOneOptionsData },
				{ upsert: true }
			);
			return {
				status: STATUS_SUCCESS,
				slug: pollSlug ? pollSlug : (slugResponse && slugResponse.title) ? slugResponse.title : "",
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		} else {
			// Multi-option mode
			oldOptionData.push(newOptionsData);

			if (oldOptionData.length > 0) updateData['options'] = oldOptionData;
			if (hashtag) updateData['hashtag'] = hashtag.trim();

			// Insert or update poll with new options and setOnInsert fields
			await polls.updateOne(
				{ 'slug': pollSlug, 'user_id': userId },
				{
					$set: updateData,
					$setOnInsert: {
						'user_id': userId,
						'is_published': POLL_NOT_PUBLISHED,
						'is_draft': POLL_DRAFT,
						"is_deleted": NOT_DELETED,
						'total_count': 0,
						'real_time': true,
						'custom_url': (slugResponse && slugResponse.title) ? slugResponse.title : "",
						'type': SINGLE_POLL_TYPE,
						'single_option_submitted_type': "",
						'end_voting_period': false,
						'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
						'created': getUtcDate(),
					}
				},
				{ upsert: true }
			);

			// If allOptionTitleArray is provided, update all options text in parallel
			if (pollSlug && allOptionTitleArray.length > 0) {
				// This function can be awaited if it returns a promise, or run in background
				updateAllOptionsTextArrayAccourding(pollSlug, userId, allOptionTitleArray);
			}

			return {
				status: STATUS_SUCCESS,
				slug: pollSlug ? pollSlug : (slugResponse && slugResponse.title) ? slugResponse.title : "",
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		}
	} catch (err) {
		// Catch any unexpected errors and return error response
		return {
			status: STATUS_ERROR,
			front_status: STATUS_ERROR_FORM_VALIDATION,
			message: [{ param: 'server', msg: err.message || "An error occurred while processing the poll." }]
		};
	}
};

/**
 * Saves the next functionality for a single poll using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} optionData - The option data object.
 * 
 * @returns {Promise<Object>} A promise that resolves with the result of the operation.
 */
singlePollSaveNextFunctionalitySave = async (req, res, optionData) => {
	try {
		const pollSlug = optionData.poll_slug ? optionData.poll_slug : "";
		const userId = optionData.user_id ? newObjectIdDefault(optionData.user_id) : "";

		// Validate required fields
		if (!pollSlug || !userId) {
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}

		const polls = db.collection(TABLE_POLLS);

		// Find the poll with the given slug and user, and correct options type
		const resultPollData = await polls.findOne(
			{
				'slug': pollSlug,
				'user_id': userId,
				'options_type': MEDIA_POLL,
				'single_option_submitted_type': { $ne: SINGLE_OPTION_SUBMITTED_TYPE },
			},
			{ projection: { 'options': 1, 'hashtag': 1 } }
		);

		if (resultPollData) {
			const alreadyHashtag = resultPollData.hashtag || "";
			const oldOptionData = (resultPollData.options && resultPollData.options[0]) ? resultPollData.options[0] : {};
			const undecidedOptionData = (resultPollData.options && resultPollData.options[1]) ? resultPollData.options[1] : {};
			const hashtag = `${alreadyHashtag} #yes #no #undecided`;

			// Prepare new options array
			const newOptions = [
				oldOptionData,
				{
					"_id": newObjectIdDefault(),
					"title": POLL_YES_OPTIONS,
					"image": "",
					"video": "",
					"extension": "",
					"cta_title": "",
					"cta_url": "",
					"assign_reward": "",
					"enticement_headline": "",
					"total_count": 0,
					"percentage": 0,
					"type": POLL_DECIDED_OPTIONS,
					"created": getUtcDate(),
				},
				{
					"_id": newObjectIdDefault(),
					"title": POLL_NO_OPTIONS,
					"image": "",
					"video": "",
					"extension": "",
					"cta_title": "",
					"cta_url": "",
					"assign_reward": "",
					"enticement_headline": "",
					"total_count": 0,
					"percentage": 0,
					"type": POLL_DECIDED_OPTIONS,
					"created": getUtcDate(),
				},
				undecidedOptionData
			];

			// Update poll with new options and hashtag
			await polls.updateOne(
				{
					'slug': pollSlug,
					'user_id': userId,
				},
				{
					$set: {
						'options': newOptions,
						"single_option_submitted_type": SINGLE_OPTION_SUBMITTED_TYPE,
						"hashtag": hashtag
					}
				},
				{ upsert: true }
			);

			// Return success message
			return {
				status: STATUS_SUCCESS,
				result: {},
				message: res.__("front.polls.single_options_wise_option_generate_successfully"),
			};
		} else {
			// No poll found
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.global.no_record_found"),
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			result: {},
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End singlePollSaveNextFunctionalitySave()

/**
 * Creates a new poll with all the provided data using async/await for faster response times.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
createPollsAllData = async (req, res) => {
	try {
		const userId = req.body.user_id ? newObjectIdDefault(req.body.user_id) : '';
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
		const categoryId = req.body.category_id ? newObjectIdDefault(req.body.category_id) : "";
		const hashtag = req.body.hashtag ? req.body.hashtag : "";
		const customUrl = req.body.custom_url ? req.body.custom_url : "";
		const realTime = req.body.real_time ? JSON.parse(req.body.real_time) : false;
		const realTimeResult = (realTime === false) ? req.body.real_time_result : "";

		let ctaTitle = req.body.cta_title ? req.body.cta_title : "";
		ctaTitle = (ctaTitle && typeof ctaTitle === 'string') ? JSON.parse(ctaTitle) : ctaTitle;

		let ctaUrl = req.body.cta_url ? req.body.cta_url : "";
		ctaUrl = (ctaUrl && typeof ctaUrl === 'string') ? JSON.parse(ctaUrl) : ctaUrl;

		let assignReward = req.body.assign_reward ? req.body.assign_reward : "";
		assignReward = (assignReward && typeof assignReward === 'string') ? JSON.parse(assignReward) : assignReward;

		let enticementHeadline = req.body.enticement_headline ? req.body.enticement_headline : "";
		enticementHeadline = (enticementHeadline && typeof enticementHeadline === 'string') ? JSON.parse(enticementHeadline) : enticementHeadline;

		const addContext = req.body.add_context ? req.body.add_context : "";
		const isDraft = req.body.is_draft ? req.body.is_draft : "";
		const isPublished = req.body.is_published ? req.body.is_published : "";
		const question = req.body.question ? req.body.question : '';
		const sponsoredText = req.body.sponsored_text ? req.body.sponsored_text : '';
		const sponsoredLogo = req.body.sponsored_logo ? req.body.sponsored_logo : '';
		const sponsoredType = req.body.sponsored_type ? req.body.sponsored_type : '';
		const sponsoredLink = req.body.sponsored_link ? req.body.sponsored_link : '';
		const singleOptionSubmittedType = req.body.single_option_submitted_type ? req.body.single_option_submitted_type : '';
		const scheduleStartDate = req.body.schedule_start_date ? req.body.schedule_start_date : '';
		const scheduleEndDate = req.body.schedule_end_date ? req.body.schedule_end_date : '';
		const scheduleEndDateType = req.body.schedule_end_date_type ? req.body.schedule_end_date_type : '';
		const allOptionTitleArray = req.body.all_option_title ? req.body.all_option_title : [];

		let updateData = {
			'category_id': categoryId,
			'hashtag': hashtag,
			'custom_url': customUrl,
			'real_time': realTime,
			'real_time_result': realTimeResult,
			'add_context': addContext,
			'is_draft': isDraft,
			'is_published': isPublished,
			'sponsored_type': sponsoredType,
			'sponsored_text': (sponsoredType == SPONSORED_TEXT) ? sponsoredText : "",
			'sponsored_logo': (sponsoredType == SPONSORED_LOGO) ? sponsoredLogo : "",
			'sponsored_link': sponsoredLink,
			"schedule_end_date_type": scheduleEndDateType,
			'schedule_start_date': (scheduleStartDate) ? newDate(scheduleStartDate) : "",
			'schedule_end_date': (scheduleEndDateType == SCHEDULE_END_DATE_ON) ? newDate(scheduleEndDate) : "",
		};

		// Add CTA links to options
		if (ctaTitle && ctaTitle.length > 0) {
			for (let index = 0; index < ctaTitle.length; index++) {
				if (singleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE && index == 0) {
					updateData[`options.${index}.cta_title`] = "";
					updateData[`options.${index}.cta_url`] = "";
				} else {
					updateData[`options.${index}.cta_title`] = ctaTitle[index] ? ctaTitle[index].trim() : "";
					updateData[`options.${index}.cta_url`] = (ctaUrl && ctaUrl[index]) ? ctaUrl[index].trim() : "";
				}
			}
		}

		// Attach reward and enticement headline to options
		if (assignReward && assignReward.length > 0) {
			for (let index = 0; index < assignReward.length; index++) {
				if (singleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE && index == 0) {
					updateData[`options.${index}.assign_reward`] = "";
					updateData[`options.${index}.enticement_headline`] = "";
				} else {
					updateData[`options.${index}.assign_reward`] = (assignReward && assignReward[index]) ? newObjectIdDefault(assignReward[index]) : "";
					updateData[`options.${index}.enticement_headline`] = (enticementHeadline && enticementHeadline[index]) ? enticementHeadline[index].trim() : "";
				}
			}
		}

		// Update question if provided
		if (question) {
			updateData['question'] = question;
		}

		// Update all options text if provided
		if (allOptionTitleArray.length > 0) {
			// If this function is async, await it; otherwise, let it run
			const updateOptionsPromise = updateAllOptionsTextArrayAccourding(pollSlug, userId, allOptionTitleArray);
			if (updateOptionsPromise instanceof Promise) {
				await updateOptionsPromise;
			}
		}

		const polls = db.collection(TABLE_POLLS);

		// Update poll document with new data
		await polls.updateOne({
			'user_id': userId,
			'slug': pollSlug,
		}, {
			$set: updateData
		}, { upsert: false });

		// Return success message
		return {
			status: STATUS_SUCCESS,
			message: res.__("front.polls.polls_has_been_updated_successfully"),
		};
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End createPollsAllData()

/**
 * Deletes a poll media dynamically using async/await for faster response and cleaner code.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} optionsImageData - The options image data object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
deletePollsMedia = async (req, res, optionsImageData) => {
	try {
		const userId = optionsImageData.user_id ? newObjectIdDefault(optionsImageData.user_id) : "";
		const pollId = optionsImageData.draft_id ? newObjectIdDefault(optionsImageData.draft_id) : "";
		const deleteType = optionsImageData.delete_type ? optionsImageData.delete_type : "";

		const polls = db.collection(TABLE_POLLS);

		if (!userId || !pollId || !deleteType) {
			return {
				status: STATUS_ERROR,
				poll_slug: "",
				message: res.__("front.polls.media_has_been_not_deleted"),
			};
		}

		// Fetch poll data
		const pollData = await polls.findOne({ _id: pollId }, { projection: { options: 1, slug: 1, question_media: 1, question_video_name: 1, sponsored_logo: 1 } });

		if (!pollData) {
			return {
				status: STATUS_ERROR,
				poll_slug: "",
				message: res.__("front.polls.media_has_been_not_deleted"),
			};
		}

		// Handle banner media deletion
		if (deleteType === BANNER_POLLS_DELETE) {
			const imagesData = {
				file_path: POLLS_FILE_PATH + (pollData.question_media || "")
			};
			const imagesDataVideo = {
				file_path: POLLS_FILE_PATH + (pollData.question_video_name || "")
			};

			// Remove both media files in parallel
			await Promise.all([
				removeFile(imagesDataVideo),
				removeFile(imagesData)
			]);

			// Update poll document to clear media fields
			await polls.updateOne({
				_id: pollId, user_id: userId
			}, {
				$set: {
					question_media: "",
					question_video_name: "",
					question_extension: "",
					modified: getUtcDate()
				}
			});

			return {
				status: STATUS_SUCCESS,
				poll_slug: pollData.slug,
				message: res.__("front.polls.media_has_been_delete_successfully"),
			};
		}

		// Handle options media deletion
		if (deleteType === OPTIONS_POLLS_DELETE) {
			const draftOptionsId = optionsImageData.draft_options_id ? newObjectIdDefault(optionsImageData.draft_options_id) : "";
			const pollDataOptions = Array.isArray(pollData.options) ? pollData.options : [];
			const findDataOptions = pollDataOptions.find(
				element => element._id && element._id.toString() === draftOptionsId.toString()
			);

			if (!findDataOptions) {
				return {
					status: STATUS_ERROR,
					poll_slug: pollData.slug,
					message: res.__("front.polls.media_has_been_not_deleted"),
				};
			}

			const imagesData = {
				file_path: POLLS_FILE_PATH + (findDataOptions.image || "")
			};
			const videoData = {
				file_path: POLLS_FILE_PATH + (findDataOptions.video || "")
			};

			// Remove both media files in parallel
			await Promise.all([
				removeFile(videoData),
				removeFile(imagesData)
			]);

			// Remove the option from the poll
			await polls.updateOne({ _id: pollId, user_id: userId }, { $pull: { options: { _id: draftOptionsId } } });

			return {
				status: STATUS_SUCCESS,
				poll_slug: pollData.slug,
				message: res.__("front.polls.media_has_been_delete_successfully"),
			};
		}

		// Handle sponsored logo deletion
		if (deleteType === SPONSORED_POLLS_DELETE) {
			const imagesSponsoredData = {
				file_path: POLLS_FILE_PATH + (pollData.sponsored_logo || "")
			};

			// Remove sponsored logo
			await removeFile(imagesSponsoredData);

			// Update poll document to clear sponsored fields
			await polls.updateOne({
				_id: pollId, user_id: userId
			}, {
				$set: {
					sponsored_logo: "",
					sponsored_link: "",
					sponsored_text: "",
					sponsored_type: "",
					modified: getUtcDate()
				}
			});

			return {
				status: STATUS_SUCCESS,
				poll_slug: pollData.slug,
				message: res.__("front.polls.sponsored_has_been_delete_successfully"),
			};
		}

		// If deleteType is not recognized
		return {
			status: STATUS_ERROR,
			poll_slug: pollData.slug,
			message: res.__("front.polls.media_has_been_not_deleted"),
		};
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			poll_slug: "",
			message: res.__("front.polls.media_has_been_not_deleted"),
			error: err && err.message ? err.message : err
		};
	}
}; // End deletePollsMedia()

/**
 * Deletes all poll options using async/await for faster response times.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {String} pollId - The ID of the poll.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
deleteAllPollsOptions = async (req, res, pollId) => {
	try {
		// Validate pollId
		if (!pollId) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}

		const polls = db.collection(TABLE_POLLS);
		const optionsType = req.body.options_type ? req.body.options_type : '';

		// Update poll document to remove all options and reset related fields
		await polls.updateOne(
			{ "_id": pollId },
			{
				$set: {
					"is_published": POLL_NOT_PUBLISHED,
					"options_type": optionsType,
					"single_option_submitted_type": "",
				}
			}
		);

		// Return success response
		return {
			status: STATUS_SUCCESS,
			message: res.__("front.polls.options_has_been_delete_successfully")
		};
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End deleteAllPollsOptions()

/**
 * Deletes and updates the status of a poll using async/await for faster response times.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} sendDataOptions - The send data options object.
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
deleteAndStatusUpdate = async (req, res, sendDataOptions) => {
	try {
		const pollId = sendDataOptions.poll_id ? sendDataOptions.poll_id : '';
		const statusType = sendDataOptions.status_type ? sendDataOptions.status_type : '';
		const recordStatus = sendDataOptions.record_status ? sendDataOptions.record_status : '';
		const userId = sendDataOptions.user_id ? newObjectIdDefault(sendDataOptions.user_id) : '';
		let updateData = {};

		if (!pollId || !statusType) {
			// Send error response for invalid access
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}

		// Handle published / not published status
		if (statusType == PUBLISHED_NOTPUBLISHED_STATUS) {
			updateData['is_published'] = (recordStatus == POLL_PUBLISHED) ? POLL_NOT_PUBLISHED : POLL_PUBLISHED;
			updateData['is_draft'] = (recordStatus == POLL_PUBLISHED) ? POLL_DRAFT : POLL_NOT_DRAFTS;
			updateData['modified'] = getUtcDate();
		}

		// Handle deleted status
		if (statusType == DELETE_STATUS) {
			updateData['is_deleted'] = DELETED;
			updateData['modified'] = getUtcDate();
		}

		const collection = db.collection(TABLE_POLLS);
		const pollReportAbuse = db.collection(TABLE_POLL_REPORT_ABUSE);

		// Update poll status
		await collection.updateOne({ "_id": newObjectIdDefault(pollId), "user_id": userId }, { $set: updateData });

		if (statusType == PUBLISHED_NOTPUBLISHED_STATUS) {
			// Send success response for publish/unpublish
			const messageStatus = (recordStatus == POLL_PUBLISHED) ? res.__("front.polls.poll_has_been_not_published") : res.__("front.polls.poll_has_been_published_successfully");

			return {
				status: STATUS_SUCCESS,
				message: messageStatus
			};
		} else if (statusType == DELETE_STATUS) {
			// Delete reports after deleting poll
			await pollReportAbuse.updateMany({ "poll_id": newObjectIdDefault(pollId) }, { $set: updateData });

			return {
				status: STATUS_SUCCESS,
				message: res.__("front.polls.polls_has_been_deleted_successfully")
			};
		} else {
			// Send error response for invalid access
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End deleteAndStatusUpdate()

/**
 * Asynchronously increments the like count for a poll comment.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {String} commentId - The ID of the comment to like.
 * @returns {Promise<Object>} - The result of the update operation.
 */
userPollCommentLike = async (commentId) => {
	try {
		const pollComment = db.collection(TABLE_POLLS_COMMENTS);
		// Increment the is_like field by 1 for the specified comment
		const result = await pollComment.updateOne({ _id: newObjectIdDefault(commentId) }, { $inc: { is_like: 1 } });
		return result;
	} catch (err) {
		// Handle unexpected errors
		return { error: err && err.message ? err.message : err };
	}
}; // End userPollCommentLike()

/**
 * Asynchronously increments the dislike count for a poll comment.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {String} commentId - The ID of the comment to dislike.
 * @returns {Promise<Object>} - The result of the update operation.
 */
userPollCommentDislike = async (commentId) => {
	try {
		const pollComment = db.collection(TABLE_POLLS_COMMENTS);
		// Increment the is_dislike field by 1 for the specified comment
		const result = await pollComment.updateOne({ _id: newObjectIdDefault(commentId) }, { $inc: { is_dislike: 1 } });
		return result;
	} catch (err) {
		// Handle unexpected errors
		return { error: err && err.message ? err.message : err };
	}
}; // End userPollCommentDislike()

/**
 * Asynchronously decreases the like count for a poll comment.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {String} commentId - The ID of the comment to decrease like.
 * @returns {Promise<Object>} - The result of the update operation.
 */
userDecreasePollCommentLike = async (commentId) => {
	try {
		const pollComment = db.collection(TABLE_POLLS_COMMENTS);
		// Decrease the is_like field by 1 for the specified comment, only if is_like > 0
		const result = await pollComment.updateOne({ _id: newObjectIdDefault(commentId), is_like: { $gt: 0 } }, { $inc: { is_like: -1 } });

		return result;
	} catch (err) {
		// Handle unexpected errors
		return { error: err && err.message ? err.message : err };
	}
}; // End userDecreasePollCommentLike()

/**
 * Asynchronously decreases the dislike count for a poll comment.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {String} commentId - The ID of the comment to decrease dislike.
 * @returns {Promise<Object>} - The result of the update operation.
 */
userDecreasePollCommentDislike = async (commentId) => {
	try {
		const pollComment = db.collection(TABLE_POLLS_COMMENTS);
		// Decrease the is_dislike field by 1 for the specified comment, only if is_dislike > 0
		const result = await pollComment.updateOne({ _id: newObjectIdDefault(commentId), is_dislike: { $gt: 0 } }, { $inc: { is_dislike: -1 } });
		return result;
	} catch (err) {
		// Handle unexpected errors
		return { error: err && err.message ? err.message : err };
	}
}; // End userDecreasePollCommentDislike()

/**
 * Asynchronously deletes a poll comment and its related child comments and abuse reports.
 * Uses async/await for faster response times and cleaner code.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} deleteOptions - Options containing comment_id and make_poll_user_id.
 * @returns {Promise<Object>} - The result of the delete operation.
 */
userCommentDelete = async (req, res, deleteOptions) => {
	try {
		const commentId = deleteOptions.comment_id ? newObjectIdDefault(deleteOptions.comment_id) : "";
		const userId = deleteOptions.make_poll_user_id ? newObjectIdDefault(deleteOptions.make_poll_user_id) : "";

		if (!commentId) {
			// Invalid access if commentId is not provided
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}

		const pollComment = db.collection(TABLE_POLLS_COMMENTS);
		const pollCommentReportAbuse = db.collection(TABLE_POLL_COMMENT_REPORT_ABUSE);

		// Build the condition for deleting the comment
		let conditionCommnet = { '_id': commentId };
		if (userId) {
			conditionCommnet = {
				'_id': commentId,
				$or: [
					{ 'make_poll_user_id': userId },
					{ 'user_id': userId },
				]
			};
		}

		// Mark the main comment as deleted
		await pollComment.updateOne(conditionCommnet, { $set: { 'is_deleted': DELETED } });

		// Mark all child comments as deleted (run in parallel)
		const childDeletePromise = pollComment.updateMany({ 'parent_id': commentId }, { $set: { 'is_deleted': DELETED } });

		// Mark all related abuse reports as deleted (run in parallel)
		const abuseDeletePromise = pollCommentReportAbuse.updateMany({ 'comment_id': commentId }, { $set: { 'is_deleted': DELETED } });

		// Wait for both child and abuse report deletions to complete
		await Promise.all([childDeletePromise, abuseDeletePromise]);

		// Return success response
		return {
			status: STATUS_SUCCESS,
			message: res.__("admin.polls.comment_has_been_delete_successfully")
		};
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End userCommentDelete()

/**
 * Total count of poll votes for a user.
 * Increments the vote count for the poll and the selected option,
 * then recalculates and updates the percentage for all options.
 * Uses async/await for faster response times and cleaner code.
 *
 * @param {Object} optionsCountData - Contains poll_id and option_id.
 * @returns {Promise<void>}
 */
totalCountPollVote = async (optionsCountData) => {
	const polls = db.collection(TABLE_POLLS);

	const pollId = optionsCountData.poll_id ? newObjectIdDefault(optionsCountData.poll_id) : "";
	const optionId = optionsCountData.option_id ? newObjectIdDefault(optionsCountData.option_id) : "";

	if (!pollId || !optionId) {
		return;
	}

	try {
		// Increment total_count for poll and the selected option
		await polls.updateOne(
			{
				'_id': pollId,
				'options': { $elemMatch: { '_id': optionId } }
			},
			{
				$inc: { 'total_count': 1, "options.$.total_count": 1 }
			}
		);

		// Fetch updated poll data to recalculate percentages
		const pollResult = await polls.findOne({ '_id': pollId }, { projection: { 'options': 1, 'total_count': 1 } });

		if (!pollResult || !pollResult.options || typeof pollResult.total_count !== "number") {
			return;
		}

		const totalPollCount = pollResult.total_count;
		const pollOptionResult = pollResult.options;

		// Prepare all update promises for options percentage in parallel
		const updatePromises = pollOptionResult.map(itemRecords => {
			const pollOptionIds = itemRecords._id;
			const totalOptionsCount = itemRecords.total_count || 0;
			const percentage = calculatePercentage(totalOptionsCount, totalPollCount);

			// Update percentage for each option
			return polls.updateOne(
				{
					'_id': pollId,
					'options': { $elemMatch: { '_id': pollOptionIds } }
				},
				{
					$set: { 'options.$.percentage': percentage }
				}
			);
		});

		// Wait for all percentage updates to complete in parallel
		await Promise.all(updatePromises);

	} catch (err) {
		// Optionally log error or handle as needed
		return;
	}
}; // End totalCountPollVote()

/**
 * Sends a notification when a user likes a comment on a poll.
 * Uses async/await for database queries for faster response times.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} loginUserData - The logged-in user's data.
 * @param {String|ObjectId} commentId - The ID of the comment being liked.
 * @returns {Promise<void>}
 */
sendLikeNotifications = async (req, res, loginUserData, commentId) => {
	const commentCollection = db.collection(TABLE_POLLS_COMMENTS);
	const usersCollection = db.collection(TABLE_USERS);

	let pollSlug = req.body.poll_slug ? req.body.poll_slug : "";
	commentId = newObjectIdDefault(commentId);

	try {
		// Fetch comment data
		const commentResult = await commentCollection.findOne({ _id: commentId }, { projection: { _id: 1, comment: 1, user_id: 1 } });

		if (!commentResult) { return; }

		const loginUserId = loginUserData._id;
		const loginUserName = loginUserData.full_name;
		const commentUserId = commentResult.user_id;
		const commentText = commentResult.comment;

		// Do not send notification if user likes their own comment
		if (loginUserId.equals(commentUserId)) {
			return;
		}

		// Fetch the user who created the comment
		const userResult = await usersCollection.findOne({ _id: newObjectIdDefault(commentUserId) }, { projection: { _id: 1, full_name: 1 } });

		if (!userResult) {
			// User not found, nothing to do
			return;
		}

		const createdCommentUserId = userResult._id;
		const createdCommentFullname = userResult.full_name;

		const notificationMessageParams = [createdCommentFullname, loginUserName, commentText];
		const notificationOptions = {
			notification_data: {
				notification_type: NOTIFICATION_SEND_LIKE_COMMENTS,
				message_params: notificationMessageParams,
				parent_table_id: createdCommentUserId,
				user_id: createdCommentUserId,
				user_ids: [createdCommentUserId],
				user_role_id: FRONT_ADMIN_ROLE_ID,
				role_id: FRONT_ADMIN_ROLE_ID,
				extra_parameters: {
					'user_id': newObjectIdDefault(createdCommentUserId),
					'poll_slug': pollSlug,
					'comment_id': newObjectIdDefault(commentId),
				}
			}
		};

		// Insert notification (assumed to be async, but not awaited for fire-and-forget)
		insertNotifications(req, res, notificationOptions);

	} catch (err) {
		// Optionally log error or handle as needed
		return;
	}
}; // End sendLikeNotifications()

/**
 * Saves the poll set data using async/await for faster response and cleaner code.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} pollsetsOptions - The poll set options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
savePollsetData = async (req, res, pollsetsOptions) => {
	try {
		const userId = pollsetsOptions.user_id ? pollsetsOptions.user_id : "";
		const pollSlugs = pollsetsOptions.poll_slug ? pollsetsOptions.poll_slug : [];
		const title = pollsetsOptions.title ? pollsetsOptions.title : "";
		const categoryId = pollsetsOptions.category_id ? newObjectIdDefault(pollsetsOptions.category_id) : "";
		const description = pollsetsOptions.description ? pollsetsOptions.description : "";
		const rewardDescription = pollsetsOptions.reward_description ? pollsetsOptions.reward_description : "";
		const showTo = pollsetsOptions.show_to ? pollsetsOptions.show_to : SHOW_TO_PUBLIC;
		const allowRetaking = pollsetsOptions.allow_retaking ? pollsetsOptions.allow_retaking : ALLOW_RETAKING_YES;
		const sso = pollsetsOptions.sso ? pollsetsOptions.sso : SSO_NO;
		const sponsoringLogo = pollsetsOptions.sponsoring_logo ? pollsetsOptions.sponsoring_logo : "";

		const pollsets = db.collection(TABLE_POLL_SETS);
		const polls = db.collection(TABLE_POLLS);

		// Aggregate to get poll IDs and custom URLs for the given slugs, published, and owned by user
		const pollResult = await polls.aggregate([
			{
				$match: {
					"slug": { $in: pollSlugs },
					"is_published": POLL_PUBLISHED,
					"user_id": userId
				}
			},
			{
				"$group": {
					"_id": null,
					"poll_ids": { $addToSet: '$_id' },
					"custom_urls": { $addToSet: '$custom_url' },
				}
			}
		]).toArray();

		if (pollResult.length > 0 && pollResult[0]['poll_ids'].length === pollSlugs.length) {
			// Generate slug for poll set
			const slugOptions = {
				title: title,
				table_name: TABLE_POLL_SETS,
				slug_field: "slug"
			};
			const slugResponse = await getDatabaseSlug(slugOptions);

			// Insert poll set document
			await pollsets.insertOne({
				'user_id': userId,
				'poll_slug': pollSlugs,
				'poll_ids': pollResult[0]['poll_ids'],
				'custom_urls': pollResult[0]['custom_urls'],
				'title': title,
				'category_id': categoryId,
				'description': description,
				'reward_description': rewardDescription,
				'show_to': showTo,
				'allow_retaking': allowRetaking,
				'sso': sso,
				'sponsoring_logo': sponsoringLogo,
				'type': POLL_SETS_POLL_TYPE,
				"slug": (slugResponse && slugResponse.title) ? slugResponse.title : "",
				'is_deleted': NOT_DELETED,
				'is_published': POLL_PUBLISHED,
				'modified': getUtcDate(),
				'created': getUtcDate(),
			});

			// Return success message
			return {
				status: STATUS_SUCCESS,
				message: res.__("front.poll_set.poll_set_has_been_added_successfully"),
			};
		} else if (pollResult.length > 0) {
			// Not all selected polls are published
			return {
				status: STATUS_ERROR,
				message: res.__("front.polls.please_select_published_poll"),
			};
		} else {
			// Something went wrong or no polls found
			return {
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End savePollsetData()

/**
 * Deletes a poll set using async/await for faster response and cleaner code.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} sendData - The send data object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
deletePollSets = async (req, res, sendData) => {
	try {
		const statusType = sendData.status_type ? sendData.status_type : '';
		const recordStatus = sendData.record_status ? sendData.record_status : '';
		const pollSetSlug = sendData.slug ? sendData.slug : '';
		let updateData = {};

		if (!statusType || !pollSetSlug) {
			// Invalid access, missing required parameters
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}

		// Handle publish/unpublish status
		if (statusType === PUBLISHED_NOTPUBLISHED_STATUS) {
			updateData['is_published'] = (recordStatus == POLL_PUBLISHED) ? POLL_NOT_PUBLISHED : POLL_PUBLISHED;
			updateData['modified'] = getUtcDate();
		}

		// Handle delete status
		if (statusType === DELETE_STATUS) {
			updateData['is_deleted'] = DELETED;
			updateData['modified'] = getUtcDate();
		}

		const pollsets = db.collection(TABLE_POLL_SETS);

		// Update poll set document
		const resultDelete = await pollsets.updateOne(
			{ "slug": pollSetSlug },
			{ $set: updateData }
		);

		if (resultDelete && resultDelete.modifiedCount > 0) {
			let messageStatus = (recordStatus == POLL_PUBLISHED)
				? res.__("front.polls.pollset_has_been_not_published")
				: res.__("front.polls.pollset_has_been_published_successfully");

			if (statusType === PUBLISHED_NOTPUBLISHED_STATUS) {
				// Send success response for publish/unpublish
				return {
					status: STATUS_SUCCESS,
					message: messageStatus
				};
			} else {
				// Send success response for delete
				return {
					status: STATUS_SUCCESS,
					message: res.__("front.poll_set.poll_set_delete_successfully")
				};
			}
		} else {
			// Update failed or nothing was modified
			return {
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again")
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End deletePollSets()

/**
 * Updates the poll set data using async/await for faster response and cleaner code.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} pollsetsOptions - The poll set options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
updatePollsetData = async (req, res, pollsetsOptions) => {
	try {
		const pollSetSlug = pollsetsOptions.slug ? pollsetsOptions.slug : "";
		const userId = pollsetsOptions.user_id ? pollsetsOptions.user_id : "";
		const pollSlugs = pollsetsOptions.poll_slug ? pollsetsOptions.poll_slug : [];
		const title = pollsetsOptions.title ? pollsetsOptions.title : "";
		const categoryId = pollsetsOptions.category_id ? newObjectIdDefault(pollsetsOptions.category_id) : "";
		const description = pollsetsOptions.description ? pollsetsOptions.description : "";
		const rewardDescription = pollsetsOptions.reward_description ? pollsetsOptions.reward_description : "";
		const showTo = pollsetsOptions.show_to ? pollsetsOptions.show_to : SHOW_TO_PUBLIC;
		const allowRetaking = pollsetsOptions.allow_retaking ? pollsetsOptions.allow_retaking : ALLOW_RETAKING_YES;
		const sso = pollsetsOptions.sso ? pollsetsOptions.sso : SSO_NO;
		const sponsoringLogo = pollsetsOptions.sponsoring_logo ? pollsetsOptions.sponsoring_logo : "";

		const pollsets = db.collection(TABLE_POLL_SETS);
		const polls = db.collection(TABLE_POLLS);

		// Aggregate poll data for the set
		const pollResult = await polls.aggregate([
			{
				$match: {
					"slug": { $in: pollSlugs },
					"is_published": POLL_PUBLISHED,
					"user_id": userId
				}
			},
			{
				"$group": {
					"_id": null,
					"poll_ids": { $addToSet: '$_id' },
					"custom_urls": { $addToSet: '$custom_url' },
				}
			}
		]).toArray();

		if (pollResult && pollResult.length > 0) {
			const updatedData = {
				'user_id': userId,
				'poll_slug': pollSlugs,
				'poll_ids': pollResult[0]['poll_ids'],
				'custom_urls': pollResult[0]['custom_urls'],
				'title': title,
				'category_id': categoryId,
				'description': description,
				'reward_description': rewardDescription,
				'show_to': showTo,
				'allow_retaking': allowRetaking,
				'sso': sso,
				'sponsoring_logo': sponsoringLogo,
				'modified': getUtcDate()
			};

			// Update poll set document
			const resultUpdate = await pollsets.updateOne({ "slug": pollSetSlug }, { $set: updatedData });

			if (resultUpdate && resultUpdate.modifiedCount > 0) {
				// Send success message
				return {
					status: STATUS_SUCCESS,
					message: res.__("front.poll_set.poll_set_has_been_updated_successfully"),
				};
			} else {
				// Send error message if update failed
				return {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				};
			}
		} else {
			// Send error message if aggregation failed or no polls found
			return {
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End updatePollsetData()

/**
 * Edits the title of a poll option using async/await for faster and cleaner response.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} editOptions - The edit options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollOptionTitle = async (req, res, editOptions) => {
	try {
		const userId = editOptions.user_id || "";
		const pollSlug = editOptions.poll_slug || "";
		const optionId = editOptions.option_id || "";
		const optionTitle = editOptions.title || "";

		// Prepare filter for the poll option to update
		const matchData = {
			"slug": pollSlug,
			"user_id": userId,
			"options._id": newObjectIdDefault(optionId)
		};

		// Prepare conditions to check for duplicate option title
		const optionsConditions = {
			'user_id': userId,
			'poll_slug': pollSlug,
			'options_title': optionTitle,
		};

		// Check if the option title already exists
		const user = await samePollsOptionsCheck(req, res, optionsConditions);

		if (user.status === STATUS_SUCCESS) {
			// Option title already exists, return error
			return {
				status: STATUS_ERROR,
				message: res.__("admin.polls.your_options_is_already_exist"),
			};
		}

		// Update the poll option title
		const polls = db.collection(TABLE_POLLS);
		const resultTitle = await polls.updateOne(
			matchData,
			{ $set: { "options.$.title": optionTitle, "is_edited": true } },
			{ upsert: true }
		);

		if (resultTitle && resultTitle.modifiedCount > 0) {
			// Successfully updated
			return {
				status: STATUS_SUCCESS,
				message: res.__("front.polls.poll_options_title_has_been_updated_successfully"),
			};
		} else {
			// Update failed
			return {
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err && err.message ? err.message : err
		};
	}
}; // End pollOptionTitle()

/**
 * Gets the poll engagement view reports.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollViewReports = async (req, res, options) => {
	try {
		let userId = options.user_id || "";
		let fromDate = options.from_date || "";
		let toDate = options.to_date || "";

		const pollsViewLogs = db.collection(TABLE_POLL_VIEW_LOGS);
		const pollComments = db.collection(TABLE_POLLS_COMMENTS);
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const pollRibbon = db.collection(TABLE_RIBBON_CLICKS);
		const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);
		const linkClicksCollection = db.collection(TABLE_POLL_LINK_CLICKS);
		const timeSpentCollection = db.collection(TABLE_POLL_TIME_SPENT_LOGS);

		// Common condition for owner poll wise
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		let earnSendRewardsConditions = {
			"make_poll_user_id": userId,
		};

		// Conditions for date
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};

			earnSendRewardsConditions["redemed_date"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Dynamic timezone
		let defaultTimezone = req.body.default_timezone || DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Prepare all queries to run in parallel using Promise.all
		const [
			pollViewAllLogs,
			totalComments,
			totalPollsComment,
			totalViewPolls,
			totalPollRibbons,
			totalOpenRewards,
			totalLinkClicks,
			totalDurationSum,
			afterLoginVotesResult
		] = await Promise.all([
			// Get total engagement poll view log record
			(async () => {
				const result = await pollsViewLogs.aggregate([
					{ $match: commonCondition },
					{
						$addFields: {
							created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
						}
					},
					{
						$group: {
							_id: null,
							'total_poll_views': { $sum: 1 },
							'poll_desktop_view': {
								$sum: {
									$cond: [
										{ $eq: ["$view_type", POLL_DESKTOP_VIEW] }, 1, 0
									]
								}
							},
							'poll_ios_view': {
								$sum: {
									$cond: [
										{ $eq: ["$view_type", POLL_IOS_VIEW] }, 1, 0
									]
								}
							},
							'poll_android_view': {
								$sum: {
									$cond: [
										{ $eq: ["$view_type", POLL_ANDROID_VIEW] }, 1, 0
									]
								}
							},
							'poll_embed_desktop_view': {
								$sum: {
									$cond: [
										{ $eq: ["$view_type", POLL_EMBED_DESKTOP_VIEW] }, 1, 0
									]
								}
							},
							'poll_embed_android_view': {
								$sum: {
									$cond: [
										{ $eq: ["$view_type", POLL_EMBED_ANDROID_VIEW] }, 1, 0
									]
								}
							},
							'poll_embed_ios_view': {
								$sum: {
									$cond: [
										{ $eq: ["$view_type", POLL_EMBED_IOS_VIEW] }, 1, 0
									]
								}
							},
						}
					},
				]).toArray();
				return result && result[0] ? result[0] : {};
			})(),

			// Get total number of comments in poll engagement
			pollComments.countDocuments(commonCondition),

			// Get total poll of comment
			(async () => {
				const result = await pollComments.aggregate([
					{ $match: commonCondition },
					{
						$addFields: {
							created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
						}
					},
					{ $group: { _id: { "poll_slug": "$poll_slug" } } },
					{ $count: 'total' },
				]).toArray();
				return result && result[0] && result[0].total ? result[0].total : 0;
			})(),

			// Get total count of polls (only poll total not views)
			(async () => {
				const result = await pollsViewLogs.aggregate([
					{ $match: commonCondition },
					{ $group: { _id: "$poll_slug", myCount: { $sum: 1 } } },
				]).toArray();
				return result ? result.length : 0;
			})(),

			// Get total number of ribbon click
			pollRibbon.countDocuments(commonCondition),

			// Get total number of open rewards
			(async () => {
				let openRewardConditions = Object.assign(
					{ 'is_redemed': REDEMED, 'template_type': POLL_SEND_REWARDS_TYPE },
					earnSendRewardsConditions
				);
				return await earnSentRewards.countDocuments(openRewardConditions);
			})(),

			// Get total number of link click
			linkClicksCollection.countDocuments(commonCondition),

			// Get total poll duration sum data
			(async () => {
				const result = await timeSpentCollection.aggregate([
					{ $match: commonCondition },
					{
						$group: {
							'_id': null,
							'spent_time_count': { $sum: "$spent_time" },
							'unique_poll_slug': { $addToSet: { poll_slug: "$poll_slug" } }
						}
					},
				]).toArray();
				return result && result[0] ? result[0] : { spent_time_count: 0, unique_poll_slug: [] };
			})(),

			// Get total number of votes (all count login unique, repeat & all login vote)
			(async () => {
				const result = await pollVoteParticipants.aggregate([
					{ $match: commonCondition },
					{
						$group: {
							_id: {
								"poll_slug": "$poll_slug",
								"user_id": "$user_id"
							},
							"myCount": { $sum: 1 }
						}
					},
				]).toArray();

				let totalVotesSumCount = 0;
				let totalOptinVotes = 0;
				let totalOptinCount = 0;
				let totalUniqueVotes = 0;
				let unRegisteredVotes = 0;

				for (const recordsData of result) {
					totalVotesSumCount += recordsData['myCount'];

					// Login wise condition
					if (recordsData && recordsData['_id'] && recordsData['_id']['user_id']) {
						if (recordsData.myCount > 0) {
							totalUniqueVotes += 1;
						}
						totalOptinCount++;
						totalOptinVotes += recordsData['myCount'];
					}

					// Without login wise condition
					if (recordsData && recordsData['_id'] && (recordsData['_id']['user_id'] == null || recordsData['_id']['user_id'] === "")) {
						unRegisteredVotes += recordsData['myCount'];
					}
				}

				return {
					'total_votes': totalVotesSumCount,
					'total_optin_votes': totalOptinVotes,
					'total_unique_votes': totalUniqueVotes,
					'signed_out_users': unRegisteredVotes,
					'total_repeat_votes': (totalVotesSumCount - unRegisteredVotes) - totalUniqueVotes,
					'total_optin_length': totalOptinCount,
					'totalPollsOptinsResult': result,
				};
			})()
		]);

		// Calculate derived values
		let pollDesktopView = pollViewAllLogs['poll_desktop_view'] || 0;
		let pollIosView = pollViewAllLogs['poll_ios_view'] || 0;
		let pollAndroidView = pollViewAllLogs['poll_android_view'] || 0;
		let pollMobileView = pollIosView + pollAndroidView;
		let pollEmbedDesktopView = pollViewAllLogs['poll_embed_desktop_view'] || 0;
		let pollEmbedIosView = pollViewAllLogs['poll_embed_ios_view'] || 0;
		let pollEmbedAndroidView = pollViewAllLogs['poll_embed_android_view'] || 0;
		let pollEmbededMobileView = pollEmbedIosView + pollEmbedAndroidView;
		let totalPollViews = pollViewAllLogs['total_poll_views'] || 0;

		let totalDesktopWithEmbed = Number(pollDesktopView + pollEmbedDesktopView);
		let totalIosWithEmbed = Number(pollIosView + pollEmbedIosView);
		let totalAndroidWithEmbed = Number(pollAndroidView + pollEmbedAndroidView);

		let pollDesktopViewPercentage = calculatePercentage(totalDesktopWithEmbed, totalPollViews);
		let pollIosViewPercentage = calculatePercentage(totalIosWithEmbed, totalPollViews);
		let pollAndroidViewPercentage = calculatePercentage(totalAndroidWithEmbed, totalPollViews);

		let totalDurationSumValue = totalDurationSum['spent_time_count'] || 0;
		let totalDurationPollCount = (totalDurationSum['unique_poll_slug'] || []).length;
		let averageSessionDuration = totalDurationSumValue && totalDurationPollCount ? totalDurationSumValue / totalDurationPollCount : 0;
		let fancyTimeFormatComment = averageSessionDuration ? fancyTimeFormat(averageSessionDuration) : 0;

		let totalPollCommentAverage = totalPollsComment ? totalComments / totalPollsComment : 0;

		let allTotalVotes = afterLoginVotesResult['total_votes'] || 0;
		let allTotalSignedoutVotes = afterLoginVotesResult['signed_out_users'] || 0;
		let totalOptinVotes = afterLoginVotesResult['total_optin_votes'] || 0;
		let totalRepeatVotes = afterLoginVotesResult['total_repeat_votes'] || 0;
		let totalUniqueVotes = afterLoginVotesResult['total_unique_votes'] || 0;
		let totalOptinLength = afterLoginVotesResult['total_optin_length'] || 0;
		let optinRatePercentage = (allTotalVotes - totalRepeatVotes) ? (totalUniqueVotes / (allTotalVotes - totalRepeatVotes)) * 100 : 0;

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'poll_logs': {
				'total_views_polls': totalViewPolls,
				'total_poll_views': totalPollViews,
				'poll_desktop_view': pollDesktopView,
				'poll_ios_view': pollIosView,
				'poll_android_view': pollAndroidView,
				'poll_mobile_view': pollMobileView,
				'poll_embed_desktop_view': pollEmbedDesktopView,
				'poll_embed_android_view': pollEmbedAndroidView,
				'poll_embed_ios_view': pollEmbedIosView,
				'poll_embed_mobile_view': pollEmbededMobileView,
				'poll_desktop_percentage_view': pollDesktopViewPercentage,
				'poll_ios_percentage_view': pollIosViewPercentage,
				'poll_android_percentage_view': pollAndroidViewPercentage,
				'average_session_duration': fancyTimeFormatComment,
				'total_comments': totalComments,
				'total_poll_comment_average': totalPollCommentAverage ? round(totalPollCommentAverage) : 0,
				'total_poll_ribbons': totalPollRibbons,
				'total_open_rewards': totalOpenRewards,
				'total_link_clicks': totalLinkClicks,
				'all_total_votes': allTotalVotes,
				'signed_out_votes': allTotalSignedoutVotes,
				"total_optin_votes": totalOptinVotes,
				"total_repeat_votes": totalRepeatVotes,
				"total_unique_votes": totalUniqueVotes,
				"total_optin_length": totalOptinLength,
				"optin_rate_percentage": optinRatePercentage ? round(optinRatePercentage) : 0,
			},
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'poll_logs': {
				'total_polls': 0,
				'total_poll_views': 0,
				'poll_desktop_view': 0,
				'poll_ios_view': 0,
				'poll_android_view': 0,
				'poll_mobile_view': 0,
				'poll_embed_desktop_view': 0,
				'poll_embed_android_view': 0,
				'poll_embed_ios_view': 0,
				'poll_embed_mobile_view': 0,
				'poll_desktop_percentage_view': 0,
				'poll_ios_percentage_view': 0,
				'poll_android_percentage_view': 0,
				'average_session_duration': 0,
				'total_comments': 0,
				'total_poll_comment_average': 0,
				'total_poll_ribbons': 0,
				'total_open_rewards': 0,
				'total_link_clicks': 0,
				'all_total_votes': 0,
				'after_login_votes': {},
				"total_optin_votes": 0,
				"total_repeat_votes": 0,
				"total_unique_votes": 0,
				"total_optin_length": 0,
				"optin_rate_percentage": 0,
			},
			"message": res.__("front.global.no_record_found"),
			"error": err && err.message ? err.message : err
		};
	}
}; // End pollViewReports()

/**
 * Gets the poll vote reports.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollVoteReports = async (req, res, options) => {
	try {
		// Extract parameters from options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const unregisteredParticipants = !!options.unregistered_participants;

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// Build common condition for owner poll wise
		let commonCondition = {
			"make_poll_user_id": userId,
			"user_id": { $nin: ['', null] }
		};

		// Add date range to condition if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// If unregistered participants, remove user_id filter
		if (unregisteredParticipants) {
			delete commonCondition['user_id'];
		}

		// Set dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Prepare aggregation pipeline for vote details
		const votesDetailsPipeline = [
			{ $match: commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: null,
					// Get total polls votes
					'total_votes': { $sum: 1 },
					// Get total polls desktop votes
					'poll_desktop_votes': {
						$sum: {
							$cond: [
								{ $eq: ["$view_type", POLL_DESKTOP_VIEW] }, 1, 0
							]
						}
					},
					// Get total polls ios votes
					'poll_ios_votes': {
						$sum: {
							$cond: [
								{ $eq: ["$view_type", POLL_IOS_VIEW] }, 1, 0
							]
						}
					},
					// Get total polls android votes
					'poll_android_votes': {
						$sum: {
							$cond: [
								{ $eq: ["$view_type", POLL_ANDROID_VIEW] }, 1, 0
							]
						}
					},
					// Get total polls embed desktop votes
					'poll_embed_desktop_votes': {
						$sum: {
							$cond: [
								{ $eq: ["$view_type", POLL_EMBED_DESKTOP_VIEW] }, 1, 0
							]
						}
					},
					// Get total embed android votes
					'poll_embed_android_votes': {
						$sum: {
							$cond: [
								{ $eq: ["$view_type", POLL_EMBED_ANDROID_VIEW] }, 1, 0
							]
						}
					},
					// Get total embed ios votes
					'poll_embed_ios_votes': {
						$sum: {
							$cond: [
								{ $eq: ["$view_type", POLL_EMBED_IOS_VIEW] }, 1, 0
							]
						}
					},
				}
			},
		];

		// Run the aggregation query using async/await
		const [pollVotesDetailsResult] = await Promise.all([
			pollVoteParticipants.aggregate(votesDetailsPipeline).toArray()
		]);

		// Extract the first result or set defaults
		const pollVotesDetails = pollVotesDetailsResult && pollVotesDetailsResult[0] ? pollVotesDetailsResult[0] : {};

		const totalVotes = pollVotesDetails['total_votes'] || 0;
		const pollDesktopVotes = pollVotesDetails['poll_desktop_votes'] || 0;
		const pollIosVotes = pollVotesDetails['poll_ios_votes'] || 0;
		const pollAndroidVotes = pollVotesDetails['poll_android_votes'] || 0;
		const pollMobileVotes = pollIosVotes + pollAndroidVotes;

		const pollEmbedDesktopVotes = pollVotesDetails['poll_embed_desktop_votes'] || 0;
		const pollEmbedIosVotes = pollVotesDetails['poll_embed_ios_votes'] || 0;
		const pollEmbedAndroidVotes = pollVotesDetails['poll_embed_android_votes'] || 0;
		const pollEmbededMobileVotes = pollEmbedIosVotes + pollEmbedAndroidVotes;

		// Calculate percentages
		const pollDesktopVotePercentage = calculatePercentage(pollDesktopVotes, totalVotes);
		const pollMobileVotePercentage = calculatePercentage(pollMobileVotes, totalVotes);
		const pollEmbedDesktopVotePercentage = calculatePercentage(pollEmbedDesktopVotes, totalVotes);
		const pollEmbedMobileVotePercentage = calculatePercentage(pollEmbededMobileVotes, totalVotes);
		const pollTotalVotesPercentage = calculatePercentage(
			pollDesktopVotes + pollMobileVotes + pollEmbedDesktopVotes + pollEmbededMobileVotes,
			totalVotes
		);

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'poll_logs': {
				'total_votes': totalVotes,
				'total_votes_percentage': pollTotalVotesPercentage,
				'poll_desktop_votes': pollDesktopVotes,
				'poll_mobile_votes': pollMobileVotes,
				'poll_embed_desktop_votes': pollEmbedDesktopVotes,
				'poll_embed_mobile_votes': pollEmbededMobileVotes,
				'poll_desktop_vote_percentage': pollDesktopVotePercentage,
				'poll_mobile_vote_percentage': pollMobileVotePercentage,
				'poll_embed_desktop_vote_percentage': pollEmbedDesktopVotePercentage,
				'poll_embed_mobile_vote_percentage': pollEmbedMobileVotePercentage,
			},
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'poll_logs': {
				'total_votes': 0,
				'total_votes_percentage': 0,
				'poll_desktop_votes': 0,
				'poll_mobile_votes': 0,
				'poll_embed_desktop_votes': 0,
				'poll_embed_mobile_votes': 0,
				'poll_desktop_vote_percentage': 0,
				'poll_mobile_vote_percentage': 0,
				'poll_embed_desktop_vote_percentage': 0,
				'poll_embed_mobile_vote_percentage': 0,
			},
			"message": res.__("front.global.no_record_found"),
			"error": err && err.message ? err.message : err
		};
	}
}; // End pollVoteReports()

/**
 * Gets the poll vote graph reports using async/await and Promise.all for parallel queries.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollVoteGraphReports = async (req, res, options) => {
	try {
		// Extract and normalize options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const unregisteredParticipants = !!options.unregistered_participants;
		const viewTypeFilter = options.view_type_filter ? options.view_type_filter : "";

		// Prepare poll/option IDs
		const pollId = options.poll_id ? newObjectIdDefault(options.poll_id) : "";
		const pollOptionId = options.poll_option_id ? newObjectIdDefault(options.poll_option_id) : "";

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// Build common query condition
		let commonCondition = {
			"make_poll_user_id": userId,
			'user_id': { $nin: ['', null] }
		};

		// Add date range if provided
		if (fromDate && toDate) {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Add poll and option IDs if provided
		if (pollId && pollOptionId) {
			commonCondition["poll_id"] = pollId;
			commonCondition["option_id"] = pollOptionId;
		}

		// Remove user_id for unregistered participants
		if (unregisteredParticipants) {
			delete commonCondition['user_id'];
		}

		// Add view type filter
		if (viewTypeFilter === POLL_DESKTOP_VIEW) {
			commonCondition['view_type'] = POLL_DESKTOP_VIEW;
		} else if (viewTypeFilter === POLL_MOBILE_VIEW) {
			commonCondition['view_type'] = { $in: [POLL_ANDROID_VIEW, POLL_IOS_VIEW] };
		} else if (viewTypeFilter === POLL_EMBED_DESKTOP_VIEW) {
			commonCondition['view_type'] = POLL_EMBED_DESKTOP_VIEW;
		} else if (viewTypeFilter === POLL_EMBED_MOBILE_VIEW) {
			commonCondition['view_type'] = { $in: [POLL_EMBED_ANDROID_VIEW, POLL_EMBED_IOS_VIEW] };
		}

		// Gender and account type conditions
		const maleCondition = { ...commonCondition, gender: MALE, account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE } };
		const femaleCondition = { ...commonCondition, gender: FEMALE, account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE } };
		const otherCondition = { ...commonCondition, gender: OTHER, account_type: { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE } };
		const businessCondition = { ...commonCondition, account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE };
		const anonymousCondition = { ...commonCondition, user_id: { $in: ['', null] } };

		// Default age data for graph
		const defaultAgeData = [
			{ "total_votes": 0, "age": UNDER_18 },
			{ "total_votes": 0, "age": AGE_TO_18_FROM_24 },
			{ "total_votes": 0, "age": AGE_TO_25_FROM_34 },
			{ "total_votes": 0, "age": AGE_TO_35_FROM_44 },
			{ "total_votes": 0, "age": AGE_TO_45_FROM_54 },
			{ "total_votes": 0, "age": AGE_TO_55_FROM_70 },
			{ "total_votes": 0, "age": AGE_OVER_CONSTANT },
			{ "total_votes": 0, "age": NO_AGE_CONSTANT },
		];

		// Age group conditions for MongoDB aggregation
		const ageUnder18 = { "$cond": [{ "$and": [{ "$gte": ["$age", 0] }, { "$lt": ["$age", AGE_18] }] }, UNDER_18, ""] };
		const age18To24 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_18] }, { "$lte": ["$age", AGE_24] }] }, AGE_TO_18_FROM_24, ""] };
		const age25To34 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_25] }, { "$lte": ["$age", AGE_34] }] }, AGE_TO_25_FROM_34, ""] };
		const age35To44 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_35] }, { "$lte": ["$age", AGE_44] }] }, AGE_TO_35_FROM_44, ""] };
		const age45To54 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_45] }, { "$lte": ["$age", AGE_54] }] }, AGE_TO_45_FROM_54, ""] };
		const age55To70 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_55] }, { "$lte": ["$age", AGE_70] }] }, AGE_TO_55_FROM_70, ""] };
		const ageOver70 = { "$cond": [{ "$and": [{ "$gt": ["$age", AGE_OVER_70] }, { "$ne": ["$age", ""] }] }, AGE_OVER_CONSTANT, ""] };
		const noAge = { "$cond": [{ "$and": [{ "$eq": ["$age", ""] }] }, NO_AGE_CONSTANT, ""] };

		const allTotalVoteCountCondition = [
			ageUnder18, age18To24, age25To34, age35To44, age45To54, age55To70, ageOver70, noAge
		];

		// Get timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE;

		// Helper function to aggregate votes by age group for a given condition
		async function getVotesByAge(condition) {
			const pipeline = [
				{ "$match": condition },
				{
					$addFields: {
						created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
					}
				},
				{
					"$group": {
						"_id": { "$concat": allTotalVoteCountCondition },
						"total_votes": { "$sum": 1 }
					}
				},
				{
					"$project": {
						"_id": 0,
						"age": "$_id",
						"total_votes": 1,
					}
				}
			];
			const results = await pollVoteParticipants.aggregate(pipeline).toArray();
			// Convert array to object for quick lookup
			const dataGraphJson = {};
			for (let i = 0; i < results.length; i++) {
				dataGraphJson[results[i]['age']] = results[i]['total_votes'];
			}
			// Merge with default age data to ensure all age groups are present
			return defaultAgeData.map(records => {
				const ageRange = records['age'];
				const ageRangeVotes = dataGraphJson[ageRange] ? dataGraphJson[ageRange] : 0;
				return {
					[ageRange]: ageRangeVotes,
					'age': ageRange,
					'votes': ageRangeVotes,
				};
			});
		}

		// Prepare all queries to run in parallel
		const [
			maleVotesAgeWise,
			femaleVotesAgeWise,
			otherVotesAgeWise,
			businessVotesAgeWise,
			anonymousVotesAgeWise,
			genderVotesDetails
		] = await Promise.all([
			getVotesByAge(maleCondition),
			getVotesByAge(femaleCondition),
			getVotesByAge(otherCondition),
			getVotesByAge(businessCondition),
			// Only fetch anonymous votes if unregisteredParticipants is true
			unregisteredParticipants ? getVotesByAge(anonymousCondition) : Promise.resolve([]),
			// Gender-wise vote details (calls another async function)
			pollEngagementGenderTotalVoteCount(req, res, {
				"user_id": newObjectIdDefault(userId),
				"from_date": fromDate,
				"to_date": toDate,
				"unregistered_participants": unregisteredParticipants,
				"view_type_filter": viewTypeFilter,
				"poll_id": pollId,
				"poll_option_id": pollOptionId,
			})
		]);

		// Extract gender vote details safely
		const votePolls = genderVotesDetails && genderVotesDetails['vote_polls'] ? genderVotesDetails['vote_polls'] : {};
		const maleVotes = votePolls['male_votes'] || 0;
		const maleVotesPercentage = votePolls['male_votes_percentage'] || 0;
		const femaleVotes = votePolls['female_votes'] || 0;
		const femaleVotesPercentage = votePolls['female_votes_percentage'] || 0;
		const otherVotes = votePolls['other_votes'] || 0;
		const otherVotesPercentage = votePolls['other_votes_percentage'] || 0;
		const businessVotes = votePolls['business_votes'] || 0;
		const businessVotesPercentage = votePolls['business_votes_percentage'] || 0;
		const anonymousVotes = votePolls['anonymous_votes'] || 0;
		const anonymousVotesPercentage = votePolls['anonymous_votes_percentage'] || 0;

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'poll_logs': {
				'male_votes': maleVotes,
				'female_votes': femaleVotes,
				'other_votes': otherVotes,
				'business_votes': businessVotes,
				'anonymous_votes': anonymousVotes,
				'male_votes_percentage': maleVotesPercentage,
				'female_votes_percentage': femaleVotesPercentage,
				'other_votes_percentage': otherVotesPercentage,
				'business_votes_percentage': businessVotesPercentage,
				'anonymous_votes_percentage': anonymousVotesPercentage,
				'graph_data': {
					'male_votes': maleVotesAgeWise,
					'female_votes': femaleVotesAgeWise,
					'other_votes': otherVotesAgeWise,
					'business_votes': businessVotesAgeWise,
					'anonymous_votes': anonymousVotesAgeWise
				},
			},
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'poll_logs': {
				'male_votes': 0,
				'female_votes': 0,
				'other_votes': 0,
				'business_votes': 0,
				'anonymous_votes': 0,
				'male_votes_percentage': 0,
				'female_votes_percentage': 0,
				'other_votes_percentage': 0,
				'business_votes_percentage': 0,
				'anonymous_votes_percentage': 0,
				'graph_data': {
					'male_votes': 0,
					'female_votes': 0,
					'other_votes': 0,
					'business_votes': 0,
					'anonymous_votes': 0
				},
			},
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollVoteGraphReports()

/**
 * Checks asynchronously if a user has already voted in a poll.
 * Uses async/await for database query.
 * 
 * @param {String} userId - The ID of the user.
 * @param {String} pollId - The ID of the poll.
 * 
 * @returns {Promise<Number>} Resolves with the count of votes (0 if not voted or error).
 */
alreadyUserPollVoteCheck = async (userId, pollId) => {
	try {
		// Convert IDs to ObjectId if provided
		const userObjectId = userId ? newObjectIdDefault(userId) : "";
		const pollObjectId = pollId ? newObjectIdDefault(pollId) : "";

		// Return 0 if either ID is missing
		if (!userObjectId || !pollObjectId) {
			return 0;
		}

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// Query to count documents where user has voted in the poll
		const voteCount = await pollVoteParticipants.countDocuments({ 'poll_id': pollObjectId, 'user_id': userObjectId });

		return voteCount;
	} catch (err) {
		// On error, return 0
		return 0;
	}
}; // End alreadyUserPollVoteCheck

/**
 * Gets the poll engagement gender total vote count using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise<Object>} Resolves with the result of the operation.
 */
pollEngagementGenderTotalVoteCount = async (req, res, options) => {
	try {
		// Extract and normalize options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const viewTypeFilter = options.view_type_filter ? options.view_type_filter : "";
		const unregisteredParticipants = !!options.unregistered_participants;

		// Performance option wise data
		const pollId = options.poll_id ? newObjectIdDefault(options.poll_id) : "";
		const pollOptionId = options.poll_option_id ? newObjectIdDefault(options.poll_option_id) : "";
		const pollSlug = options.poll_slug ? options.poll_slug : "";
		const segmentPollIds = options.segment_poll_ids ? options.segment_poll_ids : [];

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// Build common query condition
		let commonCondition = {
			'make_poll_user_id': userId,
			'user_id': { $nin: ['', null] }
		};

		// Date range condition
		if (fromDate !== "" && toDate !== "") {
			if (fromDate === ALL_DATE_FILTER) {
				commonCondition["created"] = {
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			} else {
				commonCondition["created"] = {
					$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			}
		}

		// Poll id and option id condition (performance)
		if (pollId && pollOptionId) {
			commonCondition["poll_id"] = pollId;
			commonCondition["option_id"] = pollOptionId;
		}

		// Poll slug condition (performance)
		if (pollSlug) {
			commonCondition["poll_slug"] = { $in: pollSlug };
		}

		// Segment poll ids condition
		if (segmentPollIds.length > 0) {
			commonCondition["poll_id"] = { $in: segmentPollIds };
		}

		// Remove user_id for unregistered participants
		if (unregisteredParticipants) {
			delete commonCondition['user_id'];
		}

		// View type filter
		if (viewTypeFilter === POLL_DESKTOP_VIEW) {
			commonCondition['view_type'] = POLL_DESKTOP_VIEW;
		} else if (viewTypeFilter === POLL_MOBILE_VIEW) {
			commonCondition['view_type'] = { $in: [POLL_ANDROID_VIEW, POLL_IOS_VIEW] };
		} else if (viewTypeFilter === POLL_EMBED_DESKTOP_VIEW) {
			commonCondition['view_type'] = POLL_EMBED_DESKTOP_VIEW;
		} else if (viewTypeFilter === POLL_EMBED_MOBILE_VIEW) {
			commonCondition['view_type'] = { $in: [POLL_EMBED_ANDROID_VIEW, POLL_EMBED_IOS_VIEW] };
		}

		// Dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Prepare aggregation pipeline for gender vote counts
		const pollVoteUserDetailsPipeline = [
			{ $match: commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: null,
					// Total votes
					'total_votes': { $sum: 1 },
					// Male user votes
					'male_user_vote': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", MALE] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								},
								1,
								0
							]
						}
					},
					// Female user votes
					'female_user_vote': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", FEMALE] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								},
								1,
								0
							]
						}
					},
					// Other user votes
					'other_user_vote': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", OTHER] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								},
								1,
								0
							]
						}
					},
					// Business user votes
					'business_users_vote': {
						$sum: {
							$cond: [
								{ $eq: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
								1,
								0
							]
						}
					},
					// Anonymous user votes
					'anonymous_users_vote': {
						$sum: {
							$cond: [
								{ $in: ["$user_id", ["", null]] },
								1,
								0
							]
						}
					},
				}
			},
		];

		// Run the aggregation using async/await
		const pollVoteUserDetailsResult = await pollVoteParticipants.aggregate(pollVoteUserDetailsPipeline).toArray();

		// Extract results
		const pollVoteUsers = (pollVoteUserDetailsResult && pollVoteUserDetailsResult[0]) ? pollVoteUserDetailsResult[0] : {};
		const totalVotes = pollVoteUsers['total_votes'] || 0;
		const maleVotes = pollVoteUsers['male_user_vote'] || 0;
		const femaleVotes = pollVoteUsers['female_user_vote'] || 0;
		const otherUserVotes = pollVoteUsers['other_user_vote'] || 0;
		const businessVotes = pollVoteUsers['business_users_vote'] || 0;
		const anonymousVotes = pollVoteUsers['anonymous_users_vote'] || 0;

		// Calculate percentages
		const maleVotesPercentage = calculatePercentage(maleVotes, totalVotes);
		const femaleVotesPercentage = calculatePercentage(femaleVotes, totalVotes);
		const otherVotesPercentage = calculatePercentage(otherUserVotes, totalVotes);
		const businessVotesPercentage = calculatePercentage(businessVotes, totalVotes);
		const anonymousVotesPercentage = calculatePercentage(anonymousVotes, totalVotes);

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'vote_polls': {
				'total_votes': totalVotes,
				'male_votes': maleVotes,
				'female_votes': femaleVotes,
				'other_votes': otherUserVotes,
				'business_votes': businessVotes,
				'anonymous_votes': anonymousVotes,
				'male_votes_percentage': maleVotesPercentage,
				'female_votes_percentage': femaleVotesPercentage,
				'other_votes_percentage': otherVotesPercentage,
				'business_votes_percentage': businessVotesPercentage,
				'anonymous_votes_percentage': anonymousVotesPercentage,
			},
			'message': ""
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'vote_polls': {
				'total_votes': 0,
				'male_votes': 0,
				'female_votes': 0,
				'other_votes': 0,
				'business_votes': 0,
				'anonymous_votes': 0,
				'male_votes_percentage': 0,
				'female_votes_percentage': 0,
				'other_votes_percentage': 0,
				'business_votes_percentage': 0,
				'anonymous_votes_percentage': 0,
			},
			'message': res.__("front.global.no_record_found"),
		};
	}
}; // End pollEngagementGenderTotalVoteCount()

/**
 * Gets the poll share icon result using async/await and Promise.all for parallel queries.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollShareIconResult = async (req, res, options) => {
	try {
		// Extract and normalize options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const unregisteredParticipants = !!options.unregistered_participants;
		const pollShareIcons = db.collection(TABLE_SHARE_ICON_LOGS);

		// Build common query condition
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Remove user_id for unregistered participants
		if (unregisteredParticipants) {
			delete commonCondition['user_id'];
		}

		// Add date range if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Prepare aggregation pipeline for share details
		const shareDetailsPipeline = [
			{ $match: commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: null,
					// Get total share
					'total_shares': { $sum: 1 },
					// Get total facebook share
					'total_facebook_shares': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", FACEBOOK_SHARE] }, 1, 0
							]
						}
					},
					// Get total twitter share
					'total_twitter_shares': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", TWITTER_SHARE] }, 1, 0
							]
						}
					},
					// Get total linkedin share
					'total_linkedin_shares': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", LINKEDIN_SHARE] }, 1, 0
							]
						}
					},
					// Get total whatsapp share
					'total_whatsapp_shares': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", WHATSAPP_SHARE] }, 1, 0
							]
						}
					},
					// Get total email share
					'total_email_shares': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", EMAIL_SHARE] }, 1, 0
							]
						}
					},
					// Get total sms share
					'total_sms_shares': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", SMS_SHARE] }, 1, 0
							]
						}
					},
					// Get total embed share
					'total_embed_share': {
						$sum: {
							$cond: [
								{ $eq: ["$share_type", EMBED_SHARE] }, 1, 0
							]
						}
					},
					// Total male share
					'male_share': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", MALE] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								}, 1, 0
							]
						}
					},
					// Total female share
					'female_share': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", FEMALE] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								}, 1, 0
							]
						}
					},
					// Total other share
					'other_share': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", OTHER] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								}, 1, 0
							]
						}
					},
					// Total business share
					'business_share': {
						$sum: {
							$cond: [
								{ $eq: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] }, 1, 0
							]
						}
					},
				}
			},
		];

		// Run aggregation in parallel (if more queries, add to Promise.all)
		const [shareDetailsArr] = await Promise.all([
			pollShareIcons.aggregate(shareDetailsPipeline).toArray()
		]);

		const shareDetails = (shareDetailsArr && shareDetailsArr[0]) ? shareDetailsArr[0] : {};

		// Extract values with fallback to 0
		const totalShares = shareDetails['total_shares'] || 0;
		const totalFacebookShares = shareDetails['total_facebook_shares'] || 0;
		const totalTwitterShares = shareDetails['total_twitter_shares'] || 0;
		const totalLinkedinShares = shareDetails['total_linkedin_shares'] || 0;
		const totalWhatsappShares = shareDetails['total_whatsapp_shares'] || 0;
		const totalEmailShares = shareDetails['total_email_shares'] || 0;
		const totalSmsShares = shareDetails['total_sms_shares'] || 0;
		const totalEmbedShares = shareDetails['total_embed_share'] || 0;
		const totalMaleShares = shareDetails['male_share'] || 0;
		const totalFemaleShares = shareDetails['female_share'] || 0;
		const totalOtherShares = shareDetails['other_share'] || 0;
		const totalBusinesShares = shareDetails['business_share'] || 0;

		// Calculate percentages
		const totalFacebookSharesPercentage = calculatePercentage(totalFacebookShares, totalShares);
		const totalTwitterSharesPercentage = calculatePercentage(totalTwitterShares, totalShares);
		const totalLinkedinSharesPercentage = calculatePercentage(totalLinkedinShares, totalShares);
		const totalWhatsappSharesPercentage = calculatePercentage(totalWhatsappShares, totalShares);
		const totalEmailSharesPercentage = calculatePercentage(totalEmailShares, totalShares);
		const totalSmsSharesPercentage = calculatePercentage(totalSmsShares, totalShares);
		const totalEmbedSharesPercentage = calculatePercentage(totalEmbedShares, totalShares);

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'poll_logs': {
				'total_shares': totalShares,
				'total_facebook_shares': totalFacebookShares,
				'total_twitter_shares': totalTwitterShares,
				'total_linkedin_shares': totalLinkedinShares,
				'total_whatsapp_shares': totalWhatsappShares,
				'total_email_shares': totalEmailShares,
				'total_sms_shares': totalSmsShares,
				'total_embed_shares': totalEmbedShares,
				'total_male_share': totalMaleShares,
				'total_female_share': totalFemaleShares,
				'total_other_share': totalOtherShares,
				'total_business_share': totalBusinesShares,
				'total_facebook_shares_percentage': totalFacebookSharesPercentage,
				'total_twitter_shares_percentage': totalTwitterSharesPercentage,
				'total_linkedin_shares_percentage': totalLinkedinSharesPercentage,
				'total_whatsapp_shares_percentage': totalWhatsappSharesPercentage,
				'total_email_shares_percentage': totalEmailSharesPercentage,
				'total_sms_shares_percentage': totalSmsSharesPercentage,
				'total_embed_shares_percentage': totalEmbedSharesPercentage,
			},
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'poll_logs': {
				'total_shares': 0,
				'total_facebook_shares': 0,
				'total_twitter_shares': 0,
				'total_linkedin_shares': 0,
				'total_whatsapp_shares': 0,
				'total_email_shares': 0,
				'total_sms_shares': 0,
				'total_embed_shares': 0,
				'total_male_share': 0,
				'total_female_share': 0,
				'total_other_share': 0,
				'total_business_share': 0,
				'total_facebook_shares_percentage': 0,
				'total_twitter_shares_percentage': 0,
				'total_linkedin_shares_percentage': 0,
				'total_whatsapp_shares_percentage': 0,
				'total_email_shares_percentage': 0,
				'total_sms_shares_percentage': 0,
				'total_embed_shares_percentage': 0,
			},
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollShareIconResult()

/**
 * Gets the poll view graph data using async/await for faster and cleaner response.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise<Object>} Resolves with the result of the operation.
 */
pollViewGraphData = async (req, res, options) => {
	try {
		// Extract and normalize options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";

		const pollsViewLogs = db.collection(TABLE_POLL_VIEW_LOGS);
		let dayWiseFilter = false;

		// Common condition for owner poll wise
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range condition if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Set group conditions (month/year or day/month/year)
		let groupConditions = {
			"year": { "$substr": ["$created", 0, 4] },
			"month": { "$substr": ["$created", 5, 2] },
		};

		if (fromDate !== "" && toDate !== "") {
			const diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
			if (diffDate <= LIMITED_DAYS_DASHBOARD) {
				dayWiseFilter = true;
				groupConditions = {
					"year": { "$substr": ["$created", 0, 4] },
					"month": { "$substr": ["$created", 5, 2] },
					"date": { "$substr": ["$created", 8, 2] },
				};
			}
		}

		// Dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Prepare aggregation pipeline for view graph
		const viewGraphPipeline = [
			{ $match: commonCondition },
			{
				$addFields: {
					sort_created: "$created",
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: groupConditions,
					'desktop_views': {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$view_type", POLL_DESKTOP_VIEW] }] },
								1,
								0
							]
						}
					},
					'mobile_views': {
						$sum: {
							$cond: [
								{ $and: [{ $in: ["$view_type", [POLL_IOS_VIEW, POLL_ANDROID_VIEW]] }] },
								1,
								0
							]
						}
					},
					'embed_desktop_views': {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$view_type", POLL_EMBED_DESKTOP_VIEW] }] },
								1,
								0
							]
						}
					},
					'embed_mobile_views': {
						$sum: {
							$cond: [
								{ $and: [{ $in: ["$view_type", [POLL_EMBED_IOS_VIEW, POLL_EMBED_ANDROID_VIEW]] }] },
								1,
								0
							]
						}
					},
				}
			},
			{ $sort: { _id: SORT_ASC } }
		];

		// Run the aggregation query using async/await
		const viewGraphResult = await pollsViewLogs.aggregate(viewGraphPipeline).toArray();

		// Prepare the response data
		let viewResponseData = [];
		let day = "";
		let year = "";
		let month = "";
		let monthyear = "";

		// Create array for month/date wise data
		if (viewGraphResult && viewGraphResult.length > 0) {
			for (let i = 0; i < viewGraphResult.length; i++) {
				month = viewGraphResult[i]["_id"]["month"] ? viewGraphResult[i]["_id"]["month"] : "";
				year = viewGraphResult[i]["_id"]["year"] ? viewGraphResult[i]["_id"]["year"] : "";
				day = viewGraphResult[i]["_id"]["date"] ? viewGraphResult[i]["_id"]["date"] : "";
				monthyear = dayWiseFilter ? (day + "-" + month + "-" + year) : (month + "-" + year);

				viewResponseData[i] = {};
				viewResponseData[i][monthyear] = {};
				viewResponseData[i][monthyear]["desktop_views"] = viewGraphResult[i]["desktop_views"] ? viewGraphResult[i]["desktop_views"] : 0;
				viewResponseData[i][monthyear]["mobile_views"] = viewGraphResult[i]["mobile_views"] ? viewGraphResult[i]["mobile_views"] : 0;
				viewResponseData[i][monthyear]["embed_desktop_views"] = viewGraphResult[i]["embed_desktop_views"] ? viewGraphResult[i]["embed_desktop_views"] : 0;
				viewResponseData[i][monthyear]["embed_mobile_views"] = viewGraphResult[i]["embed_mobile_views"] ? viewGraphResult[i]["embed_mobile_views"] : 0;
			}
		}

		// Get all previous months/days for the range
		let monthsArray = getPreviousMonths(dayWiseFilter, fromDate, toDate);

		// Merge the aggregation result into the monthsArray for a complete timeline
		viewResponseData.forEach((html) => {
			for (let i = 0; i < monthsArray.length; i++) {
				monthsArray[i]['week_name'] = monthsArray[i]['mongo_date'] ? weekOfTheMonth(getUtcDate(monthsArray[i]['mongo_date'])) : "";
				if (typeof html[monthsArray[i]['month_year']] !== typeof undefined) {
					monthsArray[i]['desktop_views'] = html[monthsArray[i]['month_year']]['desktop_views'] ? html[monthsArray[i]['month_year']]['desktop_views'] : 0;
					monthsArray[i]['mobile_views'] = html[monthsArray[i]['month_year']]['mobile_views'] ? html[monthsArray[i]['month_year']]['mobile_views'] : 0;
					monthsArray[i]['embed_desktop_views'] = html[monthsArray[i]['month_year']]['embed_desktop_views'] ? html[monthsArray[i]['month_year']]['embed_desktop_views'] : 0;
					monthsArray[i]['embed_mobile_views'] = html[monthsArray[i]['month_year']]['embed_mobile_views'] ? html[monthsArray[i]['month_year']]['embed_mobile_views'] : 0;
				}
			}
		});

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'result': monthsArray,
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'result': [],
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollViewGraphData()

/**
 * Gets the poll comment gender wise record using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollCommentGenderWiseRecord = async (req, res, options) => {
	try {
		let userId = options.user_id || "";
		let fromDate = options.from_date || "";
		let toDate = options.to_date || "";
		let unregisteredParticipants = !!options.unregistered_participants;

		const pollCommentCollection = db.collection(TABLE_POLLS_COMMENTS);

		// Build common condition for user poll
		let commonCondition = {
			'make_poll_user_id': userId,
			'user_id': { $nin: ['', null] }
		};

		// If unregistered participants, remove user_id filter
		if (unregisteredParticipants) {
			delete commonCondition['user_id'];
		}

		// Add date range condition if provided
		if (fromDate && toDate) {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Set dynamic timezone
		let defaultTimezone = req.body.default_timezone || DEFAULT_TIME_ZONE;

		// Aggregate poll comment details
		const pollCommentDetails = await pollCommentCollection.aggregate([
			{ $match: commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: null,
					// Total comment count
					'total_comment': { $sum: 1 },
					// Total male comment count
					'male_comment': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", MALE] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								}, 1, 0
							]
						}
					},
					// Total female comment count
					'female_comment': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", FEMALE] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								}, 1, 0
							]
						}
					},
					// Total other comment count
					'other_comment': {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$gender", OTHER] },
										{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
									]
								}, 1, 0
							]
						}
					},
					// Total business comment count
					'business_comment': {
						$sum: {
							$cond: [
								{ $eq: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] }, 1, 0
							]
						}
					},
				}
			},
		]).toArray();

		const pollCommentUsers = (pollCommentDetails && pollCommentDetails[0]) ? pollCommentDetails[0] : {};
		const totalComment = pollCommentUsers['total_comment'] || 0;
		const maleComment = pollCommentUsers['male_comment'] || 0;
		const femaleComment = pollCommentUsers['female_comment'] || 0;
		const otherComment = pollCommentUsers['other_comment'] || 0;
		const businessComment = pollCommentUsers['business_comment'] || 0;

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'comments': {
				'total_comment': totalComment,
				'male_comment': maleComment,
				'female_comment': femaleComment,
				'other_comment': otherComment,
				'business_comment': businessComment,
			},
			'message': ""
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'comments': {
				'total_comment': 0,
				'male_comment': 0,
				'female_comment': 0,
				'other_comment': 0,
				'business_comment': 0,
			},
			'message': res.__("front.global.no_record_found"),
		};
	}
}; // End pollCommentGenderWiseRecord

/**
 * Gets the poll performance interaction count using async/await and Promise.all for parallel queries.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollPerformanceInteractionCount = async (req, res, options) => {
	try {
		let userId = options.user_id || "";
		let fromDate = options.from_date || "";
		let toDate = options.to_date || "";

		// Build common condition for owner poll
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range condition if provided
		if (fromDate && toDate) {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Prepare options for sub-queries
		let optionsData = {
			"user_id": newObjectIdDefault(userId),
			"from_date": fromDate,
			"to_date": toDate,
			"unregistered_participants": true,
		};

		// Run all queries in parallel for faster response
		const [
			votesDetails,
			commnetDetails,
			shareDetails,
			ageDetails,
			followerVsNonFollowerDetails,
			repeatVsNewParticipants
		] = await Promise.all([
			pollEngagementGenderTotalVoteCount(req, res, optionsData),
			pollCommentGenderWiseRecord(req, res, optionsData),
			pollShareIconResult(req, res, optionsData),
			pollPerformanceInteractionAge(req, res, optionsData),
			pollFollowersVsNonFollowers(req, res, optionsData),
			pollPerformanceRepeatVsNewParticipants(req, res, optionsData)
		]);

		// Extract and calculate all required values
		const totalAgeDetails = (ageDetails && ageDetails['result']) ? ageDetails['result'] : 0;

		const totalFollowers = (followerVsNonFollowerDetails && followerVsNonFollowerDetails['result'] && followerVsNonFollowerDetails['result']['total_followers']) ? followerVsNonFollowerDetails['result']['total_followers'] : 0;
		const totalNonFollowers = (followerVsNonFollowerDetails && followerVsNonFollowerDetails['result'] && followerVsNonFollowerDetails['result']['total_non_followers']) ? followerVsNonFollowerDetails['result']['total_non_followers'] : 0;

		const totalrepeatParticipants = (repeatVsNewParticipants && repeatVsNewParticipants['result'] && repeatVsNewParticipants['result']['total_repeat']) ? repeatVsNewParticipants['result']['total_repeat'] : 0;
		const totalnewParticipants = (repeatVsNewParticipants && repeatVsNewParticipants['result'] && repeatVsNewParticipants['result']['total_unique']) ? repeatVsNewParticipants['result']['total_unique'] : 0;

		const totalVotes = (votesDetails && votesDetails['vote_polls'] && votesDetails['vote_polls']['total_votes']) ? votesDetails['vote_polls']['total_votes'] : 0;
		const maleVotes = (votesDetails && votesDetails['vote_polls'] && votesDetails['vote_polls']['male_votes']) ? votesDetails['vote_polls']['male_votes'] : 0;
		const femaleVotes = (votesDetails && votesDetails['vote_polls'] && votesDetails['vote_polls']['female_votes']) ? votesDetails['vote_polls']['female_votes'] : 0;
		const otherVotes = (votesDetails && votesDetails['vote_polls'] && votesDetails['vote_polls']['other_votes']) ? votesDetails['vote_polls']['other_votes'] : 0;
		const businessVotes = (votesDetails && votesDetails['vote_polls'] && votesDetails['vote_polls']['business_votes']) ? votesDetails['vote_polls']['business_votes'] : 0;

		const totalComments = (commnetDetails && commnetDetails['comments'] && commnetDetails['comments']['total_comment']) ? commnetDetails['comments']['total_comment'] : 0;
		const maleComments = (commnetDetails && commnetDetails['comments'] && commnetDetails['comments']['male_comment']) ? commnetDetails['comments']['male_comment'] : 0;
		const femaleComments = (commnetDetails && commnetDetails['comments'] && commnetDetails['comments']['female_comment']) ? commnetDetails['comments']['female_comment'] : 0;
		const otherComments = (commnetDetails && commnetDetails['comments'] && commnetDetails['comments']['other_comment']) ? commnetDetails['comments']['other_comment'] : 0;
		const businessComments = (commnetDetails && commnetDetails['comments'] && commnetDetails['comments']['business_comment']) ? commnetDetails['comments']['business_comment'] : 0;

		const totalShares = (shareDetails && shareDetails['poll_logs'] && shareDetails['poll_logs']['total_shares']) ? shareDetails['poll_logs']['total_shares'] : 0;
		const maleShares = (shareDetails && shareDetails['poll_logs'] && shareDetails['poll_logs']['total_male_share']) ? shareDetails['poll_logs']['total_male_share'] : 0;
		const femaleShares = (shareDetails && shareDetails['poll_logs'] && shareDetails['poll_logs']['total_female_share']) ? shareDetails['poll_logs']['total_female_share'] : 0;
		const otherShares = (shareDetails && shareDetails['poll_logs'] && shareDetails['poll_logs']['total_other_share']) ? shareDetails['poll_logs']['total_other_share'] : 0;
		const businessShares = (shareDetails && shareDetails['poll_logs'] && shareDetails['poll_logs']['total_business_share']) ? shareDetails['poll_logs']['total_business_share'] : 0;

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'poll_logs': {
				'total_interactions': Number(totalVotes + totalComments + totalShares),
				'male_interactions': Number(maleVotes + maleComments + maleShares),
				'female_interactions': Number(femaleVotes + femaleComments + femaleShares),
				'other_interactions': Number(otherVotes + otherComments + otherShares),
				'business_interactions': Number(businessVotes + businessComments + businessShares),
				'age_interaction': totalAgeDetails,
				'total_followers': totalFollowers,
				'total_non_followers': totalNonFollowers,
				'total_repeat_participant': totalrepeatParticipants,
				'total_new_participant': totalnewParticipants,
			},
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'poll_logs': {
				'total_interactions': 0,
				'male_interactions': 0,
				'female_interactions': 0,
				'other_interactions': 0,
				'business_interactions': 0,
				'age_interaction': 0,
				'total_followers': 0,
				'total_non_followers': 0,
				'total_repeat_participant': 0,
				'total_new_participant': 0,
			},
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollPerformanceInteractionCount

/**
 * Gets the poll view opt-in graph data using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollViewOptInGraphData = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		let dayWiseFilter = false;

		// Build common condition for poll owner
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range condition if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Set group conditions for aggregation
		let groupConditions = {
			"poll_slug": "$poll_slug",
			"user_id": "$user_id",
			"year": { "$substr": ["$created", 0, 4] },
			"month": { "$substr": ["$created", 5, 2] },
		};

		// If the date range is within the limited dashboard days, group by day as well
		if (fromDate !== "" && toDate !== "") {
			const diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
			if (diffDate <= LIMITED_DAYS_DASHBOARD) {
				dayWiseFilter = true;
				groupConditions = {
					"poll_slug": "$poll_slug",
					"user_id": "$user_id",
					"year": { "$substr": ["$created", 0, 4] },
					"month": { "$substr": ["$created", 5, 2] },
					"date": { "$substr": ["$created", 8, 2] },
				};
			}
		}

		// Set dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Build aggregation pipeline for poll vote participants
		const pipeline = [
			{ $match: commonCondition },
			{
				$addFields: {
					sort_created: "$created",
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: groupConditions,
					myCount: { $sum: 1 },
					sort_created: { $first: "$sort_created" },
				}
			},
			{
				$project: {
					'_id': "$_id",
					'sort_created': 1,
					'created': 1,
					'myCount': 1,
				}
			},
			{ $sort: { 'sort_created': SORT_ASC } },
		];

		// Run aggregation query
		const totalPollsOptinsResult = await pollVoteParticipants.aggregate(pipeline).toArray();

		let viewResponseData = {};
		let day = "";
		let year = "";
		let month = "";
		let monthyear = "";

		// Process aggregation result to build month/date wise data
		if (totalPollsOptinsResult && totalPollsOptinsResult.length > 0) {
			for (let i = 0; i < totalPollsOptinsResult.length; i++) {
				let totalVotesSumCount = 0;
				let totalOptinVotes = 0;
				let totalOptinCount = 0;
				let totalUniqueVotes = 0;
				let unRegisteredVotes = 0;

				const _id = totalPollsOptinsResult[i]["_id"] || {};
				month = _id["month"] ? _id["month"] : "";
				year = _id["year"] ? _id["year"] : "";
				day = _id["date"] ? _id["date"] : "";
				monthyear = dayWiseFilter ? (day + "-" + month + "-" + year) : (month + "-" + year);

				totalVotesSumCount = totalPollsOptinsResult[i]["myCount"] ? totalPollsOptinsResult[i]["myCount"] : 0;

				// If user_id exists (logged in)
				if (_id && _id["user_id"]) {
					// Unique count sum
					if (totalPollsOptinsResult[i].myCount > 0) {
						totalUniqueVotes = totalUniqueVotes + 1;
					}
					// Total all login vote count
					totalOptinCount++;
					totalOptinVotes = totalOptinVotes + totalPollsOptinsResult[i]['myCount'];
				}

				// If user_id is null or empty (unregistered)
				if (_id && (_id["user_id"] == null || _id["user_id"] === "")) {
					unRegisteredVotes = unRegisteredVotes + totalPollsOptinsResult[i]['myCount'];
				}

				let totalVotesData = (viewResponseData && viewResponseData[monthyear] && viewResponseData[monthyear]["total_votes"])
					? Number(viewResponseData[monthyear]["total_votes"] + totalVotesSumCount)
					: totalVotesSumCount;
				let totalUniqueVotesData = (viewResponseData && viewResponseData[monthyear] && viewResponseData[monthyear]["total_unique_votes"])
					? Number(viewResponseData[monthyear]["total_unique_votes"] + totalUniqueVotes)
					: totalUniqueVotes;
				let totalUnRegisteredVotesData = (viewResponseData && viewResponseData[monthyear] && viewResponseData[monthyear]["un_registered_votes"])
					? Number(viewResponseData[monthyear]["un_registered_votes"] + unRegisteredVotes)
					: unRegisteredVotes;
				let totalRepeatVotesData = (totalVotesData - totalUnRegisteredVotesData) - totalUniqueVotesData;
				let optinRatePercentageData = totalUniqueVotesData / (totalVotesData - totalRepeatVotesData) * 100;

				let calculateData = {
					"total_votes": totalVotesData,
					"total_unique_votes": totalUniqueVotesData,
					"un_registered_votes": totalUnRegisteredVotesData,
					"total_repeat_votes": totalRepeatVotesData,
					"optin_rate_percentage": round(optinRatePercentageData),
				};
				viewResponseData[monthyear] = calculateData;
			}
		}

		// Get all previous months/days for the range
		let monthsArray = getPreviousMonths(dayWiseFilter, fromDate, toDate);

		// Merge the aggregation result into the monthsArray for a complete timeline
		for (let i = 0; i < monthsArray.length; i++) {
			monthsArray[i]['week_name'] = monthsArray[i]['mongo_date'] ? weekOfTheMonth(getUtcDate(monthsArray[i]['mongo_date'])) : "";
			let monthYear = monthsArray[i]['month_year'];
			monthsArray[i]['total_votes'] = (viewResponseData && viewResponseData[monthYear]) ? viewResponseData[monthYear]['total_votes'] : 0;
			monthsArray[i]['total_unique_votes'] = (viewResponseData && viewResponseData[monthYear]) ? viewResponseData[monthYear]['total_unique_votes'] : 0;
			monthsArray[i]['un_registered_votes'] = (viewResponseData && viewResponseData[monthYear]) ? viewResponseData[monthYear]['un_registered_votes'] : 0;
			monthsArray[i]['total_repeat_votes'] = (viewResponseData && viewResponseData[monthYear]) ? viewResponseData[monthYear]['total_repeat_votes'] : 0;
			monthsArray[i]['optin_rate_percentage'] = (viewResponseData && viewResponseData[monthYear]) ? viewResponseData[monthYear]['optin_rate_percentage'] : 0;
		}

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'result': monthsArray,
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'result': [],
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollViewOptInGraphData()

/**
 * Gets the poll view average session duration graph data using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollViewAverageSessionDurationGraphData = async (req, res, options) => {
	try {
		// Extract parameters
		const userId = options.user_id || "";
		const fromDate = options.from_date || "";
		const toDate = options.to_date || "";
		const timeSpentCollection = db.collection(TABLE_POLL_TIME_SPENT_LOGS);
		let dayWiseFilter = false;

		// Build common condition for owner poll
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range condition if provided
		if (fromDate && toDate) {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Set group conditions for aggregation
		let groupConditions = {
			"year": { "$substr": ["$created", 0, 4] },
			"month": { "$substr": ["$created", 5, 2] },
		};

		// If the date range is within the limited dashboard days, group by day as well
		if (fromDate && toDate) {
			let diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
			if (diffDate <= LIMITED_DAYS_DASHBOARD) {
				dayWiseFilter = true;
				groupConditions = {
					"year": { "$substr": ["$created", 0, 4] },
					"month": { "$substr": ["$created", 5, 2] },
					"date": { "$substr": ["$created", 8, 2] },
				};
			}
		}

		// Set dynamic timezone
		const defaultTimezone = req.body.default_timezone || DEFAULT_TIME_ZONE;

		// Run aggregation query to get session duration data
		const sessionResult = await timeSpentCollection.aggregate([
			{ $match: commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: groupConditions,
					'spent_time_count': { $sum: "$spent_time" },
					'unique_poll_slug': { $addToSet: { poll_slug: "$poll_slug" } }
				}
			},
			{
				$project: {
					'_id': 1,
					'spent_time_count': 1,
					'poll_count': { $size: "$unique_poll_slug" },
				}
			}
		]).toArray();

		// Prepare response data
		let viewSessionResponseData = [];
		let day = "";
		let year = "";
		let month = "";
		let monthyear = "";

		// Build month/date wise data array
		if (sessionResult && sessionResult.length > 0) {
			for (let i = 0; i < sessionResult.length; i++) {
				month = sessionResult[i]["_id"]["month"] ? sessionResult[i]["_id"]["month"] : "";
				year = sessionResult[i]["_id"]["year"] ? sessionResult[i]["_id"]["year"] : "";
				day = sessionResult[i]["_id"]["date"] ? sessionResult[i]["_id"]["date"] : "";
				monthyear = dayWiseFilter ? (day + "-" + month + "-" + year) : (month + "-" + year);

				let totalDurationSum = sessionResult[i]["spent_time_count"] ? sessionResult[i]["spent_time_count"] : 0;
				let totalDurationPollCount = sessionResult[i]["poll_count"] ? sessionResult[i]["poll_count"] : 0;
				let averageSessionDuration = (totalDurationSum && totalDurationPollCount) ? totalDurationSum / totalDurationPollCount : 0;

				viewSessionResponseData[i] = {};
				viewSessionResponseData[i][monthyear] = {};
				viewSessionResponseData[i][monthyear]["spent_time_count"] = totalDurationSum;
				viewSessionResponseData[i][monthyear]["spent_time_average_count"] = Math.round(averageSessionDuration);
				viewSessionResponseData[i][monthyear]["poll_count"] = totalDurationPollCount;
				viewSessionResponseData[i][monthyear]["average_session_duration"] = fancyTimeFormat(averageSessionDuration);
			}
		}

		// Get all previous months/days for the range
		let monthsSessionArray = getPreviousMonths(dayWiseFilter, fromDate, toDate);

		// Merge the aggregation result into the monthsSessionArray for a complete timeline
		viewSessionResponseData.forEach((html) => {
			for (let i = 0; i < monthsSessionArray.length; i++) {
				monthsSessionArray[i]['week_name'] = monthsSessionArray[i]['mongo_date'] ? weekOfTheMonth(getUtcDate(monthsSessionArray[i]['mongo_date'])) : "";
				if (typeof html[monthsSessionArray[i]['month_year']] !== typeof undefined) {
					monthsSessionArray[i]['spent_time_count'] = html[monthsSessionArray[i]['month_year']]['spent_time_count'] ? html[monthsSessionArray[i]['month_year']]['spent_time_count'] : 0;
					monthsSessionArray[i]['spent_time_average_count'] = html[monthsSessionArray[i]['month_year']]['spent_time_average_count'] ? html[monthsSessionArray[i]['month_year']]['spent_time_average_count'] : 0;
					monthsSessionArray[i]['average_session_duration'] = html[monthsSessionArray[i]['month_year']]['average_session_duration'] ? html[monthsSessionArray[i]['month_year']]['average_session_duration'] : 0;
				}
			}
		});

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'result': monthsSessionArray,
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'result': [],
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollViewAverageSessionDurationGraphData

/**
 * Gets the poll performance interaction age using async/await and Promise.all for parallel queries.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object.
 * 
 * @returns {Promise} A promise that resolves with the result of the operation.
 */
pollPerformanceInteractionAge = async (req, res, options) => {
	try {
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const pollComments = db.collection(TABLE_POLLS_COMMENTS);
		const pollShareIcons = db.collection(TABLE_SHARE_ICON_LOGS);

		// Common condition for all queries
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range condition if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		const defaultAgeData = [
			{ "age": UNDER_18 },
			{ "age": AGE_TO_18_FROM_24 },
			{ "age": AGE_TO_25_FROM_34 },
			{ "age": AGE_TO_35_FROM_44 },
			{ "age": AGE_TO_45_FROM_54 },
			{ "age": AGE_TO_55_FROM_70 },
			{ "age": AGE_OVER_CONSTANT },
			{ "age": NO_AGE_CONSTANT },
		];

		// MongoDB conditional expressions for age buckets
		const ageUnder18 = { "$cond": [{ "$and": [{ "$gte": ["$age", 0] }, { "$lt": ["$age", AGE_18] }] }, UNDER_18, ""] };
		const age18To24 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_18] }, { "$lte": ["$age", AGE_24] }] }, AGE_TO_18_FROM_24, ""] };
		const age25To34 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_25] }, { "$lte": ["$age", AGE_34] }] }, AGE_TO_25_FROM_34, ""] };
		const age35To44 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_35] }, { "$lte": ["$age", AGE_44] }] }, AGE_TO_35_FROM_44, ""] };
		const age45To54 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_45] }, { "$lte": ["$age", AGE_54] }] }, AGE_TO_45_FROM_54, ""] };
		const age55To70 = { "$cond": [{ "$and": [{ "$gte": ["$age", AGE_55] }, { "$lte": ["$age", AGE_70] }] }, AGE_TO_55_FROM_70, ""] };
		const ageOver70 = { "$cond": [{ "$and": [{ "$gt": ["$age", AGE_OVER_70] }, { "$ne": ["$age", ""] }] }, AGE_OVER_CONSTANT, ""] };
		const noAge = { "$cond": [{ "$and": [{ "$eq": ["$age", ""] }] }, NO_AGE_CONSTANT, ""] };

		const allTotalVoteCountCondition = [
			ageUnder18, age18To24, age25To34, age35To44, age45To54, age55To70, ageOver70, noAge
		];

		// Set dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE;

		// Helper function to aggregate by age for a given collection and field
		const aggregateByAge = async (collection, countField, resultField) => {
			const pipeline = [
				{ "$match": commonCondition },
				{
					$addFields: {
						created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
					}
				},
				{
					"$group": {
						"_id": { "$concat": allTotalVoteCountCondition },
						[countField]: { "$sum": 1 }
					}
				},
				{
					"$project": {
						"_id": 0,
						"age": "$_id",
						[countField]: 1,
					}
				},
			];
			const result = await collection.aggregate(pipeline).toArray();
			// Convert array to object for fast lookup
			const dataGraphJson = {};
			for (let i = 0; i < result.length; i++) {
				dataGraphJson[result[i]['age']] = result[i][countField];
			}
			// Map to defaultAgeData for consistent output
			return defaultAgeData.map(records => {
				const ageRange = records['age'];
				const value = dataGraphJson[ageRange] ? dataGraphJson[ageRange] : 0;
				return {
					'age': ageRange,
					[resultField]: value,
				};
			});
		};

		// Run all three aggregations in parallel for faster response
		const [pollVotesAgeWise, pollCommentsAgeWise, pollSharesAgeWise] = await Promise.all([
			aggregateByAge(pollVoteParticipants, "total_votes", "votes"),
			aggregateByAge(pollComments, "total_comment", "comments"),
			aggregateByAge(pollShareIcons, "total_shares", "shares"),
		]);

		// Merge the results by age
		const ageGraphData = {};
		for (let i = 0; i < defaultAgeData.length; i++) {
			const age = defaultAgeData[i]['age'];
			const pollVote = pollVotesAgeWise[i]['votes'] || 0;
			const pollComment = pollCommentsAgeWise[i]['comments'] || 0;
			const pollShares = pollSharesAgeWise[i]['shares'] || 0;
			ageGraphData[age] = pollVote + pollComment + pollShares;
		}

		// Prepare the final result array
		const totalData = defaultAgeData.map(records => ({
			'age': records['age'],
			'interactions': ageGraphData[records['age']] ? ageGraphData[records['age']] : 0
		}));

		// Success response
		return {
			'status': STATUS_SUCCESS,
			'result': totalData,
			'message': "",
		};
	} catch (err) {
		// Error response
		return {
			'status': STATUS_ERROR,
			'result': 0,
			"message": res.__("front.global.no_record_found"),
		};
	}
}; // End pollPerformanceInteractionAge

/**
 * Function to get the count of poll followers and non-followers.
 * Uses async/await and runs all queries in parallel for faster response.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, from_date, and to_date.
 * 
 * @returns {Promise} A promise that resolves with the count of poll followers and non-followers.
 */
pollFollowersVsNonFollowers = async (req, res, options) => {
	try {
		const userId = options.user_id || "";
		const fromDate = options.from_date || "";
		const toDate = options.to_date || "";

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const pollComments = db.collection(TABLE_POLLS_COMMENTS);
		const pollShareIcons = db.collection(TABLE_SHARE_ICON_LOGS);

		// Build common condition for queries
		let commonCondition = {
			"make_poll_user_id": userId,
			"user_id": { $nin: ['', null] },
		};

		// Add date range condition if provided
		if (fromDate && toDate) {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Build conditions for followers and non-followers
		const followersCondition = { ...commonCondition, is_followers: FOLLOWERS };
		const nonFollowersCondition = { ...commonCondition, is_followers: NON_FOLLOWERS };

		// Run all count queries in parallel using Promise.all
		const [
			pollFollowersVotes,
			pollNonFollowersVotes,
			pollFollowersComments,
			pollNonFollowersComments,
			pollFollowersShares,
			pollNonFollowersShares
		] = await Promise.all([
			pollVoteParticipants.countDocuments(followersCondition),
			pollVoteParticipants.countDocuments(nonFollowersCondition),
			pollComments.countDocuments(followersCondition),
			pollComments.countDocuments(nonFollowersCondition),
			pollShareIcons.countDocuments(followersCondition),
			pollShareIcons.countDocuments(nonFollowersCondition)
		]);

		// Calculate totals
		const totalFollowers = Number(pollFollowersVotes + pollFollowersComments + pollFollowersShares);
		const totalNonFollowers = Number(pollNonFollowersVotes + pollNonFollowersComments + pollNonFollowersShares);

		// Success response
		return {
			status: STATUS_SUCCESS,
			result: {
				total_followers: totalFollowers,
				total_non_followers: totalNonFollowers,
			},
			message: "",
		};
	} catch (err) {
		// Error response
		return {
			status: STATUS_ERROR,
			result: {
				total_followers: 0,
				total_non_followers: 0,
			},
			message: res.__("front.global.no_record_found"),
		};
	}
}; // End pollFollowersVsNonFollowers()

/**
 * Function to get the performance of poll participants (repeat vs new) using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, from_date, and to_date.
 * 
 * @returns {Promise} A promise that resolves with the performance of poll participants.
 */
pollPerformanceRepeatVsNewParticipants = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";

		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const pollComments = db.collection(TABLE_POLLS_COMMENTS);
		const pollShareIcons = db.collection(TABLE_SHARE_ICON_LOGS);

		// Build common condition for poll owner
		let commonCondition = {
			"make_poll_user_id": userId,
		};

		// Add date range condition if provided
		if (fromDate !== "" && toDate !== "") {
			commonCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Set dynamic timezone
		const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE; // America/Los_Angeles

		// Helper function to process aggregation results for votes/comments/shares
		const processAggregateResult = (result, totalField) => {
			let totalUnique = 0;
			let totalSum = 0;
			let unRegistered = 0;

			for (const record of result) {
				const count = record[totalField] || 0;
				totalSum += count;

				// Registered user
				if (record._id && record._id.user_id) {
					if (count > 0) totalUnique += 1;
				}
				// Unregistered user
				if (record._id && (record._id.user_id === null || record._id.user_id === "")) {
					unRegistered += count;
				}
			}

			return {
				totalRepeat: (totalSum - unRegistered) - totalUnique,
				totalUnique: totalUnique
			};
		};

		// Prepare aggregation pipelines for each collection
		const votePipeline = [
			{ "$match": commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: {
						"user_id": "$user_id",
						"poll_slug": "$poll_slug",
					},
					"total_vote": { $sum: 1 }
				}
			},
		];

		const commentPipeline = [
			{ "$match": commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: {
						"user_id": "$user_id",
						"poll_slug": "$poll_slug",
					},
					"total_comment": { $sum: 1 }
				}
			},
		];

		const sharePipeline = [
			{ "$match": commonCondition },
			{
				$addFields: {
					created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
				}
			},
			{
				$group: {
					_id: {
						"user_id": "$user_id",
						"poll_slug": "$poll_slug",
					},
					"total_shares": { $sum: 1 }
				}
			},
		];

		// Run all three aggregations in parallel for faster response
		const [
			voteResult,
			commentResult,
			shareResult
		] = await Promise.all([
			pollVoteParticipants.aggregate(votePipeline).toArray(),
			pollComments.aggregate(commentPipeline).toArray(),
			pollShareIcons.aggregate(sharePipeline).toArray()
		]);

		// Process results
		const voteStats = processAggregateResult(voteResult, "total_vote");
		const commentStats = processAggregateResult(commentResult, "total_comment");
		const shareStats = processAggregateResult(shareResult, "total_shares");

		// Prepare response
		return {
			status: STATUS_SUCCESS,
			all_response: {
				poll_votes: {
					total_repeat_votes: voteStats.totalRepeat,
					total_unique_votes: voteStats.totalUnique
				},
				poll_comments: {
					total_repeat_comment: commentStats.totalRepeat,
					total_unique_comment: commentStats.totalUnique
				},
				poll_shares: {
					total_repeat_share: shareStats.totalRepeat,
					total_unique_share: shareStats.totalUnique
				}
			},
			result: {
				total_repeat: Number(voteStats.totalRepeat + commentStats.totalRepeat + shareStats.totalRepeat),
				total_unique: Number(voteStats.totalUnique + commentStats.totalUnique + shareStats.totalUnique),
			},
			message: "",
		};
	} catch (err) {
		// Error response
		return {
			status: STATUS_ERROR,
			result: {
				total_repeat: 0,
				total_unique: 0,
			},
			message: res.__("front.global.no_record_found"),
		};
	}
}; // End pollPerformanceRepeatVsNewParticipants()

/**
 * Function to get the performance of lead generation using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, gender, zip_code, and age.
 * 
 * @returns {Promise} A promise that resolves with the performance of lead generation.
 */
pollPerformanceLeadGeneration = async (req, res, options) => {
	try {
		// Extract filters from options
		const userId = options.user_id || "";
		const gender = options.gender || "";
		const zipCode = options.zip_code || "";
		const ageFilter = options.age || "";

		const pollsViewLogs = db.collection(TABLE_POLL_VIEW_LOGS);
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

		// Build common condition for queries
		let commonCondition = {
			"make_poll_user_id": userId,
		};
		if (gender !== "") {
			commonCondition["gender"] = gender;
		}
		if (zipCode !== "") {
			commonCondition["zip"] = zipCode;
		}
		if (ageFilter !== "") {
			if (ageFilter == UNDER_18) {
				// Under 18 age
				commonCondition["age"] = {
					$gte: parseInt(NO_AGE),
					$lt: parseInt(AGE_18),
				};
			} else if (ageFilter == AGE_OVER_CONSTANT) {
				// Over 70 age
				commonCondition["age"] = {
					$gt: parseInt(AGE_OVER_70),
					$ne: "",
				};
			} else if (ageFilter == NO_AGE_CONSTANT) {
				// No age
				commonCondition["age"] = {
					$eq: "",
				};
			} else {
				// Age range (e.g., "18-24")
				let findexIndex = ageFilter.indexOf("-");
				let startAge = ageFilter.substr(0, findexIndex);
				let endAge = ageFilter.substr(findexIndex + 1, ageFilter.length);
				commonCondition["age"] = {
					$gte: parseInt(startAge),
					$lte: parseInt(endAge),
				};
			}
		}

		const viewItemConditions = {
			...commonCondition,
			is_viewed: VIEWED,
			template_type: POLL_SEND_REWARDS_TYPE
		};
		const redmeedItemConditions = {
			...commonCondition,
			is_redemed: REDEMED,
			template_type: POLL_SEND_REWARDS_TYPE
		};

		// Run all queries in parallel for better performance
		const [
			totalViewedPolls,
			totalViewedItems,
			totalRedeemedItems,
			afterLoginVotesResult
		] = await Promise.all([
			// Get viewed polls count
			pollsViewLogs.countDocuments(commonCondition),
			// Get viewed items count
			earnSentRewards.countDocuments(viewItemConditions),
			// Get redeemed items count
			earnSentRewards.countDocuments(redmeedItemConditions),
			// Get opt-in polls count and related stats
			(async () => {
				const totalPollsOptinsResult = await pollVoteParticipants.aggregate([
					{ $match: commonCondition },
					{
						$group: {
							_id: {
								"poll_slug": "$poll_slug",
								"user_id": "$user_id"
							},
							"myCount": { $sum: 1 }
						}
					}
				]).toArray();

				let totalVotesSumCount = 0;
				let totalOptinVotes = 0;
				let totalOptinCount = 0;
				let totalUniqueVotes = 0;
				let unRegisteredVotes = 0;

				for (const recordsData of totalPollsOptinsResult) {
					totalVotesSumCount += recordsData['myCount'];

					// Login user
					if (recordsData && recordsData['_id'] && recordsData['_id']['user_id']) {
						if (recordsData.myCount > 0) {
							totalUniqueVotes += 1;
						}
						totalOptinCount += 1;
						totalOptinVotes += recordsData['myCount'];
					}

					// Without login
					if (recordsData && recordsData['_id'] && (recordsData['_id']['user_id'] == null || recordsData['_id']['user_id'] === "")) {
						unRegisteredVotes += recordsData['myCount'];
					}
				}

				return {
					total_votes: totalVotesSumCount,
					total_optin_votes: totalOptinVotes,
					total_unique_votes: totalUniqueVotes,
					signed_out_users: unRegisteredVotes,
					total_repeat_votes: (totalVotesSumCount - unRegisteredVotes) - totalUniqueVotes,
					total_optin_length: totalOptinCount,
					totalPollsOptinsResult: totalPollsOptinsResult,
				};
			})()
		]);

		// Extract after login votes stats
		const afterLoginVotes = afterLoginVotesResult || {};
		const totalVotedPolls = afterLoginVotes.total_votes || 0;
		const allTotalSignedoutVotes = afterLoginVotes.signed_out_users || 0;
		const totalOptinLength = afterLoginVotes.total_optin_length || 0;
		const totalRepeatVotes = afterLoginVotes.total_repeat_votes || 0;
		const totalUniqueVotes = afterLoginVotes.total_unique_votes || 0;

		// Calculate opt-in rate percentage
		let optinRatePercentage = 0;
		if ((totalVotedPolls - totalRepeatVotes) > 0) {
			optinRatePercentage = (totalUniqueVotes / (totalVotedPolls - totalRepeatVotes)) * 100;
		}

		// Prepare and return success response
		return {
			status: STATUS_SUCCESS,
			result: {
				viewed_polls: totalViewedPolls,
				voted_polls: totalVotedPolls,
				signed_out_votes: allTotalSignedoutVotes,
				opted_in: totalOptinLength,
				viewed_items: totalViewedItems,
				redeemed_items: totalRedeemedItems,
				viewed_polls_percentage: calculatePercentage(totalViewedPolls, totalViewedPolls),
				voted_polls_percentage: calculatePercentage(totalVotedPolls, totalViewedPolls),
				opted_in_percentage: optinRatePercentage ? round(optinRatePercentage) : 0,
				viewed_items_percentage: calculatePercentage(totalViewedItems, totalViewedPolls),
				redeemed_items_percentage: calculatePercentage(totalRedeemedItems, totalViewedPolls)
			},
			message: "",
		};
	} catch (err) {
		// Prepare and return error response
		return {
			status: STATUS_ERROR,
			result: {
				viewed_polls: 0,
				voted_polls: 0,
				signed_out_votes: 0,
				opted_in: 0,
				viewed_items: 0,
				redeemed_items: 0,
				viewed_polls_percentage: 0,
				voted_polls_percentage: 0,
				opted_in_percentage: 0,
				viewed_items_percentage: 0,
				redeemed_items_percentage: 0
			},
			message: res.__("front.global.no_record_found"),
		};
	}
}; // End pollPerformanceLeadGeneration()

/**
 * Function to save an assumption report using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, poll_ids, report_name, report_description, from_date, and to_date.
 * 
 * @returns {Promise} A promise that resolves with the result of saving the assumption report.
 */
saveAssumptionReport = async (req, res, options) => {
	try {
		const userId = options.user_id || "";
		const pollIds = options.poll_ids || [];
		const reportName = options.report_name || "";
		const reportDescription = options.report_description || "";
		const fromDate = options.from_date || "";
		const toDate = options.to_date || "";

		const assumptionReport = db.collection(TABLE_ASSUMPTION_REPORTS);
		const polls = db.collection(TABLE_POLLS);

		// Validate required fields
		if (!userId || !reportName || !reportDescription || !fromDate || !toDate) {
			return {
				data: {
					status: STATUS_ERROR,
					assumption_report_slug: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
		}

		// Convert poll IDs to ObjectId
		const pollIdsArray = pollIds.map(id => newObjectIdDefault(id));

		const pollCondition = {
			"_id": { $in: pollIdsArray },
			"is_published": POLL_PUBLISHED,
			"user_id": newObjectIdDefault(userId)
		};

		// Aggregate poll slugs for the selected polls
		const pollResult = await polls.aggregate([
			{ $match: pollCondition },
			{
				$group: {
					"_id": null,
					"poll_slugs": { $addToSet: '$slug' },
				}
			}
		]).toArray();

		if (!pollResult || pollResult.length === 0) {
			// No published polls found for the given IDs
			return {
				status: STATUS_ERROR,
				assumption_report_slug: '',
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}

		if (pollResult[0]['poll_slugs'].length !== pollIds.length) {
			// Not all selected polls are published
			return {
				status: STATUS_ERROR,
				assumption_report_slug: '',
				message: res.__("front.polls.please_select_published_poll"),
			};
		}

		// Generate slug for the report
		const slugOptions = {
			title: reportName,
			table_name: TABLE_ASSUMPTION_REPORTS,
			slug_field: "slug"
		};

		// Convert simple date to Mongo date
		const fromMongoDate = newDate(fromDate + START_DATE);
		const toMongoDate = newDate(toDate + END_DATE);

		// Generate slug and insert the report in parallel for efficiency
		const slugResponse = await getDatabaseSlug(slugOptions);
		const assumptionReportSlug = (slugResponse && slugResponse.title) ? slugResponse.title : "";

		// Prepare the report document
		const reportDoc = {
			'user_id': userId,
			'slug': assumptionReportSlug,
			'poll_ids': pollIdsArray,
			'poll_slugs': pollResult[0]['poll_slugs'],
			'report_name': reportName,
			'report_description': reportDescription,
			'is_deleted': NOT_DELETED,
			'from_date_simple': fromDate,
			'to_date_simple': toDate,
			'from_date': fromMongoDate,
			'to_date': toMongoDate,
			'date_calculations': diffYearMonthWeekDay(fromMongoDate, toMongoDate),
			'week_count': weeksBetween(fromMongoDate, toMongoDate),
			'created': getUtcDate(),
		};

		await assumptionReport.insertOne(reportDoc);

		// Success response
		return {
			status: STATUS_SUCCESS,
			assumption_report_slug: assumptionReportSlug,
			message: res.__("front.polls.assumption_report_has_been_added_successfully"),
		};
	} catch (err) {
		// Error response
		return {
			status: STATUS_ERROR,
			assumption_report_slug: '',
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End saveAssumptionReport()

/**
 * Function to save a poll embed code using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, poll_slug, embed_name, account_type, gender, unique_browser_id, and is_view_type.
 * 
 * @returns {Promise} A promise that resolves with the result of saving the poll embed code.
 */
savePollEmbedCode = async (req, res, options) => {
	try {
		const userId = options.user_id ? options.user_id : "";
		const pollSlug = options.poll_slug ? options.poll_slug : "";
		const embedName = options.embed_name ? options.embed_name : "";
		const accountType = options.account_type ? options.account_type : "";
		const gender = options.gender ? options.gender : "";
		const uniqueBrowserId = options.unique_browser_id ? options.unique_browser_id : "";
		const isViewType = options.is_view_type ? options.is_view_type : "";

		const polls = db.collection(TABLE_POLLS);
		const pollEmbedTable = db.collection(TABLE_POLL_EMBED_GENERATE);

		// Validate required fields
		if (pollSlug === '' || embedName === '') {
			return {
				status: STATUS_ERROR,
				errors: res.__("front.polls.please_enter_valid_embed_name"),
				result: '',
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}

		// Find poll data by slug
		const pollsResult = await polls.findOne(
			{ slug: pollSlug },
			{ projection: { user_id: 1, custom_url: 1, question: 1, created: 1 } }
		);

		if (!pollsResult) {
			// Error response if poll not found
			return {
				status: STATUS_ERROR,
				errors: '',
				result: '',
				message: res.__("front.global.no_record_found"),
			};
		}

		const makePollUserId = pollsResult.user_id ? pollsResult.user_id : "";

		const embedCondition = {
			embed_name: { $regex: "^" + embedName + "$", $options: "i" },
			poll_slug: pollSlug,
			user_id: userId
		};

		// Check if embed already exists
		const embedResult = await pollEmbedTable.findOne(embedCondition);

		if (embedResult) {
			// Success response if already exists
			return {
				status: STATUS_SUCCESS,
				result: embedResult.iframe,
				errors: '',
				message: res.__("front.polls.poll_embed_added_successfully"),
			};
		}

		// Generate slug for new embed
		const slugOptions = {
			title: embedName,
			table_name: TABLE_POLL_EMBED_GENERATE,
			slug_field: "slug"
		};
		const slugResponse = await getDatabaseSlug(slugOptions);
		const embedSlug = (slugResponse && slugResponse.title) ? slugResponse.title : "";

		// Generate embed code
		const resultEmbed = `<div id="pocialEmbedPollContainer" class="pocialEmbedPollContainer" data-pocial_generate_slug="${embedSlug}" ></div><script> (function (window, document) {var loader = function () {var script = document.createElement("script"), tag = document.getElementsByTagName("script")[0];script.src = "${EMBED_POLL_SCRIPT_URL}"+Math.random();tag.parentNode.insertBefore(script, tag);};window.addEventListener ? window.addEventListener("load", loader, false) : window.attachEvent("onload", loader);})(window, document);</script>`;

		// Prepare document for insertion
		const embedDoc = {
			ip: req.body.ip,
			slug: embedSlug,
			embed_name: embedName,
			user_id: userId,
			make_poll_user_id: makePollUserId,
			custom_url: pollsResult.custom_url ? pollsResult.custom_url : "",
			poll_id: pollsResult._id ? newObjectIdDefault(pollsResult._id) : "",
			poll_question: pollsResult.question ? pollsResult.question : "",
			poll_slug: pollSlug,
			poll_created: pollsResult.created ? pollsResult.created : "",
			unique_browser_id: uniqueBrowserId,
			account_type: userId ? accountType : "",
			gender: userId ? gender : "",
			view_type: isViewType,
			is_active: ACTIVE,
			is_deleted: NOT_DELETED,
			iframe: resultEmbed,
			created: getUtcDate()
		};

		// Insert new embed document
		await pollEmbedTable.insertOne(embedDoc);

		// Success response
		return {
			status: STATUS_SUCCESS,
			result: resultEmbed,
			errors: '',
			message: res.__("front.polls.poll_embed_added_successfully"),
		};
	} catch (err) {
		// Error response
		return {
			status: STATUS_ERROR,
			errors: '',
			result: '',
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End savePollEmbedCode()

/**
 * Function to view interaction poll details using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, poll_id, from_date, to_date, and gender_type.
 * 
 * @returns {Promise} A promise that resolves with the interaction poll details.
 */
viewInteractionPollDetails = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const pollId = options.poll_id ? newObjectIdDefault(options.poll_id) : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const genderType = options.gender_type ? options.gender_type : "";

		// Common condition for polls
		const commonCondition = {
			"_id": pollId,
			"user_id": userId,
		};

		// Option condition for vote count
		const optionCondition = {
			"poll_id": pollId,
			"make_poll_user_id": userId,
		};

		// Date filter for aggregation and count
		let dateWiseFilter = "";
		if (fromDate !== "" && toDate !== "") {
			const dateGte = getUtcDateSearchTimeZone(req, fromDate + START_DATE);
			const dateLte = getUtcDateSearchTimeZone(req, toDate + END_DATE);
			optionCondition["created"] = {
				$gte: dateGte,
				$lte: dateLte,
			};
			dateWiseFilter = {
				$gte: dateGte,
				$lte: dateLte,
			};
		}

		// Build lookup condition for gender and account type
		let lookupCondition = [{ $eq: ["$option_id", "$$optionId"] }];
		if (genderType) {
			lookupCondition = [
				{ $eq: ["$option_id", "$$optionId"] },
				{ $eq: ["$gender", genderType] },
			];
		}
		if (genderType == MALE || genderType == FEMALE || genderType == OTHER) {
			lookupCondition = [
				{ $eq: ["$option_id", "$$optionId"] },
				{ $eq: ["$gender", genderType] },
				{ $ne: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
			];
		}

		const polls = db.collection(TABLE_POLLS);
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// Run poll vote details aggregation and total vote count in parallel
		const [pollVoteDetails, totalCount] = await Promise.all([
			// Aggregation for poll vote details
			polls.aggregate([
				{ $match: commonCondition },
				{ $unwind: "$options" },
				{ $addFields: { "_id": "$options._id", "option_title": "$options.title", "options_type": "$options.type" } },
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { optionId: "$options._id" },
						pipeline: [
							{
								$match: {
									'created': dateWiseFilter,
									$expr: {
										$and: lookupCondition
									},
								}
							},
							{
								$group: {
									_id: {
										"option_id": "$option_id"
									},
									'total_vote': { $sum: 1 },
								}
							},
						],
						as: "optionDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"option_title": 1,
						"options_type": 1,
						"question": 1,
						"single_option_submitted_type": 1,
						"created": 1,
						"option_vote_count": {
							$cond: [
								{ $arrayElemAt: ["$optionDetails.total_vote", 0] },
								{ $arrayElemAt: ["$optionDetails.total_vote", 0] },
								0
							]
						},
					}
				},
			]).toArray(),
			// Count total poll votes
			pollVoteParticipants.countDocuments(optionCondition)
		]);

		let details = pollVoteDetails || [];
		let singleOptionSubmittedType = (details.length > 0) ? details[0]['single_option_submitted_type'] : "";

		// If poll type is single option, remove the first option
		if (details.length > 0 && singleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE) {
			details = details.slice(1);
		}

		// Calculate percentage and assign color codes
		if (details.length > 0) {
			let index = 0;
			details.forEach((recordsData) => {
				const optionVoteCount = recordsData.option_vote_count ? recordsData.option_vote_count : 0;
				const optionsType = recordsData.options_type ? recordsData.options_type : "";
				// Repeat color code array if needed
				if (PERFORMANCE_COLOR_CODE.length === index) {
					index = 0;
				}
				recordsData['percentage'] = calculatePercentage(optionVoteCount, totalCount);
				// Undecided color code change
				if (optionsType == POLL_UNDECIDED_OPTIONS) {
					recordsData['color_code'] = UNDECIDED_COLOR_CODE;
				} else {
					recordsData['color_code'] = PERFORMANCE_COLOR_CODE[index];
				}
				index++;
			});
		}

		// Success response
		return {
			status: STATUS_SUCCESS,
			poll_result: {
				question: (details.length > 0) ? details[0]['question'] : "",
				created: (details.length > 0) ? details[0]['created'] : "",
				total_count: totalCount
			},
			result: details,
			message: "",
		};
	} catch (err) {
		// Error response
		return {
			status: STATUS_ERROR,
			poll_result: {
				question: "",
				created: "",
				total_count: '',
			},
			result: [],
			message: res.__("front.global.no_record_found"),
		};
	}
}; // End viewInteractionPollDetails()

/**
 * Function to delete a performance assumption report using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id and assumption_id.
 * 
 * @returns {Promise} A promise that resolves with the result of deleting the performance assumption report.
 */
deletePerformanceAssumptionReport = async (req, res, options) => {
	try {
		// Extract userId and assumptionId from options
		const userId = options.user_id ? options.user_id : "";
		const assumptionId = options.assumption_id ? options.assumption_id : "";

		const assumptionReport = db.collection(TABLE_ASSUMPTION_REPORTS);

		// Build delete condition
		const deleteCondition = {
			"_id": newObjectIdDefault(assumptionId),
			"user_id": newObjectIdDefault(userId),
		};

		// Prepare update data to mark as deleted
		const updateData = {
			'is_deleted': DELETED,
			'modified': getUtcDate()
		};

		// Update the report to mark as deleted
		const updateResult = await assumptionReport.updateOne(deleteCondition, { $set: updateData });

		// Check if a document was modified
		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				status: STATUS_SUCCESS,
				result: '',
				message: res.__("front.poll_performance.assumption_report_has_been_delete_successfully")
			};
		} else {
			return {
				status: STATUS_ERROR,
				result: '',
				message: res.__("admin.system.something_going_wrong_please_try_again")
			};
		}
	} catch (err) {
		// Handle errors
		return {
			status: STATUS_ERROR,
			result: '',
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}; // End deletePerformanceAssumptionReport()


/**
 * Function to view the first section of a poll performance assumption report using async/await.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, poll_slug, from_date, and to_date.
 * 
 * @returns {Promise} A promise that resolves with the result of viewing the first section of the poll performance assumption report.
 */
assumptionReportViewFirstSection = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? options.user_id : "";
		const pollSlug = options.poll_slug ? options.poll_slug : [];
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";

		const polls = db.collection(TABLE_POLLS);

		// Build the common condition for polls
		const commonCondition = {
			"user_id": userId,
			"slug": { $in: pollSlug },
		};

		// Build date filter if both fromDate and toDate are provided
		let dateWiseFilter = "";
		if (fromDate !== "" && toDate !== "") {
			dateWiseFilter = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Aggregate poll data with vote participants using async/await
		const viewAssumptionReport = await polls.aggregate([
			{ $match: commonCondition },
			{
				$lookup: {
					from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
					let: { pollSlug: "$slug" },
					pipeline: [
						{
							$match: {
								'created': dateWiseFilter,
								$expr: {
									$and: [{ $eq: ["$poll_slug", "$$pollSlug"] }]
								},
							}
						},
						{
							$group: {
								_id: {
									"poll_slug": "$poll_slug",
									"user_id": "$user_id"
								},
								"user_and_poll_wise_count": { $sum: 1 },
							}
						},
					],
					as: "voteParticipants"
				}
			},
			{
				$addFields: {
					"uniqueVote": {
						$filter: {
							input: "$voteParticipants",
							as: "voteItems",
							cond: {
								$ne: ["$$voteItems._id.user_id", ""]
							}
						}
					},
				}
			},
			{
				$addFields: {
					"total_registered_vote_user": { $sum: { $sum: "$uniqueVote.user_and_poll_wise_count" } },
					"total_vote_poll_wise": { $sum: { $sum: "$voteParticipants.user_and_poll_wise_count" } },
					"total_unique_vote": { $size: "$uniqueVote" },
				}
			},
			{
				$project: {
					"_id": 1,
					"question": 1,
					"created": 1,
					"total_registered_vote_user": 1,
					"total_unregistered_vote_user": { $subtract: ["$total_vote_poll_wise", "$total_registered_vote_user"] },
					"total_vote": "$total_vote_poll_wise",
					"total_unique_vote": 1,
					"total_repeat_vote": 1, // This field is not calculated in aggregation, handled below
				}
			},
			{ $sort: { 'total_vote': SORT_DESC } }
		]).toArray();

		// If no data found, return error response
		if (!viewAssumptionReport || viewAssumptionReport.length === 0) {
			return {
				status: STATUS_ERROR,
				poll_result: {
					total_votes: 0,
					total_unique: 0,
					registered: 0,
					un_registered: 0,
					registered_percentage: 0,
					un_registered_percentage: 0,
					opt_in_rate: 0,
				},
				result: 0,
				message: res.__("front.global.no_record_found"),
			};
		}

		// Initialize counters
		let totalInsight = 0;
		let totalUniqueVotes = 0;
		let signedOutUsers = 0;
		let signInUsers = 0;

		// Calculate totals for all polls
		viewAssumptionReport.forEach(records => {
			const totalPollWiseVoteCount = Number(records.total_vote);
			const totalPollWiseUniqueCount = Number(records.total_unique_vote);
			const totalPollWiseloginUsers = Number(records.total_registered_vote_user);
			const totalPollWiseAnonymousUser = Number(records.total_unregistered_vote_user);

			totalInsight += totalPollWiseVoteCount;
			totalUniqueVotes += totalPollWiseUniqueCount;
			signInUsers += totalPollWiseloginUsers;
			signedOutUsers += totalPollWiseAnonymousUser;
		});

		// Calculate repeat votes, opt-in rate, and percentages
		const totalRepeatVote = (totalInsight - signedOutUsers) - totalUniqueVotes;
		const optinRatePercentage = (totalInsight - totalRepeatVote) > 0
			? (totalUniqueVotes / (totalInsight - totalRepeatVote)) * 100
			: 0;
		const registeredPercentage = calculatePercentage(signInUsers, totalInsight);
		const unRegisteredPercentage = calculatePercentage(signedOutUsers, totalInsight);
		const optIndustryStandardPercentage = Number(res.locals.settings["Site.opt_in_industry_standard_percentage"]);

		// Add percentage breakdown for each poll
		viewAssumptionReport.forEach((records, index) => {
			const totalPollWiseVoteCount = Number(records.total_vote);
			viewAssumptionReport[index]['percentage'] = calculatePercentage(totalPollWiseVoteCount, totalInsight);
		});

		// Return success response
		return {
			status: STATUS_SUCCESS,
			poll_result: {
				total_votes: totalInsight,
				total_unique: totalUniqueVotes,
				registered: signInUsers,
				un_registered: signedOutUsers,
				registered_percentage: registeredPercentage,
				un_registered_percentage: unRegisteredPercentage ? unRegisteredPercentage : 0,
				opt_in_rate: optinRatePercentage ? round(optinRatePercentage) : 0,
				opt_in_industry_standard_percentage_value: optIndustryStandardPercentage,
				opt_in_industry_standard_percentage: optinRatePercentage
					? round(optinRatePercentage / optIndustryStandardPercentage)
					: 0,
			},
			result: viewAssumptionReport,
			message: "",
		};
	} catch (err) {
		// Handle errors and return error response
		return {
			status: STATUS_ERROR,
			poll_result: {
				total_votes: 0,
				total_unique: 0,
				registered: 0,
				un_registered: 0,
				registered_percentage: 0,
				un_registered_percentage: 0,
				opt_in_rate: 0,
			},
			result: 0,
			message: res.__("front.global.no_record_found"),
		};
	}
}; // End assumptionReportViewFirstSection()

/**
 * Function to get the age range wise option vote count using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} optionData - The option data object containing user_id, poll_id, from_date, and to_date.
 * 
 * @returns {Promise} A promise that resolves with the age range wise option vote count.
 */
ageRangeWiseOptionVoteCount = async (req, res, optionData) => {
	try {
		const postCollection = db.collection(TABLE_POLLS);
		const userId = optionData.user_id ? newObjectIdDefault(optionData.user_id) : "";
		const pollId = optionData.poll_id ? newObjectIdDefault(optionData.poll_id) : "";
		const fromDate = optionData.from_date ? optionData.from_date : "";
		const toDate = optionData.to_date ? optionData.to_date : "";

		// If no valid input, return empty array
		if (!userId && !pollId && !fromDate && !toDate) {
			return [];
		}

		// Prepare all age range queries in parallel
		const ageDropdownPromises = AGES_DROPDOWN.map(async (item) => {
			// Build aggregation pipeline for this age range
			const pipeline = [
				{
					$match: {
						'user_id': userId,
						"_id": pollId,
					}
				},
				{ "$unwind": "$options" },
				{ $addFields: { "_id": "$options._id", "option_title": "$options.title" } },
				{
					$lookup: {
						from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
						let: { optionId: "$options._id" },
						pipeline: [
							{
								$match: {
									'make_poll_user_id': userId,
									"poll_id": pollId,
									'created': {
										$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
										$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
									},
									"$and": item.conditon,
									$expr: {
										$and: [
											{ $eq: ["$option_id", "$$optionId"] },
										]
									},
								}
							},
							{
								$group: {
									_id: "$option_id",
									"option_title": { $first: "$options.title" },
									"poll_question": { $first: "$poll_question" },
									"total_vote": { $sum: 1 }
								}
							},
							{ $sort: { 'total_vote': SORT_DESC } }
						],
						as: "optionDetails"
					}
				},
				{
					$project: {
						"_id": 1,
						"option_title": 1,
						"poll_question": 1,
						"single_option_submitted_type": 1,
						"created": 1,
						"total_vote": {
							$cond: [
								{ $arrayElemAt: ["$optionDetails.total_vote", 0] },
								{ $arrayElemAt: ["$optionDetails.total_vote", 0] },
								0
							]
						},
					}
				},
			];

			// Run aggregation for this age range
			const ageOptionsResults = await postCollection.aggregate(pipeline).toArray();

			let pollVoteDetails = (ageOptionsResults && ageOptionsResults.length > 0) ? ageOptionsResults : [];
			let singleOptionSubmittedType = (pollVoteDetails.length > 0 && pollVoteDetails[0]['single_option_submitted_type']) ? pollVoteDetails[0]['single_option_submitted_type'] : "";

			// If poll type is single option, remove the first option
			let filteredResults = ageOptionsResults;
			if (pollVoteDetails.length > 0 && singleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE) {
				filteredResults = ageOptionsResults.slice(1);
			}

			// Only return if there are results
			if (filteredResults.length > 0) {
				return {
					"age": item.id,
					"total_sum_vote": filteredResults.reduce((n, { total_vote }) => n + total_vote, 0),
					"result": filteredResults
				};
			} else {
				return null;
			}
		});

		// Await all age range queries in parallel
		const ageDropdownArrayRaw = await Promise.all(ageDropdownPromises);

		// Filter out nulls (age ranges with no results)
		const ageDropdownArray = ageDropdownArrayRaw.filter(Boolean);

		return ageDropdownArray;
	} catch (err) {
		// On error, return empty array
		return [];
	}
}; // End ageRangeWiseOptionVoteCount()


/**
 * Asynchronously merges two arrays of objects by a specific property.
 * If an object with the same property value exists in the target, it is updated with the source's values.
 * Otherwise, the source object is pushed to the target.
 * 
 * @param {Array} target - The target array to merge into.
 * @param {Array} source - The source array to merge from.
 * @param {String} prop - The property to merge by.
 * 
 * @returns {Promise<Array>} The merged array.
 */
mergeByProperty = async (target, source, prop) => {
	try {
		// Run merge operations in parallel for faster execution
		await Promise.all(
			source.map(async (sourceElement) => {
				const targetElement = target.find(targetElement => sourceElement[prop] === targetElement[prop]);
				if (targetElement) {
					// Merge properties if found
					Object.assign(targetElement, sourceElement);
				} else {
					// Push new element if not found
					target.push(sourceElement);
				}
			})
		);
		return target;
	} catch (err) {
		// On error, return the original target array
		return target;
	}
}; // End mergeByProperty

/**
 * Function to get the age range wise poll and option vote count using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} optionData - The option data object containing user_id, poll_slugs, from_date, to_date, and gender_type.
 * 
 * @returns {Promise<Array>} A promise that resolves with the age range wise poll and option vote count.
 */
ageRangeWisePollAndOptionVoteCount = async (req, res, optionData) => {
	try {
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		const userId = optionData.user_id ? newObjectIdDefault(optionData.user_id) : "";
		const pollSlugs = optionData.poll_slugs ? optionData.poll_slugs : [];
		const fromDate = optionData.from_date ? optionData.from_date : "";
		const toDate = optionData.to_date ? optionData.to_date : "";
		const genderType = optionData.gender_type ? optionData.gender_type : "";

		// If no valid filters, return empty array
		if (!userId && pollSlugs.length === 0 && !fromDate && !toDate) {
			return [];
		}

		// Prepare all age range queries in parallel
		const ageDropdownPromises = AGES_DROPDOWN.map(async (item) => {
			// Build age and filter conditions
			const ageCondition = {
				'make_poll_user_id': newObjectIdDefault(userId),
				"poll_slug": { $in: pollSlugs },
				'created': {
					$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				},
				"$and": item.conditon
			};

			// Add gender filter if provided
			if (genderType) {
				ageCondition['gender'] = genderType;
			}

			// Aggregate age-wise poll and option vote count
			const ageOptionsResults = await pollVoteParticipants.aggregate([
				{ "$match": ageCondition },
				{
					$group: {
						_id: {
							"poll_slug": "$poll_slug",
							"option_id": "$option_id"
						},
						"poll_question": { $first: "$poll_question" },
						"option_title": { $first: "$options.title" },
						"total_vote": { $sum: 1 }
					}
				},
				{ $sort: { 'total_vote': SORT_DESC } },
				{
					"$group": {
						"_id": "$_id.poll_slug",
						"all_question_options": {
							"$push": {
								"option": "$_id.option_id",
								"count": "$total_vote",
								"poll_question": "$poll_question",
								"option_title": "$option_title"
							},
						},
						"total_vote": { "$first": "$total_vote" },
						"poll_question": { "$first": "$poll_question" },
						"option_title": { "$first": "$option_title" },
					}
				},
				{
					$project: {
						'_id': 1,
						'total_vote': 1,
						'poll_question': 1,
						'option_title': 1,
					}
				}
			]).toArray();

			// Only return if results exist for this age range
			if (ageOptionsResults && ageOptionsResults.length > 0) {
				return {
					"age": item.id,
					"result": ageOptionsResults
				};
			}
			return null;
		});

		// Await all age range queries in parallel
		const ageDropdownArrayRaw = await Promise.all(ageDropdownPromises);

		// Filter out nulls (age ranges with no results)
		const ageDropdownArray = ageDropdownArrayRaw.filter(Boolean);

		return ageDropdownArray;
	} catch (err) {
		// On error, return empty array
		return [];
	}
}; // End ageRangeWisePollAndOptionVoteCount()

/**
 * Function to save a poll segment using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, poll_ids, segment_type, segment_name, segment_description, from_date, to_date, is_draft, and editWiseSegmentSlug.
 * 
 * @returns {Promise} A promise that resolves with the result of saving the poll segment.
 */
savePollSegment = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const pollIds = options.poll_ids ? options.poll_ids : [];
		const segmentType = options.segment_type ? options.segment_type : COMMON_POLLS;
		const segmentName = options.segment_name ? options.segment_name : "";
		const segmentDescription = options.segment_description ? options.segment_description : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const isDraft = options.is_draft ? options.is_draft : SEGMENT_NOT_DRAFTS;
		const editWiseSegmentSlug = options.segment_slug ? options.segment_slug : "";

		const pollSegment = db.collection(TABLE_POLL_SEGMENT);
		const polls = db.collection(TABLE_POLLS);

		// Convert pollIds to ObjectId array
		const pollIdsArray = pollIds.map(id => newObjectIdDefault(id));

		const pollCondition = {
			"_id": { $in: pollIdsArray },
			"is_published": POLL_PUBLISHED,
			"user_id": userId
		};

		// Aggregate poll data to get poll_ids, poll_slugs, and poll_questions
		const pollResultArr = await polls.aggregate([
			{ $match: pollCondition },
			{
				$group: {
					"_id": null,
					"poll_ids": { $addToSet: '$_id' },
					"poll_slugs": { $addToSet: '$slug' },
					"poll_question": { $addToSet: '$question' },
				}
			}
		]).toArray();

		// Check if aggregation returned results
		if (pollResultArr && pollResultArr.length > 0) {
			const pollResult = pollResultArr[0];
			// Ensure all selected polls are published
			if (pollResult['poll_slugs'].length === pollIds.length) {
				if (editWiseSegmentSlug !== '') {
					// Update existing segment
					const demoGraphicsUpdateData = {
						'poll_ids': pollResult['poll_ids'],
						'poll_slugs': pollResult['poll_slugs'],
						'common_poll_question': pollResult['poll_question'],
						'segment_name': segmentName,
						'segment_description': segmentDescription,
						'is_draft': isDraft,
						'segment_type': segmentType,
						'voter_response': [],
						'voter_response_option_ids': [],
						'voter_response_poll_ids': [],
						'voter_response_poll_question': [],
						'voter_response_poll_slugs': [],
						'demographics_data': [],
					};

					await pollSegment.updateOne(
						{ 'slug': editWiseSegmentSlug, 'user_id': userId },
						{ $set: demoGraphicsUpdateData }
					);

					return {
						'status': STATUS_SUCCESS,
						'segment_slug': editWiseSegmentSlug,
						'message': (isDraft == SEGMENT_NOT_DRAFTS)
							? res.__("front.poll_segment.poll_segment_has_been_added_successfully")
							: res.__("front.poll_segment.draft_has_been_added_successfully"),
					};
				} else {
					// Generate slug for new segment
					const slugOptions = {
						title: segmentName,
						table_name: TABLE_POLL_SEGMENT,
						slug_field: "slug"
					};
					const slugResponse = await getDatabaseSlug(slugOptions);
					const segmentSlug = (slugResponse && slugResponse.title) ? slugResponse.title : "";

					// Insert new poll segment
					await pollSegment.insertOne({
						'user_id': userId,
						'slug': segmentSlug,
						'poll_ids': pollResult['poll_ids'],
						'poll_slugs': pollResult['poll_slugs'],
						'common_poll_question': pollResult['poll_question'],
						'segment_type': segmentType,
						'segment_name': segmentName,
						'segment_description': segmentDescription,
						'is_deleted': NOT_DELETED,
						'from_date': (fromDate == ALL_DATE_FILTER) ? ALL_DATE_FILTER : getUtcDate(fromDate + START_DATE),
						'to_date': getUtcDate(toDate + END_DATE),
						'simple_from_date': fromDate,
						'simple_to_date': toDate,
						'is_draft': isDraft,
						'created': getUtcDate(),
					});

					return {
						'status': STATUS_SUCCESS,
						'segment_slug': segmentSlug,
						'message': (isDraft == SEGMENT_NOT_DRAFTS)
							? res.__("front.poll_segment.poll_segment_has_been_added_successfully")
							: res.__("front.poll_segment.draft_has_been_added_successfully"),
					};
				}
			} else {
				// Not all selected polls are published
				return {
					'status': STATUS_ERROR,
					'segment_slug': "",
					'message': res.__("front.polls.please_select_published_poll"),
				};
			}
		} else {
			// Aggregation failed or no results
			return {
				'status': STATUS_ERROR,
				'segment_slug': "",
				'message': res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle errors and return error response
		return {
			'status': STATUS_ERROR,
			'segment_slug': "",
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End savePollSegment()

/**
 * Function to edit a poll common segment using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, poll_ids, from_date, to_date, is_draft, and segment_slug.
 * 
 * @returns {Promise} A promise that resolves with the result of editing the poll common segment.
 */
editPollCommonSegment = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const pollIds = options.poll_ids ? options.poll_ids : [];
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const isDraft = options.is_draft ? options.is_draft : SEGMENT_NOT_DRAFTS;
		const segmentSlug = options.segment_slug ? options.segment_slug : "";

		const pollSegment = db.collection(TABLE_POLL_SEGMENT);
		const polls = db.collection(TABLE_POLLS);

		// Convert pollIds to ObjectId array
		const pollIdsArray = pollIds.map(id => newObjectIdDefault(id));

		// Build poll condition for aggregation
		const pollCondition = {
			"_id": { $in: pollIdsArray },
			"is_published": POLL_PUBLISHED,
			"user_id": userId
		};

		// Aggregate poll data to get poll_ids, poll_slugs, and poll_question
		const pollResult = await polls.aggregate([
			{ $match: pollCondition },
			{
				$group: {
					"_id": null,
					"poll_ids": { $addToSet: '$_id' },
					"poll_slugs": { $addToSet: '$slug' },
					"poll_question": { $addToSet: '$question' },
				}
			}
		]).toArray();

		// Check if aggregation returned results and all selected polls are published
		if (pollResult && pollResult.length > 0) {
			if (pollResult[0]['poll_slugs'].length === pollIds.length) {
				// Prepare update data for the segment
				const updateData = {
					'poll_ids': pollResult[0]['poll_ids'],
					'poll_slugs': pollResult[0]['poll_slugs'],
					'common_poll_question': pollResult[0]['poll_question'],
					'from_date': (fromDate == ALL_DATE_FILTER) ? ALL_DATE_FILTER : getUtcDate(fromDate + START_DATE),
					'to_date': getUtcDate(toDate + END_DATE),
					'simple_from_date': fromDate,
					'simple_to_date': toDate,
					'is_draft': isDraft,
					'modified': getUtcDate(),
				};

				// Update the poll segment document
				await pollSegment.updateOne(
					{ 'user_id': userId, 'slug': segmentSlug },
					{ $set: updateData }
				);

				// Return success response
				return {
					'status': STATUS_SUCCESS,
					'segment_slug': segmentSlug,
					'message': res.__("front.poll_segment.draft_has_been_added_successfully"),
				};
			} else {
				// Not all selected polls are published
				return {
					'status': STATUS_ERROR,
					'segment_slug': "",
					'message': res.__("front.polls.please_select_published_poll"),
				};
			}
		} else {
			// Aggregation failed or no results
			return {
				'status': STATUS_ERROR,
				'segment_slug': "",
				'message': res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle errors and return error response
		return {
			'status': STATUS_ERROR,
			'segment_slug': "",
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End editPollCommonSegment()

/**
 * Function to save a poll voter response segment using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, voter_response_data, and segment_slug.
 * 
 * @returns {Promise} A promise that resolves with the result of saving the poll voter response segment.
 */
savePollVoterResponseSegment = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? options.user_id : "";
		const voterResponseData = options.voter_response_data ? options.voter_response_data : [];
		const segmentSlug = options.segment_slug ? options.segment_slug : "";

		// Prepare arrays for poll ids, option ids, slugs, and questions
		const pollIdsArray = [];
		const pollOptionIdsArray = [];
		const pollSlugsArray = [];
		const voterResponsePollQuestion = [];

		// Normalize and collect data for each voter response
		voterResponseData.forEach((recordsData) => {
			recordsData['poll_id'] = newObjectIdDefault(recordsData.poll_id);
			recordsData['option_id'] = newObjectIdDefault(recordsData.option_id);
			recordsData['serial_number'] = Number(recordsData.serial_number);
			recordsData['total_unique_vote'] = Number(recordsData.total_unique_vote);
			pollIdsArray.push(recordsData['poll_id']);
			pollOptionIdsArray.push(recordsData['option_id']);
			pollSlugsArray.push(recordsData.poll_slug);
			voterResponsePollQuestion.push(recordsData.poll_question);
		});

		// Get poll segment collection
		const pollSegment = db.collection(TABLE_POLL_SEGMENT);

		// Update the poll segment document with voter response data
		await pollSegment.updateOne(
			{
				'user_id': userId,
				'slug': segmentSlug,
			},
			{
				$set: {
					'segment_type': VOTER_RESPONSE,
					'voter_response_poll_ids': pollIdsArray,
					'voter_response_poll_slugs': pollSlugsArray,
					'voter_response': voterResponseData,
					'voter_response_option_ids': pollOptionIdsArray,
					'voter_response_poll_question': voterResponsePollQuestion,
					'modified': getUtcDate()
				},
			}
		);

		// Return success response
		return {
			'status': STATUS_SUCCESS,
			'message': res.__("front.poll_segment.voter_response_segment_has_been_save_successfully"),
		};
	} catch (err) {
		// Handle errors and return error response
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End savePollVoterResponseSegment()

/**
 * Function to delete a poll segment report using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id and segment_slug.
 * 
 * @returns {Promise} A promise that resolves with the result of deleting the poll segment report.
 */
deletePollSegmentReport = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const segmentSlug = options.segment_slug ? options.segment_slug : "";
		const pollSegment = db.collection(TABLE_POLL_SEGMENT);

		// Build the update condition and data
		const updateCondition = {
			"slug": segmentSlug,
			"user_id": userId,
		};
		const updateData = {
			$set: {
				'is_deleted': DELETED,
				'modified': getUtcDate()
			}
		};

		// Update the poll segment document to mark as deleted
		const updateResult = await pollSegment.updateOne(updateCondition, updateData);

		// Check if a document was modified
		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				"status": STATUS_SUCCESS,
				"result": '',
				"message": res.__("front.poll_segment.poll_segment_has_been_delete_successfully")
			};
		} else {
			return {
				"status": STATUS_ERROR,
				"result": '',
				"message": res.__("admin.system.something_going_wrong_please_try_again")
			};
		}
	} catch (err) {
		// Handle errors and return error response
		return {
			"status": STATUS_ERROR,
			"result": '',
			"message": res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}; // End deletePollSegmentReport()

/**
 * Function to edit a poll segment report using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, segment_slug, and segment_name.
 * 
 * @returns {Promise} A promise that resolves with the result of editing the poll segment report.
 */
editPollSegmentReport = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const segmentSlug = options.segment_slug ? options.segment_slug : "";
		const segmentName = options.segment_name ? options.segment_name : "";

		const pollSegment = db.collection(TABLE_POLL_SEGMENT);

		// Update the poll segment document with the new segment name and modified date
		const updateResult = await pollSegment.updateOne(
			{
				"slug": segmentSlug,
				"user_id": userId,
			},
			{
				$set: {
					'segment_name': segmentName,
					'modified': getUtcDate()
				}
			}
		);

		// Check if a document was modified
		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				"status": STATUS_SUCCESS,
				"result": '',
				"message": res.__("front.poll_segment.poll_segment_has_been_updated_successfully")
			};
		} else {
			return {
				"status": STATUS_ERROR,
				"result": '',
				"message": res.__("admin.system.something_going_wrong_please_try_again")
			};
		}
	} catch (err) {
		// Handle errors and return error response
		return {
			"status": STATUS_ERROR,
			"result": '',
			"message": res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}; // End editPollSegmentReport()

/**
 * Function to get the performance campaign breakdown for a poll.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing user_id, from_date, to_date, and poll_ids.
 * 
 * @returns {Promise} A promise that resolves with the performance campaign breakdown for the poll.
 */
pollPerformanceCampaignBreakdown = async (req, res, options) => {
	try {
		// Extract and normalize input options
		const userId = options.user_id ? options.user_id : "";
		const fromDate = options.from_date ? options.from_date : "";
		const toDate = options.to_date ? options.to_date : "";
		const pollIdsArray = options.poll_ids ? options.poll_ids : [];

		// Validate required fields
		if (!userId || pollIdsArray.length === 0 || !fromDate || !toDate) {
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
			};
		}

		const allSelectedPollsDetailsArray = [];

		// Loop through each pollId and process in series for consistent ordering
		for (const item of pollIdsArray) {
			const pollId = item ? newObjectIdDefault(item) : "";

			if (!pollId) {
				// If pollId is invalid, push empty result for this poll
				allSelectedPollsDetailsArray.push({
					'average_percentage': 0,
					'difference_from_average_height': 0,
					'difference_from_average_lowest': 0,
					'poll_result': {},
					'options_name': [],
					'options_color_code': [],
					'options': [],
					'male_options': [],
					'female_options': [],
					'age_range_array_vote': [],
				});
				continue;
			}

			// Prepare common options for queries
			const commonConditionOptions = {
				"user_id": newObjectIdDefault(userId),
				"poll_id": newObjectIdDefault(pollId),
				"from_date": fromDate,
				"to_date": toDate
			};

			const maleGenderCondition = { ...commonConditionOptions, gender_type: MALE };
			const femaleGenderCondition = { ...commonConditionOptions, gender_type: FEMALE };
			const ageOptionData = { ...commonConditionOptions };

			// Run all poll breakdown queries in parallel for this poll
			const [
				allOptionsData,
				maleOptionsData,
				femaleOptionsData,
				ageRangeOptionsData
			] = await Promise.all([
				viewInteractionPollDetails(req, res, commonConditionOptions),
				viewInteractionPollDetails(req, res, maleGenderCondition),
				viewInteractionPollDetails(req, res, femaleGenderCondition),
				ageRangeWiseOptionVoteCount(req, res, ageOptionData)
			]);

			// Extract results from responses
			const pollResult = (allOptionsData && allOptionsData['poll_result']) ? allOptionsData['poll_result'] : {};
			const allOptionPercentageResult = (allOptionsData && allOptionsData['result']) ? allOptionsData['result'] : [];
			const maleOptionPercentageResult = (maleOptionsData && maleOptionsData['result']) ? maleOptionsData['result'] : [];
			const femaleOptionPercentageResult = (femaleOptionsData && femaleOptionsData['result']) ? femaleOptionsData['result'] : [];
			const ageRangeOptions = Array.isArray(ageRangeOptionsData) ? ageRangeOptionsData : [];

			// Assign color codes and build male/female count arrays
			const colorCodeOptionGet = {};
			const optionNameBlankArray = [];
			if (maleOptionPercentageResult.length > 0) {
				maleOptionPercentageResult.forEach((records, index) => {
					optionNameBlankArray.push([]);
					colorCodeOptionGet[records['_id']] = records.color_code;
					maleOptionPercentageResult[index]['count_array_male_female'] = [
						femaleOptionPercentageResult[index]?.option_vote_count ?? 0,
						records.option_vote_count
					];
					femaleOptionPercentageResult[index]['count_array_male_female'] = [
						femaleOptionPercentageResult[index]?.option_vote_count ?? 0,
						records.option_vote_count
					];
				});
			}

			// Prepare arrays for age range breakdown
			const optionTitleNameArray = [];
			const optionColorCodeArray = [];
			const optionAllVoteArrayConcat = [];
			const higherPercentageTextData = [];
			const LowerPercentageTextData = [];

			// Calculate average and difference values for age graph
			const overallTotalVote = (pollResult && pollResult.total_count) ? pollResult.total_count : 0;
			const totalAgeGroup = AGE_COMBINE_ARRAY.length;
			const averagePercentage = round(overallTotalVote / totalAgeGroup);
			const differenceAverageGreaterValue = Number(res.locals.settings["Site.difference_from_this_average_is_greater_than"]);
			const differenceFromAverageHigher = averagePercentage + differenceAverageGreaterValue;
			const differenceFromAverageLower = differenceAverageGreaterValue - averagePercentage;

			// Assign color codes and calculate percentages for age range options
			if (ageRangeOptions.length > 0) {
				ageRangeOptions.forEach((recordsAge, recordsAgeIndex) => {
					const ageGroupName = recordsAge.age ? recordsAge.age : "";
					const totalSumVote = recordsAge.total_sum_vote ? recordsAge.total_sum_vote : 0;

					if (recordsAge && Array.isArray(recordsAge['result']) && recordsAge['result'].length > 0) {
						recordsAge['result'].forEach((recordsOption) => {
							recordsOption['color_code'] = colorCodeOptionGet[recordsOption._id];

							// Concat option title wise data
							const totalVote = recordsOption.total_vote ? recordsOption.total_vote : 0;
							optionAllVoteArrayConcat.push(totalVote);

							// Calculate percentage
							const optionPercentage = calculatePercentage(totalVote, totalSumVote);
							recordsOption['percentage'] = optionPercentage;

							// Push option name and color code for the first age group
							if (recordsAgeIndex === 0) {
								optionTitleNameArray.push(recordsOption.option_title);
								optionColorCodeArray.push(recordsOption.color_code);
							}

							// Calculate higher/lower percentage age graph text
							if (
								ageGroupName !== NO_AGE_CONSTANT &&
								totalVote !== 0 &&
								differenceFromAverageHigher < optionPercentage
							) {
								higherPercentageTextData.push({ age: ageGroupName, title: recordsOption.option_title });
							}
							if (
								ageGroupName !== NO_AGE_CONSTANT &&
								totalVote !== 0 &&
								differenceFromAverageLower > optionPercentage
							) {
								LowerPercentageTextData.push({ age: ageGroupName, title: recordsOption.option_title });
							}
						});
					}
				});
			}

			// Adjust matrix array for age range wise votes
			if (optionAllVoteArrayConcat.length > 0) {
				for (let i = 0; i < optionAllVoteArrayConcat.length; i++) {
					for (let j = 0; j < optionNameBlankArray.length; j++) {
						optionNameBlankArray[j].push(optionAllVoteArrayConcat[i]);
						if (j < (optionNameBlankArray.length - 1)) {
							i++;
						}
					}
				}
			}

			// Build and push the poll breakdown result
			allSelectedPollsDetailsArray.push({
				'higher_text': (higherPercentageTextData.length > 0) ? merageHeigherLowerArray(higherPercentageTextData) : [],
				'lower_text': (LowerPercentageTextData.length > 0) ? merageHeigherLowerArray(LowerPercentageTextData) : [],
				'average_percentage': averagePercentage,
				'difference_from_average_height': differenceFromAverageHigher,
				'difference_from_average_lowest': differenceFromAverageLower,
				'poll_result': pollResult,
				'options_name': optionTitleNameArray,
				'options_color_code': optionColorCodeArray,
				'options': allOptionPercentageResult,
				'male_options': maleOptionPercentageResult,
				'female_options': femaleOptionPercentageResult,
				'age_range_options': ageRangeOptions,
				'age_range_array_vote': optionNameBlankArray,
			});
		}

		// Return the final response
		return {
			status: STATUS_SUCCESS,
			age_combine_array: AGE_COMBINE_ARRAY,
			result: allSelectedPollsDetailsArray,
			message: ""
		};
	} catch (err) {
		// Handle errors and return error response
		return {
			status: STATUS_ERROR,
			age_combine_array: AGE_COMBINE_ARRAY,
			result: [],
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}; // End pollPerformanceCampaignBreakdown()

/** Merge array same age group higher lower */
merageHeigherLowerArray = (arrays) => {
	const map = new Map(arrays.map(({ title, age }) => [title, { title, age: [] }]));
	for (let { title, age } of arrays) map.get(title).age.push(...[age].flat());
	return [...map.values()];
} //End merageHeigherLowerArray();

/**
 * Function to get the unique vote options count segment using async/await for faster and cleaner execution.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} uniqueVoteOptions - The unique vote options object containing user_id, poll_id, from_date, and to_date.
 * 
 * @returns {Promise<Object>} A promise that resolves with the unique vote options count segment.
 */
uniqueVoteOptionsCountSegment = async (req, res, uniqueVoteOptions) => {
	try {
		// Extract and normalize input parameters
		const userId = uniqueVoteOptions.user_id ? newObjectIdDefault(uniqueVoteOptions.user_id) : "";
		const pollId = uniqueVoteOptions.poll_id ? newObjectIdDefault(uniqueVoteOptions.poll_id) : "";
		const fromDate = uniqueVoteOptions.from_date ? uniqueVoteOptions.from_date : "";
		const toDate = uniqueVoteOptions.to_date ? uniqueVoteOptions.to_date : "";

		// If no valid filters, return error response
		if (userId === '' && pollId === '' && fromDate === '' && toDate === '') {
			return {
				status: STATUS_ERROR,
				poll_url: POLLS_URL,
				result: {},
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}

		// Build lookup conditions for date and user
		let lookupDateConditions = {
			"user_id": { $nin: ["", null] },
			"latest_vote": DEFAULT_ONE,
			$expr: {
				$and: [
					{ $eq: ["$option_id", "$$optionId"] }
				]
			}
		};

		if (fromDate !== "" && toDate !== "") {
			if (fromDate === ALL_DATE_FILTER) {
				lookupDateConditions["created"] = {
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			} else {
				lookupDateConditions["created"] = {
					$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
					$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
				};
			}
		}

		const polls = db.collection(TABLE_POLLS);

		// Run aggregation query to get unique vote options count
		const pollVoteDetails = await polls.aggregate([
			{
				"$match": {
					'_id': pollId,
					'user_id': userId
				}
			},
			{ "$unwind": "$options" },
			{ "$addFields": { "options_id": "$options._id" } },
			{
				$lookup: {
					from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
					let: { optionId: "$options_id" },
					pipeline: [
						{
							$match: lookupDateConditions
						},
						{
							$group: {
								_id: {
									"user_id": "$user_id"
								},
								'total_vote': { $sum: 1 },
							}
						},
					],
					as: "optionVoteDetails"
				}
			},
			{
				$project: {
					"_id": 0,
					"poll_id": "$_id",
					"options_type": "$options_type",
					"poll_slug": "$slug",
					"option_id": "$options._id",
					"option_title": "$options.title",
					"optionVoteDetails": "$optionVoteDetails",
					'total_unique_vote': { $size: "$optionVoteDetails" },
					'single_option_submitted_type': "$single_option_submitted_type",
					"image": "$options.image",
					"video": "$options.video",
					"extension": "$options.extension",
				}
			},
		]).toArray();

		// If results found, process and return
		if (pollVoteDetails && pollVoteDetails.length > 0) {
			let singleOptionSubmittedType = pollVoteDetails[0]['single_option_submitted_type'] || "";

			// If poll type is single option, remove the first option
			let filteredDetails = pollVoteDetails;
			if (singleOptionSubmittedType === SINGLE_OPTION_SUBMITTED_TYPE) {
				filteredDetails = pollVoteDetails.slice(1);
			}

			// Add serial number to each record
			filteredDetails.forEach((record, index) => {
				record['serial_number'] = index + 1;
			});

			return {
				status: STATUS_SUCCESS,
				poll_url: POLLS_URL,
				result: filteredDetails,
				message: "",
			};
		} else {
			// No records found
			return {
				status: STATUS_ERROR,
				poll_url: POLLS_URL,
				result: {},
				message: res.__("front.global.no_record_found"),
			};
		}
	} catch (err) {
		// Handle errors and return error response
		return {
			status: STATUS_ERROR,
			poll_url: POLLS_URL,
			result: {},
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End uniqueVoteOptionsCountSegment()


/**
 * Get selected options data using async/await for faster and cleaner execution.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} selectedOptions - The selected options object.
 * @returns {Promise} A promise that resolves with the selected options data.
 */
getSelectedOptionsData = async (req, res, selectedOptions) => {
	try {
		// Extract and normalize input options
		const userId = selectedOptions.user_id ? newObjectIdDefault(selectedOptions.user_id) : "";
		const segmentSlug = selectedOptions.segment_slug ? selectedOptions.segment_slug : "";
		const listingType = selectedOptions.listing_type ? selectedOptions.listing_type : "";

		const pollSegment = db.collection(TABLE_POLL_SEGMENT);
		const polls = db.collection(TABLE_POLLS);

		// Fetch segment data
		const resultSegment = await pollSegment.findOne({
			'user_id': userId,
			'slug': segmentSlug,
		});

		if (!resultSegment) {
			// Segment not found or user not allowed
			return {
				'status': STATUS_ERROR,
				'users_url': USERS_URL,
				'polls_url': POLLS_URL,
				"segment_name": "",
				"segment_description": "",
				'result': "",
				'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
			};
		}

		// Extract segment details
		const segmentName = resultSegment.segment_name || "";
		const segmentDescription = resultSegment.segment_description || "";
		const voterResponseOptionIds = resultSegment.voter_response_option_ids || [];
		const commonPollIds = resultSegment.poll_ids || [];
		const fromDate = resultSegment.simple_from_date || "";
		const toDate = resultSegment.simple_to_date || "";
		const voterResponse = resultSegment.voter_response || "";
		const isDraft = resultSegment.is_draft || "";
		const segmentType = resultSegment.segment_type || "";
		const preserveNullAndEmptyArrays = (segmentType != COMMON_POLLS && isDraft == SEGMENT_NOT_DRAFTS) ? false : true;

		// Build lookup condition for date wise vote filter
		let lookupCondition = {
			"user_id": { $nin: ["", null] },
			$expr: {
				$and: [
					{ $eq: ["$poll_id", "$$pollId"] },
				]
			}
		};

		if (fromDate == ALL_DATE_FILTER) {
			lookupCondition["created"] = {
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		} else {
			lookupCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Build condition for poll/options
		let conditionData = {
			"options._id": { $in: voterResponseOptionIds }
		};

		if (listingType == COMMON_POLLS) {
			conditionData = {
				"_id": { $in: commonPollIds }
			};
		}

		// If no relevant options or polls, return error
		if (!(voterResponseOptionIds.length > 0 || commonPollIds.length > 0)) {
			return {
				'status': STATUS_ERROR,
				'users_url': USERS_URL,
				'polls_url': POLLS_URL,
				"segment_name": "",
				"segment_description": "",
				'result': "",
				'message': res.__("front.global.no_record_found"),
			};
		}

		// Aggregate poll data with lookups in parallel (single aggregate, but all lookups run in parallel in MongoDB)
		const segmentListResult = await polls.aggregate([
			{
				$match: conditionData
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
				$lookup: {
					from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
					let: { pollId: "$_id" },
					pipeline: [
						{ $match: lookupCondition },
						{ $project: { _id: 1 } },
						{ $count: "total_vote" }
					],
					as: "poll_vote"
				}
			},
			{
				$lookup: {
					from: TABLE_USERS,
					let: { userId: "$user_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$_id", "$$userId"] },
									]
								},
							}
						},
						{
							"$project": { full_name: 1, slug: 1, profile_image: 1 }
						}
					],
					as: "userDetails"
				}
			},
			{
				$project: {
					"question": 1,
					"slug": 1,
					"created": 1,
					"options_type": 1,
					"question_media": 1,
					"question_extension": 1,
					"question_video_name": 1,
					"category_name": { $arrayElemAt: ["$catDetails.name", 0] },
					'total_vote': {
						$cond: [
							{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
							{ $arrayElemAt: ["$poll_vote.total_vote", 0] },
							0
						]
					},
					"user_name": { $arrayElemAt: ["$userDetails.full_name", 0] },
					"user_profile_image": { $arrayElemAt: ["$userDetails.profile_image", 0] },
					"user_slug": { $arrayElemAt: ["$userDetails.slug", 0] },
					"option_details": {
						$filter: {
							input: "$options",
							as: "item",
							cond: { $in: ["$$item._id", voterResponseOptionIds] }
						}
					},
				}
			},
			{ $sort: { "total_vote": SORT_DESC } },
			{ $unwind: { path: "$option_details", preserveNullAndEmptyArrays: preserveNullAndEmptyArrays } },
		]).toArray();

		// Attach selected option details if available
		if (segmentListResult.length > 0) {
			segmentListResult.forEach((records, index) => {
				if (voterResponse.length > 0) {
					let selectedOptionObject = voterResponse.find(selectedOption => selectedOption.poll_slug == records.slug);
					selectedOptionObject = selectedOptionObject ? selectedOptionObject : "";
					segmentListResult[index]['selected_options_details'] = selectedOptionObject || "";
				} else {
					segmentListResult[index]['selected_options_details'] = "";
				}
			});
		}

		// Return success response
		return {
			'status': STATUS_SUCCESS,
			'users_url': USERS_URL,
			'polls_url': POLLS_URL,
			"segment_name": segmentName,
			"is_draft": isDraft,
			"segment_description": segmentDescription,
			'result': segmentListResult,
			'from_date': fromDate,
			'to_date': toDate,
			'message': ""
		};

	} catch (err) {
		// Handle errors and return error response
		return {
			'status': STATUS_ERROR,
			'users_url': USERS_URL,
			'polls_url': POLLS_URL,
			"segment_name": "",
			"segment_description": "",
			'result': "",
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End getSelectedOptionsData()


/**
 * Function to save segment demographics using async/await for faster and cleaner execution.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} options - The options object containing the demographics data.
 * @returns {Promise<Object>} A promise that resolves with a success or error response.
 */
saveSegmentDemographics = async (req, res, options) => {
	try {
		// Extract and normalize input parameters
		const userId = options.user_id ? options.user_id : "";
		const demographicsData = options.demographics_data ? options.demographics_data : [];
		const segmentSlug = options.segment_slug ? options.segment_slug : "";

		// Get poll segment collection
		const pollSegment = db.collection(TABLE_POLL_SEGMENT);

		// Update poll segment data with demographics using async/await
		const updateResult = await pollSegment.updateOne(
			{
				'user_id': userId,
				'slug': segmentSlug,
			},
			{
				$set: {
					'segment_type': DEMOGRAPHICS,
					'demographics': demographicsData,
					'modified': getUtcDate()
				},
			}
		);

		// Check if update was successful
		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				'status': STATUS_SUCCESS,
				'message': res.__("front.poll_segment.demographics_segment_has_been_save_successfully"),
			};
		} else {
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle errors and return error response
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End saveSegmentDemographics()

/**
 * Function to get the vote list option and poll wise using async/await for faster and cleaner execution.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} optionsVoterOptions - The options object containing the voter options.
 * @returns {Promise<Object>} A promise that resolves with the vote list option and poll wise data.
 */
voteListOptionAndPollWise = async (req, res, optionsVoterOptions) => {
	try {
		// Extract and normalize input parameters
		const loginUserId = optionsVoterOptions.login_user_id;
		const voterResponse = optionsVoterOptions.voter_response || [];
		const votedUserId = optionsVoterOptions.voted_user_id ? optionsVoterOptions.voted_user_id : "";
		const votedAccountType = optionsVoterOptions.voted_account_type ? optionsVoterOptions.voted_account_type : "";
		const voterResponseOptionIds = optionsVoterOptions.voter_response_option_ids || [];
		const segmentType = optionsVoterOptions.segment_type;
		const fromDate = optionsVoterOptions.from_date ? optionsVoterOptions.from_date : "";
		const toDate = optionsVoterOptions.to_date ? optionsVoterOptions.to_date : "";
		const demographicsData = optionsVoterOptions.demographics_data || {};
		const maleDemographicsData = demographicsData.male || [];
		const femaleDemographicsData = demographicsData.female || [];
		const otherDemographicsData = demographicsData.other || [];
		const businessDemographicsData = demographicsData.business || [];

		const pollsParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		let optionPushData = [];
		let compatibility = [];

		// Prepare all poll queries in parallel
		const pollOptionPromises = voterResponse.map(async (responsePollOptions) => {
			const pollId = newObjectIdDefault(responsePollOptions['poll_id']);
			let voteOptionCondition = {
				'make_poll_user_id': newObjectIdDefault(loginUserId),
				'user_id': votedUserId ? newObjectIdDefault(votedUserId) : "",
				'poll_id': pollId,
			};

			// Date wise vote filter
			if (fromDate !== '' && toDate !== '') {
				if (fromDate === ALL_DATE_FILTER) {
					voteOptionCondition["created"] = {
						$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
					};
				} else {
					voteOptionCondition["created"] = {
						$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
						$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
					};
				}
			}

			let genderData = [];
			let genderNinData = [];
			let ageData = [];

			// Demographics wise search poll data
			if (segmentType === DEMOGRAPHICS) {
				// Male demographics
				if (maleDemographicsData.length > 0) {
					genderData.push(MALE);
					ageData.push(maleDemographicsData);
				} else {
					genderNinData.push(MALE);
				}

				// Female demographics
				if (femaleDemographicsData.length > 0) {
					genderData.push(FEMALE);
					ageData.push(femaleDemographicsData);
				} else {
					genderNinData.push(FEMALE);
				}

				// Other demographics
				if (otherDemographicsData.length > 0) {
					genderData.push(OTHER);
					ageData.push(otherDemographicsData);
				} else {
					genderNinData.push(OTHER);
				}

				// Business demographics
				if (businessDemographicsData.length > 0) {
					ageData.push(businessDemographicsData);
				} else {
					voteOptionCondition['account_type'] = { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE };
				}

				// Age wise data push in condition
				let conditionAge = [];
				let newageDataArr = ageData.flat();

				newageDataArr.forEach(records => {
					let dataGender = (records === UNDER_18 || records === AGE_OVER_CONSTANT) ? records : records.split("-");
					if (records === UNDER_18) {
						conditionAge.push({ "age": { "$gte": 0, "$lt": AGE_18 } });
					} else if (records === AGE_OVER_CONSTANT) {
						conditionAge.push({ "age": { "$gt": AGE_OVER_70 } });
					} else {
						conditionAge.push({ "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
					}
				});

				// Gender wise append demographics
				if (genderData.length > 0) {
					voteOptionCondition['gender'] = { $in: genderData };
				} else {
					voteOptionCondition['gender'] = { $nin: genderNinData };
				}

				// Business type according to gender remove wise search data
				if (votedAccountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
					delete voteOptionCondition['gender'];
					voteOptionCondition['account_type'] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
				}

				// Age wise all append demographics
				if (newageDataArr.length > 0) {
					voteOptionCondition['$or'] = conditionAge;
				}
			}

			// Find vote option for this poll
			const resultOptions = await pollsParticipants.find(voteOptionCondition, { projection: { 'poll_question': 1, 'option_id': 1, 'options.title': 1, 'created': 1 } }).sort({ 'created': SORT_DESC }).limit(1).toArray();

			if (resultOptions && resultOptions.length > 0) {
				const resultOption = resultOptions[0];
				const votedOptionId = resultOption.option_id ? resultOption.option_id : "";
				const votedOptionTitle = (resultOption.options && resultOption.options.title) ? resultOption.options.title : "";
				const isInArray = voterResponseOptionIds.some(friend => friend.equals(votedOptionId));

				optionPushData.push({
					'poll_id': pollId,
					'option_id': votedOptionId,
					'option_title': votedOptionTitle,
					'exists': isInArray,
				});

				// If isInArray true, append to compatibility
				if (isInArray) {
					compatibility.push(isInArray);
				}
			} else {
				optionPushData.push({
					'poll_id': pollId,
					'option_id': "",
					'option_title': "",
					'exists': "",
				});
			}
		});

		// Run all poll queries in parallel
		await Promise.all(pollOptionPromises);

		return {
			'compatibility': calculatePercentage(compatibility.length, voterResponse.length),
			'option_push_data': optionPushData.sort(dynamicSort("poll_id")),
		};
	} catch (error) {
		console.log(error);
		return {
			'compatibility': 0,
			'option_push_data': [],
		};
	}
}; // End voteListOptionAndPollWise()

/**
 * Dynamic sort function.
 * @param {String} property - The property to sort by. If the property starts with a '-', the sort order will be descending.
 * @returns {Function} A sorting function that can be used to sort an array of objects.
 */
dynamicSort = (property) => {
	var sortOrder = 1;
	if (property[0] === "-") {
		sortOrder = -1;
		property = property.substr(1);
	}
	return function (a, b) {
		/* next line works with strings and numbers, 
		 * and you may want to customize it to your needs
		 */
		var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
		return result * sortOrder;
	}
} //End dynamicSort();

/**
 * Asynchronously checks if a user has voted only once per day for a given poll.
 * Uses async/await for faster and cleaner execution.
 * 
 * @param {String|ObjectId} userId - The user ID.
 * @param {String|ObjectId} pollId - The poll ID.
 * @returns {Promise<Number>} - The count of votes by the user for the poll on the current day.
 */
userCheckOneDayOnetimeVoteCheck = async (userId, pollId) => {
	try {
		// Normalize userId and pollId
		userId = userId ? newObjectIdDefault(userId) : "";
		pollId = pollId ? newObjectIdDefault(pollId) : "";
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// If either userId or pollId is missing, return 0
		if (!userId || !pollId) {
			return 0;
		}

		// Get the start and end of the current day
		const now = newDate();
		const startOfDay = newDate(now.setHours(0, 0, 0, 0));
		const endOfDay = newDate(now.setHours(23, 59, 59, 999));

		// Count documents matching the criteria
		const voteCount = await pollVoteParticipants.countDocuments({
			'poll_id': pollId,
			'user_id': userId,
			"created": {
				$gte: startOfDay,
				$lte: endOfDay
			}
		});

		return voteCount;
	} catch (err) {
		// On error, return 0
		return 0;
	}
}; // End userCheckOneDayOnetimeVoteCheck()

/**
 * Updates the business industry name for public business users using async/await.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} A promise that resolves with the response.
 */
updateUserBusinessIndustryName = async (req, res) => {
	try {
		const users = db.collection(TABLE_USERS);

		// Aggregate all public business users with a valid business industry
		const userList = await users.aggregate([
			{
				$match: {
					"is_deleted": NOT_DELETED,
					"account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
					'public_business_informaton.business_industry': { $nin: ['', null] }
				}
			},
			{
				$lookup: {
					from: TABLE_MASTERS,
					let: { businessIndustryId: "$public_business_informaton.business_industry" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$_id", "$$businessIndustryId"] },
										{ $eq: ["$dropdown_type", MASTER_BUSINESS_INDUSTRY] },
									]
								},
							}
						},
						{ "$project": { 'name': 1 } }
					],
					as: "businessMasterIndustry"
				}
			},
			{
				$project: {
					"_id": 1,
					"full_name": 1,
					"email": 1,
					"account_type": 1,
					"business_industry_name": { $arrayElemAt: ["$businessMasterIndustry.name", 0] },
				}
			},
		]).toArray();

		if (userList && userList.length > 0) {
			// Prepare all update queries in parallel for faster execution
			const updatePromises = userList.map(async (userRecord) => {
				const userId = userRecord._id ? userRecord._id : "";
				const industryName = userRecord.business_industry_name ? userRecord.business_industry_name : "";

				// Update the business industry name for each user
				await users.updateOne(
					{
						'_id': newObjectIdDefault(userId),
						"account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
					},
					{
						$set: {
							"public_business_informaton.business_industry_name": industryName
						},
					}
				);
			});

			// Wait for all updates to complete
			await Promise.all(updatePromises);

			return {
				'status': STATUS_SUCCESS,
				'message': res.__("admin.user.user_details_has_been_updated_successfully"),
			};
		} else {
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End updateUserBusinessIndustryName()

/**
 * Uploads a poll media image or video and updates the poll options data using async/await.
 * Handles file uploads and MongoDB updates with proper error handling and clean formatting.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<Object>} A promise that resolves with the response.
 */
uploadPollMediaImageVideType = async (req, res) => {
	try {
		const userId = req.body.user_id ? req.body.user_id : '';
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : '';
		const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : '';

		const pollOptionsImage = (req.files && req.files.options_image) ? req.files.options_image : "";
		const pollOptionsVideo = (req.files && req.files.options_video) ? req.files.options_video : "";
		const thumbnailOptionVideoImage = (req.files && req.files.thumbnail_option_video_image) ? req.files.thumbnail_option_video_image : "";

		let videoOptionsActive = !!pollOptionsVideo;
		let optionsVideThumbnailImageName = "";
		let errMessage = [];

		// Validate video file type if video is present
		if (videoOptionsActive) {
			videoOptionsActive = (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(pollOptionsVideo.mimetype) === -1) ? true : false;
		}

		// Validate that at least one media file is present
		if (!pollOptionsVideo && !pollOptionsImage) {
			errMessage.push({ 'param': 'options_image', 'msg': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE });
			return {
				'status': STATUS_ERROR,
				'front_status': STATUS_ERROR_FORM_VALIDATION,
				'message': errMessage
			};
		}

		// Prepare options for file upload
		const options = {
			'image': videoOptionsActive ? pollOptionsVideo : pollOptionsImage,
			'filePath': POLLS_FILE_PATH,
			'allowedExtensions': videoOptionsActive ? ALLOWED_VIDEO_EXTENSIONS : "",
			'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
			'allowedMimeTypes': videoOptionsActive ? ALLOWED_VIDEO_MIME_EXTENSIONS : "",
			'allowedMimeError': videoOptionsActive ? ALLOWED_VIDEO_MIME_ERROR_MESSAGE : "",
			'allowedSizeErrorMessage': videoOptionsActive ? ALLOWED_VIDEO_SIZE_MESSAGE : "",
			'size': videoOptionsActive ? ALLOWED_VIDEO_SIZE : "",
		};

		// Upload the main image or video file
		const imageOptionsresponse = await moveUploadedFile(req, res, options);

		if (imageOptionsresponse.status === STATUS_ERROR) {
			errMessage.push({ 'param': 'options_image', 'msg': imageOptionsresponse.message });
			return {
				'status': STATUS_ERROR,
				'front_status': STATUS_ERROR_FORM_VALIDATION,
				'message': errMessage
			};
		}

		// Get the uploaded file name and extension
		const optionsFileName = imageOptionsresponse.fileName ? imageOptionsresponse.fileName : "";
		const optionsMediaExtension = optionsFileName ? optionsFileName.slice((optionsFileName.lastIndexOf('.') + 1)) : "";

		// If video, upload the thumbnail image as well
		if (videoOptionsActive) {
			const thumbnailOptionsImage = {
				'image': thumbnailOptionVideoImage,
				'filePath': POLLS_FILE_PATH,
			};
			const thumbnailOptionsResponse = await moveUploadedFile(req, res, thumbnailOptionsImage);
			optionsVideThumbnailImageName = thumbnailOptionsResponse.fileName ? thumbnailOptionsResponse.fileName : "";
		}

		// Update poll option in the database
		const polls = db.collection(TABLE_POLLS);
		const updateResult = await polls.updateOne(
			{
				'slug': pollSlug,
				'user_id': userId,
				'options._id': optionId,
			},
			{
				$set: {
					'options.$.image': videoOptionsActive ? optionsVideThumbnailImageName : optionsFileName,
					'options.$.video': videoOptionsActive ? optionsFileName : "",
					'options.$.extension': optionsMediaExtension,
				},
			}
		);

		// Return success message if update was successful
		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				'status': STATUS_SUCCESS,
				'front_status': "",
				'message': res.__("front.polls.polls_individual_options_updated_successfully"),
			};
		} else {
			return {
				'status': STATUS_ERROR,
				'front_status': "",
				'message': res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		return {
			'status': STATUS_ERROR,
			'front_status': "",
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End uploadPollMediaImageVideType()

/**
 * Creates a poll with multiple options.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise} A promise that resolves with the response.
 */
// Rewritten to use async/await, with clear comments and clean formatting for faster response times.
createPollsQuestionWithMultipleOptions = async (req, res) => {
	let userId = req.body.user_id ? req.body.user_id : '';
	let pollSlug = req.body.poll_slug ? req.body.poll_slug : '';
	let question = req.body.question ? req.body.question : '';
	let questionMedia = (req.files && req.files.question_media) ? req.files.question_media : "";
	let questionVideo = (req.files && req.files.question_video) ? req.files.question_video : "";
	let thumbnailBannerVideoImage = (req.files && req.files.thumbnail_banner_video_image) ? req.files.thumbnail_banner_video_image : "";
	let oldQuestionMedia = req.body.old_question_media ? req.body.old_question_media : '';
	let oldQuestionVideo = req.body.old_question_video ? req.body.old_question_video : '';

	let optionsType = req.body.options_type ? req.body.options_type : '';
	let pollOptionsImage = (req.files && req.files.options_image) ? req.files.options_image : "";
	let pollOptionsVideo = (req.files && req.files.options_video) ? req.files.options_video : "";
	let thumbnailOptionVideoImage = (req.files && req.files.thumbnail_option_video_image) ? req.files.thumbnail_option_video_image : "";
	let isQuestionUpdatte = req.body.is_question_updatte ? JSON.parse(req.body.is_question_updatte) : false;
	let singleOptionSubmittedType = req.body.single_option_submitted_type ? req.body.single_option_submitted_type : "";
	let optionsArr = req.body.options ? JSON.parse(req.body.options) : [];

	let videoActive = !!questionVideo;
	let videoOptionsActive = !!pollOptionsVideo;
	let videThumbnailImageName = "";
	let optionsVideThumbnailImageName = "";
	let errMessage = [];

	const polls = db.collection(TABLE_POLLS);

	// Check if question video is actually a video (not an image)
	if (videoActive) {
		videoActive = (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(questionVideo.mimetype) === -1);
	}
	// Check if options video is actually a video (not an image)
	if (videoOptionsActive) {
		videoOptionsActive = (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(pollOptionsVideo.mimetype) === -1);
	}

	// Validate options media
	if (
		singleOptionSubmittedType != SINGLE_OPTION_SUBMITTED_TYPE &&
		!isQuestionUpdatte &&
		optionsType == MEDIA_POLL &&
		(!pollOptionsVideo && !pollOptionsImage)
	) {
		errMessage.push({ param: 'options_image', msg: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE });
		return {
			status: STATUS_ERROR,
			front_status: STATUS_ERROR_FORM_VALIDATION,
			message: errMessage
		};
	}

	// Prepare upload options for question media
	let optionsQuestion = {
		image: videoActive ? questionVideo : questionMedia,
		filePath: POLLS_FILE_PATH,
		oldPath: oldQuestionMedia,
		oldVideoPath: oldQuestionVideo,
		allowedExtensions: videoActive ? ALLOWED_VIDEO_EXTENSIONS : "",
		allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
		allowedMimeTypes: videoActive ? ALLOWED_VIDEO_MIME_EXTENSIONS : "",
		allowedMimeError: videoActive ? ALLOWED_VIDEO_MIME_ERROR_MESSAGE : "",
		allowedSizeErrorMessage: videoActive ? ALLOWED_VIDEO_SIZE_MESSAGE : "",
		size: videoActive ? ALLOWED_VIDEO_SIZE : "",
	};

	// Prepare upload options for poll options media
	let options = {
		image: videoOptionsActive ? pollOptionsVideo : pollOptionsImage,
		filePath: POLLS_FILE_PATH,
		allowedExtensions: videoOptionsActive ? ALLOWED_VIDEO_EXTENSIONS : "",
		allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
		allowedMimeTypes: videoOptionsActive ? ALLOWED_VIDEO_MIME_EXTENSIONS : "",
		allowedMimeError: videoOptionsActive ? ALLOWED_VIDEO_MIME_ERROR_MESSAGE : "",
		allowedSizeErrorMessage: videoOptionsActive ? ALLOWED_VIDEO_SIZE_MESSAGE : "",
		size: videoOptionsActive ? ALLOWED_VIDEO_SIZE : "",
	};

	try {
		// Upload question media and options media in parallel for speed
		const [imageQuestionResponse, imageOptionsresponse] = await Promise.all([
			moveUploadedFile(req, res, optionsQuestion),
			moveUploadedFile(req, res, options)
		]);

		// Handle question media upload error
		if (imageQuestionResponse.status === STATUS_ERROR) {
			errMessage.push({ param: 'question_media', msg: imageQuestionResponse.message });
			return {
				status: STATUS_ERROR,
				errors: parseValidationFrontApi(errMessage, req),
				message: parseValidationFrontApi(errMessage, req),
			};
		}

		// Handle options media upload error
		if (imageOptionsresponse.status === STATUS_ERROR) {
			errMessage.push({ param: 'options_image', msg: imageOptionsresponse.message });
			return {
				status: STATUS_ERROR,
				errors: parseValidationFrontApi(errMessage, req),
				message: parseValidationFrontApi(errMessage, req),
			};
		}

		// Extract file names and extensions
		let questionMediaName = imageQuestionResponse.fileName ? imageQuestionResponse.fileName : "";
		let optionsFileName = imageOptionsresponse.fileName ? imageOptionsresponse.fileName : "";
		let questionMediaExtension = questionMediaName ? questionMediaName.slice((questionMediaName.lastIndexOf('.') + 1)) : "";

		// If video, upload thumbnail for question
		if (videoActive) {
			let thumbnailBannerImage = {
				image: thumbnailBannerVideoImage,
				filePath: POLLS_FILE_PATH,
			};
			let thumbnailBannerResponse = await moveUploadedFile(req, res, thumbnailBannerImage);
			videThumbnailImageName = thumbnailBannerResponse.fileName ? thumbnailBannerResponse.fileName : "";
		}

		// Prepare update data for poll question
		let updateData = {
			question_media: videoActive ? videThumbnailImageName : questionMediaName,
		};

		if (question) updateData['question'] = question;
		if (optionsType) updateData['options_type'] = optionsType;

		// If video, set question_video_name
		if (videoActive) {
			updateData['question_video_name'] = questionMediaName;
		}
		// If image, clear question_video_name
		if (questionMedia && ALLOWED_IMAGE_EXTENSIONS.indexOf(questionMediaExtension) !== -1) {
			updateData['question_video_name'] = "";
		}
		// Save extension
		if (questionMedia || questionVideo) {
			updateData['question_extension'] = questionMediaExtension;
		}

		// Prepare options media extension
		let optionsMediaExtension = optionsFileName ? optionsFileName.slice((optionsFileName.lastIndexOf('.') + 1)) : "";

		// If video, upload thumbnail for options
		if (videoOptionsActive) {
			let thumbnailOptionsImage = {
				image: thumbnailOptionVideoImage,
				filePath: POLLS_FILE_PATH,
			};
			let thumbnailOptionsResponse = await moveUploadedFile(req, res, thumbnailOptionsImage);
			optionsVideThumbnailImageName = thumbnailOptionsResponse.fileName ? thumbnailOptionsResponse.fileName : "";
		}

		// If only updating question media
		if (isQuestionUpdatte) {
			await polls.updateOne(
				{ slug: pollSlug, user_id: userId },
				{ $set: updateData },
				{ upsert: true }
			);
			return {
				status: STATUS_SUCCESS,
				poll_slug: pollSlug,
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		}

		// Otherwise, create or update poll with options
		// Generate slug if needed
		let slugOptions = {
			title: question ? question : 'untitled',
			table_name: TABLE_POLLS,
			slug_field: "slug"
		};
		let slugResponse = await getDatabaseSlug(slugOptions);

		// Find poll data for options/hashtag
		let resultPollData = await polls.findOne(
			{ slug: pollSlug, user_id: userId },
			{ projection: { options: 1, hashtag: 1, single_option_submitted_type: 1 } }
		);

		let oldOptionData = (resultPollData && resultPollData.options) ? resultPollData.options : [];
		let alreadyHashtag = (resultPollData && resultPollData.hashtag) ? resultPollData.hashtag : "";
		let dbSingleOptionSubmittedType = (resultPollData && resultPollData.single_option_submitted_type) ? resultPollData.single_option_submitted_type : "";
		let hashtag = "";
		let newOptionsData = [];

		// Build new options data and hashtags
		if (optionsArr.length > 0) {
			for (let option of optionsArr) {
				let optionData = {
					_id: newObjectIdDefault(),
					title: option.options_title,
					image: videoOptionsActive ? optionsVideThumbnailImageName : optionsFileName,
					video: videoOptionsActive ? optionsFileName : "",
					extension: optionsMediaExtension,
					cta_title: "",
					cta_url: "",
					assign_reward: "",
					enticement_headline: "",
					total_count: 0,
					percentage: 0,
					type: POLL_DECIDED_OPTIONS,
					created: getUtcDate(),
				};
				hashtag += " #" + (option.options_title.replace(/\s+/g, '-')).toLowerCase();
				newOptionsData.push(optionData);
			}
		}

		let newHashtag = (alreadyHashtag + hashtag).trim();

		// If single option submitted type
		if (dbSingleOptionSubmittedType == SINGLE_OPTION_SUBMITTED_TYPE) {
			let undecidedOptions = oldOptionData.find(o => o.type === POLL_UNDECIDED_OPTIONS);
			let singleOptionsUpdateData = [];
			if (undecidedOptions && Object.keys(undecidedOptions).length > 0) {
				// Remove undecided from old options
				oldOptionData.length = oldOptionData.length - 1;
				// Add new options
				oldOptionData = oldOptionData.concat(newOptionsData);
				// Add undecided back
				oldOptionData.push(undecidedOptions);
				singleOptionsUpdateData = oldOptionData;
			} else {
				oldOptionData = oldOptionData.concat(newOptionsData);
				singleOptionsUpdateData = oldOptionData;
			}

			let updateOneOptionsData = {
				options: singleOptionsUpdateData
			};
			if (newHashtag) updateOneOptionsData['hashtag'] = newHashtag;

			await polls.updateOne(
				{ slug: pollSlug, user_id: userId },
				{ $set: updateOneOptionsData },
				{ upsert: true }
			);
			return {
				status: STATUS_SUCCESS,
				slug: pollSlug ? pollSlug : (slugResponse && slugResponse.title) ? slugResponse.title : "",
				result: {},
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		} else {
			// Not single option submitted type, handle undecided option
			let undecidedObjectValue = {
				_id: newObjectIdDefault(),
				title: POLL_UNDECIDED_TITLE,
				image: "",
				video: "",
				extension: "",
				cta_title: "",
				cta_url: "",
				assign_reward: "",
				enticement_headline: "",
				total_count: 0,
				percentage: 0,
				type: POLL_UNDECIDED_OPTIONS,
				created: getUtcDate(),
			};

			if (oldOptionData.length > 0) {
				undecidedObjectValue = oldOptionData[oldOptionData.length - 1];
				oldOptionData.length = oldOptionData.length - 1;
			}

			if (oldOptionData.length === 0) {
				newOptionsData.push(undecidedObjectValue);
				updateData['options'] = newOptionsData;
			} else if (oldOptionData.length > 0) {
				oldOptionData = [...oldOptionData, ...newOptionsData];
				oldOptionData.push(undecidedObjectValue);
				updateData['options'] = oldOptionData;
			}

			if (newHashtag) updateData['hashtag'] = newHashtag;

			await polls.updateOne(
				{ slug: pollSlug, user_id: userId },
				{
					$set: updateData,
					$setOnInsert: {
						user_id: userId,
						is_published: POLL_NOT_PUBLISHED,
						is_draft: POLL_DRAFT,
						is_deleted: NOT_DELETED,
						total_count: 0,
						real_time: true,
						custom_url: (slugResponse && slugResponse.title) ? slugResponse.title : "",
						type: SINGLE_POLL_TYPE,
						single_option_submitted_type: "",
						end_voting_period: false,
						slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
						created: getUtcDate(),
					}
				},
				{ upsert: true }
			);
			return {
				status: STATUS_SUCCESS,
				slug: pollSlug ? pollSlug : (slugResponse && slugResponse.title) ? slugResponse.title : "",
				result: {},
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		}
	} catch (err) {
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
};

/**
 * Uploads a manually selected image or video for a poll option using async/await for faster and cleaner execution.
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {String} userId - The ID of the user who is uploading the file.
 * @returns {Promise<Object>} A promise that resolves with the response.
 */
uploadManuallyImageAndVide = async (req, res, userId) => {
	try {
		const pollSlug = req.body.poll_slug ? req.body.poll_slug : '';
		const optionId = req.body.option_id ? newObjectIdDefault(req.body.option_id) : '';

		const pollOptionsImage = (req.files && req.files.options_image) ? req.files.options_image : "";
		const pollOptionsVideo = (req.files && req.files.options_video) ? req.files.options_video : "";
		const thumbnailOptionVideoImage = (req.files && req.files.thumbnail_option_video_image) ? req.files.thumbnail_option_video_image : "";

		let videoOptionsActive = !!pollOptionsVideo;
		let optionsVideThumbnailImageName = "";
		let errMessage = [];

		// Check if the uploaded file is a video (not an image)
		if (videoOptionsActive) {
			videoOptionsActive = (ALLOWED_IMAGE_MIME_EXTENSIONS.indexOf(pollOptionsVideo.mimetype) === -1);
		}

		// Prepare options for file upload
		const options = {
			'image': videoOptionsActive ? pollOptionsVideo : pollOptionsImage,
			'filePath': POLLS_FILE_PATH,
			'allowedExtensions': videoOptionsActive ? ALLOWED_VIDEO_EXTENSIONS : "",
			'allowedImageError': ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
			'allowedMimeTypes': videoOptionsActive ? ALLOWED_VIDEO_MIME_EXTENSIONS : "",
			'allowedMimeError': videoOptionsActive ? ALLOWED_VIDEO_MIME_ERROR_MESSAGE : "",
			'allowedSizeErrorMessage': videoOptionsActive ? ALLOWED_VIDEO_SIZE_MESSAGE : "",
			'size': videoOptionsActive ? ALLOWED_VIDEO_SIZE : "",
		};

		// Upload the main image or video file
		const imageOptionsresponse = await moveUploadedFile(req, res, options);

		if (imageOptionsresponse.status === STATUS_ERROR) {
			errMessage.push({ 'param': 'options_image', 'msg': imageOptionsresponse.message });
			return {
				status: STATUS_ERROR,
				front_status: STATUS_ERROR_FORM_VALIDATION,
				message: errMessage
			};
		}

		// Get file name and extension
		const optionsFileName = imageOptionsresponse.fileName ? imageOptionsresponse.fileName : "";
		const optionsMediaExtension = optionsFileName ? optionsFileName.slice((optionsFileName.lastIndexOf('.') + 1)) : "";

		// If video, upload thumbnail image as well
		if (videoOptionsActive) {
			const thumbnailOptionsImage = {
				'image': thumbnailOptionVideoImage,
				'filePath': POLLS_FILE_PATH,
			};
			const thumbnailOptionsResponse = await moveUploadedFile(req, res, thumbnailOptionsImage);
			optionsVideThumbnailImageName = thumbnailOptionsResponse.fileName ? thumbnailOptionsResponse.fileName : "";
		}

		// Update the poll option in the database
		const polls = db.collection(TABLE_POLLS);

		// Fetch the poll document
		const document = await polls.findOne({
			'slug': pollSlug,
			'user_id': userId
		});

		if (!document) {
			return {
				status: STATUS_FAILURE,
				message: res.__("front.polls.polls_question_options_update_failed"),
			};
		}

		// Find the specific option by its _id
		const option = document.options.find(opt => opt._id.equals(optionId));

		if (!option) {
			return {
				status: STATUS_FAILURE,
				message: res.__("front.polls.polls_question_options_update_failed"),
			};
		}

		// Update the fields in the found option
		option.image = videoOptionsActive ? optionsVideThumbnailImageName : optionsFileName;
		option.video = videoOptionsActive ? optionsFileName : "";
		option.extension = optionsMediaExtension;

		// Update the document with modified options array
		const updateResult = await polls.updateOne(
			{ 'slug': pollSlug, 'user_id': userId },
			{ $set: { 'options': document.options } }
		);

		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				status: STATUS_SUCCESS,
				message: res.__("front.polls.polls_question_options_updated_successfully"),
			};
		} else {
			return {
				status: STATUS_FAILURE,
				message: res.__("front.polls.polls_question_options_update_failed"),
			};
		}
	} catch (err) {
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End uploadManuallyImageAndVide()

/**
 * Updates the text array for all options in a poll.
 * 
 * @param {String} userId - The ID of the user who owns the poll.
 * @param {Array} optionsArray - An array of options, where each option is an object with an `option_id` and an `options_title`.
 * @returns {Promise} A promise that resolves when the update is complete.
 */
/**
 * Updates the text array for all options in a poll using async/await.
 * Runs all update queries in parallel for faster response times.
 * 
 * @param {String} pollSlug - The slug of the poll.
 * @param {String} userId - The ID of the user who owns the poll.
 * @param {Array} optionsArray - An array of options, each with `option_id` and `options_title`.
 * @returns {Promise<void>} A promise that resolves when all updates are complete.
 */
updateAllOptionsTextArrayAccourding = async (pollSlug, userId, optionsArray) => {
	try {
		if (pollSlug && userId && Array.isArray(optionsArray) && optionsArray.length > 0) {
			const polls = db.collection(TABLE_POLLS);

			// Prepare all update queries in parallel
			const updatePromises = optionsArray.map(optionRecords => {
				const optionId = optionRecords.option_id ? newObjectIdDefault(optionRecords.option_id) : "";
				const newTitle = optionRecords.options_title ? optionRecords.options_title : "";

				if (optionId && newTitle) {
					// Update the title for the specific option
					return polls.updateOne(
						{
							'slug': pollSlug,
							'user_id': newObjectIdDefault(userId),
							"options._id": optionId
						},
						{
							$set: {
								"options.$.title": newTitle
							}
						}
					);
				}
				// If no update needed, resolve immediately
				return Promise.resolve();
			});

			// Wait for all updates to complete
			await Promise.all(updatePromises);
		}
		// Always resolve (no return value needed)
		return;
	} catch (err) {
		// On error, just resolve (could log error if needed)
		return;
	}
}; // End updateAllOptionsTextArrayAccourding()