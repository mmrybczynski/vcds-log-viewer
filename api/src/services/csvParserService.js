const { parse } = require('csv-parse/sync');
const iconv = require('iconv-lite');

function parseNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const normalized = String(value).trim().replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseVcdsCsv(buffer) {
  // VCDS zwykle zapisuje polskie znaki w Windows-1250.
  let csvText = iconv.decode(buffer, 'win1250');
  if (csvText.includes('\u0000')) csvText = buffer.toString('utf8');

  const rows = parse(csvText, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: false,
    quote: '"',
    escape: '"'
  });

  const headerIndex = rows.findIndex(row =>
    String(row[0] || '').trim().toLocaleLowerCase('pl') === 'znacznik' &&
    String(row[1] || '').trim().toLocaleLowerCase('pl') === 'czas'
  );

  if (headerIndex < 0 || rows.length <= headerIndex + 2) {
    throw new Error('Nie rozpoznano struktury pliku CSV z VCDS.');
  }

  const header = rows[headerIndex] || [];
  const names = rows[headerIndex + 1] || [];
  const units = rows[headerIndex + 2] || [];
  const dataStart = headerIndex + 3;
  const channels = [];

  for (let timeIndex = 1; timeIndex < header.length - 1; timeIndex++) {
    if (String(header[timeIndex] || '').trim().toLocaleUpperCase('pl') !== 'CZAS') continue;
    const valueIndex = timeIndex + 1;
    const name = String(names[valueIndex] || '').trim();
    const unit = String(units[valueIndex] || '').trim();
    if (!name) continue;

    const points = [];
    for (let rowIndex = dataStart; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const x = parseNumber(row[timeIndex]);
      const y = parseNumber(row[valueIndex]);
      if (x !== null && y !== null) points.push({ x, y });
    }

    if (points.length) channels.push({ id: `p${timeIndex}`, name, unit, points });
  }

  if (!channels.length) throw new Error('Nie znaleziono kanałów pomiarowych w pliku.');
  return { channels, metadata: { rows: rows.length, channelCount: channels.length } };
}

module.exports = { parseVcdsCsv };
