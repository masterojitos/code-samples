var apiUrl = 'https://server.fullview.co';
var contact = {
  name: null,
  linkedinName: null,
  photo: null,
  title: null,
  company: null,
  current_company: null,
  location: null,
  summary: null,
  linkedin: null,
  email: null,
  catch_all: false,
  score: null,
  companyId: null,
  companyType: null,
  companyDomain: null,
  companyTmp: null,
  companyTypeTmp: null,
  companyDomainTmp: null,
  public: true
};
var pageLoaded = false;
var requestSecret = null;

var port = chrome.runtime.connect({name: "fullview"});
// port.postMessage({});
port.onMessage.addListener(function (data) {
  stopPage(function(){ refreshPage(data) });
});

var ajax = null, cancelFind = false;
if (!localStorage.getItem('fullview-companies')) {
  localStorage.setItem('fullview-companies', '{}');
} else {
  var companies = JSON.parse(localStorage.getItem('fullview-companies'));
}

function stopPage (callback) {
  if ($('.modal-body').is(":visible")) {
    var wait = 0;
    if (ajax) {
      wait = 500;
      ajax.abort();
      cancelFind = true;
      NProgress.done();
    }
    setTimeout(function() {
      $('.modal-body').hide();
      $('.datahunter-name, .datahunter-company, .datahunter-email, .datahunter-confidence-bar').removeClass('filled change');
      $('.datahunter-confidence-value').text('');
      $('.datahunter-message').text('').removeClass('success');
      $('.datahunter-close').text('Close');
      $('.datahunter-submit').text('Search').prop("disabled", true);
      $('.modal-footer').hide();
      setTimeout(function() {
        callback();
      }, 1000);
    }, wait);
  } else {
    callback();
  }
}

function refreshPage (data) {
  $('.modal-body').show();
  NProgress.start();
  $.get(apiUrl + "/api/verified").done(function () {
    if (data.name) {
      contact.name = data.name;
      contact.linkedinName = data.name;
      contact.photo = data.photo;
      contact.title = data.title;
      contact.company = data.company;
      contact.current_company = data.current_company;
      contact.location = data.location;
      contact.summary = data.summary;
      contact.linkedin = data.url;
      $('.datahunter-name span').text(contact.name);
      $('.datahunter-name').addClass('filled');
      if (!pageLoaded) {
        contact.companyId = data.companyId;
        contact.companyType = data.companyType;
      }
      if (contact.companyId && !pageLoaded) {
        $.ajax({
          url: apiUrl + '/api/datahunter/' + contact.companyType + '/' + contact.companyId,
          dataType : "json",
          method: "GET",
          data: {id: contact.companyId}
        }).done(function (company) {
          NProgress.done();
          pageLoaded = true;
          setTimeout(function() {
            $('.datahunter-company span').text(company.name);
            $('.datahunter-company').addClass('filled');
            // company.url = 'http://www.teclalabs.com';
            var companyData = document.createElement('a');
            companyData.setAttribute('href', company.url);
            contact.companyDomain = companyData.hostname.replace('www.', '');
            $('.modal-footer').show();
            findEmail(contact.name, contact.companyDomain);
          }, 500);
        }).fail(function (response) {
          companiesAutocomplete();
        });
      } else if (pageLoaded) {
          NProgress.done();
          setTimeout(function() {
            if (contact.companyId) {
              $('.datahunter-company').addClass('filled');
              $('.datahunter-submit').prop("disabled", false);
            } else {
              $('.datahunter-company').addClass('change');
            }
            $('.modal-footer').show();
          }, 500);
      } else {
        companiesAutocomplete();
      }
    } else {
      NProgress.done();
      setTimeout(function() {
        $('.datahunter-message').text('You must go to a linkedin profile.');
      }, 500);
    }
  }).fail(function(response) {
    NProgress.done();
    setTimeout(function() {
      $('.datahunter-message').html('You must login to <a href="http://demo.fullview.co" target="_blank">http://demo.fullview.co</a>.');
    }, 500);
  });
}


