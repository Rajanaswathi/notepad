// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCyOJgbs87_RyguU4nVbiqseOtRvzCbvAw",
    authDomain: "notepad-da9ed.firebaseapp.com",
    projectId: "notepad-da9ed",
    storageBucket: "notepad-da9ed.firebasestorage.app",
    messagingSenderId: "718107345231",
    appId: "1:718107345231:web:8e77b8f23408393847853a",
    measurementId: "G-F8H0GJ9NFL"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App State
let currentUser = null;
let currentSort = { field: 'updatedAt', direction: 'desc' };

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const authContainer = document.getElementById('authContainer');
const appContainer = document.getElementById('appContainer');
const loginTab = document.getElementById('loginTab');
const signupTab = document.getElementById('signupTab');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const themeToggle = document.getElementById('themeToggle');
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const sortButton = document.getElementById('sortButton');
const notesContainer = document.getElementById('notesContainer');
const modal = document.getElementById('modal');

// Loading State Management
function showLoading() {
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Toast Notifications
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toastContainer').appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Theme Management
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = savedTheme === 'dark' ? 
        '<i class="fas fa-sun"></i>' : 
        '<i class="fas fa-moon"></i>';
}

// Authentication
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
});

signupTab.addEventListener('click', () => {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    try {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCredential.user.uid).set({
            name,
            email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Account created successfully!');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Logout functionality
async function handleLogout() {
    try {
        showLoading();
        await auth.signOut();
        currentUser = null;
        notesContainer.innerHTML = '';
        
        // Reset forms
        document.querySelectorAll('form').forEach(form => form.reset());
        
        // Reset UI state
        searchInput.value = '';
        filterCategory.value = 'all';
        currentSort = { field: 'updatedAt', direction: 'desc' };
        sortButton.innerHTML = '<i class="fas fa-sort-down"></i>';
        
        // Update visibility
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        
        showToast('Logged out successfully!');
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error during logout. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Note Management
async function createNote() {
    const title = document.getElementById('newNoteTitle').value.trim();
    const content = document.getElementById('newNoteContent').value.trim();
    const category = document.getElementById('newNoteCategory').value;

    if (!title || !content) {
        showToast('Please fill in both title and content', 'error');
        return;
    }

    showLoading();
    try {
        await db.collection('notes').add({
            userId: currentUser.uid,
            title,
            content,
            category,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteCategory').value = 'personal';
        showToast('Note created successfully!');
        await loadNotes();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function updateNote(noteId, note) {
    showLoading();
    try {
        await db.collection('notes').doc(noteId).update({
            ...note,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Note updated successfully!');
        await loadNotes();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function deleteNote(noteId) {
    showModal('Confirm Delete', 'Are you sure you want to delete this note?', async () => {
        showLoading();
        try {
            await db.collection('notes').doc(noteId).delete();
            showToast('Note deleted successfully!');
            await loadNotes();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    });
}

// Note Loading and Filtering
async function loadNotes() {
    if (!currentUser) return;

    showLoading();
    try {
        const searchTerm = searchInput.value.toLowerCase();
        const categoryFilter = filterCategory.value;

        let query = db.collection('notes').where('userId', '==', currentUser.uid);
        
        try {
            query = query.orderBy(currentSort.field, currentSort.direction);
        } catch (indexError) {
            query = db.collection('notes')
                .where('userId', '==', currentUser.uid)
                .orderBy('createdAt', 'desc');
            showToast('Some sorting options are temporarily unavailable. Using default sort.', 'error');
        }

        const snapshot = await query.get();
        let notes = [];
        
        snapshot.forEach(doc => {
            const note = doc.data();
            if (categoryFilter !== 'all' && note.category !== categoryFilter) return;
            if (searchTerm && !note.title.toLowerCase().includes(searchTerm) && 
                !note.content.toLowerCase().includes(searchTerm)) return;
            notes.push({ id: doc.id, ...note });
        });

        renderNotes(notes);
    } catch (error) {
        console.error('Load Notes Error:', error);
        showToast('Error loading notes. Please try again later.', 'error');
    } finally {
        hideLoading();
    }
}

function renderNotes(notes) {
    notesContainer.innerHTML = '';
    
    notes.forEach(note => {
        const noteElement = createNoteElement(note);
        notesContainer.appendChild(noteElement);
    });
}

function createNoteElement(note) {
    const div = document.createElement('div');
    div.className = 'note-card slide-up';
    
    const timestamp = note.updatedAt ? new Date(note.updatedAt.seconds * 1000) : new Date();
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(timestamp);

    div.innerHTML = `
        <div class="note-header">
            <h3>${escapeHtml(note.title)}</h3>
            <span class="note-category">${escapeHtml(note.category)}</span>
        </div>
        <div class="note-content">${escapeHtml(note.content)}</div>
        <div class="note-footer">
            <span>Last updated: ${formattedDate}</span>
            <div class="note-actions">
                <button class="btn-icon edit-note" title="Edit Note">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon delete-note" title="Delete Note">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;

    div.querySelector('.edit-note').addEventListener('click', () => {
        showEditModal(note);
    });
    
    div.querySelector('.delete-note').addEventListener('click', () => {
        deleteNote(note.id);
    });

    return div;
}

// Modal Management
function showModal(title, message, callback = null) {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirm = document.getElementById('modalConfirm');
    const modalCancel = document.getElementById('modalCancel');
    const modalClose = document.querySelector('.modal-close');

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    modalConfirm.onclick = async () => {
        if (callback) {
            await callback();
            modal.classList.remove('active');
        }
    };

    modalCancel.onclick = () => modal.classList.remove('active');
    modalClose.onclick = () => modal.classList.remove('active');

    modal.classList.add('active');
}

function showEditModal(note) {
    const modalContent = document.querySelector('.modal-content');
    modalContent.innerHTML = `
        <div class="modal-header">
            <h2>Edit Note</h2>
            <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="editNoteTitle">Title</label>
                <input type="text" id="editNoteTitle" value="${escapeHtml(note.title)}" required>
            </div>
            <div class="form-group">
                <label for="editNoteCategory">Category</label>
                <select id="editNoteCategory">
                    <option value="personal" ${note.category === 'personal' ? 'selected' : ''}>Personal</option>
                    <option value="work" ${note.category === 'work' ? 'selected' : ''}>Work</option>
                    <option value="ideas" ${note.category === 'ideas' ? 'selected' : ''}>Ideas</option>
                </select>
            </div>
            <div class="form-group">
                <label for="editNoteContent">Content</label>
                <textarea id="editNoteContent" required>${escapeHtml(note.content)}</textarea>
            </div>
        </div>
        <div class="modal-footer">
            <button id="modalCancel" class="btn-secondary">Cancel</button>
            <button id="modalSave" class="btn-primary">Save Changes</button>
        </div>
    `;

    const modalClose = modalContent.querySelector('.modal-close');
    const modalCancel = modalContent.querySelector('#modalCancel');
    const modalSave = modalContent.querySelector('#modalSave');

    modalClose.onclick = () => modal.classList.remove('active');
    modalCancel.onclick = () => modal.classList.remove('active');
    modalSave.onclick = async () => {
        try {
            const updatedNote = {
                title: document.getElementById('editNoteTitle').value.trim(),
                content: document.getElementById('editNoteContent').value.trim(),
                category: document.getElementById('editNoteCategory').value
            };

            if (!updatedNote.title || !updatedNote.content) {
                throw new Error('Title and content are required');
            }

            await updateNote(note.id, updatedNote);
            modal.classList.remove('active');
        } catch (error) {
            showToast(error.message, 'error');
        }
    };

    modal.classList.add('active');
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || error;
    const errorStack = error.stack || '';
    
    const formattedError = `[${timestamp}] ${context ? `[${context}] ` : ''}Error: ${errorMessage}\n${errorStack}`;
    
    console.group('%cApplication Error', 'color: #e74c3c; font-weight: bold;');
    console.error(formattedError);
    console.trace('Error trace:');
    console.groupEnd();

    return formattedError;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    initializeTheme();
    
    // Auth state observer
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        try {
            currentUser = user;
            if (user) {
                authContainer.classList.add('hidden');
                appContainer.classList.remove('hidden');
                loadNotes();
                
                // Initialize logout button
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    // Remove existing listeners before adding new one
                    const newLogoutBtn = logoutBtn.cloneNode(true);
                    logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
                    newLogoutBtn.addEventListener('click', handleLogout);
                }
            } else {
                authContainer.classList.remove('hidden');
                appContainer.classList.add('hidden');
                notesContainer.innerHTML = '';
                
                const forms = document.querySelectorAll('form');
                forms.forEach(form => form.reset());
            }
        } catch (error) {
            console.error('Auth state change error:', error);
            showToast('Error updating authentication state', 'error');
        }
    });

    // Theme toggle event
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeToggle.innerHTML = newTheme === 'dark' ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
    });

    // Search and filter events
    searchInput.addEventListener('input', debounce(loadNotes, 300));
    filterCategory.addEventListener('change', loadNotes);
    
    // Sort button event
    sortButton.addEventListener('click', () => {
        try {
            currentSort.direction = currentSort.direction === 'desc' ? 'asc' : 'desc';
            sortButton.innerHTML = `<i class="fas fa-sort-${currentSort.direction === 'desc' ? 'down' : 'up'}"></i>`;
            loadNotes();
        } catch (error) {
            logError(error, 'Sort Button');
            showToast('Error changing sort order', 'error');
        }
    });

    // Modal close events
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Save note button event
    document.getElementById('saveNoteBtn').addEventListener('click', createNote);

    // Password toggle events
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
        });
    });
});

// Global error handlers
window.onerror = function(msg, url, lineNo, columnNo, error) {
    logError(error || msg, `Global Error (${url}:${lineNo}:${columnNo})`);
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    logError(event.reason, 'Unhandled Promise Rejection');
});