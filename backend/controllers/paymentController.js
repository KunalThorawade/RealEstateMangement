const db = require('../config/db');

const paymentController = {
  // List payments
  list: async (req, res) => {
    try {
      const { id: userId, role } = req.user;
      let query = 'SELECT id, lease_id, amount, payment_date, method FROM Payments';
      const params = [];

      if (role === 'tenant') {
        // map to Tenants table
        const [[tenant]] = await db.promise().execute(
          'SELECT id FROM Tenants WHERE user_id = ?',
          [userId]
        );
        if (!tenant) {
          return res.status(403).json({ message: 'Tenant profile not found' });
        }
        query += ' WHERE tenant_id = ?';
        params.push(tenant.id);
      }

      query += ' ORDER BY payment_date DESC';
      const [rows] = await db.promise().execute(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Payment list error:', err);
      res.status(500).json({ message: 'Error fetching payments', error: err.message });
    }
  },

  // Repayment endpoint
  repay: async (req, res) => {
    const userId = req.user.id;
    const { lease_id, amount, method } = req.body;

    // 1) Tenant find
    const [[tenant]] = await db.promise().execute(
      'SELECT id FROM Tenants WHERE user_id = ?',
      [userId]
    );
    if (!tenant) {
      return res.status(403).json({ message: 'Tenant profile not found' });
    }

    // 2) Lease ownership checking
    const [[lease]] = await db.promise().execute(
      `SELECT rent_amount, end_date
         FROM Leases
        WHERE id = ?
          AND tenant_id = ?
          AND status = 'active'`,
      [lease_id, tenant.id]
    );
    if (!lease) {
      return res
        .status(400)
        .json({ message: 'Lease does not exist or has expired' });
    }

    const rentAmt = Number(lease.rent_amount);

    // 3) Extra payment check
    if (amount > rentAmt) {
      return res
        .status(400)
        .json({ message: 'Excess payment: please pay only the required amount' });
    }

    const conn = await db.promise().getConnection();
    try {
      await conn.beginTransaction();

      // 4) Record payment
      const [insertRes] = await conn.execute(
        `INSERT INTO Payments
           (tenant_id, lease_id, amount, payment_date, method)
         VALUES (?, ?, ?, NOW(), ?)`,
        [tenant.id, lease_id, amount, method]
      );

      // 5) Extend on full payment
      if (amount === rentAmt) {
        await conn.execute(
          `UPDATE Leases
              SET end_date = DATE_ADD(end_date, INTERVAL 30 DAY)
            WHERE id = ?`,
          [lease_id]
        );
      }

      await conn.commit();
      res.status(201).json({ message: 'Repayment successful', paymentId: insertRes.insertId });
    } catch (err) {
      await conn.rollback();
      console.error('Repayment error:', err);
      res.status(500).json({ message: 'Error processing repayment', error: err.message });
    } finally {
      conn.release();
    }
  }
};

module.exports = paymentController;
