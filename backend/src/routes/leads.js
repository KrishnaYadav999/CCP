const express = require('express');
const router = express.Router();
const leadCtrl = require('../controllers/leadController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const historyCtrl = require('../controllers/leadHistoryController');

function requireHistoryAccess(req, res, next) {
  const expected = process.env.CCP_SHARED_API_KEY;
  const provided = req.get('x-ccp-api-key') || req.get('x-ccp-secret');
  if (expected && provided === expected) return next();
  return requireAuth(req, res, next);
}

router.get('/', requireAuth, asyncHandler(leadCtrl.listLeads));
router.get('/:id/history', requireHistoryAccess, asyncHandler(historyCtrl.getHistory));
router.post('/:id/history/email', requireHistoryAccess, asyncHandler(historyCtrl.logEmail));
router.post('/bulk', requireAuth, asyncHandler(leadCtrl.bulkCreateLeads));
router.post('/', requireAuth, asyncHandler(leadCtrl.createLead));
router.put('/:id', requireAuth, asyncHandler(leadCtrl.updateLead));

module.exports = router;
