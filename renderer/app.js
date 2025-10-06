const { ipcRenderer } = require('electron');
const path = require('path');
const { parseAndSortFiles } = require('../src/fileParser');

// DOM Elements
const selectFilesBtn = document.getElementById('selectFilesBtn');
const clearFilesBtn = document.getElementById('clearFilesBtn');
const fileList = document.getElementById('fileList');
const generateBtn = document.getElementById('generateBtn');
const settingsBtn = document.getElementById('settingsBtn');
const changeOutputBtn = document.getElementById('changeOutputBtn');
const outputLocation = document.getElementById('outputLocation');
const statusMessage = document.getElementById('statusMessage');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const outputPath = document.getElementById('outputPath');
const statusSection = document.querySelector('.status-section');

// Checkboxes
const archiveZip = document.getElementById('archiveZip');
const generateEpub = document.getElementById('generateEpub');
const generatePdf = document.getElementById('generatePdf');
const showDate = document.getElementById('showDate');
const showDateLabel = document.getElementById('showDateLabel');

// Input fields
const manuscriptTitle = document.getElementById('manuscriptTitle');
const manuscriptAuthor = document.getElementById('manuscriptAuthor');
const fontFamily = document.getElementById('fontFamily');

// Settings Modal
const settingsModal = document.getElementById('settingsModal');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');

// State
let selectedFiles = [];
let hasDateInFiles = false;
let outputDir = null; // null means use default (Desktop)

// Default Settings
const defaultSettings = {
    marginTop: 25.4,
    marginBottom: 25.4,
    marginLeft: 25.4,
    marginRight: 25.4,
    lineSpacing: 1.5,
    paragraphSpacing: 12,
    pageSize: 'A4',
    epubToc: true,
    chapterFontSize: 18,
    chapterBold: true,
    chapterItalic: false,
    ignoreSeparators: '-d-, --, -- HERE --, --c--'
};

let currentSettings = { ...defaultSettings };

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('manuscriptSettings');
    if (saved) {
        currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
    }
    applySettingsToModal();
}

// Load user inputs from localStorage
function loadUserInputs() {
    const savedTitle = localStorage.getItem('manuscriptTitle');
    const savedAuthor = localStorage.getItem('manuscriptAuthor');
    const savedOutputDir = localStorage.getItem('outputDirectory');

    if (savedTitle) {
        manuscriptTitle.value = savedTitle;
    }
    if (savedAuthor) {
        manuscriptAuthor.value = savedAuthor;
    }
    if (savedOutputDir) {
        outputDir = savedOutputDir;
        updateOutputLocationDisplay();
    }
}

// Update output location display
function updateOutputLocationDisplay() {
    if (outputDir) {
        outputLocation.textContent = outputDir;
    } else {
        outputLocation.textContent = 'Desktop';
    }
}

// Save user inputs to localStorage
function saveUserInputs() {
    localStorage.setItem('manuscriptTitle', manuscriptTitle.value);
    localStorage.setItem('manuscriptAuthor', manuscriptAuthor.value);
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('manuscriptSettings', JSON.stringify(currentSettings));
}

// Apply settings to modal inputs
function applySettingsToModal() {
    document.getElementById('marginTop').value = currentSettings.marginTop;
    document.getElementById('marginBottom').value = currentSettings.marginBottom;
    document.getElementById('marginLeft').value = currentSettings.marginLeft;
    document.getElementById('marginRight').value = currentSettings.marginRight;
    document.querySelector(`input[name="lineSpacing"][value="${currentSettings.lineSpacing}"]`).checked = true;
    document.getElementById('paragraphSpacing').value = currentSettings.paragraphSpacing;
    document.querySelector(`input[name="pageSize"][value="${currentSettings.pageSize}"]`).checked = true;
    document.getElementById('epubToc').checked = currentSettings.epubToc;
    document.getElementById('chapterFontSize').value = currentSettings.chapterFontSize;
    document.getElementById('chapterBold').checked = currentSettings.chapterBold;
    document.getElementById('chapterItalic').checked = currentSettings.chapterItalic;
    document.getElementById('ignoreSeparators').value = currentSettings.ignoreSeparators;
}

