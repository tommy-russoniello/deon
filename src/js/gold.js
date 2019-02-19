function processPaymentReceivedPage (args) {
  let redirectTo = getCookie(COOKIES.GOLD_BUY_REDIRECT_URL) || '/'
  let redirectLabel = getCookie(COOKIES.GOLD_BUY_REDIRECT_LABEL) || 'Home'
  templatePageProcessor('payment-received-page', args, {
    transform: () => {
      return {
        redirectTo: redirectTo,
        redirectLabel: redirectLabel
      }
    },
    completed: () => {
      setTimeout(() => {
        go(redirectTo)
      }, 5000)
    }
  })
}

function processSubscriptionsPage (args) {
  const scope = {
    loading: true,
    isSignedIn: isSignedIn(),
    hasGoldAccess: hasGoldAccess(),
    hasFreeGold: hasFreeGold(),
    sessionName: getSessionName()
  }

  if (!isSignedIn()) {
    go('/signin')
    return
  }

  request({
    method: 'POST',
    url: `${endpoint2}/self/manage-subscriptions`,
    withCredentials: true,
    data: getXsollaTokenDefaults()
  }, (err, result) => {
    if (err) {
      renderError(err)
      return
    }
    scope.xsollaIframeSrc = ''
    renderContent('subscriptions-page', scope)

    scope.loading = false
    scope.legacy = !!result.legacy
    if (result.legacy) {
      scope.subscriptions = result.subscriptions
    }
    else {
      scope.xsollaIframeSrc = getXsollaIframeSrc(result.token)
      scope.hasSubscriptions = result.hasActiveSubs
    }

    renderContent('subscriptions-page', scope)
    setXsollaIframesLoading()
    pageIsReady({
      title: 'Subscriptions'
    })
  })
}

function processGoldBuyPage (args) {
  const scope = {
    loading: true
  }

  if (!isSignedIn()) {
    go('/sign-up?redirectTo=' + encodeURIComponent(window.location.pathname + window.location.search) + '&continueTo=Buy%20Gold')
    return
  }

  scope.xsollaIframeSrc = ''
  scope.isSignedIn = isSignedIn()
  scope.hasGold = hasGoldAccess()
  scope.email = session.user ? session.user.email : ''
  scope.emoji = emotes[randomChooser(emotes.length)-1]

  renderContent('gold-buy-page', scope)

  const opts = getXsollaTokenOpts()

  generateXsollaIframeSrc('gold', opts, (err, result) => {
    if (err) {
      renderError(err)
      return
    }
    scope.loading = false

    //Src is only returned if the user doesn't have legacy subscriptions
    if (result.src) {
      scope.xsollaIframeSrc = result.src
      scope.promo = result.promo
    }
    else if (result.legacy) {
      scope.legacy = true
      scope.subscriptions = result.subscriptions
    }
    else {
      renderError(new Error('An unknown token error occured'))
      return
    }

    renderContent('gold-buy-page', scope)
    setXsollaIframesLoading()
    pageIsReady({
      title: 'Buy Gold',
      description: 'Buy Monstercat Gold subscription for downloads, early streaming, shop discounts, and more.'
    })
  })
}

function getXsollaTokenOpts () {
  const opts =  {}
  const redirectTo = getCookie(COOKIES.GOLD_BUY_REDIRECT_URL)

  if (redirectTo) {
    opts.return_url = window.location.origin + redirectTo
  }

  const so = searchStringToObject()

  if (so.promo) {
    opts.code = so.promo
  }

  return opts
}

function getXsollaIframeSrc (token) {
  return `${XSOLLA_PAYSTATION_URL}?access_token=${token}`
}

function generateXsollaIframeSrc (type, opts, done) {
  generateXsollaToken(type, opts, (err, result) => {
    if (err) {
      return done(err)
    }

    if (result.legacy) {
      done(null, result)
      return
    }

    result.src = getXsollaIframeSrc(result.token)
    done(null, result)
  })
}

/**
 * Generates an xsolla token from the server that is used to render certain iframes
 * for xsolla pages
 *
 * @param {String} type The type of token. eg: 'gold', 'subscriptions'
 * @param {transactionCallback} done
 */
function generateXsollaToken (type, opts, done) {
  let data = getXsollaTokenDefaults()

  data = Object.assign(data, opts)

  if (generateXsollaToken.cache) {
    done(null, generateXsollaToken.cache)
    return
  }

  requestCached({
    method: 'POST',
    withCredentials: true,
    data: data,
    url: endpoint2 + '/xsolla/token/' + type
  }, (err, result) => {
    if (err) {
      done(err)
      return
    }

    generateXsollaToken.cache = result
    done(null, result)
  })
}

function getXsollaTokenDefaults () {
  return {
    return_url: window.location.protocol + '//' + window.location.host + '/account/gold',
    device: isXsollaMobileBrowser() ? 'mobile' : 'desktop'
  }
}

function processGoldCompoundPage (args) {
  if (!hasGoldAccess()) {
    window.location = 'http://monster.cat/goldcompoundform'
    return
  }

  renderContent('page-gold-compound', {
    email: session.user.email,
    thankYou: thankyous[randomChooser(thankyous.length)-1],
    emoji: emotes[randomChooser(emotes.length)-1]
  })
}

