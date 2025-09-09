const async = require('async');
const moment = require('moment');
const asyncEach = require("async/each");
const strtotime = require('strtotime');
const asyncParallel = require('async/parallel');
const AWS = require('aws-sdk');
const s3Crone = new AWS.S3();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createClient } = require('pexels');
const OpenAI = require("openai");
const axios = require("axios");

const openai = new OpenAI({
	apiKey: process.env.OPEN_AI // apna key yaha rakho
});


function Crons() {

	/**
	 * Async function to broadcast email send message.
	 * Uses async/await for all DB queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.broadcastEmailSendMessage = async (req, res) => {
		try {
			const sendEmail = db.collection(TABLE_SEND_EMAIL_NEWSLETTER);

			// Step 1: Aggregate to find emails to send
			const result = await sendEmail.aggregate([
				{
					$match: {
						is_send: DEFAULT_ZERO,
						schedule_time: { $lte: getUtcDate() }
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
							{ $project: { "email": 1, "full_name": 1, "email_newsletter_subscribed_enc_id": 1, "email_newsletter_subscribed": 1 } }
						],
						as: "userDetails"
					}
				},
				{ $sort: { created: SORT_ASC } },
				{ $limit: EMAIL_BROADCAST_LIMIT },
				{
					$project: {
						'_id': 1,
						'message': 1,
						'action': 1,
						'email': { $arrayElemAt: ["$userDetails.email", 0] },
						'full_name': { $arrayElemAt: ["$userDetails.full_name", 0] },
						'email_newsletter_subscribed': { $arrayElemAt: ["$userDetails.email_newsletter_subscribed", 0] },
						'email_newsletter_subscribed_enc_id': { $arrayElemAt: ["$userDetails.email_newsletter_subscribed_enc_id", 0] },
					}
				},
			]).toArray();

			if (!result || result.length === 0) {
				return res.end("No records found.");
			}

			// Step 2: Prepare and send emails in series (await for each to finish)
			const sendEmailsIds = [];
			for (const records of result) {
				const broadcastId = records._id ? newObjectIdDefault(records._id) : "";
				const email = records.email || "";
				const action = records.action || "";
				const fullName = records.full_name || "";
				const emailNewsletterSubscribed = records.email_newsletter_subscribed || DEFAULT_ZERO;
				const emailNewsletterSubscribedEncId = records.email_newsletter_subscribed_enc_id || "";

				if (email !== "" && fullName !== "" && emailNewsletterSubscribed !== DEFAULT_ONE) {
					// Set options for send email
					const emailOptions = {
						to: email,
						action: action,
						email_newsletter_subscribed_enc_id: emailNewsletterSubscribedEncId,
						rep_array: [DEAR_HI_CONSTANT, fullName]
					};
					// Send email (assume sendMailNewsletterBroadcast is synchronous or handles its own async)
					await sendMailNewsletterBroadcast(req, res, emailOptions);
					sendEmailsIds.push(broadcastId);
				}
			}

			// Step 3: Update all sent emails' status in parallel if any were sent
			if (sendEmailsIds.length > 0) {
				await sendEmail.updateMany(
					{ _id: { $in: sendEmailsIds } },
					{ $set: { is_send: DEFAULT_ONE } }
				);
				return res.end("Processing............");
			} else {
				return res.end("Email not send...");
			}
		} catch (error) {
			console.error("Error in broadcastEmailSendMessage:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End broadcastEmailSendMessage();

	/**
	 * Function to mark user open email for a newsletter schedule.
	 * Uses async/await for DB queries and clean formatting.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.broadcastViewUserOpenEmail = async (req, res) => {
		try {
			const sendEmail = db.collection(TABLE_SEND_EMAIL_NEWSLETTER);
			const newsletterScheduleId = req.params.newsletter_schedule_id ? req.params.newsletter_schedule_id : "";

			if (!newsletterScheduleId) {
				return res.end("no id...");
			}

			// Update all matching records to set view_user_open_email to DEFAULT_ONE
			await sendEmail.updateMany(
				{ _id: newObjectIdDefault(newsletterScheduleId) },
				{ $set: { view_user_open_email: DEFAULT_ONE } }
			);

			return res.end("Processing............");
		} catch (error) {
			console.error("Error in broadcastViewUserOpenEmail:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End broadcastViewUserOpenEmail();

	/**
	 * Function to track when a user opens an email.
	 * Uses async/await for all DB queries and handles parallel updates with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.emailTrackOpen = async (req, res) => {
		try {
			const trackEmail = db.collection(TABLE_EMAIL_TRACK_OPEN);
			const emailNewsletterTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
			const campaignEmailNewsletterLogs = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER_LOGS);

			// Step 1: Decode and extract parameters from the request
			const trackOptionString = req.params.track_option_string ? req.params.track_option_string : "";
			const decodeString = decryptCrypto(trackOptionString);
			const decodeJsonData = JSON.parse(decodeString);

			const templateId = decodeJsonData.email_template_id ? newObjectIdDefault(decodeJsonData.email_template_id) : "";
			const userId = decodeJsonData.user_id ? newObjectIdDefault(decodeJsonData.user_id) : "";
			const uniqueString = decodeJsonData.unique_string ? decodeJsonData.unique_string : "";
			const earnSentRewardId = decodeJsonData.earn_sent_reward_id ? newObjectIdDefault(decodeJsonData.earn_sent_reward_id) : "";
			const templateType = decodeJsonData.template_type ? decodeJsonData.template_type : "";
			const campaignSendNewsletterLogsId = decodeJsonData.campaign_send_newsletter_logs_id ? newObjectIdDefault(decodeJsonData.campaign_send_newsletter_logs_id) : "";

			if (templateId && userId) {
				// Step 2: Upsert (insert or update) the email open tracking record
				const trackEmailResult = await trackEmail.findOneAndUpdate(
					{
						'email_template_id': templateId,
						'user_id': userId,
						'unique_string': uniqueString,
						'template_type': templateType,
						'earn_sent_reward_id': earnSentRewardId,
					},
					{
						$set: {
							'modified': getUtcDate(),
						},
						$setOnInsert: {
							'email_template_id': templateId,
							'template_type': templateType,
							'user_id': userId,
							'is_opened': OPENED,
							'campaign_send_newsletter_logs_id': campaignSendNewsletterLogsId,
							'created': getUtcDate(),
						}
					},
					{ upsert: true, returnDocument: "before" }
				);

				// Step 3: If this is the first time the email is opened, update related tables in parallel
				if (trackEmailResult && trackEmailResult.value == null) {
					const updatePromises = [];

					// Update campaign newsletter logs if applicable
					if (templateType == EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE) {
						updatePromises.push(
							campaignEmailNewsletterLogs.updateOne(
								{ '_id': campaignSendNewsletterLogsId },
								{ $set: { 'is_opened': DEFAULT_ONE } }
							)
						);
					}

					// Increment the is_opened flag in the email newsletter template
					updatePromises.push(
						emailNewsletterTemplate.updateOne(
							{ '_id': templateId },
							{ $inc: { 'is_opened': 1 } }
						)
					);

					// Step 4: Wait for all updates to complete
					await Promise.all(updatePromises);
				}

				// Step 5: Respond to the client
				return res.end("Processing............");
			} else {
				return res.end("no id...");
			}
		} catch (error) {
			console.error("Error in emailTrackOpen:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End emailTrackOpen();

	/**
	 * Async function to broadcast notifications send message.
	 * Uses async/await for all DB queries and handles parallel operations with Promise.all.
	 * Clean formatting and clear function comments provided.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.broadcastNotificationsSendMessage = async (req, res) => {
		try {
			const sendNotification = db.collection(TABLE_NOTIFICATION_BROADCAST_SEND_SCHEDULE);

			// Step 1: Aggregate to find notifications to send
			const notificationsToSend = await sendNotification.aggregate([
				{
					$match: {
						is_send: DEFAULT_ZERO,
						schedule_time: { $lte: getUtcDate() }
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
							{ $project: { "email": 1, "full_name": 1 } }
						],
						as: "userDetails"
					}
				},
				{ $sort: { created: SORT_ASC } },
				{ $limit: NOTIFICATION_BROADCAST_LIMIT },
				{
					$project: {
						'_id': 1,
						'message': 1,
						'user_id': 1,
						'action': 1,
						'subject': 1,
						'body': 1,
						'email': { $arrayElemAt: ["$userDetails.email", 0] },
						'full_name': { $arrayElemAt: ["$userDetails.full_name", 0] },
					}
				},
			]).toArray();

			if (!notificationsToSend || notificationsToSend.length === 0) {
				return res.end("No records found.");
			}

			const sendIds = [];
			const saveNotificationArray = [];

			// Step 2: Process each notification record
			for (const record of notificationsToSend) {
				const broadcastId = record._id ? newObjectIdDefault(record._id) : "";
				const fullName = record.full_name || "";
				const userId = record.user_id ? record.user_id : "";
				const subject = record.subject || "";
				const body = record.body || "";

				// Prepare notification message with template constants
				const constants = NOTIFICATION_TEMPLATE_CONSTANTS;
				const notificationMessageParams = [fullName];

				let notificationMessage = body;
				let notificationTitle = subject;

				for (let i = 0; i < constants.length; i++) {
					notificationMessage = notificationMessage.replace(RegExp(constants[i], 'g'), notificationMessageParams[i]);
				}

				// Step 2.1: Send push notification via socket
				const socketRequestData = {
					room_id: String(userId),
					emit_function: "notification_received",
					message: notificationMessage
				};
				socketRequest(req, res, socketRequestData);

				// Step 2.2: Prepare notification data for DB insert
				const saveNotificationData = {
					user_id: newObjectIdDefault(userId),
					user_role_id: SUPER_ADMIN_ROLE_ID,
					created_by: newObjectIdDefault(userId),
					created_role_id: newObjectIdDefault(userId),
					title: notificationTitle,
					message: notificationMessage,
					parent_table_id: newObjectIdDefault(ADMIN_ID),
					extra_parameters: {
						user_id: newObjectIdDefault(userId),
					},
					notification_type: NOTIFICATION_BROADCAST_SEND_MESSAGE,
					is_seen: NOT_SEEN,
					is_read: NOT_READ,
					created: getUtcDate(),
					modified: getUtcDate()
				};
				saveNotificationArray.push(saveNotificationData);
				sendIds.push(broadcastId);
			}

			// Step 3: Update send flag and insert notifications in parallel
			if (sendIds.length > 0) {
				const notifications = db.collection(TABLE_NOTIFICATIONS);

				// Run update and insert in parallel
				await Promise.all([
					sendNotification.updateMany(
						{ _id: { $in: sendIds } },
						{ $set: { is_send: DEFAULT_ONE } }
					),
					notifications.insertMany(saveNotificationArray, { forceServerObjectId: true })
				]);

				return res.end("Processing............");
			} else {
				return res.end("Notification not send...");
			}
		} catch (error) {
			console.error("Error in broadcastNotificationsSendMessage:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End broadcastNotificationsSendMessage();

	/**
	 * Async function to set email newsletter subscription fields for all users.
	 * Uses async/await for DB queries and processes updates in series.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.emailNewsletterSubscribedEncId = async (req, res) => {
		try {
			const users = db.collection(TABLE_USERS);

			// Step 1: Fetch all users with _id and email
			const resultUser = await users.find({}, { projection: { _id: 1, email: 1 } }).toArray();

			if (!resultUser || resultUser.length === 0) {
				return res.end("No records found.");
			}

			// Step 2: Update each user in series (await for each to finish)
			for (const record of resultUser) {
				await users.updateMany(
					{ _id: record._id },
					{
						$set: {
							"email_newsletter_subscribed": DEFAULT_ZERO,
							"email_newsletter_subscribed_enc_id": newsletterSubscriberEncId(record.email)
						}
					}
				);
			}

			// Step 3: Send response after processing all users
			return res.end("Processing........");
		} catch (error) {
			console.error("Error in emailNewsletterSubscribedEncId:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End emailNewsletterSubscribedEncId();

	/**
	 *Function are used to split used in array
	 **/
	splitCsv = (str) => {
		return str.split(',').reduce((accum, curr) => {
			if (accum.isConcatting) {
				accum.soFar[accum.soFar.length - 1] += ',' + curr
			} else {
				accum.soFar.push(curr)
			}
			if (curr.split('"').length % 2 == 0) {
				accum.isConcatting = !accum.isConcatting
			}
			return accum;
		}, { soFar: [], isConcatting: false }).soFar
	} //End splitCsv();

	/**
	 * Async function to import leads from excel/csv to logs table.
	 * Uses async/await for all DB queries and handles file processing with proper error handling.
	 * If any import is currently running (is_running: ACTIVE), the process will not start.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.importLeadsFromExcelToLogsTable = async (req, res) => {
		const csvImport = db.collection(TABLE_LEADS_IMPORT);
		const leadsImportLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);

		try {
			// Step 1: Check if any import is currently running
			const runningCount = await csvImport.countDocuments({ is_running: ACTIVE });
			if (runningCount > 0) {
				return res.end(res.__("Please wait, another process is running.........."));
			}

			// Step 2: Find the next pending import record
			const csvImportResult = await csvImport.find({
				is_process: LEADS_PENDING_EXCEL_PROCESS,
			}).sort({ created: SORT_ASC }).limit(1).toArray();

			if (!csvImportResult || csvImportResult.length === 0) {
				return res.end("No record founds......");
			}

			// Step 3: Extract import record details
			const importRecord = csvImportResult[0];
			const csvId = importRecord._id ? importRecord._id : "";
			const leadId = importRecord.lead_id ? importRecord.lead_id : "";
			const userId = importRecord.user_id ? importRecord.user_id : "";
			const extension = importRecord.extension ? importRecord.extension.toString() : "";
			const leadFileName = importRecord.file_name ? importRecord.file_name.toString() : "";
			const columnArray = importRecord.column ? importRecord.column : [];
			const upload = importRecord.upload ? importRecord.upload : "";
			const csvImportSlug = importRecord.slug ? importRecord.slug : "";
			const sendWelcomeEmail = importRecord.send_welcome_email ? importRecord.send_welcome_email : "";
			const combineFirstNameToggle = importRecord.combine_first_name_toggle ? importRecord.combine_first_name_toggle : false;

			const filePath = LEADS_EXCEL_FILE_PATH + leadFileName;
			req.body['newFileName'] = leadFileName;

			// Step 4: Set import status to running
			await csvImport.updateOne(
				{ _id: newObjectIdDefault(csvId) },
				{
					$set: {
						is_process: LEADS_PROCESSING_EXCEL_PROCESS,
						is_running: ACTIVE,
						modified: getUtcDate()
					}
				}
			);

			let multipleInsertProduct = [];

			// Step 5: Process CSV file
			if (extension === 'csv') {
				const fs = require('fs');
				const es = require('event-stream');
				let lineNumber = 0;

				let s3Stream;
				if (UPLOAD_TO_S3) {
					const params = {
						Bucket: process.env.AWS_BUCKET_NAME,
						Key: filePath
					};
					s3Stream = s3Crone.getObject(params).createReadStream();
				} else {
					s3Stream = fs.createReadStream(filePath);
				}

				// Helper to process a single line (row) from CSV
				const processCsvLine = async (line) => {
					lineNumber += 1;
					if (lineNumber === 1) return; // Skip header

					const rows = splitCsv(line);
					const optionData = {
						recordsItems: rows,
						leadId,
						userId,
						csvId,
						extension,
						fileName: leadFileName,
						columnArray,
						upload,
						csv_import_slug: csvImportSlug,
						send_welcome_email: sendWelcomeEmail,
						combine_first_name_toggle: combineFirstNameToggle,
					};

					// Insert temp product data
					const responseObject = await importLeadTempRecord(optionData);
					if (responseObject !== STATUS_SUCCESS) {
						multipleInsertProduct.push(responseObject);
						const pushTotalRecord = multipleInsertProduct.length;

						// Bulk insert if batch size reached
						if (pushTotalRecord === Number(USER_LEAD_BULK_INSERT_CSV_TO_TEMP)) {
							const insertMultipleInsertProduct = multipleInsertProduct;
							multipleInsertProduct = [];
							await leadsImportLogs.insertMany(insertMultipleInsertProduct, { forceServerObjectId: true });
						}
					}
				};

				// Step 6: Read and process CSV file line by line
				await new Promise((resolve, reject) => {
					s3Stream
						.pipe(es.split())
						.pipe(es.mapSync(async (line) => {
							try {
								await processCsvLine(line);
							} catch (err) {
								reject(err);
							}
						}))
						.on('error', async (err) => {
							// Update import status to rejected on error
							await csvImport.updateOne(
								{ _id: newObjectIdDefault(csvId) },
								{
									$set: {
										is_process: LEADS_REJECTED_EXCEL_PROCESS,
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
							// Insert any remaining records after file is processed
							if (multipleInsertProduct.length > 0) {
								await leadsImportLogs.insertMany(multipleInsertProduct, { forceServerObjectId: true });
								multipleInsertProduct = [];
							}
							// Update import status to done
							await csvImportAllProcessDoneAfterFlagUpdate(req, res, csvId);
							res.end(res.__("Processing.........."));
							resolve();
						});
				});
			}
			// Step 7: Process XLSX file
			else {
				const fs = require('fs');
				const XlsxStreamReader = require("xlsx-stream-reader");

				const workBookReader = new XlsxStreamReader({
					verbose: true,
					formatting: true,
				});

				// Error handler for workbook
				workBookReader.on('error', async (error) => {
					await csvImport.updateOne(
						{ _id: newObjectIdDefault(csvId) },
						{
							$set: {
								is_process: LEADS_REJECTED_EXCEL_PROCESS,
								is_running: DEACTIVE,
								reason: res.__("admin.system.something_going_wrong_please_try_again"),
								modified: getUtcDate()
							}
						}
					);
					res.end(res.__("admin.system.something_going_wrong_please_try_again"));
				});

				// Worksheet handler
				workBookReader.on('worksheet', (workSheetReader) => {
					if (workSheetReader.id == 1 || workSheetReader.id == '1') {
						workSheetReader.on('row', async (row) => {
							if (row.attributes.r != 1) { // Skip header
								row.values.shift();
								const recordsItems = row.values;
								const optionData = {
									recordsItems,
									leadId,
									userId,
									csvId,
									extension,
									fileName: leadFileName,
									columnArray,
									upload,
									csv_import_slug: csvImportSlug,
									send_welcome_email: sendWelcomeEmail,
									combine_first_name_toggle: combineFirstNameToggle,
								};

								const responseObject = await importLeadTempRecord(optionData);
								if (responseObject !== STATUS_SUCCESS) {
									multipleInsertProduct.push(responseObject);
									const pushTotalRecord = multipleInsertProduct.length;

									// Bulk insert if batch size reached
									if (pushTotalRecord === Number(USER_LEAD_BULK_INSERT_CSV_TO_TEMP)) {
										const insertMultipleInsertProduct = multipleInsertProduct;
										multipleInsertProduct = [];
										await leadsImportLogs.insertMany(insertMultipleInsertProduct, { forceServerObjectId: true });
									}
								}
							}
						});
					}
					workSheetReader.process();
				});

				// End handler for workbook
				workBookReader.on('end', async () => {
					// Insert any remaining records after file is processed
					if (multipleInsertProduct.length > 0) {
						await leadsImportLogs.insertMany(multipleInsertProduct, { forceServerObjectId: true });
						multipleInsertProduct = [];
					}
					// Update import status to done
					await csvImportAllProcessDoneAfterFlagUpdate(req, res, csvId);
					res.end(res.__("Processing.........."));
				});

				// Step 8: Read XLSX file from S3 or local
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
			console.error("Error in importLeadsFromExcelToLogsTable:", error);
			res.status(500).end("Internal Server Error");
		}
	}; // End importLeadsFromExcelToLogsTable();

	/**
	 * Async function to prepare a record for insertion from Excel to temp table.
	 * Returns a record object if valid, otherwise returns STATUS_SUCCESS.
	 * @param {Object} valuesData - Data containing record and import meta.
	 * @return {Promise<Object|String>} - Prepared record object or STATUS_SUCCESS.
	 */
	importLeadTempRecord = async (valuesData) => {
		try {
			// Extract fields from valuesData
			const {
				recordsItems,
				leadId,
				userId,
				csvId,
				extension,
				fileName,
				columnArray,
				upload,
				csv_import_slug: csvImportSlug,
				send_welcome_email: sendWelcomeEmail,
				combine_first_name_toggle: combineFirstNameToggle
			} = valuesData;

			// Extract fields from recordsItems using columnArray mapping
			let email = recordsItems[columnArray[0]] ? recordsItems[columnArray[0]].toString() : "";
			let firstName = recordsItems[columnArray[1]] ? recordsItems[columnArray[1]].toString() : "";
			let lastName = recordsItems[columnArray[2]] ? recordsItems[columnArray[2]].toString() : "";
			let dob = recordsItems[columnArray[3]] ? recordsItems[columnArray[3]].toString() : "";
			let phone = recordsItems[columnArray[4]] ? recordsItems[columnArray[4]].toString() : "";
			let zipCode = recordsItems[columnArray[5]] ? recordsItems[columnArray[5]].toString() : "";
			let gender = recordsItems[columnArray[6]] ? recordsItems[columnArray[6]].toString() : "";

			// If combineFirstNameToggle is enabled, parse full name and shift columns accordingly
			if (combineFirstNameToggle === true || combineFirstNameToggle) {
				const fullnameSplice = recordsItems[columnArray[1]] ? recordsItems[columnArray[1]].toString() : "";
				const fullnameArray = fullnameSplice.split(" ");
				firstName = fullnameArray[0];
				lastName = fullnameArray[1] ? fullnameArray[1] : firstName;
				dob = recordsItems[columnArray[2]] ? recordsItems[columnArray[2]].toString() : "";
				phone = recordsItems[columnArray[3]] ? recordsItems[columnArray[3]].toString() : "";
				zipCode = recordsItems[columnArray[4]] ? recordsItems[columnArray[4]].toString() : "";
				gender = recordsItems[columnArray[5]] ? recordsItems[columnArray[5]].toString() : "";
			}

			// Only create a record if at least one key field is present
			if (firstName || lastName || email || dob || phone || zipCode || gender) {
				const saveData = {
					first_name: firstName,
					last_name: lastName,
					full_name: firstName ? firstName + " " + lastName : "",
					email: email,
					dob: dob,
					phone: phone,
					zip_code: zipCode,
					// username: username, // Uncomment if username is needed
					gender: gender,
					csv_id: newObjectIdDefault(csvId),
					lead_id: newObjectIdDefault(leadId),
					user_id: newObjectIdDefault(userId),
					extension: extension,
					excel_name: fileName,
					csv_import_slug: csvImportSlug,
					sheet_status: SHEET_STATUS_PROCESSING,
					send_welcome_email: sendWelcomeEmail,
					is_process: DEFAULT_ZERO,
					upload: upload,
					created: getUtcDate(),
					modified: getUtcDate()
				};
				return saveData;
			} else {
				return STATUS_SUCCESS;
			}
		} catch (err) {
			console.error("Error in importLeadTempRecord:", err);
			return STATUS_SUCCESS;
		}
	};

	/** 
	 * Async function to insert leads from temp (logs) to main lead table.
	 * Uses async/await for all DB queries and handles series processing with for...of.
	 * All parallel queries are handled with Promise.all where appropriate.
	 * Clean formatting and clear function comments provided.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.importExcelLeadData = async (req, res, next) => {
		const users = db.collection(TABLE_USERS);
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const leadsForms = db.collection(TABLE_LEAD_FORMS);
		const csvImport = db.collection(TABLE_LEADS_IMPORT);
		const leadsImportLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);

		try {
			// Step 1: Check if any import is currently running
			const runningCount = await leadsImportLogs.countDocuments({ "is_running": DEFAULT_ONE });
			if (runningCount > 0) {
				return res.end(res.__("Please wait, another process is running.........."));
			}

			// Step 2: Find the next batch of pending import logs
			const importLogsResult = await leadsImportLogs.find({
				"is_process": DEACTIVE,
			}).sort({ created: SORT_ASC }).limit(USER_LEAD_LEAD_TEMP_TO_MAIN_TABLE).toArray();

			if (!importLogsResult || importLogsResult.length === 0) {
				return res.end("No record founds......");
			}

			// Step 3: Set is_running flag for all selected logs
			const leadsImportLogsIds = importLogsResult.map(records => newObjectIdDefault(records._id));
			await leadsImportLogs.updateMany({ '_id': { $in: leadsImportLogsIds } }, { $set: { 'is_running': DEFAULT_ONE } });

			// Step 4: Process each import log in series
			for (const recordsItems of importLogsResult) {
				let errorsArray = [];
				let errorsQueryRealtedArray = [];

				let leadImportLogsId = recordsItems['_id'] ? recordsItems['_id'] : "";
				let csvImportId = recordsItems['csv_id'] ? recordsItems['csv_id'] : "";
				let csvImportSlug = recordsItems['csv_import_slug'] ? recordsItems['csv_import_slug'] : "";
				let leadFormsId = recordsItems['lead_id'] ? newObjectIdDefault(recordsItems['lead_id']) : "";
				let creatorId = recordsItems['user_id'] ? newObjectIdDefault(recordsItems['user_id']) : "";
				let firstName = recordsItems['first_name'] ? recordsItems['first_name'] : "";
				let lastName = recordsItems['last_name'] ? recordsItems['last_name'] : "";
				let fullName = recordsItems['full_name'] ? recordsItems['full_name'] : "";
				let email = recordsItems['email'] ? recordsItems['email'] : "";
				let dob = recordsItems['dob'] ? recordsItems['dob'] : "";
				let mobile = recordsItems['phone'] ? recordsItems['phone'] : "";
				let zipCode = recordsItems['zip_code'] ? recordsItems['zip_code'] : "";
				let userName = recordsItems['username'] ? recordsItems['username'] : "";
				let gender = recordsItems['gender'] ? recordsItems['gender'] : "";
				let sendWelcomeEmail = recordsItems['send_welcome_email'] ? recordsItems['send_welcome_email'] : "";
				let excelFileName = recordsItems['excel_name'] ? recordsItems['excel_name'] : "";

				let messageBoxData = [];
				let messageBoxDataLength = 0;
				let messageBox = {};
				let dropdownTitleData = [];
				let dropDownTitleDataLength = 0;
				let dropDownTitle = {};
				let submitType = LEAD_IMPORT_SUBMIT_TYPE_SUBSCRIBER;
				let password = "";
				let emailErrFlag = false;
				let fullNameErrFlag = false;
				let genderErrFlag = false;
				let phoneErrFlag = false;
				let usernameErrFlag = false;
				let zipCodeErrFlag = false;
				let dobErrFlag = false;

				// Email validation
				if (!email || email == "") {
					emailErrFlag = true;
					errorsArray.push(res.__("admin.user.please_enter_email"));
				}
				let mailformat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
				if (email && !email.match(mailformat)) {
					emailErrFlag = true;
					errorsArray.push(res.__("admin.user.please_enter_valid_email_address"));
				}

				// Name validation
				if (fullName && !FULL_NAME_REGULAR_EXPRESSION.test(fullName)) {
					fullNameErrFlag = true;
					errorsArray.push(res.__("admin.leads_file.please_enter_valid_name"));
				}

				// Gender validation
				if (gender) {
					let genderLower = gender.toLowerCase();
					const maleFemaleOtherGender = [MALE, FEMALE, OTHER, 'male', 'm', 'female', 'f', 'other', 'o', '1', '2', '3'];
					if (!maleFemaleOtherGender.includes(genderLower)) {
						genderErrFlag = true;
						errorsArray.push(res.__("admin.leads_file.please_valid_gender"));
					} else {
						if ([MALE, '1', 'male', 'm'].includes(genderLower)) gender = MALE;
						if ([FEMALE, '2', 'female', 'f'].includes(genderLower)) gender = FEMALE;
						if ([OTHER, '3', 'other', 'o'].includes(genderLower)) gender = OTHER;
					}
				}

				// Mobile Number validation
				if (mobile && !ISNUMBER_VALIDATION_REGULAR_EXPRESSION.test(mobile)) {
					phoneErrFlag = true;
					errorsArray.push(res.__("admin.user.invalid_phone_number"));
				}

				// Username validation
				if (userName) {
					var CharArray = userName.split(" ");
					if (CharArray.length > 1) {
						usernameErrFlag = true;
						errorsArray.push(res.__("admin.user.no_spaces_are_allowed_in_the_username"));
					}
				}

				// Date validation
				if (dob && (strtotime(dob) == false || ISNUMBER_VALIDATION_REGULAR_EXPRESSION.test(dob))) {
					dobErrFlag = true;
					errorsArray.push(res.__("admin.leads_file.invalid_date_format"));
				}
				dob = dob ? strtotime(dob) : "";
				if (dob != '') {
					dob = moment.unix(dob).format(DATE_FORMAT_SAVE);
				}

				let mendatoryFieldErrorMessageFlag = errorsArray.length > 0;

				// Step 5: Run parallel queries for hybrid/user/lead/username checks and welcome email count
				let [
					hybridResult,
					userCreatedResult,
					leadsFormsResult,
					findUserName,
					alreadySendWelcomeEmailCount
				] = await Promise.all([
					// Hybrid user check
					users.findOne({ "email": { $regex: '^' + email + '$', $options: 'i' }, "is_deleted": NOT_DELETED }),
					// Creator user check
					users.findOne({ _id: creatorId }, { projection: { _id: 1, full_name: 1, email: 1, slug: 1, complete_profile_reward: 1, public_business_informaton: 1 } }),
					// Lead form check
					leadsForms.findOne({ _id: leadFormsId, user_id: creatorId }, { projection: { slug: 1, title: 1, notify_email: 1, custom_thank_you_title: 1, custom_thank_you_message: 1 } }),
					// Username slug check
					(userName != '') ? findUserSlug(req, res, { user_name: userName, email: email }) : Promise.resolve({}),
					// Welcome email count
					sendWelcomeEmailsCountData(email, leadFormsId)
				]);

				sendWelcomeEmail = (alreadySendWelcomeEmailCount > 0) ? IMPORT_LEADS_WELCOME_EMAIL_YES_STATUS : sendWelcomeEmail;

				let hybridLead = (hybridResult && Object.keys(hybridResult).length > 0) ? HYBRID : NOT_HYBRID;
				let hybridFirstName = (hybridResult && hybridResult.fname) ? hybridResult.fname : "";
				let hybridLastName = (hybridResult && hybridResult.lname) ? hybridResult.lname : "";
				let hybridUserName = (hybridResult && hybridResult.slug) ? hybridResult.slug : "";
				let hybridGender = (hybridResult && hybridResult.gender) ? hybridResult.gender : "";
				let hybridZipCode = (hybridResult && hybridResult.zip) ? hybridResult.zip : "";
				let hybridMobile = (hybridResult && hybridResult.mobile) ? hybridResult.mobile : "";
				let hybridImageName = (hybridResult && hybridResult.image_name) ? hybridResult.image_name : "";
				let hybridDob = (hybridResult && hybridResult.dob) ? moment(hybridResult.dob).format(DATE_FORMAT_SAVE) : "";

				// If hybrid, override fields
				if (hybridLead == HYBRID) {
					firstName = hybridFirstName;
					lastName = hybridLastName;
					fullName = (hybridFirstName || hybridLastName) ? hybridFirstName + " " + hybridLastName : "";
					dob = hybridDob;
					mobile = hybridMobile;
					zipCode = hybridZipCode;
					userName = hybridUserName;
					gender = hybridGender;

					genderErrFlag = false;
					phoneErrFlag = false;
					usernameErrFlag = false;
					zipCodeErrFlag = false;
					dobErrFlag = false;
					fullNameErrFlag = false;
				}

				let creatorFullName = (userCreatedResult && userCreatedResult.full_name) ? userCreatedResult.full_name : "";
				let leadName = (leadsFormsResult && leadsFormsResult.title) ? leadsFormsResult.title : "";
				let notifyEmail = (leadsFormsResult && leadsFormsResult.notify_email) ? leadsFormsResult.notify_email : [];
				let customThankyouTitle = (leadsFormsResult && leadsFormsResult.custom_thank_you_title) ? leadsFormsResult.custom_thank_you_title : "";
				let customThankyouMessage = (leadsFormsResult && leadsFormsResult.custom_thank_you_message) ? leadsFormsResult.custom_thank_you_message : "";

				// Additional error checks
				if (!mendatoryFieldErrorMessageFlag && (!userCreatedResult || Object.keys(userCreatedResult).length == 0)) {
					errorsArray.push(res.__("front.leads.this_user_not_here"));
					errorsQueryRealtedArray.push(res.__("front.leads.this_user_not_here"));
				}
				if (!mendatoryFieldErrorMessageFlag && (!leadsFormsResult || Object.keys(leadsFormsResult).length == 0)) {
					errorsArray.push(res.__("front.leads.this_leads_not_here"));
					errorsQueryRealtedArray.push(res.__("front.leads.this_leads_not_here"));
				}
				if (hybridLead == NOT_HYBRID && userName != '' && findUserName && findUserName.status == STATUS_SUCCESS) {
					errorsArray.push(res.__("admin.user.your_username_is_already_exist"));
					errorsQueryRealtedArray.push(res.__("admin.user.your_username_is_already_exist"));
				}

				// Prepare errors array
				let errors = [];
				if (errorsArray.length > 0) {
					for (let j = 0; j < errorsArray.length; j++) {
						errors.push(errorsArray[j]);
					}
				}

				// If email is valid and no query-related errors, clean up fields
				if (email != '' && !emailErrFlag && errorsQueryRealtedArray.length == 0) {
					gender = (!genderErrFlag) ? gender : "";
					mobile = (!phoneErrFlag) ? mobile : "";
					userName = (!usernameErrFlag) ? userName : "";
					zipCode = (!zipCodeErrFlag) ? zipCode : "";
					dob = (!dobErrFlag) ? dob : "";
					fullName = (!fullNameErrFlag) ? fullName : "";
					firstName = (!fullNameErrFlag) ? firstName : "";
					lastName = (!fullNameErrFlag) ? lastName : "";
				}

				// Step 6: Insert or update lead data
				if (email != '' && !emailErrFlag && errorsQueryRealtedArray.length == 0) {
					// Check if lead already exists
					let widgetData = await signupLeadForms.findOne({
						'email': { $regex: "^" + email + "$", $options: "i" },
						'creator_id': creatorId,
						'lead_forms_id': leadFormsId,
					});

					if (widgetData && Object.keys(widgetData).length > 0) {
						// Update existing lead
						let updateData = {
							messageBoxValue: messageBox,
							message_field_count: messageBoxDataLength,
							message_box_title: messageBoxData,
							dropDownTitleValue: dropDownTitle,
							dropdown_field_count: dropDownTitleDataLength,
							type_dropdown_title: dropdownTitleData,
							hybrid: hybridLead,
							leads_import_log_id: leadImportLogsId,
							leads_import_id: csvImportId,
							leads_import_slug: csvImportSlug,
							send_welcome_email: sendWelcomeEmail,
							modified: getUtcDate(),
						};

						if (fullName != '') {
							updateData['first_name'] = firstName ? firstName : hybridFirstName;
							updateData['last_name'] = lastName ? lastName : hybridLastName;
							let finalFullName = updateData['first_name'] + " " + updateData['last_name'];
							updateData['full_name'] = finalFullName ? finalFullName.trim() : finalFullName;
						}
						if (password != '') {
							updateData['password'] = bcryptPassword;
						}
						gender = gender ? gender : hybridGender;
						if (gender != '') updateData['gender'] = gender;
						mobile = mobile ? mobile : hybridMobile;
						if (mobile != '') updateData['mobile'] = mobile;
						let dobDate = hybridDob ? hybridDob : "";
						dob = dob ? dob : dobDate;
						if (dob != '') {
							updateData['dob'] = ageUtcDate(dob);
							updateData['age'] = calculateAge(dob);
						}
						zipCode = zipCode ? zipCode : hybridZipCode;
						if (zipCode != '') updateData['zip'] = zipCode;
						userName = userName ? userName : hybridUserName;
						if (userName != '') updateData['slug'] = userName;
						if (hybridImageName != '') updateData['image_name'] = hybridImageName;

						await signupLeadForms.updateOne({
							email: { $regex: "^" + email + "$", $options: "i" },
							creator_id: creatorId,
							lead_forms_id: leadFormsId,
						}, { $set: updateData });

						// Update lead stage level and logs in parallel
						let stageOptions = {
							email: email,
							creator_id: creatorId,
							lead_forms_id: leadFormsId,
							creator_full_name: creatorFullName,
							notify_email: notifyEmail,
							lead_name: leadName,
							user_created_result: userCreatedResult,
							update_data: updateData,
							leads_import_log_id: leadImportLogsId,
							leads_import_id: csvImportId,
							leads_import_slug: csvImportSlug,
							send_welcome_email: sendWelcomeEmail,
							already_send_welcome_email_count: alreadySendWelcomeEmailCount,
							lead_forms_subscriber_id: widgetData._id,
							excel_file_name: excelFileName,
						};

						await leadsStagesLevel(req, res, stageOptions);

						if (errors.length > 0) {
							await leadsImportFaildReasonLogs(leadImportLogsId, errors, SHEET_STATUS_WARNING);
							await csvImport.updateOne({ _id: newObjectIdDefault(csvImportId) }, { $inc: { total_records: 1, warning_records: 1 } });
						} else {
							await successImportLogsSave(csvImportId, leadImportLogsId);
						}
						await completeStatusUpdateAfterAllLeadsExcelInsert(req, res, csvImportId);

					} else {
						// Insert new lead
						firstName = firstName ? firstName : hybridFirstName;
						lastName = lastName ? lastName : hybridLastName;
						fullName = (firstName || lastName) ? firstName + " " + lastName : "";
						userName = userName ? userName : hybridUserName;
						gender = gender ? gender : hybridGender;
						zipCode = zipCode ? zipCode : hybridZipCode;
						mobile = mobile ? mobile : hybridMobile;
						let dobDate = hybridDob ? hybridDob : "";
						dob = dob ? dob : dobDate;

						let insertData = {
							first_name: firstName,
							last_name: lastName,
							full_name: fullName,
							slug: userName,
							email: email,
							creator_name: userCreatedResult.full_name,
							creator_email: userCreatedResult.email,
							creator_id: creatorId,
							lead_forms_id: leadFormsId,
							lead_forms_slug: leadsFormsResult.slug,
							password: "",
							is_deleted: NOT_DELETED,
							dob: (dob != '') ? ageUtcDate(dob) : "",
							age: (dob != '') ? calculateAge(dob) : 0,
							gender: gender,
							zip: zipCode,
							mobile: mobile,
							custom_thank_you_title: customThankyouTitle,
							custom_thank_you_message: customThankyouMessage,
							image_name: hybridImageName,
							hybrid: hybridLead,
							message_box_title: messageBoxData,
							message_field_count: messageBoxDataLength,
							messageBoxValue: messageBox,
							type_dropdown_title: dropdownTitleData,
							dropdown_field_count: dropDownTitleDataLength,
							dropDownTitleValue: dropDownTitle,
							submit_type: submitType,
							leads_import_log_id: leadImportLogsId,
							leads_import_id: csvImportId,
							leads_import_slug: csvImportSlug,
							send_welcome_email: sendWelcomeEmail,
							created: getUtcDate(),
							modified: getUtcDate()
						};

						let signupLeadFormsResult = await signupLeadForms.insertOne(insertData);
						let signupLeadFormsId = (signupLeadFormsResult && signupLeadFormsResult.insertedId) ? signupLeadFormsResult.insertedId : "";

						// Update subscriber data in lead form
						let updateData = {};
						if (fullName != '') {
							updateData['first_name'] = firstName;
							updateData['last_name'] = lastName;
							updateData['full_name'] = fullName;
						}
						if (gender != '') updateData['gender'] = gender;
						if (mobile != '') updateData['mobile'] = mobile;
						if (dob != '') {
							updateData['dob'] = ageUtcDate(dob);
							updateData['age'] = calculateAge(dob);
						}
						if (zipCode != '') updateData['zip'] = zipCode;
						if (userName != '') updateData['slug'] = userName;
						if (hybridImageName != '') updateData['image_name'] = hybridImageName;

						await leadsForms.updateOne({ _id: leadFormsId }, { $set: { 'is_subscriber': DEFAULT_ONE } });

						let stageOptions = {
							email: email,
							creator_id: creatorId,
							lead_forms_id: leadFormsId,
							creator_full_name: creatorFullName,
							notify_email: notifyEmail,
							lead_name: leadName,
							user_created_result: userCreatedResult,
							update_data: updateData,
							leads_import_log_id: leadImportLogsId,
							leads_import_id: csvImportId,
							leads_import_slug: csvImportSlug,
							lead_forms_subscriber_id: signupLeadFormsId,
							send_welcome_email: sendWelcomeEmail,
							already_send_welcome_email_count: alreadySendWelcomeEmailCount,
							excel_file_name: excelFileName,
						};

						await leadsStagesLevel(req, res, stageOptions);

						if (errors.length > 0) {
							await leadsImportFaildReasonLogs(leadImportLogsId, errors, SHEET_STATUS_WARNING);
							await csvImport.updateOne({ _id: newObjectIdDefault(csvImportId) }, { $inc: { total_records: 1, warning_records: 1 } });
						} else {
							await successImportLogsSave(csvImportId, leadImportLogsId);
						}
						await completeStatusUpdateAfterAllLeadsExcelInsert(req, res, csvImportId);
					}
				} else {
					// Insert logs entry for failed reason
					await leadsImportFaildReasonLogs(leadImportLogsId, errors, SHEET_STATUS_FAILED);
					await csvImport.updateOne({ _id: newObjectIdDefault(csvImportId) }, { $inc: { total_records: 1, failed_records: 1 } });
					await completeStatusUpdateAfterAllLeadsExcelInsert(req, res, csvImportId);
				}
			}

			// Step 7: Send Success Response
			return res.end(res.__("Processing............"));
		} catch (e) {
			console.error("Error in importExcelLeadData:", e);
			return res.end(res.__("admin.system.something_going_wrong_please_try_again"));
		}
	}; // End importExcelLeadData();

	/**
	 * Async function to send campaign newsletter emails to users.
	 * Uses async/await for all DB queries and processes user emails in series.
	 * Handles parallel DB updates with Promise.all where appropriate.
	 * Clean formatting and clear function comments provided.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.userSendCampaingNewsletterEmail = async (req, res, next) => {
		const pollCampaignSendNewsLetter = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER);
		const campaignEmailLogs = db.collection(TABLE_CAMPAIGN_SEND_NEWSLETTER_LOGS);
		const users = db.collection(TABLE_USERS);

		try {
			// Step 1: Check if any campaign is currently processing
			const processingCount = await pollCampaignSendNewsLetter.countDocuments({ status: CAMPAIGN_PROCESSING_PROCESS });
			if (processingCount > 0) {
				return res.end("Already email send Processing. Please wait complete status after send email other users............");
			}

			// Step 2: Find the next pending or processing campaign
			const campaignResultArr = await pollCampaignSendNewsLetter
				.find({ status: { $in: [CAMPAIGN_PENDING_PROCESS, CAMPAIGN_PROCESSING_PROCESS] } })
				.sort({ created: SORT_ASC })
				.limit(1)
				.toArray();

			if (!campaignResultArr || campaignResultArr.length === 0) {
				return res.end("No records found.");
			}

			const campaignResult = campaignResultArr[0];
			const campaignId = campaignResult._id ? campaignResult._id : "";
			const campaignOwnerUserId = campaignResult.user_id ? campaignResult.user_id : "";
			const resultUsers = campaignResult.result_users ? campaignResult.result_users : "";
			const newsletterDetails = campaignResult.newsletter_details ? campaignResult.newsletter_details : {};

			const emailTemplateId = newsletterDetails._id || "";
			const emailTemplateTitle = newsletterDetails.template_title || "";
			const emailTemplateDescription = newsletterDetails.description || "";
			const emailTemplateAction = newsletterDetails.action || "";
			const emailHost = newsletterDetails.host || "";
			const emailPort = newsletterDetails.port || "";
			const emailPassword = newsletterDetails.email_password || "";
			const emailSubject = newsletterDetails.subject || "";
			const emailPageBody = newsletterDetails.body || "";
			const emailFrom = newsletterDetails.from || "";
			const emailFromEmail = newsletterDetails.from_email || "";
			const attachReward = newsletterDetails.attach_reward || "";

			// Step 3: Find campaign email logs for this campaign
			const campaignEmailLogsResult = await campaignEmailLogs
				.find({ campaign_send_newsletter_id: newObjectIdDefault(campaignId) })
				.limit(EMAIL_CAMPAIGN_LIMIT)
				.toArray();

			if (!campaignEmailLogsResult || campaignEmailLogsResult.length === 0) {
				return res.end("No records found.");
			}

			// Step 4: Update campaign status to processing
			await pollCampaignSendNewsLetter.updateOne(
				{ _id: newObjectIdDefault(campaignId) },
				{ $set: { status: CAMPAIGN_PROCESSING_PROCESS, modified: getUtcDate() } }
			);

			// Step 5: Process each user in series
			for (const newsletterLogsResult of campaignEmailLogsResult) {
				const campaignLogsId = newsletterLogsResult._id ? newObjectIdDefault(newsletterLogsResult._id) : "";
				const rewardSendUserID = newsletterLogsResult.user_id ? newsletterLogsResult.user_id : "";
				const emailSendTo = newsletterLogsResult.user_email ? newsletterLogsResult.user_email : "";
				const userUnsubscribedFlag = newsletterLogsResult.user_unsubscribed_flag ? newsletterLogsResult.user_unsubscribed_flag : false;

				// Only process if resultUsers is present
				if (resultUsers) {
					// Prepare reward options
					const rewardsOptions = {
						complete_attach_reward_id: attachReward ? newObjectIdDefault(attachReward) : "",
						reward_send_user_id: rewardSendUserID,
						result_users: resultUsers,
						email_template_id: emailTemplateId,
						email_template_action: emailTemplateAction,
						template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
						campaign_send_newsletter_id: campaignId,
						campaign_send_newsletter_logs_id: campaignLogsId,
					};

					req.body.email = emailSendTo;
					const campaignUnscribedValidateString = newsletterSubscriberEncId(emailSendTo);

					try {
						// Step 5.1: Assign earn rewards (awaited)
						const earnRewardInsertedId = await addEarnRewards(req, res, rewardsOptions);

						// Step 5.2: Prepare email send options
						const sendOptionData = {
							reward_id: attachReward ? newObjectIdDefault(attachReward) : newObjectIdDefault(),
							email_template_id: emailTemplateId,
							email_template_action: emailTemplateAction,
							subject: emailSubject,
							body: emailPageBody,
							from: emailFrom,
							from_email: emailFromEmail,
							host: emailHost,
							email_password: emailPassword,
							port: emailPort,
							email_send_to: emailSendTo,
							owner_user_id: campaignOwnerUserId,
							user_id: campaignOwnerUserId,
							link_url: "",
							earn_reward_inserted_id: earnRewardInsertedId,
							template_type: EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
							campaign_send_newsletter_logs_id: campaignLogsId,
							email_template_title: emailTemplateTitle,
							email_template_description: emailTemplateDescription,
							campaign_unsubscribe_validate_string: campaignUnscribedValidateString,
							owner_user_data: resultUsers,
							whether_to_send_mail_or_not: userUnsubscribedFlag,
						};

						// Step 5.3: Send email (awaited)
						const sendMailError = await sendMailGivenBody(req, res, sendOptionData);

						// Step 5.4: Prepare DB update promises
						const updatePromises = [];

						if (sendMailError) {
							// Update campaign log with error
							updatePromises.push(
								campaignEmailLogs.updateOne(
									{ _id: newObjectIdDefault(campaignLogsId) },
									{ $set: { is_send: false, all_process_flag: true, error: sendMailError } }
								)
							);
						} else {
							// Update user with unsubscribe string and campaign log with success
							updatePromises.push(
								users.updateOne(
									{ _id: newObjectIdDefault(rewardSendUserID) },
									{ $set: { campaign_unsubscribe_validate_string: campaignUnscribedValidateString } }
								),
								campaignEmailLogs.updateOne(
									{ _id: newObjectIdDefault(campaignLogsId) },
									{
										$set: {
											is_send: true,
											all_process_flag: true,
											error: sendMailError,
											campaign_unsubscribe_validate_string: campaignUnscribedValidateString
										}
									}
								)
							);
						}

						// Step 5.5: Wait for all DB updates to complete in parallel
						await Promise.all(updatePromises);

					} catch (err) {
						// On error, update campaign log with error and continue
						await campaignEmailLogs.updateOne(
							{ _id: newObjectIdDefault(campaignLogsId) },
							{ $set: { is_send: false, all_process_flag: true, error: err && err.message ? err.message : String(err) } }
						);
						// Continue to next user
					}
				}
			}

			// Step 6: Check if all campaign logs are processed
			const remainingCount = await campaignEmailLogs.countDocuments({
				campaign_send_newsletter_id: newObjectIdDefault(campaignId),
				all_process_flag: false
			});

			if (remainingCount === DEFAULT_ZERO) {
				// All emails sent, update campaign status to complete
				await pollCampaignSendNewsLetter.updateOne(
					{ _id: newObjectIdDefault(campaignId) },
					{ $set: { status: CAMPAIGN_COMPLETE_PROCESS, modified: getUtcDate() } }
				);
				return res.end("Email send complete");
			} else {
				return res.end("Email send Processing............");
			}
		} catch (error) {
			console.error("Error in userSendCampaingNewsletterEmail:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End userSendCampaingNewsletterEmail();

	/**
	 * Async function to update CSV leads import logs for a successful record.
	 * Increments total and success records in the import, and updates the log entry.
	 * Uses async/await for all DB queries and handles them in parallel.
	 * @param {*} csvImportId 
	 * @param {*} leadImportLogsId 
	 * @return {Promise<void>}
	 */
	successImportLogsSave = async (csvImportId, leadImportLogsId) => {
		const csvImport = db.collection(TABLE_LEADS_IMPORT);
		const leadsImportLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);

		// Prepare update operations
		const updateCsvImport = csvImport.updateOne(
			{ '_id': newObjectIdDefault(csvImportId) },
			{
				$inc: {
					total_records: 1,
					success_records: 1
				}
			}
		);

		const updateLeadsImportLogs = leadsImportLogs.updateOne(
			{ _id: newObjectIdDefault(leadImportLogsId) },
			{
				$set: {
					failed_reason: [],
					sheet_status: SHEET_STATUS_SUCCESS,
					is_process: DEFAULT_ONE,
					is_running: DEFAULT_ZERO,
					modified: getUtcDate()
				}
			}
		);

		// Run both updates in parallel and wait for completion
		await Promise.all([updateCsvImport, updateLeadsImportLogs]);
	}; // End successImportLogsSave();

	/**
	 * Async function to insert/update failed reason logs for a lead import record.
	 * Uses async/await for DB query.
	 * @param {*} leadImportLogsId - The ID of the lead import log to update.
	 * @param {Array} errors - Array of error messages or objects.
	 * @param {*} sheetStatus - Status to set for the sheet.
	 * @return {Promise<void>}
	 */
	leadsImportFaildReasonLogs = async (leadImportLogsId, errors, sheetStatus) => {
		const leadsImportLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);

		// Update the log entry with failed reason, status, and timestamps
		await leadsImportLogs.updateOne(
			{ _id: newObjectIdDefault(leadImportLogsId) },
			{
				$set: {
					failed_reason: errors,
					sheet_status: sheetStatus,
					is_process: DEFAULT_ONE,
					is_running: DEFAULT_ZERO,
					modified: getUtcDate()
				}
			}
		);
	}; // End leadsImportFaildReasonLogs();

	/**
	 * Async function to resend welcome email to subscriber lead users.
	 * Uses async/await for all DB queries and processes users in series.
	 * Handles parallel DB updates with Promise.all where appropriate.
	 * Clean formatting and clear function comments provided.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.againSentWlcEmailSubscriberLeadUser = async (req, res, next) => {
		const againSentWlcWmailSubscriberUser = db.collection(TABLE_AGAIN_SENT_WLC_EMAIL_SUBSCRIBER_USER);
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		try {
			// Step 1: Find up to 500 logs for users who need welcome mail sent (is_sent = processing)
			const resultUserForWelcomeMailSend = await againSentWlcWmailSubscriberUser.aggregate([
				{
					$match: {
						"is_sent": IS_WELCOME_EMAIL_PROCESSING_STATUS,
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { emailId: "$email" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$email", "$$emailId"] },
										]
									},
								}
							},
						],
						as: "sentEmailUserData"
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
						],
						as: "userCreatedResult"
					}
				},
				{ $limit: 500 },
				{ $sort: { created: SORT_ASC } },
			]).toArray();

			// Step 2: If no records found, return message
			if (!resultUserForWelcomeMailSend || resultUserForWelcomeMailSend.length === 0) {
				return res.end("No record founds......");
			}

			// Step 3: Process each user in series
			for (const recordData of resultUserForWelcomeMailSend) {
				const againSentWlcEmailSubscriberUserId = recordData._id ? recordData._id : "";
				const creatorId = recordData.user_id ? recordData.user_id : "";
				const emailUser = recordData.email ? recordData.email : "";
				const selectedWelcomeEmailId = recordData.selected_welcome_email_id ? recordData.selected_welcome_email_id : "";
				const leadFormsId = recordData.lead_forms_id ? recordData.lead_forms_id : "";
				const leadFormsSubscriberId = recordData.lead_forms_subscriber_id ? recordData.lead_forms_subscriber_id : "";
				const rewardSendUserId = (recordData.sentEmailUserData && recordData.sentEmailUserData.length > 0) ? recordData.sentEmailUserData[0]['_id'] : "";
				const userCreatedResult = (recordData.userCreatedResult && recordData.userCreatedResult.length > 0) ? recordData.userCreatedResult[0] : "";
				const welcomeEmailUnsubscribed = recordData.welcome_email_unsubscribed ? recordData.welcome_email_unsubscribed : false;

				const currentTimeStamp = new Date().getTime();
				const validateString = crypto.createHash('md5').update(currentTimeStamp + emailUser).digest("hex");

				// Generate unsubscriber validate string
				const unsubscriberValidateGenerateString = newsletterSubscriberEncId(emailUser);

				// Step 4: Update signup lead stage with validate strings
				await signupLeadForms.updateOne(
					{ _id: newObjectIdDefault(leadFormsSubscriberId) },
					{
						$set: {
							'validate_string': validateString,
							'welcome_email_unsubscribe_validate_string': unsubscriberValidateGenerateString,
						}
					}
				);

				// Step 5: Prepare request body for welcomeMailSend
				req.body.email = emailUser;
				req.body.welcome_email_unsubscribed_flag = welcomeEmailUnsubscribed;
				req.body.welcome_email_unsubscribe_validate_string = unsubscriberValidateGenerateString;

				const emailOptionsData = {
					'creator_id': creatorId,
					'email_send_to': emailUser ? emailUser.toLowerCase() : "",
					'reward_send_user_id': rewardSendUserId,
					'link_url': FRONT_URL + "pocial/login",
					'link_blocked_wallet_url': FRONT_URL + "my-wallet/wallet-listing/" + validateString,
					'user_created_result': userCreatedResult,
					'lead_forms_id': leadFormsId,
					'crone_accourding_welcome_email_id': selectedWelcomeEmailId,
				};

				// Step 6: Send welcome email and update status after send
				try {
					await welcomeMailSend(req, res, emailOptionsData);

					// Update is_sent flag after successful mail send
					await againSentWlcWmailSubscriberUser.updateOne(
						{ _id: newObjectIdDefault(againSentWlcEmailSubscriberUserId) },
						{ $set: { "is_sent": IS_WELCOME_EMAIL_SENT_STATUS } }
					);
				} catch (err) {
					// Optionally log error, but continue with next user
					console.error("Error sending welcome email for user:", emailUser, err);
				}
			}

			// Step 7: Send success response after all users processed
			return res.end(res.__("Processing.........."));
		} catch (err) {
			console.error("Error in againSentWlcEmailSubscriberLeadUser:", err);
			return res.end(res.__("admin.system.something_going_wrong_please_try_again"));
		}
	}; // End againSentWlcEmailSubscriberLeadUser();

	/** 
	 * Function to send insider poll emails to users.
	 * Uses async/await for all DB operations and handles parallel queries with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.insiderPollEmailSentToUser = async (req, res, next) => {
		// Set collections
		const insiderSendEmailPollUser = db.collection(TABLE_INSIDER_SEND_EMAIL_POLL_USER_LOGS);
		const insiderChatEmail = db.collection(TABLE_INSIDER_AI_CAMPAIGN_CHAT);
		const polls = db.collection(TABLE_POLLS);
		const users = db.collection(TABLE_USERS);

		try {
			// Step 1: Check if any processing is already running
			const processingCount = await insiderSendEmailPollUser.countDocuments({ "is_sent": IS_INSIDERS_POLL_USER_VOTTED_PROCESSING_STATUS });
			if (processingCount > 0) {
				return res.end("Already email send Processing. Please wait complete status after send email other users............");
			}

			// Step 2: Find up to 100 pending poll user logs, sorted by creation date
			const logsResult = await insiderSendEmailPollUser
				.find({ "is_sent": IS_INSIDERS_POLL_USER_VOTTED_PENDING_STATUS })
				.sort({ 'created': SORT_ASC })
				.limit(100)
				.toArray();

			if (!logsResult || logsResult.length === 0) {
				return res.end("Email not send...");
			}

			// Step 3: Mark all found logs as processing
			const logsResultDataIdsArray = logsResult.map(record => newObjectIdDefault(record._id));
			await insiderSendEmailPollUser.updateMany(
				{ '_id': { $in: logsResultDataIdsArray } },
				{ $set: { 'is_sent': IS_INSIDERS_POLL_USER_VOTTED_PROCESSING_STATUS } }
			);

			// Step 4: Process each log entry in series
			for (const allResultData of logsResult) {
				const ownerUserId = allResultData?.owner_user_id ? newObjectIdDefault(allResultData.owner_user_id) : "";
				const generatedInsiderPollId = allResultData?.generated_insider_poll_id ? newObjectIdDefault(allResultData.generated_insider_poll_id) : "";
				const generatedInsiderRewardId = allResultData?.generated_insider_reward_id ? newObjectIdDefault(allResultData.generated_insider_reward_id) : "";
				const insiderAiCampaignChatId = allResultData?.insider_ai_campaign_chat_id ? newObjectIdDefault(allResultData.insider_ai_campaign_chat_id) : "";
				const sentToEmailUserId = allResultData?.sent_to_email_user_id ? newObjectIdDefault(allResultData.sent_to_email_user_id) : "";

				// Step 4.1: Fetch all required data in parallel
				const [
					pollDetails,
					getEmailContentDetails,
					sentToEmailUserDetails,
					ownerUserDetails
				] = await Promise.all([
					generatedInsiderPollId ? polls.findOne({ "_id": generatedInsiderPollId }) : Promise.resolve({}),
					insiderAiCampaignChatId ? insiderChatEmail.findOne({ "_id": insiderAiCampaignChatId }) : Promise.resolve({}),
					sentToEmailUserId ? users.findOne({ "_id": sentToEmailUserId }) : Promise.resolve({}),
					ownerUserId ? users.findOne({ "_id": ownerUserId }) : Promise.resolve({})
				]);

				const currentYear = new Date().getFullYear();

				// Step 4.2: Prepare user and business details
				const userEmail = sentToEmailUserDetails?.email || "";
				const insiderPollWelcomeEmailUnsubscribed = sentToEmailUserDetails?.insider_poll_welcome_email_unsubscribed || "";
				const unsubscriberValidateGenerateString = newsletterSubscriberEncId(userEmail);

				const publicBusinessInformaton = ownerUserDetails?.public_business_informaton || {};
				const nameOfTheBusiness = publicBusinessInformaton?.name_of_the_business || "";
				const businessLogo = publicBusinessInformaton?.business_logo || "";
				const businessRewardLogo = publicBusinessInformaton?.reward_image || "";
				const primaryAddress = publicBusinessInformaton?.primary_address || "";
				let profileImageUrl = "";

				// Step 4.3: Poll and email content details
				const pollUrl = pollDetails?.custom_url ? FRONT_URL + "p/" + pollDetails.custom_url : "";
				const emailContentObject = getEmailContentDetails?.content || {};
				const campaignContentDetails = emailContentObject;

				const emailHeading = emailContentObject?.email_heading || "";
				const subject = emailContentObject?.subject || "";
				const body = emailContentObject?.body || "";

				const campaignBannerImage = campaignContentDetails?.banner_image ? AI_EMAIL_IMAGES_URL + campaignContentDetails.banner_image : "";
				const campaignRemoveBulletBannerContainer = campaignContentDetails?.remove_bullet_banner_container || false;
				const campaignCustomUrl = pollUrl;
				const campaignEmailClosingParagraph = campaignContentDetails?.email_closing_paragraph || "";
				const campaignEmailEndingSignature = campaignContentDetails?.email_ending_signature || "";
				const campaignCtaText = campaignContentDetails?.cta_text || "";
				const campaignCtaTextLinkUrl = campaignContentDetails?.cta_text_url || "";
				const campaignCtaTextNew = POLL_BUTTON_TEXT_NAME_FOR_AI;
				const campaignBulletPoints = emailContentObject?.bullet_points || [];

				// Step 4.4: Bullet points
				const bulletPointsHeading1 = campaignBulletPoints[0]?.heading1 || "";
				const bulletPointsParagraph1 = campaignBulletPoints[0]?.paragraph1 || "";
				const bulletPointsImage1 = campaignBulletPoints[0]?.image1 ? AI_EMAIL_IMAGES_URL + campaignBulletPoints[0].image1 : "";
				const bulletPointsRemoveBulletBannerContainer1 = campaignBulletPoints[0]?.remove_bullet_container_1 || false;

				const bulletPointsHeading2 = campaignBulletPoints[1]?.heading2 || "";
				const bulletPointsParagraph2 = campaignBulletPoints[1]?.paragraph2 || "";
				const bulletPointsImage2 = campaignBulletPoints[1]?.image2 ? AI_EMAIL_IMAGES_URL + campaignBulletPoints[1].image2 : "";
				const bulletPointsRemoveBulletBannerContainer2 = campaignBulletPoints[1]?.remove_bullet_container_2 || false;

				const bulletPointsHeading3 = campaignBulletPoints[2]?.heading3 || "";
				const bulletPointsParagraph3 = campaignBulletPoints[2]?.paragraph3 || "";
				const bulletPointsImage3 = campaignBulletPoints[2]?.image3 ? AI_EMAIL_IMAGES_URL + campaignBulletPoints[2].image3 : "";
				const bulletPointsRemoveBulletBannerContainer3 = campaignBulletPoints[2]?.remove_bullet_container_3 || false;

				// Step 4.5: Profile image logic
				if (businessRewardLogo) {
					profileImageUrl = USERS_URL + businessRewardLogo;
				} else if (!businessRewardLogo && businessLogo) {
					profileImageUrl = USERS_URL + businessLogo;
				}
				const imgSrc = profileImageUrl ? `<img src="${profileImageUrl}" style="max-height:100px;" >` : "";

				// Step 4.6: Bullet tables
				let bulletOneTable = `<table cellpadding="0" cellspacing="0" width="100%">
					<tr>
						<td style="height: 220px; vertical-align: middle;" colspan="2" width="50%">
							<table cellpadding="0" cellspacing="0" style="width: 100%; height: 100%;">
								<tbody>
									<tr>
										<td style="height: 220px;">
											<img style="width: 100%; height: 220px;" src="${bulletPointsImage1}">
										</td>
									</tr>
								</tbody>
							</table>
						</td>
						<td colspan="2" width="50%" style="padding: 0px 10px 0px 20px; vertical-align: middle;">
							<table style="width: 100%;">
								<tbody>
									<tr>
										<td style="vertical-align: middle;">
											<strong style="display: block; padding-bottom: 10px; font-size: 16px; color: #333; font-family: Arial, Helvetica, sans-serif;">
												${bulletPointsHeading1}
											</strong>
											<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333;">
												${bulletPointsParagraph1}
											</span>
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</table>`;
				if (bulletPointsRemoveBulletBannerContainer1 || bulletPointsImage1 === "") {
					bulletOneTable = `<table cellpadding="0" cellspacing="0" width="100%">
						<tr>
							<td colspan="2" width="50%" style="padding: 0px 10px 0px 20px; vertical-align: middle;">
								<table style="width: 100%;">
									<tbody>
										<tr>
											<td style="vertical-align: middle;">
												<strong style="display: block; padding-bottom: 10px; font-size: 16px; color: #333; font-family: Arial, Helvetica, sans-serif;">
													${bulletPointsHeading1}
												</strong>
												<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333;">
													${bulletPointsParagraph1}
												</span>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					</table>`;
				}

				let bulletSecondTable = `<table cellpadding="0" cellspacing="0" width="100%">
					<tr>
						<td colspan="2" width="50%" style="padding: 0px 10px 0px 20px; vertical-align: middle;">
							<table style="width: 100%;">
								<tbody>
									<tr>
										<td style="vertical-align: middle;">
											<strong style="display: block; padding-bottom: 10px; font-size: 16px; color: #333; font-family: Arial, Helvetica, sans-serif;">
												${bulletPointsHeading2}
											</strong>
											<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333;">
												${bulletPointsParagraph2}
											</span>
										</td>
									</tr>
								</tbody>
							</table>
						</td>
						<td style="{DISPLAY_NONE_BULLET_2}; height: 220px; vertical-align: middle;" colspan="2" width="50%">
							<table cellpadding="0" cellspacing="0" style="width: 100%; height: 100%;">
								<tbody>
									<tr>
										<td style="height: 220px;">
											<img style="width: 100%; height: 220px;" src="${bulletPointsImage2}">
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</table>`;
				if (bulletPointsRemoveBulletBannerContainer2 || bulletPointsImage2 === "") {
					bulletSecondTable = `<table cellpadding="0" cellspacing="0" width="100%">
						<tr>
							<td colspan="2" width="50%" style="padding: 0px 10px 0px 20px; vertical-align: middle;">
								<table style="width: 100%;">
									<tbody>
										<tr>
											<td style="vertical-align: middle;">
												<strong style="display: block; padding-bottom: 10px; font-size: 16px; color: #333; font-family: Arial, Helvetica, sans-serif;">
													${bulletPointsHeading2}
												</strong>
												<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333;">
													${bulletPointsParagraph2}
												</span>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					</table>`;
				}

				let bulletThreeTable = `<table cellpadding="0" cellspacing="0" width="100%">
					<tr>
						<td style="{DISPLAY_NONE_BULLET_3}; height: 220px; vertical-align: middle;" colspan="2" width="50%">
							<table cellpadding="0" cellspacing="0" style="width: 100%; height: 100%;">
								<tbody>
									<tr>
										<td style="height: 220px;">
											<img style="width: 100%; height: 220px;" src="${bulletPointsImage3}">
										</td>
									</tr>
								</tbody>
							</table>
						</td>
						<td colspan="2" width="50%" style="padding: 0px 10px 0px 20px; vertical-align: middle;">
							<table style="width: 100%;">
								<tbody>
									<tr>
										<td style="vertical-align: middle;">
											<strong style="display: block; padding-bottom: 10px; font-size: 16px; color: #333; font-family: Arial, Helvetica, sans-serif;">
												${bulletPointsHeading3}
											</strong>
											<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333;">
												${bulletPointsParagraph3}
											</span>
										</td>
									</tr>
								</tbody>
							</table>
						</td>
					</tr>
				</table>`;
				if (bulletPointsRemoveBulletBannerContainer3 || bulletPointsImage3 === "") {
					bulletThreeTable = `<table cellpadding="0" cellspacing="0" width="100%">
						<tr>
							<td colspan="2" width="50%" style="padding: 0px 10px 0px 20px; vertical-align: middle;">
								<table style="width: 100%;">
									<tbody>
										<tr>
											<td style="vertical-align: middle;">
												<strong style="display: block; padding-bottom: 10px; font-size: 16px; color: #333; font-family: Arial, Helvetica, sans-serif;">
													${bulletPointsHeading3}
												</strong>
												<span style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333;">
													${bulletPointsParagraph3}
												</span>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
					</table>`;
				}

				// Step 4.7: Poll link button
				let pollLinkButton = '';
				if (campaignCustomUrl) {
					pollLinkButton = `<tr>
						<td colspan="4" align="left" style="padding: 20px 21px 25px;">
							<a class="claim_btn" target="_blank" href="${campaignCustomUrl}" style="padding: 0px 12px; color: #fff; font-weight: 600; background-color: #3188A3; border-radius: 6px; font-size: 16px; border: none; width: 200px; height: 55px; outline: none; cursor: pointer;font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; line-height: 53px; display: block;text-decoration: none;text-align: center;">
								${campaignCtaTextNew} <img src="https://d5cvgp25mt3yl.cloudfront.net/uploads/images/social-arrow-right.png" alt="img" style="max-width:19px;margin: 0 0 0 7px;">
							</a>
						</td>
					</tr>`;
				}

				// Step 4.8: Banner height
				let bannerHeight = 285;
				if (campaignRemoveBulletBannerContainer || campaignBannerImage === '') {
					bannerHeight = 0;
				}

				// Step 4.9: Compose email HTML content
				const sendBodyContent = `<table width="100%" border="0" cellpadding="0" cellspacing="0" class="testing_reward" style=" width:580px; margin:auto;background-color: #fff;">
					<tbody>
						<tr>
							<td style="text-align: center; padding: 33px 0 35px;" colspan="4">
								${imgSrc}
							</td>
						</tr>
						<tr>
							<td height="${bannerHeight}" style="height: ${bannerHeight}px; vertical-align: top;  padding: 12px 5px 10px;background-repeat: no-repeat; background-size: cover; background-position: center;" colspan="4" background="${campaignBannerImage}">
								<table width="100%">
									<tbody>
										<tr>
											<td> </td>
											<td style="text-align: right;"></td>
										</tr>
										<tr>
											<td colspan="3" style="font-size: 23px; color: #000; text-align: center; font-family: Arial, Helvetica, sans-serif; font-weight: 600;padding: 50px 0 10px;text-transform: uppercase;">
												${emailHeading}
											</td>
										</tr>
										<tr>
											<td colspan="3" align="center" style="font-size: 36px; color: #ddd; text-align: center;">
												<a href="${campaignCtaTextLinkUrl}" target="_blank" class="claim_btn" style="padding: 0px 16px; color: #fff; font-weight: 600; background-color: #3188A3; border-radius: 6px; font-size: 16px; border: none; height: 55px; outline: none; cursor: pointer; font-family: Arial, Helvetica, sans-serif; text-transform: uppercase; line-height: 53px; display: inline-block; text-decoration: none; margin: auto;">
													${campaignCtaText}
													<img src="https://d5cvgp25mt3yl.cloudfront.net/uploads/images/social-arrow-right.png" alt="img" style="max-width:19px;margin: 0 0 0 7px;">
												</a>
											</td>
										</tr>
									</tbody>
								</table>
							</td>
						</tr>
						<tr>
							<td style="padding: 30px 21px 20px;">
								<span style="color: #5D5D5D; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">${body}</span>
							</td>
						</tr>
						<tr>
							<td colspan="4" style="padding: 15px 0;">
								${bulletOneTable}
							</td>
						</tr>
						<tr>
							<td colspan="4" style="padding: 15px 0;">
								${bulletSecondTable}
							</td>
						</tr>
						<tr>
							<td colspan="4" style="padding: 15px 0;">
								${bulletThreeTable}
							</td>
						</tr>
						<tr>
							<td style="padding: 20px 21px 20px;">
								<span style="color: #5D5D5D; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
									${campaignEmailClosingParagraph}
								</span>
							</td>
						</tr>
						${pollLinkButton}
						<tr>
							<td style="padding: 5px 21px 25px;">
								<span style="color: #5D5D5D; font-size: 14px; font-family: Arial, Helvetica, sans-serif;">
									${campaignEmailEndingSignature}
								</span>
							</td>
						</tr>
						<tr>
							<td style="padding: 5px 21px 0px;line-height:18px">
								<span style="color: #3DA092; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
									© copyright ${nameOfTheBusiness} ${primaryAddress} All Rights Reserved, ${currentYear}.
								</span>
							</td>
						</tr>
						<tr>
							<td style="padding: 6px 21px 25px;line-height:18px">
								<span style="color: #3DA092; font-size: 13px; font-family: Arial, Helvetica, sans-serif;">
									You are receiving this email because you opted in. No longer wish to receive these emails? You can <a href="${WEBSITE_UNSUBSCRIBED_EMAIL_LINK + '' + UNSUBSCRIBED_TYPE_FOR_INSIDER_POll_WELCOME_EMAIL + "/" + unsubscriberValidateGenerateString}" style="text-decoration: none; color: #3188a3" target="_blank">Unsubscribe</a> here. 
								</span>
							</td>
						</tr>
					</tbody>
				</table>`;

				// Step 4.10: Save unsubscribe validate string to user record
				const optionsData = {
					'insider_poll_welcome_email_unsubscribe_validate_string': unsubscriberValidateGenerateString
				};
				await updateUserRecordsIdAccording(sentToEmailUserId, optionsData);

				// Step 4.11: Assign earn rewards if only reward exists (no poll)
				if (!generatedInsiderPollId && generatedInsiderRewardId) {
					const addEarnRewardsOptions = {
						'complete_attach_reward_id': generatedInsiderRewardId,
						'reward_send_user_id': sentToEmailUserId,
						'result_users': sentToEmailUserDetails,
						'email_template_id': "",
						'email_template_action': "",
						'template_type': EMAIL_TEMPLATE_POLL_INSIDERS_TYPE,
					};
					req.body.email = userEmail;
					await addEarnRewards(req, res, addEarnRewardsOptions);
				}

				// Step 4.12: Send email if not unsubscribed and email exists
				if (!insiderPollWelcomeEmailUnsubscribed && userEmail) {
					const emailOptions = {
						'to': userEmail,
						'subject': subject,
						'body': sendBodyContent
					};
					sendMailDragDrop(req, res, emailOptions);
				}
			}

			// Step 5: After all processed, mark as sent and respond
			await insiderSendEmailPollUser.updateMany(
				{ '_id': { $in: logsResultDataIdsArray } },
				{ $set: { 'is_sent': IS_INSIDERS_POLL_USER_VOTTED_SENT_STATUS, 'is_sent_date': getUtcDate() } }
			);

			return res.end("Processing............");
		} catch (err) {
			console.error("Error in insiderPollEmailSentToUser:", err);
			return res.end("An error occurred while processing insider poll emails.");
		}
	}; // End insiderPollEmailSentToUser

	/**
	 * Async function to send social reachout emails to users daily, day-wise.
	 * Uses async/await for all DB operations and handles parallel email sending with Promise.all.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.SocialReachoutEmailSentToUserDailyDayWise = async (req, res, next) => {
		// Set user collection
		const userCollection = db.collection(TABLE_USERS);

		// Build query condition for eligible users
		const condition = {
			"public_business_informaton.campaign_detail_tab_filled": true,
			"public_business_informaton.campaign_overview_tab_filled": true,
			"public_business_informaton.core_information_tab_filled": true,
			"account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
			"is_deleted": NOT_DELETED,
			"social_reachout_send_mail_master_admin_flag": SOCIAL_REACHOUT_TOOGLE_ON,
			"email": { $ne: "" },
			"social_unsubscribed": { $exists: false },
		};

		try {
			// Step 1: Find all users matching the condition
			const userDetailResult = await userCollection.find(condition).toArray();

			if (userDetailResult.length === 0) {
				return res.end("Record not founds. Already email sent to all users.");
			}

			// Step 2: Process all users in parallel using Promise.all
			const emailPromises = userDetailResult.map(async (itemRecords) => {
				try {
					const publicBusinessInformation = itemRecords.public_business_informaton || {};
					const targetAudienceData = publicBusinessInformation.target_audience || "";
					let aiIndustryNames = publicBusinessInformation.ai_business_industry_names || [];
					const userId = itemRecords._id || "";
					const userEmail = itemRecords.email || "";
					const ZipCode = itemRecords.zip || "";
					const websiteUrl = publicBusinessInformation.website_url || "";
					const webAddress = (websiteUrl === "") ? emailToDomainUrl(userEmail) : websiteUrl;

					// Format industry names for email
					if (aiIndustryNames.length > 1) {
						const lastConcat = aiIndustryNames.slice(-2).join(' and ');
						aiIndustryNames.splice(-2, 2, lastConcat);
					}
					const aiBusinessIndustry = aiIndustryNames.join(', ');
					const createdDate = itemRecords.created || "";

					// Step 2.1: Get plan details for the user
					const planPurchesData = await planAccourdingLimitAccessMiddleware(req, res, itemRecords, ACTIVITY_CAMPAIGN_REACHOUT_TYPE);

					// Step 2.2: Handle plan-specific logic
					const userCreatedDays = checkWithinGivenDays(createdDate, FREE_PLAN_DAY);

					// TRIAL PLAN: Send daily for first N days
					if (
						planPurchesData.plan_type_name === PLAN_FOR_TRIAL &&
						planPurchesData.status === ALLOW_CREATE_DATA &&
						userCreatedDays === true
					) {
						// Determine which day function to use
						const startDate = new Date(createdDate);
						const currentDate = new Date();
						const dayDifference = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24)) % 7;

						let dayFunction;
						switch (dayDifference) {
							case 0: dayFunction = socialReachoutDayOne; break;
							case 1: dayFunction = socialReachoutDayTwo; break;
							case 2: dayFunction = socialReachoutDayThree; break;
							case 3: dayFunction = socialReachoutDayFour; break;
							case 4: dayFunction = socialReachoutDayFive; break;
							case 5: dayFunction = socialReachoutDaySix; break;
							case 6: dayFunction = socialReachoutDaySeven; break;
							default: throw new Error('Invalid day');
						}

						// Prepare options for AI prompt
						const options = {
							"business_industry": aiBusinessIndustry,
							"target_audience": targetAudienceData,
							"web_address": webAddress,
							"zip_code": ZipCode,
							"user_id": userId
						};

						// Get AI response for the day
						const aiResponseData = await dayFunction(req, res, options);

						const optionData = {
							"login_data": itemRecords,
							"ai_response": aiResponseData
						};

						// Send the email for the day
						await userDailydayWiseEmailSend(req, res, optionData);

						// FREE PLAN: (No action, but placeholder for future logic)
					} else if (
						planPurchesData.plan_type_name === PLAN_FOR_FREE &&
						planPurchesData.status === ALLOW_CREATE_DATA
					) {
						// No email sent for free plan (currently no logic)
						return;

						// 199 PREMIUM PLAN: Send every other day, up to 7 emails
					} else if (
						planPurchesData.plan_type_name === PLAN_FOR_199_PREMIUM &&
						planPurchesData.status === ALLOW_CREATE_DATA
					) {
						const startDate = new Date(createdDate);
						const currentDate = new Date();
						let totalDays = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24));
						totalDays -= 1; // Start from next day

						// Only send on even days (every other day)
						if (totalDays % 2 !== 0) {
							return;
						}

						// Determine which day function to use (cycling through 7)
						const sequenceIndex = Math.floor(totalDays / 2) % 7;
						let dayFunction;
						switch (sequenceIndex) {
							case 0: dayFunction = socialReachoutDayOne; break;
							case 1: dayFunction = socialReachoutDayTwo; break;
							case 2: dayFunction = socialReachoutDayThree; break;
							case 3: dayFunction = socialReachoutDayFour; break;
							case 4: dayFunction = socialReachoutDayFive; break;
							case 5: dayFunction = socialReachoutDaySix; break;
							case 6: dayFunction = socialReachoutDaySeven; break;
							default: throw new Error('Invalid day');
						}

						const options = {
							"business_industry": aiBusinessIndustry,
							"target_audience": targetAudienceData,
							"web_address": webAddress,
							"zip_code": ZipCode,
							"user_id": userId
						};

						const aiResponseData = await dayFunction(req, res, options);

						const optionData = {
							"login_data": itemRecords,
							"ai_response": aiResponseData
						};

						await userDailydayWiseEmailSend(req, res, optionData);

						// 249 PREMIUM PLUS PLAN: Send daily, cycling through 7 days
					} else if (
						planPurchesData.plan_type_name === PLAN_FOR_249_PREMIUM_PLUS &&
						planPurchesData.status === ALLOW_CREATE_DATA
					) {
						const startDate = new Date(createdDate);
						const currentDate = new Date();
						const dayDifference = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24)) % 7;

						let dayFunction;
						switch (dayDifference) {
							case 0: dayFunction = socialReachoutDayOne; break;
							case 1: dayFunction = socialReachoutDayTwo; break;
							case 2: dayFunction = socialReachoutDayThree; break;
							case 3: dayFunction = socialReachoutDayFour; break;
							case 4: dayFunction = socialReachoutDayFive; break;
							case 5: dayFunction = socialReachoutDaySix; break;
							case 6: dayFunction = socialReachoutDaySeven; break;
							default: throw new Error('Invalid day');
						}

						const options = {
							"business_industry": aiBusinessIndustry,
							"target_audience": targetAudienceData,
							"web_address": webAddress,
							"zip_code": ZipCode,
							"user_id": userId
						};

						const aiResponseData = await dayFunction(req, res, options);

						const optionData = {
							"login_data": itemRecords,
							"ai_response": aiResponseData
						};

						await userDailydayWiseEmailSend(req, res, optionData);
					}
				} catch (aiError) {
					// Log error for this user, but continue processing others
					console.error(`AI Response Error for user ${itemRecords.email}: ${aiError.message}`);
				}
			});

			// Step 3: Wait for all emails to be processed in parallel
			await Promise.all(emailPromises);

			// Step 4: Send success response
			return res.end("Processing............");
		} catch (error) {
			console.error("Error in SocialReachoutEmailSentToUserDailyDayWise:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End SocialReachoutEmailSentToUserDailyDayWise

	/**
	 * Function to send daily day-wise email to user.
	 * Handles different day templates and updates user record accordingly.
	 * All DB queries use async/await and are properly commented.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} optionData
	 * @returns {Promise<number>} Resolves to 0 on completion
	 */
	userDailydayWiseEmailSend = async (req, res, optionData) => {
		const userCollection = db.collection(TABLE_USERS);

		const loginUserData = optionData.login_data || {};
		const userId = loginUserData._id || "";
		const userName = loginUserData.full_name || "";
		const userEmail = loginUserData.email || "";

		const aiResponseData = optionData.ai_response || {};

		if (aiResponseData.status !== STATUS_SUCCESS) {
			return 0;
		}

		const socialReachoutDay = aiResponseData.reachout_day || "";
		const aiResponse = aiResponseData.response || "";
		const validateGenerateString = newsletterSubscriberEncId(userEmail);
		const campaignUrl = FRONT_URL + "pocial/pocial-ai";
		const unsubscribeSocialUrl = WEBSITE_UNSUBSCRIBED_EMAIL_LINK + '' + UNSUBSCRIBED_TYPE_FOR_SOCIAL_REACHOUT + "/" + validateGenerateString;

		// Helper to update user flag after sending email
		const updateUserFlag = async () => {
			await userCollection.updateOne(
				{ "_id": newObjectIdDefault(userId) },
				{ $set: { "social_unsubscribe_validate_string": validateGenerateString } }
			);
		};

		// Day 1: Send businesses list
		if (socialReachoutDay === REACHOUT_DAY1) {
			const firstPosts = (aiResponse && aiResponse.businesses) ? aiResponse.businesses : [];
			let postNewData = `<ol style="padding: 0; margin: 0px;">`;
			firstPosts.forEach((records, index) => {
				const accountName = records.instagram_account || "";
				const accountNameForUrl = accountName ? accountName.replace(/@/g, "") : "";
				const accountUrl = records.instagram_url || `https://www.instagram.com/${accountNameForUrl}`;
				const websiteUrl = records.website_url || "javascript:void(0)";
				postNewData += `<li style="padding: 15px 0px;${index !== firstPosts.length - 1 ? ' border-bottom: 1px solid #C7C7C7;' : ''}">`;
				postNewData += `<span style="font-size: 20px; text-transform: capitalize;"><a href="${websiteUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${records.name}</a></span><br>`;
				postNewData += `<span style="font-size: 15px; color: #5D5D5D; padding-top: 3px; display: block;"><a href="${accountUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${records.instagram_account}</a></span>`;
				postNewData += `<p style="margin: 0px; padding: 13px 0px 0px;">"${records.comment}"</p>`;
				postNewData += `</li>`;
			});
			postNewData += `</ol>`;

			if (userEmail && postNewData) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_one_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, postNewData, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}
		// Day 2: Send local and national accounts
		else if (socialReachoutDay === REACHOUT_DAY2) {
			const secondPosts = (aiResponse && aiResponse.accounts) ? aiResponse.accounts : {};
			const fiveLocalAccount = secondPosts.local_accounts || [];
			const fiveNationalAccount = secondPosts.national_accounts || [];

			let localAccountData = "";
			let nationalAccountData = "";

			fiveLocalAccount.forEach((record) => {
				const postAccount = record.instagram_account || "";
				const postDataurl = postAccount ? postAccount.replace(/@/g, "") : "";
				const postUrl = record.instagram_url || `https://www.instagram.com/${postDataurl}`;
				localAccountData += `<tr>
					<td colspan="" style="padding:10px 20px 10px">
						<div style ="background-color:#ffff;border-radius: 27px; position: relative;">
						<div style ="padding: 30px; text-align:center; font-family:Arial,Helvetica,sans-serif;">
							<span style ="font-size: 19px; color: #333;"><a href="${postUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${record.instagram_account}</a></span><br>
							<span style ="font-size: 15px; color: #5D5D5D;padding-top: 5px; display: block;">${postUrl}</span>
						</div>
						</div>
					</td>
				</tr>`;
			});

			fiveNationalAccount.forEach((record) => {
				const postAccount = record.instagram_account || "";
				const postDataurl = postAccount ? postAccount.replace(/@/g, "") : "";
				const postUrl = record.instagram_url || `https://www.instagram.com/${postDataurl}`;
				nationalAccountData += `<tr>
					<td colspan="" style="padding:10px 20px 10px">
						<div style ="background-color:#ffff;border-radius: 27px; position: relative;">
						<div style ="padding: 30px; text-align:center; font-family:Arial,Helvetica,sans-serif;">
							<span style ="font-size: 19px; color: #333;"><a href="${postUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${record.instagram_account}</a></span><br>
							<span style ="font-size: 15px; color: #5D5D5D;padding-top: 5px; display: block;">${postUrl}</span>
						</div>
						</div>
					</td>
				</tr>`;
			});

			if (userEmail && localAccountData && nationalAccountData) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_two_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, localAccountData, nationalAccountData, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}
		// Day 3: Send caption and song suggestion
		else if (socialReachoutDay === REACHOUT_DAY3) {
			const caption = (aiResponse && aiResponse.caption) ? aiResponse.caption : "";
			const releventSong = (aiResponse && aiResponse.relevant_song) ? aiResponse.relevant_song : "";
			const songChoice = (aiResponse && aiResponse.song_choice_description) ? aiResponse.song_choice_description : "";

			if (userEmail && caption) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_third_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, caption, releventSong, songChoice, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}
		// Day 4: Send account suggestions
		else if (socialReachoutDay === REACHOUT_DAY4) {
			const accountSuggestions = (aiResponse && aiResponse.account_suggestions) ? aiResponse.account_suggestions : [];
			let suggestionData = "";

			accountSuggestions.forEach((record) => {
				const instagramAccount = record.instagram_account || "";
				const instaDataurl = instagramAccount ? instagramAccount.replace(/@/g, "") : "";
				const instagramUrl = record.instagram_url || `https://www.instagram.com/${instaDataurl}`;
				suggestionData += `<tr>
					<td colspan="" style="padding:10px 20px 10px">
						<div style ="background-color:#ffff;border-radius: 27px; position: relative;">
						<div style ="padding: 30px; text-align:center; font-family:Arial,Helvetica,sans-serif;">
							<span style ="font-size: 19px; color: #333;"><a href="${instagramUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${record.instagram_account}</a></span><br>
							<span style ="font-size: 15px; color: #5D5D5D;padding-top: 5px; display: block;">${instagramUrl}</span>
						</div>
						</div>
					</td>
				</tr>`;
			});

			if (userEmail && suggestionData) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_fourth_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, suggestionData, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}
		// Day 5: Send another businesses list
		else if (socialReachoutDay === REACHOUT_DAY5) {
			const fifthPosts = (aiResponse && aiResponse.businesses) ? aiResponse.businesses : [];
			let postData = `<ol style="padding: 0; margin: 0px;">`;
			fifthPosts.forEach((records, index) => {
				const accountName = records.instagram_account || "";
				const accountNameForUrl = accountName ? accountName.replace(/@/g, "") : "";
				const accountUrl = records.instagram_url || `https://www.instagram.com/${accountNameForUrl}`;
				const websiteUrl = records.website_url || "javascript:void(0)";
				postData += `<li style="padding: 15px 0px;${index !== fifthPosts.length - 1 ? ' border-bottom: 1px solid #C7C7C7;' : ''}">`;
				postData += `<span style="font-size: 20px; text-transform: capitalize;"><a href="${websiteUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${records.name}</a></span><br>`;
				postData += `<span style="font-size: 15px; color: #5D5D5D; padding-top: 3px; display: block;"><a href="${accountUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${records.instagram_account}</a></span>`;
				postData += `<p style="margin: 0px; padding: 13px 0px 0px;">"${records.comment}"</p>`;
				postData += `</li>`;
			});
			postData += `</ol>`;

			if (userEmail && postData) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_five_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, postData, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}
		// Day 6: Send hashtag suggestions
		else if (socialReachoutDay === REACHOUT_DAY6) {
			const hastagSuggestion = (aiResponse && aiResponse.hashtags_suggestions) ? aiResponse.hashtags_suggestions : {};
			const fiveGeneralHastag = hastagSuggestion.general_hashtags_5 || [];
			const fiveLocalHastag = hastagSuggestion.local_hashtags_5 || [];

			let generalHastags = "";
			let localHastags = "";

			if (fiveGeneralHastag.length > 0) {
				generalHastags += `<ul style="list-style-type: none;padding: 0;margin: 0;">`;
				fiveGeneralHastag.forEach((records, index) => {
					const generalHastagData = records.general_hashtags || "";
					let generalHastagForUrl = generalHastagData ? generalHastagData.replace("#", "") : "";
					generalHastagForUrl = generalHastagForUrl ? generalHastagForUrl.charAt(0).toLowerCase() + generalHastagForUrl.slice(1) : "";
					const generalHastagUrl = records.hashtags_account_url || `https://www.instagram.com/explore/tags/${generalHastagForUrl}`;
					generalHastags += `<li style="padding: 17px 0px;${index !== fiveGeneralHastag.length - 1 ? ' border-bottom: 1px solid #C7C7C7;' : ''}">`;
					generalHastags += `<span style="font-size: 17px;color: #333;"><a href="${generalHastagUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${records.general_hashtags}</a></span>`;
					generalHastags += `</li>`;
				});
				generalHastags += `</ul>`;
			}

			if (fiveLocalHastag.length > 0) {
				localHastags += `<ul style="list-style-type: none; margin: 0px; padding: 0px;">`;
				fiveLocalHastag.forEach((records, index) => {
					const localHastagData = records.local_hashtags || "";
					let localHastagDataUrl = localHastagData ? localHastagData.replace("#", "") : "";
					localHastagDataUrl = localHastagDataUrl ? localHastagDataUrl.charAt(0).toLowerCase() + localHastagDataUrl.slice(1) : "";
					const localHastagUrl = records.hashtags_account_url || `https://www.instagram.com/explore/tags/${localHastagDataUrl}`;
					localHastags += `<li style="padding: 17px 0px;${index !== fiveLocalHastag.length - 1 ? ' border-bottom: 1px solid #C7C7C7;' : ''}">`;
					localHastags += `<span style="font-size: 15px;"><a href="${localHastagUrl}" target="_blank" style="color:#3188A3; text-decoration: none;">${records.local_hashtags}</a></span>`;
					localHastags += `</li>`;
				});
				localHastags += `</ul>`;
			}

			if (userEmail && generalHastags && localHastags) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_six_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, generalHastags, localHastags, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}
		// Day 7: Send final message
		else if (socialReachoutDay === REACHOUT_DAY7) {
			const message = (aiResponse && aiResponse.message) ? aiResponse.message : "";

			if (userEmail && message) {
				const emailOptions = {
					to: userEmail,
					action: "social_reachout_day_seven_email_sent_to_user",
					rep_array: [DEAR_HI_CONSTANT, userName, message, campaignUrl, unsubscribeSocialUrl]
				};
				await sendMail(req, res, emailOptions);
				await updateUserFlag();
			}
		}

		return 0;
	};

	/**
	 * Async function to send post caption in email to users after seven days.
	 * Uses async/await for all DB queries and handles parallel email sending with Promise.all.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.postCaptionInEmailSentToUserAfterSevenDays = async (req, res, next) => {
		// Set user collection
		const userCollection = db.collection(TABLE_USERS);

		// Build query condition for eligible users
		const condition = {
			"public_business_informaton.campaign_detail_tab_filled": true,
			"public_business_informaton.campaign_overview_tab_filled": true,
			"public_business_informaton.core_information_tab_filled": true,
			"is_deleted": NOT_DELETED,
			$or: [
				{ "sent_mail_after_seven_days_date": { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
				{ "sent_mail_after_seven_days_date": { $exists: false }, "created": { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
			],
			"email": { $ne: "" },
			"social_unsubscribed": { $exists: false }
		};

		try {
			// Step 1: Find all users matching the condition
			const userDetailResult = await userCollection.find(condition).toArray();

			if (userDetailResult.length === 0) {
				return res.end("Record not founds. Already email sent to all users.");
			}

			// Step 2: Process all users in parallel using Promise.all
			const emailPromises = userDetailResult.map(async (itemRecords) => {
				const userId = itemRecords._id || "";
				const userName = itemRecords.full_name || "";
				const userEmail = itemRecords.email || "";

				const publicBusinessInformation = itemRecords.public_business_informaton || {};
				const businessName = publicBusinessInformation.name_of_the_business || "";
				const targetAudienceData = publicBusinessInformation.target_audience || "";
				const uniqueSellingData = publicBusinessInformation.unique_selling_proposition || "";
				let aiIndustryNames = publicBusinessInformation.ai_business_industry_names || [];
				const offeringDiscount = publicBusinessInformation.preferred_offering_or_discount || "";
				const SpecificProduct = publicBusinessInformation.specific_product_or_service || "";
				const benefitsProductService = publicBusinessInformation.benefits_product_or_service || "";

				// Format industry names for email
				if (aiIndustryNames.length > 1) {
					const lastConcat = aiIndustryNames.slice(-2).join(' and ');
					aiIndustryNames.splice(-2, 2, lastConcat);
				}
				const aiBusinessIndustry = aiIndustryNames.join(', ');

				const userPrompt = SOCIAL_REACH_OUT_USER_PROMPT;
				const userFinalPrompt = SOCIAL_REACH_OUT_USER_PROMPT
					.replace(/{business_name}/g, businessName)
					.replace(/{industry}/g, aiBusinessIndustry)
					.replace(/{target_audiance}/g, targetAudienceData)
					.replace(/{unique_sell}/g, uniqueSellingData)
					.replace(/{specific_product}/g, SpecificProduct)
					.replace(/{benefit_product}/g, benefitsProductService);

				const userReplaceData = `{business_name}: ${businessName}; {industry}: ${aiBusinessIndustry}; {target_audiance}:${targetAudienceData}; {unique_sell}:${uniqueSellingData}; {specific_product}: ${SpecificProduct}; {benefit_product}:${benefitsProductService}`;

				const userContentData = SOCIAL_REACH_OUT_USER_PROMPT
					.replace(/{business_name}/g, businessName)
					.replace(/{industry}/g, aiBusinessIndustry)
					.replace(/{target_audiance}/g, targetAudienceData)
					.replace(/{unique_sell}/g, uniqueSellingData)
					.replace(/{specific_product}/g, SpecificProduct)
					.replace(/{benefit_product}/g, benefitsProductService) + " " + SOCIAL_REACHOUT_FORMAT;

				const prompt = {
					"system_prompt": { "role": "system", "content": "" },
					"user_prompt": { "role": AI_ROLE_USER, "content": userContentData },
					"prompt": userFinalPrompt,
					"reachout_day": REACHOUT_AFTER_DAY
				};

				try {
					// Step 2.1: Get social caption from OpenAI
					const aiResponseData = await getOpenAiSocialPostForEmail(req, res, prompt);

					if (aiResponseData.status === STATUS_SUCCESS) {
						const aiResponse = aiResponseData.response || {};

						const optionsData = {
							'user_id': userId,
							'type': SOCIAL_REACHOUT,
							'user_prompt': userPrompt,
							'user_replace_data': userReplaceData,
							'user_final_prompt': userFinalPrompt,
							'final_output': aiResponse,
						};

						// Step 2.2: Save campaign logs
						await saveAllCampaignLogs(optionsData);

						const socialCaption = aiResponse.social_media_caption || "";
						const topicChoiceDescription = aiResponse.topic_choice_description || "";
						const trendingSong = aiResponse.trending_song || "";
						const songChoiceDescription = aiResponse.song_choice_description || "";
						const finalEmailBody = `${socialCaption} </br> ${trendingSong}`;
						const displayData = "block";

						// Step 2.3: Generate validate string and URLs
						const validateGenerateString = newsletterSubscriberEncId(userEmail);
						const campaignUrl = FRONT_URL + "pocial/pocial-ai";
						const unsubscribeSocialUrl = WEBSITE_SOCIAL_UNSUBSCRIBED_EMAIL_LINK + validateGenerateString;

						if (userEmail !== '') {
							// Step 2.4: Send social reachout mail
							const emailOptions = {
								to: userEmail,
								action: "post_caption_in_email_sent_to_user",
								rep_array: [
									DEAR_HI_CONSTANT,
									userName,
									finalEmailBody,
									topicChoiceDescription,
									songChoiceDescription,
									campaignUrl,
									unsubscribeSocialUrl,
									displayData
								]
							};
							await sendMail(req, res, emailOptions);

							// Step 2.5: Update user flags after sending email
							await userCollection.updateOne(
								{ "_id": newObjectIdDefault(userId) },
								{
									$set: {
										"is_sent_social_post_after_seven_days": true,
										"social_unsubscribe_validate_string": validateGenerateString,
										"sent_mail_after_seven_days_date": getUtcDate()
									}
								}
							);
						}
					}
				} catch (aiError) {
					// Optionally log error, but continue with next user
					console.error(`AI Response Error: ${aiError.message}`);
				}
			});

			// Wait for all emails to be processed in parallel
			await Promise.all(emailPromises);

			return res.end("Processing............");
		} catch (error) {
			console.error("Error in postCaptionInEmailSentToUserAfterSevenDays:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End postCaptionInEmailSentToUserAfterSevenDays

	/**
	 * Async function to send post caption in email to users after 24 hours of campaign creation.
	 * Uses async/await for all DB operations and handles parallel email sending with Promise.all.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.postCaptionInEmailSentToUserAfterTwentyFourHours = async (req, res, next) => {
		// Set user collection
		const userCollection = db.collection(TABLE_USERS);

		// Build query condition for eligible users
		const condition = {
			"public_business_informaton.campaign_detail_tab_filled": true,
			"public_business_informaton.campaign_overview_tab_filled": true,
			"public_business_informaton.core_information_tab_filled": true,
			"is_deleted": NOT_DELETED,
			"email": { $ne: "" },
			"is_sent_social_post": { $exists: false },
			"social_unsubscribed": { $exists: false },
		};

		try {
			// Step 1: Find all users matching the condition
			const userDetailResult = await userCollection.find(condition).toArray();

			if (userDetailResult.length === 0) {
				return res.end("Record not founds. Already email sent to all users.");
			}

			// Step 2: Process all users in parallel using Promise.all
			const emailPromises = userDetailResult.map(async (itemRecords) => {
				try {
					const userId = itemRecords._id || "";
					const userName = itemRecords.full_name || "";
					const userEmail = itemRecords.email || "";
					const createdDate = itemRecords.created || "";
					const alreadySentSocialEmail = itemRecords.is_sent_social_post || "";

					// Calculate the date 24 hours after the user's campaign creation
					const dateAfter24Hours = getDateAfter24Hours(createdDate);
					const todayDate = new Date();

					// Only proceed if 24 hours have passed and email not already sent
					if (todayDate >= dateAfter24Hours && !alreadySentSocialEmail) {
						const publicBusinessInformation = itemRecords.public_business_informaton || {};
						const businessName = publicBusinessInformation.name_of_the_business || "";
						const targetAudienceData = publicBusinessInformation.target_audience || "";
						const uniqueSellingData = publicBusinessInformation.unique_selling_proposition || "";
						let aiIndustryNames = publicBusinessInformation.ai_business_industry_names || [];
						const offeringDiscount = publicBusinessInformation.preferred_offering_or_discount || "";
						const SpecificProduct = publicBusinessInformation.specific_product_or_service || "";
						const benefitsProductService = publicBusinessInformation.benefits_product_or_service || "";

						// Format industry names for email
						if (aiIndustryNames.length > 1) {
							const lastConcat = aiIndustryNames.slice(-2).join(' and ');
							aiIndustryNames.splice(-2, 2, lastConcat);
						}
						const aiBusinessIndustry = aiIndustryNames.join(', ');

						const userPrompt = SOCIAL_REACH_OUT_USER_PROMPT;
						const userFinalPrompt = SOCIAL_REACH_OUT_USER_PROMPT
							.replace(/{business_name}/g, businessName)
							.replace(/{industry}/g, aiBusinessIndustry)
							.replace(/{target_audiance}/g, targetAudienceData)
							.replace(/{unique_sell}/g, uniqueSellingData)
							.replace(/{specific_product}/g, SpecificProduct)
							.replace(/{benefit_product}/g, benefitsProductService);

						const userReplaceData = `{business_name}: ${businessName}; {industry}: ${aiBusinessIndustry}; {target_audiance}:${targetAudienceData}; {unique_sell}:${uniqueSellingData}; {specific_product}: ${SpecificProduct}; {benefit_product}:${benefitsProductService}`;
						const userContentData = SOCIAL_REACH_OUT_USER_PROMPT
							.replace(/{business_name}/g, businessName)
							.replace(/{industry}/g, aiBusinessIndustry)
							.replace(/{target_audiance}/g, targetAudienceData)
							.replace(/{unique_sell}/g, uniqueSellingData)
							.replace(/{specific_product}/g, SpecificProduct)
							.replace(/{benefit_product}/g, benefitsProductService) + " " + SOCIAL_REACHOUT_FORMAT;

						const prompt = {
							"system_prompt": { "role": "system", "content": "" },
							"user_prompt": { "role": AI_ROLE_USER, "content": userContentData },
							"prompt": userFinalPrompt,
							"reachout_day": REACHOUT_AFTER_DAY
						};

						// Step 2.1: Get social caption from OpenAI
						const aiResponseData = await getOpenAiSocialPostForEmail(req, res, prompt);

						if (aiResponseData.status === STATUS_SUCCESS) {
							const aiResponse = aiResponseData.response || {};

							const optionsData = {
								'user_id': userId,
								'type': SOCIAL_REACHOUT,
								'user_prompt': userPrompt,
								'user_replace_data': userReplaceData,
								'user_final_prompt': userFinalPrompt,
								'final_output': aiResponse,
							};
							// Step 2.2: Save campaign logs
							await saveAllCampaignLogs(optionsData);

							const socialCaption = aiResponse.social_media_caption || "";
							const topicChoiceDescription = aiResponse.topic_choice_description || "";
							const trendingSong = aiResponse.trending_song || "";
							const songChoiceDescription = aiResponse.song_choice_description || "";
							const displayData = "block";
							const finalEmailBody = `${socialCaption} </br> ${trendingSong}`;

							// Generate validate string for unsubscribe link
							const validateGenerateString = newsletterSubscriberEncId(userEmail);
							const campaignUrl = FRONT_URL + "pocial/pocial-ai";
							const unsubscribeSocialUrl = WEBSITE_SOCIAL_UNSUBSCRIBED_EMAIL_LINK + validateGenerateString;

							if (userEmail !== '') {
								// Step 2.3: Send social reachout mail
								const emailOptions = {
									to: userEmail,
									action: "post_caption_in_email_sent_to_user",
									rep_array: [
										DEAR_HI_CONSTANT,
										userName,
										finalEmailBody,
										topicChoiceDescription,
										songChoiceDescription,
										campaignUrl,
										unsubscribeSocialUrl,
										displayData
									]
								};
								await sendMail(req, res, emailOptions);

								// Step 2.4: Update user flags after sending email
								await userCollection.updateOne(
									{ "_id": newObjectIdDefault(userId) },
									{
										$set: {
											"social_unsubscribe_validate_string": validateGenerateString,
											"is_sent_social_post": true
										}
									}
								);
							}
						}
					}
				} catch (aiError) {
					// Log error for this user, but continue processing others
					console.error(`AI Response Error for user ${itemRecords.email}: ${aiError.message}`);
				}
			});

			// Step 3: Wait for all emails to be processed in parallel
			await Promise.all(emailPromises);

			// Step 4: Send success response
			return res.end("Processing............");
		} catch (error) {
			console.error("Error in postCaptionInEmailSentToUserAfterTwentyFourHours:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End postCaptionInEmailSentToUserAfterTwentyFourHours

	/**
	 * Async function to remove AI generated email template PDFs from local and S3 storage.
	 * Uses async/await for all file and S3 operations, and handles parallel deletions.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next
	 * @return render/json
	 */
	this.removeAiGeneratedEmailTemplatePdf = async (req, res, next) => {
		const folderPath = AI_EMAIL_GENERATE_PDF_FILE_PATH;

		try {
			// If uploading to S3, handle S3 and local deletions
			if (UPLOAD_TO_S3) {
				const params = {
					Bucket: process.env.AWS_BUCKET_NAME,
					Prefix: S3_BUCKET_UPLOAD_PATH + "ai_email_generate_pdf/"
				};

				// Step 1: List all objects in the S3 bucket folder
				const data = await s3Crone.listObjectsV2(params).promise();

				const deleteParams = {
					Bucket: process.env.AWS_BUCKET_NAME,
					Delete: { Objects: [] }
				};

				if (data.Contents && data.Contents.length > 0) {
					// Step 2: Prepare list of objects to delete
					data.Contents.forEach(content => {
						deleteParams.Delete.Objects.push({ Key: content.Key });
					});

					// Step 3: Remove all subfolders in local directory in parallel
					const subFolders = fs.readdirSync(folderPath, { withFileTypes: true })
						.filter(dirent => dirent.isDirectory())
						.map(dirent => dirent.name);

					await Promise.all(
						subFolders.map(async (subFolder) => {
							const subFolderPath = path.join(folderPath, subFolder);
							// Remove subfolder recursively
							await fs.promises.rm(subFolderPath, { recursive: true, force: true });
						})
					);

					// Step 4: Delete all objects from S3 bucket
					await s3Crone.deleteObjects(deleteParams).promise();

					// Step 5: Send success response
					return res.end("Deleted objects successfully");
				} else {
					// No objects to delete in S3
					return res.end("No objects to delete.");
				}
			} else {
				// Not using S3, only remove local folders

				// Step 1: Read all subfolders in the local directory
				const subFolders = fs.readdirSync(folderPath, { withFileTypes: true })
					.filter(dirent => dirent.isDirectory())
					.map(dirent => dirent.name);

				// Step 2: Remove all subfolders in parallel
				await Promise.all(
					subFolders.map(async (subFolder) => {
						const subFolderPath = path.join(folderPath, subFolder);
						await fs.promises.rm(subFolderPath, { recursive: true, force: true });
					})
				);

				// Step 3: Send success response
				return res.end("Deleted objects successfully");
			}
		} catch (err) {
			console.error("Error in removeAiGeneratedEmailTemplatePdf:", err);
			return res.status(500).end("An error occurred while deleting AI generated email template PDFs.");
		}
	}; // End removeAiGeneratedEmailTemplatePdf

	/**
	 * Function to crawl remaining links of website.
	 * All DB queries use async/await and are properly commented.
	 * Parallel operations are handled with Promise.all.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.crawlRemainingLinksOfWebsite = async (req, res, next) => {
		try {
			const web_links = db.collection(TABLE_WEB_LINKS);

			// Build query to find web links that need crawling
			const query = {
				'user_id': { $ne: "" },
				'is_crawl': CRAWLED,
				$or: [
					{ 'all_link_fatch_complete': { $exists: false } },
					{ 'all_link_fatch_complete': DEACTIVE }
				],
				$and: [
					{
						$or: [
							{ 'fatch_started': { $exists: false } },
							{ 'fatch_started': DEACTIVE }
						]
					}
				],
				'child_links': { $exists: true, $ne: null, $not: { $size: 0 } }
			};

			// Step 1: Find up to 100 web link records that match the query
			const webLinkResult = await web_links.find(query).limit(100).toArray();

			if (!webLinkResult || webLinkResult.length === 0) {
				return res.end("No Record matched");
			}

			// Step 2: For each record, update status and prepare for crawling
			const fatchLinkArray = [];
			await Promise.all(
				webLinkResult.map(async (record) => {
					const linkId = newObjectIdDefault(record._id);
					const link = record.link;
					const childLinks = record.child_links || [];
					const obj = { id: linkId, link, child_link: childLinks };

					// Update web link data keys to mark as started (async/await)
					await web_links.updateOne(
						{ _id: linkId },
						{ $set: { all_link_fatch_complete: DEACTIVE, fatch_started: ACTIVE } }
					);

					fatchLinkArray.push(obj);
				})
			);

			// Step 3: For each link, fetch and crawl new links in parallel
			await Promise.all(
				fatchLinkArray.map(async (item) => {
					const id = newObjectIdDefault(item.id);
					const link = item.link;
					const crawledLink = item.child_link;
					const options = { url: link };

					if (Array.isArray(crawledLink) && crawledLink.length > 0) {
						options['alreadyCrawled'] = crawledLink.map(v => v.link);
					}

					// Fetch entire site routes (returns a promise)
					const newLinks = await fetchEntireSiteRoutes(options);

					if (Array.isArray(newLinks) && newLinks.length > 0) {
						// Extract links with page type (returns a promise)
						const pages = await extractLinksPageType(newLinks);

						// Ensure `otherChildLinks` is an array
						const otherChildLinks = Array.isArray(pages.data.urls) ? changePageType(pages.data.urls) : [];

						if (otherChildLinks.length > 0) {
							// Crawl all other pages in parallel
							await Promise.all(
								otherChildLinks.map(({ link: crawlUrl, page_type }) =>
									crawlAllOtherPage({ url: crawlUrl, page_type, web_id: id })
								)
							);

							// Update the database with new links if successful
							await web_links.updateOne(
								{ _id: id },
								{ $set: { other_link: otherChildLinks, all_link_fatch_complete: ACTIVE, fatch_started: ACTIVE } }
							);
						}
					}
				})
			);

			// Step 4: Send success response
			return res.end("Processing............");
		} catch (e) {
			console.error("Error in crawlRemainingLinksOfWebsite:", e);
			return res.status(500).end("Internal Server Error");
		}
	}; // End crawlRemainingLinksOfWebsite

	/**
	 * Async function to send full Campaign Reachout Email to users.
	 * Uses async/await for all DB operations and handles parallel email sending with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.fullCampaignReachoutEmail = async (req, res, next) => {
		try {
			// Set user and web_ai_info collections
			const usersCollection = db.collection(TABLE_USERS);
			const webAiInfoCollection = db.collection(TABLE_WEB_AI_INFO);

			// Get current and previous date (1 day before)
			const currentDate = new Date();
			const previousDate = new Date(currentDate);
			previousDate.setDate(currentDate.getDate() - 1);
			const previousDateStr = previousDate.toISOString().split('T')[0];

			// Build query condition for eligible users
			const userQuery = {
				'account_type': PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
				'is_deleted': NOT_DELETED,
				'created': {
					$gte: getUtcDate(previousDateStr + START_DATE),
					$lt: getUtcDate(previousDateStr + END_DATE),
				},
			};

			// Step 1: Find all users matching the condition
			const userList = await usersCollection.find(userQuery).toArray();

			if (userList.length === 0) {
				return res.end("No Record matched");
			}

			// Step 2: Fetch all users' web_ai_info in one query for efficiency
			const userIds = userList.map(user => newObjectIdDefault(user._id));
			const webAiInfoList = await webAiInfoCollection.find({ user_id: { $in: userIds } }).toArray();
			const webAiInfoMap = new Map(webAiInfoList.map(info => [info.user_id.toString(), info]));

			// Step 3: Process all users in parallel using Promise.all
			await Promise.all(userList.map(async (userRecord) => {
				try {
					const userId = userRecord._id.toString();
					const userEmail = userRecord.email || "";

					// Get corresponding web_ai_info record
					const webAiInfoRecord = webAiInfoMap.get(userId);
					if (!webAiInfoRecord || !webAiInfoRecord.data) return;

					const dataVault = JSON.stringify(webAiInfoRecord.data);

					let aiResult;
					if (GEMINI_SERVER_ENABLE === true) {
						// Use Gemini server for AI response
						const prompt = MARKETING_EMAIL_PROMPT_FOR_GEMINI.replace(/{business_data}/g, dataVault);
						const format = MARKETING_EMAIL_SCHEMA;
						aiResult = await commonForGeminiWithoutGrounding(null, null, { 'prompt': prompt, 'format_schema': format });
					} else {
						// Use OpenAI for AI response
						const prompt = MARKETING_OUTREACH_EMAIL_PROMPT.replace('{data_vault}', dataVault);
						aiResult = await getAIResponseForEamil(prompt);
					}

					if (!aiResult || !aiResult.response) return;

					const marketingOutreachData = aiResult.response || {};
					const emailCopy = marketingOutreachData["email_copy"] || {};
					const emailOptions = {
						to: userEmail,
						action: "full_campaign_reachout_email",
						rep_array: [
							marketingOutreachData["rationale"] || "",
							marketingOutreachData["instagram_caption"] || "",
							emailCopy["subject"] || "",
							emailCopy["body"] || "",
							marketingOutreachData["display_ad_copy"] || ""
						]
					};

					// Send email asynchronously (do not await to maximize parallelism)
					await sendMail(req, res, emailOptions);

				} catch (aiError) {
					// Optionally log error, but continue with next user
					console.error(`AI/Email Error for user ${userRecord.email}: ${aiError.message}`);
				}
			}));

			// Step 4: Send success response
			return res.end("Processing............");

		} catch (error) {
			console.error("Error in fullCampaignReachoutEmail:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End fullCampaignReachoutEmail

	/**
	 * Async function to get AI response for full Campaign Reachout Email.
	 * Uses OpenAI's chat completion API and ensures the response is valid JSON.
	 * All async/await and error handling is properly managed.
	 * @param {*} prompt - The prompt string to send to the AI model.
	 * @returns {Promise<{status: string, response: object}>} - Resolves with status and parsed response.
	 */
	getAIResponseForEamil = async (prompt) => {
		try {
			// Step 1: Prepare messages for OpenAI chat completion
			const messages = [
				{ role: "system", content: "" },
				{ role: "user", content: prompt }
			];

			// Step 2: Send prompt data to OpenAI and await response
			const aiResult = await openai.createChatCompletion({
				model: "gpt-4o",
				messages: messages,
			});

			// Step 3: Extract AI response content
			let aiResponse = aiResult.data.choices[0].message.content;

			// Step 4: Attempt to parse the response as JSON
			try {
				let arrayResponseData = JSON.parse(aiResponse);
				return { status: STATUS_SUCCESS, response: arrayResponseData };
			} catch (parseError) {
				// Step 5: If parsing fails, validate and re-parse the response
				try {
					let validDataAgain = await validAiResponse(aiResponse);
					let responseDataAgain = validDataAgain.response;
					let againResponse = JSON.parse(responseDataAgain);
					return { status: STATUS_SUCCESS, response: againResponse };
				} catch (validationError) {
					// Step 6: If validation also fails, throw error
					throw validationError;
				}
			}
		} catch (error) {
			// Step 7: Handle and propagate any errors
			throw error;
		}
	}; // End getAIResponseForEamil

	/**
	 * Async function to extract links and their page types from a given array of URLs.
	 * Handles both Gemini and OpenAI responses using async/await.
	 * All AI queries are awaited and errors are handled gracefully.
	 * @param {*} linsArray - Array of URLs to process
	 * @returns {Promise<{status: string, data: object[]}>} - Resolves with status and extracted data
	 */
	extractLinksPageType = async (linsArray) => {
		try {
			// If Gemini server is enabled, use Gemini for extraction
			if (GEMINI_SERVER_ENABLE === true) {
				// Prepare prompt for Gemini
				const prompt = OTHER_PAGE_LINKS_CRAWL_PROMPT.replace(/{urls}/g, JSON.stringify(linsArray));
				// Await Gemini response
				let dataGeminiOptions = { prompt: prompt, format_schema: OTHER_PAGES_LINKS_EXTRACTION_SCHEMA };
				const geminiResponse = await commonForGeminiWithoutGrounding(null, null, dataGeminiOptions);

				if (geminiResponse.status === STATUS_SUCCESS) {
					const response = geminiResponse.response || [];
					return { status: STATUS_SUCCESS, data: response };
				} else {
					return { status: STATUS_SUCCESS, data: [] };
				}
			} else {
				// Otherwise, use OpenAI for extraction
				const messages = [
					{ role: "system", content: "" },
					{
						role: "user",
						content: `From the given list of URLs, Extract the ones that potentially provides relevant information about the business. 

							Requirements:
							- Do **not** include links to downloadable files (e.g., .pdf, .doc, .zip, etc.)
							- The page_type must correctly represent the content of the link
							- Include **only one most relevant URL per page_type** (no duplicates)

							Form the following array : ${JSON.stringify(linsArray)}
							Use the following format:{"urls":[{"page_type":<page_type>,"link":<link>}]}}; Make sure the page_type corresponds to the link content. Remember to return the output strictly in JSON array. Don't return json with backtics nor in start and nighter in end of your response.`
					}
				];

				// Await OpenAI chat completion response
				const aiResult = await openai.createChatCompletion({
					model: "gpt-4o",
					messages: messages,
				});

				let aiResponse = aiResult.data.choices[0].message.content;
				let arrayResponse = aiResponse;

				// Try to parse the AI response as JSON
				try {
					let arrayResponseData = JSON.parse(arrayResponse);
					return { status: STATUS_SUCCESS, data: arrayResponseData };
				} catch (e) {
					// If parsing fails, validate and re-parse the response
					try {
						const validDataAgain = await validAiResponse(arrayResponse);
						const responseDataAgain = validDataAgain.response;
						const againResponse = JSON.parse(responseDataAgain);
						return { status: STATUS_SUCCESS, data: againResponse };
					} catch (err) {
						// If still fails, return error status
						return { status: STATUS_ERROR, data: [] };
					}
				}
			}
		} catch (error) {
			// Catch any unexpected errors and return error status
			return { status: STATUS_ERROR, data: [] };
		}
	}; // End extractLinksPageType

	/**
	 * Crawl multiple page data and extract business information.
	 * Uses async/await for all DB operations and handles errors gracefully.
	 * @param {*} options  
	 * @return {Promise<object>} JSON response with status
	 */
	crawlAllOtherPage = async (options) => {
		const crawlUrl = options.url || "";
		const pageType = options.page_type || "";
		const webId = options.web_id || "";
		const web_ai_info = db.collection(TABLE_WEB_AI_INFO);
		const web_links = db.collection(TABLE_WEB_LINKS);

		try {
			// Fetch HTML content from the URL
			let html;
			try {
				html = await enhancedFetchHTML(crawlUrl);
			} catch (error) {
				// Remove the failed link from DB and return error
				await web_links.updateOne(
					{ _id: newObjectIdDefault(webId) },
					{ $pull: { other_link: { page_type: pageType } } }
				);
				return { status: STATUS_ERROR };
			}

			// Extract data from HTML
			const { data, socialMediaLinks, emailAddresses, contactNumbers } = await extractHTMLData(html, crawlUrl);

			// Ensure `data` is an array
			const paragraphs = Array.isArray(data) ? data : [];
			if (paragraphs.length === 0) {
				return { status: STATUS_ERROR };
			}

			// Filter and process paragraphs
			const maxTokenLimit = 1000;
			const minWordCount = 2;
			const processedTexts = new Set();
			let filteredParagraphs = [];

			for (const paragraph of paragraphs) {
				if (!processedTexts.has(paragraph) && paragraph.split(' ').length >= minWordCount) {
					// If tokens exceed the maximum limit, split into sentences
					if (paragraph.split(' ').length > maxTokenLimit) {
						const sentences = paragraph.split('.');
						for (const sentence of sentences) {
							if (sentence.split(' ').length >= minWordCount && !sentence.startsWith('<iframe')) {
								filteredParagraphs.push(sentence);
							}
						}
					} else {
						if (!paragraph.startsWith('<iframe')) {
							filteredParagraphs.push(paragraph);
						}
					}
					processedTexts.add(paragraph);
				}
			}

			// Helper to fix sentence spacing
			const fixSentenceSpacing = (text) => text.split(' ').filter(word => word !== '').join(' ');

			// Apply sentence spacing fix
			const fixedParagraphs = filteredParagraphs.length > 0
				? filteredParagraphs.map(fixSentenceSpacing)
				: [];

			// Append social/contact info if available
			if (socialMediaLinks.length > 0) fixedParagraphs.push(`Social media links : ${socialMediaLinks.join(', ')}`);
			if (emailAddresses.length > 0) fixedParagraphs.push(`Contact Emails : ${emailAddresses.join(', ')}`);
			if (contactNumbers.length > 0) fixedParagraphs.push(`Available contact numbers data : ${contactNumbers.join(', ')}`);

			const crawlData = fixedParagraphs;

			if (crawlData.length === 0) {
				return { status: STATUS_ERROR };
			}

			const newParagraphs = crawlData.join("\n\n");

			// Use Gemini server if enabled, otherwise fallback to OpenAI
			if (GEMINI_SERVER_ENABLE === true) {
				// Prepare prompt and format for Gemini
				const prompt = OTHER_PAGE_CRAWL_PROMPT.replace(/{paragraphs}/g, newParagraphs).replace(/{page_type}/g, pageType);
				const format = SINGLE_PAGE_EXTRACTION_SCHEMA_TEMPLATE(pageType);

				// Call Gemini and await response
				const geminiResponse = await commonForGeminiWithoutGrounding(null, null, { prompt, format_schema: format });

				if (geminiResponse.status === STATUS_SUCCESS) {
					const data = geminiResponse.response || '';
					const sanitizedData = replaceDotsInKeys(data);
					const datakey = Object.keys(sanitizedData)[0];
					const dataValue = sanitizedData[datakey];

					if (dataValue !== '') {
						// Fetch previous data for this webId
						const record = await web_ai_info.findOne({ web_id: newObjectIdDefault(webId) });
						const previousData = record.other_data || {};

						// Merge or append new data
						if (previousData.hasOwnProperty(datakey)) {
							const value = previousData[datakey];
							previousData[datakey] = (Array.isArray(value)) ? [...value] : [value];
							previousData[datakey].push(sanitizedData[datakey]);
							// Update DB with merged data
							await web_ai_info.updateOne(
								{ web_id: newObjectIdDefault(webId) },
								[{ $set: { other_data: previousData } }]
							);
						} else {
							// Update DB with new data
							await web_ai_info.updateOne(
								{ web_id: newObjectIdDefault(webId) },
								[{ $set: { other_data: { $mergeObjects: ["$other_data", sanitizedData] } } }]
							);
						}
					}
					// Always return success if Gemini responded
					return { status: STATUS_SUCCESS };
				} else {
					return { status: STATUS_ERROR };
				}
			} else {
				// Prepare system and user prompts for OpenAI
				const system = `You are a data extraction assistant. Your task is to extract key business details from the provided textual data of user asked. Your work is to troughly analyse data of page and return in a valid JSON format. Make sure to return JSON with no backtics in start or end.
Return all extracted information in the following JSON format:
json
{
"${pageType}": <plain_and_explain_text>,
}
Ensure that plain_and_explain_text return in only textual data. if there are listing point then list them in bullet point format as textual content.`;
				const user = CRAWLING_ALL_APGE_USER_PROMPT.replace(/{paragraphs}/g, newParagraphs).replace(/{pageType}/g, pageType);

				const optionsData = {
					system: system,
					user: user,
					res_json: ACTIVE
				};

				try {
					// Await OpenAI chat completion
					const result = await callOpenAIChat(optionsData);
					const response = result.response;
					const data = response;
					const sanitizedData = replaceDotsInKeys(data);
					const datakey = Object.keys(sanitizedData)[0];

					// Fetch previous data for this webId
					const record = await web_ai_info.findOne({ web_id: newObjectIdDefault(webId) });
					const previousData = record.other_data || {};

					// Merge or append new data
					if (previousData.hasOwnProperty(datakey)) {
						const value = previousData[datakey];
						previousData[datakey] = (Array.isArray(value)) ? [...value] : [value];
						previousData[datakey].push(sanitizedData[datakey]);
						// Update DB with merged data
						await web_ai_info.updateOne(
							{ web_id: newObjectIdDefault(webId) },
							[{ $set: { other_data: previousData } }]
						);
					} else {
						// Update DB with new data
						await web_ai_info.updateOne(
							{ web_id: newObjectIdDefault(webId) },
							[{ $set: { other_data: { $mergeObjects: ["$other_data", sanitizedData] } } }]
						);
					}
					return { status: STATUS_SUCCESS };
				} catch (e) {
					return { status: STATUS_ERROR };
				}
			}
		} catch (error) {
			// Catch any unexpected errors and return error status
			return {
				status: STATUS_ERROR,
				message: `Failed to crawl and save data from "${crawlUrl}": ${error.message}`
			};
		}
	}; // End crawlAllOtherPage

	/**
	 * Async function to send audience emails and handle rewards.
	 * Uses async/await for all DB operations and processes emails in series.
	 * @param {*} req
	 * @param {*} res
	 * @return render/json
	 */
	this.sendAudienceEmail = async (req, res, next) => {
		const leadAndSegmentEmailTable = db.collection(TABLE_LEAD_AND_SEGMENT_EMAIL_SEND_LOGS);
		const users = db.collection(TABLE_USERS);

		try {
			// Step 1: Check if any email send process is already running
			const processingCount = await leadAndSegmentEmailTable.countDocuments({ "email_send_status": CAMPAIGN_PROCESSING_PROCESS });
			if (processingCount > 0) {
				return res.end("Already email send Processing. Please wait complete status after send email other users............");
			}

			// Step 2: Find up to 10 pending email logs to process
			const leadPollSegmentLogsResult = await leadAndSegmentEmailTable
				.find({ 'email_send_status': CAMPAIGN_PENDING_PROCESS, "is_sent": DEFAULT_ZERO })
				.sort({ 'created': SORT_ASC })
				.limit(10)
				.toArray();

			if (!leadPollSegmentLogsResult || leadPollSegmentLogsResult.length === 0) {
				return res.end("No records found.");
			}

			// Step 3: Update status of selected logs to "processing"
			const leadAndSegmentEmailIds = leadPollSegmentLogsResult.map(record => record._id);
			await leadAndSegmentEmailTable.updateMany(
				{ "_id": { $in: leadAndSegmentEmailIds } },
				{ $set: { 'email_send_status': CAMPAIGN_PROCESSING_PROCESS } }
			);

			// Step 4: Process each email log in series (to avoid race conditions)
			for (const emailLogsData of leadPollSegmentLogsResult) {
				try {
					const leadAndSegmentEmailSendLogsId = emailLogsData && emailLogsData._id ? newObjectIdDefault(emailLogsData._id) : "";
					const emailUser = emailLogsData && emailLogsData.to_email ? emailLogsData.to_email : "";
					const rewardSendUserId = emailLogsData && emailLogsData.to_email_user_id ? newObjectIdDefault(emailLogsData.to_email_user_id) : "";
					const fromUserId = emailLogsData && emailLogsData.from_user_id ? newObjectIdDefault(emailLogsData.from_user_id) : "";
					const emailNewsletterTemplateId = emailLogsData && emailLogsData.email_newsletter_template_id ? newObjectIdDefault(emailLogsData.email_newsletter_template_id) : "";

					// Step 4.1: Fetch owner user details
					const usersResult = await users.findOne(
						{ '_id': fromUserId },
						{
							projection: {
								'_id': 1,
								'full_name': 1,
								'email': 1,
								'slug': 1,
								'signature_image': 1,
								'public_business_informaton': 1,
								'complete_profile_reward': 1
							}
						}
					);

					// Step 4.2: Prepare email options
					const emailOptionsData = {
						'creator_id': fromUserId,
						'email_send_to': emailUser,
						'reward_send_user_id': rewardSendUserId,
						'link_url': "",
						'link_blocked_wallet_url': "",
						'crone_accourding_welcome_email_id': emailNewsletterTemplateId,
						'user_created_result': usersResult
					};

					// Step 4.3: Send welcome mail and reward
					await welcomeMailSend(req, res, emailOptionsData);

					// Step 4.4: Update log status to "complete" and mark as sent
					await leadAndSegmentEmailTable.updateOne(
						{ "_id": leadAndSegmentEmailSendLogsId },
						{ $set: { 'email_send_status': CAMPAIGN_COMPLETE_PROCESS, 'is_sent': DEFAULT_ONE } }
					);
				} catch (err) {
					// Optionally log error for this record, but continue with next
					console.error("Error processing email log:", err);
				}
			}

			// Step 5: Send response after processing all emails
			return res.end("Email send Processing............");
		} catch (error) {
			console.error("Error in sendAudienceEmail:", error);
			return res.end("Error............");
		}
	}; // End sendAudienceEmail

	/**
	 * Function to refresh expired Instagram and Facebook Long Lived Tokens for users.
	 * Uses async/await for all DB operations and handles parallel token refreshes with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.againUpdateExpiredLongLivedToken = async (req, res, next) => {
		try {
			// Get required collection
			const users = db.collection(TABLE_USERS);

			// Get the date 50 days ago from the current date
			const currentDate = new Date();
			const fiftyDaysAgo = new Date(currentDate);
			fiftyDaysAgo.setDate(currentDate.getDate() - 50);

			// Convert to UTC format for MongoDB query
			const fiftyDaysAgoUTC = fiftyDaysAgo.toISOString();

			// --- Instagram Token Refresh ---
			const instagramConditions = {
				"account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
				"long_lived_access_token": { $exists: true },
				"instagram_modified": { $lt: new Date(fiftyDaysAgoUTC) },
			};

			// --- Facebook Token Refresh ---
			const facebookConditions = {
				"account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
				"facebook_long_lived_access_token": { $exists: true },
				"facebook_modified": { $lt: new Date(fiftyDaysAgoUTC) },
			};

			// Step 1: Find all users needing Instagram token refresh
			const instagramUsersPromise = users.find(instagramConditions).toArray();
			// Step 2: Find all users needing Facebook token refresh
			const facebookUsersPromise = users.find(facebookConditions).toArray();

			// Step 3: Run both queries in parallel
			const [instagramUsers, facebookUsers] = await Promise.all([instagramUsersPromise, facebookUsersPromise]);

			// Step 4: Refresh Instagram tokens in parallel
			let instagramUpdated = false;
			if (instagramUsers.length > 0) {
				await Promise.all(
					instagramUsers.map(async (record) => {
						try {
							const userId = newObjectIdDefault(record._id);
							const longLivedAccessToken = record.long_lived_access_token;
							await refreshLongLivedToken(longLivedAccessToken, userId);
						} catch (err) {
							console.error("Error refreshing Instagram token for user:", record._id, err);
						}
					})
				);
				instagramUpdated = true;
			}

			// Step 5: Refresh Facebook tokens in parallel
			let facebookUpdated = false;
			if (facebookUsers.length > 0) {
				await Promise.all(
					facebookUsers.map(async (record) => {
						try {
							const userId = newObjectIdDefault(record._id);
							const facebookLongLivedAccessToken = record.facebook_long_lived_access_token;
							const pageId = record.facebook_page_id;
							await refreshFacebookTokens(facebookLongLivedAccessToken, pageId, userId);
						} catch (err) {
							console.error("Error refreshing Facebook token for user:", record._id, err);
						}
					})
				);
				facebookUpdated = true;
			}

			// Step 6: Send response based on update results
			if (!instagramUpdated && !facebookUpdated) {
				return res.end("No Record Matched");
			} else {
				return res.end("Processing............");
			}
		} catch (e) {
			console.error("Error in againUpdateExpiredLongLivedToken:", e);
			return res.status(500).end("Internal Server Error");
		}
	}; // End againUpdateExpiredLongLivedToken

	/**
	 * Async function to deactivate plans that have expired after their end date.
	 * Uses async/await for all DB operations and handles parallel plan cancellations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.planExpireAfterCancelPlan = async (req, res, next) => {
		const planUserPurchaseCollection = db.collection(TABLE_USER_PLAN_PURCHASE);

		try {
			// Step 1: Find all active, non-card user plan purchases
			const planResult = await planUserPurchaseCollection.find({
				'subscription_status': SUBSCRIPTION_ACTIVE_STATUS,
				'plan_status': TYPE_ACTIVE,
				'payment_method': { $ne: PAYMENT_TYPE_CARD }
			}).toArray();

			if (!planResult || planResult.length === 0) {
				return res.end("No record found........");
			}

			// Step 2: Filter plans that expire today
			const currentDateString = new Date().toISOString().split('T')[0];
			const plansToCancel = planResult.filter(record => {
				const planEndDate = record.plan_end_date ? new Date(record.plan_end_date) : null;
				if (!planEndDate) return false;
				const planEndDateString = planEndDate.toISOString().split('T')[0];
				return planEndDateString === currentDateString;
			});

			if (plansToCancel.length === 0) {
				console.error("No subscriptions expiring today.");
				return res.end("No subscriptions expiring today.");
			}

			// Step 3: Cancel all expiring plans in parallel
			await Promise.all(plansToCancel.map(async (record) => {
				const userId = newObjectIdDefault(record.user_id);
				try {
					// Cancel customer plan and update table
					await userCancelSubscriptionsPlan({ 'user_id': userId, 'cancellation_reason': "" });
				} catch (error) {
					console.error("Error canceling subscription for user:", userId, error);
				}
			}));

			// Step 4: Send completion response
			return res.end("Processing complete.");
		} catch (error) {
			console.error("Error in planExpireAfterCancelPlan:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End planExpireAfterCancelPlan

	/**
	 * Function to send scheduled delayed post mail to users.
	 * Fetches all AI campaign chat records with delayed posts visible today,
	 * sends notification emails, and updates the relevant collections.
	 * All DB queries use async/await and are properly commented.
	 * Parallel operations are handled using Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @return render/json
	 */
	this.sentScheduleDelayedPostMail = async (req, res, next) => {
		try {
			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
			const calendarSchedulePost = db.collection(TABLE_CALENDAR_SCHEDULE_POST);

			// Step 1: Define start and end of current day
			const startOfDay = moment().startOf('day').toDate();
			const endOfDay = moment().endOf('day').toDate();

			// Step 2: Aggregate all AI campaign chat records with delayed posts visible today
			const records = await tableAiCampaignChat.aggregate([
				{
					$match: {
						'type': AI_RESPONSE_TYPE_SOCIAL_MEDIA,
						'delayed_post': true,
						'delayed_post_visible_date': {
							$gte: startOfDay,
							$lte: endOfDay
						}
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { userId: "$user_id" },
						pipeline: [
							{
								$match: {
									$expr: { $eq: ["$_id", "$$userId"] }
								}
							},
							{
								$project: { email: 1, signature_image: 1, current_timezone: 1 }
							}
						],
						as: "userDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_CALENDAR_SCHEDULE_POST,
						let: { campaignId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$ai_campaign_chat_id", "$$campaignId"] },
											{ $gte: ["$schedule_date", new Date()] }
										]
									}
								}
							}
						],
						as: "scheduleDetails"
					}
				},
				{
					$match: {
						userDetails: { $ne: [] }
					}
				},
				{
					$project: {
						'_id': 1,
						'user_id': 1,
						'content': 1,
						'email': { $ifNull: [{ $arrayElemAt: ["$userDetails.email", 0] }, ""] },
						'signature_image': { $ifNull: [{ $arrayElemAt: ["$userDetails.signature_image", 0] }, ""] },
						'current_timezone': { $ifNull: [{ $arrayElemAt: ["$userDetails.current_timezone", 0] }, ""] },
						'schedule_date': { $ifNull: [{ $arrayElemAt: ["$scheduleDetails.schedule_date", 0] }, ""] }
					}
				}
			]).toArray();

			// Step 3: If records found, process each in parallel
			if (records.length > 0) {
				await Promise.all(
					records.map(async (record) => {
						const campaignId = record?._id || "";
						const userId = record?.user_id || "";
						const content = record?.content || {};
						const email = record?.email || "";
						const signatureImage = record?.signature_image || "";
						const current_timezone = record?.current_timezone || "";
						const scheduleDate = record?.schedule_date || "";

						const title = content.title || '';
						const shortTermCaption = content.short_term_caption || '';
						const caption = content.captions ? content.captions.replace(/\n/g, '<br>') : '';
						const signatureImageUrl = signatureImage ? `<img src="${SIGNATURE_URL}${signatureImage}" style="max-height:60px;" >` : '';
						const PSTScheduledDateTime = scheduleDate ? newDateTimeZone(scheduleDate, NEW_DATE_FUNCITON_DATE_TIME_FORMAT, current_timezone) : "";
						const viewPostUrl = FRONT_URL + "pocial/content-library/social_media/content_created";

						let uploadSocialImages = [];
						let facebookSocialImages = [];
						let imageUrl = "";

						// Step 3.1: If title exists, fetch image from Pexels and download for Instagram and Facebook
						if (title) {
							const imageFromTitle = shortTermCaption ? shortTermCaption : title;
							const imageData = await getImageByTitle(imageFromTitle);

							if (imageData?.src) {
								const optionsImage = {
									url: imageData.src,
									dest: AI_SOCIAL_IMAGES_FILE_PATH,
									instagram_image_size: true
								};
								const optionsFacebookImage = {
									url: imageData.src,
									dest: AI_SOCIAL_IMAGES_FILE_PATH,
									facebook_image_size: true
								};

								// Download both images in parallel
								const [facebookImageResponse, imageResponse] = await Promise.all([
									downloadImageToUrl(res, req, optionsFacebookImage),
									downloadImageToUrl(res, req, optionsImage)
								]);

								const imageUrlName = imageResponse?.fileName || "";
								const imageExtension = imageResponse?.imageExtension || "";
								const facebookImageUrlName = facebookImageResponse?.fileName || "";
								const facebookImageExtension = facebookImageResponse?.imageExtension || "";

								if (imageUrlName) {
									uploadSocialImages.push({
										'_id': newObjectIdDefault(),
										'name': imageUrlName,
										'extension': imageExtension,
										'post_on_instagram': true
									});
									facebookSocialImages.push({
										'_id': newObjectIdDefault(),
										'name': facebookImageUrlName,
										'extension': facebookImageExtension,
										'post_on_facebook': true
									});
									imageUrl = AI_SOCIAL_IMAGES_URL + imageUrlName;
								}
							}
						}

						// Step 3.2: Prepare image block for email
						let imageBlock = "";
						if (imageUrl) {
							imageBlock = `<img src="${imageUrl}" alt="img" width="100%">
								<div style="position: absolute; left: 19px; top: 40px;border-radius: 0px 9px 9px 0px; background-color: rgba(255,255,255,0.75); padding: 5px 18px;">
									<span style="display: block;padding: 0 0 3px;font-size: 13px;font-family: Arial, Helvetica, sans-serif;color: #333;">Scheduled on:</span>
									<strong style="display: block;font-family: Arial, Helvetica, sans-serif;font-size: 13px;color: #333;"> ${PSTScheduledDateTime}</strong>
								</div>`;
						} else {
							imageBlock = `<div style="position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 350px; background-color: #e6f0f7; border-radius: 10px; text-align: center; padding: 20px; box-sizing: border-box;">
								<div style="position: absolute; left: 19px; top: 40px; border-radius: 0px 9px 9px 0px; background-color: rgba(255,255,255,0.75); padding: 5px 18px;">
									<span style="display: block; padding: 0 0 3px; font-size: 13px; font-family: Arial, Helvetica, sans-serif; color: #333;">Scheduled on:</span>
									<strong style="display: block; font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #333;">${PSTScheduledDateTime}</strong>
								</div>
								<img src="https://www.pocial.com/assets/images/upload-icon.svg" alt="Upload Icon" width="48" height="48" />
								<p style="font-size: 12px; color: #333333; padding: 10px 20px 0; margin: 0;">
									Your post is scheduled, but it will not be published to Instagram or Facebook without an image.
								</p>
							</div>`;
						}

						// Step 3.3: Send notification email to user
						const emailOptions = {
							to: email,
							action: 'social_post_delayed',
							rep_array: [DEAR_HI_CONSTANT, title, caption, imageBlock, signatureImageUrl, viewPostUrl]
						};
						await sendMail(req, res, emailOptions);

						// Step 3.4: Update both collections in parallel (unset delayed_post flags and set images)
						await Promise.all([
							tableAiCampaignChat.updateOne(
								{ _id: newObjectIdDefault(campaignId), user_id: newObjectIdDefault(userId) },
								{
									$set: { 'content.image': uploadSocialImages, 'content.facebook_image': facebookSocialImages },
									$unset: { delayed_post: 1, delayed_post_visible_date: 1 }
								}
							),
							calendarSchedulePost.updateOne(
								{ ai_campaign_chat_id: newObjectIdDefault(campaignId), user_id: newObjectIdDefault(userId) },
								{ $unset: { delayed_post: 1, delayed_post_visible_date: 1 } }
							)
						]);
					})
				);
				// Step 4: Send success response
				return res.end("Processed all records.");
			} else {
				// No records found for today
				return res.end("No records found.");
			}
		} catch (error) {
			// Log and return error response
			console.error("Error in sentScheduleDelayedPostMail:", error);
			return res.status(500).end("Internal Server Error");
		}
	}; // End sentScheduleDelayedPostMail


	/**
	 * Async function to fetch a single image from Pexels using a title/keyword.
	 * Uses async/await for API call and handles errors gracefully.
	 * @param {string} title - The search keyword or title.
	 * @returns {Promise<object|null>} - Returns image object or null if not found.
	 */
	async function getImageByTitle(title) {
		try {
			// Step 1: Create Pexels API client
			const client = createClient('0aozIlJh6vITv1GZX1embVzLtU90w5LANBXOXKqYiujQ425EvYusYwe4');

			// Step 2: Search for images using the provided title/keyword
			const response = await client.photos.search({
				query: title,
				per_page: 1,
				page: 1
			});

			// Step 3: Check if any images were found and return the first one
			if (response && response.photos && response.photos.length > 0) {
				const photo = response.photos[0];
				return {
					url: photo.url,
					src: photo.src?.original || null,
					photographer: photo.photographer || "",
					alt: photo.alt || "",
					id: photo.id
				};
			} else {
				// No image found for the given title
				return null;
			}
		} catch (error) {
			// Log error and return null to indicate failure
			console.error("Pexels image fetch error:", error.message);
			return null;
		}
	}


}
module.exports = new Crons();