const PLAYLIST_DOWNLOAD_LIMIT = 50 //Maximum tracks you can download at once from a playlist
const PLAYLIST_PAGE_LIMIT = 100

function createPlaylist (e, el, name, tracks, cb) {
  if (!name) name = window.prompt(strings.createPlaylist)
  if (!name) return
  create('playlist', {
    name: name,
    public: session.settings ? session.settings.playlistPublicByDefault : false,
    tracks: tracks
  }, cb ? cb : simpleUpdate)
}

function createAndAddToPlaylist (e, el) {
  var data = getTargetDataSet(el, false, true)

  if (!data)
    return

  var tracks = [{trackId: el.getAttribute('track-id'), releaseId: el.getAttribute('release-id')}]

  createPlaylist(e, el, data.name, tracks, (err, obj, xhr) => {
    if (err) {
      toasty(new Error(err))
      return
    }

    closeModal()
    toasty(strings.addedToPlaylist)
  })
}

function renamePlaylist (e, el) {
  var name = window.prompt(strings.renamePlaylist)

  if (!name)
    return

  update('playlist', el.getAttribute('playlist-id'), { name: name }, simpleUpdate)
}

function destroyPlaylist (e, el) {
  if (!window.confirm(strings.destroyPlaylist))
    return

  destroy('playlist', el.getAttribute('playlist-id'), simpleUpdate)
}

function removeFromPlaylist (e, el) {
  var pel   = document.querySelector('[playlist-id]')
  var id    = pel ? pel.getAttribute('playlist-id') : ""
  var url   = endpoint + '/playlist/' + id + '?fields=name,public,tracks,userId'
  var index = parseInt(el.getAttribute('playlist-position'))

  if (!id) {
    toasty(new Error(strings.error))
    return
  }

  loadCache(url, (err, obj) => {
    if (err) {
      toasty(new Error(err.message))
      return
    }

    var tracks = obj.tracks

    tracks.splice(index, 1)
    update('playlist', id, {tracks: tracks}, (err, obj, xhr) => {
      if (err) {
        toasty(new Error(err))
        return
      }

      cache(url, obj)
      loadSubSources(document.querySelector('[role="content"]'), true)
    })
  })
}

function openAddToPlaylist (e, el) {
  openModal('add-to-playlist-modal', {
    trackId:   el.getAttribute('track-id'),
    releaseId: el.getAttribute('release-id'),
  })
}

function transformAddToPlaylist (obj, done) {
  loadCache(endpoint + '/playlist', (err, playlists) => {
    if (err) {
      done(err)
      return
    }

    done(null, {
      trackId: obj.trackId,
      releaseId: obj.releaseId,
      results: playlists.results
    })
  }, true)
}

function addToPlaylist (e, el) {
  el = findParentWith(el, '[action=addToPlaylist]')
  var id = el.getAttribute('playlist-id')

  if (!id)
    return

  if (actionier.isOn(el))
    return

  var url = endpoint + '/playlist/' + id
  var item = {
    trackId: el.getAttribute('track-id'),
    releaseId: el.getAttribute('release-id')
  }

  if (!item.releaseId || !item.trackId) {
    toasty(new Error(strings.error))
    return
  }

  actionier.on(el)
  loadCache(url, (err, obj) => {
    if (err) {
      actionier.off(el)
      toasty(new Error(err.message))
      return
    }
    var tracks = obj.tracks

    index = tracks.length
    tracks.splice(index, 0, item)
    update('playlist', id, {tracks: tracks}, (err, obj, xhr) => {
      actionier.off(el)
      if (err) {
        toasty(new Error(err))
        return
      }

      cache(url, obj)
      closeModal()
      toasty(strings.addedToPlaylist)
    })
  })
}

function togglePlaylistPublic (e, el) {
  el.disabled = true
  update('playlist', el.getAttribute('playlist-id'), {
    public: !!el.checked
  }, (err, obj) => {
    el.disabled = false
    if (!err)
      return

    toasty(new Error(err.message))
    el.checked = !el.checked
  })
}

function isMyPlaylist (playlist) {
  if (!isSignedIn())
    return false

  return playlist.userId == session.user._id
}

