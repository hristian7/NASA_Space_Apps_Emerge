/**
 * Turning a checked request into a stream of CSV text.
 *
 * The rows are written block by block, so a large answer never has to sit in
 * memory in full and the first bytes reach the caller early.
 */

import { cutNotice, hotspotColumnLine, hotspotHeader, hotspotRowText } from "./csv";
import { keepRow } from "./filter";
import { MAX_ROWS, readBox, yearsOf, type HotspotRequest } from "./query";
import { openYear } from "./read";

export interface StreamResult {
  rows: number;
  cut: boolean;
  blocksRead: number;
  blocksTotal: number;
}

/**
 * Write the whole CSV for a request. `write` is called with one piece of text
 * at a time; `onDone` reports what was written.
 */
export async function streamHotspotsCsv(
  request: HotspotRequest,
  write: (text: string) => void | Promise<void>,
  limit = MAX_ROWS,
): Promise<StreamResult> {
  const box = readBox(request.area);
  await write(hotspotHeader(request));
  await write(hotspotColumnLine());

  let rows = 0;
  let cut = false;
  let blocksRead = 0;
  let blocksTotal = 0;

  for (const year of yearsOf(request.from, request.to)) {
    if (cut) break;
    const reader = await openYear(year, box);
    blocksRead += reader.blocks.kept;
    blocksTotal += reader.blocks.total;
    for (const range of reader.ranges) {
      const detections = await reader.read(range);
      let piece = "";
      for (const detection of detections) {
        const row = keepRow(detection, request);
        if (!row) continue;
        if (rows >= limit) {
          cut = true;
          break;
        }
        piece += hotspotRowText(row);
        rows += 1;
      }
      if (piece) await write(piece);
      if (cut) break;
    }
  }

  if (cut) await write(cutNotice(limit));
  return { rows, cut, blocksRead, blocksTotal };
}
