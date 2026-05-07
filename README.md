# College Event & Versity Week Management System

A comprehensive web-based platform for managing college events, sports competitions, student registrations, and department leaderboards with role-based access for **Admin**, **Faculty (Coordinators)**, and **Students**.

---

## 🌟 Key Features

### For Admin
| Feature | Description |
|---------|-------------|
| **Dashboard** | Key statistics: Total Students, Faculty, Events, Pending Registrations |
| **Students** | View all students, view profiles & registrations, block/unblock |
| **Events** | View all events, filter by category/date, delete events |
| **Results** | View all results, edit results, delete results |
| **Leaderboard** | Department rankings with Top 3 podium, event-wise breakdown |
| **Reports** | Analytics: category-wise events, registration status, department stats |
| **Notifications** | View and delete system notifications |
| **Past Events** | View completed events archive |

### For Faculty (Event Coordinators)
| Feature | Description |
|---------|-------------|
| **Dashboard** | View created events, pending registrations, statistics |
| **Create Events** | Create events with title, description, category, type, schedule |
| **Event Types** | Individual or Team (Knockout / Ranking format) |
| **Event Modes** | Normal Day Event or Versity Week Event |
| **Manage Registrations** | Approve/reject student registrations |
| **Upload Results** | Declare 1st, 2nd, 3rd position winners |
| **Live Updates** | Real-time match notifications for knockout events |
| **Profile** | View and update personal information |

### For Students
| Feature | Description |
|---------|-------------|
| **Dashboard** | Browse available events, live updates |
| **Event Registration** | Register for individual or team events |
| **My Registrations** | Track registration status (pending/approved/rejected) |
| **Past Events** | View completed events and results |
| **Leaderboard** | View Versity Week department rankings |
| **Profile** | Update personal information (Full Name editable) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB (Mongoose ODM) |
| **Sessions** | Express Session with MongoDB Store |
| **Auth** | Bcryptjs (password hashing) |
| **Uploads** | Multer + Cloudinary |
| **Validation** | Express Validator |
| **Templating** | EJS |
| **Styling** | Tailwind CSS + Font Awesome |
| **Dev Tools** | Nodemon, Dotenv |

---

## 📁 Project Structure

```
UniHunEvent/
├── config/
│   └── cloudinary.js          # Cloudinary image upload config
├── middleware/
│   └── auth.js                # Authentication & authorization middleware
├── models/
│   ├── User.js                # User schema (admin, faculty, student)
│   ├── Event.js               # Event schema with registrations
│   ├── Result.js              # Event results (1st, 2nd, 3rd positions)
│   ├── Notification.js        # Live match notifications
│   └── DepartmentPoints.js    # Versity Week leaderboard tracking
├── routes/
│   ├── auth.js                # Login, register, logout
│   ├── admin.js               # Admin panel routes
│   ├── faculty.js             # Faculty/coordinator routes
│   ├── student.js             # Student routes
│   └── events.js              # Public event browsing
├── scripts/
│   └── seed.js                # Database seeding script
├── public/
│   ├── css/                   # Custom stylesheets
│   └── js/                    # Client-side scripts
├── views/
│   ├── admin/                 # Admin panel views
│   ├── faculty/               # Faculty panel views
│   ├── student/               # Student panel views
│   ├── auth/                  # Login/register pages
│   ├── partials/              # Reusable components
│   │   ├── header.ejs         # Navigation header
│   │   ├── sidebar.ejs        # Sidebar navigation
│   │   └── footer.ejs         # Page footer
│   ├── home.ejs               # Landing page
│   ├── about.ejs              # About page
│   ├── contact.ejs            # Contact page
│   └── error.ejs              # Error page
├── .env                       # Environment variables
├── server.js                  # Main application entry
└── package.json               # Dependencies
```

---

## 🚀 Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas cloud)
- npm

### Step-by-Step Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd UniHunEvent

# 2. Install dependencies
npm install

# 3. Create .env file
cat > .env << 'EOF'
PORT=8080
MONGODB_URI=mongodb://localhost:27017/college-events
SESSION_SECRET=your-super-secret-key-change-this
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
EOF

