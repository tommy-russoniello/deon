function toast (opts) {
  const container = findNode('[role="toasts"]')

  if (!container) {
    return
  }
  const div = document.createElement('div')

  betterRender('toast', div, opts)
  const el = div.firstElementChild
  const defaultShowTime = 3000

  container.appendChild(el)
  setTimeout(() => {
    container.removeChild(el)
  }, opts.time || defaultShowTime)
}

function toasty (obj, time) {
  if (obj instanceof Error) {
    return toast({
      error: true,
      message: obj.message,
      time: time || 5000
    })
  }
  if (typeof obj == 'string') {
    return toast({
      message: obj,
      time: time
    })
  }
  return toast(obj)
}

function terror (err) {
  if (err) {
    toasty(new Error(err))
    return true
  }

  return false
}

function renderModal (name, scope) {
  const modalContainer = findNode('[role="modals"] [role="container"]')

  betterRender(name, modalContainer, scope)
}

function openModal (name, data) {
  const modalsEl  = findNode('[role="modals"]')

  renderModal(name, data)
  findNode('body').classList.add('showing-modal')
  modalsEl.classList.add('open')
  return modalsEl
}

function closeModal () {
  var container = findNode('[role="modals"]')
  if(container != null) {
    container.classList.remove('open')
    findNode('body').classList.remove('showing-modal')
    var x = container.querySelector('[role="container"]').firstElementChild
    if(x != null) {
      x.parentElement.removeChild(x)
    }
  }
}

function togglePassword (e, el) {
  var target = 'input[name="' + el.getAttribute('toggle-target') + '"]'
  var tel    = findNode(target)
  if (!tel) return
  var type   = tel.getAttribute('type') == 'password' ? 'text' : 'password'
  var cls    = type == 'password' ? 'eye-slash' : 'eye'
  tel.setAttribute('type', type)
  var iel    = el.firstElementChild
  if (!iel) return
  iel.classList.remove('fa-eye')
  iel.classList.remove('fa-eye-slash')
  iel.classList.add('fa-' + cls)
}

function simpleUpdate (err, obj, xhr) {
  if (err) return window.alert(err.message)
  go(window.location)
}

function reloadPage () {
  go(location.pathname + location.search)
}

function toggleNav(){
  findNode("[role='nav']").classList.toggle('open')
  findNode("[role='nav-button']").classList.toggle('active')
}

function closeNav(){
  findNode("[role='nav']").classList.remove('open')
  findNode("[role='nav-button']").classList.remove('active')
}

function stickyPlayer(){
  var threshold = 150
  var el = findNode("[role='fixed']")
  window.addEventListener('scroll', function(){
    if(window.scrollY >= threshold) {
      el.classList.add('fixed');
    }
    else {
      el.classList.remove('fixed')
    }
  })
}