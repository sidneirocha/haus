/**
 * Haus CRM MVP — Google Apps Script
 *
 * Configure SPREADSHEET_ID and ADMIN_KEY em Project Settings > Script properties.
 * Nunca coloque esses valores no frontend ou neste arquivo versionado.
 */
const SHEETS = {
  Clientes: ['id', 'name', 'company', 'email', 'phone', 'notes', 'createdAt', 'updatedAt'],
  Projetos: ['id', 'name', 'clientId', 'clientName', 'status', 'startDate', 'dueDate', 'nextAction', 'upsellDate', 'value', 'notes', 'createdAt', 'updatedAt'],
  Servicos: ['id', 'name', 'description', 'category', 'price', 'billing', 'active', 'createdAt', 'updatedAt'],
  Orcamentos: ['id', 'token', 'clientId', 'clientName', 'company', 'status', 'createdAt', 'expiresAt', 'notes', 'pixKey', 'paymentUrl', 'signedName', 'signedAt', 'updatedAt'],
  Itens_Orcamento: ['id', 'quoteId', 'serviceId', 'name', 'quantity', 'price', 'billing'],
  Parcelas: ['id', 'quoteId', 'dueDate', 'amount', 'paymentUrl', 'status', 'paidAt'],
  Lancamentos_Financeiros: ['id', 'date', 'description', 'type', 'category', 'amount', 'status', 'clientId', 'clientName', 'projectId', 'projectName', 'notes', 'createdAt', 'updatedAt'],
  Atividades: ['id', 'type', 'recordId', 'message', 'createdAt'],
  Configuracoes: ['key', 'value']
};

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    if (action === 'quote') return json_(publicQuote_(e.parameter.id));
    requireAdmin_(e);
    if (action === 'dashboard' || !action) return json_(dashboard_());
    if (action === 'clients') return json_(rows_('Clientes'));
    if (action === 'projects') return json_(rows_('Projetos'));
    if (action === 'services') return json_(rows_('Servicos'));
    throw new Error('Ação GET inválida.');
  } catch (error) { return jsonError_(error); }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    const action = String(body.action || '').trim();
    if (action === 'quote.accept') return json_(acceptQuote_(body));
    requireAdmin_(e, body);
    if (action === 'client.create') return json_(createRow_('Clientes', body));
    if (action === 'project.create') return json_(createRow_('Projetos', body));
    if (action === 'project.status') return json_(updateProjectStatus_(body));
    if (action === 'service.create') return json_(createRow_('Servicos', body));
    if (action === 'quote.create') return json_(createQuote_(body));
    if (action === 'installment.pay') return json_(payInstallment_(body));
    if (action === 'finance.create') return json_(createFinance_(body));
    if (action === 'finance.settle') return json_(settleFinance_(body));
    throw new Error('Ação POST inválida.');
  } catch (error) { return jsonError_(error); }
}

function setupSheets() {
  const spreadsheet = spreadsheet_();
  Object.keys(SHEETS).forEach(function(name) {
    const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
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
  const headers = event && event.headers ? event.headers : {};
  const received = (headers['X-Haus-Admin-Key'] || headers['x-haus-admin-key'] || (body && body.adminKey) || '').toString();
  if (!received || received !== expected) throw new Error('Não autorizado.');
}

function json_(data) { return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data })).setMimeType(ContentService.MimeType.JSON); }
function jsonError_(error) { return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(error.message || error) })).setMimeType(ContentService.MimeType.JSON); }
function now_() { return new Date().toISOString(); }
function id_(prefix) { return prefix + '-' + Utilities.getUuid().slice(0, 8); }

function sheet_(name) { const sheet = spreadsheet_().getSheetByName(name); if (!sheet) throw new Error('Aba ausente: ' + name); return sheet; }
function rows_(name) {
  const sheet = sheet_(name); const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  const headers = values.shift(); return values.filter(function(row) { return row.some(Boolean); }).map(function(row) { const item = {}; headers.forEach(function(header, index) { item[header] = row[index]; }); return item; });
}
function append_(name, item) { const headers = SHEETS[name]; sheet_(name).appendRow(headers.map(function(header) { return item[header] === undefined ? '' : item[header]; })); return item; }
function createRow_(name, body) {
  const stamp = now_(); const item = Object.assign({}, body, { id: id_(name.toLowerCase()), createdAt: stamp, updatedAt: stamp });
  delete item.action; delete item.adminKey; return append_(name, item);
}
function dashboard_() { return { clients: rows_('Clientes'), projects: rows_('Projetos'), services: rows_('Servicos'), quotes: quotes_(), finances: rows_('Lancamentos_Financeiros') }; }
function quotes_() { return rows_('Orcamentos').map(function(quote) { quote.items = rows_('Itens_Orcamento').filter(function(item) { return item.quoteId === quote.id; }); quote.installments = rows_('Parcelas').filter(function(item) { return item.quoteId === quote.id; }); return quote; }); }
function publicQuote_(token) { if (!token) throw new Error('Token ausente.'); const quote = quotes_().filter(function(item) { return item.token === token && ['Publicado', 'Aceito'].indexOf(item.status) >= 0; })[0]; if (!quote) throw new Error('Orçamento não encontrado.'); return quote; }
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
function createFinance_(body) { if (!body.date || !body.description || !body.type || !body.amount) throw new Error('Data, descrição, tipo e valor são obrigatórios.'); if (['Entrada', 'Saída', 'Custo'].indexOf(body.type) < 0) throw new Error('Tipo financeiro inválido.'); const item = createRow_('Lancamentos_Financeiros', { date: body.date, description: String(body.description).trim(), type: body.type, category: body.category || 'Geral', amount: Number(body.amount), status: body.status || 'Pendente', clientId: body.clientId || '', clientName: body.clientName || '', projectId: body.projectId || '', projectName: body.projectName || '', notes: body.notes || '' }); return rows_('Lancamentos_Financeiros').filter(function(row) { return row.id === item.id; })[0]; }
function settleFinance_(body) { if (!body.id) throw new Error('Lançamento inválido.'); const sheet = sheet_('Lancamentos_Financeiros'); const values = sheet.getDataRange().getValues(); const headers = values[0]; const rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Lançamento não encontrado.'); const type = values[rowIndex][headers.indexOf('type')]; sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue(type === 'Entrada' ? 'Recebido' : 'Pago'); sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now_()); return rows_('Lancamentos_Financeiros').filter(function(item) { return item.id === body.id; })[0]; }
function updateProjectStatus_(body) { if (!body.id || ['Briefing', 'Em produção', 'Em revisão', 'Concluído'].indexOf(body.status) < 0) throw new Error('Status de projeto inválido.'); const sheet = sheet_('Projetos'); const values = sheet.getDataRange().getValues(); const headers = values[0]; const rowIndex = values.findIndex(function(row) { return row[headers.indexOf('id')] === body.id; }); if (rowIndex < 1) throw new Error('Projeto não encontrado.'); sheet.getRange(rowIndex + 1, headers.indexOf('status') + 1).setValue(body.status); sheet.getRange(rowIndex + 1, headers.indexOf('updatedAt') + 1).setValue(now_()); return rows_('Projetos').filter(function(item) { return item.id === body.id; })[0]; }
