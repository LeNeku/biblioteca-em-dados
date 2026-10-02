const $ = (selector) => document.querySelector(selector);
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let procedures = [];
let selected;
let requestController;

function showTab() {
  const id = location.hash.slice(1);
  if (id === 'main') return;
  const tab = ['consultas', 'esquema', 'sobre'].includes(id) ? id : 'consultas';
  document.querySelectorAll('.panel').forEach((panel) => { panel.hidden = panel.id !== tab; });
  document.querySelectorAll('[data-tab]').forEach((link) => { if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  if (tab === 'esquema') drawRelations();
}

function sqlHighlight(sql) {
  const tokens = /(--[^\n]*|'(?:''|[^'])*'|\b(?:CREATE|ALTER|PROCEDURE|AS|BEGIN|END|SELECT|FROM|WHERE|JOIN|INNER|ON|IN|NOT|EXISTS|AND|OR|GROUP|BY|ORDER|OVER|COUNT|AVG|CAST|DECIMAL)\b)/gi;
  let output = '', offset = 0;
  for (const match of sql.matchAll(tokens)) {
    output += escape(sql.slice(offset, match.index));
    const className = match[0].startsWith('--') ? 'comment' : match[0].startsWith("'") ? 'literal' : 'keyword';
    output += `<span class="${className}">${escape(match[0])}</span>`;
    offset = match.index + match[0].length;
  }
  return output + escape(sql.slice(offset));
}

function renderCatalog() {
  const q = $('#procedure-search').value.trim().toLocaleLowerCase('pt-BR');
  const groups = [['Acervo', (p) => p.id.startsWith('livro')], ['Autoria', (p) => p.id.startsWith('autores')], ['Cadastros', (p) => !p.id.startsWith('livro') && !p.id.startsWith('autores')]];
  $('#procedure-list').innerHTML = groups.map(([name, predicate]) => {
    const entries = procedures.filter((p) => predicate(p) && `${p.id} ${p.title} ${p.description}`.toLocaleLowerCase('pt-BR').includes(q));
    if (!entries.length) return '';
    return `<section class="procedure-group"><h3>${name}</h3><ul>${entries.map((p) => `<li><button class="procedure-choice" type="button" data-id="${escape(p.id)}" aria-pressed="${selected?.id === p.id}"><strong>${escape(p.title)}</strong><small>${escape(p.ddl.split('\n')[0].replace(/^CREATE\s+PROCEDURE\s+/i, ''))}</small></button></li>`).join('')}</ul></section>`;
  }).join('') || '<p class="empty">Nenhuma procedure corresponde à busca.</p>';
}

function selectProcedure(procedure) {
  requestController?.abort(); selected = procedure;
  $('#workspace-empty').hidden = true; $('#workspace-content').hidden = false;
  $('#selected-title').textContent = procedure.title; $('#selected-description').textContent = procedure.description;
  $('#ddl-code').innerHTML = sqlHighlight(procedure.ddl);
  $('#result').innerHTML = ''; $('#result').setAttribute('aria-busy', 'false'); $('#result-status').textContent = ''; $('#run-button').disabled = false;
  $('#copy-ddl').textContent = 'Copiar código';
  $('#parameter-form').innerHTML = procedure.parameters.length ? procedure.parameters.map((p) => `<label>${escape(p.name)}<input name="${escape(p.name)}" ${p.required ? 'required' : ''} placeholder="${escape(p.type)}"></label>`).join('') : '<p class="hint">Sem parâmetros de entrada.</p>';
  renderCatalog();
  $('#selected-title').setAttribute('tabindex', '-1'); $('#selected-title').focus({ preventScroll: true });
  if (matchMedia('(max-width:650px)').matches) $('#workspace').scrollIntoView({ block: 'start' });
}

async function loadCatalog() {
  try {
    const response = await fetch('/api/procedures'); if (!response.ok) throw new Error();
    procedures = await response.json(); $('#status').textContent = `${procedures.length} procedures de leitura`;
    renderCatalog();
  } catch {
    $('#status').textContent = 'Catálogo indisponível.';
    $('#procedure-list').innerHTML = '<p class="error">Não foi possível carregar as procedures.</p><button type="button" id="retry-catalog">Tentar novamente</button>';
    $('#retry-catalog').addEventListener('click', loadCatalog);
  }
}

$('#procedure-search').addEventListener('input', renderCatalog);
$('#procedure-list').addEventListener('click', (event) => {
  const id = event.target.closest('[data-id]')?.dataset.id;
  const procedure = procedures.find((p) => p.id === id); if (procedure) selectProcedure(procedure);
});
$('#close-workspace').addEventListener('click', () => {
  requestController?.abort(); selected = undefined;
  $('#workspace-content').hidden = true; $('#workspace-empty').hidden = false; renderCatalog(); $('#procedure-search').focus();
});
$('#copy-ddl').addEventListener('click', async () => {
  if (!selected) return;
  try { await navigator.clipboard.writeText(selected.ddl); $('#copy-ddl').textContent = 'Código copiado'; }
  catch { $('#copy-ddl').textContent = 'Selecione o código para copiar'; }
});
$('#parameter-form').addEventListener('submit', (event) => event.preventDefault());
$('#run-button').addEventListener('click', async () => {
  if (!selected || !$('#parameter-form').reportValidity()) return;
  requestController?.abort(); requestController = new AbortController();
  const signal = requestController.signal, procedure = selected;
  $('#run-button').disabled = true; $('#result').setAttribute('aria-busy', 'true'); $('#result').innerHTML = ''; $('#result-status').textContent = 'Executando…';
  try {
    const response = await fetch(`/api/procedures/${encodeURIComponent(procedure.id)}/run`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parameters: Object.fromEntries(new FormData($('#parameter-form'))) }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (signal.aborted) return;
    $('#result-status').textContent = `${data.count} registro(s) retornado(s)`;
    const columns = [...new Set(data.rows.flatMap((row) => Object.keys(row)))];
    const value = (item) => item == null ? 'NULL' : typeof item === 'object' ? JSON.stringify(item) : item;
    $('#result').innerHTML = data.rows.length ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Resultados da consulta"><table><caption class="skip">${escape(procedure.title)} — resultados</caption><thead><tr>${columns.map((c) => `<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${data.rows.map((row) => `<tr>${columns.map((c) => `<td>${escape(value(row[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="empty">Consulta concluída. Nenhum registro retornado.</p>';
  } catch (error) {
    if (error.name !== 'AbortError') { $('#result-status').textContent = 'Consulta não concluída.'; $('#result').innerHTML = `<p class="error">${escape(error.message || 'Tente novamente.')}</p>`; }
  } finally {
    if (!signal.aborted) { $('#run-button').disabled = false; $('#result').setAttribute('aria-busy', 'false'); }
  }
});

// Layout and column names follow the user's reference. Only declared FKs have lines.
const schema = [
  { name: 'LivroAutor', x: 190, y: 90, fields: [['IdLivro','123','PK FK'],['IdAutor','123','PK FK']] },
  { name: 'Autor', x: 440, y: 30, fields: [['IdAutor','123','PK'],['NomeAutor','A-Z'],['SobrenomeAutor','A-Z']] },
  { name: 'Livro', x: 440, y: 240, fields: [['IdLivro','123','PK'],['NomeLivro','A-Z'],['ISBN13','A-Z'],['DataPub','◷'],['PrecoLivro','123'],['NumeroPaginas','123'],['IdEditora','123','FK'],['IdAssunto','123','FK']] },
  { name: 'Assunto', x: 710, y: 225, fields: [['IdAssunto','123','PK'],['NomeAssunto','A-Z']] },
  { name: 'Editora', x: 710, y: 430, fields: [['IdEditora','123','PK'],['NomeEditora','A-Z']] },
  { name: 'auditoriaLivro', x: 20, y: 615, fields: [['IdAlteracao','123','PK'],['IdLivro','123','FK'],['dataalteracao','◷'],['tipooperacao','A-Z']] },
  { name: 'loglivros', x: 220, y: 615, fields: [['IdLog','123','PK'],['idlivro','123'],['DataInsercao','◷']] },
  { name: 'Historicoeditora', x: 420, y: 615, fields: [['IdLivro','123'],['EditoraAntigo','123'],['EditoraNovo','123'],['dataalteracao','◷']] },
  { name: 'historicopreco', x: 620, y: 600, fields: [['idhistorico','123','PK'],['idlivro','123'],['precoantigo','123'],['preconovo','123'],['dataalteracao','◷']] },
  { name: 'vw_LivrosAutores', x: 880, y: 510, view: true, width: 215, fields: [['NomeLivro','A-Z'],['DataPub','◷'],['idAssunto','123'],['idEditora','123'],['ISBN13','A-Z'],['NumeroPaginas','123'],['PrecoLivro','123'],['IdAutor','123'],['NomeAutor','A-Z'],['SobrenomeAutor','A-Z']] }
];
const relations = [
  ['LivroAutor','IdAutor','Autor','IdAutor'], ['LivroAutor','IdLivro','Livro','IdLivro'],
  ['Livro','IdAssunto','Assunto','IdAssunto'], ['Livro','IdEditora','Editora','IdEditora'],
  ['auditoriaLivro','IdLivro','Livro','IdLivro']
];
$('#schema-nodes').innerHTML = schema.map((node) => `<article class="schema-node ${node.view ? 'is-view' : ''}" style="left:${node.x}px;top:${node.y}px;width:${node.width || 170}px" id="node-${node.name}" aria-label="${node.view ? 'View' : 'Tabela'} ${node.name}"><h3>${escape(node.name)}</h3><ul>${node.fields.map(([name, kind, key]) => `<li class="schema-field ${key ? 'is-key' : ''}" data-field="${name}"><span class="field-kind" aria-hidden="true">${kind}</span><span class="field-name">${name}</span>${key ? `<span class="field-key">${key}</span>` : ''}</li>`).join('')}</ul></article>`).join('');

function drawRelations() {
  if ($('#esquema').hidden) return;
  const stage = $('#schema-stage').getBoundingClientRect();
  $('#schema-lines').innerHTML = relations.map(([source, sourceField, target, targetField]) => {
    const from = $(`#node-${source} [data-field="${sourceField}"]`).getBoundingClientRect();
    const to = $(`#node-${target} [data-field="${targetField}"]`).getBoundingClientRect();
    const x1 = from.right - stage.left, y1 = from.top + from.height / 2 - stage.top;
    const x2 = to.left - stage.left, y2 = to.top + to.height / 2 - stage.top;
    if (source === 'auditoriaLivro') {
      // Route outside the history row so the line never crosses loglivros.
      const x = from.left - stage.left, elbow = x - 12;
      return `<path d="M${x} ${y1} H${elbow} V550 L${x2 - 24} ${y2} H${x2}"/><circle cx="${x}" cy="${y1}" r="3"/><circle cx="${x2}" cy="${y2}" r="3"/><text x="${x - 14}" y="${y1 - 7}">N</text>`;
    }
    const start = x1 + 18, end = x2 - 22;
    return `<path d="M${x1} ${y1} H${start} L${end} ${y2} H${x2}"/><circle cx="${x1}" cy="${y1}" r="3"/><circle cx="${x2}" cy="${y2}" r="3"/><text x="${x1 + 6}" y="${y1 - 7}">N</text><text x="${x2 - 14}" y="${y2 - 7}">1</text>`;
  }).join('');
}
new ResizeObserver(drawRelations).observe($('#schema-stage'));
window.addEventListener('hashchange', showTab);
showTab(); loadCatalog();