// Get settings from modal inputs
function getSettingsFromModal() {
    return {
        marginTop: parseFloat(document.getElementById('marginTop').value),
        marginBottom: parseFloat(document.getElementById('marginBottom').value),
        marginLeft: parseFloat(document.getElementById('marginLeft').value),
        marginRight: parseFloat(document.getElementById('marginRight').value),
        lineSpacing: parseFloat(document.querySelector('input[name="lineSpacing"]:checked').value),
        paragraphSpacing: parseInt(document.getElementById('paragraphSpacing').value),
        pageSize: document.querySelector('input[name="pageSize"]:checked').value,
        epubToc: document.getElementById('epubToc').checked,
        chapterFontSize: parseInt(document.getElementById('chapterFontSize').value),
        chapterBold: document.getElementById('chapterBold').checked,
        chapterItalic: document.getElementById('chapterItalic').checked,
        ignoreSeparators: document.getElementById('ignoreSeparators').value
    };
}

// Handle file selection (used by button and drag-drop)
async function handleFileSelection(files) {
    if (files && files.length > 0) {
        selectedFiles = files;
        displayFiles(files);
        checkForDates(files);
    }
}

// Event Listeners
selectFilesBtn.addEventListener('click', async () => {
    try {
        const files = await ipcRenderer.invoke('select-files');
        await handleFileSelection(files);
    } catch (error) {
        console.error('Error selecting files:', error);
    }
});

// Drag and drop handlers
fileList.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileList.style.borderColor = '#00FF00';
    fileList.style.backgroundColor = 'rgba(0, 255, 0, 0.1)';
});

fileList.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileList.style.borderColor = '#00FF00';
    fileList.style.backgroundColor = 'rgba(0, 255, 0, 0.02)';
});

fileList.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileList.style.borderColor = '#00FF00';
    fileList.style.backgroundColor = 'rgba(0, 255, 0, 0.02)';

    const files = Array.from(e.dataTransfer.files)
        .filter(f => {
            const ext = path.extname(f.path).toLowerCase();
            return ['.txt', '.md', '.rtf'].includes(ext);
        })
        .map(f => f.path);

    await handleFileSelection(files);
});

clearFilesBtn.addEventListener('click', () => {
    selectedFiles = [];
    fileList.innerHTML = '<div class="placeholder">No files selected. Click "SELECT FILES" to begin.</div>';
    showDateLabel.classList.add('disabled');
    showDate.disabled = true;
    showDate.checked = false;
    hasDateInFiles = false;
    statusMessage.textContent = '';
    statusSection.classList.remove('active');
    progressBar.style.display = 'none';
    outputPath.style.display = 'none';
});

generateBtn.addEventListener('click', handleGenerate);

settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
});

changeOutputBtn.addEventListener('click', async () => {
    try {
        const result = await ipcRenderer.invoke('select-output-directory');
        if (result) {
            outputDir = result;
            localStorage.setItem('outputDirectory', outputDir);
            updateOutputLocationDisplay();
        }
    } catch (error) {
        console.error('Error selecting output directory:', error);
    }
});

saveSettingsBtn.addEventListener('click', () => {
    currentSettings = getSettingsFromModal();
    saveSettings();
    settingsModal.style.display = 'none';
    showStatus('Settings saved', 'success');
});

cancelSettingsBtn.addEventListener('click', () => {
    applySettingsToModal();
    settingsModal.style.display = 'none';
});

