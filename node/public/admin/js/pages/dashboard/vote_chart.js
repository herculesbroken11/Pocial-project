$(function () {
    new Chart(document.getElementById("myChart").getContext("2d"), getPollVoteChartJs());
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
});



function getPollVoteChartJs(){

    var chartData = [
                     {"votePercentage": voteDesktopPercent, "value": voteDesktop}, 
                     {"votePercentage": voteMobilePercent, "value": voteMobile}, 
                     {"votePercentage": voteEmbedDesktopPercent, "value": voteEmbedDesktop},
                     {"votePercentage": voteEmbedMobilePercent, "value": voteEmbedMobile}
                    ]

    var votePercentData = [];
    var voteData = [];

for (var i = 0; i < chartData.length; i++) {
    votePercentData.push(chartData[i]['votePercentage'])
    voteData.push(chartData[i]['value'])
   
}

    config ={
        type: 'doughnut',
        data: {
            labels: [
                "Pocial Desktop Vote  " + voteDesktop,
                "Pocial Mobile Vote  " + voteMobile,
                "Embed Desktop Vote  " + voteEmbedDesktop,
                "Embed Mobile Vote  " + voteEmbedMobile
            ],
            datasets: [{
            label: voteData,
            data: votePercentData,
            backgroundColor: [
                "#3188A3",
                "#B7B7B7",
                "#D95040",
                "#5D5D5D"
            ],
            borderWidth: 1,
            }],
            
        },
        options: { 
            cutoutPercentage: 83,
            elements: {
				center: {
					text: 'Total Votes '+ totalVote, 
                    fontStyle: 'Arial', 
                    sidePadding: 18 
				}
			},
            responsive: false,
            legend: {
				position 	:	"bottom",
                "display": true,
				labels		: 	{
					fontColor: 'rgb(43, 43, 43)',
                    boxWidth: 19,
                    padding: 25,
				},
                
			},
            tooltips: {
                enabled: true,
                mode: 'label',
                callbacks: {
                    label: function(tooltipItem, data) {
                        var indice = tooltipItem.index;
                        return data.labels[indice] +" - "+ data.datasets[0].data[indice] +'%';
                    }
                }
            },
           
        },
        
    }
   
    return config;
}