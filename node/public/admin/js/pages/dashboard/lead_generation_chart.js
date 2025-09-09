function getLeadGenerationChartJs(leadValue){
   
    var voteData = [leadValue.voted_polls,leadValue.opted_in,leadValue.viewed_items,leadValue.redeemed_items];
    var stepTwoParticipants = leadValue.viewed_polls_percentage - leadValue.voted_polls_percentage;
    config ={
        type: 'doughnut',
        data: {
            labels: [
                "Voted",
                "Opted-In",
                "Viewed Item",
                "Redeemed Item"
            ],
            datasets: [{
            data: voteData,
            backgroundColor: [
                "#3188A3",
                "#E7BC3E",
                "#3DA092",
                "#B7B7B7"
            ],
            borderWidth: 1,
            }],
            
        },
        options: { 
            cutoutPercentage: 88,
            elements: {
				center: {
					text: 'Participants Exists at Step 2 : ' +stepTwoParticipants+'%', 
                    fontStyle: 'Arial', 
                    sidePadding: 5 
				}
			},
            responsive: false,
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

/**option wise vote user graph data */
function getPollOptionVoteGraphJs(data) {
    var config 		= 	null;
    var userAge 	=   data['graph_data'];
    var maleVote    = userAge['male_votes'];
    var feMaleVote    = userAge['female_votes'];
    var businessVote = userAge['business_votes'];
    var anonymousVote = userAge['anonymous_votes'];

    var age			= [];
    var totalMaleVote = [];
    var totalFeMaleVote = [];
    var totalBusinessVote = [];
    var totalAnonymousVote = [];

    for(var i=0; i < maleVote.length; i++) {
        age.push(maleVote[i]['age']);
        if(typeof maleVote[i]['votes'] !== typeof undefined){
			totalMaleVote.push(maleVote[i]['votes']);
		}else{
			totalMaleVote.push(0);
		}

    }

    for(var i=0; i < feMaleVote.length; i++) {
        if(typeof feMaleVote[i]['votes'] !== typeof undefined){
			totalFeMaleVote.push(feMaleVote[i]['votes']);
		}else{
			totalFeMaleVote.push(0);
		}

    }

    for(var i=0; i < businessVote.length; i++) {

        if(typeof businessVote[i]['votes'] !== typeof undefined){
			totalBusinessVote.push(businessVote[i]['votes']);
		}else{
			totalBusinessVote.push(0);
		}

    }

    for(var i=0; i < anonymousVote.length; i++) {
       
        if(typeof anonymousVote[i]['votes'] !== typeof undefined){
			totalAnonymousVote.push(anonymousVote[i]['votes']);
		}else{
			totalAnonymousVote.push(0);
		}

    }

    config = {
		type: 'line',
		data: {
			labels: age,
			datasets: [
				{
					label: "Male Votes",
					data: totalMaleVote,
					borderColor: 'rgb(0,150,136)',
                    fill: false
                    
				},
				{
					label: "Female Votes",
					data: totalFeMaleVote,
					borderColor: 'rgb(244,67,55)',
                    fill: false
				},
                {
					label: "Business User Votes",
					data: totalBusinessVote,
					borderColor: 'rgb(0,188,212)',
                    fill: false
				},
				{
					label: "Anonymous User Votes",
					data: totalAnonymousVote,
					borderColor: 'rgb(255,152,1)',
                    fill: false
				},
			]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,
			legend: false,
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
