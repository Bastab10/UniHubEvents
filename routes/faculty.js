const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Event = require('../models/Event');
const User = require('../models/User');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Sanitize filename for mobile compatibility
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        const filename = timestamp + '-' + originalName;
        console.log('Generated filename:', filename);
        cb(null, filename);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1, // Limit to 1 file at a time
        fieldSize: 1024 * 1024 // 1MB field size limit for mobile
    },
    fileFilter: function (req, file, cb) {
        // Enhanced file type validation for mobile
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        console.log('File upload debug:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            extname: path.extname(file.originalname).toLowerCase(),
            extnameValid: extname,
            mimetypeValid: mimetype
        });
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            const errorMsg = 'Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed';
            console.log('File rejected:', errorMsg);
            cb(new Error(errorMsg));
        }
    }
});

// All faculty routes require authentication and faculty role
router.use(isAuthenticated, checkRole('faculty'), isApproved, isActive);

// Profile Page
router.get('/profile', async (req, res) => {
    try {
        const facultyId = req.session.user._id;
        
        // Calculate faculty statistics
        const stats = await Promise.all([
            Event.countDocuments({ organizer: facultyId }),
            Event.countDocuments({ organizer: facultyId, status: 'pending' }),
            Event.countDocuments({ organizer: facultyId, status: 'approved' }),
            Event.find({ organizer: facultyId })
                .sort({ createdAt: -1 })
                .limit(10)
        ]);

        const [totalEvents, pendingEvents, approvedEvents, recentEvents] = stats;
        const totalRegistrations = await Event.aggregate([
            { $match: { organizer: facultyId } },
            { $unwind: '$registrations' },
            { $group: { _id: null, total: { $sum: 1 } } }
        ]);

        res.render('faculty/profile', { 
            title: 'My Profile',
            stats: {
                totalEvents,
                approvedEvents,
                pendingEvents,
                totalRegistrations: totalRegistrations.length > 0 ? totalRegistrations[0].total : 0
            }
        });
    } catch (error) {
        console.error('Faculty profile error:', error);
        req.session.error = 'Error loading profile';
        res.render('faculty/profile', { title: 'My Profile' });
    }
});

// Styled Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const facultyId = req.session.user._id;
        
        const stats = await Promise.all([
            Event.countDocuments({ organizer: facultyId }),
            Event.aggregate([
                { $match: { organizer: facultyId } },
                { $unwind: '$registrations' },
                { $count: 'total' }
            ]),
            Event.find({ organizer: facultyId })
                .populate('organizer', 'profile.firstName profile.lastName')
                .sort({ createdAt: -1 }) // Sort by creation date, newest first
        ]);

        const [totalEvents, registrationCount, allEvents] = stats;
        const totalRegistrations = registrationCount.length > 0 ? registrationCount[0].total : 0;

        res.render('faculty/dashboard', {
            title: 'Faculty Dashboard',
            stats: {
                totalEvents,
                totalRegistrations
            },
            allEvents
        });
    } catch (error) {
        console.error('Faculty dashboard error:', error);
        req.session.error = 'Error loading dashboard';
        res.render('faculty/dashboard', { title: 'Faculty Dashboard' });
    }
});

// Create Event Page
router.get('/events/create', (req, res) => {
    res.render('faculty/create-event', { title: 'Create Event' });
});

