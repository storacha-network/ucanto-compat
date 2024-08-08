import * as Server from '@ucanto/server'
import * as CAR from '@ucanto/transport/car'
import { service } from './service.js'

export const create = signer =>
  Server.create({
    id: signer,
    service: service(),
    codec: CAR.codec,
    validateAuthorization: () => ({ ok: {} })
  })