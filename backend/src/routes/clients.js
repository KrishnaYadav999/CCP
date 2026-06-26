const express = require('express');
const router = express.Router();
const clientCtrl = require('../controllers/clientController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', requireAuth, asyncHandler(clientCtrl.listClients));
router.post('/bulk', requireAuth, asyncHandler(clientCtrl.bulkCreateClients));
router.post('/', requireAuth, asyncHandler(clientCtrl.createClient));
router.put('/:id', requireAuth, asyncHandler(clientCtrl.updateClient));

module.exports = router;
