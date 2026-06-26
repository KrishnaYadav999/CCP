const express = require('express');
const router = express.Router();
const leadCtrl = require('../controllers/leadController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', requireAuth, asyncHandler(leadCtrl.listLeads));
router.post('/bulk', requireAuth, asyncHandler(leadCtrl.bulkCreateLeads));
router.post('/', requireAuth, asyncHandler(leadCtrl.createLead));
router.put('/:id', requireAuth, asyncHandler(leadCtrl.updateLead));

module.exports = router;