# 4. Start MongoDB (if local)
mongod

# 5. Run application
npm run dev     # Development mode with auto-restart
npm start       # Production mode

# 6. Seed database (optional)
npm run seed
```

Access the application at `http://localhost:8080`

---

## 👥 User Roles & Access

### Admin
- **Access**: Full system control
- **Registration**: First admin via database or direct registration
- **Permissions**: Manage all users, events, results, leaderboard, reports

### Faculty (Event Coordinators)
- **Access**: Event creation and management
- **Registration**: Register and wait for admin approval
- **Permissions**: Create events, manage registrations, upload results, send notifications

### Student
- **Access**: Event browsing and registration
- **Registration**: Direct registration (auto-approved)
- **College ID Format**: `YYCourseRollNo` (e.g., `23BA123`)
  - `YY` = Admission year (2 digits)
  - `Course` = BA, BCA, BSC, BPES, etc.
  - `RollNo` = 3 digits
- **Permissions**: Browse events, register, view results and leaderboard

---

## 📊 Database Models

### User
```javascript
{
  username: String,
  email: String,
  password: String (hashed),
  role: String,              // 'admin' | 'faculty' | 'student'
  isActive: Boolean,
  isApproved: Boolean,
  profile: {
    firstName: String,
    lastName: String,
    fullName: String,
    collegeId: String,
    department: String,
    year: Number,
    designation: String,     // For faculty
    phone: String,
    avatar: String            // Cloudinary URL
  },
  registeredEvents: [ObjectId],  // For students
  createdEvents: [ObjectId]      // For faculty
}
```

### Event
```javascript
{
  title: String,
  description: String,
  category: String,          // seminar, workshop, hackathon, quiz, etc.
  eventMode: String,         // 'normal' | 'versity'
  eventType: String,         // 'individual' | 'team'
  eventFormat: String,       // 'knockout' | 'ranking' (for team events)
  date: Date,
  startTime: String,
  endTime: String,
  venue: String,
  maxParticipants: Number,
  teamSize: Number,
  maxTeamsPerDepartment: Number,
  poster: String,            // Cloudinary URL
  organizer: ObjectId,         // Faculty reference
  registrations: [{
    student: ObjectId,
    status: String,          // 'pending' | 'approved' | 'rejected'
    teamMembers: [String],
    registeredAt: Date
  }],
  isCompleted: Boolean
}
```

### Result
```javascript
{
  event: ObjectId,
  coordinator: ObjectId,
  firstPosition: {
    name: String,
    department: String,
    collegeId: String,
    points: Number           // Optional custom points
  },
  secondPosition: { /* same structure */ },
  thirdPosition: { /* same structure */ },
  uploadedAt: Date
}
```

### DepartmentPoints
```javascript
{
  department: String,
  totalPoints: Number,
  eventBreakdown: [{
    event: ObjectId,
    eventTitle: String,
    points: Number,
    position: String,         // 'first' | 'second' | 'third'
    date: Date
  }],
  lastUpdated: Date
}
```

### Notification
```javascript
{
  event: ObjectId,
  type: String,              // 'match_started' | 'winner_declared' | 'next_match'
  message: String,
  teamA: String,
  teamB: String,
  winner: String,
  createdBy: ObjectId,
  isActive: Boolean,
  createdAt: Date
}
```

---

## 🏆 Versity Week Leaderboard System

### Scoring Rules
| Position | Points |
|----------|--------|
| 1st Place | 10 pts |
| 2nd Place | 7 pts |
| 3rd Place | 5 pts |

### Auto-Update Behavior
- **Result Created** → Points added to departments automatically
- **Result Edited** → Old points removed, new points recalculated
- **Result Deleted** → Points removed from departments
- **Only Versity Week events** affect the leaderboard

### Features
- Top 3 departments highlighted on podium
- Complete rankings with tie handling
- Event-wise breakdown per department
- Student's department auto-highlighted

---

## 🔐 Authentication & Authorization

| Middleware | Purpose |
|------------|---------|
| `isAuthenticated` | Checks if user is logged in |
| `checkRole(...roles)` | Validates user role access |
| `isApproved` | Ensures faculty is approved by admin |
| `isActive` | Checks if user account is active (not blocked) |

