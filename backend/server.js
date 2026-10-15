const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(cors());
app.use(express.json({ limit: '32kb' }));

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'ip_std6730202602',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

const validTokens = new Set();
const idLockName = 'hr_employee_id_allocator';
const MAX_SQL_INT = 2147483647;
const columns = {
  id: '`CharuesaSuksahwang_id`',
  name: '`CharuesaSuksahwang_name`',
  position: '`CharuesaSuksahwang_position`',
  status: '`CharuesaSuksahwang_status`',
  salary: '`CharuesaSuksahwang_salary`',
};
const seedEmployees = [
  ['ฌาฤสา สุขสว่าง', 'Software Engineer', 'Active', 45000],
  ['Jane Smith', 'Product Manager', 'Active', 85000],
  ['Alex Johnson', 'UX Designer', 'On Leave', 52000],
  ['Sam Lee', 'HR Specialist', 'Active', 38000],
  ['Taylor Brown', 'Data Analyst', 'Active', 62000],
];

function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !validTokens.has(token)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  next();
}

async function withEmployeeIdLock(work) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [idLockName]);
    if (lock.acquired !== 1) throw new Error('Could not allocate employee ID; please try again');
    locked = true;
    return await work(connection);
  } finally {
    if (locked) await connection.query('SELECT RELEASE_LOCK(?)', [idLockName]).catch(() => {});
    connection.release();
  }
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); return res.json({ success: true }); }
  catch (_error) { return res.status(503).json({ success: false, error: 'Database unavailable' }); }
});

