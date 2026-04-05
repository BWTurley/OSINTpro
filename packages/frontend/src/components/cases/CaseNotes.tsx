import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { Trash2, Edit3, Clock } from 'lucide-react';
import { ADD_NOTE } from '@/graphql/mutations/cases';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { TLPBadge } from '@/components/common/TLPBadge';
import { formatDateTime } from '@/utils/formatters';
import type { Note, TLPLevel } from '@/types';

interface CaseNotesProps {
  caseId: string;
  notes: Note[];
}

const tlpOptions: TLPLevel[] = ['white', 'green', 'amber', 'amber-strict', 'red'];

export const CaseNotes: React.FC<CaseNotesProps> = ({ caseId, notes }) => {
  const [newContent, setNewContent] = useState('');
  const [newTlp, setNewTlp] = useState<TLPLevel>('green');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const [addNote] = useMutation(ADD_NOTE);

  const handleSubmit = async () => {
    if (!newContent.trim()) return;
    await addNote({ variables: { caseId, input: { content: newContent, tlp: newTlp } } });
    setNewContent('');
  };

  const handleSaveEdit = (noteId: string) => {
    if (!editContent.trim()) return;
    // TODO: backend mutation needed for updateNote
    console.log('Update note', noteId, editContent);
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = (noteId: string) => {
    // TODO: backend mutation needed for deleteNote
    console.log('Delete note', noteId);
  };

  return (
    <div className="space-y-6">
      {/* New note form */}
      <div className="card space-y-4">
        <h3 className="text-base font-semibold text-gray-200">Add Note</h3>
        <MarkdownEditor
          value={newContent}
          onChange={setNewContent}
          placeholder="Write analyst notes in Markdown..."
          minHeight="120px"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Classification:</label>
            <select
              value={newTlp}
              onChange={(e) => setNewTlp(e.target.value as TLPLevel)}
              className="px-3 py-1.5 text-sm bg-surface-800 border border-gray-700 rounded-lg
                         text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tlpOptions.map((tlp) => (
                <option key={tlp} value={tlp}>
                  TLP:{tlp.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!newContent.trim()}
            className="px-5 py-2 text-base font-medium text-white bg-blue-600 hover:bg-blue-700
                       rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add Note
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-base text-gray-500 text-center py-8">No notes yet</p>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-gray-700/50 bg-surface-800/30 overflow-hidden"
            >
              {/* Note header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700/30 bg-surface-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-base font-medium text-gray-200">{note.author}</span>
                  <TLPBadge level={note.tlp} />
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(note.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingId(note.id);
                      setEditContent(note.content);
                    }}
                    className="p-1.5 text-gray-500 hover:text-gray-200 rounded transition-colors"
                    aria-label="Edit note"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 rounded transition-colors"
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Note body */}
              <div className="px-5 py-4">
                {editingId === note.id ? (
                  <div className="space-y-3">
                    <MarkdownEditor
                      value={editContent}
                      onChange={setEditContent}
                      minHeight="100px"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(note.id)}
                        className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600
                                   hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <MarkdownEditor value={note.content} onChange={() => {}} readOnly />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
