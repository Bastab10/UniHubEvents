const mongoose = require('mongoose');

const departmentPointsSchema = new mongoose.Schema({
    department: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    totalPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    eventBreakdown: [{
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event'
        },
        eventTitle: String,
        points: Number,
        position: String,
        date: {
            type: Date,
            default: Date.now
        }
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('DepartmentPoints', departmentPointsSchema);
