import { IStructValue, StructValue } from './StructValue'
import crypto from 'crypto'

const intHash = (int: number) => int

export const randomId = (maxId: number): number => Math.round(Math.random() * maxId)

export class DataGenerator {
  private currentObjectId: number = 0

  constructor(startId: number) {
    this.currentObjectId = startId
  }

  get(): StructValue {
    const objectId: number = this.currentObjectId++
    const objectData: string = crypto
      .randomBytes(Math.round(Math.random() * 20 + 20))
      .toString('base64')

    return StructValue.create(objectId, intHash(objectId), new Date().valueOf() * 1000, objectData)
  }
}
