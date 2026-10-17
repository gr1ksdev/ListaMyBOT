import { requireAdmin } from '../lib/store.js';
import { processQueue } from '../lib/dispatch.js';
export default async function(input,ctx){await requireAdmin(ctx);return processQueue();}
