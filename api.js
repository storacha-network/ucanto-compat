import fs from 'node:fs'
import path from 'node:path'
import { execa } from 'execa'
import * as DID from '@ipld/dag-ucan/did'
import * as dagJSON from '@ipld/dag-json'
import * as ed25519 from '@ucanto/principal/ed25519'
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

  async generateKey () {
    const cmd = `${this.#config.command} key gen`
    /** @type {{ key: string }} */
    const out = await execAndParse(this.#cwd, cmd)

    let signer
    try {
      signer = ed25519.parse(out.key)
    } catch (err) {
      throw new Error(`failed to parse Ed25519 key in output: ${out.key}`)
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
   * @param {ed25519.EdSigner} params.issuer
   * @param {import('@ucanto/interface').DID} params.audience
   * @param {import('@ucanto/interface').DID} params.resource
   * @param {import('@ucanto/interface').Ability} params.ability
   * @param {Record<string, any>} [params.caveats]
   * @param {import('@ucanto/interface').Delegation} [params.proof]
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
      ed25519.format(issuer),
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
    /** @type {{ out: import('@ucanto/interface').Result<O, X>, message: string }} */
    const out = await execAndParse(this.#cwd, cmd)
    return out
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
  const { all } = await execa({ cwd, all: true })`${bin} ${rest}`
  try {
    return dagJSON.parse(all)
  } catch (err) {
    throw Object.assign(
      new Error('failed to parse output as dag-json', { cause: err }),
      { command, output: all }
    )
  }
}
