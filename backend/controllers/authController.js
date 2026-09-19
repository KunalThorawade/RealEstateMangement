
const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const { JWT_SECRET } = require('../config/auth');
const { isValidEmail, isStrongPassword } = require('../utils/validators');

const authController = {
  register: async (req, res) => {
    const { email, password, role, adminCode } = req.body;

    // Email format
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    // Password strength
    if (!password || !isStrongPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 7 characters with one uppercase letter and one digit' });
    }
    // for admin check passcode
    if (role === 'admin') {
      if (!adminCode) {
        return res.status(400).json({ message: 'Admin code required for admin registration' });
      }
      const [[row]] = await db.promise().query(
        'SELECT id FROM AdminCodes WHERE code = ?', [adminCode]
      );
      if (!row) {
        return res.status(403).json({ message: 'Invalid admin code' });
      }
    }

    try {
      // Email uniqueness
      const [[existing]] = await db.promise().query(
        'SELECT id FROM Users WHERE email = ?', [email]
      );
      if (existing) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      // Hashing
      const pwdHash = await bcrypt.hash(password, 10);
      const [result] = await db.promise().execute(
        'INSERT INTO Users (email, password_hash, role) VALUES (?, ?, ?)',
        [email, pwdHash, role]
      );
      const userId = result.insertId;

      //if tenant, create a Tenants record
      if (role === 'tenant') {
        await db.promise().execute(
          'INSERT INTO Tenants (user_id, name, phone) VALUES (?, ?, ?)',
          [userId, '', '']
        );
      }

      const token = jwt.sign(
        { id: result.insertId, role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.status(201).json({ message: 'Registered and logged in', token });
      await Notification.create({
        user_id: newUserId,
        message: 'Welcome to Real Estate Management!',
        type: 'welcome'
      });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ message: 'Error registering user', error: err.message });
    }
  },

  login: async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    try {
      const [[user]] = await db.promise().query(
        'SELECT id, email, password_hash, role FROM Users WHERE email = ?', [email]
      );
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ message: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );
      res.json({ token });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ message: 'Error during login', error: err.message });
    }
  }
};

module.exports = authController;
