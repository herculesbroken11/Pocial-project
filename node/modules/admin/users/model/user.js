const crypto = require("crypto");
const async = require("async");

const userService = require(WEBSITE_SERVICES_FOLDER_PATH + 'user_service');

function User() {

	UserModel = this;

	/**
	 * Function for login
	 *
	 * @param req 	As	Request Data
	 * @param res 	As 	Response Data
	 * @param next 	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.login = async (req, res, next) => {
		try {
			// If POST request, handle login via form submission
			if (isPost(req)) {
				// Sanitize input data to prevent XSS
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

				const username = req.body.username ? req.body.username : "";
				const simplePassword = req.body.password ? req.body.password : "";

				// Prepare login options
				const loginOptions = {
					user_name: username,
					password: simplePassword
				};

				// Call login function using async/await
				const responseData = await adminLoginFunction(req, res, next, loginOptions);

				if (responseData.status !== STATUS_SUCCESS) {
					// Send error response if login failed
					return res.send({
						status: STATUS_ERROR,
						message: responseData.errors ? responseData.errors : [],
					});
				}

				// Send success response if login succeeded
				return res.send({
					redirect_url: WEBSITE_ADMIN_URL + "dashboard",
					status: STATUS_SUCCESS,
				});
			} else {
				// If not POST, handle login via cookie (if allowed)
				if (ALLOWED_ADMIN_TO_SET_COOKIE !== ACTIVE) {
					return res.render("login");
				}

				// Retrieve admin login cookie
				const cookie = req.cookies.adminLoggedIn;
				if (!cookie) {
					return res.render("login");
				}

				// Decrypt username and password from cookie
				let decryptedUsername = "";
				let decryptedPassword = "";
				try {
					const username = cookie.username ? cookie.username : "";
					const password = cookie.password ? cookie.password : "";

					const decipherUser = crypto.createDecipher("aes256", "username");
					decryptedUsername = decipherUser.update(username, "hex", "utf8") + decipherUser.final("utf8");

					const decipherPassword = crypto.createDecipher("aes256", "password");
					decryptedPassword = decipherPassword.update(password, "hex", "utf8") + decipherPassword.final("utf8");
				} catch (decryptErr) {
					// If decryption fails, clear cookie and render login
					res.clearCookie("adminLoggedIn");
					return res.render("login");
				}

				// Prepare login options from decrypted values
				const loginOptions = {
					user_name: decryptedUsername,
					password: decryptedPassword
				};

				// Call login function using async/await
				const responseData = await adminLoginFunction(req, res, next, loginOptions);

				if (responseData.status !== STATUS_SUCCESS) {
					// If login fails, clear cookie and render login
					res.clearCookie("adminLoggedIn");
					return res.render("login");
				}

				// Redirect to dashboard on successful login
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		} catch (error) {
			// Log error and pass to next middleware
			console.error("Error in admin login:", error);
			return next(error);
		}
	};

	/**
	 * Function for admin login
	 *
	 * @param req      As Request Data
	 * @param res      As Response Data
	 * @param next     As Callback argument to the middleware function
	 * @param options  As Object that has user name and password
	 *
	 * @return json
	 */
	adminLoginFunction = async (req, res, next, options) => {
		try {
			// Extract username and password from options
			const username = options.user_name ? options.user_name : "";
			const simplePassword = options.password ? options.password : "";
			const rememberMe = req.body.remember_me ? req.body.remember_me : false;

			// Get user details from database using async/await
			const users = db.collection(TABLE_USERS);
			const userQuery = {
				is_deleted: NOT_DELETED,
				email: { $regex: "^" + username + "$", $options: "i" },
				user_role_id: { $nin: [] }
			};
			const userProjection = {
				projection: {
					user_role_id: 1,
					first_name: 1,
					last_name: 1,
					full_name: 1,
					email: 1,
					password: 1,
					active: 1,
					created: 1,
					is_mobile_verified: 1,
					is_email_verified: 1,
					is_admin_approved: 1,
					is_profile_complete: 1,
					profile_staps: 1,
					company_name: 1
				}
			};

			const resultData = await users.findOne(userQuery, userProjection);

			// If user not found, send error response
			if (!resultData) {
				return {
					status: STATUS_ERROR,
					options: options,
					errors: [{ param: "password", msg: res.__("admin.user.please_enter_correct_email_or_password") }]
				};
			}

			// Compare password using async/await
			const password = resultData.password ? resultData.password : "";
			const passwordMatch = await bcryptCheckPasswordCompare(simplePassword, password);

			if (!passwordMatch) {
				return {
					status: STATUS_ERROR,
					options: options,
					errors: [{ param: "password", msg: res.__("admin.user.please_enter_correct_email_or_password") }]
				};
			}

			// Check if account is active
			if (resultData.active != ACTIVE) {
				return {
					status: STATUS_ERROR,
					options: options,
					errors: [{ param: "password", msg: res.__("admin.user.account_temporarily_disabled") }]
				};
			}

			// Check if email is verified
			if (resultData.is_email_verified != ACTIVE) {
				return {
					status: STATUS_ERROR,
					options: options,
					errors: [{ param: "password", msg: res.__("admin.user.your_email_verification_is_pending") }]
				};
			}

			// Check if mobile is verified
			if (resultData.is_mobile_verified != ACTIVE) {
				return {
					status: STATUS_ERROR,
					options: options,
					errors: [{ param: "password", msg: res.__("admin.user.your_mobile_verification_is_pending") }]
				};
			}

			// If user checked "remember me", set cookie if not already set
			if (rememberMe === true) {
				const cookie = req.cookies.adminLoggedIn;
				if (cookie === undefined) {
					// Encrypt username and password for cookie
					const userCipher = crypto.createCipher("aes256", "username");
					const encryptedUserName = userCipher.update(username, "utf8", "hex") + userCipher.final("hex");
					const passwordCipher = crypto.createCipher("aes256", "password");
					const encryptedPassword = passwordCipher.update(simplePassword, "utf8", "hex") + passwordCipher.final("hex");

					// Set a new cookie with encrypted credentials
					res.cookie(
						"adminLoggedIn",
						{ username: encryptedUserName, password: encryptedPassword },
						{ maxAge: ADMIN_LOGGED_IN_COOKIE_EXPIRE_TIME, httpOnly: true }
					);
				}
			}

			// Set user session
			req.session.user = resultData;

			// Send success response
			return {
				status: STATUS_SUCCESS,
				options: options,
				result: resultData
			};
		} catch (err) {
			// Log error and send error response
			console.error("Error in adminLoginFunction:", err);
			return {
				status: STATUS_ERROR,
				options: options,
				errors: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
			};
		}
	};

	/**
	 * Function to show the admin dashboard with aggregated statistics.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.dashboard = async (req, res, next) => {
		const users = db.collection(TABLE_USERS);
		const leadsSubscriber = db.collection(TABLE_SIGNUP_LEAD_FORMS);
		const polls = db.collection(TABLE_POLLS);

		let fromDate = req.params.from_date ? req.params.from_date : "";
		let toDate = req.params.to_date ? req.params.to_date : "";
		let dayWiseFilter = false;

		try {
			// Prepare user aggregation conditions and grouping
			let userConditions = {
				is_deleted: NOT_DELETED,
				user_role_id: { $in: [FRONT_ADMIN_ROLE_ID] }
			};
			let userGroupConditions = {
				year: { $substr: ["$created", 0, 4] },
				month: { $substr: ["$created", 5, 2] }
			};

			if (fromDate && toDate) {
				userConditions.created = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate)
				};
				const diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
				if (diffDate <= LIMITED_DAYS_DASHBOARD) {
					dayWiseFilter = true;
					userGroupConditions = {
						year: { $substr: ["$created", 0, 4] },
						month: { $substr: ["$created", 5, 2] },
						date: { $substr: ["$created", 8, 2] }
					};
				}
			}

			// Prepare overall user stats conditions
			let statsConditions = {
				is_deleted: NOT_DELETED,
				user_role_id: { $in: [FRONT_ADMIN_ROLE_ID] }
			};
			if (fromDate && toDate) {
				statsConditions.created = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate)
				};
			}

			// Prepare leads aggregation conditions and grouping
			let leadsConditions = { is_deleted: NOT_DELETED };
			if (fromDate && toDate) {
				leadsConditions.created = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate)
				};
			}
			let leadsResultConditions = { is_deleted: NOT_DELETED };
			let groupLeadsConditions = {
				year: { $substr: ["$created", 0, 4] },
				month: { $substr: ["$created", 5, 2] }
			};
			if (fromDate && toDate) {
				leadsResultConditions.created = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate)
				};
				const diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
				if (diffDate <= LIMITED_DAYS_DASHBOARD) {
					groupLeadsConditions = {
						year: { $substr: ["$created", 0, 4] },
						month: { $substr: ["$created", 5, 2] },
						date: { $substr: ["$created", 8, 2] }
					};
				}
			}

			// Prepare polls aggregation conditions and grouping
			let pollsStatusConditions = {};
			if (fromDate && toDate) {
				pollsStatusConditions.created = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate)
				};
			}
			let pollsResultConditions = {};
			let groupPollsConditions = {
				year: { $substr: ["$created", 0, 4] },
				month: { $substr: ["$created", 5, 2] }
			};
			if (fromDate && toDate) {
				pollsResultConditions.created = {
					$gte: newDate(fromDate),
					$lte: newDate(toDate)
				};
				const diffDate = getDifferenceBetweenTwoDatesInDays(toDate, fromDate);
				if (diffDate <= LIMITED_DAYS_DASHBOARD) {
					groupPollsConditions = {
						year: { $substr: ["$created", 0, 4] },
						month: { $substr: ["$created", 5, 2] },
						date: { $substr: ["$created", 8, 2] }
					};
				}
			}

			// Run all aggregation queries in parallel using Promise.all and async/await
			const [
				userResult,
				statsResult,
				leadsStatsResult,
				leadsResult,
				pollsStatsResult,
				pollsResult
			] = await Promise.all([
				// User statistics grouped by date
				users.aggregate([
					{ $match: userConditions },
					{
						$addFields: {
							created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } }
						}
					},
					{
						$group: {
							_id: userGroupConditions,
							total_users: {
								$sum: 1
							},
							total_basic_users: {
								$sum: {
									$cond: [
										{ $eq: ["$account_type", NORMAL_USER_ACCOUNT_TYPE] },
										1,
										0
									]
								}
							},
							total_verified_users: {
								$sum: {
									$cond: [
										{ $eq: ["$account_type", BUSSINESS_USER_ACCOUNT_TYPE] },
										1,
										0
									]
								}
							},
							total_business_users: {
								$sum: {
									$cond: [
										{ $eq: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
										1,
										0
									]
								}
							},
							total_suspended: {
								$sum: {
									$cond: [
										{ $eq: ["$is_active", SUSPEND] },
										1,
										0
									]
								}
							},
							total_unsuspended: {
								$sum: {
									$cond: [
										{ $eq: ["$is_active", UN_SUSPEND] },
										1,
										0
									]
								}
							},
							email_verify_users: {
								$sum: {
									$cond: [
										{ $eq: ["$is_email_verified", VERIFIED] },
										1,
										0
									]
								}
							},
							email_not_verify_users: {
								$sum: {
									$cond: [
										{ $eq: ["$is_email_verified", NOT_VERIFIED] },
										1,
										0
									]
								}
							}
						}
					},
					{ $sort: { _id: SORT_DESC } }
				]).toArray(),

				// Overall user statistics
				users.aggregate([
					{ $match: statsConditions },
					{
						$group: {
							_id: null,
							total_users: { $sum: 1 },
							total_suspended: {
								$sum: {
									$cond: [
										{ $eq: ["$is_active", SUSPEND] },
										1,
										0
									]
								}
							},
							total_unsuspended: {
								$sum: {
									$cond: [
										{ $eq: ["$is_active", UN_SUSPEND] },
										1,
										0
									]
								}
							},
							verified_users: {
								$sum: {
									$cond: [
										{ $eq: ["$account_type", BUSSINESS_USER_ACCOUNT_TYPE] },
										1,
										0
									]
								}
							},
							basic_users: {
								$sum: {
									$cond: [
										{ $eq: ["$account_type", NORMAL_USER_ACCOUNT_TYPE] },
										1,
										0
									]
								}
							},
							public_business_users: {
								$sum: {
									$cond: [
										{ $eq: ["$account_type", PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE] },
										1,
										0
									]
								}
							},
							email_verify_users: {
								$sum: {
									$cond: [
										{ $eq: ["$is_email_verified", VERIFIED] },
										1,
										0
									]
								}
							},
							email_not_verify_users: {
								$sum: {
									$cond: [
										{ $eq: ["$is_email_verified", NOT_VERIFIED] },
										1,
										0
									]
								}
							}
						}
					}
				]).toArray(),

				// Overall leads statistics
				leadsSubscriber.aggregate([
					{ $match: leadsConditions },
					{
						$group: {
							_id: null,
							total_leads: { $sum: 1 },
							total_prospective: {
								$sum: {
									$cond: [
										{ $eq: ["$stage_level", INTRODUCTION_LEVEL] },
										1,
										0
									]
								}
							},
							total_qualified: {
								$sum: {
									$cond: [
										{ $eq: ["$stage_level", GROWTH_LEVEL] },
										1,
										0
									]
								}
							},
							total_prime: {
								$sum: {
									$cond: [
										{ $eq: ["$stage_level", HOT_LEADS_LEVEL] },
										1,
										0
									]
								}
							}
						}
					}
				]).toArray(),

				// Leads statistics grouped by date
				leadsSubscriber.aggregate([
					{ $match: leadsResultConditions },
					{
						$addFields: {
							created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } }
						}
					},
					{
						$group: {
							_id: groupLeadsConditions,
							total_leads: { $sum: 1 },
							total_prospective: {
								$sum: {
									$cond: [
										{ $eq: ["$stage_level", INTRODUCTION_LEVEL] },
										1,
										0
									]
								}
							},
							total_qualified: {
								$sum: {
									$cond: [
										{ $eq: ["$stage_level", GROWTH_LEVEL] },
										1,
										0
									]
								}
							},
							total_prime: {
								$sum: {
									$cond: [
										{ $eq: ["$stage_level", HOT_LEADS_LEVEL] },
										1,
										0
									]
								}
							}
						}
					},
					{ $sort: { _id: SORT_DESC } }
				]).toArray(),

				// Overall polls statistics
				polls.aggregate([
					{ $match: pollsStatusConditions },
					{
						$group: {
							_id: null,
							total_polls: {
								$sum: {
									$cond: [
										{ $eq: ["$is_deleted", NOT_DELETED] },
										1,
										0
									]
								}
							},
							published_polls: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$is_deleted", NOT_DELETED] },
												{ $eq: ["$is_published", POLL_PUBLISHED] }
											]
										},
										1,
										0
									]
								}
							},
							draft_polls: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$is_deleted", NOT_DELETED] },
												{ $eq: ["$is_draft", POLL_DRAFT] }
											]
										},
										1,
										0
									]
								}
							},
							delete_polls: {
								$sum: {
									$cond: [
										{ $eq: ["$is_deleted", DELETED] },
										1,
										0
									]
								}
							}
						}
					}
				]).toArray(),

				// Polls statistics grouped by date
				polls.aggregate([
					{ $match: pollsResultConditions },
					{
						$addFields: {
							created: { $dateToString: { format: "%Y-%m-%d", date: "$created", timezone: DEFAULT_TIME_ZONE } }
						}
					},
					{
						$group: {
							_id: groupPollsConditions,
							total_polls: {
								$sum: {
									$cond: [
										{ $eq: ["$is_deleted", NOT_DELETED] },
										1,
										0
									]
								}
							},
							published_polls: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$is_deleted", NOT_DELETED] },
												{ $eq: ["$is_published", POLL_PUBLISHED] }
											]
										},
										1,
										0
									]
								}
							},
							draft_polls: {
								$sum: {
									$cond: [
										{
											$and: [
												{ $eq: ["$is_deleted", NOT_DELETED] },
												{ $eq: ["$is_draft", POLL_DRAFT] }
											]
										},
										1,
										0
									]
								}
							},
							delete_polls: {
								$sum: {
									$cond: [
										{ $eq: ["$is_deleted", DELETED] },
										1,
										0
									]
								}
							}
						}
					},
					{ $sort: { _id: SORT_DESC } }
				]).toArray()
			]);

			// Render the dashboard page with all aggregated statistics
			req.breadcrumbs(BREADCRUMBS["admin/dashboard"]);
			res.render("dashboard", {
				stats: (statsResult && statsResult[0]) ? statsResult[0] : {},
				result: userResult || [],
				leads_stats: (leadsStatsResult && leadsStatsResult[0]) ? leadsStatsResult[0] : {},
				leads_result: leadsResult || [],
				polls_stats: (pollsStatsResult && pollsStatsResult[0]) ? pollsStatsResult[0] : {},
				polls_result: pollsResult || [],
				user_role_id: req.session.user._id,
				fromDate: fromDate,
				toDate: toDate,
				day_wise_filter: dayWiseFilter
			});
		} catch (err) {
			// Pass any errors to the next middleware
			return next(err);
		}
	}; // End dashboard()

	/**
	 * Async function to edit admin's profile details.
	 * Uses async/await for all DB queries and handles errors gracefully.
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.editProfile = async (req, res, next) => {
		const users = db.collection(TABLE_USERS);

		if (isPost(req)) {
			// Sanitize input data to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const password = req.body.password ? req.body.password : "";
			const oldPassword = req.body.old_password ? req.body.old_password : "";
			const fullName = req.body.full_name ? req.body.full_name : "";
			const companyName = req.body.company_name ? req.body.company_name : "";
			const email = req.body.email ? req.body.email.toLowerCase() : "";

			try {
				// Step 1: Check if email exists and fetch user
				const emailResult = await users.findOne(
					{
						is_deleted: NOT_DELETED,
						email: { $regex: "^" + email + "$", $options: "i" }
					},
					{ projection: { _id: 1, email: 1, password: 1 } }
				);

				// If user with email exists, proceed
				if (emailResult) {
					// If old password is provided, verify it before updating password
					if (oldPassword !== "") {
						try {
							// Step 2: Compare old password
							const passwordMatch = await bcryptCheckPasswordCompare(oldPassword, emailResult.password);
							if (!passwordMatch) {
								return res.send({
									status: STATUS_ERROR,
									message: [{ param: "old_password", msg: res.__("admin.user_profile.old_password_you_entered_did_not_matched") }]
								});
							}

							// Step 3: Hash new password and update profile
							const bcryptPassword = await bcryptPasswordGenerate(password);
							const insertData = {
								full_name: fullName,
								company_name: companyName,
								password: bcryptPassword,
								modified: getUtcDate()
							};
							await updateAdminProfileAsync(insertData, req, res);
						} catch (err) {
							return res.send({
								status: STATUS_ERROR,
								message: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
							});
						}
					} else {
						// Step 4: Update profile without password change
						const insertData = {
							full_name: fullName,
							company_name: companyName,
							modified: getUtcDate()
						};
						await updateAdminProfileAsync(insertData, req, res);
					}
				} else {
					// Email does not exist or is already used
					return res.send({
						status: STATUS_ERROR,
						message: [{ param: "email", msg: res.__("admin.user.your_email_id_is_already_exist") }]
					});
				}
			} catch (err) {
				// Handle any DB or logic errors
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: ADMIN_GLOBAL_ERROR, msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		} else {
			// GET request: Render the edit profile page with current user data
			try {
				const userId = req.session.user ? req.session.user._id : "";
				// Step 1: Fetch user details
				const result = await users.findOne(
					{ _id: newObjectIdDefault(userId) },
					{ projection: { _id: 1, full_name: 1, email: 1, mobile_number: 1, user_role_id: 1, company_name: 1 } }
				);

				// Step 2: Render the edit profile page
				req.breadcrumbs(BREADCRUMBS["admin/user_profile/edit"]);
				return res.render("edit_profile", { result: result });
			} catch (err) {
				// Handle any DB or logic errors
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}
		}
	};

	/**
	 * Async helper function to update admin's profile details in the database.
	 * Uses async/await for DB update and updates session data.
	 * @param {Object} insertData - Data to update
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	const updateAdminProfileAsync = async (insertData, req, res) => {
		try {
			const users = db.collection(TABLE_USERS);
			const id = req.session.user ? req.session.user._id : "";
			const fullName = req.body.full_name ? req.body.full_name : "";
			const companyName = req.body.company_name ? req.body.company_name : "";
			const mobileNumber = req.body.mobile_number ? req.body.mobile_number : "";

			// Step 1: Update admin details in DB using async/await
			await users.updateOne(
				{ _id: newObjectIdDefault(id) },
				{ $set: insertData }
			);

			// Step 2: Update session data after successful DB update
			req.session.user.full_name = fullName;
			req.session.user.company_name = companyName;
			req.session.user.mobile_number = mobileNumber;

			// Step 3: Send success response to client
			req.flash(STATUS_SUCCESS, res.__("admin.user.your_profile_has_been_updated_successfully"));
			return res.send({
				status: STATUS_SUCCESS,
				redirect_url: WEBSITE_ADMIN_URL + "dashboard",
				message: res.__("admin.user.your_profile_has_been_updated_successfully")
			});
		} catch (err) {
			// Handle any DB or logic errors and send error response
			return res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	};

	/**
	 * Async function to update admin's profile details in the database.
	 * Uses async/await for DB update and updates session data.
	 * @param {Object} insertData - Data to update
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	const updateAdminProfile = async (insertData, req, res) => {
		try {
			// Extract user ID and updated fields from request/session
			const id = req.session.user ? req.session.user._id : "";
			const fullName = req.body.full_name ? req.body.full_name : "";
			const companyName = req.body.company_name ? req.body.company_name : "";
			const mobileNumber = req.body.mobile_number ? req.body.mobile_number : "";

			// Get users collection
			const users = db.collection(TABLE_USERS);

			// Step 1: Update admin details in DB using async/await
			await users.updateOne(
				{ _id: newObjectIdDefault(id) },
				{ $set: insertData }
			);

			// Step 2: Update session data after successful DB update
			req.session.user.full_name = fullName;
			req.session.user.company_name = companyName;
			req.session.user.mobile_number = mobileNumber;

			// Step 3: Send success response to client
			req.flash(STATUS_SUCCESS, res.__("admin.user.your_profile_has_been_updated_successfully"));
			return res.send({
				status: STATUS_SUCCESS,
				redirect_url: WEBSITE_ADMIN_URL + "dashboard",
				message: res.__("admin.user.your_profile_has_been_updated_successfully")
			});
		} catch (err) {
			// Handle any DB or logic errors and send error response
			return res.send({
				status: STATUS_ERROR,
				message: res.__("admin.system.something_going_wrong_please_try_again")
			});
		}
	};

	/**
	 * Async function to handle forgot password recovery.
	 * Uses async/await for all DB queries and provides clear responses.
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @return render/json
	 */
	this.forgotPassword = async (req, res) => {
		if (isPost(req)) {
			try {
				// Sanitize input data to prevent XSS
				req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
				const email = req.body.email ? req.body.email.toLowerCase() : "";

				const users = db.collection(TABLE_USERS);

				// Step 1: Find user by email using async/await
				const result = await users.findOne(
					{ email: email },
					{ projection: { _id: 1, full_name: 1 } }
				);

				if (result) {
					// Step 2: Generate validate string and update user record
					const currentTimeStamp = new Date().getTime();
					const validate_string = crypto.createHash("md5").update(currentTimeStamp + req.body.email).digest("hex");

					const updateResult = await users.updateOne(
						{ _id: newObjectIdDefault(result._id) },
						{
							$set: {
								forgot_password_validate_string: validate_string,
								modified: getUtcDate()
							}
						}
					);

					if (updateResult && updateResult.modifiedCount > 0) {
						// Step 3: Send reset password link via email
						const link = WEBSITE_ADMIN_URL + 'reset-password?validate_string=' + validate_string;

						const emailOptions = {
							to: email,
							action: "forgot_password",
							rep_array: [DEAR_HI_CONSTANT, result.full_name, link, link]
						};

						// Send Mail (assumed to be async, but not awaited here)
						sendMail(req, res, emailOptions);

						// Step 4: Send success response
						req.flash(STATUS_SUCCESS, res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email));
						return res.send({
							status: STATUS_SUCCESS,
							redirect_url: WEBSITE_ADMIN_URL + "forgot-password",
							message: res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email)
						});
					} else {
						// Step 5: Handle DB update error
						return res.send({
							status: STATUS_ERROR,
							message: [{ param: "email", msg: res.__("admin.system.something_going_wrong_please_try_again") }]
						});
					}
				} else {
					// Step 6: Always send success response for non-existing email (security best practice)
					req.flash(STATUS_SUCCESS, res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "forgot-password",
						message: res.__("admin.user.receive_email_with_link").replace(RegExp("{EMAIL}", "g"), email)
					});
				}
			} catch (e) {
				// Step 7: Handle any unexpected errors
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: "email", msg: res.__("admin.system.something_going_wrong_please_try_again") }]
				});
			}
		} else {
			// Render forgot password page for GET requests
			return res.render("forgot_password");
		}
	}; // end forgotPassword()

	/**
	 * Function for reset password
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 *
	 * @return render/json
	 */
	this.resetPassword = async (req, res, next) => {
		try {
			// Check if validate_string is present in query
			if (
				req.query &&
				typeof req.query.validate_string !== typeof undefined &&
				req.query.validate_string !== ""
			) {
				const users = db.collection(TABLE_USERS);

				// Handle POST request for resetting password
				if (isPost(req)) {
					const validateString = req.body.validate_string ? req.body.validate_string : "";

					if (validateString !== "") {
						const password = req.body.password ? req.body.password : "";

						try {
							// Generate bcrypt password hash
							const newPassword = await bcryptPasswordGenerate(password);

							// Find user with the given validate string
							const user = await users.findOne(
								{ forgot_password_validate_string: validateString },
								{ projection: { _id: 1, full_name: 1 } }
							);

							if (user) {
								// Update password and remove validate string
								const updateResult = await users.updateOne(
									{ _id: newObjectIdDefault(user._id) },
									{
										$set: {
											password: newPassword,
											modified: getUtcDate(),
										},
										$unset: {
											forgot_password_validate_string: 1,
										},
									}
								);

								// Send success response if update was successful
								if (updateResult && updateResult.modifiedCount > 0) {
									req.flash(
										STATUS_SUCCESS,
										res.__("admin.user.your_password_has_been_reset_successfully")
									);
									return res.send({
										status: STATUS_SUCCESS,
										redirect_url: WEBSITE_ADMIN_URL + "login",
										message: res.__("admin.user.your_password_has_been_reset_successfully"),
									});
								} else {
									// Send error if update failed
									return res.send({
										status: STATUS_ERROR,
										message: [
											{
												param: ADMIN_GLOBAL_ERROR,
												msg: res.__("admin.system.something_going_wrong_please_try_again"),
											},
										],
									});
								}
							} else {
								// User not found or link expired
								return res.send({
									status: STATUS_ERROR,
									message: [
										{
											param: "confirm_password",
											msg: res.__("admin.user.link_expired_or_wrong_link"),
										},
									],
								});
							}
						} catch (err) {
							// Handle unexpected errors during password reset
							return res.send({
								status: STATUS_ERROR,
								message: [
									{
										param: ADMIN_GLOBAL_ERROR,
										msg: res.__("admin.system.something_going_wrong_please_try_again"),
									},
								],
							});
						}
					} else {
						// Invalid or missing validate string in POST
						return res.send({
							status: STATUS_ERROR,
							message: [
								{
									param: "confirm_password",
									msg: res.__("admin.user.link_expired_or_wrong_link"),
								},
							],
						});
					}
				} else {
					// Handle GET request to render reset password page
					const validateString = req.query.validate_string ? req.query.validate_string : "";

					try {
						// Find user with the given validate string
						const user = await users.findOne(
							{ forgot_password_validate_string: validateString },
							{ projection: { _id: 1, full_name: 1 } }
						);

						if (user) {
							// Render reset password page
							return res.render("reset_password", {
								validate_string: validateString,
							});
						} else {
							// Link expired or invalid
							req.flash(STATUS_ERROR, res.__("admin.user.link_expired_or_wrong_link"));
							return res.redirect(WEBSITE_ADMIN_URL + "login");
						}
					} catch (err) {
						// Handle unexpected errors during GET
						req.flash(STATUS_ERROR, res.__("admin.user.link_expired_or_wrong_link"));
						return res.redirect(WEBSITE_ADMIN_URL + "login");
					}
				}
			} else {
				// No validate string provided in query
				req.flash("error", res.__("admin.user.link_expired_or_wrong_link"));
				return res.redirect(WEBSITE_ADMIN_URL + "login");
			}
		} catch (err) {
			// Catch-all error handler
			req.flash("error", res.__("admin.user.link_expired_or_wrong_link"));
			return res.redirect(WEBSITE_ADMIN_URL + "login");
		}
	}; // End resetPassword()
	/********************************* ADMIN Section End *********************/

	/**
	 * Function to get list of users (Admin)
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @return render/json
	 */
	this.getUserList = async (req, res) => {
		let userType = req.params.user_type ? req.params.user_type : "";
		let statusType = req.params.type ? req.params.type : "";

		if (!userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// Handle AJAX/DataTable POST request
		if (isPost(req)) {
			let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;
			let fromDate = req.body.fromDate ? req.body.fromDate : "";
			let toDate = req.body.toDate ? req.body.toDate : "";
			let statusSearch = req.body.status_search ? req.body.status_search : "";
			let emailStatusSearch = req.body.email_status_search ? req.body.email_status_search : "";
			let accountTypeStatusSearch = req.body.account_type_status_search ? req.body.account_type_status_search : "";
			let genderStatusSearch = req.body.gender_status_search ? parseInt(req.body.gender_status_search) : "";
			let activePlanNameSearch = req.body.active_plan_name_search ? req.body.active_plan_name_search : "";
			let enterpriseStatusSearch = req.body.enterprise_status_search ? req.body.enterprise_status_search : "";

			const collection = db.collection(TABLE_USERS);

			try {
				// Configure DataTable conditions (async)
				const dataTableConfig = await configDatatable(req, res, null);

				// Build common conditions for all queries
				let commonConditions = {
					is_deleted: NOT_DELETED,
					user_role_id: FRONT_ADMIN_ROLE_ID
				};

				// User type conditions
				if (userType == BASIC_USERS) {
					commonConditions['account_type'] = NORMAL_USER_ACCOUNT_TYPE;
				}
				if (userType == BUSSINESS_USERS) {
					commonConditions['account_type'] = BUSSINESS_USER_ACCOUNT_TYPE;
				}
				if (userType == PUBLIC_BUSSINESS_USERS) {
					commonConditions['account_type'] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
				}

				// Date range filter
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions["created"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Status search filter
				if (statusSearch !== "") {
					switch (statusSearch) {
						case TYPE_SUSPEND:
							dataTableConfig.conditions["is_active"] = SUSPEND;
							break;
						case TYPE_UN_SUSPEND:
							dataTableConfig.conditions["is_active"] = UN_SUSPEND;
							break;
						case TYPE_BLOCK:
							dataTableConfig.conditions["is_blocked"] = BLOCK;
							break;
						case TYPE_NOT_BLOCK:
							dataTableConfig.conditions["is_blocked"] = UN_BLOCK;
							break;
					}
				}

				// Email verification status filter
				if (emailStatusSearch !== "") {
					switch (emailStatusSearch) {
						case TYPE_EMAIL_VERIFIED:
							dataTableConfig.conditions["is_email_verified"] = VERIFIED;
							break;
						case TYPE_EMAIL_NOT_VERIFIED:
							dataTableConfig.conditions["is_email_verified"] = NOT_VERIFIED;
							break;
					}
				}

				// Account type status filter
				if (accountTypeStatusSearch !== "") {
					switch (accountTypeStatusSearch) {
						case BASIC_USERS:
							dataTableConfig.conditions["account_type"] = NORMAL_USER_ACCOUNT_TYPE;
							break;
						case BUSSINESS_USERS:
							dataTableConfig.conditions["account_type"] = BUSSINESS_USER_ACCOUNT_TYPE;
							break;
						case PUBLIC_BUSSINESS_USERS:
							dataTableConfig.conditions["account_type"] = PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE;
							break;
					}
				}

				// Gender filter
				if (genderStatusSearch !== "") {
					switch (genderStatusSearch) {
						case MALE:
							dataTableConfig.conditions["gender"] = MALE;
							break;
						case FEMALE:
							dataTableConfig.conditions["gender"] = FEMALE;
							break;
						case OTHER:
							dataTableConfig.conditions["gender"] = OTHER;
							break;
					}
				}

				// Enterprise status filter
				if (enterpriseStatusSearch !== "") {
					switch (enterpriseStatusSearch) {
						case ALLOW_ENTERPRISE:
							dataTableConfig.conditions["enterprise"] = ALLOW_ENTERPRISE;
							break;
						case NOT_ALLOW_ENTERPRISE:
							dataTableConfig.conditions["enterprise"] = { $in: [NOT_ALLOW_ENTERPRISE, null] };
							break;
					}
				}

				// Merge all conditions
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// ----------------- MongoDB Aggregation Pipeline for User List -----------------
				let dataCondition = [
					{ $match: dataTableConfig.conditions },
					{
						$lookup: {
							from: TABLE_USER_PLAN_PURCHASE,
							let: { userId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$user_id", "$$userId"] },
												{ $eq: ["$plan_status", PAYMENT_PLAN_ACTIVE] }
											]
										}
									}
								}
							],
							as: "activePlans"
						}
					},
					{ $addFields: { activePlan: { $arrayElemAt: ["$activePlans", 0] } } },
					{
						$project: {
							'_id': 1,
							'UUID': 1,
							'full_name': 1,
							'email': 1,
							'slug': 1,
							'is_email_verified': 1,
							'account_type': 1,
							'is_active': 1,
							'gender': 1,
							'is_blocked': 1,
							'is_deleted': 1,
							'created': 1,
							'show_segment': 1,
							'allows_access_platform_in_admin': 1,
							'auto_pay': 1,
							'subscription_id': 1,
							'enterprise': 1,
							'plan_lookup_key': "$activePlan.plan_lookup_key"
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// If filtering by active plan name, add $match after $addFields
				if (activePlanNameSearch) {
					dataCondition.splice(4, 0, { $match: { 'plan_lookup_key': activePlanNameSearch } });
				}

				// ----------------- MongoDB Aggregation Pipeline for Filtered Count -----------------
				let countPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$lookup: {
							from: TABLE_USER_PLAN_PURCHASE,
							let: { userId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$user_id", "$$userId"] },
												{ $eq: ["$plan_status", PAYMENT_PLAN_ACTIVE] }
											]
										}
									}
								}
							],
							as: "activePlans"
						}
					},
					{ $addFields: { activePlan: { $arrayElemAt: ["$activePlans", 0] } } }
				];
				if (activePlanNameSearch) {
					countPipeline.push({ $match: { 'activePlan.plan_lookup_key': activePlanNameSearch } });
				}
				countPipeline.push({ $count: "totalCount" });

				// ----------------- Run Queries in Parallel -----------------
				const [
					usersWithActivePlans, // List of users for current page
					totalRecords,         // Total users (unfiltered)
					filteredCountArr      // Filtered count (after all filters)
				] = await Promise.all([
					collection.aggregate(dataCondition).toArray(),
					collection.countDocuments(commonConditions),
					collection.aggregate(countPipeline).toArray()
				]);

				const filteredCount = (filteredCountArr && filteredCountArr.length > 0) ? filteredCountArr[0].totalCount : 0;

				// ----------------- Send Success Response -----------------
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: usersWithActivePlans || [],
					recordsFiltered: filteredCount,
					recordsTotal: totalRecords
				});
			} catch (err) {
				// ----------------- Send Error Response -----------------
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render user list page for GET request
			req.breadcrumbs(BREADCRUMBS["admin/users/list"]);
			res.render("list", {
				status_type: statusType,
				user_type: userType,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userType,
			});
		}
	}; // End getUserList()

	/**
	 * Async function to add a user's detail (Admin).
	 * Uses async/await for all DB/service calls and handles parallel operations with Promise.all if needed.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.addUser = async (req, res, next) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		if (!userType) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			// Prepare user data for creation
			req.body.user_role_id = FRONT_ADMIN_ROLE_ID;
			req.body.request_from = REQUEST_FROM_ADMIN;
			req.body.is_mobile_verified = VERIFIED;
			req.body.is_email_verified = VERIFIED;
			req.body.dob = formatNumber(req.body.dd) + "-" + formatNumber(req.body.mm) + "-" + req.body.yy;

			let errMessage = [];

			try {
				// Call user service to add user (async)
				const response = await userService.addUser(req, res, next);

				// Handle invalid access error
				if (response.status === STATUS_ERROR_INVALID_ACCESS) {
					errMessage.push({ param: "profile_image", msg: response.message });
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
						message: errMessage,
					});
				}

				// Handle form validation errors
				if (response.status === STATUS_ERROR_FORM_VALIDATION) {
					const formErrors = response.errors ? response.errors : {};
					const errors = parseValidation(formErrors, req);
					if (errors) {
						return res.send({ status: STATUS_ERROR, message: errors });
					}
				}

				// Handle success case
				if (response.status === STATUS_SUCCESS) {
					const lastInsertId = response.result.lastInsertId || "";
					const email = response.result.email || "";
					const fullName = response.result.fullName || "";
					const password = response.result.password || "";
					const emailOtpCode = response.result.emailOtpCode || "";
					const messageStr = res.__("admin.user.user_has_been_added_successfully");

					// Send email to user if email exists
					if (email !== "") {
						const emailOptions = {
							to: email,
							action: "new_user_added_by_admin",
							rep_array: [DEAR_HI_CONSTANT, fullName, email, password, emailOtpCode]
						};
						// Send email asynchronously (no await, fire-and-forget)
						sendMail(req, res, emailOptions);
					}

					// Send notification to super admin
					const notificationMessageParams = [fullName];
					const notificationOptions = {
						notification_data: {
							notification_type: NOTIFICATION_NEW_USER_ADDED_BY_ADMIN,
							message_params: notificationMessageParams,
							parent_table_id: ADMIN_ID,
							user_id: lastInsertId,
							user_ids: [lastInsertId],
							user_role_id: SUPER_ADMIN_ROLE_ID,
							role_id: SUPER_ADMIN_ROLE_ID,
							extra_parameters: {
								user_id: newObjectIdDefault(lastInsertId),
							}
						}
					};
					// Insert notification asynchronously (no await, fire-and-forget)
					insertNotifications(req, res, notificationOptions);

					// If user is a public business user, create default lead capture form and update user
					const accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;
					if (accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
						const optionLeads = {
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

						// Save lead capture form and update user with lead_forms_id
						const saveLeadResponseId = await saveLeadCaptureForm(req, res, optionLeads);

						const users = db.collection(TABLE_USERS);
						await users.updateOne(
							{ _id: newObjectIdDefault(lastInsertId) },
							{ $set: { lead_forms_id: newObjectIdDefault(saveLeadResponseId) } }
						);

						// Generate Excel lead capture form data (fire-and-forget)
						saveExcelLeadCaptureForm(req, res, lastInsertId);
					}

					// Send success response
					req.flash(STATUS_SUCCESS, messageStr);
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
						message: messageStr,
					});
				}
			} catch (error) {
				// Pass error to next middleware
				return next(error);
			}
		} else {
			// Handle GET request: fetch dropdowns and render add user page
			const options = {
				collections: [
					{
						collection: TABLE_MASTERS,
						columns: ["_id", "name"],
						conditions: { status: ACTIVE, dropdown_type: MASTER_BUSINESS_INDUSTRY },
					}
				]
			};
			try {
				// Fetch dropdown list (async)
				const response = await getDropdownList(req, res, options);

				// Render add user page
				req.breadcrumbs(BREADCRUMBS["admin/users/add"]);
				return res.render("add", {
					user_type: userType,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					business_industry: (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
				});
			} catch (error) {
				// Pass error to next middleware
				return next(error);
			}
		}
	}; // End addUser()

	/**
	 * Function to edit user's Detail (Admin)
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.editUser = async (req, res, next) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.id ? newObjectIdDefault(req.params.id) : newObjectIdDefault();
		const viewPageLink = req.params.view_page ? DEFAULT_ONE : DEFAULT_ZERO;

		if (!userType) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			// Sanitize and prepare data for update
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);
			req.body.id = req.params.id ? newObjectIdDefault(req.params.id) : newObjectIdDefault();
			req.body.request_from = REQUEST_FROM_ADMIN;
			req.body.dob = formatNumber(req.body.dd) + "-" + formatNumber(req.body.mm) + "-" + req.body.yy;

			let errMessage = [];
			try {
				// Update user details using userService (async/await)
				const response = await userService.editUser(req, res, next);

				// Handle invalid access error
				if (response.status === STATUS_ERROR_INVALID_ACCESS) {
					errMessage.push({ param: "profile_image", msg: response.message });
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
						message: errMessage,
					});
				}

				// Handle form validation errors
				if (response.status === STATUS_ERROR_FORM_VALIDATION) {
					const formErrors = response.errors ? response.errors : {};
					const errors = parseValidation(formErrors, req);
					if (errors) return res.send({ status: STATUS_ERROR, message: errors });
				}

				// On success, send notification, email, and handle lead form logic
				if (response.status === STATUS_SUCCESS) {
					const lastInsertId = userId;
					const email = response.result.email ? response.result.email : "";
					const fullName = response.result.full_name ? response.result.full_name : "";
					const messageStr = res.__("admin.user.user_details_has_been_updated_successfully");

					// Send email to user (fire-and-forget)
					if (email !== "") {
						const emailOptions = {
							to: email,
							action: "new_user_edit_by_admin",
							rep_array: [DEAR_HI_CONSTANT, fullName]
						};
						sendMail(req, res, emailOptions);
					}

					// Send notification to user (fire-and-forget)
					const notificationMessageParams = [fullName];
					const notificationOptions = {
						notification_data: {
							notification_type: NOTIFICATION_NEW_USER_EDIT_BY_ADMIN,
							message_params: notificationMessageParams,
							parent_table_id: ADMIN_ID,
							user_id: lastInsertId,
							user_ids: [lastInsertId],
							user_role_id: SUPER_ADMIN_ROLE_ID,
							role_id: SUPER_ADMIN_ROLE_ID,
							extra_parameters: {
								user_id: newObjectIdDefault(lastInsertId),
							}
						}
					};
					insertNotifications(req, res, notificationOptions);

					// Handle lead form generation for public business users
					const leadFormsExcelId = req.body.excel_lead_forms_id ? req.body.excel_lead_forms_id : "";
					const leadFormsId = req.body.lead_forms_id ? req.body.lead_forms_id : "";
					const accountType = req.body.account_type ? Number(req.body.account_type) : NORMAL_USER_ACCOUNT_TYPE;

					// If no lead form exists and user is public business, generate default lead form
					if (leadFormsId === '' && accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
						const optionLeads = {
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
						try {
							// Save lead capture form and update user with new lead_forms_id
							const saveLeadResponseId = await saveLeadCaptureForm(req, res, optionLeads);
							const users = db.collection(TABLE_USERS);
							await users.updateOne(
								{ _id: newObjectIdDefault(lastInsertId) },
								{ $set: { lead_forms_id: newObjectIdDefault(saveLeadResponseId) } }
							);
						} catch (err) {
							// Log error but do not block main flow
							console.error("Error generating default lead form:", err);
						}
					}

					// If no excel lead form exists and user is public business, generate excel lead form (fire-and-forget)
					if (leadFormsExcelId === '' && accountType === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
						saveExcelLeadCaptureForm(req, res, lastInsertId);
					}

					// Send success response
					req.flash(STATUS_SUCCESS, messageStr);
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
						message: messageStr,
					});
				}
			} catch (error) {
				// Pass error to next middleware
				return next(error);
			}
		} else {
			// Handle GET request: fetch user details, dropdowns, and render edit page
			try {
				// Run category and dropdown queries in parallel for efficiency
				const response = await getUserDetails(req, res, next);
				if (response.status !== STATUS_SUCCESS) {
					req.flash(STATUS_ERROR, response.message);
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
				}
				const businessIndustryId = (response.result && response.result.public_business_informaton && response.result.public_business_informaton.business_industry)
					? response.result.public_business_informaton.business_industry
					: "";

				const options = {
					collections: [
						{
							collection: TABLE_MASTERS,
							columns: ["_id", "name"],
							conditions: { status: ACTIVE, dropdown_type: MASTER_BUSINESS_INDUSTRY },
							selected: [businessIndustryId],
						},
					]
				};

				// Fetch categories and dropdowns in parallel
				const [responseCategory, responseData] = await Promise.all([
					getCategoriesData(),
					getDropdownList(req, res, options)
				]);

				// Render edit user page
				req.breadcrumbs(BREADCRUMBS["admin/users/edit"]);
				return res.render("edit", {
					business_industry: (responseData && responseData.final_html_data && responseData.final_html_data["0"]) ? responseData.final_html_data["0"] : "",
					result: response.result ? response.result : {},
					category_result: (responseCategory && responseCategory.result) ? responseCategory.result : [],
					user_type: userType,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					user_id: userId,
					viewPageLink: viewPageLink,
				});
			} catch (error) {
				// Pass error to next middleware
				return next(error);
			}
		}
	}; // End editUser()

	/**
	 * Async function to get user's detail (Admin).
	 * Uses async/await for all DB/service calls.
	 * If additional queries are needed in parallel, use Promise.all.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Object} JSON response with user details or error
	 */
	const getUserDetails = async (req, res, next) => {
		try {
			// Extract userId from request parameters
			const userId = req.params.id ? req.params.id : "";

			// Get user details from the database using async/await
			const users = db.collection(TABLE_USERS);
			const user = await users.findOne({
				_id: newObjectIdDefault(userId),
				user_role_id: FRONT_ADMIN_ROLE_ID,
				is_deleted: NOT_DELETED,
			});

			// If user not found, return error response
			if (!user) {
				return {
					status: STATUS_ERROR,
					message: res.__("admin.system.invalid_access")
				};
			}

			// Convert MongoDB date to simple dd-mm-yy format
			const dobConvert = mongoDatetoSimpleDateConvert(user.dob);
			user['dd'] = dobConvert.dd;
			user['mm'] = dobConvert.mm;
			user['yy'] = dobConvert.yy;

			// Prepare options for appending image full path
			const options = {
				file_url: USERS_URL,
				file_path: USERS_FILE_PATH,
				result: [user],
				database_field: "profile_image"
			};

			// Append image with full path using async/await
			const fileResponse = await appendFileExistData(options);

			// Return success response with user details
			return {
				status: STATUS_SUCCESS,
				result: (fileResponse && fileResponse.result && fileResponse.result[0]) ? fileResponse.result[0] : {}
			};
		} catch (error) {
			// Pass error to next middleware and return error response
			next(error);
			return {
				status: STATUS_ERROR,
				message: res.__("admin.system.invalid_access")
			};
		}
	}; // End getUserDetails()

	/**
	 * Async function to view user's Detail (Admin).
	 * Uses async/await for all DB queries and handles all data fetching in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.viewUserDetails = async (req, res, next) => {
		const userId = req.params.id ? req.params.id : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const userTypeTitle = FRONT_USER_TYPE[userType] ? FRONT_USER_TYPE[userType] : "";

		// Validate user type
		if (!userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			return;
		}

		// Prepare query conditions
		const conditions = {
			_id: newObjectIdDefault(userId),
			user_role_id: FRONT_ADMIN_ROLE_ID
		};

		try {
			const users = db.collection(TABLE_USERS);

			// Aggregate user details with business industry and interest categories using async/await
			const userDetailsArr = await users.aggregate([
				{ $match: conditions },
				{
					$lookup: {
						from: TABLE_MASTERS,
						let: { businessIndustryId: "$public_business_informaton.business_industry" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$businessIndustryId"] }
										]
									}
								}
							},
							{ $project: { name: 1 } }
						],
						as: "business_industry"
					}
				},
				{
					$lookup: {
						from: TABLE_CATEGORIES,
						let: { interestCategoryIds: "$interest_category" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $in: ["$_id", { $ifNull: ["$$interestCategoryIds", []] }] }
										]
									}
								}
							},
							{ $project: { name: 1 } }
						],
						as: "category_details"
					}
				}
			]).toArray();

			// If user not found, send error response
			if (!userDetailsArr || userDetailsArr.length === 0) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			}

			const userDetails = userDetailsArr[0];

			// Check if user is deleted
			if (userDetails.is_deleted === DELETED) {
				req.flash(STATUS_ERROR, res.__("admin.user.this_user_is_deleted_from_the_system", userTypeTitle.toLowerCase()));
				res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
				return;
			}

			// Prepare options for appending image full path
			const options = {
				file_url: USERS_URL,
				file_path: USERS_FILE_PATH,
				result: [userDetails],
				database_field: "profile_image",
				no_image_available: ADD_PROFILE_IMAGE_ICON
			};

			// Append image with full path using async/await
			const fileResponse = await appendFileExistData(options);

			// Render the user view page
			req.breadcrumbs(BREADCRUMBS["admin/users/view"]);
			res.render("view", {
				result: (fileResponse && fileResponse.result && fileResponse.result[0]) ? fileResponse.result[0] : {},
				user_type: userType,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userType,
			});
		} catch (error) {
			// Pass error to next middleware
			next(error);
		}
	};

	/**
	 * Async function to manage user links (Admin).
	 * Uses async/await for all DB queries.
	 * Handles errors gracefully and renders the manage_links view.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.manageLink = async (req, res) => {
		const userId = req.params.id ? req.params.id : "";
		const userType = req.params.user_type ? req.params.user_type : "";

		// Validate userType
		if (!userType) {
			// Send error response for invalid access
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			const users = db.collection(TABLE_USERS);

			// Fetch user details by ID using async/await
			const responseUser = await users.findOne({ _id: newObjectIdDefault(userId) });

			// Render the manage_links view with user details
			req.breadcrumbs(BREADCRUMBS["admin/users/manage_links"]);
			return res.render("manage_links", {
				result: responseUser,
				error: null,
				user_type: userType,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userType,
			});
		} catch (error) {
			// Handle errors and render the view with error details
			req.breadcrumbs(BREADCRUMBS["admin/users/manage_links"]);
			return res.render("manage_links", {
				result: null,
				error: error,
				user_type: userType,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userType,
			});
		}
	};

	/**
	 * Async function to update a user's status (Admin).
	 * Uses async/await for all DB queries.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.updateUserStatus = async (req, res, next) => {
		const userId = req.params.id ? req.params.id : "";
		const userStatus = req.params.status ? req.params.status : "";
		const statusType = req.params.status_type ? req.params.status_type : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const viewPageLink = req.params.view_page ? DEFAULT_ONE : DEFAULT_ZERO;
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !statusType || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			// Fetch user by ID using async/await
			const responseUser = await users.findOne(
				{ _id: newObjectIdDefault(userId) },
				{ projection: { _id: 1 } }
			);

			if (!responseUser) {
				// User not found, send error response
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}

			// Prepare update data and message based on status type
			let updateData = { modified: getUtcDate() };
			let messageData = "";

			if (statusType === ACTIVE_INACTIVE_STATUS) {
				updateData.is_active = (userStatus === SUSPEND) ? UN_SUSPEND : SUSPEND;
				messageData = (userStatus === SUSPEND)
					? res.__("admin.user.user_has_been_unsuspend_successfully")
					: res.__("admin.user.user_has_been_suspend_successfully");
			} else if (statusType === BLOCK_UNBLOCK_STATUS) {
				updateData.is_blocked = (userStatus === UN_BLOCK) ? BLOCK : UN_BLOCK;
				messageData = (userStatus === UN_BLOCK)
					? res.__("admin.user.user_has_been_block_successfully")
					: res.__("admin.user.user_has_been_not_block_successfully");
			} else if (statusType === VERIFIED_STATUS) {
				updateData.account_type = (userStatus === BUSSINESS_USER_ACCOUNT_TYPE)
					? NORMAL_USER_ACCOUNT_TYPE
					: BUSSINESS_USER_ACCOUNT_TYPE;
				messageData = (userStatus === BUSSINESS_USER_ACCOUNT_TYPE)
					? res.__("admin.user.user_has_been_un_verified_bussiness_successfully")
					: res.__("admin.user.user_has_been_verified_business_successfully");
			}

			// Update user status in the database using async/await
			await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			// Prepare options for sending mail/notification
			const options = {
				user_id: userId,
				status_type: statusType,
				user_status: (userStatus === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE)
					? NORMAL_USER_ACCOUNT_TYPE
					: userStatus,
			};

			// Send mail/notification (async/await)
			await sendMailData(req, res, options);

			// Set success flash message and redirect accordingly
			req.flash(STATUS_SUCCESS, messageData);
			if (viewPageLink) {
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/view/${userId}`);
			} else {
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
			}
		} catch (error) {
			// Pass error to next middleware
			return next(error);
		}
	};

	/**
	 * Async function to convert a user to a public business account.
	 * Uses async/await for all DB/service calls and handles parallel operations with Promise if needed.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.convertBusinessAccount = async (req, res, next) => {
		const userId = req.params.id ? req.params.id : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const viewPageLink = req.params.view_page ? DEFAULT_ONE : DEFAULT_ZERO;

		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			// ----------------- Fetch User Data -----------------
			const responseUser = await users.findOne(
				{ _id: newObjectIdDefault(userId) },
				{
					projection: {
						email: 1,
						full_name: 1,
						profile_image: 1,
						mobile: 1,
						slug: 1,
						your_bio: 1,
						lead_forms_id: 1,
						excel_lead_forms_id: 1,
						public_business_informaton: 1
					}
				}
			);

			if (!responseUser) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}

			// ----------------- Prepare Data for Update -----------------
			const businessInfo = responseUser.public_business_informaton || {};
			const leadFormsId = responseUser.lead_forms_id || "";
			const leadFormsExcelId = responseUser.excel_lead_forms_id || "";
			const email = responseUser.email || "";
			const mobile = responseUser.mobile || "";
			const userSlug = responseUser.slug || "";
			const yourBio = responseUser.your_bio || "";
			const fullName = responseUser.full_name || "";
			const profileImage = responseUser.profile_image || "";
			const defaultNameBusiness = fullName ? fullName : userSlug;

			// ----------------- Update User to Public Business Account -----------------
			await users.updateOne(
				{ _id: newObjectIdDefault(userId) },
				{
					$set: {
						account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
						'public_business_informaton.name_of_the_business': businessInfo.name_of_the_business ? businessInfo.name_of_the_business : defaultNameBusiness,
						'public_business_informaton.description': businessInfo.description ? businessInfo.description : yourBio,
						'public_business_informaton.business_email': email,
						'public_business_informaton.business_industry': newObjectIdDefault(BUSINESS_INDUSTRY_GENERAL_ID),
						'public_business_informaton.business_industry_name': BUSINESS_INDUSTRY_GENERAL_NAME,
						'public_business_informaton.redemption_code': (res.locals.settings["Site.default_redemption_code"]).toString(),
						'public_business_informaton.primary_phone': mobile,
						'public_business_informaton.business_logo': profileImage,
						'public_business_informaton.modified': getUtcDate()
					}
				}
			);

			// ----------------- Send Notification/Email -----------------
			const options = {
				user_id: userId,
				status_type: VERIFIED_STATUS,
				user_status: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
			};
			await sendMailData(req, res, options);

			// ----------------- Generate Excel Lead Form if Not Exists -----------------
			if (!leadFormsExcelId) {
				// This is a fire-and-forget, as original code does not await
				saveExcelLeadCaptureForm(req, res, userId);
			}

			// ----------------- Handle Lead Form Generation and Redirection -----------------
			if (leadFormsId) {
				// If lead form already exists, just redirect with success
				req.flash(STATUS_SUCCESS, res.__("admin.user.user_has_been_bussiness_account_change_successfully"));
				if (viewPageLink) {
					return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/view/${userId}`);
				} else {
					return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
				}
			} else {
				// Generate default lead form for the user
				const optionLeads = {
					user_id: newObjectIdDefault(userId),
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

				// Save lead form and update user in parallel
				const saveLeadResponseId = await saveLeadCaptureForm(req, res, optionLeads);

				await users.updateOne(
					{ _id: newObjectIdDefault(userId) },
					{ $set: { lead_forms_id: newObjectIdDefault(saveLeadResponseId) } }
				);

				req.flash(STATUS_SUCCESS, res.__("admin.user.user_has_been_bussiness_account_change_successfully"));
				if (viewPageLink) {
					return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/view/${userId}`);
				} else {
					return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
				}
			}
		} catch (error) {
			// Pass error to next middleware
			return next(error);
		}
	}; // End convertBusinessAccount()

	/**
	 * Async function to send mail and notification data based on user status change.
	 * Uses async/await for all DB queries and notification/email sending.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Object} options - Options containing user_id, status_type, user_status
	 * @return {Promise<void>}
	 */
	const sendMailData = async (req, res, options) => {
		try {
			const collection = db.collection(TABLE_USERS);
			const userId = options.user_id ? options.user_id : "";
			const statusType = options.status_type ? options.status_type : "";
			const userStatus = options.user_status ? options.user_status : "";

			// Fetch user details by ID using async/await
			const responseUser = await collection.findOne(
				{ _id: newObjectIdDefault(userId) },
				{ projection: { full_name: 1, email: 1 } }
			);

			if (!responseUser) {
				// User not found, nothing to do
				return;
			}

			const email = responseUser.email || '';
			const fullName = responseUser.full_name || '';
			let statusMsg = "";

			// If user has an email, proceed based on status type
			if (email !== '') {
				// Handle ACTIVE/INACTIVE status
				if (statusType === ACTIVE_INACTIVE_STATUS) {
					statusMsg = (userStatus === SUSPEND)
						? res.__("admin.user_email.un_suspend")
						: res.__("admin.user_email.suspend");

					// Prepare notification and email data
					const notificationMessageParams = [fullName, statusMsg];
					const notificationOptions = {
						notification_data: {
							notification_type: NOTIFICATION_SUSPENDED_UNSUSPENDED,
							message_params: notificationMessageParams,
							parent_table_id: userId,
							user_id: userId,
							user_ids: [userId],
							user_role_id: SUPER_ADMIN_ROLE_ID,
							role_id: SUPER_ADMIN_ROLE_ID,
							extra_parameters: {
								user_id: newObjectIdDefault(userId),
							}
						}
					};
					const emailRequestedData = {
						to: email,
						action: "suspended_unsuspended_account",
						rep_array: [DEAR_HI_CONSTANT, fullName, statusMsg]
					};

					// Run notification and email in parallel
					await Promise.all([
						insertNotifications(req, res, notificationOptions),
						sendMail(req, res, emailRequestedData)
					]);
					return;
				}

				// Handle BLOCK/UNBLOCK status
				if (statusType === BLOCK_UNBLOCK_STATUS) {
					statusMsg = (userStatus === UN_BLOCK)
						? res.__("admin.user_email.block")
						: res.__("admin.user_email.not_block");

					const emailRequestedData = {
						to: email,
						action: "suspended_unsuspended_account",
						rep_array: [DEAR_HI_CONSTANT, fullName, statusMsg]
					};

					// Send email (no notification for block/unblock)
					await sendMail(req, res, emailRequestedData);
					return;
				}

				// Handle VERIFIED status
				if (statusType === VERIFIED_STATUS) {
					if (userStatus === PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE) {
						statusMsg = res.__("admin.user_email.public_business");
					} else {
						statusMsg = (userStatus === BUSSINESS_USER_ACCOUNT_TYPE)
							? res.__("admin.user_email.basic_user")
							: res.__("admin.user_email.verified");
					}

					const notificationMessageParams = [fullName, statusMsg];
					const notificationOptions = {
						notification_data: {
							notification_type: NOTIFICATION_ACCOUNT_CHANGE_BASIC_BUSINESS,
							message_params: notificationMessageParams,
							parent_table_id: userId,
							user_id: userId,
							user_ids: [userId],
							user_role_id: SUPER_ADMIN_ROLE_ID,
							role_id: SUPER_ADMIN_ROLE_ID,
							extra_parameters: {
								user_id: newObjectIdDefault(userId),
							}
						}
					};
					const emailRequestedData = {
						to: email,
						action: "verified_bussiness_account",
						rep_array: [DEAR_HI_CONSTANT, fullName, statusMsg]
					};

					// Run notification and email in parallel
					await Promise.all([
						insertNotifications(req, res, notificationOptions),
						sendMail(req, res, emailRequestedData)
					]);
					return;
				}
			}
			// If no email or no matching status type, do nothing
			return;
		} catch (error) {
			// Log error for debugging
			console.error('Error in sendMailData:', error);
			return;
		}
	};

	/**
	 * Async function to get master account users listing (Admin).
	 * Uses async/await for all DB queries.
	 * Runs queries in parallel using Promise.all where needed.
	 * Handles errors gracefully and renders the master_list view or sends JSON.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {void}
	 */
	this.getMasterAccount = async (req, res) => {
		const usersCollection = db.collection(TABLE_USERS);
		const subUsersCollection = db.collection(TABLE_SUB_USERS);

		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.id ? newObjectIdDefault(req.params.id) : newObjectIdDefault();
		const viewPageLink = req.params.view_page ? DEFAULT_ONE : DEFAULT_ZERO;

		// Validate required parameters
		if (!userType && !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			// Extract and sanitize POST data
			const userName = req.body.user_name ? req.body.user_name : "";
			const email = req.body.email ? req.body.email.toLowerCase() : "";
			const zipCode = req.body.zip_code ? req.body.zip_code : "";
			const checkUserIds = req.body.checked_userid ? req.body.checked_userid.split(",") : [];
			const tableSubUsersIds = req.body.sub_users_ids ? req.body.sub_users_ids.split(",") : [];

			const userIdsArray = checkUserIds.map(id => newObjectIdDefault(id));
			const alreadyTableUserIdsArray = tableSubUsersIds.map(id => newObjectIdDefault(id));

			// Build base query conditions
			let commonConditions = {
				_id: { $ne: userId },
				is_email_verified: VERIFIED,
				account_type: PUBLIC_BUSSINESS_USER_ACCOUNT_TYPE,
				is_deleted: NOT_DELETED,
				user_role_id: FRONT_ADMIN_ROLE_ID
			};

			let optionsArray = [];

			// Add email condition if provided
			if (email !== "") {
				optionsArray.push({ email: email });
			}
			// Add zip code condition if provided
			if (zipCode !== "") {
				optionsArray.push({ zip: Number(zipCode) });
			}
			// Add name condition if provided
			if (userName !== "") {
				optionsArray.push({ full_name: { $regex: new RegExp(userName, "i") } });
			}

			// Combine conditions for query
			if (optionsArray.length > 0 && userIdsArray.length > 0) {
				commonConditions['$or'] = [
					{ $and: optionsArray },
					{ _id: { $in: userIdsArray } }
				];
			} else if (optionsArray.length > 0) {
				commonConditions['$and'] = optionsArray;
			} else if (userIdsArray.length > 0) {
				commonConditions['$or'] = [
					{ _id: { $in: userIdsArray } }
				];
			} else if (optionsArray.length === 0) {
				commonConditions['_id'] = { $in: alreadyTableUserIdsArray };
			}

			try {
				// Run all DB queries in parallel using Promise.all
				const [
					userList,           // List of users matching conditions
					totalCount,         // Total number of records
					filteredCount,      // Filtered records count (same as total here)
					subUsersResult      // Selected sub users for this user
				] = await Promise.all([
					usersCollection.find(commonConditions, { projection: { _id: 1, full_name: 1, email: 1 } })
						.collation(COLLATION_VALUE)
						.toArray(),
					usersCollection.countDocuments(commonConditions),
					usersCollection.countDocuments(commonConditions),
					subUsersCollection.findOne(
						{ user_id: newObjectIdDefault(userId) },
						{ projection: { _id: 1, selected_user: 1 } }
					)
				]);

				// Send JSON response with results
				return res.send({
					status: STATUS_SUCCESS,
					data: userList || [],
					recordsFiltered: filteredCount || 0,
					recordsTotal: totalCount || 0,
					selectedUser: subUsersResult || []
				});
			} catch (error) {
				// Handle errors and send error response
				return res.send({
					status: STATUS_ERROR,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0,
					selectedUser: []
				});
			}
		} else {
			// Handle GET request: fetch selected sub users and render the view
			try {
				// Fetch selected sub users for this user
				const subUsersResult = await subUsersCollection.findOne(
					{ user_id: newObjectIdDefault(userId) },
					{ projection: { _id: 1, selected_user: 1 } }
				);

				req.breadcrumbs(BREADCRUMBS["admin/sub_users/list"]);
				return res.render("master_list", {
					err: null,
					user_id: userId,
					user_type: userType,
					dynamic_variable: userBreadcrumbs(userType),
					sub_users_ids: (subUsersResult && subUsersResult.selected_user) ? subUsersResult.selected_user : [],
					dynamic_url: userType,
					viewPageLink: viewPageLink,
				});
			} catch (error) {
				// Handle errors and render the view with error details
				req.breadcrumbs(BREADCRUMBS["admin/sub_users/list"]);
				return res.render("master_list", {
					err: error,
					user_id: userId,
					user_type: userType,
					dynamic_variable: userBreadcrumbs(userType),
					sub_users_ids: [],
					dynamic_url: userType,
					viewPageLink: viewPageLink,
				});
			}
		}
	};

	/**
	 * Async function to add sub users (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {void}
	 */
	this.addSubUsers = async (req, res) => {
		if (isPost(req)) {
			// Sanitize incoming request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			// Extract and prepare required parameters
			const userId = req.body.user_id ? newObjectIdDefault(req.body.user_id) : newObjectIdDefault();
			const userType = req.body.user_type ? req.body.user_type : "";
			const checkedUserIds = req.body.checked_user_ids ? req.body.checked_user_ids : "";

			// Prepare options for sub user addition
			const optionsData = {
				user_id: userId,
				checked_user_ids: checkedUserIds,
				add_submit_type: ADMIN_SUB_USERS_ADD
			};

			try {
				// Add sub users using async/await
				const response = await addSubUsersGlobally(req, res, optionsData);

				// Handle error or success response
				if (response.status === STATUS_ERROR) {
					req.flash(STATUS_ERROR, response.message);
					return res.send({
						status: STATUS_ERROR,
						message: response.message,
						redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/get_master_account/${userId}`,
					});
				} else {
					req.flash(STATUS_SUCCESS, response.message);
					return res.send({
						status: STATUS_SUCCESS,
						message: response.message,
						redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/get_master_account/${userId}`,
					});
				}
			} catch (error) {
				// Handle unexpected errors gracefully
				req.flash(STATUS_ERROR, "An error occurred");
				return res.send({
					status: STATUS_ERROR,
					message: "An error occurred",
					redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/get_master_account/${userId}`,
				});
			}
		}
	}; // End addSubUsers()

	/**
	 * Async function to verify email or mobile for a user (Admin).
	 * Uses async/await for all DB queries and service calls.
	 * Handles errors gracefully and sends appropriate responses.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {void}
	 */
	this.verifyEmailOrMobile = async (req, res, next) => {
		const userId = req.params.id ? req.params.id : "";
		const verifyType = req.params.verify_type ? req.params.verify_type : "";
		const pageType = req.params.page_type ? req.params.page_type : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const viewPageLink = req.params.view_page ? DEFAULT_ONE : DEFAULT_ZERO;

		// Validate required parameters
		if (!userId || !verifyType || pageType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Prepare update data and message based on verification type
		let updateData = {};
		let messageData = "";
		if (verifyType === 'email') {
			messageData = 'Email';
			updateData = {
				modified: getUtcDate(),
				is_email_verified: VERIFIED,
			};
		} else {
			messageData = 'Mobile';
			updateData = {
				modified: getUtcDate(),
				is_mobile_verified: VERIFIED,
			};
		}

		try {
			// Fetch user details using async/await
			const response = await getUserDetails(req, res, next);

			if (response.status !== STATUS_SUCCESS || !response.result) {
				// User not found or error, send error response
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/rider");
			}

			const userResult = response.result;
			const userEmail = userResult.email ? userResult.email : "";
			const userName = userResult.full_name ? userResult.full_name : "";

			// If verifying email, send verification email in parallel with DB update
			const users = db.collection(TABLE_USERS);

			let emailPromise = Promise.resolve();
			if (verifyType === 'email' && userEmail) {
				const emailRequestedData = {
					to: userEmail,
					action: "email_verify_by_admin",
					rep_array: [DEAR_HI_CONSTANT, userName]
				};
				emailPromise = sendMail(req, res, emailRequestedData);
			}

			// Update user status in the database using async/await
			await Promise.all([
				users.updateOne(
					{ _id: newObjectIdDefault(userId) },
					{ $set: updateData }
				),
				emailPromise
			]);

			// Set success flash message and redirect accordingly
			req.flash(STATUS_SUCCESS, res.__("admin.user.user_has_been_verified_successfully", messageData));
			if (viewPageLink) {
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/view/${userId}`);
			} else {
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
			}
		} catch (error) {
			// Pass error to next middleware
			return next(error);
		}
	}; // End verifyEmailOrMobile()

	/**
	 * Async function to view Redemptions details
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.viewRedemptions = async (req, res) => {
		let userType = req.params.user_type ? req.params.user_type : "";
		let userId = req.params.id ? req.params.id : "";
		const rewards = db.collection(TABLE_REWARDS);

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			let limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			let skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

			try {
				// Configure DataTable conditions
				const dataTableConfig = await configDatatable(req, res, null);

				let commonConditions = {
					user_id: newObjectIdDefault(userId),
					is_deleted: NOT_DELETED
				};

				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Prepare aggregation pipelines for all queries
				const listRedemptionPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$lookup: {
							from: TABLE_EARN_SENT_REWARDS,
							let: { rewardId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$reward_id", "$$rewardId"] },
											]
										},
									}
								},
								{
									$group: {
										_id: null,
										reward_send_count: { $sum: 1 },
										redemption_count: { $sum: { $cond: [{ $and: [{ $eq: ["$is_redemed", REDEMED] }] }, 1, 0] } },
										reward_in_wallet: { $sum: { $cond: [{ $and: [{ $eq: ["$is_redemed", NOT_REDEMED] }] }, 1, 0] } },
										viewed_count: { $sum: { $cond: [{ $and: [{ $eq: ["$is_viewed", VIEWED] }] }, 1, 0] } },
										not_viewed_count: { $sum: { $cond: [{ $and: [{ $eq: ["$is_viewed", NOT_VIEWED] }] }, 1, 0] } },
									}
								}
							],
							as: "rewardDetails"
						}
					},
					{
						$addFields: {
							reward_send_count: { $cond: [{ $arrayElemAt: ["$rewardDetails.reward_send_count", 0] }, { $arrayElemAt: ["$rewardDetails.reward_send_count", 0] }, 0] },
							redemption_count: { $cond: [{ $arrayElemAt: ["$rewardDetails.redemption_count", 0] }, { $arrayElemAt: ["$rewardDetails.redemption_count", 0] }, 0] },
							viewed_count: { $cond: [{ $arrayElemAt: ["$rewardDetails.viewed_count", 0] }, { $arrayElemAt: ["$rewardDetails.viewed_count", 0] }, 0] },
							not_viewed_count: { $cond: [{ $arrayElemAt: ["$rewardDetails.not_viewed_count", 0] }, { $arrayElemAt: ["$rewardDetails.not_viewed_count", 0] }, 0] },
							reward_in_wallet: { $cond: [{ $arrayElemAt: ["$rewardDetails.reward_in_wallet", 0] }, { $arrayElemAt: ["$rewardDetails.reward_in_wallet", 0] }, 0] },
						}
					},
					{
						$match: {
							reward_send_count: { $gt: DEFAULT_ZERO }
						}
					},
					{
						$project: {
							_id: 1,
							reward_text: 1,
							reward_sub_heading: 1,
							graphic_image: 1,
							url_desc: 1,
							is_active: 1,
							slug: 1,
							created: 1,
							expiry_date: 1,
							reward_send_count: 1,
							reward_in_wallet: 1,
							redemption_count: 1,
							viewed_count: 1,
							toogle_expiry_date: 1,
							redemption_percentage: { $multiply: [{ $divide: ["$redemption_count", "$reward_send_count"] }, 100] },
							viewed_percentage: { $multiply: [{ $divide: ["$viewed_count", "$reward_send_count"] }, 100] },
							not_viewed_percentage: { $multiply: [{ $divide: ["$not_viewed_count", "$reward_send_count"] }, 100] },
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				const totalRecordsPipeline = [
					{ $match: commonConditions },
					{
						$lookup: {
							from: TABLE_EARN_SENT_REWARDS,
							let: { rewardId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$reward_id", "$$rewardId"] },
											]
										},
									}
								},
								{ $group: { _id: null, count: { $sum: 1 } } }
							],
							as: "rewardSentCount"
						}
					},
					{
						$addFields: {
							reward_send_count: { $cond: [{ $arrayElemAt: ["$rewardSentCount.count", 0] }, { $arrayElemAt: ["$rewardSentCount.count", 0] }, 0] },
						}
					},
					{
						$match: {
							reward_send_count: { $gt: DEFAULT_ZERO }
						}
					},
					{ $project: { _id: 1 } },
				];

				const filteredRecordsPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$lookup: {
							from: TABLE_EARN_SENT_REWARDS,
							let: { rewardId: "$_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$reward_id", "$$rewardId"] },
											]
										},
									}
								},
								{ $group: { _id: null, count: { $sum: 1 } } }
							],
							as: "rewardSentCount"
						}
					},
					{
						$addFields: {
							reward_send_count: { $cond: [{ $arrayElemAt: ["$rewardSentCount.count", 0] }, { $arrayElemAt: ["$rewardSentCount.count", 0] }, 0] },
						}
					},
					{
						$match: {
							reward_send_count: { $gt: DEFAULT_ZERO }
						}
					},
					{ $project: { _id: 1 } },
				];

				// Run all queries in parallel using Promise.all
				const [redemptionList, totalRecordsArr, filteredRecordsArr] = await Promise.all([
					rewards.aggregate(listRedemptionPipeline).toArray(),
					rewards.aggregate(totalRecordsPipeline).toArray(),
					rewards.aggregate(filteredRecordsPipeline).toArray()
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: redemptionList || [],
					recordsTotal: totalRecordsArr ? totalRecordsArr.length : 0,
					recordsFiltered: filteredRecordsArr ? filteredRecordsArr.length : 0,
				});
			} catch (err) {
				// Handle errors and send error response
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsTotal: 0,
					recordsFiltered: 0,
				});
			}
		} else {
			// Render the view_redemptions page with user details
			try {
				req.breadcrumbs(BREADCRUMBS["admin/users/view_redemptions"]);
				const users = db.collection(TABLE_USERS);
				const userResult = await users.findOne(
					{ _id: newObjectIdDefault(userId) },
					{ projection: { complete_profile_reward: 1 } }
				);

				res.render("view_redemptions", {
					user_type: userType,
					user_id: userId,
					userErr: null,
					dynamic_variable: userBreadcrumbs(userType),
					completeReward: (userResult && userResult.complete_profile_reward) ? userResult.complete_profile_reward : {},
					dynamic_url: userType,
				});
			} catch (userErr) {
				res.render("view_redemptions", {
					user_type: userType,
					user_id: userId,
					userErr: userErr,
					dynamic_variable: userBreadcrumbs(userType),
					completeReward: {},
					dynamic_url: userType,
				});
			}
		}
	}; // End viewRedemptions()

	/**
	 * Async function for my wallet rewards listing (Admin).
	 * Uses async/await for all DB queries.
	 * Runs queries in parallel using Promise.all where needed.
	 * Handles errors gracefully and renders the my_wallet_rewards view or sends JSON.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {void}
	 */
	this.myWalletRewards = async (req, res) => {
		const userType = req.params && req.params.user_type ? req.params.user_type : "";
		const userId = req.params && req.params.id ? req.params.id : "";
		const fromDate = req.body && req.body.fromDate ? req.body.fromDate : "";
		const toDate = req.body && req.body.toDate ? req.body.toDate : "";
		const searchRewards = req.body && req.body.search_rewards ? req.body.search_rewards : "";

		const earnRewards = db.collection(TABLE_EARN_SENT_REWARDS);

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		const currentDate = newDate('', 'yyyy-mm-dd');
		const endtime = getUtcDate(currentDate + " 23:59:59");
		const startime = newDate(newDate());

		if (isPost(req)) {
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

			try {
				// Configure DataTable conditions
				const dataTableConfig = await configDatatable(req, res, null);

				let commonConditions = {
					user_id: newObjectIdDefault(userId),
					is_deleted: NOT_DELETED
				};

				// Date range filter
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Filter by new reward list
				if (searchRewards == MY_WALLET_STATUS) {
					commonConditions['is_redemed'] = NOT_REDEMED;
					commonConditions['$or'] = [
						{ "expiry_date": { $eq: "" } },
						{ "expiry_date": { $gte: startime } }
					];
				}

				// Filter by redeemed list
				if (searchRewards == REDEEMED_STATUS) {
					delete commonConditions['$or'];
					commonConditions['is_redemed'] = REDEMED;
				}

				// Filter by expired list
				if (searchRewards == EXPIRED_STATUS) {
					delete commonConditions['$or'];
					commonConditions['is_redemed'] = NOT_REDEMED;
					commonConditions['toogle_expiry_date'] = true;
					commonConditions['expiry_date'] = { $lte: endtime };
				}

				// Merge all conditions
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Prepare aggregation pipeline for wallet rewards list
				const walletRewardsPipeline = [
					{ $match: dataTableConfig.conditions },
					{
						$lookup: {
							from: TABLE_MASTERS,
							let: { businessIndustryId: "$business_industry_id" },
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
								{ "$project": { name: 1 } }
							],
							as: "businessIndustry"
						}
					},
					{
						$lookup: {
							from: TABLE_USERS,
							let: { sendByUserId: "$send_by" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $eq: ["$_id", "$$sendByUserId"] },
											]
										},
									}
								},
								{ "$project": { full_name: 1, profile_image: 1, slug: 1, email: 1, account_type: 1 } }
							],
							as: "sentUserDetails"
						}
					},
					{
						$lookup: {
							from: TABLE_MASTERS,
							let: { storeTypeId: "$store_type_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: [
												{ $in: ["$_id", "$$storeTypeId"] },
												{ $eq: ["$dropdown_type", MASTER_STORE_TYPE] },
											]
										},
									}
								},
								{ "$project": { name: 1 } }
							],
							as: "storeType"
						}
					},
					{
						$project: {
							"_id": 1,
							"user_id": 1,
							"reward_id": 1,
							"title": 1,
							"url_desc": 1,
							"image": 1,
							"send_by": 1,
							"is_redemed": 1,
							"slug": 1,
							"is_viewed": 1,
							"expiry_date": 1,
							"created": 1,
							"business_industry_id": 1,
							"redemption_code": 1,
							"business_industry_name": { $arrayElemAt: ["$businessIndustry.name", 0] },
							"sent_full_name": { $arrayElemAt: ["$sentUserDetails.full_name", 0] },
							"sent_email": { $arrayElemAt: ["$sentUserDetails.email", 0] },
							"sent_user_name": { $arrayElemAt: ["$sentUserDetails.slug", 0] },
							"sent_profile_image": { $arrayElemAt: ["$sentUserDetails.profile_image", 0] },
							"account_type": { $arrayElemAt: ["$sentUserDetails.account_type", 0] },
							"storeType": 1,
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Run all DB queries in parallel using Promise.all
				const [walletList, totalCount, filteredCount] = await Promise.all([
					// Get wallet rewards list
					earnRewards.aggregate(walletRewardsPipeline).toArray(),
					// Get total number of records in wallet rewards form
					earnRewards.countDocuments(commonConditions),
					// Get filter wise records count
					earnRewards.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: walletList || [],
					recordsTotal: totalCount || 0,
					recordsFiltered: filteredCount || 0,
				});
			} catch (error) {
				// Handle errors and send error response
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsTotal: 0,
					recordsFiltered: 0,
				});
			}
		} else {
			// Handle GET request: fetch dropdowns and render the view
			const options = {
				collections: [
					{
						collection: TABLE_MASTERS,
						columns: ["_id", "name"],
						conditions: { status: ACTIVE, dropdown_type: MASTER_BUSINESS_INDUSTRY },
					},
					{
						collection: TABLE_MASTERS,
						columns: ["_id", "name"],
						conditions: { status: ACTIVE, dropdown_type: MASTER_STORE_TYPE },
					}
				]
			};
			try {
				const response = await getDropdownList(req, res, options);
				// Render my_wallet_rewards page
				req.breadcrumbs(BREADCRUMBS["admin/users/my_wallet_rewards"]);
				return res.render("my_wallet_rewards", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					business_industry: (response && response.final_html_data && response.final_html_data["0"]) ? response.final_html_data["0"] : "",
					store_type_name: (response && response.final_html_data && response.final_html_data["1"]) ? response.final_html_data["1"] : "",
				});
			} catch (error) {
				// Handle errors and render the view with empty dropdowns
				req.breadcrumbs(BREADCRUMBS["admin/users/my_wallet_rewards"]);
				return res.render("my_wallet_rewards", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					business_industry: "",
					store_type_name: "",
				});
			}
		}
	}; // End myWalletRewards()

	/**
	 * Async function for wallet redeem rewards (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.walletRedeemRewards = async (req, res) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.id ? req.params.id : "";

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			// Sanitize incoming request body to prevent XSS
			req.body = sanitizeData(req.body, NOT_ALLOWED_TAGS_XSS);

			const rewardsSlug = req.body.rewards_slug ? req.body.rewards_slug : "";
			const redemptionCode = req.body.redemption_code ? req.body.redemption_code : "";

			let errMessageArray = [];

			// Validate redemption code
			if (!redemptionCode) {
				errMessageArray.push({
					param: 'redemption_code',
					msg: res.__("admin.wallet.please_enter_redemption_code")
				});
			}

			// Send error message if validation fails
			if (errMessageArray.length > 0) {
				return res.send({
					status: STATUS_ERROR,
					message: errMessageArray,
				});
			}

			// Prepare options for redeeming reward
			const optionWallets = {
				user_id: newObjectIdDefault(POCIAL_ID),
				slug: rewardsSlug,
				redemption_code: redemptionCode
			};

			try {
				// Redeem reward using async/await
				const response = await redeemRewardGlobally(req, res, optionWallets);

				if (response.status === STATUS_ERROR) {
					errMessageArray.push({
						param: 'redemption_code',
						msg: response.message
					});
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray,
					});
				} else {
					// Send success response
					req.flash(STATUS_SUCCESS, response.message);
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: `${WEBSITE_ADMIN_URL}users/${userType}/my_wallet_rewards/${userId}`,
						message: response.message
					});
				}
			} catch (error) {
				// Handle unexpected errors gracefully
				return res.send({
					status: STATUS_ERROR,
					message: [{ param: 'redemption_code', msg: error.message || "An error occurred" }]
				});
			}
		}
	}; // End walletRedeemRewards

	/**
	 * Async function to get list of followers & following users (Admin).
	 * Uses async/await for all DB queries.
	 * Runs queries in parallel using Promise.all where needed.
	 * Handles errors gracefully and renders the followers_following view or sends JSON.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {void}
	 */
	this.followersFollowingUsersList = async (req, res) => {
		const followTypePageUrl = req.params.follow_type_page ? req.params.follow_type_page : "";
		const userId = req.params.user_id ? req.params.user_id : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const fromDate = req.body.fromDate ? req.body.fromDate : "";
		const toDate = req.body.toDate ? req.body.toDate : "";

		let pipelineAndCondition = [];

		// Validate required parameters
		if (!userType || !userId || !followTypePageUrl) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		if (isPost(req)) {
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;
			const usersFollower = db.collection(TABLE_USERS_FOLLOWER_LIST);

			try {
				// Configure DataTable conditions
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common conditions for followers/following
				let commonConditions = {
					is_approved: ACTIVE,
					action_type: FOLLOW_ACTION_TYPE,
				};

				// Following-wise data fetch
				if (followTypePageUrl === FOLLOWING_ADMIN_URL) {
					commonConditions['followed_by'] = newObjectIdDefault(userId);
					pipelineAndCondition = [{ $eq: ["$_id", "$$followingByUserId"] }];
				}

				// Followers-wise data fetch
				if (followTypePageUrl === FOLLOWERS_ADMIN_URL) {
					commonConditions['user_id'] = newObjectIdDefault(userId);
					pipelineAndCondition = [{ $eq: ["$_id", "$$followedBy"] }];
				}

				// Date range filter
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				dataTableConfig.conditions = Object.assign({}, dataTableConfig.conditions, commonConditions);

				// Prepare aggregation pipeline for user list
				const userListPipeline = [
					{ $match: commonConditions },
					{
						$lookup: {
							from: TABLE_USERS,
							let: { followedBy: "$followed_by", followingByUserId: "$user_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: pipelineAndCondition
										},
									}
								},
								{ $project: { "_id": 1, "full_name": 1, "profile_image": 1, "email": 1, "account_type": 1, "slug": 1 } }
							],
							as: "user_details"
						}
					},
					{
						$project: {
							_id: 1,
							user_id: 1,
							action_type: 1,
							followed_by: 1,
							is_approved: 1,
							is_close_friend: 1,
							created: 1,
							user_full_name: { $arrayElemAt: ["$user_details.full_name", 0] },
							user_profile_image: { $arrayElemAt: ["$user_details.profile_image", 0] },
							user_email: { $arrayElemAt: ["$user_details.email", 0] },
							user_slug: { $arrayElemAt: ["$user_details.slug", 0] },
							account_type: { $arrayElemAt: ["$user_details.account_type", 0] },
						}
					},
					{ $match: dataTableConfig.conditions },
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Prepare aggregation pipeline for filtered count
				const filteredCountPipeline = [
					{ $match: commonConditions },
					{
						$lookup: {
							from: TABLE_USERS,
							let: { followedBy: "$followed_by", followingByUserId: "$user_id" },
							pipeline: [
								{
									$match: {
										$expr: {
											$and: pipelineAndCondition
										},
									}
								},
								{ $project: { "_id": 1, "full_name": 1, "profile_image": 1, "email": 1, "account_type": 1, "slug": 1 } }
							],
							as: "user_details"
						}
					},
					{
						$project: {
							_id: 1,
							user_id: 1,
							action_type: 1,
							followed_by: 1,
							is_approved: 1,
							is_close_friend: 1,
							created: 1,
							user_full_name: { $arrayElemAt: ["$user_details.full_name", 0] },
							user_profile_image: { $arrayElemAt: ["$user_details.profile_image", 0] },
							user_email: { $arrayElemAt: ["$user_details.email", 0] },
							user_slug: { $arrayElemAt: ["$user_details.slug", 0] },
							account_type: { $arrayElemAt: ["$user_details.account_type", 0] },
						}
					},
					{ $match: dataTableConfig.conditions },
				];

				// Run queries in parallel using Promise.all
				const [userList, totalRecords, filteredRecordsArr] = await Promise.all([
					usersFollower.aggregate(userListPipeline).toArray(),
					usersFollower.countDocuments(commonConditions),
					usersFollower.aggregate(filteredCountPipeline).toArray()
				]);

				// Send response
				res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: userList || [],
					recordsFiltered: filteredRecordsArr ? filteredRecordsArr.length : 0,
					recordsTotal: totalRecords || 0
				});
			} catch (err) {
				// Handle errors and send error response
				res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render the followers_following view with user details and counts
			try {
				if (followTypePageUrl === FOLLOWERS_ADMIN_URL) {
					req.breadcrumbs(BREADCRUMBS["admin/users/followers"]);
				} else {
					req.breadcrumbs(BREADCRUMBS["admin/users/following"]);
				}

				const followersAndFollowingCount = await getFollowingAndFollowersCount(userId);

				res.render("followers_following", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					followTypePageUrl: followTypePageUrl,
					followers_count: followersAndFollowingCount['followers_count'] ? followersAndFollowingCount['followers_count'] : 0,
					following_count: followersAndFollowingCount['following_count'] ? followersAndFollowingCount['following_count'] : 0,
				});
			} catch (err) {
				// Handle errors and render the view with error details
				res.render("followers_following", {
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					followTypePageUrl: followTypePageUrl,
					followers_count: 0,
					following_count: 0,
					error: err
				});
			}
		}
	}; // End followersFollowingUsersList

	/**
	 * Async function to get user details for modal open (Admin).
	 * Uses async/await for DB query.
	 * Handles errors gracefully and sends JSON response.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.getUserListModalOpen = async (req, res) => {
		try {
			// Extract and sanitize user ID from request parameters
			const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
			const collection = db.collection(TABLE_USERS);

			// Fetch user details by ID using async/await
			const resultdata = await collection.findOne({ _id: userId });

			if (resultdata) {
				// User found, send success response
				return res.send({
					status: STATUS_SUCCESS,
					result: resultdata
				});
			} else {
				// User not found, send error response
				return res.send({
					status: STATUS_ERROR,
					result: {}
				});
			}
		} catch (error) {
			// Handle unexpected errors gracefully
			return res.send({
				status: STATUS_ERROR,
				result: {}
			});
		}
	}; // End getUserListModalOpen

	/**
	 * Async function to view dashboard leads subscriber (Admin).
	 * Uses async/await for all DB queries.
	 * Runs queries in parallel using Promise.all where needed.
	 * Handles errors gracefully and renders the dashboard_leads_subscriber view or sends JSON.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.viewDashboardLeadsSubscriber = async (req, res) => {
		const stageLevel = req.params.stage_level ? req.params.stage_level : "";
		const fromDate = req.body.fromDate ? req.body.fromDate : "";
		const toDate = req.body.toDate ? req.body.toDate : "";

		if (isPost(req)) {
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;
			const collection = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			// Set base conditions
			let commonConditions = { is_deleted: NOT_DELETED };

			// If stage level is provided, override conditions
			if (stageLevel !== '') {
				commonConditions = { stage_level: stageLevel };
			}

			try {
				// Configure DataTable conditions
				const dataTableConfig = await configDatatable(req, res, null);
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions['created'] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Prepare aggregation pipeline for leads subscriber list
				const leadsListPipeline = [
					{ $match: dataTableConfig.conditions },
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
								{ "$project": { profile_image: 1, account_type: 1, email: 1 } }
							],
							as: "userDetails"
						}
					},
					{
						$addFields: {
							"userDetails": 0,
							"profile_image": { $arrayElemAt: ["$userDetails.profile_image", 0] },
							"account_type": { $arrayElemAt: ["$userDetails.account_type", 0] },
						}
					},
					{ $sort: dataTableConfig.sort_conditions },
					{ $skip: skip },
					{ $limit: limit },
				];

				// Run queries in parallel using Promise.all
				const [
					leadsList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get leads form subscriber list
					collection.aggregate(leadsListPipeline).toArray(),
					// Get total number of records in subscriber form collection
					collection.countDocuments(commonConditions),
					// Get filtered records counting in subscriber form
					collection.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: leadsList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (error) {
				// Handle errors and send error response
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			// Render listing page
			req.breadcrumbs(BREADCRUMBS["admin/dashboard_leads_subscriber"]);
			return res.render("dashboard_leads_subscriber", {
				stage_level: stageLevel,
			});
		}
	}; // End viewDashboardLeadsSubscriber

	/**
	 * Async function to view lead's subscriber detail (Admin).
	 * Uses async/await for all DB queries.
	 * Handles errors gracefully and renders the dashboard_view_lead_subscribers view.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.viewLeadsSubscriberDetails = async (req, res, next) => {
		try {
			// Extract leadsId from request parameters
			const leadsId = req.params.id ? req.params.id : "";

			// Validate required parameter
			if (!leadsId) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}

			const collection = db.collection(TABLE_SIGNUP_LEAD_FORMS);

			// Build aggregation pipeline for fetching lead subscriber details
			const pipeline = [
				{
					$match: {
						_id: newObjectIdDefault(leadsId),
					}
				},
				{
					$lookup: {
						from: TABLE_USERS,
						let: { creatorId: "$creator_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$creatorId"] },
										]
									},
								}
							},
							{ "$project": { full_name: 1, email: 1 } }
						],
						as: "creatorUserDetails"
					}
				},
				{
					$lookup: {
						from: TABLE_LEAD_FORMS,
						let: { leadFormsId: "$lead_forms_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$_id", "$$leadFormsId"] },
										]
									},
								}
							},
							{ "$project": { title: 1 } }
						],
						as: "leadsDetails"
					}
				},
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
							{ "$project": { profile_image: 1, account_type: 1, email: 1 } }
						],
						as: "userDetails"
					}
				},
				{
					$project: {
						"messageBoxValue": 1,
						"dropDownTitleValue": 1,
						"message_box_title": 1,
						"type_dropdown_title": 1,
						"first_name": 1,
						"last_name": 1,
						"full_name": 1,
						"zip": 1,
						"gender": 1,
						"dob": 1,
						"mobile": 1,
						"email": 1,
						"image_name": 1,
						"leads_title": { $arrayElemAt: ["$leadsDetails.title", 0] },
						"creator_full_name": { $arrayElemAt: ["$creatorUserDetails.full_name", 0] },
						"creator_email": { $arrayElemAt: ["$creatorUserDetails.email", 0] },
						"profile_image": { $arrayElemAt: ["$userDetails.profile_image", 0] },
						"account_type": { $arrayElemAt: ["$userDetails.account_type", 0] },
					}
				},
			];

			// Execute aggregation pipeline using async/await
			const result = await collection.aggregate(pipeline).toArray();

			// Render the view with the result
			req.breadcrumbs(BREADCRUMBS["admin/dashboard_view_leads_subscriber"]);
			return res.render("dashboard_view_lead_subscribers", {
				result: (result && result.length > 0) ? result[0] : {}
			});
		} catch (error) {
			// Pass error to next middleware for error handling
			return next(error);
		}
	}; // End viewLeadsSubscriberDetails()

	/**
	 * Async function to delete user image (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.userDeleteImage = async (req, res) => {
		try {
			// Extract and sanitize parameters
			const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
			const imageType = req.params.image_type ? req.params.image_type : "";
			const userType = req.params.user_type ? req.params.user_type : "";

			// Validate required parameters
			if (!userType || !userId || !imageType) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}

			// Fetch user data using async/await
			const userResult = await db.collection(TABLE_USERS).findOne(
				{ _id: userId },
				{ projection: { "profile_image": 1, "public_business_informaton.reward_image": 1, "public_business_informaton.business_banner": 1 } }
			);

			if (!userResult) {
				// User not found, send error response
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/edit/${userId}`);
			}

			// Extract image names based on type
			const profileImage = userResult.profile_image || "";
			const bannerImage = (userResult.public_business_informaton && userResult.public_business_informaton.business_banner) ? userResult.public_business_informaton.business_banner : "";
			const rewardImage = (userResult.public_business_informaton && userResult.public_business_informaton.reward_image) ? userResult.public_business_informaton.reward_image : "";

			let imageName = "";
			if (imageType === USER_PROFILE_IMAGE_DELETE) {
				imageName = profileImage;
			} else if (imageType === USER_BANNER_IMAGE_DELETE) {
				imageName = bannerImage;
			} else if (imageType === USER_REWARD_IMAGE_DELETE) {
				imageName = rewardImage;
			}

			// Prepare options for dynamic image deletion
			const optionsImage = {
				user_id: userId,
				image_name: imageName,
				image_type: imageType,
			};

			// Call the dynamic image delete function using await
			const deleteImageResponse = await deleteImageDynamicFunction(req, res, optionsImage);

			if (deleteImageResponse.status === STATUS_SUCCESS) {
				// Send success response
				req.flash(STATUS_SUCCESS, deleteImageResponse.message);
			} else {
				// Send error response
				req.flash(STATUS_ERROR, deleteImageResponse.message);
			}
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}/edit/${userId}`);
		} catch (error) {
			// Handle unexpected errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${req.params.user_type || ""}/edit/${req.params.user_id || ""}`);
		}
	}; // End userDeleteImage

	/**
	 * Async function to view earn sent reward detail (Admin).
	 * Uses async/await for all DB queries.
	 * Handles errors gracefully and renders the view_earn_sent_reward view.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.viewEarnSentReward = async (req, res, next) => {
		const userId = req.params.user_id ? req.params.user_id : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const rewardSlug = req.params.slug ? req.params.slug : "";

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		const rewards = db.collection(TABLE_REWARDS);

		// Set common conditions for reward lookup
		const commonConditions = {
			slug: rewardSlug,
			user_id: newObjectIdDefault(userId),
			is_deleted: NOT_DELETED
		};

		try {
			// Prepare aggregation pipeline for fetching reward details and attachments
			const pipeline = [
				{ $match: commonConditions },
				{
					$lookup: { // Lookup for attached email leads (newsletter templates)
						from: TABLE_EMAIL_NEWSLETTER_TEMPLATE,
						let: { rewardId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$attach_reward", "$$rewardId"] },
											{ $eq: ["$is_deleted", NOT_DELETED] },
										]
									},
								}
							},
							{ $project: { question: "$subject", type: { $literal: "lead" } } }
						],
						as: "attachedEmailLeads"
					}
				},
				{
					$lookup: { // Lookup for polls attached to this reward
						from: TABLE_POLLS,
						localField: "_id",
						foreignField: "options.assign_reward",
						as: "pollsAttachmentDetails"
					}
				},
				{
					$addFields: {
						attachment_details: { $concatArrays: ["$attachedEmailLeads", "$pollsAttachmentDetails"] }
					}
				},
				{
					$project: {
						_id: 1,
						created: 1,
						expiry_date: 1,
						url_desc: 1,
						attachment_details: 1
					}
				}
			];

			// Execute aggregation pipeline using async/await
			const resultArr = await rewards.aggregate(pipeline).toArray();

			req.breadcrumbs(BREADCRUMBS["admin/users/view_earn_sent_reward"]);
			return res.render("view_earn_sent_reward", {
				user_type: userType,
				user_id: userId,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userId,
				result: (resultArr && resultArr[0]) ? resultArr[0] : {},
			});
		} catch (error) {
			// Handle errors and pass to next middleware
			return next(error);
		}
	}; // End viewEarnSentReward

	/**
	 * Async function to update user's segment status (Admin).
	 * Uses async/await for DB query.
	 * Handles errors gracefully and sends appropriate responses.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.updateUserSegmentStatus = async (req, res, next) => {
		const userId = req.params.id ? req.params.id : "";
		const statusType = req.params.status_type ? req.params.status_type : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !statusType || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Prepare update condition and data
		const segmentCondition = { "_id": newObjectIdDefault(userId) };
		let updateData = { modified: getUtcDate() };
		let messageData = "";

		// Set show_segment value and message based on statusType
		if (statusType == SEGMENT_SHOW_USERNAME) {
			updateData['show_segment'] = false;
			messageData = res.__("admin.user.segment_show_username_updated_successfully");
		} else if (statusType == SEGMENT_SHOW_EMAIL) {
			updateData['show_segment'] = true;
			messageData = res.__("admin.user.segment_show_email_updated_successfully");
		}

		try {
			// Update user's segment status using async/await
			await users.updateOne(segmentCondition, { $set: updateData });

			// Send success response
			req.flash(STATUS_SUCCESS, messageData);
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
		} catch (error) {
			// Handle errors and send error response
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
		}
	}; // End updateUserSegmentStatus()

	/**
	 * Async function to update user's access platform (Admin).
	 * Uses async/await for DB query.
	 * Handles errors gracefully and sends appropriate responses.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.updateAllowAccessPlatform = async (req, res, next) => {
		const userId = req.params.user_id ? req.params.user_id : "";
		const statusType = req.params.status_type ? req.params.status_type : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !statusType || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Prepare update condition and data
		const platformCondition = { "_id": newObjectIdDefault(userId) };
		const updateData = {
			'allows_access_platform_in_admin': statusType,
			'master_turn_on_date': "",
			'modified': getUtcDate()
		};

		try {
			// Update user's access platform using async/await
			await users.updateOne(platformCondition, { $set: updateData });

			// Cancel customer plan after updating the user
			const cancelOptions = {
				'user_id': userId,
				'cancellation_reason': ""
			};
			await userCancelSubscriptionsPlan(cancelOptions);

			// Send success response
			req.flash(STATUS_SUCCESS, res.__("admin.user.master_turn_off_successfully"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
		} catch (error) {
			// Handle errors and send error response
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(`${WEBSITE_ADMIN_URL}users/${userType}`);
		}
	}; // End updateAllowAccessPlatform()

	/**
	 * Async function to update user's master turn on date (Admin).
	 * Uses async/await for all DB queries.
	 * Handles errors gracefully and sends appropriate responses.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.addMasterTurnOnDate = async (req, res, next) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.body.user_id ? req.body.user_id : "";
		const allowsAccessStatus = req.body.allows_access_status ? req.body.allows_access_status : "";
		const masterTurnOnDate = req.body.master_turn_on_date ? req.body.master_turn_on_date : "";
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Prepare update condition and data
		const platformCondition = { "_id": newObjectIdDefault(userId) };
		const updateData = {
			'master_turn_on_date': newDate(masterTurnOnDate),
			'allows_access_platform_in_admin': allowsAccessStatus,
			'allows_access_platform_in_created_date': getUtcDate()
		};

		try {
			// Update user's master turn on date and access platform using async/await
			await users.updateOne(platformCondition, { $set: updateData });

			// Fetch user details for plan purchase
			const userDetails = await users.findOne(
				{ '_id': newObjectIdDefault(userId) },
				{ projection: { 'full_name': 1, 'email': 1 } }
			);

			// Prepare plan purchase data
			const planPurchaseData = {
				'user_id': userId,
				'plan': PLAN_NAME_FOR_ALLOWS_ACCESS_PLATFORM_ADMIN,
				'customer_email': userDetails?.email || "",
				'customer_name': userDetails?.full_name || "",
				'payment_status': PAYMENT_STATUS_SUCCEEDED,
				'subscription_status': SUBSCRIPTION_ACTIVE_STATUS,
				'plan_status': PAYMENT_PLAN_ACTIVE,
				'currency': CURRENCY_USD,
				'plan_type': PLAN_FOR_ALLOWS_ACCESS_PLATFORM_ADMIN,
				'expiry_date': newDate(masterTurnOnDate),
				'plan_lookup_key': PLAN_FOR_ALLOWS_ACCESS_PLATFORM_ADMIN
			};

			// Insert user plan purchase data using async/await
			await userPlanPurchase(req, res, planPurchaseData);

			// Send success response
			req.flash(STATUS_SUCCESS, res.__("admin.user.master_turn_on_successfully"));
			return res.send({
				status: STATUS_SUCCESS,
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
				message: res.__("admin.user.master_turn_on_successfully"),
			});
		} catch (error) {
			// Handle errors and send error response
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again1"));
			return res.send({
				status: STATUS_ERROR,
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
				message: res.__("admin.system.something_going_wrong_please_try_again1"),
			});
		}
	}; // End addMasterTurnOnDate

	/**
	 * Async function to update auto pay status for a user (Admin).
	 * Uses async/await for all DB queries and service calls.
	 * Handles errors gracefully and sends appropriate responses.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.updateAutoPayStatus = async (req, res, next) => {
		const userId = req.params.user_id ? req.params.user_id : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			// Fetch user details to get subscription id using async/await
			const detailResult = await users.findOne(
				{ "_id": newObjectIdDefault(userId) },
				{ projection: { _id: 1, subscription_id: 1 } }
			);

			if (!detailResult) {
				req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
				return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
			}

			const subscriptionId = detailResult.subscription_id ? detailResult.subscription_id : "";

			// Cancel Stripe subscription plan using async/await
			const response = await cancelStripeSubscriptionPlan(req, res, userId, subscriptionId);

			if (response.status === STATUS_SUCCESS) {
				// Send success response
				req.flash(STATUS_SUCCESS, response.message);
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			} else {
				// Send error response
				req.flash(STATUS_ERROR, response.message);
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			}
		} catch (error) {
			// Handle unexpected errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again1"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
		}
	}; // End updateAutoPayStatus()

	/**
	 * Async function to cancel a user's subscription plan (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles all DB/service calls in a clean, readable manner.
	 * Runs notification and email sending in parallel.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.cancelUserSubscriptions = async (req, res, next) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? req.params.user_id : "";
		const subscriptionId = req.params.subscription_id ? req.params.subscription_id : "";

		const users = db.collection(TABLE_USERS);
		const cancelCollection = db.collection(TABLE_CANCEL_SUBSCRIPTION);

		// Validate required parameters
		if (!userType || !userId || !subscriptionId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			// Get Stripe secret key and initialize Stripe
			const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
			const stripe = require('stripe')(paymentSecretKey);

			// Step 1: Retrieve the subscription from Stripe
			const subscription = await stripe.subscriptions.retrieve(subscriptionId);

			// Step 2: Check if subscription is active and not already canceled
			if (subscription.status === 'active' && subscription.status !== 'canceled') {
				try {
					// Step 3: Cancel the subscription at the end of the current billing period
					await stripe.subscriptions.update(subscriptionId, {
						cancel_at_period_end: true,
					});

					// Step 4: Fetch user details
					const userDetails = await users.findOne(
						{ "_id": newObjectIdDefault(userId) },
						{ projection: { _id: 1, full_name: 1, email: 1 } }
					);

					const userEmail = (userDetails && userDetails.email) ? userDetails.email : "";
					const userName = (userDetails && userDetails.full_name) ? userDetails.full_name : "";

					// Step 5: Update user record to clear subscription fields
					const optionsData = {
						'subscription_id': "",
						'subscription_item_id': "",
						'client_secret': "",
						'plan_lookup_key': "",
						'plan_price_id': "",
					};
					await updateUserRecordsIdAccording(userId, optionsData);

					// Step 6: Prepare email and notification options
					const emailOptions = {
						to: userEmail,
						action: "cancel_subscription",
						rep_array: [DEAR_HI_CONSTANT, userName]
					};
					const notificationMessageParams = [userName];
					const notificationOptions = {
						notification_data: {
							notification_type: NOTIFICATION_SEND_CANCE_SUBSCRIPTION,
							message_params: notificationMessageParams,
							parent_table_id: userId,
							user_id: userId,
							user_ids: [userId],
							user_role_id: FRONT_ADMIN_ROLE_ID,
							role_id: FRONT_ADMIN_ROLE_ID,
							extra_parameters: {
								'user_id': newObjectIdDefault(userId),
								'subscription_id': subscriptionId,
							}
						}
					};

					// Step 7: Run email and notification in parallel
					await Promise.all([
						sendMail(req, res, emailOptions),
						insertNotifications(req, res, notificationOptions)
					]);

					// Step 8: Insert cancel subscription record
					await cancelCollection.insertOne({
						'user_id': userId,
						'subscription_id': subscriptionId,
						'created': getUtcDate(),
					});

					// Step 9: Send success response
					req.flash(STATUS_SUCCESS, res.__("front.payment_gateway.subscription_canceled_at_the_end_of_the_current_billing_period"));
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);

				} catch (error) {
					// Handle errors during cancellation process
					req.flash(STATUS_ERROR, res.__("front.system.something_going_wrong_please_try_again"));
					return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
				}
			} else {
				// Subscription is already canceled
				req.flash(STATUS_ERROR, res.__("front.payment_gateway.this_plan_already_cancelled"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			}
		} catch (error) {
			// Handle errors during Stripe or DB operations
			req.flash(STATUS_ERROR, res.__("front.payment_gateway.subscription_not_available"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
		}
	}; // End cancelUserSubscriptions

	/**
	 * Async function to view plan details (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles errors gracefully and renders the view_plan page.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.viewPlanDetails = async (req, res, next) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.id ? req.params.id : "";

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			// Step 1: Get user details by ID
			const conditionOptions = { conditions: { "_id": newObjectIdDefault(userId) } };
			const userDetailResponse = await getUserDetailBySlug(req, res, conditionOptions);
			const userData = userDetailResponse && userDetailResponse.result ? userDetailResponse.result : {};
			const exceedLimit = userData && userData.exceed_limit ? userData.exceed_limit : {};

			// Step 2: Get available plan details for user
			const optionsData = { 'user_details': userData };
			const responseAvailablePlan = await availablePlanDetailsForUser(req, res, optionsData);

			if (responseAvailablePlan.status === STATUS_SUCCESS) {
				let availablePlan = responseAvailablePlan.result ? responseAvailablePlan.result : {};
				let planTypeName = "";

				// Step 3: Attach exceed limit and limit valid to available plan
				for (let activity in availablePlan) {
					const activityType = availablePlan[activity].activity_type;
					planTypeName = availablePlan[activity].plan_type_name;
					const activityLimit = activityType + '_limit_valid';

					if (exceedLimit[activityType]) {
						availablePlan[activity]['exceed_limit'] = exceedLimit[activityType];
					}

					if (exceedLimit[activityLimit]) {
						availablePlan[activity]['limit_valid'] = exceedLimit[activityLimit];
					}
				}

				// Step 4: Render the view_plan page with all details
				req.breadcrumbs(BREADCRUMBS["admin/users/view_plan"]);
				return res.render("view_plan", {
					result: availablePlan,
					user_type: userType,
					user_id: userId,
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					plan_type_name: planTypeName,
					exceed_limit: exceedLimit
				});
			} else {
				// Handle case where plan details are not available
				req.flash(STATUS_ERROR, res.__("admin.payment_gateway.not_available"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			}
		} catch (err) {
			// Handle unexpected errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.payment_gateway.not_available"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
		}
	}; // End viewPlanDetails

	/**
	 * Async function to update plan data for a user (Admin).
	 * Uses async/await for DB query.
	 * Handles errors gracefully and sends JSON response.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Callback argument to the middleware function
	 * @return {Promise<void>}
	 */
	this.updatePlanData = async (req, res) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.body.user_id ? req.body.user_id : "";
		const exceedLimit = req.body.exceed_limit ? req.body.exceed_limit : [];
		const activityType = req.body.activity_type ? req.body.activity_type : [];

		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Prepare exceed limit data object
		const exceedPlanData = activityType.reduce((acc, activity, index) => {
			acc[activity] = exceedLimit[index] ? parseInt(exceedLimit[index]) : 0;
			return acc;
		}, {});

		// Build update condition and data
		const condition = { "_id": newObjectIdDefault(userId) };
		const updateData = { 'exceed_limit': exceedPlanData };

		try {
			// Update user's exceed_limit field using async/await
			const updateResult = await users.updateOne(condition, { $set: updateData });

			if (updateResult && updateResult.modifiedCount > 0) {
				// Send success response
				req.flash(STATUS_SUCCESS, res.__("admin.user.exceed_limit_successfully"));
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/view_plan/" + userId,
					message: res.__("admin.user.exceed_limit_successfully"),
				});
			} else {
				// Handle case where no document was modified
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/view_plan/" + userId,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} catch (err) {
			// Handle unexpected errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.send({
				status: STATUS_ERROR,
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/view_plan/" + userId,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // End updatePlanData

	/**
	 * Async function to update plan limit days/month for a user (Admin).
	 * Uses async/await for all DB queries.
	 * Handles errors gracefully and sends JSON response.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.updatePlanLimitDaysMonth = async (req, res) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.body.user_id ? req.body.user_id : "";
		const toogleType = req.body.toogle_type ? req.body.toogle_type : "";
		const activityType = req.body.activity_type ? req.body.activity_type : "";

		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Build update condition and data
		const condition = { "_id": newObjectIdDefault(userId) };
		let updateData = {};

		// If updating all limits, set all relevant fields
		if (activityType == ALL_LIMIT_VALID) {
			updateData['exceed_limit.email_create_limit_valid'] = toogleType;
			updateData['exceed_limit.social_post_limit_valid'] = toogleType;
			updateData['exceed_limit.reward_create_limit_valid'] = toogleType;
			updateData['exceed_limit.poll_create_limit_valid'] = toogleType;
			updateData['exceed_limit.email_send_limit_valid'] = toogleType;
			updateData['exceed_limit.seo_blog_limit_valid'] = toogleType;
			updateData['exceed_limit.campaign_reachout_limit_valid'] = toogleType;
			updateData['exceed_limit.all_limit_valid'] = toogleType;
		} else {
			updateData["exceed_limit." + activityType] = toogleType;
		}

		try {
			// Update user's exceed_limit fields using async/await
			const updateResult = await users.updateOne(condition, { $set: updateData });

			if (updateResult && updateResult.modifiedCount > 0) {
				// Send success response
				req.flash(STATUS_SUCCESS, res.__("admin.user.exceed_limit_successfully"));
				return res.send({
					status: STATUS_SUCCESS,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/view_plan/" + userId,
					message: res.__("admin.user.exceed_limit_successfully"),
				});
			} else {
				// Handle case where no document was modified
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.send({
					status: STATUS_ERROR,
					redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/view_plan/" + userId,
					message: res.__("admin.system.something_going_wrong_please_try_again"),
				});
			}
		} catch (error) {
			// Handle unexpected errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.send({
				status: STATUS_ERROR,
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/view_plan/" + userId,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // End updatePlanLimitDaysMonth

	/**
	 * Async function to manage offline payment acceptance for a user (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.acceptPaymentOffline = async (req, res) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.id ? newObjectIdDefault(req.params.id) : "";
		const priceToggle = req.params.price_toggle ? req.params.price_toggle : PRICE_MONTHLY;
		const users = db.collection(TABLE_USERS);
		const monthYearToggle = (priceToggle == PRICE_YEARLY);

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		try {
			// Fetch user offline payment details
			const userOfflineplanDetails = await users.findOne(
				{ '_id': userId },
				{ projection: { 'full_name': 1, 'email': 1, 'offline_payment_details': 1 } }
			);

			if (isPost(req)) {
				// Extract and sanitize POST data
				const paymentType = req.body.payment_type ? req.body.payment_type : "";
				const planPriceId = req.body.plan_price_id ? req.body.plan_price_id : "";
				const plan = req.body.plan ? req.body.plan : "";
				const amount = req.body.amount ? Number(req.body.amount) : "";
				const chequeNumber = req.body.cheque_number ? req.body.cheque_number : "";
				const upiId = req.body.upi_id ? req.body.upi_id : "";
				const planLookupKey = req.body.plan_lookup_key ? req.body.plan_lookup_key : "";
				const usdAmount = amount ? amount * 100 : "";

				// Update user's offline payment details using async/await
				const updateResult = await users.updateOne(
					{ '_id': newObjectIdDefault(userId) },
					{
						$set: {
							'offline_payment_details': {
								'plan': plan,
								'amount': amount,
								'upi_id': upiId,
								'plan_price_id': planPriceId,
								'plan_lookup_key': planLookupKey,
								'cheque_number': chequeNumber,
								'payment_type': paymentType,
							},
							'modified': getUtcDate(),
						}
					}
				);

				if (updateResult && updateResult.modifiedCount > 0) {
					// Prepare plan purchase data
					let planPurchaseData = {
						'user_id': userId,
						'plan': plan,
						'amount': usdAmount,
						'upi_id': upiId,
						'plan_price_id': planPriceId,
						'plan_lookup_key': planLookupKey,
						'cheque_number': chequeNumber,
						'payment_method': paymentType,
						'customer_email': userOfflineplanDetails?.email || "",
						'customer_name': userOfflineplanDetails?.full_name || "",
						'payment_status': PAYMENT_STATUS_SUCCEEDED,
						'subscription_status': SUBSCRIPTION_ACTIVE_STATUS,
						'plan_status': PAYMENT_PLAN_ACTIVE,
						'currency': CURRENCY_USD,
					};

					// Add plan type according to lookup key
					if (
						planLookupKey == PLAN_PRODUCT_199_PREMIUM_LOOKUP_KEY ||
						planLookupKey == PLAN_PRODUCT_2149_PREMIUM_LOOKUP_KEY
					) {
						planPurchaseData['plan_type'] = PLAN_FOR_199_PREMIUM;
					} else if (
						planLookupKey == PLAN_PRODUCT_249_PREMIUM_PLUS_LOOKUP_KEY ||
						planLookupKey == PLAN_PRODUCT_2689_PREMIUM_PLUS_LOOKUP_KEY
					) {
						planPurchaseData['plan_type'] = PLAN_FOR_249_PREMIUM_PLUS;
					} else if (
						planLookupKey == SOCIAL_ONLY_59_PER_MONTH_LOOKUP_KEY ||
						planLookupKey == SOCIAL_ONLY_649_PER_ANNUALLY_LOOKUP_KEY
					) {
						planPurchaseData['plan_type'] = PLAN_FOR_SOCIAL_ONLY;
					} else if (
						planLookupKey == SOCIAL_PLUS_99_PER_MONTH_LOOKUP_KEY ||
						planLookupKey == SOCIAL_PLUS_1089_PER_ANNUALLY_LOOKUP_KEY
					) {
						planPurchaseData['plan_type'] = PLAN_FOR_SOCIAL_PLUS;
					} else if (planLookupKey == PLAN_FOR_FREE) {
						planPurchaseData['plan_type'] = PLAN_FOR_FREE;
					}

					// Insert user plan purchase data
					const planPurchase = await userPlanPurchase(req, res, planPurchaseData);

					// Return success message
					req.flash(planPurchase.status, planPurchase.message);
					return res.send({
						status: planPurchase.status,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType,
						message: planPurchase.message,
					});
				} else {
					// Handle case where update failed
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/offline_payment/" + userId,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					});
				}
			} else {
				// Handle GET request: fetch Stripe prices and render the view
				const userOfflinePayment = userOfflineplanDetails && userOfflineplanDetails.offline_payment_details
					? userOfflineplanDetails.offline_payment_details
					: "";
				const togglePlanLookupKey = monthYearToggle
					? YEARLY_PLAN_PRODUCT_LOOKUP_KEY_ARRAY
					: PLAN_PRODUCT_LOOKUP_KEY_ARRAY;

				// Get Stripe secret key and initialize Stripe
				const paymentSecretKey = res.locals.settings["Payment.payment_secret_key"];
				const stripe = require('stripe')(paymentSecretKey);

				// Fetch prices from Stripe
				const prices = await stripe.prices.list({
					lookup_keys: togglePlanLookupKey,
					expand: ['data.product']
				});

				// Sort prices by amount (ascending)
				prices.data.sort((a, b) => a.unit_amount - b.unit_amount);
				let pricesData = prices && prices.data ? prices.data : [];

				// Add free plan to prices data
				pricesData.push({
					"id": PLAN_PRODUCT_PRICE_FREE_ID,
					"lookup_key": "free",
					"product": {
						"description": PLAN_PRODUCT_PRICE_FREE_DESCRIPTION,
						"name": PLAN_PRODUCT_PRICE_FREE_NAME,
					},
					"unit_amount": 0,
				});

				// Render offline payment page
				req.breadcrumbs(BREADCRUMBS["admin/users/offline_payment"]);
				return res.render("offline_payment", {
					'user_type': userType,
					'price_data': pricesData,
					'dynamic_variable': userBreadcrumbs(userType),
					'dynamic_url': userType,
					'offline_plan_details': userOfflinePayment,
					'price_toggle': priceToggle,
					'user_id': userId,
				});
			}
		} catch (error) {
			// Handle unexpected errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.send({
				status: STATUS_ERROR,
				redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/offline_payment/" + userId,
				message: res.__("admin.system.something_going_wrong_please_try_again"),
			});
		}
	}; // End acceptPaymentOffline

	/**
	 * Async function to get enterprise upload list (Admin).
	 * Uses async/await for all DB queries.
	 * Runs queries in parallel using Promise.all where needed.
	 * Handles errors gracefully and renders the enterprise_upload_list view or sends JSON.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.getEnterpriseUploadList = async (req, res) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";

		// Validate required parameters
		if (!userType || !userId) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);
		const users = db.collection(TABLE_USERS);

		if (isPost(req)) {
			const fromDate = req.body.fromDate ? req.body.fromDate : "";
			const toDate = req.body.toDate ? req.body.toDate : "";
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;

			try {
				// Configure DataTable conditions
				const dataTableConfig = await configDatatable(req, res, null);

				// Set common conditions for enterprise upload
				const commonConditions = {
					'user_id': userId,
					'is_deleted': NOT_DELETED,
				};
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Add date range filter if provided
				if (fromDate !== "" && toDate !== "") {
					dataTableConfig.conditions["created"] = {
						$gte: newDate(fromDate),
						$lte: newDate(toDate),
					};
				}

				// Run queries in parallel using Promise.all
				const [
					uploadList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get list of enterprise uploads
					enterpriseUpload.find(dataTableConfig.conditions)
						.collation(COLLATION_VALUE)
						.sort({ "created": SORT_DESC })
						.limit(limit)
						.skip(skip)
						.toArray(),
					// Get total number of records in enterprise upload collection
					enterpriseUpload.countDocuments(commonConditions),
					// Get filtered records counting in enterprise upload collection
					enterpriseUpload.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: uploadList || [],
					recordsFiltered: filteredRecords || 0,
					recordsTotal: totalRecords || 0
				});
			} catch (error) {
				// Handle errors and send error response
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsFiltered: 0,
					recordsTotal: 0
				});
			}
		} else {
			try {
				// Fetch user data for rendering the view
				const userData = await users.findOne(
					{ "_id": newObjectIdDefault(userId) },
					{ projection: { enterprise: 1, slug: 1, public_business_informaton: 1 } }
				);
				const nameOfBusiness = userData?.public_business_informaton?.name_of_the_business || userData?.slug || "";

				// Render the enterprise_upload_list page
				req.breadcrumbs(BREADCRUMBS["admin/users/enterprise_upload_list"]);
				return res.render("enterprise_upload_list", {
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					user_type: userType,
					user_id: userId,
					enterprise: userData?.enterprise || "",
					name_of_business: nameOfBusiness,
				});
			} catch (error) {
				// Handle errors and render the view with empty data
				req.breadcrumbs(BREADCRUMBS["admin/users/enterprise_upload_list"]);
				return res.render("enterprise_upload_list", {
					dynamic_variable: userBreadcrumbs(userType),
					dynamic_url: userType,
					user_type: userType,
					user_id: userId,
					enterprise: "",
					name_of_business: "",
					error: error
				});
			}
		}
	}; // End getEnterpriseUploadList

	/**
	 * Async function to upload Enterprise Sheet (Admin).
	 * Uses async/await for all DB/service calls.
	 * Handles all DB/service calls in a clean, readable manner.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.uploadEnterpriseSheet = async (req, res) => {
		const userType = req.params.user_type ? req.params.user_type : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";

		if (isPost(req)) {
			const title = req.body.title || "";
			const extension = req.body.extension || "";
			const fileName = req.body.file_name || "";
			const columnName = req.body.column_name || [];
			let errMessageArray = [];
			let mendatoryIgandWebsiteUrlFlag = [];

			// If file extension and file name are present, process column selection and save to DB
			if (extension && fileName) {
				// Validate required columns and check for Instagram/Website URL column selection
				ENTERPRISE_FIXED_COLUMN_NAME.forEach((records, index) => {
					const selectedColumn = req.body['select_column' + index];
					if ((selectedColumn === '' || typeof selectedColumn === 'undefined') && index === 1) {
						errMessageArray.push({
							param: 'select_column' + index,
							msg: res.__("admin.leads_file.please_select_column")
						});
					}
					// Instagram or Website URL column selection check
					if ((selectedColumn !== '' && typeof selectedColumn !== 'undefined') && (index === 2 || index === 3)) {
						mendatoryIgandWebsiteUrlFlag.push(true);
					}
				});

				// Final check for IG or Website URL
				if (mendatoryIgandWebsiteUrlFlag.length === 0) {
					errMessageArray.push({
						param: 'ig_wesite_url',
						msg: res.__("admin.users.please_select_at_least_one_column")
					});
				}

				// If there are validation errors, send error response
				if (errMessageArray.length > 0) {
					return res.send({
						status: STATUS_ERROR,
						message: errMessageArray
					});
				}

				// Prepare column array and selected column objects
				const columnArray = ENTERPRISE_FIXED_COLUMN_NAME.map((_, index) => {
					return req.body['select_column' + index] ? Number(req.body['select_column' + index]) : "";
				});
				const selectedColumnName = columnName ? columnName.split(',') : [];
				const selectedColumnindex = columnArray;
				const columnSelectedObject = ENTERPRISE_FIXED_COLUMN_NAME.map((recordSelected, indexSelected) => {
					const selectedColumnIndex = selectedColumnindex[indexSelected];
					return {
						fix_column_name: recordSelected,
						selected_column_index: selectedColumnIndex,
						selected_column_name: selectedColumnName[selectedColumnIndex],
					};
				});

				// Prepare slug options and generate slug using async/await
				const slugOptions = {
					title: title,
					table_name: TABLE_ENTERPRISE_UPLOAD_SHEETS,
					slug_field: "slug"
				};
				let slug = "";
				try {
					const slugResponse = await getDatabaseSlug(slugOptions);
					slug = slugResponse?.title || "";
				} catch (slugErr) {
					// Handle slug generation error
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/enterprise_upload_list/" + userId,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					});
				}

				// Insert enterprise upload sheet record using async/await
				try {
					const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);
					await enterpriseUpload.insertOne({
						title: title,
						file_name: fileName,
						extension: extension,
						user_id: userId,
						column: columnArray,
						column_name: selectedColumnName,
						all_column_value: columnSelectedObject,
						status: LEADS_PENDING_EXCEL_PROCESS,
						warning_records: DEFAULT_ZERO,
						total_records: DEFAULT_ZERO,
						success_records: DEFAULT_ZERO,
						failed_records: DEFAULT_ZERO,
						slug: slug,
						is_deleted: NOT_DELETED,
						created: getUtcDate(),
					});
					// Send success response
					req.flash(STATUS_SUCCESS, res.__("admin.user.enterprises_uploaded_successfully"));
					return res.send({
						status: STATUS_SUCCESS,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/enterprise_upload_list/" + userId,
						message: res.__("admin.user.enterprises_uploaded_successfully"),
					});
				} catch (insertErr) {
					// Handle DB insert error
					req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
					return res.send({
						status: STATUS_ERROR,
						redirect_url: WEBSITE_ADMIN_URL + "users/" + userType + "/enterprise_upload_list/" + userId,
						message: res.__("admin.system.something_going_wrong_please_try_again"),
					});
				}
			} else {
				// If file is not yet uploaded, process the first column using async/await
				try {
					const responseFile = await getExcelFirstColumnData(req, res);
					if (responseFile.status === STATUS_SUCCESS) {
						return res.send({
							status: STATUS_SUCCESS,
							extension: responseFile.extension,
							file_name: responseFile.file_name,
							result: responseFile.result,
						});
					} else {
						return res.send({
							status: STATUS_ERROR,
							extension: responseFile.extension,
							file_name: responseFile.file_name,
							message: [{ param: 'user_import_file', msg: responseFile.message }]
						});
					}
				} catch (fileErr) {
					return res.send({
						status: STATUS_ERROR,
						message: [{ param: 'user_import_file', msg: fileErr.message || "An error occurred" }]
					});
				}
			}
		} else {
			// Render the upload enterprise sheet page for GET request
			req.breadcrumbs(BREADCRUMBS["admin/users/upload_enterprise"]);
			return res.render("upload_enterprise", {
				user_type: userType,
				user_id: userId,
				dynamic_variable: userBreadcrumbs(userType),
				dynamic_url: userId,
			});
		}
	}; // End uploadEnterpriseSheet()

	/**
	 * Async function to update Enterprise Status (Admin).
	 * Uses async/await for DB query.
	 * Handles errors gracefully and sends appropriate flash messages and redirects.
	 */
	this.updateEnterpriseStatus = async (req, res, next) => {
		const userId = req.params.user_id ? req.params.user_id : "";
		const statusType = req.params.status_type ? req.params.status_type : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const users = db.collection(TABLE_USERS);

		// Validate required parameters
		if (!userId || !statusType || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Build update condition and data
		const condition = { "_id": newObjectIdDefault(userId) };
		const updateData = {
			'enterprise': statusType,
			'modified': getUtcDate()
		};

		try {
			// Update enterprise status using async/await
			const updateResult = await users.updateOne(condition, { $set: updateData });

			if (updateResult && updateResult.modifiedCount > 0) {
				// Set success message based on statusType
				const message = (statusType == ALLOW_ENTERPRISE)
					? res.__("admin.user.enterprises_allowed_successfully")
					: res.__("admin.user.enterprises_not_allowed_successfully");

				req.flash(STATUS_SUCCESS, message);
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			} else {
				// If no document was modified, treat as error
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
			}
		} catch (error) {
			// Handle DB errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType);
		}
	}; // End updateEnterpriseStatus

	/**
	 * Async function to delete Enterprise (Admin).
	 * Uses async/await for all DB queries.
	 * Handles errors gracefully and sends appropriate flash messages and redirects.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @param {Function} next - Next middleware
	 * @return {Promise<void>}
	 */
	this.deleteEnterprise = async (req, res) => {
		const userId = req.params.user_id ? req.params.user_id : "";
		const id = req.params.id ? req.params.id : "";
		const userType = req.params.user_type ? req.params.user_type : "";
		const enterpriseUpload = db.collection(TABLE_ENTERPRISE_UPLOAD_SHEETS);

		// Validate required parameters
		if (!userId || !id || !userType) {
			req.flash(STATUS_ERROR, res.__("admin.system.invalid_access"));
			return res.redirect(WEBSITE_ADMIN_URL + "dashboard");
		}

		// Build condition for enterprise delete
		const condition = {
			"_id": newObjectIdDefault(id),
			"user_id": newObjectIdDefault(userId)
		};

		try {
			// Fetch enterprise data by condition
			const enterpriseData = await enterpriseUpload.findOne(condition);
			const fileData = enterpriseData?.upload_enterprise_file || "";

			// If you want to remove the file from storage, you can use the following (uncomment and implement removeFile if needed)
			// const imagesData = {
			// 	file_path: fileData ? ENTERPRISE_UPLOAD_EXCEL_FILE_PATH + fileData : ""
			// };
			// await removeFile(imagesData);

			// Mark the enterprise upload as deleted
			const updateResult = await enterpriseUpload.updateOne(condition, {
				$set: {
					'is_deleted': DELETED
				}
			});

			if (updateResult && updateResult.modifiedCount > 0) {
				// Send success response
				req.flash(STATUS_SUCCESS, res.__("admin.user.enterprises_deleted_successfully"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/enterprise_upload_list/" + userId);
			} else {
				// If no document was modified, treat as error
				req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
				return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/enterprise_upload_list/" + userId);
			}
		} catch (error) {
			// Handle DB errors gracefully
			req.flash(STATUS_ERROR, res.__("admin.system.something_going_wrong_please_try_again"));
			return res.redirect(WEBSITE_ADMIN_URL + "users/" + userType + "/enterprise_upload_list/" + userId);
		}
	}; // End deleteEnterprise

	/**
	 * Async function to get logs details of import users data (Admin).
	 * Uses async/await for all DB queries.
	 * Runs queries in parallel using Promise.all.
	 * Handles errors gracefully and sends JSON or renders the view.
	 *
	 * @param {Object} req - Request Data
	 * @param {Object} res - Response Data
	 * @return {Promise<void>}
	 */
	this.enterPriseImportDetails = async (req, res) => {
		const enterpriseId = req.params.id ? newObjectIdDefault(req.params.id) : "";
		const userId = req.params.user_id ? newObjectIdDefault(req.params.user_id) : "";
		const userType = req.params.user_type ? req.params.user_type : "";

		if (isPost(req)) {
			const limit = req.body.length ? parseInt(req.body.length) : ADMIN_LISTING_LIMIT;
			const skip = req.body.start ? parseInt(req.body.start) : DEFAULT_SKIP;
			const enterpriseImportLogs = db.collection(TABLE_ENTERPRISE_IMPORTS);

			const commonConditions = {
				'user_id': userId,
				'enterprise_id': enterpriseId,
			};

			try {
				// Configure DataTable conditions
				const dataTableConfig = await configDatatable(req, res, null);
				dataTableConfig.conditions = Object.assign(dataTableConfig.conditions, commonConditions);

				// Run queries in parallel using Promise.all
				const [
					importLogsList,
					totalRecords,
					filteredRecords
				] = await Promise.all([
					// Get paginated import logs
					enterpriseImportLogs.find(dataTableConfig.conditions)
						.collation(COLLATION_VALUE)
						.sort(dataTableConfig.sort_conditions)
						.limit(limit)
						.skip(skip)
						.toArray(),
					// Get total number of records in import file collection
					enterpriseImportLogs.countDocuments(commonConditions),
					// Get filtered records counting in import file
					enterpriseImportLogs.countDocuments(dataTableConfig.conditions)
				]);

				// Send response
				return res.send({
					status: STATUS_SUCCESS,
					draw: dataTableConfig.result_draw,
					data: importLogsList || [],
					recordsTotal: totalRecords || 0,
					recordsFiltered: filteredRecords || 0
				});
			} catch (error) {
				// Handle errors and send error response
				return res.send({
					status: STATUS_ERROR,
					draw: 0,
					data: [],
					recordsTotal: 0,
					recordsFiltered: 0
				});
			}
		} else {
			// Render listing page
			req.breadcrumbs(BREADCRUMBS["admin/users/enterprise_import_details"]);
			return res.render("enterprise_import_details", {
				'user_type': userType,
				'user_id': userId,
				'dynamic_variable': userBreadcrumbs(userType),
				'dynamic_url': userId,
				'enterprise_id': enterpriseId
			});
		}
	}; // End enterPriseImportDetails

	/**
	 * Async function to handle Excel file upload.
	 * Wraps the uploadedExcelFile callback in a Promise and uses async/await for clean handling.
	 * @param {Object} req - Request object
	 * @param {Object} res - Response object
	 * @param {Object} file - Uploaded file object
	 * @param {String} filePath - Path to save the file
	 * @param {String} oldPath - Old file path (if any)
	 * @returns {Promise<Object>} - Resolves with upload response or rejects with error
	 */
	const uploadedExcelFilePromise = async (req, res, file, filePath, oldPath) => {
		return new Promise((resolve, reject) => {
			uploadedExcelFile(req, res, file, filePath, oldPath, (responseType, response) => {
				if (responseType === STATUS_ERROR) {
					// Reject promise if upload failed
					return reject(response);
				}
				// Resolve promise if upload succeeded
				return resolve(response);
			});
		});
	};
}
module.exports = new User();
