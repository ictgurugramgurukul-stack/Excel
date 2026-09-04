const express = require('express');
const supabase = require('../supabaseClient');
const { requireExcelApiKey } = require('../middleware/auth');
const { findActivity } = require('../activities');

const router = express.Router();

// POST /api/points
// Body: { member_id, activity, teacher_name, remarks }
// Used by Excel's "Submit Points" button.
//
// The point value and category are NEVER trusted from the client —
// they are always looked up from src/activities.js by activity name,
// per the fixed activity list. This is the actual point-submission
// endpoint; it used to be accidentally overwritten with a duplicate
// of the student-creation logic from students.js, which is why
// submissions were failing with a "member_id, name and house are
// required" error (that check belongs to POST /api/students, not here).
router.post('/', requireExcelApiKey, async (req, res) => {
  const { member_id, activity, teacher_name, remarks } = req.body || {};

  if (!member_id || !activity) {
    return res.status(400).json({ error: 'member_id and activity are required.' });
  }

  const activityRecord = findActivity(activity);
  if (!activityRecord) {
    return res.status(400).json({ error: `"${activity}" is not a recognized activity.` });
  }

  const memberId = String(member_id).trim();

  // Look up the student so we can attach student_id (FK) and confirm
  // the member_id actually exists before writing a transaction.
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, member_id, name, house, current_points')
    .eq('member_id', memberId)
    .single();

  if (studentError || !student) {
    return res.status(404).json({ error: `No student found with member_id "${memberId}".` });
  }

  const { data, error } = await supabase
    .from('points_transactions')
    .insert({
      student_id: student.id,
      member_id: student.member_id,
      points: activityRecord.points,
      reason: activityRecord.name,
      category: activityRecord.category,
      teacher_name: teacher_name ? String(teacher_name).trim() : null,
      remarks: remarks ? String(remarks).trim() : null,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json({
    success: true,
    transaction: data,
    student: {
      member_id: student.member_id,
      name: student.name,
      house: student.house,
      new_points_total: student.current_points + activityRecord.points,
    },
  });
});

// Shared handler for both history route styles below.
async function getHistory(req, res) {
  // Accepts member_id either as a path segment (/history/G003) or as a
  // query string (/history?member_id=G003) — some callers (e.g. a
  // browser address bar, or a frontend using ?member_id=) use the
  // query-string form, and previously ONLY the path form was routed,
  // which is why /api/points/history?member_id=G003 returned
  // "Cannot GET /api/points/history" (no matching route at all).
  const memberId = String(req.params.member_id || req.query.member_id || '').trim();
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  if (!memberId) {
    return res.status(400).json({ error: 'member_id is required (as ?member_id=... or /history/MEMBER_ID).' });
  }

  const { data, error } = await supabase
    .from('points_transactions')
    .select('points, reason, category, teacher_name, remarks, created_at')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ member_id: memberId, history: data });
}

// GET /api/points/history?member_id=G003
// GET /api/points/history/G003
// Recent point transactions for one student, most recent first.
// Used by the website's student detail view. Both call styles work.
router.get('/history', requireExcelApiKey, getHistory);
router.get('/history/:member_id', requireExcelApiKey, getHistory);

module.exports = router;
