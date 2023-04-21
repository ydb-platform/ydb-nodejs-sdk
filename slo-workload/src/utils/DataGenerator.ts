import { Ydb } from 'ydb-sdk-proto'
import crypto from 'crypto'
import { Driver, TypedData, TypedValues } from 'ydb-sdk'

interface IUpsertValues {
  $id: Ydb.ITypedValue
  $payload_str: Ydb.ITypedValue
  $payload_double: Ydb.ITypedValue
  $payload_timestamp: Ydb.ITypedValue
}

export class DataGenerator {
  private static currentObjectId: number = 0

  /** Use only for initial create */
  static setMaxId(startId: number) {
    DataGenerator.currentObjectId = startId
  }
  static getMaxId(): number {
    return DataGenerator.currentObjectId
  }

  static getRandomId() {
    return TypedValues.uint64(Math.round(Math.random() * DataGenerator.getMaxId()))
  }

  static async loadMaxId(driver: Driver, tableName: string): Promise<number> {
    return new Promise((resolve) => {
      driver.tableClient.withSession(async (session) => {
        const res = await session.executeQuery(`SELECT MAX(id) as max_id FROM \`${tableName}\``)
        const result = TypedData.createNativeObjects(res.resultSets[0])
        DataGenerator.setMaxId(result[0].max_id)
        resolve(result[0].max_id)
      })
    })
  }

  static getUpsertData(): IUpsertValues {
    DataGenerator.currentObjectId++
    return {
      $id: TypedValues.uint64(DataGenerator.currentObjectId),
      $payload_str: TypedValues.utf8(
        crypto.randomBytes(Math.round(Math.random() * 20 + 20)).toString('base64')
      ),
      $payload_double: TypedValues.double(Math.random()),
      $payload_timestamp: TypedValues.timestamp(new Date()),
    }
  }
}
