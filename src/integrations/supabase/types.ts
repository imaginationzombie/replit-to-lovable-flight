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
      bookings: {
        Row: {
          access_token: string
          add_ons: string[]
          address: string
          amount_cents: number
          authorized_at: string | null
          bathrooms: number
          bedrooms: number
          cleaner_id: string | null
          created_at: string
          currency: string
          customer_name: string
          email: string
          frequency: string
          id: string
          notes: string
          paid_at: string | null
          parent_booking_id: string | null
          paypal_authorization_id: string | null
          paypal_capture_id: string | null
          paypal_order_id: string | null
          paypal_vault_id: string | null
          phone: string
          preferred_date: string
          rush: boolean
          service: string
          service_area: string
          status: string
          time_window: string
          user_id: string | null
          visit_number: number
        }
        Insert: {
          access_token?: string
          add_ons?: string[]
          address: string
          amount_cents: number
          authorized_at?: string | null
          bathrooms: number
          bedrooms: number
          cleaner_id?: string | null
          created_at?: string
          currency?: string
          customer_name: string
          email: string
          frequency: string
          id?: string
          notes?: string
          paid_at?: string | null
          parent_booking_id?: string | null
          paypal_authorization_id?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          paypal_vault_id?: string | null
          phone: string
          preferred_date: string
          rush?: boolean
          service: string
          service_area: string
          status?: string
          time_window: string
          user_id?: string | null
          visit_number?: number
        }
        Update: {
          access_token?: string
          add_ons?: string[]
          address?: string
          amount_cents?: number
          authorized_at?: string | null
          bathrooms?: number
          bedrooms?: number
          cleaner_id?: string | null
          created_at?: string
          currency?: string
          customer_name?: string
          email?: string
          frequency?: string
          id?: string
          notes?: string
          paid_at?: string | null
          parent_booking_id?: string | null
          paypal_authorization_id?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          paypal_vault_id?: string | null
          phone?: string
          preferred_date?: string
          rush?: boolean
          service?: string
          service_area?: string
          status?: string
          time_window?: string
          user_id?: string | null
          visit_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_parent_booking_id_fkey"
            columns: ["parent_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_settings: {
        Row: {
          accepting_jobs: boolean
          bio: string
          hourly_rate_cents: number
          service_areas: string
          unavailable_dates: string[]
          updated_at: string
          user_id: string
          weekly_hours: Json
        }
        Insert: {
          accepting_jobs?: boolean
          bio?: string
          hourly_rate_cents?: number
          service_areas?: string
          unavailable_dates?: string[]
          updated_at?: string
          user_id: string
          weekly_hours?: Json
        }
        Update: {
          accepting_jobs?: boolean
          bio?: string
          hourly_rate_cents?: number
          service_areas?: string
          unavailable_dates?: string[]
          updated_at?: string
          user_id?: string
          weekly_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleaner_complete_booking: {
        Args: { _booking_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_cleaners: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      schedule_booking: {
        Args: {
          _booking_id: string
          _cleaner_id: string
          _date: string
          _expected_cleaner_id: string
          _expected_date: string
          _expected_time_window: string
          _time_window: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "cleaner" | "customer"
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
    Enums: {
      app_role: ["admin", "cleaner", "customer"],
    },
  },
} as const
