/**
 * Pure JavaScript ZIP file creator for browser extensions
 * Implements PKZIP format without external dependencies.
 */
const ZipBuilder = {
  // CRC32 table
  crcTable: (() => {
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    return table;
  })(),

  crc32(strOrUint8Array) {
    let bytes;
    if (typeof strOrUint8Array === 'string') {
      bytes = new TextEncoder().encode(strOrUint8Array);
    } else {
      bytes = strOrUint8Array;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ this.crcTable[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  },

  async createZip(files) {
    // files = Array of { name: 'path/in/zip', content: string | Uint8Array }
    const localHeaders = [];
    const centralDirectories = [];
    let offset = 0;

    const encoder = new TextEncoder();

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      let contentBytes;
      if (typeof file.content === 'string') {
        contentBytes = encoder.encode(file.content);
      } else if (file.content instanceof ArrayBuffer) {
        contentBytes = new Uint8Array(file.content);
      } else {
        contentBytes = file.content;
      }

      const uncompressedSize = contentBytes.length;
      const compressedSize = uncompressedSize; // Store (no compression)
      const crc = this.crc32(contentBytes);

      // Local File Header
      const header = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(header.buffer);

      view.setUint32(0, 0x04034b50, true); // Local header signature
      view.setUint16(4, 10, true);         // Version needed
      view.setUint16(6, 0, true);          // General flag
      view.setUint16(8, 0, true);          // Compression method (0 = store)
      view.setUint16(10, 0, true);         // Mod time
      view.setUint16(12, 0, true);         // Mod date
      view.setUint32(14, crc, true);       // CRC-32
      view.setUint32(18, compressedSize, true);
      view.setUint32(22, uncompressedSize, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);         // Extra field length
      header.set(nameBytes, 30);

      localHeaders.push(header);
      localHeaders.push(contentBytes);

      // Central Directory Header
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);

      cdView.setUint32(0, 0x02014b50, true); // CD signature
      cdView.setUint16(4, 20, true);         // Made by
      cdView.setUint16(6, 10, true);         // Version needed
      cdView.setUint16(8, 0, true);          // General flag
      cdView.setUint16(10, 0, true);         // Compression method
      cdView.setUint16(12, 0, true);         // Mod time
      cdView.setUint16(14, 0, true);         // Mod date
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, compressedSize, true);
      cdView.setUint32(24, uncompressedSize, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);         // Extra field len
      cdView.setUint16(32, 0, true);         // Comment len
      cdView.setUint16(34, 0, true);         // Disk start
      cdView.setUint16(36, 0, true);         // Internal attrs
      cdView.setUint32(38, 0, true);         // External attrs
      cdView.setUint32(42, offset, true);    // Local header offset
      cdHeader.set(nameBytes, 46);

      centralDirectories.push(cdHeader);

      offset += header.length + contentBytes.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    centralDirectories.forEach(cd => cdSize += cd.length);

    // End of Central Directory Record (EOCD)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);

    const totalParts = [...localHeaders, ...centralDirectories, eocd];
    return new Blob(totalParts, { type: 'application/zip' });
  }
};
