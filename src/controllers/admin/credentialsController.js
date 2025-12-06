const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');
const { encrypt, decrypt } = require('../../utils/encryption');

/**
 * Service types available for credentials
 */
const VALID_SERVICE_TYPES = [
  'github',
  'hostinger',
  'aws',
  'google_cloud',
  'digitalocean',
  'vercel',
  'netlify',
  'domain_registrar',
  'email_service',
  'payment_gateway',
  'api_service',
  'database',
  'cdn',
  'ssl_certificate',
  'other',
];

/**
 * Get all business credentials with filters
 */
async function getBusinessCredentials(req, res) {
  try {
    const {
      service_type,
      service_category,
      is_active = true,
      search,
      tags,
      page = 1,
      limit = 50,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = req.query;

    let query = supabase
      .from('business_credentials')
      .select('*', { count: 'exact' })
      .eq('is_active', is_active === 'true' || is_active === true);

    // Apply filters
    if (service_type) {
      query = query.eq('service_type', service_type);
    }

    if (service_category) {
      query = query.eq('service_category', service_category);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query = query.contains('tags', tagArray);
    }

    if (search) {
      query = query.or(`credential_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    // Sorting
    const validSortFields = ['created_at', 'credential_name', 'service_type', 'last_used_at', 'expires_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order === 'asc' ? 'asc' : 'desc';
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    query = query.range(from, to);

    const { data: credentials, error, count } = await query;

    if (error) {
      logger.error('Get business credentials error:', error);
      throw new Error('Failed to fetch credentials');
    }

    // Decrypt sensitive fields for response (but mask passwords by default)
    const credentialsWithMaskedPasswords = (credentials || []).map((cred) => {
      const decrypted = { ...cred };
      
      // Don't decrypt passwords by default - require explicit request
      // Only show masked password
      if (decrypted.password_encrypted) {
        decrypted.password_encrypted = '••••••••';
        decrypted.has_password = true;
      } else {
        decrypted.has_password = false;
      }
      
      // Mask API keys and secrets
      if (decrypted.api_key) {
        decrypted.api_key = '••••••••';
        decrypted.has_api_key = true;
      }
      if (decrypted.api_secret) {
        decrypted.has_api_secret = true;
      }
      if (decrypted.access_token) {
        decrypted.has_access_token = true;
      }
      
      return decrypted;
    });

    return successResponse(res, {
      credentials: credentialsWithMaskedPasswords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get business credentials error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get credential statistics
 */
async function getCredentialStats(req, res) {
  try {
    const { data: allCredentials, error } = await supabase
      .from('business_credentials')
      .select('service_type, service_category, is_active, expires_at');

    if (error) {
      logger.error('Get credential stats error:', error);
      throw new Error('Failed to fetch credential statistics');
    }

    const stats = {
      total: allCredentials?.length || 0,
      active: 0,
      inactive: 0,
      by_service_type: {},
      by_category: {},
      expiring_soon: 0, // Credentials expiring in next 30 days
    };

    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    allCredentials?.forEach((cred) => {
      // Count by active status
      if (cred.is_active) {
        stats.active += 1;
      } else {
        stats.inactive += 1;
      }

      // Count by service type
      stats.by_service_type[cred.service_type] = (stats.by_service_type[cred.service_type] || 0) + 1;

      // Count by category
      if (cred.service_category) {
        stats.by_category[cred.service_category] = (stats.by_category[cred.service_category] || 0) + 1;
      }

      // Expiring soon
      if (cred.expires_at) {
        const expiryDate = new Date(cred.expires_at);
        if (expiryDate >= today && expiryDate <= thirtyDaysFromNow) {
          stats.expiring_soon += 1;
        }
      }
    });

    return successResponse(res, stats);
  } catch (error) {
    logger.error('Get credential stats error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get credential by ID (with decrypted password option)
 */
async function getCredentialById(req, res) {
  try {
    const { id } = req.params;
    const { decrypt_password = false } = req.query;

    const { data: credential, error } = await supabase
      .from('business_credentials')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !credential) {
      return errorResponse(res, { message: 'Credential not found' }, 404);
    }

    // Log access for audit
    if (req.admin?.id) {
      try {
        await supabase.from('credential_access_logs').insert({
          credential_id: id,
          accessed_by: req.admin.id,
          access_type: 'view',
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
        });
      } catch (logError) {
        // Don't fail the request if logging fails
        logger.error('Failed to log credential access:', logError);
      }
    }

    const response = { ...credential };

    // Decrypt passwords only if explicitly requested
    if (decrypt_password === 'true' || decrypt_password === true) {
      try {
        if (credential.password_encrypted) {
          response.password_decrypted = decrypt(credential.password_encrypted);
          
          // Log decryption access
          if (req.admin?.id) {
            await supabase.from('credential_access_logs').insert({
              credential_id: id,
              accessed_by: req.admin.id,
              access_type: 'decrypt',
              ip_address: req.ip,
              user_agent: req.get('user-agent'),
            });
          }
        }
        if (credential.api_key) {
          response.api_key_decrypted = decrypt(credential.api_key);
        }
        if (credential.api_secret) {
          response.api_secret_decrypted = decrypt(credential.api_secret);
        }
        if (credential.access_token) {
          response.access_token_decrypted = decrypt(credential.access_token);
        }
      } catch (decryptError) {
        logger.error('Decryption error:', decryptError);
        return errorResponse(res, { message: 'Failed to decrypt credentials' }, 500);
      }
    } else {
      // Mask sensitive fields
      if (credential.password_encrypted) {
        response.password_encrypted = '••••••••';
        response.has_password = true;
      }
      if (credential.api_key) {
        response.api_key = '••••••••';
        response.has_api_key = true;
      }
      if (credential.api_secret) {
        response.has_api_secret = true;
      }
      if (credential.access_token) {
        response.has_access_token = true;
      }
    }

    return successResponse(res, response);
  } catch (error) {
    logger.error('Get credential by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Create new credential
 */
async function createCredential(req, res) {
  try {
    const {
      credential_name,
      service_type,
      service_category,
      username,
      email,
      phone,
      password,
      api_key,
      api_secret,
      access_token,
      refresh_token,
      url,
      account_id,
      notes,
      tags,
      expires_at,
    } = req.body;

    // Validation
    if (!credential_name || !service_type) {
      return errorResponse(res, { message: 'Credential name and service type are required' }, 400);
    }

    if (!VALID_SERVICE_TYPES.includes(service_type)) {
      return errorResponse(res, { 
        message: `Invalid service type. Valid types: ${VALID_SERVICE_TYPES.join(', ')}` 
      }, 400);
    }

    if (!password && !api_key && !access_token) {
      return errorResponse(res, { 
        message: 'At least one of password, api_key, or access_token is required' 
      }, 400);
    }

    // Get admin user ID from request (set by adminAuth middleware)
    let created_by = null;
    if (req.admin?.id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(req.admin.id)) {
        created_by = req.admin.id;
      }
    }

    // Prepare data for insertion
    const credentialData = {
      credential_name,
      service_type,
      service_category: service_category || null,
      username: username || null,
      email: email || null,
      phone: phone || null,
      url: url || null,
      account_id: account_id || null,
      notes: notes || null,
      expires_at: expires_at || null,
      created_by,
      updated_by: created_by,
    };

    // Encrypt sensitive fields
    if (password) {
      credentialData.password_encrypted = encrypt(password);
    }
    if (api_key) {
      credentialData.api_key = encrypt(api_key);
    }
    if (api_secret) {
      credentialData.api_secret = encrypt(api_secret);
    }
    if (access_token) {
      credentialData.access_token = encrypt(access_token);
    }
    if (refresh_token) {
      credentialData.refresh_token = encrypt(refresh_token);
    }

    // Parse tags if string
    if (tags) {
      credentialData.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    }

    // Insert credential
    const { data: credential, error } = await supabase
      .from('business_credentials')
      .insert(credentialData)
      .select()
      .single();

    if (error) {
      logger.error('Create credential error:', error);
      throw new Error('Failed to create credential');
    }

    // Mask sensitive fields in response
    const response = { ...credential };
    if (response.password_encrypted) {
      response.password_encrypted = '••••••••';
      response.has_password = true;
    }
    if (response.api_key) {
      response.api_key = '••••••••';
      response.has_api_key = true;
    }

    return successResponse(res, response, 'Credential created successfully', 201);
  } catch (error) {
    logger.error('Create credential error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update credential
 */
async function updateCredential(req, res) {
  try {
    const { id } = req.params;
    const {
      credential_name,
      service_category,
      username,
      email,
      phone,
      password,
      api_key,
      api_secret,
      access_token,
      refresh_token,
      url,
      account_id,
      notes,
      tags,
      expires_at,
      is_active,
    } = req.body;

    // Get existing credential
    const { data: existingCredential, error: fetchError } = await supabase
      .from('business_credentials')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingCredential) {
      return errorResponse(res, { message: 'Credential not found' }, 404);
    }

    // Get admin user ID
    let updated_by = null;
    if (req.admin?.id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(req.admin.id)) {
        updated_by = req.admin.id;
      }
    }

    // Build update data
    const updateData = {};
    if (credential_name) updateData.credential_name = credential_name;
    if (service_category !== undefined) updateData.service_category = service_category;
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (url !== undefined) updateData.url = url;
    if (account_id !== undefined) updateData.account_id = account_id;
    if (notes !== undefined) updateData.notes = notes;
    if (expires_at !== undefined) updateData.expires_at = expires_at;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (updated_by) updateData.updated_by = updated_by;

    // Encrypt sensitive fields if provided
    if (password !== undefined) {
      updateData.password_encrypted = password ? encrypt(password) : null;
    }
    if (api_key !== undefined) {
      updateData.api_key = api_key ? encrypt(api_key) : null;
    }
    if (api_secret !== undefined) {
      updateData.api_secret = api_secret ? encrypt(api_secret) : null;
    }
    if (access_token !== undefined) {
      updateData.access_token = access_token ? encrypt(access_token) : null;
    }
    if (refresh_token !== undefined) {
      updateData.refresh_token = refresh_token ? encrypt(refresh_token) : null;
    }

    // Parse tags if provided
    if (tags !== undefined) {
      updateData.tags = tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : null;
    }

    // Update credential
    const { data: credential, error } = await supabase
      .from('business_credentials')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update credential error:', error);
      throw new Error('Failed to update credential');
    }

    // Log update access
    if (req.admin?.id) {
      try {
        await supabase.from('credential_access_logs').insert({
          credential_id: id,
          accessed_by: req.admin.id,
          access_type: 'update',
          ip_address: req.ip,
          user_agent: req.get('user-agent'),
        });
      } catch (logError) {
        logger.error('Failed to log credential update:', logError);
      }
    }

    // Mask sensitive fields in response
    const response = { ...credential };
    if (response.password_encrypted) {
      response.password_encrypted = '••••••••';
      response.has_password = true;
    }
    if (response.api_key) {
      response.api_key = '••••••••';
      response.has_api_key = true;
    }

    return successResponse(res, response, 'Credential updated successfully');
  } catch (error) {
    logger.error('Update credential error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Delete credential
 */
async function deleteCredential(req, res) {
  try {
    const { id } = req.params;

    // Check if credential exists
    const { data: credential, error: fetchError } = await supabase
      .from('business_credentials')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !credential) {
      return errorResponse(res, { message: 'Credential not found' }, 404);
    }

    // Delete credential (access logs will be cascade deleted if CASCADE is set)
    const { error } = await supabase
      .from('business_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Delete credential error:', error);
      throw new Error('Failed to delete credential');
    }

    return successResponse(res, null, 'Credential deleted successfully');
  } catch (error) {
    logger.error('Delete credential error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get credential access logs (audit trail)
 */
async function getCredentialAccessLogs(req, res) {
  try {
    const { credential_id, accessed_by, page = 1, limit = 50 } = req.query;

    let query = supabase
      .from('credential_access_logs')
      .select('*, credential:business_credentials(credential_name, service_type), admin:admin_users(email, name)', { count: 'exact' })
      .order('accessed_at', { ascending: false });

    if (credential_id) {
      query = query.eq('credential_id', credential_id);
    }

    if (accessed_by) {
      query = query.eq('accessed_by', accessed_by);
    }

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    query = query.range(from, to);

    const { data: logs, error, count } = await query;

    if (error) {
      logger.error('Get credential access logs error:', error);
      throw new Error('Failed to fetch access logs');
    }

    return successResponse(res, {
      logs: logs || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get credential access logs error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getBusinessCredentials,
  getCredentialStats,
  getCredentialById,
  createCredential,
  updateCredential,
  deleteCredential,
  getCredentialAccessLogs,
};

