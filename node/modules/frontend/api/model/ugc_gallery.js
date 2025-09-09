const async = require('async');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/** define collection */
const ugcGallery = db.collection(TABLE_UGC_GALLERY);


function aboutMyBusiness() {

	/**
	 * Function used to upload UGC gallery.
	 * Handles all DB queries using async/await for clean and modern code.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.uploadUgcGallery = async (req, res) => {
		let finalResponse = {};

		try {
			// --- Extract user and request data ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let description = req.body.description ? req.body.description : "";
			let uploadGallery = (req.files && req.files.upload_gallery) ? req.files.upload_gallery : "";
			let mimeType = uploadGallery.mimetype ? uploadGallery.mimetype : "";
			let instagramIdLink = req.body.instagram_id_link ? extractUniqueInstagramHandle(req.body.instagram_id_link) : "";
			let publicUserSlug = req.body.other_user_slug ? req.body.other_user_slug : "";

			// --- If public user slug is provided, fetch userId by slug ---
			if (publicUserSlug !== '') {
				const conditions = {
					slug: { $regex: "^" + publicUserSlug + "$", $options: "i" }
				};
				const userOptions = { conditions };
				const userResponse = await getUserDetailBySlug(req, res, userOptions);
				const resultData = userResponse.result ? userResponse.result : "";
				userId = (resultData && resultData._id) ? resultData._id : "";
			}

			// --- Validate required fields ---
			if (!userId || !uploadGallery || !description) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Prepare options for file upload ---
			const options = {
				image: uploadGallery,
				ai_social_image_submit: true,
				filePath: UGC_GALLERY_FILE_PATH,
				allowedExtensions: ALLOWED_VIDEO_OR_IMAGE_EXTENSIONS,
				allowedImageError: ALLOWED_VIDEO_OR_IMAGE_ERROR_MESSAGE,
				allowedMimeTypes: ALLOWED_VIDEO_OR_IMAGE_MIME_EXTENSIONS,
				allowedMimeError: ALLOWED_VIDEO_OR_IMAGE_MIME_ERROR_MESSAGE,
				allowedSizeErrorMessage: ALLOWED_VIDEO_OR_IMAGE_SIZE_MESSAGE,
				size: MAXIMUM_ALLOWED_VIDEO_OR_IMAGE_SIZE,
			};

			// --- Upload file using moveUploadedFile (async/await) ---
			const galleryResponse = await moveUploadedFile(req, res, options);

			if (galleryResponse.status === STATUS_ERROR) {
				// --- Send error response if upload fails ---
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: galleryResponse.message,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const fileName = galleryResponse.fileName ? galleryResponse.fileName : "";
			const imageExtension = galleryResponse.image_extension ? galleryResponse.image_extension : "";

			// --- Generate slug for the gallery entry ---
			const slugOptions = {
				title: description,
				table_name: TABLE_UGC_GALLERY,
				slug_field: "slug"
			};
			const slugResponse = await getDatabaseSlug(slugOptions);

			// --- Insert new gallery entry into the database ---
			await ugcGallery.insertOne({
				user_id: userId,
				description: description,
				upload_file: fileName,
				mime_type: mimeType,
				extension: imageExtension,
				instagram_id_link: instagramIdLink,
				slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
				created: getUtcDate()
			});

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("front.ugc_gallery.gallery_has_been_upload_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: err.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End uploadUgcGallery();

	/**
	 * Function to get UGC Gallery List.
	 * Uses async/await for all DB queries and runs queries in parallel using Promise.all.
	 * Clean formatting and clear function comments.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns data
	 */
	this.ugcGalleryList = async (req, res) => {
		let finalResponse = {};
		try {
			// --- Sanitize request body ---
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// --- Extract user and request parameters ---
			let loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : "";
			let searchValue = req.body.search_value ? req.body.search_value : "";
			let defaultTimezone = req.body.default_timezone ? req.body.default_timezone : DEFAULT_TIME_ZONE;
			let page = req.body.page ? parseInt(req.body.page) : 1;
			let limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
			let skip = (limit * page) - limit;

			// --- Check for missing userId ---
			if (!userId) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						file_url: UGC_GALLERY_FILE_URL,
						result: {},
						message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// --- Build query options ---
			let optionList = { user_id: newObjectIdDefault(userId) };
			if (searchValue !== '') {
				optionList['description'] = { $regex: new RegExp(searchValue, "i") };
			}

			// --- Prepare aggregation pipeline for listing ---
			const listingPipeline = [
				{ $match: optionList },
				{ $sort: { created: SORT_DESC } },
				{ $skip: skip },
				{ $limit: limit },
				{
					$group: {
						_id: {
							created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: defaultTimezone } },
						},
						records: { $push: "$$ROOT" },
						count: { $sum: 1 }
					}
				},
				{ $sort: { _id: SORT_DESC } },
				{
					$project: {
						_id: 0,
						created: "$_id.created",
						records: 1,
						count: 1
					}
				},
			];

			// --- Run listing and count queries in parallel ---
			const [listingData, totalRecords] = await Promise.all([
				ugcGallery.aggregate(listingPipeline).toArray(),
				ugcGallery.countDocuments(optionList)
			]);

			// --- Temporary images for UI fallback/demo ---
			const tempImages = [
				"https://d5cvgp25mt3yl.cloudfront.net/uploads/ai_social_images/APR2025/18/174498041357327-174498040159328-stuftlq04150027-n.jpg",
				"https://d5cvgp25mt3yl.cloudfront.net/uploads/ugc_gallery/APR2025/18/174498040150126-stuftlq04150036-n.jpg",
				"https://d5cvgp25mt3yl.cloudfront.net/uploads/ugc_gallery/APR2025/18/174498040145240-stuftlq04150039.jpg",
				"https://d5cvgp25mt3yl.cloudfront.net/uploads/ugc_gallery/APR2025/18/174498040141321-stuftlq04150017.jpg"
			];

			// --- Send success response ---
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					file_url: UGC_GALLERY_FILE_URL,
					page: page,
					total_page: Math.ceil(totalRecords / limit),
					result: listingData || [],
					temp_images: tempImages,
					message: "",
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					file_url: UGC_GALLERY_FILE_URL,
					page: req.body.page ? parseInt(req.body.page) : 1,
					total_page: 0,
					result: [],
					message: res.__("api.global.no_record_found")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End ugcGalleryList();

	/**
	 * Function used to delete UGC Gallery images.
	 * Handles all DB queries using async/await and runs file deletions in parallel using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.deleteUgcGalleryImages = async (req, res) => {
		let finalResponse = {};

		// --- Extract user and request data ---
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		let ugcGalleryIds = req.body.ugc_gallery_image_ids ? req.body.ugc_gallery_image_ids : [];

		// --- Validate required fields ---
		if (!userId || ugcGalleryIds.length === 0) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// --- Prepare array of ObjectIds for query ---
			let ugcGalleryIdsArray = ugcGalleryIds.map(imageId => newObjectIdDefault(imageId));

			// --- Find gallery records for the user and given IDs ---
			const galleryRecords = await ugcGallery.find({
				"_id": { $in: ugcGalleryIdsArray },
				"user_id": newObjectIdDefault(userId)
			}).toArray();

			if (galleryRecords && galleryRecords.length > 0) {
				// --- Prepare file deletion tasks for all found records ---
				let fileDeletionTasks = galleryRecords.map(record => {
					let fileName = record.upload_file || "";
					return removeFile({ file_path: UGC_GALLERY_FILE_PATH + fileName });
				});

				// --- Execute all file deletions in parallel ---
				await Promise.all(fileDeletionTasks);

				// --- Delete records from the database ---
				await ugcGallery.deleteMany({
					"_id": { $in: ugcGalleryIdsArray },
					"user_id": newObjectIdDefault(userId)
				});

				// --- Send success response ---
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						message: res.__("front.ugc_gallery.ugc_gallery_image_has_been_deleted_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// --- No records found for deletion ---
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						message: res.__("front.global.no_record_found"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			// --- Handle errors gracefully and send error response ---
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteUgcGalleryImages();

}
module.exports = new aboutMyBusiness();