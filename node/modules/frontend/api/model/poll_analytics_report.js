function PollEngagementReport() {

	/**
	 * Function to get poll engagement view report using async/await for faster response.
	 */
	this.pollEngagementViewReport = async (req, res) => {
		let finalResponse = {};

		// Extract user and date range from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
		};

		try {
			// Fetch poll engagement view reports (single async query)
			const responseViewLogs = await pollViewReports(req, res, options);

			finalResponse = {
				data: {
					status: responseViewLogs.status,
					result: (responseViewLogs && responseViewLogs.poll_logs) ? responseViewLogs.poll_logs : {},
					message: responseViewLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollEngagementViewReport()

	/**
	 * Function to get poll engagement vote report.
	 * Uses async/await for faster response.
	 */
	this.pollEngagementVoteReport = async (req, res) => {
		let finalResponse = {};

		// Extract user and date range from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";
		const unregisteredParticipants = req.body.unregistered_participants ? true : false;

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
			unregistered_participants: unregisteredParticipants,
		};

		try {
			// Fetch poll engagement vote reports (single async query)
			const responseVotesLogs = await pollVoteReports(req, res, options);

			finalResponse = {
				data: {
					status: responseVotesLogs.status,
					result: (responseVotesLogs && responseVotesLogs.poll_logs) ? responseVotesLogs.poll_logs : {},
					message: responseVotesLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollEngagementVoteReport()

	/**
	 * Function to get poll engagement vote graph report.
	 * Uses async/await for all DB queries for faster response.
	 * Runs independent queries in parallel where possible.
	 */
	this.pollEngagementGraphVoteReport = async (req, res) => {
		let finalResponse = {};

		// Extract user and request details
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";
		const unregisteredParticipants = req.body.unregistered_participants ? true : false;
		const viewTypeFilter = req.body.view_type_filter ? req.body.view_type_filter : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
			unregistered_participants: unregisteredParticipants,
			view_type_filter: viewTypeFilter,
		};

		try {
			// Fetch poll engagement vote graph reports (single async query)
			const responseViewLogs = await pollVoteGraphReports(req, res, options);

			finalResponse = {
				data: {
					status: responseViewLogs.status,
					result: (responseViewLogs && responseViewLogs.poll_logs) ? responseViewLogs.poll_logs : {},
					message: responseViewLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollEngagementGraphVoteReport()

	/**
	 * Function to get share icon report details data using async/await for faster response.
	 */
	this.pollShareIconReport = async (req, res) => {
		let finalResponse = {};

		// Extract user and date range from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";
		const unregisteredParticipants = req.body.unregistered_participants ? true : false;
		const viewTypeFilter = req.body.view_type_filter ? req.body.view_type_filter : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
			unregistered_participants: unregisteredParticipants,
			view_type_filter: viewTypeFilter,
		};

		try {
			// Fetch share icon report data (single async query)
			const responseViewLogs = await pollShareIconResult(req, res, options);

			finalResponse = {
				data: {
					status: responseViewLogs.status,
					result: (responseViewLogs && responseViewLogs.poll_logs) ? responseViewLogs.poll_logs : {},
					message: responseViewLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollShareIconReport()

	/**
	 * Function to get poll engagement view graph report.
	 * Uses async/await for faster response.
	 */
	this.pollEngagementViewGraphReport = async (req, res) => {
		let finalResponse = {};

		// Extract user and date range from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
		};

		try {
			// Fetch poll engagement view graph data (single async query)
			const responseViewLogs = await pollViewGraphData(req, res, options);

			finalResponse = {
				data: {
					status: responseViewLogs.status,
					result: (responseViewLogs && responseViewLogs.result) ? responseViewLogs.result : [],
					message: responseViewLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollEngagementViewGraphReport()

	/**
	 * Function to get poll average session duration graph using async/await.
	 * All DB/async queries are awaited for faster and cleaner response.
	 */
	this.pollEngagementAverageSessionDurationGraph = async (req, res) => {
		let finalResponse = {};

		// Extract user and date range from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
		};

		try {
			// Fetch average session duration graph data (single awaited query)
			const responseAverageSessionView = await pollViewAverageSessionDurationGraphData(req, res, options);

			finalResponse = {
				data: {
					status: responseAverageSessionView.status,
					result: (responseAverageSessionView && responseAverageSessionView.result) ? responseAverageSessionView.result : [],
					message: responseAverageSessionView.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollEngagementAverageSessionDurationGraph()

	/**
	 * Function to get poll opt-in graph data using async/await for faster response.
	 * All DB queries are awaited for clean, predictable flow.
	 */
	this.pollEngagementOptInGraph = async (req, res) => {
		let finalResponse = {};

		// Extract user and date range from request
		const loginUserData = req.user_data ? req.user_data : "";
		const userId = loginUserData._id ? loginUserData._id : "";
		const fromDate = req.body.from_date ? req.body.from_date : "";
		const toDate = req.body.to_date ? req.body.to_date : "";

		// Validate required fields
		if (!userId || !fromDate || !toDate) {
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: {},
					message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}

		const options = {
			user_id: newObjectIdDefault(userId),
			from_date: fromDate,
			to_date: toDate,
		};

		try {
			// Fetch opt-in graph data (single awaited query)
			const responseOptInViewLogs = await pollViewOptInGraphData(req, res, options);

			finalResponse = {
				data: {
					status: responseOptInViewLogs.status,
					result: (responseOptInViewLogs && responseOptInViewLogs.result) ? responseOptInViewLogs.result : [],
					message: responseOptInViewLogs.message,
				}
			};
			return returnApiResult(req, res, finalResponse);
		} catch (error) {
			// Handle errors gracefully
			finalResponse = {
				data: {
					status: STATUS_ERROR,
					result: [],
					message: error.message || res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end pollEngagementOptInGraph()
}
module.exports = new PollEngagementReport();