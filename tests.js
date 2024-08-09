/** @type {Record<string, import('./compat.js').Test>} */
export const test = {
  'generates keys': async (assert, { client, server }) => {
    const clientKey = await client.generateKey()
    console.log(`client: ${clientKey.did()}`)

    const serverKey = await server.generateKey()
    console.log(`server: ${serverKey.did()}`)
    assert.ok(true)
  },
  'invokes test/echo':  async (assert, { client, service }) => {
    const alice = await client.generateKey()
    const caveats = { echo: `test ${Date.now()}` }

    /** @type {{ out: import('@ucanto/interface').Result<{ echo: string }, {}>, message: string }} */
    const { out } = await client.invoke({
      url: service.url,
      audience: service.id,
      issuer: alice,
      resource: alice.did(),
      ability: 'test/echo',
      caveats
    })

    assert.equal(out.error, undefined)
    assert.deepEqual(out.ok, caveats)
  },
}
