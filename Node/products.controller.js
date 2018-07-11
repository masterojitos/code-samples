'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Q = require('q'),
  async = require('async'),
  request = require('request'),
  pluralize = require('pluralize'),
  moment = require('moment-timezone'),
  config = require('meanio').getConfig(),
  ObjectId = mongoose.Types.ObjectId,
  Brand = mongoose.model('Brand'),
  Product = mongoose.model('Product'),
  Article = mongoose.model('Article'),
  Post = mongoose.model('Post'),
  Franchises = require('./franchises'),
  Categories = require('./categories'),
  Subcategories = require('./subcategories'),
  cmd = require('node-cmd');

var OperationHelper = require('apac').OperationHelper;
var opHelper = new OperationHelper(config.AWSECommerceService);

/**
 * Exports.
 */
var Products = {};
module.exports = Products;

Products.productDetailFields = 'name slug url list_price lowest_new_price retailers small_image medium_image large_image store available sale_saving updated description brand total_new total_offers offers other_offers vm_pick release vaulted shipping price likes favorites set_slug categories subcategories other_images published is_trending views';

Products.getProductDetail = (product) => {
  product.slug = product.set_slug;
  product.link = product.url;
  if (product.store && product.store > 1) product.url = '/product/' + product._id + '/';
  product.image = product.large_image ? product.large_image : (product.medium_image ? product.medium_image : (product.small_image ? product.small_image : ''));
  var availablesAmazon = ['from', 'Might be out of stock'];
  var availablesOthers = ['In-Stock', 'Out of Stock', 'Preorder', 'Backorder'];
  product.from = !product.store ? availablesAmazon[product.available - 1] : availablesOthers[product.available - 1];
  if (product.store === 11 || ((product.from === 'In-Stock' || product.from === 'Preorder') && product.offers && parseFloat(product.offers.length) > 0)) product.from = 'from';
  product.list_price = parseFloat(product.list_price) > 0 ? parseFloat(product.list_price).toFixed(2) : 'N/A';
  product.lowest_new_price = parseFloat(product.lowest_new_price) > 0 ? parseFloat(product.lowest_new_price).toFixed(2) : 'N/A';
  product.retailer = product.retailers.length > 0 ? product.retailers[0].name : '';
  product.description = product.description ? product.description : '';
  product.brand = product.brand ? product.brand.name : '';
  product.shipping = product.shipping !== null && product.shipping !== undefined ? product.shipping : '-';
  product.price = product.price ? product.price : 0;
  product.condition = product.total_new > 0 ? 'New' : 'Used';
  product.total_offers = product.total_offers ? product.total_offers : 0;
  product.updated = moment(product.updated).tz('America/Los_Angeles').format('MM-DD-YYYY - h:mma');
  product.likes = product.likes ? product.likes : [];
  product.favorites = product.favorites ? product.favorites : [];
  product.is_new = Products.isNew(product.published);
  if (!product.category) product.category = product.categories && product.categories.length > 0 ? product.categories[0].name : '';
  if (!product.subcategory) product.subcategory = product.subcategories && product.subcategories.length > 0 ? product.subcategories[0].name : '';
  product.other_images = product.other_images ? product.other_images : [];
  delete product.set_slug;
  delete product.large_image;
  delete product.medium_image;
  delete product.small_image;
  delete product.retailers;
  delete product.total_new;
  delete product.published;
  if (product.categories) delete product.categories;
  if (product.subcategories) delete product.subcategories;
  return product;
};

Products.getProductById = (id) => {
  var deferred = Q.defer();
  Product.findOne({ _id: id, active: true, discontinued: false, $and: [ { $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }, { $or: [{ collection: { $exists: false } }, { collection: false }, { collection: true, parent: true }] }, { $or: [{ hidden: { $exists: false } }, { hidden: false }] } ] }, Products.productDetailFields).populate('retailers').populate('brand').populate('categories').populate('subcategories').lean()
    .then((productFound) => {
      if (!productFound) deferred.reject(null);
      if (!productFound.image) productFound = Products.getProductDetail(productFound);
      deferred.resolve(productFound);
    })
    .catch(err => {
      deferred.reject(err);
    });
  return deferred.promise;
};

Products.isNew = (productDate) => {
  var productMoment = moment(productDate);
  var currentMoment = moment(new Date());
  return currentMoment.diff(productMoment, 'days') < 5;
};

