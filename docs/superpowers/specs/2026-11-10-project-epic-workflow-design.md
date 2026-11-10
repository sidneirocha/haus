# Arquitetura de projetos derivados de orçamentos

## Objetivo

Transformar o fluxo de Projetos em uma estrutura de trabalho ágil, inspirada no Jira, mantendo o orçamento como origem comercial e o projeto como unidade operacional.

## Decisões confirmadas

- O botão **Novo projeto**, em Projetos, abre uma lista de todos os orçamentos disponíveis.
- Um orçamento também terá o botão **Criar projeto**.
- Os dois pontos de entrada usam o mesmo fluxo e a mesma proteção contra duplicidade.
- Um orçamento gera um projeto/épico.
- Cada item/serviço do orçamento gera uma história.
- Subtarefas são criadas manualmente dentro de cada história.
- Histórias e subtarefas possuem atividades próprias.
- Atividades aceitam comentários e links, com autor e data/hora.
- O fluxo padrão é: `Backlog → Em andamento → Em revisão → Concluído`.
- `Bloqueado` é um estado excepcional para histórias e subtarefas.
- O seletor de orçamento lista rascunhos, publicados, aceitos e expirados.
- Se já houver projeto para um orçamento, a ação muda para **Abrir projeto**.

## Modelo de domínio

### Projeto como épico

O registro atual de `Projetos` será ampliado para guardar a origem comercial:

- `quoteId`: orçamento de origem;
- `quoteToken`: token público para rastreabilidade e acesso;
- `sourceStatus`: status do orçamento no momento da criação;
- `epicKey`: identificador visual do épico;
- campos atuais de cliente, valor, datas, etapa e notas.

Um orçamento só poderá apontar para um projeto. A criação deve verificar essa relação no backend antes de inserir qualquer registro.

### Histórias

Nova entidade `Historias`:

- `id`;
- `projectId`;
- `quoteItemId` e `serviceId` quando disponíveis;
- `title`;
- `description`;
- `status`;
- `priority`;
- `assignee`;
- `startDate`;
- `dueDate`;
- `position`;
- `createdAt` e `updatedAt`.

Cada item do orçamento gera uma história inicial com título, descrição, valor e cobrança preservados na origem. A história não deve depender do serviço continuar ativo para permanecer válida.

### Subtarefas

Nova entidade `Subtarefas`:

- `id`;
- `storyId`;
- `title`;
- `description`;
- `status`;
- `priority`;
- `assignee`;
- `startDate`;
- `dueDate`;
- `position`;
- `createdAt` e `updatedAt`.

### Atividades

A entidade/aba `Atividades` existente será normalizada para aceitar qualquer alvo de trabalho:

- `id`;
- `entityType`: `project`, `story` ou `subtask`;
- `entityId`;
- `type`: `comment`, `link`, `status` ou `system`;
- `message`;
- `url` opcional;
- `author`;
- `createdAt`;
- `updatedAt` opcional.

Comentários e links aparecem em uma linha do tempo ordenada do mais recente para o mais antigo. A caixa de texto ficará disponível tanto na história quanto na subtarefa.

## Fluxos de criação

### A partir de Projetos

1. Usuário clica em **Novo projeto**.
2. Sistema mostra os orçamentos com cliente, valor, status, validade e indicador de projeto existente.
3. Usuário seleciona um orçamento.
4. Sistema mostra uma prévia das histórias que serão criadas.
5. Usuário confirma.
6. Backend cria projeto e histórias em uma operação orquestrada, protegida por lock e verificação de duplicidade.
7. Interface abre o épico recém-criado.

### A partir de Orçamento

1. Usuário abre os detalhes do orçamento.
2. Se não houver projeto vinculado, vê **Criar projeto**.
3. Sistema mostra a prévia das histórias derivadas dos itens.
4. Usuário confirma.
5. Após a criação, o botão muda para **Abrir projeto**.

Orçamentos expirados continuam disponíveis para criação, mas a interface deve sinalizar o status para evitar interpretação de que a validade comercial foi renovada.

## Experiência do projeto

- Cabeçalho do projeto com breadcrumb, cliente, orçamento de origem, status e progresso.
- Card de épico com resumo de valor, datas e progresso das histórias.
- Lista de histórias com status, prioridade, responsável, prazo e percentual de subtarefas concluídas.
- Cada história abre uma tela/drawer de detalhe.
- Dentro da história: descrição, subtarefas, criação de subtarefa e atividade.
- Cada subtarefa possui detalhe próprio e atividade própria.
- Drag-and-drop poderá ser usado para mudar posição dentro da lista; mudança de status continua disponível por seletor.

## Persistência e compatibilidade

- O Apps Script receberá novas abas e ações para projetos, histórias, subtarefas e atividades.
- A criação derivada do orçamento será uma ação orquestrada de backend, com lock, verificação de duplicidade e compensação caso a geração das histórias falhe; isso evita projeto criado sem histórias ou histórias órfãs.
- Dados de projetos antigos continuam válidos; eles aparecem como projetos sem `quoteId` e podem receber histórias manualmente.
- A migração de `solutions` existentes será tratada como compatibilidade legada, sem apagar dados.
- O frontend exibirá estados de carregamento, sucesso e erro em todas as operações de criação e comentário.

## Critérios de aceite

- É possível criar um projeto pelos dois pontos de entrada.
- Um orçamento não gera dois projetos.
- Todos os itens do orçamento viram histórias na ordem original.
- Histórias e subtarefas podem usar os cinco estados definidos.
- Comentários e links ficam associados ao alvo correto e permanecem após recarregar.
- Projeto, história e subtarefa exibem progresso coerente.
- Orçamentos antigos e projetos sem origem continuam funcionando.
- Build e validações do frontend passam sem regressões.
