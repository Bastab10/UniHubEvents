const User = require('../models/User');

exports.isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
};

exports.checkRole = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/auth/login');
        }

        if (!roles.includes(req.session.user.role)) {
            req.session.error = 'Access denied. You do not have permission to access this page.';
            return res.redirect('/auth/login');
        }

        next();
    };
};

exports.isApproved = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.user._id);
        if (!user || (!user.isApproved && user.role !== 'admin')) {
            const error = 'Your account is pending approval. Please contact the administrator.';
            return req.session.destroy(() => {
                res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
            });
        }
        next();
    } catch (error) {
        console.error(error);
        return req.session.destroy(() => {
            res.redirect('/auth/login?error=Server+error+occurred');
        });
    }
};

exports.isActive = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.user._id);
        if (!user || !user.isActive) {
            const error = 'Your account has been deactivated. Please contact the administrator.';
            return req.session.destroy(() => {
                res.redirect(`/auth/login?error=${encodeURIComponent(error)}`);
            });
        }
        next();
    } catch (error) {
        console.error(error);
        return req.session.destroy(() => {
            res.redirect('/auth/login?error=Server+error+occurred');
        });
    }
};