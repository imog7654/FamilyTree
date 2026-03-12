/**
 * Family Tree API (Google Apps Script)
 * Deploy as Web App:
 * - Execute as: Me
 * - Who has access: Anyone
 * Access is controlled by SECRET below instead of Google account.
 */

const CONFIG = {
  SHEET_ID: '1N2sA7iHsGaivxTf5FFIRbqD1UltkSei6fZumlN0nJU4',
  DRIVE_FOLDER_ID: '1PJTVQ4zUeTgebqVg7bXAJc_23hwk6xPy',
  SECRET: 'rookies-this-is-my-secret-family-gentlemen',
  SHEETS: {
    PERSONS: 'Persons',
    SPOUSES: 'Spouses',
    README: 'README'
  }
};

const PERSON_COLUMNS = [
  'PersonID',
  'FullName',
  'Gender',
  'BirthDate',
  'DeathDate',
  'IsLiving',
  'FatherID',
  'MotherID',
  'Notes',
  'PhotoFileName',
  'PhotoFileId',
  'PhotoURL',
  'CreatedAt',
  'UpdatedAt'
];

const SPOUSE_COLUMNS = [
  'SpouseLinkID',
  'Person1ID',
  'Person2ID',
  'RelationshipType',
  'StartDate',
  'EndDate',
  'Notes',
  'CreatedAt',
  'UpdatedAt'
];

function doGet(e) {
  const cb = e && e.parameter && e.parameter.callback;
  try {
    assertAuthorized_(e && e.parameter && e.parameter.secret);
    const action = (e && e.parameter && e.parameter.action) || 'healthCheck';
    const payload = e && e.parameter && e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
    const result = routeAction_(action, payload);
    return jsonpOrJson_(cb, true, result, null);
  } catch (err) {
    return jsonpOrJson_(cb, false, null, err.message);
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    assertAuthorized_(body.secret);
    const action = body.action;
    const payload = body.payload || {};
    const result = routeAction_(action, payload);
    return jsonResponse_(true, result);
  } catch (err) {
    return jsonResponse_(false, null, err.message);
  }
}

function routeAction_(action, payload) {
  switch (action) {
    case 'healthCheck':
      return { status: 'ok', timestamp: nowIso_() };
    case 'initSheets':
      return initSheets_();
    case 'getAllData':
      return getAllData_();
    case 'createPerson':
      return createPerson_(payload);
    case 'updatePerson':
      return updatePerson_(payload);
    case 'deletePerson':
      return deletePerson_(payload);
    case 'createSpouseLink':
      return createSpouseLink_(payload);
    case 'deleteSpouseLink':
      return deleteSpouseLink_(payload);
    case 'uploadPhoto':
      return uploadPhoto_(payload);
    default:
      throw new Error('Unknown action: ' + action);
  }
}

function assertAuthorized_(secret) {
  if (!secret || secret !== CONFIG.SECRET) {
    throw new Error('Unauthorized: invalid or missing secret.');
  }
}

function initSheets_() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const persons = ensureSheetWithHeaders_(ss, CONFIG.SHEETS.PERSONS, PERSON_COLUMNS);
  const spouses = ensureSheetWithHeaders_(ss, CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS);
  const readme = ss.getSheetByName(CONFIG.SHEETS.README) || ss.insertSheet(CONFIG.SHEETS.README);

  if (readme.getLastRow() === 0) {
    readme.getRange(1, 1, 1, 1).setValue('Family Tree Workbook README');
    readme.getRange(3, 1, 1, 1).setValue('Tabs');
    readme.getRange(4, 1, 1, 1).setValue('Persons: One row per person');
    readme.getRange(5, 1, 1, 1).setValue('Spouses: One row per spouse relationship');
    readme.getRange(7, 1, 1, 1).setValue('Rules');
    readme.getRange(8, 1, 1, 1).setValue('Do not manually change IDs once created');
    readme.getRange(9, 1, 1, 1).setValue('FatherID/MotherID must reference valid PersonID values');
    readme.getRange(10, 1, 1, 1).setValue('Photos are in Drive; this sheet stores references only');
    readme.autoResizeColumn(1);
  }

  [persons, spouses].forEach(function (sheet) {
    sheet.setFrozenRows(1);
    if (!sheet.getFilter()) {
      sheet.getDataRange().createFilter();
    }
  });

  return { initialized: true };
}

