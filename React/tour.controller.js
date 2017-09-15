/**
 * Using Rails-like standard naming convention for endpoints.
 * GET     /api/tours              ->  index
 * POST    /api/tours              ->  create
 * GET     /api/tours/:id          ->  show
 * PUT     /api/tours/:id          ->  update
 * DELETE  /api/tours/:id          ->  destroy
 */

'use strict';

import _ from 'lodash';
import Tour from './tour.model';
import {getActivityIDs} from '../activity/activity.controller';
import async from 'async';
import * as TourMessageController from '../tourmessage/tourmessage.controller';
import * as ReviewController from '../review/review.controller';
import * as UserController from '../user/user.controller';
import * as CityController from '../city/city.controller';
import * as SettingController from '../setting/setting.controller';
import * as emailController from '../../email.controller';
import moment from 'moment';
import {Types} from 'mongoose';
import ontime from 'ontime';
import config from '../../config/environment';

function respondWithResult(res, statusCode) {
  statusCode = statusCode || 200;
  return function (entity) {
    if (entity) {
      res.status(statusCode).json(entity);
    }
  };
}

function saveUpdates(updates) {
  return function (entity) {
    var updated = _.merge(entity, updates);
    return updated.save()
      .then(updated => {
        return updated;
      });
  };
}

function removeEntity(res) {
  return function (entity) {
    if (entity) {
      return entity.remove()
        .then(() => {
          res.status(204).end();
        });
    }
  };
}

function handleEntityNotFound(res) {
  return function (entity) {
    if (!entity) {
      res.status(404).end();
      return null;
    }
    return entity;
  };
}

function handleError(res, statusCode) {
  statusCode = statusCode || 500;
  return function (err) {
    res.status(statusCode).send(err);
  };
}

// Gets a list of Tours
export function index(req, res) {
  return Tour.find().exec()
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Gets a single Tour from the DB
export function show(req, res) {
  return Tour.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

export let getById = (id) => {
  return new Promise((resolve, reject)=> {
    Tour
      .find({
        _id: id
      })
      .limit(1)
      .populate({model: 'Activity', path: 'activities', select: '_id name'})
      .populate({model: 'User', path: 'guide', select: '_id name email kind slug profile_picture'})
      .populate({model: 'User', path: 'joined.user', select: '_id name email slug profile_picture'})
      .exec()
      .then(tourFound => {
        if (tourFound.length <= 0) {
          return reject({
            message: 'Tour doesnt exists'
          });
        } else {
          return resolve(tourFound[0]);
        }
      })
      .catch(e=> reject({
        message: 'Cant get tour detail',
      }));
  });
}

export function makeCharge(tour_id, step) {
  return new Promise((resolve, reject)=> {
    var stripe = require("stripe")("sk_test_oC1kYWvRj9Okc7zvMmBTKzxA");
    var tour = null;
    getById(tour_id)
      .then(tourFound => {
        async.each(tourFound.joined, (joined, cb) => {
          let charged = step === 1 ? joined.charged1 : joined.charged2;
          if (charged === 0) {
            let amount = 0;
            if (step === 1) {
              amount = (tourFound.price_per_person * joined.spots * 10) / 100;
            } else {
              amount = (tourFound.price_per_person * joined.spots * 90) / 100;
            }
            var charge = stripe.charges.create({
              amount: amount * 100, // Amount in cents
              currency: "usd",
              customer: joined.stripe_customer.id,
              description: 'charge step' + step + ' for tour ' + tourFound.title
            }, function (err, charge) {
              if (err) {
                console.log('charge tour fail for ' + joined.user._id + ': ', err);
                if (step === 1) {
                  joined.charged1 = 2;
                  emailController.tourist_tourChargedFail(joined.user, tourFound, amount, joined.spots);
                  emailController.guide_tourChargedFail(tourFound.guide, tourFound, joined.user, amount, joined.spots, 1);
                } else {
                  joined.charged2 = 2;
                  emailController.tourist_tourConfirmed(joined.user, tourFound, tourFound.price_per_person * joined.spots, joined.spots, false);
                  emailController.guide_tourChargedFail(tourFound.guide, tourFound, joined.user, amount, joined.spots, 2);
                }
              } else {
                console.log('charge success for ' + joined.user._id + ': ', charge);
                if (step === 1) {
                  joined.charged1 = 1;
                } else {
                  joined.charged2 = 1;
                  emailController.tourist_tourConfirmed(joined.user, tourFound, tourFound.price_per_person * joined.spots, joined.spots, charge.id);
                }
              }
              cb(null);
            });
          } else {
            cb(null);
          }
        }, (e) => {
          if (e) {
            reject(e);
          } else {
            tourFound.save();
            resolve();
          }
        });
      })
      .catch(e => reject(e));
  });
}

// Creates a new Tour in the DB
export function create(req, res) {
  let {body, userapp} = req;
  var tour_created = null;
  var tours_id_created = [];
  var tours_created = [];

  let newDates = body.dates.map(d=>d);

  if (body.frequency && body.frequency !== 'none' && newDates.length === 1) {
    let _date = newDates[0];

    if (body.frequency === 'daily') {
      for (var i = 1; i <= 30; i++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(i, 'days');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(i, 'days');
        }

        newDates.push(d);
      }


    } else if (body.frequency === 'weekly') {

      for (var w = 1; w <= 4; w++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(w, 'weeks');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(w, 'weeks');
        }

        newDates.push(d);
      }


    } else if (body.frequency === 'monthly') {
      for (var m = 1; m <= 4; m++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(m, 'months');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(m, 'months');
        }

        newDates.push(d);
      }

    }
  }

  let eachDate = (date, cb)=> {
    let {allDay, start_date, end_date} = date;


    if (allDay) {
      start_date = moment(start_date);
      start_date = start_date.hours(12).minutes(0).seconds(0).milliseconds(0);
    }

    Tour.create(Object.assign({}, body, {
      allDay,
      start_date,
      end_date,
      created_at: new Date(),
      public: true,
      from_multiple: newDates.length > 1
    }))
      .then((tourCreated)=> {
        console.log('tourCreated', tourCreated);
        if (!tour_created) tour_created = tourCreated;
        tours_id_created.push(tourCreated._id);
        tours_created.push(tourCreated);
        TourMessageController.createMessageAsync(tourCreated._id, userapp, body.tour_message)
          .then(()=> {
            console.log('Message Created');
          })
          .catch(()=> {
            console.log('Failed creating message');
          });
        cb(null)
      })
      .catch(()=>cb({message: 'Can not create the tour'}));
  };

  let afterEach = (e)=> {
    if (e) {
      return res.status(400).json(e);
    } else {
      UserController
        .getById(userapp)
        .then(userFound => {
          emailController.guide_tourCreated(userFound, tour_created);
        });

      tours_created.forEach(function (tourCreated) {
        tourCreated.sibling_tours = tours_id_created;
        tourCreated.save();
      });

      return res.json({created: true})
    }
  }

  async.each(newDates || [], eachDate, afterEach);
}

