/**
 * Function to draw role module tree
 */
function printTree(dataArray,level,parentTag,moduleIdsArray){
    if(level == 0){
        $(parentTag).append('<ul id="main-div"></ul>');
        parentTag	=	"#main-div";
    }
    if(typeof dataArray !== typeof undefined && dataArray.length >0){
        dataArray.map(function(menu,index) {

            var isChecked 	=  "";
            if(typeof moduleIdsArray !== typeof undefined){
                var isChecked 	= (moduleIdsArray.indexOf(String(menu.id)) != -1) ? "checked" : "";
            }
            if(level == 0 && index == 0){
                var isChecked = "checked='true' readonly='true' onclick='return false'";
            }
            var ExpendSpan	= '<span title="Expand this branch" class="font-14 collapsed expend-btn"></span>';
            var labelOne 	= '<label class="label label-danger"><input id="AdminRoleModuleId'+menu.id+'Allow" value="'+menu.group_path+'" class="simple-chaeckbox parentCheckbox" name="module_ids['+menu.id+']" type="checkbox" '+isChecked+'> '+menu.name+'</label>';

            var labelTwo 	= '<span class="label label-success"><label><input id="AdminRoleModuleId'+menu.id+'Allow" value="'+menu.group_path+'" class="simple-chaeckbox childCheckbox" name="module_ids['+menu.id+']" type="checkbox" '+isChecked+'> '+menu.name+'</label></span>';

            var label	= (level == 0) ? labelOne : labelTwo;
            var liClass = (level == 0) ? "parent_li no-childrens" : "";
            $(parentTag).append('<li class=" '+liClass+'" id="menu_level_'+level+'_'+index+'">'+label+'</li>');
            if(typeof menu.childs !== typeof undefined && menu.childs.length > 0){
                var currentLevel = level+1
                $('#menu_level_'+level+'_'+index).removeClass('no-childrens');
                $('#menu_level_'+level+'_'+index).prepend(ExpendSpan);
                $('#menu_level_'+level+'_'+index).append('<ul id="main-ol-'+level+'-'+index+'"></ul>');
                printTree(menu.childs,currentLevel,'#main-ol-'+level+'-'+index,moduleIdsArray);
            }
        })
        $('#role-menu li.parent_li').find(' > ul > li').hide('fast');
        $('#check_unckeck_row').removeClass("hide");
        $('#module_ids_error').removeClass("hide");

    }
};//end printTree

/**
 * For expand tree
 */
$('#role-menu li.parent_li').find(' > ul > li').hide('fast');
$(document).on('click','#role-menu li > span.expend-btn', function (e) {
    var children = $(this).parent('li.parent_li').find(' > ul > li');
    if (children.is(":visible")) {
        children.hide('fast');
        $(this).attr('title', 'Expand this branch').addClass('collapsed').removeClass('expended');
    } else {
        children.show('fast');
        $(this).attr('title', 'Collapse this branch').addClass('expended').removeClass('collapsed');
    }
    e.stopPropagation();
});

// Check and Uncheck Checkbox
$(document).on('click','.parentCheckbox',function(e){
    var parent = $(this).closest("li");
    var len = jQuery(parent).find("input:first:checkbox:checked").length;
    if(len == 1){
        jQuery(this).closest('li').find('input').prop("checked",true);
        jQuery(this).closest('li').next('ul').find('input').prop("checked",true);
    }else{
        jQuery(this).closest('li').find('input').prop("checked",false);
        jQuery(this).closest('li').next('ul').find('input').prop("checked",false);
    }
});

// Check and Uncheck Checkbox
$(document).on('click','.childCheckbox',function(e){
    var parent = $(this).parents("ul").parent("li");
    var isParentChecked = jQuery(parent).find("input:first").prop("checked");
    if(!isParentChecked){
        jQuery(this).parents('li').find('input:first').prop("checked",true);
    }
    lengthCount = (jQuery(this).parents('li').find('input:checkbox:checked').length)-1;
    if(lengthCount==0){
        jQuery(this).parents('li').find('input:first').prop("checked",false);
    }
});

/** all checkbox check **/
$(document).on('click','#checkAllBtn',function(){
    $('.parent_li').find('input').prop('checked',true);
});
/** all checkbox uncheck **/
$(document).on('click','#unCheckAllBtn',function(){
    $('.parent_li:not(:first-child)').find('input').prop('checked',false);
});
