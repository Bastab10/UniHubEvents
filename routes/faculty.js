const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
const DepartmentPoints = require('../models/DepartmentPoints');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');
const { upload, uploadImage, deleteImage } = require('../config/cloudinary');

router.use(isAuthenticated, checkRole('faculty'), isApproved, isActive);

router.get('/profile', async (req, res) => {
    try {
        const facultyId = req.session.user._id;
        
        const stats = await Promise.all([
            Event.countDocuments({ organizer: facultyId }),
            Event.find({ organizer: facultyId })
                .sort({ createdAt: -1 })
                .limit(10)
        ]);

        const [totalEvents, recentEvents] = stats;
        const totalRegistrations = await Event.aggregate([
            { $match: { organizer: facultyId } },
            { $unwind: '$registrations' },
            { $group: { _id: null, total: { $sum: 1 } } }
        ]);

        res.render('faculty/profile', { 
            title: 'My Profile',
            stats: {
                totalEvents,
                totalRegistrations: totalRegistrations.length > 0 ? totalRegistrations[0].total : 0
            }
        });
    } catch (error) {
        console.error('Faculty profile error:', error);
        req.session.error = 'Error loading profile';
        res.render('faculty/profile', { title: 'My Profile' });
    }
});

router.get('/dashboard', async (req, res) => {
    try {
        const facultyId = req.session.user._id;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stats = await Promise.all([
            Event.countDocuments({ organizer: facultyId }),
            Event.aggregate([
                { $match: { organizer: facultyId } },
                { $unwind: '$registrations' },
                { $count: 'total' }
            ]),
            Event.find({
                organizer: facultyId,
                date: { $gte: today }
            })
                .populate('organizer', 'profile.firstName profile.lastName')
                .sort({ date: 1 })
        ]);

        const [totalEvents, registrationCount, allEvents] = stats;
        const totalRegistrations = registrationCount.length > 0 ? registrationCount[0].total : 0;

        res.render('faculty/dashboard', {
            title: 'Faculty Dashboard',
            stats: {
                totalEvents,
                totalRegistrations
            },
            allEvents,
            user: req.session.user
        });
    } catch (error) {
        console.error('Faculty dashboard error:', error);
        req.session.error = 'Error loading dashboard';
        res.render('faculty/dashboard', { title: 'Faculty Dashboard' });
    }
});

router.get('/past-events', async (req, res) => {
    try {
        const facultyId = req.session.user._id;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastEvents = await Event.find({
            organizer: facultyId,
            date: { $lt: today }
        })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: -1 });

        res.render('faculty/past-events', {
            title: 'Past Events',
            pastEvents
        });
    } catch (error) {
        console.error('Past events error:', error);
        req.session.error = 'Error loading past events';
        res.render('faculty/past-events', { title: 'Past Events', pastEvents: [] });
    }
});

router.get('/events/create', (req, res) => {
    res.render('faculty/create-event', { title: 'Create Event' });
});

router.post('/events/create', upload.single('poster'), async (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
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
            eventMode,
            subCategory,
            eventType,
            maxParticipants,
            teamSize,
            maxTeamsPerDepartment,
            eventFormat,
            date,
            startTime,
            endTime,
            venue
        } = req.body;

        let posterUrl = null;
        if (req.file) {
            posterUrl = await uploadImage(req.file);
        }

        if (!title || !description || !category || !eventMode || !date || !startTime || !endTime || !venue) {
            req.session.error = 'All required fields must be filled';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'All required fields must be filled'
            });
        }

        if (startTime >= endTime) {
            req.session.error = 'End time must be after start time';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'End time must be after start time'
            });
        }


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


        if (eventType === 'team' && (!teamSize || teamSize < 2)) {
            req.session.error = 'Team size must be at least 2 for team events';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'Team size must be at least 2 for team events'
            });
        }

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
            venue: venue
        });

        if (clashCheck) {
            req.session.error = 'Time or venue clash detected. Another event is scheduled at this time and venue.';
            return res.render('faculty/create-event', { 
                title: 'Create Event',
                formData: req.body,
                error: 'Time or venue clash detected. Another event is scheduled at this time and venue.'
            });
        }
        const newEvent = new Event({
            title,
            description,
            category,
            eventMode,
            subCategory: category === 'sports' ? subCategory : undefined,
            eventType: eventType || 'individual',
            maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
            teamSize: eventType === 'team' ? parseInt(teamSize) : 1,
            maxTeamsPerDepartment: eventType === 'team' && maxTeamsPerDepartment ? parseInt(maxTeamsPerDepartment) : null,
            eventFormat: eventType === 'team' ? eventFormat : undefined,
            date: new Date(date),
            startTime,
            endTime,
            venue,
            poster: posterUrl,
            organizer: req.session.user._id
        });

        try {
            await newEvent.save();
            res.redirect('/faculty/dashboard');
        } catch (saveError) {
            console.error('Error saving event:', saveError);
            if (req.file && posterUrl) {
                await deleteImage(posterUrl);
            }
            
            throw saveError;
        }
    } catch (error) {
        console.error('Error creating event:', error);
        req.session.error = 'Error creating event: ' + error.message;
        return res.render('faculty/create-event', { 
            title: 'Create Event',
            formData: req.body,
            error: 'Error creating event: ' + error.message
        });
    }
});


