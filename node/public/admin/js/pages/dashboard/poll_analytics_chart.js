$(function () {
	new Chart(document.getElementById("poll_analytics_chart").getContext("2d"), getPollAnalyticsChartJs());	
});

function getPollAnalyticsChartJs() {

	var pollViewLogs = pollViewGraph;
	var months = [];
	var totalMobileView = [];
	var totalDesktopView = [];
	var totalEmbedDesktopView = [];
	var totalEmbedMobileView = [];
	var pollViewLength = pollViewLogs.length;
	

	for (var i = 0; i < pollViewLength; i++) {
		// if (pollViewLength <= 7 && pollViewLogs[i]['week_name'] != undefined) {
		// 	months.push(pollViewLogs[i]['week_name']);
		// } else {
			months.push(pollViewLogs[i]['month_year']);
		//}
		
		if (typeof pollViewLogs[i]['desktop_views'] !== typeof undefined) {
			totalDesktopView.push(pollViewLogs[i]['desktop_views']);
		} else {
			totalDesktopView.push(0);
		}
		if (typeof pollViewLogs[i]['mobile_views'] !== typeof undefined) {
			totalMobileView.push(pollViewLogs[i]['mobile_views']);
		} else {
			totalMobileView.push(0);
		}
		if (typeof pollViewLogs[i]['embed_desktop_views'] !== typeof undefined) {
			totalEmbedDesktopView.push(pollViewLogs[i]['embed_desktop_views']);
		} else {
			totalEmbedDesktopView.push(0);
		}
		if (typeof pollViewLogs[i]['embed_mobile_views'] !== typeof undefined) {
			totalEmbedMobileView.push(pollViewLogs[i]['embed_mobile_views']);
		} else {
			totalEmbedMobileView.push(0);
		}
	}

	var pollViewType = pollView;

	if (pollViewType.mobile == true) {
		totalDesktopView = [];
		totalEmbedMobileView = [];
		totalEmbedDesktopView = [];

	} else if (pollViewType.desktop == true) {
		totalMobileView = [];
		totalEmbedMobileView = [];
		totalEmbedDesktopView = [];

	} else if (pollViewType.embed_mobile == true) {
		totalMobileView = [];
		totalDesktopView = [];
		totalEmbedDesktopView = [];

	} else if (pollViewType.embed_desktop == true) {
		totalMobileView = [];
		totalDesktopView = [];
		totalEmbedMobileView = [];
	}

	var config = null;

	config = {
		type: 'line',
		data: {
			labels: months,
			datasets: [{
					label: "Desktop Views",
					data: totalDesktopView,
					borderColor: 'rgb(73, 135, 160)',
					fill: false
				},
				{
					label: "Mobile Views",
					data: totalMobileView,
					borderColor: 'rgb(189, 189, 189)',
					fill: false

				},
				{
					label: "Embed Desktop Views",
					data: totalEmbedDesktopView,
					borderColor: 'rgb(217, 80, 64)',
					fill: false
				},
				{
					label: "Embed Mobile Views",
					data: totalEmbedMobileView,
					borderColor: 'rgb(93, 93, 93)',
					fill: false
				},
			]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			legend: {
				display: false
			},
			scales: {
				yAxes: [{
				  ticks: {
					beginAtZero: true,
					// stepSize: 1,
				  }
				}]
			}
		},

	};
	return config;

}

/**function for pollOptIn rate percentage */

function getPollOptInRateChartJs() {

	var optInPercentage = pollViewOptInGraph;

	var months = [];
	var totalOptInPercantage = [];
	var optInLength = optInPercentage.length;

	/**for opt in rate percentage */
	for (var i = 0; i < optInLength; i++) {

		if (optInLength <= 7 && optInPercentage[i]['week_name'] != undefined) {
			months.push(optInPercentage[i]['week_name']);
		} else {
			months.push(optInPercentage[i]['month_year']);
		}

		if (typeof optInPercentage[i]['optin_rate_percentage'] !== typeof undefined) {
			totalOptInPercantage.push(optInPercentage[i]['optin_rate_percentage']);
		} else {
			totalOptInPercantage.push(0);
		}
	}


	var config = null;

	config = {
		type: 'line',
		data: {
			labels: months,
			datasets: [{
					label: "Opt In Rate Percentage",
					data: totalOptInPercantage,
					borderColor: 'rgb(89, 158, 146)',
					fill: false
				},

			]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			legend: {
				display: false
			},
			scales: {
				yAxes: [{
				  ticks: {
					beginAtZero: true
				  }
				}]
			}
		},

	};
	return config;

}


/**function for Average session duration */

function getAverageSessionChartJs() {

	var averageSession = averegeSessionDuration;

	var months = [];
	var totalAverageSession = [];
	var averageSessionLength = averageSession.length;
	/**for averege session duration */
	for (var i = 0; i < averageSessionLength; i++) {
		
		months.push(averageSession[i]['month_year']);
	
		if (typeof averageSession[i]['spent_time_average_count'] !== typeof undefined) {
			totalAverageSession.push(averageSession[i]['spent_time_average_count']);
		} else {
			totalAverageSession.push(0);
		}
	}
	
	var config = null;

	config = {
		type: 'line',
		data: {
			labels: months,
			datasets: [{
				label: "Average Session Duration",
				data: totalAverageSession,
				borderColor: 'rgb(216, 169, 57)',
				fill: false
			}, ]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			legend: {
				display: false
			},
			scales: {
				yAxes: [{
					ticks: {
						userCallback: function (value) {
							return epoch_to_hh_mm_ss(value);
						},
						stepSize: 10 * 60,
						beginAtZero: true,
					}
				}],
			},
			tooltips: {
				callbacks: {
					label: function (tooltipItem, data) {
						return data.datasets[tooltipItem.datasetIndex].label + ': ' + epoch_to_hh_mm_ss(tooltipItem.yLabel)
					}
				}
			}
		},
	};
	return config;

}

function epoch_to_hh_mm_ss(value) {
	let hour = Math.floor(value / 3600);
	let minutes = Math.floor(value % 3600 / 60);
	let seconds = Math.floor(value % 3600 % 60);

	if (hour < 10) {
		hour = "0" + hour
	};
	if (minutes < 10) {
		minutes = "0" + minutes
	};
	if (seconds < 10) {
		seconds = "0" + seconds
	};
   var timeFormate = hour + ':' + minutes + ':' + seconds;
   
	return timeFormate;

}