app.post('/api/login', (req, res) => {
  const body = req.body || {};
  if (body.username === (process.env.ADMIN_USERNAME || 'admin') && body.password === (process.env.ADMIN_PASSWORD || 'password123')) {
    const token = 'mock-jwt-token';
    validTokens.add(token);
    return res.status(200).json({ success: true, token });
  }
  return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

app.get('/api/employees', requireAuth, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${columns.id} AS id, ${columns.name} AS name, ${columns.position} AS position, ${columns.status} AS status, ${columns.salary} AS salary FROM employees ORDER BY ${columns.id}`);
    return res.json(rows.map((row) => ({ ...row, id: String(row.id), salary: Number(row.salary) })));
  } catch (error) { return next(error); }
});

app.post('/api/employees', requireAuth, async (req, res, next) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const position = typeof body.position === 'string' ? body.position.trim() : '';
  const salary = body.salary;
  if (!name || !position || name.length > 255 || position.length > 255 || !Number.isSafeInteger(salary) || salary < 0 || salary > MAX_SQL_INT) {
    return res.status(400).json({ success: false, error: 'Name, position, and a non-negative whole-number salary are required' });
  }
  try {
    const employee = await withEmployeeIdLock(async (connection) => {
      const [[row]] = await connection.query(`SELECT COALESCE(MAX(${columns.id}), 0) + 1 AS nextId FROM employees`);
      const id = Number(row.nextId);
      if (!Number.isSafeInteger(id) || id < 1 || id > MAX_SQL_INT) throw new Error('No employee IDs are available');
      await connection.execute(`INSERT INTO employees (${columns.id}, ${columns.name}, ${columns.position}, ${columns.status}, ${columns.salary}) VALUES (?, ?, ?, ?, ?)`, [id, name, position, 'Active', salary]);
      return { id: String(id), name, position, status: 'Active', salary };
    });
    return res.status(201).json(employee);
  } catch (error) { return next(error); }
});

app.put('/api/employees/:id/status', requireAuth, async (req, res, next) => {
  const id = req.params.id;
  const numericId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId < 1 || numericId > MAX_SQL_INT) return res.status(400).json({ success: false, error: 'Invalid employee ID' });
  try {
    const [result] = await pool.execute(`UPDATE employees SET ${columns.status} = CASE WHEN ${columns.status} = 'Active' THEN 'On Leave' ELSE 'Active' END WHERE ${columns.id} = ? AND ${columns.status} IN ('Active', 'On Leave')`, [numericId]);
    if (result.affectedRows === 0) {
      const [rows] = await pool.execute(`SELECT ${columns.status} AS status FROM employees WHERE ${columns.id} = ?`, [numericId]);
      if (!rows.length) return res.status(404).json({ success: false, error: 'Employee not found' });
      return res.status(409).json({ success: false, error: 'Employee status must be Active or On Leave before it can be toggled' });
    }
    const [[employee]] = await pool.execute(`SELECT ${columns.id} AS id, ${columns.name} AS name, ${columns.position} AS position, ${columns.status} AS status, ${columns.salary} AS salary FROM employees WHERE ${columns.id} = ?`, [numericId]);
    return res.json({ ...employee, id: String(employee.id), salary: Number(employee.salary) });
  } catch (error) { return next(error); }
});

app.delete('/api/employees/:id', requireAuth, async (req, res, next) => {
  const id = req.params.id;
  const numericId = Number(id);
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId < 1 || numericId > MAX_SQL_INT) return res.status(400).json({ success: false, error: 'Invalid employee ID' });
  try {
    const [result] = await pool.execute(`DELETE FROM employees WHERE ${columns.id} = ?`, [numericId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Employee not found' });
    return res.status(204).end();
  } catch (error) { return next(error); }
});

function clusterSalaries(salaries, k = 3) {
  const sorted = [...salaries].sort((a, b) => a - b);
  if (!sorted.length) return Array.from({ length: k }, (_, i) => ({ group: `Tier ${i + 1}`, centroid: null, count: 0 }));
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.floor((i + 0.5) * sorted.length / k)]);
  let assigned = [];
  for (let step = 0; step < 100; step++) {
    assigned = sorted.map((value) => {
      let best = 0;
      for (let i = 1; i < k; i++) if (Math.abs(value - centers[i]) < Math.abs(value - centers[best])) best = i;
      return best;
    });
    const sums = Array(k).fill(0), counts = Array(k).fill(0);
    assigned.forEach((group, index) => { sums[group] += sorted[index]; counts[group]++; });
    let changed = false;
    for (let i = 0; i < k; i++) if (counts[i]) {
      const nextCenter = sums[i] / counts[i];
      if (nextCenter !== centers[i]) changed = true;
      centers[i] = nextCenter;
    }
    if (!changed) break;
  }
  assigned = sorted.map((value) => {
    let best = 0;
    for (let i = 1; i < k; i++) if (Math.abs(value - centers[i]) < Math.abs(value - centers[best])) best = i;
    return best;
  });
  const sums = Array(k).fill(0), counts = Array(k).fill(0);
  assigned.forEach((group, index) => { sums[group] += sorted[index]; counts[group]++; });
  return centers.map((_center, i) => ({ group: `Tier ${i + 1}`, centroid: counts[i] ? sums[i] / counts[i] : null, count: counts[i] }));
}

app.get('/api/employees/salary-clusters', requireAuth, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT ${columns.salary} AS salary FROM employees`);
    const salaries = rows.map((row) => Number(row.salary)).filter(Number.isFinite);
    return res.json({ success: true, employeeCount: salaries.length, clusters: clusterSalaries(salaries) });
  } catch (error) { return next(error); }
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    const message = err.status === 413 ? 'Request body is too large' : 'Invalid request';
    return res.status(err.status).json({ success: false, error: message });
  }
  console.error('API error:', err.code || err.message);
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, error: 'Employee ID conflict; please retry' });
  if (err.code === 'ER_NO_SUCH_TABLE') return res.status(500).json({ success: false, error: 'The employees table was not found in the configured database' });
  return res.status(500).json({ success: false, error: 'Request failed; check the API and database configuration' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
    if (process.env.SEED_MOCK_DATA === 'true') {
      await withEmployeeIdLock(async (connection) => {
        const [[row]] = await connection.query('SELECT COUNT(*) AS total FROM employees');
        if (Number(row.total) === 0) {
          await connection.beginTransaction();
          try {
            let id = 1;
            for (const values of seedEmployees) await connection.execute(`INSERT INTO employees (${columns.id}, ${columns.name}, ${columns.position}, ${columns.status}, ${columns.salary}) VALUES (?, ?, ?, ?, ?)`, [id++, ...values]);
            await connection.commit();
          } catch (error) {
            await connection.rollback();
            throw error;
          }
        }
      });
    }
    app.listen(PORT, '0.0.0.0', () => console.log(`HR API listening on port ${PORT}`));
  } catch (error) {
    console.error('Could not connect to configured MySQL database:', error.code || error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) start();
module.exports = { app, clusterSalaries };

