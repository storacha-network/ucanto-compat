import fs from 'node:fs'
import path from 'node:path'
import { execa } from 'execa'
import * as DID from '@ipld/dag-ucan/did'
import * as dagJSON from '@ipld/dag-json'
import * as ed25519 from '@ucanto/principal/ed25519'
import defer from 'p-defer'

/**
 * @typedef {{ command: string }} Config
 */

export class API {
  #cwd
  /** @type {Config} */
  #config
  /** @type {Record<string, AbortController>} */
  #services

  constructor (basePath) {
    this.#cwd = basePath
    const configFilePath = path.join(basePath, 'runner.config.json')
    try {
      this.#config = JSON.parse(fs.readFileSync(configFilePath))
    } catch (err) {
      throw new Error(`failed to read implementation config from: ${configFilePath}`, { cause: err })
    }
    this.#services = {}
  }

  async startService () {
    const { resolve, reject, promise } = defer()

    ;(async () => {
      const controller = new AbortController()
      const cancelSignal = controller.signal
      let resolved = false

      try {
        const [bin, ...rest] = `${this.#config.command} service start`.split(' ')
        const process = execa({ cwd: this.#cwd, cancelSignal })`${bin} ${rest}`

        for await (const line of process.iterable()) {
          if (resolved) continue

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

          this.#services[id] = controller
          resolve({ id, url })
          resolved = true
        }
      } catch (err) {
        if (resolved) return
        if (!err.isCanceled) {
          reject(err)
        }
      }
    })()

    return promise
  }

  /** @param {import('@ipld/dag-ucan').DID} id */
  async stopService (id) {
    if (!this.#services[id]) throw new Error(`unknown service: ${id}`)
    this.#services[id].abort()
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
      throw new Error(`failed to parse Ed25519 key in output: ${out.id}`)
    }

    return signer
  }

  async delegate () {

  }

  async invoke () {

  }
}

/**
 * @template T
 * @param {string} cwd
 * @param {string} command
 * @returns {Promise<T>}
 */
const execAndParse = async (cwd, command) => {
  const [bin, ...rest] = command.split(' ')
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
