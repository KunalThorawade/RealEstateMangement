const db = require('../config/db');
const Notification = require('../models/Notification');

const maintenanceController = {
  // List requests
  list: async (req, res) => {
    try {
      const { id: userId, role } = req.user;

      if (role === 'tenant') {
        //list all tenant requests
        const [[tenant]] = await db.promise().execute(
          'SELECT id FROM Tenants WHERE user_id = ?',
          [userId]
        );
        if (!tenant) {
          return res.status(403).json({ message: 'Tenant profile missing' });
        }

        const [rows] = await db.promise().execute(
          `SELECT m.*,
                  u.email AS staff_email
             FROM maintenance_requests m
             LEFT JOIN Users u ON m.assigned_staff_id = u.id
            WHERE m.tenant_id = ?
            ORDER BY m.created_at DESC`,
          [tenant.id]
        );
        return res.json(rows);

      } else if (role === 'staff') {
        //only  assigned non-completed requests for staff
        const [rows] = await db.promise().execute(
          `SELECT m.*,
                  u.email AS staff_email
             FROM maintenance_requests m
             LEFT JOIN Users u ON m.assigned_staff_id = u.id
            WHERE m.assigned_staff_id = ?
              AND m.status != 'completed'
            ORDER BY m.created_at DESC`,
          [userId]
        );
        return res.json(rows);

      } else if (role === 'admin') {
        //all non-completed requests for admin
        const [rows] = await db.promise().execute(
          `SELECT m.*,
                  u.email AS staff_email
             FROM maintenance_requests m
             LEFT JOIN Users u ON m.assigned_staff_id = u.id
            WHERE m.status != 'completed'
            ORDER BY m.created_at DESC`
        );
        return res.json(rows);

      } else {
        return res.status(403).json({ message: 'Unknown role' });
      }

    } catch (err) {
      console.error(' list error:', err);
      res.status(500).json({ message: 'Error fetching requests', error: err.message });
    }
  },

  // Create new request
  create: async (req, res) => {
    try {
      const { description, property_id } = req.body;
      const userId = req.user.id;

      if (!property_id || !description) {
        return res.status(400).json({ message: 'Property ID and description required' });
      }

      // Derive tenant record
      let [[tenant]] = await db.promise().execute(
        'SELECT id, name FROM Tenants WHERE user_id = ?',
        [userId]
      );
      if (!tenant) {
        return res.status(403).json({ message: 'Not a tenant account' });
      }

      // Ensure tenant has active lease
      const [[lease]] = await db.promise().execute(
        `SELECT id 
         FROM Leases 
        WHERE tenant_id = ? 
          AND property_id = ? 
          AND status = 'active'`,
        [tenant.id, property_id]
      );
      if (!lease) {
        return res
          .status(403)
          .json({ message: 'You can only create maintenance requests for properties you lease.' });
      }

      // Insert the request
      const [result] = await db.promise().execute(
        `INSERT INTO maintenance_requests
         (tenant_id, property_id, description, status)
       VALUES (?, ?, ?, 'pending')`,
        [tenant.id, property_id, description]
      );
      const requestId = result.insertId;

      res.status(201).json({ id: requestId });


      // 1) Notify the tenant
      Notification.create({
        user_id: userId,
        message: ` Your maintenance request #${requestId} was created.`,
        type: 'maintenance'
      }).catch(err =>
        console.error(' maintenance notification error to tenant:', err)
      );

      // 2) Notify all staff/admin of the new request
      const [users] = await db.promise().execute(
        `SELECT id FROM Users WHERE role IN ('staff','admin')`
      );
      for (const u of users) {
        Notification.create({
          user_id: u.id,
          message: ` New maintenance request #${requestId} by ${tenant.name}`,
          type: 'maintenance_request',
          metadata: { requestId }
        }).catch(err =>
          console.error(' maintenance notification error to staff/admin:', err)
        );
      }

    } catch (err) {
      console.error('create error:', err);
      if (!res.headersSent) {
        return res
          .status(500)
          .json({ message: 'Error creating request', error: err.message });
      }
    }
  },


  // Tenant can update description only
  updateDescription: async (req, res) => {
    try {
      const { id } = req.params;
      const { description } = req.body;
      const userId = req.user.id;

      if (!description) {
        return res.status(400).json({ message: 'Description required' });
      }

      // Confirm the tenant owns this request
      const [[own]] = await db.promise().execute(
        `SELECT 1
         FROM maintenance_requests m
         JOIN Tenants t ON m.tenant_id = t.id
         WHERE t.user_id = ? AND m.id = ?`,
        [userId, id]
      );
      if (!own) {
        return res.status(403).json({ message: 'Not authorized to edit this request' });
      }

      await db.promise().execute(
        'UPDATE maintenance_requests SET description = ? WHERE id = ?',
        [description, id]
      );
      res.json({ message: 'Request updated' });

    } catch (err) {
      console.error('UpdateDescription error:', err);
      res.status(500).json({ message: 'Error updating request', error: err.message });
    }
  },

  // Tenant can delete request
  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Confirm if owned
      const [[own]] = await db.promise().execute(
        `SELECT 1
         FROM maintenance_requests m
         JOIN Tenants t ON m.tenant_id = t.id
         WHERE t.user_id = ? AND m.id = ?`,
        [userId, id]
      );
      if (!own) {
        return res.status(403).json({ message: 'Not authorized to delete this request' });
      }

      await db.promise().execute(
        'DELETE FROM maintenance_requests WHERE id = ?',
        [id]
      );
      res.json({ message: 'Request deleted' });

    } catch (err) {
      console.error('Delete error:', err);
      res.status(500).json({ message: 'Error deleting request', error: err.message });
    }
  },

  // Staff/Admin can update status
  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { role } = req.user;

      if (!['admin', 'staff'].includes(role)) {
        return res.status(403).json({ message: 'Only staff/admin can update status' });
      }
      if (status !== 'completed') {
        return res.status(400).json({ message: 'Can only mark as completed' });
      }

      await db.promise().execute(
        'UPDATE maintenance_requests SET status = ? WHERE id = ?',
        [status, id]
      );
      res.json({ message: 'Status updated to completed' });

    } catch (err) {
      console.error('UpdateStatus error:', err);
      res.status(500).json({ message: 'Error updating status', error: err.message });
    }
  },
  // assign a request to a staff
  assign: async (req, res) => {
    try {
      const { id } = req.params;
      const { staffId } = req.body;
      const { role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({ message: 'Only admin can assign requests' });
      }

      // Optional: verify staffId exists and is a staff
      const [[staff]] = await db.promise().execute(
        `SELECT id FROM Users WHERE id = ? AND role = 'staff'`,
        [staffId]
      );
      if (!staff) {
        return res.status(400).json({ message: 'Invalid staff ID' });
      }

      await db.promise().execute(
        `UPDATE maintenance_requests
       SET assigned_staff_id = ?
       WHERE id = ?`,
        [staffId, id]
      );
      // Notify the assigned staff
      await Notification.create({
        user_id: staffId,
        message: `You’ve been assigned request #${id}`,
        type: 'maintenance_assignment',
        metadata: { requestId: id }
      });

      res.json({ message: 'Request assigned successfully' });
    } catch (err) {
      console.error('Assign error:', err);
      res.status(500).json({ message: 'Error assigning request', error: err.message });
    }
  }
};

module.exports = maintenanceController;
