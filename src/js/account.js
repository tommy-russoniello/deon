var thankyous = [
  "Very cool!",
  "Thank you!",
  "Thanks for the support :)",
  "We appreciate it :)",
  "That's awesome!",
  "Noice."
]

var emotes = [
  "fa-hand-spock-o",
  "fa-smile-o",
  "fa-heart-o",
  "fa-hand-peace-o",
  "fa-paw",
  "fa-thumbs-o-up"
]

function transformSubmittedAccountData (data) {
  var str = data.birthday_year + '-' + data.birthday_month + '-' + data.birthday_day
  if (!data.birthday_year || data.birthday_year <= 1900) {
    data.birthday = null
  }
  else {
    data.birthday = new Date(str)
  }
  delete data.birthday_day
  delete data.birthday_month
  delete data.birthday_year
  return data;
}

function validateAccountData (data, exclude) {
  exclude = exclude || {}
  var errors = []
  if (!exclude.birthday) {
    if (!data.birthday || data.birthday.toString() == 'Invalid Date' || data.birthday.getFullYear() < 1900 || data.birthday.getFullYear() > new Date().getFullYear()) {
      errors.push('Invalid birthday entered');
    }
  }
  if (!exclude.location) {
    if (!data.googleMapsPlaceId) {
      errors.push('Location is required');
    }
  }
  return errors;
}

/*===============================
=            ACTIONS            =
===============================*/
function submitSaveAccount (e, el) {
  const wasLegacy = isLegacyLocation()

  submitForm(e, {
    url: endpoint2 + '/self',
    method: 'PUT',
    transformData: transformSubmittedAccountData,
    validate: validateAccountData,
    success: function (result, data) {
      toasty(strings.accountUpdated)
      findNode('[name="password"]').value = ""
      loadSession(function (err, obj) {
        if (wasLegacy && !isLegacyLocation()) {
          reloadPage()
        }
        //siteNotices.completeProfileNotice.start()
      })
    }
  })
}

function submitSaveAccountSettings (e, el) {
  submitForm(e, {
    url: endpoint2 + '/self',
    method: 'PUT',
    transformData: (data) => {
      return {settings: data}
    },
    success: function (result, data) {
      toasty(strings.settingsUpdated)
      session.settings = data.settings
    }
  })
}

function toggleStreamerMode(e, el) {
  var form = findParentWith(e.target, "form")
  var hideTracks = findNode('[name="hideNonLicensableTracks"]', form)
  var blockTracks = findNode('[name="blockNonLicensableTracks"]', form)
  var publicPlaylist = findNode('[name="playlistPublicByDefault"]', form)
  var format = findNode('[name="preferredDownloadFormat"]', form)

  hideTracks.checked = el.checked
  blockTracks.checked = el.checked
  request({
    url: `${endpoint2}/self`,
    method: 'PUT',
    data: {settings: {
      playlistPublicByDefault: publicPlaylist.checked,
      hideNonLicensableTracks: hideTracks.checked,
      blockNonLicensableTracks: blockTracks.checked,
      preferredDownloadFormat: format.value,
    }},
    cors: true,
  }, (err, body, xhr) => {
    if (err) {
      toasty(err)
      return
    }
    session.settings = body.settings
    if (el.checked) {
      toasty("Streamer mode activated. Happy content creating!")
    } else {
      toasty(Error("Streamer mode deactivated. Non-licensable tracks used will receive claims."))
    }
  })
}

function submitSaveRedditUsername (e, el) {
  const data = formToObject(e.target)
  const unsetUsername = !data.redditUsername

  submitForm(e, {
    method: 'PUT',
    url: endpoint2 + '/self/update-reddit',
    error: (err) => {
      alert(err.message)
    },
    success: (args) => {
      if (unsetUsername) {
        toasty('Flair cleared')
      }
      else {
        toasty('Flair set')
      }
    }
  })
}

