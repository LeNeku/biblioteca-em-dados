/**
 * Catálogo permitido pela API. Os nomes em `databaseName` foram extraídos de
 * Biblioteca.bacpac (model.xml). Não há parâmetros nas 12 procedures de consulta.
 */
function procedure(id, title, description, databaseName, ddl) {
  return { id, title, description, databaseName, parameters: [], ddl };
}

module.exports = [
  procedure('assuntos', 'Assuntos', 'Consulta os assuntos cadastrados.', 'dbo.PRC_assuntos', `CREATE PROCEDURE [dbo].[PRC_assuntos]
AS
BEGIN
  SELECT [NomeAssunto] FROM [dbo].[Assunto];
END`),
  procedure('livros', 'Livros', 'Exibe livros com assunto e editora.', 'dbo.PRC_livro', `CREATE PROCEDURE [dbo].[PRC_livro]
AS
BEGIN
  SELECT [NomeLivro], [DataPub], [NomeAssunto], [NomeEditora], [ISBN13], [NumeroPaginas], [PrecoLivro]
  FROM [dbo].[Livro] l
  INNER JOIN [dbo].[Assunto] a ON l.IdAssunto = a.IdAssunto
  INNER JOIN [dbo].[Editora] e ON l.IdEditora = e.IdEditora;
END`),
  procedure('autores', 'Autores', 'Consulta os autores cadastrados.', 'dbo.PRC_autores', `CREATE PROCEDURE [dbo].[PRC_autores]
AS
BEGIN
  SELECT [NomeAutor], [SobrenomeAutor] FROM [dbo].[Autor];
END`),
  procedure('autores-com-livros', 'Autores com livros', 'Relaciona autores que possuem livros.', 'dbo.PRC_AutoresComLivros', `CREATE PROCEDURE [dbo].[PRC_AutoresComLivros]
AS
BEGIN
  SELECT NomeAutor, SobrenomeAutor
  FROM [dbo].[Autor]
  WHERE IdAutor IN (SELECT IdAutor FROM [dbo].[LivroAutor]);
END`),
  procedure('autores-mais-de-um-livro', 'Autores com mais de um livro', 'Filtra autores com múltiplas obras.', 'dbo.PRC_AutoresComMaisDeUmLivro', `CREATE PROCEDURE [dbo].[PRC_AutoresComMaisDeUmLivro]
AS
BEGIN
  SELECT a.NomeAutor, a.SobrenomeAutor
  FROM [dbo].[Autor] a
  WHERE EXISTS (
    SELECT 1 FROM [dbo].[LivroAutor] la
    WHERE la.IdAutor = a.IdAutor
      AND EXISTS (SELECT 1 FROM [dbo].[LivroAutor] la2 WHERE la2.IdAutor = la.IdAutor AND la2.IdLivro <> la.IdLivro)
  );
END`),
  procedure('editoras-sem-livros', 'Editoras sem livros', 'Lista editoras sem livros associados.', 'dbo.PRC_EditorasSemLivros', `CREATE PROCEDURE [dbo].[PRC_EditorasSemLivros]
AS
BEGIN
  SELECT * FROM [dbo].[Editora]
  WHERE IdEditora NOT IN (SELECT IdEditora FROM [dbo].[Livro]);
END`),
  procedure('livro-autores', 'Livro e autores', 'Exibe a associação entre livros e autores.', 'dbo.PRC_livroautores', `CREATE PROCEDURE [dbo].[PRC_livroautores]
AS
BEGIN
  SELECT [NomeAutor], [SobrenomeAutor], [NomeLivro]
  FROM [dbo].[vw_LivrosAutores];
END`),
  procedure('livro-mais-caro-editora', 'Livro mais caro por editora', 'Mostra o livro de maior preço por editora.', 'dbo.PRC_LivroMaisCaroEditora', `CREATE PROCEDURE [dbo].[PRC_LivroMaisCaroEditora]
AS
BEGIN
  SELECT l.NomeLivro, l.PrecoLivro,
    (SELECT e.NomeEditora FROM [dbo].[Editora] e WHERE e.IdEditora = l.IdEditora) AS NomeEditora
  FROM [dbo].[Livro] l
  WHERE (SELECT COUNT(*) FROM [dbo].[Livro] l2 WHERE l.IdEditora = l2.IdEditora AND l2.PrecoLivro > l.PrecoLivro) = 0;
END`),
  procedure('livro-mais-caro-assunto', 'Livro mais caro por assunto', 'Mostra o livro de maior preço por assunto.', 'dbo.PRC_LivroMaisCaroPorAssunto', `CREATE PROCEDURE [dbo].[PRC_LivroMaisCaroPorAssunto]
AS
BEGIN
  SELECT l.NomeLivro, l.PrecoLivro, a.NomeAssunto
  FROM [dbo].[Livro] l INNER JOIN [dbo].[Assunto] a ON l.IdAssunto = a.IdAssunto
  WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Livro] l2
    WHERE l2.IdAssunto = a.IdAssunto AND l.IdLivro <> l2.IdLivro AND l.PrecoLivro < l2.PrecoLivro
  );
END`),
  procedure('livros-acima-media', 'Livros acima da média', 'Filtra livros acima da média de preço.', 'dbo.PRC_LivrosAcimaMedia', `CREATE PROCEDURE [dbo].[PRC_LivrosAcimaMedia]
AS
BEGIN
  SELECT NomeLivro, PrecoLivro, AVG(PrecoLivro) OVER () AS Media
  FROM [dbo].[Livro]
  WHERE PrecoLivro > (SELECT AVG(PrecoLivro) FROM [dbo].[Livro]);
END`),
  procedure('livros-acima-media-editora', 'Livros acima da média por editora', 'Filtra livros acima da média de cada editora.', 'dbo.PRC_LivrosAcimaMediaEditora', `CREATE PROCEDURE [dbo].[PRC_LivrosAcimaMediaEditora]
AS
BEGIN
  SELECT l.NomeLivro, l.PrecoLivro,
    (SELECT e.NomeEditora FROM [dbo].[Editora] e WHERE e.IdEditora = l.IdEditora) AS NomeEditora,
    (SELECT AVG(l2.PrecoLivro) FROM [dbo].[Livro] l2 WHERE l2.IdEditora = l.IdEditora) AS MediaEditora
  FROM [dbo].[Livro] l
  WHERE l.PrecoLivro > (SELECT AVG(l2.PrecoLivro) FROM [dbo].[Livro] l2 WHERE l2.IdEditora = l.IdEditora);
END`),
  procedure('livros-autores-acima-media', 'Livros com autores acima da média', 'Filtra livros cuja quantidade de autores supera a média.', 'dbo.PRC_LivrosComQtdAutoresAcimaMedia', `CREATE PROCEDURE [dbo].[PRC_LivrosComQtdAutoresAcimaMedia]
AS
BEGIN
  SELECT l.NomeLivro
  FROM [dbo].[Livro] l
  WHERE (SELECT COUNT(*) FROM [dbo].[LivroAutor] la WHERE la.IdLivro = l.IdLivro) >
    (SELECT AVG(CAST(Contagem AS DECIMAL(10,2))) FROM (SELECT COUNT(*) AS Contagem FROM [dbo].[LivroAutor] GROUP BY IdLivro) AS Sub);
END`)
];
