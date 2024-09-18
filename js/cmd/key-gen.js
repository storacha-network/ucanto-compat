import * as ed25519 from '@ucanto/principal/ed25519'
import * as rsa from '@ucanto/principal/rsa'
import * as dagJSON from '@ipld/dag-json'

/** @param {{ type?: 'rsa'|'ed25519' }} opts */
export const keyGen = async opts =>
  console.log(dagJSON.stringify(opts.type === 'rsa' ? await genRSA() : await genEd25519()))

const genEd25519 = async () => {
  const signer = await ed25519.generate()
  return { id: signer.did(), key: signer.encode() }
}

const genRSA = async () => {
  const signer = await rsa.generate({ extractable: true })
  const archive = signer.toArchive()
  return { id: signer.did(), key: archive.keys[archive.id] }
}
