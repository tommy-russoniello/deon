const browseMusicLimit = 25
const browseUri = '/browse' // TODO 'music'
const browseMusicFilters = [
  'tags',
  'genres',
  'types'
]

function getMusicPageTitle (prepend) {
  const so = searchStringToObject()
  let title = prepend

  if (so.search) {
    title = 'Search ' + prepend
  }

  if (so.genres) {
    title += ' ' + commaAnd(so.genres.split(','))
  }

  if (so.types) {
    title += ' ' + commaAnd(so.types.split(',').map(x => x+'s'))
  }
  else {
    title += ' Music'
  }

  if (so.search) {
    title += ' for "' + so.search + '"'
  }

  if (so.tags) {
    title += ' tagged ' + commaAnd(so.tags.split(','), ' or ')
  }

  if (so.pages || so.page) {
    title += ' - Page ' + (so.pages || so.page)
  }

  return title
}

function processBrowseMusicPage (args) {
  let q = searchStringToObject()

  q.limit = (q.pages || 0) * browseMusicLimit
  q.skip = 0
  const scope =  {
    query: objectToQueryString(q)
  }

  renderContent('browse-music-page', scope)

  q = getBrowseMusicQuery()
  q.limit = browseMusicLimit * (parseInt(q.pages) || 1)
  q.skip = 0
  delete q.pages
  openBrowsePage(q)
}

function mapFilterString (str) {
  return str.substr(0, str.lastIndexOf('s'))
}

function processBrowseFilters (args) {
  templateProcessor('browse-filters', args, {
    success: function (args) {
      betterRender(args.template, args.node, {data: args.result})
      renderBrowseFilters()
    }
  })
}

function renderBrowseFilters () {
  const q = searchStringToObject()

  browseMusicFilters.forEach((filter) => {
    const cel = document.querySelector('[role="filters-list-' + filter + '"]')

    if (!cel) {
      return
    }
    const values = (q[filter] || '')
      .split(',')
      .map(mapStringTrim)
      .filter(filterNil)

    values.forEach((value) => {
      const el = createFilterItem(mapFilterString(filter), value)

      if (!el) {
        return
      }

      cel.appendChild(el)
    })
  })
}

function createFilterItem (type, value) {
  const div = document.createElement('div')

  const node = findNode('[name="' + type + 's[]"][value="' + value + '"]')

  if (node) {
    return
  }

  const num = findNodes('[name^="' + type + 's"]').length

  betterRender('browse-filter-item', div, {
    type: type,
    value: value,
    index: num
  })
  return div.firstElementChild
}

function openBrowsePage (q) {
  var cel = document.querySelector('[role="browse-pages"]')

  if (!cel) {
    return
  }
  var div = document.createElement('div')

  betterRender('browse-page', div, {
    source: endpoint + '/catalog/browse/?' + objectToQueryString(q)
  })
  var ul = div.firstElementChild

  cel.appendChild(ul)
  loadNodeSources(ul)
}

function processMusicBrowseResults (args) {
  let result = {}

  templateProcessor('music-browse', args, {
    hasLoading: true,
    hasError: true,
    transform: function (args) {
      result = args.result
      const tracks = result.results
      let playIndexOffset = result.skip || 0
      const scope = Object.assign({}, result)

      //Here we're taking all the tracks and putting them under a release object
      const rmap = {}

      tracks.forEach((track, index, arr) => {
        let release = track.release

        if (release) {
          release.inEarlyAccess = track.inEarlyAccess
          if (!rmap[release._id]) {
            rmap[release._id] = track.release
          }
          release = rmap[release._id]
          if (!release.tracks) {
            release.tracks = []
          }
          release.tracks.push(track)
        }
      })
      const releases = Object.keys(rmap)
        .map((key) => {
          return rmap[key] })
        .sort(sortRelease)

      releases.forEach((release) => {
        mapRelease(release)
        release.tracks.forEach((track, index, arr) => {
          mapTrack(track)
          if(track.streamable) {
            track.index = playIndexOffset
            track.trackNumber = index + 1
            playIndexOffset++
          }
        })
        release.tracks.sort(sortTracks)
      })

      scope.results = releases
      scope.hasGoldAccess = hasGoldAccess()
      return scope
    },
    completed: function () {
      completedMusicBrowseResults(result)
    }
  })
}

