import Executor from './utils/Executor'

export class MetricsJob {
  private intervalId: NodeJS.Timer | undefined
  private endTime: number
  private promise: Promise<void>

  constructor(private executor: Executor, private reportPeriod: number = 1000, endTime: number) {
    this.endTime = new Date().valueOf() + endTime * 1000

    this.promise = new Promise((resolve) => {
      this.intervalId = setInterval(() => {
        if (new Date().valueOf() > this.endTime) {
          console.log('Metrics job ended')
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
