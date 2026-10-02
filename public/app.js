const $ = (selector) => document.querySelector(selector);
const screens = {
  livros: { title: 'Encontre sua próxima leitura.', description: 'Explore os títulos da biblioteca por assunto, editora ou autor.', name: 'Acervo', search: 'Título, autor ou ISBN', options: [['todos', 'Todos os livros'], ['por-autor', 'Livros e seus autores'], ['acima-media', 'Preço acima da média do acervo'], ['acima-media-editora', 'Preço acima da média da editora'], ['mais-caro-editora', 'Maior preço de cada editora'], ['mais-caro-assunto', 'Maior preço de cada assunto'], ['mais-autores', 'Quantidade de autores acima da média']] },
  autores: { title: 'Conheça quem escreve.', description: 'Encontre autores e veja quem tem obras no acervo.', name: 'Autores', search: 'Nome ou sobrenome', options: [['todos', 'Todos os autores'], ['com-livros', 'Com livros no acervo'], ['varias-obras', 'Com mais de uma obra']] },
  editoras: { title: 'Explore as editoras.', description: 'Veja as editoras presentes no acervo ou encontre aquelas sem livros.', name: 'Editoras', search: 'Nome da editora', options: [['todos', 'Com livros no acervo'], ['sem-livros', 'Sem livros no acervo']] },
  assuntos: { title: 'Uma leitura para cada interesse.', description: 'Consulte os assuntos cadastrados e abra os livros de cada tema.', name: 'Assuntos', search: 'Nome do assunto', options: [['todos', 'Todos os assuntos']] }
};
let section = 'livros';
let rows = [];
let page = 1;
const pageSize = 12;
let controller;
let pendingSubject = '';
let pendingAuthor = '';
let pendingPublisher = '';
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const currency = (price) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

