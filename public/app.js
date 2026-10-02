const list = document.querySelector('#procedure-list');
const workspace = document.querySelector('#workspace');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const resultStatus = document.querySelector('#result-status');
let selected;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function displayValue(value) { return value === null ? '—' : typeof value === 'object' ? JSON.stringify(value) : value; }

function showTab(id) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('is-active', tab.dataset.tab === id));
  document.querySelectorAll('.panel').forEach((panel) => { panel.hidden = panel.id !== id; });
  if (id !== 'consultas') workspace.hidden = true;
}

function renderRows(rows) {
  if (!rows.length) { result.innerHTML = '<p class="empty">A consulta foi executada, mas não retornou registros.</p>'; return; }
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  result.innerHTML = `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(displayValue(row[column]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function selectProcedure(procedure) {
  selected = procedure; workspace.hidden = false; result.innerHTML = ''; resultStatus.textContent = '';
  document.querySelector('#selected-title').textContent = procedure.title;
  document.querySelector('#selected-description').textContent = procedure.description;
  document.querySelector('#ddl-code').textContent = procedure.ddl;
  document.querySelector('#parameter-form').innerHTML = procedure.parameters.length
    ? procedure.parameters.map((parameter) => `<label>${escapeHtml(parameter.name)}<input name="${escapeHtml(parameter.name)}" ${parameter.required ? 'required' : ''} placeholder="${escapeHtml(parameter.type)}" /></label>`).join('')
    : '<p class="hint">Esta procedure não recebe parâmetros.</p>';
  workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function load() {
  try {
    const response = await fetch('/api/procedures'); if (!response.ok) throw new Error();
    const procedures = await response.json(); status.textContent = `${procedures.length} consultas prontas`;
    list.innerHTML = procedures.map((procedure, index) => `<article class="card"><p class="eyebrow">QUERY ${String(index + 1).padStart(2, '0')}</p><h3>${escapeHtml(procedure.title)}</h3><p>${escapeHtml(procedure.description)}</p><button class="secondary" data-id="${escapeHtml(procedure.id)}">Consultar <span>↗</span></button></article>`).join('');
    list.addEventListener('click', (event) => { const id = event.target.closest('button')?.dataset.id; if (id) selectProcedure(procedures.find((procedure) => procedure.id === id)); });
  } catch { status.textContent = 'Não foi possível carregar o catálogo'; }
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
document.querySelector('#run-button').addEventListener('click', async () => {
  if (!selected) return;
  const form = document.querySelector('#parameter-form'); if (!form.reportValidity()) return;
  const parameters = Object.fromEntries(new FormData(form).entries()); const button = document.querySelector('#run-button');
  button.disabled = true; resultStatus.textContent = 'Executando consulta…'; result.innerHTML = '';
  try {
    const response = await fetch(`/api/procedures/${encodeURIComponent(selected.id)}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parameters }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    resultStatus.textContent = `${data.count} registro(s) retornado(s)`; renderRows(data.rows);
  } catch (error) {
    resultStatus.textContent = error.message || 'Falha ao executar a consulta.';
    result.innerHTML = '<p class="error">Não foi possível obter os dados. Verifique a conexão com o banco.</p>';
  } finally { button.disabled = false; }
});
document.querySelector('#close-workspace').addEventListener('click', () => { workspace.hidden = true; });
load();
