require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 8080;

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// View Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Custom Middleware
app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    
    // Only set success messages for login page
    const currentPath = req.path;
    if (currentPath === '/auth/login') {
        res.locals.success = req.session.success || null;
        // Clear success message after setting for display
        if (req.session.success) {
            const tempSuccess = req.session.success;
            req.session.success = null;
            res.locals.success = tempSuccess;
        }
    } else if (currentPath.includes('/student/events/') && req.session.success) {
        // Handle event-specific success messages (registration, cancellation, etc.)
        const eventId = currentPath.split('/').pop();
        // Show success message if it's for the current event or if no event tracking exists
        if (!req.session.eventSuccess || req.session.eventSuccess === eventId) {
            const tempSuccess = req.session.success;
            req.session.success = null;
            req.session.eventSuccess = null;
            res.locals.success = tempSuccess;
        } else {
            // Clear success messages on wrong event pages
            req.session.success = null;
            res.locals.success = null;
        }
    } else {
        // Clear success messages on all other pages
        if (req.session.success) {
            req.session.success = null;
        }
        if (req.session.eventSuccess) {
            req.session.eventSuccess = null;
        }
        res.locals.success = null;
    }
    
    // Handle event-specific error messages (conflict validation, etc.)
    if (currentPath.includes('/student/events/') && req.session.error) {
        // Only show event-specific errors on event details pages
        const eventId = currentPath.split('/').pop();
        if (!req.session.eventError || req.session.eventError === eventId) {
            const tempError = req.session.error;
            req.session.error = null;
            req.session.eventError = null;
            res.locals.error = tempError;
        } else {
            // Clear event errors on wrong event pages
            req.session.error = null;
            res.locals.error = null;
        }
    } else {
        // Clear any event-specific errors when not on event pages
        if (req.session.eventError) {
            req.session.eventError = null;
        }
        // Handle other errors (login errors, etc.)
        if (req.session.error && req.session.error.includes('Please login to access this page')) {
            req.session.error = null;
        }
        res.locals.error = req.session.error || null;
    }
    
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const studentRoutes = require('./routes/student');
const eventRoutes = require('./routes/events');

// Debug route to test uploads
app.get('/debug/uploads', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, 'uploads');
    
    if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        res.json({
            uploadsDir: uploadsDir,
            exists: true,
            files: files.slice(0, 10), // Show first 10 files
            totalFiles: files.length
        });
    } else {
        res.json({
            uploadsDir: uploadsDir,
            exists: false,
            files: []
        });
    }
});

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/faculty', facultyRoutes);
app.use('/student', studentRoutes);
app.use('/events', eventRoutes);

// Home Route
app.get('/', (req, res) => {
    if (req.session.user) {
        switch(req.session.user.role) {
            case 'admin':
                return res.redirect('/admin/dashboard');
            case 'faculty':
                return res.redirect('/faculty/dashboard');
            case 'student':
                return res.redirect('/student/dashboard');
        }
    }
    res.render('home', { title: 'Welcome to Campus Events' });
});

// About Route - Common for all user roles
app.get('/about', (req, res) => {
    res.render('about', { title: 'About North Lakhimpur College' });
});

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact North Lakhimpur College' });
});

// 404 Handler`
app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { 
        title: 'Server Error',
        message: 'Something went wrong on our end. Please try again later.'
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
