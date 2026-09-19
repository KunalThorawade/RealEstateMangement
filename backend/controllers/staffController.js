const db = require('../config/db');

exports.list = async (req, res) => {
  try {
    // Only return staff
    const [rows] = await db.promise().execute(
      `SELECT id, email
         FROM Users
        WHERE role = 'staff'
        ORDER BY email`
    );
    return res.json(rows);
  } catch (err) {
    console.error('Staff list error:', err);
    return res.status(500).json({ message: 'Error fetching staff', error: err.message });
  }
};
