const express = require('express');
const router = express.Router();
const { syncOfflineData } = require('../controllers/syncController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, syncOfflineData);

module.exports = router;
