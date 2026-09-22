/**
 * Application database types for Phase 2.
 * Public APIs must expose uuid or code, never internal primary keys.
 */
export type Json
  = string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type ProfileRole = 'admin' | 'customer'
export type ProductStatus = 'draft' | 'active' | 'coming_soon' | 'hidden' | 'archived'
export type EquipmentStatus = 'available' | 'reserved' | 'rented' | 'maintenance' | 'damaged' | 'lost' | 'retired'
export type RentalStatus
  = | 'draft'
    | 'pending'
    | 'awaiting_payment'
    | 'paid'
    | 'approved'
    | 'ready_for_pickup'
    | 'active'
    | 'returned'
    | 'completed'
    | 'cancelled'
    | 'rejected'
    | 'overdue'
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled'
export type ExpenseCategory
  = | 'internet'
    | 'electricity'
    | 'maintenance'
    | 'repairs'
    | 'software'
    | 'subscription'
    | 'marketing'
    | 'transportation'
    | 'staff'
    | 'insurance'
    | 'equipment'
    | 'office'
    | 'other'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: number
          uuid: string
          user_id: string
          role: ProfileRole
          first_name: string
          last_name: string
          phone: string | null
          privacy_policy_version: string | null
          privacy_accepted_at: string | null
          terms_version: string | null
          terms_accepted_at: string | null
          marketing_opt_in: boolean
          marketing_opted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          uuid?: string
          role?: ProfileRole
          first_name?: string
          last_name?: string
          phone?: string | null
          privacy_policy_version?: string | null
          privacy_accepted_at?: string | null
          terms_version?: string | null
          terms_accepted_at?: string | null
          marketing_opt_in?: boolean
          marketing_opted_at?: string | null
        }
        Update: {
          first_name?: string
          last_name?: string
          phone?: string | null
          privacy_policy_version?: string | null
          privacy_accepted_at?: string | null
          terms_version?: string | null
          terms_accepted_at?: string | null
          marketing_opt_in?: boolean
          marketing_opted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          id: number
          uuid: string
          slug: string
          name: string
          description: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          slug: string
          name: string
          uuid?: string
          description?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          slug?: string
          name?: string
          description?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
      products: {
        Row: {
          id: number
          uuid: string
          slug: string
          sku: string
          category_id: number
          name: string
          description: string
          short_description: string
          daily_price: number
          weekly_price: number | null
          monthly_price: number | null
          deposit_amount: number
          late_fee: number
          replacement_value: number | null
          hidden_price_fields: string[]
          quantity: number
          reserved_quantity: number
          rented_quantity: number
          damaged_quantity: number
          maintenance_quantity: number
          lost_quantity: number
          available_quantity: number
          status: ProductStatus
          condition: string
          specifications: Json
          included_accessories: Json
          rental_rules: string | null
          model_path: string | null
          is_featured: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          slug: string
          sku: string
          category_id: number
          name: string
          daily_price: number
          uuid?: string
          description?: string
          short_description?: string
          weekly_price?: number | null
          monthly_price?: number | null
          deposit_amount?: number
          late_fee?: number
          replacement_value?: number | null
          hidden_price_fields?: string[]
          quantity?: number
          status?: ProductStatus
          condition?: string
          specifications?: Json
          included_accessories?: Json
          rental_rules?: string | null
          model_path?: string | null
          is_featured?: boolean
        }
        Update: {
          slug?: string
          sku?: string
          category_id?: number
          name?: string
          description?: string
          short_description?: string
          daily_price?: number
          weekly_price?: number | null
          monthly_price?: number | null
          deposit_amount?: number
          late_fee?: number
          replacement_value?: number | null
          hidden_price_fields?: string[]
          quantity?: number
          reserved_quantity?: number
          rented_quantity?: number
          damaged_quantity?: number
          maintenance_quantity?: number
          lost_quantity?: number
          status?: ProductStatus
          condition?: string
          specifications?: Json
          included_accessories?: Json
          rental_rules?: string | null
          model_path?: string | null
          is_featured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'product_categories'
            referencedColumns: ['id']
          },
        ]
      }
      product_images: {
        Row: {
          id: number
          uuid: string
          product_id: number
          storage_path: string
          alt: string
          sort_order: number
          created_at: string
        }
        Insert: {
          product_id: number
          storage_path: string
          uuid?: string
          alt?: string
          sort_order?: number
        }
        Update: {
          storage_path?: string
          alt?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: 'product_images_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      equipment_assets: {
        Row: {
          id: number
          uuid: string
          product_id: number
          asset_code: string
          serial_number: string | null
          condition: string
          status: EquipmentStatus
          purchase_cost: number | null
          purchase_date: string | null
          replacement_value: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          product_id: number
          asset_code: string
          uuid?: string
          serial_number?: string | null
          condition?: string
          status?: EquipmentStatus
          purchase_cost?: number | null
          purchase_date?: string | null
          replacement_value?: number | null
          notes?: string | null
        }
        Update: {
          asset_code?: string
          serial_number?: string | null
          condition?: string
          status?: EquipmentStatus
          purchase_cost?: number | null
          purchase_date?: string | null
          replacement_value?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'equipment_assets_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      rental_requests: {
        Row: {
          id: number
          uuid: string
          code: string
          customer_id: number
          status: RentalStatus
          starts_on: string
          ends_on: string
          subtotal: number
          deposit_amount: number
          discount_amount: number
          tax_amount: number
          total_amount: number
          notes: string | null
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          customer_id: number
          starts_on: string
          ends_on: string
          uuid?: string
          code?: string
          status?: RentalStatus
          subtotal?: number
          deposit_amount?: number
          discount_amount?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          admin_notes?: string | null
        }
        Update: {
          status?: RentalStatus
          starts_on?: string
          ends_on?: string
          subtotal?: number
          deposit_amount?: number
          discount_amount?: number
          tax_amount?: number
          total_amount?: number
          notes?: string | null
          admin_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'rental_requests_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      rental_items: {
        Row: {
          id: number
          uuid: string
          rental_id: number
          product_id: number
          quantity: number
          daily_price: number
          line_total: number
          created_at: string
        }
        Insert: {
          rental_id: number
          product_id: number
          quantity: number
          daily_price: number
          line_total: number
          uuid?: string
        }
        Update: {
          quantity?: number
          daily_price?: number
          line_total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'rental_items_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: false
            referencedRelation: 'rental_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rental_items_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      rental_asset_assignments: {
        Row: {
          id: number
          uuid: string
          rental_id: number
          equipment_asset_id: number
          created_at: string
        }
        Insert: {
          rental_id: number
          equipment_asset_id: number
          uuid?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      rental_status_history: {
        Row: {
          id: number
          uuid: string
          rental_id: number
          from_status: string | null
          to_status: string
          changed_by: number | null
          note: string | null
          created_at: string
        }
        Insert: {
          rental_id: number
          to_status: string
          uuid?: string
          from_status?: string | null
          changed_by?: number | null
          note?: string | null
        }
        Update: Record<string, never>
        Relationships: []
      }
      waiver_versions: {
        Row: {
          id: number
          uuid: string
          version: string
          title: string
          body: string
          is_current: boolean
          published_at: string | null
          created_at: string
        }
        Insert: {
          version: string
          title: string
          body: string
          uuid?: string
          is_current?: boolean
          published_at?: string | null
        }
        Update: {
          title?: string
          body?: string
          is_current?: boolean
          published_at?: string | null
        }
        Relationships: []
      }
      waiver_acceptances: {
        Row: {
          id: number
          uuid: string
          waiver_version_id: number
          rental_id: number
          customer_id: number
          signer_name: string
          signature_data: string
          accepted_at: string
          ip_address: string | null
          user_agent: string | null
          privacy_policy_version: string | null
          terms_version: string | null
          signer_email: string | null
          signer_phone: string | null
        }
        Insert: {
          waiver_version_id: number
          rental_id: number
          customer_id: number
          signer_name: string
          signature_data: string
          uuid?: string
          ip_address?: string | null
          user_agent?: string | null
          privacy_policy_version?: string | null
          terms_version?: string | null
          signer_email?: string | null
          signer_phone?: string | null
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: 'waiver_acceptances_waiver_version_id_fkey'
            columns: ['waiver_version_id']
            isOneToOne: false
            referencedRelation: 'waiver_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'waiver_acceptances_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: true
            referencedRelation: 'rental_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'waiver_acceptances_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      rental_identity_verifications: {
        Row: {
          id: number
          uuid: string
          rental_id: number
          customer_id: number
          government_id_path: string
          selfie_path: string
          submitted_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          rental_id: number
          customer_id: number
          government_id_path: string
          selfie_path: string
          uuid?: string
          submitted_at?: string
        }
        Update: {
          government_id_path?: string
          selfie_path?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rental_identity_verifications_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: true
            referencedRelation: 'rental_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'rental_identity_verifications_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      payment_methods: {
        Row: {
          id: number
          uuid: string
          code: string
          name: string
          account_name: string | null
          account_number: string | null
          instructions: string | null
          qr_storage_path: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          code: string
          name: string
          uuid?: string
          account_name?: string | null
          account_number?: string | null
          instructions?: string | null
          qr_storage_path?: string | null
          sort_order?: number
          is_active?: boolean
        }
        Update: {
          code?: string
          name?: string
          account_name?: string | null
          account_number?: string | null
          instructions?: string | null
          qr_storage_path?: string | null
          sort_order?: number
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          id: number
          uuid: string
          rental_id: number
          customer_id: number
          amount: number
          currency: string
          provider: string
          provider_transaction_id: string | null
          status: PaymentStatus
          payment_method: string | null
          paid_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          rental_id: number
          customer_id: number
          amount: number
          provider: string
          uuid?: string
          currency?: string
          provider_transaction_id?: string | null
          status?: PaymentStatus
          payment_method?: string | null
          paid_at?: string | null
          metadata?: Json
        }
        Update: {
          status?: PaymentStatus
          amount?: number
          provider?: string
          provider_transaction_id?: string | null
          payment_method?: string | null
          paid_at?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'payment_transactions_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: false
            referencedRelation: 'rental_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payment_transactions_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      receipts: {
        Row: {
          id: number
          uuid: string
          receipt_number: string
          rental_id: number
          payment_id: number
          snapshot: Json
          issued_at: string
        }
        Insert: {
          rental_id: number
          payment_id: number
          snapshot: Json
          uuid?: string
          receipt_number?: string
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: 'receipts_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: false
            referencedRelation: 'rental_requests'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'receipts_payment_id_fkey'
            columns: ['payment_id']
            isOneToOne: true
            referencedRelation: 'payment_transactions'
            referencedColumns: ['id']
          },
        ]
      }
      expenses: {
        Row: {
          id: number
          uuid: string
          name: string
          category: ExpenseCategory
          description: string | null
          amount: number
          vendor: string | null
          reference: string | null
          status: 'pending' | 'paid' | 'void'
          notes: string | null
          incurred_on: string
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          category: ExpenseCategory
          amount: number
          incurred_on: string
          uuid?: string
          description?: string | null
          vendor?: string | null
          reference?: string | null
          status?: 'pending' | 'paid' | 'void'
          notes?: string | null
        }
        Update: {
          name?: string
          category?: ExpenseCategory
          description?: string | null
          amount?: number
          vendor?: string | null
          reference?: string | null
          status?: 'pending' | 'paid' | 'void'
          notes?: string | null
          incurred_on?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          id: number
          uuid: string
          name: string
          category: ExpenseCategory
          amount: number
          frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
          interval_count: number
          anchor_day: number | null
          start_on: string
          end_on: string | null
          next_occurrence_on: string
          vendor: string | null
          status: 'active' | 'paused' | 'ended'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          category: ExpenseCategory
          amount: number
          frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
          start_on: string
          next_occurrence_on: string
          uuid?: string
          interval_count?: number
          anchor_day?: number | null
          end_on?: string | null
          vendor?: string | null
          status?: 'active' | 'paused' | 'ended'
          notes?: string | null
        }
        Update: {
          name?: string
          category?: ExpenseCategory
          amount?: number
          frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
          interval_count?: number
          anchor_day?: number | null
          start_on?: string
          end_on?: string | null
          next_occurrence_on?: string
          vendor?: string | null
          status?: 'active' | 'paused' | 'ended'
          notes?: string | null
        }
        Relationships: []
      }
      expense_occurrences: {
        Row: {
          id: number
          uuid: string
          recurring_expense_id: number
          expense_id: number | null
          occurs_on: string
          generated_at: string
        }
        Insert: {
          recurring_expense_id: number
          occurs_on: string
          uuid?: string
          expense_id?: number | null
        }
        Update: {
          expense_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'expense_occurrences_recurring_expense_id_fkey'
            columns: ['recurring_expense_id']
            isOneToOne: false
            referencedRelation: 'recurring_expenses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'expense_occurrences_expense_id_fkey'
            columns: ['expense_id']
            isOneToOne: false
            referencedRelation: 'expenses'
            referencedColumns: ['id']
          },
        ]
      }
      notifications: {
        Row: {
          id: number
          uuid: string
          recipient_id: number
          type: string
          title: string
          body: string
          read_at: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          recipient_id: number
          type: string
          title: string
          body: string
          uuid?: string
          metadata?: Json
        }
        Update: {
          read_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          id: number
          uuid: string
          to_email: string
          template: string
          provider_id: string | null
          status: 'queued' | 'sent' | 'failed'
          payload_hash: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          to_email: string
          template: string
          uuid?: string
          provider_id?: string | null
          status?: 'queued' | 'sent' | 'failed'
          payload_hash?: string | null
          sent_at?: string | null
        }
        Update: {
          status?: 'queued' | 'sent' | 'failed'
          provider_id?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: number
          uuid: string
          actor_id: number | null
          action: string
          entity: string
          entity_id: string
          previous_value: Json | null
          new_value: Json | null
          ip_address: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          action: string
          entity: string
          entity_id: string
          uuid?: string
          actor_id?: number | null
          previous_value?: Json | null
          new_value?: Json | null
          ip_address?: string | null
          metadata?: Json
        }
        Update: Record<string, never>
        Relationships: []
      }
      settings: {
        Row: {
          id: number
          key: string
          value: Json
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          value?: Json
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          id: number
          uuid: string
          name: string
          logo_path: string | null
          email: string | null
          phone: string | null
          address: string | null
          currency: string
          timezone: string
          late_fee_policy: string | null
          deposit_rules: string | null
          cancellation_rules: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          uuid?: string
          logo_path?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          currency?: string
          timezone?: string
          late_fee_policy?: string | null
          deposit_rules?: string | null
          cancellation_rules?: string | null
        }
        Update: {
          name?: string
          logo_path?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          currency?: string
          timezone?: string
          late_fee_policy?: string | null
          deposit_rules?: string | null
          cancellation_rules?: string | null
        }
        Relationships: []
      }
      site_maintenance: {
        Row: {
          id: number
          uuid: string
          is_enabled: boolean
          title: string
          message: string
          created_at: string
          updated_at: string
        }
        Insert: {
          uuid?: string
          is_enabled?: boolean
          title?: string
          message?: string
        }
        Update: {
          is_enabled?: boolean
          title?: string
          message?: string
        }
        Relationships: []
      }
      maintenance_images: {
        Row: {
          id: number
          uuid: string
          storage_path: string
          alt: string
          sort_order: number
          created_at: string
        }
        Insert: {
          uuid?: string
          storage_path: string
          alt?: string
          sort_order?: number
        }
        Update: {
          storage_path?: string
          alt?: string
          sort_order?: number
        }
        Relationships: []
      }
      vouchers: {
        Row: {
          id: number
          uuid: string
          code: string
          name: string
          discount_type: 'percent' | 'fixed'
          discount_value: number
          max_redemptions: number | null
          redeemed_count: number
          min_subtotal: number
          starts_on: string | null
          ends_on: string | null
          status: 'draft' | 'active' | 'disabled'
          created_at: string
          updated_at: string
        }
        Insert: {
          code: string
          name: string
          discount_type: 'percent' | 'fixed'
          discount_value: number
          uuid?: string
          max_redemptions?: number | null
          redeemed_count?: number
          min_subtotal?: number
          starts_on?: string | null
          ends_on?: string | null
          status?: 'draft' | 'active' | 'disabled'
        }
        Update: {
          code?: string
          name?: string
          discount_type?: 'percent' | 'fixed'
          discount_value?: number
          max_redemptions?: number | null
          redeemed_count?: number
          min_subtotal?: number
          starts_on?: string | null
          ends_on?: string | null
          status?: 'draft' | 'active' | 'disabled'
        }
        Relationships: []
      }
      product_blocked_dates: {
        Row: {
          id: number
          uuid: string
          product_id: number
          starts_on: string
          ends_on: string
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          product_id: number
          starts_on: string
          ends_on: string
          reason?: string | null
          uuid?: string
        }
        Update: {
          starts_on?: string
          ends_on?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_blocked_dates_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      voucher_redemptions: {
        Row: {
          id: number
          uuid: string
          voucher_id: number
          rental_id: number
          customer_id: number
          code: string
          name: string
          discount_amount: number
          redeemed_at: string
        }
        Insert: {
          voucher_id: number
          rental_id: number
          customer_id: number
          code: string
          name: string
          discount_amount: number
          uuid?: string
        }
        Update: {
          discount_amount?: number
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      current_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      product_booked_quantity: {
        Args: {
          p_product_id: number
          p_starts_on: string
          p_ends_on: string
        }
        Returns: number
      }
      product_occupying_ranges: {
        Args: {
          p_product_id: number
          p_starts_on: string
          p_ends_on: string
        }
        Returns: {
          starts_on: string
          ends_on: string
          quantity: number
        }[]
      }
      product_blocked_ranges: {
        Args: {
          p_product_id: number
          p_starts_on: string
          p_ends_on: string
        }
        Returns: {
          starts_on: string
          ends_on: string
        }[]
      }
      rental_occupies_inventory: {
        Args: { p_status: string }
        Returns: boolean
      }
      write_audit_log: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id: string
          p_previous?: Json
          p_new?: Json
          p_ip?: string
          p_metadata?: Json
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
