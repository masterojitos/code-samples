var iframe = null;

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (!iframe) {
    createIframe();
    window.setTimeout(function () {
      getLinkedinData();
      verifyUrl();
    }, 1000);
    // sendResponse({});
  } else {
    toggle();
  }
});

function createIframe () {
  iframe = document.createElement('iframe');
  iframe.style.height = "100%";
  iframe.style.width = "0px";
  iframe.style.position = "fixed";
  iframe.style.top = "0px";
  iframe.style.right = "0px";
  iframe.style.zIndex = "999999";
  iframe.frameBorder = "none";
  iframe.src = chrome.extension.getURL("sidepanel.html")
  document.body.appendChild(iframe);
  toggle();
}

function toggle () {
  if (iframe.style.width === "0px") {
    iframe.style.width="400px";
  } else {
    iframe.style.width="0px";
  }
}

function getLinkedinData () {
  var data = {
    name: $('#name').text() || $('.pv-top-card-section__name').text(),
    photo: $('.image').attr('src') || $('.pv-top-card-section__photo-wrapper img').attr('src'),
    title: $('p[data-section]').text() || $('.pv-top-card-section__headline').text(),
    company: $('p[data-section]').text().split(/ at | en |, /).pop() || $.trim($('.pv-top-card-section__company').text()),
    current_company: $('tr[data-section="currentPositionsDetails"]').text() || [],
    location: $('.locality').text() || $('.pv-top-card-section__location').text(),
    summary: $('#summary .description p').html() || ($('.pv-top-card-section__summary .truncate-multiline--truncation-target > span:eq(0)').text() + $('.pv-top-card-section__summary .truncate-multiline--last-line').text()),
    url: window.location.href
  };
  if (data.current_company.length === 0) {
    $('.pv-entity__summary-info').each(function () {
      if ($('.pv-entity__date-range span:eq(1)', this).text().search(/present|actualidad/i) > 0) {
        data.current_company.push($('.pv-entity__secondary-title', this).text());
      }
    });
    data.current_company = data.current_company.join(', ');
  }
  chrome.runtime.sendMessage(data);
}

function verifyUrl () {
  var oldURL = window.location.href;
  var newURL = oldURL;
  window.setInterval(function() {
    newURL = window.location.href;
    console.log(newURL)
    if (oldURL !== newURL) {
      getLinkedinData();
      oldURL = newURL;
    }
  }, 2000);
}
