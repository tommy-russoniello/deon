var licensingABTest

function processLicensingPage (args) {
  const scope = {}

  scope.signedIn = isSignedIn()
  scope.hasGold = hasGoldAccess()
  renderContent(args.template, scope)
  pageIsReady({
    title: 'Music Licensing - Commercial & Content Creators',
    descrption: 'Monstercat offers licensing for both commercial use and for content creators.'
  })
}

function getOtherLicensingPlatforms () {
  return ['Facebook', 'Instagram', 'Vimeo']
}

function processLicensingTwitchTrial () {
  const scope = {
    signedIn: isSignedIn(),
    hasGold: hasGoldAccess(),
    redirect: encodeURIComponent('/twitchpromo')
  }
  if (isSignedIn()) {
    scope.hasSubmitted = getCookie('twitch-promo-submitted')
  }
  else {
    scope.hasSubmitted = false
  }

  renderContent('licensing-twitch-trial', scope)

  const twitchEl = findNode('input[name=twitchUsername]')

  if (twitchEl) {
    twitchEl.addEventListener('blur', function () {
      var val = serviceUrlToChannelId(this.value)
      this.value = val
    })
  }
}

function submitTwitchPromo (e) {
  submitForm(e, {
    validate: function (data, errs) {
      if (!data.twitchUsername) {
        errs.push('Twitch username is required')
      }
      return errs
    },
    transformData: function (data) {
      data.twitchUsername = serviceUrlToChannelId(data.twitchUsername)
      data.userId = session.user._id
      data.type = 'twitchpromo'
      return data
    },
    action: function (args) {
      actionier.on(e.target)
      requestWithFormData({
        url: 'https://submit.monstercat.com',
        method: 'POST',
        data: args.data
      }, (err, body, xhr) => {
        actionier.off(e.target)
        if (err) {
          formErrors(e.target, err)
          return
        }
        toasty('Your Twitch channel has been submitted! Thank you.')
        setCookie('twitch-promo-submitted', args.data.twitchUsername, 5)
        go('/twitchpromo')
      })
    }
  })
}

function processLicensingOtherPlatformsPage (args) {
  const obj = {}

  obj.platforms = getOtherLicensingPlatforms()
  obj.email = isSignedIn() ? session.user.email : ''
  renderContent(args.template, obj)
  pageIsReady({
    title: 'Licensing Music for Facebook, Instagram, and more'
  })
}

function processFeedback (args) {
  const obj = {
    platforms: getOtherLicensingPlatforms()
  }
  obj.email = isSignedIn() ? session.user.email : ''
  renderContent(args.template, obj)
}

function processLicensingContentCreators (args) {
  const scope = {}
  scope.hasGoldAccess =hasGoldAccess(),
  renderContent(args.template, scope)
  completedContentCreatorLicensing()
  primePageIsReady({
    description: 'Music licensing for content creators on YouTube, Twitch, and Mixer.'
  }, ['whitelist_faq'])
}

function processWhitelistFaq (args) {
  processor(args, {
    completed: function(args, result){
      var html = args.result
      var whitelist = findNode("#whitelistfaq")
      whitelist.innerHTML = html
      var acc = document.getElementsByClassName("accordion")
      var i

      for (i = 0; i < acc.length; i++) {
        acc[i].addEventListener("click", function() {
          this.classList.toggle("accordion-active")
          var panel = this.nextElementSibling

          if (panel.style.maxHeight){
            panel.style.maxHeight = null
          } else {
            panel.style.maxHeight = panel.scrollHeight + "px"
          }
        })
      }

      pageStageIsReady('whitelist_faq')
    }
  })
}

function pickBackground(){
  var quantity = 5
  var randomNumber = randomChooser(quantity)
  var word = ""
  var license = document.querySelector('#licensing')
  var words = ['first', 'second', 'third', 'fourth', 'fifth']

  license.classList.add(words[randomNumber - 1])
}

function completedContentCreatorLicensing () {
  pickBackground()
  scrollToHighlightHash()
  var buyButtons = document.querySelectorAll('[role=licensing-cta]')

  buyButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      licensingABTest.convert()
      return true
    })
  })
}

function transformCommercialLicensing () {
  return go('/sync')
}

function showCrediting (e, el) {
  var type = el.getAttribute('credit-type')
  var credits = document.querySelectorAll('textarea.copycredits[credit-type]')

  for (var i = 0; i < credits.length; i++) {
    var c = credits[i]
    var t = credits[i].getAttribute('credit-type')

    credits[i].classList.toggle('hide', t != type)
  }
}

function copyCrediting (e, el){
  el.focus()
  el.select()
  document.execCommand('copy')
  toasty('Crediting copied to clipboard.')
}

function openTrackLicensing (e) {
  const el = findParentOrSelf(e.target, '[data-track-id]')
  const trackId = el.dataset.trackId
  const releaseId = el.dataset.releaseId

  openModal('track-licensing-modal', {
    trackId: trackId,
    releaseId: releaseId,
    signedIn: isSignedIn(),
    loading: true
  })

  loadReleaseAndTrack({
    trackId: trackId,
    releaseId: releaseId
  }, (err, data) => {
    data.loading = false
    data.signedIn = isSignedIn()

    openModal('track-licensing-modal', data)
  })
}

function submitLicensingOtherPlatforms (e) {
  submitForm(e, {
    action: function (args) {
      actionier.on(e.target)
      requestWithFormData({
        url: 'https://submit.monstercat.com',
        method: 'POST',
        data: args.data
      }, (err, obj, xhr) => {
        actionier.off(e.target)
        if (terror(err)) {
          return
        }

        toasty("Thanks, we'll let you know when those are available!")
      })

    },
    transformData: function (data) {
      data.date = new Date().toISOString()
      data.type = 'licensing_other_platforms'

      if (isSignedIn()) {
        data.userId = session.user._id
      }

      return data
    },
    validate: function (data, errs) {
      if (!data.email || data.email.indexOf('@') <= 0) {
        errs.push('Please enter a valid email')
      }

      var other = data.other

      if (!other) {
        var found = false
        var others = getOtherLicensingPlatforms()

        for (var i = 0; i < others.length; i++) {
          if (data[others[i]]) {
            found = true
            break
          }
        }

        if (!found) {
          errs.push('Please select at least one platform')
        }
      }

      return errs
    }
  })
}