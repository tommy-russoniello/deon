var vendorPrices = {
  YouTube: {
    monthly: 1000,
    total: 20000
  },
  Twitch: {
    monthly: 500,
    total: 10000
  },
  Beam: {
    monthly: 500,
    total: 10000
  }
}

function getVendorName (vendor) {
  if (vendor == 'Beam') {
    return 'Mixer'
  }

  return vendor
}

function isValidPayMethod (str, obj) {
  if (str != 'stripe' && str != 'paypal') { return false }
  if (typeof obj[str] != 'function') { return false }
  return true
}

function buyoutUrl (id) {
  var url = endpoint + '/self/whitelist/'

  if (id) { url += id + '/' }
  url += 'buyout'
  return url
}

function processServicesBuyoutPage (obj) {
  pageProcessor(obj, {
    transform: function (args) {
      const result = args.result

      if (!result) {
        var o = searchStringToObject()

        o.cost = 100
        return o
      }
      const scope = Object.assign(result, {
        cost: (result.amountRemaining / 100).toFixed(2)
      })

      return scope
    }
  })
}

function processBuyWhitelistPage (args) {
  renderLoading()
  getUserServicesScope((err, obj) => {
    const scope = Object.assign(obj, searchStringToObject())

    renderContent(args.template, {
      data: scope
    })

    var qo = searchStringToObject()
    var vendorSelect = findNode('select[name=vendor]')

    if (qo.vendor) {
      vendorSelect.value = qo.vendor
    }

    if (qo.vendor && qo.method && qo.identity) {
      findNode('[role="buy-new-licence"]').submit()
    }

    bindIdentityBlur()
    vendorSelect.addEventListener('change', vendorChanged)
    vendorChanged()
  })
}

function buyLicense (data) {
  if (!data.vendor) { return }
  if (!data.identity) { return }
  if (!data.amount) { return }
  if (!isValidPayMethod(data.method, buyLicense)) { return }

  if (!isSignedIn()) {
    var url = encodeURIComponent('/account/services/buyout?vendor=' + data.vendor + '&identity=' + data.identity + '&method=' + data.method)

    go('/sign-up?redirect=' + url)
    return
  }

  recordSubscriptionEvent('Checkout', 'Buyout ' + data.vendor)
  buyLicense[data.method](data)
}

function submitBuyLicense (e, el) {
  e.preventDefault()
  const form = e.target
  const data = formToObject(form)

  if (actionier.isOn(form)) {
    return
  }

  formErrors(form, [])

  actionier.on(form)
  convertIdentityAndValidateLicense(data.identity, data.vendor, (err, identity) => {
    actionier.off(form)
    if (terror(err)) {
      formErrors(form, err)
      return
    }
    data.identity = identity
    buyLicense(data)
  })
}

buyLicense.paypal = function buyLicensePayPal (data) {
  requestJSON({
    url: buyoutUrl(data.id),
    method: data.id ? 'PUT' : 'POST',
    withCredentials: true,
    data: {
      provider: 'paypal',
      returnUrl: location.origin + '/account/services/processing?type=buyout',
      cancelUrl: location.origin + '/account/services/canceled-payment',
      vendor: data.vendor,
      identity: data.identity
    }
  }, (err, body, xhr) => {
    if (err) {
      return recordErrorAndAlert(err, 'Buy License PayPal')
    }
    if (!body.redirect) {
      return recordErrorAndGo(Error('Missing paypal redirect'), 'Buy License PayPal', '/account/services/error')
    }
    window.location = body.redirect
  })
}

buyLicense.stripe = function buyLicenseStripe (data) {
  var handler = StripeCheckout.configure({
    key: STRIPE_PK,
    image: '/img/default.png',
    locale: 'auto',
    token: function(token) {
      requestJSON({
        url: buyoutUrl(data.id),
        method: data.id ? 'PUT' : 'POST',
        withCredentials: true,
        data: {
          provider: 'stripe',
          token: token.id,
          vendor: data.vendor,
          identity: data.identity
        }
      }, (err, body, xhr) => {
        if (terror(err)) {
          return
        }
        go('/account/services/buyout/purchased')
      })
    }
  })

  handler.open({
    name: data.vendor + ' Whitelist',
    description: 'For "' + data.identity + '"',
    amount: data.amount,
    email: session.user.email,
    panelLabel: "Pay {{amount}}"
  })
}

