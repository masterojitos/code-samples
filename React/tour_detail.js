import React, {Component, PropTypes} from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import {connect} from 'react-redux';
import moment from 'moment';
import * as tourActions from '../../redux/ducks/tours';
import * as bookActions from '../../redux/ducks/book';
import * as tourMessagesActions from '../../redux/ducks/tourmessages';
import * as reviewActions from '../../redux/ducks/reviews';
import classnames from 'classnames';
import {Link} from 'react-router';
import RawHTML, {p as RawP} from 'react-raw-html';
var HtmlToReactParser = require('html-to-react').Parser;
import CropPhoto from '../components/Tour/components/CropPhoto';

class TourDetail extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      loading: true,
      persons: 1,
      loadingRequest: false,
      rating: 0,
      request: null,
      voting: false,
      photos: [],
      fileTmp: null,
      s3callback: null,
      photoTmp: null,
      cropInstance: null
    };

    this.handleBooking = this.handleBooking.bind(this);
    this.postMessage = this.postMessage.bind(this);
    this.postReview = this.postReview.bind(this);
    this.setRating = this.setRating.bind(this);
    this.handleVote = this.handleVote.bind(this);
    this.handleToggleModal = this.handleToggleModal.bind(this);
    this.handlePhotos = this.handlePhotos.bind(this);
  }

  setRating(rating) {
    this.setState({
      rating,
    });
  }

  handlePhotos(photo) {
    let photos = this.state.photos.map(p=> p);
    photos.push(photo);
    this.setState({photos});
  }

  componentWillMount() {
    let {dispatch} = this.props;
    let {slug} =this.props.params;
    dispatch(tourActions.getTourBySlug(slug));

  }

  onChangePhoto(file, callback) {
    let reader = new FileReader();
    let self = this;
    if (this.state.cropInstance) {
      $('#tripeus_croparea img, #tripeus_croparea .croppr-container').remove();
    }
    reader.onloadend = () => {
      let img = new Image();
      img.src = reader.result;
      if ('image/jpeg,image/gif,image/png'.indexOf(file.type) < 0) {
        alert('Invalid file type.');
      } else if (file.size > (this.maxSize * 1024 * 1024)) {
        alert('The maximum file size is ' + this.maxSize + 'MB.');
      } else if (img.width < this.minWidth || img.height < this.minHeight) {
        alert('Tour photo must be at least ' + this.minWidth + ' by ' + this.minHeight + ' pixels.')
      } else if (img.width > this.minWidth || img.height > this.minHeight) {
        $('#tripeus_croparea').append(img);
        let cropInstance = new Croppr('#tripeus_croparea img', {
          aspectRatio: 1.14,
          // minSize: [this.minWidth, this.minHeight],
          startSize: [50, 50] //%
        });
        self.setState({fileTmp: file, s3callback: callback, photoTmp: img, cropInstance: cropInstance}); 
      } else {
        getSignedURL_image(file, callback);
      }
    }
    reader.readAsDataURL(file);
    $('#tripeus_cropPhoto').val('');
  }

  getImagePortion (imgObj, mimetype, newWidth, newHeight, startX, startY, ratio) {
    let canvas = document.createElement('canvas');
    let canvasContext = canvas.getContext('2d');
    canvas.width = newWidth; canvas.height = newHeight;
    let bufferCanvas = document.createElement('canvas');
    let bufferContext = bufferCanvas.getContext('2d');
    bufferCanvas.width = imgObj.width;
    bufferCanvas.height = imgObj.height;
    bufferContext.drawImage(imgObj, 0, 0);
    canvasContext.drawImage(bufferCanvas, startX, startY, newWidth * ratio, newHeight * ratio, 0, 0, newWidth, newHeight);
    return canvas.toDataURL(mimetype);
  }

  dataURLtoFile (dataurl, filename) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1], 
    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, {type:mime});
  }

  uploadPhoto (e) {
    e.preventDefault();
    let {fileTmp, s3callback, photoTmp} = this.state;
    let {x, y, width, height} = this.state.cropInstance.getValue();
    if (width <= 0 || height <= 0) {
      alert('You must select a crop area.');
    } else if (width < this.minWidth || height < this.minHeight) {
      alert('You must select a larger crop area.');
    } else {
      let newImgData = this.getImagePortion(photoTmp, fileTmp.type, width, height, x, y, 1);
      let newImgFile = this.dataURLtoFile(newImgData, fileTmp.name);
      $('#crop_photo').modal('toggle');
      $('#crop_photo img, #crop_photo .croppr-container').remove();
      getSignedURL_image(newImgFile, s3callback, true);
    }
  }

  componentDidUpdate() {
    if ($("#tour-slide")) {
      $("#tour-slide") // Tour Detail Carousel
        .owlCarousel({
          navigation: true,
          slideSpeed: 300,
          paginationSpeed: 400,
          singleItem: true,
          touchDrag: false,
          pagination: false,
          mouseDrag: false
        });
    }

    $('.same-height, .table tr')
      .each(function (i, el) {
        var $this = $(el);
        $this.find('.height, td .cell')
          .matchHeight({
            byRow: true
          });
      });

    jcf.setOptions('Select', {
      wrapNative: false,
      wrapNativeOnMobile: false
    });
    jcf.replaceAll();

    // Scroll Link
    if ($('.link-scroll').length) {
      $('.link-scroll').click(function (e) {
        e.preventDefault();
        var target = $(this).attr('href'),
          targetPos = $(target).offset().top - 160;
        $("html, body").animate({scrollTop: targetPos + "px"})
      });
    }

    // Star Rating
    if ($('.star-rater').length && !this.state.rating) {
      $('.star-rater > span').each(function () {
        $(this).hover(function () {
          $(this)
            .addClass('active')
            .prevAll().addClass('active');
        }, function () {
          $(this).removeClass('active');
        });
      });
      $('.star-rater').on('mouseleave', function () {
        $(this).find('span').removeClass('active');
      });
    }

    var $fancybox = $('.fancybox');
    if ($fancybox.length) {
      $fancybox.fancybox({
        padding: 0,
        margin: 0
      });
    }
  }

  componentDidMount() {
    $(window).scrollTop(0);
  }

  componentWillReceiveProps(nextProps) {
    let {dispatch} = this.props;
    let {slug} =this.props.params;
    if (this.state.loading && !nextProps.tours.loading && nextProps.tours.tour) {
      this.setState({
        loading: false,
      });
      dispatch(tourMessagesActions.getTourMessages(nextProps.tours.tour._id));
      dispatch(reviewActions.getTourReviews(nextProps.tours.tour._id));
    } else if (this.state.loading && !nextProps.tours.loading && nextProps.tours.error) {
      this.context.router.push('/');
    } else if (this.state.loadingRequest && !nextProps.tourmessages.loading && !nextProps.tourmessages.error && this.state.request === 'message') {

      this.setState({
        request: null,
        loadingRequest: false,
      });
      this.refs.message.value = '';
      if (nextProps.tours.tour && nextProps.tours.tour._id) {
        dispatch(tourMessagesActions.getTourMessages(nextProps.tours.tour._id));
      }


    } else if (this.state.loadingRequest && !nextProps.reviews.loading && !nextProps.reviews.error && this.state.request === 'review') {

      this.setState({
        request: null,
        loadingRequest: false,
      });
      //this.refs.message.value = '';
      if (nextProps.tours.tour && nextProps.tours.tour._id) {
        dispatch(reviewActions.getTourReviews(nextProps.tours.tour._id));
      }


    } else if (this.state.voting && !nextProps.tours.loading && !nextProps.tours.error) {
      this.setState({
        voting: false,
      });

      dispatch(tourActions.getTourBySlug(slug));
    }
  }

  handleBooking(e) {

    let {tours, auth, location} = this.props;


    console.log('auth', auth);

    if (auth && !auth.user) {

      $('#booking-modal').modal('toggle');
      return this.context.router.push(`/login/tourist?ref=/tour/${tours.tour.slug}`);
    }


    if (tours && tours.tour) {
      this.props.dispatch(bookActions.bookTour(this.state.persons, tours.tour._id));
      $('#booking-modal').modal('toggle');
      this.context.router.push('/tour/booking');
    }

  }

  handleMessage(e) {
    let {tours, auth, location} = this.props;
    if (auth && !auth.user) {
      return this.context.router.push(`/login/tourist?ref=/tour/${tours.tour.slug}`);
    }
    if (tours && tours.tour) {
      $('#post-message').modal('toggle');
    }
  }

  postMessage(e) {
    e.preventDefault();
    let {photos} = this.state;
    let {dispatch, tours} = this.props;


    let {message} = this.refs;
    let {tour} = tours;

    message = message.value.trim();

    dispatch(tourMessagesActions.postMessage({
      photos,
      message, tour: tour._id
    }));
    $('#post-message').modal('toggle');
    this.setState({
      request: 'message',
      loadingRequest: true,
      photos: []
    })


  }

  postReview(e) {
    e.preventDefault();
    let {rating} = this.state;

    if (rating === 0) {
      return alert('Please set a valid rating');
    }

    let {dispatch, tours} = this.props;


    let {review} = this.refs;
    let {tour} = tours;

    review = review.value.trim();

    dispatch(reviewActions.postReview({message: review, tour: tour._id, rating}));
    this.setState({
      request: 'review',
      rating: 0,
      loadingRequest: true,
    });

    this.refs.review.value = '';

    let targetPos = $('#rating-box').offset().top - 160;
    console.log('targetPos', targetPos);
    $("html, body").animate({scrollTop: targetPos + "px"})

  }

  handleVote(e) {
    e.preventDefault();

    let {auth, dispatch, tours} = this.props;
    let {user} = auth;
    let {tour} = tours;

    if (!user) {
      return this.context.router.push(`/login/tourist?ref=/tour/${tours.tour.slug}`);
    } else {
      if (!this.state.request) {
        dispatch(tourActions.handleVote(tour._id));
        this.setState({
          voting: true,
        })
      } else {
        alert("Waiting for response..");
      }

    }
  }

  handleToggleModal(e) {
    e.preventDefault();

    let {tours, auth, location} = this.props;


    console.log('auth', auth);

    if (auth && !auth.user) {
      //$('#booking-modal').modal('toggle');
      return this.context.router.push(`/login/tourist?ref=/tour/${tours.tour._id}`);
    } else {
      $('#booking-modal').modal('toggle');
    }

  }

  render() {

    let {loading} = this.state;
    if (loading) {
      return null;
    }

    let people_joined = 0;

    let {auth, tours, tourmessages, reviews} = this.props;

    let {tour} = tours;
    let {user} = auth;

    let {messages} = tourmessages;

    let tour_reviews = reviews.reviews || [];

    let current_rating = 0;

    let reviewer = null;

    tour.joined.forEach((joined)=> {
      people_joined = people_joined + joined.spots
      if (user && joined.user._id == user._id.toString()) reviewer = true;
    });

    if (user && !reviewer) reviewer = false;
    if (user && !tour.suggestion && user._id.toString() === tour.guide._id.toString()) reviewer = true;

    if (tour_reviews.length) {
      tour_reviews.forEach((tr, i)=> {
        current_rating += tr.rating;
      });

      current_rating = current_rating / tour_reviews.length;
      current_rating = Math.round(current_rating * 100) / 100;
    }

    let voted = (!user) ? false : tour.votes.indexOf(user._id.toString()) !== -1;

    let max_slots = tour.max_people - people_joined;

    let want_this = tour.others_suggesting ? tour.votes.length + tour.others_suggesting : tour.votes.length;

    var htmlInput = `<div>` + tour.full_description + `</div>`;
    var htmlToReactParser = new HtmlToReactParser();
    var descriptionComponent = htmlToReactParser.parse(htmlInput);

    let has_not_included = false;

    let show_buttons = true;


    if (user && user.kind !== 'tourist') {
      show_buttons = false;
    }

    return (

      <div>

        <div id="wrapper">
          <div className="page-wrapper">


            <Header transparent={false}/>
            <main id="main">

              <section className="container-fluid trip-info">
                <div className="same-height two-columns row">
                  <div className="height col-md-6">

                    <div id="tour-slide">
                      {tour.photos.length ? tour.photos.map((photo, i)=> {
                        return (
                          <div className="slide" key={i}>
                            <div className="bg-stretch bg-background" style={{"backgroundImage": "url(" + photo + ")"}}>
                            </div>
                          </div>
                        )
                      }) : (
                        <div className="slide">
                          <div className="bg-stretch">
                            <img src="/img/suggestion-placeholder.jpg" alt="image description" height="1104"
                                 width="966"/>
                          </div>
                        </div>
                      )}


                    </div>
                  </div>
                  <div className="height col-md-6 text-col">
                    <div className="holder">
                      <h1>{tour.title}</h1>

                      {!tour.suggestion ? (
                        <div className="author">
                          <span>Created by </span>
                          <a href={`/guide/${tour.guide.slug}`} className="user-profile user-profile-nav">
                            <figure className="nav-avatar" style={{"backgroundImage":"url('" + (tour.guide.profile_picture ? tour.guide.profile_picture : (tour.guide.guide_type === 'ngo' ? `/img/users/nonprofit.svg` : `/img/users/agency.svg`)) + "')", "margin":"0 5px"}}></figure>
                            <span>{tour.guide && tour.guide._id ? tour.guide.name : '--'}</span>
                          </a>
                        </div>
                      ) : (
                        <div className="author">
                          <span>Suggested by </span>
                          <a href={`/tourist/${tour.suggested_by.slug}`} className="user-profile user-profile-nav">
                            <figure className="nav-avatar" style={{"backgroundImage":"url('" + (tour.suggested_by.profile_picture ? tour.suggested_by.profile_picture : '/img/users/tourist.svg') + "')", "margin":"0 5px"}}></figure>
                            <span>{tour.suggested_by && tour.suggested_by._id ? tour.suggested_by.name : '--'}</span>
                          </a>
                        </div>
                      )}

                      <h3>{tour.city && tour.city._id ? tour.city.name : '--'}
                        &nbsp;- {tour.country && tour.country._id ? tour.country.name : '--'}</h3>
                      <h4>Location : {tour.location}</h4>


                      <h3 className="date">
                        <i className="fa fa-calendar"></i>
                        &nbsp;{tour.allDay ? (<strong>{moment(tour.start_date).format('MMMM Do YYYY, h:mm a')}</strong>) : (
                        <strong>{moment(tour.start_date).format('MMMM Do YYYY, h:mm a')}</strong>)}
                        {tour.allDay ? null : ' to ' }
                        {tour.allDay ? null : (
                          <strong>{moment(tour.end_date).format('MMMM Do YYYY, h:mm a')}</strong>
                        )}


                      </h3>
                      {
                        /*

                         <div className="description">
                         <p>{tour.full_description}</p>
                         </div>
                         */
                      }


                      {!tour.suggestion && show_buttons ? (
                        <div className="price">
                          Cost per person: <strong>US
                          ${tour.price_per_person || '0'}</strong>
                        </div>
                      ) : null}


                      {show_buttons ? (
                        <div className="btn-holder">
                          {!tour.suggestion ? (max_slots > 0 && !tour.closed && !tour.confirmed ? (
                            <a
                              href="#"
                              onClick={this.handleToggleModal}
                              className="btn btn-lg btn-info"
                            >
                              BOOK NOW</a>
                          ) :
                            (tour.confirmed ? (<a href="#" onClick={e => e.preventDefault()} 
                              className="btn btn-lg btn-info" disabled>Tour Closed</a>) : null)
                            /*<Link to={`/tour/suggest/${tour.slug}`} className="btn btn-lg btn-info">WANT ONE LIKE THIS!</Link>*/
                          ) : (
                            <a
                              onClick={this.handleVote}
                              href="#"
                              className="btn btn-lg btn-info">
                              {voted ? 'Already Voted' : 'Upvote'}
                            </a>
                          )}


                          <div className="modal fade" id="booking-modal" tabIndex="-1" role="dialog"
                               aria-labelledby="myModalLabel">
                            <div className="modal-dialog" role="document">
                              <div className="modal-content">
                                <div className="modal-header">
                                  <button type="button" className="close" data-dismiss="modal" aria-label="Close"><span
                                    aria-hidden="true">&times;</span></button>
                                  <h4 className="modal-title" id="myModalLabel">Book this tour</h4>
                                </div>
                                <div className="modal-body">
                                  <h2 className="tour-title">{tour.title}</h2>

                                  <h3 className="date">
                                    <i className="fa fa-calendar"></i>
                                    &nbsp;<strong>{moment(tour.start_date).format('MMMM Do YYYY, h:mm a')}</strong>
                                    {tour.allDay ? null : ' to ' }
                                    {tour.allDay ? null : (
                                      <strong>{moment(tour.end_date).format('MMMM Do YYYY, h:mm a')}</strong>
                                    )}
                                  </h3>

                                  <form action="#" className="tour-booking">
                                    <span>I'm booking for&nbsp;</span>
                                    <div className="inline-select">
                                      <input
                                        onChange={e=>{
                                        let _persons = e.target.value;
                                        _persons = parseInt(_persons);







                                        if(_persons === 0){
                                           return alert('Please set a valid number of persons');
                                        }

                                       if(_persons > max_slots){
                                        return alert(`We only have ${max_slots} slots for this tour`);
                                       }




                                        this.setState({
                                          persons: _persons
                                        });
                                      }}
                                        min="1"
                                        max={max_slots}
                                        type="number" value={this.state.persons} name="people-qty"
                                        className="form-control"/>
                                    </div>
                                    <span>&nbsp;person(s)</span>
                                    <div className="price">
                                      Total cost: <strong>US
                                      ${(tour.price_per_person) ? tour.price_per_person * this.state.persons : '0'}</strong>
                                      &nbsp;({this.state.persons} person(s))
                                    </div>
                                  </form>
                                </div>
                                <div className="modal-footer">
                                  <p className="text-center">
                                    <button type="button" className="btn btn-info-sub btn-md"
                                            onClick={e =>{
                                            e.preventDefault();

                                            this.handleBooking();

                                          }}>Book Now
                                    </button>
                                  </p>
                                  <p className="text-center">
                                    <a href={"mailto:trips@tripeus.com?cc=alberto@texagency.com.pe&subject=I%20need%20more%20spots%20to%20tour/" + tour.slug}>Need more spots? Contact us here.</a>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}


                      <div className="users">
                        {tour.joined.map((joined, i) => {

                          return (
                            <a href={(joined.user.kind === 'tourist' ? `/tourist/`:`/guide/`).concat(`${joined.user.slug}`)}
                             key={i} className="user" data-plus={joined.spots}>
                              <img src={joined.user.profile_picture ? joined.user.profile_picture : '/img/users/tourist.svg'}
                               alt={joined.user.name} title={joined.user.name} />
                            </a>
                          )
                        })}

                        {!tour.suggestion && !tour.closed ? (
                          <p className="details">{people_joined} {people_joined == 1 ? 'person has' : 'people have'} joined this tour
                            {people_joined >= tour.min_people && tour.max_people - people_joined > 0 ? (
                              <strong> ({tour.max_people - people_joined} spot{tour.max_people - people_joined == 1 ? '' : 's'} left!)</strong>
                            ) : people_joined < tour.min_people ? (
                              <strong> ({tour.min_people - people_joined} more to go!)</strong>
                            ) : null}
                          </p>
                        ) : null}

                        {!tour.suggestion && tour.closed ? (
                          <p className="details">{people_joined} {people_joined == 1 ? 'person has' : 'people have'} joined this tour
                            {!tour.confirmed ? (<strong>&nbsp;&nbsp;(Sold Out!)</strong>) : null}
                          </p>
                        ) : null}

                        {tour.suggestion ? (
                          <p className="details">
                            {want_this === 0 ? '0 people want this tour' : want_this === 1 ? '1 person wants this tour!' : `${want_this} people want this tour!`}
                          </p>
                        ) : null}


                      </div>

                      {!tour.suggestion ? (
                        <ul className="reviews-info">

                          <li>
                            <div className="info-left">
                              <strong className="title">Tour's Rating</strong>
                              <span className="value">{tour.guide.tours_completed} tours completed</span>
                            </div>
                            <div className="info-right">
                              <div className="star-rating">
                                {[1, 2, 3, 4, 5].map((v, i)=> {
                                  return (
                                    <span className={classnames({
                                     'disable': v > current_rating
                                    })}><span className="icon-star"></span></span>
                                  );
                                })}
                              </div>
                              <span className="value">{current_rating}/5</span>
                            </div>
                          </li>
                          <li className="text-left">
                            <strong className="title">Activities</strong>
                            <ul className="details-list">
                              {tour.activities.map((a, i) => {
                                return <li key={i}>{a.name}</li>
                              })}
                            </ul>
                          </li>
                          <li className="text-left">
                            <strong className="title">What's included?</strong>
                            <ul className="details-list">
                              {tour.included.map((included, i)=> {
                                if (included.info === 'yes') {
                                  return (<li key={i}>{included.name}</li>);
                                } else if (included.optional) {
                                  return (<li
                                    key={i}>{included.name === "Pick up from hotel" ? `Meeting Point: ` : `` }{included.optional}</li>)
                                } else if (included.info === 'no') {
                                  has_not_included = true;
                                  return null;
                                } else {
                                  return null
                                }
                              })}
                              {tour.included_others ? (<li>{tour.included_others}</li>) : null}
                            </ul>
                          </li>


                          {has_not_included ? (
                            <li className="text-left">
                              <strong className="title">What's not included?</strong>
                              <ul className="details-list">
                                {tour.included.map((included, i)=> {
                                  if (included.info === 'no') {
                                    return (<li key={i}>{included.name}</li>);
                                  } else {
                                    return null;
                                  }
                                })}
                              </ul>
                            </li>

                          ) : null}

                          <li className="text-left">
                            <strong className="title">Language{tour.language_spoken.length > 1 ? 's' : ''}&nbsp;
                              Offered:
                            </strong>
                            <ul className="details-list">
                              {tour.language_spoken.map((a, i) => {
                                return <li key={i}>{a.name}</li>
                              })}
                            </ul>
                          </li>

                          <li>
                            <div className="info-left">
                              <strong className="title">Participants</strong>
                              <span className="value">Joined / Max</span>
                            </div>
                            <div className="info-right">
                              <ul className="ico-list">
                                <li>
                                  <span className="icon icon-group-small"></span>
                                </li>
                                <li>
                                  <span className="icon icon-group-medium"></span>
                                </li>
                                <li>
                                  <span className="icon icon-group-large"></span>
                                </li>
                              </ul>
                              <span className="value">{people_joined}/{tour.max_people}</span>
                            </div>
                          </li>


                        </ul>
                      ) : null}


                      <ul className="social-networks social-share">
                        <li>
                          <a href={"https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(window.location.href) + "&t=Tour%20to%20" + encodeURIComponent(tour.title) + "%20on%20" + window.location.hostname} 
                          target="_blank" title="Share on Facebook" className="facebook">
                            <span className="ico">
                              <span className="icon-facebook"></span>
                            </span>
                            <span className="text">Share</span>
                          </a>
                        </li>
                        <li>
                          <a href={"https://twitter.com/share?url=" + encodeURIComponent(window.location.href) + "&via=tripeus&text=Tour%20to%20" +encodeURIComponent(tour.title) + "%20on%20"} 
                          target="_blank" title="Share on Twitter" className="twitter">
                            <span className="ico">
                              <span className="icon-twitter"></span>
                            </span>
                            <span className="text">Tweet</span>
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
              <div className="tab-container">
                <nav className="nav-wrap" id="sticky-tab">
                  <div className="container">

                    <ul className="nav nav-tabs text-center" role="tablist">
                      <li role="presentation" className="active"><a href="#tab01" aria-controls="tab01" role="tab"
                                                                    data-toggle="tab">Overview</a></li>
                      <li role="presentation"><a href="#tab02" aria-controls="tab02" role="tab" data-toggle="tab">Gallery
                        ({tour.photos.length || '0'})</a>
                      </li>
                      {!tour.suggestion ? (
                        <li role="presentation">
                          <a href="#tab03" aria-controls="tab03" role="tab" data-toggle="tab">
                            Reviews ({tour_reviews.length || '0'})
                          </a>
                        </li>
                      ) : null}

                    </ul>
                  </div>
                </nav>

                <div className="container tab-content trip-detail">


                  <div role="tabpanel" className="tab-pane active" id="tab01">
                    <div className="row">
                      <div className="col-md-6">
                        <strong className="header-box">All about this tour</strong>
                        <div className="detail">

                          {descriptionComponent}
                        </div>
                      </div>
                      {tour.suggestion ? null : (
                        <div className="col-md-6">
                          <div className="header-box">
                            {reviewer === true ? (
                              <a href="#" className="link-right btn btn-info"
                                 onClick={e => { e.preventDefault(); this.handleMessage(); }}>Post a Message</a>
                            ) : reviewer === false ? null : (
                              <a href={"/login/tourist?ref=/tour/" + tour.slug} className="link-right btn btn-info">Post a Message</a>
                            )}
                            <span className="rate-left">
                              <strong className="title">Message Board</strong>
                            </span>

                            <div className="modal fade" id="post-message" tabindex="-1" role="dialog"
                                 aria-labelledby="myModalLabel">
                              <div className="modal-dialog" role="document">
                                <div className="modal-content booking-form">
                                  <form action="#" id="postMessageForm" onSubmit={this.postMessage}>
                                    <div className="modal-header">
                                      <button type="button" className="close" data-dismiss="modal"
                                              aria-label="Close"><span
                                        aria-hidden="true">&times;</span></button>
                                      <h4 className="modal-title" id="myModalLabel">Post New Message</h4>
                                    </div>
                                    <div className="modal-body">
                                    <textarea
                                      ref="message"
                                      required
                                      name="decline-comment" className="form-control"
                                      placeholder="Enter comment here" cols="30" rows="10"></textarea>
                                      <div className="file-uploader">
                                        <label>Image attachment</label>
                                        <CropPhoto handlePhotos={this.handlePhotos} submit="#post_message_button" inside={true} width="60" height="60" />
                                      </div>
                                      {this.state.photos.length ? (<hr />) : null}
                                      {this.state.photos.map((p, i) => {
                                        return (<img style={{width: '60px', height: '60px'}} src={p} key={i}/>)
                                      })}
                                    </div>
                                    <div className="modal-footer">
                                      <button type="submit" id="post_message_button"
                                              className="btn btn-info-sub btn-md">Post Message
                                      </button>
                                    </div>
                                  </form>
                                </div>
                              </div>
                            </div>

                          </div>
                          <div className="comments reviews-body">
                            <div className="comment-holder">
                              {messages ? messages.map((message, i)=> {

                                return (
                                  <div className="comment-slot" key={i}>
                                    <div className="thumb">
                                      <a href={(message.user.kind === 'tourist' ? `/tourist/`:`/guide/`).concat(`${message.user.slug}`)}>
                                        <img src={message.user.profile_picture ? message.user.profile_picture : (message.user.kind === 'tourist' ? `/img/users/tourist.svg` : (message.user.guide_type === 'ngo' ? `/img/users/nonprofit.svg` : `/img/users/agency.svg`))}
                                         height="50" width="50" alt={message.user.name} title={message.user.name} />
                                      </a>
                                    </div>
                                    <div className="text">
                                      <header className="comment-head">
                                        <div className="left">
                                          <strong className="name">
                                            <a
                                              href={(message.user.kind === 'tourist'? `/tourist/`:`/guide/`).concat(`${message.user.slug}`)}>{message.user.name}</a>
                                          </strong>
                                          <div className="meta">Posted
                                            on {moment(message.created_at).format('L')}</div>
                                        </div>
                                        <div className="right"></div>
                                      </header>
                                      <div className="des">
                                        <p>{message.message.split("\n").map((item) => {
                                          return (<span>{item}<br/></span>)
                                        })}</p>
                                      </div>
                                      {message.photos && message.photos.length ? (
                                        <div className="attachments">
                                          {message.photos.map((photo, k)=> {
                                            console.log('photo', photo);
                                            console.log('k', k);
                                            return (
                                              <a key={k} className="fancybox" data-fancybox-group={"message" + i}
                                                 href={photo}>
                                                <img src={photo} alt=""/>
                                              </a>
                                            )
                                          })}

                                        </div>
                                      ) : null}

                                    </div>
                                  </div>
                                )
                              }) : null}

                            </div>
                            {false ? (
                              <div className="link-more text-center">
                                <a href="#">Show More Messages - 75 Messages</a>
                              </div>
                            ) : null}

                          </div>
                        </div>
                      )}

                    </div>
                  </div>


                  <div role="tabpanel" className="tab-pane" id="tab02">
                    <ul className="row gallery-list has-center">
                      {tour && tour.photos ?
                        tour.photos.map((photo, i)=> {
                          return (
                            <li className="col-sm-6" key={i}>
                              <a className="fancybox" data-fancybox-group="group" href={photo}
                              >
                    <span className="img-holder">
                      <img src={photo} height="750" width="450" alt="image description"/>
                    </span>
                    <span className="caption">
                      <span className="centered">
                        <strong className="title">{tour.location}</strong>
                        <span className="sub-text">{tour.city && tour.city.name ? tour.city.name : '--'}</span>
                      </span>
                    </span>
                              </a>
                            </li>
                          )
                        }) : null}


                    </ul>
                  </div>


                  <div role="tabpanel" className="tab-pane" id="tab03">
                    <div className="narrow-content">
                      <div className="header-box">
                        {tour.completed ? reviewer === true ? (
                          <a href="#review-form" className="link-right btn btn-info link-scroll">Write a Review</a>
                        ) : reviewer === false ? null : (
                          <a href={"/login/tourist?ref=/tour/" + tour.slug} className="link-right btn btn-info">Write a Review</a>
                        ) : null}
                        {tour.completed || (tour_reviews && tour_reviews.length) ? (
                        <span className="rate-left">
                          <strong className="title">Overall Rating</strong>
                          <span className="star-rating">
                            {[1, 2, 3, 4, 5].map((v, i)=> {
                              return (
                                <span className={classnames({
                                 'disable': v > current_rating
                                })}><span className="icon-star"></span></span>
                              );
                            })}
                          </span>
                          <span className="value">{current_rating}/5</span>
                        </span>
                        ) : (
                        <span className="rate-left">
                          <strong className="title">No reviews yet</strong>
                        </span>
                        )}
                      </div>
                      {(tour_reviews && tour_reviews.length) || (reviewer && tour.completed) ? (
                      <div id="rating-box" className="comments reviews-body">
                        {tour_reviews && tour_reviews.length ? (
                          <div className="comment-holder">
                            {tour_reviews.map((review, i)=> {

                              return (
                                <div className="comment-slot" key={i}>
                                  <div className="thumb">
                                    <a href={"/tourist/" + review.user.slug}><img src={review.user.profile_picture ? review.user.profile_picture: `/img/users/tourist.svg`} 
                                      height="50" width="50" alt="image description"/></a>
                                  </div>
                                  <div className="text">
                                    <header className="comment-head">
                                      <div className="left">
                                        <strong className="name">
                                          <a href={"/tourist/" + review.user.slug}>{review.user.name}</a>
                                        </strong>
                                        <div className="meta">Reviewed
                                          on {moment(review.created_at).format('L')}</div>
                                      </div>
                                      <div className="right">
                                        <div className="star-rating">
                                          {[1, 2, 3, 4, 5].map((v, i)=> {
                                            return (
                                              <span className={classnames({
                                                'disable': v > review.rating,
                                              })}><span className="icon-star"></span></span>
                                            )
                                          })}
                                        </div>
                                        <span className="value">{review.rating}/5</span>
                                      </div>
                                    </header>
                                    <div className="des">
                                      <p>{review.message.split("\n").map((item) => {
                                        return (<span>{item}<br/></span>)
                                      })}</p>
                                      {false ? (
                                        <div className="link-holder">
                                          <a href="#">Read Full Review</a>
                                        </div>
                                      ) : null}

                                    </div>
                                  </div>
                                </div>
                              )
                            })}


                          </div>
                        ) : null}

                        {false ? (
                          <div className="link-more text-center">
                            <a href="#">Show More Reviews - 75 Reviews</a>
                          </div>
                        ) : null}

                        {reviewer && tour.completed ? (
                          <div className="write-review reviews-body" id="review-form">
                            <h3>Write a review</h3>
                            <form onSubmit={this.postReview}>
                              <label>Your rating: </label>
                              <span className="star-rating star-rater big">
                                {[1, 2, 3, 4, 5].map((v, i)=> {
                                  return (
                                    <span className={classnames({
                                      'disable': v > this.state.rating,
                                    })}><a href="#" onClick={(e)=>{
                                      e.preventDefault();
                                      this.setRating(v);
                                    }} className="icon-star"></a></span>
                                  )
                                })}
                              </span>
                              <p className="margin-top">
                                <textarea
                                  required
                                  ref="review"
                                  name="" id="" cols="30" rows="10" placeholder="Say a little something"
                                  className="form-control"></textarea>
                              </p>
                              <p className="text-right">
                                <button type="submit" className="btn btn-info-sub btn-md">Send review</button>
                              </p>
                            </form>
                          </div>
                        ) : null}

                      </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>


            </main>
          </div>
          <Footer />
        </div>

      </div>
    )
  }
}

TourDetail.contextTypes = {
  router: PropTypes.object,
};
TourDetail.propTypes = {
  dispatch: PropTypes.func.isRequired,
};

function mapStateToProps(store) {
  return {
    auth: store.auth,
    tours: store.tours,
    tourmessages: store.tourmessages,
    reviews: store.reviews,
  };
};


export default connect(mapStateToProps)(TourDetail);