export function assignToTour(req, res) {
  let {body, userapp} = req;
  var tour_created = null;
  var tours_id_created = [];
  var tours_created = [];

  let newDates = body.dates.map(d=>d);

  if (body.frequency && body.frequency !== 'none' && newDates.length === 1) {
    let _date = newDates[0];

    if (body.frequency === 'daily') {
      for (var i = 1; i <= 30; i++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(i, 'days');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(i, 'days');
        }

        newDates.push(d);
      }


    } else if (body.frequency === 'weekly') {

      for (var w = 1; w <= 4; w++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(w, 'weeks');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(w, 'weeks');
        }

        newDates.push(d);
      }


    } else if (body.frequency === 'monthly') {
      for (var m = 1; m <= 4; m++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(m, 'months');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(m, 'months');
        }

        newDates.push(d);
      }

    }
  }

  let eachDate = (date, cb)=> {
    let {allDay, start_date, end_date} = date;

    Tour.create(Object.assign({}, body, {
      from_suggestion: true,
      tour_suggested: body.tour_suggested,
      allDay,
      start_date,
      end_date,
      created_at: new Date(),
      public: true,
      from_multiple: newDates.length > 1
    }))
      .then((tourCreated)=> {
        console.log('tourCreated', tourCreated);
        if (!tour_created) tour_created = tourCreated;
        tours_id_created.push(tourCreated._id);
        tours_created.push(tourCreated);
        TourMessageController.createMessageAsync(tourCreated._id, userapp, body.tour_message)
          .then(()=> {
            console.log('Message Created');
          })
          .catch(()=> {
            console.log('Failed creating message');
          });
        cb(null)
      })
      .catch(()=>cb({message: 'Can not create the tour'}));
  };

  let afterEach = (e)=> {
    if (e) {
      return res.status(400).json(e);
    } else {

      Tour.findOne({
        _id: body.tour_suggested,
      })
        .exec()
        .then(tourFound => {
          if (tourFound) {
            tourFound.active = false;
            tourFound.updated_at = new Date();
            tourFound.save();

            UserController
              .getById(tourFound.suggested_by)
              .then(userFound => {
                UserController
                  .getById(userapp)
                  .then(guideFound => {
                    emailController.tourist_tourSuggestedCreated(userFound, tour_created, guideFound);
                  });
              });
          }
        })
        .catch(e => {
          console.log('e deactivating suggested tour', e);
        });

      tours_created.forEach(function (tourCreated) {
        tourCreated.sibling_tours = tours_id_created;
        tourCreated.save();
      });

      return res.json({created: true})
    }
  }

  async.each(newDates || [], eachDate, afterEach);
}

export function clone(req, res) {
  let {body, userapp} = req;
  var tour_created = null;
  var tours_id_created = [];
  var tour_cloned = null;

  let newDates = body.dates.map(d=>d);

  if (body.frequency && body.frequency !== 'none' && newDates.length === 1) {
    let _date = newDates[0];

    if (body.frequency === 'daily') {
      for (var i = 1; i <= 30; i++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(i, 'days');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(i, 'days');
        }

        newDates.push(d);
      }


    } else if (body.frequency === 'weekly') {

      for (var w = 1; w <= 4; w++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(w, 'weeks');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(w, 'weeks');
        }

        newDates.push(d);
      }


    } else if (body.frequency === 'monthly') {
      for (var m = 1; m <= 4; m++) {
        let {allDay, start_date, end_date} = _date;
        let d = {};
        if (allDay) {
          d.allDay = allDay;
        }
        if (start_date) {
          d.start_date = moment(start_date).add(m, 'months');
        }
        if (end_date) {
          d.end_date = moment(end_date).add(m, 'months');
        }

        newDates.push(d);
      }

    }
  }

  let eachDate = (date, cb)=> {
    let {allDay, start_date, end_date} = date;

    Tour.create(Object.assign({}, tour_cloned, {
      cloned_from_tour: body.cloned_from_tour,
      allDay,
      start_date,
      end_date,
      frequency: body.frequency,
      price_per_person: body.price_per_person,
      min_people: body.min_people,
      max_people: body.max_people,
      photos: body.photos,
      joined: [],
      active: true,
      ignored: false,
      canceled: false,
      reason_cancelled: '',
      closed: false,
      public: true,
      views: 0,
      ready: false,
      confirmed: false,
      completed: false,
      created_at: new Date(),
      updated_at: new Date(),
      from_multiple: newDates.length > 1
    }))
      .then((tourCreated)=> {
        if (!tour_created) tour_created = tourCreated;
        tours_id_created.push(tourCreated._id);
        TourMessageController.createMessageAsync(tourCreated._id, userapp, body.tour_message)
          .then(()=> {
            console.log('Message Created');
          })
          .catch(()=> {
            console.log('Failed creating message');
          });
        // TourMessageController.cloneMessages(tourCreated._id, body.cloned_from_tour);
        ReviewController.cloneReviews(tourCreated._id, body.cloned_from_tour);
        cb(null);
      })
      .catch(()=>cb({message: 'Can not create the tour'}));
  };

  let afterEach = (e)=> {
    if (e) {
      return res.status(400).json(e);
    } else {

      UserController
        .getById(userapp)
        .then(userFound => {
          emailController.guide_tourCreated(userFound, tour_created);
        });

      tours_id_created = tour_cloned.sibling_tours.concat(tours_id_created);
      tours_id_created.forEach(function (tour_id) {
        Tour.findOne({_id: tour_id})
          .then((tourFound) => {
            tourFound.sibling_tours = tours_id_created;
            tourFound.save();
          });
      });

      return res.json({created: true});
    }
  }

  Tour.findOne({_id: body.cloned_from_tour}, {_id: 0, slug: 0}).lean().exec()
    .then(tourFound => {
      if (!tourFound) {
        return res.status(500).json({
          message: 'Tour doesnt exists'
        });
      } else {
        tour_cloned = tourFound;
        async.each(newDates || [], eachDate, afterEach);
      }
    })
    .catch(e=> res.status(500).json({
      message: 'Cant get tour detail',
    }));
}

export function createSuggestion(req, res) {
  var {body, userapp} = req;
  var tour_created = null;

  let eachDate = (date, cb)=> {
    let {allDay, start_date, end_date} = date;


    Tour
      .create(Object.assign({}, body, {
        allDay,
        start_date,
        end_date,
        votes: [userapp.toString()],
        suggested_by: userapp.toString(),
        created_at: new Date(),
        suggestion: true,
      }))
      .then((tourCreated)=> {
        console.log('tourSuggested', tourCreated);
        if (!tour_created) tour_created = tourCreated;
        cb(null);
      })
      .catch(()=>cb({message: 'Can not create the tour'}));


  };

  let afterEach = (e)=> {
    if (e) {
      return res.status(400).json(e);
    } else {
      UserController
        .getById(userapp)
        .then(userFound => {
          emailController.tourist_tourSuggested(userFound, tour_created);
        });
      return res.json({created: true})
    }
  }

  async.each(body.dates || [], eachDate, afterEach);
}

