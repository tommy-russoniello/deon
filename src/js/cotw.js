function processCOTWPage (args) {
  renderContent(args.template)
  iframeHeight()
}


function processPodcastPhotoGalleryPage (args) {
  renderContent(args.template)
  onPodcastPageOpened()
}

function onPodcastPageOpened () {
  preLoadImage(makePodcastImg(1));
  preLoadImage(makePodcastImg(8));
  preLoadImage(makePodcastImg(7));
  preLoadImage(makePodcastImg(4));
  oscillatePodcastGallery();
}

function makePodcastImg(num) {
  return 'https://assets.monstercat.com/podcast/image'+num+'.jpg?image_width=1024';
}

/*
bad method is bad, the lazy programmer succeeds 
I will banhammer anyone that copies and pastes this code. Beware - Thomas
*/
function oscillatePodcastGallery (timestamp) {
  var fn = oscillatePodcastGallery;
  if (!timestamp) return requestAnimationFrame(fn);
  var delta = timestamp - (fn.last || timestamp);
  fn.total = (fn.total || 0) + delta;
  fn.last = timestamp;
  var el = document.querySelector('#podcast-oscillate');
  if (!el) return;
  var shade = el.querySelector('.banner-shade');
  var begin = 5000;
  var halfway = 6000;
  var finish = 9000;
  var norm = 0.25;
  var x = norm;
  if (fn.total > begin && fn.total <= halfway) {
    x = norm + ((fn.total - begin) / (halfway - begin) * 0.75);
    shade.style.background = 'rgba(0, 0, 0, '+x+')';
  }
  else if (fn.total > halfway) {
    x = 1 - ((fn.total - halfway) / (finish - halfway) * 0.75);
    shade.style.background = 'rgba(0, 0, 0, '+x+')';
  }
  if (fn.total - delta < halfway && fn.total >= halfway) {
    var items = [1, 8, 7, 4];
    var pick = items[Math.floor(Math.random()*items.length)]; 
    el.style.backgroundImage = 'url("'+ makePodcastImg(pick)+'")';
  }
  if (fn.total > finish) {
    fn.total = 0;
  }
  requestAnimationFrame(fn);
}

function submitPodcastGallery (e, el) {
  submitForm(e, {
    validate: function (data, errs) {
      if (!data.agree_tos) {
        errs.push('You must agree to the Terms of Service')
      }
      if (!data.file || !data.display_name || !data.social_link || !data.email) {
        errs.push('Please fill out the form')
      }
      return errs
    },
    action: function () {
      actionier.on(e.target)
      request({
        url: 'https://submit.monstercat.com',
        method: 'POST',
        data: new FormData(data)
      }, (err, body, xhr) => {
        actionier.off(e.target)
        if (err) {
          formErrors(e.target, err)
          recordErrorAndAlert(err, 'Submit Podcast Gallery')
          return
        }
        toasty('Your photo has been accepted. Thank you!')
      })
    }
  })
  return
}