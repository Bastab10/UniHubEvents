const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['seminar', 'workshop', 'cultural', 'sports'],
        required: true
    },
    subCategory: {
        type: String,
        required: function() {
            return this.category === 'sports';
        }
    },
    eventType: {
        type: String,
        enum: ['individual', 'team'],
        default: 'individual'
    },
    maxParticipants: {
        type: Number,
        default: null
    },
    teamSize: {
        type: Number,
        default: 1,
        required: function() {
            return this.eventType === 'team';
        }
    },
    date: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    venue: {
        type: String,
        required: true
    },
    poster: {
        type: String,
        default: null
    },
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    },
    registrations: [{
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        registeredAt: {
            type: Date,
            default: Date.now
        },
        teamName: String,
        teamMembers: [{
            name: String,
            collegeId: String
        }]
    }],
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvalDate: Date,
    rejectionReason: String,
    isCompleted: {
        type: Boolean,
        default: false
    },
    attendanceMarked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
eventSchema.index({ date: 1, startTime: 1, venue: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ organizer: 1 });

module.exports = mongoose.model('Event', eventSchema);
