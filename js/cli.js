import fs from 'node:fs'
import path from 'node:path'
import sade from 'sade'
import { keyGen } from './cmd/key-gen.js'
import { serviceStart } from './cmd/service-start.js'

const { dirname } = import.meta
const pkg = JSON.parse(fs.readFileSync(path.join(dirname, 'package.json')))

const prog = sade(pkg.name)

prog
  .version(pkg.version)

prog
  .command('service start')
  .action(serviceStart)
  .command('key gen')
  .action(keyGen)

prog.parse(process.argv)
