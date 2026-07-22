const express = require('express');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const mediaController = require('../controllers/mediaController');

const router = express.Router();
router.post('/signature', requireAuth, asyncHandler(mediaController.createUploadSignature));
module.exports = router;
