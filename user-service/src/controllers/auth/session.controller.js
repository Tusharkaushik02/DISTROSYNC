const sessionAuthService = require('../../services/auth/session.auth.service');

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';

    const data = await sessionAuthService.refresh(refreshToken, ip, userAgent);

    // TODO: Set new cookies when enabled
    // res.cookie('accessToken', data.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 15 * 60 * 1000 });
    // res.cookie('refreshToken', data.refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken || req.cookies?.refreshToken;

    const result = await sessionAuthService.logout(refreshToken);

    // TODO: Clear auth cookies when enabled
    // res.clearCookie('accessToken');
    // res.clearCookie('refreshToken');

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

const logoutAll = async (req, res, next) => {
  try {
    const userId = req.body?.userId;

    const result = await sessionAuthService.logoutAll(userId);

    // TODO: Clear auth cookies when enabled
    // res.clearCookie('accessToken');
    // res.clearCookie('refreshToken');

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

module.exports = {
  refresh,
  logout,
  logoutAll,
};
