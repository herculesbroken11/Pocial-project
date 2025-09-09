const userService = require(WEBSITE_SERVICES_FOLDER_PATH + 'user_service');
const tokenList = {};

function Registration() {

	Registration = this;


	/**
	 * Function used to set login data
	 * Uses async/await for all database queries and handles parallel operations with Promise.all if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.login = async (req, res) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let finalResponse = {};

		const username = req.body.email ? req.body.email : "";
		const simplePassword = req.body.password ? req.body.password : "";
		const apiType = req.body.api_type ? req.body.api_type : "";
		const registrationType = req.body.registration_type ? req.body.registration_type : false;

		// Set query conditions for user lookup
		const conditions = {
			user_role_id: FRONT_ADMIN_ROLE_ID,
			is_deleted: NOT_DELETED,
			$or: [
				{ email: { $regex: '^' + username + '$', $options: 'i' } }, // Case-insensitive email match
				{ slug: { $regex: '^' + username + '$', $options: 'i' } },  // Case-insensitive slug match
			]
		};

		const userOptions = { conditions };

		try {
			// Get user details by slug/email
			const userResponse = await getUserDetailBySlug(req, res, userOptions);
			const resultData = userResponse.result ? userResponse.result : "";
			const userId = (resultData && resultData._id) ? resultData._id : "";

			// Check if user exists
			if (!resultData) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						token: "",
						refresh_token: "",
						token_life: JWT_CONFIG.tokenLife,
						message: res.__("front.user.email_password_entered_incorrect")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Run queries in parallel: first insider poll check and multiple account check
			let firstInsidersPollCheckDetails = LOGIN_INSIDER_NOT_CREATED;
			let countMultipleUser = false;
			if (userId) {
				const polls = db.collection(TABLE_POLLS);
				const [insiderPoll, multipleUser] = await Promise.all([
					polls.findOne({ user_id: newObjectIdDefault(userId), first_ai_poll_generated: true, type: POLL_AI_TYPE }),
					multipleUserExistsCheck(userId)
				]);
				firstInsidersPollCheckDetails = insiderPoll ? LOGIN_INSIDER_CREATED : LOGIN_INSIDER_NOT_CREATED;
				countMultipleUser = multipleUser;
			}
			resultData['is_multiple_account'] = countMultipleUser;

			const password = resultData.password ? resultData.password : "";

			// Compare password using bcrypt (async)
			const passwordMatch = await bcryptCheckPasswordCompare(simplePassword, password);
			if (!passwordMatch) {
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: {},
						token: "",
						refresh_token: "",
						token_life: JWT_CONFIG.tokenLife,
						message: res.__("admin.user.please_enter_correct_email_or_password")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if user is suspended
			if (resultData.is_active != UN_SUSPEND) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						token: "",
						refresh_token: "",
						token_life: JWT_CONFIG.tokenLife,
						message: res.__("front.user.account_temporarily_disabled")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check OTP verification and skip flag
			const nextDataAfterOtPVerification = resultData.created ? new Date(resultData.created) : "";
			const skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

			if (resultData.is_email_verified == VERIFIED || registrationType || skipWithoutValidatopn === true) {
				// Save user login logs and segment leads wallet in sequence
				await Registration.saveLoginLogs(req, res, resultData);
				await sendSegmentLeadRewardFromLogs(req, res, resultData);

				// Prepare JWT user object
				const userEmail = resultData.email ? resultData.email : "";
				const slug = resultData.slug ? resultData.slug : "";
				const jwtUser = { email: userEmail, slug: slug };

				// Generate JWT token
				const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

				tokenList['token'] = jwtResponse.token ? jwtResponse.token : "";
				tokenList['refresh_token'] = jwtResponse.refresh_token ? jwtResponse.refresh_token : "";
				resultData['image_url'] = USERS_URL;

				// Generate main user encode login URL
				const assignEmail = resultData.email ? resultData.email : "";
				const assignSlug = resultData.slug ? resultData.slug : "";
				const assignUuid = resultData.UUID ? resultData.UUID : "";
				const mainUserEncodeLoginUrl = generateLoginUrl(assignUuid, assignEmail, assignSlug);

				const fullName = resultData.full_name ? resultData.full_name : "";

				const returnResponse = {
					data: {
						status: STATUS_SUCCESS,
						main_user_encode_login_url: mainUserEncodeLoginUrl,
						result: resultData,
						image_url: USERS_URL,
						skip_without_flag: skipWithoutValidatopn,
						check_user_already_voted: userResponse.check_user_already_voted,
						token: jwtResponse.token ? jwtResponse.token : "",
						refresh_token: jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
						token_life: jwtResponse.token_life ? jwtResponse.token_life : "",
						first_insiders_poll_check: firstInsidersPollCheckDetails,
						message: res.__("front.user.you_are_logged_in", fullName),
					}
				};
				return returnApiResult(req, res, returnResponse);
			} else {
				// If email is not verified, send verification link
				const userType = resultData.user_type ? resultData.user_type : '';
				const loginUserData = {
					email: resultData.email ? resultData.email : "",
					full_name: resultData.full_name ? resultData.full_name : ""
				};

				const response = await userVerifyLinkSendUrlAccourding(req, res, loginUserData);

				if (response == STATUS_SUCCESS) {
					if (apiType == WEP_API_TYPE) {
						finalResponse = {
							data: {
								status: STATUS_OTP_VALIDATION_ERROR,
								skip_without_flag: skipWithoutValidatopn,
								result: {
									user_type: userType,
									is_email_verified: resultData.is_email_verified,
								},
								message: res.__("front.user.your_free_trial_has_been_expired_your_email_is_not_verified")
							}
						};
					} else {
						finalResponse = {
							data: {
								status: STATUS_OTP_VALIDATION_ERROR,
								skip_without_flag: skipWithoutValidatopn,
								result: {
									user_type: userType,
									is_email_verified: resultData.is_email_verified,
								},
								message: res.__("front.user.your_email_is_not_verified")
							}
						};
					}
					return returnApiResult(req, res, finalResponse);
				} else {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							errors: "",
							message: res.__("system.something_going_wrong_please_try_again"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					token: "",
					refresh_token: "",
					token_life: JWT_CONFIG.tokenLife,
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End login()

	/**
	 * Function used to set sub user login data
	 * Uses async/await for all database queries and handles parallel operations with Promise.all if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.subUserLogin = async (req, res) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let finalResponse = {};

		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const loginUserEmailId = loginUserData.email ? loginUserData.email : "";
		const accountType = loginUserData.account_type ? loginUserData.account_type : NORMAL_USER_ACCOUNT_TYPE;

		const subUserEmailId = req.body.sub_user_email ? req.body.sub_user_email : "";
		const simplePassword = req.body.password ? req.body.password : "";

		// Validate user and required fields
		if (!userId || accountType != PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
		if (subUserEmailId === '' || loginUserEmailId === '' || simplePassword === '') {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const resultData = loginUserData;
		if (!resultData) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					token: "",
					refresh_token: "",
					token_life: JWT_CONFIG.tokenLife,
					message: res.__("front.sub_user.password_entered_incorrect")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const password = resultData.password ? resultData.password : "";

		try {
			// Compare password using bcrypt (async)
			const passwordMatch = await bcryptCheckPasswordCompare(simplePassword, password);
			if (!passwordMatch) {
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						result: {},
						token: "",
						refresh_token: "",
						token_life: JWT_CONFIG.tokenLife,
						message: res.__("front.user.please_enter_correct_email_or_password")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if user is suspended
			if (resultData.is_active != UN_SUSPEND) {
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						token: "",
						refresh_token: "",
						token_life: JWT_CONFIG.tokenLife,
						message: res.__("front.user.account_temporarily_disabled")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if user email is verified
			if (resultData.is_email_verified == VERIFIED) {
				// Prepare sub user query conditions
				const subUserConditions = {
					user_role_id: FRONT_ADMIN_ROLE_ID,
					is_deleted: NOT_DELETED,
					account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
					email: { $regex: '^' + subUserEmailId + '$', $options: 'i' }
				};
				const subUserOptions = { conditions: subUserConditions };

				// Get sub user details (async/await)
				const subUserResponse = await getUserDetailBySlug(req, res, subUserOptions);
				const subUserResultData = subUserResponse.result ? subUserResponse.result : "";

				if (!subUserResultData) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							token: "",
							refresh_token: "",
							token_life: JWT_CONFIG.tokenLife,
							message: res.__("front.sub_user.email_entered_incorrect")
						}
					};
					return returnApiResult(req, res, finalResponse);
				}

				// Check if sub user is suspended
				if (subUserResultData.is_active != UN_SUSPEND) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							token: "",
							refresh_token: "",
							token_life: JWT_CONFIG.tokenLife,
							message: res.__("front.sub_user.account_temporarily_disabled")
						}
					};
					return returnApiResult(req, res, finalResponse);
				}

				// Check if sub user is assigned to admin
				const loginUserAssignAdminSubUserArray = resultData.admin_sub_user_ids;
				const subUserCheckAdminAssignCheck = loginUserAssignAdminSubUserArray.some(friend => friend.equals(subUserResultData._id));

				if (!subUserCheckAdminAssignCheck) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							token: "",
							refresh_token: "",
							token_life: JWT_CONFIG.tokenLife,
							message: res.__("front.sub_user.sub_user_not_assign_administrate", subUserEmailId)
						}
					};
					return returnApiResult(req, res, finalResponse);
				}

				// Check if sub user email is verified
				if (subUserResultData.is_email_verified == VERIFIED) {
					// Save user login logs (async)
					await Registration.saveLoginLogs(req, res, subUserResultData);

					// Prepare JWT user payload
					const fullName = subUserResultData.full_name ? subUserResultData.full_name : "";
					const userEmail = subUserResultData.email ? subUserResultData.email : "";
					const slug = subUserResultData.slug ? subUserResultData.slug : "";
					const jwtUser = { email: userEmail, slug: slug };

					// Generate JWT token (async)
					const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

					tokenList['token'] = jwtResponse.token ? jwtResponse.token : "";
					tokenList['refresh_token'] = jwtResponse.refresh_token ? jwtResponse.refresh_token : "";
					subUserResultData['image_url'] = USERS_URL;

					const returnResponse = {
						data: {
							status: STATUS_SUCCESS,
							result: subUserResultData,
							image_url: USERS_URL,
							token: jwtResponse.token ? jwtResponse.token : "",
							refresh_token: jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
							token_life: jwtResponse.token_life ? jwtResponse.token_life : "",
							message: res.__("front.user.you_are_logged_in", fullName),
						}
					};
					return returnApiResult(req, res, returnResponse);
				} else {
					// Sub user email not verified
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							token: "",
							refresh_token: "",
							token_life: JWT_CONFIG.tokenLife,
							message: res.__("front.sub_user.your_email_is_not_verified", subUserEmailId)
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// User email not verified
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						result: {},
						token: "",
						refresh_token: "",
						token_life: JWT_CONFIG.tokenLife,
						message: res.__("front.user.your_email_is_not_verified")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					token: "",
					refresh_token: "",
					token_life: JWT_CONFIG.tokenLife,
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End subUserLogin()

	/**
	 * Function used for user registration
	 * Uses async/await for all database queries and handles parallel operations with Promise.all if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.userRegistration = async (req, res, next) => {
		let finalResponse = {};
		let accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;
		let welcomeAiPage = req.body.is_welcome ? req.body.is_welcome : "";
		let uniqueAibrowserId = req.body.unique_ai_browser_id ? req.body.unique_ai_browser_id : "";

		try {
			// Call user service function to add user
			const response = await userService.addUser(req, res, next);

			// Handle invalid access error
			if (response.status === STATUS_ERROR_INVALID_ACCESS) {
				let messages = response.message ? response.message : res.__("system.something_going_wrong_please_try_again");
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						message: messages
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle form validation errors
			if (response.status === STATUS_ERROR_FORM_VALIDATION) {
				let formErrors = response.errors ? response.errors : {};
				let errors;
				if (req.body.api_type === MOBILE_API_TYPE) {
					errors = stringValidationFromMobile(formErrors, req);
				} else {
					errors = parseValidationFrontApi(formErrors, req);
				}
				if (errors) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							errors: errors,
							message: errors
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			// Handle successful registration
			if (response.status === STATUS_SUCCESS) {
				let email = response.result.email ? response.result.email : "";
				let userSlug = response.result.slug ? response.result.slug : "";
				let firstName = response.result.firstName ? response.result.firstName : "";
				let fullName = response.result.fullName ? response.result.fullName : "";
				let lastInsertId = response.result.lastInsertId ? response.result.lastInsertId : "";

				// If business account, save business details and send welcome email
				if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
					req.body.default_name_of_the_business = firstName ? firstName : userSlug;
					await savePublicBussinessUserDetails(req, res, lastInsertId);

					let homePageOption = {
						email: email,
						first_name: firstName,
						user_slug: userSlug
					};
					await getStartedHomePageSendEmail(req, res, homePageOption);
				}

				// (Commented: No need to send verification link email to new sign up for any user)
				// if (email !== "") {
				// 	let loginUserData = {
				// 		email: email,
				// 		full_name: fullName
				// 	};
				// 	await userVerifyLinkSendUrlAccourding(req, res, loginUserData);
				// }

				// Prepare user detail query
				let conditions = {
					slug: userSlug,
					user_role_id: FRONT_ADMIN_ROLE_ID
				};
				let userOptions = { conditions };

				// Get user details by slug/email
				const userResponse = await getUserDetailBySlug(req, res, userOptions);
				let resultData = userResponse.result ? userResponse.result : "";

				if (!resultData) {
					// Send error response if user not found
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							result: {},
							token: "",
							refresh_token: "",
							token_life: JWT_CONFIG.tokenLife,
							message: res.__("front.user.email_password_entered_incorrect")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					// If business account, generate lead form and update user
					if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
						let optionLeads = {
							user_id: newObjectIdDefault(lastInsertId),
							title: res.locals.settings["Lead.enter_campaign_title"],
							description: res.locals.settings["Lead.description"],
							text_to_display: res.locals.settings["Lead.enter_the_title_to_display_with_this_form"],
							display_url_description: res.locals.settings["Lead.enter_text_to_display_with_the_url"],
							signin_option: SIGNIN_OPTION_NO,
							signup_fields: SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
							button_name: res.locals.settings["Lead.submit_button_title"],
							custom_thank_you_message: res.locals.settings["Lead.custom_thank_you_message"],
							custom_thank_you_title: res.locals.settings["Lead.custom_thank_you_title"],
							mandatory_options: SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
							message_box_title: [],
							type_dropdown_title: [],
							message_field_count: 0,
							dropdown_field_count: 0,
							form_title: res.locals.settings["Lead.form_title"],
							notify_email: [],
							image: "",
							graphic_type: "",
							is_default: DEFAULT_ONE,
						};

						// Save lead capture form and update user with lead id
						const saveLeadResponseId = await saveLeadCaptureForm(req, res, optionLeads);
						const users = db.collection(TABLE_USERS);
						await users.updateOne(
							{ _id: newObjectIdDefault(lastInsertId) },
							{ $set: { lead_forms_id: newObjectIdDefault(saveLeadResponseId) } }
						);

						// Save Excel lead capture form (no need to await if not required)
						saveExcelLeadCaptureForm(req, res, lastInsertId);
					}

					const jwtUser = {
						email: email,
						slug: userSlug,
					};

					resultData["user_id"] = lastInsertId;
					resultData["user_email"] = email;
					resultData["validate_string"] = email;

					// Check if OTP can be skipped after a few days
					let nextDataAfterOtPVerification = resultData.created ? new Date(resultData.created) : "";
					let skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

					// Save public business information if uniqueAibrowserId is present
					if (uniqueAibrowserId !== "") {
						let options = {
							user_id: lastInsertId,
							unique_ai_browser_id: uniqueAibrowserId
						};
						await updateUserPublicInformation(req, res, options);
					}

					// Generate JWT token and update data vault in parallel
					const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

					// Update data vault asynchronously (not blocking response)
					setImmediate(async () => {
						await updateDataVault(req, res, { unique_browser_id: uniqueAibrowserId, user_id: lastInsertId });
					});

					// Send success response
					finalResponse = {
						data: {
							status: STATUS_SUCCESS,
							skip_without_flag: skipWithoutValidatopn,
							errors: "",
							token: jwtResponse.token ? jwtResponse.token : "",
							refresh_token: jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
							token_life: jwtResponse.token_life ? jwtResponse.token_life : "",
							result: resultData,
							message: res.__("front.user.user_registered_successfully_message")
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					token: "",
					refresh_token: "",
					token_life: JWT_CONFIG.tokenLife,
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End userRegistration()

	/**
	 * Function used for OTP verification
	 * Uses async/await for all database queries and handles parallel operations with Promise.all if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.verifyOTP = async (req, res) => {
		let validateString = req.body.validate_string ? req.body.validate_string.toLowerCase() : '';
		let page = req.body.page ? req.body.page : "";
		let otp = req.body.otp ? Number(req.body.otp) : "";

		let finalResponse = {};

		// Validate required fields
		if (validateString === '' || page === "" || otp === "") {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Prepare query to find user by email and role
			const match = {
				'email': validateString,
				'user_role_id': FRONT_ADMIN_ROLE_ID
			};

			const users = db.collection(TABLE_USERS);

			// Find user by email and role
			const result = await users.findOne(match);

			if (!result) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR_INVALID_ACCESS,
						message: res.__("front.user.invalid_user")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let errMessageArray = [];
			// Check OTP based on page type
			if (page == FORGOT_PASSWORD_PAGE_TYPE) {
				if (otp != result.forgot_password_opt_code) {
					errMessageArray.push({ 'param': 'otp', 'msg': res.__("front.user.incorrect_otp_message") });
				}
			} else {
				if (otp != result.email_otp) {
					errMessageArray.push({ 'param': 'otp', 'msg': res.__("front.user.incorrect_otp_message") });
				}
			}

			// If OTP is incorrect, send error response
			if (errMessageArray.length > 0) {
				let newerrors;
				if ((req.body.api_type) == MOBILE_API_TYPE) {
					newerrors = stringValidationFromMobile(errMessageArray, req);
				} else {
					newerrors = parseValidationFrontApi(errMessageArray, req);
				}

				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: newerrors,
						message: newerrors,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare update data based on page type
			let updateData = {};
			if (page == VERIFY_ACCOUNT_PAGE_TYPE) {
				updateData = {
					'modified': getUtcDate(),
					'is_email_verified': ACTIVE,
					'validate_string': "",
					'email_otp': "",
				};
			} else if (page == FORGOT_PASSWORD_PAGE_TYPE) {
				updateData = {
					'modified': getUtcDate(),
					'forgot_password_opt_code': "",
				};
			}

			let userId = result._id ? result._id : MONGO_ID;

			let conditions = {
				'slug': result.slug,
				'user_role_id': FRONT_ADMIN_ROLE_ID
			};

			// Set options data for get user details
			let userOptions = {
				conditions: conditions,
			};

			// Get user details by slug
			const response = await getUserDetailBySlug(req, res, userOptions);

			if (!response || !response.result) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update user document to blank OTP and set verified if needed
			await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			// Prepare user data for JWT and email
			let userEmail = response.result.email ? response.result.email : "";
			let slug = response.result.slug ? response.result.slug : "";
			let fullName = response.result.full_name ? response.result.full_name : "";

			// Set options for send email after verify message
			let emailOptions = {
				to: userEmail,
				action: "verifiy_account_after_successfull_message",
				rep_array: [DEAR_HI_CONSTANT, fullName]
			};

			// Send verification email (async, not blocking)
			sendMail(req, res, emailOptions);

			const jwtUser = {
				"email": userEmail,
				"slug": slug,
			};
			let resultData = response.result ? response.result : {};

			// Run segment lead reward and JWT token generation in parallel
			await sendSegmentLeadRewardFromLogs(req, res, resultData);

			const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

			let returnResponse = {
				'data': {
					status: STATUS_SUCCESS,
					validate_string: validateString,
					result: resultData,
					image_path: USERS_URL,
					token: jwtResponse.token ? jwtResponse.token : "",
					refresh_token: jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
					token_life: jwtResponse.token_life ? jwtResponse.token_life : "",
					message: res.__("front.user.you_are_successfully_verify_account", fullName),
				}
			};
			return returnApiResult(req, res, returnResponse);

		} catch (error) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: "",
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End verifyOTP()

	/**
	 * Function used for resending OTP
	 * Uses async/await for all database queries and handles errors with try/catch.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next
	 * @returns json response
	 */
	this.resendOtp = async (req, res, next) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let page = req.body.page ? req.body.page : "";
		let otpFor = req.body.otp_for ? req.body.otp_for : OTP_FOR_EMAIL;
		let validateString = req.body.validate_string ? req.body.validate_string : "";
		let skipVerifyOtp = req.body.skip_verify_otp ? true : false;

		let finalResponse = {};

		// Validate required field
		if (!validateString) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR_INVALID_ACCESS,
					errors: "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Set user query conditions
		let userConditions = {
			user_role_id: FRONT_ADMIN_ROLE_ID,
			is_deleted: NOT_DELETED
		};

		if (page === FORGOT_PASSWORD_PAGE_TYPE || page === VERIFY_ACCOUNT_PAGE_TYPE) {
			userConditions["email"] = validateString;
		} else {
			// userId is not defined in the original code, so this branch may not be used
			userConditions["_id"] = newObjectIdDefault(userId);
		}

		let options = {
			conditions: userConditions,
		};

		try {
			// Get user details using async/await
			const response = await Registration.getUserData(req, res, options);

			if (response.status !== STATUS_SUCCESS || !response.result) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR_INVALID_ACCESS,
						errors: "",
						message: res.__("front.reset.this_user_does_not_exists"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			let result = response.result ? response.result : {};

			// Generate OTP asynchronously
			const otp = await getRandomOTP();

			// Prepare update data based on page and otpFor
			let updateData = {};
			if (page === VERIFY_ACCOUNT_PAGE_TYPE) {
				if (otpFor === OTP_FOR_MOBILE) {
					updateData = {
						'mobile_verification_code': otp,
					};
				} else if (otpFor === OTP_FOR_EMAIL) {
					updateData = {
						'email_otp': otp,
					};
				}
			} else if (page === FORGOT_PASSWORD_PAGE_TYPE) {
				updateData = {
					'forgot_password_opt_code': otp
				};
			}

			// Update OTP in the database
			const users = db.collection(TABLE_USERS);
			await users.updateOne(
				{ _id: newObjectIdDefault(result._id) },
				{ $set: updateData }
			);

			let successMessage = "";
			// Send email if required
			if (page === FORGOT_PASSWORD_PAGE_TYPE || otpFor === OTP_FOR_EMAIL) {
				const name = result.full_name ? result.full_name : '';
				const email = result.email ? result.email : '';
				const otpCode = otp;

				// Set options for sending email
				let emailOptions = {
					to: email,
					action: skipVerifyOtp ? "front_email_verify_otp" : "resend_otp",
					rep_array: [DEAR_HI_CONSTANT, name, otpCode]
				};
				// Send email asynchronously (not blocking)
				sendMail(req, res, emailOptions);
				successMessage = res.__("front.user.forgot_password_email_sent_successfully");
			}

			// Send success response
			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					OTP: otp,
					message: successMessage,
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: error.message || "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End resendOtp()

	/**
	 * Function used for forgot password recovery
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.forgotPassword = async (req, res) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let finalResponse = {};

		const optionType = req.body.type ? req.body.type : FORGOT_EMAIL_OPTION;
		const forgetEmail = req.body.email ? req.body.email.toLowerCase() : "";
		let match = {};

		// Set query conditions based on option type
		if (optionType === FORGOT_EMAIL_OPTION) {
			match = {
				is_deleted: NOT_DELETED,
				email: forgetEmail,
			};
		} else if (optionType === FORGOT_MOBILE_OPTION) {
			match = {
				is_deleted: NOT_DELETED,
				mobile_number: forgetEmail,
			};
		}

		const validateString = forgetEmail;
		const users = db.collection(TABLE_USERS);

		try {
			// Find user by email or mobile number
			const result = await users.findOne(match);

			if (result && Object.keys(result).length > 0) {
				// Generate OTP asynchronously
				const otp_code = await getRandomOTP();

				// Update user's forgot_password_opt_code in the database
				await users.updateOne({ _id: newObjectIdDefault(result._id) }, { $set: { forgot_password_opt_code: otp_code } });

				let successMessage = "";
				// Send email if option type is email
				if (optionType === FORGOT_EMAIL_OPTION) {
					const name = result.full_name ? result.full_name : '';
					const email = result.email ? result.email : '';

					// Set options for sending email
					const emailOptions = {
						to: email,
						action: "forgot_password_email",
						rep_array: [DEAR_HI_CONSTANT, name, otp_code]
					};

					// Send email asynchronously (not blocking response)
					sendMail(req, res, emailOptions);

					successMessage = res.__("front.user.forgot_password_email_sent_successfully");
				}

				// Send success response
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						otp_code: otp_code,
						validate_string: validateString,
						message: successMessage,
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Send error response if user not found
				finalResponse = {
					data: {
						status: STATUS_ERROR,
						email_mobile_data: forgetEmail,
						validate_string: validateString,
						message: res.__("front.user.forgot_password_account_not_exist")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End forgotPassword()

	/**
	 * Function used for reset password
	 * Uses async/await for all database queries and handles errors with try/catch.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.resetPassword = async (req, res, next) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const validateString = req.body.validate_string ? req.body.validate_string : "";
		const otp = req.body.otp ? Number(req.body.otp) : "";
		const password = req.body.password ? req.body.password : "";

		let finalResponse = {};

		// Validate required fields
		if (validateString === "") {
			finalResponse = {
				status: STATUS_ERROR_INVALID_ACCESS,
				message: res.__("front.system.something_going_wrong_please_try_again")
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare user query conditions
		const conditions = {
			user_role_id: FRONT_ADMIN_ROLE_ID,
			forgot_password_opt_code: otp,
			is_deleted: NOT_DELETED,
			email: validateString
		};

		const options = {
			conditions: conditions,
			fields: { _id: 1 }
		};

		try {
			// Get user details by conditions
			const response = await Registration.getUserData(req, res, options);

			if (response.status === STATUS_ERROR) {
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						message: res.__("front.user.incorrect_otp_message")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const result = response.result;
			const resultId = result && result._id ? result._id : "";

			// Generate bcrypt password hash
			const newPassword = await bcryptPasswordGenerate(password);

			// Update user password and clear forgot password fields
			const users = db.collection(TABLE_USERS);
			await users.updateOne(
				{ _id: newObjectIdDefault(resultId) },
				{
					$set: {
						password: newPassword,
						modified: getUtcDate()
					},
					$unset: {
						forgot_password_validate_string: 1,
						forgot_password_opt_code: 1
					}
				}
			);

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					message: res.__("user.your_password_has_been_reset_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End resetPassword()

	/**
	 * Function used to edit user manage profile
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.editUserManageProfile = async (req, res, next) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let finalResponse = {};

		try {
			// Call user service function to edit user profile
			const response = await userService.editUser(req, res, next);

			// Handle invalid access error
			if (response.status === STATUS_ERROR_INVALID_ACCESS) {
				let messages = response.message ? response.message : res.__("system.something_going_wrong_please_try_again");
				finalResponse = {
					data: {
						status: STATUS_ERROR_INVALID_ACCESS,
						message: messages
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle form validation errors
			if (response.status === STATUS_ERROR_FORM_VALIDATION) {
				let formErrors = response.errors ? response.errors : {};
				let errors;
				if (req.body.api_type === MOBILE_API_TYPE) {
					errors = stringValidationFromMobile(formErrors, req);
				} else {
					errors = parseValidationFrontApi(formErrors, req);
				}
				if (errors) {
					finalResponse = {
						data: {
							status: STATUS_ERROR,
							errors: errors,
							message: errors
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			// Handle successful profile update
			if (response.status === STATUS_SUCCESS) {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: "",
						errors: "",
						message: res.__("front.user.profile_has_been_updated_successfully"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle any other unexpected status
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					errors: "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					errors: error.message || "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editUserManageProfile()

	/**
	 * Function used to get user data
	 * Uses async/await for all database queries and handles image appending if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} options 
	 * @returns {Promise<Object>} json response
	 */
	this.getUserData = async (req, res, options) => {
		try {
			// Prepare query conditions
			const conditions = options && options.conditions ? options.conditions : {};

			if (!conditions) {
				// Send error response if conditions are missing
				return {
					status: STATUS_ERROR,
					options: options,
					req: req,
					message: res.__("system.something_going_wrong_please_try_again")
				};
			}

			// Get user details from database using async/await
			const users = db.collection(TABLE_USERS);
			const result = await users.findOne(conditions);

			if (!result) {
				// Send error response if user not found
				return {
					status: STATUS_ERROR,
					result: false,
					options: options,
				};
			}

			// If user does not have a profile image, return result directly
			if (!result["profile_image"]) {
				return {
					status: STATUS_SUCCESS,
					result: result,
					options: options,
				};
			}

			// Prepare options for appending image with full path
			const imageOptions = {
				file_url: USERS_URL,
				file_path: USERS_FILE_PATH,
				result: [result],
				database_field: "profile_image"
			};

			// Append image with full path using async/await
			const fileResponse = await appendFileExistData(imageOptions);

			return {
				status: STATUS_SUCCESS,
				result: (fileResponse && fileResponse.result && fileResponse.result[0]) ? fileResponse.result[0] : {},
				options: options,
			};
		} catch (error) {
			// Handle any unexpected errors
			return {
				status: STATUS_ERROR,
				options: options,
				message: res.__("system.something_going_wrong_please_try_again")
			};
		}
	}; // end getUserData()

	/**
	 * Function used to get user profile details
	 * Uses async/await for all database queries.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.getUserDetail = async (req, res) => {
		// Extract slug and default timezone from request body
		let slug = req.body.slug ? req.body.slug : '';
		let defaultTimezone = req.body.default_timezone ? req.body.default_timezone : "";

		let finalResponse = {};

		// Validate required slug parameter
		if (!slug) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'errors': "",
					'message': res.__("front.system.invalid_access"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Prepare query conditions for user lookup
		let conditions = {
			slug: slug
		};

		// Set options data for get user details
		let userOptions = {
			conditions: conditions,
		};

		try {
			// Get user details by slug/email using async/await
			const response = await getUserDetailBySlug(req, res, userOptions);

			if (response && response.result) {
				// Optionally remove sensitive fields if needed
				// delete response.result.password;
				response.result['image_url'] = USERS_URL;
			}
			let userResultData = (response && response.result) ? response.result : {};

			// Verify OTP email after a few (7) days (free few day trial after OTP verification user)
			let nextDataAfterOtPVerification = userResultData.created ? new Date(userResultData.created) : "";
			let skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

			// If true, case after logout because 7 days expired and email not verified
			userResultData['is_verifed_before_or_after_seven_days'] = (skipWithoutValidatopn === false && userResultData['is_email_verified'] == NOT_VERIFIED) ? true : false;

			// Set timezone for IP wise
			userResultData['default_timezone'] = defaultTimezone;
			userResultData['current_timezone'] = (userResultData && userResultData.current_timezone) ? userResultData.current_timezone : defaultTimezone;

			finalResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': userResultData,
					'image_url': USERS_URL,
					'message': 'user data',
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'errors': error.message || "",
					'message': res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end getUserDetail

	/**
	 * Function used to edit user profile image
	 * @param {*} req 
	 * @param {*} res 
	 * @returns json response
	 */
	this.editUserProfileImage = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};

		// Check for valid userId
		if (userId == '') {
			finalResponse = {
				'data': {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("api.global.parameter_missing")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let oldimage = req.body.old_image ? req.body.old_image : "";
		let image = (req.files && req.files.image) ? req.files.image : "";

		let imageMessageArray = [];
		if (!req.files || !req.files.image) {
			imageMessageArray.push({ 'param': 'image', 'msg': res.__("front.user.please_select_image") });
		}

		// Validate image input
		if (imageMessageArray.length > 0) {
			let errors;
			if (req.body.api_type == MOBILE_API_TYPE) {
				errors = stringValidationFromMobile(imageMessageArray, req);
			} else {
				errors = parseValidationFrontApi(imageMessageArray, req);
			}
			if (errors) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: errors,
						message: errors,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		}

		// Set image options for upload
		let options = {
			'image': image,
			'filePath': USERS_FILE_PATH,
			'oldPath': oldimage
		};

		try {
			// Move uploaded file using async/await
			const imageresponse = await moveUploadedFile(req, res, options);

			if (imageresponse.status == STATUS_ERROR) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare update data for user profile image
			let updateData = {
				profile_image: imageresponse.fileName ? imageresponse.fileName : "",
				modified: getUtcDate()
			};
			const users = db.collection(TABLE_USERS);

			// Update user data in database using async/await
			const updateResult = await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			if (!updateResult || updateResult.modifiedCount === 0) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: [],
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare conditions to get updated user details
			let conditions = {
				slug: loginUserData.slug
			};
			let userOptions = {
				conditions: conditions,
			};

			// Get updated user details using async/await
			const response = await getUserDetailBySlug(req, res, userOptions);

			if (response && response.result) {
				response.result['image_url'] = USERS_URL;
			}

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					result: response.result,
					image_url: USERS_URL,
					errors: "",
					message: res.__("front.users.profile_image_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: [],
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End editUserProfileImage();

	/**
	 * Function used to change user password
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @returns json response
	 */
	this.changeUserPassword = async (req, res, next) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let slug = req.body.slug ? req.body.slug : "";
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		const users = db.collection(TABLE_USERS);

		let finalResponse = {};

		// Validate required parameters
		if (slug === '' || userId === '') {
			finalResponse = {
				'data': {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("api.global.parameter_missing")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let password = req.body.password ? req.body.password : "";
		let oldPassword = req.body.old_password ? req.body.old_password : "";

		try {
			// Find user by slug and role
			const user = await users.findOne({ is_deleted: NOT_DELETED, slug: slug, user_role_id: FRONT_ADMIN_ROLE_ID }, { projection: { _id: 1, email: 1, password: 1 } });

			if (!user) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check if old password is provided
			if (!oldPassword) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Compare old password with stored hash
			const passwordMatch = await bcryptCheckPasswordCompare(oldPassword, user.password);

			if (!passwordMatch) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("admin.user_profile.old_password_you_entered_did_not_matched")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Generate new bcrypt password hash
			const bcryptPassword = await bcryptPasswordGenerate(password);

			// Update user's password and modified date
			const updateResult = await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{
					$set: {
						password: bcryptPassword,
						modified: getUtcDate()
					}
				});

			if (updateResult && updateResult.modifiedCount > 0) {
				// Send success response
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.user.password_changed_successfully")
					}
				};
			} else {
				// Send error response if update failed
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End changeUserPassword()

	/**
	 * Function used for social user login
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @return json response
	 */
	this.socialUserLogin = async (req, res, next) => {
		// Sanitize incoming data
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		// Extract and validate required fields
		const provider = req.body.provider || "";
		const socialId = req.body.id || "";
		const userEmail = req.body.email ? req.body.email.toLowerCase() : "";
		const apiType = req.body.api_type || "";
		const accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;
		const uniqueAibrowserId = req.body.unique_ai_browser_id || "";

		const users = db.collection(TABLE_USERS);

		// Prepare search conditions based on provider
		let conditions = [];
		if (provider === PROVIDER_GOOGLE) {
			conditions = [
				{ 'google_social_id': socialId },
				{ 'email': userEmail }
			];
		}
		if (provider === PROVIDER_FACEBOOK) {
			conditions = [
				{ 'fb_social_id': socialId },
				{ 'email': userEmail }
			];
		}
		if (provider === PROVIDER_MICROSOFT) {
			conditions = [
				{ 'microsoft_social_id': socialId },
				{ 'email': userEmail }
			];
		}

		let andOptionCondition = [
			{ 'is_deleted': NOT_DELETED }
		];

		// Special condition for business user registration
		if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE && uniqueAibrowserId !== "") {
			andOptionCondition = [
				{ 'is_deleted': NOT_DELETED },
				{ 'account_type': PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE }
			];
		}

		// Validate required parameters
		if (conditions.length > 0 && userEmail !== '' && apiType !== '' && provider !== '') {
			try {
				// Find user by social id or email
				const result = await users.findOne({
					$and: andOptionCondition,
					$or: conditions
				});

				if (result) {
					// Check if user is active
					if (result.is_active === UN_SUSPEND) {
						// Check OTP verification or skip logic
						const nextDataAfterOtPVerification = result.created ? new Date(result.created) : "";
						const skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

						if (result.is_email_verified === VERIFIED || skipWithoutValidatopn === true) {
							// Update social id for the user based on provider
							const updateFields = {};
							if (provider === PROVIDER_GOOGLE) updateFields.google_social_id = socialId;
							if (provider === PROVIDER_FACEBOOK) updateFields.fb_social_id = socialId;
							if (provider === PROVIDER_MICROSOFT) updateFields.microsoft_social_id = socialId;

							if (Object.keys(updateFields).length > 0) {
								await users.updateOne(
									{ _id: newObjectIdDefault(result._id) },
									{ $set: updateFields }
								);
							}

							// Prepare JWT user payload
							const userId = result._id || "";
							const userEmailDb = result.email || "";
							const slug = result.slug || "";
							const fullName = result.full_name || "";
							const jwtUser = { email: userEmailDb, slug };

							// Send segment lead reward and generate JWT token in parallel
							await sendSegmentLeadRewardFromLogs(req, res, result);

							const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

							tokenList['token'] = jwtResponse.token || "";
							tokenList['refresh_token'] = jwtResponse.refresh_token || "";

							// Check for multiple accounts
							result['is_multiple_account'] = false;
							if (userId) {
								const countMultipleUser = await multipleUserExistsCheck(userId);
								result['is_multiple_account'] = countMultipleUser;
							}

							// Generate main user encode login URL
							const assignEmail = result.email || "";
							const assignSlug = result.slug || "";
							const assignUuid = result.UUID || "";
							const mainUserEncodeLoginUrl = generateLoginUrl(assignUuid, assignEmail, assignSlug);

							// Send success response
							const returnResponse = {
								'data': {
									'status': STATUS_SUCCESS,
									'main_user_encode_login_url': mainUserEncodeLoginUrl,
									'result': result,
									'userExist': ACTIVE,
									'image_url': USERS_URL,
									'token': jwtResponse.token || "",
									'refresh_token': jwtResponse.refresh_token || "",
									'token_life': jwtResponse.token_life || "",
									'message': res.__("front.user.you_are_logged_in", fullName),
								}
							};
							return returnApiResult(req, res, returnResponse);
						} else {
							// Email not verified, send verification link
							const userType = result.user_type || '';
							const loginUserData = {
								'email': result.email || "",
								'full_name': result.full_name || ""
							};
							const responseVerify = await userVerifyLinkSendUrlAccourding(req, res, loginUserData);

							if (responseVerify === STATUS_SUCCESS) {
								let message = "";
								if (apiType === WEP_API_TYPE) {
									message = res.__("front.user.your_free_trial_has_been_expired_your_email_is_not_verified");
								} else {
									message = res.__("front.user.your_email_is_not_verified");
								}
								const finalResponse = {
									'data': {
										'status': STATUS_OTP_VALIDATION_ERROR,
										'skip_without_flag': skipWithoutValidatopn,
										'result': {
											'user_type': userType,
											'is_email_verified': result.is_email_verified,
										},
										'message': message
									}
								};
								return returnApiResult(req, res, finalResponse);
							} else {
								const finalResponse = {
									'data': {
										status: STATUS_ERROR,
										errors: "",
										message: res.__("system.something_going_wrong_please_try_again"),
									}
								};
								return returnApiResult(req, res, finalResponse);
							}
						}
					} else {
						// User is not active
						const datap = {
							'data': {
								status: STATUS_ERROR,
								userExist: DEACTIVE,
								result: "",
								message: res.__("front.user.account_temporarily_disabled")
							}
						};
						return returnApiResult(req, res, datap);
					}
				} else {
					// No user found, check for MSN mobile login email format
					const mailFormatvalid = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,3}$/i.test(userEmail);
					if ((provider === PROVIDER_GOOGLE || provider === PROVIDER_MICROSOFT) && !mailFormatvalid) {
						const datap = {
							'data': {
								status: MSN_MOBILE_WISE_LOGIN,
								userExist: DEACTIVE,
								result: "",
								message: res.__("admin.user.please_enter_valid_email_address")
							}
						};
						return returnApiResult(req, res, datap);
					} else {
						// New user social login, call user service to add user
						req.body['social_id'] = socialId;
						req.body['request_from'] = REQUEST_FROM_SOCIAL;

						const response = await userService.addUser(req, res, next);

						// Handle invalid access error
						if (response.status === STATUS_ERROR_INVALID_ACCESS) {
							const messages = response.message || res.__("system.something_going_wrong_please_try_again");
							const finalResponse = {
								'data': {
									status: STATUS_ERROR_INVALID_ACCESS,
									message: messages
								}
							};
							return returnApiResult(req, res, finalResponse);
						}

						// Handle form validation errors
						if (response.status === STATUS_ERROR_FORM_VALIDATION) {
							const formErrors = response.errors || {};
							let errors;
							if ((req.body.api_type) === MOBILE_API_TYPE) {
								errors = stringValidationFromMobile(formErrors, req);
							} else {
								errors = parseValidationFrontApi(formErrors, req);
							}
							if (errors) {
								const finalResponse = {
									'data': {
										status: STATUS_ERROR,
										errors: errors,
										message: errors
									}
								};
								return returnApiResult(req, res, finalResponse);
							}
						}

						// Handle successful user creation
						if (response.status === STATUS_SUCCESS) {
							const lastInsertId = response.result.lastInsertId || "";
							const email = response.result.email || "";
							const fullName = response.result.fullName || "";
							const slug = response.result.slug || "";

							// Prepare options to get user details
							const userOptions = {
								conditions: { slug }
							};

							// Save public business information if required
							if (lastInsertId && accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE && uniqueAibrowserId !== "") {
								const options = {
									"user_id": lastInsertId,
									"unique_ai_browser_id": uniqueAibrowserId
								};
								await updateUserPublicInformation(req, res, options);
							}

							// Get user details by slug
							const userResponse = await getUserDetailBySlug(req, res, userOptions);
							const resultData = userResponse.result || {};

							const jwtUser = { email, slug };

							// Send segment lead reward and generate JWT token in parallel
							await sendSegmentLeadRewardFromLogs(req, res, resultData);

							const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

							tokenList['token'] = jwtResponse.token || "";
							tokenList['refresh_token'] = jwtResponse.refresh_token || "";

							// Check for multiple accounts
							const registrationUserId = (response && response.result && response.result._id) ? response.result._id : "";
							resultData['is_multiple_account'] = false;
							if (registrationUserId) {
								const countMultipleUser = await multipleUserExistsCheck(registrationUserId);
								resultData['is_multiple_account'] = countMultipleUser;
							}

							// Send success response
							const returnResponse = {
								'data': {
									status: STATUS_SUCCESS,
									result: resultData,
									userExist: ACTIVE,
									image_url: USERS_URL,
									token: jwtResponse.token || "",
									refresh_token: jwtResponse.refresh_token || "",
									token_life: jwtResponse.token_life || "",
									message: res.__("front.social_user.you_are_logged_in", fullName),
								}
							};
							return returnApiResult(req, res, returnResponse);
						}
					}
				}
			} catch (error) {
				// Handle unexpected errors
				const finalResponse = {
					'data': {
						status: STATUS_ERROR,
						userExist: DEACTIVE,
						message: res.__("system.something_going_wrong_please_try_again"),
						result: "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} else {
			// Missing required parameters
			const datap = {
				'data': {
					status: STATUS_ERROR,
					userExist: DEACTIVE,
					message: res.__("api.global.parameter_missing"),
					result: "",
				}
			};
			return returnApiResult(req, res, datap);
		}
	}; // End socialUserLogin()

	/**
	 * Function used to change social user password
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @return json response
	 */
	this.changeSocialUserPassword = async (req, res, next) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let slug = req.body.slug ? req.body.slug : "";
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";
		const users = db.collection(TABLE_USERS);

		let finalResponse = {};

		// Validate required parameters
		if (slug === '' || userId === '') {
			finalResponse = {
				'data': {
					status: STATUS_ERROR_INVALID_ACCESS,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let password = req.body.password ? req.body.password : "";

		try {
			// Find user by slug and role
			const userPasswordResult = await users.findOne(
				{
					is_deleted: NOT_DELETED,
					slug: slug,
					user_role_id: FRONT_ADMIN_ROLE_ID,
				},
				{ projection: { _id: 1, email: 1, password: 1 } }
			);

			if (userPasswordResult) {
				// If password already exists, do not allow direct password change
				if (userPasswordResult.password && userPasswordResult.password !== '') {
					finalResponse = {
						'data': {
							status: STATUS_ERROR,
							result: {},
							message: res.__("admin.user_profile.old_password_you_entered_did_not_matched")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					// Generate new bcrypt password hash
					const bcryptPassword = await bcryptPasswordGenerate(password);

					// Update user's password and modified date
					const updateResult = await users.updateOne(
						{ _id: newObjectIdDefault(userId) },
						{
							$set: {
								password: bcryptPassword,
								modified: getUtcDate()
							}
						}
					);

					if (updateResult && updateResult.modifiedCount > 0) {
						// Send success response
						finalResponse = {
							'data': {
								status: STATUS_SUCCESS,
								result: {},
								message: res.__("front.user.password_changed_successfully")
							}
						};
					} else {
						// Send error response if update failed
						finalResponse = {
							'data': {
								status: STATUS_ERROR,
								result: {},
								message: res.__("front.system.something_going_wrong_please_try_again")
							}
						};
					}
					return returnApiResult(req, res, finalResponse);
				}
			} else {
				// User not found
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						result: {},
						message: res.__("front.system.something_going_wrong_please_try_again")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End changeSocialUserPassword()

	/**
	 * Function used to save login logs
	 * Uses async/await for all database queries and handles parallel operations with Promise.all.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} options 
	 * @return json response
	 */
	this.saveLoginLogs = async (req, res, options) => {
		try {
			// Extract user and device details from request/options
			const userId = options._id ? options._id : "";
			const deviceType = req.body.device_type ? req.body.device_type : "";
			const deviceToken = req.body.device_token ? req.body.device_token : "";
			const deviceId = req.body.device_id ? req.body.device_id : "";

			// Return error if userId is missing
			if (!userId) {
				return {
					status: STATUS_ERROR,
					options: options,
					message: res.__("system.something_going_wrong_please_try_again")
				};
			}

			const users = db.collection(TABLE_USERS);
			const userLogins = db.collection(TABLE_TABLE_USER_LOGINS);

			// Prepare update data for user
			let userUpdatedData = {
				$set: {
					last_login: getUtcDate(),
					modified: getUtcDate(),
				}
			};

			// Add device details if available
			if (deviceType && deviceToken) {
				userUpdatedData.$set.device_details = [{
					device_type: deviceType.toLowerCase(),
					device_token: deviceToken,
					device_id: deviceId,
				}];
			}

			// Prepare login log document
			const loginLogDoc = {
				user_id: newObjectIdDefault(userId),
				device_type: deviceType,
				device_token: deviceToken,
				device_id: deviceId,
				created: getUtcDate(),
			};

			// Run user update and login log insert in parallel using Promise.all
			const [userUpdateResult, loginLogResult] = await Promise.all([
				// Update user's last login and device details
				users.updateOne(
					{ _id: newObjectIdDefault(userId) },
					userUpdatedData
				),
				// Insert login log entry
				userLogins.insertOne(loginLogDoc)
			]);

			// Check if both operations succeeded
			if (
				userUpdateResult && userUpdateResult.modifiedCount >= 0 &&
				loginLogResult && loginLogResult.insertedId
			) {
				return {
					status: STATUS_SUCCESS,
					options: options
				};
			} else {
				return {
					status: STATUS_ERROR,
					options: options,
					message: res.__("system.something_going_wrong_please_try_again")
				};
			}
		} catch (e) {
			// Handle any unexpected errors
			return {
				status: STATUS_ERROR,
				options: options,
				message: res.__("system.something_going_wrong_please_try_again")
			};
		}
	}

	/**
	 * Function used to regenerate JWT using async/await.
	 * Handles JWT refresh token verification and new token generation.
	 * All queries and async operations are handled with async/await and proper error handling.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json response
	 */
	this.regenerateJWT = async (req, res) => {
		const utf8 = require('utf8');
		const btoa = require("btoa");
		const atob = require("atob");
		let finalResponse = {};

		try {
			// Extract and decrypt the refresh token from the Authorization header
			const authorization = req.headers.authorization ? decryptJwtToken(req.headers.authorization) : '';

			// If no authorization token is present, return error response
			if (!authorization) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("front.system.invalid_access"),
					}
				};
				const result = JSON.stringify(finalResponse.data);
				const myJSON = utf8.encode(result);
				return res.send({
					response: btoa(myJSON)
				});
			}

			// Decode JWT payload to extract user data
			const oldToken = authorization;
			const tokenParts = oldToken.split('.');
			if (tokenParts.length < 2) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("front.system.invalid_access"),
					}
				};
				const result = JSON.stringify(finalResponse.data);
				const myJSON = utf8.encode(result);
				return res.send({
					response: btoa(myJSON)
				});
			}
			const tknData = tokenParts[1];
			let decodedtknData = atob(tknData);
			decodedtknData = JSON.parse(decodedtknData);

			const jwtUser = {
				email: decodedtknData['email'],
				slug: decodedtknData['slug']
			};

			// Prepare JWT authentication options
			const jwtOption = {
				token: req.headers.authorization ? req.headers.authorization : "",
				secretKey: JWT_CONFIG.refreshTokenSecret,
				slug: decodedtknData['slug'],
			};

			// Verify refresh token using async/await
			const responseData = await JWTAuthentication(req, res, jwtOption);

			if (responseData.status !== STATUS_SUCCESS) {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: res.__("admin.system.invalid_access"),
					}
				};
				const result = JSON.stringify(finalResponse.data);
				const myJSON = utf8.encode(result);
				return res.send({
					response: btoa(myJSON)
				});
			}

			// Generate new JWT and refresh token in parallel if needed (here, just one call)
			const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

			finalResponse = {
				'data': {
					status: STATUS_SUCCESS,
					errors: "",
					token: jwtResponse.token ? jwtResponse.token : "",
					refresh_token: jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
					token_life: jwtResponse.token_life ? jwtResponse.token_life : "",
				}
			};
			const result = JSON.stringify(finalResponse.data);
			const myJSON = utf8.encode(result);
			return res.send({
				response: btoa(myJSON)
			});
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: "",
					message: res.__("front.system.invalid_access"),
				}
			};
			const result = JSON.stringify(finalResponse.data);
			const myJSON = utf8.encode(result);
			return res.send({
				response: btoa(myJSON)
			});
		}
	}; // End regenerateJWT

	/**
	 * Function used to make user login via admin
	 * Uses async/await for all database queries and handles parallel operations with Promise.all if needed.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json response
	 */
	this.loginByAdmin = async (req, res) => {
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
		let finalResponse = {};
		let loginCrediantials = req.body.login_crediantials ? req.body.login_crediantials : "";

		// This is used to send the makeRequest function
		let defaultTimezone = req.body.default_timezone ? req.body.default_timezone : "";

		if (!loginCrediantials) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: "",
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Decode and split credentials data
			let loginData = atob(loginCrediantials);
			const myArray = loginData.split("#@!");

			// Separate credentials data
			let uuid = myArray[0] ? myArray[0] : [];
			let email = myArray[1] ? myArray[1] : [];
			let slug = myArray[2] ? myArray[2] : [];

			// Login condition
			let conditions = {
				"UUID": uuid,
				"email": { $regex: '^' + email + '$', $options: 'i' },
				"slug": { $regex: '^' + slug + '$', $options: 'i' }
			};

			let adminOptions = {
				conditions: conditions,
			};

			// Get user details using async/await
			const userResponse = await getUserDetailBySlug(req, res, adminOptions);
			let resultData = userResponse.result ? userResponse.result : "";

			if (!resultData) {
				// Send error response if user not found
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'token': "",
						'refresh_token': "",
						'token_life': JWT_CONFIG.tokenLife,
						'message': res.__("front.user.email_password_entered_incorrect")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Verify OTP email after a few (7) days (free few day trial after OTP verification user)
			let nextDataAfterOtPVerification = resultData.created ? new Date(resultData.created) : "";
			let skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

			// Set timezone for IP wise
			resultData['default_timezone'] = defaultTimezone;
			resultData['current_timezone'] = (resultData && resultData.current_timezone) ? resultData.current_timezone : defaultTimezone;

			if (resultData.is_email_verified == VERIFIED || skipWithoutValidatopn === true) {
				// Start JWT Authentication

				// Save user login logs and send segment leads rewards in parallel
				await Registration.saveLoginLogs(req, res, resultData);
				await sendSegmentLeadRewardFromLogs(req, res, resultData);

				let fullName = resultData.full_name ? resultData.full_name : "";
				let userEmail = resultData.email ? resultData.email : "";
				let slug = resultData.slug ? resultData.slug : "";
				let userId = resultData._id ? resultData._id : "";

				const jwtUser = {
					"email": userEmail,
					"slug": slug,
				};

				// Generate JWT token
				const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

				// Check if first insider poll is created
				let firstInsidersPollCheckDetails = LOGIN_INSIDER_NOT_CREATED;
				if (userId) {
					const polls = db.collection(TABLE_POLLS);
					const pollCheck = await polls.findOne({
						"user_id": newObjectIdDefault(userId),
						"first_ai_poll_generated": true,
						"type": POLL_AI_TYPE
					});
					firstInsidersPollCheckDetails = pollCheck ? LOGIN_INSIDER_CREATED : LOGIN_INSIDER_NOT_CREATED;
				}

				// Check for multiple accounts for user
				resultData['is_multiple_account'] = false;
				if (userId) {
					let countMultipleUser = await multipleUserExistsCheck(userId);
					resultData['is_multiple_account'] = countMultipleUser;
				}

				// Send success response
				let returnResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': resultData,
						'image_url': USERS_URL,
						'check_user_already_voted': userResponse.check_user_already_voted,
						'token': jwtResponse.token ? jwtResponse.token : "",
						'refresh_token': jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
						'token_life': jwtResponse.token_life ? jwtResponse.token_life : "",
						'first_insiders_poll_check': firstInsidersPollCheckDetails,
						'message': res.__("front.user.you_are_logged_in", fullName),
					}
				};
				return returnApiResult(req, res, returnResponse);

			} else if (resultData.is_email_verified == NOT_VERIFIED && skipWithoutValidatopn === false) {
				// Send verify email link if email is not verified and trial expired
				let loginUserData = {
					'email': resultData.email ? resultData.email : "",
					'full_name': resultData.full_name ? resultData.full_name : ""
				};
				const response = await userVerifyLinkSendUrlAccourding(req, res, loginUserData);
				if (response == STATUS_SUCCESS) {
					finalResponse = {
						'data': {
							'status': STATUS_OTP_VALIDATION_ERROR,
							'skip_without_flag': skipWithoutValidatopn,
							'result': {
								'is_email_verified': resultData.is_email_verified,
							},
							'message': res.__("front.user.your_free_trial_has_been_expired_your_email_is_not_verified")
						}
					};
					return returnApiResult(req, res, finalResponse);
				} else {
					finalResponse = {
						'data': {
							status: STATUS_ERROR,
							errors: "",
							message: res.__("system.something_going_wrong_please_try_again"),
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			} else if (resultData.is_active != UN_SUSPEND) {
				// Response if user deactivated by admin
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'token': "",
						'refresh_token': "",
						'token_life': JWT_CONFIG.tokenLife,
						'message': res.__("front.user.account_temporarily_disabled")
					}
				};
				return returnApiResult(req, res, finalResponse);
			} else {
				// Response if email is not verified
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'image_url': USERS_URL,
						'token': "",
						'refresh_token': "",
						'token_life': "",
						'message': res.__("front.user.your_email_is_not_verified")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: error.message || "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End loginByAdmin()

	/**
	 * Function used for third party user registration
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @return json response
	 */
	this.thirdPartyUserRegistration = async (req, res, next) => {
		let finalResponse = {};

		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		let email = req.body.email ? req.body.email : "";
		let firstName = req.body.first_name ? req.body.first_name : "";
		let lastName = req.body.last_name ? req.body.last_name : "";
		let mobile = req.body.mobile ? req.body.mobile : "";
		let password = req.body.password ? req.body.password : generatePassword();
		let accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;

		// Validate required parameters
		if (email === '' || password === '') {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': "",
					'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Prepare user data for registration
			let nameArray = email.split("@");
			req.body.first_name = firstName ? firstName : nameArray[0];
			req.body.last_name = lastName ? lastName : nameArray[0];
			req.body.request_from = ADMIN_API_THIRD_PARTY_TYPE;
			req.body.api_type = ADMIN_API_THIRD_PARTY_TYPE;
			req.body.password = password;
			req.body.mobile = mobile;

			// Call user service function to add user (async/await)
			const response = await userService.addUser(req, res, next);

			// Handle invalid access error
			if (response.status === STATUS_ERROR_INVALID_ACCESS) {
				let messages = response.message ? response.message : res.__("system.something_going_wrong_please_try_again");
				finalResponse = {
					'data': {
						status: STATUS_ERROR_INVALID_ACCESS,
						message: messages
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle form validation errors
			if (response.status === STATUS_ERROR_FORM_VALIDATION) {
				let formErrors = response.errors ? response.errors : {};
				let errors;
				if (req.body.api_type === MOBILE_API_TYPE) {
					errors = stringValidationFromMobile(formErrors, req);
				} else {
					errors = parseValidationFrontApi(formErrors, req);
				}
				if (errors) {
					finalResponse = {
						'data': {
							status: STATUS_ERROR,
							errors: errors,
							message: errors
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			// Handle successful registration
			if (response.status === STATUS_SUCCESS) {
				let email = response.result.email ? response.result.email : "";
				let userSlug = response.result.slug ? response.result.slug : "";
				let fullName = response.result.fullName ? response.result.fullName : "";
				let emailOtpCode = response.result.emailOtpCode ? response.result.emailOtpCode : "";
				let lastInsertId = response.result.lastInsertId ? response.result.lastInsertId : "";

				// Send verification email asynchronously (not blocking)
				if (email !== "") {
					let emailOptions = {
						to: email,
						action: "front_email_verify_otp",
						rep_array: [DEAR_HI_CONSTANT, fullName, emailOtpCode]
					};
					sendMail(req, res, emailOptions);
				}

				// Prepare conditions to get user details
				let conditions = {
					'slug': userSlug,
					'user_role_id': FRONT_ADMIN_ROLE_ID
				};
				let userOptions = {
					conditions: conditions,
				};

				// Get user details using async/await
				const userResponse = await getUserDetailBySlug(req, res, userOptions);

				let resultData = userResponse.result ? userResponse.result : "";

				if (!resultData) {
					finalResponse = {
						'data': {
							'status': STATUS_ERROR,
							'result': {},
							'message': res.__("front.user.email_password_entered_incorrect")
						}
					};
					return returnApiResult(req, res, finalResponse);
				}

				// Add additional fields to result
				resultData["user_id"] = lastInsertId;
				resultData["user_email"] = email;
				resultData["validate_string"] = email;
				resultData["p_key"] = password;

				// If business user, create lead form and update user in parallel
				if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
					let optionLeads = {
						'user_id': newObjectIdDefault(lastInsertId),
						'title': res.locals.settings["Lead.enter_campaign_title"],
						'description': res.locals.settings["Lead.description"],
						'text_to_display': res.locals.settings["Lead.enter_the_title_to_display_with_this_form"],
						'display_url_description': res.locals.settings["Lead.enter_text_to_display_with_the_url"],
						'signin_option': SIGNIN_OPTION_NO,
						'signup_fields': SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
						'button_name': res.locals.settings["Lead.submit_button_title"],
						'custom_thank_you_message': res.locals.settings["Lead.custom_thank_you_message"],
						'custom_thank_you_title': res.locals.settings["Lead.custom_thank_you_title"],
						'mandatory_options': SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
						'message_box_title': [],
						'type_dropdown_title': [],
						'message_field_count': 0,
						'dropdown_field_count': 0,
						'form_title': res.locals.settings["Lead.form_title"],
						'notify_email': [],
						'image': "",
						'graphic_type': "",
						'is_default': DEFAULT_ONE,
					};

					// Run lead form creation and excel lead capture in parallel
					const users = db.collection(TABLE_USERS);
					const [saveLeadResponseId] = await Promise.all([
						saveLeadCaptureForm(req, res, optionLeads),
						saveExcelLeadCaptureForm(req, res, lastInsertId)
					]);

					// Update lead_forms_id in user table if lead form was created
					if (saveLeadResponseId) {
						await users.updateOne(
							{ _id: newObjectIdDefault(lastInsertId) },
							{ '$set': { lead_forms_id: newObjectIdDefault(saveLeadResponseId) } }
						);
					}
				}

				// Send success response
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'result': resultData,
						'message': res.__("front.user.user_registered_successfully_message")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End thirdPartyUserRegistration()

	/**
	 * Function used for user registration via pocial bot
	 * Uses async/await for all database queries and handles parallel operations with Promise.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @return json response
	 */
	this.pocialBotUserRegistration = async (req, res, next) => {
		let finalResponse = {};
		try {
			// Sanitize input data to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const email = req.body.email ? req.body.email : "";
			const firstName = req.body.first_name ? req.body.first_name : "";
			const lastName = req.body.last_name ? req.body.last_name : "";
			const mobile = req.body.mobile ? req.body.mobile : "";
			const websiteUrl = req.body.website_url ? req.body.website_url : "";
			const nameOfTheBusiness = req.body.name_of_the_business ? req.body.name_of_the_business : "";
			const password = req.body.password ? req.body.password : "";
			const accountType = req.body.account_type ? Number(req.body.account_type) : PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;

			// Validate required parameters
			if (!email || !firstName || !lastName || !nameOfTheBusiness) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'is_user_exist': false,
						'result': {},
						'message': res.__("front.system.you_are_not_allowed_to_access_this_page"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Check for valid email format
			if (!isValidEmail(email)) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'result': {},
						'message': res.__("admin.user.please_enter_valid_email_address"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const users = db.collection(TABLE_USERS);

			// Check if user already exists by email (case-insensitive)
			const existingUser = await users.findOne(
				{ "email": { $regex: '^' + email + '$', $options: 'i' } },
				{ projection: { 'account_type': 1 } }
			);

			if (existingUser) {
				// User exists, return success with is_user_exist true
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'is_user_exist': true,
						'result': existingUser,
						'message': "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// If password is not provided, return is_user_exist false
			if (password === '') {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'is_user_exist': false,
						'result': {},
						'message': "",
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare user registration data
			req.body.first_name = firstName;
			req.body.last_name = lastName;
			req.body.request_from = AI_BOT_API_TYPE;
			req.body.password = password;
			req.body.mobile = mobile;
			req.body.account_type = accountType;
			req.body.website_url = websiteUrl;

			// Call user service function to add user (async/await)
			const response = await userService.addUser(req, res, next);

			// Handle invalid access error
			if (response.status === STATUS_ERROR_INVALID_ACCESS) {
				const messages = response.message ? response.message : res.__("front.system.something_going_wrong_please_try_again");
				finalResponse = {
					'data': {
						'status': STATUS_ERROR_INVALID_ACCESS,
						'is_user_exist': false,
						'message': messages
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Handle form validation errors
			if (response.status === STATUS_ERROR_FORM_VALIDATION) {
				const formErrors = response.errors ? response.errors : {};
				let errors;
				if (req.body.api_type === MOBILE_API_TYPE) {
					errors = stringValidationFromMobile(formErrors, req);
				} else {
					errors = parseValidationFrontApi(formErrors, req);
				}
				if (errors) {
					finalResponse = {
						'data': {
							'status': STATUS_ERROR,
							'errors': errors,
							'is_user_exist': false,
							'message': errors
						}
					};
					return returnApiResult(req, res, finalResponse);
				}
			}

			// Handle successful registration
			if (response.status === STATUS_SUCCESS) {
				const email = response.result.email ? response.result.email : "";
				const userSlug = response.result.slug ? response.result.slug : "";
				const fullName = response.result.fullName ? response.result.fullName : "";
				const lastInsertId = response.result.lastInsertId ? response.result.lastInsertId : "";

				// Send verification email if email is present
				if (email !== "") {
					const loginUserData = {
						'email': email,
						'full_name': fullName
					};
					await userVerifyLinkSendUrlAccourding(req, res, loginUserData);
				}

				// Prepare conditions and options to get user details
				const conditions = {
					'slug': userSlug,
					'user_role_id': FRONT_ADMIN_ROLE_ID
				};
				const userOptions = {
					conditions: conditions,
				};

				// Get user details using async/await
				const userResponse = await getUserDetailBySlug(req, res, userOptions);
				let resultData = userResponse.result ? userResponse.result : "";

				if (!resultData) {
					finalResponse = {
						'data': {
							'status': STATUS_ERROR,
							'result': {},
							'is_user_exist': false,
							'message': res.__("front.user.email_password_entered_incorrect")
						}
					};
					return returnApiResult(req, res, finalResponse);
				}

				resultData["user_id"] = lastInsertId;
				resultData["user_email"] = email;
				resultData["validate_string"] = email;
				resultData["p_key"] = password;

				// If business account, create lead form and excel lead capture in parallel
				if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
					const optionLeads = {
						'user_id': newObjectIdDefault(lastInsertId),
						'title': res.locals.settings["Lead.enter_campaign_title"],
						'description': res.locals.settings["Lead.description"],
						'text_to_display': res.locals.settings["Lead.enter_the_title_to_display_with_this_form"],
						'display_url_description': res.locals.settings["Lead.enter_text_to_display_with_the_url"],
						'signin_option': SIGNIN_OPTION_NO,
						'signup_fields': SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
						'button_name': res.locals.settings["Lead.submit_button_title"],
						'custom_thank_you_message': res.locals.settings["Lead.custom_thank_you_message"],
						'custom_thank_you_title': res.locals.settings["Lead.custom_thank_you_title"],
						'mandatory_options': SIGNUP_FIELD_DEFAULT_USER_ASSIGN,
						'message_box_title': [],
						'type_dropdown_title': [],
						'message_field_count': 0,
						'dropdown_field_count': 0,
						'form_title': res.locals.settings["Lead.form_title"],
						'notify_email': [],
						'image': "",
						'graphic_type': "",
						'is_default': DEFAULT_ONE,
					};

					// Run lead form creation and excel lead capture in parallel
					const [saveLeadResponseId] = await Promise.all([
						saveLeadCaptureForm(req, res, optionLeads),
						saveExcelLeadCaptureForm(req, res, lastInsertId)
					]);

					// Update lead_forms_id in user table if lead form was created
					if (saveLeadResponseId) {
						await users.updateOne(
							{ _id: newObjectIdDefault(lastInsertId) },
							{ '$set': { lead_forms_id: newObjectIdDefault(saveLeadResponseId) } }
						);
					}
				}

				const jwtUser = {
					"email": email,
					"slug": userSlug,
				};

				// Calculate skip flag for OTP verification
				const nextDataAfterOtPVerification = resultData.created ? new Date(resultData.created) : "";
				const skipWithoutValidatopn = skipOtpBeforeFewDays(nextDataAfterOtPVerification);

				// Generate JWT token
				const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'is_user_exist': false,
						'skip_without_flag': skipWithoutValidatopn,
						'errors': "",
						'token': jwtResponse.token ? jwtResponse.token : "",
						'refresh_token': jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
						'token_life': jwtResponse.token_life ? jwtResponse.token_life : "",
						'result': resultData,
						'message': res.__("front.user.user_registered_successfully_message")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Fallback error
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'result': {},
					'message': error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End pocialBotUserRegistration()

	/**
	 * Function used to check valid email regular expressions
	 * @param {*} email 
	 * @return
	 */
	isValidEmail = (email) => {
		// Regular expression for a valid email address
		const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;

		// Test the email against the regular expression
		return emailRegex.test(email);
	} //End isValidEmail();

	/**
	 * Function used to check if the forgot password OTP is valid.
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @param {*} next 
	 * @return
	 */
	this.forgotPasswordOtpValidCheck = async (req, res, next) => {
		// Sanitize input data to prevent XSS
		req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

		const validateString = req.body.validate_string ? req.body.validate_string : "";
		const otp = req.body.otp ? Number(req.body.otp) : "";

		let finalResponse = {};

		// Check if validate_string is provided
		if (validateString === "") {
			finalResponse = {
				'status': STATUS_ERROR_INVALID_ACCESS,
				'result': {},
				'message': res.__("front.system.something_going_wrong_please_try_again")
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Set user conditions for OTP validation
			let conditions = {
				'user_role_id': FRONT_ADMIN_ROLE_ID,
				'forgot_password_opt_code': otp,
				'is_deleted': NOT_DELETED
			};

			if (validateString) {
				conditions["email"] = validateString;
			}

			// Set options for getting user details
			let options = {
				'conditions': conditions,
				'fields': { _id: 1 }
			};

			// Get user details using async/await
			const response = await Registration.getUserData(req, res, options);

			// Check response and send appropriate result
			if (response.status === STATUS_ERROR) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR_INVALID_ACCESS,
						'message': res.__("front.user.incorrect_otp_message")
					}
				};
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
						'message': res.__("front.user.correct_otp_message")
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR_INVALID_ACCESS,
					'message': res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End forgotPasswordOtpValidCheck()

	/**
	 * Function used to check if a user exists by email.
	 * Uses async/await for database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @returns JSON response indicating if user exists
	 */
	this.userExistCheck = async (req, res) => {
		let finalResponse = {};
		try {
			// Sanitize input data to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			const email = req.body.email ? req.body.email : "";

			// Check for valid email format
			if (!isValidEmail(email)) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Prepare options for user lookup
			const optionsConditions = {
				"email": email,
				"user_id": "",
			};

			// Query user by email using async/await
			const user = await findUserByEmail(req, res, optionsConditions);

			// Check query result and respond accordingly
			if (user && user.status === STATUS_SUCCESS) {
				finalResponse = {
					'data': {
						'status': STATUS_SUCCESS,
					}
				};
			} else {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
					}
				};
			}
			return returnApiResult(req, res, finalResponse);

		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End userExistCheck()

	/**
	 * Function used to check if the verification link has been sent.
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json response
	 */
	this.verifyLinkSendUrlAccording = async (req, res) => {
		let finalResponse = {};

		// Extract user data from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const email = loginUserData.email ? (loginUserData.email).toLowerCase() : "";
		const fullName = loginUserData.full_name ? loginUserData.full_name : "";

		// Validate required parameters
		if (!userId || !email || !fullName) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Call function to send verification email link using async/await
			const response = await userVerifyLinkSendUrlAccourding(req, res, loginUserData);

			if (response === STATUS_SUCCESS) {
				finalResponse = {
					'data': {
						status: STATUS_SUCCESS,
						result: {},
						message: res.__("front.registration.email_verification_link_has_been_sent_to_your_registered_email_address"),
					}
				};
			} else {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						errors: "",
						message: res.__("system.something_going_wrong_please_try_again"),
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					errors: error.message || "",
					message: res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End verifyLinkSendUrlAccording()

	/**
	 * Function used to verify user account through URL using async/await.
	 * Handles all database queries with async/await and proper error handling.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json response
	 */
	this.verifyUserAccountUrlAccording = async (req, res) => {
		let finalResponse = {};
		const emailVerifyValidateString = req.body.email_verify_validate_string ? req.body.email_verify_validate_string : "";

		// Validate required parameter
		if (!emailVerifyValidateString) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'message': res.__("front.registration.email_verify_validate_string_not_found"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			const users = db.collection(TABLE_USERS);

			// Find user by email_verify_validate_string
			const user = await users.findOne({
				'email_verify_validate_string': emailVerifyValidateString
			});

			if (!user) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': res.__("front.user.invalid_link_url_accourding")
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			const userId = user._id ? user._id : MONGO_ID;
			const conditions = {
				'slug': user.slug,
				'user_role_id': FRONT_ADMIN_ROLE_ID
			};
			const userOptions = { conditions };

			// Get user details by slug
			const response = await getUserDetailBySlug(req, res, userOptions);

			if (!response || !response.result) {
				finalResponse = {
					'data': {
						'status': STATUS_ERROR,
						'message': res.__("system.something_going_wrong_please_try_again"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}

			// Update user to set email as verified and clear validation string
			await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: { 'email_verify_validate_string': '', 'is_email_verified': ACTIVE } }
			);

			// Prepare user info for further actions
			const userEmail = response.result.email ? response.result.email : "";
			const slug = response.result.slug ? response.result.slug : "";
			const fullName = response.result.full_name ? response.result.full_name : "";

			// Set options for sending email after successful verification
			const emailOptions = {
				'to': userEmail,
				'action': "verifiy_account_after_successfull_message",
				'rep_array': [DEAR_HI_CONSTANT, fullName]
			};

			// Send verification success email (no need to await, fire and forget)
			sendMail(req, res, emailOptions);

			const jwtUser = {
				"email": userEmail,
				"slug": slug,
			};

			const resultData = response.result;

			// Run segment lead reward and JWT token generation in sequence
			await sendSegmentLeadRewardFromLogs(req, res, resultData);

			const jwtResponse = await jwtTokenGenerate(req, res, jwtUser);

			const returnResponse = {
				'data': {
					'status': STATUS_SUCCESS,
					'result': resultData,
					'image_path': USERS_URL,
					'token': jwtResponse.token ? jwtResponse.token : "",
					'refresh_token': jwtResponse.refresh_token ? jwtResponse.refresh_token : "",
					'token_life': jwtResponse.token_life ? jwtResponse.token_life : "",
					'message': res.__("front.user.you_are_successfully_verify_account", fullName),
				}
			};
			return returnApiResult(req, res, returnResponse);

		} catch (error) {
			finalResponse = {
				'data': {
					'status': STATUS_ERROR,
					'message': error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End verifyUserAccountUrlAccording()


	/** Remove all https and website url only domain found */
	function getWebsiteRegex(websiteUrl) {
		let domain = websiteUrl
			.replace(/^https?:\/\//, '') // remove http/https
			.replace(/^www\./, '')       // remove www
			.replace(/\/$/, '');         // remove trailing slash

		return new RegExp(`^(https?:\/\/)?(www\.)?${domain}\/?$`, 'i');
	}

	/**
	 * Function used to check if a user already exists by email, website URL, or Instagram details.
	 * Uses async/await for all database queries and handles errors gracefully.
	 * @param {*} req 
	 * @param {*} res 
	 * @return json response
	 */
	this.checkAlreadyUserExists = async (req, res) => {
		let finalResponse = {};

		// Extract and sanitize input parameters
		let email = req.body.email ? req.body.email.toLowerCase() : "";
		let websiteUrl = req.body.website_url ? req.body.website_url : "";
		let instagramId = req.body.instagram_id ? req.body.instagram_id : "";
		let instagramUrl = req.body.instagram_url ? req.body.instagram_url : "";
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!email || (!websiteUrl && !instagramId && !instagramUrl)) {
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		try {
			// Build query condition
			let condition = {
				$and: [{ 'email': email }]
			};

			// Add website URL condition if provided
			if (websiteUrl) {
				// Ensure protocol is present in the URL
				let protocolSite = await checkProtocol(websiteUrl);
				websiteUrl = protocolSite ? protocolSite : websiteUrl;
				condition.$and.push({ 'public_business_informaton.website_url': { $regex: websiteUrl, $options: 'i' } });
			}

			// Add Instagram ID condition if provided
			if (instagramId) {
				condition.$and.push(
					{ 'instagram_user_details': { $exists: true } },
					{ 'instagram_user_details.id': instagramId }
				);
			}

			// Add Instagram URL condition if provided
			if (instagramUrl) {
				instagramUrl = formatInstagramUrl(instagramUrl);
				condition.$and.push({ 'instagram_url': { $regex: instagramUrl, $options: 'i' } });
			}

			// Query the database to check if a user already exists
			const alreadyCheckUser = await users.countDocuments(condition);

			// Send response based on query result
			if (alreadyCheckUser > 0) {
				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						"already_exists_account": true,
						"message": res.__("front.user.account_already_created"),
					}
				};
			} else {
				finalResponse = {
					'data': {
						"status": STATUS_SUCCESS,
						"already_exists_account": false,
						"message": "",
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle any unexpected errors
			finalResponse = {
				'data': {
					"status": STATUS_ERROR,
					"message": error.message || res.__("system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	};

}
module.exports = new Registration();