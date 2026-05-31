const express = require('express');
const router = express.Router();
const { getStatistics, getActivityLog, createActivityLog, getNotifications, markNotificationRead } = require('../controllers/statisticsController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/', isAuthenticated, isAdmin, getStatistics);
router.get('/activity-log', isAuthenticated, isAdmin, getActivityLog);
router.post('/activity-log', isAuthenticated, isAdmin, createActivityLog);
router.get('/notifications', isAuthenticated, getNotifications);
router.put('/notifications/:id/read', isAuthenticated, markNotificationRead);

module.exports = router;