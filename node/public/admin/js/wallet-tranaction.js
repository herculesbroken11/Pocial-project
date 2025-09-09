/**
 * Function to submit shipping form
 */
$(".btn-submit-wallet").click(function(){
	var btnId = $(this).attr("id");
	startTextLoading(btnId);
	ajax_submit("update-wallet-ballance",function(status,response){
		if(status){
			//~ $('#wallet-modal-box').modal('hide');	
			window.location.href = response.redirect_url;
		}else{
			stopTextLoading(btnId);
		}
	});
});

/**
* Javascript update to wallet balance update in user
*
* @param  orderId as order id
*
* @return void
*/
function updateWalletBalance(event){
	var currentTarget = event.currentTarget;
	if(currentTarget != ""){
		let userId = $(currentTarget).attr('data-id');
		$('#overlay1').show();
		$('#user_id').val(userId);
		$('#wallet-modal-box').modal('show');	
		$('#overlay1').hide();				
	}
}//end updateWalletBalance()
		
		
