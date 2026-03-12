# Setup Guide (V1)

## 1) Create Sheet + Drive folder
1. Create a Google Sheet.
2. Create 3 tabs: `Persons`, `Spouses`, `README`.
3. Copy headers/content from `docs/Google-Sheets-Schema.md`.
4. Create a Google Drive folder for photos.

## 2) Configure Apps Script
1. Open script.google.com and create a new Apps Script project.
2. Copy content of `apps-script/Code.gs` and `apps-script/appsscript.json`.
3. In `Code.gs`, set:
   - `CONFIG.SHEET_ID`
   - `CONFIG.DRIVE_FOLDER_ID`
   - `CONFIG.ALLOWED_EMAILS`
4. Save and run `initSheets_` once (authorize prompts).

## 3) Deploy Web App
1. Deploy > New deployment > Web app.
2. Execute as: Me.
3. Who has access: Anyone with Google account (and keep allowlist in code).
4. Copy the Web App URL.

## 4) Configure frontend
1. Open `frontend.html` in your browser.
2. Click `Config`.
3. Paste Apps Script Web App URL.
4. Click `Reload`.

## 5) Verify flows
- Create person.
- Edit person.
- Add spouse link.
- Add child.
- Upload photo.
- Delete person (hard delete).

## 6) Notes
- V1 uses hard delete.
- Search is by name only.
- Tree layout is fully automatic top-down.
