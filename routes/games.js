const express = require('express');
const router = express.Router();
const { getGameConfig, updateGameConfig, getGameQuestions, createGameQuestion, getGameProgress, updateGameProgress } = require('../controllers/gameController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/config', isAuthenticated, getGameConfig);
router.put('/config', isAuthenticated, isAdmin, updateGameConfig);
router.get('/questions', isAuthenticated, getGameQuestions);
router.post('/questions', isAuthenticated, isAdmin, createGameQuestion);
router.get('/progress', isAuthenticated, getGameProgress);
router.post('/progress', isAuthenticated, updateGameProgress);

module.exports = router;