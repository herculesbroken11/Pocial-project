$(function () {
    new Chart(document.getElementById("poll_vote_graph").getContext("2d"),getPollVoteGraphJs());
});

function getPollVoteGraphJs() {
    var config 		= 	null;
    var userAge 	=   pollVoteGraph['graph_data'];
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

	if(pollVote.male == true){
		totalFeMaleVote = [];
		totalBusinessVote = [];
		totalAnonymousVote = [];
		
	}else if(pollVote.female == true){
		totalMaleVote = [];
		totalBusinessVote = [];
		totalAnonymousVote = [];

	}else if(pollVote.business_user == true){
		totalMaleVote = [];
		totalFeMaleVote = [];
		totalAnonymousVote = [];

	}else if(pollVote.anonymous_user == true){
		totalMaleVote = [];
		totalFeMaleVote = [];
		totalBusinessVote = [];
	}

    config = {
		type: 'line',
		data: {
			labels: age,
			datasets: [
				{
					label: "Male Votes",
					data: totalMaleVote,
					borderColor: 'rgb(49, 136, 163)',
                    fill: false
                    
				},
				{
					label: "Female Votes",
					data: totalFeMaleVote,
					borderColor: 'rgba(255, 87, 34)',
                    fill: false
				},
                {
					label: "Business User Votes",
					data: totalBusinessVote,
					borderColor: 'rgb(85, 85, 85)',
                    fill: false
				},
				{
					label: "Anonymous User Votes",
					data: totalAnonymousVote,
					borderColor: 'rgba(0, 150, 136)',
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