const db = require('../config/db');
const bcrypt = require('bcrypt');
const Notification = require('../models/Notification');

const propertyController = {
  // List all active properties
  getAll: async (req, res) => {
    try {
      const [props] = await db.promise().query(`
        SELECT p.*, u.email AS staff_email
        FROM Properties p
        LEFT JOIN Users u ON p.staff_id = u.id
        WHERE p.is_active = 1
      `);

      for (let p of props) {
        try {
          const [[{ avgRating }]] = await db.promise().execute(
            'SELECT AVG(rating) AS avgRating FROM PropertyFeedback WHERE property_id = ?',
            [p.id]
          );
          const [[{ cnt }]] = await db.promise().execute(
            'SELECT COUNT(*) AS cnt FROM PropertyFeedback WHERE property_id = ?',
            [p.id]
          );
          p.avgRating = avgRating ? parseFloat(avgRating).toFixed(1) : null;
          p.feedbackCount = cnt;
        } catch (e) {
          console.warn('Rating lookup skipped (table missing?)', e.message);
          p.avgRating = null;
          p.feedbackCount = 0;
        }
      }

      res.json(props);
    } catch (err) {
      console.error('getAll error:', err);
      res.status(500).json({ message: 'Error fetching properties', error: err.message });
    }
  },

  // Get one property by ID
  getById: async (req, res) => {
    const { id } = req.params;
    try {
      const [[p]] = await db.promise().execute(`
        SELECT p.*, u.email AS staff_email
        FROM Properties p
        LEFT JOIN Users u ON p.staff_id = u.id
        WHERE p.id = ?
      `, [id]);
      if (!p) return res.status(404).json({ message: 'Property not found' });

      let images = [];
      try {
        const [imgs] = await db.promise().execute(
          'SELECT image_url FROM PropertyImages WHERE property_id = ?',
          [id]
        );
        images = imgs.map(i => i.image_url);
      } catch (e) {
        console.warn('Image lookup skipped:', e.message);
      }

      let feedbacks = [];
      try {
        [feedbacks] = await db.promise().execute(`
          SELECT f.id, f.rating, f.comment, f.created_at,
                 t.name AS tenant_name
          FROM PropertyFeedback f
          JOIN Tenants t ON f.tenant_id = t.id
          WHERE f.property_id = ?
          ORDER BY f.rating DESC, f.created_at DESC
        `, [id]);
      } catch (e) {
        console.warn('Feedback lookup skipped:', e.message);
      }

      let avgRating = null, feedbackCount = 0;
      try {
        const [[avgRow]] = await db.promise().execute(
          'SELECT AVG(rating) AS avgRating, COUNT(*) AS cnt FROM PropertyFeedback WHERE property_id = ?',
          [id]
        );
        avgRating = avgRow.avgRating !== null ? parseFloat(avgRow.avgRating).toFixed(1) : null;
        feedbackCount = avgRow.cnt;
      } catch (e) {
        console.warn('Avg rating lookup skipped:', e.message);
      }

      res.json({
        ...p,
        images,
        feedbacks,
        avgRating,
        feedbackCount
      });
    } catch (err) {
      console.error('getById error:', err);
      res.status(500).json({ message: 'Error fetching property', error: err.message });
    }
  },

  //Create new property
  create: async (req, res) => {
    const { name, address, type, price, features, image_url, detail_url, staff_id, available_from } = req.body;
    if (!name || !address || !type || !price || !staff_id || !available_from) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
      const [result] = await db.promise().execute(`
        INSERT INTO Properties
          (name,address,type,price,features,image_url,detail_url,staff_id,available_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, address, type, price, features || '', image_url || '', detail_url || '', staff_id, available_from]);

      const newPropId = result.insertId;
      res.status(201).json({ message: 'Property created', id: newPropId });

      const [tenants] = await db.promise().execute('SELECT user_id FROM Tenants');
      for (const t of tenants) {
        await Notification.create({
          user_id: t.user_id,
          message: `New property #${newPropId} is now available!`,
          type: 'announcement'
        });
      }
    } catch (err) {
      console.error('create error:', err);
      res.status(500).json({ message: 'Error creating property', error: err.message });
    }
  },

  // Update property
  update: async (req, res) => {
    const { id } = req.params;
    const { name, address, type, price, features, image_url, detail_url, staff_id, available_from, is_active } = req.body;
    if (!name || !address || !type || !price || !staff_id || !available_from) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
      const [result] = await db.promise().execute(`
        UPDATE Properties SET
          name=?, address=?, type=?, price=?, features=?, image_url=?, detail_url=?,
          staff_id=?, available_from=?, is_active=?
        WHERE id=?
      `, [name, address, type, price, features || '', image_url || '', detail_url || '', staff_id, available_from, is_active ? 1 : 0, id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Property not found' });
      }
      res.json({ message: 'Property updated' });
    } catch (err) {
      console.error('update error:', err);
      res.status(500).json({ message: 'Error updating property', error: err.message });
    }
  },

  //Delete property
  delete: async (req, res) => {
    const { id } = req.params;
    try {
      const [result] = await db.promise().execute(
        'DELETE FROM Properties WHERE id = ?',
        [id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Property not found' });
      }
      res.json({ message: 'Property removed successfully' });
    } catch (err) {
      console.error('delete error:', err);
      res.status(500).json({ message: 'Error deleting property', error: err.message });
    }
  },

  //Add feedback
  addFeedback: async (req, res) => {
    const userId = req.user.id;
    const { rating, comment } = req.body;
    const propertyId = parseInt(req.params.id, 10);

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    try {
      let [[tenantRec]] = await db.promise().execute(
        'SELECT id FROM Tenants WHERE user_id = ?',
        [userId]
      );

      if (!tenantRec) {
        const [insertRes] = await db.promise().execute(
          'INSERT INTO Tenants (user_id, name, phone) VALUES (?, ?, ?)',
          [userId, '', '']
        );
        tenantRec = { id: insertRes.insertId };
      }

      await db.promise().execute(
        `INSERT INTO PropertyFeedback
           (tenant_id, property_id, rating, comment)
         VALUES (?, ?, ?, ?)`,
        [tenantRec.id, propertyId, rating, comment || '']
      );

      res.status(201).json({ message: 'Feedback submitted' });
    } catch (err) {
      console.error('addFeedback error:', err);
      res.status(500).json({ message: 'Error submitting feedback', error: err.message });
    }
  },

  //Purchase property
  purchase: async (req, res) => {
    const propertyId = parseInt(req.params.id, 10);
    const { amount, method, password } = req.body;
    const userId = req.user.id;

    try {
      if (!amount || !method || !password) {
        return res.status(400).json({ message: 'Amount, method, and password are required' });
      }

      const [[prop]] = await db.promise().execute(
        'SELECT price, is_active FROM Properties WHERE id = ?',
        [propertyId]
      );
      if (!prop || prop.is_active === 0) {
        return res.status(404).json({ message: 'Property not found or not available' });
      }
      const price = parseFloat(prop.price);
      if (Number(amount) !== price) {
        return res
          .status(400)
          .json({ message: `Full price required: ₹${price.toFixed(2)}` });
      }

      const [[tenantRow]] = await db.promise().execute(
        `SELECT t.id AS tenant_id, u.password_hash
           FROM Users u
           JOIN Tenants t ON u.id = t.user_id
          WHERE u.id = ?`,
        [userId]
      );
      if (!tenantRow) {
        return res.status(403).json({ message: 'Tenant profile not found' });
      }
      const { tenant_id, password_hash } = tenantRow;
      if (!(await bcrypt.compare(password, password_hash))) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      const conn = await db.promise().getConnection();
      try {
        await conn.beginTransaction();

        const [leaseResult] = await conn.execute(
          `INSERT INTO Leases
             (property_id, tenant_id, start_date, end_date, rent_amount, amount_left, status)
           VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), ?, ?, 'active')`,
          [propertyId, tenant_id, price, price]
        );
        const newLeaseId = leaseResult.insertId;

        await Notification.create({
          user_id: tenant_id,
          message: `You purchased property #${propertyId} for ₹${price.toFixed(2)}`,
          type: 'purchase',
          metadata: { propertyId, leaseId: newLeaseId }
        });

        await conn.execute(
          `INSERT INTO Payments (tenant_id, lease_id, amount, payment_date, method)
           VALUES (?, ?, ?, NOW(), ?)`,
          [tenant_id, newLeaseId, amount, method]
        );

        await conn.execute(
          `UPDATE Properties SET is_active = 0 WHERE id = ?`,
          [propertyId]
        );

        await conn.commit();
        return res.json({
          message: 'Purchase successful; lease created',
          lease_id: newLeaseId
        });
      } catch (txnErr) {
        await conn.rollback();
        console.error('purchase transaction error:', txnErr);
        return res.status(500).json({
          message: 'Error during purchase transaction',
          detail: txnErr.message
        });
      } finally {
        conn.release();
      }
    } catch (err) {
      console.error('purchase error:', err);
      return res.status(500).json({ message: 'Server error during purchase', detail: err.message });
    }
  }
};

module.exports = propertyController;
