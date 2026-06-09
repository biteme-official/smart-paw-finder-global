// Meta Pixel
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '1540040707065669');
fbq('track', 'PageView');

// GA4 + Google Ads
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

var shopifyReferrer = document.referrer && (
  document.referrer.indexOf('myshopify.com') !== -1 ||
  document.referrer.indexOf('shopify.com') !== -1 ||
  document.referrer.indexOf('checkout.shopify.com') !== -1
);

(function() {
  var params = new URLSearchParams(window.location.search);
  var utmKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid'];
  var hasUtm = utmKeys.some(function(k){ return params.get(k); });
  if (hasUtm) {
    var saved = {};
    utmKeys.forEach(function(k){ var v = params.get(k); if (v) saved[k] = v; });
    try { sessionStorage.setItem('_bm_utm', JSON.stringify(saved)); } catch(e){}
  } else {
    try {
      var isShopifyReturn = document.referrer && (
        document.referrer.indexOf('myshopify.com') !== -1 ||
        document.referrer.indexOf('shopify.com') !== -1
      );
      if (!isShopifyReturn) {
        var existing = JSON.parse(sessionStorage.getItem('_bm_utm') || '{}');
        if (!existing.utm_source) {
          var ua = navigator.userAgent;
          var ref = document.referrer;
          var src = null, med = null;
          if (ua.indexOf('Line/') !== -1 || ua.indexOf('LIFF') !== -1) {
            src = 'line'; med = 'social';
          } else if (ref && ref.indexOf('line.me') !== -1) {
            src = 'line'; med = 'social';
          } else if (ref && ref.indexOf('instagram.com') !== -1) {
            src = 'instagram'; med = 'social';
          } else if (ref && (ref.indexOf('twitter.com') !== -1 || ref.indexOf('t.co') !== -1 || ref.indexOf('x.com') !== -1)) {
            src = 'twitter'; med = 'social';
          } else if (ref) {
            try {
              var refHost = new URL(ref).hostname.replace(/^www\./, '');
              if (refHost && refHost !== location.hostname) {
                src = refHost; med = 'referral';
              }
            } catch(e){}
          }
          if (src) {
            sessionStorage.setItem('_bm_utm', JSON.stringify({utm_source: src, utm_medium: med}));
          }
        }
      }
    } catch(e){}
  }
})();

var ga4Config = {
  'send_page_view': false,
  'page_location': window.location.href,
  'page_title': document.title,
  'allow_google_signals': true,
  'allow_ad_personalization_signals': true,
  'linker': {
    'domains': ['biteme.one', 'lovable-project-lbgum.myshopify.com'],
    'accept_incoming': true
  }
};

if (shopifyReferrer) {
  ga4Config.ignore_referrer = true;
}

gtag('config', 'G-H7171JQ75N', ga4Config);
gtag('config', 'AW-17941828210');
