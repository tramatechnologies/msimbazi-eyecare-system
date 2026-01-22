/**
 * NHIF API Integration Module
 * Handles NHIF token management and card verification
 * NOTE: In production, NHIF credentials should be stored in secure vault (not in code)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get NHIF configuration from database
 */
const getNHIFConfig = async () => {
  try {
    const { data: config, error } = await supabase
      .from('nhif_facility_config')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !config) {
      // Fallback to environment variables
      return {
        apiUrl: process.env.NHIF_API_URL || 'https://api.nhif.go.tz',
        username: process.env.NHIF_USERNAME || '',
        password: process.env.NHIF_PASSWORD || '',
        facilityCode: process.env.NHIF_FACILITY_CODE || '',
      };
    }

    return {
      apiUrl: config.nhif_api_url || 'https://api.nhif.go.tz',
      username: config.nhif_username || '',
      password: config.nhif_password || '',
      facilityCode: config.facility_code || '',
    };
  } catch (error) {
    console.error('Error loading NHIF config:', error);
    // Fallback to environment variables
    return {
      apiUrl: process.env.NHIF_API_URL || 'https://api.nhif.go.tz',
      username: process.env.NHIF_USERNAME || '',
      password: process.env.NHIF_PASSWORD || '',
      facilityCode: process.env.NHIF_FACILITY_CODE || '',
    };
  }
};

/**
 * Get or refresh NHIF access token
 */
