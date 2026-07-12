'use client';

import { useEffect, useRef, useState } from 'react';
import { apiGet, apiPostForm, apiDelete } from '@/lib/api';

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function FileIcon({ mime }) {
  if (!mime) return <GenericIcon />;
  if (mime === 'application/pdf')              return <PdfIcon />;
  if (mime.includes('word'))                   return <WordIcon />;
  if (mime.includes('excel') || mime.includes('spreadsheet')) return <ExcelIcon />;
  if (mime.startsWith('image/'))               return <ImageIcon />;
  if (mime === 'application/zip')              return <ZipIcon />;
  return <GenericIcon />;
}

const PdfIcon    = () => <div className="w-8 h-8 rounded-lg bg-red-50   flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-red-600">PDF</span></div>;
const WordIcon   = () => <div className="w-8 h-8 rounded-lg bg-blue-50  flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-blue-600">DOC</span></div>;
const ExcelIcon  = () => <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-green-600">XLS</span></div>;
const ImageIcon  = () => <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-purple-600">IMG</span></div>;
const ZipIcon    = () => <div className="w-8 h-8 rounded-lg bg-gray-100  flex items-center justify-center shrink-0"><span className="text-[9px] font-bold text-gray-500">ZIP</span></div>;
const GenericIcon = () => <div className="w-8 h-8 rounded-lg bg-gray-100  flex items-center justify-center shrink-0"><svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg></div>;

function DeleteDocModal({ doc, onClose, onConfirm, deleting }) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Delete document?</h3>
        <p className="text-sm text-gray-500 mb-2"><strong className="font-medium text-gray-700">{doc.name}</strong> will be permanently removed from Google Drive.</p>
        <p className="text-sm font-medium text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">This action cannot be undone — deleted data cannot be recovered.</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 h-9 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 h-9 text-sm rounded-lg text-white bg-red-500 hover:bg-red-600 font-semibold transition disabled:opacity-60">
            {deleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsPanel({ entityType, entityId, canUpload, canDelete }) {
  const [docs,       setDocs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [uploading,  setUploading]  = useState(false);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState('');
  const fileRef = useRef(null);

  const plural = entityType === 'purchase' ? 'purchases' : 'sales';

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/${plural}/${entityId}/documents`);
      setDocs(data);
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { if (entityId) load(); }, [entityId]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const doc = await apiPostForm(`/${plural}/${entityId}/documents`, fd);
      setDocs(prev => [doc, ...prev]);
    } catch (e) { setError(e.message || 'Upload failed'); }
    finally     { setUploading(false); }
  };

  const handleDelete = async () => {
    if (!deletingDoc) return;
    setDeleting(true);
    try {
      await apiDelete(`/documents/${deletingDoc.id}`);
      setDocs(prev => prev.filter(d => d.id !== deletingDoc.id));
      setDeletingDoc(null);
    } catch (e) { setError(e.message); }
    finally     { setDeleting(false); }
  };

  return (
    <div className="p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Documents</h3>
          <p className="text-xs text-gray-400 mt-0.5">Stored in Google Drive</p>
        </div>
        {canUpload && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="h-8 px-4 text-sm rounded-lg text-white font-medium flex items-center gap-1.5 transition disabled:opacity-60"
              style={{ backgroundColor: '#875A7B' }}
            >
              {uploading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Uploading…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                  Upload
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <p className="text-sm font-medium text-gray-400">No documents uploaded yet</p>
          {canUpload && <p className="text-xs text-gray-300 mt-1">Click Upload to add files</p>}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">File</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Size</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">Uploaded</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell">By</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileIcon mime={doc.mime_type} />
                      <span className="font-medium text-gray-800 truncate max-w-[200px]" title={doc.name}>{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{fmtSize(doc.size)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{fmtDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{doc.uploader?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <a
                        href={doc.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 px-2.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        Open
                      </a>
                      {canDelete && (
                        <button
                          onClick={() => setDeletingDoc(doc)}
                          className="h-7 px-2.5 text-xs border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition"
                        >Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteDocModal
        doc={deletingDoc}
        onClose={() => setDeletingDoc(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
