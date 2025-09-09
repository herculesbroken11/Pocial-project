var title  = "Are you sure";
var text  = "Are you sure you want to perform this action?";
var msg	=	"Are you sure you want to change status?";
var delete_msg	=	"Are you sure you want to delete this?";


/**
 * Function to delete the user
 *
 * @param null
 *
 * @return void
 */
$(document).on('click', '.delete_user', function(e){ 
	e.stopImmediatePropagation();
	url = $(this).attr('href');
	bootbox.confirm(delete_msg,
	function(result){
		if(result){
			window.location.replace(url);
		}
	});
	e.preventDefault();
});

	
	/**
 * Function to change status
 *
 * @param null
 *
 * @return void
 */
	$(document).on('click', '.activate_action', function(e){ 
		e.stopImmediatePropagation();
		url = $(this).attr('href');
		msg	=  msg;
		if($(this).attr('rel')){
			msg	=	$(this).attr('rel');
		}
		
		
		bootbox.confirm(msg,
		function(result){
			if(result){
				window.location.replace(url);
			}
		});
		e.preventDefault();
	});

$(function(){
	
	/**
	 * function to perform diffrent actions
	 * Check uncheck main checkbox
	 */
	 $(document).on('click', '.checkAllUser', function(e){ 
		
		$('#powerwidgets').find(':checkbox').prop('checked', $(this).prop("checked"));
		
		if($('.checkAllUser:checked').length > 0){
			$('#powerwidgets').find('.items-inner').addClass('highlightBox');
		}else{
			$('#powerwidgets').find('.items-inner').removeClass('highlightBox');
		} 
		 
		
		$('.checkAllUser').css('outline-color', '');
		$('.checkAllUser').css('outline-style', '');
		$('.checkAllUser').css('outline-width', '');
		
		//Perform Action
		var allVals = [];
		$('#powerwidgets').find(':checkbox').each(function() {
			if($(this).is(":checked")){
				allVals.push($(this).val());
			}
		});
		
		
		if(($('.checkAllUser').prop('checked') == true) && ($('.deleteall option:selected').val() != '')){
			$(this).prop('checked',true);
			 var actionType = $('.deleteall option:selected').val();
			 var retailerId	= $('#retailer_id').val();
			 var updatedType= $('#updated_type').val();
			 e.stopImmediatePropagation();
				swal({
					title: title,
					text: text,
					type: "warning",
					showCancelButton: true,
					confirmButtonColor: "#DD6B55",
					confirmButtonText: "Yes",
					closeOnConfirm: false
				}, function () {
						$.ajax({
							url: admin_list_url+'/update_multiple_status',
							type: 'post',
							data: { ids: allVals, type : actionType},
							beforeSend: function() { 
								$(".page-loader-wrapper").show();
							},
							success:function(data) {
								$(".page-loader-wrapper").hide();
								window.location.href=window.location.href;
							}
						});
				});
			e.preventDefault();
		}
		//end Perform action
	});
	
	/**
	* function to perform select and unselect all check box	
	*/
	
	//when particular checkboc is checked
	$(document).on('click', '.userCheckBox', function(e){ 
		$(this).prop('checked', $(this).prop("checked"));
		$(this).closest('.items-inner').toggleClass('highlightBox');
		
		if($('.userCheckBox:checked').length > 0){
			$('.checkAllUser').prop('checked', true);
		}else{
			$('.checkAllUser').prop('checked', false);
		}
	});
	
	
	/**
	* function to perform selected action for  all selected users
	* for change the action 	
	*/ 
	$(document).on('change', '.deleteall', function(e){
		
		var allVals = [];
		$('#powerwidgets').find(':checkbox').each(function() {
			if($(this).is(":checked")){
				allVals.push($(this).val());
			}
		});
		if($('.checkAllUser').prop('checked') == true){
			var actionType = $('.deleteall option:selected').val();
			$('.deleteall').selectpicker('refresh');
				var retailerId	= $('#retailer_id').val();
				var updatedType= $('#updated_type').val();
			e.stopImmediatePropagation();
			if($(this).val() != '') {
				swal({
					title: title,
					text: text,
					type: "warning",
					showCancelButton: true,
					confirmButtonColor: "#DD6B55",
					confirmButtonText: "Yes",
					closeOnConfirm: false
				}, function () {
						$.ajax({
							url: admin_list_url+'/update_multiple_status',
							type: 'post',
							data: { ids: allVals, type : actionType},
							beforeSend: function() { 
								$(".page-loader-wrapper").show();
							},
							success:function(data) {
								$(".page-loader-wrapper").hide();
								window.location.href=window.location.href;
							}
						});
				});
			}
			e.preventDefault();
		}else{
			if($(this).val() != ''){
			swal({
				type: 'error',
				title : 'Error',
				text: 'Please select at least one row.',
				showConfirmButton: true,
				timer: 10000000
			});
			}
			$('.checkAllUser').css('outline-color', '#5897fb');
			$('.checkAllUser').css('outline-style', 'solid');
			$('.checkAllUser').css('outline-width', 'thin');
		}
	});
});