function getBrowseMoreButton () {
  return document.querySelector('[role="browse-more"]')
}

function completedMusicBrowseResults (data) {
  player.set(buildTracks())

  const el = getBrowseMoreButton()

  if (!el) {
    return
  }

  el.disabled = false
  const hide = !(data && data.results && data.skip + data.results.length <= data.total)

  el.classList.toggle('hide', hide)
  mergeBrowseResults()
  startCountdownTicks()
  //Rebuild the indexes so that the index attribute matches their actual position on the page
  document.querySelectorAll('[play-link]').forEach((el, index) => {
    el.setAttribute('index', index)
  })

  pageIsReady({
    title: getMusicPageTitle('Browse')
  })
}

function mergeBrowseResults () {
  var map = {}
  var els = toArray(document.querySelectorAll('li[catalog-id]'))
  els.forEach(function (el) {
    var id = el.getAttribute('catalog-id')
    if (!map[id]) map[id] = []
    map[id].push(el)
  })
  Object.keys(map).map(function (key) {
    return map[key]
  }).filter(function (arr) {
    return arr.length > 1
  }).forEach(mergeBrowseResults.forEachMerger)
}
mergeBrowseResults.forEachMerger = function forEachMerger (arr) {
  var a = arr.shift()
  var tbody = a.querySelector('tbody')
  var frag = document.createDocumentFragment()
  for (var j = 0; j < arr.length; j++) {
    var b = arr[j]
    var trs = toArray(b.querySelectorAll('tbody > tr'))
    for (var i = 0; i < trs.length; i++) {
      frag.appendChild(trs[i])
    }
    b.parentElement.removeChild(b)
  }
  tbody.appendChild(frag)
}

function addBrowseFilter (e, el) {
  const cel = document.querySelector('[role="filters-list-' + el.name + 's"]')
  const newEl = createFilterItem(el.name, el.value)

  if (!newEl) {
    return
  }

  cel.appendChild(newEl)
}

function removeBrowseFilter (e, el) {
  const li = el.parentElement
  li.parentElement.removeChild(li)
}

function getBrowseMusicQuery () {
  return searchStringToObject()
}

function clearFilterBrowseMusic (e) {
  console.log('TODO: clear the browse stuff')
}

function submitFilterBrowseMusic (e, el) {
  e.preventDefault()
  const q = getBrowseMusicQuery()
  const data = getDataSet(el)

  const tags = findNode('.browse-table-tags')

  if (tags) {
    const tagData = getDataSet(tags)
    Object.assign(data, tagData)
  }

  browseMusicFilters.forEach((key) => {
    if (data[key] && data[key].length > 0) {
      q[key] = data[key]
    } else {
      delete q[key]
    }
  })
  delete q.pages
  delete q.page
  if(data.search) {
    q.search = data.search

    const bpm = parseInt(q.search)

    if(!isNaN(bpm)) {
      q.search = 'bpm:' + bpm
    }
  }
  else {
    delete q.search
  }
  go('?' + objectToQueryString(q))
}

function autoBrowseMore () {
  var btn = getBrowseMoreButton()
  if (!player) return
  if (window.location.path != browseUri) return
  if (player.index < player.items.length) return
  // Simple logic to avoid retrigger if not available or already loading
  if (btn && btn.classList.contains('hide')) return
  browseMore()
}

function browseMore (e, el) {
  var btn = getBrowseMoreButton()
  if (btn) btn.classList.add('hide')
  var q = getBrowseMusicQuery()
  var pages = parseInt(q.pages) || 1
  q.limit = browseMusicLimit
  q.skip = pages * q.limit
  delete q.pages
  openBrowsePage(q)
  delete q.limit
  delete q.skip
  q.pages = pages + 1
  var title = "Browse Music - " + q.pages + " Pages"
  var url = window.location.origin + window.location.pathname + '?' + objectToQueryString(q)
  document.title = title
  history.pushState({}, title, url)
}
