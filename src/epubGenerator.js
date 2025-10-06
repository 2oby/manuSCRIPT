const Epub = require('epub-gen');
const fs = require('fs');
const path = require('path');

/**
 * Generate EPUB from parsed chapter files
 */
async function generateEPUB(chapters, outputPath, options) {
    try {
        const { title, author, font, settings, showDate } = options;
        
        // Map font family to CSS
        let fontFamily = 'Georgia, serif';
        if (font === 'Arial') {
            fontFamily = 'Arial, sans-serif';
        } else if (font === 'Courier New') {
            fontFamily = '"Courier New", monospace';
        }
        
        // Build CSS for styling
        const css = `
            body {
                font-family: ${fontFamily};
                line-height: ${settings.lineSpacing};
                margin: ${settings.marginTop}mm ${settings.marginRight}mm ${settings.marginBottom}mm ${settings.marginLeft}mm;
            }
            
            h1.chapter-title {
                font-size: ${settings.chapterFontSize}pt;
                font-weight: ${settings.chapterBold ? 'bold' : 'normal'};
                font-style: ${settings.chapterItalic ? 'italic' : 'normal'};
                margin-bottom: 0.5em;
            }
            
            p.chapter-date {
                font-style: italic;
                font-size: 14pt;
                margin-bottom: 1em;
                color: #666;
            }
            
            p {
                margin-bottom: ${settings.paragraphSpacing}pt;
                text-align: left;
            }
        `;
        
        // Prepare chapter content
        const content = [];
        const failedFiles = [];

        for (const chapter of chapters) {
            // Read chapter content with error handling
            let text;
            try {
                text = await fs.promises.readFile(chapter.filepath, 'utf8');
            } catch (error) {
                failedFiles.push({
                    filename: chapter.filename,
                    error: error.message
                });
                continue; // Skip this chapter and continue with others
            }
            
            // Build chapter HTML
            let chapterHTML = '';
            
            // Chapter header
            if (chapter.chapterNumber !== null) {
                chapterHTML += `<h1 class="chapter-title">Chapter ${chapter.chapterNumber}`;
                if (chapter.title) {
                    chapterHTML += `<br/>${chapter.title}`;
                }
                chapterHTML += `</h1>`;
            } else {
                chapterHTML += `<h1 class="chapter-title">${chapter.title || chapter.filename}</h1>`;
            }
            
            // Date if enabled
            if (showDate && chapter.dateString) {
                chapterHTML += `<p class="chapter-date">${chapter.dateString}</p>`;
            }
            
            // Chapter text - convert paragraphs to <p> tags
            const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
            paragraphs.forEach(paragraph => {
                chapterHTML += `<p>${paragraph.trim().replace(/\n/g, '<br/>')}</p>`;
            });
            
            // Add to content array
            let chapterTitle = '';
            if (chapter.chapterNumber !== null) {
                chapterTitle = `Chapter ${chapter.chapterNumber}`;
                if (chapter.title) {
                    chapterTitle += `: ${chapter.title}`;
                }
            } else {
                chapterTitle = chapter.title || chapter.filename;
            }
            
            content.push({
                title: chapterTitle,
                data: chapterHTML
            });
        }
        
        // EPUB options
        const epubOptions = {
            title: title,
            author: author,
            output: outputPath,
            content: content,
            css: css,
            tocTitle: 'Table of Contents',
            appendChapterTitles: false, // We're handling this manually
            version: 3
        };
        
        // Generate EPUB
        await new Epub(epubOptions).promise;

        if (failedFiles.length > 0) {
            return {
                path: outputPath,
                warnings: failedFiles
            };
        }

        return outputPath;
        
    } catch (error) {
        throw new Error(`EPUB generation failed: ${error.message}`);
    }
}

module.exports = {
    generateEPUB
};