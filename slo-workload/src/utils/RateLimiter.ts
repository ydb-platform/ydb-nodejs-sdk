import NanoTimer from 'nanotimer'

export default class RateLimiter {
  private delayMicroSec: number
  private count: number = 0
  private realRPSObserverId: NodeJS.Timeout
  private returnerTimer: NanoTimer
  private real: number = 0
  private returner = () => {}

  constructor(public readonly id: string, ratePerSecond: number) {
    this.delayMicroSec = 1000000 / ratePerSecond
    this.realRPSObserverId = setInterval(() => {
      this.real = this.count
      this.count = 0
    }, 1000)
    this.returnerTimer = new NanoTimer()
    this.returnerTimer.setInterval(
      () => {
        this.returner()
      },
      '',
      `${this.delayMicroSec}u`
    )
  }

  async nextTick(): Promise<void> {
    this.count++
    const that = this
    return new Promise((resolve) => {
      that.returner = () => {
        resolve()
        that.returner = () => {}
      }
    })
  }

  getRealRPS(source: string) {
    return this.real
  }

  destroy() {
    clearInterval(this.realRPSObserverId)
    this.returnerTimer.clearInterval()
  }
}
