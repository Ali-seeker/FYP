const express = require('express');
const router = express.Router();
const { processCommand } = require('../controllers/assistantController');
const { protect } = require('../middleware/authMiddleware');

// POST /api/assistant/command
// Receives transcribed text from the frontend Web Speech API
router.post('/command', protect, processCommand);

module.exports = router;
