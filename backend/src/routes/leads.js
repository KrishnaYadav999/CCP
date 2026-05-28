const express = require('express');
const router = express.Router();
const leadCtrl = require('../controllers/leadController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, leadCtrl.listLeads);
router.post('/', requireAuth, leadCtrl.createLead);

module.exports = router;
