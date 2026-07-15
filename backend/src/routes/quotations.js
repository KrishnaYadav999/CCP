const express = require('express');
const controller = require('../controllers/quotationController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', requireAuth, asyncHandler(controller.list));
router.post('/', requireAuth, asyncHandler(controller.upsert));
router.post('/bulk', requireAuth, asyncHandler(controller.bulkUpsert));

module.exports = router;
