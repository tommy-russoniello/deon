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


  google.maps.event.addDomListener(window, 'load', initLocationAutoComplete)
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
          toasty('You did it!')
          go(scope.redirectTo)
        }
        else {
          toastr(Error('Profile incomplete in session. Contact support.'))
        }
      })
    }
  })
}
