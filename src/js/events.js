/*===============================
=            HELPERS            =
===============================*/
function getFeaturedToggleEl () {
  return document.querySelector('[role="upcoming-toggle"]')
}

function getLoadMoreEventsEl () {
  return document.querySelector('[role="load-more-upcoming-events"]')
}

function openGalleryModal (e, el) {
  openModal('gallery-modal', {
    src: el.getAttribute('big-src')
  })
}


function getUpcomingEventsQueryObject (options) {
  var page = Math.max(1, parseInt(options.page) || 1)
  var limit = 10
  var qo = {
    limit: limit,
    skip: (page - 1) * limit,
    page: page
  }

  if (options.hasOwnProperty('featured')) {
    qo.featured = options.featured
  }
  return qo
}

/*==================================
=            PROCESSORS            =
==================================*/
function processEventPage (args) {
  let event
  pageProcessor(args, {
    transform: function (args) {
      event = transformEvent(args.result)
      const scope = {
        event: event
      }

      scope.view = false
      scope.single = true
      scope.isSignedIn = isSignedIn()
      scope.userEmail = scope.isSignedIn ? session.user.email : ''
      return scope
    },
    completed: (args) => {
      var title = event.name + ' in ' + event.location + ' @ ' + event.venue

      var meta = {
        'title': title,
        'description': event.description,
        'og:image': event.posterImageUri
      }

      initLocationAutoComplete()

      pageIsReady(meta)
    }
  })
}

function processHeaderEvent (args) {
  templateProcessor('events-header', args, {
    start: function () {
      betterRender('loading-view-black', args.node)
    },
    transform: function (args) {
      const header = transformEvent(args.result.results[0])
      console.log('header', header);

      return {
        event: header
      }
    },
    completed: () => {
      pageStageIsReady('header_event')
    }
  })
}

function processUpcomingEvents (args) {
  templateProcessor('events-table', args, {
    transform: function (args) {
      var scope = {
        results: transformEvents(args.result.results)
      }

      return scope
    },
    completed: function (args) {
      const result = args.result
      var button = getLoadMoreEventsEl()
      var shown = (result.skip) + (result.results.length)

      toggleUpcoming.hideLoadMore = shown >= result.total
      button.classList.toggle('hide', toggleUpcoming.hideLoadMore)
      loadAndAppendFeaturedEvents()
      pageStageIsReady('upcoming_events')
    }
  })
}

/**
 * Procceses call for events at the bottom of the page
 *
 */
function processPastEvents (args) {
  templateProcessor('events-past', args, {
    transform: function (args) {
      const scope = {}

      scope.results = transformEvents(args.result.results)
      scope.results = scope.results.filter((el) => {
        return !el.upcoming
      })
      scope.results = scope.results.sort((a, b) => {
        if (a.startDate == b.startDate) {
          return 0
        }
        return a.startDate > b.startDate ? -1 : 1
      })
      return scope
    },
    completed: () => {
      pageStageIsReady('past_events')
    }
  })
}

function processEventsPage (args) {
  const scope = {}

  scope.page = 1
  scope.isSignedIn = isSignedIn()
  scope.userEmail = scope.isSignedIn ? session.user.email : ''

  primePageIsReady({
    title: 'Monstercat Events',
    description: 'Upcoming offical Monstercat shows and events, and artist concerts.'
  }, ['header_event', 'upcoming_events', 'past_events'])

  renderContent(args.template, scope)

  var qo = getUpcomingEventsQueryObject(window.location.search)

  loadUpcomingEvents(window.location.search)
  initLocationAutoComplete()
  var embedDiv = document.querySelector('[role=event-google-tracking]')

  embedDiv.innerHTML = '<script type="text/javascript">'
  + ' var google_conversion_id = 975131676;'
  + 'var google_custom_params = window.google_tag_params;'
  + 'var google_remarketing_only = true;'
  + '</script>'
  + '<script type="text/javascript" src="//www.googleadservices.com/pagead/conversion.js"></script>'
  + '<noscript>'
  + '<div style="display:inline;"><img height="1" width="1" style="border-style:none;" alt="" src="//googleads.g.doubleclick.net/pagead/viewthroughconversion/975131676/?guid=ON&amp;script=0"/></div>'
  + '</noscript>'
}

