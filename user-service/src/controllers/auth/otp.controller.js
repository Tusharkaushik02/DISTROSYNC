const otpAuthService = require('../../services/auth/otp.auth.service');

const sendOtp = async (req, res, next) => {
  try {
    const { email, purpose } = req.body;
    const data = await otpAuthService.sendOtp(email, purpose);

    // TODO: Set otpSessionId in HttpOnly cookie when enabled
    // res.cookie('otpSessionId', data.otpSessionId, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 5 * 60 * 1000 });

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
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

const verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    const otpSessionId = req.body?.otpSessionId || req.cookies?.otpSessionId;

    const data = await otpAuthService.verifyOtp(otp, otpSessionId);

    // TODO: Clear otpSessionId cookie when enabled
    // res.clearCookie('otpSessionId');

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

module.exports = {
  sendOtp,
  verifyOtp,
};
