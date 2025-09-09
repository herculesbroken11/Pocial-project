function newsletterSubscribe() {

	/**
	 * Function to save newsletter subscribers using async/await for faster response.
	 *
	 * @param req 		As Request Data
	 * @param res 		As Response Data
	 * @param email		As email
	 *
	 * @return json
	 */
	this.isNewsletterSubscribe = async (req, res) => {
		let emailNewsletterSubscribedEncId = req.params.subscribed_user_slug ? req.params.subscribed_user_slug : "";
		const users = db.collection(TABLE_USERS);
		let finalResponse = {};

		try {
			// Find the user with the given newsletter subscription encoded ID
			const user = await users.findOne({ 'email_newsletter_subscribed_enc_id': emailNewsletterSubscribedEncId }, { projection: { _id: 1 } });

			if (user) {
				// Update the user's newsletter subscription status
				const updateResult = await users.updateOne({
					'email_newsletter_subscribed_enc_id': emailNewsletterSubscribedEncId
				}, {
					$set: {
						'email_newsletter_subscribed': DEFAULT_ONE,
						'email_newsletter_subscribed_enc_id': ""
					}
				});

				if (updateResult && updateResult.modifiedCount > 0) {
					finalResponse = {
						'data': {
							status: STATUS_SUCCESS,
							message: res.__("front.newsletter.subscribed_successfully"),
						}
					};
				} else {
					finalResponse = {
						'data': {
							status: STATUS_ERROR,
							message: res.__("front.system.you_are_not_allowed_to_access_this_page"),
						}
					};
				}
				return returnApiResult(req, res, finalResponse);
			} else {
				finalResponse = {
					'data': {
						status: STATUS_ERROR,
						message: res.__("admin.user.link_expired_or_wrong_link"),
					}
				};
				return returnApiResult(req, res, finalResponse);
			}
		} catch (err) {
			finalResponse = {
				'data': {
					status: STATUS_ERROR,
					message: res.__("front.system.something_going_wrong_please_try_again"),
				}
			};
			return returnApiResult(req, res, finalResponse);
		}
	}; // end isNewsletterSubscribe()

}
module.exports = new newsletterSubscribe();
