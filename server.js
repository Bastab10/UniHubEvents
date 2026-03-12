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

const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
    res.locals.success = req.session.success || null;
    
    // Clear any "Please login to access this page" messages from session
    if (req.session.error && req.session.error.includes('Please login to access this page')) {
        req.session.error = null;
    }
    
    // Clear registration messages after they've been displayed once
    // This prevents messages from appearing on wrong pages
    const currentPath = req.path;
    if (currentPath.includes('/events/') && req.session.success) {
        // If we're on an event details page, only allow the appropriate message
        if (req.session.success === 'Registration successful!' || 
            req.session.success === 'Registration cancelled successfully.') {
            // Allow these messages to show once
            const tempSuccess = req.session.success;
            req.session.success = null; // Clear after setting for display
            res.locals.success = tempSuccess;
        } else {
            // Clear other success messages on event pages
            req.session.success = null;
            res.locals.success = null;
        }
    }
    
    res.locals.error = req.session.error || null;
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

// 404 Handler
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
