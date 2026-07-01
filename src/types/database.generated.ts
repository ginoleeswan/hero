export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_usage: {
        Row: {
          api: string
          created_at: string
          endpoint: string | null
          id: number
          units: number
        }
        Insert: {
          api: string
          created_at?: string
          endpoint?: string | null
          id?: never
          units?: number
        }
        Update: {
          api?: string
          created_at?: string
          endpoint?: string | null
          id?: never
          units?: number
        }
        Relationships: []
      }
      catalog_health_snapshots: {
        Row: {
          captured_at: string
          first_issue: number
          id: number
          image: number
          portrait: number
          stats: number
          summary: number
          total: number
        }
        Insert: {
          captured_at?: string
          first_issue: number
          id?: never
          image: number
          portrait: number
          stats: number
          summary: number
          total: number
        }
        Update: {
          captured_at?: string
          first_issue?: number
          id?: never
          image?: number
          portrait?: number
          stats?: number
          summary?: number
          total?: number
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          created_at: string
          id: number
          kind: string
          message: string
          session_id: string | null
          source: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          message: string
          session_id?: string | null
          source?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          message?: string
          session_id?: string | null
          source?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comic_issue_appearances: {
        Row: {
          hero_id: string
          issue_id: string
        }
        Insert: {
          hero_id: string
          issue_id: string
        }
        Update: {
          hero_id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comic_issue_appearances_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comic_issue_appearances_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "comic_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_issues: {
        Row: {
          comicvine_id: string
          cover_date: string | null
          cover_url: string | null
          creators: Json | null
          description: string | null
          id: string
          issue_number: string | null
          lead_hero_id: string | null
          max_fame: number | null
          publisher: string | null
          store_date: string | null
          story_title: string | null
          synced_at: string | null
          volume_id: number | null
          volume_name: string | null
        }
        Insert: {
          comicvine_id: string
          cover_date?: string | null
          cover_url?: string | null
          creators?: Json | null
          description?: string | null
          id: string
          issue_number?: string | null
          lead_hero_id?: string | null
          max_fame?: number | null
          publisher?: string | null
          store_date?: string | null
          story_title?: string | null
          synced_at?: string | null
          volume_id?: number | null
          volume_name?: string | null
        }
        Update: {
          comicvine_id?: string
          cover_date?: string | null
          cover_url?: string | null
          creators?: Json | null
          description?: string | null
          id?: string
          issue_number?: string | null
          lead_hero_id?: string | null
          max_fame?: number | null
          publisher?: string | null
          store_date?: string | null
          story_title?: string | null
          synced_at?: string | null
          volume_id?: number | null
          volume_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comic_issues_lead_hero_id_fkey"
            columns: ["lead_hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      comic_volumes: {
        Row: {
          character_ids: string[]
          lead_hero_id: string | null
          max_fame: number | null
          name: string | null
          publisher: string | null
          resolved_at: string | null
          status: string
          volume_id: number
        }
        Insert: {
          character_ids?: string[]
          lead_hero_id?: string | null
          max_fame?: number | null
          name?: string | null
          publisher?: string | null
          resolved_at?: string | null
          status?: string
          volume_id: number
        }
        Update: {
          character_ids?: string[]
          lead_hero_id?: string | null
          max_fame?: number | null
          name?: string | null
          publisher?: string | null
          resolved_at?: string | null
          status?: string
          volume_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "comic_volumes_lead_hero_id_fkey"
            columns: ["lead_hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          created_at: string
          hero_id: string
          id: number
          kind: string
          new_value: string | null
          note: string | null
          old_value: string | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_field: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hero_id: string
          id?: never
          kind: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          hero_id?: string
          id?: never
          kind?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_field?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      contributor_stats: {
        Row: {
          approved: number
          level: string
          pending: number
          rejected: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: number
          level?: string
          pending?: number
          rejected?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: number
          level?: string
          pending?: number
          rejected?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cv_ingestion_state: {
        Row: {
          error: string | null
          id: number
          last_offset: number
          last_run_at: string | null
          status: string
          target: number
          total_ingested: number
        }
        Insert: {
          error?: string | null
          id?: number
          last_offset?: number
          last_run_at?: string | null
          status?: string
          target?: number
          total_ingested?: number
        }
        Update: {
          error?: string | null
          id?: number
          last_offset?: number
          last_run_at?: string | null
          status?: string
          target?: number
          total_ingested?: number
        }
        Relationships: []
      }
      daily_game_results: {
        Row: {
          created_at: string
          guesses: number | null
          id: number
          puzzle_date: string
          won: boolean
        }
        Insert: {
          created_at?: string
          guesses?: number | null
          id?: never
          puzzle_date: string
          won: boolean
        }
        Update: {
          created_at?: string
          guesses?: number | null
          id?: never
          puzzle_date?: string
          won?: boolean
        }
        Relationships: []
      }
      enrichment_run_heroes: {
        Row: {
          hero_id: string
          run_id: number
        }
        Insert: {
          hero_id: string
          run_id: number
        }
        Update: {
          hero_id?: string
          run_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_run_heroes_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrichment_run_heroes_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "enrichment_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_runs: {
        Row: {
          cancel_requested: boolean
          created_at: string
          done: number
          duration_ms: number | null
          failed: number
          id: number
          processed: number
          remaining: number | null
          retry: number
          run_type: string
          started_at: string | null
          status: string
          triggered_by: string
        }
        Insert: {
          cancel_requested?: boolean
          created_at?: string
          done?: number
          duration_ms?: number | null
          failed?: number
          id?: never
          processed?: number
          remaining?: number | null
          retry?: number
          run_type: string
          started_at?: string | null
          status?: string
          triggered_by?: string
        }
        Update: {
          cancel_requested?: boolean
          created_at?: string
          done?: number
          duration_ms?: number | null
          failed?: number
          id?: never
          processed?: number
          remaining?: number | null
          retry?: number
          run_type?: string
          started_at?: string | null
          status?: string
          triggered_by?: string
        }
        Relationships: []
      }
      featured_campaigns: {
        Row: {
          accent: string | null
          blurb: string | null
          created_at: string
          ends_at: string
          franchise: string | null
          headline: string
          hero_ids: string[] | null
          id: string
          label: string
          priority: number
          starts_at: string
          title_id: string | null
        }
        Insert: {
          accent?: string | null
          blurb?: string | null
          created_at?: string
          ends_at: string
          franchise?: string | null
          headline: string
          hero_ids?: string[] | null
          id?: string
          label: string
          priority?: number
          starts_at?: string
          title_id?: string | null
        }
        Update: {
          accent?: string | null
          blurb?: string | null
          created_at?: string
          ends_at?: string
          franchise?: string | null
          headline?: string
          hero_ids?: string[] | null
          id?: string
          label?: string
          priority?: number
          starts_at?: string
          title_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "featured_campaigns_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_facts: {
        Row: {
          hero_id: string
          key: string
          source: string
          value: string
        }
        Insert: {
          hero_id: string
          key: string
          source?: string
          value: string
        }
        Update: {
          hero_id?: string
          key?: string
          source?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_facts_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_images: {
        Row: {
          caption: string | null
          created_at: string
          hero_id: string
          id: string
          issue_id: string | null
          sort_order: number
          source: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hero_id: string
          id?: string
          issue_id?: string | null
          sort_order?: number
          source: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          hero_id?: string
          id?: string
          issue_id?: string | null
          sort_order?: number
          source?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_images_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_media_appearances: {
        Row: {
          cv_name: string | null
          cv_url: string | null
          hero_id: string
          media_type: string | null
          rank: number | null
          source: string | null
          title_id: string
          tmdb_id: string | null
        }
        Insert: {
          cv_name?: string | null
          cv_url?: string | null
          hero_id: string
          media_type?: string | null
          rank?: number | null
          source?: string | null
          title_id: string
          tmdb_id?: string | null
        }
        Update: {
          cv_name?: string | null
          cv_url?: string | null
          hero_id?: string
          media_type?: string | null
          rank?: number | null
          source?: string | null
          title_id?: string
          tmdb_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_film_appearances_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_media_appearances_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_narrative_facts: {
        Row: {
          content: string
          generated_at: string
          hero_id: string
          id: number
          kind: string
          needs_review: boolean
          position: number | null
          source_model: string
          subject: string | null
        }
        Insert: {
          content: string
          generated_at?: string
          hero_id: string
          id?: never
          kind: string
          needs_review?: boolean
          position?: number | null
          source_model: string
          subject?: string | null
        }
        Update: {
          content?: string
          generated_at?: string
          hero_id?: string
          id?: never
          kind?: string
          needs_review?: boolean
          position?: number | null
          source_model?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_narrative_facts_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_people: {
        Row: {
          hero_id: string
          id: number
          person_name: string
          role: string
          source: string
          title_id: string | null
        }
        Insert: {
          hero_id: string
          id?: never
          person_name: string
          role: string
          source?: string
          title_id?: string | null
        }
        Update: {
          hero_id?: string
          id?: never
          person_name?: string
          role?: string
          source?: string
          title_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_people_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_people_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_relationships: {
        Row: {
          cross_universe: boolean
          hero_id: string
          kind: string
          rank: number | null
          related_id: string
          source: string
        }
        Insert: {
          cross_universe?: boolean
          hero_id: string
          kind: string
          rank?: number | null
          related_id: string
          source?: string
        }
        Update: {
          cross_universe?: boolean
          hero_id?: string
          kind?: string
          rank?: number | null
          related_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_relationships_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_relationships_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_relatives: {
        Row: {
          alias: string | null
          branch_side: string | null
          created_at: string
          hero_id: string
          id: string
          modifiers: string[]
          name: string
          position: number
          related_hero_id: string | null
          relation: Database["public"]["Enums"]["relation_kind"]
          role: string
          status: string | null
          tier: number
          tree_parent_id: string | null
        }
        Insert: {
          alias?: string | null
          branch_side?: string | null
          created_at?: string
          hero_id: string
          id?: string
          modifiers?: string[]
          name: string
          position?: number
          related_hero_id?: string | null
          relation: Database["public"]["Enums"]["relation_kind"]
          role: string
          status?: string | null
          tier: number
          tree_parent_id?: string | null
        }
        Update: {
          alias?: string | null
          branch_side?: string | null
          created_at?: string
          hero_id?: string
          id?: string
          modifiers?: string[]
          name?: string
          position?: number
          related_hero_id?: string | null
          relation?: Database["public"]["Enums"]["relation_kind"]
          role?: string
          status?: string | null
          tier?: number
          tree_parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hero_relatives_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_relatives_related_hero_id_fkey"
            columns: ["related_hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_relatives_tree_parent_id_fkey"
            columns: ["tree_parent_id"]
            isOneToOne: false
            referencedRelation: "hero_relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_tag_vocab: {
        Row: {
          category: string
          description: string
          label: string
          slug: string
        }
        Insert: {
          category: string
          description: string
          label: string
          slug: string
        }
        Update: {
          category?: string
          description?: string
          label?: string
          slug?: string
        }
        Relationships: []
      }
      hero_tags: {
        Row: {
          hero_id: string
          tag: string
        }
        Insert: {
          hero_id: string
          tag: string
        }
        Update: {
          hero_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_tags_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hero_tags_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "hero_tag_vocab"
            referencedColumns: ["slug"]
          },
        ]
      }
      heroes: {
        Row: {
          added_at: string
          ai_stats_status: string | null
          aliases: string[] | null
          alignment: string | null
          alter_egos: string | null
          base: string | null
          category: string | null
          combat: number | null
          comicvine_enriched_at: string | null
          comicvine_id: string | null
          comicvine_status: string | null
          creators: string[] | null
          description: string | null
          durability: number | null
          enemies: string[] | null
          enriched_at: string | null
          enwiki_title: string | null
          eye_color: string | null
          fame_rated_at: string | null
          fame_rated_by: string | null
          fame_score: number | null
          fame_score_version: number | null
          fame_tier: number
          first_appearance: string | null
          first_issue_data: Json | null
          first_issue_id: string | null
          first_issue_image_url: string | null
          franchise: string | null
          friends: string[] | null
          full_name: string | null
          gallery_enriched_at: string | null
          gender: string | null
          group_affiliation: string | null
          hair_color: string | null
          height_imperial: string | null
          height_metric: string | null
          id: string
          igdb_id: string | null
          igdb_status: string | null
          image_md_url: string | null
          image_url: string | null
          intelligence: number | null
          issue_count: number | null
          issue_covers: Json | null
          movie_count: number | null
          movies: Json[] | null
          name: string
          narrative_status: string
          occupation: string | null
          origin: string | null
          pageviews_at: string | null
          pageviews_prev: number | null
          pageviews_spike: number | null
          pageviews_week: number | null
          place_of_birth: string | null
          portrait_blurhash: string | null
          portrait_url: string | null
          power: number | null
          powers: string[] | null
          powerstats_total: number | null
          publisher: string | null
          race: string | null
          relatives: string | null
          search_text: string | null
          speed: number | null
          stats_source: string | null
          strength: number | null
          summary: string | null
          superhero_api_id: string | null
          teams: string[] | null
          weight_imperial: string | null
          weight_metric: string | null
          wikidata_candidates: Json | null
          wikidata_enriched_at: string | null
          wikidata_qid: string | null
          wikidata_sitelinks: number | null
          wikidata_status: string
        }
        Insert: {
          added_at?: string
          ai_stats_status?: string | null
          aliases?: string[] | null
          alignment?: string | null
          alter_egos?: string | null
          base?: string | null
          category?: string | null
          combat?: number | null
          comicvine_enriched_at?: string | null
          comicvine_id?: string | null
          comicvine_status?: string | null
          creators?: string[] | null
          description?: string | null
          durability?: number | null
          enemies?: string[] | null
          enriched_at?: string | null
          enwiki_title?: string | null
          eye_color?: string | null
          fame_rated_at?: string | null
          fame_rated_by?: string | null
          fame_score?: number | null
          fame_score_version?: number | null
          fame_tier?: number
          first_appearance?: string | null
          first_issue_data?: Json | null
          first_issue_id?: string | null
          first_issue_image_url?: string | null
          franchise?: string | null
          friends?: string[] | null
          full_name?: string | null
          gallery_enriched_at?: string | null
          gender?: string | null
          group_affiliation?: string | null
          hair_color?: string | null
          height_imperial?: string | null
          height_metric?: string | null
          id: string
          igdb_id?: string | null
          igdb_status?: string | null
          image_md_url?: string | null
          image_url?: string | null
          intelligence?: number | null
          issue_count?: number | null
          issue_covers?: Json | null
          movie_count?: number | null
          movies?: Json[] | null
          name: string
          narrative_status?: string
          occupation?: string | null
          origin?: string | null
          pageviews_at?: string | null
          pageviews_prev?: number | null
          pageviews_spike?: number | null
          pageviews_week?: number | null
          place_of_birth?: string | null
          portrait_blurhash?: string | null
          portrait_url?: string | null
          power?: number | null
          powers?: string[] | null
          powerstats_total?: number | null
          publisher?: string | null
          race?: string | null
          relatives?: string | null
          search_text?: string | null
          speed?: number | null
          stats_source?: string | null
          strength?: number | null
          summary?: string | null
          superhero_api_id?: string | null
          teams?: string[] | null
          weight_imperial?: string | null
          weight_metric?: string | null
          wikidata_candidates?: Json | null
          wikidata_enriched_at?: string | null
          wikidata_qid?: string | null
          wikidata_sitelinks?: number | null
          wikidata_status?: string
        }
        Update: {
          added_at?: string
          ai_stats_status?: string | null
          aliases?: string[] | null
          alignment?: string | null
          alter_egos?: string | null
          base?: string | null
          category?: string | null
          combat?: number | null
          comicvine_enriched_at?: string | null
          comicvine_id?: string | null
          comicvine_status?: string | null
          creators?: string[] | null
          description?: string | null
          durability?: number | null
          enemies?: string[] | null
          enriched_at?: string | null
          enwiki_title?: string | null
          eye_color?: string | null
          fame_rated_at?: string | null
          fame_rated_by?: string | null
          fame_score?: number | null
          fame_score_version?: number | null
          fame_tier?: number
          first_appearance?: string | null
          first_issue_data?: Json | null
          first_issue_id?: string | null
          first_issue_image_url?: string | null
          franchise?: string | null
          friends?: string[] | null
          full_name?: string | null
          gallery_enriched_at?: string | null
          gender?: string | null
          group_affiliation?: string | null
          hair_color?: string | null
          height_imperial?: string | null
          height_metric?: string | null
          id?: string
          igdb_id?: string | null
          igdb_status?: string | null
          image_md_url?: string | null
          image_url?: string | null
          intelligence?: number | null
          issue_count?: number | null
          issue_covers?: Json | null
          movie_count?: number | null
          movies?: Json[] | null
          name?: string
          narrative_status?: string
          occupation?: string | null
          origin?: string | null
          pageviews_at?: string | null
          pageviews_prev?: number | null
          pageviews_spike?: number | null
          pageviews_week?: number | null
          place_of_birth?: string | null
          portrait_blurhash?: string | null
          portrait_url?: string | null
          power?: number | null
          powers?: string[] | null
          powerstats_total?: number | null
          publisher?: string | null
          race?: string | null
          relatives?: string | null
          search_text?: string | null
          speed?: number | null
          stats_source?: string | null
          strength?: number | null
          summary?: string | null
          superhero_api_id?: string | null
          teams?: string[] | null
          weight_imperial?: string | null
          weight_metric?: string | null
          wikidata_candidates?: Json | null
          wikidata_enriched_at?: string | null
          wikidata_qid?: string | null
          wikidata_sitelinks?: number | null
          wikidata_status?: string
        }
        Relationships: []
      }
      heroes_meta_backup_20260629: {
        Row: {
          comicvine_id: string | null
          comicvine_status: string | null
          id: string | null
          issue_count: number | null
          movie_count: number | null
          name: string | null
          publisher: string | null
          snapshot_at: string | null
        }
        Insert: {
          comicvine_id?: string | null
          comicvine_status?: string | null
          id?: string | null
          issue_count?: number | null
          movie_count?: number | null
          name?: string | null
          publisher?: string | null
          snapshot_at?: string | null
        }
        Update: {
          comicvine_id?: string | null
          comicvine_status?: string | null
          id?: string | null
          issue_count?: number | null
          movie_count?: number | null
          name?: string | null
          publisher?: string | null
          snapshot_at?: string | null
        }
        Relationships: []
      }
      igdb_ingestion_state: {
        Row: {
          franchise: string
          igdb_franchise_id: number | null
          inserted: number
          last_synced_at: string | null
          publisher: string
          rehomed: number
          skipped: number
          status: string
        }
        Insert: {
          franchise: string
          igdb_franchise_id?: number | null
          inserted?: number
          last_synced_at?: string | null
          publisher: string
          rehomed?: number
          skipped?: number
          status?: string
        }
        Update: {
          franchise?: string
          igdb_franchise_id?: number | null
          inserted?: number
          last_synced_at?: string | null
          publisher?: string
          rehomed?: number
          skipped?: number
          status?: string
        }
        Relationships: []
      }
      matchup_vote_seeds: {
        Row: {
          hero_a_id: string
          hero_b_id: string
          votes_a: number
          votes_b: number
        }
        Insert: {
          hero_a_id: string
          hero_b_id: string
          votes_a?: number
          votes_b?: number
        }
        Update: {
          hero_a_id?: string
          hero_b_id?: string
          votes_a?: number
          votes_b?: number
        }
        Relationships: []
      }
      matchup_votes: {
        Row: {
          created_at: string
          hero_a_id: string
          hero_b_id: string
          picked_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hero_a_id: string
          hero_b_id: string
          picked_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hero_a_id?: string
          hero_b_id?: string
          picked_id?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          device: string | null
          id: number
          path: string
          referrer: string | null
          route: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: never
          path: string
          referrer?: string | null
          route: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: never
          path?: string
          referrer?: string | null
          route?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          hero_id: string
          id: number
          image_url: string | null
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          hero_id: string
          id?: never
          image_url?: string | null
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          hero_id?: string
          id?: never
          image_url?: string | null
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      team_battle_votes: {
        Row: {
          created_at: string
          picked_team_id: string
          team_a_id: string
          team_b_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          picked_team_id: string
          team_a_id: string
          team_b_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          picked_team_id?: string
          team_a_id?: string
          team_b_id?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          hero_id: string
          rank: number | null
          team_id: string
        }
        Insert: {
          hero_id: string
          rank?: number | null
          team_id: string
        }
        Update: {
          hero_id?: string
          rank?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_verdicts: {
        Row: {
          created_at: string
          team_a_id: string
          team_b_id: string
          verdict: string
        }
        Insert: {
          created_at?: string
          team_a_id: string
          team_b_id: string
          verdict: string
        }
        Update: {
          created_at?: string
          team_a_id?: string
          team_b_id?: string
          verdict?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          is_featured: boolean
          logo_url: string | null
          member_count: number
          name: string
          popularity: number
          publisher: string | null
          updated_at: string
        }
        Insert: {
          id: string
          is_featured?: boolean
          logo_url?: string | null
          member_count?: number
          name: string
          popularity?: number
          publisher?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          is_featured?: boolean
          logo_url?: string | null
          member_count?: number
          name?: string
          popularity?: number
          publisher?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      titles: {
        Row: {
          backdrop_url: string | null
          cast_members: Json | null
          details: Json | null
          enrich_status: string
          enriched_at: string | null
          external_id: string
          id: string
          media_type: string
          overview: string | null
          popularity: number | null
          poster_url: string | null
          release_date: string | null
          revenue: number | null
          runtime: number | null
          source: string
          stills: Json | null
          title: string
          tmdb_id: string | null
          trailer_key: string | null
          trending_at: string | null
          trending_rank: number | null
          vote_average: number | null
          watch_providers: Json | null
          year: number | null
        }
        Insert: {
          backdrop_url?: string | null
          cast_members?: Json | null
          details?: Json | null
          enrich_status?: string
          enriched_at?: string | null
          external_id: string
          id: string
          media_type?: string
          overview?: string | null
          popularity?: number | null
          poster_url?: string | null
          release_date?: string | null
          revenue?: number | null
          runtime?: number | null
          source: string
          stills?: Json | null
          title: string
          tmdb_id?: string | null
          trailer_key?: string | null
          trending_at?: string | null
          trending_rank?: number | null
          vote_average?: number | null
          watch_providers?: Json | null
          year?: number | null
        }
        Update: {
          backdrop_url?: string | null
          cast_members?: Json | null
          details?: Json | null
          enrich_status?: string
          enriched_at?: string | null
          external_id?: string
          id?: string
          media_type?: string
          overview?: string | null
          popularity?: number | null
          poster_url?: string | null
          release_date?: string | null
          revenue?: number | null
          runtime?: number | null
          source?: string
          stills?: Json | null
          title?: string
          tmdb_id?: string | null
          trailer_key?: string | null
          trending_at?: string | null
          trending_rank?: number | null
          vote_average?: number | null
          watch_providers?: Json | null
          year?: number | null
        }
        Relationships: []
      }
      tmdb_match_queue: {
        Row: {
          attempts: number
          cv_name: string
          cv_year: string | null
          status: string
          tmdb_id: string | null
        }
        Insert: {
          attempts?: number
          cv_name: string
          cv_year?: string | null
          status?: string
          tmdb_id?: string | null
        }
        Update: {
          attempts?: number
          cv_name?: string
          cv_year?: string | null
          status?: string
          tmdb_id?: string | null
        }
        Relationships: []
      }
      user_favourites: {
        Row: {
          created_at: string | null
          hero_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          hero_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          hero_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_favourites_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "heroes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          cover_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_admin: boolean
          last_seen_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_admin?: boolean
          last_seen_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_admin?: boolean
          last_seen_at?: string | null
        }
        Relationships: []
      }
      user_view_history: {
        Row: {
          hero_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          hero_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          hero_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: []
      }
      verdicts: {
        Row: {
          created_at: string
          hero_a_id: string
          hero_b_id: string
          verdict: string
        }
        Insert: {
          created_at?: string
          hero_a_id: string
          hero_b_id: string
          verdict: string
        }
        Update: {
          created_at?: string
          hero_a_id?: string
          hero_b_id?: string
          verdict?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _apply_hero_field: {
        Args: { p_field: string; p_hero_id: string; p_value: string }
        Returns: undefined
      }
      _contrib_field_type: { Args: { p_field: string }; Returns: string }
      _parse_str_list: { Args: { p_raw: string }; Returns: string[] }
      _report_reason_ok: {
        Args: { p_reason: string; p_target: string }
        Returns: boolean
      }
      admin_add_comicvine_heroes: {
        Args: { p_heroes: Json }
        Returns: {
          comicvine_id: string
          id: string
        }[]
      }
      admin_community_overview: { Args: never; Returns: Json }
      admin_cron_status: { Args: never; Returns: Json }
      admin_delete_campaign: { Args: { p_id: string }; Returns: number }
      admin_delete_hero: { Args: { p_hero_id: string }; Returns: number }
      admin_edit_hero: {
        Args: {
          p_hero_id: string
          p_kind: string
          p_new_value: string
          p_target_field: string
        }
        Returns: Json
      }
      admin_merge_heroes: {
        Args: { p_loser: string; p_winner: string }
        Returns: undefined
      }
      admin_recent_client_errors: {
        Args: { p_days?: number; p_limit?: number }
        Returns: Json
      }
      admin_reenrich_hero: { Args: { p_id: string }; Returns: string }
      admin_refresh_fame: { Args: never; Returns: number }
      admin_reports_queue: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_reason?: string
          p_status?: string
        }
        Returns: Json
      }
      admin_reschedule_cron: {
        Args: { p_jobname: string; p_limit?: number; p_schedule: string }
        Returns: string
      }
      admin_resolve_report: {
        Args: { p_decision: string; p_id: number; p_note: string }
        Returns: Json
      }
      admin_retry_failed: { Args: never; Returns: number }
      admin_review_contribution: {
        Args: { p_decision: string; p_id: number; p_reason: string }
        Returns: Json
      }
      admin_review_queue: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_run_drain: { Args: { p_limit?: number }; Returns: string }
      admin_run_wikidata_enrich: { Args: { p_limit?: number }; Returns: string }
      admin_run_wikidata_resolve: {
        Args: { p_limit?: number }
        Returns: string
      }
      admin_set_drain_cron: { Args: { p_enabled: boolean }; Returns: string }
      admin_set_universe: {
        Args: { p_hero_id: string; p_publisher: string }
        Returns: Json
      }
      admin_snapshot_now: { Args: never; Returns: undefined }
      admin_stop_run: { Args: { p_run_id: number }; Returns: boolean }
      admin_toggle_cron: {
        Args: { p_enabled: boolean; p_jobname: string }
        Returns: string
      }
      admin_traffic_overview: { Args: { p_days?: number }; Returns: Json }
      admin_upsert_campaign: {
        Args: {
          p_accent?: string
          p_blurb?: string
          p_ends_at: string
          p_franchise?: string
          p_headline: string
          p_hero_ids?: string[]
          p_id?: string
          p_label: string
          p_priority?: number
          p_starts_at?: string
          p_title_id?: string
        }
        Returns: string
      }
      auto_tier_unrated_pool: { Args: never; Returns: number }
      cache_hero_comicvine_data: {
        Args: { p_id: string; p_powers: string[]; p_summary: string }
        Returns: undefined
      }
      cast_matchup_vote: {
        Args: { p_a: string; p_b: string; p_picked: string }
        Returns: Json
      }
      cast_team_battle_vote: {
        Args: { p_a: string; p_b: string; p_picked: string }
        Returns: Json
      }
      catalog_distributions: { Args: never; Returns: Json }
      catalog_health: { Args: never; Returns: Json }
      category_facet_counts: {
        Args: {
          p_alignment?: string
          p_gender?: string
          p_has_stats?: boolean
          p_publisher?: string
          p_search?: string
          p_slug: string
        }
        Returns: Json
      }
      compute_fame_score: {
        Args: {
          p_n_issue: number
          p_n_movie: number
          p_n_site: number
          p_tier: number
        }
        Returns: number
      }
      find_duplicate_heroes: {
        Args: { p_limit?: number }
        Returns: {
          comicvine_id: string
          comicvine_status: string
          hero_id: string
          image_url: string
          issue_count: number
          name: string
          publisher: string
          superhero_api_id: string
          wikidata_qid: string
        }[]
      }
      get_active_campaigns: {
        Args: { p_chars?: number; p_limit?: number }
        Returns: {
          accent: string
          backdrop_url: string
          blurb: string
          campaign_id: string
          headline: string
          hero_id: string
          hero_image_url: string
          hero_name: string
          hero_portrait_url: string
          label: string
          poster_url: string
          title_id: string
        }[]
      }
      get_browse_covers: {
        Args: { p_per_slug?: number; p_slugs: string[] }
        Returns: {
          id: string
          image_md_url: string
          image_url: string
          name: string
          portrait_url: string
          pos: number
          slug: string
        }[]
      }
      get_daily_distribution: { Args: { p_date: string }; Returns: Json }
      get_daily_hero: { Args: { p_date?: string }; Returns: Json }
      get_debuts_this_month: {
        Args: { p_limit?: number; p_max_chars?: number; p_min_fame?: number }
        Returns: {
          characters: Json
          cover_url: string
          debut_year: number
          issue_id: string
          issue_number: string
          series_name: string
        }[]
      }
      get_era_timeline: {
        Args: { per_era?: number }
        Returns: {
          era: string
          hero_id: string
          image_url: string
          name: string
          portrait_url: string
          year: number
        }[]
      }
      get_family_opponents: {
        Args: { p_hero_id: string; p_limit?: number }
        Returns: {
          alignment: string
          id: string
          image_md_url: string
          image_url: string
          name: string
          portrait_url: string
          publisher: string
        }[]
      }
      get_matchup_tally: { Args: { p_a: string; p_b: string }; Returns: Json }
      get_most_feared: {
        Args: { p_limit?: number }
        Returns: {
          alignment: string
          feared_by: number
          id: string
          image_md_url: string
          image_url: string
          name: string
          portrait_url: string
          publisher: string
        }[]
      }
      get_my_battle_record: { Args: never; Returns: Json }
      get_my_contributions: { Args: never; Returns: Json }
      get_my_taste_profile: { Args: never; Returns: Json }
      get_new_comics: {
        Args: {
          p_chars_per_issue?: number
          p_days?: number
          p_limit?: number
          p_min_fame?: number
        }
        Returns: {
          cover_url: string
          hero_id: string
          hero_image_url: string
          hero_name: string
          hero_portrait_url: string
          issue_id: string
          issue_number: string
          max_fame: number
          publisher: string
          store_date: string
          volume_name: string
        }[]
      }
      get_pending_build_ids: { Args: { p_limit?: number }; Returns: string[] }
      get_related_heroes: {
        Args: {
          p_hero_id: string
          p_kind?: string
          p_limit?: number
          p_same_universe?: boolean
        }
        Returns: {
          alignment: string
          id: string
          image_md_url: string
          image_url: string
          name: string
          portrait_url: string
          publisher: string
          rank: number
          source: string
        }[]
      }
      get_relationship: {
        Args: { p_a: string; p_b: string }
        Returns: {
          cross_universe: boolean
          family_relation: string
          is_ally: boolean
          is_curated: boolean
          is_enemy: boolean
          is_teammate: boolean
        }[]
      }
      get_source_coverage: { Args: never; Returns: Json }
      get_team_battle_tally: {
        Args: { p_a: string; p_b: string }
        Returns: Json
      }
      get_team_roster: {
        Args: { p_limit?: number; p_team_id: string }
        Returns: {
          combat: number
          durability: number
          id: string
          image_url: string
          intelligence: number
          name: string
          portrait_url: string
          power: number
          publisher: string
          rank: number
          speed: number
          strength: number
        }[]
      }
      get_team_synergy: { Args: { p_hero_ids: string[] }; Returns: Json }
      get_top_rivalries: {
        Args: { p_limit?: number }
        Returns: {
          a_id: string
          a_image_url: string
          a_name: string
          a_portrait_url: string
          a_publisher: string
          b_id: string
          b_image_url: string
          b_name: string
          b_portrait_url: string
          b_publisher: string
          cross_universe: boolean
        }[]
      }
      get_trending_for_user: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          context_title: string
          id: string
          image_url: string
          name: string
          portrait_url: string
        }[]
      }
      get_trending_heroes: {
        Args: { p_bucket?: string; p_limit?: number }
        Returns: {
          context_title: string
          id: string
          image_url: string
          media_type: string
          name: string
          portrait_url: string
          provider: string
          release_date: string
        }[]
      }
      get_trending_heroes_wiki: {
        Args: { p_limit?: number; p_min_week?: number }
        Returns: {
          id: string
          image_url: string
          name: string
          pageviews_spike: number
          pageviews_week: number
          portrait_url: string
        }[]
      }
      get_trending_on_screen: {
        Args: { p_chars_per_title?: number; p_limit?: number }
        Returns: {
          backdrop_url: string
          hero_id: string
          hero_image_url: string
          hero_name: string
          hero_portrait_url: string
          media_type: string
          poster_url: string
          provider: string
          release_date: string
          title: string
          title_id: string
          trailer_key: string
        }[]
      }
      get_trending_titles: {
        Args: {
          p_bucket?: string
          p_chars_per_title?: number
          p_title_limit?: number
        }
        Returns: {
          backdrop_url: string
          hero_id: string
          hero_image_url: string
          hero_name: string
          hero_portrait_url: string
          media_type: string
          overview: string
          poster_url: string
          provider: string
          release_date: string
          title: string
          title_id: string
        }[]
      }
      get_trending_titles_multi: {
        Args: {
          p_buckets: string[]
          p_chars_per_title?: number
          p_title_limit?: number
        }
        Returns: {
          backdrop_url: string
          bucket: string
          hero_id: string
          hero_image_url: string
          hero_name: string
          hero_portrait_url: string
          media_type: string
          overview: string
          poster_url: string
          provider: string
          release_date: string
          title: string
          title_id: string
        }[]
      }
      heroes_aliases_text: { Args: { arr: string[] }; Returns: string }
      link_tmdb_cast: { Args: never; Returns: number }
      mark_hero_unresolved: { Args: { p_hero_id: string }; Returns: undefined }
      nightly_maintenance: { Args: never; Returns: undefined }
      rebuild_hero_relationships: { Args: never; Returns: undefined }
      rebuild_teams: { Args: never; Returns: undefined }
      recompute_fame_scores: { Args: never; Returns: number }
      record_daily_result: {
        Args: { p_date: string; p_guesses: number; p_won: boolean }
        Returns: undefined
      }
      refresh_fame: { Args: never; Returns: number }
      register_film_match: {
        Args: {
          p_cv_name: string
          p_media_type: string
          p_title: string
          p_tmdb_id: string
        }
        Returns: undefined
      }
      register_media_match: {
        Args: {
          p_cv_name: string
          p_external_id: string
          p_media_type: string
          p_source: string
          p_title: string
        }
        Returns: undefined
      }
      resolve_hero_qid: {
        Args: { p_hero_id: string; p_qid: string }
        Returns: undefined
      }
      search_heroes: {
        Args: {
          alignment_filter?: string
          publisher_filter?: string
          result_limit?: number
          result_offset?: number
          search_query: string
        }
        Returns: {
          aliases: string[]
          alignment: string
          fame_score: number
          full_name: string
          id: string
          image_md_url: string
          image_url: string
          name: string
          portrait_url: string
          publisher: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slugify_team: { Args: { p_name: string }; Returns: string }
      snapshot_catalog_health: { Args: never; Returns: undefined }
      submit_contribution: {
        Args: {
          p_hero_id: string
          p_kind: string
          p_new_value: string
          p_note: string
          p_target_field: string
        }
        Returns: Json
      }
      submit_report: {
        Args: {
          p_detail: string
          p_hero_id: string
          p_image_url: string
          p_reason: string
          p_target_type: string
        }
        Returns: Json
      }
      touch_last_seen: { Args: never; Returns: undefined }
    }
    Enums: {
      relation_kind:
        | "parent"
        | "child"
        | "sibling"
        | "spouse"
        | "grandparent"
        | "grandchild"
        | "aunt_uncle"
        | "niece_nephew"
        | "cousin"
        | "in_law"
        | "ancestor"
        | "clone"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      relation_kind: [
        "parent",
        "child",
        "sibling",
        "spouse",
        "grandparent",
        "grandchild",
        "aunt_uncle",
        "niece_nephew",
        "cousin",
        "in_law",
        "ancestor",
        "clone",
        "other",
      ],
    },
  },
} as const
