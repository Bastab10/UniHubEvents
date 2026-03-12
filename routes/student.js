const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');

// Special middleware for event details - no flash message
const isAuthenticatedForEventDetails = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    // Redirect without setting flash message
    res.redirect('/auth/login');
};

// Special checkRole middleware for event details - no flash message
const checkRoleForEventDetails = (...roles) => {
    return (req, res, next) => {
        if (!req.session.user) {
            // Redirect without setting flash message
            return res.redirect('/auth/login');
        }
        
        if (!roles.includes(req.session.user.role)) {
            req.session.error = 'Access denied. You do not have permission to access this page.';
            return res.redirect('/auth/login');
        }
        
        next();
    };
};

// Special isApproved middleware for event details - no flash message
const isApprovedForEventDetails = async (req, res, next) => {
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

// Special isActive middleware for event details - no flash message
const isActiveForEventDetails = async (req, res, next) => {
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

// Event Details - Apply special middleware without flash message
router.get('/events/:id', isAuthenticatedForEventDetails, checkRoleForEventDetails('student'), isApprovedForEventDetails, isActiveForEventDetails, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName email')
            .populate('registrations.student', 'profile.firstName profile.lastName profile.collegeId');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/events');
        }

        if (event.status !== 'approved') {
            req.session.error = 'Event not available for registration';
            return res.redirect('/student/events');
        }

        // Check if student is already registered
        const isRegistered = event.registrations.some(
            reg => reg.student._id.toString() === req.session.user._id.toString()
        );

        res.render('student/event-details', { 
            title: event.title, 
            event, 
            isRegistered,
            currentUser: req.session.user
        });
    } catch (error) {
        console.error('Event details error:', error);
        req.session.error = 'Error loading event details';
        res.redirect('/student/events');
    }
});

// All other student routes require authentication and student role
router.use(isAuthenticated, checkRole('student'), isApproved, isActive);

// Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.session.user._id;
        
        // Get all approved events for display
        const allEvents = await Event.find({ status: 'approved' })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ createdAt: -1 }); // Sort by creation date, newest first
        
        // Get user's registered events for status tracking
        const registeredEvents = await Event.find({
            'registrations.student': studentId,
            'registrations.status': 'approved'
        }).populate('organizer', 'profile.firstName profile.lastName');
        
        // Filter upcoming events (user is registered for)
        const upcomingRegistered = registeredEvents.filter(event => 
            new Date(event.date) >= new Date()
        );
        
        // Calculate stats
        const stats = await Promise.all([
            Event.countDocuments({ status: 'approved' }),
            Event.countDocuments({ 
                'registrations.student': studentId,
                'registrations.status': 'approved' 
            }),
            Event.countDocuments({ 
                'registrations.student': studentId,
                'registrations.status': 'pending' 
            })
        ]);

        const [availableEvents, registeredEventsCount, pendingEvents] = stats;

        res.render('student/dashboard', {
            title: 'Student Dashboard',
            stats: {
                availableEvents,
                registeredEvents: registeredEventsCount,
                pendingEvents
            },
            allEvents, // Pass all events to template
            upcomingRegistered
        });
    } catch (error) {
        console.error('Student dashboard error:', error);
        req.session.error = 'Error loading dashboard';
        res.render('student/dashboard', { title: 'Student Dashboard' });
    }
});

