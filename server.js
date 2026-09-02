require('dotenv').config();
const express = require('express');
const cors = require('cors');

const pointsRouter = require('./src/routes/points');
const studentsRouter = require('./src/routes/students');
const leaderboardRouter = require('./src/routes/leaderboard');

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : '*',
  })
);

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'gurukul-points-api' });
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/points', pointsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`G-Hostel Points API listening on port ${PORT}`);
});
