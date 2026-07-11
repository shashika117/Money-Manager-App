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
      _mv_refresh_log: {
        Row: {
          last_refreshed: string
          view_name: string
        }
        Insert: {
          last_refreshed?: string
          view_name: string
        }
        Update: {
          last_refreshed?: string
          view_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: number
          needs_base: number
          save_base: number
          updated_at: string | null
          wants_base: number
        }
        Insert: {
          id?: number
          needs_base?: number
          save_base?: number
          updated_at?: string | null
          wants_base?: number
        }
        Update: {
          id?: number
          needs_base?: number
          save_base?: number
          updated_at?: string | null
          wants_base?: number
        }
        Relationships: []
      }
      budget_data: {
        Row: {
          amount: number
          ex_sub_category: string
          id: string
          month: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          ex_sub_category: string
          id?: string
          month: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          ex_sub_category?: string
          id?: string
          month?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_data_ex_sub_category_fkey"
            columns: ["ex_sub_category"]
            isOneToOne: false
            referencedRelation: "dim_sub_category"
            referencedColumns: ["ex_sub_category"]
          },
        ]
      }
      dim_account: {
        Row: {
          account_category: string
          account_group: string
          current_balance: number
          id: string
          is_active: boolean
          master_account: string
          opening_balance: number
          sort_order: number
        }
        Insert: {
          account_category: string
          account_group: string
          current_balance?: number
          id?: string
          is_active?: boolean
          master_account: string
          opening_balance?: number
          sort_order?: number
        }
        Update: {
          account_category?: string
          account_group?: string
          current_balance?: number
          id?: string
          is_active?: boolean
          master_account?: string
          opening_balance?: number
          sort_order?: number
        }
        Relationships: []
      }
      dim_goal: {
        Row: {
          created_at: string
          goal_name: string
          id: string
          is_active: boolean
          linked_account: string | null
          sort_order: number
          target_amount: number | null
          target_date: string | null
          template_budget: number | null
        }
        Insert: {
          created_at?: string
          goal_name: string
          id?: string
          is_active?: boolean
          linked_account?: string | null
          sort_order?: number
          target_amount?: number | null
          target_date?: string | null
          template_budget?: number | null
        }
        Update: {
          created_at?: string
          goal_name?: string
          id?: string
          is_active?: boolean
          linked_account?: string | null
          sort_order?: number
          target_amount?: number | null
          target_date?: string | null
          template_budget?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dim_goal_linked_account_fkey"
            columns: ["linked_account"]
            isOneToOne: false
            referencedRelation: "dim_account"
            referencedColumns: ["master_account"]
          },
          {
            foreignKeyName: "dim_goal_linked_account_fkey"
            columns: ["linked_account"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["master_account"]
          },
        ]
      }
      dim_sub_category: {
        Row: {
          category: string
          category_sort_order: number
          ex_sub_category: string
          group_name: string
          id: string
          is_active: boolean
          rollover_enabled: boolean
          sort_order: number
          template_budget: number | null
          type: string
        }
        Insert: {
          category: string
          category_sort_order?: number
          ex_sub_category: string
          group_name: string
          id?: string
          is_active?: boolean
          rollover_enabled?: boolean
          sort_order?: number
          template_budget?: number | null
          type?: string
        }
        Update: {
          category?: string
          category_sort_order?: number
          ex_sub_category?: string
          group_name?: string
          id?: string
          is_active?: boolean
          rollover_enabled?: boolean
          sort_order?: number
          template_budget?: number | null
          type?: string
        }
        Relationships: []
      }
      fact_goal: {
        Row: {
          created_at: string | null
          date: string
          ex_sub_category: string
          goal: string
          id: string
          master_account: string | null
          note: string | null
          singed_amount: number
          source_transaction_id: string | null
          transfer_group_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          ex_sub_category?: string
          goal: string
          id?: string
          master_account?: string | null
          note?: string | null
          singed_amount: number
          source_transaction_id?: string | null
          transfer_group_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          ex_sub_category?: string
          goal?: string
          id?: string
          master_account?: string | null
          note?: string | null
          singed_amount?: number
          source_transaction_id?: string | null
          transfer_group_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_goal_goal_fkey"
            columns: ["goal"]
            isOneToOne: false
            referencedRelation: "dim_goal"
            referencedColumns: ["goal_name"]
          },
          {
            foreignKeyName: "fact_goal_master_account_fkey"
            columns: ["master_account"]
            isOneToOne: false
            referencedRelation: "dim_account"
            referencedColumns: ["master_account"]
          },
          {
            foreignKeyName: "fact_goal_master_account_fkey"
            columns: ["master_account"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["master_account"]
          },
        ]
      }
      fact_transaction: {
        Row: {
          created_at: string | null
          date: string
          ex_sub_category: string
          goal: string | null
          id: string
          master_account: string
          note: string | null
          singed_amount: number
          transfer_group_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          ex_sub_category: string
          goal?: string | null
          id?: string
          master_account: string
          note?: string | null
          singed_amount: number
          transfer_group_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          ex_sub_category?: string
          goal?: string | null
          id?: string
          master_account?: string
          note?: string | null
          singed_amount?: number
          transfer_group_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fact_transaction_ex_sub_category_fkey"
            columns: ["ex_sub_category"]
            isOneToOne: false
            referencedRelation: "dim_sub_category"
            referencedColumns: ["ex_sub_category"]
          },
          {
            foreignKeyName: "fact_transaction_goal_fkey"
            columns: ["goal"]
            isOneToOne: false
            referencedRelation: "dim_goal"
            referencedColumns: ["goal_name"]
          },
          {
            foreignKeyName: "fact_transaction_master_account_fkey"
            columns: ["master_account"]
            isOneToOne: false
            referencedRelation: "dim_account"
            referencedColumns: ["master_account"]
          },
          {
            foreignKeyName: "fact_transaction_master_account_fkey"
            columns: ["master_account"]
            isOneToOne: false
            referencedRelation: "v_account_balances"
            referencedColumns: ["master_account"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      goal_budget_data: {
        Row: {
          amount: number
          goal_name: string
          id: string
          month: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          goal_name: string
          id?: string
          month: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          goal_name?: string
          id?: string
          month?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_budget_data_goal_fkey"
            columns: ["goal_name"]
            isOneToOne: false
            referencedRelation: "dim_goal"
            referencedColumns: ["goal_name"]
          },
        ]
      }
      home_prefs: {
        Row: {
          id: number
          prefs: Json
          updated_at: string
        }
        Insert: {
          id?: number
          prefs?: Json
          updated_at?: string
        }
        Update: {
          id?: number
          prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_color: string
          created_at: string | null
          display_name: string
          id: string
        }
        Insert: {
          avatar_color?: string
          created_at?: string | null
          display_name: string
          id: string
        }
        Update: {
          avatar_color?: string
          created_at?: string | null
          display_name?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      dim_date: {
        Row: {
          date: string | null
          day: number | null
          day_name: string | null
          day_of_week: number | null
          is_current_month: boolean | null
          month_full: string | null
          month_name: string | null
          month_no: number | null
          period_label: string | null
          period_sort: number | null
          week_of_month: number | null
          year: number | null
        }
        Relationships: []
      }
      mv_net_worth_monthly: {
        Row: {
          assets: number | null
          liability: number | null
          month_date: string | null
          net_worth: number | null
        }
        Relationships: []
      }
      v_account_balances: {
        Row: {
          account_category: string | null
          account_group: string | null
          current_balance: number | null
          master_account: string | null
          opening_balance: number | null
          sort_order: number | null
          txn_total: number | null
        }
        Insert: {
          account_category?: string | null
          account_group?: string | null
          current_balance?: number | null
          master_account?: string | null
          opening_balance?: number | null
          sort_order?: number | null
          txn_total?: never
        }
        Update: {
          account_category?: string | null
          account_group?: string | null
          current_balance?: number | null
          master_account?: string | null
          opening_balance?: number | null
          sort_order?: number | null
          txn_total?: never
        }
        Relationships: []
      }
      v_budget_with_rollover: {
        Row: {
          actual_singed: number | null
          budgeted: number | null
          category: string | null
          category_sort_order: number | null
          effective_budget: number | null
          ex_sub_category: string | null
          group_name: string | null
          month: string | null
          monthly_surplus: number | null
          remaining_for_spend: number | null
          rollover_amount: number | null
          rollover_enabled: boolean | null
          sort_order: number | null
          total_spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_data_ex_sub_category_fkey"
            columns: ["ex_sub_category"]
            isOneToOne: false
            referencedRelation: "dim_sub_category"
            referencedColumns: ["ex_sub_category"]
          },
        ]
      }
      v_calendar_daily: {
        Row: {
          daily_expense: number | null
          daily_income: number | null
          daily_net: number | null
          date: string | null
          day: number | null
          day_name: string | null
          day_of_week: number | null
          is_current_month: boolean | null
          month_name: string | null
          month_no: number | null
          transaction_count: number | null
          week_of_month: number | null
          year: number | null
        }
        Relationships: []
      }
      v_left_for_savings: {
        Row: {
          left_for_savings: number | null
          month: string | null
          total_income: number | null
          total_needs_cost: number | null
          total_savings: number | null
          total_wants_cost: number | null
        }
        Relationships: []
      }
      v_net_worth: {
        Row: {
          net_worth: number | null
          total_assets: number | null
          total_liability: number | null
        }
        Relationships: []
      }
      v_nws_components: {
        Row: {
          month: string | null
          total_income: number | null
          total_needs_cost: number | null
          total_savings: number | null
          total_wants_cost: number | null
        }
        Relationships: []
      }
      v_nws_score: {
        Row: {
          month: string | null
          needs_pct: number | null
          nws_score: number | null
          savings_pct: number | null
          total_income: number | null
          total_needs_cost: number | null
          total_savings: number | null
          total_wants_cost: number | null
          wants_pct: number | null
        }
        Relationships: []
      }
      v_remaining_for_spend: {
        Row: {
          category: string | null
          category_sort_order: number | null
          effective_budget: number | null
          ex_sub_category: string | null
          group_name: string | null
          month: string | null
          remaining_for_spend: number | null
          sort_order: number | null
          total_spent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_data_ex_sub_category_fkey"
            columns: ["ex_sub_category"]
            isOneToOne: false
            referencedRelation: "dim_sub_category"
            referencedColumns: ["ex_sub_category"]
          },
        ]
      }
    }
    Functions: {
      copy_budget_to_month: {
        Args: { p_target_month: string }
        Returns: string
      }
      create_goal_transfer: {
        Args: {
          p_amount: number
          p_date: string
          p_from_goal: string
          p_note?: string
          p_to_goal: string
          p_user_id?: string
        }
        Returns: Json
      }
      create_loan_payment: {
        Args: {
          p_capital_amount: number
          p_date: string
          p_from_account: string
          p_interest_amount?: number
          p_loan_account: string
          p_note?: string
          p_user_id?: string
        }
        Returns: Json
      }
      create_sinking_fund_expense: {
        Args: {
          p_account: string
          p_amount: number
          p_date: string
          p_goal_name: string
          p_note?: string
          p_user_id?: string
        }
        Returns: Json
      }
      create_transfer: {
        Args: {
          p_amount: number
          p_date: string
          p_fee?: number
          p_from_account: string
          p_from_funds?: boolean
          p_goal_name?: string
          p_note?: string
          p_to_account: string
          p_user_id?: string
        }
        Returns: Json
      }
      delete_goal_transfer: {
        Args: { p_transfer_group_id: string }
        Returns: Json
      }
      delete_loan_payment: {
        Args: { p_transfer_group_id: string }
        Returns: Json
      }
      delete_sinking_fund_expense: {
        Args: { p_transaction_id: string }
        Returns: Json
      }
      delete_transfer: { Args: { p_transfer_group_id: string }; Returns: Json }
      get_analytics_breakdown: {
        Args: {
          p_dimension: string
          p_end: string
          p_filter_category?: string
          p_filter_group?: string
          p_start: string
          p_tab: string
        }
        Returns: {
          amount: number
          bucket: string
          month: string
        }[]
      }
      get_analytics_daily: {
        Args: {
          p_end: string
          p_key?: string
          p_scope: string
          p_start: string
          p_tab: string
        }
        Returns: {
          amount: number
          d: string
        }[]
      }
      get_budget_rollover: {
        Args: { p_selected_month: string }
        Returns: {
          ex_sub_category: string
          rollover_amount: number
        }[]
      }
      get_budget_summary: {
        Args: { p_selected_month: string }
        Returns: {
          actual_expense: number
          actual_income: number
          actual_needs: number
          actual_nws: number
          actual_save: number
          actual_wants: number
          budget_expense: number
          budget_income: number
          budget_needs: number
          budget_nws: number
          budget_save: number
          budget_wants: number
          left_to_budget: number
          left_to_save: number
        }[]
      }
      get_budget_table: {
        Args: { p_selected_month: string }
        Returns: {
          actual: number
          budget: number
          category: string
          category_sort: number
          effective_budget: number
          ex_sub_category: string
          group_name: string
          remaining: number
          rollover_amount: number
          rollover_enabled: boolean
          section: string
          sort_order: number
          template_budget: number
        }[]
      }
      get_goal_current_balance: {
        Args: { p_goal_name: string }
        Returns: number
      }
      get_monthly_cashflow: {
        Args: { p_include_sinking_funds?: boolean }
        Returns: {
          expense: number
          income: number
          month: number
          net: number
          year: number
        }[]
      }
      get_my_family_id: { Args: never; Returns: string }
      get_net_worth_history: {
        Args: { p_period?: string }
        Returns: {
          assets: number
          liability: number
          net_worth: number
          period_date: string
        }[]
      }
      get_subcat_history: {
        Args: {
          p_ex_sub_category?: string
          p_goal_name?: string
          p_months?: number
          p_selected_month: string
        }
        Returns: {
          amount: number
          month_date: string
        }[]
      }
      get_total_left_to_save: { Args: never; Returns: number }
      recalculate_account_balances: { Args: never; Returns: string }
      set_home_pref: { Args: { p_key: string; p_value: Json }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_goal_transfer: {
        Args: {
          p_amount: number
          p_date: string
          p_from_goal: string
          p_note?: string
          p_to_goal: string
          p_transfer_group_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      update_loan_payment: {
        Args: {
          p_capital_amount: number
          p_date: string
          p_from_account: string
          p_interest_amount?: number
          p_loan_account: string
          p_note?: string
          p_transfer_group_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      update_nws_base: {
        Args: { p_needs: number; p_wants: number }
        Returns: {
          id: number
          needs_base: number
          save_base: number
          updated_at: string | null
          wants_base: number
        }
        SetofOptions: {
          from: "*"
          to: "app_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_sinking_fund_expense: {
        Args: {
          p_account: string
          p_amount: number
          p_date: string
          p_goal_name: string
          p_note?: string
          p_transaction_id: string
        }
        Returns: Json
      }
      update_transaction: {
        Args: {
          p_date: string
          p_ex_sub_category: string
          p_goal?: string
          p_id: string
          p_master_account: string
          p_note?: string
          p_singed_amount: number
        }
        Returns: Json
      }
      update_transfer: {
        Args: {
          p_amount: number
          p_date: string
          p_fee?: number
          p_from_account: string
          p_from_funds?: boolean
          p_goal_name?: string
          p_note?: string
          p_to_account: string
          p_transfer_group_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      upsert_budget: {
        Args: {
          p_amount: number
          p_apply_future?: boolean
          p_ex_sub_category: string
          p_month: string
        }
        Returns: undefined
      }
      upsert_goal_budget: {
        Args: {
          p_amount: number
          p_apply_future?: boolean
          p_goal_name: string
          p_month: string
        }
        Returns: undefined
      }
      upsert_monthly_allocation: {
        Args: {
          p_amount: number
          p_date: string
          p_force?: boolean
          p_goal_name: string
          p_note?: string
          p_user_id?: string
        }
        Returns: Json
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
