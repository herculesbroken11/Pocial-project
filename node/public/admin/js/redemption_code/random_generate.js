/** For genrate coupon */
$(".random_code").click(function(){
	randomString();
});

function randomString() {
	var chars = "0123456789";
	var string_length	= 4;
	var randomstring	= '';
	for (var i=0; i<string_length; i++) {
		var rnum = Math.floor(Math.random() * chars.length);
		randomstring += chars.substring(rnum,rnum+1);
	}
	$('#redemption_code').val(randomstring);
}