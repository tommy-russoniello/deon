var searchSnippetLimit = 5

function pageToQuery (page, opts) {
  opts = opts || {}
  opts.perPage = opts.perPage || 25
  page = page || 1

  return {skip: (page - 1) * opts.perPage, limit: opts.perPage}
}

function objSetPageQuery (obj, page, opts) {
  var sl = pageToQuery(page, opts);
  obj.skip = sl.skip
  obj.limit = sl.limit
}

//TODO: Look at all of this duplicate code. Be the change you want to see in the code.
function search (e, el, url) {
  var data   = getTargetDataSet(el, false, true) || {}
  var types = getSearchTypes()
  var searchType = getSearchType('all')
  var q = queryStringToObject(window.location.search)
  var searchTerm = data.term
  if(data.term) {
    for(var i in types) {
      if(types[i].searchPrefix) {
        if(data.term.substr(0, types[i].searchPrefix.length) == types[i].searchPrefix) {
          searchType = types[i]
          searchTerm = data.term.substr(searchType.searchPrefix.length).trim()
          break
        }
      }
    }
  }
  var url = searchType.url
  if (searchTerm) {
    q.term = searchTerm
  }
  else {
    delete q.term
  }
  delete q.page
  go(url + '?' + objectToQueryString(q))}

function searchAll (e, el) {
  search(e, el, '/search')
}


function searchToFuzzy (search, fields) {
  if (!search) return
  var arr = []
  fields.forEach(function (field) {
    arr.push(field, search)
  })
  return arr.join(',')
}

function getSearchTypes () {
  return {
    all: {
      title: 'Search Monstercat',
      url: '/search'
    },
    tracks: {
      fuzzyFields: ['title', 'artistsTitle'],
      q: {},
      perPage: 25,
      title: 'Search Songs',
      searchForm: {
        placeholder: 'Search songs...',
        action: 'searchTracks'
      },
      url: '/search/songs',
      searchPrefix: 'songs:'
    },
    artists: {
      fuzzyFields: ['name'],
      fields: ['name', 'websiteDetailsId', 'profileImageBlobId', 'vanityUri'],
      q: {},
      title: 'Search Artists',
      perPage: 10,
      searchForm: {
        placeholder: 'Search artists...',
        action: 'searchArtists'
      },
      url: '/search/artists',
      searchPrefix: 'artists:'
    },
    releases: {
      fuzzyFields: ['title', 'renderedArtists'],
      q: {},
      title: 'Search Releases',
      fields: ['title', 'renderedArtists', 'releaseDate', 'preReleaseDate', 'thumbHashes', 'catalogId'].join(','),
      perPage: 10,
      searchForm: {
        placeholder: 'Search releases...',
        action: 'searchReleases'
      },
      url: '/search/releases',
      searchPrefix: 'releases:'
    }
  }
}

function getSearchType (type) {
  return getSearchTypes()[type] || false
}

function transformSearch () {
  var q    = queryStringToObject(window.location.search)
  q.limit  = searchSnippetLimit
  q.skip   = parseInt(q.skip) || 0
  q.term = q.term || "" //Text search
  q.fields = []
  if (!q.term) return {}
  var searches = getSearchTypes()
  for(var type in searches) {
    var search = searches[type]
    var sq = {}
    for (var x in q) {
      sq[x] = !search.hasOwnProperty(x) ? q[x] : search[x]
    }
    if (q.term && search.fuzzyFields) {
      sq.fuzzyOr = searchToFuzzy(q.term, search.fuzzyFields)
    }
    search.query = objectToQueryString(sq)
  }
  var searchForm = {
    placeholder: 'Search anything...',
    search: q.term,
    action: 'searchAll'
  }
  return {
    search: q.term || "",
    searches: searches,
    searchForm: searchForm
  }
}

