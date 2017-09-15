$(function(){
    var mo_api_url = 'https://apisc.teclalabs.com/api';

    //Get Tracks and Industries
    var mo_tracks = [],
        mo_option_tracks = [],
        mo_industries = [],
        mo_option_industries = [];
    $.ajax({
        url: mo_api_url + '/scraping/tracks/',
        dataType: "json",
        async: false
    }).done(function(response) {
        mo_tracks = response.tracks;
        mo_industries = response.industries;
    }).fail(function(response) {
        console.log(response.responseJSON.error);
    });
    if (!mo_tracks.length || !mo_industries.length) {
        alert('Tracks or Industries not found.');
        return false;
    }
    $.each(mo_tracks, function(key, mo_track) {
        mo_option_tracks.push('<option value="' + mo_track._id + '">' + mo_track.name + '</option>');
    });
    $.each(mo_industries, function(key, mo_industry) {
        mo_option_industries.push('<option value="' + mo_industry._id + '">' + mo_industry.name + '</option>');
    });

    //Get Companies
    var mo_companies = [], mo_companies_list = [];
    $('#background-experience .current-position').each(function() {
        if ($('h5.experience-logo', this).length > 0) {
            mo_companies.push({
                name: $('h4', this).next().text(),
                image: $('h5.experience-logo img', this).attr('src')
            });        
        } else {
            mo_companies.push({
                name: $('h4', this).next().text()
            });
        }
    });
    if (!mo_companies.length) {
        alert("Companies not found.");
        return false;
    }
    $.each(mo_companies, function(key, mo_company) {
        mo_companies_list.push('<input type="checkbox" class="mo_company" value="' + key + '" checked /> <input type="text" value="' + mo_company.name + '" style="width: 200px;" /> <select id="mo_industry' + key + '" style="display: inline-block; width: 200px;"><option value="0">Select a Industry</option>' + mo_option_industries.join('') + '</select><br />');
    });

    //Get Skills
    var mo_skills = [], mo_skills_list = [], mo_linkedin = document.location.search;
    var mo_linkedin_id = $('.masthead').attr('id').split('-')[1];
    $('.skill-pill .endorse-item-name-text').each(function() {
        mo_skills.push($(this).text());
    });
    if (!mo_skills.length) {
        alert("Skills not found.");
        return false;
    }
    $.each(mo_skills, function(key, mo_skill) {
        mo_skills_list.push('<span style="background-color: #eee; border: 1px solid #ccc; border-radius: 5px; box-shadow: 0 0 5px 0 #999; color: #333; display: inline-block; margin: 0 10px 10px 0; padding: 3px 10px;">' + mo_skill + ' <a href="#" class="mo_remove_skill" style="color: #666; font-size: 1.2em; font-weight: 700; margin-left: 5px; text-decoration: none;">x</a></span>');
    });

    //Display Modal
    var mo_modal = $.parseHTML('<div id="mo_modal_overlay" style="background: rgba(0, 0, 0, 0.7); height: 100%; left: 0; position: fixed; top: 0; width: 100%; z-index: 920;"></div><div id="mo_modal_box" style="background: white; background-clip: padding-box; border: 1px solid rgba(0, 0, 0, 0.1); border-bottom: 1px solid #aaa; border-radius: 4px; box-shadow: 0 3px 9px rgba(0, 0, 0, 0.5); font-family: helvetica; left: 50%; font-size: 16px; margin-left: -500px; position: fixed; top: 10%; width: 1000px; z-index: 940;"><header style="border-bottom: 1px solid #ddd; padding: 1em;"><a href="#" id="mo_modal_close" style="font-size: 2em; position: absolute; right: 0.5em; text-decoration: none; top: 0.25em;">x</a><h2 style="margin: 0;">SkillClub - <small>Track info by Linkedin Profile</small></h3></header><div id="mo_modal_body" style="padding: 1em;"><p id="mo_error" style="color: #f00; margin-bottom: 1em;"></p><label style="display: inline-block; font-weight: 700; margin: 0 1em 0.25em 0;">Track</label><select id="mo_track_id" style="display: inline-block; width: 300px;"><option value="0">Select a Track</option>' + mo_option_tracks.join('') + '</select><br /><br /><label style="display: block; font-weight: 700; margin-bottom: 0.25em;">Companies</label><p id="mo_companies_container">' + mo_companies_list.join('') + '</p><label style="display: block; font-weight: 700; margin-bottom: 0.25em; margin-top: 2em;">Skills</label><p id="mo_skills_container">' + mo_skills_list.join('') + '</p><p id="mo_result"></p></div><div style="border-top: 1px solid #ddd; padding: 1em; text-align: right;"><a href="#" id="mo_modal_submit" style="font-size: 1.2em; text-decoration: none;">Submit</a></div></div>');
    $('body').append(mo_modal);
    $('#mo_modal_close').on('click', function(e) {
        e.preventDefault();
        $('#mo_modal_box').fadeOut(500, function() {
            $('#mo_modal_overlay, #mo_modal_box').remove();
        });
    });
    var mo_old_skill;
    $('#mo_skills_container .mo_remove_skill').on('click', function(e) {
        e.preventDefault();
        mo_old_skill = $(this).parent();
        mo_skills.splice(mo_old_skill.index(), 1);
        mo_old_skill.remove();
    });
    $('#mo_modal_submit').on('click', function(e) {
        e.preventDefault();
        var exit = false;
        mo_track_id = $('#mo_track_id').val();
        if (mo_track_id == 0) {
            $('#mo_error').text('Please, Select a Track.');
            return;
        }
        var mo_final_companies = [];
        $('#mo_companies_container .mo_company:checked').each(function() {
            mo_companies[this.value].name = $(this).next().val();
            mo_companies[this.value].industry = $(this).next().next().val();
            if (mo_companies[this.value].industry == 0) {
                $('#mo_error').text('Please, Select a Industry for ' + mo_companies[this.value].name + '.');
                exit = true;
                return false;
            }
            mo_final_companies.push(mo_companies[this.value]);
        });
        if (exit) return;
        if (mo_final_companies.length === 0) {
            $('#mo_error').text('Please, Select a Company.');
            return;
        }
        if (mo_skills.length === 0) {
            $('#mo_error').text('Please, refresh the page and try again. The skills are required.');
            return;
        }
        $.ajax({
            url: mo_api_url + '/scraping/tracks/',
            type: "POST",
            data: {
                track_id: mo_track_id,
                companies: mo_final_companies,
                skills: mo_skills,
                source: {type: "linkedin", linkedin_id: mo_linkedin_id}
            },
            dataType: "json",
            async: false
        }).done(function(response) {
            $('#mo_modal_close').trigger('click');
        }).fail(function(response) {
            console.log(response.responseJSON.error);
        });
    });
});