router.get('/events/:id/edit', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/dashboard');
        }
        
        if (event.organizer.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to edit this event';
            return res.redirect('/faculty/dashboard');
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

router.post('/events/:id/edit', upload.single('poster'), async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/dashboard');
        }
        
        if (event.organizer.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to edit this event';
            return res.redirect('/faculty/dashboard');
        }
        
        const {
            title,
            description,
            category,
            eventMode,
            subCategory,
            eventType,
            maxParticipants,
            teamSize,
            maxTeamsPerDepartment,
            eventFormat,
            date,
            startTime,
            endTime,
            venue
        } = req.body;

        if (!title || !description || !category || !eventMode || !date || !startTime || !endTime || !venue) {
            req.session.error = 'All required fields must be filled';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'All required fields must be filled'
            });
        }

        if (startTime >= endTime) {
            req.session.error = 'End time must be after start time';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'End time must be after start time'
            });
        }

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

        if (eventType === 'team' && (!teamSize || teamSize < 2)) {
            req.session.error = 'Team size must be at least 2 for team events';
            return res.render('faculty/edit-event', { 
                title: 'Edit Event',
                event,
                formData: req.body,
                error: 'Team size must be at least 2 for team events'
            });
        }

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
            venue: venue
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

        event.title = title;
        event.description = description;
        event.category = category;
        event.eventMode = eventMode;
        event.subCategory = category === 'sports' ? subCategory : undefined;
        event.eventType = eventType || 'individual';
        event.maxParticipants = maxParticipants ? parseInt(maxParticipants) : null;
        event.teamSize = eventType === 'team' ? parseInt(teamSize) : 1;
        event.maxTeamsPerDepartment = eventType === 'team' && maxTeamsPerDepartment ? parseInt(maxTeamsPerDepartment) : null;
        event.date = new Date(date);
        event.startTime = startTime;
        event.endTime = endTime;
        event.venue = venue;
        
        if (req.file) {
            if (event.poster && event.poster.trim() !== '') {
                await deleteImage(event.poster);
            }
            const newPosterUrl = await uploadImage(req.file);
            event.poster = newPosterUrl;
        }

        await event.save();
        res.redirect('/faculty/my-events');
        
    } catch (error) {
        console.error('Update event error:', error);
        req.session.error = 'Error updating event: ' + error.message;
        res.redirect('/faculty/my-events');
    }
});

router.delete('/events/:id/delete', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId);
        
        if (!event) {
            return res.json({ success: false, message: 'Event not found' });
        }
        
        if (event.organizer.toString() !== req.session.user._id.toString()) {
            return res.json({ success: false, message: 'You are not authorized to delete this event' });
        }
        
        if (event.poster && event.poster.trim() !== '') {
            await deleteImage(event.poster);
        }
        
        await Event.findByIdAndDelete(eventId);
        res.json({ success: true, message: 'Event deleted successfully' });
        
    } catch (error) {
        console.error('Delete event error:', error);
        res.json({ success: false, message: 'Error deleting event: ' + error.message });
    }
});

