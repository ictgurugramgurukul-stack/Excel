const express = require('express');
const supabase = require('../supabaseClient');
const { requireExcelApiKey } = require('../middleware/auth');
const { findActivity } = require('../activities');

const router = express.Router();

// A simple in-memory guard against accidental double-submits from a
// double-click: if the exact same (member_id, activity, teacher) arrives
// again within a few seconds, it's rejected as a duplicate. This is a
// best-effort safety net on top of the Excel-side button lock (see the
// VBA code) — it does not replace it.
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
// Body: { member_id, reason (= activity name), teacher_name, remarks }
//
// IMPORTANT: points are NEVER taken from the request body. The client
// sends the activity name in "reason"; the server looks it up in
// src/activities.js and uses THAT points value and category. This is
// what makes points impossible to tamper with, whether the request
// comes from the Excel macro, a bug in it, or someone hitting the API
// directly with a tool like Postman.
router.post('/', requireExcelApiKey, async (req, res) => {
  try {
    const { member_id, reason, activity, teacher_name, remarks } = req.body || {};

    if (!member_id || typeof member_id !== 'string') {
      return res.status(400).json({ error: 'member_id is required.' });
    }
    if (!teacher_name || typeof teacher_name !== 'string') {
      return res.status(400).json({ error: 'teacher_name is required.' });
    }

    // Accept either "activity" or "reason" as the activity name so the
    // existing Excel field name keeps working without a Config change.
    const activityName = activity || reason;
    const matched = findActivity(activityName);
    if (!matched) {
      return res.status(400).json({
        error: `"${activityName || ''}" is not a recognised activity. Pick one from the fixed list (see GET /api/activities).`,
      });
    }
    const pointsNum = matched.points;

    const dupKey = `${member_id}|${matched.name}|${teacher_name}`;
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
        reason: matched.name,
        category: matched.category,
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
      activity: matched.name,
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
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(limit) || 100, 500));

  if (member_id) query = query.eq('member_id', member_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ transactions: data });
});

module.exports = router;
