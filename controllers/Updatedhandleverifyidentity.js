// UPDATED handleVerifyIdentity function for Rooms.jsx
// Replace your existing handleVerifyIdentity with this:

const handleVerifyIdentity = async () => {
  if (!guestName || !guestEmail || !idFile) {
    alert('Please enter your name, email, and upload your ID first');
    return;
  }

  try {
    // STEP 1: Upload ID to Cloudinary first
    setVerificationStep('uploading');
    console.log('Uploading ID to Cloudinary...');
    
    const uploadedUrl = await uploadIdFile(idFile);
    setIdFileUrl(uploadedUrl);
    console.log('ID uploaded to Cloudinary:', uploadedUrl);

    // STEP 2: Start Shufti Pro verification with uploaded ID URL
    setVerificationStep('verifying');
    console.log('Starting Shufti Pro verification with uploaded ID...');

    const response = await fetch(`${backendUrl}/api/shufti/verify-before-booking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: guestName,
        email: guestEmail,
        id_file_url: uploadedUrl,
        id_type: idType === 'nin' ? 'id_card' : idType === 'passport' ? 'passport' : 'driving_license'
      })
    });

    const data = await response.json();

    if (data.success) {
      setVerificationReference(data.reference);
      setVerificationUrl(data.verification_url);

      // LISTEN for message from popup when verification completes
      const messageHandler = (event) => {
        // Security check - make sure message is from our domain
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'VERIFICATION_COMPLETE') {
          console.log('Verification completed! Reference:', event.data.reference);
          
          // Stop polling
          if (verificationPollingInterval.current) {
            clearInterval(verificationPollingInterval.current);
            verificationPollingInterval.current = null;
          }
          
          // Update UI to verified state
          setIsVerified(true);
          setVerificationStep('verified');
          
          // Remove listener
          window.removeEventListener('message', messageHandler);
          
          alert('✅ Identity verified! You can now proceed to payment.');
        }
      };
      
      window.addEventListener('message', messageHandler);

      // Open Shufti Pro in popup - will redirect back when done
      const popup = window.open(
        data.verification_url,
        'shufti_verification',
        'width=800,height=600,scrollbars=yes'
      );

      // Also keep polling as backup (in case popup is blocked or user closes it)
      pollVerificationStatus(data.reference);
      
      // Check if popup was blocked
      if (!popup || popup.closed) {
        console.log('Popup blocked - relying on polling only');
      }
    } else {
      alert('Failed to initiate verification: ' + data.message);
      setVerificationStep('form');
    }
  } catch (error) {
    console.error('Verification error:', error);
    alert('Failed to start verification: ' + error.message);
    setVerificationStep('form');
  }
};