// Create Event Process
router.post('/events/create', upload.single('poster'), async (req, res) => {
    try {
        console.log('=== CREATE EVENT DEBUG ===');
        console.log('Request body:', req.body);
        console.log('File uploaded:', req.file);
        console.log('User session:', req.session.user);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Content-Length:', req.headers['content-length']);
        
        // Handle mobile form submission issues
        if (!req.body || Object.keys(req.body).length === 0) {
            console.log('Empty form data received');
            req.session.error = 'Form data is empty. Please try again.';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                error: 'Form data is empty. Please try again.'
            });
        }
        
        const {
            title,
            description,
            category,
            subCategory,
            eventType,
            maxParticipants,
            teamSize,
            date,
            startTime,
            endTime,
            venue
        } = req.body;

        // Enhanced file upload validation for mobile
        let posterPath = null;
        if (req.file) {
            console.log('File details:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path,
                filename: req.file.filename
            });
            
            // File size validation (5MB limit)
            if (req.file.size > 5 * 1024 * 1024) {
                req.session.error = 'File size exceeds 5MB limit';
                return res.render('faculty/create-event', { 
                    title: 'Create Event',
                    formData: req.body,
                    error: 'File size exceeds 5MB limit'
                });
            }
            
            // Verify file exists and is accessible
            const fs = require('fs');
            if (fs.existsSync(req.file.path)) {
                posterPath = '/uploads/' + req.file.filename;
                console.log('✅ File saved successfully at:', posterPath);
                console.log('✅ File size:', (req.file.size / 1024 / 1024).toFixed(2) + 'MB');
            } else {
                console.log('❌ File not found at path:', req.file.path);
                req.session.error = 'File was uploaded but could not be saved. Please try again.';
                return res.render('faculty/create-event', { 
                    title: 'Create Event',
                    formData: req.body,
                    error: 'File was uploaded but could not be saved. Please try again.'
                });
            }
        } else {
                console.log('ℹ️ No file uploaded');
            }

        // Validation
        console.log('Starting validation...');
        if (!title || !description || !category || !date || !startTime || !endTime || !venue) {
            console.log('Validation failed: Missing required fields');
            console.log('Title:', !!title, 'Description:', !!description, 'Category:', !!category, 'Date:', !!date, 'StartTime:', !!startTime, 'EndTime:', !!endTime, 'Venue:', !!venue);
            req.session.error = 'All required fields must be filled';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'All required fields must be filled'
            });
        }

        // Time validation
        if (startTime >= endTime) {
            req.session.error = 'End time must be after start time';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'End time must be after start time'
            });
        }

        // Date validation
        const eventDate = new Date(date);
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        if (eventDate < currentDate) {
            req.session.error = 'Event date cannot be in the past';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'Event date cannot be in the past'
            });
        }

        // Team size validation for team events
        if (eventType === 'team' && (!teamSize || teamSize < 2)) {
            req.session.error = 'Team size must be at least 2 for team events';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'Team size must be at least 2 for team events'
            });
        }

        // Check for time and venue clashes
        const clashCheck = await Event.findOne({
            date: new Date(date),
            $or: [
                { 
                    $and: [
                        { startTime: { $lt: endTime } },
                        { endTime: { $gt: startTime } }
                    ]
                },
                { 
                    $and: [
                        { startTime: { $lt: endTime } },
                        { endTime: { $gt: startTime } }
                    ]
                }
            ],
            venue: venue,
            status: { $in: ['approved', 'pending'] }
        });

        if (clashCheck) {
            req.session.error = 'Time or venue clash detected. Another event is scheduled at this time and venue.';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'Time or venue clash detected. Another event is scheduled at this time and venue.'
            });
        }

        console.log('Creating event object...');
        const newEvent = new Event({
            title,
            description,
            category,
            subCategory: category === 'sports' ? subCategory : undefined,
            eventType: eventType || 'individual',
            maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
            teamSize: eventType === 'team' ? parseInt(teamSize) : 1,
            date: new Date(date),
            startTime,
            endTime,
            venue,
            poster: posterPath, // Use the validated poster path
            organizer: req.session.user._id,
            status: 'approved',
            approvedBy: req.session.user._id,
            approvalDate: new Date()
        });

        console.log('Event object created:', newEvent);
        console.log('Saving event to database...');

        await newEvent.save();
        console.log('Event saved successfully!');
        console.log('Redirecting to dashboard...');
        req.session.success = 'Event created successfully and is now live!';
        res.redirect('/faculty/dashboard');
    } catch (error) {
        console.error('=== CREATE EVENT ERROR ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // For mobile compatibility, render the form with error instead of redirecting
        req.session.error = 'Error creating event: ' + error.message;
        return res.render('faculty/create-event', { 
            title: 'Create Event',
            formData: req.body,
            error: 'Error creating event: ' + error.message
        });
    }
});

// My Events
router.get('/events', async (req, res) => {
    try {
        const { category } = req.query;
        let query = { organizer: req.session.user._id };

        if (category) query.category = category;

        const events = await Event.find(query)
            .sort({ createdAt: -1 });

        res.render('faculty/my-events', { title: 'My Events', events, filters: req.query });
    } catch (error) {
        console.error('My events error:', error);
        req.session.error = 'Error loading events';
        res.redirect('/faculty/dashboard');
    }
});

// Edit Event Page
router.get('/events/:id/edit', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/my-events');
        }
        
        // Check if the faculty is the organizer
        if (event.organizer.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to edit this event';
            return res.redirect('/faculty/my-events');
        }
        
        res.render('faculty/edit-event', { 
            title: 'Edit Event', 
            event,
            formData: event
        });
    } catch (error) {
        console.error('Edit event error:', error);
        req.session.error = 'Error loading event for editing';
        res.redirect('/faculty/my-events');
    }
});

