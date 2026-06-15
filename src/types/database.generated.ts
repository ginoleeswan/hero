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
          person_name: string
          role: string
          source: string
          title_id: string | null
        }
        Insert: {
          hero_id: string
          person_name: string
          role: string
          source?: string
          title_id?: string | null
        }
        Update: {
          hero_id?: string
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
          eye_color: string | null
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
          place_of_birth: string | null
          portrait_url: string | null
          power: number | null
          powers: string[] | null
          powerstats_total: number | null
          publisher: string | null
          race: string | null
          relatives: string | null
          speed: number | null
          stats_source: string | null
          strength: number | null
          summary: string | null
          teams: string[] | null
          weight_imperial: string | null
          weight_metric: string | null
          wikidata_candidates: Json | null
          wikidata_enriched_at: string | null
          wikidata_qid: string | null
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
          eye_color?: string | null
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
          place_of_birth?: string | null
          portrait_url?: string | null
          power?: number | null
          powers?: string[] | null
          powerstats_total?: number | null
          publisher?: string | null
          race?: string | null
          relatives?: string | null
          speed?: number | null
          stats_source?: string | null
          strength?: number | null
          summary?: string | null
          teams?: string[] | null
          weight_imperial?: string | null
          weight_metric?: string | null
          wikidata_candidates?: Json | null
          wikidata_enriched_at?: string | null
          wikidata_qid?: string | null
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
          eye_color?: string | null
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
          place_of_birth?: string | null
          portrait_url?: string | null
          power?: number | null
          powers?: string[] | null
          powerstats_total?: number | null
          publisher?: string | null
          race?: string | null
          relatives?: string | null
          speed?: number | null
          stats_source?: string | null
          strength?: number | null
          summary?: string | null
          teams?: string[] | null
          weight_imperial?: string | null
          weight_metric?: string | null
          wikidata_candidates?: Json | null
          wikidata_enriched_at?: string | null
          wikidata_qid?: string | null
          wikidata_status?: string
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
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_admin?: boolean
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_admin?: boolean
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
      admin_add_comicvine_heroes: { Args: { p_heroes: Json }; Returns: number }
      admin_cron_status: { Args: never; Returns: Json }
      admin_delete_hero: { Args: { p_hero_id: string }; Returns: number }
      admin_reenrich_hero: { Args: { p_id: string }; Returns: string }
      admin_reschedule_cron: {
        Args: { p_jobname: string; p_schedule: string; p_limit?: number }
        Returns: string
      }
      admin_retry_failed: { Args: never; Returns: number }
      admin_run_drain: { Args: { p_limit?: number }; Returns: string }
      admin_run_wikidata_enrich: { Args: { p_limit?: number }; Returns: string }
      admin_run_wikidata_resolve: {
        Args: { p_limit?: number }
        Returns: string
      }
      admin_set_drain_cron: { Args: { p_enabled: boolean }; Returns: string }
      admin_snapshot_now: { Args: never; Returns: undefined }
      admin_stop_run: { Args: { p_run_id: number }; Returns: boolean }
      admin_toggle_cron: {
        Args: { p_enabled: boolean; p_jobname: string }
        Returns: string
      }
      cache_hero_comicvine_data: {
        Args: { p_id: string; p_powers: string[]; p_summary: string }
        Returns: undefined
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
          poster_url: string
          provider: string
          release_date: string
          title: string
          title_id: string
        }[]
      }
      heroes_aliases_text: { Args: { arr: string[] }; Returns: string }
      mark_hero_unresolved: { Args: { p_hero_id: string }; Returns: undefined }
      rebuild_hero_relationships: { Args: never; Returns: undefined }
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
      snapshot_catalog_health: { Args: never; Returns: undefined }
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
