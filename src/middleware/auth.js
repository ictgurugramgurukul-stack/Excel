// Protects the endpoints Excel calls (submit points, sync students).
// Excel sends the shared secret in the "x-api-key" header. This key
// is NOT the Supabase key — it only proves the request came from an
// authorised copy of the Excel workbook.
function requireExcelApiKey(req, res, next) {
  const provided = req.header('x-api-key');
  const expected = process.env.EXCEL_API_KEY;

  if (!expected) {
    return res.status(500).json({ error: 'Server misconfigured: EXCEL_API_KEY not set.' });
  }
  if (!provided || provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized. Missing or invalid API key.' });
  }
  next();
}

module.exports = { requireExcelApiKey };
