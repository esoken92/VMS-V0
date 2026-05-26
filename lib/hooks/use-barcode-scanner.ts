import { useState, useEffect, useRef, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'

interface UseBarcodeScannerOptions {
  onScanSuccess?: (decodedText: string, decodedResult: any) => void
  onScanFailure?: (error: any) => void
  fps?: number
  qrbox?: { width: number; height: number }
  aspectRatio?: number
}

interface UseBarcodeScannerReturn {
  startScanning: (elementId: string) => Promise<void>
  stopScanning: () => Promise<void>
  isScanning: boolean
  error: string | null
  lastScannedCode: string | null
}

export const useBarcodeScanner = (options: UseBarcodeScannerOptions = {}): UseBarcodeScannerReturn => {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null)
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null)
  const lastScanTimeRef = useRef<number>(0)
  const SCAN_DEBOUNCE_MS = 1000 // Prevent duplicate scans within 1 second

  const {
    onScanSuccess,
    onScanFailure,
    fps = 10,
    qrbox = { width: 250, height: 250 },
    aspectRatio = 1.0
  } = options

  const handleScanSuccess = useCallback((decodedText: string, decodedResult: any) => {
    const now = Date.now()
    
    // Debounce scans to prevent duplicate processing
    if (now - lastScanTimeRef.current < SCAN_DEBOUNCE_MS) {
      return
    }
    
    lastScanTimeRef.current = now
    setLastScannedCode(decodedText)
    
    if (onScanSuccess) {
      onScanSuccess(decodedText, decodedResult)
    }
  }, [onScanSuccess])

  const handleScanFailure = useCallback((error: any) => {
    // Ignore common scan failures (no QR code in frame, etc.)
    if (error?.includes('No barcode or QR code detected')) {
      return
    }
    
    if (onScanFailure) {
      onScanFailure(error)
    }
  }, [onScanFailure])

  const startScanning = useCallback(async (elementId: string) => {
    try {
      setError(null)
      
      // Create new Html5Qrcode instance
      html5QrCodeRef.current = new Html5Qrcode(elementId)
      
      // Start scanning
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps,
          qrbox,
          aspectRatio
        },
        handleScanSuccess,
        handleScanFailure
      )
      
      setIsScanning(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start scanner'
      setError(errorMessage)
      console.error('Barcode scanner error:', err)
    }
  }, [fps, qrbox, aspectRatio, handleScanSuccess, handleScanFailure])

  const stopScanning = useCallback(async () => {
    try {
      if (html5QrCodeRef.current && isScanning) {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
        html5QrCodeRef.current = null
        setIsScanning(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop scanner'
      setError(errorMessage)
      console.error('Error stopping scanner:', err)
    }
  }, [isScanning])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(console.error)
        html5QrCodeRef.current.clear()
      }
    }
  }, [])

  return {
    startScanning,
    stopScanning,
    isScanning,
    error,
    lastScannedCode
  }
}

// Hook for scanning a single barcode (useful for product lookup)
export const useSingleBarcodeScan = (options: UseBarcodeScannerOptions = {}) => {
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const scanner = useBarcodeScanner({
    onScanSuccess: (decodedText) => {
      setScannedCode(decodedText)
      setIsScanning(false)
      scanner.stopScanning()
    },
    ...options
  })

  const scan = async (elementId: string) => {
    setScannedCode(null)
    setIsScanning(true)
    await scanner.startScanning(elementId)
  }

  const reset = () => {
    setScannedCode(null)
    setIsScanning(false)
  }

  return {
    scan,
    reset,
    scannedCode,
    isScanning,
    error: scanner.error
  }
}
