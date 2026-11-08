# Haus CRM — Apps Script

## Configuração rápida

1. Crie ou abra a planilha do CRM no Google Sheets.
2. No Apps Script, cole o conteúdo de `Code.gs`.
3. Em **Project Settings → Script properties**, adicione:
   - `SPREADSHEET_ID`: ID da planilha.
   - `ADMIN_KEY`: uma chave longa e aleatória para operações internas.
4. Execute `setupSheets()` uma vez e autorize o script.
5. Faça o deploy como **Web app**, executando como você e permitindo acesso conforme sua operação.
6. No frontend, configure apenas `VITE_CRM_ENDPOINT` com a URL `/exec`. Não coloque `ADMIN_KEY` em `VITE_*`: variáveis Vite são incorporadas ao JavaScript público. Para liberar as telas internas com dados reais, use uma camada autenticada no servidor/proxy entre o navegador e o Apps Script. Sem essa camada, o frontend permanece em modo demonstração.

## Segurança do MVP

- O endpoint público só permite `quote` por token e `quote.accept` com nome informado.
- Listagens e mutações internas exigem `ADMIN_KEY`.
- A planilha e suas credenciais não são expostas ao navegador.
- O aceite é uma assinatura eletrônica simples, sem certificação ICP-Brasil.
- Não há confirmação automática de Pix; o pagamento é marcado manualmente.

## Estrutura de abas

`Clientes`, `Projetos`, `Servicos`, `Orcamentos`, `Itens_Orcamento`, `Parcelas`, `Atividades` e `Configuracoes`.

O contrato de resposta é `{ ok: true, data }` ou `{ ok: false, error }`.
