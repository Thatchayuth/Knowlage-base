'use strict';

const router = require('express').Router();
const { authenticateAD } = require('../middlewares/auth');
const { getMenu, getKnowledgeById, getFeaturedKnowledge } = require('../controllers/knowledgeController');
const { search } = require('../controllers/searchController');
const { getCurrentUser } = require('../controllers/authController');
const { authenticateADother } = require('../middlewares/auth');

// GET /api/menu - public, but attach user if authenticated (optional auth)
router.get('/menu', getMenu);

// GET /api/search?q=keyword
router.get('/search', search);

// GET /api/knowledge/:id - requires auth to log who viewed
router.get('/knowledge/:id', getKnowledgeById);

// GET /api/featured - top highlighted/popular items
router.get('/featured', getFeaturedKnowledge);

// GET /api/auth/me - authenticate and return current user profile
router.get('/auth/me', authenticateAD, getCurrentUser);
// GET /api/auth/Other - authenticate and return current user profile
router.get('/auth/other', authenticateADother);

module.exports = router;
