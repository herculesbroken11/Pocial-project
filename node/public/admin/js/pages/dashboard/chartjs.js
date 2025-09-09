$(function () {
    new Chart(document.getElementById("bar_chart").getContext("2d"), getChartJs());
});

function getChartJs() {
    var config		= 	null;
    var monthsArray	=   getPreviousMonths();
   
	$.each(userRecords, function(index,html){
		for(var i=0; i < monthsArray.length; i++) {
			if(typeof html[monthsArray[i]['month_year']] !== typeof undefined){
				monthsArray[i]['total_users'] = (html[monthsArray[i]['month_year']]['total_users'])  ? html[monthsArray[i]['month_year']]['total_users'] : 0;
				monthsArray[i]['total_basic_users'] = (html[monthsArray[i]['month_year']]['total_basic_users'])  ? html[monthsArray[i]['month_year']]['total_basic_users'] : 0;
				monthsArray[i]['total_verified_users'] = (html[monthsArray[i]['month_year']]['total_verified_users'])  ? html[monthsArray[i]['month_year']]['total_verified_users'] : 0;
				monthsArray[i]['total_business_users'] = (html[monthsArray[i]['month_year']]['total_business_users'])  ? html[monthsArray[i]['month_year']]['total_business_users'] : 0;
				
				monthsArray[i]['total_suspended'] = (html[monthsArray[i]['month_year']]['total_suspended'])  ? html[monthsArray[i]['month_year']]['total_suspended'] : 0;
				monthsArray[i]['total_unsuspended'] = (html[monthsArray[i]['month_year']]['total_unsuspended'])  ? html[monthsArray[i]['month_year']]['total_unsuspended'] : 0;
				monthsArray[i]['email_verify_users'] = (html[monthsArray[i]['month_year']]['email_verify_users'])  ? html[monthsArray[i]['month_year']]['email_verify_users'] : 0;
				monthsArray[i]['email_not_verify_users'] = (html[monthsArray[i]['month_year']]['email_not_verify_users'])  ? html[monthsArray[i]['month_year']]['email_not_verify_users'] : 0;
			}
		}
	});

	var months				= [];
	var totalUsers 			= [];
	var totalBasicUsers		= [];
	var totalVerifiedUsers	= [];
	var totalBusinessUsers	= [];
	
	var totalSuspendedUsers		= [];
	var totalUnsuspendedUsers	= [];
	var emailVerifyUsers		= [];
	var emailNotVerifyUsers		= [];
	
	for(var i=0; i < monthsArray.length; i++) {
		months.push(monthsArray[i]['name']);
		if(typeof monthsArray[i]['total_users'] !== typeof undefined){
			totalUsers.push(monthsArray[i]['total_users']);
		}else{
			totalUsers.push(0);
		}
		if(typeof monthsArray[i]['total_basic_users'] !== typeof undefined){
			totalBasicUsers.push(monthsArray[i]['total_basic_users']);
		}else{
			totalBasicUsers.push(0);
		}
		if(typeof monthsArray[i]['total_verified_users'] !== typeof undefined){
			totalVerifiedUsers.push(monthsArray[i]['total_verified_users']);
		}else{
			totalVerifiedUsers.push(0);
		}
		if(typeof monthsArray[i]['total_business_users'] !== typeof undefined){
			totalBusinessUsers.push(monthsArray[i]['total_business_users']);
		}else{
			totalBusinessUsers.push(0);
		}
		
		if(typeof monthsArray[i]['total_suspended'] !== typeof undefined){
			totalSuspendedUsers.push(monthsArray[i]['total_suspended']);
		}else{
			totalSuspendedUsers.push(0);
		}
		if(typeof monthsArray[i]['total_unsuspended'] !== typeof undefined){
			totalUnsuspendedUsers.push(monthsArray[i]['total_unsuspended']);
		}else{
			totalUnsuspendedUsers.push(0);
		}
		if(typeof monthsArray[i]['email_verify_users'] !== typeof undefined){
			emailVerifyUsers.push(monthsArray[i]['email_verify_users']);
		}else{
			emailVerifyUsers.push(0);
		}
		if(typeof monthsArray[i]['email_not_verify_users'] !== typeof undefined){
			emailNotVerifyUsers.push(monthsArray[i]['email_not_verify_users']);
		}else{
			emailNotVerifyUsers.push(0);
		}
	}

	config = {
		type: 'bar',
		data: {
			labels: months.reverse(),
			datasets: [
				{
					label: "All Users",
					data: totalUsers.reverse(),
					backgroundColor: 'rgba(76, 175, 80)'
				},
				{
					label: "Basic Users",
					data: totalBasicUsers.reverse(),
					backgroundColor: 'rgba(233, 30, 99)'
				},
				{
					label: "Verified Users",
					data: totalVerifiedUsers.reverse(),
					backgroundColor: 'rgba(0, 188, 212)'
				},
				{
					label: "Business Users",
					data: totalBusinessUsers.reverse(),
					backgroundColor: 'rgba(156, 39, 176)'
				},
				
				{
					label: "Suspended Users",
					data: totalSuspendedUsers.reverse(),
					backgroundColor: '#9e9e9e'
				},
				{
					label: "Un-Suspended Users",
					data: totalUnsuspendedUsers.reverse(),
					backgroundColor: '#ff9800'
				},
				{
					label: "Email Verify Users",
					data: emailVerifyUsers.reverse(),
					backgroundColor: '#03a9f4'
				},
				{
					label: "Email Not Verify Users",
					data: emailNotVerifyUsers.reverse(),
					backgroundColor: '#8bc34a'
				},
			]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			legend: {
				display		:	true,
				fullWidth	: 	true,
				position 	:	"top",
				labels		: 	{
					fontColor: 'rgb(76, 175, 80)'
				}
			},
			scales: {
				yAxes: [{
					ticks: {
						beginAtZero: true,
						userCallback: function(label, index, labels) {
							if (Math.floor(label) === label) {
								return label;
							}
						},
					}
				}],
			}
		},

	};
    return config;
}

