const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
const DepartmentPoints = require('../models/DepartmentPoints');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');
const { deleteImage } = require('../config/cloudinary');

router.get('/', async (req, res) => {
    try {
        res.redirect('/admin/students');
    } catch (error) {
        console.error('Admin redirect error:', error);
        res.status(500).send('Error loading admin panel');
    }
});

router.use(isAuthenticated, checkRole('admin'), isApproved, isActive);

router.get('/dashboard', async (req, res) => {
    try {
        const stats = await Promise.all([
            Event.countDocuments(),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'faculty', isApproved: true }),
            Event.find({ date: { $gte: new Date() } }).sort({ date: 1 }).limit(5)
        ]);

        const [
            totalEvents,
            totalStudents,
            totalFaculty,
            upcomingEvents
        ] = stats;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allEventsList = await Event.find({
            date: { $gte: today }
        })
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

        const allStudents = await User.find({ role: 'student' }).sort({ createdAt: -1 });
        const allFaculty = await User.find({ role: 'faculty' }).sort({ createdAt: -1 });
        const pendingFaculty = await User.find({ role: 'faculty', isApproved: false }).sort({ createdAt: -1 });
        const approvedFaculty = await User.find({ role: 'faculty', isApproved: true }).sort({ createdAt: -1 });
        
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
                upcomingEvents,
                pendingFaculty: pendingFaculty.length,
                pendingRegistrations: pendingRegistrations.length,
                totalRegistrations: totalRegistrations.length > 0 ? totalRegistrations[0].total : 0
            },
            allEvents: allEventsList,
            upcomingEvents: upcomingEventsList,
            recentRegistrations,
            registeredStudents: allRegisteredStudents,
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

router.get('/events', async (req, res) => {
    try {
        const events = await Event.find({})
            .sort({ date: -1 })
            .populate('organizer', 'profile.firstName profile.lastName');

        res.render('admin/events', {
            title: 'All Events',
            events,
            currentPath: '/admin/events'
        });
    } catch (error) {
        console.error('All events error:', error);
        res.status(500).send('Error loading events');
    }
});

router.get('/events/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName profile.email profile.department')
            .populate('registrations.student', 'profile.firstName profile.lastName profile.email profile.collegeId profile.department');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/admin/dashboard');
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

        res.render('admin/event-details', {
            title: 'Event Details',
            event,
            departmentGroups
        });
    } catch (error) {
        console.error('Event details error:', error);
        res.status(500).send('Error loading event details');
    }
});

router.get('/events/:id/registrations', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('registrations.student', 'profile.firstName profile.lastName profile.email profile.collegeId profile.department profile.verified')
            .populate('organizer', 'profile.firstName profile.lastName');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/admin/dashboard');
        }

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

router.get('/students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('profile.firstName profile.lastName profile.email profile.collegeId profile.department profile.verified createdAt')
            .sort({ createdAt: -1 });

        res.render('admin/students-management', {
            title: 'All Students',
            students,
            currentPath: '/admin/students'
        });
    } catch (error) {
        console.error('All students error:', error);
        res.status(500).send('Error loading students');
    }
});

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

router.delete('/students/:id', async (req, res) => {
    try {
        const student = await User.findOneAndDelete({ 
            _id: req.params.id, 
            role: 'student' 
        });
        
        if (student) {
            await Event.updateMany(
                { 'registrations.student': req.params.id },
                { $pull: { registrations: { student: req.params.id } } }
            );
            
            res.json({ success: true, message: 'Student deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Student not found' });
        }
    } catch (error) {
        console.error('Student deletion error:', error);
        res.status(500).json({ success: false, message: 'Error deleting student' });
    }
});

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
                'studentDetails.profile.department': 1,
                'studentDetails.profile.verified': 1,
                'eventDetails.title': 1,
                'eventDetails.date': 1,
                'eventDetails.category': 1,
                'eventDetails.venue': 1
            }},
            { $sort: { 'registrations.registeredAt': -1 } }
        ]);
        
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

