const express = require('express');
const router = express.Router();
const clientCtrl = require('../controllers/clientController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, clientCtrl.listClients);
router.post('/', requireAuth, clientCtrl.createClient);

module.exports = router;