function submitJoinDiscord (e, el) {
  const responseEl = findNode('[role=join-discord] [role=response]')
  submitForm(e, {
    method: "POST",
    url: endpoint2 + "/self/discord/join",
    started: function () {
      betterRender('discord-response', responseEl, {loading: true})
    },
    validate: function (data, errs) {
      if (!data.discordId) {
        errs.push('Please provide a Discord User ID')
      }
      return errs
    },
    successMsg: 'Gold channel joined!'
  })
}

function submitVerifyInvite (e, el) {
  submitForm(e, {
    method: 'POST',
    url: endhost + '/invite/complete',
    success: function () {
      toasty('Account verified, please sign in')
      go('/signin')
    }
  })
}

function transformTwoFactorFormData (data) {
  data.number = String(data.number)
  return data
}

function enableTwoFactor (e, el) {
  submitForm(e, {
    method: 'POST',
    url: endpoint2 + '/self/two-factor',
    transformData: transformTwoFactorFormData,
    validate: function (data, errs) {
      if (!data.countryCode) {
        errs.push('Country is required')
      }
      if (!data.number) {
        errs.push('Number is required')
      }
      return errs
    },
    success: function () {
      window.location.hash = '#two-factor'
      reloadPage()
      toasty(strings.twoFactorPending)
    }
  })
}

function confirmTwoFactor (e, el) {
  submitForm(e, {
    transformData: transformTwoFactorFormData,
    url: endpoint2 + '/self/two-factor/confirm',
    method: 'POST',
    success: function () {
      reloadPage()
      window.location.hash = '#two-factor'
      toasty(strings.twoFactorConfirmed)
    }
  })
}

function disableTwoFactor (e, el) {
  requestJSON({
    url: endpoint2 + '/self/two-factor/disable',
    method: 'POST',
    withCredentials: true
  }, (err, obj, xhr) => {
    if (terror(err)) {
      return
    }
    reloadPage()
    toasty(strings.twoFactorDisabled)
  })
}

/*==================================
=            PROCESSORS            =
==================================*/

function processAccountPage (args) {
  if (!checkStreamlabsComplete('/account')) {
    return
  }

  if (!isSignedIn()) {
    go('/signin')
    return
  }

  pageProcessor(args, {
    success: function (args) {
      const scope = {}
      const result = args.result
      const account = result

      scope.countries = getAccountCountries(account.location)
      if (account.twoFactorState == 'disabled') {
        scope.enableTwoFactor = {
          countries: CountryCallingCodes
        }
        scope.twoFactor = false
      }
      else if (account.twoFactorState == 'pending') {
        scope.confirmingTwoFactor = true
        scope.twoFactor = false
      }
      else if (account.twoFactorState == 'enabled') {
        scope.twoFactor = true
      }
      if (account.birthday) {
        const date = new Date(account.birthday)

        scope.birthday_year = date.getUTCFullYear()
        scope.birthday_day = ('0' + (date.getUTCDate()).toString()).substr(-2)
        scope.birthday_month = ('0' + (date.getUTCMonth() + 1).toString()).substr(-2)
      }
      scope.hasGoldAccess = hasGoldAccess()
      scope.endhost = endhost
      scope.locationLegacy = isLegacyLocation()
      scope.emailOptIns = transformEmailOptins(account.emailOptIns)
      scope.account = account

      renderContent(args.template, {data: scope})
      scrollToHighlightHash()
      hookValueSelects()
      initLocationAutoComplete()
    }
  })
}

function processAccountEmailPage (args) {
  templatePageProcessor('account-email-page', args, {
    hasLoading: true,
    transform: function (args) {
      const scope = {}
      const account = args.result

      account.realName = account.realName || ""
      const names = account.realName.split()

      const mailChimpOptions = {
        MERGE0: account.email,
      }

      scope.mailchimpSrcStr = objectToQueryString(mailChimpOptions)
        + '&group[5449][2]=1&group[5449][1]=1'

      return scope
    }
  })
}

