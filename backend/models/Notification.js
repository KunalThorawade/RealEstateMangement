const db = require('../config/db');

class Notification {
  // Create notification
  static async create({ user_id, message, metadata = {}, type = 'info' }) {
    const [result] = await db.promise().execute(
      `INSERT INTO Notifications
         (user_id, message, metadata, type)
       VALUES (?, ?, ?, ?)`,
      [user_id, message, JSON.stringify(metadata), type]
    );
    return result.insertId;
  }

  // List all notification
  static async listForUser(user_id) {
    const [rows] = await db.promise().execute(
      `SELECT 
         id, message, metadata, type, is_read, created_at
       FROM Notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [user_id]
    );
    return rows;
  }

  // Mark as read
  static async markRead(id) {
    await db.promise().execute(
      `UPDATE Notifications
         SET is_read = 1
       WHERE id = ?`,
      [id]
    );
  }
}

module.exports = Notification;
