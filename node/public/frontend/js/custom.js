/**
 * This Function in used replace submit button with loading button
 *
 * @params buttonId as Button Id
 *
 * @return null
 **/
function startTextLoading(buttonId){
	$('#'+buttonId).append(LOADING_SPINNER).addClass('running ld-ext-right disabled').prop('disabled', true);
}//end startTextLoading()

/**
 * This Function in used replace loading button with submit button
 *
 * @params buttonId as Button Id
 *
 * @return null
 **/
function stopTextLoading(buttonId){
	$('#'+buttonId).prop('disabled', false).removeClass('running ld-ext-right disabled').find('div.ld').remove();
}//end stopTextLoading()

/**
 *	Function for custom ajax submit
 *
 * 	@param var formId 	as form id for submitting form
 * 	@param var callback as Callback Function
 *
 *	@return null
 */
function ajax_submit(formId,callback){
	var options = {
		success:function(response){
			if(response.status == 'success'){
				callback(true,response);
			}else{
				display_errors(response.message,formId);
				callback(false,response);
			}
		},
		resetForm:false
	};
	$("form#"+formId).ajaxSubmit(options);
}//end ajax_submit()

/**
 *	Function for display validation errors
 *
 * 	@param var errors as Array or errors
 * 	@param var formId as Form id for display errors
 *
 *	@return null
 */
function display_errors(errors,formId){
	$firstError = '';
	$('#'+formId+' span.error').html('');
	$('#'+formId).find('.form-line').removeClass('error');
	$('#'+formId).find(".border-red").removeClass("border-red");
	if(typeof errors == "object"){
		try{
			$.each(errors,function(index,html){
				if(html.param == 'invalid-access'){
					if($firstError == ''){
						$firstError = 'user-defined-notice';
					}
					notice('error',html.msg);
				}else{
					var errorId = html.param;
					if($firstError == ''){
						$firstError = errorId;
					}
					$('#'+formId+' #'+errorId+'_error').prev('.form-line').addClass('error');
					$('#'+formId+' #'+errorId+'_error').html(html.msg).show();
					$('#'+formId+' #'+errorId).addClass("border-red");
					$('#'+formId+' #'+errorId+'_chosen').addClass("border-red");
				}
			});
		}catch(e){
			notice('error','Something went wrong, Please try again.');
			$firstError = 'user-defined-notice';
		}
	}else{
		notice('error',errors);
		$firstError = 'user-defined-notice';
	}
	if($firstError != ''){
		var scrollTopId = '#'+$firstError;
		if($firstError != 'user-defined-notice'){
			if($('#'+$firstError+'_error').length > 0){
				$('#'+$firstError+'_error').focus();
			}
			scrollTopId = '#'+formId+' #'+$firstError+'_error';
		}
		if($(scrollTopId).length > 0){
			$("html,body").animate({scrollTop: $(scrollTopId).offset().top - 150}, "slow");
		}
	}
}//end display_errors()

/**
 * Function For notification messages
 *
 *	@param title 	as Title
 *  @param message 	as Notification Message
 *  @param type 	as Type ('success'/'error'/'info')
 *
 *  @return null
 */
function notice(type,message,timeout,displayPosition,showHideTransition){
	displayPosition 	= (displayPosition == "undefined") ? displayPosition : "top-right";
	showHideTransition 	= (showHideTransition == "undefined") ? showHideTransition : "fade";
	timeout 			= (timeout == "undefined") ? timeout : 10000;
	if (message != "" && message != undefined) {
		$.toast().reset('all');

		if(typeof position !== typeof undefined && position){
			displayPosition = position;
		}
		var bgColor = "#16a1e7";
		if(type == "error"){
			bgColor = "#E91E63";
		}
		$.toast({
			text: message,
			icon: !1,
			showHideTransition: showHideTransition,
			allowToastClose: !0,
			hideAfter: timeout,
			bgColor: bgColor,
			textColor: '#ffffff',
			stack: !1,
			position: displayPosition,
			textAlign: 'left',
			loader: !1,
			loaderBg: '#E91E63',
		});

	}
}// end notice()


/**
 *   Function for Submit form on Enter (Pass Submit Button class in Form data-form-submit-class attribute)
 *
 *  @param null
 *
 *  @return null
 */
