// ADD THIS TO THE TOP OF YOUR Rooms.jsx COMPONENT
// Right after all the useState declarations

import { useSearchParams } from 'react-router-dom';

const Rooms = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // ... all your existing state declarations ...

  // ADD THIS useEffect to detect verification complete from URL
  useEffect(() => {
    const reference = searchParams.get('reference');
    
    if (reference && !isVerified) {
      console.log('Verification completed! Reference from URL:', reference);
      
      // User was redirected back from Shufti Pro
      setVerificationReference(reference);
      setIsVerified(true);
      setVerificationStep('verified');
      setShowBookingModal(true); // Reopen the modal
      
      // Remove the reference from URL
      searchParams.delete('reference');
      setSearchParams(searchParams);
      
      alert('✅ Identity verified! You can now proceed to payment.');
    }
  }, [searchParams, isVerified, setSearchParams]);

  // ... rest of your component code ...
}


// ALTERNATIVE APPROACH - SIMPLER
// If you don't want to use useSearchParams, you can check window.location:

useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const reference = urlParams.get('reference');
  
  if (reference && !isVerified) {
    console.log('Verification completed! Reference:', reference);
    
    setVerificationReference(reference);
    setIsVerified(true);
    setVerificationStep('verified');
    setShowBookingModal(true);
    
    // Clean up URL
    window.history.replaceState({}, '', '/bookings');
    
    alert(' Identity verified! You can now proceed to payment.');
  }
}, [isVerified]);