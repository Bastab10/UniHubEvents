const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Sport = require('../models/Sport');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');

// 1. Dashboard Overview
router.get('/', async (req, res) => {
    try {
        // Redirect to student management page
        res.redirect('/admin/students');
    } catch (error) {
        console.error('Admin redirect error:', error);
        res.status(500).send('Error loading admin panel');
    }
});

// Middleware
router.use(isAuthenticated, checkRole('admin'), isApproved, isActive);

// 1. Dashboard Overview
router.get('/dashboard', async (req, res) => {
    try {
        const stats = await Promise.all([
            Event.countDocuments(),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'faculty', isApproved: true }),
            Event.countDocuments({ status: 'pending' }),
            Event.countDocuments({ status: 'approved' }),
            Event.find({ date: { $gte: new Date() } }).sort({ date: 1 }).limit(5),
            Event.find({ category: 'sports' }).sort({ date: -1 }).limit(10)
        ]);

        const [
            totalEvents,
            totalStudents,
            totalFaculty,
            pendingEvents,
            approvedEvents,
            upcomingEvents,
            sportsEvents
        ] = stats;

        const allEventsList = await Event.find({})
            .sort({ createdAt: -1 })
            .limit(6)
            .populate('organizer', 'profile.firstName profile.lastName');

        const upcomingEventsList = await Event.find({
            date: { $gte: new Date() }
        })
            .sort({ date: 1 })
            .limit(6)
            .populate('organizer', 'profile.firstName profile.lastName');

        const recentRegistrations = await Event.find({
            'registrations.status': 'pending'
        })
            .populate('registrations.student', 'profile.firstName profile.lastName')
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ createdAt: -1 })
            .limit(10);

        // ✅ FIXED aggregate syntax
        const allRegisteredStudents = await Event.aggregate([
            { $unwind: '$registrations' },
            {
                $match: {
                    'registrations.status': {
                        $in: ['pending', 'approved', 'rejected']
                    }
                }
            },
            {
                $group: {
                    _id: '$registrations.student',
                    studentDetails: { $first: '$registrations.student' },
                    registrations: { $push: '$registrations' },
                    totalEvents: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Fetch students and faculty data
        const allStudents = await User.find({ role: 'student' }).sort({ createdAt: -1 });
        const allFaculty = await User.find({ role: 'faculty' }).sort({ createdAt: -1 });
        const pendingFaculty = await User.find({ role: 'faculty', isApproved: false }).sort({ createdAt: -1 });
        const approvedFaculty = await User.find({ role: 'faculty', isApproved: true }).sort({ createdAt: -1 });
        
        // Fetch pending student event registrations
        const pendingRegistrations = await Event.aggregate([
            { $unwind: '$registrations' },
            {
                $match: {
                    'registrations.status': 'pending'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'registrations.student',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            {
                $lookup: {
                    from: 'events',
                    localField: 'registrations.event',
                    foreignField: '_id',
                    as: 'event'
                }
            },
            {
                $unwind: '$student'
            },
            {
                $unwind: '$event'
            },
            {
                $project: {
                    _id: '$registrations._id',
                    student: '$student',
                    event: '$event',
                    createdAt: '$registrations.createdAt'
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // Fetch total student registrations
        const totalRegistrations = await Event.aggregate([
            { $unwind: '$registrations' },
            {
                $match: {
                    'registrations.status': {
                        $in: ['pending', 'approved', 'rejected']
                    }
                }
            },
            { $count: 'total' }
        ]);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: {
                totalEvents,
                totalStudents,
                totalFaculty,
                pendingEvents,
                approvedEvents,
                upcomingEvents,
                sportsEvents,
                pendingFaculty: pendingFaculty.length,
                pendingRegistrations: pendingRegistrations.length,
                totalRegistrations: totalRegistrations.length > 0 ? totalRegistrations[0].total : 0
            },
            allEvents: allEventsList,
            upcomingEvents: upcomingEventsList,
            recentRegistrations,
            registeredStudents: allRegisteredStudents,
            sportsEvents: sportsEvents,
            allStudents,
            allFaculty,
            pendingFaculty,
            approvedFaculty,
            pendingRegistrations
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).send('Error loading dashboard');
    }
});

// Sports Management
router.get('/sports', async (req, res) => {
    try {
        const sports = await Sport.find().sort({ name: 1 });
        res.render('admin/sports', { title: 'Sports Management', sports });
    } catch (error) {
        console.error('Sports error:', error);
        res.redirect('/admin/dashboard');
    }
});

// Add sport
router.post('/sports/add', async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            maxTeamSize,
            minTeamSize,
            equipment,
            rules
        } = req.body;

        const newSport = new Sport({
            name,
            description,
            category,
            maxTeamSize: maxTeamSize || 1,
            minTeamSize: minTeamSize || 1,
            equipment: equipment
                ? equipment.split(',').map(e => e.trim())
                : [],
            rules
        });

        await newSport.save();
        res.redirect('/admin/sports');
    } catch (error) {
        console.error('Add sport error:', error);
        res.redirect('/admin/sports');
    }
});

// Event Details
router.get('/events/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName profile.email profile.department')
            .populate('registrations.student', 'profile.firstName profile.lastName profile.email profile.collegeId');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/admin/dashboard');
        }

        res.render('admin/event-details', {
            title: 'Event Details',
            event
        });
    } catch (error) {
        console.error('Event details error:', error);
        res.status(500).send('Error loading event details');
    }
});

