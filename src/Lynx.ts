import {
  Authenticator,
  ButtonStyle,
  Chain,
  UALError,
  UALErrorType,
  User
} from 'universal-authenticator-library'
import { Name } from './interfaces'
import { lynxLogo } from './lynxLogo'
import { LynxUser } from './LynxUser'
import { UALLynxError } from './UALLynxError'

declare var window: any

export class Lynx extends Authenticator {
  // Forces timeout if Lynx object is not found on window in 5 seconds
  private static API_LOADED_CHECK_TIMEOUT = 5000
  // Reference for Lynx timeout function
  private static LYNX_TIMEOUT: any = null
  private users: LynxUser[] = []
  private lynxIsLoading: boolean = true
  private initError: UALError | null = null
  private opt: any
  /**
   * Lynx Constructor
   * @param chains
   */
  constructor(chains: Chain[], opts?: any) {
    super(chains)
    if(opts)
      this.opt = opts
    else
      this.opt = {}
  }

  private isLynxReady(): Promise<boolean> {
    return new Promise((resolve) => {
      Lynx.LYNX_TIMEOUT = setTimeout(() => {
        resolve(false)
      }, Lynx.API_LOADED_CHECK_TIMEOUT)
      if (!!window.lynxMobile) {
        clearTimeout(Lynx.LYNX_TIMEOUT)
        resolve(true)
      }
      window.addEventListener('lynxMobileLoaded', () => {
        clearTimeout(Lynx.LYNX_TIMEOUT)
        resolve(true)
      })
    })
  }

  private isLynxBrowser(): boolean {
    return window.navigator.userAgent.toLowerCase().indexOf('eoslynx') !== -1
  }

  /**
   * Lynx injects into the app from its internal browser, because of that we check on a
   * configured interval, allowing up to 5 seconds for Lynx to become available before
   * throwing an initialization error.
   */
  public async init() {
    this.lynxIsLoading = true
    try {
      const lynxReady = await this.isLynxReady()
      if (!lynxReady) {
        throw new Error('Unable to connect')
      }
    } catch (e) {
      this.initError = new UALLynxError(
        'Error occurred during autologin',
        UALErrorType.Initialization,
        e)
    } finally {
      this.lynxIsLoading = false
    }
  }

  public reset(): void {
    this.initError = null
    this.init()
  }

  public getStyle(): ButtonStyle {
    return {
      icon: lynxLogo,
      text: Name,
      textColor: 'white',
      background: '#21202D'
    }
  }

  /**
   * Lynx is chain and environment specific, it will only load within the Lynx browser
   * provided all chains are supported.
   */
  public shouldRender(): boolean {
    if (this.isLynxBrowser()) {
      return true
    }

    return false
  }

  public shouldAutoLogin(): boolean {
    // Always autologin if should render, since that should only be inside the Lynx browser
    return this.shouldRender()
  }

  /**
   * Requests the currently active account from Lynx, will throw a Login error if Lynx does
   * not respond or errors out
   */
  public async login(_?: string): Promise<User[]> {
    if (this.users.length === 0) {
      try {
        const account = await window.lynxMobile.requestSetAccount()
        this.users.push(new LynxUser(this.chains[0], account, this.opt))
      } catch (e) {
        throw new UALLynxError(
          'Unable to get the current account during login',
          UALErrorType.Login,
          e)
      }
    }

    return this.users
  }

  /**
   * Clears the array of authenticated users
   * Note: The name - logout - is slightly misleading in this particular case
   * as calling this method will not log a user out of the Lynx app but rather
   * refresh the user list on the authenticator
   */
  public async logout(): Promise<void> {
    this.users = []
  }

  public async shouldRequestAccountName(): Promise<boolean> {
    return false
  }

  public isLoading(): boolean {
    return this.lynxIsLoading
  }

  public isErrored(): boolean {
    return !!this.initError
  }

  public getError(): UALError | null {
    return this.initError
  }

  public getOnboardingLink(): string {
    return 'https://lynxwallet.io/'
  }

  public requiresGetKeyConfirmation(): boolean {
    return false
  }
}
