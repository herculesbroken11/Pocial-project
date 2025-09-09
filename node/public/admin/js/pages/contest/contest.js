/**This javascript file is used in add and edit forms of contest */

/**
 * Date range picker configuration for contest date
 */
var startDate		= (contestStartDate && new Date(contestStartDate) >= new Date())	? new Date(contestStartDate)	: new Date();

var options					= {};
options.locale				= {format: DATE_FORMAT};
options.startDate 			= startDate;
options.singleDatePicker 	= true,
options.showDropdowns 		= true,
options.minYear 			= parseInt(moment().format('YYYY')),
options.maxYear 			= parseInt(moment().format('YYYY'),10),
options.minDate 			= new Date();
options.opens 				= "right";
options.drops 				= "down";
options.autoUpdateInput 	= false;


/**Initialize  daterange picker*/
var contestDatePicker = $('#contest_date');
contestDatePicker.daterangepicker(options);

/**
 * Applying date range picker to set start date and end date
 */
contestDatePicker.on('apply.daterangepicker', function(e, picker) {
	var startDate = picker.startDate.format(START_DATE_FORMAT);
	$('#start_date').val(startDate);
	var displayStartDate = picker.startDate.format(DATE_FORMAT);
	$('#contest_date').val(displayStartDate);
});


/** open datepicker*/
$(document).on("click", ".date-range-icon", function() {
	$(this).parent().parent().find("input.daterange-input").trigger("click");
});

/**
 * Function to check value is numeric value
 */
function isNotNumeric(value){
	if (!$.isNumeric(value)){
		return true;
	}
	return false;
}//End isKeyNotAllowed()

/**Check winner prize validation */
function validateWinningBreakUp(){
	var errorFlag 		= false;
	var errorMessage	= "";

	/*Check all fields has values*/
	$('#winningBreakupDataDiv .prize_amount').each(function(){
		if($(this).val() == ''){
			errorFlag 		= true;
			errorMessage	= enterAllAmountMsg;
		}
		if(isNaN($(this).val())){
			$(this).val('');
		}
	});
	if(!errorFlag){
		/** Check all user is selected*/
		var secondSelectBoxLength	= $("#winningBreakupDataDiv .higher-value-select").length;
		if(secondSelectBoxLength > 0){
			var lastSelectedWinner	= $("#winningBreakupDataDiv .row:last-child .higher-value-select").val();
		}else{
			var lastSelectedWinner	= $("#winningBreakupDataDiv .simple-select").length;
		}

		var totalWinner			= $('#total_winner').val();
		if(lastSelectedWinner < totalWinner){
			errorFlag			= true;
			errorMessage		= selectAllWinnerMsg;
		}
	}

	if(!errorFlag){
		/** Check Total amount is used or not*/
		var totalAmount		= $('#total_amount').val();
		var totalWinPrize 	= 0;
		$('#winningBreakupDataDiv .prize_amount').each(function() {
			var prize = $(this).attr("data-pize-amount");
			if(!isNaN(prize) && prize != ''){
				totalWinPrize	+= parseFloat(prize);
			}
			if(isNaN(prize)){
				$(this).attr({"value":0,"data-pize-amount":0});
			}
		});
		var winnerLength = $('#winningBreakupDataDiv .prize_amount').length;
		if(Math.ceil(totalWinPrize) < totalAmount &&winnerLength >0 ){
			errorFlag		= true;
			errorMessage	= useAllAmountMsg+" "+totalAmount+'.';
		}
	}
	return {error:errorFlag,message:errorMessage};
}//End validateWinningBreakUp();

