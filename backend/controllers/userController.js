const db = require('../config/db');
const bcrypt = require('bcrypt');
const { SUPER_SECRET_KEY } = require('../config/auth');

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const { adminPassword, superKey } = req.body;
  const adminId = req.user.id;

  try {
    // Check super secret key
    if (superKey !== SUPER_SECRET_KEY) {
      return res.status(403).json({ message: 'Invalid super secret key' });
    }

    // Get admin hashed password
    const [[admin]] = await db.promise().execute(
      'SELECT password FROM Users WHERE id = ? AND role = "admin"',
      [adminId]
    );

    if (!admin || !(await bcrypt.compare(adminPassword, admin.password))) {
      return res.status(401).json({ message: 'Admin password incorrect' });
    }

    // Delete the user
    await db.promise().execute('DELETE FROM Users WHERE id = ?', [id]);
    res.json({ message: `User ${id} deleted successfully` });

  } catch (err) {
    console.error('DeleteUser error:', err);
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
};
