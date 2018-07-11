'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Q = require('q'),
  User = mongoose.model('User'),
  async = require('async'),
  config = require('meanio').loadConfig(),
  crypto = require('crypto'),
  request = require('request'),
  _ = require('lodash'),
  oauth = require('oauth'),
  Emails = require('../../emails'),
  Products = require('./products'),
  Alerts = require('./alerts'),
  cmd = require('node-cmd'),
  ObjectId = mongoose.Types.ObjectId;

/**
 * Exports.
 */
var Users = {};
module.exports = Users;

/**
 * Controllers.
 */

Users.list = function (req, res) {
  User.find({}).sort('created').exec(function (error, users) {
    if (error) return res.status(400).json({ error: 'Couldn\'t list users.' });
    res.json(users);
  });
};

Users.read = function (req, res) {
  User.findOne({ _id: req.params.id }).exec(function (error, userFound) {
    if (error) return res.status(400).json({ error: 'Couldn\'t find the user.' });
    if (!userFound) return res.status(404).json({ error: 'User doesn\'t exists.' });
    res.json(userFound);
  });
};

Users.update = function (req, res) {
  var user = req.body;
  User.findOne({ _id: req.params.id }).exec(function (error, userFound) {
    if (error) return res.status(400).json({ error: 'Couldn\'t find the user.' });
    if (!userFound) return res.status(404).json({ error: 'User doesn\'t exists.' });
    userFound.status = user.status;
    userFound.save(function (error, userUpdated) {
      if (error) return res.status(400).json({ error: 'Couldn\'t update the user.' });
      res.json(userUpdated);
    });
  });
};

Users.delete = function (req, res) {
  User.findOne({ _id: req.params.id }).exec(function (error, userFound) {
    if (error) return res.status(400).json({ error: 'Couldn\'t find the user.' });
    if (!userFound) return res.status(404).json({ error: 'User doesn\'t exists.' });
    userFound.remove(function (error) {
      if (error) return res.status(400).json({ error: 'Couldn\'t delete the user.' });
      res.json({});
    });
  });
};

Users.setSession = function (req, user) {
  req.session.user = user;
  req.session.save();
  return user;
};

Users.sendConfirmEmail = function (res, user) {
  async.waterfall(
    [
      function (callback) { // token
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          callback(err, token);
        });
      },
      function (token, callback) { // user update
        user.confirmAccountToken = token;
        user.save(function (err) {
          callback(err, token, user);
        });
      },
      function (token, user, callback) { // send email
        callback(Emails.confirmAccount(user, token));
      }
    ],
    function (err, status) {
      if (err) {
        if (err.message) res.status(500).json({ error: err.message });
        else if (err !== true) res.status(500).json({ error: 'We have some problems in this moment. Please, try later.' });
        else res.status(404).json({ error: 'Sorry, this email address doesn\'t exist.' });
      } else {
        res.json({ user: user, message: 'A link has been sent to your email to confirm your email address.' });
      }
    }
  );
};

Users.create = function (req, res) {
  var user = req.body;
  var o = {};
  o.email = user.email.toLowerCase();
  o.username = user.username.toLowerCase();
  o.password = user.password;
  req.assert('email', 'Please, enter a valid email address.').isEmail();
  req.assert('username', 'Username must be at least 4 characters long.').len(4, 50);
  req.assert('password', 'Password must be between 8-20 characters long.').len(8, 20);
  var errors = req.validationErrors();
  if (errors) return res.status(400).json({ error: errors[0].msg });
  User.create(o, function (error, userCreated) {
    if (error) {
      for (var i in error.errors) {
        return res.status(400).json({ error: error.errors[i].message });
      }
      return res.status(400).json({ error: 'We couldn\'t create your account. Please contact us at hello@domain.com.' });
    }
    Users.subscribeUser(o.email);
    Users.setSession(req, userCreated);
    Users.sendConfirmEmail(res, userCreated);
  });
};