function getPreviousMonths(){
	if(dayWiseFilter){
		var monthList = new Array();
		var monthReverseList = new Array();

		fromDate = fromDate.substring(0, 10);
		toDate = toDate.substring(0, 10);
		var start = new Date(fromDate); //yyyy-mm-dd
		var end = new Date(toDate); //yyyy-mm-dd

		let j=0;
		while(start <= end){
			 
			var mm = ((start.getMonth()+1)>=10)?(start.getMonth()+1):'0'+(start.getMonth()+1);
			var dd = ((start.getDate())>=10)? (start.getDate()) : '0' + (start.getDate());
			var yyyy = start.getFullYear();
			var date = dd+"-"+mm+"-"+yyyy; //dd-mm-yyyy
			var dateFormatShow = mm+"/"+dd+"/"+yyyy; //mm-dd-yyyy
			 
			monthList[j] = {};
			monthList[j]['month_year'] = date;
			monthList[j]['name'] = dateFormatShow;
			
			j++;
			start = new Date(start.setDate(start.getDate() + 1)); //date increase by 1
		}
		let daylength = monthList.length;
		for(let m = daylength-1; m >= 0; m--){
			monthReverseList.push(monthList[m]);
		}
		 
		return monthReverseList;
		// return monthList;
	}else{
		var theMonths = new Array("01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12");
		var theMonthNames = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
		var today = new Date();

		var aMonth	= today.getMonth();
		var aYear	= today.getFullYear();

		var i;
		var monthList = new Array();

		for (i=0; i<12; i++) {
			monthList[i] = {};
			monthList[i]['month_year'] = theMonths[aMonth]+'-'+aYear;
			monthList[i]['name'] = theMonthNames[aMonth]+' '+aYear;
			aMonth--;
			if (aMonth < 0) {
				aMonth = 11;
				aYear--;
			}
		}
		return monthList;
	}
}
