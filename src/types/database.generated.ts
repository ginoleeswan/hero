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
      heroes: {
        Row: {
          aliases: string[] | null
          alignment: string | null
          alter_egos: string | null
          base: string | null
          category: string | null
          combat: number | null
          comicvine_enriched_at: string | null
          creators: string[] | null
          cv_teams: string[] | null
          description: string | null
          durability: number | null
          enemies: string[] | null
          enriched_at: string | null
          eye_color: string | null
          first_appearance: string | null
          first_issue_image_url: string | null
          friends: string[] | null
          full_name: string | null
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
          movies: string[] | null
          name: string
          occupation: string | null
          origin: string | null
          place_of_birth: string | null
          portrait_url: string | null
          power: number | null
          powers: string[] | null
          publisher: string | null
          race: string | null
          relatives: string | null
          speed: number | null
          strength: number | null
          summary: string | null
          weight_imperial: string | null
          weight_metric: string | null
        }
        Insert: {
          aliases?: string[] | null
          alignment?: string | null
          alter_egos?: string | null
          base?: string | null
          category?: string | null
          combat?: number | null
          comicvine_enriched_at?: string | null
          creators?: string[] | null
          cv_teams?: string[] | null
          description?: string | null
          durability?: number | null
          enemies?: string[] | null
          enriched_at?: string | null
          eye_color?: string | null
          first_appearance?: string | null
          first_issue_image_url?: string | null
          friends?: string[] | null
          full_name?: string | null
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
          movies?: string[] | null
          name: string
          occupation?: string | null
          origin?: string | null
          place_of_birth?: string | null
          portrait_url?: string | null
          power?: number | null
          powers?: string[] | null
          publisher?: string | null
          race?: string | null
          relatives?: string | null
          speed?: number | null
          strength?: number | null
          summary?: string | null
          weight_imperial?: string | null
          weight_metric?: string | null
        }
        Update: {
          aliases?: string[] | null
          alignment?: string | null
          alter_egos?: string | null
          base?: string | null
          category?: string | null
          combat?: number | null
          comicvine_enriched_at?: string | null
          creators?: string[] | null
          cv_teams?: string[] | null
          description?: string | null
          durability?: number | null
          enemies?: string[] | null
          enriched_at?: string | null
          eye_color?: string | null
          first_appearance?: string | null
          first_issue_image_url?: string | null
          friends?: string[] | null
          full_name?: string | null
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
          movies?: string[] | null
          name?: string
          occupation?: string | null
          origin?: string | null
          place_of_birth?: string | null
          portrait_url?: string | null
          power?: number | null
          powers?: string[] | null
          publisher?: string | null
          race?: string | null
          relatives?: string | null
          speed?: number | null
          strength?: number | null
          summary?: string | null
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
        }
        Insert: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cache_hero_comicvine_data: {
        Args: { p_id: string; p_powers: string[]; p_summary: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
