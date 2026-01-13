// Backend/controllers/shuftiProController.js
import {
  createVerificationRequest,
  checkVerificationStatus,
  verifyWebhookSignature,
  processCallback
} from '../services/shuftiProClient.js';
import { supabaseAdmin } from '../services/supabase.js';

export const initiatePreBookingVerification = async (req, res) => {
  try {
    const { name, email, id_file_url, id_type } = req.body;

    console.log('=== PRE-BOOKING VERIFICATION REQUEST ===');
    console.log('Name:', name);
    console.log('Email:', email);
    console.log('ID File URL:', id_file_url);
    console.log('ID Type:', id_type);

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }

    if (!id_file_url) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID document URL is required' 
      });
    }

    if (!process.env.SHUFTI_PRO_CLIENT_ID || !process.env.SHUFTI_PRO_SECRET_KEY) {
      console.error('Shufti Pro credentials not configured in .env');
      return res.status(500).json({
        success: false,
        message: 'Identity verification service not configured. Please contact support.'
      });
    }

    const reference = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Creating verification with reference:', reference);

    const verification = await createVerificationRequest({
      name,
      email,
      id_file_url,
      id_type,
      bookingReference: reference
    });

    console.log('Verification result:', {
      success: verification.success,
      reference: verification.reference,
      hasUrl: !!verification.verification_url,
      error: verification.error
    });

    if (!verification.success) {
      console.error('Shufti Pro verification failed:', verification.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create verification',
        error: verification.error
      });
    }

    try {
      const { error: dbError } = await supabaseAdmin
        .from('verification_sessions')
        .insert({
          reference: verification.reference || reference,
          email,
          name,
          id_file_url,
          id_type,
          verification_url: verification.verification_url,
          verification_status: 'pending',
          verification_event: 'request.pending',
          created_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('Database error:', dbError);
      } else {
        console.log('SUCCESS: Verification session stored in database');
      }
    } catch (dbError) {
      console.error('Database exception:', dbError);
    }

    return res.status(200).json({
      success: true,
      verification_url: verification.verification_url,
      reference: verification.reference || reference,
      message: 'Verification created successfully'
    });

  } catch (error) {
    console.error('ERROR in initiatePreBookingVerification:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

export const checkVerificationForBooking = async (req, res) => {
  try {
    const { reference, email } = req.query;

    console.log('=== CHECKING VERIFICATION FOR BOOKING ===');
    console.log('Reference:', reference);
    console.log('Email:', email);

    if (!reference || !email) {
      return res.status(400).json({
        success: false,
        message: 'Reference and email are required'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('verification_sessions')
      .select('*')
      .eq('reference', reference)
      .eq('email', email)
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(200).json({
        success: true,
        verified: false,
        status: 'pending',
        message: 'Verification in progress. Please wait...'
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Verification session not found'
      });
    }

    const canProceed = data.verification_status === 'verified';

    console.log('Verification status:', {
      status: data.verification_status,
      canProceed
    });

    return res.status(200).json({
      success: true,
      verified: canProceed,
      status: data.verification_status,
      reference: data.reference,
      message: canProceed 
        ? 'Verification successful. You can proceed to payment.'
        : data.verification_status === 'declined'
        ? 'Verification failed. Please try again with a valid ID.'
        : 'Verification pending. Please complete the verification process.',
      declined_reason: data.verification_declined_reason
    });

  } catch (error) {
    console.error('Error checking verification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check verification status',
      error: error.message
    });
  }
};

export const initiateVerification = async (req, res) => {
  try {
    const { name, email, firstName, lastName, dob, bookingReference } = req.body;

    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name and email are required' 
      });
    }

    const verification = await createVerificationRequest({
      name,
      email,
      firstName,
      lastName,
      dob,
      bookingReference
    });

    if (!verification.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create verification request',
        error: verification.error
      });
    }

    if (bookingReference) {
      try {
        await supabaseAdmin
          .from('bookings')
          .update({ 
            verification_reference: verification.reference,
            verification_status: 'pending',
            verification_url: verification.verification_url
          })
          .eq('transaction_ref', bookingReference);
        
        console.log('Verification reference stored for booking:', bookingReference);
      } catch (dbError) {
        console.error('Failed to update booking:', dbError);
      }
    }

    return res.status(200).json({
      success: true,
      verification_url: verification.verification_url,
      reference: verification.reference,
      message: 'Verification initiated successfully'
    });

  } catch (error) {
    console.error('Error initiating verification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate verification',
      error: error.message
    });
  }
};

export const handleCallback = async (req, res) => {
  try {
    console.log('=== SHUFTI PRO CALLBACK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const callbackData = req.body;
    const { reference, event } = callbackData;

    console.log('Reference:', reference);
    console.log('Event:', event);

    const signature = req.headers['signature'] || req.headers['x-signature'] || req.headers['sp_signature'];

    if (signature && !verifyWebhookSignature(callbackData, signature)) {
      console.warn('WARNING: Webhook signature verification failed');
      console.warn('This may indicate an invalid webhook or misconfigured secret key');
    }

    const result = processCallback(callbackData);
    const { verified, data, reason } = result;

    const isVerified = event === 'verification.accepted';
    const isDeclined = event === 'verification.declined';
    const isCancelled = event === 'verification.cancelled';

    try {
      const { data: session, error: sessionFetchError } = await supabaseAdmin
        .from('verification_sessions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (sessionFetchError) {
        console.log('Session lookup error:', sessionFetchError.message);
      }

      if (session) {
        const { error: updateError } = await supabaseAdmin
          .from('verification_sessions')
          .update({
            verification_status: isVerified ? 'verified' : isDeclined ? 'declined' : isCancelled ? 'cancelled' : 'pending',
            verification_event: event,
            verification_data: callbackData,
            verification_declined_reason: reason,
            verified_at: isVerified ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('reference', reference);

        if (updateError) {
          console.error('Database update error:', updateError);
        } else {
          console.log('SUCCESS: Verification session updated:', reference, 'Status:', isVerified ? 'verified' : isDeclined ? 'declined' : isCancelled ? 'cancelled' : 'pending');
        }
      } else {
        console.log('No verification session found for reference:', reference);
      }
    } catch (sessionError) {
      console.error('Session update exception:', sessionError);
    }

    try {
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('verification_reference', reference)
        .single();

      if (booking) {
        await supabaseAdmin
          .from('bookings')
          .update({
            verification_status: verified ? 'verified' : result.declined ? 'declined' : result.cancelled ? 'cancelled' : 'pending',
            verification_event: event,
            verification_result: result,
            verification_data: data,
            verification_declined_reason: reason,
            verification_completed_at: verified ? new Date().toISOString() : null
          })
          .eq('id', booking.id);

        console.log('SUCCESS: Booking verification status updated');
      }
    } catch (bookingError) {
      console.log('No booking found for this verification');
    }

    return res.status(200).json({ 
      success: true,       message: 'Callback processed successfully' 
    });

  } catch (error) {
    console.error('ERROR: Processing Shufti Pro callback:', error);
    return res.status(200).json({ 
      success: false, 
      message: 'Callback received with errors',
      error: error.message 
    });
  }
};

export const checkStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Verification reference is required'
      });
    }

    const status = await checkVerificationStatus(reference);

    if (!status.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to check verification status',
        error: status.error
      });
    }

    return res.status(200).json({
      success: true,
      reference,
      event: status.event,
      verified: status.event === 'verification.accepted',
      pending: status.event === 'request.pending',
      data: status.verification_data,
      declined_reason: status.declined_reason
    });

  } catch (error) {
    console.error('Error checking verification status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check verification status',
      error: error.message
    });
  }
};