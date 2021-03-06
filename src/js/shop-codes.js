function requestSelfShopCodes (done) {
  requestJSON({
    withCredentials: true,
    url: endpoint2 + '/self/benefits-info'
  }, function (err, body) {
    if (err) {
      return done(err)
    }
    var obj = Object.assign({}, body, {
      gold: body.goldTime,
    })
    obj.lastCreated = obj.shopCode.created
    obj.nextCodeDate = new Date(new Date(obj.shopCode.created).getTime() + 1000 * 60 * 60 * 24 * 30)
    obj.currentCode = transformShopCode(obj.shopCode)
    done(null, obj)
  })
}

function transformShopCode (code) {
  if(code.expires) {
    code.expiresFormatted = formatDate(code.expires)
  }
  code.discountText = (parseInt(code.value) * -1) + '% off';
  if(code.rewardFor == '1month') {
    code.rewardForText = 'Gold'
  }
  else if (code.rewardFor == '1year') {
    code.rewardForText = '1+ year of Gold'
  }
  else if (code.rewardFor == '2years') {
    code.rewardForText = '2+ years of Gold'
  }
  return code
}

function transformShopCodesPage (obj, done) {
  obj = obj || {};
  obj.isGold = hasGoldAccess();

  if(!isSignedIn() || !obj.isGold) {
    return done(null, obj);
  }
  requestSelfShopCodes(function (err, result) {
    if (err) {
      done(err)
      return
    }

    Object.keys(result).forEach(function (key) {
      obj[key] = result[key];
    });

    done(err, obj);
  });
}

function completedShopCodesPage () {
  startCountdownTicks();
}