# AegisHelmet AI: System Design Document

## 1. Overview
AegisHelmet AI is an edge-cloud collaboration system designed to enhance motorcycle safety. It uses real-time image processing, AI-driven rule enforcement, and automated emergency response to reduce road fatalities.

### 1.1 Performance Targets (Latency)
The system is optimized for rapid intervention:
*   **Image Pre-processing:** <100ms
*   **AI Vision Inference (Gemini 1.5):** 1.5s - 2.8s
*   **Database Write (Firestore):** <300ms
*   **Officer Notification:** <500ms
*   **Total Cycle Time:** **~3.2s - 4.5s** (Under standard 4G/5G conditions).

---

## 2. Architecture & Components

### 2.1 Hardware Layer (Edge)
*   **Sensor Hub:** Integrated into the smart helmet. Includes IMU (Inertial Measurement Unit) for crash detection and high-definition wide-angle cameras.
*   **Bluetooth Bridge:** Low-latency Bluetooth Low Energy (BLE) link to the companion smartphone app.

### 2.2 Client-Side Application (Mobile/Web)
*   **Edge AI Processor:** Uses Gemini 1.5 Flash Vision for real-time analysis of the helmet's video feed.
*   **Local State Management:** React-based UI (Vite) ensuring responsive feedback.
*   **Telemetry Manager:** Collects GPS coordinates and sensor data to determine speed and impact force.

### 2.3 Cloud Layer (Firebase Backend)
*   **Firestore Database:** Scalable NoSQL storage for:
    *   **Users:** Profiles, emergency contacts, and roles.
    *   **Vehicles:** A shared registry (RTO Sandbox) for registration verification.
    *   **Violations:** Permanent logs of detected traffic infractions.
    *   **Alerts:** Active SOS signals with location and photographic evidence.
*   **Firebase Authentication:** Google-backed secure identity management.

---

## 3. Data Flow & Integration Strategies

### 3.1 Vehicle Data Management
*   **Automatic Extraction:** The AI model extracts plate numbers from raw video frames.
*   **RTO Integration:** Plate numbers are cross-referenced with the `vehicles` collection. If a plate is missing or mismatched (e.g., color mismatch), the system flags it as `FAKE_PLATE`.
*   **Manual Entry:** A dedicated "Vehicle Registry" interface in the RTO Dashboard allows officials to manually input or correct vehicle data, ensuring high database integrity even in testing phases.

### 3.2 Traffic Rule Enforcement
The system detects the following violations concurrently:
1.  **Triple Riding:** Identified by human clustering in a single frame.
2.  **Overspeeding:** Calculated using GPS distance delta over time.
3.  **Fake Plate:** Verification against the centralized RTO database.
4.  **No Helmet:** (Future Implementation) Verification of protective gear via secondary vision model.

### 3.3 Accident Notification (SOS Protocol)
1.  **Detection:** IMU detects a G-force peak exceeding 4.0G OR the user manual triggers the SOS button.
2.  **Payload Generation:**
    *   **Live Coordinates:** Fetched via Geolocation API.
    *   **Incident Photo:** A screen capture of the moment of impact.
    *   **Identity Data:** User's name and vehicle number.
3.  **Tri-Notification:**
    *   **Police:** Sent to the nearest station (determined by coordinate-to-precinct mapping logic).
    *   **Guardians:** The app retrieves two pre-stored emergency contacts and triggers a simulated SMS/API alert.
    *   **RTO:** The incident is logged in the Control Center for rapid traffic mitigation.

---

## 4. Privacy & Security

*   **Data Isolation:** PII (Emergency contacts/emails) is strictly protected by Firestore Security Rules. Only the owner and authorized RTO/Police users can access this data.
*   **Encryption:** All data in transit is encrypted using TLS 1.3.
*   **Anonymization:** AI analysis is performed on raw image data which is not stored unless a violation or accident is detected.

---

## 5. Emergency Contact Mechanism
Users must configure **two emergency members** in the Profile Settings:
*   **Field 1:** Primary Guardian (Name + Phone)
*   **Field 2:** Secondary Guardian (Name + Phone)
These contacts are stored in the user's permanent document and used as the recursive target for SOS notifications.