function transformSearchPage (obj, type) {
  obj = obj || {}
  var query = {}
  var q = queryStringToObject(window.location.search)
  var searchType = getSearchType(type)
  objSetPageQuery(query, q.page, {perPage: searchType.perPage})
  if(q.term && searchType.fuzzyFields) {
    query.fuzzyOr = searchToFuzzy(q.term, searchType.fuzzyFields)
  }
  obj.query = objectToQueryString(query)
  obj.searchForm = searchType.searchForm
  obj.searchForm.term = q.term
  return obj
}

function transformSearchSnippet (obj, type) {
  var numMore = Math.max(obj.total - searchSnippetLimit, 0)
  if(numMore) {
    obj.more = {
      num: numMore,
      message: function () {
        return 'View ' + this.num + ' More ' + type + (this.num == 1 ? '': 's')
      }
    }
  }
  obj.query =  window.location.search.substr(1)
  return obj
}

function transformSearchSnippetReleases (obj) {
  return transformSearchSnippet(transformMusicReleases(obj), 'Release')
}

function transformSearchSnippetArtists (obj) {
  return transformSearchSnippet(obj, 'Artist')
}

function transformSearchSnippetTracks (obj, done) {
  transformTracks(obj, function (err, res) {
    res = transformSearchSnippet (res, 'song')
    if(res.more) {
      res.more.message = 'View All Songs Results';
    }
    done(null, res)
  });
}

function transformSearchReleasesPage (obj) {
  return transformSearchPage(obj, 'releases')
}

function transformSearchTracksPage (obj) {
  return transformSearchPage(obj, 'tracks')
}

function transformSearchArtistsPage (obj) {
  return transformSearchPage(obj, 'artists')
}

function transformSearchReleaseResults (obj) {
  var type = getSearchType('releases')
  setPagination(obj, type.perPage)
  return transformReleases(obj)
}

function transformSearchTrackResults (obj, done) {
  var type = getSearchType('tracks')
  setPagination(obj, type.perPage)
  transformTracks(obj, function (err, res) {
    done(null, res)
  })
}

function transformSearchArtistsResults (obj, done) {
  var type = getSearchType('artists')
  setPagination(obj, type.perPage)
  return obj
}

function setPagination (obj, perPage) {
  var q = queryStringToObject(window.location.search)
  q.page = parseInt(q.page) || 1
  //TODO: Calculate whether prev or next are required
  //based on current page and the numperpage
  var nq = cloneObject(q)
  var pq  = cloneObject(q)
  nq.page = nq.page + 1
  pq.page = pq.page - 1
  if (q.page * perPage < obj.total) {
    obj.next     = objectToQueryString(nq)
  }
  if (q.page > 1) {
    obj.previous = objectToQueryString(pq)
  }
  obj.showingFrom = Math.max((q.page - 1) * perPage, 1)
  if (obj.next) {
    obj.showingTo = q.page == 1 ? perPage : obj.showingFrom + perPage - 1
  }
  else {
    obj.showingTo = obj.total
  }
}

function getGlobalSearchInput() {
  return document.querySelector('[data-set="search-form"] input[name="term"]')
}

function completedSearchPage (type) {
  var searchType = getSearchType(type)
  var q = queryStringToObject(window.location.search)
  q.page = parseInt(q.page) || 1
  var title = searchType.title
  if(q.term) {
    title += ' for "' + q.term + '"'
  }
  if(q.page > 1) {
    title += ' - Page ' + q.page
  }
  setPageTitle(title)
  var searchInput = getGlobalSearchInput()
  if(q.term) {
    searchInput.value = type != 'all' ? searchType.searchPrefix + ' ' + q.term : q.term
  }
  searchInput.focus()
}

function completedSearchAll () {
  completedSearchPage('all')
}

function completedSearchReleases () {
  completedSearchPage('releases')
}

function completedSearchTracks() {
  completedSearchPage('tracks')
}

function completedSearchArtists() {
  completedSearchPage('artists')
}

openRoute.completed.push(function () {
  if (window.location.pathname.indexOf('/search') >= 0) return
  (getGlobalSearchInput() || {value:''}).value = ''
})
