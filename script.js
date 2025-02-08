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
const logoutBtn = document.getElementById('logoutBtn');
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

themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    themeToggle.innerHTML = newTheme === 'dark' ? 
        '<i class="fas fa-sun"></i>' : 
        '<i class="fas fa-moon"></i>';
});

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

logoutBtn.addEventListener('click', () => {
    showModal('Confirm Logout', 'Are you sure you want to logout?', async () => {
        showLoading();
        try {
            // First sign out from Firebase
            await auth.signOut();
            
            // Clear application state
            currentUser = null;
            
            // Clear UI elements
            notesContainer.innerHTML = '';
            document.getElementById('newNoteTitle').value = '';
            document.getElementById('newNoteContent').value = '';
            document.getElementById('newNoteCategory').value = 'personal';
            searchInput.value = '';
            filterCategory.value = 'all';
            
            // Reset sort state
            currentSort = { field: 'updatedAt', direction: 'desc' };
            sortButton.innerHTML = '<i class="fas fa-sort-down"></i>';
            
            // Switch container visibility
            appContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
            
            // Close modal explicitly
            modal.classList.remove('active');
            
            // Show success message after state is cleared
            showToast('Logged out successfully!');
        } catch (error) {
            logError(error, 'Logout');
            showToast('Error during logout. Please try again.', 'error');
        } finally {
            hideLoading();
        }
    });
});



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

        // Start with a simpler query that doesn't require a composite index
        let query = db.collection('notes').where('userId', '==', currentUser.uid);
        
        try {
            // Try to add ordering if index exists
            query = query.orderBy(currentSort.field, currentSort.direction);
        } catch (indexError) {
            logError(indexError, 'Index Missing');
            // Fall back to timestamp ordering which usually has a default index
            query = db.collection('notes')
                .where('userId', '==', currentUser.uid)
                .orderBy('createdAt', 'desc');
            
            // Show a more user-friendly message about the sorting limitation
            showToast('Some sorting options are temporarily unavailable. Using default sort.', 'error');
        }

        const snapshot = await query.get();
        let notes = [];
        
        snapshot.forEach(doc => {
            const note = doc.data();
            // Apply filters in memory if we can't do it in query
            if (categoryFilter !== 'all' && note.category !== categoryFilter) return;
            if (searchTerm && !note.title.toLowerCase().includes(searchTerm) && 
                !note.content.toLowerCase().includes(searchTerm)) return;
            notes.push({ id: doc.id, ...note });
        });

        // If we couldn't order in query, sort in memory
        if (currentSort.field !== 'createdAt') {
            notes.sort((a, b) => {
                const aValue = a[currentSort.field];
                const bValue = b[currentSort.field];
                
                if (aValue instanceof Date || (aValue?.seconds && bValue?.seconds)) {
                    const aTime = aValue instanceof Date ? aValue : new Date(aValue.seconds * 1000);
                    const bTime = bValue instanceof Date ? bValue : new Date(bValue.seconds * 1000);
                    return currentSort.direction === 'desc' ? bTime - aTime : aTime - bTime;
                }
                
                if (currentSort.direction === 'desc') {
                    return bValue > aValue ? 1 : -1;
                }
                return aValue > bValue ? 1 : -1;
            });
        }

        renderNotes(notes);
        
        // Show index creation helper for administrators
        if (currentUser.email.endsWith('@admin.com')) {
            console.info('%cAdmin Notice: Create the required index using this link:', 'color: #3498db; font-weight: bold;');
            console.info('https://console.firebase.google.com/project/notepad-da9ed/firestore/indexes');
            console.info('Required index:', {
                collection: 'notes',
                fields: [
                    { field: 'userId', type: 'ascending' },
                    { field: currentSort.field, type: currentSort.direction }
                ]
            });
        }
    } catch (error) {
        logError(error, 'Load Notes');
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

    // Add event listeners
    div.querySelector('.edit-note').addEventListener('click', () => {
        showEditModal(note);
    });
    
    div.querySelector('.delete-note').addEventListener('click', () => {
        deleteNote(note.id);
    });

    return div;
}

// Edit modal functionality
function showEditModal(note) {
    try {
        const modalContent = document.querySelector('.modal-content');
        if (!modalContent) {
            throw new Error('Modal content element not found');
        }

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

        // Add event listeners
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
                logError(error, 'Save Note');
                showToast(error.message, 'error');
            }
        };

        modal.classList.add('active');
    } catch (error) {
        logError(error, 'Show Edit Modal');
        showToast('Failed to open edit modal', 'error');
    }
}

