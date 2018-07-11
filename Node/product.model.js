'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  slug = require('slug'),
  randomstring = require('randomstring'),
  Schema = mongoose.Schema;

/**
 * My Schema
 */
var MySchema = new Schema({
  // Name
  name: {
    type: String,
    required: true
  },
  // Name without spaces and special characters
  normalized: {
    type: String,
    unique: true,
    trim: true
  },
  // Name formatted for url friendly
  slug: {
    type: String,
    unique: true,
    trim: true
  },
  // Product detail url
  url: {
    type: String,
    required: true
  },
  // Product id by retailer
  product_id: {
    type: String,
    required: true
  },
  // Product UPC
  upc: {
    type: String
  },
  // Small image
  small_image: {
    type: String
  },
  // Medium image
  medium_image: {
    type: String
  },
  // Large image
  large_image: {
    type: String
  },
  // Product Retailers
  retailers: {
    type: [{
      type: Schema.ObjectId,
      ref: 'Retailer'
    }],
    default: []
  },
  // Product Franchises
  franchises: {
    type: [{
      type: Schema.ObjectId,
      ref: 'Franchise'
    }],
    default: []
  },
  // Product Brand
  brand: {
    type: Schema.ObjectId,
    ref: 'Brand',
  },
  // Product Categories
  categories: {
    type: [{
      type: Schema.ObjectId,
      ref: 'Category'
    }],
    default: []
  },
  // Product Sub-Categories
  subcategories: {
    type: [{
      type: Schema.ObjectId,
      ref: 'Subcategory'
    }],
    default: []
  },
  // List Price
  list_price: {
    type: Number
  },
  // Lowest New Price
  lowest_new_price: {
    type: Number
  },
  // Offer Listing Price
  offer_listing_price: {
    type: Number
  },
  // Color
  color: {
    type: String
  },
  // Clothing size if exists, ex. 6-9 months Long Sleeve Onesie
  clothing_size: {
    type: String
  },
  // Binding ex. Apparel
  binding: {
    type: String
  },
  // Total of new products
  total_new: {
    type: Number
  },
  // Total of used products
  total_used: {
    type: Number
  },
  // Availability ex. Usually ships in 1-2 business days
  availability: {
    type: String
  },
  // Total of offers
  total_offers: {
    type: Number
  },
  // Flag if the product is available
  // 1 = In-Stock, 2 = Unavailable, 3 = Preorder, 4 = Backorder
  available: {
    type: Number,
    default: 1
  },
  // Features ex. "100% Soft Cotton", "Fast Shipping", ...
  feature: {
    type: [
      {
        type: String
      }
    ],
    default: []
  },
  // Product description
  description: {
    type: String
  },
  // Promotions
  promotions: {
    type: [{
      promotion_id: {
        type: String
      },
      category: {
        type: String
      },
      description: {
        type: String
      },
    }],
    default: []
  },
  // Random number to shuffle products
  random: {
    type: Number,
    default: parseInt(Math.random() * 100000000)
  },
  // Sales rank
  sales_rank: {
    type: Number
  },
  // Sales savings
  sale_saving: {
    type: Number,
    default: 0
  },
  // Created date
  created: {
    type: Date,
    default: Date.now
  },
  // Updated date
  updated: {
    type: Date
  },
  // If a product is discontinued
  discontinued: {
    type: Boolean,
    default: false
  },
  // If all product data is correct
  verified: {
    type: Boolean,
    default: true
  },
  // If a product was created manually or by web scrapers
  manually: {
    type: Boolean,
    default: false
  },
  // How many times did a user click on a product
  views: {
    type: Number,
    default: 0
  },
  // Shipping Info
  shipping_info: {
    type: {
      expeditedShipping: {
        type: Boolean,
        default: false
      },
      handlingTime: {
        type: Number
      },
      oneDayShippingAvailable: {
        type: Boolean,
        default: false
      },
      shipToLocations: {
        type: String
      },
      shippingServiceCost: {
        type: {
          _currencyId: {
            type: String
          },
          value: {
            type: Number
          },
        },
        default: {}
      },
    },
    default: {}
  },
  // Store Info
  store_info: {
    type: {
      storeName: {
        type: String
      },
      storeURL: {
        type: String
      },
    },
    default: {}
  },
  // Seller Info
  seller_info: {
    type: {
      feedbackRatingStar: {
        type: String
      },
      feedbackScore: {
        type: Number
      },
      positiveFeedbackPercent: {
        type: Number
      },
      sellerUserName: {
        type: String
      },
      topRatedSeller: {
        type: Boolean
      },
    },
    default: {}
  },
  // Product status
  active: {
    type: Boolean,
    default: true
  },
  // Shipping Value
  shipping: {
    type: Number,
    default: null
  },
  // Final Price: lowest_new_price + shipping
  price: {
    type: Number,
    default: 0
  },
  // Users Likes
  likes: {
    type: [{type: Schema.ObjectId, ref: 'User'}],
    default: []
  },
  // Users Favorites
  favorites: {
    type: [{type: Schema.ObjectId, ref: 'User'}],
    default: []
  },
  // If any user has this product as favorite
  notify: {
    type: Boolean,
    default: false
  },
  // Date for sort
  published: {
    type: Date
  },
  // Most popular products
  is_trending: {
    type: Boolean,
    default: false
  },
  // In Feed
  in_feed: {
    type: Boolean,
    default: false
  }
});

MySchema.index({ name: 'text' });

/**
 * Pre-save hook
 * 
 * create unique normalized and slug fields before save a product
 */
MySchema.pre('save', function (next) {
  this.updated = new Date();
  var _normalized = this.name.toLowerCase().replace(/\W/g, '');
  var _slug = slug(this.name, { lower: true });

  var self = this;
  var random = randomstring.generate(5);
  if (!this.normalized) {
    this
      .constructor
      .findOne({
        normalized: _normalized,
      })
      .then(productFound => {
        if (!productFound) {
          self.normalized = _normalized;
          self.slug = _slug;
        } else {
          self.normalized = _normalized + '-' + random;
          self.slug = _slug + '-' + random;
        }
        next();
      })
      .catch(e => {
        self.normalized = _normalized + '-' + random;
        self.slug = _slug + '-' + random;
        next();
      });
  } else {
    next();
  }
});

module.exports = mongoose.model('Product', MySchema);