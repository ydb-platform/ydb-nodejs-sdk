import RateLimiter from '../../src/utils/RateLimiter'

const getTime = () => new Date().valueOf()

describe('RateLimiter', () => {
  const rl100 = new RateLimiter('tester', 100)
  const rl1000 = new RateLimiter('tester', 1000)

  afterAll(() => {
    rl100.destroy()
    rl1000.destroy()
  })

  it('Count 1000 rps RL', async () => {
    const time = getTime()
    let finalTime: number
    let counter = 0
    while ((finalTime = getTime() - time) < 1000) {
      await rl1000.nextTick()
      counter++
    }
    expect(counter).toBeGreaterThanOrEqual(1000)
    expect(counter).toBeLessThanOrEqual(1005)
    expect(finalTime).toBeLessThanOrEqual(1002)
  })

  it('Count 100 rps RL', async () => {
    const time = getTime()
    let finalTime: number
    let counter = 0
    while ((finalTime = getTime() - time) < 1000) {
      await rl100.nextTick()
      counter++
    }
    expect(counter).toBeGreaterThanOrEqual(100)
    expect(counter).toBeLessThanOrEqual(101)
    expect(finalTime).toBeLessThanOrEqual(1010)
  })
})
