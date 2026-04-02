
-- Add pdf_url column for storing uploaded PDF references
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS pdf_url text;

-- Create storage bucket for research PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('research-pdfs', 'research-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload to research-pdfs bucket
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'research-pdfs');

-- RLS: Allow public read access
CREATE POLICY "Public can read research PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'research-pdfs');

-- RLS: Users can delete their own uploads
CREATE POLICY "Users can delete own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'research-pdfs');
