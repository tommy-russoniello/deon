const searchSnippetLimit = 8

/*===============================
=            HELPERS            =
===============================*/
function getGlobalSearchInput() {
  return document.querySelector('[role="search-global"] input[name="term"]')
}

function searchToFuzzy (search, fields) {
  if (!search) {
    return ""
  }
  const arr = []

  fields.forEach((field) => {
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
      q: {},
      perPage: 25,
      title: 'Search Songs',
      searchForm: {
        placeholder: 'Search songs...',
        action: 'searchTracks'
      },
      url: '/search/songs',
      searchPrefix: 'songs:',
      searchPrefixAliases: ['song:', 'track:', 'tracks:'],
      queryField: 'search'
    },
    artists: {
      fuzzyFields: ['name'],
      fields: ['name', 'websiteDetailsId', 'profileImageBlobId', 'profileImageUrl', 'vanityUri'],
      q: {},
      title: 'Search Artists',
      perPage: 10,
      searchForm: {
        placeholder: 'Search artists...',
        action: 'searchArtists'
      },
      url: '/search/artists',
      searchPrefix: 'artists:',
      searchPrefixAliases: ['artist:']
    },
    releases: {
      fuzzyFields: ['title', 'renderedArtists'],
      q: {},
      title: 'Search Releases',
      fields: ['title', 'renderedArtists', 'releaseDate', 'preReleaseDate', 'coverUrl', 'catalogId'].join(','),
      perPage: 10,
      searchForm: {
        placeholder: 'Search releases...',
        action: 'searchReleases'
      },
      url: '/search/releases',
      searchPrefix: 'releases:',
      searchPrefixAliases: ['release:', 'album:', 'albums:']
    }
  }
}

function getSearchType (type) {
  return getSearchTypes()[type] || false
}

/*===============================
=            ACTIONS            =
===============================*/
function submitSearchMobile (e, el, url) {
  closeNav()
  submitSearch(e, el, url)
}

function submitSearch (e, el, url) {
  e.preventDefault()
  var data = getDataSet(el)
  var types = getSearchTypes()
  var searchType = getSearchType('all')
  var q = searchStringToObject()

  if (!data.term && data.term !== 0) { return }
  data.term = data.term.toString()
  var searchTerm = data.term

  for (var i in types) {
    if (types[i].searchPrefix) {
      var prefixes = [types[i].searchPrefix].concat(types[i].searchPrefixAliases)
      var found  = false

      for (var k = 0; k < prefixes.length; k++) {
        var prefix = prefixes[k]

        if (data.term.substr(0, prefix.length).toLowerCase() == prefix) {
          searchType = types[i]
          searchTerm = data.term.substr(prefix.length).trim()
          found = true
          break
        }
      }
      if (found) {
        break
      }
    }
  }
  const goUrl = searchType.url

  q.term = searchTerm
  delete q.page
  go(goUrl + '?' + objectToQueryString(q))
}

function searchAll (e, el) {
  search(e, el, '/search')
}

/*=================================
=            PROCESSOR            =
=================================*/
function processSearchAllPage (args) {
  var q = searchStringToObject()

  q.limit = searchSnippetLimit
  q.skip = parseInt(q.skip) || 0
  q.term = q.term || "" //Text search
  q.fields = []
  var searches = getSearchTypes()

  Object.keys(searches).forEach(function (type) {
    var search = searches[type]
    var sq = {}

    for (var x in q) {
      sq[x] = !search.hasOwnProperty(x) ? q[x] : search[x]
    }

    //Some searches use
    //the &fuzzyOr={{field}},{{value}},{{field2}},{{value}} thing
    //Otherwse just do &{{field}}={{value}}
    if (q.term && search.fuzzyFields) {
      sq.fuzzyOr = searchToFuzzy(q.term, search.fuzzyFields)
    }
    else if (q.term && search.queryField) {
      sq[search.queryField] = q.term
    }
    search.query = objectToQueryString(sq)
  })
  var searchForm = {
    placeholder: 'Search anything...',
    search: q.term,
    action: 'searchAll'
  }

  renderContent(args.template, {
    data: {
      search: q.term || "",
      searches: searches,
      searchForm: searchForm
    }
  })
  completedSearchAll()
}


function processSearchPage (args, type) {
  const data = transformSearchPage(args.result, type)

  renderContent(args.template, {data: data})
}