var spinnerChangeBlocked = false; // to Add change event on spinner
$(document).ready(function(){
	var competitionId = $("#competition_id").val();
	// if(contestFixtureId !="" && competitionId !=""){
	if(competitionId !=""){
		getFixtures(); //get fixtures
	}

	/**To display date selected*/
	if(contestStartDate != ""){
		$(document).find("input.daterange-input").trigger("click");
		$(".applyBtn").click();
	}

	if($("#contest_type").val() == CONTEST_TYPE_PRACTICE){
		$(".amount-field").hide();
	}
	if($("#contest_type").val() == CONTEST_TYPE_UNLIMITED_TEAMS){
		$("#is_multiple_entries_allowed").prop('checked',true);
		$("#is_multiple_entries_allowed").closest(".simple-checkbox").addClass("checkbox-readonly");
		$("#is_multiple_entries_allowed").closest(".form-group").addClass("cursor-not-allowed");
	}

	/***
	 * To create winner breakdown using contest prizes
	 */
	if(contestPrizesArray && contestPrizesArray.length > 0){
		spinnerChangeBlocked = true;
		var rowIndex	= 1;
		$('#buffer_value').text(currencyFormat(contestTotalAmount));
		contestPrizesArray.map(function(winnerRow){
			var contestStartRank	= (winnerRow.start_rank)	? winnerRow.start_rank	: 0;
			var contestEndRank		= (winnerRow.end_rank)		? winnerRow.end_rank	: 0;
			var contestAmount		= (winnerRow.amount)		? winnerRow.amount		: 0;
			if(contestStartRank <= CONTEST_DEFAULT_WINNERS){
				appendHtml({type:'singleSelectBoxRow'});
			}else{
				appendHtml({type:'multiSelectBoxRow',start:contestStartRank,end:contestEndRank});
			}
			$("#winner_prize_amount"+rowIndex).val(contestAmount);
			$("#winner_prize_amount"+rowIndex).trigger("keyup");
			$("#rankTo"+rowIndex).addClass("action_performed");
			$("#rankTo"+rowIndex).attr("data-value",contestEndRank);
			$("#rankTo"+rowIndex).attr("data-max",contestTotalWinner);
			rowIndex++;
		});
		$("#winningBreakupDataDiv .add-more-btn").remove();
		$("#winning-breakup-main-div").removeClass("hide");

		$("#winningBreakupDataDiv .spinner").spinner('changed', function(e, newVal, oldVal) {
			var inputId = "#"+e.target.id;
			$(inputId).attr("value",newVal);
			winnerChangeAction(inputId);
		});
		spinnerChangeBlocked =false;
	}

	/**
	 * Function to submit form
	 */
	$(".btn-submit").click(function(){
		var btnId = $(this).attr("id");

		var validationError = validateWinningBreakUp();
		/**Submit form if no error found*/
		if(!validationError.error){
			startTextLoading(btnId);
			ajax_submit(contestFormId,function(status,response){
				if(status){
					window.location.href = response.redirect_url;
				}else{
					stopTextLoading(btnId);
				}
			});
			$("#winningPopulation_error").html('');
		}else{
			$("#winningPopulation_error").html(validationError.message);
			return false;
		}
	});

	/**Set Values as Data-old value */
	var totalSpots	= $('#total_spots').val();
	$('#total_spots').attr("data-old-value",totalSpots);
	var totalAmount = $('#total_amount').val();
	$('#total_amount').attr("data-old-value",totalAmount);
	var winnerPercentage = $('#winning_population').val();
	$('#winning_population').attr("data-old-value",winnerPercentage);
});

/**
 * Function to get fixtures of competitions on change
 */
$("#competition_id").change(function(){
	$("#fixture_key").val("");
	$("#fixture_name").val("");
	getFixtures();
});

/**
 * Function to get fixtures of competitions
 */
function getFixtures(){
	$(".fixture-select-box").hide();
	$("#fixture_loader").removeClass("hide"); //show loader
	$("#fixture_id").html('<option value="">'+selectFixtureOption+'</option>');
	$("#fixture_id").selectpicker('refresh');
	var competitionId	= $("#competition_id").val();
	var competitionKey 	= $("#competition_id").children("option:selected").attr("data-key");
	$("#competition_key").val(competitionKey);
	if(competitionId != ""){
		$.ajax({
			'type'	: 'POST',
			'url'	: ADMIN_LIST_URL+"/get_fixtures",
			'data'	: { 'competition_id': competitionId},
			'success': function (response){
				var fixtures = (typeof response.result !== typeof undefined && response.result) ? response.result :[];
				if(fixtures.length > 0){
					fixtures.map(function(fixture){
						/**create select box */
						var selectedString = (fixture._id == contestFixtureId) ? "selected" : "";
						$("#fixture_id").append('<option data-key="'+fixture.key+'" data-start-date="'+fixture.start_date+'" value="'+fixture._id+'" '+selectedString+'>'+fixture.name+' - '+fixture.related_name+'</option>');
					});
				}
				$("#fixture_id").selectpicker('refresh');
				$("#fixture_loader").addClass("hide"); //hide loader
				$(".fixture-select-box").show();

				/**To reset values */
				setTimeout(() => {
					var currentFixtureId = $("#fixture_id").children("option:selected").attr("value");;
					if(!contestFixtureId || contestFixtureId == "" || !currentFixtureId){
						$("#fixture_key").val("");
						$("#fixture_name").val("");
					}
				}, 100);
			}
		});
	}
}//End getFixtures()

