import { DataGenerator } from './DataGenerator'
import { StructValue } from './StructValue'

// possible to include inside of DataGenerator
export class PackGenerator {
  private valueGenerator: DataGenerator
  private remain: number
  private packSize: number

  constructor(count: number, packSize: number, startId: number) {
    this.valueGenerator = new DataGenerator(startId)
    this.remain = count
    this.packSize = packSize
  }

  get(): StructValue[] {
    const arr: StructValue[] = []
    for (let i = 0; i < this.packSize && this.remain > 0; i++, this.remain--) {
      arr.push(this.valueGenerator.get())
    }

    return arr
  }
}
