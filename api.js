import fs from 'node:fs'
import path from 'node:path'
import { execa } from 'execa'
import * as DID from '@ipld/dag-ucan/did'
import * as dagJSON from '@ipld/dag-json'
import * as ed25519 from '@ucanto/principal/ed25519'
import * as rsa from '@ucanto/principal/rsa'
import { CAR } from '@ucanto/transport'
import { base64pad } from 'multiformats/bases/base64'
import defer from 'p-defer'

/**
 * @typedef {{ command: string }} Config
 */

export class API {
  #cwd
  /** @type {Config} */
  #config
  /** @type {Record<import('@ipld/dag-ucan').DID, URL>} */
  #services

  /** @param {string} basePath */
  constructor (basePath) {
    this.#cwd = basePath
    const configFilePath = path.join(basePath, 'runner.config.json')
    try {
      this.#config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'))
    } catch (err) {
      throw new Error(`failed to read implementation config from: ${configFilePath}`, { cause: err })
    }
    this.#services = {}
  }

  async startService () {
    const { resolve, reject, promise } = defer()

    ;(async () => {
      let settled = false
      try {
        const command = `${this.#config.command} server start`
        const [bin, ...rest] = command.split(' ')
        const process = execa({ cwd: this.#cwd })`${bin} ${rest}`

        for await (const line of process.iterable()) {
          if (settled) {
            console.warn(line) // log any further output from server for debugging
            continue
          }

          let out
          try {
            out = dagJSON.parse(line)
          } catch (err) {
            throw Object.assign(
              new Error('failed to parse output as dag-json', { cause: err }),
              { command, output: line }
            )
          }

          let id
          try {
            id = DID.parse(out.id).did()
          } catch (err) {
            throw new Error(`failed to parse DID in output: ${out.id}`)
          }

          let url
          try {
            url = new URL(out.url)
          } catch (err) {
            throw new Error(`failed to parse URL in output: ${out.url}`)
          }

          this.#services[id] = url
          resolve({ id, url })
          settled = true
        }
      } catch (/** @type {any} */ err) {
        if (!settled) {
          reject(err)
          settled = true
        } else {
          console.error(err) // if already settled, just log the error
        }
      }
    })()

    return promise
  }

  /** @param {import('@ipld/dag-ucan').DID} id */
  async stopService (id) {
    if (!this.#services[id]) throw new Error(`unknown service: ${id}`)
    const url = new URL('/shutdown', this.#services[id])
    const res = await fetch(url, { method: 'POST' })
    if (res.status !== 202) throw new Error(`unexpected status: POST ${url} -> ${res.status}`)
    delete this.#services[id]
  }

  /** @param {string} [type] */
  async generateKey (type) {
    const cmd = [
      ...this.#config.command.split(' '),
      'key',
      'gen',
      '--type',
      type ?? 'ed25519'
    ]
    /** @type {{ id: string, key: Uint8Array }} */
    const out = await execAndParse(this.#cwd, cmd)

    let signer
    try {
      signer = type?.toLowerCase() === 'rsa'
        ? rsa.decode(out.key)
        : ed25519.decode(out.key)
    } catch (/** @type {any} */ err) {
      throw new Error(`failed to parse ${type ?? 'ed25519'} key: ${err.message}`, { cause: err })
    }

    return signer
  }

  async delegate () {

  }

  /**
   * @template O
   * @template {{}} X
   * @param {object} params
   * @param {URL} params.url
   * @param {import('@ucanto/interface').Signer} params.issuer
   * @param {import('@ucanto/interface').DID} params.audience
   * @param {import('@ucanto/interface').DID} params.resource
   * @param {import('@ucanto/interface').Ability} params.ability
   * @param {Record<string, any>} [params.caveats]
   * @param {import('@ucanto/interface').Delegation} [params.proof]
   * @returns {Promise<{ receipt: import('@ucanto/interface').Receipt<O, X>, message: import('@ucanto/interface').AgentMessage }>}
   */
  async invoke ({
    url,
    issuer,
    audience,
    resource,
    ability,
    caveats,
    proof
  }) {
    const cmd = [
      ...this.#config.command.split(' '),
      'invoke',
      '--url',
      url.toString(),
      '--issuer',
      // @ts-expect-error
      base64pad.encode(Object.values(issuer.toArchive().keys)[0]),
      '--audience',
      audience,
      '--resource',
      resource,
      '--ability',
      ability
    ]
    if (caveats) {
      cmd.push('--caveats', dagJSON.stringify(caveats))
    }
    if (proof) {
      const res = await proof.archive()
      if (res.error) throw res.error
      cmd.push('--proof', base64pad.encode(res.ok))
    }
    /** @type {{ headers: Record<string, string>, body: Uint8Array }} */
    const res = await execAndParse(this.#cwd, cmd)

    // TODO: use headers to pick the correct transport.
    const message = await CAR.outbound.decode({ headers: res.headers, body: res.body })
    if (message.receipts.size !== 1) {
      throw new Error(`unexpectedly found ${message.receipts.size} receipts in response message`)
    }

    const receipt = /** @type {any} */ ([...message.receipts.values()][0])
    return { receipt, message }
  }
}

/**
 * @template T
 * @param {string} cwd
 * @param {string|string[]} command
 * @returns {Promise<T>}
 */
const execAndParse = async (cwd, command) => {
  const [bin, ...rest] = Array.isArray(command) ? command : command.split(' ')
  console.log(`→ ${bin} ${rest.join(' ')}`)
  const { all } = await execa({ cwd, all: true })`${bin} ${rest}`
  try {
    console.log('←', all)
    return dagJSON.parse(all)
  } catch (err) {
    throw Object.assign(
      new Error('failed to parse output as dag-json', { cause: err }),
      { command, output: all }
    )
  }
}