export function acceptSuggestion(req, res) {
  let body = req.body;
  Tour.find({
    _id: body._id,
    suggestion: true,
  })
    .limit(1)
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({message: 'Tour doesnt exists'});
      }
      let _tourFound = tourFound[0];
      let notify = _tourFound.public;
      _tourFound.public = true;
      _tourFound.accepted_at = new Date();
      _tourFound.updated_at = new Date();
      _tourFound
        .save()
        .then((tourUpdated)=> {
          if (!notify) {
            UserController
              .getById(tourUpdated.suggested_by)
              .then(userFound => {
                emailController.tourist_tourSuggestedPublic(userFound, tourUpdated);
              });
          }
          res.json({accepted: true});
        })
        .catch((e)=> {
          console.log('error making it public', e);
          return res.status(500).json({message: 'Cant accept tour at this moment'});
        });
    })
    .catch(() => {
      return res.status(500).json({message: 'Cant get tours'});
    })
}

export function hideTourSuggestion(req, res) {
  let body = req.body;
  Tour.find({
    _id: body._id,
    suggestion: true,
  })
    .limit(1)
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({message: 'Tour doesnt exists'});
      }

      let _tourFound = tourFound[0];

      if (body.hide) {
        _tourFound.active = false;
      } else {
        _tourFound.active = true;
      }

      _tourFound.updated_at = new Date();
      _tourFound
        .save()
        .then((tourHided)=> {
          console.log('tourHided', tourHided);
          res.json({hided: true});
        })
        .catch((e)=> {
          console.log('error hiding tour suggestion', e);
          return res.status(500).json({message: 'Cant hide tour at this moment'});
        });
    })
    .catch(() => {
      return res.status(500).json({message: 'Cant get tours'});
    })
}

export function rejectSuggestion(req, res) {
  let body = req.body;
  Tour.find({
    _id: body._id,
    suggestion: true,
  })
    .limit(1)
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({message: 'Tour doesn\'t exists.'});
      }
      tourFound = tourFound[0];
      tourFound.ignored = true;
      tourFound.public = false;
      tourFound.ignored_at = new Date();
      tourFound.updated_at = new Date();
      tourFound
        .save()
        .then(()=> {
          res.json({rejected: true});
        })
        .catch(()=> {
          return res.status(500).json({message: 'Can\'t accept tour at this moment.'});
        });
    })
    .catch(() => {
      return res.status(500).json({message: 'Can\'t get tours.'});
    })
}

export function close(req, res) {
  let body = req.body;
  Tour.find({_id: body._id})
    .limit(1)
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({message: 'Tour doesn\'t exists.'});
      }
      tourFound = tourFound[0];
      tourFound.closed = true;
      tourFound.updated_at = new Date();
      tourFound
        .save()
        .then((tourUpdated)=> {
          res.json({closed: true});
        })
        .catch(()=> {
          return res.status(500).json({message: 'Can\'t accept tour at this moment.'});
        });
    })
    .catch(() => {
      return res.status(500).json({message: 'Can\'t get tours.'});
    })
}

export function cancel(req, res) {
  let body = req.body;
  Tour.find({_id: body._id})
    .populate({model: 'User', path: 'guide', select: '_id name email slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name email slug profile_picture'})
    .populate({model: 'Tour', path: 'tour_suggested', select: '_id title slug suggested_by full_description photos start_date', 
      populate: {model: 'User', path: 'suggested_by', select: '_id name email slug profile_picture'}
    })
    .limit(1)
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({message: 'Tour doesn\'t exists'});
      }
      tourFound = tourFound[0];
      if (!tourFound.confirmed) {
        if (!tourFound.canceled) {
          tourFound.canceled = true;
          tourFound.confirmed = false;
          tourFound.updated_at = new Date();
          tourFound
            .save()
            .then(()=> {
              emailController.guide_tourCanceled(tourFound.guide, tourFound, true);
              if (tourFound.from_suggestion) {
                emailController.tourist_tourSuggestedCanceled(tourFound.tour_suggested.suggested_by, tourFound, true);
              }
              async.each(tourFound.joined, (joined, cb) => {
                emailController.tourist_tourCanceled(joined.user, tourFound, joined.charged1, (tourFound.price_per_person * joined.spots * 10) / 100, true);
                cb(null);
              }, () => {});
              res.json({canceled: true});
            })
            .catch(()=> {
              return res.status(500).json({message: 'Can\'t accept tour at this moment'});
            });
          } else {
            res.status(500).json({
              message: 'Can\'t left this tour because is already canceled.'
            });
          }
        } else {
          res.status(500).json({
            message: 'Can\'t left this tour because is already confirmed.'
          });
        }
    })
    .catch(() => {
      return res.status(500).json({message: 'Can\'t get tours'});
    })
}

export function handleVote(req, res) {
  let user = req.userapp;
  let id = req.params.id;


  Tour
    .find(
      {
        _id: id,
        suggestion: true
      }
    )
    .limit(1)
    .exec()
    .then(tourFound=> {
      if (tourFound.length <= 0) {
        return res.status(400).json({message: 'Tour doesn\'t exists'});
      }

      tourFound = tourFound[0];
      let _votes = tourFound.votes.map(v => v.toString());
      var exists = _.indexOf(_votes || [], user.toString());

      if (exists === -1) {
        tourFound.votes.push(user);
      } else {
        tourFound.votes.splice(exists, 1);
      }
      tourFound.updated_at = new Date();

      SettingController.findByName('suggestedtoursthreshold')
        .then(settingFound => {
          if (!tourFound.public && tourFound.votes.length >= settingFound.info) {
            tourFound.public = true;
            tourFound.accepted_at = new Date();
            UserController
              .getById(tourFound.suggested_by)
              .then(userFound => {
                emailController.tourist_tourSuggestedPublic(userFound, tourFound);
              });
          }
          tourFound.save()
            .then((tour)=> {
              res.json({tour});
            })
            .catch(e => {
              return res.status(400).json({
                message: 'Cant handle vote'
              });
            })
        });
    })
    .catch(e => res.status(400).json({
      message: 'Cant get tours'
    }));
}

// Updates an existing Tour in the DB
export function update(req, res) {
  if (req.body._id) {
    delete req.body._id;
  }
  return Tour.findById(req.params.id).exec()
    .then(handleEntityNotFound(res))
    .then(saveUpdates(req.body))
    .then(respondWithResult(res))
    .catch(handleError(res));
}