function processSocialSettings (args) {
  templateProcessor('social-settings', args, {
    transform: function (args) {
      const scope = {
        facebookEnabled: !!args.result.facebookId,
        googleEnabled: !!args.result.googleId
      }

      return scope
    }
  })
}

function processAccountGoldPage (args) {
  if (!checkStreamlabsComplete('/account/gold')) {
    return
  }

  renderContent(args.template, {loading: true})
  var thankyous = [
    "Very cool!",
    "Thank you!",
    "Thanks for the support",
    "We appreciate it",
    "That's awesome!",
    "Noice."
  ]

  let scope = {
    hasGoldAccess: hasGoldAccess(),
    hasFreeGold: hasFreeGold(),
    displayName: getSessionName(),
    thankYou: thankyous[randomChooser(thankyous.length)-1],
    emoji: emotes[randomChooser(emotes.length)-1],
    isSignedIn: isSignedIn()
  }

  if (!scope.hasGoldAccess){
    return go('/gold/buy')
  }

  if (!scope.isSignedIn) {
    renderContent(args.template, {loading: false, data: scope})
    return
  }
  requestJSON({
    url: endpoint2 + '/self',
    withCredentials: true
  }, (err, selfResult) => {
    if (err) {
      renderContent(args.template, {err: err})
      return
    }

    scope.self = selfResult
    if (!scope.hasGoldAccess) {
      renderContent(args.template, {
        loading: false,
        data: scope
      })
      return
    }

    requestSelfShopCodes((err, result) => {
      if (err) {
        renderContent(args.template, {err: err})
        return
      }

      if (result.gold.usedMonths <= 1){
        scope.belowOne = true
      }
      scope = Object.assign(scope, result)
      renderContent(args.template, {
        loading: false,
        data: scope
      })
      scrollToHighlightHash()
      startCountdownTicks()

      if (searchStringToObject().status) {
        toasty('Payment received. ' + thankyous[randomChooser(thankyous.length) - 1])
      }

      pageIsReady({
        title: 'Monstercat Gold Features'
      })
    })
  })
}

function processLicensesTable(args) {
  processor(args, {
    completed: (args) => {
      const licenses = args.result.results.map(transformLicense)
      const scope = {
        licenses: licenses,
      }

      betterRender('licenses-tbody', args.node, scope)
    }
  })
}

function processAccountSettings (args) {
  const downloadFormatOptions = [
    {
      name: "MP3 320kbps",
      value: "mp3_320"
    }, {
      name: "MP3 128kbps",
      value: "mp3_128"
    }, {
      name: "MP3 V0",
      value: "mp3_v0"
    }, {
      name: "MP3 V2",
      value: "mp3_v2"
    }, {
      name: "WAV",
      value: "wav"
    }, {
      name: "FLAC",
      value: "flac"
    },
  ]

  templateProcessor('account-settings', args, {
    transform: function (args) {
      const scope = {}
      const result = args.result

      scope.downloadOptions = downloadFormatOptions.map((opt) => {
        opt = Object.assign({}, opt)
        opt.selected = opt.value == result.preferredDownloadFormat
        return opt
      })

      scope.settings = result.settings
      const { settings } = scope

      scope.isStreamerMode = settings.blockNonLicensableTracks &&
        settings.hideNonLicensableTracks

      if (session.settings.blockNonLicensableTracks){
        scope.settings.blockNonLicensableTracks = true
        scope.settings.hideNonLicensableTracks = true
      }

      return scope
    }
  })
}

function processVerifyPage (args) {
  processor(args, {
    success: function (args) {
      const obj = {}

      obj.code = window.location.pathname.split('/')[2]
      obj.isSignedIn = isSignedIn()
      renderContent(args.template, {data: obj})
      initLocationAutoComplete()
    }
  })
}

/*====================================
=            TRANSFORMERS            =
====================================*/

function transformEmailOptins (optinsArray) {
  if (!optinsArray) return {}
  return optinsArray.reduce(function (atlas, value) {
    atlas[value.type] = value.in
    return atlas
  }, {})
}

