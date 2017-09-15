import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {Link} from 'react-router';
import moment from 'moment';
import * as tourActions from '../../../redux/ducks/tours';

var leave_completed = null, tour_removed = null, tourUpdated = null;

function htmlEncode(value){
  return $('<div/>').text(value).html();
}

function htmlDecode(value){
  return $('<div/>').html(value).text();
}

class TourNormal extends Component {
  constructor(props, context) {
    super(props, context);
    this.leaveTour = this.leaveTour.bind(this);
    tourUpdated = null;
  }

  leaveTour(e, charged) {
    e.preventDefault();
    let {dispatch, tour, auth} = this.props;
    let {user} = auth;
    if (confirm("Do you really want to leave this tour?")) {
      if (charged === 2) {
        alert('Can\'t left this tour because is already confirmed.');
        /*if (confirm("The total amount was charged and will not be refunded. Sure?")) { 
          dispatch(tourActions.leaveTour({_id: tour._id}));
          leave_completed = false;
          tour_removed = tour._id;
        }*/
      } else if (charged === 1) {
        if (confirm("The 10% that was charged will not be refunded. Sure?")) { 
          dispatch(tourActions.leaveTour({_id: tour._id}));
          leave_completed = false;
          tour_removed = tour._id;
        }
      } else {
        dispatch(tourActions.leaveTour({_id: tour._id}));
        leave_completed = false;
        tour_removed = tour._id;
      }
    }
  }

  componentWillReceiveProps(nextProps) {
    let {tour, _id} = this.props;
    if (leave_completed === false && !nextProps.tours.loading && nextProps.tours.error) {
      alert(nextProps.tours.error);
      leave_completed = true;
    }
    if (leave_completed === false && !nextProps.tours.loading && !nextProps.tours.error) {
      jQuery.notifyBar({
        html: "You left the tour. We hope to see you on another tour very soon!",
        delay: 3000,
        waitingForClose: false,
        close: true,
        animationSpeed: "normal",
      });
      if (window.location.pathname.indexOf('/tours') >= 0) {
        tourUpdated = nextProps.tours.tour;
      } else {
        $("#article_" + tour_removed).fadeOut();
      }
      leave_completed = true;
      tour_removed = null;
    }
  }

  render() {
    let {tour, auth} = this.props;
    if (tourUpdated) tour = tourUpdated;

    let {user} = auth;

    let hurry = null;

    let people_joined = 0;

    let owner = false;
    let charged = 0;

    tour.joined.forEach((joined)=> {
      people_joined = people_joined + joined.spots
      if (user && joined.user == user._id.toString()) {
        owner = true;
        if (joined.charged1 === 1) charged = 1;
        if (joined.charged2 === 1) charged = 2;
      }
    });

    if (tour && tour.joined) {
      if (tour.max_people - people_joined <= 3) {
        hurry = tour.max_people - people_joined;
      }
    }

    let description_cleaned = htmlDecode(tour.full_description);
    let description_added = description_cleaned.length > 150 ? '...' : '';
    description_cleaned = description_cleaned.substring(0, 150) + description_added;
    let tour_image = tour.photos && tour.photos.length ? tour.photos[0]: '/img/suggestion-placeholder.jpg';

    return (
      <article className="col-md-6 col-lg-4 article has-hover-s1 thumb-full" id={"article_" + tour._id}>
        <div className="thumbnail">
          {hurry !== null && hurry > 0 && !tour.closed ? (
            <div className="availability">
              Only <strong>{hurry}</strong> left!
            </div>
          ) : null}
          <Link to={`/tour/${tour.slug}`} className="img-wrap" onClick={(e)=>{ if (tour.canceled) { e.preventDefault(); } }}>
            <div className="photo-thumbnail" style={{backgroundImage:'url(' + tour_image + ')'}}></div>
            <div className="tour-date">
              <i className="fa fa-calendar"></i>
              &nbsp; Departure: {moment(tour.start_date).format('MMMM Do YYYY')}
            </div>
          </Link>
          <h3 className="small-space"><Link to={`/tour/${tour.slug}`} onClick={(e)=>{ if (tour.canceled) { e.preventDefault(); } }}>{tour.title}</Link></h3>
          <h5 className="small-space"><Link
            to={`/tour/${tour.slug}`} onClick={(e)=>{ if (tour.canceled) { e.preventDefault(); } }}>{tour.city && tour.city._id ? tour.city.name : '--'}
            &nbsp;- {tour.country && tour.country._id ? tour.country.name : '--'}</Link></h5>
          <span className="info">{description_cleaned}</span>
          {!tour.confirmed && !tour.canceled && owner ? (
            <a href="#" onClick={(e)=>{this.leaveTour(e, charged)}} className="btn btn-default">Leave this tour!</a>
          ) : (!user || (user && user.kind === 'tourist') ? (
            <Link to={`/tour/${tour.slug}`} onClick={(e)=>{ if (tour.canceled) { e.preventDefault(); } }} className="btn btn-default">{tour.confirmed ? 'Tour Closed' : (tour.canceled ? 'Tour Canceled' : (tour.closed || people_joined - tour.max_people >= 0 ? 'SOLD OUT!' : 'Join this tour!'))}</Link>
          ) : (
            <Link to={`/tour/${tour.slug}`} onClick={(e)=>{ if (tour.canceled) { e.preventDefault(); } }} className="btn btn-default">{tour.canceled ? 'Tour Canceled' : 'View Tour'}</Link>
          ))}
          <aside className="meta">
													<span className="country">
														<span className="icon-user"> </span>{people_joined}/{tour.max_people} members
													</span>
													<span className="activity">
														<span
                              className="fa fa-dollar"></span> from <strong>${tour.price_per_person || '0'}</strong>
													</span>
          </aside>
        </div>
      </article>
    )
  }
}

TourNormal.propTypes = {
  tour: PropTypes.object.isRequired,
};

function mapStateToProps(store) {
  return {
    auth: store.auth,
    tours: store.tours
  };
};

export default connect(mapStateToProps)(TourNormal);