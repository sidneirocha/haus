/**
 * Haus CRM MVP — Google Apps Script
 *
 * Configure SPREADSHEET_ID, ADMIN_EMAIL e ADMIN_KEY em Project Settings > Script properties.
 * Nunca coloque esses valores no frontend ou neste arquivo versionado.
 */
const SHEETS = {
  Clientes: ['id', 'name', 'company', 'email', 'phone', 'notes', 'createdAt', 'updatedAt'],
  Projetos: ['id', 'name', 'clientId', 'clientName', 'status', 'startDate', 'dueDate', 'nextAction', 'upsellDate', 'value', 'notes', 'solutions', 'createdAt', 'updatedAt'],
  Servicos: ['id', 'name', 'description', 'category', 'price', 'billing', 'active', 'createdAt', 'updatedAt'],
  Orcamentos: ['id', 'token', 'clientId', 'clientName', 'company', 'status', 'createdAt', 'expiresAt', 'notes', 'pixKey', 'paymentUrl', 'signedName', 'signedAt', 'updatedAt'],
  Itens_Orcamento: ['id', 'quoteId', 'serviceId', 'name', 'quantity', 'price', 'billing'],
  Parcelas: ['id', 'quoteId', 'dueDate', 'amount', 'paymentUrl', 'status', 'paidAt'],
  Lancamentos_Financeiros: ['id', 'date', 'description', 'type', 'category', 'amount', 'status', 'recurrence', 'nextDueDate', 'clientId', 'clientName', 'projectId', 'projectName', 'notes', 'createdAt', 'updatedAt'],
  Modelos_Contrato: ['id', 'name', 'description', 'content', 'version', 'active', 'createdAt', 'updatedAt'],
  Contratos: ['id', 'token', 'clientId', 'clientName', 'company', 'projectId', 'projectName', 'quoteId', 'modelId', 'modelName', 'title', 'content', 'status', 'createdAt', 'updatedAt', 'expiresAt', 'signedName', 'signedEmail', 'signerDocument', 'signerIp', 'signedAt'],
  Eventos_Contrato: ['id', 'contractId', 'type', 'occurredAt', 'actor', 'metadata'],
  AI_Rascunhos: ['id', 'briefing', 'clientId', 'clientName', 'status', 'result', 'model', 'createdAt', 'updatedAt'],
  Atividades: ['id', 'type', 'recordId', 'message', 'createdAt'],
  Configuracoes: ['key', 'value'],
  Form_Responses: ['timestamp', 'nome', 'email', 'mensagem', 'requestId', 'turnstileHostname']
};

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    if (action === 'quote') return json_(publicQuote_(e.parameter.id));
    if (action === 'contract') return json_(publicContract_(e.parameter.id));
    const body = getBody_(e, action);
    if (action === 'auth.login' || isPublicAction_(action)) return json_(dispatchAction_(action, body));
    requireAdmin_(e, body);
    return json_(dispatchAction_(action || 'dashboard', body));
  } catch (error) { return jsonError_(error); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = String(body.action || '').trim();
    if (action === 'auth.login' || isPublicAction_(action) || action === 'contact.create') return json_(dispatchAction_(action, body));
    requireAdmin_(e, body);
    return json_(dispatchAction_(action, body));
  } catch (error) { return jsonError_(error); }
}

function getBody_(event, action) {
  var body = {};
  var payload = event && event.parameter && event.parameter.payload;
  if (payload) {
    try { body = JSON.parse(payload); } catch (error) { throw new Error('Payload inválido.'); }
  }
  body.action = action || body.action || 'dashboard';
  return body;
}

function isPublicAction_(action) {
  return ['quote.accept', 'contract.view', 'contract.sign'].indexOf(action) >= 0;
}

