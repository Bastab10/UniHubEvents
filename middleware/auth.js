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
        if (!user.isApproved && user.role !== 'admin') {
            req.session.error = 'Your account is pending approval. Please contact the administrator.';
            return res.redirect('/auth/login');
        }
        next();
    } catch (error) {
        console.error(error);
        req.session.error = 'Server error occurred';
        res.redirect('/auth/login');
    }
};

exports.isActive = async (req, res, next) => {
    try {
        const user = await User.findById(req.session.user._id);
        if (!user.isActive) {
            req.session.error = 'Your account has been deactivated. Please contact the administrator.';
            return res.redirect('/auth/login');
        }
        next();
    } catch (error) {
        console.error(error);
        req.session.error = 'Server error occurred';
        res.redirect('/auth/login');
    }
};