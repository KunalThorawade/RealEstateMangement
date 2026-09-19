const db = require('../config/db');
const bcrypt = require('bcrypt');
const Notification = require('../models/Notification');

const leaseController = {
  list: async (req, res) => {
    try {
      const { id: userId, role } = req.user;

      if (role === 'tenant') {
        const [[tenant]] = await db.promise().execute(
          'SELECT id FROM Tenants WHERE user_id = ?',
          [userId]
        );
        if (!tenant) {
          return res.status(403).json({ message: 'Tenant profile missing' });
        }

        const [rows] = await db.promise().execute(
          `SELECT 
             l.id           AS lease_id,
             l.property_id,
             p.name         AS property_name,
             p.address      AS property_address,
             l.start_date,
             l.end_date,
             l.status,
             l.rent_amount,
             l.amount_left
           FROM Leases l
           JOIN Properties p ON l.property_id = p.id
           WHERE l.tenant_id = ?
           ORDER BY l.start_date DESC`,
          [tenant.id]
        );

        return res.json(rows);

      } else if (role === 'admin' || role === 'staff') {
        const [rows] = await db.promise().execute(
          `SELECT 
             l.id           AS lease_id,
             l.property_id,
             p.name         AS property_name,
             p.address      AS property_address,
             t.id           AS tenant_id,
             t.name         AS tenant_name,
             l.start_date,
             l.end_date,
             l.status,
             l.rent_amount,
             l.amount_left
           FROM Leases l
           JOIN Properties p ON l.property_id = p.id
           JOIN Tenants t ON l.tenant_id = t.id
           ORDER BY l.start_date DESC`
        );

        return res.json(rows);
      }

      return res.status(403).json({ message: 'Unauthorized role' });

    } catch (err) {
      console.error('lease list error:', err);
      res.status(500).json({ message: 'Error fetching leases', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const { property_id, tenant_id, start_date, end_date, rent_amount } = req.body;

      await db.promise().execute(
        `INSERT INTO Leases (property_id, tenant_id, start_date, end_date, rent_amount, amount_left, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [property_id, tenant_id, start_date, end_date, rent_amount, rent_amount]
      );

      await db.promise().execute(
        `UPDATE Properties SET is_active = 0 WHERE id = ?`,
        [property_id]
      );

      res.status(201).json({ message: 'Lease created' });

    } catch (err) {
      res.status(500).json({ message: 'Error creating lease', error: err.message });
    }
  },


  repay: async (req, res) => {
    console.log(' repay endpoint hit, user:', req.user.id, 'body:', req.body);
    const leaseId = parseInt(req.params.id, 10);
    const rawAmount = req.body.amount;
    const method = req.body.method;
    const password = req.body.password;
    const userId = req.user.id;

    // validate
    const amount = parseFloat(rawAmount);
    if (isNaN(amount) || amount <= 0 || !method || !password) {
      console.warn('repay validation failed', { amount, method, password });
      return res.status(400).json({ message: 'Amount, method, and password are required and must be valid' });
    }

    const conn = await db.promise().getConnection();
    try {
      await conn.beginTransaction();

      // 1) Fetch tenant record and hashed password
      const [[tenantRow]] = await conn.execute(
        `SELECT t.id AS tenant_id, u.password_hash
           FROM Users u
           JOIN Tenants t ON u.id = t.user_id
          WHERE u.id = ?`,
        [userId]
      );
      if (!tenantRow) {
        console.error('No tenant record for user', userId);
        await conn.rollback();
        return res.status(403).json({ message: 'Tenant profile not found' });
      }

      const { tenant_id, password_hash } = tenantRow;
      console.log('tenant_id =', tenant_id);

      // 2) Verify password
      const match = await bcrypt.compare(password, password_hash);
      if (!match) {
        console.warn('Invalid password for user', userId);
        await conn.rollback();
        return res.status(401).json({ message: 'Invalid password' });
      }

      // 3) Fetch lease & current left amount
      const [[lease]] = await conn.execute(
        `SELECT id, tenant_id, amount_left, rent_amount
           FROM Leases
          WHERE id = ? AND tenant_id = ? AND status = 'active'`,
        [leaseId, tenant_id]
      );
      if (!lease) {
        console.error('Lease not found or not owned by tenant', leaseId, tenant_id);
        await conn.rollback();
        return res.status(404).json({ message: 'Lease not found or not active/owned by you' });
      }

      const left = parseFloat(lease.amount_left);
      console.log('lease.amount_left =', left);

      // 4) extra payment check
      if (amount > left) {
        console.warn('Overpayment attempted:', amount, '>', left);
        await conn.rollback();
        return res
          .status(400)
          .json({ message: `Excess payment: only ₹${left.toFixed(2)} remaining` });
      }

      // 5) Record the payment
      await conn.execute(
        `INSERT INTO Payments (tenant_id, lease_id, amount, payment_date, method)
         VALUES (?, ?, ?, NOW(), ?)`,
        [tenant_id, leaseId, amount, method]
      );
      console.log('Logged payment of ₹' + amount);
      await Notification.create({
        user_id: tenant_id,
        message: `You made a payment of ₹${amount} on lease #${leaseId}`,
        type: 'repayment',
        metadata: { leaseId }
      });

      let message;
      // Exact payment
      if (Math.abs(amount - left) < 1e-6) {
        await conn.execute(
          `UPDATE Leases
             SET end_date = DATE_ADD(end_date, INTERVAL 30 DAY),
                 amount_left = rent_amount
           WHERE id = ?`,
          [leaseId]
        );
        console.log('Lease extended by 30 days');
        message = 'Full payment received; lease extended by 30 days';
        await Notification.create({
          user_id: tenant_id,
          message: `Your lease #${leaseId} has been extended by 30 days!`,
          type: 'extension',
          metadata: { leaseId }
        });

      }
      // Partial paymentt
      else {
        await conn.execute(
          `UPDATE Leases
             SET amount_left = amount_left - ?
           WHERE id = ?`,
          [amount, leaseId]
        );
        console.log('Partial payment applied; new amount_left =', left - amount);
        message = `Partial payment successful. ₹${amount.toFixed(2)} applied, ₹${(left - amount).toFixed(2)} remaining.`;
      }

      await conn.commit();
      return res.json({ message });

    } catch (err) {
      await conn.rollback();
      console.error(' repay error:', err);
      return res.status(500).json({ message: 'Error processing repayment', error: err.message });
    } finally {
      conn.release();
    }
  },

  cancel: async (req, res) => {
    const { id: leaseId } = req.params;
    const { id: userId, role } = req.user;

    const conn = await db.promise().getConnection();

    try {
      await conn.beginTransaction();

      if (role === 'tenant') {
        const [[valid]] = await conn.execute(
          `SELECT 1
           FROM Leases l
           JOIN Tenants t ON l.tenant_id = t.id
           WHERE l.id = ? AND t.user_id = ?`,
          [leaseId, userId]
        );
        if (!valid) {
          await conn.rollback();
          return res.status(403).json({ message: 'Not your lease' });
        }
      }

      const [[lease]] = await conn.execute(
        `SELECT property_id, tenant_id FROM Leases WHERE id = ?`,
        [leaseId]
      );
      if (!lease) {
        await conn.rollback();
        return res.status(404).json({ message: 'Lease not found' });
      }

      await conn.execute(`DELETE FROM Leases WHERE id = ?`, [leaseId]);

      await conn.execute(`UPDATE Properties SET is_active = 1 WHERE id = ?`, [lease.property_id]);

      await conn.commit();

      await db.promise().execute(
        `INSERT INTO Notifications (user_id, message)
         VALUES (?, ?)`,
        [role === 'tenant' ? userId : lease.tenant_id, `Lease #${leaseId} canceled.`]
      );

      await db.promise().execute(
        `INSERT INTO Notifications (user_id, message)
         SELECT id, ? FROM Users WHERE role = 'admin'`,
        [`Lease #${leaseId} was canceled by ${role}`]
      );

      return res.json({ message: 'Lease canceled successfully' });

    } catch (err) {
      await conn.rollback();
      console.error('cancel error:', err);
      return res.status(500).json({ message: 'Error canceling lease', error: err.message });
    } finally {
      conn.release();
    }
  }
};

module.exports = leaseController;