/**
 * Function to set fixture key in hidden field
 */
$("#fixture_id").change(function(){
	var fixtureKey 		= $(this).children("option:selected").attr("data-key");
	if(fixtureKey){
		var fixtureName	= $(this).children("option:selected").text();
	}
	$("#fixture_key").val(fixtureKey);
	$("#fixture_name").val(fixtureName);
});


/**
 * Function to hide field
 */
$("#contest_type").change(function(){
	$("#is_multiple_entries_allowed").prop('checked',false);
	$("#is_multiple_entries_allowed").closest(".simple-checkbox").removeClass("checkbox-readonly");
	$("#is_multiple_entries_allowed").closest(".form-group").removeClass("cursor-not-allowed");

	if($(this).val() == CONTEST_TYPE_PRACTICE){
		$(".amount-field").hide();
		$(".amount-field input").val("");
		$("#winningBreakupDataDiv").html("");
		$("#winning-breakup-main-div").addClass("hide");
		askConfirmation = false;
	}else if($(this).val() == CONTEST_TYPE_UNLIMITED_TEAMS){
		$("#is_multiple_entries_allowed").prop('checked',true);
		$("#is_multiple_entries_allowed").closest(".simple-checkbox").addClass("checkbox-readonly");
		$("#is_multiple_entries_allowed").closest(".form-group").addClass("cursor-not-allowed");
		$(".amount-field").show();
	}else if($(this).val() == CONTEST_TYPE_COUPON){
		$("#entry_amount").val(0);
		$(".amount-field").show();
	}else{
		$(".amount-field").show();
	}
});

/**Validate input */
$('#winning_population').keyup(function(e){
	$('#winning_population_error').text('');
	var input = parseFloat($("#winning_population").val());
	if(input < 1 || input > 100){
		$('#winning_population_error').text(percentValueMsg)
		return false;
	}
	if (isNotNumeric(input)){
		$("#winning_population").val('');
		$('#total_winner').val(0);
	}
});

/**
 * Function to perform keyup on winner percentage text box
 */
$('#winning_population').focusout(function(e){
	var lastValue 			= $("#winning_population").attr("data-old-value");
	var newValue			= $('#winning_population').val();
	var showConfirmation	= askConfirmation;
	if(askConfirmation && lastValue == newValue){
		showConfirmation = false;
	}
	confirmWinnerChange(showConfirmation,function(changeAllowed){
		if(changeAllowed && showConfirmation){
			askConfirmation = false;
		}else if(askConfirmation){
			$("#winning_population").val(lastValue);
			return false;
		}

		$('#winning_population_error').text('');
		var input = parseFloat($("#winning_population").val());
		if(input < 1 || input > 100){
			$('#winning_population_error').text(percentValueMsg)
			return false;
		}

		$("#winningBreakupDataDiv").html("");
		$("#winning-breakup-main-div").addClass("hide");
		var totalSize	= $('#total_spots').val();
		if (isNotNumeric(input)){
			$("#winning_population").val('');
			$('#total_winner').val(0);
		}
		var winnerPercentage	= $('#winning_population').val();
		$('#winning_population').attr("data-old-value",winnerPercentage);
		calculate_total_winner(totalSize,winnerPercentage);
	});
});


/**Validate input */
$('#total_spots').keyup(function(e){
	$('#total_spots_error').text('');
	if (!INT_REGEXP.test($('#total_spots').val())) {
		$('#total_spots').val('');
	}

	/** min spots validation */
	if (INT_REGEXP.test($('#total_spots').val())) {
		var totalSpots = $('#total_spots').val();
		if(Number(totalSpots) < MIN_SPOTS_TO_CREATE_A_CONTEST){
			$('#total_spots_error').text(minSpotsMsg);
			return false;
		}
	}
});

/**
 * function to calculate data
 */
