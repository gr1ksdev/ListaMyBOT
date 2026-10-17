// Uses the same authenticated management operations as @tgcloud/cli 0.2.0.
// No Mini App initData is forged or reused. This is a privileged CLI job.
export async function tick(env, request = fetch) {
    const token = env.TGCLOUD_TOKEN;
    if (typeof token !== 'string' || !/^app\d+:[A-Za-z0-9_-]+$/.test(token)) throw Error('Configure TGCLOUD_TOKEN como secret do Worker.');
    const app = token.split(':')[0], base = `https://cloud.telegram.org/${app}/manage`;
    async function api(path, body) {
        const response = await request(base + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!response.ok) throw Error(`Telegram management HTTP ${response.status}`); const data = await response.json(); if (!data.ok) throw Error('Telegram não concluiu a operação de agendamento.'); return data.result;
    }
    const deployed = await api('/get');
    if (!deployed.canonical_modules?.['lib/dispatch']) throw Error('Publique o bot antes de ativar o agendador.');
    const sources = { ...deployed.canonical_modules, 'endpoints/maintenanceTick': "import { processQueue } from '../lib/dispatch.js'; export default async function(){ return processQueue({scheduled:true}); }" };
    let last;
    for (let i = 0; i < 10; i++) {
        const response = await api('/run', { module: 'endpoints/maintenanceTick', sources, args: {}, ctx: {} }); last = response.result;
        if (last?.idle || last?.busy || last?.remaining === 0) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return last;
}
export default {
    async scheduled(event, env, ctx) { ctx.waitUntil(tick(env)); },
    async fetch() { return new Response('ListaMyBOT scheduler. Agendamento executado por Cron Trigger.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
};
