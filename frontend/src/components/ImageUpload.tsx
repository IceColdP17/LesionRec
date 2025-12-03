import React, { useEffect, useState } from "react"
import type { AnalysisResponse } from "../types";

type CaptureMode = 'file' | 'camera' | 'preview';

interface ImageUploadProps {
    userId: string;
    onAnalysisComplete: (data: AnalysisResponse) => void;
}

export const ImageUpload = ({ userId, onAnalysisComplete }: ImageUploadProps) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string>('');
    const [captureMode, setCaptureMode] = useState<CaptureMode>('file'); // Controls the displayed UI (file picker/ live camera / preview)
    const [stream, setStream] = useState<MediaStream | null>(null);  // MediaStream object (needed to stop the camera)
    const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);  // Reference to <video> element
    const [capturedImage, setCapturedImage] = useState<File|  null>(null);   // Captured File object (shown in preview)
    const [cameraError, setCameraError] = useState<string | null>(null);    // UX: User-friendly error messages
    const [isLoadingCamera, setIsLoadingCamera] = useState(false);         // UX: Show loading spinner while requesting camera access
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);       // URL for previewing captured image
    const [isVideoReady, setIsVideoReady] = useState(false);                // Track if video metadata is loaded

    // 1. Manage Stream Lifecycle (Stop tracks when stream changes or unmounts)
    useEffect(() => {
        return () => {
            if (stream) {
                console.log('Cleaning up stream tracks');
                stream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [stream]);

    // 2. Handle Video Element Attachment & Dimension Checking
    useEffect(() => {
        let checkInterval: number | null = null;

        if (stream && videoRef) {
            console.log('=== Setting up video element with stream ===');
            console.log('Stream tracks:', stream.getTracks().map(t => `${t.kind}: ${t.label} (enabled: ${t.enabled}, readyState: ${t.readyState})`));

            videoRef.srcObject = stream;

            // Get actual camera dimensions from the MediaStream track
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            const capabilities = videoTrack.getCapabilities();
            console.log('Camera track settings:', settings);
            console.log('Camera track capabilities:', capabilities);

            let attempts = 0;
            
            // Poll for valid video dimensions
            const checkVideoDimensions = () => {
                attempts++;
                if (!videoRef) return;
                
                const width = videoRef.videoWidth;
                const height = videoRef.videoHeight;
                const readyState = videoRef.readyState;
                const rect = videoRef.getBoundingClientRect();

                console.log(`Attempt ${attempts}:`);
                console.log(`  - videoWidth/Height: ${width}x${height}`);
                console.log(`  - readyState: ${readyState}`);
                console.log(`  - paused: ${videoRef.paused}`);
                console.log(`  - ended: ${videoRef.ended}`);
                console.log(`  - rendered size: ${rect.width}x${rect.height}`);
                console.log(`  - srcObject: ${videoRef.srcObject ? 'present' : 'null'}`);

                // For capture purposes, we just need the stream to be active
                if (readyState >= 2 || attempts >= 10) { 
                    console.log(`✓ Video ready for capture (readyState: ${readyState})`);
                    setIsVideoReady(true);

                    if (checkInterval !== null) {
                        clearInterval(checkInterval);
                        checkInterval = null;
                    }
                }
            };

            // Start playing the video
            console.log('Calling video.play()...');
            videoRef.play()
                .then(() => {
                    console.log('✓ Video play() resolved successfully');
                    console.log(`Video state after play: paused=${videoRef.paused}, ended=${videoRef.ended}, readyState=${videoRef.readyState}`);
                })
                .catch((error) => {
                    console.error("❌ Error playing video:", error);
                    setCameraError('Failed to start video playback.');
                });

            // Check dimensions after a short delay
            setTimeout(checkVideoDimensions, 300);

            // Also check every 200ms until we're ready
            checkInterval = window.setInterval(checkVideoDimensions, 200);
        } else {
            // Reset video ready state when stream is stopped
            setIsVideoReady(false);
        }

        // Cleanup interval on unmount or dependency change
        return () => {
            if (checkInterval !== null) {
                clearInterval(checkInterval);
            }
        };
    }, [stream, videoRef]);

    // Cleanup blob URL when preview unmounts or changes
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);
    
    const startCamera = async () => {
        try {
            setIsLoadingCamera(true);
            setCameraError(null);

            // 1: Request camera access with explicit constraints
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user', // Use front camera if available
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 }
                },
            })

            // Log what we actually got
            const track = mediaStream.getVideoTracks()[0];
            const actualSettings = track.getSettings();
            console.log('Stream acquired with settings:', actualSettings);

            // CRITICAL: Store width/height NOW while they're available
            // Some browsers lose this info after the stream is created
            if (actualSettings.width && actualSettings.height) {
                console.log(`✓ Camera dimensions captured: ${actualSettings.width}x${actualSettings.height}`);
                // Store in the stream object as a custom property for later access
                (mediaStream as any)._capturedWidth = actualSettings.width;
                (mediaStream as any)._capturedHeight = actualSettings.height;
            }

            // 2: Store steam and switch to camera mode
            setStream(mediaStream);
            setCaptureMode('camera');

        } catch (error: any) {
            if (error.name === 'NotAllowedError') {
                setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
                } else if (error.name === 'NotFoundError') {
                setCameraError('No camera found on this device.');
                } else if (error.name === 'NotReadableError') {
                setCameraError('Camera is already in use by another application.');
                } else {
                setCameraError('Could not access camera. Please try again.');
                }
            console.error('Error accessing camera:', error);
        } finally {
            setIsLoadingCamera(false);}
        };


    const capturePhoto = () => {
        if(!videoRef || !stream) {
            console.error('Video ref or stream is unavailable');
            return;
        }

        // Get dimensions from video element or fall back to stream track settings
        let captureWidth = videoRef.videoWidth;
        let captureHeight = videoRef.videoHeight;

        console.log(`Initial capture dimensions: ${captureWidth}x${captureHeight}`);

        // If video element dimensions are invalid, try multiple fallback strategies
        if (captureWidth <= 2 || captureHeight <= 2) {
            // Strategy 1: Use captured dimensions from when stream was created
            const storedWidth = (stream as any)._capturedWidth;
            const storedHeight = (stream as any)._capturedHeight;

            if (storedWidth && storedHeight) {
                captureWidth = storedWidth;
                captureHeight = storedHeight;
                console.log(`Using stored camera dimensions: ${captureWidth}x${captureHeight}`);
            } else {
                // Strategy 2: Try track settings (may not work on all browsers)
                const videoTrack = stream.getVideoTracks()[0];
                const settings = videoTrack.getSettings();

                if (settings.width && settings.height) {
                    captureWidth = settings.width;
                    captureHeight = settings.height;
                    console.log(`Using track settings dimensions: ${captureWidth}x${captureHeight}`);
                } else {
                    // Strategy 3: Use the rendered size from DOM
                    const rect = videoRef.getBoundingClientRect();
                    if (rect.width > 100 && rect.height > 100) {
                        // Scale up to a reasonable resolution (3x the display size)
                        captureWidth = Math.round(rect.width * 3);
                        captureHeight = Math.round(rect.height * 3);
                        console.log(`Using rendered size (3x scale): ${captureWidth}x${captureHeight} (from ${rect.width}x${rect.height})`);
                    } else {
                        // Strategy 4: Use default dimensions as last resort
                        captureWidth = 1280;
                        captureHeight = 720;
                        console.warn(`Using default fallback dimensions: ${captureWidth}x${captureHeight}`);
                    }
                }
            }
        }

        // 1: Create a canvas to draw the current video frame
        const canvas = document.createElement('canvas');
        canvas.width = captureWidth;
        canvas.height = captureHeight;

        console.log(`Capturing photo at ${canvas.width}x${canvas.height}`);

        // 2: Draw the video frame onto the canvas
        const context = canvas.getContext('2d');
        if (!context) {
            console.error('Could not get canvas context');
            return;
        }

        // IMPORTANT: Video is mirrored (scaleX(-1)), but we want to capture UN-mirrored
        // So we need to flip the canvas horizontally to get the correct orientation
        context.save();
        context.scale(-1, 1);  // Flip horizontally
        context.drawImage(videoRef, -canvas.width, 0, canvas.width, canvas.height);
        context.restore();

        console.log('Canvas drawn (un-mirrored), converting to blob...');

        // 3: Convert the canvas to a Blob
        canvas.toBlob((blob) => {
            if (!blob) {
                console.error('Could not convert canvas to Blob');
                return;
            }

            console.log(`Blob created: ${blob.size} bytes, type: ${blob.type}`);

            // 4: Create a File object from the Blob
            const timestamp = Date.now();
            const file = new File(
                [blob],
                `skin-analysis-${timestamp}.jpg`,
                { type: 'image/jpeg' }
            );

            console.log(`File created: ${file.name}, size: ${file.size}`);

            // 5: Store the captured image
            setCapturedImage(file);
            const url = URL.createObjectURL(file);
            console.log(`Preview URL created: ${url}`);
            setPreviewUrl(url);

            // 6: Switch to preview mode
            setCaptureMode('preview');

            // 7: Stop the camera stream
            stopCamera();
        }, 'image/jpeg', 0.95); // High quality JPEG
    };
    
    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
    };

    const handleRetake = () => {
        setCapturedImage(null);
        startCamera();  // Restart camera for retake
    };

    // Handle file selection logic (shared by both upload methods)
    const handleFileSelection = (file: File) => {
        setSelectedFile(file);
    };

    const handleUploadCaptured = () => {
        if (!capturedImage) return;

        // Use the shared file selection logic
        handleFileSelection(capturedImage);

        // Reset to file upload mode
        setCapturedImage(null);
        setCaptureMode('file');
    };

    // Handle file selection from file input
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            handleFileSelection(event.target.files[0]);
        }
    }

    const handleUpload = async () => {
        if (!selectedFile) {
            alert("Please select a file first.");
            return;
        }

        setUploadStatus('Uploading...');

        // 1. Create FormData object to send file
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('user_id', userId);
        // Removed budget_max to default to None (Infinite)
        formData.append('bundle_mode', 'true');

        try {
            // 2. Send Post request to upload endpoint
            const response = await fetch('http://localhost:8000/upload', { 
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data: AnalysisResponse = await response.json();
                setUploadStatus('Upload was successful! ✅');
                // Pass the data up to the parent component
                onAnalysisComplete(data);
            } else {
                setUploadStatus('Upload failed. ❌');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus('Network error ⚠️');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-md space-y-4">
            {/* Error Message */}
            { cameraError && (
                <div className="w-full p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    <p className="text-sm">{cameraError}</p>
                    <button
                        onClick={() => setCameraError(null)}
                        className="mt-2 text-xs underline hover:no-underline">Dismiss
                    </button>
                </div>
            )}

            {/* Mode: Camera */}
            { captureMode === 'camera' && (
                <div className="flex flex-col items-center w-full">
                    <p className="text-sm text-gray-600 mb-2">Camera Mode Active - Stream should appear below</p>
                    <div className="relative w-full border-4 border-blue-500" style={{ minHeight: '300px', backgroundColor: '#1a1a1a' }}>
                        <video
                            ref={setVideoRef}
                            autoPlay
                            playsInline         // Critical for mobile devices to prevent fullscreen (esp iOS)
                            muted              // Mute to allow autoplay without user interaction
                            style={{
                                transform: 'scaleX(-1)',  // Mirror effect (selfie mode)
                                width: '100%',
                                height: 'auto',
                                minHeight: '300px',
                                display: 'block',
                                objectFit: 'contain'
                            }}
                            className="rounded-md"
                                onLoadedMetadata={(e) => {
                                    const video = e.currentTarget;
                                    console.log(`📹 Video metadata loaded: ${video.videoWidth}x${video.videoHeight}`);
                                    console.log(`   readyState: ${video.readyState}`);
                                }}
                                onLoadedData={(e) => {
                                    const video = e.currentTarget;
                                    console.log(`📹 Video loadeddata event: ${video.videoWidth}x${video.videoHeight}`);
                                    console.log(`   readyState: ${video.readyState}`);
                                }}
                                onCanPlay={(e) => {
                                    const video = e.currentTarget;
                                    console.log(`📹 Video canplay event: ${video.videoWidth}x${video.videoHeight}`);
                                    console.log(`   readyState: ${video.readyState}`);
                                }}
                                onPlay={() => {
                                    console.log(`📹 Video play event fired`);
                                }}
                                onError={(e) => {
                                    console.error('📹 Video error event:', e);
                                }}
                            />
                        </div>
                        <div className="mt-4 flex space-x-4">
                            <button
                                onClick={capturePhoto}
                                disabled={!isVideoReady}
                                className={`py-2 px-4 rounded-md text-white font-medium transition-colors ${
                                    !isVideoReady
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isVideoReady ? 'Capture Photo' : 'Loading camera...'}
                            </button>
                            <button
                                onClick={() => {
                                    stopCamera();
                                    setCaptureMode('file');
                                }}
                                className="py-2 px-4 rounded-md text-gray-700 font-medium bg-gray-200 hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Mode: Preview Captured Image */}
                { captureMode === 'preview' && capturedImage && (
                    <div className="flex flex-col items-center">
                        <img
                            src={previewUrl || ''}
                            alt="Captured photo"
                            className="w-full h-auto rounded-md border"
                        />
                        <div className="mt-4 flex space-x-4">
                            <button onClick={handleRetake}>Retake</button>
                            <button onClick={handleUploadCaptured}>Upload & Analyze</button>
                        </div>
                    </div>
                )}

            {/* Mode: Initial File Upload Options */}
            { captureMode === 'file' && (
                <div className="flex flex-col items-center space-y-4">
                    <button
                        onClick={startCamera}
                        className="w-full py-2 px-4 rounded-md text-white font-medium bg-blue-600 hover:bg-blue-700"
                        disabled={isLoadingCamera}
                    >
                        {isLoadingCamera ? 'Starting Camera...' : 'Use Camera to Capture Photo'}
                    </button>
                </div>
            )}

            {/* File Upload Section - Only show in 'file' mode */}
            {captureMode === 'file' && (
                <>
                    <h2 className="text-xl font-bold text-gray-800">Upload Image</h2>

                    <div className="flex items-center justify-center w-full">
                {/* File Input */}
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span></p>
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />

                </label>
            </div>

            {selectedFile && (
                <p className="text-sm text-gray-600">Selected file: {selectedFile.name}</p>
            )}
            <button
                onClick={handleUpload}
                disabled={!selectedFile}
                className={`w-full py-2 px-4 rounded-md text-white font-medium transition-colors ${
                    !selectedFile
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
                Upload for Analysis
            </button>

            {uploadStatus && (
                <div className={`p-3 rounded-md text-sm ${
                    uploadStatus.includes('✅') ? 'bg-green-100 text-green-700' :
                    uploadStatus.includes('❌') ? 'bg-red-100 text-red-700' :
                    'bg-blue-100 text-blue-700'
                }`}>
                    {uploadStatus}
                </div>
            )}
                </>
            )}
        </div>
    );
}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      