function getAllData_() {
  const persons = readRows_(CONFIG.SHEETS.PERSONS, PERSON_COLUMNS);
  const spouses = readRows_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS);
  return { persons: persons, spouses: spouses };
}

function createPerson_(payload) {
  validatePersonPayload_(payload, false);

  const personId = nextId_(CONFIG.SHEETS.PERSONS, PERSON_COLUMNS, 'PersonID', 'P');
  const ts = nowIso_();
  const row = {
    PersonID: personId,
    FullName: payload.FullName,
    Gender: payload.Gender || '',
    BirthDate: payload.BirthDate || '',
    DeathDate: payload.DeathDate || '',
    IsLiving: payload.IsLiving === false ? 'FALSE' : 'TRUE',
    FatherID: payload.FatherID || '',
    MotherID: payload.MotherID || '',
    Notes: payload.Notes || '',
    PhotoFileName: payload.PhotoFileName || '',
    PhotoFileId: payload.PhotoFileId || '',
    PhotoURL: payload.PhotoURL || '',
    CreatedAt: ts,
    UpdatedAt: ts
  };

  appendRow_(CONFIG.SHEETS.PERSONS, PERSON_COLUMNS, row);
  return row;
}

function updatePerson_(payload) {
  if (!payload.PersonID) throw new Error('PersonID is required.');
  validatePersonPayload_(payload, true);

  const sheet = getSheet_(CONFIG.SHEETS.PERSONS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf('PersonID');
  const rowIndex = findRowIndexByValue_(data, idIdx, payload.PersonID);

  if (rowIndex === -1) throw new Error('Person not found: ' + payload.PersonID);

  const updates = Object.assign({}, payload, { UpdatedAt: nowIso_() });
  Object.keys(updates).forEach(function (key) {
    const colIdx = headers.indexOf(key);
    if (colIdx >= 0 && key !== 'PersonID') {
      sheet.getRange(rowIndex + 1, colIdx + 1).setValue(updates[key]);
    }
  });

  return getById_(CONFIG.SHEETS.PERSONS, PERSON_COLUMNS, 'PersonID', payload.PersonID);
}

function deletePerson_(payload) {
  if (!payload.PersonID) throw new Error('PersonID is required.');
  const personId = payload.PersonID;

  deleteById_(CONFIG.SHEETS.PERSONS, PERSON_COLUMNS, 'PersonID', personId);

  // Remove spouse links containing this person.
  const spouseRows = readRows_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS);
  spouseRows
    .filter(function (r) { return r.Person1ID === personId || r.Person2ID === personId; })
    .forEach(function (r) {
      deleteById_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS, 'SpouseLinkID', r.SpouseLinkID);
    });

  // Clear parent references from children.
  const personsSheet = getSheet_(CONFIG.SHEETS.PERSONS);
  const values = personsSheet.getDataRange().getValues();
  const headers = values[0];
  const fatherIdx = headers.indexOf('FatherID');
  const motherIdx = headers.indexOf('MotherID');

  for (let i = 1; i < values.length; i++) {
    let changed = false;
    if (values[i][fatherIdx] === personId) {
      values[i][fatherIdx] = '';
      changed = true;
    }
    if (values[i][motherIdx] === personId) {
      values[i][motherIdx] = '';
      changed = true;
    }
    if (changed) {
      values[i][headers.indexOf('UpdatedAt')] = nowIso_();
    }
  }

  if (values.length > 1) {
    personsSheet.getRange(2, 1, values.length - 1, headers.length).setValues(values.slice(1));
  }

  return { deleted: true, PersonID: personId };
}

function createSpouseLink_(payload) {
  if (!payload.Person1ID || !payload.Person2ID) throw new Error('Person1ID and Person2ID are required.');
  if (payload.Person1ID === payload.Person2ID) throw new Error('A person cannot be spouse to self.');

  assertPersonExists_(payload.Person1ID);
  assertPersonExists_(payload.Person2ID);

  const pair = [payload.Person1ID, payload.Person2ID].sort();
  if (spousePairExists_(pair[0], pair[1])) {
    throw new Error('Duplicate spouse pair not allowed.');
  }

  const spouseId = nextId_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS, 'SpouseLinkID', 'S');
  const ts = nowIso_();

  const row = {
    SpouseLinkID: spouseId,
    Person1ID: pair[0],
    Person2ID: pair[1],
    RelationshipType: payload.RelationshipType || 'Married',
    StartDate: payload.StartDate || '',
    EndDate: payload.EndDate || '',
    Notes: payload.Notes || '',
    CreatedAt: ts,
    UpdatedAt: ts
  };

  appendRow_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS, row);
  return row;
}

