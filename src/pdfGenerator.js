const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF from parsed chapter files
 */
async function generatePDF(chapters, outputPath, options) {
    return new Promise(async (resolve, reject) => {
        try {
            const { title, author, font, settings, showDate } = options;
            
            // Page size dimensions (in points: 1 inch = 72 points)
            const pageSizes = {
                'A4': [595.28, 841.89],
                'A5': [419.53, 595.28]
            };
            
            const pageSize = pageSizes[settings.pageSize] || pageSizes['A4'];
            
            // Convert margins from mm to points (1mm = 2.834645669 points)
            const mmToPoints = 2.834645669;
            const margins = {
                top: settings.marginTop * mmToPoints,
                bottom: settings.marginBottom * mmToPoints,
                left: settings.marginLeft * mmToPoints,
                right: settings.marginRight * mmToPoints
            };
            
            // Create PDF document
            const doc = new PDFDocument({
                size: pageSize,
                margins: margins,
                bufferPages: true
            });
            
            // Pipe to file
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);
            
            // Set font - use built-in PDF fonts
            let pdfFont = {
                normal: 'Times-Roman',
                bold: 'Times-Bold',
                italic: 'Times-Italic',
                boldItalic: 'Times-BoldItalic'
            };
            
            if (font === 'Arial') {
                pdfFont = {
                    normal: 'Helvetica',
                    bold: 'Helvetica-Bold',
                    italic: 'Helvetica-Oblique',
                    boldItalic: 'Helvetica-BoldOblique'
                };
            } else if (font === 'Courier New') {
                pdfFont = {
                    normal: 'Courier',
                    bold: 'Courier-Bold',
                    italic: 'Courier-Oblique',
                    boldItalic: 'Courier-BoldOblique'
                };
            }
            
            // Calculate line height
            const baseLineHeight = 12; // Default font size
            const lineHeight = baseLineHeight * settings.lineSpacing;
            
            // Title page
            doc.font(pdfFont.normal).fontSize(24).text(title, { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(16).text(`by ${author}`, { align: 'center' });

            // Calculate word count from all chapters
            let totalWordCount = 0;
            for (const chapter of chapters) {
                try {
                    const content = await fs.promises.readFile(chapter.filepath, 'utf8');
                    const words = content.trim().split(/\s+/).filter(w => w.length > 0);
                    totalWordCount += words.length;
                } catch (error) {
                    // Skip files that can't be read
                }
            }

            // Calculate page count (325 words per page)
            const estimatedPages = Math.ceil(totalWordCount / 325);

            // Add word count and page estimate at bottom of title page
            const pageHeight = pageSize[1];
            const bottomMargin = margins.bottom;

            // Position text near bottom
            doc.y = pageHeight - bottomMargin - 60;
            doc.fontSize(12).text(`${totalWordCount.toLocaleString()} words`, { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(12).text(`${estimatedPages.toLocaleString()} SPP*`, { align: 'center' });

            // Add footnote at very bottom
            doc.y = pageHeight - bottomMargin - 20;
            doc.fontSize(8).text('*SPP = Standard Paperback Page', { align: 'center' });

            doc.addPage();
            
            // Process each chapter
            const failedFiles = [];
            for (let i = 0; i < chapters.length; i++) {
                const chapter = chapters[i];

                // Read chapter content with error handling
                let content;
                try {
                    content = await fs.promises.readFile(chapter.filepath, 'utf8');
                } catch (error) {
                    failedFiles.push({
                        filename: chapter.filename,
                        error: error.message
                    });
                    continue; // Skip this chapter and continue with others
                }
                
                // Chapter header
                let headerFont = pdfFont.bold;
                if (settings.chapterItalic) {
                    headerFont = pdfFont.boldItalic;
                }
                
                doc.font(headerFont).fontSize(settings.chapterFontSize);
                
                if (settings.chapterItalic) {
                    doc.font(pdfFont + '-BoldItalic');
                }
                
                // Chapter number and title
                if (chapter.chapterNumber !== null) {
                    doc.text(`Chapter ${chapter.chapterNumber}`, { continued: false });
                    if (chapter.title) {
                        doc.text(chapter.title, { continued: false });
                    }
                } else {
                    doc.text(chapter.title || chapter.filename, { continued: false });
                }
                
                // Date if enabled
                if (showDate && chapter.dateString) {
                    doc.font(pdfFont.italic).fontSize(14);
                    doc.text(chapter.dateString, { continued: false });
                }
                
                doc.moveDown(1);
                
                // Chapter content
                doc.font(pdfFont.normal).fontSize(12);
                
                // Split content into paragraphs
                const paragraphs = content.split(/\n\s*\n/);
                
                for (let j = 0; j < paragraphs.length; j++) {
                    const paragraph = paragraphs[j].trim();
                    if (paragraph) {
                        doc.text(paragraph, {
                            align: 'left',
                            lineGap: lineHeight - 12
                        });
                        
                        // Add paragraph spacing
                        if (j < paragraphs.length - 1) {
                            doc.moveDown(settings.paragraphSpacing / 12);
                        }
                    }
                }
                
                // Page break between chapters (except last)
                if (i < chapters.length - 1) {
                    doc.addPage();
                }
            }
            
            // Finalize PDF
            doc.end();

            stream.on('finish', () => {
                if (failedFiles.length > 0) {
                    resolve({
                        path: outputPath,
                        warnings: failedFiles
                    });
                } else {
                    resolve(outputPath);
                }
            });

            stream.on('error', (err) => {
                reject(err);
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generatePDF
};