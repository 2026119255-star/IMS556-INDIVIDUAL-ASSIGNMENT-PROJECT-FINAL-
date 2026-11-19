# EduTrack - Student Portal

EduTrack is a student portal prototype for IMS566 Advanced Web Design Development and Content Management. Students sign in to view a dashboard, manage courses and tasks, edit their profile, and get help from Ed, a built-in study assistant.

## Quick start

1. Open `login.html` in Google Chrome, or serve the folder with any static server. No build step is needed.
2. Sign in with the demo account: username `student`, password `edutrack123`.
3. Use **Account > Restore sample data** in the menu to reset the demo data.

## Features

| Area | What it does |
|---|---|
| Dashboard | Summary cards (courses, open tasks, completed tasks, average progress), a progress chart sorted highest to lowest, a task breakdown chart, and the five soonest open deadlines |
| Courses | Status filters with live counts, search, sortable columns, course details with sortable tasks, and add, edit and delete |
| Tasks | Status filters with live counts, overdue flags, one-click status changes (Start, Mark done, Reopen), and add, edit and delete |
| Study Chat | Channels for General and each course, quick replies, message search and clear |
| Ask Ed | A floating button on every signed-in page that opens a quick chat panel. It shares history with Study Chat. Answers your own data, today's date, and (optional) live web search |
| Profile | Edit name, email and programme, and change the password |
| Sign in | Sign in, registration, optional auto-save of username and password |
| Themes | Light and dark mode, remembered between visits |

## How the numbers work

These rules apply everywhere in the app, so every page shows the same figures.

**Task progress and status**
- Each task has its own progress from 0% to 100%. Its status follows: 0% is Pending, 1 to 99% is In Progress, and 100% is Completed.
- Start sets a task to 50%, Mark done sets it to 100%, and Reopen sets it back to 0%.

**Course progress and status**
- A course's progress is the average of its tasks' progress.
- A course's status is Completed when every task is Completed, In Progress when any task has started, and Not Started otherwise.
- In **Edit course**, you can set the percent or status directly. The preview shows what will happen. Saving sets every task of that course to the percent, so the course shows exactly the number you typed.
- A course **with no tasks** keeps the percent you type. Its status follows that percent in the same way.

**Live updates**
- Changes appear on every open page straight away. This includes changes made in another browser tab.

**Tasks**
- A task is **overdue** when its due date has passed and it is not completed.
- The Tasks page filter counts, the dashboard's open tasks, and Ed's answers all use the same definition of open: Pending or In Progress.

**Deleting and renaming courses**
- Renaming a course's code moves its tasks to the new code.
- Deleting a course also deletes its tasks. The confirmation message says how many.

## Ask Ed

Ed answers from your own courses and tasks. He does not search the internet or call an AI service, so every answer matches the numbers on the other pages.

Useful commands:

| Command | Result |
|---|---|
| `/next` | Your most urgent open task |
| `/soon` | Overdue tasks and tasks due in the next 7 days |
| `/tasks` | Your open tasks |
| `/progress` | Your progress, or the progress of the current course channel |
| `/courses` | All your courses |
| `/tip` | A short study tip |
| `/help` | The list of commands |

You can also type a course code, such as `IMS501`, or ask questions such as "how do I add a task?" or "how is progress calculated?".

Ed also knows today's date and time from your device, and `/plan` groups your open tasks into Overdue, Due today, This week and Later.

### Live search (optional)

For current news or facts, Ed can look things up online. This needs a small server, set up once. See `ai-proxy/README.md`. Until it is set up, Ed clearly says that live search is not available, and everything else still works.

## One set of numbers

The Dashboard, the Courses page and the Tasks page all read their counts from one summary in the data layer, so they always agree:

| Shown on | Label | Counts |
|---|---|---|
| Dashboard | Courses | all courses, with in progress, completed and not started |
| Dashboard | Tasks open | pending plus in progress, with overdue |
| Dashboard | Tasks completed | completed tasks |
| Courses page | All, In progress, Completed, Not started | the same course counts |
| Courses page | Each course's breakdown, and the line above the list | the same task labels as the Tasks page: Completed, In Progress, Pending |
| Tasks page | All, Pending, In Progress, Completed | the same task counts |

## Mobile

EduTrack works on phones and tablets as well as laptops. Every feature is available on a phone:

- The menu opens from the three-line button at the top.
- Course records become easy-to-read cards, and task filters sit in a 2 by 2 grid.
- Buttons and fields are large enough to tap, and form fields do not zoom in on iPhone.
- The Ask Ed button stays out of the way of the content, and its panel fills the screen width.
- Study Chat shows your messages first, with the course channels as a row you can scroll.

## Running the logic tests

The tests check the rules above without a browser. From the project folder, run:

```
node tests/logic-tests.js
```

Requires Node.js 18 or later. All checks should pass.

## Project structure

```
edutrack/
├── index.html          Dashboard
├── courses.html        Course list and details
├── tasks.html          Task cards
├── chat.html           Study Chat
├── profile.html        Profile and password
├── login.html          Sign in and registration
├── assets/
│   └── logo.svg        Logo and browser tab icon
├── css/
│   └── style.css       Shared styles
├── js/
│   ├── data.js         Sample courses, tasks and the demo account
│   ├── store.js        Data layer: courses, tasks, chat; progress and status rules
│   ├── common.js       Navigation, sign-in check, theme, footer, toasts
│   ├── auth.js         Sign-in, auto-save, registration
│   ├── dashboard.js    Dashboard cards and charts
│   ├── courses.js      Course list, filters, details and form (percent updates tasks)
│   ├── tasks.js        Task cards, filters and form
│   ├── ed.js           Ed: reply engine and the Ask Ed panel
│   ├── chat.js         Study Chat page
│   └── profile.js      Profile and password
├── ai-proxy/
│   ├── worker.js       Optional live search for Ed (runs on Cloudflare)
│   ├── wrangler.toml   Settings for that server
│   └── README.md       Setup guide for live search
└── tests/
    └── logic-tests.js  Automated checks of the rules above
```

## Frameworks and libraries

| Library | Version | Purpose |
|---|---|---|
| Bootstrap | 5.3.3 | Layout, forms, cards, modals, dark mode |
| Bootstrap Icons | 1.11.3 | Interface icons |
| Chart.js | 4.4.1 | Dashboard charts |
| Inter (Google Fonts) | - | Typeface |
| Vanilla JavaScript | ES2020+ | Data, rules, navigation and chat logic |

## Data storage

Data is stored in the browser's `localStorage`, under the keys `edutrack.courses`, `edutrack.tasks` and `edutrack.messages`. The sign-in is also kept in `localStorage`, so new tabs stay signed in until you log out. Changes are saved on this device only and do not sync between devices, but every open tab of this browser updates straight away.

## Limitations

- Sign-in is simulated. Passwords, including auto-saved ones, are stored unencrypted in the browser. This is acceptable for a coursework prototype but not for real use.
- Ed is a rule-based assistant, not a language model. He answers only the questions and commands he is built for.
- Data is per browser.

## Browser

Developed and tested in Google Chrome.
