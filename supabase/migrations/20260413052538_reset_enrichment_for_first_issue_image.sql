UPDATE heroes SET comicvine_enriched_at = NULL WHERE first_issue_image_url IS NULL AND comicvine_enriched_at IS NOT NULL;;
