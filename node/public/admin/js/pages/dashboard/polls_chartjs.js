$(function () {
    new Chart(document.getElementById("polls_chart").getContext("2d"), getPollsChartJs());
});

function getPollsChartJs() {
    var config 			= 	null;
    var monthsArray 	=   getPollsPreviousMonths();
	$.each(pollsRecords, function(index,html){
		for(var i=0; i < monthsArray.length; i++) {
			if(typeof html[monthsArray[i]['pollsMonthyear']] !== typeof undefined){
				monthsArray[i]['total_polls'] = (html[monthsArray[i]['pollsMonthyear']]['total_polls'])  ? html[monthsArray[i]['pollsMonthyear']]['total_polls'] : 0;
				monthsArray[i]['published_polls'] = (html[monthsArray[i]['pollsMonthyear']]['published_polls'])  ? html[monthsArray[i]['pollsMonthyear']]['published_polls'] : 0;
				monthsArray[i]['draft_polls'] = (html[monthsArray[i]['pollsMonthyear']]['draft_polls'])  ? html[monthsArray[i]['pollsMonthyear']]['draft_polls'] : 0;
				monthsArray[i]['delete_polls'] = (html[monthsArray[i]['pollsMonthyear']]['delete_polls'])  ? html[monthsArray[i]['pollsMonthyear']]['delete_polls'] : 0;
			}
		}
	});

	var months			= [];
	var totalPolls		= [];
	var publishedPolls	= [];
	var draftPolls 		= [];
	var deletePolls		= [];
	
	for(var i=0; i < monthsArray.length; i++) {
		months.push(monthsArray[i]['name']);
		if(typeof monthsArray[i]['total_polls'] !== typeof undefined){
			totalPolls.push(monthsArray[i]['total_polls']);
		}else{
			totalPolls.push(0);
		}
		if(typeof monthsArray[i]['published_polls'] !== typeof undefined){
			publishedPolls.push(monthsArray[i]['published_polls']);
		}else{
			publishedPolls.push(0);
		}
		if(typeof monthsArray[i]['draft_polls'] !== typeof undefined){
			draftPolls.push(monthsArray[i]['draft_polls']);
		}else{
			draftPolls.push(0);
		}
		if(typeof monthsArray[i]['delete_polls'] !== typeof undefined){
			deletePolls.push(monthsArray[i]['delete_polls']);
		}else{
			deletePolls.push(0);
		}
	}

	config = {
		type: 'bar',
		data: {
			labels: months.reverse(),
			datasets: [
				{
					label: "Total Polls",
					data: totalPolls.reverse(),
					backgroundColor: 'rgba(156, 39, 176)'
				},
				{
					label: "Published Polls",
					data: publishedPolls.reverse(),
					backgroundColor: 'rgba(139, 195, 74)'
				},
				{
					label: "Draft Polls",
					data: draftPolls.reverse(),
					backgroundColor: 'rgba(0, 188, 212)'
				},
				{
					label: "Delete Polls",
					data: deletePolls.reverse(),
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

function getPollsPreviousMonths(){
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
			monthList[j]['pollsMonthyear'] = date;
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
		var pollsMonthList = new Array();

		for (i=0; i<12; i++) {
			pollsMonthList[i] =	{};
			pollsMonthList[i]['pollsMonthyear'] =  	theMonths[aMonth]+'-'+aYear;
			pollsMonthList[i]['name'] =	theMonthNames[aMonth]+' '+aYear;
			aMonth--;
			if (aMonth < 0) {
				aMonth = 11;
				aYear--;
			}
		}
		return pollsMonthList;
	}
		
}
