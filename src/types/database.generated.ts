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
        Row: { api: string; created_at: string; endpoint: string | null; id: number; units: number }
        Insert: { api: string; created_at?: string; endpoint?: string | null; id?: number; units?: number }
        Update: { api?: string; created_at?: string; endpoint?: string | null; id?: number; units?: number }
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
          id?: number
          image: number
          portrait: number
          stats: number
          summary: number
          total: number
        }
        Update: {
          captured_at?: string
          first_issue?: number
          id?: number
          image?: number
          portrait?: number
          stats?: number
          summary?: number
          total?: number
        }
        Relationships: []
      }
      enrichment_runs: {
        Row: {
          created_at: string
          done: number
          duration_ms: number | null
          failed: number
          id: number
          processed: number
          remaining: number | null
          retry: number
          run_type: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          done?: number
          duration_ms?: number | null
          failed?: number
          id?: number
          processed?: number
          remaining?: number | null
          retry?: number
          run_type: string
          triggered_by?: string
        }
        Update: {
          created_at?: string
          done?: number
          duration_ms?: number | null
          failed?: number
          id?: number
          processed?: number
          remaining?: number | null
          retry?: number
          run_type?: string
          triggered_by?: string
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
      heroes: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
      admin_cron_status: { Args: never; Returns: Json }
      admin_retry_failed: { Args: never; Returns: number }
      admin_run_drain: { Args: { p_limit?: number }; Returns: string }
      admin_set_drain_cron: { Args: { p_enabled: boolean }; Returns: string }
      cache_hero_comicvine_data: {
        Args: { p_id: string; p_powers: string[]; p_summary: string }
        Returns: undefined
      }
      catalog_distributions: { Args: never; Returns: Json }
      catalog_health: { Args: never; Returns: Json }
      snapshot_catalog_health: { Args: never; Returns: undefined }
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
      heroes_aliases_text: { Args: { arr: string[] }; Returns: string }
      rebuild_hero_relationships: { Args: never; Returns: undefined }
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
