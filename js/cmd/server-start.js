import http from 'node:http'
import * as ed25519 from '@ucanto/principal/ed25519'
import * as Server from '@ucanto/server'
import { capability, Schema, ok, error } from '@ucanto/validator'
import * as CAR from '@ucanto/transport/car'
import * as dagJSON from '@ipld/dag-json'

const testEcho = capability({
  can: 'test/echo',
  with: Schema.did({ method: 'key' }),
  nb: Schema.struct({
    echo: Schema.string(),
  }),
  derives: (child, parent) => {
    if (child.with !== parent.with) {
      return error(`Can not derive ${child.can} with ${child.with} from ${parent.with}`)
    }
    if (parent.nb.echo !== undefined && parent.nb.echo !== child.nb.echo) {
      return error(`Constrain violation: '${child.nb.echo}' violates imposed 'echo' constraint '${parent.nb.echo}'`)
    }
    return ok({})
  }
})

const service = () => ({
  test: {
    echo: Server.provide(testEcho, ({ capability }) => {
      return ok(capability.nb)
    })
  }
})

/** @param {import('@ucanto/interface').Signer} signer */
const createServer = signer =>
  Server.create({
    id: signer,
    service: service(),
    codec: CAR.inbound,
    validateAuthorization: () => ({ ok: {} })
  })

export const serverStart = async () => {
  const signer = await ed25519.generate()
  const server = createServer(signer)
  const httpServer = http.createServer(async (request, response) => {
    if (request.url === '/shutdown') {
      response.writeHead(202)
      response.end()
      return setTimeout(() => httpServer.close(), 1000)
    }

    const chunks = []
    for await (const chunk of request) {
      chunks.push(chunk)
    }

    const { status, headers, body } = await server.request({
      // @ts-expect-error node headers is string array values
      headers: request.headers,
      body: Buffer.concat(chunks),
    })

    response.writeHead(status || 200, headers)
    response.write(body)
    response.end()
  })

  await new Promise(resolve => httpServer.listen(resolve))

  // @ts-expect-error address will be an object
  const { port } = httpServer.address()
  console.log(dagJSON.stringify({
    url: `http://127.0.0.1:${port}`,
    id: signer.did()
  }))
}
