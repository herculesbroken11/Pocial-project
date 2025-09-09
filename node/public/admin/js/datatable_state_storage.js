	var pagePathName = "search_" +(($('form#searchForm').attr("data-listing-url")) ? $('form#searchForm').attr("data-listing-url") : window.location.pathname);

	$(document).ready(function() {
		/* Setting up the local when any changes are made in form */
		var formId = 'searchForm';
		$('form#'+formId).on('keyup change paste', 'input, select, textarea', function(){
			var str = $( '#' + formId).serializeArray();
			localStorage[pagePathName] = 	JSON.stringify(str);
		});
	});

	fillSearchFromLocalStorage();

	/* Filling up the form from the local storage */
	function fillSearchFromLocalStorage(key = null){
		if(localStorage[pagePathName] && typeof localStorage[pagePathName] != 'undefined'){
			searchData	=	JSON.parse(localStorage[pagePathName]);
			if(searchData){
				for(let i = 0; i < searchData.length; i++){
					if(searchData[i]){
						if(key){
							if(key == searchData[i]["name"]){
								$('[name="'+ searchData[i]["name"]+'"]').val(searchData[i]["value"]);
							}
						}else{
							$('[name="'+ searchData[i]["name"]+'"]').val(searchData[i]["value"]);
						}
					}
				}

				if($(".bootstrap-select").length >0){
					setTimeout(function(){
					   $(".bootstrap-select select").selectpicker('refresh');
				   },1)
			   }
			}
		}else{
			$('form#searchForm input, select, textarea').each(function(){
				if($(this).val()){
					var str = $( '#searchForm').serializeArray();
					localStorage[pagePathName] = 	JSON.stringify(str);
					$(document).ready(function() {
						dataTable.draw();
					});
				}
			})
		}
	}

	/* Calling up the reset function for datatable */
	$(document).on("click","#reset",function(){
		resetDataTable();
		dataTable.state.clear();

		if($(this).attr("data-href")){
			window.location.href = $(this).attr("data-href");
		}else{
			window.location.reload();
		}
	});

	/**
	* Function for submit data table
	*/
	$(document).on('click','.submit_datatable_form', function(e){
		dataTable.draw();
	});

	/* Resetting the datatable and local storage*/
	function resetDataTable(){
		localStorage.removeItem(pagePathName);
		dataTable.state.clear();

		dataTable.columns().search('');

		/** Reset form **/
		$("#searchForm").find("input,textarea,select").each(function(index,html){
			$(this).val('');
		});

		if($(".bootstrap-select").length >0){
			 setTimeout(function(){
				$(".bootstrap-select select").selectpicker('refresh');
			},1)
		}
	}// end resetDataTable()
