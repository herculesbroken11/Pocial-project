const async = require('async');

function Notification() {

	/**
	 * Function to get notifications using async/await for faster response.
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.getNotifications = async (req, res, next) => {
		let finalResponse = {};

		// Get user id from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const page = req.body.page ? parseInt(req.body.page) : 1;
		const limit = req.body.limit ? parseInt(req.body.limit) : API_DEFAULT_LIMIT;
		const skip = (limit * page) - limit;

		const condition = {
			user_id: newObjectIdDefault(userId),
			is_deleted: { $ne: DELETED },
		};

		const conditionNotSeen = {
			...condition,
			is_read: NOT_SEEN
		};

		const notifications = db.collection(TABLE_NOTIFICATIONS);

		try {
			// Run all queries in parallel for better performance
			const [
				notificationList,
				totalRecords,
				notSeenCount
			] = await Promise.all([
				// Get notifications list
				notifications.find(
					condition,
					{
						projection: {
							message: 1,
							is_seen: 1,
							is_read: 1,
							created: 1,
							title: 1,
							notification_type: 1,
							extra_parameters: 1,
							is_deleted: 1
						}
					}
				)
					.collation(COLLATION_VALUE)
					.sort({ created: SORT_DESC })
					.limit(limit)
					.skip(skip)
					.toArray(),

				// Get total number of records
				notifications.countDocuments(condition),

				// Get total number of not seen records
				notifications.countDocuments(conditionNotSeen)
			]);

			if (notificationList && notificationList.length > 0) {
				const total_page = Math.ceil((totalRecords || 0) / limit);
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: notificationList,
						recordsTotal: totalRecords || 0,
						not_seen: notSeenCount || 0,
						limit: limit,
						page: page,
						message: "",
						total_page: total_page
					}
				};
			} else {
				finalResponse = {
					data: {
						status: STATUS_SUCCESS,
						result: [],
						recordsTotal: 0,
						not_seen: 0,
						limit: limit,
						page: page,
						message: res.__("front.global.no_record_found"),
						total_page: 0
					}
				};
			}
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle errors gracefully
			return next(err);
		}
	}; // End getNotifications()

	/**
	 * Function for getting unread notifications count using async/await for faster response.
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.getUnreadNotificationCount = async (req, res, next) => {
		// Extract user id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};
		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Set common conditions for unread notifications
		let commonConditions = {
			user_id: newObjectIdDefault(userId),
			is_deleted: { $ne: DELETED },
			is_read: NOT_SEEN
		};

		try {
			const notifications = db.collection(TABLE_NOTIFICATIONS);

			// Get count of unseen notifications using async/await
			const count = await notifications.countDocuments(commonConditions);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: count || 0,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getUnreadNotificationCount()

	/**
	 * Function to mark a notification as read using async/await for faster response.
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.markAsReadNotification = async (req, res) => {
		// Extract user id from request
		let loginUserData = req.user_data ? req.user_data : "";
		let userId = loginUserData._id ? loginUserData._id : "";

		// Extract notification id from request body
		let notificationId = req.body.notification_id ? req.body.notification_id : DEACTIVE;

		let finalResponse = {};
		if (userId === '' || !notificationId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		let updateData = {
			modified: getUtcDate(),
			is_read: READ,
		};

		try {
			const notifications = db.collection(TABLE_NOTIFICATIONS);

			// Update the notification as read using async/await
			const result = await notifications.updateOne(
				{ _id: newObjectIdDefault(notificationId) },
				{ $set: updateData }
			);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: result,
					message: res.__("front.notifications.notifications_mark_as_read_successfully")
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End markAsReadNotification()

	/**
	 * Function for Mark as read all notifications
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @param next	As 	Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.markAsReadAllNotification = async (req, res) => {
		// Extract user id from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		let finalResponse = {};
		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const updateData = {
			modified: getUtcDate(),
			is_read: READ,
		};

		try {
			const notifications = db.collection(TABLE_NOTIFICATIONS);

			// Mark all notifications as read for the user using async/await
			const result = await notifications.updateMany(
				{ user_id: newObjectIdDefault(userId) },
				{ $set: updateData }
			);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: result,
					message: res.__("front.notifications.all_notifications_mark_as_read_successfully")
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End markAsReadAllNotification()

	/**
	 * Function for deleting notifications using async/await for faster response.
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.deleteNotifications = async (req, res) => {
		let finalResponse = {};
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const notificationIds = req.body.notification_ids ? req.body.notification_ids : [];
		const deleteType = req.body.delete_type ? req.body.delete_type : "";
		let conditionUpdateNotification = {};

		// Permission check
		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const notifications = db.collection(TABLE_NOTIFICATIONS);

		// Build base condition for notifications belonging to the user
		let notificationsCondition = {
			user_id: newObjectIdDefault(userId)
		};

		// If specific notification IDs are provided and deleteType is not set, delete selected notifications
		if (deleteType === '' && notificationIds.length > 0) {
			const notificationIdsArray = notificationIds.map(id => newObjectIdDefault(id));
			notificationsCondition['$and'] = [
				{ _id: { $in: notificationIdsArray } }
			];
			conditionUpdateNotification = notificationsCondition;
		}
		// If deleteType is set to delete all, delete all notifications for the user
		else if (deleteType === NOTIFICATION_ALL_DELETE) {
			conditionUpdateNotification = notificationsCondition;
		} else {
			// If neither, return error (no valid delete condition)
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		// Set update data for marking notifications as deleted
		const updateData = {
			is_deleted: DELETED,
			modified: getUtcDate()
		};

		try {
			// Update notifications as deleted using async/await
			const result = await notifications.updateMany(conditionUpdateNotification, { $set: updateData });

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: result,
					message: res.__("front.notifications.notification_has_been_delete_successfully")
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End deleteNotifications()

	/**
	 * Function for user on/off notifications using async/await for faster response.
	 *
	 * @param req   As Request Data
	 * @param res   As Response Data
	 * @param next  As Callback argument to the middleware function
	 *
	 * @return render/json
	 */
	this.userOnOffNotifications = async (req, res) => {
		let finalResponse = {};
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const userOnOffStatus = req.body.on_off_status ? req.body.on_off_status : OFF_NOTIFICATION_STATUS;
		const realTime = req.body.real_time ? req.body.real_time : [];
		const dailyDigest = req.body.daily_digest ? req.body.daily_digest : [];
		const weeklyDigest = req.body.weekly_digest ? req.body.weekly_digest : [];
		const monthlyDigest = req.body.monthly_digest ? req.body.monthly_digest : [];

		// Permission check: Ensure user is authenticated
		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const optionsNotification = {
			user_id: userId,
			on_off_status: userOnOffStatus,
			real_time: realTime,
			daily_digest: dailyDigest,
			weekly_digest: weeklyDigest,
			monthly_digest: monthlyDigest,
		};

		try {
			// Save notification settings using async/await for faster response
			await saveNotificationSettingsSave(optionsNotification);

			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: {},
					message: res.__("front.notification.notification_settings_has_been_updated_successfully"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End userOnOffNotifications()

	/**
	 * Function for user notification settings list using async/await for faster response.
	 *
	 * @param req As Request Data
	 * @param res As Response Data
	 * @return render/json
	 */
	this.getNotificationSettingsList = async (req, res) => {
		let finalResponse = {};
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";

		// Permission check: Ensure user is authenticated
		if (!userId) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const masters = db.collection(TABLE_MASTERS);

		try {
			// Aggregate notification groups and their templates in a single query for efficiency
			const result = await masters.aggregate([
				{
					$match: {
						status: ACTIVE,
						dropdown_type: MASTER_NOTIFICATION_GROUPS
					}
				},
				{
					$lookup: {
						from: TABLE_NOTIFICATION_TEMPLATES,
						let: { notificationGroupId: "$_id" },
						pipeline: [
							{
								$match: {
									$expr: {
										$and: [
											{ $eq: ["$notification_group_id", "$$notificationGroupId"] },
										]
									},
								}
							},
							{ $project: { "_id": 1, "name": 1, "subject": 1, "notification_type": 1 } }
						],
						as: "notification_list"
					}
				},
				{
					$project: {
						_id: 1,
						name: 1,
						created: 1,
						notification_list: 1,
					}
				},
				{ $sort: { created: SORT_DESC } },
				{
					$match: {
						notification_list: { $exists: true, $ne: [] }
					}
				},
			]).toArray();

			// Send success response
			finalResponse = {
				data: {
					status: STATUS_SUCCESS,
					result: result,
					message: ""
				}
			};
			return returnApiResult(req, res, finalResponse);

		} catch (err) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.something_going_wrong_please_try_again")
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // End getNotificationSettingsList()

}
module.exports = new Notification();