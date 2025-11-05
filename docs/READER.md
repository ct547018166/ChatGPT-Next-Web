# E-Book Reader Feature

## Overview
This feature adds a comprehensive e-book reader with AI text-to-speech (TTS) functionality to ChatGPT-Next-Web.

## Supported Formats
- **EPUB**: Full support with page navigation
- **TXT**: Plain text files with AI read-aloud
- **PDF**: Limited support (coming soon)
- **MOBI**: File upload supported

## Features
1. **File Upload**: Drag-and-drop or click to upload e-books
2. **AI Read-Aloud**: Integrates with existing TTS system
   - Uses Microsoft Edge TTS or OpenAI TTS
   - Configurable speed and voice
3. **Navigation**: Chapter navigation for EPUB files
4. **Reading Controls**: Play, pause, and stop reading

## How to Use
1. Navigate to the "E-Book Reader" section from the sidebar menu
2. Upload an e-book file (EPUB, TXT, PDF, or MOBI)
3. Click the "Play" button to start AI read-aloud
4. Adjust speed and voice settings in the Settings page under TTS configuration

## Technical Details
- Built with `react-reader` library for EPUB support
- Integrates with existing TTS configuration
- Responsive design for mobile and desktop
- Dynamic imports for optimal performance

## Configuration
The reader uses the TTS settings from the main application:
- Enable TTS in Settings → TTS Configuration
- Select voice and speed preferences
- Choose between Microsoft Edge TTS or OpenAI TTS

## Future Enhancements
- Full PDF rendering support
- Bookmark functionality
- Reading progress tracking
- Adjustable font size and themes
- Highlighted text tracking during read-aloud
