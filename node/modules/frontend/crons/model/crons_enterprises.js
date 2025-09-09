
const fs = require('fs');
const XlsxStreamReader = require("xlsx-stream-reader");
const axios = require('axios');
const AWS = require('aws-sdk');
const s3Crone = new AWS.S3();

function CronsEnterprises() {

	/**
	 * Optimized function for importing enterprises Excel data
	 * Uses async/await for all DB queries and handles parallel operations with Promise.all.
	 */
	this.importEnterprisesExcelData = async (req, res, next) => {
		try {
			const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);
			const enterpriseImportLogs = db.collection(TABLE_ENTERPRISE_IMPORTS);

			// Check if another import process is already running
			const activeCount = await enterpriseUpload.countDocuments({ is_running: ACTIVE });
			if (activeCount > 0) {
				return res.end(res.__("Please wait, another process is running.........."));
			}

			// Find the next pending import record
			const csvImportResult = await enterpriseUpload.find({
				'is_deleted': NOT_DELETED,
				'status': LEADS_PENDING_EXCEL_PROCESS,
			}).sort({ created: SORT_ASC }).limit(1).toArray();

			if (csvImportResult.length === 0) {
				return res.end("No records found......");
			}

			const record = csvImportResult[0];
			const enterpriseUploadSheetId = record['_id'] || "";
			const userId = record['user_id'] || "";
			const extension = record['extension'] ? record['extension'].toString() : "";
			const enterpriseFileName = record['file_name'] ? record['file_name'].toString() : "";
			const columnArray = record['column'] || [];
			const upload = record['upload'] || "";
			const enterpriseUploadSheetSlug = record['slug'] || "";

			const filePath = ENTERPRISE_UPLOAD_EXCEL_FILE_PATH + enterpriseFileName;
			req.body['newFileName'] = enterpriseFileName;

			// Set import status to running
			await enterpriseUpload.updateOne(
				{ _id: newObjectIdDefault(enterpriseUploadSheetId) },
				{
					$set: {
						status: LEADS_PROCESSING_EXCEL_PROCESS,
						is_running: ACTIVE,
						modified: getUtcDate()
					}
				}
			);

			let multipleInsertProduct = [];

			// CSV import condition
			if (extension === 'csv') {
				const fs = require('fs');
				const es = require('event-stream');
				let lineNumber = 0;
				let s3Stream = "";

				if (UPLOAD_TO_S3) {
					const params = {
						Bucket: process.env.AWS_BUCKET_NAME,
						Key: filePath
					};
					s3Stream = s3Crone.getObject(params).createReadStream();
				} else {
					s3Stream = fs.createReadStream(filePath);
				}

				// Helper to process and insert in bulk
				const processAndInsert = async () => {
					if (multipleInsertProduct.length > 0) {
						await enterpriseImportLogs.insertMany(multipleInsertProduct, { forceServerObjectId: true });
						multipleInsertProduct = [];
					}
				};

				// Wrap the stream processing in a Promise for async/await
				await new Promise((resolve, reject) => {
					s3Stream
						.pipe(es.split())
						.pipe(es.mapSync(async (line) => {
							lineNumber += 1;
							const rows = splitCsv(line);

							// Skip header row
							if (lineNumber === 1) return;

							const optionData = {
								recordsItems: rows,
								userId,
								enterpriseUploadSheetId,
								extension,
								fileName: enterpriseFileName,
								columnArray,
								upload,
								enterpriseSlug: enterpriseUploadSheetSlug
							};

							// Insert temp product data
							const responseObject = await importEnterpriseTempRecord(optionData);
							if (responseObject !== STATUS_SUCCESS) {
								multipleInsertProduct.push(responseObject);
								if (multipleInsertProduct.length === Number(USER_LEAD_BULK_INSERT_CSV_TO_TEMP)) {
									await processAndInsert();
								}
							}
						}))
						.on('error', async (err) => {
							// Update status to rejected on error
							await enterpriseUpload.updateOne(
								{ _id: newObjectIdDefault(enterpriseUploadSheetId) },
								{
									$set: {
										status: LEADS_REJECTED_EXCEL_PROCESS,
										is_running: DEACTIVE,
										reason: res.__("admin.system.something_going_wrong_please_try_again"),
										modified: getUtcDate()
									}
								}
							);
							res.end(res.__("admin.system.something_going_wrong_please_try_again"));
							reject(err);
						})
						.on('end', async () => {
							// Insert any remaining records
							await processAndInsert();
							// Mark process as done
							await enterpriseImportAllProcessDoneAfterFlagUpdate(req, res, enterpriseUploadSheetId);
							res.end(res.__("Processing.........."));
							resolve();
						});
				});
			} else {
				// XLSX import condition
				const fs = require('fs');
				const XlsxStreamReader = require("xlsx-stream-reader");

				let workBookReader = new XlsxStreamReader({
					verbose: true,
					formatting: true,
				});

				// Handle errors in workbook reading
				workBookReader.on('error', async (error) => {
					await enterpriseUpload.updateOne(
						{ _id: newObjectIdDefault(enterpriseUploadSheetId) },
						{
							$set: {
								status: LEADS_REJECTED_EXCEL_PROCESS,
								is_running: DEACTIVE,
								reason: res.__("admin.system.something_going_wrong_please_try_again"),
								modified: getUtcDate()
							}
						}
					);
					res.end(res.__("admin.system.something_going_wrong_please_try_again"));
				});

				// Process worksheet rows
				workBookReader.on('worksheet', (workSheetReader) => {
					if (workSheetReader.id == 1 || workSheetReader.id == '1') {
						workSheetReader.on('row', async (row) => {
							// Skip header row
							if (row.attributes.r == 1) return;
							row.values.shift();
							const recordsItems = row.values;
							const optionData = {
								recordsItems,
								userId,
								enterpriseUploadSheetId,
								extension,
								fileName: enterpriseFileName,
								columnArray,
								upload,
								enterpriseSlug: enterpriseUploadSheetSlug,
							};

							const responseObject = await importEnterpriseTempRecord(optionData);
							if (responseObject !== STATUS_SUCCESS) {
								multipleInsertProduct.push(responseObject);
								if (multipleInsertProduct.length === Number(USER_LEAD_BULK_INSERT_CSV_TO_TEMP)) {
									await enterpriseImportLogs.insertMany(multipleInsertProduct, { forceServerObjectId: true });
									multipleInsertProduct = [];
								}
							}
						});
					}
					workSheetReader.process();
				});

				// On workbook end, insert any remaining records and update process flag
				workBookReader.on('end', async () => {
					if (multipleInsertProduct.length > 0) {
						await enterpriseImportLogs.insertMany(multipleInsertProduct, { forceServerObjectId: true });
						multipleInsertProduct = [];
					}
					await enterpriseImportAllProcessDoneAfterFlagUpdate(req, res, enterpriseUploadSheetId);
					res.end(res.__("Processing.........."));
				});

				// Start reading the file (from S3 or local)
				if (UPLOAD_TO_S3) {
					const params = {
						Bucket: process.env.AWS_BUCKET_NAME,
						Key: filePath
					};
					s3Crone.getObject(params).createReadStream().pipe(workBookReader);
				} else {
					fs.createReadStream(filePath).pipe(workBookReader);
				}
			}
		} catch (error) {
			console.error("Fatal import error:", error);
			return res.end(res.__("admin.system.something_going_wrong_please_try_again"));
		}
	};


	/**
	 * Async function to prepare a record for insertion from Excel to temp table.
	 * Returns the data object if valid, otherwise returns STATUS_SUCCESS.
	 * @param {Object} valuesData - Data containing record and meta info.
	 * @returns {Object|String} - Data object for insertMany or STATUS_SUCCESS.
	 */
	importEnterpriseTempRecord = async (valuesData) => {
		// Destructure input data for clarity
		const {
			recordsItems,
			userId,
			enterpriseUploadSheetId: enterpriseId,
			enterpriseSlug,
			extension,
			fileName,
			columnArray
		} = valuesData;

		// Extract fields from the record using column mapping
		const email = recordsItems[columnArray[0]] ? recordsItems[columnArray[0]].toString() : "";
		const zipCode = recordsItems[columnArray[1]] ? recordsItems[columnArray[1]].toString() : "";
		const instagramProfileUrl = recordsItems[columnArray[2]] ? recordsItems[columnArray[2]].toString() : "";
		const websiteUrl = recordsItems[columnArray[3]] ? recordsItems[columnArray[3]].toString() : "";
		const locationName = recordsItems[columnArray[4]] ? recordsItems[columnArray[4]].toString() : "";

		// Only prepare data if zipCode is present
		if (zipCode) {
			const saveData = {
				enterprise_id: newObjectIdDefault(enterpriseId),
				enterprise_slug: enterpriseSlug,
				user_id: userId,
				email: email,
				zip_code: zipCode,
				instagram_profile_url: instagramProfileUrl,
				website_url: websiteUrl,
				location_name: locationName,
				extension: extension,
				file_name: fileName,
				sheet_status: SHEET_STATUS_PROCESSING,
				is_process: DEFAULT_ZERO,
				created: getUtcDate(),
				modified: getUtcDate()
			};
			return saveData;
		} else {
			return STATUS_SUCCESS;
		}
	};


	/**
	 * Async function to update enterprise import flags after all records are processed.
	 * Handles both the case where all records are rejected (no logs) and normal completion.
	 * Uses async/await for all DB queries.
	 * @param {Object} req - Express request object
	 * @param {Object} res - Express response object
	 * @param {String|ObjectId} enterpriseId - The enterprise upload sheet ID
	 */
	enterpriseImportAllProcessDoneAfterFlagUpdate = async (req, res, enterpriseId) => {
		const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);
		const enterpriseImportLogs = db.collection(TABLE_ENTERPRISE_IMPORTS);

		try {
			// Count import logs for this enterprise
			const countLogs = await enterpriseImportLogs.countDocuments({ 'enterprise_id': newObjectIdDefault(enterpriseId) });

			if (countLogs === 0) {
				// No logs found: update as rejected with failed reason
				await enterpriseUpload.updateOne(
					{ _id: newObjectIdDefault(enterpriseId) },
					{
						$set: {
							is_running: DEACTIVE,
							is_completed: ACTIVE,
							status: LEADS_REJECTED_EXCEL_PROCESS,
							failed_reason: res.__(res.__("web.leads_file.no_columns_were_found")),
							modified: getUtcDate()
						}
					}
				);
			} else {
				// Logs found: mark as completed
				await enterpriseUpload.updateOne(
					{ _id: newObjectIdDefault(enterpriseId) },
					{
						$set: {
							is_running: DEACTIVE,
							is_completed: ACTIVE,
							modified: getUtcDate()
						}
					}
				);
			}
			// Function complete
			return;
		} catch (err) {
			// Log error or handle as needed
			console.error("Error in enterpriseImportAllProcessDoneAfterFlagUpdate:", err);
			throw err;
		}
	}; // End enterpriseImportAllProcessDoneAfterFlagUpdate


	/**
	 * Add Enterprise Business User
	 * This function processes enterprise import logs for specific leads.
	 * All DB queries use async/await and parallel processing is handled with Promise.all.
	 */
	this.addEnterpriseBusinessUser = async (req, res, next) => {
		try {
			const enterpriseImportLogs = db.collection(TABLE_ENTERPRISE_IMPORTS);
			const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);
			const users = db.collection(TABLE_USERS);

			// Step 1: Check if any import process is already running
			const runningCount = await enterpriseImportLogs.countDocuments({ 'is_running_import': DEFAULT_ONE });
			if (runningCount > 0) {
				return res.end("Please wait, another process is running..........");
			}

			// Step 2: Fetch the next import log(s) to process (limit 1, sorted by created)
			const importLogsResult = await enterpriseImportLogs
				.find({ "sheet_status": LEADS_PROCESSING_EXCEL_PROCESS, "is_process": DEACTIVE })
				.sort({ created: SORT_ASC })
				.limit(1)
				.toArray();

			if (!importLogsResult || importLogsResult.length === 0) {
				// No records to process
				return res.end("No record founds......");
			}

			try {
				// Step 3: Mark the selected import log(s) as running
				const leadsImportLogsIds = importLogsResult.map(record => newObjectIdDefault(record._id));
				await enterpriseImportLogs.updateMany(
					{ '_id': { $in: leadsImportLogsIds } },
					{ $set: { 'is_running_import': DEFAULT_ONE } }
				);

				// Step 4: Process all import logs in parallel
				await Promise.all(importLogsResult.map(async importLog => {
					let errorsArray = [];
					const importLogId = importLog._id || "";
					const enterpriseId = importLog.enterprise_id || "";
					const userId = importLog.user_id || "";
					const email = importLog.email || "";
					const zipCode = importLog.zip_code || "";
					const websiteUrl = importLog.website_url || "";
					const instagramUrl = importLog.instagram_profile_url || "";
					const locationName = importLog.location_name || "";
					const uniqueBrowserId = Date.now().toString();

					try {
						// Step 4.1: Fetch existing user details
						const existUserDetails = await users.findOne({ "_id": newObjectIdDefault(userId) });
						const existUserEmail = existUserDetails?.email || "";
						const existUsercurrentTimezone = existUserDetails?.current_timezone || "";
						let crawlSuccess = false;

						// Step 4.2: Crawl & Register only if website/Instagram & email exists
						if ((websiteUrl || instagramUrl) && existUserEmail) {
							let checkData = { 'email': existUserEmail };
							if (websiteUrl) checkData["website_url"] = websiteUrl;
							if (!websiteUrl && instagramUrl) checkData['instagram_url'] = instagramUrl;

							// Check if this user already exists
							const existingUser = await generateCroneData(req, res, {
								req_data: checkData,
								method_name: "check_already_user_exists"
							});

							// If user account does not already exist
							if (existingUser.status === STATUS_SUCCESS && existingUser?.response?.already_exists_account === false) {
								// Crawl website if available
								if (websiteUrl) {
									const contentLibraryData = await generateCroneData(req, res, {
										req_data: { 'website_url': websiteUrl, 'unique_ai_browser_id': uniqueBrowserId },
										method_name: "get_content_library"
									});
									const webId = contentLibraryData?.response?.web_id || "";

									// Crawl all pages if webId is available
									if (webId) {
										await generateCroneData(req, res, {
											method_name: "crawl_home_page_urls",
											req_data: { 'website_url': websiteUrl, 'web_id': webId }
										});
										crawlSuccess = true;
									}
								}

								// Crawl Instagram if only Instagram is available
								if (instagramUrl && !websiteUrl) {
									await generateCroneData(req, res, {
										req_data: { 'instagram_url': instagramUrl, 'unique_ai_browser_id': uniqueBrowserId },
										method_name: "crawl_instagram_data_for_onboarding"
									});
									crawlSuccess = true;
								}

								if (crawlSuccess) {
									// Register the new user
									const registrationPayload = {
										'first_name': existUserDetails?.fname || '',
										'last_name': existUserDetails?.lname || '',
										'email': existUserEmail,
										'password': existUserDetails?.password || '',
										'zip': zipCode || existUserDetails?.zip || '',
										'account_type': existUserDetails?.account_type || PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
										'api_type': ENTERPRISE_API_TYPE,
										'unique_ai_browser_id': uniqueBrowserId,
										'current_timezone': existUsercurrentTimezone,
										'from_homepage_ai_user': true
									};

									const userRegistrationData = await generateCroneData(req, res, {
										req_data: registrationPayload,
										method_name: "user_registration"
									});

									const registerUserData = userRegistrationData?.response?.result || {};
									const authToken = userRegistrationData?.response?.token || "";

									// If registration is successful
									if (registerUserData && Object.keys(registerUserData).length > 0) {
										// Generate AI reward and templates
										await generateCroneData(req, res, {
											req_data: { 'slug': registerUserData?.slug || '' },
											method_name: "ai_reward_and_template_generate",
											auth_token: authToken
										});

										// Save insider campaign data
										await generateCroneData(req, res, {
											req_data: { 'ai_campaign_name': "Initial Sign-up Campaign", 'signup_flag': true, 'slug': registerUserData?.slug || '' },
											method_name: "save_ai_campaign_name",
											auth_token: authToken
										});

										// Save first campaign content
										const saveFirstPost = await generateCroneData(req, res, {
											req_data: { 'unique_ai_browser_id': uniqueBrowserId, 'slug': registerUserData?.slug || '', 'enterprise_first_social_post': true },
											method_name: "save_first_campaign_content",
											auth_token: authToken
										});

										if (saveFirstPost.status == STATUS_SUCCESS) {
											// Update social popup close flag
											await generateCroneData(req, res, {
												req_data: { 'yes_automatic_schedule': true, 'slug': registerUserData?.slug || '' },
												method_name: "update_social_popup_close_flag",
												auth_token: authToken
											});

											// Update user data
											let updateUserData = {
												'auto_generate_social_post_after_yes_click': true,
												'yes_automatic_schedule': false,
												'total_automatic_post_generated': 1,
												'onboarding_post_created': true,
												'tooltip_post_generated': true
											};

											// Set business name if available
											if (locationName) {
												updateUserData['public_business_informaton.name_of_the_business'] = locationName;
											}

											// Set Instagram URL if both website and Instagram are available
											if (websiteUrl && instagramUrl) {
												updateUserData['instagram_url'] = instagramUrl;
											}

											// Update user in DB
											await users.updateOne(
												{ slug: registerUserData?.slug || '' },
												{ $set: updateUserData }
											);

											// If both website and Instagram are available, rediscover Instagram data
											if (websiteUrl && instagramUrl) {
												await generateCroneData(req, res, {
													req_data: { 'instagram_url': instagramUrl, 'slug': registerUserData?.slug || '' },
													method_name: "rediscover_apify_data",
													auth_token: authToken
												});
											}
										} else {
											// If first post save failed
											errorsArray.push(saveFirstPost.message);
										}
									} else {
										// If user registration failed
										errorsArray.push(userRegistrationData.message);
									}
								} else {
									// If crawl failed
									errorsArray.push("Website crawl failed");
								}
							} else {
								// Already user registered
								errorsArray.push("Already user registered");
							}
						} else {
							// Website or Instagram or email missing
							let message = "";
							if (!websiteUrl && !instagramUrl) {
								message = "Website or Instagram profile Url is missing or not found.";
							} else if (!websiteUrl) {
								message = "Website URL is missing";
							} else if (!instagramUrl) {
								message = "Instagram URL is missing";
							}
							if (message) errorsArray.push(message);
						}

						// Step 4.3: Register basic user data as a sub-user if no errors
						if (errorsArray.length === 0 && email) {
							await addEnterpriseMultipleAddUser(req, res, { "user_id": userId, "email": email });
						}

						// Step 4.4: Update records count in enterprise upload
						const updateFields = (errorsArray.length > 0)
							? { $inc: { total_records: 1, failed_records: 1 } }
							: { $inc: { total_records: 1, success_records: 1 } };
						await enterpriseUpload.updateOne(
							{ _id: newObjectIdDefault(enterpriseId) },
							updateFields
						);

						// Step 4.5: Update import log status depending on errors
						const sheetStatus = (errorsArray.length > 0)
							? LEADS_REJECTED_EXCEL_PROCESS
							: LEADS_COMPLETE_EXCEL_PROCESS;
						await enterpriseImportLogs.updateOne(
							{ _id: newObjectIdDefault(importLogId), enterprise_id: newObjectIdDefault(enterpriseId) },
							{
								$set: {
									'is_running_import': DEFAULT_ZERO,
									'failed_reason': errorsArray,
									'sheet_status': sheetStatus,
									'is_process': ACTIVE
								}
							}
						);

						// Step 4.6: Update complete status after all imports
						await completeStatusUpdateAfterAllEnterpriseExcelInsert(enterpriseId);

					} catch (err) {
						console.error("Error processing import log:", err);
					}
				}));

				// Step 5: All logs processed
				res.end("All logs processed successfully.");

			} catch (err) {
				res.end(res.__("admin.system.something_going_wrong_please_try_again"));
			}
		} catch (error) {
			return res.status(500).send({ message: error.message });
		}
	};


	/**
	 * Async function to update the complete process status after all leads Excel inserts.
	 * Uses async/await for all DB queries. If any queries need to run in parallel, use Promise.all.
	 * Clean formatting and clear function comments provided.
	 * @param {String|ObjectId} enterpriseId - The enterprise upload sheet ID
	 */
	completeStatusUpdateAfterAllEnterpriseExcelInsert = async (enterpriseId) => {
		try {
			const enterpriseImportLogs = db.collection(TABLE_ENTERPRISE_IMPORTS);
			const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);

			// Step 1: Count how many processing Excel sheets are still pending for this enterprise
			const pendingSheetsCount = await enterpriseImportLogs.countDocuments({
				enterprise_id: newObjectIdDefault(enterpriseId),
				sheet_status: LEADS_PROCESSING_EXCEL_PROCESS,
				is_process: DEACTIVE
			});

			// Step 2: If no pending sheets remain, update the final status to "complete"
			if (pendingSheetsCount === 0) {
				await enterpriseUpload.updateOne(
					{ _id: newObjectIdDefault(enterpriseId) },
					{ $set: { status: LEADS_COMPLETE_EXCEL_PROCESS } }
				);
			}
			// No parallel queries needed here, but if in future multiple updates are required,
			// use Promise.all([...]) for parallel execution.

		} catch (error) {
			console.error("Error in completeStatusUpdateAfterAllEnterpriseExcelInsert:", error);
			// Optionally, rethrow or handle error as needed
		}
	}; // End completeStatusUpdateAfterAllEnterpriseExcelInsert

}
module.exports = new CronsEnterprises();