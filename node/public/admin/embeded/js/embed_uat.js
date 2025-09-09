if (typeof PocialJSInitialize == 'undefined') {

    let PocialDomain = "http://pocial.dev2.gipl.inet:21090/";
    let domainUrl = "http://pocial.dev2.gipl.inet:21010/";
    let PocialAWSDomain = domainUrl + "admin/embeded/";

    // let PocialDomain	=	"https://pocial.stage2.demo321.com/";
    // let domainUrl		= 	"https://pocialadmin.stage2.demo321.com/";
    // let PocialAWSDomain	=	domainUrl+"admin/embeded/";

    let objectIdData = {};
    var PocialHead = document.getElementsByTagName('head')[0];
    var pocialBodyInitialize = false;
    var PocialJSInitialize = true;
    var TopPositionOfDoc;
    function PLoadJS(loadJs) {
        var script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = loadJs;
        PocialHead.appendChild(script);
    }
    function PLoadCSS(loadCss) {
        var link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = loadCss;
        PocialHead.appendChild(link);
    }

    // get lead data
    function resolveAfter2Seconds(leadFormId) {
        return new Promise(resolve => {
            const xhttp = new XMLHttpRequest();
            xhttp.onload = function () {
                let leadData = JSON.parse(this.responseText);
                resolve(leadData.result);
            }
            xhttp.open("GET", domainUrl + "api/get_lead_capture_script_listing/" + leadFormId);
            xhttp.send();
        });
    }

    function pocialAutoResizer() {
        console.log("pocialAutoResizer")
        if (pjQuery('.pocial_embeded_responsive').length > 0) {
            pjQuery('.pocial_embeded_responsive').each(function () {
                var NewWidth = parseInt(pjQuery(this).width());
                var NewHeight = Math.round(parseFloat(pjQuery(this).data('asr')) * NewWidth);
                pjQuery(this).height(NewHeight);
            });
        }

        pjQuery(".pocial_embeded_container").css("font-size", '36px');
        pjQuery(".pocial_embeded_container").each(function (i) {


            var mainContainerHeight = pjQuery(this).innerHeight();
            var hPer = parseInt((45 / 100) * mainContainerHeight);

            pjQuery(this).find('.showInCorner img').css("max-height", (hPer) + "px");

            var ph = pjQuery(this).innerHeight();
            var eh = pjQuery(this).find('.pocial_mdc').height();
            var pw = pjQuery(this).innerWidth();
            var size = 25;
            if (ph < eh) {
                while (eh > ph && size > 8) {
                    size = parseInt(pjQuery(this).css("font-size"));
                    pjQuery(this).css("font-size", size - 1);
                    eh = parseInt(pjQuery(this).find('.pocial_mdc').height());
                }
            }
            var ew = pjQuery(this).find('.pocial_mdc').innerWidth();
            if (pw < ew) {
                while (ew > pw && size > 8) {
                    size = parseInt(pjQuery(this).css("font-size"));
                    pjQuery(this).css("font-size", size - 1);
                    ew = pjQuery(this).find('.pocial_mdc').innerWidth();
                }
            }
        });
    }

    function getViewport() {
        console.log("getViewport")
        var viewPortWidth;
        var viewPortHeight;
        // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
        if (typeof window.innerWidth != 'undefined') {
            viewPortWidth = window.innerWidth,
                viewPortHeight = window.innerHeight
        }
        // IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
        else if (typeof document.documentElement != 'undefined' && typeof document.documentElement.clientWidth != 'undefined' && document.documentElement.clientWidth != 0) {
            viewPortWidth = document.documentElement.clientWidth,
                viewPortHeight = document.documentElement.clientHeight
        } else {
            viewPortWidth = document.getElementsByTagName('body')[0].clientWidth,
                viewPortHeight = document.getElementsByTagName('body')[0].clientHeight
        }
        return [viewPortWidth, viewPortHeight];
    }

    if (typeof pjQuery == 'undefined') {
        PLoadJS(PocialAWSDomain + 'js/pjquery.js');
    }
    PLoadCSS(PocialAWSDomain + 'pocial_css/embed.css?' + (Math.random() * 10));
    var PocialBodyOverflow = "";
    function ONPOCIALWINDOWRESIZE() {
        console.log("ONPOCIALWINDOWRESIZE")
        window.setTimeout(function () {
            pocialAutoResizer();
            var ViewPorts = getViewport();
            if (pjQuery('.MainPocialWrapper').length > 0) {
                pjQuery('.MainPocialWrapper').css('width', parseInt(ViewPorts[0]) + "px");
                pjQuery('.MainPocialWrapper').css('height', parseInt(ViewPorts[1]) + "px");
            }
            if (pjQuery('.PocialIframeOpened').length > 0) {
                pjQuery('.PocialIframeOpened iframe').css('width', parseInt(ViewPorts[0]) + "px");
                pjQuery('.PocialIframeOpened iframe').css('height', parseInt(ViewPorts[1]) + "px");
            }
        }, 500);
    }
    function removePocialFrame() {
        console.log("removePocialFrame")
        if (pjQuery('.MainPocialWrapper').length > 0) { pjQuery('.MainPocialWrapper').remove(); }
        if (pjQuery('.PocialIframeOpened').length > 0) { pjQuery('.PocialIframeOpened').remove(); }
        pjQuery('html,body').css('overflow', PocialBodyOverflow);
        pjQuery('html,body').animate({ scrollTop: TopPositionOfDoc + "px" }, 100);
    }

    function maxZIndex(elems) {
        console.log("maxZIndex")
        var maxIndex = 0;
        elems = typeof elems !== 'undefined' ? elems : pjQuery("*");
        pjQuery(elems).each(function () {
            maxIndex = (parseInt(maxIndex) < parseInt(pjQuery(this).css('z-index'))) ? parseInt(pjQuery(this).css('z-index')) : maxIndex;
        });
        return maxIndex;
    }

    function detectSafariBrowser() {
        console.log("detectSafariBrowser")
        var name = "Unknown";
        if (navigator.userAgent.indexOf("MSIE") != -1) {
            name = "MSIE";
        }
        else if (navigator.userAgent.indexOf("Firefox") != -1) {
            name = "Firefox";
        }
        else if (navigator.userAgent.indexOf("Opera") != -1) {
            name = "Opera";
        }
        else if (navigator.userAgent.indexOf("Chrome") != -1) {
            name = "Chrome";
        }
        else if (navigator.userAgent.indexOf("Safari") != -1) {
            name = "Safari";
        }
        return name;
    }
    function pocialLoadCaptureLeadByPackageId(pocialCaptureLeadByPackageId) {
        console.log("pocialLoadCaptureLeadByPackageId")
        var ViewPorts = getViewport();
        var MaxZindex = maxZIndex();
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = "";
        UrlForIframe = PocialDomain + 'loadembed/' + pocialCaptureLeadByPackageId;
        UrlForIframe += '?isfromembed=y';
        var $iFrame = '\
            <div class="MainPocialWrapper" style="position:fixed;top:0;left:0;width:'+ ViewPorts[0] + 'px;height:' + ViewPorts[1] + 'px;background-color: rgba(0, 0, 0, 0.65);z-index:' + (MaxZindex + 2) + ';display: table; text-align: center;"><div class="innerPocialContent"><div class="MainPocialLoading"></div><div class="positionPocialIcon"><i class=""></i></div></div></div>\
            <div class="PocialIframeOpened" style="z-index:'+ (MaxZindex + 3) + ';position:absolute;margin:0;padding:0;top:0;left:0;width:100%;height:' + ViewPorts[1] + 'px;background:transparent;" >\
                <iframe allowFullScreen="true" class="PocialFinalLoad" src="'+ UrlForIframe + '" style="border: 0; position:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'absolute' : 'fixed') + ' top:0;left:0; width:100%; height:100%;z-index:' + (MaxZindex + 4) + ';overflow-x:hidden; -webkit-overflow-scrolling: touch;background:transparent;opacity:0;" onload="pjQuery(this).css(\'opacity\',\'1\');pjQuery(\'.innerPocialContent\').hide();" scrolling="' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'yes' : 'yes') + '" ><body style="width:100%;height:100%;background-color: rgba(0, 0, 0, 0.65);">LOADING</body></iframe>\
            </div>';
        pjQuery($iFrame).appendTo(pjQuery('body'));
        pjQuery('<img src="' + PocialAWSDomain + 'pocial_images/embed_close.png" class="PocialClickableEle" style="border: 0;position:fixed;right:5px;top:5px;z-index:' + (MaxZindex + 10) + ';cursor:pointer;width:15px;height:15px;opacity:1;background:#00aff0 none repeat scroll 0 0;padding:7px;right:-3px;top:0px;-webkit-box-sizing: content-box;box-sizing: content-box;" onclick="javascript:removePocialFrame();"/>').appendTo(pjQuery('.PocialIframeOpened'));
        pjQuery('.PocialIframeOpened img').css('z-index', MaxZindex + 11);
        pjQuery('html,body').animate({ scrollTop: '0px' });
    }

    function pocialLoadInteractiveVideoByPackageId(pocialInteractiveVideoByPackageId) {
        console.log("pocialLoadInteractiveVideoByPackageId")

        var ViewPorts = getViewport();
        var MaxZindex = maxZIndex();
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = "";
        UrlForIframe = PocialDomain + 'interactivevideo/loadembed/' + pocialInteractiveVideoByPackageId;
        UrlForIframe += '?isfromembed=y';
        var $iFrame = '\
            <div class="MainPocialWrapper" style="position:fixed;top:0;left:0;width:'+ ViewPorts[0] + 'px;height:' + ViewPorts[1] + 'px;background-color: rgba(0, 0, 0, 0.65);z-index:' + (MaxZindex + 2) + ';display: table; text-align: center;"><div class="innerPocialContent"><div class="MainPocialLoading"></div><div class="positionPocialIcon"><i class=""></i></div></div></div>\
            <div class="PocialIframeOpened" style="z-index:'+ (MaxZindex + 3) + ';position:absolute;margin:0;padding:0;top:0;left:0;width:100%;height:' + ViewPorts[1] + 'px;background:transparent;" >\
                <iframe allowFullScreen="true" class="PocialFinalLoad" src="'+ UrlForIframe + '" style="border: 0; position:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'absolute' : 'fixed') + ' top:0;left:0; width:100%; height:100%;z-index:' + (MaxZindex + 4) + ';overflow-x:hidden; -webkit-overflow-scrolling: touch;background:transparent;opacity:0;" onload="pjQuery(this).css(\'opacity\',\'1\');pjQuery(\'.innerPocialContent\').hide();" scrolling="' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'yes' : 'yes') + '" ><body style="width:100%;height:100%;background-color: rgba(0, 0, 0, 0.65);">LOADING</body></iframe>\
            </div>';
        pjQuery($iFrame).appendTo(pjQuery('body'));
        pjQuery('<img src="' + PocialAWSDomain + 'pocial_images/embed_close.png" class="PocialClickableEle" style="border: 0;position:fixed;right:5px;top:5px;z-index:' + (MaxZindex + 10) + ';cursor:pointer;width:15px;height:15px;opacity:1;background:#00aff0 none repeat scroll 0 0;padding:7px;right:-3px;top:0px;-webkit-box-sizing: content-box;box-sizing: content-box;" onclick="javascript:removePocialFrame();"/>').appendTo(pjQuery('.PocialIframeOpened'));
        pjQuery('.PocialIframeOpened img').css('z-index', MaxZindex + 11);
        pjQuery('html,body').animate({ scrollTop: '0px' });
    }
    function pocailLoadPollBySlug(slug) {
        console.log("pocailLoadPollBySlug")
        var ViewPorts = getViewport();
        var MaxZindex = maxZIndex();
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = "";
        if (slug.indexOf("ranking~") == -1) {
            UrlForIframe = PocialDomain + 'embedload/' + slug;
        }
        else {
            UrlForIframe = PocialDomain + 'p/' + slug.split("~")[1];
        }
        UrlForIframe += '&isfromembed=y';
        var $iFrame = '\
            <div class="MainPocialWrapper" style="position:fixed;top:0;left:0;width:'+ ViewPorts[0] + 'px;height:' + ViewPorts[1] + 'px;background-color: rgba(0, 0, 0, 0.65);z-index:' + (MaxZindex + 2) + ';display: table; text-align: center;"><div class="innerPocialContent"><div class="MainPocialLoading"></div><div class="positionPocialIcon"><i class=""></i></div></div></div>\
            <div class="PocialIframeOpened" style="z-index:'+ (MaxZindex + 3) + ';position:absolute;margin:0;padding:0;top:0;left:0;width:100%;height:' + ViewPorts[1] + 'px;background:transparent;" >\
                <iframe allowFullScreen="true" class="PocialFinalLoad" src="'+ UrlForIframe + '" style="border: 0; position:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'absolute' : 'fixed') + ' top:0;left:0; width:100%; height:100%;z-index:' + (MaxZindex + 4) + ';overflow-x:hidden; -webkit-overflow-scrolling: touch;background:transparent;opacity:0;" onload="pjQuery(this).css(\'opacity\',\'1\');pjQuery(\'.innerPocialContent\').hide();" scrolling="' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'yes' : 'yes') + '" ><body style="width:100%;height:100%;background-color: rgba(0, 0, 0, 0.65);">LOADING</body></iframe>\
            </div>';
        pjQuery($iFrame).appendTo(pjQuery('body'));
        pjQuery('<img src="' + PocialAWSDomain + 'pocial_images/embed_close.png" class="PocialClickableEle" style="border: 0;position:fixed;right:5px;top:5px;z-index:' + (MaxZindex + 10) + ';cursor:pointer;width:15px;height:15px;opacity:1;background:#00aff0 none repeat scroll 0 0;padding:7px;right:-3px;top:0px;-webkit-box-sizing: content-box;box-sizing: content-box;" onclick="javascript:removePocialFrame();"/>').appendTo(pjQuery('.PocialIframeOpened'));
        pjQuery('.PocialIframeOpened img').css('z-index', MaxZindex + 11);
        pjQuery('html,body').animate({ scrollTop: '0px' });
    }
    function pocailLoadGame(slug) {
        console.log("pocailLoadGame")
        var ViewPorts = getViewport();
        var MaxZindex = maxZIndex();
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = PocialDomain + 'p/' + slug + '&accessType=game';
        var isSafariBrowser = detectSafariBrowser();
        if (isSafariBrowser == "Safari" && !(navigator.userAgent.match(/(iPod|iPhone|iPad)/))) {
            window.open('https:' + UrlForIframe);
            return false;
        }
        UrlForIframe += '&isfromembed=y';
        var $iFrame = '\
            <div class="MainPocialWrapper" style="position:fixed;top:0;left:0;width:'+ ViewPorts[0] + 'px;height:' + ViewPorts[1] + 'px;background-color: rgba(0, 0, 0, 0.65);z-index:' + (MaxZindex + 2) + ';display: table; text-align: center;"><div class="innerPocialContent"><div class="MainPocialLoading"></div><div class="positionPocialIcon"><i class=""></i></div></div></div>\
            <div class="PocialIframeOpened" style="z-index:'+ (MaxZindex + 3) + ';position:absolute;margin:0;padding:0;top:0;left:0;width:100%;height:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'auto' : ViewPorts[1] + 'px') + ';background:transparent;" >\
                <iframe allowFullScreen="true" class="PocialFinalLoad" src="'+ UrlForIframe + '" style="border: 0; position:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'absolute' : 'fixed') + ' top:0;left:0; width:' + parseInt(pjQuery(document).width()) + 'px; height:100%;' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'min-height:2000px' : '') + ';z-index:' + (MaxZindex + 4) + ';overflow-x:hidden; -webkit-overflow-scrolling: touch;background:transparent;opacity:0;" onload="pjQuery(this).css(\'opacity\',\'1\');pjQuery(\'.innerPocialContent\').hide();" scrolling="' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'no' : 'yes') + '" ><body style="width:100%;height:100%;background-color: rgba(0, 0, 0, 0.65);">LOADING</body></iframe>\
            </div>';
        pjQuery($iFrame).appendTo(pjQuery('body'));
        pjQuery('<img src="' + PocialAWSDomain + 'pocial_images/embed_close.png" class="PocialClickableEle" style="border: 0;position:fixed;right:5px;top:5px;z-index:' + (MaxZindex + 10) + ';cursor:pointer;width:15px;height:15px;opacity:1;background:#00aff0;padding:3px;right:0px;top:0px;background-size: 15px;background-repeat:no-repeat;-webkit-box-sizing: content-box;box-sizing: content-box;" onclick="javascript:removePocialFrame();"/>').appendTo(pjQuery('.PocialIframeOpened'));
        pjQuery('.PocialIframeOpened img').css('z-index', MaxZindex + 11);
        pjQuery('html,body').animate({ scrollTop: '0px' });
    }

    function pocialLoadCaptureLeadsPackage() {
        console.log("pocialLoadCaptureLeadsPackage")
        let clpId = (objectIdData && objectIdData._id) ? objectIdData._id : "";

        var ViewPorts = getViewport();
        var MaxZindex = maxZIndex();
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = PocialDomain + 'loadembed/' + clpId;

        var isSafariBrowser = detectSafariBrowser();
        if (isSafariBrowser == "Safari" && !(navigator.userAgent.match(/(iPod|iPhone|iPad)/))) {
            window.open('https:' + UrlForIframe);
            return false;
        }
        UrlForIframe += '?isfromembed=y';
        var $iFrame = '\
            <div class="MainPocialWrapper" style="position:fixed;top:0;left:0;width:'+ ViewPorts[0] + 'px;height:' + ViewPorts[1] + 'px;background-color: rgba(0, 0, 0, 0.65);z-index:' + (MaxZindex + 2) + ';display: table; text-align: center;"><div class="innerPocialContent"><div class="MainPocialLoading"></div><div class="positionPocialIcon"><i class=""></i></div></div></div>\
            <div class="PocialIframeOpened" style="z-index:'+ (MaxZindex + 3) + ';position:absolute;margin:0;padding:0;top:0;left:0;width:100%;height:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'auto' : ViewPorts[1] + 'px') + ';background:transparent;" >\
                <iframe allowFullScreen="true" class="PocialFinalLoad" src="'+ UrlForIframe + '" style="border: 0; position:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'absolute' : 'fixed') + ' top:0;left:0; width:' + parseInt(pjQuery(document).width()) + 'px; height:100%;' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'min-height:2000px' : '') + ';z-index:' + (MaxZindex + 4) + ';overflow-x:hidden; -webkit-overflow-scrolling: touch;background:transparent;opacity:0;" onload="pjQuery(this).css(\'opacity\',\'1\');pjQuery(\'.innerPocialContent\').hide();" scrolling="' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'no' : 'yes') + '" ><body style="width:100%;height:100%;background-color: rgba(0, 0, 0, 0.65);">LOADING</body></iframe>\
            </div>';

        pjQuery($iFrame).appendTo(pjQuery('body'));
        pjQuery('<img src="' + PocialAWSDomain + 'pocial_images/embed_close.png" class="PocialClickableEle" style="border: 0;position:fixed;right:5px;top:5px;z-index:' + (MaxZindex + 10) + ';cursor:pointer;width:15px;height:15px;opacity:1;background:#00aff0;padding:3px;right:0px;top:0px;background-size: 15px;background-repeat:no-repeat;-webkit-box-sizing: content-box;box-sizing: content-box;" onclick="javascript:removePocialFrame();"/>').appendTo(pjQuery('.PocialIframeOpened'));
        pjQuery('.PocialIframeOpened img').css('z-index', MaxZindex + 11);
        pjQuery('html,body').animate({ scrollTop: '0px' });
    }

    function pocialLoadRatingCardPackage(clpId) {
        console.log("pocialLoadRatingCardPackage")
        var ViewPorts = getViewport();
        var MaxZindex = maxZIndex();
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = PocialDomain + 'ratingcard/loadembed/' + clpId;
        var isSafariBrowser = detectSafariBrowser();
        if (isSafariBrowser == "Safari" && !(navigator.userAgent.match(/(iPod|iPhone|iPad)/))) {
            window.open('https:' + UrlForIframe);
            return false;
        }
        UrlForIframe += '?isfromembed=y';
        var $iFrame = '\
            <div class="MainPocialWrapper" style="position:fixed;top:0;left:0;width:'+ ViewPorts[0] + 'px;height:' + ViewPorts[1] + 'px;background-color: rgba(0, 0, 0, 0.65);z-index:' + (MaxZindex + 2) + ';display: table; text-align: center;"><div class="innerPocialContent"><div class="MainPocialLoading"></div><div class="positionPocialIcon"><i class=""></i></div></div></div>\
            <div class="PocialIframeOpened" style="z-index:'+ (MaxZindex + 3) + ';position:absolute;margin:0;padding:0;top:0;left:0;width:100%;height:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'auto' : ViewPorts[1] + 'px') + ';background:transparent;" >\
                <iframe allowFullScreen="true" class="PocialFinalLoad" src="'+ UrlForIframe + '" style="border: 0; position:' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'absolute' : 'fixed') + ' top:0;left:0; width:' + parseInt(pjQuery(document).width()) + 'px; height:100%;' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'min-height:2000px' : '') + ';z-index:' + (MaxZindex + 4) + ';overflow-x:hidden; -webkit-overflow-scrolling: touch;background:transparent;opacity:0;" onload="pjQuery(this).css(\'opacity\',\'1\');pjQuery(\'.innerPocialContent\').hide();" scrolling="' + ((navigator.userAgent.match(/(iPod|iPhone|iPad)/)) ? 'no' : 'yes') + '" ><body style="width:100%;height:100%;background-color: rgba(0, 0, 0, 0.65);">LOADING</body></iframe>\
            </div>';
        pjQuery($iFrame).appendTo(pjQuery('body'));
        pjQuery('<img src="' + PocialAWSDomain + 'pocial_images/embed_close.png" class="PocialClickableEle" style="border: 0;position:fixed;right:5px;top:5px;z-index:' + (MaxZindex + 10) + ';cursor:pointer;width:15px;height:15px;opacity:1;background:#00aff0;padding:3px;right:0px;top:0px;background-size: 15px;background-repeat:no-repeat;-webkit-box-sizing: content-box;box-sizing: content-box;" onclick="javascript:removePocialFrame();"/>').appendTo(pjQuery('.PocialIframeOpened'));
        pjQuery('.PocialIframeOpened img').css('z-index', MaxZindex + 11);
        pjQuery('html,body').animate({ scrollTop: '0px' });
    }

    function pocialLoadInteractiveVideoPackage(clpId) {
        console.log("pocialLoadInteractiveVideoPackage")
        TopPositionOfDoc = pjQuery(document).scrollTop();
        removePocialFrame();
        pjQuery('body').css('overflow', 'hidden');
        var UrlForIframe = PocialDomain + 'interactivevideo/loadembed/' + clpId;
        var isSafariBrowser = detectSafariBrowser();
        if (isSafariBrowser == "Safari" && !(navigator.userAgent.match(/(iPod|iPhone|iPad)/))) {
            window.open('https:' + UrlForIframe);
            return false;
        }
        UrlForIframe += '?isfromembed=y';
        if (typeof pjQuery.colorbox == 'undefined') {
            pjQuery = jQuery.noConflict();
        }
        pjQuery.colorbox({
            maxWidth: '700px',
            width: '95%',
            html: '<div><iframe width="700" height="400" src="' + UrlForIframe + '" rel="pocialEmbedInteractiveVideo" allowfullscreen="true" frameborder="0" style="" marginheight="1" marginwidth="1" seamless="seamless" scrolling="no" allowtransparency="true" data-type="interactivevideo" ></iframe></div>',
            onComplete: function () {
                window.setTimeout(function () {
                    pjQuery.colorbox.resize();
                }, 2e3);
            }
        });
        pjQuery(document).bind('cbox_closed', function () {
            pjQuery('body').css({ overflowY: 'auto' });
        });
        return false;
    }

    function pocialIframeToDiv() {
        console.log("pocialIframeToDiv")
        if (pjQuery('iframe[rel=pocialIframePoll],div[rel=pocialIframePoll]').length > 0) {

            pjQuery('iframe[rel=pocialIframePoll],div[rel=pocialIframePoll]').each(function () {
                console.log("pocialIframePoll")

                var $that = pjQuery(this);
                var h2TextColor = '';
                var bordeDivClass = '';
                var divTransParentClass = '';
                var isHideTextBox = '';
                var pboxVoteHtml = '';
                var MyEID = $that.attr('id').replace('pocialPoll-', '');
                var TempDiv = '\
                <div class="yui3-cssreset pocialNoTouch">';
                var BackGround = "";
                if ($that.data('background') != "undefined" && $that.data('background') != "" && $that.data('background') != null) {
                    if (($that.data('repeat') != "undefined" && $that.data('repeat') != "" && $that.data('repeat') != null) || ($that.data('responsive') == 1 || $that.data('responsive') == 'true')) {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');background-repeat:no-repeat;background-size:100% 100% !important;\"";
                    } else {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');\"";
                    }

                    if ($that.data('is_color_text') != "undefined" && $that.data('is_color_text') != "" && $that.data('is_color_text') != null) {
                        h2TextColor = "color:" + $that.data('is_color_text') + "!important;";
                    }
                    else {
                        h2TextColor = '';
                    }
                    divTransParentClass = 'pocial_mdc_transparent';
                }
                else {
                    BackGround = " style=\"background-image:none;\"";
                    if ($that.attr('data-is_color_text') != "undefined" && $that.attr('data-is_color_text') != "" && $that.attr('data-is_color_text') != null) {
                        h2TextColor = "color:" + $that.attr('data-is_color_text') + "!important;";
                        bordeDivClass = ($that.attr('data-is_color_text') == '#000') ? 'borderDivClass_black' : 'borderDivClass_white';
                    }
                    else {
                        h2TextColor = '';
                        bordeDivClass = "";
                    }

                    divTransParentClass = '';
                }

                TempDiv += '<div onclick="javascript:pocailLoadPollBySlug(\'' + $that.data('slug') + '\');return false;"';
                if ($that.data('responsive') == 1 || $that.data('responsive') == 'true') {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container pocial_embeded_responsive PocialClickableEle" data-eid="' + MyEID + '" style="height:' + parseInt($that.attr('height')) + 'px;width:' + parseInt($that.attr('width')) + 'px;max-width:100%;cursor:pointer;" data-asr="' + parseFloat(parseInt($that.attr('height')) / parseInt($that.attr('width'))) + '">';
                } else {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container PocialClickableEle" data-eid="' + MyEID + '" style="height:' + parseInt($that.attr('height')) + 'px;max-width:100%;width:' + parseInt($that.attr('width')) + 'px;cursor:pointer;">';
                }

                var mouseOutImage = "embed_blue_w_white.png";
                var mouseOverImage = "embed_white_w_blue_border.png";
                if ($that.attr('data-type') == "zero") {
                    mouseOutImage = "embed_blue_w_white.png";
                    mouseOverImage = "embed_white_w_blue_border.png";
                } else if ($that.attr('data-type') == "one") {
                    mouseOutImage = "embed_red_w_white.png";
                    mouseOverImage = "embed_white_w_red_border.png";
                } else if ($that.attr('data-type') == "two") {
                    mouseOutImage = "embed_black_w_white.png";
                    mouseOverImage = "embed_white_w_black_border.png";
                }
                else if ($that.attr('data-type') == "three") {
                    mouseOutImage = "embed_white_w_black_border.png";
                    mouseOverImage = "embed_black_w_white.png";
                }
                else if ($that.attr('data-type') == "four") {
                    mouseOutImage = "embed_gray_w_white.png";
                    mouseOverImage = "embed_gray_w_white_border.png";
                }
                else if ($that.attr('data-type') == "five") {
                    mouseOutImage = "embed_white_w_black_border.png";
                    mouseOverImage = "embed_black_trans.png";
                }
                else if ($that.attr('data-type') == "six") {
                    mouseOutImage = "embed_gray_w_white_border.png";
                    mouseOverImage = "embed_trasns_w_white.png";
                }
                else {
                    mouseOutImage = "embed_blue_w_white.png";
                    mouseOverImage = "embed_white_w_blue_border.png";
                }

                if ($that.attr('data-is_hide_text') != "undefined" && $that.attr('data-is_hide_text') == 'true') {
                    isHideTextBox = "display:none!important;";
                    pboxClassName = "";
                    pboxVoteHtml = '<div class="showInCorner"><img src="' + PocialAWSDomain + 'pocial_images/white-logohover-p.png" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/white_logo_round.png" class="pocialHoverImg"/></div>';
                    divTransParentClass = '';
                }
                else {
                    isHideTextBox = '';
                    pboxClassName = '';
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialHoverImg"/>'
                    pboxVoteHtml = '<div>' + voted + '</div>';

                }

                TempDiv += '\
                        <div class="pocial_embeded"'+ BackGround + '>\
                            <div class="pocial_mdc '+ divTransParentClass + '">\
                                <div class="position_view">\
                                    <h2 style='+ h2TextColor + isHideTextBox + '>' + $that.data('title') + '</h2>\
                                    '+ pboxVoteHtml + '\
                                </div>\
                            </div>\
                        </div>\
                    </div>\
                </div>';
                $that.replaceWith(pjQuery(TempDiv));
            });
            window.setTimeout(pocialAutoResizer, 1800);
        }

        if (pjQuery('iframe[rel=pocialIframeGame],div[rel=pocialIframeGame]').length > 0) {
            console.log("if pocialIframeGame")
            pjQuery('iframe[rel=pocialIframeGame],div[rel=pocialIframeGame]').each(function () {
                var $that = pjQuery(this);
                var h2TextColor = '';
                var bordeDivClass = '';
                var divTransParentClass = '';
                var isHideTextBox = '';
                var pboxVoteHtml = '';
                var MyEID = $that.attr('id').replace('pocialPollGame-', '');
                var TempDiv = '\
                <div class="yui3-cssreset pocialNoTouch">';
                var BackGround = "";
                if ($that.data('background') != "undefined" && $that.data('background') != "" && $that.data('background') != null) {
                    if (($that.data('repeat') != "undefined" && $that.data('repeat') != "" && $that.data('repeat') != null) || ($that.data('responsive') == 1 || $that.data('responsive') == 'true')) {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');background-repeat:no-repeat;background-size:100% 100% !important;\"";
                    } else {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');\"";
                    }

                    if ($that.data('is_color_text') != "undefined" && $that.data('is_color_text') != "" && $that.data('is_color_text') != null) {
                        h2TextColor = "color:" + $that.data('is_color_text') + "!important;";
                    }
                    else {
                        h2TextColor = '';
                    }
                    divTransParentClass = 'pocial_mdc_transparent';
                }
                else {
                    BackGround = " style=\"background-image:none;\"";
                    if ($that.attr('data-is_color_text') != "undefined" && $that.attr('data-is_color_text') != "" && $that.attr('data-is_color_text') != null) {
                        h2TextColor = "color:" + $that.attr('data-is_color_text') + "!important;";
                        bordeDivClass = ($that.attr('data-is_color_text') == '#000') ? 'borderDivClass_black' : 'borderDivClass_white';
                    }
                    else {
                        h2TextColor = '';
                        bordeDivClass = "";
                    }

                    divTransParentClass = '';
                }
                var mouseOutImage = "embed_play_blue_w_white.png";
                var mouseOverImage = "embed_play_white_w_blue_border.png";
                if ($that.attr('data-type') == "zero") {
                    mouseOutImage = "embed_play_blue_w_white.png";
                    mouseOverImage = "embed_play_white_w_blue_border.png";
                } else if ($that.attr('data-type') == "one") {
                    mouseOutImage = "embed_play_red_w_white.png";
                    mouseOverImage = "embed_play_white_w_red_border.png";
                } else if ($that.attr('data-type') == "two") {
                    mouseOutImage = "embed_play_black_w_white.png";
                    mouseOverImage = "embed_play_white_w_black_border.png";
                } else if ($that.attr('data-type') == "three") {
                    mouseOutImage = "embed_play_black_w_white.png";
                    mouseOverImage = "embed_play_white_w_black_border.png";
                }
                else if ($that.attr('data-type') == "four") {
                    mouseOutImage = "embed_play_gray_w_white.png";
                    mouseOverImage = "embed_play_white_w_gray_border.png";
                }
                else if ($that.attr('data-type') == "five") {
                    mouseOutImage = "embed_play_white_w_black_border.png";
                    mouseOverImage = "embed_play_black_trans.png";
                }
                else if ($that.attr('data-type') == "six") {
                    mouseOutImage = "embed_play_white_w_gray_border.png";
                    mouseOverImage = "embed_play_trasns_w_white.png";
                }
                else {
                    mouseOutImage = "embed_play_blue_w_white.png";
                    mouseOverImage = "embed_play_white_w_blue_border.png";
                }


                TempDiv += '<div onclick="javascript:pocailLoadGame(\'' + $that.data('slug') + '\');return false;"';
                if ($that.data('responsive') == 1 || $that.data('responsive') == 'true') {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container pocial_embeded_responsive PocialClickableEle" data-eid="' + MyEID + '" style="height:' + parseInt($that.attr('height')) + 'px;width:' + parseInt($that.attr('width')) + 'px;max-width:100%;cursor:pointer;" data-asr="' + parseFloat(parseInt($that.attr('height')) / parseInt($that.attr('width'))) + '">';
                } else {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container PocialClickableEle" data-eid="' + MyEID + '" style="height:' + parseInt($that.attr('height')) + 'px;max-width:100%;width:' + parseInt($that.attr('width')) + 'px;cursor:pointer;">';
                }

                if ($that.attr('data-is_hide_text') != "undefined" && $that.attr('data-is_hide_text') == 'true') {
                    isHideTextBox = "display:none!important;";
                    pboxClassName = "";
                    divTransParentClass = "";
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialHoverImg"/>'
                    pboxVoteHtml = '<div class="showInCorner"><img src="' + PocialAWSDomain + 'pocial_images/white-logohover-p.png" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/white_logo_round.png" class="pocialHoverImg"/></div>';
                }
                else {
                    isHideTextBox = '';
                    pboxClassName = '';
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialHoverImg"/>'
                    pboxVoteHtml = '<div>' + voted + '</div>';
                }
                TempDiv += '\
                        <div class="pocial_embeded"'+ BackGround + '>\
                            <div class="pocial_mdc '+ divTransParentClass + '">\
                                <div class="position_view">\
                                    <h2 style='+ h2TextColor + isHideTextBox + '>' + $that.data('title') + '</h2>\
                                    '+ pboxVoteHtml + '\
                                </div>\
                            </div>\
                        </div>\
                    </div>\
                </div>';
                $that.replaceWith(pjQuery(TempDiv));
            });
            window.setTimeout(pocialAutoResizer, 1800);
        }

        if (pjQuery('iframe[rel=pocialAGame]').length > 0) {
            console.log("if pocialAGame")
            pjQuery('iframe[rel=pocialAGame]').each(function () {
                var $that = pjQuery(this);
                var TempDiv = '<a href="javascript:void(0);" class="pocialAGame PocialClickableEle" onclick="javascript:pocailLoadGame(\'' + $that.data('slug') + '\');return false;">' + $that.data('title') + '</a>';
                $that.replaceWith(pjQuery(TempDiv));
            });
        }
        if (pjQuery('iframe[rel=pocialAPoll]').length > 0) {
            console.log("if pocialAPoll")
            pjQuery('iframe[rel=pocialAPoll]').each(function () {
                var $that = pjQuery(this);
                var TempDiv = '<a href="javascript:void(0);" class="pocialAPoll PocialClickableEle" onclick="javascript:pocailLoadPollBySlug(\'' + $that.data('slug') + '\');return false;">' + $that.data('title') + '</a>';
                $that.replaceWith(pjQuery(TempDiv));
            });
        }

        /*
        Contest package embed functionality start
        first time */

        if (pjQuery('iframe[rel=pocialIframeContest],div[rel=pocialIframeContest]').length > 0) {
            console.log("if pocialIframeContest")
            pjQuery('iframe[rel=pocialIframeContest],div[rel=pocialIframeContest]').each(function () {

                var $that = pjQuery(this);
                var h2TextColor = '';
                var bordeDivClass = '';
                var divTransParentClass = '';
                var isHideTextBox = '';
                var pboxVoteHtml = '';
                var MyContestID = $that.attr('id').replace('pocialIframeContest-', '');

                /** This function is used to get lead details */
                resolveAfter2Seconds(MyContestID).then(leadDataResult => {
                    let title = (leadDataResult.title) ? leadDataResult.title : "";

                    objectIdData['_id'] = MyContestID;
                    var TempDiv = '\
					<div class="yui3-cssreset pocialNoTouch">';
                    var BackGround = "";
                    if ($that.data('background') != "undefined" && $that.data('background') != "" && $that.data('background') != null) {
                        if (($that.data('repeat') != "undefined" && $that.data('repeat') != "" && $that.data('repeat') != null) || ($that.data('responsive') == 1 || $that.data('responsive') == 'true')) {
                            BackGround = " style=\"background-image:url('" + $that.data('background') + "');background-repeat:no-repeat;background-size:100% 100% !important;\"";
                        } else {
                            BackGround = " style=\"background-image:url('" + $that.data('background') + "');\"";
                        }

                        if ($that.data('is_color_text') != "undefined" && $that.data('is_color_text') != "" && $that.data('is_color_text') != null) {
                            h2TextColor = "color:" + $that.data('is_color_text') + "!important;";

                        }
                        else {
                            h2TextColor = '';

                        }
                        divTransParentClass = 'pocial_mdc_transparent';
                    }
                    else {
                        BackGround = " style=\"background-image:none;\"";
                        if ($that.attr('data-is_color_text') != "undefined" && $that.attr('data-is_color_text') != "" && $that.attr('data-is_color_text') != null) {
                            h2TextColor = "color:" + $that.attr('data-is_color_text') + "!important;";
                            bordeDivClass = ($that.attr('data-is_color_text') == '#000') ? 'borderDivClass_black' : 'borderDivClass_white';
                        }
                        else {
                            h2TextColor = '';
                            bordeDivClass = "";
                        }

                        divTransParentClass = '';
                    }
                    var mouseOutImage = "embed_play_blue_w_white.png";
                    var mouseOverImage = "embed_play_white_w_blue_border.png";
                    if ($that.attr('data-type') == "zero") {
                        mouseOutImage = "embed_play_blue_w_white.png";
                        mouseOverImage = "embed_play_white_w_blue_border.png";
                    } else if ($that.attr('data-type') == "one") {
                        mouseOutImage = "embed_play_red_w_white.png";
                        mouseOverImage = "embed_play_white_w_red_border.png";
                    } else if ($that.attr('data-type') == "two") {
                        mouseOutImage = "embed_play_black_w_white.png";
                        mouseOverImage = "embed_play_white_w_black_border.png";
                    } else if ($that.attr('data-type') == "three") {
                        mouseOutImage = "embed_play_black_w_white.png";
                        mouseOverImage = "embed_play_white_w_black_border.png";
                    }
                    else if ($that.attr('data-type') == "four") {
                        mouseOutImage = "embed_play_gray_w_white.png";
                        mouseOverImage = "embed_play_white_w_gray_border.png";
                    }
                    else if ($that.attr('data-type') == "five") {
                        mouseOutImage = "embed_play_white_w_black_border.png";
                        mouseOverImage = "embed_play_black_trans.png";
                    }
                    else if ($that.attr('data-type') == "six") {
                        mouseOutImage = "embed_play_white_w_gray_border.png";
                        mouseOverImage = "embed_play_trasns_w_white.png";
                    }
                    else if ($that.attr('data-type') == "enter_blue") {
                        mouseOutImage = "embed_enter_now_blue.png";
                        mouseOverImage = "embed_enter_now_blue_border.png";
                    }
                    else if ($that.attr('data-type') == "enter_grey") {
                        mouseOutImage = "embed_enter_now_grey_border.png";
                        mouseOverImage = "embed_enter_now_trans.png";
                    }
                    else {
                        mouseOutImage = "embed_play_blue_w_white.png";
                        mouseOverImage = "embed_play_white_w_blue_border.png";
                    }

                    TempDiv += '<div onclick="javascript:pocialLoadCaptureLeadsPackage();return false;"';

                    if ($that.data('responsive') == 1 || $that.data('responsive') == 'true') {
                        TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container pocial_embeded_responsive PocialClickableEle" data-eid="' + MyContestID + '" style="height:' + parseInt($that.attr('height')) + 'px;width:' + parseInt($that.attr('width')) + 'px;max-width:100%;cursor:pointer;" data-asr="' + parseFloat(parseInt($that.attr('height')) / parseInt($that.attr('width'))) + '">';
                    } else {
                        TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container PocialClickableEle" data-eid="' + MyContestID + '" style="height:' + parseInt($that.attr('height')) + 'px;max-width:100%;width:' + parseInt($that.attr('width')) + 'px;cursor:pointer;">';
                    }

                    if ($that.attr('data-is_hide_text') != "undefined" && $that.attr('data-is_hide_text') == 'true') {
                        isHideTextBox = "display:none!important;";
                        pboxClassName = "";
                        divTransParentClass = "";
                        voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialHoverImg"/>';
                        pboxVoteHtml = '<div class="showInCorner"><img src="' + PocialAWSDomain + 'pocial_images/white-logohover-p.png" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/white_logo_round.png" class="pocialHoverImg"/></div>';
                    }
                    else {
                        isHideTextBox = '';
                        pboxClassName = '';
                        voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialHoverImg"/>';
                        pboxVoteHtml = '<div>' + voted + '</div>';
                    }
                    TempDiv += '\
							<div class="pocial_embeded"'+ BackGround + '>\
								<div class="pocial_mdc '+ divTransParentClass + '">\
									<div class="position_view">\
										<h2 style='+ h2TextColor + isHideTextBox + '>' + title + '</h2>\
										'+ pboxVoteHtml + '\
									</div>\
								</div>\
							</div>\
						</div>\
					</div>';
                    $that.replaceWith(pjQuery(TempDiv));
                });
            });
            window.setTimeout(pocialAutoResizer, 1800);
        }

        /*
        Contest package embed functionality end
         */

        /*
        Rating card package embed functionality start
         */

        if (pjQuery('iframe[rel=pocialIframeRatingCard],div[rel=pocialIframeRatingCard]').length > 0) {
            console.log("if pocialIframeRatingCard")
            pjQuery('iframe[rel=pocialIframeRatingCard],div[rel=pocialIframeRatingCard]').each(function () {
                var $that = pjQuery(this);
                var h2TextColor = '';
                var bordeDivClass = '';
                var divTransParentClass = '';
                var isHideTextBox = '';
                var pboxVoteHtml = '';
                var MyContestID = $that.attr('id').replace('pocialIframeRatingCard-', '');
                var TempDiv = '\
                <div class="yui3-cssreset pocialNoTouch">';
                var BackGround = "";
                if ($that.data('background') != "undefined" && $that.data('background') != "" && $that.data('background') != null) {
                    if (($that.data('repeat') != "undefined" && $that.data('repeat') != "" && $that.data('repeat') != null) || ($that.data('responsive') == 1 || $that.data('responsive') == 'true')) {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');background-repeat:no-repeat;background-size:100% 100% !important;\"";
                    } else {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');\"";
                    }

                    if ($that.data('is_color_text') != "undefined" && $that.data('is_color_text') != "" && $that.data('is_color_text') != null) {
                        h2TextColor = "color:" + $that.data('is_color_text') + "!important;";

                    }
                    else {
                        h2TextColor = '';

                    }
                    divTransParentClass = 'pocial_mdc_transparent';
                }
                else {
                    BackGround = " style=\"background-image:none;\"";
                    if ($that.attr('data-is_color_text') != "undefined" && $that.attr('data-is_color_text') != "" && $that.attr('data-is_color_text') != null) {
                        h2TextColor = "color:" + $that.attr('data-is_color_text') + "!important;";
                        bordeDivClass = ($that.attr('data-is_color_text') == '#000') ? 'borderDivClass_black' : 'borderDivClass_white';
                    }
                    else {
                        h2TextColor = '';
                        bordeDivClass = "";
                    }

                    divTransParentClass = '';
                }
                var mouseOutImage = "embed_play_blue_w_white.png";
                var mouseOverImage = "embed_play_white_w_blue_border.png";
                if ($that.attr('data-type') == "zero") {
                    mouseOutImage = "embed_play_blue_w_white.png";
                    mouseOverImage = "embed_play_white_w_blue_border.png";
                } else if ($that.attr('data-type') == "one") {
                    mouseOutImage = "embed_play_red_w_white.png";
                    mouseOverImage = "embed_play_white_w_red_border.png";
                } else if ($that.attr('data-type') == "two") {
                    mouseOutImage = "embed_play_black_w_white.png";
                    mouseOverImage = "embed_play_white_w_black_border.png";
                } else if ($that.attr('data-type') == "three") {
                    mouseOutImage = "embed_play_black_w_white.png";
                    mouseOverImage = "embed_play_white_w_black_border.png";
                }
                else if ($that.attr('data-type') == "four") {
                    mouseOutImage = "embed_play_gray_w_white.png";
                    mouseOverImage = "embed_play_white_w_gray_border.png";
                }
                else if ($that.attr('data-type') == "five") {
                    mouseOutImage = "embed_play_white_w_black_border.png";
                    mouseOverImage = "embed_play_black_trans.png";
                }
                else if ($that.attr('data-type') == "six") {
                    mouseOutImage = "embed_play_white_w_gray_border.png";
                    mouseOverImage = "embed_play_trasns_w_white.png";
                }
                else if ($that.attr('data-type') == "enter_blue") {
                    mouseOutImage = "embed_enter_now_blue.png";
                    mouseOverImage = "embed_enter_now_blue_border.png";
                }
                else if ($that.attr('data-type') == "enter_grey") {
                    mouseOutImage = "embed_enter_now_grey_border.png";
                    mouseOverImage = "embed_enter_now_trans.png";
                }
                else {
                    mouseOutImage = "embed_play_blue_w_white.png";
                    mouseOverImage = "embed_play_white_w_blue_border.png";
                }


                TempDiv += '<div onclick="javascript:pocialLoadRatingCardPackage(' + MyContestID + ');return false;"';
                if ($that.data('responsive') == 1 || $that.data('responsive') == 'true') {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container pocial_embeded_responsive PocialClickableEle" data-eid="' + MyContestID + '" style="height:' + parseInt($that.attr('height')) + 'px;width:' + parseInt($that.attr('width')) + 'px;max-width:100%;cursor:pointer;" data-asr="' + parseFloat(parseInt($that.attr('height')) / parseInt($that.attr('width'))) + '">';
                } else {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container PocialClickableEle" data-eid="' + MyContestID + '" style="height:' + parseInt($that.attr('height')) + 'px;max-width:100%;width:' + parseInt($that.attr('width')) + 'px;cursor:pointer;">';
                }

                if ($that.attr('data-is_hide_text') != "undefined" && $that.attr('data-is_hide_text') == 'true') {
                    isHideTextBox = "display:none!important;";
                    pboxClassName = "";
                    divTransParentClass = "";
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialHoverImg"/>';
                    pboxVoteHtml = '<div class="showInCorner"><img src="' + PocialAWSDomain + 'pocial_images/white-logohover-p.png" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/white_logo_round.png" class="pocialHoverImg"/></div>';
                }
                else {
                    isHideTextBox = '';
                    pboxClassName = '';
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialHoverImg"/>';
                    pboxVoteHtml = '<div>' + voted + '</div>';
                }
                TempDiv += '\
                        <div class="pocial_embeded"'+ BackGround + '>\
                            <div class="pocial_mdc '+ divTransParentClass + '">\
                                <div class="position_view">\
                                    <h2 style='+ h2TextColor + isHideTextBox + '>' + $that.data('title') + '</h2>\
                                    '+ pboxVoteHtml + '\
                                </div>\
                            </div>\
                        </div>\
                    </div>\
                </div>';
                $that.replaceWith(pjQuery(TempDiv));
            });
            window.setTimeout(pocialAutoResizer, 1800);
        }

        /*
        Rating card package embed functionality end
         */

        /*
        Interactive Video package embed functionality start
         */

        if (pjQuery('iframe[rel=pocialIframeInteractiveVideo],div[rel=pocialIframeInteractiveVideo]').length > 0) {
            console.log("if pocialIframeInteractiveVideo")
            pjQuery('iframe[rel=pocialIframeInteractiveVideo],div[rel=pocialIframeInteractiveVideo]').each(function (k) {
                var $that = pjQuery(this);
                var h2TextColor = '';
                var bordeDivClass = '';
                var divTransParentClass = '';
                var isHideTextBox = '';
                var pboxVoteHtml = '';
                var MyContestID = $that.attr('id').replace('pocialIframeInteractiveVideo-', '');
                if (k == 0) {
                    var cBCss = document.createElement('link');
                    cBCss.type = "text/css";
                    cBCss.href = "//d5cvgp25mt3yl.cloudfront.net/pocial_css/pcolorbox.css?" + Math.random();
                    cBCss.rel = "stylesheet";
                    document.getElementsByTagName('head')[0].appendChild(cBCss);
                    if (typeof pjQuery.colorbox == 'undefined') {
                        var cBScript = document.createElement('script');
                        cBScript.type = "text/javascript";
                        cBScript.src = "https://cdnjs.cloudflare.com/ajax/libs/jquery.colorbox/1.6.4/jquery.colorbox.js";
                        document.getElementsByTagName('head')[0].appendChild(cBScript);
                        cBScript.onload = function () {
                        }
                    }
                }
                var TempDiv = '\
                <div class="yui3-cssreset pocialNoTouch">';
                var BackGround = "";
                if ($that.data('background') != "undefined" && $that.data('background') != "" && $that.data('background') != null) {
                    if (($that.data('repeat') != "undefined" && $that.data('repeat') != "" && $that.data('repeat') != null) || ($that.data('responsive') == 1 || $that.data('responsive') == 'true')) {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');background-repeat:no-repeat;background-size:100% 100% !important;\"";
                    } else {
                        BackGround = " style=\"background-image:url('" + $that.data('background') + "');\"";
                    }

                    if ($that.data('is_color_text') != "undefined" && $that.data('is_color_text') != "" && $that.data('is_color_text') != null) {
                        h2TextColor = "color:" + $that.data('is_color_text') + "!important;";

                    }
                    else {
                        h2TextColor = '';

                    }
                    divTransParentClass = 'pocial_mdc_transparent';
                }
                else {
                    BackGround = " style=\"background-image:none;\"";
                    if ($that.attr('data-is_color_text') != "undefined" && $that.attr('data-is_color_text') != "" && $that.attr('data-is_color_text') != null) {
                        h2TextColor = "color:" + $that.attr('data-is_color_text') + "!important;";
                        bordeDivClass = ($that.attr('data-is_color_text') == '#000') ? 'borderDivClass_black' : 'borderDivClass_white';
                    }
                    else {
                        h2TextColor = '';
                        bordeDivClass = "";
                    }

                    divTransParentClass = '';
                }
                var mouseOutImage = "embed_play_blue_w_white.png";
                var mouseOverImage = "embed_play_white_w_blue_border.png";
                if ($that.attr('data-type') == "zero") {
                    mouseOutImage = "embed_play_blue_w_white.png";
                    mouseOverImage = "embed_play_white_w_blue_border.png";
                } else if ($that.attr('data-type') == "one") {
                    mouseOutImage = "embed_play_red_w_white.png";
                    mouseOverImage = "embed_play_white_w_red_border.png";
                } else if ($that.attr('data-type') == "two") {
                    mouseOutImage = "embed_play_black_w_white.png";
                    mouseOverImage = "embed_play_white_w_black_border.png";
                } else if ($that.attr('data-type') == "three") {
                    mouseOutImage = "embed_play_black_w_white.png";
                    mouseOverImage = "embed_play_white_w_black_border.png";
                }
                else if ($that.attr('data-type') == "four") {
                    mouseOutImage = "embed_play_gray_w_white.png";
                    mouseOverImage = "embed_play_white_w_gray_border.png";
                }
                else if ($that.attr('data-type') == "five") {
                    mouseOutImage = "embed_play_white_w_black_border.png";
                    mouseOverImage = "embed_play_black_trans.png";
                }
                else if ($that.attr('data-type') == "six") {
                    mouseOutImage = "embed_play_white_w_gray_border.png";
                    mouseOverImage = "embed_play_trasns_w_white.png";
                }
                else if ($that.attr('data-type') == "enter_blue") {
                    mouseOutImage = "embed_enter_now_blue.png";
                    mouseOverImage = "embed_enter_now_blue_border.png";
                }
                else if ($that.attr('data-type') == "enter_grey") {
                    mouseOutImage = "embed_enter_now_grey_border.png";
                    mouseOverImage = "embed_enter_now_trans.png";
                }
                else {
                    mouseOutImage = "embed_play_blue_w_white.png";
                    mouseOverImage = "embed_play_white_w_blue_border.png";
                }


                TempDiv += '<div onclick="javascript:pocialLoadInteractiveVideoPackage(' + MyContestID + ');return false;"';
                if ($that.data('responsive') == 1 || $that.data('responsive') == 'true') {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container pocial_embeded_responsive PocialClickableEle" data-eid="' + MyContestID + '" style="height:' + parseInt($that.attr('height')) + 'px;width:' + parseInt($that.attr('width')) + 'px;max-width:100%;cursor:pointer;" data-asr="' + parseFloat(parseInt($that.attr('height')) / parseInt($that.attr('width'))) + '">';
                } else {
                    TempDiv += 'class="' + bordeDivClass + ' pocial_embeded_container PocialClickableEle" data-eid="' + MyContestID + '" style="height:' + parseInt($that.attr('height')) + 'px;max-width:100%;width:' + parseInt($that.attr('width')) + 'px;cursor:pointer;">';
                }
                if ($that.attr('data-is_hide_text') != "undefined" && $that.attr('data-is_hide_text') == 'true') {
                    isHideTextBox = "display:none!important;";
                    pboxClassName = "";
                    divTransParentClass = "";
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialHoverImg"/>';
                    pboxVoteHtml = '<div class="showInCorner"><img src="' + PocialAWSDomain + 'pocial_images/white-logohover-p.png" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/white_logo_round.png" class="pocialHoverImg"/></div>';
                }
                else {
                    isHideTextBox = '';
                    pboxClassName = '';
                    voted = '<img src="' + PocialAWSDomain + 'pocial_images/' + mouseOverImage + '" class="pocialNonHoverImg"/><img src="' + PocialAWSDomain + 'pocial_images/' + mouseOutImage + '" class="pocialHoverImg"/>';
                    pboxVoteHtml = '<div>' + voted + '</div>';
                }
                TempDiv += '\
                        <div class="pocial_embeded"'+ BackGround + '>\
                            <div class="pocial_mdc '+ divTransParentClass + '">\
                                <div class="position_view">\
                                    <h2 style='+ h2TextColor + isHideTextBox + '>' + $that.data('title') + '</h2>\
                                    '+ pboxVoteHtml + '\
                                </div>\
                            </div>\
                        </div>\
                    </div>\
                </div>';
                $that.replaceWith(pjQuery(TempDiv));
            });
            window.setTimeout(pocialAutoResizer, 1800);
        }

        /*
        Interactive Video package embed functionality end
         */
        window.setTimeout(pocialIframeToDiv, 2000);
    }

    function pocialInitMyDiv() {
        console.log("pocialInitMyDiv")
        if (typeof pjQuery != 'undefined') {
            PocialBodyOverflow = pjQuery('body').css('overflow');
            pjQuery('document').live("touchstart", function (e) { if (pjQuery('.pocialNoTouch').length > 0) { pjQuery('.pocialNoTouch').removeClass('pocialNoTouch'); } });
            pocialIframeToDiv();
            pjQuery(window).resize(function () {
                setTimeout(ONPOCIALWINDOWRESIZE, 10);
            });
            if (typeof pocialCaptureLeadByPackageId != 'undefined') {
                pocialLoadCaptureLeadByPackageId(pocialCaptureLeadByPackageId);
                window.setTimeout("delete pocialCaptureLeadByPackageId;", 10);
            }
            if (typeof pocialRatingCardPackageId != 'undefined') {
                pocialLoadRatingCardPackageId(pocialRatingCardPackageId);
                window.setTimeout("delete pocialRatingCardPackageId;", 10);
            }
            if (typeof pocialInteractiveVideoByPackageId != 'undefined') {
                pocialLoadInteractiveVideoByPackageId(pocialInteractiveVideoByPackageId);
                window.setTimeout("delete pocialInteractiveVideoByPackageId;", 10);
            }
            if (typeof pocialInvisembedLoad != 'undefined') {
                pocailLoadPollBySlug(pocialInvisembedLoad);
                window.setTimeout("delete pocialInvisembedLoad;", 10);
            }
            if (typeof pocialGInvisembedLoad != 'undefined') {
                pocailLoadGame(pocialGInvisembedLoad);
                window.setTimeout("delete pocialGInvisembedLoad;", 10);
            }
            if (!pocialBodyInitialize) {
                pocialBodyInitialize = true;
                if (navigator.userAgent.match(/(iPod|iPhone|iPad)/)) {
                    setTimeout(function () {
                        var Meta = document.createElement('meta');
                        Meta.name = 'viewport';
                        Meta.content = 'width=device-width,height=device-height,initial-scale=1.0,maximum-scale=1,user-scalable=0, target-densityDpi=device-dpi';
                        PocialHead.appendChild(Meta);
                    }, 100);
                }
            }
        }
        else {
            window.setTimeout(pocialInitMyDiv, 10);
        }
    }
    if (typeof pjQuery != 'undefined') {
        pocialInitMyDiv();
    } else {
        window.setTimeout(pocialInitMyDiv, 10);
    }
} else if (typeof pocialCaptureLeadByPackageId != 'undefined') {
    pocialLoadCaptureLeadByPackageId(pocialCaptureLeadByPackageId);
    window.setTimeout("delete pocialCaptureLeadByPackageId;", 10);
} else if (typeof pocialRatingCardPackageId != 'undefined') {
    pocialLoadCaptureLeadByPackageId(pocialRatingCardPackageId);
    window.setTimeout("delete pocialRatingCardPackageId;", 10);
} else if (typeof pocialInteractiveVideoByPackageId != 'undefined') {
    pocialLoadInteractiveVideoByPackageId(pocialInteractiveVideoByPackageId);
    window.setTimeout("delete pocialInteractiveVideoByPackageId;", 10);
} else if (typeof pocialInvisembedLoad != 'undefined') {
    pocailLoadPollBySlug(pocialInvisembedLoad);
    window.setTimeout("delete pocialInvisembedLoad;", 10);
} else if (typeof pocialGInvisembedLoad != 'undefined') {
    pocailLoadGame(pocialGInvisembedLoad);
    window.setTimeout("delete pocialGInvisembedLoad;", 10);
}
