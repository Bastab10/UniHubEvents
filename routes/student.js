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
        // For individual events: block if already registered
        // For team events: show as registered but allow multiple teams (up to department limit)
        let isRegistered = event.registrations.some(
            reg => reg.student._id.toString() === req.session.user._id.toString()
        );

        // Calculate department team counts for team events
        let maxDeptTeams = 0;
        let deptTeamsCount = 0;
        let remainingTeamSlots = 0;
        let hasDepartmentTeams = false;
        
        if (event.eventType === 'team') {
            maxDeptTeams = event.maxTeamsPerDepartment || 0;
            
            // Get student's department from their profile
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
                // Unlimited teams
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

// All other student routes require authentication and student role
router.use(isAuthenticated, checkRole('student'), isApproved, isActive);

// Dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const studentId = req.session.user._id;
        
        // Get today's date at midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get all approved events that are active (date >= today)
        const allEvents = await Event.find({ 
            status: 'approved',
            date: { $gte: today }
        })
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

        // Check if already registered (for individual events only)
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

        // Check if event is full
        if (event.maxParticipants && event.registrations.length >= event.maxParticipants) {
            req.session.error = 'Event is full';
            req.session.eventError = req.params.id;
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
            req.session.error = 'You are already registered for another event at the same time. Please cancel the existing registration to proceed.';
            req.session.eventError = req.params.id; // Track which event this error is for
            return res.redirect(`/student/events/${req.params.id}`);
        }

        // Handle team registration (bulk support)
        const studentPattern = /^\d+(BA|BCA|BSC|BPES)\d{3}$/;
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (event.eventType === 'team') {
            const { teams } = req.body;
            
            if (!teams || !Array.isArray(teams) || teams.length === 0) {
                req.session.error = 'At least one team is required for team events';
                return res.redirect(`/student/events/${req.params.id}`);
            }

            // Validate all teams first
            const teamsToRegister = [];
            const usedTeamNames = new Set();
            
            for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                
                // Validate required fields
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

                if (!team.teamLeaderDepartment || team.teamLeaderDepartment.trim() === '') {
                    req.session.error = `Team ${i + 1}: Team leader department is required`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                // Validate formats
                if (!studentPattern.test(team.teamLeaderCollegeId.trim().toUpperCase())) {
                    req.session.error = `Team ${i + 1}: Invalid Team Leader College ID format. Use format: YEAR + COURSE + 3 digits (e.g., 23BA123, 24BCA456)`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                if (!emailPattern.test(team.teamLeaderEmail.trim())) {
                    req.session.error = `Team ${i + 1}: Invalid Team Leader Email format`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                // Check for duplicate team names
                const teamNameLower = team.teamName.trim().toLowerCase();
                if (usedTeamNames.has(teamNameLower)) {
                    req.session.error = `Team ${i + 1}: Duplicate team name "${team.teamName}". Each team must have a unique name.`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }
                usedTeamNames.add(teamNameLower);

                // Check for existing team names in event
                const existingTeam = event.registrations.find(
                    reg => reg.teamName && reg.teamName.toLowerCase() === teamNameLower
                );
                if (existingTeam) {
                    req.session.error = `Team ${i + 1}: Team name "${team.teamName}" already exists for this event.`;
                    return res.redirect(`/student/events/${req.params.id}`);
                }

                // Process team members
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

                teamsToRegister.push({
                    teamName: team.teamName.trim(),
                    teamLeaderName: team.teamLeaderName.trim(),
                    teamLeaderCollegeId: team.teamLeaderCollegeId.trim(),
                    teamLeaderEmail: team.teamLeaderEmail.trim(),
                    teamLeaderDepartment: team.teamLeaderDepartment.trim(),
                    teamMembers: teamMembers
                });
            }

            // Check department team limit
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

            // Create registration data for each team
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
            
            // Success message
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

        // Handle individual registration
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

        req.session.success = 'Registration cancelled successfully';
        req.session.eventSuccess = req.params.eventId; // Track which event this success message is for
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

// Past Events - All completed events
router.get('/past-events', async (req, res) => {
    try {
        // Get today's date at midnight for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Get all past events (date < today - strictly before today)
        const pastEvents = await Event.find({ 
            status: 'approved',
            date: { $lt: today }
        })
        .populate('organizer', 'profile.firstName profile.lastName')
        .sort({ date: -1 }); // Most recent first
        
        res.render('student/past-events', { 
            title: 'Past Events', 
            events: pastEvents,
            isPastEvents: true
        });
    } catch (error) {
        console.error('Past events error:', error);
        req.session.error = 'Error loading past events';
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
        const { fullName, phone } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            'profile.fullName': fullName,
            'profile.phone': phone
        });

        // Update session user data
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

module.exports = router;
