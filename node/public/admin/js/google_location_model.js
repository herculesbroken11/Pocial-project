var marker = false; ////Has the user plotted their location marker?
function initMap() {
	var oldLat = $('#latitude').val();
	var oldlong = $('#longitude').val();
	var newlat = parseFloat(oldLat);
	var newlong = parseFloat(oldlong);
	var myLatLng = { lat: newlat, lng: newlong };
	var map = new google.maps.Map(document.getElementById('map'), {


		center: { lat: newlat, lng: newlong },
		zoom: 15
	});
	var card = document.getElementById('pac-card');
	var input = document.getElementById('maps_integration');
	var types = document.getElementById('type-selector');
	var strictBounds = document.getElementById('strict-bounds-selector');
	var geocoder = new google.maps.Geocoder();
	map.controls[google.maps.ControlPosition.TOP_RIGHT].push(card);

	var autocomplete = new google.maps.places.Autocomplete(input);

	google.maps.event.addListener(autocomplete, 'place_changed', function () {
		var place = autocomplete.getPlace();


		var lat = place.geometry.location.lat();
		var lng = place.geometry.location.lng();
		$(".latitude").val(lat);
		$(".longitude").val(lng);
		

	});
	autocomplete.bindTo('bounds', map);

	// Set the data fields to return when the user selects a place.
	autocomplete.setFields(
		['address_components', 'geometry', 'icon', 'name']);

	var infowindow = new google.maps.InfoWindow();
	var infowindowContent = document.getElementById('infowindow-content');
	infowindow.setContent(infowindowContent);
	var marker = new google.maps.Marker({
		position: myLatLng,
		map: map,
		//anchorPoint: new google.maps.Point(0, -29),
		draggable: true //make it draggable
	});


	google.maps.event.addListener(marker, 'dragend', function () {

		geocoder.geocode({ 'latLng': marker.getPosition() }, function (results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				if (results[0]) {
					$('#maps_integration').val(results[0].formatted_address);
					$('#latitude').val(marker.getPosition().lat());
					$('#longitude').val(marker.getPosition().lng());
					infowindow.setContent(results[0].formatted_address);
					infowindow.open(map, marker);
				}
			}
		});
	});


	autocomplete.addListener('place_changed', function () {
		infowindow.close();
		marker.setVisible(false);
		var place = autocomplete.getPlace();
		if (!place.geometry) {
			// User entered the name of a Place that was not suggested and
			// pressed the Enter key, or the Place Details request failed.
			window.alert("No details available for input: '" + place.name + "'");
			return;
		}

		// If the place has a geometry, then present it on a map.
		if (place.geometry.viewport) {
			map.fitBounds(place.geometry.viewport);
		} else {
			map.setCenter(place.geometry.location);
			map.setZoom(17);  // Why 17? Because it looks good.
		}
		marker.setPosition(place.geometry.location);
		marker.setVisible(true);

		var address = '';
		if (place.address_components) {
			address = [
				(place.address_components[0] && place.address_components[0].short_name || ''),
				(place.address_components[1] && place.address_components[1].short_name || ''),
				(place.address_components[2] && place.address_components[2].short_name || '')
			].join(' ');
		}

		//infowindowContent.children['place-icon'].src = place.icon;
		//infowindowContent.children['place-name'].textContent = place.name;
		//infowindowContent.children['place-address'].textContent = address;
		infowindow.open(map, marker);
	});

	// Sets a listener on a radio button to change the filter type on Places
	// Autocomplete.
	function setupClickListener(id, types) {
		var radioButton = document.getElementById(id);
		radioButton.addEventListener('click', function () {
			autocomplete.setTypes(types);
		});
	}

	setupClickListener('changetype-all', []);
	setupClickListener('changetype-address', ['address']);
	setupClickListener('changetype-establishment', ['establishment']);
	setupClickListener('changetype-geocode', ['geocode']);

	document.getElementById('use-strict-bounds')
		.addEventListener('click', function () {
			console.log('Checkbox clicked! New state=' + this.checked);
			autocomplete.setOptions({ strictBounds: this.checked });
		});
}

