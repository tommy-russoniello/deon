var endpoint        = endhost + '/api'
var newshost        = 'https://www.monstercat.com/news-api'
var datapoint       = 'https://blobcache.monstercat.com'
var session         = null
var pageTitleSuffix = 'Monstercat'
var pageTitleGlue   = ' - '
var lstore          = window.localStorage
var sixPackSession  = null

var SOCIAL_LINKS_MAP = {
  facebook: {
    icon: 'facebook',
    cta: 'Like on Facebook',
    name: 'Facebook',
  },
  twitter: {
    icon: 'twitter',
    cta: 'Follow on Twitter',
    name: 'Twitter'
  },
  instagram: {
    icon: 'instagram',
    cta: 'Follow on Instagram',
    name: 'Instagram'
  },
  youtube: {
    icon: 'youtube-play',
    cta: 'Subscribe on YouTube',
    name: 'YouTube'
  },
  soundcloud: {
    icon: 'soundcloud',
    cta: 'Follow on SoundCloud',
    name: 'SoundCloud'
  }
}

Object.keys(SOCIAL_LINKS_MAP).forEach((key) => {
  SOCIAL_LINKS_MAP[key].platform = key
})

preLoadImage('/img/artwork.jpg')
preLoadImage('/img/artwork-merch.jpg')
preLoadImage('/img/artist.jpg')

document.addEventListener("DOMContentLoaded", (e) => {
  const routeNodes = findNodes('[data-route]')

  for (var i = 0; i < routeNodes.length; i++) {
    const node = routeNodes[i]

    if (!node.dataset.template) {
      node.dataset.template = 'template_' + i
    }
    if (!node.dataset.process) {
      node.dataset.process = 'processPage'
    }
  }

  registerPartials()
  initSocials()
  renderHeader()
  loadSession((err, obj) => {
    sixPackSession = new sixpack.Session()
    trackUser()
    renderHeader()
    renderHeaderMobile()
    document.addEventListener("click", interceptClick)
    //document.addEventListener("dblclick", interceptDoubleClick)
    //document.addEventListener("keypress", interceptKeyPress)
    //document.addEventListener("submit", interceptSubmit);

    document.addEventListener("click", (e) => {
      var t = e.target
      var action = t.getAttribute("click-action")

      if (action) {
        var opts = {}
        var label = t.getAttribute('click-label')
        var category = t.getAttribute('click-category')

        if (label) {
          opts.label = label
        }
        if (category) {
          opts.category = category
        }
        recordEvent(action, opts)
      }

      var testEl = findParentOrSelf(t, "[ab-test]")

      if (testEl) {
        var testName = testEl.getAttribute("ab-test")
        var test = window.splittests[testName]

        if (test) {
          var kpi = testEl.getAttribute('kpi')

          if (kpi) {
            if (kpi.indexOf('click') != 0) {
              kpi = 'click-' + kpi
            }
            test.convertKpi(kpi)
          }
          else {
            test.convert()
          }
        }
      }
    })
    changeState(location.pathname + location.search)
    stickyPlayer()
    //siteNotices.completeProfileNotice.start();
    //siteNotices.goldShopCodeNotice.start()
  })
  document.querySelector('.credit [role=year]').innerText = new Date().getFullYear()

  window.addEventListener('routenotfound', (e) => {
    renderContent('404')
  })

  window.addEventListener('changestate', (e) => {
    recordPage()
    renderHeader()
    closeModal()
    if (e.detail && e.detail.title) {
      setPageTitle(e.detail.title)
    }
    window.scrollTo(0, 0)
    const rsslink = findNode('link[id="podcast-rss"]')

    if (rsslink) {
      document.head.removeChild(rsslink)
    }
    switch (location.pathname) {
    case "/":
      getStats()
      break
    case "/cotw":
    case "/podcast":
      setRSSLink()
      break
    }
    if (typeof (stopCountdownTicks) == 'function') {
      stopCountdownTicks()
    }
    if (window.location.pathname.indexOf("search") == -1) {
      const searchFields = findNodes('[name=term]')

      if (searchFields) {
        searchFields.forEach((el) => {
          el.value = ''
        })
      }
    }
    function setRSSLink() {
      const link = document.createElement('link')

      link.type = "application/rss+xml"
      link.rel = "alternate"
      link.title = "Call of the Wild Radio Show"
      link.href = "https://www.monstercat.com/podcast/feed.xml"
      link.id = "podcast-rss"
      document.head.appendChild(link)
    }
  })
})

function onPopState (e) {
  changeState(location.pathname + location.search, e.state, '')
}

window.addEventListener("popstate", onPopState)

var releaseTypes = {
  album: { value: 'Album', name: "Albums", key: 'album' },
  ep: { value: 'EP', name: "EPs", key: 'ep' },
  single: { value: 'Single', name: "Singles", key: 'single' },
  podcast: { value: 'Podcast', name: "Podcasts", key: 'podcast' }
}

var releaseTypesList = [
  releaseTypes.album,
  releaseTypes.ep,
  releaseTypes.single,
  releaseTypes.podcast
]

function preLoadImage (src) {
  (document.createElement('img')).src = src
}

function bgmebro() {
  if (!lstore) { return }
  lstore.removeItem('bgon')
}

function pageIsReady () {
  window.prerenderReady = true
}

function isSignedIn () {
  return !!(session && session.user)
}

