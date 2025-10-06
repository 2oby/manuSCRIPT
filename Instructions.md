# manuSCRIPT - Completion & Packaging Guide

## Current Status
The app is functional with core features working:
- ✅ File selection and parsing (with chapter number, date, and title extraction)
- ✅ Settings modal with persistence
- ✅ PDF generation with custom fonts, margins, and spacing
- ✅ EPUB generation
- ✅ ZIP archiving of source files
- ✅ Retro terminal UI theme (green-on-black CRT style)
- ✅ Progress tracking during generation
- ✅ Output to Desktop with versioned folders

## Remaining Tasks

### Phase 1: UI Polish & User Experience

#### 1.1 Add Clear Files Button
**Location:** `renderer/index.html` and `renderer/app.js`

- Add a "CLEAR" button next to "SELECT FILES" button
- Wire up click handler to:
  - Clear `selectedFiles` array
  - Reset file list display to placeholder text
  - Reset "show date" checkbox to disabled state
  - Clear any status messages

#### 1.2 Remember User Inputs
**Location:** `renderer/app.js`

- Save title and author fields to localStorage on input
- Load saved values on app startup
- Clear on successful generation (optional - ask user preference)

#### 1.3 Improve Validation Feedback
**Location:** `renderer/app.js` - `handleGenerate` function

Current validation just shows error messages. Enhance to:
- Highlight empty required fields in red
- Show inline error messages near each field
- Shake animation on validation failure
- Clear validation state when user starts typing

#### 1.4 Add Generation Summary
**Location:** `renderer/app.js`

After successful generation, show a summary:
- Number of chapters processed
- Output formats created
- Total file size
- Chapter range (e.g., "Chapters 1-12")

### Phase 2: Error Handling & Edge Cases

#### 2.1 Handle File Read Errors
**Location:** `src/fileParser.js` and main process handlers

- Catch and report individual file read errors
- Allow generation to continue with remaining files
- Show which files failed in error message

#### 2.2 Handle Disk Space Issues
**Location:** `main.js` generation handler

- Check available disk space before generation
- Show friendly error if insufficient space
- Suggest clearing space or choosing different location

#### 2.3 Handle Long Filenames/Paths
**Location:** `src/fileParser.js`

- Truncate very long filenames in display (show first 60 chars + "...")
- Keep full path in data structure
- Add tooltip on hover to show full path

#### 2.4 Handle Special Characters
**Location:** Output directory creation in `main.js`

Current code: `data.title.replace(/[^a-z0-9]/gi, '_')`

Improve to:
- Preserve spaces and hyphens where appropriate
- Handle Unicode characters gracefully
- Limit directory name length to 100 characters
- Show sanitized name to user before generation

### Phase 3: Additional Features

#### 3.1 Add Custom Separator Filtering
**Location:** New settings section

Add to settings modal:
- Text input: "Ignore these strings in titles" (comma-separated)
- Default: "-d-, --, -- HERE --"
- Save to settings
- Apply in `fileParser.js` when extracting titles

#### 3.2 Add Output Directory Selection
**Location:** Main window and `main.js`

- Add button: "Change Output Location" (default: Desktop)
- Use `dialog.showOpenDialog` with `properties: ['openDirectory']`
- Save preference to localStorage
- Display current output location in UI

#### 3.3 Add Recent Files List
**Location:** `renderer/app.js`

- Track last 5 sets of files selected
- Show in dropdown or list
- Quick-load previous selections
- Persist in localStorage

#### 3.4 Drag-and-Drop File Selection
**Location:** `renderer/index.html` and `renderer/app.js`

Add drag-and-drop to file list area:
```javascript
fileList.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files)
    .filter(f => ['.txt', '.md', '.rtf'].includes(path.extname(f.path)))
    .map(f => f.path);
  if (files.length > 0) {
    selectedFiles = files;
    displayFiles(files);
  }
});
```

### Phase 4: Testing & Bug Fixes

#### 4.1 Test Edge Cases
- Empty text files
- Files with no chapter numbers
- Files with same chapter numbers
- Very large files (>10MB)
- Special characters in filenames
- Mixed line endings (CRLF vs LF)

#### 4.2 Test All Font Combinations
- Georgia + PDF + EPUB
- Arial + PDF + EPUB  
- Courier New + PDF + EPUB
- Verify bold/italic chapter headers work

