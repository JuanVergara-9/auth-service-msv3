const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { requireAuth } = require('../middlewares/auth.middleware');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);

// Email verification
router.post('/verify-email/send', requireAuth, ctrl.sendVerificationEmail);
router.get('/verify-email', ctrl.verifyEmail);

// Admin stats
router.get('/admin/users-summary', ctrl.usersSummary);

module.exports = router;
