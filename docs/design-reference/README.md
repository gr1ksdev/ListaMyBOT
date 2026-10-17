# Referências aprovadas

- `dashboard.png`: Canais, Início e Ajustes.
- `list-editor.png`: grade, seletor inferior e prévia Telegram.

A interface foi reconstruída com um único CSS, em vez de sucessivas sobreposições.
Fonte Inter local (400/500/600/700), conteúdo de até 480 px, margens de 20 px,
rodapé com cinco abas e Início no centro. Canais usa avatares circulares de iniciais,
link no alto e duas ações para pendências; a edição abre ao tocar no nome/avatar.

A grade reproduz os controles X/Y, rótulos de colunas e posições vazias da imagem.
A funcionalidade segue o pedido posterior: as quantidades por linha se repetem na
lista inteira. Linhas vazias não são publicadas. As colunas visíveis do editor não
podem ser reduzidas se isso esconder botões. Nomes e números dos mockups não são
inseridos em produção. O tema escuro acompanha o Telegram.

A moldura de aparelho, status bar e cabeçalho nativo do Telegram são externos à
Mini App. Não são desenhados novamente dentro do HTML. A aba Envios compartilha os
mesmos componentes visuais, pois não existe uma tela de referência separada dela.

Validação: `tests/design-review.cjs` renderiza telas com dados fictícios para
comparação visual. Capturas são temporárias. `tests/ui-check.cjs` exercita arraste,
salvamento e grade com 100 botões em Chromium, nas larguras 320/390/768/1280 px.
Os dois usam SDK simulado e não enviam mensagens reais. Os assets gerados no build
recebem uma versão de conteúdo nas URLs para invalidar cache sem alterar o SDK.