function convertIdentityAndValidateLicense (identity, vendor, callback) {
  if (vendor == 'YouTube') {
    youTubeUserToChannelID(identity, function (channelid) {
      findNode('input[name=identity]').value = channelid
      validateLicense(channelid, vendor, callback)
    })
  }
  else {
    validateLicense(identity, vendor, callback)
  }
}

function validateLicense (identity, vendor, done) {
  requestJSON({
    url: endpoint + '/whitelist/status/?vendor=' + vendor + '&identity=' + (vendor == 'YouTube' ? identity : identity.toLowerCase())
  }, function (err, obj, xhr) {
    if (err) { return done(err) }
    if (!obj) { return done(Error(strings.error)) }
    if (!obj.valid) { return done(Error(strings.invalidIdentity)) }
    if (obj.blacklisted) { return done(Error(strings.blacklistedIdentity)) }
    if (!obj.available) { return done(Error(strings.unavailableIdentity)) }
    done(null, identity)
  })
}

function checkoutSubscriptions (e, el) {
  e.preventDefault()
  const pageScope = cache(PAGE_SERVICES)
  var els = toArray(document.querySelectorAll('[role="new-subs"] tr') || [])
  var subs = getCheckoutSubs()
  var submit = function () {
    if (!subs.length) { return }
    recordSubscriptionEvent('Checkout')
    var data = getDataSet(el)

    if (!isValidPayMethod(data.method, checkoutSubscriptions)) { return }
    checkoutSubscriptions[data.method](data, subs)
  }

  var buyingGold = false

  for (var i = 0; i < subs.length; i++) {
    if (subs[i].name == 'Gold Membership') {
      buyingGold = true
      break
    }
  }

  if (pageScope.onpageSignUp && !isSignedIn()) {
    var signOnContainer = document.getElementById('sign-on')
    var data = getDataSet(signOnContainer)
    var signOnMethod = data.signOnMethod
    var socialSignOn = false

    //facebook or google or null
    if (e.target && e.target.dataset.social) {
      socialSignOn = e.target.dataset.social
    }

    //After successfully signin in or signup either through us, Facebook, or Google, this is checked
    var signOn = function (err, result, xhr) {
      if (err) {
        toasty(new Error(err.message))
        return
      }
      signOnContainer.classList.toggle('hide', true)
      //onSignIn will update their session information and rerender headers and the like
      onSignIn(function () {
        //This will look at their current gold subscription from the server
        getUserServicesScope(function (err, opts) {
          if (err) {
            toasty(new Error(err.message))
            return
          }
          //If they can't subscribe we don't let them continue
          //This can happen if they already have a subscription or they have free gold
          if (!opts.user.gold.canSubscribe){
            //If they are buying more than gold stuff, then we remove gold and resubmit the form
            if (subs.length > 1) {
              var goldTr = els[i]
              var removeButton = goldTr.querySelector('[action=removeSub]')

              removeButton.click()
              toasty('You already have Gold, removing from cart')
            }
            //If they are only buying gold then we can just refresh the page and let them know they already have a subscription
            else if (buyingGold) {
              toasty('You already have a Gold subscription')
              go('/account/services')
              return
            }
          }
          if (signOnMethod == 'sign-up') {
            toasty('Account created! Continuing...')
          }
          else {
            toasty('Signed in! Continuing...')
          }
          submit()
        })
      })
    }

    if (signOnMethod == 'sign-up') {
      data = transformSubmittedAccountData(data)

      //The social sign ons require us to send them to the /confirm-sign-up page
      //which when successfull will redirect them back here and try to update their cart to what it was before
      var qo = queryStringToObject()

      if (buyingGold){
        qo.ref = 'gold'
      }

      //Go through all subs and find the first license
      //our URL params that auto-add things to your cart only look for a single
      //vendor/identity, so we can only do the first license this way
      for (var i = 0; i < subs.length; i++) {
        var sub = subs[i]

        if (sub.name != 'Gold Membership') {
          qo.vendor = sub.vendor
          qo.identity = sub.identity
          break
        }
      }

      var redirectTo = window.location.pathname + '?' + objectToQueryString(qo)

      if (socialSignOn == 'google'){
        signUpGoogle({
          redirect: redirectTo
        }, signOn)
      }
      else if (socialSignOn == 'facebook'){
        signUpFacebook({
          redirect: redirectTo
        }, signOn)
      }
      else {
        var errors = validateSignUp(data)

        if (errors.length > 0) {
          errors.forEach(function (err) {
            toasty(new Error(err))
          })
          return
        }
        signUp(data, '/signup', signOn)
      }
    }
    else if (socialSignOn == 'google') {
      signInGoogle(signOn)
    }
    else if (socialSignOn == 'facebook') {
      signInFacebook(signOn)
    } else {
      signIn(data, signOn)
    }
  }
  else {
    submit()
  }
}

