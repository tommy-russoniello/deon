const PLAYLIST_DOWNLOAD_LIMIT = 50 //Maximum tracks you can download at once from a playlist
const PLAYLIST_PAGE_LIMIT = 50

function createPlaylist (aName, tracks, cb) {
  let name = aName || window.prompt(strings.createPlaylist)
  if (!name) {
    return
  }
  requestJSON({
    url: endpoint2 + '/self/playlist',
    method: "POST",
    data: {
      name: name,
      public: session.settings ? session.settings.playlistPublicByDefault : false,
      tracks: tracks
    },
    withCredentials: true
  }, cb ? cb : simpleUpdate)
}

function clickCreatePlaylist (e, el) {
  const name = window.prompt(strings.createPlaylist)
  createPlaylist(name, [])
}

function createAndAddToPlaylist (e, el) {
  submitForm(e, {
    url: `${endpoint}/self/playlist`,
    validate: (data, errs) => {
      if (!data.name) {
        errs.push('Name is required')
      }
      return errs
    },
    transformData: (data) => {
      data.tracks = [{trackId: data.trackId, releaseId: data.releaseId}]
      return data
    },
    action: (opts) => {
      actionier.on(opts.form)
      createPlaylist(opts.data.name, opts.data.tracks, (err, obj, xhr) => {
        actionier.off(opts.form)
        if (terror(err)) {
          formErrors(opts.form, err)
          return
        }
        closeModal()
        toasty(strings.addedToPlaylist)
      })
    }
  })
}

function updatePlaylist(id, data, done) {
  requestJSON({
    url: endpoint2 + '/playlist/' + el.dataset.playlistId,
    method: "PATCH",
    data: data,
    withCredentials: true
  }, done)
}

function renamePlaylist (e, el) {
  var name = window.prompt(strings.renamePlaylist, el.dataset.playlistName)
  if (!name) {
    return
  }
  updatePlaylist(el.dataset.playlistId, {
      name: name,
  }, simpleUpdate)
}

function destroyPlaylist (e, el) {
  if (!window.confirm(strings.destroyPlaylist))
    return
  requestJSON({
    url: endpoint2 + '/playlist/' + el.dataset.playlistId,
    method: "DELETE",
    withCredentials: true,
  }, simpleUpdate)
}

function clickRemoveFromPlaylist (e, el) {
  const index = parseInt(el.dataset.playlistPosition)
  const id = cache(PAGE_PLAYLIST).playlist._id
  if (!id) {
    toasty(new Error(strings.error))
    return
  }
  const url = `${endpoint2}/playlist/${id}`
  requestJSON(url, (err, obj) => {
    if (terror(err)) {
      return
    }
    const tracks = obj.tracks
    toasty('Track removed from playlist')
    tracks.splice(index, 1)
    updatePlaylist(id, {tracks:tracks}, (err, obj, xhr) => {
      if (terror(err)) {
        return
      }
      cache(url, obj)
      loadNodeSources(findNode('[role="content"]'), true)
    })
  })
}

function openAddToPlaylist (e, el) {
  const template = 'add-to-playlist-modal'
  const trackId = el.dataset.trackId
  const releaseId = el.dataset.releaseId

  openModal(template, {
    loading: true
  })

  requestCachedURL(`${endpoint2}/self/playlist`, (err, playlists) => {
    if (err) {
      renderModal(template, {
        error: err,
        loading: false
      })
      return
    }
    renderModal(template, {
      trackId: trackId,
      releaseId: releaseId,
      results: playlists.results,
      showFilter: playlists.results.length > 3,
      loading: false
    })

    function playlistModalFilter (e) {
      const search = filterNormalize(this.value)
      playlists.results.forEach((pl) => {
        const name = filterNormalize(pl.name)
        const tr = findNode('.modal tr[data-playlist-id="' + pl._id + '"]')
        const found = name.indexOf(search) >= 0
        tr.style.display = !found ? 'none' : 'table-row'
      })
    }

    const filter = findNode('[role="filter-playlists"]')
    if (filter) {
      filter.addEventListener('keyup', playlistModalFilter)
      filter.focus()
    }
  }, true)
}

