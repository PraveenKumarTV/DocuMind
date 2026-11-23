const express = require('express');
const controller = require('../controllers/chatController');
const router = express.Router();
router.post('/', controller.chat);
router.get('/:conversationId', controller.history);
module.exports = router;
