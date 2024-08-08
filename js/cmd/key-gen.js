import * as ed25519 from '@ucanto/principal/ed25519'
import * as dagJSON from '@ipld/dag-json'

export const keyGen = async () => {
  const signer = await ed25519.generate()
  console.log(dagJSON.stringify({ key: ed25519.format(signer) }))
}