/*====================================
=            TRANSFORMERS            =
====================================*/
function transformEvents (results) {
  return results.map(transformEvent)
}

function transformEvent (event) {
  var endDate = event.endDate ? new Date(event.endDate) : false

  event.upcoming = new Date(event.startDate) > new Date()
  if (endDate) {
    event.ongoing = !event.upcoming && endDate > new Date()
  }
  else {
    event.ongoing = false
  }
  event.dateString = formatDate(event.startDate)
  event.date = formatDateJSON(event.startDate)
  event.icalDownloadLink = endpoint + '/events/addtocalendar/' + event._id
  if (event.vanityUri) {
    event.url = '/event/' + event.vanityUri
    event.externalUrl = false
  }
  else {
    event.externalUrl = true
    //TODO: Fix how we get and generate these URLs
    //    This method of building the URL gives 404s
    //event.url = 'http://www.bandsintown.com/t/' + event.bandsInTownId
    if (event.ctaUri) {
      event.url = event.ctaUri
    }
  }
  if (event.description && event.description.length > 0) {
    event.descriptionHtml = marked(event.description)
  }
  else {
    event.descriptionHtml = ''
  }
  event.showCtaButton = event.ctaUri && (event.upcoming || event.ongoing)
  if (event.artistDetails) {
    event.artistDetails = event.artistDetails.map(transformWebsiteDetails)
  }
  else {
    event.artistDetails = []
  }
  event.gallery = transformEventGallery(event)
  event.hasGallery = event.gallery.length > 0
  if (event.coverImageUri) {
    event.coverImageLarge = event.coverImageUri + '?image_width=2048'
    event.coverImageSmall = event.coverImageUri + '?image_width=512'
  }
  if (event.posterImageUri) {
    event.posterImageLarge = event.posterImageUri + '?image_width=2048'
    event.posterImageSmall = event.posterImageUri + '?image_width=512'
  }
  var weekdays = {
    'Sat': 'urday',
    'Sun': 'day',
    'Mon': 'day',
    'Tue': 'sday',
    'Wed': 'nesday',
    'Thu': 'rsday',
    'Fri': 'day'
  }

  if (event.youTubeVideoUrl) {
    const youtubeId = youTubeIdParser(event.youTubeVideoUrl)
    if (youtubeId) {
      event.youTubeEmbedUrl = 'https://www.youtube.com/embed/' + youtubeId
    }
  }

  event.localWeekdayLong = event.localWeekday + weekdays[event.localWeekday]
  return event
}

function transformEventGallery (event) {
  if (!event.galleryImages) {
    return []
  }
  return event.galleryImages.map((url) => {
    return {
      thumbSrc: url + '?image_width=256',
      bigSrc: url
    }
  })
}

function processEventsEmailOptin (args) {
  templateProcessor('events-email-optin', args, {
    transform: function (args) {
      return transformEventsEmailOptin(args.result)
    },
    completed: completedEventsEmailOptin
  })
}

function transformEventsEmailOptin (obj) {
  obj.isSignedIn = isSignedIn()
  if (obj.isSignedIn) {
    obj.emailOptIns = transformEmailOptins(obj.emailOptIns)
    obj.fullyOptedIn = obj.emailOptIns.events && !isLegacyLocation()

    //Legacy Location
    //delete obj.googleMapsPlaceId
    //obj.location = "Canada"

    //New Location
    //obj.location = "Canada"
    //obj.googleMapsPlaceId = "ChIJs0-pQ_FzhlQRi_OBm-qWkbs"
    //obj.placeName = "Vancouver"
    //obj.placeNameFull = "Vancouver, BC, Canada"

    //Has Opted In
    //obj.emailOptIns = {eventsNearMe: true}

    //Has Opted Out
    //obj.emailOptIns = {eventsNearMe: false}

    //Hasn't opted in or out
    //obj.emailOptIns = {}
  }
  return obj
}

function subscribeEventsOptIn (e, el) {
  var data = formToObject(el)

  data['emailOptIns[events]'] = true
  update('self', null, data, (err, obj) => {
    if (err) { return window.alert(err.message) }
    toasty('You are now subscribed to hear about Monstercat events')

    resetTargetInitialValues(el, obj)
    loadSession((err, obj) => {
      loadSubSources(document.querySelector('[role=events-email-optin]'), true, true)
    })
  })
}