function processSearchSnippetTracks (args) {
  templateProcessor('search-snippet-tracks', args, {
    transform: function (args) {
      const result = args.result
      let data = Object.assign({}, result)

      data.results = transformTracks(result.results)
      data = transformSearchSnippet(data, 'song')

      if (data.more) {
        data.more.message = 'View All Songs Results'
      }
      return data
    }
  })
}

function processSearchSnippetReleases (args) {
  templateProcessor('search-snippet-releases', args, {
    transform: function (args) {
      const result = args.result
      let data = Object.assign({}, transformReleases(result))

      data = transformSearchSnippet(data, 'album')
      if (data.more) {
        data.more.message = 'View All Album Results'
      }
      return data
    }
  })
}

function processSearchSnippetArtists (args) {
  templateProcessor('search-snippet-artists', args, {
    transform: function (args) {
      const result = args.result
      let data = Object.assign({}, result)

      data.results = result.results.map(transformWebsiteDetails)
      data = transformSearchSnippet(data, 'artist')

      if (data.more) {
        data.more.message = 'View All Artists Results'
      }
      return data
    }
  })
}

function processSearchArtistsResults (args) {
  templateProcessor('search-artists', args, {
    hasLoading: true,
    transform: function (args) {
      const type = getSearchType('artists')
      const scope = Object.assign({}, args.result)

      setPagination(scope, type.perPage)
      scope.results = args.result.results.map(transformWebsiteDetails)
      return scope
    },
  })
}

function processSearchTrackResults (args) {
  templateProcessor('search-tracks', args, {
    hasLoading: true,
    transform: function (args) {
      const result = args.result
      const data = Object.assign({}, result)
      const type = getSearchType('tracks')

      setPagination(data, type.perPage)
      data.results = transformTracks(result.results)
      return data
    }
  })
}


function processSearchReleasesPage (obj) {
  processSearchPage(obj, 'releases')
  completedSearchReleases()
}

function processSearchTracksPage (obj) {
  processSearchPage(obj, 'tracks')
  completedSearchTracks()
}

function processSearchArtistsPage (obj) {
  processSearchPage(obj, 'artists')
  completedSearchArtists()
}

function processSearchReleaseResults (args) {
  templateProcessor('search-releases', args, {
    hasLoading: true,
    transform: function (args) {
      const result = args.result
      const data = Object.assign({}, result)
      const type = getSearchType('releases')

      setPagination(data, type.perPage)
      data.results = result.results.map(mapRelease)
      return data
    }
  })
}

/*====================================
=            TRANSFORMERS            =
====================================*/

/**
 * Generic transform for any type of search page
 *
 * @param {Object} obj The base data to work with
 * @param {String} type Type of search, eg: releases, artists
 * @returns {Object} scope data
 */
function transformSearchPage (object, type) {
  const obj = object || {}
  const query = {}
  const q = searchStringToObject()
  const searchType = getSearchType(type)

  objSetPageQuery(query, q.page, {perPage: searchType.perPage})
  if (q.term && searchType.fuzzyFields) {
    query.fuzzyOr = searchToFuzzy(q.term, searchType.fuzzyFields)
  }
  else if (q.term && searchType.queryField) {
    query[searchType.queryField] = q.term
  }
  obj.query = objectToQueryString(query)
  obj.searchForm = searchType.searchForm
  obj.searchForm.term = q.term
  return obj
}

function transformSearchSnippet (obj, type) {
  var numMore = Math.max(obj.total - searchSnippetLimit, 0)

  if (numMore) {
    obj.more = {
      num: numMore,
      message: function () {
        return 'View ' + this.num + ' More ' + type + (this.num == 1 ? '' : 's')
      }
    }
  }
  obj.query = window.location.search.substr(1)
  return obj
}

function transformSearchSnippetArtists (obj) {
  return transformSearchSnippet(transformSearchArtistsResults(obj), 'Artist')
}

function completedSearchPage (type) {
  var searchType = getSearchType(type)
  var q = searchStringToObject()

  q.page = parseInt(q.page) || 1
  var title = searchType.title

  if (q.term) {
    title += ' for "' + q.term + '"'
  }
  if (q.page > 1) {
    title += ' - Page ' + q.page
  }
  setPageTitle(title)
  var searchInput = getGlobalSearchInput()

  if (q.term) {
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

document.addEventListener('statechange', function () {
  if (window.location.pathname.indexOf('/search') >= 0) { return }
  (getGlobalSearchInput() || {value: ''}).value = ''
})
