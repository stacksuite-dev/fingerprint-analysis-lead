/**
 * useFingerprintScanner — React hook for Futronic FS80H USB fingerprint capture via WebUSB.
 *
 * Protocol (reverse-engineered):
 *   1. Send 0xe0 via bulk OUT, read 512 bytes (device descriptor)
 *   2. Send 0x67 via bulk OUT (GetImage2 dose 4), read 184,320 bytes in 4096-byte chunks
 *   3. Raw image is 384×480, 8-bit grayscale
 *
 * Rendering pipeline: invert → auto-contrast (linear stretch) → canvas
 */
import { useState, useRef, useCallback, useEffect } from 'react';

// ── Hardware constants ──────────────────────────────────────────────────────────
const FUTRONIC_FILTERS = [
  { vendorId: 0x1491 },
  { vendorId: 0x1fba },
  { vendorId: 0x0958, productId: 0x0307 },
  { vendorId: 0x0834, productId: 0x0020 },
];

const SENSOR_WIDTH = 384;
const SENSOR_HEIGHT = 480;
const SENSOR_SIZE = SENSOR_WIDTH * SENSOR_HEIGHT; // 184,320

const CMD_DESCRIPTOR = 0xe0;
const CMD_CAPTURE = 0x67; // GetImage2 dose 4
const CHUNK_SIZE = 4096;
const CHUNK_TIMEOUT_MS = 3000;

// ── Status enum ─────────────────────────────────────────────────────────────────
export const ScannerStatus = {
  UNAVAILABLE: 'unavailable', // WebUSB not supported
  IDLE: 'idle',               // No device connected
  CONNECTING: 'connecting',
  READY: 'ready',             // Connected, waiting for scan
  SCANNING: 'scanning',       // Capture in progress
  ERROR: 'error',
};

