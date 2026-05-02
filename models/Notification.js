const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    type: {
        type: String,
        enum: ['match_started', 'winner_declared', 'next_match', 'general'],
        default: 'general'
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    teamA: {
        type: String,
        trim: true
    },
    teamB: {
        type: String,
        trim: true
    },
    winner: {
        type: String,
        trim: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

notificationSchema.index({ event: 1, createdAt: -1 });
notificationSchema.index({ isActive: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
