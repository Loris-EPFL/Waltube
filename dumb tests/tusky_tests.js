import fs from 'fs';

const apiUrl = 'https://api.tusky.io';
const apiKey = 'c2d4d070-d0c9-494a-acd3-e5866c4f97b4';

const filePath = 'YOUR_FILE_PATH';
const fileStats = fs.statSync(filePath);
const fileSize = fileStats.size;
const fileName = filePath.split('/').pop();
const fileStream = fs.createReadStream(filePath);

const response = await fetch(`${apiUrl}/uploads?vaultId=${vault.id}`, {
  method: 'POST',
  headers: {
    'Api-Key': apiUrl,
    'Content-Type': 'application/offset+octet-stream',
    'Content-Length': fileSize,
    'Content-Disposition': `attachment; filename="${fileName}"`,
  },
  body: fileStream,
  duplex: 'half',
});
console.log(response.headers.get('location').split('/').pop());


const upload = new tus.Upload(fileStream, {
  endpoint: endpoint,
  headers: {
    'Api-Key': 'c2d4d070-d0c9-494a-acd3-e5866c4f97b4',
  },
  metadata: {
    filename: fileName,
    filetype: 'text/plain', // Adjust according to your file type
    vaultId: vault.id,
  },
  onError: error => {
    console.error('Upload failed:', error.message);
  },
  onProgress: (bytesUploaded, bytesTotal) => {
    const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
    console.log(`Progress: ${percentage}% (${bytesUploaded}/${bytesTotal} bytes)`);
  },
  onSuccess: () => {
    console.log('Upload completed successfully!');
  },
});

upload.start();