// Event-Specific Registration Management
router.get('/events/:id/registrations', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('registrations.student', 'profile.firstName profile.lastName profile.email profile.collegeId profile.verified')
            .populate('organizer', 'profile.firstName profile.lastName');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/admin/dashboard');
        }

        // Calculate statistics
        const stats = {
            total: event.registrations.length,
            pending: event.registrations.filter(reg => reg.status === 'pending').length,
            approved: event.registrations.filter(reg => reg.status === 'approved').length,
            rejected: event.registrations.filter(reg => reg.status === 'rejected').length,
            verified: event.registrations.filter(reg => reg.student?.profile?.verified).length
        };

        res.render('admin/event-registrations', { 
            title: 'Event Registrations', 
            event,
            stats,
            registrations: event.registrations
        });
    } catch (error) {
        console.error('Event registrations error:', error);
        req.session.error = 'Error loading event registrations';
        res.redirect('/admin/events');
    }
});

// Event Approval (GET route for anchor tags)
router.get('/events/:id/approve', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findByIdAndUpdate(
            eventId,
            { 
                status: 'approved',
                approvedBy: req.session.user._id,
                approvalDate: new Date()
            },
            { new: true }
        ).populate('organizer', 'profile.firstName profile.lastName');
        
        if (event) {
            req.session.success = 'Event approved successfully!';
            res.redirect('/admin/dashboard');
        } else {
            req.session.error = 'Event not found';
            res.redirect('/admin/dashboard');
        }
    } catch (error) {
        console.error('Approve event error:', error);
        req.session.error = 'Error approving event';
        res.redirect('/admin/dashboard');
    }
});

// Event Approval (POST route for AJAX)
router.post('/events/:id/approve', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findByIdAndUpdate(
            eventId,
            { 
                status: 'approved',
                approvedBy: req.session.user._id,
                approvalDate: new Date()
            },
            { new: true }
        ).populate('organizer', 'profile.firstName profile.lastName');
        
        if (event) {
            res.json({ success: true, message: 'Event approved successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Event not found' });
        }
    } catch (error) {
        console.error('Approve event error:', error);
        res.status(500).json({ success: false, message: 'Error approving event' });
    }
});

