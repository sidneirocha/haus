# Passkeys do CRM Haus

## Objetivo

Permitir que administradores entrem no CRM usando a biometria ou o autenticador do dispositivo, mantendo o login atual por e-mail e chave como fallback.

## Arquitetura

O Worker `haus-webauthn` continuará servindo o site e passará a responder também pelas rotas `/api/webauthn/*`. A validação WebAuthn será feita no Worker com `@simplewebauthn/server`, porque o Apps Script não oferece verificação ECDSA/WebAuthn adequada para esse fluxo.

As credenciais serão armazenadas em Cloudflare KV. O registro só será permitido para uma sessão CRM já autenticada. No login por passkey, depois da asserção válida, o Worker chamará internamente o Apps Script usando secrets do Worker e devolverá ao navegador a mesma estrutura de sessão já usada pelo CRM.

## Fluxos

### Registro

1. Usuário entra com e-mail e chave normalmente.
2. CRM solicita opções de registro ao Worker, enviando o token de sessão.
3. Worker valida a sessão no Apps Script e cria o challenge.
4. Navegador chama `navigator.credentials.create()`.
5. CRM envia a resposta ao Worker.
6. Worker valida origem, RP ID, challenge e user verification; salva a credencial no KV.

### Login

1. Usuário escolhe “Entrar com biometria”.
2. Worker cria e armazena um challenge de autenticação.
3. Navegador chama `navigator.credentials.get()`.
4. Worker valida a asserção, credencial, contador, origem, RP ID e user verification.
5. Worker chama `auth.login` no Apps Script com secrets privados.
6. CRM armazena a sessão retornada exatamente como no login existente.

## Contrato do Worker

- `POST /api/webauthn/register/options`
- `POST /api/webauthn/register/verify`
- `POST /api/webauthn/login/options`
- `POST /api/webauthn/login/verify`
- `GET /api/webauthn/health`

As rotas retornarão JSON, CORS restrito à origem configurada e mensagens genéricas de falha para não revelar credenciais existentes.

## Configuração externa

O Worker terá um namespace KV e estes secrets/vars:

- `CRM_ENDPOINT`: URL implantada do Apps Script.
- `ADMIN_EMAIL`: e-mail administrativo usado pelo Worker para criar a sessão após a passkey.
- `ADMIN_KEY`: chave administrativa, armazenada apenas como secret.
- `RP_ID`: `haus.art.br` em produção.
- `ORIGIN`: `https://haus.art.br` em produção.

O navegador não receberá `ADMIN_KEY`.

## Alterações no frontend

`src/crm/auth.ts` receberá funções para iniciar registro e login passkey, serializando os buffers WebAuthn em base64url. `src/crm/AuthGate.tsx` exibirá o botão de passkey quando o navegador oferecer WebAuthn e manterá o formulário atual como fallback. O botão terá estados de carregamento e erro compreensíveis.

## Segurança e compatibilidade

- Exigir `userVerification: 'required'`.
- Validar `expectedOrigin` e `expectedRPID` no servidor.
- Atualizar o contador da credencial após cada autenticação.
- Expirar challenges rapidamente e impedir reutilização.
- Não armazenar chave privada no servidor; apenas a chave pública e metadados da credencial.
- Em desenvolvimento, usar uma origem local explicitamente configurada; produção usará `haus.art.br`.

## Verificação

- `npm run build` do frontend.
- Teste manual do endpoint `/api/webauthn/health`.
- Teste manual do fluxo de fallback atual.
- Teste de registro e login em navegador compatível, sem realizar aceite de orçamento.
- Verificação de que o Worker continua servindo as páginas estáticas existentes.
