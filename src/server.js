require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const procedures = require('../config/procedures');
const { executeProcedure } = require('./database');
const { resolveView, prepareRows } = require('./library');

const app = express();
const procedureById = new Map(procedures.map((item) => [item.id, item]));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/procedures', (_req, res) => {
  res.json(procedures.map(({ databaseName, ...procedure }) => procedure));
});

app.get('/api/library/:section', async (req, res, next) => {
  try {
    const section = req.params.section;
    const view = req.query.view || 'todos';
    const procedure = resolveView(section, view);
    // Validate input before acquiring a database connection.
    prepareRows([], section, view, req.query);
    const raw = await executeProcedure(procedure, {});
    res.json(prepareRows(raw, section, view, req.query));
  } catch (error) { next(error); }
});

app.post('/api/procedures/:id/run', async (req, res, next) => {
  try {
    const procedure = procedureById.get(req.params.id);
    if (!procedure) return res.status(404).json({ error: 'Procedure não encontrada.' });
    const supplied = req.body?.parameters || {};
    if (typeof supplied !== 'object' || Array.isArray(supplied)) {
      return res.status(400).json({ error: 'O campo parameters deve ser um objeto.' });
    }
    const allowed = new Set(procedure.parameters.map((parameter) => parameter.name));
    if (Object.keys(supplied).some((key) => !allowed.has(key))) {
      return res.status(400).json({ error: 'Há parâmetros não permitidos para esta procedure.' });
    }
    const rows = await executeProcedure(procedure, supplied);
    res.json({ rows, count: rows.length });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'Não foi possível executar a consulta. Verifique o servidor e a configuração do banco.'
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Biblioteca disponível em http://localhost:${port}`));