resetSettingsBtn.addEventListener('click', () => {
    currentSettings = { ...defaultSettings };
    applySettingsToModal();
    showStatus('Settings reset to defaults', 'success');
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Display selected files with chapter info
function displayFiles(files) {
    const result = parseAndSortFiles(files, currentSettings.ignoreSeparators);

    // Update global state
    hasDateInFiles = result.hasDates;
    selectedFiles = result.files.map(f => f.filepath);
    
    // Display files
    fileList.innerHTML = '';
    
    if (result.warnings.length > 0) {
        result.warnings.forEach(warning => {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'file-item';
            warningDiv.style.color = '#FFAA00';
            warningDiv.textContent = `⚠ ${warning.message}`;
            fileList.appendChild(warningDiv);
        });
    }
    
    result.files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';

        let displayText = '';
        if (file.chapterNumber !== null) {
            displayText += `Ch ${file.chapterNumber}`;
            if (file.dateString) {
                displayText += ` (${file.dateString})`;
            }
            displayText += `: ${file.title}`;
        } else {
            displayText += `${file.filename}`;
        }

        // Truncate very long filenames (keep first 80 chars)
        if (displayText.length > 80) {
            displayText = displayText.substring(0, 77) + '...';
            div.title = file.filepath; // Full path in tooltip
        }

        div.textContent = displayText;
        fileList.appendChild(div);
    });
    
    // Update show date checkbox
    if (!hasDateInFiles) {
        showDateLabel.classList.add('disabled');
        showDate.disabled = true;
        showDate.checked = false;
    } else {
        showDateLabel.classList.remove('disabled');
        showDate.disabled = false;
    }
    
    // Show chapter range if available
    if (result.chapterRange) {
        const rangeDiv = document.createElement('div');
        rangeDiv.className = 'file-item';
        rangeDiv.style.borderTop = '1px solid #00FF00';
        rangeDiv.style.marginTop = '5px';
        rangeDiv.style.paddingTop = '5px';
        rangeDiv.textContent = `Chapter range: ${result.chapterRange.min} - ${result.chapterRange.max}`;
        fileList.appendChild(rangeDiv);
    }
}


// Check if files have dates in filenames
function checkForDates(files) {
    hasDateInFiles = files.some(file => {
        const filename = path.basename(file);
        return /\d{2,4}/.test(filename) || /BCE|AD|CE/i.test(filename);
    });
    
    if (!hasDateInFiles) {
        showDateLabel.classList.add('disabled');
        showDate.disabled = true;
        showDate.checked = false;
    } else {
        showDateLabel.classList.remove('disabled');
        showDate.disabled = false;
    }
}

// Clear validation errors
function clearValidationErrors() {
    manuscriptTitle.classList.remove('error');
    manuscriptAuthor.classList.remove('error');
    document.getElementById('titleError').classList.remove('visible');
    document.getElementById('authorError').classList.remove('visible');
}

// Show validation error for a field
function showFieldError(field, errorElement) {
    field.classList.add('error');
    errorElement.classList.add('visible');
    field.style.animation = 'shake 0.5s';
    setTimeout(() => {
        field.style.animation = '';
    }, 500);
}

