const async = require('async');

function EmailDrip() {

	/**
	 * Function to generate the email drip campaign
	 * @param {*} req 
	 * @param {*} res 
	 * @return json 
	 **/
	this.generateEmailDripCampaign = (req, res) => {
		let finalResponse = {};
		/** get user id get **/
		let loginUserData = (req.user_data) ? req.user_data : "";
		let userId = (loginUserData._id) ? loginUserData._id : "";

	}

}
module.exports = new EmailDrip();