function dispatchAction_(action, body) {
  if (action === 'dashboard' || !action) return dashboard_();
  if (action === 'clients') return rows_('Clientes');
  if (action === 'projects') return rows_('Projetos');
  if (action === 'services') return rows_('Servicos');
  if (action === 'contact.create') return createContact_(body);
  if (action === 'quote.accept') return acceptQuote_(body);
  if (action === 'contract.view') return viewContract_(body);
  if (action === 'contract.sign') return signContract_(body);
  if (action === 'auth.login') return login_(body);
  if (action === 'client.create') return createRow_('Clientes', body);
  if (action === 'client.update') return updateRow_('Clientes', body);
  if (action === 'client.delete') return deleteClient_(body);
  if (action === 'project.create') return createRow_('Projetos', body);
  if (action === 'project.status') return updateProjectStatus_(body);
  if (action === 'project.update') return updateRow_('Projetos', body);
  if (action === 'project.delete') return deleteRow_('Projetos', body);
  if (action === 'service.create') return createRow_('Servicos', body);
  if (action === 'service.update') return updateRow_('Servicos', body);
  if (action === 'service.delete') return deleteService_(body);
  if (action === 'quote.create') return createQuote_(body);
  if (action === 'quote.update') return updateQuote_(body);
  if (action === 'quote.publish') return publishQuote_(body);
  if (action === 'quote.reactivate') return reactivateQuote_(body);
  if (action === 'quote.delete') return deleteQuote_(body);
  if (action === 'installment.pay') return payInstallment_(body);
  if (action === 'finance.create') return createFinance_(body);
  if (action === 'finance.update') return updateRow_('Lancamentos_Financeiros', body);
  if (action === 'finance.settle') return settleFinance_(body);
  if (action === 'finance.delete') return deleteRow_('Lancamentos_Financeiros', body);
  if (action === 'contract-model.create') return createContractModel_(body);
  if (action === 'contract-model.update') return updateContractModel_(body);
  if (action === 'contract-model.delete') return deleteContractModel_(body);
  if (action === 'contract.create') return createContract_(body);
  if (action === 'contract.update') return updateContract_(body);
  if (action === 'contract.cancel') return cancelContract_(body);
  if (action === 'contract.delete') return deleteContract_(body);
  if (action === 'contract.publish') return publishContract_(body);
  if (action === 'ai.draftQuote') return createAiDraft_(body);
  throw new Error('Ação inválida.');
}

function setupSheets() {
  const spreadsheet = spreadsheet_();
  Object.keys(SHEETS).forEach(function(name) {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
    else { var current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; SHEETS[name].forEach(function(header) { if (current.indexOf(header) < 0) { sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header); current.push(header); } }); }
  });
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Configure SPREADSHEET_ID nas propriedades do script.');
  return SpreadsheetApp.openById(id);
}

function requireAdmin_(event, body) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!expected) throw new Error('Configure ADMIN_KEY nas propriedades do script.');
  const session = session_(event, body);
  if (session) return session;
  const headers = event && event.headers ? event.headers : {};
  const received = (headers['X-Haus-Admin-Key'] || headers['x-haus-admin-key'] || (body && body.adminKey) || '').toString();
  if (!received || received !== expected) throw new Error('Não autorizado.');
}

const AUTH_CACHE_PREFIX = 'haus-crm-session-';
const AUTH_SESSION_TTL = 21600;

function login_(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const adminKey = String(body.adminKey || '');
  const properties = PropertiesService.getScriptProperties();
  const expectedEmail = String(properties.getProperty('ADMIN_EMAIL') || '').trim().toLowerCase();
  const expectedKey = String(properties.getProperty('ADMIN_KEY') || '');
  if (!expectedEmail || !expectedKey) throw new Error('Configure ADMIN_EMAIL e ADMIN_KEY nas propriedades do script.');
  if (email !== expectedEmail || adminKey !== expectedKey) throw new Error('E-mail ou chave administrativa inválidos.');
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL * 1000).toISOString();
  CacheService.getScriptCache().put(AUTH_CACHE_PREFIX + token, JSON.stringify({ email: email, expiresAt: expiresAt }), AUTH_SESSION_TTL);
  return { token: token, email: email, expiresAt: expiresAt };
}

function session_(event, body) {
  const headers = event && event.headers ? event.headers : {};
  const token = String(headers['X-Haus-Session'] || headers['x-haus-session'] || (event && event.parameter && event.parameter.session) || (body && body.sessionToken) || '');
  if (!token) return null;
  const raw = CacheService.getScriptCache().get(AUTH_CACHE_PREFIX + token);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (error) { return null; }
}

function json_(data) { return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data })).setMimeType(ContentService.MimeType.JSON); }
function jsonError_(error) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error.message || error) })).setMimeType(ContentService.MimeType.JSON); }
function now_() { return new Date().toISOString(); }
function id_(prefix) { return prefix + '-' + Utilities.getUuid().slice(0, 8); }

