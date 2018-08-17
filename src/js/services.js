function getUserServicesScope (done) {
  var user = isSignedIn() ? session.user : {}
  var hasGold = !!user.goldService;
  var opts = {
    isSignedIn: isSignedIn(),
    gold: {
      has: hasGold,
      permanent: hasGold && !user.currentGoldSubscription, //If you have gold and no sub then you have free/permanent gold
      canSubscribe: !hasGold, //If you don't have it you can sub. If you DO have it, but you've canceled,  you can also sub
      subscribed: hasGold && user.currentGoldSubscription, //A canceled subscription will set this to true
      canceled: null, //We get this from the server below
      endDate: null,
      nextBillingDate: null
    }
  }
  if (isLegacyUser()) {
    opts = {hasLegacy: true}
  }
  var scope = {
    user: opts,
    qs: window.location.search
  }

  if (opts.isSignedIn && opts.gold.subscribed){
    requestJSON({
      method: 'GET',
      url: endhost+ '/api/self/gold-subscription',
      withCredentials: true
    }, function (err, json){
      var gold = transformGoldSubscription(json);
      scope.user.gold = Object.assign(scope.user.gold, gold);
      if (scope.user.gold.canceled){
        scope.user.gold.canSubscribe = true;
      }
      done(err, scope);
    });
  }
  else {
    done(null, scope)
  }
}

function processServicesRedirectPage (args) {
  redirectServices()
  renderContent(args.template)
}

function processServicesPage (args, done) {
  renderLoading()
  getUserServicesScope((err, opts) => {
    if (err) {
      renderError(err)
      return
    }
    const qo = searchStringToObject()

    const scope =  {
      user: opts.user,
      qs: encodeURIComponent(window.location.search),
      signUpRedirect: true,
      onpageSignUp: false
    }

    if (qo.hasOwnProperty('humble')) {
      scope.user.humble = true
    }

    if (!isSignedIn()) {
      scope.onpageSignUp = true
      scope.signUpRedirect = false
      scope.showSignUp = scope.onpageSignUp && !isSignedIn()
    }

    cache(PAGE_SERVICES, scope)
    renderContent(args.template, {data: scope})
    var vendorSelect = findNode('select[name=vendor]')

    if (qo.vendor) {
      var vendor = qo.vendor.toLowerCase()
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

      if (qo.identity && valid) {
        findNode('input[name=identity]').value = qo.identity
        findNode('form[role="subscribe-new-license"] button').click()
      }
    }

    //If they are coming from a link for Gold then we automatcially add gold
    //to their cart
    if (qo.ref == 'gold') {
      subscribeGold({}, findNode('[action=subscribeGold]'))
    }

    bindIdentityBlur()
    if (vendorSelect) {
      vendorSelect.addEventListener('change', vendorChanged)
    }
    vendorChanged()
    bindPayPalGermanyWarning()
    initLocationAutoComplete()
  })
}

function processWhitelists (args) {
  templateProcessor('licenses-rows', args, {
    hasLoading: true,
    transform: function (obj) {
      const result = obj.result
      const scope = {}

      scope.results = result.results.map((whitelist) => {
        whitelist.paid = whitelist.paidInFull ? 'PAID' : '$' + (whitelist.amountPaid / 100).toFixed(2)
        whitelist.remaining = (whitelist.amountRemaining / 100).toFixed(2)
        if (whitelist.availableUntil)
          whitelist.nextBillingDate = formatDate(whitelist.availableUntil)
        if (whitelist.amount)
          whitelist.cost = (whitelist.amount / 100).toFixed(2)
        whitelist.monthlyCost = whitelist.amount
        whitelist.canBuyOut = whitelist.paidInFull ? { _id: whitelist._id } : undefined
        if (whitelist.whitelisted)
          whitelist.licenseUrl = endpoint + '/self/whitelist-license/' + whitelist.identity
        if (!whitelist.subscriptionActive && whitelist.amountRemaining > 0)
          whitelist.resume = { _id: whitelist._id, amount: whitelist.monthlyCost }
        if (whitelist.subscriptionActive)
          whitelist.cancel = { _id: whitelist._id }
        whitelist.vendorName = getVendorName(whitelist.vendor);
        return whitelist
      })
      return scope
    }
  })
}
