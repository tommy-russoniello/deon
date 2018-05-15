var humblePromoName = 'Humble Streamer Bundle March 2017'
function processHumbleBundleRedeemPage (args) {
  loadSession((err, sess) => {
    const obj = {}

    obj.showSignInStep = true
    obj.showGoldStep = false
    obj.showTwitchStep = false
    obj.isSignedIn = isSignedIn()
    obj.doneSignInStep = obj.isSignedIn
    obj.doneGoldStep = hasGoldAccess()
    obj.doneTwitchStep = false
    if(obj.doneSignInStep) {
      obj.showGoldStep = true
    }
    if(obj.doneGoldStep) {
      obj.showTwitchStep = true
    }
    obj.signInUrl = '/signin?redirect=' + encodeURIComponent('/humble')
    obj.signUpUrl = '/sign-up?redirect=' + encodeURIComponent('/humble')

    if(obj.showTwitchStep) {
      //Fetch this user's whitelists
      requestJSON({
        url: endpoint + '/self/whitelist/used-promo/' + encodeURIComponent(humblePromoName),
        withCredentials: true
      }, (err, resp) => {
        if (terror(err)) {
          renderContent(args.template, obj)
          return
        }
        obj.doneTwitchStep = resp.used
        renderContent(args.template, obj)
      })
    }
    else {
      renderContent(args.template, obj)
    }
  })
}

function transformHumbleBundleRedeemPage (obj, done) {

}

function submitHumbleTwitch (e, el) {
  submitForm(e, {
    validate: function (data, errs) {
      if (!data.username) {
        errs.push('Username required')
      }

      return errs
    },
    transformData: function (data) {
      data.promo = humblePromoName
      data.vendor = "Twitch"
      data.identity = data.username
      return data
    },
    url: endpoint + '/self/whitelist/redeem-via-trial-code',
    method: 'POST',
    success: function () {
      toasty('License created! Redirecting...')
      go('/account/services')
    }
  })
}