/**This javascript file is used to pick a date range */

/**
 * Date range picker configuration for date
 */
	var OPENS	= "right";
	var options	= {};

	/**Options for date range picker*/
	options.locale = {
		format		: 	DATE_FORMAT,
		cancelLabel	:	"Clear"
	};

	options.startDate		= 	(typeof dateFrom !== typeof undefined && dateFrom!="")	?	new Date(dateFrom) 	: new Date();
	options.endDate			= 	(typeof dateFrom !== typeof undefined && dateFrom!="")	?	new Date(dateFrom) 	: new Date();
	options.opens			= 	OPENS;
	options.autoUpdateInput	= 	false;

	var configDemo = $('#date-range-picker');
	configDemo.daterangepicker(options);

	/**
	* Applying date range filter on user details
	*
	* @param  null
	*
	* @return void
	*/
	configDemo.on('apply.daterangepicker', function(e,picker){
		startDate = picker.startDate.format(START_DATE_FORMAT);
		endDate	  = picker.endDate.format(END_DATE_FORMAT);

		$('#from_date').val(startDate);
		$('#to_date').val(endDate);

		var displayStartDate =	picker.startDate.format(DATE_FORMAT);
		var displayEndDate 	 = 	picker.endDate.format(DATE_FORMAT);
		$('#date-range-picker').val(displayStartDate+" - "+displayEndDate);
		dataTable.draw();
	});

	/**
	* Unset date range picker value when click to "clear" button
	*
	* @param  null
	*
	* @return void
	*/
	configDemo.on('cancel.daterangepicker',function(e){
		configDemo.data('daterangepicker').setStartDate(new Date());
		configDemo.data('daterangepicker').setEndDate(new Date());

		$('#from_date').val("");
		$('#to_date').val("");
		$('#date-range-picker').val("");
		dataTable.draw();
	});
		
