const express = require('express');
const supabase = require('../supabaseClient');

const router = express.Router();

// GET /api/leaderboard  -> top students by points (public, read-only)
router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const { data, error } = await supabase
    .from('students')
    .select('member_id, name, class, room, house, current_points')
    .order('current_points', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ leaderboard: data });
});

// GET /api/leaderboard/houses -> total + average points per house (public)
router.get('/houses', async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('house, current_points');

  if (error) return res.status(500).json({ error: error.message });

  const totals = {};
  for (const s of data) {
    if (!totals[s.house]) totals[s.house] = { house: s.house, total_points: 0, student_count: 0 };
    totals[s.house].total_points += s.current_points;
    totals[s.house].student_count += 1;
  }
  const houseLeaderboard = Object.values(totals)
    .map((h) => ({ ...h, average_points: h.student_count ? +(h.total_points / h.student_count).toFixed(1) : 0 }))
    .sort((a, b) => b.total_points - a.total_points);

  return res.json({ house_leaderboard: houseLeaderboard });
});

module.exports = router;
