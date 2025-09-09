var responseText = `let domainUrl_{{CURRENT_SCRIPT_ID}} = 'http://pocial.dev3.gipl.inet:21010/', requiredFieldsIds_{{CURRENT_SCRIPT_ID}} = []; onlyRequiredFields_{{CURRENT_SCRIPT_ID}} = [];
let frontUrl_{{CURRENT_SCRIPT_ID}} = 'http://pocial.dev3.gipl.inet:21090/';

let noImageUrl_{{CURRENT_SCRIPT_ID}} = frontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/p-logo.svg';
let leadImageUrl_{{CURRENT_SCRIPT_ID}} = domainUrl_{{CURRENT_SCRIPT_ID}} + 'public/frontend/uploads/leads_form/';
let thirdPartySiteUrl_{{CURRENT_SCRIPT_ID}} = (window.location.href) ? window.location.href : "";

/***send object data */
let elem_{{CURRENT_SCRIPT_ID}} = document.getElementById("myWidget_{{CURRENT_SCRIPT_ID}}");
let leadFormsId_{{CURRENT_SCRIPT_ID}} = elem_{{CURRENT_SCRIPT_ID}}.getAttribute('data-lead_forms_id');
let scriptedId_{{CURRENT_SCRIPT_ID}} = elem_{{CURRENT_SCRIPT_ID}}.getAttribute('data-scripted_id');
  
function resolveAfter2Seconds_{{CURRENT_SCRIPT_ID}}() {
	return new Promise(resolve => {
		const xhttp = new XMLHttpRequest();
		xhttp.onload = function () {
			let leadData = JSON.parse(this.responseText);
			resolve(leadData.result);
		}
		xhttp.open("GET", domainUrl_{{CURRENT_SCRIPT_ID}} + "api/get_lead_capture_script_listing/" + leadFormsId_{{CURRENT_SCRIPT_ID}} + "/" + scriptedId_{{CURRENT_SCRIPT_ID}});
		xhttp.send();
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
		xhttp.open("GET", domainUrl_{{CURRENT_SCRIPT_ID}} + "api/get_dynamic_string_constant");
		xhttp.send();
	});
}

/**Add a loading spinner while waiting for the data to load*/
function showLoadingSpinner_{{CURRENT_SCRIPT_ID}}() {
	// Create a div for the loading spinner
	const loadingSpinner = document.createElement('div');
	loadingSpinner.id = 'loadingSpinner';

	// Add styling for the loading spinner
	loadingSpinner.style.position = 'fixed';
	loadingSpinner.style.top = '43%';
	loadingSpinner.style.left = '50%';
	loadingSpinner.style.transform = 'translate(-50%, -50%)';
	loadingSpinner.style.zIndex = '1000';

	// Add your own styles here
	loadingSpinner.style.width = '40px';
	loadingSpinner.style.height = '40px';
	loadingSpinner.style.border = '4px solid #ccc';
	loadingSpinner.style.borderTop = '4px solid #3498db';
	loadingSpinner.style.borderRadius = '50%';

	// Animation keyframes
	const spinKeyframes = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';

	// Add animation style
	const style = document.createElement('style');
	style.appendChild(document.createTextNode(spinKeyframes));
	document.head.appendChild(style);

	loadingSpinner.style.animation = 'spin 1s linear infinite';

	// Append the loading spinner to the body
	document.body.appendChild(loadingSpinner);
}


/** Remove the loading spinner when the form is fully loaded*/
function hideLoadingSpinner_{{CURRENT_SCRIPT_ID}}() {
	const loadingSpinner = document.getElementById('loadingSpinner');
	if (loadingSpinner) {
		// Remove the loading spinner from the DOM
		loadingSpinner.parentNode.removeChild(loadingSpinner);
	}
}

/** Load CSS dynamically*/
function loadCSS_{{CURRENT_SCRIPT_ID}}(url, callback) {
	var link = document.createElement('link');
	link.type = 'text/css';
	link.rel = 'stylesheet';
	link.href = url;
	link.onload = callback;
	document.head.appendChild(link);
}

async function pocialScriptedEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}} () {

	/** Show the loading spinner while waiting for lead data*/
	showLoadingSpinner_{{CURRENT_SCRIPT_ID}}();

	/** await function is used to get lead details */
	let leadDataResult = await resolveAfter2Seconds_{{CURRENT_SCRIPT_ID}}();

	/**Read text dynamic data */
	let dynamicTextResult = await readDynamicTextData_{{CURRENT_SCRIPT_ID}}();
	dynamicTextResult = JSON.parse(dynamicTextResult);

	let formTitle = (leadDataResult.form_title) ? leadDataResult.form_title : "";
	let buttonName = (leadDataResult.button_name) ? leadDataResult.button_name : "";
	let mandatoryOptions = (leadDataResult.mandatory_options) ? leadDataResult.mandatory_options : [];
	let addedFields = (leadDataResult.signup_fields) ? leadDataResult.signup_fields : [];
	let messageBoxTitle = (leadDataResult.message_box_title) ? leadDataResult.message_box_title : [];
	let typeDropdownTitle = (leadDataResult.type_dropdown_title) ? leadDataResult.type_dropdown_title : [];
	let creator_id = (leadDataResult.user_id) ? leadDataResult.user_id : "";
	let textToDisplayUpon = (leadDataResult.text_to_display) ? leadDataResult.text_to_display : "";
	let displayUrlDescription = (leadDataResult.display_url_description) ? leadDataResult.display_url_description : "";
	let customThankYouTitle = (leadDataResult.custom_thank_you_title) ? leadDataResult.custom_thank_you_title : dynamicTextResult['complete_profile.you_are_all_done'];
	let customThankYouMessage = (leadDataResult.custom_thank_you_message) ? leadDataResult.custom_thank_you_message : dynamicTextResult['complete_profile.thankyou_for_participating'];
	let imageUrl = (leadDataResult.image) ? leadImageUrl_{{CURRENT_SCRIPT_ID}} + '' + leadDataResult.image : noImageUrl_{{CURRENT_SCRIPT_ID}};

	let resultScript = (leadDataResult && leadDataResult.result_script) ? leadDataResult.result_script : {};
	let bannerResult = (resultScript.banner) ? resultScript.banner : {};
	let descriptionResult = (resultScript.description) ? resultScript.description : {};
	let formDataResult = (resultScript.form_data) ? resultScript.form_data : {};
	let headingResult = (resultScript.heading) ? resultScript.heading : {};
	let mainComponentResult = (resultScript.main_component) ? resultScript.main_component : {};
	let buttonResult = (resultScript.button) ? resultScript.button : {};
	let isActiveCondition = (leadDataResult.is_active) ? leadDataResult.is_active : 0;

	jQueryCode_{{CURRENT_SCRIPT_ID}} = function () {

		// Load CSS dynamically
		loadCSS_{{CURRENT_SCRIPT_ID}}(domainUrl_{{CURRENT_SCRIPT_ID}} + 'admin/css/captureleadscss.css?' + Math.random(), function () {

			jQuery('head').append('<link rel="stylesheet" type="text/css" href="' + domainUrl_{{CURRENT_SCRIPT_ID}} + 'admin/css/captureleadscss.css?' + Math.random() + '" >');

			let formContainerObj = jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}");

			/** Hide the loading spinner after the form is fully loaded */
			hideLoadingSpinner_{{CURRENT_SCRIPT_ID}}();

			// jQuery("<h3>").attr({ class: "text_to_display" }).text(textToDisplayUpon).appendTo(formContainerObj);
			if (leadDataResult.image != '') {
				jQuery("<img src='" + imageUrl + "'>").attr({ class: (leadDataResult.image) ? "" : "no_image_banner" }).appendTo(formContainerObj);
			}

			/** Active deactive condition  */
			if (isActiveCondition == 0) {
				jQuery("<div>").attr({ class: "deactivated_campaign" }).html('<div class="deactivated_campaign">' +
								'<div class="containerdata">' +
									'<div class="deactivated_campaign_box">' +
										'<div class="deactivated_campaign_content">' +
											'<img src="' + frontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/deactivate-campaign-icon.svg" alt="img">' +
											'<h3>This campaign is no longer active.</h3>' +
										'</div>' +
										'<div class="poweredby_pocial">' +
											'<span>Powered by</span> <img class="deactivated_powerd_by" src="' + frontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/logo.svg" alt="img">' +
										'</div>' +
									'</div>' +
								'</div>' +
				'</div>').appendTo(formContainerObj);
				return
			}
			
			jQuery("<div>").attr({ class: "thank_you_message_class" }).html('<div class="lead_embed_container">' +
				'<div class="leadform-section wow fadeInUp">' +
				'<div class="right-lead">' +
				'<div class="right-lead-content">' +
				'<div class="register-section">' +
				'<div class="thank-you-lead">' +
				'<figure><img src="' + frontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/thank-you-check.svg" alt="img"></figure>' +
				'<h3>' + customThankYouTitle + '</h3>' +
				'<p>' + customThankYouMessage + '</p>' +
				'</div>' +
				// '<div class="thank-you-leadcontent">' +
				// '<p>'+dynamicTextResult['complete_profile.thats_right_heading']+'</p>' +
				// '<button type="button" class="wallet_captured_lead_button" onclick="openPocialWalletRedirect_{{CURRENT_SCRIPT_ID}}()"><img src="' + frontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/wallet-icon-white.svg" alt="img">My wallet</button>' +
				// '</div>' +
				'<div class="powerby">Powered by<img src="' + frontUrl_{{CURRENT_SCRIPT_ID}} + 'assets/images/logo.svg" alt="img"></div>' +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>' +
				'</div>').appendTo(formContainerObj);
			jQuery('.thank_you_message_class').hide();

			if (formTitle != '') {
				jQuery("<h3>").attr({ class: "form_title" }).text(formTitle).appendTo(formContainerObj);
			}

			if (displayUrlDescription != '') {
				jQuery("<p>").attr({ class: "display_url_description" }).html(displayUrlDescription).appendTo(formContainerObj);
			}
			
			let formObj = jQuery("<form>").attr({
				id: "captureLeadForm_{{CURRENT_SCRIPT_ID}}",
				class: "captureLeadForm",
				name: "captureLeadForm",
				method: "POST",
				enctype: "multipart/form-data",
				autocomplete: "nope",
				action: domainUrl_{{CURRENT_SCRIPT_ID}} + "api/submit_leads_sigup_fields_third_user",
				onsubmit: "javascript:return submitFormData_{{CURRENT_SCRIPT_ID}}(this);",
			}).appendTo(formContainerObj);
			jQuery("<input>").attr({
				type: "hidden",
				id: "creator_id_{{CURRENT_SCRIPT_ID}}",
				name: "creator_id",
				value: creator_id,
			}).appendTo(formObj);
			jQuery("<input>").attr({
				type: "hidden",
				id: "lead_forms_id_{{CURRENT_SCRIPT_ID}}",
				name: "lead_forms_id",
				value: leadFormsId_{{CURRENT_SCRIPT_ID}},
			}).appendTo(formObj);

			if (addedFields.includes("name") || addedFields.includes("fullname")) {
				let nameFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_fullname"
				}).appendTo(formObj);
				singleFieldContainer = nameFieldDivObj;
				let firstNameText = "First Name";
				let placeHolderTextName = "";
				if (mandatoryOptions.includes("fullname")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('first_name_{{CURRENT_SCRIPT_ID}}');
					firstNameText = firstNameText + "<span class='required'>*</span>";
					placeHolderTextName = "*";
				}
				jQuery("<label>").attr({
					for: "first_name_{{CURRENT_SCRIPT_ID}}"
				}).html(firstNameText).appendTo(nameFieldDivObj);
				jQuery("<input>").attr({
					id: "first_name_{{CURRENT_SCRIPT_ID}}",
					name: "first_name",
					type: "text",
					class: "required",
					placeholder: "First Name" + placeHolderTextName
				}).appendTo(nameFieldDivObj);
				jQuery("<span>").attr({
					for: "first_name_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_first_name_{{CURRENT_SCRIPT_ID}}",
				}).html("First name is required.").appendTo(nameFieldDivObj);
			}

			if (addedFields.includes("name") || addedFields.includes("fullname")) {
				let nameFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_fullname"
				}).appendTo(formObj);
				singleFieldContainer = nameFieldDivObj;
				let lastNameText = "Last Name";
				let placeHolderTextName = "";
				if (mandatoryOptions.includes("fullname")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('last_name_{{CURRENT_SCRIPT_ID}}');
					lastNameText = lastNameText + "<span class='required'>*</span>";
					placeHolderTextName = "*";
				}
				jQuery("<label>").attr({
					for: "last_name_{{CURRENT_SCRIPT_ID}}"
				}).html(lastNameText).appendTo(nameFieldDivObj);
				jQuery("<input>").attr({
					autocomplete: "nope",
					id: "last_name_{{CURRENT_SCRIPT_ID}}",
					name: "last_name",
					type: "text",
					class: "required",
					placeholder: "Last Name" + placeHolderTextName
				}).appendTo(nameFieldDivObj);
				jQuery("<span>").attr({
					for: "last_name_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_last_name_{{CURRENT_SCRIPT_ID}}",
				}).html("Last name is required.").appendTo(nameFieldDivObj);
			}

			if (addedFields.includes("email")) {
				let emailFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_email"
				}).appendTo(formObj);
				singleFieldContainer = emailFieldDivObj;
				requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('email_{{CURRENT_SCRIPT_ID}}');
				jQuery("<label>").attr({
					for: "email"
				}).html("Email Address<span class='required'>*</span>").appendTo(emailFieldDivObj);
				jQuery("<input>").attr({
					id: "email_{{CURRENT_SCRIPT_ID}}",
					name: "email",
					type: "email",
					class: "required",
					placeholder: "Email*"
				}).appendTo(emailFieldDivObj);
				jQuery("<span>").attr({
					for: "email_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_email_{{CURRENT_SCRIPT_ID}}",
				}).html("Email Address is required.").appendTo(emailFieldDivObj);
			}

			if (addedFields.includes("age") || addedFields.includes("dob")) {
				let ageFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_dob"
				}).appendTo(formObj);
				singleFieldContainer = ageFieldDivObj;

				let DOBText = "Date of Birth (MM-DD-YYYY)";
				let placeHolderTextDOB = "";
				if (mandatoryOptions.includes("dob")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('dob_{{CURRENT_SCRIPT_ID}}');
					DOBText = DOBText + "<span class='required'>*</span>";
					placeHolderTextDOB = "*";
				}

				jQuery("<label>").attr({
					for: "dob_{{CURRENT_SCRIPT_ID}}"
				}).html(DOBText).appendTo(ageFieldDivObj);
				jQuery("<input>").attr({
					id: "dob_{{CURRENT_SCRIPT_ID}}",
					name: "dob",
					type: "text",
					class: "required",
					placeholder: "DOB (02-02-2020)" + placeHolderTextDOB,
					onkeypress: "javascript:return maskDate_{{CURRENT_SCRIPT_ID}}(this,event);",
				}).appendTo(ageFieldDivObj);
				jQuery("<span>").attr({
					for: "dob_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_dob_{{CURRENT_SCRIPT_ID}}",
				}).html("Date of Birth is required.").appendTo(ageFieldDivObj);
			}

			if (addedFields.includes("zipcode")) {
				let zipFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_zipcode"
				}).appendTo(formObj);
				singleFieldContainer = zipFieldDivObj;
				let zipText = "Zip Code";
				let placeHolderZip = "";

				if (mandatoryOptions.includes("zipcode")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('zip_{{CURRENT_SCRIPT_ID}}');
					zipText = zipText + "<span class='required'>*</span>";
					placeHolderZip = "*";
				}
				jQuery("<label>").attr({
					for: "zip_{{CURRENT_SCRIPT_ID}}"
				}).html(zipText).appendTo(zipFieldDivObj);
				jQuery("<input>").attr({
					id: "zip_{{CURRENT_SCRIPT_ID}}",
					name: "zip",
					type: "text",
					class: "required",
					placeholder: "Zip" + placeHolderZip
				}).appendTo(zipFieldDivObj);
				jQuery("<span>").attr({
					for: "zip_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_zip_{{CURRENT_SCRIPT_ID}}",
				}).html("Zip Code is required.").appendTo(zipFieldDivObj);
			}

			if (addedFields.includes("phone")) {
				let phoneFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_phone"
				}).appendTo(formObj);
				singleFieldContainer = phoneFieldDivObj;
				let phoneText = "Phone";
				let placeHolderPhone = "";
				if (mandatoryOptions.includes("phone")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('mobile_{{CURRENT_SCRIPT_ID}}');
					phoneText = phoneText + "<span class='required'>*</span>";
					placeHolderPhone = "*";
				}
				jQuery("<label>").attr({
					for: "mobile_{{CURRENT_SCRIPT_ID}}"
				}).html(phoneText).appendTo(phoneFieldDivObj);
				jQuery("<input>").attr({
					id: "mobile_{{CURRENT_SCRIPT_ID}}",
					name: "mobile",
					type: "text",
					class: "required",
					placeholder: "Phone" + placeHolderPhone
				}).appendTo(phoneFieldDivObj);
				jQuery("<span>").attr({
					for: "mobile_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_mobile_{{CURRENT_SCRIPT_ID}}",
				}).html("Phone is required.").appendTo(phoneFieldDivObj);
			}

			if (addedFields.includes("gender")) {
				let genderFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_gender"
				}).appendTo(formObj);
				singleFieldContainer = genderFieldDivObj;
				let genderText = "Gender";
				if (mandatoryOptions.includes("gender")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('gender_{{CURRENT_SCRIPT_ID}}');
					genderText = genderText + "<span class='required'>*</span>";
					placeHolderGender = "*";
				}

				jQuery("<label>").attr({
					for: "gender_{{CURRENT_SCRIPT_ID}}"
				}).html(genderText).appendTo(genderFieldDivObj);

				jQuery('<input>').prop({
					type: 'radio',
					id: 'pLeadGenderMale_{{CURRENT_SCRIPT_ID}}',
					name: 'gender',
					value: '1'
				}).prependTo(
					jQuery('<label>').prop({
						for: 'pLeadGenderMale_{{CURRENT_SCRIPT_ID}}',
						class: 'labelLeadGender'
					}).html(' Male').appendTo(genderFieldDivObj)
				);

				jQuery('<input>').prop({
					type: 'radio',
					id: 'pLeadGenderFemale_{{CURRENT_SCRIPT_ID}}',
					name: 'gender',
					value: '2'
				}).prependTo(
					jQuery('<label>').prop({
						for: 'pLeadGenderFemale_{{CURRENT_SCRIPT_ID}}',
						class: 'labelLeadGender'
					}).html(' Female').appendTo(genderFieldDivObj)
				);

				jQuery('<input>').prop({
					type: 'radio',
					id: 'pLeadGenderOther_{{CURRENT_SCRIPT_ID}}',
					name: 'gender',
					value: '3'
				}).prependTo(
					jQuery('<label>').prop({
						for: 'pLeadGenderOther_{{CURRENT_SCRIPT_ID}}',
						class: 'labelLeadGender'
					}).html(' Other').appendTo(genderFieldDivObj)
				);

				jQuery("<span>").attr({
					for: "gender_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_gender_{{CURRENT_SCRIPT_ID}}",
				}).html("Gender is required.").appendTo(genderFieldDivObj);
			}

			/** message box wise text*/
			if (messageBoxTitle.length > 0) {
				for (var title in messageBoxTitle) {
					let labelTitle = messageBoxTitle[title]['label'];
					let mandatory = messageBoxTitle[title]['mandatory'];
					let placeholder = labelTitle;
					let placeHolderMessage = "";

					let fullWidthMessage = "full_width_" + labelTitle.replace(RegExp(" ", 'g'), "_").toLowerCase()

					let messageBoxTitleFieldDivObj = jQuery("<div>").attr({
						class: "divFieldContnr " + fullWidthMessage
					}).appendTo(formObj);
					singleFieldContainer = messageBoxTitleFieldDivObj;

					if (mandatory == 'yes' || mandatory == 'Yes') {
						requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('message_box_title' + title);
						labelTitle = labelTitle + "<span class='required'>*</span>";
						placeHolderMessage = "*";
					}
					jQuery("<label>").attr({
						for: "message_box_title" + title
					}).html(labelTitle).appendTo(messageBoxTitleFieldDivObj);
					jQuery("<input>").attr({
						autocomplete: "nope",
						id: "message_box_title" + title,
						name: "message_box_title" + title,
						type: "text",
						class: "required",
						placeholder: placeholder + placeHolderMessage
					}).appendTo(messageBoxTitleFieldDivObj);
					jQuery("<span>").attr({
						for: "message_box_title" + title,
						class: "error",
						id: "error_message_box_title" + title,
					}).html("This field is required.").appendTo(messageBoxTitleFieldDivObj);
				}
			}

			if (addedFields.includes("username")) {
				let usernameFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_username"
				}).appendTo(formObj);
				singleFieldContainer = usernameFieldDivObj;
				let usernameText = "Username";
				let placeHolderUsername = "";
				if (mandatoryOptions.includes("username")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('user_name_{{CURRENT_SCRIPT_ID}}');
					usernameText = usernameText + "<span class='required'>*</span>";
					placeHolderUsername = "*";
				}
				jQuery("<label>").attr({
					for: "user_name_{{CURRENT_SCRIPT_ID}}"
				}).html(usernameText).appendTo(usernameFieldDivObj);
				jQuery("<input>").attr({
					autocomplete: "nope",
					id: "user_name_{{CURRENT_SCRIPT_ID}}",
					name: "user_name",
					type: "text",
					class: "required",
					placeholder: "Username" + placeHolderUsername
				}).appendTo(usernameFieldDivObj);
				jQuery("<span>").attr({
					for: "user_name_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_user_name_{{CURRENT_SCRIPT_ID}}",
				}).html("Username is required.").appendTo(usernameFieldDivObj);
			}

			if (addedFields.includes("password")) {
				let passwordFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr full_width_password"
				}).appendTo(formObj);
				singleFieldContainer = passwordFieldDivObj;
				let passwordText = "Password";
				let placeHolderPassword = "";
				if (mandatoryOptions.includes("password")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('password_{{CURRENT_SCRIPT_ID}}');
					passwordText = passwordText + "<span class='required'>*</span>";
					placeHolderPassword = "*";
				}
				jQuery("<label>").attr({
					for: "password_{{CURRENT_SCRIPT_ID}}"
				}).html(passwordText).appendTo(passwordFieldDivObj);
				jQuery("<input>").attr({
					autocomplete: "nope",
					id: "password_{{CURRENT_SCRIPT_ID}}",
					name: "password",
					type: "password",
					class: "required",
					placeholder: "Password" + placeHolderPassword
				}).appendTo(passwordFieldDivObj);
				jQuery("<span>").attr({
					for: "password_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_password_{{CURRENT_SCRIPT_ID}}",
				}).html("Password is required.").appendTo(passwordFieldDivObj);
			}

			/** Dropdown wise data */
			if (typeDropdownTitle.length > 0) {
				for (var dropdown in typeDropdownTitle) {
					let labelTitle = typeDropdownTitle[dropdown]['label'];
					let mandatory = typeDropdownTitle[dropdown]['mandatory'];
					let optionsData = typeDropdownTitle[dropdown]['options'];

					let blnakOptions = "<option value=''>Make Your Selection</option>";
					if (mandatory == 'yes' || mandatory == 'Yes') {
						blnakOptions = "<option value=''>Make Your Selection*</option>";
					}

					let dropdownData = blnakOptions.concat(optionsData);
					let fullWidthDropdown = "full_width_" + labelTitle.replace(RegExp(" ", 'g'), "_").toLowerCase()

					let typeDropdownTitleFieldDivObj = jQuery("<div>").attr({
						class: "divFieldContnr " + fullWidthDropdown
					}).appendTo(formObj);
					singleFieldContainer = typeDropdownTitleFieldDivObj;

					if (mandatory == 'yes' || mandatory == 'Yes') {
						requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('type_dropdown_title' + dropdown);
						labelTitle = labelTitle + "<span class='required'>*</span>";
					}

					jQuery("<label>").attr({
						for: "type_dropdown_title" + dropdown
					}).html(labelTitle).appendTo(typeDropdownTitleFieldDivObj);

					jQuery("<select>").attr({
						id: "type_dropdown_title" + dropdown,
						name: "type_dropdown_title" + dropdown,
						type: "text",
						class: "required",
						placeholder: "Mobile Code"
					}).appendTo(typeDropdownTitleFieldDivObj);
					jQuery("<span>").attr({
						for: "type_dropdown_title" + dropdown,
						class: "error",
						id: "error_type_dropdown_title" + dropdown,
					}).html("This field is required.").appendTo(typeDropdownTitleFieldDivObj);
					jQuery("#type_dropdown_title" + dropdown).append(dropdownData);
				}
			}

			/** Image file input*/
			if (addedFields.includes("image_name")) {
				let imageFileFieldDivObj = jQuery("<div>").attr({
					class: "divFieldContnr image_new_design full_width_image_name"
				}).appendTo(formObj);
				singleFieldContainer = imageFileFieldDivObj;
				let imageText = "Upload Image";
				if (mandatoryOptions.includes("image_name")) {
					requiredFieldsIds_{{CURRENT_SCRIPT_ID}}.push('image_name_{{CURRENT_SCRIPT_ID}}');
					imageText = imageText + "<span class='required'>*</span>";
				}
				jQuery("<label>").attr({
					for: "image_name_{{CURRENT_SCRIPT_ID}}"
				}).html(imageText).appendTo(imageFileFieldDivObj);
				jQuery("<input>").attr({
					autocomplete: "nope",
					id: "image_name_{{CURRENT_SCRIPT_ID}}",
					name: "image_name",
					type: "file",
					class: "image_name required",
					placeholder: "Image"
				}).appendTo(imageFileFieldDivObj);
				jQuery("<span>").attr({
					for: "image_name_{{CURRENT_SCRIPT_ID}}",
					class: "error",
					id: "error_image_name_{{CURRENT_SCRIPT_ID}}",
				}).html("Image is required.").appendTo(imageFileFieldDivObj);
			}

			if (addedFields.length > 0) {
				let sbmtBtnDivObj = jQuery("<div>").attr({
					class: "divFieldContnr divSubmitContnr"
				}).appendTo(formObj);
				jQuery("<button>").attr({
					id: "fieldSubmitBtn_{{CURRENT_SCRIPT_ID}}",
					name: "fieldSubmitBtn",
					type: "button",
					value: "Submit",
					class: "submitBtnClass",
					onclick: "javascript:submitFormData_{{CURRENT_SCRIPT_ID}}(this);"
				}).text(buttonName).appendTo(sbmtBtnDivObj);
				
				if (addedFields.length == 1 && typeDropdownTitle.length == 0 && messageBoxTitle.length == 0) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}}").addClass("singleFieldForm");
				}
			}
			jQuery(".error").hide();

			jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({
				background: "#ffffff"
			});

			if (Object.keys(resultScript).length > 0) {

				/**START MAIN COMPONENTS*/
				bodyBackgroundColor = (mainComponentResult && mainComponentResult.background_color) ? mainComponentResult.background_color : "#ffffff";
				border = (mainComponentResult && mainComponentResult.border) ? mainComponentResult.border : "";
				allCheckbox = (mainComponentResult.all_checkbox);
				topCheckbox = (mainComponentResult.top_checkbox);
				rightCheckbox = (mainComponentResult.right_checkbox);
				bottomCheckbox = (mainComponentResult.bottom_checkbox);
				leftCheckbox = (mainComponentResult.left_checkbox);
				mainBorderRadius = (mainComponentResult && mainComponentResult.border_radius) ? mainComponentResult.border_radius : "";
				mainBoxShadow = (mainComponentResult.main_box_shadow);
				mainContainerWidth = (mainComponentResult && mainComponentResult.main_container_width) ? mainComponentResult.main_container_width : "";
				mainCustomWidth = (mainComponentResult && mainComponentResult.main_custom_width) ? mainComponentResult.main_custom_width : "";
				mainContainerShadow = (mainComponentResult && mainComponentResult.main_container_shadow) ? mainComponentResult.main_container_shadow : "";


				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'background': bodyBackgroundColor, 'max-width': (mainContainerWidth == 'full_width') ? '100%' : mainCustomWidth });
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'border-top': "0px", 'border-radius': mainBorderRadius + "px" });
				if (allCheckbox) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'background': bodyBackgroundColor, 'border': border, 'border-radius': mainBorderRadius + "px" });
				} else {
					if (topCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'border-top': border, 'border-radius': mainBorderRadius + "px" });
					}
					if (rightCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'border-right': border, 'border-radius': mainBorderRadius + "px" });
					}
					if (bottomCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'border-bottom': border, 'border-radius': mainBorderRadius + "px" });
					}
					if (leftCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'border-left': border, 'border-radius': mainBorderRadius + "px" });
					}
				}

				if (mainBoxShadow) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").css({ 'box-shadow': mainContainerShadow });
				}
				/**END MAIN COMPONENTS*/

				/**START HEADING/HEADER COMPONENTS */
				headerTextColor = (headingResult && headingResult.header_textcolor) ? headingResult.header_textcolor : "#000000";
				titleCheckbox = (headingResult.title_checkbox);
				titleBold = (headingResult.header_bold);
				titleItalic = (headingResult.header_italic);
				titleUnderline = (headingResult.header_underline);
				titleFontSize = (headingResult && headingResult.header_font_size) ? headingResult.header_font_size : "32";
				titleFontFamilySelect = (headingResult && headingResult.header_font_family) ? headingResult.header_font_family : "";
				titleFontOtherFamily = (headingResult && headingResult.header_other_font_family) ? headingResult.header_other_font_family : "";
				titleFontFamily = (titleFontFamilySelect == 'other') ? titleFontOtherFamily : titleFontFamilySelect;
				headingTextAlign = (headingResult && headingResult.heading_align) ? headingResult.heading_align : "";
				headingTransformText = (headingResult && headingResult.heading_transform_text) ? headingResult.heading_transform_text : "";

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ color: headerTextColor, });

				if (!titleCheckbox) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").remove();
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ display: 'none' });
				}

				if (!titleBold) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ 'font-weight': 'normal' });
				}

				if (titleItalic) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ 'font-style': 'italic' });
				}

				if (titleUnderline) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ 'text-decoration-line': 'underline' });
				}

				if (titleFontFamily) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ 'font-family': titleFontFamily });
				}

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display").css({ 'font-size': titleFontSize + 'px' });

				if (headingTextAlign) {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display').addClass(function () { jQuery(this).toggleClass('align-' + headingTextAlign); });
				}

				if (headingTransformText != 'default') {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} h3.text_to_display').addClass(function () { jQuery(this).toggleClass('text-' + headingTransformText); });
				}
				/**END HEADING/HEADER COMPONENTS */



				/**START DESCRIPTION COMPONENTS*/
				descriptionTextColor = (descriptionResult && descriptionResult.description_text_color) ? descriptionResult.description_text_color : "#000000";
				descriptionCheckbox = (descriptionResult.description_checkbox);
				descriptionBold = (descriptionResult.description_bold);
				descriptionItalic = (descriptionResult.description_italic);
				descriptionUnderline = (descriptionResult.description_underline);
				descriptionFontSize = (descriptionResult && descriptionResult.description_fontsize) ? (descriptionResult.description_fontsize) : "14";
				descriptionFontFamilySelect = (descriptionResult && descriptionResult.description_fontfamily) ? (descriptionResult.description_fontfamily) : "";
				descriptionOtherFontFamily = (descriptionResult && descriptionResult.description_other_font_family) ? (descriptionResult.description_other_font_family) : "";
				descriptionFontFamily = (descriptionFontFamilySelect == 'other') ? descriptionOtherFontFamily : descriptionFontFamilySelect;
				descriptionTextAlign = (descriptionResult && descriptionResult.description_align) ? descriptionResult.description_align : "";
				descriptionTransformText = (descriptionResult && descriptionResult.description_transform_text) ? descriptionResult.description_transform_text : "";

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").css({ color: descriptionTextColor });

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description a").css({ color: descriptionTextColor });

				if (!descriptionCheckbox) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").remove();
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").css({ display: 'none' });
				}

				if (descriptionBold) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").css({ 'font-weight': 'bold' });
				}

				if (descriptionItalic) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").css({ 'font-style': 'italic' });
				}

				if (descriptionUnderline) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").css({ 'text-decoration-line': 'underline' });
				}

				if (descriptionFontFamily) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description").css({ 'font-family': descriptionFontFamily });
				}

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} p").css({ 'font-size': descriptionFontSize + 'px', 'line-height': Number(descriptionFontSize) + 8 + 'px' });

				if (descriptionTextAlign) {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description').addClass(function () { jQuery(this).toggleClass('align-' + descriptionTextAlign); });
				}

				if (descriptionTransformText != 'default') {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} p.display_url_description').addClass(function () { jQuery(this).toggleClass('text-' + descriptionTransformText); });
				}
				/**END DESCRIPTION COMPONENTS*/

				/**START FORM COMPONENTS*/
				formTitleTextColor = (formDataResult && formDataResult.form_title_textcolor) ? formDataResult.form_title_textcolor : "#000000";
				labelColor = (formDataResult && formDataResult.label_color) ? formDataResult.label_color : "#000000";
				textBoxColor = (formDataResult && formDataResult.text_box_color) ? formDataResult.text_box_color : "#ffffff";
				textBoxBorderColor = (formDataResult && formDataResult.text_box_border_color) ? formDataResult.text_box_border_color : "#b7b7b7";
				formTitleBold = (formDataResult.form_title_bold);
				formTitleItalic = (formDataResult.form_title_italic);
				formTitleUnderline = (formDataResult.form_title_underline);
				formTitleFontSize = (formDataResult && formDataResult.form_title_fontsize) ? (formDataResult.form_title_fontsize) : "24";
				formTitleFontFamilySelect = (formDataResult && formDataResult.form_title_fontfamily) ? (formDataResult.form_title_fontfamily) : "";
				formTitleOtherFontFamily = (formDataResult && formDataResult.form_title_other_font_family) ? (formDataResult.form_title_other_font_family) : "";
				formTitleFontFamily = (formTitleFontFamilySelect == 'other') ? formTitleOtherFontFamily : formTitleFontFamilySelect;
				formTitleAlign = (formDataResult && formDataResult.form_title_align) ? formDataResult.form_title_align : "";
				formTitleTransformText = (formDataResult && formDataResult.form_title_transform_text) ? formDataResult.form_title_transform_text : "";

				formTitleChkboxShow = (formDataResult.form_title_chkboxshow) ? formDataResult.form_title_chkboxshow : false;
				formLabelBold = (formDataResult.form_label_bold);
				formLabelItalic = (formDataResult.form_label_italic);
				formLabelUnderline = (formDataResult.form_label_underline);
				formLabelFontSize = (formDataResult && formDataResult.form_label_fontsize) ? (formDataResult.form_label_fontsize) : "14";
				formLabelFontFamilySelect = (formDataResult && formDataResult.form_label_fontfamily) ? (formDataResult.form_label_fontfamily) : "";
				formLabelOtherFontFamily = (formDataResult && formDataResult.form_label_other_font_family) ? (formDataResult.form_label_other_font_family) : "";
				formLabelFontFamily = (formLabelFontFamilySelect == 'other') ? formLabelOtherFontFamily : formLabelFontFamilySelect;
				formLabelAlign = (formDataResult && formDataResult.form_label_align) ? formDataResult.form_label_align : "";
				formLabelTransformText = (formDataResult && formDataResult.form_label_transform_text) ? formDataResult.form_label_transform_text : "";

				formLabelChkboxShow = (formDataResult.form_label_chkboxshow);
				textBoxHeight = (formDataResult && formDataResult.text_box_height) ? (formDataResult.text_box_height) : "47";
				textBoxBorderRedius = (formDataResult && formDataResult.text_boxborder_radius) ? (formDataResult.text_boxborder_radius) : "5";
				textboxWidth = (formDataResult && formDataResult.textbox_width) ? (formDataResult.textbox_width) : "";
				textboxShadow = (formDataResult && formDataResult.textbox_shadow) ? (formDataResult.textbox_shadow) : false;
				textBoxShadowAllData = (formDataResult && formDataResult.textbox_shadow_all_data) ? (formDataResult.textbox_shadow_all_data) : "";

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .form_title").css({ color: formTitleTextColor });

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ color: labelColor });

				jQuery("form input").css({ background: textBoxColor });

				jQuery("form select").css({ background: textBoxColor });

				if (!formTitleBold) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .form_title").css({ 'font-weight': 'normal', });
				}

				if (formTitleItalic) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .form_title").css({ 'font-style': 'italic' });
				}

				if (formTitleUnderline) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .form_title").css({ 'text-decoration-line': 'underline' });
				}

				if (formTitleFontFamily) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .form_title").css({ 'font-family': formTitleFontFamily });
				}

				if (formLabelBold) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ 'font-weight': 'bold' });
				}

				if (formLabelItalic) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ 'font-style': 'italic' });
				}

				if (formLabelUnderline) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ 'text-decoration-line': 'underline' });
				}

				if (formLabelFontFamily) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ 'font-family': formLabelFontFamily });
				}
 
				if (!formTitleChkboxShow) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.form_title").remove();
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} h3.form_title").css({ display: 'none' });
				}
				if (!formLabelChkboxShow) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").remove();
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ display: 'none' });
				}

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .form_title").css({ 'font-size': formTitleFontSize + 'px' });
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form label").css({ 'font-size': formLabelFontSize + 'px' });
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .required").css({ 'font-size': formLabelFontSize + 'px', color: labelColor });

				if (formTitleAlign) {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .form_title').addClass(function () { jQuery(this).toggleClass('align-' + formTitleAlign); });
				}

				if (formTitleTransformText != 'default') {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .form_title').addClass(function () { jQuery(this).toggleClass('text-' + formTitleTransformText); });
				}

				if (formLabelAlign) {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} form label').addClass(function () { jQuery(this).toggleClass('align-' + formLabelAlign); });
				}

				if (formLabelTransformText != 'default') {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} form label').addClass(function () { jQuery(this).toggleClass('text-' + formLabelTransformText); });
				}

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr input[type=text], #myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr input[type=password], #myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr input[type=email], #myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr input[type=file], .divFieldContnr select").css({
					'border': '1px solid ' + textBoxBorderColor
				});

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} input[type=file], input[type=text], input[type=password], input[type=email], select").css({
					'height': textBoxHeight,
					'border-radius': textBoxBorderRedius + 'px',
				});

				if (textboxWidth) {
					// let textboxWidthArray = textboxWidth.split(",");
					let textboxWidthArray = textboxWidth;
					textboxWidthArray.map(cssApplyfield => {
						jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .' + cssApplyfield).addClass(function () { jQuery(this).toggleClass('full_width_field'); });
					})
					// [...textboxWidthArray].map(option => jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .' + option.value).addClass(function () { jQuery(this).toggleClass('full_width_field'); }));
				}

				if (textboxShadow) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} input[type=file], input[type=text], input[type=password], input[type=email], select").css({ 'box-shadow': textBoxShadowAllData });
				}
				/**END FORM COMPONENTS*/


				/**START BUTTON COMPONENTS*/
				buttonBold = (buttonResult.button_bold);
				buttonItalic = (buttonResult.button_italic);
				buttonUnderline = (buttonResult.button_underline);
				buttonBackgroundColor = (buttonResult && buttonResult.button_background_color) ? buttonResult.button_background_color : "#3188a3";
				buttonTextColor = (buttonResult && buttonResult.button_textcolor) ? buttonResult.button_textcolor : "#3188a3";
				buttonBorderRadius = (buttonResult && buttonResult.border_radius_size) ? buttonResult.border_radius_size : "24";
				buttonAlign = (buttonResult && buttonResult.button_align) ? buttonResult.button_align : "right";
				buttonHover = (buttonResult.button_hover);
				buttonWidthOption = (buttonResult && buttonResult.button_width_option) ? (buttonResult.button_width_option) : "";
				widthPercentageSize = (buttonResult && buttonResult.width_percentage_size) ? (buttonResult.width_percentage_size) : "";
				buttonTransformText = (buttonResult && buttonResult.button_transform_text) ? (buttonResult.button_transform_text) : "";
				buttonHeight = (buttonResult && buttonResult.button_height) ? (buttonResult.button_height) : "47";
				buttonHoverBackgroundColor = (buttonResult.button_hover_background_color) ? buttonResult.button_hover_background_color : "";
				buttonHoverTextColor = (buttonResult.button_hover_text_color) ? buttonResult.button_hover_text_color : "";
				buttonHoverBorderColor = (buttonResult.button_hover_border_color) ? buttonResult.button_hover_border_color : "";



				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} button").css({ background: buttonBackgroundColor, color: buttonTextColor });
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({ 'font-weight': 'normal' });

				if (buttonBold) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({ 'font-weight': 'bold' });
				}
				if (buttonItalic) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({ 'font-style': 'italic' });
				}
				if (buttonUnderline) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({ 'text-decoration-line': 'underline' });
				}

				if (buttonWidthOption == 'full_width_button') {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({ 'border-radius': buttonBorderRadius + 'px', 'height': buttonHeight + 'px', 'width': 'inherit' });

				} else if (buttonWidthOption == 'custom' && widthPercentageSize) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({
						'border-radius': buttonBorderRadius + 'px', 'width': widthPercentageSize, 'height': buttonHeight + 'px', 'float': buttonAlign
					});

				} else {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({
						'border-radius': buttonBorderRadius + 'px', 'height': buttonHeight + 'px', 'float': buttonAlign
					});
				}

				if (buttonHover) {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass').hover(function (e) {
						jQuery(this).css({ 'background': buttonHoverBackgroundColor, 'color': buttonHoverTextColor, 'border': '1px solid ' + buttonHoverBorderColor });
					}, function () {
						jQuery(this).css({ 'background': buttonBackgroundColor, 'color': buttonTextColor, 'border': '1px solid ' + buttonBackgroundColor });
					});
				}

				if (buttonTransformText != 'default') {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .divFieldContnr.divSubmitContnr .submitBtnClass").css({ 'text-transform': buttonTransformText });
				}
				/**END BUTTON COMPONENTS*/

				/**START BANNER COMPONENTS*/
				bannerCheckbox = (bannerResult.banner_check_box) ? bannerResult.banner_check_box : "";
				bannerBorderColor = (bannerResult.banner_border_color) ? bannerResult.banner_border_color : "";
				bannerBorderRadius = (bannerResult.banner_border_radius) ? bannerResult.banner_border_radius : "";
				bannerBorderPixel = (bannerResult.banner_border_pixel) ? bannerResult.banner_border_pixel : "";
				bannerBorderStyle = (bannerResult.banner_border_style) ? bannerResult.banner_border_style : "";
				bannerAllCheckbox = (bannerResult.banner_all_checkbox);
				bannerTopCheckbox = (bannerResult.banner_top_checkbox);
				bannerRightCheckbox = (bannerResult.banner_right_checkbox);
				bannerBottomCheckbox = (bannerResult.banner_bottom_checkbox);
				bannerLeftCheckbox = (bannerResult.banner_left_checkbox);
				bannerWidth = (bannerResult.banner_width) ? bannerResult.banner_width : "";
				bannerCustomWidth = (bannerResult.banner_custom_width) ? bannerResult.banner_custom_width : "";
				bannerBorder = (bannerResult.banner_border) ? bannerResult.banner_border : "";
				bannerShadow = (bannerResult && bannerResult.banner_shadow) ? (bannerResult.banner_shadow) : "";
				bannerShadowAllData = (bannerResult && bannerResult.banner_shadow_all_data) ? (bannerResult.banner_shadow_all_data) : "";


				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'border-radius': bannerBorderRadius + "px" });
				if (!bannerCheckbox) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").first().remove();
					// jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'display': 'none' });
				}

				if (bannerAllCheckbox) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'border': bannerBorder, 'border-radius': bannerBorderRadius + "px" });
				} else {
					if (bannerTopCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'border-top': bannerBorder, 'border-radius': bannerBorderRadius + "px" });
					}
					if (bannerRightCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'border-right': bannerBorder, 'border-radius': bannerBorderRadius + "px" });
					}
					if (bannerBottomCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'border-bottom': bannerBorder, 'border-radius': bannerBorderRadius + "px" });
					}
					if (bannerLeftCheckbox) {
						jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'border-left': bannerBorder, 'border-radius': bannerBorderRadius + "px" });
					}
				}

				if (bannerCustomWidth) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'max-width': bannerCustomWidth, 'display': 'block', 'margin-left': 'auto', 'margin-right': 'auto' });
				}

				if (bannerShadow) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} img").css({ 'box-shadow': bannerShadowAllData });
				}

				/**END BANNER COMPONENTS*/

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} label.labelLeadGender").css({ display: '' });

			}
			/** End CSS apply data*/
			
			/** function for used to render callback any changes of html */
			if (typeof renderCallback === "function") {
				renderCallback(); // Call renderCallback if it's a function
			}
		});
	};

	if (window.jQuery) jQueryCode_{{CURRENT_SCRIPT_ID}}();
	else {
		var script = document.createElement('script');
		document.head.appendChild(script);

		script.type = 'text/javascript';
		script.src = "//ajax.googleapis.com/ajax/libs/jquery/3.1.0/jquery.min.js";

		script.onload = jQueryCode_{{CURRENT_SCRIPT_ID}};
	}


	maskDate_{{CURRENT_SCRIPT_ID}} = function (obj, e) {
		charCode = (e.which) ? e.which : e.keyCode;

		elm = jQuery(obj);
		elm = obj;
		var len = elm.value.length;
		if (charCode <= 47 || charCode > 57) {
			if (len === 1) {
				if (e.keyCode == 45 || e.keyCode == 47) {
					elm.value = '0' + elm.value + '-';
				}
			} else if (len == 2) {
				if (e.keyCode == 45 || e.keyCode == 47) {
					elm.value += '-';
				}
			} else if (len == 4) {
				if (e.keyCode == 45 || e.keyCode == 47) {
					elm.value = elm.value.substring(0, 3) + '0' + elm.value.substring(3, len);
					elm.value += '-';
				}
			}
			else if (len == 5) {
				if (e.keyCode == 45 || e.keyCode == 47) {
					elm.value += '-';
				}
			}

			return false;
		}

		if (len >= 9) {
			elm.value = elm.value.substr(0, 9);
		}

		/** If we're at a particular place, let the user type the slash */
		/** i.e., 12/12/1212 */
		if (len !== 1 || len !== 3) {
			if (charCode == 47) {
				e.preventDefault();
			}
		}

		/**If they don't add the slash, do it for them... */
		if (!elm.value.match('-')) {
			if (len === 2) {
				elm.value += '-';
			}
		}

		/**If they don't add the slash, do it for them... */
		if (len === 5) {
			elm.value += '-';
		}
	};
 
	window.setTimeout(function () {
		jQuery(function () {
			jQuery('#mobile_{{CURRENT_SCRIPT_ID}}').on('input', function (e) {
				jQuery(this).attr("maxlength", "14");
				mobileText = jQuery(this);
				var inputValue = mobileText.val();
	
				/** Remove any non-numeric characters*/
				var numericValue = inputValue.replace(PHONE_NON_NUMERIC_CHARACTER, '');

				/** Format the numeric value with dashes*/
				var formattedValue = numericValue.replace(PHONE_NUMERIC_VALUE_WITH_DASH, '$1-$2-$3');
				

				// Update the input value with the formatted value
				mobileText.val(formattedValue);
			});
		});
	}, 5000);


	window.setTimeout(function () {
		jQuery(function () {
			jQuery('#dob_{{CURRENT_SCRIPT_ID}}').on('input', function (e) {
				jQuery(this).attr("maxlength", "10");
				dobText = jQuery(this);
				var inputValue = dobText.val();

				// Remove any non-numeric characters
				var numericValue = inputValue.replace(PHONE_NON_NUMERIC_CHARACTER, '');

				// Format the numeric value with dashes
				var formattedValue = numericValue.replace(PHONE_NUMERIC_VALUE_WITH_DOB_DASH, '$1-$2-$3');
	
				// Update the input value with the formatted value
				dobText.val(formattedValue);
			});
		});
	}, 5000);

	submitFormData_{{CURRENT_SCRIPT_ID}} = function () {

		document.getElementById("fieldSubmitBtn_{{CURRENT_SCRIPT_ID}}").innerHTML = "loading...";

		let requiredFieldsCount = 0;
		onlyRequiredFields_{{CURRENT_SCRIPT_ID}} = [];
		
		jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}} .divFieldContnr input, select, #myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}} .labelLeadGender").removeClass("errorInField");
		for (let x in requiredFieldsIds_{{CURRENT_SCRIPT_ID}}) {
			if (requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x] == 'gender') {
				if (typeof jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .labelLeadGender  input[name="gender"]:checked').val() == 'undefined') {
					jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .labelLeadGender').addClass("errorInField");
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #error_gender").show();
					requiredFieldsCount++;
					onlyRequiredFields_{{CURRENT_SCRIPT_ID}}.push(requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x])
				} else {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #error_gender").hide();
				}
			} else {
				if (jQuery.trim((jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #" + requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x]).val())).length <= 0) {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #" + requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x]).addClass("errorInField");
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #error_" + requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x]).show();
					requiredFieldsCount++;
					onlyRequiredFields_{{CURRENT_SCRIPT_ID}}.push(requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x])

				} else {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #error_" + requiredFieldsIds_{{CURRENT_SCRIPT_ID}}[x]).hide();
				}
			}
		}

		if (requiredFieldsCount > 0) {
			document.getElementById("fieldSubmitBtn_{{CURRENT_SCRIPT_ID}}").innerHTML = buttonName;
			jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} #fieldSubmitBtn_{{CURRENT_SCRIPT_ID}} .waves-ripple').remove();

			jQuery("html,body").animate({ scrollTop: jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #error_" + onlyRequiredFields_{{CURRENT_SCRIPT_ID}}[0]).offset().top - 150 }, "slow");
			return false;
		}

		let gender = document.getElementsByName('gender');
		var genderValue;
		for (var i = 0; i < gender.length; i++) {
			if (gender[i].checked) {
				genderValue = gender[i].value;
			}
		}

		var data = new FormData();
		var elements = document.getElementById("captureLeadForm_{{CURRENT_SCRIPT_ID}}").elements;
		var formData = {};
		for (var i = 0; i < elements.length; i++) {
			var item = elements.item(i);
			formData[item.name] = item.value;
		}

		var fileData = (jQuery('input[name="image_name"]')[0] != undefined) ? jQuery('input[name="image_name"]')[0].files : [""];
		data.append("image_name", fileData[0]);

		formData['third_party_site_url'] = thirdPartySiteUrl_{{CURRENT_SCRIPT_ID}};
		formData['message_box_data'] = messageBoxTitle;
		formData['dropdown_title_data'] = typeDropdownTitle;
		formData['gender'] = (genderValue) ? genderValue : "";
		dateofbirth = (formData['dob']) ? formData['dob'] : "";

		if (dateofbirth != '') {
			let array = new Array();
			array = dateofbirth.split('-');

			let month = array[0];
			let day = array[1];
			let year = array[2];
			let DOB = day + "-" + month + "-" + year;
			formData['dob'] = DOB;
		}


		data.append("other_data", JSON.stringify(formData));
		var request = jQuery.ajax({
			url: jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}}").attr("action"),
			type: "POST",
			data: data,
			dataType: "json",
			jsonpCallback: 'photos',
			cache: false,
			contentType: false,
			processData: false
		});

		request.done(function (msg) {
			document.getElementById("fieldSubmitBtn_{{CURRENT_SCRIPT_ID}}").innerHTML = buttonName;
			jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} #fieldSubmitBtn_{{CURRENT_SCRIPT_ID}} .waves-ripple').remove();

			if (msg.status == 'success') {
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}}").hide();
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} form *").hide();
				jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .form_title').hide();
				jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .display_url_description').hide();
				jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} .thank_you_message_class').show();

				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}} input[type='text'], #myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}} input[type='email'], #myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}} input[type='password'], #captureLeadForm_{{CURRENT_SCRIPT_ID}} select").val("");
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}} input[type='radio']").prop("checked", false);
				jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} #captureLeadForm_{{CURRENT_SCRIPT_ID}}').val('');
				jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} #image_name').val('');
				jQuery("#myWidget_{{CURRENT_SCRIPT_ID}}").addClass("submitted");
				
				/** function for used to render callback any changes of submit */
				if (typeof submitPocialEmbedCallback === "function") {
					submitPocialEmbedCallback(); // Call submitPocialEmbedCallback if it's a function
				}
				
				return false;
			} else {
				jQuery("<div></div>").attr({
					'class': 'statusError'
				}).html(msg.message).appendTo("#myWidget_{{CURRENT_SCRIPT_ID}}");
				window.setTimeout(function () {
					jQuery("#myWidget_{{CURRENT_SCRIPT_ID}} .statusError").slideUp("slow");
				}, 5000);
				return false;
			}
		});

		request.fail(function () {
			document.getElementById("fieldSubmitBtn_{{CURRENT_SCRIPT_ID}}").innerHTML = buttonName;
			jQuery('#myWidget_{{CURRENT_SCRIPT_ID}} #fieldSubmitBtn_{{CURRENT_SCRIPT_ID}} .waves-ripple').remove();
			return false;
		});
		return false;
	};
} pocialScriptedEmbedCodeGenerate_{{CURRENT_SCRIPT_ID}}();

/**Functin for use to front redirect wallet*/
openPocialWalletRedirect_{{CURRENT_SCRIPT_ID}} = () => {
	window.open(frontUrl_{{CURRENT_SCRIPT_ID}} + "my-wallet/new-rewards", "_blank");
}`;



var randomAlphaNum = Math.floor(Math.random() * 1000) + 1;
document.getElementById("myWidget").setAttribute("id","myWidget_"+randomAlphaNum)
var dynamicScript = document.createElement("script");
dynamicScript.type = "text/javascript";
dynamicScript.async = true;
var newScriptText = responseText.replaceAll('{{CURRENT_SCRIPT_ID}}', randomAlphaNum);
newScriptText = newScriptText.replaceAll('PHONE_NON_NUMERIC_CHARACTER', /\D/g);
newScriptText = newScriptText.replaceAll('PHONE_NUMERIC_VALUE_WITH_DASH', /(\d{3})(\d{1,3})(\d{1,4})/);
newScriptText = newScriptText.replaceAll('PHONE_NUMERIC_VALUE_WITH_DOB_DASH', /(\d{2})(\d{1,2})(\d{1,4})/);

dynamicScript.innerHTML = newScriptText;
document.documentElement.appendChild(dynamicScript);