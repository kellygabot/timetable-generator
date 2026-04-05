# TimetableGenerator

> TimetableGenerator uses evolutionary algorithms to build weekly timetables for every class in your school. No manual scheduling. No spreadsheet juggling.

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Status](https://img.shields.io/badge/status-active-brightgreen)]()

---

## Table of Contents

- [About](#about)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running with Docker](#running-with-docker)
- [Usage](#usage)
- [Excel Import](#excel-import)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## About

Building a school timetable by hand is miserable. You're balancing teacher availability, room capacity, subject distribution, and a pile of soft preferences — and if you tweak one slot, something else breaks. TimetableGenerator takes that problem off your plate.

Define your school (grades, sections, subjects, teachers, rooms), set your constraints, and hit **Generate**. Pick an algorithm — Genetic Algorithm for best results, Simulated Annealing if you want it fast, Constraint Programming if you want it deterministic — and get a full weekly timetable for every class, with all conflicts checked.

---

## Key Features

- **Three scheduling algorithms:** Genetic Algorithm (best results), Simulated Annealing (faster), Constraint Programming (deterministic). Swap between them with one click.
- **Multi-class generation:** Schedules all grades and sections at once — no teacher or room ends up double-booked.
- **Excel import/export:** Drop in a `.xlsx` with your teachers, rooms, classes, and subjects. A template is included. Export to CSV when done.
- **Per-day customization:** Different end times and period counts per day work fine — e.g. Wednesday ends at 2:15 PM with one fewer period.
- **Room conflict detection:** Assign rooms per subject or section; double-booking is blocked automatically.
- **Teacher availability:** Mark teachers unavailable or as "prefers not to teach" during specific windows. Violations are flagged and penalized.
- **Freeze & Reroll:** Lock the slots you're satisfied with and reroll only the rest.
- **SHS Block Section Mode:** Grades 11-12 support where students move between subject-specific rooms instead of a homeroom.
- **Same-grade alignment:** All sections in a grade can be forced to cover each subject on the same days (only the period varies).
- **Live conflict report:** Every hard violation, soft preference miss, and availability conflict listed after generation — with location and severity.
- **Teacher view:** Any teacher's full weekly schedule across all classes, in one table.
- **Three UI themes:** Dark professional (`styles.css`), light clean (`v2.css`), print-ready (`ss.css`).

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **npm** v9 or higher
- **Docker** (optional, for containerized deployment)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/kellygabot/timetable-generator.git
cd timetable-generator

# 2. Install dependencies
npm install

# 3. Start the development server
npm start
```

The app will be available at **http://localhost:3000**.

### Running with Docker

```bash
# Build and start the container
docker compose up --build
```

The app is exposed on port **3000**. To change the port, edit `compose.yaml`:

```yaml
ports:
  - "YOUR_PORT:3000"
```

To build for a different CPU architecture (e.g. deploying from an Apple Silicon Mac to an amd64 cloud):

```bash
docker build --platform=linux/amd64 -t timetable-generator .
docker push yourregistry.com/timetable-generator
```

---

## Usage

The app is a single-page UI with a sidebar that walks you through setup in order.

| Step | Panel | What to do |
|---|---|---|
| 1 | **School Setup** | Set school name, days per week, periods per day, break schedule, rooms, and grade levels. |
| 2 | **Import Excel** | Upload a pre-filled `.xlsx` (or click **Download Template** to get started). Alternatively, skip to step 3. |
| 3 | **Teachers** | Add teachers manually, set department, max periods per week, and any unavailability windows. |
| 4 | **Classes & Subjects** | Select each section and add its subjects — code, name, sessions per week, duration, assigned teacher(s), and optional room. |
| 5 | **Constraints** | Toggle hard/soft rules (back-to-back prevention, balance, MAPEH placement, same-day alignment, etc.) and tune penalty weights. |
| 6 | **Generate** | Choose an algorithm, tune its parameters, and click **🚀 Generate All Timetables**. |
| 7 | **Conflicts** | Review every violation. Hard violations must reach 0 for a valid schedule. |
| 8 | **Timetables** | Browse per-class timetables, freeze cells, and reroll unfrozen slots. Export to CSV or print. |
| 9 | **Teacher View** | Review any individual teacher's full weekly schedule. |

**Quick start with demo data:** Click **⚡ Load Demo Data** in the sidebar footer to populate a sample school (Rizal NHS, 5 classes, 10 teachers, 8 rooms) and jump straight to Generate.

---

## Excel Import

Download the template from the **Import Excel** panel. The workbook has four sheets:

| Sheet | Required columns |
|---|---|
| `teachers` | `teacher_id`, `teacher_name` |
| `rooms` | `room_id`, `room_name` |
| `classes` | `grade_level`, `section_name` |
| `subjects` | `grade_level`, `section_name`, `subject_code`, `subject_name`, `periods_per_week`, `duration_minutes`, `teacher_id` |

Optional columns (`department`, `max_periods_per_week`, `capacity`, `type`, `room_id`) are imported when present. The importer reports every missing field, duplicate ID, and unresolved reference before you apply.

---

## Roadmap

- [ ] PDF export for print-ready timetables
- [ ] Drag-and-drop manual slot editing in the timetable view
- [ ] Persistent save/load (JSON export of full school state)
- [ ] Multi-school / multi-campus support
- [ ] Section-level break schedule overrides via UI (currently code-level)
- [ ] Split/combined subject support (e.g. Science split into Biology + Chemistry)
- [ ] Conflict auto-fix suggestions

---

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

Please make sure any new scheduling logic includes a description of its effect on the fitness function.