// Event Rejection (GET route for anchor tags)
router.get('/events/:id/reject', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findByIdAndUpdate(
            eventId,
            { 
                status: 'rejected',
                rejectionReason: 'Rejected by administrator',
                approvedBy: req.session.user._id,
                approvalDate: new Date()
            },
            { new: true }
        ).populate('organizer', 'profile.firstName profile.lastName');
        
        if (event) {
            req.session.success = 'Event rejected successfully!';
            res.redirect('/admin/dashboard');
        } else {
            req.session.error = 'Event not found';
            res.redirect('/admin/dashboard');
        }
    } catch (error) {
        console.error('Reject event error:', error);
        req.session.error = 'Error rejecting event';
        res.redirect('/admin/dashboard');
    }
});

// Event Rejection (POST route for AJAX)
router.post('/events/:id/reject', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { reason } = req.body;
        
        const event = await Event.findByIdAndUpdate(
            eventId,
            { 
                status: 'rejected',
                rejectionReason: reason,
                approvedBy: req.session.user._id,
                approvalDate: new Date()
            },
            { new: true }
        ).populate('organizer', 'profile.firstName profile.lastName');
        
        if (event) {
            res.json({ success: true, message: 'Event rejected successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Event not found' });
        }
    } catch (error) {
        console.error('Reject event error:', error);
        res.status(500).json({ success: false, message: 'Error rejecting event' });
    }
});

// Individual Registration Approval
router.post('/registrations/:id/approve', async (req, res) => {
    try {
        const registrationId = req.params.id;
        
        const event = await Event.findOneAndUpdate(
            { 'registrations._id': registrationId },
            { 
                $set: { 
                    'registrations.$.status': 'approved',
                    'registrations.$.approvedBy': req.session.user._id,
                    'registrations.$.approvalDate': new Date()
                }
            },
            { new: true }
        );
        
        if (event) {
            res.json({ success: true, message: 'Registration approved successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Registration not found' });
        }
    } catch (error) {
        console.error('Approve registration error:', error);
        res.status(500).json({ success: false, message: 'Error approving registration' });
    }
});

// Individual Registration Rejection
router.post('/registrations/:id/reject', async (req, res) => {
    try {
        const registrationId = req.params.id;
        const { reason } = req.body;
        
        const event = await Event.findOneAndUpdate(
            { 'registrations._id': registrationId },
            { 
                $set: { 
                    'registrations.$.status': 'rejected',
                    'registrations.$.rejectionReason': reason,
                    'registrations.$.approvedBy': req.session.user._id,
                    'registrations.$.approvalDate': new Date()
                }
            },
            { new: true }
        );
        
        if (event) {
            res.json({ success: true, message: 'Registration rejected successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Registration not found' });
        }
    } catch (error) {
        console.error('Reject registration error:', error);
        res.status(500).json({ success: false, message: 'Error rejecting registration' });
    }
});

// Bulk Registration Operations
router.post('/registrations/bulk-approve', async (req, res) => {
    try {
        const { registrationIds } = req.body;
        
        if (!registrationIds || !Array.isArray(registrationIds)) {
            return res.status(400).json({ success: false, message: 'Invalid registration IDs' });
        }

        const updatePromises = registrationIds.map(registrationId => 
            Event.findOneAndUpdate(
                { 'registrations._id': registrationId },
                { 
                    $set: { 
                        'registrations.$.status': 'approved',
                        'registrations.$.approvedBy': req.session.user._id,
                        'registrations.$.approvalDate': new Date()
                    }
                },
                { new: true }
            )
        );

        await Promise.all(updatePromises);
        
        res.json({ 
            success: true, 
            message: `Approved ${registrationIds.length} registrations successfully` 
        });
    } catch (error) {
        console.error('Bulk approve error:', error);
        res.status(500).json({ success: false, message: 'Error approving registrations' });
    }
});

