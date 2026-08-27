# FFmpeg Video Conversion Implementation Plan

This document outlines the requirements and implementation steps for integrating automatic video transcoding (to MP4) in the Knowledge Management (KM) Portal backend, utilizing hardware acceleration on the **NVIDIA RTX A4000** GPU.

---

## 1. Prerequisites (Server Setup)

To use hardware acceleration for video transcoding, the server must be prepared with the following:

1. **NVIDIA Graphic Drivers**: Install the latest enterprise drivers for the **NVIDIA RTX A4000**.
2. **NVIDIA CUDA Toolkit**: Install the CUDA toolkit to enable GPU-accelerated computing.
3. **FFmpeg Binary**:
   * Download and install FFmpeg on the server.
   * Add the FFmpeg `bin` directory to the system environment variables (`PATH`).
   * Verify NVENC support by running:
     ```cmd
     ffmpeg -encoders | findstr nvenc
     ```
     *(You should see `h264_nvenc` and `hevc_nvenc` in the output).*

---

## 2. Dependencies

In the backend Node.js project (`Back-end/`), install the `fluent-ffmpeg` wrapper for easier programmatic control:
```bash
npm install fluent-ffmpeg
```

---

## 3. Implementation Workflow

The video conversion process will be integrated directly into the folder synchronization cycle:

### File: [folderSync.service.js](file:///e:/program/Knowlage-base/Knowlage-base/Back-end/server/services/folderSync.service.js)

1. **Detection**:
   During the folder scan inside `syncDrive()`, identify files that are videos but not in `.mp4` format (e.g. `.avi`, `.mov`, `.wmv`, `.flv`, `.mkv`).
   
2. **GPU Transcoding**:
   For each unsupported video file, run FFmpeg to transcode it to `.mp4`.
   * **Video Codec**: `h264_nvenc` (NVIDIA hardware accelerated H.264 encoder).
   * **Audio Codec**: `aac` (standard web-compatible audio codec).
   * **Hardware Acceleration Flag**: `-hwaccel cuda` (offloads decoding/encoding steps to the GPU).
   
3. **File Management**:
   * Generate the new `.mp4` file in the same directory as the original file.
   * *Option A*: Retain the original file (adds a new `.mp4` mapping to the database, keeping the original intact on the drive).
   * *Option B*: Delete the original file from the drive after a successful conversion to save space (must be configurable/carefully implemented to avoid data loss).
   
4. **Database Registration**:
   Save the metadata of the newly created `.mp4` file to `dbo.FileMetadata` instead of (or in addition to) the original file so the frontend plays the web-compatible version.

---

## 4. Sample Integration Code

Here is how the transcoder function would be written in Node:

```javascript
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * Transcode a video file to MP4 utilizing RTX A4000 GPU acceleration.
 * 
 * @param {string} inputPath - Full path to source file (e.g. R:\Video.avi)
 * @returns {Promise<string>} - Path to the newly created MP4 file
 */
function transcodeToMp4(inputPath) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(inputPath);
    const outputPath = inputPath.replace(new RegExp(ext + '$', 'i'), '.mp4');

    // If MP4 already exists, skip transcoding
    if (fs.existsSync(outputPath)) {
      return resolve(outputPath);
    }

    ffmpeg(inputPath)
      .inputOptions('-hwaccel cuda') // Use CUDA for hardware decoding
      .videoCodec('h264_nvenc')     // Use NVIDIA NVENC for H.264 encoding
      .audioCodec('aac')            // Web-friendly audio codec
      .outputOptions('-preset fast') // NVENC encoding preset
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`[FFMPEG] Starting: ${cmd}`);
      })
      .on('progress', (progress) => {
        console.log(`[FFMPEG] Processing ${path.basename(inputPath)}: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        console.log(`[FFMPEG] Successfully transcoded: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`[FFMPEG] Transcoding failed for ${inputPath}:`, err.message);
        reject(err);
      })
      .run();
  });
}
```

---

## 5. Potential Pitfalls & Best Practices
* **Concurrence Control**: Transcoding should be run sequentially (one file at a time) or with a small limit (e.g., max 2 concurrent encodes) to avoid overloading the GPU and server memory.
* **Partial Syncs**: If a sync job is cancelled or the server restarts during encoding, ensure the partial `.mp4` file is cleaned up (deleted) so it is not registered as a corrupted file.
