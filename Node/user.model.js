'use strict';

/**
 * Module dependencies.
 */
var mongoose  = require('mongoose'),
  Schema = mongoose.Schema,
  crypto = require('crypto'),
  _ = require('lodash');

/**
 * Validations
 */
var validatePresenceOf = function(value) {
  // If you are authenticating by any of the oauth strategies, don't validate.
  return (this.provider && this.provider !== 'local') || (value && value.length);
};

var validateUniqueEmail = function(value, callback) {
  var User = mongoose.model('User');
  User.find({ email: value, _id: { $ne: this._id } }, function(err, user) {
    callback(err || user.length === 0);
  });
};

var validateUniqueUsername = function(value, callback) {
  var User = mongoose.model('User');
  User.find({ username: value, _id: { $ne: this._id } }, function(err, user) {
    callback(err || user.length === 0);
  });
};

/**
 * Getter
 */
var escapeProperty = function(value) {
  return _.escape(value);
};

/**
 * My Schema
 */

var MySchema = new Schema({
  name: {
    type: String,
    get: escapeProperty
  },
  email: {
    type: String,
    required: true,
    unique: true,
    // Regexp to validate emails with more strict rules as added in tests/users.js which also conforms mostly with RFC2822 guide lines
    match: [/^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please enter a valid email address.'], //"
    validate: [validateUniqueEmail, 'Email address is already in-use.']
  },
  photo: String,
  username: {
    type: String,
    unique: true,
    required: true,
    match: [/^[-\w\.]{4,50}$/, 'Please enter a valid username.'],
    validate: [validateUniqueUsername, 'Username is already in-use.']
  },
  hashed_password: {
    type: String,
    validate: [validatePresenceOf, 'Password cannot be blank.']
  },
  salt: String,
  confirmAccountToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  provider: {
    type: String,
    default: 'local'
  },
  facebook: {},
  twitter: {},
  likes: {
    type: [{type: Schema.ObjectId, ref: 'Product'}],
    default: []
  },
  favorites: {
    type: [{type: Schema.ObjectId, ref: 'Product'}],
    default: []
  },
  franchises: {
    type: [{type: Schema.ObjectId, ref: 'Franchise'}],
    default: []
  },
  categories: {
    type: [{type: Schema.ObjectId, ref: 'Category'}],
    default: []
  },
  subcategories: {
    type: [{type: Schema.ObjectId, ref: 'Subcategory'}],
    default: []
  },
  feed: {
    type: [{type: Schema.ObjectId, ref: 'Product'}],
    default: []
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date
  },
  status: {
    type: Boolean,
    default: true
  },
});

/**
 * Virtuals
 */
MySchema.virtual('password').set(function(password) {
  this._password = password;
  this.salt = this.makeSalt();
  this.hashed_password = this.hashPassword(password);
}).get(function() {
  return this._password;
});

/**
 * Pre-save hook
 */
MySchema.pre('save', function(next) {
  if (this.isNew && this.provider === 'local' && this.password && !this.password.length)
    return next(new Error('Invalid password.'));
  next();
});

/**
 * Methods
 */

/**
 * Authenticate - check if the passwords are the same
 *
 * @param {String} plainText
 * @return {Boolean}
 * @api public
 */
MySchema.methods.authenticate = function(plainText) {
  return this.hashPassword(plainText) === this.hashed_password;
};

/**
 * Make salt
 *
 * @return {String}
 * @api public
 */
MySchema.methods.makeSalt = function() {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * Hash password
 *
 * @param {String} password
 * @return {String}
 * @api public
 */
MySchema.methods.hashPassword = function(password) {
  if (!password || !this.salt) return '';
  var salt = new Buffer(this.salt, 'base64');
  return crypto.pbkdf2Sync(password, salt, 10000, 64).toString('base64');
};

/**
 * Hide security sensitive fields
 *
 * @returns {*|Array|Binary|Object}
 */
MySchema.methods.toJSON = function() {
  var obj = this.toObject();
  delete obj.hashed_password;
  delete obj.salt;
  return obj;
};

mongoose.model('User', MySchema);