# ListaMyBOT

Bot e painel administrativo publicados em Telegram Serverless.

- Bot: https://t.me/ListaMyBOT
- Mini App: https://app8272402928.tgcloud.ai/
- Administrador principal: `7595607953`.
- Abra o bot e envie `/admin` para entrar no painel. A URL sozinha não autentica o usuário.

## Dashboard com Início central

- Rodapé: Canais · Lista · Início · Envios · Ajustes. O Início é a tela inicial e fica exatamente no centro.
- Resumo real de ativos, pendentes, canais e grupos; atalho para aprovações; próximo envio e última rodada.
- Totais da última rodada calculados no servidor, sem depender do limite de 200 detalhes de entregas.
- Canais reúne Todos/Pendentes/Ativos, busca, aprovação direta e seletor de aprovação manual/automática.
- Ajustes reúne aprovação, apagar/fixar a lista, administradores e indicação do tema do Telegram.
- 24 testes passaram. Mantidos SDK oficial, autorização e configurações existentes.
- Sem inspeção visual em navegador real neste ambiente.

## Atualização anterior de navegação e painel

- `/start` sem argumentos corrigido: boas-vindas com botões para adicionar canal/grupo, meus cadastros e ajuda.
- `/configurar` e `/link` no privado abrem a seleção dos cadastros do responsável, com autorização revalidada.
- Navegação edita a mesma mensagem, tanto no privado quanto no canal/grupo. Uma mensagem nova só é criada se não existir menu editável.
- Categoria, resumo, entrada de link, confirmação e acompanhamento possuem botões de navegação.
- Painel com quatro abas, cores nativas do Telegram (incluindo mudança de tema em tempo real) e Montserrat hospedada junto com o app.
- Aprovação na primeira tela: Eu aprovo / Aprovar automaticamente; Aprovar e Rejeitar diretamente em cada pendência.
- 21 testes automatizados passaram, incluindo regressões dos comandos, navegação, autorização e comportamento do painel em DOM simulado. O navegador gráfico não pôde ser instalado; não foi feita inspeção visual em um cliente Telegram real.

## Funcionalidades

- Cadastro no próprio canal/grupo, categorias em duas colunas e confirmação por administrador do chat.
- Aprovação manual ou automática; participantes, categoria, nome do botão, link e posição editáveis.
- Mensagem de texto e botões de URL, uma ou duas colunas, ordenação alfabética/manual/alternada.
- Listas grandes divididas em partes de até 40 botões; todos os aprovados recebem a lista completa.
- Opções para apagar a publicação anterior e fixar a nova.
- Intervalos em minutos ou horários diários de Brasília, com agendador externo.
- Dashboard usa `Telegram.WebApp.Serverless.call`, exclusivamente, e autorização no servidor.
- Administrador principal não pode ser removido pela interface.

## Situação da entrega

O bot, banco e dashboard estão publicados. A fila pode ser processada pelo painel em envios manuais. **O Worker externo não está publicado:** é preciso entrar numa conta Cloudflare e executar o procedimento abaixo. O painel informa quando não há agendador conectado. Agendamento fica desativado inicialmente.

Os testes locais de regras e de integração do Worker passaram. Endpoints foram executados no runtime do Telegram: administrador autorizado, outro ID recusado, fila vazia. O site respondeu HTTP 200. Nenhum canal/grupo real foi cadastrado automaticamente para testar publicações.

O teste visual com Playwright não foi executado: não há binário do navegador instalado neste ambiente. `tests/ui-check.cjs` é uma verificação opcional com SDK simulado para ambiente com Playwright/Chromium.

## Usar o bot

1. Adicione o bot como administrador do canal/grupo.
2. Conceda enviar, apagar e fixar mensagens. Em canais, fixar é coberto pela permissão de **editar mensagens**.
3. Escolha uma categoria na mensagem do próprio chat e clique em Enviar cadastro.
4. Se o chat for privado e não houver convite disponível, envie `/link https://t.me/+CONVITE` no próprio chat. O convite deve pertencer ao chat cadastrado. Não é exigida permissão adicional de convidar usuários; um administrador fornece o link quando necessário.
5. Abra `/admin` no privado, revise os participantes e configure a lista.

