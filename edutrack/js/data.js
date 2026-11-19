/**
 * data.js - Content layer for EduTrack.
 *
 * All portal content lives in this file so it can be edited without touching
 * any page markup. Every record carries metadata (id, tags, lastUpdated) to
 * demonstrate structured content organisation.
 */
const EDUTRACK_DATA = {

  site: {
    name: 'EduTrack',
    lastUpdated: '2026-11-12'
  },

  // Ed's live search (optional). Paste the URL of your deployed proxy here.
  // See ai-proxy/README.md. Leave empty to use only the app's own data.
  ai: { endpoint: '' },

  auth: {
    // Hardcoded demo credentials (permitted by the brief: no database required)
    demoUsers: [
      { username: 'student', password: 'edutrack123', fullName: 'Student', email: 'student@edutrack.example', programme: 'BSc (Hons) Information Systems' }
    ]
  },

  courses: [
    {
      id: 'c-ims566', code: 'IMS566', title: 'Advanced Web Design Development and Content Management',
      lecturer: 'Course Lecturer', credits: 3, progress: 70, status: 'In Progress',
      tags: ['web', 'design', 'cms'], lastUpdated: '2026-11-10'
    },
    {
      id: 'c-ims501', code: 'IMS501', title: 'Database Management Systems',
      lecturer: 'Course Lecturer', credits: 3, progress: 85, status: 'In Progress',
      tags: ['database', 'sql'], lastUpdated: '2026-11-08'
    },
    {
      id: 'c-ims512', code: 'IMS512', title: 'Human-Computer Interaction',
      lecturer: 'Course Lecturer', credits: 3, progress: 100, status: 'Completed',
      tags: ['ux', 'usability'], lastUpdated: '2026-10-30'
    },
    {
      id: 'c-ims540', code: 'IMS540', title: 'Data Analytics and Visualisation',
      lecturer: 'Course Lecturer', credits: 3, progress: 40, status: 'In Progress',
      tags: ['data', 'analytics', 'charts'], lastUpdated: '2026-11-09'
    },
    {
      id: 'c-ims575', code: 'IMS575', title: 'Information Systems Project Management',
      lecturer: 'Course Lecturer', credits: 2, progress: 0, status: 'Not Started',
      tags: ['project', 'agile'], lastUpdated: '2026-11-01'
    }
  ],

  tasks: [
    {
      id: 't-01', title: 'Individual project: EduTrack prototype', course: 'IMS566',
      due: '2026-11-28', priority: 'High', status: 'In Progress'
    },
    {
      id: 't-02', title: 'Responsive design quiz', course: 'IMS566',
      due: '2026-11-16', priority: 'Medium', status: 'Pending'
    },
    {
      id: 't-03', title: 'Entity-relationship diagram', course: 'IMS501',
      due: '2026-11-18', priority: 'High', status: 'In Progress'
    },
    {
      id: 't-04', title: 'Usability test report', course: 'IMS512',
      due: '2026-11-09', priority: 'Low', status: 'Completed'
    },
    {
      id: 't-05', title: 'Survey dataset cleaning', course: 'IMS540',
      due: '2026-11-20', priority: 'Medium', status: 'Pending'
    },
    {
      id: 't-06', title: 'Project charter draft', course: 'IMS575',
      due: '2026-11-23', priority: 'Medium', status: 'Pending'
    },
    {
      id: 't-07', title: 'Dashboard wireframe', course: 'IMS566',
      due: '2026-11-13', priority: 'High', status: 'Completed'
    }
  ]
};