checkoutSubscriptions.paypal = function checkoutSubscriptionsStripe (data, subs) {
  var returnUrl = location.origin + '/account/services/processing?type='
  var qo = searchStringToObject()

  if (qo.ref == 'gold') {
    returnUrl += 'gold'
  }
  else {
    returnUrl += 'subscriptions'
  }

  if (qo.hasOwnProperty('humble')) {
    returnUrl += '&humble=1'
  }

  requestJSON({
    url: endpoint + '/self/subscription/services',
    method: 'POST',
    withCredentials: true,
    data: {
      provider: 'paypal',
      returnUrl: returnUrl,
      cancelUrl: location.origin + '/account/services/canceled-payment',
      services: subs
    }
  }, function (err, body, xhr) {
    if (err) {
      return recordErrorAndAlert(err, 'Checkout Subscriptions PayPal')
    }
    if (!body.redirect) {
      return recordErrorAndGo(Error('Missing paypal redirect'), 'Checkout Subscriptions PayPal', '/account/services/error')
    }
    recordSubscriptionEvent('PayPal Successful')
    window.location = body.redirect
  })
}

checkoutSubscriptions.stripe = function checkoutSubscriptionsStripe (data, subs) {
  var qo = searchStringToObject()
  var handler = StripeCheckout.configure({
    key: STRIPE_PK,
    image: '/img/default.png',
    locale: 'auto',
    token: function(token) {
      // TODO handle temporary UX wait here
      requestJSON({
        url: endpoint + '/self/subscription/services',
        method: 'POST',
        withCredentials: true,
        data: {
          provider: 'stripe',
          token: token.id,
          services: subs
        }
      }, function (err, body, xhr) {
        if (err) { return recordErrorAndAlert(err, 'Checkout Subscriptions Stripe') }
        if (qo.hasOwnProperty('humble')) {
          go('/humble')
        }
        else {
          var url = '/account/services/subscribed'

          if (qo.ref == 'gold') {
            url += '?type=gold'
          }
          go(url)
        }
      })
    }
  })
  var cost = getTotalCheckoutCostFromSubs(subs)

  handler.open({
    name: 'Monstercat',
    description: 'Subscription Services',
    amount: cost,
    email: session.user.email,
    panelLabel: "Subscribe {{amount}}"
  })
}

function cancelLicenseSubscription (e, el) {
  if (!window.confirm(strings.cancelWhitelistSub)) { return }
  var id = el.dataset.whitelistId
  // TODO handle wait UX

  requestJSON({
    url: endpoint + '/self/whitelist/' + id + '/cancel',
    method: 'PUT',
    withCredentials: true
  }, function (err, obj, xhr) {
    if (err) { return recordErrorAndAlert(err, 'Cancel License Subscription') }
    go('/account/services/unsubscribed')
  })
}

function resumeLicenseSubscription (e, el) {
  e.preventDefault()
  var data = getDataSet(el)
  console.log('data', data);

  openModal('resume-whitelist', data)
  bindPayPalGermanyWarning()
}

