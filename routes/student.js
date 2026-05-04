const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const User = require('../models/User');
const Result = require('../models/Result');
const Notification = require('../models/Notification');
const { isAuthenticated, checkRole, isApproved, isActive } = require('../middleware/auth');

router.get('/events/:id', isAuthenticated, checkRole('student'), isApproved, isActive, async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName email')
            .populate('registrations.student', 'profile.firstName profile.lastName profile.collegeId');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/events');
        }

        let isRegistered = event.registrations.some(
            reg => reg.student._id.toString() === req.session.user._id.toString()
        );

        let maxDeptTeams = 0;
        let deptTeamsCount = 0;
        let remainingTeamSlots = 0;
        let hasDepartmentTeams = false;
        
        if (event.eventType === 'team') {
            maxDeptTeams = event.maxTeamsPerDepartment || 0;
            
            const student = await User.findById(req.session.user._id);
            const studentDept = student?.profile?.department || '';
            
            if (studentDept && maxDeptTeams > 0) {
                deptTeamsCount = event.registrations.filter(
                    reg => reg.teamLeaderDepartment && 
                           reg.teamLeaderDepartment.toLowerCase() === studentDept.toLowerCase()
                ).length;
                remainingTeamSlots = maxDeptTeams - deptTeamsCount;
                hasDepartmentTeams = deptTeamsCount > 0;
            } else if (maxDeptTeams === 0) {
                remainingTeamSlots = -1;
                hasDepartmentTeams = isRegistered;
            }
        }

        res.render('student/event-details', { 
            title: event.title, 
            event, 
            isRegistered,
            currentUser: req.session.user,
            maxDeptTeams,
            deptTeamsCount,
            remainingTeamSlots
        });
    } catch (error) {
        console.error('Event details error:', error);
        req.session.error = 'Error loading event details';
        res.redirect('/student/events');
    }
});

router.use(isAuthenticated, checkRole('student'), isApproved, isActive);

router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.session.user._id;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const allEvents = await Event.find({ 
            date: { $gte: today }
        })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ createdAt: -1 });
        
        const registeredEvents = await Event.find({
            'registrations.student': studentId,
            'registrations.status': 'approved'
        }).populate('organizer', 'profile.firstName profile.lastName');
        
        const upcomingRegistered = registeredEvents.filter(event => 
            new Date(event.date) >= new Date()
        );
        
        const stats = await Promise.all([
            Event.countDocuments(),
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
            allEvents, 
            upcomingRegistered
        });
    } catch (error) {
        console.error('Student dashboard error:', error);
        req.session.error = 'Error loading dashboard';
        res.render('student/dashboard', { title: 'Student Dashboard' });
    }
});

