const PAGE_SLOBS_AUTH = 'page-slobs-auth'

function processSLOBSAuthPage (args) {
  const qo = searchStringToObject()
  const scope = {
    isSignedIn: isSignedIn(),
    loading: false,
    jwt: qo.jwt
  }

  if (!qo.jwt) {
    scope.error = Error('JWT is required')
  }

  renderContent(args.template, scope)
  cache(PAGE_SLOBS_AUTH, scope)

  console.log('qo', qo)

  if (isSignedIn()) {
    console.log(`i am logged in`)
    finishSLOBSAuth()
  }
}

function finishSLOBSAuth () {
  const qo = searchStringToObject()

  const scope = cache(PAGE_SLOBS_AUTH)
  scope.loading = true
  renderContent('slobs-auth-page', scope)

  getSession(function (err, sess) {
    if (err) {
      alert(err)
      scope.error = err
      scope.loading = false
      renderContent('slobs-auth-page', scope)
      return
    }
    window.location.replace('slobs-oauth://done')
    return
    /*
    requestJSON({
      url: endpoint + '/streamlabs/link?jwt=' + qo.jwt,
      withCredentials: true,
      method: 'POST'
    }, (err) => {
      if (err) {
        alert(err)
        scope.error = err
        scope.loading = false
        renderContent('slobs-auth-page', scope)
        return
      }
    })
    */
  })
}

function onSLOBSSocialSignIn (err, status) {
  if (status == 303) {
    const scope = cache(PAGE_SLOBS_AUTH)
    scope.error = Error("There is no Monstercat.com associated with that social login")
    renderContent('slobs-auth-page', scope)
  }
  else {
    finishSLOBSAuth()
  }
}

function clickSLOBSSignInFacebook () {
  signInFacebook(onSLOBSSocialSignIn);
}

function clickSLOBSSignInGoogle () {
  signInGoogle(onSLOBSSocialSignIn);
}