function resumeLicenseConfirm (e, el) {
  e.preventDefault()
  var data = getDataSet(el)

  if (!data.id) { return }
  if (!data.vendor) { return }
  if (!data.identity) { return }
  if (!data.amount) { return }
  if (!isValidPayMethod(data.method, resumeLicenseConfirm)) { return }
  resumeLicenseConfirm[data.method](data)
}

function getSelectedVendor () {
  var sel = findNode('select[name=vendor]')

  return sel ? sel.value : "none"
}

function bindIdentityBlur () {
  var id = findNode('input[name=identity]')

  if (id) {
    id.addEventListener('blur', function () {
      var vendor = getSelectedVendor()
      var val = serviceUrlToChannelId(this.value)

      this.value = val
    })
  }
}

function completedServices (source, obj) {
  var vendorSelect = findNode('select[name=vendor]')
  //if (!vendorSelect) return
  var qp = searchStringToObject()

  if (qp.vendor) {
    var vendor = qp.vendor.toLowerCase()
    var valid = true

    if (vendor == 'youtube') {
      vendorSelect.value = 'YouTube'
    }
    else if (vendor == 'twitch') {
      vendorSelect.value = 'Twitch'
    }
    else if (vendor == 'beam') {
      vendorSelect.value = 'Beam'
    }
    else {
      valid = false
    }

    if (qp.identity && valid) {
      findNode('input[name=identity]').value = qp.identity
      subscribeNewLicense({}, findNode('[action=subscribeNewLicense]'))
    }
  }

  //If they are coming from a link for Gold then we automatcially add gold
  //to their cart
  if (qp.ref == 'gold') {
    subscribeGold({}, findNode('[action=subscribeGold]'))
  }

  bindIdentityBlur()
  if (vendorSelect) {
    vendorSelect.addEventListener('change', vendorChanged)
  }
  vendorChanged()
  bindPayPalGermanyWarning()
  initLocationAutoComplete()
}

function vendorChanged () {
  var vendor = getSelectedVendor()

  if (!vendor) {
    vendor = "none"
  }
  var vendorKeys = ['none', 'YouTube', 'Twitch', 'Beam']
  var els = document.querySelectorAll('.vendor-help')

  for (var i = 0; i < els.length; i++) {
    for (var k = 0; k < vendorKeys.length; k++) {
      var key = vendorKeys[k]

      els[i].classList.toggle(key, key == vendor)
    }
  }

  if (vendorPrices[vendor]) {
    var buyoutPrice = findNode('[role="buyout-price"]')

    if (buyoutPrice) {
      buyoutPrice.textContent = '$' + (vendorPrices[vendor].total / 100).toFixed(2)
    }
  }
}

resumeLicenseConfirm.paypal = function resumeLicenseConfirmPayPal (data) {
  requestJSON({
    url: endpoint + '/self/whitelist/' + data.id + '/resume',
    method: 'PUT',
    withCredentials: true,
    data: {
      provider: 'paypal',
      returnUrl: location.origin + '/account/services/processing?type=resume',
      cancelUrl: location.origin + '/account/services/canceled-payment'
    }
  }, function (err, body, xhr) {
    if (err)
    { return recordErrorAndAlert(err, 'Resume License Confirm PayPal') }
    if (!body.redirect)
    { return recordErrorAndGo(Error('Missing PayPal redirect.'), 'Resume License Confirm PayPal', '/account/services/error') }
    window.location = body.redirect
  })
}

resumeLicenseConfirm.stripe = function resumeLicenseConfirmStripe (data) {
  var handler = StripeCheckout.configure({
    key: STRIPE_PK,
    image: '/img/default.png',
    locale: 'auto',
    token: function(token) {
      // TODO handle temporary UX wait here
      requestJSON({
        url: endpoint + '/self/whitelist/' + data.id + '/resume',
        method: 'PUT',
        withCredentials: true,
        data: {
          provider: 'stripe',
          token: token.id
        }
      }, function (err, body, xhr) {
        if (err)
        { return recordErrorAndAlert(err, 'Resume License Confirm Stripe') }
        go('/account/services/subscribed')
      })
    }
  })

  handler.open({
    name: 'Whitelist Subscription',
    amount: data.amount,
    description: data.vendor + ' - ' + data.identity,
    email: session.user.email,
    panelLabel: "Resubscribe {{amount}}"
  })
}