export const getNHIFToken = async () => {
  try {
    // Check for cached token
    const { data: cachedToken, error: cacheError } = await supabase
      .from('nhif_token_cache')
      .select('*')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    // If valid token exists and not expired, return it
    if (cachedToken && new Date(cachedToken.expires_at) > new Date()) {
      return {
        success: true,
        token: cachedToken.access_token,
        tokenType: cachedToken.token_type || 'Bearer',
      };
    }

    // Fetch new token from NHIF API
    const tokenResponse = await fetch(`${NHIF_CONFIG.apiUrl}/Token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: NHIF_CONFIG.username,
        password: NHIF_CONFIG.password,
        grant_type: 'password',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('NHIF token fetch failed:', errorText);
      return {
        success: false,
        error: 'Failed to obtain NHIF access token',
      };
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

    // Store token in cache
    await supabase.from('nhif_token_cache').insert({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'Bearer',
      expires_at: expiresAt.toISOString(),
      fetched_at: new Date().toISOString(),
    });

    // Clean up old tokens
    await supabase
      .from('nhif_token_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    return {
      success: true,
      token: tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
    };
  } catch (error) {
    console.error('Error getting NHIF token:', error);
    return {
      success: false,
      error: error.message || 'Failed to get NHIF token',
    };
  }
};

/**
 * Verify NHIF card via NHIF API
 */
export const verifyNHIFCard = async (request) => {
  try {
    // Get NHIF config
    const NHIF_CONFIG = await getNHIFConfig();

    // Get access token
    const tokenResult = await getNHIFToken();
    if (!tokenResult.success) {
      return {
        success: false,
        authorizationStatus: 'REJECTED',
        error: tokenResult.error || 'Failed to get NHIF token',
      };
    }

    // Validate visit type requirements
    if (request.visitTypeId === 3 || request.visitTypeId === 4) {
      // Referral (3) or Follow-up (4) requires referral number
      if (!request.referralNo || request.referralNo.trim() === '') {
        return {
          success: false,
          authorizationStatus: 'REJECTED',
          error: 'Referral number is required for Referral and Follow-up visits',
        };
      }
    }

    // Build NHIF API request
    const apiUrl = new URL(`${NHIF_CONFIG.apiUrl}/AuthorizeCard`);
    apiUrl.searchParams.append('CardNo', request.cardNo);
    apiUrl.searchParams.append('VisitTypeID', request.visitTypeId.toString());
    if (request.referralNo) {
      apiUrl.searchParams.append('ReferralNo', request.referralNo);
    }
    if (request.remarks) {
      apiUrl.searchParams.append('Remarks', request.remarks);
    }

    // Call NHIF API
    const verifyResponse = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `${tokenResult.tokenType} ${tokenResult.token}`,
        'Accept': 'application/json',
      },
    });

    if (!verifyResponse.ok) {
      // If unauthorized, try refreshing token once
      if (verifyResponse.status === 401) {
        // Clear cached token and retry
        await supabase
          .from('nhif_token_cache')
          .delete()
          .eq('access_token', tokenResult.token);

        const retryTokenResult = await getNHIFToken();
        if (retryTokenResult.success) {
          // Retry with new token
          const retryResponse = await fetch(apiUrl.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `${retryTokenResult.tokenType} ${retryTokenResult.token}`,
              'Accept': 'application/json',
            },
          });

          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            return {
              success: false,
              authorizationStatus: 'REJECTED',
              error: `NHIF API error: ${retryResponse.status} - ${errorText}`,
            };
          }

          const retryData = await retryResponse.json();
          return parseNHIFResponse(retryData, request);
        }
      }

      const errorText = await verifyResponse.text();
      return {
        success: false,
        authorizationStatus: 'REJECTED',
        error: `NHIF API error: ${verifyResponse.status} - ${errorText}`,
      };
    }

    const responseData = await verifyResponse.json();
    return parseNHIFResponse(responseData, request);
  } catch (error) {
    console.error('NHIF verification error:', error);
    return {
      success: false,
      authorizationStatus: 'REJECTED',
      error: error.message || 'Network error during NHIF verification',
    };
  }
};

/**
 * Parse NHIF API response
 */
const parseNHIFResponse = (responseData, request) => {
  // NHIF API response structure (adjust based on actual API response)
  const authorizationStatus = responseData.AuthorizationStatus || responseData.authorizationStatus || 'REJECTED';
  const cardStatus = responseData.CardStatus || responseData.cardStatus;
  const authorizationNo = responseData.AuthorizationNo || responseData.authorizationNo;
  const memberName = responseData.MemberName || responseData.memberName;
  const remarks = responseData.Remarks || responseData.remarks;

  // Map NHIF response to our status enum
  let mappedStatus = 'REJECTED';
  if (authorizationStatus === 'ACCEPTED' || authorizationStatus === 'Accepted') {
    mappedStatus = 'ACCEPTED';
  } else if (authorizationStatus === 'PENDING' || authorizationStatus === 'Pending') {
    mappedStatus = 'PENDING';
  } else if (authorizationStatus === 'UNKNOWN' || authorizationStatus === 'Unknown') {
    mappedStatus = 'UNKNOWN';
  } else if (authorizationStatus === 'INVALID' || authorizationStatus === 'Invalid') {
    mappedStatus = 'INVALID';
  }

  return {
    success: true,
    authorizationStatus: mappedStatus,
    authorizationNo: authorizationNo || undefined,
    cardStatus: cardStatus || undefined,
    memberName: memberName || undefined,
    remarks: remarks || undefined,
    responsePayload: responseData,
  };
};

/**
 * Store NHIF verification in database
 */
export const storeNHIFVerification = async (verificationData) => {
  try {
    const { data, error } = await supabase
      .from('nhif_verifications')
      .insert({
        visit_id: verificationData.visitId,
        card_no: verificationData.cardNo,
        visit_type_id: verificationData.visitTypeId,
        referral_no: verificationData.referralNo || null,
        remarks_sent: verificationData.remarksSent || null,
        card_status: verificationData.cardStatus || null,
        authorization_status: verificationData.authorizationStatus,
        authorization_no: verificationData.authorizationNo || null,
        member_name: verificationData.memberName || null,
        response_payload: verificationData.responsePayload || null,
        verified_by: verificationData.verifiedBy,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing NHIF verification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, verification: data };
  } catch (error) {
    console.error('Error storing NHIF verification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get active NHIF verification for a visit
 */
export const getActiveNHIFVerification = async (visitId) => {
  try {
    const { data, error } = await supabase
      .from('nhif_verifications')
      .select('*')
      .eq('visit_id', visitId)
      .eq('is_active', true)
      .order('verified_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching NHIF verification:', error);
      return { success: false, error: error.message };
    }

    return { success: true, verification: data || null };
  } catch (error) {
    console.error('Error fetching NHIF verification:', error);
    return { success: false, error: error.message };
  }
};