function transformPlaylist (obj) {
  if (isMyPlaylist(obj)) {
    obj.canPublic = {
      _id:    obj._id,
      public: obj.public
    }
  }
  if (isSignedIn()) {
    var opts = {
      method: 'download',
      type: getMyPreferedDownloadOption()
    }

    if (obj.tracks.length < PLAYLIST_DOWNLOAD_LIMIT) {
      obj.downloadUrl = endpoint + '/playlist/' + obj._id + '/download?' + objectToQueryString(opts)
    }
    else {
      obj.downloadLinks = []
      var tracksPerPage = PLAYLIST_DOWNLOAD_LIMIT
      var numPages = Math.ceil(obj.tracks.length / tracksPerPage)

      for (var page = 1; page <= numPages; page++) {
        opts.page = page
        var frm = (page - 1) * tracksPerPage + 1
        var to = Math.min(obj.tracks.length, frm + tracksPerPage - 1)

        obj.downloadLinks.push({
          label: ((page == 1) ? 'Download ' : '') + 'Part ' + page,
          hover: 'Tracks ' + frm + ' to ' + to,
          url: endpoint + '/playlist/' + obj._id + '/download?' + objectToQueryString(opts)
        })
      }
    }
  }

  var numLoadingPages = Math.ceil(obj.tracks.length / PLAYLIST_PAGE_LIMIT)

  obj.pagePlaceholders = []
  for (var i = 1; i <= numLoadingPages; i++) {
    const trackPlaceholders = []

    for (var j = 0; j < PLAYLIST_PAGE_LIMIT; j++) {
      trackPlaceholders.push({
        index: j,
        number: ((i - 1) * PLAYLIST_PAGE_LIMIT) + j + 1,
        title: createLoadingPlaceHolder(20, 40),
        artists: createLoadingPlaceHolder(20, 40),
        release: createLoadingPlaceHolder(15, 25),
        genre: createLoadingPlaceHolder(10, 18),
        page: i
      })
    }
    obj.pagePlaceholders.push({tracks: trackPlaceholders, page: i})
  }

  return obj
}

function transformPlaylistTracks (obj, done) {
  var id = document.querySelector('[playlist-id]').getAttribute('playlist-id')
  var url = endpoint + '/playlist/' + id + '?fields=name,public,userId'
  var playlist = cache(url)

  var trackAtlas = toAtlas(obj.results, '_id')

  obj.results = obj.results.map((item, index, arr) => {
    var track = mapTrack(item)

    track.index = index + obj.skip
    track.trackNumber = index + 1 + obj.skip
    track.playlistId = id
    track.canRemove = isMyPlaylist(obj) ? { index: track.index } : undefined
    if (isMyPlaylist(playlist)) {
      track.edit = {
        releaseId: track.releaseId,
        _id: track._id,
        title: track.title,
        trackNumber: track.trackNumber,
        index: track.index
      }
    } else {
      track.noEdit = {
        trackNumber: track.trackNumber
      }
    }

    return track
  })
  done(null, obj)
}

function completedPlaylistTracks (source, obj) {
  updateControls()
}

function completedPlaylist (source, obj) {
  if (obj.error) return
  var pl = obj.data

  setPageTitle(pl.name + pageTitleGlue + 'Playlist')
  setMetaData({
    'og:type': 'music.playlist',
    'og:title': pl.name,
    'og:url': location.toString()
  })
  appendSongMetaData(obj.data.tracks)
  pageIsReady()

  //Make a bunch of divs that are loading tracks to put into
  //the tbody
  const pages = Math.ceil(pl.tracks.length / PLAYLIST_PAGE_LIMIT)

  function loadTracksDelayed (page) {
    loadPlaylistTracksPage(pl._id, page, () => {
      if (page < pages) {
        setTimeout(() => {
          loadTracksDelayed(page + 1)
        }, 250)
      }
    })
  }

  loadTracksDelayed(1)

  const playlistTracks = {
    pages: pages,
    pagesLoaded: 0,
    pageResults: {},
    resultTables: {}
  }
  /*
  const limit = PLAYLIST_PAGE_LIMIT
  const skip = i * PLAYLIST_PAGE_LIMIT

  for (var i = 0; i < pages; i++) {
    const table = document.createElement('table')

    const html =  '<tbody source="$endpoint/catalog/browse/?playlistId={{_id}}&skip={{skip}}&limit={{limit}}" template="playlist-tracks"><tr></tr></tbody>'

    render(table, html, {_id: pl._id, skip: skip, limit: limit})

    playlistTracks.resultTables[i] = table
  }

  cache('playlistTracks', playlistTracks)
  */
}