function activateSection() {
  const id = location.hash.slice(1);
  if (id === 'main') return;
  section = Object.hasOwn(screens, id) ? id : 'livros';
  const screen = screens[section];
  $('#filters').reset(); $('#sort').value = 'title';
  $('#subject').innerHTML = '<option value="">Todos os assuntos</option>';
  $('#publisher').innerHTML = '<option value="">Todas as editoras</option>';
  if (section === 'livros' && pendingSubject) {
    $('#subject').innerHTML += `<option selected value="${escape(pendingSubject)}">${escape(pendingSubject)}</option>`;
    pendingSubject = '';
  }
  $('#screen-title').textContent = screen.title; $('#screen-description').textContent = screen.description;
  $('#section-name').textContent = screen.name.toUpperCase(); $('#search-label').textContent = screen.search;
  document.title = `Biblioteca em dados — ${screen.name}`;
  $('.section-stamp').innerHTML = `${screen.name.toUpperCase()}<br><b>${String(Object.keys(screens).indexOf(section) + 1).padStart(2, '0')}</b>`;
  document.querySelectorAll('[data-section]').forEach((link) => { if (link.dataset.section === section) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('#view').innerHTML = screen.options.map(([value, title]) => `<option value="${value}">${escape(title)}</option>`).join('');
  if (section === 'livros' && pendingAuthor) {
    $('#view').value = 'por-autor'; $('#search').value = pendingAuthor; pendingAuthor = '';
  }
  if (section === 'livros' && pendingPublisher) {
    $('#publisher').innerHTML += `<option selected value="${escape(pendingPublisher)}">${escape(pendingPublisher)}</option>`;
    pendingPublisher = '';
  }
  $('#view-label').hidden = screen.options.length === 1;
  $('#sort').innerHTML = `<option value="title">Nome A–Z</option>${section === 'livros' ? '<option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option>' : ''}`;
  load();
}

function fillOptions(selector, values, title) {
  const element = $(selector), previous = element.value;
  element.innerHTML = `<option value="">${title}</option>` + values.map((value) => `<option value="${escape(value)}">${escape(value)}</option>`).join('');
  if (values.includes(previous)) element.value = previous;
  element.parentElement.hidden = section !== 'livros' || !values.length;
}

async function load() {
  controller?.abort(); controller = new AbortController();
  const signal = controller.signal;
  $('#results').setAttribute('aria-busy', 'true'); $('#results').innerHTML = '<div class="loading" aria-hidden="true"><div></div><div></div><div></div></div>';
  $('#result-status').textContent = 'Buscando registros…'; $('#pagination').hidden = true;
  $('#subject-label').hidden = true; $('#publisher-label').hidden = true;
  const params = new URLSearchParams(new FormData($('#filters'))); params.set('sort', $('#sort').value);
  const view = $('#view').value;
  if (section === 'livros') $('#search-label').textContent = view === 'por-autor' ? 'Título ou autor' : 'Título ou ISBN';
  $('#context-note').hidden = true;
  try {
    const response = await fetch(`/api/library/${section}?${params}`, { signal });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (signal.aborted) return;
    rows = data.rows; page = 1;
    fillOptions('#subject', data.options.subjects, 'Todos os assuntos'); fillOptions('#publisher', data.options.publishers, 'Todas as editoras');
    const notes = {
      'por-autor': 'Um livro pode aparecer mais de uma vez quando possui vários autores.',
      'mais-autores': 'A média considera os livros que têm autores associados.',
      'mais-caro-editora': 'Livros empatados no maior preço aparecem juntos.',
      'mais-caro-assunto': 'Livros empatados no maior preço aparecem juntos.'
    };
    const note = section === 'editoras' && view === 'todos' ? 'Esta lista reúne as editoras representadas nos livros do acervo.' : notes[view];
    $('#context-note').textContent = note || ''; $('#context-note').hidden = !note;
    render();
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('#result-status').textContent = 'Não foi possível carregar os registros.';
    $('#results').innerHTML = `<div class="state"><h2>A biblioteca está indisponível.</h2><p>${escape(error.message || 'Tente novamente em alguns instantes.')}</p><button id="retry" type="button">Tentar novamente</button></div>`;
    $('#retry').addEventListener('click', load);
  } finally { if (!signal.aborted) $('#results').setAttribute('aria-busy', 'false'); }
}

function render() {
  const start = (page - 1) * pageSize, visible = rows.slice(start, start + pageSize);
  $('#result-status').textContent = `${rows.length} ${section === 'livros' ? 'resultado(s)' : 'registro(s)'} · ${screens[section].name}`;
  if (!rows.length) {
    $('#results').innerHTML = '<div class="state"><h2>Nenhum registro encontrado.</h2><p>Tente outro termo ou amplie os filtros para explorar o acervo.</p><button id="empty-clear" type="button">Limpar filtros</button></div>';
    $('#empty-clear').addEventListener('click', reset);
  } else if (section === 'livros') {
    $('#results').innerHTML = `<ol class="book-list">${visible.map((row, index) => `<li class="book-row"><div class="book-spine" aria-hidden="true">${String(start + index + 1).padStart(2, '0')}</div><div><h2 class="book-title">${escape(row.title)}</h2>${row.author || row.subject ? `<p class="book-subtitle">${escape([row.author, row.subject].filter(Boolean).join(' · '))}</p>` : ''}<p class="book-meta">${escape([row.publisher, row.pages != null ? `${row.pages} páginas` : null, row.isbn ? `ISBN ${row.isbn}` : null].filter(Boolean).join(' · '))}</p></div><div class="book-end">${row.price != null ? `<span class="price">${currency(row.price)}</span>` : ''}<button class="details-button" data-index="${start + index}" type="button">Ver ficha →</button></div></li>`).join('')}</ol>`;
  } else {
    const attribute = { assuntos: 'subject', autores: 'author', editoras: 'publisher' }[section];
    const canExplore = section !== 'editoras' || $('#view').value !== 'sem-livros';
    $('#results').innerHTML = `<ol class="directory-list">${visible.map((row, index) => `<li><span class="directory-number">${String(start + index + 1).padStart(2, '0')}</span><div><h2>${escape(row.title)}</h2>${canExplore ? `<button class="details-button" data-${attribute}="${escape(row.title)}" type="button">Explorar livros →</button>` : ''}</div></li>`).join('')}</ol>`;
  }
  const pages = Math.ceil(rows.length / pageSize);
  $('#pagination').hidden = pages <= 1; $('#page-status').textContent = `${page} de ${pages}`;
  $('#previous').disabled = page <= 1; $('#next').disabled = page >= pages;
}

function reset() { $('#filters').reset(); $('#sort').value = 'title'; load(); }
$('#filters').addEventListener('submit', (event) => { event.preventDefault(); load(); });
['#view', '#subject', '#publisher', '#sort'].forEach((id) => $(id).addEventListener('change', () => {
  if (id === '#view') { $('#subject').value = ''; $('#publisher').value = ''; }
  load();
}));
$('#clear').addEventListener('click', reset);
$('#previous').addEventListener('click', () => { page--; render(); $('#result-status').scrollIntoView({ block: 'start' }); });
$('#next').addEventListener('click', () => { page++; render(); $('#result-status').scrollIntoView({ block: 'start' }); });
$('#results').addEventListener('click', (event) => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.subject || button.dataset.author || button.dataset.publisher) {
    pendingSubject = button.dataset.subject || '';
    pendingAuthor = button.dataset.author || '';
    pendingPublisher = button.dataset.publisher || '';
    location.hash = 'livros';
    return;
  }
  if (button.dataset.index === undefined) return;
  const row = rows[Number(button.dataset.index)];
  $('#detail-title').textContent = row.title;
  const publication = row.publication ? new Date(row.publication) : null;
  const fields = [['Autor', row.author], ['Assunto', row.subject], ['Editora', row.publisher], ['Preço', row.price != null ? currency(row.price) : null], ['ISBN', row.isbn], ['Páginas', row.pages], ['Publicação', publication && !Number.isNaN(publication.getTime()) ? publication.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : row.publication]];
  $('#detail-fields').innerHTML = fields.filter(([, value]) => value !== null && value !== undefined && value !== '').map(([key, value]) => `<dt>${key}</dt><dd>${escape(value)}</dd>`).join('') || '<dt>Dados</dt><dd>Apenas o título foi retornado nesta visualização.</dd>';
  $('#book-detail').showModal();
});
$('#close-detail').addEventListener('click', () => $('#book-detail').close());
window.addEventListener('hashchange', activateSection);
activateSection();