function companiesAutocomplete () {
  $('.datahunter-company input').catcomplete({
    source: function(request, response) {
      var term = request.term;
      if (term in companies) {
        response(companies[term]);
        return;
      }
      $.ajax({
          url: apiUrl + "/api/datahunter/" + term,
          dataType : "json",
          method: "GET"
      }).done(function (data) {
        companies[term] = data;
        localStorage.setItem("fullview-companies", JSON.stringify(companies));
        response(data);
      }).fail(function (response) {
        $('.datahunter-message').text('We have some problems. Please, try later.');
      });
    },
    minLength: 3,
    select: function( event, ui ) {
      $('.datahunter-company input').val(ui.item.label);
      contact.companyTmp = ui.item._id;
      contact.companyTypeTmp = ui.item.category.toLowerCase();
      var companyData = document.createElement('a');
      companyData.setAttribute('href', ui.item.url);
      contact.companyDomainTmp = companyData.hostname.replace('www.', '');
      return false;
    }
  });
  pageLoaded = true;
  NProgress.done();
  setTimeout(function() {
    $('.datahunter-company').addClass('change');
    $('.modal-footer').show();
  }, 500);
}

function findEmail (name, domain) {
  $('.datahunter-message').text('').removeClass('success');
  $('.datahunter-close').text('Cancel');
  $('.datahunter-submit').prop("disabled", true);
  cancelFind = false;
  NProgress.start();
  var name_array = normalize(name.toLowerCase()).split(' ');
  var names = [], name, i;
  for (i in name_array) {
    name = name_array[i].replace(/[\W_]/g, '');
    if (name.length > 1 && names.length < 2) {
      names.push(name);
    }
  }
  // domain = 'teclalabs.com';
  if (names.length > 0) {
    $.get('https://mailboxlayer.com/').done(function (response) {
      // requestSecret = response.substr(response.indexOf('name="request_secret" value="') + 29, 8);
      requestSecret = response.substr(response.indexOf('name="scl_request_secret" value="') + 33, 32);
      checkAlternatives(names, domain);
    });
  } else {
    NProgress.done();
    setTimeout(function() {
      $('.datahunter-name .datahunter-change').trigger('click');
      $('.datahunter-message').text('You must enter a right name.');
    }, 500);
  }
}

function checkAlternatives (names, domain) {
  var alternatives = [], apilayerStatus = false, i, ajax_data;
  alternatives.push(names[0]);
  if (names.length > 1) {
    alternatives.push(names[1]);
    alternatives.push(names[0] + names[1]);
    alternatives.push(names[0] + '.' + names[1]);
    // alternatives.push(names[0] + '-' + names[1]);
    // alternatives.push(names[0] + '_' + names[1]);
    alternatives.push(names[0].substr(0, 1) + names[1]);
    alternatives.push(names[0].substr(0, 1) + '.' + names[1]);
    // alternatives.push(names[0].substr(0, 1) + '-' + names[1]);
    // alternatives.push(names[0].substr(0, 1) + '_' + names[1]);
    alternatives.push(names[1] + names[0]);
    alternatives.push(names[1] + '.' + names[0]);
    // alternatives.push(names[1] + '-' + names[0]);
    // alternatives.push(names[1] + '_' + names[0]);
    alternatives.push(names[1].substr(0, 1) + names[0]);
    alternatives.push(names[1].substr(0, 1) + '.' + names[0]);
    // alternatives.push(names[1].substr(0, 1) + '-' + names[0]);
    // alternatives.push(names[1].substr(0, 1) + '_' + names[0]);
  }
  var apilayerUrl = 'https://mailboxlayer.com/php_helper_scripts/email_api_n.php';
  if (!requestSecret) {
    apilayerUrl = 'https://apilayer.net/api/check';
  }
  
  var newAlternativeSearch = function (i) {
    setTimeout(function () {
      if (requestSecret) {
        ajax_data = {secret_key: $.md5(alternatives[i] + '@' + domain + requestSecret), email_address: alternatives[i] + '@' + domain};
      } else {
        ajax_data = {access_key: '8e34092e02a18b4b083b934c2c3eb763', email: alternatives[i] + '@' + domain};
      }
      ajax = $.ajax({
        url: apilayerUrl,
        dataType : 'json',
        method: 'GET',
        async: false,
        data: ajax_data
      }).done(function (response) {
        if (response.format_valid && response.mx_found && response.smtp_check) {
          contact.email = response.email;
          contact.catch_all = response.catch_all;
          contact.score = response.score;
          if (!response.catch_all) {
            $('.datahunter-close').prop("disabled", true);
            ajax = null;
            NProgress.done();
            setTimeout(function() {
              $('.datahunter-email').text(contact.email).addClass('filled');
              $('.datahunter-confidence-value').text((contact.score * 100) + '% confidence.');
              $('.datahunter-confidence-bar div').css('width', (contact.score * 100) + '%').parent().addClass('filled');
              if (contact.catch_all) $('.datahunter-message').text('We\'re not sure that this is the real email but you can use it.');
              $('.datahunter-close').text('Close').prop("disabled", false);
              $('.datahunter-submit').text('Save').prop("disabled", false);
            }, 500);
          } else {
            checkService(names, domain, true);
          }
        } else {
          if (++i < alternatives.length) {
            if (!cancelFind) newAlternativeSearch(i);
          } else emailNotFound();
        }
      }).fail(function (response) {
        if (++i < alternatives.length) {
          if (!cancelFind) newAlternativeSearch(i);
        } else emailNotFound();
      });
    });
  };
  var emailNotFound = function () {
    if (!cancelFind) checkService(names, domain);
  };
  newAlternativeSearch(0);
}

