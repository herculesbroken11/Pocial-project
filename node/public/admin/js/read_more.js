function showMore(id){
    document.getElementById(id+'Overflow').className='';
    document.getElementById(id+'MoreLink').className='read_more_hidden';
    document.getElementById(id+'LessLink').className='';
}

function showLess(id){
    document.getElementById(id+'Overflow').className='read_more_hidden';
    document.getElementById(id+'MoreLink').className='';
    document.getElementById(id+'LessLink').className='read_more_hidden';
}

var len = 100;
var shrinkables = document.getElementsByClassName('readMore');
if (shrinkables.length > 0) {
    for (var i = 0; i < shrinkables.length; i++){
        var fullText = shrinkables[i].innerHTML;
        if(fullText.length > len){
            var trunc = fullText.substring(0, len).replace(/\w+$/, '');
            var remainder = "";
            var id = shrinkables[i].id;
            remainder = fullText.substring(len, fullText.length);
            shrinkables[i].innerHTML = '<span>' + trunc + '<span class="read_more_hidden" id="' + id + 'Overflow">'+ remainder +'</span></span>&nbsp;<a id="' + id + 'MoreLink" href="#!" onclick="showMore(\''+ id + '\');">Read more</a><a class="read_more_hidden" href="#!" id="' + id + 'LessLink" onclick="showLess(\''+ id + '\');">Read less</a>';
        }
    }
}