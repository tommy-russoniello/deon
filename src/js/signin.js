/*==================================
=            PROCESSORS            =
==================================*/
function processSignInPage (args) {
  console.log('args', args)
  if (isSignedIn()) {
    toasty('You are already logged in')
    go('/account')
    return
  }
  const scope = {}
  const url = getRedirectTo()

  scope.redirectTo = encodeURIComponent(url)
  scope.continueTo = getSignInContinueTo()
  trackSignUpEvents()
  renderContent(args.template, scope)
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
  console.log('data', data)
  requestJSON({
    url: endhost + '/signin',
    method: 'POST',
    withCredentials: true,
    data: data
  }, done)
}

function authenticateTwoFactorToken (e, el) {
  e.preventDefault()
  requestJSON({
    url: endhost + '/signin/token',
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
    url: endhost + '/signin/token/resend',
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
      go(getRedirectTo())
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
    url: endhost + '/signout',
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
    url: endhost + '/password/send-verification',
    method: 'POST'
  })
}

function processPasswordResetPage (args) {
  pageProcessor(args, {
    transform: function () {
      const obj = {}
      var key = searchStringToObject().key

      obj.missingKey = !key
      return obj
    }
  })
}

function updatePassword (e, el) {
  submitForm(e, {
    method: 'POST',
    url: endhost + '/password/reset',
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
  requestJSON({
    url: endpoint + where,
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
    go(getRedirectTo())
  })
}

function validateSignUp (data, errors) {
  errors = errors.concat(validateAccountData(data))

  if (!data.password && !data.password_confirmation) {
    errors.push('Password is required')
  }

  if (!data.email || data.email.indexOf('@') == -1) {
    errors.push('A valid email is required')
  }

  console.log('errors', errors)

  return errors
}


function getRedirectTo () {
  return searchStringToObject().redirect || "/"
}

function getSignInContinueTo () {
  var redirectTo = getRedirectTo()
  var continueTo = false

  if (redirectTo.substr(0, '/account/services'.length) == '/account/services') {
    var qos = redirectTo.substr(redirectTo.indexOf('?') + 1)
    var qo = queryStringToObject(qos)

    continueTo = {
      buying: qo
    }
    if (qo.ref == 'gold') {
      continueTo.buying.gold = true
    }
    continueTo.msg = false
  }

  if (redirectTo.indexOf('bestof2017') >= 0) {
    continueTo = {
      msg: 'voting on <a href="/bestof2017">Best of 2017</a>'
    }
  }

  return continueTo
}

function processSignUpPage (args) {
  const redirectTo = getRedirectTo()
  const continueTo = getSignInContinueTo()

  if (isSignedIn()) {
    toasty('You are already logged in')
    return go('/account')
  }

  const scope = {
    countries: getAccountCountries(),
    continueTo: continueTo,
    redirectTo: encodeURIComponent(redirectTo)
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

  renderContent(args.template, scope)

  google.maps.event.addDomListener(window, 'load', initLocationAutoComplete)
  trackSignUpEvents()
  initLocationAutoComplete()
}

function mapConfirmSignup () {
  var obj = searchStringToObject()

  if (!Object.keys(obj).length) { return }
  obj.countries = getAccountCountries()
  if (obj.email == 'undefined') {
    obj.email = ''
  }
  return obj
}

function trackSignUpEvents () {
  var redirectTo = getRedirectTo()

  if (redirectTo == '/account/services?ref=gold') {
    recordSubscriptionEvent('Redirect to Sign Up', 'Gold Redirect to Signup')
  }
}
