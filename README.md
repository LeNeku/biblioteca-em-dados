# Portfólio Biblioteca + Azure SQL

Aplicação Node.js + Express com uma interface responsiva para apresentar e executar as stored procedures de uma biblioteca. O navegador só conversa com a API Express; as credenciais do Azure SQL ficam somente no servidor, em variáveis de ambiente.

## Começar

1. Instale o Node.js 20 ou superior.
2. Na pasta do projeto, execute `npm install`.
3. Copie `.env.example` para `.env` e preencha os dados reais do Azure SQL. Este banco aceita somente Microsoft Entra ID: mantenha `DB_AUTHENTICATION=azure-active-directory-default` e execute `az login` com o mesmo usuário autorizado no banco. A sessão do SSMS não é reutilizada pelo Node.js.
4. Edite `config/procedures.js` antes de executar: confirme `databaseName`, preencha a assinatura em `parameters` e cole o DDL real em `ddl` para cada procedure.
5. Execute `npm run dev` (desenvolvimento) ou `npm start` (produção) e abra `http://localhost:3000`.

## Configuração das procedures

O arquivo `config/procedures.js` é a única fonte de verdade do catálogo. Ele já contém os 12 identificadores solicitados:

`assuntos`, `livros`, `autores`, `autorecomlivros`, `autorescommaisdeumlivro`, `editorassemlivors`, `livroautores`, `livromasicaroeditora`, `livromasicaroporassunto`, `livrosacimadamedia`, `livrosacimamediaeditora`, `liroscomqtdautoresacimamedia`.

Os DDLs e assinaturas não foram fornecidos, portanto são placeholders intencionais: nenhum SQL foi inventado. Para uma procedure com parâmetros, use por exemplo:

```js
databaseName: 'dbo.nome_real',
parameters: [{ name: 'idAssunto', type: 'Int', required: true }],
ddl: `CREATE OR ALTER PROCEDURE dbo.nome_real @idAssunto INT AS ...`
```

Os tipos devem existir no pacote `mssql` (`Int`, `VarChar`, `Date`, `Decimal` etc.). Nunca use entradas do frontend para montar SQL ou nomes de procedure; a aplicação usa apenas o catálogo local permitido.

## Endpoints

- `GET /api/procedures` — metadados e DDLs para renderização da interface.
- `POST /api/procedures/:id/run` — executa uma procedure permitida. Corpo: `{ "parameters": { } }`.

Erros de validação retornam 400, procedure inexistente retorna 404 e falhas de banco retornam uma mensagem genérica sem expor senha, string de conexão ou SQL interno.

## Deploy no Azure App Service

1. Suba o projeto a um repositório sem o `.env`.
2. Crie um Azure App Service com Node.js 20+ e configure as mesmas variáveis do `.env` em **Configuration > Application settings**.
3. Garanta que o firewall do Azure SQL autorize as conexões de saída do App Service (ou use integração de rede privada).
4. Defina o comando de inicialização como `npm start` e publique pelo método escolhido (GitHub Actions, ZIP deploy ou Azure CLI).

Em produção, mantenha `DB_ENCRYPT=true` e `DB_TRUST_SERVER_CERTIFICATE=false`. Para App Service, habilite uma Managed Identity, dê a ela permissão no Azure SQL e mantenha `DB_AUTHENTICATION=azure-active-directory-default`; não publique usuário ou senha SQL.