// Handle Generate button
async function handleGenerate() {
    // Clear previous errors
    clearValidationErrors();

    let hasErrors = false;

    // Validation
    if (selectedFiles.length === 0) {
        showError('Please select files first');
        return;
    }

    if (!archiveZip.checked && !generateEpub.checked && !generatePdf.checked) {
        showError('Please select at least one output format');
        return;
    }

    if (!manuscriptTitle.value.trim()) {
        showFieldError(manuscriptTitle, document.getElementById('titleError'));
        hasErrors = true;
    }

    if (!manuscriptAuthor.value.trim()) {
        showFieldError(manuscriptAuthor, document.getElementById('authorError'));
        hasErrors = true;
    }

    if (hasErrors) {
        showError('Please fill in all required fields');
        return;
    }

    // Prepare generation data
    const generationData = {
        files: selectedFiles,
        title: manuscriptTitle.value.trim(),
        author: manuscriptAuthor.value.trim(),
        font: fontFamily.value,
        options: {
            archiveZip: archiveZip.checked,
            generateEpub: generateEpub.checked,
            generatePdf: generatePdf.checked,
            showDate: showDate.checked && hasDateInFiles
        },
        settings: currentSettings,
        ignoreSeparators: currentSettings.ignoreSeparators,
        outputDir: outputDir // Pass custom output directory or null for default
    };

    // Show progress
    statusSection.classList.add('active');
    progressBar.style.display = 'block';
    outputPath.style.display = 'none';
    updateProgress(0, 'Starting generation...');
    generateBtn.disabled = true;

    try {
        // Call generation
        const result = await ipcRenderer.invoke('generate-manuscript', generationData);
        
        if (result.success) {
            updateProgress(100, 'Complete!');

            // Generate summary
            const summary = generateSummary(result);
            showStatus(summary, 'success');

            // Show warnings if any files failed
            let outputHTML = `Output saved to: <a href="#" id="openFolderLink">${result.outputDir}</a>`;
            if (result.warnings && result.warnings.length > 0) {
                outputHTML += '<br/><span style="color: #FFAA00;">⚠ Some files could not be read:</span><br/>';
                result.warnings.forEach(w => {
                    outputHTML += `<span style="color: #FFAA00; font-size: 11px;">  • ${w.filename} (${w.format}): ${w.error}</span><br/>`;
                });
            }
            outputPath.innerHTML = outputHTML;
            outputPath.style.display = 'block';

            // Add click handler for folder link
            document.getElementById('openFolderLink').addEventListener('click', (e) => {
                e.preventDefault();
                ipcRenderer.invoke('open-folder', result.outputDir);
            });

            // Hide progress bar after a moment
            setTimeout(() => {
                progressBar.style.display = 'none';
            }, 2000);

        } else {
            showError('Generation failed: ' + result.error);
        }
        
    } catch (error) {
        console.error('Generation error:', error);
        showError('Generation failed: ' + error.message);
    } finally {
        generateBtn.disabled = false;
    }
}

// Show status message
function showStatus(message, type = '') {
    statusSection.classList.add('active');
    statusMessage.textContent = message;
    statusMessage.className = 'status-message ' + type;
}

// Show error
function showError(message) {
    showStatus(message, 'error');
    progressBar.style.display = 'none';
}

// Update progress
function updateProgress(percent, message) {
    progressFill.style.width = percent + '%';
    showStatus(message, 'success');
}

// Generate summary after successful generation
function generateSummary(result) {
    const numChapters = selectedFiles.length;
    const formats = result.outputs.map(o => o.type.toUpperCase()).join(', ');

    // Calculate total file size
    const fs = require('fs');
    let totalSize = 0;
    result.outputs.forEach(output => {
        try {
            const stats = fs.statSync(output.path);
            totalSize += stats.size;
        } catch (e) {
            // Ignore
        }
    });

    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    // Get chapter range
    const parsedFiles = parseAndSortFiles(selectedFiles, currentSettings.ignoreSeparators);
    const chapterRange = parsedFiles.chapterRange
        ? `Chapters ${parsedFiles.chapterRange.min}-${parsedFiles.chapterRange.max}`
        : `${numChapters} chapters`;

    return `✓ Generation complete! ${chapterRange} • ${formats} • ${sizeMB}MB`;
}

// Listen for progress updates from main process
ipcRenderer.on('generation-progress', (event, data) => {
    updateProgress(data.percent, data.message);
});

// Add input listeners to save on change and clear errors
manuscriptTitle.addEventListener('input', () => {
    saveUserInputs();
    if (manuscriptTitle.value.trim()) {
        manuscriptTitle.classList.remove('error');
        document.getElementById('titleError').classList.remove('visible');
    }
});

manuscriptAuthor.addEventListener('input', () => {
    saveUserInputs();
    if (manuscriptAuthor.value.trim()) {
        manuscriptAuthor.classList.remove('error');
        document.getElementById('authorError').classList.remove('visible');
    }
});

// Initialize
loadSettings();
loadUserInputs();