router.delete('/faculty/:id/delete', async (req, res) => {
    try {
        const facultyId = req.params.id;
        
        const faculty = await User.findById(facultyId);
        
        if (!faculty) {
            return res.status(404).json({ success: false, message: 'Faculty member not found' });
        }
        
        const facultyEvents = await Event.find({ organizer: facultyId });
        const eventIds = facultyEvents.map(event => event._id);
        
        await Event.updateMany(
            { _id: { $in: eventIds } },
            { $pull: { registrations: {} } }
        );
        
        await Event.deleteMany({ organizer: facultyId });
        
        await User.updateMany(
            { 'registeredEvents': facultyId },
            { $pull: { registeredEvents: facultyId } }
        );
        
        await User.findByIdAndDelete(facultyId);
        
        res.json({ 
            success: true, 
            message: 'Faculty member and all associated data deleted successfully',
            deletedEvents: await Event.deleteMany({ organizer: facultyId }).then(result => result.deletedCount)
        });
    } catch (error) {
        console.error('Faculty deletion error:', error);
        res.status(500).json({ success: false, message: 'Error deleting faculty member' });
    }
});

router.get('/approved-registrations', async (req, res) => {
    try {
        const approvedRegistrations = await Event.aggregate([
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

router.get('/past-events', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const pastEvents = await Event.find({
            date: { $lt: today }
        })
            .sort({ date: -1 }) // Sort by date descending (newest past event first)
            .populate('organizer', 'profile.firstName profile.lastName profile.email profile.department');

        res.render('admin/past-events', {
            title: 'Past Events',
            pastEvents,
            currentPath: '/admin/past-events'
        });
    } catch (error) {
        console.error('Past events error:', error);
        res.status(500).send('Error loading past events');
    }
});

router.get('/past-events/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName profile.email profile.department createdAt')
            .populate('registrations.student', 'profile.firstName profile.lastName profile.email profile.collegeId profile.department');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/admin/past-events');
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        if (eventDate >= today) {
            req.session.error = 'This event is not a past event';
            return res.redirect('/admin/past-events');
        }

        res.render('admin/view-past-event', {
            title: 'Past Event Details',
            event
        });
    } catch (error) {
        console.error('Past event details error:', error);
        res.status(500).send('Error loading past event details');
    }
});

router.delete('/past-events/:id/delete', async (req, res) => {
    try {
        const eventId = req.params.id;

        const event = await Event.findById(eventId);

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        if (eventDate >= today) {
            return res.status(400).json({ success: false, message: 'Cannot delete upcoming or current events from past events section' });
        }

        if (event.poster && event.poster.trim() !== '') {
            await deleteImage(event.poster);
        }

        await Event.findByIdAndDelete(eventId);

        res.json({ success: true, message: 'Past event deleted successfully' });
    } catch (error) {
        console.error('Delete past event error:', error);
        res.status(500).json({ success: false, message: 'Error deleting past event: ' + error.message });
    }
});