// Edit Event Process
router.post('/events/:id/edit', upload.single('poster'), async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/my-events');
        }
        
        // Check if the faculty is the organizer
        if (event.organizer.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to edit this event';
            return res.redirect('/faculty/my-events');
        }
        
        const {
            title,
            description,
            category,
            subCategory,
            eventType,
            maxParticipants,
            teamSize,
            date,
            startTime,
            endTime,
            venue
        } = req.body;

        // Validation
        if (!title || !description || !category || !date || !startTime || !endTime || !venue) {
            req.session.error = 'All required fields must be filled';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'All required fields must be filled'
            });
        }

        // Time validation
        if (startTime >= endTime) {
            req.session.error = 'End time must be after start time';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'End time must be after start time'
            });
        }

        // Date validation
        const eventDate = new Date(date);
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        
        if (eventDate < currentDate) {
            req.session.error = 'Event date cannot be in the past';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'Event date cannot be in the past'
            });
        }

        // Team size validation for team events
        if (eventType === 'team' && (!teamSize || teamSize < 2)) {
            req.session.error = 'Team size must be at least 2 for team events';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'Team size must be at least 2 for team events'
            });
        }

        // Check for time and venue clashes (excluding current event)
        const clashCheck = await Event.findOne({
            _id: { $ne: eventId },
            date: new Date(date),
            $or: [
                { 
                    $and: [
                        { startTime: { $lt: endTime } },
                        { endTime: { $gt: startTime } }
                    ]
                },
                { 
                    $and: [
                        { startTime: { $lt: endTime } },
                        { endTime: { $gt: startTime } }
                    ]
                }
            ],
            venue: venue,
            status: { $in: ['approved', 'pending'] }
        });

        if (clashCheck) {
            req.session.error = 'Time or venue clash detected. Another event is scheduled at this time and venue.';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'Time or venue clash detected. Another event is scheduled at this time and venue.'
            });
        }

        // Update event
        event.title = title;
        event.description = description;
        event.category = category;
        event.subCategory = category === 'sports' ? subCategory : undefined;
        event.eventType = eventType || 'individual';
        event.maxParticipants = maxParticipants ? parseInt(maxParticipants) : null;
        event.teamSize = eventType === 'team' ? parseInt(teamSize) : 1;
        event.date = new Date(date);
        event.startTime = startTime;
        event.endTime = endTime;
        event.venue = venue;
        
        // Update poster if new one is uploaded
        if (req.file) {
            event.poster = '/uploads/' + req.file.filename;
        }

        await event.save();
        req.session.success = 'Event updated successfully!';
        res.redirect('/faculty/my-events');
        
    } catch (error) {
        console.error('Update event error:', error);
        req.session.error = 'Error updating event: ' + error.message;
        res.redirect('/faculty/my-events');
    }
});

// Delete Event
router.delete('/events/:id/delete', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            return res.json({ success: false, message: 'Event not found' });
        }
        
        // Check if the faculty is the organizer
        if (event.organizer.toString() !== req.session.user._id.toString()) {
            return res.json({ success: false, message: 'You are not authorized to delete this event' });
        }
        
        // Only allow deleting pending events
        if (event.status !== 'pending') {
            return res.json({ success: false, message: 'Only pending events can be deleted' });
        }
        
        await Event.findByIdAndDelete(eventId);
        res.json({ success: true, message: 'Event deleted successfully' });
        
    } catch (error) {
        console.error('Delete event error:', error);
        res.json({ success: false, message: 'Error deleting event: ' + error.message });
    }
});

// View Event Details
router.get('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId)
            .populate('organizer', 'profile.firstName profile.lastName profile.email')
            .populate({
                path: 'registrations.student',
                select: 'profile.firstName profile.lastName profile.collegeId email'
            });
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/my-events');
        }
        
        // Check if the faculty is the organizer
        if (event.organizer._id.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to view this event';
            return res.redirect('/faculty/my-events');
        }
        
        res.render('faculty/view-event', { 
            title: 'Event Details', 
            event
        });
    } catch (error) {
        console.error('View event error:', error);
        req.session.error = 'Error loading event details';
        res.redirect('/faculty/my-events');
    }
});