$('#total_spots').focusout(function(e){

	var lastValue 			= $("#total_spots").attr("data-old-value");
	var newValue			= $('#total_spots').val();
	var showConfirmation	= askConfirmation;
	if(askConfirmation && lastValue == newValue){
		showConfirmation = false;
	}

	confirmWinnerChange(showConfirmation,function(changeAllowed){
		if(changeAllowed && showConfirmation){
			askConfirmation = false;
		}else if(askConfirmation){
			var lastValue = $("#total_spots").attr("data-old-value");
			$("#total_spots").val(lastValue);
			return false;
		}

		if (!INT_REGEXP.test($('#total_spots').val())) {
			$('#total_spots').val('');
		}else{
			/* Calculate Total Winner */
			$("#winningBreakupDataDiv").html("");
			var totalSpots			= $('#total_spots').val();
			var winnerPercentage	= $('#winning_population').val();
			$('#total_spots').attr("data-old-value",totalSpots);
			calculate_total_winner(totalSpots,winnerPercentage);

			/* Calculate Total Commision */
			var totalAmount				= $('#total_amount').val();
			var commissionPercentage	= $('#commission_percentage').val();
			calculate_total_commision(totalAmount,commissionPercentage);
		}
	});
});

/**Validate input */
$('#total_amount').keyup(function(e){
	if (!INT_REGEXP.test($('#total_amount').val())) {
		$('#total_amount').val('');
	}
});

/**
 * Function to calculate Total Winners and commision on change amount
 */
$('#total_amount').focusout(function(e){
	var lastValue 			= $("#total_amount").attr("data-old-value");
	var newValue			= $('#total_amount').val();
	var showConfirmation	= askConfirmation;
	if(askConfirmation && lastValue == newValue){
		showConfirmation = false;
	}
	confirmWinnerChange(showConfirmation,function(changeAllowed){
		if(changeAllowed && showConfirmation){
			askConfirmation = false;
		}else if(askConfirmation){
			var lastValue = $("#total_amount").attr("data-old-value");
			$("#total_amount").val(lastValue);
			return false;
		}

		if (!INT_REGEXP.test($('#total_amount').val())) {
			$('#total_amount').val('');
		}

		/* Calculate Total Commision */
		var totalAmount				= $('#total_amount').val();
		var commissionPercentage	= $('#commission_percentage').val();
		$('#total_amount').attr("data-old-value",totalAmount);
		calculate_total_commision(totalAmount,commissionPercentage);

		/* Calculate Total Winner */
		$("#winningBreakupDataDiv").html("");
		var totalSpots			= $('#total_spots').val();
		var winnerPercentage	= $('#winning_population').val();
		calculate_total_winner(totalSpots,winnerPercentage);
	});
});

/**
 * Function to calculate Total Winners
 */
function calculate_total_winner(totalSize,winnerPercentage){
	if(totalSize != '' && winnerPercentage != ''){
		var totalWinner	= (totalSize *	winnerPercentage/100);
		totalWinner		= Math.round(totalWinner);
		$('#total_winner').val(totalWinner);
		var totalAmount	=	$('#total_amount').val();
		if(totalAmount	!= ''){
			for(var i=1;i<=totalWinner;i++){
				if(i > CONTEST_DEFAULT_WINNERS) {
					appendHtml({type:'multiSelectBoxRow',start:CONTEST_DEFAULT_WINNERS+1,end:totalWinner});
					break;
				}
				appendHtml({type:'singleSelectBoxRow'});
			}
			$("#winning-breakup-main-div").removeClass("hide");
			$('#buffer_value').text(currencyFormat(totalAmount));
		}
	}else{
		$('#total_winner').val(0);
	}
}

/**
 * Function to perform keyup on commision text box
 */
$('#commission_percentage').keyup(function(e){
	$('#commission_percentage_error').text("");
	var input = parseFloat(this.value);
	if(input <= 0 || input > 100){
		$('#commission_percentage_error').text(percentValueMsg);
		return false;
	}
	var totalAmount = $('#total_amount').val();
	if (isNotNumeric(input)) {
		$(this).val('');
		$('#commission_amount').val(0);
		$('#entry_amount').val(0);
		$("#winning_population").val('');
	}
	var commissionPercentage	= $('#commission_percentage').val();
	calculate_total_commision(totalAmount,commissionPercentage);
});

/**
 * Function to calculate Total Commision
 */
