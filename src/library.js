const procedures = require('../config/procedures');

// These report choices map only to the twelve existing read-only procedures.
const views = {
  livros: {
    todos: 'livros',
    'por-autor': 'livro-autores',
    'acima-media': 'livros-acima-media',
    'acima-media-editora': 'livros-acima-media-editora',
    'mais-caro-editora': 'livro-mais-caro-editora',
    'mais-caro-assunto': 'livro-mais-caro-assunto',
    'mais-autores': 'livros-autores-acima-media'
  },
  autores: {
    todos: 'autores', 'com-livros': 'autores-com-livros', 'varias-obras': 'autores-mais-de-um-livro'
  },
  editoras: { todos: 'livros', 'sem-livros': 'editoras-sem-livros' },
  assuntos: { todos: 'assuntos' }
};

function field(row, key) {
  return row[Object.keys(row).find((name) => name.toLowerCase() === key.toLowerCase())];
}

function normalize(row, section) {
  if (section === 'livros') return {
    title: field(row, 'NomeLivro') || 'Livro sem título',
    author: [field(row, 'NomeAutor'), field(row, 'SobrenomeAutor')].filter(Boolean).join(' '),
    subject: field(row, 'NomeAssunto') ?? null,
    publisher: field(row, 'NomeEditora') ?? null,
    price: field(row, 'PrecoLivro') ?? null,
    isbn: field(row, 'ISBN13') ?? null,
    pages: field(row, 'NumeroPaginas') ?? null,
    publication: field(row, 'DataPub') ?? null
  };
  if (section === 'autores') return { title: [field(row, 'NomeAutor'), field(row, 'SobrenomeAutor')].filter(Boolean).join(' ') || 'Autor sem nome' };
  if (section === 'editoras') return { title: field(row, 'NomeEditora') || 'Editora sem nome' };
  return { title: field(row, 'NomeAssunto') || 'Assunto sem nome' };
}

function resolveView(section, view = 'todos') {
  const id = Object.hasOwn(views, section) && Object.hasOwn(views[section], view) ? views[section][view] : null;
  if (!id) { const error = new Error('Filtro ou seção inválidos.'); error.statusCode = 400; throw error; }
  return procedures.find((procedure) => procedure.id === id);
}

function prepareRows(raw, section, view, filters) {
  let rows = raw.map((row) => normalize(row, section));
  // No procedure lists all editors. Here "todos" means editors represented in the collection.
  if (section === 'editoras' && view === 'todos') {
    rows = [...new Map(rows.map((row) => [row.title, row])).values()];
  }
  const terms = [filters.q, filters.subject, filters.publisher];
  if (terms.some((term) => term !== undefined && (typeof term !== 'string' || term.length > 200))) {
    const error = new Error('Os filtros devem conter textos de até 200 caracteres.'); error.statusCode = 400; throw error;
  }
  const fold = (value) => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const options = {
    subjects: [...new Set(rows.map((row) => row.subject).filter(Boolean))].sort(),
    publishers: [...new Set(rows.map((row) => row.publisher).filter(Boolean))].sort()
  };
  const q = fold(filters.q).trim();
  rows = rows.filter((row) => (!q || fold([row.title, row.author, row.isbn].join(' ')).includes(q)) &&
    (!filters.subject || row.subject === filters.subject) && (!filters.publisher || row.publisher === filters.publisher));
  const sort = filters.sort || 'title';
  if (!['title', 'price-asc', 'price-desc'].includes(sort)) {
    const error = new Error('Ordenação inválida.'); error.statusCode = 400; throw error;
  }
  rows.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'pt-BR') :
    a.price == null ? (b.price == null ? 0 : 1) : b.price == null ? -1 :
      (Number(a.price) - Number(b.price)) * (sort === 'price-desc' ? -1 : 1));
  return { rows, count: rows.length, options };
}

module.exports = { resolveView, prepareRows };