$(document).on('keypress','.on_click_submit',function(e){
	var key = e.which;
	if (key == 13) {
		var className = e.target.className;
		if(className.indexOf('notSubmitOnEnter') < 0){
			if(e.shiftKey == 0 || (e.shiftKey == 1 && $(e.target)[0].type!="textarea")){
				var submitId = $(this).attr('data-submit-btn-id');
				if (!$('#'+submitId).is(':disabled')){
					$('#'+submitId).trigger('click');
				}
				return false;
			}
		}
	}
});

/**
 * This funciton in used to set date time format using moment js
 *
 * @params void
 *
 * @return null
 **/
function setDateTimeformat(){
	$('.setDateTimeFormat').each(function(){
		var dateTime 		= ($(this).attr('data-timestamp')) 		? 	parseInt($(this).attr('data-timestamp'))	: $(this).attr('data-date-time');
		var dateTimeFormat 	= ($(this).attr('data-time-format')) 	?	$(this).attr('data-time-format')			: FRONT_DATE_FORMAT;
		var newTime 		= moment(dateTime).tz(DEFAULT_TIME_ZONE).format(dateTimeFormat);
		$(this).text(newTime);
	});
}//end setDateTimeformat()

setDateTimeformat();

/**
 *  Function for Confirmation message
 */
$(document).on('click', '.confirm_box', function(e){
	e.stopImmediatePropagation();
	url 				= 	$(this).attr('data-href');
	confirmMessage 		= 	$(this).attr('data-confirm-message');
	bootbox.confirm(confirmMessage,
	function(result){
		if(result){
			window.location.replace(url);
		}
	});
	e.preventDefault();
});

/**
 *  Read more text
 **/
function readMore(){
	// Configure/customize these variables.
	var defaultChar 	= 100;  // default characters value
	var ellipsestext 	= "...";
	var moretext 		= "Read more »";
	var lesstext 		= "Read less »";

	$('.readmore').each(function() {
		if(!($(this).hasClass("readmore_imported"))){
			showChar = ($(this).attr('data-content-length')) ? $(this).attr('data-content-length') : defaultChar;
			var content = $(this).html();
			if(content.length > showChar) {
				var c = content.substr(0, showChar);
				var h = content.substr(showChar, content.length - showChar);
				var html = c + '<span class="moreellipses">' + ellipsestext+ '&nbsp;</span><span class="morecontent"><span>' + h + '</span>&nbsp;&nbsp;<a href="" class="morelink">' + moretext + '</a></span>';
				$(this).addClass('readmore_imported');
				$(this).html(html);
			}
		}
	});
	$(".morecontent span").hide();
}// end readMore()

/**
 *  Call read more function
 *
 **/
readMore();

/**
 * Show and hide text
 **/
$(document).on('click',".morelink",function(){
	var moretext 		= "Read more »";
	var lesstext 		= "Read less »";
	if($(this).hasClass("less")) {
		$(this).removeClass("less");
		$(this).html(moretext);
	} else {
		$(this).addClass("less");
		$(this).html(lesstext);
	}
	$(this).parent().prev().toggle();
	$(this).prev().toggle();
	return false;
});

/**
 *	Function for custom ajax submit for multipart form data with multilevel array
 *
 * 	@param var formId as form id for submitting form
 * 	@param var callback for callback function
 *
 *	@return null
 */
function submit_multipart_form(formId,callback){
	/** take all form input values in Object format */
	var formData	= $('#'+formId).serializeObject();

	/** FormData is used to submit multipart/form-data */
	var fd 			= new FormData();
	if(formData != undefined){
		$.each(formData,function(key,value){
			/** Append all input values into FormData object */
			if(typeof value == 'object'){
				fd.append(key, JSON.stringify(value));
			}else{
				fd.append(key, value);
			}
		});
	}

	/** Form data is used to submit multipart/form-data */
	var fileData	= $('input[type="file"]');
	if(fileData != undefined){
		$.each(fileData,function(key,value){
			if(value.files[0]!= undefined){
				var name = (value.name) ? value.name : '';
				if(value.multiple != undefined && value.multiple != false){
					var filesValue = (value.files) ? value.files : '';
					$.each(filesValue,function(keyFile,valueFile){
						fd.append(name+"["+keyFile+"]", valueFile);
					});
				}else{
					var filesValue = (value.files[0]) ? value.files[0] : '';
					fd.append(name, filesValue);
				}

				/** Append all file input values into FormData object */
			}
		});
	}
	var currentUrl = (window.location && window.location.href) ? window.location.href : '';
	var options = {
		url: currentUrl,
		type: "POST",
		data : fd,
		processData : false,
		contentType : false,
		success:function(response){
			if(response.status == 'success'){
				callback(true,response);
			}else{
				display_errors(response.message,formId);
				callback(false,response);
			}
		}
	};
	$.ajax(options);
}//end submit_multipart_form()

