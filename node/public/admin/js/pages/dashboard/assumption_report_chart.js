$(function () {
    new Chart(document.getElementById("gender_breakdown_chart").getContext("2d"), GenderBreakdownGraph());
    new Chart(document.getElementById("registered_chart").getContext("2d"), RegisterVsNewGraph());
    new Chart(document.getElementById("lead_generated_fuel_chart").getContext("2d"), leadGeneratedFuelChartJs());
    
    chartPlugin()
});


/**poll participants graph */
function participantsGraph(voteData){

    var labelData =[];
    var chartData = [];
    var color = ["#3188a3", "#3da092", "#e0a801", "#333333", "#777777", "#d95040", "#7D96DB", "#B1A480", "#D36767", "#b21abc", "#C54DA7", "#C1A5CB", "#007FFF", "#4DD0E1"];

    for (var i = 0; i < voteData.length; i++) {
        labelData.push(voteData[i]['question'])
        chartData.push(voteData[i]['total_vote'])
    }

    config ={
        type: 'doughnut',
        data: {
            labels:labelData,
            datasets: [{
            data: chartData,
            backgroundColor: color,
            borderWidth: 2,
            }], 
        },
        options: { 
            cutoutPercentage: 83,
            responsive: false,
            elements: {
				center: {
					text: 'Total Votes: 100%', 
                    fontStyle: 'Arial', 
                    sidePadding: 18  
				}
			},
            legend: {
				position 	:	"bottom",
                "display": false, 
			},
            tooltips: {
                enabled: true,
                mode: 'label',
            }, 
        },  
    }
    return config;
}


/**poll participants graph */
function GenderBreakdownGraph(){
    let maleVote = genderBreakdownChart.male_votes;
    let feMaleVote = genderBreakdownChart.female_votes;
    let businessVote = genderBreakdownChart.business_votes;
    let anonymousVote = genderBreakdownChart.anonymous_votes;
    let totalVote = genderBreakdownChart.total_votes;

    let maleVotePercentage =genderBreakdownChart.male_votes_percentage;
    let femaleVotePercentage =genderBreakdownChart.female_votes_percentage;
    let businessVotePercentage =genderBreakdownChart.business_votes_percentage;
    let AnonymousVotePercentage =genderBreakdownChart.anonymous_votes_percentage;


    var chartData = [feMaleVote,maleVote,businessVote,anonymousVote];
    var color = ["#3188a3", "#3da092", "#e0a801", "#333333", "#777777", "#d95040", "#7D96DB", "#B1A480", "#D36767", "#b21abc", "#C54DA7", "#C1A5CB", "#007FFF", "#4DD0E1"];


    config ={
        type: 'doughnut',
        data: {
            labels:[
                "Females  "+ femaleVotePercentage +"%",
                "Males  "+ maleVotePercentage +"%",
                "Businesses  "+ businessVotePercentage +"%" ,
                "Unspecified  "+ AnonymousVotePercentage +"%"
            ],
            datasets: [{
            data: chartData,
            backgroundColor: color,
            borderWidth: 2,
            }],
            
        },
        options: { 
            cutoutPercentage: 83,
            responsive: false,
            elements: {
				center: {
					text: 'Total Votes: '+totalVote, 
                    fontStyle: 'Arial', 
                    sidePadding: 25  
				}
			},
            legend: {
				position 	:	"bottom",
                "display": true,
				labels		: 	{
					fontColor: 'rgb(43, 43, 43)',
                    boxWidth: 18,
                   padding: 18,
				},  
			},
            tooltips: {
                enabled: true,
                mode: 'label',
            },
        }, 
    }
    return config;

}


/**poll participants graph */
function RegisterVsNewGraph(){
    let registerUser = registerVsNew.registered_percentage;
    let anonymous = registerVsNew.un_registered_percentage;
   
    var chartData = [anonymous,registerUser];
    var color = ["#3188a3", "#3da092", "#e0a801", "#333333", "#777777", "#d95040", "#7D96DB", "#B1A480", "#D36767", "#b21abc", "#C54DA7", "#C1A5CB", "#007FFF", "#4DD0E1"];

    config ={
        type: 'doughnut',
        data: {
            labels:[
                "Anonymous  "+ anonymous +"%",
                "User Generated  "+ registerUser +"%",
            ],
            datasets: [{
            data: chartData,
            backgroundColor: color,
            borderWidth: 2,
            }],
            
        },
        options: { 
            cutoutPercentage: 83,
            responsive: false,
            elements: {
				center: {
					text: 'Total Insights: 100%', 
                    fontStyle: 'Arial', 
                    sidePadding: 5  
				}
			},
            
            legend: {
				position 	:	"bottom",
                "display": true,
				labels		: 	{
					fontColor: 'rgb(43, 43, 43)',
                    boxWidth: 18,
                    padding: 4,
				},
                
			},
            tooltips: {
                enabled: true,
                mode: 'label',
            },
           
        },
        
    }
   
    return config;

}

/**lead generated fuel chart */
function leadGeneratedFuelChartJs() {
    let industry = registerVsNew.opt_in_industry_standard_percentage_value;
    let optInRate = registerVsNew.opt_in_rate;
    var config 			= 	null;

	config = {
		type: 'bar',
		data: {
			labels: [
                "Summer Spectacular",
                "Industry Standred"  
            ],
            datasets: [{
                data: [optInRate, industry],
                backgroundColor: ["#3188a3", "#e0a801"],
            }]
		},
		options : {
            maintainAspectRatio: false,
			responsive: true,
            legend: {
				display		:	false,
				
			},
            scales: {
                xAxes: [{
                    barThickness : 15
                }]
            }
        }

	};
    return config;
}


