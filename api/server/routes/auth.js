const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { createSetBalanceConfig, forceRefreshCloudFrontAuthCookies } = require('@librechat/api');
const {
  resetPasswordRequestController,
  resetPasswordController,
  registrationController,
  graphTokenController,
  refreshController,
} = require('~/server/controllers/AuthController');
const {
  regenerateBackupCodes,
  disable2FA,
  confirm2FA,
  enable2FA,
  verify2FA,
} = require('~/server/controllers/TwoFactorController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { findBalanceByUser, upsertBalanceFields, findUser, createUser } = require('~/models');
const { getAppConfig } = require('~/server/services/Config');
const { setAuthTokens } = require('~/server/services/AuthService');
const middleware = require('~/server/middleware');

const setBalanceConfig = createSetBalanceConfig({
  getAppConfig,
  findBalanceByUser,
  upsertBalanceFields,
});

const router = express.Router();
const getCloudFrontAuthCookieRefreshResult = (req, res) => {
  const warmedResult = req.cloudFrontAuthCookieRefreshResult;
  if (warmedResult && (warmedResult.attempted || !warmedResult.enabled)) {
    return warmedResult;
  }

  return forceRefreshCloudFrontAuthCookies(req, res, req.user);
};

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', middleware.requireJwtAuth, logoutController);
router.post(
  '/login',
  middleware.logHeaders,
  middleware.loginLimiter,
  middleware.checkBan,
  middleware.validateEmailLogin,
  ldapAuth ? middleware.requireLdapAuth : middleware.requireLocalAuth,
  setBalanceConfig,
  loginController,
);
router.post('/refresh', refreshController);
router.post('/cloudfront/refresh', middleware.requireJwtAuth, (req, res) => {
  const result = getCloudFrontAuthCookieRefreshResult(req, res);
  if (!result.enabled) {
    return res.sendStatus(404);
  }

  const status = result.refreshed ? 200 : 500;
  return res.status(status).json({
    ok: result.refreshed,
    expiresInSec: result.expiresInSec,
    refreshAfterSec: result.refreshAfterSec,
  });
});
router.post(
  '/register',
  middleware.registerLimiter,
  middleware.checkBan,
  middleware.checkInviteUser,
  middleware.validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  middleware.resetPasswordLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordRequestController,
);
router.post(
  '/resetPassword',
  middleware.resetPasswordSubmissionLimiter,
  middleware.checkBan,
  middleware.validatePasswordReset,
  resetPasswordController,
);

router.post('/2fa/enable', middleware.requireJwtAuth, enable2FA);
router.post('/2fa/verify', middleware.requireJwtAuth, verify2FA);
router.post(
  '/2fa/verify-temp',
  middleware.setTwoFactorTempUser,
  middleware.twoFactorTempLimiter,
  middleware.checkBan,
  verify2FAWithTempToken,
);
router.post('/2fa/confirm', middleware.requireJwtAuth, confirm2FA);
router.post('/2fa/disable', middleware.requireJwtAuth, disable2FA);
router.post('/2fa/backup/regenerate', middleware.requireJwtAuth, regenerateBackupCodes);

router.get('/graph-token', middleware.requireJwtAuth, graphTokenController);

/**
 * GET /api/auth/nimbus-sso?token=<jwt>
 *
 * Nimbus SSO handoff. nimbusapi.net mints a 60-second HS256 JWT via
 * GET /api/auth/chat-token, then redirects the browser here. We verify
 * the token, find or create the LibreChat user, issue auth cookies, and
 * redirect to the chat root. The LibreChat client calls /api/auth/refresh
 * on load and gets a fresh access token from the refreshToken cookie.
 *
 * Required env vars:
 *   NIMBUS_SSO_SHARED_SECRET — same 32+ byte secret on both sides
 *   DOMAIN_CLIENT            — e.g. https://chat.nimbusapi.net
 */
router.get('/nimbus-sso', async (req, res) => {
  const clientOrigin = process.env.DOMAIN_CLIENT || '/';

  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      logger.warn('[nimbusSso] missing or invalid token param');
      return res.redirect(`${clientOrigin}?error=sso_invalid`);
    }

    const secret = process.env.NIMBUS_SSO_SHARED_SECRET;
    if (!secret) {
      logger.error('[nimbusSso] NIMBUS_SSO_SHARED_SECRET not configured');
      return res.redirect(`${clientOrigin}?error=sso_not_configured`);
    }

    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'], maxAge: '65s' });
    } catch (err) {
      logger.warn('[nimbusSso] JWT verification failed:', err.message);
      return res.redirect(`${clientOrigin}?error=sso_expired`);
    }

    const { email, name, sub: nimbusId } = payload;
    if (!email || typeof email !== 'string') {
      logger.warn('[nimbusSso] JWT payload missing email');
      return res.redirect(`${clientOrigin}?error=sso_payload`);
    }

    // Find existing user or create a new one (provider=nimbus, no password needed)
    let user = await findUser({ email }, 'email _id name role');
    if (!user) {
      const safeUsername = email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40) || `nimbus_${nimbusId?.slice(0, 8) || 'user'}`;

      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await createUser(
        {
          provider: 'nimbus',
          email,
          username: safeUsername,
          name: name || safeUsername,
          avatar: null,
          role: SystemRoles.USER,
          emailVerified: true,
          nimbusId,
          password: bcrypt.hashSync(randomPassword, 10),
        },
        null,  // balance config — new SSO users start at default balance
        true,  // disableTTL
        true,  // bypass email verification
      );
      logger.info(`[nimbusSso] created new user for ${email}`);
    }

    await setAuthTokens(user._id, res, null, req);
    logger.info(`[nimbusSso] SSO login success for ${email}`);
    return res.redirect(clientOrigin);
  } catch (err) {
    logger.error('[nimbusSso] unexpected error:', err);
    return res.redirect(`${clientOrigin}?error=sso_error`);
  }
});

module.exports = router;
