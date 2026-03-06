const mongoose = require('mongoose');

const sportSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: String,
    category: {
        type: String,
        enum: ['indoor', 'outdoor', 'team', 'individual'],
        required: true
    },
    maxTeamSize: {
        type: Number,
        default: 1
    },
    minTeamSize: {
        type: Number,
        default: 1
    },
    equipment: [String],
    rules: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Sport', sportSchema);