function hasCompletedProfile () {
  if (!isSignedIn()) {
    return false
  }
  var user = session.user

  return !(!user.birthday || !user.emailOptIns || user.emailOptIns.length < 3 || !user.geoLocation)
}

function isLegacyUser () {
  if (!isSignedIn()) { return false }
  var user = session.user
  // Lolwut

  return user.type.indexOf('gold') > -1 ||
    user.type.indexOf('golden') > -1 ||
    user.type.indexOf('license') > -1 ||
    user.type.indexOf('subscriber') > -1
}

function isLegacyLocation () {
  return session.user.location && !session.user.hasOwnProperty('googleMapsPlaceId')
}

function hasGoldAccess () {
  if (!isSignedIn()) { return false }
  // TODO remove temporary support for old checks
  return !!session.user.goldService || hasLegacyAccess()
}

function hasFreeGold () {
  return hasGoldAccess() && !session.user.currentGoldSubscription
}

function hasLegacyAccess () {
  if (!isLegacyUser()) { return false }
  if (session.subscription) { return !!session.subscription.subscriptionActive }
  if (session.user && typeof session.user.subscriptionActive != 'undefined') { return !!session.user.subscriptionActive }
  return true
}

function getSession (done) {
  requestJSON({
    url: endpoint + '/self/session',
    withCredentials: true
  }, done)
}

function loadSession (done) {
  getSession((err, obj, xhr) => {
    if (err) {
      // TODO handle this!
      console.warn(err.message)
      if (err && endhost.indexOf('localhost') > 0) {
        alert('Make sure you have ' + endhost + ' running!')
      }
    }
    session = obj
    done(err, obj)
  })
}

function getSessionName () {
  var names = []

  if (session.user) {
    names = names.concat([session.user.name, session.user.realName, session.user.email.substr(0, session.user.email.indexOf('@'))])
  }
  for (var i = 0; i < names.length; i++) {
    if (names[i] && names[i].length > 0) {
      return names[i]
    }
  }
  return 'guest'
}

function recordPage () {
  if (typeof analytics == 'undefined') { return }
  analytics.page()
}

function recordEvent (name, obj, done) {
  if (typeof done != 'function')
  { done = function (err, obj, xhr) {} }
  if (ENV == 'development') {
    //This is here to quickly toggle between wanting to record events and not wanting to
    if (false) {
      return done(Error('Not recording events in development mode.'))
    }
    console.warn('Recording an event while in development mode: ', name, obj)
  }

  requestJSON({
    url: endhost + '/analytics/record/event',
    withCredentials: true,
    method: 'POST',
    data: {
      event: name,
      properties: obj
    }
  }, done)
}

function recordErrorAndAlert (err, where) {
  recordEvent('Error', {
    message: err.message,
    where: where
  })
  toasty(new Error(err.message))
}

function recordErrorAndGo (err, where, uri) {
  recordEvent('Error', {
    message: err.message,
    where: where
  })
  go(uri)
}

function recordGoldEvent (action, aObj, done) {
  const obj = aObj || {}

  obj.category = 'Gold'
  return recordEvent(action, obj, done)
}

function recordSubscriptionEvent (name, obj, done) {
  if (typeof (obj) == 'string') {
    obj = {
      label: obj
    }
  }
  obj = obj || {}
  obj.category = 'Subscriptions'
  return recordEvent(name, obj, done)
}

function trackUser () {
  if (!isSignedIn()) { return }
  analytics.identify(session.user._id, {
    email: session.user.email,
    name: session.user.realName
  })
}

function untrackUser () {
  analytics.reset()
}

function showFront (e, el) {
  const front = document.getElementById('front-form')
  const scope = {}
  const meta = [{
    name: 'currentPage',
    value: window.location.toString()
  }, {
    name: 'browser',
    value: bowser.name + ' ' + bowser.version
  }]

  if (isSignedIn()) {
    scope.email = session.user.email
    meta.push({
      name: 'uid',
      value: session.user._id
    })
    meta.push({
      name: 'gold',
      value: hasGoldAccess() ? 'Yes' : 'No'
    })
    scope.name = session.user.realName || session.user.name
  }

  scope.meta = meta
  cache('front-form', scope)
  renderFrontForm()
  front.classList.toggle('show', true)
}

function renderFrontForm () {
  const front = document.getElementById('front-form')

  betterRender('front-form', front, cache('front-form'))
}

function closeFrontForm (e) {
  if (e) {
    e.preventDefault()
  }
  document.getElementById('front-form').classList.toggle('show', false)
}

function submitFrontForm (e) {
  submitForm(e, {
    url: endpoint + '/support/send',
    method: 'POST',
    validate: function (data, errors) {
      if (!data.email) {
        errors.push('Email is required')
      }

      if (!data.body) {
        errors.push('Message is required')
      }

      return errors
    },
    success: function () {
      toasty('Message sent!')
      closeFrontForm()
    }
  })

  return
}

function showIntercom (e, el) {
  if (!window.Intercom)
  { return toasty(new Error('Intercom disabled by Ad-Block. Please unblock.')) }
  window.Intercom('show')
}

//This is for shorting copy crediting for Facebook and Twitter and the like
function createCopycreditOther (track) {
  var credit = track.title + ' by '
  var artists = []

  track.artists = track.artists || []
  for (var i = 0; i < track.artists.length; i++) {
    artists.push(track.artists[i].name)
  }
  artists.push('@Monstercat')
  return credit + artists.join(', ')
}

