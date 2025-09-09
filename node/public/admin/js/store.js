/*$(function(){
	
    var defaultAddressMap = [$('.latitude').val(), $('.longitude').val()];
   
	$("#maps_integration").geocomplete({
		map: ".map_canvas",
		location: defaultAddressMap,
		markerOptions: {
			draggable: true
		}
	});
	 
	$("#maps_integration").bind("geocode:dragged", function(event, latLng){
		ReverseGeocode(latLng.lat(), latLng.lng(), '#addressLocation');
		$(".latitude").val(latLng.lat());
		$(".longitude").val(latLng.lng());
		//$('.user_location').val(result.formatted_address);
	});
        
        
	$("#location_search").click(function(){
		$("#maps_integration").trigger("geocode");
	}).click();
		
		
	$("#maps_integration").bind("geocode:result", function(event, result){	
		var lat = result.geometry.location.lat();
		var lng = result.geometry.location.lng();			
		ReverseGeocode(lat,lng,'#addressLocation');			
		$(".latitude").val(lat);
		$(".longitude").val(lng);
		$('.user_location').val(result.formatted_address);
	});
});

function ReverseGeocode(lat, longi, selector){
	var geocoder = new google.maps.Geocoder();
	var latLong = new google.maps.LatLng(lat, longi);
	geocoder.geocode({'latLng': latLong}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {			
			if (results) {
				var foundAddress = false;
				for (var i=0; i<results.length; i++) {
					if ((results[i].types[0] == 'street_address') || (results[i].types[0] == 'route')) {				  
						$(selector).html(results[i].formatted_address);
						$("#maps_integration").val(results[i].formatted_address);
						foundAddress = true;
						break;
					}
				}
				if (!foundAddress) {					
					$(selector).html(results[0].formatted_address);
					$("#maps_integration").val(results[i].formatted_address);
				}
			}
		}
	});
}*/
	
	$(document).ready(function(){
		/**
		 * For delete beacon  input fields
		 */
		$(document).on("click", ".delete", function(){	
			
			var divId 				= 	$(this).attr("data-id");
			var deletePopupTitle 	= 	$(this).attr("data-heading");
			var deletePopupMsg 		= 	$(this).attr("data-title");
			var objectId 			= 	$("."+divId).find(".option_id").val();
			var btnId 				= 	$(this).attr("id");
			
			if(divId !=""){
				confirm("warning",deletePopupTitle,deletePopupMsg,
				function(result){
					$("."+divId).html("");
					$("."+divId).removeClass('card');
					var index 	=	1;
					$(".option-html .addattribute").each(function(key){
						if($(this).find(".option_title").length != 0){
							var heading = $(this).find(".option_heading").attr("data-title");
							$(this).find(".option_heading").text(heading+" "+index);
							index++;
						}
					});
									
					stopTextLoading(btnId);
					swal.close();
				});
			}	
		});
	});
	
	/** 
	 * For add more option
	 */
	$(document).on("click", ".add_more", function(){
		var error  = validate_add_more("last");
		//var error  = 0;
		//$('#ajax-loader').show();
		
		if(error == 0){
			appandHtml();
		}
		//$('#ajax-loader').hide();
	});
	
	/**
	* For append html when click add more btn 
	*/
	function appandHtml(){
		var index  		=	$(".option-html").find(".addattribute").length;
		var titleIndex 	=	$(".option-html").find(".addattribute .body").length+1;
		var html		=	$("#addmore-beacon").html();
		
		html			=	html.replace(/{id}/g,index).replace(/{title_counting}/g,titleIndex).replace(/{index_counting}/g,index);
		
		$(".option-html").append(html);
		
		if(index < 1){
			$(".option-html").find(".addattribute .delete").parent().remove();
		}else{
			$(".option-html").find(".addattribute .delete").removeClass('hideMe');	
		}
	}// end appandHtml()
	
	
	/**
	* For validation
	*/
	function validate_add_more(type){
		var error 		= 	0; 
		var errorArray 	= 	[]; 
		
		/* remove form all error */
		//~ $('form').find('span.error').text('');
		
		/*trim form values 
		$("form").find('input').each(function(){
			this.value=$(this).val().trim();
		})*/
			
		if(type != "last"){
			$("form").find(".validate").each(function( key, value ) {
				var value = $(this).val();
				if(!value || value == ""){					
					if($(this).parent().parent().find("span.error").attr("id") != undefined){
						var blankErrorMsg	=	$(this).attr("data-blank-error");
						var errorDivId 		=	$(this).parent().parent().find("span.error").attr("id").replace(/_error/g,"");
						errorArray.push({"param":errorDivId,"msg":blankErrorMsg});
						error++;  	
					}  	
				}	
			});
		}
		
		var allOption = [];
		$(".option-html .addattribute").each(function(key, value ) {
			
			if($(this).find(".option_title").length != 0){
				$(this).find('.validate').each(function(index,data) {					
					var value = $(this).val();
					if(!value || value == ""){
						if($(this).parent().parent().find("span.error").attr("id") != undefined){
							var blankErrorMsg	=	$(this).attr("data-blank-error");
							var errorDivId 		=	$(this).parent().parent().find("span.error").attr("id").replace(/_error/g,"");
							
							errorArray.push({"param":errorDivId,"msg":blankErrorMsg});
							error++;  	
						}  	
					}
				});	
				
				var title			=	$(this).find(".option_title").val().toLowerCase();
				var alias			=	$(this).find(".option_name").val().toLowerCase();
				var titleUniqueMsg	=	$(this).find(".option_title").attr("data-unique-error");
				var errorDivId		=	"";
				if($(this).find(".option_title").parent().parent().find("span.error").attr("id") != undefined){
					errorDivId	=	$(this).find(".option_title").parent().parent().find("span.error").attr("id").replace(/_error/g,"");
				}
				
				/* check option title and alias is unique */
				if(title!="" && alias!=""){
					
					var uniqueVali = 0;
					if(allOption.length >0){
						allOption.forEach(function(data,index){
							var uniqueTitle = (typeof data["beacon_id"] != typeof undefined  && data["beacon_id"])	?	data["beacon_id"]	:"";
							var uniqueAlias = (typeof data["beacon_name"] != typeof undefined  && data["beacon_name"])	?	data["alias"]	:"";
							
							if(uniqueTitle == title && uniqueAlias == alias){
								errorArray.push({"param":errorDivId,"msg":titleUniqueMsg});
								error++;
								uniqueVali++;
							}
							
							if((allOption.length-1 == index) && uniqueVali==0){
								allOption.push({"title":title,"alias":alias});	
							}
						});	
					}else{
						allOption.push({"title":title,"alias":alias});	
					}
				}
			}
		});
		
		if(error > 0 && errorArray.length >0){
		
			display_errors(errorArray,$("form").attr("id"));	
		}
		return error;
	}// end validate_add_more()
	
		
