const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['admin', 'faculty', 'student'],
        required: true
    },
    profile: {
        firstName: {
            type: String,
            required: true
        },
        lastName: {
            type: String,
            required: false,
            default: ''
        },
        fullName: {
            type: String,
            required: true
        },
        collegeId: {
            type: String,
            required: true
        },
        department: {
            type: String,
            required: function() {
                return this.parent().role === 'faculty' || this.parent().role === 'student';
            }
        },
        year: {
            type: String,
            required: function() {
                return this.parent().role === 'student';
            }
        },
        designation: {
            type: String,
            required: function() {
                return this.parent().role === 'faculty';
            }
        },
        phone: String,
        avatar: String,
        verified: {
            type: Boolean,
            default: false
        }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isApproved: {
        type: Boolean,
        default: function() {
            // Students are auto-approved, faculty require admin approval
            if (this.role === 'admin' || this.role === 'student') {
                return true;
            } else if (this.role === 'faculty') {
                return false;
            }
            return false;
        }
    },
    registeredEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }],
    createdEvents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
