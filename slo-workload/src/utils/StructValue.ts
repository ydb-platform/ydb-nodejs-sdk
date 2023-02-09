import { declareType, snakeToCamelCaseConversion, TypedData, Types, withTypeOptions } from 'ydb-sdk'

export interface IStructValue {
  objectIdKey: number
  objectId: number
  timestamp: number
  payload: string
}

@withTypeOptions({ namesConversion: snakeToCamelCaseConversion })
export class StructValue extends TypedData {
  @declareType(Types.UINT32)
  public objectIdKey: number

  @declareType(Types.UINT32)
  public objectId: number

  @declareType(Types.UINT64)
  public timestamp: number

  @declareType(Types.UTF8)
  public payload: string

  static create(objectIdKey: number, objectId: number, timestamp: number, payload: string) {
    return new this({ objectIdKey, timestamp, objectId, payload })
  }

  constructor(data: IStructValue) {
    super(data)
    this.objectIdKey = data.objectIdKey
    this.timestamp = data.timestamp
    this.objectId = data.objectId
    this.payload = data.payload
  }
}