// Admin Leaderboard Route
router.get('/leaderboard', async (req, res) => {
    try {
        const departments = await DepartmentPoints.find().sort({ totalPoints: -1 });

        // Calculate ranks with tie handling
        let currentRank = 1;
        let previousPoints = null;

        const rankedDepartments = departments.map((dept, index) => {
            if (previousPoints !== null && dept.totalPoints < previousPoints) {
                currentRank = index + 1;
            }
            previousPoints = dept.totalPoints;
            return {
                ...dept.toObject(),
                rank: currentRank
            };
        });

        res.render('admin/leaderboard', {
            title: 'Department Leaderboard',
            departments: rankedDepartments,
            currentPath: '/admin/leaderboard'
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        req.session.error = 'Error loading leaderboard';
        res.redirect('/admin/dashboard');
    }
});

// Admin Department Details Route
router.get('/leaderboard/department/:departmentName', async (req, res) => {
    try {
        const { departmentName } = req.params;
        const department = await DepartmentPoints.findOne({ department: departmentName });

        if (!department) {
            req.session.error = 'Department not found';
            return res.redirect('/admin/leaderboard');
        }

        // Get all departments for rank calculation
        const allDepartments = await DepartmentPoints.find().sort({ totalPoints: -1 });
        let rank = 1;
        let previousPoints = null;

        for (let i = 0; i < allDepartments.length; i++) {
            if (previousPoints !== null && allDepartments[i].totalPoints < previousPoints) {
                rank = i + 1;
            }
            if (allDepartments[i].department === departmentName) {
                break;
            }
            previousPoints = allDepartments[i].totalPoints;
        }

        res.render('admin/department-details', {
            title: `${departmentName} - Details`,
            department,
            rank,
            currentPath: '/admin/leaderboard'
        });
    } catch (error) {
        console.error('Department details error:', error);
        req.session.error = 'Error loading department details';
        res.redirect('/admin/leaderboard');
    }
});

// Admin Results Management - View All Results
router.get('/results', async (req, res) => {
    try {
        const results = await Result.find()
            .populate('event', 'title date eventMode category')
            .populate('coordinator', 'profile.fullName')
            .sort({ uploadedAt: -1 });

        res.render('admin/results', {
            title: 'All Results',
            results,
            currentPath: '/admin/results'
        });
    } catch (error) {
        console.error('Results error:', error);
        req.session.error = 'Error loading results';
        res.redirect('/admin/dashboard');
    }
});

// Admin Edit Result - GET
router.get('/results/:id/edit', async (req, res) => {
    try {
        const result = await Result.findById(req.params.id)
            .populate('event', 'title date eventMode category')
            .populate('coordinator', 'profile.fullName');

        if (!result) {
            req.session.error = 'Result not found';
            return res.redirect('/admin/results');
        }

        res.render('admin/edit-result', {
            title: 'Edit Result',
            result,
            currentPath: '/admin/results'
        });
    } catch (error) {
        console.error('Edit result error:', error);
        req.session.error = 'Error loading result';
        res.redirect('/admin/results');
    }
});

// Admin Edit Result - POST
router.post('/results/:id/edit', async (req, res) => {
    try {
        const resultId = req.params.id;
        const { firstName, firstDepartment, firstCollegeId, firstPoints,
                secondName, secondDepartment, secondCollegeId, secondPoints,
                thirdName, thirdDepartment, thirdCollegeId, thirdPoints } = req.body;

        const result = await Result.findById(resultId).populate('event');
        if (!result) {
            req.session.error = 'Result not found';
            return res.redirect('/admin/results');
        }

        // Store old positions for point recalculation
        const isVersityEvent = result.event.eventMode === 'versity';
        const oldPositions = isVersityEvent ? {
            first: result.firstPosition.department,
            second: result.secondPosition.department,
            third: result.thirdPosition.department
        } : null;

        // Update result
        result.firstPosition = {
            name: firstName,
            department: firstDepartment,
            collegeId: firstCollegeId,
            points: firstPoints ? parseInt(firstPoints) : undefined
        };
        result.secondPosition = {
            name: secondName,
            department: secondDepartment,
            collegeId: secondCollegeId,
            points: secondPoints ? parseInt(secondPoints) : undefined
        };
        result.thirdPosition = {
            name: thirdName,
            department: thirdDepartment,
            collegeId: thirdCollegeId,
            points: thirdPoints ? parseInt(thirdPoints) : undefined
        };

        await result.save();

        // Recalculate department points for Versity Week events
        if (isVersityEvent) {
            const pointValues = { first: 10, second: 7, third: 5 };

            // Remove old points
            if (oldPositions) {
                for (const [position, dept] of Object.entries(oldPositions)) {
                    if (dept) {
                        await DepartmentPoints.findOneAndUpdate(
                            { department: dept },
                            {
                                $inc: { totalPoints: -pointValues[position] },
                                $pull: { eventBreakdown: { event: result.event._id } }
                            }
                        );
                    }
                }
            }

            // Add new points
            const newPositions = {
                first: firstDepartment,
                second: secondDepartment,
                third: thirdDepartment
            };

            for (const [position, dept] of Object.entries(newPositions)) {
                if (dept) {
                    await DepartmentPoints.findOneAndUpdate(
                        { department: dept },
                        {
                            $inc: { totalPoints: pointValues[position] },
                            $push: {
                                eventBreakdown: {
                                    event: result.event._id,
                                    eventTitle: result.event.title,
                                    points: pointValues[position],
                                    position: position,
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

        req.session.success = 'Result updated successfully';
        res.redirect('/admin/results');
    } catch (error) {
        console.error('Update result error:', error);
        req.session.error = 'Error updating result';
        res.redirect(`/admin/results/${req.params.id}/edit`);
    }
});

// Admin Delete Result
router.post('/results/:id/delete', async (req, res) => {
    try {
        const result = await Result.findById(req.params.id).populate('event');
        if (!result) {
            req.session.error = 'Result not found';
            return res.redirect('/admin/results');
        }

        // Remove department points for Versity Week events
        if (result.event.eventMode === 'versity') {
            const pointValues = { first: 10, second: 7, third: 5 };
            const positions = {
                first: result.firstPosition.department,
                second: result.secondPosition.department,
                third: result.thirdPosition.department
            };

            for (const [position, dept] of Object.entries(positions)) {
                if (dept) {
                    await DepartmentPoints.findOneAndUpdate(
                        { department: dept },
                        {
                            $inc: { totalPoints: -pointValues[position] },
                            $pull: { eventBreakdown: { event: result.event._id } },
                            $set: { lastUpdated: new Date() }
                        }
                    );
                }
            }
        }

        await Result.findByIdAndDelete(req.params.id);

        req.session.success = 'Result deleted successfully';
        res.redirect('/admin/results');
    } catch (error) {
        console.error('Delete result error:', error);
        req.session.error = 'Error deleting result';
        res.redirect('/admin/results');
    }
});

// Admin Reports/Analytics Route
router.get('/reports', async (req, res) => {
    try {
        // Get statistics
        const totalEvents = await Event.countDocuments();
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalFaculty = await User.countDocuments({ role: 'faculty', isApproved: true });

        // Category-wise events
        const categoryStats = await Event.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Event mode distribution
        const eventModeStats = await Event.aggregate([
            { $group: { _id: '$eventMode', count: { $sum: 1 } } }
        ]);

        // Total registrations
        const totalRegistrations = await Event.aggregate([
            { $unwind: '$registrations' },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]);

        // Registration status breakdown
        const registrationStats = await Event.aggregate([
            { $unwind: '$registrations' },
            { $group: { _id: '$registrations.status', count: { $sum: 1 } } }
        ]);

        // Department-wise student count
        const departmentStats = await User.aggregate([
            { $match: { role: 'student' } },
            { $group: { _id: '$profile.department', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Monthly events (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyStats = await Event.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } }
        ]);

        res.render('admin/reports', {
            title: 'Reports & Analytics',
            stats: {
                totalEvents,
                totalStudents,
                totalFaculty,
                totalRegistrations: totalRegistrations[0]?.count || 0,
                categoryStats,
                eventModeStats,
                registrationStats,
                departmentStats,
                monthlyStats
            },
            currentPath: '/admin/reports'
        });
    } catch (error) {
        console.error('Reports error:', error);
        req.session.error = 'Error loading reports';
        res.redirect('/admin/dashboard');
    }
});

// Admin Notifications Management
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await Notification.find()
            .populate('event', 'title')
            .populate('createdBy', 'profile.fullName')
            .sort({ createdAt: -1 });

        res.render('admin/notifications', {
            title: 'Notifications Management',
            notifications,
            currentPath: '/admin/notifications'
        });
    } catch (error) {
        console.error('Notifications error:', error);
        req.session.error = 'Error loading notifications';
        res.redirect('/admin/dashboard');
    }
});

// Admin Delete Notification
router.post('/notifications/:id/delete', async (req, res) => {
    try {
        await Notification.findByIdAndDelete(req.params.id);
        req.session.success = 'Notification deleted successfully';
        res.redirect('/admin/notifications');
    } catch (error) {
        console.error('Delete notification error:', error);
        req.session.error = 'Error deleting notification';
        res.redirect('/admin/notifications');
    }
});

// Admin Events with Filter
router.get('/events-filter', async (req, res) => {
    try {
        const { category, eventMode, dateFrom, dateTo, search } = req.query;
        let query = {};

        if (category) query.category = category;
        if (eventMode) query.eventMode = eventMode;
        if (search) query.title = { $regex: search, $options: 'i' };
        if (dateFrom || dateTo) {
            query.date = {};
            if (dateFrom) query.date.$gte = new Date(dateFrom);
            if (dateTo) query.date.$lte = new Date(dateTo);
        }

        const events = await Event.find(query)
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: -1 });

        res.render('admin/events-filter', {
            title: 'Filter Events',
            events,
            filters: { category, eventMode, dateFrom, dateTo, search },
            currentPath: '/admin/events'
        });
    } catch (error) {
        console.error('Events filter error:', error);
        req.session.error = 'Error loading events';
        res.redirect('/admin/events');
    }
});

router.get('/faculty', async (req, res) => {
    try {
        const coordinators = await User.find({
            role: 'faculty',
            isApproved: true
        })
            .select(
                'profile.firstName profile.lastName profile.email profile.department profile.collegeId profile.phone createdAt approvalDate'
            )
            .sort({ approvalDate: -1 });

        res.render('admin/coordinators', {
            title: 'All Coordinator Members',
            coordinators,
            currentPath: '/admin/faculty'
        });
    } catch (error) {
        console.error('Coordinators error:', error);
        res.status(500).send('Error loading coordinators');
    }
});

router.get('/faculty/:id', async (req, res) => {
    try {
        const faculty = await User.findById(req.params.id);
        
        if (!faculty || faculty.role !== 'faculty') {
            return res.status(404).send('Faculty not found');
        }

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

router.post('/events/:id/delete', async (req, res) => {
    try {
        const eventId = req.params.id;
        
        const event = await Event.findByIdAndDelete(eventId);
        
        if (event) {
            req.session.success = 'Event deleted successfully';
            res.redirect('/admin/events');
        } else {
            req.session.error = 'Event not found';
            res.redirect('/admin/events');
        }
    } catch (error) {
        console.error('Delete event error:', error);
        req.session.error = 'Error deleting event';
        res.redirect('/admin/events');
    }
});

router.get('/events/:eventId/department/:departmentName', async (req, res) => {
    try {
        const { eventId, departmentName } = req.params;
        
        const event = await Event.findById(eventId)
            .populate('organizer', 'profile.firstName profile.lastName profile.email');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/admin/dashboard');
        }

        const departmentTeams = event.registrations.filter(
            reg => reg.teamLeaderDepartment && 
                   reg.teamLeaderDepartment.toLowerCase() === decodeURIComponent(departmentName).toLowerCase()
        );

        if (departmentTeams.length === 0) {
            req.session.error = 'No teams found for this department';
            return res.redirect(`/admin/events/${eventId}`);
        }

        res.render('admin/department-teams', {
            title: `${decodeURIComponent(departmentName)} - Team Details`,
            event,
            department: decodeURIComponent(departmentName),
            teams: departmentTeams
        });
    } catch (error) {
        console.error('Department teams view error:', error);
        req.session.error = 'Error loading department teams';
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;
