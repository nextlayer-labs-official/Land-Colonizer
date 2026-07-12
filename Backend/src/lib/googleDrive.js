const path   = require('path');
const { google } = require('googleapis');

let _auth = null;

function getAuth() {
  if (_auth) return _auth;

  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (!keyFile) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_FILE not set');

  const key = require(path.resolve(process.cwd(), keyFile));
  _auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return _auth;
}

async function uploadFile(buffer, name, mimeType, folderId) {
  const auth   = getAuth();
  const drive  = google.drive({ version: 'v3', auth });
  const { Readable } = require('stream');

  const res = await drive.files.create({
    requestBody: {
      name,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id,webViewLink,webContentLink',
  });

  // Make the file readable by anyone with the link
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    id:          res.data.id,
    webViewLink: res.data.webViewLink,
  };
}

async function deleteFile(fileId) {
  const auth  = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  await drive.files.delete({ fileId });
}

module.exports = { uploadFile, deleteFile };
