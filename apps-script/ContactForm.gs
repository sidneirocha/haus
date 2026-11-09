const PLANILHA_ID =
  "157Dg0AYnqHsQkMQzMc7M_TDRgHzIXCe8tRJbam3jPdw";

const ABA_ID = 2035711031;

// E-mails que receberão as mensagens.
const DESTINATARIOS = [
  "contato@haus.art.br"
];

// Deixe vazio para usar a conta Google que executa o script.
const REMETENTE = "";

const NOME_CLIENTE = "Haus.art.br";
const CAMPOS = {
  nome: "Nome",
  email: "Email",
  mensagem: "Fale sobre seu projeto"
};

/**
 * Execute antes de publicar ou quando o formulário mudar.
 * Não cria respostas nem envia e-mails de teste.
 */
function configurar() {
  validarDestinatarios();
  autorizarEmails();

  const planilha = SpreadsheetApp.openById(PLANILHA_ID);
  const aba = planilha.getSheets().find(sheet => sheet.getSheetId() === ABA_ID);

  if (!aba) throw new Error("A aba informada não foi encontrada.");

  const formUrl = aba.getFormUrl();
  if (!formUrl) throw new Error("Essa aba não está vinculada a um Google Forms.");

  const form = FormApp.openByUrl(formUrl);
  const mapa = {};
  const perguntas = form.getItems().filter(item => ![
    FormApp.ItemType.SECTION_HEADER,
    FormApp.ItemType.PAGE_BREAK,
    FormApp.ItemType.IMAGE,
    FormApp.ItemType.VIDEO
  ].includes(item.getType()));

  if (perguntas.length !== 3) {
    throw new Error("Este modelo exige exatamente as três perguntas de contato.");
  }

  for (const [campo, titulo] of Object.entries(CAMPOS)) {
    const encontrados = perguntas.filter(item =>
      normalizar(item.getTitle()) === normalizar(titulo)
    );

    if (encontrados.length !== 1) {
      throw new Error('Não encontrei uma única pergunta chamada "' + titulo + '".');
    }

    const item = encontrados[0];
    if (item.getType() !== FormApp.ItemType.TEXT &&
        item.getType() !== FormApp.ItemType.PARAGRAPH_TEXT) {
      throw new Error('A pergunta "' + titulo + '" precisa ser resposta curta ou parágrafo.');
    }

    mapa[campo] = item.getId();
  }

  if (new Set(Object.values(mapa)).size !== 3) {
    throw new Error("Cada campo precisa corresponder a uma pergunta diferente.");
  }

  PropertiesService.getScriptProperties().setProperties({
    FORM_ID: form.getId(),
    MAPA: JSON.stringify(mapa)
  });

  console.log("Configuração concluída.");
}

/** Execute no editor para autorizar e verificar GmailApp. */
function autorizarEmails() {
  const remetente = REMETENTE.trim();
  const aliases = GmailApp.getAliases();

  if (remetente && !aliases.some(alias =>
    alias.toLowerCase() === remetente.toLowerCase()
  )) {
    throw new Error(
      'O endereço "' + remetente +
      '" não é um alias autorizado. Configure-o no Gmail ou deixe REMETENTE vazio.'
    );
  }

  console.log(
    remetente
      ? "Alias de envio autorizado."
      : "Envio configurado com o remetente padrão da conta."
  );
}

