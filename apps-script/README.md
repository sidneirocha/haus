# Haus CRM — Apps Script

## Configuração rápida

1. Crie ou abra a planilha do CRM no Google Sheets.
2. No Apps Script, cole o conteúdo de `Code.gs`.
3. Em **Project Settings → Script properties**, adicione:
   - `SPREADSHEET_ID`: ID da planilha.
   - `ADMIN_EMAIL`: e-mail administrativo permitido no login do CRM.
   - `ADMIN_KEY`: uma chave longa e aleatória para operações internas.
4. Execute `setupSheets()` uma vez e autorize o script.
5. Faça o deploy como **Web app**, executando como você e permitindo acesso conforme sua operação.
6. No frontend, configure apenas `VITE_CRM_ENDPOINT` com a URL `/exec`. Não coloque `ADMIN_KEY` em `VITE_*`: a chave é digitada somente na tela de login e enviada ao Apps Script por HTTPS. Como o Content Service redireciona respostas para uma URL temporária, o cliente do CRM usa `doGet` com payload JSON codificado para manter a resposta legível pelo navegador; o Apps Script valida `ADMIN_EMAIL` + `ADMIN_KEY`, cria um token temporário de 6 horas no `CacheService` e o frontend guarda apenas esse token em `sessionStorage`.

## Segurança do MVP

- O endpoint público só permite `quote` por token e `quote.accept` com nome informado.
- Para o formulário de contato, salve a chave secreta do Cloudflare em **Project Settings > Script properties** com o nome `TURNSTILE_SECRET`. Nunca coloque essa chave no frontend. O site envia a ação `contact.create` com o token do widget e o Apps Script valida em `https://challenges.cloudflare.com/turnstile/v0/siteverify` antes de gravar na aba `Form_Responses`.
- Listagens e mutações internas exigem uma sessão válida; a chave administrativa antiga continua aceita para compatibilidade, mas o frontend usa o token temporário.
- Depois de qualquer alteração em `Code.gs`, salve e crie uma nova versão em **Deploy → Manage deployments → Edit → New version**. O frontend só passa a usar o código novo depois desse redeploy.
- A planilha e suas credenciais não são expostas ao navegador.
- O aceite é uma assinatura eletrônica simples, sem certificação ICP-Brasil.
- Não há confirmação automática de Pix; o pagamento é marcado manualmente.

## Estrutura de abas

`Clientes`, `Projetos`, `Servicos`, `Orcamentos`, `Itens_Orcamento`, `Parcelas`, `Lancamentos_Financeiros`, `Atividades` e `Configuracoes`.

`Lancamentos_Financeiros` é independente de `Orcamentos`: registre nela toda entrada, saída ou custo da empresa, com status pago/recebido/pendente e vínculo opcional a cliente ou projeto.

Além das abas operacionais, `setupSheets()` cria `Modelos_Contrato`, `Contratos`, `Eventos_Contrato` e `AI_Rascunhos`. Os contratos têm fluxo `Rascunho → Enviado → Visualizado → Assinado`, registro de eventos e validação básica de nome, e-mail, CPF/CNPJ e consentimento. O aceite é uma assinatura eletrônica simples, sem certificação ICP-Brasil.

O endpoint público aceita `?action=contract&id={token}` para contratos publicados. As mutações internas disponíveis incluem `contract-model.create/update/delete`, `contract.create/update/cancel/delete`, `contract.publish`, `contract.view`, `contract.sign` e `ai.draftQuote`. Contratos assinados ficam imutáveis; rascunhos e cancelados podem ser excluídos. A ação de IA apenas prepara um rascunho; a publicação continua dependendo de revisão humana.

O contrato de resposta é `{ ok: true, data }` ou `{ ok: false, error }`.
