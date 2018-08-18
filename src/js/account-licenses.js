const LICENSE_STATES = {
  AUTO: 0,
  ENFORCED: 1,
  BLACKLISTED: 2
}

function processAccountLicensesPage (args) {
  if (!isSignedIn()) {
    return go('/signin?redirect=' + encodeURIComponent(window.location.pathname + window.location.search) + '&continueTo=Licenses')
  }

  pageProcessor(args, {
    transform: function (args) {
      return {
        licenses: args.result.results.map(transformLicense),
        hasGoldAccess: hasGoldAccess(),
        isSignedIn: isSignedIn()
      }
    },

    completed: function () {
      const qs = searchStringToObject()

      if (qs.vendor) {
        findNode('[name=vendor]').value = qs.vendor
      }
      if (qs.identity) {
        findNode('[name=identity]').value = qs.identity
      }

      var empty = findNode("[role='no-licenses")

      if (args.result.total == 0){
        empty.classList.add("empty")
      }

      const addLicenseBtn = findNode('#license-add-btn')

      const addLicenseForm = findNode('.license-form')

      const channelToggle = findNode('.add-channel')

      function toggleAddLicense() {
        addLicenseForm.classList.toggle("license-form-display")
        addLicenseBtn.classList.toggle("icon-toggle")
      }
      if (addLicenseBtn) {
        addLicenseBtn.addEventListener("click", toggleAddLicense)
      }
    }
  })
}

function transformLicense (license) {
  if (license.state == LICENSE_STATES.ENFORCED) {
    license.statusMessage = 'Free whitelist'
    license.icon = 'thumbs-o-up'
  }
  else if (license.state == LICENSE_STATES.AUTO) {
    if (hasGoldAccess()) {
      license.statusMessage = 'Good to Go'
      license.icon = 'check'
    }
    else {
      license.statusMessage = 'Good for certain dates'
      license.icon = 'calendar-check-o'
      license.showDates = true  
    }
  }
  else if (license.state == LICENSE_STATES.BLACKLISTED) {
    license.statusMessage = 'Ineligible for whitelist.'
    license.icon = 'exclamation-triangle'
    license.blacklisted = true
  }

  license.clickDateRanges = true
  license.viewLicenseUrl = endpoint + '/self/whitelist-license/' + license.identity

  let prev
  let cutoff = 12 * 60 * 60 * 1000 //12 hours
  license.readableTimeRanges = license
    .timeRanges.sort((a, b) => {
      return new Date(a.start) < new Date(b.start) ? -1 : 1
    })
    .reduce((dates, tr, index) => {
      const endDate = new Date(tr.finish || tr.end)
      const startDate = new Date(tr.start)

      if (dates.length > 0) {
        let prev = dates[dates.length - 1]
        const diff = startDate.getTime() - prev.finish.getTime()
        if (diff < cutoff && diff > 0) {
          dates[dates.length-1].finish = endDate
          return dates
        }
      }

      if (endDate && endDate.toString() != "Invalid Date") {
        for (var i = 0; i < dates.length; i++) {
          if (dates[i].start == startDate && dates[i].finish == endDate) {
            return dates
          }
        }
        dates.push({
          start: startDate,
          finish: endDate
        })
      }

      return dates
    }, [])
    .reduce((strings, tr) => {
      const str = formatDate(tr.start) + ' to ' + formatDate(tr.finish)
      if (strings.indexOf(str) == -1) {
        strings.push(str)
      }

      return strings
    }, [])

  return license
}

function submitAddLicense (e, el) {
  submitForm(e, {
    url: endpoint + '/self/whitelist',
    method: 'POST',
    cors: true,
    transform: (data) => {
      data.identity = serviceUrlToChannelId(data.identity)
      return data
    },
    validate: (data, errs) => {
      let suspicous = false
      var confirmBox = findNode('.confirm')
      if (!data.category) {
        errs.push('Please select what category your channel is in')
      }
      if (data.category == 'music') {
        suspicous = true
        errs.push('Music channels are not eligible for Content Creator licenses.')
      }
      else if (data.category == 'commercial') {
        suspicous = true
        errs.push('Commercial usage requires a <a href="/sync">Commercial License</a>')
      }
      if (!data.confirm && data.identity) {
        suspicous = true
        errs.push('Please confirm that you are the owner of this channel')
        confirmBox.classList.remove('hide')
      }

      if (data.identity && suspicous) {
        requestWithFormData({
          url: 'https://submit.monstercat.com',
          method: 'POST',
          data: Object.assign({}, data, {type: 'suspicious_license', userId: session.user._id, confirmOwner: !data.confirm})
        }, () => {})
      }
      console.log('errs',errs)
      return errs
    },
    success: (result) => {
      result = transformLicense(result)
      var tbody = findNode('tbody')
      var node = document.createElement('tr')
      var card = findNode('.license-cards')
      var cardNode = document.createElement('div')
      var form = findNode("[role='form-submit']")
      var empty = findNode("[role='no-licenses']")
      var emptyCard = findNode('.card-msg')
      var confirmBox = findNode('.confirm')

      node.setAttribute("data-whitelist-id", result._id)
      node.setAttribute("role", "whitelist-panel")
      render("license-table-row", result, node)
      render("license-card-row", result, cardNode)
      tbody.appendChild(node)
      card.appendChild(cardNode)
      confirmBox.classList.add('hide')
      form.reset()
      toasty("License succesfully added! Please wait up to 48 hours.")
      if (tbody.children.length >= 1){
        empty.classList.remove("empty")
        emptyCard.classList.remove("empty")
      }
    }
  })
}

function clickShowLicenseDateRanges (e, el) {
  const tr = findParentWith(e.target, '[data-id]')
  const tbody = findParentWith(tr,'tbody')

  request({
    url: endpoint + '/self/whitelist/' + tr.dataset.id,
    withCredentials: true
  }, (err, result) => {
    if (err) {
      toasty(Error(err))
      return
    }

    const x = findNode("[data-id='" + tr.dataset.id + "'][role='date-ranges']")
    const y = findNode("[data-id='" + tr.dataset.id + "'][role='carddate-ranges']")

    x.classList.toggle("display-dates")
    y.classList.toggle("display-dates")
    tr.classList.toggle("state-status")
    const license = transformLicense(result)
  })
}

function onClickDeleteWhitelist(e, el) {
  if (prompt("Type DELETE to remove this channel") != 'DELETE') {
    return
  }

  const table = findParentWith(e.target, 'table')
  const btn = findParentWith(e.target, 'button')

  btn.classList.add("on")
  btn.disabled = true
  request({
    url: endpoint + '/self/whitelist/' + btn.dataset.id,
    method: 'DELETE',
    withCredentials: true
  }, (err, result) => {
    btn.classList.remove("on")
    if (err) {
      toasty(new Error(err))
      return
    }

    const xs = findNodes("[data-whitelist-id='" + btn.dataset.id + "'][role='whitelist-panel']")
    const empty = findNode("[role='no-licenses']")
    const emptyCard = findNode('.card-msg')

    xs.forEach((x) => {
      x.parentElement.removeChild(x)
    })
    toasty("License successfully removed!")

    var tbody = findNode('tbody', table)

    console.log('tbody', tbody.children.length)

    if (tbody.children.length == 1) {
      empty.classList.add("empty")
      emptyCard.classList.add("empty")
    }
  })
}

