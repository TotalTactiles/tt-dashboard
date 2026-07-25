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
      stock_orders: {
        Row: {
          description: string | null
          id: string
          product_code: string
          project_id: string
          qty_needed: number
          qty_ordered: number | null
          unit: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          product_code: string
          project_id: string
          qty_needed?: number
          qty_ordered?: number | null
          unit?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          product_code?: string
          project_id?: string
          qty_needed?: number
          qty_ordered?: number | null
          unit?: string | null
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
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
      }
      stock_planning: {
        Row: {
          amount: number | null
          id: string
          line_label: string
          project_id: string
          source: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          line_label: string
          project_id: string
          source?: string | null
        }
        Update: {
          amount?: number | null
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
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
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
            referencedRelation: "v_project_progress"
            referencedColumns: ["project_id"]
          },
        ]
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
      invoice_status: "draft" | "sent" | "paid"
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
      invoice_status: ["draft", "sent", "paid"],
      project_status: ["active", "awaiting_signoff", "completed", "cancelled"],
      task_status: ["open", "done"],
      user_role: ["office", "worker"],
    },
  },
} as const