function createCopycredit (title, links) {
  var credit = 'Title: ' + title + "\n"
  var prefixes = {
    'youtube': 'Video Link: ',
    'itunes': 'iTunes Download Link: ',
    'spotify': 'Listen on Spotify: '
  }

  links = links || []
  links.forEach((link) => {
    var url = link.original

    if (!url) { return }
    for (var site in prefixes) {
      if (url.indexOf(site) > 0) {
        credit += prefixes[site] + url + "\n"
      }
    }
  })
  return credit
}

function getArtistsAtlas (tks, done) {
  var ids = []

  tks = tks || []
  tks.forEach((track) => {
    ids = ids.concat((track.artists || []).map( (artist) => {
      return artist.artistId || artist._id
    }))
  })
  ids = uniqueArray(ids).filter(filterNil)
  if (!ids.length) { return done(null, []) }
  var url = endpoint + '/catalog/artists-by-users?ids=' + ids.join(',')

  requestCachedURL(url, (err, aobj) => {
    if (err) { return done(err) }
    return done(err, toAtlas(aobj.results, '_id'))
  })
}

function getArtistsTitle(artists) {
  if (artists.length == 0)
  { return '' }
  if (artists.length == 1)
  { return artists[0].name }
  var names = artists.map((artist) => {
    return artist.name
  })

  return names.join(', ') + ' & ' + names.pop()
}

//How you should mention an artist on twitter
//Use their @ username if we have, otherwise just their name
function getArtistTwitterMention (artist) {
  if (artist.urls) {
    var socials = getSocialsAtlas(artist.urls)

    if (socials.twitter) {
      var username = getTwitterLinkUsername(socials.twitter.original)

      if (username) {
        return username
      }
    }
  }

  return artist.name
}

