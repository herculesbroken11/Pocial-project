function Middleware() {

	/**
	 * Function for Authenticate Access
	*/
	this.authenticateAccess = function (req, res, next, method_name, slug, authenticateAccessCallback) {
		let urlPath = req.path + "/" + method_name;
		let url = '/api/front_bases_api_response/';
		switch (urlPath) {
			
			case url + 'regenerateJWT':

				/** JWT Authentication **/
				let jwtOption = {
					token: (req.headers.authorization) ? req.headers.authorization : "",
					secretKey: JWT_CONFIG.secret,
					slug: slug
				}
			
				JWTAuthentication(req, res, jwtOption).then(responseData => {
					if (responseData.status == STATUS_ERROR) {
						sendInvalidAccessHeaders(res, STATUS_ERROR, authenticateAccessCallback);
					} else {
						sendvalidAccessHeaders(res, STATUS_SUCCESS, authenticateAccessCallback);
					}
				});
				break;

			default:
				sendvalidAccessHeaders(res, STATUS_ERROR, authenticateAccessCallback);
		}
	};

	/**Function for send Invalid Access Headers*/
	function sendInvalidAccessHeaders(res, RESPONSE_STATUS_ERROR, authenticateAccessCallback) {
		authenticateAccessCallback(false);
	}

	/**Function for send valid Access Headers*/
	function sendvalidAccessHeaders(res, RESPONSE_STATUS_SUCCESS, authenticateAccessCallback) {
		authenticateAccessCallback(true);
	}
}

module.exports = new Middleware();