function calculate_total_commision(totalAmount,commissionPercentage){
	if(totalAmount != '' && commissionPercentage != ''){
		var totalSpots		= $('#total_spots').val();
		var commisionAmount	= (totalAmount	* commissionPercentage/100);
		var finalAmount		= (parseInt(totalAmount)+ parseFloat(commisionAmount));
		var entryAmount		= (totalSpots > 0) ? finalAmount/totalSpots : "";
		if($("#contest_type").val() == CONTEST_TYPE_COUPON){
			entryAmount = 0;
		}
		$('#commission_amount').val(customRound(commisionAmount,2));
		$('#entry_amount').val(customRound(entryAmount,2));
	}else{
		$('#commission_amount').val(0);
		$('#entry_amount').val(0);
	}
}

/**
 * Function to add More
 */
$(document).on("click","#winningBreakupDataDiv #addMoreWinnerBtn",function(){
	var selectBoxId 	= $(this).attr('data-select-id');
	var startValue		= parseInt($("#"+selectBoxId).val())+1;
	var totalWinners	= parseInt($('#total_winner').val());
	$(this).remove();
	if(startValue <= totalWinners){
		appendHtml({type:'multiSelectBoxRow',start:startValue,end:totalWinners});
		$("#"+selectBoxId).addClass("action_performed");
		if(startValue == totalWinners){
			setTimeout(function(){
				$("#winningBreakupDataDiv #addMoreWinnerBtn").remove();
			},1);
		}
	}
});

/**
 * Function to add new row
 */
$(document).on("change","#winningBreakupDataDiv .row:last-child .higher-value-select",function(e){
	var spinnerId = $(this).attr("id");
	winnerChangeAction(spinnerId);
});

/**
 * Function confirm before change value
 */
$(document).on("change","#winningBreakupDataDiv .row .action_performed",function(e){
	var spinnerId = $(this).attr("id");
	winnerChangeAction(spinnerId);
});

/**
 * Function to add new winner row and confirm before create row
 */
function winnerChangeAction(spinnerId){
	if(!$(spinnerId).hasClass("action_performed") && $(spinnerId).closest("#winningBreakupDataDiv div.row").is(":last-child")){
		// append row without confirmation
		var currentValue = parseInt($(spinnerId).val());
		$(spinnerId).attr("data-value",currentValue);
		var lastvalue	= parseInt($('#total_winner').val());
		if(currentValue < lastvalue){
			$("#winningBreakupDataDiv #addMoreWinnerBtn").click();
		}
	}else if($(spinnerId).hasClass("action_performed")){
		// show confirm box before change value
		swal({
			title: confirmHeading,
			text: confirmMessage,
			type: 'warning',
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Ok",
			closeOnConfirm: false,
			showLoaderOnConfirm: true,
		}, function (result) {
			if(result){
				$(spinnerId).parents('.winning-user-row').nextAll('div').remove(); //remove next rows
				var rowNumber = $(spinnerId).attr("data-row-number");
				var selectedValue	= parseInt($(spinnerId).val());
				var lastvalue		= parseInt($('#total_winner').val());
				$(spinnerId).attr("data-value",selectedValue); //change data value
				if(selectedValue !=lastvalue){
					// append row
					appendHtml({type:'multiSelectBoxRow',start:selectedValue+1,end:lastvalue}); //append row
				}else{
					// add button
					$("#btnDiv"+rowNumber).html('<button id="addMoreWinnerBtn" data-select-id="rankTo'+rowNumber+'" class="btn btn-primary hide">Add More</button>');
				}
			}else{
				/**Reset value*/
				var dataValue	= $(spinnerId).attr('data-value');
				$(spinnerId).val(dataValue);
			}
			swal.close();
			setTimeout(() => {
				$("#winner_prize_amount"+rowNumber).trigger("keyup");
			},1);
		});
	}
}

/**
 * Function to perform keyup on prize amount text box
 */
