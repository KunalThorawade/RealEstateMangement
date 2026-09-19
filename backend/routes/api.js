const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const propertyController = require('../controllers/propertyController');
const tenantController = require('../controllers/tenantController');
const leaseController = require('../controllers/leaseController');
const staffController = require('../controllers/staffController');
const paymentController = require('../controllers/paymentController');
const userController = require('../controllers/userController');
const profileController = require('../controllers/profileController');
const notificationsController = require('../controllers/notificationsController');
const maintenanceController = require('../controllers/maintenanceController');
const { authorize } = require('../middleware/auth');

// Authentication
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

// Profile routes
router.get('/profile', authorize(), profileController.getProfile);
router.put('/profile', authorize(), profileController.updateProfile);
router.delete('/profile', authorize(), profileController.deleteAccount);

// Property routes
router.get('/properties', authorize(), propertyController.getAll);
router.get('/properties/:id', authorize(), propertyController.getById);
router.post('/properties', authorize(['admin']), propertyController.create);
router.put('/properties/:id', authorize(['admin']), propertyController.update);
router.delete('/properties/:id', authorize(['admin']), propertyController.delete);

// Feedback
router.post('/properties/:id/feedback', authorize(['tenant']), propertyController.addFeedback);

// Purchase
router.post('/properties/:id/purchase', authorize(['tenant']), propertyController.purchase);

// Tenant routes
router.get('/tenants', authorize(['admin']), tenantController.getAll);
router.post('/tenants', authorize(['admin']), tenantController.create);
router.put('/tenants/:id', authorize(['admin']), tenantController.update);
router.get('/tenants/:id', authorize(), tenantController.getById);

// Lease routes
router.get('/leases', authorize(), leaseController.list);
router.post('/leases', authorize(['admin']), leaseController.create);
router.post('/leases/:id/repay', authorize(['tenant']), leaseController.repay);
router.delete('/leases/:id', authorize(['tenant','admin']), leaseController.cancel);

// User routes
router.delete('/users/:id', authorize(['admin']), userController.deleteUser);

// Payment routes
router.get('/payments', authorize(), paymentController.list);
router.post('/payments/repay', authorize(['tenant']), paymentController.repay);

// Maintenance routes
router.get('/maintenance', authorize(), maintenanceController.list);
router.post('/maintenance', authorize(['tenant']), maintenanceController.create);
router.put('/maintenance/:id', authorize(['tenant']), maintenanceController.updateDescription);
router.delete('/maintenance/:id', authorize(['tenant']), maintenanceController.delete);
router.put('/maintenance/:id/status', authorize(['staff','admin']), maintenanceController.updateStatus);
router.post('/maintenance/:id/assign', authorize(['admin']), maintenanceController.assign);

// Notification routes
router.get('/notifications', authorize(), notificationsController.getNotifications);
router.put('/notifications/:id/read', authorize(), notificationsController.markRead);

// Staff routes
router.get('/staff', authorize(['admin']), staffController.list);

module.exports = router;
