# Google Sheets Schema (V1)

## Tab: Persons
Use this exact header row in row 1:

`PersonID,FullName,Gender,BirthDate,DeathDate,IsLiving,FatherID,MotherID,Notes,PhotoFileName,PhotoFileId,PhotoURL,CreatedAt,UpdatedAt`

## Tab: Spouses
Use this exact header row in row 1:

`SpouseLinkID,Person1ID,Person2ID,RelationshipType,StartDate,EndDate,Notes,CreatedAt,UpdatedAt`

## Tab: README
Paste this content in the README tab:

Family Tree Workbook README

Purpose:
- Stores family-tree data used by the Family Tree V1 frontend.

Tabs:
- Persons: one row per person.
- Spouses: one row per spouse relationship.
- README: usage notes.

Key Rules:
- Do not change PersonID or SpouseLinkID once created.
- FatherID and MotherID must match existing PersonID values.
- Do not manually create duplicate spouse pairs.
- Photos are stored in Google Drive; the sheet stores only references.

Manual Editing Warning:
- Frontend editing is preferred.
- If editing directly, keep IDs and relationships valid.

Example (documentation only):
- P0001 | Ram Sharma | M | 1945 | | TRUE | | | Patriarch | P0001.jpg | <fileId> | <photoUrl> | <createdAt> | <updatedAt>
- P0002 | Sita Sharma | F | 1950 | | TRUE | | | Matriarch | P0002.jpg | <fileId> | <photoUrl> | <createdAt> | <updatedAt>
- S0001 | P0001 | P0002 | Married | 1970 | | | <createdAt> | <updatedAt>

## Readability setup
- Freeze row 1 in Persons and Spouses.
- Enable filter on header row.
- Optional: add dropdown validation for Gender values (M/F/Other).