function processGoldPage (args) {
  processor(args, {
    start: function (args) {
      const scope = {}
      let featureBlocks = []

      featureBlocks.push({
        id: 'download-access',
        title: 'Download Access',
        description: 'Download tracks in MP3, FLAC, and WAV format.',
        image: '/img/gold-landing/1-DownloadAccess-v2.jpg',
        cta: 'Download Music',
        download: true
      }, {
        id: 'early-streaming',
        title: 'Early Streaming Access',
        description: 'Listen to releases on Monstercat.com 21 hours before they are released to everyone else.',
        cta: 'Listen Early',
        image: '/img/gold-landing/2-StreamingAccess.jpg',
      }, {
        id: 'content-creator-licenses',
        title: 'Content Creator Licenses',
        description: 'Add up to six of your channels and use our music in your content. <a href="/licensing/content-creators">More info</a>. <br>Need a commercial license? Go <a href="/sync">here</a>.',
        cta: 'Content Creator Licenses',
        image: '/img/gold-landing/ContentCreator.jpg',
      }, {
        id: 'support-the-artists',
        title: 'Support the Artists',
        description: 'Artists are paid out from Gold subscriptions based on how much people download and listen to their songs.',
        cta: 'Support the Artists',
        image: '/img/gold-landing/3-SupportArtists.jpg',
      }, {
        id: 'shop-discounts',
        title: 'Shop Perks',
        description: "Every month you have Gold you get a discount code for 10% off in our Shop. These go up to 15% off after one year and 20% off after two years.",
        cta: 'Get Discounts',
        image: 'https://assets.monstercat.com/monstercat.com/merch40.jpg?image_width=1024',
        shopDiscounts: true
      }, {
        id: 'discord',
        title: 'Gold-only Discord Chat',
        description: 'Come chat with us and other subscribers in <a href="https://discord.gg/monstercat">our Discord server</a>.',
        cta: 'Join the Chat',
        image: '/img/gold-landing/5-Discord.jpg',
        discord: true
      }, {
        id: 'reddit',
        title: 'Subreddit Flair on /r/Monstercat',
        description: 'Show your bling off in the Monstercat subreddit.',
        cta: 'Get Your Flair',
        image: '/img/gold-landing/6-Reddit.png',
        reddit: true
      })

      featureBlocks = featureBlocks.map((i, index) => {
        i.isOdd = !(index % 2 == 0)
        return i
      })
      scope.featureBlocks = featureBlocks
      scope.hasGoldAccess = hasGoldAccess()
      scope.sessionName = getSessionName()
      scope.getGoldUrl = getGetGoldLink()

      if(scope.hasGoldAccess) {
        scope.redditUsername = session.user.redditUsername
      }
      else {
        scope.redditUsername = false
      }

      renderContent(args.template, scope)
      const desc = 'Download access, early streaming, licenses, supporting the artists, shop perks, and more!'
      pageIsReady({
        description: desc,
        title: 'Monstercat Gold - Downloads, streaming, licenses, discounts'
      })

      //This preloads the token for the user so that if they click Buy the iframe
      //will load more quickly
      if (isSignedIn()) {
        generateXsollaToken('gold', getXsollaTokenOpts(), () => {})
      }
    }
  })
}

function processCotwGoldPage (args) {
  const scope = {}
  scope.hasGold = hasGoldAccess()
  scope.isSignedIn = isSignedIn()
  //HEY! No peaking. Honor System Security is in effect.
  scope.iframeSrc = 'https://docs.google.com/forms/d/e/1FAIpQLSfe2zEOYiwTk5_LJZnpw66kYZE6bPFpQs6BxeIJgFYEB7URJw/viewform?embedded=true'
  renderContent('cotw-gold-vote', scope)
  pageIsReady({
    title: 'CotW Gold Episode'
  })
}

function clickCancelLegacySubscription (e) {
  const btn = findParentWith(e.target, 'button')
  const id = btn.dataset.id

  btn.classList.toggle('on')

  requestJSON({
    url: endpoint2 + '/self/cancel-paypal/' + id,
    method: 'POST',
    withCredentials: true
  }, function (err, result) {
    if (err) {
      renderError(err)
      return
    }
    toasty('Legacy subscription canceled')
    go('/gold/buy')
  })
}

function processGoldFeedBack (args) {
  const scope = {
    reasons: [
      "I don't use its features",
      "I'm no longer interested",
      "I can't afford it",
      "I just wanted to try it",
      "Other"
    ],
    isSignedIn: isSignedIn()
  }
  renderContent('gold-feedback', scope)
}

function submitUnsubscribeFeedback (e) {
  const form = findNode('.paragraphs')

  submitForm(e, {
    validate: function (data, errs) {
      if (!data.reason) {
        errs.push('Please submit a reason')
      }
      return errs
    },
    action: function (args) {
      args.data.type = 'gold_unsub_feedback'

      requestWithFormData({
        url: 'https://submit.monstercat.com',
        method: 'POST',
        data: args.data
      }, (err, body, xhr) => {
        if (err) {
          err.push(err)
          return
        }
        toasty('Your feedback has been submitted. Thank you!')
        go('/')
      })
    }
  })
}
