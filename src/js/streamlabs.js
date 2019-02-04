const PAGE_STREAMLABS_REGISTER = 'PAGE_STREAMLABS_REGISTER'

function processStreamlabsRegisterPage (args) {
  const redirectTo = getRedirectTo()
  const continueTo = getSignInContinueTo()

  const qo = searchStringToObject()
  const scope = {
    loading: false,
    continueTo: qo.continueTo,
    redirectTo: redirectTo,
    continueTo: continueTo
  }
  renderContent(args.template, scope)
  cache(PAGE_STREAMLABS_REGISTER, scope)

  initLocationAutoComplete()
}

function submitStreamlabsSignUp (e) {
  submitForm(e, {
    method: 'POST',
    url: endpoint2 + '/streamlabs/complete-signup',
    transformData: transformSubmittedAccountData,
    success: () => {
      const scope = cache(PAGE_STREAMLABS_REGISTER)

      loadSession(() => {
        if (!isStreamlabsIncomplete()) {
          toasty('Registration complete!')
          go(scope.redirectTo)
        }
        else {
          toastr(Error('Profile incomplete in session. Contact support@monstercat.com'))
        }
      })
    }
  })
}