function sheet_(name) { const sheet = spreadsheet_().getSheetByName(name); if (!sheet) throw new Error('Aba ausente: ' + name); return sheet; }
function rows_(name) {
  const sheet = sheet_(name); const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  const headers = values.shift(); return values.filter(function(row) { return row.some(Boolean); }).map(function(row) { const item = {}; headers.forEach(function(header, index) { item[header] = row[index]; if (name === 'Projetos' && header === 'solutions' && typeof item[header] === 'string') { try { item[header] = item[header] ? JSON.parse(item[header]) : []; } catch (error) { item[header] = []; } } }); return item; });
}
function append_(name, item) { const headers = SHEETS[name]; sheet_(name).appendRow(headers.map(function(header) { return item[header] === undefined ? '' : item[header]; })); return item; }
function createRow_(name, body) {
  const stamp = now_(); const item = Object.assign({}, body, { id: id_(name.toLowerCase()), createdAt: stamp, updatedAt: stamp });
  delete item.action; delete item.adminKey; delete item.sessionToken; return append_(name, item);
}
function dashboard_() {
  syncExpiredQuotes_();
  return { clients: rows_('Clientes'), projects: rows_('Projetos'), services: rows_('Servicos'), quotes: quotes_(), finances: rows_('Lancamentos_Financeiros'), contractModels: rows_('Modelos_Contrato'), contracts: contracts_(), aiDrafts: aiDrafts_() };
}
function quoteExpired_(quote) {
  if (!quote || !quote.expiresAt) return false;
  var expiresAt = new Date(String(quote.expiresAt) + 'T23:59:59');
  return !isNaN(expiresAt.getTime()) && expiresAt < new Date();
}
function syncExpiredQuotes_() {
  var sheet = sheet_('Orcamentos');
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;
  var headers = values[0];
  var statusColumn = headers.indexOf('status');
  var expiresColumn = headers.indexOf('expiresAt');
  var updatedColumn = headers.indexOf('updatedAt');
  if (statusColumn < 0 || expiresColumn < 0) return;
  var stamp = now_();
  for (var i = 1; i < values.length; i++) {
    var status = values[i][statusColumn];
    var expiresAt = values[i][expiresColumn];
    if (status === 'Publicado' && expiresAt && quoteExpired_({ expiresAt: expiresAt })) {
      sheet.getRange(i + 1, statusColumn + 1).setValue('Expirado');
      if (updatedColumn >= 0) sheet.getRange(i + 1, updatedColumn + 1).setValue(stamp);
    }
  }
}
function quotes_() { return rows_('Orcamentos').map(function(quote) { if (quote.status === 'Publicado' && quoteExpired_(quote)) quote.status = 'Expirado'; quote.items = rows_('Itens_Orcamento').filter(function(item) { return item.quoteId === quote.id; }); quote.installments = rows_('Parcelas').filter(function(item) { return item.quoteId === quote.id; }); return quote; }); }
function publicQuote_(token) {
  if (!token) throw new Error('Token ausente.');
  var quote = quotes_().filter(function(item) { return item.token === token; })[0];
  if (!quote) throw new Error('Orçamento não encontrado.');
  if (quote.status === 'Publicado' && quoteExpired_(quote)) {
    syncExpiredQuotes_();
    quote.status = 'Expirado';
  }
  if (['Publicado', 'Aceito', 'Expirado'].indexOf(quote.status) < 0) throw new Error('Orçamento não está disponível publicamente.');
  return quote;
}
function contracts_() {
  const events = rows_('Eventos_Contrato');
  return rows_('Contratos').map(function(contract) {
    contract.events = events.filter(function(event) { return event.contractId === contract.id; }).sort(function(a, b) { return new Date(b.occurredAt) - new Date(a.occurredAt); });
    return contract;
  });
}
function aiDrafts_() {
  return rows_('AI_Rascunhos').map(function(draft) {
    if (typeof draft.result === 'string') { try { draft.result = JSON.parse(draft.result || '{}'); } catch (error) { draft.result = {}; } }
    return draft;
  });
}
function publicContract_(token) {
  if (!token) throw new Error('Token ausente.');
  const contract = contracts_().filter(function(item) { return item.token === token && ['Enviado', 'Visualizado', 'Assinado'].indexOf(item.status) >= 0; })[0];
  if (!contract) throw new Error('Contrato não encontrado ou ainda não publicado.');
  if (contract.expiresAt && new Date(contract.expiresAt + 'T23:59:59') < new Date() && contract.status !== 'Assinado') throw new Error('Este contrato expirou.');
  return contract;
}
function contractById_(id) { return contracts_().filter(function(item) { return item.id === id; })[0]; }
function addContractEvent_(contractId, type, actor, metadata) { return append_('Eventos_Contrato', { id: id_('evt'), contractId: contractId, type: type, occurredAt: now_(), actor: actor || 'Haus', metadata: metadata || '' }); }
function createContractModel_(body) {
  if (!String(body.name || '').trim() || !String(body.description || '').trim() || !String(body.content || '').trim()) throw new Error('Nome, descrição e conteúdo do modelo são obrigatórios.');
  return createRow_('Modelos_Contrato', { name: String(body.name).trim(), description: String(body.description).trim(), content: String(body.content), version: 1, active: body.active !== false, updatedAt: now_() });
}
function updateContractModel_(body) {
  const model = rows_('Modelos_Contrato').filter(function(item) { return item.id === body.id; })[0];
  if (!model) throw new Error('Modelo de contrato não encontrado.');
  return updateRow_('Modelos_Contrato', { id: body.id, name: String(body.name || '').trim(), description: String(body.description || '').trim(), content: String(body.content || ''), active: body.active !== false, version: Number(model.version || 1) + 1 });
}
function deleteContractModel_(body) {
  if (contracts_().some(function(item) { return item.modelId === body.id; })) throw new Error('Este modelo está vinculado a um contrato. Arquive-o em vez de excluí-lo.');
  return deleteRow_('Modelos_Contrato', body);
}
function createContract_(body) {
  if (!body.clientId || !body.modelId || !String(body.title || '').trim() || !String(body.content || '').trim() || !body.expiresAt) throw new Error('Cliente, modelo, título, conteúdo e validade são obrigatórios.');
  const contract = createRow_('Contratos', { token: 'haus-contrato-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16), clientId: body.clientId, clientName: body.clientName || '', company: body.company || '', projectId: body.projectId || '', projectName: body.projectName || '', quoteId: body.quoteId || '', modelId: body.modelId, modelName: body.modelName || '', title: String(body.title).trim(), content: String(body.content), status: 'Rascunho', expiresAt: body.expiresAt, signedName: '', signedEmail: '', signerDocument: '', signerIp: '', signedAt: '' });
  addContractEvent_(contract.id, 'Criado', 'Haus', 'Versão inicial do contrato.');
  return contractById_(contract.id);
}
function updateContract_(body) {
  if (!body.id || !body.clientId || !body.modelId || !String(body.title || '').trim() || !String(body.content || '').trim() || !body.expiresAt) throw new Error('Cliente, modelo, título, conteúdo e validade são obrigatórios.');
  const contract = contractById_(body.id);
  if (!contract) throw new Error('Contrato não encontrado.');
  if (contract.status === 'Assinado') throw new Error('Contratos assinados não podem ser editados.');
  updateRow_('Contratos', { id: body.id, clientId: body.clientId, clientName: body.clientName || '', company: body.company || '', projectId: body.projectId || '', projectName: body.projectName || '', quoteId: body.quoteId || '', modelId: body.modelId, modelName: body.modelName || '', title: String(body.title).trim(), content: String(body.content), expiresAt: body.expiresAt });
  addContractEvent_(body.id, 'Atualizado', 'Haus', 'Dados e conteúdo atualizados.');
  return contractById_(body.id);
}
function cancelContract_(body) {
  const contract = contractById_(body.id);
  if (!contract) throw new Error('Contrato não encontrado.');
  if (contract.status === 'Assinado') throw new Error('Contratos assinados não podem ser cancelados.');
  updateRow_('Contratos', { id: body.id, status: 'Cancelado' });
  addContractEvent_(body.id, 'Cancelado', 'Haus', 'Contrato cancelado manualmente.');
  return contractById_(body.id);
}
function deleteContract_(body) {
  const contract = contractById_(body.id);
  if (!contract) throw new Error('Contrato não encontrado.');
  if (['Rascunho', 'Cancelado'].indexOf(contract.status) < 0) throw new Error('Somente rascunhos ou contratos cancelados podem ser excluídos.');
  const result = deleteRow_('Contratos', body);
  const sheet = sheet_('Eventos_Contrato');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const contractColumn = headers.indexOf('contractId');
  for (var i = values.length - 1; i >= 1; i--) if (values[i][contractColumn] === body.id) sheet.deleteRow(i + 1);
  return result;
}
function publishContract_(body) {
  const contract = contractById_(body.id);
  if (!contract) throw new Error('Contrato não encontrado.');
  if (contract.status === 'Assinado') throw new Error('Um contrato assinado não pode ser republicado.');
  if (contract.status === 'Cancelado') throw new Error('Um contrato cancelado não pode ser republicado.');
  updateRow_('Contratos', { id: body.id, status: 'Enviado' });
  addContractEvent_(body.id, 'Publicado', 'Haus', 'Link público disponibilizado.');
  return contractById_(body.id);
}
function viewContract_(body) {
  const contract = publicContract_(body.token);
  if (contract.status === 'Enviado') { updateRow_('Contratos', { id: contract.id, status: 'Visualizado' }); addContractEvent_(contract.id, 'Visualizado', 'Cliente', 'Abertura do link público.'); }
  return publicContract_(body.token);
}
function signContract_(body) {
  if (!body.consent || String(body.signedName || '').trim().length < 3 || String(body.signedEmail || '').indexOf('@') < 1 || String(body.signerDocument || '').replace(/\D/g, '').length < 11) throw new Error('Informe nome completo, e-mail, CPF/CNPJ e aceite os termos.');
  const contract = publicContract_(body.token);
  if (['Enviado', 'Visualizado'].indexOf(contract.status) < 0) throw new Error('Este contrato não está disponível para assinatura.');
  const signedAt = now_();
  updateRow_('Contratos', { id: contract.id, status: 'Assinado', signedName: String(body.signedName).trim(), signedEmail: String(body.signedEmail).trim(), signerDocument: String(body.signerDocument).trim(), signerIp: String(body.signerIp || ''), signedAt: signedAt });
  addContractEvent_(contract.id, 'Assinado', String(body.signedName).trim(), 'Consentimento: ' + String(body.consent));
  return contractById_(contract.id);
}
function createAiDraft_(body) {
  if (!String(body.briefing || '').trim()) throw new Error('Descreva o briefing para gerar um rascunho.');
  const client = rows_('Clientes').filter(function(item) { return item.id === body.clientId; })[0];
  const services = rows_('Servicos').filter(function(item) { return item.active !== false; }).slice(0, 2).map(function(item) { return { serviceId: item.id, name: item.name, quantity: 1, price: Number(item.price || 0), billing: item.billing || 'Uma vez' }; });
  const result = { items: services, notes: 'Rascunho preparado pelo Apps Script. Revise escopo, prazo e valores antes de publicar.', paymentTerms: 'Definir condições de pagamento após revisão humana.', alerts: ['Revisão humana obrigatória antes do envio.'] };
  const draft = createRow_('AI_Rascunhos', { briefing: String(body.briefing).trim(), clientId: client ? client.id : '', clientName: client ? client.company : '', status: 'Rascunho', result: JSON.stringify(result), model: 'rules-ready', updatedAt: now_() });
  draft.result = result;
  return draft;
}
function createQuote_(body) {
  if (!body.clientId || !body.items || !body.items.length) throw new Error('Cliente e itens são obrigatórios.');
  const stamp = now_(); const token = Utilities.getUuid().replace(/-/g, '').slice(0, 16); const quote = append_('Orcamentos', { id: id_('orc'), token: token, clientId: body.clientId, clientName: body.clientName || '', company: body.company || '', status: 'Rascunho', createdAt: stamp, expiresAt: body.expiresAt || '', notes: body.notes || '', pixKey: body.pixKey || '', paymentUrl: body.paymentUrl || '', signedName: '', signedAt: '', updatedAt: stamp });
  body.items.forEach(function(item) { append_('Itens_Orcamento', { id: id_('item'), quoteId: quote.id, serviceId: item.serviceId || '', name: item.name || '', quantity: item.quantity || 1, price: item.price || 0, billing: item.billing || 'Uma vez' }); }); return publicQuoteDraft_(quote.id);
}
function publicQuoteDraft_(id) { return quotes_().filter(function(item) { return item.id === id; })[0]; }
function acceptQuote_(body) {
  if (!body.token || !body.signedName || String(body.signedName).trim().length < 2) throw new Error('Nome para aceite é obrigatório.');
  const quote = publicQuote_(body.token); const sheet = sheet_('Orcamentos'); const values = sheet.getDataRange().getValues(); const headers = values[0]; const rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === quote.id; }); if (rowIndex < 1) throw new Error('Orçamento não encontrado.');
  const statusCol = headers.indexOf('status') + 1; const nameCol = headers.indexOf('signedName') + 1; const signedAtCol = headers.indexOf('signedAt') + 1; const updatedCol = headers.indexOf('updatedAt') + 1; sheet.getRange(rowIndex + 1, statusCol).setValue('Aceito'); sheet.getRange(rowIndex + 1, nameCol).setValue(String(body.signedName).trim()); sheet.getRange(rowIndex + 1, signedAtCol).setValue(now_()); sheet.getRange(rowIndex + 1, updatedCol).setValue(now_()); return publicQuote_(body.token);
}
function payInstallment_(body) { if (!body.quoteId || !body.installmentId) throw new Error('Parcela inválida.'); const sheet = sheet_('Parcelas'); const values = sheet.getDataRange().getValues(); const headers = values[0]; const rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.installmentId && row[headers.indexOf('quoteId')] === body.quoteId; }); if (rowIndex < 1) throw new Error('Parcela não encontrada.'); sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue('Pago'); sheet.getRange(rowIndex + 1, headers.indexOf('paidAt') + 1).setValue(now_()); return rows_('Parcelas').filter(function(item) { return item.id === body.installmentId; })[0]; }
function createFinance_(body) { if (!body.date || !body.description || !body.type || !body.amount) throw new Error('Data, descrição, tipo e valor são obrigatórios.'); if (['Entrada', 'Saída', 'Custo'].indexOf(body.type) < 0) throw new Error('Tipo financeiro inválido.'); const item = createRow_('Lancamentos_Financeiros', { date: body.date, description: String(body.description).trim(), type: body.type, category: body.category || 'Geral', amount: Number(body.amount), status: body.status || 'Pendente', recurrence: body.recurrence || 'Nenhuma', nextDueDate: body.nextDueDate || '', clientId: body.clientId || '', clientName: body.clientName || '', projectId: body.projectId || '', projectName: body.projectName || '', notes: body.notes || '' }); return rows_('Lancamentos_Financeiros').filter(function(row) { return row.id === item.id; })[0]; }
function settleFinance_(body) { if (!body.id) throw new Error('Lançamento inválido.'); const sheet = sheet_('Lancamentos_Financeiros'); const values = sheet.getDataRange().getValues(); const headers = values[0]; const rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Lançamento não encontrado.'); const type = values[rowIndex][headers.indexOf('type')]; sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue(type === 'Entrada' ? 'Recebido' : 'Pago'); sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now_()); return rows_('Lancamentos_Financeiros').filter(function(item) { return item.id === body.id; })[0]; }
function updateProjectStatus_(body) { if (!body.id || !String(body.status || '').trim()) throw new Error('Status de projeto inválido.'); const sheet = sheet_('Projetos'); const values = sheet.getDataRange().getValues(); const headers = values[0]; const rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Projeto não encontrado.'); sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue(String(body.status).trim()); sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now_()); return rows_('Projetos').filter(function(item) { return item.id === body.id; })[0]; }
function createContact_(body) { if (!body.nome || !body.email || !body.mensagem || !body.turnstileToken) throw new Error('Nome, e-mail, mensagem e verificação antispam são obrigatórios.'); var verification = verifyTurnstile_(body.turnstileToken); if (!verification.success) throw new Error('Verificação antispam inválida.'); var sheet = spreadsheet_().getSheetByName('Form_Responses') || spreadsheet_().insertSheet('Form_Responses'); if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, SHEETS.Form_Responses.length).setValues([SHEETS.Form_Responses]); var item = { timestamp: now_(), nome: String(body.nome).trim(), email: String(body.email).trim(), mensagem: String(body.mensagem).trim(), requestId: body.requestId || '', turnstileHostname: verification.hostname || '' }; sheet.appendRow(SHEETS.Form_Responses.map(function(header) { return item[header] || ''; })); return { received: true }; }
function verifyTurnstile_(token) { var secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET'); if (!secret) throw new Error('Configure TURNSTILE_SECRET nas propriedades do script.'); var response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ secret: secret, response: token }), muteHttpExceptions: true }); return JSON.parse(response.getContentText() || '{}'); }
 function updateRow_(name, body) { if (!body.id) throw new Error('Registro inválido.'); var sheet = sheet_(name); var values = sheet.getDataRange().getValues(); var headers = values[0]; var rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Registro não encontrado.'); var updated = Object.assign({}, body, { updatedAt: now_() }); delete updated.action; delete updated.adminKey; delete updated.sessionToken; delete updated.id; Object.keys(updated).forEach(function(key) { var col = headers.indexOf(key); if (col >= 0) sheet.getRange(rowIndex + 1, col + 1).setValue(updated[key]); }); return rows_(name).filter(function(item) { return item.id === body.id; })[0]; }
function deleteRow_(name, body) { if (!body.id) throw new Error('Registro inválido.'); var sheet = sheet_(name); var values = sheet.getDataRange().getValues(); var headers = values[0]; var idColumn = headers.indexOf('id'); var rowIndex = values.findIndex(function(row) { return row[idColumn] === body.id; }); if (rowIndex < 1) throw new Error('Registro não encontrado.'); sheet.deleteRow(rowIndex + 1); return { id: body.id }; }
function deleteClient_(body) { if (!body.id) throw new Error('Registro inválido.'); if (rows_('Projetos').some(function(item) { return item.clientId === body.id; }) || rows_('Orcamentos').some(function(item) { return item.clientId === body.id; })) throw new Error('Este cliente possui projetos ou orçamentos vinculados.'); return deleteRow_('Clientes', body); }
function deleteService_(body) { if (!body.id) throw new Error('Registro inválido.'); if (rows_('Projetos').some(function(project) { return (project.solutions || []).some(function(solution) { return (solution.serviceId || solution.id) === body.id; }); }) || rows_('Itens_Orcamento').some(function(item) { return item.serviceId === body.id; })) throw new Error('Este serviço está vinculado a um projeto ou orçamento. Desative-o em vez de excluí-lo.'); return deleteRow_('Servicos', body); }
function deleteQuote_(body) { var result = deleteRow_('Orcamentos', body); var sheet = sheet_('Itens_Orcamento'); var values = sheet.getDataRange().getValues(); var headers = values[0]; var quoteColumn = headers.indexOf('quoteId'); for (var i = values.length - 1; i >= 1; i--) { if (values[i][quoteColumn] === body.id) sheet.deleteRow(i + 1); } var installmentSheet = sheet_('Parcelas'); var installmentValues = installmentSheet.getDataRange().getValues(); var installmentHeaders = installmentValues[0]; var installmentQuoteColumn = installmentHeaders.indexOf('quoteId'); for (var j = installmentValues.length - 1; j >= 1; j--) { if (installmentValues[j][installmentQuoteColumn] === body.id) installmentSheet.deleteRow(j + 1); } return result; }
function updateQuote_(body) { if (!body.id || !body.items || !body.items.length) throw new Error('Orçamento e itens são obrigatórios.'); var quote = updateRow_('Orcamentos', body); var itemSheet = sheet_('Itens_Orcamento'); var values = itemSheet.getDataRange().getValues(); var headers = values[0]; for (var i = values.length - 1; i >= 1; i--) { if (values[i][headers.indexOf('quoteId')] === body.id) itemSheet.deleteRow(i + 1); } body.items.forEach(function(item) { append_('Itens_Orcamento', { id: id_('item'), quoteId: body.id, serviceId: item.serviceId || '', name: item.name || '', quantity: item.quantity || 1, price: item.price || 0, billing: item.billing || 'Uma vez' }); }); return publicQuoteDraft_(quote.id); }
function publishQuote_(body) { if (!body.id) throw new Error('Orçamento inválido.'); var sheet = sheet_('Orcamentos'); var values = sheet.getDataRange().getValues(); var headers = values[0]; var rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Orçamento não encontrado.'); var expiresAt = new Date(String(values[rowIndex][headers.indexOf('expiresAt')]) + 'T12:00:00'); if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error('Defina uma validade futura antes de publicar.'); sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue('Publicado'); sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now_()); return publicQuoteDraft_(body.id); }
function reactivateQuote_(body) { if (!body.id || !body.expiresAt) throw new Error('Orçamento e nova validade são obrigatórios.'); var expiresAt = new Date(String(body.expiresAt) + 'T12:00:00'); if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error('A nova validade precisa ser futura.'); var sheet = sheet_('Orcamentos'); var values = sheet.getDataRange().getValues(); var headers = values[0]; var rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Orçamento não encontrado.'); sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue('Publicado'); sheet.getRange(rowIndex + 1, headers.indexOf('expiresAt') + 1).setValue(String(body.expiresAt)); sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now_()); return publicQuoteDraft_(body.id); }
