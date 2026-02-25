'use strict';

const router = require('express').Router();
const { authenticateAD, authorizeGroup } = require('../middlewares/auth');

// /administrator - protected admin dashboard endpoint
router.get('/', authenticateAD, authorizeGroup('admin-dt'), (req, res) => {
    res.json({
        message:     'Administrator panel',
        user:        req.user.username,
        displayName: req.user.displayName,
        role:        req.user.role,
        groups:      req.user.groups,
    });
});

module.exports = router;
