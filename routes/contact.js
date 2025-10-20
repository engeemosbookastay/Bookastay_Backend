const express = require('express');
const router = express.Router();
// Import the controller's createContact function
const { createContact } = require('../controllers/contactController');

// POST /api/contact
router.post('/', createContact);

module.exports = router;
