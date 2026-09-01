# AegisHelmet AI: Application Features & Guide

## 1. Bluetooth Connectivity
This section details how the application utilizes Bluetooth technology to synchronize with the smart helmet hardware.

*   **Pairing Process:** 
    1.  Ensure Bluetooth is enabled on your smartphone/device. 
    2.  Navigate to **Settings > Helmet Connectivity**. 
    3.  Tap **"Scan for Helmet"**. The app uses `Web Bluetooth API` to identify the 'Aegis Core' peripheral.
    4.  Confirm pairing on the system prompt. A verification LED on the helmet will blink green once paired.
*   **Supported Profiles and Data Transfer:** 
    *   **GATT Profile:** Used for low-energy sensor data.
    *   **Data Types:** Real-time IMU data (accelerometer/gyroscope) for accident detection, GPS coordinates, and proximity sensor status for rider count validation.
*   **Troubleshooting:** If the device is not found, verify the helmet is in 'Pairing Mode' (hold power for 5s) and that no other application is occupying the Bluetooth channel.

---

## 2. RTO Database Connection
AegisHelmet AI integrates directly with the Regional Transport Office (RTO) Database for instant vehicle and driver identification.

*   **Connection Logic:** The system utilizes a RESTful API bridge connected to a secure Firestore instance. Upon detecting a number plate via the AI engine, a SHA-256 hashed query is sent to the `/vehicles` endpoint.
*   **Data Accessed:** 
    *   **Registration Integrity:** Checks if the plate matches the vehicle make/color.
    *   **Owner Status:** Verifies license validity and active registration status.
    *   **Insurance/PUC:** Validates mandatory documents.
*   **Prerequisites & Security:** 
    *   A high-speed 4G/5G connection is recommended for <200ms verification.
    *   **TLS 1.3 Encryption** is enforced for all RTO-bound traffic. AI analysis happens primarily in the cloud, but specific PII (Personally Identifiable Information) is only visible to authorized RTO personnel.

---

## 3. Manual Dataset Management
For RTO administrators and emergency testing, the application allows bulk management of vehicle datasets.

*   **Supported File Formats:** CSV, JSON, and XLSX.
*   **Adding Datasets:**
    1.  Navigate to **Settings > Manual Dataset Management**.
    2.  Upload the registry export from your local machine.
    3.  The app validates the schema (Registration No, Engine No, Owner Code).
    4.  Once imported, these records are cached for offline verification in remote areas with poor connectivity.
*   **Emergency Purposes:** In case of a major network outage, 'Emergency Datasets' containing the most frequent offenders and critical priority vehicles can be pre-loaded manually to ensure safety enforcement continues without internet.

---

## 4. Essential App Settings
Customize your Aegis experience through the primary configuration panel.

*   **General Preferences:**
    *   **Auto-Report Violations:** When enabled, the AI automatically logs "Confident" detections (0.95+ confidence) to the police database without manual review.
    *   **SOS Sensitivity:** Adjust the G-Force threshold for accident detection.
*   **Connectivity Settings:**
    *   **Hotspot Bridge:** Use the helmet as a Wi-Fi bridge for high-bandwidth video feed streaming.
*   **Data Management:**
    *   **Clear Local Cache:** Purge temporary image analysis storage to free up space.
    *   **Export Violation History:** Generate PDF/CSV reports of detections within a specific time range.
*   **User Profile:** Configure guardian emergency contacts (used during the SOS alert sequence).
