const Notification = require('../models/Notification');

async function getNotifications(req, res) {
  try {
    const notes = await Notification.listForUser(req.user.id);
    res.json(notes);
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
}

async function markRead(req, res) {
  try {
    await Notification.markRead(req.params.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('markRead error:', err);
    res.status(500).json({ message: 'Error marking as read' });
  }
}

module.exports = { getNotifications, markRead };
