/*!
 * Copyright (C) 2017 ProgrammersNG.  All rights reserved.
 * This file is an original work developed by ProgrammersNG
 */

var days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
//Calender start

/** Date dropdown*/
function dates(selectDate) {
	let dates = "<option value=''>Select Date</option>";
	let i;

	let dd = document.getElementById("dd").value;
	let mm = document.getElementById("mm").value;
	let yy = document.getElementById("yy").value;
	let dateLoop = Number(days[mm]);


	dateLoop = (isNaN(dateLoop)) ? 31 : dateLoop;

	/** current year months date */
	let d = new Date();
	let currentDate = d.getDate();
	let currentYear = d.getFullYear();
	let currentMonth = d.getMonth() + 1;


	if (mm == 2) {
		dateLoop = Number(yy % 4 == 0) ? 29 : 28;
	}

	/** year wise date start */
	if (currentYear == yy && currentMonth == mm) {
		dateLoop = currentDate
	}

	for (i = 1; i <= dateLoop; i++) {
		let selectedValue = Number(selectDate == i || dd == i) ? "selected" : "";
		dates += "<option value=" + i + " " + selectedValue + ">" + i + "</option>";
	}

	/**You can call the class multiple times*/
	var multiple_list = document.getElementsByClassName("bear-dates");

	for (i = 0; i < multiple_list.length; i++) {
		multiple_list[i].innerHTML = dates;
	}
}

/** Month dropdown*/
function months(selectMonth) {
	/**List all the Days with array*/
	var list_months = [
		'',
		'January',
		'Febuary',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	/** current year months date */
	let d = new Date();
	let currentYear = d.getFullYear();
	let currentMonth = d.getMonth() + 1;

	/** year wise month select*/
	let monthLength = list_months.length;
	let mm = document.getElementById("mm").value;
	let yy = document.getElementById("yy").value;
	if (currentYear == yy) {
		monthLength = currentMonth + 1
	}


	let months = "<option value=''>Select Month</option>";
	for (i = 1; i < monthLength; i++) {
		let selectedValue = Number(selectMonth == i || mm == i) ? "selected" : "";
		months += "<option value=" + i + " " + selectedValue + ">" + list_months[i] + "</option>";
	}

	/** You can call the class multiple times */
	var multiple_list = document.getElementsByClassName("bear-months");
	for (i = 0; i < multiple_list.length; i++) {
		multiple_list[i].innerHTML = months;
	}
}


/** Year dropdown*/
function years(selectYear, startY, endY) {
	let years = "<option value=''>Select Year</option>";
	for (let i = endY; i >= startY; i--) {
		let selectedValue = Number(selectYear == i) ? "selected" : "";
		years += "<option value=" + i + " " + selectedValue + ">" + i + "</option>";
	}

	//You can call the class multiple times						
	var multiple_list = document.getElementsByClassName("bear-years");
	for (i = 0; i < multiple_list.length; i++) {
		multiple_list[i].innerHTML = years;
	}
}
//Calender end
