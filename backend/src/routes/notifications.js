const express = require('express');
const notificationCtrl = require('../controllers/notificationController');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../constants/roles');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/', requireAuth, asyncHandler(notificationCtrl.listNotifications));
router.post('/', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(notificationCtrl.createNotification));
router.patch('/read-all', requireAuth, asyncHandler(notificationCtrl.markAllRead));
router.patch('/:id', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(notificationCtrl.updateNotification));
router.patch('/:id/read', requireAuth, asyncHandler(notificationCtrl.markRead));

module.exports = router;
