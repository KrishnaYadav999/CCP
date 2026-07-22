const express = require('express');
const router = express.Router();
const clientCtrl = require('../controllers/clientController');
const { requireAuth, requireRoles } = require('../middleware/auth');
const { ADMIN_ROLES } = require('../constants/roles');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', requireAuth, asyncHandler(clientCtrl.listClients));
router.post('/bulk', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(clientCtrl.bulkCreateClients));
router.post('/years/bulk', requireAuth, requireRoles(ADMIN_ROLES), asyncHandler(clientCtrl.bulkUpdateClientYears));
router.post('/', requireAuth, asyncHandler(clientCtrl.createClient));
router.patch('/:id/years', requireAuth, asyncHandler(clientCtrl.updateClientYears));
router.get('/:id/annual-return', requireAuth, asyncHandler(clientCtrl.getAnnualReturn));
router.put('/:id/annual-return', requireAuth, asyncHandler(clientCtrl.saveAnnualReturn));
router.get('/:id/annual-return/:annualYear/access', requireAuth, asyncHandler(clientCtrl.getAnnualYearAccess));
router.put('/:id', requireAuth, asyncHandler(clientCtrl.updateClient));

module.exports = router;
