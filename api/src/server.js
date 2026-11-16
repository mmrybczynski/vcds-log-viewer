require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { parseVcdsCsv } = require('./csvParser');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB) || 30;

app.use(cors({
  origin(origin, callback) {
    const allowed = (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',').map(v => v.trim());
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
    return callback(new Error('Pochodzenie żądania nie jest dozwolone przez CORS.'));
  }
}));
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (/\.csv$/i.test(file.originalname)) return callback(null, true);
    callback(new Error('Dozwolone są wyłącznie pliki CSV.'));
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'vcds-log-viewer-api' }));

app.post('/api/logs/parse', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nie przesłano pliku CSV.' });
    const result = parseVcdsCsv(req.file.buffer);
    res.json({
      filename: req.file.originalname,
      size: req.file.size,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `Plik jest za duży. Maksymalny rozmiar: ${maxUploadMb} MB.` });
  }
  res.status(400).json({ error: error.message || 'Wystąpił nieoczekiwany błąd.' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`VCDS API działa na porcie ${PORT}`));