/** 
 * Multiple pickup location add more
 * *
 
$(function(){
    var defaultAddressMap = [$('.latitude').val(), $('.longitude').val()];
   
	$("#pickup_locations").geocomplete({
		map: ".map_canvas",
		location: defaultAddressMap,
		markerOptions: {
			draggable: true
		}
	});
	 
	$("#pickup_locations").bind("geocode:dragged", function(event, latLng){
		ReverseGeocode(latLng.lat(), latLng.lng(), '#addressLocation');
		$(".latitude").val(latLng.lat());
		$(".longitude").val(latLng.lng());
		//$('.user_location').val(result.formatted_address);
	});
        
        
	$("#location_search").click(function(){
		$("#pickup_locations").trigger("geocode");
	}).click();
		
		
	$("#pickup_locations").bind("geocode:result", function(event, result){	
		var lat = result.geometry.location.lat();
		var lng = result.geometry.location.lng();			
		ReverseGeocode(lat,lng,'#addressLocation');			
		$(".latitude").val(lat);
		$(".longitude").val(lng);
		$('.user_location').val(result.formatted_address);
	});
});

function ReverseGeocode(lat, longi, selector){
	var geocoder = new google.maps.Geocoder();
	var latLong = new google.maps.LatLng(lat, longi);
	geocoder.geocode({'latLng': latLong}, function(results, status) {
		if (status == google.maps.GeocoderStatus.OK) {			
			if (results) {
				var foundAddress = false;
				for (var i=0; i<results.length; i++) {
					if ((results[i].types[0] == 'street_address') || (results[i].types[0] == 'route')) {				  
						$(selector).html(results[i].formatted_address);
						$("#pickup_locations").val(results[i].formatted_address);
						foundAddress = true;
						break;
					}
				}
				if (!foundAddress) {					
					$(selector).html(results[0].formatted_address);
					$("#pickup_locations").val(results[i].formatted_address);
				}
			}
		}
	});
}*/

