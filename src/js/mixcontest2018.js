const currentPollID = '5b3fa9d9fe37f5d18dea1dd3'

let mixPoll = {}
const mixedContestScope = {}
const currentMixReleaseId = '5b3d35ea9b8d3a0a7270548c'

function processMixContest2018Page (args) {
  renderContent('mixcontest2018', mixedContestScope)
  requestJSON({
    url: endpoint + '/poll/' + currentPollID + '/breakdown'
  }, (err, result) => {
    if (err) {
      alert("error!")
      return
    }
    const status = result.status

    mixPoll = result.poll
    mixedContestScope.loading = false
    mixedContestScope.poll = mixPoll
    mixedContestScope.loggedIn = isSignedIn()
    mixedContestScope.hasVoted = status.voted
    mixedContestScope.backgroundImg = '/img/mixcontest.jpg'
    mixedContestScope.art = 'https://assets.monstercat.com/releases/covers/cotw-205.jpg?image_width=512'
    mixedContestScope.titleName = 'Mix Contest 2018'
    mixedContestScope.artists = 'Artist'

    mixedContestScope.track = {
      loading: true
    }

    mixedContestScope.cotwEpisodes = {
      loading: true
    }

    // if counting down to start date
    mixedContestScope.showStartDate = (!status.ended && !status.open) ? true : false

    // if voting is open
    mixedContestScope.votingOpen = (status.open == true) ? true : true

    // if user has voted
    status.canVote = true // to show the poll even if account has already voted
    mixedContestScope.hasVoted = (status.canVote == true) ? false : true

    renderContent('mixcontest2018', mixedContestScope)
    startCountdownTicks()

    //https://connect.monstercat.com/api/catalog/browse/?albumId=5b3d35ea9b8d3a0a7270548c
    requestJSON({
      url: endpoint + '/catalog/browse?albumId=' + currentMixReleaseId
    }, (err, result) => {
      if (err){
        toasty(Error(err))
        return
      }
      console.log(result)

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

      episodesScope.podcasts.length = 6
      betterRender('mixcontest2018-cotw-episode', cotwEl, episodesScope)
      console.log(episodesScope)
    })
  })

}

function submitMixContestVotes2018(e) {
  //prevents refresh
  e.preventDefault()
  const form = e.target
  const data = formToObject(form)

  console.log('data', data)

  const choiceIndexes = []

  data.choices.forEach((checked, index) => {
    console.log(index + ' ' + checked)
    if (checked) {
      choiceIndexes.push(index)
    }
  })

  if (choiceIndexes.length > 2){
    toasty(Error('Too many!'))
    return
  }
  if (choiceIndexes.length < 1){
    toasty(Error('Too Few!'))
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

    mixedContestScope.hasVoted = true
    renderContent('mixcontest2018', mixedContestScope)
  })
}

const checks = document.querySelectorAll('.check')
const maxChecks = 2

for (var i = 0; i < checks.length; i++){
  checks[i].onclick = selectiveCheck
}

function selectiveCheck(event) {
  const checkedChecks = document.querySelectorAll(".check:checked")

  if (checkedChecks.length >= max + 1){
    return false
  }
}

