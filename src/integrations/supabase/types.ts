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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      accessories: {
        Row: {
          active: boolean
          code: string
          description: string
          reorder_level: number
          stock_on_hand: number
        }
        Insert: {
          active?: boolean
          code: string
          description: string
          reorder_level?: number
          stock_on_hand?: number
        }
        Update: {
          active?: boolean
          code?: string
          description?: string
          reorder_level?: number
          stock_on_hand?: number
        }
        Relationships: []
      }
      accessory_usage: {
        Row: {
          accessory_code: string
          id: string
          project_id: string
          qty_used: number
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          accessory_code: string
          id?: string
          project_id: string
          qty_used?: number
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          accessory_code?: string
          id?: string
          project_id?: string
          qty_used?: number
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessory_usage_accessory_code_fkey"
            columns: ["accessory_code"]
            isOneToOne: false
            referencedRelation: "accessories"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accessory_usage_accessory_code_fkey"
            columns: ["accessory_code"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "accessory_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessory_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "accessory_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "accessory_usage_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "accessory_usage_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_users: {
        Row: {
          auth_user_id: string | null
          can_call: boolean
          created_at: string
          display_name: string
          email: string | null
          handle: string
          id: string
          is_active: boolean
          timezone: string
        }
        Insert: {
          auth_user_id?: string | null
          can_call?: boolean
          created_at?: string
          display_name: string
          email?: string | null
          handle: string
          id?: string
          is_active?: boolean
          timezone?: string
        }
        Update: {
          auth_user_id?: string | null
          can_call?: boolean
          created_at?: string
          display_name?: string
          email?: string | null
          handle?: string
          id?: string
          is_active?: boolean
          timezone?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          comment_id: string | null
          file_name: string
          id: string
          mime_type: string | null
          onedrive_item_id: string
          onedrive_web_url: string | null
          size_bytes: number | null
          task_id: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          comment_id?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          onedrive_item_id: string
          onedrive_web_url?: string | null
          size_bytes?: number | null
          task_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          comment_id?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          onedrive_item_id?: string
          onedrive_web_url?: string | null
          size_bytes?: number | null
          task_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calc_cells: {
        Row: {
          col_key: string
          computed_value: number | null
          formula: string | null
          id: string
          row_key: string
          table_key: string
          task_id: string
          updated_at: string
        }
        Insert: {
          col_key: string
          computed_value?: number | null
          formula?: string | null
          id?: string
          row_key: string
          table_key: string
          task_id: string
          updated_at?: string
        }
        Update: {
          col_key?: string
          computed_value?: number | null
          formula?: string | null
          id?: string
          row_key?: string
          table_key?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calc_cells_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calc_cells_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          mentions: string[] | null
          task_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          task_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_placeholders: {
        Row: {
          created_at: string
          note: string | null
          value: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          value: string
        }
        Update: {
          created_at?: string
          note?: string | null
          value?: string
        }
        Relationships: []
      }
      contact_role_scores: {
        Row: {
          is_active: boolean
          label: string
          match_text: string
          score: number
        }
        Insert: {
          is_active?: boolean
          label: string
          match_text: string
          score: number
        }
        Update: {
          is_active?: boolean
          label?: string
          match_text?: string
          score?: number
        }
        Relationships: []
      }
      contacts: {
        Row: {
          apollo_contact_id: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean
          is_primary: boolean
          last_name: string | null
          mobile: string | null
          notes: string | null
          organisation_id: string
          phone: string | null
          role: string | null
          updated_at: string
          zoho_contact_id: string | null
        }
        Insert: {
          apollo_contact_id?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          organisation_id: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          zoho_contact_id?: string | null
        }
        Update: {
          apollo_contact_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          organisation_id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
          zoho_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage: string | null
          id: number
          note: string | null
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage?: string | null
          id?: number
          note?: string | null
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage?: string | null
          id?: number
          note?: string | null
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_missing_from_zoho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_stale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_fk"
            columns: ["from_stage"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deal_stage_history_from_fk"
            columns: ["from_stage"]
            isOneToOne: false
            referencedRelation: "v_deals_pipeline_summary"
            referencedColumns: ["stage"]
          },
          {
            foreignKeyName: "deal_stage_history_to_fk"
            columns: ["to_stage"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deal_stage_history_to_fk"
            columns: ["to_stage"]
            isOneToOne: false
            referencedRelation: "v_deals_pipeline_summary"
            referencedColumns: ["stage"]
          },
        ]
      }
      deal_stages: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          is_open: boolean
          is_terminal: boolean
          is_won: boolean
          label: string
          prior_work_state: string
          retired_at: string | null
          sort_order: number
          stale_after_days: number | null
          staleness_exempt: boolean
          updated_at: string
          zoho_value: string | null
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          is_open?: boolean
          is_terminal?: boolean
          is_won?: boolean
          label: string
          prior_work_state: string
          retired_at?: string | null
          sort_order?: number
          stale_after_days?: number | null
          staleness_exempt?: boolean
          updated_at?: string
          zoho_value?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          is_open?: boolean
          is_terminal?: boolean
          is_won?: boolean
          label?: string
          prior_work_state?: string
          retired_at?: string | null
          sort_order?: number
          stale_after_days?: number | null
          staleness_exempt?: boolean
          updated_at?: string
          zoho_value?: string | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          closing_date: string | null
          contract_value: number
          converted_from_lead_id: string | null
          created_at: string
          current_inventory: string | null
          deal_number: string | null
          follow_up_date: string | null
          id: string
          is_split_parent: boolean
          is_variation: boolean
          kind: Database["public"]["Enums"]["deal_kind"]
          last_activity_at: string | null
          last_seen_at: string | null
          loss_notes: string | null
          loss_reason: string | null
          lost_at: string | null
          name: string
          next_step: string | null
          organisation_id: string | null
          original_contract_value: number | null
          owner_email: string | null
          parent_deal_id: string | null
          pipeline: string | null
          primary_contact_id: string | null
          project_id: string | null
          root_deal_id: string | null
          scope_of_works: string | null
          source_company: string | null
          source_contact_name: string | null
          source_system: string
          stage: string
          stage_modified_at: string | null
          stage_number: number | null
          total_costs: number | null
          updated_at: string
          variation_of_deal_id: string | null
          zoho_id: string | null
        }
        Insert: {
          closing_date?: string | null
          contract_value?: number
          converted_from_lead_id?: string | null
          created_at?: string
          current_inventory?: string | null
          deal_number?: string | null
          follow_up_date?: string | null
          id?: string
          is_split_parent?: boolean
          is_variation?: boolean
          kind?: Database["public"]["Enums"]["deal_kind"]
          last_activity_at?: string | null
          last_seen_at?: string | null
          loss_notes?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          name: string
          next_step?: string | null
          organisation_id?: string | null
          original_contract_value?: number | null
          owner_email?: string | null
          parent_deal_id?: string | null
          pipeline?: string | null
          primary_contact_id?: string | null
          project_id?: string | null
          root_deal_id?: string | null
          scope_of_works?: string | null
          source_company?: string | null
          source_contact_name?: string | null
          source_system?: string
          stage?: string
          stage_modified_at?: string | null
          stage_number?: number | null
          total_costs?: number | null
          updated_at?: string
          variation_of_deal_id?: string | null
          zoho_id?: string | null
        }
        Update: {
          closing_date?: string | null
          contract_value?: number
          converted_from_lead_id?: string | null
          created_at?: string
          current_inventory?: string | null
          deal_number?: string | null
          follow_up_date?: string | null
          id?: string
          is_split_parent?: boolean
          is_variation?: boolean
          kind?: Database["public"]["Enums"]["deal_kind"]
          last_activity_at?: string | null
          last_seen_at?: string | null
          loss_notes?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          name?: string
          next_step?: string | null
          organisation_id?: string | null
          original_contract_value?: number | null
          owner_email?: string | null
          parent_deal_id?: string | null
          pipeline?: string | null
          primary_contact_id?: string | null
          project_id?: string | null
          root_deal_id?: string | null
          scope_of_works?: string | null
          source_company?: string | null
          source_contact_name?: string | null
          source_system?: string
          stage?: string
          stage_modified_at?: string | null
          stage_number?: number | null
          total_costs?: number | null
          updated_at?: string
          variation_of_deal_id?: string | null
          zoho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_converted_from_lead_id_fkey"
            columns: ["converted_from_lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "deals_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_missing_from_zoho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_parent_deal_id_fkey"
            columns: ["parent_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_stale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "v_contacts_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "deals_root_deal_id_fkey"
            columns: ["root_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_root_deal_id_fkey"
            columns: ["root_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_root_deal_id_fkey"
            columns: ["root_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_missing_from_zoho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_root_deal_id_fkey"
            columns: ["root_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_stale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "v_deals_pipeline_summary"
            referencedColumns: ["stage"]
          },
          {
            foreignKeyName: "deals_variation_of_deal_id_fkey"
            columns: ["variation_of_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_variation_of_deal_id_fkey"
            columns: ["variation_of_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_variation_of_deal_id_fkey"
            columns: ["variation_of_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_missing_from_zoho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_variation_of_deal_id_fkey"
            columns: ["variation_of_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_stale"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_rates: {
        Row: {
          effective_from: string
          hourly_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          effective_from?: string
          hourly_rate: number
          updated_at?: string
          user_id: string
        }
        Update: {
          effective_from?: string
          hourly_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          breakdown_id: string | null
          id: string
          invoice_id: string
          kind: string
          location: string | null
          product_code: string | null
          qty: number
          rate: number
          worker_id: string | null
        }
        Insert: {
          amount?: number
          breakdown_id?: string | null
          id?: string
          invoice_id: string
          kind: string
          location?: string | null
          product_code?: string | null
          qty?: number
          rate?: number
          worker_id?: string | null
        }
        Update: {
          amount?: number
          breakdown_id?: string | null
          id?: string
          invoice_id?: string
          kind?: string
          location?: string | null
          product_code?: string | null
          qty?: number
          rate?: number
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_breakdown_id_fkey"
            columns: ["breakdown_id"]
            isOneToOne: false
            referencedRelation: "scope_breakdown"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          gst: number
          id: string
          invoice_date: string | null
          invoice_number: string | null
          paid_date: string | null
          part_number: number | null
          period_end: string
          period_start: string
          project_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          task_id: string | null
          total: number
          xero_invoice_id: string | null
        }
        Insert: {
          created_at?: string
          gst?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_date?: string | null
          part_number?: number | null
          period_end: string
          period_start: string
          project_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          task_id?: string | null
          total?: number
          xero_invoice_id?: string | null
        }
        Update: {
          created_at?: string
          gst?: number
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          paid_date?: string | null
          part_number?: number | null
          period_end?: string
          period_start?: string
          project_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          task_id?: string | null
          total?: number
          xero_invoice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_call_outcomes: {
        Row: {
          code: string
          is_active: boolean
          is_contact: boolean
          label: string
          retired_at: string | null
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          is_contact?: boolean
          label: string
          retired_at?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          is_contact?: boolean
          label?: string
          retired_at?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      lead_calls: {
        Row: {
          actor_id: string | null
          addressing_variant: string | null
          callback_at: string | null
          called_at: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          lead_id: string
          notes: string | null
          outcome_code: string
          sentiment: string | null
          spoke_with: string | null
        }
        Insert: {
          actor_id?: string | null
          addressing_variant?: string | null
          callback_at?: string | null
          called_at?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id: string
          notes?: string | null
          outcome_code: string
          sentiment?: string | null
          spoke_with?: string | null
        }
        Update: {
          actor_id?: string | null
          addressing_variant?: string | null
          callback_at?: string | null
          called_at?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id?: string
          notes?: string | null
          outcome_code?: string
          sentiment?: string | null
          spoke_with?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_calls_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_outcome_code_fkey"
            columns: ["outcome_code"]
            isOneToOne: false
            referencedRelation: "lead_call_outcomes"
            referencedColumns: ["code"]
          },
        ]
      }
      lead_claims: {
        Row: {
          actor_id: string
          claimed_at: string
          heartbeat_at: string
          lead_id: string
        }
        Insert: {
          actor_id: string
          claimed_at?: string
          heartbeat_at?: string
          lead_id: string
        }
        Update: {
          actor_id?: string
          claimed_at?: string
          heartbeat_at?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_claims_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_claims_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_event_kinds: {
        Row: {
          is_metric: boolean
          kind: string
          label: string
          sort_order: number
        }
        Insert: {
          is_metric?: boolean
          kind: string
          label: string
          sort_order?: number
        }
        Update: {
          is_metric?: boolean
          kind?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          actor_id: string | null
          created_by: string | null
          detail: string | null
          external_id: string | null
          id: number
          kind: string
          lead_id: string
          occurred_at: string
          recipient_email: string | null
        }
        Insert: {
          actor_id?: string | null
          created_by?: string | null
          detail?: string | null
          external_id?: string | null
          id?: number
          kind: string
          lead_id: string
          occurred_at?: string
          recipient_email?: string | null
        }
        Update: {
          actor_id?: string | null
          created_by?: string | null
          detail?: string | null
          external_id?: string | null
          id?: number
          kind?: string
          lead_id?: string
          occurred_at?: string
          recipient_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_import_batches: {
        Row: {
          committed_at: string | null
          committed_by: string | null
          file_name: string
          id: string
          notes: string | null
          source_label: string
          status: string
          total_rows: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          committed_at?: string | null
          committed_by?: string | null
          file_name: string
          id?: string
          notes?: string | null
          source_label?: string
          status?: string
          total_rows?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          committed_at?: string | null
          committed_by?: string | null
          file_name?: string
          id?: string
          notes?: string | null
          source_label?: string
          status?: string
          total_rows?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      lead_import_rows: {
        Row: {
          batch_id: string
          category: string | null
          company_builder: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string
          dup_detail: string | null
          dup_lead_id: string | null
          dup_score: number | null
          dup_status: string
          id: string
          imported_lead_id: string | null
          notes: string | null
          project_name: string | null
          raw: Json | null
          row_number: number | null
          site_address: string | null
          state: string | null
        }
        Insert: {
          batch_id: string
          category?: string | null
          company_builder?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          dup_detail?: string | null
          dup_lead_id?: string | null
          dup_score?: number | null
          dup_status?: string
          id?: string
          imported_lead_id?: string | null
          notes?: string | null
          project_name?: string | null
          raw?: Json | null
          row_number?: number | null
          site_address?: string | null
          state?: string | null
        }
        Update: {
          batch_id?: string
          category?: string | null
          company_builder?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string
          dup_detail?: string | null
          dup_lead_id?: string | null
          dup_score?: number | null
          dup_status?: string
          id?: string
          imported_lead_id?: string | null
          notes?: string | null
          project_name?: string | null
          raw?: Json | null
          row_number?: number | null
          site_address?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_dup_lead_id_fkey"
            columns: ["dup_lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_import_rows_imported_lead_id_fkey"
            columns: ["imported_lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_next_steps: {
        Row: {
          applies_to_stage: Database["public"]["Enums"]["lead_stage"] | null
          code: string
          created_at: string
          creates_task_kind: string | null
          enters_crm: boolean
          follow_up_days: number | null
          is_active: boolean
          is_enrichment: boolean
          is_system: boolean
          label: string
          moves_to_stage: Database["public"]["Enums"]["lead_stage"] | null
          requires_contact_name: boolean
          requires_conversation: boolean
          requires_email: boolean
          requires_follow_up_date: boolean
          requires_note: boolean
          requires_scheduled_date: boolean
          requires_state: boolean
          retired_at: string | null
          sends_email: boolean
          sheet_value: string | null
          sort_order: number
          zoho_status: string | null
        }
        Insert: {
          applies_to_stage?: Database["public"]["Enums"]["lead_stage"] | null
          code: string
          created_at?: string
          creates_task_kind?: string | null
          enters_crm?: boolean
          follow_up_days?: number | null
          is_active?: boolean
          is_enrichment?: boolean
          is_system?: boolean
          label: string
          moves_to_stage?: Database["public"]["Enums"]["lead_stage"] | null
          requires_contact_name?: boolean
          requires_conversation?: boolean
          requires_email?: boolean
          requires_follow_up_date?: boolean
          requires_note?: boolean
          requires_scheduled_date?: boolean
          requires_state?: boolean
          retired_at?: string | null
          sends_email?: boolean
          sheet_value?: string | null
          sort_order?: number
          zoho_status?: string | null
        }
        Update: {
          applies_to_stage?: Database["public"]["Enums"]["lead_stage"] | null
          code?: string
          created_at?: string
          creates_task_kind?: string | null
          enters_crm?: boolean
          follow_up_days?: number | null
          is_active?: boolean
          is_enrichment?: boolean
          is_system?: boolean
          label?: string
          moves_to_stage?: Database["public"]["Enums"]["lead_stage"] | null
          requires_contact_name?: boolean
          requires_conversation?: boolean
          requires_email?: boolean
          requires_follow_up_date?: boolean
          requires_note?: boolean
          requires_scheduled_date?: boolean
          requires_state?: boolean
          retired_at?: string | null
          sends_email?: boolean
          sheet_value?: string | null
          sort_order?: number
          zoho_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_next_steps_task_kind_fk"
            columns: ["creates_task_kind"]
            isOneToOne: false
            referencedRelation: "lead_task_kinds"
            referencedColumns: ["kind"]
          },
        ]
      }
      lead_purge_tombstones: {
        Row: {
          company_builder: string | null
          project_name: string | null
          purged_at: string
          purged_by: string | null
          reason: string | null
          source_row_key: string
        }
        Insert: {
          company_builder?: string | null
          project_name?: string | null
          purged_at?: string
          purged_by?: string | null
          reason?: string | null
          source_row_key: string
        }
        Update: {
          company_builder?: string | null
          project_name?: string | null
          purged_at?: string
          purged_by?: string | null
          reason?: string | null
          source_row_key?: string
        }
        Relationships: []
      }
      lead_rating_bands: {
        Row: {
          code: string
          colour: string | null
          created_at: string
          definition: string
          is_active: boolean
          label: string
          max_score: number
          min_score: number
          retired_at: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          colour?: string | null
          created_at?: string
          definition: string
          is_active?: boolean
          label: string
          max_score: number
          min_score: number
          retired_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          colour?: string | null
          created_at?: string
          definition?: string
          is_active?: boolean
          label?: string
          max_score?: number
          min_score?: number
          retired_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_rating_history: {
        Row: {
          band: string
          computed_at: string
          id: number
          lead_id: string
          model: string | null
          next_best_action: string | null
          previous_score: number | null
          reason: string | null
          score: number
          signals: Json | null
          triggered_by: string | null
        }
        Insert: {
          band: string
          computed_at?: string
          id?: number
          lead_id: string
          model?: string | null
          next_best_action?: string | null
          previous_score?: number | null
          reason?: string | null
          score: number
          signals?: Json | null
          triggered_by?: string | null
        }
        Update: {
          band?: string
          computed_at?: string
          id?: number
          lead_id?: string
          model?: string | null
          next_best_action?: string | null
          previous_score?: number | null
          reason?: string | null
          score?: number
          signals?: Json | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_rating_history_band_fkey"
            columns: ["band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_silence_rules: {
        Row: {
          action_prompt: string | null
          auto_stage: Database["public"]["Enums"]["lead_stage"] | null
          cap_band_code: string | null
          code: string
          created_at: string
          days_silent_min: number
          is_active: boolean
          label: string
          penalty_points: number
          retired_at: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          action_prompt?: string | null
          auto_stage?: Database["public"]["Enums"]["lead_stage"] | null
          cap_band_code?: string | null
          code: string
          created_at?: string
          days_silent_min: number
          is_active?: boolean
          label: string
          penalty_points?: number
          retired_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          action_prompt?: string | null
          auto_stage?: Database["public"]["Enums"]["lead_stage"] | null
          cap_band_code?: string | null
          code?: string
          created_at?: string
          days_silent_min?: number
          is_active?: boolean
          label?: string
          penalty_points?: number
          retired_at?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_silence_rules_cap_band_code_fkey"
            columns: ["cap_band_code"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
        ]
      }
      lead_sources: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          label: string
          retired_at: string | null
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          label: string
          retired_at?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          label?: string
          retired_at?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      lead_statuses: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          is_terminal: boolean
          label: string
          pipeline_group: string | null
          retired_at: string | null
          sort_order: number
          zoho_count: number | null
          zoho_value: string | null
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          is_terminal?: boolean
          label: string
          pipeline_group?: string | null
          retired_at?: string | null
          sort_order?: number
          zoho_count?: number | null
          zoho_value?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          is_terminal?: boolean
          label?: string
          pipeline_group?: string | null
          retired_at?: string | null
          sort_order?: number
          zoho_count?: number | null
          zoho_value?: string | null
        }
        Relationships: []
      }
      lead_tags: {
        Row: {
          colour: string | null
          created_at: string
          is_active: boolean
          label: string | null
          tag: string
          use_count: number
        }
        Insert: {
          colour?: string | null
          created_at?: string
          is_active?: boolean
          label?: string | null
          tag: string
          use_count?: number
        }
        Update: {
          colour?: string | null
          created_at?: string
          is_active?: boolean
          label?: string | null
          tag?: string
          use_count?: number
        }
        Relationships: []
      }
      lead_task_kinds: {
        Row: {
          cancels_on_reply: boolean
          created_at: string
          days_from_eoi: number | null
          description: string | null
          is_active: boolean
          is_sequence: boolean
          kind: string
          label: string
          sequence_position: number | null
          sort_order: number
        }
        Insert: {
          cancels_on_reply?: boolean
          created_at?: string
          days_from_eoi?: number | null
          description?: string | null
          is_active?: boolean
          is_sequence?: boolean
          kind: string
          label: string
          sequence_position?: number | null
          sort_order?: number
        }
        Update: {
          cancels_on_reply?: boolean
          created_at?: string
          days_from_eoi?: number | null
          description?: string | null
          is_active?: boolean
          is_sequence?: boolean
          kind?: string
          label?: string
          sequence_position?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      lead_tasks: {
        Row: {
          assigned_to: string | null
          auto_generated: boolean
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          kind: string
          lead_id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          auto_generated?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          kind?: string
          lead_id: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          auto_generated?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          kind?: string
          lead_id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_kind_fk"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "lead_task_kinds"
            referencedColumns: ["kind"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_templates: {
        Row: {
          body_html: string
          channel: string
          created_at: string
          id: string
          is_active: boolean
          next_step_code: string
          send_mode: string
          send_to: string
          state: string | null
          subject: string
          updated_at: string
          who_spoke_code: string | null
        }
        Insert: {
          body_html: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          next_step_code: string
          send_mode?: string
          send_to?: string
          state?: string | null
          subject: string
          updated_at?: string
          who_spoke_code?: string | null
        }
        Update: {
          body_html?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          next_step_code?: string
          send_mode?: string
          send_to?: string
          state?: string | null
          subject?: string
          updated_at?: string
          who_spoke_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_templates_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lead_templates_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lead_templates_who_spoke_code_fkey"
            columns: ["who_spoke_code"]
            isOneToOne: false
            referencedRelation: "lead_who_spoke"
            referencedColumns: ["code"]
          },
        ]
      }
      lead_who_spoke: {
        Row: {
          code: string
          is_active: boolean
          label: string
          reached_contact: boolean
          retired_at: string | null
          sort_order: number
        }
        Insert: {
          code: string
          is_active?: boolean
          label: string
          reached_contact?: boolean
          retired_at?: string | null
          sort_order?: number
        }
        Update: {
          code?: string
          is_active?: boolean
          label?: string
          reached_contact?: boolean
          retired_at?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      leads: {
        Row: {
          apollo_contact_id: string | null
          apollo_org_id: string | null
          archived_at: string | null
          category: string | null
          cc_bcc: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_builder: string
          completion_checked_at: string | null
          completion_estimate: string | null
          completion_precision: string | null
          completion_source: string | null
          converted_at: string | null
          converted_in_zoho_at: string | null
          converted_to_contact_id: string | null
          converted_to_deal_id: string | null
          converted_to_org_id: string | null
          created_at: string
          direct_email: string | null
          email_sent_at: string | null
          enriched_at: string | null
          enrichment_status: string | null
          follow_up_date: string | null
          id: string
          lead_number: string | null
          message_id: string | null
          next_best_action: string | null
          next_step_code: string | null
          notes: string | null
          organisation_id: string | null
          owner_email: string | null
          phone: string | null
          project_contact_name: string | null
          project_name: string | null
          rated_at: string | null
          rating_band: string | null
          rating_model: string | null
          rating_reason: string | null
          rating_score: number | null
          rating_stale: boolean
          rating_stale_since: string | null
          reception_email: string | null
          reception_name: string | null
          responded_at: string | null
          role: string | null
          secondary_contact: string | null
          secondary_email: string | null
          site_address: string | null
          source: string | null
          source_code: string | null
          source_row_key: string | null
          source_system: string
          source_tab: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          state: string | null
          status_code: string | null
          tags: string[]
          updated_at: string
          who_spoke_code: string | null
          who_spoke_with: string | null
          zoho_converted_deal_id: string | null
          zoho_id: string | null
          zoho_push_count: number
          zoho_sync_error: string | null
          zoho_sync_status: string | null
          zoho_synced_at: string | null
        }
        Insert: {
          apollo_contact_id?: string | null
          apollo_org_id?: string | null
          archived_at?: string | null
          category?: string | null
          cc_bcc?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          company_builder: string
          completion_checked_at?: string | null
          completion_estimate?: string | null
          completion_precision?: string | null
          completion_source?: string | null
          converted_at?: string | null
          converted_in_zoho_at?: string | null
          converted_to_contact_id?: string | null
          converted_to_deal_id?: string | null
          converted_to_org_id?: string | null
          created_at?: string
          direct_email?: string | null
          email_sent_at?: string | null
          enriched_at?: string | null
          enrichment_status?: string | null
          follow_up_date?: string | null
          id?: string
          lead_number?: string | null
          message_id?: string | null
          next_best_action?: string | null
          next_step_code?: string | null
          notes?: string | null
          organisation_id?: string | null
          owner_email?: string | null
          phone?: string | null
          project_contact_name?: string | null
          project_name?: string | null
          rated_at?: string | null
          rating_band?: string | null
          rating_model?: string | null
          rating_reason?: string | null
          rating_score?: number | null
          rating_stale?: boolean
          rating_stale_since?: string | null
          reception_email?: string | null
          reception_name?: string | null
          responded_at?: string | null
          role?: string | null
          secondary_contact?: string | null
          secondary_email?: string | null
          site_address?: string | null
          source?: string | null
          source_code?: string | null
          source_row_key?: string | null
          source_system?: string
          source_tab?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          state?: string | null
          status_code?: string | null
          tags?: string[]
          updated_at?: string
          who_spoke_code?: string | null
          who_spoke_with?: string | null
          zoho_converted_deal_id?: string | null
          zoho_id?: string | null
          zoho_push_count?: number
          zoho_sync_error?: string | null
          zoho_sync_status?: string | null
          zoho_synced_at?: string | null
        }
        Update: {
          apollo_contact_id?: string | null
          apollo_org_id?: string | null
          archived_at?: string | null
          category?: string | null
          cc_bcc?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          company_builder?: string
          completion_checked_at?: string | null
          completion_estimate?: string | null
          completion_precision?: string | null
          completion_source?: string | null
          converted_at?: string | null
          converted_in_zoho_at?: string | null
          converted_to_contact_id?: string | null
          converted_to_deal_id?: string | null
          converted_to_org_id?: string | null
          created_at?: string
          direct_email?: string | null
          email_sent_at?: string | null
          enriched_at?: string | null
          enrichment_status?: string | null
          follow_up_date?: string | null
          id?: string
          lead_number?: string | null
          message_id?: string | null
          next_best_action?: string | null
          next_step_code?: string | null
          notes?: string | null
          organisation_id?: string | null
          owner_email?: string | null
          phone?: string | null
          project_contact_name?: string | null
          project_name?: string | null
          rated_at?: string | null
          rating_band?: string | null
          rating_model?: string | null
          rating_reason?: string | null
          rating_score?: number | null
          rating_stale?: boolean
          rating_stale_since?: string | null
          reception_email?: string | null
          reception_name?: string | null
          responded_at?: string | null
          role?: string | null
          secondary_contact?: string | null
          secondary_email?: string | null
          site_address?: string | null
          source?: string | null
          source_code?: string | null
          source_row_key?: string | null
          source_system?: string
          source_tab?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          state?: string | null
          status_code?: string | null
          tags?: string[]
          updated_at?: string
          who_spoke_code?: string | null
          who_spoke_with?: string | null
          zoho_converted_deal_id?: string | null
          zoho_id?: string | null
          zoho_push_count?: number
          zoho_sync_error?: string | null
          zoho_sync_status?: string | null
          zoho_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_converted_to_contact_id_fkey"
            columns: ["converted_to_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_contact_id_fkey"
            columns: ["converted_to_contact_id"]
            isOneToOne: false
            referencedRelation: "v_contacts_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_missing_from_zoho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_stale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_org_id_fkey"
            columns: ["converted_to_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_org_id_fkey"
            columns: ["converted_to_org_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "leads_rating_band_fkey"
            columns: ["rating_band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_who_spoke_code_fkey"
            columns: ["who_spoke_code"]
            isOneToOne: false
            referencedRelation: "lead_who_spoke"
            referencedColumns: ["code"]
          },
        ]
      }
      organisation_aliases: {
        Row: {
          alias_norm: string
          alias_raw: string
          created_at: string
          organisation_id: string
        }
        Insert: {
          alias_norm: string
          alias_raw: string
          created_at?: string
          organisation_id: string
        }
        Update: {
          alias_norm?: string
          alias_raw?: string
          created_at?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_aliases_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_aliases_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      organisations: {
        Row: {
          abn: string | null
          billing_address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_test: boolean
          name: string
          notes: string | null
          phone: string | null
          shopify_customer_id: string | null
          trading_name: string | null
          types: Database["public"]["Enums"]["org_type"][]
          updated_at: string
          website: string | null
          xero_contact_id: string | null
          zoho_account_id: string | null
        }
        Insert: {
          abn?: string | null
          billing_address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_test?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          shopify_customer_id?: string | null
          trading_name?: string | null
          types?: Database["public"]["Enums"]["org_type"][]
          updated_at?: string
          website?: string | null
          xero_contact_id?: string | null
          zoho_account_id?: string | null
        }
        Update: {
          abn?: string | null
          billing_address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_test?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          shopify_customer_id?: string | null
          trading_name?: string | null
          types?: Database["public"]["Enums"]["org_type"][]
          updated_at?: string
          website?: string | null
          xero_contact_id?: string | null
          zoho_account_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          colour: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          initials: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          active?: boolean
          colour?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          initials?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          active?: boolean
          colour?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          initials?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      project_financials: {
        Row: {
          contract_value: number | null
          project_id: string
          total_costs: number | null
          updated_at: string
        }
        Insert: {
          contract_value?: number | null
          project_id: string
          total_costs?: number | null
          updated_at?: string
        }
        Update: {
          contract_value?: number | null
          project_id?: string
          total_costs?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_financials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_forecast_snapshots: {
        Row: {
          captured_at: string
          captured_reason: string
          contract_value: number | null
          due_month: string | null
          gp_percent: number | null
          gross_margin: number | null
          id: string
          invoice_month: string | null
          labour_cost: number | null
          labour_month: string | null
          note: string | null
          other_cost: number | null
          other_month: string | null
          project_id: string
          snapshot_type: string
          source_row: Json | null
          tactile_cost: number | null
          tactile_month: string | null
          tactile_rem_month: string | null
          total_cogs: number | null
          zoho_deal_id: string | null
        }
        Insert: {
          captured_at?: string
          captured_reason: string
          contract_value?: number | null
          due_month?: string | null
          gp_percent?: number | null
          gross_margin?: number | null
          id?: string
          invoice_month?: string | null
          labour_cost?: number | null
          labour_month?: string | null
          note?: string | null
          other_cost?: number | null
          other_month?: string | null
          project_id: string
          snapshot_type: string
          source_row?: Json | null
          tactile_cost?: number | null
          tactile_month?: string | null
          tactile_rem_month?: string | null
          total_cogs?: number | null
          zoho_deal_id?: string | null
        }
        Update: {
          captured_at?: string
          captured_reason?: string
          contract_value?: number | null
          due_month?: string | null
          gp_percent?: number | null
          gross_margin?: number | null
          id?: string
          invoice_month?: string | null
          labour_cost?: number | null
          labour_month?: string | null
          note?: string | null
          other_cost?: number | null
          other_month?: string | null
          project_id?: string
          snapshot_type?: string
          source_row?: Json | null
          tactile_cost?: number | null
          tactile_month?: string | null
          tactile_rem_month?: string | null
          total_cogs?: number | null
          zoho_deal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      project_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_default: boolean
          name: string
          trigger_condition: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          trigger_condition?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          trigger_condition?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_name: string | null
          completed_at: string | null
          completion_notes: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          estimated_start: string | null
          id: string
          name: string
          onedrive_folder_id: string | null
          project_end: string | null
          project_start: string | null
          quote_number: string | null
          signed_off_at: string | null
          signed_off_by: string | null
          site_address: string | null
          status: Database["public"]["Enums"]["project_status"]
          template_id: string | null
          zoho_deal_id: string
        }
        Insert: {
          client_name?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          estimated_start?: string | null
          id?: string
          name: string
          onedrive_folder_id?: string | null
          project_end?: string | null
          project_start?: string | null
          quote_number?: string | null
          signed_off_at?: string | null
          signed_off_by?: string | null
          site_address?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
          zoho_deal_id: string
        }
        Update: {
          client_name?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          estimated_start?: string | null
          id?: string
          name?: string
          onedrive_folder_id?: string | null
          project_end?: string | null
          project_start?: string | null
          quote_number?: string | null
          signed_off_at?: string | null
          signed_off_by?: string | null
          site_address?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          template_id?: string | null
          zoho_deal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_signed_off_by_fkey"
            columns: ["signed_off_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_breakdown: {
        Row: {
          area: string
          formula: string | null
          id: string
          scope_line_id: string
          sub_qty: number
          updated_at: string | null
          updated_by: string | null
          used_qty: number | null
        }
        Insert: {
          area: string
          formula?: string | null
          id?: string
          scope_line_id: string
          sub_qty?: number
          updated_at?: string | null
          updated_by?: string | null
          used_qty?: number | null
        }
        Update: {
          area?: string
          formula?: string | null
          id?: string
          scope_line_id?: string
          sub_qty?: number
          updated_at?: string | null
          updated_by?: string | null
          used_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scope_breakdown_scope_line_id_fkey"
            columns: ["scope_line_id"]
            isOneToOne: false
            referencedRelation: "scope_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_breakdown_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_lines: {
        Row: {
          id: string
          location_context: string | null
          product_code: string
          project_id: string
          task_id: string | null
          task_name: string | null
          total_quantity: number
          unit: string
          unit_rate: number | null
        }
        Insert: {
          id?: string
          location_context?: string | null
          product_code: string
          project_id: string
          task_id?: string | null
          task_name?: string | null
          total_quantity?: number
          unit?: string
          unit_rate?: number | null
        }
        Update: {
          id?: string
          location_context?: string | null
          product_code?: string
          project_id?: string
          task_id?: string | null
          task_name?: string | null
          total_quantity?: number
          unit?: string
          unit_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scope_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scope_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scope_lines_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "scope_lines_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_lines_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          note: string | null
          post_error: string | null
          posted_at: string | null
          product_code: string
          project_id: string | null
          reason: string
          source_id: string | null
          source_table: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          post_error?: string | null
          posted_at?: string | null
          product_code: string
          project_id?: string | null
          reason: string
          source_id?: string | null
          source_table?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          post_error?: string | null
          posted_at?: string | null
          product_code?: string
          project_id?: string | null
          reason?: string
          source_id?: string | null
          source_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      stock_orders: {
        Row: {
          deposit_date: string | null
          description: string | null
          id: string
          ordered_at: string | null
          product_code: string
          project_id: string
          qty_needed: number
          qty_ordered: number | null
          remainder_date: string | null
          source: string | null
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          deposit_date?: string | null
          description?: string | null
          id?: string
          ordered_at?: string | null
          product_code: string
          project_id: string
          qty_needed?: number
          qty_ordered?: number | null
          remainder_date?: string | null
          source?: string | null
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          deposit_date?: string | null
          description?: string | null
          id?: string
          ordered_at?: string | null
          product_code?: string
          project_id?: string
          qty_needed?: number
          qty_ordered?: number | null
          remainder_date?: string | null
          source?: string | null
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      stock_planning: {
        Row: {
          amount: number | null
          cost_bucket: string | null
          id: string
          line_label: string
          project_id: string
          source: string | null
        }
        Insert: {
          amount?: number | null
          cost_bucket?: string | null
          id?: string
          line_label: string
          project_id: string
          source?: string | null
        }
        Update: {
          amount?: number | null
          cost_bucket?: string | null
          id?: string
          line_label?: string
          project_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_planning_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_planning_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_planning_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_planning_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      stock_reconciliation: {
        Row: {
          description: string | null
          id: string
          planned_qty: number
          product_code: string
          project_id: string
          returned_at: string | null
          returned_to_stock: boolean
          unit: string | null
          used_qty: number | null
        }
        Insert: {
          description?: string | null
          id?: string
          planned_qty?: number
          product_code: string
          project_id: string
          returned_at?: string | null
          returned_to_stock?: boolean
          unit?: string | null
          used_qty?: number | null
        }
        Update: {
          description?: string | null
          id?: string
          planned_qty?: number
          product_code?: string
          project_id?: string
          returned_at?: string | null
          returned_to_stock?: boolean
          unit?: string | null
          used_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      task_lists: {
        Row: {
          id: string
          name: string
          position: number
          project_id: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          project_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "task_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "task_lists_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          calc_table: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          date_manual: boolean
          description: string | null
          end_date: string | null
          id: string
          list_id: string
          name: string
          office_only: boolean
          parent_id: string | null
          position: number
          product_code: string | null
          project_id: string
          rule: Database["public"]["Enums"]["date_rule"]
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
        }
        Insert: {
          assignee_id?: string | null
          calc_table?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          date_manual?: boolean
          description?: string | null
          end_date?: string | null
          id?: string
          list_id: string
          name: string
          office_only?: boolean
          parent_id?: string | null
          position?: number
          product_code?: string | null
          project_id: string
          rule?: Database["public"]["Enums"]["date_rule"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
        }
        Update: {
          assignee_id?: string | null
          calc_table?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          date_manual?: boolean
          description?: string | null
          end_date?: string | null
          id?: string
          list_id?: string
          name?: string
          office_only?: boolean
          parent_id?: string | null
          position?: number
          product_code?: string | null
          project_id?: string
          rule?: Database["public"]["Enums"]["date_rule"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_calendar_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      template_task_lists: {
        Row: {
          id: string
          name: string
          position: number
          scope_inject: boolean
          template_id: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          scope_inject?: boolean
          template_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          scope_inject?: boolean
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_task_lists_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_tasks: {
        Row: {
          assignee_id: string | null
          calc_table: string | null
          description: string | null
          id: string
          list_id: string
          name: string
          parent_id: string | null
          position: number
          rule: Database["public"]["Enums"]["date_rule"]
          window_days: number | null
        }
        Insert: {
          assignee_id?: string | null
          calc_table?: string | null
          description?: string | null
          id?: string
          list_id: string
          name: string
          parent_id?: string | null
          position?: number
          rule?: Database["public"]["Enums"]["date_rule"]
          window_days?: number | null
        }
        Update: {
          assignee_id?: string | null
          calc_table?: string | null
          description?: string | null
          id?: string
          list_id?: string
          name?: string
          parent_id?: string | null
          position?: number
          rule?: Database["public"]["Enums"]["date_rule"]
          window_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "template_task_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "template_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean
          created_at: string
          hours: number
          id: string
          invoiced_on: string | null
          note: string | null
          project_id: string
          user_id: string
          work_date: string
        }
        Insert: {
          billable?: boolean
          created_at?: string
          hours: number
          id?: string
          invoiced_on?: string | null
          note?: string | null
          project_id: string
          user_id: string
          work_date: string
        }
        Update: {
          billable?: boolean
          created_at?: string
          hours?: number
          id?: string
          invoiced_on?: string | null
          note?: string | null
          project_id?: string
          user_id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_accessory_pool: {
        Row: {
          code: string | null
          description: string | null
          other_projects: number | null
          project_id: string | null
          remaining: number | null
          reorder_level: number | null
          stock_on_hand: number | null
          used_here: number | null
        }
        Relationships: []
      }
      v_actual_invoices: {
        Row: {
          amount: number | null
          invoice_date: string | null
          invoice_number: string | null
          paid_date: string | null
          part_number: number | null
          project_id: string | null
          status: string | null
          zoho_deal_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_calendar_tasks: {
        Row: {
          assignee_id: string | null
          end_date: string | null
          id: string | null
          project_id: string | null
          project_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_callbacks_due: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          addressing_variant: string | null
          callback_actor_local: string | null
          callback_at: string | null
          callback_lead_local: string | null
          called_at: string | null
          company_builder: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          created_at: string | null
          created_by: string | null
          duration_seconds: number | null
          id: string | null
          is_contact: boolean | null
          lead_id: string | null
          lead_timezone: string | null
          notes: string | null
          outcome_code: string | null
          outcome_label: string | null
          project_name: string | null
          sentiment: string | null
          spoke_with: string | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_calls_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_outcome_code_fkey"
            columns: ["outcome_code"]
            isOneToOne: false
            referencedRelation: "lead_call_outcomes"
            referencedColumns: ["code"]
          },
        ]
      }
      v_company_contacts_summary: {
        Row: {
          company: string | null
          contacts: number | null
          emailed_no_reply: number | null
          last_emailed: string | null
          last_replied: string | null
          never_contacted: number | null
          organisation_id: string | null
          replied: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      v_company_fragments: {
        Row: {
          canonical: string | null
          lead_count: number | null
          live_leads: number | null
          spellings: number | null
          variants: string[] | null
        }
        Relationships: []
      }
      v_company_history: {
        Row: {
          archived: number | null
          company: string | null
          conversion_rate_pct: number | null
          converted: number | null
          ever_responded: number | null
          first_contacted: string | null
          last_contacted: string | null
          organisation_id: string | null
          response_rate_pct: number | null
          total_leads: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      v_company_prior_work: {
        Row: {
          block_e_state: string | null
          organisation_id: string | null
          organisation_name: string | null
          p1_contact: string | null
          p1_project: string | null
          p1_stages: number | null
          p1_state: string | null
          p2_contact: string | null
          p2_project: string | null
          p2_stages: number | null
          p2_state: string | null
          project_count: number | null
          same_contact: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      v_contacts_directory: {
        Row: {
          company: string | null
          created_at: string | null
          email: string | null
          emails_sent: number | null
          engagement: string | null
          from_apollo: boolean | null
          full_name: string | null
          id: string | null
          last_emailed: string | null
          last_replied: string | null
          organisation_id: string | null
          phone: string | null
          projects_emailed_about: string[] | null
          replies: number | null
          role: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
        ]
      }
      v_deals_board: {
        Row: {
          closing_date: string | null
          company: string | null
          contact: string | null
          contract_value: number | null
          created_at: string | null
          days_in_stage: number | null
          follow_up_date: string | null
          has_costs: boolean | null
          id: string | null
          is_forecast: boolean | null
          is_open: boolean | null
          is_stale: boolean | null
          is_terminal: boolean | null
          is_won: boolean | null
          last_activity_at: string | null
          last_seen_at: string | null
          loss_notes: string | null
          loss_reason: string | null
          next_step: string | null
          organisation_id: string | null
          owner_email: string | null
          prior_work_state: string | null
          project: string | null
          source_company: string | null
          source_system: string | null
          stage: string | null
          stage_label: string | null
          stage_modified_at: string | null
          stage_order: number | null
          stale_after_days: number | null
          staleness_exempt: boolean | null
          total_costs: number | null
          updated_at: string | null
          zoho_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "v_deals_pipeline_summary"
            referencedColumns: ["stage"]
          },
        ]
      }
      v_deals_missing_from_zoho: {
        Row: {
          contract_value: number | null
          id: string | null
          last_seen_at: string | null
          latest_run: string | null
          name: string | null
          source_company: string | null
          stage: string | null
          zoho_id: string | null
        }
        Insert: {
          contract_value?: number | null
          id?: string | null
          last_seen_at?: string | null
          latest_run?: never
          name?: string | null
          source_company?: string | null
          stage?: string | null
          zoho_id?: string | null
        }
        Update: {
          contract_value?: number | null
          id?: string | null
          last_seen_at?: string | null
          latest_run?: never
          name?: string | null
          source_company?: string | null
          stage?: string | null
          zoho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "deals_stage_fk"
            columns: ["stage"]
            isOneToOne: false
            referencedRelation: "v_deals_pipeline_summary"
            referencedColumns: ["stage"]
          },
        ]
      }
      v_deals_pipeline_summary: {
        Row: {
          deal_count: number | null
          is_open: boolean | null
          is_terminal: boolean | null
          is_won: boolean | null
          missing_contact_count: number | null
          stage: string | null
          stage_label: string | null
          stage_order: number | null
          stale_count: number | null
          total_contract_value: number | null
        }
        Relationships: []
      }
      v_deals_stale: {
        Row: {
          company: string | null
          contact: string | null
          contract_value: number | null
          days_in_stage: number | null
          days_overdue: number | null
          id: string | null
          next_step: string | null
          owner_email: string | null
          project: string | null
          stage_label: string | null
          stale_after_days: number | null
          zoho_id: string | null
        }
        Relationships: []
      }
      v_deals_unlinked: {
        Row: {
          deal_count: number | null
          first_seen: string | null
          source_company: string | null
          stages: string | null
          suggested_organisation: string | null
          suggestion_score: number | null
        }
        Relationships: []
      }
      v_import_review: {
        Row: {
          batch_id: string | null
          batch_status: string | null
          company_builder: string | null
          decision: string | null
          dup_detail: string | null
          dup_score: number | null
          dup_status: string | null
          existing_company: string | null
          existing_created: string | null
          existing_lead_id: string | null
          existing_stage: Database["public"]["Enums"]["lead_stage"] | null
          file_name: string | null
          id: string | null
          project_name: string | null
          row_number: number | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "lead_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lead_calls: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          addressing_variant: string | null
          callback_actor_local: string | null
          callback_at: string | null
          callback_lead_local: string | null
          called_at: string | null
          company_builder: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          created_at: string | null
          created_by: string | null
          duration_seconds: number | null
          id: string | null
          is_contact: boolean | null
          lead_id: string | null
          lead_timezone: string | null
          notes: string | null
          outcome_code: string | null
          outcome_label: string | null
          project_name: string | null
          sentiment: string | null
          spoke_with: string | null
          state: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_calls_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_calls_outcome_code_fkey"
            columns: ["outcome_code"]
            isOneToOne: false
            referencedRelation: "lead_call_outcomes"
            referencedColumns: ["code"]
          },
        ]
      }
      v_lead_card_context: {
        Row: {
          block_e: Json | null
          closed_lost_count: number | null
          completed_count: number | null
          deal_count: number | null
          emailed_count: number | null
          lead_count: number | null
          leads: Json | null
          live_count: number | null
          organisation_id: string | null
          organisation_name: string | null
          replied_count: number | null
          response_rate_pct: number | null
          work: Json | null
        }
        Relationships: []
      }
      v_lead_duplicates: {
        Row: {
          company: string | null
          duplicate_of: string | null
          duplicate_project: string | null
          duplicate_stage: string | null
          lead_id: string | null
          match_type: string | null
          original_raised_at: string | null
          project_name: string | null
          score: number | null
          stage: string | null
        }
        Relationships: []
      }
      v_lead_funnel_summary: {
        Row: {
          actioned: number | null
          awaiting_call: number | null
          conversion_rate_pct: number | null
          converted: number | null
          emails_opened: number | null
          emails_sent: number | null
          hot: number | null
          needs_attention: number | null
          open_rate_pct: number | null
          replies: number | null
          reply_rate_pct: number | null
          responded: number | null
          total_leads: number | null
          warm: number | null
        }
        Relationships: []
      }
      v_lead_metrics: {
        Row: {
          company_builder: string | null
          converted_at: string | null
          created_at: string | null
          days_to_convert: number | null
          emails_bounced: number | null
          emails_delivered: number | null
          emails_opened: number | null
          emails_scheduled: number | null
          emails_sent: number | null
          first_sent_at: string | null
          id: string | null
          last_reply_at: string | null
          links_clicked: number | null
          next_step_code: string | null
          project_name: string | null
          rating_band: string | null
          rating_score: number | null
          replies: number | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          state: string | null
          status_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_rating_band_fkey"
            columns: ["rating_band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      v_lead_rating_trend: {
        Row: {
          band: string | null
          company_builder: string | null
          computed_at: string | null
          delta: number | null
          lead_id: string | null
          next_best_action: string | null
          previous_score: number | null
          project_name: string | null
          reason: string | null
          recency: number | null
          score: number | null
          triggered_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_rating_history_band_fkey"
            columns: ["band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_rating_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      v_lead_silence: {
        Row: {
          action_prompt: string | null
          auto_stage: Database["public"]["Enums"]["lead_stage"] | null
          cap_band_code: string | null
          company_builder: string | null
          days_silent: number | null
          id: string | null
          last_activity_at: string | null
          penalty_points: number | null
          project_name: string | null
          rating_band: string | null
          rating_score: number | null
          silence_rule_code: string | null
          silence_rule_label: string | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_silence_rules_cap_band_code_fkey"
            columns: ["cap_band_code"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_rating_band_fkey"
            columns: ["rating_band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
        ]
      }
      v_lead_step_options: {
        Row: {
          applies_to_stage: Database["public"]["Enums"]["lead_stage"] | null
          code: string | null
          creates_task_kind: string | null
          enters_crm: boolean | null
          follow_up_days: number | null
          is_enrichment: boolean | null
          label: string | null
          moves_to_stage: Database["public"]["Enums"]["lead_stage"] | null
          requirements: string | null
          requires_contact_name: boolean | null
          requires_conversation: boolean | null
          requires_email: boolean | null
          requires_follow_up_date: boolean | null
          requires_note: boolean | null
          requires_scheduled_date: boolean | null
          sends_email: boolean | null
          sort_order: number | null
          task_cancels_on_reply: boolean | null
          task_label: string | null
          zoho_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_next_steps_task_kind_fk"
            columns: ["creates_task_kind"]
            isOneToOne: false
            referencedRelation: "lead_task_kinds"
            referencedColumns: ["kind"]
          },
        ]
      }
      v_lead_tasks_due: {
        Row: {
          company: string | null
          days_overdue: number | null
          direct_email: string | null
          due_date: string | null
          kind: string | null
          kind_label: string | null
          lead_id: string | null
          lead_stage: string | null
          next_step_code: string | null
          organisation_id: string | null
          project_contact_name: string | null
          project_name: string | null
          reception_email: string | null
          sequence_position: number | null
          state: string | null
          task_id: string | null
          who_spoke_code: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_kind_fk"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "lead_task_kinds"
            referencedColumns: ["kind"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_import_review"
            referencedColumns: ["existing_lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_duplicates"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_silence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_timing"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_incomplete"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_needing_rating"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_unroutable"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_zoho_pending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_oven_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "leads_who_spoke_code_fkey"
            columns: ["who_spoke_code"]
            isOneToOne: false
            referencedRelation: "lead_who_spoke"
            referencedColumns: ["code"]
          },
        ]
      }
      v_lead_timing: {
        Row: {
          company: string | null
          completion_checked_at: string | null
          date_precision: string | null
          date_source: string | null
          days_away: number | null
          days_overdue: number | null
          due_date: string | null
          guidance: string | null
          lead_id: string | null
          project_name: string | null
          source_text: string | null
          stage: string | null
          timing_band: string | null
        }
        Relationships: []
      }
      v_leads_incomplete: {
        Row: {
          company_builder: string | null
          created_at: string | null
          direct_email: string | null
          id: string | null
          missing_fields: string[] | null
          phone: string | null
          project_name: string | null
          source_tab: string | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          state: string | null
        }
        Insert: {
          company_builder?: string | null
          created_at?: string | null
          direct_email?: string | null
          id?: string | null
          missing_fields?: never
          phone?: string | null
          project_name?: string | null
          source_tab?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          state?: string | null
        }
        Update: {
          company_builder?: string | null
          created_at?: string | null
          direct_email?: string | null
          id?: string | null
          missing_fields?: never
          phone?: string | null
          project_name?: string | null
          source_tab?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          state?: string | null
        }
        Relationships: []
      }
      v_leads_needing_rating: {
        Row: {
          call_count: number | null
          company_builder: string | null
          current_band: string | null
          current_score: number | null
          event_count: number | null
          id: string | null
          last_activity_at: string | null
          organisation_id: string | null
          project_name: string | null
          rated_at: string | null
          rating_stale_since: string | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          state: string | null
        }
        Insert: {
          call_count?: never
          company_builder?: string | null
          current_band?: string | null
          current_score?: number | null
          event_count?: never
          id?: string | null
          last_activity_at?: never
          organisation_id?: string | null
          project_name?: string | null
          rated_at?: string | null
          rating_stale_since?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          state?: string | null
        }
        Update: {
          call_count?: never
          company_builder?: string | null
          current_band?: string | null
          current_score?: number | null
          event_count?: never
          id?: string | null
          last_activity_at?: never
          organisation_id?: string | null
          project_name?: string | null
          rated_at?: string | null
          rating_stale_since?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "leads_rating_band_fkey"
            columns: ["current_band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
        ]
      }
      v_leads_unroutable: {
        Row: {
          company_builder: string | null
          id: string | null
          next_step_code: string | null
          project_name: string | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          company_builder?: string | null
          id?: string | null
          next_step_code?: string | null
          project_name?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          company_builder?: string | null
          id?: string | null
          next_step_code?: string | null
          project_name?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
        ]
      }
      v_leads_zoho_pending: {
        Row: {
          blocked_no_project_name: boolean | null
          company_builder: string | null
          id: string | null
          next_step_code: string | null
          project_contact_name: string | null
          project_name: string | null
          push_mode: string | null
          rating_band: string | null
          state: string | null
          status_code: string | null
          updated_at: string | null
          zoho_id: string | null
          zoho_sync_error: string | null
          zoho_sync_status: string | null
          zoho_synced_at: string | null
        }
        Insert: {
          blocked_no_project_name?: never
          company_builder?: string | null
          id?: string | null
          next_step_code?: string | null
          project_contact_name?: string | null
          project_name?: string | null
          push_mode?: never
          rating_band?: string | null
          state?: string | null
          status_code?: string | null
          updated_at?: string | null
          zoho_id?: string | null
          zoho_sync_error?: string | null
          zoho_sync_status?: string | null
          zoho_synced_at?: string | null
        }
        Update: {
          blocked_no_project_name?: never
          company_builder?: string | null
          id?: string | null
          next_step_code?: string | null
          project_contact_name?: string | null
          project_name?: string | null
          push_mode?: never
          rating_band?: string | null
          state?: string | null
          status_code?: string | null
          updated_at?: string | null
          zoho_id?: string | null
          zoho_sync_error?: string | null
          zoho_sync_status?: string | null
          zoho_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_rating_band_fkey"
            columns: ["rating_band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["code"]
          },
        ]
      }
      v_oven_leads: {
        Row: {
          apollo_contact_id: string | null
          apollo_org_id: string | null
          archived_at: string | null
          category: string | null
          cc_bcc: string | null
          claim_active: boolean | null
          claim_actor_id: string | null
          claim_expires_at: string | null
          claim_holder: string | null
          claimed_at: string | null
          claimed_by: string | null
          company_builder: string | null
          converted_at: string | null
          converted_in_zoho_at: string | null
          converted_to_contact_id: string | null
          converted_to_deal_id: string | null
          converted_to_org_id: string | null
          created_at: string | null
          direct_email: string | null
          email_sent_at: string | null
          enriched_at: string | null
          enrichment_status: string | null
          follow_up_date: string | null
          id: string | null
          lead_number: string | null
          lead_timezone: string | null
          message_id: string | null
          next_best_action: string | null
          next_step_code: string | null
          notes: string | null
          organisation_id: string | null
          owner_email: string | null
          phone: string | null
          project_contact_name: string | null
          project_name: string | null
          rated_at: string | null
          rating_band: string | null
          rating_model: string | null
          rating_reason: string | null
          rating_score: number | null
          rating_stale: boolean | null
          rating_stale_since: string | null
          reception_email: string | null
          reception_name: string | null
          responded_at: string | null
          role: string | null
          secondary_contact: string | null
          secondary_email: string | null
          site_address: string | null
          source: string | null
          source_code: string | null
          source_row_key: string | null
          source_system: string | null
          source_tab: string | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          state: string | null
          status_code: string | null
          tags: string[] | null
          updated_at: string | null
          who_spoke_code: string | null
          who_spoke_with: string | null
          zoho_converted_deal_id: string | null
          zoho_id: string | null
          zoho_push_count: number | null
          zoho_sync_error: string | null
          zoho_sync_status: string | null
          zoho_synced_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_claims_actor_id_fkey"
            columns: ["claim_actor_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_contact_id_fkey"
            columns: ["converted_to_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_contact_id_fkey"
            columns: ["converted_to_contact_id"]
            isOneToOne: false
            referencedRelation: "v_contacts_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_board"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_missing_from_zoho"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_deal_fkey"
            columns: ["converted_to_deal_id"]
            isOneToOne: false
            referencedRelation: "v_deals_stale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_org_id_fkey"
            columns: ["converted_to_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_to_org_id_fkey"
            columns: ["converted_to_org_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "lead_next_steps"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_next_step_code_fkey"
            columns: ["next_step_code"]
            isOneToOne: false
            referencedRelation: "v_lead_step_options"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "v_lead_card_context"
            referencedColumns: ["organisation_id"]
          },
          {
            foreignKeyName: "leads_rating_band_fkey"
            columns: ["rating_band"]
            isOneToOne: false
            referencedRelation: "lead_rating_bands"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_source_code_fkey"
            columns: ["source_code"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_status_code_fkey"
            columns: ["status_code"]
            isOneToOne: false
            referencedRelation: "lead_statuses"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "leads_who_spoke_code_fkey"
            columns: ["who_spoke_code"]
            isOneToOne: false
            referencedRelation: "lead_who_spoke"
            referencedColumns: ["code"]
          },
        ]
      }
      v_pending_stock_movements: {
        Row: {
          movement_count: number | null
          movement_ids: string[] | null
          net_delta: number | null
          product_code: string | null
        }
        Relationships: []
      }
      v_project_forecast: {
        Row: {
          captured_reason: string | null
          contract_value: number | null
          due_month: string | null
          effective_captured_at: string | null
          effective_type: string | null
          gp_percent: number | null
          gross_margin: number | null
          invoice_month: string | null
          labour_cost: number | null
          labour_month: string | null
          original_captured_at: string | null
          original_contract_value: number | null
          original_gross_margin: number | null
          original_total_cogs: number | null
          other_cost: number | null
          other_month: string | null
          project_id: string | null
          tactile_cost: number | null
          tactile_month: string | null
          tactile_rem_month: string | null
          total_cogs: number | null
          zoho_deal_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "project_forecast_snapshots_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_project_hours: {
        Row: {
          billable_hours: number | null
          project_id: string | null
          total_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      v_project_labour_actual: {
        Row: {
          actual_cost: number | null
          entry_count: number | null
          hours_without_rate: number | null
          last_entry_date: string | null
          project_id: string | null
          total_hours: number | null
          zoho_deal_id: string | null
        }
        Relationships: []
      }
      v_project_progress: {
        Row: {
          done_tasks: number | null
          pct: number | null
          project_id: string | null
          total_tasks: number | null
        }
        Relationships: []
      }
      v_stock_leftover: {
        Row: {
          description: string | null
          leftover: number | null
          planned_qty: number | null
          product_code: string | null
          project_id: string | null
          returned_to_stock: boolean | null
          unit: string | null
          used_qty: number | null
        }
        Insert: {
          description?: string | null
          leftover?: never
          planned_qty?: number | null
          product_code?: string | null
          project_id?: string | null
          returned_to_stock?: boolean | null
          unit?: string | null
          used_qty?: number | null
        }
        Update: {
          description?: string | null
          leftover?: never
          planned_qty?: number | null
          product_code?: string | null
          project_id?: string | null
          returned_to_stock?: boolean | null
          unit?: string | null
          used_qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_accessory_pool"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_labour_actual"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "stock_reconciliation_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
    }
    Functions: {
      apply_date_cascade: {
        Args: { p_new_start: string; p_project: string }
        Returns: number
      }
      auto_merge_fragment: {
        Args: { p_canonical_norm: string }
        Returns: string
      }
      commit_import_batch: {
        Args: { p_batch: string; p_by?: string }
        Returns: {
          imported: number
          skipped: number
          still_pending: number
        }[]
      }
      company_is_unknown: { Args: { p_company: string }; Returns: boolean }
      delete_lead: {
        Args: { p_by?: string; p_lead: string; p_reason?: string }
        Returns: string
      }
      delete_leads: {
        Args: { p_by?: string; p_leads: string[]; p_reason?: string }
        Returns: number
      }
      find_similar_leads: {
        Args: { p_company?: string; p_project: string; p_threshold?: number }
        Returns: {
          company_builder: string
          exact_project: boolean
          id: string
          project_name: string
          same_company: boolean
          score: number
          stage: Database["public"]["Enums"]["lead_stage"]
        }[]
      }
      flag_import_duplicates: {
        Args: { p_batch: string }
        Returns: {
          dup_status: string
          rows: number
        }[]
      }
      merge_company_variants: {
        Args: { p_canonical_name: string; p_variants: string[] }
        Returns: string
      }
      normalise_company_name: { Args: { p_name: string }; Returns: string }
      normalise_project_name: { Args: { p_name: string }; Returns: string }
      pick_canonical_name: {
        Args: { p_canonical_norm: string }
        Returns: string
      }
      preview_date_cascade: {
        Args: { p_new_start: string; p_project: string }
        Returns: {
          new_end: string
          new_start: string
          old_end: string
          old_start: string
          skipped: boolean
          task_id: string
          task_name: string
        }[]
      }
      project_phase_marker: { Args: { p_name: string }; Returns: string }
      resolve_deal_stage: { Args: { p_zoho_value: string }; Returns: string }
      resolve_lead_template: {
        Args: {
          p_channel?: string
          p_next_step: string
          p_state?: string
          p_who_spoke?: string
        }
        Returns: {
          body_html: string
          id: string
          send_mode: string
          specificity: number
          subject: string
        }[]
      }
      resolve_rating_band: { Args: { p_score: number }; Returns: string }
      resolve_task_dates: {
        Args: {
          p_est_start: string
          p_proj_end: string
          p_proj_start: string
          p_rule: Database["public"]["Enums"]["date_rule"]
          p_window?: number
        }
        Returns: {
          end_date: string
          start_date: string
        }[]
      }
      score_contact_role: { Args: { p_title: string }; Returns: number }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      tt_advance_follow_up: {
        Args: {
          p_completed_kind: string
          p_created_by?: string
          p_lead_id: string
        }
        Returns: string
      }
      tt_check_allowed_values: { Args: { p_def: string }; Returns: string[] }
      tt_claim_lead: {
        Args: { p_actor_id: string; p_lead_id: string }
        Returns: {
          expires_at: string
          held_by: string
          held_by_name: string
          ok: boolean
        }[]
      }
      tt_claim_ttl: { Args: never; Returns: string }
      tt_extract_completion: {
        Args: { p_notes: string }
        Returns: {
          date_precision: string
          due_date: string
          raw: string
        }[]
      }
      tt_fetch_lead_gated: {
        Args: { p_lead_id: string; p_operator: string }
        Returns: {
          actor_id: string
          actor_name: string
          company_builder: string
          gate_reason: string
          held_by: string
          id: string
          may_act: boolean
          organisation_id: string
          project_name: string
          state: string
        }[]
      }
      tt_find_duplicate_lead: {
        Args: { p_lead_id: string }
        Returns: {
          duplicate_of: string
          match_type: string
          next_step: string
          project_name: string
          raised_at: string
          score: number
          stage: string
        }[]
      }
      tt_heartbeat_lead: {
        Args: { p_actor_id: string; p_lead_id: string }
        Returns: {
          expires_at: string
          ok: boolean
        }[]
      }
      tt_is_switchboard: { Args: { p_raw: string }; Returns: boolean }
      tt_last_email_message_id: { Args: { p_lead_id: string }; Returns: string }
      tt_lead_gate: {
        Args: { p_lead_id: string; p_operator: string }
        Returns: {
          actor_id: string
          actor_name: string
          held_by: string
          may_act: boolean
          reason: string
        }[]
      }
      tt_local_to_utc: {
        Args: { p_local: string; p_state: string }
        Returns: string
      }
      tt_mark_silent_leads_stale: { Args: never; Returns: number }
      tt_match_organisation: {
        Args: { p_name: string }
        Returns: {
          contacts_count: number
          deals_count: number
          matched: boolean
          near_matches: Json
          org_name: string
          organisation_id: string
        }[]
      }
      tt_may_action_lead: {
        Args: { p_actor_id: string; p_lead_id: string }
        Returns: boolean
      }
      tt_normalise_au_phone: { Args: { p_raw: string }; Returns: string }
      tt_purge_missing_zoho_deals: { Args: never; Returns: number }
      tt_release_lead: {
        Args: { p_actor_id: string; p_lead_id: string }
        Returns: boolean
      }
      tt_restart_follow_ups: {
        Args: { p_created_by?: string; p_from: string; p_lead_id: string }
        Returns: string
      }
      tt_save_company_phone: {
        Args: { p_lead_id: string; p_phone: string; p_source?: string }
        Returns: {
          phone: string
          reason: string
          saved: boolean
          wrote_lead: boolean
          wrote_org: boolean
        }[]
      }
      tt_schedule_task: {
        Args: {
          p_created_by?: string
          p_due: string
          p_kind: string
          p_lead_id: string
          p_notes?: string
        }
        Returns: string
      }
      tt_state_timezone: { Args: { p_state: string }; Returns: string }
    }
    Enums: {
      date_rule:
        | "none"
        | "project_start_end"
        | "est_start"
        | "est_start_minus_10w"
        | "est_start_minus_8w"
        | "est_start_minus_6w"
        | "est_start_minus_2w"
        | "est_start_plus_10d"
      deal_kind: "installation" | "trade_product"
      deal_stage:
        | "quoted"
        | "verbal_confirmation"
        | "po_received"
        | "completed"
        | "lost_dead"
      invoice_status: "draft" | "sent" | "paid"
      lead_stage:
        | "new"
        | "enriching"
        | "ready_to_call"
        | "actioned"
        | "responded"
        | "needs_attention"
        | "converted"
        | "archived"
      org_type: "customer" | "trade_customer" | "supplier" | "subcontractor"
      project_status: "active" | "awaiting_signoff" | "completed" | "cancelled"
      task_status: "open" | "done"
      user_role: "office" | "worker"
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
      date_rule: [
        "none",
        "project_start_end",
        "est_start",
        "est_start_minus_10w",
        "est_start_minus_8w",
        "est_start_minus_6w",
        "est_start_minus_2w",
        "est_start_plus_10d",
      ],
      deal_kind: ["installation", "trade_product"],
      deal_stage: [
        "quoted",
        "verbal_confirmation",
        "po_received",
        "completed",
        "lost_dead",
      ],
      invoice_status: ["draft", "sent", "paid"],
      lead_stage: [
        "new",
        "enriching",
        "ready_to_call",
        "actioned",
        "responded",
        "needs_attention",
        "converted",
        "archived",
      ],
      org_type: ["customer", "trade_customer", "supplier", "subcontractor"],
      project_status: ["active", "awaiting_signoff", "completed", "cancelled"],
      task_status: ["open", "done"],
      user_role: ["office", "worker"],
    },
  },
} as const