Products.all = (req, res) => {
  var products = Product.aggregate();
  
  var query = [];
  if (req.body.franchises && req.body.franchises.length > 0)
    query.push({ franchises: { $in: req.body.franchises.map(franchise => new ObjectId(franchise)) } });
  if (req.body.categories && req.body.categories.length > 0)
    query.push({ categories: { $in: req.body.categories.map(category => new ObjectId(category)) } });
  if (query.length > 0) 
    products.match({ $and: query });

  products.lookup({
    from: 'retailers',
    localField: 'retailers',
    foreignField: '_id',
    as: 'retailersPopulate'
  });
  products.lookup({
    from: 'franchises',
    localField: 'franchises',
    foreignField: '_id',
    as: 'franchisesPopulate'
  });
  products.lookup({
    from: 'brands',
    localField: 'brand',
    foreignField: '_id',
    as: 'brandPopulate'
  });
  products.lookup({
    from: 'categories',
    localField: 'categories',
    foreignField: '_id',
    as: 'categoriesPopulate'
  });
  products.lookup({
    from: 'subcategories',
    localField: 'subcategories',
    foreignField: '_id',
    as: 'subcategoriesPopulate'
  });
  products.project({
    _id: 1,
    name: 1,
    url: 1,
    product_id: 1,
    list_price: 1,
    lowest_new_price: 1,
    offer_listing_price: 1,
    small_image: 1,
    medium_image: 1,
    large_image: 1,
    retailers: '$retailersPopulate.name',
    franchises: '$franchisesPopulate.name',
    brand: { $arrayElemAt: [ '$brandPopulate.name', 0 ] },
    categories: '$categoriesPopulate.name',
    subcategories: '$subcategoriesPopulate.name',
    store: 1,
    available: 1,
    sale_saving: 1,
    created: 1,
    updated: 1,
    active: 1
  });
  products.sort({
    'franchisesPopulate.created': 1,
    created: 1
  });
  products.exec((err, products) => {
    if (err) {
      res.status(500).json(err);
    } else {
      async.each(products, (product, callback) => {
        product.image = product.large_image ? product.large_image : (product.medium_image ? product.medium_image : (product.small_image ? product.small_image : ''));
        product.list_price = (product.list_price || 0).toFixed(2);
        product.lowest_new_price = (product.lowest_new_price || 0).toFixed(2);
        if (!product.store && product.available === 2) {
          product.list_price = product.lowest_new_price = 'N/A';
        }
        product.created = moment(product.created).tz('America/Los_Angeles').format('MM-DD-YYYY - h:mma');
        product.updated = moment(product.updated).tz('America/Los_Angeles').format('MM-DD-YYYY - h:mma');
        delete product.large_image;
        delete product.medium_image;
        delete product.small_image;
        callback();
      }, err => {
        res.json(products);
      });
    }
  });
};

