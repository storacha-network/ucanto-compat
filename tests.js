/**
 * @typedef {{ client: import('./api.js').API, server: import('./api.js').API }} Context
 */

export const test = {
  'generates a key':
    async (
      /** @type {Context} */ { client, server },
      /** @type {import('entail').assert} */ assert
    ) => {
      const clientKey = await client.generateKey()
      console.log(`client: ${clientKey.did()}`)

      const serverKey = await server.generateKey()
      console.log(`server: ${serverKey.did()}`)
      assert.ok(true)
    },
  'starts a server':
    async (
      /** @type {Context} */ { client, server },
      /** @type {import('entail').assert} */ assert
    ) => {
      const {id, url} = await client.startService()
      console.log({id, url})
      await client.stopService(id)
    },
}
