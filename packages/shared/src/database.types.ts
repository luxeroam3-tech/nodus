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
      deposits: {
        Row: {
          amount_cents: number
          collected_date: string
          collection_journal_entry_id: string | null
          created_at: string
          forfeited_cents: number
          id: string
          lease_id: string
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          refund_date: string | null
          refund_journal_entry_id: string | null
          refund_notes: string | null
          refunded_cents: number
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          collected_date?: string
          collection_journal_entry_id?: string | null
          created_at?: string
          forfeited_cents?: number
          id?: string
          lease_id: string
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          refund_date?: string | null
          refund_journal_entry_id?: string | null
          refund_notes?: string | null
          refunded_cents?: number
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          collected_date?: string
          collection_journal_entry_id?: string | null
          created_at?: string
          forfeited_cents?: number
          id?: string
          lease_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          org_id?: string
          refund_date?: string | null
          refund_journal_entry_id?: string | null
          refund_notes?: string | null
          refunded_cents?: number
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposits_collection_journal_entry_id_fkey"
            columns: ["collection_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: true
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposits_refund_journal_entry_id_fkey"
            columns: ["refund_journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          cost_center_id: string | null
          created_at: string
          credited_cents: number
          cu_invoice_number: string | null
          cu_serial: string | null
          due_date: string | null
          fiscalized_at: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          org_id: string
          paid_cents: number
          qr_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
          vat_cents: number
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string
          credited_cents?: number
          cu_invoice_number?: string | null
          cu_serial?: string | null
          due_date?: string | null
          fiscalized_at?: string | null
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          notes?: string | null
          number: string
          org_id: string
          paid_cents?: number
          qr_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tenant_id?: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id?: string | null
          updated_at?: string | null
          vat_cents?: number
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string
          credited_cents?: number
          cu_invoice_number?: string | null
          cu_serial?: string | null
          due_date?: string | null
          fiscalized_at?: string | null
          id?: string
          issue_date?: string
          journal_entry_id?: string | null
          notes?: string | null
          number?: string
          org_id?: string
          paid_cents?: number
          qr_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tenant_id?: string | null
          total_cents?: number
          type?: Database["public"]["Enums"]["document_type"]
          unit_id?: string | null
          updated_at?: string | null
          vat_cents?: number
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
          invoice_due_offset_days: number
          next_invoice_date: string | null
          org_id: string
          rent_amount_cents: number
          rent_frequency: Database["public"]["Enums"]["billing_frequency"]
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
          invoice_due_offset_days?: number
          next_invoice_date?: string | null
          org_id: string
          rent_amount_cents: number
          rent_frequency?: Database["public"]["Enums"]["billing_frequency"]
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
          invoice_due_offset_days?: number
          next_invoice_date?: string | null
          org_id?: string
          rent_amount_cents?: number
          rent_frequency?: Database["public"]["Enums"]["billing_frequency"]
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
      maintenance_requests: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string
          description: string | null
          id: string
          org_id: string
          priority: Database["public"]["Enums"]["maintenance_priority"]
          raised_by_user_id: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          tenant_id: string | null
          title: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          org_id: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          raised_by_user_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          org_id?: string
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          raised_by_user_id?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          tenant_id?: string | null
          title?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      move_checklist_items: {
        Row: {
          checked: boolean
          checklist_id: string
          created_at: string
          id: string
          label: string
          notes: string | null
          org_id: string
          photo_url: string | null
        }
        Insert: {
          checked?: boolean
          checklist_id: string
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          org_id: string
          photo_url?: string | null
        }
        Update: {
          checked?: boolean
          checklist_id?: string
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          org_id?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "move_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_checklist_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      move_checklists: {
        Row: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          lease_id: string
          org_id: string
          status: Database["public"]["Enums"]["checklist_status"]
          type: Database["public"]["Enums"]["checklist_type"]
        }
        Insert: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          lease_id: string
          org_id: string
          status?: Database["public"]["Enums"]["checklist_status"]
          type: Database["public"]["Enums"]["checklist_type"]
        }
        Update: {
          completed_at?: string | null
          completed_by_user_id?: string | null
          created_at?: string
          id?: string
          lease_id?: string
          org_id?: string
          status?: Database["public"]["Enums"]["checklist_status"]
          type?: Database["public"]["Enums"]["checklist_type"]
        }
        Relationships: [
          {
            foreignKeyName: "move_checklists_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_checklists_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nodus_billing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          cycle: string
          failed_reason: string | null
          id: string
          org_id: string
          phone: string | null
          plan: string
          provider_ref: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          cycle: string
          failed_reason?: string | null
          id?: string
          org_id: string
          phone?: string | null
          plan: string
          provider_ref?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          cycle?: string
          failed_reason?: string | null
          id?: string
          org_id?: string
          phone?: string | null
          plan?: string
          provider_ref?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodus_billing_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nodus_subscriptions: {
        Row: {
          created_at: string
          org_id: string
          paid_until: string
          plan: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          org_id: string
          paid_until?: string
          plan?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          org_id?: string
          paid_until?: string
          plan?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nodus_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
          kra_pin: string | null
          name: string
          slug: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string | null
          vat_registered: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kra_pin?: string | null
          name: string
          slug: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string | null
          vat_registered?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kra_pin?: string | null
          name?: string
          slug?: string
          type?: Database["public"]["Enums"]["org_type"]
          updated_at?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          account_ref: string | null
          amount_cents: number
          created_at: string
          direction: Database["public"]["Enums"]["payment_direction"]
          gateway_id: string
          id: string
          matched_document_id: string | null
          org_id: string
          payer_name: string | null
          payer_phone: string | null
          payment_id: string | null
          provider_ref: string
          raw_json: Json | null
          status: string
        }
        Insert: {
          account_ref?: string | null
          amount_cents: number
          created_at?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          gateway_id: string
          id?: string
          matched_document_id?: string | null
          org_id: string
          payer_name?: string | null
          payer_phone?: string | null
          payment_id?: string | null
          provider_ref: string
          raw_json?: Json | null
          status?: string
        }
        Update: {
          account_ref?: string | null
          amount_cents?: number
          created_at?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          gateway_id?: string
          id?: string
          matched_document_id?: string | null
          org_id?: string
          payer_name?: string | null
          payer_phone?: string | null
          payment_id?: string | null
          provider_ref?: string
          raw_json?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_matched_document_id_fkey"
            columns: ["matched_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_gateways: {
        Row: {
          c2b_registered_at: string | null
          config_json: string | null
          created_at: string
          enabled: boolean
          environment: string
          gateway_id: string
          id: string
          org_id: string
          updated_at: string | null
          webhook_secret: string | null
        }
        Insert: {
          c2b_registered_at?: string | null
          config_json?: string | null
          created_at?: string
          enabled?: boolean
          environment?: string
          gateway_id: string
          id?: string
          org_id: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Update: {
          c2b_registered_at?: string | null
          config_json?: string | null
          created_at?: string
          enabled?: boolean
          environment?: string
          gateway_id?: string
          id?: string
          org_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_gateways_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      payout_recipients: {
        Row: {
          created_at: string
          destination: string
          gateway_id: string
          id: string
          org_id: string
          provider_ref: string
        }
        Insert: {
          created_at?: string
          destination: string
          gateway_id: string
          id?: string
          org_id: string
          provider_ref: string
        }
        Update: {
          created_at?: string
          destination?: string
          gateway_id?: string
          id?: string
          org_id?: string
          provider_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_recipients_org_id_fkey"
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
      receipt_tokens: {
        Row: {
          created_at: string
          id: string
          org_id: string
          payment_id: string
          revoked: boolean
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          payment_id: string
          revoked?: boolean
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          payment_id?: string
          revoked?: boolean
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_tokens_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_log: {
        Row: {
          created_at: string
          document_id: string | null
          error: string | null
          id: string
          kind: string
          message: string
          org_id: string
          payment_id: string | null
          phone: string
          provider_ref: string | null
          sent_date: string
          status: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          error?: string | null
          id?: string
          kind: string
          message?: string
          org_id: string
          payment_id?: string | null
          phone?: string
          provider_ref?: string | null
          sent_date?: string
          status?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          error?: string | null
          id?: string
          kind?: string
          message?: string
          org_id?: string
          payment_id?: string | null
          phone?: string
          provider_ref?: string | null
          sent_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_log_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_settings: {
        Row: {
          config_json: string | null
          created_at: string
          enabled: boolean
          org_id: string
          provider: string
          updated_at: string | null
        }
        Insert: {
          config_json?: string | null
          created_at?: string
          enabled?: boolean
          org_id: string
          provider?: string
          updated_at?: string | null
        }
        Update: {
          config_json?: string | null
          created_at?: string
          enabled?: boolean
          org_id?: string
          provider?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
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
          is_commercial: boolean
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
          is_commercial?: boolean
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
          is_commercial?: boolean
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
      _absorb_rounding_unchecked: {
        Args: {
          p_cost_center_id: string
          p_date: string
          p_diff_cents: number
          p_org_id: string
          p_provider_ref: string
        }
        Returns: undefined
      }
      _issue_rent_invoice_unchecked: {
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
          cu_invoice_number: string | null
          cu_serial: string | null
          due_date: string | null
          fiscalized_at: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          org_id: string
          paid_cents: number
          qr_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
          vat_cents: number
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _post_entry_unchecked: {
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
      _simulated_etims_sign: {
        Args: {
          p_date: string
          p_invoice_number: string
          p_seller_pin: string
          p_total_cents: number
          p_vat_cents: number
        }
        Returns: {
          cu_invoice_number: string
          cu_serial: string
          qr_url: string
        }[]
      }
      advance_date: {
        Args: {
          p_date: string
          p_frequency: Database["public"]["Enums"]["billing_frequency"]
        }
        Returns: string
      }
      apply_gateway_payment: {
        Args: {
          p_account_ref: string
          p_amount_cents: number
          p_gateway_id: string
          p_org_id: string
          p_payer_name: string
          p_payer_phone: string
          p_provider_ref: string
          p_raw: Json
          p_request_ref: string
        }
        Returns: {
          account_ref: string | null
          amount_cents: number
          created_at: string
          direction: Database["public"]["Enums"]["payment_direction"]
          gateway_id: string
          id: string
          matched_document_id: string | null
          org_id: string
          payer_name: string | null
          payer_phone: string | null
          payment_id: string | null
          provider_ref: string
          raw_json: Json | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_nodus_billing_payment: {
        Args: { p_payment_id: string }
        Returns: boolean
      }
      claim_tenant_record: {
        Args: { p_org_slug: string; p_phone: string }
        Returns: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          org_id: string
          phone: string | null
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      collect_deposit: {
        Args: {
          p_amount_cents: number
          p_date: string
          p_lease_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: {
          amount_cents: number
          collected_date: string
          collection_journal_entry_id: string | null
          created_at: string
          forfeited_cents: number
          id: string
          lease_id: string
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          refund_date: string | null
          refund_journal_entry_id: string | null
          refund_notes: string | null
          refunded_cents: number
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_move_checklist: {
        Args: { p_checklist_id: string }
        Returns: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          lease_id: string
          org_id: string
          status: Database["public"]["Enums"]["checklist_status"]
          type: Database["public"]["Enums"]["checklist_type"]
        }
        SetofOptions: {
          from: "*"
          to: "move_checklists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_move_checklist: {
        Args: {
          p_lease_id: string
          p_org_id: string
          p_type: Database["public"]["Enums"]["checklist_type"]
        }
        Returns: {
          completed_at: string | null
          completed_by_user_id: string | null
          created_at: string
          id: string
          lease_id: string
          org_id: string
          status: Database["public"]["Enums"]["checklist_status"]
          type: Database["public"]["Enums"]["checklist_type"]
        }
        SetofOptions: {
          from: "*"
          to: "move_checklists"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_organization: {
        Args: {
          org_name: string
          org_type?: Database["public"]["Enums"]["org_type"]
        }
        Returns: {
          created_at: string
          id: string
          kra_pin: string | null
          name: string
          slug: string
          type: Database["public"]["Enums"]["org_type"]
          updated_at: string | null
          vat_registered: boolean
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      end_lease: {
        Args: {
          p_end_date: string
          p_lease_id: string
          p_status: Database["public"]["Enums"]["lease_status"]
        }
        Returns: {
          created_at: string
          deposit_amount_cents: number
          end_date: string | null
          id: string
          invoice_due_offset_days: number
          next_invoice_date: string | null
          org_id: string
          rent_amount_cents: number
          rent_frequency: Database["public"]["Enums"]["billing_frequency"]
          start_date: string
          status: Database["public"]["Enums"]["lease_status"]
          tenant_id: string
          unit_id: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "leases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fiscalize_document: {
        Args: { p_document_id: string }
        Returns: {
          cost_center_id: string | null
          created_at: string
          credited_cents: number
          cu_invoice_number: string | null
          cu_serial: string | null
          due_date: string | null
          fiscalized_at: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          org_id: string
          paid_cents: number
          qr_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
          vat_cents: number
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_due_rent_invoices: {
        Args: { p_cap?: number; p_org_id?: string }
        Returns: {
          document_id: string
          issued_date: string
          lease_id: string
        }[]
      }
      get_account_id: {
        Args: { p_code: string; p_org_id: string }
        Returns: string
      }
      get_org_public_info: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
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
          cu_invoice_number: string | null
          cu_serial: string | null
          due_date: string | null
          fiscalized_at: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          org_id: string
          paid_cents: number
          qr_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
          vat_cents: number
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pay_bill: {
        Args: {
          p_amount_cents: number
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
      record_expense: {
        Args: {
          p_amount_cents: number
          p_cost_center_id?: string
          p_date: string
          p_expense_account_code: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_org_id: string
          p_paid?: boolean
          p_vendor_name: string
        }
        Returns: {
          cost_center_id: string | null
          created_at: string
          credited_cents: number
          cu_invoice_number: string | null
          cu_serial: string | null
          due_date: string | null
          fiscalized_at: string | null
          id: string
          issue_date: string
          journal_entry_id: string | null
          notes: string | null
          number: string
          org_id: string
          paid_cents: number
          qr_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          tenant_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["document_type"]
          unit_id: string | null
          updated_at: string | null
          vat_cents: number
        }
        SetofOptions: {
          from: "*"
          to: "documents"
          isOneToOne: true
          isSetofReturn: false
        }
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
      refund_deposit: {
        Args: {
          p_date: string
          p_deposit_id: string
          p_forfeit_cents: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes: string
          p_refund_cents: number
        }
        Returns: {
          amount_cents: number
          collected_date: string
          collection_journal_entry_id: string | null
          created_at: string
          forfeited_cents: number
          id: string
          lease_id: string
          method: Database["public"]["Enums"]["payment_method"]
          org_id: string
          refund_date: string | null
          refund_journal_entry_id: string | null
          refund_notes: string | null
          refunded_cents: number
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deposits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_balance_sheet: {
        Args: { p_as_of: string; p_org_id: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance_cents: number
        }[]
      }
      report_general_ledger: {
        Args: {
          p_account_id: string
          p_end: string
          p_org_id: string
          p_start: string
        }
        Returns: {
          credit_cents: number
          debit_cents: number
          entry_date: string
          memo: string
          running_balance_cents: number
        }[]
      }
      report_monthly_rental_income_tax: {
        Args: { p_month: number; p_org_id: string; p_year: number }
        Returns: {
          gross_rent_received_cents: number
          payment_count: number
          tax_due_cents: number
        }[]
      }
      report_profit_and_loss: {
        Args: { p_end: string; p_org_id: string; p_start: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          amount_cents: number
        }[]
      }
      report_trial_balance: {
        Args: { p_as_of: string; p_org_id: string }
        Returns: {
          account_code: string
          account_name: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance_cents: number
        }[]
      }
      report_vat_output: {
        Args: { p_month: number; p_org_id: string; p_year: number }
        Returns: {
          invoice_count: number
          vat_output_cents: number
        }[]
      }
      request_gateway_payment: {
        Args: {
          p_account_ref: string
          p_amount_cents: number
          p_gateway_id: string
          p_matched_document_id?: string
          p_org_id: string
          p_provider_ref: string
        }
        Returns: {
          account_ref: string | null
          amount_cents: number
          created_at: string
          direction: Database["public"]["Enums"]["payment_direction"]
          gateway_id: string
          id: string
          matched_document_id: string | null
          org_id: string
          payer_name: string | null
          payer_phone: string | null
          payment_id: string | null
          provider_ref: string
          raw_json: Json | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "payment_events"
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
      slugify: { Args: { p_text: string }; Returns: string }
      user_org_ids: { Args: never; Returns: string[] }
      user_org_ids_financial: { Args: never; Returns: string[] }
      user_org_ids_with_role: {
        Args: { roles: Database["public"]["Enums"]["org_role"][] }
        Returns: string[]
      }
      user_tenant_deposit_ids: { Args: never; Returns: string[] }
      user_tenant_document_ids: { Args: never; Returns: string[] }
      user_tenant_ids: { Args: never; Returns: string[] }
      user_tenant_property_ids: { Args: never; Returns: string[] }
      user_tenant_unit_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      bank_account_kind: "bank" | "mpesa" | "cash"
      billing_frequency: "weekly" | "monthly" | "quarterly" | "yearly"
      checklist_status: "pending" | "completed"
      checklist_type: "move_in" | "move_out"
      deposit_status: "held" | "partially_refunded" | "refunded" | "forfeited"
      document_status: "open" | "partial" | "paid" | "void"
      document_type: "rent_invoice" | "credit_note" | "bill" | "expense"
      lease_status: "active" | "ended" | "terminated"
      maintenance_priority: "normal" | "urgent"
      maintenance_status: "open" | "in_progress" | "resolved" | "closed"
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
      billing_frequency: ["weekly", "monthly", "quarterly", "yearly"],
      checklist_status: ["pending", "completed"],
      checklist_type: ["move_in", "move_out"],
      deposit_status: ["held", "partially_refunded", "refunded", "forfeited"],
      document_status: ["open", "partial", "paid", "void"],
      document_type: ["rent_invoice", "credit_note", "bill", "expense"],
      lease_status: ["active", "ended", "terminated"],
      maintenance_priority: ["normal", "urgent"],
      maintenance_status: ["open", "in_progress", "resolved", "closed"],
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