router.get('/events/:id', async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId)
            .populate('organizer', 'profile.firstName profile.lastName profile.email')
            .populate({
                path: 'registrations.student',
                select: 'profile.firstName profile.lastName profile.collegeId profile.department email'
            });
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/dashboard');
        }
        
        if (event.organizer._id.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to view this event';
            return res.redirect('/faculty/dashboard');
        }
        
        let departmentGroups = null;
        if (event.eventType === 'team' && event.registrations) {
            const groups = {};
            event.registrations.forEach(reg => {
                const dept = reg.teamLeaderDepartment || 'Unknown';
                if (!groups[dept]) {
                    groups[dept] = {
                        department: dept,
                        teams: [],
                        totalMembers: 0,
                        teamCount: 0
                    };
                }
                groups[dept].teams.push(reg);
                groups[dept].teamCount++;
                groups[dept].totalMembers += (reg.teamMembers?.length || 0) + 1;
            });
            departmentGroups = Object.values(groups);
        }
        
        res.render('faculty/view-event', { 
            title: 'Event Details', 
            event,
            departmentGroups
        });
    } catch (error) {
        console.error('View event error:', error);
        req.session.error = 'Error loading event details';
        res.redirect('/faculty/dashboard');
    }
});

router.post('/profile', async (req, res) => {
    try {
        const { fullName, phone } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            'profile.fullName': fullName,
            'profile.phone': phone
        });

        req.session.user.profile.fullName = fullName;
        req.session.user.profile.phone = phone;

        req.session.success = 'Profile updated successfully';
        res.redirect('/faculty/profile');
    } catch (error) {
        console.error('Update faculty profile error:', error);
        req.session.error = 'Error updating profile';
        res.redirect('/faculty/profile');
    }
});

router.get('/events/:id/students', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findById(eventId)
            .populate({
                path: 'registrations.student',
                select: 'profile.fullName profile.collegeId profile.department email'
            })
            .populate('organizer', 'profile.fullName');
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/events');
        }
        
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

