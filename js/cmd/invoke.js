import * as ed25519 from '@ucanto/principal/ed25519'
import { connect } from '@ucanto/client'
import { CAR, HTTP } from '@ucanto/transport'
import { Message, Invocation, Delegation } from '@ucanto/core'
import { base64pad } from 'multiformats/bases/base64'
import * as DID from '@ipld/dag-ucan/did'
import * as dagJSON from '@ipld/dag-json'

/**
 * @param {object} params
 * @param {string} params.url
 * @param {string} params.issuer
 * @param {string} params.audience
 * @param {string} params.resource
 * @param {string} params.ability
 * @param {string} [params.caveats]
 * @param {string} [params.proof]
 */
export const invoke = async params => {
  const serviceURL = new URL(params.url)
  const issuer = ed25519.parse(params.issuer)
  const audience = DID.parse(params.audience)
  const resource = DID.parse(params.resource).did()
  const ability = /** @type {import('@ucanto/interface').Ability} */(params.ability)
  const caveats = params.caveats ? dagJSON.parse(params.caveats) : {}
  /** @type {import('@ucanto/interface').Proof[]} */
  let proofs = []
  if (params.proof) {
    const res = await Delegation.extract(base64pad.decode(params.proof))
    if (res.error) throw new Error('failed to extract proofs', { cause: res.error })
    proofs = [res.ok]
  }

  const conn = connect({
    id: audience,
    codec: CAR.outbound,
    channel: HTTP.open({ url: serviceURL, method: 'POST' })
  })

  const inv = Invocation.invoke({
    issuer,
    audience,
    capability: { can: ability, with: resource, nb: caveats },
    proofs
  })

  const input = await Message.build({ invocations: [inv] })
  const request = await conn.codec.encode(input, conn)
  // @ts-expect-error
  const response = await conn.channel.request(request)

  console.log(dagJSON.stringify({ headers: response.headers, body: response.body }))
}
