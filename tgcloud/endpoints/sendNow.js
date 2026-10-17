import { EndpointError } from 'sdk';
import { requireAdmin } from '../lib/store.js';
import { lock, unlock, createRound, processQueue } from '../lib/dispatch.js';
export default async function(input,ctx){await requireAdmin(ctx);if(!await lock())throw new EndpointError('Há um envio sendo processado. Aguarde.');try{await createRound();}finally{await unlock();}return processQueue();}
