const express = require('express');
const supabase = require('../supabaseClient');
const { requireExcelApiKey } = require('../middleware/auth');

const router = express.Router();

const HOUSES = ['Samveda', 'Yajurveda', 'Atharvaveda', 'Rugveda'];
const HOUSES_LOWER = new Map(HOUSES.map((h) => [h.toLowerCase(), h]));

// Matches a house name loosely (trims + case-insensitive) so a stray
// space or "yajurveda" typed in lowercase doesn't fail the whole import.
function normalizeHouse(house) {
  if (!house || typeof house !== 'string') return null;
  return HOUSES_LOWER.get(house.trim().toLowerCase()) || null;
}

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
// Used by the website's "Add Student" page / the ADD STUDENT sheet.
router.post('/', requireExcelApiKey, async (req, res) => {
  const { member_id, name, class: className, room, house } = req.body || {};

  if (!member_id || !name || !house) {
    return res.status(400).json({ error: 'member_id, name and house are required.' });
  }
  const normalizedHouse = normalizeHouse(house);
  if (!normalizedHouse) {
    return res.status(400).json({ error: `house must be one of: ${HOUSES.join(', ')}` });
  }

  const { data, error } = await supabase
    .from('students')
    .insert({
      member_id: String(member_id).trim(),
      name: String(name).trim(),
      class: className ? String(className).trim() : null,
      room: room ? String(room).trim() : null,
      house: normalizedHouse,
    })
    .select()
    .single();

  if (error) {
    const status = error.code === '23505' ? 409 : 500; // unique violation on member_id
    return res.status(status).json({ error: error.message });
  }
  return res.status(201).json({ success: true, student: data });
});

// POST /api/students/bulk
// Body: { students: [ { member_id, name, class, room, house }, ... ] }
//
// Built for importing the student_import_template spreadsheet in one go.
// Unlike POST /api/students, a bad row (missing field, invalid house, a
// stray header row accidentally pasted into the middle of the data,
// etc.) is SKIPPED and reported — it does not abort the rest of the
// batch. Duplicate member_ids (already in the database) are reported
// separately, not treated as a hard failure.
router.post('/bulk', requireExcelApiKey, async (req, res) => {
  const { students } = req.body || {};

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: '"students" must be a non-empty array.' });
  }
  if (students.length > 500) {
    return res.status(400).json({ error: 'Max 500 students per bulk import.' });
  }

  const inserted = [];
  const skipped = []; // bad/invalid rows — never sent to the database
  const duplicates = []; // valid rows that already exist (member_id conflict)
  const failed = []; // valid rows that hit an unexpected DB error

  for (let i = 0; i < students.length; i++) {
    const row = students[i] || {};
    const rowNum = i + 1;
    const member_id = row.member_id != null ? String(row.member_id).trim() : '';
    const name = row.name != null ? String(row.name).trim() : '';
    const className = row.class != null ? String(row.class).trim() : '';
    const room = row.room != null ? String(row.room).trim() : '';
    const houseRaw = row.house != null ? String(row.house).trim() : '';
    const house = normalizeHouse(houseRaw);

    // Catches stray header rows like {member_id:"Member ID", house:"Phone Number"}
    // as well as ordinary missing-field rows.
    if (!member_id || !name || !houseRaw) {
      skipped.push({ row: rowNum, member_id: member_id || null, reason: 'Missing member_id, name, or house.' });
      continue;
    }
    if (!house) {
      skipped.push({
        row: rowNum,
        member_id,
        reason: `"${houseRaw}" is not a valid house (must be one of: ${HOUSES.join(', ')}).`,
      });
      continue;
    }

    const { data, error } = await supabase
      .from('students')
      .insert({ member_id, name, class: className || null, room: room || null, house })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        duplicates.push({ row: rowNum, member_id, reason: 'Member ID already exists.' });
      } else {
        failed.push({ row: rowNum, member_id, reason: error.message });
      }
      continue;
    }
    inserted.push({ row: rowNum, member_id, name });
  }

  return res.status(200).json({
    success: true,
    summary: {
      total: students.length,
      inserted: inserted.length,
      skipped: skipped.length,
      duplicates: duplicates.length,
      failed: failed.length,
    },
    inserted,
    skipped,
    duplicates,
    failed,
  });
});

module.exports = router;
