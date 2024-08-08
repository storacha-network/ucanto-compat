import fs from 'node:fs'
import path from 'node:path'
import sade from 'sade'
import runner from 'entail'
import { test } from './tests.js'
import { API } from './api.js'

const { dirname } = import.meta
const pkg = JSON.parse(fs.readFileSync(path.join(dirname, 'package.json')))

const prog = sade(pkg.name)

prog
  .version(pkg.version)

prog
  .command('test <client> <server>')
  .describe('Test compatibility between client and server implementations.')
  .example('test go js')
  .example('test go js')
  .action(async (clientLang, serverLang, opts) => {
    const client = new API(path.join(dirname, clientLang))
    const server = new API(path.join(dirname, serverLang))
    const context = { client, server }

    const suite = {}
    for (const [k, v] of Object.entries(test)) {
      suite[k] = v.bind(null, context)
    }

    await runner({
      [`Compatibility ${clientLang} → ${serverLang}`]: {
        test: suite
      }
    })
  })

prog.parse(process.argv)
