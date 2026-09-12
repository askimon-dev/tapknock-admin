# TapKnock • Admin Console & Telemetry

Production-grade administration and telemetry panel for the **TapKnock** smart doorbell platform, built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **PostgreSQL 16**.

Hosted at: [admin.tapknock.generalquery.xyz](https://admin.tapknock.generalquery.xyz)

---

## Key Capabilities

### 1. Push Notification Control Center (Broadcast & Targeted)
- **Immediate Dispatch**: Broadcast system alerts and notifications to all active homeowner devices in real time over persistent WebSocket connections.
- **Targeted Audiences**: Multi-select specific users and door owners to deliver targeted notifications with sound and priority alerts.
- **Scheduled Notifications**: Schedule announcements for any future date/time. The background scheduler processes and dispatches scheduled notifications automatically.
- **Live Device Lockscreen Preview**: Realistic real-time mobile device mockup showing how the notification renders on user phones.
- **Notification Presets**: One-click templates for System Maintenance, Security Advisories, Feature Announcements, and Doorbell Health Checks.
- **Complete Audit Trail**: History of all delivered, scheduled, and cancelled notifications with recipient and delivered metrics.

### 2. Comprehensive Analytics & Metrics
- **KPI Cards**: Total Registered Accounts, Configured Doors, Total Rings, Call Answer Rate %, Online Mobile Devices, and Notifications Dispatched.
- **7-Day Ring Volume Activity**: Interactive area chart tracking daily ring activity and answered calls.
- **Call Outcome Distribution**: Donut chart breaking down Answered, Ringing, Declined, Missed, Quiet Hours, and Blocked rings.
- **24-Hour Peak Activity Heatmap**: Hourly breakdown showing peak doorbell usage times across the day.
- **Live Ring Stream**: Real-time activity feed of incoming visitor calls across all doors.

### 3. User & Account Management
- Search, filter, and inspect registered homeowners.
- View owned doors, total ring counts, and active device sessions per user.
- Revoke active device sessions across all phones with one click.

### 4. Smart Access Points & Hardware Management
- Inspect all doors with labels, public codes (`r/<code>`), address, radius, and quiet hours.
- **One-Click Pause / Resume**: Instantly toggle doorbell active state and auto-reply messages.
- **QR Kit & Visitor URL**: Generate live SVG QR codes and copy visitor doorbell links.
- **Test Ring Trigger**: Simulate live rings directly from the admin console to verify mobile notifications.

### 5. Ring Audit & Security Blocklist
- Detailed inspection of all visitor calls with duration, visitor name, reason, and media recordings.
- Geolocation and network telemetry (IP location, fingerprint, connection type).
- Instant fingerprint blocking to silence persistent abusive visitors.

### 6. System Health & Infrastructure Telemetry
- PostgreSQL 16 connection status, database size, and per-table row counts.
- WebSocket Signaling gateway connection health and online device socket counts.
- Administrative audit log for all console actions.

---

## Tech Stack
- **Framework**: Next.js 14 (App Router, Server Actions, Standalone Output)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Dark Theme tokens
- **Icons**: Lucide React
- **Charts**: Recharts
- **Database**: PostgreSQL 16 (Connection Pooled via `pg`)
- **QR Generation**: QRCode

---

## Environment Variables

```env
# Database connection
DATABASE_URL=postgresql://tapknock:PASSWORD@tapknock-postgres:5432/tapknock

# TapKnock core backend URL (for push dispatch & stats)
TAPKNOCK_API_URL=http://tapknock:8080
NEXT_PUBLIC_TAPKNOCK_API_URL=https://tapknock.generalquery.xyz

# Admin Authentication
ADMIN_SECRET=your_admin_secret_here
ADMIN_PASSWORD=admin123
```

---

## Deployment (Docker & Caddy)

The admin container runs alongside the TapKnock core backend and PostgreSQL on the `quekey_quekey` Docker network, reverse-proxied by Caddy with automated Let's Encrypt TLS:

```sh
docker build -t tapknock-admin:latest .
docker run -d --name tapknock-admin --restart unless-stopped \
  --network quekey_quekey \
  -e DATABASE_URL=postgresql://tapknock:...@tapknock-postgres:5432/tapknock \
  -e TAPKNOCK_API_URL=http://tapknock:8080 \
  -e ADMIN_SECRET=... \
  tapknock-admin:latest
```
