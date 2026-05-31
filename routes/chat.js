const express = require('express');
const router = express.Router();
const { getChatMessages, sendChatMessage } = require('../controllers/chatController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/:participantEmail', isAuthenticated, getChatMessages);
router.post('/', isAuthenticated, sendChatMessage);

module.exports = router;