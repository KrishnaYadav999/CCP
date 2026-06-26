const express = require('express');
const router = express.Router();
const clientCtrl = require('../controllers/clientController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, clientCtrl.listClients);
router.post('/bulk', requireAuth, clientCtrl.bulkCreateClients);
router.post('/', requireAuth, clientCtrl.createClient);
router.put('/:id', requireAuth, clientCtrl.updateClient);

module.exports = router;