function processServicesProcessingPage (args) {
  var obj     = queryStringToObject(location.search)
  var uri     = null
  var forward = null

  renderContent(args.template)

  if (obj.type == 'buyout') {
    uri = 'whitelist/buyout/complete'
    forward = '/account/services/buyout/purchased'
  }
  else if (obj.type == 'subscriptions' || obj.type == 'resume' || obj.type == 'gold') {
    uri = 'subscription/services/complete'
    forward = '/account/services/subscribed'

    if (obj.type == 'gold') {
      forward += '?type=gold'
    }

    if (obj.humble) {
      forward = '/humble'
    }
  }
  if (!uri) {
    // TODO display in page and check all data was recieved
    return toasty('An error occured because there was no data recieved to move forward.')
  }
  requestJSON({
    url: endpoint + '/self/' + uri,
    withCredentials: true,
    method: 'POST',
    data: {
      token: obj.token,
      payerId: obj.PayerID
    }
  }, function (err, obj, xhr) {
    if (err) {
      recordErrorAndAlert(err, 'Complete Processing')
      return
    }
    go(forward)
  })
}

function clickUnsubscribeGold (e, el) {
  recordGoldEvent('Click Unsubscribe')

  var reasons = [
    'Too expensive',
    "Didn't use it enough",
    "Not enough features",
    "Wasn't what I thought it was"
  ]

  openModal('unsubscribe-gold-modal', {
    reasons: reasons
  })
  var otherInput = findNode('[name=other]')
  var otherRadio = findNode('[name=reason][value="other"]')

  otherInput.addEventListener('focus', () => {
    otherRadio.checked = true
  })
  otherRadio.addEventListener('change', () => {
    if (otherRadio.checked) {
      otherInput.focus()
    }
  })

}

function submitUnsubscribeGold (e, el) {
  e.preventDefault()

  var data = formToObject(e.target)

  if (!data.reason) {
    data.reason = 'none'
  }

  data.type = "gold_unsubscribe_reason"
  data.date = new Date().toISOString()
  data.userId = session.user._id

  requestWithFormData({
    url: 'https://submit.monstercat.com',
    method: 'POST',
    data: data
  })

  requestJSON({
    url: endpoint + '/self/subscription/gold/cancel',
    withCredentials: true,
    method: "POST"
  }, function (err, body, xhr) {
    if (err)
    { return recordErrorAndAlert(err, 'Unsubscribe Gold') }
    go('/account/services/unsubscribed')
  })
}

function redirectServices (e, el) {
  setTimeout(function () {
    window.location = location.origin + '/account/services'
  }, 5000)
}

function getTotalCheckoutCostFromSubs (arr) {
  return arr.reduce(function (prev, cur) {
    return new Number(prev) + new Number(cur.amount)
  }, 0)
}

function getCheckoutSubs () {
  var els = toArray(document.querySelectorAll('[role="new-subs"] tr') || [])
  return els.map((el) => {
    const data = formToObject(el)
    return data
  })
}

function getTotalCheckoutCost (arr) {
  return getTotalCheckoutCostFromSubs(getCheckoutSubs())
}

/* UI Stuff */

function updateTotalCheckoutCost () {
  var cost = getTotalCheckoutCost()
  var el = findNode('[role="total-cost"]')

  el.textContent = (cost / 100).toFixed(2)
  if (cost <= 0) {
    showNewSubscriptions(false)
  }
}

function showNewSubscriptions (value) {
  if (typeof value == 'undefined') { value = true }
  var method = value ? 'remove' : 'add'

  findNode('#new-subscriptions').classList[method]('hide')
}

