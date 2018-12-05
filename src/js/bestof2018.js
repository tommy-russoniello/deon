const BESTOF2018_POLLID = '5bedbcfaec51c7d730efe9de'

const pollEndpoint = endpoint //'http://localhost:4002'

const PAGE_BESTOF2018 = 'page-best-of-2018'

function processBestOf2018ResultsPage (args) {
  const scope = {
    loading: true,
    error: null
  }

  renderContent('best-of-2018-results', scope)

  request({
    url: endpoint + '/doublepoll/' + BESTOF2018_POLLID + '/results',
    withCredentials: true
  }, (err, result) => {
    scope.loading = false

    if (err) {
      scope.error = err
    }
    else {
      result.results = result.results || []
      //Show maximum of 40
      if (result.results.length > 40) {
        result.results = result.results.splice(0, 40)
      }

      scope.data = result

      if (result.breakdown.status.hasVoted) {
        const tweet = getVotedForTweet(result.breakdown)
        scope.data.tweetUrl = getVotedForTweetIntentUrl(tweet)
      }
    }

    renderContent('best-of-2018-results', scope)
  })
}

function getVotedForTweetIntentUrl (tweet) {
  return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet);
}

function getVotedForTweet (breakdown) {
  if(!breakdown.status.hasVoted) {
    return false
  }

  let usernames = breakdown.userVotes.map((opt) => {
    return opt.parentOption.meta.twitterName.split(' + ').join('+')
  })

  var tweet = 'My @Monstercat Best of 2018 artists are ' + usernames.join(', ')

  var link = 'https://monstercat.com/bestof2018';
  if(tweet.length + link.length < 281) {
    tweet += ' ' + link;
  }

  var hashtag = ' #McatBestof2018'
  if(tweet.length + hashtag.length <= 280) {
    tweet += hashtag;
  }

  if (breakdown.userVotes.length > 1 && tweet.length <= 276) {
    const last = usernames[usernames.length - 1]
    const penultimate = usernames[usernames.length - 2]
    const replace = penultimate + ', ' + last

    const oxford = usernames.length >= 3 ? ',' : ''

    tweet = tweet.replace(replace, penultimate + oxford + ' and ' + last)
  }

  return tweet;
}

function processBestOf2018Page () {
  const scope = {
    loading: true,
    error: null,
  }

  renderContent('best-of-2018', scope)

  request({
    url: endpoint + '/doublepoll/' + BESTOF2018_POLLID,
    withCredentials: true
  }, (err, result) => {
    scope.loading = false

    if (err) {
      scope.error = err.toString()
      scope.data = {}
    }
    else {
      const status = result.status
      const artistOptions = result.parentOptions.map((option) => {
        return option
      })

      const end = new Date(result.poll.endTime)

      if (end > new Date()) {
        go('/bestof2018/results')
        return
      }

      scope.data = result
      scope.data.isSignedIn = isSignedIn()
      scope.data.artistOptions = artistOptions
      scope.data.status.open = status.started && !status.ended
      scope.data.votingCloseDate = end.toLocaleDateString('en-us', {month: 'short', year: 'numeric', day: 'numeric'})
      scope.data.votingCloseTime = end.toLocaleTimeString('en-us', {timeZoneName: 'short', minute: 'numeric', hour: 'numeric'})
    }

    cache(PAGE_BESTOF2018, scope)
    renderContent('best-of-2018', scope)
  })
}

function filterBestOf2018Artists(e, input){
  const filterSearch = filterNormalize(findNode('[role="artist-filter"]').value)
  const artistRows = findNodes('.bestof2018-search-result')
  let count = 0

  artistRows.forEach((row)=>{
    if (row.id == "bestof2018-no-results") {
      return
    }
    const nameEl = row.querySelector('.artist-name-search')
    const name = filterNormalize(nameEl.innerText)
    const found = name.indexOf(filterSearch) >= 0

    row.classList.toggle('hide', !found)
    if (found) {
      count++
    }
  })
  findNode("#bestof2018-no-results").classList.toggle('hide', count)
}

function bestOf2018FilterKeydown(e) {
  var key = e.charCode || e.keyCode || 0
  const filterSearch = findNode('[role="artist-filter"]').value

  if (key == 13) {
    e.preventDefault()
    if (filterSearch == "") {
      return
    }
    const artistRows = findNodes('.bestof2018-search-result:not(.hide)')

    artistRows[0].click()
  }
}