// Deletes a Tour from the DB
export function destroy(req, res) {
  Tour.find({_id: req.params.id})
    .populate({model: 'User', path: 'guide', select: '_id name email slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name email slug profile_picture'})
    .populate({model: 'Tour', path: 'tour_suggested', select: '_id title slug guide full_description photos start_date', 
      populate: {model: 'User', path: 'suggested_by', select: '_id name email slug profile_picture'}
    })
    .limit(1)
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({message: 'Tour doesn\'t exists'});
      }
      tourFound = tourFound[0];
      if (!tourFound.confirmed || tourFound.completed) {
        tourFound.canceled = true;
        tourFound.confirmed = false;
        tourFound.active = false;
        tourFound.updated_at = new Date();
        tourFound
          .save()
          .then(()=> {
            res.json({removed: true});
          })
          .catch(()=> {
            return res.status(500).json({message: 'Can\'t remove tour at this moment'});
          });
      } else if (tourFound.confirmed && !tourFound.completed) {
        res.status(500).json({
          message: 'Can\'t remove this tour because is already confirmed.'
        });
      }
    })
    .catch(() => {
      return res.status(500).json({message: 'Can\'t get tours'});
    });
}

export function getToursAdmin(req, res) {
  let status = req.body.status;

  var query;

  if (status === 'active') {
    query = Tour.find({
      active: true,
      start_date: {$gte: new Date()},
      suggestion: false,
      guide: {$ne: null},
      canceled: false
    })
  } else if (status === 'suggested') {
    query = Tour.find({
      start_date: {$gte: new Date()},
      suggestion: true
    })
  } else if (status === 'past') {
    query = Tour.find({
      start_date: {$lt: new Date()},
      active: true,
      canceled: false
    })
  } else if (status === 'canceled') {
    query = Tour.find({
      active: true,
      canceled: true
    });
  } else {
    query = Tour.find({active: true, suggested: false})
  }

  query
    .populate({
      path: 'country',
      model: 'Country',
      select: '_id name'
    })
    .populate({
      path: 'city',
      model: 'City',
      select: '_id name'
    })
    .populate({model: 'User', path: 'guide', select: '_id name kind slug profile_picture'})
    .sort({start_date: 1})
    .lean()
    .exec()
    .then(toursFound => {
      if (toursFound.length <= 0) {
        return res.json({tours: []});
      } else {
        async.eachSeries(toursFound, (tourFound, cb) => {
          TourMessageController.getTourMessagesSimple(tourFound._id)
            .then((messages) => {
              tourFound.messages = messages;
              cb(null);
            })
            .catch(()=> {
              cb(null);
            });
        }, () => {
          return res.json({tours: toursFound})
        });
      }
    })
    .catch(e => res.status(500).json({
      message: 'Cant get tours'
    }));


}

export function getToursGuide(req, res) {
  let status = req.body.status;

  let {userapp} = req;

  console.log('userapp', userapp);

  var query;

  if (status === 'active') {
    query = Tour.find({
      start_date: {$gte: new Date()},
      guide: userapp,
      active: true,
      suggestion: false,
      canceled: false
    })
  } else if (status === 'suggested') {
    // query = Tour.find({
    //   guide: userapp,
    //   active: true,
    //   public: true,
    //   from_suggestion: true,
    // })
    query = Tour.find({
      start_date: {$gte: new Date()},
      active: true,
      suggestion: true
    })

  } else if (status === 'past') {
    query = Tour.find({
      active: true,
      guide: userapp,
      suggestion: false,
      start_date: {$lt: new Date()},
      canceled: false
    });
  } else if (status === 'canceled') {
    query = Tour.find({
      guide: userapp,
      active: true,
      canceled: true
    });
  } else {
    query = Tour.find({
      guide: userapp,
      active: true,
      suggested: false
    })
  }

  query
    .populate({
      path: 'country',
      model: 'Country',
      select: '_id name'
    })
    .populate({
      path: 'city',
      model: 'City',
      select: '_id name'
    })
    .sort({start_date: 1})
    .lean()
    .exec()
    .then(toursFound => {
      if (toursFound.length <= 0) {
        return res.json({tours: []});
      } else {
        let toursFoundFinal = [];
        async.eachSeries(toursFound, (tourFound, cb) => {
          TourMessageController.getTourMessagesSimple(tourFound._id)
            .then((messages) => {
              tourFound.messages = messages;
              if (!tourFound.public) {
                SettingController.findByName('suggestedtoursthreshold')
                  .then(settingFound => {
                    if (tourFound.votes.length >= settingFound.info) toursFoundFinal.push(tourFound);
                    cb(null);
                  })
                  .catch(e => {
                    cb(null);
                  });
              } else {
                toursFoundFinal.push(tourFound);
                cb(null);
              }
            })
            .catch(()=> {
              toursFoundFinal.push(tourFound);
              cb(null);
            });
        }, () => {
          return res.json({tours: toursFoundFinal})
        });
      }
    })
    .catch(e => res.status(500).json({
      message: 'Cant get tours'
    }));


}


export function getTourDetailAdmin(req, res) {
  let id = req.params.id;
  Tour
    .find({
      _id: id
    })
    .limit(1)
    .populate({model: 'Country', path: 'country', select: '_id name'})
    .populate({model: 'City', path: 'city', select: '_id name'})
    .populate({model: 'Activity', path: 'activities', select: '_id name'})
    .populate({model: 'Language', path: 'language_spoken', select: '_id name'})
    .populate({model: 'User', path: 'guide', select: '_id name kind slug profile_picture'})
    .lean()
    .exec()
    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({
          message: 'Tour doesnt exists'
        });
      } else {
        async.parallel({
          messages: (cb)=> {
            TourMessageController.getTourMessagesSimple(tourFound[0]._id)
              .then((messages) => {
                tourFound[0].messages = messages;
                cb(null, messages);
              })
              .catch((e)=> {
                console.log(2, e)
                cb(null, []);
              });
          },
          reviews: (cb)=> {
            ReviewController.getTourReviewsSimple(tourFound[0]._id)
              .then((reviews) => {
                cb(null, reviews);
              })
              .catch((e)=> {
                console.log(1, e)
                cb(null, []);
              });
          }
        }, (e, results)=> {
          tourFound[0].messages = results.messages;
          tourFound[0].reviews = results.reviews;
          return res.json({tour: tourFound[0]});
        });
      }
    })
    .catch(e=> res.status(500).json({
      message: 'Cant get tour detail',
    }));

}

