/*==================================
=            PROCESSORS            =
==================================*/

function processBlogPagination (args) {
  pageProcessor(args, {
    transform: function (args) {
      const q = searchStringToObject()

      return {
        page: parseInt(q.page) || 1,
        tag: args.matches[1]
      }
    }
  })
}

function processBlogPage (args) {
  templateProcessor('blog-page', args, {
    transform: function (args) {
      const obj = args.result
      const maxExcerpt = 200

      setPagination(obj, obj.limit)

      obj.results = obj.results.map((i, index, arr) => {
        const date = new Date(i.date)

        i.featured = (index == 0 && !obj.tag) ? true : false
        i.date = formatDate(i.date)
        i.isOdd = !(index % 2 == 0)
        i.excerpt = transformExcerptToText(i.excerpt)
        i.excerpt = (i.excerpt.length > maxExcerpt) ? i.excerpt.substr(0, maxExcerpt) + '...' : i.excerpt
        i.image = transformLegacyImages(i.image)
        i.url = i.path.split('/')[1].slice(0, -3) // remove 'posts/' and '.md'
        i.link = '/blog/' + date.getFullYear()
          + '-'
          + zeroPad(date.getMonth() + 1, 2)
          + '-' +
          zeroPad(date.getDate(),2)
          + '/' + i.url

        return i
      })

      if (obj.total > 1) {
        obj.showPagination = true
      }

      return obj
    },
    completed: (args) => {
      let title, description
      const tag = args.result.tag

      if (tag) {
        title = tag + ' Posts'
        description = 'Monstercat ' + tag + ' blog and news.'
      }
      else {
        title = 'Blog'
        description = 'Monstercat blog and news.'
      }

      if (args.result.page > 1) {
        title += ' - Page ' + args.result.page
      }

      pageIsReady({
        title: title,
        description: description
      })
    }
  })
}

function processBlogPostPage (args) {
  let withCredentials, url, preview

  const uri = args.matches[2]

  if (args.matches[1] == 'preview') {
    cors = true
    withCredentials = true
    preview = true
    url = endpoint + '/blog/drafts/' + uri
  }
  else {
    preview = false
    url = newshost + '/json/posts/' + uri + '.json'
    cors = false
    withCredentials = false
  }

  request({
    url: url,
    withCredentials: withCredentials,
    cors: cors
  }, (err, result) => {
    if (err) {
      renderContent(args.template, {
        err: err
      })
      return
    }

    const post = transformPost(preview ? result.meta : result)


    if (args.matches[1] == 'preview') {
      markdownUrl = endpoint + '/blog/drafts/' + args.matches[2]
    }
    else {
      markdownUrl = newshost + '/' + result.path
    }

    renderContent(args.template, {
      data: post,
      preview: preview,
      markdownUrl: markdownUrl,
      markdownCors: cors
    })

    var meta = {
      'title': post.title + ' - Blog',
      'description': transformExcerptToText(post.excerpt),
      'og:type': 'article',
      'og:image': post.image
    }

    primePageIsReady(meta, 'markdown_post')
    scrollToHighlightHash()
  })
  return
}

function transformPost (post) {
  const obj = Object.assign({}, post)

  obj.date = formatDate(new Date(obj.date))
  obj.image = transformLegacyImages(obj.image)
  obj.url = window.location.href
  return obj
}

function openShare(e, el){
  var options = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,'
  var networks = {
    facebook: { width: 600, height: 300 },
    twitter: { width: 600, height: 254 }
  }
  var network = el.dataset.share

  if (network) { window.open(el.dataset.href, '', options + 'height=' + networks[network].height + ',width=' + networks[network].width) }
  e.preventDefault
  return false
}

function processMarkdownPost (args) {
  templateProcessor('markdown-post', args, {
    transform: function (args) {
      if (args.result && args.result.content) {
        return marked(args.result.content)
      }
      return marked(args.result)
    },
    completed: completedMarkdownPost
  })
}

function completedMarkdownPost () {
  var twitterEmbeds = findNode('.twitter-tweet')
  var redditEmbeds = findNode('.reddit-embed')

  if (twitterEmbeds){
    var twitterJs = document.createElement('script')

    twitterJs.src = 'https://platform.twitter.com/widgets.js'
    document.getElementsByTagName('head')[0].appendChild(twitterJs)
  }
  if (redditEmbeds){
    var redditJs = document.createElement('script')

    redditJs.src = 'https://www.redditstatic.com/comment-embed.js'
    document.getElementsByTagName('head')[0].appendChild(redditJs)
  }

  pageStageIsReady('markdown_post')
}

function transformExcerptToText (htmlExcerpt) {
  var aux = document.createElement('div')

  aux.innerHTML = htmlExcerpt
  return aux.textContent || aux.innerText || ""
}
function transformLegacyImages (img) {
  if (!img) {
    return img
  }
  return (img.indexOf('http') == -1) ? 'https://www.monstercat.com' + img : img
}
