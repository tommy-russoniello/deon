function flattenObject (obj, sep) {
  if (typeof obj != 'object') return
  var flat = {}
  for (var key in obj) {
    flattenObject.dive(flat, obj[key], key, sep)
  }
  return flat
}
flattenObject.dive = function (flat, val, chain, sep) {
  var path = chain ? chain + sep : ""
  if (val instanceof Array) {
    for (var i=0; i<val.length; i++) {
      flattenObject.dive(flat, val[i], path + i, sep)
    }
  }
  else if (typeof val == 'object') {
    for (var key in val) {
      flattenObject.dive(flat, val[key], path + key, sep)
    }
  }
  else {
    flat[chain] = val
  }
}

function toArray (nl) {
  var arr = []
  for (var i = 0, ref = arr.length = nl.length; i < ref; i++) {
    arr[i] = nl[i]
  }
  return arr
}

function onlyUnique(value, index, self) { 
  return self.indexOf(value) === index;
}

function uniqueArray (arr) {
  return arr.filter(onlyUnique)
}

function toAtlas (arr, key) {
  var atlas = {}
  arr.forEach(function (item) {
    atlas[item[key]] = item
  })
  return atlas
}

function getAccountCountries (current) {
  return Countries.map(function (item) {
    return {
      name: item.name,
      selected: item.name == current
    }
  })
}

function getLastPathnameComponent () {
  return location.pathname.substr(location.pathname.lastIndexOf('/') + 1)
}

function commaStringToObject (str) {
  var obj = {}
  var arr = (str || "").split(',')
  for (var i = 0; i < arr.length; i += 2) {
    obj[arr[i]] = arr[i+1]
  }
  return obj
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function requestSimple (method, what, obj, done) {
  requestJSON({
    url: endpoint + '/' + what,
    method: method,
    data: obj,
    withCredentials: true
  }, done)
}

function create (what, obj, done) {
  requestSimple("POST", what, obj, done)
}

function update (what, id, obj, done) {
  var path = id ? what + '/' + id : what
  requestSimple("PATCH", path, obj, done)
}

function destroy (what, id, done) {
  requestSimple("DELETE", what + '/' + id, null, done)
}

function addMetaElement (el, key, value) {
  var mel = document.createElement('meta')
  mel.setAttribute('property', key)
  mel.setAttribute('content', value)
  el.insertBefore(mel, el.firstElementChild)
}

function removeMetaElement (el, key) {
  var target = el.querySelector('[property="' + key + '"]')
  if (target)
    target.parentElement.removeChild(target)
}

function setMetaData (meta) {
  var head = document.querySelector('head')
  if (!head) return
  var tags = head.querySelectorAll('meta[property*="og:"],meta[property*="music:"]')
  for(var i = 0; i < tags.length; i++) {
    tags[i].parentElement.removeChild(tags[i])
  }
  meta['og:site_name'] = 'Monstercat'
  appendMetaData(meta)
}

function appendMetaData (meta) {
  var head = document.querySelector('head')
  for (var key in meta) {
    removeMetaElement(head, key)
    var vals = typeof(meta[key]) == 'object' ? meta[key] : [meta[key]]
    for(var i = 0; i < vals.length; i++) {
      if(vals[i] !== undefined) {
        addMetaElement(head, key, vals[i])
      }
    }
  }
}

function formatDate (date) {
  if (!formatDate.months) {
    formatDate.months = [
      "January",
      "Feburary",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ]
  }
  if (!(date instanceof Date)) date = new Date(date)
  return formatDate.months[date.getMonth()] + ' ' +
    date.getDate() + ', ' +
    date.getFullYear()
}

function sortRelease (a, b) {
  var a = new Date(a.preReleaseDate || a.releaseDate)
  var b = new Date(b.preReleaseDate || b.releaseDate)
  if (a > b) return -1
  if (a < b) return 1
  return 0
}