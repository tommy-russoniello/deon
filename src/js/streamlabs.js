const PAGE_STREAMLABS_REGISTER = 'PAGE_STREAMLABS_REGISTER'

function processStreamlabsRegisterPage (args) {
  const continueTo = getSignInContinueTo()

  const qo = searchStringToObject()
  const scope = {
    loading: false,
    continueTo: continueTo
  }
  renderContent(args.template, scope)
  cache(PAGE_STREAMLABS_REGISTER, scope)

  initLocationAutoComplete()
}

function submitStreamlabsSignUp (e) {
  submitForm(e, {
    method: 'POST',
    url: endpoint + '/streamlabs/complete-signup',
    transformData: transformSubmittedAccountData,
    success: () => {
      const scope = cache(PAGE_STREAMLABS_REGISTER)

      loadSession(() => {
        if (!isStreamlabsIncomplete()) {
          toasty('Registration complete!')
          go(scope.continueTo.url)
        }
        else {
          toastr(Error('Profile incomplete in session. Contact support@monstercat.com'))
        }
      })
    }
  })
}