export function getToursSearch(req, res) {

  let {body} = req;
  //console.log('body', body);


  let filters = {
    active: true,
    canceled: false,
    suggestion: false
  };


  if (body.start_date) {
    filters.start_date = {$gte: new Date(body.start_date)}
  }
  if (body.end_date) {
    filters.end_date = {$lte: new Date(body.end_date)}
  }

  if (!body.start_date && !body.end_date) {
    filters.start_date = {$gte: new Date()}
  }

  if (body.showing) {
    if (body.showing === 'all') {
    } else if (body.showing === 'suggested') {
      filters.suggestion = true;
    } else if (body.showing === 'available') {
    } else if (body.showing === 'nonprofit') {
      filters.fromNGO = true;
    }
  }

  if (body.price_range) {
    filters.price_per_person = {$gte: body.price_range[0], $lte: body.price_range[1]};
  }

  let parallel = {};

  if (body.city) {
    parallel.city = (cb)=> {
      CityController.getCityByName(body.city)
        .then(cityFound => {
          cb(null, cityFound);
        })
        .catch(e => {
          cb({message: 'Can\'t get the city'});
        });
    }
  }

  if (body.activities && body.activities.length) {
    parallel.forActivities = (cb)=> {

      let a = Tour.aggregate();
      a.unwind('activities');
      a.match({
        'activities': {$in: body.activities.map(a => new Types.ObjectId(a))}
      });
      a.group({
        _id: 0,
        tours: {$addToSet: '$_id'}
      })
        .exec()
        .then(data => {
          //console.log('data in aggregate', data);
          cb(null, data[0] ? data[0].tours : []);
        })
        .catch(e=> {
          console.log('e in aggregate', e);
          cb(null, []);
        });


    }
  }


  let afterParallel = (e, results)=> {
    if (e) {
      res.status(400).json(e);
    } else {
      if (results.city) {
        filters.city = results.city._id;
      }
      if (body.activities && body.activities.length && !results.forActivities.length) {
        return res.json({tours: []});
      } else if (body.activities && body.activities.length && results.forActivities.length) {
        filters._id = {$in: results.forActivities.map(a => new Types.ObjectId(a))}
      }

      Tour.find(filters)
        .select('_id')
        .sort('start_date')
        .exec()
        .then(toursFound => {
          let toursToGroup = toursFound.map(t => t._id);

          let a = Tour.aggregate();
          a.match({
            _id: {$in: toursToGroup},
          });
          a.sort('start_date');
          a.group({
            _id: {
              year: {$year: "$start_date"},
              month: {$month: "$start_date"},
              day: {
                $dayOfMonth: "$start_date",
              },
              dayOfWeek: {$dayOfWeek: "$start_date"},
            },
            tours: {$addToSet: '$_id'}
          });

          a.match({
            '_id.dayOfWeek': {$in: body.days || [1, 2, 3, 4, 5, 6, 7]},
          });
          a.group({
            _id: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
            tours: {
              $addToSet: '$tours'
            }
          });

          a.sort('_id');


          a.exec();

          a
            .then(data => {
              let final = [];
              let eachDate = (item, cb)=> {
                /*
                 let final = data.map(d => {
                 console.log(d);
                 return {
                 date: d._id,
                 tours: d.tours[0]
                 }
                 });
                 */

                if (item.tours && item.tours[0] && item.tours[0].length) {
                  Tour
                    .find({
                      _id: {$in: item.tours[0]}
                    })
                    .populate({model: 'City', path: 'city', select: '_id name'})
                    .populate({model: 'Country', path: 'country', select: '_id name'})
                    .populate({model: 'Activity', path: 'activities', select: '_id name'})
                    .exec()
                    .then(tours => {
                      if (!tours.length) cb(null);
                      function addtour() {
                        final.push({
                          date: moment(`${item._id.month}/${item._id.day}/${item._id.year}`, "MM-DD-YYYY").hours(12),
                          tours
                        })
                        cb(null);
                      }
                      addtour();
                      /*if (tours[0].suggestion) {
                        SettingController.findByName('suggestedtoursthreshold')
                          .then(settingFound => {
                            // console.log("test", tours[0], tours[0].votes.length, settingFound.info)
                            if (tours[0].votes.length >= settingFound.info) {
                              addtour();
                            } else cb(null);
                          })
                          .catch(e => {
                            addtour();
                          });
                      } else {
                        addtour();
                      }*/
                    })
                    .catch(e => {
                      console.log(e);
                      cb(null);
                    });
                }


              };

              let afterEach = (eEach)=> {

                res.json({tours: final});
              };
              async.eachSeries(data, eachDate, afterEach);


            })
            .catch(e => {
              console.log('e in aggregation for group')
            })
        })

    }

  };

  async.parallel(parallel, afterParallel);


}

export function getBySlugSimple(slug) {
  return new Promise((resolve, reject)=> {
    Tour.find({
      _id: slug,
    })
      .limit(1)
      .exec()
      .then((tourFound)=> {
        if (tourFound.length <= 0) {
          reject({
            message: 'Tour doesnt exists'
          });
        } else {
          resolve(tourFound[0]);
        }
      })
      .catch(e=> {
        console.log('e', e);
        reject({
          message: 'Cant get tours',
        });
      })
  });
}

let getToursCompletedByUser = (user)=> {
  return new Promise((resolve, reject)=> {
    Tour.find({
      guide: user,
      completed: true
    })
      .exec()
      .then((toursFound)=> {
        resolve(toursFound);
      })
      .catch(e => {
        reject({
          message: `Can't get the tours completed by the user.`,
        })
      });
  });
};


export function getBySlug(req, res) {
  let slug = req.params.slug;

  Tour
    .find({
      _id: slug
    })
    .limit(1)
    .populate({model: 'Activity', path: 'activities', select: '_id name'})
    .populate({model: 'Country', path: 'country', select: '_id name'})
    .populate({model: 'City', path: 'city', select: '_id name'})
    .populate({model: 'Language', path: 'language_spoken', select: '_id name'})
    .populate({model: 'User', path: 'guide', select: '_id name slug profile_picture'})
    .populate({model: 'User', path: 'suggested_by', select: '_id name kind slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name kind slug profile_picture'})
    .lean()
    .exec()

    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({
          message: 'Tour doesnt exists'
        });
      } else {

        let _tour = tourFound[0];
        console.log('tour found', _tour);


        if (_tour.guide && _tour.guide._id) {
          getToursCompletedByUser(_tour.guide._id)
            .then(toursCompleted => {
              console.log('toursCompleted', toursCompleted);

              _tour.guide.tours_completed = toursCompleted.length;


              return res.json({tour: _tour});
            })
            .catch(e => {
              res.status(500).json(e);
            });
        } else {

          return res.json({tour: _tour});

        }


      }
    })
    .catch(e=> {
      console.log('e getting detail', e);
      res.status(500).json({
        message: 'Cant get tour detail',
      })
    });

}

const addAView = (tour) => {
  return new Promise((resolve, reject)=> {
    Tour
      .findOne({
        _id: tour,
      })
      .exec()
      .then(tourFound => {
        if (tourFound === null) {
          reject({
            message: `Tour doesn't exists`
          });
        } else {
          tourFound.views = tourFound.views + 1;
          tourFound.viewed_at = new Date();
          tourFound.updated_at = new Date();
          tourFound
            .save()
            .then((tourUpdated)=> {
              resolve();
            })
            .catch((e)=> {
              reject({message: `Can't update add the view to the tour`});
            });
        }
      })
      .catch(e => {
        reject({
          message: `Can't get tours at this moment`
        });
      });
  });
};