router.post('/registrations/bulk-reject', async (req, res) => {
    try {
        const { registrationIds, reason } = req.body;
        
        if (!registrationIds || !Array.isArray(registrationIds)) {
            return res.status(400).json({ success: false, message: 'Invalid registration IDs' });
        }

        const updatePromises = registrationIds.map(registrationId => 
            Event.findOneAndUpdate(
                { 'registrations._id': registrationId },
                { 
                    $set: { 
                        'registrations.$.status': 'rejected',
                        'registrations.$.rejectionReason': reason,
                        'registrations.$.approvedBy': req.session.user._id,
                        'registrations.$.approvalDate': new Date()
                    }
                },
                { new: true }
            )
        );

        await Promise.all(updatePromises);
        
        res.json({ 
            success: true, 
            message: `Rejected ${registrationIds.length} registrations successfully` 
        });
    } catch (error) {
        console.error('Bulk reject error:', error);
        res.status(500).json({ success: false, message: 'Error rejecting registrations' });
    }
});

// Student Verification Routes
router.post('/students/:id/verify', async (req, res) => {
    try {
        const { verificationStatus, notes } = req.body;
        const student = await User.findByIdAndUpdate(
            req.params.id,
            { 
                $set: { 
                    'profile.verified': verificationStatus === 'verified',
                    'profile.verificationNotes': notes,
                    'profile.verifiedBy': req.session.user._id,
                    'profile.verifiedDate': new Date()
                }
            },
            { new: true }
        );
        
        if (student) {
            res.json({ success: true, message: 'Student verification updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Student not found' });
        }
    } catch (error) {
        console.error('Student verification error:', error);
        res.status(500).json({ success: false, message: 'Error verifying student' });
    }
});

// Registration Notes Management
router.post('/registrations/:id/notes', async (req, res) => {
    try {
        const { notes } = req.body;
        const event = await Event.findOneAndUpdate(
            { 'registrations._id': req.params.id },
            { 
                $set: { 
                    'registrations.$.adminNotes': notes,
                    'registrations.$.updatedBy': req.session.user._id,
                    'registrations.$.updatedAt': new Date()
                }
            },
            { new: true }
        );
        
        if (event) {
            res.json({ success: true, message: 'Registration notes updated successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Registration not found' });
        }
    } catch (error) {
        console.error('Registration notes error:', error);
        res.status(500).json({ success: false, message: 'Error updating registration notes' });
    }
});

// All Registrations Management
router.get('/registrations-management', async (req, res) => {
    try {
        const { status, search, eventId } = req.query;
        let matchStage = { 'registrations.status': { $in: ['pending', 'approved', 'rejected'] } };
        
        if (status) matchStage['registrations.status'] = status;
        if (eventId) matchStage._id = new mongoose.Types.ObjectId(eventId);
        
        const allRegistrations = await Event.aggregate([
            { $unwind: '$registrations' },
            { $match: matchStage },
            { $lookup: {
                from: 'users',
                localField: 'registrations.student',
                foreignField: '_id',
                as: 'studentDetails'
            }},
            { $lookup: {
                from: 'events',
                localField: '_id',
                foreignField: '_id',
                as: 'eventDetails'
            }},
            { $project: {
                _id: '$registrations._id',
                'registrations.status': 1,
                'registrations.registeredAt': 1,
                'registrations.teamName': 1,
                'registrations.adminNotes': 1,
                'studentDetails.profile.firstName': 1,
                'studentDetails.profile.lastName': 1,
                'studentDetails.profile.email': 1,
                'studentDetails.profile.collegeId': 1,
                'studentDetails.profile.verified': 1,
                'eventDetails.title': 1,
                'eventDetails.date': 1,
                'eventDetails.category': 1,
                'eventDetails.venue': 1
            }},
            { $sort: { 'registrations.registeredAt': -1 } }
        ]);
        
        // Get total count
        const total = await Event.aggregate([
            { $unwind: '$registrations' },
            { $match: matchStage },
            { $count: 'total' }
        ]);
        
        res.render('admin/registrations-management', {
            title: 'Registration Management',
            registrations: allRegistrations,
            totalRegistrations: total[0]?.total || 0,
            currentPage: 1,
            totalPages: 1,
            events: await Event.find({}).select('title').limit(50)
        });
    } catch (error) {
        console.error('Registration management error:', error);
        res.status(500).send('Error loading registrations');
    }
});