Products.search = (req, res) => {
  var query = [];
  var queryArticles = [];
  var filtersExist = false;
  var littleFiltersExist = false;
  var franchiseFilterExist = false;
  var franchiseObject = null;
  var categoryFilterExist = false;
  var categoryObject = null;
  var subcategoryFilterExist = false;
  var subcategoryObject = null;
  if (req.body.keywords && req.body.keywords.trim().length > 0) {
    filtersExist = true;
    query.push({ $and: decodeURIComponent(req.body.keywords.trim().replace(/\+/g, '%20')).split(' ').map(keyword => { return { name: new RegExp(pluralize.singular(keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')), 'i') } } ) });
    queryArticles.push({ $or: decodeURIComponent(req.body.keywords.trim().replace(/\+/g, '%20')).split(' ').map(keyword => { return { name: new RegExp(pluralize.singular(keyword.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')), 'i') } } ) });
  }
  if (req.body.retailers && req.body.retailers.length > 0) {
    filtersExist = true;
    query.push({ retailers: { $in: req.body.retailers.map(retailer => new ObjectId(retailer)) } });
  }
  if (req.body.franchises && req.body.franchises.length > 0) {
    filtersExist = true;
    franchiseFilterExist = true;
    query.push({ franchises: { $in: req.body.franchises.map(franchise => new ObjectId(franchise)) } });
    queryArticles.push({ franchises: { $in: req.body.franchises.map(franchise => new ObjectId(franchise)) } });
    Franchises.getById(new ObjectId(req.body.franchises[0]))
      .then(franchiseFound => {
        franchiseObject = franchiseFound;
      });
  }
  if (req.body.categories && req.body.categories.length > 0) {
    categoryFilterExist = true;
    query.push({ categories: { $in: req.body.categories.map(category => new ObjectId(category)) } });
    queryArticles.push({ categories: { $in: req.body.categories.map(category => new ObjectId(category)) } });
    if (!franchiseFilterExist) {
      Categories.getById(new ObjectId(req.body.categories[0]))
        .then(categoryFound => {
          categoryObject = categoryFound;
        });
    }
  }
  if (req.body.subcategories && req.body.subcategories.length > 0) {
    filtersExist = true;
    subcategoryFilterExist = true;
    queryArticles.push({ subcategories: { $in: req.body.subcategories.map(subcategory => new ObjectId(subcategory)) } });
    if (!franchiseFilterExist) {
      Subcategories.getById(new ObjectId(req.body.subcategories[0]))
        .then(subcategoryFound => {
          subcategoryObject = subcategoryFound;
        });
    }
  }
  if (req.body.min_price && parseFloat(req.body.min_price) > 0) {
    filtersExist = true;
    query.push({ lowest_new_price: { $gt: parseFloat(req.body.min_price) } });
  }
  if (req.body.max_price && parseFloat(req.body.max_price) > 0) {
    filtersExist = true;
    query.push({ lowest_new_price: { $lt: parseFloat(req.body.max_price) } });
  }
  if (req.body.sale && parseInt(req.body.sale) > 0) {
    filtersExist = true;
    query.push({ sale_saving: { $gte: parseInt(req.body.sale) } });
  }
  if (req.body.availability && req.body.availability.length > 0) {
    littleFiltersExist = true;
    query.push({ available: { $in: req.body.availability.map(available => parseInt(available)) } });
  }
  if (req.body.options && req.body.options.length > 0) {
    littleFiltersExist = true;
    var options = req.body.options.map(option => JSON.parse('{"' + option + '":true}') );
    query.push({ $or: options });
  }
  query.push({ active: true });
  query.push({ discontinued: false });
  query.push({ $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] });
  query.push({ $or: [{ collection: { $exists: false } }, { collection: false }, { collection: true, parent: true }] });
  query.push({ $or: [{ hidden: { $exists: false } }, { hidden: false }] });
  if (req.body.sort && parseInt(req.body.sort) === 4) {
    query.push({ lowest_new_price: { $ne: null, $gt: 0 } });
  }
  if (!filtersExist && !categoryFilterExist) {
    query.push({ categories: new ObjectId('5a2f2fcd2dbc0918f567d920') });
  }
  queryArticles.push({ active: true });
  queryArticles.push({ created: { $lte: new Date() }  });

  var result = { products: [], retailers: [], franchises: [], categories: [], subcategories: [], total_retailers: [], total_franchises: [], total_categories: [], total_subcategories: [], articles: [], links: [] };
  var retailerIndex, franchiseIndex, categoryIndex, subcategoryIndex;
  var page = !isNaN(req.body.page) ? parseInt(req.body.page) : 0;

  async.parallel([
    (productsCallback) => {
      var products = Product.aggregate();
      var newQuery = query.slice(0);
      if (subcategoryFilterExist) {
        newQuery.push({ subcategories: { $in: req.body.subcategories.map(subcategory => new ObjectId(subcategory)) } });
      }
      products.match({ $and: newQuery });

      products.project({
        _id: 1,
        retailers: 1,
        franchises: 1,
        categories: 1,
        subcategories: 1,
        lowest_new_price: 1,
        vm_pick: 1,
        random: 1,
        published: { $dateToString: { format: "%Y-%m-%d", date: "$published" } },
        views: 1
      });
      switch (parseInt(req.body.sort)) {
        case 1: 
          products.sort({
          views : -1,
          random: -1
          });
          break;
        case 2: 
          products.sort({
            published : -1,
            random: -1
          });
          break;
        case 3: 
          products.sort({
            lowest_new_price: -1,
            random: 1
          });
          break;
        case 4: 
          products.sort({
            lowest_new_price: 1,
            random: 1
          });
          break;
        default: 
          products.sort({
            views : -1,
            random: -1
          });
      }

      if (page > 0) {
        products.skip(20 * page);
        products.limit(20);
      } else if (categoryFilterExist && !filtersExist) {
        products.skip(0);
        products.limit(70000);
      }

      products.exec((err, products) => {
        if (err) {
          res.status(500).json(err);
        } else {
          if (page === 0) {
            async.parallel([
              (mainCallback) => {
                async.each(products, (product, callback) => {
                  async.parallel([
                    (cb) => {
                      product.retailers.forEach(retailer => {
                        retailerIndex = result.retailers.indexOf(retailer.toString());
                        if (retailerIndex === -1) {
                          result.retailers.push(retailer.toString());
                          result.total_retailers.push(1);
                        } else {
                          result.total_retailers[retailerIndex]++;
                        }
                      });
                      cb();
                    },
                    (cb) => {
                      product.franchises.forEach(franchise => {
                        franchiseIndex = result.franchises.indexOf(franchise.toString());
                        if (franchiseIndex === -1) {
                          result.franchises.push(franchise.toString());
                          result.total_franchises.push(1);
                          if (!franchiseFilterExist && categoryFilterExist) result.links.push({ _id: franchise.toString(), total: 1 });
                        } else {
                          result.total_franchises[franchiseIndex]++;
                          if (!franchiseFilterExist && categoryFilterExist) result.links[franchiseIndex].total++;
                        }
                      });
                      cb();
                    },
                    (cb) => {
                      product.categories.forEach(category => {
                        categoryIndex = result.categories.indexOf(category.toString());
                        if (categoryIndex === -1) {
                          result.categories.push(category.toString());
                          result.total_categories.push(1);
                        } else {
                          result.total_categories[categoryIndex]++;
                        }
                      });
                      cb();
                    },
                    (cb) => {
                      if (subcategoryFilterExist) return cb();
                      product.subcategories.forEach(subcategory => {
                        subcategoryIndex = result.subcategories.indexOf(subcategory.toString());
                        if (subcategoryIndex === -1) {
                          result.subcategories.push(subcategory.toString());
                          result.total_subcategories.push(1);
                          if (franchiseFilterExist) result.links.push({ _id: subcategory.toString(), total: 1 });
                        } else {
                          result.total_subcategories[subcategoryIndex]++;
                          if (franchiseFilterExist) result.links[subcategoryIndex].total++;
                        }
                      });
                      cb();
                    }
                  ],
                  (err, results) => {
                    callback();
                  });
                }, err => {
                  mainCallback();
                });
              },
              (mainCallback) => {
                if (filtersExist || categoryFilterExist || littleFiltersExist) return mainCallback();
                Product.count({ active: true, discontinued: false, $and: [ { $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }, { $or: [{ collection: { $exists: false } }, { collection: false }, { collection: true, parent: true }] }, { $or: [{ hidden: { $exists: false } }, { hidden: false }] } ] }, (err, total) => {
                  result.total_products = total;
                  mainCallback();
                });
              }
            ],
            (err, results) => {
              async.parallel([
                (cb) => {
                  if ((franchiseFilterExist && !subcategoryFilterExist) || categoryFilterExist) {
                    result.links.sort( function(a, b){
                      if ( a.total > b.total ) return -1;
                      else if ( a.total < b.total ) return 1;
                      else return 0;
                    });
                    result.links = result.links.splice(0, 10);
                    if (franchiseFilterExist && !franchiseObject) return cb();
                    if (!franchiseFilterExist && !categoryObject) return cb();
                    if (!franchiseFilterExist && subcategoryFilterExist && !subcategoryObject) return cb();
                    async.eachSeries(result.links, (link, callback) => {
                      if (franchiseFilterExist) {
                        Subcategories.getById(link._id)
                          .then((subcategoryFound) => {
                            link.text = franchiseObject.name + ' ' + (subcategoryFound.categories[0].slug === 'funko' ? 'Funko ' : '') + subcategoryFound.name;
                            link.url = '/browse/' + franchiseObject.slug + '/' + subcategoryFound.categories[0].slug + '/' + subcategoryFound.slug + '/';
                            callback();
                          })
                          .catch(err => {
                            callback();
                          });
                      } else {
                        Franchises.getById(link._id)
                          .then(franchiseFound => {
                            link.text = franchiseFound.name + ' ' + (!subcategoryFilterExist ? categoryObject.name : subcategoryObject.name);
                            link.url = '/browse/' + franchiseFound.slug + '/' + categoryObject.slug + '/' + (subcategoryFilterExist ? subcategoryObject.slug + '/' : '');
                            callback();
                          })
                          .catch(err => {
                            callback();
                          });
                      }
                    }, err => {
                      cb();
                    });
                  } else {
                    cb();
                  }
                },
                (cb) => {
                  if (filtersExist || categoryFilterExist || littleFiltersExist) {
                    result.total_products = products.length;
                  }
                  result.hasFilters = filtersExist || categoryFilterExist;
                  products = products.slice(0, 20);
                  async.eachSeries(products, (product, callback) => {
                    Product.findOne({ _id: product._id }, Products.productDetailFields).populate('retailers').populate('brand').populate('categories').populate('subcategories')
                      .populate({
                        path: 'offers',
                        model: 'Product',
                        select: '_id',
                        match: { active: true, discontinued: false, $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }
                      }).lean()
                      .then((productFound) => {
                        result.products.push(Products.getProductDetail(productFound));
                        callback();
                      })
                      .catch(err => {
                        callback();
                      });
                  }, err => {
                    cb();
                  });
                }
              ],
              (err, results) => {
                productsCallback();
              });
            });
          } else {
            async.eachSeries(products, (product, callback) => {
              Product.findOne({ _id: product._id }, Products.productDetailFields).populate('retailers').populate('brand').populate('categories').populate('subcategories')
                .populate({
                  path: 'offers',
                  model: 'Product',
                  select: '_id',
                  match: { active: true, discontinued: false, $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }
                }).lean()
                .then((productFound) => {
                  result.products.push(Products.getProductDetail(productFound));
                  callback();
                })
                .catch(err => {
                  callback();
                });
            }, err => {
              productsCallback();
            });
          }
        }
      });
    },
    (productsCallback) => {
      if (!subcategoryFilterExist) return productsCallback();
      var products = Product.aggregate();
      products.match({ $and: query });
      products.project({ _id: 1, subcategories: 1 });
      products.exec((err, products) => {
        if (err) {
          res.status(500).json(err);
        } else {
          async.each(products, (product, callback) => {
            product.subcategories.forEach(subcategory => {
              subcategoryIndex = result.subcategories.indexOf(subcategory.toString());
              if (subcategoryIndex === -1) {
                result.subcategories.push(subcategory.toString());
                result.total_subcategories.push(1);
              } else {
                result.total_subcategories[subcategoryIndex]++;
              }
            });
            callback();
          }, err => {
            productsCallback();
          });
        }
      });
    },
    (productsCallback) => {
      if (page > 0) return productsCallback();
      async.parallel([
        (articlesCallback) => {
          Products.searchArticles(queryArticles)
            .then((articles) => {
              articlesCallback(null, articles);
            })
            .catch(err => {
              articlesCallback(null, []);
            });
        },
        (articlesCallback) => {
          Products.searchPosts(queryArticles)
            .then((posts) => {
              articlesCallback(null, posts);
            })
            .catch(err => {
              articlesCallback(null, []);
            });
        }
      ], 
      (err, results) => {
        result.articles = result.articles.concat(results[0], results[1]);
        productsCallback();
      });
    }
  ],
  (err, results) => {
    res.json(result);
  });
};

Products.feed = (req, res) => {
  Product.find({in_feed: true}, {_id: true})
  .limit(10)
  .lean()
  .then(products => {
    var result = [];
    async.eachSeries(products, (product, callback) => {
      Product.findOne({ _id: product._id }, Products.productDetailFields)
      .populate('retailers')
      .populate('brand')
      .populate('categories')
      .populate('subcategories')
        .populate({
          path: 'offers',
          model: 'Product',
          select: '_id',
          match: { active: true, discontinued: false, $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }
        }).lean()
        .then((productFound) => {
          result.push(Products.getProductDetail(productFound));
          callback();
        })
        .catch(err => {
          callback();
        });
    }, err => {
      res.json(result);
    });
  }).catch(error => {
    console.log(error.stack);
    res.status(500).json(error);
  });
};

Products.trending = (req, res) => {
  Product.find({active: true, discontinued: false}, {_id: true, views: true})
  .sort({views: -1})
  .limit(30)
  .lean()
  .then(products => {
    var result = [];
    async.eachSeries(products, (product, callback) => {
      Product.findOne({ _id: product._id }, Products.productDetailFields)
      .populate('retailers')
      .populate('brand')
      .populate('categories')
      .populate('subcategories')
        .populate({
          path: 'offers',
          model: 'Product',
          select: '_id',
          match: { active: true, discontinued: false, $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }
        }).lean()
        .then((productFound) => {
          result.push(Products.getProductDetail(productFound));
          callback();
        })
        .catch(err => {
          callback();
        });
    }, err => {
      res.json(result);
    });
  }).catch(error => {
    console.log(error.stack);
    res.status(500).json(error);
  });
};

Products.read = function (req, res) {
  var query = { active: true, discontinued: false, $and: [ { $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }, { $or: [{ hidden: { $exists: false } }, { hidden: false }] } ] };
  if (req.body._id) {
    query._id = req.body._id;
  } else {
    query = { active: true, discontinued: false, $and: [ { $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] }, { $or: [{ slug: req.params.slug }, { collection: true, parent: true, set_slug: req.params.slug }] }, { $or: [{ hidden: { $exists: false } }, { hidden: false }] } ] }
  }
  Product.findOne(query, Products.productDetailFields + ' franchises')
  .populate('retailers').populate('brand')
  .populate({
    path: 'franchises',
    model: 'Franchise',
    select: 'name slug',
    match: { active: true }
  })
  .populate({
    path: 'categories',
    model: 'Category',
    select: 'name slug',
    match: { active: true }
  })
  .populate({
    path: 'subcategories',
    model: 'Subcategory',
    select: 'name slug',
    match: { active: true }
  })
  .populate({
    path: 'offers',
    model: 'Product',
    select: Products.productDetailFields,
    options: { sort: { price: 1, random: 1 } },
    match: { active: true, discontinued: false, $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] },
    populate: [{ path: 'retailers', model: 'Retailer' }, { path: 'brand', model: 'Brand' }, { path: 'categories', model: 'Category' }, { path: 'subcategories', model: 'Subcategory' }]
  })
  .populate({
    path: 'other_offers',
    model: 'Product',
    select: Products.productDetailFields,
    options: { sort: { random: 1 } },
    match: { active: true, discontinued: false, $or: [{ small_image: { $ne: null } }, { medium_image: { $ne: null } }, { large_image: { $ne: null } }] },
    populate: [{ path: 'retailers', model: 'Retailer' }, { path: 'brand', model: 'Brand' }, { path: 'categories', model: 'Category' }, { path: 'subcategories', model: 'Subcategory' }]
  })
  .lean()
  .exec(function (error, productFound) {
    if (error) return res.status(400).json({error: 'Couldn\'t find the product.'});
    if (!productFound) {
      query = {};
      if (req.body._id) {
        query._id = req.body._id;
      } else {
        query.set_slug = req.params.slug;
      }
      Product.findOne(query, 'franchises categories subcategories name large_image medium_image small_image url retailers').populate('franchises').populate('categories').populate('subcategories').populate('retailers').lean()
        .exec(function (error, productFound) {
          if (error) return res.status(400).json({error: 'Couldn\'t find the product.'});
          if (!productFound) return res.status(404).json({error: 'Product doesn\'t exists.'});
          productFound.link = productFound.url;
          productFound.image = productFound.large_image ? productFound.large_image : (productFound.medium_image ? productFound.medium_image : (productFound.small_image ? productFound.small_image : ''));
          productFound.retailer = productFound.retailers.length > 0 ? productFound.retailers[0].name : '';
          delete productFound.large_image;
          delete productFound.medium_image;
          delete productFound.small_image;
          return res.status(404).json({ error: 'Product doesn\'t exists.', product: productFound });
        });
    } else {
      var offers = [], offers_off = [];
      async.parallel([
        (cb) => {
          async.eachSeries(productFound.offers, (product, callback) => {
            if (!product.image) product = Products.getProductDetail(product);
            if ((!product.store && product.available === 1) || (product.store && (product.available === 1 || product.available === 3))) offers.push(product);
            if ((!product.store && product.available !== 1) || (product.store && (product.available !== 1 && product.available !== 3))) offers_off.push(product);
            callback();
          }, err => {
            cb();
          });
        },
        (cb) => {
          async.eachSeries(productFound.other_offers, (product, callback) => {
            if (!product.image) product = Products.getProductDetail(product);
            callback();
          }, err => {
            cb();
          });
        }
      ], (err, results) => {
        productFound.offers = offers;
        productFound.offers_off = offers_off;
        productFound.franchise = productFound.franchises.length > 0 ? productFound.franchises[0] : null;
        delete productFound.franchises;
        var funkoIndex = -1;
        if (productFound.categories.length > 0 && productFound.categories[0]._id.toString() !== '5a2g4fcd5dbc0818f287d920') {
          var categoriesIds = productFound.categories.map(category => category._id.toString());
          funkoIndex = categoriesIds.indexOf('5a2g4fcd5dbc0818f287d920');
        }
        productFound.category = productFound.categories.length > 0 ? productFound.categories[0] : null;
        if (funkoIndex !== -1) productFound.category = productFound.categories[funkoIndex];
        delete productFound.categories;
        var funkoSubCategoryIndex = -1;
        if (funkoIndex !== -1 && productFound.subcategories.length > 0) {
          var subcategoriesIds = productFound.subcategories.map(subcategory => subcategory._id.toString());
          var funkoSubCategories = [
            '5a2g4fcd5dbc0818f287d920', 
            '5a2g4fcd5dbc0818f287d920', 
            '5a2g4fcd5dbc0818f287d920', 
          ];
          funkoSubCategories.forEach(function(subcategory) {
            if (funkoSubCategoryIndex === -1) funkoSubCategoryIndex = subcategoriesIds.indexOf(subcategory);
          });
        }
        productFound.subcategory = productFound.subcategories.length > 0 ? productFound.subcategories[0] : null;
        if (funkoSubCategoryIndex !== -1) productFound.subcategory = productFound.subcategories[funkoSubCategoryIndex];
        delete productFound.subcategories;
        res.json(Products.getProductDetail(productFound));
      }); 
    }
  });
};

var getProductFromAmazonByASIN = (product_id, allFranchises, categories, subcategories) => {
  var deferred = Q.defer();
  if (!product_id)
    deferred.reject({error: 'You must pass the ASIN code.'});
  opHelper.execute('ItemLookup', {
    ItemId: product_id,
    ResponseGroup: 'ItemAttributes,Images,Offers,OfferSummary,OfferFull'
  }).then((response) => {
    if (response.result.ItemSearchErrorResponse) 
      deferred.reject({error: response.result.ItemSearchErrorResponse.Error.Message});
    var product = response.result.ItemLookupResponse.Items.Item;
    var franchises = [];
    if (allFranchises.length > 1) {
      var titleArray = product.ItemAttributes.Title.toLowerCase().split(' ');
      var foundWords = 0;
      allFranchises.forEach(franchise => {
        var franchiseArray = franchise.name.toLowerCase().replace('the ', '').split(' ');
        foundWords = 0;
        for (var f in franchiseArray) {
          for (var t in titleArray) {
            if (franchiseArray[f] === titleArray[t].replace(/\W/g, '')) {
              foundWords++;
              break;
            }
          }
          if (foundWords === franchiseArray.length) break;
        }
        if (foundWords === franchiseArray.length) franchises.push(franchise);
      });
    } else if (allFranchises.length > 0) {
      franchises = allFranchises;
    }
    create(product, { _id: '5a2g4fcd5dbc0818f287d920' }, franchises, categories, subcategories)
      .then(function (productCreated) {
        deferred.resolve(productCreated);
      })
      .catch(function (err) {
        console.log('Product create fail:', err.stack);
        deferred.resolve(null);
      });
  }).catch(err => {
    console.error('Products.getProductFromAmazonByASIN fail!', err.stack);
    deferred.reject({error: 'Cann\'t list the products.'});
  });
  return deferred.promise;
};

Products.findOrCreateByProductId = (product_id, franchises, categories, subcategories) => {
  var deferred = Q.defer();
  Product.findOne({ product_id: product_id })
    .then(productFound => {
      if (productFound) {
        console.log('Product Found!', product_id, productFound.name);
        deferred.resolve(productFound);
      } else {
        getProductFromAmazonByASIN(product_id, franchises, categories, subcategories)
          .then(productCreated => {
            if (productCreated) {
              console.log('Product Created!', product_id, productCreated.name);
              deferred.resolve(productCreated);
            } else {
              deferred.resolve(null);
            }
          })
          .catch(err => {
            deferred.reject(err);
          });
      }
    })
    .catch(err => {
      deferred.reject(err);
    });
  return deferred.promise;
};

Products.update = function (req, res) {
  Product.findOne({_id: req.params.id})
    .then(productFound => {
      if (!productFound) return res.status(404).json({error: 'Product doesn\'t exists.'});
      switch (req.body.action) {
        case 'status':
          if (!req.session.user || config.availablesAdmins.indexOf(req.session.user.username.toLowerCase()) === -1) return res.status(500).json({error: 'Action rejected. Stop or you will be banned!'});
          productFound.active = productFound.active ? false : true;
          break;
        case 'clicked':
          productFound.views++;
          break;
      }
      productFound.save()
        .then(productUpdated => {
          res.json({});
        })
        .catch(err => {
          res.status(400).json({ error: 'Couldn\'t update the product.' });
        });
    })
    .catch(err => {
      res.status(400).json({ error: 'Couldn\'t find the product.' });
    });
};

Products.userAction = function (action, product, user, status) {
  var deferred = Q.defer(), index;
  Product.findOne({_id: product})
    .then(productFound => {
      switch (action) {
        case 'like':
          productFound.likes = productFound.likes || [];
          index = productFound.likes.indexOf(user);
          if (index === -1) {
            if (!status) productFound.likes.push(user);
          } else {
            if (status) productFound.likes.splice(index, 1);
          }
          break;
        case 'favorite':
          productFound.favorites = productFound.favorites || [];
          index = productFound.favorites.indexOf(user);
          if (index === -1) {
            if (!status) productFound.favorites.push(user);
          } else {
            if (status) productFound.favorites.splice(index, 1);
          }
          productFound.notify = productFound.favorites.length > 0;
          break;
      }
      productFound.save()
        .then(productUpdated => {
          deferred.resolve();
        })
        .catch(err => {
          deferred.reject({ error: 'Couldn\'t update the product.' });
        });
    })
    .catch(err => {
      deferred.reject({ error: 'Couldn\'t find the product.' });
    });
  return deferred.promise;
};

Products.listArray = function (productsIds, withSale) {
  var deferred = Q.defer();
  var filters = { _id: { $in: productsIds.map(productId => new ObjectId(productId)) } };
  if (withSale) filters.sale_saving = { $gte: 25 };
  Product.find(filters, Products.productDetailFields).populate('retailers').populate('brand').populate('categories').populate('subcategories').lean()
  .exec(function (error, productsFound) {
    if (error) deferred.reject({ error: 'Couldn\'t find products.' });
    if (!productsFound.length) deferred.resolve([]);
    var productsResult = [productsIds.length];
    var productsString = productsIds.map(productId => productId.toString());
    async.eachSeries(productsFound, (product, callback) => {
      productsResult[productsString.indexOf(product._id.toString())] = Products.getProductDetail(product);
      callback();
    }, err => {
      deferred.resolve(productsResult);
    });
  });
  return deferred.promise;
};

Products.searchArticles = (filters) => {
  var deferred = Q.defer();
  Article
    .find({ $and: filters }, 'user name slug image created views clicks')
    .populate({ path: 'user', model: 'User', select: 'name photo' })
    .sort({ created: -1 })
    .lean()
    .then(articles => {
      async.each(articles, (article, callback) => {
        if (!article.image) article.image = '../vm-blog-default.jpg';
        callback();
      }, err => {
        deferred.resolve(articles);
      });
    })
    .catch(err => {
      deferred.reject(err);
    });
  return deferred.promise;
};

Products.searchPosts = (filters) => {
  var deferred = Q.defer();
  Post
    .find({ $and: filters }, 'name slug image created')
    .sort({ created: -1 })
    .lean()
    .then(posts => deferred.resolve(posts))
    .catch(err => deferred.reject(err));
  return deferred.promise;
};

Products.searchOnAmazon = (req, res) => {
  if (!req.params.keywords)
    return res.status(500).json({error: 'You must enter keywords.'});
  opHelper.execute('ItemSearch', {
    SearchIndex: 'All',
    Keywords: req.params.keywords,
    // ItemPage: 2,
    ResponseGroup: 'ItemAttributes,Images,Offers'
  }).then((response) => {
    if (response.result.ItemSearchErrorResponse) 
      return res.status(500).json({error: response.result.ItemSearchErrorResponse.Error.Message});
    res.json(response.result.ItemSearchResponse.Items);
  }).catch((err) => {
    console.error('Products.all fail!', err.stack);
    res.status(500).json({error: 'Cann\'t list the products.'});
  });
};

Products.getFromAmazonByASIN = (req, res) => {
  if (!req.params.asin)
    return res.status(500).json({error: 'You must enter the ASIN code.'});
  opHelper.execute('ItemLookup', {
    ItemId: req.params.asin,
    ResponseGroup: 'ItemAttributes,Images,Offers,OfferSummary,OfferFull'
  }).then((response) => {
    if (response.result.ItemSearchErrorResponse) 
      return res.status(500).json({error: response.result.ItemSearchErrorResponse.Error.Message});
    res.json(response.result.ItemLookupResponse.Items);
  }).catch((err) => {
    console.error('Products.all fail!', err.stack);
    res.status(500).json({error: 'Cann\'t list the products.'});
  });
};

Products.runAmazonScraper = (req, res) => {
  var r = 'cd scrapers/;nohup scrapy crawl amazon -a p_url="' + req.body.url + '"';

  if (req.body.franchise)
    r += ' -a p_franchise="' + req.body.franchise + '"'; 

  if (req.body.subcategory)
    r += ' -a p_category="' + req.body.subcategory + '"'; 

  r +=  ' > amazon.out &';

  cmd.get(r, function (err, data, stderr) {
    if (err) {
      console.log(err.stack);
      res.status(500).json({error: err.stack});
    } else {
      res.json({data: data})
    }
  });
};