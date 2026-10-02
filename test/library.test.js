const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveView, prepareRows } = require('../src/library');

test('only supported screens and reports can choose procedures', () => {
  assert.equal(resolveView('livros', 'por-autor').databaseName, 'dbo.PRC_livroautores');
  assert.equal(resolveView('autores', 'varias-obras').id, 'autores-mais-de-um-livro');
  assert.throws(() => resolveView('livros', 'dbo.arbitrary'), /inválidos/);
  assert.throws(() => resolveView('__proto__', 'todos'), /inválidos/);
});

test('mixed-case database columns normalize and filters compose without SQL', () => {
  const raw = [
    { nomelivro: 'Ação', precolivro: 24, nomeassunto: 'Romance', nomeeditora: 'Editora A' },
    { NomeLivro: 'Ação II', PrecoLivro: 50, NomeAssunto: 'Romance', NomeEditora: 'Editora B' }
  ];
  const data = prepareRows(raw, 'livros', 'todos', { q: 'acao', publisher: 'Editora A' });
  assert.equal(data.count, 1);
  assert.equal(data.rows[0].title, 'Ação');
  assert.deepEqual(data.options.publishers, ['Editora A', 'Editora B']);
  assert.equal(prepareRows(raw, 'livros', 'todos', { q: "'; DROP TABLE Livro;--" }).count, 0);
  assert.throws(() => prepareRows(raw, 'livros', 'todos', { q: ['invalid'] }), /filtros/);
});

test('editor directory deduplicates and price sorting leaves missing values last', () => {
  assert.equal(prepareRows([{ NomeEditora: 'X' }, { NomeEditora: 'X' }], 'editoras', 'todos', {}).count, 1);
  const rows = prepareRows([{ NomeLivro: 'Z' }, { NomeLivro: 'A', PrecoLivro: 2 }, { NomeLivro: 'B', PrecoLivro: 9 }], 'livros', 'todos', { sort: 'price-desc' }).rows;
  assert.deepEqual(rows.map((row) => row.title), ['B', 'A', 'Z']);
});