// Faculty Approval Routes
router.get('/faculty-management', async (req, res) => {
    try {
        const pendingFaculty = await User.find({ role: 'faculty', isApproved: false })
            .sort({ createdAt: -1 });
        
        const approvedFaculty = await User.find({ role: 'faculty', isApproved: true })
            .sort({ createdAt: -1 });

        res.render('admin/faculty-management', {
            title: 'Faculty Management',
            pendingFaculty,
            approvedFaculty,
            stats: {
                totalPending: pendingFaculty.length,
                totalApproved: approvedFaculty.length
            }
        });
    } catch (error) {
        console.error('Faculty management error:', error);
        res.status(500).send('Error loading faculty management');
    }
});

router.post('/faculty/:id/approve', async (req, res) => {
    try {
        const facultyId = req.params.id;
        
        const faculty = await User.findByIdAndUpdate(
            facultyId,
            { 
                isApproved: true,
                approvedBy: req.session.user._id,
                approvalDate: new Date()
            },
            { new: true }
        );
        
        if (faculty) {
            res.json({ success: true, message: 'Faculty approved successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Faculty not found' });
        }
    } catch (error) {
        console.error('Approve faculty error:', error);
        res.status(500).json({ success: false, message: 'Error approving faculty' });
    }
});

router.post('/faculty/:id/reject', async (req, res) => {
    try {
        const facultyId = req.params.id;
        const { reason } = req.body;
        
        const faculty = await User.findByIdAndDelete(facultyId);
        
        if (faculty) {
            res.json({ 
                success: true, 
                message: 'Faculty rejected and account removed',
                reason: reason || 'Rejected by administrator'
            });
        } else {
            res.status(404).json({ success: false, message: 'Faculty not found' });
        }
    } catch (error) {
        console.error('Reject faculty error:', error);
        res.status(500).json({ success: false, message: 'Error rejecting faculty' });
    }
});

// Approved Events
router.get('/approved-events', async (req, res) => {
    try {
        const approvedEvents = await Event.find({ status: 'approved' })
            .sort({ date: 1 })
            .populate('organizer', 'profile.firstName profile.lastName');

        res.render('admin/approved-events', {
            title: 'Approved Events',
            approvedEvents
        });
    } catch (error) {
        console.error('Approved events error:', error);
        res.status(500).send('Error loading approved events');
    }
});

