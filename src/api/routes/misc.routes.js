const express = require('express');
const { getVersion, getSharePage } = require('../controllers/misc.controller');
const { validateId } = require('../middlewares/validator');

const router = express.Router();

router.get('/api/version', getVersion);
router.get('/share/:id', validateId, getSharePage);

module.exports = router;