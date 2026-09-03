const express = require('express');
const supabase = require('../supabaseClient');
const { requireExcelApiKey } = require('../middleware/auth');

const router = express.Router();

// A simple in-memory guard against accidental double-submits from a
// double-click: if the exact same (member_id, points, reason, teacher)
// arrives again within a few seconds, it's rejected as a duplicate.
// This is a best-effort safety net on top of the Excel-side button
// lock (see the VBA code) — it does not replace it.
const recentSubmissions = new Map(); // key -> timestamp (ms)
const DUPLICATE_WINDOW_MS = 8000;

function isDuplicate(key) {
  const now = Date.now();
  const last = recentSubmissions.get(key);
  // Clean up old entries occasionally
  if (recentSubmissions.size > 500) {
    for (const [k, t] of recentSubmissions) {
      if (now - t > DUPLICATE_WINDOW_MS) recentSubmissions.delete(k);
    }
  }
  if (last && now - last < DUPLICATE_WINDOW_MS) return true;
  recentSubmissions.set(key, now);
  return false;
}

// POST /api/points
// Body: { member_id, points, reason, category, teacher_name, remarks }
router.post('/', requireExcelApiKey, async (req, res) => {
  try {
    const { member_id, points, reason, category, teacher_name, remarks } = req.body || {};

    if (!member_id || typeof member_id !== 'string') {
      return res.status(400).json({ error: 'member_id is required.' });
    }
    const pointsNum = Number(points);
    if (!Number.isFinite(pointsNum) || pointsNum === 0 || !Number.isInteger(pointsNum)) {
      return res.status(400).json({ error: 'points must be a non-zero whole number.' });
    }
    if (!teacher_name || typeof teacher_name !== 'string') {
      return res.status(400).json({ error: 'teacher_name is required.' });
    }

    const dupKey = `${member_id}|${pointsNum}|${reason || ''}|${teacher_name}`;
    if (isDuplicate(dupKey)) {
      return res.status(409).json({
        error: 'Duplicate submission detected. This exact entry was just submitted a few seconds ago.',
      });
    }

    // Look up the student to (a) confirm they exist and (b) get their id/name.
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, member_id, name, current_points')
      .eq('member_id', member_id)
      .single();

    if (studentErr || !student) {
      return res.status(404).json({ error: `No student found with member_id "${member_id}".` });
    }

    const { data: txn, error: txnErr } = await supabase
      .from('points_transactions')
      .insert({
        student_id: student.id,
        member_id: student.member_id,
        points: pointsNum,
        reason: reason || null,
        category: category || null,
        teacher_name,
        remarks: remarks || null,
      })
      .select()
      .single();

    if (txnErr) {
      return res.status(500).json({ error: 'Failed to record transaction.', details: txnErr.message });
    }

    // current_points is updated by a DB trigger; re-read it to return the true new total.
    const { data: updated } = await supabase
      .from('students')
      .select('current_points')
      .eq('id', student.id)
      .single();

    return res.status(201).json({
      success: true,
      student: student.name,
      member_id: student.member_id,
      points_added: pointsNum,
      new_total: updated ? updated.current_points : student.current_points + pointsNum,
      transaction_id: txn.id,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected server error.', details: err.message });
  }
});

// GET /api/points/history?member_id=G001&limit=50
// Public read (used by the website's Points History page).
router.get('/history', async (req, res) => {
  const { member_id, limit } = req.query;
  let query = supabase
    .from('points_transactions')
    // Embed the linked student row via the student_id foreign key so the
    // response includes the student's name/class/room/house, not just
    // their member_id. Without this join, history rows have no student
    // info attached at all.
    .select('*, students(name, class, room, house)')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));

  if (member_id) query = query.eq('member_id', member_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // Flatten the embedded "students" object onto each transaction so the
  // frontend doesn't need to know about the join shape.
  const transactions = (data || []).map((row) => {
    const { students: student, ...txn } = row;
    return {
      ...txn,
      student_name: student ? student.name : null,
      class: student ? student.class : null,
      room: student ? student.room : null,
      house: student ? student.house : null,
    };
  });

  return res.json({ transactions });
});

module.exports = router;
