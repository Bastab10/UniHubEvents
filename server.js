require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const cors = require('cors');

const app = express();

const PORT = process.env.PORT || 8080;

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000
})
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
    res.locals.currentUser = req.session.user || null;

    res.locals.success = req.session.success || null;
    req.session.success = null;
    req.session.eventSuccess = null;

    res.locals.error = req.session.error || null;
    req.session.error = null;
    req.session.eventError = null;

    next();
});

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const facultyRoutes = require('./routes/faculty');
const studentRoutes = require('./routes/student');
const eventRoutes = require('./routes/events');

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/faculty', facultyRoutes);
app.use('/student', studentRoutes);
app.use('/events', eventRoutes);

app.get('/', (req, res) => {
    res.redirect('/student/dashboard');
});

app.get('/about', (req, res) => {
    res.render('about', { title: 'About North Lakhimpur College' });
});

app.get('/contact', (req, res) => {
    res.render('contact', { title: 'Contact North Lakhimpur College' });
});

app.use((req, res) => {
    res.status(404).render('error', { 
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

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