function doGet() {
  return json({
    ok: true,
    message: "Serviço disponível. Envie os dados por POST."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    let dados;

    try {
      dados = JSON.parse(e.postData.contents);
    } catch (erro) {
      return json({ ok: false, message: "Formato de envio inválido." });
    }

    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return json({ ok: false, message: "Formato de envio inválido." });
    }

    const valores = {
      nome: texto(dados.nome),
      email: texto(dados.email),
      mensagem: texto(dados.mensagem)
    };
    const requestId = texto(dados.requestId);
    const turnstileToken = texto(dados.turnstileToken);

    if (!valores.nome || valores.nome.length > 120) {
      return json({ ok: false, message: "Informe um nome com até 120 caracteres." });
    }

    if (valores.email.length > 254 || !emailValido(valores.email)) {
      return json({ ok: false, message: "Informe um e-mail válido." });
    }

    if (!valores.mensagem || valores.mensagem.length > 5000) {
      return json({ ok: false, message: "Informe uma mensagem com até 5.000 caracteres." });
    }

    if (!/^[a-zA-Z0-9-]{20,80}$/.test(requestId)) {
      return json({ ok: false, message: "Identificador de envio inválido." });
    }

    if (!turnstileToken) {
      return json({ ok: false, message: "Conclua a verificação antispam." });
    }

    const props = PropertiesService.getScriptProperties();
    const formId = props.getProperty("FORM_ID");
    const mapaTexto = props.getProperty("MAPA");

    if (!formId || !mapaTexto) {
      return json({ ok: false, message: "Serviço ainda não configurado." });
    }

    if (!lock.tryLock(20000)) {
      return json({ ok: false, message: "Serviço ocupado. Tente novamente em instantes." });
    }

    const assinatura = calcularAssinatura(valores);
    const cache = CacheService.getScriptCache();
    const chave = "envio:" + requestId;
    const anterior = cache.get(chave);

    if (anterior) {
      const registro = JSON.parse(anterior);

      if (registro.assinatura !== assinatura) {
        return json({ ok: false, message: "Identificador já usado para outros dados." });
      }

      return json({
        ok: true,
        emailEnviado: registro.emailEnviado === true
      });
    }

    if (!validarTurnstile(turnstileToken)) {
      return json({ ok: false, message: "Verificação antispam inválida." });
    }

    const form = FormApp.openById(formId);
    if (!form.isAcceptingResponses()) {
      return json({ ok: false, message: "O formulário não está recebendo mensagens." });
    }

    const mapa = JSON.parse(mapaTexto);
    const resposta = form.createResponse();

    for (const campo of Object.keys(valores)) {
      const item = form.getItemById(Number(mapa[campo]));
      if (!item) throw new Error("Campo configurado não encontrado.");

      let itemResposta;
      if (item.getType() === FormApp.ItemType.TEXT) {
        itemResposta = item.asTextItem().createResponse(valores[campo]);
      } else if (item.getType() === FormApp.ItemType.PARAGRAPH_TEXT) {
        itemResposta = item.asParagraphTextItem().createResponse(valores[campo]);
      } else {
        throw new Error("Tipo de campo incompatível.");
      }

      resposta.withItemResponse(itemResposta);
    }

    // Primeiro grava no Forms e na planilha vinculada.
    resposta.submit();

    let emailEnviado = false;
    try {
      enviarNotificacao(valores);
      emailEnviado = true;
    } catch (erroEmail) {
      console.error("Resposta gravada, mas a notificação falhou.");
    }

    try {
      cache.put(
        chave,
        JSON.stringify({ assinatura: assinatura, emailEnviado: emailEnviado }),
        21600
      );
    } catch (erroCache) {
      console.warn("Controle temporário de repetição indisponível.");
    }

    return json({ ok: true, emailEnviado: emailEnviado });
  } catch (erro) {
    console.error("Falha ao processar envio.");
    return json({ ok: false, message: "Não foi possível confirmar o envio." });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function validarTurnstile(token) {
  const secret = PropertiesService
    .getScriptProperties()
    .getProperty("TURNSTILE_SECRET");

  if (!secret) throw new Error("TURNSTILE_SECRET não configurado.");

  const resposta = UrlFetchApp.fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        secret: secret,
        response: token
      }),
      muteHttpExceptions: true
    }
  );

  const resultado = JSON.parse(resposta.getContentText() || "{}");
  return resultado.success === true;
}

function enviarNotificacao(valores) {
  validarDestinatarios();

  const remetente = REMETENTE.trim();
  const opcoes = {
    name: NOME_CLIENTE + " — Site",
    replyTo: valores.email
  };

  if (remetente) {
    const alias = GmailApp.getAliases().find(endereco =>
      endereco.toLowerCase() === remetente.toLowerCase()
    );
    if (!alias) throw new Error("Remetente não autorizado.");
    opcoes.from = alias;
  }

  GmailApp.sendEmail(
    DESTINATARIOS.map(endereco => endereco.trim()).join(","),
    "Novo contato pelo site — " + NOME_CLIENTE,
    [
      "Nova mensagem recebida pelo site.",
      "",
      "Nome: " + valores.nome,
      "E-mail: " + valores.email,
      "",
      "Mensagem:",
      valores.mensagem,
      "",
      "A mensagem também foi registrada no Google Forms."
    ].join("\n"),
    opcoes
  );
}

function validarDestinatarios() {
  if (!Array.isArray(DESTINATARIOS) || DESTINATARIOS.length === 0 ||
      DESTINATARIOS.some(endereco =>
        typeof endereco !== "string" || !emailValido(endereco.trim())
      )) {
    throw new Error("Preencha DESTINATARIOS com os e-mails reais do cliente.");
  }
}

function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function normalizar(valor) {
  return String(valor)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s-]+/g, "");
}

function calcularAssinatura(valores) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify(valores),
      Utilities.Charset.UTF_8
    )
  );
}

function json(dados) {
  return ContentService
    .createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}