router.delete('/events/:eventId/registrations/:registrationId/delete', async (req, res) => {
    try {
        const { eventId, registrationId } = req.params;
        
        const event = await Event.findById(eventId);
        if (!event || event.organizer.toString() !== req.session.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
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

router.get('/student/:studentId', async (req, res) => {
    try {
        const student = await User.findById(req.params.studentId)
            .select('profile.firstName profile.lastName profile.fullName profile.collegeId email profile.phone profile.department');
        
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

router.get('/events/:eventId/department/:departmentName', async (req, res) => {
    try {
        const { eventId, departmentName } = req.params;
        
        const event = await Event.findById(eventId)
            .populate('organizer', 'profile.firstName profile.lastName profile.email');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/faculty/dashboard');
        }

        if (event.organizer._id.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to view this event';
            return res.redirect('/faculty/dashboard');
        }

        const departmentTeams = event.registrations.filter(
            reg => reg.teamLeaderDepartment && 
                   reg.teamLeaderDepartment.toLowerCase() === decodeURIComponent(departmentName).toLowerCase()
        );

        if (departmentTeams.length === 0) {
            req.session.error = 'No teams found for this department';
            return res.redirect(`/faculty/events/${eventId}`);
        }

        res.render('faculty/department-teams', {
            title: `${decodeURIComponent(departmentName)} - Team Details`,
            event,
            department: decodeURIComponent(departmentName),
            teams: departmentTeams
        });
    } catch (error) {
        console.error('Department teams view error:', error);
        req.session.error = 'Error loading department teams';
        res.redirect('/faculty/dashboard');
    }
});

router.delete('/events/:eventId/department/:departmentName/delete', async (req, res) => {
    try {
        const { eventId, departmentName } = req.params;

        const event = await Event.findById(eventId);

        if (!event) {
            return res.json({ success: false, message: 'Event not found' });
        }

        if (event.organizer.toString() !== req.session.user._id.toString()) {
            return res.json({ success: false, message: 'You are not authorized to delete teams from this event' });
        }

        const decodedDeptName = decodeURIComponent(departmentName).toLowerCase();
        const originalCount = event.registrations.length;
        
        event.registrations = event.registrations.filter(
            reg => !reg.teamLeaderDepartment || 
                   reg.teamLeaderDepartment.toLowerCase() !== decodedDeptName
        );

        const deletedCount = originalCount - event.registrations.length;

        if (deletedCount === 0) {
            return res.json({ success: false, message: 'No teams found for this department' });
        }

        await event.save();

        res.json({ success: true, message: `${deletedCount} team(s) deleted successfully` });
    } catch (error) {
        console.error('Delete department teams error:', error);
        res.json({ success: false, message: 'Error deleting department teams' });
    }
});

router.get('/upload-result', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const events = await Event.find({
            organizer: req.session.user._id,
            date: { $lt: today }
        }).sort({ date: -1 });

        const existingResults = await Result.find({
            event: { $in: events.map(e => e._id) }
        }).select('event');
        
        const resultEventIds = new Set(existingResults.map(r => r.event.toString()));
        
        const eventsWithResultFlag = events.map(event => ({
            ...event.toObject(),
            hasResult: resultEventIds.has(event._id.toString())
        }));

        res.render('faculty/upload-result', {
            title: 'Upload Result',
            events: eventsWithResultFlag,
            success: req.session.success,
            error: req.session.error
        });
        
        delete req.session.success;
        delete req.session.error;
    } catch (error) {
        console.error('Upload result page error:', error);
        res.render('faculty/upload-result', {
            title: 'Upload Result',
            events: [],
            error: 'Error loading events'
        });
    }
});

router.post('/upload-result', async (req, res) => {
    try {
        const { eventId, firstPosition, secondPosition, thirdPosition } = req.body;

        const event = await Event.findOne({
            _id: eventId,
            organizer: req.session.user._id
        });

        if (!event) {
            req.session.error = 'Event not found or you are not authorized';
            return res.redirect('/faculty/upload-result');
        }

        const existingResult = await Result.findOne({ event: eventId });

        if (existingResult) {
            req.session.error = 'Result has already been uploaded for this event';
            return res.redirect('/faculty/upload-result');
        }

        // Parse points only if user entered them (optional)
        const firstPoints = firstPosition.points ? parseInt(firstPosition.points) : undefined;
        const secondPoints = secondPosition.points ? parseInt(secondPosition.points) : undefined;
        const thirdPoints = thirdPosition.points ? parseInt(thirdPosition.points) : undefined;

        // Validate points are non-negative if provided
        if ((firstPoints !== undefined && firstPoints < 0) ||
            (secondPoints !== undefined && secondPoints < 0) ||
            (thirdPoints !== undefined && thirdPoints < 0)) {
            req.session.error = 'Points cannot be negative values';
            return res.redirect('/faculty/upload-result');
        }

        const result = new Result({
            event: eventId,
            coordinator: req.session.user._id,
            firstPosition: {
                name: firstPosition.name,
                department: firstPosition.department || '',
                collegeId: firstPosition.collegeId || '',
                points: firstPoints
            },
            secondPosition: {
                name: secondPosition.name,
                department: secondPosition.department || '',
                collegeId: secondPosition.collegeId || '',
                points: secondPoints
            },
            thirdPosition: {
                name: thirdPosition.name,
                department: thirdPosition.department || '',
                collegeId: thirdPosition.collegeId || '',
                points: thirdPoints
            }
        });

        await result.save();

        // Update department points for Versity Week events
        if (event.eventMode === 'versity') {
            const pointValues = {
                first: 10,
                second: 7,
                third: 5
            };

            const positions = [
                { dept: firstPosition.department, pos: 'first', points: pointValues.first },
                { dept: secondPosition.department, pos: 'second', points: pointValues.second },
                { dept: thirdPosition.department, pos: 'third', points: pointValues.third }
            ];

            for (const position of positions) {
                if (position.dept) {
                    await DepartmentPoints.findOneAndUpdate(
                        { department: position.dept },
                        {
                            $inc: { totalPoints: position.points },
                            $push: {
                                eventBreakdown: {
                                    event: eventId,
                                    eventTitle: event.title,
                                    points: position.points,
                                    position: position.pos,
                                    date: new Date()
                                }
                            },
                            $set: { lastUpdated: new Date() }
                        },
                        { upsert: true, new: true }
                    );
                }
            }
        }

        req.session.success = 'Result uploaded successfully!';
        res.redirect('/faculty/upload-result');
    } catch (error) {
        console.error('Upload result error:', error);
        req.session.error = 'Error uploading result. Please try again.';
        res.redirect('/faculty/upload-result');
    }
});

// Edit Result - GET route
router.get('/results/:resultId/edit', async (req, res) => {
    try {
        const { resultId } = req.params;

        const result = await Result.findById(resultId)
            .populate('event', 'title date eventMode');

        if (!result) {
            req.session.error = 'Result not found';
            return res.redirect('/faculty/dashboard');
        }

        // Check authorization
        if (result.coordinator.toString() !== req.session.user._id.toString()) {
            req.session.error = 'You are not authorized to edit this result';
            return res.redirect('/faculty/dashboard');
        }

        res.render('faculty/edit-result', {
            title: 'Edit Result',
            result,
            error: req.session.error,
            success: req.session.success
        });

        delete req.session.error;
        delete req.session.success;
    } catch (error) {
        console.error('Edit result page error:', error);
        req.session.error = 'Error loading result';
        res.redirect('/faculty/dashboard');
    }
});

// Edit Result - POST route
router.post('/results/:resultId/edit', async (req, res) => {
    try {
        const { resultId } = req.params;
        const { firstPosition, secondPosition, thirdPosition } = req.body;

        const result = await Result.findById(resultId).populate('event');

        if (!result) {
            req.session.error = 'Result not found';
            return res.redirect('/faculty/dashboard');
        }

        if (result.coordinator.toString() !== req.session.user._id.toString()) {
            req.session.error = 'Unauthorized';
            return res.redirect('/faculty/dashboard');
        }

        // Store old departments for point recalculation
        const oldDepartments = {
            first: result.firstPosition.department,
            second: result.secondPosition.department,
            third: result.thirdPosition.department
        };

        // Update result
        result.firstPosition = {
            name: firstPosition.name,
            department: firstPosition.department || '',
            collegeId: firstPosition.collegeId || '',
            points: firstPosition.points ? parseInt(firstPosition.points) : undefined
        };
        result.secondPosition = {
            name: secondPosition.name,
            department: secondPosition.department || '',
            collegeId: secondPosition.collegeId || '',
            points: secondPosition.points ? parseInt(secondPosition.points) : undefined
        };
        result.thirdPosition = {
            name: thirdPosition.name,
            department: thirdPosition.department || '',
            collegeId: thirdPosition.collegeId || '',
            points: thirdPosition.points ? parseInt(thirdPosition.points) : undefined
        };

        await result.save();

        // Recalculate department points for Versity Week events
        if (result.event.eventMode === 'versity') {
            await recalculateDepartmentPoints(result.event._id, oldDepartments, {
                first: firstPosition.department,
                second: secondPosition.department,
                third: thirdPosition.department
            });
        }

        req.session.success = 'Result updated successfully!';
        res.redirect('/faculty/dashboard');
    } catch (error) {
        console.error('Edit result error:', error);
        req.session.error = 'Error updating result';
        res.redirect('/faculty/dashboard');
    }
});

// Delete Result
router.post('/results/:resultId/delete', async (req, res) => {
    try {
        const { resultId } = req.params;

        const result = await Result.findById(resultId).populate('event');

        if (!result) {
            req.session.error = 'Result not found';
            return res.redirect('/faculty/dashboard');
        }

        if (result.coordinator.toString() !== req.session.user._id.toString()) {
            req.session.error = 'Unauthorized';
            return res.redirect('/faculty/dashboard');
        }

        // Remove department points for Versity Week events
        if (result.event.eventMode === 'versity') {
            const pointValues = { first: 10, second: 7, third: 5 };
            const positions = ['first', 'second', 'third'];

            for (const pos of positions) {
                const dept = result[`${pos}Position`].department;
                if (dept) {
                    await DepartmentPoints.findOneAndUpdate(
                        { department: dept },
                        {
                            $inc: { totalPoints: -pointValues[pos] },
                            $pull: { eventBreakdown: { event: result.event._id } },
                            $set: { lastUpdated: new Date() }
                        }
                    );
                }
            }
        }

        await Result.findByIdAndDelete(resultId);

        req.session.success = 'Result deleted successfully!';
        res.redirect('/faculty/dashboard');
    } catch (error) {
        console.error('Delete result error:', error);
        req.session.error = 'Error deleting result';
        res.redirect('/faculty/dashboard');
    }
});

// Helper function to recalculate department points
async function recalculateDepartmentPoints(eventId, oldDepts, newDepts) {
    const pointValues = { first: 10, second: 7, third: 5 };
    const positions = ['first', 'second', 'third'];

    for (const pos of positions) {
        const oldDept = oldDepts[pos];
        const newDept = newDepts[pos];

        // Remove points from old department if different
        if (oldDept && oldDept !== newDept) {
            await DepartmentPoints.findOneAndUpdate(
                { department: oldDept },
                {
                    $inc: { totalPoints: -pointValues[pos] },
                    $pull: { eventBreakdown: { event: eventId } },
                    $set: { lastUpdated: new Date() }
                }
            );
        }

        // Add points to new department if different
        if (newDept && oldDept !== newDept) {
            const event = await Event.findById(eventId);
            await DepartmentPoints.findOneAndUpdate(
                { department: newDept },
                {
                    $inc: { totalPoints: pointValues[pos] },
                    $push: {
                        eventBreakdown: {
                            event: eventId,
                            eventTitle: event.title,
                            points: pointValues[pos],
                            position: pos,
                            date: new Date()
                        }
                    },
                    $set: { lastUpdated: new Date() }
                },
                { upsert: true }
            );
        }
    }
}

router.post('/events/:eventId/notifications/match-started', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { teamA, teamB, message } = req.body;
        
        const event = await Event.findOne({
            _id: eventId,
            organizer: req.session.user._id
        });
        
        if (!event) {
            return res.json({ success: false, message: 'Event not found' });
        }
        
        const notification = new Notification({
            event: eventId,
            type: 'match_started',
            message: message || `${teamA} vs ${teamB} match has started!`,
            teamA,
            teamB,
            createdBy: req.session.user._id
        });
        
        await notification.save();
        
        res.json({ success: true, message: 'Match started notification created' });
    } catch (error) {
        console.error('Error creating match notification:', error);
        res.json({ success: false, message: 'Error creating notification' });
    }
});

router.post('/events/:eventId/notifications/winner', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { teamA, teamB, winner, message } = req.body;
        
        const event = await Event.findOne({
            _id: eventId,
            organizer: req.session.user._id
        });
        
        if (!event) {
            return res.json({ success: false, message: 'Event not found' });
        }
        
        const notification = new Notification({
            event: eventId,
            type: 'winner_declared',
            message: message || `${winner} won against ${winner === teamA ? teamB : teamA}!`,
            teamA,
            teamB,
            winner,
            createdBy: req.session.user._id
        });
        
        await notification.save();
        
        res.json({ success: true, message: 'Winner notification created' });
    } catch (error) {
        console.error('Error creating winner notification:', error);
        res.json({ success: false, message: 'Error creating notification' });
    }
});