router.post('/events/:id/register', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/events');
        }

        const studentId = req.session.user._id;

        const exactConflict = await Event.findOne({
            _id: { $ne: req.params.id },
            'registrations.student': studentId,
            'registrations.status': 'approved',
            date: event.date,
            startTime: event.startTime
        });

        if (event.eventType !== 'team') {
            const isAlreadyRegistered = event.registrations.some(
                reg => reg.student.toString() === req.session.user._id.toString()
            );

            if (isAlreadyRegistered) {
                req.session.error = 'You are already registered for this event';
                req.session.eventError = req.params.id;
                return res.redirect(`/student/events/${req.params.id}`);
            }
        }

        if (event.maxParticipants && event.registrations.length >= event.maxParticipants) {
            req.session.error = 'Event is full';
            req.session.eventError = req.params.id;
            return res.redirect(`/student/events/${req.params.id}`);
        }

        if (exactConflict) {
            req.session.error = 'You are already registered for another event at the same time. Please cancel the existing registration to proceed.';
            req.session.eventError = req.params.id; // Track which event this error is for
            return res.redirect(`/student/events/${req.params.id}`);
        }

        const studentPattern = /^\d+(BA|BCA|BSC|BPES)\d{3}$/;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (event.eventType === 'team') {
            const { teams } = req.body;
            
            if (!teams || !Array.isArray(teams) || teams.length === 0) {
                req.session.error = 'At least one team is required for team events';
                return res.redirect(`/student/events/${req.params.id}`);
            }

            const teamsToRegister = [];
            const usedTeamNames = new Set();
            
            for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                
                if (!team.teamName || team.teamName.trim() === '') {
                    req.session.error = `Team ${i + 1}: Team name is required`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                if (!team.teamLeaderName || team.teamLeaderName.trim() === '') {
                    req.session.error = `Team ${i + 1}: Team leader name is required`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                if (!team.teamLeaderCollegeId || team.teamLeaderCollegeId.trim() === '') {
                    req.session.error = `Team ${i + 1}: Team leader college ID is required`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                if (!team.teamLeaderEmail || team.teamLeaderEmail.trim() === '') {
                    req.session.error = `Team ${i + 1}: Team leader email is required`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                if (!studentPattern.test(team.teamLeaderCollegeId.trim().toUpperCase())) {
                    req.session.error = `Team ${i + 1}: Invalid Team Leader College ID format. Use format: YEAR + COURSE + 3 digits (e.g., 23BA123, 24BCA456)`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                if (!emailPattern.test(team.teamLeaderEmail.trim())) {
                    req.session.error = `Team ${i + 1}: Invalid Team Leader Email format`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                const teamNameLower = team.teamName.trim().toLowerCase();
                if (usedTeamNames.has(teamNameLower)) {
                    req.session.error = `Team ${i + 1}: Duplicate team name "${team.teamName}". Each team must have a unique name.`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }
                usedTeamNames.add(teamNameLower);

                const existingTeam = event.registrations.find(
                    reg => reg.teamName && reg.teamName.toLowerCase() === teamNameLower
                );
                if (existingTeam) {
                    req.session.error = `Team ${i + 1}: Team name "${team.teamName}" already exists for this event.`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                let teamMembers = [];
                if (team.members && Array.isArray(team.members)) {
                    for (const member of team.members) {
                        if (member && member.name && member.collegeId) {
                            const memberCollegeId = member.collegeId.trim();
                            if (!studentPattern.test(memberCollegeId.toUpperCase())) {
                                req.session.error = `Team ${i + 1}: Invalid College ID format for member "${member.name}". Use format: YEAR + COURSE + 3 digits (e.g., 23BA123, 24BCA456)`;
                                return res.redirect(`/student/events/${req.params.id}`);
                            }
                            teamMembers.push({
                                name: member.name.trim(),
                                collegeId: memberCollegeId
                            });
                        }
                    }
                }

                const userDepartment = req.session.user.profile?.department || req.session.user.department || '';

                teamsToRegister.push({
                    teamName: team.teamName.trim(),
                    teamLeaderName: team.teamLeaderName.trim(),
                    teamLeaderCollegeId: team.teamLeaderCollegeId.trim(),
                    teamLeaderEmail: team.teamLeaderEmail.trim(),
                    teamLeaderDepartment: userDepartment,
                    teamMembers: teamMembers
                });
            }

            if (event.maxTeamsPerDepartment && event.maxTeamsPerDepartment > 0) {
                const firstDept = teamsToRegister[0].teamLeaderDepartment.toLowerCase();
                const currentDeptCount = event.registrations.filter(
                    reg => reg.teamLeaderDepartment && reg.teamLeaderDepartment.toLowerCase() === firstDept
                ).length;
                
                if (currentDeptCount + teamsToRegister.length > event.maxTeamsPerDepartment) {
                    const allowed = event.maxTeamsPerDepartment - currentDeptCount;
                    req.session.error = `Maximum team limit reached. You can only register ${allowed} more team(s) from your department.`;
                    req.session.eventError = req.params.id;
                    return res.redirect(`/student/events/${req.params.id}`);
                }
            }

            const registeredTeams = [];
            for (const team of teamsToRegister) {
                const registrationData = {
                    student: req.session.user._id,
                    status: 'approved',
                    registeredAt: new Date(),
                    approvalDate: new Date(),
                    teamName: team.teamName,
                    teamLeaderName: team.teamLeaderName,
                    teamLeaderCollegeId: team.teamLeaderCollegeId,
                    teamLeaderEmail: team.teamLeaderEmail,
                    teamLeaderDepartment: team.teamLeaderDepartment,
                    teamMembers: team.teamMembers
                };
                event.registrations.push(registrationData);
                registeredTeams.push(team.teamName);
            }

            await event.save();
            
            let successMessage = `Successfully registered ${registeredTeams.length} team(s)`;
            if (event.maxTeamsPerDepartment && event.maxTeamsPerDepartment > 0) {
                const firstDept = teamsToRegister[0].teamLeaderDepartment.toLowerCase();
                const updatedDeptCount = event.registrations.filter(
                    reg => reg.teamLeaderDepartment && reg.teamLeaderDepartment.toLowerCase() === firstDept
                ).length;
                const remainingSlots = event.maxTeamsPerDepartment - updatedDeptCount;
                
                if (remainingSlots > 0) {
                    successMessage += `. You can register ${remainingSlots} more team(s) from your department.`;
                } else {
                    successMessage += `. Your department has reached the maximum limit of ${event.maxTeamsPerDepartment} teams.`;
                }
            }
            
            req.session.success = successMessage;
            req.session.eventSuccess = req.params.id;
            return res.redirect(`/student/events/${req.params.id}`);
        }

        const registrationData = {
            student: req.session.user._id,
            status: 'approved',
            registeredAt: new Date(),
            approvalDate: new Date()
        };

        event.registrations.push(registrationData);
        await event.save();

        req.session.success = 'Registration successful';
        req.session.eventSuccess = req.params.id;
        res.redirect(`/student/events/${req.params.id}`);
    } catch (error) {
        console.error('Event registration error:', error);
        req.session.error = 'Error registering for event';
        res.redirect('/student/events');
    }
});

router.get('/registrations', async (req, res) => {
    try {
        const studentId = req.session.user._id;

        const events = await Event.find({ 'registrations.student': studentId })
            .populate('organizer', 'profile.firstName profile.lastName')
            .sort({ date: 1 });

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

router.post('/registrations/:eventId/cancel', async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        
        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/registrations');
        }

        const registrationIndex = event.registrations.findIndex(
            reg => reg.student.toString() === req.session.user._id.toString()
        );

        if (registrationIndex === -1) {
            req.session.error = 'Registration not found';
            return res.redirect('/student/registrations');
        }

        event.registrations.splice(registrationIndex, 1);
        await event.save();

        req.session.success = 'Registration cancelled successfully';
        req.session.eventSuccess = req.params.eventId;
        res.redirect(`/student/events/${req.params.eventId}`);
    } catch (error) {
        console.error('Cancel registration error:', error);
        req.session.error = 'Error cancelling registration';
        res.redirect(`/student/events/${req.params.eventId}`);
    }
});

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

router.get('/past-events', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const pastEvents = await Event.find({ 
            date: { $lt: today }
        })
        .populate('organizer', 'profile.firstName profile.lastName')
        .sort({ date: -1 });

        const eventsWithResultStatus = await Promise.all(
            pastEvents.map(async (event) => {
                const result = await Result.findOne({ event: event._id });
                return {
                    ...event.toObject(),
                    hasResult: !!result
                };
            })
        );
        
        res.render('student/past-events', { 
            title: 'Past Events', 
            events: eventsWithResultStatus,
            isPastEvents: true
        });
    } catch (error) {
        console.error('Past events error:', error);
        req.session.error = 'Error loading past events';
        res.redirect('/student/dashboard');
    }
});

router.get('/profile', (req, res) => {
    res.render('student/profile', { title: 'My Profile' });
});

router.get('/events/:id/result', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName profile.department');

        if (!event) {
            req.session.error = 'Event not found';
            return res.redirect('/student/past-events');
        }

        const result = await Result.findOne({ event: req.params.id });

        res.render('student/view-result', {
            title: `Result - ${event.title}`,
            event,
            result,
            coordinator: event.organizer
        });
    } catch (error) {
        console.error('View result error:', error);
        req.session.error = 'Error loading result';
        res.redirect('/student/past-events');
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
        res.redirect('/student/profile');
    } catch (error) {
        console.error('Update profile error:', error);
        req.session.error = 'Error updating profile';
        res.redirect('/student/profile');
    }
});

