const express = require('express');
const controller = require('../controllers/quotationController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', requireAuth, asyncHandler(controller.list));
router.get('/pibo-categories', requireAuth, asyncHandler(controller.listPiboCategories));
router.post('/pibo-categories', requireAuth, asyncHandler(controller.createPiboCategory));
router.get('/service-categories', requireAuth, asyncHandler(controller.listServiceCategories));
router.post('/service-categories', requireAuth, asyncHandler(controller.createServiceCategory));
router.post('/', requireAuth, asyncHandler(controller.upsert));
router.post('/bulk', requireAuth, asyncHandler(controller.bulkUpsert));

module.exports = router;
