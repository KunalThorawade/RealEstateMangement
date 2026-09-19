const db = require('../config/db');

const tenantController = {
  getAll: async (req, res) => {
    try {
      const [rows] = await db.promise().query('SELECT * FROM tenants');
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching tenants', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const { user_id, name, phone, email } = req.body;
      const [result] = await db.promise().execute(
        'INSERT INTO tenants (user_id, name, phone, email) VALUES (?, ?, ?, ?)',
        [user_id, name, phone, email]
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Error adding tenant', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, email } = req.body;
      await db.promise().execute(
        'UPDATE tenants SET name=?, phone=?, email=? WHERE id=?',
        [name, phone, email, id]
      );
      res.json({ message: 'Updated' });
    } catch (err) {
      res.status(500).json({ message: 'Error updating tenant', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.promise().query(
        `SELECT t.*, l.start_date, l.end_date, l.property_id 
         FROM tenants t 
         LEFT JOIN leases l ON t.id = l.tenant_id 
         WHERE t.id = ?`, [id]
      );
      if (!rows.length) return res.status(404).json({ message: 'Not found' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: 'Error fetching tenant', error: err.message });
    }
  }
};

module.exports = tenantController;