function deleteSpouseLink_(payload) {
  if (!payload.SpouseLinkID) throw new Error('SpouseLinkID is required.');
  deleteById_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS, 'SpouseLinkID', payload.SpouseLinkID);
  return { deleted: true, SpouseLinkID: payload.SpouseLinkID };
}

function uploadPhoto_(payload) {
  if (!payload.PersonID) throw new Error('PersonID is required for naming photo.');
  if (!payload.fileName || !payload.base64Data || !payload.mimeType) {
    throw new Error('fileName, base64Data, mimeType are required.');
  }

  if (payload.mimeType.indexOf('image/') !== 0) {
    throw new Error('Only image uploads are allowed.');
  }

  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
  const extension = payload.fileName.indexOf('.') >= 0 ? payload.fileName.split('.').pop() : 'jpg';
  const normalizedName = payload.PersonID + '.' + extension;

  const bytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(bytes, payload.mimeType, normalizedName);
  const file = folder.createFile(blob);

  // Set to anyone with link for direct display.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  return {
    PhotoFileName: file.getName(),
    PhotoFileId: file.getId(),
    PhotoURL: url
  };
}

function validatePersonPayload_(payload, isUpdate) {
  if (!isUpdate && !payload.FullName) throw new Error('FullName is required.');
  if (payload.FatherID) assertPersonExists_(payload.FatherID);
  if (payload.MotherID) assertPersonExists_(payload.MotherID);
  if (payload.PersonID && (payload.PersonID === payload.FatherID || payload.PersonID === payload.MotherID)) {
    throw new Error('Person cannot be own parent.');
  }
}

function spousePairExists_(id1, id2) {
  const rows = readRows_(CONFIG.SHEETS.SPOUSES, SPOUSE_COLUMNS);
  return rows.some(function (r) {
    return r.Person1ID === id1 && r.Person2ID === id2;
  });
}

function assertPersonExists_(personId) {
  const row = getById_(CONFIG.SHEETS.PERSONS, PERSON_COLUMNS, 'PersonID', personId);
  if (!row) throw new Error('Invalid PersonID reference: ' + personId);
}

function nextId_(sheetName, columns, idColumn, prefix) {
  const rows = readRows_(sheetName, columns);
  let maxNum = 0;
  rows.forEach(function (r) {
    const raw = r[idColumn] || '';
    const num = parseInt(String(raw).replace(prefix, ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  });
  const next = maxNum + 1;
  return prefix + ('0000' + next).slice(-4);
}

function getById_(sheetName, columns, idColumn, idValue) {
  const rows = readRows_(sheetName, columns);
  const found = rows.filter(function (r) { return r[idColumn] === idValue; });
  return found.length ? found[0] : null;
}

function deleteById_(sheetName, columns, idColumn, idValue) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) throw new Error(sheetName + ' is empty.');

  const headers = values[0];
  const idIdx = headers.indexOf(idColumn);
  for (let i = values.length - 1; i >= 1; i--) {
    if (values[i][idIdx] === idValue) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error(idColumn + ' not found: ' + idValue);
}

function appendRow_(sheetName, columns, rowObj) {
  const sheet = getSheet_(sheetName);
  const row = columns.map(function (c) {
    return rowObj[c] !== undefined ? rowObj[c] : '';
  });
  sheet.appendRow(row);
}

function readRows_(sheetName, columns) {
  const sheet = getSheet_(sheetName);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0];
  return values.slice(1).map(function (row) {
    const obj = {};
    columns.forEach(function (col) {
      const idx = headers.indexOf(col);
      obj[col] = idx >= 0 ? row[idx] : '';
    });
    return obj;
  });
}

function ensureSheetWithHeaders_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    const mismatch = headers.some(function (h, i) { return existing[i] !== h; });
    if (mismatch) {
      sheet.clear();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

function getSheet_(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  return sheet;
}

function findRowIndexByValue_(values, colIdx, value) {
  for (let i = 1; i < values.length; i++) {
    if (values[i][colIdx] === value) return i;
  }
  return -1;
}

function nowIso_() {
  return new Date().toISOString();
}

function jsonpOrJson_(callback, success, data, error) {
  const json = JSON.stringify({ success: success, data: data || null, error: error || null });
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse_(success, data, errorMessage) {
  return jsonpOrJson_(null, success, data, errorMessage);
}


