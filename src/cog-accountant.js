const IlpPacket = require('ilp-packet')
const EventEmitter = require('events')
const debug = require('debug')('ilp-cog-accountant')

class CogAccountant extends EventEmitter {
  constructor ({
    plugin,
    connection,
    itemPrice
  }) {
    super()
    this.connection = connection
    this.plugin = plugin
    // Add to balance on money received. Subtract when sending out packets or serving data (money in the balance is essentially used to pay for the piece of data.)
    this.balance = 0
    this.streamConnect = false
    if (!this.streamConnect) {
      this.connection.on('stream', stream => {
        // Set receiveMax here.
        this.streamConnect = true
        stream.setReceiveMax(itemPrice)
        stream.on('money', amount => {
          this.balance += amount
        })
      })
    }
  }

  // we have this so the accountant can be used as a plugin
  async sendTransfer () {}
  async connect () {}
  async awaitBalance (amount) {
    debug('awaiting balance. amount=' + amount)

    if (this.balance >= amount) return
    return new Promise(resolve => {
      const handleNewBalance = (newBalance) => {
        if (newBalance >= amount) {
          setImmediate(() => this.removeListener('_balance', handleNewBalance))
          resolve()
        }
      }
      this.on('_balance', handleNewBalance)
    })
  }

  async sendData (data) {
    // Default
    const parsedRequest = IlpPacket.deserializeIlpPacket(data)
    if (parsedRequest.type === IlpPacket.Type.TYPE_ILP_PREPARE) {
      debug('sending prepare. amount=' + parsedRequest.data.amount)
      await this.awaitBalance(parsedRequest.data.amount)
      this.balance -= parsedRequest.data.amount
    }
    debug('sending data')
    const response = await this.plugin.sendData(data)
    const parsedResponse = IlpPacket.deserializeIlpPacket(data)

    if (parsedResponse.type === IlpPacket.Type.TYPE_ILP_REJECT) {
      this.balance += parsedRequest.data.amount
      this.emit('_balance', this.balance)
    }
    return response
  }

  async disconnect () {
    this.close = true
  }
}

module.exports = CogAccountant