---

## 🔧 Complete API Routes

### Authentication (`/auth`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/login` | Login page |
| POST | `/login` | Authenticate user |
| GET | `/register` | Registration page |
| POST | `/register` | Create new account |
| GET | `/logout` | End session |

### Admin (`/admin`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Admin dashboard with statistics |
| GET | `/students` | All students list |
| GET | `/students/:id` | Student details |
| POST | `/students/:id/block` | Block student |
| POST | `/students/:id/unblock` | Unblock student |
| GET | `/faculty` | Faculty management |
| POST | `/faculty/:id/approve` | Approve faculty |
| POST | `/faculty/:id/reject` | Reject faculty |
| GET | `/events` | All events list |
| GET | `/events/:id` | Event details |
| POST | `/events/:id/delete` | Delete event |
| GET | `/events-filter` | Filter events |
| GET | `/results` | All results |
| GET | `/results/:id/edit` | Edit result form |
| POST | `/results/:id/edit` | Update result |
| POST | `/results/:id/delete` | Delete result |
| GET | `/leaderboard` | Department rankings |
| GET | `/leaderboard/department/:name` | Department details |
| GET | `/reports` | Analytics & reports |
| GET | `/notifications` | All notifications |
| POST | `/notifications/:id/delete` | Delete notification |
| GET | `/past-events` | Completed events |
| GET | `/registrations-management` | Manage registrations |
| POST | `/registrations/bulk-approve` | Bulk approve |
| POST | `/registrations/bulk-reject` | Bulk reject |

### Faculty (`/faculty`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Faculty dashboard |
| GET | `/events/create` | Create event form |
| POST | `/events/create` | Create new event |
| GET | `/events/:id` | View event details |
| GET | `/events/:id/edit` | Edit event form |
| POST | `/events/:id/edit` | Update event |
| GET | `/events/:id/students` | Registered students |
| POST | `/events/:id/registrations/:regId/approve` | Approve registration |
| POST | `/events/:id/registrations/:regId/reject` | Reject registration |
| POST | `/events/:id/notifications/:type` | Send notification |
| GET | `/upload-result` | Upload result form |
| POST | `/upload-result` | Submit results |
| GET | `/results/:id/edit` | Edit result form |
| POST | `/results/:id/edit` | Update result |
| POST | `/results/:id/delete` | Delete result |
| GET | `/profile` | View profile |
| POST | `/profile` | Update profile |

### Student (`/student`)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Student dashboard |
| GET | `/events/:id` | View event details |
| POST | `/events/:id/register` | Register for event |
| GET | `/registrations` | My registrations |
| GET | `/past-events` | Past events |
| GET | `/leaderboard` | View leaderboard |
| GET | `/leaderboard/department/:name` | Department performance |
| GET | `/profile` | View profile |
| POST | `/profile` | Update profile (Full Name only) |

---

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-friendly with Tailwind CSS
- **Single Layout**: Consistent sidebar + header across all admin pages
- **Flash Messages**: Success/error notifications for user actions
- **Form Validation**: Both client-side and server-side validation
- **Image Uploads**: Cloudinary integration for event posters
- **Real-time Notifications**: Live match updates for knockout events
- **Interactive Tables**: Sortable and filterable data tables
- **Charts & Analytics**: Visual reports and statistics

---

## 📝 Event Categories

- Seminar
- Workshop
- Hackathon
- Quiz
- Talk Show
- Bootcamp
- Cultural
- Sports

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB connection error | Ensure MongoDB is running; check `MONGODB_URI` in `.env` |
| Session expired | Clear browser cookies; check `SESSION_SECRET` |
| Image upload fails | Verify Cloudinary credentials in `.env` |
| College ID rejected | Students: `YYCourseRollNo` format; Faculty: `FAC001` format |
| Port already in use | Change `PORT` in `.env` or kill existing process |

---

## 📄 License

MIT License

## 👨‍💻 Authors

College Management Team

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -m 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📞 Support

For support, contact the development team or create an issue in the repository.