/**poll campaign question option wise vote graph */
function campaignQuestionChart(optionData){
  
    var optionVal = optionData.options;
  
    var labelData =[];
    var chartData = [];
    var color = [];
    var totalInsights = 0;

   
    for (var i = 0; i < optionVal.length; i++) {
        labelData.push(optionVal[i]['option_title']+' '+optionVal[i]['percentage']+'%')
        chartData.push(optionVal[i]['option_vote_count'])
        color.push(optionVal[i]['color_code'])
        totalInsights += optionVal[i]['option_vote_count'];
    }
   
    config ={
        type: 'doughnut',
        data: {
            labels:labelData,
            datasets: [{
            data: chartData,
            backgroundColor: color,
            borderWidth: 2,
            }], 
        },
        options: { 
            cutoutPercentage: 83,
            responsive: false,
            elements: {
				center: {
					text: 'Total Insights: '+totalInsights, 
                    fontStyle: 'Arial', 
                    sidePadding: 18  
				}
			},
            legend: {
				position 	:	"bottom",
                "display": true,
                labels		: 	{
					fontColor: 'rgb(43, 43, 43)',
                    boxWidth: 18,
                   //padding: 18,
				}, 
			},
            tooltips: {
                enabled: true,
                mode: 'label',
            }, 
        },  
    }
    return config;
}

/**option gender wise vote chart */
function optionGenderVoteChartJs(genderData) {
   
    var maleOptionVal = genderData.male_options;

    var config 	= 	null;

    var  dataValue = [];
    var dataItem = [];
   
   
    for (var i = 0; i < maleOptionVal.length; i++) {
        dataItem.push(maleOptionVal[i]['option_vote_count'])
        dataValue[i] = {
            label: maleOptionVal[i]['option_title'],
            backgroundColor: maleOptionVal[i]['color_code'],
            data:maleOptionVal[i]['count_array_male_female'],
        };
    }
  
	config = {
		type: 'bar',
		data: {
			labels: ["Female","Male"],
			datasets: dataValue,
		},
		options: {
            tooltips: {
              displayColors: true,
              callbacks:{
                mode: 'x',
              },
            },
            scales: {
               
              xAxes: [{
                stacked: true,
                barThickness : 45,
                gridLines: {
                  display: false,
                }
              }],
              yAxes: [{
                stacked: true,
                ticks: {
                  beginAtZero: true,
                },
                type: 'linear',
              }]
            },
            responsive: true,
            maintainAspectRatio: false,
            legend: { 
                display: false,
                position: 'bottom'
             },
          }
	};
    return config;
}


/**option age wise vote chart */
function ageWiseOptionVoteChartJs(ageData) {
    var config 	= 	null;
   
    var ageOptionVal = ageData.age_range_options;
    var ageOption = ageData.age_range_array_vote;
    
    var lebel = [];
    var dataValue = [];

    ageOptionVal.map(function(ageResult){
        lebel.push(ageResult.age)
        var resultData = ageResult.result;

        for (var i = 0; i < resultData.length; i++) {
            dataValue[i] = {
                label: resultData[i]['option_title'],
                backgroundColor: resultData[i]['color_code'],
                data: ageOption[i],
            };

        }

    });
    
    config = {
        type: 'bar',
        data: {
            labels: lebel,
            datasets: dataValue,
        },
        options: {
            tooltips: {
              displayColors: true,
              callbacks:{
                mode: 'x',
              },
            },
            scales: {
               
              xAxes: [{
                stacked: true,
                barThickness : 45,
                gridLines: {
                  display: false,
                }
              }],
              yAxes: [{
                stacked: true,
                ticks: {
                  beginAtZero: true,
                },
                type: 'linear',
              }]
            },
            responsive: true,
            maintainAspectRatio: false,
            legend: { 
                position 	:	"bottom",
                "display": true,
                labels		: 	{
					fontColor: 'rgb(43, 43, 43)',
                    boxWidth: 18,
                   //padding: 18,
				},
                
             },
          }
    };
    return config;
     
 }



function chartPlugin(){
    Chart.pluginService.register({
        beforeDraw: function (chart) {
            if (chart.config.options.elements.center) {
        //Get ctx from string
        var ctx = chart.chart.ctx;
    
        var centerConfig = chart.config.options.elements.center;
        var fontStyle = centerConfig.fontStyle || 'Arial';
                var txt = centerConfig.text;
        var color = centerConfig.color || '#000';
        var sidePadding = centerConfig.sidePadding || 20;
        var sidePaddingCalculated = (sidePadding/100) * (chart.innerRadius * 2)
        ctx.font = "30px " + fontStyle;
        var stringWidth = ctx.measureText(txt).width;
        var elementWidth = (chart.innerRadius * 2) - sidePaddingCalculated;
        var widthRatio = elementWidth / stringWidth;
        var newFontSize = Math.floor(30 * widthRatio);
        var elementHeight = (chart.innerRadius * 2);

        var fontSizeToUse = Math.min(newFontSize, elementHeight);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var centerX = ((chart.chartArea.left + chart.chartArea.right) / 2);
        var centerY = ((chart.chartArea.top + chart.chartArea.bottom) / 2);
        ctx.font = fontSizeToUse+"px " + fontStyle;
        ctx.fillStyle = color;
        
        ctx.fillText(txt, centerX, centerY);
            }
        }
    });
}

