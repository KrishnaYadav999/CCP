const express = require('express');
const router = express.Router();
const teamCtrl = require('../controllers/teamController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', requireAuth, asyncHandler(teamCtrl.listTeams));
router.post('/', requireAuth, asyncHandler(teamCtrl.createTeam));

module.exports = router;
