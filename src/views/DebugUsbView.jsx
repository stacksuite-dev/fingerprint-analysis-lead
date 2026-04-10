import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';

// Known Futronic USB identifiers (from SDK reverse engineering)
const FUTRONIC_FILTERS = [
  { vendorId: 0x1491 }, // Futronic primary VID
  { vendorId: 0x1fba }, // Futronic secondary VID
  { vendorId: 0x0958, productId: 0x0307 }, // OEM variant
  { vendorId: 0x0834, productId: 0x0020 }, // OEM variant
];

// FS80H image specs
// Descriptor offset 0x04-0x05 (BE) = 0x0180 = 384 = actual sensor width
// Descriptor offset 0x22-0x23 (BE) = 0x0140 = 320 = SDK-reported (cropped) width
// Descriptor offset 0x24-0x25 (BE) = 0x01E0 = 480 = height
const SENSOR_WIDTH = 384;   // actual sensor pixel width (confirmed by rendering)
const SENSOR_HEIGHT = 480;  // rows
const SENSOR_SIZE = SENSOR_WIDTH * SENSOR_HEIGHT; // 184320 bytes
const SDK_WIDTH = 320;      // width reported by SDK (center-cropped from 384)
const SDK_HEIGHT = 480;
const SDK_SIZE = SDK_WIDTH * SDK_HEIGHT; // 153600 bytes (what we used to read)

// Keep legacy constant for backward compatibility with read-size selection
const IMAGE_WIDTH = SENSOR_WIDTH;
const IMAGE_HEIGHT = SENSOR_HEIGHT;
const IMAGE_SIZE = SENSOR_SIZE;

// Protocol commands (reverse-engineered from Android libftrScanAPI.so)
const CMD_GET_DESCRIPTOR = 0xe0; // Read 64-byte device descriptor

// GetImage2 dose-to-command table (Fs80CompDeviceCommands)
const GET_IMAGE2_CMDS = {
  1: 0x37,
  2: 0x45,
  3: 0x56,
  4: 0x67, // ← default dose used by FPScan.java
  5: 0x79,
  6: 0x8d,
  7: 0x9e,
};

// GetImage dose-to-command table
const GET_IMAGE_CMDS = {
  0x6e: 0x8c,
  0x93: 0x65,
  0xae: 0x40,
  0xc2: 0x2d,
};

// Transfer chunk size (from UsbDeviceDataExchangeImpl.java — uses 4096-byte buffer)
const CHUNK_SIZE = 4096;

// CRC8 validation for descriptor response (last byte = CRC8 of first 63 bytes)
function crc8(data, len) {
  let crc = 0;
  for (let i = 0; i < len; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0x07) & 0xff; // CRC-8/CCITT polynomial
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc;
}

const STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SCANNING: 'scanning',
  ERROR: 'error',
};

function LogEntry({ entry }) {
  const colors = {
    info: 'text-blue-300',
    success: 'text-green-300',
    error: 'text-red-300',
    warn: 'text-yellow-300',
    data: 'text-purple-300',
    usb: 'text-cyan-300',
  };
  return (
    <div className={`font-mono text-xs leading-relaxed ${colors[entry.type] || 'text-gray-300'}`}>
      <span className="text-gray-500 mr-2">[{entry.time}]</span>
      <span className="text-gray-500 mr-1">{entry.type.toUpperCase().padEnd(7)}</span>
      {entry.msg}
    </div>
  );
}

// Default render options
const DEFAULT_RENDER_OPTS = {
  width: SENSOR_WIDTH,      // 384 = actual sensor width (confirmed)
  invert: false,            // 255 - value
  deinterleave: 'none',     // 'none' | 'even-odd' | 'odd-even' | 'reverse-rows'
  contrast: 'auto',         // 'none' | 'auto' (linear stretch) | 'histeq' (histogram equalization)
  threshold: 0,             // 0=off, 1-255=binary threshold level
  transpose: false,         // column-major rendering (swap W/H)
  headerSkip: 0,            // skip N bytes at start of data
  bitDepth: 8,              // 8 or 4 (some scanners pack 2 pixels per byte)
  readSize: SENSOR_SIZE,    // how many bytes to request from device (184320 for full 384x480)
};

