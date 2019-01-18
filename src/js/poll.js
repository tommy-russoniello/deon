function processMixContestPage (args) {
  const obj = {}

  obj.pollId = '58598b657ee1060824844edc'
  renderContent(args.template, obj)
}

function transformVotesBreakdown (obj){
  var votes = obj
  obj = {}
  obj.votes = votes
  return obj
}

function processMixContestPoll (args){
  templateProcessor('mix-contest', args, {
    success: function (args) {
      const obj = {}

      obj.audioLink = 'https://s3.amazonaws.com/data.monstercat.com/blobs/4fdf34f9d1729db933a191cf34ed6dcd37adc7a7'
      obj.tournamentImage = '/img/tournament-final.jpg'
      obj.startDate = new Date('2016-12-20T21:30:00Z') // UTC = PST + 8
      obj.endDate = new Date('2016-12-24T02:00:00Z') // UTC = PST + 8

      var today = new Date()
      obj.votingOpen = obj.endDate > today && obj.startDate < today
      obj.cover = "/img/mixcontest.jpg"

      var choices = []
      for (var i = 0; i < args.result.choices.length; i++) {
        choices.push({
          'index': i,
          'choice': args.result.choices[i]
        })
      }
      obj.choices = choices
      renderContent(args.template, obj)
    }
  })

}

function pollCountdownEnd () {
  loadSubSources(document.querySelector('[role="content"]'), true)
}

function createVote (e, el) {
  if (!isSignedIn()) 
    return toasty(Error('You need to <a href="/signin">sign in</a> to vote (it\'s free).'), 3000)

  var data = getTargetDataSet(el)
  if (!data || !data.pollId)
    return toasty(Error('There was an error. Please try again later.'))
  choices = []
  for (var i = 0; i<data["choices[]"].length; i++){
    var value = data["choices[]"][i]
    if (value) {
      var index = value.replace('choice-', '')
      choices.push(index)
    }
  }
  var maxChoices = parseInt(data.maxChoices);
  var minChoices = parseInt(data.minChoices);
  if (choices.length > maxChoices)
    return toasty(Error('You may only select up to ' + maxChoices + ' choices.'))

  if(choices.length < minChoices)
    return toasty(Error('You need to select at least ' + minChoices + ' choices.'))

  requestJSON({
    url: endpoint2 + '/vote',
    method: 'POST',
    data: {
      pollId: data.pollId,
      choices: choices
    },
    withCredentials: true
  }, function (err, obj, xhr) {
    if (err) return toasty(Error(err.message))
    else {
      toasty("Success, your vote has been submitted.")
      el.classList.add('already-voted')
      el.innerHTML = 'Thank you!'

      var choicesEl = getDataSetTargetElement(el)
      choicesEl.classList.add('already-voted')
    }
  })
}