// Faculty Profile
router.get('/profile', async (req, res) => {
    try {
        const facultyId = req.session.user._id;
        
        // Get faculty details and statistics
        const faculty = await User.findById(facultyId)
            .populate('createdEvents')
            .populate('registeredEvents');
        
        if (!faculty) {
            req.session.error = 'Faculty not found';
            return res.redirect('/faculty/dashboard');
        }
        
        // Calculate statistics
        const totalEvents = faculty.createdEvents ? faculty.createdEvents.length : 0;
        const approvedEvents = faculty.createdEvents ? faculty.createdEvents.filter(e => e.status === 'approved').length : 0;
        const pendingEvents = faculty.createdEvents ? faculty.createdEvents.filter(e => e.status === 'pending').length : 0;
        const totalRegistrations = faculty.createdEvents ? 
            faculty.createdEvents.reduce((sum, event) => sum + (event.registrations ? event.registrations.length : 0), 0) : 0;
        
        res.render('faculty/profile', {
            title: 'Faculty Profile',
            faculty,
            stats: {
                totalEvents,
                approvedEvents,
                pendingEvents,
                totalRegistrations
            }
        });
    } catch (error) {
        console.error('Faculty profile error:', error);
        req.session.error = 'Error loading profile';
        res.redirect('/faculty/dashboard');
    }
});

// View Registered Students for Event
router.get('/events/:id/students', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findById(eventId)
            .populate({
                path: 'registrations.student',
                select: 'profile.firstName profile.lastName profile.collegeId email'
            })
            .populate('organizer', 'profile.firstName profile.lastName');
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/events');
        }
        
        // Check if faculty is organizer
        if (event.organizer._id.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to view students for this event';
            return res.redirect('/faculty/events');
        }
        
        const stats = {
            total: event.registrations.length,
            pending: event.registrations.filter(reg => reg.status === 'pending').length,
            approved: event.registrations.filter(reg => reg.status === 'approved').length,
            rejected: event.registrations.filter(reg => reg.status === 'rejected').length
        };
        
        res.render('faculty/event-students', {
            title: 'Registered Students - ' + event.title,
            event,
            registrations: event.registrations,
            stats
        });
    } catch (error) {
        console.error('View event students error:', error);
        req.session.error = 'Error loading registered students';
        res.redirect('/faculty/events');
    }
});

// Registration Management
router.post('/events/:eventId/registrations/:registrationId/approve', async (req, res) => {
    try {
        const { eventId, registrationId } = req.params;
        
        const event = await Event.findById(eventId);
        if (!event || event.organizer.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        await Event.findOneAndUpdate(
            { _id: eventId, 'registrations._id': registrationId },
            { 
                $set: { 
                    'registrations.$.status': 'approved',
                    'registrations.$.approvedBy': req.session.user._id,
                    'registrations.$.approvalDate': new Date()
                }
            }
        );
        
        res.json({ success: true, message: 'Registration approved successfully' });
    } catch (error) {
        console.error('Approve registration error:', error);
        res.status(500).json({ success: false, message: 'Error approving registration' });
    }
});

router.post('/events/:eventId/registrations/:registrationId/reject', async (req, res) => {
    try {
        const { eventId, registrationId } = req.params;
        const { reason } = req.body;
        
        const event = await Event.findById(eventId);
        if (!event || event.organizer.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        await Event.findOneAndUpdate(
            { _id: eventId, 'registrations._id': registrationId },
            { 
                $set: { 
                    'registrations.$.status': 'rejected',
                    'registrations.$.rejectedBy': req.session.user._id,
                    'registrations.$.rejectedDate': new Date(),
                    'registrations.$.rejectionReason': reason
                }
            }
        );
        
        res.json({ success: true, message: 'Registration rejected successfully' });
    } catch (error) {
        console.error('Reject registration error:', error);
        res.status(500).json({ success: false, message: 'Error rejecting registration' });
    }
});

// Delete Registration
router.delete('/events/:eventId/registrations/:registrationId/delete', async (req, res) => {
    try {
        const { eventId, registrationId } = req.params;
        
        const event = await Event.findById(eventId);
        if (!event || event.organizer.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        // Find and remove registration
        await Event.findOneAndUpdate(
            { _id: eventId, 'registrations._id': registrationId },
            { $pull: { registrations: { _id: registrationId } } }
        );
        
        res.json({ success: true, message: 'Registration deleted successfully' });
    } catch (error) {
        console.error('Delete registration error:', error);
        res.status(500).json({ success: false, message: 'Error deleting registration' });
    }
});

// View Student Details
router.get('/student/:studentId', async (req, res) => {
    try {
        const student = await User.findById(req.params.studentId)
            .select('profile.firstName profile.lastName profile.collegeId email profile.phone profile.department');
        
        if (!student) {
            req.session.error = 'Student not found';
            return res.redirect('/faculty/events');
        }
        
        res.render('faculty/student-details', {
            title: 'Student Details',
            student
        });
    } catch (error) {
        console.error('View student error:', error);
        req.session.error = 'Error loading student details';
        res.redirect('/faculty/events');
    }
});

module.exports = router;