// Modal Management
function showModal(title, message, callback = null) {
    try {
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirm = document.getElementById('modalConfirm');
        const modalCancel = document.getElementById('modalCancel');
        const modalClose = document.querySelector('.modal-close');

        if (!modalTitle || !modalMessage || !modalConfirm || !modalCancel) {
            throw new Error('Modal elements not found');
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        
        // Remove any existing event listeners
        modalConfirm.replaceWith(modalConfirm.cloneNode(true));
        modalCancel.replaceWith(modalCancel.cloneNode(true));
        modalClose.replaceWith(modalClose.cloneNode(true));
        
        // Get the fresh elements
        const newModalConfirm = document.getElementById('modalConfirm');
        const newModalCancel = document.getElementById('modalCancel');
        const newModalClose = document.querySelector('.modal-close');
        
        if (callback) {
            newModalConfirm.onclick = async () => {
                try {
                    await callback();
                    modal.classList.remove('active');
                } catch (error) {
                    logError(error, 'Modal Callback');
                    showToast(error.message, 'error');
                }
            };
            newModalConfirm.style.display = 'block';
            newModalCancel.style.display = 'block';
        } else {
            newModalConfirm.style.display = 'none';
            newModalCancel.style.display = 'none';
        }

        // Set up close handlers
        newModalClose.onclick = () => modal.classList.remove('active');
        newModalCancel.onclick = () => modal.classList.remove('active');
        
        modal.classList.add('active');
    } catch (error) {
        logError(error, 'Show Modal');
        showToast('Error showing modal', 'error');
    }
}

// Utility Functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    
    // Auth state observer
    auth.onAuthStateChanged((user) => {
        try {
            currentUser = user;
            if (user) {
                // User is signed in
                authContainer.classList.add('hidden');
                appContainer.classList.remove('hidden');
                loadNotes();
            } else {
                // User is signed out - ensure cleanup
                authContainer.classList.remove('hidden');
                appContainer.classList.add('hidden');
                notesContainer.innerHTML = '';
                
                // Clear any form data for security
                const forms = document.querySelectorAll('form');
                forms.forEach(form => form.reset());
            }
        } catch (error) {
            logError(error, 'Auth State Change');
            showToast('Error updating authentication state', 'error');
        }
    });

    // Search and filter
    searchInput.addEventListener('input', debounce(loadNotes, 300));
    filterCategory.addEventListener('change', loadNotes);
    
    // Sort button
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

    // Modal close button
    document.querySelector('.modal-close').addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Save note button
    document.getElementById('saveNoteBtn').addEventListener('click', createNote);

    // Password toggle buttons
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
            input.setAttribute('type', type);
            this.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
        });
    });
});

// Debounce function for search
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



window.onerror = function(msg, url, lineNo, columnNo, error) {
    logError(error || msg, `Global Error (${url}:${lineNo}:${columnNo})`);
    return false;
};

window.addEventListener('unhandledrejection', function(event) {
    logError(event.reason, 'Unhandled Promise Rejection');
});
function logError(error, context = '') {
    const timestamp = new Date().toISOString();
    const errorMessage = error.message || error;
    const errorStack = error.stack || '';
    
    // Format the error message
    const formattedError = `[${timestamp}] ${context ? `[${context}] ` : ''}Error: ${errorMessage}\n${errorStack}`;
    
    // Log to console with styling
    console.group('%cApplication Error', 'color: #e74c3c; font-weight: bold;');
    console.error(formattedError);
    console.trace('Error trace:');
    console.groupEnd();

    // You could also send this to a logging service here
    return formattedError;
}


async function handleLogout() {
    showLoading();
    try {
        await auth.signOut();
        // Clear any user state
        currentUser = null;
        // Clear any sensitive data
        notesContainer.innerHTML = '';
        document.getElementById('newNoteTitle').value = '';
        document.getElementById('newNoteContent').value = '';
        document.getElementById('newNoteCategory').value = 'personal';
        // Reset search and filter
        searchInput.value = '';
        filterCategory.value = 'all';
        // Reset sort
        currentSort = { field: 'updatedAt', direction: 'desc' };
        sortButton.innerHTML = '<i class="fas fa-sort-down"></i>';
        // Hide app container and show auth container
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        // Show success message
        showToast('Logged out successfully!');
        // Close any open modals
        modal.classList.remove('active');
    } catch (error) {
        logError(error, 'Logout');
        showToast('Error during logout. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}