/*Equal Height*/
function resizeequalheight(){
	equalHeight($(".recent-products, .sales-chart, .pro-description"));
}

function equalHeight(group) {
	tallest = 0;
	group.height('');
	group.each(function() {
	thisHeight = $(this).height();
	if(thisHeight > tallest) {
		tallest = thisHeight;
	}
	});
	group.height(tallest);
}
$(function(){
	$(window).resize(function() {
		setTimeout(resizeequalheight,250)
	});
	setTimeout(resizeequalheight,250)
});


$(document).ready(function(){
	$("select").change(function(){
		if ($(this).val()=="") $(this).css({color: "#999"});
		else $(this).css({color: "#161616"});
	});
});


$(document).ready(function(){
	$("#bench_event").click(function(){
		$(".modal_popup").addClass("modal_popup_active");
		$(".overlay_modal").addClass("c-mask-active");

	});

	$("#popup_close").click(function(){
	$(".modal_popup").removeClass("modal_popup_active");
	$(".overlay_modal").removeClass("c-mask-active");

	});
	$(".overlay_modal").click(function(){
	$(".modal_popup").removeClass("modal_popup_active");
	$(".overlay_modal").removeClass("c-mask-active");
	});
});


$(document).ready(function(){
	$("#open_smallpopup").click(function(){
	$(".modal_popupSmall").addClass("modal_popup_active");
	$(".overlay_modal_second").addClass("overlay_modal-active");
	});

	$(".close_smallmodal").click(function(){
	$(".modal_popupSmall").removeClass("modal_popup_active");
	$(".overlay_modal_second").removeClass("overlay_modal-active");
	});

	$(".overlay_modal_second").click(function(){
	$(".modal_popupSmall").removeClass("modal_popup_active");
	$(".overlay_modal_second").removeClass("overlay_modal-active");
	});

});

/**
 * This funciton in use to update all ckeditor's value in it's textarea element
 *
 * @params void
 *
 * @return null
 **/
function updateCkeditorValue(){
	for (instance in CKEDITOR.instances) {
		CKEDITOR.instances[instance].updateElement();
	}
}//end updateCkeditorValue()

/**
 *	Function for client side validation
 *
 * 	@param var formId As Form id for validate form
 *
 *	@return boolean value
 */
