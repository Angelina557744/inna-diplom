const express = require('express');
const router = express.Router();
const { getAllGroups, createGroup, updateGroup, deleteGroup, getSchedule } = require('../controllers/groupController');
const { isAuthenticated, isTeacher, isAdmin } = require('../middleware/auth');

router.get('/', isAuthenticated, getAllGroups);
router.post('/', isAuthenticated, isTeacher, createGroup);
router.put('/:id', isAuthenticated, isTeacher, updateGroup);
router.delete('/:id', isAuthenticated, isAdmin, deleteGroup);
router.get('/schedule/my', isAuthenticated, getSchedule);

module.exports = router;