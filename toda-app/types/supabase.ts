export type AppRole = "controller" | "official" | "auditor" | "secretary" | "chairman";
export type DriverStatus = "active" | "suspended" | "inactive";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      system_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          full_name: string;
          role: AppRole;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: AppRole;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: AppRole;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      drivers: {
        Row: {
          id: string;
          body_number: string;
          current_version: number;
          status: DriverStatus;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          body_number: string;
          current_version?: number;
          status?: DriverStatus;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          body_number?: string;
          current_version?: number;
          status?: DriverStatus;
          created_at?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      driver_profile_versions: {
        Row: {
          id: number;
          driver_id: string;
          version: number;
          full_name: string;
          contact_number: string | null;
          driver_photo_url: string | null;
          unit_photo_url: string | null;
          changed_by: string;
          change_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          driver_id: string;
          version: number;
          full_name: string;
          contact_number?: string | null;
          driver_photo_url?: string | null;
          unit_photo_url?: string | null;
          changed_by: string;
          change_reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          driver_id?: string;
          version?: number;
          full_name?: string;
          contact_number?: string | null;
          driver_photo_url?: string | null;
          unit_photo_url?: string | null;
          changed_by?: string;
          change_reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "driver_profile_versions_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          }
        ];
      };
      dispatch_logs: {
        Row: {
          id: number;
          driver_id: string;
          controller_id: string;
          launch_count: number;
          logged_at: string;
          is_voided: boolean;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
        };
        Insert: {
          id?: number;
          driver_id: string;
          controller_id: string;
          launch_count: number;
          logged_at?: string;
          is_voided?: boolean;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Update: {
          id?: number;
          driver_id?: string;
          controller_id?: string;
          launch_count?: number;
          logged_at?: string;
          is_voided?: boolean;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dispatch_logs_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "drivers";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_adjustments: {
        Row: {
          id: number;
          dispatch_id: number;
          official_id: string;
          adjustment_type: string;
          notes: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          dispatch_id: number;
          official_id: string;
          adjustment_type: string;
          notes: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          dispatch_id?: number;
          official_id?: string;
          adjustment_type?: string;
          notes?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_adjustments_dispatch_id_fkey";
            columns: ["dispatch_id"];
            isOneToOne: false;
            referencedRelation: "dispatch_logs";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      view_driver_active_summaries: {
        Row: {
          id: string;
          body_number: string;
          full_name: string;
          driver_photo_url: string | null;
          status: DriverStatus;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_user_role: {
        Args: Record<string, never>;
        Returns: AppRole;
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Convenience type aliases
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type DriverProfileVersion = Database["public"]["Tables"]["driver_profile_versions"]["Row"];
export type DispatchLog = Database["public"]["Tables"]["dispatch_logs"]["Row"];
export type AuditAdjustment = Database["public"]["Tables"]["audit_adjustments"]["Row"];
export type SystemSetting = Database["public"]["Tables"]["system_settings"]["Row"];

export type DriverSummary = Database["public"]["Views"]["view_driver_active_summaries"]["Row"];

// Extended types for UI
export interface DispatchLogWithDriver extends DispatchLog {
  drivers: {
    body_number: string;
    driver_profile_versions: {
      full_name: string;
      driver_photo_url: string | null;
    }[];
  };
}
