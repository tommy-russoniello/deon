function FormDataDeclare (form) {
  this.data = {}

  if (form) {
    var els = form.querySelectorAll('[name]')

    els.forEach((el) => {
      var name = el.getAttribute('name')
      var val = el.value

      if (el.getAttribute('type') == 'checkbox') {
        val = el.checked
      }

      if (el.getAttribute('type') == 'radio') {
        if (el.checked) {
          this.data[name] = val
        }
      }
      else {
        this.data[name] = val
      }
    })
  }
}

FormDataDeclare.prototype.entries = function* () {
  for (var k in this.data) {
    yield [k, this.data[k]]
  }
}

/**
 * Found at https://github.com/christianalfoni/form-data-to-object
 *
 * @arg {FormData} formData The form data to convert to an object.
 *
 * @returns {Object}
 */
function formDataToObject (formData) {
  var source = {}

  for (var pair of formData.entries()) {
    source[pair[0]] = pair[1]
  }
  return Object.keys(source).reduce((output, key) => {
    var parentKey = key.match(/[^\[]*/i)
    var paths = key.match(/\[.*?\]/g) || []

    paths = [parentKey[0]].concat(paths).map((key) => {
      return key.replace(/\[|\]/g, '')
    })
    var currentPath = output

    while (paths.length) {
      var pathKey = paths.shift()

      if (pathKey in currentPath) {
        currentPath = currentPath[pathKey]
      } else {
        currentPath[pathKey] = paths.length ? isNaN(paths[0]) ? {} : [] : source[key]
        currentPath = currentPath[pathKey]
      }
    }

    return output
  }, {})
}

/**
 * Found at https://github.com/christianalfoni/form-data-to-object
 *
 * @arg {Object} obj - The data object.
 *
 * @returns {Object}
 */
function objectToFormData (obj) {
  function recur(formData, propName, currVal) {
    if (Array.isArray(currVal) || Object.prototype.toString.call(currVal) === '[object Object]') {
      Object.keys(currVal).forEach((v) => {
        recur(formData, propName + "[" + v + "]", currVal[v])
      })
      return formData
    }

    formData.append(propName, currVal)
    return formData
  }

  var keys = Object.keys(obj)

  return keys.reduce((formData, propName) => {
    return recur(formData, propName, obj[propName])
  }, new FormData())
}

/**
* Fixes form data objects with numberic keys where some may have been removed
* This turns {data: {0: 'one', 2: 'three'}} into data {0: 'one', 1: 'three'}
* And also turns {itemOne: '1', itemEight: '1'} into ['itemOne', 'itemEight']
* @returns {Object}
*/
function fixFormDataIndexes (formData, fields) {
  fields.forEach((name) => {
    var ev = 'var value = formData.' + name

    eval(ev)

    if (value != undefined) {
      var newVal = []
      //This is for arrays that might have messed up indexes
      //this happens when nodes are deleted from the DOM
      //then FormData is used to get data

      if (value instanceof Array) {
        for (var k in value) {
          newVal.push(value[k])
        }
      }
      //
      //{gold: 1, sync: 1}
      //
      //['gold', 'sync']
      else if (typeof (value) == 'object') {
        for (var key in value) {
          if (value[key] && parseInt(value[key]) != 0) {
            newVal.push(key)
          }
        }
      }
      var set = 'formData.' + name + ' = newVal'

      eval(set)
    }
    else {
      eval('formData.' + name + ' = []')
    }
  })
  return formData
}

/**
 * Wrapper to convert form element data to object.
 *
 * @arg {Element} form The form to get data from.
 *
 * @returns {Object}
 */
function formToObject (form) {
  return formDataToObject(new FormDataDeclare(form))
}

/**
 * Wrapper for formToObject that can
 * also take a querySelector
 *
 * @param {Object|String} nodeOrSel The node or selector to find the node
 * @returns {Object}
 */
function getDataSet (nodeOrSel) {
  let node

  if (typeof nodeOrSel == 'string') {
    node = findNode(nodeOrSel)
  }
  else {
    node = nodeOrSel
  }

  return formToObject(node)
}

/**
 * A helper for submitting forms that has default functionality
 * you can override with options.
 *
 * @param {Object} e - The event object.
 * @param {Object} opts - Options.
 * @param {String} opts.successMsg - Optional message to display on success.
 * @param {Function} opts.success - Optional success function to run on success.
 * @param {Function} opts.error - Optional error function to run on erros.
 * @param {Function} opts.transformData - Optional function to transform
                                          json data object.
 * @param {Boolean} opts.formData - Optional flag to send data as FormData
                                    instead of JSON object.
 */
function submitForm (e, opts = {}) {
  e.preventDefault()
  opts.successMsg = opts.successMsg || 'Success!'

  //Default validate returns no errors
  if (!opts.validate) {
    opts.validate = () => {
      return []
    }
  }

  //Default validate returns no errors
  //This validation occurs before the transformData function happens
  if (!opts.prevalidate) {
    opts.prevalidate = () => {
      return []
    }
  }

  //The default success function just makes a notification with given message
  if (!opts.success) {
    opts.success = () => {
      if (opts.successMsg) {
        toasty(opts.successMsg)
      }
    }
  }

  //Default error adds to form and makes notification
  if (!opts.error) {
    opts.error = (err, form) => {
      formErrors(form, err)
      toasty(err)
    }
  }

  var form = e.target

  if (actionier.isOn(form)) {
    console.log('no')
    return
  }

  var data = formToObject(form)
  let errors = []

  opts.prevalidate(data, errors)
  if (typeof opts.transformData == 'function') {
    data = opts.transformData(data)
  }
  errors = opts.validate(data, errors)
  formErrors(form, errors)
  if (errors.length) {
    return
  }

  var url

  if (typeof opts.url == 'function') {
    url = opts.url(data)
  }
  else {
    url = opts.url
  }

  if (typeof opts.started == 'function') {
    opts.started(data)
  }

  function defaultAction () {
    const ropts = {
      url: url,
      data: opts.formData ? objectToFormData(data) : data,
      method: opts.method,
      withCredentials: true
    }

    actionier.on(form)
    request(ropts, (err, result) => {
      actionier.off(form)
      if (err) {
        opts.error(err, form)
        return
      }
      opts.success(result, data)
    })
  }

  const action = opts.action || defaultAction

  action({
    data: data,
    form: form
  })
}

/**
 * Helper function that prepends a list of error messages to a form.
 * It creates the error container if it doesn't exist
 *
 * @param {Object} form <form> object
 * @param {Array[Object|String]} errs Array of errors
 * @returns {Boolean} True if there are errors
 */
function formErrors (form, aErrs) {
  let errs = aErrs || []
  var errDiv = form.querySelector('[role=form-errors]')

  if (!errDiv) {
    var div = document.createElement('div')

    div.setAttribute("class", "errors-container hide")
    div.setAttribute("role", "form-errors")
    form.insertBefore(div, form.firstChild)
    return formErrors(form, errs)
  }

  if (errs.constructor != Array) {
    errs = [errs]
  }
  errs = errs.map((aErr) => {
    let err = aErr

    if (typeof (err) == 'string') {
      err = {
        msg: aErr
      }
    }
    else if (!err.hasOwnProperty('msg')) {
      err = {
        msg: aErr.toString()
      }
    }

    return err
  })
  var messages = errs.map((err) => {
    return err.msg
  })

  errDiv.innerHTML = messages.join("<br />")
  errDiv.classList.toggle('hide', errs.length == 0)

  return errs.length > 0
}

function makeFormControlFeedback (field) {
  var parent = findParentWith(field, '.form-group', false)
  var feedback = parent.querySelector('.form-control-feedback')

  if (feedback == null) {
    var div = document.createElement('div')

    div.setAttribute("class", "form-control-feedback")
    parent.appendChild(div, field)
    feedback = parent.querySelector('.form-control-feedback')
  }
  return feedback
}
