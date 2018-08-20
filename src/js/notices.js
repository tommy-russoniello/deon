var siteNotices = {}

function SiteNotice (args) {
  this.template = ''
  this.hideForDays = 7
  this.hideOnClick = false
  for (var k in args) {
    this[k] = args[k]
  }
  if (!this.transform) {
    this.transform = function transform (done) {
      done(null, {})
    }
  }
  else if (typeof this.transform == 'object') {
    var data = Object.assign({}, this.transform)

    this.transform = function transform (done) {
      done(null, data)
    }
  }

  if (!this.completed) {
    this.completed = function completed () {
    }
  }

  if (!this.shouldOpen) {
    this.shouldOpen = function shouldOpen () {
      return true
    }
  }
}

SiteNotice.prototype.start = function start () {
  var scope = {}

  if (!this.shouldOpen() || !this.isCookieExpired()) {
    this.close()
    return
  }
  this.transform((err, result) => {
    scope = result
    this.render(scope)
  })
}

SiteNotice.prototype.getCookieName = function getCookieName () {
  return 'hide_notice_' + this.name
}

SiteNotice.prototype.isCookieExpired = function isCookieExpired () {
  var iso = getCookie(this.getCookieName())

  if (!iso || !iso.length) {
    return true
  }

  var expired = new Date(iso).getTime() < new Date().getTime()
  return expired
}

SiteNotice.prototype.getNoticeEl = function getNoticeEl () {
  var el = findNode('#site-notices [notice=' + this.name + ']')

  if (!el) {
    var div = document.createElement('div')

    div.setAttribute('notice', this.name)
    div.setAttribute('class', 'notice-container')
    findNode('#site-notices').appendChild(div)
    return div
  }

  return el
}

SiteNotice.prototype.render = function render (scope) {
  var noticeEl = this.getNoticeEl()

  betterRender(this.template, noticeEl, scope)
  noticeEl.classList.toggle('hide', false)
  var height = noticeEl.getBoundingClientRect().height

  document.body.classList.toggle('showing-notice', true)
  noticeEl.classList.toggle(this.name, true)
  if (this.completed) {
    this.completed()
  }
}

SiteNotice.prototype.close = function () {
  document.body.classList.toggle('showing-notice', true)
  var noticeEl = this.getNoticeEl()

  noticeEl.classList.toggle('hide', true)
  noticeEl.classList.toggle(this.name, false)
}

SiteNotice.prototype.setHideUntilByDays = function (days) {
  var daysMS = 24 * 60 * 60 * 1000
  var hideUntil = new Date(new Date().getTime() + (days * daysMS))
  setCookie(this.getCookieName(), hideUntil.toISOString())
}

//When a user closes it instead of our code
//This also sets a cookie to hide the notice for a time
SiteNotice.prototype.closeByUser = function () {
  this.setHideUntilByDays(this.hideForDays)
  this.close()
}

SiteNotice.prototype.expireCookie = function () {
  setCookie(this.getCookieName(), new Date().toISOString())
}

function clickCloseLinkNotice (e, name) {
  siteNotices[name].closeByUser()
}

function clickLinkNoticeLink (e, name) {
  if (siteNotices[name].hideOnClick) {
    siteNotices[name].closeByUser()
  }
}

/*========================================
=            COMPLETE PROFILE            =
========================================*/

siteNotices.completeProfileNotice = new SiteNotice({
  hideForDays: 0,
  name: 'complete-profile',
  template: 'notice-complete-profile',
  transform: function (done) {
    var obj = {};

    done(null, obj)
  },
  shouldOpen: function () {
    return isSignedIn() && !hasCompletedProfile()
  },
  completed: function () {}
})

function closeCompleteProfileNotice (e) {
  siteNotices.completeProfileNotice.closeByUser()
}

function submitCompleteProfile (e) {
  e.preventDefault()
  var form = e.target
  var button = form.querySelector('button.button--cta')

  function resetButton () {
    button.innerHTML = 'Save'
    button.disabled = false
    form.disabled = false
  }

  var data = getDataSet(findNode("[role=complete-profile-form]"), true, true)

  data = transformSubmittedAccountData(data)
  var exclude = {
    birthday: !!session.user.birthday,
    location: !!session.user.geoLocation
  }
  var errors = validateAccountData(data, exclude)

  if (errors.length) {
    errors.forEach((er) => {
      toasty(new Error(er))
    })
    return
  }

  if (session.user.birthday) {
    //
    delete data.birthday
  }

  button.disabled = true
  button.innerHTML = 'Submitting...'
  form.disabled = true

  update('self', null, data, (err, obj) => {
    resetButton()
    if (err) return toasty(new Error(err.message))
    toasty('Profile complete, thank you!')
    completeProfileNotice.close()
    closeModal()
    renderHeader()
    renderHeaderMobile()
  })
}

function clickCompleteProfile (e) {
  var obj = {}
  var numEmailOptins = 3 //How many optin lists we maintain

  obj.sections = {
    birthday: !session.user.birthday,
    emails: !session.user.emailOptIns || session.user.emailOptIns.length < numEmailOptins,
    location: !session.user.geoLocation
  }
  openModal('complete-profile-modal', obj)
  initLocationAutoComplete()
}

/*========================================
=            INSTINCT NOTICE            =
========================================*/
siteNotices.instinctNotice = new SiteNotice({
  hideForDays: 7,
  name: 'instinct-video',
  template: 'notice-link',
  transform: {
    label: 'Click to become a Founding Subscriber of Monstercat: Instinct',
    url: 'https://www.youtube.com/watch?v=AQESv7O73eY',
    name: 'instinctNotice',
    hideOnClick: true
  }
})


/*==========================================
=            GOLD WEEK             =
==========================================*/
siteNotices.goldWeek = new SiteNotice({
  hideForDays: 7,
  name: 'gold-week',
  template: 'notice-link',
  transform: {
    label: 'A week of giveaways for Monstercat Gold Subscribers! Click here to enter',
    url: 'https://www.monstercat.com/blog/2018-08-20/gold-week-2018',
    name: 'goldWeek',
  },
  hideOnClick: true
})
/*==========================================
=            GOLD DISCOUNT CODE            =
==========================================*/
var goldShopNextCodeDate = ''

siteNotices.goldShopCodeNotice = new SiteNotice({
  hideForDays: 40,
  name: 'gold-discount',
  template: 'notice-gold-shop-code',
  transform: function (done) {
    requestSelfShopCodes((err, result) => {
      if (err) {
        return done(err)
      }
      var lastCode = getCookie('last-gold-shop-code')

      this.currentCode = result.currentCode

      goldShopNextCodeDate = new Date(result.nextCodeDate).toISOString()
      done(null, result)
    })
  },
  shouldOpen: function () {
    return isSignedIn() && hasGoldAccess()
  }
})

function closeGoldShopDiscountNotice () {
  var cookieName = goldShopCodeNotice.getCookieName()

  goldShopCodeNotice.close()
  setCookie('last-gold-shop-code', goldShopCodeNotice.currentCode.code)
  setCookie(cookieName, goldShopNextCodeDate)
}