function signUpForEventEmail (e, el) {
  var data = formToObject(el)
  var qs = {}

  if (data && data.placeNameFull && data.placeNameFull.length > 0) {
    qs.location = data.placeNameFull
  }
  if (data.email && data.email.length > 0) {
    qs.email = data.email
  }
  qs.promotions = 1
  return go('/sign-up?' + objectToQueryString(qs))
}

function getUpcomingEventsQueryString (options) {
  return objectToQueryString(getUpcomingEventsQueryObject(options))
}

function loadUpcomingEvents (options) {
  //Append a new table of upcoming events with source
  //being the next limit/skip the elements
  var upcomingQS = getUpcomingEventsQueryString(options)

  var div = document.createElement('div')
  var container = findNode('[role="events-tables"]')

  betterRender('events-table-container', div, {
    upcomingQueryString: upcomingQS
  })

  container.appendChild(div)
  loadNodeSources(div)
}

function clickLoadMoreUpcomingEvents (e, el) {
  const button = getLoadMoreEventsEl()
  const att = button.getAttribute('current-page')
  const page = parseInt(att) + 1

  loadUpcomingEvents({page: page})
  button.setAttribute('current-page', page)
}

function loadAndAppendFeaturedEvents () {
  var url = endpoint + '/events/upcoming?featured=1&skip=0&limit=20'

  requestCachedURL(url, (err, result) => {
    if (err) {
      checkNoFeaturedMessage()
      return console.error(err)
    }

    //Delete all the existing featured events
    findNodes('tr.featured').forEach((el) => {
      el.parentNode.removeChild(el)
    })

    var trsToAdd = result.results.map((evt) => {
      const event = transformEvent(evt)
      const table = document.createElement('table')
      betterRender('upcoming-event-tr', table, event)

      const featuredTr = table.querySelector('tr')

      return featuredTr
    })

    trsToAdd.forEach((newTr) => {
      var allTrs = document.querySelectorAll('tr[data-event-id]')
      var newDate = new Date(newTr.getAttribute('data-date'))
      var checkDate
      var trBefore, trAfter, dateAfter, dateBefore

      trBefore = allTrs[0]
      dateBefore = new Date(trBefore.dataset.date)

      if (!trBefore || dateBefore > newDate) {
        trBefore.parentNode.prepend(newTr)
        return
      }

      i = 0
      var inserted = false
      do {
        trBefore = allTrs[i]
        trAfter = allTrs[i+1]

        dateBefore = new Date(trBefore.dataset.date)

        if (trAfter) {
          dateAfter = new Date(trAfter.dataset.date)
        } else {
          dateAfter = new Date("3000-01-01")
        }

        if (dateBefore <= newDate && dateAfter >= newDate) {
          trBefore.parentNode.insertBefore(newTr, trBefore.nextSibling)
          inserted = true
        }

        i++
      } while (!inserted && i < allTrs.length)

      if (!inserted) {
        trBefore.parentNode.prepend(newTr)
      }
    })

    checkNoFeaturedMessage()
  })
}

function toggleUpcoming (){
  var el = getFeaturedToggleEl()
  var button = getLoadMoreEventsEl()

  document.querySelector('[role=events-tables]').classList.toggle('events--filtered', el.checked)
  if (el.checked) {
    loadAndAppendFeaturedEvents()
    button.classList.toggle('hide', true)
  }
  else {
    button.classList.toggle('hide', toggleUpcoming.hideLoadMore)
    checkNoFeaturedMessage()
  }
}
toggleUpcoming.hideLoadMore = true

function completedEventsEmailOptin () {
  initLocationAutoComplete()
}

function checkNoFeaturedMessage () {
  var numFeatured = document.querySelectorAll('[role=events-tables] tr.featured').length
  var hide = numFeatured > 0 || !getFeaturedToggleEl().checked

  document.querySelector('.events-no-featured-message').classList.toggle('hide', hide)
  document.querySelector('[role=events-tables]').classList.toggle('events--filtered-empty', !hide)
}
