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
      bank_accounts: {
        Row: {
          account_id: string | null
          archived: boolean
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["bank_account_kind"]
          name: string
          org_id: string
        }
        Insert: {
          account_id?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["bank_account_kind"]
          name: string
          org_id: string
        }
        Update: {
          account_id?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["bank_account_kind"]
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount_cents: number
          bank_account_id: string
          created_at: string
          date: string
          description: string | null
          external_ref: string | null
          id: string
          journal_entry_id: string | null
          org_id: string
          reconciliation_id: string | null
        }
        Insert: {
          amount_cents: number
          bank_account_id: string
          created_at?: string
          date: string
          description?: string | null
          external_ref?: string | null
          id?: string
          journal_entry_id?: string | null
          org_id: string
          reconciliation_id?: string | null
        }
        Update: {
          amount_cents?: number
          bank_account_id?: string
          created_at?: string
          date?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          journal_entry_id?: string | null
          org_id?: string
          reconciliation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
          subtype: string | null
          system: boolean
          type: Database["public"]["Enums"]["account_type"]
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
          subtype?: string | null
          system?: boolean
          type: Database["public"]["Enums"]["account_type"]
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          subtype?: string | null
          system?: boolean
          type?: Database["public"]["Enums"]["account_type"]
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          property_id: string | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          property_id?: string | null
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          cost_center_id: string | null
          created_at: string
          credited_cents: number
          due_date: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          number: string
          org_id: string
          paid_cents: number
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          credited_cents?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          number: string
          org_id: string
          paid_cents?: number
          status?: Database["public"]["Enums"]["document_status"]
          tenant_id?: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          credited_cents?: number
          due_date?: string | null
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          number?: string
          org_id?: string
          paid_cents?: number
          status?: Database["public"]["Enums"]["document_status"]
          tenant_id?: string | null
          total_cents?: number
          type?: Database["public"]["Enums"]["document_type"]
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          date: string
          id: string
          memo: string
          org_id: string
          reversed_entry_id: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          memo?: string
          org_id: string
          reversed_entry_id?: string | null
          source_id?: string | null
          source_type?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          memo?: string
          org_id?: string
          reversed_entry_id?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversed_entry_id_fkey"
            columns: ["reversed_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          cost_center_id: string | null
          credit_cents: number
          debit_cents: number
          entry_id: string
          id: string
          org_id: string
        }
        Insert: {
          account_id: string
          cost_center_id?: string | null
          credit_cents?: number
          debit_cents?: number
          entry_id: string
          id?: string
          org_id: string
        }
        Update: {
          account_id?: string
          cost_center_id?: string | null
          credit_cents?: number
          debit_cents?: number
          entry_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string
          deposit_amount_cents: number
          end_date: string | null
          id: string
          org_id: string
          rent_amount_cents: number
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          deposit_amount_cents?: number
          end_date?: string | null
          id?: string
          org_id: string
          rent_amount_cents: number
          start_date: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          deposit_amount_cents?: number
          end_date?: string | null
          id?: string
          org_id?: string
          rent_amount_cents?: number
          start_date?: string
          status?: Database["public"]["Enums"]["lease_status"]
          tenant_id?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          bank_account_id: string | null
          created_at: string
          date: string
          direction: Database["public"]["Enums"]["payment_direction"]
          document_id: string | null
          id: string
          journal_entry_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          reference: string | null
        }
        Insert: {
          amount_cents: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          document_id?: string | null
          id?: string
          journal_entry_id?: string | null
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          reference?: string | null
        }
        Update: {
          amount_cents?: number
          bank_account_id?: string | null
          created_at?: string
          date?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          document_id?: string | null
          id?: string
          journal_entry_id?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          org_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          org_id: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          org_id: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          org_id?: string
          phone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          bedrooms: number
          created_at: string
          id: string
          org_id: string
          property_id: string
          status: Database["public"]["Enums"]["unit_status"]
          unit_number: string
          updated_at: string | null
        }
        Insert: {
          bedrooms?: number
          created_at?: string
          id?: string
          org_id: string
          property_id: string
          status?: Database["public"]["Enums"]["unit_status"]
          unit_number: string
          updated_at?: string | null
        }
        Update: {
          bedrooms?: number
          created_at?: string
          id?: string
          org_id?: string
          property_id?: string
          status?: Database["public"]["Enums"]["unit_status"]
          unit_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization: {
        Args: {
          org_name: string
          org_type?: Database["public"]["Enums"]["org_type"]
        }
        Returns: {
          created_at: string
          id: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_account_id: {
        Args: { p_code: string; p_org_id: string }
        Returns: string
      }
      issue_rent_invoice: {
        Args: {
          p_due_date: string
          p_issue_date: string
          p_lease_id: string
          p_org_id: string
        }
        Returns: {
          cost_center_id: string | null
          created_at: string
          credited_cents: number
          due_date: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          number: string
          org_id: string
          paid_cents: number
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      post_entry: {
        Args: {
          p_date: string
          p_lines: Json
          p_memo: string
          p_org_id: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount_cents: number
          p_bank_account_id?: string
          p_date: string
          p_document_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference: string
        }
        Returns: {
          amount_cents: number
          bank_account_id: string | null
          created_at: string
          date: string
          direction: Database["public"]["Enums"]["payment_direction"]
          document_id: string | null
          id: string
          journal_entry_id: string | null
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          reference: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      require_financial_role: { Args: { p_org_id: string }; Returns: undefined }
      reverse_entry: {
        Args: { p_date: string; p_entry_id: string; p_memo: string }
        Returns: string
      }
      seed_chart_of_accounts: { Args: { p_org_id: string }; Returns: undefined }
      user_org_ids: { Args: never; Returns: string[] }
      user_org_ids_financial: { Args: never; Returns: string[] }
      user_org_ids_with_role: {
        Args: { roles: Database["public"]["Enums"]["org_role"][] }
        Returns: string[]
      }
      user_tenant_document_ids: { Args: never; Returns: string[] }
      user_tenant_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      bank_account_kind: "bank" | "mpesa" | "cash"
      document_status: "open" | "partial" | "paid" | "void"
      document_type: "rent_invoice" | "credit_note" | "bill" | "expense"
      lease_status: "active" | "ended" | "terminated"
      org_role: "owner" | "manager" | "accountant" | "caretaker"
      org_type: "individual" | "agency"
      payment_direction: "in" | "out"
      payment_method: "mpesa" | "kopokopo" | "cash" | "bank_transfer" | "cheque"
      property_type:
        | "apartment"
        | "bedsitter"
        | "maisonette"
        | "bungalow"
        | "commercial"
        | "mixed_use"
      unit_status: "vacant" | "occupied" | "notice"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      bank_account_kind: ["bank", "mpesa", "cash"],
      document_status: ["open", "partial", "paid", "void"],
      document_type: ["rent_invoice", "credit_note", "bill", "expense"],
      lease_status: ["active", "ended", "terminated"],
      org_role: ["owner", "manager", "accountant", "caretaker"],
      org_type: ["individual", "agency"],
      payment_direction: ["in", "out"],
      payment_method: ["mpesa", "kopokopo", "cash", "bank_transfer", "cheque"],
      property_type: [
        "apartment",
        "bedsitter",
        "maisonette",
        "bungalow",
        "commercial",
        "mixed_use",
      ],
      unit_status: ["vacant", "occupied", "notice"],
    },
  },
} as const
