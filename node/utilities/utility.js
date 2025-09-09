const fs = require('fs');
const crypto = require('crypto');
const async = require('async');
const userService = require(WEBSITE_SERVICES_FOLDER_PATH + 'user_service');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const genThumbnail = require('simple-thumbnail')
const shell = require('shelljs');
const imageDownloader = require('image-downloader')
const axios = require('axios');
const wkhtmltoimage = require('wkhtmltoimage');
const moment = require('moment');
const QRCode = require('qrcode');
const path = require('path');
const asyncParallel = require('async/parallel');
const sharp = require('sharp');
const util = require('util');
const { ObjectId } = require('mongodb');
const slug = require("slug").default;  // <-- important

/**
 * Function to send Email
 *
 * @param to		As Recipient Email Address
 * @param repArray  As Response Array
 * @param action  	As Email Action
 *
 * @return array
 */
sendMail = async (req, res, options) => {
	const ejs = require("ejs");
	try {
		let to = (options && options.to) ? options.to : "";
		let repArray = (options && options.rep_array) ? options.rep_array : "";
		let action = (options && options.action) ? options.action : "";
		let attachments = (options && options.attachments) ? options.attachments : "";
		let subject = (options && options.subject) ? options.subject : "";
		let bcc = (options && options.bcc) ? options.bcc : "";

		let userEmail = res.locals.settings["Email.user_email"];
		let emailHost = res.locals.settings["Email.host"];
		let emailPassword = res.locals.settings["Email.password"];
		let emailUserName = res.locals.settings["Email.user_name"];
		let emailPort = res.locals.settings["Email.port"];
		const nodemailer = require("nodemailer");

		if (to != '') {

			const transporter = nodemailer.createTransport({
				host: emailHost,
				port: emailPort,
				secure: (emailPort == SMTP_SECURE_PORT) ? true : false,
				auth: {
					user: userEmail,
					pass: emailPassword
				},
				tls: {
					rejectUnauthorized: true
				}
			});

			const users = db.collection(TABLE_USERS);
			const email_templates = db.collection(TABLE_EMAIL_TEMPLATES);
			const email_actions = db.collection(TABLE_EMAIL_ACTIONS);

			/** Send user details */
			let userCondition = { "email": { $regex: '^' + to + '$', $options: 'i' } };

			/** Pocial send email copyright footer use */
			if (POCIAL_SEND_EMAIL_ACTIONS.includes(action)) {
				userCondition = {
					"_id": newObjectIdDefault(POCIAL_ID)
				}
			}

			let usersToData = await users.findOne(userCondition);
			let publicBusinessInformaton = (usersToData && usersToData.public_business_informaton) ? usersToData.public_business_informaton : "";
			let nameOfTheBusiness = (publicBusinessInformaton && publicBusinessInformaton.name_of_the_business) ? publicBusinessInformaton.name_of_the_business : "";
			let primaryAddress = (publicBusinessInformaton && publicBusinessInformaton.primary_address) ? publicBusinessInformaton.primary_address : "";

			/** Get Email template details **/
			let emailTemplateResult = await email_templates.findOne(
				{ action: action },
				{ projection: { _id: 1, name: 1, subject: 1, body: 1 } }
			);

			if (!emailTemplateResult) {
				return consoleLog('Error in email template');
			}

			/** Get Email action details **/
			let emailActionResult = await email_actions.findOne(
				{ action: action },
				{ projection: { _id: 1, options: 1 } }
			);

			if (!emailActionResult) {
				return consoleLog('Error in email action');
			}

			let actionData = emailActionResult;
			let actionOptions = actionData.options.toString().split(",");
			let body = emailTemplateResult.body;
			subject = (subject) ? subject : emailTemplateResult.subject;

			actionOptions.forEach((value, key) => {
				/** Change the business name for name convert */
				if (value == 'FULL_NAME' || value == 'NAME') {
					nameOfTheBusiness = (nameOfTheBusiness) ? nameOfTheBusiness : repArray[key];
					body = body.replace(RegExp('{' + value + '}', 'g'), nameOfTheBusiness);
					subject = subject.replace(RegExp('{' + value + '}', 'g'), nameOfTheBusiness);
				} else {
					body = body.replace(RegExp('{' + value + '}', 'g'), repArray[key]);
					subject = subject.replace(RegExp('{' + value + '}', 'g'), repArray[key]);
				}
			});

			let htmlfile = 'email.html';
			if (
				action == 'signup_enterprise_basic_user' ||
				action == 'social_post_delayed' ||
				action == 'reward_send_email' ||
				action == 'post_caption_in_email_sent_to_user' ||
				action == 'social_reachout_day_one_email_sent_to_user' ||
				action == 'social_reachout_day_two_email_sent_to_user' ||
				action == 'social_reachout_day_third_email_sent_to_user' ||
				action == 'social_reachout_day_fourth_email_sent_to_user' ||
				action == 'social_reachout_day_five_email_sent_to_user' ||
				action == 'social_reachout_day_six_email_sent_to_user' ||
				action == 'social_reachout_day_seven_email_sent_to_user' ||
				action == 'get_started_home_page_email' ||
				action == 'user_purchase_plan'
			) {
				htmlfile = 'reward-email.html';
			}
			if (action == 'your_reward_is_waiting' || action == 'full_campaign_reachout_email') {
				htmlfile = 'white_background_email.html';
			}

			/** get email layout **/
			let html;
			try {
				html = await new Promise((resolve, reject) => {
					ejs.renderFile(
						WEBSITE_LAYOUT_PATH + htmlfile,
						{ settings: res.locals.settings },
						'',
						(err, str) => {
							if (err) reject(err);
							else resolve(str);
						}
					);
				});
			} catch (err) {
				return consoleLog(err);
			}

			html = html.replace(RegExp('{{MESSAGE_BODY}}', 'g'), body);
			html = html.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);
			html = html.replace(RegExp('{BUSINESS_ADDRESS}', 'g'), primaryAddress);
			html = html.replace(RegExp('{CURRENT_YEAR}', 'g'), new Date().getFullYear());

			/** Dynamic footer text manage */
			if (action == 'notify_leads_email' || action == 'owner_lead_from_user_created_after_vote') {
				let emailFooterURL = FRONT_URL + "pocial/business-dashboard";
				let emailFooterText = res.__("admin.sendmail.go_to_my_analytics");

				html = html.replace(RegExp('{{EMAIL_FOOTER_URL}}', 'g'), emailFooterURL);
				html = html.replace(RegExp('{{EMAIL_FOOTER_TEXT}}', 'g'), emailFooterText);

			} else if (action == 'forgot_password_email') {
				let emailFooterURL = FRONT_URL + "pocial/login";
				let emailFooterText = res.__("admin.sendmail.login");

				html = html.replace(RegExp('{{EMAIL_FOOTER_URL}}', 'g'), emailFooterURL);
				html = html.replace(RegExp('{{EMAIL_FOOTER_TEXT}}', 'g'), emailFooterText);

			} else if (action == 'verify_user_account_url_accourding') {
				html = html.replace(RegExp('class="footer_button_text"', 'g'), 'style="display: none;"');

			} else {
				let emailFooterURL = FRONT_URL + "my-wallet/new-rewards";
				let emailFooterText = res.__("admin.sendmail.go_to_my_wallet");

				html = html.replace(RegExp('{{EMAIL_FOOTER_URL}}', 'g'), emailFooterURL);
				html = html.replace(RegExp('{{EMAIL_FOOTER_TEXT}}', 'g'), emailFooterText);
			}

			let mailOptions = {
				'from': emailUserName,
				'to': to,
				'bcc': bcc,
				'subject': subject,
				'html': html
			};

			/** Send  attachment **/
			if (attachments) {
				mailOptions["attachments"] = {
					path: attachments
				};
			}

			/**Send email*/
			let sendMailError = null;
			try {
				await new Promise((resolve, reject) => {
					transporter.sendMail(mailOptions, (error) => {
						sendMailError = error;
						resolve();
					});
				});
			} catch (err) {
				sendMailError = err;
			}

			/** Save email logs details **/
			const email_logs = db.collection(TABLE_EMAIL_LOGS);
			mailOptions.error = sendMailError;
			mailOptions.created = getUtcDate();
			try {
				await email_logs.insertOne(mailOptions);
			} catch (err) {
				console.error('Failed to log email:', err);
			}

			if (sendMailError) {
				console.error('error');
				return console.error(sendMailError);
			}

		} else {
			return consoleLog("send email idn not found.")
		}
	} catch (e) {
		consoleLog("email error in sendMail function")
		consoleLog(e + "" + req)
	}
}//end sendMail();

/**
 * Function for change file name
 *
 * @param fileName AS File Name
 *
 * @return filename
 */
changeFileName = (fileName) => {
	let fileData = (fileName) ? fileName.split('.') : [];
	let extension = (fileData) ? fileData.pop() : '';
	fileName = fileName.replace('.' + extension, '');
	fileName = fileName.replace(RegExp('[^0-9a-zA-Z-]+', 'g'), '');
	fileName = fileName.replace('.', '');
	fileName = fileName.toLowerCase();
	return fileName + '.' + extension;
} //end changeFileName();

/**
 * Function to get data base slug
 *
 * @param tableName AS Table Name
 * @param title AS Title
 * @param slugField AS Slug Field Name in database
 *
 * @return string
 */
getDatabaseSlug = async (options) => {
	let tableName = (options && options.table_name) ? options.table_name : "";
	let title = (options && options.title) ? options.title : "";
	let slugField = (options && options.slug_field) ? options.slug_field : "";
	// const slug = require('slug');

	if (title == '' || tableName == "") return { title: "", options: options };

	let convertTitleIntoSlug = slug(title).toLowerCase();
	let collectionName = db.collection(String(tableName));

	/** Set conditions **/
	let conditions = {};
	conditions[slugField] = { $regex: new RegExp(convertTitleIntoSlug, "i") };

	let randomNumber = Math.floor(Math.random() * 99);

	try {
		/** Get count from table **/
		let count = await collectionName.countDocuments(conditions);
		return {
			title: (count > 0) ? convertTitleIntoSlug + '-' + count + '-' + randomNumber : convertTitleIntoSlug,
			options: options,
			err: null
		};
	} catch (err) {
		return {
			title: "",
			options: options,
			err: err
		};
	}
}//end getDatabaseSlug();

/**
 * Function to upload image
 *
 * @param options	As data in Object
 *
 * @return json
 */
moveUploadedFile = (req, res, options) => {
	return new Promise(resolve => {
		let manuallyMentionImageName = (options && options.manually_mention_image_name) ? options.manually_mention_image_name : "";
		let image = (options && options.image) ? options.image : "";
		let filePath = (options && options.filePath) ? options.filePath : "";
		let oldPath = (options && options.oldPath) ? options.oldPath : "";
		let oldVideoPath = (options && options.oldVideoPath) ? options.oldVideoPath : "";
		let allowedExtensions = (options && options.allowedExtensions) ? options.allowedExtensions : ALLOWED_IMAGE_EXTENSIONS;
		let allowedImageError = (options && options.allowedImageError) ? options.allowedImageError : ALLOWED_IMAGE_ERROR_MESSAGE;
		let allowedMimeTypes = (options && options.allowedMimeTypes) ? options.allowedMimeTypes : ALLOWED_IMAGE_MIME_EXTENSIONS;
		let allowedMimeError = (options && options.allowedMimeError) ? options.allowedMimeError : ALLOWED_IMAGE_MIME_ERROR_MESSAGE;
		let allowedSize = (options && options.size) ? Number(options.size) : ALLOWED_VALID_FILE_SIZE;
		let check_size_image = (options && typeof options.check_size_image != "undefined") ? DEACTIVE : ACTIVE;
		let allowedSizeErrorMessage = (options && options.allowedSizeErrorMessage) ? options.allowedSizeErrorMessage : ALLOWED_IMAGE_SIZE_MESSAGE;
		let fileSizeInBytes = (image.size) ? image.size : 0;
		let outTrimMimetype = (image.mimetype) ? image.mimetype : "";
		let aiSocialPostImageSubmit = (options.ai_social_image_submit) ? options.ai_social_image_submit : false;

		/** Manually image name mention */
		if (manuallyMentionImageName) {
			let manuallyFileDataExtension = (image.name) ? (image.name).split('.').pop() : '';
			let manuallyFileString = manuallyMentionImageName.replace(/ /g, "-");
			image['name'] = manuallyFileString + "." + manuallyFileDataExtension;
		}

		/*** function for use to S3 aws upload file */
		if (UPLOAD_TO_S3) {
			if (image == '') {
				/** Send success response **/
				let response = {
					status: STATUS_SUCCESS,
					fileName: oldPath,
					options: options,
					image_name: "",
					image_extension: ""
				};
				return resolve(response);
			} else {
				let fileData = (image.name) ? image.name.split('.') : [];
				let imageName = (image.name) ? image.name : '';
				let extension = (fileData) ? fileData.pop().toLowerCase() : '';
				if (allowedExtensions.indexOf(extension) == -1) {
					/** Send error response **/
					let response = {
						status: STATUS_ERROR,
						message: allowedImageError,
						options: options,
						image_name: imageName,
						image_extension: extension
					};
					return resolve(response);
				} else {
					/** Create new folder of this month **/
					const today = new Date();
					let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';

					let newFileName = newFolder + Date.now() + '-' + changeFileName(imageName);
					let uploadedFile = filePath + newFileName;

					var fileSizeInMegabytes = fileSizeInBytes / 1000000.0;

					if (fileSizeInMegabytes > allowedSize && checkSizeImage === ACTIVE) {
						/** Send error response **/
						let response = {
							status: STATUS_ERROR,
							message: allowedSizeErrorMessage,
							image_name: imageName,
							options: options,
							image_extension: extension
						};
						return resolve(response);
					} else {
						/** check mime type*/
						if (allowedMimeTypes.indexOf(outTrimMimetype) == -1) {
							/** Send error response **/
							let response = {
								status: STATUS_ERROR,
								message: allowedMimeError,
								image_name: imageName,
								options: options,
								image_extension: extension
							};
							return resolve(response);
						} else {
							/*** function for use to S3 aws upload file */
							let targetFolder = filePath.split('/')
							targetFolder = targetFolder[targetFolder.length - 2];
							uploadToS3({
								'file_path': filePath,
								'file_name': newFileName,
								'image': image,
								'mime_type': outTrimMimetype,
								'target_folder': targetFolder + '/' + newFileName,
							}).then((s3Response) => {
								if (s3Response.status == STATUS_ERROR) {
									/** Send error response **/
									let response = {
										'status': STATUS_ERROR,
										'image_name': imageName,
										'message': res.__("admin.system.something_going_wrong_please_try_again"),
										'options': options,
										'image_extension': extension
									};
									return resolve(response);
								} else {
									/** video delte*/
									if (oldVideoPath != '') {
										let imagesData = {
											file_path: filePath + oldVideoPath
										}
										removeFile(imagesData).then(() => { });
									}

									/** Start change video to mp4 video & compress video */
									if (aiSocialPostImageSubmit == false && ALLOWED_VIDEO_EXTENSIONS.includes(extension) && extension !== "mp4" && extension !== "gif") {
										let splitFileName = newFileName.split(".");
										newFileName = splitFileName[0] + ".mp4";
										shell.exec("ffmpeg -i " + uploadedFile + " -strict -2 " + POLLS_FILE_PATH + newFileName, { silent: true });

										/**Start make mp4 video after old extension video remove in local folder */
										let imagesData = {
											file_path: uploadedFile
										}
										removeFile(imagesData).then(() => { });
										/**End make mp4 video after old extension video remove in local folder */

										/*** function for use to S3 aws upload file */
										if (UPLOAD_TO_S3) {
											let targetFolder = filePath.split('/') // create upload folder name for bucket
											targetFolder = targetFolder[targetFolder.length - 2];
											uploadToS3({
												'file_path': filePath,
												'file_name': newFileName,
												'image': image,
												'target_folder': targetFolder + '/' + newFileName,
											}).then((s3Response) => {
												if (s3Response.status == STATUS_ERROR) {
													/** Send error response **/
													let response = {
														'status': STATUS_ERROR,
														'image_name': imageName,
														'message': res.__("admin.system.something_going_wrong_please_try_again"),
														'options': options,
														'image_extension': extension
													};
													return resolve(response);
												}
											});
										}
									}
									/** End change video to mp4 video */
									if (oldPath != '') {
										let imagesData = {
											file_path: filePath + oldPath
										}
										/** remove old images*/
										removeFile(imagesData).then(() => {
											/** Send success response **/
											let response = {
												status: STATUS_SUCCESS,
												fileName: newFileName,
												image_name: imageName,
												options: options,
												image_extension: extension
											};
											return resolve(response);
										});
									} else {
										/** Send success response **/
										let response = {
											status: STATUS_SUCCESS,
											fileName: newFileName,
											image_name: imageName,
											options: options,
											image_extension: extension
										};
										return resolve(response);
									}
								}
							});
						}
					}
				}
			}
		} else {
			if (image == '') {
				/** Send success response **/
				let response = {
					status: STATUS_SUCCESS,
					fileName: oldPath,
					options: options,
					image_name: ""
				};
				resolve(response);
			} else {
				let fileData = (image.name) ? image.name.split('.') : [];
				let imageName = (image.name) ? image.name : '';
				let extension = (fileData) ? fileData.pop().toLowerCase() : '';

				if (allowedExtensions.indexOf(extension) == -1) {
					/** Send error response **/
					let response = {
						status: STATUS_ERROR,
						message: allowedImageError,
						options: options,
						image_name: imageName,
						image_extension: extension
					};
					resolve(response);
				} else {
					/** Create new folder of this month **/
					const today = new Date();
					let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
					createFolder(filePath + newFolder);

					let newFileName = newFolder + Date.now() + '-' + changeFileName(imageName);
					let uploadedFile = filePath + newFileName;

					/** move image to folder*/
					image.mv(uploadedFile, (err) => {
						if (err) {
							/** Send error response **/
							let response = {
								status: STATUS_ERROR,
								image_name: imageName,
								message: res.__("admin.system.something_going_wrong_please_try_again"),
								options: options,
								image_extension: extension
							};
							resolve(response);
						} else {
							var stats = fs.statSync(uploadedFile)
							var fileSizeInBytes = stats["size"];
							var fileSizeInMegabytes = fileSizeInBytes / 1000000.0;

							if (fileSizeInMegabytes > allowedSize && check_size_image === ACTIVE) {

								let imagesData = {
									file_path: uploadedFile
								}
								removeFile(imagesData).then(() => { });

								/** Send error response **/
								let response = {
									status: STATUS_ERROR,
									message: allowedSizeErrorMessage,
									image_name: imageName,
									options: options,
									image_extension: extension
								};
								resolve(response);
							} else {
								/** check mime type*/
								const child_process = require('child_process');
								child_process.exec('file --mime-type -b ' + uploadedFile, (childProcessErr, out, code) => {

									if (allowedMimeTypes.indexOf(out.trim()) == -1) {
										fs.unlink(uploadedFile, (err) => {
											if (err) {
												/** Send error response **/
												let response = {
													status: STATUS_ERROR,
													childProcessErr: childProcessErr,
													code: code,
													image_name: imageName,
													message: res.__("admin.system.something_going_wrong_please_try_again"),
													options: options,
													image_extension: extension
												};
												resolve(response);
											} else {
												/** Send error response **/
												let response = {
													status: STATUS_ERROR,
													message: allowedMimeError,
													image_name: imageName,
													options: options,
													image_extension: extension
												};
												resolve(response);
											}
										});
									} else {
										/** video delte*/
										if (oldVideoPath != '') {
											let imagesData = {
												file_path: filePath + oldVideoPath
											}
											removeFile(imagesData).then(() => { });
										}

										/** Start change video to mp4 video & compress video */
										if (aiSocialPostImageSubmit == false && ALLOWED_VIDEO_EXTENSIONS.includes(extension) && extension !== "mp4" && extension !== "gif") {

											let splitFileName = newFileName.split(".");
											newFileName = splitFileName[0] + ".mp4";
											shell.exec("ffmpeg -i " + uploadedFile + " -strict -2 " + POLLS_FILE_PATH + newFileName, { silent: true });

											/**Start make mp4 video after old extension video remove in local folder */
											let imagesData = {
												file_path: uploadedFile
											}
											removeFile(imagesData).then(() => { });
											/**End make mp4 video after old extension video remove in local folder */
										}
										/** End change video to mp4 video */
										if (oldPath != '') {

											let imagesData = {
												file_path: filePath + oldPath
											}

											/** Remove old images*/
											removeFile(imagesData).then(() => {

												/** Send success response **/
												let response = {
													status: STATUS_SUCCESS,
													fileName: newFileName,
													image_name: imageName,
													options: options,
													image_extension: extension
												};
												resolve(response);
											});
										} else {
											/** Send success response **/
											let response = {
												status: STATUS_SUCCESS,
												fileName: newFileName,
												image_name: imageName,
												options: options,
												image_extension: extension
											};
											resolve(response);
										}
									}
								});
							}
						}
					});
				}
			}
		}
	});
}//End moveUploadedFile()

/*** 
 * Function for use to Bucket upload aws data
*/
uploadToS3 = (options) => {
	return new Promise(resolve => {
		const targetFolder = options["target_folder"];
		const file = options["image"];
		/** Create a readable stream from the file*/
		const fileStream = file.data;
		const uploadParams = {
			'Bucket': process.env.AWS_BUCKET_NAME,
			'Key': S3_BUCKET_UPLOAD_PATH + targetFolder,
			'Body': fileStream,
			'ContentType': options["mime_type"]
		};
		s3.upload(uploadParams, (err, data) => {
			if (err) {
				console.error('Error uploading image:', err);
				db.collection('s3_bucket_error').insertOne({
					'error': err,
					'data': data,
					'options': options,
					'created': getUtcDate(),
				}, () => {
					return resolve({ status: STATUS_ERROR, msg: err });
				});
			} else {
				return resolve({ status: STATUS_SUCCESS });
			}
		});
	});
}; //End uploadToS3();

/** 
 * Function for used to delete s3 data file path
 * */
deleteToS3Data = (options) => {
	return new Promise(resolve => {
		const filePath = options["file_path"];
		const deleteParams = {
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: filePath,
		};
		s3.deleteObject(deleteParams, function (s3Err, data) {
			if (s3Err) {
				return resolve(STATUS_ERROR);
			} else {
				return resolve(STATUS_SUCCESS);
			}
		});
	});
}; //End deleteToS3Data();

/**
 * Function for remove file from root path
 *
 * @param options As data in file root path
 *
 * @return json
 */
removeFile = (options) => {
	return new Promise(resolve => {
		var filePath = (options.file_path) ? options.file_path : "";
		let response = {
			status: STATUS_SUCCESS,
			options: options
		};

		if (filePath != "") {
			/** function for use to delete bucket file imageDownloader */
			if (UPLOAD_TO_S3) {
				let bucketFilePath = filePath.replace(WEBSITE_UPLOADS_ROOT_PATH, "");
				deleteToS3Data({ 'file_path': S3_BUCKET_UPLOAD_PATH + bucketFilePath });
			}

			/** Remove file **/
			fs.unlink(filePath, (err) => {
				if (!err) {
					/** Send success response **/
					resolve(response);
				} else {
					/** Send error response **/
					response.status = STATUS_ERROR;
					resolve(response);
				}
			});
		} else {
			/** Send error response **/
			response.status = STATUS_ERROR;
			resolve(response);
		}
	})
}//end removeFile()


/**
 * Function for use to remove file data loacal folder
 */
removeFileOnlyLocalFolder = (options) => {
	return new Promise(resolve => {
		var filePath = (options.file_path) ? options.file_path : "";
		let response = {
			status: STATUS_SUCCESS,
			options: options
		};
		if (filePath != "") {
			/** remove file **/
			fs.unlink(filePath, (err) => {
				if (!err) {
					/** Send success response **/
					resolve(response);
				} else {
					/** Send error response **/
					response.status = STATUS_ERROR;
					resolve(response);
				}
			});
		} else {
			/** Send error response **/
			response.status = STATUS_ERROR;
			resolve(response);
		}
	})
}//end removeFileOnlyLocalFolder()

/**
 * Function to Make full image path and check file is exist or not
 *
 * @param options As data in Object format (like :-  file url,file path,result,database field name)
 *
 * @return json
 */
appendFileExistData = (options) => {
	return new Promise(resolve => {
		var fileUrl = (options.file_url) ? options.file_url : "";
		var filePath = (options.file_path) ? options.file_path : "";
		var result = (options.result) ? options.result : "";
		var databaseField = (options.database_field) ? options.database_field : "";
		var image_placeholder = (options.image_placeholder) ? options.image_placeholder : IMAGE_FIELD_NAME;
		var noImageAvailable = (options.no_image_available) ? options.no_image_available : NO_IMAGE_AVAILABLE;

		if (result.length > 0) {
			let index = 0;
			result.forEach((record, recordIndex) => {
				var file = (record[databaseField] != '' && record[databaseField] != undefined) ? filePath + record[databaseField] : '';

				result[recordIndex][image_placeholder] = noImageAvailable;
				/** Set check file data **/
				let checkFileData = {
					"file": file,
					"file_url": fileUrl,
					"image_name": record[databaseField],
					"record_index": recordIndex,
					"no_image_available": noImageAvailable
				}

				checkFileExist(checkFileData).then((fileResponse) => {
					let recordIndexResponse = (typeof fileResponse.record_index !== typeof undefined) ? fileResponse.record_index : "";
					let imageResponse = (fileResponse.file_url) ? fileResponse.file_url : "";

					result[recordIndexResponse][image_placeholder] = imageResponse;

					if (result.length - 1 == index) {
						/** Send response **/
						let response = {
							result: result,
							options: options
						};
						resolve(response);
					}
					index++;
				});
			});
		} else {
			/** Send response **/
			let response = {
				result: result,
				options: options
			};
			resolve(response);
		}
	});
}//End appendFileExistData()

/**
 * Function to check a file is exist in folder or not
 *
 * @param options As data in Object format (like :-  file,file url,image name,index)
 *
 * @return  json
 */
checkFileExist = (options) => {
	return new Promise(resolve => {
		var file = (options.file) ? options.file : "";
		var fileUrl = (options.file_url) ? options.file_url : "";
		var imageName = (options.image_name) ? options.image_name : "";
		var recordIndex = (typeof options.record_index !== typeof undefined) ? options.record_index : "";
		var noImageAvailable = (options.no_image_available) ? options.no_image_available : "";

		if (UPLOAD_TO_S3) {
			/** Send response **/
			let response = {
				file_url: fileUrl + imageName,
				record_index: recordIndex,
				stat: "",
				options: options
			};
			resolve(response);
		} else {
			fs.stat(file, (err, stat) => {
				if (!err) {
					/** Send response **/
					let response = {
						file_url: fileUrl + imageName,
						record_index: recordIndex,
						stat: stat,
						options: options
					};
					resolve(response);
				} else {
					/** Send response **/
					let response = {
						file_url: (noImageAvailable) ? noImageAvailable : NO_IMAGE_AVAILABLE,
						record_index: recordIndex,
						options: options
					};
					resolve(response);
				}
			});
		}
	})
}//end checkFileExist()

/**
 * Datatable configuration
 *
 * @param req		As	Request Data
 * @param res		As 	Response Data
 * @param options	As Object of data have multiple values
 *
 * @return json
 */
configDatatable = (req, res, options) => {
	return new Promise(resolve => {
		var resultDraw = (req.body.draw) ? req.body.draw : 1;
		var sortIndex = (req.body.order && req.body.order[0]['column']) ? req.body.order[0]['column'] : '';
		var sortOrder = (req.body.order && req.body.order[0]['dir'] && (req.body.order[0]['dir'] == 'asc')) ? SORT_ASC : SORT_DESC;

		/** Searching  **/
		var conditions = {};
		var searchData = (req.body.columns) ? req.body.columns : [];
		if (searchData.length > 0) {
			searchData.forEach((record, index) => {
				let fieldName = ((record.field_name) ? record.field_name : ((record.data) ? record.data : ''));
				let searchValue = (record.search && record.search.value) ? record.search.value.trim() : '';
				let fieldType = (record.field_type) ? record.field_type : '';
				if (searchValue && fieldName) {
					switch (fieldType) {
						case NUMERIC_FIELD:
							conditions[fieldName] = parseInt(searchValue);
							break;
						case OBJECT_ID_FIELD:
							conditions[fieldName] = newObjectIdDefault(searchValue);
							break;
						case EXACT_FIELD:
							conditions[fieldName] = searchValue;
							break;
						default:
							try {
								searchValue = cleanRegex(searchValue);
								conditions[fieldName] = new RegExp(searchValue, "i");
							} catch (e) {
								conditions[fieldName] = searchValue;
							}
							break;
					}
				}
			});
		}

		/** Sorting **/
		var sortConditions = {};
		if (sortIndex != '') {
			if (searchData[sortIndex]) {
				if (searchData[sortIndex].field_name) {
					sortConditions[searchData[sortIndex].field_name] = sortOrder;
				} else if (searchData[sortIndex].data) {
					sortConditions[searchData[sortIndex].data] = sortOrder;
				}
			}
		} else {
			sortConditions['_id'] = sortOrder;
		}
		resolve({
			sort_conditions: sortConditions,
			conditions: conditions,
			result_draw: resultDraw,
			options: options,
			res: res,
		});
	});
}//End configDatatable()

/**
 * Function to convert multipart form data
 *
 * @param req As Request Data
 * @param res As Response Data
 *
 * @return json
 */
convertMultipartFormData = (req, res) => {
	return new Promise(resolve => {
		if (req.body && Object.keys(req.body).length > 0) {
			Object.keys(req.body).forEach((key) => {
				try {
					req.body[key] = JSON.parse(req.body[key]);
				} catch (e) {
					req.body[key] = req.body[key];
				}
			});
		}
		if (req.files && Object.keys(req.files).length > 0) {
			Object.keys(req.files).forEach((key) => {
				try {
					key = JSON.parse(key);
				} catch (e) {
					key = key;
				}
				try {
					req.files[key] = JSON.parse(req.files[key]);
				} catch (e) {
					req.files[key] = req.files[key];
				}
			});
		}
		resolve(res);
	});
}//end convertMultipartFormData();


/**
 * Function for get languages list
 *
 * @param defaultLanguage	As Default Language
 *
 * @return json
 */
getLanguages = (defaultLanguage) => {
	return new Promise(resolve => {
		try {
			/** Set  Conditios **/
			if (!defaultLanguage) {
				var conditions = { active: ACTIVE };
			} else {
				var conditions = { '_id': newObjectIdDefault(defaultLanguage), active: ACTIVE };
			}

			/** Get Language List **/
			var languages = db.collection(TABLE_LANGUAGES);
			languages.find(
				conditions
			).toArray((err, result) => {
				if (!err && result) {
					/** Send success response **/
					resolve(result);
				} else {
					/** Send blank response **/
					resolve([]);
				}
			});
		} catch (e) {
			/** Send blank response **/
			resolve([]);
		}
	});
}//End getLanguages()

/**
 * Function to get master list
 *
 * @param req		As	Request Data
 * @param res		As	Response Data
 * @param options  	As 	data as json format
 *
 * @return json
 */
getMasterList = async (req, res, options) => {
	// Return a promise for compatibility with existing code
	return new Promise(async (resolve) => {
		try {
			// Check if options.type is a valid array
			if (
				typeof options !== typeof undefined &&
				typeof options["type"] !== typeof undefined &&
				Array.isArray(options["type"]) &&
				options["type"].length > 0
			) {
				try {
					// Get master List using async/await
					const masters = db.collection(TABLE_MASTERS);
					const result = await masters.aggregate([
						{
							$match: {
								status: ACTIVE,
								dropdown_type: { $in: options["type"] },
							}
						},
						{ $sort: { name: SORT_ASC } },
						{
							$group: {
								_id: "$dropdown_type",
								data: {
									$push: {
										id: "$_id",
										name: "$name"
									}
								}
							}
						},
					]).toArray();

					let finalResult = {};
					if (result && result.length > 0) {
						result.forEach((item) => {
							let masterType = (item._id) ? item._id : "";
							let masterData = (item.data) ? item.data : [];
							if (masterType != "") {
								finalResult[masterType] = masterData;
							}
						});
					}

					/** Send success response **/
					let resolveResponse = {
						status: STATUS_SUCCESS,
						result: finalResult,
						options: options
					}
					resolve(resolveResponse);
				} catch (err) {
					/** Send error response **/
					let resolveResponse = {
						status: STATUS_ERROR,
						options: options,
						req: req,
						message: res.__("admin.system.something_going_wrong_please_try_again")
					}
					resolve(resolveResponse);
				}
			} else {
				/** Send error response **/
				let resolveResponse = {
					status: STATUS_ERROR,
					options: options,
					message: res.__("admin.system.something_going_wrong_please_try_again")
				}
				resolve(resolveResponse);
			}
		} catch (e) {
			/** Send error response **/
			let resolveResponse = {
				status: STATUS_ERROR,
				options: options,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			}
			resolve(resolveResponse);
		}
	});
}// end getMasterList()

/**
 * Function to get notifications template
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param options	As options
 *
 * @return array
 */
getNotificationsTemplates = async (req, res, options) => {
	// Return a promise for compatibility with existing code
	return new Promise(async (resolve) => {
		try {
			let notificationType = (options && options.notification_type) ? parseInt(options.notification_type) : "";
			let messageParams = (options && options.messageParams) ? options.messageParams : "";

			// Get notification template using async/await
			const notificationDataByType = await db.collection(TABLE_NOTIFICATION_TEMPLATES).findOne({ notification_type: notificationType });

			if (notificationDataByType) {
				/** Get message from message param parameters **/
				let constants = notificationDataByType.constants;
				let notificationMessage = notificationDataByType.body;
				let notificationTitle = notificationDataByType.subject;
				if (Array.isArray(constants) && Array.isArray(messageParams)) {
					for (let i = 0; i < constants.length; i++) {
						notificationMessage = notificationMessage.replace(RegExp(constants[i], 'g'), messageParams[i]);
					}
				}
				let resolveResponse = {
					notificationMessage: notificationMessage ? notificationMessage : "",
					notificationTitle: notificationTitle ? notificationTitle : "",
					req: req,
					res: res,
				};
				resolve(resolveResponse);
			} else {
				let resolveResponse = {
					notificationMessage: "",
					notificationTitle: "",
				};
				resolve(resolveResponse);
			}
		} catch (e) {
			let resolveResponse = {
				notificationMessage: "",
				notificationTitle: "",
			};
			resolve(resolveResponse);
		}
	});
}// end getNotificationsTemplates()

/**
 *  Function to insert notification
 *
 * @param req 			As Request Data
 * @param res 			As Response Data
 * @param options		As options
 *
 * @return array
 */
insertNotifications = async (req, res, options) => {
	let notificationData = (options['notification_data']) ? options['notification_data'] : "";
	let notificationType = (notificationData['notification_type']) ? parseInt(notificationData['notification_type']) : "";
	let messageParams = (notificationData['message_params']) ? notificationData['message_params'] : "";
	let userId = (notificationData['user_id']) ? notificationData['user_id'] : ((req.session.user._id) ? req.session.user._id : "");

	let notificationMessage = "";
	let notificationTitle = "";
	if (messageParams) {
		/** Set save notification options **/
		var getOptions = {
			notification_type: notificationType,
			messageParams: messageParams,
			messageParams: messageParams,
			user_id: userId,
		};

		/** get notification data **/
		await getNotificationsTemplates(req, res, getOptions).then(getTemplate => {
			notificationMessage = getTemplate.notificationMessage;
			notificationTitle = getTemplate.notificationTitle;
		})

	} else {
		notificationMessage = (notificationData['message']) ? notificationData['message'] : "";
	}
	return new Promise(resolve => {

		let createdBy = (notificationData['user_id']) ? notificationData['user_id'] : ((req.session.user._id) ? req.session.user._id : "");
		let createdByRoleId = (notificationData['user_role_id']) ? notificationData['user_role_id'] : ((req.session.user.user_role_id) ? req.session.user.user_role_id : "");
		let parentTableId = (notificationData['parent_table_id']) ? notificationData['parent_table_id'] : "";

		let saveNotificationData = {
			user_id: "",
			user_role_id: "",
			created_by: newObjectIdDefault(createdBy),
			created_role_id: createdByRoleId,
			title: notificationTitle,
			message: notificationMessage,
			parent_table_id: newObjectIdDefault(parentTableId),
			extra_parameters: (notificationData['extra_parameters']) ? notificationData['extra_parameters'] : {},
			notification_type: notificationType,
			is_seen: NOT_SEEN,
			is_read: NOT_READ,
			created: getUtcDate(),
			modified: getUtcDate()
		};

		let userRoleId = (notificationData['role_id']) ? notificationData['role_id'] : FRONT_ADMIN_ROLE_ID;
		let selectedUserIds = (notificationData["user_ids"]) ? notificationData["user_ids"] : [];

		/** Set save notification options **/
		var saveOptions = {
			user_ids: selectedUserIds,
			notification_data: saveNotificationData,
			notification_type: notificationType,
			user_role_id: userRoleId
		};

		if (notificationMessage != '' && notificationTitle != '') {
			/** Save notification data **/
			saveNotifications(req, res, saveOptions).then(saveDataStatus => {
				let resolveResponse = {
					status: saveDataStatus.status,
					user_list: (saveDataStatus.user_list) ? saveDataStatus.user_list : [],
					message: (saveDataStatus.message) ? saveDataStatus.message : "",
					options: options,
					notificationMessage: notificationMessage,
					notificationTitle: notificationTitle,
				};
				resolve(resolveResponse);
			});
		} else {
			let resolveResponse = {
				status: STATUS_ERROR,
				user_list: [],
				message: "",
				options: options,
				notificationMessage: notificationMessage,
				notificationTitle: notificationTitle,
			};
			resolve(resolveResponse);
		}
	});
}// end insertNotification()

/**
 *  Function to save notifications (Updated: uses async/await for DB operations)
 *
 * @param req 			As Request Data
 * @param res 			As Response Data
 * @param options		As options
 *
 * @return array
 */
saveNotifications = async (req, res, options) => {
	// Extract user IDs and notification type from options
	let userIds = (options && options.user_ids) ? options.user_ids : [];
	let notificationType = (options && options.notification_type) ? options.notification_type : "";

	if (userIds.length > 0 && notificationType) {
		const clone = require("clone");
		let saveNotificationData = (options && options.notification_data) ? options.notification_data : [];
		let notificationUserRoleId = (options && options.user_role_id) ? options.user_role_id : "";

		/** Set insertable data **/
		let notificationsList = userIds.map(records => {
			let tempNotificationData = clone(saveNotificationData);
			tempNotificationData['user_id'] = newObjectIdDefault(records);
			tempNotificationData['user_role_id'] = notificationUserRoleId;
			return tempNotificationData;
		});

		/** Insert in notification table using async/await **/
		const notifications = db.collection(TABLE_NOTIFICATIONS);
		try {
			// Insert notifications in bulk
			const notificationResult = await notifications.insertMany(notificationsList, { forceServerObjectId: true });

			/** Send push notification to each user **/
			notificationsList.forEach(notificationUserId => {
				let socketRequestData = {
					room_id: String(notificationUserId["user_id"]),
					emit_function: "notification_received",
					message: saveNotificationData["message"]
				};
				socketRequest(req, res, socketRequestData);
			});

			/** Prepare and return success response **/
			let resolveResponse = {
				status: STATUS_SUCCESS,
				user_list: notificationsList,
				options: options,
				result: notificationResult
			};
			return resolveResponse;
		} catch (notificationErr) {
			/** Handle DB error **/
			let resolveResponse = {
				status: STATUS_ERROR,
				user_list: [],
				message: res.__("admin.system.something_going_wrong_please_try_again"),
				options: options
			};
			return resolveResponse;
		}
	} else {
		/** Send error response if no users or notification type **/
		let resolveResponse = {
			status: STATUS_ERROR,
			user_list: [],
			message: res.__('admin.users.no_user_selected'),
			options: options
		};
		return resolveResponse;
	}
}// end saveNotifications()


/**Function to save pn log */
savePNRequest = (options) => {
	const pn_logs = db.collection(TABLE_PN_LOGS);
	pn_logs.insertOne(options);
	return;
}//End savePNRequest();


/**
 *  Function to get dropdown list with html (Updated: uses async/await for DB operations)
 *
 * @param req 				As Request Data
 * @param res 				As Response Data
 * @param options			As options
 *
 * @return object
 */
getDropdownList = async (req, res, options) => {
	// Use async/await for DB queries
	try {
		const collections = (options.collections) ? options.collections : {};
		const finalHtmlData = {};

		if (collections && collections.length > 0) {
			// Loop through each collection record
			for (let j = 0; j < collections.length; j++) {
				const collectionRecords = collections[j];
				const collection = (collectionRecords["collection"]) ? collectionRecords["collection"] : "";
				const emailRequired = (collectionRecords["email_required"]) ? collectionRecords["email_required"] : DEACTIVE;
				const selectedValues = (collectionRecords["selected"]) ? collectionRecords["selected"] : [];
				const columns = (collectionRecords.columns) ? collectionRecords.columns : [];
				const columnKey = (columns[0]) ? columns[0] : "";
				const columnValue = (columns[1]) ? columns[1] : "";
				const columnValueTwo = (columns[2]) ? columns[2] : "";
				const conditions = (collectionRecords.conditions) ? collectionRecords.conditions : {};
				let finalHtml = "";

				if (columnKey && columnValue && conditions) {
					// Prepare sort conditions
					let sortConditions = {};
					sortConditions[columnValue] = SORT_ASC;
					if (collectionRecords["sort_conditions"]) {
						sortConditions = collectionRecords["sort_conditions"];
					}

					// Prepare projection columns
					let finalColumns = {};
					finalColumns[columnKey] = 1;
					finalColumns[columnValue] = 1;
					if (columnValueTwo) {
						finalColumns[columnValueTwo] = 1;
					}

					// Get collection object
					const collectionObject = db.collection(collection);

					// Query the database using async/await
					let result = [];
					try {
						result = await collectionObject.find(
							conditions,
							finalColumns
						).collation(COLLATION_VALUE).sort(sortConditions).toArray();
					} catch (err) {
						// Handle DB error for this collection
						return {
							status: STATUS_ERROR,
							req: req,
							message: res.__("admin.system.something_going_wrong_please_try_again"),
							options: options
						};
					}

					// Build HTML options
					for (let i = 0; i < result.length; i++) {
						const records = (result[i]) ? result[i] : "";
						let selectedHtml = "";
						for (let k = 0; k < selectedValues.length; k++) {
							if (String(selectedValues[k]) == String(records[columnKey])) {
								selectedHtml = 'selected="selected"';
							}
						}

						let stringValue = (records[columnValue]) ? records[columnValue] : "";
						if (stringValue.length > DROPDOWN_CHARACTER_LIMIT) {
							stringValue = stringValue.substring(0, DROPDOWN_CHARACTER_LIMIT) + "...";
						}
						if (emailRequired == ACTIVE) {
							let stringValueTwo = (records[columnValueTwo]) ? records[columnValueTwo] : "";
							if (stringValueTwo.length > DROPDOWN_CHARACTER_LIMIT) {
								stringValueTwo = stringValueTwo.substring(0, DROPDOWN_CHARACTER_LIMIT) + "...";
							}
							finalHtml += '<option value="' + records[columnKey] + '" ' + selectedHtml + '>' + stringValue + ' (' + stringValueTwo + ')' + '</option>';
						} else {
							finalHtml += '<option value="' + records[columnKey] + '" ' + selectedHtml + '>' + stringValue + '</option>';
						}
					}
					finalHtmlData[j] = finalHtml;
				} else {
					// Missing parameters for this collection
					return {
						status: STATUS_ERROR,
						message: res.__("admin.system.missing_parameters"),
						options: options
					};
				}
			}
			// All collections processed successfully
			return {
				status: STATUS_SUCCESS,
				final_html_data: finalHtmlData,
				options: options
			};
		} else {
			// No collections provided
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.missing_parameters"),
				options: options
			};
		}
	} catch (err) {
		// Catch-all error handler
		return {
			status: STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again"),
			options: options
		};
	}
}//End getDropdownList()

/**
 *  Function to create a new folder
 *
 * @param path	As	folder path
 *
 * @return Object
 */
createFolder = (path) => {
	return new Promise(resolve => {
		const async = require('async');
		let filePathData = path.split('/');
		let fullPath = "/";
		if (filePathData.length > 0) {
			async.each(filePathData, (folderName, asyncCallback) => {
				if (folderName != "") {
					fullPath += folderName + "/";
				}
				if (!fs.existsSync(fullPath)) {
					fs.mkdirSync(fullPath);
				}
				asyncCallback(null);
			}, asyncErr => {
				/** Send success response **/
				resolve({ status: STATUS_SUCCESS, asyncErr: asyncErr });
			});
		} else {
			/** Send success response **/
			resolve({ status: STATUS_SUCCESS });
		}
	});
}// end createFolder()


/**
 * function is used to update user wise module flag
 *
 * @param userId as User Id
 * @param data as Data to be updated
 * @param type as update Type : delete/add/get
 *
 * @return regular expression
 */
userModuleFlagAction = (userId, data, type) => {
	var adminModulesList = myCache.get("admin_modules_list");
	if (typeof adminModulesList === typeof undefined) {
		adminModulesList = {};
	}
	if (type == "add") {
		adminModulesList[userId] = data;
		myCache.set("admin_modules_list", adminModulesList, 0);
		return true;
	} else if (type == "delete") {
		delete adminModulesList[userId];
		myCache.set("admin_modules_list", adminModulesList, 0);
		return true;
	} else if (type == "get") {
		return adminModulesList[userId];
	}
}//end userModuleFlagAction

/**
 *  Function is genrate notification url
 *
 * @param req As request Data
 *
 * @return Json
 */
generateNotificationUrl = (options) => {
	return new Promise(resolve => {
		let notificationList = [];
		let notificationData = (options.result) ? options.result : [];
		if (!notificationData || notificationData.length < 1) {
			return resolve({ data: [], options: options });
		}

		notificationData.map((notification) => {
			let type = (notification.notification_type) ? notification.notification_type : "";
			let extraParams = (notification.extra_parameters) ? notification.extra_parameters : "";

			switch (type) {
				case NOTIFICATION_USER_REGISTER:
					if (extraParams.user_id && extraParams.user_type) {
						notification["url"] = WEBSITE_ADMIN_URL + "users/" + extraParams.user_type + "/view/" + extraParams.user_id;
					} else {
						notification["url"] = "javascript:void(0);";
					}
					break;
				default:
					notification["url"] = "javascript:void(0);";
			}
			notificationList.push(notification);
		});
		resolve({ data: notificationList, options: options });
	});
};//End generateNotificationUrl()

/**
 * Function to get difference in two dates
 *
 * @param startDate AS start date
 * @param endDate 	AS end date
 *
 * @return difference between two days in minutes
 */
getDifferenceBetweenTwoDatesInMinute = (startDate, endDate) => {
	startDate = new Date(startDate);
	endDate = new Date(endDate);
	let timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
	let diffInMinute = (timeDiff / MILLISECONDS_IN_A_SECOND) / SECONDS_IN_A_MINUTE;
	return diffInMinute;
}//end getDifferenceBetweenTwoDatesInMinute();

/**
 * Function to get difference in two dates in days
 *
 * @param startDate AS start date
 * @param endDate 	AS end date 
 *
 * @return difference between two days in minutes
 */
getDifferenceBetweenTwoDatesInDays = (startDate, endDate) => {
	startDate = new Date(startDate);
	endDate = new Date(endDate);
	var diffDays = parseInt((startDate - endDate) / (1000 * 60 * 60 * 24), 10);
	return diffDays + 1;
}//end getDifferenceBetweenTwoDatesInDays();

/**
 *  Function to get cms page data (Updated: uses async/await for DB operations)
 *
 * @param req      As Request Data
 * @param res      As Response Data
 * @param pageSlug as cms page slug
 *
 * @return array
 */
getCmsPageData = async (req, res, pageSlug) => {
	// Return error if pageSlug is not provided
	if (!pageSlug || pageSlug == "") {
		return {
			status: STATUS_ERROR,
			req: req,
			message: res.__("admin.system.invalid_access")
		};
	}
	try {
		// Get details using async/await
		const cms = db.collection(TABLE_PAGES);
		const pageData = await cms.findOne({ slug: pageSlug });

		if (pageData) {
			// Send success response
			return {
				status: STATUS_SUCCESS,
				result: pageData ? pageData : {}
			};
		} else {
			// Send error response if page not found
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}
	} catch (e) {
		// Send error response on exception
		return {
			status: STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}; //End getCmsPageData()

/**
 *  Function to get user detail (Updated: uses async/await for DB operations)
 *
 * @param req 				As Request Data
 * @param res 				As Response Data
 * @param options			As requested Data
 *
 * @return object
 */
getUserDetail = async (req, res, options) => {
	let conditions = (options && options.conditions) ? options.conditions : {};

	try {
		const users = db.collection(TABLE_USERS);

		// Use async/await to query user details
		const userresponse = await users.aggregate([
			{ $match: conditions },
			{
				$project: {
					first_name: 1,
					last_name: 1,
					email: 1,
					full_name: 1,
					mobile_number: 1,
					gender: 1,
					profile_image: 1,
					reward_image: 1,
					slug: 1,
					current_role: 1,
					user_role_id: 1,
					is_mobile_verified: 1,
					is_email_verified: 1,
					is_verified: 1,
					date_of_birth: 1,
					user_type: 1,
				}
			}
		]).toArray();

		if (userresponse && userresponse.length > 0) {
			// Send success response
			return {
				status: STATUS_SUCCESS,
				result: userresponse[0] ? userresponse[0] : {},
				message: ''
			};
		} else {
			// No user found
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("admin.system.something_going_wrong_please_try_again")
			};
		}
	} catch (e) {
		consoleLog(e);
		// Send error response on exception
		return {
			status: STATUS_ERROR,
			result: {},
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}// end getUserDetail()


/**
 *  Function to convert currency format
 *
 * @param amount as currency value
 *
 * @return amount after convert currency format
 */
currencyFormat = (amount) => {
	if (!amount || isNaN(amount)) {
		return CURRENCY_SYMBOL + " " + amount;
	} else {

		amount = round(amount, ROUND_PRECISION);
		amount = amount.toString();
		var afterPoint = '';

		if (amount.indexOf('.') > 0) afterPoint = amount.substring(amount.indexOf('.'), amount.length);
		amount = Math.floor(amount);
		amount = amount.toString();
		var lastThree = amount.substring(amount.length - 3);
		var otherNumbers = amount.substring(0, amount.length - 3);
		if (otherNumbers != '') lastThree = ',' + lastThree;
		var finalAmount = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree + afterPoint;

		return CURRENCY_SYMBOL + " " + finalAmount;
	}
}// end currencyFormat()

/**
 * Function to get user data by slug
 *
 * @param req		As	Request Data
 * @param res		As 	Response Data
 * @param options	As  object of data
 *
 * @return json
 **/
getUserDetailBySlug = async (req, res, options) => {
	let conditions = (options.conditions) ? options.conditions : {};

	/** Send error response **/
	if (!conditions) {
		return {
			status: STATUS_ERROR,
			req: req,
			options: options,
			message: res.__("system.something_going_wrong_please_try_again")
		};
	}

	if (conditions && Object.keys(conditions).length > 0) {
		try {
			/** Get user details **/
			const users = db.collection(TABLE_USERS);
			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

			const aggregatePipeline = [
				{ $match: conditions },
				{
					$lookup: {
						"from": TABLE_SUB_USERS,
						"localField": "_id",
						"foreignField": "user_id",
						"as": "sub_users_details"
					}
				},
				{
					$lookup: {
						from: TABLE_LEAD_FORMS,
						let: { leadId: "$lead_forms_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$leadId"] },
										]
									},
								}
							},
							{ $project: { "form_title": 1, "button_name": 1 } }
						],
						as: "leadDetails"
					}
				},
			];

			let resultArr = await users.aggregate(aggregatePipeline).toArray();

			/** Send success response **/
			if (!resultArr) {
				return {
					status: STATUS_ERROR,
					result: false,
					options: options,
				};
			}

			if (resultArr.length > 0) {
				let result = resultArr[0];

				/** This condition for used to If there is a business name then the name of the business is mentioned otherwise the full name */
				result['full_name'] = (result['public_business_informaton'] && result['public_business_informaton']['name_of_the_business']) ? result['public_business_informaton']['name_of_the_business'] : result['full_name'];
				result['auto_schedule'] = (result['auto_schedule']) ? true : false;

				let userId = (result && result._id) ? result._id : "";
				let leadFormsId = (result && result.lead_forms_id) ? result.lead_forms_id : "";

				/** This function for used to vote count login user (for poll embed purpose used) */
				let pollId = (req && req.body && typeof req.body.poll_id !== "undefined") ? req.body.poll_id : "";
				let userWiseVoteCount = 0;
				if (pollId != '') {
					userWiseVoteCount = await alreadyUserPollVoteCheck(userId, pollId);
				}

				/** Count onboarding progress */
				let onboardingSteps = [
					result['visite_brand_identity'],
					result['create_social_post_from_media'],
					result['facebook_user_details'] || result['long_lived_access_token'],
					result['visite_collaboration_portals'],
					result['visite_content_creation_section'],
					result['view_my_profile']
				];

				let onboardingCount = onboardingSteps.filter(Boolean).length;

				/** check for second social signup flag */
				let secondSocialSignupFlag = await tableAiCampaignChat.countDocuments({ "user_id": newObjectIdDefault(userId), "first_content_campaign": true });

				result['first_social_post_without_insider'] = (secondSocialSignupFlag > 0) ? true : false;

				/** Mongo date to convert dd-mm-yy simple date get*/
				let dobConvert = mongoDatetoSimpleDateConvert(result.dob);
				result['dd'] = dobConvert.dd;
				result['mm'] = dobConvert.mm;
				result['yy'] = dobConvert.yy;

				/** Get sub user data ids*/
				let subUsersDetails = (result && result.sub_users_details.length > 0) ? result['sub_users_details'][0]['selected_user'] : [];
				let frontSubUsersDetails = (result && result.sub_users_details.length > 0) ? result['sub_users_details'][0]['front_selected_user'] : [];
				result['admin_sub_user_ids'] = subUsersDetails;
				result['front_sub_user_ids'] = frontSubUsersDetails;
				result['is_password_blank'] = (result.password) ? DEFAULT_ONE : DEFAULT_ZERO;

				/** Profile image name get without folder name */
				result['profile_image_name'] = "";
				if (result.profile_image) {
					const parts = (result.profile_image).split('/');
					const lastPart = parts[parts.length - 1];
					result['profile_image_name'] = lastPart;
				}

				/** This condition for used to ai scripted code  */
				if (result && result.ai_bot_forms_id) {
					result['without_scripted_id_generate_code'] = WITHOUT_SCRIPTED_ID_GENERATE_SCRIPTED_CODE.replace("{LEAD_ID}", result['ai_bot_forms_id']);
				}

				/** business user activity other functionality use or not use */
				let responseActivity = await getBusinessUserAllActivityUse(userId);

				result['business_lead_activity'] = responseActivity.business_lead_activity;
				result['business_lead_activity_step_wise'] = responseActivity;

				result['insider_poll_custom_url'] = (responseActivity && responseActivity.insider_poll_details && responseActivity.insider_poll_details.custom_url) ? responseActivity.insider_poll_details.custom_url : "";

				result['main_pocial_id'] = POCIAL_ID;

				/** Sample file lead excel url */
				result['sample_file_lead_excel_url'] = SAMPLE_FILE_LEAD_EXCEL_URL;

				/** followers and following count*/
				let followersAndFollowingCount = await getFollowingAndFollowersCount(userId);
				result['followers_count'] = (followersAndFollowingCount['followers_count']) ? followersAndFollowingCount['followers_count'] : 0;
				result['following_count'] = (followersAndFollowingCount['following_count']) ? followersAndFollowingCount['following_count'] : 0;

				result['lead_details'] = {
					submit_button_title: (result.leadDetails.length > 0 && result.leadDetails[0]['button_name']) ? result.leadDetails[0]['button_name'] : res.locals.settings["Lead.submit_button_title"],
					form_title: (result.leadDetails.length > 0 && result.leadDetails[0]['form_title']) ? result.leadDetails[0]['form_title'] : res.locals.settings["Lead.form_title"],
					creator_id: userId,
					lead_forms_id: leadFormsId,
				}
				delete result.leadDetails;

				/** Signature image include */
				result['signature_url'] = SIGNATURE_URL;

				/** Social reachout tooltip */
				let fromHomepageAiUser = (result && result.from_homepage_ai_user) ? (result.from_homepage_ai_user) : false;

				/** Only for from homepage user according condition */
				if (fromHomepageAiUser == true || fromHomepageAiUser == 'true') {
					result['tools_tips_educator_week_of_post'] = (result.tools_tips_educator_week_of_post) ? true : false;
					result['tools_tips_educator_calendar'] = (result.tools_tips_educator_calendar) ? true : false;
					result['view_your_week_of_social_post_popup'] = (result.view_your_week_of_social_post_popup) ? true : false;
				} else {
					result['tools_tips_educator_week_of_post'] = true;
					result['tools_tips_educator_calendar'] = true;
					result['view_your_week_of_social_post_popup'] = false;
				}

				result['ugc_gallery_url'] = UGC_GALLERY_FILE_URL;
				result['qr_code_image_url'] = QR_CODES_URL;
				result['close_announcement'] = (result.close_announcement) ? true : false;

				/** this is used for count onboarding navigation process */
				result['onboarding_process_count'] = onboardingCount;

				/** function for used to flag update after all campaign tab filled */
				aiCampaignAllThreeStepFlagUpdate(result);

				/** Send success response **/
				return {
					'status': STATUS_SUCCESS,
					'result': result,
					'check_user_already_voted': userWiseVoteCount,
					'options': options,
				};
			} else {
				/** Send success response **/
				return {
					'status': STATUS_ERROR,
					'result': false,
					'check_user_already_voted': 0,
					'options': options,
				};
			}
		} catch (err) {
			console.log(err);
			let response = {
				status: STATUS_ERROR,
				options: options,
				message: res.__("system.something_going_wrong_please_try_again")
			};
			return response;
		}
	} else {
		return {
			'status': STATUS_ERROR,
			'req': req,
			'options': options,
			'message': res.__("system.something_going_wrong_please_try_again")
		};
	}
}; // end getUserDetailBySlug()


/**
 * Function to get date in any format with utc format
 *
 * @param date 		as	Date object
 * @param format 	as 	Date format
 *
 * @return date string
 */
getTimeAgo = (dateString) => {
	var rightNow = new Date();
	var then = new Date(dateString);

	var diff = rightNow - then;

	var second = 1000,
		minute = second * 60,
		hour = minute * 60,
		day = hour * 24;

	if (isNaN(diff) || diff < 0) {
		return ""; // return blank string if unknown
	}

	if (diff < second * 2) {
		return "right now";
	}

	if (diff < minute) {
		return Math.floor(diff / second) + " seconds ago";
	}

	if (diff < minute * 2) {
		return "1 minute ago";
	}

	if (diff < hour) {
		return Math.floor(diff / minute) + " minutes ago";
	}

	if (diff < hour * 2) {
		return "1 hour ago";
	}

	if (diff < day) { return Math.floor(diff / hour) + " hours ago"; } if (diff > day && diff < day * 2) {
		return "yesterday";
	}

	if (diff < day * 365) {
		return Math.floor(diff / day) + " days ago";
	} else {
		return "over a year ago";
	}
} //End getTimeAgo();

/**
Function for use to calculate age of year	
**/
calculateAge = (dateofbirth) => {

	var array = new Array();
	array = dateofbirth.split('-');

	let birth_day = array[0];
	let birth_month = array[1];
	let birth_year = array[2];

	today_date = new Date();
	today_year = today_date.getFullYear();
	today_month = today_date.getMonth();
	today_day = today_date.getDate();
	age = today_year - birth_year;

	if (today_month < (birth_month - 1)) {
		age--;
	}
	if (((birth_month - 1) == today_month) && (today_day < birth_day)) {
		age--;
	}
	return age;
} //End calculateAge();

consoleLog = (valueconsole) => {
	console.log(util.inspect(valueconsole, false, null, true /* enable colors */))
}

/**
 * Function used to convert 
 *
 * @param options	As data in Object
 *
 * @return json
 */
convertMultipartReqBody = function (req, res, next) {
	convertMultipartFormData(req, res).then(() => {
		return next();
	})
} //End convertMultipartReqBody();

/**
 *  Function to get post data by slug (Updated: uses async/await for DB operations)
 *
 * @param req      As Request Data
 * @param res      As Response Data
 * @param postSlug as cms page slug
 *
 * @return object
 */
getPostDataBySlug = async (req, res, postSlug) => {
	// Return error if postSlug is not provided
	if (!postSlug || postSlug == "") {
		return {
			status: STATUS_ERROR,
			req: req,
			message: res.__("admin.system.invalid_access")
		};
	}
	try {
		// Get details using async/await
		const postCollection = db.collection(TABLE_POSTS);
		const postData = await postCollection.findOne({ slug: postSlug });

		if (postData) {
			// Send success response
			return {
				status: STATUS_SUCCESS,
				result: postData ? postData : {}
			};
		} else {
			// Send error response if post not found
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}
	} catch (e) {
		// Send error response on exception
		return {
			status: STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
}; //End getPostDataBySlug();

/** 
 * Get all users ids (Updated: uses async/await for DB operations)
 * 
 * @param req   As Request Data
 * @param res   As Response Data
 * @return      Promise resolving to array of user ids
 */
getAllUsersIds = async (req, res) => {
	try {
		const usersCollection = db.collection(TABLE_USERS);
		// Use async/await to get distinct user ids with the given conditions
		const userIds = await usersCollection.distinct("_id", {
			is_deleted: NOT_DELETED,
			user_role_id: FRONT_ADMIN_ROLE_ID,
		});
		return userIds;
	} catch (err) {
		// Log error and return empty array on failure
		consoleLog(req + '' + res);
		return [];
	}
} //End getAllUsersIds();


/**
 * Function to send Email broadcast email
 *
 * @param to		As Recipient Email Address
 * @param repArray  As Response Array
 * @param action  	As Email Action
 *
 * @return array
 */
sendMailNewsletterBroadcast = async (req, res, options) => {
	try {
		let to = (options && options.to) ? options.to : "";
		let repArray = (options && options.rep_array) ? options.rep_array : "";
		let action = (options && options.action) ? options.action : "";
		let attachments = (options && options.attachments) ? options.attachments : "";
		let subject = (options && options.subject) ? options.subject : "";

		let userEmail = res.locals.settings["Email.user_email"];
		let emailHost = res.locals.settings["Email.host"];
		let emailPassword = res.locals.settings["Email.password"];
		let emailUserName = res.locals.settings["Email.user_name"];
		let emailPort = res.locals.settings["Email.port"];
		const nodemailer = require("nodemailer");

		const transporter = nodemailer.createTransport({
			host: emailHost,
			port: emailPort,
			secure: (emailPort == SMTP_SECURE_PORT) ? true : false, // true for SMTP_SECURE_PORT, false for other ports
			auth: {
				user: userEmail, // generated ethereal user
				pass: emailPassword // generated ethereal password
			},
			tls: {
				rejectUnauthorized: true
			}
		});

		/** Get send email newsletter template details using async/await **/
		const sendEmailNewsletter = db.collection(TABLE_SEND_EMAIL_NEWSLETTER);
		let emailTemplateResult = await sendEmailNewsletter.findOne(
			{ action: action },
			{ projection: { _id: 1, name: 1, subject: 1, body: 1 } }
		);

		if (emailTemplateResult) {
			let actionOptions = EMAIL_TEMPLATE_CONSTANTS.toString().split(",");
			let body = emailTemplateResult.body;
			subject = (subject) ? subject : emailTemplateResult.subject;
			actionOptions.forEach((value, key) => {
				body = body.replace(RegExp('{' + value + '}', 'g'), repArray[key]);
				subject = subject.replace(RegExp('{' + value + '}', 'g'), repArray[key]);
			});

			let html = body;
			html = html.concat('<img src="{IMAGE_SCRIPT_LINK}" style="width: 0px; height: 0px;">')
			html = html.replace(RegExp('{CURRENT_YEAR}', 'g'), new Date().getFullYear());
			html = html.replace(RegExp('{IMAGE_SCRIPT_LINK}', 'g'), WEBSITE_VIEW_USER_OPEN_EMAIL_LINK + emailTemplateResult._id);
			html = html.replace(RegExp('{SUBSCRIBED_LINK}', 'g'), WEBSITE_USER_SUBSCRIBED_EMAIL_LINK + options.email_newsletter_subscribed_enc_id);

			let mailOptions = {
				from: emailUserName,
				to: to,
				subject: subject,
				html: html
			};

			/** Send attachment if present **/
			if (attachments) {
				mailOptions["attachments"] = {
					path: attachments
				};
			}

			/** Send email using async/await and log result **/
			let sendError = null;
			try {
				await transporter.sendMail(mailOptions);
			} catch (error) {
				sendError = error;
				console.error('error');
				console.error(error);
			}

			/** Save email logs details using async/await **/
			const email_logs = db.collection(TABLE_EMAIL_LOGS);
			mailOptions.error = sendError;
			mailOptions.created = getUtcDate();
			await email_logs.insertOne(mailOptions);

		} else {
			// Log error if template not found
			consoleLog('Error in email template');
		}
	} catch (e) {
		consoleLog("email error in sendMail function")
		consoleLog(e)
	}
}//end sendMailNewsletterBroadcast();

/** 
 * Notification type save 
 */
saveNotificationSettingsSave = async (saveOptionsData) => {
	try {
		let userId = (saveOptionsData.user_id) ? newObjectIdDefault(saveOptionsData.user_id) : "";
		let userOnOffStatus = (saveOptionsData.on_off_status) ? saveOptionsData.on_off_status : "";
		let realTime = (saveOptionsData.real_time) ? saveOptionsData.real_time : [];
		let dailyDigest = (saveOptionsData.daily_digest) ? saveOptionsData.daily_digest : [];
		let weeklyDigest = (saveOptionsData.weekly_digest) ? saveOptionsData.weekly_digest : [];
		let monthlyDigest = (saveOptionsData.monthly_digest) ? saveOptionsData.monthly_digest : [];

		// Get the collection for notification user settings
		const notificationUserSettings = db.collection(TABLE_NOTIFICATION_USER_SETTINGS);

		// Update or insert notification user settings using async/await
		await notificationUserSettings.updateOne(
			{ 'user_id': userId },
			{
				$set: {
					'on_off_status': Number(userOnOffStatus),
					'real_time': realTime,
					'daily_digest': dailyDigest,
					'weekly_digest': weeklyDigest,
					'monthly_digest': monthlyDigest,
					'modified': getUtcDate()
				},
				$setOnInsert: {
					'created': getUtcDate(),
					'daily_digest_date': getUtcDate(),
					'monthly_digest_date': getUtcDate(),
					'weekly_digest_date': getUtcDate(),
				}
			},
			{ upsert: true }
		);

		// Return resolved promise for compatibility
		return;
	} catch (error) {
		console.error("Error in saveNotificationSettingsSave:", error);
		// Optionally, you can throw or handle the error as needed
		return;
	}
} //End saveNotificationSettingsSave();

/**
 * Function to upload image from URL to S3 bucket
 **/
uploadImageFromAWSBucketUrl = (awsOptions) => {
	return new Promise(async (resolve) => {
		try {
			let imageUrl = (awsOptions.image_url) ? awsOptions.image_url : "";
			let targetFolder = (awsOptions.target_folder) ? awsOptions.target_folder : "";
			let instagramImageSize = (awsOptions.instagram_image_size) ? awsOptions.instagram_image_size : false;
			let facebookImageSize = (awsOptions.facebook_image_size) ? awsOptions.facebook_image_size : false;

			// Extract the domain
			// const domain = imageUrl.split('//')[1].split('/')[0];
			// let protocolSite = await checkProtocol(domain);

			// imageUrl = imageUrl.trim();
			// imageUrl = imageUrl.replace(/^https?:\/\//, protocolSite);
			// imageUrl = protocolSite;

			const fileType = require('file-type');

			if (imageUrl && targetFolder) {
				const response = await axios.get(imageUrl, {
					responseType: 'arraybuffer',
					headers: {
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
					}
				});

				let data = Buffer.from(response.data, 'binary');

				let type = await fileType.fromBuffer(data);


				/** Resize the image to DEFAULT_INSTAGRAM_WIDTHxDEFAULT_INSTAGRAM_HEIGHT using Sharp instagram
				  * Set the height and width to DEFAULT_INSTAGRAM_WIDTHxDEFAULT_INSTAGRAM_HEIGHT
				  */
				if (instagramImageSize == true) {
					data = await sharp(response.data).resize(DEFAULT_INSTAGRAM_WIDTH, DEFAULT_INSTAGRAM_HEIGHT).toBuffer();
				}

				/** Resize the image to DEFAULT_FACEBOOK_WIDTHxDEFAULT_FACEBOOK_HEIGHT using Sharp */
				if (facebookImageSize == true) {
					data = await sharp(response.data).resize(DEFAULT_FACEBOOK_WIDTH, DEFAULT_FACEBOOK_HEIGHT).toBuffer();
				}

				const params = {
					Bucket: process.env.AWS_BUCKET_NAME,
					Key: S3_BUCKET_UPLOAD_PATH + targetFolder,
					Body: data,
					ContentType: type.mime || 'image/jpeg'
				};
				await s3.upload(params).promise();
				return resolve({ 'status': STATUS_SUCCESS });
			} else {
				return resolve({ 'status': STATUS_SUCCESS });
			}
		} catch (error) {
			//console.error('Error uploading image:', error);
			return resolve({ 'status': STATUS_ERROR });
		}
	});
}; //End uploadImageFromAWSBucketUrl();

/**
* Function for use to download image
**/
downloadImageToUrl = async (res, req, responseImage) => {
	return new Promise(async (resolve) => {
		let imageUrl = (responseImage.url) ? responseImage.url : "";
		let destUrl = (responseImage.dest) ? responseImage.dest : "";
		let instagramImageSize = (responseImage.instagram_image_size) ? responseImage.instagram_image_size : false;
		let facebookImageSize = (responseImage.facebook_image_size) ? responseImage.facebook_image_size : false;

		if (imageUrl != '' && destUrl != '') {
			/** check mime type*/
			let imageExtension = getUrlExtension(imageUrl);

			if (ALLOWED_IMAGE_URL_WISE_EXTENSIONS.indexOf(imageExtension) == -1) {
				/** Send error response **/
				let response = {
					status: STATUS_ERROR,
					req: req,
					fileName: "",
					message: "You are using invalid image URL.",
				};
				resolve(response);
			} else {

				let imageName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
				imageName = imageName.substring(0, imageName.indexOf('.'));

				/** Create new folder of this month **/
				const today = new Date();
				let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';

				if (!UPLOAD_TO_S3) {
					createFolder(destUrl + newFolder);
				}

				let randomNumber = Math.floor(Math.random() * 99);
				let newFileName = newFolder + Date.now() + randomNumber + '-' + changeFileName(imageName + '.' + imageExtension);
				let uploadedFile = destUrl + newFileName;

				/*** function for use to S3 aws upload file */
				if (UPLOAD_TO_S3) {
					let targetFolder = destUrl.split('/') // create upload folder name for bucket
					targetFolder = targetFolder[targetFolder.length - 2];

					let awsOptionData = {
						'image_url': imageUrl,
						'target_folder': targetFolder + '/' + newFileName,
						'instagram_image_size': instagramImageSize,
						'facebook_image_size': facebookImageSize,
					}
					/** Function for use to direct upload to aws data */
					uploadImageFromAWSBucketUrl(awsOptionData).then((imageRes) => {

						if (imageRes.status == STATUS_SUCCESS) {
							let response = {
								'status': STATUS_SUCCESS,
								'fileName': newFileName,
								'imageExtension': imageExtension,
								'resfileName': "",
								'message': "",
							};
							resolve(response);
						} else {
							let response = {
								'status': STATUS_ERROR,
								'fileName': "",
								'imageExtension': "",
								'resfileName': "",
								'message': "You are using invalid image URL."
							};
							resolve(response);
						}
					});
				} else {

					let optionsImage = {
						url: imageUrl,
						dest: uploadedFile,   // will be saved to /path/to/dest/photo
						extractFilename: false,
						headers: {
							"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						}
					}

					imageDownloader.image(optionsImage).then(({ filename }) => {
						let response = {
							'status': STATUS_SUCCESS,
							'fileName': newFileName,
							'imageExtension': imageExtension,
							'resfileName': filename,
							'message': "",
						};
						resolve(response);
					}).catch((err) => {
						let response = {
							'status': STATUS_ERROR,
							'fileName': "",
							'imageExtension': "",
							'resfileName': "",
							'message': "You are using invalid image URL.",
						};
						resolve(response);
					});
				}
			}
		} else {
			let response = {
				status: STATUS_ERROR,
				fileName: "",
				message: "You are using invalid image URL.",
			};
			resolve(response);
		}
	});
}; //End downloadImageToUrl();


/**
 * Update user data by email using async/await.
 * @param {String} email - The email of the user to update.
 * @param {Object} userOptions - The fields to update.
 * @returns {Promise<Object>} - The result of the update operation.
 */
updateUserData = async (email, userOptions) => {
	const users = db.collection(TABLE_USERS);
	try {
		// Update user document by email (case-insensitive) with provided options
		const result = await users.updateOne(
			{ email: { $regex: "^" + email + "$", $options: "i" } },
			{ $set: userOptions }
		);
		return result;
	} catch (err) {
		// Log or handle error as needed
		throw err;
	}
} //End updateUserData();


/** 
 * Update user data according to user id using async/await.
 * @param {String|ObjectId} userId - The user id to update.
 * @param {Object} userOptions - The fields to update.
 * @returns {Promise<Object>} - The result of the update operation.
 */
updateUserRecordsIdAccording = async (userId, userOptions) => {
	const users = db.collection(TABLE_USERS);
	try {
		// Update user document by _id with provided options
		const result = await users.updateOne(
			{ _id: newObjectIdDefault(userId) },
			{ $set: userOptions }
		);
		return result;
	} catch (err) {
		// Log or handle error as needed
		throw err;
	}
} //End updateUserRecordsIdAccording();

/** Send notify email send **/
sendEmailNotify = (req, res, notifyOptions) => {
	return new Promise(resolve => {
		let stageLevel = (notifyOptions.stage_level) ? notifyOptions.stage_level : "";
		let creatorFullName = (notifyOptions.creator_full_name) ? notifyOptions.creator_full_name : "";
		let leadTitleName = (notifyOptions.lead_title_name) ? notifyOptions.lead_title_name : "";
		let allNotifyEmail = (notifyOptions.notify_email) ? notifyOptions.notify_email : "";

		if (allNotifyEmail.length > 0) {
			async.forEachOf(allNotifyEmail, (record, index, callback) => {
				let recordEmail = (record.value) ? record.value : "";
				let emailOptions = {
					index: index,
					to: recordEmail,
					action: "notify_leads_email",
					rep_array: [DEAR_HI_CONSTANT, recordEmail, leadTitleName, creatorFullName, stageLevel]
				};
				sendMail(req, res, emailOptions);

				callback(null);
			}, err => {
				return resolve(err)
			});
		} else {
			return resolve()
		}
	});
} //End sendEmailNotify();

/***
 * Leads generation level calculation
 * Updated to use async/await for all query functions with proper comments.
 */
leadsStagesLevel = async (req, res, stageOptions) => {
	let leadsLevel = INTRODUCTION_LEVEL;

	const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
	const users = db.collection(TABLE_USERS);
	const leadsImportLogsCollection = db.collection(TABLE_LEADS_IMPORT_LOGS);

	let emailUser = (stageOptions.email) ? stageOptions.email : "";
	let creatorId = (stageOptions.creator_id) ? newObjectIdDefault(stageOptions.creator_id) : "";
	let leadFormsId = (stageOptions.lead_forms_id) ? newObjectIdDefault(stageOptions.lead_forms_id) : "";
	let creatorFullName = (stageOptions.creator_full_name) ? stageOptions.creator_full_name : "";
	let leadTitleName = (stageOptions.lead_name) ? stageOptions.lead_name : "";
	let allNotifyEmail = (stageOptions.notify_email) ? stageOptions.notify_email : "";
	let userCreatedResult = (stageOptions.user_created_result) ? stageOptions.user_created_result : "";
	let hybridLead = (stageOptions.hybrid_lead) ? stageOptions.hybrid_lead : "";

	/*** Excel wise variable declare */
	let leadsImportLogId = (stageOptions.leads_import_log_id) ? stageOptions.leads_import_log_id : "";
	let signupLeadFormsId = (stageOptions.lead_forms_subscriber_id) ? newObjectIdDefault(stageOptions.lead_forms_subscriber_id) : "";
	let csvImportId = (stageOptions.leads_import_id) ? newObjectIdDefault(stageOptions.leads_import_id) : "";
	let csvImportSlug = (stageOptions.leads_import_slug) ? stageOptions.leads_import_slug : "";
	let sendWelcomeEmail = (stageOptions.send_welcome_email) ? stageOptions.send_welcome_email : "";
	let alreadySendWelcomeEmailCount = (stageOptions.already_send_welcome_email_count) ? stageOptions.already_send_welcome_email_count : 0;
	let excelFileName = (stageOptions.excel_file_name) ? stageOptions.excel_file_name : "";

	/** Complete profile after submit profile*/
	let completeProfilePage = (req.body.complete_profile) ? req.body.complete_profile : "";

	/** blocked reward page submit user profile */
	let blockedRewardPageSubmit = (req.body.block_reward_page_submit) ? req.body.block_reward_page_submit : false;
	blockedRewardPageSubmit = (blockedRewardPageSubmit == 'true' || blockedRewardPageSubmit == true) ? true : false;

	/** Generate unsubscriber validate string  */
	let unsubscriberValidateGenerateString = newsletterSubscriberEncId(emailUser);
	req.body.welcome_email_unsubscribe_validate_string = unsubscriberValidateGenerateString;

	try {
		// Find the lead form subscriber by email, creator, and lead form id
		const widgetData = await signupLeadForms.findOne({
			'email': { $regex: "^" + emailUser + "$", $options: "i" },
			'creator_id': creatorId,
			'lead_forms_id': leadFormsId,
		}) || {};

		/** Start Audience entries data (leadsStagesLevel) */
		let optionLogsData = {
			'user_id': creatorId,
			'lead_forms_id': leadFormsId,
			'title': leadTitleName,
			'lead_import_id': csvImportId,
			'excel_file_name': excelFileName
		};
		submitForAudienceEntries(req, res, optionLogsData);
		/** End Audience entries data */

		if (Object.keys(widgetData).length > 0) {
			let leadFormsSubscriberId = (widgetData._id) ? widgetData._id : "";
			let fullName = (widgetData.full_name) ? true : false;
			let email = (widgetData.email) ? true : false;
			let gender = (widgetData.gender) ? true : false;
			let mobileNumber = (widgetData.mobile) ? true : false;
			let dob = (widgetData.dob) ? true : false;
			let zipCode = (widgetData.zip) ? true : false;
			let alreadyValidateString = (widgetData.validate_string) ? widgetData.validate_string : "";
			let welcomeEmailUnsubscribed = (widgetData.welcome_email_unsubscribed) ? widgetData.welcome_email_unsubscribed : false;
			req.body.welcome_email_unsubscribed_flag = welcomeEmailUnsubscribed;

			let widgetPassword = (widgetData.password) ? widgetData.password : "";
			let widgetDataUserName = (widgetData.slug) ? widgetData.slug : "";

			/** If user email, username and password comes then that user has to be created. */
			if (emailUser && widgetPassword && widgetDataUserName) {
				widgetData.first_name = (widgetData && widgetData.first_name) ? widgetData.first_name : widgetDataUserName;
				widgetData.last_name = (widgetData && widgetData.last_name) ? widgetData.last_name : widgetDataUserName;
				fullName = true;
				blockedRewardPageSubmit = true;
				completeProfilePage = COMPLETE_PROFILE_AFTER_COMPLETE_LEAD_PROFILE_SUBMIT;
			}

			let submitType = (widgetData.submit_type) ? widgetData.submit_type : "";

			// Determine lead level based on available fields
			if (email && !fullName && !mobileNumber && !gender && !dob && !zipCode) {
				leadsLevel = INTRODUCTION_LEVEL;
			} else if (fullName && email && mobileNumber && gender && dob && zipCode) {
				leadsLevel = HOT_LEADS_LEVEL;
			} else {
				leadsLevel = GROWTH_LEVEL;
			}

			let currentTimeStamp = new Date().getTime();
			let validateString = crypto.createHash('md5').update(currentTimeStamp + emailUser).digest("hex");
			validateString = (completeProfilePage == '' && alreadyValidateString) ? alreadyValidateString : validateString;

			// Update signup lead stage and validate string
			await signupLeadForms.updateOne(
				{ _id: newObjectIdDefault(widgetData._id) },
				{ $set: { 'stage_level': leadsLevel, 'validate_string': validateString } }
			);

			// Update all stage email wise
			if (submitType == LEAD_IMPORT_SUBMIT_TYPE_SUBSCRIBER) {
				stageOptions['stage_level'] = leadsLevel;
				stageOptions['welcome_email_unsubscribe_validate_string'] = unsubscriberValidateGenerateString;
				updateAllLeadsAllSubscriberExcelImportWise(stageOptions);
			} else {
				await signupLeadForms.updateMany(
					{ email: { $regex: "^" + widgetData.email + "$", $options: "i" } },
					{ $set: { 'welcome_email_unsubscribe_validate_string': unsubscriberValidateGenerateString, 'stage_level': leadsLevel } }
				);
			}

			// Send notification email to notify users
			if (completeProfilePage == '') {
				let notifyOptions = {
					'lead_forms_id': leadFormsId,
					'stage_level': STAGE_LEVEL[leadsLevel],
					'creator_full_name': creatorFullName,
					'lead_title_name': leadTitleName,
					'notify_email': allNotifyEmail,
				};
				await sendEmailNotify(req, res, notifyOptions);
			}

			// Send notification for lead subscriber created
			let notificationMessageParams = [leadTitleName, creatorFullName, STAGE_LEVEL[leadsLevel], emailUser];
			let notificationOptions = {
				notification_data: {
					notification_type: NOTIFICATION_SUBSCRIBER_CREATOR,
					message_params: notificationMessageParams,
					parent_table_id: creatorId,
					user_id: creatorId,
					user_ids: [creatorId],
					user_role_id: FRONT_ADMIN_ROLE_ID,
					role_id: FRONT_ADMIN_ROLE_ID,
					extra_parameters: {
						user_id: newObjectIdDefault(creatorId),
					}
				}
			};
			await insertNotifications(req, res, notificationOptions);

			/**
			 * This condition is used to hot, growth and introduction wise send mail and data save
			 * If the user comes from blocked rewards page then that user has to fill it completely.(blockedRewardPageSubmit)
			 */
			if ((blockedRewardPageSubmit || leadsLevel == HOT_LEADS_LEVEL) && completeProfilePage != '') {
				let dobDateGenerate = "";
				if (widgetData.dob) {
					const dobDate = moment(widgetData.dob);
					dobDateGenerate = dobDate.format(DATE_FORMAT_SAVE);
				}

				req.body.id = widgetData._id;
				req.body.first_name = widgetData.first_name;
				req.body.last_name = widgetData.last_name;
				req.body.email = widgetData.email;
				req.body.password = widgetData.password;
				req.body.request_from = REQUEST_FROM_LEAD;
				req.body.api_type = REQUEST_FROM_LEAD;
				req.body.gender = (widgetData.gender) ? Number(widgetData.gender) : "";
				req.body.mobile_code = widgetData.mobile_code;
				req.body.mobile = widgetData.mobile;
				req.body.mobile_number = widgetData.mobile_number;
				req.body.dob = dobDateGenerate;
				req.body.zip = (widgetData.zip) ? (widgetData.zip) : "";
				req.body.age = Number(widgetData.age);
				req.body.slug = widgetData.slug;
				req.body.user_name = widgetData.slug;

				// Check if user already exists
				let alreadyUser = await users.findOne(
					{ 'email': { $regex: "^" + emailUser + "$", $options: "i" }, 'signup_attempts': DEFAULT_ONE },
					{ projection: { _id: 1, full_name: 1 } }
				);
				let linkLogin = FRONT_URL + "pocial/login";

				if (alreadyUser) {
					req.body.id = alreadyUser._id;

					// Edit user functionality
					await userService.editUser(req, res, '');

					let emailOptionsData = {
						'creator_id': creatorId,
						'email_send_to': (req.body.email) ? (req.body.email).toLowerCase() : "",
						'reward_send_user_id': req.body.id,
						'link_url': linkLogin,
						'user_created_result': userCreatedResult,
						'lead_forms_id': leadFormsId,
					};
					// await completeProfileMailSend(req, res, emailOptionsData);

					// Update prime user id for lead and send welcome mail
					let optionPrimeUser = {
						"lead_forms_subscriber_id": leadFormsSubscriberId,
						"user_id": alreadyUser._id,
					};
					await primeUserIdUdateforLead(optionPrimeUser);
					emailOptionsData['link_url'] = FRONT_URL + "complete-profile/create/" + validateString;
					emailOptionsData['link_blocked_wallet_url'] = FRONT_URL + "my-wallet/wallet-listing/" + validateString;
					await welcomeMailSend(req, res, emailOptionsData);
					return;
				} else {
					// Add new user
					let response = await userService.addUser(req, res, '');

					// Assign earned rewards to user
					let lastInsertId = response.result.lastInsertId;
					let emailOptionsData = {
						'creator_id': creatorId,
						'email_send_to': (req.body.email) ? (req.body.email).toLowerCase() : "",
						'reward_send_user_id': lastInsertId,
						'link_url': linkLogin,
						'user_created_result': userCreatedResult,
						'lead_forms_id': leadFormsId,
					};
					// await completeProfileMailSend(req, res, emailOptionsData);

					// Update prime user id for lead and send welcome mail
					let optionPrimeUser = {
						"lead_forms_subscriber_id": leadFormsSubscriberId,
						"user_id": lastInsertId,
					};
					await primeUserIdUdateforLead(optionPrimeUser);
					emailOptionsData['link_url'] = FRONT_URL + "complete-profile/create/" + validateString;
					emailOptionsData['link_blocked_wallet_url'] = FRONT_URL + "my-wallet/wallet-listing/" + validateString;
					await welcomeMailSend(req, res, emailOptionsData);
					return;
				}
			} else {
				// Insert log for leads subscriber entries
				await db.collection(TABLE_LEADS_SUBSCRIBER_ENTRIES_LOGS).insertOne({
					'lead_forms_subscriber_id': signupLeadFormsId,
					'leads_import_log_id': leadsImportLogId,
					'leads_import_id': csvImportId,
					'leads_import_slug': csvImportSlug,
					'creator_id': creatorId,
					'lead_forms_id': leadFormsId,
					'submit_type': submitType,
					'creator_full_name': creatorFullName,
					'email': emailUser,
					'excel_name': excelFileName,
					'send_welcome_email': (submitType == LEAD_IMPORT_SUBMIT_TYPE_SUBSCRIBER) ? sendWelcomeEmail : IMPORT_LEADS_WELCOME_EMAIL_YES_STATUS,
					'created': getUtcDate()
				});

				// Prepare links for complete profile and blocked wallet
				let linkFullDatafillUp = FRONT_URL + "complete-profile/create/" + validateString;
				let linkBlockedWallet = FRONT_URL + "my-wallet/wallet-listing/" + validateString;

				// Prepare email options for welcome mail
				let emailOptionsData = {
					'creator_id': creatorId,
					'email_send_to': emailUser,
					'reward_send_user_id': "",
					'link_url': linkFullDatafillUp,
					'link_blocked_wallet_url': linkBlockedWallet,
					'user_created_result': userCreatedResult,
					'lead_forms_id': leadFormsId,
				};

				/*** Submit type excel after yes/no welcome email */
				if (submitType == LEAD_IMPORT_SUBMIT_TYPE_SUBSCRIBER) {
					// Update excel-wise welcome email send data keys (yes/no)
					await leadsImportLogsCollection.updateOne(
						{ _id: newObjectIdDefault(leadsImportLogId) },
						{ $set: { 'lead_forms_subscriber_id': signupLeadFormsId, 'send_welcome_email': sendWelcomeEmail } }
					);

					if (sendWelcomeEmail == IMPORT_LEADS_WELCOME_EMAIL_YES_STATUS && alreadySendWelcomeEmailCount == 0) {
						// Update status for all sent emails and send welcome mail
						updateStatusAllSendEmailChange(emailUser, leadFormsId);
						await welcomeMailSend(req, res, emailOptionsData);
					}
				} else {
					await welcomeMailSend(req, res, emailOptionsData);
				}
				return;
			}
		}
	} catch (err) {
		// Log or handle error as needed
		throw err;
	}
}; // End leadsStagesLevel()

/**
 * Function to send Email drag drop email using async/await
 *
 * @param req      Request object
 * @param res      Response object
 * @param options  Object containing to, subject, body, etc.
 *
 * @return void
 */
sendMailDragDrop = async (req, res, options) => {
	try {
		let to = (options && options.to) ? options.to : "";
		let subject = (options && options.subject) ? options.subject : "";
		let html = (options && options.body) ? options.body : "";

		let userEmail = res.locals.settings["Email.user_email"];
		let emailHost = res.locals.settings["Email.host"];
		let emailPassword = res.locals.settings["Email.password"];
		let emailUserName = res.locals.settings["Email.user_name"];
		let emailPort = res.locals.settings["Email.port"];
		const nodemailer = require("nodemailer");

		const transporter = nodemailer.createTransport({
			host: emailHost,
			port: emailPort,
			secure: (emailPort == SMTP_SECURE_PORT) ? true : false, // true for SMTP_SECURE_PORT, false for other ports
			auth: {
				user: userEmail,
				pass: emailPassword
			},
			tls: {
				rejectUnauthorized: true
			}
		});

		let mailOptions = {
			from: emailUserName,
			to: to,
			subject: subject,
			html: html
		};

		let sendError = null;
		try {
			// Send email using async/await
			await transporter.sendMail(mailOptions);
		} catch (error) {
			sendError = error;
			console.error('error');
			console.error(error);
		}

		// Save email logs details using async/await
		const email_logs = db.collection(TABLE_EMAIL_LOGS);
		mailOptions.error = sendError;
		mailOptions.created = getUtcDate();
		await email_logs.insertOne(mailOptions);

	} catch (e) {
		consoleLog("email error in sendMailDragDrop function");
		consoleLog(e + '' + req);
	}
} // end sendMailDragDrop();

/**
 * Get user ID by email using async/await.
 * @param {Object} req - Request object.
 * @param {Object} res - Response object.
 * @param {String} email - Email to search for.
 * @returns {Promise<ObjectId>} - Returns user _id if found, otherwise a new ObjectId.
 */
getEmailWiseUserIdGet = async (req, res, email) => {
	try {
		const user = db.collection(TABLE_USERS);
		// Find user by email (case-insensitive)
		const emailUserData = await user.findOne(
			{ email: { $regex: '^' + email + '$', $options: 'i' } },
			{ projection: { _id: 1 } }
		) || {};

		// Return user _id if found, otherwise return a new ObjectId
		if (Object.keys(emailUserData).length > 0) {
			return emailUserData._id;
		} else {
			return newObjectIdDefault();
		}
	} catch (err) {
		// In case of error, return a new ObjectId
		return newObjectIdDefault();
	}
}; //End getEmailWiseUserIdGet();

/**
 * Async function for find user by email
 *
 * @param req As Request Data
 * @param res As Response Data
 * @param options Object containing email and user_id
 *
 * @return json
 */
findUserByEmail = async (req, res, options) => {
	let userId = (options.user_id) ? options.user_id : "";
	let email = (options.email) ? options.email : "";

	const user = db.collection(TABLE_USERS);
	let response = {};

	// Build query conditions for finding user by email or temp_email, not deleted, and correct account type
	let conditions = {
		'is_deleted': NOT_DELETED,
		'account_type': { $in: [NORMAL_USER_ACCOUNT_TYPE, BUSSINESS_USER_ACCOUNT_TYPE] },
		$or: [
			{ email: { $regex: "^" + email + "$", $options: "i" } },
			{ temp_email: { $regex: "^" + email + "$", $options: "i" } },
		]
	};

	// Exclude the user with userId if provided
	if (userId != "") {
		conditions["_id"] = { $ne: newObjectIdDefault(userId) };
	}

	try {
		// Find one user matching the conditions
		const emailData = await user.findOne(conditions, { projection: { _id: 1 } }) || {};
		if (Object.keys(emailData).length > 0) {
			response = {
				status: STATUS_SUCCESS,
				result: emailData,
			};
		} else {
			response = {
				status: STATUS_ERROR,
				result: emailData,
			};
		}
		return response;
	} catch (err) {
		// Handle error and return error response
		return {
			status: STATUS_ERROR,
			result: {},
			error: err
		};
	}
} //End findUserByEmail();

/**
 * Function for find user by mobile number
 *
 * @param value As mobile number
 * @param req As Request Data
 *
 * @return json
 */
findUserByMobile = (req, res, options) => {
	return new Promise(resolve => {
		response = {
			status: STATUS_ERROR,
			result: {},
			req: req,
			res: res,
			options: options
		};
		return resolve(response);
	});
} //End findUserByMobile();

/**
 * Function for already username 
 *
 * @param value As mobile number
 * @param req As Request Data
 *
 * @return json
 */
findUserSlug = (async (req, res, options) => {
	let userName = (options.user_name) ? options.user_name : "";
	let userId = (options.user_id) ? options.user_id : "";
	let email = (options.email) ? options.email : "";

	if (userName != '') {
		const user = db.collection(TABLE_USERS);
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		/** get not equal id */
		let mainUserData = await user.findOne({ email: { $regex: '^' + email + '$', $options: 'i' } }, { projection: { _id: 1, email: 1 } });
		let mainSignupLeadId = await signupLeadForms.distinct("_id", { email: { $regex: '^' + email + '$', $options: 'i' } });

		let mainUserDataId = (mainUserData) ? mainUserData._id : MONGO_ID;

		let userCondition = {
			$or: [
				{ slug: new RegExp(["^", userName, "$"].join(""), "i") },
				{ email: new RegExp(["^", userName, "$"].join(""), "i") },
			],
			_id: { $ne: newObjectIdDefault(mainUserDataId) }
		}

		let signupLeadCondition = {
			slug: new RegExp(["^", userName, "$"].join(""), "i"),
			_id: { $nin: mainSignupLeadId },
			stage_level: { $ne: HOT_LEADS_LEVEL }
		}

		/***edit wise condition data*/
		if (userId != '') {
			userCondition['_id'] = { $ne: newObjectIdDefault(userId) }
		}

		/** users usrename(slug) unique condition*/
		let userData = await user.findOne(userCondition, { projection: { _id: 1, email: 1 } });

		/** lead form usrename(slug) unique condition*/
		let signupLead = await signupLeadForms.findOne(signupLeadCondition, { projection: { _id: 1, email: 1 } });

		return new Promise(resolve => {
			if (userData || signupLead) {
				response = {
					status: STATUS_SUCCESS,
					data: req + '' + res,
				};
				return resolve(response);
			} else {
				response = {
					status: STATUS_ERROR,
					data: req + '' + res,
				};
				return resolve(response);
			}
		});
	} else {
		return new Promise(resolve => {
			response = {
				status: STATUS_ERROR,
				data: req + '' + res,
			};
			return resolve(response);
		});
	}
}); //End findUserSlug();

/**
 * Function to add package (lead) rewards using async/await.
 *
 * @param {Object} packageRewardData - Data for the reward to be added.
 * @returns {Promise<ObjectId|null>} - The inserted reward's ID or null on failure.
 */
addPackageReward = async (packageRewardData) => {
	const rewards = db.collection(TABLE_REWARDS);

	try {
		// Generate slug for the reward
		let slugOptions = {
			title: packageRewardData.reward_text,
			table_name: TABLE_REWARDS,
			slug_field: "slug"
		};
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Prepare the data to insert
		let insertedData = {
			'user_id': newObjectIdDefault(packageRewardData.user_id),
			'reward_text': packageRewardData.reward_text ? packageRewardData.reward_text : "",
			'reward_sub_heading': packageRewardData.reward_sub_heading ? packageRewardData.reward_sub_heading : "",
			'graphic_type': packageRewardData.graphic_type ? packageRewardData.graphic_type : "",
			'graphic_image': packageRewardData.graphic_image ? packageRewardData.graphic_image : "",
			'url_desc': packageRewardData.url_desc ? packageRewardData.url_desc : "",
			'is_active': packageRewardData.is_active ? ACTIVE : DEACTIVE,
			'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
			'type': packageRewardData.type,
			'store_type_id': packageRewardData.store_type_id,
			'expiry_date': packageRewardData.expiry_date ? packageRewardData.expiry_date : "",
			'toogle_expiry_date': packageRewardData.toogle_expiry_date ? true : false,
			'is_deleted': NOT_DELETED,
			'ai_bot_reward': packageRewardData.ai_bot_reward ? true : false,
			'system_generate': (packageRewardData.system_generate || packageRewardData.ai_bot_reward) ? true : false,
			'created': getUtcDate(),
			'modified': getUtcDate(),
		};

		// If AI reward, add additional fields
		if (packageRewardData.type == REWARDS_AI_USER_ADD) {
			insertedData['first_ai_reward_generated'] = packageRewardData.first_ai_reward_generated ? packageRewardData.first_ai_reward_generated : "";
			insertedData['ai_campaign_chat_id'] = packageRewardData.ai_campaign_chat_id ? newObjectIdDefault(packageRewardData.ai_campaign_chat_id) : "";
			insertedData['ai_campaign_parent_id'] = packageRewardData.ai_campaign_parent_id ? newObjectIdDefault(packageRewardData.ai_campaign_parent_id) : "";
			insertedData['campaign_type'] = packageRewardData.campaign_type ? packageRewardData.campaign_type : "";
		}

		// Insert the reward document
		const insertResult = await rewards.insertOne(insertedData);
		const insertedId = insertResult.insertedId ? insertResult.insertedId : null;

		// Save AI data base structure if needed
		const userId = packageRewardData.user_id ? newObjectIdDefault(packageRewardData.user_id) : "";
		const rewardData = await fetchUserRewardSummary(null, null, userId);
		await saveCustomerBucketItems({
			'user_id': userId,
			'bucket_name': DATA_BUCKET_REWARD,
			'parent_bucket': PARENT_BUCKET_REWARD,
			'data': rewardData
		});

		return insertedId;
	} catch (error) {
		console.error("Error in addPackageReward:", error);
		return null;
	}
} // End addPackageReward();

/**
 * Function to check if a reward has already been assigned to a user by email and lead form.
 * Uses async/await for database queries.
 *
 * @param {String} emailUser - The user's email address.
 * @param {ObjectId|String} leadFormsId - The lead form ID.
 * @returns {Promise<String>} - STATUS_ERROR if already assigned, STATUS_SUCCESS otherwise.
 */
getAlreadyAssignRewardsUser = async (emailUser, leadFormsId) => {
	const users = db.collection(TABLE_USERS);
	const sentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

	try {
		// Find the user by email (case-insensitive)
		const user = await users.findOne(
			{ email: { $regex: "^" + emailUser + "$", $options: "i" } },
			{ projection: { _id: 1, full_name: 1 } }
		);

		if (user && user._id) {
			// Check if a reward has already been assigned to this user for the given lead form
			const assignedReward = await sentRewards.findOne(
				{ user_id: user._id, lead_forms_id: leadFormsId },
				{ projection: { _id: 1, full_name: 1 } }
			);

			if (assignedReward) {
				return STATUS_ERROR;
			} else {
				return STATUS_SUCCESS;
			}
		} else {
			// User not found, treat as not assigned
			return STATUS_SUCCESS;
		}
	} catch (error) {
		// Optionally log error here
		return STATUS_SUCCESS;
	}
}; // End getAlreadyAssignRewardsUser()


/** get file extension*/
getFileExtension = (filename) => {
	const extension = filename.split('.').pop();
	return extension;
} //End getFileExtension();

/**
 * Function to add an email template newsletter using async/await.
 * Handles all database queries with async/await and uses Promise.all for parallel operations.
 *
 * @param {Object} saveDataRecords - The data for the email template.
 * @returns {Promise<Object|null>} - The inserted template's id and action, or null on error.
 */
addEmailTemplateNewsletter = async (saveDataRecords) => {
	const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

	try {
		// Generate slug for the template action
		let slugOptions = {
			title: saveDataRecords.subject,
			table_name: TABLE_EMAIL_NEWSLETTER_TEMPLATE,
			slug_field: "action"
		};
		let slugResponse = await getDatabaseSlug(slugOptions);
		let emailAction = (slugResponse && slugResponse.title) ? slugResponse.title : "";

		let templateType = (saveDataRecords.template_type) ? saveDataRecords.template_type : EMAIL_TEMPLATE_ADMIN_TYPE;
		let aiBot = (saveDataRecords.ai_bot) ? saveDataRecords.ai_bot : false;
		let skipSmtp = (saveDataRecords.skip_smtp) ? saveDataRecords.skip_smtp : false;
		let imageManuallySaved = (saveDataRecords.image_manually_saved) ? saveDataRecords.image_manually_saved : false;
		let systemGenerate = (saveDataRecords.system_generate) ? saveDataRecords.system_generate : false;
		let customerId = (saveDataRecords.customer_id) ? saveDataRecords.customer_id : "";

		let insertedData = {
			'template_title': (saveDataRecords.template_title) ? saveDataRecords.template_title : "",
			'action': emailAction,
			'user_id': newObjectIdDefault(saveDataRecords.user_id),
			'description': (saveDataRecords.description) ? saveDataRecords.description : "",
			'subject': (saveDataRecords.subject) ? saveDataRecords.subject : "",
			'body': (saveDataRecords.body) ? saveDataRecords.body : "",
			'from': (saveDataRecords.from) ? saveDataRecords.from : "",
			'from_email': (saveDataRecords.from_email) ? saveDataRecords.from_email : "",
			'host': (saveDataRecords.host) ? saveDataRecords.host : "",
			'port': (saveDataRecords.port) ? saveDataRecords.port : "",
			'email_password': (saveDataRecords.email_password) ? saveDataRecords.email_password : "",
			'attach_reward': (saveDataRecords.attach_reward) ? saveDataRecords.attach_reward : "",
			'attach_poll': (saveDataRecords.attach_poll) ? saveDataRecords.attach_poll : "",
			'email_descriptions': (saveDataRecords.email_descriptions) ? saveDataRecords.email_descriptions : "",
			'template_type': templateType,
			'is_active': ACTIVE,
			// 'is_active': (resultActive.length > 0) ? DEACTIVE : ACTIVE,
			'design_json': (saveDataRecords.design_json) ? saveDataRecords.design_json : "",
			'is_deleted': NOT_DELETED,
			'on_off_status': COMPLETE_PROFILE_OFF,
			'is_sent': NOT_SENT,
			'is_opened': NOT_OPENED,
			'ai_bot': aiBot,
			'system_generate': systemGenerate,
			'skip_smtp': skipSmtp,
			'status': (saveDataRecords.status) ? saveDataRecords.status : NOT_DRAFT_STATUS,
			'image_manually_saved': imageManuallySaved,
			'ai_campaign_name_id': (saveDataRecords.ai_campaign_name_id) ? newObjectIdDefault(saveDataRecords.ai_campaign_name_id) : "",
			'ai_campaign_chat_id': (saveDataRecords.ai_campaign_chat_id) ? newObjectIdDefault(saveDataRecords.ai_campaign_chat_id) : "",
			'created': getUtcDate(),
			'modified': getUtcDate(),
		};

		// Insert the new email template using async/await
		const insertResult = await emailTemplate.insertOne(insertedData);
		if (!insertResult || !insertResult.insertedId) {
			return null;
		}

		const insertedId = insertResult.insertedId;
		const attachReward = (saveDataRecords.attach_reward) ? saveDataRecords.attach_reward : "";
		const userId = (saveDataRecords.user_id) ? newObjectIdDefault(saveDataRecords.user_id) : "";

		// Run template reward name update and fetch/save AI data in parallel
		await Promise.all([
			// Update template reward name (does not return a promise, but wrap in Promise.resolve for consistency)
			Promise.resolve(templateWiseRewardNameUpdate(attachReward, insertedId)),
			(async () => {
				// Save AI data structure for the user
				const emailData = await fetchUserEmailSummary(null, null, userId);
				await saveCustomerBucketItems({
					'user_id': userId,
					'bucket_name': DATA_BUCKET_EMAIL,
					'parent_bucket': PARENT_BUCKET_EMAIL,
					'data': emailData
				});
			})()
		]);

		return {
			"email_inserted_id": insertedId,
			'action': emailAction,
		};
	} catch (err) {
		// Optionally log error here
		return null;
	}
}; // End addEmailTemplateNewsletter()

/** 
 * Function to get stage level wise hybrid count using async/await.
 * Returns the count of hybrid users matching the given conditions.
 * @param {Object} conditionsData - The query conditions.
 * @returns {Promise<Number>} - The count of hybrid users.
 **/
hybridCountStageLevelWise = async (conditionsData) => {
	try {
		const signupLeadFormsCollection = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		// Ensure the 'hybrid' field is set to HYBRID in the query
		Object.assign(conditionsData, { "hybrid": HYBRID });

		// Count documents matching the conditions using async/await
		const countResult = await signupLeadFormsCollection.countDocuments(conditionsData);
		return countResult;
	} catch (err) {
		// Log or handle error as needed
		return 0;
	}
}; // End hybridCountStageLevelWise()

/**
 * Function to check if rewards are already assigned after delete or deactivate.
 * Uses async/await and runs queries in parallel with Promise.all.
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String|ObjectId} userId - User ID
 * @param {String|ObjectId} rewardId - Reward ID
 * @returns {Promise<Object>} - Result object with status and message
 */
assignRewardsAfterDeleteCheck = async (req, res, userId, rewardId) => {
	const emailCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
	const polls = db.collection(TABLE_POLLS);

	try {
		// Run both queries in parallel using Promise.all
		const [alreadyTemplateCount, pollAssignReward] = await Promise.all([
			// Count email templates with the given reward assigned
			emailCollection.countDocuments({
				user_id: newObjectIdDefault(userId),
				attach_reward: newObjectIdDefault(rewardId),
			}),
			// Count polls with the given reward assigned and not deleted
			polls.countDocuments({
				user_id: userId,
				is_deleted: NOT_DELETED,
				"options.assign_reward": newObjectIdDefault(rewardId),
			}),
		]);

		// Check the results and return appropriate response
		if (alreadyTemplateCount > 0 && pollAssignReward > 0) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.reward.these_rewards_are_already_assigned_to_all"),
			};
		} else if (alreadyTemplateCount > 0) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.reward.these_rewards_are_already_assigned_to_email_template"),
			};
		} else if (pollAssignReward > 0) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.reward.these_rewards_are_already_assigned_to_poll_reward"),
			};
		} else {
			return {
				status: STATUS_SUCCESS,
				message: ""
			};
		}
	} catch (err) {
		// Handle any errors that occurred during the queries
		return {
			status: STATUS_ERROR,
			req: req,
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End assignRewardsAfterDeleteCheck()

/**
 * Function to save public business user details using async/await.
 * Handles all database queries and file operations with async/await.
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String|ObjectId} userId - User ID
 * @returns {Promise<Object>} - Result object with status and message
 */
savePublicBussinessUserDetails = async (req, res, userId) => {
	const users = db.collection(TABLE_USERS);
	return new Promise(async resolve => {
		if (userId == '') {
			return resolve({
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
			});
		}

		try {
			let loginUserData = (req.user_data) ? req.user_data : "";
			let email = (req.body.email) ? (req.body.email).toLowerCase() : "";
			let mobile = (req.body.mobile) ? req.body.mobile.toString() : "";
			let zipCode = (req.body.zip) ? req.body.zip.toString() : "";
			let defaultNameBusiness = (req.body.default_name_of_the_business) ? req.body.default_name_of_the_business : "";
			let submitFrom = (req.body.submit_from) ? req.body.submit_from : "";

			let businessEmail = (req.body.business_email) ? (req.body.business_email).toLowerCase() : email;
			let primaryPhone = (req.body.primary_phone) ? req.body.primary_phone : mobile;
			let nameOfTheBusiness = (req.body.name_of_the_business) ? req.body.name_of_the_business : defaultNameBusiness;
			let primaryAddress = (req.body.primary_address) ? req.body.primary_address : "";
			let latitude = (req.body.latitude) ? req.body.latitude : "";
			let longitude = (req.body.longitude) ? req.body.longitude : "";

			let businessIndustry = (req.body.business_industry) ? newObjectIdDefault(req.body.business_industry) : newObjectIdDefault(BUSINESS_INDUSTRY_GENERAL_ID);
			let redemptionCode = (req.body.redemption_code) ? (req.body.redemption_code).toString() : res.locals.settings["Site.default_redemption_code"];
			redemptionCode = (redemptionCode).toString();
			let businessIndustryName = await getMasterDetails(businessIndustry);

			let description = (req.body.description && typeof req.body.description !== 'object') ? req.body.description : "";
			let marketingHeadline = (req.body.marketing_headline) ? req.body.marketing_headline : "";
			let marketingSubHeadline = (req.body.marketing_sub_headline) ? req.body.marketing_sub_headline : "";

			let businessLogoOldimage = (req.body.logo_old_image) ? req.body.logo_old_image : "";
			let businessAdminAddLogo = (req.body.business_logo) ? req.body.business_logo : "";
			let businessLogo = (req.files && req.files.business_logo) ? req.files.business_logo : "";

			let businessBannerOldimage = (req.body.banner_old_image) ? req.body.banner_old_image : "";
			let businessBanner = (req.files && req.files.business_banner) ? req.files.business_banner : "";

			let requestFrom = (req.body.request_from) ? req.body.request_from : "";

			/** Business Details login user */
			let aiBotFormsId = (loginUserData.ai_bot_forms_id) ? loginUserData.ai_bot_forms_id : "";
			let publicBusinessInformaton = (loginUserData.public_business_informaton) ? loginUserData.public_business_informaton : "";
			let alreadyCoreInformationTabFilled = (publicBusinessInformaton && publicBusinessInformaton.core_information_tab_filled) ? true : false;
			let alreadyCampaignOverviewTabFilled = (publicBusinessInformaton && publicBusinessInformaton.campaign_overview_tab_filled) ? true : false;
			let alreadyCampaignDetailTabFilled = (publicBusinessInformaton && publicBusinessInformaton.campaign_detail_tab_filled) ? true : false;

			/** This parameter used to AI bot */
			let websiteUrl = (req.body.website_url) ? ensureHttpPrefix(req.body.website_url) : "";
			let preferredOfferingOrDiscount = (req.body.preferred_offering_or_discount) ? req.body.preferred_offering_or_discount : "";
			let targetAudience = (req.body.target_audience) ? req.body.target_audience : "";
			let mainGoalYourEmailCampaign = (req.body.main_goal_of_your_email_campaign) ? newObjectIdDefault(req.body.main_goal_of_your_email_campaign) : "";
			let mainGoalYourEmailCampaignName = (req.body.main_goal_of_your_email_campaign_name) ? req.body.main_goal_of_your_email_campaign_name : "";

			let uniqueSellingProposition = (req.body.unique_selling_proposition) ? req.body.unique_selling_proposition : "";
			let toneOrStyleEmail = (req.body.tone_or_style_email) ? newObjectIdDefault(req.body.tone_or_style_email) : "";
			let toneOrStyleEmailName = (req.body.tone_or_style_email_name) ? req.body.tone_or_style_email_name : "";

			let specificProductOrService = (req.body.specific_product_or_service) ? req.body.specific_product_or_service : "";
			let benefitsProductOrService = (req.body.benefits_product_or_service) ? req.body.benefits_product_or_service : "";
			let callToAction = (req.body.call_to_action) ? req.body.call_to_action : "";
			let additionalInformation = (req.body.additional_information) ? req.body.additional_information : "";
			let aiBusinessIndustryids = (req.body.ai_business_industry_ids) ? req.body.ai_business_industry_ids : [];
			let aiBusinessIndustryNames = (req.body.ai_business_industry_names) ? [req.body.ai_business_industry_names] : [businessIndustryName];
			let fromHomepageAiUser = (req.body.from_homepage_ai_user) ? req.body.from_homepage_ai_user : false;

			let populateKeyPhraseFirst = (req.body.populate_key_phrase_first) ? req.body.populate_key_phrase_first : "";
			let populateKeyPhraseSecond = (req.body.populate_key_phrase_second) ? req.body.populate_key_phrase_second : "";
			let firstName = (req.body.first_name) ? req.body.first_name : "";
			let lastName = (req.body.last_name) ? req.body.last_name : "";

			let websiteCrawlable = req.body.hasOwnProperty('website_crawlable') ? req.body.website_crawlable : undefined;
			let websiteImageCrawlable = req.body.hasOwnProperty('website_image_crawlable') ? req.body.website_image_crawlable : undefined;

			let longLivedAccessToken = req.body.long_lived_access_token ? req.body.long_lived_access_token : "";
			let instagramUserDetails = req.body.instagram_user_details ? req.body.instagram_user_details : "";
			let scrapeWithInstagram = req.body.scrape_with_instagram ? req.body.scrape_with_instagram : false;
			let instagramUrl = req.body.instagram_url ? req.body.instagram_url : "";

			/** Convert fullname to signature image */
			let signatureUserData = {
				"user_id": userId,
				"first_name": firstName,
				"last_name": lastName,
				"name_of_the_business": nameOfTheBusiness
			};
			await signatureHtmltoImageConvert(req, res, signatureUserData);

			/** Generate QR code public URL image */
			await qrcodeGenerateUrl(req, res, userId);

			let excludedServices = (req.body.excluded_services) ? req.body.excluded_services : [];
			let includedServices = (req.body.included_services) ? req.body.included_services : INCLUDED_SERVICES;

			let aiBotSignupFieldIncluded = (req.body.ai_bot_signup_field_included) ? req.body.ai_bot_signup_field_included : SIGNUP_FIELD_AI_BOT_DEFAULT_USER_ASSIGN;

			/** Tab information */
			let coreInformationTabFilled = (req.body.core_information_tab_filled) ? true : false;
			let campaignOverviewTabFilled = (req.body.campaign_overview_tab_filled) ? true : false;
			let campaignDetailTabFilled = (req.body.campaign_detail_tab_filled) ? true : false;

			/** Start generate lead capture for ai bot */
			if (aiBusinessIndustryNames.length > 0 && aiBotSignupFieldIncluded.length > 0 && aiBotFormsId == "") {
				let optionsBot = {
					'user_id': userId,
					'signup_fields': aiBotSignupFieldIncluded,
				};
				await saveAiBotLeadCaptureForm(req, res, optionsBot);
			}

			/** Business logo options */
			let businessLogoOptions = {
				'image': businessLogo,
				'filePath': USERS_FILE_PATH,
				'oldPath': businessLogoOldimage
			};

			/** Business banner options */
			let businessBannerOptions = {
				'image': businessBanner,
				'filePath': USERS_FILE_PATH,
				'oldPath': businessBannerOldimage
			};

			/** Upload user businessLogo using async/await */
			let imageLogoResponse = await moveUploadedFile(req, res, businessLogoOptions);

			/** Upload user business banner using async/await */
			let imageBannerResponse = await moveUploadedFile(req, res, businessBannerOptions);

			if (imageLogoResponse.status == STATUS_ERROR) {
				return resolve({
					status: STATUS_ERROR,
					message: imageLogoResponse.message,
				});
			}

			if (imageBannerResponse.status == STATUS_ERROR) {
				return resolve({
					status: STATUS_ERROR,
					message: imageBannerResponse.message,
				});
			}

			/** field wise data */
			let updateData = {
				"from_homepage_ai_user": fromHomepageAiUser,
				"public_business_informaton.business_email": email, // some key testing
				"public_business_informaton.core_information_tab_filled": (alreadyCoreInformationTabFilled) ? alreadyCoreInformationTabFilled : coreInformationTabFilled,
				"public_business_informaton.campaign_overview_tab_filled": (alreadyCampaignOverviewTabFilled) ? alreadyCampaignOverviewTabFilled : campaignOverviewTabFilled,
				"public_business_informaton.campaign_detail_tab_filled": (alreadyCampaignDetailTabFilled) ? alreadyCampaignDetailTabFilled : campaignDetailTabFilled,
				"public_business_informaton.modified": getUtcDate()
			};

			if (primaryPhone) {
				updateData["mobile"] = primaryPhone;
				updateData["public_business_informaton.primary_phone"] = primaryPhone;
			}

			if (firstName) {
				updateData['fname'] = firstName;
			}
			if (lastName) {
				updateData['lname'] = lastName;
			}
			if (firstName && lastName) {
				updateData['full_name'] = firstName + " " + lastName;
			}

			if (businessEmail != '' && businessEmail !== email) {
				updateData['email'] = businessEmail;
				updateData['is_email_verified'] = NOT_VERIFIED;
				updateData['public_business_informaton.business_email'] = businessEmail;
			}
			if (zipCode != '') {
				updateData['zip'] = zipCode;
			}

			if (nameOfTheBusiness != '') {
				updateData['public_business_informaton.name_of_the_business'] = nameOfTheBusiness;
			}
			if (primaryAddress != '') {
				updateData['public_business_informaton.primary_address'] = primaryAddress;
				updateData['public_business_informaton.longitude'] = longitude;
				updateData['public_business_informaton.latitude'] = latitude;
			}
			if (businessIndustry != '') {
				updateData['public_business_informaton.business_industry'] = businessIndustry;
				updateData['public_business_informaton.business_industry_name'] = businessIndustryName;
			}
			if (redemptionCode != '') {
				updateData['public_business_informaton.redemption_code'] = redemptionCode;
			}
			if (description != '') {
				updateData['your_bio'] = description;
				updateData['public_business_informaton.description'] = description;
			}
			if (marketingHeadline != '') {
				updateData['public_business_informaton.marketing_headline'] = marketingHeadline;
			}
			if (marketingSubHeadline != '') {
				updateData['public_business_informaton.marketing_sub_headline'] = marketingSubHeadline;
			}
			if (businessLogo != '') {
				updateData['profile_image'] = (imageLogoResponse.fileName) ? imageLogoResponse.fileName : "";
				updateData['public_business_informaton.business_logo'] = (imageLogoResponse.fileName) ? imageLogoResponse.fileName : "";
			}
			if (requestFrom == REQUEST_FROM_ADMIN && businessAdminAddLogo != '') {
				updateData['profile_image'] = businessAdminAddLogo;
				updateData['public_business_informaton.business_logo'] = businessAdminAddLogo;
			}
			if (businessBanner != '') {
				updateData['public_business_informaton.business_banner'] = (imageBannerResponse.fileName) ? imageBannerResponse.fileName : "";
			}

			/** Start AI BOT data save */
			if (websiteUrl != '') {
				updateData['public_business_informaton.website_url'] = websiteUrl;
			}
			if (preferredOfferingOrDiscount != '') {
				updateData['public_business_informaton.preferred_offering_or_discount'] = preferredOfferingOrDiscount;
			}
			if (targetAudience != '') {
				updateData['public_business_informaton.target_audience'] = targetAudience;
			}

			if (mainGoalYourEmailCampaignName != '') {
				updateData['public_business_informaton.main_goal_of_your_email_campaign_name'] = mainGoalYourEmailCampaignName;
			}
			if (uniqueSellingProposition != '') {
				updateData['public_business_informaton.unique_selling_proposition'] = uniqueSellingProposition;
			}
			if (toneOrStyleEmailName != '') {
				updateData['public_business_informaton.tone_or_style_email_name'] = toneOrStyleEmailName;
			}
			if (specificProductOrService != '') {
				updateData['public_business_informaton.specific_product_or_service'] = specificProductOrService;
			}
			if (benefitsProductOrService != '') {
				updateData['public_business_informaton.benefits_product_or_service'] = benefitsProductOrService;
			}
			if (callToAction != '') {
				updateData['public_business_informaton.call_to_action'] = callToAction;
			}
			if (additionalInformation != '') {
				updateData['public_business_informaton.additional_information'] = additionalInformation;
			}
			if (excludedServices.length > 0 || includedServices.length > 0) {
				excludedServices.forEach(service => {
					service.checked = service.checked === "true";
				});
				updateData['public_business_informaton.excluded_services'] = excludedServices;
				updateData['public_business_informaton.included_services'] = includedServices;
			}
			if (aiBotSignupFieldIncluded.length > 0 && aiBotFormsId == "") {
				updateData['public_business_informaton.ai_bot_signup_field_included'] = aiBotSignupFieldIncluded;
			}

			if (aiBusinessIndustryNames != '') {
				updateData['public_business_informaton.ai_business_industry_names'] = aiBusinessIndustryNames;
			}

			if (populateKeyPhraseFirst != '') {
				updateData['public_business_informaton.populate_key_phrase_first'] = populateKeyPhraseFirst;
			}
			if (populateKeyPhraseSecond != '') {
				updateData['public_business_informaton.populate_key_phrase_second'] = populateKeyPhraseSecond;
			}

			/** End AI BOT data save */

			/** Update record in user service data */
			if (submitFrom == SUBMIT_FROM_USER_SERVICE) {
				updateData['public_business_informaton.business_email'] = businessEmail;
				updateData['public_business_informaton.primary_phone'] = primaryPhone;
				updateData['public_business_informaton.name_of_the_business'] = nameOfTheBusiness;
				updateData['public_business_informaton.primary_address'] = primaryAddress;
				updateData['public_business_informaton.latitude'] = (primaryAddress) ? latitude : "";
				updateData['public_business_informaton.longitude'] = (primaryAddress) ? longitude : "";
				updateData['public_business_informaton.business_industry'] = businessIndustry;
				updateData['public_business_informaton.business_industry_name'] = businessIndustryName;
				updateData['public_business_informaton.redemption_code'] = redemptionCode;
				updateData['public_business_informaton.description'] = description;
				updateData['public_business_informaton.marketing_headline'] = marketingHeadline;
				updateData['public_business_informaton.marketing_sub_headline'] = marketingSubHeadline;
				updateData['public_business_informaton.business_banner'] = (imageBannerResponse.fileName) ? imageBannerResponse.fileName : "";
				updateData['public_business_informaton.business_logo'] = (req.body.business_logo) ? req.body.business_logo : "";
				updateData['public_business_informaton.modified'] = getUtcDate();
			}

			/** Update record in user website crawlable key */
			if (websiteCrawlable !== undefined) {
				updateData['website_crawlable'] = (websiteCrawlable) ? websiteCrawlable : false;
			}

			/** Update record in user website image crawlable key */
			if (websiteImageCrawlable !== undefined) {
				updateData['website_image_crawlable'] = (websiteImageCrawlable) ? websiteImageCrawlable : false;
			}

			/** Update user instagram key */
			if (longLivedAccessToken && instagramUserDetails) {
				updateData['long_lived_access_token'] = longLivedAccessToken;
				updateData['instagram_created'] = getUtcDate();
				updateData['instagram_modified'] = getUtcDate();
				updateData['instagram_user_details'] = instagramUserDetails;
			}

			/** Update user scrap with instagram */
			if (scrapeWithInstagram) {
				updateData['scrape_with_instagram'] = true;
			}

			/** Update user instagram url */
			if (instagramUrl) {
				updateData['instagram_url'] = instagramUrl;
				updateData['instagram_url_created'] = getUtcDate();
			}

			/** Update user data using async/await */
			const updateResult = await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			if (!updateResult || updateResult.modifiedCount === 0) {
				return resolve({
					'status': STATUS_ERROR,
					'result': updateResult,
					'user_id': userId,
					'message': res.__("front.system.something_going_wrong_please_try_again"),
				});
			} else {
				return resolve({
					'status': STATUS_SUCCESS,
					'result': updateResult,
					'user_id': userId,
					'message': "",
				});
			}
		} catch (err) {
			return resolve({
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
				error: err
			});
		}
	});
}; // End savePublicBussinessUserDetails();

/** user bredcrumb wise data**/
userBreadcrumbs = (accountType) => {
	if (accountType == ALL_USERS) {
		return "All";
	}
	if (accountType == BASIC_USERS) {
		return "Basic";
	}
	if (accountType == BUSSINESS_USERS) {
		return "Verified";
	}
	if (accountType == PUBLIC_BUSSINESS_USERS) {
		return "Business";
	}
	if (accountType == TYPE_SUSPEND) {
		return "Suspended";
	}
	if (accountType == TYPE_UN_SUSPEND) {
		return "Un-Suspended";
	}
	if (accountType == TYPE_EMAIL_VERIFIED) {
		return "Email Verify";
	}
	if (accountType == TYPE_EMAIL_NOT_VERIFIED) {
		return "Email Not Verify";
	}
}//end userBreadcrumbs();

/***
 * Function to send mail with a given body, using async/await for all DB queries.
 */
sendMailGivenBody = async (req, res, sendOptionData) => {
	// Extract and prepare all required variables from sendOptionData and res.locals
	let emailTemplateID = sendOptionData.email_template_id || "";
	let emailTemplateAction = sendOptionData.email_template_action || "";
	let ownerUserData = sendOptionData.owner_user_data || {};
	let ownerUserId = sendOptionData.owner_user_id ? newObjectIdDefault(sendOptionData.owner_user_id) : "";
	let subject = sendOptionData.subject || "";

	let body = sendOptionData.body || "";
	let emailUserName = sendOptionData.from || res.locals.settings["Email.user_name"];
	let userEmail = sendOptionData.from_email || res.locals.settings["Email.user_email"];
	let emailHost = sendOptionData.host || res.locals.settings["Email.host"];
	let emailPassword = sendOptionData.email_password || res.locals.settings["Email.password"];
	let emailPort = sendOptionData.port ? Number(sendOptionData.port) : res.locals.settings["Email.port"];
	let completeProfileLink = sendOptionData.link_url || "";
	let linkBlockedWalletUrl = sendOptionData.link_blocked_wallet_url || ""; // only for welcome email

	let sendEmail = sendOptionData.email_send_to;
	let userId = sendOptionData.user_id ? newObjectIdDefault(sendOptionData.user_id) : "";
	let rewardId = sendOptionData.reward_id ? newObjectIdDefault(sendOptionData.reward_id) : "";
	let earnRewardInsertedId = sendOptionData.earn_reward_inserted_id ? newObjectIdDefault(sendOptionData.earn_reward_inserted_id) : "";
	let templateType = sendOptionData.template_type || "";
	let campaignSendNewsletterLogsId = sendOptionData.campaign_send_newsletter_logs_id || "";

	// Whether to send mail or not
	let whetherToSendMailNot = sendOptionData.whether_to_send_mail_or_not || false;

	// Business details for the logged-in user
	let fullName = ownerUserData.full_name || "";
	let signatureImage = ownerUserData.signature_image || "";
	let publicBusinessInformaton = ownerUserData.public_business_informaton || "";
	let nameOfTheBusiness = (publicBusinessInformaton && publicBusinessInformaton.name_of_the_business) ? publicBusinessInformaton.name_of_the_business : "";
	let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
	let businessRewardLogo = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";
	let businessIndustryName = (publicBusinessInformaton && publicBusinessInformaton.business_industry_name) ? publicBusinessInformaton.business_industry_name : "";
	let primaryAddress = (publicBusinessInformaton && publicBusinessInformaton.primary_address) ? publicBusinessInformaton.primary_address : "";
	let profileImageUrl = "";

	try {
		// --- Parallel DB queries if needed ---
		// Prepare all DB queries that can be run in parallel
		const rewards = db.collection(TABLE_REWARDS);
		let rewardPromise = rewards.findOne(
			{ _id: rewardId },
			{ projection: { 'graphic_image': 1, 'reward_text': 1, 'reward_sub_heading': 1 } }
		);

		// For welcome email, poll custom url is needed
		let pollPromise = null;
		if (templateType == EMAIL_TEMPLATE_WELCOME_TYPE) {
			const tablePoll = db.collection(TABLE_POLLS);
			pollPromise = tablePoll.findOne(
				{ 'user_id': userId, 'type': POLL_AI_TYPE },
				{ projection: { 'custom_url': 1 } }
			);
		}

		// Await all parallel queries
		let [resultRewards, resultAiPoll] = await Promise.all([
			rewardPromise,
			pollPromise
		]);

		// --- Process reward data ---
		let rewardQueryId = (resultRewards && resultRewards['_id']) ? resultRewards['_id'] : "";
		let rewardImage = (resultRewards && resultRewards['graphic_image']) ? resultRewards['graphic_image'] : "";
		let rewardText = (resultRewards && resultRewards['reward_text']) ? resultRewards['reward_text'] : "";
		let rewardSubHeading = (resultRewards && resultRewards['reward_sub_heading']) ? resultRewards['reward_sub_heading'] : "";

		// Replace dynamic values in the body
		let actionOptions = ["LINK", "WALLET_LINK"];
		let repArray = [completeProfileLink, linkBlockedWalletUrl];
		actionOptions.forEach((value, key) => {
			let replaceKey = repArray[key] || "";
			body = body.replace(RegExp('{' + value + '}', 'g'), replaceKey);
		});

		// Setup nodemailer transporter
		const nodemailer = require("nodemailer");
		const transporter = nodemailer.createTransport({
			'host': emailHost,
			'port': emailPort,
			'secure': (emailPort == SMTP_SECURE_PORT) ? true : false, // true for SMTP_SECURE_PORT, false for other ports
			'auth': {
				'user': userEmail,
				'pass': emailPassword
			},
			'tls': {
				rejectUnauthorized: true
			}
		});

		// Replace more dynamic values in the body
		body = body.replace(RegExp('{CURRENT_YEAR}', 'g'), new Date().getFullYear());
		body = body.replace(RegExp('{BUSINESS_ADDRESS}', 'g'), primaryAddress);
		body = body.concat('<img src="{IMAGE_SCRIPT_LINK}" style="width: 0px; height: 0px;">');

		// Newsletter/campaign constants
		let emailTemplateTitle = sendOptionData.email_template_title || "";
		let emailTemplateDescription = sendOptionData.email_template_description || "";
		let campaignUnscribedValidateString = sendOptionData.campaign_unsubscribe_validate_string || "";

		// Welcome email unsubscribe string
		let welcomeEmailUnsubscribeValidateString = (req.body && req.body.welcome_email_unsubscribe_validate_string) ? req.body.welcome_email_unsubscribe_validate_string : "";

		body = body.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);
		body = body.replace(RegExp('{NEWSLETTER_TITLE}', 'g'), emailTemplateTitle);
		body = body.replace(RegExp('{NEWSLETTER_DESCRIPTION}', 'g'), emailTemplateDescription);
		body = body.replace(RegExp('{UNSUBSCRIBE_LINK}', 'g'), WEBSITE_CAMPAIGN_UNSUBSCRIBED_EMAIL_LINK + '' + campaignUnscribedValidateString);
		body = body.replace(RegExp('{WELCOME_UNSUBSCRIBE_LINK}', 'g'), WEBSITE_UNSUBSCRIBED_EMAIL_LINK + '' + UNSUBSCRIBED_TYPE_FOR_INSIDER_WELCOME_EMAIL + "/" + welcomeEmailUnsubscribeValidateString);

		// Set profile image url
		if (businessRewardLogo) {
			profileImageUrl = USERS_URL + businessRewardLogo;
		} else if (businessLogo) {
			profileImageUrl = USERS_URL + businessLogo;
		}

		// Signature image or fallback to full name
		if (signatureImage) {
			let imgSignatureSrc = '<img src="' + SIGNATURE_URL + signatureImage + '" style="max-height:60px;" >';
			body = body.replace(RegExp('{SIGNATURE}', 'g'), imgSignatureSrc);
		} else {
			body = body.replace(RegExp('{SIGNATURE}', 'g'), fullName);
		}

		// Business logo image
		if (profileImageUrl) {
			let imgSrc = '<img src="' + profileImageUrl + '" style="max-height:100px;" >';
			body = body.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), imgSrc);
		} else {
			body = body.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), '');
		}

		// Welcome email reward card and related replacements
		if (rewardQueryId) {
			body = body.replace(RegExp('{REWARD_IMAGE}', 'g'), WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD);

			// Select a random color for wallet reward
			const randomWalletRewardIndex = Math.floor(Math.random() * WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR.length);
			const randomRewardWalletColor = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR[randomWalletRewardIndex];
			body = body.replace(RegExp('{WALLET_RANDOM_COLOR_GRADIANT}', 'g'), randomRewardWalletColor);

			// Subject and body replacements
			subject = subject.replace(/'/g, '');
			subject = subject.replace(/&/g, "&#38;");
			subject = subject.replace(/&/g, "&amp;");
			subject = subject.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);

			body = body.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);
			body = body.replace(RegExp('{BUSINESS_INDUSTRY}', 'g'), businessIndustryName);
			body = body.replace(RegExp('{REWARD_HEADING}', 'g'), rewardText);
			body = body.replace(RegExp('{REWARD_SUBHEADING}', 'g'), rewardSubHeading);
			body = body.replace(RegExp('{USER_PROFILE_IMAGE}', 'g'), profileImageUrl);
			body = body.replace(RegExp('{EMAIL_DESCRIPTION}', 'g'), emailTemplateDescription);
			body = body.replace(RegExp('{EMAIL_HEADING}', 'g'), subject);
		} else {
			body = body.replace(RegExp('{REWARD_IMAGE}', 'g'), '');
		}
		body = body.replace(RegExp('{NEWSLETTER_TITLE}', 'g'), emailTemplateTitle);

		// Track crone for template type
		let trackOptionData = {
			'email_template_id': emailTemplateID,
			'user_id': userId,
			'unique_string': newsletterSubscriberEncId(sendEmail),
			'template_type': templateType,
			'earn_sent_reward_id': earnRewardInsertedId,
			'campaign_send_newsletter_logs_id': campaignSendNewsletterLogsId,
		};
		const trackDecryptOptionData = encryptCrypto(JSON.stringify(trackOptionData));
		body = body.replace(RegExp('{IMAGE_SCRIPT_LINK}', 'g'), WEBSITE_EMAIL_TRACK_OPEN_URL + trackDecryptOptionData);

		// Prepare from email display
		let fromMailDisplayedEmail = (sendOptionData.from && validateEmailCheck(userEmail))
			? emailUserName + "<" + userEmail + ">"
			: res.locals.settings["Email.user_name"];

		// For welcome email, adjust fromMailDisplayedEmail
		if (templateType == EMAIL_TEMPLATE_WELCOME_TYPE) {
			var match = fromMailDisplayedEmail.match(/<([^>]*)>/);
			if (match) {
				var extractedValue = match[1];
				fromMailDisplayedEmail = sendOptionData.from + "<" + extractedValue + ">";
			}
		}

		// If welcome email, replace poll page url
		if (templateType == EMAIL_TEMPLATE_WELCOME_TYPE) {
			let pollCustomUrlValue = (resultAiPoll && resultAiPoll.custom_url) ? resultAiPoll.custom_url : "";
			if (pollCustomUrlValue) {
				body = body.replace(RegExp('{POLL_PAGE_URL}', 'g'), FRONT_URL + 'p/' + pollCustomUrlValue);
			} else {
				body = body.replace(RegExp('{POLL_PAGE_URL}', 'g'), 'javascript:void(0)');
			}
		}

		// Only send mail if not unsubscribed
		if (whetherToSendMailNot == 'false' || whetherToSendMailNot == false) {
			let mailOptions = {
				'from': fromMailDisplayedEmail,
				'to': sendEmail,
				'subject': subject,
				'html': body
			};

			// Send email and log results
			let sendMailResult = await new Promise((resolveMail) => {
				transporter.sendMail(mailOptions, (error) => {
					resolveMail(error);
				});
			});

			// Save email logs details
			const email_logs = db.collection(TABLE_EMAIL_LOGS);
			mailOptions.error = sendMailResult;
			mailOptions.created = getUtcDate();
			await email_logs.insertOne(mailOptions);

			if (sendMailResult) {
				// If error, resolve with error
				return sendMailResult;
			} else {
				// Update email template sent count and log newsletter send
				const emailCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
				await emailCollection.updateOne(
					{ _id: newObjectIdDefault(emailTemplateID) },
					{ $inc: { is_sent: 1 } }
				);

				let logsNewsletterOptionData = {
					'from_email': fromMailDisplayedEmail,
					'to_email': sendEmail,
					'subject': subject,
					'email_template_id': (emailTemplateID) ? newObjectIdDefault(emailTemplateID) : "",
					'email_template_action': emailTemplateAction,
					'from_user_id': (userId) ? newObjectIdDefault(userId) : "",
					'unique_string': newsletterSubscriberEncId(sendEmail),
					'template_type': templateType,
					'reward_id': (rewardId) ? newObjectIdDefault(rewardId) : "",
					'earn_sent_reward_id': (earnRewardInsertedId) ? newObjectIdDefault(earnRewardInsertedId) : "",
					'campaign_send_newsletter_logs_id': (campaignSendNewsletterLogsId) ? newObjectIdDefault(campaignSendNewsletterLogsId) : "",
					'owner_user_id': (ownerUserId) ? newObjectIdDefault(ownerUserId) : "",
				};
				await sendEmailLogsData(logsNewsletterOptionData);
				return sendMailResult;
			}
		} else {
			// If not sending mail, just resolve
			return;
		}
	} catch (err) {
		// Handle any errors
		return err;
	}
}; // End sendMailGivenBody();

/**
 * Function to send email newsletter logs data using async/await.
 * This function inserts a log entry into the newsletter send logs collection.
 */
const sendEmailLogsData = async (sendOptionData) => {
	// Add created timestamp
	sendOptionData['created'] = getUtcDate();

	// Get the collection for newsletter send logs
	const sendLogsNewsletter = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE_SEND_LOGS);

	// Insert the log entry asynchronously
	await sendLogsNewsletter.insertOne(sendOptionData);
};

/***
 * Function to send welcome mail using async/await and parallel DB queries where possible.
 */
welcomeMailSend = async (req, res, optionsData) => {
	try {
		const emailTemplateCreatorId = optionsData.creator_id || "";
		const sendEmailSendTo = optionsData.email_send_to || "";
		const rewardSendUserID = optionsData.reward_send_user_id || "";
		const linkUrl = optionsData.link_url || "";
		const linkBlockedWalletUrl = optionsData.link_blocked_wallet_url || "";
		const resultUsers = optionsData.user_created_result || "";
		const leadFormsId = optionsData.lead_forms_id ? newObjectIdDefault(optionsData.lead_forms_id) : "";
		const croneAccourdingWelcomeEmailId = optionsData.crone_accourding_welcome_email_id ? newObjectIdDefault(optionsData.crone_accourding_welcome_email_id) : "";
		const userUnsubscribedFlag = req.body.welcome_email_unsubscribed_flag ? req.body.welcome_email_unsubscribed_flag : false;
		let completeProfilePage = req.body.complete_profile ? req.body.complete_profile : "";

		const leadForms = db.collection(TABLE_LEAD_FORMS);
		const emailCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		let result; // Will hold the email template result

		// Prepare queries for parallel execution if possible
		if (!croneAccourdingWelcomeEmailId) {
			// No crone: need to get lead form and then template
			// 1. Get lead form data to find assigned welcome email id
			const resultLeadFormData = await leadForms.findOne(
				{ '_id': leadFormsId },
				{ projection: { 'assign_welcome_email_id': 1 } }
			);
			if (!resultLeadFormData) return;

			const assignLeadFormWelcomeEmailId = resultLeadFormData.assign_welcome_email_id
				? newObjectIdDefault(resultLeadFormData.assign_welcome_email_id)
				: "";
			if (!assignLeadFormWelcomeEmailId) return;

			// 2. Get email template details
			const emailCollectionOptions = {
				'user_id': newObjectIdDefault(emailTemplateCreatorId),
				'_id': newObjectIdDefault(assignLeadFormWelcomeEmailId),
			};
			result = await emailCollection.findOne(emailCollectionOptions);
			if (!result) return;
		} else {
			// Crone: get template directly
			const emailCollectionOptions = {
				'user_id': newObjectIdDefault(emailTemplateCreatorId),
				'_id': newObjectIdDefault(croneAccourdingWelcomeEmailId),
			};
			result = await emailCollection.findOne(emailCollectionOptions);
			if (!result) return;
		}

		// Ensure business user details are present
		if (!resultUsers) {
			return;
		}

		// Prepare options for adding earn rewards
		const addEarnRewardsOptions = {
			'complete_attach_reward_id': result.attach_reward || "",
			'reward_send_user_id': rewardSendUserID,
			'result_users': resultUsers,
			'email_template_id': result._id || "",
			'email_template_action': result.action || "",
			'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
		};

		// Assign earn rewards (async)
		const earnRewardInsertedId = await addEarnRewards(req, res, addEarnRewardsOptions);

		// Prepare data for sending the mail
		const sendOptionData = {
			'reward_id': result.attach_reward || "",
			'email_template_title': result.template_title || "",
			'email_template_description': result.description || "",
			'email_template_id': result._id || "",
			'email_template_action': result.action || "",
			'subject': result.subject || "",
			'body': result.body || "",
			'from': result.from || "",
			'from_email': result.from_email || "",
			'host': result.host || "",
			'skip_smtp': result.skip_smtp || false,
			'email_password': result.email_password || "",
			'port': result.port || "",
			'email_send_to': sendEmailSendTo,
			'user_id': emailTemplateCreatorId,
			'link_url': linkUrl,
			'link_blocked_wallet_url': linkBlockedWalletUrl,
			'earn_reward_inserted_id': earnRewardInsertedId,
			'owner_user_data': resultUsers || {},
			'owner_user_id': resultUsers._id || "",
			'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
			'whether_to_send_mail_or_not': userUnsubscribedFlag,
		};

		// If complete profile page flag is set, do not send welcome email
		if (completeProfilePage !== '') {
			return;
		}

		// Send mail for the given body
		await sendMailGivenBody(req, res, sendOptionData);

		// In parallel, send welcome reward to all campaign users with the same email (fire and forget)
		const userEmail = req.body.email ? req.body.email.toLowerCase() : "";
		sendWelcomeRewardToAllCampaignUser(userEmail, '');

		return;
	} catch (error) {
		console.error("An error occurred:", error);
	}
}; // End welcomeMailSend();

/***
 * Function for use to complete profile mail send
 * Updated to use async/await and Promise.all for parallel queries.
 */
completeProfileMailSend = async (req, res, optionsData) => {
	try {
		// Extract and prepare all required variables from optionsData
		const sendEmailSendTo = optionsData.email_send_to || "";
		const rewardSendUserID = optionsData.reward_send_user_id || "";
		const linkUrl = optionsData.link_url || "";
		const leadFormsId = optionsData.lead_forms_id ? newObjectIdDefault(optionsData.lead_forms_id) : "";
		const resultUsers = optionsData.user_created_result || "";
		const completeProfileDetails = (resultUsers && resultUsers.complete_profile_reward) ? resultUsers.complete_profile_reward : {};
		const completeTempalteId = completeProfileDetails.tempalte_id || "";
		const completeAttachRewardId = completeProfileDetails.attach_reward ? newObjectIdDefault(completeProfileDetails.attach_reward) : "";

		const emailCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		const emailCollectionOptions = {
			'template_type': EMAIL_TEMPLATE_COMPLETE_TYPE,
			'user_id': newObjectIdDefault(ADMIN_ID),
			'is_active': ACTIVE,
			'is_deleted': NOT_DELETED,
			'_id': newObjectIdDefault(completeTempalteId),
		};

		// Send complete mail notify if leadFormsId is present (fire and forget)
		if (leadFormsId != '') {
			const notifyCompleteOptions = {
				'owner_user_email': (resultUsers && resultUsers.email) ? resultUsers.email : "",
				'lead_forms_id': leadFormsId,
			};
			sendCompleteEmailNotify(req, res, notifyCompleteOptions);
		}

		// Get Email template details using async/await
		const result = await emailCollection.findOne(emailCollectionOptions);
		const onOffStatus = (result && result.on_off_status) ? result.on_off_status : '';

		if (result && onOffStatus == COMPLETE_PROFILE_ON) {
			// Get business user details (The user who created the reward and email template)
			if (resultUsers) {
				const addEarnRewardsOptions = {
					'complete_attach_reward_id': completeAttachRewardId,
					'reward_send_user_id': rewardSendUserID,
					'result_users': resultUsers,
					'template_type': EMAIL_TEMPLATE_COMPLETE_TYPE,
					'email_template_id': (result && result._id) ? result._id : "",
					'email_template_action': (result && result.action) ? result.action : "",
				};

				// Assign earn rewards (async)
				const earnRewardInsertedId = await addEarnRewards(req, res, addEarnRewardsOptions);

				// Prepare data for sending the mail
				const sendOptionData = {
					'reward_id': completeAttachRewardId,
					'email_template_title': result.template_title || "",
					'email_template_description': result.description || "",
					'email_template_id': result._id || "",
					'email_template_action': result.action || "",
					'subject': result.subject || "",
					'body': result.body || "",
					'from': result.from || "",
					'from_email': result.from_email || "",
					'host': result.host || "",
					'email_password': result.email_password || "",
					'port': result.port || "",
					'email_send_to': sendEmailSendTo,
					'link_url': linkUrl,
					'user_id': ADMIN_ID,
					'earn_reward_inserted_id': earnRewardInsertedId,
					'owner_user_data': resultUsers || {},
					'owner_user_id': (resultUsers && resultUsers._id) ? resultUsers._id : "",
					'template_type': EMAIL_TEMPLATE_COMPLETE_TYPE,
				};

				// Send mail for the given body
				await sendMailGivenBody(req, res, sendOptionData);

				// In parallel, send welcome reward to all campaign users with the same email (fire and forget)
				const userEmail = req.body.email ? req.body.email.toLowerCase() : "";
				sendWelcomeRewardToAllCampaignUser(userEmail, rewardSendUserID);

				return;
			} else {
				return;
			}
		} else {
			return;
		}
	} catch (error) {
		console.error("An error occurred in completeProfileMailSend:", error);
		return;
	}
}; // End completeProfileMailSend();

/**
 * Function to assign/earn rewards for a user.
 * Uses async/await for all DB queries and Promise.all for parallel operations.
 *
 * @return {Promise<ObjectId|undefined>} Inserted reward ID or undefined if not inserted.
 */
addEarnRewards = async (req, res, addEarnRewardsOptions) => {
	const rewards = db.collection(TABLE_REWARDS);
	const sentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

	let rewardId = addEarnRewardsOptions.complete_attach_reward_id;
	let currentUserId = addEarnRewardsOptions.reward_send_user_id;
	let resultUsers = addEarnRewardsOptions.result_users;
	let templateType = addEarnRewardsOptions.template_type;
	let emailTemplateId = (addEarnRewardsOptions.email_template_id) ? newObjectIdDefault(addEarnRewardsOptions.email_template_id) : "";
	let emailTemplateAction = (addEarnRewardsOptions.email_template_action) ? addEarnRewardsOptions.email_template_action : "";
	let campaignSendNewsletterId = (addEarnRewardsOptions.campaign_send_newsletter_id) ? newObjectIdDefault(addEarnRewardsOptions.campaign_send_newsletter_id) : "";
	let campaignSendNewsletterLogsId = (addEarnRewardsOptions.campaign_send_newsletter_logs_id) ? newObjectIdDefault(addEarnRewardsOptions.campaign_send_newsletter_logs_id) : "";

	let leadFormsId = (req.body.lead_forms_id) ? newObjectIdDefault(req.body.lead_forms_id) : "";
	let email = (req.body.email) ? (req.body.email).toLowerCase() : "";

	try {
		// Validate required data
		if (!rewardId || !resultUsers) {
			return;
		}

		// 1. Get reward details
		const resultRewards = await rewards.findOne({ _id: newObjectIdDefault(rewardId) });
		if (!resultRewards) {
			return;
		}

		// 2. Check if reward already sent (unless it's a campaign newsletter type)
		const countQuery = {
			'email': email,
			'reward_id': newObjectIdDefault(resultRewards._id),
			'template_type': templateType,
			'lead_forms_id': leadFormsId,
		};
		const alreadyRewardResult = await sentRewards.countDocuments(countQuery);

		if (alreadyRewardResult === 0 || templateType === EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE) {
			// 3. Prepare parallel queries: get slug and (later) insert reward
			let userRedeemedCode = (resultUsers.public_business_informaton && resultUsers.public_business_informaton.redemption_code)
				? (resultUsers.public_business_informaton.redemption_code).toString()
				: "";
			let businessIndustryId = (resultUsers.public_business_informaton && resultUsers.public_business_informaton.business_industry)
				? newObjectIdDefault(resultUsers.public_business_informaton.business_industry)
				: "";

			// Prepare slug generation
			let slugOptions = {
				title: resultRewards.reward_text,
				table_name: TABLE_EARN_SENT_REWARDS,
				slug_field: "slug"
			};

			// Run slug generation in parallel (could add more parallel queries here if needed)
			const slugResponse = await getDatabaseSlug(slugOptions);

			// 4. Prepare data for insertion
			let insertedData = {
				'email': email,
				'user_id': (currentUserId) ? newObjectIdDefault(currentUserId) : "",
				'reward_id': newObjectIdDefault(resultRewards._id),
				'email_template_id': emailTemplateId,
				'email_template_action': emailTemplateAction,
				'template_type': templateType,
				'lead_forms_id': leadFormsId,
				'title': (resultRewards.reward_text) ? resultRewards.reward_text : "",
				'sub_title': (resultRewards.reward_sub_heading) ? resultRewards.reward_sub_heading : "",
				'image': (resultRewards.graphic_image) ? resultRewards.graphic_image : "",
				'url_desc': (resultRewards.url_desc) ? resultRewards.url_desc : "",
				'send_by': (resultRewards.user_id) ? newObjectIdDefault(resultRewards.user_id) : "",
				'business_industry_id': businessIndustryId,
				'redemption_code': userRedeemedCode,
				'expiry_date': (resultRewards.expiry_date) ? resultRewards.expiry_date : "",
				'toogle_expiry_date': (resultRewards.toogle_expiry_date) ? true : false,
				'reward_created_date': (resultRewards.created) ? resultRewards.created : "",
				'store_type_id': (resultRewards.store_type_id) ? resultRewards.store_type_id : [],
				'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
				'is_redemed': NOT_REDEMED,
				'is_deleted': NOT_DELETED,
				'is_download': DEFAULT_ZERO,
				'is_viewed': NOT_VIEWED,
				'created': getUtcDate(),
				'modified': getUtcDate(),
			};

			if (templateType === EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE) {
				insertedData['campaign_send_newsletter_id'] = campaignSendNewsletterId;
				insertedData['campaign_send_newsletter_logs_id'] = campaignSendNewsletterLogsId;
			}

			// 5. Insert the earned reward
			const earnRewardResult = await sentRewards.insertOne(insertedData);
			const insertedEarnRewardId = (earnRewardResult && earnRewardResult.insertedId) ? earnRewardResult.insertedId : "";

			// 6. In parallel, update user_id for all welcome rewards for this email (fire and forget)
			if (currentUserId) {
				sentRewards.updateMany(
					{
						"email": email,
						"template_type": EMAIL_TEMPLATE_WELCOME_TYPE,
					},
					{ $set: { 'user_id': newObjectIdDefault(currentUserId) } }
				).catch(() => { /* ignore errors for fire-and-forget */ });
			}

			return insertedEarnRewardId;
		} else {
			// Reward already exists, do not insert again
			return;
		}
	} catch (err) {
		// Log error if needed
		return;
	}
}; // End addEarnRewards()


/**
 * Get the count of followers and following for a given user using async/await.
 * Executes both count queries in parallel for optimal performance.
 * @param {String|ObjectId} userId - The ID of the user to get counts for.
 * @returns {Object} An object containing followers_count and following_count.
 */
getFollowingAndFollowersCount = async (userId) => {
	try {
		const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

		// Prepare query conditions for followers and following
		const followersCondition = {
			user_id: newObjectIdDefault(userId),
			is_approved: ACTIVE,
			action_type: FOLLOW_ACTION_TYPE,
		};
		const followingCondition = {
			followed_by: newObjectIdDefault(userId),
			is_approved: ACTIVE,
			action_type: FOLLOW_ACTION_TYPE,
		};

		// Run both count queries in parallel for faster response
		const [followersCount, followingCount] = await Promise.all([
			usersFollower.countDocuments(followersCondition),
			usersFollower.countDocuments(followingCondition)
		]);

		return {
			followers_count: followersCount,
			following_count: followingCount,
		};
	} catch (err) {
		// In case of error, return zero counts
		return {
			followers_count: DEFAULT_ZERO,
			following_count: DEFAULT_ZERO,
		};
	}
}; // End getFollowingAndFollowersCount

/**
 * Function to submit and generate a capture lead form using async/await.
 * Uses async/await for all DB queries and ensures clean formatting.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} optionLeads - Options for the lead form
 * @returns {Promise<ObjectId|String>} The inserted document's ID or empty string on failure
 */
saveLeadCaptureForm = async (req, res, optionLeads) => {
	try {
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		// Prepare slug generation options
		let slugOptions = {
			"title": optionLeads.title,
			"table_name": TABLE_LEAD_FORMS,
			"slug_field": "slug",
			"req": req,
			"res": res
		};

		// Generate slug asynchronously
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Prepare the document to insert
		const leadFormDoc = {
			'user_id': newObjectIdDefault(optionLeads.user_id),
			'title': optionLeads.title,
			'description': optionLeads.description,
			'text_to_display': optionLeads.text_to_display,
			'display_url_description': optionLeads.display_url_description,
			'signin_option': optionLeads.signin_option,
			'kiosk_option': optionLeads.kiosk_option ? optionLeads.kiosk_option : KIOSK_OPTION_NO,
			'signup_fields': optionLeads.signup_fields,
			'button_name': optionLeads.button_name,
			'mandatory_options': optionLeads.mandatory_options,
			'message_box_title': optionLeads.message_box_title,
			'type_dropdown_title': optionLeads.type_dropdown_title,
			'message_field_count': Number(optionLeads.message_field_count),
			'dropdown_field_count': Number(optionLeads.dropdown_field_count),
			'form_title': optionLeads.form_title,
			'notify_email': optionLeads.notify_email,
			'notify_email_type': optionLeads.notify_email_type,
			'notify_email_send_type': optionLeads.notify_email_send_type,
			'image': optionLeads.image,
			'graphic_type': optionLeads.graphic_type,
			'page_type': optionLeads.page_type,
			'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
			'is_default': optionLeads.is_default ? DEFAULT_ONE : DEFAULT_ZERO,
			'custom_thank_you_title': optionLeads.custom_thank_you_title ? optionLeads.custom_thank_you_title : "",
			'custom_thank_you_message': optionLeads.custom_thank_you_message ? optionLeads.custom_thank_you_message : "",
			'assign_welcome_email_id': optionLeads.assign_welcome_email_id ? newObjectIdDefault(optionLeads.assign_welcome_email_id) : "",
			'is_home_page': DEFAULT_ZERO,
			'is_subscriber': DEFAULT_ZERO,
			'is_deleted': NOT_DELETED,
			"is_active": ACTIVE,
			'modified': getUtcDate(),
			'created': getUtcDate()
		};

		// Insert the document asynchronously
		const result = await leadsForms.insertOne(leadFormDoc);

		// Return the insertedId if successful, else empty string
		return (result && result.insertedId) ? result.insertedId : "";
	} catch (err) {
		// In case of error, return empty string
		return "";
	}
}; // End saveLeadCaptureForm

/*
Function for submit excel/csv capture lead form generate
*/
saveExcelLeadCaptureForm = (req, res, userId) => {
	return new Promise(resolve => {
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		/** slug generate */
		let slugOptions = {
			"title": res.locals.settings["Excel_csv.enter_campaign_title"],
			"table_name": TABLE_LEAD_FORMS,
			"slug_field": "slug",
			"req": req,
			"res": res
		};

		/** default home page generate lead*/
		getDatabaseSlug(slugOptions).then(slugResponse => {
			let slugName = (slugResponse && slugResponse.title) ? slugResponse.title : "";
			leadsForms.insertOne({
				'user_id': newObjectIdDefault(userId),
				'title': res.locals.settings["Excel_csv.enter_campaign_title"],
				'description': res.locals.settings["Excel_csv.description"],
				'text_to_display': res.locals.settings["Excel_csv.enter_text_to_display_with_the_url"],
				'display_url_description': res.locals.settings["Excel_csv.enter_the_title_to_display_with_this_form"],
				'signin_option': SIGNIN_OPTION_NO,
				'kiosk_option': KIOSK_OPTION_NO,
				'signup_fields': SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
				'button_name': res.locals.settings["Excel_csv.submit_button_title"],
				'mandatory_options': SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
				'message_box_title': [],
				'type_dropdown_title': [],
				'message_field_count': 0,
				'dropdown_field_count': 0,
				'form_title': res.locals.settings["Excel_csv.form_title"],
				'notify_email': [],
				'image': "",
				'graphic_type': "",
				'slug': slugName,
				'is_default': DEFAULT_ONE,
				'is_excel_default': DEFAULT_ONE,
				'custom_thank_you_message': res.locals.settings["Excel_csv.custom_thank_you_message"],
				'custom_thank_you_title': res.locals.settings["Excel_csv.custom_thank_you_title"],
				'is_home_page': DEFAULT_ZERO,
				'is_subscriber': DEFAULT_ZERO,
				'is_deleted': NOT_DELETED,
				"is_active": ACTIVE,
				'modified': getUtcDate(),
				'created': getUtcDate()
			}, (err, result) => {
				/** Send success response **/
				let insertedId = (!err && result.insertedId) ? result.insertedId : "";
				/***Update lead id in user table */
				const users = db.collection(TABLE_USERS);
				users.updateOne({ _id: newObjectIdDefault(userId) }, { '$set': { 'excel_lead_forms_id': newObjectIdDefault(insertedId), 'excel_lead_forms_slug': slugName } });

				/***This first on the list and make “Registration Campaign” last. */
				const leadsForms = db.collection(TABLE_LEAD_FORMS);
				leadsForms.updateOne({ 'user_id': newObjectIdDefault(userId), "ai_bot": true, 'is_pocial_ai_bot_default': DEFAULT_ONE, }, { '$set': { 'created': getUtcDate() } });

				return resolve(insertedId);

			});
		});
	});
} //End saveExcelLeadCaptureForm();

/**
 * Function to get business user's other activity status using async/await.
 * Executes all queries in parallel for optimal performance.
 * @param {String|ObjectId} userId - The ID of the user to check
 * @returns {Promise<Object>} An object containing activity statuses
 */
getBusinessUserAllActivityUse = async (userId) => {
	try {
		const emailNewsletterCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
		const rewardsCollection = db.collection(TABLE_REWARDS);
		const usersCollection = db.collection(TABLE_USERS);
		const pollsCollection = db.collection(TABLE_POLLS);
		userId = (userId) ? newObjectIdDefault(userId) : "";

		const [
			emailTemplate,
			reward,
			profileFillupResult,
			insiderPollDetails
		] = await Promise.all([
			emailNewsletterCollection.countDocuments({
				user_id: userId,
				is_active: ACTIVE,
				attach_reward: { $exists: true }
			}),
			rewardsCollection.countDocuments({
				user_id: userId,
				is_active: ACTIVE,
			}),
			usersCollection.findOne({
				"_id": userId,
				"is_deleted": NOT_DELETED,
			}, { projection: { 'request_from': 1, 'public_business_informaton': 1 } }),
			pollsCollection.findOne({
				"user_id": userId,
				"type": POLL_AI_TYPE,
				// "is_deleted": NOT_DELETED,
				"first_ai_poll_generated": true
			}, { projection: { 'custom_url': 1 } })
		]);

		let publicBusinessInformaton = (profileFillupResult && profileFillupResult['public_business_informaton']) ? profileFillupResult['public_business_informaton'] : {};
		let redemptionCodeCheck = (publicBusinessInformaton['redemption_code']) ? publicBusinessInformaton['redemption_code'] : "";
		let businessIndustryCheck = (publicBusinessInformaton['business_industry']) ? publicBusinessInformaton['business_industry'] : "";

		let emailTemplateFillup = 0;
		let rewardFillup = 0;
		let AllActivityFillup = 0;
		let manageProfileFillup = 0;

		/** All activity fillup */
		if (emailTemplate && reward && redemptionCodeCheck && businessIndustryCheck) {
			AllActivityFillup = DEFAULT_ONE;
		}

		/** Email template fillup */
		if (emailTemplate) {
			emailTemplateFillup = DEFAULT_ONE;
		}

		/** Make reward fillup */
		if (reward) {
			rewardFillup = DEFAULT_ONE;
		}

		/** Redemption code and industry check*/
		if (redemptionCodeCheck && businessIndustryCheck) {
			manageProfileFillup = DEFAULT_ONE;
		}

		/*** remove this */
		if (profileFillupResult && profileFillupResult.request_from == 'ai_bot') {
			AllActivityFillup = DEFAULT_ONE;
		}

		return {
			'email_template_fillup': emailTemplateFillup,
			'reward_fillup': rewardFillup,
			'business_lead_activity': AllActivityFillup,
			'manage_profile_fillup': manageProfileFillup,
			'insider_poll_details': insiderPollDetails ? insiderPollDetails : {},
		};
	} catch (err) {
		return {
			'email_template_fillup': DEFAULT_ZERO,
			'reward_fillup': DEFAULT_ZERO,
			'business_lead_activity': DEFAULT_ZERO,
			'manage_profile_fillup': DEFAULT_ZERO,
			'insider_poll_details': {},
		};
	}
} //End getBusinessUserAllActivityUse();

/**
 * Function to update the reward name in the email template.
 * Uses async/await for all database operations.
 */
templateWiseRewardNameUpdate = async (rewardId, emailTemplateId) => {
	try {
		if (rewardId && emailTemplateId) {
			const rewardCollection = db.collection(TABLE_REWARDS);
			const emailTemplateCollection = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

			// Fetch reward details
			const rewardResult = await rewardCollection.findOne(
				{ _id: newObjectIdDefault(rewardId) },
				{ projection: { reward_text: 1 } }
			);

			if (rewardResult) {
				// Update the email template with the reward name
				await emailTemplateCollection.updateOne(
					{ _id: newObjectIdDefault(emailTemplateId) },
					{ $set: { 'attach_reward_name': rewardResult.reward_text } }
				);
			}
		}
		// Always resolve (no return value needed)
		return;
	} catch (err) {
		// Log error if needed
		return;
	}
}; // End templateWiseRewardNameUpdate();

/**
 * Function to assign a home lead using async/await.
 * Sets the specified lead as the home page and deactivates all others for the Pocial user.
 * All DB operations use async/await for clarity and reliability.
 */
assignLeadHomePage = async (leadId) => {
	try {
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		// Validate leadId
		if (!leadId) {
			// Send error response if no leadId provided
			return STATUS_ERROR;
		}

		// Prepare queries:
		// 1. Set the specified lead as home page (is_home_page = 1)
		// 2. Set all other leads as not home page (is_home_page = 0)
		const setHomePageQuery = leadsForms.updateOne(
			{ user_id: newObjectIdDefault(POCIAL_ID), _id: leadId },
			{ $set: { is_home_page: DEFAULT_ONE } }
		);

		const unsetOtherHomePagesQuery = leadsForms.updateMany(
			{ user_id: newObjectIdDefault(POCIAL_ID), _id: { $ne: leadId } },
			{ $set: { is_home_page: DEFAULT_ZERO } }
		);

		// Run both queries in parallel for faster response
		await Promise.all([setHomePageQuery, unsetOtherHomePagesQuery]);

		// Send success response
		return STATUS_SUCCESS;
	} catch (err) {
		// On error, send error response
		return STATUS_ERROR;
	}
}; // End assignLeadHomePage();

/**
* Function for use to assign home lead
* Updated: Uses async/await for all database operations
*/
defaultAssignPocialFollowerAndFollowers = async (userId) => {
	return new Promise(async (resolve) => {
		try {
			const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

			// Insert following new user (Pocial follows the new user)
			await usersFollower.insertOne({
				'user_id': newObjectIdDefault(POCIAL_ID),
				'followed_by': newObjectIdDefault(userId),
				'is_approved': ACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
				'status': ACTIVE,
				'modified': getUtcDate(),
				'created': getUtcDate(),
			});

			// Insert followers new user (New user follows Pocial)
			await usersFollower.insertOne({
				'user_id': newObjectIdDefault(userId),
				'followed_by': newObjectIdDefault(POCIAL_ID),
				'is_approved': ACTIVE,
				'action_type': FOLLOW_ACTION_TYPE,
				'status': ACTIVE,
				'modified': getUtcDate(),
				'created': getUtcDate(),
			});

			return resolve();
		} catch (error) {
			// Log error if needed
			return resolve();
		}
	});
} //End defaultAssignPocialFollowerAndFollowers();

/**
 * Function to get categories data using async/await.
 * Returns an array of categories with _id and name fields.
 */
getCategoriesData = async () => {
	try {
		const categories = db.collection(TABLE_CATEGORIES);

		// Find categories with status ACTIVE and not deleted
		const resultCat = await categories.find({ status: ACTIVE, is_deleted: NOT_DELETED }, { projection: { _id: 1, name: 1 } }).toArray();

		return { result: resultCat };
	} catch (err) {
		// On error, return empty result array
		return { result: [] };
	}
}; // End getCategoriesData();

/**
 * Function to send a test email template using async/await.
 * All DB queries are handled with async/await, and any parallel queries are run with Promise.all for efficiency.
 *
 * @return {String} STATUS_SUCCESS or STATUS_ERROR
 */
sendTestEmailTemplate = async (req, res, testMailOptions) => {
	try {
		// Prepare variables for parallel DB queries
		let attachRewardId = testMailOptions.attach_reward ? newObjectIdDefault(testMailOptions.attach_reward) : "";
		let loginUserData = req.user_data ? req.user_data : "";
		let signatureImage = loginUserData.signature_image ? loginUserData.signature_image : "";

		// Business details for the logged-in user
		let publicBusinessInformaton = loginUserData.public_business_informaton ? loginUserData.public_business_informaton : "";
		let nameOfTheBusiness = (publicBusinessInformaton && publicBusinessInformaton.name_of_the_business) ? publicBusinessInformaton.name_of_the_business : "";
		let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
		let businessRewardLogo = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";
		let businessIndustryName = (publicBusinessInformaton && publicBusinessInformaton.business_industry_name) ? publicBusinessInformaton.business_industry_name : "";
		let primaryAddress = (publicBusinessInformaton && publicBusinessInformaton.primary_address) ? publicBusinessInformaton.primary_address : "";
		let profileImageUrl = "";

		let email = testMailOptions.email;
		let pageBody = testMailOptions.page_body;
		let userEmail = res.locals.settings["Email.user_email"];
		let emailHost = res.locals.settings["Email.host"];
		let emailPassword = res.locals.settings["Email.password"];
		let emailPort = res.locals.settings["Email.port"];
		let emailUserName = res.locals.settings["Email.user_name"];

		// Prepare all DB queries that can be run in parallel
		let rewardPromise = null;
		if (attachRewardId !== "") {
			rewardPromise = getRewardDetails(attachRewardId);
		}

		// Await all parallel queries
		let resultRewards = "";
		if (rewardPromise) {
			[resultRewards] = await Promise.all([rewardPromise]);
		}

		// Set up nodemailer transporter
		const nodemailer = require("nodemailer");
		const transporter = nodemailer.createTransport({
			'host': emailHost,
			'port': emailPort,
			'secure': (emailPort == SMTP_SECURE_PORT) ? true : false, // true for SMTP_SECURE_PORT, false for other ports
			'auth': {
				user: userEmail,
				pass: emailPassword
			},
			'tls': {
				rejectUnauthorized: true
			}
		});

		// Replace constants in the email body
		pageBody = pageBody.replace(RegExp('{LINK}', 'g'), FRONT_URL);
		pageBody = pageBody.replace(RegExp('{WALLET_LINK}', 'g'), FRONT_URL);
		pageBody = pageBody.replace(RegExp('{POLL_PAGE_URL}', 'g'), FRONT_URL);
		pageBody = pageBody.replace(RegExp('{BUSINESS_ADDRESS}', 'g'), primaryAddress);
		pageBody = pageBody.replace(RegExp('{CURRENT_YEAR}', 'g'), new Date().getFullYear());
		pageBody = pageBody.replace(RegExp('{EMAIL_ENDING_SIGNATURE}', 'g'), "Best Regards,</br> " + nameOfTheBusiness);
		pageBody = pageBody.replace(RegExp('min-height:285px', 'g'), "height:285px");
		pageBody = pageBody.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);
		pageBody = pageBody.replace(RegExp('{BUSINESS_INDUSTRY}', 'g'), businessIndustryName);

		// Set profile image URL based on business reward logo or business logo
		if (businessRewardLogo !== '') {
			profileImageUrl = USERS_URL + businessRewardLogo;
		} else if (businessLogo !== '') {
			profileImageUrl = USERS_URL + businessLogo;
		}

		// Replace business image URL in the email body
		if (profileImageUrl !== '') {
			let imgSrc = '<img src="' + profileImageUrl + '" style="max-height:100px;" >';
			pageBody = pageBody.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), imgSrc);
		} else {
			pageBody = pageBody.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), '');
		}

		// Replace signature image or fallback to full name
		if (signatureImage) {
			let imgSignatureSrc = '<img src="' + SIGNATURE_URL + signatureImage + '" style="max-height:60px;" >';
			pageBody = pageBody.replace(RegExp('{SIGNATURE}', 'g'), imgSignatureSrc);
		} else {
			pageBody = pageBody.replace(RegExp('{SIGNATURE}', 'g'), loginUserData.full_name);
		}

		pageBody = pageBody.replace(RegExp('{USER_PROFILE_IMAGE}', 'g'), profileImageUrl);

		// If reward is attached, update reward-related placeholders
		if (resultRewards && loginUserData && attachRewardId !== "") {
			let rewardText = (resultRewards && resultRewards['reward_text'] != '') ? resultRewards['reward_text'] : "";
			let rewardSubHeading = (resultRewards && resultRewards['reward_sub_heading'] != '') ? resultRewards['reward_sub_heading'] : "";

			pageBody = pageBody.replace(RegExp('{REWARD_IMAGE}', 'g'), WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD);

			// Select a random color for the reward card
			const randomWalletRewardIndex = Math.floor(Math.random() * WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR.length);
			const randomRewardWalletColor = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR[randomWalletRewardIndex];
			pageBody = pageBody.replace(RegExp('{WALLET_RANDOM_COLOR_GRADIANT}', 'g'), randomRewardWalletColor);
			pageBody = pageBody.replace(RegExp('{REWARD_HEADING}', 'g'), rewardText);
			pageBody = pageBody.replace(RegExp('{REWARD_SUBHEADING}', 'g'), rewardSubHeading);
			pageBody = pageBody.replace(RegExp('{EMAIL_DESCRIPTION}', 'g'), '');
			pageBody = pageBody.replace(RegExp('{EMAIL_HEADING}', 'g'), '');
			pageBody = pageBody.replace(RegExp('{WELCOME_UNSUBSCRIBE_LINK}', 'g'), 'javascript:void(0)');
			pageBody = pageBody.replace(RegExp('{UNSUBSCRIBE_LINK}', 'g'), 'javascript:void(0)');
			pageBody = pageBody.replace(RegExp('href', 'g'), 'link');
		} else {
			// If no reward is attached, remove reward image placeholder
			pageBody = pageBody.replace(RegExp('{REWARD_IMAGE}', 'g'), '');
		}

		let mailOptions = {
			'from': emailUserName,
			'to': email,
			'subject': SEND_TEST_EMAIL_TEMPLATE_SUBJECT,
			'html': pageBody
		};

		// Send email using async/await
		let sendMailError = null;
		try {
			await transporter.sendMail(mailOptions);
		} catch (error) {
			sendMailError = error;
		}

		// Save email logs details using async/await
		const email_logs = db.collection(TABLE_EMAIL_LOGS);
		mailOptions.error = sendMailError;
		mailOptions.created = getUtcDate();
		await email_logs.insertOne(mailOptions);

		// Return status based on email send result
		if (sendMailError) {
			return STATUS_ERROR + '' + req;
		} else {
			return STATUS_SUCCESS;
		}
	} catch (err) {
		// On any error, return error status
		return STATUS_ERROR + '' + req;
	}
}; // End sendTestEmailTemplate();

/**
 * wkhtmltoimage wise html to DataUrl get 
 */
wkhtmltoDataUrlimage = (newPageBody) => {
	return new Promise(resolve => {
		const { exec } = require('child_process');
		const command = `echo '${newPageBody}' | wkhtmltoimage - - 2>/dev/null | base64`;
		exec(command, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error: ${error}`);
				return;
			}
			const dataUrl = `data:image/png;base64,${stdout}`;
			return resolve('<img src="' + dataUrl + '">')
		});
	});
} //End wkhtmltoDataUrlimage();

/**
 * Function to get reward details using async/await.
 * Returns reward details for the given rewardId, or null if not found or on error.
 *
 * @param {String|ObjectId} rewardId - The reward ID to look up.
 * @return {Promise<Object|null>} - The reward details or null.
 */
const getRewardDetails = async (rewardId) => {
	try {
		// Return null if rewardId is empty
		if (!rewardId) return null;

		const rewards = db.collection(TABLE_REWARDS);

		// Query reward details using async/await
		const resultRewards = await rewards.findOne(
			{ '_id': newObjectIdDefault(rewardId) },
			{ projection: { 'reward_text': 1, 'reward_sub_heading': 1 } }
		);

		return resultRewards || null;
	} catch (err) {
		// On error, return null
		return null;
	}
}; // End getRewardDetails()

/**
 * Function to upload embed background image using async/await.
 * Handles file upload, slug generation, and DB insert with proper error handling.
 *
 * @return {Promise<Object>} - The result object with status, result, and message.
 */
uplaodEmbedBackgroundImage = async (req, res, backgroundImageOptions) => {
	try {
		// Step 1: Upload user image
		const response = await moveUploadedFile(req, res, backgroundImageOptions);

		if (response.status == STATUS_ERROR) {
			// Send error response if upload failed
			const errMessageArray = [{ param: 'background_image', msg: response.message }];
			return {
				status: STATUS_ERROR,
				result: "",
				message: errMessageArray,
			};
		}

		const imageName = response.fileName ? response.fileName : "";

		// Step 2: Generate slug for the image
		const slugOptions = {
			title: imageName,
			table_name: TABLE_EMBEDS_BACKGROUND_IMAGE,
			slug_field: "slug"
		};
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Step 3: Prepare document for insertion
		const backGroundCollection = db.collection(TABLE_EMBEDS_BACKGROUND_IMAGE);
		const insertDoc = {
			user_id: newObjectIdDefault(backgroundImageOptions.user_id),
			lead_forms_id: newObjectIdDefault(backgroundImageOptions.lead_id),
			slug: (slugResponse && slugResponse.title) ? slugResponse.title : "",
			image: imageName,
			created: getUtcDate(),
		};

		// Step 4: Insert document into DB
		await backGroundCollection.insertOne(insertDoc);

		// Step 5: Return success response
		return {
			status: STATUS_SUCCESS,
			result: BACKGROUND_IMAGE_URL + imageName,
			message: "",
		};
	} catch (err) {
		// Handle any errors and return error response
		return {
			status: STATUS_ERROR_INVALID_ACCESS,
			result: "",
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End uplaodEmbedBackgroundImage()

/**
 * Converts a MongoDB date object to a simple date format (dd, mm, yy).
 * Uses async/await for future extensibility (e.g., if DB queries are needed).
 * If additional asynchronous operations are required in the future (e.g., fetching related data),
 * they can be run in parallel using Promise.all for efficiency.
 */
mongoDatetoSimpleDateConvert = async (dateofbirth) => {
	try {
		// If dateofbirth is provided, convert to simple date format
		if (dateofbirth) {
			// No DB queries here, but function is async for future-proofing
			const date = new Date(dateofbirth.toDateString());
			const birthMonth = date.getMonth() + 1;
			const birthDay = date.getDate();
			const birthYear = date.getFullYear();
			return { dd: birthDay, mm: birthMonth, yy: birthYear };
		} else {
			// Return empty values if dateofbirth is not provided
			return { dd: '', mm: '', yy: '' };
		}
	} catch (err) {
		// Handle any unexpected errors
		return { dd: '', mm: '', yy: '' };
	}
}; // End mongoDatetoSimpleDateConvert

/**
 * Function to add sub users globally using async/await.
 * All DB queries are handled with async/await for clarity and maintainability.
 * If any queries can be run in parallel, use Promise.all for efficiency.
 */
addSubUsersGlobally = async (req, res, optionData) => {
	try {
		const collection = db.collection(TABLE_SUB_USERS);

		// Prepare userId and input arrays
		let userId = (optionData.user_id) ? newObjectIdDefault(optionData.user_id) : newObjectIdDefault();
		let addSubmitType = (optionData.add_submit_type) ? optionData.add_submit_type : "";
		let frontCheckUserIds = (optionData.front_checked_user_ids && optionData.front_checked_user_ids.length > 0)
			? (optionData.front_checked_user_ids).toString().split(',')
			: [];
		let checkUserIds = (optionData.checked_user_ids && optionData.checked_user_ids.length > 0)
			? (optionData.checked_user_ids).toString().split(',')
			: [];

		// Convert checked user ids to ObjectId for admin
		let userIdsArray = [];
		if (checkUserIds.length > 0) {
			for (let ids of checkUserIds) {
				if (ids != '') {
					userIdsArray.push(newObjectIdDefault(ids));
				}
			}
		}
		checkUserIds = userIdsArray;

		// Convert checked user ids to ObjectId for front
		let frontUserIdsArray = [];
		if (frontCheckUserIds.length > 0) {
			for (let ids of frontCheckUserIds) {
				if (ids != '') {
					frontUserIdsArray.push(newObjectIdDefault(ids));
				}
			}
		}
		frontCheckUserIds = frontUserIdsArray;

		// Check if userId already exists
		const result = await collection.findOne(
			{ user_id: userId },
			{ projection: { _id: 1, selected_user: 1 } }
		);

		let id = (result) ? newObjectIdDefault(result._id) : newObjectIdDefault();

		// Admin-wise add data
		if (addSubmitType == ADMIN_SUB_USERS_ADD) {
			// Validation: No users selected and no existing record
			if (checkUserIds.length == 0 && !result) {
				return {
					status: STATUS_ERROR,
					data: req,
					message: res.__("admin.sub_user.please_select_atleast_one_user"),
				};
			}
			// Validation: No users selected but record exists, so delete
			else if (checkUserIds.length == 0 && result) {
				const deleteResult = await collection.deleteOne({ _id: id });
				if (deleteResult.deletedCount === 1) {
					return {
						status: STATUS_ERROR,
						message: res.__("admin.sub_user.all_selected_users_are_removed")
					};
				}
			}
			// Add or update sub users for admin
			else {
				let updateData = {
					user_id: userId,
					selected_user: userIdsArray,
					modified: getUtcDate()
				};
				await collection.updateOne(
					{ _id: id },
					{
						$set: updateData,
						$setOnInsert: { front_selected_user: [], created: getUtcDate() }
					},
					{ upsert: true }
				);
				return {
					status: STATUS_SUCCESS,
					message: res.__("admin.sub_user.sub_user_has_been_added_successfully")
				};
			}
		}
		// Front-wise selected add sub user
		else {
			if (result) {
				// Update front_selected_user for the user
				await collection.updateOne(
					{ user_id: userId },
					{ $set: { front_selected_user: frontCheckUserIds } }
				);
				return {
					status: (frontCheckUserIds.length > 0) ? STATUS_SUCCESS : STATUS_ERROR,
					message: (frontCheckUserIds.length > 0)
						? res.__("admin.sub_user.sub_user_has_been_added_successfully")
						: res.__("admin.sub_user.all_selected_users_are_removed"),
				};
			} else {
				return {
					status: STATUS_ERROR,
					message: res.__("admin.sub_user.no_sub_user_assign_you")
				};
			}
		}
	} catch (err) {
		// Handle any unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err
		};
	}
}; // End addSubUsersGlobally()

/** 
 * Function for use to redeem reward
 * Uses async/await for all DB queries.
 */
redeemRewardGlobally = async (req, res, options) => {
	try {
		const redemptionCode = options.redemption_code ? options.redemption_code.toString() : "";
		const condition = {
			'user_id': newObjectIdDefault(options.user_id),
			'slug': options.slug,
			'is_deleted': NOT_DELETED
		};

		const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

		// Find the reward for the user with the given slug and not deleted
		const resultWalletRewards = await earnRewards.find(condition, {
			projection: {
				"_id": 1,
				"expiry_date": 1,
				"redemption_code": 1,
				"toogle_expiry_date": 1,
			}
		}).toArray();

		if (resultWalletRewards && resultWalletRewards.length > 0) {
			const resultRewards = resultWalletRewards[0];
			const userRedeemedCode = resultRewards.redemption_code ? resultRewards.redemption_code.toString() : "";
			const expiryDate = resultRewards.expiry_date ? resultRewards.expiry_date : "";
			const toogleExpiryDate = resultRewards.toogle_expiry_date ? resultRewards.toogle_expiry_date : false;
			const currentDateTimeStamp = (toogleExpiryDate && expiryDate) ? getUtcDate().getTime() : "";
			const expiryDateTimeStamp = (toogleExpiryDate && expiryDate) ? expiryDate.getTime() : "";

			// Check if reward is expired
			if (toogleExpiryDate && expiryDateTimeStamp <= currentDateTimeStamp) {
				return {
					status: STATUS_ERROR,
					message: res.__("front.wallet.reward_has_expired")
				};
			}

			// Check if redemption code matches
			if (userRedeemedCode != redemptionCode) {
				return {
					status: STATUS_ERROR,
					message: res.__("front.wallet.redeemed_code_mismatch")
				};
			}

			// Update the reward as redeemed
			const updateResult = await earnRewards.updateOne(condition, {
				$set: {
					is_redemed: REDEMED,
					modified: getUtcDate(),
					redemed_date: getUtcDate(),
				}
			});

			if (updateResult && updateResult.modifiedCount > 0) {
				return {
					status: STATUS_SUCCESS,
					message: res.__("front.wallet.you_have_succesfully_redeemed_your_reward")
				};
			} else {
				return {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again")
				};
			}
		} else {
			return {
				status: STATUS_ERROR,
				message: res.__("front.wallet.invalid_reward")
			};
		}
	} catch (err) {
		// Handle any unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err
		};
	}
}; // End redeemRewardGlobally()

/**
 * Function to get overview lead dashboard count.
 * Uses async/await and Promise.all to run DB queries in parallel for faster response.
 */
overviewLeadCountDashboard = async (req, res, userIdsArray) => {
	try {
		let loginUserData = req.user_data ? req.user_data : "";
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		const conditionsData = {
			creator_id: { $in: userIdsArray }
		};

		// Get current user's ObjectId
		let loginUserId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";

		// Get the first day of the current month at midnight
		const currentMonth = getUtcDate();
		currentMonth.setDate(1);
		currentMonth.setHours(0, 0, 0, 0);

		// /** Admin according */
		if (loginUserId == '') {
			loginUserId = userIdsArray[0]
		}
		// Prepare loyalist user conditions
		const totalCountCondition = {
			"user_id": { $nin: [null, ""] },
			"make_poll_user_id": loginUserId
		};
		const monthlyCondition = {
			"created": { $gte: currentMonth, $lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) },
			"user_id": { $nin: [null, ""] },
			"make_poll_user_id": loginUserId
		};

		// Fetch loyalist user ids in parallel
		const [loyalistSubscriber, loyalistMonthlySubscriber] = await Promise.all([
			getLoyalistUserIds(totalCountCondition),
			getLoyalistUserIds(monthlyCondition)
		]);
		const totalLoyalistUserCount = loyalistSubscriber.total_user;
		const loyalistSubscriberIds = loyalistSubscriber.user_ids || [];
		const totalMonthlyUserCount = loyalistMonthlySubscriber.total_user;
		const loyalistMonthlySubscriberIds = loyalistMonthlySubscriber.user_ids || [];

		// Prepare aggregation pipelines
		const allLeadCountPipeline = [
			{ $match: conditionsData },
			{
				$group: {
					_id: null,
					"total_count": {
						$sum: {
							$cond: [
								{ $and: [] },
								1,
								0
							]
						}
					},
					"introduction": {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$stage_level", INTRODUCTION_LEVEL] }] },
								1,
								0
							]
						}
					},
					"growth": {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$stage_level", GROWTH_LEVEL] }] },
								1,
								0
							]
						}
					},
					"hot_leads": {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$stage_level", HOT_LEADS_LEVEL] },
										{ $not: { $in: ["$email_user_id", loyalistSubscriberIds] } }
									]
								},
								1,
								0
							]
						}
					},
				}
			}
		];

		const monthlyConditions = Object.assign({
			"created": {
				$gte: currentMonth,
				$lt: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
			}
		}, conditionsData);

		const currentMonthLeadCountPipeline = [
			{ $match: monthlyConditions },
			{
				$group: {
					_id: null,
					"introduction_month": {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$stage_level", INTRODUCTION_LEVEL] }] },
								1,
								0
							]
						}
					},
					"growth_month": {
						$sum: {
							$cond: [
								{ $and: [{ $eq: ["$stage_level", GROWTH_LEVEL] }] },
								1,
								0
							]
						}
					},
					"hot_leads_month": {
						$sum: {
							$cond: [
								{
									$and: [
										{ $eq: ["$stage_level", HOT_LEADS_LEVEL] },
										{ $not: { $in: ["$email_user_id", loyalistMonthlySubscriberIds] } }
									]
								},
								1,
								0
							]
						}
					},
				}
			}
		];

		// Run all DB queries in parallel for efficiency
		const [
			allLeadCount,
			currentMonthLeadCount
			// If you add more queries (e.g., hybrid counts), add them here and below
		] = await Promise.all([
			signupLeadForms.aggregate(allLeadCountPipeline).toArray(),
			signupLeadForms.aggregate(currentMonthLeadCountPipeline).toArray()
			// Add more queries here if needed
		]);

		// Hybrid counts are not implemented in the original code, so set to 0
		const introductionHybridCount = 0;
		const growthHybridCount = 0;
		const hotLeadHybridCount = 0;

		const totalLoyalistCount = totalLoyalistUserCount || 0;
		const loyalistMonth = totalMonthlyUserCount || 0;

		// Compose the response
		if (allLeadCount && allLeadCount.length > 0) {
			return {
				'total_leads': Number(
					(allLeadCount[0]['introduction'] || 0) +
					(allLeadCount[0]['growth'] || 0) +
					(allLeadCount[0]['hot_leads'] || 0) +
					totalLoyalistCount
				),
				'introduction': allLeadCount[0]['introduction'] || 0,
				'introduction_month': (currentMonthLeadCount.length > 0) ? (currentMonthLeadCount[0]['introduction_month'] || 0) : 0,
				'introduction_hybrid': introductionHybridCount,

				'growth': allLeadCount[0]['growth'] || 0,
				'growth_month': (currentMonthLeadCount.length > 0) ? (currentMonthLeadCount[0]['growth_month'] || 0) : 0,
				'growth_hybrid': growthHybridCount,

				'hot_leads': allLeadCount[0]['hot_leads'] || 0,
				'hot_leads_month': (currentMonthLeadCount.length > 0) ? (currentMonthLeadCount[0]['hot_leads_month'] || 0) : 0,
				'hot_leads_hybrid': hotLeadHybridCount,

				'loyalist_count': totalLoyalistCount,
				'loyalist_month': loyalistMonth,
			};
		} else {
			return {
				'total_leads': 0,
				'introduction': 0,
				'introduction_month': 0,
				'introduction_hybrid': 0,
				'growth': 0,
				'growth_month': 0,
				'growth_hybrid': 0,
				'hot_leads': 0,
				'hot_leads_month': 0,
				'hot_leads_hybrid': 0,
				'loyalist_count': 0,
				'loyalist_month': 0,
			};
		}
	} catch (err) {
		console.log(err);
		// Handle any unexpected errors
		return {
			total_leads: 0,
			introduction: 0,
			introduction_month: 0,
			introduction_hybrid: 0,
			growth: 0,
			growth_month: 0,
			growth_hybrid: 0,
			hot_leads: 0,
			hot_leads_month: 0,
			hot_leads_hybrid: 0,
			req: req,
			message: res.__("front.system.something_going_wrong_please_try_again"),
			error: err
		};
	}
}; // End overviewLeadCountDashboard()

/**
 * Function to add a welcome email template using async/await.
 * Handles DB queries with async/await for clarity and maintainability.
 * If any queries can be run in parallel, use Promise.all for efficiency.
 *
 * @param {Object} saveDataRecords - The data for the welcome email template.
 * @return {Promise<ObjectId|null>} - The inserted template's ID or null on error.
 */
addWelcomeEmailTemplate = async (saveDataRecords) => {
	try {
		// Determine the correct table based on save type
		let dynamicTableName = TABLE_WELCOME_EMAIL_TEMPLATES;
		if (saveDataRecords.save_type == EMAIL_TEMPLATE_AI_BOT_WELCOME_TYPE) {
			dynamicTableName = TABLE_AI_BOT_WELCOME_EMAIL_TEMPLATES;
		}

		const emailTemplate = db.collection(dynamicTableName);

		// Prepare slug options for unique action field
		const slugOptions = {
			title: saveDataRecords.subject,
			table_name: dynamicTableName,
			slug_field: "action"
		};

		// Run queries in parallel: check for active templates and generate slug
		const [resultActive, slugResponse] = await Promise.all([
			emailTemplate.find({ is_active: ACTIVE, is_deleted: NOT_DELETED }, { projection: { _id: 1 } }).toArray(),
			getDatabaseSlug(slugOptions)
		]);

		// Prepare the data to insert
		const insertedData = {
			'template_title': saveDataRecords.template_title || "",
			'action': (slugResponse && slugResponse.title) ? slugResponse.title : "",
			'description': saveDataRecords.description || "",
			'subject': saveDataRecords.subject || "",
			'body': saveDataRecords.body || "",
			'is_active': (resultActive.length > 0) ? DEACTIVE : ACTIVE,
			'design_json': saveDataRecords.design_json || "",
			'is_deleted': NOT_DELETED,
			'created': getUtcDate(),
			'modified': getUtcDate(),
		};

		// Insert the new email template
		const result = await emailTemplate.insertOne(insertedData);

		// Return the insertedId if successful, otherwise null
		return (result && result.insertedId) ? result.insertedId : null;
	} catch (err) {
		// On error, return null
		return null;
	}
}; // End addWelcomeEmailTemplate()

/**
 * Function to get active welcome template list using async/await.
 * Runs DB queries in parallel for faster response.
 *
 * @param {ObjectId|String} userId - The user ID to check for a custom welcome template.
 * @return {Promise<Object>} - The response object with template and SMTP info.
 */
getActiveWelcomeTemplate = async (userId) => {
	try {
		// Ensure userId is a valid ObjectId
		userId = userId ? newObjectIdDefault(userId) : newObjectIdDefault();

		const adminDefaultEmailTemplate = db.collection(TABLE_WELCOME_EMAIL_TEMPLATES);
		const userSaveEmailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		// Prepare queries
		const userTemplateQuery = userSaveEmailTemplate.findOne(
			{
				'user_id': userId,
				'skip_smtp': { $ne: true },
				'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
				'is_deleted': NOT_DELETED
			},
			{ projection: { 'from_email': 1, 'host': 1, 'port': 1, 'email_password': 1 } }
		);

		const adminTemplateQuery = adminDefaultEmailTemplate.findOne(
			{
				'is_active': ACTIVE,
				'is_deleted': NOT_DELETED
			},
			{ projection: { template_title: 1, action: 1, description: 1, subject: 1, body: 1, design_json: 1 } }
		);

		// Run both queries in parallel for efficiency
		const [resultUserTemplate, resultTemplate] = await Promise.all([
			userTemplateQuery,
			adminTemplateQuery
		]);

		// Compose the response
		return {
			status: STATUS_SUCCESS,
			is_draft: DEFAULT_ZERO,
			result: resultTemplate ? resultTemplate : {},
			already_smtp: resultUserTemplate ? resultUserTemplate : "",
		};
	} catch (err) {
		// Handle any errors and return error response
		return {
			status: STATUS_ERROR,
			is_draft: DEFAULT_ZERO,
			result: {},
			already_smtp: "",
			error: err
		};
	}
}; // End getActiveWelcomeTemplate()

/** Generate validate string in broadcast email template */
newsletterSubscriberEncId = (email) => {
	let currentTimeStamp = new Date().getTime();
	let encId = crypto.createHash('md5').update(currentTimeStamp + email).digest("hex");
	return encId;
} //End newsletterSubscriberEncId();

/** 
 * Delete image dynamic function using async/await.
 * Handles profile, banner, and reward image deletions with proper DB updates.
 * All DB and file operations are handled with async/await for clarity and maintainability.
 */
deleteImageDynamicFunction = async (req, res, optionsImageData) => {
	try {
		const userId = optionsImageData.user_id ? newObjectIdDefault(optionsImageData.user_id) : "";
		const imageName = optionsImageData.image_name ? optionsImageData.image_name : "";
		const imageType = optionsImageData.image_type ? optionsImageData.image_type : "";

		const usersCollection = db.collection(TABLE_USERS);

		const imagesData = {
			file_path: USERS_FILE_PATH + imageName
		};

		// Validate required fields
		if (!userId || !imageName || !imageType) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.user.image_has_been_not_deleted"),
			};
		}

		// Remove file and update DB based on image type
		if (imageType === USER_PROFILE_IMAGE_DELETE) {
			// Delete profile image
			await removeFile(imagesData);
			await usersCollection.updateOne(
				{ "_id": userId, "profile_image": imageName },
				{ $set: { "profile_image": "", "public_business_informaton.business_logo": "", "modified": getUtcDate() } }
			);
			return {
				status: STATUS_SUCCESS,
				message: res.__("front.user.logo_image_has_been_delete_successfully"),
			};
		} else if (imageType === USER_BANNER_IMAGE_DELETE) {
			// Delete banner image
			await removeFile(imagesData);
			await usersCollection.updateOne(
				{ "_id": userId, "public_business_informaton.business_banner": imageName },
				{ $set: { "public_business_informaton.business_banner": "", "modified": getUtcDate() } }
			);
			return {
				status: STATUS_SUCCESS,
				message: res.__("front.user.banner_image_has_been_delete_successfully"),
			};
		} else if (imageType === USER_REWARD_IMAGE_DELETE) {
			// Delete reward image
			await removeFile(imagesData);
			await usersCollection.updateOne(
				{ "_id": userId, "public_business_informaton.reward_image": imageName },
				{ $set: { "public_business_informaton.reward_image": "", "reward_image": "", "modified": getUtcDate() } }
			);
			return {
				status: STATUS_SUCCESS,
				message: res.__("front.user.reward_image_has_been_delete_successfully"),
			};
		} else {
			// Invalid image type
			return {
				status: STATUS_ERROR,
				message: res.__("front.user.image_has_been_not_deleted"),
			};
		}
	} catch (err) {
		// Handle any unexpected errors
		return {
			status: STATUS_ERROR,
			message: res.__("front.user.image_has_been_not_deleted"),
			error: err
		};
	}
}; // End deleteImageDynamicFunction()

/**
 * Function to save scripted code customization using async/await.
 * All DB queries are handled with async/await for clarity and maintainability.
 * If any queries can be run in parallel, use Promise.all for efficiency.
 */
generateScriptedCode = async (req, res, optionLeadsData) => {
	try {
		const leadId = (optionLeadsData.lead_id) ? newObjectIdDefault(optionLeadsData.lead_id) : "";
		const leadSlug = (optionLeadsData.lead_slug) ? optionLeadsData.lead_slug : "";
		const userId = optionLeadsData.user_id;
		const aiBot = (req.body.ai_bot) ? req.body.ai_bot : "";

		// Validate input
		if ((leadId !== '' || leadSlug) && userId !== '') {
			const collection = db.collection(TABLE_LEAD_FORMS);

			// Find the lead form by ID or slug using async/await
			const resultdata = await collection.findOne({
				$or: [
					{ _id: leadId },
					{ slug: leadSlug },
				]
			});

			if (resultdata) {
				const crtPkId = (resultdata._id) ? resultdata._id : "";

				// Prepare request body for customization save
				req.body.user_id = userId;
				req.body.lead_id = crtPkId;
				req.body.lead_slug = (resultdata.slug) ? resultdata.slug : "";
				req.body.ai_bot = aiBot;

				// Save the customized script using async/await
				const responseScripted = await userScriptedCodeCustomizationSave(req, res, req.body);

				const scriptedId = (responseScripted.scripted_id) ? responseScripted.scripted_id : "";
				const scriptedSlug = (responseScripted.scripted_slug) ? responseScripted.scripted_slug : "";
				const wholeScriptText = WITHOUT_SCRIPTED_ID_GENERATE_SCRIPTED_CODE
					.replace("{LEAD_ID}", crtPkId)
					.replace('data-scripted_id=""', 'data-scripted_id="' + scriptedId + '"');

				return {
					status: STATUS_SUCCESS,
					result: wholeScriptText,
					customized_script_id: scriptedId,
					customized_script_slug: scriptedSlug
				};
			} else {
				// Lead form not found
				return {
					status: STATUS_ERROR,
					result: "",
					customized_script_id: "",
					customized_script_slug: "",
				};
			}
		} else {
			// Invalid input
			return {
				status: STATUS_ERROR,
				result: "",
				customized_script_id: "",
			};
		}
	} catch (err) {
		// Handle any unexpected errors
		return {
			status: STATUS_ERROR,
			result: "",
			customized_script_id: "",
			error: err
		};
	}
}; // End generateScriptedCode()

/** 
 * Function to save scripted code customization using async/await.
 * Handles slug generation and upserts the customized script document.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} saveOptionData - Data for customization
 * @returns {Promise<Object>} Object containing scripted_id and scripted_slug
 */
userScriptedCodeCustomizationSave = async (req, res, saveOptionData) => {
	try {
		const uniqueName = saveOptionData.unique_name;
		const leadId = saveOptionData.lead_id;
		const mainComponent = saveOptionData.main_component;
		const heading = saveOptionData.heading;
		const banner = saveOptionData.banner;
		const description = saveOptionData.description;
		const formData = saveOptionData.form_data;
		const button = saveOptionData.button;
		const aiBot = req.body.ai_bot ? req.body.ai_bot : "";

		if (!uniqueName || !leadId) {
			// Required fields missing
			return;
		}

		// Generate slug for the customized script
		const slugOptions = {
			title: uniqueName,
			table_name: TABLE_CUSTOMIZED_SCRIPT,
			slug_field: "slug"
		};
		const slugResponse = await getDatabaseSlug(slugOptions);
		const scriptedSlug = (slugResponse && slugResponse.title) ? slugResponse.title : "";

		const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);

		// Prepare the update and insert data
		const updateData = {
			$set: {
				"main_component": {
					'background_color': (mainComponent.background_color).toString(),
					'border_color': (mainComponent.border_color).toString(),
					'border_pixel': (mainComponent.border_pixel).toString(),
					'border_style': (mainComponent.border_style).toString(),
					'all_checkbox': JSON.parse(mainComponent.all_checkbox),
					'left_checkbox': JSON.parse(mainComponent.left_checkbox),
					'right_checkbox': JSON.parse(mainComponent.right_checkbox),
					'top_checkbox': JSON.parse(mainComponent.top_checkbox),
					'bottom_checkbox': JSON.parse(mainComponent.bottom_checkbox),
					'border': (mainComponent.border).toString(),
					'border_radius': (mainComponent.border_radius).toString(),
					'main_box_shadow': JSON.parse(mainComponent.main_box_shadow),
					'main_container_width': (mainComponent.main_container_width).toString(),
					'main_custom_width': (mainComponent.main_custom_width).toString(),
					'shift_right': (mainComponent.shift_right) ? (mainComponent.shift_right).toString() : "",
					'shift_down': (mainComponent.shift_down) ? (mainComponent.shift_down).toString() : "",
					'spread': (mainComponent.spread) ? (mainComponent.spread).toString() : "",
					'blur': (mainComponent.blur) ? (mainComponent.blur).toString() : "",
					'hover_color': (mainComponent.hover_color) ? (mainComponent.hover_color).toString() : "",
					'inset': (mainComponent.inset) ? JSON.parse(mainComponent.inset) : false,
					'main_container_shadow': (mainComponent.main_container_shadow) ? (mainComponent.main_container_shadow).toString() : "",
				},
				"heading": {
					'title_checkbox': JSON.parse(heading.title_checkbox),
					'header_bold': JSON.parse(heading.header_bold),
					'header_italic': JSON.parse(heading.header_italic),
					'header_underline': JSON.parse(heading.header_underline),
					'header_textcolor': (heading.header_textcolor).toString(),
					'header_font_size': (heading.header_font_size).toString(),
					'header_font_family': (heading.header_font_family).toString(),
					'header_other_font_family': (heading.header_other_font_family).toString(),
					'heading_align': (heading.heading_align).toString(),
					'heading_transform_text': (heading.heading_transform_text).toString(),
				},
				"banner": {
					'banner_check_box': JSON.parse(banner.banner_check_box),
					'banner_border_color': (banner.banner_border_color) ? (banner.banner_border_color).toString() : "",
					'banner_border_radius': (banner.banner_border_radius) ? (banner.banner_border_radius).toString() : "0",
					'banner_border_pixel': (banner.banner_border_pixel) ? (banner.banner_border_pixel).toString() : "0",
					'banner_border_style': (banner.banner_border_style) ? (banner.banner_border_style).toString() : "",
					'banner_all_checkbox': JSON.parse(banner.banner_all_checkbox),
					'banner_top_checkbox': JSON.parse(banner.banner_top_checkbox),
					'banner_right_checkbox': JSON.parse(banner.banner_right_checkbox),
					'banner_bottom_checkbox': JSON.parse(banner.banner_bottom_checkbox),
					'banner_left_checkbox': JSON.parse(banner.banner_left_checkbox),
					'banner_width': (banner.banner_width) ? (banner.banner_width).toString() : "",
					'banner_custom_width': (banner.banner_custom_width) ? (banner.banner_custom_width).toString() : "",
					'banner_border': (banner.banner_border) ? (banner.banner_border).toString() : "",
					'banner_shadow': (banner.banner_shadow) ? JSON.parse(banner.banner_shadow) : false,
					'banner_inset': (banner.banner_inset) ? JSON.parse(banner.banner_inset) : false,
					'banner_shift_right': (banner.banner_shift_right) ? (banner.banner_shift_right).toString() : "",
					'banner_shift_down': (banner.banner_shift_down) ? (banner.banner_shift_down).toString() : "",
					'banner_spread': (banner.banner_spread) ? (banner.banner_spread).toString() : "",
					'banner_blur': (banner.banner_blur) ? (banner.banner_blur).toString() : "",
					'banner_hover_color': (banner.banner_hover_color) ? (banner.banner_hover_color).toString() : "",
					'banner_shadow_all_data': (banner.banner_shadow_all_data) ? (banner.banner_shadow_all_data).toString() : "",
				},
				"description": {
					'description_checkbox': JSON.parse(description.description_checkbox),
					'description_bold': JSON.parse(description.description_bold),
					'description_italic': JSON.parse(description.description_italic),
					'description_underline': JSON.parse(description.description_underline),
					'description_text_color': (description.description_text_color).toString(),
					'description_fontsize': (description.description_fontsize).toString(),
					'description_fontfamily': (description.description_fontfamily).toString(),
					'description_other_font_family': (description.description_other_font_family).toString(),
					'description_align': (description.description_align) ? (description.description_align).toString() : "",
					'description_transform_text': (description.description_transform_text) ? (description.description_transform_text).toString() : "",
				},
				"form_data": {
					'form_title_chkboxshow': JSON.parse(formData.form_title_chkboxshow),
					'form_title_bold': JSON.parse(formData.form_title_bold),
					'form_title_bold': JSON.parse(formData.form_title_bold),
					'form_title_italic': JSON.parse(formData.form_title_italic),
					'form_title_underline': JSON.parse(formData.form_title_underline),
					'form_title_textcolor': (formData.form_title_textcolor).toString(),
					'form_title_fontsize': (formData.form_title_fontsize).toString(),
					'form_title_fontfamily': (formData.form_title_fontfamily).toString(),
					'form_title_other_font_family': (formData.form_title_other_font_family).toString(),
					'form_title_align': (formData.form_title_align) ? (formData.form_title_align).toString() : "",
					'form_title_transform_text': (formData.form_title_transform_text) ? (formData.form_title_transform_text).toString() : "",

					'form_label_chkboxshow': JSON.parse(formData.form_label_chkboxshow),
					'form_label_bold': JSON.parse(formData.form_label_bold),
					'form_label_italic': JSON.parse(formData.form_label_italic),
					'form_label_underline': JSON.parse(formData.form_label_underline),
					'label_color': (formData.label_color).toString(),
					'form_label_fontsize': (formData.form_label_fontsize).toString(),
					'form_label_fontfamily': (formData.form_label_fontfamily).toString(),
					'form_label_other_font_family': (formData.form_label_other_font_family).toString(),
					'form_label_align': (formData.form_label_align) ? (formData.form_label_align).toString() : "",
					'form_label_transform_text': (formData.form_label_transform_text) ? (formData.form_label_transform_text).toString() : "",

					'text_boxborder_radius': (formData.text_boxborder_radius).toString(),
					'text_box_height': (formData.text_box_height).toString(),
					'text_box_color': (formData.text_box_color).toString(),
					'text_box_border_color': (formData.text_box_border_color) ? (formData.text_box_border_color).toString() : "",
					'textbox_width': (formData.textbox_width) ? formData.textbox_width : [],
					'textbox_shadow': (formData.textbox_shadow) ? JSON.parse(formData.textbox_shadow) : false,
					'textbox_shift_right': (formData.textbox_shift_right) ? (formData.textbox_shift_right).toString() : "",
					'textbox_shift_down': (formData.textbox_shift_down) ? (formData.textbox_shift_down).toString() : "",
					'textbox_spread': (formData.textbox_spread) ? (formData.textbox_spread).toString() : "",
					'textbox_blur': (formData.textbox_blur) ? (formData.textbox_blur).toString() : "",
					'textbox_hover_color': (formData.textbox_hover_color) ? (formData.textbox_hover_color).toString() : "",
					'textbox_inset': (formData.textbox_inset) ? JSON.parse(formData.textbox_inset) : false,
					'textbox_shadow_all_data': (formData.textbox_shadow_all_data) ? (formData.textbox_shadow_all_data).toString() : "",
				},
				"button": {
					'button_bold': JSON.parse(button.button_bold),
					'button_italic': JSON.parse(button.button_italic),
					'button_underline': JSON.parse(button.button_underline),
					'button_background_color': (button.button_background_color) ? (button.button_background_color).toString() : "",
					'button_textcolor': (button.button_textcolor) ? (button.button_textcolor).toString() : "",
					'border_radius_size': (button.border_radius_size) ? (button.border_radius_size).toString() : "0",
					'button_align': (button.button_align) ? (button.button_align).toString() : "",
					'button_width_option': (button.button_width_option) ? (button.button_width_option).toString() : "",
					'width_percentage_size': (button.width_percentage_size) ? (button.width_percentage_size).toString() : "",
					'button_hover': (button.button_hover) ? JSON.parse(button.button_hover) : "",
					'button_transform_text': (button.button_transform_text) ? (button.button_transform_text).toString() : "",
					'button_height': (button.button_height) ? (button.button_height).toString() : "",
					'button_hover_background_color': (button.button_hover_background_color) ? (button.button_hover_background_color).toString() : "",
					'button_hover_text_color': (button.button_hover_text_color) ? (button.button_hover_text_color).toString() : "",
					'button_hover_border_color': (button.button_hover_border_color) ? (button.button_hover_border_color).toString() : "",
				},
				"modified": getUtcDate(),
			},
			$setOnInsert: {
				"user_id": (req.body.user_id) ? newObjectIdDefault(req.body.user_id) : "",
				"lead_forms_slug": (req.body.lead_slug) ? req.body.lead_slug : "",
				"unique_name": uniqueName,
				"ai_bot": aiBot,
				"is_deleted": NOT_DELETED,
				"slug": scriptedSlug,
				"created": getUtcDate(),
			}
		};

		// Upsert the customized script document
		const result = await customizedScript.findOneAndUpdate(
			{
				'lead_forms_id': newObjectIdDefault(leadId),
				'unique_name': { $regex: "^" + uniqueName + "$", $options: "i" }
			},
			updateData,
			{ upsert: true, returnDocument: 'after' }
		);

		let scriptedId = "";
		if (result && result.lastErrorObject) {
			if (result.lastErrorObject.updatedExisting) {
				scriptedId = (result.value && result.value._id) ? result.value._id : "";
			} else {
				scriptedId = (result.lastErrorObject.upserted) ? result.lastErrorObject.upserted : "";
			}
		}

		return {
			'scripted_id': scriptedId,
			'scripted_slug': scriptedSlug
		};
	} catch (err) {
		// In case of error, return nothing (could be enhanced to return error info)
		return;
	}
}; // End userScriptedCodeCustomizationSave()

/**
 * Function to check for duplicate customized script.
 * Ensures that unique_name is not repeated for the same lead ID or slug.
 *
 * @returns {Object} Response object with status and result
 */
duplicateGenerateScriptCheck = async (options) => {
	try {
		// Extract & prepare parameters
		const leadId = options.lead_forms_id ? newObjectIdDefault(options.lead_forms_id) : "";
		const leadFormsSlug = options.lead_forms_slug || "";
		const uniqueName = options.unique_name || "";
		const customizedScriptId = options.customized_script_id ? newObjectIdDefault(options.customized_script_id) : "";

		const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);

		// Define search condition
		const conditions = {
			_id: { $ne: customizedScriptId }, // Exclude current record
			unique_name: { $regex: `^${uniqueName}$`, $options: "i" }, // Case-insensitive match
			$or: [
				{ lead_forms_id: leadId },
				{ lead_forms_slug: leadFormsSlug },
			],
		};

		// Execute query (async/await instead of callback)
		const resultData = await customizedScript.findOne(
			conditions,
			{ projection: { _id: 1 } }
		);

		// Return standardized response
		if (resultData) {
			return {
				status: STATUS_SUCCESS,
				result: resultData,
			};
		} else {
			return {
				status: STATUS_ERROR,
				result: {},
			};
		}
	} catch (err) {
		// Handle unexpected errors
		return {
			status: STATUS_ERROR,
			message: err.message,
			result: {},
		};
	}
}; // End duplicateGenerateScriptCheck()


/**
 * Function for deleting a script customization dynamically
 * 
 * @param {Object} options - Input parameters
 * @param {string} options.user_id - User ID who owns the script
 * @param {string} options.customized_script_slug - Slug of the script to delete
 * 
 * @returns {string} STATUS_SUCCESS | STATUS_ERROR
 */
deleteScriptCustomizationDynamically = async (options) => {
	try {
		// Extract parameters
		let userId = (options.user_id) ? newObjectIdDefault(options.user_id) : "";
		let customizedScriptSlug = (options.customized_script_slug) ? options.customized_script_slug : "";

		// Get collection reference
		const customizedScript = db.collection(TABLE_CUSTOMIZED_SCRIPT);

		// Perform delete operation using async/await
		const deleteResult = await customizedScript.deleteOne({
			'slug': customizedScriptSlug,
			'user_id': newObjectIdDefault(userId)
		});

		/** Send response **/
		if (deleteResult.deletedCount > 0) {
			// Successfully deleted
			return STATUS_SUCCESS;
		} else {
			// No matching record found
			return STATUS_ERROR;
		}
	} catch (err) {
		// Handle error properly
		return STATUS_ERROR;
	}
}; // End deleteScriptCustomizationDynamically()

/**
 * Function to fetch full width fields from dropdown values in scripted code
 * 
 * @param {Object} options - Input parameters
 * @param {string} options.lead_forms_id - Lead form ID
 * @param {string} options.lead_forms_slug - Lead form slug
 * 
 * @returns {Object} - Object containing result array of fields
 */
dropdownFullWidthFields = async (options) => {
	try {
		// Extract parameters
		let leadId = (options.lead_forms_id) ? newObjectIdDefault(options.lead_forms_id) : "";
		let leadFormsSlug = (options.lead_forms_slug) ? options.lead_forms_slug : "";

		// Get collection reference
		const collection = db.collection(TABLE_LEAD_FORMS);

		// Define search conditions
		let conditions = {
			'$or': [
				{ _id: leadId },
				{ slug: leadFormsSlug },
			]
		};

		// Execute query with projection
		const resultData = await collection.findOne(
			conditions,
			{ projection: { signup_fields: 1, message_box_title: 1, type_dropdown_title: 1 } }
		);

		/** Send response **/
		if (resultData && Object.keys(resultData).length > 0) {
			let arrayObjectData = [];
			let onlyActiveField = (resultData.signup_fields) ? resultData.signup_fields : [];
			let messageBoxTitle = (resultData.message_box_title) ? resultData.message_box_title : [];
			let typeSropdownTitle = (resultData.type_dropdown_title) ? resultData.type_dropdown_title : [];

			/** message data */
			if (messageBoxTitle.length > 0) {
				messageBoxTitle.map(recordsMessage => {
					onlyActiveField.push(recordsMessage.label);
				});
			}

			/** select box data */
			if (typeSropdownTitle.length > 0) {
				typeSropdownTitle.map(recordsDropdown => {
					onlyActiveField.push(recordsDropdown.label);
				});
			}

			/** Create array json **/
			onlyActiveField.map(jsonRecords => {
				let idData = "full_width_" + jsonRecords.replace(RegExp(" ", 'g'), "_").toLowerCase();
				let textData = (jsonRecords.replace("image_name", "Upload Image"));
				textData = (textData).toUpperCase();

				arrayObjectData.push({ 'id': idData, 'text': textData });
			});

			return {
				result: arrayObjectData
			};
		} else {
			// No data found case
			return {
				result: []
			};
		}
	} catch (err) {
		// Error handling
		return {
			result: [],
			error: err.message
		};
	}
}; // End dropdownFullWidthFields()


/** 
 * Email template save draft panel 
 */
saveEmailTemplateDraftSave = async (saveDataRecords) => {
	try {
		// Extract parameters
		let userId = (saveDataRecords.user_id) ? newObjectIdDefault(saveDataRecords.user_id) : "";
		let templateType = (saveDataRecords.template_type) ? saveDataRecords.template_type : "";
		let templateId = (saveDataRecords.template_id) ? newObjectIdDefault(saveDataRecords.template_id) : "";

		let templateTitle = (saveDataRecords.template_title) ? saveDataRecords.template_title : "";
		let pageBody = (saveDataRecords.body) ? saveDataRecords.body : "";
		let designJson = (saveDataRecords.design_json) ? saveDataRecords.design_json : "";
		let description = (saveDataRecords.description) ? saveDataRecords.description : "";
		let subject = (saveDataRecords.subject) ? saveDataRecords.subject : "";

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		if (templateId !== '') {
			/** Update existing email draft template */
			await emailTemplate.updateOne(
				{
					'_id': templateId,
					'user_id': userId
				},
				{
					$set: {
						'template_title': templateTitle,
						'subject': subject,
						'body': pageBody,
						'is_active': DEACTIVE,
						'description': description,
						'design_json': designJson,
						'status': DRAFT_STATUS,
						'modified': getUtcDate(),
					}
				}
			);

			return { status: STATUS_SUCCESS };
		} else {
			/** Generate slug for new draft */
			let slugOptions = {
				title: saveDataRecords.template_title,
				table_name: TABLE_EMAIL_NEWSLETTER_TEMPLATE,
				slug_field: "action"
			};

			// Wait for slug generation
			const slugResponse = await getDatabaseSlug(slugOptions);

			/** Insert new draft email template */
			await emailTemplate.insertOne({
				'user_id': userId,
				'template_title': templateTitle,
				'action': (slugResponse && slugResponse.title) ? slugResponse.title : "",
				'body': pageBody,
				'design_json': designJson,
				'description': description,
				'subject': subject,
				'is_active': DEACTIVE,
				'template_type': templateType,
				'is_deleted': NOT_DELETED,
				'status': DRAFT_STATUS,
				'modified': getUtcDate(),
				'created': getUtcDate()
			});

			return { status: STATUS_SUCCESS };
		}
	} catch (err) {
		// Error handling
		return { status: STATUS_ERROR };
	}
}; // End saveEmailTemplateDraftSave();

/**
 * function for use to video conver to image thumbnail 
 */
videoThumbnailImageCreate = (req, res, optionsData) => {
	return new Promise(resolve => {
		let questionMediaName = (optionsData.file_name) ? optionsData.file_name : "";
		let width = (optionsData.width) ? optionsData.width : "";
		let height = (optionsData.height) ? optionsData.height : "";
		let srcPath = (optionsData.src_path) ? optionsData.src_path : "";
		let desPath = (optionsData.des_path) ? optionsData.des_path : "";

		if (questionMediaName && width && height) {
			/** split use to same name to thumbnail*/
			let videoImageName = questionMediaName.split(".");
			videThumbnailImageName = videoImageName[0] + '.png';

			let sourcePath = srcPath + questionMediaName;
			let destinationPath = desPath + videThumbnailImageName;

			async function runThumbnail() {
				try {
					await genThumbnail(sourcePath, destinationPath, width + 'x' + height)
				} catch (err) {
					console.error(err)
				}
			}
			runThumbnail();
		} else {
			return resolve()
		}
	});
} //End videoThumbnailImageCreate();

/**
 * Function to check if same option already exists in polls
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Object} options - Input parameters
 * @param {string} options.user_id - User ID
 * @param {string} options.options_title - Poll option title
 * @param {string} options.poll_slug - Poll slug
 * 
 * @returns {Object} JSON response with status and result
 */
samePollsOptionsCheck = async (req, res, options) => {
	try {
		// Extract parameters
		let userId = (options.user_id) ? newObjectIdDefault(options.user_id) : "";
		let optionsTitle = (options.options_title) ? options.options_title : "";
		let pollSlug = (options.poll_slug) ? options.poll_slug : "";

		// Execute query using async/await
		const optionData = await db.collection(TABLE_POLLS).findOne(
			{
				'user_id': userId,
				'slug': pollSlug,
				'options': {
					$elemMatch: {
						title: { $regex: "^" + optionsTitle + "$", $options: "i" }
					}
				}
			},
			{ projection: { _id: 1 } }
		);

		/** Send response **/
		if (optionData && Object.keys(optionData).length > 0) {
			return {
				status: STATUS_SUCCESS,
				result: optionData,
			};
		} else {
			return {
				status: STATUS_ERROR,
				result: {},
			};
		}
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			message: err.message,
			result: {},
		};
	}
}; // End samePollsOptionsCheck()
/**
 * Function for use to unique custom Url check
 *
 * @param value As email value
 * @param req As Request Data
 *
 * @return json
 */
uniqueCustomUrlCheck = async (req, res, options) => {
	let customUrl = (options.custom_url) ? options.custom_url : "";
	let pollSlug = (options.slug) ? options.slug : "";

	return new Promise(async (resolve) => {
		try {
			let urlData = await db.collection(TABLE_POLLS).findOne(
				{
					'slug': { $ne: pollSlug },
					'custom_url': { $regex: "^" + customUrl + "$", $options: "i" },
				},
				{ projection: { _id: 1 } }
			);

			urlData = urlData ? urlData : {};

			/** Send response **/
			if (Object.keys(urlData).length > 0) {
				response = {
					status: STATUS_SUCCESS,
					result: urlData,
				};
				return resolve(response);
			} else {
				response = {
					status: STATUS_ERROR,
					result: urlData
				};
				return resolve(response);
			}
		} catch (err) {
			/** Catch error response **/
			response = {
				status: STATUS_ERROR,
				result: {},
				error: err.message,
				req: req,
				res: res,
			};
			return resolve(response);
		}
	});
} //End uniqueCustomUrlCheck();


/**
 * Function to upload excel file
 *
 * @param req		As Request Data
 * @param res		As Response Data
 * @param data		As file
 * @param filePath	As Path of Destination Directory
 * @param oldPath	As Old file name
 * @param callback	As CallBack Function
 *
 * @return json
 */
uploadedExcelFile = function (req, res, file, filePath, oldPath, callback) {
	if (file == '') {
		callback(STATUS_SUCCESS, { fileName: oldPath });
	} else {
		var fileData = (file.name) ? file.name.split('.') : [];
		var uploadFileName = (file.name) ? file.name : '';
		var extension = (fileData) ? fileData.pop().toLowerCase() : '';
		if (ALLOWED_EXCEL_EXTENSIONS.indexOf(extension) == -1) {
			callback(STATUS_ERROR, ALLOWED_EXCEL_ERROR_MESSAGE);
		} else {
			/*** function for use to S3 aws upload file */
			if (UPLOAD_TO_S3) {
				/** Create new folder of this month **/
				const today = new Date();
				let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';

				let newFileName = newFolder + Date.now() + '-' + changeFileName(uploadFileName);

				let targetFolder = filePath.split('/') // create upload folder name for bucket
				targetFolder = targetFolder[targetFolder.length - 2];  //outout --leads_excel

				/** S3 upload file */
				uploadToS3({
					'file_path': filePath,
					'file_name': newFileName,
					'image': file,
					'target_folder': targetFolder + '/' + newFileName,
				}).then((s3Response) => {
					if (s3Response.status == STATUS_ERROR) {
						callback(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					} else {
						var response = { 'fileName': newFileName };
						callback(STATUS_SUCCESS, response);
					}
				});
			} else {
				/** Create new folder of this month **/
				const today = new Date();
				let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
				createFolder(filePath + newFolder);

				let newFileName = newFolder + Date.now() + '-' + changeFileName(uploadFileName);
				let uploadedFile = filePath + newFileName;

				/** move file to folder*/
				file.mv(uploadedFile, function (err) {
					if (err) {
						callback(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					} else {
						var response = { fileName: newFileName };
						callback(STATUS_SUCCESS, response);
					}
				});
			}
		}
	}
};//End uploadedExcelFile()

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
 * Function for use to get excel first column data
 **/
getExcelFirstColumnData = (req, res) => {
	return new Promise(resolve => {
		var userImportFile = (req.files && req.files.user_import_file) ? req.files.user_import_file : "";
		var uploadEnterpriseFile = (req.files && req.files.upload_enterprise_file) ? req.files.upload_enterprise_file : "";
		var uploadFilePath = LEADS_EXCEL_FILE_PATH;

		/**enterprises according data */
		if (uploadEnterpriseFile != '') {
			userImportFile = uploadEnterpriseFile;
			uploadFilePath = ENTERPRISE_UPLOAD_EXCEL_FILE_PATH;
		}

		if (userImportFile) {
			uploadedExcelFile(req, res, userImportFile, uploadFilePath, '', async (responseType, response) => {
				if (responseType == STATUS_ERROR) {
					/**Send Error Response*/
					return resolve({
						status: STATUS_ERROR,
						result: [],
						file_name: "",
						extension: "",
						message: response
					});
				} else {
					let usersFileName = (response.fileName) ? response.fileName : "";
					let extension = getFileExtension(usersFileName);
					const filePath = uploadFilePath + usersFileName;

					/** csv import condition */
					if (extension == 'csv') {
						let es = require('event-stream');
						let lineNumber = 0;

						let s3Stream = "";
						if (UPLOAD_TO_S3) {
							const params = {
								Bucket: process.env.AWS_BUCKET_NAME,
								Key: filePath
							};
							s3Stream = s3.getObject(params).createReadStream();
						} else {
							s3Stream = fs.createReadStream(filePath);
						}

						s3Stream.pipe(es.split()).pipe(es.mapSync(function (line) {
							lineNumber = lineNumber + 1;
							let rows = splitCsv(line);

							/** One row get data and something with row 1 like save as column names */
							if (lineNumber == 1) {
								if (line) {
									/**Send success Response*/
									return resolve({
										status: STATUS_SUCCESS,
										result: rows,
										file_name: usersFileName,
										extension: extension,
										message: res.__("admin.lead_file.you_have_successfully_get_column")
									});
								} else {
									/**Send Error Response*/
									return resolve({
										status: STATUS_ERROR,
										result: [],
										file_name: "",
										extension: extension,
										message: res.__("admin.users.no_column_data")
									});
								}
							}
						}).on('error', function (err) {
							/**Send Error Response*/
							return resolve({
								status: STATUS_ERROR,
								result: [],
								file_name: "",
								extension: extension,
								message: res.__("admin.users.no_column_data")
							});
						}).on('end', function () {
							/**Send Error Response*/
							return resolve({
								status: STATUS_ERROR,
								result: [],
								file_name: "",
								extension: extension,
								message: res.__("admin.users.no_column_data")
							});
						}));
					} else {
						/** xlsx import condition */
						const fs = require('fs');
						const XlsxStreamReader = require("xlsx-stream-reader");

						var workBookReader = new XlsxStreamReader({
							verbose: true,
							formatting: true,
						});

						workBookReader.on('error', function (error) {
							throw (error);
						});
						workBookReader.on('worksheet', function (workSheetReader) {
							/** if we do not listen for rows we will only get end event and have infor about the sheet like row count*/
							if (workSheetReader.id == 1 || workSheetReader.id == '1') {
								workSheetReader.on('row', function (row) {
									/**One row get data*/
									if (row.attributes.r == 1) {
										/** do something with row 1 like save as column names*/
										let sendData = (row && row.values) ? row.values : [];

										if (sendData.length > 0) {
											sendData = sendData.slice(1);
											/**Send success Response*/
											return resolve({
												status: STATUS_SUCCESS,
												result: sendData,
												file_name: usersFileName,
												extension: extension,
												message: res.__("admin.lead_file.you_have_successfully_get_column")
											});
										} else {
											/**Send Error Response*/
											return resolve({
												status: STATUS_ERROR,
												result: [],
												file_name: "",
												extension: extension,
												message: res.__("admin.users.no_column_data")
											});
										}
									}
								});
							}
							workSheetReader.process();
						});
						workBookReader.on('end', function () {
							/**Send Error Response*/
							return resolve({
								status: STATUS_ERROR,
								result: [],
								file_name: "",
								extension: extension,
								message: res.__("admin.users.no_column_data")
							});
						});
						if (UPLOAD_TO_S3) {
							const params = {
								Bucket: process.env.AWS_BUCKET_NAME,
								Key: filePath
							};
							s3.getObject(params).createReadStream().pipe(workBookReader)
						} else {
							fs.createReadStream(filePath).pipe(workBookReader)
						}
					}
				}
			});
		} else {
			/**Send Error Response*/
			return resolve({
				status: STATUS_ERROR,
				result: [],
				file_name: "",
				extension: "",
				message: res.__("admin.user.please_select_file")
			});
		}
	});
} //End getExcelFirstColumnData();

/**
 * Function for use to save leads excel/csv file data in DB
 **/
leadImportFileDataSaveInDB = async (req, res, options) => {
	try {
		/** Slug generate */
		let slugOptions = {
			title: options.title,
			table_name: TABLE_LEADS_IMPORT,
			slug_field: "slug"
		};

		// Wait for slug generation
		let slugResponse = await getDatabaseSlug(slugOptions);

		let selectedColumnName = options.column_name ? options.column_name : [];
		let selectedColumnindex = options.column ? options.column : [];
		let ignoreColumnCheckbox = options.ignore_column ? options.ignore_column : [];
		let combineFirstNameToggle = options.combine_first_name_toggle ? options.combine_first_name_toggle : false;

		let columnSelectedObejct = [];

		// Fixed columns depend on toggle
		let fixedColumnDataArray = combineFirstNameToggle ? USER_LEAD_FIXED_COLUMN_NAME_TOOGLE_ON : USER_LEAD_FIXED_COLUMN_NAME;

		/** Prepare selected column object data */
		fixedColumnDataArray.map((recordSelected, indexSelected) => {
			let selectedColumnIndex = selectedColumnindex[indexSelected];
			let ignoreColumnValue = ignoreColumnCheckbox[indexSelected];

			columnSelectedObejct.push({
				'fix_column_name': recordSelected,
				'selected_column_index': selectedColumnIndex,
				'selected_column_name': selectedColumnName[selectedColumnIndex],
				'ignore_column_value': ignoreColumnValue
			});
		});

		/** Save data in DB */
		let csvImport = db.collection(TABLE_LEADS_IMPORT);

		let resultImport = await csvImport.insertOne({
			'title': options.title,
			'file_name': options.file_name,
			'extension': options.extension,
			'user_id': options.user_id,
			'lead_id': options.lead_id,
			'column': options.column,
			'column_name': options.column_name ? options.column_name : [],
			'ignore_column': options.ignore_column ? options.ignore_column : [],
			'all_column_value': columnSelectedObejct,
			'upload': options.upload,
			'is_process': LEADS_PENDING_EXCEL_PROCESS,
			'send_welcome_email': options.send_welcome_email,
			'warning_records': DEFAULT_ZERO,
			'total_records': DEFAULT_ZERO,
			'success_records': DEFAULT_ZERO,
			'failed_records': DEFAULT_ZERO,
			'combine_first_name_toggle': combineFirstNameToggle,
			'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
			'created': getUtcDate(),
		});

		// If no data inserted
		if (!resultImport || !resultImport.insertedId) {
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			};
		}

		/** Start Audience entries data (Excel) */
		let optionLogsData = {
			'user_id': options.user_id,
			'title': options.title,
			'lead_forms_id': options.lead_id,
			'lead_import_id': resultImport.insertedId
		};
		await submitForAudienceEntries(req, res, optionLogsData);
		/** End Audience entries data */

		return {
			status: STATUS_SUCCESS,
			message: res.__("admin.users.ecxel_has_been_added_successfully")
		};

	} catch (errImport) {
		/** Send error Response */
		return {
			status: STATUS_ERROR,
			message: res.__("admin.system.something_going_wrong_please_try_again")
		};
	}
} // End leadImportFileDataSaveInDB();


/**
 * Update complete process after all leads excel insert
 * Uses async/await for database queries and clean formatting.
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {String|ObjectId} csvImportId - The ID of the CSV import
 * @returns {Promise<void>}
 */
completeStatusUpdateAfterAllLeadsExcelInsert = async (req, res, csvImportId) => {
	const leadImportLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);
	const csvImport = db.collection(TABLE_LEADS_IMPORT);

	try {
		// Wait for 500ms before checking the logs (to allow for any pending inserts)
		await new Promise(resolve => setTimeout(resolve, 500));

		// Count documents in logs where the process is still DEACTIVE for this import
		const countResult = await leadImportLogs.countDocuments({
			'csv_id': newObjectIdDefault(csvImportId),
			'is_process': DEACTIVE
		});

		// If all records are processed, update the import status to complete
		if (countResult === 0) {
			await csvImport.updateOne(
				{ _id: newObjectIdDefault(csvImportId) },
				{ $set: { 'is_process': LEADS_COMPLETE_EXCEL_PROCESS } }
			);
		}
		// No explicit return value needed; function resolves when done
		return;
	} catch (err) {
		// Log error for debugging
		console.error("Error in complete Status Update After AllLeads Excel Insert:", err);
		return;
	}
}; // End completeStatusUpdateAfterAllLeadsExcelInsert

/**
 * Function to get month date yaer in excel format
 *
 * @param date 		as	Date object
 * @param format 	as 	Date format
 *
 * @return date string
 */
importExcelDateUtcDate = (dateofbirth) => {
	if (dateofbirth) {
		dateofbirth = dateofbirth.toString();
		var array = new Array();
		array = dateofbirth.split('-');

		let month = array[0];
		let day = array[1];
		let year = array[2];
		return (day + "-" + month + "-" + year);
	} else {
		return "";
	}
}//end importExcelDateUtcDate();

/**
 * Function to delete a pending Excel import file using async/await.
 * Handles DB queries and file removal in sequence.
 */
deletePendingImportExcelFile = async (req, res, optionLeadsExcel) => {
	try {
		const userId = optionLeadsExcel.user_id ? newObjectIdDefault(optionLeadsExcel.user_id) : "";
		const csvImportSlug = optionLeadsExcel.csv_import_slug;
		const leadImport = db.collection(TABLE_LEADS_IMPORT);

		// Build query to find the import record
		const optionQuery = {
			'user_id': userId,
			'slug': csvImportSlug,
		};
		const deleteDataOption = { ...optionQuery, "is_process": LEADS_PENDING_EXCEL_PROCESS };

		// Find the import record to get the file name
		const leadImportData = await leadImport.findOne(optionQuery, { projection: { _id: 1, file_name: 1 } });

		if (!leadImportData) {
			// No record found, return error status
			return STATUS_ERROR;
		}

		// Delete the import record with the pending process status
		const deleteResult = await leadImport.deleteOne(deleteDataOption);

		if (!deleteResult || deleteResult.deletedCount === 0) {
			// Deletion failed, return error status
			return STATUS_ERROR;
		}

		// Remove the Excel file from the file system
		const imagesData = {
			file_path: LEADS_EXCEL_FILE_PATH + leadImportData.file_name
		};
		await removeFile(imagesData);

		// Return success status after all operations complete
		return STATUS_SUCCESS;
	} catch (err) {
		// Log error for debugging
		console.error("Error in deletePendingImportExcelFile:", err);
		return STATUS_ERROR;
	}
}; // End deletePendingImportExcelFile();


/**
 * Function to update the Excel import process flags after maintaining the flag.
 * Uses async/await for database operations and provides clear comments.
 */
csvImportAllProcessDoneAfterFlagUpdate = async (req, res, csvId) => {
	const csvImport = db.collection(TABLE_LEADS_IMPORT);
	const leadsImportLogs = db.collection(TABLE_LEADS_IMPORT_LOGS);

	try {
		// Count the number of import log records for the given CSV ID
		const countLogs = await leadsImportLogs.countDocuments({ 'csv_id': newObjectIdDefault(csvId) });

		// Prepare the update query and data based on whether logs exist
		let updateQuery = { _id: newObjectIdDefault(csvId) };
		let updateData;

		if (countLogs === 0) {
			// If no logs, update the import record with rejected process and failed reason
			updateData = {
				$set: {
					is_running: DEACTIVE,
					is_completed: ACTIVE,
					is_process: LEADS_REJECTED_EXCEL_PROCESS,
					failed_reason: res.__(res.__("web.leads_file.no_columns_were_found")),
					modified: getUtcDate()
				}
			};
		} else {
			// If logs exist, just update running/completed flags and modified date
			updateData = {
				$set: {
					is_running: DEACTIVE,
					is_completed: ACTIVE,
					modified: getUtcDate()
				}
			};
		}

		// Update the import record
		await csvImport.updateOne(updateQuery, updateData);

		// Return after all operations complete
		return;
	} catch (err) {
		// Log error for debugging
		console.error("Error in csvImportAllProcessDoneAfterFlagUpdate:", err);
		return;
	}
}; // End csvImportAllProcessDoneAfterFlagUpdate();

/**
 * Function to check if a welcome email has already been sent to a lead.
 * Uses async/await for database operations and returns the count.
 */
sendWelcomeEmailsCountData = async (emailUser, leadFormsId) => {
	try {
		const leadsImportLogsTable = db.collection(TABLE_LEADS_IMPORT_LOGS);

		// Build the query to count documents matching the criteria
		const query = {
			"email": { $regex: '^' + emailUser + '$', $options: 'i' },
			"lead_id": newObjectIdDefault(leadFormsId),
			"sheet_status": { $ne: SHEET_STATUS_PROCESSING },
			"is_process": DEFAULT_ONE,
			"send_welcome_email": IMPORT_LEADS_WELCOME_EMAIL_YES_STATUS,
		};

		// Await the countDocuments operation
		const sendEmailCount = await leadsImportLogsTable.countDocuments(query);

		return sendEmailCount;
	} catch (err) {
		// Log error for debugging
		console.error("Error in sendWelcomeEmailsCountData:", err);
		return 0;
	}
}; // End sendWelcomeEmailsCountData();

/** 
 * Function to update all relevant lead import logs to mark welcome email as sent.
 * Uses async/await for database operations.
 * 
 * Updates all records for the given email and leadFormsId where sheet_status is success or warning.
 */
updateStatusAllSendEmailChange = async (emailUser, leadFormsId) => {
	try {
		const leadsImportLogsTable = db.collection(TABLE_LEADS_IMPORT_LOGS);

		// Build the update query
		const query = {
			"email": { $regex: '^' + emailUser + '$', $options: 'i' },
			"lead_id": leadFormsId,
			"sheet_status": { $in: [SHEET_STATUS_SUCCESS, SHEET_STATUS_WARNING] }
		};

		// Set the update data
		const update = {
			$set: {
				'send_welcome_email': IMPORT_LEADS_WELCOME_EMAIL_YES_STATUS
			}
		};

		// Perform the update operation using async/await
		await leadsImportLogsTable.updateMany(query, update);

		// Return status success after update
		return STATUS_SUCCESS;
	} catch (err) {
		// Log error for debugging
		console.error("Error in updateStatusAllSendEmailChange:", err);
		return STATUS_ERROR || false;
	}
}; // End updateStatusAllSendEmailChange();

/*** 
 * Function to send welcome emails to selected lead import log IDs.
 * Uses async/await for all database operations and handles parallel queries with Promise.all.
 * */
sendWelcomeEmailsSelectedIds = async (req, res, leadsImportLogsArrayIds) => {
	const leadsImportLogsTable = db.collection(TABLE_LEADS_IMPORT_LOGS);
	const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
	const users = db.collection(TABLE_USERS);

	try {
		// Check if the number of IDs exceeds the allowed limit
		if (leadsImportLogsArrayIds.length > WELCOME_MAIL_SEND_USERS_IMPORT_LIMIT) {
			return;
		}

		// Process each ID in series to avoid race conditions
		for (const recordsLeadsImportLogsId of leadsImportLogsArrayIds) {
			const leadsImportLogsId = recordsLeadsImportLogsId ? newObjectIdDefault(recordsLeadsImportLogsId) : "";

			if (!leadsImportLogsId) {
				continue;
			}

			// Find the lead import log record
			const resultLogs = await leadsImportLogsTable.findOne(
				{ '_id': leadsImportLogsId },
				{
					projection: {
						'_id': 1,
						'email': 1,
						'user_id': 1,
						'lead_id': 1,
						'lead_forms_subscriber_id': 1
					}
				}
			);

			if (!resultLogs || !resultLogs.email) {
				consoleLog("leadsImportLogsTable logs not found");
				continue;
			}

			const emailUser = resultLogs.email || "";
			const leadFormsSubscriberId = resultLogs.lead_forms_subscriber_id ? newObjectIdDefault(resultLogs.lead_forms_subscriber_id) : "";
			const userId = resultLogs.user_id ? newObjectIdDefault(resultLogs.user_id) : "";
			const leadFormsId = resultLogs.lead_id ? newObjectIdDefault(resultLogs.lead_id) : "";
			const currentTimeStamp = new Date().getTime();
			const validateString = crypto.createHash('md5').update(currentTimeStamp + emailUser).digest("hex");

			// Check if a welcome email has already been sent
			const sendEmailCount = await sendWelcomeEmailsCountData(emailUser, leadFormsId);

			if (sendEmailCount === 0) {
				// Mark all relevant logs as welcome email sent (do not await, let it run in background)
				updateStatusAllSendEmailChange(emailUser, leadFormsId);

				// Update the subscriber's validate_string
				await signupLeadForms.updateOne(
					{ _id: leadFormsSubscriberId },
					{ $set: { validate_string: validateString } }
				);

				// Find the user who created the lead
				const usersResult = await users.findOne(
					{ _id: userId },
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

				if (usersResult) {
					// Prepare email options
					const emailOptionsData = {
						'creator_id': userId,
						'email_send_to': emailUser,
						'reward_send_user_id': "",
						'link_url': FRONT_URL + "complete-profile/create/" + validateString,
						'link_blocked_wallet_url': FRONT_URL + "my-wallet/wallet-listing/" + validateString,
						'user_created_result': usersResult,
					};

					// Send the welcome email (do not await, let it run in background)
					welcomeMailSend(req, res, emailOptionsData).catch(err => {
						console.error("Error sending welcome email:", err);
					});
				} else {
					consoleLog("creator user not found");
				}
			}
		}
	} catch (err) {
		console.error("Error in sendWelcomeEmailsSelectedIds:", err);
	}
}; // End sendWelcomeEmailsSelectedIds();

/**
 * Updates all lead subscribers matching the given email.
 * Uses async/await for database operations.
 * 
 * @param {Object} optionUpdate - Contains email and update_data.
 * @returns {Promise<string>} - Resolves with STATUS_SUCCESS.
 */
updateAllLeadsSubscriber = async (optionUpdate) => {
	try {
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const email = optionUpdate.email;
		const updateData = optionUpdate.update_data;

		// Update all subscribers with the matching email (case-insensitive)
		await signupLeadForms.updateMany(
			{ email: { $regex: "^" + email + "$", $options: "i" } },
			{ $set: updateData }
		);

		return STATUS_SUCCESS;
	} catch (err) {
		console.error("Error in updateAllLeadsSubscriber:", err);
		throw err;
	}
}; // End updateAllLeadsSubscriber

/**
 * Updates all lead subscribers matching the given email, only filling in missing fields.
 * Uses async/await for all database operations.
 * 
 * @param {Object} optionUpdate - Contains email, stage_level, update_data, etc.
 * @returns {Promise<void>}
 */
updateAllLeadsAllSubscriberExcelImportWise = async (optionUpdate) => {
	try {
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const email = optionUpdate.email;
		const stageLevel = optionUpdate.stage_level;
		const updateAllData = optionUpdate.update_data || {};
		const welcomeEmailUnsubscriberValidateString = optionUpdate.welcome_email_unsubscribe_validate_string || "";
		const firstName = updateAllData.first_name || "";
		const lastName = updateAllData.last_name || "";
		const gender = updateAllData.gender || "";
		const mobile = updateAllData.mobile || "";
		const dob = updateAllData.dob || "";
		const age = updateAllData.age || "";
		const zipCode = updateAllData.zip || "";
		const userName = updateAllData.slug || "";
		const imageName = updateAllData.image_name || "";

		// Find all subscribers with the matching email (case-insensitive)
		const resultSubscriber = await signupLeadForms.find(
			{ email: { $regex: "^" + email + "$", $options: "i" } },
			{
				projection: {
					_id: 1,
					first_name: 1,
					last_name: 1,
					full_name: 1,
					gender: 1,
					mobile: 1,
					dob: 1,
					age: 1,
					zip: 1,
					image_name: 1,
					slug: 1
				}
			}
		).toArray();

		if (!resultSubscriber || resultSubscriber.length === 0) {
			return;
		}

		// Prepare update operations for each subscriber, only updating missing fields
		const updatePromises = resultSubscriber.map(async (recordList) => {
			const lastDataRecordId = recordList._id;
			const lastDatafirstName = recordList.first_name || "";
			const lastDatalastName = recordList.last_name || "";
			const lastDatagender = recordList.gender || "";
			const lastDatamobile = recordList.mobile || "";
			const lastDatadob = recordList.dob || "";
			const lastDatazip = recordList.zip || "";
			const lastDataslug = recordList.slug || "";
			const lastDataimageName = recordList.image_name || "";

			let updateData = {
				stage_level: stageLevel,
				welcome_email_unsubscribe_validate_string: welcomeEmailUnsubscriberValidateString
			};

			// Only update fields if they are missing in the record
			if (lastDatafirstName === "") {
				updateData.first_name = firstName;
				updateData.full_name = (firstName + " " + lastDatalastName).trim();
			}
			if (lastDatalastName === "") {
				updateData.last_name = lastName;
				updateData.full_name = (lastDatafirstName + " " + lastName).trim();
			}
			if (lastDatafirstName === "" && lastDatalastName === "") {
				updateData.first_name = firstName;
				updateData.last_name = lastName;
				updateData.full_name = (firstName + " " + lastName).trim();
			}
			if (lastDatagender === "") {
				updateData.gender = gender;
			}
			if (lastDatamobile === "") {
				updateData.mobile = mobile;
			}
			if (lastDatadob === "") {
				updateData.dob = dob;
				updateData.age = age;
			}
			if (lastDatazip === "") {
				updateData.zip = zipCode;
			}
			if (lastDataslug === "") {
				updateData.slug = userName;
			}
			if (lastDataimageName === "") {
				updateData.image_name = imageName;
			}

			// Clean up full_name if present
			if (updateData.full_name) {
				updateData.full_name = (updateData.full_name || "").trim();
			}

			// Only perform update if there is something to update
			if (Object.keys(updateData).length > 0) {
				// Update the subscriber document
				await signupLeadForms.updateMany(
					{ _id: lastDataRecordId },
					{ $set: updateData }
				);
			}
		});

		// Wait for all updates to complete in parallel
		await Promise.all(updatePromises);

	} catch (err) {
		console.error("Error in updateAllLeadsAllSubscriberExcelImportWise:", err);
		throw err;
	}
}; // End updateAllLeadsAllSubscriberExcelImportWise

/**
 * Retrieves an array of subscriber IDs for a given leads import slug.
 * Uses async/await for cleaner asynchronous code.
 *
 * @param {string} leadsImportSlug - The slug identifying the leads import.
 * @returns {Promise<Array>} - Promise resolving to an array of subscriber IDs.
 */
const getUserSubscriberIdsArray = async (leadsImportSlug) => {
	try {
		const leadsSubscriberEntriesLogs = db.collection(TABLE_LEADS_SUBSCRIBER_ENTRIES_LOGS);
		// Query the collection for distinct subscriber IDs matching the import slug
		const resultSubscriberIds = await leadsSubscriberEntriesLogs.distinct(
			"lead_forms_subscriber_id",
			{ 'leads_import_slug': leadsImportSlug }
		);
		return resultSubscriberIds || [];
	} catch (err) {
		// In case of error, return an empty array
		return [];
	}
}; // End getUserSubscriberIdsArray

/***
 * Function for use to get excel file name
 */
getExcelFileName = (fileName) => {
	if (fileName != '') {
		let generateFileNameSplitArray = fileName.split("/");
		const generateFileName = generateFileNameSplitArray[generateFileNameSplitArray.length - 1];
		return generateFileName;
	} else {
		return fileName;
	}
} //End getExcelFileName();

/**
 * Function to for use to add user earn reward
 *
 * @return null
 */
addUserEarnRewards = async (req, res, addUserEarnRewardsOptions) => {
	const rewards = db.collection(TABLE_REWARDS);
	const sentRewards = db.collection(TABLE_EARN_SENT_REWARDS);
	const users = db.collection(TABLE_USERS);

	let rewardId = (addUserEarnRewardsOptions.assign_reward) ? newObjectIdDefault(addUserEarnRewardsOptions.assign_reward) : "";
	let currentUserId = (addUserEarnRewardsOptions.reward_send_user_id) ? newObjectIdDefault(addUserEarnRewardsOptions.reward_send_user_id) : "";
	let templateType = addUserEarnRewardsOptions.template_type;
	let loginUserEmail = (addUserEarnRewardsOptions.login_user_email) ? addUserEarnRewardsOptions.login_user_email : "";
	let loginUserFullName = (addUserEarnRewardsOptions.login_user_full_name) ? addUserEarnRewardsOptions.login_user_full_name : "";
	let pollId = (addUserEarnRewardsOptions.poll_id) ? newObjectIdDefault(addUserEarnRewardsOptions.poll_id) : "";
	let pollSlug = (addUserEarnRewardsOptions.poll_slug) ? addUserEarnRewardsOptions.poll_slug : "";
	let pollCreated = (addUserEarnRewardsOptions.poll_created) ? addUserEarnRewardsOptions.poll_created : "";
	let makePollUserId = (addUserEarnRewardsOptions.make_poll_user_id) ? newObjectIdDefault(addUserEarnRewardsOptions.make_poll_user_id) : "";
	let leadFormsId = (addUserEarnRewardsOptions.lead_forms_id) ? newObjectIdDefault(addUserEarnRewardsOptions.lead_forms_id) : "";
	let segmentId = (addUserEarnRewardsOptions.segment_id) ? newObjectIdDefault(addUserEarnRewardsOptions.segment_id) : "";
	let segmentSlug = (addUserEarnRewardsOptions.segment_slug) ? addUserEarnRewardsOptions.segment_slug : "";

	/** this case for used to lead login loop wise becuase this alrewady created function addUserEarnRewards reward **/
	let loginUserData = (addUserEarnRewardsOptions.login_user_data) ? addUserEarnRewardsOptions.login_user_data : "";
	let accountType = (loginUserData.account_type) ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;
	let gender = (loginUserData.gender) ? loginUserData.gender : "";
	let dob = (loginUserData.dob) ? loginUserData.dob : "";
	let zip = (loginUserData.zip) ? loginUserData.zip : "";
	let age = DEACTIVE;
	if (dob != "") {
		let dobConvert = mongoDatetoSimpleDateConvert(dob);
		age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
	}

	if (rewardId != '' && currentUserId != '' && templateType != '') {
		try {
			// get rewards lead wise
			const resultRewards = await rewards.findOne({
				_id: newObjectIdDefault(rewardId),
			});
			if (!resultRewards) {
				return res;
			}
			let rewardMakeUserId = resultRewards.user_id;
			let rewardTitle = (resultRewards.reward_text) ? resultRewards.reward_text : "";
			let rewardSubTitle = (resultRewards.reward_sub_heading) ? resultRewards.reward_sub_heading : "";

			// create user make reward details data
			const resultUsers = await users.findOne(
				{ _id: rewardMakeUserId },
				{ projection: { '_id': 1, 'full_name': 1, 'email': 1, 'signature_image': 1, 'public_business_informaton': 1 } }
			);

			if (!resultUsers) {
				return;
			}

			let setRewardCondition = {
				'user_id': currentUserId,
				'reward_id': newObjectIdDefault(resultRewards._id),
			};
			if (pollId != '') {
				setRewardCondition['poll_id'] = pollId;
			}
			if (segmentId != '') {
				setRewardCondition['segment_id'] = segmentId;
			}

			// One time reward make condition
			const alreadyRewardResult = await sentRewards.countDocuments(setRewardCondition);

			if ((alreadyRewardResult == 0) || templateType == LEADS_SEGMENT_REWARD_TYPE || templateType == SEGMENT_REWARD_TYPE) {
				let userRedeemedCode = (resultUsers.public_business_informaton && resultUsers.public_business_informaton.redemption_code) ? (resultUsers.public_business_informaton.redemption_code).toString() : "";
				let businessIndustryId = (resultUsers.public_business_informaton && resultUsers.public_business_informaton.business_industry) ? newObjectIdDefault(resultUsers.public_business_informaton.business_industry) : "";
				let signatureImage = (resultUsers.signature_image) ? resultUsers.signature_image : "";

				/** slug generate */
				let slugOptions = {
					'title': resultRewards.reward_text,
					'table_name': TABLE_EARN_SENT_REWARDS,
					'slug_field': "slug"
				};

				let slugResponse = await getDatabaseSlug(slugOptions);

				/** earn insert data */
				let insertedData = {
					'email': loginUserEmail,
					'user_id': (currentUserId) ? newObjectIdDefault(currentUserId) : "",
					'reward_id': newObjectIdDefault(resultRewards._id),
					'segment_id': segmentId,
					'segment_slug': segmentSlug,
					'lead_forms_id': leadFormsId,
					'template_type': templateType,
					'poll_id': pollId,
					'poll_slug': pollSlug,
					"poll_created": pollCreated,
					'make_poll_user_id': makePollUserId,
					'title': (resultRewards.reward_text) ? resultRewards.reward_text : "",
					'sub_title': (resultRewards.reward_sub_heading) ? resultRewards.reward_sub_heading : "",
					'image': (resultRewards.graphic_image) ? resultRewards.graphic_image : "",
					'url_desc': (resultRewards.url_desc) ? resultRewards.url_desc : "",
					'send_by': (resultRewards.user_id) ? newObjectIdDefault(resultRewards.user_id) : "",
					'business_industry_id': businessIndustryId,
					'redemption_code': userRedeemedCode,
					'expiry_date': (resultRewards.expiry_date) ? resultRewards.expiry_date : "",
					'toogle_expiry_date': (resultRewards.toogle_expiry_date) ? true : false,
					'reward_created_date': (resultRewards.created) ? resultRewards.created : "",
					'store_type_id': (resultRewards.store_type_id) ? resultRewards.store_type_id : [],
					'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
					'is_redemed': NOT_REDEMED,
					'is_deleted': NOT_DELETED,
					'is_download': DEFAULT_ZERO,
					'is_viewed': NOT_VIEWED,
					"account_type": (currentUserId) ? accountType : "",
					"gender": (currentUserId) ? gender : "",
					"dob": (currentUserId) ? dob : "",
					"age": (currentUserId) ? age : "",
					"zip": (currentUserId) ? zip : "",
					'created': getUtcDate(),
					'modified': getUtcDate(),
				};

				await sentRewards.insertOne(insertedData);

				/** Reward image card to replace reward image */
				var rewardImageSrc = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD;

				/** Select a random color*/
				const randomWalletRewardIndex = Math.floor(Math.random() * WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR.length);
				const randomRewardWalletColor = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR[randomWalletRewardIndex];
				rewardImageSrc = rewardImageSrc.replace(RegExp('{WALLET_RANDOM_COLOR_GRADIANT}', 'g'), randomRewardWalletColor);

				/** business Details login user */
				let publicBusinessInformaton = (resultUsers.public_business_informaton) ? resultUsers.public_business_informaton : "";
				let businessLogo = (publicBusinessInformaton && publicBusinessInformaton.business_logo) ? publicBusinessInformaton.business_logo : "";
				let businessRewardLogo = (publicBusinessInformaton && publicBusinessInformaton.reward_image) ? publicBusinessInformaton.reward_image : "";
				let businessIndustryName = (publicBusinessInformaton && publicBusinessInformaton.business_industry_name) ? publicBusinessInformaton.business_industry_name : "";
				let profileImageUrl = "";

				/** Reward image send */
				if (businessRewardLogo != '') {
					profileImageUrl = USERS_URL + businessRewardLogo;
				}
				/** Reward image not send profile image */
				if (businessRewardLogo == '' && businessLogo != '') {
					profileImageUrl = USERS_URL + businessLogo;
				}

				rewardImageSrc = rewardImageSrc.replace(RegExp('{BUSINESS_INDUSTRY}', 'g'), businessIndustryName);
				rewardImageSrc = rewardImageSrc.replace(RegExp('{REWARD_HEADING}', 'g'), rewardTitle);
				rewardImageSrc = rewardImageSrc.replace(RegExp('{REWARD_SUBHEADING}', 'g'), rewardSubTitle);
				rewardImageSrc = rewardImageSrc.replace(RegExp('{USER_PROFILE_IMAGE}', 'g'), profileImageUrl);

				/** Signature image replace in the {SIGNATURE} constant */
				let signatureImageLink = "https://d5cvgp25mt3yl.cloudfront.net/uploads/images/the_pocial_team_signature.png";
				if (signatureImage) {
					signatureImageLink = SIGNATURE_URL + signatureImage;
				}

				let logoFromTheBusiness = "";
				if (profileImageUrl !== "") {
					logoFromTheBusiness = `<img src="${profileImageUrl}" style="margin: auto;height: 60px;" />`;
				}

				/** Send mail for waiting reward */
				let rewardLink = FRONT_URL + "my-wallet/new-rewards";
				let emailOptions = {
					to: loginUserEmail,
					action: "your_reward_is_waiting",
					rep_array: [DEAR_HI_CONSTANT, loginUserFullName, rewardLink, signatureImageLink, rewardTitle, logoFromTheBusiness]
				};

				/** Send email **/
				sendMail(req, res, emailOptions);

				return;
			} else {
				return;
			}
		} catch (err) {
			return;
		}
	} else {
		return req;
	}
}; //End addUserEarnRewards();

/**
 * Function to log poll analytics view data.
 * Uses async/await for database operations.
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} optionsData - Additional options for logging.
 * @returns {Promise<void>}
 */
pollAnalyticsViewLogs = async (req, res, optionsData) => {
	const pollViewLogs = db.collection(TABLE_POLL_VIEW_LOGS);

	let isViewType = req.body.is_view_type ? req.body.is_view_type : "";
	let thirdPartySiteUrl = req.body.third_party_site_url ? req.body.third_party_site_url : "";

	let randomViewsString = optionsData.random_views_string ? optionsData.random_views_string : "";
	let makePollUserId = optionsData.make_poll_user_id ? newObjectIdDefault(optionsData.make_poll_user_id) : "";
	let userId = optionsData.user_id ? optionsData.user_id : "";

	try {
		if (isViewType !== '') {
			// Check if the user has already viewed this poll with the same random_views_string
			const alreadyViewResult = await pollViewLogs.findOne(
				{
					"user_id": userId,
					"poll_id": optionsData.poll_id ? newObjectIdDefault(optionsData.poll_id) : "",
					"random_views_string": randomViewsString,
				},
				{ projection: { _id: 1 } }
			);

			if (alreadyViewResult) {
				// User has already viewed, do not increment view count
				return;
			}

			// Calculate age if dob is provided
			let dob = optionsData.dob ? optionsData.dob : "";
			let age = DEACTIVE;
			if (dob !== "") {
				let dobConvert = mongoDatetoSimpleDateConvert(dob);
				age = calculateAge(dobConvert.dd + "-" + dobConvert.mm + "-" + dobConvert.yy);
			}

			// Get followers/following info in parallel
			const followResponse = await getPollsFollowersNonFollowers(makePollUserId, userId);

			// Insert the new view log
			await pollViewLogs.insertOne({
				"ip": optionsData.ip ? optionsData.ip : "",
				"user_id": userId,
				"custom_url": optionsData.custom_url ? optionsData.custom_url : "",
				"make_poll_user_id": makePollUserId,
				"poll_question": optionsData.poll_question ? optionsData.poll_question : "",
				"poll_id": optionsData.poll_id ? newObjectIdDefault(optionsData.poll_id) : "",
				"poll_slug": optionsData.poll_slug ? optionsData.poll_slug : "",
				"unique_browser_id": optionsData.unique_browser_id ? optionsData.unique_browser_id : "",
				"poll_type": optionsData.poll_type ? optionsData.poll_type : "",
				"poll_set_id": optionsData.poll_set_id ? optionsData.poll_set_id : "",
				"account_type": optionsData.account_type ? optionsData.account_type : "",
				"gender": optionsData.gender ? optionsData.gender : "",
				"dob": optionsData.dob ? optionsData.dob : "",
				"zip": optionsData.zip ? optionsData.zip : "",
				"poll_created": optionsData.poll_created ? optionsData.poll_created : "",
				"is_followers": followResponse.is_followers ? followResponse.is_followers : 0,
				"is_followers_requested_received": followResponse.is_followers_requested_received ? followResponse.is_followers_requested_received : 0,
				"is_following": followResponse.is_following ? followResponse.is_following : 0,
				"is_following_requested_send": followResponse.is_following_requested_send ? followResponse.is_following_requested_send : 0,
				"age": userId ? age : "",
				"view_type": isViewType,
				"random_views_string": randomViewsString,
				"third_party_site_url": thirdPartySiteUrl,
				"created": getUtcDate()
			});
		}
		// If isViewType is empty, do nothing
		return;
	} catch (err) {
		console.error("Error in pollAnalyticsViewLogs:", err);
		return;
	}
}; // End pollAnalyticsViewLogs

/**
 * Retrieves all poll slugs for a specific user.
 * Uses async/await for database operations.
 *
 * @param {string} userId - The user ID to fetch poll slugs for.
 * @returns {Promise<Array>} - Promise resolving to an array of poll slugs.
 */
specificUserWiseAllPollSlugs = async (userId) => {
	try {
		// Convert userId to ObjectId if provided
		const userObjectId = userId ? newObjectIdDefault(userId) : "";

		if (!userObjectId) {
			// If userId is not provided, return empty array
			return [];
		}

		const polls = db.collection(TABLE_POLLS);

		// Aggregate to get all unique slugs for the user
		const pollSlugsResult = await polls.aggregate([
			{ $match: { 'user_id': userObjectId } },
			{
				$group: {
					_id: null,
					slug: { $addToSet: '$slug' },
				}
			}
		]).toArray();

		// Extract slugs array or return empty array if not found
		const pollSlugs = (pollSlugsResult && pollSlugsResult[0] && pollSlugsResult[0]['slug']) ? pollSlugsResult[0]['slug'] : [];

		return pollSlugs;
	} catch (err) {
		console.error("Error in specificUserWiseAllPollSlugs:", err);
		return [];
	}
}; // End specificUserWiseAllPollSlugs

/**
 * Retrieves follower/following status between two users for poll view/vote.
 * Uses async/await and runs all queries in parallel.
 *
 * @param {string} makePollUserId - The user ID who created the poll.
 * @param {string} userId - The user ID to check relationship with.
 * @returns {Promise<Object>} - Object with follower/following/requested status.
 */
getPollsFollowersNonFollowers = async (makePollUserId, userId) => {
	try {
		// Convert IDs to ObjectId if provided
		const pollUserObjId = makePollUserId ? newObjectIdDefault(makePollUserId) : "";
		const userObjId = userId ? newObjectIdDefault(userId) : "";

		// If either ID is missing, return all zeros
		if (!pollUserObjId || !userObjId) {
			return {
				'is_followers': 0,
				'is_followers_requested_received': 0,
				'is_following': 0,
				'is_following_requested_send': 0,
			};
		}

		const followCollection = db.collection(TABLE_USERS_FOLLOWER_LIST);

		// Prepare all queries to run in parallel
		const [
			followersCount,
			followersRequestedReceived,
			followingCount,
			followingRequestedSend
		] = await Promise.all([
			// Count if userId follows makePollUserId and is approved
			followCollection.countDocuments({
				'followed_by': userObjId,
				'user_id': pollUserObjId,
				'is_approved': ACTIVE
			}),
			// Count if userId follows makePollUserId and is not approved (requested)
			followCollection.countDocuments({
				'followed_by': userObjId,
				'user_id': pollUserObjId,
				'is_approved': DEACTIVE
			}),
			// Count if makePollUserId follows userId and is approved
			followCollection.countDocuments({
				'user_id': userObjId,
				'followed_by': pollUserObjId,
				'is_approved': ACTIVE
			}),
			// Count if makePollUserId follows userId and is not approved (requested)
			followCollection.countDocuments({
				'user_id': userObjId,
				'followed_by': pollUserObjId,
				'is_approved': DEACTIVE
			}),
		]);

		// Return the follower/following/requested status
		return {
			'is_followers': followersCount || 0,
			'is_followers_requested_received': followersRequestedReceived || 0,
			'is_following': followingCount || 0,
			'is_following_requested_send': followingRequestedSend || 0,
		};
	} catch (err) {
		// On error, return all zeros
		return {
			'is_followers': 0,
			'is_followers_requested_received': 0,
			'is_following': 0,
			'is_following_requested_send': 0,
		};
	}
}; // End getPollsFollowersNonFollowers

/**
 * Function to add segment lead reward from logs.
 * Updates sent rewards for a user based on email and userId.
 * Uses async/await for all database operations.
 */
sendWelcomeRewardToAllCampaignUser = async (userEmail, userId) => {
	try {
		if (userId && userEmail) {
			const sentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

			// Update all sent rewards for this email where user_id is null or empty and template_type matches
			await sentRewards.updateMany(
				{
					user_id: { $in: [null, ""] },
					template_type: { $in: [EMAIL_TEMPLATE_WELCOME_TYPE, EMAIL_TEMPLATE_COMPLETE_TYPE] },
					email: { $regex: "^" + userEmail + "$", $options: "i" }
				},
				{
					$set: {
						user_id: newObjectIdDefault(userId)
					}
				}
			);
			return;
		}

		// If only email is provided, try to find the user and recursively call with userId
		if (userEmail && !userId) {
			const users = db.collection(TABLE_USERS);

			// Find user by email (case-insensitive)
			const userData = await users.findOne(
				{ email: { $regex: "^" + userEmail + "$", $options: "i" } },
				{ projection: { _id: 1 } }
			);

			if (userData && userData._id) {
				await sendWelcomeRewardToAllCampaignUser(userEmail, userData._id);
			}
			return;
		}
		// If neither userId nor userEmail is valid, do nothing
		return;
	} catch (err) {
		console.error("Error in sendWelcomeRewardToAllCampaignUser:", err);
		return;
	}
}; // End sendWelcomeRewardToAllCampaignUser

/***
 * Function for use to add segment lead reward from logs
 */
sendSegmentLeadRewardFromLogs = async (req, res, resultData) => {
	let loginUserData = resultData;
	let userId = (loginUserData._id) ? newObjectIdDefault(loginUserData._id) : "";
	let userEmail = (loginUserData.email) ? (loginUserData.email).toLowerCase() : "";

	if (userId != '' && userEmail != '') {
		const segmentLeadRewardLogs = db.collection(TABLE_SEGMENT_LEAD_REWARD_LOGS);

		let conditions = {
			'user_email': userEmail
		}

		// Start if user commplete any lead & normal registration same email then welcome email send to all campaign user
		await sendWelcomeRewardToAllCampaignUser(userEmail, userId);
		// End if user commplete any lead & normal registration same email then welcome email send to all campaign user

		// Get rewards from logs
		let rewardsList = await segmentLeadRewardLogs.find(conditions).toArray();

		// check rewards is exists
		if (rewardsList && rewardsList.length > 0) {
			// Send Reward for logs
			for (const record of rewardsList) {
				let rewardId = record && record.reward_id ? record.reward_id : "";
				let leadFormsId = record && record.lead_forms_id ? record.lead_forms_id : "";

				// send reward from logs data
				let addEarnRewardsOptions = {
					'assign_reward': rewardId,
					'reward_send_user_id': userId,
					'login_user_email': loginUserData.email,
					'login_user_full_name': loginUserData.full_name,
					'template_type': LEADS_SEGMENT_REWARD_TYPE,
					"lead_forms_id": leadFormsId,
					"login_user_data": loginUserData,
				}
				// User assign earn rewards
				await addUserEarnRewards(req, res, addEarnRewardsOptions);
			}
			// Delete all reward associated to this user from logs
			await segmentLeadRewardLogs.deleteMany({
				user_email: userEmail
			});
		}
	}
	// Always resolve (for compatibility with previous Promise-based API)
	return;
} // End sendSegmentLeadRewardFromLogs()


/**
 * Function to pick a winner from the list of lead form subscribers.
 * Uses async/await for database operations and clean formatting.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Options containing user_id and lead_from_id
 * @returns {Promise<Object>} - Resolves with winner info or error message
 */
pickWinnerFromList = async (req, res, options) => {
	try {
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const leadFormsId = options.lead_from_id ? newObjectIdDefault(options.lead_from_id) : "";

		const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		const conditions = {
			'creator_id': userId,
			'lead_forms_id': leadFormsId,
			'is_winner': { $ne: ACTIVE },
			'is_deleted': NOT_DELETED
		};

		// Aggregate pipeline to pick a random winner and join user details
		const pipeline = [
			{ $match: conditions },
			{ $sample: { size: 1 } },
			{
				$lookup: {
					from: TABLE_USERS,
					let: { userEmail: "$email" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$email", "$$userEmail"] },
									]
								},
							}
						},
						{ $project: { "profile_image": 1, "account_type": 1, "public_business_informaton": 1 } }
					],
					as: "userDetails"
				}
			},
			{
				$addFields: {
					"profile_image": { $arrayElemAt: ["$userDetails.profile_image", 0] },
					"account_type": { $arrayElemAt: ["$userDetails.account_type", 0] },
					"public_business_informaton": { $arrayElemAt: ["$userDetails.public_business_informaton", 0] },
				}
			},
			{
				$project: {
					"_id": 1,
					"full_name": {
						$cond: [
							"$public_business_informaton.name_of_the_business",
							"$public_business_informaton.name_of_the_business",
							"$full_name"
						]
					},
					"email": 1,
					"creator_id": 1,
					"lead_forms_id": 1,
					"gender": 1,
					"zip": 1,
					"mobile": 1,
					"is_deleted": 1,
					"profile_image": 1,
					"account_type": 1,
				}
			}
		];

		// Run the aggregation to get a random winner
		const result = await leadsFormsSubscriber.aggregate(pipeline).toArray();

		if (result && result.length > 0) {
			result[0]['user_url'] = USERS_URL;
			const winnerId = result[0]._id;

			const updateData = {
				'is_winner': ACTIVE,
				'winner_created': getUtcDate(),
				'modified': getUtcDate()
			};

			// Mark the selected subscriber as winner
			await leadsFormsSubscriber.updateOne(
				{ _id: winnerId },
				{ $set: updateData }
			);

			// Return success response
			return {
				status: STATUS_SUCCESS,
				result: result[0],
				user_url: USERS_URL,
				message: "",
			};
		} else {
			// No record found
			return {
				status: STATUS_ERROR,
				result: {},
				user_url: USERS_URL,
				message: res.__("front.global.no_record_found"),
			};
		}
	} catch (err) {
		// Handle errors
		return {
			status: STATUS_ERROR,
			result: {},
			user_url: USERS_URL,
			message: res.__("front.system.something_going_wrong_please_try_again")
		};
	}
}; // End pickWinnerFromList

/**
 * Function to validate if reward can be sent to leads/subscribers.
 * Uses async/await and runs all queries in parallel using Promise.all.
 */
validateSendRewardData = async (req, res, options) => {
	try {
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const leadFormsId = options.lead_from_id ? newObjectIdDefault(options.lead_from_id) : "";
		const subscriberEmails = Array.isArray(options.subscriber_emails) ? options.subscriber_emails : [];

		const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const segmentLeadRewardLogs = db.collection(TABLE_SEGMENT_LEAD_REWARD_LOGS);
		const earnSentRewards = db.collection(TABLE_EARN_SENT_REWARDS);

		// Prepare conditions for each query
		const earnRewardConditions = {
			lead_forms_id: leadFormsId,
			is_deleted: NOT_DELETED,
			template_type: LEADS_SEGMENT_REWARD_TYPE
		};
		if (subscriberEmails.length > 0) {
			earnRewardConditions.email = { $in: subscriberEmails };
		}

		const segmentLogsConditions = {
			lead_forms_id: leadFormsId
		};
		if (subscriberEmails.length > 0) {
			segmentLogsConditions.user_email = { $in: subscriberEmails };
		}

		const leadCondition = {
			creator_id: newObjectIdDefault(userId),
			lead_forms_id: leadFormsId,
			is_deleted: NOT_DELETED
		};
		if (subscriberEmails.length > 0) {
			leadCondition.email = { $in: subscriberEmails };
		}

		// Run all queries in parallel
		const [
			earnSendRewardResult,
			segmentLogsRewardResult,
			totalSubscribers
		] = await Promise.all([
			// Get reward count for lead form (from earn sent rewards)
			earnSentRewards.aggregate([
				{ $match: earnRewardConditions },
				{ $group: { _id: "$email" } },
				{ $count: "total_earn_send_reward" }
			]).toArray(),

			// Get reward count from logs for lead form
			segmentLeadRewardLogs.aggregate([
				{ $match: segmentLogsConditions },
				{ $group: { _id: "$user_email" } },
				{ $count: "total_segment_logs_reward" }
			]).toArray(),

			// Get total number of subscribers in lead
			leadsFormsSubscriber.countDocuments(leadCondition)
		]);

		// Extract counts from aggregation results
		const earnRewardCount = (earnSendRewardResult && earnSendRewardResult.length > 0) ? earnSendRewardResult[0].total_earn_send_reward : 0;
		const pendingRewardsCount = (segmentLogsRewardResult && segmentLogsRewardResult.length > 0) ? segmentLogsRewardResult[0].total_segment_logs_reward : 0;
		const totalRewardsCount = earnRewardCount + pendingRewardsCount;

		// Decision logic for reward sending
		if (totalRewardsCount > 0) {
			if (totalSubscribers === 1) {
				return {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.leads.reward_is_already_sent_to_this_user")
				};
			} else if (totalSubscribers > 1 && totalSubscribers === totalRewardsCount) {
				return {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.leads.reward_is_already_sent_to_all_users")
				};
			} else {
				return {
					status: STATUS_ERROR,
					result: {},
					message: res.__(
						"front.leads.reward_is_already_sent_to_the_users_out_of_total_users",
						totalRewardsCount,
						totalSubscribers
					)
				};
			}
		} else {
			// No rewards sent yet, allow sending
			return {
				status: STATUS_SUCCESS,
				result: {},
				message: res.__("front.global.no_record_found")
			};
		}
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			result: {},
			message: res.__("front.system.something_going_wrong_please_try_again")
		};
	}
}; // End validateSendRewardData

/**
 * Function to send lead reward to subscribers.
 * Uses async/await for all database operations and handles parallel reward sending.
 */
sendLeadRewardData = async (req, res, options) => {
	try {
		// Extract and prepare input parameters
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const leadFormsId = options.lead_from_id ? newObjectIdDefault(options.lead_from_id) : "";
		const rewardId = options.reward_id ? newObjectIdDefault(options.reward_id) : "";
		const excludeRewarded = options.exclude_rewarded ? options.exclude_rewarded : false;
		const subscriberEmails = options.subscriber_emails ? options.subscriber_emails : [];

		// Get user details
		const user = db.collection(TABLE_USERS);
		const ownerUserResult = await user.findOne(
			{ _id: userId },
			{ projection: { _id: 1, public_business_informaton: 1 } }
		);

		// Get reward details
		const rewards = db.collection(TABLE_REWARDS);
		const resultRewards = await rewards.findOne({ _id: newObjectIdDefault(rewardId) });
		if (!resultRewards) {
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.global.no_record_found")
			};
		}

		const rewardTitle = resultRewards.reward_text || "";
		const rewardSubTitle = resultRewards.reward_sub_heading || "";
		const rewardImage = resultRewards.graphic_image || "";

		// Build query conditions for subscribers
		let conditions = {
			creator_id: newObjectIdDefault(userId),
			lead_forms_id: leadFormsId,
			is_deleted: NOT_DELETED
		};
		if (subscriberEmails.length > 0) {
			conditions.email = { $in: subscriberEmails };
		}
		if (excludeRewarded === true) {
			conditions.is_rewarded = { $ne: ACTIVE };
		}

		const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		// Aggregate to get subscriber list with user details
		const subscribersList = await leadsFormsSubscriber.aggregate([
			{ $match: conditions },
			{
				$lookup: {
					from: TABLE_USERS,
					let: { userEmail: "$email" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$email", "$$userEmail"] }
									]
								}
							}
						},
						{ $project: { _id: 1, full_name: 1, email: 1, gender: 1, dob: 1, zip: 1, account_type: 1 } }
					],
					as: "userDetails"
				}
			},
			{
				$addFields: {
					userDetails: 0,
					user_details: { $arrayElemAt: ["$userDetails", 0] }
				}
			},
			{
				$project: {
					_id: 1,
					full_name: 1,
					email: 1,
					creator_id: 1,
					lead_forms_id: 1,
					gender: 1,
					zip: 1,
					mobile: 1,
					validate_string: 1,
					is_deleted: 1,
					is_winner: 1,
					is_rewarded: 1,
					winner_created: 1,
					rewardDetails: 1,
					user_details: 1,
					created: 1
				}
			}
		]).toArray();

		if (!subscribersList || subscribersList.length === 0) {
			// No subscribers found
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.global.no_record_found")
			};
		}

		// Prepare parallel reward sending for all subscribers
		const segmentLeadRewardLogs = db.collection(TABLE_SEGMENT_LEAD_REWARD_LOGS);

		// Use Promise.all to handle all reward operations in parallel
		await Promise.all(subscribersList.map(async (record) => {
			const userEmail = record.email || "";
			const userFullName = record.full_name || "";
			const validateString = record.validate_string || "";
			const userExistsDetails = record.user_details || {};
			const userExistsId = userExistsDetails._id || "";

			if (userExistsId) {
				// User exists, assign reward directly
				const addEarnRewardsOptions = {
					assign_reward: rewardId,
					reward_send_user_id: userExistsId,
					login_user_email: userExistsDetails.email,
					login_user_full_name: userExistsDetails.full_name,
					template_type: LEADS_SEGMENT_REWARD_TYPE,
					lead_forms_id: leadFormsId,
					login_user_data: userExistsDetails,
					image: rewardImage
				};
				await addUserEarnRewards(req, res, addEarnRewardsOptions);
			} else {
				// User does not exist, log reward and send email
				const insertData = {
					reward_id: newObjectIdDefault(rewardId),
					send_by: newObjectIdDefault(userId),
					title: rewardTitle,
					sub_title: rewardSubTitle,
					image: rewardImage,
					user_email: userEmail,
					template_type: LEADS_SEGMENT_REWARD_TYPE,
					lead_forms_id: leadFormsId,
					validate_string: validateString,
					created: getUtcDate()
				};
				await segmentLeadRewardLogs.insertOne(insertData);

				// Prepare email content
				const linkCompleteProfile = FRONT_URL + "complete-profile/create/" + validateString;
				const fullName = userFullName !== "" ? userFullName : userEmail;

				// Prepare reward image card
				let rewardImageSrc = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD;
				if (rewardId !== '') {
					// Select a random color for the reward card
					const randomWalletRewardIndex = Math.floor(Math.random() * WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR.length);
					const randomRewardWalletColor = WELCOME_EMAIL_TEMPLATE_WITH_REWARD_CARD_COLOR[randomWalletRewardIndex];
					rewardImageSrc = rewardImageSrc.replace(RegExp('{WALLET_RANDOM_COLOR_GRADIANT}', 'g'), randomRewardWalletColor);

					// Business details for the logged-in user
					const publicBusinessInformaton = ownerUserResult.public_business_informaton || "";
					const businessLogo = publicBusinessInformaton && publicBusinessInformaton.business_logo ? publicBusinessInformaton.business_logo : "";
					const businessRewardLogo = publicBusinessInformaton && publicBusinessInformaton.reward_image ? publicBusinessInformaton.reward_image : "";
					const businessIndustryName = publicBusinessInformaton && publicBusinessInformaton.business_industry_name ? publicBusinessInformaton.business_industry_name : "";
					let profileImageUrl = "";

					// Use reward image if available, otherwise use business logo
					if (businessRewardLogo !== '') {
						profileImageUrl = USERS_URL + businessRewardLogo;
					} else if (businessLogo !== '') {
						profileImageUrl = USERS_URL + businessLogo;
					}

					rewardImageSrc = rewardImageSrc.replace(RegExp('{BUSINESS_INDUSTRY}', 'g'), businessIndustryName);
					rewardImageSrc = rewardImageSrc.replace(RegExp('{REWARD_HEADING}', 'g'), rewardTitle);
					rewardImageSrc = rewardImageSrc.replace(RegExp('{REWARD_SUBHEADING}', 'g'), rewardSubTitle);
					rewardImageSrc = rewardImageSrc.replace(RegExp('{USER_PROFILE_IMAGE}', 'g'), profileImageUrl);
				} else {
					rewardImageSrc = "";
				}

				// Set options for sending email
				const emailOptions = {
					to: userEmail,
					action: "complete_profile_segment_lead_reward",
					rep_array: [DEAR_HI_CONSTANT, fullName, linkCompleteProfile, rewardImageSrc]
				};
				// Send email (do not await, let it run in background)
				sendMail(req, res, emailOptions);
			}
		}));

		// Mark all processed leads as rewarded
		await leadsFormsSubscriber.updateMany(conditions, {
			$set: { is_rewarded: ACTIVE }
		});

		// Return success response
		return {
			status: STATUS_SUCCESS,
			result: {},
			message: res.__("front.leads.reward_is_sent_successfully")
		};
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			result: {},
			message: res.__("front.system.something_going_wrong_please_try_again")
		};
	}
}; // End sendLeadRewardData

/** 
 * Function for used to skip otp before few(7) days  
 * 
 * true case login false case not login
 **/
skipOtpBeforeFewDays = (userCreatedDate) => {
	if (userCreatedDate) {
		let nextDataAfterOtPVerification = (userCreatedDate) ? new Date(userCreatedDate) : "";
		nextDataAfterOtPVerification.setDate(nextDataAfterOtPVerification.getDate() + VERIFY_OTP_EMAIL_AFTER_FEW_DAYS);
		let userCreatdDateTimeStamp = nextDataAfterOtPVerification.getTime();
		let currentDateTimeStamp = currentTimeStamp();
		let skipWithoutValidatopn = (currentDateTimeStamp < userCreatdDateTimeStamp) ? true : false;
		return skipWithoutValidatopn;
	} else {
		return "";
	}
} //End skipOtpBeforeFewDays();

/**
 * Function to get segment-wise user count using async/await.
 * Returns unique users for a segment, with demographic and date filters.
 * All DB queries use async/await and are properly commented.
 */
segmentWiseTotalUserCount = async (req, res, optionData) => {
	try {
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);
		const pollSegment = db.collection(TABLE_POLL_SEGMENT);

		const userId = optionData.user_id ? optionData.user_id : "";
		const segmentSlug = optionData.segment_slug ? optionData.segment_slug : "";
		const selectedUsersIds = optionData.selected_users_ids ? optionData.selected_users_ids : [];

		// If no segment slug provided, return empty result
		if (!segmentSlug) {
			return {
				'all_users': [],
				'total_user': 0
			};
		}

		// Get segment data
		const segmentResult = await pollSegment.findOne({ 'slug': segmentSlug });

		if (!segmentResult) {
			// Segment not found, return empty result
			return {
				'all_users': [],
				'segment_result': "",
				'total_user': 0
			};
		}

		const segmentType = segmentResult.segment_type ? segmentResult.segment_type : "";
		const voterResponsePollIds = segmentResult.voter_response_poll_ids ? segmentResult.voter_response_poll_ids : [];
		const commonPollIds = segmentResult.poll_ids ? segmentResult.poll_ids : [];
		const fromDate = segmentResult.simple_from_date ? segmentResult.simple_from_date : "";
		const toDate = segmentResult.simple_to_date ? segmentResult.simple_to_date : "";
		const selectedPollIds = (segmentType == COMMON_POLLS) ? commonPollIds : voterResponsePollIds;
		const voterResponseOptionIds = segmentResult.voter_response_option_ids ? segmentResult.voter_response_option_ids : [];

		const demographicsData = segmentResult.demographics ? segmentResult.demographics : {};
		const maleDemographicsData = (demographicsData && demographicsData.male) ? demographicsData.male : [];
		const femaleDemographicsData = (demographicsData && demographicsData.female) ? demographicsData.female : [];
		const otherDemographicsData = (demographicsData && demographicsData.other) ? demographicsData.other : [];
		const businessDemographicsData = (demographicsData && demographicsData.business) ? demographicsData.business : [];

		// Build vote condition for aggregation
		let voteCondition = {
			'user_id': { $nin: ['', null] },
			'make_poll_user_id': newObjectIdDefault(userId),
			'poll_id': { $in: selectedPollIds },
		};

		// Date filter
		if (fromDate == ALL_DATE_FILTER) {
			voteCondition["created"] = {
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		} else {
			voteCondition["created"] = {
				$gte: getUtcDateSearchTimeZone(req, fromDate + START_DATE),
				$lte: getUtcDateSearchTimeZone(req, toDate + END_DATE),
			};
		}

		// Filter by selected user IDs if provided
		if (selectedUsersIds.length > 0) {
			const userIdsArray = selectedUsersIds.map(ids => newObjectIdDefault(ids));
			voteCondition["user_id"] = { $in: userIdsArray };
		}

		// Demographics filtering
		let conditionAge = [];
		if (segmentType == DEMOGRAPHICS) {
			// Option-wise data filter
			voteCondition['option_id'] = { $in: voterResponseOptionIds };

			// Male demographics
			if (maleDemographicsData.length > 0) {
				maleDemographicsData.forEach(records => {
					let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
					if (records == UNDER_18) {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": MALE, "age": { "$gte": 0, "$lt": AGE_18 } });
					} else if (records == AGE_OVER_CONSTANT) {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": MALE, "age": { "$gt": AGE_OVER_70 } });
					} else {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": MALE, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
					}
				});
			} else {
				conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": { $ne: MALE } });
			}

			// Female demographics
			if (femaleDemographicsData.length > 0) {
				femaleDemographicsData.forEach(records => {
					let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
					if (records == UNDER_18) {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": FEMALE, "age": { "$gte": 0, "$lt": AGE_18 } });
					} else if (records == AGE_OVER_CONSTANT) {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": FEMALE, "age": { "$gt": AGE_OVER_70 } });
					} else {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": FEMALE, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
					}
				});
			} else {
				conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": { $ne: FEMALE } });
			}

			// Other demographics
			if (otherDemographicsData.length > 0) {
				otherDemographicsData.forEach(records => {
					let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
					if (records == UNDER_18) {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": OTHER, "age": { "$gte": 0, "$lt": AGE_18 } });
					} else if (records == AGE_OVER_CONSTANT) {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": OTHER, "age": { "$gt": AGE_OVER_70 } });
					} else {
						conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": OTHER, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
					}
				});
			} else {
				conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }, "gender": { $ne: OTHER } });
			}

			// Business demographics
			if (businessDemographicsData.length > 0) {
				businessDemographicsData.forEach(records => {
					let dataGender = (records == UNDER_18 || records == AGE_OVER_CONSTANT) ? records : records.split("-");
					if (records == UNDER_18) {
						conditionAge.push({ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, "age": { "$gte": 0, "$lt": AGE_18 } });
					} else if (records == AGE_OVER_CONSTANT) {
						conditionAge.push({ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, "age": { "$gt": AGE_OVER_70 } });
					} else {
						conditionAge.push({ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, "age": { "$gte": Number(dataGender[0]), "$lte": Number(dataGender[1]) } });
					}
				});
			} else {
				conditionAge.push({ "account_type": { $ne: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE } });
			}

			// Append all age/gender conditions
			if (conditionAge.length > 0) {
				voteCondition['$or'] = conditionAge;
			}
		}

		// Aggregation pipeline to get unique users and their details
		const aggregationPipeline = [
			{ $match: voteCondition },
			{
				$group: {
					_id: { "user_id": "$user_id" },
					"user_id": { $last: "$user_id" },
					"poll_vote_participants_id": { $last: "$_id" },
					"poll_id": { $last: "$poll_id" },
					"poll_slug": { $last: "$poll_slug" },
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
							$project: {
								'full_name': 1,
								'dob': 1,
								'slug': 1,
								'gender': 1,
								'zip': 1,
								'mobile': 1,
								'email': 1,
								'profile_image': 1,
								'account_type': 1,
								"segment_campaign_unsubscribed": 1
							}
						}
					],
					as: "userDetails"
				}
			},
			{
				$project: {
					"_id": 0,
					"poll_vote_participants_id": 1,
					'poll_id': 1,
					'poll_slug': 1,
					"user_id": 1,
					"email": { $arrayElemAt: ["$userDetails.email", 0] },
					"full_name": { $arrayElemAt: ["$userDetails.full_name", 0] },
					"account_type": { $arrayElemAt: ["$userDetails.account_type", 0] },
					"gender": { $arrayElemAt: ["$userDetails.gender", 0] },
					"dob": { $arrayElemAt: ["$userDetails.dob", 0] },
					"zip": { $arrayElemAt: ["$userDetails.zip", 0] },
					"segment_campaign_unsubscribed": { $arrayElemAt: ["$userDetails.segment_campaign_unsubscribed", 0] },
				}
			}
		];

		// Run aggregation to get all users for the segment
		const voteResult = await pollVoteParticipants.aggregate(aggregationPipeline).toArray();

		if (voteResult && voteResult.length > 0) {
			return {
				'all_users': voteResult,
				'segment_result': segmentResult,
				'total_user': voteResult.length
			};
		} else {
			return {
				'all_users': [],
				'segment_result': segmentResult,
				'total_user': 0
			};
		}
	} catch (err) {
		// Handle errors gracefully
		return {
			'all_users': [],
			'segment_result': "",
			'total_user': 0,
			'error': err && err.message ? err.message : err
		};
	}
}; // End segmentWiseTotalUserCount

/**
 * Function to add a campaign template newsletter using async/await.
 * Sets the new template as active if no other active template exists, otherwise sets as deactive.
 * Returns the inserted template's ID or null on error.
 *
 * @param {Object} saveDataRecords - The data for the new template.
 * @return {Promise<ObjectId|null>} - The inserted template's ID or null.
 */
addCampaignTemplateNewsletter = async (saveDataRecords) => {
	const campaignNewsletterTemplate = db.collection(TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES);

	try {
		// Generate slug options for the template
		let slugOptions = {
			title: saveDataRecords.subject,
			table_name: TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES,
			slug_field: "action"
		};

		// Check if there are any active, not deleted templates
		const resultActive = await campaignNewsletterTemplate.find(
			{ is_active: ACTIVE, is_deleted: NOT_DELETED },
			{ projection: { _id: 1 } }
		).toArray();

		// Generate a unique slug for the template
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Prepare the data to insert
		let insertedData = {
			'template_title': saveDataRecords.template_title ? saveDataRecords.template_title : "",
			'action': (slugResponse && slugResponse.title) ? slugResponse.title : "",
			'description': saveDataRecords.description ? saveDataRecords.description : "",
			'subject': saveDataRecords.subject ? saveDataRecords.subject : "",
			'body': saveDataRecords.body ? saveDataRecords.body : "",
			'is_active': (resultActive.length > 0) ? DEACTIVE : ACTIVE,
			'design_json': saveDataRecords.design_json ? saveDataRecords.design_json : "",
			'is_deleted': NOT_DELETED,
			'created': getUtcDate(),
			'modified': getUtcDate(),
		};

		// Insert the new template
		const result = await campaignNewsletterTemplate.insertOne(insertedData);

		// Return the insertedId if successful, otherwise null
		return result && result.insertedId ? result.insertedId : null;
	} catch (err) {
		// Handle errors gracefully, return null
		return null;
	}
}; // End addCampaignTemplateNewsletter

/**
 * Function to get active campaign newsletter template details using async/await.
 *
 * @param {String|ObjectId} userId - The user ID to fetch the draft template for.
 * @return {Promise<Object>} - The response object with template details.
 */
getActiveCampaignNewsletterTemplate = async (userId) => {
	try {
		// Ensure userId is a valid ObjectId
		userId = userId ? newObjectIdDefault(userId) : newObjectIdDefault();

		// Get draft email template save data
		const draftTemplate = await db.collection(TABLE_EMAIL_TEMPLATES_DRAFT).findOne({
			'template_type': EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE,
			'user_id': userId,
		});

		if (draftTemplate) {
			// If draft exists, return it as the result
			return {
				status: STATUS_SUCCESS,
				is_draft: DEFAULT_ONE,
				result: draftTemplate ? draftTemplate : {}
			};
		} else {
			// If no draft, get the active campaign newsletter template details
			const activeTemplate = await db.collection(TABLE_CAMPAIGN_NEWSLETTER_TEMPLATES).findOne(
				{
					is_active: ACTIVE,
					is_deleted: NOT_DELETED
				},
				{
					projection: {
						template_title: 1,
						action: 1,
						description: 1,
						subject: 1,
						body: 1,
						design_json: 1
					}
				}
			);

			return {
				status: STATUS_SUCCESS,
				is_draft: DEFAULT_ZERO,
				result: activeTemplate ? activeTemplate : {}
			};
		}
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			result: {}
		};
	}
}; // End getActiveCampaignNewsletterTemplate

/**
 * Function to save campaign subscribe and unsubscribe logs using async/await.
 * Returns a status object indicating success or error.
 */
saveCampaignSubscribedAndUnsubscribedLogs = async (req, res, options) => {
	try {
		// Extract and validate input parameters
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const userEmail = options.user_email ? options.user_email : "";
		const userSubscribe = options.subscribed == "false" ? false : true;
		const userUnsubscribe = options.unsubscribed == "false" ? false : true;
		const campaignUnsubscribeValidateString = options.campaign_unsubscribe_validate_string ? options.campaign_unsubscribe_validate_string : "";

		const campaignSubscribedAndUnsubscribedLogs = db.collection(TABLE_CAMPAIGN_SUBSCRIBE_AND_UNSUBSCRIBE_LOGS);

		// Check for required fields
		if (!userId || !userEmail) {
			return {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
		}

		// Prepare the document to insert
		const insertDoc = {
			user_id: newObjectIdDefault(userId),
			user_email: userEmail,
			subscribed: userSubscribe,
			unsubscribed: userUnsubscribe,
			campaign_unsubscribe_validate_string: campaignUnsubscribeValidateString,
			created: getUtcDate(),
		};

		// Insert the log document asynchronously
		await campaignSubscribedAndUnsubscribedLogs.insertOne(insertDoc);

		// Return success message
		return {
			status: STATUS_SUCCESS,
			message: (userSubscribe == "false" || userSubscribe == false) ? res.__("front.campaign.email_has_been_unsubscribed_successfully") : res.__("front.campaign.email_has_been_subscribed_successfully"),
		};
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again")
		};
	}
}; // End saveCampaignSubscribedAndUnsubscribedLogs

/**
 * Function to save AI campaign chat.
 * Uses async/await for all database operations and handles random string generation.
 */
saveAiCampaignChat = async (req, res, options) => {
	try {
		// Extract and validate input parameters
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const chatMessage = options.message ? options.message : "";
		const responseType = options.response_type ? options.response_type : "";
		const serviceType = options.type ? options.type : "";
		const uniqueKey = options.unique_key ? options.unique_key : 8;
		const aiCampaignParentId = options.ai_campaign_parent_id ? newObjectIdDefault(options.ai_campaign_parent_id) : "";

		const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);

		// Check for required fields
		if (!userId || !aiCampaignParentId) {
			return {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
		}

		// Generate a random string for unique_key
		const optionRandomData = { srting_length: uniqueKey };
		const randomString = await getRandomString(req, res, optionRandomData);
		const randomKey = randomString && randomString.result ? randomString.result : "";

		// Prepare the document to insert
		const insertDoc = {
			user_id: userId,
			ai_campaign_parent_id: aiCampaignParentId,
			role: responseType,
			content: chatMessage,
			type: serviceType,
			first_result: true,
			regenerated: false,
			unique_key: randomKey,
			is_deleted: options.deleted,
			created: getUtcDate(),
		};

		// Insert the chat document asynchronously
		const result = await tableAiCampaignChat.insertOne(insertDoc);

		// Return success message if insert was successful
		if (result && result.insertedId) {
			return {
				status: STATUS_SUCCESS,
				result: result.insertedId,
				message: res.__("front.ai_steps.chat_has_been_added_successfully"),
			};
		} else {
			return {
				status: STATUS_ERROR,
				result: {},
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			result: {},
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End saveAiCampaignChat

/**
 * Function is used to edit AI generated reward.
 * Uses async/await for all database operations and clean formatting.
 */
editReward = async (req, res, packageRewardData) => {
	try {
		const rewards = db.collection(TABLE_REWARDS);

		// Prepare update data for the reward
		let updateData = {
			reward_text: packageRewardData.reward_text ? packageRewardData.reward_text : "",
			reward_sub_heading: packageRewardData.reward_sub_heading ? packageRewardData.reward_sub_heading : "",
			graphic_type: packageRewardData.graphic_type ? packageRewardData.graphic_type : "",
			graphic_image: packageRewardData.graphic_image ? packageRewardData.graphic_image : "",
			url_desc: packageRewardData.url_desc ? packageRewardData.url_desc : "",
			is_active: packageRewardData.status ? packageRewardData.status : DEACTIVE,
			store_type_id: packageRewardData.store_type_id ? packageRewardData.store_type_id : [],
			expiry_date: packageRewardData.expiry_date ? packageRewardData.expiry_date : "",
			toogle_expiry_date: packageRewardData.toogle_expiry_date ? true : false,
			is_deleted: NOT_DELETED,
			ai_reward_draft_flag: true,
			modified: getUtcDate(),
		};

		// Update the reward document
		await rewards.updateOne(
			{
				ai_campaign_chat_id: newObjectIdDefault(packageRewardData.ai_campaign_chat_id),
				user_id: newObjectIdDefault(packageRewardData.user_id),
				type: REWARDS_AI_USER_ADD,
			},
			{ $set: updateData }
		);

		// Find the reward to get the campaign type
		const rewardResult = await rewards.findOne(
			{
				ai_campaign_chat_id: newObjectIdDefault(packageRewardData.ai_campaign_chat_id),
				user_id: newObjectIdDefault(packageRewardData.user_id),
				type: REWARDS_AI_USER_ADD,
			},
			{ projection: { campaign_type: 1 } }
		);

		let campaignType = rewardResult ? rewardResult.campaign_type : "";
		let collectionName = TABLE_AI_CAMPAIGN_CHAT;

		if (campaignType === INSIDER_POLL_CAMPAIGN) {
			collectionName = TABLE_INSIDER_AI_CAMPAIGN_CHAT;
		} else if (campaignType === DEFAULT_CAMPAIGN) {
			collectionName = TABLE_AI_CAMPAIGN_CHAT;
		}

		// Update the related chat document with reward info
		await db.collection(collectionName).updateOne(
			{
				_id: newObjectIdDefault(packageRewardData.ai_campaign_chat_id),
				type: AI_RESPONSE_TYPE_REWARD,
			},
			{
				$set: {
					ai_reward_draft_flag: true,
					reward_slug: packageRewardData.slug,
					content: {
						heading: packageRewardData.reward_text ? packageRewardData.reward_text : "",
						subheading: packageRewardData.reward_sub_heading ? packageRewardData.reward_sub_heading : "",
						description: packageRewardData.url_desc ? packageRewardData.url_desc : "",
					},
				},
			}
		);

		// Return success message
		return {
			status: STATUS_SUCCESS,
			message: res.__("front.rewards.rewards_has_been_updated_successfully"),
		};
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End editReward

/**
 * Updates the lead table with the user's ID for a prime user.
 * Uses async/await for database operations.
 * @param {Object} options - Contains user_id and lead_forms_subscriber_id.
 * @returns {Promise<void>}
 */
primeUserIdUdateforLead = async (options) => {
	try {
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const leadFormsSubscriberId = options.lead_forms_subscriber_id ? newObjectIdDefault(options.lead_forms_subscriber_id) : "";

		if (leadFormsSubscriberId && userId) {
			const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);
			// Update the lead document with the user's ID
			await signupLeadForms.updateOne(
				{ _id: leadFormsSubscriberId },
				{ $set: { email_user_id: userId } }
			);
		}
		// No need to return anything, function resolves after update
	} catch (err) {
		// Log error if needed, but function is void
	}
}; // End primeUserIdUdateforLead

/**
 * Poll start schdule date time countdown
 * @returns total, days, hours, minutes, seconds
 */
getPollStartDateSchduleTimeRemaining = (scheduleStartDate) => {
	if (scheduleStartDate != "") {
		let endtime = scheduleStartDate;
		let startime = getUtcDate(getUtcDate());

		let total = Date.parse(endtime) - Date.parse(startime);
		let seconds = Math.floor((total / 1000) % 60);
		let minutes = Math.floor((total / 1000 / 60) % 60);
		let hours = Math.floor((total / (1000 * 60 * 60)) % 24);
		let days = Math.floor(total / (1000 * 60 * 60 * 24));

		total = (total) ? total : 0;
		days = (days) ? days : 0;
		hours = (hours) ? hours : 0;
		minutes = (minutes) ? minutes : 0;
		seconds = (seconds) ? seconds : 0;
		endtime = (endtime) ? endtime : 0;
		startime = (startime) ? startime : 0;

		return {
			'total': (total > 0) ? total : 0,
			'days': (total > 0 && days) ? days : 0,
			'hours': (total > 0 && hours) ? hours : 0,
			'minutes': (total > 0 && minutes) ? minutes : 0,
			'seconds': (total > 0 && seconds) ? seconds : 0,
			'endtime': (total > 0 && endtime) ? endtime : 0,
			'startime': (total > 0 && startime) ? startime : 0,
			'start_date_available_flag': (total > 0) ? true : false,
			'target_time_in_seconds': days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds,
		};
	} else {
		return {
			'total': 0,
			'days': 0,
			'hours': 0,
			'minutes': 0,
			'seconds': 0,
			'endtime': 0,
			'startime': 0,
			'start_date_available_flag': false,
			'target_time_in_seconds': 0,
		};
	}
} //End getPollStartDateSchduleTimeRemaining();

/**
 * Function to generate and save AI bot lead capture form.
 * Uses async/await for all database operations with proper comments.
 */
saveAiBotLeadCaptureForm = async (req, res, optionAiBotLeads) => {
	try {
		const leadsForms = db.collection(TABLE_LEAD_FORMS);
		const users = db.collection(TABLE_USERS);

		// Extract userId and signupFields from options
		const userId = optionAiBotLeads.user_id ? optionAiBotLeads.user_id : "";
		const signupFields = optionAiBotLeads.signup_fields ? optionAiBotLeads.signup_fields : [];
		req.body.ai_bot = true;

		// Validate required fields
		if (!userId || signupFields.length === 0) {
			// Missing userId or signupFields
			return;
		}

		// Count existing AI bot lead forms for this user
		const aiBotCount = await leadsForms.countDocuments({
			'user_id': newObjectIdDefault(userId),
			'ai_bot': true,
			'is_pocial_ai_bot_default': DEFAULT_ONE,
		});

		if (aiBotCount === 0) {
			// Prepare slug options for unique slug generation
			const slugOptions = {
				"title": res.locals.settings["AI_pocial_bot.enter_campaign_title"],
				"table_name": TABLE_LEAD_FORMS,
				"slug_field": "slug",
			};

			// Generate slug for the lead form
			const slugResponse = await getDatabaseSlug(slugOptions);
			const slugName = (slugResponse && slugResponse.title) ? slugResponse.title : "";

			// Insert new lead form document
			const insertResult = await leadsForms.insertOne({
				'user_id': newObjectIdDefault(userId),
				'title': res.locals.settings["AI_pocial_bot.enter_campaign_title"],
				'description': res.locals.settings["AI_pocial_bot.description"],
				'text_to_display': res.locals.settings["AI_pocial_bot.enter_text_to_display_with_the_url"],
				'display_url_description': res.locals.settings["AI_pocial_bot.enter_the_title_to_display_with_this_form"] || "",
				'signin_option': SIGNIN_OPTION_NO,
				'kiosk_option': KIOSK_OPTION_NO,
				'signup_fields': signupFields,
				'button_name': res.locals.settings["AI_pocial_bot.submit_button_title"],
				'mandatory_options': signupFields,
				'message_box_title': [],
				'type_dropdown_title': [],
				'message_field_count': 0,
				'dropdown_field_count': 0,
				'form_title': res.locals.settings["AI_pocial_bot.form_title"],
				'notify_email': [],
				'image': "",
				'graphic_type': "",
				'slug': slugName,
				'is_default': DEFAULT_ZERO,
				'is_excel_default': DEFAULT_ZERO,
				'is_pocial_ai_bot_default': DEFAULT_ONE,
				'custom_thank_you_message': res.locals.settings["AI_pocial_bot.custom_thank_you_message"],
				'custom_thank_you_title': res.locals.settings["AI_pocial_bot.custom_thank_you_title"],
				'ai_bot': true,
				'is_home_page': DEFAULT_ZERO,
				'is_subscriber': DEFAULT_ZERO,
				'is_deleted': NOT_DELETED,
				'is_active': ACTIVE,
				'modified': getUtcDate(),
				'created': getUtcDate()
			});

			// Get the inserted lead form ID
			const insertedId = (insertResult && insertResult.insertedId) ? insertResult.insertedId : "";

			// Prepare data for scripted code generation
			req.body.unique_name = res.locals.settings["AI_pocial_bot.cutomization_unique_name"];
			req.body.main_component = MAIN_COMPONENT_CUSTOMIZATION;
			req.body.heading = HEADING_CUSTOMIZATION;
			req.body.banner = BANNER_CUSTOMIZATION;
			req.body.description = DESCRIPTION_CUSTOMIZATION;
			req.body.form_data = FORMDATA_CUSTOMIZATION;
			req.body.button = BUTTON_CUSTOMIZATION;

			const optionsData = { 'lead_id': insertedId, 'lead_slug': '', 'user_id': userId };

			// Generate scripted code (await the promise)
			const response = await generateScriptedCode(req, res, optionsData);
			const customizedScriptId = response.customized_script_id;
			const customizedScriptSlug = response.customized_script_slug;

			// Update user document with new lead form and script info
			await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{
					'$set': {
						'ai_bot_forms_id': newObjectIdDefault(insertedId),
						'ai_bot_forms_slug': slugName,
						'ai_bot_customized_script_id': newObjectIdDefault(customizedScriptId),
						'ai_bot_customized_script_slug': customizedScriptSlug,
					}
				}
			);

			// Return the inserted lead form ID
			return insertedId;
		} else {
			// Lead form already exists, do nothing
			return;
		}
	} catch (error) {
		// Handle errors gracefully
		console.error("Error in saveAiBotLeadCaptureForm:", error);
		return;
	}
}; // End saveAiBotLeadCaptureForm

/**
 * Remove follower list data for users who have been deleted from the user list.
 * Uses async/await for all database operations and handles parallel deletions.
 */
deleteFollowerData = async (req, res) => {
	try {
		const usersFollowerList = db.collection(TABLE_USERS_FOLLOWER_LIST);

		// Get all valid user IDs
		const userIds = await getAllUsersIds(req, res);
		const userIdsArray = userIds.map(id => newObjectIdDefault(id));

		// Prepare deletion queries for users not in the current user list
		const removeUserQuery = { "user_id": { $nin: userIdsArray } };
		const removeFollowedByQuery = { "followed_by": { $nin: userIdsArray } };

		// Run both deletions in parallel
		const [followerDistincUser, followedBy] = await Promise.all([
			usersFollowerList.deleteMany(removeUserQuery),
			usersFollowerList.deleteMany(removeFollowedByQuery)
		]);

		// Check if both deletions were successful
		if (followerDistincUser && followedBy) {
			return STATUS_SUCCESS;
		} else {
			return STATUS_ERROR;
		}
	} catch (error) {
		console.error("Error in deleteFollowerData:", error);
		return STATUS_ERROR;
	}
}; // End deleteFollowerData

/**
 * Function to get master details by masterId.
 * Uses async/await for database query.
 */
getMasterDetails = async (masterId) => {
	try {
		if (masterId !== '') {
			const masters = db.collection(TABLE_MASTERS);
			// Find the master document by ID, projecting only the name field
			const result = await masters.findOne(
				{ '_id': newObjectIdDefault(masterId) },
				{ projection: { name: 1 } }
			);
			// Return the name if found, otherwise undefined
			return result ? result.name : undefined;
		} else {
			return undefined;
		}
	} catch (error) {
		// Handle errors gracefully
		console.error("Error in getMasterDetails:", error);
		return undefined;
	}
}; // End getMasterDetails

/**
 * Function to get multiple master detail names by their IDs.
 * Uses async/await for database query.
 * @param {Array} masterIds - Array of master IDs.
 * @returns {Promise<Array>} - Promise resolving to array of master names.
 */
getMultipleMasterDetails = async (masterIds) => {
	try {
		// Return empty array if no IDs provided
		if (!Array.isArray(masterIds) || masterIds.length === 0) {
			return [];
		}

		// Convert all non-empty IDs to ObjectId
		const businessIndustryIdsArray = masterIds
			.filter(id => id !== '')
			.map(id => newObjectIdDefault(id));

		// If no valid IDs after filtering, return empty array
		if (businessIndustryIdsArray.length === 0) {
			return [];
		}

		const masters = db.collection(TABLE_MASTERS);

		// Query for distinct names matching the provided IDs
		const resultMasters = await masters.distinct("name", { "_id": { $in: businessIndustryIdsArray } });

		return resultMasters;
	} catch (error) {
		// Handle errors gracefully
		console.error("Error in getMultipleMasterDetails:", error);
		return [];
	}
}; // End getMultipleMasterDetails

/**
 * Function to convert HTML to image for email template.
 * Uses async/await for all database operations and file handling.
 * Handles S3 upload and file cleanup in parallel if enabled.
 */
htmltoImageConvert = async (req, res, templateId) => {
	try {
		// Get user data and business information
		const ownerUserData = req.user_data ? req.user_data : "";
		const publicBusinessInformaton = ownerUserData.public_business_informaton ? ownerUserData.public_business_informaton : "";
		const businessLogo = publicBusinessInformaton && publicBusinessInformaton.business_logo ? publicBusinessInformaton.business_logo : "";
		const businessRewardLogo = publicBusinessInformaton && publicBusinessInformaton.reward_image ? publicBusinessInformaton.reward_image : "";
		const primaryAddress = publicBusinessInformaton.primary_address ? publicBusinessInformaton.primary_address : "";
		const nameOfTheBusiness = publicBusinessInformaton.name_of_the_business ? publicBusinessInformaton.name_of_the_business : "";
		let profileImageUrl = "";

		// Use reward image if available, otherwise use business logo
		if (businessRewardLogo !== '') {
			profileImageUrl = USERS_URL + businessRewardLogo;
		} else if (businessLogo !== '') {
			profileImageUrl = USERS_URL + businessLogo;
		}

		const emailNewsletterTemplates = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		// If no templateId provided, exit early
		if (!templateId) return;

		templateId = newObjectIdDefault(templateId);

		// Get email template details
		const resultTemplate = await emailNewsletterTemplates.findOne(
			{ "_id": templateId },
			{ projection: { '_id': 1, 'body': 1, 'action': 1, 'ai_campaign_chat_id': 1, 'email_template_image': 1 } }
		);

		if (!resultTemplate) return;

		let htmlContent = resultTemplate.body ? resultTemplate.body : "";
		const oldBodyImage = resultTemplate.email_template_image ? resultTemplate.email_template_image : "";
		const aiCampaignChatId = resultTemplate.ai_campaign_chat_id ? newObjectIdDefault(resultTemplate.ai_campaign_chat_id) : "";
		const emailAction = resultTemplate.action ? resultTemplate.action : "";

		// Create new folder for this month and day
		const today = new Date();
		const filePath = EMAIL_NEWSLETTER_TEMPLATE_FILE_PATH;
		const newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
		createFolder(filePath + newFolder);
		const newFileName = newFolder + Date.now() + '-' + generateString(5).trim() + ".png";

		// Replace single quotes with blank
		htmlContent = htmlContent.replace(/'/g, '');

		// Replace placeholders in HTML content
		if (profileImageUrl !== '') {
			const imgSrc = `<img src="${profileImageUrl}" style="max-height:100px;" >`;
			htmlContent = htmlContent.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), imgSrc);
		} else {
			htmlContent = htmlContent.replace(RegExp('{BUSINESS_IMAGE_URL}', 'g'), '');
		}
		htmlContent = htmlContent.replace(RegExp('{BUSINESS_NAME}', 'g'), nameOfTheBusiness);
		htmlContent = htmlContent.replace(RegExp('{BUSINESS_ADDRESS}', 'g'), primaryAddress);
		htmlContent = htmlContent.replace(RegExp('{CURRENT_YEAR}', 'g'), new Date().getFullYear());

		// Construct the full path and filename
		const uploadedFile = filePath + newFileName;

		// Promisify wkhtmltoimage.generate for async/await usage
		const generateImage = (html, options) => {
			return new Promise((resolve, reject) => {
				wkhtmltoimage.generate(html, options, (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
		};

		// Generate image from HTML
		await generateImage(htmlContent, { output: uploadedFile, width: WELCOME_EMAIL_GENERATE_WIDTH });

		// Update template with new image filename
		await emailNewsletterTemplates.updateOne(
			{ "_id": templateId },
			{ $set: { 'email_template_image': newFileName } }
		);

		// If aiCampaignChatId exists, update campaign chat table
		if (aiCampaignChatId) {
			const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
			await tableAiCampaignChat.updateOne(
				{ "_id": aiCampaignChatId },
				{
					$set: {
						'newsletter_email_action': emailAction,
						'newsletter_email_action_body': htmlContent,
						'newsletter_email_action_image': newFileName
					}
				}
			);
		}

		// If S3 upload is enabled, handle file upload and cleanup
		if (UPLOAD_TO_S3) {
			// Read the generated image file
			const data = await new Promise((resolve, reject) => {
				fs.readFile(uploadedFile, (err, data) => {
					if (err) reject(err);
					else resolve(data);
				});
			});

			const targetFolder = "email_newsletter_template/" + newFileName;
			const params = {
				Bucket: process.env.AWS_BUCKET_NAME,
				Key: S3_BUCKET_UPLOAD_PATH + targetFolder,
				Body: data // Buffer containing image data
			};

			// Upload to S3
			await new Promise((resolve, reject) => {
				s3.upload(params, (uploadErr, uploadData) => {
					if (uploadErr) reject(uploadErr);
					else resolve(uploadData);
				});
			});

			// Remove old image file if exists and remove local generated file, in parallel
			const removePromises = [];
			if (oldBodyImage) {
				const imagesData = { file_path: filePath + oldBodyImage };
				removePromises.push(removeFile(imagesData));
			}
			const localImageData = { file_path: uploadedFile };
			removePromises.push(removeFileOnlyLocalFolder(localImageData));
			await Promise.all(removePromises);
		}

		// All done
		return;
	} catch (err) {
		console.error('Error in htmltoImageConvert:', err);
		return;
	}
}; // End htmltoImageConvert

/**
 * Function for used to complete assign reward for complete profile
 */
completeEmailTemplateRewardAssign = (req, res, optionTemplate) => {
	return new Promise(resolve => {
		let finalResponse = {};
		/** get user id get **/
		let loginUserData = (req.user_data) ? req.user_data : "";
		let userId = (loginUserData._id) ? newObjectIdDefault(loginUserData._id) : "";
		let attachReward = (optionTemplate.attach_reward) ? newObjectIdDefault(optionTemplate.attach_reward) : "";

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
		const rewards = db.collection(TABLE_REWARDS);
		const usersCollection = db.collection(TABLE_USERS);

		if (!userId) {
			finalResponse = {
				'status': STATUS_ERROR,
				'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
			};
			return resolve(finalResponse)
		} else {
			/** get reward chaeck user wise**/
			rewards.findOne({
				'_id': attachReward,
				'user_id': newObjectIdDefault(userId),
				'is_deleted': NOT_DELETED,
				'is_active': ACTIVE
			}, { projection: { "_id": 1, "reward_text": 1, "reward_sub_heading": 1 } }, (rewardErr, rewardResult) => {

				/** Get complete tempalte check**/
				emailTemplate.findOne({
					'template_type': EMAIL_TEMPLATE_COMPLETE_TYPE,
					'user_id': newObjectIdDefault(ADMIN_ID),
					'is_deleted': NOT_DELETED,
					'is_active': ACTIVE
				}, { projection: { _id: 1, action: 1, subject: 1 } }, (tempalteErr, tempalteResult) => {
					if (tempalteResult) {
						/** Update complete attach reward */
						usersCollection.updateOne({
							'_id': userId
						}, {
							$set: {
								"complete_profile_reward": {
									"attach_reward": attachReward,
									"tempalte_id": newObjectIdDefault(tempalteResult._id),
									"template_action": tempalteResult.action,
									"template_subject": tempalteResult.subject,
									"attach_reward_name": (!rewardErr && rewardResult && rewardResult.reward_text) ? rewardResult.reward_text : "",
								}
							}
						}, () => {
							/** Send success message reward assign**/
							finalResponse = {
								'status': STATUS_SUCCESS,
								'message': (attachReward) ? res.__("front.email_template.reward_has_been_assign_successfully") : res.__("front.email_template.reward_has_been_removed"),
							};
							return resolve(finalResponse);
						});
					} else {
						finalResponse = {
							'status': STATUS_ERROR,
							'message': res.__("front.email_template.tempalte_does_not_exist"),
						};
						return resolve(finalResponse);
					}
				});
			});
		}
	});
} //End completeEmailTemplateRewardAssign();

/**
 * Sends a notification email after a user completes their profile.
 * Notifies both the owner user and any additional emails specified in the lead form.
 * Uses async/await for all database operations and handles parallel email sending.
 */
sendCompleteEmailNotify = async (req, res, notifyCompleteOptions) => {
	try {
		// Prepare input parameters
		const leadFormsId = notifyCompleteOptions.lead_forms_id ? newObjectIdDefault(notifyCompleteOptions.lead_forms_id) : "";
		const ownerBusinessEmail = notifyCompleteOptions.owner_user_email ? notifyCompleteOptions.owner_user_email : "";

		// Get the lead form data
		const leadFormCollection = db.collection(TABLE_LEAD_FORMS);
		const resultLeadData = await leadFormCollection.findOne({ '_id': leadFormsId });

		if (!resultLeadData) {
			// Lead form not found, nothing to notify
			return;
		}

		const leadTitleName = resultLeadData.title ? resultLeadData.title : "";
		const allNotifyEmail = Array.isArray(resultLeadData.notify_email) ? resultLeadData.notify_email : [];

		// Prepare email options for the owner business email
		const ownerEmailOptions = {
			to: ownerBusinessEmail,
			action: "complete_notify_leads_email",
			rep_array: [DEAR_HI_CONSTANT, ownerBusinessEmail, leadTitleName]
		};

		// Send email to the owner (do not await, let it run in background)
		sendMail(req, res, ownerEmailOptions);

		// Prepare and send emails to all notify emails in parallel
		if (allNotifyEmail.length > 0) {
			// Filter out empty emails and map to sendMail promises
			const notifyEmailPromises = allNotifyEmail
				.map((record, index) => {
					const recordEmail = record && record.value ? record.value : "";
					if (recordEmail !== "") {
						const emailOptions = {
							index: index,
							to: recordEmail,
							action: "complete_notify_leads_email",
							rep_array: [DEAR_HI_CONSTANT, recordEmail, leadTitleName]
						};
						// Send email (do not await, let Promise.all handle them)
						return sendMail(req, res, emailOptions);
					}
					return null;
				})
				.filter(Boolean);

			// Wait for all notification emails to be sent (in parallel)
			await Promise.all(notifyEmailPromises);
		}

		// All emails sent (or no emails to send)
		return;
	} catch (error) {
		// Handle errors gracefully (log if needed)
		return;
	}
}; // End sendCompleteEmailNotify

/**
 * Function to send mail to the owner of the lead from which the user is created after vote.
 * Uses async/await for database operations and clean formatting.
 */
mailSentToLoyalistUserAfterVote = async (req, res, optionsMailUser) => {
	try {
		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		// Get the vote user ID from options
		const voteUserId = optionsMailUser.vote_user_id ? newObjectIdDefault(optionsMailUser.vote_user_id) : "";

		if (!voteUserId) {
			// No vote user ID provided, nothing to do
			return;
		}

		// Find the lead form(s) created by this user
		const resultLoyaltyList = await signupLeadForms.find(
			{ 'email_user_id': voteUserId },
			{ projection: { '_id': 1, 'creator_name': 1, 'creator_email': 1 } }
		).toArray();

		// If a matching lead form is found, send the notification email
		if (resultLoyaltyList && resultLoyaltyList.length > 0) {
			const loyalUserData = resultLoyaltyList[0];
			const creatorEmail = loyalUserData.creator_email || "";
			const creatorName = loyalUserData.creator_name || "";

			// Prepare email options
			const emailOptions = {
				to: creatorEmail,
				action: "owner_lead_from_user_created_after_vote",
				rep_array: [DEAR_HI_CONSTANT, creatorName]
			};

			// Send email (do not await, let it run in background)
			sendMail(req, res, emailOptions);
		}

		// All done
		return;
	} catch (error) {
		// Handle errors gracefully (log if needed)
		return;
	}
}; // End mailSentToLoyalistUserAfterVote

/**
 * Function to delete image for reward.
 * Uses async/await for all database operations and file handling.
 * Handles DB updates in parallel.
 */
deleteImageForReward = async (req, res, rewardOptionImages) => {
	try {
		const rewardId = rewardOptionImages.reward_id ? newObjectIdDefault(rewardOptionImages.reward_id) : "";
		const userId = rewardOptionImages.user_id ? newObjectIdDefault(rewardOptionImages.user_id) : "";
		const imageName = rewardOptionImages.image_name ? rewardOptionImages.image_name : "";

		const rewardCollection = db.collection(TABLE_REWARDS);
		const earnSentCollection = db.collection(TABLE_EARN_SENT_REWARDS);

		const imagesData = {
			file_path: LEADS_FORM_FILE_PATH + imageName
		};

		// Validate required fields
		if (rewardId && userId && imageName) {
			// Remove the image file
			await removeFile(imagesData);

			// Prepare update queries
			const rewardUpdateQuery = rewardCollection.updateOne(
				{ "_id": rewardId, "user_id": userId, "graphic_image": imageName },
				{ $set: { "graphic_image": "", "modified": getUtcDate() } }
			);

			const earnSentUpdateQuery = earnSentCollection.updateMany(
				{ 'reward_id': rewardId },
				{ $set: { 'image': "" } }
			);

			// Run DB updates in parallel
			await Promise.all([rewardUpdateQuery, earnSentUpdateQuery]);

			// Send success response
			return {
				'status': STATUS_SUCCESS,
				'message': res.__("front.reward.image_has_been_delete_successfully"),
			};
		} else {
			// Missing required data
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.user.image_has_been_not_deleted"),
			};
		}
	} catch (error) {
		// Handle errors gracefully
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.user.image_has_been_not_deleted"),
		};
	}
}; // End deleteImageForReward

/**
 * Function to update earn sent reward after reward update.
 * Uses async/await for all database operations.
 */
earnSentRewardUpdate = async (optionRewards) => {
	try {
		const rewardCollection = db.collection(TABLE_REWARDS);
		const earnSentCollection = db.collection(TABLE_EARN_SENT_REWARDS);

		const userId = optionRewards.user_id ? optionRewards.user_id : "";
		const rewardId = optionRewards.reward_id ? newObjectIdDefault(optionRewards.reward_id) : "";
		const rewardSlug = optionRewards.reward_slug ? optionRewards.reward_slug : "";

		// Validate required fields
		if (userId !== '' && (rewardId !== '' || rewardSlug !== '')) {
			// Find the reward by user and either rewardId or slug
			const resultRewards = await rewardCollection.findOne({
				"user_id": newObjectIdDefault(userId),
				$or: [
					{ '_id': rewardId },
					{ 'slug': rewardSlug },
				]
			});

			if (resultRewards) {
				const earnSentRewardId = resultRewards._id ? newObjectIdDefault(resultRewards._id) : "";

				// Prepare updated data for earn sent rewards
				const updatedEarnSentReward = {
					'title': resultRewards.reward_text ? resultRewards.reward_text : "",
					'sub_title': resultRewards.reward_sub_heading ? resultRewards.reward_sub_heading : "",
					'image': resultRewards.graphic_image ? resultRewards.graphic_image : "",
					'url_desc': resultRewards.url_desc ? resultRewards.url_desc : "",
					'expiry_date': resultRewards.expiry_date ? resultRewards.expiry_date : "",
					'toogle_expiry_date': resultRewards.toogle_expiry_date ? true : false,
					'store_type_id': resultRewards.store_type_id ? resultRewards.store_type_id : [],
					'modified': getUtcDate(),
				};

				// Update all earn sent rewards with the new reward data
				await earnSentCollection.updateMany(
					{ 'reward_id': earnSentRewardId },
					{ $set: updatedEarnSentReward }
				);
			}
		}
		// Always resolve (no return value needed)
		return;
	} catch (error) {
		// Handle errors gracefully, but always resolve
		return;
	}
}; // End earnSentRewardUpdate

/**
 * Function to get the list of welcome email templates for a user.
 * Uses async/await for database query and clean formatting.
 */
getWelcomeEmailData = async (userId) => {
	try {
		// Return error if userId is not provided
		if (!userId || userId === '') {
			return {
				'status': STATUS_ERROR,
				'result': []
			};
		}

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		// Build query and projection
		const query = {
			'template_type': { $in: [EMAIL_TEMPLATE_WELCOME_TYPE, EMAIL_TEMPLATE_CAMPAIGN_NEWSLETTER_TYPE] },
			'is_deleted': NOT_DELETED,
			'is_active': ACTIVE,
			'status': { $ne: DRAFT_STATUS },
			'user_id': newObjectIdDefault(userId)
		};
		const projection = {
			'_id': 1,
			'template_title': 1,
			'created': 1,
		};

		// Fetch templates using async/await
		const resulttemplate = await emailTemplate.find(query, { projection }).sort({ 'created': SORT_DESC }).toArray();

		// Return success with result
		return {
			'status': STATUS_SUCCESS,
			'result': resulttemplate
		};
	} catch (error) {
		// Handle errors gracefully
		return {
			'status': STATUS_ERROR,
			'result': []
		};
	}
}; // End getWelcomeEmailData

/**
 * Function to assign a welcome email template to a lead capture form.
 * Uses async/await for all database operations and handles queries in parallel.
 */
leadCaptureForAssignWelcomeEmail = async (req, res, optionTemplate) => {
	let finalResponse = {};
	try {
		// Get user and template IDs
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? newObjectIdDefault(loginUserData._id) : "";
		const leadFormsId = optionTemplate.lead_forms_id ? newObjectIdDefault(optionTemplate.lead_forms_id) : "";
		const assignWelcomeEmailId = optionTemplate.assign_welcome_email_id ? newObjectIdDefault(optionTemplate.assign_welcome_email_id) : "";

		// Validate required IDs
		if (!userId || !leadFormsId || !assignWelcomeEmailId) {
			finalResponse = {
				'status': STATUS_ERROR,
				'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
			};
			return finalResponse;
		}

		const leadForm = db.collection(TABLE_LEAD_FORMS);
		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);

		// Run both queries in parallel using Promise.all
		const [leadFormResult, welcomeTemplateResult] = await Promise.all([
			// Get lead form details
			leadForm.findOne(
				{ "_id": leadFormsId, "user_id": userId },
				{ projection: { _id: 1 } }
			),
			// Get welcome email template details
			emailTemplate.findOne(
				{
					"_id": assignWelcomeEmailId,
					'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
					'is_active': ACTIVE,
					"user_id": userId
				},
				{ projection: { _id: 1, ai_campaign_chat_id: 1, content: 1, role: 1 } }
			)
		]);

		// Check if lead form exists
		if (!leadFormResult) {
			finalResponse = {
				'status': STATUS_ERROR,
				'message': res.__("front.lead_form.campaign_not_found"),
			};
			return finalResponse;
		}

		// Check if welcome template exists
		if (!welcomeTemplateResult) {
			finalResponse = {
				'status': STATUS_ERROR,
				'message': res.__("front.email_template.template_not_found"),
			};
			return finalResponse;
		}

		// Update the lead form with the assigned welcome email template
		await leadForm.updateOne(
			{ '_id': leadFormsId },
			{ $set: { 'assign_welcome_email_id': assignWelcomeEmailId } }
		);

		finalResponse = {
			'status': STATUS_SUCCESS,
			'message': res.__("front.email_template.welcome_email_template_has_been_assign_successfully")
		};
		return finalResponse;

	} catch (error) {
		// Handle errors gracefully
		finalResponse = {
			'status': STATUS_ERROR,
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
		return finalResponse;
	}
}; // End leadCaptureForAssignWelcomeEmail

/**
 * Function to update lead status.
 * Uses async/await for database operations.
 */
updateLeadStatus = async (req, res, options) => {
	try {
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		// Get user ID and lead form ID
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const leadFormsId = options.lead_forms_id ? newObjectIdDefault(options.lead_forms_id) : "";
		const status = options.is_active ? parseInt(options.is_active) : DEACTIVE;

		// Toggle status: if currently DEACTIVE, set to ACTIVE, else set to DEACTIVE
		const statusData = (status == DEACTIVE) ? ACTIVE : DEACTIVE;

		// Update lead status in the database
		const updateResult = await leadsForms.updateOne(
			{ '_id': leadFormsId, 'user_id': userId },
			{ $set: { 'is_active': statusData } }
		);

		// Check if update was successful
		if (updateResult && updateResult.modifiedCount > 0) {
			return {
				'status': STATUS_SUCCESS,
				'message': (status == DEACTIVE) ? res.__("front.leads.status_has_been_updated_successfully.") : res.__("front.leads.campaign_lead_has_been_deactivated_successfully."),
			};
		} else {
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.system.something_going_wrong_please_try_again"),
			};
		}
	} catch (error) {
		// Handle errors gracefully
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End updateLeadStatus

/**
 * Function to update and assign the default welcome email ID for a user.
 * Uses async/await for all database operations.
 */
updateAssignDefaultWelcomeEmailId = async (userId) => {
	try {
		if (!userId) {
			// No userId provided, return error status
			return STATUS_ERROR;
		}

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		// Get the active welcome email template for the user
		const template = await emailTemplate.findOne(
			{
				'template_type': EMAIL_TEMPLATE_WELCOME_TYPE,
				'is_deleted': NOT_DELETED,
				'is_active': ACTIVE,
				'user_id': newObjectIdDefault(userId)
			},
			{ projection: { _id: 1, template_title: 1 } }
		);

		if (!template) {
			// No active template found, return error status
			return STATUS_ERROR;
		}

		const welcomeEmailId = newObjectIdDefault(template._id);

		// Set conditions for updating lead forms
		const condition = {
			'user_id': newObjectIdDefault(userId),
			'is_active': ACTIVE,
			'is_deleted': NOT_DELETED,
			'assign_welcome_email_id': { $in: ['', null] },
			$or: [
				{ 'is_default': DEFAULT_ONE },
				{ 'is_excel_default': DEFAULT_ONE },
				{ 'is_pocial_ai_bot_default': DEFAULT_ONE },
				{ 'ai_bot': true },
			]
		};

		// Assign the default welcome email to all matching lead forms
		await leadsForms.updateMany(condition, { $set: { "assign_welcome_email_id": welcomeEmailId } });

		return STATUS_SUCCESS;
	} catch (error) {
		// Handle errors gracefully
		console.error("Error in updateAssignDefaultWelcomeEmailId:", error);
		return STATUS_ERROR;
	}
}; // End updateAssignDefaultWelcomeEmailId

/**
 * Function to upload user reward images.
 * Uses async/await for all database and file operations.
 * Handles all queries and file operations with proper error handling.
 */
uploadUserRewardImage = async (req, res, userId) => {
	try {
		// Check if userId is provided
		if (!userId) {
			return {
				status: STATUS_ERROR_INVALID_ACCESS,
				result: "",
				message: res.__("front.system.something_going_wrong_please_try_again")
			};
		}

		// Prepare image upload options
		const oldRewardImage = req.body.old_reward_image ? req.body.old_reward_image : "";
		const rewardImage = (req.files && req.files.reward_image) ? req.files.reward_image : "";
		const options = {
			image: rewardImage,
			filePath: USERS_FILE_PATH,
			oldPath: oldRewardImage
		};

		// Upload user reward image using async/await
		const response = await moveUploadedFile(req, res, options);

		// If upload failed, return error response
		if (response.status === STATUS_ERROR) {
			return {
				status: STATUS_ERROR_INVALID_ACCESS,
				result: "",
				message: response.message
			};
		}

		// Get the uploaded image name
		const imageName = response.fileName ? response.fileName : "";
		const users = db.collection(TABLE_USERS);

		// Update user reward image data in the database using async/await
		await users.updateOne({ _id: newObjectIdDefault(userId) }, { $set: { 'reward_image': imageName, 'public_business_informaton.reward_image': imageName } });

		// Return success response
		return {
			status: STATUS_SUCCESS,
			errors: "",
			message: res.__("front.user.reward_image_has_been_updated_successfully")
		};
	} catch (err) {
		// Handle errors gracefully
		return {
			status: STATUS_ERROR_INVALID_ACCESS,
			result: "",
			message: res.__("front.system.something_going_wrong_please_try_again")
		};
	}
}; // End uploadUserRewardImage

/**
 * Function to activate/deactivate welcome email template.
 * Uses async/await for all database operations.
 */
activeDeactiveWelcomeEmail = async (req, res, tempalteOptions) => {
	try {
		const userId = tempalteOptions.user_id ? newObjectIdDefault(tempalteOptions.user_id) : "";
		const templateId = tempalteOptions.template_id ? newObjectIdDefault(tempalteOptions.template_id) : "";
		const status = tempalteOptions.is_active ? parseInt(tempalteOptions.is_active) : DEACTIVE;
		const statusData = (status === DEACTIVE) ? ACTIVE : DEACTIVE;

		if (userId === "" || templateId === "") {
			return {
				status: STATUS_ERROR,
				message: res.__("system.something_going_wrong_please_try_again")
			};
		}

		const emailTemplate = db.collection(TABLE_EMAIL_NEWSLETTER_TEMPLATE);
		const leadsForms = db.collection(TABLE_LEAD_FORMS);

		// Check if there is only one active welcome template for this user
		const conditionData = {
			user_id: userId,
			template_type: EMAIL_TEMPLATE_WELCOME_TYPE,
			is_active: ACTIVE,
			is_deleted: NOT_DELETED
		};

		const activeCount = await emailTemplate.countDocuments(conditionData);

		// Prevent deactivation if only one active template exists
		if (activeCount === 1 && statusData === DEACTIVE) {
			return {
				status: STATUS_ERROR,
				errors: "",
				message: res.__("front.email_template.email_template_not_deactive")
			};
		}

		// Check if the template is already assigned to a user in leadsForms
		const attachCount = await leadsForms.countDocuments({ user_id: userId, assign_welcome_email_id: templateId });

		// If the template is attached and wants to be activated, allow activation
		let finalAttachCount = attachCount;
		if (attachCount > 0 && statusData === ACTIVE) {
			finalAttachCount = 0;
		}

		if (finalAttachCount > 0) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.email_template.these_template_are_already_assigned_to_user")
			};
		}

		// Update the status of the welcome email template
		await emailTemplate.updateOne({
			_id: newObjectIdDefault(templateId),
			user_id: newObjectIdDefault(userId),
			template_type: EMAIL_TEMPLATE_WELCOME_TYPE
		}, {
			$set: {
				is_active: statusData,
				modified: getUtcDate()
			}
		});

		return {
			status: STATUS_SUCCESS,
			message: (status === DEACTIVE) ? res.__("front.email_template.email_template_has_been_active_successfully") : res.__("front.email_template.email_template_has_been_deactive_successfully")
		};
	} catch (error) {
		console.error("Error in active Deactive Welcome Email:", error);
		return {
			status: STATUS_ERROR,
			message: res.__("system.something_going_wrong_please_try_again")
		};
	}
}; // End activeDeactiveWelcomeEmail

/**
 * Function to send a verification link to the user's email.
 * Uses async/await for all database and email operations.
 */
userVerifyLinkSendUrlAccourding = async (req, res, loginUserData) => {
	try {
		let email = (loginUserData.email) ? (loginUserData.email).toLowerCase() : "";
		let fullName = (loginUserData.full_name) ? loginUserData.full_name : "";

		// Validate required fields
		if (!fullName || !email) {
			return STATUS_ERROR;
		}

		// Generate the email verification string
		const emailVerifyValidateString = verifyEmailUserValidateString(email);

		// Update the user's document with the new validation string
		const users = db.collection(TABLE_USERS);
		const updateQuery = {
			$or: [
				{ 'email': { $regex: "^" + email + "$", $options: "i" } },
				{ 'email': email }
			]
		};
		const updateData = {
			$set: {
				'email_verify_validate_string': emailVerifyValidateString
			}
		};

		// Await the update operation
		await users.updateOne(updateQuery, updateData);

		// Construct the verification URL
		const validateStringURl = USER_VERIFY_LINK_FRONT_URL + emailVerifyValidateString;

		// Prepare email options
		const emailOptions = {
			'to': email,
			'action': "verify_user_account_url_accourding",
			'rep_array': [DEAR_HI_CONSTANT, fullName, validateStringURl]
		};

		// Send the verification email
		await sendMail(req, res, emailOptions);

		return STATUS_SUCCESS;
	} catch (error) {
		console.error("Error in userVerifyLinkSendUrlAccourding:", error);
		return STATUS_ERROR;
	}
}; // End userVerifyLinkSendUrlAccourding

/**
 * Function to convert HTML to image for user signature.
 * Uses async/await for all database and file operations.
 * Handles parallel file removals using Promise.all where appropriate.
 */
signatureHtmltoImageConvert = async (req, res, options) => {
	try {
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const firstName = options.first_name ? options.first_name : "";
		const lastName = options.last_name ? options.last_name : "";
		const nameOfTheBusiness = options.name_of_the_business ? options.name_of_the_business : "";
		let fullName = `${firstName} ${lastName}`;

		// Validate required fields
		if (!userId || !firstName || !lastName) {
			return;
		}

		const userCollection = db.collection(TABLE_USERS);

		// Fetch user document
		const result = await userCollection.findOne({ "_id": newObjectIdDefault(userId) }, { projection: { 'public_business_informaton': 1, 'full_name': 1, 'signature_image': 1, 'signature_image_name': 1 } });

		if (!result) {
			return;
		}

		let signatureImageName = result.signature_image_name ? result.signature_image_name.toLowerCase() : "";
		let signatureImage = result.signature_image ? result.signature_image : "";

		let userFullName = fullName.toLowerCase();

		// If business name is present, use it for signature
		if (nameOfTheBusiness !== '') {
			userFullName = nameOfTheBusiness.toLowerCase();
			fullName = nameOfTheBusiness;
		}

		// If signature image already exists for this name, do nothing
		if (signatureImage && userFullName === signatureImageName) {
			return;
		}

		// Generate HTML for signature image
		const htmlContent = `
			<style>
				@font-face {
					font-family: 'brittany_signatureregular';
					src: url('https://d5cvgp25mt3yl.cloudfront.net/uploads/welcome-email-signature-fonts/brittanysignature-webfont.eot');
					src: url('https://d5cvgp25mt3yl.cloudfront.net/uploads/welcome-email-signature-fonts/brittanysignature-webfont.eot?#iefix') format('embedded-opentype'),
						url('https://d5cvgp25mt3yl.cloudfront.net/uploads/welcome-email-signature-fonts/brittanysignature-webfont.woff2') format('woff2'),
						url('https://d5cvgp25mt3yl.cloudfront.net/uploads/welcome-email-signature-fonts/brittanysignature-webfont.woff') format('woff'),
						url('https://d5cvgp25mt3yl.cloudfront.net/uploads/welcome-email-signature-fonts/brittanysignature-webfont.svg#brittany_signatureregular') format('svg');
					font-weight: normal;
					font-style: normal;
				}
			</style>
			<body style="background: transparent;">
				<span style="text-transform: capitalize; font-family: 'brittany_signatureregular'; font-size: 42px; color: #333;">${fullName}</span>
			</body>`;

		// Prepare file/folder names
		const today = new Date();
		const filePath = SIGNATURE_FILE_PATH;
		const newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
		createFolder(filePath + newFolder);

		const imageNameFirstName = firstName.replace(/\s+/g, "-").toLowerCase();
		const newFileName = `${newFolder}${Date.now()}-${imageNameFirstName}.png`;
		const uploadedFile = filePath + newFileName;

		// Helper to generate image from HTML
		const generateImage = (html, options) => {
			return new Promise((resolve, reject) => {
				wkhtmltoimage.generate(html, options, (err) => {
					if (err) reject(err);
					else resolve();
				});
			});
		};

		// Generate the signature image
		await generateImage(htmlContent, {
			'output': uploadedFile,
			'transparent': true,
			'width': 500
		});

		// Update user document with new signature image info
		await userCollection.updateOne({ "_id": newObjectIdDefault(userId) }, { $set: { "signature_image": newFileName, "signature_image_name": fullName } });

		// If S3 upload is enabled, upload image and clean up files
		if (UPLOAD_TO_S3) {
			// Read the generated image file
			const readFileAsync = (filePath) => {
				return new Promise((resolve, reject) => {
					fs.readFile(filePath, (err, data) => {
						if (err) reject(err);
						else resolve(data);
					});
				});
			};

			let data;
			try {
				data = await readFileAsync(uploadedFile);
			} catch (err) {
				console.error('Error reading generated image:', err);
				return;
			}

			// Upload to S3
			const uploadS3Async = (params) => {
				return new Promise((resolve, reject) => {
					s3.upload(params, (err, uploadData) => {
						if (err) reject(err);
						else resolve(uploadData);
					});
				});
			};

			const targetFolder = "signature/" + newFileName;
			const params = {
				'Bucket': process.env.AWS_BUCKET_NAME,
				'Key': S3_BUCKET_UPLOAD_PATH + targetFolder,
				'Body': data
			};

			try {
				await uploadS3Async(params);
			} catch (uploadErr) {
				console.error('Error uploading image to S3:', uploadErr);
				return;
			}

			// Remove old signature image and local file in parallel if needed
			const removePromises = [];

			if (signatureImage) {
				removePromises.push(removeFile({ 'file_path': filePath + signatureImage }).catch(() => { }));
			}
			removePromises.push(removeFileOnlyLocalFolder({ 'file_path': uploadedFile }).catch(() => { }));

			await Promise.all(removePromises);
			return;
		} else {
			// If not uploading to S3, just remove old signature image if exists
			if (signatureImage) {
				try {
					await removeFile({ 'file_path': filePath + signatureImage });
				} catch (e) { }
			}
			return;
		}
	} catch (e) {
		// Catch any unexpected error
		return;
	}
}; // End signatureHtmltoImageConvert

/**
 * Temporary function to update all user signatures.
 * Uses async/await for database queries and signature image generation.
 */
updateAllUserSignature = async (req, res) => {
	try {
		const userCollection = db.collection(TABLE_USERS);

		// Find all users with account_type 3, projecting only required fields
		const resultUser = await userCollection
			.find({ account_type: 3 }, { projection: { _id: 1, fname: 1, lname: 1, public_business_informaton: 1 } })
			.toArray();

		if (resultUser && resultUser.length > 0) {
			// Process each user in series to avoid overwhelming resources
			for (const recordUser of resultUser) {
				const userId = recordUser._id || "";
				const firstName = recordUser.fname || "";
				const lastName = recordUser.lname || "";
				const publicBusinessInformaton = recordUser.public_business_informaton || {};
				const nameOfTheBusiness = publicBusinessInformaton.name_of_the_business || "";

				// Prepare user data for signature image generation
				const signatureUserData = {
					"user_id": userId,
					"first_name": firstName,
					"last_name": lastName,
					"name_of_the_business": nameOfTheBusiness
				};

				// Await signature image generation for each user
				try {
					await signatureHtmltoImageConvert(req, res, signatureUserData);
				} catch (err) {
					// Log error but continue processing other users
					console.error(`Error generating signature for user ${userId}:`, err);
				}
			}

			// All users processed successfully
			return {
				'status': STATUS_SUCCESS,
				'message': res.__("admin.users.user_profile_updated_successfully"),
			};
		} else {
			// No users found
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.global.no_record_found"),
			};
		}
	} catch (error) {
		// Handle unexpected errors
		console.error("Error in updateAllUserSignature:", error);
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.global.no_record_found"),
		};
	}
}; // End updateAllUserSignature

/**
 * Function to get total lead subscribers count using async/await.
 * @param {String|ObjectId} leadFormsId - The lead form ID.
 * @returns {Promise<Number>} - Promise resolving to the count of subscribers.
 */
getTotalLeadSubscriberCount = async (leadFormsId) => {
	try {
		// Convert leadFormsId to ObjectId if provided, otherwise generate a new one
		const leadFormObjectId = leadFormsId ? newObjectIdDefault(leadFormsId) : newObjectIdDefault();

		// Query the collection for the count of documents matching the criteria
		const count = await db
			.collection(TABLE_SIGNUP_LEAD_FORMS)
			.countDocuments({ 'lead_forms_id': leadFormObjectId, "is_deleted": NOT_DELETED });

		// Return the count (0 if none found)
		return count > 0 ? count : 0;
	} catch (error) {
		// Log error and return 0 in case of failure
		console.error("Error in getTotalLeadSubscriberCount:", error);
		return 0;
	}
}; // End getTotalLeadSubscriberCount

/***
 * send notify email daily, weekly, monthly
*/
sendNotifyEmailDailyWeeklyMonthly = async (req, res, notifyEmailType) => {
	try {
		const leadsForms = db.collection(TABLE_LEAD_FORMS);
		const users = db.collection(TABLE_USERS);

		/** Find lead result data notify email */
		const leadResult = await leadsForms.find({
			"notify_email": {
				"$exists": true,
				"$ne": []
			},
			"notify_email_send_type": { $in: [notifyEmailType] },
			"is_deleted": NOT_DELETED,
		}).toArray();

		if (leadResult.length === 0) {
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.global.no_record_found"),
			};
		}

		/** Fetch user data for all lead forms creator name */
		const userIds = leadResult.map(record => record.user_id);
		const usersData = await users.find({ '_id': { $in: userIds } }).project({ '_id': 1, 'full_name': 1 }).toArray();

		/** Create a map of user data for quick access */
		const userDataMap = {};
		usersData.forEach(user => {
			userDataMap[user._id.toString()] = user;
		});

		/** Process lead forms concurrently */
		await Promise.all(leadResult.map(async record => {
			const userId = record.user_id;
			const leadTitleName = record.title || "";
			const leadFormsId = record._id || "";
			const allNotifyEmail = record.notify_email || "";

			/** Total count of lead subscribe count */
			const countUser = await getTotalLeadSubscriberCount(leadFormsId);
			const user = userDataMap[userId.toString()];

			if (user) {
				const creatorFullName = user.full_name || "";

				const notifyOptions = {
					'lead_forms_id': leadFormsId,
					'stage_level': countUser,
					'creator_full_name': creatorFullName,
					'lead_title_name': leadTitleName,
					'notify_email': allNotifyEmail,
				};
				await sendEmailNotify(req, res, notifyOptions);
			}
		}));

		return {
			'status': STATUS_SUCCESS,
			'message': res.__("admin.manage_leads.notify_email_send_successfully"),
		};
	} catch (error) {
		console.error("Error in sendNotifyEmailDailyWeeklyMonthly:", error);
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.global.error_occurred"),
		};
	}
} //End sendNotifyEmailDailyWeeklyMonthly();


/**
 * Function for used to QR code generate for public URL
 * Updated: Uses async/await for all database and file operations
 */
qrcodeGenerateUrl = async (req, res, userId) => {
	return new Promise(async (resolve) => {
		try {
			if (!userId) return resolve();

			// This function for used to UGC gallery
			await ugcQrcodeGenerateUrl(req, res, userId);

			const userCollection = db.collection(TABLE_USERS);

			// Fetch user data using async/await
			/** Fetch user slug and QR code info */
			const result = await userCollection.findOne(
				{ "_id": newObjectIdDefault(userId) },
				{ projection: { 'slug': 1, 'qr_code_image_name': 1, 'qr_code_image': 1 } }
			);

			if (!result) return resolve();

			let userSlug = result.slug ? result.slug : "";
			let qrCodeImageName = result.qr_code_image_name ? result.qr_code_image_name : "";
			let qrCodeImage = result.qr_code_image ? result.qr_code_image : "";

			// URL for which QR code needs to be generated
			const url = FRONT_URL + userSlug + QUERY_PARAMETER_INSIDERS;

			userSlug = userSlug.toLowerCase();
			qrCodeImageName = qrCodeImageName.toLowerCase();

			// If QR code already exists for this slug, skip generation
			if (userSlug !== '' && userSlug === qrCodeImageName) {
				return resolve();
			}

			/** Create new folder of this month **/
			const today = new Date();
			const filePath = QR_CODES_FILE_PATH;
			let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
			await createFolder(filePath + newFolder);

			let imageNameFirstName = userSlug;
			/** Replace spaces with dashes */
			let newFileNameQrCode = imageNameFirstName.replace(/\s+/g, "-").toLowerCase();
			let newFileName = newFolder + Date.now() + '-' + newFileNameQrCode + ".png";

			/** Construct the full path and filename */
			let uploadedFile = filePath + newFileName;

			/** Generate QR code */
			const options = {
				width: 800,  // Define the width (and height, as it's a square)
			};
			const qrCodePath = path.join(uploadedFile);
			await QRCode.toFile(qrCodePath, url, options);

			/** Save QR code image info in user document */
			await userCollection.updateOne(
				{ "_id": newObjectIdDefault(userId) },
				{ $set: { "qr_code_image_name": userSlug, "qr_code_image": newFileName } }
			);

			if (UPLOAD_TO_S3) {
				// Read the generated image file asynchronously
				try {
					const data = await fs.promises.readFile(uploadedFile);

					// Upload the image to S3 bucket
					let targetFolder = "qr_codes/" + newFileName;
					const params = {
						'Bucket': process.env.AWS_BUCKET_NAME,
						'Key': S3_BUCKET_UPLOAD_PATH + targetFolder,
						'Body': data // Buffer containing image data
					};

					await new Promise((resolveS3, rejectS3) => {
						s3.upload(params, async (uploadErr, uploadData) => {
							if (uploadErr) {
								console.error('Error uploading image to S3:', uploadErr);
								return resolveS3();
							} else {
								// Old file delete after edit
								if (qrCodeImage !== '') {
									let imagesData = {
										'file_path': filePath + qrCodeImage
									}
									await removeFile(imagesData);
								}

								// Remove local file after bucket upload
								let imagesData = {
									'file_path': uploadedFile
								}
								await removeFileOnlyLocalFolder(imagesData);
								return resolveS3();
							}
						});
					});

					return resolve();
				} catch (err) {
					console.error('Error reading or uploading generated image:', err);
					return resolve();
				}
			} else {
				// Old file delete after edit (local only)
				if (qrCodeImage !== '') {
					let imagesData = {
						'file_path': filePath + qrCodeImage
					}
					await removeFile(imagesData);
				}
				return resolve();
			}
		} catch (error) {
			console.error("Error in qrcodeGenerateUrl:", error);
			return resolve();
		}
	});
} //End qrcodeGenerateUrl();

/**
 * Function to submit and capture lead form, generate and save user details according to campaign.
 * Uses async/await for all database and async operations.
 * Handles PDF extraction and slug generation in sequence.
 */
saveUserDetailsAccordingCampaign = async (req, res, optionDetails) => {
	try {
		const campaignAccordingUserDetails = db.collection(TABLE_CAMPAIGN_ACCORDING_USER_DETAILS);
		let pdfFileName = optionDetails.pdf_file ? optionDetails.pdf_file : "";

		let finalDataUserText = "";
		let extractedText = "";

		// If a PDF file is provided, extract text and process it
		if (pdfFileName !== "") {
			// Extract text from PDF
			const pdfFileUploadSave = await extractTextFromPdfWithoutFileUpload({ "file_name": pdfFileName });
			extractedText = (pdfFileUploadSave.status === STATUS_SUCCESS) ? pdfFileUploadSave.extracted_text : "";

			const optionsData = {
				"extracted_text": extractedText,
				"information_get_from_pdf": optionDetails.information_get_from_pdf ? optionDetails.information_get_from_pdf : "",
			};

			// Get specific data from extracted PDF text according to user needs
			const pdfExtractedData = await getSpecificDataWhichUSerWant(optionsData);
			finalDataUserText = pdfExtractedData ? pdfExtractedData.response : "";
			extractedText = pdfExtractedData ? pdfExtractedData.extracted_text : "";
		}

		// Prepare options for slug generation
		const slugOptions = {
			"title": optionDetails.ai_campaign_name,
			"table_name": TABLE_CAMPAIGN_ACCORDING_USER_DETAILS,
			"slug_field": "slug",
			"req": req,
			"res": res
		};

		// Generate slug for the campaign
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Prepare the document to insert
		const insertDoc = {
			'user_id': optionDetails.user_id ? newObjectIdDefault(optionDetails.user_id) : "",
			'ai_campaign_name': optionDetails.ai_campaign_name ? optionDetails.ai_campaign_name : "",
			'campaign_name_id': optionDetails.campaign_name_id ? newObjectIdDefault(optionDetails.campaign_name_id) : "",
			'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
			'main_goal_of_your_email_campaign_name': optionDetails.main_goal_of_your_email_campaign_name ? optionDetails.main_goal_of_your_email_campaign_name : "",
			'preferred_offering_or_discount': optionDetails.preferred_offering_or_discount ? optionDetails.preferred_offering_or_discount : "",
			'tone_or_style_email_name': optionDetails.tone_or_style_email_name ? optionDetails.tone_or_style_email_name : "",
			'specific_product_or_service': optionDetails.specific_product_or_service ? optionDetails.specific_product_or_service : "",
			'benefits_product_or_service': optionDetails.benefits_product_or_service ? optionDetails.benefits_product_or_service : "",
			'call_to_action': optionDetails.call_to_action ? optionDetails.call_to_action : "",
			'additional_information': optionDetails.additional_information ? optionDetails.additional_information : "",
			'information_get_from_pdf': optionDetails.information_get_from_pdf ? optionDetails.information_get_from_pdf : "",
			'attach_reward_in_email': optionDetails.attach_reward_in_email ? optionDetails.attach_reward_in_email : "",
			'get_poll_opinions': optionDetails.get_poll_opinions ? optionDetails.get_poll_opinions : "",
			'type': optionDetails.type ? optionDetails.type : "",
			'uploaded_ai_pdf_to_text': extractedText,
			'final_extracted_text': finalDataUserText,
			'created': getUtcDate()
		};

		// Insert the campaign user details into the database
		const result = await campaignAccordingUserDetails.insertOne(insertDoc);

		// Return the result with inserted ID and final extracted text
		return {
			"inserted_id": result && result.insertedId ? result.insertedId : "",
			"final_text": finalDataUserText,
		};
	} catch (error) {
		console.error("Error in saveUserDetailsAccordingCampaign:", error);
		return {
			"inserted_id": "",
			"final_text": "",
			"error": error.message || "Unknown error"
		};
	}
}; // End saveUserDetailsAccordingCampaign

/** Function for gate date after 24 hours */
getDateAfter24Hours = (createdDate) => {
	/**Create a new Date object from the given date string*/
	let date = new Date(createdDate);
	/**Add 24 hours to the date*/
	date.setHours(date.getHours() + 24);
	/**Return the new date*/
	return date;
} //End getDateAfter24Hours();

/**
 * Function to get all user list using async/await.
 * Returns a promise that resolves with the user list or an error message.
 */
getAllUserList = async (req, res) => {
	try {
		const users = db.collection(TABLE_USERS);

		// Build the query and projection
		const query = {
			'is_deleted': NOT_DELETED,
			'account_type': {
				'$in': [NORMAL_USER_ACCOUNT_TYPE, BUSSINESS_USER_ACCOUNT_TYPE, PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE]
			}
		};

		const projection = {
			'_id': 1,
			'full_name': 1,
			'email': 1,
			'slug': 1,
			'is_email_verified': 1,
			'account_type': 1,
			'is_active': 1,
			'is_deleted': 1,
			'created': 1,
		};

		// Fetch all users matching the query
		const result = await users.find(query, { projection }).toArray();

		// If users found, return success response
		if (result && result.length > 0) {
			return {
				'status': STATUS_SUCCESS,
				'result': result,
				'message': ""
			};
		} else {
			// No users found, return error response
			return {
				'status': STATUS_ERROR,
				'result': [],
				'message': res.__("front.global.no_record_found"),
			};
		}
	} catch (error) {
		// Handle any errors during the query
		console.error("Error in getAllUserList:", error);
		return {
			'status': STATUS_ERROR,
			'result': [],
			'message': error.message || "Unknown error"
		};
	}
}; // End getAllUserList

/**
 * Function to save all campaign logs details using async/await.
 * Inserts a new campaign log document into the TABLE_AI_CAMPAIGN_LOGS collection.
 * @param {Object} options - Campaign log details.
 * @returns {Promise<void>}
 */
saveAllCampaignLogs = async (options) => {
	try {
		const campaignLogs = db.collection(TABLE_AI_CAMPAIGN_LOGS);

		// Prepare all fields for the campaign log document
		const userFinalPrompt = options.user_final_prompt || "";
		const systemFinalPrompt = options.system_final_prompt || "";
		const userPrompt = options.user_prompt || "";
		const systemPrompt = options.system_prompt || "";
		const finalOutput = options.final_output || "";
		const type = options.type || "";
		const campaignType = options.campaign_type || "";
		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const campaignParentId = options.ai_campaign_parent_id ? newObjectIdDefault(options.ai_campaign_parent_id) : "";
		const campaignName = options.ai_campaign_name || "";
		const signupFlag = options.signup_flag || "";
		const editFlag = options.is_edit || "";
		const optionName = options.option_name || "";
		const optionId = options.option_id ? newObjectIdDefault(options.option_id) : "";
		const socialReachoutDay = options.reachout_day || "";

		const insertedData = {
			'user_id': userId,
			'ai_campaign_parent_id': campaignParentId,
			'ai_campaign_name': campaignName,
			'campaign_type': campaignType,
			'type': type,
			'user_prompt': userPrompt,
			'system_prompt': systemPrompt,
			'user_final_prompt': userFinalPrompt,
			'system_final_prompt': systemFinalPrompt,
			'output': finalOutput,
			'option_name': optionName,
			'option_id': optionId,
			'reachout_day': socialReachoutDay,
			'signup_flag': signupFlag !== "" ? true : false,
			'is_edit': editFlag !== "" ? true : false,
			'is_deleted': NOT_DELETED,
			'created': getUtcDate()
		};

		// Insert the campaign log document asynchronously
		await campaignLogs.insertOne(insertedData);

		// No return value needed, function resolves when done
	} catch (error) {
		// Log error for debugging
		console.error("Error in saveAllCampaignLogs:", error);
		// Function resolves even if there is an error, as per original logic
	}
}; // End saveAllCampaignLogs

/**
 * Function to count user campaigns.
 * Uses async/await for database query.
 */
getUserCampaignCount = async (userId) => {
	try {
		const tableAiCampaignName = db.collection(TABLE_AI_CAMPAIGN_NAME);

		// Return 0 if userId is not provided
		if (!userId) {
			return 0;
		}

		// Count records based on user id and campaign type
		const count = await tableAiCampaignName.countDocuments({
			"user_id": newObjectIdDefault(userId),
			"type": DEFAULT_CAMPAIGN
		});

		// Return the count (0 if not found)
		return count || 0;
	} catch (error) {
		// Log error for debugging
		console.error("Error in getUserCampaignCount:", error);
		return 0;
	}
}; // End getUserCampaignCount


/**
 * Function to update user public business information.
 * Uses async/await for all database queries and updates.
 */
updateUserPublicInformation = async (req, res, options) => {
	try {
		const tableLibraryLogs = db.collection(TABLE_CONTENT_LIBRARY_LOGS);
		const ugcGallery = db.collection(TABLE_UGC_GALLERY);

		const userId = options.user_id ? newObjectIdDefault(options.user_id) : "";
		const uniqueBrowserId = options.unique_ai_browser_id ? options.unique_ai_browser_id : "";

		// Validate required parameters
		if (!uniqueBrowserId || !userId) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.system.something_going_wrong_please_try_again"),
			};
		}

		// Find content library logs details using async/await
		const result = await tableLibraryLogs.findOne({ unique_ai_browser_id: uniqueBrowserId });

		if (!result) {
			return {
				status: STATUS_ERROR,
				message: res.__("front.global.no_record_found"),
			};
		}

		// Extract and format business and contact information
		const websiteAllData = result.website_data || {};
		const businessInfo = websiteAllData.businessInfo || {};
		const contactInfo = websiteAllData.contactInfo || {};

		const phoneNumberStr = (contactInfo.phoneNumbers && contactInfo.phoneNumbers.length > 0) ? contactInfo.phoneNumbers[0] : "";
		const businessName = businessInfo.name || "";
		const businessLocation = businessInfo.location || "";
		const description = businessInfo.description || "";
		const address = (contactInfo.addresses && contactInfo.addresses.length > 0) ? contactInfo.addresses[0] : businessLocation;
		const preferredOffering = websiteAllData.offerDiscounts || "";
		const ctaText = websiteAllData.ctaText || "";
		const targetAudience = websiteAllData.targetAudience || "";
		const uniqueSelling = websiteAllData.uniqueSellingProposition || "";
		const specificProduct = (websiteAllData.keyProducts && websiteAllData.keyProducts.length > 0) ? websiteAllData.keyProducts.join(", ") : "";
		const keyFeatures = (websiteAllData.services && websiteAllData.services.length > 0) ? websiteAllData.services.join(", ") : "";
		const additionalInformation = websiteAllData.additional_information || "";
		const zipCode = websiteAllData.zipCode || "";
		const firstKeyword = (websiteAllData.seoKeywords && websiteAllData.seoKeywords.length > 0) ? websiteAllData.seoKeywords[0] : "";
		const secondKeyword = (websiteAllData.seoKeywords && websiteAllData.seoKeywords.length > 1) ? websiteAllData.seoKeywords[1] : "";
		const email = websiteAllData.email || "";
		const websiteUrl = websiteAllData.website_url || "";
		const aiBusinessIndustryids = (websiteAllData.ai_business_industry_ids && websiteAllData.ai_business_industry_ids.length > 0) ? websiteAllData.ai_business_industry_ids : [BUSINESS_INDUSTRY_GENERAL_ID];
		const aiBusinessIndustry = (websiteAllData.businessCategories && websiteAllData.businessCategories.length) ? websiteAllData.businessCategories.toString() : [];
		const primaryGoal = websiteAllData.primaryGoal || "";
		const websiteTone = websiteAllData.toneOfSite || "";
		const phoneNumberData = (phoneNumberStr.length > 4) ? extractNumbers(phoneNumberStr) : "";
		const formattedPhoneNumberValue = phoneNumberData ? phoneNumberData.replace(/(\d{3})(\d{1,3})(\d{1,4})/, '$1-$2-$3') : "";
		const websiteCrawlable = websiteAllData.website_crawlable || false;
		const websiteImageCrawlable = websiteAllData.website_image_crawlable || false;
		const longLivedAccessToken = websiteAllData.long_lived_access_token || "";
		const instagramUserDetails = websiteAllData.instagram_user_details || "";
		const scrapeWithInstagram = websiteAllData.scrape_with_instagram || "";
		const instagramUrl = websiteAllData.instagram_url || "";

		// Populate request body with extracted data
		req.body.zip = zipCode;
		req.body.website_url = websiteUrl;
		req.body.mobile = formattedPhoneNumberValue;
		req.body.name_of_the_business = businessName;
		req.body.preferred_offering_or_discount = preferredOffering;
		req.body.target_audience = targetAudience;
		req.body.unique_selling_proposition = uniqueSelling;
		req.body.specific_product_or_service = specificProduct;
		req.body.benefits_product_or_service = keyFeatures;
		req.body.call_to_action = ctaText;
		req.body.additional_information = additionalInformation;
		req.body.ai_business_industry_ids = aiBusinessIndustryids;
		req.body.populate_key_phrase_first = firstKeyword;
		req.body.populate_key_phrase_second = secondKeyword;
		req.body.core_information_tab_filled = true;
		req.body.campaign_overview_tab_filled = true;
		req.body.campaign_detail_tab_filled = true;
		req.body.ai_business_industry_names = aiBusinessIndustry;
		req.body.main_goal_of_your_email_campaign_name = primaryGoal;
		req.body.tone_or_style_email_name = websiteTone;
		req.body.from_homepage_ai_user = true;
		req.body.primary_address = address;
		req.body.description = description;
		req.body.website_crawlable = websiteCrawlable;
		req.body.website_image_crawlable = websiteImageCrawlable;
		req.body.long_lived_access_token = longLivedAccessToken;
		req.body.instagram_user_details = instagramUserDetails;
		req.body.scrape_with_instagram = scrapeWithInstagram;
		req.body.instagram_url = instagramUrl;

		// Save public business user details
		await savePublicBussinessUserDetails(req, res, userId);

		// Run updates in parallel: update web crawl data and UGC gallery user id
		await Promise.all([
			// Update user id in web links and web info collections where user id is blank
			updateUserInWebCrawlData({ user_id: userId, unique_browser_id: uniqueBrowserId }),
			// Update user id in UGC gallery collection where user id is blank
			ugcGallery.updateMany(
				{ user_id: "", unique_browser_id: uniqueBrowserId },
				{ $set: { user_id: userId, website_url: websiteUrl } }
			)
		]);

		// Return success response
		return {
			status: STATUS_SUCCESS,
			message: res.__("front.user.profile_has_been_updated_successfully"),
		};
	} catch (error) {
		// Log error for debugging
		console.error("Error in updateUserPublicInformation:", error);
		return {
			status: STATUS_ERROR,
			message: res.__("front.system.something_going_wrong_please_try_again"),
		};
	}
}; // End updateUserPublicInformation

/** Function for used to Timezone abbreviation for an exchange */
getTimezoneAbbreviation = (timezone) => {
	/** All time zone abbreviation */
	const timezoneMap = {
		"Asia/Kolkata": "IST",        // Indian Standard Time
		"America/Los_Angeles": "PST", // Pacific Standard Time
		"America/New_York": "EST",    // Eastern Standard Time
		"America/Chicago": "CST",     // Central Standard Time
		"America/Denver": "MST",      // Mountain Standard Time
		"Europe/London": "GMT",       // Greenwich Mean Time
		"Europe/Berlin": "CET",       // Central European Time
		"Europe/Paris": "CET",        // Central European Time
		"Europe/Moscow": "MSK",       // Moscow Standard Time
		"Asia/Tokyo": "JST",          // Japan Standard Time
		"Asia/Shanghai": "CST",       // China Standard Time
		"Asia/Singapore": "SGT",      // Singapore Time
		"Australia/Sydney": "AEST",   // Australian Eastern Standard Time
		"Australia/Perth": "AWST",    // Australian Western Standard Time
		"Africa/Johannesburg": "SAST",// South Africa Standard Time
		"Africa/Cairo": "EET",        // Eastern European Time
		"America/Sao_Paulo": "BRT",   // Brasilia Time
		"Asia/Dubai": "GST",          // Gulf Standard Time
		"Asia/Hong_Kong": "HKT",      // Hong Kong Time
		"Asia/Bangkok": "ICT",        // Indochina Time
		"America/Toronto": "EST",     // Eastern Standard Time
		"Europe/Madrid": "CET",       // Central European Time
		"Europe/Rome": "CET",         // Central European Time
		"Europe/Amsterdam": "CET",    // Central European Time
		"Europe/Istanbul": "TRT",     // Turkey Time
		"Asia/Seoul": "KST",          // Korea Standard Time
		"Asia/Jakarta": "WIB",        // Western Indonesia Time
		"Asia/Karachi": "PKT",        // Pakistan Standard Time
		"Asia/Colombo": "IST",        // Indian Standard Time
		"America/Mexico_City": "CST", // Central Standard Time
		"America/Vancouver": "PST",   // Pacific Standard Time
		"America/Argentina/Buenos_Aires": "ART", // Argentina Time
		"Asia/Kathmandu": "NPT",      // Nepal Time
		"Pacific/Auckland": "NZST",   // New Zealand Standard Time
		"Pacific/Fiji": "FJT",        // Fiji Time
		"Asia/Manila": "PHT",         // Philippine Time
		"Asia/Kuala_Lumpur": "MYT",   // Malaysia Time
		"Asia/Riyadh": "AST",         // Arabia Standard Time
		"Pacific/Honolulu": "HST",    // Hawaii Standard Time
		"America/Phoenix": "MST",     // Mountain Standard Time (no DST)
		"Europe/Athens": "EET",       // Eastern European Time
		"Asia/Yangon": "MMT",         // Myanmar Time
		"Asia/Baku": "AZT",           // Azerbaijan Time
		"Asia/Tashkent": "UZT",       // Uzbekistan Time
		"Africa/Nairobi": "EAT",      // East Africa Time
		"America/Bogota": "COT",      // Colombia Time
		"America/Caracas": "VET",     // Venezuela Time
		"America/Lima": "PET",        // Peru Time
		"America/Havana": "CST",      // Cuba Standard Time
		"Europe/Dublin": "GMT",       // Greenwich Mean Time
		"Europe/Zurich": "CET",       // Central European Time
		"Europe/Oslo": "CET",         // Central European Time
		"Asia/Taipei": "CST",         // China Standard Time
		"Asia/Amman": "EET",          // Eastern European Time
		"Asia/Almaty": "ALMT",        // Alma-Ata Time
		"Asia/Tehran": "IRST",        // Iran Standard Time
		"Europe/Vienna": "CET",       // Central European Time
		"Europe/Brussels": "CET",     // Central European Time
		"Europe/Prague": "CET",       // Central European Time
		"Europe/Budapest": "CET",     // Central European Time
		"Europe/Stockholm": "CET",    // Central European Time
		"Europe/Warsaw": "CET",       // Central European Time
		"Europe/Helsinki": "EET",     // Eastern European Time
		"Europe/Belgrade": "CET",     // Central European Time
		"Europe/Bratislava": "CET",   // Central European Time
		"Europe/Zagreb": "CET",       // Central European Time
		"Europe/Lisbon": "WET",       // Western European Time
		"Europe/Amsterdam": "CET",    // Central European Time
		"Europe/Copenhagen": "CET",   // Central European Time
		"Europe/Luxembourg": "CET",   // Central European Time
		"Europe/Monaco": "CET",       // Central European Time
		"Europe/San_Marino": "CET",   // Central European Time
		"Asia/Tbilisi": "GET",        // Georgia Standard Time
		"Asia/Yerevan": "AMT",        // Armenia Time
		"Asia/Vladivostok": "VLAT",   // Vladivostok Time
		"Asia/Ulaanbaatar": "ULAT",   // Ulaanbaatar Time
		"Pacific/Tahiti": "TAHT",     // Tahiti Time
		"Pacific/Guam": "ChST",       // Chamorro Standard Time
		"Pacific/Port_Moresby": "PGT",// Papua New Guinea Time
		"Pacific/Efate": "VUT",       // Vanuatu Time
		"Pacific/Noumea": "NCT",      // New Caledonia Time
		"Africa/Casablanca": "WET",   // Western European Time
		"Africa/Lagos": "WAT",        // West Africa Time
		"Africa/Accra": "GMT",        // Greenwich Mean Time
		"Africa/Addis_Ababa": "EAT",  // East Africa Time
		"Africa/Harare": "CAT",       // Central Africa Time
		"Africa/Luanda": "WAT",       // West Africa Time
		"Africa/Windhoek": "CAT",     // Central Africa Time
		"Antarctica/Casey": "CAST",   // Casey Time
		"Antarctica/Davis": "DAVT",   // Davis Time
		"Antarctica/Mawson": "MAWT",  // Mawson Time
		"Antarctica/Rothera": "ROTT", // Rothera Time
		"Antarctica/Syowa": "SYOT",   // Syowa Time
		"Antarctica/Troll": "UTC",    // Coordinated Universal Time
		"Antarctica/Vostok": "VOST",  // Vostok Time
		"Indian/Chagos": "IOT",       // Indian Ocean Territory Time
		"Indian/Christmas": "CXT",    // Christmas Island Time
		"Indian/Cocos": "CCT",        // Cocos Islands Time
		"Indian/Maldives": "MVT",     // Maldives Time
		"Indian/Mauritius": "MUT",    // Mauritius Time
		"Indian/Reunion": "RET",      // Reunion Time
		"Pacific/Pago_Pago": "SST",   // Samoa Standard Time
		"Pacific/Midway": "SST",      // Samoa Standard Time
		"Pacific/Apia": "WSST",       // West Samoa Standard Time
		"Pacific/Fakaofo": "TKT",     // Tokelau Time
		"Pacific/Wallis": "WFT",      // Wallis and Futuna Time
		"Pacific/Kiritimati": "LINT", // Line Islands Time
		"Pacific/Chatham": "CHAST",   // Chatham Standard Time
		"Pacific/Tongatapu": "TOT",   // Tonga Time
	};

	/** Get the abbreviation, return "IST" if not found */
	return timezoneMap[timezone] || DEFAULT_TIME_ZONE_ABBREVIATION;
} //End getTimezoneAbbreviation();

/**
  * Example method to get color based on the schedule post type
  * @param type {string}
  * @return {string}
  */
getColorBasedOnType = (type) => {
	switch (type) {
		case 'social_media':
			return '#D0F3E9'; // Green for social media
		case 'seo_blog':
			return '#E4D4FC'; // Purple for SEO blog
		case 'email':
			return '#FFEFDE'; // Yellow for email
		default:
			return '#ffefde'; // Default color (black)
	}
} //End getColorBasedOnType();

/**
 * Function to send the "Get Started" home page email.
 * Uses async/await for all database and file operations with clear comments.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} options - Contains email, first_name, user_slug
 */
getStartedHomePageSendEmail = async (req, res, options) => {
	try {
		const userEmail = options.email || "";
		const firstName = options.first_name || "";
		const userSlug = options.user_slug || "";

		// Validate required fields before proceeding
		if (!userEmail || !firstName) {
			return;
		}

		const collection = db.collection(TABLE_GET_STARTED_HOME_PAGE_EMAIL_TEMPLATES);

		// Fetch the active, not deleted email template using async/await
		const template = await collection.findOne({
			is_active: ACTIVE,
			is_deleted: NOT_DELETED
		});

		if (!template) {
			// No template found, exit gracefully
			return;
		}

		// Prepare the email body by replacing placeholders
		let templateBody = template.body || "";
		templateBody = templateBody.replace(/{FIRST_NAME}/g, firstName);
		templateBody = templateBody.replace(/{SECTION_ONE_REDIRECT_URL}/g, FRONT_URL + userSlug + '?from_mail=1#collaboration_portal');
		templateBody = templateBody.replace(/{SECTION_TWO_REDIRECT_URL}/g, FRONT_URL + 'pocial/media-gallery-social-post');
		templateBody = templateBody.replace(/{SECTION_THIRD_REDIRECT_URL}/g, FRONT_URL + 'pocial/insiders-portal');

		// Prepare email options
		const emailOptions = {
			to: userEmail,
			action: "get_started_home_page_email",
			rep_array: [templateBody]
		};

		// Send the email using async/await
		await sendMail(req, res, emailOptions);

	} catch (error) {
		// Log error and exit gracefully
		console.error("Error in getStartedHomePageSendEmail:", error);
	}
}; // End getStartedHomePageSendEmail


/**
 * Check if image dimensions are within the desired range
 * @param {string} imageUrl - The image URL
 * @returns {Promise<boolean>} - Whether the image meets the size criteria
 */
isImageWithinDimensions = async (imageUrl) => {
	try {
		const { data: imageBuffer } = await axios.get(imageUrl, { responseType: 'arraybuffer' });
		const metadata = await sharp(imageBuffer).metadata();

		/**Check if dimensions are within 300x300 pixels*/
		if (metadata.width >= UGC_GALLERY_IMAGE_MINIMUM_SIZE && metadata.height >= UGC_GALLERY_IMAGE_MINIMUM_SIZE) {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		console.error(`Error processing image ${imageUrl}:`, error.message);
		return false; // Skip images that cannot be processed
	}
} //End isImageWithinDimensions();

/**
 * Function to generate UGC QR code for public URL.
 * Uses async/await for all database and file operations.
 * Handles S3 upload and file cleanup with proper async/await and comments.
 */
ugcQrcodeGenerateUrl = async (req, res, userId) => {
	try {
		if (!userId) return;

		const userCollection = db.collection(TABLE_USERS);

		// Fetch user data (slug and QR code info) using async/await
		const result = await userCollection.findOne(
			{ "_id": newObjectIdDefault(userId) },
			{ projection: { 'slug': 1, 'ugc_qr_code_image_name': 1, 'ugc_qr_code_image': 1 } }
		);

		if (!result) return;

		let userSlug = result.slug ? result.slug : "";
		let ugcQrCodeImageName = result.ugc_qr_code_image_name ? result.ugc_qr_code_image_name : "";
		let ugcQrCodeImage = result.ugc_qr_code_image ? result.ugc_qr_code_image : "";

		// URL for which QR code needs to be generated
		const url = FRONT_URL + userSlug + QUERY_PARAMETER_UGC_GALLERY;

		userSlug = userSlug.toLowerCase();
		ugcQrCodeImageName = ugcQrCodeImageName.toLowerCase();

		// If QR code already exists for this slug, skip generation
		if (userSlug !== '' && userSlug === ugcQrCodeImageName) {
			return;
		}

		// Create new folder for this month
		const today = new Date();
		const filePath = UGC_QR_CODES_FILE_PATH;
		let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
		await createFolder(filePath + newFolder);

		let imageNameFirstName = userSlug;
		// Replace spaces with dashes for filename
		let newFileNameQrCode = imageNameFirstName.replace(/\s+/g, "-").toLowerCase();
		let newFileName = newFolder + Date.now() + '-' + newFileNameQrCode + ".png";

		// Construct the full path and filename
		let uploadedFile = filePath + newFileName;

		// Generate QR code and save to file
		const options = { width: 800 };
		const qrCodePath = path.join(uploadedFile);
		await QRCode.toFile(qrCodePath, url, options);

		// Update user document with new QR code info
		await userCollection.updateOne({ "_id": newObjectIdDefault(userId) }, { $set: { "ugc_qr_code_image_name": userSlug, "ugc_qr_code_image": newFileName } });

		if (UPLOAD_TO_S3) {
			try {
				// Read the generated image file asynchronously
				const data = await fs.promises.readFile(uploadedFile);

				// Prepare S3 upload parameters
				let targetFolder = "ugc_qr_codes/" + newFileName;
				const params = {
					'Bucket': process.env.AWS_BUCKET_NAME,
					'Key': S3_BUCKET_UPLOAD_PATH + targetFolder,
					'Body': data // Buffer containing image data
				};

				// Upload the image to S3 bucket using Promise for async/await
				await new Promise((resolveS3, rejectS3) => {
					s3.upload(params, async (uploadErr, uploadData) => {
						if (uploadErr) {
							console.error('Error uploading image to S3:', uploadErr);
							return resolveS3();
						} else {
							// Delete old QR code image file if exists (in parallel with local file removal)
							const deleteOldFilePromise = (ugcQrCodeImage !== '')
								? removeFile({ 'file_path': filePath + ugcQrCodeImage })
								: Promise.resolve();

							// Remove the local file after S3 upload
							const removeLocalFilePromise = removeFileOnlyLocalFolder({ 'file_path': uploadedFile });

							// Wait for both file operations to complete in parallel
							await Promise.all([deleteOldFilePromise, removeLocalFilePromise]);
							return resolveS3();
						}
					});
				});
				return;
			} catch (err) {
				console.error('Error reading or uploading generated image:', err);
				return;
			}
		} else {
			// If not uploading to S3, just delete old QR code image file if exists
			if (ugcQrCodeImage !== '') {
				await removeFile({ 'file_path': filePath + ugcQrCodeImage });
			}
			return;
		}
	} catch (error) {
		console.error("Error in ugcQrcodeGenerateUrl:", error);
		return;
	}
}; // End ugcQrcodeGenerateUrl

/*** 
 * Generate URL for user assign for multiple
 */
generateLoginUrl = (uuid, email, slug) => {
	let concateData = uuid.concat('#@!', email);
	let loginUrl = concateData.concat('#@!', slug);
	let decodeLoginUrl = btoa(loginUrl);
	return decodeLoginUrl;
} //End generateLoginUrl();

/**
 * Function to update public business user QR codes (for old records).
 * Uses async/await and processes users in series to avoid overwhelming resources.
 */
updatePublicBusinessUserUgcGalleryQRCodeOnlyTest = async (req, res) => {
	try {
		const users = db.collection(TABLE_USERS);

		// Find all public business users who are not deleted
		const userList = await users.find(
			{ "account_type": PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE, 'is_deleted': NOT_DELETED },
			{ projection: { _id: 1 } }
		).toArray();

		if (userList && userList.length > 0) {
			// Process each user in series using for...of and await
			for (const userRecord of userList) {
				const userId = userRecord._id ? userRecord._id : "";
				try {
					// Generate UGC QR code for each user
					await ugcQrcodeGenerateUrl(req, res, userId);
				} catch (err) {
					console.error(`Error generating QR code for user ${userId}:`, err);
					// Continue processing other users even if one fails
				}
			}
		} else {
			// No users found or error in query
			return;
		}
	} catch (error) {
		console.error("Error in updatePublicBusinessUserUgcGalleryQRCodeOnlyTest:", error);
		return;
	}
}; // End updatePublicBusinessUserUgcGalleryQRCodeOnlyTest

/**
 * Function to check if a user exists in multiple user assignments or has duplicate email accounts.
 * Uses async/await for all database queries and runs independent queries in parallel.
 * @param {ObjectId} userId - The user ID to check.
 * @returns {Promise<boolean>} - Resolves to true if user is assigned multiple times or has duplicate email, else false.
 */
multipleUserExistsCheck = async (userId) => {
	try {
		const multipleUserAssign = db.collection(TABLE_MULTIPLE_USERS_ASSIGN);
		const users = db.collection(TABLE_USERS);

		// Run user details and assignment count queries in parallel
		const [userDetails, countMultipleUser] = await Promise.all([
			// Fetch user details (email)
			users.findOne({ _id: userId }, { projection: { email: 1 } }),
			// Count how many times this user is assigned in multiple users
			multipleUserAssign.countDocuments({ assigned_user_id: userId })
		]);

		let sameEmailUser = 0;

		// If user details exist, check for duplicate email accounts (case-insensitive)
		if (userDetails && userDetails.email) {
			sameEmailUser = await users.countDocuments({
				email: { $regex: `^${userDetails.email}$`, $options: 'i' }
			});
		}

		// If user is assigned multiple times or has duplicate email accounts, flag as true
		const multileUserExistFlag = (countMultipleUser > 0 || sameEmailUser > 1);

		return multileUserExistFlag;
	} catch (error) {
		console.error("Error in multipleUserExistsCheck:", error);
		return false;
	}
}; // End multipleUserExistsCheck

/**
 * Function to handle audience entries data.
 * Uses async/await for all database operations and runs independent queries in parallel.
 */
submitForAudienceEntries = async (req, res, logsOptions) => {
	try {
		const userId = logsOptions.user_id ? newObjectIdDefault(logsOptions.user_id) : "";
		const leadFormId = logsOptions.lead_forms_id ? newObjectIdDefault(logsOptions.lead_forms_id) : "";
		const leadImportId = logsOptions.lead_import_id ? newObjectIdDefault(logsOptions.lead_import_id) : "";
		const excelFileName = logsOptions.excel_file_name ? logsOptions.excel_file_name : "";
		const title = logsOptions.title ? logsOptions.title : "";

		const audienceTable = db.collection(TABLE_AUDIENCES);
		const leadsFormsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const leadsForm = db.collection(TABLE_LEAD_FORMS);
		const users = db.collection(TABLE_USERS);

		if (!leadFormId || !title) {
			return;
		}

		// Prepare query conditions
		let conditionLead = { 'lead_forms_id': leadFormId };
		if (leadImportId) {
			conditionLead['leads_import_id'] = leadImportId;
		}

		// Run queries in parallel
		const [
			subscriberResult,
			creatorLeadUsersData,
			leadDataDetails
		] = await Promise.all([
			// Get all subscribers for the lead form
			leadsFormsSubscriber.find(conditionLead, { projection: { '_id': 1, 'email': 1 } }).toArray(),
			// Get user data
			users.findOne({ '_id': userId }),
			// Get lead form data
			leadsForm.findOne({ '_id': leadFormId })
		]);

		// Extract subscriber IDs and emails
		const allSubscriberIds = Array.isArray(subscriberResult) ? subscriberResult.map(doc => doc._id).filter(id => id !== null && id !== undefined) : [];

		const allSubscriberEmails = Array.isArray(subscriberResult) ? subscriberResult.map(doc => doc.email).filter(email => email !== null && email !== undefined && email.trim() !== '') : [];

		// Extract user and lead form details
		const userOptinIdGenerateLeadID = creatorLeadUsersData && creatorLeadUsersData['lead_forms_id'] ? creatorLeadUsersData['lead_forms_id'] : "";
		const userExcelLeadGenerateLeadId = creatorLeadUsersData && creatorLeadUsersData['excel_lead_forms_id'] ? creatorLeadUsersData['excel_lead_forms_id'] : "";
		const userAILaunchGenerateLeadId = creatorLeadUsersData && creatorLeadUsersData['ai_bot_forms_id'] ? creatorLeadUsersData['ai_bot_forms_id'] : "";

		const leadDescription = leadDataDetails && leadDataDetails['description'] ? leadDataDetails['description'] : "";
		const leadFormsSlug = leadDataDetails && leadDataDetails['slug'] ? leadDataDetails['slug'] : "";

		// Determine audience type
		let audienceType = title;
		if (leadFormId.equals(userOptinIdGenerateLeadID)) {
			audienceType = "opt-in";
		}
		if (leadFormId.equals(userExcelLeadGenerateLeadId)) {
			audienceType = "Excel";
		}
		if (leadFormId.equals(userAILaunchGenerateLeadId)) {
			audienceType = "Launch Campaign";
		}

		const randomNumber = Math.floor(Math.random() * 99);

		// Generate slug for the audience entry
		const slugOptions = {
			'title': title + '-' + randomNumber,
			'table_name': TABLE_AUDIENCES,
			'slug_field': "slug"
		};
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Upsert the audience entry with the latest subscriber data
		await audienceTable.updateOne(
			{
				'user_id': userId,
				'lead_forms_id': leadFormId,
				'lead_import_id': leadImportId,
			},
			{
				$set: {
					'lead_forms_subscriber_ids': allSubscriberIds,
					'audience_emails': allSubscriberEmails,
					'total_users': allSubscriberIds.length,
					'modified': getUtcDate()
				},
				$setOnInsert: {
					'title': title,
					'description': leadDescription,
					'audience_type': audienceType,
					'lead_import_id': leadImportId,
					'lead_forms_slug': leadFormsSlug,
					'excel_file_name': excelFileName,
					'created': getUtcDate(),
					'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
					'user_id': userId,
					'lead_forms_id': leadFormId,
				}
			},
			{ upsert: true }
		);

		// Update all entry subscriber data for the user
		await allSubmitToForAudienceCount(userId);

		return;
	} catch (error) {
		console.error("Error in submitForAudienceEntries:", error);
		return;
	}
}; // End submitForAudienceEntries

/**
 * Function to get all lead_forms_subscriber_ids and audience_emails without distinct.
 * Uses async/await for MongoDB queries.
 * @param {Object} conditionOptions - Query conditions for the audience table.
 * @returns {Promise<Object>} - Object containing all_subscriber_ids and all_audience_emails arrays.
 */
withoutDistinctLeadFormsSubscriberIds = async (conditionOptions) => {
	try {
		const audienceTable = db.collection(TABLE_AUDIENCES);

		// Fetch documents matching the condition with only the required fields
		const resultAssignUsers = await audienceTable.find(conditionOptions, { projection: { 'lead_forms_subscriber_ids': 1, 'audience_emails': 1 } }).toArray();

		// Extract and flatten all subscriber IDs and audience emails
		const allSubscriberIds = resultAssignUsers.map(doc => doc.lead_forms_subscriber_ids).filter(ids => Array.isArray(ids) && ids.length > 0).flat();

		const audienceEmails = resultAssignUsers.map(doc => doc.audience_emails).filter(emails => Array.isArray(emails) && emails.length > 0).flat();

		return {
			'all_subscriber_ids': allSubscriberIds,
			'all_audience_emails': audienceEmails
		};
	} catch (error) {
		console.error("Error in withoutDistinctLeadFormsSubscriberIds:", error);
		// Return empty arrays in case of error
		return {
			'all_subscriber_ids': [],
			'all_audience_emails': []
		};
	}
}; // End withoutDistinctLeadFormsSubscriberIds

/**
 * Function to update all user lead count data in the audience table.
 * Uses async/await for all database and async operations.
 * @param {String|ObjectId} userId - The user ID to update audience counts for.
 * @returns {Promise<void>}
 */
allSubmitToForAudienceCount = async (userId) => {
	try {
		if (!userId) return;

		// Ensure userId is an ObjectId
		userId = newObjectIdDefault(userId);

		// Prepare query to get all lead subscriber user arrays except for "ALL" audience type
		const conditionsAudience = {
			'user_id': userId,
			'audience_type': { $ne: AUDIENCE_TYPE_ALL }
		};

		// Fetch all subscriber IDs and audience emails for the user
		const assignLeadSubscriberUsers = await withoutDistinctLeadFormsSubscriberIds(conditionsAudience);

		const allSubscriberIds = Array.isArray(assignLeadSubscriberUsers.all_subscriber_ids)
			? assignLeadSubscriberUsers.all_subscriber_ids
			: [];
		const allAudienceEmails = Array.isArray(assignLeadSubscriberUsers.all_audience_emails)
			? assignLeadSubscriberUsers.all_audience_emails
			: [];

		// Generate slug for the "ALL" audience type
		const slugOptions = {
			title: AUDIENCE_TYPE_ALL,
			table_name: TABLE_AUDIENCES,
			slug_field: "slug"
		};
		const slugResponse = await getDatabaseSlug(slugOptions);

		// Prepare the update document for the audience table
		const audienceTable = db.collection(TABLE_AUDIENCES);

		await audienceTable.updateOne(
			{
				'user_id': userId,
				'title': AUDIENCE_TYPE_ALL
			},
			{
				$set: {
					'lead_forms_subscriber_ids': allSubscriberIds,
					'audience_emails': allAudienceEmails,
					'total_users': allAudienceEmails.length,
					'created': getUtcDate(),
					'modified': getUtcDate()
				},
				$setOnInsert: {
					'slug': (slugResponse && slugResponse.title) ? slugResponse.title : "",
					'title': AUDIENCE_TYPE_ALL,
					'description': AUDIENCE_TYPE_ALL,
					'audience_type': AUDIENCE_TYPE_ALL,
					'user_id': userId,
				}
			},
			{ upsert: true }
		);

		return;
	} catch (error) {
		console.error("Error in allSubmitToForAudienceCount:", error);
		return;
	}
}; // End allSubmitToForAudienceCount

/**
 * Function to get loyalist email user ids using async/await.
 * Returns an array of email_user_id values that match the criteria and have vote details.
 */
getLoyalListEmailUserId = async (loginUserData) => {
	try {
		// Extract userId and frontSubUsersIds from loginUserData
		const userId = loginUserData._id ? loginUserData._id : [];
		const frontSubUsersIds = Array.isArray(loginUserData.front_sub_user_ids) ? [...loginUserData.front_sub_user_ids] : [];
		frontSubUsersIds.push(userId);

		// Set query conditions
		const conditions = {
			'email_user_id': { $exists: true },
			'creator_id': { $in: frontSubUsersIds },
			'stage_level': HOT_LEADS_LEVEL
		};

		const signupLeadForms = db.collection(TABLE_SIGNUP_LEAD_FORMS);

		// Build aggregation pipeline
		const pipeline = [
			{ $match: conditions },
			{
				$lookup: {
					from: TABLE_POLL_USER_VOTE_PARTICIPANTS,
					localField: "email_user_id",
					foreignField: "user_id",
					as: "voteDetails"
				}
			},
			{
				$match: {
					voteDetails: { $ne: [] }
				}
			},
			{
				$group: {
					_id: "$email_user_id"
				}
			}
		];

		// Execute aggregation using async/await
		const result = await signupLeadForms.aggregate(pipeline).toArray();

		// Map result to array of ids
		const idsArray = result.map(doc => doc._id);

		return idsArray;
	} catch (error) {
		// Log error and return empty array on failure
		console.error("Error in getLoyalListEmailUserId:", error);
		return [];
	}
}; // End getLoyalListEmailUserId

/**
 * Function to get loyalist user ids using async/await
 */
getLoyalistUserIds = async (conditions) => {
	try {
		const pollVoteParticipants = db.collection(TABLE_POLL_USER_VOTE_PARTICIPANTS);

		// If conditions are provided, fetch distinct user ids
		if (conditions) {
			const distinctUserIds = await pollVoteParticipants.distinct("user_id", conditions);

			// Return the user ids and their count
			return {
				'user_ids': distinctUserIds,
				'total_user': distinctUserIds.length
			};
		} else {
			// If no conditions, return empty result
			return {
				'user_ids': [],
				'total_user': DEFAULT_ZERO
			};
		}
	} catch (error) {
		// Log error and return empty result on failure
		console.error("Error in getLoyalistUserIds:", error);
		return {
			'user_ids': [],
			'total_user': DEFAULT_ZERO
		};
	}
}; // End getLoyalistUserIds


/**
 * Function to upload video from URL to S3 bucket using async/await.
 * Handles all queries with async/await and is ready for parallelization if needed.
 * @param {Object} videoOptions - Options containing video_url and target_folder
 * @returns {Promise<Object>} - Status object indicating success or error
 */
uploadVideoFromURLToS3 = async (videoOptions) => {
	try {
		// Extract video URL and target folder from options
		const videoUrl = videoOptions.video_url || "";
		const targetFolder = videoOptions.target_folder || "";

		const fileType = require('file-type');

		// Validate required parameters
		if (!videoUrl || !targetFolder) {
			return { status: STATUS_ERROR, message: 'Missing videoUrl or targetFolder' };
		}

		// Download video as arraybuffer using axios
		const response = await axios.get(videoUrl, {
			responseType: 'arraybuffer',
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
			}
		});

		// Convert response data to Buffer
		const data = Buffer.from(response.data, 'binary');

		// Detect file type from buffer
		const type = await fileType.fromBuffer(data);

		// Prepare S3 upload parameters
		const params = {
			Bucket: process.env.AWS_BUCKET_NAME,
			Key: S3_BUCKET_UPLOAD_PATH + targetFolder,
			Body: data,
			ContentType: type?.mime || 'video/mp4'
		};

		// Upload to S3 using async/await
		await s3.upload(params).promise();

		// Return success status
		return { status: STATUS_SUCCESS };
	} catch (error) {
		// Log error and return error status
		console.error('Error uploading video:', error);
		return { status: STATUS_ERROR };
	}
}; // End uploadVideoFromURLToS3

/**
 * Function to download video from URL using async/await.
 * Handles both S3 and local storage, with proper error handling and comments.
 */
downloadVideoToUrl = async (res, req, responseVideo) => {
	let videoUrl = responseVideo.url || "";
	let destUrl = responseVideo.dest || "";

	// Validate input URLs
	if (!videoUrl || !destUrl) {
		return {
			status: STATUS_ERROR,
			fileName: "",
			message: res.__("admin.video_url.invalid_video_url")
		};
	}

	// Get video extension and validate
	let videoExtension = getUrlExtension(videoUrl);
	if (ALLOWED_VIDEO_EXTENSIONS.indexOf(videoExtension) === -1) {
		return {
			status: STATUS_ERROR,
			fileName: "",
			message: res.__("admin.video_url.invalid_video_url")
		};
	}

	// Generate new file/folder names
	let videoName = videoUrl.substring(videoUrl.lastIndexOf('/') + 1).split('.')[0];
	const today = new Date();
	let newFolder = (newDate("", "mmm") + newDate("", "yyyy")).toUpperCase() + '/' + today.getDate() + '/';
	let randomNumber = Math.floor(Math.random() * 99);
	let newFileName = newFolder + Date.now() + randomNumber + '-' + changeFileName(videoName + '.' + videoExtension);

	let targetFolderArr = destUrl.split('/');
	let targetFolder = targetFolderArr[targetFolderArr.length - 2];

	try {
		if (UPLOAD_TO_S3) {
			// Prepare S3 upload options
			let awsOptionData = {
				'video_url': videoUrl,
				'target_folder': targetFolder + '/' + newFileName,
			};

			// Upload to S3 using async/await
			const videoRes = await uploadVideoFromURLToS3(awsOptionData);

			if (videoRes.status === STATUS_SUCCESS) {
				return {
					status: STATUS_SUCCESS,
					fileName: newFileName,
					videoExtension: videoExtension,
					message: ""
				};
			} else {
				return {
					status: STATUS_ERROR,
					fileName: "",
					videoExtension: "",
					message: res.__("admin.video_url.invalid_video_url")
				};
			}
		} else {
			// Local file system save
			const fullPath = path.join(destUrl, newFileName); // Full absolute path to save video
			const folderPath = path.dirname(fullPath); // Get the folder from the full path

			// Ensure the folder exists
			await fs.promises.mkdir(folderPath, { recursive: true });

			// Download video as stream and save to file
			const response = await axios({
				method: 'get',
				url: videoUrl,
				responseType: 'stream',
			});

			// Pipe the stream to file and await finish/error
			await new Promise((resolve, reject) => {
				const writer = fs.createWriteStream(fullPath);
				response.data.pipe(writer);

				writer.on('finish', resolve);
				writer.on('error', reject);
			});

			return {
				status: STATUS_SUCCESS,
				fileName: newFileName,
				videoExtension: videoExtension,
				message: ""
			};
		}
	} catch (err) {
		// Log error for debugging
		console.error('Error downloading video:', err);
		return {
			status: STATUS_ERROR,
			fileName: "",
			message: res.__("admin.video_url.invalid_video_url")
		};
	}
}; // End downloadVideoToUrl


/**
 * Function to get data base slug according to registration
 *
 * @param tableName AS Table Name
 * @param title AS Title
 * @param slugField AS Slug Field Name in database
 *
 * @return string
 */
getDatabaseWithoutHyphanSlug = async (options) => {
	try {
		let tableName = (options && options.table_name) ? options.table_name : "";
		let title = (options && options.title) ? options.title : "";
		let slugField = (options && options.slug_field) ? options.slug_field : "";

		if (title == '' || tableName == "") {
			return { title: "", options: options };
		}

		// 👇 Hyphen remove karne ke liye replacement: ""
		// let convertTitleIntoSlug = slug(title, { replacement: "" }).toLowerCase();
		let convertTitleIntoSlug = slug(title).toLowerCase();
		let collectionName = db.collection(String(tableName));

		/** Set conditions **/
		let conditions = {};
		conditions[slugField] = { $regex: new RegExp(convertTitleIntoSlug, "i") };

		let randomNumber = Math.floor(Math.random() * 99);

		// --- Use async/await for countDocuments query ---
		let count = 0;
		let err = null;
		try {
			count = await collectionName.countDocuments(conditions);
		} catch (error) {
			err = error;
			count = 0;
		}

		/** Send response **/
		return {
			title: (count > 0) ? convertTitleIntoSlug + '' + count + '' + randomNumber : convertTitleIntoSlug,
			options: options,
			err: err
		};
	} catch (err) {
		return {
			title: "",
			options: options,
			err: err
		};
	}
} //end getDatabaseWithoutHyphanSlug();


/** 
 * Function to update user email across all related tables/collections 
 * after the primary email update.
 */
syncUpdatedEmailToAllCollections = async (req, res, optionsData) => {
	try {
		const selectedUserIds = optionsData.user_ids || [];
		let updatedEmail = (optionsData.email).toLowerCase() || "";
		let updatedUserId = newObjectIdDefault(optionsData.user_id) || "";

		const users = db.collection(TABLE_USERS);
		const multipleUserAssign = db.collection(TABLE_MULTIPLE_USERS_ASSIGN);

		/** Conditon for used to select checkbox for users */
		if (updatedEmail && selectedUserIds.length > 0) {
			// Step 1: Get all selected users
			const objectIds = selectedUserIds.map(id => newObjectIdDefault(id));

			// Step 2: selected users update email
			await users.updateMany({ '_id': { $in: objectIds } }, { $set: { 'email': updatedEmail } });

			// Step 3: selected users update multiple user assign
			const userDetailsList = await users.find({ '_id': { $in: objectIds } }).toArray();
			const updatePromises = userDetailsList.map(user => {
				return multipleUserAssign.updateMany(
					{ 'assigned_user_id': user._id },
					{
						$set: {
							'assigned_user_email': user.email,
							'assigned_user_slug': user.slug,
							'modified': getUtcDate()
						}
					}
				);
			});
			await Promise.all(updatePromises);
		}

		/** Without selcect checkbox */
		if (updatedUserId) {
			// Step 1: selected users update only one record wise
			const userDetailsList = await users.find({ '_id': updatedUserId }).toArray();

			const updatePromises = userDetailsList.map(user => {
				return multipleUserAssign.updateMany(
					{ 'assigned_user_id': user._id },
					{
						$set: {
							'assigned_user_email': user.email,
							'assigned_user_slug': user.slug,
							'modified': getUtcDate()
						}
					}
				);
			});
			await Promise.all(updatePromises);
		}
		return;

	} catch (err) {
		console.error("Error in syncUpdatedEmailToAllCollections:", err);
		return;
	}
}

/** get campaign detials for ref key */
getGroupDetailsByRefKey = async (optionData) => {
	try {
		let groupRefKey = optionData?.group_ref_key || '';
		const tableAiCampaignChat = db.collection(TABLE_AI_CAMPAIGN_CHAT);
		const result = await tableAiCampaignChat.find({ group_ref_key: groupRefKey }, { projection: { unique_key: 1, group_slug: 1 } }).sort({ created: SORT_DESC }).limit(1).toArray();
		return result[0] || null;
	} catch (err) {
		console.error("Error fetching group details:", err);
		throw err;
	}
};


/**
 * Function to assign a user to multiple accounts using async/await.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {String|ObjectId} userId - The user id to assign from.
 * @param {String|ObjectId} assignedUserId - The user id to assign to.
 * @returns {Promise<Object>} - Result object with status and message.
 */
dynamicAssignMultipleAccount = async (req, res, userId, assignedUserId) => {
	try {
		const users = db.collection(TABLE_USERS);
		const multipleUserAssign = db.collection(TABLE_MULTIPLE_USERS_ASSIGN);

		// Check if both userId and assignedUserId are provided
		if (!userId || !assignedUserId) {
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.global.no_record_found"),
			};
		}

		// Find assigned user details
		const assignedUser = await users.findOne(
			{ '_id': newObjectIdDefault(assignedUserId) },
			{ projection: { _id: 1, email: 1, full_name: 1, slug: 1 } }
		);

		if (!assignedUser) {
			// Assigned user not found
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.global.no_record_found"),
			};
		}

		// Check if the user is already assigned
		const alreadyAssignUser = await multipleUserAssign.findOne({
			"user_id": newObjectIdDefault(userId),
			"assigned_user_id": newObjectIdDefault(assignedUserId)
		});

		if (alreadyAssignUser) {
			// User already assigned
			return {
				'status': STATUS_ERROR,
				'message': res.__("front.user.user_already_assigned")
			};
		}

		// Prepare assigned user details
		let assignedUserEmail = assignedUser.email || "";
		let assignedUserSlug = assignedUser.slug || "";

		// Insert new assignment
		await multipleUserAssign.insertOne({
			'user_id': newObjectIdDefault(userId),
			'assigned_user_id': newObjectIdDefault(assignedUserId),
			'assigned_user_email': assignedUserEmail,
			'assigned_user_slug': assignedUserSlug,
			'created': getUtcDate()
		});

		// Send success message
		return {
			'status': STATUS_SUCCESS,
			'message': res.__("front.users.user_has_been_assigned_successfully"),
		};

	} catch (err) {
		// Handle error and send error response
		console.error("Error in dynamicAssignMultipleAccount:", err);
		return {
			'status': STATUS_ERROR,
			'message': res.__("front.system.something_going_wrong_please_try_again")
		};
	}
}


/**
 * Function to create an enterprise basic sub user.
 * Uses async/await for all DB operations with proper comments.
 */
createEnterpriseBasicUser = async (req, res, optionData) => {
	try {
		// Get collection references for enterprise imports and users
		const enterpriseImport = db.collection(TABLE_ENTERPRISE_IMPORTS);
		const users = db.collection(TABLE_USERS);

		let email = optionData?.user_email || "";

		if (!email) return false;

		// Find matching enterprise record by email (case-insensitive) using async/await
		let enterpriseData = await enterpriseImport.findOne({
			"email": { $regex: '^' + email + '$', $options: 'i' }
		});

		// If enterprise record exists
		if (enterpriseData && Object.keys(enterpriseData).length > 0) {

			let userId = enterpriseData.user_id || "";

			// Check if the user exists in Users collection (case-insensitive email match) using async/await
			let usersData = await users.findOne({
				"email": { $regex: '^' + email + '$', $options: 'i' }
			});

			// If user already exists
			if (usersData && Object.keys(usersData).length > 0) {
				// Assign the user to multiple accounts using async/await
				let assignedUserId = usersData?._id || "";
				await dynamicAssignMultipleAccount(req, res, userId, assignedUserId);
			}
		}
	} catch (err) {
		// Handle error and log it
		console.error("Error creating enterprise basic user:", err);
		return;
	}
};


/**
 * Helper function to safely create a MongoDB ObjectId from a given value.
 * Returns null if the value is empty or invalid.
 *
 * @param {string|Object} id - The value to convert to ObjectId.
 * @returns {ObjectId|null} - The ObjectId instance or null if invalid.
 */
newObjectIdDefault = (id) => {
	try {
		if (!id) {
			// If no id is provided, generate a new ObjectId
			return new ObjectId();
		}
		// If a string is passed, first check if it is a valid ObjectId
		if (ObjectId.isValid(id)) {
			return new ObjectId(id.toString().trim());
		}
		console.error('Invalid ObjectId:', id);
		return null;
	} catch (error) {
		console.error('Error creating ObjectId:', error);
		return null;
	}
};