function getTwitterLinkUsername (url) {
  var matches = url.match(/^https?:\/\/(www\.)?twitter\.com\/(#!\/)?([^\/]+)(\/\w+)*$/)
  var username

  if (matches && matches[3]) {
    var username = matches[3]

    if (username.substr(0, 1) != '@') {
      username = '@' + username
    }
    return username
  }

  return false
}

/* Loads the required release and track data specified by the object.
 * Object Requirments:
 *   releaseId
 *   trackId
 */
function loadReleaseAndTrack (obj, done) {
  requestCachedURL(endpoint + '/catalog/track/' + obj.trackId, (err, track) => {
    if (err) {
      return done(err)
    }
    requestCachedURL(endpoint + '/catalog/release/' + obj.releaseId, (err, release) => {
      if (err) {
        return done(err)
      }
      let title = track.title + ' by ' + track.artistsTitle

      if (track.title != release.title) {
        title += ' from ' + release.title
      }
      track.copycredit = createCopycredit(title, release.urls)
      track.copycreditOther = createCopycreditOther(track)
      done(null, {
        track: track,
        release: release,
        signedIn: isSignedIn()
      })
    })
  })
}

function getPlayUrl (arr, releaseId) {
  var hash

  if (arr instanceof Array) {
    var release

    for (var i = 0; i < arr.length; i++) {
      if (arr[i].albumId == releaseId) {
        hash = (arr[i] || {}).streamHash
        break
      }
    }
  } else if (arr.streamHash) {
    hash = arr.streamHash
  }
  return hash ? datapoint + '/blobs/' + hash : undefined
}

function getMyPreferedDownloadOption () {
  var f = "mp3_320"

  if (isSignedIn() && session.settings)
  { return session.settings.preferredDownloadFormat || f }
  return f
}

function getDownloadLink (releaseId, trackId) {
  var opts = {
    method: 'download',
    type: getMyPreferedDownloadOption()
  }

  if (trackId) { opts.track = trackId }
  return endpoint + '/release/' + releaseId + '/download?' + objectToQueryString(opts)
}

function getGetGoldLink () {
  return '/gold/buy'
}

function mapTrackArtists (track) {
  var artists = (track.artists || []).filter((obj) => {
    return !!obj
  }).map((details) => {
    details.uri = details.vanityUri || details.websiteDetailsId || details._id
    details.public = !!details.public
    details.artistPageUrl = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '') + '/artist/' + details.uri
    details.artistPageLink = '/artist/' + details.uri
    details.aboutMD = marked(details.about || "")
    return details
  })

  return artists
}

function getSocials (linkObjs) {
  var arr = []
  var socials = linkObjs.map((link) => {
    var social = {
      link: link.original,
      original: link.original
    }

    var platform = SOCIAL_LINKS_MAP[link.platform]

    if (platform) {
      social = Object.assign(social, platform)

      if (link.platform == 'website') {
        social.cta = link.original
      }
      else if (link.platform == 'twitter') {
        social.label = getTwitterLinkUsername(link.original)
      }
    }

    if (!social.icon) {
      social.icon = 'link'
      social.cta = link.original
      social.label = link.original
      social.name = 'Website'
      social.platform = 'link'
    }

    if (!social.label) {
      social.label = social.name
    }

    return social
  })

  return socials
}

function getSocialsAtlas (urls) {
  var socials = getSocials(urls)
  var atlas = socials.reduce((at, value, index) => {
    at[value.icon] = value
    return at
  }, {})

  return atlas
}

function getReleaseShareLink (urls) {
  var link
  var re = /spotify\.com/

  urls.forEach((url) => {
    if (re.test(url)) {
      link = url
    }
  })
  return link
}

function getReleasePurchaseLinks (urls) {
  var hasAppleMusic = false
  var links = urls.reduce((links, linkObj) => {
    var extra = RELEASE_LINK_MAP[linkObj.platform]

    if (extra) {
      var link = Object.assign(linkObj, extra)

      links.push(link)
      if (linkObj.platform == 'applemusic') {
        hasAppleMusic = true
      }
    }
    else {
      var link = Object.assign(linkObj, {platform: 'unknown'})

      links.push(link)
    }
    return links
  }, []).sort((a, b) => {
    if (a.priority == b.priority) {
      return 0
    }

    return a.priority > b.priority ? -1 : 1
  })

  if (hasAppleMusic) {
    links = links.filter((link) => {
      return link.platform != 'itunes'
    })
  }

  links = links.map((link) => {
    if (!link.icon) {
      link.icon = 'link'
    }
    if (!link.label) {
      link.label = link.original
    }
    return link
  })

  links = links.splice(0, 5)

  return links
}

function submitRemoveYouTubeClaim (e, el) {
  const videoIdInput = document.querySelector('input[name="videoId"]')

  submitForm(e, {
    transformData: function (data) {
      if (data.videoId.indexOf('http') == 0) {
        data.videoId = youTubeIdParser(data.videoId)

        if (data.videoId !== false) {
          videoIdInput.value = data.videoId
        }
      }

      return data
    },
    validate: function (data, errs) {

      if (!data.videoId) {
        errs.push('Please enter a valid YouTube ID or YouTube video URL')
      }

      return errs
    },
    url: endpoint + '/self/remove-claims',
    method: 'POST',
    success: function () {
      toasty(strings.claimReleased)
      videoIdInput.value = ""
    }
  })
}

function youTubeIdParser(url){
  var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  var match = url.match(regExp)
  // ids have 11 characters but that's not something they guarantee

  return (match && match[2].length >= 11) ? match[2] : false
}

/* Map Methods
 * Should conform to the array map method parameters.
 */

function mapTrack (track) {
  if (!track) {
    return {}
  }
  track.releaseId = track.release._id
  track.genre = track.genreSecondary
  track.genreLink = encodeURIComponent(track.genre)
  track.releaseId = track.release._id
  track.canPlaylist = isSignedIn() && !track.inEarlyAccess && track.streamable ? { _id: track._id } : null
  track.bpm = Math.round(track.bpm)
  track.licensable = track.licensable === false ? false : true
  track.showDownloadLink = !track.inEarlyAccess && track.streamable //(track.downloadable && track.streamable) || track.freeDownloadForUsers
  track.time = formatDuration(track.duration)
  track.artistsList = mapTrackArtists(track)
  track.releaseDate = formatDateJSON(track.release.releaseDate)
  track.playUrl = getPlayUrl(track.albums, track.releaseId)
  track.downloadLink = getDownloadLink(track.release._id, track._id)

  return track
}

function mapRelease (release) {
  var pdate = typeof release.preReleaseDate != 'undefined' ? new Date(release.preReleaseDate) : undefined
  var rdate = new Date(release.releaseDate)
  var now = new Date()

  release.releaseDateObj = new Date(rdate)
  if (pdate && ((release.inEarlyAccess && now < pdate) || (!release.inEarlyAccess && now < rdate))) {
    release.preReleaseDateObj = new Date(pdate)
    release.preReleaseDate = formatDate(release.preReleaseDateObj)
    release.releaseDate = null
    release.releaseDateObj = null
  } else {
    release.releaseDate = formatDate(release.releaseDateObj)
    release.preReleaseDate = null
    release.preReleaseDateObj = null
  }
  release.artists = release.renderedArtists
  release.cover = release.coverUrl + '?image_width=512'
  release.coverBig = release.coverUrl + '?image_width=1024'
  if (release.urls instanceof Array) {
    release.originalUrls = release.urls.reduce((urls, link) => {
      if (typeof (link) == 'string') {
        urls.push(link)
      }
      else if (link && link.original) {
        urls.push(link.original)
      }

      return urls
    }, [])
    release.copycredit = createCopycredit(release.title + ' by ' + release.artists, release.urls)
    release.share = getReleaseShareLink(release.urls)
    release.purchaseLinks = getReleasePurchaseLinks(release.urls)
    release.purchase = !!release.purchaseLinks.length
  }
  release.copycreditOther = createCopycreditOther(release)
  release.downloadLink = getDownloadLink(release._id)
  // Since we use catalogId for links, if not present fallback to id
  // If causes problems just create new variable to use for the URI piece
  if (!release.catalogId) { release.catalogId = release._id }
  return release
}

function transformWebsiteDetails (wd) {
  if (wd.profileImageUrl) {
    wd.image = wd.profileImageUrl
    wd.imageSmall = wd.profileImageUrl + "?image_width=256"
    wd.imageTiny = wd.profileImageUrl + "?image_width=128"
  }
  if (isNaN(wd.imagePositionY))
  { wd.imagePositionY = 60 }
  if (wd.bookings || wd.managementDetail) {
    wd.contact = {
      booking: marked(wd.bookings || ""),
      management: marked(wd.managementDetail || "")
    }
  }
  if (wd.urls) {
    wd.socials = getSocials(wd.urls)
    Object.keys(wd.socials).forEach((key) => {
      wd.socials[key].artistName = wd.name
    })
  }
  return wd
}

function processArtistPage (args) {
  pageProcessor(args, {
    transform: function (args) {
      var scope = {}
      scope = transformWebsiteDetails(args.result)
      return scope
    }
  })
}

function processPage (opts) {
  renderContent(opts.node.dataset.template, {})
}

function processMarkdownSimple (args) {
  templateProcessor('markdown-simple', args, {
    transform: function (args) {
      return marked(args.result)
    }
  })
}

function processMarkdownBare (args) {
  templateProcessor('markdown-bare', args, {
    transform: function (args) {
      return marked(args.result)
    }
  })
}

function processHomePage (args) {
  var scope = {
    loading: true
  }

  renderContent('home-page', scope)
}

function processHomeFeatured (args) {
  templateProcessor('home-featured', args, {
    hasLoading: true,
    transform: function (args) {
      var results = args.result.results.map(mapRelease)
      var featured = results.shift()

      scope = {
        featured: featured,
        releases: results.slice(0, 8),
        loading: false,
        hasGoldAccess: hasGoldAccess()
      }
      return scope
    },
    completed: function () {
      startCountdownTicks()
    }
  })
}

/* Transform Methods */

function transformHome (obj) {
  var results = obj.results.map(mapRelease).filter(function (i) {
    return i.type != "Podcast"
  })

  results.sort(sortRelease)
  obj.featured = results.shift()
  obj.releases = results
  obj.releases.length = 8
  obj.hasGoldAccess = hasGoldAccess()
  if (obj.hasGoldAccess) {
    var thankyous = ['Thanks for being Gold, ' + getSessionName() + '.',
      'Stay golden, ' + getSessionName() + '.',
      "Here's an early taste for you, " + getSessionName() + '.',
      'Enjoy the early music, ' + getSessionName() + ' ;)']

    obj.goldThankYou = thankyous[randomChooser(thankyous.length) - 1]
  }
  return obj
}

function processHomeTracks (args) {
  templateProcessor('home-page-tracks', args, {
    transform: function (args) {
      let result = args.result

      result.results = transformTracks(result.results)
      return result
    }
  })
}

function processPodcasts (args) {
  templateProcessor('home-podcast', args, {
    transform: function (args) {
      const obj = Object.assign({}, args.result)

      obj.podcasts = obj.results.map(mapRelease)
      obj.podcasts.length = 8
      obj.podcasts.forEach((i, index, arr) => {
        i.episode = (i.title).replace('Monstercat Podcast ', '').replace(/[()]/g, '')
      })
      return obj
    }
  })
}

function processHomeMerch (opts) {
  if (opts.state == 'start') {
    betterRender('home-merch', opts.node, {
      loading: true
    })
  }
  else if (opts.state == 'finish') {
    if (opts.err) {
      betterRender('home-merch', opts.node, {
        loading: false,
        err: opts.err
      })
      return
    }
    const maxProducts = 8
    let products = opts.result.products.slice(0, maxProducts)

    products = products.map((prod) => {
      prod.utm = '?utm_source=website&utm_medium=home_page'
      return prod
    })

    betterRender('home-merch', opts.node, {
      products: products,
      loading: false
    })
  }
}

function processRosterPage (args) {
  processor(args, {
    start: function (args) {
      var q = searchStringToObject()
      var firstYear = 2011
      var thisYear = (new Date()).getFullYear()
      var arr = []
      var i = thisYear
      var year = q.year || thisYear

      while (i >= firstYear) {
        arr.push({
          year: i,
          selected: i == year
        })
        i--
      }
      var scope = {
        years: arr,
        selectedYear: year
      }

      renderContent(args.template, scope)
      completedRoster()
    }
  })
}

function processRosterYear (obj) {
  templateProcessor('roster-year', obj, {
    start: function () {
      betterRender('loading-view', obj.node)
    },
    success: function (args) {
      var scope = args.result

      scope.results.forEach(function (doc) {
        if (doc.profileImageUrl)
        { doc.uri = doc.vanityUri || doc.websiteDetailsId || doc._id }
        doc.image = doc.profileImageUrl
      })
      scope.results.sort(function (a, b) {
        a = a.name.toLowerCase()
        b = b.name.toLowerCase()
        if (a < b) { return -1 }
        if (a > b) { return 1 }
        return 0
      })
      betterRender(args.template, args.node, scope)
    },
    completed: completedRoster
  })
}

function processReleasesPage (args) {
  pageProcessor(args, {
    start: function (args) {
      const q = searchStringToObject()

      q.fields = ['title', 'renderedArtists', 'releaseDate', 'preReleaseDate', 'coverUrl', 'catalogId'].join(',')
      objSetPageQuery(q, q.page, {perPage: 24})
      var fuzzy = commaStringToObject(q.fuzzy)
      var filters = commaStringToObject(q.filters)
      var type = filters.type || ""
      var types = releaseTypesList

      types.forEach(function (item) {
        item.selected = type == item.value
      })
      renderContent(args.template, {
        search: fuzzy.title || "",
        types:  types,
        query:  objectToQueryString(q)
      })
      completedReleasesPage()
    },
  })
}

function processMusicReleases (args) {
  templateProcessor('music-releases', args, {
    transform: function (args) {
      const data = args.result

      setPagination(data, 24)
      return transformReleases(data)
    }
  })
}

function transformReleases (obj) {
  obj.results = obj.results.sort(sortRelease).map(mapRelease)
  obj.showingFrom = (obj.skip || 0) + 1
  obj.showingTo = obj.skip + obj.results.length
  return obj
}

function isVariousArtistsRelease(obj) {
  var artists = obj.artists || ""

  return artists.toLowerCase().indexOf("various artists") > -1
}

function processUserReleases (args) {
  templateProcessor('user-releases', args, {
    start: function () {
      betterRender(args.template, args.node, {
        loading: true
      })
    },
    success: function (args) {
      var scope = transformUserReleases(args.result)

      scope.loading = false
      betterRender(args.template, args.node, scope)
    },
    error: function (args) {
      betterRender(args.template, args.node, {
        error: args.err
      })
    }
  })
}

function transformUserReleases (obj) {
  obj = transformReleases(obj)
  obj.releases = obj.results.filter(function(i) {
    return !isVariousArtistsRelease(i)
  })
  obj.appearsOn = obj.results.filter(function(i) {
    return isVariousArtistsRelease(i)
  })
  return obj
}

function processMarkdownPage (args) {
  pageProcessor(args, {
    transform: function (args) {
      const md = marked(args.result)

      return md
    },
    completed: function (args) {
      const title = args.node.dataset.title

      if (title) {
        setPageTitle(title)
      }
      else {
        const titleEl = findNode('h1,h2')

        if (titleEl) {
          setPageTitle(titleEl.textContent)
        }
      }
    }
  })
}

function transformMarkdown (obj) {
  return marked(obj)
}

function transformMarkdownPost (obj) {
  let html = marked(obj)

  html = html.split('&lt;').join('<').split('&gt;').join('>')

  return html
}

function scrollToAnimated (el, opts) {
  opts = opts || {}
  var duration = opts.duration || 1000
  var padding = opts.padding || -20

  EPPZScrollTo.scrollTo(el, padding, duration)
}

function scrollToEl (el, opts) {
  opts = opts || {}
  var padding = opts.padding || -20
  var top = el.getBoundingClientRect().top
  //Yes, this timeout is necessary. No, I'm not proud of this.

  setTimeout(function () {
    window.scrollTo(0, parseInt(top + padding))
  }, 2)
}

function anchorScrollTo (e, el) {
  e.preventDefault()
  scrollToEl(document.querySelector(el.getAttribute('href')))
  return false
}

function scrollToHighlightHash () {
  if (location.hash) {
    var attempts = 0
    var attempt = function () {
      var el = document.querySelector(location.hash)

      if (el) {
        setTimeout(function () {
          scrollToAnimated(el)
          el.classList.add('anchor-highlight')
          setTimeout(function () {
            el.classList.add('anchor-highlight-off')
          }, 2000)
        }, 1000)
      }
      else {
        attempts++
        if (attempts < 10) {
          setTimeout(attempt, 100)
        }
      }
    }

    attempt()
  }
}

function completedMarkdown (obj) {
  scrollToHighlightHash()
}

function transformReleaseTracks (obj, done) {
  var input = document.querySelector('input[role=release-id][release-id]')
  var releaseId = input ? input.getAttribute('release-id') : ''

  var trackIndex = 0

  obj.results.forEach((track, index, arr) => {
    mapTrack(track)
    track.index = trackIndex
    track.trackNumber = trackIndex + 1
    if (track.playUrl) {
      trackIndex++
    }
  })
  obj.activeTest = 'newReleasePageTest'
  obj.hasGoldAccess = hasGoldAccess()

  done(null, obj)
}

function transformTracks (results, done) {
  var tracks = results.map((track, index, arr) => {
    mapTrack(track)
    track.index = index
    return track
  })

  if (typeof done == 'function') {
    done(null, tracks)
  }
  return tracks
}

function appendSongMetaData (tracks) {
  if (tracks) {
    var songs = []

    for (var i = 0; i < tracks.length; i++) {
      var trackId = tracks[i].trackId ? tracks[i].trackId : tracks[i]._id

      songs.push('https://' + window.location.host + '/track/' + trackId)
    }
    appendMetaData({
      'music:song': songs
    })
  }
}

/* Completed Methods */

function completedHome (source, obj) {
  startCountdownTicks()
}

function featuredReleaseCountdownEnd () {
  loadSubSources(document.querySelector('[role="home-featured"]'), true)
}

function releasePageCountdownEnd () {
  reloadPage()
}

function completedRelease (source, obj) {
  if (obj.error) { return }
  var r = obj.data
  var artists = []
  var description = r.title + ' is ' + (r.type == 'EP' ? 'an' : 'a') + ' ' + r.type + ' by ' + r.artists

  var releaseDate = new Date(r.releaseDate)
  var months = getMonths()

  if (r.releaseDate) {
    description += ' released on ' + months[releaseDate.getMonth()] + ' ' + releaseDate.getDay() + ' ' + releaseDate.getYear()
  }
  description += '.'
  var meta = {
    "og:title": r.title + ' by ' + r.artists,
    "og:image": r.cover,
    "og:description": description,
    "og:url": location.toString(),
    "og:type": "music.album",
    "music:release_date": releaseDate.toISOString()
  }

  setMetaData(meta)
  setPageTitle(r.title + ' by ' + r.artists)
  startCountdownTicks()
}

function completedReleaseTracks (source, obj) {
  if (!obj) {
    return
  }
  appendSongMetaData(obj.data.results)
  var artistLinks = obj.data.results.reduce((links, track) => {
    track.artists.forEach((ad) => {
      if (links.indexOf(ad.artistPageUrl) == -1) {
        links.push(ad.artistPageUrl)
      }
    })
    return links
  }, [])

  appendMetaData({
    'music:musician': artistLinks
  })
  pageIsReady()
  var embeds = document.querySelectorAll('[collection-id][role=shopify-embed]')

  embeds.forEach((node) => {
    ShopifyBuyInit(node.getAttribute('collection-id'), node)
  })
  updateControls()
  //For releases with a single song, we change the download link of the album
  //so it's just that song. That way people don't download a ZIP file of one song
  if (obj.data.results.length == 1) {
    var button = document.querySelector('a[role=download-release]')

    if (button) {
      button.setAttribute('href', obj.data.results[0].downloadLink)
    }
  }
}

function completedReleasesPage (source, obj) {
  var parts = []
  var qs = searchStringToObject()
  var filter = qs.filters

  if (qs.filters) {
    //TODO: better pluralization
    //TODO: better support for filtering by more than just type
    parts.push(qs.filters.substr('type,'.length) + 's')
  }
  else {
    parts.push('Music')
  }
  if (qs.fuzzy) {
    //TODO: make this better for if/when fuzzy thing changes
    parts.push('Search: ' + qs.fuzzy.substr('title,'.length))
  }
  if (qs.page) {
    qs.page = parseInt(qs.page)
    if (qs.page > 1) {
      parts.push('Page ' + qs.page)
    }
  }
  setPageTitle(parts.join(pageTitleGlue))
  pageIsReady()
}

function completedArtist (source, obj) {
  if (obj.error) { return }
  setPageTitle(obj.data.name)
  var meta = {
    'og:title': obj.data.name,
    'og:description': 'Bio and discography for ' + obj.data.name,
    'og:type': 'profile',
    'og:url': location.toString(),
    'og:image': obj.data.image
  }

  setMetaData(meta)
  pageIsReady()
  if (obj.data.shopifyCollectionId) {
    ShopifyBuyInit(obj.data.shopifyCollectionId)
  }
}

function completedMusic (source, obj) {
  if (obj.error) { return }
  var parts = []
  var qs = searchStringToObject()
  var filter = qs.filters

  if (qs.filters) {
    //TODO: better pluralization
    //TODO: better support for filtering by more than just type
    parts.push(qs.filters.substr('type,'.length) + 's')
  }
  else {
    parts.push('Music')
  }
  if (qs.fuzzy) {
    //TODO: make this better for if/when fuzzy thing changes
    parts.push('Search: ' + qs.fuzzy.substr('title,'.length))
  }
  if (qs.skip) {
    var page = Math.round(parseInt(qs.skip) / parseInt(qs.limit)) + 1

    if (page > 1) {
      parts.push('Page ' + page)
    }
  }
  setPageTitle(parts.join(pageTitleGlue))
  pageIsReady()
}

function completedRoster (){
  var rosterSelect = document.querySelector('[role=roster-select]')

  rosterSelect.addEventListener('change', function(){
    var year = this.options[this.selectedIndex].value

    if (year !== "0") { window.location.href = '/artists/?year=' + year }
    else { window.location.href = '/artists/' }
  })
}

/* UI Stuff */

function accessDownloadOrModal (e, el) {
  if (el.dataset.freeDownloadForUsers == 'true') {
    if (isSignedIn()) {
      return true
    }

    e.preventDefault()
    var opts = {
      releaseTitle: el.dataset.releaseTitle,
      redirect: encodeURIComponent(window.location),
      trackTitle: el.dataset.trackTitle,
    }

    openModal('freedownload-for-users-modal', opts)

  }
  else {
    return canDownloadOrModal(e, el)
  }
}

function canDownload () {
  return hasGoldAccess() || (session.user && session.user.type && session.user.type.indexOf('artist') > -1)
}

function canDownloadOrModal (e, el) {
  if (canDownload()) { return true }
  e.preventDefault()
  openModal('subscription-required-modal', {
    signedIn: isSignedIn()
  })
}

function openReleaseArt (e, el) {
  openModal('release-art-modal', {
    src: el.getAttribute('big-src')
  })
}

function transformCurrentUrl (data) {
  data = data || {}
  data.currentUrl = encodeURIComponent(window.location.pathname + window.location.search)
  return data
}

/**
 * General purpose processor for other processors to call so that they don't have
 * to rewrite stuff.
 *
 * @param {Object} args Arguments that the calling function got
 * @param {Object} methods Map of functions to call based on the
                   state of the request.
 * @example
 * function myPageProcessor () {
 *  processor(arguments, {
 *   start: function () { findNode('.loading').style.display = 'block') },
 *   success: function () { alert('XHR finished without erro'); },
 *   start: function () { console.log('loading...'); },
 *   error: function (args) { console.error('Error occured', args.error) }
 *  })
 * }
 */
function processor (args, options) {
  const opts = options || {}

  if (opts[args.state] === false) {
    return
  }

  if (opts[args.state]) {
    opts[args.state](args)
    return
  }

  if (args.state == 'start') {
    //Processors with a transform and no source and just providing their
    //own data
    if (!args.node.dataset.source && options.transform) {
      args.state = 'finish'
      processor(args, options)
      return
    }

    if (opts.hasLoading) {
      betterRender(args.template, args.node, {loading: true})
      return
    }

    betterRender('loading-view', args.node)
    return
  }

  //The ajax is done, and either succeeded or failed
  if (args.state == 'finish') {
    const renderNode = opts.renderNode || args.node
    if (args.error) {
      if (opts.error) {
        opts.error(args)
        return
      }
      else if (opts.hasError) {
        betterRender(args.template, renderNode, {error: args.error})
        return
      }

      betterRender('error', renderNode, {message: args.error.message || args.error.toString()})
      return
    }
    if (opts.success) {
      opts.success(args)
      return
    }

    var scope = {err: args.error, data: args.result, loading: false}

    if (opts.transform) {
      scope.data = opts.transform(args)
    }


    betterRender(args.template, renderNode, scope)

    if (opts.completed) {
      opts.completed(args)
    }
    return
  }
}

function templateProcessor (template, args, options) {
  args.template = template
  processor(args, options)
}

function templatePageProcessor (template, args, options) {
  options.renderNode = findNode('[role=content]')
  args.template = template
  return processor(args, options)
}

/**
 * Wrapper for the processor function that always makes the
 * [role=content] node the node that gets rendered into
 *
 * @param {Object} args Arguments from declare's process steps
 * @param {Object} meths Method overrides
 */
function pageProcessor (args, aOptions) {
  const options = aOptions || {}

  options.renderNode = findNode('[role=content]')

  return processor(args, options)
}

function renderHeaderMobile () {
  var data = transformCurrentUrl()

  if (session) {
    data.user = session ? session.user : null
  }
  betterRender('navigation', '#navigation-mobile', {
    data: data
  })

}

function setPageTitle (title, glue, suffix) {
  if (!glue) { glue = pageTitleGlue }
  if (!suffix) { suffix = pageTitleSuffix }
  document.title = (!!title ? (title + glue) : '') + suffix
}

function pageToQuery (page, opts) {
  opts = opts || {}
  opts.perPage = opts.perPage || 25
  page = page || 1

  return {skip: (page - 1) * opts.perPage, limit: opts.perPage}
}

function objSetPageQuery (obj, page, opts) {
  var sl = pageToQuery(page, opts)

  obj.skip = sl.skip
  obj.limit = sl.limit
}

function setPagination (obj, perPage) {
  var q = searchStringToObject()

  q.page = parseInt(q.page) || 1
  var nq = Object.assign({}, q)
  var pq  = Object.assign({}, q)

  nq.page = nq.page + 1
  pq.page = pq.page - 1
  if (q.page * perPage < obj.total) {
    obj.next = objectToQueryString(nq)
  }
  if (q.page > 1) {
    obj.previous = objectToQueryString(pq)
  }
  obj.showingFrom = (q.page - 1) * perPage + 1
  if (obj.next) {
    obj.showingTo = obj.showingFrom + perPage - 1
  }
  else {
    obj.showingTo = obj.total
  }
}

function requestWithFormData (opts, done) {
  var fd = new FormData()

  opts.data = opts.data || {}
  for (var key in opts.data) {
    fd.append(key, opts.data[key])
  }
  opts.data = fd
  request(opts, done)
}

/**
 * XHR request for JSON requests
 *
 * @param {Object|String} opts Optinos or the URL. If URL
 * instead of object it defaults to GET withCredentials
 * @params {requestCallback} done
 */
function requestJSON (opts, done) {
  if (typeof opts == 'string') {
    opts = {
      method: 'GET',
      withCredentials: true,
      url: opts,
      headers: {}
    }
  }

  opts.headers = opts.headers || {}
  opts.headers.Accept = 'application/json'

  if (opts.data) {
    opts.headers['Content-Type'] = 'application/json'
    opts.data = JSON.stringify(opts.data)
  }

  request(opts, done)
}

function requestCachedURL (url, done) {
  requestCached({
    url: url,
    method: 'GET',
    withCredentials: true
  }, done)
}

/**
 * Request wrapper that uses local caching to not
 * make multiple requests to the same URL
 *
 * @param {String} source The URL to get from
 * @param {requestCallback} done
 * @param {Boolean} reset
 */
function loadCache (source, done, reset) {
  throw new Error('Replace this with requestCached')
  let _ = loadCache._

  if (!_) {
    _ = {}
    loadCache._ = _
  }
  const cached = cache(source)

  if (!reset && cached) {
    done(null, cached)
    return
  }
  let callbacks = _[source]
  let doit = false

  if (!callbacks) {
    callbacks = []
    _[source] = callbacks
    doit = true
  }
  callbacks.push(done)
  if (doit == false) {
    return
  }
  requestJSON({
    url: source,
    withCredentials: true
  }, (err, obj, xhr) => {
    if (obj) {
      cache(source, Object.assign({}, obj))
    }

    callbacks.forEach((fn) => {
      fn(err, obj)
    })
    delete _[source]
  })
}

function getStats () {
  requestJSON({
    url: 'https://www.monstercat.com/stats.json',
  }, function (err, obj) {
    if (err || !obj) { return } // Silently don't worry.
    getStats.fulfill(obj)
  })
}

getStats.fulfill = function (map) {
  Object.keys(map).forEach(function (key) {
    var stat = map[key]
    var el = document.querySelector('[stats-name="' + key + '"]')

    if (!el) { return }
    var h3 = el.querySelector('h3')
    var p = el.querySelector('p')

    if (!h3 || !p) { return }
    h3.textContent = getStats.translate(stat.value)
    p.textContent = stat.name
  })
}

getStats.translate = function (value) {
  if (isNaN(value)) { return value }
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'm'
  } else if (value >= 100000) {
    return (value / 1000).toFixed(0) + 'k'
  }
  return value
}
