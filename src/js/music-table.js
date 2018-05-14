const catalogMusicLimit = 50

/*==================================
=            PROCESSORS            =
==================================*/
function processCatalogPage (args) {
  const q = searchStringToObject()
  q.limit = catalogMusicLimit
  q.skip = (q.page-1 || 0) * catalogMusicLimit
  const query = objectToQueryString(q)

  renderContent(args.template, {query: query})
  completedCatalogMusic()
}


function completedCatalogMusic () {
  var q = getBrowseMusicQuery()
  q.limit = catalogMusicLimit
  q.skip = (q.page-1 || 0) * catalogMusicLimit
  delete q.page
  openCatalogPage(q)
}

function processCatalogFilters (args) {
  templateProcessor('catalog-filters', args, {
    transform: function (args) {

      const scope = Object.assign({
        search: searchStringToObject().search
      }, args.result)

      cache('catalog-filters', scope)
      return scope
    },
    completed: completedCatalogFilters
  })
}

function completedCatalogFilters () {
  setTimeout(() => {
    const input = findNode('input[name=search]')

    input.focus()
    input.value = input.value
  }, 1)
  renderBrowseFilters()
}

function openCatalogPage (q) {
  const cel = findNode('[role="catalog-pages"]')

  if (!cel) {
    return
  }

  const div = document.createElement('div')

  betterRender('catalog-rows-group', div, {
    source: endpoint + '/catalog/browse/?' + objectToQueryString(q)
  })

  cel.appendChild(div)
  loadNodeSources(cel)
}

function processCatalogResults (args) {
  templateProcessor('catalog-rows', args, {
    transform: function (args) {
      const result = args.result
      const obj = Object.assign({}, result)

      if (obj.total > 1) {
        obj.showPagination = true
      }
      setPagination(obj, obj.limit)
      let streamableIndex = 0

      obj.results = obj.results.map((item, index, arr) => {
        const track = mapTrack(item)

        track.index = streamableIndex
        if (track.streamable) {
          streamableIndex++
        }
        return track
      })

      obj.tableHeaders = getSortableHeaders()

      const filters = cache('catalog-filters')

      Object.assign(obj, filters)

      return obj
    },
    completed: completedCatalogFilters
  })
}

function getSortableHeaders (sortBy, direction) {
  var qo = searchStringToObject()

  var headers =
  [ { label: 'Track'
    , field: 'title'
    , xsHidden: false
    } ,
    { label: 'Artists'
    , field: 'artists'
    , xsHidden: false
    } ,
    { label: 'Release'
    , field: 'release'
    , xsHidden: false
    } ,
    { label: 'Time'
    , field: 'time'
    , xsHidden: true
    } ,
    { label: 'BPM'
    , field: 'bpm'
    , xsHidden: true
    } ,
    { label: 'Genre'
    , field: 'genre'
    , xsHidden: true
    } ,
    { label: 'Date'
    , field: 'date'
    , xsHidden: true
    }
  ]

  headers = headers.map(function (h) {
    var qo = searchStringToObject()
    h.active = qo.sortOn == h.field
    h.asc = qo.sortValue == 1
    h.desc = qo.sortValue == -1

    qo.sortOn = h.field

    if(h.active) {
      qo.sortValue = h.asc ? -1 : 1
    }
    else {
      qo.sortValue = 1
    }

    h.href = '/catalog?' + objectToQueryString(qo)
    return h
  })

  return headers
}