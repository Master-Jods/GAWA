-- Add banner_path column to account_profiles and configure gawa-avatars-banners storage bucket & policies

BEGIN;

ALTER TABLE public.account_profiles
ADD COLUMN IF NOT EXISTS banner_path text;

GRANT UPDATE (display_name, bio, avatar_path, banner_path, avatar_color, location, profile_visible)
ON public.account_profiles TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gawa-avatars-banners',
  'gawa-avatars-banners',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

UPDATE storage.buckets
SET public = true
WHERE id = 'gawa-profile-media';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'gawa_avatars_banners_public_read'
  ) THEN
    CREATE POLICY gawa_avatars_banners_public_read
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id IN ('gawa-avatars-banners', 'gawa-profile-media'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'gawa_avatars_banners_owner_insert'
  ) THEN
    CREATE POLICY gawa_avatars_banners_owner_insert
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id IN ('gawa-avatars-banners', 'gawa-profile-media')
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'gawa_avatars_banners_owner_update'
  ) THEN
    CREATE POLICY gawa_avatars_banners_owner_update
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id IN ('gawa-avatars-banners', 'gawa-profile-media')
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'gawa_avatars_banners_owner_delete'
  ) THEN
    CREATE POLICY gawa_avatars_banners_owner_delete
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id IN ('gawa-avatars-banners', 'gawa-profile-media')
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

COMMIT;