// ── Hook ─────────────────────────────────────────────────────────────────────────
export default function useFingerprintScanner() {
  const [status, setStatus] = useState(
    typeof navigator !== 'undefined' && navigator.usb
      ? ScannerStatus.IDLE
      : ScannerStatus.UNAVAILABLE
  );
  const [error, setError] = useState(null);
  const [imageDataUrl, setImageDataUrl] = useState(null);

  const deviceRef = useRef(null);
  const endpointsRef = useRef({ in: null, out: null });
  const canvasRef = useRef(null); // off-screen canvas for rendering

  // Ensure we have an off-screen canvas
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
    canvasRef.current.width = SENSOR_WIDTH;
    canvasRef.current.height = SENSOR_HEIGHT;
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.close().catch(() => {});
        deviceRef.current = null;
      }
    };
  }, []);

  // ── Low-level USB helpers ───────────────────────────────────────────────────
  const clearEndpoints = useCallback(async () => {
    const dev = deviceRef.current;
    const ep = endpointsRef.current;
    if (!dev) return;
    try { if (ep.in) await dev.clearHalt('in', ep.in); } catch {}
    try { if (ep.out) await dev.clearHalt('out', ep.out); } catch {}
  }, []);

  const bulkWrite = useCallback(async (bytes) => {
    const dev = deviceRef.current;
    const ep = endpointsRef.current;
    if (!dev || !ep.out) throw new Error('Device not connected');
    const result = await dev.transferOut(ep.out, new Uint8Array(bytes));
    if (result.status !== 'ok') throw new Error(`Bulk write failed: ${result.status}`);
    return result;
  }, []);

  const bulkRead = useCallback(async (length) => {
    const dev = deviceRef.current;
    const ep = endpointsRef.current;
    if (!dev || !ep.in) throw new Error('Device not connected');
    const result = await dev.transferIn(ep.in, length);
    if (result.status !== 'ok' || !result.data) throw new Error(`Bulk read failed: ${result.status}`);
    return new Uint8Array(result.data.buffer);
  }, []);

  const bulkReadChunked = useCallback(async (totalLength) => {
    const dev = deviceRef.current;
    const ep = endpointsRef.current;
    if (!dev || !ep.in) throw new Error('Device not connected');

    const buffer = new Uint8Array(totalLength);
    let offset = 0;

    while (offset < totalLength) {
      const remaining = totalLength - offset;
      let readSize = Math.min(CHUNK_SIZE, remaining);
      if (readSize % 512 !== 0 && remaining > 512) {
        readSize = Math.ceil(readSize / 512) * 512;
      }

      const transferPromise = dev.transferIn(ep.in, readSize);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('CHUNK_TIMEOUT')), CHUNK_TIMEOUT_MS)
      );

      try {
        const result = await Promise.race([transferPromise, timeoutPromise]);
        if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
          const chunk = new Uint8Array(result.data.buffer);
          const toCopy = Math.min(chunk.length, totalLength - offset);
          buffer.set(chunk.subarray(0, toCopy), offset);
          offset += toCopy;
        } else {
          break;
        }
      } catch (err) {
        if (err.message === 'CHUNK_TIMEOUT') break;
        throw err;
      }
    }

    return buffer.slice(0, offset);
  }, []);

  // ── Render raw grayscale → data URL ─────────────────────────────────────────
  const renderImage = useCallback((rawBytes) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    canvas.width = SENSOR_WIDTH;
    canvas.height = SENSOR_HEIGHT;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(SENSOR_WIDTH, SENSOR_HEIGHT);
    const len = Math.min(rawBytes.length, SENSOR_SIZE);

    // Step 1: Copy + invert (scanner outputs ridges-dark, invert for natural look)
    const pixels = new Uint8Array(len);
    for (let i = 0; i < len; i++) pixels[i] = 255 - rawBytes[i];

    // Step 2: Auto-contrast (linear stretch)
    let min = 255, max = 0;
    for (let i = 0; i < len; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }
    const range = max - min;
    const scale = range > 0 ? 255 / range : 1;

    for (let i = 0; i < len; i++) {
      const v = range > 0 && range < 255
        ? Math.round((pixels[i] - min) * scale)
        : pixels[i];
      imgData.data[i * 4] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
      imgData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  }, []);

  // ── Open + claim a device (shared by connect and reconnect) ──────────────
  const openDevice = useCallback(async (dev) => {
    await dev.open();

    if (dev.configuration === null) {
      await dev.selectConfiguration(dev.configurations[0].configurationValue);
    }

    const iface = dev.configuration.interfaces[0];
    await dev.claimInterface(iface.interfaceNumber);

    const alt = iface.alternates[0];
    let epIn = null, epOut = null;
    for (const ep of alt.endpoints) {
      if (ep.direction === 'in' && ep.type === 'bulk') epIn = ep.endpointNumber;
      if (ep.direction === 'out' && ep.type === 'bulk') epOut = ep.endpointNumber;
    }

    if (!epIn || !epOut) throw new Error('Missing bulk endpoints');

    deviceRef.current = dev;
    endpointsRef.current = { in: epIn, out: epOut };
    setStatus(ScannerStatus.READY);
    setError(null);
    return true;
  }, []);

  // ── Connect (requires user gesture — opens browser permission dialog) ──────
  const connect = useCallback(async () => {
    if (!navigator.usb) {
      setStatus(ScannerStatus.UNAVAILABLE);
      setError('WebUSB not supported. Use Chrome or Edge.');
      return false;
    }

    setStatus(ScannerStatus.CONNECTING);
    setError(null);

    try {
      const dev = await navigator.usb.requestDevice({ filters: FUTRONIC_FILTERS });
      return await openDevice(dev);
    } catch (err) {
      if (err.name === 'NotFoundError') {
        setStatus(ScannerStatus.IDLE);
        return false;
      }
      setError(err.message);
      setStatus(ScannerStatus.ERROR);
      return false;
    }
  }, [openDevice]);

  // ── Reconnect (silent — no user gesture needed) ────────────────────────────
  // Uses getDevices() to reconnect to a previously-paired device.
  // Safe to call on app mount — no browser popup.
  const reconnect = useCallback(async () => {
    if (!navigator.usb) {
      setStatus(ScannerStatus.UNAVAILABLE);
      return false;
    }
    // Already connected
    if (deviceRef.current) return true;

    try {
      const devices = await navigator.usb.getDevices();
      if (devices.length === 0) return false;

      setStatus(ScannerStatus.CONNECTING);
      return await openDevice(devices[0]);
    } catch (err) {
      setError(err.message);
      setStatus(ScannerStatus.ERROR);
      return false;
    }
  }, [openDevice]);

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (deviceRef.current) {
      try { await deviceRef.current.close(); } catch {}
      deviceRef.current = null;
    }
    endpointsRef.current = { in: null, out: null };
    setStatus(ScannerStatus.IDLE);
    setError(null);
  }, []);

  // ── Capture ─────────────────────────────────────────────────────────────────
  const capture = useCallback(async () => {
    if (!deviceRef.current) {
      setError('Device not connected');
      return null;
    }

    setStatus(ScannerStatus.SCANNING);
    setError(null);
    setImageDataUrl(null);

    try {
      await clearEndpoints();

      // Step 1: Read descriptor (init handshake)
      await bulkWrite([CMD_DESCRIPTOR]);
      await bulkRead(512);

      // Step 2: Send capture command
      await bulkWrite([CMD_CAPTURE]);

      // Step 3: Read full sensor image
      const rawBytes = await bulkReadChunked(SENSOR_SIZE);

      if (rawBytes.length < SENSOR_SIZE * 0.5) {
        throw new Error(`Incomplete capture: ${rawBytes.length}/${SENSOR_SIZE} bytes`);
      }

      // Step 4: Render to data URL
      const dataUrl = renderImage(rawBytes);
      setImageDataUrl(dataUrl);
      setStatus(ScannerStatus.READY);
      return { dataUrl, rawBytes, width: SENSOR_WIDTH, height: SENSOR_HEIGHT };
    } catch (err) {
      setError(err.message);
      setStatus(ScannerStatus.ERROR);
      // Try to recover endpoints
      try { await clearEndpoints(); } catch {}
      return null;
    }
  }, [clearEndpoints, bulkWrite, bulkRead, bulkReadChunked, renderImage]);

  // ── Public API ──────────────────────────────────────────────────────────────
  return {
    status,
    error,
    imageDataUrl,
    isSupported: typeof navigator !== 'undefined' && !!navigator.usb,
    isConnected: status === ScannerStatus.READY || status === ScannerStatus.SCANNING,
    isScanning: status === ScannerStatus.SCANNING,
    connect,
    reconnect,
    disconnect,
    capture,
    SENSOR_WIDTH,
    SENSOR_HEIGHT,
  };
}