`/configurar` reabre o cadastro. O cadastro aprovado é alterado pelo painel do administrador do bot. A configuração privada é uma alternativa quando não for possível enviar o menu ao chat e o responsável já tiver iniciado o bot; `/start ID_DO_CHAT` também abre o menu privado após validar a administração do chat.

## Ativar envios automáticos (Cloudflare)

Requer Node.js compatível com Wrangler e acesso à conta Cloudflare. No diretório `scheduler`:

```sh
npm install
npx wrangler login
npx wrangler deploy
npx wrangler secret put TGCLOUD_TOKEN
```

No último comando, cole o token **CLI Access do Telegram Serverless** no prompt. Nenhuma credencial foi incluída neste projeto. Esse token é administrativo: guarde somente como secret do Worker. Não use token na URL nem no frontend.

O Worker executa a cada minuto. Acesse `/admin` → Agendamento, configure o intervalo/horários e ative. Em até alguns minutos, o status deve mudar para conectado. Se não mudar, consulte `npx wrangler tail` no diretório `scheduler`.

O Worker utiliza as operações autenticadas `/manage/get` e `/manage/run`, usadas por `@tgcloud/cli 0.2.0`, para executar a rotina de manutenção com o SDK nativo. Não chama endpoints de Mini App com identidade falsa. Busca os módulos publicados a cada execução para usar a versão atual do bot. Essa interface de gestão precisa ser revista se a plataforma alterar o protocolo do CLI.

Não é necessário duplicar o banco ou fornecer o token Bot API. Não configura webhook externo: o Telegram Serverless continua responsável pelas atualizações do bot.

## Desenvolvimento e publicação

```sh
npm ci
npx tgcloud login
npm test
npm run deploy
npx tgcloud migrate
```

Use `tgcloud migrate` somente quando houver mudanças pendentes de schema. O CLI confirma as migrações. `push` publica os módulos e a Mini App juntos, mas não cria tabelas automaticamente.

Pastas:

- `tgcloud/handlers`: mensagens, publicações de canal, callbacks e mudanças do status do bot.
- `tgcloud/endpoints`: operações administrativas autenticadas.
- `tgcloud/lib`: cadastro, permissões, armazenamento e distribuição.
- `src`: interface React/Vite; `npm run build` gera `dist`.
- `frontend`: painel antigo mantido apenas para testes de compatibilidade.
- `scheduler`: Worker de agendamento para Cloudflare.
- `tests`: testes de regras, Worker e verificação visual opcional.

## Comportamento dos envios

O banco persiste rodadas e entregas. Uma trava evita duas rotinas concorrentes. Cada lote processa até quatro mensagens; o Worker executa até dez lotes por minuto, retomando o restante no próximo ciclo. O painel também processa a fila enquanto está aberto; sem Worker, mantenha-o aberto até terminar.

Respostas 429 respeitam `retry_after`. Se houver erro de rede/servidor e não for possível saber se o Telegram recebeu a mensagem, a entrega é marcada **Conferir envio**, sem repetir automaticamente. Isso evita duplicação silenciosa; o administrador deve conferir o chat. A Bot API não fornece idempotência para `sendMessage`, portanto não há promessa de entrega exatamente uma vez.

Participantes removidos/sem permissões são pausados. Somente as mensagens da última lista registradas pelo bot podem ser removidas; falhas de apagar/fixar ficam no participante. Horários perdidos não geram uma avalanche de rodadas atrasadas. Pausar agendamento impede novas rodadas e não cancela a rodada já iniciada.

## Organizador da lista (22/10/2026)

A aba Lista usa somente o Layout Personalizado. Cada célula é um C/G automático,
um C/G fixo, uma divulgação fixa ou uma divulgação aleatória. O desenho é a
mensagem final: a quantidade de células de C/G define o limite da lista (padrão
10 linhas × 2 = 20). Canais/grupos excedentes ficam fora da mensagem e não geram
uma segunda parte; o rodapé e as divulgações não contam nesse limite. O layout é
resolvido uma única vez, sem repetir o desenho para completar a lista.

