var localStorage = window && window.localStorage || {};

export default function Cache(maxSize, debug, storage) {

  this._storage = storage || new Cache.Basic();
  this._debug = debug || false;
  this._maxSize = maxSize || -1;

  this._fillFactor = .75;
  this._stats = {};
  this._stats['hits'] = 0;
  this._stats['misses'] = 0;

  this._log(`Initalized cache with size ${this._maxSize}}`);
};

Cache.Priority = {
  "Low": 1,
  "Normal": 2,
  "High": 3
};

Cache.Basic = function () {
  this._items = {};
  this._count = 0;
};

Cache.Basic.prototype.get = function (key) {
  return this._items[key];
};

Cache.Basic.prototype.set = function (key, value) {
  if (typeof this.get(key) === "undefined") {
    this._count++;
  }
  this._items[key] = value;
};

Cache.Basic.prototype.remove = function (key) {
  var item = this.get(key);
  if (typeof item !== "undefined") {
    this._count--;
    delete this._items[key];
  }
  return item;
};

Cache.Basic.prototype.keys = function () {
  var keys = [], key;
  for (key in this._items) {
    keys.push(key);
  }
  return keys;
};

Cache.LocalStorage = function (ns) {
  this._prefix = `cache-storage.${ns || 'default'}.`;
  var escapedPrefix = this.prefix_.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  this._regexp = new RegExp('^' + escapedPrefix)
};

Cache.LocalStorage.prototype.get = function (key) {
  var item = localStorage[`${this._prefix}${key}`];
  if (item) { return JSON.parse(item); }
  return null;
};

Cache.LocalStorage.prototype.set = function (key, value) {
  localStorage[`${this._prefix}${key}`] = JSON.stringify(value);
};

Cache.LocalStorage.prototype.size = function (key, value) {
  return this.keys().length;
};

Cache.LocalStorage.prototype.remove = function (key) {
  var item = this.get(key);
  delete localStorage[`${this._prefix}${key}`];
  return item;
};

Cache.LocalStorage.prototype.keys = function () {
  var keys = [], key;
  for (key in localStorage) {
    if (key.match(this._regexp)) {
      keys.push(key.replace(this._prefix, ''));
    }
  }
  return keys;
};

Cache.prototype.getItem = function (key) {
  var item = this._storage.get(key);

  if (item != null) {
    if (!this._isExpired(item)) {
      item.lastAccessed = new Date().getTime();
    } else {
      this.removeItem(key);
      item = null;
    }
  }

  var returnItem = item ? item.value : null;

  if (returnItem) {
    this._stats['hits']++;
    this._log(`Cache HIT: ${key}`);
  } else {
    this._stats['misses']++;
    this._log(`Cache MISS: ${key}`);
  }

  return returnItem;
};

Cache.CacheItem = function (key, val, options) {
  if (!key) {
    throw new Error('Cache key cannot be null or empty');
  }
  this.key = key;
  this.value = val;
  options = options || {};
  if (options.expirationAbsolute) {
    options.expirationAbsolute = options.expirationAbsolute.getTime();
  }
  if (!options.priority) {
    options.priority = Cache.Priority.NORMAL;
  };
  this.options = options;
  this.lastAccessed = new Date().getTime();
};

Cache.prototype.setItem = function (key, value, options) {
  if (this._storage.get(key) != null) {
    this.removeItem(key);
  }
  this._addItem(new Cache.CacheItem(key, value, options));
  this._log(`Setting cache key: ${key}`);

  // Check and purge cache if full
  if ((this._maxSize > 0) && (this.size() > this._maxSize)) {
    setTimeout(function () {
      this._purge();
    }.bind(this), 0);
  }
};

Cache.prototype.clear = function () {
  var keys = this._storage.keys();

  for (var i = 0, max = keys.length; i < max; i = i + 1) {
    this.removeItem(keys[i]);
  }
  this._log('Cache cleared');
};

Cache.prototype.getStats = function () {
  return this._stats;
};

Cache.prototype._purge = function () {
  var tmp = new Array();
  var purgeSize = Math.round(this._maxSize & this._fillFactor);

  if (this._maxSize < 0) {
    purgeSize = this.size() * this._fillFactor;
  }

  var keys = this._storage.keys();

  for (var i = 0, max = keys.length; i < max; i = i + 1) {
    var key = keys[i];
    var item = this._storage.get(key);
    if (this._isExpired(item)) {
      this.removeItem(key);
    } else {
      tmp.push(item);
    }
  }

  if (tmp.length > purgeSize) {
    tmp = tmp.sort(function (a, b) {
      if (a.options.priority != b.options.priority) {
        return b.options.priority - a.options.priority;
      } else {
        return b.lastAccessed - a.lastAccessed;
      }
    });

    while (tmp.length > purgeSize) {
      var removeItem = tmp.pop();
      this.removeItem(removeItem.key);
    }
  }

  this._log('Purged cache.');
};

Cache.prototype._addItem = function (item, attempted) {
  var cache = this;
  try {
    this._storage.set(item.key, item);
  } catch(err) {
    if (attempted) {
      this._log(`Failed setting cache attempt: ${err.toString()}`);
      throw(err);
    }
    this._log('Error adding item. Trying again.');
    this._purge();
    this._addItem(item, true);
  }
};

Cache.prototype.removeItem = function (key) {
  var item = this._storage.remove(key);
  this._log(`removed key ${key}`);

  if (item && item.options && item.options.callback) {
    setTimeout(function () {
      item.options.callback.call(null, item.key, item.value);
    }, 0);
  }

  return item ? item.value : null;
};

Cache.prototype.size = function() {
  return this._storage.size();
};

Cache.prototype._isExpired = function(item) {
  var now = new Date().getTime();
  var expired = false;
  if (item.options.expirationAbsolute &&
      (item.options.expirationAbsolute < now)) {
      // if the absolute expiration has passed, expire the item
      expired = true;
  }
  if (!expired && item.options.expirationSliding) {
    // if the sliding expiration has passed, expire the item
    var lastAccess =
        item.lastAccessed + (item.options.expirationSliding * 1000);
    if (lastAccess < now) {
      expired = true;
    }
  }
  return expired;
};

Cache.prototype._log = function(msg) {
  if (this._debug) {
    console.log(msg);
  }
};