#### 4.3 Test All Settings Combinations
- Different page sizes (A4 vs A5)
- Different margins (extreme values)
- Different line spacing (1, 1.5, 2)
- All checkbox combinations

### Phase 5: Packaging & Distribution

#### 5.1 Update package.json
**Location:** `package.json`

Update metadata:
```json
{
  "name": "manuscript-app",
  "productName": "manuSCRIPT",
  "version": "1.0.0",
  "description": "Combine chapter files into PDF/EPUB with retro terminal style",
  "author": "Your Name <your@email.com>",
  "license": "MIT"
}
```

#### 5.2 Create App Icon
**Location:** `build/` directory

Create icons:
- `icon.icns` for macOS (512x512 PNG converted)
- `icon.ico` for Windows (256x256 PNG converted)
- Use retro terminal theme (green on black, pixelated style)

Tools:
- png2icons.com (online converter)
- Or: `npm install -g png2icons` then `png2icons input.png output --icns --ico`

Update `package.json`:
```json
"build": {
  "appId": "com.manuscript.app",
  "productName": "manuSCRIPT",
  "mac": {
    "category": "public.app-category.productivity",
    "icon": "build/icon.icns",
    "target": ["dmg", "zip"]
  },
  "win": {
    "icon": "build/icon.ico",
    "target": ["nsis"]
  },
  "files": [
    "**/*",
    "!**/*.md",
    "!.DS_Store"
  ]
}
```

#### 5.3 Build for macOS
```bash
npm run build:mac
```

This creates:
- `dist/manuSCRIPT-1.0.0.dmg` - Drag-and-drop installer
- `dist/manuSCRIPT-1.0.0-mac.zip` - Direct app bundle

Test the built app:
1. Open the DMG
2. Drag manuSCRIPT to Applications
3. Run from Applications folder
4. Verify all features work
5. Check that it handles permissions correctly

#### 5.4 Code Signing (Optional but Recommended)

**For macOS:**
Without signing, users will see "unidentified developer" warning.

To sign:
1. Join Apple Developer Program ($99/year)
2. Create Developer ID Application certificate
3. Update package.json:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAMID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