function reachedMaxCartSubscriptions () {
  return (document.querySelectorAll('[role="new-subs"] tr') || []).length >= 5
}

function addSub (obj) {
  var container = findNode('[role="new-subs"]')
  var div = document.createElement('tbody')

  betterRender('subscription-row', div, obj)
  container.appendChild(div.firstElementChild)
  updateTotalCheckoutCost()
  showNewSubscriptions()
}

function removeSub (e, el) {
  e.path.forEach(function (el) {
    if (el.tagName && el.tagName.toLowerCase() == 'tr')
    { el.parentElement.removeChild(el) }
  })
  updateTotalCheckoutCost()
}

function submitSubscribeGold (e, el) {
  e.preventDefault()

  if (reachedMaxCartSubscriptions()) {
    recordSubscriptionEvent('Reached Max Cart Subscriptions', 'Gold')
    return toasty(strings.cart5)
  }
  if (findNode('[type="hidden"][name="type"][value="gold"]')) {
    recordSubscriptionEvent('Item Already In Cart', 'Gold')
    return toasty(strings.goldInCart)
  }

  const pageScope = cache(PAGE_SERVICES)
  if (!pageScope.user.gold.canSubscribe) {
    return
  }

  var opts = {
    name: "Gold Membership",
    label: 'Add Gold Subscription',
    cost: "5.00",
    fields: [
      { key: "name", value: "Gold Membership" },
      { key: "type", value: "gold" },
      { key: "amount", value: 500 }
    ]
  }

  var data = formToObject(e.target)

  var fin = function (opts) {
    if (isSignedIn() || pageScope.onpageSignUp) {
      addSub(opts)
      recordGoldEvent('Gold Added to Cart')
      toasty(strings.goldAdded)
      scrollToCheckout()
    }
    else {
      var url = '/account/services?ref=gold'

      recordSubscriptionEvent('Redirected to Sign Up', 'Gold')
      return go('/sign-up?redirect=' + encodeURIComponent(url))
    }
  }

  if (data.trialCode) {
    data.trialCode = data.trialCode.trim()
    findNode('input[name=trialCode]').value = data.trialCode
    el.classList.add('working')
    el.disabled = true
    return requestJSON({
      url: endpoint + "/self/services/gold/code/" + data.trialCode,
      withCredentials: true
    }, function (err, obj, xhr) {
      el.classList.remove('working')
      el.disabled = false
      if (xhr.status == 404) { return toasty(strings.codeNotFound) }
      if (err) { return toasty(new Error(err.message)) }
      if (!obj) { return toasty(strings.error) }
      if (!obj.valid) { return toasty(strings.codeNotValid) }
      if (obj.autoRenews) {
        opts.name += " - Code: " + obj.code + ' - ' + obj.durationDays + " days free ($5/mo after)"
      }
      else {
        opts.name += " - Code: " + obj.code + ' - ' + obj.durationDays + " days free (with no auto-renew)"
      }
      opts.fields[2].value = 0
      opts.cost = "0.00"
      opts.fields.push({ key: "trialCode", value: obj.code })
      fin(opts)
    })
  }
  fin(opts)
}

function alreadyInCart (data) {
  return !!findNode('[type="hidden"][value="' + data.vendor + '"]') &&
    !!findNode('[type="hidden"][value="' + data.identity + '"]')
}

function clickBuyoutNewLicense (e, el) {
  var data = formToObject(findParentOrSelf(el, 'form'))

  if (!data) { return }
  if (!data.vendor) { return }
  if (!data.identity) { return }
  data.identity = serviceUrlToChannelId(data.identity)
  recordSubscriptionEvent('Prepay New License', {
    label: getVendorName(data.vendor),
    vendor: data.vendor
  })
  go('/account/services/buyout?vendor=' + data.vendor + '&identity=' + data.identity)
  return
}

