$(function () {
    new Chart(document.getElementById("leads_chart").getContext("2d"), getLeadsChartJs());
});

function getLeadsChartJs() {
    var config 			= 	null;
    var monthsArray 	=   getLeadsPreviousMonths();
   
	$.each(leadsRecords, function(index,html){
		for(var i=0; i < monthsArray.length; i++) {
			if(typeof html[monthsArray[i]['leadsMonthyear']] !== typeof undefined){
				monthsArray[i]['total_leads'] = (html[monthsArray[i]['leadsMonthyear']]['total_leads'])  ? html[monthsArray[i]['leadsMonthyear']]['total_leads'] : 0;
				monthsArray[i]['total_prospective'] = (html[monthsArray[i]['leadsMonthyear']]['total_prospective'])  ? html[monthsArray[i]['leadsMonthyear']]['total_prospective'] : 0;
				monthsArray[i]['total_qualified'] = (html[monthsArray[i]['leadsMonthyear']]['total_qualified'])  ? html[monthsArray[i]['leadsMonthyear']]['total_qualified'] : 0;
				monthsArray[i]['total_prime'] = (html[monthsArray[i]['leadsMonthyear']]['total_prime'])  ? html[monthsArray[i]['leadsMonthyear']]['total_prime'] : 0;
			}
		}
	});

	var months				= [];
	var totalLeads 			= [];
	var totalProspective	= [];
	var totalQualified 		= [];
	var totalPrime 			= [];
	
	for(var i=0; i < monthsArray.length; i++) {
		months.push(monthsArray[i]['name']);
		if(typeof monthsArray[i]['total_leads'] !== typeof undefined){
			totalLeads.push(monthsArray[i]['total_leads']);
		}else{
			totalLeads.push(0);
		}
		if(typeof monthsArray[i]['total_prospective'] !== typeof undefined){
			totalProspective.push(monthsArray[i]['total_prospective']);
		}else{
			totalProspective.push(0);
		}
		if(typeof monthsArray[i]['total_qualified'] !== typeof undefined){
			totalQualified.push(monthsArray[i]['total_qualified']);
		}else{
			totalQualified.push(0);
		}
		if(typeof monthsArray[i]['total_prime'] !== typeof undefined){
			totalPrime.push(monthsArray[i]['total_prime']);
		}else{
			totalPrime.push(0);
		}
	}

	config = {
		type: 'bar',
		data: {
			labels: months.reverse(),
			datasets: [
				{
					label: "All Leads Subscribers",
					data: totalLeads.reverse(),
					backgroundColor: 'rgba(156, 39, 176)'
				},
				{
					label: "Prospective Subscribers",
					data: totalProspective.reverse(),
					backgroundColor: 'rgba(139, 195, 74)'
				},
				{
					label: "Qualified Subscribers",
					data: totalQualified.reverse(),
					backgroundColor: 'rgba(0, 188, 212)'
				},
				{
					label: "Prime Subscribers",
					data: totalPrime.reverse(),
					backgroundColor: 'rgba(255, 152, 0)'
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
					fontColor: 'rgb(156, 39, 176)'
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

function getLeadsPreviousMonths(){
	if(dayWiseFilter){
		var monthList = new Array();
		var monthReverseList = new Array();
		
		fromDate = fromDate.substring(0, 10);
		toDate = toDate.substring(0, 10);
		var start = new Date(fromDate); //yyyy-mm-dd
		var end = new Date(toDate); //yyyy-mm-dd
		
		$("#date-range-picker").val(fromDate+" - "+toDate);
		$("#from_date").val(fromDate);
		$("#to_date").val(toDate);
			
		let j=0;
		while(start <= end){
			 
			var mm = ((start.getMonth()+1)>=10)?(start.getMonth()+1):'0'+(start.getMonth()+1);
			var dd = ((start.getDate())>=10)? (start.getDate()) : '0' + (start.getDate());
			var yyyy = start.getFullYear();
			var date = dd+"-"+mm+"-"+yyyy; //dd-mm-yyyy
			var dateFormatShow = mm+"/"+dd+"/"+yyyy; //mm-dd-yyyy
			
			monthList[j] = {};
			monthList[j]['leadsMonthyear'] = date;
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

		var aMonth 	= today.getMonth();
		var aYear 	= today.getFullYear();

		var i;
		var leadsMonthList = new Array();

		for (i=0; i<12; i++) {
			leadsMonthList[i] =	{};
			leadsMonthList[i]['leadsMonthyear'] =  	theMonths[aMonth]+'-'+aYear;
			leadsMonthList[i]['name'] =	theMonthNames[aMonth]+' '+aYear;
			aMonth--;
			if (aMonth < 0) {
				aMonth = 11;
				aYear--;
			}
		}
		return leadsMonthList;
	}
		
}
