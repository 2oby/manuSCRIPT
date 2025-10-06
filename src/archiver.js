const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

/**
 * Create ZIP archive of source text files
 */
async function createZipArchive(chapters, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            // Create write stream
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });
            
            // Handle stream events
            output.on('close', () => {
                resolve(outputPath);
            });
            
            output.on('error', (err) => {
                reject(err);
            });
            
            archive.on('error', (err) => {
                reject(err);
            });
            
            archive.on('warning', (err) => {
                if (err.code === 'ENOENT') {
                    console.warn('Archive warning:', err);
                } else {
                    reject(err);
                }
            });
            
            // Pipe archive to output file
            archive.pipe(output);
            
            // Add each chapter file to archive
            chapters.forEach(chapter => {
                const filename = path.basename(chapter.filepath);
                archive.file(chapter.filepath, { name: filename });
            });
            
            // Finalize archive
            archive.finalize();
            
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    createZipArchive
};