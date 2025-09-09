# dropdown-calender

Simple Date, Month, Year Dropdown with Vanilla Javascript

	Call the method and parameter, if you want tags around your output
	You can leave it empty of you don't want tags
	month() is the method and option is the tag. 
	You know <option></option> is child to <select></select>,
	Example:
	For date use: 
		HTML = <select class="bear-dates"></select>
		Javascript = dates('option');
		
	For months use:
	
		HTML = <select class="bear-months"></select>
		Javascript = months('option');
			
	For years use:
	You need additional parameter with startYear and endYear, you need to call the tag first and the startYear(1990) and endYear(2017)
		HTML = <select class="bear-years"></select>
		Javascript = years('option', 2000, 2018);	
		
		
		
		
	Note: You can also change the tag to whatever you like, You can use something like <li></li> if you want to list them out
	Example:
	For date use: 
		HTML = <ul class="bear-month"></ul> or <ul class="bear-short-month"></ul> to short the month name
		Javascript = dates('li');
		