function openBestOfArtistModal (e, el, rank) {
  e.preventDefault()
  const picksEl = findNode('#bestof2018-picks')
  const key = el.dataset.optionId
  const template = 'add-artist-track'

  const bestof2018scope = cache(PAGE_BESTOF2018)

  const options = bestof2018scope.data.childOptions[key]
  const artist = bestof2018scope.data.parentOptions.find(x => x._id == key)

  if (!options) {
    toasty(Error('An error occurred, there was an issue with the poll.'))
    return
  }
  openModal(template, {
    "options": options,
    "optionId": key,
    "position": rank,
    artistName: artist.title,
    buttonLabel: rank ? 'Update': 'Add'
  })
}

function openAddBestOfArtistModal (e, el, rank) {
  const picksEl = findNode('#bestof2018-picks')
  const key = el.dataset.optionId

  /*if (picksEl.childElementCount > 10) {
    toasty(Error("You have already selected 10 artists."))
    return
  }*/

  for (var i = 0; i < picksEl.childElementCount; i++) {
    if (picksEl.children[i].classList.contains(key)) {
      toasty(Error("You have already selected this artist."))
      return
    }
  }
  openBestOfArtistModal(e, el, rank)
  return
}

function onSubmitArtistTrack(e, el) {
  e.preventDefault()
  var fd = formToObject(e.target)
  const parentOptionId = fd.parentId
  const childOptionId = fd.pollTrackId
  const bestof2018scope = cache(PAGE_BESTOF2018)
  const bestof2018data = bestof2018scope.data

  var artistOption = bestof2018data.parentOptions.find((parentOption) => {
    return parentOption._id == parentOptionId
  })

  if (!artistOption) {
    toasty(Error('Could not find artist info'))
    return
  }

  var trackOption = bestof2018data.childOptions[artistOption._id].find((option) => {
    return option._id == childOptionId
  })

  var picksEl = findNode('#bestof2018-picks')
  var example = findNode('.example-row')
  var input = findNode('[role="artist-filter"]')
  var rank = parseInt(fd.position) || picksEl.childElementCount

  var li = render('bestof2018-row', {
    artistName: artistOption.title,
    songName: trackOption.title,
    artistImg: artistOption.image + "?image_width=256",
    albumArt: trackOption.image + "?image_width=1024",
    ranking: rank,
    _id: artistOption._id,
    parentOptionId: artistOption._id,
    childOptionId: trackOption._id
  })

  if (fd.hasOwnProperty("position")){
    // offset by one because of example li
    picksEl.children[rank].replaceWith(li.firstElementChild)
    toasty("Updated track.")
    closeModal()
  }
  else {
    picksEl.appendChild(li.firstElementChild)
    example.classList.toggle('hide', true)
    toasty("Added artist track.")
    input.value = ""
    filterBestOf2018Artists()
    input.scrollIntoView()
    input.focus()
    closeModal()
  }

}

function onRemoveArtist(e, el){
  e.preventDefault()
  if (confirm("Remove artist from your list?")){
    const artistLi = findParentWith(e.target, 'li')
    const parent = artistLi.parentElement

    artistLi.parentElement.removeChild(artistLi)
    toasty("Removed artist from list.")
    if (parent.childElementCount == 1) {
      findNode('.example-row').classList.toggle('hide', false)
    }
  }
}

function submitBestOf2018 (e) {
  e.preventDefault()
  const picksEl = findNode('#bestof2018-picks')
  let data = formToObject(picksEl)

  data = fixFormDataIndexes(data, ['parentOptionIds', 'childOptionIds'])

  if (!data.parentOptionIds.length) {
    toasty(Error('No artists selected.'))
    return
  }

  const votes = data.parentOptionIds.map((parentId, idx) => {
    return {
      parentOptionId: parentId,
      childOptionId: data.childOptionIds[idx]
    }
  })

  const numVotes = votes.length
  if (votes.length < 10) {
    if (!confirm("Only submit " + numVotes + ' vote' + (numVotes == 1 ? '' : 's') + '? You can submit up to 10.')) {
      return
    }
  }

  if (numVotes > 10) {
    toasty(new Error('Maximum 10 selections allowed. Try to narrow it down!'))
    return
  }

  request({
    method: 'POST',
    url:  endpoint + '/doublepoll/' + BESTOF2018_POLLID + '/vote',
    data: {
      votes: votes
    },
    withCredentials: true
  }, (err, result) => {
    if (err) {
      toasty(new Error(err))
      return
    }
    toasty('Successfully submitted your votes!')
    go('/bestof2018/results')
  })
}
