// ============================================================
// FIXED ACTIVITY -> POINTS LIST
// ============================================================
// This is the ONLY place point values are decided. Nobody — not the
// Excel sheet, not a direct API call — can submit arbitrary points.
// src/routes/points.js looks up the activity here and always uses
// this value, ignoring anything sent by the client.
//
// To add/remove/rename an activity or change its points, edit ONLY
// this file and restart the server. Everything else (Excel dropdown,
// the /activities page, the API) reads from here.
// ============================================================

const ACTIVITIES = [
  { name: 'Academic Excellence', points: 5, description: 'Outstanding classroom/exam performance' },
  { name: 'Bed Made Properly', points: 3, description: '' },
  { name: 'Breaking Line', points: -5, description: '' },
  { name: 'Bringing Prohibited Items (Onion/Garlic)', points: -10, description: '' },
  { name: 'Bullying L1', points: -5, description: '' },
  { name: 'Bullying L2', points: -10, description: '' },
  { name: 'Bullying L3', points: -15, description: '' },
  { name: 'Cleanliness & Hygiene', points: 5, description: 'Kept room/area clean and tidy' },
  { name: 'Cupboard Organized', points: 3, description: '' },
  { name: 'Damaging School Property', points: -15, description: '' },
  { name: 'Discipline & Punctuality', points: 5, description: 'On time and well-behaved' },
  { name: 'Disrespecting Teachers/Elders', points: -10, description: '' },
  { name: 'Disturbing in Study Hours', points: -3, description: '' },
  { name: 'Encouraging Other Students', points: 2, description: '' },
  { name: 'Fighting with Students', points: -10, description: '' },
  { name: 'Following Hostel Rules', points: 5, description: '' },
  { name: 'Good Behaviour', points: 5, description: '' },
  { name: 'Helping Friends', points: 5, description: '' },
  { name: 'Helping New Students Settle In', points: 3, description: '' },
  { name: 'Helping Others', points: 5, description: 'Helped a fellow student or staff member' },
  { name: 'Homework Completed', points: 5, description: '' },
  { name: 'Improvement in Discipline', points: 5, description: '' },
  { name: 'Late for Prayer', points: -5, description: '' },
  { name: 'Late for Study Time', points: -3, description: '' },
  { name: 'Leading Prayer/Assembly', points: 5, description: '' },
  { name: 'Maintaining Silence During Evening Prayer', points: 3, description: '' },
  { name: 'Morning Prayer Attendance', points: 1, description: '' },
  { name: 'No Tika-Tilak', points: -5, description: '' },
  { name: 'Not Done Homework', points: -3, description: '' },
  { name: 'Not Returning Borrowed Items on Time', points: -5, description: '' },
  { name: 'On-Time for All Activities', points: 5, description: '' },
  { name: 'Outstanding Discipline', points: 10, description: '' },
  { name: 'Participating in Seva', points: 3, description: '' },
  { name: 'Participating in Yoga & Meditation', points: 3, description: '' },
  { name: 'Respecting Teachers & Elders', points: 5, description: '' },
  { name: 'Returning Borrowed Items on Time', points: 3, description: '' },
  { name: 'Room Cleanliness', points: 3, description: '' },
  { name: 'Rule Violation', points: -10, description: 'Broke hostel rules' },
  { name: 'Saving Water & Electricity', points: 3, description: '' },
  { name: 'Speaking in Hindi L1', points: -5, description: '' },
  { name: 'Speaking in Hindi L2', points: -10, description: '' },
  { name: 'Sports Achievement', points: 15, description: 'Excelled in sports or games' },
  { name: 'Sports Participation', points: 5, description: '' },
  { name: 'Talking During Study', points: -3, description: '' },
  { name: 'Uniform Not Proper', points: -3, description: '' },
  { name: 'Untidy Bed', points: -3, description: '' },
  { name: 'Untidy Room', points: -5, description: '' },
  { name: 'Using Bad Language L1', points: -5, description: '' },
  { name: 'Using Bad Language L2', points: -10, description: '' },
  { name: 'Using Bad Language L3', points: -15, description: '' },
  { name: 'Wasting Food', points: -5, description: '' },
  { name: 'Wearing Proper Uniform', points: 1, description: '' },
  { name: 'Winning Competition', points: 10, description: '' },
].map((a) => ({ ...a, category: a.points >= 0 ? 'Positive' : 'Negative' }));

// Fast case-insensitive lookup by name.
const BY_NAME = new Map(ACTIVITIES.map((a) => [a.name.trim().toLowerCase(), a]));

function findActivity(name) {
  if (!name || typeof name !== 'string') return null;
  return BY_NAME.get(name.trim().toLowerCase()) || null;
}

module.exports = { ACTIVITIES, findActivity };
