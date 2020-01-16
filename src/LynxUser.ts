import {
  Chain,
  SignTransactionConfig,
  SignTransactionResponse,
  UALErrorType,
  User
} from 'universal-authenticator-library'
import { UALLynxError } from './UALLynxError'
import { Api, JsonRpc } from 'eosjs'
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig'

declare var window: any

export class LynxUser extends User {
  private account: any
  private keys: string[] = []
  private chainId = ''
  private opt: any

  constructor(
    chain: Chain | null,
    accountObj: any,
    options: any
  ) {
    super()
    this.account = accountObj.account
    this.opt = options
    console.log('llegue')
    if (chain && chain.chainId) {
      this.chainId = chain.chainId
    }
  }

  public addZeros(n: number, zeros = 1): string {
    if (zeros === 1) {
      return (n > 9) ? String(n) : '0' + n
    }
    let output: string = String(n)
    let aux = 10
    while (zeros) {
      if (n < aux) {
          output = '0' + output
      }
      aux *= 10
      zeros -= 1
    }
    return output
  }

  public addExpiredSeconds(datetime: string, seconds: number): string {
    const dt = datetime.replace('T', ' ')
    let date: Date = new Date(dt)
    date.setSeconds(date.getSeconds() + seconds)

    return date.getFullYear() + '-' +
           this.addZeros(date.getMonth() + 1) + '-' +
           this.addZeros(date.getDate()) + 'T' +
           this.addZeros(date.getHours()) + ':' +
           this.addZeros(date.getMinutes()) + ':' +
           this.addZeros(date.getSeconds()) + '.' +
           this.addZeros(date.getMilliseconds(), 2)
  }

  public async signTransaction(
    transaction: any,
    // tslint:disable-next-line:variable-name
    _config: SignTransactionConfig
  ): Promise<SignTransactionResponse> {
    let result

    try {

      if (this.opt.endPoint) {
        const textEncoder = new TextEncoder()
        const textDecoder = new TextDecoder()
        const rpc = new JsonRpc(this.opt.endPoint)
        const signatureProvider = new JsSignatureProvider(['5K5oHKo9MXeXpjzPkdB7gBm2qqgHgDHviSxKDsZQz7Nyj1xeLD9'])

        const api = new Api({
          rpc: rpc,
          signatureProvider: signatureProvider,
          textEncoder,
          textDecoder,
        })

        const info = await api.rpc.get_info()
        const block = await api.rpc.get_block(info.head_block_num - ((_config.blocksBehind) ? _config.blocksBehind : 3))
        const expirationTime = await this.addExpiredSeconds(info.head_block_time, ((_config.expireSeconds) ? _config.expireSeconds : 30))

        transaction.expiration = expirationTime
        transaction.ref_block_num = block.block_num & 0xffff
        transaction.ref_block_prefix = block.ref_block_prefix

        result = await window.lynxMobile.requestSignature(transaction)

        transaction = { ...transaction, actions: await api.serializeActions(transaction.actions) }

        const serializedTxn = api.serializeTransaction(transaction)

        const txn_result: any = await api.pushSignedTransaction({ signatures:result.signatures,
          serializedTransaction: serializedTxn })
        return {
          wasBroadcast: true,
          transactionId: txn_result.transaction_id,
          transaction: txn_result
        }

      }
      else {
        console.log('NO ENDPOINT')
        result = await window.lynxMobile.transact(transaction)
        return {
          wasBroadcast: true,
          transactionId: result.transaction_id,
          transaction: result,
        }
      }
    } catch (e) {
      throw new UALLynxError(
        'Unable to sign the given transaction',
        UALErrorType.Signing,
        e)
    }
  }

  public async signArbitrary(_: string, data: string, helpText: string): Promise<string> {
    try {
      return window.lynxMobile.requestArbitrarySignature({data, whatFor: helpText})
    } catch (e) {
      throw new UALLynxError(
        'Unable to sign arbitrary string',
        UALErrorType.Signing,
        e
      )
    }
  }

  public async verifyKeyOwnership(_: string): Promise<boolean> {
    throw new Error('Lynx does not currently support verifyKeyOwnership')
  }

  public async getAccountName(): Promise<string> {
    return this.account.account_name
  }

  public async getChainId(): Promise<string> {
    return this.chainId
  }

  public async getKeys(): Promise<string[]> {
    if (this.keys.length === 0) {
      this.account.permissions.forEach((perm: any) => {
        if (perm.perm_name === 'active') {
          perm.required_auth.keys.forEach((key: any) => {
            this.keys.push(key.key)
          })
        }
      })
    }

    return this.keys
  }

}