// Register for Event
router.post('/events/:id/register', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/events');
        }

        if (event.status !== 'approved') {
            req.session.error = 'Event not available for registration';
            return res.redirect('/student/events');
        }

        // Check if already registered
        const isAlreadyRegistered = event.registrations.some(
            reg => reg.student.toString() === req.session.user._id.toString()
        );

        if (isAlreadyRegistered) {
            req.session.error = 'You are already registered for this event';
            return res.redirect(`/student/events/${req.params.id}`);
        }

        // Check if event is full
        if (event.maxParticipants && event.registrations.length >= event.maxParticipants) {
            req.session.error = 'Event is full';
            return res.redirect(`/student/events/${req.params.id}`);
        }

        // Check for exact date and start time conflict
        const exactConflict = await Event.findOne({
            _id: { $ne: req.params.id },
            'registrations.student': req.session.user._id,
            'registrations.status': 'approved',
            date: event.date,
            startTime: event.startTime
        });

        if (exactConflict) {
            req.session.error = 'You have already registered for another event at the same date and time. Please cancel your existing registration before registering for this event.';
            return res.redirect(`/student/events/${req.params.id}`);
        }

        // Handle team registration
        let registrationData = {
            student: req.session.user._id,
            status: 'approved',
            registeredAt: new Date(),
            approvalDate: new Date()
        };

        if (event.eventType === 'team') {
            const { teamName, teamLeaderName, teamLeaderCollegeId, teamMembers } = req.body;
            
            if (!teamName || teamName.trim() === '') {
                req.session.error = 'Team name is required for team events';
                return res.redirect(`/student/events/${req.params.id}`);
            }

            if (!teamLeaderName || teamLeaderName.trim() === '') {
                req.session.error = 'Team leader name is required for team events';
                return res.redirect(`/student/events/${req.params.id}`);
            }

            if (!teamLeaderCollegeId || teamLeaderCollegeId.trim() === '') {
                req.session.error = 'Team leader college ID is required for team events';
                return res.redirect(`/student/events/${req.params.id}`);
            }

            registrationData.teamName = teamName.trim();
            registrationData.teamLeaderName = teamLeaderName.trim();
            registrationData.teamLeaderCollegeId = teamLeaderCollegeId.trim();

            if (teamMembers && Array.isArray(teamMembers)) {
                registrationData.teamMembers = teamMembers
                    .filter(member => member && member.name && member.collegeId)
                    .map(member => ({
                        name: member.name.trim(),
                        collegeId: member.collegeId.trim()
                    }));
            }
        }

        // Add registration
        event.registrations.push(registrationData);
        await event.save();

        req.session.success = 'Registration successful!';
        res.redirect(`/student/events/${req.params.id}`);
    } catch (error) {
        console.error('Event registration error:', error);
        req.session.error = 'Error registering for event';
        res.redirect('/student/events');
    }
});

// My Registrations
router.get('/registrations', async (req, res) => {
    try {
        const studentId = req.session.user._id;

        const events = await Event.find({ 'registrations.student': studentId })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: 1 });

        // Filter registrations to show only the current student's registrations
        const filteredEvents = events.map(event => {
            const userRegistrations = event.registrations.filter(
                reg => reg.student.toString() === studentId.toString()
            );
            
            return {
                ...event.toObject(),
                registrations: userRegistrations
            };
        });

        res.render('student/my-registrations', { 
            title: 'My Registrations', 
            events: filteredEvents
        });
    } catch (error) {
        console.error('My registrations error:', error);
        req.session.error = 'Error loading registrations';
        res.redirect('/student/dashboard');
    }
});

// Cancel Registration
router.post('/registrations/:eventId/cancel', async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/registrations');
        }

        // Find and remove student's registration
        const registrationIndex = event.registrations.findIndex(
            reg => reg.student.toString() === req.session.user._id.toString()
        );

        if (registrationIndex === -1) {
            req.session.error = 'Registration not found';
            return res.redirect('/student/registrations');
        }

        event.registrations.splice(registrationIndex, 1);
        await event.save();

        req.session.success = 'Registration cancelled successfully.';
        res.redirect(`/student/events/${req.params.eventId}`);
    } catch (error) {
        console.error('Cancel registration error:', error);
        req.session.error = 'Error cancelling registration';
        res.redirect(`/student/events/${req.params.eventId}`);
    }
});

// Participation History
router.get('/history', async (req, res) => {
    try {
        const events = await Event.find({
            'registrations.student': req.session.user._id,
            'registrations.status': 'approved',
            date: { $lt: new Date() }
        })
        .populate('organizer', 'profile.firstName profile.lastName')
        .sort({ date: -1 });

        const pastEvents = events.map(event => {
            const userRegistrations = event.registrations.filter(
                reg => reg.student.toString() === req.session.user._id.toString()
            );
            
            return {
                ...event.toObject(),
                registrations: userRegistrations
            };
        });

        res.render('student/participation-history', { 
            title: 'Participation History', 
            events: pastEvents 
        });
    } catch (error) {
        console.error('Participation history error:', error);
        req.session.error = 'Error loading participation history';
        res.redirect('/student/dashboard');
    }
});

// Profile
router.get('/profile', (req, res) => {
    res.render('student/profile', { title: 'My Profile' });
});

// Update Profile
router.post('/profile', async (req, res) => {
    try {
        const { firstName, lastName, phone } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            'profile.firstName': firstName,
            'profile.lastName': lastName,
            'profile.phone': phone
        });

        // Update session user data
        req.session.user.profile.firstName = firstName;
        req.session.user.profile.lastName = lastName;
        req.session.user.profile.phone = phone;

        req.session.success = 'Profile updated successfully';
        res.redirect('/student/profile');
    } catch (error) {
        console.error('Update profile error:', error);
        req.session.error = 'Error updating profile';
        res.redirect('/student/profile');
    }
});

module.exports = router;
