const { google } = require('googleapis');
const { Readable } = require('stream');

function makeAuth(credentials) {
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
}

async function uploadFile(buffer, name, mimeType, folderId, credentials) {
  const drive = google.drive({ version: 'v3', auth: makeAuth(credentials) });

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: { name, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id,webViewLink',
  });

  await drive.permissions.create({
    fileId: res.data.id,
    supportsAllDrives: true,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return { id: res.data.id, webViewLink: res.data.webViewLink };
}

async function deleteFile(fileId, credentials) {
  const drive = google.drive({ version: 'v3', auth: makeAuth(credentials) });
  await drive.files.delete({ fileId, supportsAllDrives: true });
}

module.exports = { uploadFile, deleteFile };