export function getDetailBySlug(req, res) {
  let slug = req.params.slug;

  Tour
    .find({
      active: true,
      slug,
      canceled: false
    })
    .limit(1)
    .populate({model: 'Activity', path: 'activities', select: '_id name'})
    .populate({model: 'Country', path: 'country', select: '_id name'})
    .populate({model: 'City', path: 'city', select: '_id name'})
    .populate({model: 'Language', path: 'language_spoken', select: '_id name'})
    .populate({model: 'User', path: 'guide', select: '_id name kind slug profile_picture'})
    .populate({model: 'User', path: 'suggested_by', select: '_id name kind slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name kind slug profile_picture'})
    .lean()
    .exec()

    .then(tourFound => {
      if (tourFound.length <= 0) {
        return res.status(500).json({
          message: 'Tour doesnt exists'
        });
      } else {

        let _tour = tourFound[0];

        addAView(_tour._id)
          .then(()=> {
            console.log('View Added');
          })
          .catch(e => {
            console.log('e adding the view ', e);
          });

        // if (!_tour.closed && new Date() > new Date(_tour.end_date)) _tour.closed = true;

        if (_tour.guide && _tour.guide._id) {
          getToursCompletedByUser(_tour.guide._id)
            .then(toursCompleted => {
              _tour.guide.tours_completed = toursCompleted.length;
              return res.json({tour: _tour});
            })
            .catch(e => {
              res.status(500).json(e);
            });
        } else {

          return res.json({tour: _tour});

        }


      }
    })
    .catch(e=> {
      console.log('e getting detail', e);
      res.status(500).json({
        message: 'Cant get tour detail',
      })
    });

}

export function bookTour(req, res) {
  let user = req.userapp;
  let {body} = req;

  UserController
    .getById(user)
    .then(userFound => {
      getById(body.tour)
        .then(tourFound => {

          let current_people = 0;
          tourFound.joined.forEach((joined)=> {
            current_people = current_people + joined.spots
          });
          let left_people = tourFound.max_people - current_people;
          if (current_people >= tourFound.max_people) {
            return res.status(400).json({message: 'Sorry, this tour is sold out!'});
          } else if (body.persons > left_people) {
            return res.status(400).json({message: 'Sorry, just ' + left_people + ' spot' + (left_people > 1 ? 's' : '') + ' left'});
          }

          var stripe = require("stripe")("sk_test_oC1kYWvRj9Okc7zvMmBTKzxA");

          stripe.tokens.create({
            card: {
              "number": body.card_number,
              "exp_month": body.month,
              "exp_year": body.year,
              "cvc": body.cvc
            }
          }, function (err, token) {
            if (err) {
              console.log('err', err);
              return res.status(400).json({message: 'Invalid credit card.'});
            }
            stripe.customers.create({
              description: 'User: ' + config.frontend_host + '/tourist/' + userFound.slug,
              email: userFound.email,
              source: token.id// obtained with Stripe.js
            }, function (eCustomer, customer) {
              if (eCustomer) {
                console.log('error creating customer', eCustomer);
                return res.status(500).json({
                  message: eCustomer.message
                })
              }
              tourFound.joined = tourFound.joined || [];
              //Check if user already booked
              tourFound.joined.push({
                user: userFound._id,
                spots: body.persons,
                stripe_token: token,
                stripe_customer: customer,
                date_booked: new Date(),
                comment: body.comment,
              });
              tourFound.updated_at = new Date();
              tourFound.save().then(tourUpdated=> {
                UserController
                  .getById(tourUpdated.guide._id)
                  .then(guideFound => {
                    emailController.tourist_tourBooked(userFound, tourUpdated, guideFound);
                    let people_joined = current_people + body.persons;
                    if (people_joined >= tourUpdated.min_people) {
                      makeCharge(tourUpdated._id, 1)
                        .then(() => {
                          //notify charges success
                          console.log('charges success')
                          if (people_joined >= tourUpdated.max_people) {
                            emailController.guide_tourMaxPeople(guideFound, tourUpdated, userFound, body.comment, true);
                          } else if (tourUpdated.ready) {
                            emailController.guide_touristJoinTour(guideFound, tourUpdated, userFound, body.comment, true);
                          } else {
                            tourUpdated.ready = true;
                            tourUpdated.save();
                            emailController.guide_tourMinPeople(guideFound, tourUpdated, userFound, body.comment, true);
                          }
                        })
                        .catch(e => {
                          console.log('charges fail: ', e);
                          if (people_joined >= tourUpdated.max_people) {
                            emailController.guide_tourMaxPeople(guideFound, tourUpdated, userFound, body.comment, false);
                          } else if (tourUpdated.ready) {
                            emailController.guide_touristJoinTour(guideFound, tourUpdated, userFound, body.comment, false);
                          } else {
                            tourUpdated.ready = true;
                            tourUpdated.save();
                            emailController.guide_tourMinPeople(guideFound, tourUpdated, userFound, body.comment, false);
                          }
                        });
                    } else {
                      emailController.guide_touristJoinTour(guideFound, tourUpdated, userFound, body.comment, null);
                    }
                  });
                res.json({
                  booked: true
                })
              })
                .catch(e => res.status(400).json({
                  message: 'Cant book now'
                }));


            });


          });


        })
        .catch(e => res.status(400).json(e));
    })
    .catch(e => res.status(400).json(e));
}

export function getPastToursTourist(user) {
  return new Promise((resolve, reject)=> {

    var a = Tour.aggregate();

    a.match({
      start_date: {$lt: new Date()}
    });

    a.unwind('joined');

    a.match({
      'joined.user': new Types.ObjectId(user)
    });

    a.group({
      _id: 0,
      tours: {$addToSet: '$_id'}
    });

    a.sort({start_date: 1});

    a.exec()
      .then(data => {
        //cb(null, data[0] ? data[0].tours : []);
        if (data.length <= 0) {
          resolve([]);
        } else {
          Tour.find({
            _id: {
              $in: data[0].tours,
            },
            active: true,
          })
            .populate({model: 'City', path: 'city', select: '_id name'})
            .populate({model: 'Country', path: 'country', select: '_id name'})
            .populate({model: 'Activity', path: 'activities', select: '_id name'})
            .sort({start_date: 1})
            .lean()
            .exec()
            .then((toursFound)=> {
              // toursFound.forEach(tour => {
              //   if (!tour.closed && new Date() > new Date(tour.end_date)) tour.closed = true;
              // });
              resolve(toursFound);
            })
            .catch(()=>reject({message: `Can't get past tours.`}));
        }


      })
      .catch(e=> {
        console.log('e in aggregate', e);
        //cb(null, []);
        resolve([]);
      });
  });
}

