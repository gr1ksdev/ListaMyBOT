# Ativar o agendador pelo painel Cloudflare

O bot e a dashboard continuam no Telegram Serverless. O Worker apenas verifica a fila a cada minuto. Não é necessário domínio próprio, outro banco ou webhook externo.

## 1. Criar o Worker

Entre em https://dash.cloudflare.com/ → **Workers & Pages → Create application**. Crie um Worker JavaScript básico (a opção pode aparecer como **Hello World** ou modelo inicial) com o nome `listamybot-scheduler` e publique.

Se a sua tela oferecer somente criação por repositório, conecte um repositório contendo a pasta `scheduler` deste projeto, use essa pasta como diretório raiz e `npx wrangler deploy` como comando de implantação. O arquivo `wrangler.jsonc` já define o gatilho de um minuto; nesse caminho mantenha o cron no arquivo, sem duplicá-lo no painel.

## 2. Colocar o código

No Worker, abra **Edit code**. Substitua todo o código inicial pelo conteúdo de `scheduler/worker.mjs` deste ZIP e clique em **Deploy**. Preserve o formato de módulo, incluindo `export default`. O arquivo não precisa de pacotes externos. Se você usou o repositório no passo anterior, o código já foi publicado.

## 3. Configurar a credencial

Abra **Settings → Variables and Secrets → Add**:

| Campo | Valor |
| --- | --- |
| Type | Secret |
| Variable name | `TGCLOUD_TOKEN` |
| Value | Seu CLI Access Token do Telegram Serverless, completo, no formato `appID:segredo` |

Clique em **Deploy**. Essa é a credencial administrativa do Serverless, não o token do BotFather. Não cole a credencial no código ou em URL. O ZIP não contém credenciais.

## 4. Ativar o Cron Trigger

Para o Worker criado diretamente no painel, vá a **Settings → Triggers → Cron Triggers**, adicione um gatilho e informe:

```text
* * * * *
```

Salve. Isso executa a verificação a cada minuto. Mantenha apenas um Worker com um gatilho para este bot. A propagação pode levar até 15 minutos. Se publicou pelo Wrangler/repositório, esse cron já está definido em `wrangler.jsonc`.

## 5. Configurar os envios no bot

Abra @ListaMyBOT → `/admin` → **Envios**. Após o primeiro ciclo, atualize/reabra a dashboard e procure **Agendador conectado** e a data de última verificação automática. Então escolha intervalo em minutos ou horários fixos, marque **Ativar envios automáticos** e salve.

Os horários do bot usam Brasília (UTC−3). O cron da Cloudflare só verifica a cada minuto: mantenha `* * * * *`, mesmo que queira publicar a cada 60 minutos ou às 09:00. Esses valores são configurados na dashboard do bot. Não precisa manter o painel aberto.

## Conferência e problemas comuns

- Abrir a URL `workers.dev` mostra somente uma mensagem de funcionamento; não dispara envios nem comprova que o cron está ativo.
- Confira as execuções agendadas e erros em **Observability/Logs** no Worker. Um evento HTTP de visita à URL não equivale a um evento cron.
- **Configure TGCLOUD_TOKEN**: confira o nome exato, tipo Secret, valor completo e se publicou a alteração.
- **HTTP 401/403**: confira se a credencial CLI está correta e válida para este bot.
- **Publique o bot antes de ativar o agendador**: publique o projeto atualizado no Serverless.
- Se ainda não conectar após 15 minutos, confirme que o código contém `scheduled`, que o gatilho pertence ao mesmo Worker e consulte os erros de execução.
- Conectado sem enviar: confira se os envios automáticos estão habilitados, se chegou o horário e se existem participantes aprovados. Os 20 mocks não recebem publicações.
- Para pausar novas rodadas, desative os envios automáticos na dashboard. Rodadas já iniciadas podem terminar.

O agendador usa as operações de gestão do CLI tgcloud 0.2.0. Se o Telegram mudar esse protocolo, o Worker precisará ser atualizado. Esta entrega não ativa um Worker na sua conta: conclua os passos acima.

Referências oficiais consultadas em 16/10/2026:

- https://developers.cloudflare.com/workers/get-started/dashboard/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