$(document).on('keyup', '.prize_amount', function(e){
	$("#winningPopulation_error").html('');
	if (isNotNumeric($(this).val())) {
		$(this).val('');
	}
	var multiplier	= 1;
	var totalAmount	= $('#total_amount').val();
	var rowNumber	= $(this).attr('id').replace('winner_prize_amount','');
	var prizeValue	= $(this).val();
	if(rowNumber > CONTEST_DEFAULT_WINNERS){
		var startRank  	= $("#rank"+rowNumber).val();
		var endRank  	= $("#rankTo"+rowNumber).val();
		multiplier		= (endRank - startRank)+1;
	}

	var prizeAmount 		= prizeValue*multiplier;
	var prizeValueText		= (prizeValue && !isNaN(prizeValue)) ? prizeValue : 0;
	var totalAmountString	= "<i>Total Prize: "+currencyFormat(prizeValueText)+" x "+currencyFormat(multiplier)+" = "+CURRENCY_SYMBOL+currencyFormat(customRound(prizeAmount,2))+"</i>";
	$('#winner_prize_total'+rowNumber).html(totalAmountString);
	$('#winner_prize_amount'+rowNumber).attr("data-pize-amount",prizeAmount);
	$('#buffer_value').text(currencyFormat(totalAmount));

	var totalWinPrize = 0;
	$('.prize_amount').each(function() {
		var prize = $(this).attr("data-pize-amount");
		if(!isNaN(prize) && prize != ''){
			totalWinPrize	+= parseFloat(prize);
		}
		if(isNaN(prize)){
			$(this).attr({"data-pize-amount":0});
		}
	});

	//show error msg and disable submit button
	if(Math.ceil(totalWinPrize) > totalAmount){
		$('#contest-add-btn-id').prop('disabled', true);
		$("#winningPopulation_error").html(limitExceedMsg);
		$('#buffer_value').text('0');
	}else{
		$("#winningPopulation_error").html('');
		$('#contest-add-btn-id').prop('disabled', false);
		var totalWinnerPrize	= customRound((totalAmount-totalWinPrize),2);
		if(totalWinnerPrize >= 0){
			$('#buffer_value').text(currencyFormat(totalWinnerPrize));
		}else{
			$('#buffer_value').text('0');
		}
	}
});

/**
 * Function to append winner prize rows
 */
function appendHtml(data){
	var index		= $("#winningBreakupDataDiv .winning-user-row").length;
	var rowIndex	= index+1;
	if(data.type == 'singleSelectBoxRow'){
		if(rowIndex <= CONTEST_DEFAULT_WINNERS){
			/**Append single select box row*/
			var html	= $("#singleSelectBoxRow").html();
			html = html.replace(/{index}/g,rowIndex).replace(/{option_value}/g,rowIndex).replace(/{array_index}/g,index);
			/** Appened html **/
			$("#winningBreakupDataDiv").append(html);
		}
	}else{
		/**Append multi select box row*/
		var html = $("#multiSelectBoxRow").html();
		html = html.replace(/{index}/g,rowIndex).replace(/{array_index}/g,index);
		var startPoint	= (data.start)	? data.start	: "";
		var endPoint	= (data.end) 	? data.end		: "";

		/**Create options for second select box*/
		html = html.replace(/{first_option_html}/g,startPoint).replace(/{second_option_html}/g,endPoint).replace(/{min_value}/g,startPoint).replace(/{max_value}/g,endPoint);
		/** Appened html **/
		$("#winningBreakupDataDiv").append(html);
	}

	$("#winningBreakupDataDiv .prize_amount").trigger("keyup");
	if(!spinnerChangeBlocked){ //Not apply at edit/copy mode
		$("#winningBreakupDataDiv .spinner").spinner('changed', function(e, newVal, oldVal) {
			var inputId = "#"+e.target.id;
			$(inputId).attr("value",newVal);
			winnerChangeAction(inputId);
		});
	}
}// end appendHtml()

/**Set Variable to check confirmation */
var askConfirmation = false;
$(document).on("keyup","#winningBreakupDataDiv .prize_amount",function(){
	$("#winningBreakupDataDiv .prize_amount").each(function() {
		if($(this).val() != ""){
			askConfirmation = true;
		}
	});
});

/**
 * Function to confirm before change in any field
 */
function confirmWinnerChange(askConfirmation,callback){
	if(askConfirmation){
		swal({
			title: confirmHeading,
			text: "You want to change this value. If you change this, Winning breakup will be reset.",
			type: 'warning',
			showCancelButton: true,
			confirmButtonColor: "#DD6B55",
			confirmButtonText: "Ok",
			closeOnConfirm: false,
			showLoaderOnConfirm: true,
		}, function (result) {
			swal.close();
			if(result){
				callback(true);
			}else{
				callback(false);
			}
		});
	}else{
		callback(true);
	}
}
