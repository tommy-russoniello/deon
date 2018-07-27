const currentPollID = '5b5b8c13560828726a39d6e8'

let mixPoll = {}
const mixContestScope = {}
const currentMixReleaseId = '5b58bdf2113df577ae16eb9e'

function processMixContest2018Page (args) {
  renderContent('mixcontest2018', mixContestScope)
  requestJSON({
    url: endpoint + '/poll/' + currentPollID + '/breakdown',
    withCredentials: true
  }, (err, result) => {
    if (err) {
      alert("error!")
      return
    }
    const status = result.status

    mixPoll = result.poll
    mixContestScope.loading = false
    mixContestScope.poll = mixPoll
    mixContestScope.loggedIn = isSignedIn()
    mixContestScope.hasVoted = status.voted
    mixContestScope.backgroundImg = '/img/mixcontest.jpg'
    mixContestScope.art = 'https://assets.monstercat.com/releases/covers/cotw-205.jpg?image_width=512'
    mixContestScope.titleName = 'Mix Contest 2018'
    mixContestScope.artists = 'Artist'

    mixContestScope.track = {
      loading: true
    }

    mixContestScope.cotwEpisodes = {
      loading: true
    }

    // if counting down to start date
    mixContestScope.showStartDate = (!status.ended && !status.open)

    // if voting is open
    mixContestScope.hasVoted = status.voted
    mixContestScope.votingOpen = status.open
    mixContestScope.canVote = status.canVote

    renderContent('mixcontest2018', mixContestScope)
    startCountdownTicks()

    //https://connect.monstercat.com/api/catalog/browse/?albumId=5b3d35ea9b8d3a0a7270548c
    requestJSON({
      url: endpoint + '/catalog/browse?albumId=' + currentMixReleaseId
    }, (err, result) => {
      if (err){
        toasty(Error(err))
        return
      }

      const tracks = transformTracks(result.results)
      const trackEl = findNode('[role="mixcontest2018-track"]')
      const background =  '/img/mixcontest.jpg'

      betterRender('mixcontest2018-track', trackEl, {
        loading: false,
        data: tracks[0]
      })
    })

    //endpoint/catalog/release?filters=type,Podcast&limit=8

    requestJSON({
      url: endpoint + '/catalog/release?filters=type,Podcast&limit=8'
    }, (err, result) => {
      if (err){
        toasty(Error(err))
        return
      }
      const cotwEl = findNode('[role="mixcontest-cotw-episodes"]')

      const episodesScope = {
        loading: false,
        podcasts: result.results.map(mapRelease),

      }
      betterRender('mixcontest2018-cotw-episode', cotwEl, episodesScope)
    })
  })

}

function submitMixContestVotes2018(e) {
  //prevents refresh
  e.preventDefault()
  const form = e.target
  const data = formToObject(form)

  const choiceIndexes = []

  data.choices.forEach((checked, index) => {
    if (checked) {
      choiceIndexes.push(index)
    }
  })

  if (choiceIndexes.length > 2){
    toasty(Error('Too many!'))
    return
  }
  if (choiceIndexes.length < 1){
    toasty(Error('Too few!'))
    return
  }

  request({
    url: endpoint + '/vote',
    method: 'POST',
    withCredentials: true,
    data: {
      pollId: currentPollID,
      choices: choiceIndexes
    }
  }, (err, result) => {
    if (err) {
      toasty(err)
      return
    }

    toasty("Success, your vote has been submitted.")

    go('/mixcontest2018')
  })
}