function client_side_validation(formId){

	errorArray		=	[];
	$("#"+formId).find('input,select,textarea,text').each(function (){
		var type	=	this.type || this.tagName.toLowerCase();
		if(type != 'hidden'){
			var	errorId			=	$(this).attr('data-error-id');

			var	inputName		=	(errorId) ? errorId : $(this).attr('name');
			var	inputType		=	$(this).attr('type');
			var errorMessage	= 	"";
			if(inputName){
				var errorFlag	=	false;
				var val			=	$(this).val();
				if(!val || (val && val.constructor !== Array)){
					val	=	(val) ?	val.trim()	:"";
				}

				if(typeof $(this).attr("data-blank-error-message") != 'undefined'){
					if(inputType == "checkbox"){
						if(!$(this).prop('checked')){
							errorFlag		= true;
							errorMessage	= $(this).attr('data-blank-error-message');
						}
					}else if(val == "" && !$(this).hasClass('novalidate')){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-blank-error-message');
					}
				}

				if($(this).hasClass('novalidate') && val =="") errorFlag	 = true;

				if(!errorFlag && typeof $(this).attr("data-email-error-message") != 'undefined'){
					var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
					if(!regex.test(val)){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-email-error-message');
					}
				}

				if(!errorFlag && typeof $(this).attr("data-numeric-error-message") != "undefined" && !$.isNumeric(val)){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-numeric-error-message');
				}

				if(!errorFlag && typeof $(this).attr("data-max-length-error-message") != "undefined" && typeof $(this).attr("data-max-length") != "undefined" && val.length > parseInt($(this).attr("data-max-length"))){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-max-length-error-message');
				}

				if(!errorFlag && typeof $(this).attr("data-min-length-error-message") != "undefined" &&typeof $(this).attr("data-min-length") != "undefined" && val.length < parseInt($(this).attr("data-min-length"))){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-min-length-error-message');
				}

				if(!errorFlag && typeof $(this).attr("data-geater-than-zero-error-message") != "undefined" && val <= 0){
					errorFlag	 = true;
					errorMessage = $(this).attr('data-geater-than-zero-error-message');
				}

				if(errorMessage=="" && typeof $(this).attr("data-confirm-error-message") != "undefined"){
					var targetId = $(this).attr('data-confirm-target-id');
					if(val !== $('#'+targetId).val()){
						errorFlag	 = true;
						errorMessage = $(this).attr('data-confirm-error-message');
					}
				}

				if(!errorFlag && typeof $(this).attr("data-allowed-extensions-error-message") != "undefined" && typeof $(this).attr("data-allowed-extensions") != "undefined"){
					var extension = val.split('.').pop().toLowerCase();
					if($(this).attr("data-allowed-extensions").indexOf(extension) === -1){
						errorFlag	 	= 	true;
						errorMessage	=	$(this).attr("data-allowed-extensions-error-message");
					}
				}

				if(errorMessage!=""){
					errorArray.push({msg : errorMessage,param : inputName});
				}
			}
		}
	});

	if(errorArray.length >0){
		display_errors(errorArray,formId);
		return false;
	}else{
		return true;
	}
}//End client_side_validation()

/**
 *  Function to round number
 */
function customRound(value, precision) {
	try{
		if(!value || isNaN(value)){
			return value;
		}else{
			precision 		= 	(typeof precision != typeof undefined && precision) ? precision :ROUND_PRECISION;
			var multiplier	=	Math.pow(10, precision || 0);
			return Math.round(value * multiplier) / multiplier;
		}
	}catch(e){
		return value;
	}
}//end customRound();

/**
 *  Function to convert currency format
 *
 * @param amount as amount value
 *
 * @return amount after convert currency format
 */
function currencyFormat(amount) {
	if(!amount || isNaN(amount)){
		return amount;
	}else{
		amount	=	customRound(amount,ROUND_PRECISION);
		amount 	=	amount.toString();
		var afterPoint = '';

		if(amount.indexOf('.') > 0) afterPoint = amount.substring(amount.indexOf('.'),amount.length);
		amount = 	Math.floor(amount);
		amount =	amount.toString();
		var lastThree = amount.substring(amount.length-3);
		var otherNumbers = amount.substring(0,amount.length-3);
		if(otherNumbers != '') lastThree = ',' + lastThree;
		return  otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree + afterPoint;
	}
}// end currencyFormat()

/**
 *  Function to convert numeric value in number format (like 3000 => 3,0000)
 *
 * @param value as a numeric value
 *
 * @return numeric value after convert format
 */
function numberFormat(value){
	if(!value || isNaN(value)){
		return value;
	}else{
		value	=	round(value,ROUND_PRECISION);
		value 	=	value.toString();
		var afterPoint = '';

		if(value.indexOf('.') > 0) afterPoint = value.substring(value.indexOf('.'),value.length);
		value = Math.floor(value);
		value =	value.toString();
		var lastThree = value.substring(value.length-3);
		var otherNumbers = value.substring(0,value.length-3);
		if(otherNumbers != '') lastThree = ',' + lastThree;
		return  otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree + afterPoint;
	}
}// end numberFormat()

/**
 *  Function to replace a text on certain id/class
 *
 * @param selector as a id/class
 * @param value as content
 *
 * @return void
 */
function replaceinHTML(selector, value){
	$(selector).html(value);
}// end replaceinHTML()