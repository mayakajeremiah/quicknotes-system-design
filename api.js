'use strict';

const API_URL = 'https://jsonplaceholder.typicode.com/posts';
const loadButton = document.getElementById('load-btn');
const statusMessage = document.getElementById('status');
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitButton = document.getElementById('submit-btn');
const notesList = document.getElementById('notes-list');

function setStatus(message, type = '') {
  statusMessage.textContent = message;
  statusMessage.className = `status${type ? ` ${type}` : ''}`;
}

// Shared request helper: every HTTP response is checked before its body is used.
async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`The server returned ${response.status}. Please try again.`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return { data: null, status: response.status };
  const data = await response.json();
  return { data, status: response.status };
}

function showEmptyState() {
  const item = document.createElement('li');
  item.className = 'empty-state';
  item.textContent = 'No notes to show yet. Load notes or create your first note.';
  notesList.replaceChildren(item);
}

function renderNote(note, prepend = false) {
  const item = document.createElement('li');
  item.className = 'note-card';
  item.dataset.noteId = String(note.id);

  const title = document.createElement('h3');
  title.textContent = note.title || '(Untitled note)';
  const body = document.createElement('p');
  body.textContent = note.body || 'No body provided.';
  const actions = document.createElement('div');
  actions.className = 'note-actions';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'delete-btn';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => deleteNote(note.id, deleteButton));
  actions.append(deleteButton);
  item.append(title, body, actions);
  if (prepend) notesList.prepend(item);
  else notesList.append(item);
}

async function loadNotes() {
  loadButton.disabled = true;
  setStatus('Loading notes...');
  try {
    const { data: notes } = await request(`${API_URL}?_limit=10`);
    notesList.replaceChildren();
    if (!Array.isArray(notes) || notes.length === 0) {
      showEmptyState();
      setStatus('No notes were returned by the server.', 'success');
      return;
    }
    notes.forEach(note => renderNote(note));
    setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
  } catch (error) {
    setStatus(`Could not load notes. ${error.message}`, 'error');
  } finally {
    loadButton.disabled = false;
  }
}

async function createNote(title, body) {
  submitButton.disabled = true;
  setStatus('Creating note...');
  try {
    const { data, status } = await request(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ title, body, userId: 1 })
    });
    // JSONPlaceholder simulates POST success but does not persist the new post.
    // We render the returned note locally; reloading will not retrieve this created note.
    if (notesList.querySelector('.empty-state')) notesList.replaceChildren();
    renderNote(data, true);
    setStatus(`Note created (status ${status}, id ${data.id}). JSONPlaceholder does not permanently save it.`, 'success');
    noteForm.reset();
  } catch (error) {
    setStatus(`Could not create note. ${error.message}`, 'error');
  } finally {
    submitButton.disabled = false;
  }
}

async function deleteNote(id, button) {
  button.disabled = true;
  setStatus('Deleting note...');
  try {
    const { status } = await request(`${API_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const card = notesList.querySelector(`[data-note-id="${CSS.escape(String(id))}"]`);
    if (card) card.remove();
    if (!notesList.querySelector('.note-card')) showEmptyState();
    // DELETE is also simulated by JSONPlaceholder; local UI removal is not permanent server storage.
    setStatus(`Note deleted (status ${status}). This change is local to this demo.`, 'success');
  } catch (error) {
    button.disabled = false;
    setStatus(`Could not delete note. ${error.message}`, 'error');
  } finally {
    // A successful deletion removes the button with its card; on failure it is re-enabled above.
  }
}

loadButton.addEventListener('click', loadNotes);
noteForm.addEventListener('submit', async event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();
  if (!title) {
    setStatus('Please enter a title before creating a note.', 'error');
    titleInput.focus();
    return;
  }
  if (title.length > 100) {
    setStatus('The title must be 100 characters or fewer.', 'error');
    titleInput.focus();
    return;
  }
  await createNote(title, body);
});

showEmptyState();
