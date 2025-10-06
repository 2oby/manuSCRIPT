const path = require('path');

/**
 * Parse a filename to extract chapter number, date, and title
 * Expected formats:
 * - "1_title.txt"
 * - "01_1972_title.txt"
 * - "Chapter 1 - AD 1982 - Title.txt"
 * - "2 - BCE 30000 - Title.md"
 */
function parseFilename(filepath, ignoreSeparators = '') {
    const filename = path.basename(filepath, path.extname(filepath));
    
    // Try to extract chapter number (first number in filename)
    const chapterMatch = filename.match(/\d+/);
    const chapterNumber = chapterMatch ? parseInt(chapterMatch[0]) : null;
    
    // Try to extract date/time period
    // Patterns: "1972", "AD 1982", "2020", "78 BCE", "BCE 30000"
    const datePatterns = [
        /\b(AD|CE)\s*(\d+)\b/i,           // AD 1982, CE 2020
        /\b(\d+)\s*(AD|CE)\b/i,           // 1982 AD, 2020 CE
        /\b(\d+)\s*(BCE|BC)\b/i,          // 78 BCE, 78 BC
        /\b(BCE|BC)\s*(\d+)\b/i,          // BCE 30000, BC 30000
        /\b(\d{3,4})\b(?!\s*chapter)/i    // Just a year (3-4 digits, not followed by "chapter")
    ];
    
    let dateString = null;
    for (const pattern of datePatterns) {
        const match = filename.match(pattern);
        if (match) {
            dateString = match[0];
            break;
        }
    }
    
    // Extract title (everything after chapter and date)
    let title = filename;
    
    // Remove chapter number and common separators
    if (chapterNumber !== null) {
        title = title.replace(/^(chapter\s*)?\d+[\s\-_:.]*/i, '');
    }
    
    // Remove date if found
    if (dateString) {
        title = title.replace(dateString, '');
    }
    
    // Remove common separator patterns that appear alone or with single letters
    // Matches: "-d-", "--c--", "--", "-- HERE --", etc.
    title = title
        .replace(/\s*-+\s*[a-z]\s*-+\s*/gi, ' ')  // Remove "-d-", "-x-", "--c--" patterns
        .replace(/\s*-+\s+HERE\s+-+\s*/gi, ' ')    // Remove "-- HERE --"
        .replace(/\s*-{2,}\s*/g, ' ')               // Remove "--" or more dashes
        .replace(/^[\s\-_:.]+/, '')                 // Remove leading separators
        .replace(/[\s\-_:.]+$/, '')                 // Remove trailing separators
        .replace(/\s+/g, ' ')                       // Normalize spaces
        .trim();

    // Apply custom separator filtering if provided
    if (ignoreSeparators && ignoreSeparators.trim()) {
        const customSeparators = ignoreSeparators.split(',').map(s => s.trim()).filter(s => s);
        customSeparators.forEach(separator => {
            // Escape special regex characters
            const escapedSep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\s*${escapedSep}\\s*`, 'gi');
            title = title.replace(regex, ' ').trim();
        });
    }
    
    // If no title found, use filename
    if (!title) {
        title = filename;
    }
    
    return {
        filepath,
        filename: path.basename(filepath),
        chapterNumber,
        dateString,
        title,
        isValid: chapterNumber !== null
    };
}

/**
 * Parse and sort multiple files
 */
function parseAndSortFiles(filepaths, ignoreSeparators = '') {
    const parsed = filepaths.map(fp => parseFilename(fp, ignoreSeparators));
    
    // Sort by chapter number
    parsed.sort((a, b) => {
        if (a.chapterNumber === null && b.chapterNumber === null) return 0;
        if (a.chapterNumber === null) return 1;
        if (b.chapterNumber === null) return -1;
        return a.chapterNumber - b.chapterNumber;
    });
    
    // Check for warnings
    const warnings = [];
    const invalidFiles = parsed.filter(p => !p.isValid);
    
    if (invalidFiles.length > 0) {
        warnings.push({
            type: 'invalid_filename',
            message: `${invalidFiles.length} file(s) don't match expected naming pattern`,
            files: invalidFiles.map(f => f.filename)
        });
    }
    
    // Check for duplicate chapter numbers
    const chapterNumbers = parsed
        .filter(p => p.chapterNumber !== null)
        .map(p => p.chapterNumber);
    
    const duplicates = chapterNumbers.filter((num, index) => 
        chapterNumbers.indexOf(num) !== index
    );
    
    if (duplicates.length > 0) {
        warnings.push({
            type: 'duplicate_chapters',
            message: `Duplicate chapter numbers found: ${[...new Set(duplicates)].join(', ')}`
        });
    }
    
    // Detect chapter range
    const validChapters = parsed
        .filter(p => p.chapterNumber !== null)
        .map(p => p.chapterNumber);
    
    const chapterRange = validChapters.length > 0 
        ? { min: Math.min(...validChapters), max: Math.max(...validChapters) }
        : null;
    
    // Check if any files have dates
    const hasDates = parsed.some(p => p.dateString !== null);
    
    return {
        files: parsed,
        warnings,
        chapterRange,
        hasDates
    };
}

/**
 * Read file content
 */
async function readFileContent(filepath) {
    const fs = require('fs').promises;
    try {
        const content = await fs.readFile(filepath, 'utf8');
        return content;
    } catch (error) {
        throw new Error(`Failed to read ${path.basename(filepath)}: ${error.message}`);
    }
}

module.exports = {
    parseFilename,
    parseAndSortFiles,
    readFileContent
};