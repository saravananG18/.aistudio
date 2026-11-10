# Authenticator Bus Fleet Expansion, Dual Departure Windows & Driver Boarding Reminders

Expand the CIT Booker platform to empower the Transport Authenticator and Administrator to add new buses with flexible routes, update campus departure schedules to 3:30 PM and 4:30 PM closing batches, provide expandable bus audit rows displaying booked vs. boarded metrics, and equip drivers with a dedicated reminder dispatch modal for unboarded passengers.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and user experience decisions have been aligned based on your responses:
> - **Driver Reminder Flow**: Clicking "Send Reminders" will open a pre-dispatch confirmation modal that explicitly lists all unboarded students with their seat numbers, student roll numbers, and recipient emails before sending the automated Gmail reminders.
> - **Campus Departure Batches**: Campus shuttle schedules are standardized around two primary closing batches: **3:30 PM** (Early Departure Batch) and **4:30 PM** (Standard College Closing Batch).
> - **Administrator Bus Audit**: When an administrator opens a bus in the console, an expandable row dynamically reveals real-time metrics for capacity, total seats booked, total passengers boarded, pending passengers, and the live passenger manifest.

---

## 1. Overview & Core Concept

CIT Booker is the official campus transport reservation and verification system for Chennai Institute of Technology. This upgrade delivers four essential operational capabilities:

1. **Authenticator Bus & Route Creation**:
   - The Authenticator/Admin can register new buses and associate them with existing or newly created route stops.
   - When a bus and route are published, they instantly appear across all student and driver dashboards for seat reservations and manifest scanning.
2. **Official College Closing Departure Timings (3:30 PM & 4:30 PM)**:
   - Replaces older placeholder timings with the official CIT departure windows: **3:30 PM** and **4:30 PM**.
   - Added quick filter tags on student dashboards to toggle between 3:30 PM and 4:30 PM departure batches.
3. **Administrator Bus Inspection (Expandable Table Row)**:
   - Administrators can click any bus card or row to expand an in-place telemetry drawer showing total capacity, seats booked, passengers boarded, and passengers pending boarding.
4. **Driver Boarding Reminders**:
   - Drivers scanning passengers at parking bays can click **"Send Reminders"** to trigger urgent intimations to booked students who have not yet boarded, with a pre-dispatch review modal.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: Authenticator Adds New Bus & Route
1. The Authenticator opens the **Transport Administration Console** and clicks **"Bus Fleet"** or **"Daily Map (Auth)"**.
2. Inside the "Add New Bus & Route" form, the Authenticator enters the Bus Number (which acts as the route identifier), bus nickname/chassis type, seating capacity (default 32 in 2x2 layout), route selection, parking bay, and initial departure batch (3:30 PM or 4:30 PM).
3. Upon clicking **"Publish Bus to Campus Fleet"**, the bus immediately becomes active, receives an interactive 2x2 coach layout, and is visible on student booking screens and driver consoles.

#### Flow B: Administrator Inspects Bus Booked & Boarded Stats
1. In the Admin Portal's **Bus Fleet** or **Trips** tab, each bus row displays a clean summary bar.
2. The Administrator clicks the bus row or **"Inspect Status"** chevron.
3. The row smoothly expands into an audit view displaying:
   - Seating Telemetry: Total Capacity (32), Booked Seats (e.g. 26/32), Boarded Passengers (e.g. 19/26), and Not Boarded (7 pending).
   - Visual progress bars comparing booked percentage vs. actual boarding percentage.
   - Comprehensive manifest of booked students with seat numbers, verification stamps, and boarding status tags.

#### Flow C: Driver Dispatches Boarding Reminders
1. As departure time approaches, the Driver in **Driver Scanner Console** views their live manifest.
2. If passengers remain unboarded, the **"Send Reminders"** button highlights with the pending count (e.g., *"Send Reminders (5 Pending)"*).
3. Clicking opens the **Unboarded Passengers Review Modal**:
   - Lists all students who have confirmed bookings but have not yet had their QR scanned.
   - Shows seat number, student name, ID number, and target email.
   - Allows driver to preview the email subject and departure warning.
   - Driver clicks **"Send Urgent Boarding Reminders"**; the system dispatches personalized emails via the connected Gmail integration and logs each sent notice.

---

