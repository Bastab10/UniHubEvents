const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { isAuthenticated, isApproved, isActive } = require('../middleware/auth');

// Create Admin User (for testing)
router.get('/create-admin', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash('098098', 10);
        
        const adminUser = new User({
            username: 'bs',
            email: 'bs@gmail.com',
            password: hashedPassword,
            role: 'admin',
            profile: {
                firstName: 'Admin',
                lastName: 'User',
                fullName: 'Admin User',
                email: 'bs@gmail.com',
                collegeId: 'ADMIN001',
                verified: true
            },
            isActive: true,
            isApproved: true
        });
        
        await adminUser.save();
        
        res.send(`
            <h1>Admin User Created Successfully!</h1>
            <p>Email: bs@gmail.com</p>
            <p>Password: 098098</p>
            <p>Role: admin</p>
            <br>
            <a href="/auth/login">Go to Login</a>
        `);
    } catch (error) {
        console.error('Error creating admin:', error);
        res.send('Error creating admin user: ' + error.message);
    }
});

// Login Page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/login', { title: 'Login' });
});

// Login Process
router.post('/login', [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').isIn(['student', 'faculty', 'admin']).withMessage('Invalid role selected')
], async (req, res) => {
    try {
        console.log('Login attempt:', req.body); // Debug log
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array()); // Debug log
            return res.render('auth/login', { 
                title: 'Login',
                errors: errors.array(),
                username: req.body.username,
                selectedRole: req.body.role
            });
        }

        const { username, password, role } = req.body;
        console.log('Looking for user:', username, 'as', role); // Debug log
        
        const user = await User.findOne({ 
            $or: [{ username }, { email: username }],
            role: role
        }).populate('createdEvents registeredEvents');

        console.log('Found user:', user ? 'Yes' : 'No'); // Debug log

        if (!user) {
            console.log('User not found'); // Debug log
            req.session.error = 'Invalid username, email, or password';
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch); // Debug log

        if (!isMatch) {
            console.log('Password incorrect'); // Debug log
            req.session.error = 'Invalid username, email, or password';
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        if (!user.isActive) {
            console.log('User not active'); // Debug log
            req.session.error = 'Your account has been deactivated. Please contact the administrator.';
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        if (!user.isApproved && user.role !== 'admin') {
            console.log('User not approved'); // Debug log
            if (user.role === 'faculty') {
                req.session.error = 'Your faculty account is pending admin approval. Please wait for an administrator to approve your account.';
            } else {
                req.session.error = 'Your account is pending approval. Please contact the administrator.';
            }
            return res.render('auth/login', { 
                title: 'Login',
                username,
                selectedRole: role
            });
        }

        console.log('Login successful for:', user.username, 'as', user.role); // Debug log
        req.session.user = user;
        req.session.success = 'Login successful!';

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

// Register Page
router.get('/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth/register', { title: 'Register' });
});

// Register Process
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
            // Validate College ID format for students: YYCourseCodeRollNo
            const pattern = /^[0-9]{2}(BCA|BA|BSc)[0-9]{3}$/;
            if (!pattern.test(value.toUpperCase())) {
                throw new Error('Invalid College ID format. Use format: YYCourseCodeRollNo (e.g., 23BCA001)');
            }
        }
        return true;
    })
], async (req, res) => {
    try {
        console.log('Registration attempt:', req.body); // Debug log
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array()); // Debug log
            return res.render('auth/register', { 
                title: 'Register',
                errors: errors.array(),
                formData: req.body
            });
        }

        const { fullName, email, password, collegeId, role, department, designation } = req.body;
        console.log('Processing registration for:', fullName, email, role); // Debug log

        // Generate username from email or full name
        const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }, { 'profile.collegeId': collegeId }] 
        });

        if (existingUser) {
            console.log('User already exists:', existingUser.username); // Debug log
            req.session.error = 'Email or College ID already exists';
            return res.render('auth/register', { 
                title: 'Register',
                formData: req.body
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('Password hashed successfully'); // Debug log

        // Split full name into first and last name
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        // Create new user with proper approval status
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role,
            isApproved: role === 'student' || role === 'admin', // Students auto-approved, faculty need approval
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

        console.log('Creating user:', newUser); // Debug log
        await newUser.save();
        console.log('User saved successfully:', newUser._id); // Debug log
        
        // Set appropriate success message based on role
        if (role === 'student') {
            req.session.success = 'Registration successful! Your account has been activated and you can now login.';
        } else if (role === 'faculty') {
            req.session.success = 'Registration successful! Your faculty account is pending admin approval. You will be able to login once approved.';
        } else {
            req.session.success = 'Registration successful! You can now login to your account.';
        }
        
        console.log('Redirecting to login'); // Debug log
        res.redirect('/auth/login');

    } catch (error) {
        console.error('Registration error:', error); // Debug log
        req.session.error = 'Server error occurred during registration: ' + error.message;
        res.render('auth/register', { 
            title: 'Register',
            formData: req.body
        });
    }
});

// Debug route to check existing users
router.get('/debug-users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json({
            totalUsers: users.length,
            users: users.map(user => ({
                username: user.username,
                email: user.email,
                role: user.role,
                isApproved: user.isApproved,
                isActive: user.isActive,
                profile: {
                    firstName: user.profile.firstName,
                    lastName: user.profile.lastName,
                    collegeId: user.profile.collegeId
                }
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;
