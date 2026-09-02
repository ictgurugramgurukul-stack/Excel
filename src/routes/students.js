const express = require('express');
const supabase = require('../supabaseClient');
const { requireExcelApiKey } = require('../middleware/auth');

const router = express.Router();

const HOUSES = ['Samveda', 'Yajurveda', 'Atharvaveda', 'Rugveda'];

// GET /api/students
// Used by Excel's "SYNC STUDENTS" button AND the website's Students page.
// Protected with the same Excel API key so the full roster (with current
// points) isn't scrapeable by anyone who finds the URL; the website's
// own frontend calls this through its own backend, not directly.
router.get('/', requireExcelApiKey, async (req, res) => {
  const { data, error } = await supabase
    .from('students')
    .select('member_id, name, class, room, house, current_points')
    .order('name', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ students: data });
});

// POST /api/students
// Body: { member_id, name, class, room, house }
// Used by the website's "Add Student" page. Also protected — only the
// admin-facing website should call this, using the same shared key
// (kept server-side in the website's own backend, never in browser JS).
router.post('/', requireExcelApiKey, async (req, res) => {
  const { member_id, name, class: className, room, house } = req.body || {};

  if (!member_id || !name || !house) {
    return res.status(400).json({ error: 'member_id, name and house are required.' });
  }
  if (!HOUSES.includes(house)) {
    return res.status(400).json({ error: `house must be one of: ${HOUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('students')
    .insert({ member_id, name, class: className || null, room: room || null, house })
    .select()
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500; // unique violation on member_id
    return res.status(status).json({ error: error.message });
  }
  return res.status(201).json({ success: true, student: data });
});

module.exports = router;