function getPlaylistTracksTable () {
  return document.querySelector('table[role="playlist-tracks"]')
}

function getPlaylisTracksTHead () {
  return getPlaylistTracksTable().querySelector('thead')
}

function loadPlaylistTracksPage (playlistId, page, done) {
  const skip = (page - 1) * PLAYLIST_PAGE_LIMIT
  const limit = PLAYLIST_PAGE_LIMIT
  const url = endpoint + '/catalog/browse/?playlistId=' + playlistId + '&skip= ' + skip + '&limit=' + limit

  requestJSON({
    url: url,
    withCredentials: true
  }, (err, result) => {
    if (err) {
      done(err)
      return
    }

    const tracksTable = getPlaylistTracksTable()
    const tracksTableTHead = getPlaylisTracksTHead()
    const placeHolderTBody = document.querySelector('tbody[data-placeholder-page="' + page + '"]')

    transformPlaylistTracks(result, (err, tracks) => {
      if (err) {
        done(err)
        return
      }

      const table = document.createDocumentFragment()
      const tbody = document.createElement('tbody')

      table.appendChild(tbody)

      render(tbody, getTemplate('playlist-tracks'), {data: tracks})

      tracksTable.insertBefore(table, placeHolderTBody)
      tracksTable.removeChild(placeHolderTBody)
      const firstPlaceHolder = placeHolderTBody.querySelector('tr[data-placeholder-page="' + page + '"]')

      if (done) {
        done(null, tracks)
      }
    })
  })
}

function arePlaylistTracksLoading () {
  return !!document.querySelector('tbody[data-placeholder-page]')
}

function reorderPlaylistFromInputs (e) {
  if (arePlaylistTracksLoading()) {
    toasty(new Error("Can't reorder tracks until they're all done loading."))
    return
  }

  const tracksTable = getPlaylistTracksTable()

  var inputs = tracksTable.querySelectorAll('[name="trackOrder\\[\\]"')

  //This is a kinda hacky way for not letting them accidentally delete all their tracks
  //by spam clicking while the track list is reloading
  if (inputs.length == 0)
    return

  var trackOrdering = []
  var trackEls = []
  var changed = false

  for (var i = 0; i < inputs.length; i++) {
    var input = inputs[i]
    var trackId = input.getAttribute('track-id')
    var releaseId = input.getAttribute('release-id')
    var to = parseInt(input.value)
    var from = i + 1

    if (!changed)
      changed = to != from

    trackOrdering.push({trackId: trackId, releaseId: releaseId, from: from, to: to})
  }

  //If there are no changes OR we're still rendering their last change then we skip
  if (!changed || tracksTable.classList.contains('ordering')) {
    return
  }

  tracksTable.classList.add('ordering')

  //This timeout allows the 'ordering' class to be applied before we do the heavy
  //lifting of reordering everything
  setTimeout(() => {
    trackOrdering.sort((a, b) => {
      //If you change #1 to #6 and leave #6 at #6 then track 1 should be after #6
      //If you move #7 to #3 and leave #3 unchanged, then #7 should be before #3
      if (a.to == b.to) {
        if (a.to > a.from)
          return 1

        if (a.to < a.from)
          return -1

        if (b.to > b.from)
          return -1

        if (b.to < b.from)
          return 1

        return 0
      }
      return a.to > b.to ? 1 : -1
    })

    const trackReleaseCounts = {}

    trackEls = trackOrdering.map((item, index) => {
      const id = item.trackId + '_' + item.releaseId

      if (!trackReleaseCounts.hasOwnProperty(id)) {
        trackReleaseCounts[id] = 0
      }
      else {
        trackReleaseCounts[id]++
      }

      const els = tracksTable.querySelectorAll('tr[role="playlist-track"][track-id="' + item.trackId + '"][release-id="' + item.releaseId + '"]')

      return els[trackReleaseCounts[id]]
    })

    const fragment = document.createDocumentFragment()
    const tbody = document.createElement('tbody')

    fragment.appendChild(tbody)

    //Append all the els to the new tbody. They've been resorted
    for (var i = 0; i < trackEls.length; i++)
      fragment.insertBefore(trackEls[i], null)

    const tbodys = tracksTable.querySelectorAll('tbody');

    //Delete any existing tbodies
    for(var i = 0; i < tbodys.length; i++) {
      tracksTable.removeChild(tbodys[i])
    }

    //Append the new tbody
    tracksTable.insertBefore(fragment, getPlaylisTracksTHead())

    resetPlaylistInputs()
    savePlaylistOrder()
    setTimeout(() => {
      tracksTable.classList.toggle('ordering', false)
    }, 1)
  }, 1)
}

