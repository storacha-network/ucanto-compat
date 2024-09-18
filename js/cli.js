import fs from 'node:fs'
import path from 'node:path'
import sade from 'sade'
import { keyGen } from './cmd/key-gen.js'
import { serverStart } from './cmd/server-start.js'
import { invoke } from './cmd/invoke.js'

const { dirname } = import.meta
const pkg = JSON.parse(fs.readFileSync(path.join(dirname, 'package.json'), 'utf-8'))

const prog = sade(pkg.name)

prog
  .version(pkg.version)

prog
  .command('server start')
  .describe('Start a Ucanto server.')
  .action(serverStart)
  .command('key gen')
  .describe('Generate a private key.')
  .option('--type', 'key type to generate ("ed25519" or "rsa")')
  .action(keyGen)
  .command('invoke')
  .describe('Issue an invocation.')
  .option('--url', 'service URL')
  .option('--issuer', 'base64 encoded _private_ key of the issuer')
  .option('--audience', 'DID of the intended receipient (typically the service DID)')
  .option('--resource', 'DID of the resource the invocation applies to')
  .option('--ability', 'name of the capability to delegate (may be specified multiple times)')
  .option('--caveats', 'dag-json encoded parameters for the invocation')
  .option('--proof', 'base64 encoded archive of delegations to include as proofs')
  .action(invoke)

prog.parse(process.argv)
