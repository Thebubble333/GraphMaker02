
/*
 * -----------------------------------------------------------------------------
 * AI_READ_ONLY_FILE: DO NOT EDIT WITHOUT EXPRESS PERMISSION
 * This file contains utility functions for PNG processing (DPI injection).
 * -----------------------------------------------------------------------------
 */

// Precomputed CRC32 table
const crcTable: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return crc ^ -1;
}

/**
 * Injects the pHYs (Physical Pixel Dimensions) chunk into a PNG blob.
 * This ensures that when the image is pasted into Word or other apps,
 * it respects the intended physical dimensions (DPI) rather than using the default 96 DPI.
 * This version robustly parses chunks to replace any existing pHYs chunk.
 */
export async function addDpiToPng(blob: Blob, dpi: number): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const u8 = new Uint8Array(buffer);
  const view = new DataView(buffer);
  
  // Signature check: 89 50 4E 47 0D 0A 1A 0A
  if (u8[0] !== 0x89 || u8[1] !== 0x50 || u8[2] !== 0x4E || u8[3] !== 0x47 || 
      u8[4] !== 0x0D || u8[5] !== 0x0A || u8[6] !== 0x1A || u8[7] !== 0x0A) {
      console.warn("Invalid PNG signature");
      return blob;
  }

  // Construct our pHYs chunk
  // 1 inch = 0.0254 meters
  const dpm = Math.round(dpi / 0.0254);
  const physLen = 9;
  const chunkLen = 12 + physLen; // 4 len, 4 type, 9 data, 4 crc
  const physChunk = new Uint8Array(chunkLen);
  const physView = new DataView(physChunk.buffer);
  
  physView.setUint32(0, physLen); // Length
  physChunk.set([112, 72, 89, 115], 4); // Type: pHYs (ASCII)
  physView.setUint32(8, dpm); // X axis (Pixels per unit, X)
  physView.setUint32(12, dpm); // Y axis (Pixels per unit, Y)
  physChunk[16] = 1; // Unit specifier: 1 = meter
  
  // Calculate CRC for Type + Data
  const crcInput = new Uint8Array(4 + 9); // Type (4) + Data (9)
  crcInput.set(physChunk.slice(4, 17));
  physView.setUint32(17, crc32(crcInput)); // Set CRC at the end

  const newChunks: Uint8Array[] = [];
  newChunks.push(u8.slice(0, 8)); // Copy Signature
  
  let offset = 8;
  while (offset < u8.length) {
      if (offset + 8 > u8.length) break; // Safety check

      const length = view.getUint32(offset); // Chunk Data Length
      // Chunk Type is at offset + 4
      const type = String.fromCharCode(u8[offset+4], u8[offset+5], u8[offset+6], u8[offset+7]);
      
      const totalLen = length + 12; // Length(4) + Type(4) + Data(length) + CRC(4)
      
      if (offset + totalLen > u8.length) break; // Incomplete chunk

      if (type === 'pHYs') {
          // Skip existing pHYs chunk to avoid duplicates/conflicts
          offset += totalLen;
          continue;
      }
      
      // Copy current chunk
      newChunks.push(u8.slice(offset, offset + totalLen));
      
      // Insert our pHYs chunk immediately after IHDR
      if (type === 'IHDR') {
          newChunks.push(physChunk);
      }
      
      offset += totalLen;
  }
  
  // Reassemble the file
  const totalLength = newChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of newChunks) {
      result.set(chunk, pos);
      pos += chunk.length;
  }
  
  return new Blob([result], { type: 'image/png' });
}