router.get('/notifications', async (req, res) => {
    try {
        const userId = req.session.user._id;
        
        const user = await User.findById(userId);
        const registeredEventIds = user.registeredEvents || [];
        
        const teamEvents = await Event.find({
            'registrations.student': userId,
            eventType: 'team'
        }).select('_id');
        
        const teamEventIds = teamEvents.map(e => e._id.toString());
        
        const allEventIds = [...new Set([...registeredEventIds.map(id => id.toString()), ...teamEventIds])];
        
        if (allEventIds.length === 0) {
            return res.json({ success: true, notifications: [] });
        }
        
        const notifications = await Notification.find({
            event: { $in: allEventIds },
            isActive: true
        })
        .sort({ createdAt: -1 })
        .populate('event', 'title category');
        
        const latestPerEventType = new Map();
        notifications.forEach(n => {
            const eventId = n.event?._id?.toString() || n.event?.toString();
            const type = n.type || 'general';
            const key = `${eventId}_${type}`;
            if (eventId && !latestPerEventType.has(key)) {
                latestPerEventType.set(key, n);
            }
        });
        
        const latestNotifications = Array.from(latestPerEventType.values());
        
        res.json({ success: true, notifications: latestNotifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.json({ success: false, message: 'Error fetching notifications' });
    }
});

router.get('/events/:eventId/notifications', async (req, res) => {
    try {
        const { eventId } = req.params;
        const userId = req.session.user._id;
        
        const user = await User.findById(userId);
        const isRegistered = user.registeredEvents && user.registeredEvents.includes(eventId);
        
        if (!isRegistered) {
            return res.json({ success: false, message: 'Not registered for this event' });
        }
        
        const notifications = await Notification.find({
            event: eventId,
            isActive: true
        })
        .sort({ createdAt: -1 })
        .limit(50);
        
        res.json({ success: true, notifications });
    } catch (error) {
        console.error('Error fetching event notifications:', error);
        res.json({ success: false, message: 'Error fetching notifications' });
    }
});

module.exports = router;