router.post('/events/:eventId/notifications/next-match', async (req, res) => {
    try {
        const { eventId } = req.params;
        const { teamA, teamB, message } = req.body;
        
        const event = await Event.findOne({
            _id: eventId,
            organizer: req.session.user._id
        });
        
        if (!event) {
            return res.json({ success: false, message: 'Event not found' });
        }
        
        const notification = new Notification({
            event: eventId,
            type: 'next_match',
            message: message || `Next match: ${teamA} vs ${teamB}`,
            teamA,
            teamB,
            createdBy: req.session.user._id
        });
        
        await notification.save();
        
        res.json({ success: true, message: 'Next match notification created' });
    } catch (error) {
        console.error('Error creating next match notification:', error);
        res.json({ success: false, message: 'Error creating notification' });
    }
});

router.get('/events/:eventId/notifications', async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const notifications = await Notification.find({ event: eventId })
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.json({ success: false, message: 'Error fetching notifications' });
    }
});

router.delete('/notifications/:notificationId', async (req, res) => {
    try {
        const { notificationId } = req.params;
        
        const notification = await Notification.findById(notificationId);
        
        if (!notification) {
            return res.json({ success: false, message: 'Notification not found' });
        }
        
        if (notification.createdBy.toString() !== req.session.user._id.toString()) {
            return res.json({ success: false, message: 'Not authorized' });
        }
        
        notification.isActive = false;
        await notification.save();
        
        res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.json({ success: false, message: 'Error deleting notification' });
    }
});

module.exports = router;
