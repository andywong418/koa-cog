const { createServer } = require('ilp-protocol-stream')
const getIlpPlugin = require('ilp-plugin')
const fs = require('fs-extra')
const path = require('path')
const pathToRegexp = require('path-to-regexp')
const CogAccountant = require('./cog-accountant')
class KoaCogMonetization {
  constructor (opts) {
    this.connected = false
    this.accountants = new Map()
    this.connections = new Map()
    this.plugin = (opts && opts.plugin) || getIlpPlugin()
    // this.streamUrl = (opts && opts.streamUrl) || '__cog-monetizer/:id'
    this.clientFilePath = (opts && opts.clientFilePath) || '__cog-monetizer/client.js'
  }

  async connect () {
    if (this.connected) return
    this.connected = true
  }

  async receiveStream (ctx, next, itemPrice, file) {
    // Check for pay token, check for stream, and application index
    if (ctx.request.headers['Pay-Token'] && ctx.request.headers['Stream-Payment']) {
      // This is a Paid API end point. Send back payment details and populate the ctx.stream for this route.
      const id = ctx.request.headers['Pay-Token']
      if (this.connections.get(id)) {
        // Stream already exists don't create a new one
      } else {
        const server = await createServer()
        const { destinationAccount, sharedSecret } = server.generateAddressAndSecret()
        const segments = destinationAccount.split('.')
        const resultAccount = segments.slice(0, -2).join('.') +
          '.' + id +
          '.' + segments.slice(-2).join('.')

        ctx.set('Content-Type', 'application/spsp+json')
        ctx.body = {
          destination_account: resultAccount,
          shared_secret: sharedSecret.toString('base64'),
          itemPrice
        }
        server.on('connection', connection => {
          // Set the connection into this.connections. Create accountant for this connection
          this.connections.set(id, connection)
          const newAccountant = new CogAccountant({ plugin: this.plugin, connection, itemPrice })
          this.accountants.set(id, newAccountant)
          ctx.accountant = newAccountant
          // Request payment through stream data.
          // Do some calculation on file.
        })
      }
    }
  }
  mount () {
    return async (ctx, next) => {
      this.receiveStream(ctx, next)
      if (ctx.request.url === this.clientFilePath) {
        ctx.body = await fs.readFile(path.resolve(__dirname, 'client.js'))
      }
    }
  }
}