// Approved Registrations
router.get('/approved-registrations', async (req, res) => {
    try {
        const approvedRegistrations = await Event.aggregate([
            { $match: { status: 'approved' } },
            { $unwind: '$registrations' },
            { $match: { 'registrations.status': 'approved' } },
            { $lookup: {
                from: 'users',
                localField: 'registrations.student',
                foreignField: '_id',
                as: 'student'
            }},
            { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
            { $sort: { 'registrations.approvalDate': -1 } },
            {
                $project: {
                    _id: 0,
                    student: {
                        _id: 1,
                        profile: {
                            firstName: 1,
                            lastName: 1,
                            email: 1,
                            collegeId: 1
                        }
                    },
                    event: {
                        _id: '$$ROOT._id',
                        title: 1,
                        date: 1,
                        category: 1,
                        venue: 1
                    },
                    registration: {
                        registeredAt: '$registrations.registeredAt',
                        approvalDate: '$registrations.approvalDate',
                        status: '$registrations.status'
                    }
                }
            }
        ]);

        console.log('Approved registrations found:', approvedRegistrations.length);

        // Calculate statistics with null checks
        const uniqueStudents = new Set(
            approvedRegistrations
                .filter(reg => reg.student && reg.student._id)
                .map(reg => reg.student._id.toString())
        ).size;
        
        const uniqueEvents = new Set(
            approvedRegistrations
                .filter(reg => reg.event && reg.event._id)
                .map(reg => reg.event._id.toString())
        ).size;
        
        const thisMonth = approvedRegistrations.filter(reg => {
            if (!reg.registration || !reg.registration.approvalDate) return false;
            const approvalDate = new Date(reg.registration.approvalDate);
            const now = new Date();
            return approvalDate.getMonth() === now.getMonth() && 
                   approvalDate.getFullYear() === now.getFullYear();
        }).length;

        res.render('admin/approved-registrations', {
            title: 'Approved Registrations',
            approvedRegistrations,
            uniqueStudents,
            uniqueEvents,
            thisMonth
        });
    } catch (error) {
        console.error('Approved registrations error:', error);
        res.status(500).send('Error loading approved registrations');
    }
});

// Faculty Management
router.get('/faculty', async (req, res) => {
    try {
        const faculty = await User.find({ role: 'faculty' })
            .select(
                'profile.firstName profile.lastName profile.email profile.department profile.collegeId createdAt'
            )
            .sort({ createdAt: -1 })
            .limit(50);

        res.render('admin/faculty-management', {
            title: 'Faculty Management',
            faculty
        });
    } catch (error) {
        console.error('Faculty management error:', error);
        res.status(500).send('Error loading faculty management');
    }
});

// Faculty Details
router.get('/faculty/:id', async (req, res) => {
    try {
        const faculty = await User.findById(req.params.id);
        
        if (!faculty || faculty.role !== 'faculty') {
            return res.status(404).send('Faculty not found');
        }

        // Get all events created by this faculty
        const facultyEvents = await Event.find({ organizer: faculty._id })
            .sort({ createdAt: -1 })
            .populate('organizer', 'profile.firstName profile.lastName');

        res.render('admin/faculty-details', {
            title: 'Faculty Details',
            faculty,
            facultyEvents
        });
    } catch (error) {
        console.error('Faculty details error:', error);
        res.status(500).send('Error loading faculty details');
    }
});

// All Registrations
router.get('/registrations/all', async (req, res) => {
    try {
        const allRegistrations = await Event.aggregate([
            { $unwind: '$registrations' },
            {
                $match: {
                    'registrations.status': {
                        $in: ['pending', 'approved', 'rejected']
                    }
                }
            }
        ]);

        res.render('admin/all-registrations', {
            title: 'All Registrations',
            registrations: allRegistrations
        });
    } catch (error) {
        console.error('All registrations error:', error);
        res.status(500).send('Error loading registrations');
    }
});

// Get Student Details for Modal
router.get('/students/:id/details', async (req, res) => {
    try {
        const { registration } = req.query;
        const student = await User.findById(req.params.id);
        
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        
        let registrationData = null;
        if (registration) {
            const event = await Event.findOne({ 'registrations._id': registration });
            if (event) {
                registrationData = event.registrations.id(registration);
            }
        }
        
        res.json({ 
            success: true, 
            student: {
                _id: student._id,
                profile: student.profile
            },
            registration: registrationData
        });
    } catch (error) {
        console.error('Student details API error:', error);
        res.status(500).json({ success: false, message: 'Error loading student details' });
    }
});

// Student Approval Route
router.post('/students/:id/approve', async (req, res) => {
    try {
        const studentId = req.params.id;
        
        const student = await User.findByIdAndUpdate(
            studentId,
            { 
                'profile.verified': true,
                'verifiedBy': req.session.user._id,
                'verificationDate': new Date()
            },
            { new: true }
        );
        
        if (student) {
            res.json({ success: true, message: 'Student approved successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Student not found' });
        }
    } catch (error) {
        console.error('Approve student error:', error);
        res.status(500).json({ success: false, message: 'Error approving student' });
    }
});

router.get('/students/:id', async (req, res) => {
    try {
        const { registration } = req.query;
        const student = await User.findById(req.params.id);
        
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        
        const studentEvents = await Event.find({ 'registrations.student': student._id })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: -1 });
        
        // Find specific registration if registration ID is provided
        let specificRegistration = null;
        let specificEvent = null;
        if (registration) {
            specificRegistration = await Event.findOne({ 'registrations._id': registration })
                .populate('organizer', 'profile.firstName profile.lastName');
            
            if (specificRegistration) {
                specificEvent = specificRegistration;
            }
        }
        
        res.render('admin/student-details', {
            title: 'Student Details',
            student,
            studentEvents,
            specificRegistration,
            specificEvent
        });
    } catch (error) {
        console.error('Student details error:', error);
        res.status(500).send('Error loading student details');
    }
});

