const express = require('express');
const { ACTIVITIES } = require('../activities');

const router = express.Router();

// GET /api/activities
// Public, read-only. The fixed activity -> points list, as JSON.
// Excel (or any other client) can sync its dropdown from this so the
// list is never out of date and never editable on the client side.
router.get('/', (req, res) => {
  res.json({ activities: ACTIVITIES });
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRows(list) {
  return list
    .map(
      (a) => `
      <tr>
        <td class="name">${escapeHtml(a.name)}${a.description ? `<div class="desc">${escapeHtml(a.description)}</div>` : ''}</td>
        <td class="points ${a.points >= 0 ? 'pos' : 'neg'}">${a.points >= 0 ? '+' : ''}${a.points}</td>
      </tr>`
    )
    .join('');
}

// GET /activities
// Public page listing every activity and its fixed point value.
// This is generated straight from src/activities.js, so it can never
// drift out of sync with what the API actually awards.
router.get('/page', (req, res) => {
  const positive = ACTIVITIES.filter((a) => a.points >= 0).sort((a, b) => b.points - a.points);
  const negative = ACTIVITIES.filter((a) => a.points < 0).sort((a, b) => a.points - b.points);

  res.set('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>G-Hostel Points List</title>
<style>
  :root {
    --pos: #1a7f37;
    --neg: #cf222e;
    --bg: #f6f7f9;
    --card: #ffffff;
    --border: #e3e6ea;
    --text: #1f2328;
    --muted: #6b7280;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    padding: 32px 16px 64px;
  }
  .wrap { max-width: 900px; margin: 0 auto; }
  header { text-align: center; margin-bottom: 28px; }
  header h1 { font-size: 26px; margin: 0 0 6px; }
  header p { color: var(--muted); margin: 0; font-size: 14px; }
  .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  @media (max-width: 700px) { .columns { grid-template-columns: 1fr; } }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .card h2 {
    font-size: 15px;
    margin: 0;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
  }
  .card.positive h2 { color: var(--pos); background: #f0fbf3; }
  .card.negative h2 { color: var(--neg); background: #fdf2f2; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 10px 18px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 14px; }
  tr:last-child td { border-bottom: none; }
  td.name { width: 75%; }
  td.desc, .desc { color: var(--muted); font-size: 12px; margin-top: 2px; }
  td.points { text-align: right; font-weight: 700; white-space: nowrap; }
  td.points.pos { color: var(--pos); }
  td.points.neg { color: var(--neg); }
  footer { text-align: center; color: var(--muted); font-size: 12px; margin-top: 28px; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>G-Hostel Points List</h1>
      <p>These point values are fixed and cannot be changed from Excel or the app — teachers pick an activity and the points are applied automatically.</p>
    </header>
    <div class="columns">
      <div class="card positive">
        <h2>Positive activities (${positive.length})</h2>
        <table>${renderRows(positive)}</table>
      </div>
      <div class="card negative">
        <h2>Negative activities (${negative.length})</h2>
        <table>${renderRows(negative)}</table>
      </div>
    </div>
    <footer>G-Hostel Points System &middot; ${ACTIVITIES.length} activities total</footer>
  </div>
</body>
</html>`);
});

module.exports = router;
