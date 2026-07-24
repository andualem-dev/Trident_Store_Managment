# Trident Store — Equipment Rental System — Project Spec

> Attach this file with `@PROJECT_SPEC.md` in Cursor whenever working on this project so it has full context. This is the single source of truth for requirements, data model, and business rules.

## What this is

A rental management system for Trident Store, which rents out production equipment (cameras, lenses, tripods, lighting, etc.) to customers. Staff ("operators") handle everything at a counter — customers do not use the system directly. Speed matters: operators must complete a rental in a few clicks while a customer waits.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL + Prisma ORM
- Telegram Bot API for admin reporting
- Deployment target: Vercel (or a VPS — see note in Deployment section)

## Roles

- **Admin**: full control. Manages operator accounts (creates unique code + password per operator), manages equipment, sets pricing, sets grace period, views all reports/audit logs/analytics, can blacklist customers.
- **Operator**: counter staff. Logs in with a password only (no username field on screen — the password itself uniquely identifies which operator it belongs to). Can register customers, create rentals, process returns, create bookings. Cannot delete records or access admin-only pages.

Login session persists for the operator's whole shift — they should not need to re-enter anything mid-shift.

## Data Model

**Operator**: id, name, uniqueCode, passwordHash, isAdmin (bool)

**Customer**: id, name (required), phone (required), idCardPhotoUrl (optional), profilePhotoUrl (optional), isBlacklisted (bool, default false)

**Guarantor**: id, customerId, name, phone — only relevant for new/unestablished customers; optional overall

**Equipment**: id, name, category, dailyRate, status (enum: AVAILABLE / RENTED / BOOKED / MAINTENANCE) — **no photo field**

**Rental**: id, customerId, operatorId, days (int, from dropdown 1–14), startAt (datetime), dueAt (startAt + days, in 24hr blocks), returnedAt (datetime, nullable), totalCost, lateFee (default 0), status (ACTIVE / RETURNED)

**RentalItem**: id, rentalId, equipmentId — join table, supports multiple equipment per single rental transaction (e.g. camera + lens + tripod as one rental)

**Booking**: id, customerId, operatorId, equipmentId, startDate, endDate, status (UPCOMING / ACTIVE / CANCELLED) — booking is created by operators only, never by customers directly; blocks equipment from appearing available for that date range

**AuditLog**: id, operatorId, action, entityType, entityId, timestamp, details (json) — every create/edit/delete logged

## Core Business Rules

1. **Rental duration** is chosen via a dropdown (1, 2, 3... days), defaulting to 1 — operators never do manual date math.
2. **24-hour + grace period rule**: if a customer returns equipment past `dueAt` by more than a configurable grace period (admin-set, default ~20 minutes), a full additional day is charged per day (or part-day) over that threshold. Grace period must be an admin-configurable setting, not hardcoded.
3. **Multi-item rentals**: one transaction can include several equipment items under a single due date and single total cost.
4. **Availability filtering**: the New Rental screen only ever shows equipment with status = AVAILABLE. RENTED, BOOKED, and MAINTENANCE items are automatically excluded.
5. **Operator traceability**: every rental is tagged with the operator who processed it, taken automatically from the logged-in session — never manually typed per transaction.
6. **Booking blocks availability**: equipment with an overlapping active booking should not show as available for those dates, and should show a "Booked [date range]" tag.
7. **Blacklist**: admin can flag a customer as blacklisted; operators see a warning when selecting that customer for a new rental (warn, not necessarily hard-block — admin's judgment call).
8. **Loyalty tracking**: system tracks, per customer, total rentals and total revenue over rolling periods (this month / all-time), and surfaces top customers by both revenue and frequency — these can rank differently and both are useful for different kinds of incentives.
9. **Audit logging**: every create/edit/delete action is logged with operator, timestamp, and details — used to resolve payment/equipment disputes.
10. **No deletion by operators**: only admin accounts can delete records; operators can only create/update through normal flow.

## Reporting (Telegram)

- Daily scheduled report to the admin's Telegram chat: today's total rentals, today's revenue, list of currently overdue rentals (customer + operator + how overdue), equipment currently in maintenance, top 3 customers this month by revenue.
- A more frequent (e.g. hourly) lightweight check specifically for newly-overdue rentals, sending an immediate alert if any exist — admin shouldn't have to wait until the daily digest to learn something is overdue.
- Scheduling via Vercel Cron Jobs (or equivalent cron on a VPS) hitting dedicated API routes.

## UX Priorities (operator-facing screens)

- New Rental flow: search customer by phone → select equipment (tap-based, grouped by category, filtered to available only, with a search box) → pick days from dropdown → confirm. Target: 4–6 taps/clicks total, well under a minute.
- Return flow: shows only ACTIVE rentals, sorted by due date (most overdue first), searchable by customer — select → confirm, late fee auto-calculated.
- All optional fields (ID photo, profile photo, guarantor) are collapsed/hidden by default and never block the main flow.
- Large tap targets — this may be used on a tablet at a physical counter.

## Explicitly Out of Scope / Decided Against

- No customer-facing login or self-service booking — bookings are operator-created only.
- No damage/security deposit tracking (decided unnecessary for now).
- No equipment photos.
- No barcode/QR scanning — equipment selection is via tappable/searchable list, not scanning.

## Deployment Notes

- If deploying to **Vercel**: local filesystem is not persistent between deployments, so ID/profile photo uploads should go to an S3-compatible bucket (e.g. Cloudflare R2 free tier) rather than local disk.
- If deploying to a **VPS**: local disk storage for uploaded photos works fine as originally planned, referenced by path in the DB.

## Build Phases (for reference — build and test one at a time)

1. Project setup + Prisma schema + operator auth (password-only login mapped to operator record)
2. Equipment management (admin CRUD, status toggle including MAINTENANCE)
3. Customer management (quick-add: name + phone required, rest optional/collapsible; search-by-phone)
4. Rental flow (multi-item cart, days dropdown, auto-filled operator from session, cost calculation)
5. Return flow + grace period + late fee calculation
6. Booking flow (date range picker, blocks availability, "Booked" tag)
7. Blacklist + audit log page + top-customer loyalty report
8. Telegram daily report + overdue alert check
9. Admin dashboard (equipment status counts, revenue, active/overdue rentals, top customers, utilization)
10. UX polish pass (click-count audit on operator screens)
11. Deployment (Vercel/VPS, cron jobs, env vars, migration)

Each phase should be manually tested against realistic sample data before moving to the next.
