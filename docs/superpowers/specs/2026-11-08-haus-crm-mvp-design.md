# Haus CRM MVP

## Objetivo

Criar um módulo interno `/crm` para a Haus, com uma operação simples de clientes, projetos, serviços e orçamentos públicos. O módulo deve usar a linguagem visual da Haus, mas adotar a estrutura de produto do shadcn/ui: sidebar, cards, tabelas, badges, dialogs, forms e estados vazios claros.

O site público atual permanece intacto. O CRM será uma área separada dentro do mesmo projeto React/Vite.

## Escopo do MVP

### Dashboard

- Projetos em andamento.
- Projetos próximos do vencimento.
- Parcelas pendentes e atrasadas.
- Orçamentos aguardando resposta.
- Atalho para novo cliente, projeto e orçamento.

### Clientes

Cadastro e listagem de nome/empresa, e-mail, telefone, observações e quantidade de projetos/orçamentos relacionados. A primeira versão terá busca simples, filtro por status e uma ficha lateral de detalhes.

### Projetos

Cadastro de cliente, nome, status, início, vencimento, próxima ação, data de oportunidade de upsell, valor e observações. Os status iniciais serão `Briefing`, `Em produção`, `Em revisão` e `Concluído`.

### Biblioteca de serviços

Serviços reutilizáveis com nome, descrição, categoria, preço padrão, tipo de cobrança e status ativo/inativo. Um item de orçamento grava uma cópia do nome e preço no momento da criação para preservar o histórico.

### Orçamentos públicos

Fluxo interno em quatro passos: cliente, itens, condições e publicação. O orçamento publicado recebe um token aleatório e uma URL pública. A página pública mostra os itens, totais, condições, Pix/link de pagamento e permite:

- aceitar ou recusar;
- informar o nome como assinatura simples;
- registrar data, horário e token do orçamento;
- consultar o status do aceite.

A assinatura é um aceite eletrônico simples, não uma assinatura certificada ICP-Brasil.

### Parcelas e suporte

Cada orçamento pode ter parcelas com valor, vencimento, link Pix/pagamento, status e data de pagamento. O MVP permite marcar manualmente como pago e exibe alertas no dashboard. Não haverá conciliação automática nesta fase.

## Arquitetura técnica

### Frontend

- React + Vite existentes.
- Shell do CRM em `src/crm/`.
- Componentes base inspirados e instalados pelo shadcn/ui: `Sidebar`, `Card`, `Table`, `Badge`, `Dialog`, `Sheet`, `Tabs`, `Input`, `Textarea`, `Select`, `Calendar`, `Popover`, `DropdownMenu`, `Alert` e `Empty`.
- Tailwind CSS v4 apenas para o módulo CRM, com tokens escopados em `.crm-app` para não alterar o site público.
- Ícones com `lucide-react`.
- Dados consumidos por um `crmRepository`, permitindo alternar entre endpoint Apps Script e dados de demonstração local.

### Google Sheets + Apps Script

O Apps Script será mantido em `apps-script/Code.gs`. Ele expõe `doGet` e `doPost` e usa as abas:

- `Clientes`
- `Projetos`
- `Servicos`
- `Orcamentos`
- `Itens_Orcamento`
- `Parcelas`
- `Atividades`
- `Configuracoes`

O ID da planilha e a chave de administração ficam nas Properties do Script, nunca no código do frontend. O endpoint público aceita apenas leitura de orçamento publicado e registro de aceite; operações internas exigem a chave de administração.

### Contrato inicial do endpoint

`GET`:

- `?action=dashboard`
- `?action=clients`
- `?action=projects`
- `?action=services`
- `?action=quote&id=<token>`

`POST`:

- `action=client.create`
- `action=project.create`
- `action=service.create`
- `action=quote.create`
- `action=quote.publish`
- `action=quote.accept`
- `action=installment.pay`

Cada registro terá um `id` estável, `createdAt` e `updatedAt`. O endpoint retornará `{ ok, data, error }` para facilitar estados de carregamento, erro e sucesso na UI.

## Fluxo de dados

1. O CRM abre com dados do Apps Script ou, em desenvolvimento sem endpoint configurado, dados de demonstração.
2. A UI envia uma ação para o `crmRepository`.
3. O repository chama o Apps Script e normaliza a resposta.
4. O Apps Script valida a ação, atualiza a aba correspondente e retorna o registro atualizado.
5. O dashboard refaz a consulta somente após mutações bem-sucedidas.
6. O orçamento público não expõe a planilha nem a chave administrativa.

## Fora do MVP

- Gateway de pagamento ou confirmação automática de Pix.
- Multiusuário com permissões por função.
- E-mail transacional automático.
- Emissão fiscal.
- Assinatura digital certificada.
- CRM de marketing, automações e lead scoring.

## Critérios de aceite

- `/crm` abre sem alterar Home, Sobre, Cases e Contato.
- Dashboard, clientes, projetos, serviços e orçamentos possuem estados de carregamento, vazio, erro e sucesso.
- É possível criar um orçamento a partir da biblioteca de serviços.
- Um orçamento publicado abre por token em uma página pública.
- O aceite público registra nome e data sem expor dados administrativos.
- Uma parcela pode ser marcada como paga e refletida no dashboard.
- O projeto compila com `tsc -b` e `vite build`.
- O Apps Script possui instruções de configuração sem credenciais embutidas.
