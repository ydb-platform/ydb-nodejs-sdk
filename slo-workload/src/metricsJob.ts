import Executor from './utils/Executor'

export class MetricsJob {
  private intervalId: NodeJS.Timer | undefined
  private endTime: number
  private promise: Promise<void>

  constructor(
    private executor: Executor,
    private reportPeriod: number = 1000,
    private time: number
  ) {
    this.endTime = new Date().valueOf() + time * 1000

    this.promise = new Promise((resolve) => {
      this.intervalId = setInterval(() => {
        if (new Date().valueOf() > this.endTime) {
          clearInterval(this.intervalId)
          return resolve()
        }
        this.executor.pushStats()
      }, this.reportPeriod)
    })
  }

  getPromise() {
    return this.promise
  }
}
