
const db = require('../config/db');
const bcrypt = require('bcrypt');

const profileController = {
  getProfile: async (req, res) => {
    const { id: userId, role } = req.user;
    try {
      // 1) Fetch user info
      const [[user]] = await db.promise().execute(
        'SELECT id AS userId, email, role FROM Users WHERE id = ?',
        [userId]
      );
      if (!user) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      if (role === 'tenant') {
        const [[tenant]] = await db.promise().execute(
          'SELECT id AS tenantRecordId, name, phone FROM Tenants WHERE user_id = ?',
          [userId]
        );

        // Num of active leases
        let propertiesHeld = 0;
        let payments = [];
        if (tenant) {
          const [[{ cnt }]] = await db.promise().execute(
            `SELECT COUNT(*) AS cnt
             FROM Leases
             WHERE tenant_id = ? AND status = 'active'`,
            [tenant.tenantRecordId]
          );
          propertiesHeld = cnt;

          // Fetch payments history
          const [pays] = await db.promise().execute(
            `SELECT id, lease_id, amount, payment_date, method
             FROM Payments
             WHERE tenant_id = ?`,
            [tenant.tenantRecordId]
          );
          payments = pays;
        }

        // Return merged tenant profile
        return res.json({
          userId: user.userId,
          email: user.email,
          role: user.role,
          joinedAt: user.created_at,
          name: tenant?.name || null,
          phone: tenant?.phone || null,
          properties: propertiesHeld,
          payments: payments
        });
      }

      // 4) For admin and staff, return only basic info
      return res.json({
        userId: user.userId,
        email: user.email,
        role: user.role,
        joinedAt: user.created_at
      });

    } catch (err) {
      console.error('getProfile error:', err);
      res.status(500).json({ message: 'Error fetching profile', error: err.message });
    }
  },

  updateProfile: async (req, res) => {
    const { id: userId } = req.user;
    const { email, currentPassword } = req.body;

    if (!email || !currentPassword) {
      return res.status(400).json({ message: 'Email and currentPassword required' });
    }

    try {
      // Get current user data
      const [[user]] = await db.promise().execute(
        'SELECT password_hash FROM Users WHERE id = ?', [userId]
      );
      if (!user) return res.status(404).json({ message: 'User not found' });

      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        return res.status(401).json({ message: 'Incorrect password' });
      }

      // Check if email is already used
      const [[existing]] = await db.promise().execute(
        'SELECT id FROM Users WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (existing) {
        return res.status(409).json({ message: 'Email already exists' });
      }

      // Update email
      await db.promise().execute(
        'UPDATE Users SET email = ? WHERE id = ?',
        [email, userId]
      );
      res.json({ message: 'Email updated successfully' });
    } catch (err) {
      console.error('updateProfile error:', err);
      res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
  },

  deleteAccount: async (req, res) => {
    const { id: userId } = req.user;
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ message: 'currentPassword required' });
    }

    try {
      const [[user]] = await db.promise().execute(
        'SELECT password_hash FROM Users WHERE id = ?', [userId]
      );
      if (!user) return res.status(404).json({ message: 'User not found' });

      const match = await bcrypt.compare(currentPassword, user.password_hash);
      if (!match) {
        return res.status(401).json({ message: 'Incorrect password' });
      }

      await db.promise().execute(
        'DELETE FROM Users WHERE id = ?', [userId]
      );
      res.json({ message: 'Account deleted successfully' });
    } catch (err) {
      console.error('deleteAccount error:', err);
      res.status(500).json({ message: 'Error deleting account', error: err.message });
    }
  }
};

module.exports = profileController;