Cada divulgação aparece no máximo uma vez por lista. Posições aleatórias sorteiam
apenas anúncios ainda não usados e excluem os fixos. O painel e o endpoint
bloqueiam mais posições de divulgação do que anúncios cadastrados. Ao apagar um
anúncio usado, a posição fixa correspondente é removida do layout; ela não vira
um botão de C/G.

Com **Lista rotativa** ativada, os C/G automáticos e as divulgações aleatórias
mudam por destino na mesma rodada e avançam a cada rodada, mantendo a ordem
alfabética ou manual como base. C/G fixos, divulgações fixas e rodapé não mudam.
A prévia e o teste no privado mostram uma variação de exemplo; o teste envia uma
única mensagem e avisa quando completa posições com dados fictícios.

Validação: `npm test`. O teste visual opcional `tests/ui-check.cjs` requer
Playwright instalado e inicia seu próprio servidor de teste; as chamadas de SDK
são simuladas e não enviam mensagens.

## Reconstrução visual da dashboard (15/10/2026)

Substituído o CSS anterior por uma única implementação baseada nas duas imagens
aprovadas, preservadas em `docs/design-reference`. Fonte Inter local, proporções de
cards e rodapé, cards de aprovação com duas ações, grade X/Y e bottom sheet.
Os exemplos numéricos permanecem apenas nos testes; produção usa os dados do bot.
32 testes passaram, além da inspeção das telas renderizadas e testes no Chromium.
Build adiciona versões nas URLs de assets para evitar mistura com CSS antigo.

## Correção de desempenho (15/10/2026)

O build reúne CSS, fontes CSS, lógica de layout e app no próprio HTML para eliminar
requisições sequenciais no primeiro carregamento. O SDK oficial permanece externo.
A prévia é criada apenas na aba Prévia, uma mensagem por vez, com navegação entre
páginas. Isso não altera os participantes nem os envios reais. O arraste usa
requestAnimationFrame e atualiza somente o destino atual; cancelamentos liberam
captura e removem o elemento flutuante. Eventos de tema são idempotentes.
Chamadas ao SDK possuem limite de espera de 20 s; falhas de leitura permitem nova
tentativa. Operações de escrita não são repetidas automaticamente após timeout.
O endpoint da dashboard paraleliza leituras independentes e deixa de gerar uma
prévia duplicada que o frontend não utilizava.

Validação: 35 testes, Chromium com CPU limitada em 6x, arraste e navegação nas cinco
abas, teste de prévia com 1.000 participantes (até 40 botões no DOM) e teste de
carregamento sem resposta/reconexão. Diagnóstico autenticado no runtime: 10 ms para
ler a dashboard existente, sem enviar mensagens ou modificar configurações.

## Mínimo de membros e dados de teste (16/10/2026)

Em **Ajustes → Mínimo de membros**, defina a quantidade e salve. Zero desativa a
exigência. O bot consulta o Telegram ao entrar como administrador, ao enviar o
cadastro e ao aprovar manualmente (inclusive pela edição). Igual ao mínimo passa;
abaixo dele rejeita com motivo e opção de verificar novamente. Erros de consulta
bloqueiam a aprovação, sem interpretar falha de rede como falta de membros.
Alterar o mínimo não remove automaticamente participantes já aprovados.

Em **Ajustes → Testes → Abrir modo de teste**, há 20 canais/grupos fictícios,
com categorias e contagens variadas, pendentes, aprovados e rejeitados. Alterações
ficam na sessão do navegador; sair restaura os dados reais. O modo de teste permite
organizar a lista e testar a aprovação; não publica mensagens nem grava mocks no
banco. Não é uma simulação da API do Telegram.

O tutorial pelo painel Cloudflare está em [docs/CLOUDFLARE.md](docs/CLOUDFLARE.md).

Validação desta atualização: 43 testes passaram; navegador Chromium com CPU 6x,
arraste real e cinco abas em quatro larguras, sem overflow. Consulta autenticada
no runtime confirmou o carregamento do mínimo e a contagem de membros pela Bot API.
Nenhuma mensagem de teste foi enviada a participantes reais.
