import { Driver, TypedData } from 'ydb-sdk'

export async function getMaxId(driver: Driver, tableName: string): Promise<number> {
  return new Promise((resolve) => {
    driver.tableClient.withSession(async (session) => {
      const res = await session.executeQuery(
        `SELECT MAX(object_id) as max_id FROM \`${tableName}\``
      )
      const result = TypedData.createNativeObjects(res.resultSets[0])
      resolve(result[0].maxId)
    })
  })
}
