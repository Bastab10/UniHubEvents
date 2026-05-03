const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { isAuthenticated, isApproved, isActive } = require('../middleware/auth');

router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    
    const error = req.query.error || req.session.error || null;
    delete req.session.error;
    
    res.render('auth/login', { 
        title: 'Login',
        error: error
    });
});

router.post('/login', [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').isIn(['student', 'faculty', 'admin']).withMessage('Invalid role selected')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/login', { 
                title: 'Login',
                errors: errors.array(),
                username: req.body.username,
                selectedRole: req.body.role
            });
        }

        const { username, password, role } = req.body;
        
        const user = await User.findOne({ 
            $or: [{ username }, { email: username }],
            role: role
        }).populate('createdEvents registeredEvents');

        if (!user) {
            req.session.error = 'Invalid username, email, or password';
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            req.session.error = 'Invalid username, email, or password';
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        if (!user.isActive) {
            req.session.error = 'Your account has been deactivated. Please contact the administrator.';
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        if (!user.isApproved && user.role !== 'admin') {
            if (user.role === 'student') {
                req.session.error = 'Your account is pending approval. Please contact the administrator.';
                return res.render('auth/login', { 
                    title: 'Login',
                    username,
                    selectedRole: role
                });
            } else {
                return res.render('auth/login', { 
                    title: 'Login',
                    username,
                    selectedRole: role
                });
            }
        }

        req.session.user = user;

        switch(user.role) {
            case 'admin':
                res.redirect('/admin/dashboard');
                break;
            case 'faculty':
                res.redirect('/faculty/dashboard');
                break;
            case 'student':
                res.redirect('/student/dashboard');
                break;
            default:
                res.redirect('/');
        }

    } catch (error) {
        console.error('Login error:', error);
        req.session.error = 'Server error occurred during login';
        res.render('auth/login', { 
            title: 'Login',
            username: req.body.username,
            selectedRole: req.body.role
        });
    }
});

router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    
    delete req.session.error;
    delete req.session.success;
    
    res.render('auth/register', { title: 'Register' });
});

router.post('/register', [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('collegeId').trim().notEmpty().withMessage('College ID is required'),
    body('department').trim().notEmpty().withMessage('Department is required'),
    body('role').isIn(['faculty', 'student']).withMessage('Invalid role selected'),
    body('designation').custom((value, { req }) => {
        if (req.body.role === 'faculty' && !value.trim()) {
            throw new Error('Designation is required for faculty');
        }
        return true;
    }),
    body('collegeId').custom((value, { req }) => {
        if (req.body.role === 'student') {
            const pattern = /^\d+(BA|BCA|BSC|BPES)\d{3}$/;
            if (!pattern.test(value.toUpperCase())) {
                throw new Error('Invalid College ID format. Use format: YEAR + COURSE + 3 digits');
            }
        }
        if (req.body.role === 'faculty') {
            const facultyPattern = /^(FAC\d{3}|DEPT\d{3})$/;
            if (!facultyPattern.test(value.toUpperCase())) {
                throw new Error('Invalid Coordinator ID format. Use format: FAC001 or DEPT123');
            }
        }
        return true;
    })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('auth/register', { 
                title: 'Register',
                errors: errors.array(),
                formData: req.body
            });
        }

        const { fullName, email, password, collegeId, role, department, designation } = req.body;

        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }, { 'profile.collegeId': collegeId }] 
        });

        if (existingUser) {
            req.session.error = 'Email or College ID already exists';
            return res.render('auth/register', { 
                title: 'Register',
                formData: req.body
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role,
            isApproved: role === 'student' || role === 'admin',
            profile: {
                firstName,
                lastName,
                fullName,
                collegeId,
                department,
                year: role === 'student' ? '1st Year' : undefined,
                designation: role === 'faculty' ? designation : undefined,
                verified: true
            }
        });

        await newUser.save();
        
        if (role === 'student') {
            req.session.success = 'Registration successful! Your account has been activated and you can now login.';
        } else if (role === 'faculty') {
            req.session.success = 'Registration successful! Your faculty account is pending admin approval. You will be able to login once approved.';
        } else {
            req.session.success = 'Registration successful! You can now login to your account.';
        }
        
        res.redirect('/auth/login');

    } catch (error) {
        console.error('Registration error:', error);
        req.session.error = 'Server error occurred during registration: ' + error.message;
        res.render('auth/register', { 
            title: 'Register',
            formData: req.body
        });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;
