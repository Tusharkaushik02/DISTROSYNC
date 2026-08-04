const { verifyAccessToken } = require("../utils/auth");
const prisma = require("../config/prisma");

// Middleware to protect routes
async function authMiddleware(req, res, next) {
    const token = req.cookies?.token || req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized"
        });
    }

    try {
        const decoded = verifyAccessToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                error: "Invalid token"
            });
        }

        const userId = decoded.id || decoded.sub;

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({
            success: false,
            error: "Invalid token"
        });
    }
}

module.exports = authMiddleware;
