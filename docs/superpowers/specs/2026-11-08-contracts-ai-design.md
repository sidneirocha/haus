# Módulo de contratos e assistência de IA

## Objetivo

Adicionar ao CRM da Haus um fluxo próprio para criar contratos a partir de orçamentos aprovados, manter modelos reutilizáveis e coletar assinatura eletrônica própria. A arquitetura também deve aceitar uma futura camada de IA para gerar rascunhos de orçamento a partir de briefing e dados estruturados do CRM.

## Escopo do MVP

- Nova visão **Contratos** no CRM.
- CRUD de modelos de contrato.
- Criação de contrato a partir de cliente, projeto, orçamento e modelo.
- Editor de conteúdo com variáveis preenchidas a partir dos registros existentes.
- Status: Rascunho, Enviado, Visualizado, Assinado, Expirado e Cancelado.
- Link público para leitura e assinatura.
- Assinatura própria com nome completo, CPF/CNPJ, e-mail, aceite explícito, data/hora e registro de eventos.
- Validação pré-publicação dos dados das partes, objeto, escopo, valores, pagamento, prazo, rescisão e foro.
- Toasts e estados de carregamento coerentes com o restante do CRM.
- Estrutura de repositório preparada para `ai.draftQuote`, sem chamar um provedor ou expor credenciais no frontend.

## Fluxos

### Criar contrato a partir de orçamento

1. Usuário abre Contratos e seleciona **Novo contrato**.
2. Escolhe cliente, projeto, orçamento aprovado e modelo.
3. O sistema preenche variáveis e apresenta a prévia editável.
4. A validação lista campos ausentes antes da publicação.
5. Usuário salva como rascunho ou publica um link público.
6. O cliente visualiza, confirma os dados, aceita os termos e assina.
7. O contrato passa a Assinado e conserva a versão assinada e o histórico.

### IA para orçamento

1. Usuário informa um briefing e seleciona um cliente ou oportunidade.
2. A camada `ai.draftQuote` recebe somente dados necessários de clientes, serviços, projetos e histórico autorizado.
3. Retorna um objeto estruturado com itens, quantidades, preços, recorrência, prazo, premissas e alertas.
4. A interface apresenta uma prévia comparável e exige aprovação humana.
5. Somente após aprovação o orçamento é salvo; publicação, contrato e assinatura permanecem ações separadas.

## Validações

Antes de publicar, o contrato deve exigir:

- identificação da Haus e da parte contratante;
- nome/razão social, CPF/CNPJ, e-mail e endereço quando aplicável;
- objeto e escopo do contrato;
- serviços, entregáveis ou referência ao orçamento;
- valor, moeda e forma de pagamento;
- prazo de execução e vigência;
- regras de alteração, cancelamento e rescisão;
- foro e versão do modelo;
- nome, CPF/CNPJ, e-mail e aceite explícito do signatário.

As validações são controles de completude e consistência. A interface deve informar que o conteúdo deve ser revisado por profissional jurídico antes do uso definitivo.

## Dados e backend

Adicionar tipos e repositório para:

- `ContractModel`: nome, descrição, conteúdo, versão, ativo e datas.
- `Contract`: token, referências de cliente/projeto/orçamento/modelo, título, conteúdo renderizado, status, validade, assinatura e versão.
- `ContractEvent`: contrato, tipo de evento, data/hora, ator, metadados mínimos e hash/identificador da versão.
- `AiDraft`: briefing, referências usadas, resultado estruturado, status de revisão, modelo e timestamps.

No Apps Script, reservar abas `Contratos`, `Modelos_Contrato`, `Eventos_Contrato` e `AI_Rascunhos`, além das ações de criação, atualização, publicação, assinatura e leitura pública. O frontend usará o mesmo repositório demo/local já existente até o endpoint real ser conectado.

## Segurança e auditoria

- Nenhuma chave de IA será enviada ao navegador.
- Assinaturas nunca sobrescrevem uma versão já assinada.
- Publicação e assinatura geram eventos imutáveis no histórico.
- Dados públicos exibem apenas o necessário para a assinatura.
- O contrato assinado registra a versão exata apresentada ao cliente.
- A IA nunca altera diretamente cliente, orçamento, contrato ou financeiro.

## Interface

- Sidebar com Contratos entre Orçamentos e Financeiro.
- Lista com filtros por status, cliente e período.
- Aba separada para Modelos.
- Drawer para detalhes e histórico.
- Modal de criação em etapas curtas: contexto, conteúdo, validação e publicação.
- Página pública consistente com o orçamento já existente, com foco em leitura, aceite e assinatura.
- Mobile com navegação inferior e ações prioritárias fixas.

## Fora do escopo inicial

- Certificado digital ICP-Brasil.
- Integração com Clicksign, D4Sign ou outro provedor.
- Assinatura de múltiplas partes no mesmo fluxo.
- Automação de cobrança ou registro financeiro sem confirmação.
- Geração autônoma de texto jurídico pela IA sem modelo aprovado.

## Critérios de aceite

- É possível criar, editar, duplicar, ativar e desativar modelos.
- É possível gerar um contrato a partir de um orçamento aprovado.
- Um contrato incompleto não pode ser publicado.
- O link público permite visualizar e assinar uma versão específica.
- A assinatura altera o status, registra evento e bloqueia edição daquela versão.
- O histórico mostra publicação, visualização e assinatura.
- O rascunho da IA exige revisão antes de qualquer gravação definitiva.
- Build, testes de navegação e testes de assinatura passam no localhost.