Users.confirmAccount = function (req, res) {
  User.findOne({ confirmAccountToken: req.params.token }).exec(function (error, userFound) {
    if (error) return res.status(400).json({ error: error });
    if (!userFound) return res.status(400).json({ error: 'The password recovery token expired. Please request another password change.' });
    userFound.confirmAccountToken = undefined;
    userFound.save(function (error) {
      if (error) return res.status(400).json({ error: 'We couldn\'t confirm your account. Please contact us at hello@domain.com.' });
      Emails.newAccount(userFound);
      res.json(Users.setSession(req, userFound));
    });
  });
};

Users.login = function (req, res) {
  var user = req.body;
  req.assert('email', 'Please, enter a valid email address.').isEmail();
  req.assert('password', 'Password must be between 8-20 characters long.').len(8, 20);
  var errors = req.validationErrors();
  if (errors) return res.status(400).json({ error: errors[0].msg });
  User.findOne({ email: user.email.toLowerCase() }).exec(function (error, userFound) {
    if (error || !userFound || !userFound.authenticate(user.password)) return res.status(404).json({ error: 'Sorry, those credentials are invalid.' });
    res.json(Users.setSession(req, userFound));
  });
};

Users.loginFacebook = function(req, res) {
  var accessTokenUrl = 'https://graph.facebook.com/v2.11/oauth/access_token';
  var graphApiUrl = 'https://graph.facebook.com/v2.11/me?locale=en_US&fields=name,email,location';
  var params = {
    grant_type: 'fb_exchange_token',
    client_id: config.strategies.facebook.clientID,
    client_secret: config.strategies.facebook.clientSecret,
    fb_exchange_token: req.body.accessToken
  };

  // Step 1. Exchange authorization code for access token.
  request.get({
    url: accessTokenUrl,
    qs: params,
    json: true
  }, function(err, response, accessToken) {
    if (response.statusCode !== 200) {
      return res.status(500).json({
        error: accessToken.error.message
      });
    }

    // Step 2. Retrieve profile information about the current user.
    request.get({
      url: graphApiUrl,
      qs: accessToken,
      json: true
    }, function(err, response, profile) {
      if (response.statusCode !== 200) {
        return res.status(500).json({
          error: profile.error.message
        });
      }

      profile.accessToken = accessToken.access_token;
      var user = {};

      // Step 3a. Link user accounts.
      if (req.session.user) {
        User.findOne({
          'facebook.id': profile.id
        }, function(err, existingUser) {
          if (existingUser) {
            return res.status(400).json({
              error: 'There is already a Facebook account that belongs to you.'
            });
          }
          user = req.session.user;
          user.name = user.name || profile.name || profile.displayName || '';
          user.facebook = profile;
          user.save(function() {
            return res.json({ user: Users.setSession(req, user) });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({
          $or: [{
            'facebook.id': profile.id
          }, {
            email: profile.email
          }]
        }, function(err, existingUser) {
          if (existingUser && existingUser.facebook) {
            return res.json({ user: Users.setSession(req, existingUser) });
          } else if (existingUser) {
            user = existingUser;
            user.name = user.name || profile.name || profile.displayName || '';
            user.photo = user.photo || 'https://graph.facebook.com/v2.11/' + profile.id + '/picture?type=large';
            user.facebook = profile;
            user.save(function() {
              return res.json({ user: Users.setSession(req, user) });
            });
          } else {
            user = new User({
              name: profile.name || profile.displayName || '',
              email: profile.email,
              photo: 'https://graph.facebook.com/v2.11/' + profile.id + '/picture?type=large',
              provider: 'facebook',
              facebook: profile
            });
            var username = _.escape(user.email.substring(0, user.email.indexOf('@'))).toLowerCase();
            var verifyUsername = function (counter) {
              user.username = username + String(counter);
              if (counter === '') counter = 1;
              user.save(function(error) {
                if (error && counter < 10) {
                  counter++;
                  verifyUsername(counter);
                } else if (error) {
                  return res.status(400).json({
                    error: 'Facebook failed, please contact with hello@domain.com.'
                  });
                } else {
                  Users.subscribeUser(user.email);
                  Emails.newAccount(user);
                  return res.json({ user: Users.setSession(req, user), created: true });
                }
              });
            };
            verifyUsername('');
          }
        });
      }
    });
  });
};

Users.loginTwitter = function(req, res) {
  var consumer = new oauth.OAuth('https://api.twitter.com/oauth/request_token', 'https://api.twitter.com/oauth/access_token', config.strategies.twitter.clientID, config.strategies.twitter.clientSecret, '1.0A', config.strategies.twitter.callbackURL, 'HMAC-SHA1');
  consumer.get('https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true', req.body.oauth_token, req.body.oauth_token_secret, function (error, data, response) {
    if (error) {
      res.status(400).json({ error: 'Sorry, those credentials are invalid.' });
    } else {

      var twitterData = JSON.parse(data);
      var profile = {};
      profile.oauth_token = req.body.oauth_token;
      profile.oauth_token_secret = req.body.oauth_token_secret;
      profile.id = twitterData.id || '';
      profile.name = twitterData.name || '';
      profile.screen_name = twitterData.screen_name || '';
      profile.email = twitterData.email || '';
      profile.location = twitterData.location || '';
      profile.description = twitterData.description || '';
      profile.url = twitterData.url || '';
      profile.followers_count = twitterData.followers_count || '';
      profile.friends_count = twitterData.friends_count || '';
      profile.listed_count = twitterData.listed_count || '';
      profile.favourites_count = twitterData.favourites_count || '';
      profile.created_at = twitterData.created_at || '';
      profile.profile_image_url_https = twitterData.profile_image_url_https || '';

      var user = {};

      // Step 3a. Link user accounts.
      if (req.session.user) {
        User.findOne({
          'twitter.id': profile.id
        }, function(err, existingUser) {
          if (existingUser) {
            return res.status(400).json({
              error: 'There is already a Twitter account that belongs to you.'
            });
          }
          user = req.session.user;
          user.name = user.name || profile.name;
          user.photo = user.photo || profile.profile_image_url_https;
          user.twitter = profile;
          user.save(function() {
            return res.json({ user: Users.setSession(req, user) });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({
          $or: [{
            'twitter.id': profile.id
          }, {
            email: profile.email
          }]
        }, function(err, existingUser) {
          if (existingUser && existingUser.twitter) {
            return res.json({ user: Users.setSession(req, existingUser) });
          } else if (existingUser) {
            user = existingUser;
            user.name = user.name || profile.name;
            user.photo = user.photo || profile.profile_image_url_https;
            user.twitter = profile;
            user.save(function() {
              return res.json({ user: Users.setSession(req, user) });
            });
          } else {
            user = new User({
              name: profile.name,
              email: profile.email,
              photo: profile.profile_image_url_https,
              provider: 'twitter',
              twitter: profile
            });
            var username = profile.screen_name.toLowerCase();
            var verifyUsername = function (counter) {
              user.username = username + String(counter);
              if (counter === '') counter = 1;
              user.save(function(error) {
                if (error && counter < 10) {
                  counter++;
                  verifyUsername(counter);
                } else if (error) {
                  return res.status(400).json({
                    error: 'Twitter failed, please contact with hello@domain.com.'
                  });
                } else {
                  Users.subscribeUser(user.email);
                  Emails.newAccount(user);
                  return res.json({ user: Users.setSession(req, user), created: true });
                }
              });
            };
            verifyUsername('');
          }
        });
      }
    } 
  });
}

Users.logout = function (req, res) {
  req.session.destroy();
  res.json({});
};

Users.me = function (req, res) {
  res.json(Users.setSession(req, req.session.user));
};

Users.updateUser = function (req, res) {
  var user = req.session.user, index;
  req.body.status = req.body.status == 'true';
  User.findOne({ _id: user._id }).exec(function (error, userFound) {
    if (userFound.confirmAccountToken) return res.status(404).json({ error: 'Please confirm your account first. Check your email :)' });
    switch (req.body.action) {
      case 'settings': // Update user information
        userFound.username = req.body.username.toLowerCase() || userFound.username;
        userFound.email = req.body.email.toLowerCase() || userFound.email;
        if (req.body.password !== '' && req.body.newPassword !== '') {
          req.assert('password', 'Password must be between 8-20 characters long.').len(8, 20);
          req.assert('newPassword', 'Password must be between 8-20 characters long.').len(8, 20);
          var errors = req.validationErrors();
          if (errors) return res.status(400).json({ error: errors[0].msg });
          if (!userFound.authenticate(req.body.password)) return res.status(404).json({ error: 'Sorry, your password is invalid.' });
          userFound.password = req.body.newPassword;
        }
        break;
      case 'franchises': // Add or remove a franchise from the user franchises list
        if (!req.body.franchise || !ObjectId.isValid(req.body.franchise)) return res.status(500).json({ error: 'Invalid franchise.' });
        userFound.franchises = userFound.franchises || [];
        index = userFound.franchises.indexOf(req.body.franchise);
        if (index === -1) {
          if (!req.body.status) userFound.franchises.push(req.body.franchise);
        } else {
          if (req.body.status) userFound.franchises.splice(index, 1);
        }
        Users.runFeed(userFound);
        break;
      case 'categories': // Add or remove a category from the user categories list
        if (!req.body.category || !ObjectId.isValid(req.body.category)) return res.status(500).json({ error: 'Invalid category.' });
        userFound.categories = userFound.categories || [];
        index = userFound.categories.indexOf(req.body.category);
        if (index === -1) {
          if (!req.body.status) userFound.categories.push(req.body.category);
        } else {
          if (req.body.status) userFound.categories.splice(index, 1);
        }
        Users.runFeed(userFound);
        break;
      case 'subcategories': // Add or remove a subcategory from the user subcategories list
        if (!req.body.subcategory || !ObjectId.isValid(req.body.subcategory)) return res.status(500).json({ error: 'Invalid subcategory.' });
        userFound.subcategories = userFound.subcategories || [];
        index = userFound.subcategories.indexOf(req.body.subcategory);
        if (index === -1) {
          if (!req.body.status) userFound.subcategories.push(req.body.subcategory);
        } else {
          if (req.body.status) userFound.subcategories.splice(index, 1);
        }
        Users.runFeed(userFound);
        break;
      case 'like': // Add or remove a product from the likes products list
        if (!req.body.product || !ObjectId.isValid(req.body.product)) return res.status(500).json({ error: 'Invalid product.' });
        userFound.likes = userFound.likes || [];
        index = userFound.likes.indexOf(req.body.product);
        if (index === -1) {
          if (!req.body.status) userFound.likes.push(req.body.product);
        } else {
          if (req.body.status) userFound.likes.splice(index, 1);
        }
        Products.userAction('like', req.body.product, user._id, req.body.status);
        break;
      case 'favorite': // Add or remove a product from the favorites products list
        if (!req.body.product || !ObjectId.isValid(req.body.product)) return res.status(500).json({ error: 'Invalid product.' });
        userFound.favorites = userFound.favorites || [];
        index = userFound.favorites.indexOf(req.body.product);
        if (index === -1) {
          if (!req.body.status) userFound.favorites.push(req.body.product);
        } else {
          if (req.body.status) userFound.favorites.splice(index, 1);
        }
        Products.userAction('favorite', req.body.product, user._id, req.body.status);
        break;
    }
    userFound.save()
      .then(userUpdated => {
        res.json(Users.setSession(req, userUpdated));
      })
      .catch(error => {
        if (error) {
          for (var i in error.errors) {
            return res.status(400).json({ error: error.errors[i].message });
          }
          return res.status(400).json({ error: 'Couldn\'t update your profile.' });
        }
      });
  });
};

Users.allFavorites = function (req, res) {
  var user = req.session.user;
  User.findOne({ _id: user._id }).exec(function (error, userFound) {
    Products.listArray(userFound.favorites)
      .then(products => {
        res.json(products);
      })
      .catch(error => {
        res.status(400).json(error);
      });
  });
};

Users.allSales = function (req, res) {
  var user = req.session.user;
  User.findOne({ _id: user._id }).exec(function (error, userFound) {
    Products.listArray(userFound.favorites, true)
      .then(products => {
        res.json(products);
      })
      .catch(error => {
        res.status(400).json(error);
      });
  });
};

Users.forgotPassword = function (req, res) {
  async.waterfall(
    [
      function (callback) { // token
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          callback(err, token);
        });
      },
      function (token, callback) { // user update
        User.findOne({ email: req.body.email }).exec(function (error, userFound) {
          if (error || !userFound) return callback(true);
          userFound.resetPasswordToken = token;
          userFound.resetPasswordExpires = Date.now() + 3600000; // 1 hour
          userFound.save(function (err) {
            callback(err, token, userFound);
          });
        });
      },
      function (token, user, callback) { // send email
        callback(Emails.forgotPassword(user, token));
      }
    ],
    function (err, status) {
      if (err) {
        if (err.message) res.status(500).json({ error: err.message });
        else if (err !== true) res.status(500).json({ error: 'We have some problems in this moment. Please, try later.' });
        else res.status(404).json({ error: 'Sorry, this email address doesn\'t exist.' });
      } else {
        res.json({ message: 'A reset link has been sent to your email.' });
      }
    }
  );
};

Users.resetPassword = function (req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }).exec(function (error, userFound) {
    if (error) return res.status(400).json({ error: error });
    if (!userFound) return res.status(400).json({ error: 'Invalid or expired token. Please, request your new password again.' });
    req.assert('password', 'Password must be between 8-20 characters long.').len(8, 20);
    req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
    var errors = req.validationErrors();
    if (errors) return res.status(400).json({ error: errors[0].msg });
    userFound.password = req.body.password;
    userFound.resetPasswordToken = undefined;
    userFound.resetPasswordExpires = undefined;
    userFound.save(function (error) {
      if (error) return res.status(400).json({ error: 'Couldn\'t update the password. Please, try later.' });
      res.json({});
    });
  });
};

Users.getById = function (id, cb) {
  var deferred = Q.defer();
  User.findOne({ _id: id }).exec(function (error, userFound) {
    if (error) deferred.reject(error);
    else {
      if (!userFound) deferred.reject({ error: { message: 'User doesnt exists' } });
      else deferred.resolve(userFound);
    }
  });
  return deferred.promise;
};

Users.sendAlerts = function (req, res) {
  User.find({ status: true, 'favorites.0': { $exists: true } }, 'username email favorites').lean()
    .then(usersFound => {
      async.each(usersFound, (userFound, cb) => {
        Alerts.sendAlert(userFound);
        cb();
      }, err => {
        Alerts.removeAlerts();
        res.json({});
      });
    })
    .catch(err => {
      res.status(400).json({error: 'Couldn\'t updated the featured posts.'});
    });
};

Users.subscribeUser = (email) => {
  var deferred = Q.defer();
  var url = config.domain + '/subscribe.php';
  request.post({
    headers: {'content-type' : 'application/x-www-form-urlencoded'},
    url:     url,
    body:    'email=' + email
  }, function(error, response, body) {
    if (error)
      deferred.reject(error);
    else
      deferred.resolve(response);
  });
  return deferred.promise;
};

Users.feed = function (req, res) {
  var user = req.session.user;
  User.findOne({ _id: user._id }).populate('franchises').lean().exec(function (error, userFound) {
    Products.listArray(userFound.feed)
      .then(products => {
        userFound.products = products;
        delete userFound.feed;
        res.json(userFound);
      })
      .catch(error => {
        res.status(400).json(error);
      });
  });
};

Users.runFeed = (user) => {
  var r = 'cd scrapers/;nohup python feed.py ' + user._id + ' > feed.out';
  cmd.get(r, function (err, data, stderr) {
    if (err) {
      console.log(err.stack);
    }
  });
};