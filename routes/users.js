const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser, createUser, updateUsersBatch, deleteUser } = require('../controllers/userController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/', isAuthenticated, isAdmin, getAllUsers);
router.get('/:id', isAuthenticated, getUserById);
router.put('/:id', isAuthenticated, updateUser);
router.post('/', isAuthenticated, isAdmin, createUser);
router.put('/admin/users', isAuthenticated, isAdmin, updateUsersBatch);
router.delete('/:id', isAuthenticated, isAdmin, deleteUser);

module.exports = router;