function filterNormalize (filter) {
  filter = filter || ""
  return filter.toLowerCase().split(/['"\s]/).join('')
}

function addToPlaylist (e, el) {
  const playlistId = el.dataset.playlistId
  const trackId = el.dataset.trackId
  const releaseId = el.dataset.releaseId

  if (!playlistId) {
    return
  }

  if (actionier.isOn(el)) {
    return
  }

  const url = endpoint2 + '/playlist/' + playlistId
  const item = {
    trackId: trackId,
    releaseId: releaseId
  }
  if (!item.releaseId || !item.trackId) {
    toasty(new Error(strings.error))
    return
  }
  actionier.on(el)
  requestCachedURL(url, (err, obj) => {
    if (err) {
      actionier.off(el)
      toasty(new Error(err.message))
      return
    }
    const tracks = obj.tracks
    index = tracks.length
    tracks.splice(index, 0, item)
    updatePlaylist(playlistId, {tracks: tracks}, (err, obj, xhr) => {
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
  if (actionier.isOn(el)) {
    return
  }
  const playlistId = cache(PAGE_PLAYLIST).playlist._id
  actionier.on(el)
  updatePlaylist(playlistId, {public: !!el.checked}, (err, obj) => {
    actionier.off(el)
    if (terror(err)) {
      return
    }
    el.checked = obj.public
    if (obj.public) {
      toasty('Playlist is now public')
    }
    else {
      toasty('Playlist is now private')
    }
  })
}

function isMyPlaylist (playlist) {
  if (!isSignedIn()) {
    return false
  }
  return playlist.userId == session.user._id
}

/**
 * Processor for showing your list of playlists
 */
function processPlaylistsPage (args) {
  pageProcessor(args)
}

function processPlaylistPage (args) {
  processor(args, {
    error: (args) => {
      renderError(args.error)
    },
    success: function (args) {
      const playlist = args.result
      const scope = {
        playlist: playlist
      }
      const tracksPerPage = 50

      if (isMyPlaylist(playlist)) {
        scope.canPublic = {
          _id: playlist._id,
          public: playlist.public
        }
      }
      if (isSignedIn()) {
        const opts = {
          method: 'download',
          type: getMyPreferedDownloadOption()
        }

        if (playlist.tracks.length < PLAYLIST_DOWNLOAD_LIMIT) {
          scope.downloadUrl = endpoint2 + '/playlist/' + playlist._id + '/download?' + objectToQueryString(opts)
        }
        else {
          scope.downloadLinks = []
          const numPages = Math.ceil(playlist.tracks.length / tracksPerPage)

          for (var page = 1; page <= numPages; page++) {
            opts.page = page
            var frm = (page - 1) * tracksPerPage + 1
            var to = Math.min(playlist.tracks.length, frm + tracksPerPage - 1)

            scope.downloadLinks.push({
              label: ((page == 1) ? 'Download ' : '') + 'Part ' + page,
              hover: 'Tracks ' + frm + ' to ' + to,
              url: endpoint2 + '/playlist/' + playlist._id + '/download?' + objectToQueryString(opts)
            })
          }
        }
      }

      var numLoadingPages = Math.ceil(playlist.tracks.length / PLAYLIST_PAGE_LIMIT)
      numLoadingPages = Math.max(numLoadingPages, 1)

      scope.pagePlaceholders = []
      const stages = []
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
        scope.pagePlaceholders.push({tracks: trackPlaceholders, page: i})
        stages.push('playlist_page_' + i)
      }
      cache(PAGE_PLAYLIST, scope)
      renderContent(args.template, scope)
      primePageIsReady({
        title: playlist.name + pageTitleGlue + 'Playlist',
        'og:type': 'music.playlist',
        'og:title': playlist.name,
      }, stages)
      appendSongMetaData(playlist.tracks)
      completedPlaylist()
    }
  })
}

function completedPlaylistTracks (source, obj) {
  updateControls()
}

function completedPlaylist (source, obj) {
  const pl = cache(PAGE_PLAYLIST).playlist

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
      else {
        bindOnEnter()
      }
    })
  }

  loadTracksDelayed(1)
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
  const playlist = cache(PAGE_PLAYLIST).playlist

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

    const tracks = transformPlaylistTracks(playlist, result.results, page)

    const table = document.createDocumentFragment()
    const tbody = document.createElement('tbody')

    table.appendChild(tbody)

    betterRender('playlist-tracks', tbody, {results: tracks})

    if (placeHolderTBody) {
      tracksTable.insertBefore(table, placeHolderTBody)
      tracksTable.removeChild(placeHolderTBody)
      const firstPlaceHolder = placeHolderTBody.querySelector('tr[data-placeholder-page="' + page + '"]')
    }

    if (done) {
      done(null, tracks)
    }

    pageStageIsReady('playlist_page_' + page)
  })
}

function transformPlaylistTracks (playlist, tracks, page) {
  const indexBump = (page - 1) * PLAYLIST_PAGE_LIMIT

  return tracks.map((item, index, arr) => {
    const track = mapTrack(item)

    track.index = index + indexBump
    track.trackNumber = index + 1 + indexBump
    track.playlistId = playlist._id
    track.canRemove = isMyPlaylist(playlist) ? { index: track.index } : undefined
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
    var trackId = input.dataset.trackId
    var releaseId = input.dataset.releaseId
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

      const els = tracksTable.querySelectorAll('tr[role="playlist-track"][data-track-id="' + item.trackId + '"][data-release-id="' + item.releaseId + '"]')

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

  for (var i = 0; i < trackEls.length; i++) {
    trackEls[i].querySelector('input[name="trackOrder\[\]"]').value = (i + 1)
  }
}

function savePlaylistOrder() {
  const id = cache(PAGE_PLAYLIST).playlist._id
  const trackEls = document.querySelectorAll('[role="playlist-track"]')
  const trackSaves = []
  for (let i = 0; i < trackEls.length; i++) {
    trackSaves.push({
      trackId: trackEls[i].dataset.trackId,
      releaseId: trackEls[i].dataset.releaseId
    })
  }
  updatePlaylist(id, {tracks: trackSaves}, (err, obj, xhr) => {
    if (terror(err)) {
      return
    }
    cache(url, obj)
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

function getChildIndex (child) {
  var parent = child.parentNode
  var children = parent.children

  for (var i = children.length - 1; i >= 0; i--) {
    if (child == children[i]) {
      return i
    }
  }
  return i
}

function playlistDrop (e) {
  var trackId = e.dataTransfer.getData('trackId')
  var releaseId = e.dataTransfer.getData('releaseId')
  var droppedTr = e.target.closest('[role="playlist-track"]')
  var draggedTr = findNode('tr[role="playlist-track"][data-track-id="' + trackId + '"][data-release-id="' + releaseId + '"]')
  if(draggedTr == null) {
    return
  }

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
