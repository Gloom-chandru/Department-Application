/**
 * Triggers browser download for a Blob response and cleans up the Object URL.
 * @param {Blob} blobData - File blob data from axios response
 * @param {string} fallbackFilename - Default filename if Content-Disposition header is missing
 * @param {object} [headers] - Axios response headers (optional, to extract filename)
 */
export function downloadBlob(blobData, fallbackFilename, headers) {
  let filename = fallbackFilename;

  if (headers && headers['content-disposition']) {
    const match = headers['content-disposition'].match(/filename="?([^";]+)"?/i);
    if (match && match[1]) {
      filename = match[1].trim();
    }
  }

  const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a CSV file client-side from an array of credential objects.
 * Properly escapes RFC 4180 special characters (commas, quotes, newlines).
 */
export function downloadCredentialsCsv(credentials, filename = 'imported_credentials.csv') {
  if (!Array.isArray(credentials) || credentials.length === 0) return;

  const headers = ['Identifier', 'Name', 'Email', 'Temporary Password'];
  
  const escapeCsvCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const csvRows = [
    headers.join(','),
    ...credentials.map(c => [
      escapeCsvCell(c.identifier || c.rollNo || c.email),
      escapeCsvCell(c.name),
      escapeCsvCell(c.email),
      escapeCsvCell(c.temporaryPassword)
    ].join(','))
  ];

  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}