export default function DebugUsbView({ onBack }) {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [device, setDevice] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [imageData, setImageData] = useState(null);
  const [endpoints, setEndpoints] = useState({ in: null, out: null });
  const [renderOpts, setRenderOpts] = useState({ ...DEFAULT_RENDER_OPTS });
  const [lastCapture, setLastCapture] = useState(null); // raw Uint8Array from last capture

  const canvasRef = useRef(null);
  const logContainerRef = useRef(null);
  const deviceRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const log = useCallback((type, msg) => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    setLogs(prev => [...prev.slice(-200), { type, msg, time }]);
  }, []);

  const clearLogs = () => setLogs([]);

  const formatLogsAsText = useCallback(() => {
    return logs.map(e => `[${e.time}] ${e.type.toUpperCase().padEnd(7)} ${e.msg}`).join('\n');
  }, [logs]);

  const copyLogs = useCallback(async () => {
    const text = formatLogsAsText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      log('info', 'Logs copied to clipboard');
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      log('info', 'Logs copied to clipboard (fallback)');
    }
  }, [formatLogsAsText, log]);

  // ---- WebUSB Connection ----
  const connectDevice = async () => {
    if (!navigator.usb) {
      log('error', 'WebUSB is not supported in this browser. Use Chrome/Edge.');
      setStatus(STATUS.ERROR);
      return;
    }

    setStatus(STATUS.CONNECTING);
    log('info', 'Requesting USB device...');
    log('info', `Filters: ${JSON.stringify(FUTRONIC_FILTERS.map(f => ({ vid: '0x' + f.vendorId.toString(16), pid: f.productId ? '0x' + f.productId.toString(16) : '*' })))}`);

    try {
      const selectedDevice = await navigator.usb.requestDevice({ filters: FUTRONIC_FILTERS });
      log('success', `Device selected: ${selectedDevice.productName || 'Unknown'}`);
      log('usb', `Vendor ID: 0x${selectedDevice.vendorId.toString(16).padStart(4, '0')}`);
      log('usb', `Product ID: 0x${selectedDevice.productId.toString(16).padStart(4, '0')}`);
      log('usb', `Serial: ${selectedDevice.serialNumber || 'N/A'}`);
      log('usb', `Manufacturer: ${selectedDevice.manufacturerName || 'N/A'}`);
      log('usb', `USB Version: ${selectedDevice.usbVersionMajor}.${selectedDevice.usbVersionMinor}`);
      log('usb', `Device Class: 0x${selectedDevice.deviceClass.toString(16)}`);
      log('usb', `Configurations: ${selectedDevice.configurations.length}`);

      await selectedDevice.open();
      log('success', 'Device opened');

      // Log all configurations and interfaces
      for (const config of selectedDevice.configurations) {
        log('usb', `Config #${config.configurationValue}: ${config.interfaces.length} interface(s)`);
        for (const iface of config.interfaces) {
          for (const alt of iface.alternates) {
            log('usb', `  Interface ${iface.interfaceNumber} alt ${alt.alternateSetting}: class=0x${alt.interfaceClass.toString(16)} subclass=0x${alt.interfaceSubclass.toString(16)} protocol=0x${alt.interfaceProtocol.toString(16)}`);
            for (const ep of alt.endpoints) {
              log('usb', `    EP 0x${ep.endpointNumber.toString(16)} ${ep.direction} ${ep.type} packetSize=${ep.packetSize}`);
            }
          }
        }
      }

      // Select configuration if needed
      if (selectedDevice.configuration === null) {
        const configValue = selectedDevice.configurations[0].configurationValue;
        await selectedDevice.selectConfiguration(configValue);
        log('info', `Selected configuration ${configValue}`);
      }

      // Claim first interface
      const iface = selectedDevice.configuration.interfaces[0];
      const interfaceNum = iface.interfaceNumber;
      await selectedDevice.claimInterface(interfaceNum);
      log('success', `Claimed interface ${interfaceNum}`);

      // Find bulk endpoints
      const alt = iface.alternates[0];
      let epIn = null;
      let epOut = null;
      for (const ep of alt.endpoints) {
        if (ep.direction === 'in' && ep.type === 'bulk') {
          epIn = ep.endpointNumber;
          log('usb', `Bulk IN endpoint: 0x${ep.endpointNumber.toString(16)} (packetSize=${ep.packetSize})`);
        }
        if (ep.direction === 'out' && ep.type === 'bulk') {
          epOut = ep.endpointNumber;
          log('usb', `Bulk OUT endpoint: 0x${ep.endpointNumber.toString(16)} (packetSize=${ep.packetSize})`);
        }
      }

      if (!epIn) {
        log('warn', 'No bulk IN endpoint found. Trying interrupt endpoints...');
        for (const ep of alt.endpoints) {
          if (ep.direction === 'in') {
            epIn = ep.endpointNumber;
            log('usb', `Using ${ep.type} IN endpoint: 0x${ep.endpointNumber.toString(16)}`);
            break;
          }
        }
      }

      setEndpoints({ in: epIn, out: epOut });
      setDevice(selectedDevice);
      deviceRef.current = selectedDevice;
      setDeviceInfo({
        name: selectedDevice.productName || 'Unknown Device',
        vendor: selectedDevice.manufacturerName || 'Unknown',
        vid: '0x' + selectedDevice.vendorId.toString(16).padStart(4, '0'),
        pid: '0x' + selectedDevice.productId.toString(16).padStart(4, '0'),
        serial: selectedDevice.serialNumber || 'N/A',
        interfaceClass: '0x' + alt.interfaceClass.toString(16),
        endpointIn: epIn ? '0x' + epIn.toString(16) : 'N/A',
        endpointOut: epOut ? '0x' + epOut.toString(16) : 'N/A',
      });
      setStatus(STATUS.CONNECTED);
      log('success', 'Device ready for commands');

    } catch (err) {
      if (err.name === 'NotFoundError') {
        log('warn', 'No device selected (user cancelled)');
        setStatus(STATUS.IDLE);
      } else {
        log('error', `Connection failed: ${err.message}`);
        log('error', `Error type: ${err.name}`);
        setStatus(STATUS.ERROR);
      }
    }
  };

  const disconnectDevice = async () => {
    if (deviceRef.current) {
      try {
        await deviceRef.current.close();
        log('info', 'Device disconnected');
      } catch (err) {
        log('warn', `Disconnect error: ${err.message}`);
      }
    }
    setDevice(null);
    deviceRef.current = null;
    setDeviceInfo(null);
    setEndpoints({ in: null, out: null });
    setStatus(STATUS.IDLE);
  };

  // ---- Raw USB Transfer Commands ----
  const sendControlTransfer = async (request, value, index, dataOrLength) => {
    if (!deviceRef.current) return null;
    try {
      log('usb', `Control OUT: request=0x${request.toString(16)} value=0x${value.toString(16)} index=0x${index.toString(16)}`);
      const result = await deviceRef.current.controlTransferOut({
        requestType: 'vendor',
        recipient: 'device',
        request,
        value,
        index,
      }, typeof dataOrLength === 'number' ? new Uint8Array(dataOrLength) : dataOrLength);
      log('data', `Control OUT status: ${result.status}, bytesWritten: ${result.bytesWritten}`);
      return result;
    } catch (err) {
      log('error', `Control OUT failed: ${err.message}`);
      return null;
    }
  };

  const readControlTransfer = async (request, value, index, length) => {
    if (!deviceRef.current) return null;
    try {
      log('usb', `Control IN: request=0x${request.toString(16)} value=0x${value.toString(16)} index=0x${index.toString(16)} len=${length}`);
      const result = await deviceRef.current.controlTransferIn({
        requestType: 'vendor',
        recipient: 'device',
        request,
        value,
        index,
      }, length);
      if (result.status === 'ok' && result.data) {
        const bytes = new Uint8Array(result.data.buffer);
        const hex = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        log('data', `Control IN: ${result.data.byteLength} bytes: ${hex}${bytes.length > 32 ? '...' : ''}`);
      } else {
        log('warn', `Control IN status: ${result.status}`);
      }
      return result;
    } catch (err) {
      log('error', `Control IN failed: ${err.message}`);
      return null;
    }
  };

  // ---- Reset / Clear Halt on endpoints ----
  const resetEndpoints = async () => {
    if (!deviceRef.current) return;
    log('info', 'Clearing endpoint halt/stall...');
    try {
      if (endpoints.in) {
        await deviceRef.current.clearHalt('in', endpoints.in);
        log('success', `Cleared halt on IN endpoint 0x${endpoints.in.toString(16)}`);
      }
    } catch (err) {
      log('warn', `Clear halt IN failed: ${err.message}`);
    }
    try {
      if (endpoints.out) {
        await deviceRef.current.clearHalt('out', endpoints.out);
        log('success', `Cleared halt on OUT endpoint 0x${endpoints.out.toString(16)}`);
      }
    } catch (err) {
      log('warn', `Clear halt OUT failed: ${err.message}`);
    }
  };

  const bulkWrite = async (data) => {
    if (!deviceRef.current || !endpoints.out) {
      log('error', 'No device or no OUT endpoint');
      return null;
    }
    try {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      const hex = Array.from(bytes.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      log('usb', `Bulk OUT (EP 0x${endpoints.out.toString(16)}): ${bytes.length} bytes: ${hex}`);
      const result = await deviceRef.current.transferOut(endpoints.out, bytes);
      log('data', `Bulk OUT status: ${result.status}, bytesWritten: ${result.bytesWritten}`);
      return result;
    } catch (err) {
      log('error', `Bulk OUT failed: ${err.message}`);
      // Auto-clear halt on failure
      try { await deviceRef.current.clearHalt('out', endpoints.out); } catch {}
      return null;
    }
  };

  const bulkRead = async (length) => {
    if (!deviceRef.current || !endpoints.in) {
      log('error', 'No device or no IN endpoint');
      return null;
    }
    try {
      log('usb', `Bulk IN (EP 0x${endpoints.in.toString(16)}): requesting ${length} bytes`);
      const result = await deviceRef.current.transferIn(endpoints.in, length);
      if (result.status === 'ok' && result.data) {
        const bytes = new Uint8Array(result.data.buffer);
        const hex = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        log('data', `Bulk IN: ${result.data.byteLength} bytes: ${hex}${bytes.length > 32 ? '...' : ''}`);
        return result;
      } else {
        log('warn', `Bulk IN status: ${result.status}`);
        // Clear halt on babble/stall
        try { await deviceRef.current.clearHalt('in', endpoints.in); log('info', 'Auto-cleared halt on IN endpoint'); } catch {}
        return result;
      }
    } catch (err) {
      log('error', `Bulk IN failed: ${err.message}`);
      // Auto-clear halt on failure
      try { await deviceRef.current.clearHalt('in', endpoints.in); log('info', 'Auto-cleared halt on IN endpoint'); } catch {}
      return null;
    }
  };

  // ---- Chunked Bulk Read (matches UsbDeviceDataExchangeImpl.java DataExchange logic) ----
  // Added per-chunk timeout to prevent infinite hangs when requesting more bytes than device has
  const bulkReadChunked = async (totalLength, chunkSize = CHUNK_SIZE) => {
    if (!deviceRef.current || !endpoints.in) {
      log('error', 'No device or no IN endpoint');
      return null;
    }
    const buffer = new Uint8Array(totalLength);
    let offset = 0;
    let retries = 0;
    const maxRetries = 3;
    const chunkTimeoutMs = 3000; // 3s per chunk — if device has no more data, we stop
    const startTime = performance.now();

    log('usb', `Chunked bulk read: ${totalLength} bytes in ${chunkSize}-byte chunks (${chunkTimeoutMs}ms timeout/chunk)`);

    while (offset < totalLength) {
      const remaining = totalLength - offset;
      // Align read size to maxPacketSize (512) as the Java code does
      let readSize = Math.min(chunkSize, remaining);
      if (readSize % 512 !== 0 && remaining > 512) {
        readSize = Math.ceil(readSize / 512) * 512;
      }

      try {
        // Race transferIn against a timeout to prevent infinite hang
        const transferPromise = deviceRef.current.transferIn(endpoints.in, readSize);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('CHUNK_TIMEOUT')), chunkTimeoutMs)
        );
        const result = await Promise.race([transferPromise, timeoutPromise]);

        if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
          const chunk = new Uint8Array(result.data.buffer);
          const toCopy = Math.min(chunk.length, totalLength - offset);
          buffer.set(chunk.subarray(0, toCopy), offset);
          offset += toCopy;
          retries = 0;

          // Progress logging every ~10%
          const pct = Math.floor((offset / totalLength) * 100);
          if (pct % 10 === 0 || offset === totalLength) {
            log('data', `  Read progress: ${offset}/${totalLength} bytes (${pct}%)`);
          }
        } else {
          retries++;
          log('warn', `  Chunk read status: ${result.status}, retry ${retries}/${maxRetries}`);
          if (retries >= maxRetries) break;
        }
      } catch (err) {
        if (err.message === 'CHUNK_TIMEOUT') {
          log('warn', `  Chunk read timed out at offset ${offset}/${totalLength} — device likely has no more data`);
          break; // Don't retry on timeout — device is done sending
        }
        retries++;
        log('error', `  Chunk read error: ${err.message}, retry ${retries}/${maxRetries}`);
        if (retries >= maxRetries) break;
      }
    }

    const elapsed = (performance.now() - startTime).toFixed(0);
    if (offset < totalLength) {
      log('warn', `Chunked read: got ${offset}/${totalLength} bytes in ${elapsed}ms (device sent less than requested)`);
      log('info', `At width ${renderOpts.width}: ${offset} bytes = ${(offset / renderOpts.width) | 0} rows`);
    } else {
      log('info', `Chunked read complete: ${offset}/${totalLength} bytes in ${elapsed}ms`);
    }
    return { buffer: buffer.slice(0, offset), bytesRead: offset };
  };

  // ---- Probe: Read Device Descriptor (cmd 0xe0) ----
  const probeDevice = async () => {
    if (!deviceRef.current) return;
    log('info', '=== Reading Device Descriptor (cmd 0xe0) ===');

    // Clear any stalled endpoints first
    await resetEndpoints();

    // Method 1: Try control transfer first (as CBaseDeviceCommandType::Open does)
    log('info', '--- Method 1: Control transfer with request=0xe0 ---');
    try {
      const ctrlResult = await deviceRef.current.controlTransferIn({
        requestType: 'vendor',
        recipient: 'device',
        request: CMD_GET_DESCRIPTOR,
        value: 0,
        index: 0,
      }, 512);
      if (ctrlResult.status === 'ok' && ctrlResult.data && ctrlResult.data.byteLength > 0) {
        const bytes = new Uint8Array(ctrlResult.data.buffer);
        const allZero = bytes.every(b => b === 0);
        if (!allZero) {
          logDescriptor(bytes, 'control transfer');
        } else {
          log('warn', 'Control transfer returned all zeros, trying bulk transfer...');
        }
      }
    } catch (err) {
      log('warn', `Control transfer failed: ${err.message}`);
      log('info', 'Falling back to bulk transfer...');
    }

    // Method 2: Bulk transfer (send 0xe0, read with large buffer to avoid babble)
    // Previous attempt with 64 bytes got "babble" = device sends more than requested
    log('info', '--- Method 2: Bulk transfer (write 0xe0, read 512 bytes) ---');
    await resetEndpoints();
    try {
      const writeResult = await bulkWrite(new Uint8Array([CMD_GET_DESCRIPTOR]));
      if (!writeResult || writeResult.status !== 'ok') {
        log('error', 'Failed to send descriptor command via bulk');
      } else {
        // Read with 512-byte buffer (packetSize-aligned) to avoid babble
        const readResult = await bulkRead(512);
        if (readResult?.status === 'ok' && readResult.data) {
          const bytes = new Uint8Array(readResult.data.buffer);
          logDescriptor(bytes, 'bulk transfer (512-byte buffer)');
        } else {
          log('warn', 'Bulk read with 512 bytes failed, trying 4096...');
          await resetEndpoints();
          // Resend command and try larger buffer
          await bulkWrite(new Uint8Array([CMD_GET_DESCRIPTOR]));
          const readResult2 = await bulkRead(4096);
          if (readResult2?.status === 'ok' && readResult2.data) {
            const bytes = new Uint8Array(readResult2.data.buffer);
            logDescriptor(bytes, 'bulk transfer (4096-byte buffer)');
          } else {
            log('error', 'Failed to read descriptor response');
          }
        }
      }
    } catch (err) {
      log('error', `Bulk descriptor read failed: ${err.message}`);
    }

    // Method 3: Also try some additional control request probes
    log('info', '--- Method 3: Probing vendor control requests 0x00-0x10 ---');
    for (let req = 0; req <= 0x10; req++) {
      try {
        const result = await deviceRef.current.controlTransferIn({
          requestType: 'vendor',
          recipient: 'device',
          request: req,
          value: 0,
          index: 0,
        }, 512);
        if (result.status === 'ok' && result.data && result.data.byteLength > 0) {
          const bytes = new Uint8Array(result.data.buffer);
          if (!bytes.every(b => b === 0)) {
            const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
            log('success', `Control req 0x${req.toString(16)}: ${result.data.byteLength} bytes = ${hex}`);
          }
        }
      } catch {
        // silently skip
      }
    }

    log('info', '=== Probe complete ===');
  };

  // ---- Log and validate descriptor ----
  const logDescriptor = (bytes, method) => {
    log('success', `Descriptor via ${method}: ${bytes.length} bytes`);

    // Full hex dump in rows of 16
    for (let i = 0; i < bytes.length; i += 16) {
      const row = Array.from(bytes.slice(i, Math.min(i + 16, bytes.length)));
      const hex = row.map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = row.map(b => (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.').join('');
      log('data', `  ${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48)} ${ascii}`);
    }

    // CRC8 validation (last byte should be CRC8 of first 63 bytes)
    if (bytes.length >= 64) {
      const expected = crc8(bytes, 63);
      const actual = bytes[63];
      if (expected === actual) {
        log('success', `CRC8 valid: 0x${actual.toString(16).padStart(2, '0')}`);
      } else {
        log('warn', `CRC8 mismatch: got 0x${actual.toString(16).padStart(2, '0')}, expected 0x${expected.toString(16).padStart(2, '0')}`);
        // Try alternate CRC polynomial (0x31 for CRC-8/MAXIM)
        let crc2 = 0;
        for (let i = 0; i < 63; i++) {
          crc2 ^= bytes[i];
          for (let j = 0; j < 8; j++) {
            if (crc2 & 0x80) crc2 = ((crc2 << 1) ^ 0x31) & 0xff;
            else crc2 = (crc2 << 1) & 0xff;
          }
        }
        if (crc2 === actual) {
          log('success', `CRC8 valid with polynomial 0x31: 0x${actual.toString(16).padStart(2, '0')}`);
        }
      }
    }

    // Attempt to interpret known descriptor fields
    // From actual device response: big-endian words at offset 0x22-0x25 encode image dimensions
    log('info', 'Descriptor field analysis:');

    // Scan for image dimensions in both endiannesses
    for (let i = 0; i < Math.min(bytes.length - 3, 48); i++) {
      const be16 = (bytes[i] << 8) | bytes[i + 1];
      const le16 = bytes[i] | (bytes[i + 1] << 8);
      if (be16 === SENSOR_WIDTH) log('success', `  Offset 0x${i.toString(16)}: BE word = ${be16} === SENSOR WIDTH (384)`);
      if (be16 === SDK_WIDTH) log('success', `  Offset 0x${i.toString(16)}: BE word = ${be16} === SDK WIDTH (320)`);
      if (be16 === SENSOR_HEIGHT) log('success', `  Offset 0x${i.toString(16)}: BE word = ${be16} === HEIGHT (480)`);
      if (le16 === SENSOR_WIDTH) log('success', `  Offset 0x${i.toString(16)}: LE word = ${le16} === SENSOR WIDTH (384)`);
      if (le16 === SDK_WIDTH) log('success', `  Offset 0x${i.toString(16)}: LE word = ${le16} === SDK WIDTH (320)`);
      if (le16 === SENSOR_HEIGHT) log('success', `  Offset 0x${i.toString(16)}: LE word = ${le16} === HEIGHT (480)`);
    }

    // Known offsets from this device
    const sensorWidthBE = (bytes[0x04] << 8) | bytes[0x05]; // expected 0x0180 = 384 = actual sensor width
    const sdkWidthBE = (bytes[0x22] << 8) | bytes[0x23]; // expected 0x0140 = 320 = SDK-cropped width
    const heightBE = (bytes[0x24] << 8) | bytes[0x25]; // expected 0x01e0 = 480
    log('data', `  [0x04-0x05] = ${sensorWidthBE} (0x${sensorWidthBE.toString(16)}) ${sensorWidthBE === SENSOR_WIDTH ? '← SENSOR WIDTH (384)' : ''}`);
    log('data', `  [0x22-0x23] = ${sdkWidthBE} (0x${sdkWidthBE.toString(16)}) ${sdkWidthBE === SDK_WIDTH ? '← SDK WIDTH (320, cropped)' : ''}`);
    log('data', `  [0x24-0x25] = ${heightBE} (0x${heightBE.toString(16)}) ${heightBE === SENSOR_HEIGHT ? '← HEIGHT (480)' : ''}`);
    log('data', `  Full sensor: ${sensorWidthBE}x${heightBE} = ${sensorWidthBE * heightBE} bytes`);
    // Log first 8 bytes individually
    for (let i = 0; i < Math.min(bytes.length, 8); i++) {
      log('data', `  Byte[${i}]: 0x${bytes[i].toString(16).padStart(2, '0')} (${bytes[i]})`);
    }

    // Count non-zero bytes in different regions
    const region1 = bytes.slice(0, 64);
    const region2 = bytes.slice(64);
    const nz1 = Array.from(region1).filter(b => b !== 0).length;
    const nz2 = Array.from(region2).filter(b => b !== 0).length;
    log('data', `  Bytes 0-63: ${nz1}/64 non-zero (descriptor header)`);
    log('data', `  Bytes 64+: ${nz2}/${region2.length} non-zero (${region2.length > 0 ? 'extra data / calibration?' : 'none'})`);
  };

  // ---- Image Capture: GetImage2 with dose (default dose=4, cmd=0x67) ----
  const captureImage = async (dose = 4) => {
    if (!deviceRef.current) return;
    setStatus(STATUS.SCANNING);

    const cmdByte = GET_IMAGE2_CMDS[dose];
    if (!cmdByte) {
      log('error', `Invalid dose ${dose}. Valid doses: 1-7`);
      setStatus(STATUS.CONNECTED);
      return;
    }

    log('info', `=== Image Capture: GetImage2 dose=${dose}, cmd=0x${cmdByte.toString(16)} ===`);
    log('info', 'TIP: Place your finger on the scanner BEFORE clicking capture!');

    try {
      // Clear any stalled endpoints first
      await resetEndpoints();

      // Step 1: Read descriptor to initialize device
      log('info', 'Step 1: Init device (read descriptor)');
      if (!deviceRef.current) { setStatus(STATUS.IDLE); return; }
      await bulkWrite(new Uint8Array([CMD_GET_DESCRIPTOR]));
      if (!deviceRef.current) { setStatus(STATUS.IDLE); return; }
      const descResult = await bulkRead(512);
      if (descResult?.status === 'ok' && descResult.data) {
        log('data', `Descriptor: ${descResult.data.byteLength} bytes OK`);
      } else {
        log('warn', 'Descriptor read failed, continuing anyway...');
        await resetEndpoints();
      }

      // Step 2: Send image capture command
      log('info', `Step 2: Send capture cmd 0x${cmdByte.toString(16)}`);
      if (!deviceRef.current) { setStatus(STATUS.IDLE); return; }
      const writeResult = await bulkWrite(new Uint8Array([cmdByte]));
      if (!writeResult || writeResult.status !== 'ok') {
        log('error', 'Failed to send capture command');
        setStatus(STATUS.CONNECTED);
        return;
      }

      // Step 3: Read full image data
      // Use readSize from render options (default: 184320 = 384x480 full sensor)
      const readSize = renderOpts.readSize || SENSOR_SIZE;
      log('info', `Step 3: Reading ${readSize} bytes of image data (${readSize === SENSOR_SIZE ? '384x480 full sensor' : readSize === SDK_SIZE ? '320x480 SDK size' : 'custom'})...`);
      if (!deviceRef.current) { setStatus(STATUS.IDLE); return; }
      const result = await bulkReadChunked(readSize);
      if (result && result.bytesRead > 0) {
        // Analyze FULL image, not just first 1000 bytes
        let fullMin = 255, fullMax = 0;
        const histogram = new Uint32Array(256);
        for (let i = 0; i < result.bytesRead; i++) {
          const v = result.buffer[i];
          if (v < fullMin) fullMin = v;
          if (v > fullMax) fullMax = v;
          histogram[v]++;
        }
        const uniqueCount = histogram.filter(c => c > 0).length;
        const range = fullMax - fullMin;

        log('data', `Received ${result.bytesRead} bytes — ${uniqueCount} unique values, range [${fullMin}-${fullMax}]`);

        // Show top pixel values
        const topValues = [];
        for (let v = 0; v < 256; v++) {
          if (histogram[v] > 0) topValues.push({ v, count: histogram[v] });
        }
        topValues.sort((a, b) => b.count - a.count);
        const topStr = topValues.slice(0, 8).map(t => `${t.v}:${t.count}`).join(', ');
        log('data', `Histogram (top 8): ${topStr}`);

        if (uniqueCount <= 3 && range <= 2) {
          log('warn', 'Image is nearly black (values 0-2). Likely no finger or dose too high.');
        } else if (uniqueCount > 20) {
          log('success', `Good grayscale data — ${uniqueCount} gray levels detected!`);
        } else {
          log('info', `Low dynamic range (${uniqueCount} levels). Image may be dim but visible after scaling.`);
        }

        // Row analysis: find content vs dark rows (helps diagnose vertical offset)
        const rowWidth = renderOpts.width || SENSOR_WIDTH;
        const totalRows = Math.floor(result.bytesRead / rowWidth);
        log('info', `Row analysis (width=${rowWidth}): ${totalRows} rows, ${result.bytesRead} bytes`);

        // Compute per-row average brightness
        let firstContentRow = -1, lastContentRow = -1;
        const rowAvgs = [];
        for (let row = 0; row < totalRows; row++) {
          let sum = 0;
          const rowStart = row * rowWidth;
          for (let x = 0; x < rowWidth && rowStart + x < result.bytesRead; x++) {
            sum += result.buffer[rowStart + x];
          }
          const avg = sum / rowWidth;
          rowAvgs.push(avg);
          if (avg > 3) { // row has content (not just 0-2 dark values)
            if (firstContentRow === -1) firstContentRow = row;
            lastContentRow = row;
          }
        }

        log('data', `  Content rows: ${firstContentRow} to ${lastContentRow} (${lastContentRow - firstContentRow + 1} rows with data)`);
        log('data', `  Dark rows at top: ${firstContentRow > 0 ? firstContentRow : 0}`);
        log('data', `  Dark rows at bottom: ${totalRows - 1 - lastContentRow}`);

        // Sample row averages every ~40 rows
        const step = Math.max(1, Math.floor(totalRows / 10));
        const samples = [];
        for (let r = 0; r < totalRows; r += step) {
          samples.push(`r${r}=${rowAvgs[r].toFixed(1)}`);
        }
        log('data', `  Row brightness: ${samples.join(', ')}`);

        // Always render whatever we got (trim to actual bytes read)
        renderGrayscaleImage(result.buffer.slice(0, result.bytesRead));
      } else {
        log('error', 'No data received from image read');
      }

    } catch (err) {
      log('error', `Image capture error: ${err.message}`);
    }

    if (deviceRef.current) setStatus(STATUS.CONNECTED);
    log('info', '=== Image capture complete ===');
  };

  // ---- Quick Capture: Try all doses ----
  const scanAllDoses = async () => {
    if (!deviceRef.current) return;
    setStatus(STATUS.SCANNING);
    log('info', '=== Scanning all GetImage2 doses (1-7) — reading 4KB sample each ===');

    for (const [dose, cmd] of Object.entries(GET_IMAGE2_CMDS)) {
      if (!deviceRef.current) break;
      log('info', `--- Dose ${dose}: cmd=0x${cmd.toString(16)} ---`);
      await resetEndpoints();
      try {
        await bulkWrite(new Uint8Array([cmd]));
        if (!deviceRef.current) break;
        const result = await bulkRead(4096);
        if (result?.status === 'ok' && result.data) {
          const bytes = new Uint8Array(result.data.buffer);
          const uniqueValues = new Set(bytes.slice(0, Math.min(bytes.length, 512)));
          const min = Math.min(...bytes.slice(0, 512));
          const max = Math.max(...bytes.slice(0, 512));
          const hex = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          log('data', `  ${result.data.byteLength} bytes, ${uniqueValues.size} unique vals, range [${min}-${max}]: ${hex}...`);
          if (max > 1) log('success', `  *** Dose ${dose} has grayscale data! Try full capture with this dose. ***`);
        }
      } catch (err) {
        log('warn', `  Dose ${dose} failed: ${err.message}`);
      }
    }

    // Also try GetImage commands
    log('info', '--- Trying GetImage commands ---');
    for (const [cmd, dose] of Object.entries(GET_IMAGE_CMDS)) {
      if (!deviceRef.current) break;
      const cmdByte = parseInt(cmd);
      log('info', `  GetImage cmd=0x${cmdByte.toString(16)}, dose=0x${dose.toString(16)}`);
      await resetEndpoints();
      try {
        await bulkWrite(new Uint8Array([cmdByte]));
        if (!deviceRef.current) break;
        const result = await bulkRead(4096);
        if (result?.status === 'ok' && result.data) {
          const bytes = new Uint8Array(result.data.buffer);
          const min = Math.min(...bytes.slice(0, 512));
          const max = Math.max(...bytes.slice(0, 512));
          const hex = Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ');
          log('data', `  ${result.data.byteLength} bytes, range [${min}-${max}]: ${hex}...`);
          if (max > 1) log('success', `  *** This command has grayscale data! ***`);
        }
      } catch (err) {
        log('warn', `  cmd 0x${cmdByte.toString(16)} failed: ${err.message}`);
      }
    }

    if (deviceRef.current) setStatus(STATUS.CONNECTED);
    log('info', '=== Dose scan complete. Place finger on scanner and retry for real data. ===');
  };

  // ---- Custom command input ----
  const [customCmd, setCustomCmd] = useState('');

  const sendCustomBulk = async () => {
    if (!customCmd.trim()) return;
    const bytes = customCmd.trim().split(/[\s,]+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n));
    if (bytes.length === 0) {
      log('error', 'Invalid hex input. Use format: 01 02 0a ff');
      return;
    }
    log('info', `Sending custom bulk: ${bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`);
    await bulkWrite(new Uint8Array(bytes));
  };

  const readCustomBulk = async () => {
    const len = parseInt(customCmd.trim(), 10) || 512;
    log('info', `Reading ${len} bytes from bulk IN...`);
    const result = await bulkRead(len);
    if (result?.data?.byteLength >= IMAGE_SIZE * 0.9) {
      log('info', 'Data looks like an image, rendering...');
      renderGrayscaleImage(new Uint8Array(result.data.buffer));
    }
  };

  // ---- Write custom hex + read full image ----
  const writeAndReadImage = async () => {
    if (!customCmd.trim()) {
      log('error', 'Enter hex bytes to write first (e.g. "67" or "e0")');
      return;
    }
    const bytes = customCmd.trim().split(/[\s,]+/).map(s => parseInt(s, 16)).filter(n => !isNaN(n));
    if (bytes.length === 0) {
      log('error', 'Invalid hex input');
      return;
    }
    setStatus(STATUS.SCANNING);
    const readSize = renderOpts.readSize || SENSOR_SIZE;
    log('info', `Write+Read: sending ${bytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}, then reading ${readSize} bytes`);

    const writeResult = await bulkWrite(new Uint8Array(bytes));
    if (!writeResult || writeResult.status !== 'ok') {
      log('error', 'Write failed');
      setStatus(STATUS.CONNECTED);
      return;
    }

    const result = await bulkReadChunked(readSize);
    if (result && result.bytesRead > 0) {
      const sample = result.buffer.slice(0, 1000);
      const uniqueValues = new Set(sample);
      const min = Math.min(...sample);
      const max = Math.max(...sample);
      log('data', `Received ${result.bytesRead} bytes, ${uniqueValues.size} unique values, range [${min}-${max}]`);

      // Always render if we got enough data
      if (result.bytesRead >= readSize * 0.5) {
        log('info', 'Rendering as image...');
        renderGrayscaleImage(result.buffer.slice(0, result.bytesRead));
      } else {
        // Hex dump of what we got
        const hex = Array.from(result.buffer.slice(0, 64)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        log('data', `First 64 bytes: ${hex}`);
        log('info', `Only got ${result.bytesRead} bytes (need ~${readSize}). Rendering partial...`);
        renderGrayscaleImage(result.buffer.slice(0, result.bytesRead));
      }
    }

    setStatus(STATUS.CONNECTED);
  };

  // ---- Image Rendering with configurable options ----
  const renderWithOptions = useCallback((rawBytes, opts) => {
    const canvas = canvasRef.current;
    if (!canvas || !rawBytes || rawBytes.length === 0) return;

    const o = opts || renderOpts;

    // Step 0: Skip header bytes
    let data = rawBytes;
    if (o.headerSkip > 0 && o.headerSkip < data.length) {
      data = data.slice(o.headerSkip);
    }

    // Step 0b: Unpack 4-bit data if needed
    if (o.bitDepth === 4) {
      const unpacked = new Uint8Array(data.length * 2);
      for (let i = 0; i < data.length; i++) {
        unpacked[i * 2] = (data[i] >> 4) & 0x0f;
        unpacked[i * 2 + 1] = data[i] & 0x0f;
      }
      // Scale 0-15 → 0-255
      for (let i = 0; i < unpacked.length; i++) unpacked[i] = unpacked[i] * 17;
      data = unpacked;
    }

    const W = o.transpose ? (IMAGE_SIZE / o.width) | 0 : o.width;
    const H = o.transpose ? o.width : Math.ceil(data.length / o.width);
    const totalPx = W * H;

    // Step 1: De-interleave
    let pixels = new Uint8Array(Math.min(data.length, totalPx));
    const srcLen = Math.min(data.length, totalPx);

    if (o.deinterleave === 'even-odd') {
      // Sensor reads even rows first, then odd rows
      const rowLen = W;
      const totalRows = Math.ceil(srcLen / rowLen);
      const halfRows = Math.ceil(totalRows / 2);
      for (let srcRow = 0; srcRow < totalRows; srcRow++) {
        let destRow;
        if (srcRow < halfRows) {
          destRow = srcRow * 2; // even rows
        } else {
          destRow = (srcRow - halfRows) * 2 + 1; // odd rows
        }
        const srcOff = srcRow * rowLen;
        const dstOff = destRow * rowLen;
        for (let x = 0; x < rowLen && srcOff + x < srcLen; x++) {
          if (dstOff + x < pixels.length) pixels[dstOff + x] = data[srcOff + x];
        }
      }
    } else if (o.deinterleave === 'odd-even') {
      const rowLen = W;
      const totalRows = Math.ceil(srcLen / rowLen);
      const halfRows = Math.ceil(totalRows / 2);
      for (let srcRow = 0; srcRow < totalRows; srcRow++) {
        let destRow;
        if (srcRow < halfRows) {
          destRow = srcRow * 2 + 1; // odd rows
        } else {
          destRow = (srcRow - halfRows) * 2; // even rows
        }
        const srcOff = srcRow * rowLen;
        const dstOff = destRow * rowLen;
        for (let x = 0; x < rowLen && srcOff + x < srcLen; x++) {
          if (dstOff + x < pixels.length) pixels[dstOff + x] = data[srcOff + x];
        }
      }
    } else if (o.deinterleave === 'reverse-rows') {
      const rowLen = W;
      const totalRows = Math.ceil(srcLen / rowLen);
      for (let row = 0; row < totalRows; row++) {
        const srcOff = row * rowLen;
        const dstOff = (totalRows - 1 - row) * rowLen;
        for (let x = 0; x < rowLen && srcOff + x < srcLen; x++) {
          if (dstOff + x < pixels.length) pixels[dstOff + x] = data[srcOff + x];
        }
      }
    } else if (o.deinterleave === 'serpentine') {
      // Every other row is reversed (common in scanning sensors)
      const rowLen = W;
      const totalRows = Math.ceil(srcLen / rowLen);
      for (let row = 0; row < totalRows; row++) {
        for (let x = 0; x < rowLen; x++) {
          const srcIdx = row * rowLen + x;
          const dstX = (row % 2 === 1) ? (rowLen - 1 - x) : x;
          const dstIdx = row * rowLen + dstX;
          if (srcIdx < srcLen && dstIdx < pixels.length) pixels[dstIdx] = data[srcIdx];
        }
      }
    } else {
      // 'none' — straight copy
      for (let i = 0; i < srcLen; i++) pixels[i] = data[i];
    }

    // Step 1b: Column-major transpose
    if (o.transpose) {
      const transposed = new Uint8Array(pixels.length);
      const origW = o.width;
      const origH = (pixels.length / origW) | 0;
      for (let y = 0; y < origH; y++) {
        for (let x = 0; x < origW; x++) {
          const srcIdx = y * origW + x;
          const dstIdx = x * origH + y;
          if (srcIdx < pixels.length && dstIdx < transposed.length) {
            transposed[dstIdx] = pixels[srcIdx];
          }
        }
      }
      pixels = transposed;
    }

    // Step 2: Invert
    if (o.invert) {
      for (let i = 0; i < pixels.length; i++) pixels[i] = 255 - pixels[i];
    }

    // Step 3: Contrast enhancement
    let min = 255, max = 0;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }

    if (o.contrast === 'auto') {
      const range = max - min;
      if (range > 0 && range < 255) {
        const scale = 255 / range;
        for (let i = 0; i < pixels.length; i++) {
          pixels[i] = Math.round((pixels[i] - min) * scale);
        }
        log('info', `Auto-contrast: [${min}-${max}] → [0-255] (scale ${scale.toFixed(1)}x)`);
      }
    } else if (o.contrast === 'histeq') {
      // Histogram equalization
      const hist = new Uint32Array(256);
      for (let i = 0; i < pixels.length; i++) hist[pixels[i]]++;
      const cdf = new Uint32Array(256);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
      const cdfMin = cdf.find(v => v > 0) || 0;
      const denom = pixels.length - cdfMin;
      if (denom > 0) {
        const lut = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
          lut[i] = Math.round(((cdf[i] - cdfMin) / denom) * 255);
        }
        for (let i = 0; i < pixels.length; i++) pixels[i] = lut[pixels[i]];
        log('info', `Histogram equalization applied (${min}-${max} → equalized)`);
      }
    }

    // Step 4: Binary threshold
    if (o.threshold > 0) {
      for (let i = 0; i < pixels.length; i++) {
        pixels[i] = pixels[i] >= o.threshold ? 255 : 0;
      }
    }

    // Step 5: Render to canvas
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);

    for (let i = 0; i < W * H; i++) {
      const v = i < pixels.length ? pixels[i] : 0;
      imgData.data[i * 4] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
      imgData.data[i * 4 + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);
    setImageData(canvas.toDataURL());
    log('success', `Rendered: ${W}x${H}, range [${min}-${max}], opts: w=${o.width} inv=${o.invert} deint=${o.deinterleave} contrast=${o.contrast} thresh=${o.threshold} transpose=${o.transpose} skip=${o.headerSkip} bits=${o.bitDepth}`);
  }, [log, renderOpts]);

  // Legacy wrapper — stores raw capture and renders with current options
  const renderGrayscaleImage = useCallback((rawBytes) => {
    setLastCapture(new Uint8Array(rawBytes));
    renderWithOptions(rawBytes, renderOpts);
  }, [renderWithOptions, renderOpts]);

  // Re-render when options change (if we have captured data)
  useEffect(() => {
    if (lastCapture) {
      renderWithOptions(lastCapture, renderOpts);
    }
  }, [renderOpts]); // intentionally only depend on renderOpts to avoid infinite loop

  // ---- Render test pattern ----
  const renderTestPattern = () => {
    const data = new Uint8Array(SENSOR_SIZE);
    for (let y = 0; y < SENSOR_HEIGHT; y++) {
      for (let x = 0; x < SENSOR_WIDTH; x++) {
        const i = y * SENSOR_WIDTH + x;
        // Fingerprint-like concentric pattern with grid lines for alignment testing
        const cx = SENSOR_WIDTH / 2, cy = SENSOR_HEIGHT / 2;
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const v = Math.sin(dist * 0.15 + angle * 3) * 60 + 128;
        // Add grid lines every 64 pixels to check alignment
        const gridLine = (x % 64 === 0 || y % 64 === 0) ? 40 : 0;
        data[i] = Math.max(0, Math.min(255, v - gridLine));
      }
    }
    renderGrayscaleImage(data);
    log('info', `Test pattern rendered (${SENSOR_WIDTH}x${SENSOR_HEIGHT}, ${SENSOR_SIZE} bytes). Change Width to see misalignment.`);
  };

  // ---- Auto-scan widths to find correct pixel arrangement ----
  const autoScanWidths = useCallback(async () => {
    if (!lastCapture) {
      log('warn', 'No captured data. Capture an image first, then auto-scan widths.');
      return;
    }
    const widths = [160, 192, 240, 256, 288, 300, 310, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 330, 340, 352, 360, 384, 400, 416, 448, 480, 512, 640];
    log('info', `Auto-scanning ${widths.length} widths to find correct pixel arrangement...`);
    log('info', 'WATCH the preview — look for anything that resembles a fingerprint pattern.');

    for (const w of widths) {
      setRenderOpts(o => ({ ...o, width: w }));
      // Small delay so each width is visible
      await new Promise(r => setTimeout(r, 400));
    }
    log('info', 'Auto-scan complete. Set the width that looked best manually.');
  }, [lastCapture, log]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.close().catch(() => {});
      }
    };
  }, []);

  // ---- Status indicator ----
  const statusColors = {
    [STATUS.IDLE]: 'bg-gray-500',
    [STATUS.CONNECTING]: 'bg-yellow-500 animate-pulse',
    [STATUS.CONNECTED]: 'bg-green-500',
    [STATUS.SCANNING]: 'bg-blue-500 animate-pulse',
    [STATUS.ERROR]: 'bg-red-500',
  };

  const statusLabels = {
    [STATUS.IDLE]: 'Disconnected',
    [STATUS.CONNECTING]: 'Connecting...',
    [STATUS.CONNECTED]: 'Connected',
    [STATUS.SCANNING]: 'Scanning...',
    [STATUS.ERROR]: 'Error',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full flex flex-col p-4 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-brand-mint hover:text-white text-sm font-mono px-3 py-1 rounded border border-brand-glass-border hover:border-brand-mint transition-colors"
          >
            &larr; Back
          </button>
          <h1 className="font-mono text-lg text-white font-bold">USB Debug Console</h1>
          <span className="text-xs font-mono text-gray-400">Futronic FS80H WebUSB</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
          <span className="font-mono text-xs text-gray-300">{statusLabels[status]}</span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* Left Panel: Controls + Device Info */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto min-h-0">
          {/* Connection */}
          <div className="bg-black/30 rounded-xl p-3 border border-brand-glass-border">
            <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-2">Connection</h3>
            <div className="flex gap-2">
              {status === STATUS.IDLE || status === STATUS.ERROR ? (
                <button
                  onClick={connectDevice}
                  className="flex-1 bg-green-600/80 hover:bg-green-500 text-white font-mono text-xs py-2 px-3 rounded-lg transition-colors"
                >
                  Connect USB
                </button>
              )               : (
                <button
                  onClick={disconnectDevice}
                  className="flex-1 bg-red-600/80 hover:bg-red-500 text-white font-mono text-xs py-2 px-3 rounded-lg transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
            {status === STATUS.CONNECTED && (
              <button
                onClick={resetEndpoints}
                className="w-full mt-2 bg-gray-600/80 hover:bg-gray-500 text-white font-mono text-xs py-1.5 px-3 rounded-lg transition-colors"
              >
                Reset Endpoints
              </button>
            )}
          </div>

          {/* Device Info */}
          {deviceInfo && (
            <div className="bg-black/30 rounded-xl p-3 border border-brand-glass-border">
              <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-2">Device</h3>
              <div className="space-y-1">
                {Object.entries(deviceInfo).map(([key, val]) => (
                  <div key={key} className="flex justify-between font-mono text-xs">
                    <span className="text-gray-500">{key}</span>
                    <span className="text-brand-mint">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commands */}
          <div className="bg-black/30 rounded-xl p-3 border border-brand-glass-border">
            <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-2">Commands</h3>
            <div className="flex flex-col gap-2">
              <button
                onClick={probeDevice}
                disabled={status !== STATUS.CONNECTED}
                className="bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs py-2 px-3 rounded-lg transition-colors"
              >
                Read Descriptor (0xe0)
              </button>
              <button
                onClick={() => captureImage(4)}
                disabled={status !== STATUS.CONNECTED}
                className="bg-brand-teal hover:bg-teal-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs py-2 px-3 rounded-lg transition-colors"
              >
                Capture (dose 4 / 0x67)
              </button>
              <button
                onClick={scanAllDoses}
                disabled={status !== STATUS.CONNECTED}
                className="bg-amber-600/80 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs py-2 px-3 rounded-lg transition-colors"
              >
                Scan All Doses
              </button>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(GET_IMAGE2_CMDS).map(([dose, cmd]) => (
                  <button
                    key={dose}
                    onClick={() => captureImage(Number(dose))}
                    disabled={status !== STATUS.CONNECTED}
                    className="bg-teal-700/60 hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-[10px] py-1 px-2 rounded transition-colors"
                    title={`GetImage2 dose=${dose}, cmd=0x${cmd.toString(16)}`}
                  >
                    D{dose}
                  </button>
                ))}
              </div>
              <button
                onClick={renderTestPattern}
                className="bg-purple-600/80 hover:bg-purple-500 text-white font-mono text-xs py-2 px-3 rounded-lg transition-colors"
              >
                Test Pattern
              </button>
            </div>
          </div>

          {/* Custom Command */}
          <div className="bg-black/30 rounded-xl p-3 border border-brand-glass-border">
            <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-2">Custom Hex</h3>
            <input
              type="text"
              value={customCmd}
              onChange={e => setCustomCmd(e.target.value)}
              placeholder="e0 (hex) or 64 (dec for read)"
              className="w-full bg-black/40 text-white font-mono text-xs px-3 py-2 rounded-lg border border-brand-glass-border focus:border-brand-gold outline-none mb-2"
            />
            <div className="flex gap-2 mb-2">
              <button
                onClick={sendCustomBulk}
                disabled={status !== STATUS.CONNECTED}
                className="flex-1 bg-orange-600/80 hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs py-1.5 rounded-lg transition-colors"
              >
                Write
              </button>
              <button
                onClick={readCustomBulk}
                disabled={status !== STATUS.CONNECTED}
                className="flex-1 bg-cyan-600/80 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs py-1.5 rounded-lg transition-colors"
              >
                Read
              </button>
            </div>
            <button
              onClick={writeAndReadImage}
              disabled={status !== STATUS.CONNECTED}
              className="w-full bg-emerald-600/80 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-xs py-1.5 rounded-lg transition-colors"
            >
              Write + Read Image ({(renderOpts.readSize / 1024).toFixed(0)}KB)
            </button>
          </div>

          {/* Render Options (for investigating pixel arrangement) */}
          <div className="bg-black/30 rounded-xl p-3 border border-brand-glass-border">
            <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-2">Render Options</h3>
            <div className="space-y-2">
              {/* Width */}
              <div>
                <label className="font-mono text-[10px] text-gray-500">Width: {renderOpts.width}px</label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {[240, 256, 288, 320, 352, 384, 400, 480, 512, 640].map(w => (
                    <button
                      key={w}
                      onClick={() => setRenderOpts(o => ({ ...o, width: w }))}
                      className={`font-mono text-[10px] py-0.5 px-1.5 rounded transition-colors ${
                        renderOpts.width === w
                          ? 'bg-brand-teal text-white'
                          : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contrast mode */}
              <div>
                <label className="font-mono text-[10px] text-gray-500">Contrast</label>
                <div className="flex gap-1 mt-1">
                  {[['none', 'None'], ['auto', 'Auto'], ['histeq', 'HistEQ']].map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setRenderOpts(o => ({ ...o, contrast: v }))}
                      className={`font-mono text-[10px] py-0.5 px-2 rounded transition-colors ${
                        renderOpts.contrast === v
                          ? 'bg-brand-teal text-white'
                          : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* De-interleave */}
              <div>
                <label className="font-mono text-[10px] text-gray-500">De-interleave</label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {[['none', 'None'], ['even-odd', 'E/O'], ['odd-even', 'O/E'], ['reverse-rows', 'RevRows'], ['serpentine', 'Serp']].map(([v, label]) => (
                    <button
                      key={v}
                      onClick={() => setRenderOpts(o => ({ ...o, deinterleave: v }))}
                      className={`font-mono text-[10px] py-0.5 px-1.5 rounded transition-colors ${
                        renderOpts.deinterleave === v
                          ? 'bg-brand-teal text-white'
                          : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggle row: Invert + Transpose + 4-bit */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setRenderOpts(o => ({ ...o, invert: !o.invert }))}
                  className={`font-mono text-[10px] py-0.5 px-2 rounded transition-colors ${
                    renderOpts.invert
                      ? 'bg-brand-gold text-black'
                      : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  Invert
                </button>
                <button
                  onClick={() => setRenderOpts(o => ({ ...o, transpose: !o.transpose }))}
                  className={`font-mono text-[10px] py-0.5 px-2 rounded transition-colors ${
                    renderOpts.transpose
                      ? 'bg-brand-gold text-black'
                      : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  Transpose
                </button>
                <button
                  onClick={() => setRenderOpts(o => ({ ...o, bitDepth: o.bitDepth === 8 ? 4 : 8 }))}
                  className={`font-mono text-[10px] py-0.5 px-2 rounded transition-colors ${
                    renderOpts.bitDepth === 4
                      ? 'bg-brand-gold text-black'
                      : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  4-bit
                </button>
              </div>

              {/* Threshold slider */}
              <div>
                <label className="font-mono text-[10px] text-gray-500">Threshold: {renderOpts.threshold === 0 ? 'Off' : renderOpts.threshold}</label>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={renderOpts.threshold}
                  onChange={e => setRenderOpts(o => ({ ...o, threshold: Number(e.target.value) }))}
                  className="w-full h-1.5 mt-1 accent-brand-teal"
                />
              </div>

              {/* Header skip */}
              <div>
                <label className="font-mono text-[10px] text-gray-500">Header skip: {renderOpts.headerSkip} bytes</label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {[0, 1, 2, 4, 8, 16, 32, 64, 128, 512].map(n => (
                    <button
                      key={n}
                      onClick={() => setRenderOpts(o => ({ ...o, headerSkip: n }))}
                      className={`font-mono text-[10px] py-0.5 px-1.5 rounded transition-colors ${
                        renderOpts.headerSkip === n
                          ? 'bg-brand-teal text-white'
                          : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read size (how many bytes to request from device) */}
              <div>
                <label className="font-mono text-[10px] text-gray-500">Read size: {renderOpts.readSize.toLocaleString()} bytes</label>
                <div className="flex gap-1 flex-wrap mt-1">
                  {[
                    [SDK_SIZE, `${SDK_SIZE / 1024}K (320×480)`],
                    [SENSOR_SIZE, `${SENSOR_SIZE / 1024}K (384×480)`],
                    [384 * 500, `${(384 * 500 / 1024).toFixed(0)}K (384×500)`],
                    [512 * 480, `${(512 * 480 / 1024).toFixed(0)}K (512×480)`],
                  ].map(([size, label]) => (
                    <button
                      key={size}
                      onClick={() => setRenderOpts(o => ({ ...o, readSize: size }))}
                      className={`font-mono text-[10px] py-0.5 px-1.5 rounded transition-colors ${
                        renderOpts.readSize === size
                          ? 'bg-brand-teal text-white'
                          : 'bg-gray-700/60 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset + Auto-scan */}
              <div className="flex gap-1">
                <button
                  onClick={() => setRenderOpts({ ...DEFAULT_RENDER_OPTS })}
                  className="flex-1 bg-gray-600/80 hover:bg-gray-500 text-white font-mono text-[10px] py-1 px-2 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={autoScanWidths}
                  disabled={!lastCapture}
                  className="flex-1 bg-amber-600/80 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-mono text-[10px] py-1 px-2 rounded-lg transition-colors"
                >
                  Auto-scan widths
                </button>
              </div>
            </div>
          </div>

          {/* Image Preview */}
          <div className="bg-black/30 rounded-xl p-3 border border-brand-glass-border flex-shrink-0 flex flex-col">
            <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-2">Image Preview</h3>
            <div className="relative flex items-center justify-center bg-black/40 rounded-lg overflow-hidden" style={{ minHeight: '320px' }}>
              <canvas
                ref={canvasRef}
                width={IMAGE_WIDTH}
                height={IMAGE_HEIGHT}
                className="max-w-full object-contain"
                style={{ imageRendering: 'pixelated', maxHeight: '400px' }}
              />
              {!imageData && (
                <span className="absolute font-mono text-xs text-gray-600">No image</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Log Console */}
        <div className="flex-1 bg-black/40 rounded-xl border border-brand-glass-border flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-brand-glass-border flex-shrink-0">
            <h3 className="font-mono text-xs text-gray-400 uppercase tracking-wider">Console Log</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={copyLogs}
                disabled={logs.length === 0}
                className="font-mono text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Copy All
              </button>
              <button
                onClick={clearLogs}
                className="font-mono text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-0"
            style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
          >
            {logs.length === 0 && (
              <div className="font-mono text-xs text-gray-600">
                Ready. Click "Connect USB" to start.
                <br />
                <br />
                Supported devices:
                <br />
                &nbsp; Futronic FS80H (VID 0x1491)
                <br />
                &nbsp; Futronic FS81H OEM (VID 0x1491)
                <br />
                <br />
                Requirements:
                <br />
                &nbsp; - Chrome/Edge browser (WebUSB)
                <br />
                &nbsp; - HTTPS or localhost
                <br />
                &nbsp; - No competing USB driver claimed
              </div>
            )}
            {logs.map((entry, i) => (
              <LogEntry key={i} entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
