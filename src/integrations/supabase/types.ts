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
      appointment_work: {
        Row: {
          amount_cents: number
          booking_id: string
          cleaner_id: string
          completed_tasks: string[]
          id: string
          minutes: number
          notes: string
          paid_at: string | null
          payment_reference: string
          rate_cents: number
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          booking_id: string
          cleaner_id: string
          completed_tasks?: string[]
          id?: string
          minutes?: number
          notes?: string
          paid_at?: string | null
          payment_reference?: string
          rate_cents?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          cleaner_id?: string
          completed_tasks?: string[]
          id?: string
          minutes?: number
          notes?: string
          paid_at?: string | null
          payment_reference?: string
          rate_cents?: number
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_work_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_work_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tips: {
        Row: {
          amount_cents: number
          booking_id: string
          cleaner_id: string
          created_at: string
          currency: string
          environment: string
          id: string
          paid_at: string | null
          payout_error: string
          payout_paid_at: string | null
          payout_status: string
          paypal_batch_id: string | null
          paypal_capture_id: string | null
          paypal_item_id: string | null
          paypal_order_id: string | null
          recipient_email: string | null
          status: string
        }
        Insert: {
          amount_cents: number
          booking_id: string
          cleaner_id: string
          created_at?: string
          currency?: string
          environment: string
          id?: string
          paid_at?: string | null
          payout_error?: string
          payout_paid_at?: string | null
          payout_status?: string
          paypal_batch_id?: string | null
          paypal_capture_id?: string | null
          paypal_item_id?: string | null
          paypal_order_id?: string | null
          recipient_email?: string | null
          status?: string
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          cleaner_id?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          paid_at?: string | null
          payout_error?: string
          payout_paid_at?: string | null
          payout_status?: string
          paypal_batch_id?: string | null
          paypal_capture_id?: string | null
          paypal_item_id?: string | null
          paypal_order_id?: string | null
          recipient_email?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_tips_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_tips_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cleaner_payout_accounts: {
        Row: {
          paypal_email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          paypal_email: string
          updated_at?: string
          user_id: string
        }
        Update: {
          paypal_email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_payout_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_payouts: {
        Row: {
          amount_cents: number
          cleaner_id: string
          created_at: string
          currency: string
          environment: string
          error_message: string
          id: string
          paypal_batch_id: string | null
          paypal_item_id: string | null
          provider_status: string | null
          recipient_email: string
          requested_by: string
          status: string
          updated_at: string
          work_id: string
        }
        Insert: {
          amount_cents: number
          cleaner_id: string
          created_at?: string
          currency?: string
          environment: string
          error_message?: string
          id?: string
          paypal_batch_id?: string | null
          paypal_item_id?: string | null
          provider_status?: string | null
          recipient_email: string
          requested_by: string
          status?: string
          updated_at?: string
          work_id: string
        }
        Update: {
          amount_cents?: number
          cleaner_id?: string
          created_at?: string
          currency?: string
          environment?: string
          error_message?: string
          id?: string
          paypal_batch_id?: string | null
          paypal_item_id?: string | null
          provider_status?: string | null
          recipient_email?: string
          requested_by?: string
          status?: string
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_payouts_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_payouts_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaner_payouts_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: true
            referencedRelation: "appointment_work"
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
      hiring_applications: {
        Row: {
          availability: string
          created_at: string
          experience: string
          full_name: string
          id: string
          phone: string
          service_areas: string
          status: string
          user_id: string
        }
        Insert: {
          availability: string
          created_at?: string
          experience: string
          full_name: string
          id?: string
          phone?: string
          service_areas: string
          status?: string
          user_id: string
        }
        Update: {
          availability?: string
          created_at?: string
          experience?: string
          full_name?: string
          id?: string
          phone?: string
          service_areas?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hiring_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      housekeeper_gallery: {
        Row: {
          after_path: string
          before_path: string
          caption: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          after_path: string
          before_path: string
          caption?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          after_path?: string
          before_path?: string
          caption?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_gallery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "housekeeper_portfolios"
            referencedColumns: ["user_id"]
          },
        ]
      }
      housekeeper_portfolios: {
        Row: {
          bio: string
          display_name: string
          headline: string
          portrait_path: string
          published: boolean
          service_areas: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string
          display_name: string
          headline?: string
          portrait_path?: string
          published?: boolean
          service_areas?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string
          display_name?: string
          headline?: string
          portrait_path?: string
          published?: boolean
          service_areas?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housekeeper_portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          booking_id: string | null
          cleaner_id: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          booking_id?: string | null
          cleaner_id: string
          created_at?: string
          id?: string
          kind: string
        }
        Update: {
          booking_id?: string | null
          cleaner_id?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
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
      can_read_thread: { Args: { _thread: string }; Returns: boolean }
      claim_cleaning: { Args: { _booking_id: string }; Returns: undefined }
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
      open_message_thread: {
        Args: { _booking?: string; _cleaner?: string }
        Returns: string
      }
      reschedule_booking: {
        Args: {
          _assignment: Json
          _booking_id: string
          _date: string
          _expected: Json
          _time_window: string
        }
        Returns: undefined
      }
      reserve_cleaner_payout: {
        Args: { _environment: string; _work_id: string }
        Returns: {
          amount_cents: number
          cleaner_id: string
          created_at: string
          currency: string
          environment: string
          error_message: string
          id: string
          paypal_batch_id: string | null
          paypal_item_id: string | null
          provider_status: string | null
          recipient_email: string
          requested_by: string
          status: string
          updated_at: string
          work_id: string
        }
        SetofOptions: {
          from: "*"
          to: "cleaner_payouts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_application: {
        Args: { _id: string; _status: string }
        Returns: undefined
      }
      review_timesheet: {
        Args: { _action: string; _id: string; _reference?: string }
        Returns: undefined
      }
      save_appointment_work: {
        Args: {
          _booking_id: string
          _minutes: number
          _notes: string
          _submit: boolean
          _tasks: string[]
        }
        Returns: undefined
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
      send_thread_message: {
        Args: { _body: string; _thread: string }
        Returns: undefined
      }
      waiting_cleanings: {
        Args: never
        Returns: {
          add_ons: string[]
          bathrooms: number
          bedrooms: number
          id: string
          preferred_date: string
          service: string
          service_area: string
          time_window: string
        }[]
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
