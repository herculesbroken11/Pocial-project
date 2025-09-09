
	
		 $(document).ready(function () {
            var referrer;
			if ($("#previousLink").val() == "") { //alert('pre1');
				referrer = document.referrer;
			} else {
				referrer = $("#previousLink").val();
			}
			if (referrer == "") {
				referrer = "location.php";
			} else {
				$("#backlink").val(referrer);
			}
			$(".back_link").attr('href', referrer);
        });
		function IsEmpty() {
			if ((document.forms['location_form'].tLatitude.value === "") || (document.forms['location_form'].tLongitude.value === ""))
			{
				alert("Please select/draw the area on map shown in right hand side.");
				return false;
			}
			return false;
		}
        var drawingManager;
        var selectedShape;
		function clearSelection() {
			if (selectedShape) {
				if (typeof selectedShape.setEditable == 'function') {
					selectedShape.setEditable(false);
				}
				selectedShape = null;
			}
		}
		function deleteSelectedShape() {
			if (selectedShape) {
				selectedShape.setMap(null);
				$('#tLatitude').val("");
				$('#tLongitude').val("");
			}
		}
		function updateCurSelText(shape) {
			var latt = "";
			var longi = "";
			if (typeof selectedShape.getPath == 'function') {
				for (var i = 0; i < selectedShape.getPath().getLength(); i++) {
					var latlong = selectedShape.getPath().getAt(i).toUrlValue().split(",");
					latt += (latlong[0]) + ",";
					longi += (latlong[1]) + ",";
				}
			}
			$('#tLatitude').val(latt);
			$('#tLongitude').val(longi);
		}
		function setSelection(shape, isNotMarker) {
			clearSelection();
			selectedShape = shape;
			if (isNotMarker)
				shape.setEditable(false);
			updateCurSelText(shape);
		}
		function getGeoCounty(Countryname) {
			var geocoder = new google.maps.Geocoder();
			var address = Countryname;
			var lat, long;
			geocoder.geocode({'address': address}, function (results, status) {
				if (status == google.maps.GeocoderStatus.OK)
				{
					lat = results[0].geometry.location.lat();
					$('#cLatitude').val(lat);
					long = results[0].geometry.location.lng();
					$('#cLongitude').val(long);
					var tlat = $("#tLatitude").val();
					var tlong = $("#tLatitude").val();
					if (tlat == '' && tlong == '') {
						play();
					}
				}
			});
		}
		/////////////////////////////////////
		var map;
		var searchBox;
		var placeMarkers = [];
		var input;
		/////////////////////////////////////
		function initialize() {
			
			var myLatLng = new google.maps.LatLng("", "");
			map = new google.maps.Map(document.getElementById('map-canvas'), {
				zoom: 5,
				center: myLatLng,
				mapTypeId: google.maps.MapTypeId.ROADMAP,
				disableDefaultUI: false,
				zoomControl: false
			});
			var polyOptions = {
				strokeWeight: 0,
				fillOpacity: 0.45,
				editable: false
			};
				drawingModevalue = null;
			drawingManager = new google.maps.drawing.DrawingManager({
				drawingMode: drawingModevalue,
				drawingControl: false,
				drawingControlOptions: {
					position: google.maps.ControlPosition.TOP_RIGHT,
					drawingModes: ['polygon']
				},
				polygonOptions: polyOptions,
				map: map
			});
			google.maps.event.addListener(drawingManager, 'overlaycomplete', function (e) {
				var isNotMarker = (e.type != google.maps.drawing.OverlayType.MARKER);
				drawingManager.setDrawingMode(null);
				var newShape = e.overlay;
				newShape.type = e.type;
				google.maps.event.addListener(newShape, 'click', function () {
					setSelection(newShape, isNotMarker);
				});
				google.maps.event.addListener(newShape, 'drag', function () {
					updateCurSelText(newShape);
				});
				google.maps.event.addListener(newShape, 'dragend', function () {
					updateCurSelText(newShape);
				});
				setSelection(newShape, isNotMarker);
			});
			google.maps.event.addListener(drawingManager, 'drawingmode_changed', clearSelection);
			google.maps.event.addListener(map, 'click', clearSelection);
			google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', deleteSelectedShape);
			google.maps.event.addListener(map, 'bounds_changed', function () {
				var bounds = map.getBounds();
			});
			//~ initSearch(); ============================================
			// Create the search box and link it to the UI element.
			input = /** @type {HTMLInputElement} */(//var
					document.getElementById('pac-input'));
			map.controls[google.maps.ControlPosition.TOP_RIGHT].push(input);
			//searchBox = new google.maps.places.SearchBox((input));
			var autocomplete = new google.maps.places.Autocomplete(input);
			autocomplete.setComponentRestrictions({'country': ['NG']});
			autocomplete.bindTo('bounds', map);
			// Listen for the event fired when the user selects an item from the
			// pick list. Retrieve the matching places for that item.
			var marker = new google.maps.Marker({
				map: map
			});
			autocomplete.addListener('place_changed', function () {
				marker.setVisible(false);
				var place = autocomplete.getPlace();
				if (!place.geometry) {
					window.alert("Autocomplete's returned place contains no geometry");
					return;
				}
				// If the place has a geometry, then present it on a map.
				placeMarkers = [];
				if (place.geometry.viewport) {
					map.fitBounds(place.geometry.viewport);
				} else {
					map.setCenter(place.geometry.location);
					map.setZoom(14);
				}
				// Create a marker for each place.
				marker = new google.maps.Marker({
					map: map,
					title: place.name,
					position: place.geometry.location
				});
				marker.setIcon(({
					url: place.icon,
					size: new google.maps.Size(71, 71),
					origin: new google.maps.Point(0, 0),
					anchor: new google.maps.Point(17, 34),
					scaledSize: new google.maps.Size(25, 25)
				}));
				marker.setVisible(false);
			});
			
			// Polygon Coordinates
			var tLongitude = $('#tLongitude').val();
			var tLatitude = $('#tLatitude').val();
			var Country = $("#iCountry").val();
			if (Country != "" && (tLongitude == "" || tLatitude == "")) {
				getGeoCounty(Country);
				myLatLng = new google.maps.LatLng($("#cLatitude").val(), $("#cLongitude").val());
				map.fitBounds(myLatLng);
			} else {
				if (tLongitude != "" || tLatitude != "") {
					var tlat = tLatitude.split(",");
					var tlong = tLongitude.split(",");
					var triangleCoords = [];
					var bounds = new google.maps.LatLngBounds();
					for (var i = 0, len = tlat.length; i < len; i++) {
						if (tlat[i] != "" || tlong[i] != "") {
							triangleCoords.push(new google.maps.LatLng(tlat[i], tlong[i]));
							var point = new google.maps.LatLng(tlat[i], tlong[i]);
							bounds.extend(point);
						}
					}
					// Styling & Controls
					myPolygon = new google.maps.Polygon({
						paths: triangleCoords,
						draggable: false, // turn off if it gets annoying
						editable: false,
						strokeColor: '#FF0000',
						strokeOpacity: 0.8,
						strokeWeight: 2,
						fillColor: '#FF0000',
						fillOpacity: 0.35
					});
					map.fitBounds(bounds);
					myPolygon.setMap(map);
					//google.maps.event.addListener(myPolygon, "dragend", getPolygonCoords);
					google.maps.event.addListener(myPolygon.getPath(), "insert_at", getPolygonCoords);
					//google.maps.event.addListener(myPolygon.getPath(), "remove_at", getPolygonCoords);
					google.maps.event.addListener(myPolygon.getPath(), "set_at", getPolygonCoords);
					google.maps.event.addDomListener(document.getElementById('delete-button'), 'click', deleteEditShape);
				}
			}
		}
		google.maps.event.addDomListener(window, 'load', initialize);
		function deleteEditShape() {
			if (myPolygon) {
				myPolygon.setMap(null);
			}
			$('#tLatitude').val("");
			$('#tLongitude').val("");
		}
		function play() {
			var pt = new google.maps.LatLng($("#cLatitude").val(), $("#cLongitude").val());
			map.setCenter(pt);
			map.setZoom(5);
		}
		//Display Coordinates below map
		function getPolygonCoords() {
			var len = myPolygon.getPath().getLength();
			var latt = "";
			var longi = "";
			for (var i = 0; i < len; i++) {
				var latlong = myPolygon.getPath().getAt(i).toUrlValue().split(",");
				latt += (latlong[0]) + ",";
				longi += (latlong[1]) + ",";
			}
			$('#tLatitude').val(latt);
			$('#tLongitude').val(longi);
		}		
