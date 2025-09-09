// let pocialEmbedBackendUrl_{{CURRENT_SCRIPT_ID}}	=	'https://pocialadmin.stage2.demo321.com/';
// let pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}}		=	'https://pocialadmin.stage2.demo321.com/';
// let PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}}    =	'https://pocial.stage2.demo321.com/';

// let pocialEmbedBackendUrl_{{CURRENT_SCRIPT_ID}} = 'https://admin.stage.pocial.com/';
// let pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} = 'https://api.pocial.com/';
// let PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}} = 'https://app.pocial.com/';

// let pocialEmbedBackendUrl_{{CURRENT_SCRIPT_ID}} = 'https://admin-uat2.pocial.com/';
// let pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} = 'https://api-uat2.pocial.com/';
// let PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}} = 'https://app-uat2.pocial.com/';

// let pocialEmbedBackendUrl_{{CURRENT_SCRIPT_ID}} = 'https://admin-demo.pocial.com/';
// let pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} = 'https://api-demo.pocial.com/';
// let PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}} = 'https://app-demo.pocial.com/';

var responseText = `let pocialEmbedBackendUrl_{{CURRENT_SCRIPT_ID}} = 'http://pocial.dev3.gipl.inet:21010/';
let pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} = 'http://pocial.dev3.gipl.inet:21010/';
let PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}} = 'http://pocial.dev3.gipl.inet:21090/';

let pocialBackendPublicPath_{{CURRENT_SCRIPT_ID}} = pocialEmbedBackendUrl_{{CURRENT_SCRIPT_ID}} + "admin/";
let pocialEmbedJsCssPath_{{CURRENT_SCRIPT_ID}} = pocialBackendPublicPath_{{CURRENT_SCRIPT_ID}} + "pocial_poll_embed/";
let thirdPartySiteUrl_{{CURRENT_SCRIPT_ID}} = (window.location.href) ? window.location.href : "";

let singleOption_{{CURRENT_SCRIPT_ID}} = 'single';
let frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} = PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/';
let noImageUrl_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'p-logo.svg';
let undecidedImageUrl_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'undecided-polls-image.svg';
let fullscreenPopup_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'fullscreen.svg';
let embedLoadingImg_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'loading.gif';
let pocialRewardPLogo_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'logo.svg';
let pocialRewardColorFullImage_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'embed-reward-bg-img.svg';
let pocialSininSignupNextIcon_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'right-arrow.svg';
let pocialWalletIcon_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'wallet-icon.svg';
let pocialUserNoImage_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'user-no-image.svg';
let pocialCrossIconImage_{{CURRENT_SCRIPT_ID}} = frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'embed-close-icon.svg';
let uniqueViewRandomString_{{CURRENT_SCRIPT_ID}} = new Date().getTime();
let pollEndVotingPeriod_{{CURRENT_SCRIPT_ID}} = "";
let pollVoteCurrentTimeInSeconds{{CURRENT_SCRIPT_ID}} = "";
let targetTimeInSeconds_{{CURRENT_SCRIPT_ID}} = "";

/**generate unique browser id */
var getUniqueBrowserId_{{CURRENT_SCRIPT_ID}} = localStorage.getItem("unique_browser_embed_id");
if (getUniqueBrowserId_{{CURRENT_SCRIPT_ID}} == null) {
	generateUniqueBrowserEmbedID_{{CURRENT_SCRIPT_ID}}();
}

/** Function for use to generate unique browser embed ID  */
function generateUniqueBrowserEmbedID_{{CURRENT_SCRIPT_ID}}() {
	let uniqueBrowserId_{{CURRENT_SCRIPT_ID}} = new Date().getTime();
	localStorage.setItem("unique_browser_embed_id", uniqueBrowserId_{{CURRENT_SCRIPT_ID}});
	getUniqueBrowserId_{{CURRENT_SCRIPT_ID}} = localStorage.getItem("unique_browser_embed_id");
}

/*** Function used to check device view type */
let isViewType_{{CURRENT_SCRIPT_ID}} = '';
if (/iPhone|iPod|iPad/i.test(navigator.userAgent)) {
	isViewType_{{CURRENT_SCRIPT_ID}} = "embed_ios"
} else if (/Android/i.test(navigator.userAgent)) {
	isViewType_{{CURRENT_SCRIPT_ID}} = "embed_android"
} else if (/Windows|linux/i.test(navigator.userAgent)) {
	isViewType_{{CURRENT_SCRIPT_ID}} = "embed_desktop"
}

let customUrl_{{CURRENT_SCRIPT_ID}} = "";
let pocialTextSettings_{{CURRENT_SCRIPT_ID}} = "";
let pocialValidateString_{{CURRENT_SCRIPT_ID}} = "";
let pocialOTPTimerOn_{{CURRENT_SCRIPT_ID}} = true;
let pocialOTPMinuteTime_{{CURRENT_SCRIPT_ID}} = 600;
let pocialForgetResetValidateString_{{CURRENT_SCRIPT_ID}} = "";
let debugJsonView_{{CURRENT_SCRIPT_ID}} = 0;
let showTosterSuccessMessage_{{CURRENT_SCRIPT_ID}} = "";
let showTosterErrorMessage_{{CURRENT_SCRIPT_ID}} = "";
let assignReward_{{CURRENT_SCRIPT_ID}} = "";
let pollDetailId_{{CURRENT_SCRIPT_ID}} = "";

/**api send data */
let sendObjectString_{{CURRENT_SCRIPT_ID}} = { 'data': { 'unique_browser_id': getUniqueBrowserId_{{CURRENT_SCRIPT_ID}}, 'slug': '', 'third_party_site_url': thirdPartySiteUrl_{{CURRENT_SCRIPT_ID}} }, 'device_id': '', 'device_type': '', 'device_token': '', 'embed_type': true };

/**Function for use to send request data */
function sendRequestData_{{CURRENT_SCRIPT_ID}}(pocialRequestData) {
	if (debugJsonView_{{CURRENT_SCRIPT_ID}} == 1) {
		return pocialRequestData   // simpe json data
	} else {
		return window.btoa(pocialRequestData);  // decrypt data convert to encrypt data
	}
}

/**Function for use to response request data */
function receivedRequestData_{{CURRENT_SCRIPT_ID}}(pocialResponseData) {
	if (debugJsonView_{{CURRENT_SCRIPT_ID}} == 1) {
		return JSON.parse(pocialResponseData)
	} else {
		let jsonParseData = JSON.parse(pocialResponseData); // json parse data
		let responsePocialData = window.atob(jsonParseData.response); // encrypt data to decrypt data
		let stringToObjectData = JSON.parse(responsePocialData) // decrypt data convert to json object
		return ({ 'response': stringToObjectData }); // send response
	}
}

/**Function for used to poll embed generate details */
function ViewEmbedGenerateDetails_{{CURRENT_SCRIPT_ID}}() {
	return new Promise(resolve => {
		const xhttp = new XMLHttpRequest();

		/***send object data */
		let elem = document.getElementById("pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}");
		let embedGenerateSlug = elem.getAttribute('data-pocial_generate_slug');

		const makeJsonGenerateEmbedString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		Object.assign(makeJsonGenerateEmbedString.data, { "embed_generate_slug": embedGenerateSlug });
		const myGenerateEmbedJSON = JSON.stringify(makeJsonGenerateEmbedString);

		var data = new FormData();
		data.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myGenerateEmbedJSON));
		data.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		data.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			let pollEmbedGenerateData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			resolve(pollEmbedGenerateData.response);
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/poll_embed_generate_details", true);
		xhttp.send(data);
	});
}

/**Function for used to poll details data */
function viewPublicPagePollDetails_{{CURRENT_SCRIPT_ID}}() {
	return new Promise(resolve => {
		const xhttp = new XMLHttpRequest();

		/***send object data */
		let pollDetailsString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		Object.assign(pollDetailsString.data, { "custom_url": customUrl_{{CURRENT_SCRIPT_ID}}, "random_views_string": uniqueViewRandomString_{{CURRENT_SCRIPT_ID}} });
		const myPollDetailsJSON = JSON.stringify(pollDetailsString);

		var data = new FormData();
		data.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myPollDetailsJSON));
		data.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		data.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			let pollData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			resolve(pollData.response);
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/view_public_page_poll_details", true);
		xhttp.send(data);
	});
}


/**Function for used to poll already vote check */
function alreadyVoteCheckApiFunction_{{CURRENT_SCRIPT_ID}}() {
	return new Promise(resolve => {
		const xhttp = new XMLHttpRequest();

		/***send object data */
		let pollAlreadyVoteString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		Object.assign(pollAlreadyVoteString.data, { "custom_url": customUrl_{{CURRENT_SCRIPT_ID}} });
		const myAlreadyVoteJSON = JSON.stringify(pollAlreadyVoteString);

		var data = new FormData();
		data.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myAlreadyVoteJSON));
		data.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		data.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			let pollDataVoteCheck = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			resolve(pollDataVoteCheck.response);
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/already_vote_check", true);
		xhttp.send(data);
	});
}

/** function for used get dynamic string**/
function readDynamicTextData_{{CURRENT_SCRIPT_ID}}() {
	return new Promise(resolve => {
		const xhttp = new XMLHttpRequest();
		xhttp.onload = function () {
			let readJsonDynamicText = JSON.parse(this.responseText);
			resolve(readJsonDynamicText.result);
		}
		xhttp.open("GET", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/get_dynamic_string_constant");
		xhttp.send();
	});
}

/** If the number is higher than 9, convert the number to a string (consistency). Otherwise, add a zero. */
pocialFormatNumber_{{CURRENT_SCRIPT_ID}} = (n) => {
	return n > 9 ? "" + n : "0" + n;
}

/**
 * Get time difference in midnight to 12 clock
 * @returns total, days, hours, minutes, seconds
 */
// var timeRemainingShow_{{CURRENT_SCRIPT_ID}} = "";
// getTimeRemaining_{{CURRENT_SCRIPT_ID}} = async(getTimeRemaining_) => {
// 	/** Already vote check after midnignt */
// 	let alreadyVoteCheck = await alreadyVoteCheckApiFunction_{{CURRENT_SCRIPT_ID}}();

// 	let voteCheck = (alreadyVoteCheck && alreadyVoteCheck.result) ? alreadyVoteCheck.result : false;
// 	voteCheck = (voteCheck == true || pollEndVotingPeriod_{{CURRENT_SCRIPT_ID}}==true) ? true : false;
// 	let timeRemaining = (alreadyVoteCheck.time_remaining) ? alreadyVoteCheck.time_remaining : "";
// 	let startTime = (timeRemaining.startime) ? timeRemaining.startime : "";
// 	let endTime = (timeRemaining.endtime) ? timeRemaining.endtime : "";
	
// 	const total = Date.parse(endTime) - Date.parse(startTime);
// 	const seconds = Math.floor((total / 1000) % 60);
// 	const minutes = Math.floor((total / 1000 / 60) % 60);
// 	const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
// 	timeRemainingShow_{{CURRENT_SCRIPT_ID}} = pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(hours) + ":" + pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(minutes) + ":" + pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(seconds);

// 	/** Main function call generate after next voting date*/
// 	if (voteCheck==false && hours == 0 && minutes == 0 && seconds == 0) {
// 		pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();
// 	}
// 	if (hours >= 0 && minutes >= 0 && seconds >= 0) {
// 		setTimeout(() => {
// 			x=document.getElementsByClassName("pocial_changing_time");  // Find the elements
// 			for(var i = 0; i < x.length; i++){
// 				x[i].innerText = timeRemainingShow_{{CURRENT_SCRIPT_ID}};
// 			}
// 			// document.getElementById("changing_span_{{CURRENT_SCRIPT_ID}}").innerHTML = timeRemainingShow_{{CURRENT_SCRIPT_ID}};
// 		}, 50);
// 	}
// };

/** Function to poll schdule start date countdown timer (not for used to poll vote count down)*/
var timeRemainingShow_{{CURRENT_SCRIPT_ID}} = "";
function getTimeRemaining_{{CURRENT_SCRIPT_ID}}() {
	let againVoteTimeInSeconds = pollVoteCurrentTimeInSeconds{{CURRENT_SCRIPT_ID}};
	 
	if (againVoteTimeInSeconds <= 0) {
		pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();
	} else {
		/** Calculate remaining time*/
	  	const hours = Math.floor((againVoteTimeInSeconds % (24 * 60 * 60)) / (60 * 60));
	  	const minutes = Math.floor((againVoteTimeInSeconds % (60 * 60)) / 60);
	  	const seconds = againVoteTimeInSeconds % 60;
		timeRemainingShow_{{CURRENT_SCRIPT_ID}} = pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(hours) + ":" + pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(minutes) + ":" + pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(seconds);

		if (hours >= 0 && minutes >= 0 && seconds >= 0) {
			setTimeout(() => {
				x=document.getElementsByClassName("pocial_changing_time");  // Find the elements
				for(var i = 0; i < x.length; i++){
					x[i].innerText = timeRemainingShow_{{CURRENT_SCRIPT_ID}};
				}
				// document.getElementById("changing_span_{{CURRENT_SCRIPT_ID}}").innerHTML = timeRemainingShow_{{CURRENT_SCRIPT_ID}};
			}, 50);
		}
		/** Decrease the target time by 1 second*/
	  	pollVoteCurrentTimeInSeconds{{CURRENT_SCRIPT_ID}}--;
	}
}


/** Function to poll schdule start date countdown timer (not for used to poll vote count down)*/
function updateCountdownPollSchduleStartDate_{{CURRENT_SCRIPT_ID}}() {
	let targetTimeInSeconds = targetTimeInSeconds_{{CURRENT_SCRIPT_ID}};
	if (targetTimeInSeconds <= 0) {
		document.location.reload();
		pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();
	} else {
		/** Calculate remaining time*/
	  	const days = Math.floor(targetTimeInSeconds / (24 * 60 * 60));
	  	const hours = Math.floor((targetTimeInSeconds % (24 * 60 * 60)) / (60 * 60));
	  	const minutes = Math.floor((targetTimeInSeconds % (60 * 60)) / 60);
	  	const seconds = targetTimeInSeconds % 60;
		
		setTimeout(() => {
			/** Update the HTML or display the remaining time as desired*/
			document.getElementById("poll_starts_in_{{CURRENT_SCRIPT_ID}}").innerHTML = '<div class="poll-starts-in">'+
																							'<div class="poll-starts-content">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.starts_in']+'</div>'+
																							'<div class="poll-starts-time-remaining">'+
																								((days>0) ? '<span>'+days+'d</span>' : "")+
																								((hours>0) ? ' <span>'+pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(hours)+'h</span>' : "")+
																								((minutes>0) ? ' <span>'+pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(minutes)+'m</span>' : "")+
																								' <span>'+pocialFormatNumber_{{CURRENT_SCRIPT_ID}}(seconds)+'s</span>'+
																							'</div>'+
																						'</div>';
		}, 50);

		/** Decrease the target time by 1 second*/
	  	targetTimeInSeconds_{{CURRENT_SCRIPT_ID}}--;
	}
}


async function pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}} () {

	/** await function is used to api load */
	let pollEmbedGenerateDetails = await ViewEmbedGenerateDetails_{{CURRENT_SCRIPT_ID}}();

	 
	/*** Embed generate details */
	let embedGenerateResult = (pollEmbedGenerateDetails && pollEmbedGenerateDetails.result) ? pollEmbedGenerateDetails.result : {};
	let embedName = (embedGenerateResult.embed_name) ? embedGenerateResult.embed_name : "";
	customUrl_{{CURRENT_SCRIPT_ID}} = (embedGenerateResult.custom_url) ? embedGenerateResult.custom_url : "";	
	pollDetailId_{{CURRENT_SCRIPT_ID}} = (embedGenerateResult.poll_id) ? embedGenerateResult.poll_id : "";	

	/** Get poll details */
	let pollDetails = await viewPublicPagePollDetails_{{CURRENT_SCRIPT_ID}}();

	/**Already vote check after midnignt */
	let alreadyVoteCheck = await alreadyVoteCheckApiFunction_{{CURRENT_SCRIPT_ID}}();
	
	/**Read text dynamic data */
	let pocialEmbedDynamicTextResult = await readDynamicTextData_{{CURRENT_SCRIPT_ID}}();
	pocialTextSettings_{{CURRENT_SCRIPT_ID}} = JSON.parse(pocialEmbedDynamicTextResult);

	
	/***vote detials parameter */
	let pollsUrl = (pollDetails && pollDetails.polls_url) ? pollDetails.polls_url : [];
	let endVoting = (pollDetails && pollDetails.end_voting) ? pollDetails.end_voting : false;
	let pollResult = (pollDetails && pollDetails.result) ? pollDetails.result : {};
	let pollOptions = (pollDetails && pollResult.options) ? pollResult.options : [];
	let optionsType = (pollDetails && pollResult.options_type) ? pollResult.options_type : "";
	let singleOptionSubmittedType = (pollResult.single_option_submitted_type) ? pollResult.single_option_submitted_type : "";
	let totalCount = (pollDetails && pollResult.total_count) ? pollResult.total_count : 0;
	let pocialUserUrl = (pollDetails && pollDetails.user_url) ? pollDetails.user_url : "";
	let pollMainSlug = (pollDetails && pollResult.slug) ? pollResult.slug : "";
	let pollEndVotingPeriod_{{CURRENT_SCRIPT_ID}} = (pollDetails && pollResult.end_voting_period) ? pollResult.end_voting_period : false;
	let pollDetailsMessage = (endVoting && endVoting==true) ? pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.end_voting_message'] : pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.no_record'];
	 

	let questionQuestion = (pollResult.question) ? pollResult.question : "";
	let questionExtension = (pollResult.question_extension) ? pollResult.question_extension : "";
	let questionVideo = (pollResult.question_video_name) ? pollsUrl + '' + pollResult.question_video_name : "";
	let questionMedia = (pollResult.question_media) ? pollsUrl + '' + pollResult.question_media : "";
	let bannerHideShow = (pollResult.question_media) ? true : false;
	let bannerImageVideoUrl = (questionExtension == 'mp4' || questionExtension == 'gif') ? questionVideo : questionMedia;

	let businessUserImageLogo = (pollResult.user_profile_image) ? pocialUserUrl + '' + pollResult.user_profile_image : pocialUserNoImage_{{CURRENT_SCRIPT_ID}};
	let pocialBusinessName = (pollResult.name_of_the_business) ? pollResult.name_of_the_business : pollResult.name_of_the_business;
	// let pocialEnticementheadline = (pollResult.enticement_headline) ? pollResult.enticement_headline : "";
	let realTime = (pollResult.real_time) ? pollResult.real_time : false;
	let realTimeResult = (pollResult.real_time_result) ? pollResult.real_time_result : "";

	/*** Already vote check parameter */
	let voteCheck = (alreadyVoteCheck && alreadyVoteCheck.result) ? alreadyVoteCheck.result : false;
	voteCheck = (voteCheck == true || pollEndVotingPeriod_{{CURRENT_SCRIPT_ID}}==true) ? true : false;
	// let resultAlreadyVote = (alreadyVoteCheck.resultAlreadyVote) ? alreadyVoteCheck.resultAlreadyVote : "";
	let timeRemaining = (alreadyVoteCheck.time_remaining) ? alreadyVoteCheck.time_remaining : "";
	let votedOptionId = (alreadyVoteCheck.voted_option_id) ? alreadyVoteCheck.voted_option_id : "";
	let voteTimeRemainingInSeconds = (timeRemaining.poll_vote_current_time_in_seconds) ? timeRemaining.poll_vote_current_time_in_seconds : "";

	embedName = (embedName) ? embedName : pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.embed_is_not_generate'];
	
	/** time remaing calculate */
	if (timeRemaining != "") {
		pollVoteCurrentTimeInSeconds{{CURRENT_SCRIPT_ID}}=voteTimeRemainingInSeconds;
		getTimeRemaining_{{CURRENT_SCRIPT_ID}}()
		setInterval(() => {
			getTimeRemaining_{{CURRENT_SCRIPT_ID}}()
		}, 1000);
	}
	
	/** Poll start schdule date time countdown */
	let pollStartDateSchduleRemaining = (pollDetails.poll_start_date_schdule_remaining) ? pollDetails.poll_start_date_schdule_remaining : {}
	let startDateAvailableFlag = (pollStartDateSchduleRemaining.start_date_available_flag) ? pollStartDateSchduleRemaining.start_date_available_flag : false;
	
	if(startDateAvailableFlag){
		let targetTimeInSeconds = (pollStartDateSchduleRemaining.target_time_in_seconds) ? pollStartDateSchduleRemaining.target_time_in_seconds : "";
		targetTimeInSeconds_{{CURRENT_SCRIPT_ID}} = targetTimeInSeconds;

		updateCountdownPollSchduleStartDate_{{CURRENT_SCRIPT_ID}}();		
		setInterval(() => {
			updateCountdownPollSchduleStartDate_{{CURRENT_SCRIPT_ID}}(targetTimeInSeconds)
		}, 1000);
	}
	
	
	/**let poll option loop */
	var pollOptionHtml = "";
	var singlePollBannerImage = "";
	var singleMediaPollsClass = "";
	
	if (pollDetails && pollDetails.result && (Object.keys(pollDetails.result).length == 0 || Object.keys(embedGenerateResult).length == 0)) {
		/** No record poll html integrated*/
		pollOptionHtml += '<div class="pocial_no_record">'+
								'<figure ><img alt="image" class="righticon" src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'no-record-found.svg"></figure>'+
								'<h1>'+pollDetailsMessage+'</h1>'+
							'</div>';

	} else if (voteCheck && !realTime) {
		/** Real time off accourdign poll option hide html*/
		setTimeout(() => {
			jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .free_lunch_detail").addClass("main_div_thanks_answering");
		}, 1000);
		pollOptionHtml += 	'<div class="thanks_answering">'+
								'<figure><img alt="image" class="righticon" src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'thanks-tick.svg"></figure>'+
								'<h2>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.thank_you_for_voting']+'</h2><p >'+realTimeResult+'</p>'+
							'</div>';

	} else {
		/** Option data show html*/
		pollOptions.map((records, index) => {
			let optinId = (records._id) ? records._id : "";
			let optinImage = (records.image) ? pollsUrl + '' + records.image : undecidedImageUrl_{{CURRENT_SCRIPT_ID}};
			let optinVideo = (records.video) ? pollsUrl + '' + records.video : "";
			let optionExtension = (records.extension) ? records.extension : "";
			let enticementOptionsHeadline = (records.enticement_headline) ? records.enticement_headline : "";
			let imageVideoUrl = (optionExtension == 'mp4' || optionExtension == 'gif') ? optinVideo : optinImage;
			let optionVotingData = {
				'poll_id': pollResult._id,
				'poll_slug': pollMainSlug,
				'option_id': optinId,
				'enticement_headline': (enticementOptionsHeadline) ? enticementOptionsHeadline.replace(/ /g,"_") : "",
			}
			let pocialObjectVotingData = JSON.stringify(optionVotingData);
			let ctaLinkShowCondition = ((records.cta_title && records.cta_title !== '') && (records.cta_url && records.cta_url !== '') && (voteCheck == true) && (votedOptionId == optinId)) ? true : false;
			let ctaLinkShowClass = ((records.cta_title && records.cta_title !== '') && (records.cta_url && records.cta_url !== '') && (voteCheck == true) && (votedOptionId == optinId)) ? "cta_link_li" : "";
			
			let pollRibbonClickOptions = {
				'poll_slug': pollMainSlug,
				'option_id': optinId,
				'cta_url': records.cta_url
			}
			let pollRibbonClickOptionsData = JSON.stringify(pollRibbonClickOptions);

			let fullProgressBg = ((voteCheck == true) && (votedOptionId == optinId)) ? "full_progress_bg" : "";

			if (optionsType == 'media' && singleOptionSubmittedType != singleOption_{{CURRENT_SCRIPT_ID}}) {
				pollOptionHtml += '<li class="pocial_media_li '+ctaLinkShowClass+'">' +
						'<div class="beverage_list_detail">' +
						'<figure>'+
							'<img src="' + optinImage + '" alt="img">' +
							((optionExtension == 'mp4') ? '<span onclick=pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}}("'+optionExtension+'","'+imageVideoUrl+'") class="pocial_media_play_icon"><img class="pocial_play_icon" src="' + frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'view-poll-video-play-black.svg" alt="play-icon"></span>' : '')+
							'<span class="fullscreen-view pointer" onclick=pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}}("'+optionExtension+'","'+imageVideoUrl+'")>' +
								'<img src="' + fullscreenPopup_{{CURRENT_SCRIPT_ID}} + '" alt="fullscreen">' +
							'</span>' +
						'</figure>' +
						'<div class="beverage_list_contant">' +
							'<div class="formcheck media-option">' +
							((!voteCheck) ? '<input class="pocial-formcheck-input pointer" type="radio" onclick=pocialPollVoting_{{CURRENT_SCRIPT_ID}}('+pocialObjectVotingData+') name="flexRadioDefault" id="' + optinId + '">' : "") +
							'<label class="pocial-formcheck-label" for="' + optinId + '">' + records.title + '</label>'+
							((voteCheck) ? '<div class="progress_embed">'+
									((!startDateAvailableFlag) ? '<span class="media_option_percentage">'+records.percentage+'%</span>'+
										'<div class="embed_progress">'+
										'<div class="pocial_progress_bar_embed" role="progressbar" aria-label="Basic example" style="width: '+records.percentage+'%" aria-valuenow="'+records.percentage+'" aria-valuemin="0" aria-valuemax="100"></div>'+
										'</div>':"")+
									'</div>':"")+
								'</div>' +
							'</div>' +
						'</div>' +
						((ctaLinkShowCondition) ? '<div class="pocial-ctal_link-button" onclick=pocialPollRibbonClickLogs_{{CURRENT_SCRIPT_ID}}('+pollRibbonClickOptionsData+') >'+
							'<a class="pocial-btn-primary">'+
								'<span>'+records.cta_title+'</span><img alt="img" src="'+pocialSininSignupNextIcon_{{CURRENT_SCRIPT_ID}}+'">'+
							'</a>'+
						'</div>':"")+
					'</li>';
			} else {
				// if (singleOptionSubmittedType == singleOption_{{CURRENT_SCRIPT_ID}}) {
				if (bannerHideShow && bannerHideShow == true) {
					singleMediaPollsClass = "free_lunch_single_media_option"
					// if (index != 0) {
						pollOptionHtml += '<li class="pocial_single_option_li '+ctaLinkShowClass+'">' +
								'<div class="formcheck single-option '+fullProgressBg+'">' +
									((!voteCheck) ? '<input class="pocial-formcheck-input pointer" type="radio" onclick=pocialPollVoting_{{CURRENT_SCRIPT_ID}}('+pocialObjectVotingData+') name="flexRadioDefault" id="' + optinId + '">':"")+
									((!voteCheck) ? '<label class="pocial-formcheck-label" for="' + optinId + '">' + records.title + '</label>':"")+
									((voteCheck) ? '<div class="progress_embed">'+
										'<label class="pocial-formcheck-label" for="' + optinId + '">' + records.title + '</label>' +
										((!startDateAvailableFlag) ? '<span class="single_option_percentage">'+records.percentage+'%</span>':"")+
										'<div class="embed_progress">'+
										'<div class="pocial_progress_bar_embed" role="progressbar" aria-label="Basic example" style="width: '+records.percentage+'%" aria-valuenow="'+records.percentage+'" aria-valuemin="0" aria-valuemax="100"></div>'+
										'</div>'+
									'</div>':"")+
								'</div>' +
								((ctaLinkShowCondition) ? '<div class="pocial-ctal_link-button" onclick=pocialPollRibbonClickLogs_{{CURRENT_SCRIPT_ID}}('+pollRibbonClickOptionsData+') >'+
									'<a class="pocial-btn-primary">'+
										'<span>'+records.cta_title+'</span><img alt="img" src="'+pocialSininSignupNextIcon_{{CURRENT_SCRIPT_ID}}+'">'+
									'</a>'+
								'</div>':"")+
							'</li>';						
					if (index == 0) {
						singlePollBannerImage += '<figure class="poical_single_image">' +
							'<img class="single_option_image" src="' + questionMedia + '" alt="img">' +
							((questionExtension == 'mp4') ? '<span onclick=pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}}("'+questionExtension+'","'+bannerImageVideoUrl+'") class="single_span_class"><img src="' + frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'view-poll-video-play-black.svg" class="single_option_play" alt="play-icon"></span>' : '')+
							'<span class="fullscreen-view pointer"><img src="' + fullscreenPopup_{{CURRENT_SCRIPT_ID}} + '" alt="fullscreen" onclick=pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}}("'+questionExtension+'","'+bannerImageVideoUrl+'") ></span>' +
						'</figure>';

						// singlePollBannerImage += '<figure class="poical_single_image">' +
						// 		'<img class="single_option_image" src="' + pollsUrl + '' + records.image + '" alt="img">' +
						// 		((optionExtension == 'mp4') ? '<span onclick=pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}}("'+optionExtension+'","'+imageVideoUrl+'") class="single_span_class"><img src="' + frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'view-poll-video-play-black.svg" class="single_option_play" alt="play-icon"></span>' : '')+
						// 		'<span class="fullscreen-view pointer"><img src="' + fullscreenPopup_{{CURRENT_SCRIPT_ID}} + '" alt="fullscreen" onclick=pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}}("'+optionExtension+'","'+imageVideoUrl+'") ></span>' +
						// 	'</figure>';
					}
				} else {
					pollOptionHtml += '<li class="pocial_text_option_li '+ctaLinkShowClass+'">' +
							'<div class="formcheck text-option '+fullProgressBg+'">' +
								((!voteCheck) ? '<input class="pocial-formcheck-input pointer" type="radio" onclick=pocialPollVoting_{{CURRENT_SCRIPT_ID}}('+pocialObjectVotingData+') name="flexRadioDefault" id="' + optinId + '">':"") +
								((!voteCheck) ? '<label class="pocial-formcheck-label" for="' + optinId + '">' + records.title + '</label>':"") +
								((voteCheck) ? '<div class="progress_embed">'+
										'<label class="pocial-formcheck-label" for="' + optinId + '">' + records.title + '</label>' +
										((!startDateAvailableFlag) ? '<span class="text_option_percentage">'+records.percentage+'%</span>':"")+
										'<div class="embed_progress">'+
											'<div class="pocial_progress_bar_embed" role="progressbar" aria-label="Basic example" style="width: '+records.percentage+'%" aria-valuenow="'+records.percentage+'" aria-valuemin="0" aria-valuemax="100"></div>'+
										'</div>'+
									'</div>':"")+
							'</div>' +
							((ctaLinkShowCondition) ? '<div class="pocial-ctal_link-button" onclick=pocialPollRibbonClickLogs_{{CURRENT_SCRIPT_ID}}('+pollRibbonClickOptionsData+') >'+
								'<a class="pocial-btn-primary">'+
									'<span>'+records.cta_title+'</span><img alt="img" src="'+pocialSininSignupNextIcon_{{CURRENT_SCRIPT_ID}}+'">'+
								'</a>'+
							'</div>':"")+
						'</li>';						
				}
			}
		});	
	}

	
	/**generate html aapend in js */
	pocialGenerateCode_{{CURRENT_SCRIPT_ID}} = function () {
		let pocialPollContainerHtml = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").html("");

		if(jQuery("#pocial_embed_css_file").length<=0){
			jQuery('head').append('<link id="pocial_embed_css_file" rel="stylesheet" type="text/css" href="' + pocialEmbedJsCssPath_{{CURRENT_SCRIPT_ID}} + 'pocial_poll_embed.css" >');
		}

		// jQuery('head').append('<link rel="stylesheet" type="text/css" href="' + PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/css/bootstrap.min.css" >');
		// jQuery('head').append('<link rel="stylesheet" type="text/css" href="' + pocialEmbedJsCssPath_{{CURRENT_SCRIPT_ID}} + 'pocial_embed_toastr_min.css" >');
		
		pocialPollContainerHtml = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}");
		
	
		/**show success/error message */
		jQuery("<span id='show_toster_success_message_{{CURRENT_SCRIPT_ID}}'>").attr({ class: "show_toster_success_message" }).html(showTosterSuccessMessage_{{CURRENT_SCRIPT_ID}}).appendTo(pocialPollContainerHtml);
		jQuery("<span id='show_toster_error_message_{{CURRENT_SCRIPT_ID}}'>").attr({ class: "show_toster_error_message" }).html(showTosterErrorMessage_{{CURRENT_SCRIPT_ID}}).appendTo(pocialPollContainerHtml);	

		// jQuery("<div id='pocial_success_id_message'>").attr({ class: "pocial_success_message hide_success_message" }).html('').appendTo(pocialPollContainerHtml);
		// jQuery("<div id='pocial_error_id_message'>").attr({ class: "pocial_error_message hide_error_message" }).html('').appendTo(pocialPollContainerHtml);

		/**show popup gallery page */
		jQuery("<div>").attr({ class: "pocial_gallery" }).html('<span class="pocial_show_gallery_popup_open" id="pocial_show_gallery_popup_open_{{CURRENT_SCRIPT_ID}}"></span>').appendTo(pocialPollContainerHtml);

		/**loader icon */
		jQuery("<div>").attr({ class: "pocial_embed_loading_class" }).html('<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 120 120" style="enable-background:new 0 0 120 120;" xml:space="preserve"><g><path class="st0" d="M29.32,97.22c0-4.1,3.3-7.3,7.4-7.3s7.3,3.3,7.3,7.4c0,4-3.3,7.3-7.3,7.3l0,0C32.62,104.52,29.32,101.22,29.32,97.22L29.32,97.22z M29.32,86.22v-32.4c0.2,0,0.5-0.1,0.7-0.1c5,0,10,0.1,14.9,0c1.1,0,2.1,0.4,2.7,1.3c2.1,2.5,4.9,4.2,8,4.8c7.4,1.7,14.7-2.9,16.4-10.2c0.1-0.3,0.1-0.6,0.2-1c0.9-5.2-0.1-9.9-3.7-13.8c-4.1-4.4-9.3-5.4-14.9-3.6c-5.4,1.7-8.3,5.8-9.2,11.3c-0.2,1.6-0.2,3.2-0.3,4.8c-0.2,0-0.4,0.1-0.7,0.1c-4.6,0-9.2,0-13.8,0c-0.2,0-0.5,0-0.7-0.1v-3.8c0.2-1.2,0.3-2.4,0.6-3.6c2.3-10.9,9-17.8,19.3-21.4c12-4.1,25.8,0.1,33.3,9.7c9.1,11.7,7.1,28.9-4.4,38.6c-5.9,4.9-12.8,6.9-20.3,6.6c-4.3-0.2-8.5-1.1-12.5-2.8c-0.2-0.1-0.3-0.1-0.6-0.2v15.8L29.32,86.22L29.32,86.22z"/><g transform="matrix(1, 0, 0, 1, 0, 0)"><path class="st0" d="M29.32,97.22c0-4.1,3.3-7.3,7.4-7.3s7.3,3.3,7.3,7.4c0,4-3.3,7.3-7.3,7.3l0,0C32.62,104.52,29.32,101.22,29.32,97.22L29.32,97.22z M29.32,86.22v-32.4c0.2,0,0.5-0.1,0.7-0.1c5,0,10,0.1,14.9,0c1.1,0,2.1,0.4,2.7,1.3c2.1,2.5,4.9,4.2,8,4.8c7.4,1.7,14.7-2.9,16.4-10.2c0.1-0.3,0.1-0.6,0.2-1c0.9-5.2-0.1-9.9-3.7-13.8c-4.1-4.4-9.3-5.4-14.9-3.6c-5.4,1.7-8.3,5.8-9.2,11.3c-0.2,1.6-0.2,3.2-0.3,4.8c-0.2,0-0.4,0.1-0.7,0.1c-4.6,0-9.2,0-13.8,0c-0.2,0-0.5,0-0.7-0.1v-3.8c0.2-1.2,0.3-2.4,0.6-3.6c2.3-10.9,9-17.8,19.3-21.4c12-4.1,25.8,0.1,33.3,9.7c9.1,11.7,7.1,28.9-4.4,38.6c-5.9,4.9-12.8,6.9-20.3,6.6c-4.3-0.2-8.5-1.1-12.5-2.8c-0.2-0.1-0.3-0.1-0.6-0.2v15.8L29.32,86.22L29.32,86.22z"/></g><path class="st0" d="M29.32,97.22c0-4.1,3.3-7.3,7.4-7.3s7.3,3.3,7.3,7.4c0,4-3.3,7.3-7.3,7.3l0,0C32.62,104.52,29.32,101.22,29.32,97.22L29.32,97.22z"/></g></svg></div>').appendTo(pocialPollContainerHtml);
		
		jQuery("<div>").attr({ class: "show_default_link" }).html('<a onclick=showOpenPollContent{{CURRENT_SCRIPT_ID}}() href="javascript:void(0)">test new link</a>').appendTo(pocialPollContainerHtml);

		jQuery("<div>").attr({ class: "embed_parent_1669032135160 parent_class_first_div_show" }).html('<div class="page_custom_height ' + singleOptionSubmittedType + '">' +
				'<div class="free_lunch '+singleMediaPollsClass+'">' +
					'<div class="free_lunch_heading">' +
						'<h1><img src="' + frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}} + 'p-border-icon.svg" alt="img"> '+embedName+'' +
					'</div>' +
					'<span id="poll_starts_in_{{CURRENT_SCRIPT_ID}}"></span>'+
					'<div class="free_lunch_detail pocial_poll_question_and_options">' +
						'<h2>' + questionQuestion + '</h2>' +
						'' + singlePollBannerImage + '' +
						'<ul class="food_detail poll-inner-section">' + pollOptionHtml + '</ul>' +
						/** Vote check count data*/
						((voteCheck && !startDateAvailableFlag) ? '<div class="total_count">' +
								'<div class="total_count_left"><strong>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.total_count']+'</strong> <span>'+totalCount+'</span></div>' +
								'<div class="total_count_right"><strong>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.participate_again']+'</strong><span class="pocial_changing_time" id="changing_span_{{CURRENT_SCRIPT_ID}}">'+timeRemainingShow_{{CURRENT_SCRIPT_ID}}+'</span></div>' +
							'</div>' : "") +
					'</div>' +
				'</div>' +
			'</div>').appendTo(pocialPollContainerHtml);

		if(pollEndVotingPeriod_{{CURRENT_SCRIPT_ID}}==true){
			jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .total_count_right").hide();
		}

		/*** This html for used to enticement popup */
		jQuery("<div>").attr({ class: "reward_enticement_sectionembed_1669032135160"
	 	}).html('<div class="reward-enticement-section">'+
			'<div class="pocial_cross_enticement"><a href="javascript:void(0)" onclick=pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}}()><img src="'+pocialCrossIconImage_{{CURRENT_SCRIPT_ID}}+'" alt="img"></a></div>'+
			'<div class="pocial-row">'+
				'<div class="pocial-col-md-6">'+
					'<div class="images_panel">'+
						'<figure class="colorfull_image">'+
							'<img src="'+pocialRewardColorFullImage_{{CURRENT_SCRIPT_ID}}+'" alt="img">'+
						'</figure>'+
						// '<figure class="pocial_logo">'+
						// 	'<img src="'+pocialRewardPLogo_{{CURRENT_SCRIPT_ID}}+'" alt="img">'+
						// '</figure>'+
						'<figure class="prev_brand_logo">'+
							'<img src="'+businessUserImageLogo+'" alt="img">'+
						'</figure>'+
					'</div>'+
				'</div>'+
				'<div class="pocial-col-md-6 reward_right_text">'+
					'<div class="right-box">'+
						'<div class="heading">'+
							'<h2><span id="pocialSpanRewardHeadline">'+pocialBusinessName+' '+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.has_attached']+ ' </span> <a href="javascript:void(0)"><span id="pocialSpanEnticementheadline_{{CURRENT_SCRIPT_ID}}"></span></a></h2>'+
							'<p class="for_participating" id="for_participating">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.for_participating']+'</p>'+
						'</div>'+
						'<span id="pocial_reward_enticement_replace_html">'+
							'<a href="#" class="reward_sign_in">'+
								''+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.sign_in_instantly_redeem']+''+
							'</a>'+
							'<button class="sign-in pointer" onclick="openLoginPopup_{{CURRENT_SCRIPT_ID}}()" >'+
								'<span>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.signin_signup']+'</span>'+
								'<img src="'+pocialSininSignupNextIcon_{{CURRENT_SCRIPT_ID}}+'" alt="img">'+
							'</button>'+
						'</span>'+
					'</div>'+
				'</div>'+
			'</div>'+
		'</div>').appendTo(pocialPollContainerHtml);

		/*** This html for used to sigin popup */
		jQuery("<div>").attr({ class: "pocial_embed_sigin_1669032135160"
	 	}).html('<div class="popup-content login_content">'+
		 '<div class="pocial_cross_enticement"><a href="javascript:void(0)" onclick=pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}}()><img src="'+pocialCrossIconImage_{{CURRENT_SCRIPT_ID}}+'" alt="img"></a></div>'+
		 '<div class="popup_heading">'+
			'<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'logo.svg" class="logo_popup" alt="img">'+
			'<div class="account_link signup_now_button">'+
				'<button class="pocial-btn-primary pointer" onclick="openRegistrationPopup_{{CURRENT_SCRIPT_ID}}()" >'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.create_new_account']+' <img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="img"></button>'+
				'<div class="seprate_border"><span>Or</span></div>'+
			'</div>'+
			'<h3>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.login_below']+'</h3>'+
			// '<div class="goggle_mail">'+
			//    '<ul>'+
			// 	  '<li><a href="javascript:void(0);"><img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'mail-icon-popup.svg" alt="img"></a></li>'+
			// 	  '<li><a href="javascript:void(0);"><img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'goggle-icon-popup.svg" alt="img"></a></li>'+
			//    '</ul>'+
			// '</div>'+
			// '<div class="seprate_border">'+
			//    '<span>Or</span>'+
			// '</div>'+
		 '</div>'+
		 '<div class="register-section">'+
			'<div class="pocial-row">'+
			   '<div class="pocial-col-lg-12">'+
				  '<div class="pocial-form-group">'+
					'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.email_username']+' <span class="required">*</span></label>'+
					'<input type="email" id="pocial_embed_email_{{CURRENT_SCRIPT_ID}}" name="pocial_embed_email" class="pocial-form-control" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.your_email_username']+'">'+
					'<span id="pocial_embed_email_error" class="error"></span>'+
				  '</div>'+
			   '</div>'+
			'</div>'+
			'<div class="pocial-row">'+
			   '<div class="pocial-col-lg-12">'+
				  '<div class="pocial-form-group">'+
					 '<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.password']+' <span class="required">*</span></label> '+
					 '<input type="password" id="pocial_embed_password_{{CURRENT_SCRIPT_ID}}" name="pocial_embed_password" class="pocial-form-control" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.your_password']+'">'+
					 '<span id="pocial_embed_password_error" class="error"></span>'+
				  '</div>'+
			   '</div>'+
			'</div>'+
		 '</div>'+
		 '<div class="login_signup_button">'+
			'<div class="signupbtn">'+
				'<button class="pocial-btn-primary pointer" onclick="pocialEmbedLogin_{{CURRENT_SCRIPT_ID}}()">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.login']+' <img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="img"></button>'+
				'<a href="javascript:void(0);" onclick="pocialForgetPassword_{{CURRENT_SCRIPT_ID}}();">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.forgot_password']+'</a>'+
			'</div>'+
		 '</div>'+
		'</div>').appendTo(pocialPollContainerHtml);


		/*** This html for used to signup popup */
		jQuery("<div>").attr({ class: "pocial_embed_signup_1669032135160"
	 	}).html('<div class="registration_content">'+
		 '<div class="pocial_cross_enticement"><a href="javascript:void(0)" onclick=pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}}()><img src="'+pocialCrossIconImage_{{CURRENT_SCRIPT_ID}}+'" alt="img"></a></div>'+
			'<div class="popup_signup_heading">'+
				'<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'logo.svg" class="logo_popup" alt="img">'+
				'<h2 class="join_pocial_text">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.join_pocial']+'</h2>'+
				'<div class="details_signup_text">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.fill_details_signup']+'</div>'+
				// '<div class="goggle_mail">'+
				// 	'<ul>'+
				// 		'<li><a href="javascript:void(0);"><img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'mail-icon-popup.svg" alt="img"></a></li>'+
				// 		'<li><a href="javascript:void(0);"><img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'goggle-icon-popup.svg" alt="img"></a></li>'+
				// 	'</ul>'+
				// '</div>'+
				// '<div class="seprate_border">'+
				// 	'<span>Or</span>'+
				// '</div>'+
			'</div>'+
			'<div class="register-section">'+
				'<div class="already_account_span">'+
					'<span>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.already_have']+'</span>'+
					'<span class="click_here_to_login pointer" onclick="openLoginPopup_{{CURRENT_SCRIPT_ID}}()" >'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.click_here_to_login']+'</span>'+
				'</div>'+
				'<div class="pocial-row pocial_full_name_text">'+
					'<div class="pocial-col-lg-6 first_name">'+
						'<div class="form-pocial-row">'+
							'<div class="pocial-form-group">'+
								'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.first_name']+' <span class="required">*</span></label>'+
								'<input type="text" class="pocial-form-control" id="pocial_first_name_{{CURRENT_SCRIPT_ID}}" name="pocial_first_name" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.first_name']+'" />'+
								'<span id="pocial_first_name_error" class="error"></span>'+
							'</div>'+
						'</div>'+
					'</div>'+
					'<div class="pocial-col-lg-6 last_name">'+
						'<div class="form-pocial-row">'+
							'<div class="pocial-form-group">'+
								'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.last_name']+' <span class="required">*</span></label>'+
								'<input type="text" class="pocial-form-control" id="pocial_last_name_{{CURRENT_SCRIPT_ID}}" name="pocial_last_name" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.last_name']+'" />'+
								'<span id="pocial_last_name_error" class="error"></span>'+
							'</div>'+
						'</div>'+
					'</div>'+
				'</div>'+
				'<div class="pocial-row">'+
					'<div class="pocial-col-lg-12">'+
						'<div class="pocial-form-group">'+
							'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.email']+' <span class="required">*</span></label>'+
							'<input type="text" class="pocial-form-control" id="pocial_email_{{CURRENT_SCRIPT_ID}}" name="pocial_email" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.your_email']+'" >'+
							'<span id="pocial_email_error" class="error"></span>'+
						'</div>'+
					'</div>'+
				'</div>'+
				'<div class="pocial-row" style="display:none;">'+
					'<div class="pocial-col-lg-12">'+
						'<div class="pocial-form-group">'+
						'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.gender']+' <span class="required">*</span></label>'+
							'<div class="switch switch_section">'+
								'<input type="radio" class="switch-input" value=1 id="pocial_male_{{CURRENT_SCRIPT_ID}}" name="pocial_gender" />'+
								'<label for="pocial_male_{{CURRENT_SCRIPT_ID}}" class="switch-label switch-label-off"> '+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.gender_male']+'</label>'+
								
								'<input type="radio" class="switch-input" value=2 id="pocial_female_{{CURRENT_SCRIPT_ID}}" name="pocial_gender" />'+
								'<label for="pocial_female_{{CURRENT_SCRIPT_ID}}" class="switch-label switch-label-on"> '+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.gender_female']+'</label>'+
								
								'<input type="radio" class="switch-input" value=3 id="pocial_other_{{CURRENT_SCRIPT_ID}}" name="pocial_gender" />'+
								'<label for="pocial_other_{{CURRENT_SCRIPT_ID}}" class="switch-label switch-label-on switch-label-other"> '+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.gender_other']+'</label>'+
								'<span class="switch-selection"></span>'+
							'</div>'+
							'<span id="pocial_gender_error" class="error"></span>'+
						'</div>'+
					'</div>'+
				'</div>'+
				'<div class="pocial-row">'+
					'<div class="pocial-col-lg-12" style="display:none;">'+
						'<div class="pocial-form-group">'+
						'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.date_of_birth']+' <span class="required">*</span></label>'+
							'<div class="dropdown_wise_dob">'+
								'<div class="message_dropdown_wise_dob">'+
									'<select data-live-search="true" name="mm" id="mm_{{CURRENT_SCRIPT_ID}}" onchange="pocialMonthChanged_{{CURRENT_SCRIPT_ID}}()" class="bear-months pocial-form-control"></select>'+
									'<span id="mm_error" class="error"></span>'+
								'</div>'+
								'<div class="message_dropdown_wise_dob">'+
									'<select data-live-search="true" name="dd" id="dd_{{CURRENT_SCRIPT_ID}}" class="bear-dates pocial-form-control"></select>'+
									'<span id="dd_error" class="error"></span>'+
								'</div>'+
								'<div class="message_dropdown_wise_dob">'+
									'<select data-live-search="true" name="yy" id="yy_{{CURRENT_SCRIPT_ID}}" onchange="pocialYearChanged_{{CURRENT_SCRIPT_ID}}()" class="bear-years pocial-form-control"></select>'+
									'<span id="yy_error" class="error"></span>'+
								'</div>'+
							'</div>'+
						'</div>'+
					'</div>'+
					'<div class="pocial-row" style="display:none;">'+
						'<div class="pocial-col-lg-12">'+
							'<div class="pocial-form-group">'+
								'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.phone_number']+' <span class="required">*</span></label>'+
								'<input type="tel" id="pocial_mobile_{{CURRENT_SCRIPT_ID}}" name="pocial_mobile" class="pocial-form-control" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.your_phone']+'" >'+
								'<span id="pocial_mobile_error" class="error"></span>'+
							'</div>'+
						'</div>'+
					'</div>'+
					'<div class="pocial-row" style="display:none;">'+
						'<div class="pocial-col-lg-12">'+
							'<div class="pocial-form-group">'+
								'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.zip_code']+' <span class="required">*</span> </label>'+
								'<input type="text" class="pocial-form-control" id="pocial_zip_code_{{CURRENT_SCRIPT_ID}}" name="pocial_zip_code" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.your_zip']+'" />'+
								'<span id="pocial_zip_code_error" class="error"></span>'+
							'</div>'+
						'</div>'+
					'</div>'+
					'<div class="pocial-row" style="display:none;">'+
						'<div class="pocial-col-lg-12">'+
							'<div class="pocial-form-group">'+
								'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.user_name']+'</label>'+
								'<input type="text" class="pocial-form-control" onkeyup="custumUrlChanged_{{CURRENT_SCRIPT_ID}}()" id="pocial_username_{{CURRENT_SCRIPT_ID}}" name="pocial_username" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.enter_username']+'" >'+
								'<span id="custum_url_{{CURRENT_SCRIPT_ID}}" class="custum_url">'+PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}}+'</span>'+
								'<span id="pocial_username_error" class="error"></span>'+
							'</div>'+
						'</div>'+
					'</div>'+
					'<div class="pocial-row">'+
						'<div class="pocial-col-lg-12">'+
							'<div class="pocial-form-group">'+
								'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.password']+' <span class="required">*</span> </label>'+
								<!--PASSWORD STRENGTH BAR-->
								'<div class="strong-pass poor">'+
									'<span class="round active" id="embed_bar0_{{CURRENT_SCRIPT_ID}}"></span>'+
									'<span class="round" id="embed_bar1_{{CURRENT_SCRIPT_ID}}"></span>'+
									'<span class="round" id="embed_bar2_{{CURRENT_SCRIPT_ID}}"></span>'+
									'<span class="round" id="embed_bar3_{{CURRENT_SCRIPT_ID}}"></span>'+
									'<span class="pass-name" id="embed_embed_pocial_msg_{{CURRENT_SCRIPT_ID}}"></span>'+
								'</div>'+
								<!--PASSWORD STRENGTH BAR-->
								'<input type="password" class="pocial-form-control" onkeyup="checkEmbedPassWordStrength_{{CURRENT_SCRIPT_ID}}()" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.create_password']+'" name="pocial_password" id="pocial_password_{{CURRENT_SCRIPT_ID}}">'+
								'<span id="pocial_password_error" class="error"></span>'+
							'</div>'+
						'</div>'+
					'</div>'+
				'</div>'+
			'</div>'+
			'<div class="pocial-bottom-group">'+
				'<p class="privacy-link">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.by_creating_account']+'</p>'+
				'<a target="_blank" href="'+PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}}+'pocial/terms">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.terms']+'</a>'+
				'&nbsp'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.and_seperator']+''+
				'<a target="_blank" href="'+PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}}+'pocial/privacy-policy">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['global.privacy_policy']+'</a>'+
			'</div>'+
			'<div class="login_signup_button">'+
				'<div class="signupbtn">'+
					'<button class="pocial-btn-primary pointer" onclick="pocialEmbedRegistration_{{CURRENT_SCRIPT_ID}}()" >'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.create_account']+' <img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="img"></button>'+
				'</div>'+
			'</div>'+
		'</div>').appendTo(pocialPollContainerHtml);

		/*** This html for used to verify otp */
		jQuery("<div>").attr({ class: "pocial_verify_otp_1669032135160"
	 	}).html('<div class="popup-content verify_content">'+
		 '<div class="pocial_cross_enticement"><a href="javascript:void(0)" onclick=pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}}()><img src="'+pocialCrossIconImage_{{CURRENT_SCRIPT_ID}}+'" alt="img"></a></div>'+
		 '<div class="popup_heading">'+
			'<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'otp-image-white.png" class="logo_popup" alt="img">'+
		 '</div>'+
		 '<div class="register-section">'+
		 '<h2>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['verify_otp.verify_otp_heading']+'</h2>'+
		 '<span class="content-text">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['verify_otp.verify_4_digit']+'<br> '+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['verify_otp.email_id']+' <a href="mailto:'+pocialValidateString_{{CURRENT_SCRIPT_ID}}+'"><span id="pocialValidateSpanString_{{CURRENT_SCRIPT_ID}}">example@mailinator.com</a></span>'+
			'<div class="pocial-row">'+
			   '<div class="pocial-col-lg-12">'+
				  '<div class="pocial-form-group">'+
					'<form method="get" class="digit-group ap-otp-inputs" data-group-name="digits" data-autosubmit="false" autocomplete="off">'+
						'<input class="ap-pocial-otp-input_{{CURRENT_SCRIPT_ID}}" type="tel" id="digit_1_{{CURRENT_SCRIPT_ID}}" name="digit_1" maxlength="1" data-index="0" />'+
						'<input class="ap-pocial-otp-input_{{CURRENT_SCRIPT_ID}}" type="tel" id="digit_2_{{CURRENT_SCRIPT_ID}}" name="digit_2" maxlength="1" data-index="1" />'+
						'<input class="ap-pocial-otp-input_{{CURRENT_SCRIPT_ID}}" type="tel" id="digit_3_{{CURRENT_SCRIPT_ID}}" name="digit_3" maxlength="1" data-index="3" />'+
						'<input class="ap-pocial-otp-input_{{CURRENT_SCRIPT_ID}}" type="tel" id="digit_4_{{CURRENT_SCRIPT_ID}}" name="digit_4" maxlength="1" data-index="4" />'+
					'</form>'+
					'<span id="verify_otp_error" class="error"></span>'+
				  '</div>'+
			   '</div>'+
			'</div>'+
		 '</div>'+
		 '<div class="verify_otp">'+
		 	'<div><span id="pocial_otp_timer">Resend Code</span></div>'+
			'<button class="pocial-btn-primary pointer" onclick="pocialOTPVerficationForm_{{CURRENT_SCRIPT_ID}}()" >'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['verify_otp.verify_btn']+' <img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="img"></button>'+
		 '</div>'+
		'</div>').appendTo(pocialPollContainerHtml);

		/*** This html for used to forget password popup */
		jQuery("<div>").attr({ class: "pocial_embed_forget_password_1669032135160"
		}).html('<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'logo.svg" class="pocial_logo_forget_popup" alt="img">'+
		'<div class="pocial_cross_enticement"><a href="javascript:void(0)" onclick=pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}}()><img src="'+pocialCrossIconImage_{{CURRENT_SCRIPT_ID}}+'" alt="img"></a></div>'+
		'<div class="pocial-forget-password">'+
			'<h2>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["registration.forgot_password"]+'</h2>'+
			'<span class="content-text">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["registration.enter_associate_email"]+'</span>'+
			'<div class="login-form">'+
				'<div class="pocial-form-group">'+
					'<input type="text" class="pocial-form-control" name="forget_email" id="forget_email_{{CURRENT_SCRIPT_ID}}" placeholder="Email">'+
					'<span id="forget_email_error" class="error"></span>'+
				'</div>'+
				'<div class="pocial-bottom-group">'+
					'<a class="pocial-btn-primary pointer" onclick="openLoginPopup_{{CURRENT_SCRIPT_ID}}()">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['registration.login_now']+' <img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="img"></a>'+
					'<button class="forget_button pointer" onclick="pocialResetForgetPassword_{{CURRENT_SCRIPT_ID}}()" >'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["registration.reset_password"]+'<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="image" class="righticon"></button>'+
				'</div>'+
			'</div>'+
		'</div>').appendTo(pocialPollContainerHtml);

		/*** This html for used to forget after Reset Password popup */
		jQuery("<div>").attr({ class: "pocial_embed_forget_reset_password_1669032135160"
		}).html('<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'logo.svg" class="pocial_logo_reset_popup" alt="img">'+
		'<div class="pocial_cross_enticement"><a href="javascript:void(0)" onclick=pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}}()><img src="'+pocialCrossIconImage_{{CURRENT_SCRIPT_ID}}+'" alt="img"></a></div>'+
			'<h2>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["registration.reset_password"]+'</h2>'+
				'<div class="pocial-form-group">'+
					'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["form.enter_otp"]+'<span class="required"> *</span></label>'+
					'<input type="tel" class="pocial-form-control" name="reset_forget_otp" id="reset_forget_otp_{{CURRENT_SCRIPT_ID}}" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.your_otp']+'">'+
					'<span id="reset_forget_otp_error" class="error"></span>'+
				'</div>'+
				'<div class="pocial-form-group password">'+
					'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["form.new_password"]+'<span class="required"> *</span></label>'+
					'<input type="password" class="pocial-form-control" name="reset_forget_password" id="reset_forget_password_{{CURRENT_SCRIPT_ID}}" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.create_password']+'">'+
					'<span id="reset_forget_password_error" class="error"></span>'+
				'</div>'+
				'<div class="pocial-form-group confirm_password">'+
					'<label>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["form.confirm_password"]+'<span class="required"> *</span></label>'+
					'<input type="password" class="pocial-form-control" name="reset_forget_confirm_password" id="reset_forget_confirm_password_{{CURRENT_SCRIPT_ID}}" placeholder="'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['form.confirm_password']+'">'+
					'<span id="reset_forget_confirm_password_error" class="error"></span>'+
				'</div>'+
				'<div class="pocial-bottom-group">'+
					'<button class="pocial-primary" onclick="pocialSubmitResetForm_{{CURRENT_SCRIPT_ID}}()">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}["registration.reset_password"]+'<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'right-arrow.svg" alt="image" class="righticon"></button>'+
				'</div>'+
		'</div>').appendTo(pocialPollContainerHtml);
		
		/**vote check after class add */
		if(voteCheck){
			jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .beverage_list_contant").addClass("poll_answered");
		}
	};
	
	if (window.jQuery) pocialGenerateCode_{{CURRENT_SCRIPT_ID}}();
	else {
		var pocialScript = document.createElement('script');		
		document.head.appendChild(pocialScript);
	
		pocialScript.type = 'text/javascript';
		pocialScript.src = "//ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js";
		
		pocialScript.onload = pocialGenerateCode_{{CURRENT_SCRIPT_ID}};
	}
	
} pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();


/** function for used to poll voting  */
pocialPollVoting_{{CURRENT_SCRIPT_ID}} = function (pocialObjectVotingResponse) {

	let pollId = pocialObjectVotingResponse.poll_id;
	let pollSlug = pocialObjectVotingResponse.poll_slug;
	let optionId = pocialObjectVotingResponse.option_id;
	let enticementHeadlineData = pocialObjectVotingResponse.enticement_headline;
	enticementHeadlineData = (enticementHeadlineData) ? enticementHeadlineData.replace(/_/g, " ") : "";

	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();

	/** option wise Enticement headline data store */
	document.getElementById("pocialSpanEnticementheadline_{{CURRENT_SCRIPT_ID}}").innerHTML = enticementHeadlineData;

	/***send object data */
	let makeJsonString = sendObjectString_{{CURRENT_SCRIPT_ID}};
	Object.assign(makeJsonString.data, { "poll_id": pollId, "poll_slug": pollSlug, "option_id": optionId, "custom_url": customUrl_{{CURRENT_SCRIPT_ID}} });

	const myJSON = JSON.stringify(makeJsonString);
	const xhttp = new XMLHttpRequest();
	var pocialAjaxData = new FormData();

	pocialAjaxData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myJSON));
	pocialAjaxData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
	pocialAjaxData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

	xhttp.onload = function () {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();

		let pocialVotingPollData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
		let pocialVotingPollResponse = (pocialVotingPollData && pocialVotingPollData['response']) ? pocialVotingPollData['response'] : {};

		if (pocialVotingPollResponse && pocialVotingPollResponse['status'] == 'success') {
			showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialVotingPollResponse['message']);
		} else {
			showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialVotingPollResponse['message']);
		}

		// let checkUserAlreadyVoted = (pocialVotingPollData && pocialVotingPollResponse['check_user_already_voted']) ? pocialVotingPollResponse['check_user_already_voted'] : 0;
		assignReward_{{CURRENT_SCRIPT_ID}} = (pocialVotingPollData && pocialVotingPollResponse['assign_reward']) ? pocialVotingPollResponse['assign_reward'] : "";
		
		/** if already login voting after direct login function call other wise show popup*/
		let loginCrediantialsEmbed = localStorage.getItem("login_crediantials_embed");
		if(pocialVotingPollData && loginCrediantialsEmbed && !assignReward_{{CURRENT_SCRIPT_ID}}){
			
			/** call function to pocial embed login */
			pocialEmbedLogin_{{CURRENT_SCRIPT_ID}}();
			
			/** Main function call generate */
			pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();
			
		}else{
			/**if reward exits after enhancement popup open */
			if (pocialVotingPollData && assignReward_{{CURRENT_SCRIPT_ID}}) {
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").addClass("pocial_after_vote");
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_poll_question_and_options").hide();

				/** if already login voting after direct login function call other wise show popup*/
				if(loginCrediantialsEmbed){
					/** call function to pocial embed login */
					pocialEmbedLogin_{{CURRENT_SCRIPT_ID}}();
				}else{
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .reward_enticement_sectionembed_1669032135160").show();
				}
			} else {
				/** Main function call generate */
				pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();
			}
		}
	}
	xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/poll_user_vote_participants", true);
	xhttp.send(pocialAjaxData);
};

/**show loading data */
showLoading_{{CURRENT_SCRIPT_ID}} = function () {
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").addClass("remove_popup");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_loading_class").show();
}

/**hide loading data */
hideLoading_{{CURRENT_SCRIPT_ID}} = function () {
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").removeClass("remove_popup");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_loading_class").hide();
}

/** Pocial Cross EnticementHtml close html */
pocialCrossEnticementHtml_{{CURRENT_SCRIPT_ID}} = function () {
	/** Main function call generate */
	sendObjectString_{{CURRENT_SCRIPT_ID}} = { 'data': { 'unique_browser_id': getUniqueBrowserId_{{CURRENT_SCRIPT_ID}}, 'slug': '', 'third_party_site_url': thirdPartySiteUrl_{{CURRENT_SCRIPT_ID}} }, 'device_id': '', 'device_type': '', 'device_token': '', 'embed_type': true };
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").removeClass("pocial_after_vote"); //class add after new screen add
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_poll_question_and_options").show(); // poll options show
	pocialPollMainEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();
}

/** For Show sucess  notification */
showSuccessMessage_{{CURRENT_SCRIPT_ID}} = function (message) {
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_success_message").removeClass("hide_success_message");
	let sendMessage = message + '<span onclick="pocialHideMessage_{{CURRENT_SCRIPT_ID}}(' + "'success'" + ')" class="pocial_coss_message">X</span>';
	showTosterSuccessMessage_{{CURRENT_SCRIPT_ID}} = '<div class="pocial_success_message">' + sendMessage + '</div>';
	document.getElementById("show_toster_success_message_{{CURRENT_SCRIPT_ID}}").innerHTML = showTosterSuccessMessage_{{CURRENT_SCRIPT_ID}};

	/** Hide message after close automatic */
	setTimeout(() => {
		pocialHideMessage_{{CURRENT_SCRIPT_ID}}('success')
	}, 5000);
}

/** For Show error  notification */
showErrorMessage_{{CURRENT_SCRIPT_ID}} = function (message) {
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_error_message").removeClass("hide_error_message");
	let sendMessage = message + '<span onclick="pocialHideMessage_{{CURRENT_SCRIPT_ID}}(' + "'error'" + ')" class="pocial_coss_message">X</span>';
	showTosterErrorMessage_{{CURRENT_SCRIPT_ID}} = '<div class="pocial_error_message">' + sendMessage + '</div>';
	document.getElementById("show_toster_error_message_{{CURRENT_SCRIPT_ID}}").innerHTML = showTosterErrorMessage_{{CURRENT_SCRIPT_ID}};

	/** Hide message after close automatic */
	setTimeout(() => {
		pocialHideMessage_{{CURRENT_SCRIPT_ID}}('error')
	}, 5000);
}

/** Function for use to hide message for success/error message*/
pocialHideMessage_{{CURRENT_SCRIPT_ID}} = function (hideMessageParameter) {
	if (hideMessageParameter == 'success') {
		showTosterSuccessMessage_{{CURRENT_SCRIPT_ID}} = "";
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_success_message").addClass("hide_success_message");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_success_message").html("");
	}
	if (hideMessageParameter == 'error') {
		showTosterErrorMessage_{{CURRENT_SCRIPT_ID}} = "";
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_error_message").addClass("hide_error_message");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_error_message").html("");
	}
}


/** Date of birth function */
let startDateDOB_{{CURRENT_SCRIPT_ID}} = 1900;
let endDateDOB_{{CURRENT_SCRIPT_ID}} = new Date().getFullYear();

setTimeout(() => {
	/** DOB Onload */
	pocialYears_{{CURRENT_SCRIPT_ID}}(endDateDOB_{{CURRENT_SCRIPT_ID}}, startDateDOB_{{CURRENT_SCRIPT_ID}}, endDateDOB_{{CURRENT_SCRIPT_ID}});
	pocialDates_{{CURRENT_SCRIPT_ID}}('');
	pocialMonths_{{CURRENT_SCRIPT_ID}}('');

	/** Phone number format */
	jQuery(function () {
		jQuery('#pocial_mobile_{{CURRENT_SCRIPT_ID}}').on('input', function (e) {
			jQuery(this).attr("maxlength", "14");
			mobileText = jQuery(this);
			var inputValue = mobileText.val();

			/** Remove any non-numeric characters*/
			var numericValue = inputValue.replace(PHONE_NON_NUMERIC_CHARACTER, '');

			/** Format the numeric value with dashes*/
			var formattedValue = numericValue.replace(PHONE_NUMERIC_VALUE_WITH_DASH, '$1-$2-$3');

			/** Update the input value with the formatted value*/
			mobileText.val(formattedValue);
		});
	});
}, 5000);

/** Function for use to pocial mobile hyfan data*/
function pocialMobileFormatHyfan_{{CURRENT_SCRIPT_ID}}() {

}

/** onchange month DOB*/
function pocialMonthChanged_{{CURRENT_SCRIPT_ID}}() {
	pocialDates_{{CURRENT_SCRIPT_ID}}('');
	let dd = document.getElementById("dd_{{CURRENT_SCRIPT_ID}}").value;
	jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_error').html('');
	if (dd == '') {
		jQuery('#dd_error').html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_date'])
	}
}

/** onchange year DOB */
function pocialYearChanged_{{CURRENT_SCRIPT_ID}}() {
	pocialDates_{{CURRENT_SCRIPT_ID}}('');
	pocialMonths_{{CURRENT_SCRIPT_ID}}('');
	let dd = document.getElementById("dd_{{CURRENT_SCRIPT_ID}}").value;
	let mm = document.getElementById("mm_{{CURRENT_SCRIPT_ID}}").value;
	jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_error').html('');
	jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_error').html('');
	if (dd == '') {
		jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_error').html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_date'])
	}
	if (mm == '') {
		jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_error').html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_month'])
	}
}
/** End Date of birth function */

/** onchange username wise url DOB */
custumUrlChanged_{{CURRENT_SCRIPT_ID}} = function () {
	let userNameValue = document.getElementById("pocial_username_{{CURRENT_SCRIPT_ID}}").value;
	jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #custum_url_{{CURRENT_SCRIPT_ID}}').html(PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}}+''+userNameValue);
}


/** Open login popup */
openLoginPopup_{{CURRENT_SCRIPT_ID}} = function () {
	/**open popup after blank data*/
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_email_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_password_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_email_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_password_error").html("");
	/**open popup after blank data*/

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").addClass("pocial_after_vote"); //class add after new screen add
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_poll_question_and_options").hide();  //poll options hide 
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_forget_password_1669032135160").hide();  //poll options hide 
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .reward_enticement_sectionembed_1669032135160").hide();  // poll hide enticemnet list

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").show();
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_signup_1669032135160").hide();
}

/** Open registration popup */
openRegistrationPopup_{{CURRENT_SCRIPT_ID}} = function () {
	/**open popup after blank data*/
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_first_name_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_last_name_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_email_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocial_male_{{CURRENT_SCRIPT_ID}}").prop("checked", false);
		jQuery("#pocial_female_{{CURRENT_SCRIPT_ID}}").prop("checked", false);
		jQuery("#pocial_other_{{CURRENT_SCRIPT_ID}}").prop("checked", false);
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_username_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_password_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_first_name_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_last_name_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_email_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_gender_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #yy_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_error").html("");
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_password_error").html("");
		pocialYears_{{CURRENT_SCRIPT_ID}}(endDateDOB_{{CURRENT_SCRIPT_ID}}, startDateDOB_{{CURRENT_SCRIPT_ID}}, endDateDOB_{{CURRENT_SCRIPT_ID}});
	/**open popup after blank data*/

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").hide();
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_signup_1669032135160").show();
}

/**pocial embed login */
pocialEmbedLogin_{{CURRENT_SCRIPT_ID}} = function () {
	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();
 
	let pocialEmbedEmail = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_email_{{CURRENT_SCRIPT_ID}}").val();
	let pocialEmbedPassword = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_password_{{CURRENT_SCRIPT_ID}}").val();
	
	/** get crediantials last login data*/
	let loginCrediantialsEmbed = localStorage.getItem("login_crediantials_embed");
	if(loginCrediantialsEmbed){
		var loginCrediantialsJsonResult = (loginCrediantialsEmbed) ? JSON.parse(loginCrediantialsEmbed) : "";
		pocialEmbedEmail = (loginCrediantialsJsonResult.pocial_session_email) ? loginCrediantialsJsonResult.pocial_session_email : "";
		pocialEmbedPassword = (loginCrediantialsJsonResult.pocial_session_password) ? loginCrediantialsJsonResult.pocial_session_password : "";
	}

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_email_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_password_error").html("");

	let errorLoginValidation = false;
	if (pocialEmbedEmail == '' || pocialEmbedEmail == null) {
		errorLoginValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_email_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_email']);
	}
	if (pocialEmbedPassword == '' || pocialEmbedPassword == null) {
		errorLoginValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_embed_password_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_password']);
	}

	/**post data */
	if (errorLoginValidation == true) {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	} else {

		/***send object data */
		let makeJsonLoginString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		Object.assign(makeJsonLoginString.data, { "email": pocialEmbedEmail, "password": pocialEmbedPassword, "registration_type":true, "poll_id": pollDetailId_{{CURRENT_SCRIPT_ID}} });

		const myJSON = JSON.stringify(makeJsonLoginString);
		const xhttp = new XMLHttpRequest();
		var pocialAjaxLoginData = new FormData();

		pocialAjaxLoginData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myJSON));
		pocialAjaxLoginData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		pocialAjaxLoginData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			/**hide p loading */
			hideLoading_{{CURRENT_SCRIPT_ID}}();

			let pocialUserLoginData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			let pocialUserLoginStatus = pocialUserLoginData['response']['status'];
 
			if (pocialUserLoginStatus == "success") {
				showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialUserLoginData['response']['message']);

				/** set session email password in local storage*/
				setLocalStorageLoginData_{{CURRENT_SCRIPT_ID}}(pocialEmbedEmail, pocialEmbedPassword);

				/** function for used to reward assign after login wallet */
				let userLoginSlug = pocialUserLoginData['response']['result']['slug'];
				let pocialAuthorizationToken = pocialUserLoginData['response']['token'];
				let loginCheckUserAlreadyVoted = (pocialUserLoginData['response']['check_user_already_voted']) ? pocialUserLoginData['response']['check_user_already_voted'] : 0;

				/** Poll assign reward after login session wise  */
				assignSessionRewardsAfterLogin_{{CURRENT_SCRIPT_ID}}(userLoginSlug, pocialAuthorizationToken);

				/** Show hide html container */
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").addClass("pocial_after_vote"); //class add after new screen add

				let rewardAndEnticement = '<span>' +
							'<a href="#" class="reward_sign_in">' +
								'' + pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.this_reward_added_wallet'] + '' +
							'</a>' +
							'<button class="sign-in view_wallet pointer" onclick="openPocialSiteRedirect_{{CURRENT_SCRIPT_ID}}()" >' +
								'<span>' + pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.view_your_wallet'] + '' +
								'<img src="' + pocialWalletIcon_{{CURRENT_SCRIPT_ID}} + '" alt="img">' +
							'</button>' +
						'</span>';

				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocialSpanRewardHeadline").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['poll_embed.you_have_earned']); /**html replace reward heading earned */

				/** If already vote and reward assign after text change You have already voted for this campaign */
				if (loginCheckUserAlreadyVoted > 0 && assignReward_{{CURRENT_SCRIPT_ID}}) {

					jQuery("#for_participating").html(''); /**html blnak after already reward*/
					rewardAndEnticement = '<span class="thanku_vote">' +
								'<img src="'+frontAssetsImageUrl_{{CURRENT_SCRIPT_ID}}+'thanks-tick.svg"></br></br>'+
								'<a href="#" class="reward_sign_in">' +
									'' + pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.thankyou_for_voting'] +
									'<span>' + pocialTextSettings_{{CURRENT_SCRIPT_ID}}['polls.already_vote_for_this_campaign'] + '</span>' +
								'</a>' +
								'<button class="sign-in view_wallet pointer" onclick="openPocialSiteRedirect_{{CURRENT_SCRIPT_ID}}()" >' +
									'<span>' + pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.view_your_wallet'] + '' +
									'<img src="' + pocialWalletIcon_{{CURRENT_SCRIPT_ID}} + '" alt="img">' +
								'</button>' +
							'</span>';
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #for_participating").html('');
					// jQuery("#pocialSpanEnticementheadline_{{CURRENT_SCRIPT_ID}}").html(''); 
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocialSpanRewardHeadline").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['poll_embed.you_have_already_earned']); /**html replace reward heading earned */
				}
				
				/** reward exists*/
				if (assignReward_{{CURRENT_SCRIPT_ID}}) {
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_reward_enticement_replace_html").html(rewardAndEnticement); /**html replace wallet button */
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .reward_enticement_sectionembed_1669032135160").show(); // poll show enticemnet list 
				}
			} else {
				showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialUserLoginData['response']['message']);
			}
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/login", true);
		xhttp.send(pocialAjaxLoginData);
	}
}

/**Function for used to assign reward after login */
assignSessionRewardsAfterLogin_{{CURRENT_SCRIPT_ID}} = (loginSlug, pocialAuthorizationToken) => {
	/***send object data */
	let makeJsonSessionString = sendObjectString_{{CURRENT_SCRIPT_ID}};
	Object.assign(makeJsonSessionString.data, { "custom_url": customUrl_{{CURRENT_SCRIPT_ID}}, "unique_browser_id": getUniqueBrowserId_{{CURRENT_SCRIPT_ID}}, "slug": loginSlug });

	const mySessionJSON = JSON.stringify(makeJsonSessionString);
	const xhttp = new XMLHttpRequest();
	var pocialAjaxSessionData = new FormData();

	pocialAjaxSessionData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(mySessionJSON));
	pocialAjaxSessionData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
	pocialAjaxSessionData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

	xhttp.onload = function () {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").hide();
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_signup_1669032135160").hide();
		// let sessionDataAfterLogin = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
	}
	xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/assign_session_rewards_after_login", true);
	xhttp.setRequestHeader('Authorization', pocialAuthorizationToken);
	xhttp.send(pocialAjaxSessionData);
}

/** If the number is higher than 9, convert the number to a string (consistency). Otherwise, add a zero. */
formatPocialDobNumber_{{CURRENT_SCRIPT_ID}} = (n) => {
	return n > 9 ? "" + n : "0" + n;
}

/** Pocial embed registration */
pocialEmbedRegistration_{{CURRENT_SCRIPT_ID}} = function () {
	/** Show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();
 
	let pocialFirstName = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_first_name_{{CURRENT_SCRIPT_ID}}").val();
	let pocialLastName = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_last_name_{{CURRENT_SCRIPT_ID}}").val();
	let pocialEmail = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_email_{{CURRENT_SCRIPT_ID}}").val();
	let pocialGender = 3; //jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} input[name="pocial_gender"]:checked').val();
	let PocialMonth = 01; //jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_{{CURRENT_SCRIPT_ID}}").val();
	let pocialDate = 01; //jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_{{CURRENT_SCRIPT_ID}}").val();
	let pocialYear = 1981; //jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #yy_{{CURRENT_SCRIPT_ID}}").val();
	let pocialDob = formatPocialDobNumber_{{CURRENT_SCRIPT_ID}}(pocialDate) + "-" + formatPocialDobNumber_{{CURRENT_SCRIPT_ID}}(PocialMonth) + "-" + pocialYear;
	let pocialMobile = 5555555555; //jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_{{CURRENT_SCRIPT_ID}}").val();
	let pocialZipCode = 99999; //jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_{{CURRENT_SCRIPT_ID}}").val();
	let pocialUsername = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_username_{{CURRENT_SCRIPT_ID}}").val();
	let pocialPassword = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_password_{{CURRENT_SCRIPT_ID}}").val();

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_first_name_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_last_name_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_email_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_gender_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #yy_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_password_error").html("");

	let errorRegistrationValidation = false;
	if (pocialFirstName == '' || pocialFirstName == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_first_name_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_first_name']);
	}
	if (pocialLastName == '' || pocialLastName == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_last_name_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_last_name']);
	}
	if (pocialEmail == '' || pocialEmail == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_email_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_email']);
	}
	if (pocialGender == '' || pocialGender == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_gender_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_gender']);
	}
	if (PocialMonth == '' || PocialMonth == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_month']);
	}
	if (pocialDate == '' || pocialDate == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #dd_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_date']);
	}
	if (pocialYear == '' || pocialYear == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #yy_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_select_year']);
	}
	if (pocialMobile == '' || pocialMobile == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_phone_number']);
	} 
	/** else{
		if(pocialMobile && Number.isInteger(Number(pocialMobile))==false){
			jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.invalid_phone_number']);
		}else if(pocialMobile.length<6 || pocialMobile.length>12){
			jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.embed.valid_phone_number']);
		}
	}*/

	/**if (pocialZipCode == '' || pocialZipCode == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_zip_code']);
	}else if(pocialZipCode && Number.isInteger(Number(pocialZipCode))==false){
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.invalid_zip_code']);
	}*/

	if (pocialPassword == '' || pocialPassword == null) {
		errorRegistrationValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_password_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_password']);
	}	

	/**post data */
	if (errorRegistrationValidation == true) {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	} else {

		/***send object data */
		let makeJsonRegistrationString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		Object.assign(makeJsonRegistrationString.data, {"first_name":pocialFirstName,"last_name":pocialLastName,"email":pocialEmail,"password":pocialPassword,"dob":pocialDob,"user_name":pocialUsername,"zip":pocialZipCode,"mobile":pocialMobile,"gender":pocialGender,"social_id":"","provider":"","registered_from":1});

		const myRegistrationJSON = JSON.stringify(makeJsonRegistrationString);
		const xhttp = new XMLHttpRequest();
		let pocialAjaxLoginData = new FormData();

		pocialAjaxLoginData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myRegistrationJSON));
		pocialAjaxLoginData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		pocialAjaxLoginData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			/**hide p loading */
			hideLoading_{{CURRENT_SCRIPT_ID}}();

			let pocialUserRegistrationData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			let pocialUserResponseData = pocialUserRegistrationData['response'];
			let pocialUserRegistrationStatus = pocialUserResponseData['status'];

			if (pocialUserRegistrationStatus == "success") {
				
				showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialUserResponseData['message']);

				/** set session email password in local storage*/
				setLocalStorageLoginData_{{CURRENT_SCRIPT_ID}}(pocialEmail, pocialPassword);

				/** function for used to reward assign after login wallet */
				let userLoginSlug = pocialUserResponseData['result']['slug'];
				let pocialAuthorizationToken = pocialUserResponseData['token'];
				assignSessionRewardsAfterLogin_{{CURRENT_SCRIPT_ID}}(userLoginSlug, pocialAuthorizationToken);

				/** show hide html container */
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").addClass("pocial_after_vote"); //class add after new screen add
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_poll_question_and_options").hide(); // poll options hide 
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").hide(); //login hide
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_signup_1669032135160").hide(); //registration hide
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_verify_otp_1669032135160").hide(); //registration hide
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .reward_enticement_sectionembed_1669032135160").show(); // poll show enticemnet list 
				let rewardAndEnticement = '<span>'+
								'<a href="#" class="reward_sign_in">'+
									''+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.this_reward_added_wallet']+''+
								'</a>'+
								'<button class="sign-in view_wallet pointer" onclick="openPocialSiteRedirect_{{CURRENT_SCRIPT_ID}}()" >'+
									'<span>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.view_your_wallet']+''+
									'<img src="'+pocialWalletIcon_{{CURRENT_SCRIPT_ID}}+'" alt="img">'+
								'</button>'+
							'</span>';
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocialSpanRewardHeadline").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['poll_embed.you_have_earned']); /**html replace reward heading earned */
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_reward_enticement_replace_html").html(rewardAndEnticement); /**html replace wallet button */


				// /**Function for call to OTP count down timer */
				// pocialOTPVerficationTimerCount_{{CURRENT_SCRIPT_ID}}(pocialOTPMinuteTime_{{CURRENT_SCRIPT_ID}});
				
				// showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialUserResponseData['message']);
				// jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").addClass("pocial_after_vote"); //class add after new screen add
				// jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_poll_question_and_options").hide(); // poll options hide 
				// jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").hide(); //login hide
				// jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_signup_1669032135160").hide(); //registration hide
				// jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_verify_otp_1669032135160").show(); //registration hide
				
				// pocialValidateString_{{CURRENT_SCRIPT_ID}} = (pocialUserResponseData && pocialUserResponseData['result'] && pocialUserResponseData['result']['validate_string']) ? pocialUserResponseData['result']['validate_string'] : 0;
				// jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocialValidateSpanString_{{CURRENT_SCRIPT_ID}}").html(pocialValidateString_{{CURRENT_SCRIPT_ID}}); //validate string show

			} else if (pocialUserRegistrationStatus == "invalid_access_error") {
				showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialUserResponseData['message']);

			} else {
				if (pocialUserResponseData['errors'] == '') {
					showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialUserResponseData['message']);

				} else {
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_first_name_error").html(pocialUserResponseData['errors']['first_name']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_last_name_error").html(pocialUserResponseData['errors']['last_name']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_email_error").html(pocialUserResponseData['errors']['email']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_gender_error").html(pocialUserResponseData['errors']['gender']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #mm_error").html(pocialUserResponseData['errors']['dob']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_mobile_error").html(pocialUserResponseData['errors']['mobile']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_zip_code_error").html(pocialUserResponseData['errors']['zip']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_password_error").html(pocialUserResponseData['errors']['password']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_username_error").html(pocialUserResponseData['errors']['user_name']);
				}
			}
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/user_registration", true);
		xhttp.send(pocialAjaxLoginData);
	}
}

/**Functin for use to front redirect page after reward earn */
openPocialSiteRedirect_{{CURRENT_SCRIPT_ID}} = () => {
	window.open(PocialEmbedFrontUrl_{{CURRENT_SCRIPT_ID}}+"my-wallet/new-rewards", "_blank");
}

/** function for used to registration otp */
// setTimeout(() => {
// 	const jQueryData_{{CURRENT_SCRIPT_ID}} = jQuery(".ap-pocial-otp-input_{{CURRENT_SCRIPT_ID}}");
// 	jQueryData_{{CURRENT_SCRIPT_ID}}.on({
// 		paste(ev) { // Handle Pasting
// 			const clip = ev.originalEvent.clipboardData.getData('text').trim();
// 			// Allow numbers only
// 			if (!/[0-9]{4}/.test(clip)) return ev.preventDefault(); // Invalid. Exit here
// 			// Split string to Array or characters
// 			const s = [...clip];
// 			// Populate inputs. Focus last input. 1cac 1234
// 			jQueryData_{{CURRENT_SCRIPT_ID}}.val(i => s[i]).eq(3).focus();
// 		},
// 		input(ev) { // Handle typing
// 			const clipInput = ev.originalEvent.data;
// 			if (clipInput >= 0 || clipInput <= 9) {
// 				const i = jQueryData_{{CURRENT_SCRIPT_ID}}.index(this);
// 				if (this.value) jQueryData_{{CURRENT_SCRIPT_ID}}.eq(i + 1).focus();
// 			} else {
// 				this.value = "";
// 			}
// 		},
// 		keydown(ev) { // Handle Deleting
// 			const i = jQueryData_{{CURRENT_SCRIPT_ID}}.index(this);
// 			if (!this.value && ev.key === "Backspace" && i) jQueryData_{{CURRENT_SCRIPT_ID}}.eq(i - 1).focus();
// 		}
// 	});
// }, 1500);



/**function for used to verify otp */
pocialOTPVerficationForm_{{CURRENT_SCRIPT_ID}} = function () {
	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();
 
	let digit1 = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #digit_1_{{CURRENT_SCRIPT_ID}}").val();
	let digit2 = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #digit_2_{{CURRENT_SCRIPT_ID}}").val();
	let digit3 = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #digit_3_{{CURRENT_SCRIPT_ID}}").val();
	let digit4 = jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #digit_4_{{CURRENT_SCRIPT_ID}}").val();

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #verify_otp_error").html("");
	let errorVerifyOtpValidation = false;
	if (digit1 == '' || digit1 == null) {
		errorVerifyOtpValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #verify_otp_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['error.otp_required']);
	}
	if (digit2 == '' || digit2 == null) {
		errorVerifyOtpValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #verify_otp_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['error.otp_required']);
	}
	if (digit3 == '' || digit3 == null) {
		errorVerifyOtpValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #verify_otp_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['error.otp_required']);
	}
	if (digit4 == '' || digit4 == null) {
		errorVerifyOtpValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #verify_otp_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['error.otp_required']);
	}

	/**post data */
	if (errorVerifyOtpValidation == true) {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	} else {

		/***send object data */
		let makeJsonOtpVerifyString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		let pocialOtp = digit1+""+digit2+""+digit3+""+digit4;
		Object.assign(makeJsonOtpVerifyString.data, { "page": "verify_account", "otp": pocialOtp, "validate_string": pocialValidateString_{{CURRENT_SCRIPT_ID}} });

		const myVerifyOtpJSON = JSON.stringify(makeJsonOtpVerifyString);
		const xhttp = new XMLHttpRequest();
		var pocialAjaxVerifyOtpData = new FormData();

		pocialAjaxVerifyOtpData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myVerifyOtpJSON));
		pocialAjaxVerifyOtpData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		pocialAjaxVerifyOtpData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			/**hide p loading */
			hideLoading_{{CURRENT_SCRIPT_ID}}();
			
			let pocialUserVerifyData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			let pocialUserVerifyStatus = pocialUserVerifyData['response']['status'];
 
			if (pocialUserVerifyStatus == "success") {
				
				showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialUserVerifyData['response']['message']);

				/** set session email password in local storage*/
				setLocalStorageLoginData_{{CURRENT_SCRIPT_ID}}(pocialOtpEmailLocalStorage_{{CURRENT_SCRIPT_ID}}, pocialOtpPasswordLocalStorage_{{CURRENT_SCRIPT_ID}});

				/** function for used to reward assign after login wallet */
				let userLoginSlug = pocialUserVerifyData['response']['result']['slug'];
				let pocialAuthorizationToken = pocialUserVerifyData['response']['token'];
				assignSessionRewardsAfterLogin_{{CURRENT_SCRIPT_ID}}(userLoginSlug, pocialAuthorizationToken);

				/** show hide html container */
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .embed_parent_1669032135160").addClass("pocial_after_vote"); //class add after new screen add
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_poll_question_and_options").hide(); // poll options hide 
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").hide(); //login hide
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_signup_1669032135160").hide(); //registration hide
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_verify_otp_1669032135160").hide(); //registration hide
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .reward_enticement_sectionembed_1669032135160").show(); // poll show enticemnet list 
				let rewardAndEnticement = '<span>'+
								'<a href="#" class="reward_sign_in">'+
									''+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.this_reward_added_wallet']+''+
								'</a>'+
								'<button class="sign-in view_wallet pointer" onclick="openPocialSiteRedirect_{{CURRENT_SCRIPT_ID}}()" >'+
									'<span>'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['embed.view_your_wallet']+''+
									'<img src="'+pocialWalletIcon_{{CURRENT_SCRIPT_ID}}+'" alt="img">'+
								'</button>'+
							'</span>';
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocialSpanRewardHeadline").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['poll_embed.you_have_earned']); /**html replace reward heading earned */
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #pocial_reward_enticement_replace_html").html(rewardAndEnticement); /**html replace wallet button */
			} else {
				if (pocialUserVerifyData['response']['errors'] == '') {
					showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialUserVerifyData['response']['message']);

				} else {
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #verify_otp_error").html(pocialUserVerifyData['response']['errors']['otp']);
				}
			}
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/verify_otp", true);
		xhttp.send(pocialAjaxVerifyOtpData);
	}
}

/** Function for use to OTP verification 10 minutes count down timer */
pocialOTPVerficationTimerCount_{{CURRENT_SCRIPT_ID}} = function (remaining) {
	var m = Math.floor(remaining / 60);
	var s = remaining % 60;
	
	m = m < 10 ? '0' + m : m;
	s = s < 10 ? '0' + s : s;
	document.getElementById("pocial_otp_timer").innerHTML = m + ':' + s + ' time left';
	remaining -= 1;
	
	if(remaining >= 0 && pocialOTPTimerOn_{{CURRENT_SCRIPT_ID}}) {
	  setTimeout(function() {
		pocialOTPVerficationTimerCount_{{CURRENT_SCRIPT_ID}}(remaining);
	  }, 1500);
	  return;
	}else{
		document.getElementById("pocial_otp_timer").innerHTML = '<a href="javascript:void(0)" onclick="pocialResendOtp_{{CURRENT_SCRIPT_ID}}();" class="pocial_resend_link">'+pocialTextSettings_{{CURRENT_SCRIPT_ID}}['verify_otp.resend_code']+'</a>';
		pocialOTPTimerOn_{{CURRENT_SCRIPT_ID}} = false;
	}
	
	if(!pocialOTPTimerOn_{{CURRENT_SCRIPT_ID}}) {
	  // Do validate stuff here
	  return;
	}	
}

/** function for used to resend otp */
pocialResendOtp_{{CURRENT_SCRIPT_ID}} = function () {
	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();

	/***send object data */
	let makeJsonOtpResendString = sendObjectString_{{CURRENT_SCRIPT_ID}};
	Object.assign(makeJsonOtpResendString.data, { "page": "verify_account", "otp_for": "email", "validate_string": pocialValidateString_{{CURRENT_SCRIPT_ID}}});
	
	const myResendOtpJSON = JSON.stringify(makeJsonOtpResendString);
	const xhttp = new XMLHttpRequest();
	var pocialResendOtpData = new FormData();

	pocialResendOtpData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myResendOtpJSON));
	pocialResendOtpdata.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
	pocialResendOtpData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

	xhttp.onload = function () {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();

		let pocialUserVerifyData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
		let pocialUserVerifyStatus = pocialUserVerifyData['response']['status'];

		if (pocialUserVerifyStatus == "success") {
			/**Function for call to OTP count down timer */
			pocialOTPTimerOn_{{CURRENT_SCRIPT_ID}} = true;
			pocialOTPVerficationTimerCount_{{CURRENT_SCRIPT_ID}}(pocialOTPMinuteTime_{{CURRENT_SCRIPT_ID}});			

			showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialUserVerifyData['response']['message']);
		} else {
			showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialUserVerifyData['response']['message']);
		}
	}
	xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/resend_otp", true);
	xhttp.send(pocialResendOtpData);
}


/** Function for use to show extension wise show open image and video */
pocialImagePopupOpen_{{CURRENT_SCRIPT_ID}} = function (optionExtension, imageVideoUrl) {
	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").addClass("gallery_after_popup");

	if(optionExtension=='mp4'){
		document.getElementById("pocial_show_gallery_popup_open_{{CURRENT_SCRIPT_ID}}").innerHTML = '<div class="pocialEmbedPopupModal">'+
			'<div class="pocialEmbedBodyContainer">'+
				'<button onclick="pocialImagePopupClosed_{{CURRENT_SCRIPT_ID}}()" class="pocialEmbedPopupCloseBtn pointer">X</button>'+
				'<video width="100%" controls autoplay><source src="'+imageVideoUrl+'" type="video/mp4"></video>'+
			'</div>'+
		'</div>';
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	}else{
		document.getElementById("pocial_show_gallery_popup_open_{{CURRENT_SCRIPT_ID}}").innerHTML = '<div class="pocialEmbedPopupModal">'+
			'<div class="pocialEmbedBodyContainer">'+
				'<button onclick="pocialImagePopupClosed_{{CURRENT_SCRIPT_ID}}()" class="pocialEmbedPopupCloseBtn pointer">X</button>'+
				'<img src="'+imageVideoUrl+'">'+
			'</div>'+
		'</div>';
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	}
}

/** Function for use to close show gallery*/
pocialImagePopupClosed_{{CURRENT_SCRIPT_ID}} = function () {
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").removeClass("gallery_after_popup");
	document.getElementById("pocial_show_gallery_popup_open_{{CURRENT_SCRIPT_ID}}").innerHTML = '';
}

/** Function for use to forget password popop*/
pocialForgetPassword_{{CURRENT_SCRIPT_ID}} = function () {
	/**open popup after blank data*/
		jQuery("#forget_email_{{CURRENT_SCRIPT_ID}}").val('');
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #forget_email_error").html("");
	/**open popup after blank data*/

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").hide();
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_forget_password_1669032135160").show();
}

/** Function for use to reset forget password */
pocialResetForgetPassword_{{CURRENT_SCRIPT_ID}} = function () {
	/**Show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();

	let pocialForgetEmail = jQuery("#forget_email_{{CURRENT_SCRIPT_ID}}").val();
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #forget_email_error").html("");

	let errorForgetValidation = false;
	if (pocialForgetEmail == '' || pocialForgetEmail == null) {
		errorForgetValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #forget_email_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_email']);
	}

	/**post data */
	if (errorForgetValidation == true) {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	} else {
		/*** Send object data */
		let makeJsonResetForgetString = sendObjectString_{{CURRENT_SCRIPT_ID}};

		Object.assign(makeJsonResetForgetString.data, { "page_type": "email", "email": pocialForgetEmail });

		const myResendForgetJSON = JSON.stringify(makeJsonResetForgetString);
		const xhttp = new XMLHttpRequest();
		var pocialResetForgetData = new FormData();

		pocialResetForgetData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myResendForgetJSON));
		pocialResetForgetData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		pocialResetForgetData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			/**hide p loading */
			hideLoading_{{CURRENT_SCRIPT_ID}}();

			let pocialResetForgetResponseData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			let pocialResetForgetStatus = pocialResetForgetResponseData['response']['status'];

			if (pocialResetForgetStatus == "success") {
				pocialForgetResetValidateString_{{CURRENT_SCRIPT_ID}} = pocialResetForgetResponseData['response']['validate_string']
				showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialResetForgetResponseData['response']['message']);
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_forget_password_1669032135160").hide();
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_forget_reset_password_1669032135160").show();
			} else {
				if (!pocialResetForgetResponseData['response']['errors']) {
					showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialResetForgetResponseData['response']['message']);
				} else {
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #forget_email_error").html(pocialResetForgetResponseData['response']['errors']['email']);
				}
			}
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/forgot_password", true);
		xhttp.send(pocialResetForgetData);
	}
}


/** Function for use to submit reset forget password */
pocialSubmitResetForm_{{CURRENT_SCRIPT_ID}} = function () {
	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();

	let pocialForgetOtp = jQuery("#reset_forget_otp_{{CURRENT_SCRIPT_ID}}").val();
	let pocialForgetPassword_{{CURRENT_SCRIPT_ID}} = jQuery("#reset_forget_password_{{CURRENT_SCRIPT_ID}}").val();
	let pocialConfirmForgetPassword = jQuery("#reset_forget_confirm_password_{{CURRENT_SCRIPT_ID}}").val();

	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_otp_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_password_error").html("");
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_confirm_password_error").html("");

	let errorForgetValidation = false;
	if (pocialForgetOtp == '' || pocialForgetOtp == null) {
		errorForgetValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_otp_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['front.user.please_enter_otp']);
	}

	if (pocialForgetPassword_{{CURRENT_SCRIPT_ID}} == '' || pocialForgetPassword_{{CURRENT_SCRIPT_ID}} == null) {
		errorForgetValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_password_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_password']);
	}

	if (pocialConfirmForgetPassword == '' || pocialConfirmForgetPassword == null) {
		errorForgetValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_confirm_password_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.please_enter_confirm_password']);
	}

	if (pocialForgetPassword_{{CURRENT_SCRIPT_ID}} != pocialConfirmForgetPassword) {
		errorForgetValidation = true;
		jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_confirm_password_error").html(pocialTextSettings_{{CURRENT_SCRIPT_ID}}['admin.user.confirm_password_should_be_same_as_password']);
	}

	/**post data */
	if (errorForgetValidation == true) {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
	} else {
		/*** Send object data */
		let makeJsonResetForgetString = sendObjectString_{{CURRENT_SCRIPT_ID}};
		Object.assign(makeJsonResetForgetString.data, { "otp": pocialForgetOtp, "password": pocialForgetPassword_{{CURRENT_SCRIPT_ID}}, "confirm_password": pocialConfirmForgetPassword, "validate_string": pocialForgetResetValidateString_{{CURRENT_SCRIPT_ID}} });

		const mySubmitForgetJSON = JSON.stringify(makeJsonResetForgetString);
		const xhttp = new XMLHttpRequest();
		var pocialSubmitResetForgetData = new FormData();

		pocialSubmitResetForgetData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(mySubmitForgetJSON));
		pocialSubmitResetForgetData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
		pocialSubmitResetForgetData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

		xhttp.onload = function () {
			/**hide p loading */
			hideLoading_{{CURRENT_SCRIPT_ID}}();

			let pocialSubmitForgetResponseData = receivedRequestData_{{CURRENT_SCRIPT_ID}}(this.responseText);
			let pocialSubmitForgetStatus = pocialSubmitForgetResponseData['response']['status'];

			if (pocialSubmitForgetStatus == "success") {
				showSuccessMessage_{{CURRENT_SCRIPT_ID}}(pocialSubmitForgetResponseData['response']['message']);
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_forget_reset_password_1669032135160").hide();
				jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .pocial_embed_sigin_1669032135160").show();
			} else {
				if (!pocialSubmitForgetResponseData['response']['errors']) {
					showErrorMessage_{{CURRENT_SCRIPT_ID}}(pocialSubmitForgetResponseData['response']['message']);
				} else {
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_otp_error").html(pocialSubmitForgetResponseData['response']['errors']['otp']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_password_error").html(pocialSubmitForgetResponseData['response']['errors']['password']);
					jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} #reset_forget_confirm_password_error").html(pocialSubmitForgetResponseData['response']['errors']['confirm_password']);
				}
			}
		}
		xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/reset_password", true);
		xhttp.send(pocialSubmitResetForgetData);
	}
}

/** function for used to poll ribbon click logs */
pocialPollRibbonClickLogs_{{CURRENT_SCRIPT_ID}} = function (pollRibbonParameterOptions) {
     
	let pollRibbonPollSlug = pollRibbonParameterOptions.poll_slug;
	let pollRibbonOptionId = pollRibbonParameterOptions.option_id;
	let pollRibbonCtaUrl = pollRibbonParameterOptions.cta_url;

	/**show p loading */
	showLoading_{{CURRENT_SCRIPT_ID}}();

	/***send object data */
	let makeJsonOtpRibbonClicksString = sendObjectString_{{CURRENT_SCRIPT_ID}};
	Object.assign(makeJsonOtpRibbonClicksString.data, { "poll_slug": pollRibbonPollSlug, "option_id": pollRibbonOptionId});
	
	const myRibbonClickLogsJSON = JSON.stringify(makeJsonOtpRibbonClicksString);
	const xhttp = new XMLHttpRequest();
	var pocialRibbonClicksData = new FormData();

	pocialRibbonClicksData.append('req', sendRequestData_{{CURRENT_SCRIPT_ID}}(myRibbonClickLogsJSON));
	pocialRibbonClicksData.append('debug_json_view', debugJsonView_{{CURRENT_SCRIPT_ID}});
	pocialRibbonClicksData.append('is_view_type', isViewType_{{CURRENT_SCRIPT_ID}});

	xhttp.onload = function () {
		/**hide p loading */
		hideLoading_{{CURRENT_SCRIPT_ID}}();
        let regexUrl = '!/^http[s]?:\/\//';
        
		// if (regexUrl.test(pollRibbonCtaUrl)) {
        //     pollRibbonCtaUrl = 'http://'+pollRibbonCtaUrl;
        // }

		window.open(pollRibbonCtaUrl, '_blank');
	}
	xhttp.open("POST", pocialEmbedApiUrl_{{CURRENT_SCRIPT_ID}} + "api/poll_ribbon_click_logs", true);
	xhttp.send(pocialRibbonClicksData);
}


/** Start Date of birth */
var pocialDaysDate_{{CURRENT_SCRIPT_ID}} = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Date dropdown*/
function pocialDates_{{CURRENT_SCRIPT_ID}}(selectDate) {
	let dates = "<option value=''>Date</option>";
	let i;
	let dd = document.getElementById("dd_{{CURRENT_SCRIPT_ID}}").value;
	let mm = document.getElementById("mm_{{CURRENT_SCRIPT_ID}}").value;
	let yy = document.getElementById("yy_{{CURRENT_SCRIPT_ID}}").value;
	let dateLoop = Number(pocialDaysDate_{{CURRENT_SCRIPT_ID}}[mm]);
    
    dateLoop = (isNaN(dateLoop)) ? 31 : dateLoop;

	/** current year months date */
	let d = new Date();
	let currentDate = d.getDate();
	let currentYear = d.getFullYear();
	let currentMonth = d.getMonth() + 1;

	if (mm == 2) {
		dateLoop = Number(yy % 4 == 0) ? 29 : 28;
	}

	/** year wise date start */
	if (currentYear == yy && currentMonth == mm) {
		dateLoop = currentDate
	}

	for (i = 1; i <= dateLoop; i++) {
		let selectedValue = Number(selectDate == i || dd == i) ? "selected" : "";
		dates += "<option value=" + i + " " + selectedValue + ">" + i + "</option>";
	}

	/**You can call the class multiple times*/
	var multiple_list = document.getElementsByClassName("bear-dates");

	for (i = 0; i < multiple_list.length; i++) {
		multiple_list[i].innerHTML = dates;
	}
}

/** Month dropdown*/
function pocialMonths_{{CURRENT_SCRIPT_ID}}(selectMonth) {
	/**List all the Days with array*/
    var list_months = ['', 'January', 'Febuary', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

	/** current year months date */
	let d = new Date();
	let currentYear = d.getFullYear();
	let currentMonth = d.getMonth() + 1;

	/** year wise month select*/
	let monthLength = list_months.length;
	let mm = document.getElementById("mm_{{CURRENT_SCRIPT_ID}}").value;
	let yy = document.getElementById("yy_{{CURRENT_SCRIPT_ID}}").value;
	if (currentYear == yy) {
		monthLength = currentMonth + 1
	}

	let months = "<option value=''>Month</option>";
	for (i = 1; i < monthLength; i++) {
		let selectedValue = Number(selectMonth == i || mm == i) ? "selected" : "";
		months += "<option value=" + i + " " + selectedValue + ">" + list_months[i] + "</option>";
	}

	/** You can call the class multiple times */
	var multiple_list = document.getElementsByClassName("bear-months");
	for (i = 0; i < multiple_list.length; i++) {
		multiple_list[i].innerHTML = months;
	}
}


/** Year dropdown*/
function pocialYears_{{CURRENT_SCRIPT_ID}}(selectYear, startY, endY) {
	let years = "<option value=''>Year</option>";
	for (let i = endY; i >= startY; i--) {
		let selectedValue = Number(selectYear == i) ? "selected" : "";
		years += "<option value=" + i + " " + selectedValue + ">" + i + "</option>";
	}
	//You can call the class multiple times						
	var multiple_list = document.getElementsByClassName("bear-years");
	for (i = 0; i < multiple_list.length; i++) {
		multiple_list[i].innerHTML = years;
	}
}
/** End Date of birth */

/** set localstorage data email and password*/
function setLocalStorageLoginData_{{CURRENT_SCRIPT_ID}}(embedEmail, embedPassword) {
	let pocialCredentials = { 'pocial_session_email': embedEmail, 'pocial_session_password': embedPassword };
	localStorage.setItem("login_crediantials_embed", JSON.stringify(pocialCredentials));
}

/** destroy localstorage data email and password*/
function destroyLocalStorageLoginData_{{CURRENT_SCRIPT_ID}}() {
	localStorage.removeItem("login_crediantials_embed");
}
destroyLocalStorageLoginData_{{CURRENT_SCRIPT_ID}}();

/** Destroy localstorage unique email browser id*/
function destroyLocalStorageUniqueBrowserEmbedId_{{CURRENT_SCRIPT_ID}}() {
	localStorage.removeItem("unique_browser_embed_id");
}

	/***Start Funtion for use to password strength */
		var colors = ['darkred', 'orangered', 'orange', 'yellowgreen'];
			function checkStrength_{{CURRENT_SCRIPT_ID}}(p) {
					let force = 0;
					const regex = /^[a-zA-Z0-9!@#$%^&*]{6,16}$/g;
						
					const lowerLetters = /[a-z]+/.test(p);
					const upperLetters = /[A-Z]+/.test(p);
					const numbers      = /[0-9]+/.test(p);
					const symbols      = regex.test(p);
					const flags        = [lowerLetters, upperLetters, numbers, symbols];
		
					let passedMatches = 0;
					for (const flag of flags) {
						passedMatches += flag === true ? 1 : 0;
					}
		
					force += 2 * p.length + ((p.length >= 10) ? 1 : 0);
					force += passedMatches * 10;
		
					/** short password*/
					force = (p.length <= 6) ? Math.min(force, 10) : force;
					/** poor variety of characters*/
					force = (passedMatches === 1) ? Math.min(force, 10) : force;
					force = (passedMatches === 2) ? Math.min(force, 20) : force;
					force = (passedMatches === 3) ? Math.min(force, 30) : force;
					force = (passedMatches === 4) ? Math.min(force, 40) : force;
		
					return force;
				}


		function checkEmbedPassWordStrength_{{CURRENT_SCRIPT_ID}}() {
			const password = document.getElementById('pocial_password_{{CURRENT_SCRIPT_ID}}').value;
			
			let defaultbg = '#E3E3E3';
			
			setEmbedPasswordBarColors_{{CURRENT_SCRIPT_ID}}(4, defaultbg);
			
			if (password) {
				let checkPassStrength = checkStrength_{{CURRENT_SCRIPT_ID}}(password)
				const c = getEmbedPasswordColor_{{CURRENT_SCRIPT_ID}}(checkPassStrength);
				
				setEmbedPasswordBarColors_{{CURRENT_SCRIPT_ID}}(c.idx, c.col);
				var embedPocialMsg = '';
		
				switch (c.idx) {
					case 1:
						embedPocialMsg = 'Poor';
						break;
					case 2:
						embedPocialMsg = 'Weak';
						break;
					case 3:
						embedPocialMsg = 'Average';
						break;
					case 4:
						embedPocialMsg = 'Strong';
						break;
				}
			} else {
				embedPocialMsg = '';
			}
			document.getElementById('embed_embed_pocial_msg_{{CURRENT_SCRIPT_ID}}').innerHTML = '';
			document.getElementById('embed_embed_pocial_msg_{{CURRENT_SCRIPT_ID}}').innerHTML = embedPocialMsg;
		}

		/**For getting bar color according to password strength */
		function getEmbedPasswordColor_{{CURRENT_SCRIPT_ID}}(s) {
			let idx = 0;

			if (s <= 10) {
				idx = 0;
			} else if (s <= 20) {
				idx = 1;
			} else if (s <= 30) {
				idx = 2;
			} else if (s <= 40) {
				idx = 3;
			} else {
				idx = 4;
			}

			return {
				idx: idx + 1,
				col: colors[idx]
			};
		}

		/**For setting password bar colors */
		function setEmbedPasswordBarColors_{{CURRENT_SCRIPT_ID}}(count, col) {
			for (let n = 0; n < count; n++) {
				if (n == 0){
					var element = document.getElementById("embed_bar0_{{CURRENT_SCRIPT_ID}}");
					element.style.backgroundColor = col;
				}else if (n == 1){
					var element = document.getElementById("embed_bar1_{{CURRENT_SCRIPT_ID}}");
					element.style.backgroundColor = col;
				}else if (n == 2){
					var element = document.getElementById("embed_bar2_{{CURRENT_SCRIPT_ID}}");
					element.style.backgroundColor = col;
				}else if (n == 3){
					var element = document.getElementById("embed_bar3_{{CURRENT_SCRIPT_ID}}");
					element.style.backgroundColor = col;
				}
			}
		}
	/*** End Funtion for use to password strength */

/** size wise pixel get and main container class add px */
function changeSizeContainer_{{CURRENT_SCRIPT_ID}}() {
	var elemWidth_{{CURRENT_SCRIPT_ID}} = document.getElementById("pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").offsetWidth;
	elemWidth_{{CURRENT_SCRIPT_ID}} = elemWidth_{{CURRENT_SCRIPT_ID}}.toString();
	let sizeClass_{{CURRENT_SCRIPT_ID}} = "";
	if (elemWidth_{{CURRENT_SCRIPT_ID}} > 0 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 299) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-0px-to-299px";

	} else if (elemWidth_{{CURRENT_SCRIPT_ID}} >= 300 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 539) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-300px-to-539px";

	} else if (elemWidth_{{CURRENT_SCRIPT_ID}} >= 540 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 767) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-540px-to-767px";

	} else if (elemWidth_{{CURRENT_SCRIPT_ID}} >= 768 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 991) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-768px-to-991px";

	} else if (elemWidth_{{CURRENT_SCRIPT_ID}} >= 992 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 1199) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-992px-to-1199px";

	} else if (elemWidth_{{CURRENT_SCRIPT_ID}} >= 1200 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 1365) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-1200px-to-1365px";
	
	} else if (elemWidth_{{CURRENT_SCRIPT_ID}} >= 1366 && elemWidth_{{CURRENT_SCRIPT_ID}} <= 1440) {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-1366px-to-1440px";

	} else {
		sizeClass_{{CURRENT_SCRIPT_ID}} = "pocial-1440px-to-upper";
	}
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}").addClass("pocialEmbedPollContainer " + sizeClass_{{CURRENT_SCRIPT_ID}} );
};

/**change size screen wise */
setTimeout(() => {
	changeSizeContainer_{{CURRENT_SCRIPT_ID}}();
}, 1500);


/** Pocial Cross EnticementHtml close html */
showOpenPollContent{{CURRENT_SCRIPT_ID}} = function () {
	jQuery("#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}} .show_default_link").hide();
	jQuery(".embed_parent_1669032135160").removeClass("parent_class_first_div_show");
}


/**on change page without refresh page*/
window.addEventListener("resize", function() {
	const removeMultipleClass = document.getElementById('pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}')
	removeMultipleClass.classList.remove('pocial-0px-to-299px', 'pocial-300px-to-539px', 'pocial-540px-to-767px', 'pocial-768px-to-991px', 'pocial-992px-to-1199px', 'pocial-1200px-to-1365px', 'pocial-1366px-to-1440px', 'pocial-1440px-to-upper');

	// jQuery('#pocialEmbedPollContainer_{{CURRENT_SCRIPT_ID}}').removeClass().addClass('pocialEmbedPollContainer');
	changeSizeContainer_{{CURRENT_SCRIPT_ID}}();
});`;

var randomAlphaNum = Math.floor(Math.random() * 1000) + 1;
document.getElementById("pocialEmbedPollContainer").setAttribute("id","pocialEmbedPollContainer_"+randomAlphaNum)
var dynamicScript = document.createElement("script");
dynamicScript.type = "text/javascript";
dynamicScript.async = true;
var newScriptText = responseText.replaceAll('{{CURRENT_SCRIPT_ID}}', randomAlphaNum);
newScriptText = newScriptText.replaceAll('PHONE_NON_NUMERIC_CHARACTER', /\D/g);
newScriptText = newScriptText.replaceAll('PHONE_NUMERIC_VALUE_WITH_DASH', /(\d{3})(\d{1,3})(\d{1,4})/);

dynamicScript.innerHTML = newScriptText;
document.documentElement.appendChild(dynamicScript);