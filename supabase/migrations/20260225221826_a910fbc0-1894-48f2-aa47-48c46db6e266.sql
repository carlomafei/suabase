
-- Criar bucket público para logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Leitura pública
CREATE POLICY "Public read logos" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

-- Upload para usuários autenticados
CREATE POLICY "Authenticated upload logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Update para usuários autenticados
CREATE POLICY "Authenticated update logos" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Delete para usuários autenticados
CREATE POLICY "Authenticated delete logos" ON storage.objects FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
