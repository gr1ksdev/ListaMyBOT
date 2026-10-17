import { EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { lock, unlock, removeLists } from '../lib/dispatch.js';

export default async function(input, ctx) {
 await requireAdmin(ctx);
 if (!await lock()) throw new EndpointError('Há uma operação sendo processada. Aguarde.');
 try {
  return await removeLists();
 } finally {
  await unlock();
 }
}
