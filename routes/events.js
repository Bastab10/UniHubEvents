const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Public events listing (accessible without login)
router.get('/', async (req, res) => {
    try {
        const { category, search } = req.query;
        let query = { 
            status: 'approved', 
            date: { $gte: new Date() } 
        };

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
            .sort({ date: 1 })
            .limit(20);

        res.json(events);
    } catch (error) {
        console.error('Public events error:', error);
        res.status(500).json({ error: 'Error fetching events' });
    }
});

// Event details (public)
router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organizer', 'profile.firstName profile.lastName')
            .populate('registrations.student', 'profile.firstName profile.lastName');

        if (!event || event.status !== 'approved') {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        console.error('Event details error:', error);
        res.status(500).json({ error: 'Error fetching event details' });
    }
});

// Check for time clashes (utility endpoint)
router.post('/check-clash', async (req, res) => {
    try {
        const { date, startTime, endTime, venue, excludeEventId } = req.body;
        
        let query = {
            date: new Date(date),
            $or: [
                { 
                    $and: [
                        { startTime: { $lte: startTime } },
                        { endTime: { $gte: startTime } }
                    ]
                },
                { 
                    $and: [
                        { startTime: { $lte: endTime } },
                        { endTime: { $gte: endTime } }
                    ]
                }
            ],
            status: { $in: ['approved', 'pending'] }
        };

        if (venue) {
            query.venue = venue;
        }

        if (excludeEventId) {
            query._id = { $ne: excludeEventId };
        }

        const clashes = await Event.find(query).populate('organizer', 'profile.firstName profile.lastName');
        
        res.json({ 
            hasClash: clashes.length > 0,
            clashes 
        });
    } catch (error) {
        console.error('Clash check error:', error);
        res.status(500).json({ error: 'Error checking for clashes' });
    }
});

module.exports = router;