export function getCurrentToursTourist(user) {
  return new Promise((resolve, reject)=> {

    var a = Tour.aggregate();

    a.match({
      start_date: {$gte: new Date()}
    });

    a.unwind('joined');

    a.match({
      'joined.user': new Types.ObjectId(user)
    });

    a.group({
      _id: 0,
      tours: {$addToSet: '$_id'}
    });

    a.sort({start_date: 1});

    a.exec()
      .then(data => {
        //cb(null, data[0] ? data[0].tours : []);
        if (data.length <= 0) {
          resolve([]);
        } else {
          Tour.find({
            _id: {
              $in: data[0].tours,
            },
            active: true,
          })
            .populate({model: 'City', path: 'city', select: '_id name'})
            .populate({model: 'Country', path: 'country', select: '_id name'})
            .populate({model: 'Activity', path: 'activities', select: '_id name'})
            .sort({start_date: 1})
            .lean()
            .exec()
            .then((toursFound)=> {
              // toursFound.forEach(tour => {
              //   if (!tour.closed && new Date() > new Date(tour.end_date)) tour.closed = true;
              // });
              resolve(toursFound);
            })
            .catch(()=>reject({message: `Can't get past tours.`}));
        }
      })
      .catch(e=> {
        console.log('e in aggregate', e);
        //cb(null, []);
        resolve([]);
      });
  });
}

export function getPastToursGuide(user) {
  return new Promise((resolve, reject)=> {

    Tour
      .find({
        active: true,
        guide: user,
        start_date: {$lt: new Date()}
      })
      .populate({model: 'City', path: 'city', select: '_id name'})
      .populate({model: 'Country', path: 'country', select: '_id name'})
      .populate({model: 'Activity', path: 'activities', select: '_id name'})
      .sort({start_date: 1})
      .lean()
      .exec()
      .then(toursFound => {
        // toursFound.forEach(tour => {
        //   if (!tour.closed && new Date() > new Date(tour.end_date)) tour.closed = true;
        // });
        resolve(toursFound);
      })
      .catch(e=> {
        console.log('e in aggregate', e);
        //cb(null, []);
        resolve([]);
      });
  });
}

export function getCurrentToursGuide(user) {
  return new Promise((resolve, reject)=> {

    Tour
      .find({
        active: true,
        guide: user,
        start_date: {$gte: new Date()}
      })
      .populate({model: 'City', path: 'city', select: '_id name'})
      .populate({model: 'Country', path: 'country', select: '_id name'})
      .populate({model: 'Activity', path: 'activities', select: '_id name'})
      .sort({start_date: 1})
      .lean()
      .exec()
      .then(toursFound => {
        // toursFound.forEach(tour => {
        //   if (!tour.closed && new Date() > new Date(tour.end_date)) tour.closed = true;
        // });
        resolve(toursFound);
      })
      .catch(e=> {
        console.log('e in aggregate', e);
        //cb(null, []);
        resolve([]);
      });
  });
}

export function getPopularTours(req, res) {
  Tour
    .find({
      active: true,
      public: true,
      canceled: false,
      start_date: {$gte: new Date()},
      suggestion: false
    })
    .limit(6)
    .sort({views: -1})
    .populate({model: 'Activity', path: 'activities', select: '_id name'})
    .populate({model: 'Country', path: 'country', select: '_id name'})
    .populate({model: 'City', path: 'city', select: '_id name'})
    .populate({model: 'Language', path: 'language_spoken', select: '_id name'})
    .populate({model: 'User', path: 'guide', select: '_id name slug profile_picture'})
    .populate({model: 'User', path: 'suggested_by', select: '_id name kind slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name kind slug profile_picture'})
    .lean()
    .exec()

    .then(toursFound => {
      res.json({tours: toursFound});
    })
    .catch(e=> {
      console.log('e getting detail', e);
      res.status(500).json({
        message: 'Cant get tour detail',
      })
    });
}

export function getRecentlyViewedTours(req, res) {
  Tour
    .find({
      active: true,
      public: true,
      canceled: false,
      start_date: {$gte: new Date()},
      suggestion: false
    })
    .sort({viewed_at: -1})
    .limit(4)
    .populate({model: 'Activity', path: 'activities', select: '_id name'})
    .populate({model: 'Country', path: 'country', select: '_id name'})
    .populate({model: 'City', path: 'city', select: '_id name'})
    .populate({model: 'Language', path: 'language_spoken', select: '_id name'})
    .populate({model: 'User', path: 'guide', select: '_id name slug profile_picture'})
    .populate({model: 'User', path: 'suggested_by', select: '_id name kind slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name kind slug profile_picture'})
    .lean()
    .exec()
    .then(toursFound => {
      res.json({tours: toursFound});
    })
    .catch(e=> {
      console.log('e getting detail', e);
      res.status(500).json({
        message: 'Cant get tour detail',
      })
    });
}

export function leave(req, res) {
  let user_id = req.userapp;
  let {body} = req;
  let joined_delete = -1;

  UserController
    .getById(user_id)
    .then(userFound => {
      getById(body._id)
        .then(tourFound => {
          if (!tourFound.confirmed) {
            if (!tourFound.canceled) {
              async.forEachOf(tourFound.joined, (joined, i, cb) => {
                if (joined.user._id === user_id) {
                  joined_delete = i;
                  cb(null);
                } else {
                  cb(null);
                }
              }, () => {
                if (joined_delete >= 0) {
                  tourFound.joined.splice(joined_delete, 1);
                  let current_people = 0;
                  tourFound.joined.forEach((joined)=> {
                    current_people = current_people + joined.spots
                  });
                  if (current_people < tourFound.min_people) {
                    tourFound.ready = false;
                  }
                  tourFound.updated_at = new Date();
                  tourFound.save().then(tourUpdated => {
                    UserController
                      .getById(tourUpdated.guide._id)
                      .then(guideFound => {
                        emailController.guide_touristLeaveTour(guideFound, tourUpdated, userFound);
                      });
                    res.json({tour: tourUpdated});
                  })
                  .catch(e => res.status(400).json({
                    message: 'Can\'t left this tour right now. Try later.'
                  }));
                } else {
                  res.status(400).json({
                    message: 'You haven\'t booked this tour.'
                  });
                }
              });
            } else {
              res.status(400).json({
                message: 'Can\'t left this tour because was canceled.'
              });
            }
          } else {
            res.status(400).json({
              message: 'Can\'t left this tour because is already confirmed.'
            });
          }

        })
        .catch(e => res.status(400).json(e));
    })
    .catch(e => res.status(400).json(e));
}

