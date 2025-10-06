const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');



let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 1120,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    titleBarStyle: 'default',
    frame: true
  });

  mainWindow.loadFile('renderer/index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handler for file selection
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Text Files', extensions: ['txt', 'md', 'rtf'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    return result.filePaths;
  }
  return null;
});

// IPC Handler for output directory selection
ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC Handler for manuscript generation
ipcMain.handle('generate-manuscript', async (event, data) => {
  const { parseAndSortFiles, readFileContent } = require('./src/fileParser');
  const { generatePDF } = require('./src/pdfGenerator');
  const { generateEPUB } = require('./src/epubGenerator');
  const { createZipArchive } = require('./src/archiver');
  
  try {
    // Parse and sort files with custom separators
    const result = parseAndSortFiles(data.files, data.ignoreSeparators);
    const chapters = result.files;

    // Determine base output path (custom or Desktop)
    const baseOutputPath = data.outputDir || path.join(os.homedir(), 'Desktop');

    // Check available disk space
    try {
      const stats = fs.statfsSync(baseOutputPath);
      const availableSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);

      // Require at least 100MB free space (conservative estimate)
      if (availableSpaceGB < 0.1) {
        return {
          success: false,
          error: `Insufficient disk space. Only ${availableSpaceGB.toFixed(2)}GB available. Please free up space and try again.`
        };
      }
    } catch (spaceCheckError) {
      // If we can't check space, continue anyway
      console.warn('Could not check disk space:', spaceCheckError);
    }

    // Create output directory with better sanitization
    // Preserve spaces and hyphens, remove problematic characters
    let sanitizedTitle = data.title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // Remove invalid filesystem characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100); // Limit to 100 characters

    // Ensure title is not empty after sanitization
    if (!sanitizedTitle || sanitizedTitle.trim() === '') {
      sanitizedTitle = 'manuscript';
    }

    let outputDir = path.join(baseOutputPath, sanitizedTitle);
    
    // Check if directory exists and add version suffix if needed
    let version = 1;
    let finalOutputDir = outputDir;
    while (fs.existsSync(finalOutputDir)) {
      version++;
      finalOutputDir = `${outputDir}_v${version}`;
    }
    
    fs.mkdirSync(finalOutputDir, { recursive: true });
    
    // Copy files to temp directory for safety
    const tempDir = path.join(os.tmpdir(), `manuscript_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    event.sender.send('generation-progress', { percent: 10, message: 'Copying files...' });
    
    // Generate outputs
    const outputs = [];
    const allWarnings = [];
    let currentProgress = 20;

    // Generate ZIP
    if (data.options.archiveZip) {
      event.sender.send('generation-progress', { percent: currentProgress, message: 'Creating ZIP archive...' });
      const zipPath = path.join(finalOutputDir, `${data.title}_source.zip`);
      await createZipArchive(chapters, zipPath);
      outputs.push({ type: 'zip', path: zipPath });
      currentProgress += 25;
    }

    // Generate PDF
    if (data.options.generatePdf) {
      event.sender.send('generation-progress', { percent: currentProgress, message: 'Generating PDF...' });
      const pdfPath = path.join(finalOutputDir, `${data.title}.pdf`);
      const pdfResult = await generatePDF(chapters, pdfPath, {
        title: data.title,
        author: data.author,
        font: data.font,
        settings: data.settings,
        showDate: data.options.showDate
      });

      if (typeof pdfResult === 'object' && pdfResult.warnings) {
        outputs.push({ type: 'pdf', path: pdfResult.path });
        allWarnings.push(...pdfResult.warnings.map(w => ({ ...w, format: 'PDF' })));
      } else {
        outputs.push({ type: 'pdf', path: pdfResult });
      }
      currentProgress += 25;
    }

    // Generate EPUB
    if (data.options.generateEpub) {
      event.sender.send('generation-progress', { percent: currentProgress, message: 'Generating EPUB...' });
      const epubPath = path.join(finalOutputDir, `${data.title}.epub`);
      const epubResult = await generateEPUB(chapters, epubPath, {
        title: data.title,
        author: data.author,
        font: data.font,
        settings: data.settings,
        showDate: data.options.showDate
      });

      if (typeof epubResult === 'object' && epubResult.warnings) {
        outputs.push({ type: 'epub', path: epubResult.path });
        allWarnings.push(...epubResult.warnings.map(w => ({ ...w, format: 'EPUB' })));
      } else {
        outputs.push({ type: 'epub', path: epubResult });
      }
      currentProgress += 25;
    }
    
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    event.sender.send('generation-progress', { percent: 100, message: 'Complete!' });

    return {
      success: true,
      outputDir: finalOutputDir,
      outputs: outputs,
      numChapters: chapters.length,
      warnings: allWarnings
    };
    
  } catch (error) {
    console.error('Generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC Handler to open folder
ipcMain.handle('open-folder', async (event, folderPath) => {
  shell.openPath(folderPath);
});