function checkService (names, domain, found) {
  NProgress.inc();
  ajax = $.ajax({
    url: 'https://api.anymailfinder.com/v3.0/search/person.json',
    dataType : "json",
    headers: { "X-Api-Key": "ddf14ff51fd91749a7898d5259f81e0605ae2cbd" },
    method: "POST",
    data: {name: names.join(' '), domain: domain}
  }).done(function (response) {
    if (response.status === 'success' && response.email_class === 'validated') {
      $('.datahunter-close').prop("disabled", true);
      ajax = null;
      NProgress.done();
      contact.email = response.best_guess;
      contact.catch_all = false;
      contact.score = 1;
      setTimeout(function() {
        $('.datahunter-email').text(contact.email).addClass('filled');
        $('.datahunter-confidence-value').text('100% confidence.');
        $('.datahunter-confidence-bar div').css('width', '100%').parent().addClass('filled');
        $('.datahunter-close').text('Close').prop("disabled", false);
        $('.datahunter-submit').text('Save').prop("disabled", false);
      }, 500);
    } else if (response.status === 'success') {
      $('.datahunter-close').prop("disabled", true);
      ajax = null;
      NProgress.done();
      contact.email = response.best_guess;
      contact.catch_all = true;
      contact.score = 0.66;
      setTimeout(function() {
        $('.datahunter-email').text(contact.email).addClass('filled');
        $('.datahunter-confidence-value').text((contact.score * 100) + '% confidence.');
        $('.datahunter-confidence-bar div').css('width', (contact.score * 100) + '%').parent().addClass('filled');
        $('.datahunter-message').text('We\'re not sure that this is the real email but you can use it.');
        $('.datahunter-close').text('Close').prop("disabled", false);
        $('.datahunter-submit').text('Save').prop("disabled", false);
      }, 500);
    } else if (found) {
      $('.datahunter-close').prop("disabled", true);
      ajax = null;
      NProgress.done();
      setTimeout(function() {
        $('.datahunter-email').text(contact.email).addClass('filled');
        $('.datahunter-confidence-value').text((contact.score * 100) + '% confidence.');
        $('.datahunter-confidence-bar div').css('width', (contact.score * 100) + '%').parent().addClass('filled');
        $('.datahunter-message').text('We\'re not sure that this is the real email but you can use it.');
        $('.datahunter-close').text('Close').prop("disabled", false);
        $('.datahunter-submit').text('Save').prop("disabled", false);
      }, 500);
    } else {
      NProgress.done();
      setTimeout(function() {
        $('.datahunter-message').text('The email hasn\'t been found.');
        $('.datahunter-close').text('Close');
        $('.datahunter-submit').prop("disabled", false);
      }, 500);
    }
  }).fail(function (response) {
    if (!cancelFind && response.responseJSON.status === 'unauthorized' && response.responseJSON.error === 'too_many_requests') {
      console.log('You don\'t have credits on anymailfinder.');
    }
    if (!cancelFind && response.responseJSON.status === 'error' && response.responseJSON.error === 'not_found') {
      console.log('The email hasn\'t been found on anymailfinder.');
    }
    if (!cancelFind) {
      NProgress.done();
      setTimeout(function() {
        $('.datahunter-message').text('The email hasn\'t been found.');
        $('.datahunter-close').text('Close');
        $('.datahunter-submit').prop("disabled", false);
      }, 500);
    }
  });
}

$(function() {
  $.widget( "custom.catcomplete", $.ui.autocomplete, {
    _create: function() {
      this._super();
      this.widget().menu( "option", "items", "> :not(.ui-autocomplete-category)" );
    },
    _renderMenu: function( ul, items ) {
      var that = this,
        currentCategory = "";
      $.each( items, function( index, item ) {
        var li;
        if ( item.category != currentCategory ) {
          ul.append( "<li class='ui-autocomplete-category'>" + item.category + "</li>" );
          currentCategory = item.category;
        }
        li = that._renderItemData( ul, item );
        if ( item.category ) {
          li.attr( "aria-label", item.category + " : " + item.name );
        }
      });
    }
  });
});

