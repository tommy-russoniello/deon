/*==================================
=            PROCESSORS            =
==================================*/
function processSignInPage (args) {
  if (isSignedIn()) {
    toasty('You are already logged in')
    go('/account')
    return
  }
  const scope = {}

  scope.continueTo = getSignInContinueTo()
  scope.signOnQueryString = getSignOnQueryString()

  
  renderContent(args.template, scope)
  pageIsReady({
    title: 'Sign In',
    description: 'Sign in to your Monstercat.com account'
  })
}

/*===============================
=            ACTIONS            =
===============================*/
function submitSignIn (e, el) {
  submitForm(e, {
    validate: function (data, errs) {
      if (!data.email) {
        errs.push('Email is required')
      }

      if (!data.password) {
        errs.push('Password is required')
      }

      return errs
    },
    action: function (args) {
      signIn(args.data, (err, obj, xhr) => {
        actionier.off(args.form)
        if (terror(err)) {
          formErrors(args.form, err)
          return
        }
        if (xhr.status != 209) {
          onSignIn()
          return
        }
        go('/authenticate-token')
      })
    }
  })
}

function submitSignUp (e, el) {
  submitForm(e, {
    transformData: transformSubmittedAccountData,
    validate: validateSignUp,
    action: function (args) {
      signUpAt(args.data, '/signup')
    }
  })
}

function signIn (data, done) {
  data.password = data.password.toString()
  requestJSON({
    url: endpoint2 + '/signin',
    method: 'POST',
    withCredentials: true,
    data: data
  }, done)
}

function authenticateTwoFactorToken (e, el) {
  e.preventDefault()
  requestJSON({
    url: endpoint2 + '/signin/token',
    method: 'POST',
    data: getDataSet(el),
    withCredentials: true
  }, function (err, obj, xhr) {
    if (err) { return toasty(new Error(err.message)) }
    onSignIn()
  })
}

function resendTwoFactorToken (e, el) {
  requestJSON({
    url: endpoint2 + '/signin/token/resend',
    method: 'POST',
    withCredentials: true
  }, function (err, obj, xhr) {
    if (err) { return toasty(new Error(err.message)) }
    toasty(strings.tokenResent)
  })
}

function onSignIn(done) {
  if (!done) {
    done = function () {
      goContinueTo()
    }
  }
  getSession(function (err, sess) {
    if (err) { return toasty(new Error(err.message)) }
    session = sess
    trackUser()
    renderHeader()
    renderHeaderMobile()
    siteNotices.completeProfileNotice.start()
    //siteNotices.goldShopCodeNotice.start()
    done()
  })
}

function signOut (e, el) {
  requestJSON({
    url: endpoint2 + '/signout',
    method: 'POST',
    withCredentials: true
  }, function (err, obj, xhr) {
    if (err) { return toasty(new Error(err.message)) }
    session.user = null
    untrackUser()
    renderHeader()
    renderHeaderMobile()
    siteNotices.completeProfileNotice.close()
    go("/")
  })
}

function recoverPassword (e, el) {
  submitForm(e, {
    transformData: function (data) {
      data.returnUrl = location.protocol + '//' + location.host + '/reset-password?key=:code'
      return data
    },
    successMsg: strings.passwordResetEmail,
    url: endpoint2 + '/password/send-verification',
    method: 'POST'
  })
}

function processPasswordResetPage (args) {
  pageProcessor(args, {
    transform: function () {
      const obj = {}
      var key = searchStringToObject().key

      obj.missingKey = !key
      obj.key = key
      return obj
    },
    completed: () => {
      pageIsReady({
        title: 'Reset Password'
      })
    }
  })
}

function updatePassword (e, el) {
  submitForm(e, {
    method: 'POST',
    url: endpoint2 + '/password/reset',
    validate: function (data, errs) {
      if (!data.password) {
        errs.push(strings.passwordMissing)
      }

      if (data.password != data.confirmPassword) {
        errs.push(strings.passwordDoesntMatch)
      }

      return errs
    }
  })
}

function signUp (data, where, done) {
  data.password = data.password.toString()
  data.email = data.email.trim()
  requestJSON({
    url: endpoint2 + where,
    method: 'POST',
    withCredentials: true,
    data: data
  }, function (err, obj, xhr) {
    if (err) {
      return done(err)
    }
    onSignIn(done)
  })
}

function signUpAt (data, where) {
  signUp(data, where, (err, obj, xhr) => {
    if (terror(err)) {
      return
    }
    goContinueTo()
  })
}

function validateSignUp (data, errors) {
  errors = errors || []
  errors = errors.concat(validateAccountData(data))

  if (!data.password && !data.password_confirmation) {
    errors.push('Password is required')
  }

  if (!data.email || data.email.indexOf('@') == -1) {
    errors.push('A valid email is required')
  }

  return errors
}

function getSignOnQueryString () {
  const str = []
  const continueTo = getContinueTo()

  if (continueTo.url) {
    str.push('continueUrl=' + encodeURIComponent(continueTo.url))
  }

  if (continueTo.label) {
    str.push('continueLabel=' + encodeURIComponent(continueTo.label))
  }

  if (str.length) {
    return '?' + str.join('&')
  }

  return false
}

function goContinueTo () {
  const to = getContinueTo()
  if (to.url && to.url.indexOf('http') == 0) {
    window.location = to.url
  }
  else {
    go(to.url)
  }
}

function getSignInContinueTo () {
  const continueTo = getContinueTo()
  if (continueTo.url.indexOf('bestof2017') >= 0) {
    continueTo.label = 'voting on <a href="/bestof2017">Best of 2017</a>'
  }

  if (continueTo.url.indexOf('api/shopify') >= 0) {
    continueTo.label = 'to the Monstercat Shop'
  }

  return continueTo
}

function getContinueTo () {
  const continueTo = {
    url: "",
    label: ""
  }

  const so = searchStringToObject()

  if (so.continueUrl) {
    continueTo.url = so.continueUrl
  } else if (so.redirect) {
    continueTo.url = so.redirect //Legacy parameter
  }

  if (so.continueLabel) {
    continueTo.label = so.continueLabel
  }

  return continueTo
}

function getContinueToUrl() {
  const cont = getContinueTo()

  return cont.url
}

function processSignUpPage (args) {
  const continueTo = getSignInContinueTo()

  if (isSignedIn()) {
    toasty('You are already logged in')
    return go('/account')
  }

  const scope = {
    countries: getAccountCountries(),
    continueTo: continueTo
  }
  var qo = searchStringToObject()

  if (qo.email) {
    scope.email = qo.email
  }

  if (qo.location) {
    scope.placeNameFull = qo.location
  }

  if (qo.promotions || qo.location) {
    scope.emailOptIns = {
      promotions: true
    }
  }

  scope.signOnQueryString = getSignOnQueryString()
  
  renderContent(args.template, scope)

  google.maps.event.addDomListener(window, 'load', initLocationAutoComplete)
  initLocationAutoComplete()
  pageIsReady({
    title: 'Sign Up'
  })
}

function processConfirmSignUp (args) {
  templatePageProcessor('confirm-sign-up', args, {
    hasLoading: true,
    transform: function (args) {
      return queryStringToObject(window.location.search)
    },
    completed: function () {
      initLocationAutoComplete();
    }
  })
}

