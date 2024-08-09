// import whyIsNodeRunning from 'why-is-node-running'
import fs from 'node:fs'
import path from 'node:path'
import sade from 'sade'
import runner from 'entail'
import { test } from './tests.js'
import { API } from './api.js'

/**
 * @typedef {{ client: import('./api.js').API, server: import('./api.js').API }} Context
 * @typedef {{ service: { id: import('@ipld/dag-ucan').DID, url: URL } }} ServiceContext
 * @typedef {(assert: import('entail').Assert, ctx: Context & ServiceContext) => unknown} Test
 */

const { dirname } = import.meta
const pkg = JSON.parse(fs.readFileSync(path.join(dirname, 'package.json'), 'utf-8'))

/**
 * @param {Context} ctx
 * @param {(assert: import('entail').Assert, ctx: Context) => unknown} fn
 */
const withContext = (ctx, fn) => {
  return (/** @type {import('entail').Assert} */ assert) => {
    return fn(assert, { ...ctx })
  }
}

/**
 * @template {Context} C
 * @param {(assert: import('entail').Assert, ctx: C & ServiceContext) => unknown} fn
 */
const withServiceContext = fn => {
  return async (
    /** @type {import('entail').Assert} */ assert,
    /** @type {C} */ context
  ) => {
    let service
    try {
      service = await context.server.startService()
      return await fn(assert, { ...context, service })
    } finally {
      if (service) await context.server.stopService(service.id)
    }
  }
}

const prog = sade(pkg.name)

prog
  .version(pkg.version)

prog
  .command('test <client> <server>')
  .describe('Test compatibility between client and server implementations.')
  .example('test go js')
  .example('test go js')
  .action(async (clientLang, serverLang) => {
    const client = new API(path.join(dirname, clientLang))
    const server = new API(path.join(dirname, serverLang))
    const ctx = { client, server }

    const suite = Object.fromEntries(
      [...Object.entries(test)].map(([k, v]) => (
        [k, withContext(ctx, withServiceContext(v))]
      ))
    )

    await runner({
      [`Compatibility ${clientLang} → ${serverLang}`]: {
        test: suite
      }
    })

    // setTimeout(() => whyIsNodeRunning(), 5000)
  })

prog.parse(process.argv)