function submitSubscribeNewLicense (e, el) {
  e.preventDefault()

  if (actionier.isOn(el)) {
    return
  }

  if (reachedMaxCartSubscriptions()) {
    recordSubscriptionEvent('Reached Max Cart Subscriptions', {
      vendor: data.vendor,
      label: 'Whitelist'
    })
    toasty(new Error(strings.cart5))
    return
  }

  var data = formToObject(e.target)

  if (!data) { return }
  if (!data.vendor) { return }
  if (!data.identity) { return }

  if (alreadyInCart(data)) {
    toasty(new Error(strings.licenseInCart))
    return
  }

  //This strips https://twitch/tv and http://youtube.com/channel/ stuff from the identity
  data.identity = serviceUrlToChannelId(data.identity)
  findNode('input[name=identity]').value = data.identity

  actionier.on(el)
  convertIdentityAndValidateLicense(data.identity, data.vendor, (err, identity) => {
    const pageScope = cache(PAGE_SERVICES)

    actionier.off(el)

    //Sometimes they put in the username (eg: monstercat) and we change it to ID (feh9832hgoh329g3h29)
    data.identity = identity
    if (err) {
      toasty(new Error(err.message))
      return
    }

    //If they are not signed AND they aren't part of the section of the split test that
    //redirects, then we redirect them to the sign up page
    if (!isSignedIn() && pageScope.signUpRedirect) {
      var url = '/account/services?vendor=' + data.vendor + '&identity=' + data.identity

      recordSubscriptionEvent('Redirected to Sign Up', {
        label: 'Whitelist ' + getVendorName(data.vendor)
      })
      go('/sign-up?redirect=' + encodeURIComponent(url))
      return
    }

    var name = "Whitelisting for " + data.identity + " on " + getVendorName(data.vendor)

    addSub({
      name: name,
      label: 'Add Whitelist ' + getVendorName(data.vendor) + ' Subscription',
      cost: (vendorPrices[data.vendor].monthly / 100).toFixed(2),
      fields: [
        { key: "amount", value: vendorPrices[data.vendor].monthly },
        { key: "type", value: 'whitelist'},
        { key: "vendor", value: data.vendor },
        { key: "identity", value: data.identity }
      ]
    })
    recordSubscriptionEvent('Whitelist Added to Cart', getVendorName(data.vendor))
    toasty(strings.whitelistAdded)
    scrollToCheckout()
  })
}

function scrollToCheckout () {
  setTimeout(function () {
    scrollToEl(findNode('#new-subscriptions'))
  }, 500)
}

function bindPayPalGermanyWarning () {
  var radios = document.querySelectorAll('input[name=method]')

  for (var i = 0; i < radios.length; i++) {
    radios[i].addEventListener('change', togglePayPalGermanyWarning)
  }
  togglePayPalGermanyWarning()
}

function togglePayPalGermanyWarning () {
  if (session && session.user && session.user.location == 'Germany') {
    var val = findNode('input[name=method]:checked').value
    var msg = findNode('.recurring-warning-germany')

    if (msg) {
      msg.classList.toggle('hide', val != 'paypal')
    }
  }
}

function servicesChangeSignOnMethod (e, newMethod) {
  var email = findNode('[name=email]').value

  betterRender('services-' + newMethod, findNode('[role=sign-on-fields]'))
  findNode('[name=email]').value = email
  if (newMethod == 'sign-up') {
    initLocationAutoComplete()
  }
}

function transformCanceledPayment (obj) {
  obj = obj || {}
  var qo = searchStringToObject()

  if (qo.type == 'gold') {
    obj.returnUrl = '/gold/buy'
    obj.returnLabel = 'Gold'
  }
  else {
    obj.returnUrl = '/account/services'
    obj.returnLabel = 'services'
  }
  return obj
}

function processSubscribedPage (obj) {
  const qo = searchStringToObject()

  if (isSignedIn()) {
    //The ?type=gold should only be added for peopleing come from /gold/get
    //Which redirects to /gold/buy or /account/services?ref=gold
    //Those two pages will append type=gold on this return URL is needed
    if (qo.type == 'gold') {
      var cook = getCookie('goldbuy-test')

      if (cook && cook.length > 0 && window[cook]) {
        window[cook].convert()
      }
    }
  }
  renderContent(args.template, obj)
  redirectServices()
}
