import http from 'node:http'
import * as ed25519 from '@ucanto/principal/ed25519'
import * as dagJSON from '@ipld/dag-json'
import * as Server from '../server.js'

export const serviceStart = async () => {
  const signer = await ed25519.generate()
  const server = Server.create(signer)
  const httpServer = http.createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) {
      chunks.push(chunk)
    }

    const { headers, body } = await server.request({
      headers: request.headers,
      body: Buffer.concat(chunks),
    })

    response.writeHead(200, headers)
    response.write(body)
    response.end()
  })

  await new Promise(resolve => httpServer.listen(resolve))

  console.log(dagJSON.stringify({
    url: `http://127.0.0.1:${httpServer.address().port}`,
    id: signer.did()
  }))
}
