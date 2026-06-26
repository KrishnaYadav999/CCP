const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../constants/roles');
const asyncHandler = require('../utils/asyncHandler');

router.post('/request-otp', asyncHandler(authCtrl.requestOtp));
router.post('/verify-otp', asyncHandler(authCtrl.verifyOtp));
router.get('/me', requireAuth, asyncHandler(authCtrl.me));
router.put('/me', requireAuth, asyncHandler(authCtrl.updateMe));
router.put('/me/password', requireAuth, asyncHandler(authCtrl.updatePassword));
router.get('/users', requireAuth, asyncHandler(authCtrl.listAssignableUsers));
router.get('/admin/users', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(authCtrl.listUsers));
router.post('/admin/create-user', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(authCtrl.createUserByAdmin));
router.put('/admin/users/:id', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(authCtrl.updateUserByAdmin));

module.exports = router;