var normalize = (function() {
  var from = "ãàáäâåèéëêìíïîòóöôùúüûñçẉẹṛṭỵụịọạṣḍḥḳḷẓṿḅṇṃẅẗÿḧẍẃýṕśǵḱĺźǘńḿŷŝĝĥĵẑĉẁỳǜǹ",
      to   = "aaaaaaeeeeiiiioooouuuuncwertyuioasdhklzvbnmwtyhxwypsgklzvnmysghjzcwyvn",
      mapping = {};
 
  for (var i = 0, j = from.length; i < j; i++ ) mapping[from.charAt(i)] = to.charAt(i);
 
  return function(str) {
    var ret = [];
    for (var i = 0, j = str.length; i < j; i++) {
      var c = str.charAt(i);
      if(mapping.hasOwnProperty(str.charAt(i))) ret.push( mapping[ c ] );
      else ret.push( c );
    }      
    return ret.join('');
  }
})();

$(document).on("click", ".datahunter-change", function () {
  $(this).parent().removeClass('filled').addClass('change');
  $('.datahunter-submit').prop("disabled", true);
  if ($(this).parent().hasClass('datahunter-name')) {
    $(this).parent().find('input').val(contact.name);
  }
  if ($(this).parent().hasClass('datahunter-company')) {
    $(this).parent().find('input').val('');
  }
});

$(document).on("click", ".datahunter-ok", function () {
  var currentValue = $(this).parent().find('input').val();
  if (currentValue != '') $(this).parent().find('span').text(currentValue);
  $(this).parent().removeClass('change').addClass('filled');
  if ($(this).parent().hasClass('datahunter-name') && currentValue != '') {
    contact.name = $(this).parent().find('input').val();
  }
  if ($(this).parent().hasClass('datahunter-company') && currentValue != '') {
    if (contact.companyTmp) contact.companyId = contact.companyTmp;
    if (contact.companyTypeTmp) contact.companyType = contact.companyTypeTmp;
    if (contact.companyDomainTmp) contact.companyDomain = contact.companyDomainTmp;
  }
  if (contact.name && contact.companyId) {
    $('.datahunter-submit').prop("disabled", false);
  }
});

$(document).on("click", ".datahunter-cancel", function () {
  $(this).parent().removeClass('change').addClass('filled');
  $('.datahunter-submit').prop("disabled", !(contact.name && contact.companyId));
});

$(document).on("click", ".datahunter-submit", function () {
  if ($(this).text() === 'Search') {
    if (!contact.name) {
      $('.datahunter-message').text('You must enter a name.');
      return;
    }
    if (!contact.companyDomain) {
      $('.datahunter-message').text('You must choose a company.');
      return;
    }
    findEmail(contact.name, contact.companyDomain);
  } else {
    $('.datahunter-message').text('').removeClass('success');
    $('.datahunter-close').text('Cancel');
    $('.datahunter-submit').prop("disabled", true);
    NProgress.start();
    if (contact.linkedinName && contact.photo && contact.email && contact.companyId) {
      $.ajax({
          url: apiUrl + "/api/contacts",
          dataType : "json",
          method: "POST",
          data: contact
      }).done(function(data) {
        NProgress.done();
        setTimeout(function() {
          $('.datahunter-message').text('Saved!').addClass('success');
          $('.datahunter-close').text('Close');
          $('.datahunter-submit').text('Search').prop("disabled", false);
        }, 500);
      }).fail(function(response) {
        NProgress.done();
        setTimeout(function() {
          $('.datahunter-message').text(response.responseJSON.error);
          $('.datahunter-close').text('Close');
          $('.datahunter-submit').prop("disabled", false);
        }, 500);
      });
    } else {
      NProgress.done();
      setTimeout(function() {
        $('.datahunter-message').html('We have some problems.<br>Please refresh your page and try again.');
        $('.datahunter-close').text('Close');
        $('.datahunter-submit').prop("disabled", false);
      }, 500);
    }
  }
});

$(document).on("click", ".close", function () {
  chrome.runtime.sendMessage({close: true});
});

$(document).on("click", ".datahunter-close", function () {
  if ($(this).text() === 'Close') {
    chrome.runtime.sendMessage({close: true});
  } else {
    cancelFind = true;
    ajax.abort();
    NProgress.done();
    setTimeout(function() {
      $('.datahunter-message').text('The search was cancelled.');
      $('.datahunter-close').text('Close');
      $('.datahunter-submit').prop("disabled", false);
    }, 500);
  }
});