## 3. Key Product Decisions & Trade-Offs

| Decision | Chosen Approach | Rationale |
| :--- | :--- | :--- |
| **Reminder Delivery** | Pre-dispatch confirmation modal | Prevents accidental mass emails and gives drivers confidence by showing exactly who is receiving reminders. |
| **Departure Timings** | Dual batches (3:30 PM & 4:30 PM) | Reflects real CIT campus closing routines where early lab students depart at 3:30 PM and regular classes depart at 4:30 PM. |
| **Bus Inspection UI** | Expandable in-place table row | Keeps the administrator in context without navigating away or managing nested popup layers. |
| **Bus-to-Route Relationship** | Route number equals bus number | Consistent with campus conventions established in previous updates. |

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CIT Booker Architecture                         │
└────────────────────────────────────────────────────────────────────────┘

 [ Transport Authenticator / Admin ]         [ Driver Scanner Console ]
                │                                         │
   Create Bus / Assign Route / Timings           Send Reminders Modal
                ▼                                         ▼
 ┌─────────────────────────────┐           ┌─────────────────────────────┐
 │ POST /api/buses             │           │ POST /api/trips/:id/remind  │
 │ POST /api/trips             │           │ Gmail Dispatch Service      │
 └──────────────┬──────────────┘           └──────────────┬──────────────┘
                │                                         │
                ▼                                         ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │                       Server Database (db.ts)                         │
 │  - buses: Bus Number, Route Number, Capacity (32), Active             │
 │  - trips: 3:30 PM & 4:30 PM Batches, Status (OPEN/BOARDING/FULL)      │
 │  - bookings: CONFIRMED / CANCELLED, seat_id (1A-8D)                   │
 │  - boarding_events: BOARDED (QR/Manual), boarded_at                   │
 └──────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                     [ Student Dashboard & Booking ]
             - Real-time 3:30 PM & 4:30 PM Bus Cards
             - 2x2 Interactive Seat Map Reservation (₹0)
```

### Component & State Mapping

1. `server/db.ts`:
   - Seed data updated to feature **3:30 PM** and **4:30 PM** departure timings across CIT routes.
   - Helper methods to compute `booked_count` and `boarded_count` for each trip and bus.
2. `server/api.ts`:
   - Endpoint `POST /api/trips/:id/send-reminders`: Filters bookings where `booking_status === 'CONFIRMED'` and `boarding_status === 'NOT BOARDED'`, sends reminder emails, and logs them in `email_logs`.
   - Enhanced `GET /api/buses` and `GET /api/trips` to include live boarding counts (`booked_seats_count`, `boarded_seats_count`, `pending_boarding_count`).
3. `src/components/AdminPortal.tsx`:
   - Add Bus form updated to allow Authenticator/Admin to define bus number, route stops, and schedule 3:30 PM or 4:30 PM departure trips immediately.
   - Bus Fleet and Trips tables updated with expandable rows showing booked vs. boarded stats and detailed passenger lists.
4. `src/components/DriverScanner.tsx`:
   - Added **"Send Reminders"** button with pending passenger counter.
   - Built **ReminderDispatchModal** component showing unboarded students before triggering Gmail dispatch.
5. `src/components/StudentDashboard.tsx`:
   - Updated bus list display to feature 3:30 PM and 4:30 PM departure batches with time filters.

---

## 5. Verification Plan

1. **Bus & Route Creation**:
   - As Authenticator/Admin, create a new Bus (e.g. Bus 12) with a new route and a 3:30 PM or 4:30 PM departure.
   - Verify it appears on the Student Dashboard for seat reservation.
2. **Student Booking & Boarding Stats**:
   - Reserve a seat as a student on the newly added bus.
   - In Admin Portal, open the bus row and verify that the booked count increments (e.g. 1/32).
   - In Driver Console, verify the passenger appears in the manifest as "NOT BOARDED".
3. **Boarding Verification**:
   - Scan or verify the student boarding pass.
   - In Admin Portal, expand the bus row and confirm that "Boarded" count increases to 1 and "Pending" drops to 0.
4. **Driver Reminders to Unboarded Students**:
   - On a trip with unboarded passengers, click "Send Reminders".
   - Confirm the modal displays all unboarded students with their seat and contact info.
   - Click send and verify reminder email logs in the Admin Email Logs tab.
