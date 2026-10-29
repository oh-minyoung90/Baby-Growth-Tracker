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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      body_measures: {
        Row: {
          created_at: string
          date: string
          height_cm: number | null
          id: string
          memo: string | null
          owner_id: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          date: string
          height_cm?: number | null
          id?: string
          memo?: string | null
          owner_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          height_cm?: number | null
          id?: string
          memo?: string | null
          owner_id?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      children: {
        Row: {
          birth_date: string
          created_at: string
          id: string
          nickname: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          created_at?: string
          id?: string
          nickname: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          created_at?: string
          id?: string
          nickname?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      food_status_history: {
        Row: {
          caution_tag: boolean
          changed_at: string
          food_id: string
          from_status: string
          id: string
          meal_entry_id: string | null
          owner_id: string
          reason: string | null
          to_status: string
          trigger: string
        }
        Insert: {
          caution_tag?: boolean
          changed_at?: string
          food_id: string
          from_status: string
          id?: string
          meal_entry_id?: string | null
          owner_id?: string
          reason?: string | null
          to_status: string
          trigger: string
        }
        Update: {
          caution_tag?: boolean
          changed_at?: string
          food_id?: string
          from_status?: string
          id?: string
          meal_entry_id?: string | null
          owner_id?: string
          reason?: string | null
          to_status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_status_history_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          caution_since: string | null
          caution_tag: boolean
          check_note: string | null
          created_at: string
          first_tried_date: string | null
          food_group: string
          id: string
          is_default: boolean
          manual_first_tried_date: string | null
          manual_tried: boolean
          memo: string | null
          name: string
          name_key: string | null
          owner_id: string
          preference: string | null
          reaction_date: string | null
          status: string
          symptom_note: string | null
          updated_at: string
        }
        Insert: {
          caution_since?: string | null
          caution_tag?: boolean
          check_note?: string | null
          created_at?: string
          first_tried_date?: string | null
          food_group: string
          id?: string
          is_default?: boolean
          manual_first_tried_date?: string | null
          manual_tried?: boolean
          memo?: string | null
          name: string
          name_key?: string | null
          owner_id?: string
          preference?: string | null
          reaction_date?: string | null
          status?: string
          symptom_note?: string | null
          updated_at?: string
        }
        Update: {
          caution_since?: string | null
          caution_tag?: boolean
          check_note?: string | null
          created_at?: string
          first_tried_date?: string | null
          food_group?: string
          id?: string
          is_default?: boolean
          manual_first_tried_date?: string | null
          manual_tried?: boolean
          memo?: string | null
          name?: string
          name_key?: string | null
          owner_id?: string
          preference?: string | null
          reaction_date?: string | null
          status?: string
          symptom_note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          created_at: string
          date: string
          id: string
          memo: string | null
          owner_id: string
          title: string
          title_key: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          memo?: string | null
          owner_id?: string
          title: string
          title_key?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          owner_id?: string
          title?: string
          title_key?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      sleep_logs: {
        Row: {
          bed_time: string | null
          created_at: string
          date: string
          id: string
          memo: string | null
          naps: Json
          owner_id: string
          updated_at: string
          wake_time: string | null
        }
        Insert: {
          bed_time?: string | null
          created_at?: string
          date: string
          id?: string
          memo?: string | null
          naps?: Json
          owner_id?: string
          updated_at?: string
          wake_time?: string | null
        }
        Update: {
          bed_time?: string | null
          created_at?: string
          date?: string
          id?: string
          memo?: string | null
          naps?: Json
          owner_id?: string
          updated_at?: string
          wake_time?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_food: {
        Args: {
          already_tried?: boolean
          first_tried_date?: string
          food_group: string
          memo?: string
          name: string
          preference?: string
        }
        Returns: {
          caution_since: string | null
          caution_tag: boolean
          check_note: string | null
          created_at: string
          first_tried_date: string | null
          food_group: string
          id: string
          is_default: boolean
          manual_first_tried_date: string | null
          manual_tried: boolean
          memo: string | null
          name: string
          name_key: string | null
          owner_id: string
          preference: string | null
          reaction_date: string | null
          status: string
          symptom_note: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_default_foods: { Args: never; Returns: number }
      update_food: {
        Args: {
          already_tried?: boolean
          first_tried_date?: string
          food_group: string
          food_id: string
          memo?: string
          name: string
          preference?: string
        }
        Returns: {
          caution_since: string | null
          caution_tag: boolean
          check_note: string | null
          created_at: string
          first_tried_date: string | null
          food_group: string
          id: string
          is_default: boolean
          manual_first_tried_date: string | null
          manual_tried: boolean
          memo: string | null
          name: string
          name_key: string | null
          owner_id: string
          preference: string | null
          reaction_date: string | null
          status: string
          symptom_note: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "foods"
          isOneToOne: true
          isSetofReturn: false
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
