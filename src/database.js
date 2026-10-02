const sql = require('mssql');

let poolPromise;

function databaseConfig() {
  const authenticationType = process.env.DB_AUTHENTICATION || 'default';
  const isEntraAuthentication = authenticationType !== 'default';
  const required = isEntraAuthentication
    ? ['DB_SERVER', 'DB_DATABASE']
    : ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Configuração do banco incompleta: ${missing.join(', ')}`);

  const config = {
    server: process.env.DB_SERVER,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE,
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
  };

  if (isEntraAuthentication) {
    // DefaultAzureCredential: Azure CLI local ou identidade gerenciada no Azure.
    config.authentication = { type: authenticationType };
  } else {
    config.user = process.env.DB_USER;
    config.password = process.env.DB_PASSWORD;
  }

  return config;
}

function getPool() {
  if (!poolPromise) poolPromise = sql.connect(databaseConfig()).catch((error) => {
    poolPromise = undefined;
    throw error;
  });
  return poolPromise;
}

async function executeProcedure(procedure, values) {
  const pool = await getPool();
  const request = pool.request();

  for (const parameter of procedure.parameters) {
    const value = values[parameter.name];
    if (parameter.required && (value === undefined || value === '')) {
      const error = new Error(`O parâmetro "${parameter.name}" é obrigatório.`);
      error.statusCode = 400;
      throw error;
    }
    if (value !== undefined && value !== '') request.input(parameter.name, sql[parameter.type], value);
  }

  // databaseName vem exclusivamente do catálogo local, nunca da requisição.
  const result = await request.execute(procedure.databaseName);
  return result.recordset || [];
}

module.exports = { executeProcedure };
