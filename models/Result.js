const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
        unique: true
    },
    coordinator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    firstPosition: {
        name: { type: String, required: true },
        department: { type: String, default: '' },
        collegeId: { type: String, default: '' }
    },
    secondPosition: {
        name: { type: String, required: true },
        department: { type: String, default: '' },
        collegeId: { type: String, default: '' }
    },
    thirdPosition: {
        name: { type: String, required: true },
        department: { type: String, default: '' },
        collegeId: { type: String, default: '' }
    },
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Result', resultSchema);
