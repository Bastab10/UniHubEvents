const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');

// All student routes require authentication and student role
router.use(isAuthenticated, checkRole('student'), isApproved, isActive);

// Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.session.user._id;
        
        // Get all approved events for display
        const allEvents = await Event.find({ status: 'approved' })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: 1 });
        
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

// Browse Events
router.get('/events', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = { status: 'approved', date: { $gte: new Date() } };

        if (category) query.category = category;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { venue: { $regex: search, $options: 'i' } }
            ];
        }

        const events = await Event.find(query)
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: 1 });

        res.render('student/browse-events', { 
            title: 'Browse Events', 
            events, 
            filters: req.query,
            studentId: req.session.user._id
        });
    } catch (error) {
        console.error('Browse events error:', error);
        req.session.error = 'Error loading events';
        res.redirect('/student/dashboard');
    }
});

// Event Details
router.get('/events/:id', async (req, res) => {
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
            isRegistered 
        });
    } catch (error) {
        console.error('Event details error:', error);
        req.session.error = 'Error loading event details';
        res.redirect('/student/events');
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

        // Check for time clash
        const timeClash = await Event.findOne({
            _id: { $ne: req.params.id },
            'registrations.student': req.session.user._id,
            'registrations.status': 'approved',
            date: event.date,
            $or: [
                { 
                    $and: [
                        { startTime: { $lte: event.startTime } },
                        { endTime: { $gte: event.startTime } }
                    ]
                },
                { 
                    $and: [
                        { startTime: { $lte: event.endTime } },
                        { endTime: { $gte: event.endTime } }
                    ]
                }
            ]
        });

        if (timeClash) {
            req.session.error = `Time clash detected. You are already registered for "${timeClash.title}" at the same time.`;
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
            const { teamName, teamMembers } = req.body;
            
            if (!teamName || teamName.trim() === '') {
                req.session.error = 'Team name is required for team events';
                return res.redirect(`/student/events/${req.params.id}`);
            }

            registrationData.teamName = teamName.trim();

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

        req.session.success = 'Registration successful! You are now registered for this event.';
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
        const { status } = req.query;
        let matchQuery = { 'registrations.student': req.session.user._id };

        if (status) {
            matchQuery['registrations.status'] = status;
        }

        const events = await Event.find(matchQuery)
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: 1 });

        // Filter registrations based on status
        const filteredEvents = events.map(event => {
            const userRegistrations = event.registrations.filter(
                reg => reg.student.toString() === req.session.user._id.toString()
            );
            
            return {
                ...event.toObject(),
                registrations: userRegistrations
            };
        });

        res.render('student/my-registrations', { 
            title: 'My Registrations', 
            events: filteredEvents,
            filters: req.query
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

        // Only allow cancellation if registration is pending or event is more than 24 hours away
        const registration = event.registrations[registrationIndex];
        const eventDateTime = new Date(`${event.date.toISOString().split('T')[0]}T${event.startTime}`);
        const now = new Date();
        const hoursUntilEvent = (eventDateTime - now) / (1000 * 60 * 60);

        if (registration.status === 'approved' && hoursUntilEvent < 24) {
            req.session.error = 'Cannot cancel registration less than 24 hours before the event';
            return res.redirect('/student/registrations');
        }

        event.registrations.splice(registrationIndex, 1);
        await event.save();

        // Remove event from user's registered events
        await User.findByIdAndUpdate(req.session.user._id, {
            $pull: { registeredEvents: req.params.eventId }
        });

        req.session.success = 'Registration cancelled successfully';
        res.redirect('/student/registrations');
    } catch (error) {
        console.error('Cancel registration error:', error);
        req.session.error = 'Error cancelling registration';
        res.redirect('/student/registrations');
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
