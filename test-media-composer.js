/**
 * Test script for media composer unification
 * 
 * This script validates:
 * 1. Captured photos show preview before send
 * 2. Videos (upload + capture) show preview with thumbnail
 * 3. Audio uses unified composer with single send button
 * 4. Captions persist for all media types
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('MEDIA COMPOSER UNIFICATION TEST');
console.log('='.repeat(60));

// Read the HTML file
const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    if (details) console.log(`   ${details}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    if (details) console.log(`   ${details}`);
    failed++;
  }
}

console.log('\n📋 Test 1: Unified Media Composer Structure');
console.log('-'.repeat(60));

test(
  'Has unified photoComposer element',
  html.includes('id="photoComposer"'),
  'Element exists for unified media preview'
);

test(
  'Has previewImage for photos',
  html.includes('id="previewImage"'),
  'Image preview element exists'
);

test(
  'Has previewVideo for videos',
  html.includes('id="previewVideo"'),
  'Video preview element exists'
);

test(
  'Has previewAudio for audio',
  html.includes('id="previewAudio"'),
  'Audio preview element exists'
);

test(
  'Has dynamic mediaTypeLabel',
  html.includes('id="mediaTypeLabel"'),
  'Label updates based on media type'
);

test(
  'Old audio draft UI removed',
  !html.includes('id="audioDraft"') || html.includes('<!-- Audio Draft Composer - REMOVED'),
  'Separate audio UI has been removed or commented out'
);

console.log('\n📋 Test 2: Photo Capture Preview Flow');
console.log('-'.repeat(60));

test(
  'capturePhoto function shows preview',
  html.includes('function capturePhoto()') && 
  html.includes("composer.classList.add('active')") &&
  html.includes('previewImg.src = previewURL'),
  'Captured photos go through preview before send'
);

test(
  'capturePhoto sets mediaTypeLabel',
  html.match(/function capturePhoto[\s\S]*?mediaTypeLabel\.textContent = 'Photo Attached'/),
  'Label correctly identifies photo type'
);

test(
  'capturePhoto hides other media types',
  html.match(/function capturePhoto[\s\S]*?previewVideo\.style\.display = 'none'/),
  'Other media previews are hidden when photo is captured'
);

console.log('\n📋 Test 3: Video Preview Flow');
console.log('-'.repeat(60));

test(
  'handleVideoRecordingComplete shows video preview',
  html.includes('function handleVideoRecordingComplete') &&
  html.match(/handleVideoRecordingComplete[\s\S]*?previewVideo\.style\.display = 'block'/),
  'Recorded videos show preview element'
);

test(
  'handleVideoRecordingComplete sets video source',
  html.match(/handleVideoRecordingComplete[\s\S]*?previewVideo\.src = previewURL/),
  'Video preview gets correct source URL'
);

test(
  'handleVideoRecordingComplete adds click handler',
  html.match(/handleVideoRecordingComplete[\s\S]*?previewVideo\.onclick.*openVideoPreview/),
  'Video preview can be clicked to open full preview'
);

test(
  'handleVideoSelect shows video preview',
  html.includes('function handleVideoSelect') &&
  html.match(/handleVideoSelect[\s\S]*?previewVideo\.style\.display = 'block'/),
  'Uploaded videos show preview element'
);

test(
  'handleVideoSelect sets mediaTypeLabel',
  html.match(/function handleVideoSelect[\s\S]*?mediaTypeLabel\.textContent = 'Video Attached'/),
  'Label correctly identifies video type'
);

console.log('\n📋 Test 4: Audio Unified Flow');
console.log('-'.repeat(60));

test(
  'createAudioDraft uses unified composer',
  html.includes('function createAudioDraft') &&
  html.match(/createAudioDraft[\s\S]*?composer\.classList\.add\('active'\)/),
  'Audio creates attachment in unified composer'
);

test(
  'createAudioDraft shows audio preview',
  html.match(/createAudioDraft[\s\S]*?previewAudio\.style\.display = 'block'/),
  'Audio preview element is shown'
);

test(
  'createAudioDraft creates File attachment',
  html.match(/createAudioDraft[\s\S]*?selectedFile = file/),
  'Audio is set as selectedFile for unified send flow'
);

test(
  'createAudioDraft sets mediaTypeLabel',
  html.match(/createAudioDraft[\s\S]*?mediaTypeLabel\.textContent = 'Voice Message'/),
  'Label correctly identifies audio type'
);

test(
  'Old sendAudioDraft removed',
  !html.match(/function sendAudioDraft\(\)[\s\S]*?fetch\(UPLOAD_URL/),
  'Separate audio send function has been removed'
);

console.log('\n📋 Test 5: Caption Support');
console.log('-'.repeat(60));

// Check server.js for caption support
const serverPath = path.join(__dirname, 'server.js');
const serverCode = fs.readFileSync(serverPath, 'utf8');

test(
  'Server accepts audio caption',
  serverCode.match(/message\.type === 'audio'[\s\S]*?caption.*message\.caption/),
  'Server extracts caption from audio messages'
);

test(
  'Server stores audio caption',
  serverCode.match(/type: 'audio'[\s\S]*?caption: caption/m),
  'Server includes caption in stored message'
);

test(
  'Client renders audio caption',
  html.match(/data\.type === 'audio'[\s\S]*?data\.caption.*message-content/m),
  'Client displays caption for audio messages'
);

test(
  'Audio defaults to "Voice message"',
  html.match(/data\.type === 'audio'[\s\S]*?Voice message/),
  'Default label shown when no caption provided'
);

console.log('\n📋 Test 6: Single Send Button');
console.log('-'.repeat(60));

const sendButtonCount = (html.match(/class="btn-primary".*sendMessage/g) || []).length;

test(
  'Only one primary send button',
  sendButtonCount === 1,
  `Found ${sendButtonCount} send button(s) - should be exactly 1`
);

test(
  'sendMessage handles audio via selectedFile',
  html.includes('function sendMessage()') &&
  html.match(/sendMessage[\s\S]*?if \(selectedFile\)/),
  'Unified send function handles all file types including audio'
);

console.log('\n📋 Test 7: Cleanup Functions');
console.log('-'.repeat(60));

test(
  'removePhotoAttachment clears all media types',
  html.includes('function removePhotoAttachment()') &&
  html.match(/removePhotoAttachment[\s\S]*?previewVideo\.src = ''/),
  'Remove function clears video elements'
);

test(
  'removePhotoAttachment clears audio',
  html.match(/removePhotoAttachment[\s\S]*?previewAudio\.src = ''/),
  'Remove function clears audio elements'
);

test(
  'discardAudioDraft uses unified removal',
  html.includes('function discardAudioDraft()') &&
  html.match(/discardAudioDraft[\s\S]*?removePhotoAttachment/),
  'Audio discard reuses unified removal'
);

console.log('\n📋 Test 8: File Type Detection');
console.log('-'.repeat(60));

test(
  'handleFileSelect detects images',
  html.includes('function handleFileSelect()') && 
  html.includes('if (isImage)') &&
  html.includes("previewImg.style.display = 'block'"),
  'File handler detects and previews images'
);

test(
  'handleFileSelect detects videos',
  html.includes('else if (isVideo)') &&
  html.includes("previewVideo.style.display = 'block'"),
  'File handler detects and previews videos'
);

test(
  'handleFileSelect detects audio',
  html.includes('else if (isAudio)') &&
  html.includes("previewAudio.style.display = 'block'"),
  'File handler detects and previews audio files'
);

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed! Media composer unification is complete.');
  process.exit(0);
}