4. Create `build/entitlements.mac.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

#### 5.5 Build for Windows (from Mac)

Install Windows build tools:
```bash
npm install --save-dev electron-builder
```

Build:
```bash
npm run build:win
```

This creates:
- `dist/manuSCRIPT Setup 1.0.0.exe` - Windows installer

**Note:** You won't be able to fully test the Windows build on Mac. Consider:
- Using a Windows VM (Parallels, VMware)
- Using a Windows PC for final testing
- Using CI/CD (GitHub Actions) to build both platforms

### Phase 6: Documentation

#### 6.1 Create README.md
**Location:** Project root

Include:
- App description
- Features list
- Installation instructions
- Usage guide with screenshots
- File naming conventions
- Troubleshooting section
- License information

#### 6.2 Create User Guide
**Location:** `docs/USER_GUIDE.md`

Include:
- Getting started
- File preparation tips
- Settings explanation
- Output formats comparison
- Tips and tricks
- FAQ

#### 6.3 Add In-App Help
**Location:** New help modal in UI

- Add "?" button in header
- Modal with:
  - Quick start guide
  - File naming examples
  - Keyboard shortcuts (if any)
  - Link to full documentation

### Phase 7: Final Polish

#### 7.1 Performance Optimization
- Test with 50+ chapter files
- Add loading indicator during file parsing
- Consider streaming for very large files
- Optimize PDF generation for large documents

#### 7.2 Accessibility
- Add keyboard shortcuts:
  - Cmd/Ctrl+O: Open files
  - Cmd/Ctrl+G: Generate
  - Cmd/Ctrl+,: Open settings
  - Escape: Close modals
- Add ARIA labels to buttons
- Ensure good contrast ratios
- Test with screen reader

#### 7.3 UI Refinements
- Add subtle animations (fade in/out)
- Polish button hover effects
- Add scanline effect for more authentic CRT feel (optional)
- Add sound effects for button clicks (optional, toggle in settings)

## Testing Checklist

### Core Functionality
- [ ] File selection works
- [ ] File parsing extracts chapter numbers correctly
- [ ] File parsing extracts dates correctly
- [ ] File parsing extracts titles correctly
- [ ] Files sort by chapter number
- [ ] Settings modal opens/closes
- [ ] Settings save and persist
- [ ] Settings reset works
- [ ] PDF generates correctly
- [ ] EPUB generates correctly
- [ ] ZIP archive creates correctly
- [ ] Output directory versioning works
- [ ] "Open Folder" link works

### Edge Cases
- [ ] Empty title/author shows validation error
- [ ] No files selected shows error
- [ ] No output formats selected shows error
- [ ] Files with no chapter numbers are handled
- [ ] Files with duplicate chapter numbers are handled
- [ ] Very long filenames are handled
- [ ] Special characters in filenames are handled
- [ ] Files with no dates disable "show date" checkbox

### UI/UX
- [ ] All buttons respond to clicks
- [ ] Modal closes when clicking outside
- [ ] Progress bar animates smoothly
- [ ] Status messages are clear
- [ ] Font dropdown works
- [ ] All checkboxes toggle correctly
- [ ] All radio buttons work
- [ ] Number inputs accept valid ranges

### Generated Output
- [ ] PDF opens correctly
- [ ] PDF has correct fonts
- [ ] PDF has correct margins
- [ ] PDF has correct spacing
- [ ] PDF chapter headers are formatted correctly
- [ ] PDF shows dates when enabled
- [ ] EPUB opens in reader
- [ ] EPUB has table of contents
- [ ] EPUB chapters are in correct order
- [ ] ZIP contains all source files

## Known Limitations & Future Enhancements

### Current Limitations
1. Only processes .txt, .md, and .rtf files
2. Output directory is Desktop only (can be enhanced)
3. No preview before generation
4. No undo/redo
5. No batch processing of multiple manuscripts

### Future Enhancement Ideas
1. **Live Preview**: Show how manuscript will look before generating
2. **Custom CSS for EPUB**: Allow users to provide custom stylesheet
3. **Chapter Reordering**: Drag-and-drop to reorder chapters in UI
4. **Template System**: Save/load manuscript templates
5. **Cover Image**: Add cover image support for EPUB
6. **Multiple Output Directories**: Generate to different locations
7. **Cloud Storage**: Save directly to Dropbox/Google Drive
8. **Collaboration**: Share manuscript projects
9. **Version Control**: Track changes to manuscript over time
10. **Export Formats**: Add MOBI, DOCX, HTML formats

## File Structure Reference

```
manuscript-app/
├── package.json
├── main.js                    # Electron main process
├── renderer/
│   ├── index.html            # Main UI
│   ├── styles.css            # Terminal theme CSS
│   ├── app.js                # UI logic
│   └── logo.png              # App logo
├── src/
│   ├── fileParser.js         # Filename parsing
│   ├── pdfGenerator.js       # PDF creation
│   ├── epubGenerator.js      # EPUB creation
│   └── archiver.js           # ZIP creation
├── build/                     # Build assets
│   ├── icon.icns             # macOS icon
│   ├── icon.ico              # Windows icon
│   └── entitlements.mac.plist # macOS entitlements
├── dist/                      # Built apps (gitignored)
└── docs/
    ├── README.md
    └── USER_GUIDE.md
```

## Development Commands

```bash
# Run in development
npm start

# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for both
npm run build

# Clean dist folder
rm -rf dist/
```

## Deployment Checklist

- [ ] All features tested
- [ ] No console errors
- [ ] Settings persist correctly
- [ ] Files generate correctly
- [ ] App icon created
- [ ] package.json updated with correct metadata
- [ ] README.md created
- [ ] Built for macOS
- [ ] Built for Windows (if needed)
- [ ] Tested built app (not just dev mode)
- [ ] Created release notes
- [ ] Tagged version in git
- [ ] Distributed to users

## Support & Troubleshooting

### Common Issues

**"App can't be opened because it's from an unidentified developer"**
- Right-click app → Open → Click "Open" in dialog
- Or: System Preferences → Security & Privacy → Click "Open Anyway"

**Generated files are blank**
- Check that source files contain text
- Verify file encoding is UTF-8
- Check console for errors

**Settings not saving**
- Check browser localStorage is enabled
- Clear app data and try again

**Generation is slow**
- Normal for large manuscripts (50+ chapters)
- Consider splitting into volumes

---

## Next Session Prompt

When resuming work on this app, use this prompt:

"I'm continuing work on manuSCRIPT, an Electron desktop app that combines chapter text files into PDF/EPUB. The core functionality is complete. Please help me work through the remaining tasks in the completion guide, starting with Phase 1: UI Polish. The app currently works but needs refinement and packaging."

Good luck finishing manuSCRIPT! 🚀📚