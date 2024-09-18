/** @type {Record<string, import('./compat.js').Test>} */
export const test = {
  'generates keys': async (assert, { client, server }) => {
    await client.generateKey('ed25519')
    await client.generateKey('rsa')
    await server.generateKey('ed25519')
    await server.generateKey('rsa')
    assert.ok(true)
  },
  'invokes test/echo':  async (assert, { client, service }) => {
    const alice = await client.generateKey()
    const caveats = { echo: `test ${Date.now()}` }

    /** @type {{ receipt: import('@ucanto/interface').Receipt<{ echo: string }, {}> }} */
    const { receipt } = await client.invoke({
      url: service.url,
      audience: service.id,
      issuer: alice,
      resource: alice.did(),
      ability: 'test/echo',
      caveats
    })

    assert.equal(receipt.out.error, undefined)
    assert.deepEqual(receipt.out.ok, caveats)
  },
}
