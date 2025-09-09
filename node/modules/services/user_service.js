var crypto = require('crypto');
const asyncParallel = require("async/parallel");
const leadFormModule = require("../frontend/api/model/lead_form");

function UserService() {

	/**
	 * function for add user
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 */
	this.addUser = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Sanitize incoming data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract and set user fields
			const firstName = req.body.first_name || "";
			const lastName = req.body.last_name || "";
			const email = req.body.email || "";
			const accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;
			let password = req.body.password || "";
			const requestFrom = req.body.request_from || "";
			const registeredFrom = req.body.registered_from || REGISTERED_FROM_NORMAL;
			const apiType = req.body.api_type || ADMIN_API_TYPE;
			const fullName = `${firstName} ${lastName}`;
			let gender = req.body.gender ? Number(req.body.gender) : OTHER;
			let mobile = req.body.mobile || "";
			let dob = req.body.dob || DEFAULT_DATE_OF_BIRTH;
			const userName = req.body.user_name || "";
			const zipCode = req.body.zip || "";
			const provider = req.body.provider || "";
			const socialId = req.body.social_id || "";
			const yourBio = req.body.your_bio || "";
			const welcomeAiPage = req.body.is_welcome || "";
			let nameOfTheBusiness = req.body.name_of_the_business || "";
			const agreePolicy = req.body.agree_policy || false;
			const defaultTimezone = req.body.default_timezone || "";
			const userSelectedTimeZone = req.body.current_timezone || defaultTimezone;
			const ip = req.body.ip || req.body.ip;

			// Poll vote related fields
			const userSourceType = req.body.user_source_type || USER_SOURCE_NORMAL_REGISTRATION;
			const ownerPollUerId = req.body.owner_poll_user_id || "";
			const registrationLeadFormsId = req.body.registration_lead_forms_id || "";

			// Image upload options
			const AIBotBusinessLogo = (req.files && req.files.business_logo) ? req.files.business_logo : "";
			const image = (req.files && req.files.profile_image) ? req.files.profile_image : AIBotBusinessLogo;

			// Profile completion
			const completeProfilePage = req.body.complete_profile || "";

			// AI business info
			const webAiInfo = db.collection(TABLE_WEB_AI_INFO);
			const uniqueBrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id.toString() : "";
			let businessInformation = "";
			if (uniqueBrowserId) {
				businessInformation = await webAiInfo.findOne(
					{ "unique_browser_id": uniqueBrowserId },
					{ projection: { _id: 0, data: 1, social_media_presence: 1, apify_instagram_data: 1 } }
				);
			}
			const aiInformationData = businessInformation?.data || "";
			const socialMediaPresenceData = businessInformation?.social_media_presence || "";
			const apifyMediaPresenceData = businessInformation?.apify_instagram_data || "";

			let userBusinessName = "";
			if (aiInformationData?.businessInfo) {
				userBusinessName = aiInformationData.businessInfo.name;
			} else if (socialMediaPresenceData?.businessInfo) {
				userBusinessName = socialMediaPresenceData.businessInfo.name;
			} else if (apifyMediaPresenceData?.businessInfo) {
				userBusinessName = apifyMediaPresenceData.businessInfo.name;
			}
			if (userBusinessName) {
				nameOfTheBusiness = userBusinessName;
			}

			// DB collections
			const users = db.collection(TABLE_USERS);
			const incrementals = db.collection(TABLE_INCREMENTALS);

			let errMessageArray = [];
			const options = {
				image: image,
				filePath: USERS_FILE_PATH,
			};

			// Get social reachout flag for new user
			const socialReachoutAdminFlag = await users.findOne({ "_id": newObjectIdDefault(ADMIN_ID) });

			// Upload user image
			const moveFileResponse = await moveUploadedFile(req, res, options);
			if (moveFileResponse.status === STATUS_ERROR) {
				errMessageArray.push({ param: 'profile_image', msg: moveFileResponse.message });
				finalResponse = {
					status: STATUS_ERROR_FORM_VALIDATION,
					errors: errMessageArray,
					message: "Errors",
				};
				return finalResponse;
			}
			const imageName = moveFileResponse.fileName || "";

			// Generate bcrypt password
			let bcryptPassword;
			try {
				bcryptPassword = await bcryptPasswordGenerate(password);
			} catch (err) {
				return next(err);
			}

			// Prepare parallel queries for UUID, OTP, slug, and user_unique_id
			const slugOptions = {
				title: nameOfTheBusiness ? nameOfTheBusiness : fullName,
				table_name: TABLE_USERS,
				slug_field: "slug"
			};

			const [
				uuidCode,
				emailOtpCode,
				slugResponse,
				userUniqueId
			] = await Promise.all([
				// Generate random UUID
				getRandomString(req, res, { "srting_length": 6 }).then(r => r.result),
				// Generate email OTP
				getRandomOTP(),
				// Generate slug
				getDatabaseWithoutHyphanSlug(slugOptions),
				// Generate user unique id
				(async () => {
					const result = await incrementals.findOneAndUpdate(
						{ 'slug': UNIQUE_CUSTOMER_INCREMENTAL_SLUG },
						{ '$inc': { number: 1 } },
						{ returnDocument: 'after' }
					);
					const number = result?.value?.number || 0;
					return number.toString().padStart(4, '0');
				})()
			]);

			const slugName = slugResponse.title;
			let isEmailVerified = completeProfilePage ? VERIFIED : NOT_VERIFIED;
			const currentTimeStamp = new Date().getTime();
			const validateString = crypto.createHash('md5').update(currentTimeStamp + email).digest("hex");

			let age = DEACTIVE;
			if (dob !== "") {
				age = calculateAge(dob);
			}

			// If lead type, override some fields
			if (requestFrom === REQUEST_FROM_LEAD) {
				bcryptPassword = req.body.password;
				age = Number(req.body.age);
				dob = req.body.dob;
				gender = req.body.gender ? Number(req.body.gender) : "";
				// Allow slug override
				if (req.body.slug) {
					slugName = req.body.slug;
				}
			}

			// Prepare user insert data
			let insertData = {
				'UUID': uuidCode,
				'user_unique_id': userUniqueId,
				'fname': firstName,
				'lname': lastName,
				'full_name': fullName,
				'email': email.toLowerCase(),
				'email_otp': emailOtpCode,
				'is_email_verified': isEmailVerified,
				'password': bcryptPassword,
				'request_from': requestFrom,
				'slug': (userName !== '') ? userName : slugName,
				'unique_slug': slugName,
				'last_login': getUtcDate(),
				'is_blocked': UN_BLOCK,
				'is_active': UN_SUSPEND,
				'account_type': accountType,
				'api_type': apiType,
				'is_deleted': NOT_DELETED,
				'user_role_id': FRONT_ADMIN_ROLE_ID,
				'registered_from': parseInt(registeredFrom),
				'age': age,
				'dob': ageUtcDate(dob),
				'gender': gender,
				'profile_image': imageName,
				'zip': zipCode,
				'mobile': mobile,
				'dark_light_theme': DEFAULT_ZERO,
				'email_newsletter_subscribed': DEFAULT_ZERO,
				'email_newsletter_subscribed_enc_id': newsletterSubscriberEncId(email),
				'your_bio': yourBio,
				'is_welcome': welcomeAiPage,
				'user_source_type': userSourceType,
				'agree_policy': agreePolicy,
				'social_reachout_send_mail_master_admin_flag': (socialReachoutAdminFlag && socialReachoutAdminFlag.social_reachout_send_mail_master_admin_flag) ? socialReachoutAdminFlag.social_reachout_send_mail_master_admin_flag : SOCIAL_REACHOUT_TOOGLE_ON,
				'insider_toggle': INSIDER_TOGGLE_ON,
				'post_on_instagram': true,
				'post_on_facebook': false,
				'current_timezone': userSelectedTimeZone,
				'ip': ip,
				'activated_at': getUtcDate(),
				'created': getUtcDate(),
				'modified': getUtcDate()
			};

			// Add social provider IDs if present
			if (provider === PROVIDER_FACEBOOK) {
				insertData['fb_social_id'] = socialId;
			}
			if (provider === PROVIDER_GOOGLE) {
				insertData['google_social_id'] = socialId;
			}
			if (provider === PROVIDER_MICROSOFT) {
				insertData['microsoft_social_id'] = socialId;
			}
			// If social registration, mark email as verified
			if (requestFrom === REQUEST_FROM_SOCIAL) {
				insertData['email_otp'] = "";
				insertData['is_email_verified'] = VERIFIED;
			}

			// Insert user into DB
			let insertResult;
			try {
				insertResult = await users.insertOne(insertData);
			} catch (err) {
				finalResponse = {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				};
				return finalResponse;
			}
			const insertedId = insertResult.insertedId;

			// Convert fullname to signature image
			const signatureUserData = {
				"user_id": insertedId,
				"first_name": firstName,
				"last_name": lastName
			};
			await signatureHtmltoImageConvert(req, res, signatureUserData);

			// Increase signup attempts
			await increaseSignupAttempts(email, insertedId);

			// Update default user flag for multiple accounts
			await updateDefaultUserFlagForMultipleAccount(email);

			// Generate QR code public URL image
			await qrcodeGenerateUrl(req, res, insertedId);

			// Send welcome notification to user
			const notificationMessageParams = [fullName];
			const notificationOptions = {
				notification_data: {
					notification_type: NOTIFICATION_WELCOME_NEW_USER_REGISTER,
					message_params: notificationMessageParams,
					parent_table_id: insertedId,
					user_id: insertedId,
					user_ids: [insertedId],
					user_role_id: SUPER_ADMIN_ROLE_ID,
					role_id: SUPER_ADMIN_ROLE_ID,
					extra_parameters: {
						user_id: newObjectIdDefault(insertedId),
					}
				}
			};
			insertNotifications(req, res, notificationOptions);

			// Upload reward image for public business user
			if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				await uploadUserRewardImage(req, res, insertedId);
			}

			// Assign default followers/following for Pocial user
			await defaultAssignPocialFollowerAndFollowers(insertedId);

			// Save public business user details if applicable
			if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				req.body.default_name_of_the_business = firstName ? firstName : insertData.slug;
				req.body.business_logo = imageName;
				req.body.description = yourBio;
				await savePublicBussinessUserDetails(req, res, insertedId);
			}

			// If poll registration, submit lead signup fields
			if (ownerPollUerId && registrationLeadFormsId && userSourceType === USER_SOURCE_POLL_REGISTRATION) {
				req.body['gender'] = req.body.gender ? Number(req.body.gender) : "";
				req.body['user_name'] = req.body.user_name || "";
				req.body['dob'] = req.body.dob || "";
				req.body['creator_id'] = ownerPollUerId;
				req.body['lead_forms_id'] = registrationLeadFormsId;
				req.body['submit_from_user_service'] = true;
				await leadFormModule.submitLeadsSigupFields(req, res, next);
			}

			// Assign free plan to user
			const optionsData = {
				'plan_price_id': PLAN_PRODUCT_PRICE_FREE_ID,
				'free_plan': true,
				'free_plan_date': getUtcDate(),
				'plan_purchase_date': getUtcDate(),
			};
			await updateUserRecordsIdAccording(insertedId, optionsData);

			// Insert user plan purchase data
			const planPurchaseData = {
				'user_id': insertedId,
				'plan': PLAN_PRODUCT_PRICE_FREE_NAME,
				'amount': DEACTIVE,
				'plan_price_id': PLAN_PRODUCT_PRICE_FREE_ID,
				'plan_lookup_key': PLAN_PRODUCT_PRICE_FREE_NAME,
				'payment_method': PLAN_PRODUCT_PRICE_FREE_NAME,
				'payment_status': PAYMENT_STATUS_SUCCEEDED,
				'subscription_status': SUBSCRIPTION_ACTIVE_STATUS,
				'plan_status': PAYMENT_PLAN_ACTIVE,
				'currency': CURRENCY_USD,
				'plan_type': PLAN_FOR_FREE
			};
			await userPlanPurchase(req, res, planPurchaseData);

			// Create enterprise basic user
			const enterpriseOption = {
				'user_email': email
			};
			await createEnterpriseBasicUser(req, res, enterpriseOption);

			// Save default notification settings
			const optionsNotification = {
				user_id: insertedId,
				on_off_status: ON_NOTIFICATION_STATUS,
				real_time: REAL_TIME_NOTIFICATION_TYPES,
				daily_digest: DAILY_DIGEST_NOTIFICATION_TYPES,
				weekly_digest: WEEKLY_DIGEST_NOTIFICATION_TYPES,
				monthly_digest: monthly_DIGEST_NOTIFICATION_TYPES,
			};
			const notificationSettingsResponse = await saveNotificationSettingsSave(optionsNotification);

			// Final response
			finalResponse = {
				status: STATUS_SUCCESS,
				result: {
					email: email,
					password: password,
					firstName: firstName,
					fullName: fullName,
					validateString: validateString,
					emailOtpCode: emailOtpCode,
					lastInsertId: insertedId,
					slug: insertData.slug,
					response: notificationSettingsResponse
				},
				message: STATUS_SUCCESS,
			};
			return finalResponse;
		} catch (err) {
			if (typeof next === "function") {
				return next(err);
			}
			return {
				status: STATUS_ERROR_INVALID_ACCESS,
				result: {},
				message: res.__("front.system.something_going_wrong_please_try_again")
			};
		}
	};


	/**
	 * Function to edit user details.
	 * Handles user profile update, including password, image, and business details.
	 * All DB queries use async/await for clarity and error handling.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 */
	this.editUser = async (req, res, next) => {
		let finalResponse = {};

		try {
			// Sanitize input data
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const loginUserData = req.user_data ? req.user_data : "";
			let userId = loginUserData._id ? loginUserData._id : req.body.id;
			const oldLoginEmail = loginUserData.email ? loginUserData.email : "";

			// Determine request source
			const requestFrom = req.body.request_from ? req.body.request_from : "";
			if (requestFrom == REQUEST_FROM_LEAD) {
				userId = req.body.id;
			}

			const users = db.collection(TABLE_USERS);

			// Validate userId
			if (!userId) {
				return {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page")
				};
			}

			// Extract and prepare user data
			const email = req.body.email ? req.body.email : "";
			const oldEmail = req.body.old_email ? req.body.old_email : oldLoginEmail;
			const firstName = req.body.first_name ? req.body.first_name : "";
			const lastName = req.body.last_name ? req.body.last_name : "";
			const fullName = firstName + " " + lastName;
			const gender = req.body.gender ? Number(req.body.gender) : "";
			const mobile = req.body.mobile ? req.body.mobile : "";
			const dob = req.body.dob ? req.body.dob : "";
			const zipCode = req.body.zip ? req.body.zip : "";
			const oldPassword = req.body.old_password ? req.body.old_password : "";
			const password = req.body.password ? req.body.password : "";
			const userName = req.body.user_name ? req.body.user_name : "";
			const accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;
			const yourBio = req.body.your_bio ? req.body.your_bio : "";
			const defaultTimezone = req.body.default_timezone ? req.body.default_timezone : "";
			const userSelectedTimeZone = req.body.current_timezone ? req.body.current_timezone : defaultTimezone;
			const selectedUserIdsUpdateData = req.body.selected_user_ids_update_data || [];

			// Calculate age if DOB is provided
			let age = DEACTIVE;
			if (dob !== "") {
				age = calculateAge(dob);
			}

			// Handle reward image upload for public business users
			if (accountType == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
				const rewardImage = await uploadUserRewardImage(req, res, userId);
				if (rewardImage.status == STATUS_ERROR) {
					return {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: "",
						message: rewardImage.message
					};
				}
			}

			// Prepare image upload options
			const oldimage = req.body.old_image ? req.body.old_image : "";
			const image = (req.files && req.files.profile_image) ? req.files.profile_image : "";
			const options = {
				image: image,
				filePath: USERS_FILE_PATH,
				oldPath: oldimage
			};

			// Convert full name to signature image and generate QR code in parallel
			const signatureUserData = {
				user_id: userId,
				first_name: firstName,
				last_name: lastName
			};
			await Promise.all([
				signatureHtmltoImageConvert(req, res, signatureUserData),
				qrcodeGenerateUrl(req, res, userId)
			]);

			// Upload user image
			let response;
			try {
				response = await moveUploadedFile(req, res, options);
			} catch (err) {
				if (typeof next === "function") return next(err);
				return {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: "",
					message: res.__("front.system.something_going_wrong_please_try_again")
				};
			}

			if (response.status == STATUS_ERROR) {
				return {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: "",
					message: response.message
				};
			}
			const imageName = response.fileName ? response.fileName : "";

			// Prepare update data for user
			let updateData = {
				fname: firstName,
				lname: lastName,
				full_name: fullName,
				age: age,
				dob: ageUtcDate(dob),
				gender: gender,
				profile_image: imageName,
				zip: zipCode,
				mobile: mobile,
				your_bio: yourBio,
				current_timezone: userSelectedTimeZone,
				modified: getUtcDate()
			};

			// Only admin can change account type
			if (requestFrom == REQUEST_FROM_ADMIN) {
				updateData.account_type = accountType;
			}

			// Update user slug if provided and not POCIAL_ID
			if (userName !== '' && userId != POCIAL_ID) {
				updateData.slug = userName;
			}

			// Save public business user details if applicable
			if (
				(requestFrom == REQUEST_FROM_ADMIN || requestFrom == REQUEST_FROM_API) &&
				accountType == PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE
			) {
				req.body.default_name_of_the_business = firstName ? firstName : userName;
				req.body.business_logo = imageName;
				req.body.submit_from = SUBMIT_FROM_USER_SERVICE;
				req.body.description = yourBio;
				await savePublicBussinessUserDetails(req, res, userId);
			}

			// Handle email update and verification status
			if (
				(requestFrom == REQUEST_FROM_ADMIN || requestFrom == REQUEST_FROM_API) &&
				email.toLowerCase() != oldEmail.toLowerCase()
			) {
				updateData.email = email.toLowerCase();
				updateData.is_email_verified = NOT_VERIFIED;
			}

			// Handle password update logic
			if (oldPassword !== "") {
				// User is trying to change password, verify old password
				let passwordMatch;
				try {
					passwordMatch = await bcryptCheckPasswordCompare(oldPassword, loginUserData.password);
				} catch (err) {
					if (typeof next === "function") return next(err);
					return {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("admin.system.something_going_wrong_please_try_again")
					};
				}

				if (!passwordMatch) {
					return {
						status: STATUS_ERROR_INVALID_ACCESS,
						errors: "",
						message: res.__("admin.user_profile.old_password_you_entered_did_not_matched")
					};
				}

				// Generate new bcrypt password
				let bcryptPassword;
				try {
					bcryptPassword = await bcryptPasswordGenerate(password);
				} catch (err) {
					if (typeof next === "function") return next(err);
					return {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("admin.system.something_going_wrong_please_try_again")
					};
				}
				updateData.password = bcryptPassword;
			} else if (requestFrom == REQUEST_FROM_ADMIN && password !== "") {
				// Admin is updating password directly
				let bcryptPassword;
				try {
					bcryptPassword = await bcryptPasswordGenerate(password);
				} catch (err) {
					if (typeof next === "function") return next(err);
					return {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("admin.system.something_going_wrong_please_try_again")
					};
				}
				updateData.password = bcryptPassword;
			} else if (requestFrom == REQUEST_FROM_LEAD && password !== "") {
				// Lead-wise password update (plain, not hashed)
				updateData.password = password;
			}

			// Update user document in DB
			try {
				await users.updateOne(
					{ _id: newObjectIdDefault(userId) },
					{ $set: updateData }
				);
			} catch (err) {
				if (typeof next === "function") return next(err);
				return {
					status: STATUS_ERROR,
					errors: "",
					message: res.__("admin.system.something_going_wrong_please_try_again")
				};
			}

			// If email changed, sync across all related collections
			if (email && email != oldEmail) {
				const optionsIds = {
					user_id: newObjectIdDefault(userId),
					email: email,
					user_ids: selectedUserIdsUpdateData
				};
				await syncUpdatedEmailToAllCollections(req, res, optionsIds);
			}

			// Get updated user details
			const conditionOptions = {
				conditions: { _id: newObjectIdDefault(userId) }
			};
			let userDetailResponse;
			try {
				userDetailResponse = await getUserDetailBySlug(req, res, conditionOptions);
			} catch (err) {
				if (typeof next === "function") return next(err);
				return {
					status: STATUS_ERROR,
					errors: "",
					message: res.__("admin.system.something_going_wrong_please_try_again")
				};
			}

			// Final success response
			return {
				status: STATUS_SUCCESS,
				result: userDetailResponse.result ? userDetailResponse.result : {},
				errors: "",
				message: res.__("front.user.profile_has_been_updated_successfully")
			};
		} catch (err) {
			if (typeof next === "function") return next(err);
			return {
				status: STATUS_ERROR,
				errors: "",
				message: res.__("admin.system.something_going_wrong_please_try_again")
			};
		}
	}; // End editUser();
}
module.exports = new UserService();