// Registration Management Routes
router.post('/registrations/:id/approve', async (req, res) => {
    try {
        const registrationId = req.params.id;
        
        // Update registration status to approved
        const registration = await Event.findOneAndUpdate(
            { 'registrations._id': registrationId },
            { 
                'registrations.$.status': 'approved',
                'registrations.$.approvedBy': req.session.user._id,
                'registrations.$.approvedDate': new Date()
            },
            { new: true }
        );
        
        if (registration) {
            res.json({ success: true, message: 'Registration approved successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Registration not found' });
        }
    } catch (error) {
        console.error('Approve registration error:', error);
        res.status(500).json({ success: false, message: 'Error approving registration' });
    }
});

router.post('/registrations/:id/reject', async (req, res) => {
    try {
        const registrationId = req.params.id;
        const { reason } = req.body;
        
        // Update registration status to rejected
        const registration = await Event.findOneAndUpdate(
            { 'registrations._id': registrationId },
            { 
                'registrations.$.status': 'rejected',
                'registrations.$.rejectedBy': req.session.user._id,
                'registrations.$.rejectedDate': new Date(),
                'registrations.$.rejectionReason': reason
            },
            { new: true }
        );
        
        if (registration) {
            res.json({ success: true, message: 'Registration rejected successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Registration not found' });
        }
    } catch (error) {
        console.error('Reject registration error:', error);
        res.status(500).json({ success: false, message: 'Error rejecting registration' });
    }
});

// User Management - Block/Unblock Users
router.post('/users/:id/block', async (req, res) => {
    try {
        const userId = req.params.id;
        
        const user = await User.findByIdAndUpdate(
            userId,
            { isActive: false },
            { new: true }
        );
        
        if (user) {
            req.session.success = `${user.profile.firstName} ${user.profile.lastName} has been blocked`;
            res.redirect('back');
        } else {
            req.session.error = 'User not found';
            res.redirect('back');
        }
    } catch (error) {
        console.error('Block user error:', error);
        req.session.error = 'Error blocking user';
        res.redirect('back');
    }
});

router.post('/users/:id/unblock', async (req, res) => {
    try {
        const userId = req.params.id;
        
        const user = await User.findByIdAndUpdate(
            userId,
            { isActive: true },
            { new: true }
        );
        
        if (user) {
            req.session.success = `${user.profile.firstName} ${user.profile.lastName} has been unblocked`;
            res.redirect('back');
        } else {
            req.session.error = 'User not found';
            res.redirect('back');
        }
    } catch (error) {
        console.error('Unblock user error:', error);
        req.session.error = 'Error unblocking user';
        res.redirect('back');
    }
});

// Event Deletion
router.post('/events/:id/delete', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findByIdAndDelete(eventId);
        
        if (event) {
            req.session.success = 'Event deleted successfully';
            res.redirect('/admin/dashboard');
        } else {
            req.session.error = 'Event not found';
            res.redirect('/admin/dashboard');
        }
    } catch (error) {
        console.error('Delete event error:', error);
        req.session.error = 'Error deleting event';
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;
