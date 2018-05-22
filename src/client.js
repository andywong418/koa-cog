// Generate random ID and use it in header per stream.
function u8tohex (arr) {
  var vals = [ '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f' ]
  var ret = ''
  for (var i = 0; i < arr.length; ++i) {
    ret += vals[(arr[i] & 0xf0) / 0x10]
    ret += vals[(arr[i] & 0x0f)]
  }
  return ret
}

function MonetizerClient (opts) {
  this.url = (opts && opts.url) || window.location.origin
  this.streamServerUrl = (opts && opts.streamServerUrl) || '__cog-monetizer/:id'
  this.streamUrl = this.url + this.streamServerUrl
  this.start = () => {
    const idBytes = new Uint8Array(16)
    crypto.getRandomValues(idBytes)
    const id = u8tohex(idBytes)
    const streamUrl = this.streamUrl.replace(/:id/, id)
    // Throw in some headers
    const headers = new Headers({
      'Pay-Token': id,
      'Stream-Payment': true
    })
    // Fetch destinationAccount and sharedSecret first.
    fetch(streamUrl, {
      headers
    })
      .then(function (response) {
        return response.json()
      })
      .then(async (jsonResp) => {
        const { destinationAccount, sharedSecret, itemPrice } = jsonResp
        const connection = await window.monetize.createConnection({
          destinationAccount,
          sharedSecret
        })
        const stream = connection.createStream()
        stream.sendTotal(Infinity)
      })
  }
}