function resetPlaylistInputs() {
  var trackEls = document.querySelectorAll('[role="playlist-track"]')

  for (var i = 0; i < trackEls.length; i++)
    trackEls[i].querySelector('input[name="trackOrder\[\]"]').value = (i + 1)

}

function savePlaylistOrder() {
  var id = document.querySelector('[playlist-id]').getAttribute('playlist-id')
  var trackEls = document.querySelectorAll('[role="playlist-track"]')
  var trackSaves = []

  for (var i = 0; i < trackEls.length; i++) {
    trackSaves.push({
      trackId: trackEls[i].getAttribute('track-id'),
      releaseId: trackEls[i].getAttribute('release-id')
    })
  }
  var url   = endpoint + '/playlist/' + id + '?fields=name,public,tracks,userId'

  update('playlist', id, {tracks: trackSaves}, (err, obj, xhr) => {
    if (err)
      return toasty(new Error(err))

    cache(url, obj)
    simpleUpdate()
    toasty(strings.reorderedPlaylist)
  })
}

function playlistTrackOrderFocus(e, el) {
  el.closest('[role="playlist-track"]').setAttribute('draggable', 'false')
}

function playlistTrackOrderBlur(e, el) {
  el.closest('[role="playlist-track"]').setAttribute('draggable', 'true')
}

function playlistDragStart (e, trackId, releaseId) {
  if (arePlaylistTracksLoading()) {
    e.preventDefault()
    return false
  }

  e.dataTransfer.setData("trackId", trackId)
  e.dataTransfer.setData("releaseId", releaseId)
  e.dataTransfer.setData("childIndex", getChildIndex(e.target))
  e.target.closest('[role="playlist-track"]').classList.add('drag-dragging')
}

function getOffset(el) {
  var _x = 0
  var _y = 0

  while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
    _x += el.offsetLeft - el.scrollLeft
    _y += el.offsetTop - el.scrollTop
    el = el.offsetParent
  }
  return { top: _y, left: _x }
}

function getEventVertHalf (e, el) {
  var offset = getOffset(el)
  var height = el.offsetHeight

  if (e.clientY < (offset.top + (height / 2)))
    return 'top'

  return 'bottom'
}

function playlistAllowDrop (e) {
  e.preventDefault()
  var targetTr = e.target.closest('[role="playlist-track"]')

  targetTr.classList.add('drag-active')
  var half = getEventVertHalf(e, targetTr)

  if (half == 'top') {
    targetTr.classList.add('drag-active-top')
    targetTr.classList.remove('drag-active-bottom')
  }
  else {
    targetTr.classList.add('drag-active-bottom')
    targetTr.classList.remove('drag-active-top')
  }
}

function playlistDragLeave (e) {
  e.target.closest('[role="playlist-track"]').classList.remove('drag-active', 'drag-active-top', 'drag-active-bottom')
}

function getChildIndex (child){
  var parent = child.parentNode
  var children = parent.children
  var i = children.length - 1

  for (; i >= 0; i--){
    if (child == children[i])
      return i

  }
  return i
}

function playlistDrop (e) {
  var trackId = e.dataTransfer.getData('trackId')
  var releaseId = e.dataTransfer.getData('releaseId')
  var droppedTr = e.target.closest('[role="playlist-track"]')
  var draggedTr = document.querySelector('tr[role="playlist-track"][track-id="' + trackId + '"][release-id="' + releaseId + '"]')

  if (draggedTr == null)
    return

  draggedTr.classList.remove('drag-dragging')
  var draggedIndex = e.dataTransfer.getData('childIndex')
  var droppedIndex = getChildIndex(droppedTr)
  var half = getEventVertHalf(e, droppedTr)
  var insertBefore = half == 'top' ? droppedTr : droppedTr.nextSibling

  droppedTr.parentNode.insertBefore(draggedTr, insertBefore)
  droppedTr.classList.remove('drag-active', 'drag-active-bottom', 'drag-active-top')
  resetPlaylistInputs()
  savePlaylistOrder()
}
