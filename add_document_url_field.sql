-- Add supporting fields for caching external document links
ALTER TABLE formation_documents 
ADD COLUMN IF NOT EXISTS document_url TEXT,
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS type TEXT;

COMMENT ON COLUMN formation_documents.document_url IS 'Lien direct vers le document (ex: Google Doc)';
COMMENT ON COLUMN formation_documents.external_id IS 'ID externe du document (ex: ID Google Drive)';
COMMENT ON COLUMN formation_documents.type IS 'Type de document (ex: google_doc, pdf, etc.)';