function closeTours() {
  Tour
    .find({
      active: true,
      public: true,
      canceled: false,
      confirmed: false,
      suggestion: false,
      start_date: {$gte: new Date(Date.now() + 2 * 24*60*60*1000), $lt: new Date(Date.now() + 3 * 24*60*60*1000)}
    })
    .populate({model: 'User', path: 'guide', select: '_id name email slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name email slug profile_picture'})
    .populate({model: 'Tour', path: 'tour_suggested', select: '_id title slug suggested_by full_description photos start_date', 
      populate: {model: 'User', path: 'suggested_by', select: '_id name email slug profile_picture'}
    })
    .then(toursFound => {
      if (toursFound.length <= 0) return;
      async.each(toursFound, (tourFound, callback) => {
        tourFound.closed = true;
        if (tourFound.ready) {
          tourFound.confirmed = true;
          makeCharge(tourFound._id, 2);
          emailController.guide_tourConfirmed(tourFound.guide, tourFound);
          if (tourFound.from_suggestion) {
            emailController.tourist_tourSuggestedConfirmed(tourFound.tour_suggested.suggested_by, tourFound);
          }
        } else {
          tourFound.canceled = true;
          tourFound.confirmed = false;
          emailController.guide_tourCanceled(tourFound.guide, tourFound);
          if (tourFound.from_suggestion) {
            emailController.tourist_tourSuggestedCanceled(tourFound.tour_suggested.suggested_by, tourFound);
          }
          async.each(tourFound.joined, (joined, cb) => {
            emailController.tourist_tourCanceled(joined.user, tourFound, joined.charged1, (tourFound.price_per_person * joined.spots * 10) / 100);
            cb(null);
          }, () => {});
        }
        tourFound.updated_at = new Date();
        tourFound.save();
        callback(null);
      }, () => {
        return;
      });
    });
}

function completeTours() {
  Tour
    .find({
      active: true,
      public: true,
      canceled: false,
      confirmed: true,
      suggestion: false,
      $or: [
        {allDay: false, end_date: {$gte: new Date(Date.now() - 1 * 24*60*60*1000), $lt: new Date()}},
        {allDay: true, start_date: {$gte: new Date(Date.now() - 1 * 24*60*60*1000), $lt: new Date()}},
      ]
    })
    .populate({model: 'User', path: 'guide', select: '_id name email slug profile_picture'})
    .populate({model: 'User', path: 'joined.user', select: '_id name email slug profile_picture'})
    .populate({model: 'Tour', path: 'tour_suggested', select: '_id title slug guide full_description photos start_date', 
      populate: {model: 'User', path: 'suggested_by', select: '_id name email slug profile_picture'}
    })
    .then(toursFound => {
      if (toursFound.length <= 0) return;
      async.each(toursFound, (tourFound, callback) => {
        tourFound.completed = true;
        async.each(tourFound.joined, (joined, cb) => {
          emailController.tourist_tourCompleted(joined.user, tourFound);
          cb(null);
        }, () => {});
        tourFound.updated_at = new Date();
        tourFound.save();
        callback(null);
      }, () => {
        return;
      });
    });
}

function getTouristsJoinedByDay() {
  return new Promise((resolve, reject)=> {
    Tour
      .find({
        active: true,
        public: true,
        canceled: false,
        updated_at: {$gte: new Date(Date.now() - 1 * 24*60*60*1000), $lt: new Date()},
        'joined.date_booked': {$gte: new Date(Date.now() - 1 * 24*60*60*1000), $lt: new Date()},
        suggestion: false
      }, '_id title slug guide full_description photos start_date joined')
      .populate({model: 'User', path: 'guide', select: '_id name email slug profile_picture'})
      .populate({model: 'User', path: 'joined.user', select: '_id name email slug profile_picture'})
      .sort({updated_at: -1})
      .then((tours) => {
        resolve(tours);
      })
      .catch(e => {
        reject({
          message: 'Can\'t get tours'
        });
      });
  });
}

function dailyReview() {
  async.parallel({
    emailsByMessages: callbak => {
      TourMessageController.getTourMessagesByDay()
        .then((messages) => {
          let emailsByMessages = [], guides_id = [], tours_id = [];
          async.each(messages, (message, cb) => {
            let guide_index = guides_id.indexOf(message.tour.guide._id.toString());
            if (guide_index >= 0) {
              let tour_index = tours_id[guide_index].indexOf(message.tour._id.toString());
              if (tour_index >= 0) {
                emailsByMessages[guide_index].tours[tour_index].messages.push(message);
              } else {
                tours_id[guide_index].push(message.tour._id.toString());
                let messagesByTour = [];
                messagesByTour.push(message);
                emailsByMessages[guide_index].tours.push({tour: message.tour, messages: messagesByTour})
              }
            } else {
              guides_id.push(message.tour.guide._id.toString());
              let toursIdByGuide = [];
              toursIdByGuide.push(message.tour._id.toString());
              tours_id.push(toursIdByGuide);
              let toursByGuide = [], messagesByTour = [];
              messagesByTour.push(message);
              toursByGuide.push({tour: message.tour, messages: messagesByTour});
              emailsByMessages.push({guide: message.tour.guide, tours: toursByGuide});
            }
            cb(null);
          }, () => {
            // console.log("emailsByMessages", JSON.stringify(emailsByMessages, null, 4));
            // console.log("emailsByMessages", emailsByMessages);
            callbak(null, emailsByMessages);
          });
        })
        .catch(e => {
          console.log("error on emailsByMessages:", e)
          callbak(e);
        });
    },
    emailsByJoins: callbak => {
      getTouristsJoinedByDay()
        .then((tours) => {
          let emailsByJoins = [], guides_id = [];
          async.each(tours, (tour, cb) => {
            let guide_index = guides_id.indexOf(tour.guide._id.toString());
            if (guide_index >= 0) {
              emailsByJoins[guide_index].tours.push({tour: tour})//, joined: tour.joined
            } else {
              guides_id.push(tour.guide._id.toString());
              let toursByGuide = [];
              toursByGuide.push({tour: tour});//
              emailsByJoins.push({guide: tour.guide, tours: toursByGuide});
            }
            cb(null);
          }, () => {
            // console.log("emailsByJoins", JSON.stringify(emailsByJoins, null, 4));
            // console.log("emailsByJoins", emailsByJoins);
            callbak(null, emailsByJoins);
          });
        })
        .catch(e => {
          console.log("error on emailsByJoins:", e)
          callbak(e);
        });
    }
  }, (e, data) => {
    // let merged_data = Object.assign({}, data.emailsByMessages, data.emailsByJoins); // does'nt work, delete same indexes
    // let merged_data = _.merge(data.emailsByMessages, data.emailsByJoins); // works but fail with wrong positions
    let merged_data = [];
    data.emailsByMessages.forEach(emailMessage => {
      data.emailsByJoins.forEach(emailJoin => {
        if (emailMessage.guide._id.toString() === emailJoin.guide._id.toString()) {
          let tours = [];
          emailMessage.tours.forEach(tourByMessages => {
            emailJoin.tours.forEach(tourByJoins => {
              if (tourByMessages.tour._id.toString() === tourByJoins.tour._id.toString()) {
                tours.push({tour: tourByJoins.tour, messages: tourByMessages.messages});
              }
            });
          });
          merged_data.push({guide: emailJoin.guide, tours: tours});
        }
      });
    });
    // console.log("merged_data", JSON.stringify(merged_data, null, 4))
    // console.log("merged_data", merged_data)
    merged_data.forEach(data => {
      emailController.guide_dailyReview(data);
    });
  });
}

ontime({
    cycle: '05:00:00'
}, function (ot) {
  dailyReview();
  closeTours();
  completeTours();
  ot.done();
  return;
});