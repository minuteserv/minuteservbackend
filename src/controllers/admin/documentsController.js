const supabase = require('../../config/supabase');
const { successResponse, errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Storage bucket name
const STORAGE_BUCKET = 'business-documents';

// Configure multer for memory storage (we'll upload directly to Supabase)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Images, Word, Excel, CSV, Text'));
    }
  },
});

// Middleware for single file upload
const uploadSingle = upload.single('file');

/**
 * Get all business documents with filters
 */
async function getBusinessDocuments(req, res) {
  try {
    const {
      document_type,
      document_category,
      related_entity_type,
      related_entity_id,
      is_archived = false,
      search,
      tags,
      page = 1,
      limit = 50,
      sort_by = 'uploaded_at',
      sort_order = 'desc',
    } = req.query;

    let query = supabase
      .from('business_documents')
      .select('*', { count: 'exact' })
      .eq('is_archived', is_archived === 'true');

    // Apply filters
    if (document_type) {
      query = query.eq('document_type', document_type);
    }

    if (document_category) {
      query = query.eq('document_category', document_category);
    }

    if (related_entity_type) {
      query = query.eq('related_entity_type', related_entity_type);
    }

    if (related_entity_id) {
      query = query.eq('related_entity_id', related_entity_id);
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query = query.contains('tags', tagArray);
    }

    if (search) {
      query = query.or(`document_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Sorting
    const validSortFields = ['uploaded_at', 'document_name', 'file_size', 'expiry_date'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'uploaded_at';
    const sortDirection = sort_order === 'asc' ? 'asc' : 'desc';
    query = query.order(sortField, { ascending: sortDirection === 'asc' });

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    query = query.range(from, to);

    const { data: documents, error, count } = await query;

    if (error) {
      logger.error('Get business documents error:', error);
      throw new Error('Failed to fetch documents');
    }

    return successResponse(res, {
      documents: documents || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get business documents error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get document statistics
 */
async function getDocumentStats(req, res) {
  try {
    const { data: allDocuments, error } = await supabase
      .from('business_documents')
      .select('document_type, file_size, is_archived, expiry_date');

    if (error) {
      logger.error('Get document stats error:', error);
      throw new Error('Failed to fetch document statistics');
    }

    const stats = {
      total: allDocuments?.length || 0,
      by_type: {},
      total_size: 0,
      archived: 0,
      expiring_soon: 0, // Documents expiring in next 30 days
    };

    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    allDocuments?.forEach((doc) => {
      // Count by type
      stats.by_type[doc.document_type] = (stats.by_type[doc.document_type] || 0) + 1;

      // Total size
      if (doc.file_size) {
        stats.total_size += doc.file_size;
      }

      // Archived count
      if (doc.is_archived) {
        stats.archived += 1;
      }

      // Expiring soon
      if (doc.expiry_date) {
        const expiryDate = new Date(doc.expiry_date);
        if (expiryDate >= today && expiryDate <= thirtyDaysFromNow) {
          stats.expiring_soon += 1;
        }
      }
    });

    return successResponse(res, stats);
  } catch (error) {
    logger.error('Get document stats error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Get document by ID
 */
async function getDocumentById(req, res) {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('business_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !document) {
      return errorResponse(res, { message: 'Document not found' }, 404);
    }

    return successResponse(res, document);
  } catch (error) {
    logger.error('Get document by ID error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Upload document to Supabase Storage and save metadata
 */
async function uploadDocument(req, res) {
  try {
    uploadSingle(req, res, async (err) => {
      if (err) {
        return errorResponse(res, { message: err.message }, 400);
      }

      if (!req.file) {
        return errorResponse(res, { message: 'No file uploaded' }, 400);
      }

      const {
        document_name,
        document_type,
        document_category,
        description,
        tags,
        related_entity_type,
        related_entity_id,
        expiry_date,
      } = req.body;

      if (!document_name || !document_type) {
        return errorResponse(res, { message: 'Document name and type are required' }, 400);
      }

      // Validate document type
      const validTypes = ['financial', 'legal', 'operational', 'marketing', 'reports', 'miscellaneous'];
      if (!validTypes.includes(document_type)) {
        return errorResponse(res, { message: 'Invalid document type' }, 400);
      }

      // Generate unique file name
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `${crypto.randomUUID()}${fileExtension}`;
      const filePath = `${document_type}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileName}`;
      const bucketName = STORAGE_BUCKET;

      // Check if bucket exists (optional check - will fail on upload if it doesn't)
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError) {
        const bucketExists = buckets?.some(b => b.name === bucketName);
        if (!bucketExists) {
          logger.error(`Storage bucket '${bucketName}' does not exist`);
          return errorResponse(res, { 
            message: `Storage bucket '${bucketName}' does not exist. Please create it in Supabase Dashboard → Storage`,
            error: 'Bucket not found',
            instructions: 'Go to Supabase Dashboard → Storage → Create bucket named "business-documents"'
          }, 500);
        }
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        logger.error('Supabase Storage upload error:', uploadError);
        logger.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        
        // Provide helpful error messages
        let errorMessage = 'Failed to upload file to storage';
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          errorMessage = `Storage bucket '${bucketName}' does not exist. Please create it in Supabase Dashboard → Storage`;
        } else if (uploadError.message?.includes('row-level security')) {
          errorMessage = 'Storage bucket permissions issue. Ensure the bucket is public or RLS policies allow uploads';
        } else if (uploadError.message) {
          errorMessage = uploadError.message;
        }
        
        return errorResponse(res, { 
          message: errorMessage,
          error: uploadError.message || 'Unknown storage error',
          details: process.env.NODE_ENV === 'development' ? uploadError : undefined
        }, 500);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Parse tags if string
      let tagsArray = [];
      if (tags) {
        tagsArray = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
      }

      // Get admin user ID from request (set by adminAuth middleware)
      // Only use if it's a valid UUID (not mock token like "admin-1")
      let uploaded_by = null;
      if (req.admin?.id) {
        // Check if it's a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(req.admin.id)) {
          uploaded_by = req.admin.id;
        }
        // Otherwise leave as null (for mock tokens like "admin-1")
      }

      // Save document metadata to database
      const { data: document, error: dbError } = await supabase
        .from('business_documents')
        .insert({
          document_name,
          document_type,
          document_category: document_category || null,
          file_url: publicUrl,
          file_path: filePath,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          description: description || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          related_entity_type: related_entity_type || null,
          related_entity_id: related_entity_id || null,
          expiry_date: expiry_date || null,
          uploaded_by,
        })
        .select()
        .single();

      if (dbError) {
        logger.error('Save document metadata error:', dbError);
        // Try to delete uploaded file if database save fails
        await supabase.storage.from(bucketName).remove([filePath]);
        return errorResponse(res, { message: 'Failed to save document metadata' }, 500);
      }

      return successResponse(res, document, 'Document uploaded successfully', 201);
    });
  } catch (error) {
    logger.error('Upload document error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Update document metadata
 */
async function updateDocument(req, res) {
  try {
    const { id } = req.params;
    const {
      document_name,
      document_category,
      description,
      tags,
      related_entity_type,
      related_entity_id,
      expiry_date,
      is_archived,
    } = req.body;

    const updateData = {};

    if (document_name) updateData.document_name = document_name;
    if (document_category !== undefined) updateData.document_category = document_category;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) {
      updateData.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    }
    if (related_entity_type !== undefined) updateData.related_entity_type = related_entity_type;
    if (related_entity_id !== undefined) updateData.related_entity_id = related_entity_id;
    if (expiry_date !== undefined) updateData.expiry_date = expiry_date;
    if (is_archived !== undefined) updateData.is_archived = is_archived;

    const { data: document, error } = await supabase
      .from('business_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update document error:', error);
      throw new Error('Failed to update document');
    }

    if (!document) {
      return errorResponse(res, { message: 'Document not found' }, 404);
    }

    return successResponse(res, document, 'Document updated successfully');
  } catch (error) {
    logger.error('Update document error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Delete document (removes from storage and database)
 */
async function deleteDocument(req, res) {
  try {
    const { id } = req.params;

    // Get document to find file path
    const { data: document, error: fetchError } = await supabase
      .from('business_documents')
      .select('file_path')
      .eq('id', id)
      .single();

    if (fetchError || !document) {
      return errorResponse(res, { message: 'Document not found' }, 404);
    }

    // Delete from storage
    if (document.file_path) {
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([document.file_path]);

      if (storageError) {
        logger.error('Delete from storage error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('business_documents')
      .delete()
      .eq('id', id);

    if (dbError) {
      logger.error('Delete document error:', dbError);
      throw new Error('Failed to delete document');
    }

    return successResponse(res, null, 'Document deleted successfully');
  } catch (error) {
    logger.error('Delete document error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Archive/Unarchive document
 */
async function archiveDocument(req, res) {
  try {
    const { id } = req.params;
    const { is_archived } = req.body;

    const { data: document, error } = await supabase
      .from('business_documents')
      .update({ is_archived: is_archived === true || is_archived === 'true' })
      .eq('id', id)
      .select()
      .single();

    if (error || !document) {
      return errorResponse(res, { message: 'Document not found' }, 404);
    }

    return successResponse(res, document, `Document ${is_archived ? 'archived' : 'unarchived'} successfully`);
  } catch (error) {
    logger.error('Archive document error:', error);
    return errorResponse(res, error, 500);
  }
}

/**
 * Download document (returns file URL)
 */
async function downloadDocument(req, res) {
  try {
    const { id } = req.params;

    const { data: document, error } = await supabase
      .from('business_documents')
      .select('file_url, document_name, mime_type')
      .eq('id', id)
      .single();

    if (error || !document) {
      return errorResponse(res, { message: 'Document not found' }, 404);
    }

    return successResponse(res, {
      url: document.file_url,
      name: document.document_name,
      mime_type: document.mime_type,
    });
  } catch (error) {
    logger.error('Download document error:', error);
    return errorResponse(res, error, 500);
  }
}

module.exports = {
  getBusinessDocuments,
  getDocumentStats,
  getDocumentById,
  uploadDocument,
  updateDocument,
  deleteDocument,
  archiveDocument,
  downloadDocument,
};

